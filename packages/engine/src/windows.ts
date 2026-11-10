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
import { EQUIPMENT, planIndex } from "./demand.js";
import { giveUp } from "./board.js";
import { samePerson } from "./brokerage.js";
import { fmtInt } from "./economics.js";
import { companyAccount } from "./ledger.js";
import { driverFatigue } from "./labor.js";
import { legalDrivingMin, reopenLoad } from "./safety.js";
import { cycleLimitMin, dutyResetAt, legKeyOf } from "./trips.js";
import type { Company, Load, Truck } from "./types.js";
import { companyById, crewed, placeHours, placeLegMiles, placeRoute, type World } from "./world.js";

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
export function canMake(w: World, truck: Truck, load: Load, free: Free = freeOf(w, truck)): Reach {
  if (free.why !== null) return { ok: false, why: free.why, freeT: free.run.t, freePlace: free.place, pickupT: free.run.t, deliverT: free.run.t };
  if (truck.status !== "idle" && truck.nextLoadId !== undefined && truck.nextLoadId !== load.id) return { ok: false, why: "ahead", freeT: free.run.t, freePlace: free.place, pickupT: free.run.t, deliverT: free.run.t };
  const r = free.run.copy();
  const freeT = r.t;
  const answer = (why: Reach["why"], pickupT: number, deliverT: number): Reach => ({ ok: why === null, why, freeT, freePlace: free.place, pickupT, deliverT });
  // To this load's shipper, before its pickup closes; then on to its receiver, by its deadline.
  if (free.place !== load.originPlace) r.leg(free.place, load.originPlace);
  const pickupT = r.t;
  // With windows.planMarginMinutes to spare at each (a plan that makes it by minutes is a coin toss).
  const margin = w.cfg.windows?.planMarginMinutes ?? 0;
  if (load.latestPickupT !== undefined && pickupT + margin > load.latestPickupT) return answer("pickup", pickupT, pickupT);
  const run = r.haul(load);
  const at = w.cfg.docks.lateFromArrival ? run.arrive : run.done;
  if (load.latestDeliveryT !== undefined && at + margin > load.latestDeliveryT) return answer("delivery", pickupT, run.arrive);
  return answer(null, pickupT, run.arrive);
}

/** A truck free of its job in hand: when (its run's clock) and where; `why` when it can't take loads at all. */
export interface Free {
  run: Run;
  place: number;
  why: "busy" | null;
}

/**
 * The truck's projected free time and place (canMake's first half, once per truck for the dispatcher, batch 3): here and now
 * when idle; else the rest of its job in hand (the leg, the wait for readyT and the docks, the dwell at its longest, the haul
 * and the unloading), an empty run's arrival, or the shop's end. Reads only.
 */
export function freeOf(w: World, truck: Truck): Free {
  const r = Run.start(w, truck);
  if (truck.status === "parked" || truck.status === "listed" || truck.status === "retired") return { run: r, place: truck.place, why: "busy" };
  if (truck.status === "repair") r.until(Math.max(r.t, truck.repairUntilT ?? r.t));
  r.stop(truck.breakdownMin + (truck.pauseMin ?? 0));
  let place = truck.place;
  const cur = truck.loadId !== null ? w.loads.get(truck.loadId) : undefined;
  if (truck.status === "repositioning") {
    r.legLeft(truck);
    place = truck.targetPlace;
  } else if (cur) {
    if (truck.status === "toPickup") {
      r.legLeft(truck);
      r.haul(cur);
    } else if (truck.status === "loading") {
      r.stop(truck.dwellMin);
      r.drive(cur.routeHours * MINUTES_PER_HOUR, cur.miles);
      r.receive(cur);
    } else if (truck.status === "loaded") {
      r.legLeft(truck);
      r.receive(cur);
    } else if (truck.status === "unloading") {
      r.stop(truck.dwellMin);
    }
    place = cur.destPlace;
  }
  return { run: r, place, why: null };
}

/**
 * canMake's clock: a truck's time and its legal driving hours left in the shift, run forward by stops and drives. The
 * route's hours at this driver's own pace (skill and fatigue, as safety.ts mphFor; never the company's speeding), within
 * the legal hours (a team's with a team), a rest of hos.restHours when they run out, R12's break once a shift past
 * breakAfterHours, the fuel stops; a stop as long as a rest gives the hours back. R12's weekly clock (hos.cycleHours): once
 * the week's hours run out, a restart of hos.restartHours, as trips.ts drivingMinutesLeft waits for one; a stop that long
 * restarts it. Docks by nextOpen and the appointment slot already set (no draw; a missed slot's wait at its longest).
 * windows.planMarginMinutes at the edges: a dock closing within it counts as closed, and a day that can't finish the drive
 * with that much of its hours to spare ends that much early (a truck stops at the last site within its hours, sites.ts
 * planNight). canMake asks the same margin to spare at the pickup and the deadline.
 */
export class Run {
  private constructor(
    private readonly w: World,
    private readonly limit: number,
    /** Driving minutes per route minute: this driver's pace. */
    private readonly pace: number,
    public t: number,
    private left: number,
    private shift: number,
    /** The weekly clock's driving minutes left, and a full week's (Infinity with the clock off). */
    private cycleLeft: number,
    private readonly cycleFull: number,
  ) {}

  /** From now: the day's hours left read without opening a new duty day (dutyResetAt), a fresh day once it has reset. */
  static start(w: World, truck: Truck): Run {
    const limit = legalDrivingMin(w, truck);
    const reset = dutyResetAt(w, truck);
    const fresh = reset === null || w.t >= reset;
    const skill = 1 + w.cfg.labor.driver.mphRange * (truck.driverSkill - 0.5);
    const tired = 1 - w.cfg.fatigue.paceLoss * driverFatigue(w, truck);
    const hos = w.cfg.hos;
    const cycleFull = hos.cycleHours > 0 ? cycleLimitMin(w, truck) : Infinity;
    const restarted = truck.cycleLastT !== undefined && w.t - truck.cycleLastT >= hos.restartHours * MINUTES_PER_HOUR;
    const cycleLeft = hos.cycleHours > 0 ? cycleFull - (restarted ? 0 : (truck.cycleMin ?? 0)) : Infinity;
    return new Run(w, limit, 1 / Math.max(0.5, skill * tired), w.t, fresh ? limit : Math.max(0, limit - truck.shiftDrivenMin), fresh ? 0 : truck.shiftDrivenMin, cycleLeft, cycleFull);
  }

  copy(): Run {
    return new Run(this.w, this.limit, this.pace, this.t, this.left, this.shift, this.cycleLeft, this.cycleFull);
  }

  private get restart(): number {
    return this.w.cfg.hos.restartHours * MINUTES_PER_HOUR;
  }

  private get rest(): number {
    const hos = this.w.cfg.hos;
    return (hos.restHours > 0 ? hos.restHours : hos.dutyDayHours - hos.drivingHoursPerDay) * MINUTES_PER_HOUR;
  }

  /** Standing still: a stop as long as a rest gives the hours back. */
  stop(min: number): void {
    if (!(min > 0)) return;
    this.t += min;
    if (min >= this.rest) {
      this.left = this.limit;
      this.shift = 0;
    }
    if (min >= this.restart) this.cycleLeft = this.cycleFull;
  }

  until(at: number): void {
    this.stop(at - this.t);
  }

  drive(min: number, mi: number): void {
    const hos = this.w.cfg.hos;
    const breakAfter = hos.breakAfterHours * MINUTES_PER_HOUR;
    let need = min * this.pace;
    while (need > 1e-9) {
      if (this.cycleLeft <= 1e-9) {
        // The week's hours are spent: a restart, which gives the day's hours back too.
        this.t += this.restart;
        this.cycleLeft = this.cycleFull;
        this.left = this.limit;
        this.shift = 0;
        continue;
      }
      if (this.left <= 1e-9) {
        this.t += this.rest;
        this.left = this.limit;
        this.shift = 0;
        continue;
      }
      let d = Math.min(need, this.left, this.cycleLeft);
      // The day ends before the drive does, or within the margin of its hours: the truck stops at a site short of them.
      const ends = need > this.left - this.margin + 1e-9;
      if (ends) d = Math.min(d, Math.max(0, this.left - this.margin));
      const breakDue = hos.breakMinutes > 0 && this.shift < breakAfter && this.shift + d > breakAfter;
      if (breakDue) d = breakAfter - this.shift;
      this.t += d;
      need -= d;
      this.left -= d;
      this.cycleLeft -= d;
      this.shift += d;
      if (breakDue) this.t += hos.breakMinutes;
      else if (ends) this.left = 0;
    }
    const fuel = this.w.cfg.fuel;
    if (fuel.stopEveryMi > 0) this.t += Math.floor(mi / fuel.stopEveryMi) * fuel.stopMinutes;
  }

  /** Place to place by road. */
  leg(a: number, b: number): void {
    this.drive(placeHours(this.w, a, b) * MINUTES_PER_HOUR, a === b ? 0 : placeLegMiles(this.w, a, b));
  }

  /** The rest of the truck's leg in hand, its grades included (roads.terrain, as trips.ts moveTrucks slows on them). */
  legLeft(truck: Truck): void {
    const r = placeRoute(this.w, truck.place, truck.targetPlace);
    const tr = this.w.cfg.roads.terrain;
    const roadMph = r && r.hours > 0 ? r.miles / r.hours : this.w.cfg.hos.avgMph;
    const grades = tr.enabled && truck.legMiles > 0 && truck.legMountainMi > 0 ? truck.legMiles / (truck.legMiles + truck.legMountainMi * (roadMph / tr.mountainMph - 1)) : 1;
    this.drive(((truck.remainingMi / roadMph) * MINUTES_PER_HOUR) / grades, truck.remainingMi);
  }

  /** At the receiver: its hours, the appointment slot already set (early: wait for it; missed: the next, at its longest), unloading. */
  receive(l: Load): void {
    this.until(this.dockOpen(l, "delivery"));
    const k = this.w.cfg.docks;
    if (k.enabled && l.slotT > 0) {
      const a = k.appointment;
      if (this.t < l.slotT - a.earlyMinutes) this.until(l.slotT - a.earlyMinutes);
      else if (this.t > l.slotT + a.graceMinutes) this.stop(a.nextSlotHours[1] * MINUTES_PER_HOUR);
    }
    this.stop(this.unloadDwell(l));
  }

  /** When the dock is open for this arrival: now, its next opening, or, closing within the margin, the opening after. */
  dockOpen(l: Load, end: "pickup" | "delivery"): number {
    const h = this.w.cfg.docks.enabled ? dockHoursAt(this.w, l, end) : null;
    if (!h) return this.t;
    const open = nextOpen(this.w, this.t, h);
    if (open > this.t) return open;
    const edge = this.t + this.margin;
    const after = nextOpen(this.w, edge, h);
    return after > edge ? after : this.t;
  }

  private get margin(): number {
    return this.w.cfg.windows?.planMarginMinutes ?? 0;
  }

  loadDwell(l: Load): number {
    const ops = this.w.cfg.equipmentOps;
    return this.w.cfg.dwell.loadMinutes[1] + (ops.enabled && l.equipment === "flatbed" ? ops.flatbedSecureMinutes[1] : 0);
  }

  unloadDwell(l: Load): number {
    const ops = this.w.cfg.equipmentOps;
    return this.w.cfg.dwell.unloadMinutes[1] + (ops.enabled && l.equipment === "flatbed" ? ops.flatbedUntarpMinutes[1] : 0);
  }

  /** From the shipper's dock to the receiver: ready, open, loaded, driven; the arrival, and when the unloading is done. */
  haul(l: Load): { arrive: number; done: number } {
    this.until(Math.max(this.t, l.readyT ?? this.t));
    this.until(this.dockOpen(l, "pickup"));
    this.stop(this.loadDwell(l));
    this.drive(l.routeHours * MINUTES_PER_HOUR, l.miles);
    const arrive = this.t;
    this.receive(l);
    return { arrive, done: this.t };
  }
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
export function releaseLoad(w: World, company: Company, load: Load, breakdown = false): string | null {
  if (load.status !== "assigned" || load.ahead !== true || load.carrierId !== company.id) return "only a load booked ahead can be released";
  if (pickupClosed(w, load)) {
    noShow(w, load);
    return null;
  }
  const k = w.cfg.windows!;
  // Batch 4: a release a breakdown forced (the dispatcher's at once, or the player's answer to the ask) is at the early
  // share, wherever the pickup stands (the director): the carrier reported it, as carriers do.
  const early = breakdown || load.releaseAsk !== undefined;
  claimOn(w, company, load, early || !urgent(w, load) ? k.cancelClaimShare.early : k.cancelClaimShare.urgent, "cancel");
  markFailed(w, company);
  const truck = load.truckId !== null ? w.trucks[load.truckId - 1] : undefined;
  if (truck && truck.nextLoadId === load.id) delete truck.nextLoadId;
  delete load.ahead;
  delete load.aheadByHand;
  delete load.releaseAsk;
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

// --- The dispatcher two deep (batch 3) ---------------------------------------------------------------------------

/**
 * How the dispatcher (standingOrders.ts bids, board.ts autoBook) plans a truck. Idle: as today, from here and now, with
 * canMake's projection only while windows are on (a windowed load must pass it, as by hand). On a job (windows on, nothing
 * booked ahead, crewed, free within windows.planAheadHours): `at` is the truck as it will stand when free (its place, its
 * market, idle from then), so the deadhead runs from the current receiver and the lookahead from there; it bids for and
 * books only what canMake passes, and the win is booked ahead (board.ts assign). Null: the dispatcher leaves the truck be.
 */
export interface Plan {
  at: Truck;
  free: Free | null;
  ahead: boolean;
  /** When the truck sets out for the pickup: now, or when it's free. */
  startT: number;
}

export function dispatchPlan(w: World, truck: Truck): Plan | null {
  if (truck.status === "idle") return { at: truck, free: windowsOn(w) ? freeOf(w, truck) : null, ahead: false, startT: w.t };
  if (!windowsOn(w) || !AHEAD_STATUSES.has(truck.status) || truck.nextLoadId !== undefined || !crewed(truck)) return null;
  const free = freeOf(w, truck);
  if (free.why !== null || free.run.t - w.t > w.cfg.windows!.planAheadHours * MINUTES_PER_HOUR) return null;
  const place = free.place;
  const hub = w.net.places[place]!.market;
  const at: Truck = { ...truck, status: "idle", loadId: null, place, targetPlace: place, hub, targetHub: hub, remainingMi: 0, idleSinceT: free.run.t };
  return { at, free, ahead: true, startT: free.run.t };
}

/** Whether a planned truck may take this load: always, unless windows are on and it's booked ahead or windowed (canMake). */
export function planMakes(w: World, truck: Truck, plan: Plan, load: Load): boolean {
  if (!plan.free || (!plan.ahead && load.latestPickupT === undefined)) return true;
  return canMake(w, truck, load, plan.free).ok;
}

/**
 * The open loads a planned truck reads at a hub, from the board index (standingOrders.ts indexOpenLoads): the freight ready
 * today, as today; a truck planned ahead also reads what will be ready by the day after it's free (its readyKey days),
 * which canMake then sorts.
 */
export function planLoads(w: World, plan: Plan, idx: Map<string, Load[]>, hub: number, eq: string, boardKey: (hub: number, eq: string) => string, readyKey: (hub: number, eq: string, day: number) => string): Load[] | undefined {
  const today = idx.get(boardKey(hub, eq));
  if (!plan.ahead) return today;
  const out = today ? [...today] : [];
  for (let d = dayOf(w.t, w.cfg) + 1; d <= dayOf(plan.startT, w.cfg) + 1; d++) out.push(...(idx.get(readyKey(hub, eq, d)) ?? []));
  return out;
}

// --- Batch 4: unserved demand, the same-day premium, release on a breakdown ----------------------------------------

/** NPC shippers' freight, the only kind the lost-load memory counts (the director): direct, or tendered to an AI broker. */
const npcFreight = (w: World, load: Load): boolean => {
  const kind = posterKind(w, load);
  return kind === "npc" || kind === "broker";
};

/** The lost-load memory brought to now: each hub-and-trailer count decayed by windows.lostMemoryHalfLifeDays. */
export function lostMemory(w: World): number[] | null {
  const m = w.lostMem;
  if (!m) return null;
  if (w.t > m.t) {
    const f = 0.5 ** ((w.t - m.t) / (w.cfg.windows!.lostMemoryHalfLifeDays * w.cfg.time.gameMinutesPerDay));
    for (let k = 0; k < m.v.length; k++) m.v[k] = m.v[k]! * f;
    m.t = w.t;
  }
  return m.v;
}

/** A load lost at its pickup's close (board.ts giveUp): NPC freight joins its hub's memory of unhauled demand. */
export function noteLost(w: World, load: Load): void {
  if (!npcFreight(w, load)) return;
  if (!w.lostMem) w.lostMem = { t: w.t, v: new Array<number>(w.net.hubs.length * EQUIPMENT.length).fill(0) };
  const v = lostMemory(w)!;
  v[planIndex(load.origin, EQUIPMENT.indexOf(load.equipment))]! += 1;
}

/**
 * The same-day premium at posting (freight.ts, NPC loads only): a load whose lead is 0 and that isn't hot pays
 * windows.sameDayPremium on its reference, and its ceiling, book-now and shipper rates follow, as the remote premium's do.
 * Returns the multiplier for a broker's contract (1 when none applies).
 */
export function sameDayMult(w: World, load: Load, leadDays: number): number {
  const p = w.cfg.windows!.sameDayPremium;
  if (leadDays !== 0 || load.hot > 0 || !(p > 1)) return 1;
  load.refRate *= p;
  load.ceiling *= p;
  load.bookNow = Math.min(load.ceiling, load.bookNow * p);
  load.shipperRate *= p;
  load.spotShipperRate *= p;
  load.sameDay = true;
  return p;
}

/** A company's dispatcher is on: it bids or books by standing order. */
const dispatcherOn = (c: Company): boolean => c.orders.some((o) => o.kind === "bid" || o.kind === "bookNow");

/**
 * Batch 4, release on a breakdown (the director's rule: nothing happens to a company the player did not set up). After a
 * breakdown, a truck's load booked ahead is checked again (canMake, the stop in its free time). If the truck can no longer
 * make it: a bot, or a player's dispatcher on a load it booked itself, releases it at once at the early share (the notice
 * says so, for the client's Needs-you report); a load the player booked by hand, or any load with the dispatcher off, waits
 * on the player (Load.releaseAsk: release_load at the early share, or keep_load), and unanswered the close makes it a
 * no-show at its share, as today.
 */
export function afterBreakdown(w: World, truck: Truck): void {
  const load = truck.nextLoadId !== undefined ? w.loads.get(truck.nextLoadId) : undefined;
  if (!load || load.status !== "assigned" || load.ahead !== true || load.releaseAsk) return;
  const r = canMake(w, truck, load);
  if (r.ok) return;
  const c = companyById(w, truck.companyId);
  const fd = w.cfg.windows!.cancelClaimShare.early * load.clearedRate * load.miles;
  const where = `${w.net.places[load.originPlace]!.name} by ${whenLabel(w, load.latestPickupT ?? w.t)}`;
  if (!c.human || (dispatcherOn(c) && !load.aheadByHand)) {
    const id = load.id;
    releaseLoad(w, c, load, true);
    w.listener?.({ kind: "notice", companyId: c.id, topic: "board", text: `Truck ${truck.id} broke down and can't reach ${where}: your dispatcher released load #${id}, a ${fmtInt(fd)} FD claim.`, tone: "bad", truckId: truck.id });
    return;
  }
  load.releaseAsk = { truckId: truck.id, fd, t: w.t };
  w.listener?.({ kind: "notice", companyId: c.id, topic: "board", text: `Truck ${truck.id}'s breakdown means it can't reach ${where}. Release load #${load.id} now (−${fmtInt(fd)} FD) or keep it.`, tone: "bad", truckId: truck.id });
}

/** keep_load: the player keeps a load booked ahead after a breakdown's ask; the close decides, as for any load. */
export function keepLoad(w: World, company: Company, load: Load): string | null {
  if (!load.releaseAsk || load.carrierId !== company.id) return "nothing to keep: no breakdown has asked about that load";
  delete load.releaseAsk;
  return null;
}
