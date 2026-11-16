import { MENUS } from "./copy-menus.js";
import { dockHoursAt, fullOpenDay, loadsOnReadyDay, AHEAD_STATUSES, canMake, clearsWhen, companyAccount, crewed, hubMiles, dayOf, freeOf, lostShare, memoryLift, npcKey, pickupReachT, releaseStopOf, resting, urgent, waitingAtDock, weekdayName, whenLabel, windowsOn, type Company, type Free, type Load, type Reach, type Truck, type World } from "@lanes/engine";
import { COMMODITIES } from "@lanes/data";
import { WINDOWS } from "./copy-windows.js";
import { FIXES } from "./copy-fixes.js";
import { fdFull, hhmm, shortDate, weekday } from "./format.js";
import { deliveryEtaMin, etaMin } from "./rolling.js";
import { claimCosts, releaseStanding } from "./standingui.js";

/**
 * Delivery windows on the page (client batch W; the director's design, director-windows-screens-2026-11-13.md): every
 * deadline as a clock time before the player commits, every claim in FD. The figures only, from the engine (windows.ts:
 * canMake, freeOf, the claim shares); the screens word them with copy-windows.ts. Everything here is null or empty with
 * windows.enabled off, so today's screens are unchanged.
 */

const place = (w: World, i: number): string => w.net.places[i]!.name;
/** Hours and minutes as the sheet says a margin: "16 h", "3 h 20 min", "40 min". */
export function spanLabel(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h === 0 ? `${r} min` : r === 0 || h >= 10 ? `${h} h` : `${h} h ${r} min`;
}
/**
 * Client batch X (QA's 0.25.0 replay, fail 1): a weekday alone is ambiguous once windows run a week out ("Ready Tue 07:00"
 * was last Tuesday on one card and next Tuesday two rows down). A time 6 or more calendar days from today carries its date
 * ("Fri Jan 19 15:38"), and the load sheet dates every time (`dated`). Nearer, the weekday names one day only.
 */
export function whenAt(w: World, t: number, dated = false): string {
  const day = dayOf(t, w.cfg);
  if (!dated && Math.abs(day - dayOf(w.t, w.cfg)) < 6) return whenLabel(w, t);
  const [wd, hm] = whenLabel(w, t).split(" ");
  return `${wd} ${shortDate(day)} ${hm}`;
}
/** A ready time: one already past reads as past ("since Tue 07:00"), never as a bare weekday that could be next week's. */
export const readyAt = (w: World, ready: number, dated = false): string => (ready < w.t ? WINDOWS.readySince(whenAt(w, ready, dated)) : whenAt(w, ready, dated));

const roundMinutes = (w: World): number => w.cfg.time.gameMinutesPerDay / w.cfg.time.boardRoundHours.length;

/** The load card's line (§1): ready, pick up by, deliver by; the same-day mark and premium; the last rounds' line. */
export interface WindowLine {
  ready: string;
  /** Ready today: the card's small "Today" mark. */
  today: boolean;
  pickupBy: string;
  deliverBy: string;
  /** In its last rounds (windows.urgencyRounds): when the pickup closes. */
  closing: string | null;
  /** The same-day premium as the pay says it ("10%"), or null. */
  sameDay: string | null;
}
export function windowLine(w: World, l: Load, dated = false): WindowLine | null {
  if (!windowsOn(w) || l.latestPickupT === undefined || l.latestDeliveryT === undefined) return null;
  const ready = l.readyT ?? w.t;
  return {
    ready: readyAt(w, ready, dated),
    today: dayOf(ready, w.cfg) <= dayOf(w.t, w.cfg),
    pickupBy: whenAt(w, l.latestPickupT, dated),
    deliverBy: whenAt(w, l.latestDeliveryT, dated),
    closing: urgent(w, l) && l.latestPickupT > w.t ? whenAt(w, l.latestPickupT, dated) : null,
    sameDay: l.sameDay ? `${Math.round((w.cfg.windows!.sameDayPremium - 1) * 100)}%` : null,
  };
}

/** A truck that may book its next load now (§2): on a job, crewed, nothing booked ahead yet (engine AHEAD_STATUSES). */
export const aheadable = (w: World, t: Truck): boolean => windowsOn(w) && t.status !== "idle" && AHEAD_STATUSES.has(t.status) && t.nextLoadId === undefined && crewed(t);
/**
 * A truck the board may book for: idle, or one that may book ahead; never one that already holds its next load (client
 * batch X, fail 3: rule H's hold on an idle truck at home looked bookable until Book now refused it).
 */
export const boardable = (w: World, t: Truck): boolean => t.nextLoadId === undefined && (t.status === "idle" || aheadable(w, t));

/**
 * Why this truck can't take a booking now (fail 3), said up front: `line` on the board's chips, `short` in the truck
 * picker beside its disabled option. The engine's own refusals (actions.ts place_bid, board.ts bookLoad): a next load
 * already held (rule H's hold while its driver is home, or one booked ahead), no driver, or a job that can't book ahead.
 * Null when it can book.
 */
export function bookBar(w: World, t: Truck, truckNo: number): { line: string; short: string } | null {
  if (t.nextLoadId !== undefined) {
    if (t.status === "idle" && resting(w, t)) {
      const d = w.staff[t.driverId - 1]!;
      const back = whenAt(w, d.homeUntilDay! * w.cfg.time.gameMinutesPerDay);
      return { line: WINDOWS.heldDaysOff(truckNo, d.name, back), short: WINDOWS.whyHeld(back) };
    }
    return { line: WINDOWS.twoDeep(truckNo), short: WINDOWS.whyHasNext };
  }
  if (!crewed(t)) return { line: WINDOWS.whyNoDriver, short: WINDOWS.whyNoDriver };
  if (t.status !== "idle" && !aheadable(w, t)) return { line: WINDOWS.whyBusy, short: WINDOWS.whyBusy };
  return null;
}

/** When and where a busy truck is free of its job in hand (freeOf), for the picker and the board's head. */
export function freeAt(w: World, t: Truck): { t: number; place: number; label: string; placeName: string } {
  const f = freeOf(w, t);
  return { t: f.run.t, place: f.place, label: whenAt(w, f.run.t), placeName: place(w, f.place) };
}

/** canMake's refusal as the card's single chip (R22), in the director's words; null when it makes it. */
export function reachChip(w: World, l: Load, r: Reach, truckNo: number): string | null {
  if (r.ok) return null;
  if (r.why === "ahead") return WINDOWS.twoDeep(truckNo);
  // Client batch X2 (QA's batch X re-check, item 1): the close carries its day too, by fail 1's rule ("after the Fri 18:00
  // pickup"; dated 6 or more days out).
  if (r.why === "pickup") return WINDOWS.cantPickup(truckNo, place(w, l.originPlace), whenAt(w, r.pickupT), whenAt(w, l.latestPickupT!));
  if (r.why === "delivery") return WINDOWS.cantDeliver(truckNo, place(w, l.destPlace), whenAt(w, r.deliverT), whenAt(w, l.latestDeliveryT!));
  if (r.why === "daysOff") return FIXES.cantDaysOff(truckNo, whenAt(w, r.freeT), whenAt(w, l.latestPickupT!)); // the director's ruling 17
  return null;
}

/**
 * Client batch X2 (QA's batch X re-check, item 3): a one-truck company's board while its truck is on a job and already holds
 * its next load: which load, and its pickup's close.
 */
export function busyNextLine(w: World, t: Truck, truckNo: number): string {
  const l = w.loads.get(t.nextLoadId!)!;
  return WINDOWS.busyNextBooked(truckNo, place(w, l.originPlace), place(w, l.destPlace), whenAt(w, l.latestPickupT ?? l.appointmentT));
}

/** canMake for the board: only while windows are on, and only where it applies (a busy truck, or a windowed load). */
export function reachFor(w: World, t: Truck, l: Load, free?: Free | null): Reach | null {
  if (!windowsOn(w) || (t.status === "idle" && l.latestPickupT === undefined)) return null;
  return canMake(w, t, l, free ?? freeOf(w, t));
}

/** The claims a booking at `rate` carries (the economy's shares of the pay as booked, windows.ts claimOn). */
export function claimsAt(w: World, l: Load, rate: number): { noShowFd: number; lateFd: number; releaseEarlyFd: number; releaseUrgentFd: number } {
  const k = w.cfg.windows!;
  const pay = rate * l.miles;
  return { noShowFd: k.noShowClaimShare * pay, lateFd: k.lateClaimShare * pay, releaseEarlyFd: k.cancelClaimShare.early * pay, releaseUrgentFd: k.cancelClaimShare.urgent * pay };
}

/** When a load enters its last rounds: from then a release pays the urgent share. */
export const urgentFrom = (w: World, l: Load): number => (l.latestPickupT ?? w.t) - w.cfg.windows!.urgencyRounds * roundMinutes(w);

/**
 * The sheet's "What you're agreeing to" (§1), at the rate the button books: the no-show and late claims, the release's
 * two prices (only for a booking ahead: the engine releases only those), and the truck's own projection (canMake) with its
 * slack; under four hours of slack, the tight line.
 */
/** When a perishable spoils under windows.spoilAfterDeadline: its spoil hours past Deliver by; null for freight that keeps, or with the rule off. */
export function spoilAt(w: World, l: Load): number | null {
  const h = COMMODITIES[l.commodity]?.spoilHours ?? null;
  return h !== null && windowsOn(w) && w.cfg.windows.spoilAfterDeadline && l.latestDeliveryT !== undefined ? l.latestDeliveryT + h * 60 : null;
}

/** What each agreement line is, so its standing cost and explain key follow it wherever it sits (agreeShown). */
export type AgreeKind = "noShow" | "late" | "spoil" | "release" | "truck" | "due";

export function agreement(w: World, t: Truck, l: Load, rate: number, truckNo: number): { lines: string[]; kinds: AgreeKind[]; tight: string | null; spareMin: number | null } | null {
  if (!windowsOn(w) || l.latestPickupT === undefined || l.latestDeliveryT === undefined) return null;
  const cl = claimsAt(w, l, rate);
  const fd = (x: number) => fdFull(Math.round(x));
  // The sheet's lines date every time (fail 1), the projection's arrival too: "at Salem by 16:48" sat beside "Dock opens Fri
  // Jan 12 07:00" with no day of its own.
  const at = (x: number) => whenAt(w, x, true);
  const lines = [WINDOWS.agreeNoShow(at(l.latestPickupT), fd(cl.noShowFd)), WINDOWS.agreeLate(at(l.latestDeliveryT), fd(cl.lateFd))];
  const kinds: AgreeKind[] = ["noShow", "late"];
  // windows.spoilAfterDeadline (the director's sprint ruling §10): a perishable spoils its hours past Deliver by, read at the
  // arrival, and the cargo claim is the commodity's share of its value (trips.ts deliver).
  const spoil = spoilAt(w, l);
  if (spoil !== null) {
    lines.push(WINDOWS.agreeSpoil(at(spoil), fd(w.cfg.commodities.spoilClaimShare * l.cargoValue)));
    kinds.push("spoil");
  }
  if (aheadable(w, t)) {
    const from = urgentFrom(w, l);
    lines.push(w.t < from ? WINDOWS.agreeRelease(at(from), fd(cl.releaseEarlyFd), fd(cl.releaseUrgentFd)) : WINDOWS.agreeReleaseLate(fd(cl.releaseUrgentFd)));
    kinds.push("release");
  }
  const r = canMake(w, t, l);
  let spareMin: number | null = null;
  if (r.ok) {
    spareMin = l.latestDeliveryT - r.deliverT;
    const free = r.freeT > w.t ? at(r.freeT) : "";
    lines.push(WINDOWS.agreeTruck(truckNo, free, place(w, r.freePlace), place(w, l.originPlace), at(r.pickupT), at(r.deliverT), spanLabel(spareMin)));
    kinds.push("truck");
  }
  const due = dueFirstLine(w, t, r.ok ? r.pickupT : l.latestPickupT);
  if (due) {
    lines.push(due);
    kinds.push("due");
  }
  return { lines, kinds, tight: spareMin !== null && spareMin < 4 * 60 ? WINDOWS.tight(spanLabel(spareMin)) : null, spareMin };
}

/**
 * The agreement's lines as the load sheet shows them (UX next-screens §1.4): the no-show, late and release lines gain the
 * standing each costs, for a load that builds it (as the release Confirms say it), and their explain keys, found by kind.
 * QA's 0.25.4 re-check: by place, a perishable's spoil line in third took the release's cost and key, and the release
 * line, fourth, lost both.
 */
export function agreeShown(w: World, c: Company, l: Load, a: NonNullable<ReturnType<typeof agreement>>): { text: string; key: string | null }[] {
  const costs = claimCosts(w, c, l);
  const KEY: Partial<Record<AgreeKind, string>> = { noShow: "claim.noShow", late: "claim.late", release: "claim.lost" };
  return a.lines.map((line, i) => {
    const kind = a.kinds[i]!;
    const cost = costs && (kind === "noShow" || kind === "late" || kind === "release") ? costs[kind] : undefined;
    return { text: cost ? line.replace(/\.\s*$/, `${cost}.`) : line, key: KEY[kind] ?? null };
  });
}

/**
 * labor.dueHomePlan (the director's ruling 17): the sheet's line when the truck's driver comes due home by the pickup's day.
 * The load goes first, and the days off wait until they're home with nothing booked. Null when the driver is on days off.
 */
export function dueFirstLine(w: World, t: Truck, pickupT: number): string | null {
  if (w.cfg.labor.dueHomePlan?.enabled !== true || !t.driverId || !t.companyId) return null;
  const d = w.staff[t.driverId - 1]!;
  const today = dayOf(w.t, w.cfg);
  if (d.homeUntilDay !== null && d.homeUntilDay > today) return null;
  const hm = w.companies[t.companyId - 1]!.orders.find((o) => o.kind === "homeTime");
  if (!hm || hm.kind !== "homeTime") return null;
  const dueDay = today + Math.max(0, hm.afterDays - d.awayDays);
  if (dueDay > dayOf(pickupT, w.cfg)) return null;
  const day = dueDay <= today ? FIXES.dueToday : weekdayName(dueDay * w.cfg.time.gameMinutesPerDay, w.cfg);
  return FIXES.dueFirst(d.owner ? null : d.name, day);
}

/** The truck card's two lines (§2): the job in hand and the load booked after it. */
export function nowNext(w: World, c: Company, t: Truck): { now: string | null; next: string | null } {
  if (!windowsOn(w)) return { now: null, next: null };
  const cur = t.loadId !== null ? w.loads.get(t.loadId) : undefined;
  const nxt = t.nextLoadId !== undefined ? w.loads.get(t.nextLoadId) : undefined;
  if (!nxt) return { now: null, next: null };
  const now = cur ? WINDOWS.nowLine(place(w, cur.originPlace), place(w, cur.destPlace), whenAt(w, deliveryEtaMin(w, t, c, cur))) : null;
  return { now, next: WINDOWS.nextLine(place(w, nxt.originPlace), place(w, nxt.destPlace), whenAt(w, nxt.latestPickupT ?? nxt.appointmentT)) };
}

/**
 * Client batch X (QA's 0.25.0 replay, fail 2): Release asks first, on the confirm card letting a driver go uses. Its
 * figures: the claim in FD as the engine takes it (windows.ts claimOn), what it does, and the mark on the record.
 * Fleet.tsx adds the run. QA's 0.25.2 replay (the producer's call): under windows.claimsInFull the engine takes the claim
 * in full, into the red like any bill, so the card names it in full and the release stays on past the cash, saying it
 * puts the company into debt; off, the claim is held to the cash as before.
 */
export function releaseCard(w: World, c: Company, l: Load, claimFd: number, truckNo: number): { verb: string; item: string; costFd: number; does: string; risk: string; destructive: true; intoDebt?: (fd: string) => string } {
  return { verb: "Release", item: WINDOWS.releaseItem(l.id), costFd: releaseCostFd(w, c, claimFd), does: WINDOWS.releaseDoes(place(w, l.originPlace), place(w, l.destPlace), truckNo), risk: withStanding(w, c, l, WINDOWS.releaseRisk), destructive: true, ...(w.cfg.windows?.claimsInFull === true ? { intoDebt: FIXES.releaseIntoDebt } : {}) };
}
/** QA's 0.25.4 replay: a release's risk with the standing it costs (windows.ts releaseLoad's standingHit), as the booking sheet says it. */
const withStanding = (w: World, c: Company, l: Load, risk: string): string => {
  const s = releaseStanding(w, c, l);
  return s ? `${risk} ${s}` : risk;
};
/** The claim as the engine takes it (windows.ts claimOn): in full under windows.claimsInFull, else never more than the cash. */
export function releaseCostFd(w: World, c: Company, claimFd: number): number {
  return Math.round(w.cfg.windows?.claimsInFull === true ? claimFd : Math.min(claimFd, Math.max(0, w.ledger.balance(companyAccount(c.id)))));
}

/**
 * windows.releaseCurrent (the director's sprint §1): the load a truck is heading to, or waits for at the dock before it's
 * ready (the red team's 0.25.3 pass, finding 3), while it can still be released: the claim at today's share, the town the
 * truck would stop at and the empty miles it would sink, and a breakdown's ask on it.
 */
export function currentRelease(w: World, t: Truck): { load: Load; priceFd: number; town: string; sunkMi: number; ask: AskFigures | null } | null {
  if (!windowsOn(w) || w.cfg.windows?.releaseCurrent !== true || t.loadId === null || (t.status !== "toPickup" && t.status !== "loading")) return null;
  const l = w.loads.get(t.loadId);
  if (!l || (t.status === "toPickup" ? l.status !== "assigned" : !waitingAtDock(w, t, l))) return null;
  const cl = claimsAt(w, l, l.clearedRate);
  const stop = releaseStopOf(w, t);
  return { load: l, priceFd: w.t < urgentFrom(w, l) ? cl.releaseEarlyFd : cl.releaseUrgentFd, town: place(w, stop.place), sunkMi: stop.sunkMi, ask: l.releaseAsk ? askFigures(w, l) : null };
}
/** The current load's release Confirm: the claim, the mark, where the truck stops, that it can't be booked again; into debt as releaseCard's. */
export function releaseCurrentCard(w: World, c: Company, x: NonNullable<ReturnType<typeof currentRelease>>, claimFd: number, truckNo: number): { verb: string; item: string; costFd: number; does: string; risk: string; destructive: true; intoDebt?: (fd: string) => string } {
  const l = x.load;
  return { ...releaseCard(w, c, l, claimFd, truckNo), does: FIXES.releaseCurrentDoes(place(w, l.originPlace), place(w, l.destPlace), truckNo, x.town, x.sunkMi >= 0.5 ? Math.round(x.sunkMi).toLocaleString("en-US") : null), risk: withStanding(w, c, l, FIXES.releaseCurrentRisk) };
}

/** A breakdown's ask on a load booked ahead (§3): the repair, the projected arrival, the two prices, the close. */
export interface AskFigures {
  load: Load;
  truck: Truck;
  repairedT: number;
  reachT: number;
  /** Minutes after the pickup's close it would arrive (≤ 0: it makes it, with that much to spare). */
  lateMin: number;
  releaseFd: number;
  noShowFd: number;
  closesT: number;
}
export function askFigures(w: World, l: Load): AskFigures | null {
  if (!windowsOn(w) || !l.releaseAsk || l.latestPickupT === undefined) return null;
  const t = w.trucks[l.releaseAsk.truckId - 1];
  if (!t) return null;
  // windows.releaseCurrent: the load the truck is heading to reads the rest of its leg; a load ahead, canMake.
  const reachT = t.loadId === l.id ? pickupReachT(w, t) : canMake(w, t, l).pickupT;
  const repairedT = t.status === "repair" && t.repairUntilT !== null ? t.repairUntilT : w.t + t.breakdownMin;
  return { load: l, truck: t, repairedT, reachT, lateMin: reachT - l.latestPickupT, releaseFd: l.releaseAsk.fd, noShowFd: claimsAt(w, l, l.clearedRate).noShowFd, closesT: l.latestPickupT };
}
/** The ask's words, in order: the title, the figures, the two choices, the close (or "likely to make it"). */
export function askLines(w: World, a: AskFigures, truckNo: number): string[] {
  const l = a.load;
  const fd = (x: number) => fdFull(Math.round(x));
  const out = [WINDOWS.askTitle(truckNo, place(w, l.originPlace), place(w, l.destPlace))];
  if (a.lateMin > 0) out.push(WINDOWS.askFigures(whenAt(w, a.repairedT), place(w, l.originPlace), whenAt(w, a.reachT), spanLabel(a.lateMin), whenAt(w, a.closesT)));
  out.push(WINDOWS.askRelease(fd(a.releaseFd)));
  out.push(a.lateMin > 0 ? WINDOWS.askKeep(fd(a.noShowFd)) : WINDOWS.askKeepLikely(spanLabel(-a.lateMin)));
  out.push(WINDOWS.askNoAnswer(whenAt(w, a.closesT)));
  return out;
}

/**
 * What now?'s windows states (§4), per truck: a pickup or a delivery at risk (the claim at stake), a late delivery that
 * nothing changes now (a statement), a next load booked (nothing to do), waiting at a shipper before ready.
 */
export type WindowState =
  | { kind: "risk"; end: "pickup" | "delivery"; truckId: number; loadId: number; atT: number; place: number; claimFd: number }
  | { kind: "late"; truckId: number; loadId: number; lateMin: number; place: number; claimFd: number }
  | { kind: "next"; truckId: number; loadId: number; deliversT: number; place: number; pickupByT: number }
  | { kind: "waiting"; truckId: number; loadId: number; place: number; readyT: number };
export function windowStates(w: World, c: Company): WindowState[] {
  if (!windowsOn(w)) return [];
  const out: WindowState[] = [];
  const margin = w.cfg.windows!.planMarginMinutes;
  for (const t of w.trucksByCompany.get(c.id) ?? []) {
    const cur = t.loadId !== null ? w.loads.get(t.loadId) : undefined;
    if (cur && cur.latestPickupT !== undefined && cur.latestDeliveryT !== undefined) {
      if (t.status === "toPickup") {
        const at = etaMin(w, t, c);
        if (at + margin > cur.latestPickupT) out.push({ kind: "risk", end: "pickup", truckId: t.id, loadId: cur.id, atT: cur.latestPickupT, place: cur.originPlace, claimFd: claimsAt(w, cur, cur.clearedRate).noShowFd });
      } else if (t.status === "loading" && cur.readyT !== undefined && cur.readyT > w.t) {
        out.push({ kind: "waiting", truckId: t.id, loadId: cur.id, place: cur.originPlace, readyT: cur.readyT });
      }
      if (t.status === "loading" || t.status === "loaded" || t.status === "toPickup") {
        const arrive = deliveryEtaMin(w, t, c, cur);
        const late = arrive - cur.latestDeliveryT;
        // Loaded and running late: nothing changes it now. Before the load is aboard it's still a risk to act on.
        if (late > 0 && t.status === "loaded") out.push({ kind: "late", truckId: t.id, loadId: cur.id, lateMin: late, place: cur.destPlace, claimFd: claimsAt(w, cur, cur.clearedRate).lateFd });
        else if (late + margin > 0 && t.status !== "loaded" && !out.some((x) => x.kind === "risk" && x.truckId === t.id)) out.push({ kind: "risk", end: "delivery", truckId: t.id, loadId: cur.id, atT: cur.latestDeliveryT, place: cur.destPlace, claimFd: claimsAt(w, cur, cur.clearedRate).lateFd });
      }
    }
    const nxt = t.nextLoadId !== undefined ? w.loads.get(t.nextLoadId) : undefined;
    if (nxt && nxt.latestPickupT !== undefined && !nxt.releaseAsk) {
      const r = canMake(w, t, nxt);
      if (!r.ok && (r.why === "pickup" || r.why === "daysOff")) out.push({ kind: "risk", end: "pickup", truckId: t.id, loadId: nxt.id, atT: nxt.latestPickupT, place: nxt.originPlace, claimFd: claimsAt(w, nxt, nxt.clearedRate).noShowFd });
      else if (!r.ok && r.why === "delivery") out.push({ kind: "risk", end: "delivery", truckId: t.id, loadId: nxt.id, atT: nxt.latestDeliveryT!, place: nxt.destPlace, claimFd: claimsAt(w, nxt, nxt.clearedRate).lateFd });
      else if (r.ok) out.push({ kind: "next", truckId: t.id, loadId: nxt.id, deliversT: r.freeT, place: nxt.originPlace, pickupByT: nxt.latestPickupT });
    }
  }
  return out;
}

/** A lost load's line (§5): one the player bid on, gone at its pickup's close. */
export const lostBidLine = (w: World, l: Load): string | null =>
  windowsOn(w) && l.latestPickupT !== undefined ? WINDOWS.lostBid(place(w, l.originPlace), place(w, l.destPlace), hhmm(l.latestPickupT)) : null;

/**
 * A player's brokerage's posted loads with no carrier and their pickup closing within the day (§5's Needs you line), with
 * the fall-off losing one costs. (The director's line also names a raise; no action raises a posted load's pay yet.)
 */
export function brokerageClosing(w: World, c: Company): { load: Load; fallOffFd: number }[] {
  if (!windowsOn(w)) return [];
  const out: { load: Load; fallOffFd: number }[] = [];
  for (const l of w.loads.values()) {
    if (l.status !== "open" || l.brokerId !== c.id || l.latestPickupT === undefined) continue;
    if (l.latestPickupT - w.t > w.cfg.time.gameMinutesPerDay || l.latestPickupT <= w.t) continue;
    out.push({ load: l, fallOffFd: w.cfg.brokerRisk.fallOffShare * l.shipperRate * l.miles });
  }
  return out.sort((a, b) => a.load.latestPickupT! - b.load.latestPickupT!);
}

/**
 * Iuliia's line on the first claim paid (§7): the cause in figures, never a scold. From the claim's ledger ref
 * (windows.ts claimOn: claim:{kind}:{load id}) and the load as the engine kept it.
 */
export function claimCause(w: World, ref: string, fd: number): string | null {
  const m = /^claim:(cancel|noshow|late):(\d+)$/.exec(ref);
  if (!m) return null;
  const l = w.loads.get(Number(m[2]));
  const amount = fdFull(Math.round(fd));
  if (m[1] === "cancel") return WINDOWS.claimCauseCancel(amount);
  if (!l) return null;
  if (m[1] === "noshow") return WINDOWS.claimCauseNoShow(place(w, l.originPlace), amount);
  const late = l.arrivedT !== undefined && l.latestDeliveryT !== undefined ? l.arrivedT - l.latestDeliveryT : null;
  const dock = (l.detention?.pickupH ?? 0) > 0 ? WINDOWS.claimCauseDock(place(w, l.originPlace)) : "";
  return WINDOWS.claimCauseLate(place(w, l.destPlace), late !== null && late > 0 ? spanLabel(late) : "", amount) + dock;
}

/**
 * The market's lost loads by hub over the trailing week (§5, the 11-09 line on Intel): the NPC shippers' loads lost at
 * their close (windows.ts lostShare, the hub's tally), with how far the lost-load memory lifts its rates (memoryLift,
 * the mean over the three trailers). The most lost first.
 */
export function hubLosses(w: World, top = 5): { hub: number; lost: number; liftPct: string | null }[] {
  if (!windowsOn(w)) return [];
  const out = w.net.hubs.map((_, hub) => {
    const lift = (["van", "reefer", "flatbed"] as const).reduce((s, eq) => s + memoryLift(w, hub, eq), 0) / 3 - 1;
    return { hub, lost: lostShare(w, npcKey(hub)).lost, liftPct: lift >= 0.005 ? `${Math.round(lift * 100)}%` : null };
  });
  return out.filter((x) => x.lost > 0).sort((a, b) => b.lost - a.lost || a.hub - b.hub).slice(0, top);
}

/**
 * When loads like this one clear (the economy's spec, economy-windows-clearsnear-2026-11-13.md): the walk clause when half
 * or more of the recent clears came in the urgency walk, else the round clause when half or more came within a round of
 * posting, else none. With the share behind it, for the figure's explanation. Null with windows off or too few clears.
 */
export function clearsTiming(w: World, l: Load): { clause: string; share: string } | null {
  const c = clearsWhen(w, l);
  if (!c) return null;
  const hub = w.net.hubs[l.origin]!.name;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  if (c.walk >= 0.5) return { clause: WINDOWS.clearsWalk, share: WINDOWS.clearsShareWalk(pct(c.walk), c.from, hub) };
  if (c.quick >= 0.5) return { clause: WINDOWS.clearsQuick, share: WINDOWS.clearsShareQuick(pct(c.quick), c.from, hub) };
  return null;
}

/**
 * labor.homeAtOnce (the director's ruling 2): home is the home market, at the radius that counts a night at home
 * (map.nearbyRadiusMi). Inside it, a driver due home starts the days off as the truck goes idle, and Send home isn't
 * offered (it would mean nothing there). Off: home is the home hub itself, as the page had it.
 */
export function atHomeMarket(w: World, c: Company, t: Truck): boolean {
  return w.cfg.labor.homeAtOnce ? hubMiles(w, t.hub, c.homeHub) <= w.cfg.map.nearbyRadiusMi : t.hub === c.homeHub;
}
/** Ruling 2's card line for a crew on days off inside the home radius: "Ana is home (Springfield, Columbus market): …". */
export function homeMarketLine(w: World, c: Company, t: Truck): string | null {
  if (!w.cfg.labor.homeAtOnce || !t.driverId || !atHomeMarket(w, c, t)) return null;
  const d = w.staff[t.driverId - 1]!;
  const today = dayOf(w.t, w.cfg);
  if (d.homeUntilDay === null || d.homeUntilDay <= today) return null;
  const tomorrow = d.drivenMinToday > 0;
  const left = Math.max(1, d.homeUntilDay - today - (tomorrow ? 1 : 0));
  const who = d.owner ? "You're" : `${d.name} is`;
  // Batch M2 (QA: "N days off, starting now" every day): "starting" only on the days off's first day (no day off counted
  // yet, labor.ts restDays), then a count of the days left.
  if (!tomorrow && d.restDays > 0) return MENUS.homeDaysLeft(who, place(w, t.place), w.net.hubs[c.homeHub]!.name, left);
  return WINDOWS.homeInMarket(who, place(w, t.place), w.net.hubs[c.homeHub]!.name, left, tomorrow);
}
/**
 * labor.homeNeedsDispatcher (the director's ruling 3): with the dispatcher off (no bidding order), the home rule never
 * drives the truck home, so What now?'s due-home answer says so (the words of the old rule said it heads home empty).
 */
export const homeNoDrive = (w: World, c: Company): boolean => w.cfg.labor.homeNeedsDispatcher && !c.orders.some((o) => o.kind === "bid");

/**
 * The director's ruling 21 (windows.fullOpenDay): the sheet's one line when a load's pickup window spans whole days its
 * shipper's dock is shut: the town, the shut days ("Sat–Sun"), and the full open day the window holds, with its hours.
 * Null with the rule off, at a dock with no hours, or with no shut day inside the window.
 */
export function dockShutLine(w: World, l: Load): string | null {
  if (l.readyT === undefined || l.latestPickupT === undefined) return null;
  const full = fullOpenDay(w, l, l.readyT);
  const h = dockHoursAt(w, l, "pickup");
  if (!full || !h) return null;
  const D = w.cfg.time.gameMinutesPerDay;
  const shut: number[] = [];
  for (let d = Math.ceil(l.readyT / D); (d + 1) * D <= l.latestPickupT; d++) if (!h.days.includes((d + w.cfg.time.weekdayOfDay0) % 7)) shut.push(d);
  if (!shut.length) return null;
  const name = (d: number) => weekday(d);
  const days = shut.length === 1 ? name(shut[0]!) : `${name(shut[0]!)}–${name(shut.at(-1)!)}`;
  // The red team's 0.25.6 fix: when the ready day still has a loading's hours, "Deliver by" counts from it, so that's the
  // loading day the line names (with that day's hours); else the full open day the window holds.
  const readyDay = Math.floor(l.readyT / D);
  const onReady = loadsOnReadyDay(w, l, l.readyT);
  const loading = onReady ? readyDay : Math.floor(full.open / D);
  const open = onReady ? readyDay * D + h.open * 60 : full.open;
  const close = onReady ? readyDay * D + h.close * 60 : full.close;
  return FIXES.dockShut(w.net.places[l.originPlace]!.name, days, name(loading), hhmm(open), hhmm(close));
}
