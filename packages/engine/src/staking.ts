/**
 * Staking (0.18.0, TOKENOMICS.md "The circular economy" §2): FD a company locks as the bond behind
 * its licence. It is out of circulation and out of the pool, it gates company size and roles (never
 * performance), and it is at risk: a revoked authority slashes it, victims' judgments first.
 * Leaving takes the exit queue (a wait, and a global limit per day so a run drains in weeks), or an
 * instant exit at a haircut that is burned.
 */
import { applyAction } from "./actions.js";
import { opsCap } from "./labor.js";
import { dayOf } from "./clock.js";
import { companyAccount } from "./ledger.js";
import { yardTrucks } from "./items.js";
import { bondHeld, brokerApFd, callBond } from "./receivables.js";
import type { Company, StakeLock } from "./types.js";
import type { World } from "./world.js";

export const stakeAccount = (companyId: number) => `co:stake:${companyId}`;
export const exitAccount = (companyId: number) => `co:exit:${companyId}`;

const exiting = (c: Company) => c.unstaking.reduce((s, e) => s + e.fd, 0);

/** Staking locks (token.staking.lockDiscounts): the tiers stop gating size and a stake earns its discount by its term. */
export const locksOn = (w: World) => w.cfg.token.staking.enabled && w.cfg.token.staking.lockDiscounts.enabled;

/** A company's locks still running today. */
export function activeLocks(w: World, c: Company): StakeLock[] {
  const today = dayOf(w.t, w.cfg);
  return (c.locks ?? []).filter((l) => l.endDay > today);
}

/** FD under a running lock: what an unstake can't take without breaking it. */
export const lockedStakeFd = (w: World, c: Company) => activeLocks(w, c).reduce((s, l) => s + l.fd, 0);

/** The lock whose discount applies now: the best rate among the running locks with budget left, the soonest to end first. */
function discountLock(w: World, c: Company): StakeLock | null {
  let best: StakeLock | null = null;
  for (const l of activeLocks(w, c)) {
    if (l.usedFd >= l.budgetFd - 0.005) continue;
    if (!best || l.rate > best.rate || (l.rate === best.rate && l.endDay < best.endDay)) best = l;
  }
  return best;
}

/** Locks: the discount a charge of `grossFd` would get, the lock's rate on it but never more than its budget has left. */
export function peekDiscount(w: World, c: Company, grossFd: number): number {
  if (!locksOn(w) || !(grossFd > 0)) return 0;
  const l = discountLock(w, c);
  return l ? Math.min(grossFd * l.rate, l.budgetFd - l.usedFd) : 0;
}

/** Locks: a discount given counts against the lock that gave it (its budget is what the lock can ever give). */
export function noteDiscount(w: World, c: Company, savedFd: number): void {
  if (!locksOn(w) || !(savedFd > 0)) return;
  const l = discountLock(w, c);
  if (!l) return;
  const given = Math.min(savedFd, l.budgetFd - l.usedFd);
  l.usedFd += given;
  lockStats(w).discountsFd += given;
}

/**
 * A running cost after the staking discount, given and noted at once: under locks the lock's capped discount, else the
 * tier discount, computed as it always was (`tiered`, so the switch off changes nothing to the cent).
 */
export function lockCost(w: World, c: Company, grossFd: number, tiered: () => number): number {
  if (!locksOn(w)) return tiered();
  const saved = peekDiscount(w, c, grossFd);
  noteDiscount(w, c, saved);
  return grossFd - saved;
}

/** What breaking this lock today would burn: the multiple of the discounts it gave plus the base share of it, at most all of it. */
export function lockSlash(w: World, l: StakeLock): number {
  const k = w.cfg.token.staking.lockDiscounts.slash;
  return Math.min(l.fd, k.discountMultiple * l.usedFd + k.baseShare * l.fd);
}

/** The batches' tally of locks (report.ts). */
export function lockStats(w: World) {
  return (w.lockStats ??= { made: {} as Record<string, { locks: number; fd: number }>, rolled: 0, matured: 0, broken: 0, discountsFd: 0, slashedFd: 0, brokenDiscountsFd: 0 });
}

/** Trucks the company may run at its stake (the config cap without staking), and within what its yard holds (items.ts). */
export function truckCap(w: World, c: Company): number {
  const k = w.cfg.token.staking;
  const yard = w.cfg.token.catalogue.enabled ? yardTrucks(w, c) : w.cfg.company.maxTrucks;
  if (!k.enabled || locksOn(w)) return Math.min(w.cfg.company.maxTrucks, yard); // locks on: truck prices are the entry fee
  let cap = 0;
  for (const [trucks, stake] of k.truckTiers) if (c.stakedFd + 1e-9 >= stake) cap = Math.max(cap, trucks);
  return Math.min(cap, w.cfg.company.maxTrucks, yard);
}

/** The discount locked FD earns on fuel, maintenance, rebuilds, insurance and board fees: the highest tier reached. */
export function stakeDiscount(w: World, c: Company): number {
  const k = w.cfg.token.staking;
  if (!k.enabled) return 0;
  if (locksOn(w)) return discountLock(w, c)?.rate ?? 0;
  let d = 0;
  for (const [stake, pct] of k.discounts) if (c.stakedFd + 1e-9 >= stake) d = Math.max(d, pct);
  return d;
}

export function facilityCap(w: World, c: Company): number {
  const k = w.cfg.token.staking;
  if (!k.enabled || locksOn(w)) return w.cfg.facilities.maxPerCompany;
  let cap = 0;
  for (const [n, stake] of k.facilityTiers) if (c.stakedFd + 1e-9 >= stake) cap = Math.max(cap, n);
  return Math.min(cap, w.cfg.facilities.maxPerCompany);
}

/** The next truck tier above the company's, or null at the top. */
export function nextTruckTier(w: World, c: Company): { trucks: number; stake: number } | null {
  const k = w.cfg.token.staking;
  if (!k.enabled || locksOn(w)) return null;
  const cap = truckCap(w, c);
  for (const [trucks, stake] of k.truckTiers) if (trucks > cap) return { trucks, stake };
  return null;
}

/** A broker needs its licence stake to take loads; without staking the bond premium alone licenses it. */
export function brokerLicensed(w: World, c: Company): boolean {
  const k = w.cfg.token.staking;
  return !k.enabled || c.role !== "broker" || c.stakedFd + 1e-9 >= k.roles.broker;
}

export function stakeFd(w: World, c: Company, fd: number, months?: number, roll = false): string | null {
  if (!w.cfg.token.staking.enabled) return "staking isn't on";
  if (!(fd > 0)) return "bad amount";
  if (c.liquidatingSince !== null) return "in liquidation";
  const acct = companyAccount(c.id);
  const term = months !== undefined ? w.cfg.token.staking.lockDiscounts.terms.find((t) => t[0] === months) : undefined;
  if (months !== undefined) {
    if (!locksOn(w)) return "stakes aren't locked for a term";
    if (!term) return `a lock runs ${w.cfg.token.staking.lockDiscounts.terms.map((t) => t[0]).join(", ")} game months`;
    if (fd < w.cfg.token.staking.lockDiscounts.minLockFd) return `a lock is at least ${w.cfg.token.staking.lockDiscounts.minLockFd} FD`;
  }
  if (w.ledger.balance(acct) < fd - 0.01) return "insufficient FD";
  fd = Math.round(Math.min(fd, w.ledger.balance(acct)) * 100) / 100; // in cents, as the ledger holds it, so the stake and its account agree
  w.ledger.post(w.t, acct, stakeAccount(c.id), fd, `stake:${c.id}`);
  c.stakedFd += fd;
  if (term) openLock(w, c, fd, term, roll);
  return null;
}

/** A lock opens (or rolls) for its term at the term's discount, with a fresh budget. */
function openLock(w: World, c: Company, fd: number, term: readonly [number, number, number], roll: boolean): void {
  const today = dayOf(w.t, w.cfg);
  const s = lockStats(w);
  (c.locks ??= []).push({ id: (c.locks.at(-1)?.id ?? 0) + 1, fd, months: term[0], startDay: today, endDay: today + term[0] * w.cfg.time.daysPerMonth, rate: term[1], budgetFd: fd * term[2], usedFd: 0, roll });
  const m = (s.made[String(term[0])] ??= { locks: 0, fd: 0 });
  m.locks++;
  m.fd += fd;
}

/** Breaks a running lock: its slash is burned (a forfeit) and the rest is ordinary stake, free to leave. Returns the slash. */
export function breakLock(w: World, c: Company, l: StakeLock): number {
  const slash = Math.round(lockSlash(w, l) * 100) / 100;
  if (slash > 0.005) w.ledger.post(w.t, stakeAccount(c.id), "sink:lock_slash", slash, `lock:${c.id}:${l.id}`);
  c.stakedFd -= slash;
  c.locks = (c.locks ?? []).filter((x) => x !== l);
  const s = lockStats(w);
  s.broken++;
  s.slashedFd += slash;
  s.brokenDiscountsFd += l.usedFd;
  return slash;
}

/** Daily, under locks: a lock at its term rolls for another at the term's discount, or matures into free stake. */
function matureLocks(w: World, c: Company): void {
  if (!c.locks?.length) return;
  const today = dayOf(w.t, w.cfg);
  for (const l of [...c.locks]) {
    if (l.endDay > today) continue;
    c.locks = c.locks.filter((x) => x !== l);
    const term = w.cfg.token.staking.lockDiscounts.terms.find((t) => t[0] === l.months);
    if (l.roll && term && c.liquidatingSince === null) {
      openLock(w, c, l.fd, term, true);
      lockStats(w).rolled++;
    } else lockStats(w).matured++;
  }
}

/** Into the exit queue, or out at once for the haircut (burned). */
export function unstakeFd(w: World, c: Company, fd: number, instant: boolean, breakLocks = false): string | null {
  const k = w.cfg.token.staking;
  if (!k.enabled) return "staking isn't on";
  if (!(fd > 0) || fd > c.stakedFd + 0.01) return "not that much staked";
  // The AP cap (token.payment.factoring.contract): a broker's bond can't fall below what it owes carriers.
  if (bondHeld(w, c) && c.stakedFd - Math.min(fd, c.stakedFd) < brokerApFd(w, c.id) - 0.005) return "your bond backs what you owe carriers: pay it down first";
  // Locks: FD under a running lock leaves only by breaking it (the slash burned), the soonest to end first.
  if (locksOn(w)) {
    const free = c.stakedFd - lockedStakeFd(w, c);
    if (fd > free + 0.01) {
      const running = activeLocks(w, c).sort((a, b) => a.endDay - b.endDay || a.id - b.id);
      if (!breakLocks) return `that FD is locked until day ${running[0]?.endDay}: leaving early burns ${Math.round(running.reduce((s, l) => s + lockSlash(w, l), 0))} FD`;
      // Break locks, soonest to end first, until the FD asked for is free (each slash shrinks what a lock frees).
      for (const l of running) {
        if (c.stakedFd - lockedStakeFd(w, c) >= fd - 0.01) break;
        breakLock(w, c, l);
      }
    }
    fd = Math.min(fd, Math.max(0, c.stakedFd - lockedStakeFd(w, c)));
    if (!(fd > 0.005)) return "nothing left to unstake";
  }
  fd = Math.round(Math.min(fd, c.stakedFd, Math.max(0, w.ledger.balance(stakeAccount(c.id)))) * 100) / 100; // in cents, within the account
  if (!(fd > 0)) return "nothing left to unstake";
  c.stakedFd -= fd;
  const ref = `unstake:${c.id}`;
  if (instant) {
    // In cents, the haircut and the rest summing to the amount unstaked exactly.
    const fdCents = Math.round(fd * 100);
    const cutCents = Math.round(fdCents * k.instantHaircut);
    w.ledger.post(w.t, stakeAccount(c.id), "sink:unstake_haircut", cutCents / 100, ref);
    w.ledger.post(w.t, stakeAccount(c.id), companyAccount(c.id), (fdCents - cutCents) / 100, ref);
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
  c.locks = []; // a liquidation takes the stake for the creditors, locks and all
}

/**
 * A revoked authority forfeits the stake: what the company owes in judgments goes to its cash, where
 * the daily collection takes it for the victims; the rest is seized.
 */
export function slashStake(w: World, c: Company): number {
  callBond(w, c); // under the factoring contract a broker's bond pays its paper before the slash (the NPC factor's first)
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
  c.locks = [];
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
    // In cents, and never more than the escrow holds: partial clears of float amounts drifted a few cents past it
    // and overdrew co:exit:<id> (the red team's fuzz, 2026-11-03, live seeds 4 and 5).
    const held = Math.round(w.ledger.balance(exitAccount(c.id)) * 100);
    const cents = Math.min(Math.round(e.fd * 100), Math.floor(room * 100), held);
    if (cents <= 0) {
      if (held <= 0) e.fd = 0; // the escrow is empty: what the entry still says it holds was rounding
      continue;
    }
    const fd = cents / 100;
    w.ledger.post(w.t, exitAccount(c.id), companyAccount(c.id), fd, `unstake:${c.id}`);
    e.fd = Math.max(0, e.fd - fd);
    room -= fd;
  }
  for (const c of w.companies) {
    if (c.unstaking.length) c.unstaking = c.unstaking.filter((e) => e.fd > 0.005);
    if (locksOn(w)) matureLocks(w, c);
    if (c.liquidatingSince !== null) continue;
    const fleet = w.trucksByCompany.get(c.id) ?? [];
    const running = fleet.filter((t) => t.status !== "parked" && t.status !== "retired" && t.status !== "listed").length;
    // The cap is the stake tier's, and the operations managers' (labor.ts opsCap): past four trucks a
    // fleet needs one for every twenty-five beyond, or the extra trucks park after the grace period.
    const ops = opsCap(w, c);
    const over = running - Math.min(truckCap(w, c), ops);
    if (over <= 0 && brokerLicensed(w, c)) {
      c.tierGraceDay = null;
      continue;
    }
    if (c.tierGraceDay === null) {
      c.tierGraceDay = today + k.graceDays;
      const m = w.cfg.labor.managers.ops;
      const text =
        over > 0 && running > ops
          ? `Past ${m.requiredAbove} trucks you need an operations manager, one for every ${m.span}: hire within ${k.graceDays} days or the extra trucks park.`
          : over > 0
            ? `Your stake covers ${truckCap(w, c)} trucks and you run ${running}: stake more within ${k.graceDays} days or the extra trucks park.`
            : `Your broker licence needs a ${k.roles.broker} FD stake: stake it within ${k.graceDays} days or you take no loads.`;
      w.listener?.({ kind: "notice", companyId: c.id, topic: "authority", text, tone: "bad" });
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
