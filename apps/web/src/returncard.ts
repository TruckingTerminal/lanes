import { dayOf, type Company, type World } from "@lanes/engine";
import { stepScope } from "./walkthrough.js";

/**
 * The return card's memory (the director's R21, player5-ux.md section 2): what this browser saw of its company at the
 * last visit, so that after `RETURN_HOURS` real hours away the card can say what changed. A convenience kept per browser:
 * a private window simply shows no card. The card's "where" and "why" rows are read from the world as it is now.
 */

/** `guide.returnHours` (8), read here until the key joins the config's guide block. */
export const RETURN_HOURS = 8;
const KEY = "lanes.lastVisit";

interface Visit {
  realMs: number;
  scope: string;
  day: number;
  delivered: number;
  revenueFd: number;
  costFd: number;
  late: number;
  finesFd: number;
  monthClosedDay: number | null;
}

/** What changed while the player was away, for the card; null when it's not a return. */
export interface Away {
  live: boolean;
  delivered: number;
  inFd: number;
  outFd: number;
  late: number;
  tickets: number;
  /** The month that closed while away and what it kept. */
  month: { name: string; keptFd: number } | null;
}

const snapshot = (w: World, c: Company): Visit => ({
  realMs: Date.now(),
  scope: stepScope(w, c),
  day: dayOf(w.t, w.cfg),
  delivered: c.delivered,
  revenueFd: c.operating.revenueFd,
  // What went out: operating costs and the fines kept outside them (fraud.ts, safety.ts finesOffCostsFd), as the month record counts.
  costFd: c.operating.costFd + (c.finesOffCostsFd ?? 0),
  late: c.late,
  finesFd: c.safety.finesFd,
  monthClosedDay: c.lastMonth?.closedDay ?? null,
});

/** Keeps this visit (called on a timer and when the page hides). */
export function saveVisit(w: World, c: Company): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot(w, c)));
  } catch {
    /* a private window: no card next time */
  }
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** At the world's opening: what changed since the last visit, if it was RETURN_HOURS or more ago and the same company. */
export function returnFor(w: World, c: Company, live: boolean, nowMs = Date.now()): Away | null {
  let v: Visit | null = null;
  try {
    v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Visit | null;
  } catch {
    v = null;
  }
  if (!v || v.scope !== stepScope(w, c) || nowMs - v.realMs < RETURN_HOURS * 3_600_000) return null;
  const closed = c.lastMonth && c.lastMonth.closedDay !== v.monthClosedDay ? c.lastMonth : null;
  return {
    live,
    delivered: Math.max(0, c.delivered - v.delivered),
    inFd: Math.max(0, c.operating.revenueFd - v.revenueFd),
    outFd: Math.max(0, c.operating.costFd + (c.finesOffCostsFd ?? 0) - v.costFd),
    late: Math.max(0, c.late - v.late),
    tickets: c.safety.finesFd > v.finesFd + 0.5 ? 1 : 0,
    month: closed ? { name: MONTHS[Math.min(11, Math.floor(((closed.closedDay - 1) % 365) / 30))]!, keptFd: closed.revenueFd - closed.spentFd } : null,
  };
}
