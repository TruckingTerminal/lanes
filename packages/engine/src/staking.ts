/**
 * Staking (0.18.0, TOKENOMICS.md "The circular economy" §2): FD a company locks as the bond behind
 * its licence. It is out of circulation and out of the pool, it gates company size and roles (never
 * performance), and it is at risk: a revoked authority slashes it, victims' judgments first.
 * Leaving takes the exit queue (a wait, and a global limit per day so a run drains in weeks), or an
 * instant exit at a haircut that is burned.
 */
import { applyAction } from "./actions.js";
import { dayOf } from "./clock.js";
import { companyAccount } from "./ledger.js";
import { yardTrucks } from "./items.js";
import type { Company } from "./types.js";
import type { World } from "./world.js";

export const stakeAccount = (companyId: number) => `co:stake:${companyId}`;
export const exitAccount = (companyId: number) => `co:exit:${companyId}`;

const exiting = (c: Company) => c.unstaking.reduce((s, e) => s + e.fd, 0);

/** Trucks the company may run at its stake (the config cap without staking), and within what its yard holds (items.ts). */
export function truckCap(w: World, c: Company): number {
  const k = w.cfg.token.staking;
  const yard = w.cfg.token.catalogue.enabled ? yardTrucks(w, c) : w.cfg.company.maxTrucks;
  if (!k.enabled) return Math.min(w.cfg.company.maxTrucks, yard);
  let cap = 0;
  for (const [trucks, stake] of k.truckTiers) if (c.stakedFd + 1e-9 >= stake) cap = Math.max(cap, trucks);
  return Math.min(cap, w.cfg.company.maxTrucks, yard);
}

/** The discount locked FD earns on fuel, maintenance, rebuilds, insurance and board fees: the highest tier reached. */
export function stakeDiscount(w: World, c: Company): number {
  const k = w.cfg.token.staking;
  if (!k.enabled) return 0;
  let d = 0;
  for (const [stake, pct] of k.discounts) if (c.stakedFd + 1e-9 >= stake) d = Math.max(d, pct);
  return d;
}

export function facilityCap(w: World, c: Company): number {
  const k = w.cfg.token.staking;
  if (!k.enabled) return w.cfg.facilities.maxPerCompany;
  let cap = 0;
  for (const [n, stake] of k.facilityTiers) if (c.stakedFd + 1e-9 >= stake) cap = Math.max(cap, n);
  return Math.min(cap, w.cfg.facilities.maxPerCompany);
}

/** The next truck tier above the company's, or null at the top. */
export function nextTruckTier(w: World, c: Company): { trucks: number; stake: number } | null {
  const k = w.cfg.token.staking;
  if (!k.enabled) return null;
  const cap = truckCap(w, c);
  for (const [trucks, stake] of k.truckTiers) if (trucks > cap) return { trucks, stake };
  return null;
}

/** A broker needs its licence stake to take loads; without staking the bond premium alone licenses it. */
export function brokerLicensed(w: World, c: Company): boolean {
  const k = w.cfg.token.staking;
  return !k.enabled || c.role !== "broker" || c.stakedFd + 1e-9 >= k.roles.broker;
}

export function stakeFd(w: World, c: Company, fd: number): string | null {
  if (!w.cfg.token.staking.enabled) return "staking isn't on";
  if (!(fd > 0)) return "bad amount";
  if (c.liquidatingSince !== null) return "in liquidation";
  const acct = companyAccount(c.id);
  if (w.ledger.balance(acct) < fd - 0.01) return "insufficient FD";
  fd = Math.min(fd, w.ledger.balance(acct));
  w.ledger.post(w.t, acct, stakeAccount(c.id), fd, `stake:${c.id}`);
  c.stakedFd += fd;
  return null;
}

/** Into the exit queue, or out at once for the haircut (burned). */
export function unstakeFd(w: World, c: Company, fd: number, instant: boolean): string | null {
  const k = w.cfg.token.staking;
  if (!k.enabled) return "staking isn't on";
  if (!(fd > 0) || fd > c.stakedFd + 0.01) return "not that much staked";
  fd = Math.min(fd, c.stakedFd);
  c.stakedFd -= fd;
  const ref = `unstake:${c.id}`;
  if (instant) {
    const cut = fd * k.instantHaircut;
    w.ledger.post(w.t, stakeAccount(c.id), "sink:unstake_haircut", cut, ref);
    w.ledger.post(w.t, stakeAccount(c.id), companyAccount(c.id), fd - cut, ref);
  } else {
    w.ledger.post(w.t, stakeAccount(c.id), exitAccount(c.id), fd, ref);
    c.unstaking.push({ fd, day: dayOf(w.t, w.cfg) + k.exitDays });
  }
  return null;
}

/** Liquidation: the stake comes back to cash first, so creditors are paid from it. */
export function releaseStake(w: World, c: Company): void {
  for (const acct of [stakeAccount(c.id), exitAccount(c.id)]) {
    const bal = w.ledger.balance(acct);
    if (bal > 0) w.ledger.post(w.t, acct, companyAccount(c.id), bal, `unstake:${c.id}`);
  }
  c.stakedFd = 0;
  c.unstaking = [];
}

/**
 * A revoked authority forfeits the stake: what the company owes in judgments goes to its cash, where
 * the daily collection takes it for the victims; the rest is seized.
 */
export function slashStake(w: World, c: Company): number {
  let toVictims = Math.max(0, c.judgmentFd);
  let slashed = 0;
  for (const acct of [stakeAccount(c.id), exitAccount(c.id)]) {
    const bal = w.ledger.balance(acct);
    if (bal <= 0) continue;
    const back = Math.min(bal, toVictims);
    if (back > 0) w.ledger.post(w.t, acct, companyAccount(c.id), back, `slash:${c.id}`);
    if (bal - back > 0) w.ledger.post(w.t, acct, "sink:seized", bal - back, `slash:${c.id}`);
    toVictims -= back;
    slashed += bal;
  }
  c.stakedFd = 0;
  c.unstaking = [];
  return slashed;
}

/** Daily: the exit queue clears oldest first within the global limit; companies over their tier park trucks after a grace period. */
export function dailyStaking(w: World): void {
  const k = w.cfg.token.staking;
  if (!k.enabled) return;
  const today = dayOf(w.t, w.cfg);
  let total = 0;
  const due: { c: Company; e: { fd: number; day: number } }[] = [];
  for (const c of w.companies) {
    total += c.stakedFd + exiting(c);
    for (const e of c.unstaking) if (e.day <= today) due.push({ c, e });
  }
  due.sort((a, b) => a.e.day - b.e.day || a.c.id - b.c.id);
  let room = total * k.exitLimitPerDay;
  for (const { c, e } of due) {
    if (room <= 0.01) break;
    const fd = Math.min(e.fd, room);
    w.ledger.post(w.t, exitAccount(c.id), companyAccount(c.id), fd, `unstake:${c.id}`);
    e.fd -= fd;
    room -= fd;
  }
  for (const c of w.companies) {
    if (c.unstaking.length) c.unstaking = c.unstaking.filter((e) => e.fd > 0.005);
    if (c.liquidatingSince !== null) continue;
    const fleet = w.trucksByCompany.get(c.id) ?? [];
    const running = fleet.filter((t) => t.status !== "parked" && t.status !== "retired" && t.status !== "listed").length;
    const over = running - truckCap(w, c);
    if (over <= 0 && brokerLicensed(w, c)) {
      c.tierGraceDay = null;
      continue;
    }
    if (c.tierGraceDay === null) {
      c.tierGraceDay = today + k.graceDays;
      w.listener?.({ kind: "notice", companyId: c.id, topic: "authority", text: over > 0 ? `Your stake covers ${truckCap(w, c)} trucks and you run ${running}: stake more within ${k.graceDays} days or the extra trucks park.` : `Your broker licence needs a ${k.roles.broker} FD stake: stake it within ${k.graceDays} days or you take no loads.`, tone: "bad" });
      continue;
    }
    if (today < c.tierGraceDay) continue;
    let n = over;
    for (const t of fleet) {
      if (n <= 0) break;
      if (t.status === "idle" && t.lease === "owned" && applyAction(w, c.id, { type: "park_truck", truckId: t.id }).ok) n--;
    }
  }
}
