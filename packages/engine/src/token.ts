import { dayOf } from "./clock.js";
import { facilitiesOf } from "./demand.js";
import { returnPoolCashToDepositors } from "./finance.js";
import { companyAccount } from "./ledger.js";
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
  return Math.max(fdPriceUsd(w), w.cfg.token.launch.floorPriceUsd);
}

/** FD a dollar amount buys right now, after the buy fee (constant product, never cheaper than the floor). */
export function quoteBuyFd(w: World, usd: number): number {
  const net = usd * (1 - w.cfg.token.exchange.buyFeePct);
  const fd = w.ledger.balance(EXCHANGE_ACCOUNT);
  const cp = fd - (w.token.poolUsd * fd) / (w.token.poolUsd + net);
  const floor = w.cfg.token.launch.floorPriceUsd;
  return floor > 0 ? Math.min(cp, net / floor) : cp;
}

/** Dollars that buy `fd` FD right now, fee included. */
export function quoteUsdForFd(w: World, fd: number): number {
  const pool = w.ledger.balance(EXCHANGE_ACCOUNT);
  if (fd >= pool) return Infinity;
  const cp = (w.token.poolUsd * pool) / (pool - fd) - w.token.poolUsd;
  const net = Math.max(cp, fd * w.cfg.token.launch.floorPriceUsd);
  return net / (1 - w.cfg.token.exchange.buyFeePct);
}

export function buyFd(w: World, c: Company, usd: number): string | null {
  if (!tokenLive(w)) return "FD isn't on the market yet";
  if (!(usd > 0) || usd > c.usd.wallet + 1e-9) return "not enough dollars";
  const fee = usd * w.cfg.token.exchange.buyFeePct;
  const fd = quoteBuyFd(w, usd);
  w.token.poolUsd += usd - fee;
  w.ledger.post(w.t, EXCHANGE_ACCOUNT, companyAccount(c.id), fd, `swap:buy:${c.id}`);
  c.usd.wallet -= usd;
  c.usd.in += usd;
  earn(w, fee, "fee");
  return null;
}

export function sellFd(w: World, c: Company, fd: number): string | null {
  if (!tokenLive(w)) return "FD isn't on the market yet";
  if (!(fd > 0) || fd > sellableFd(w, c) + 0.01) return "only unlocked FD can be sold";
  const acct = companyAccount(c.id);
  const k = w.cfg.token.exchange;
  const pool = w.ledger.balance(EXCHANGE_ACCOUNT);
  // The whale rules (TOKENOMICS.md §3): a daily sell limit per company as a share of the pool's FD,
  // and a sell fee that rises with the single sale's price impact, all of it burned.
  const today = dayOf(w.t, w.cfg);
  if (c.soldFd.day !== today) c.soldFd = { day: today, fd: 0 };
  if (k.dailySellShareOfPool > 0 && c.soldFd.fd + fd > pool * k.dailySellShareOfPool + 0.01) return "over today's sell limit";
  const impact = fd / (pool + fd);
  const fee = fd * Math.min(k.sellFeeMax, k.sellFeePct + k.sellFeePerImpact * impact);
  const net = fd - fee;
  const usd = w.token.poolUsd - (w.token.poolUsd * pool) / (pool + net);
  // A one-sided launch has no dollars on the bid side until buyers bring them: nothing to sell into yet.
  if (usd <= 0.01) return "no dollars on the bid side yet";
  w.ledger.post(w.t, acct, "sink:exchange_fee", fee, `swap:fee:${c.id}`);
  w.ledger.post(w.t, acct, EXCHANGE_ACCOUNT, net, `swap:sell:${c.id}`);
  w.token.poolUsd -= usd;
  c.usd.out += usd;
  c.soldFd.fd += fd;
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

/** Mints an airdrop slice into the company's account. */
function mintAirdrop(w: World, c: Company, fd: number): void {
  if (fd <= 0) return;
  w.ledger.post(w.t, "faucet:airdrop", companyAccount(c.id), fd, `airdrop:${c.id}`);
  c.airdrop!.unlockedFd += fd;
  w.token.airdrop.mintedFd += fd;
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
    c.airdrop = { totalFd: share, unlockedFd: 0, forfeitedFd: 0, weeksLeft: tc.airdrop.unlockWeeks, claimedEarly: false };
    allocatedFd += share;
    mintAirdrop(w, c, share * tc.airdrop.atLaunch);
  });

  // Seeded with dollars, the pool opens two-sided at the launch price; with none, the treasury posts
  // FD alone (launch.liquidityFd) and the floor price stands until buyers' dollars lift the pool.
  // The farming season's dollar window (items.ts) is held for this day: every dollar of it seeds the pool.
  const seedUsd = tc.launch.seedUsd + w.token.treasury.seedEscrowUsd;
  const liquidityFd = seedUsd > 0 ? seedUsd / tc.launch.priceUsd : tc.launch.liquidityFd;
  w.ledger.post(w.t, "faucet:launch_liquidity", EXCHANGE_ACCOUNT, liquidityFd, "launch:liquidity");
  w.token.poolUsd = seedUsd;
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
  w.token.launch = { supplyBeforeFd, resetBurnedFd, lockedFd, airdropAllocatedFd: allocatedFd, unallocatedByCapFd: tc.airdrop.fd - allocatedFd, liquidityFd };
}

/** Take the rest of the airdrop now, less the haircut (never minted). */
export function claimAirdropNow(w: World, c: Company): string | null {
  const a = c.airdrop;
  if (!a || a.weeksLeft <= 0 || a.claimedEarly) return "nothing left to claim";
  const left = a.totalFd - a.unlockedFd - a.forfeitedFd;
  const haircut = left * w.cfg.token.airdrop.instantClaimHaircut;
  mintAirdrop(w, c, left - haircut);
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
  const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : tc.launch.priceUsd;
  const pot = pot0 * Math.min(1, avg / tc.launch.priceUsd);
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
    const carried = prev && prev.weeksLeft > 0 && !prev.claimedEarly ? Math.max(0, prev.totalFd - prev.unlockedFd - prev.forfeitedFd) : 0;
    c.airdrop = { totalFd: share + carried, unlockedFd: 0, forfeitedFd: 0, weeksLeft: tc.airdrop.unlockWeeks, claimedEarly: false };
    mintAirdrop(w, c, share * tc.airdrop.atLaunch);
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
  const hist = w.token.priceHistory.slice(-7);
  const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
  const held = w.ledger.balance("alloc:treasury");
  const pool = w.ledger.balance(EXCHANGE_ACCOUNT);
  if (avg < v.floorPriceUsd || held <= 0 || w.token.poolUsd <= 0 || pool <= 0) return;
  // Only what the pool absorbs without its price falling through the floor: after a sale of `fd` the
  // pool prices at poolUsd·pool/(pool+fd)², so the sale stops where that meets the floor.
  const room = Math.sqrt((w.token.poolUsd * pool) / v.floorPriceUsd) - pool;
  const fd = Math.min(held * v.perWeekShare, room);
  if (fd <= 0.01) return;
  const usd = w.token.poolUsd - (w.token.poolUsd * pool) / (pool + fd);
  if (usd <= 0.01) return;
  w.ledger.post(w.t, "alloc:treasury", EXCHANGE_ACCOUNT, fd, "vest:treasury");
  w.token.poolUsd -= usd;
  w.token.treasury.devUsd += usd;
  w.token.treasury.vestedFd += fd;
}

/** A liquidated company loses what's left of its airdrop. */
export function forfeitAirdrop(w: World, c: Company): void {
  const a = c.airdrop;
  if (!a || a.weeksLeft <= 0) return;
  const left = a.totalFd - a.unlockedFd - a.forfeitedFd;
  a.forfeitedFd += left;
  w.token.airdrop.forfeitedFd += left;
  a.weeksLeft = 0;
}

/**
 * Weekly, after launch: airdrop slices unlock for companies that handled enough
 * loads (and are forfeited otherwise); locked FD is used up first by spending; the
 * treasury books product revenue and queues its buyback share for the week ahead.
 */
export function weeklyToken(w: World): void {
  const { token: tc } = w.cfg;
  const slice = (1 - tc.airdrop.atLaunch) / tc.airdrop.unlockWeeks;
  let active = 0;
  for (const c of w.companies) {
    const a = c.airdrop;
    if (a && a.weeksLeft > 0) {
      const fd = a.totalFd * slice;
      if (c.liquidatingSince === null && c.loadsThisWeek >= tc.airdrop.loadsPerWeek) mintAirdrop(w, c, fd);
      else {
        a.forfeitedFd += fd;
        w.token.airdrop.forfeitedFd += fd;
      }
      a.weeksLeft--;
    }
    c.loadsThisWeek = 0;
    const spent = c.weeklySpend.at(-1) ?? 0;
    c.lockedFd = Math.max(0, Math.min(c.lockedFd - spent, w.ledger.balance(companyAccount(c.id))));
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
