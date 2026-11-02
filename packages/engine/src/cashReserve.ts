/**
 * The Reserve (config `cashReserve`; Jeff, 2026-11-02; studio/reviews/economy-reserve.md). Off by default.
 *
 * An account beside cash. FD in it is sheltered from the season close's burn and the weekly holding cost up to a cap of
 * `capWeeks` of the company's own spending (the weeks the working-capital rule reads, `weeklySpend`, averaged); above
 * the cap both apply as they do to cash. It pays no yield. A deposit is instant; a withdrawal is free and lands in cash
 * `settleDays` later. The shelter reads the week's lowest balance, so cash can't dip in for the weekly check. It counts
 * toward the credit score as capital (credit.ts), and it can't be pledged, staked or posted as a bond: those draw on
 * cash only. At the launch reset and in a liquidation it joins cash, so it shelters nothing the rules reset.
 */
import { dayOf } from "./clock.js";
import { companyAccount } from "./ledger.js";
import type { Company } from "./types.js";
import type { World } from "./world.js";

export const reserveAccount = (companyId: number) => `co:cashreserve:${companyId}`;
/** A withdrawal on its way to cash (settling). */
export const reserveOutAccount = (companyId: number) => `co:cashreserve-out:${companyId}`;

export const reserveOn = (w: World): boolean => w.cfg.cashReserve.enabled;

/** What the Reserve did in this world (reports). */
export const reserveStats = (w: World) => (w.reserveStats ??= { holdingFd: 0, burnedFd: 0, depositFd: 0, withdrawFd: 0 });

export const reserveFd = (w: World, companyId: number): number => w.ledger.balance(reserveAccount(companyId));

/** What the company has in the Reserve and settling out of it (for wealth, credit, the reports). */
export const reserveHeldFd = (w: World, companyId: number): number => w.ledger.balance(reserveAccount(companyId)) + w.ledger.balance(reserveOutAccount(companyId));

/** The cap: `capWeeks` of the company's own weekly spending, from the weeks the working-capital rule keeps. */
export function reserveCapFd(w: World, c: Company): number {
  if (c.weeklySpend.length === 0) return 0;
  return (w.cfg.cashReserve.capWeeks * c.weeklySpend.reduce((a, b) => a + b, 0)) / c.weeklySpend.length;
}

/** What is sheltered now: the week's lowest balance, up to the cap. */
export function shelteredFd(w: World, c: Company): number {
  const low = Math.min(c.reserveLowFd ?? Infinity, reserveFd(w, c.id));
  return Math.max(0, Math.min(low, reserveCapFd(w, c)));
}

/** Moves FD from cash into the Reserve, at once. */
export function depositReserve(w: World, c: Company, fd: number): string | null {
  if (!reserveOn(w)) return "there's no Reserve";
  if (c.liquidatingSince !== null) return "the company is being wound up";
  if (!(fd > 0.005)) return "bad amount";
  if (w.ledger.balance(companyAccount(c.id)) < fd - 0.005) return "insufficient FD";
  w.ledger.post(w.t, companyAccount(c.id), reserveAccount(c.id), fd, `reserve:${c.id}`);
  reserveStats(w).depositFd += fd;
  c.reserveLowFd ??= 0; // a first deposit this week counts from the week's next check, not this one
  return null;
}

/** Starts a withdrawal: the FD leaves the Reserve now (the week's low falls with it) and lands in cash after the settle. */
export function withdrawReserve(w: World, c: Company, fd: number): string | null {
  if (!reserveOn(w)) return "there's no Reserve";
  if (!(fd > 0.005)) return "bad amount";
  const bal = reserveFd(w, c.id);
  if (bal < fd - 0.005) return "the Reserve hasn't that much";
  fd = Math.min(fd, bal);
  w.ledger.post(w.t, reserveAccount(c.id), reserveOutAccount(c.id), fd, `reserve:${c.id}`);
  (c.reserveOut ??= []).push({ fd, day: dayOf(w.t, w.cfg) + w.cfg.cashReserve.settleDays });
  reserveStats(w).withdrawFd += fd;
  c.reserveLowFd = Math.min(c.reserveLowFd ?? Infinity, reserveFd(w, c.id));
  return null;
}

/** Daily: withdrawals whose settle day has come land in cash. */
export function dailyReserve(w: World): void {
  if (!reserveOn(w)) return;
  const today = dayOf(w.t, w.cfg);
  for (const c of w.companies) {
    if (!c.reserveOut?.length) continue;
    let due = 0;
    c.reserveOut = c.reserveOut.filter((x) => {
      if (x.day > today) return true;
      due += x.fd;
      return false;
    });
    const out = Math.min(due, w.ledger.balance(reserveOutAccount(c.id)));
    if (out > 0.005) w.ledger.post(w.t, reserveOutAccount(c.id), companyAccount(c.id), out, `reserve:${c.id}`);
  }
}

/** Weekly, after the holding cost: the week's low starts again from the balance now. */
export function weeklyReserve(w: World): void {
  if (!reserveOn(w)) return;
  for (const c of w.companies) if (c.reserveLowFd !== undefined || reserveFd(w, c.id) > 0) c.reserveLowFd = reserveFd(w, c.id);
}

/** Everything in the Reserve and settling out of it goes back to cash (the launch reset, a liquidation). */
export function emptyReserve(w: World, c: Company, ref: string): void {
  for (const acct of [reserveAccount(c.id), reserveOutAccount(c.id)]) {
    const bal = w.ledger.balance(acct);
    if (bal > 0.005) w.ledger.post(w.t, acct, companyAccount(c.id), bal, ref);
  }
  c.reserveOut = [];
  c.reserveLowFd = 0;
}
