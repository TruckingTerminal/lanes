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

/** FD a dollar amount buys right now, after the buy fee (constant product). */
export function quoteBuyFd(w: World, usd: number): number {
  const net = usd * (1 - w.cfg.token.exchange.buyFeePct);
  const fd = w.ledger.balance(EXCHANGE_ACCOUNT);
  return fd - (w.token.poolUsd * fd) / (w.token.poolUsd + net);
}

/** Dollars that buy `fd` FD right now, fee included. */
export function quoteUsdForFd(w: World, fd: number): number {
  const pool = w.ledger.balance(EXCHANGE_ACCOUNT);
  if (fd >= pool) return Infinity;
  const net = (w.token.poolUsd * pool) / (pool - fd) - w.token.poolUsd;
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
  const fee = fd * w.cfg.token.exchange.sellFeePct;
  const net = fd - fee;
  const pool = w.ledger.balance(EXCHANGE_ACCOUNT);
  const usd = w.token.poolUsd - (w.token.poolUsd * pool) / (pool + net);
  w.ledger.post(w.t, acct, "sink:exchange_fee", fee, `swap:fee:${c.id}`);
  w.ledger.post(w.t, acct, EXCHANGE_ACCOUNT, net, `swap:sell:${c.id}`);
  w.token.poolUsd -= usd;
  c.usd.out += usd;
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

  const miles = w.companies.map(lifetimeMiles);
  const totalMiles = miles.reduce((a, b) => a + b, 0);
  const cap = tc.airdrop.fd * tc.airdrop.capShare;
  let allocatedFd = 0;
  w.companies.forEach((c, i) => {
    const share = totalMiles > 0 ? Math.min(cap, (tc.airdrop.fd * miles[i]!) / totalMiles) : 0;
    if (share <= 0) return;
    c.airdrop = { totalFd: share, unlockedFd: 0, forfeitedFd: 0, weeksLeft: tc.airdrop.unlockWeeks, claimedEarly: false };
    allocatedFd += share;
    mintAirdrop(w, c, share * tc.airdrop.atLaunch);
  });

  const liquidityFd = tc.launch.seedUsd / tc.launch.priceUsd;
  w.ledger.post(w.t, "faucet:launch_liquidity", EXCHANGE_ACCOUNT, liquidityFd, "launch:liquidity");
  w.token.poolUsd = tc.launch.seedUsd;
  w.token.treasury.seedUsd = tc.launch.seedUsd;
  for (const c of w.companies) c.taxBaseFd = operatingResult(w, c);
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
    if (tax > 0.01) w.ledger.post(w.t, companyAccount(c.id), "sink:profit_tax", tax, `tax:${c.id}`);
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
