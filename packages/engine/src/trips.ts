import { brokerageLog, samePerson } from "./brokerage.js";
import { commodityAttract, hubTheftRisk, stealCargo, truckLatLon } from "./risk.js";
import { securityTheftMult } from "./labor.js";
import { crewStrike } from "./robbery.js";
import { scaleDiscount } from "./scale.js";
import { endOfLife } from "./assets.js";
import { addTrailerMiles } from "./trailers.js";
import { COMMODITIES, dcos, dexp, greatCircleMiles, NO_TERRAIN, routeTerrain, type Route } from "@lanes/data";
import { deliveryWait, pickupWait, setSlot } from "./docks.js";
import { afterBreakdown, claimOn, noShow, windowsOn } from "./windows.js";
import { swapAtIdle } from "./dealer.js";
import { flatbedDamage, reeferUnit } from "./equipment.js";
import { winterNow } from "./safety.js";
import { payLegFuel, roadService, serviceBill } from "./businesses.js";
import { leaveParking, legMile, parkForTheNight, planNight, siteHere, siteInReach } from "./sites.js";
import { managerBreakdownMult, managerMaintenanceMult } from "./labor.js";
import { dayOf, MINUTES_PER_HOUR } from "./clock.js";
import { clamp, fuelPrice, tripCost, ownerDrawFd } from "./economics.js";
import { noteEmissionCommitment, npcPayKind } from "./emission.js";
import { settleDoubleBroker } from "./fraud.js";
import { chargeSettlement } from "./settlement.js";
import { bill, factoringLog } from "./receivables.js";
import { lockCost, stakeDiscount } from "./staking.js";
import { creditMiles, creditDriving, homeArrival } from "./labor.js";
import { companyAccount } from "./ledger.js";
import { closeDutyDay, drivingLimitMin, legalDrivingMin, mphFor, safetyTick } from "./safety.js";
import type { Company, Load, Receivable, Truck } from "./types.js";
import { breakdownsPer1000Mi } from "./wear.js";
import { companyById, crewed, hubRoute, type World, placeHours, placeLegMiles, placeMiles, placeOfHub, placeRoute } from "./world.js";

/** Detention (cfg.detention): the hours of a closed-dock wait past the free time, capped per stop, priced. */
function addDetention(w: World, load: Load, stop: "pickupH" | "deliveryH", waitMin: number): void {
  const k = w.cfg.detention;
  if (!k.enabled) return;
  const h = Math.min(k.maxHours, Math.max(0, Math.floor(waitMin / MINUTES_PER_HOUR - k.freeHours)));
  if (h <= 0) return;
  const d = (load.detention ??= { pickupH: 0, deliveryH: 0, fd: 0 });
  d[stop] += h;
  d.fd += h * k.fdPerHour;
}

/**
 * The poster pays the hauler its detention with the load (cfg.detention): an NPC shipper or an NPC broker from the
 * freight faucet its pay comes from, a player's brokerage or shipper from its own account.
 */
function payDetention(w: World, load: Load, carrier: Company): number {
  const fd = load.detention?.fd ?? 0;
  if (!w.cfg.detention.enabled || fd <= 0) return 0;
  const poster = load.brokerId !== null ? companyById(w, load.brokerId) : load.shipperId !== null ? companyById(w, load.shipperId) : null;
  if (poster && poster.id === carrier.id) return 0;
  const to = companyAccount(carrier.id);
  if (poster && poster.human) {
    w.ledger.post(w.t, companyAccount(poster.id), to, fd, `detention:${load.id}`);
    poster.operating.costFd += fd;
  } else {
    w.ledger.post(w.t, "faucet:npc_shipper", to, fd, `detention:${load.id}`);
    noteEmissionCommitment(w, fd, npcPayKind(load)); // the emission cap's draw (emission.ts)
  }
  return fd;
}

/** Truck is at the shipper: load for 1–2 hours (plus securing a flatbed, plus waiting for a closed dock to open), then roll. */
/**
 * A truck takes its load (board.ts assign's own arithmetic, kept here so a load booked ahead starts the same way when the
 * job in hand ends): the due time by the HOS schedule, the slot, and off to the pickup, or loading where it stands.
 */
export function startJob(w: World, truck: Truck, load: Load, deadheadMi: number): void {
  const { cfg } = w;
  // Due = the HOS schedule (11 driving hours, then off until the 24-hour duty day
  // resets) + worst-case loading and unloading + slack. A long breakdown makes it late.
  // A hot load's window assumes 15 driving hours a day and little slack: a solo driver makes it only on falsified logs.
  // Driving time follows the roads: interstates are quicker than two-lane highways.
  const perDay = load.hot > 0 ? cfg.safety.hotLoads.hoursPerDay : cfg.hos.drivingHoursPerDay;
  const drivingH = (deadheadMi > 0 ? placeHours(w, truck.place, load.originPlace) : 0) + load.routeHours;
  // Full rest days before the last driving day: a run of exactly one day's driving has none.
  const fullDays = Math.max(0, Math.ceil(drivingH / perDay) - 1);
  const transitMin = (fullDays * cfg.hos.dutyDayHours + (drivingH - fullDays * perDay)) * 60;
  const ops = cfg.equipmentOps;
  const dwellMin = cfg.dwell.loadMinutes[1] + cfg.dwell.unloadMinutes[1] + (ops.enabled && load.equipment === "flatbed" ? ops.flatbedSecureMinutes[1] + ops.flatbedUntarpMinutes[1] : 0);
  // Delivery windows: a truck at the shipper before the load is ready waits for it (startLoading), so the schedule
  // counts from then.
  const start = load.readyT !== undefined ? Math.max(w.t, load.readyT - (deadheadMi > 0 ? placeHours(w, truck.place, load.originPlace) * 60 : 0)) : w.t;
  // Due by the HOS schedule, and never after the shipper's appointment.
  load.dueT = Math.min(load.appointmentT, start + transitMin + dwellMin + (load.hot > 0 ? cfg.safety.hotLoads.slackMinutes : cfg.freight.deliverySlackMinutes));
  // Appointment freight (docks.ts): a delivery slot on the hour after the arrival estimate, due at its grace.
  setSlot(w, load, start + transitMin + dwellMin);
  if (load.latestDeliveryT !== undefined) load.dueT = Math.min(load.dueT, load.latestDeliveryT);
  truck.loadId = load.id;
  truck.idleRounds = 0;
  if (deadheadMi === 0) {
    startLoading(w, truck, load);
  } else {
    truck.status = "toPickup";
    truck.targetHub = load.origin;
    truck.targetPlace = load.originPlace;
    truck.remainingMi = placeLegMiles(w, truck.place, load.originPlace); // the bid's estimate, now the road's own figure
  }
}

/**
 * Delivery windows (batch 2): the job in hand is over, so the load booked ahead becomes the truck's (its pickup, or loading
 * here, waiting for it to be ready). Gone, or the truck with no crew: nothing starts, and a load left assigned is the
 * round's no-show. True when a job started.
 */
export function takeNextLoad(w: World, truck: Truck): boolean {
  const id = truck.nextLoadId;
  if (id === undefined) return false;
  delete truck.nextLoadId;
  const load = w.loads.get(id);
  if (!load || load.status !== "assigned" || load.truckId !== truck.id || !crewed(truck)) return false;
  delete load.ahead;
  delete load.aheadByHand;
  delete load.releaseAsk; // the truck made it to the job after all: nothing left to decide
  startJob(w, truck, load, placeMiles(w, truck.place, load.originPlace));
  return true;
}

export function startLoading(w: World, truck: Truck, load: Load, now: number = w.t): void {
  const [lo, hi] = w.cfg.dwell.loadMinutes;
  truck.status = "loading";
  truck.hub = load.origin;
  truck.targetHub = load.dest;
  truck.place = load.originPlace;
  truck.targetPlace = load.destPlace;
  truck.remainingMi = load.miles;
  let dwell = w.rng.ops.int(lo, hi);
  const ops = w.cfg.equipmentOps;
  if (ops.enabled && load.equipment === "flatbed") dwell += w.rng.ops.int(ops.flatbedSecureMinutes[0], ops.flatbedSecureMinutes[1]); // chains, straps and tarps
  // Delivery windows (windows.ts): at the shipper before the load is ready, the truck waits for it. Dwell, not detention, and
  // the due time already counts from it (board.ts assign).
  const early = load.readyT !== undefined && load.readyT > now ? load.readyT - now : 0;
  dwell += early;
  // A first-come shipper outside its hours (docks.ts): the wait moves the due time.
  const wait = pickupWait(w, load, now + early);
  if (wait > 0) {
    dwell += wait;
    load.dueT += wait;
    if (load.latestDeliveryT !== undefined) load.dueT = Math.min(load.dueT, load.latestDeliveryT); // inside the window
    w.metrics.onDockWait(wait);
    addDetention(w, load, "pickupH", wait);
  }
  truck.dwellMin = dwell;
  load.status = "inTransit";
}

/** At the receiver: unload for 1–2 hours (plus untarping a flatbed, plus any wait at the gate: a closed dock, an early or a missed slot). */
function startUnloading(w: World, truck: Truck, now: number): void {
  const [lo, hi] = w.cfg.dwell.unloadMinutes;
  const load = truck.loadId !== null ? w.loads.get(truck.loadId) : undefined;
  let dwell = w.rng.ops.int(lo, hi);
  const ops = w.cfg.equipmentOps;
  if (load && ops.enabled && load.equipment === "flatbed") dwell += w.rng.ops.int(ops.flatbedUntarpMinutes[0], ops.flatbedUntarpMinutes[1]);
  if (load) {
    load.arrivedT = now;
    const d = deliveryWait(w, load, now);
    if (d.receiversHours) addDetention(w, load, "deliveryH", d.minutes);
    if (d.minutes > 0) {
      dwell += d.minutes;
      if (d.receiversHours) load.dueT += d.minutes; // the receiver's hours aren't the carrier's fault; a missed slot is
      w.metrics.onDockWait(d.minutes);
      if (d.missed) w.metrics.onMissedSlot();
      // A loaded reefer's unit keeps running at the gate.
      if (ops.enabled && truck.trailer === "reefer" && truck.companyId) reeferUnit(w, companyById(w, truck.companyId), d.minutes, `dock:${truck.id}`);
      // Waiting out a night at a closed dock (theft.dockWaits): in the open near the gate, at the receiver's risk.
      if (dockWaitTheft(w, truck, load, d.minutes)) return;
    }
  }
  truck.status = "unloading";
  truck.dwellMin = dwell;
}

/** Each night a loaded truck waits at a closed dock, the corridor's thieves (and a hired crew) may come; true when the load is gone. */
export function dockWaitTheft(w: World, truck: Truck, load: Load, minutes: number): boolean {
  const k = w.cfg.theft;
  if (!k.enabled || !k.dockWaits || !truck.companyId || minutes < 6 * MINUTES_PER_HOUR) return false;
  const c = companyById(w, truck.companyId);
  const risk = hubTheftRisk(w, truck.hub);
  const nights = Math.max(1, Math.round(minutes / (24 * MINUTES_PER_HOUR)));
  for (let n = 0; n < nights; n++) {
    if (w.rng.ops.next() < k.oddsPerLoadedNight * risk * k.dockWaitParking * commodityAttract(w.cfg, load.commodity) * securityTheftMult(w, c)) {
      stealCargo(w, truck, c, load);
      return true;
    }
    if (w.cfg.robbery.enabled) {
      crewStrike(w, truck, c, "restArea", risk);
      if (truck.loadId === null || truck.status === "retired") return true;
    }
  }
  return false;
}

/**
 * Driving minutes a truck has left in its current duty day; opens a new day if
 * the last one ended (closing the old one's log). The limit is 11 hours, 22 for a
 * team, or 15 on falsified logs if the company runs that way (safety.ts).
 */
export function drivingMinutesLeft(w: World, truck: Truck, now: number): number {
  const { hos } = w.cfg;
  // R12's weekly clock: a restart (restartHours off duty in a row) gives the cycle back.
  if (hos.cycleHours > 0 && truck.cycleLastT !== undefined && now - truck.cycleLastT >= hos.restartHours * MINUTES_PER_HOUR) truck.cycleMin = 0;
  const resetAt = dutyResetAt(w, truck);
  if (resetAt === null || now >= resetAt) {
    closeDutyDay(w, truck);
    truck.shiftStartT = now;
    truck.shiftDrivenMin = 0;
    delete truck.turnedToday; // a new duty day: a turn made in the last one no longer counts
    if (hos.restHours > 0) truck.offDutySinceT = now;
  }
  const limit = truck.companyId ? drivingLimitMin(w, truck, companyById(w, truck.companyId)) : hos.drivingHoursPerDay * MINUTES_PER_HOUR;
  const left = limit - truck.shiftDrivenMin;
  // The weekly clock binds a legal log; a falsified one drives through it (and the day goes on the hidden log, below).
  if (hos.cycleHours > 0 && truck.companyId && limit <= legalDrivingMin(w, truck)) return Math.min(left, cycleLimitMin(w, truck) - (truck.cycleMin ?? 0));
  return left;
}

/** R12: the weekly clock's driving minutes, 70 hours a driver (a team truck has two). */
export const cycleLimitMin = (w: World, t: Truck): number => w.cfg.hos.cycleHours * MINUTES_PER_HOUR * (t.coDriverId ? 2 : 1);

/**
 * When the truck's driving hours come back (R12): with `hos.restHours` on, after that many hours off duty since it last
 * drove (never mid-drive, so no shift runs past its hours across a reset); at 0, 24 hours after the duty day opened, as
 * before. Null before the first duty day. Pure, so the screen reads the same arithmetic.
 */
export function dutyResetAt(w: World, truck: Truck): number | null {
  if (truck.shiftStartT === null) return null;
  const { hos } = w.cfg;
  if (hos.restHours > 0) return Math.max(truck.offDutySinceT ?? truck.shiftStartT, truck.shiftStartT) + hos.restHours * MINUTES_PER_HOUR;
  return truck.shiftStartT + hos.dutyDayHours * MINUTES_PER_HOUR;
}

/** Identifies a leg (from, to, loaded or not), so a truck knows when it starts a new one and which weigh stations are ahead. */
export const legKeyOf = (w: World, t: Truck) => (t.place * w.net.places.length + t.targetPlace) * 4 + (t.status === "loaded" ? 1 : t.status === "toPickup" ? 2 : 3);
const legKey = legKeyOf;

/**
 * Advances every working truck one in-game hour (§Summary — hours of service).
 * A truck gets 11 driving hours per 24-hour duty day, which opens the first time
 * it rolls and resets automatically 24 hours later: about 550 miles per day at
 * 50 mph. Loading and unloading take 1–2 hours each, on duty but not driving.
 * Within the hour, the truck can finish one activity and start the next.
 *
 * Every driven mile adds wear, and wear raises the odds of a breakdown
 * (§Events — breakdown): the truck stops 6–18 hours and, if owned, pays a tow
 * and repair bill. Trucks in the shop for a rebuild sit out until it's done.
 */
export function moveTrucks(w: World): void {
  const { cfg } = w;
  for (const truck of w.trucks) {
    if (truck.status === "retired" || truck.status === "listed") continue;
    // Assets: a truck standing at a hub meets the end of its life (or its trailer's) there.
    if (cfg.assets.enabled && truck.status === "idle" && truck.companyId && truck.lease === "owned") {
      endOfLife(w, companyById(w, truck.companyId), truck);
      if ((truck.status as Truck["status"]) === "retired") continue; // scrapped just now
    }
    // The morning after a night at a site: the space is free once the duty day has reset (sites.ts).
    if (truck.restSite && drivingMinutesLeft(w, truck, w.t) > 1e-9) leaveParking(w, truck);
    let budget = MINUTES_PER_HOUR;
    while (budget > 1e-9 && truck.status !== "idle") {
      const now = w.t + (MINUTES_PER_HOUR - budget);

      if (truck.status === "parked") break;
      if (truck.status === "repair") {
        if (now >= truck.repairUntilT!) {
          truck.status = "idle";
          truck.repairUntilT = null;
          truck.idleRounds = 0;
          truck.idleSinceDay = dayOf(w.t, cfg);
          truck.idleSinceT = w.t;
          if (truck.nextLoadId !== undefined) takeNextLoad(w, truck); // delivery windows: the load booked ahead
        }
        break;
      }

      if (truck.status === "loading" || truck.status === "unloading") {
        const d = Math.min(budget, truck.dwellMin);
        truck.dwellMin -= d;
        budget -= d;
        if (truck.dwellMin > 1e-9) break;
        truck.dwellMin = 0;
        if (truck.status === "loading") truck.status = "loaded";
        else deliver(w, truck, now + d);
        continue;
      }

      if (truck.breakdownMin > 1e-9) {
        const d = Math.min(budget, truck.breakdownMin);
        truck.breakdownMin -= d;
        budget -= d;
        continue;
      }
      // R12: a break or a fuel stop, on duty and not driving.
      if ((truck.pauseMin ?? 0) > 1e-9) {
        const d = Math.min(budget, truck.pauseMin!);
        truck.pauseMin! -= d;
        budget -= d;
        continue;
      }
      if (truck.remainingMi <= 1e-6) {
        arrive(w, truck, now);
        continue;
      }

      const hosLeft = drivingMinutesLeft(w, truck, now);
      if (hosLeft <= 1e-9) {
        // Off duty until the duty day resets; if that's within this hour, roll on from there.
        const resetAt = dutyResetAt(w, truck)!;
        const hourEnd = w.t + MINUTES_PER_HOUR;
        if (resetAt >= hourEnd) {
          // businesses.parking.stopInTown: the town it chose to sleep in (below), a legal stop.
          if (truck.townNight) {
            delete truck.townNight;
            parkForTheNight(w, truck, null, true);
            break;
          }
          // The night: at the site the truck stands at (a rest area or a truck stop), else on the shoulder (sites.ts).
          const r = placeRoute(w, truck.place, truck.targetPlace);
          const here = r ? siteHere(w, r, legMile(truck)) : null;
          if (here && !(here.parked < here.spaces)) w.metrics.onFull();
          // A truck already in a space here keeps it (R12's restart runs several duty days without a drive).
          const site = here && (here.parked < here.spaces || truck.restSite === here.id) ? here : null;
          // businesses.parking.stopInTownMidLeg: no site, mid-leg, a company that chose the town: the night in a town.
          if (!site && cfg.businesses.enabled && cfg.businesses.parking.stopInTown && cfg.businesses.parking.stopInTownMidLeg && truck.companyId && legMile(truck) > 1e-6 && companyById(w, truck.companyId).nightStop === "town") {
            nightInTown(w, truck);
            parkForTheNight(w, truck, null, true);
            break;
          }
          parkForTheNight(w, truck, site);
          break;
        }
        budget = hourEnd - resetAt;
        continue;
      }
      const key = legKey(w, truck);
      if (truck.legKey !== key) {
        truck.legKey = key;
        beginLeg(w, truck, placeRoute(w, truck.place, truck.targetPlace));
      }
      // businesses.parking.stopInTown: a company that chose the town doesn't set out, at a leg's start, on a run its hours
      // left can't finish with no site with room in reach: it sleeps here, the duty day closed now. With a full day's
      // hours it always sets out, so it never waits in a town for good. Only a leg the truck began idle at this town: one
      // a turn began this duty day (turnTruck's mile 0) drives on to a site or the shoulder (the red team, 0.24.1).
      if (cfg.businesses.parking.stopInTown && cfg.businesses.enabled && truck.companyId && legMile(truck) <= 1e-6 && companyById(w, truck.companyId).nightStop === "town" && !truck.turnedToday) {
        const fullDay = drivingLimitMin(w, truck, companyById(w, truck.companyId));
        const leg = placeRoute(w, truck.place, truck.targetPlace);
        const reachMi = (hosLeft / MINUTES_PER_HOUR) * (leg && leg.hours > 0 ? leg.miles / leg.hours : cfg.hos.avgMph);
        if (leg && hosLeft < fullDay - 1e-6 && truck.remainingMi > reachMi && !siteInReach(w, leg, 0, reachMi)) {
          truck.townNight = true;
          // The day's hours spent, as planNight's early stop spends them (below): no rule bills, pays, logs or tires on
          // these minutes (the weekly clock, the driver's pay and fatigue count driven minutes, the false log and the
          // fines read overMin, and the day reopens at zero before the truck drives). The full limit, not += hosLeft:
          // with the weekly clock binding, hosLeft is the cycle's remainder and the loop would come back here once per
          // remainder.
          truck.shiftDrivenMin = fullDay;
          if (cfg.hos.restHours > 0) truck.offDutySinceT = now;
          continue;
        }
      }
      // Driving on: a night in town chosen earlier and not slept (its duty day reset within the hour) no longer stands.
      if (truck.townNight) delete truck.townNight;
      // The road sets the pace: the route's miles over its hours, then the driver and the company's speed policy,
      // then the grades (roads.terrain): the leg's mountain miles run at the mountain speed.
      const route = placeRoute(w, truck.place, truck.targetPlace);
      const roadMph = route && route.hours > 0 ? route.miles / route.hours : cfg.hos.avgMph;
      const tr = cfg.roads.terrain;
      const grades = tr.enabled && truck.legMiles > 0 && truck.legMountainMi > 0 ? truck.legMiles / (truck.legMiles + truck.legMountainMi * (roadMph / tr.mountainMph - 1)) : 1;
      const mph = (truck.companyId ? mphFor(w, truck, companyById(w, truck.companyId), roadMph) : roadMph) * grades;
      let minutes = Math.min(budget, hosLeft, (truck.remainingMi / mph) * MINUTES_PER_HOUR);
      // R12: the break comes due after breakAfterHours of driving in the shift, a fuel stop every stopEveryMi; drive to it.
      const breakAfter = cfg.hos.breakAfterHours * MINUTES_PER_HOUR;
      const breakDue = cfg.hos.breakMinutes > 0 && truck.breakShiftT !== truck.shiftStartT && truck.shiftDrivenMin < breakAfter;
      if (breakDue) minutes = Math.min(minutes, breakAfter - truck.shiftDrivenMin);
      if (cfg.fuel.stopEveryMi > 0) minutes = Math.min(minutes, (Math.max(0, cfg.fuel.stopEveryMi - (truck.fuelMi ?? 0)) / mph) * MINUTES_PER_HOUR);
      let miles = Math.min(truck.remainingMi, (mph * minutes) / MINUTES_PER_HOUR);
      // The night ahead (sites.ts planNight): stop at the last site with room the hours still reach, early
      // if the next one is beyond them, and call the day done there.
      const stopAt = route ? planNight(w, truck, route, legMile(truck), (hosLeft / MINUTES_PER_HOUR) * mph, miles) : null;
      let dayDone = false;
      if (stopAt !== null) {
        miles = Math.max(0, Math.min(miles, stopAt - legMile(truck)));
        minutes = Math.min(minutes, (miles / mph) * MINUTES_PER_HOUR);
        dayDone = true;
      }
      const limit = truck.shiftDrivenMin + hosLeft;
      truck.remainingMi -= miles;
      truck.shiftDrivenMin += minutes;
      if (cfg.hos.restHours > 0 && minutes > 0) truck.offDutySinceT = now + minutes;
      if (cfg.hos.breakMinutes > 0 && truck.breakShiftT !== truck.shiftStartT && truck.shiftDrivenMin >= breakAfter - 1e-6 && !dayDone && truck.remainingMi > 1e-6) {
        truck.breakShiftT = truck.shiftStartT!;
        truck.pauseMin = (truck.pauseMin ?? 0) + cfg.hos.breakMinutes;
      }
      if (cfg.fuel.stopEveryMi > 0) {
        truck.fuelMi = (truck.fuelMi ?? 0) + miles;
        if (truck.fuelMi >= cfg.fuel.stopEveryMi - 1e-6) {
          truck.fuelMi = 0;
          truck.pauseMin = (truck.pauseMin ?? 0) + cfg.fuel.stopMinutes;
        }
      }
      if (dayDone) truck.shiftDrivenMin = limit; // the hours are spent: the next pass through the loop parks
      creditDriving(w, truck, minutes);
      truck.overMin = Math.max(0, truck.shiftDrivenMin - legalDrivingMin(w, truck));
      if (cfg.hos.cycleHours > 0 && minutes > 0) {
        truck.cycleMin = (truck.cycleMin ?? 0) + minutes;
        truck.cycleLastT = now + minutes;
        if (truck.cycleMin > cycleLimitMin(w, truck)) truck.overMin = Math.max(truck.overMin, minutes); // past the weekly clock: a falsified log day
      }
      budget -= minutes;
      if (truck.status === "loaded") truck.loadedMi += miles;
      else truck.emptyMi += miles;
      truck.odometer += miles;
      if (truck.lease === "owned") truck.milesSinceRebuild += miles;
      if (truck.trailerId) addTrailerMiles(w, truck, miles); // assets: the trailer wears with its own miles
      creditMiles(w, truck, miles);
      if (miles > 0 && w.rng.ops.next() < (breakdownsPer1000Mi(cfg, truck) * managerBreakdownMult(w, companyById(w, truck.companyId)) * terrainBreakdownMult(w, truck) * miles) / 1000) breakDown(w, truck);
      if (truck.remainingMi <= 1e-6) truck.remainingMi = 0;
      // Enforcement and crashes (safety.ts): a crash ends the truck's hour; an out-of-service order stops it.
      if (miles > 0 && safetyTick(w, truck, miles, truck.legMiles > 0 ? 1 - truck.remainingMi / truck.legMiles : 1) === "crash") break;
    }
  }
}

/**
 * A new leg: its length, tolls, highway share and terrain (roads.terrain) are read off the route; in
 * winter a leg over a pass may be held by a closure (a chain law) for a few hours before it moves.
 */
export function beginLeg(w: World, truck: Truck, route: Route | null): void {
  const { cfg } = w;
  truck.legMiles = truck.remainingMi;
  truck.nextStation = 0;
  // The tolls still ahead: all of them on a fresh leg, the remaining share when a leg restarts midway (a theft, a reroute).
  truck.legTollFd = route && route.miles > 0 ? route.tollFd * Math.min(1, truck.remainingMi / route.miles) : 0;
  truck.legHighwayShare = route && route.miles > 0 ? route.highwayMi / route.miles : 0;
  const tr = cfg.roads.terrain;
  const t = tr.enabled && route ? routeTerrain(w.net.roads, route, tr) : NO_TERRAIN;
  truck.legClimbM = t.climbM;
  truck.legMountainMi = t.mountainMi;
  truck.legPassMi = t.passMi;
  if (tr.enabled && t.passMi > 0 && winterNow(w) && w.rng.ops.next() < 1 - dexp(-tr.closureOddsPerPassMi * t.passMi)) {
    const hours = w.rng.ops.int(tr.closureHours[0], tr.closureHours[1]);
    truck.breakdownMin += hours * MINUTES_PER_HOUR;
    w.metrics.onPassClosure();
    if (truck.companyId) w.listener?.({ kind: "notice", companyId: truck.companyId, topic: "safety", text: `Truck ${truck.id}: the pass is closed by weather — chain law, about ${hours} hours.`, tone: "bad", truckId: truck.id });
  }
}

/** Breakdown odds on grades (roads.terrain): the share of the leg on mountain grades lifts them. */
function terrainBreakdownMult(w: World, truck: Truck): number {
  const tr = w.cfg.roads.terrain;
  return tr.enabled && truck.legMiles > 0 ? 1 + tr.breakdownPerMountainShare * (truck.legMountainMi / truck.legMiles) : 1;
}

function arrive(w: World, truck: Truck, now: number): void {
  truck.remainingMi = 0;
  if (truck.status === "toPickup") {
    const load = w.loads.get(truck.loadId!)!;
    // Delivery windows (batch 2): at the shipper after its pickup closed, it's a no-show; the truck stands there empty.
    if (load.latestPickupT !== undefined && now > load.latestPickupT && windowsOn(w)) {
      noShow(w, load);
      arriveEmpty(w, truck);
      return;
    }
    startLoading(w, truck, load, now);
  }
  else if (truck.status === "loaded") startUnloading(w, truck, now);
  else arriveEmpty(w, truck);
}

function breakDown(w: World, truck: Truck): void {
  const { breakdowns } = w.cfg;
  truck.breakdownMin = w.rng.ops.int(breakdowns.delayHours[0], breakdowns.delayHours[1]) * MINUTES_PER_HOUR;
  // Major repairs on an NPC lease are the lessor's (§Owned vs. leased).
  let bill = 0;
  if (truck.lease === "owned") {
    bill = w.rng.ops.int(breakdowns.repairFd[0], breakdowns.repairFd[1]);
    const company = companyById(w, truck.companyId);
    // Road service (businesses.ts): the nearest shop within reach comes out, or NPC road service; the drive out adds to the delay.
    const service = roadService(w, truck, company, bill);
    company.operating.costFd += service.paid;
    truck.breakdownMin += service.delayMin;
  }
  w.listener?.({ kind: "breakdown", companyId: truck.companyId, truckId: truck.id, repairFd: bill });
  w.metrics.onBreakdown();
  // Delivery windows, batch 4: a breakdown that breaks the plan for the load booked ahead (windows.ts afterBreakdown).
  if (truck.nextLoadId !== undefined && windowsOn(w)) afterBreakdown(w, truck);
}

function setIdle(w: World, truck: Truck): void {
  truck.status = "idle";
  truck.hub = truck.targetHub;
  truck.place = truck.targetPlace;
  truck.loadId = null;
  truck.idleRounds = 0;
  delete truck.turnedToday;
  truck.idleSinceDay = dayOf(w.t, w.cfg);
  truck.idleSinceT = w.t;
  truck.emptyMi = 0;
  truck.loadedMi = 0;
  truck.legKey = -1;
  // assets.swapAtNextIdle: a due truck ordered to replace this lease takes over now, before anything books it (dealer.ts).
  swapAtIdle(w, truck);
  // Delivery windows: the load booked ahead comes first; home time and a queued run home wait for the job after it.
  if (truck.nextLoadId !== undefined && takeNextLoad(w, truck)) return;
  homeArrival(w, truck);
  // labor.sendHomeToWork: the job in hand is done, so home to work now, no days off (unless the crew is going home for
  // days off anyway, which the home-time rules see to).
  if (truck.homeAfter === "work") {
    delete truck.homeAfter;
    const c = truck.companyId ? companyById(w, truck.companyId) : null;
    const resting = [truck.driverId, truck.coDriverId].some((id) => id > 0 && w.staff[id - 1]!.wantsHome);
    if (c && crewed(truck) && !resting && truck.hub !== c.homeHub) startEmptyRun(w, truck, c.homeHub);
  }
}

/** An empty run to a hub's place from where the truck stands (reposition_truck's, send_home's). */
export function startEmptyRun(w: World, truck: Truck, hub: number): void {
  truck.status = "repositioning";
  truck.targetHub = hub;
  truck.targetPlace = placeOfHub(hub);
  truck.remainingMi = placeLegMiles(w, truck.place, truck.targetPlace);
  truck.idleRounds = 0;
}

/**
 * businesses.parking.stopInTownMidLeg (option 1, the producer 2026-11-13): the night mid-leg in the town nearest the
 * truck's point, as a turn finds it (the nearest place, and the road miles to it at 1.2 × the great circle). When that
 * town lies ahead (nearer the leg's end than the truck), it's beyond the day's hours, so the nearest town not ahead of the
 * truck. The miles there and back count as driven: the leg's miles grow by both, so the trip settles them like any other
 * (fuel, pay, wear) and the truck resumes from the same point.
 */
export function nightInTown(w: World, truck: Truck): { place: number; offMi: number } {
  const [lat, lon] = truckLatLon(w, truck);
  const cosLat = dcos((lat * Math.PI) / 180);
  const sq = (p: { lat: number; lon: number }) => {
    const dy = p.lat - lat;
    const dx = (p.lon - lon) * cosLat;
    return dy * dy + dx * dx;
  };
  const end = w.net.places[truck.targetPlace]!;
  const toEnd = (p: { lat: number; lon: number }) => {
    const dy = p.lat - end.lat;
    const dx = (p.lon - end.lon) * cosLat;
    return dy * dy + dx * dx;
  };
  const mine = toEnd({ lat, lon });
  let best = -1;
  let bd = Infinity;
  let short = -1;
  let sd = Infinity;
  w.net.places.forEach((p, i) => {
    const d = sq(p);
    if (d < bd) {
      bd = d;
      best = i;
    }
    if (toEnd(p) >= mine && d < sd) {
      sd = d;
      short = i;
    }
  });
  const pick = toEnd(w.net.places[best]!) >= mine || short < 0 ? best : short;
  const offMi = Math.round(greatCircleMiles({ lat, lon }, w.net.places[pick]!) * 1.2);
  // There and back: the leg is that much longer, on the trip's own settlement.
  truck.remainingMi += 2 * offMi;
  truck.legMiles += 2 * offMi;
  return { place: pick, offMi };
}

/**
 * labor.turnWhileEmpty: a truck running empty turns for another hub from where it is now. It pays for the miles so far
 * (as a run's end does), stands at the town nearest its point on the leg (risk.ts truckLatLon) plus the miles to it,
 * and starts the new run from there.
 */
export function turnTruck(w: World, truck: Truck, hub: number): void {
  const [lat, lon] = truckLatLon(w, truck);
  let best = truck.place;
  let bd = Infinity;
  const cosLat = dcos((lat * Math.PI) / 180); // dcos and products, not Math.cos and **: each engine has its own (data/dmath.ts)
  w.net.places.forEach((p, i) => {
    const dy = p.lat - lat;
    const dx = (p.lon - lon) * cosLat;
    const d = dy * dy + dx * dx;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  const off = Math.round(greatCircleMiles({ lat, lon }, w.net.places[best]!) * 1.2);
  companyById(w, truck.companyId).operating.costFd += payTripCosts(w, truck, `turn:${truck.id}`);
  truck.place = best;
  truck.hub = w.net.places[best]!.market;
  // businesses.parking.stopInTown: this leg began at a turn, so tonight's town rule doesn't apply to it (moveTrucks).
  if (w.cfg.businesses.parking.stopInTown) truck.turnedToday = true;
  startEmptyRun(w, truck, hub);
  truck.remainingMi += off;
  truck.legMiles = truck.remainingMi;
  truck.legKey = -1;
}

/** Pays operating costs for the miles driven since the last settlement. Returns their total. */
export function payTripCosts(w: World, truck: Truck, ref: string): number {
  const acct = companyAccount(truck.companyId);
  const driven = truck.emptyMi + truck.loadedMi;
  const price = fuelPrice(w);
  const c = tripCost(w.cfg, truck, price, driven, truck.loadedMi);
  // The climb (roads.terrain): gallons for the meters climbed on this leg, the share these miles are of it.
  const tr = w.cfg.roads.terrain;
  // Weight (equipmentOps): a loaded trailer climbs harder than an empty one.
  const ops = w.cfg.equipmentOps;
  const loadedShare = driven > 0 ? truck.loadedMi / driven : 0;
  const weight = ops.enabled ? loadedShare * ops.loadedClimbMult + (1 - loadedShare) * ops.emptyClimbMult : 1;
  const climbGal = tr.enabled && truck.legMiles > 0 ? tr.fuelGalPerClimbM * truck.legClimbM * Math.min(1, driven / truck.legMiles) * weight : 0;
  // Tolls come due with the miles: the share of the leg's tolls these miles cover.
  const tolls = truck.legMiles > 0 ? Math.min(truck.legTollFd, truck.legTollFd * (driven / truck.legMiles)) : 0;
  truck.legTollFd -= tolls;
  truck.emptyMi = 0;
  truck.loadedMi = 0;
  // Locked FD earns its discount on fuel and maintenance (staking.ts); wages and tolls are what they are.
  const company = companyById(w, truck.companyId);
  const keep = 1 - stakeDiscount(w, company);
  company.fuelGalMonth += c.gallons + climbGal; // taxed at the month's close (fuelTax.ts)
  // Fuel at the hub's player station if there is one (businesses.ts), else the pump; maintenance at
  // the hub's shop or the NPC shop, leaner with a maintenance manager (labor.ts).
  // A big fleet buys fuel at a fleet discount (scale.ts).
  const fuel = lockCost(w, company, (c.fuel + climbGal * price) * (1 - scaleDiscount(w, company)), () => (c.fuel + climbGal * price) * keep * (1 - scaleDiscount(w, company)));
  payLegFuel(w, company, truck, fuel, driven, ref); // the block rule: the origin, then the truck stops the leg passes
  // The owner's draw (economics.ts ownerDrawFd; Jeff, 2026-11-04): the owner's own pay stays with the company, a hired driver's goes out.
  const draw = Math.min(c.wages, ownerDrawFd(w, truck, driven));
  if (c.wages - draw > 1e-9) w.ledger.post(w.t, acct, "sink:driver_wages", c.wages - draw, ref);
  company.ownerDrawFd += draw;
  const maintenance = serviceBill(w, company, truck.hub, lockCost(w, company, c.maintenance * managerMaintenanceMult(w, company), () => c.maintenance * keep * managerMaintenanceMult(w, company)), "maintenance", ref);
  w.ledger.post(w.t, acct, "sink:tolls", tolls, ref);
  // Insurance isn't per trip: the yearly policy is billed weekly (insurance.ts).
  return fuel + maintenance + c.wages - draw + tolls;
}

function arriveEmpty(w: World, truck: Truck): void {
  companyById(w, truck.companyId).operating.costFd += payTripCosts(w, truck, `reposition:${truck.id}`);
  setIdle(w, truck);
}

/** Stops a truck short of where it was headed (its load re-posted): it pays for the miles so far and is idle back at the hub it left. */
export function abandonLeg(w: World, truck: Truck): void {
  companyById(w, truck.companyId).operating.costFd += payTripCosts(w, truck, `abandon:${truck.id}`);
  truck.targetHub = truck.hub;
  truck.targetPlace = truck.place;
  truck.remainingMi = 0;
  setIdle(w, truck);
}

/**
 * Whoever owes for a delivered load pays `payee` `gross`: the broker (who is paid
 * by its NPC shipper, minus the odd default), the player shipper (paid by the NPC
 * market for the goods), or the NPC shipper directly. `factor` is what a late hot
 * load still pays of the full amount.
 */
function collectUpstream(w: World, load: Load, payee: Company, gross: number, factor: number, ref: string, leased = false): Receivable | null {
  const { cfg } = w;
  const payeeAcct = companyAccount(payee.id);
  const truckId = load.truckId ?? undefined;
  let paper: Receivable | null = null;
  // The factoring log: brokered and direct NPC freight, and what it paid the carrier.
  if (cfg.token.payment.enabled && load.shipperId === null) {
    const side = factoringLog(w)[load.brokerId !== null ? "brokered" : "direct"];
    side.loads++;
    side.payFd += gross;
    side.miles += load.miles;
  }
  if (load.brokerId !== null) {
    const broker = companyById(w, load.brokerId);
    const brokerAcct = companyAccount(broker.id);
    // Credit risk: some NPC shippers don't pay, more often in a downturn. The
    // broker owes its carrier either way.
    const { brokerRisk } = cfg;
    const slump = Math.max(0, 1 - w.feeds.cycle(dayOf(w.t, cfg)));
    const defaulted = w.rng.ops.next() < brokerRisk.defaultRate * (1 + brokerRisk.downturnSensitivity * slump);
    const billed = load.shipperRate * load.miles * factor;
    // Player brokerages (brokerage.ts): a load its owner's own carrier hauled counts once per person, for the carrier.
    const ownHaul = samePerson(w, broker.id, payee.id);
    if (!defaulted) {
      bill(w, { payer: 0, faucet: "faucet:npc_shipper", payee: broker, amountFd: billed, ref, npcKind: npcPayKind(load) });
      w.ledger.post(w.t, brokerAcct, "sink:board_fee", lockCost(w, broker, cfg.board.posterFeePct * billed, () => cfg.board.posterFeePct * billed * (1 - stakeDiscount(w, broker))), ref);
      if (!ownHaul) awardMiles(w, broker, cfg.miles.brokerPerMile * load.miles, load.laneId);
      broker.operating.revenueFd += billed;
      broker.operating.costFd += cfg.board.posterFeePct * billed;
    } else {
      w.metrics.onShipperDefault();
    }
    bill(w, { payer: broker.id, payee, amountFd: gross, ref, leased, truckId });
    broker.operating.costFd += gross;
    broker.openBrokerLoads--;
    if (!ownHaul) broker.loadsThisWeek++;
    else brokerageLog(w).countedOnce++;
  } else if (load.shipperId !== null) {
    // Player-shipper freight: the NPC market buys the goods from the shipper,
    // who pays the carrier. A company hauling its own freight pays itself nothing.
    const shipper = companyById(w, load.shipperId);
    const shipperAcct = companyAccount(shipper.id);
    const fee = lockCost(w, shipper, cfg.board.posterFeePct * load.saleValue, () => cfg.board.posterFeePct * load.saleValue * (1 - stakeDiscount(w, shipper)));
    bill(w, { payer: 0, faucet: "faucet:npc_market", payee: shipper, amountFd: load.saleValue, ref, npcKind: "market" }); // drawn on the emission budget (receivables.ts bill)
    const before = w.receivables.length;
    if (shipper.id !== payee.id) bill(w, { payer: shipper.id, payee, amountFd: gross, ref, leased, truckId, shipperPaper: true });
    // The paper the payee waits on, if it waits (token.settlementFee's refund reads it).
    const last = w.receivables.length > before ? w.receivables[w.receivables.length - 1]! : null;
    paper = last && last.shipperPaper && last.payer === shipper.id && last.payeeId === payee.id ? last : null;
    w.ledger.post(w.t, shipperAcct, "sink:board_fee", fee, ref);
    const facility = w.facilities[load.facilityId! - 1];
    // Self-hauled freight's carrier side is the owner's own cost, so only the goods margin counts here.
    if (facility) facility.netFd += load.saleValue - fee - (shipper.id !== payee.id ? gross : 0);
    if (shipper.id !== payee.id) {
      awardMiles(w, shipper, cfg.facilities.shipperMilesPerMile * load.miles, load.laneId);
      shipper.loadsThisWeek++;
    }
  } else {
    bill(w, { payer: 0, faucet: "faucet:npc_shipper", payee, amountFd: gross, ref, leased, truckId, npcKind: npcPayKind(load) });
  }
  return paper;
}

function deliver(w: World, truck: Truck, now: number): void {
  const { cfg } = w;
  const load = w.loads.get(truck.loadId!)!;
  const carrier = companyById(w, truck.companyId);
  const carrierAcct = companyAccount(carrier.id);
  const ref = `load:${load.id}`;
  // A perishable past its spoil time is a total loss: no freight pay, and a cargo claim on the carrier.
  const k = COMMODITIES[load.commodity]!;
  const spoiled = k.spoilHours !== null && now > load.appointmentT + k.spoilHours * MINUTES_PER_HOUR;
  // A hot load delivered late pays only part of its premium.
  const factor = spoiled ? 0 : load.hot > 0 && now > load.dueT ? (1 + cfg.safety.hotLoads.lateKeepsPremium * (load.hot - 1)) / load.hot : 1;
  const gross = load.clearedRate * load.miles * factor;

  // A double-brokered load pays the company that re-posted it, which then pays the hauler — or doesn't.
  // A company hauling its own freight pays itself nothing: no revenue, no lease share on it.
  const db = load.doubleBroker ? companyById(w, load.doubleBroker.companyId) : null;
  const upstream = db ? load.doubleBroker!.upstreamRate * load.miles * factor : gross;
  const paper = spoiled ? null : collectUpstream(w, load, db ?? carrier, upstream, factor, ref, !db && truck.lease === "npc");
  const own = load.shipperId === carrier.id;
  const paid = own || spoiled ? 0 : db ? settleDoubleBroker(w, load, carrier, gross, upstream) : gross;
  // token.settlementFee: on what the carrier is paid, from the carrier (settlement.ts); none on its own brokerage's tender.
  const settled = chargeSettlement(w, carrier.id, load.brokerId ?? db?.id ?? load.shipperId ?? null, paid, ref, db ? null : paper);
  // Detention, its own line in the settlement (cfg.detention), to the carrier that waited.
  const detained = spoiled || own ? 0 : payDetention(w, load, carrier);
  carrier.operating.revenueFd += detained;

  let costs = payTripCosts(w, truck, ref) + settled;
  // An open deck in the weather (equipmentOps): a damage claim at the receiver.
  if (cfg.equipmentOps.enabled && load.equipment === "flatbed") costs += flatbedDamage(w, truck, carrier, load);
  if (spoiled) {
    const claim = cfg.commodities.spoilClaimShare * load.cargoValue;
    w.ledger.post(w.t, carrierAcct, "sink:cargo_claims", claim, ref);
    costs += claim;
    w.listener?.({ kind: "notice", companyId: carrier.id, topic: "safety", text: `Load #${load.id} (${k.name.toLowerCase()}) arrived ${Math.round((now - load.appointmentT) / MINUTES_PER_HOUR)} h past its appointment and was rejected as spoiled: no pay, and a ${Math.round(claim)} FD cargo claim.`, tone: "bad", truckId: truck.id });
  }
  if (truck.lease !== "owned") {
    const lease = paid * cfg.costs.npcLeaseShareOfGross;
    w.ledger.post(w.t, carrierAcct, "sink:npc_lease", lease, ref);
    truck.leaseShareWeekFd += lease;
    costs += lease;
    // A lease priced by value: the lessor holds back part of each settlement until the deposit is whole
    // (refundable, so not a cost).
    const owed = truck.depositDueFd - truck.depositFd;
    if (owed > 0.005 && paid > 0) {
      const hold = Math.min(owed, paid * cfg.freeEntry.leases.byValue.escrowShareOfPay);
      truck.depositLockedFd = (truck.depositLockedFd ?? 0) + w.ledger.post(w.t, carrierAcct, "sink:lease_deposit", hold, `deposit:${truck.id}`);
      truck.depositFd += hold;
    }
  }
  carrier.operating.revenueFd += paid;
  // The free tier "spendOnly": after launch the free path's earnings are spend-only until a truck is owned.
  if (cfg.freeEntry.freePath === "spendOnly" && truck.lease === "npc" && paid > 0 && w.token.launchDay !== null) {
    carrier.freePathLockedFd += w.ledger.lock(carrierAcct, paid);
  }
  carrier.operating.costFd += costs;

  // On-time and reputation. docks.lateFromArrival: from the truck's arrival at the receiver, so a wait for its dock
  // isn't the carrier's lateness.
  const at = cfg.docks.lateFromArrival && load.arrivedT !== undefined ? load.arrivedT : now;
  let onTime: number = cfg.miles.onTime.onTime;
  if (at <= load.dueT - cfg.freight.earlyThresholdMinutes) onTime = cfg.miles.onTime.early;
  else if (at > load.dueT) onTime = cfg.miles.onTime.late;
  carrier.delivered++;
  carrier.loadsThisWeek++;
  if (at <= load.dueT) carrier.onTime++;
  else carrier.late++;
  // Delivery windows (batch 2; the director's call 1): past the hard deadline it is delivered and paid, and claimed
  // (windows.lateClaimShare of the pay as booked), with today's late rules above and below. A spoiled load is refused, with
  // its own cargo claim, as before.
  if (!spoiled && load.latestDeliveryT !== undefined && at > load.latestDeliveryT && windowsOn(w)) costs += claimOn(w, carrier, load, cfg.windows!.lateClaimShare, "late");
  // Smoothed on-time rate: a company's record, not its size, sets its reputation.
  const prior = cfg.reputation.priorLoads;
  // Delivery windows: loads booked and never hauled (Company.failed) count as late ones; absent, the same arithmetic.
  carrier.reputation = (carrier.onTime + prior * cfg.reputation.start) / (carrier.delivered + (carrier.failed ?? 0) + prior);

  // Miles (§Points): loaded miles × on-time × margin factor × reputation × truck ladder.
  // Miles are earned on what the haul was worth, own freight included.
  const earned = own ? gross : paid;
  const margin = earned > 0 ? (earned - costs) / earned : -1;
  const marginFactor = clamp(margin / cfg.miles.marginTarget, cfg.miles.marginClamp[0], cfg.miles.marginClamp[1]);
  // A hot load's premium is part of its reference, so paying it isn't an outlier.
  const ref0 = load.refRate * (load.hot || 1);
  const outlier = Math.abs(load.clearedRate - ref0) / ref0 > cfg.miles.rateOutlierPct;
  // Flat per loaded mile (Jeff, 2026-10-29): no truck ladder, since every wallet is an MC and a ladder would pay splitting a fleet across them.
  const amount = outlier ? 0 : load.miles * onTime * marginFactor * reputationFactor(w, carrier);
  awardMiles(w, carrier, amount, load.laneId);

  w.metrics.onDelivery(w, carrier, load, earned, costs, onTime);
  w.listener?.({ kind: "delivered", companyId: carrier.id, truckId: truck.id, loadId: load.id, origin: load.origin, dest: load.dest, grossFd: paid, costFd: costs, onTime: at <= load.dueT });
  load.status = "delivered";
  w.loads.delete(load.id);
  setIdle(w, truck);
}

export function reputationFactor(w: World, c: Company): number {
  const { reputation, miles } = w.cfg;
  const level = Math.min(reputation.maxLevel, Math.floor(Math.sqrt(c.delivered / reputation.loadsPerLevelSq)));
  return miles.reputationRange[0] + ((miles.reputationRange[1] - miles.reputationRange[0]) * level) / reputation.maxLevel;
}

/** Applies the per-lane-pair and daily caps (§Points — anti-farming). */
function awardMiles(w: World, c: Company, amount: number, laneId: number): void {
  const day = dayOf(w.t, w.cfg);
  if (c.milesByDay.day !== day) {
    c.milesByDay = { day, amount: 0 };
    c.lanePairToday.clear();
  }
  const pair = (c.lanePairToday.get(laneId) ?? 0) + 1;
  c.lanePairToday.set(laneId, pair);
  if (pair > w.cfg.miles.maxLoadsPerLanePairPerDay) return;
  const granted = Math.max(0, Math.min(amount, w.cfg.miles.dailyCapPerCompany - c.milesByDay.amount));
  c.milesByDay.amount += granted;
  c.milesTotal += granted;
}
