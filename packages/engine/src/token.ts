import { doneShares, logbookWeek, milestoneText, openBook, openLogbook } from "./logbook.js";
import { dpow } from "@lanes/data";
import { startCeiling } from "./ceiling.js";
import { dayOf } from "./clock.js";
import { facilitiesOf } from "./demand.js";
import { returnPoolCashToDepositors } from "./finance.js";
import { companyAccount } from "./ledger.js";
import { contractAccount } from "./receivables.js";
import { exitAccount, stakeAccount } from "./staking.js";
import { workingCapital } from "./solvency.js";
import type { Company } from "./types.js";
import type { World } from "./world.js";

/**
 * FD as a real-money token (design proposal; see TOKENOMICS.md and config `token`).
 *
 * Beta: FD is play money, as in every other mode. Launch, at the end of beta:
 * beta FD above working capital is burned and what's kept is locked (spend-only);
 * an airdrop by beta Miles starts unlocking; the treasury opens an FD/USDC pool
 * with its own dollars and newly minted FD. Live: anyone can buy or sell unlocked
 * FD in the pool — buys pay a dollar fee to the treasury, sells pay an FD fee
 * that's burned — and half of the treasury's revenue buys FD back and burns it.
 *
 * Dollars never enter the FD ledger: the pool's dollar side, the treasury and each
 * company's wallet are plain numbers.
 */
export const EXCHANGE_ACCOUNT = "co:pool:exchange";

export function tokenLive(w: World): boolean {
  return w.token.launchDay !== null;
}

/** The pool's price, $ per FD. */
export function fdPriceUsd(w: World): number {
  const fd = w.ledger.balance(EXCHANGE_ACCOUNT);
  return fd > 0 ? w.token.poolUsd / fd : 0;
}

/** FD a company may sell: its balance less what's locked (launch carryover, starting grant). */
export function sellableFd(w: World, c: Company): number {
  return Math.max(0, w.ledger.balance(companyAccount(c.id)) - c.lockedFd);
}

/**
 * What a buyer pays per FD: the pool's price, but never below the launch floor while the protocol's
 * one-sided range stands (TODO.md "launch without capital"): the treasury's FD sells at the floor
 * until buyers' dollars have lifted the pool above it; those dollars stay as protocol-owned
 * liquidity, so the bid side builds itself from demand.
 */
export function askPriceUsd(w: World): number {
  return Math.max(fdPriceUsd(w), w.token.floorUsd);
}

/** FD a dollar amount buys right now, after the buy fee (constant product, never cheaper than the floor). */
export function quoteBuyFd(w: World, usd: number): number {
  const net = usd * (1 - w.cfg.token.exchange.buyFeePct);
  const fd = w.ledger.balance(EXCHANGE_ACCOUNT);
  const cp = fd - (w.token.poolUsd * fd) / (w.token.poolUsd + net);
  const floor = w.token.floorUsd;
  return floor > 0 ? Math.min(cp, net / floor) : cp;
}

/** Dollars that buy `fd` FD right now, fee included. */
export function quoteUsdForFd(w: World, fd: number): number {
  const pool = w.ledger.balance(EXCHANGE_ACCOUNT);
  if (fd >= pool) return Infinity;
  const cp = (w.token.poolUsd * pool) / (pool - fd) - w.token.poolUsd;
  const net = Math.max(cp, fd * w.token.floorUsd);
  return net / (1 - w.cfg.token.exchange.buyFeePct);
}

/**
 * The daily price band (exchange.priceBand): the low and high the price may reach today, around the day's
 * open, or null when it's off, past its days, or a one-sided launch's floor still rules (no dollars in the pool,
 * or the floor price standing).
 */
export function priceBand(w: World): { lo: number; hi: number } | null {
  const b = w.cfg.token.exchange.priceBand;
  if (!b.enabled || w.token.launchDay === null || w.token.poolUsd <= 0 || w.token.floorUsd > 0) return null;
  const day = dayOf(w.t, w.cfg);
  if (day - w.token.launchDay >= b.days) return null;
  if (w.token.dayOpen.day !== day) w.token.dayOpen = { day, price: fdPriceUsd(w) };
  const open = w.token.dayOpen.price;
  return open > 0 ? { lo: open * (1 - b.pct), hi: open * (1 + b.pct) } : null;
}

export function buyFd(w: World, c: Company, usd: number): string | null {
  if (!tokenLive(w)) return "FD isn't on the market yet";
  if (!(usd > 0) || usd > c.usd.wallet + 1e-9) return "not enough dollars";
  // The band: what lifts the price to today's high fills, the rest waits.
  const band = priceBand(w);
  if (band) {
    const pool = w.ledger.balance(EXCHANGE_ACCOUNT);
    const maxNet = Math.sqrt(band.hi * w.token.poolUsd * pool) - w.token.poolUsd;
    if (!(maxNet > 0.01)) return "the price is at today's limit up";
    const cap = maxNet / (1 - w.cfg.token.exchange.buyFeePct);
    if (usd > cap) {
      usd = cap;
      w.token.bandClips++;
    }
  }
  const fee = usd * w.cfg.token.exchange.buyFeePct;
  const fd = quoteBuyFd(w, usd);
  w.token.poolUsd += usd - fee;
  w.token.exchange.boughtFd += fd;
  w.ledger.post(w.t, EXCHANGE_ACCOUNT, companyAccount(c.id), fd, `swap:buy:${c.id}`);
  c.usd.wallet -= usd;
  c.usd.in += usd;
  earn(w, fee, "fee");
  return null;
}

/**
 * Today's sell limit, as a share of the pool's FD: the whale rule, tightened while the price is below its
 * trailing average (token.exchange.fallingLimit).
 */
export function sellLimitShare(w: World): number {
  const k = w.cfg.token.exchange;
  const fl = k.fallingLimit;
  if (!fl.enabled || k.dailySellShareOfPool <= 0) return k.dailySellShareOfPool;
  const recent = w.token.priceHistory.slice(-fl.lookbackDays);
  if (recent.length === 0) return k.dailySellShareOfPool;
  const avg = recent.reduce((s, p) => s + p, 0) / recent.length;
  const now = fdPriceUsd(w);
  if (!(avg > 0) || now >= avg) return k.dailySellShareOfPool;
  return k.dailySellShareOfPool * Math.max(fl.minShare, dpow(now / avg, fl.power));
}

/** FD the company may still sell today. */
export function sellRoomFd(w: World, c: Company): number {
  const share = sellLimitShare(w);
  if (share <= 0) return Infinity;
  const sold = c.soldFd.day === dayOf(w.t, w.cfg) ? c.soldFd.fd : 0;
  return Math.max(0, w.ledger.balance(EXCHANGE_ACCOUNT) * share - sold);
}

/** The frequency fee: the extra share of a sale a company pays for the days it has sold lately (counting today). */
export function frequencyFee(w: World, c: Company): number {
  const fq = w.cfg.token.exchange.frequency;
  if (!fq.enabled) return 0;
  const today = dayOf(w.t, w.cfg);
  const days = c.sellDays.filter((d) => d > today - fq.windowDays);
  const n = days.length + (days.at(-1) === today ? 0 : 1);
  return Math.min(fq.maxExtra, fq.perSellDay * Math.max(0, n - fq.freeSellDays));
}

/** The early-sale tax (exchange.launchTax): the least a sale pays in the months after launch, 0 when off or over. */
export function launchTaxRate(w: World): number {
  const k = w.cfg.token.exchange;
  const t = k.launchTax;
  if (!t.enabled || w.token.launchDay === null) return 0;
  const since = dayOf(w.t, w.cfg) - w.token.launchDay;
  if (since >= t.days) return 0;
  return t.startPct - (t.startPct - k.sellFeePct) * (since / t.days);
}

export function sellFd(w: World, c: Company, fd: number): string | null {
  if (!tokenLive(w)) return "FD isn't on the market yet";
  if (!(fd > 0) || fd > sellableFd(w, c) + 0.01) return "only unlocked FD can be sold";
  const acct = companyAccount(c.id);
  const k = w.cfg.token.exchange;
  const pool = w.ledger.balance(EXCHANGE_ACCOUNT);
  const feeRate = (x: number) => Math.max(launchTaxRate(w), Math.min(k.sellFeeMax, k.sellFeePct + frequencyFee(w, c) + k.sellFeePerImpact * (x / (pool + x))));
  // The band: what drops the price to today's low fills, the rest waits. The pool takes the sale net of its
  // fee, which grows with the sale, so the most it can be is found by a few steps up from below.
  const band = priceBand(w);
  if (band) {
    const maxNet = Math.sqrt((w.token.poolUsd * pool) / band.lo) - pool;
    if (!(maxNet > 0.01)) return "the price is at today's limit down";
    let cap = maxNet;
    for (let i = 0; i < 6; i++) cap = maxNet / (1 - feeRate(cap));
    if (fd > cap) {
      fd = cap;
      w.token.bandClips++;
    }
  }
  // The whale rules (TOKENOMICS.md §3): a daily sell limit per company as a share of the pool's FD,
  // and a sell fee that rises with the single sale's price impact, all of it burned. The bear-case
  // fixes: the limit tightens while the price falls, and the fee rises with how often a company sells.
  const today = dayOf(w.t, w.cfg);
  if (c.soldFd.day !== today) c.soldFd = { day: today, fd: 0 };
  const share = sellLimitShare(w);
  if (share > 0 && c.soldFd.fd + fd > pool * share + 0.01) return "over today's sell limit";
  const fee = fd * feeRate(fd);
  const net = fd - fee;
  const usd = w.token.poolUsd - (w.token.poolUsd * pool) / (pool + net);
  // A one-sided launch has no dollars on the bid side until buyers bring them: nothing to sell into yet.
  if (usd <= 0.01) return "no dollars on the bid side yet";
  w.ledger.post(w.t, acct, "sink:exchange_fee", fee, `swap:fee:${c.id}`);
  w.ledger.post(w.t, acct, EXCHANGE_ACCOUNT, net, `swap:sell:${c.id}`);
  w.token.exchange.soldFd += net;
  w.token.poolUsd -= usd;
  c.usd.out += usd;
  c.soldFd.fd += fd;
  if (k.frequency.enabled) {
    c.sellDays = c.sellDays.filter((d) => d > today - k.frequency.windowDays);
    if (c.sellDays.at(-1) !== today) c.sellDays.push(today);
  }
  return null;
}

function earn(w: World, usd: number, source: "fee" | "product"): void {
  const t = w.token.treasury;
  t.usd += usd;
  t.weekRevenueUsd += usd;
  if (source === "fee") t.feeUsd += usd;
  else t.productUsd += usd;
}

/** Lifetime Miles: snapshots from completed seasons plus the current one. */
function lifetimeMiles(c: Company): number {
  return c.milesHistory.reduce((a, b) => a + b, 0) + c.milesTotal;
}

/**
 * Unlocks an airdrop slice: paid into the company's account, or, while the supply ceiling holds the
 * scheduled payouts (ceiling.ts), queued on the company, owed until there's room.
 */
function unlockAirdrop(w: World, c: Company, fd: number): void {
  if (fd <= 0) return;
  c.airdrop!.unlockedFd += fd;
  if (w.token.ceiling.holding) c.airdrop!.queuedFd += fd;
  else payAirdrop(w, c, fd);
}

/** Mints an unlocked slice into the company's account. */
function payAirdrop(w: World, c: Company, fd: number): void {
  w.ledger.post(w.t, "faucet:airdrop", companyAccount(c.id), fd, `airdrop:${c.id}`);
  w.token.airdrop.mintedFd += fd;
}

/** Weekly, when the ceiling has room: queued slices are paid out of it, pro rata, to companies still running. */
function payQueuedAirdrop(w: World): void {
  const st = w.token.ceiling;
  if (st.holding || st.roomFd <= 0.01) return;
  const owed = w.companies.filter((c) => c.liquidatingSince === null && (c.airdrop?.queuedFd ?? 0) > 0.005);
  const queued = owed.reduce((s, c) => s + c.airdrop!.queuedFd, 0);
  if (queued <= 0.01) return;
  const share = Math.min(1, st.roomFd / queued);
  for (const c of owed) {
    const fd = c.airdrop!.queuedFd * share;
    c.airdrop!.queuedFd -= fd;
    payAirdrop(w, c, fd);
    st.releasedFd += fd;
  }
  st.roomFd = Math.max(0, st.roomFd - queued * share);
}

/**
 * Launch (end of beta). In order: Equipment Finance pays its cash out to
 * depositors; each company keeps working capital, locked, and the rest of its beta
 * FD is burned; the airdrop is allocated by lifetime Miles (capped per company,
 * the excess never minted) and its first quarter unlocks; the treasury seeds the
 * exchange pool.
 */
export function launchToken(w: World): void {
  const { token: tc } = w.cfg;
  const supplyBeforeFd = w.ledger.supply();
  returnPoolCashToDepositors(w);
  let resetBurnedFd = 0;
  let lockedFd = 0;
  for (const c of w.companies) {
    const acct = companyAccount(c.id);
    const balance = w.ledger.balance(acct);
    const keep = tc.launch.keepWorkingCapital ? Math.min(balance, workingCapital(w, c)) : 0;
    const burn = Math.floor((balance - Math.max(0, keep)) * 100) / 100;
    if (burn > 0.01) {
      w.ledger.post(w.t, acct, "sink:launch_reset", burn, `launch:${c.id}`);
      resetBurnedFd += burn;
    }
    c.lockedFd = Math.max(0, keep);
    lockedFd += c.lockedFd;
  }
  // The lean launch (Jeff, 2026-10-29): stakes, exit queues and contract stakes are beta FD too, and
  // are burned like wallets, so every position after launch is backed by real FD and nobody carries
  // play money through by parking it in a stake. Tiers and licences get their grace period to be
  // re-posted (staking.ts); factoring contracts end; the yard stays, its bond gone.
  for (const c of w.companies) {
    for (const acct of [stakeAccount(c.id), exitAccount(c.id), contractAccount(c.id)]) {
      const bal = w.ledger.balance(acct);
      if (bal > 0.01) {
        w.ledger.post(w.t, acct, "sink:launch_reset", bal, `launch:${c.id}`);
        resetBurnedFd += bal;
      }
    }
    c.stakedFd = 0;
    c.unstaking = [];
    c.tierGraceDay = null;
    if (c.factoring) {
      c.factoring = null;
      if (c.payTerms === "factor") c.payTerms = "net";
    }
    c.insuranceStakeFd = 0;
    c.yardBondFd = 0;
    for (const b of w.businesses) if (b.ownerId === c.id) b.bondFd = 0; // the business stays, its bond is gone (businesses.ts)
  }

  // The pot splits by Miles and by beta operating profit (losses count zero), at the configured
  // weights; a company shut down or being wound up at launch forfeits its share (Jeff, 2026-10-29).
  const eligible = w.companies.map((c) => c.liquidatingSince === null && c.authority.status !== "revoked");
  const miles = w.companies.map((c, i) => (eligible[i] ? lifetimeMiles(c) : 0));
  const profits = w.companies.map((c, i) => (eligible[i] ? Math.max(0, operatingResult(w, c)) : 0));
  const totalMiles = miles.reduce((a, b) => a + b, 0);
  const totalProfit = profits.reduce((a, b) => a + b, 0);
  const cap = tc.airdrop.fd * tc.airdrop.capShare;
  const { miles: wm, profit: wp } = tc.airdrop.weights;
  let allocatedFd = 0;
  w.companies.forEach((c, i) => {
    const score = (totalMiles > 0 ? (wm * miles[i]!) / totalMiles : 0) + (totalProfit > 0 ? (wp * profits[i]!) / totalProfit : 0);
    const share = Math.min(cap, tc.airdrop.fd * score);
    if (share <= 0) return;
    // The logbook (logbook.ts) in place of the weekly vest, when it's on.
    const book = tc.airdrop.logbook.enabled;
    c.airdrop = { totalFd: share, unlockedFd: 0, forfeitedFd: 0, queuedFd: 0, weeksLeft: book ? 0 : tc.airdrop.unlockWeeks, claimedEarly: false, ...(book ? { logbook: openLogbook(w, c, share) } : {}) };
    allocatedFd += share;
    unlockAirdrop(w, c, share * (book ? tc.airdrop.logbook.atLaunch : tc.airdrop.atLaunch));
    if (book) logbookStats(w).openFd += share * tc.airdrop.logbook.atLaunch;
  });

  // The pool: with dollars on hand (the seed, and every dollar of the farming season's window held in
  // escrow by items.ts), it opens two-sided against FD from the pool allocation sized to the float that
  // survived the reset, and the price is what those dollars support (Jeff, 2026-10-29). With no dollars
  // at all, the treasury posts FD alone and the reference price stands as the floor until buyers lift it.
  const seedUsd = tc.launch.seedUsd + w.token.treasury.seedEscrowUsd;
  const floatFd = w.ledger.supply();
  const liquidityFd = seedUsd > 0 ? Math.max(1, tc.launch.poolDepthShareOfFloat * floatFd) : tc.launch.liquidityFd;
  // The pool allocation funds the FD side; what it lacks comes from the treasury allocation — protocol-owned
  // liquidity (Jeff, 2026-10-30). A pool as deep as the float pays sellers less per FD, so it keeps its dollars
  // and holds its price path better than a shallow one, whatever the nominal launch price reads.
  if (tc.circular.enabled) {
    const short = liquidityFd - w.ledger.balance("alloc:pool");
    if (short > 0.005) w.ledger.post(w.t, "alloc:treasury", "alloc:pool", short, "launch:liquidity");
  }
  w.ledger.post(w.t, "faucet:launch_liquidity", EXCHANGE_ACCOUNT, liquidityFd, "launch:liquidity");
  w.token.poolUsd = seedUsd;
  w.token.launchPriceUsd = seedUsd > 0 ? seedUsd / liquidityFd : tc.launch.priceUsd;
  w.token.floorUsd = seedUsd > 0 ? 0 : tc.launch.priceUsd;
  w.token.treasury.seedUsd = seedUsd;
  w.token.treasury.seedEscrowUsd = 0;
  for (const c of w.companies) {
    c.taxBaseFd = operatingResult(w, c);
    c.seasonBase = { miles: lifetimeMiles(c), profit: operatingResult(w, c) };
  }
  w.token.profitTaxRate = tc.profitTaxRate;
  w.token.launchDay = dayOf(w.t, w.cfg);
  w.token.baseCarriers = w.companies.filter((c) => c.role === "carrier").length;
  w.listener?.({ kind: "launched" });
  w.token.launch = { supplyBeforeFd, resetBurnedFd, lockedFd, airdropAllocatedFd: allocatedFd, unallocatedByCapFd: tc.airdrop.fd - allocatedFd, liquidityFd, floatFd, priceUsd: w.token.launchPriceUsd };
  startCeiling(w);
}

/** Take the rest of the airdrop now, less the haircut (never minted). */
export function claimAirdropNow(w: World, c: Company): string | null {
  if (w.cfg.token.airdrop.logbook.enabled) return "the logbook unlocks the airdrop: there's no early claim";
  const a = c.airdrop;
  if (!a || a.weeksLeft <= 0 || a.claimedEarly) return "nothing left to claim";
  const left = a.totalFd - a.unlockedFd - a.forfeitedFd;
  const haircut = left * w.cfg.token.airdrop.instantClaimHaircut;
  unlockAirdrop(w, c, left - haircut);
  a.forfeitedFd += haircut;
  w.token.airdrop.haircutFd += haircut;
  a.weeksLeft = 0;
  a.claimedEarly = true;
  return null;
}

/**
 * Later airdrop seasons (airdrop.laterSeasons, TOKENOMICS.md "a season schedule"): at each year end
 * after launch the next pot is split like the launch pot, by the season's Miles and operating
 * profit, scaled down by how far the season's average price ran below the launch price, never up.
 * The slices vest like the launch ones; what is left of an unfinished vest rolls into the new one.
 */
export function seasonAirdrop(w: World): void {
  const tc = w.cfg.token;
  const n = w.token.airdrop.seasonsPaid;
  const pot0 = tc.airdrop.laterSeasons[n];
  if (pot0 === undefined) return;
  const hist = w.token.priceHistory.slice(-w.cfg.time.daysPerSeason);
  const ref = w.token.launchPriceUsd || tc.launch.priceUsd;
  const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : ref;
  const pot = pot0 * Math.min(1, avg / ref);
  const eligible = w.companies.map((c) => c.liquidatingSince === null && c.authority.status !== "revoked");
  const miles = w.companies.map((c, i) => (eligible[i] ? Math.max(0, lifetimeMiles(c) - c.seasonBase.miles) : 0));
  const profits = w.companies.map((c, i) => (eligible[i] ? Math.max(0, operatingResult(w, c) - c.seasonBase.profit) : 0));
  const totalMiles = miles.reduce((a, b) => a + b, 0);
  const totalProfit = profits.reduce((a, b) => a + b, 0);
  const cap = pot * tc.airdrop.capShare;
  const { miles: wm, profit: wp } = tc.airdrop.weights;
  w.companies.forEach((c, i) => {
    c.seasonBase = { miles: lifetimeMiles(c), profit: operatingResult(w, c) };
    const score = (totalMiles > 0 ? (wm * miles[i]!) / totalMiles : 0) + (totalProfit > 0 ? (wp * profits[i]!) / totalProfit : 0);
    const share = Math.min(cap, pot * score);
    if (share <= 0) return;
    const prev = c.airdrop;
    // The logbook: the season's share joins the company's open book; the milestones it has reached pay their
    // shares of it at once, and the deadline moves to the season's own. A company without one opens a book.
    const lb = tc.airdrop.logbook;
    const open = lb.enabled ? openBook(c) : null;
    if (open && prev) {
      prev.totalFd += share;
      open.allocationFd += share;
      open.deadlineDay = Math.max(open.deadlineDay, dayOf(w.t, w.cfg) + lb.deadlineDays);
      const d = doneShares(w, c, open);
      unlockAirdrop(w, c, share * (lb.atLaunch + d.honest + d.criminal));
      const st = logbookStats(w);
      st.openFd += share * lb.atLaunch;
      st.honestFd += share * d.honest;
      st.criminalFd += share * d.criminal;
      return;
    }
    const carried = !lb.enabled && prev && prev.weeksLeft > 0 && !prev.claimedEarly ? Math.max(0, prev.totalFd - prev.unlockedFd - prev.forfeitedFd) : 0;
    // Slices still queued under the supply ceiling stay owed in the new vest.
    c.airdrop = { totalFd: share + carried, unlockedFd: 0, forfeitedFd: 0, queuedFd: prev?.queuedFd ?? 0, weeksLeft: lb.enabled ? 0 : tc.airdrop.unlockWeeks, claimedEarly: false, ...(lb.enabled ? { logbook: openLogbook(w, c, share) } : {}) };
    unlockAirdrop(w, c, share * (lb.enabled ? lb.atLaunch : tc.airdrop.atLaunch));
    if (lb.enabled) logbookStats(w).openFd += share * lb.atLaunch;
  });
  w.token.airdrop.seasonsPaid++;
  w.listener?.({ kind: "launched" });
}

/**
 * The developer's FD, vested (TOKENOMICS.md "FD only"): weekly after the cliff, at most
 * treasury.vest.perWeekShare of the treasury's holdings sold into the pool, never in a week the price
 * averaged below the floor. The dollars it brings are the developer's revenue; the sale is the sell
 * pressure the runs must carry. Only under the cap, where the treasury allocation exists.
 */
export function weeklyVest(w: World): void {
  const v = w.cfg.token.treasury.vest;
  if (!w.cfg.token.circular.enabled || v.perWeekShare <= 0 || w.token.launchDay === null) return;
  if (dayOf(w.t, w.cfg) - w.token.launchDay < v.cliffWeeks * 7) return;
  // The supply ceiling holds the scheduled payouts this week (ceiling.ts): the treasury keeps its FD.
  if (w.token.ceiling.holding) {
    w.token.ceiling.vestHeldWeeks++;
    return;
  }
  const hist = w.token.priceHistory.slice(-7);
  const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
  const held = w.ledger.balance("alloc:treasury");
  const pool = w.ledger.balance(EXCHANGE_ACCOUNT);
  const floor = w.token.launchPriceUsd;
  if (floor <= 0 || avg < floor || held <= 0 || w.token.poolUsd <= 0 || pool <= 0) return;
  // Only what the pool absorbs without its price falling through the launch price: after a sale of
  // `fd` the pool prices at poolUsd·pool/(pool+fd)², so the sale stops where that meets it.
  const room = Math.sqrt((w.token.poolUsd * pool) / floor) - pool;
  const fd = Math.min(held * v.perWeekShare, room);
  if (fd <= 0.01) return;
  const usd = w.token.poolUsd - (w.token.poolUsd * pool) / (pool + fd);
  if (usd <= 0.01) return;
  w.ledger.post(w.t, "alloc:treasury", EXCHANGE_ACCOUNT, fd, "vest:treasury");
  w.token.poolUsd -= usd;
  w.token.treasury.devUsd += usd;
  w.token.treasury.vestedFd += fd;
}

/** A liquidated company loses what's left of its airdrop, slices queued under the supply ceiling included. */
export function forfeitAirdrop(w: World, c: Company): void {
  const a = c.airdrop;
  if (!a) return;
  w.token.airdrop.forfeitedFd += a.queuedFd;
  a.queuedFd = 0;
  const book = openBook(c);
  if (a.weeksLeft <= 0 && !book) return;
  const left = a.totalFd - a.unlockedFd - a.forfeitedFd;
  a.forfeitedFd += left;
  w.token.airdrop.forfeitedFd += left;
  a.weeksLeft = 0;
  if (book) book.closed = true;
}

/** A conviction under the logbook (fraud.ts): whatever is still locked is forfeited. */
export function convictionForfeit(w: World, c: Company): void {
  if (!w.cfg.token.airdrop.logbook.enabled || !c.airdrop || !openBook(c)) return;
  const left = Math.max(0, c.airdrop.totalFd - c.airdrop.unlockedFd - c.airdrop.forfeitedFd);
  logbookStats(w).convictedFd += left + c.airdrop.queuedFd;
  forfeitAirdrop(w, c);
}

/** The logbook's tallies, started the first time it runs. */
function logbookStats(w: World): NonNullable<World["token"]["airdrop"]["logbook"]> {
  return (w.token.airdrop.logbook ??= { openFd: 0, honestFd: 0, criminalFd: 0, lostFd: 0, convictedFd: 0, reached: {} });
}

/** The logbook's week for a company (logbook.ts): the milestones reached are paid; past the deadline, what's left is lost. */
function logbookPay(w: World, c: Company): void {
  const a = c.airdrop!;
  const st = logbookStats(w);
  const { reached, lostFd } = logbookWeek(w, c);
  for (const r of reached) {
    unlockAirdrop(w, c, r.fd);
    st.reached[r.id] = (st.reached[r.id] ?? 0) + 1;
    if (r.path === "honest") st.honestFd += r.fd;
    else st.criminalFd += r.fd;
    w.listener?.({ kind: "notice", companyId: c.id, topic: "airdrop", text: `Logbook: ${milestoneText(r.id)}. ${Math.round(r.fd).toLocaleString("en-US")} FD of your airdrop unlocked.`, tone: "good" });
  }
  if (lostFd > 0.005) {
    a.forfeitedFd += lostFd;
    w.token.airdrop.forfeitedFd += lostFd;
    st.lostFd += lostFd;
  }
}

/**
 * Weekly, after launch: airdrop slices unlock for companies that handled enough
 * loads (and are forfeited otherwise); locked FD is used up first by spending; the
 * treasury books product revenue and queues its buyback share for the week ahead.
 */
export function weeklyToken(w: World): void {
  const { token: tc } = w.cfg;
  const slice = (1 - tc.airdrop.atLaunch) / tc.airdrop.unlockWeeks;
  payQueuedAirdrop(w);
  let active = 0;
  for (const c of w.companies) {
    const a = c.airdrop;
    if (a && a.weeksLeft > 0) {
      const fd = a.totalFd * slice;
      if (c.liquidatingSince === null && c.loadsThisWeek >= tc.airdrop.loadsPerWeek) unlockAirdrop(w, c, fd);
      else {
        a.forfeitedFd += fd;
        w.token.airdrop.forfeitedFd += fd;
      }
      a.weeksLeft--;
    }
    if (a && openBook(c)) logbookPay(w, c);
    c.loadsThisWeek = 0;
    const spent = c.weeklySpend.at(-1) ?? 0;
    c.lockedFd = Math.max(0, Math.min(c.lockedFd - spent, w.ledger.balance(companyAccount(c.id))));
    c.freePathLockedFd = Math.min(c.freePathLockedFd, c.lockedFd); // spending uses the free path's locked FD too
    if (c.liquidatingSince === null) active++;
  }
  if (w.token.profitTaxRate > 0) chargeProfitTax(w);
  earn(w, tc.treasury.productUsdPerCompanyWeek * active, "product");
  const t = w.token.treasury;
  const buyback = t.weekRevenueUsd * tc.treasury.buybackShare;
  t.opsUsd += t.weekRevenueUsd - buyback;
  t.buybackQueueUsd += buyback;
  t.dailyBuybackUsd = t.buybackQueueUsd / 7;
  t.weekRevenueUsd = 0;
}

/** A company's running operating result: freight (carriers, brokers) plus its facilities. */
function operatingResult(w: World, c: Company): number {
  return c.operating.revenueFd - c.operating.costFd + facilitiesOf(w, c.id).reduce((s, f) => s + f.netFd, 0);
}

/**
 * Weekly: a share of each company's operating profit this week, above the
 * allowance, is burned. Loss-making weeks and small operators pay nothing.
 */
function chargeProfitTax(w: World): void {
  const { profitTaxAllowanceFd } = w.cfg.token;
  const profitTaxRate = w.token.profitTaxRate;
  for (const c of w.companies) {
    const now = operatingResult(w, c);
    const taxable = now - c.taxBaseFd - profitTaxAllowanceFd;
    c.taxBaseFd = now;
    if (taxable <= 0 || c.liquidatingSince !== null) continue;
    const tax = Math.min(taxable * profitTaxRate, Math.max(0, w.ledger.balance(companyAccount(c.id))));
    if (tax <= 0.01) continue;
    // The circular economy: a share of the tax still burns (circular.taxBurnShare), the rest refills the reserve.
    const burn = w.cfg.token.circular.enabled ? tax * w.cfg.token.circular.taxBurnShare : 0;
    if (burn > 0.01) w.ledger.post(w.t, companyAccount(c.id), "sink:profit_tax_burn", burn, `tax:${c.id}`);
    if (tax - burn > 0.01) w.ledger.post(w.t, companyAccount(c.id), "sink:profit_tax", tax - burn, `tax:${c.id}`);
  }
}

/** Daily, after launch: a seventh of the week's buyback buys FD from the pool and burns it. */
export function dailyBuyback(w: World): void {
  const t = w.token.treasury;
  const usd = Math.min(t.buybackQueueUsd, t.dailyBuybackUsd);
  if (usd > 0.01) {
    const pool = w.ledger.balance(EXCHANGE_ACCOUNT);
    const fd = pool - (w.token.poolUsd * pool) / (w.token.poolUsd + usd);
    w.token.poolUsd += usd;
    w.ledger.post(w.t, EXCHANGE_ACCOUNT, "sink:buyback", fd, "buyback:treasury");
    t.buybackQueueUsd -= usd;
    t.usd -= usd;
    t.buybackUsd += usd;
    t.buybackFd += fd;
  }
  // The pool's own price, what a seller gets (zero while a one-sided range has no dollars yet). The
  // floor-held ask is the buy price only: gating protocol sales and sizing airdrops on it would read a
  // pool at $0.0002 as a market at a cent (the v27-b batch did, and vested 117M FD into it).
  w.token.priceHistory.push(fdPriceUsd(w));
}

/** Mean pool price over the last `days` days (the current price before any history). */
export function averagePriceUsd(w: World, days: number): number {
  const h = w.token.priceHistory;
  if (h.length === 0) return fdPriceUsd(w);
  const tail = h.slice(-days);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

/** Monthly, after launch: NPC freight grows with the carrier base, so new players find freight to haul. */
export function scaleDemand(w: World): void {
  if (!w.cfg.token.demandScalesWithCarriers || w.token.baseCarriers === 0) return;
  const carriers = w.companies.filter((c) => c.role === "carrier" && c.liquidatingSince === null).length;
  w.demandScale = Math.max(1, carriers / w.token.baseCarriers);
}
