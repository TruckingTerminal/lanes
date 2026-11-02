import { doneShares, logbookWeek, milestoneText, openBook, openLogbook } from "./logbook.js";
import { dpow } from "@lanes/data";
import { startCeiling } from "./ceiling.js";
import { dayOf } from "./clock.js";
import { facilitiesOf } from "./demand.js";
import { returnPoolCashToDepositors } from "./finance.js";
import { companyAccount } from "./ledger.js";
import { callBond, contractAccount } from "./receivables.js";
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

/** A company's spend-only FD (ledger.locked): the launch carryover, a grant, the free path's earnings, the airdrop paid locked, locked FD received. */
export function lockedFd(w: World, c: Company): number {
  return w.ledger.locked(companyAccount(c.id));
}

/** FD a company may withdraw (sell): its balance less what's locked. */
export function sellableFd(w: World, c: Company): number {
  return w.ledger.free(companyAccount(c.id));
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

/**
 * The decaying launch fee (exchange.launchFee): the least the pool charges on a side today, falling from its start
 * to that side's normal fee `base` over its days; 0 when it's off, over, or under the normal fee.
 */
export function launchFeeRate(w: World, base: number): number {
  const f = w.cfg.token.exchange.launchFee;
  if (!f.enabled || w.token.launchDay === null || f.days <= 0 || f.startPct <= base) return 0;
  const since = dayOf(w.t, w.cfg) - w.token.launchDay;
  if (since >= f.days) return 0;
  const x = since / f.days;
  const floor = Math.max(base, 1e-4);
  return f.curve === "linear" ? f.startPct - (f.startPct - base) * x : floor * dpow(f.startPct / floor, 1 - x);
}

/** The size fee (exchange.sizeFee): what a buy of `usd` pays over the normal fee for its size, in its days after launch. */
export function sizeFeeRate(w: World, usd: number): number {
  const s = w.cfg.token.exchange.sizeFee;
  if (!s.enabled || w.token.launchDay === null || s.refUsd <= 0) return 0;
  if (dayOf(w.t, w.cfg) - w.token.launchDay >= s.days) return 0;
  return Math.min(s.maxPct, s.perRefPct * Math.max(0, usd / s.refUsd - 1));
}

/** The share of a buy of `usd` paid in fees: the normal fee or the launch fee, whichever is higher, plus the size fee. */
export function buyFeeRate(w: World, usd: number): number {
  const k = w.cfg.token.exchange;
  return Math.min(0.99, Math.max(k.buyFeePct, launchFeeRate(w, k.buyFeePct)) + sizeFeeRate(w, usd));
}

/** FD a dollar amount buys right now, after the buy fee (constant product, never cheaper than the floor). */
export function quoteBuyFd(w: World, usd: number): number {
  const net = usd * (1 - buyFeeRate(w, usd));
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
  // The size fee grows with the order, so the gross is found by a few steps from the plain fee.
  let usd = net / (1 - w.cfg.token.exchange.buyFeePct);
  for (let i = 0; i < 6; i++) usd = net / (1 - buyFeeRate(w, usd));
  return usd;
}

/** The bridge (token.bridge.cancelBurn): takes back every withdrawal still waiting, less the cancel burn; the FD comes back free. */
export function cancelWithdrawal(w: World, c: Company): string | null {
  if (!w.cfg.token.bridge.enabled) return "there's no withdrawal queue";
  if (c.withdrawals.length === 0) return "nothing is waiting";
  const acct = bridgeAccount(c.id);
  const held = w.ledger.balance(acct);
  const burn = Math.floor(held * w.cfg.token.bridge.cancelBurn * 100) / 100;
  if (burn > 0.005) w.ledger.post(w.t, acct, "sink:exchange_fee", burn, `bridge:cancel:${c.id}`);
  if (held - burn > 0.005) w.ledger.post(w.t, acct, companyAccount(c.id), held - burn, `bridge:cancel:${c.id}`);
  w.token.bridge.requestedFd -= c.withdrawals.reduce((s, r) => s + r.fd, 0);
  w.token.bridge.cancelledFd += held;
  c.withdrawals = [];
  return null;
}

/** The opening auction (token.launch.auction): a bid before launch, its dollars held until the launch clears it. */
export function bidAuction(w: World, c: Company, usd: number): string | null {
  const k = w.cfg.token.launch.auction;
  if (!k.enabled || !w.cfg.token.enabled) return "there's no opening auction";
  if (tokenLive(w)) return "the auction closed at launch";
  if (!(usd > 0) || usd > c.usd.wallet + 1e-9) return "not enough dollars";
  const mine = w.token.auctionBids.reduce((s, b) => s + (b.companyId === c.id ? b.usd : 0), 0);
  if (mine + usd > k.capUsd + 1e-9) return `at most $${k.capUsd.toLocaleString("en-US")} a person in the auction`;
  c.usd.wallet -= usd;
  w.token.auctionBids.push({ companyId: c.id, usd });
  return null;
}

/**
 * At launch, after the reset: the tranche sells at one price, every dollar bid over it (never under the reserve
 * price: then fewer FD sell), each bidder paid in proportion to its dollars; the pool's share of the dollars opens
 * it, with FD at the clearing price, and the rest is the treasury's. Null when the auction is off or nobody bid.
 */
function clearAuction(w: World, seedUsd: number): { poolFd: number; poolUsd: number; priceUsd: number } | null {
  const k = w.cfg.token.launch.auction;
  const bids = w.token.auctionBids;
  w.token.auctionBids = [];
  const total = bids.reduce((s, b) => s + b.usd, 0);
  if (!k.enabled || total <= 0.01 || k.trancheFd <= 0) return null;
  let priceUsd = total / k.trancheFd;
  let fd = k.trancheFd;
  if (k.reservePriceUsd > 0 && priceUsd < k.reservePriceUsd) {
    priceUsd = k.reservePriceUsd;
    fd = total / priceUsd;
  }
  const exempt = w.cfg.token.exchange.launchTax.boughtExempt;
  for (const b of bids) {
    const c = w.companies[b.companyId - 1]!;
    const got = fd * (b.usd / total);
    w.ledger.post(w.t, "faucet:auction", companyAccount(c.id), got, `auction:${c.id}`);
    if (exempt) c.boughtFdOpen = (c.boughtFdOpen ?? 0) + got; // bought with dollars: the early-sale tax doesn't fall on it
    c.usd.in += b.usd;
  }
  const poolUsd = seedUsd + total * k.poolShare;
  const treasuryUsd = total * (1 - k.poolShare);
  w.token.treasury.usd += treasuryUsd;
  w.token.treasury.opsUsd += treasuryUsd;
  const poolFd = poolUsd / priceUsd;
  w.token.auction = { usd: total, fd, bidders: new Set(bids.map((b) => b.companyId)).size, priceUsd, poolUsd, poolFd, treasuryUsd };
  return { poolFd, poolUsd, priceUsd };
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
    let cap = maxNet / (1 - w.cfg.token.exchange.buyFeePct);
    for (let i = 0; i < 6; i++) cap = maxNet / (1 - buyFeeRate(w, cap));
    if (usd > cap) {
      usd = cap;
      w.token.bandClips++;
    }
  }
  const fee = usd * buyFeeRate(w, usd);
  const fd = quoteBuyFd(w, usd);
  w.token.poolUsd += usd - fee;
  w.token.exchange.boughtFd += fd;
  if (w.cfg.token.exchange.launchTax.boughtExempt) c.boughtFdOpen = (c.boughtFdOpen ?? 0) + fd;
  w.ledger.post(w.t, EXCHANGE_ACCOUNT, companyAccount(c.id), fd, `swap:buy:${c.id}`);
  c.usd.wallet -= usd;
  c.usd.in += usd;
  earn(w, fee, "fee");
  w.token.launchFee.buyUsd += Math.max(0, fee - usd * w.cfg.token.exchange.buyFeePct);
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
  if (share <= 0 || c.onChain || w.cfg.token.bridge.enabled) return Infinity; // the bridge caps what clears, not what's asked
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

/** The bridge's holding account: FD waiting out the withdrawal timer (token.bridge), still inside the game. */
export const bridgeAccount = (companyId: number) => `co:bridge:${companyId}`;

/** The withdrawal timer (token.bridge.delayDays) for a request made on `day`: from its start at launch to its end after its days. */
export function bridgeDelayDays(w: World, day: number): number {
  const d = w.cfg.token.bridge.delayDays;
  if (w.token.launchDay === null) return d.start;
  const x = d.overDays > 0 ? Math.min(1, Math.max(0, day - w.token.launchDay) / d.overDays) : 1;
  return Math.round(d.start - (d.start - d.end) * x);
}

/**
 * A sale of FD. A wallet outside the game (a speculator, adversaries.onChain) meets the pool alone. A game account
 * goes through the bridge (token.bridge): the FD is frozen in its bridge account and leaves when the timer has
 * run, through the exchange's rules (dailyBridge); with the bridge off it leaves at once through the same rules.
 * The sim treats every withdrawal as sold into the pool the day it clears (Jeff, 2026-11-01).
 */
export function sellFd(w: World, c: Company, fd: number): string | null {
  if (!tokenLive(w)) return "FD isn't on the market yet";
  if (!(fd > 0) || fd > sellableFd(w, c) + 0.01) return "only unlocked FD can be sold";
  if (c.onChain) return asError(settleSale(w, c, fd, companyAccount(c.id), "wallet", false));
  if (!w.cfg.token.bridge.enabled) return asError(settleSale(w, c, fd, companyAccount(c.id), "bridge", false));
  w.ledger.post(w.t, companyAccount(c.id), bridgeAccount(c.id), fd, `bridge:request:${c.id}`, "freeOnly");
  c.withdrawals.push({ fd, day: dayOf(w.t, w.cfg) });
  w.token.bridge.requestedFd += fd;
  return null;
}

const asError = (r: string | number): string | null => (typeof r === "string" ? r : null);

/**
 * Sells `fd` from `from` into the pool and returns what sold, or why nothing did. The bridge path charges the
 * exchange's rules: the early-sale tax on farmed FD, the per-company daily limit, the frequency and impact fees,
 * the band when it's on, and the bridge's daily cap for the whole game; with `partial` it sells what the limits
 * allow and leaves the rest. The wallet path pays the pool's own fees only (the base fee, the launch fee).
 */
function settleSale(w: World, c: Company, fd: number, from: string, path: "wallet" | "bridge", partial: boolean): string | number {
  const k = w.cfg.token.exchange;
  const pool = w.ledger.balance(EXCHANGE_ACCOUNT);
  const today = dayOf(w.t, w.cfg);
  const poolFee = launchFeeRate(w, k.sellFeePct);
  // FD the company bought and hasn't sold back pays only the normal fee (exchange.launchTax.boughtExempt). The
  // pool's own launch fee (exchange.launchFee) is the least any sale pays, bought FD included: a pool can't tell.
  const exempt = path === "wallet" ? Infinity : k.launchTax.boughtExempt ? (c.boughtFdOpen ?? 0) : 0;
  const feeRateWith = (x: number, pf: number) => {
    const normal = path === "wallet" ? Math.max(pf, k.sellFeePct) : Math.max(pf, Math.min(k.sellFeeMax, k.sellFeePct + frequencyFee(w, c) + k.sellFeePerImpact * (x / (pool + x))));
    const rate = Math.max(launchTaxRate(w), normal);
    if (exempt <= 0 || x <= 0) return rate;
    const taxed = Math.max(0, x - exempt);
    return (normal * (x - taxed) + rate * taxed) / x;
  };
  const feeRate = (x: number) => feeRateWith(x, poolFee);
  if (path === "bridge") {
    // The whale rules (TOKENOMICS.md §3): a daily sell limit per company as a share of the pool's FD, and a sell
    // fee that rises with the single sale's price impact, all of it burned. The bear-case fixes: the limit
    // tightens while the price falls, and the fee rises with how often a company sells. The bridge's cap: the
    // whole game may withdraw at most its share of the pool a day.
    if (c.soldFd.day !== today) c.soldFd = { day: today, fd: 0 };
    const share = sellLimitShare(w);
    const b = w.cfg.token.bridge;
    if (w.token.bridge.dayOut.day !== today) w.token.bridge.dayOut = { day: today, fd: 0 };
    const roomCompany = share > 0 ? pool * share - c.soldFd.fd : Infinity;
    const roomGame = b.enabled ? b.dailyOutflowShareOfPool * pool - w.token.bridge.dayOut.fd : Infinity;
    const room = Math.min(roomCompany, roomGame);
    if (fd > room + 0.01) {
      if (!partial) return roomGame < roomCompany ? "over the bridge's daily cap" : "over today's sell limit";
      if (roomGame < roomCompany) w.token.bridge.cappedFd += fd - Math.max(0, room);
      fd = Math.max(0, room);
      if (fd <= 0.01) return "nothing clears today";
    }
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
  }
  // To the cent, so the fee and the net add up to exactly what's sold (the ledger keeps cents).
  fd = Math.round(fd * 100) / 100;
  const fee = Math.round(fd * feeRate(fd) * 100) / 100;
  const net = fd - fee;
  const usd = w.token.poolUsd - (w.token.poolUsd * pool) / (pool + net);
  // A one-sided launch has no dollars on the bid side until buyers bring them: nothing to sell into yet.
  if (usd <= 0.01) return "no dollars on the bid side yet";
  const mode = from === companyAccount(c.id) ? "freeOnly" : undefined;
  w.ledger.post(w.t, from, "sink:exchange_fee", fee, `swap:fee:${c.id}`, mode);
  if (poolFee > 0) w.token.launchFee.sellFd += Math.max(0, fee - fd * feeRateWith(fd, 0));
  w.ledger.post(w.t, from, EXCHANGE_ACCOUNT, net, `swap:sell:${c.id}`, mode);
  w.token.exchange.soldFd += net;
  w.token.poolUsd -= usd;
  c.usd.out += usd;
  if (path === "bridge") {
    c.soldFd.fd += fd;
    w.token.bridge.dayOut.fd += fd;
    if (exempt > 0 && Number.isFinite(exempt)) c.boughtFdOpen = Math.max(0, exempt - fd);
    if (k.frequency.enabled) {
      c.sellDays = c.sellDays.filter((d) => d > today - k.frequency.windowDays);
      if (c.sellDays.at(-1) !== today) c.sellDays.push(today);
    }
  }
  return fd;
}

/** Daily: withdrawals whose timer has run leave through the exchange's rules, as far as the day's limits allow; the rest waits. */
export function dailyBridge(w: World): void {
  if (!w.cfg.token.bridge.enabled || !tokenLive(w)) return;
  const today = dayOf(w.t, w.cfg);
  const st = w.token.bridge;
  for (const c of w.companies) {
    if (c.withdrawals.length === 0) continue;
    const kept: Company["withdrawals"] = [];
    let capped = false;
    for (const r of c.withdrawals) {
      if (today < r.day + bridgeDelayDays(w, r.day)) {
        kept.push(r);
        continue;
      }
      const held = w.ledger.balance(bridgeAccount(c.id));
      const want = Math.min(r.fd, held);
      const sold = want > 0.01 ? settleSale(w, c, want, bridgeAccount(c.id), "bridge", true) : 0;
      if (typeof sold === "string" || sold <= 0.005) {
        kept.push(r);
        capped = true;
        continue;
      }
      if (sold < r.fd - 0.005) {
        kept.push({ fd: r.fd - sold, day: r.day });
        capped = true;
      }
      st.clearedFd += sold;
      st.cleared++;
      st.waitDays += today - r.day;
    }
    if (capped) st.cappedDays++;
    c.withdrawals = kept;
  }
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
  const a = c.airdrop!;
  a.unlockedFd += fd;
  if (a.lockedFd !== undefined) {
    // Paid locked at the TGE (logbook.paidLocked): the FD is already in the account; the milestone frees its share
    // for withdrawal, as far as it is still there (spent locked FD is gone, and nothing is minted in its place).
    const acct = companyAccount(c.id);
    const own = Math.min(a.lockedFd, w.ledger.locked(acct));
    const u = Math.min(fd, own);
    w.ledger.unlock(acct, u);
    a.lockedFd = Math.max(0, own - u);
    return;
  }
  if (w.token.ceiling.holding) a.queuedFd += fd;
  else payAirdrop(w, c, fd);
}

/**
 * logbook.paidLocked: pays `fd` of an allocation into the company's account at once, `freeShare` of it free and
 * the rest spend-only (ledger.ts), unlocked later by the milestones.
 */
function payLockedAirdrop(w: World, c: Company, fd: number, freeShare: number): void {
  if (fd <= 0) return;
  const a = c.airdrop!;
  const acct = companyAccount(c.id);
  w.ledger.post(w.t, "faucet:airdrop", acct, fd, `airdrop:${c.id}`);
  w.token.airdrop.mintedFd += fd;
  const free = fd * Math.min(1, Math.max(0, freeShare));
  const locked = w.ledger.lock(acct, fd - free);
  a.lockedFd = (a.lockedFd ?? 0) + locked;
  a.unlockedFd += free;
}

/** logbook.paidLocked: burns what's still locked and unspent of a forfeited or lapsed allocation, up to `fd`; returns what burned. */
function burnLockedAirdrop(w: World, c: Company, fd: number): number {
  const a = c.airdrop!;
  if (a.lockedFd === undefined || fd <= 0) return 0;
  const acct = companyAccount(c.id);
  const own = Math.min(a.lockedFd, w.ledger.locked(acct));
  const burn = Math.floor(Math.min(fd, own) * 100) / 100;
  if (burn > 0.005) w.ledger.post(w.t, acct, "sink:airdrop_forfeit", burn, `forfeit:${c.id}`, "lockedFirst");
  a.lockedFd = Math.max(0, own - burn);
  return burn;
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
  // Under the factoring contract a broker's bond pays its paper before the reset takes it (the NPC factor's first),
  // so what it pays its carriers is beta FD like the rest of their wallets.
  for (const c of w.companies) callBond(w, c);
  for (const c of w.companies) {
    const acct = companyAccount(c.id);
    const balance = w.ledger.balance(acct);
    const keep = tc.launch.keepWorkingCapital ? Math.min(balance, workingCapital(w, c)) : 0;
    const burn = Math.floor((balance - Math.max(0, keep)) * 100) / 100;
    if (burn > 0.01) {
      w.ledger.post(w.t, acct, "sink:launch_reset", burn, `launch:${c.id}`);
      resetBurnedFd += burn;
    }
    // What's kept is spend-only: locked in the ledger, on top of whatever was locked already.
    w.ledger.lock(acct, Math.max(0, keep));
    lockedFd += w.ledger.locked(acct);
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
    c.locks = []; // locks are beta FD too
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
    if (book && tc.airdrop.logbook.paidLocked) payLockedAirdrop(w, c, share, tc.airdrop.logbook.atLaunch);
    else unlockAirdrop(w, c, share * (book ? tc.airdrop.logbook.atLaunch : tc.airdrop.atLaunch));
    if (book) logbookStats(w).openFd += share * tc.airdrop.logbook.atLaunch;
  });

  // The pool: with dollars on hand (the seed, and every dollar of the farming season's window held in
  // escrow by items.ts), it opens two-sided against FD from the pool allocation sized to the float that
  // survived the reset, and the price is what those dollars support (Jeff, 2026-10-29). With no dollars
  // at all, the treasury posts FD alone and the reference price stands as the floor until buyers lift it.
  const seedUsd = tc.launch.seedUsd + w.token.treasury.seedEscrowUsd;
  const floatFd = w.ledger.supply();
  // The opening auction (launch.auction), when bids came in: its clearing price is the launch price, and the pool
  // opens with the dollars it raised, as deep as they go at that price.
  const auction = clearAuction(w, seedUsd);
  const liquidityFd = auction ? auction.poolFd : seedUsd > 0 ? Math.max(1, tc.launch.poolDepthShareOfFloat * floatFd) : tc.launch.liquidityFd;
  // The pool allocation funds the FD side; what it lacks comes from the treasury allocation — protocol-owned
  // liquidity (Jeff, 2026-10-30). A pool as deep as the float pays sellers less per FD, so it keeps its dollars
  // and holds its price path better than a shallow one, whatever the nominal launch price reads.
  if (tc.circular.enabled) {
    const short = liquidityFd - w.ledger.balance("alloc:pool");
    if (short > 0.005) w.ledger.post(w.t, "alloc:treasury", "alloc:pool", short, "launch:liquidity");
  }
  w.ledger.post(w.t, "faucet:launch_liquidity", EXCHANGE_ACCOUNT, liquidityFd, "launch:liquidity");
  w.token.poolUsd = auction ? auction.poolUsd : seedUsd;
  w.token.launchPriceUsd = auction ? auction.priceUsd : seedUsd > 0 ? seedUsd / liquidityFd : tc.launch.priceUsd;
  w.token.floorUsd = auction || seedUsd > 0 ? 0 : tc.launch.priceUsd;
  w.token.treasury.seedUsd = w.token.poolUsd;
  w.token.treasury.seedEscrowUsd = 0;
  for (const c of w.companies) {
    c.taxBaseFd = operatingResult(w, c);
    c.seasonBase = { miles: lifetimeMiles(c), profit: operatingResult(w, c) };
  }
  w.token.profitTaxRate = tc.profitTaxRate;
  w.token.treasury.vestBaseFd = tc.circular.enabled ? w.ledger.balance(vestAccount(w)) : 0;
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
      if (lb.paidLocked) payLockedAirdrop(w, c, share, lb.atLaunch + d.honest + d.criminal);
      else unlockAirdrop(w, c, share * (lb.atLaunch + d.honest + d.criminal));
      const st = logbookStats(w);
      st.openFd += share * lb.atLaunch;
      st.honestFd += share * d.honest;
      st.criminalFd += share * d.criminal;
      return;
    }
    const carried = !lb.enabled && prev && prev.weeksLeft > 0 && !prev.claimedEarly ? Math.max(0, prev.totalFd - prev.unlockedFd - prev.forfeitedFd) : 0;
    // Slices still queued under the supply ceiling stay owed in the new vest.
    c.airdrop = { totalFd: share + carried, unlockedFd: 0, forfeitedFd: 0, queuedFd: prev?.queuedFd ?? 0, weeksLeft: lb.enabled ? 0 : tc.airdrop.unlockWeeks, claimedEarly: false, ...(lb.enabled ? { logbook: openLogbook(w, c, share) } : {}) };
    if (lb.enabled && lb.paidLocked) payLockedAirdrop(w, c, share, lb.atLaunch);
    else unlockAirdrop(w, c, share * (lb.enabled ? lb.atLaunch : tc.airdrop.atLaunch));
    if (lb.enabled) logbookStats(w).openFd += share * lb.atLaunch;
  });
  w.token.airdrop.seasonsPaid++;
  w.listener?.({ kind: "launched" });
}

/**
 * The developer's FD, vested (TOKENOMICS.md "FD only"): weekly after the cliff, at most
 * treasury.vest.perWeekShare of the treasury's holdings sold into the pool; with the price floor on
 * (vest.priceFloor; Jeff dropped it on 2026-11-01), never in a week the price averaged below the launch price.
 * The dollars it brings are the developer's revenue; the sale is the sell pressure the runs must carry. Only
 * under the cap, where the treasury allocation exists.
 */
/** The vest's source: the team's allocation when there is one (circular.shares.dev), else the treasury's. */
export function vestAccount(w: World): string {
  return (w.cfg.token.circular.shares.dev ?? 0) > 0 ? "alloc:dev" : "alloc:treasury";
}

/** A vest week in game days: a real week at the live clock (vest.realTime), else a game week. */
function vestWeekDays(w: World): number {
  const v = w.cfg.token.treasury.vest;
  return v.realTime ? Math.round((7 * 24) / w.cfg.time.realHoursPerGameDayLive) : 7;
}

export function weeklyVest(w: World): void {
  const v = w.cfg.token.treasury.vest;
  if (!w.cfg.token.circular.enabled || v.perWeekShare <= 0 || w.token.launchDay === null) return;
  const weekDays = vestWeekDays(w);
  if (dayOf(w.t, w.cfg) - w.token.launchDay < v.cliffWeeks * weekDays) return;
  // The supply ceiling holds the scheduled payouts this week (ceiling.ts): the treasury keeps its FD.
  if (w.token.ceiling.holding) {
    w.token.ceiling.vestHeldWeeks++;
    return;
  }
  const hist = w.token.priceHistory.slice(-7);
  const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
  const source = vestAccount(w);
  const held = w.ledger.balance(source);
  const pool = w.ledger.balance(EXCHANGE_ACCOUNT);
  const floor = w.token.launchPriceUsd;
  if (held <= 0 || w.token.poolUsd <= 0 || pool <= 0) return;
  // The week's share: of the allocation at launch (vest.linear: the vest ends), else of what's left; a game week's
  // part of a real week's share when the clock is real time.
  const base = v.linear ? (w.token.treasury.vestBaseFd ?? held) : held;
  const weekShare = v.perWeekShare * (7 / weekDays);
  // The price floor: not in a week the price averaged below launch, and only what the pool absorbs without its
  // price falling through the launch price: after a sale of `fd` the pool prices at poolUsd·pool/(pool+fd)², so
  // the sale stops where that meets it. Without the floor the vest is a clock: the week's share sells.
  if (v.priceFloor && (floor <= 0 || avg < floor)) return;
  const room = v.priceFloor && floor > 0 ? Math.sqrt((w.token.poolUsd * pool) / floor) - pool : Infinity;
  const fd = Math.min(held, base * weekShare, room);
  if (fd <= 0.01) return;
  const usd = w.token.poolUsd - (w.token.poolUsd * pool) / (pool + fd);
  if (usd <= 0.01) return;
  w.ledger.post(w.t, source, EXCHANGE_ACCOUNT, fd, "vest:treasury");
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
  // Paid locked (logbook.paidLocked): what's still locked and unspent burns; the rest of the share was spent in the game.
  const burned = burnLockedAirdrop(w, c, left);
  a.forfeitedFd += left;
  w.token.airdrop.forfeitedFd += a.lockedFd === undefined ? left : burned;
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
    // Paid locked (logbook.paidLocked): what's still locked and unspent at the deadline burns.
    const burned = burnLockedAirdrop(w, c, lostFd);
    a.forfeitedFd += lostFd;
    w.token.airdrop.forfeitedFd += a.lockedFd === undefined ? lostFd : burned;
    st.lostFd += a.lockedFd === undefined ? lostFd : burned;
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
    c.freePathLockedFd = Math.min(c.freePathLockedFd, lockedFd(w, c)); // spending uses the free path's locked FD too
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
  // Under the population dial NPC freight stays on its base path: the dial moves the carriers to the freight, so the
  // freight must not follow the carriers (it would hold the ratio still and grow the faucet with every sign-up).
  if (!w.cfg.token.demandScalesWithCarriers || w.token.baseCarriers === 0 || w.cfg.population.dial.enabled) return;
  const carriers = w.companies.filter((c) => c.role === "carrier" && c.liquidatingSince === null).length;
  w.demandScale = Math.max(1, carriers / w.token.baseCarriers);
}
