import { brokerageLog, samePerson } from "./brokerage.js";
import { commodityAttract, hubTheftRisk, stealCargo } from "./risk.js";
import { securityTheftMult } from "./labor.js";
import { crewStrike } from "./robbery.js";
import { scaleDiscount } from "./scale.js";
import { endOfLife } from "./assets.js";
import { addTrailerMiles } from "./trailers.js";
import { COMMODITIES, dexp, NO_TERRAIN, routeTerrain, type Route } from "@lanes/data";
import { deliveryWait, pickupWait } from "./docks.js";
import { flatbedDamage, reeferUnit } from "./equipment.js";
import { winterNow } from "./safety.js";
import { payLegFuel, roadService, serviceBill } from "./businesses.js";
import { leaveParking, legMile, parkForTheNight, planNight, siteHere } from "./sites.js";
import { managerBreakdownMult, managerMaintenanceMult } from "./labor.js";
import { dayOf, MINUTES_PER_HOUR } from "./clock.js";
import { clamp, fuelPrice, tripCost } from "./economics.js";
import { settleDoubleBroker } from "./fraud.js";
import { bill, factoringLog } from "./receivables.js";
import { lockCost, stakeDiscount } from "./staking.js";
import { creditMiles, creditDriving, homeArrival } from "./labor.js";
import { companyAccount } from "./ledger.js";
import { closeDutyDay, drivingLimitMin, legalDrivingMin, mphFor, safetyTick } from "./safety.js";
import type { Company, Load, Truck } from "./types.js";
import { breakdownsPer1000Mi } from "./wear.js";
import { companyById, hubRoute, type World, placeRoute } from "./world.js";

/** Truck is at the shipper: load for 1–2 hours (plus securing a flatbed, plus waiting for a closed dock to open), then roll. */
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
  // A first-come shipper outside its hours (docks.ts): the wait moves the due time.
  const wait = pickupWait(w, load, now);
  if (wait > 0) {
    dwell += wait;
    load.dueT += wait;
    w.metrics.onDockWait(wait);
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
    const d = deliveryWait(w, load, now);
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
  if (truck.shiftStartT === null || now >= truck.shiftStartT + hos.dutyDayHours * MINUTES_PER_HOUR) {
    closeDutyDay(w, truck);
    truck.shiftStartT = now;
    truck.shiftDrivenMin = 0;
  }
  const limit = truck.companyId ? drivingLimitMin(w, truck, companyById(w, truck.companyId)) : hos.drivingHoursPerDay * MINUTES_PER_HOUR;
  return limit - truck.shiftDrivenMin;
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
      if (truck.remainingMi <= 1e-6) {
        arrive(w, truck, now);
        continue;
      }

      const hosLeft = drivingMinutesLeft(w, truck, now);
      if (hosLeft <= 1e-9) {
        // Off duty until the duty day resets; if that's within this hour, roll on from there.
        const resetAt = truck.shiftStartT! + cfg.hos.dutyDayHours * MINUTES_PER_HOUR;
        const hourEnd = w.t + MINUTES_PER_HOUR;
        if (resetAt >= hourEnd) {
          // The night: at the site the truck stands at (a rest area or a truck stop), else on the shoulder (sites.ts).
          const r = placeRoute(w, truck.place, truck.targetPlace);
          const here = r ? siteHere(w, r, legMile(truck)) : null;
          if (here && !(here.parked < here.spaces)) w.metrics.onFull();
          parkForTheNight(w, truck, here && here.parked < here.spaces ? here : null);
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
      // The road sets the pace: the route's miles over its hours, then the driver and the company's speed policy,
      // then the grades (roads.terrain): the leg's mountain miles run at the mountain speed.
      const route = placeRoute(w, truck.place, truck.targetPlace);
      const roadMph = route && route.hours > 0 ? route.miles / route.hours : cfg.hos.avgMph;
      const tr = cfg.roads.terrain;
      const grades = tr.enabled && truck.legMiles > 0 && truck.legMountainMi > 0 ? truck.legMiles / (truck.legMiles + truck.legMountainMi * (roadMph / tr.mountainMph - 1)) : 1;
      const mph = (truck.companyId ? mphFor(w, truck, companyById(w, truck.companyId), roadMph) : roadMph) * grades;
      let minutes = Math.min(budget, hosLeft, (truck.remainingMi / mph) * MINUTES_PER_HOUR);
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
      if (dayDone) truck.shiftDrivenMin = limit; // the hours are spent: the next pass through the loop parks
      creditDriving(w, truck, minutes);
      truck.overMin = Math.max(0, truck.shiftDrivenMin - legalDrivingMin(w, truck));
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
  if (truck.status === "toPickup") startLoading(w, truck, w.loads.get(truck.loadId!)!, now);
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
}

function setIdle(w: World, truck: Truck): void {
  truck.status = "idle";
  truck.hub = truck.targetHub;
  truck.place = truck.targetPlace;
  truck.loadId = null;
  truck.idleRounds = 0;
  truck.idleSinceDay = dayOf(w.t, w.cfg);
  truck.idleSinceT = w.t;
  truck.emptyMi = 0;
  truck.loadedMi = 0;
  truck.legKey = -1;
  homeArrival(w, truck);
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
  w.ledger.post(w.t, acct, "sink:driver_wages", c.wages, ref);
  const maintenance = serviceBill(w, company, truck.hub, lockCost(w, company, c.maintenance * managerMaintenanceMult(w, company), () => c.maintenance * keep * managerMaintenanceMult(w, company)), "maintenance", ref);
  w.ledger.post(w.t, acct, "sink:tolls", tolls, ref);
  // Insurance isn't per trip: the yearly policy is billed weekly (insurance.ts).
  return fuel + maintenance + c.wages + tolls;
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
function collectUpstream(w: World, load: Load, payee: Company, gross: number, factor: number, ref: string, leased = false): void {
  const { cfg } = w;
  const payeeAcct = companyAccount(payee.id);
  const truckId = load.truckId ?? undefined;
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
      bill(w, { payer: 0, faucet: "faucet:npc_shipper", payee: broker, amountFd: billed, ref });
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
    bill(w, { payer: 0, faucet: "faucet:npc_market", payee: shipper, amountFd: load.saleValue, ref });
    if (shipper.id !== payee.id) bill(w, { payer: shipper.id, payee, amountFd: gross, ref, leased, truckId, shipperPaper: true });
    w.ledger.post(w.t, shipperAcct, "sink:board_fee", fee, ref);
    const facility = w.facilities[load.facilityId! - 1];
    // Self-hauled freight's carrier side is the owner's own cost, so only the goods margin counts here.
    if (facility) facility.netFd += load.saleValue - fee - (shipper.id !== payee.id ? gross : 0);
    if (shipper.id !== payee.id) {
      awardMiles(w, shipper, cfg.facilities.shipperMilesPerMile * load.miles, load.laneId);
      shipper.loadsThisWeek++;
    }
  } else {
    bill(w, { payer: 0, faucet: "faucet:npc_shipper", payee, amountFd: gross, ref, leased, truckId });
  }
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
  if (!spoiled) collectUpstream(w, load, db ?? carrier, upstream, factor, ref, !db && truck.lease === "npc");
  const own = load.shipperId === carrier.id;
  const paid = own || spoiled ? 0 : db ? settleDoubleBroker(w, load, carrier, gross, upstream) : gross;

  let costs = payTripCosts(w, truck, ref);
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

  // On-time and reputation.
  let onTime: number = cfg.miles.onTime.onTime;
  if (now <= load.dueT - cfg.freight.earlyThresholdMinutes) onTime = cfg.miles.onTime.early;
  else if (now > load.dueT) onTime = cfg.miles.onTime.late;
  carrier.delivered++;
  carrier.loadsThisWeek++;
  if (now <= load.dueT) carrier.onTime++;
  else carrier.late++;
  // Smoothed on-time rate: a company's record, not its size, sets its reputation.
  const prior = cfg.reputation.priorLoads;
  carrier.reputation = (carrier.onTime + prior * cfg.reputation.start) / (carrier.delivered + prior);

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
  w.listener?.({ kind: "delivered", companyId: carrier.id, truckId: truck.id, loadId: load.id, origin: load.origin, dest: load.dest, grossFd: paid, costFd: costs, onTime: now <= load.dueT });
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
