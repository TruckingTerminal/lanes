import { AHEAD_STATUSES, canMake, crewed, dayOf, freeOf, lostShare, memoryLift, npcKey, urgent, whenLabel, windowsOn, type Company, type Free, type Load, type Reach, type Truck, type World } from "@lanes/engine";
import { WINDOWS } from "./copy-windows.js";
import { fdFull, hhmm } from "./format.js";
import { deliveryEtaMin, etaMin } from "./rolling.js";

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
export function windowLine(w: World, l: Load): WindowLine | null {
  if (!windowsOn(w) || l.latestPickupT === undefined || l.latestDeliveryT === undefined) return null;
  const ready = l.readyT ?? w.t;
  return {
    ready: whenLabel(w, ready),
    today: dayOf(ready, w.cfg) <= dayOf(w.t, w.cfg),
    pickupBy: whenLabel(w, l.latestPickupT),
    deliverBy: whenLabel(w, l.latestDeliveryT),
    closing: urgent(w, l) && l.latestPickupT > w.t ? whenLabel(w, l.latestPickupT) : null,
    sameDay: l.sameDay ? `${Math.round((w.cfg.windows!.sameDayPremium - 1) * 100)}%` : null,
  };
}

/** A truck that may book its next load now (§2): on a job, crewed, nothing booked ahead yet (engine AHEAD_STATUSES). */
export const aheadable = (w: World, t: Truck): boolean => windowsOn(w) && t.status !== "idle" && AHEAD_STATUSES.has(t.status) && t.nextLoadId === undefined && crewed(t);
/** A truck the board may book for: idle, or one that may book ahead. */
export const boardable = (w: World, t: Truck): boolean => t.status === "idle" || aheadable(w, t);

/** When and where a busy truck is free of its job in hand (freeOf), for the picker and the board's head. */
export function freeAt(w: World, t: Truck): { t: number; place: number; label: string; placeName: string } {
  const f = freeOf(w, t);
  return { t: f.run.t, place: f.place, label: whenLabel(w, f.run.t), placeName: place(w, f.place) };
}

/** canMake's refusal as the card's single chip (R22), in the director's words; null when it makes it. */
export function reachChip(w: World, l: Load, r: Reach, truckNo: number): string | null {
  if (r.ok) return null;
  if (r.why === "ahead") return WINDOWS.twoDeep(truckNo);
  if (r.why === "pickup") return WINDOWS.cantPickup(truckNo, place(w, l.originPlace), whenLabel(w, r.pickupT), hhmm(l.latestPickupT!));
  if (r.why === "delivery") return WINDOWS.cantDeliver(truckNo, place(w, l.destPlace), whenLabel(w, r.deliverT), hhmm(l.latestDeliveryT!));
  return null;
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
export function agreement(w: World, t: Truck, l: Load, rate: number, truckNo: number): { lines: string[]; tight: string | null; spareMin: number | null } | null {
  if (!windowsOn(w) || l.latestPickupT === undefined || l.latestDeliveryT === undefined) return null;
  const cl = claimsAt(w, l, rate);
  const fd = (x: number) => fdFull(Math.round(x));
  const lines = [WINDOWS.agreeNoShow(whenLabel(w, l.latestPickupT), fd(cl.noShowFd)), WINDOWS.agreeLate(whenLabel(w, l.latestDeliveryT), fd(cl.lateFd))];
  if (aheadable(w, t)) {
    const from = urgentFrom(w, l);
    lines.push(w.t < from ? WINDOWS.agreeRelease(whenLabel(w, from), fd(cl.releaseEarlyFd), fd(cl.releaseUrgentFd)) : WINDOWS.agreeReleaseLate(fd(cl.releaseUrgentFd)));
  }
  const r = canMake(w, t, l);
  let spareMin: number | null = null;
  if (r.ok) {
    spareMin = l.latestDeliveryT - r.deliverT;
    const free = r.freeT > w.t ? whenLabel(w, r.freeT) : "";
    lines.push(WINDOWS.agreeTruck(truckNo, free, place(w, r.freePlace), place(w, l.originPlace), hhmm(r.pickupT), whenLabel(w, r.deliverT), spanLabel(spareMin)));
  }
  return { lines, tight: spareMin !== null && spareMin < 4 * 60 ? WINDOWS.tight(spanLabel(spareMin)) : null, spareMin };
}

/** The truck card's two lines (§2): the job in hand and the load booked after it. */
export function nowNext(w: World, c: Company, t: Truck): { now: string | null; next: string | null } {
  if (!windowsOn(w)) return { now: null, next: null };
  const cur = t.loadId !== null ? w.loads.get(t.loadId) : undefined;
  const nxt = t.nextLoadId !== undefined ? w.loads.get(t.nextLoadId) : undefined;
  if (!nxt) return { now: null, next: null };
  const now = cur ? WINDOWS.nowLine(place(w, cur.originPlace), place(w, cur.destPlace), whenLabel(w, deliveryEtaMin(w, t, c, cur))) : null;
  return { now, next: WINDOWS.nextLine(place(w, nxt.originPlace), place(w, nxt.destPlace), whenLabel(w, nxt.latestPickupT ?? nxt.appointmentT)) };
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
  const r = canMake(w, t, l);
  const repairedT = t.status === "repair" && t.repairUntilT !== null ? t.repairUntilT : w.t + t.breakdownMin;
  return { load: l, truck: t, repairedT, reachT: r.pickupT, lateMin: r.pickupT - l.latestPickupT, releaseFd: l.releaseAsk.fd, noShowFd: claimsAt(w, l, l.clearedRate).noShowFd, closesT: l.latestPickupT };
}
/** The ask's words, in order: the title, the figures, the two choices, the close (or "likely to make it"). */
export function askLines(w: World, a: AskFigures, truckNo: number): string[] {
  const l = a.load;
  const fd = (x: number) => fdFull(Math.round(x));
  const out = [WINDOWS.askTitle(truckNo, place(w, l.originPlace), place(w, l.destPlace))];
  if (a.lateMin > 0) out.push(WINDOWS.askFigures(whenLabel(w, a.repairedT), place(w, l.originPlace), whenLabel(w, a.reachT), spanLabel(a.lateMin), hhmm(a.closesT)));
  out.push(WINDOWS.askRelease(fd(a.releaseFd)));
  out.push(a.lateMin > 0 ? WINDOWS.askKeep(fd(a.noShowFd)) : WINDOWS.askKeepLikely(spanLabel(-a.lateMin)));
  out.push(WINDOWS.askNoAnswer(whenLabel(w, a.closesT)));
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
      if (!r.ok && r.why === "pickup") out.push({ kind: "risk", end: "pickup", truckId: t.id, loadId: nxt.id, atT: nxt.latestPickupT, place: nxt.originPlace, claimFd: claimsAt(w, nxt, nxt.clearedRate).noShowFd });
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
