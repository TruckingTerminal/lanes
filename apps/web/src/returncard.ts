import { companyAccount, dayOf, type Company, type World } from "@lanes/engine";
import { closedMonths, emptyMilesSoFar, moneyEvents, monthReport, shownReport } from "./books.js";
import { monthName } from "./format.js";
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
  /** Client batch 8b item 60: the game minute, cash, empty miles, open purchase loans and missed payments at the visit. */
  t?: number;
  cashFd?: number;
  emptyMi?: number;
  loanIds?: number[];
  missed?: number;
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
  /** Whose return it is: the world (seed), the company and its start day (walkthrough.ts stepScope). */
  scope: string;
  live: boolean;
  delivered: number;
  inFd: number;
  outFd: number;
  late: number;
  tickets: number;
  /** The month that closed while away and what it kept. */
  month: { name: string; keptFd: number } | null;
  /** Breakdowns paid while away (books.ts money events since the last visit's day). */
  breakdowns: number;
  /** When the player came back: the game minute, for the header and the timeline's row. */
  backT: number;
  /** Client batch 8b item 60 (the director's E): the interval in her order; absent on a card from an older visit record. */
  e?: {
    awayMin: number;
    claims: number;
    claimsFd: number;
    emptyMi: number;
    taken: number;
    missed: number;
    finesFd: number;
    keptFd: number;
    cashThen: number;
    cashNow: number;
  };
}

const openLoans = (w: World, c: Company) => w.purchaseLoans.filter((l) => l.borrowerId === c.id && (l.status === "active" || l.status === "defaulted"));
const snapshot = (w: World, c: Company): Visit => ({
  realMs: Date.now(),
  t: w.t,
  cashFd: w.ledger.balance(companyAccount(c.id)),
  emptyMi: emptyMilesSoFar(w, c),
  loanIds: openLoans(w, c).map((l) => l.id),
  missed: openLoans(w, c).reduce((s, l) => s + l.missed, 0),
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

/** Whether a return card is this company's in this world (QA item 8: a new test world showed the last world's card). */
export const awayIsHere = (a: Away | null, w: World, c: Company): a is Away => !!a && a.scope === stepScope(w, c);

/** Keeps this visit (called on a timer and when the page hides). */
export function saveVisit(w: World, c: Company): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot(w, c)));
  } catch {
    /* a private window: no card next time */
  }
}


/** The month report's kept for a closed month (books.ts), so the return card and Money say one figure (R10). */
const keptOf = (w: World, c: Company, closedDay: number): number | null => {
  const m = closedMonths(w, c).find((x) => x.closedDay === closedDay);
  return m ? shownReport(monthReport(m)).keptFd : null;
};

/** The interval since the visit, in the director's order (item 60). */
function awayInterval(w: World, c: Company, v: Visit): NonNullable<Away["e"]> {
  const since = (v.t ?? w.t) as number;
  const ev = moneyEvents(w, c, since, 0);
  const claims = ev.filter((e) => e.kind === "claim");
  const ids = new Set(v.loanIds ?? []);
  const taken = w.purchaseLoans.filter((l) => ids.has(l.id) && l.status !== "active" && l.status !== "defaulted" && l.truckId > 0 && w.trucks[l.truckId - 1]?.status === "retired").length;
  const missedNow = openLoans(w, c).reduce((s, l) => s + l.missed, 0);
  return {
    awayMin: w.t - since,
    claims: claims.length,
    claimsFd: claims.reduce((s, e) => s + Math.abs(e.fd), 0),
    emptyMi: Math.max(0, emptyMilesSoFar(w, c) - (v.emptyMi ?? 0)),
    taken,
    missed: Math.max(0, missedNow - (v.missed ?? 0)),
    finesFd: Math.max(0, c.safety.finesFd - v.finesFd),
    keptFd: c.operating.revenueFd - v.revenueFd - (c.operating.costFd + (c.finesOffCostsFd ?? 0) - v.costFd),
    cashThen: v.cashFd ?? 0,
    cashNow: w.ledger.balance(companyAccount(c.id)),
  };
}

/** At the world's opening: what changed since the last visit, if it was RETURN_HOURS or more ago and the same company. */
export function returnFor(w: World, c: Company, live: boolean, nowMs = Date.now()): Away | null {
  let v: Visit | null = null;
  try {
    v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Visit | null;
  } catch {
    v = null;
  }
  if (!v || v.scope !== stepScope(w, c)) return null;
  // Client batch 8b item 60 (the director's E): every return after a game day or more away; an older record without its
  // minute keeps the real-hours rule.
  if (v.t !== undefined ? w.t - v.t < w.cfg.time.gameMinutesPerDay : nowMs - v.realMs < RETURN_HOURS * 3_600_000) return null;
  const closed = c.lastMonth && c.lastMonth.closedDay !== v.monthClosedDay ? c.lastMonth : null;
  return {
    scope: v.scope,
    live,
    delivered: Math.max(0, c.delivered - v.delivered),
    inFd: Math.max(0, c.operating.revenueFd - v.revenueFd),
    outFd: Math.max(0, c.operating.costFd + (c.finesOffCostsFd ?? 0) - v.costFd),
    late: Math.max(0, c.late - v.late),
    tickets: c.safety.finesFd > v.finesFd + 0.5 ? 1 : 0,
    breakdowns: moneyEvents(w, c, v.day * w.cfg.time.gameMinutesPerDay, 0).filter((e) => e.kind === "breakdown").length,
    backT: w.t,
    month: closed ? { name: monthName(Math.floor((closed.closedDay - 30 + closed.closedDay - 1) / 2)), keptFd: keptOf(w, c, closed.closedDay) ?? closed.revenueFd - closed.spentFd } : null,
    e: v.t === undefined ? undefined : awayInterval(w, c, v),
  };
}
