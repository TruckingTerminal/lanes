/**
 * Delivery windows (item 4, batch 1: windows and loss). Config `windows`; engineering's proposal
 * (engineering-item4-delivery-windows.md), the director's calls (DECISIONS.md 2026-11-08) and the economy's sizes
 * (studio/reviews/economy-delivery-windows.md).
 *
 * - Posting (freight.ts): NPC and facility freight draws a lead from windows.leadDays (a contract tender is for now). The
 *   load is ready at its shipper's dock on the lead day, its pickup closes windows.pickupHours later, and it must be
 *   delivered within the legal transit and the commodity's window after that; a hot load's deadline is one only a team
 *   or more hours than one driver may legally run can make.
 * - The round (board.ts): unbooked when its pickup closes, a load is lost (giveUp: the broker's fall-off charge, NPC
 *   direct freight lost and counted, a player shipper's goods unsold), with no slide and no re-post. While more than
 *   windows.urgencyRounds rounds of slack remain its price holds; in those last rounds it walks (urgencyStep).
 * - The dispatcher's index (standingOrders.ts indexOpenLoads) files a load under its ready day: a round's work is the
 *   freight ready today, as before.
 *
 * Batch 2, booking ahead:
 * - canMake: whether a truck, free when its job in hand ends, reaches a load's pickup before it closes and delivers it by
 *   its deadline at the legal pace (a team's with a team). It reads the world and changes nothing, w.rng included.
 * - By hand (actions.ts), a busy truck books one load ahead (Truck.nextLoadId, the load "assigned" with `ahead`), never a
 *   third; it becomes the truck's load when the job in hand ends (trips.ts setIdle and takeNextLoad).
 * - Claims, carrier to poster (`claimOn`): a release before the pickup (releaseLoad, windows.cancelClaimShare: early, or in
 *   the urgency rounds), a no-show (noShow: booked, not at the shipper when its pickup closed; the load is lost), and a
 *   late delivery (after latestDeliveryT: delivered and paid, and claimed; trips.ts deliver). A release and a no-show also
 *   mark the carrier's record (Company.failed).
 *
 * Off, nothing here runs: windowsOn is read at posting, at the round, at the index and in the ratio, and every field it
 * sets is absent on a load posted while off, so those loads take today's path wherever they go.
 */
import { COMMODITIES } from "@lanes/data";
import type { EconomyConfig } from "@lanes/config";
import { dayOf, MINUTES_PER_HOUR } from "./clock.js";
import { dockHoursAt, dockRule, nextOpen } from "./docks.js";
import { giveUp } from "./board.js";
import { samePerson } from "./brokerage.js";
import { fmtInt } from "./economics.js";
import { companyAccount } from "./ledger.js";
import { legalDrivingMin, reopenLoad } from "./safety.js";
import { dutyResetAt, legKeyOf } from "./trips.js";
import type { Company, Load, Truck } from "./types.js";
import { companyById, placeHours, placeLegMiles, placeRoute, type World } from "./world.js";

/** windows.enabled; a config without the key (an older profile) reads as off. */
export const windowsOn = (w: World): boolean => w.cfg.windows?.enabled === true;

/** Minutes for `hours` of driving at `perDay` driving hours a day, with the rest between duty days (freight.ts, board.ts). */
export function transitMinutes(cfg: EconomyConfig, hours: number, perDay: number): number {
  const fullDays = Math.max(0, Math.ceil(hours / perDay) - 1);
  return (fullDays * cfg.hos.dutyDayHours + (hours - fullDays * perDay)) * 60;
}

/** A lead in days from windows.leadDays: a bucket by weight, then a day inside it. Draws only from w.rng.windows. */
export function drawLeadDays(w: World): number {
  const buckets = w.cfg.windows!.leadDays;
  const rng = w.rng.windows;
  const [from, to] = buckets[rng.weighted(buckets.map((b) => b[2]))]!;
  return to > from ? rng.int(from, to) : from;
}

/** When a load posted now with this lead is ready: the posting time plus the lead, at the shipper's dock's next opening. */
export function readyAt(w: World, load: Load, leadDays: number): number {
  const t = w.t + leadDays * w.cfg.time.gameMinutesPerDay;
  const hours = w.cfg.docks.enabled ? dockHoursAt(w, load, "pickup") : null;
  return hours ? nextOpen(w, t, hours) : t;
}

/** Sets a just-posted load's window. Its appointment moves with the ready time and sits inside the window. */
export function openWindow(w: World, load: Load, leadDays: number): void {
  const { cfg } = w;
  const k = cfg.windows!;
  const readyT = readyAt(w, load, leadDays);
  const latestPickupT = readyT + (dockRule(w, load) === "appointment" ? k.pickupHours.appointment : k.pickupHours.firstCome) * 60;
  const legal = transitMinutes(cfg, load.routeHours, cfg.hos.drivingHoursPerDay);
  const windowMin = COMMODITIES[load.commodity]!.windowHours * 60;
  let latestDeliveryT = latestPickupT + legal + windowMin;
  if (load.hot > 0) {
    // The director's call 4: a hot load keeps its draw, and its deadline is today's hot rule (safety.hotLoads, the due time
    // at booking: the hot pace, the dock time and the slack) counted from the moment it's ready, a window meant for a team
    // or a driver over the legal hours.
    const hl = cfg.safety.hotLoads;
    const ops = cfg.equipmentOps;
    const dwell = cfg.dwell.loadMinutes[1] + cfg.dwell.unloadMinutes[1] + (ops.enabled && load.equipment === "flatbed" ? ops.flatbedSecureMinutes[1] + ops.flatbedUntarpMinutes[1] : 0);
    latestDeliveryT = readyT + transitMinutes(cfg, load.routeHours, hl.hoursPerDay) + dwell + hl.slackMinutes;
  }
  load.readyT = readyT;
  load.latestPickupT = latestPickupT;
  load.latestDeliveryT = latestDeliveryT;
  load.appointmentT = Math.min(readyT + windowMin + legal, latestDeliveryT);
}

/** True when a load counts in today's work: no window, windows off, or ready by today's end. */
export function readyToday(w: World, load: Load): boolean {
  return load.readyT === undefined || !windowsOn(w) || dayOf(load.readyT, w.cfg) <= dayOf(w.t, w.cfg);
}

/** True when the load's pickup has closed (windows on): it can no longer be booked, and the next round loses it. */
export const pickupClosed = (w: World, load: Load): boolean => load.latestPickupT !== undefined && windowsOn(w) && w.t >= load.latestPickupT;

/** Who posted a load, for the lost-freight metrics: an NPC shipper direct, an AI broker, a player's brokerage, a facility. */
export type PosterKind = "npc" | "broker" | "brokerage" | "shipper";
export const POSTER_KINDS: readonly PosterKind[] = ["npc", "broker", "brokerage", "shipper"];

/** A player poster: a person's company or a player's brokerage (brokerage.ts): its pay never walks (QA's S4). */
function byPlayer(w: World, id: number | null): boolean {
  const c = id !== null ? w.companies[id - 1] : undefined;
  return c !== undefined && (c.human || c.partnerId !== undefined);
}

export function posterKind(w: World, load: Load): PosterKind {
  if (load.shipperId !== null) return "shipper";
  if (load.brokerId === null) return "npc";
  return byPlayer(w, load.brokerId) ? "brokerage" : "broker";
}

/** Minutes between board rounds. */
const roundMinutes = (w: World): number => w.cfg.time.gameMinutesPerDay / w.cfg.time.boardRoundHours.length;

/** In its last rounds: no more than windows.urgencyRounds rounds of slack before the pickup closes. */
export function urgent(w: World, load: Load): boolean {
  return load.latestPickupT !== undefined && load.latestPickupT - w.t <= w.cfg.windows!.urgencyRounds * roundMinutes(w);
}

/**
 * One round of the urgency walk (the director's call 3): the ceiling steps as a rollover's does (`raiseCeiling`, board.ts:
 * an NPC shipper raises it, a broker eats it up to its fall-off reach) and book-now walks from where it opened to the
 * ceiling over windows.urgencyRounds steps (R11's walk), never above it. At most that many steps; a player poster's pay
 * never walks. The appointment never moves. True when the price moved.
 */
export function urgencyStep(w: World, load: Load, raiseCeiling: (w: World, load: Load) => void): boolean {
  const k = w.cfg.windows!;
  const steps = load.urgentSteps ?? 0;
  if (steps >= k.urgencyRounds) return false;
  load.urgentSteps = steps + 1;
  if (byPlayer(w, load.shipperId ?? load.brokerId)) return false;
  raiseCeiling(w, load);
  const open = (load.bookNowOpen ??= load.bookNow);
  load.bookNow = Math.min(load.ceiling, open + (load.ceiling - open) * Math.min(1, load.urgentSteps / k.urgencyRounds));
  return true;
}

// --- Booking ahead (batch 2) ---------------------------------------------------------------------------------------

/** A truck that may book a load ahead: on a job or an empty run, or in the shop; never parked, listed or retired. */
export const AHEAD_STATUSES: ReadonlySet<Truck["status"]> = new Set(["toPickup", "loading", "loaded", "unloading", "repositioning", "repair"]);

/** canMake's answer: whether, and the figures a refusal names. */
export interface Reach {
  ok: boolean;
  /** Why not: the truck can't take loads now, it already has one booked ahead, it misses the pickup, or the deadline. */
  why: "busy" | "ahead" | "pickup" | "delivery" | null;
  /** When and where the truck is free of its job in hand (now and here when idle). */
  freeT: number;
  freePlace: number;
  /** Its arrival at the shipper, and at the receiver. */
  pickupT: number;
  deliverT: number;
}

/**
 * canMake (batch 2): the truck's projected free time and place, then the run to this load's pickup and on to its receiver,
 * against latestPickupT and latestDeliveryT. Driving follows the roads (route hours) within the legal hours, a team's with
 * a team (safety.ts legalDrivingMin): the day's hours left now (dutyResetAt, read without opening a new duty day), a rest
 * of hos.restHours when they run out, R12's break once a shift and the fuel stops. At each end the truck waits for the
 * load to be ready and for the dock to open (docks.ts nextOpen, which draws nothing; deliveryWait draws and isn't used),
 * then the dwell at its longest. The deadline reads the arrival when docks.lateFromArrival is on, as deliver does.
 * It reads only: no write to the truck, the load or w.rng.
 */
export function canMake(w: World, truck: Truck, load: Load): Reach {
  const { cfg } = w;
  const hos = cfg.hos;
  const ops = cfg.equipmentOps;
  const limit = legalDrivingMin(w, truck);
  const rest = (hos.restHours > 0 ? hos.restHours : hos.dutyDayHours - hos.drivingHoursPerDay) * MINUTES_PER_HOUR;
  const breakAfter = hos.breakAfterHours * MINUTES_PER_HOUR;
  const reset = dutyResetAt(w, truck);
  const fresh = reset === null || w.t >= reset;
  let t = w.t;
  let left = fresh ? limit : Math.max(0, limit - truck.shiftDrivenMin);
  let shift = fresh ? 0 : truck.shiftDrivenMin;
  // Standing still: a stop as long as a rest gives the hours back.
  const stop = (min: number) => {
    if (!(min > 0)) return;
    t += min;
    if (min >= rest) {
      left = limit;
      shift = 0;
    }
  };
  const until = (at: number) => stop(at - t);
  const drive = (min: number, mi: number) => {
    let need = min;
    while (need > 1e-9) {
      if (left <= 1e-9) {
        t += rest;
        left = limit;
        shift = 0;
        continue;
      }
      let d = Math.min(need, left);
      const breakDue = hos.breakMinutes > 0 && shift < breakAfter && shift + d > breakAfter;
      if (breakDue) d = breakAfter - shift;
      t += d;
      need -= d;
      left -= d;
      shift += d;
      if (breakDue) t += hos.breakMinutes;
    }
    if (cfg.fuel.stopEveryMi > 0) t += Math.floor(mi / cfg.fuel.stopEveryMi) * cfg.fuel.stopMinutes;
  };
  const leg = (a: number, b: number) => drive(placeHours(w, a, b) * MINUTES_PER_HOUR, a === b ? 0 : placeLegMiles(w, a, b));
  const legLeft = () => {
    const r = placeRoute(w, truck.place, truck.targetPlace);
    const min = r && r.miles > 0 ? (r.hours * MINUTES_PER_HOUR * truck.remainingMi) / r.miles : (truck.remainingMi / hos.avgMph) * MINUTES_PER_HOUR;
    drive(min, truck.remainingMi);
  };
  const dockOpen = (l: Load, end: "pickup" | "delivery") => {
    const h = cfg.docks.enabled ? dockHoursAt(w, l, end) : null;
    return h ? nextOpen(w, t, h) : t;
  };
  const loadDwell = (l: Load) => cfg.dwell.loadMinutes[1] + (ops.enabled && l.equipment === "flatbed" ? ops.flatbedSecureMinutes[1] : 0);
  const unloadDwell = (l: Load) => cfg.dwell.unloadMinutes[1] + (ops.enabled && l.equipment === "flatbed" ? ops.flatbedUntarpMinutes[1] : 0);
  // From the shipper's dock to the receiver: ready, open, loaded, driven; the deadline's moment at the receiver.
  const haul = (l: Load): { arrive: number; done: number } => {
    until(Math.max(t, l.readyT ?? t));
    until(dockOpen(l, "pickup"));
    stop(loadDwell(l));
    drive(l.routeHours * MINUTES_PER_HOUR, l.miles);
    const arrive = t;
    until(dockOpen(l, "delivery"));
    stop(unloadDwell(l));
    return { arrive, done: t };
  };
  const answer = (why: Reach["why"], freeT: number, freePlace: number, pickupT = t, deliverT = t): Reach => ({ ok: why === null, why, freeT, freePlace, pickupT, deliverT });

  // 1. Free of the job in hand.
  if (truck.status === "parked" || truck.status === "listed" || truck.status === "retired") return answer("busy", t, truck.place);
  if (truck.status !== "idle" && truck.nextLoadId !== undefined && truck.nextLoadId !== load.id) return answer("ahead", t, truck.place);
  if (truck.status === "repair") until(Math.max(t, truck.repairUntilT ?? t));
  stop(truck.breakdownMin + (truck.pauseMin ?? 0));
  let place = truck.place;
  const cur = truck.loadId !== null ? w.loads.get(truck.loadId) : undefined;
  if (truck.status === "repositioning") {
    legLeft();
    place = truck.targetPlace;
  } else if (cur) {
    if (truck.status === "toPickup") {
      legLeft();
      haul(cur);
    } else if (truck.status === "loading") {
      stop(truck.dwellMin);
      drive(cur.routeHours * MINUTES_PER_HOUR, cur.miles);
      until(dockOpen(cur, "delivery"));
      stop(unloadDwell(cur));
    } else if (truck.status === "loaded") {
      legLeft();
      until(dockOpen(cur, "delivery"));
      stop(unloadDwell(cur));
    } else if (truck.status === "unloading") {
      stop(truck.dwellMin);
    }
    place = cur.destPlace;
  }
  const freeT = t;

  // 2. To this load's shipper, before its pickup closes; then on to its receiver, by its deadline.
  if (place !== load.originPlace) leg(place, load.originPlace);
  const pickupT = t;
  if (load.latestPickupT !== undefined && pickupT > load.latestPickupT) return answer("pickup", freeT, place, pickupT, pickupT);
  const run = haul(load);
  const at = cfg.docks.lateFromArrival ? run.arrive : run.done;
  if (load.latestDeliveryT !== undefined && at > load.latestDeliveryT) return answer("delivery", freeT, place, pickupT, run.arrive);
  return answer(null, freeT, place, pickupT, run.arrive);
}

/** "Tue 09:00": a game minute as the engine's refusals say it (time.weekdayOfDay0 names day 0). */
export function whenLabel(w: World, t: number): string {
  const day = dayOf(t, w.cfg);
  const m = Math.floor(t) % w.cfg.time.gameMinutesPerDay;
  return `${DAY_NAMES[(day + w.cfg.time.weekdayOfDay0) % 7]} ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** canMake's refusal, with its figures: when and where the truck is free, when it gets there, and the time it misses. */
export function reachRefusal(w: World, load: Load, r: Reach): string {
  const place = (i: number) => w.net.places[i]!.name;
  if (r.why === "ahead") return "this truck already has its next load booked: release it first";
  if (r.why === "busy") return "this truck can't take a load now";
  const free = r.freeT > w.t ? `The truck is free ${whenLabel(w, r.freeT)} at ${place(r.freePlace)}` : `From ${place(r.freePlace)}, the truck`;
  const verb = r.freeT > w.t ? ": it" : "";
  if (r.why === "pickup") return `${free}${verb} reaches ${place(load.originPlace)} ${whenLabel(w, r.pickupT)}, after the pickup closes ${whenLabel(w, load.latestPickupT!)}`;
  return `${free}${verb} delivers at ${place(load.destPlace)} ${whenLabel(w, r.deliverT)}, after the ${whenLabel(w, load.latestDeliveryT!)} deadline`;
}

export type ClaimKind = "cancel" | "noshow" | "late";

/**
 * A claim on a carrier for a load it booked (the economy's sizes): `share` of the load's pay as booked (the rate on the
 * card, fuel and tolls in), from the carrier to whoever it took the load from: the company that re-posted it, else the
 * broker or the player shipper (a player poster's claims follow the same shares). NPC paper's goes to
 * sink:service_failure, and so does one between one owner's two sides (no untaxed transfer). Posted like any bill: it may
 * take the carrier under zero. Ref `claim:{kind}:{load id}`. Returns what it took.
 */
export function claimOn(w: World, carrier: Company, load: Load, share: number, kind: ClaimKind): number {
  const fd = share * load.clearedRate * load.miles;
  if (!(fd > 0.005)) return 0;
  const db = load.doubleBroker && load.doubleBroker.companyId !== carrier.id ? load.doubleBroker.companyId : null;
  const payeeId = db ?? load.brokerId ?? load.shipperId;
  const payee = payeeId !== null && payeeId !== carrier.id && !samePerson(w, carrier.id, payeeId) ? companyById(w, payeeId) : null;
  const ref = `claim:${kind}:${load.id}`;
  w.ledger.post(w.t, companyAccount(carrier.id), payee ? companyAccount(payee.id) : "sink:service_failure", fd, ref);
  carrier.operating.costFd += fd;
  if (payee) payee.operating.revenueFd += fd;
  const what = kind === "late" ? `delivered after its ${whenLabel(w, load.latestDeliveryT ?? w.t)} deadline` : kind === "noshow" ? "not picked up before its pickup closed" : "released before its pickup";
  w.listener?.({ kind: "notice", companyId: carrier.id, topic: "board", text: `Load #${load.id} ${what}: a ${fmtInt(fd)} FD claim${payee ? ` to ${payee.name}` : ""}.`, tone: "bad", truckId: load.truckId ?? undefined });
  if (payee) w.listener?.({ kind: "notice", companyId: payee.id, topic: "board", text: `Load #${load.id} ${what} by its carrier: ${fmtInt(fd)} FD paid to you as a claim.`, tone: "info" });
  return fd;
}

/** A load booked and never hauled marks the carrier's record (Company.failed), as a late delivery does, without counting as delivered. */
function markFailed(w: World, c: Company): void {
  c.failed = (c.failed ?? 0) + 1;
  const prior = w.cfg.reputation.priorLoads;
  c.reputation = (c.onTime + prior * w.cfg.reputation.start) / (c.delivered + c.failed + prior);
}

/**
 * release_load: the carrier drops a load booked ahead. The cancel claim (windows.cancelClaimShare: early, or in the urgency
 * rounds), the mark on its record, and the load back on the board as it stands (safety.ts reopenLoad), for anyone who can
 * still make it. Past its pickup's close it's a no-show instead.
 */
export function releaseLoad(w: World, company: Company, load: Load): string | null {
  if (load.status !== "assigned" || load.ahead !== true || load.carrierId !== company.id) return "only a load booked ahead can be released";
  if (pickupClosed(w, load)) {
    noShow(w, load);
    return null;
  }
  const k = w.cfg.windows!;
  claimOn(w, company, load, urgent(w, load) ? k.cancelClaimShare.urgent : k.cancelClaimShare.early, "cancel");
  markFailed(w, company);
  const truck = load.truckId !== null ? w.trucks[load.truckId - 1] : undefined;
  if (truck && truck.nextLoadId === load.id) delete truck.nextLoadId;
  delete load.ahead;
  reopenLoad(w, load);
  return null;
}

/**
 * A no-show: booked, and its truck not at the shipper when the pickup closed (the round's check, or a truck arriving
 * after it). The no-show claim, the mark on the record, and the load is lost as an unbooked one is (board.ts giveUp: the
 * broker's fall-off, counted): nobody can make a closed pickup. A truck heading for it runs on empty to the town; a load
 * booked ahead just leaves the truck's plan.
 */
export function noShow(w: World, load: Load): void {
  const carrier = load.carrierId !== null ? companyById(w, load.carrierId) : null;
  if (carrier) {
    claimOn(w, carrier, load, w.cfg.windows!.noShowClaimShare, "noshow");
    markFailed(w, carrier);
  }
  const truck = load.truckId !== null ? w.trucks[load.truckId - 1] : undefined;
  if (truck && truck.nextLoadId === load.id) delete truck.nextLoadId;
  else if (truck && truck.loadId === load.id) {
    truck.loadId = null;
    if (truck.status === "toPickup") {
      truck.status = "repositioning";
      truck.legKey = legKeyOf(w, truck);
    }
  }
  delete load.ahead;
  giveUp(w, load, true);
}
