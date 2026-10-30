import { COMMODITIES } from "@lanes/data";
import { dayOf, MINUTES_PER_HOUR } from "./clock.js";
import { clamp, fuelPrice, tripCost } from "./economics.js";
import { settleDoubleBroker } from "./fraud.js";
import { bill } from "./receivables.js";
import { stakeDiscount } from "./staking.js";
import { creditMiles, creditDriving, homeArrival } from "./labor.js";
import { companyAccount } from "./ledger.js";
import { closeDutyDay, drivingLimitMin, legalDrivingMin, mphFor, safetyTick } from "./safety.js";
import type { Company, Load, Truck } from "./types.js";
import { breakdownsPer1000Mi } from "./wear.js";
import { companyById, hubRoute, type World, placeRoute } from "./world.js";

/** Truck is at the shipper: load for 1–2 hours, then roll. */
export function startLoading(w: World, truck: Truck, load: Load): void {
  const [lo, hi] = w.cfg.dwell.loadMinutes;
  truck.status = "loading";
  truck.hub = load.origin;
  truck.targetHub = load.dest;
  truck.place = load.originPlace;
  truck.targetPlace = load.destPlace;
  truck.remainingMi = load.miles;
  truck.dwellMin = w.rng.ops.int(lo, hi);
  load.status = "inTransit";
}

function startUnloading(w: World, truck: Truck): void {
  const [lo, hi] = w.cfg.dwell.unloadMinutes;
  truck.status = "unloading";
  truck.dwellMin = w.rng.ops.int(lo, hi);
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
        arrive(w, truck);
        continue;
      }

      const hosLeft = drivingMinutesLeft(w, truck, now);
      if (hosLeft <= 1e-9) {
        // Off duty until the duty day resets; if that's within this hour, roll on from there.
        const resetAt = truck.shiftStartT! + cfg.hos.dutyDayHours * MINUTES_PER_HOUR;
        const hourEnd = w.t + MINUTES_PER_HOUR;
        if (resetAt >= hourEnd) break;
        budget = hourEnd - resetAt;
        continue;
      }
      const key = legKey(w, truck);
      if (truck.legKey !== key) {
        truck.legKey = key;
        truck.legMiles = truck.remainingMi;
        truck.nextStation = 0;
        const route = placeRoute(w, truck.place, truck.targetPlace);
        truck.legTollFd = route?.tollFd ?? 0;
        truck.legHighwayShare = route && route.miles > 0 ? route.highwayMi / route.miles : 0;
      }
      // The road sets the pace: the route's miles over its hours, then the driver and the company's speed policy.
      const route = placeRoute(w, truck.place, truck.targetPlace);
      const roadMph = route && route.hours > 0 ? route.miles / route.hours : cfg.hos.avgMph;
      const mph = truck.companyId ? mphFor(w, truck, companyById(w, truck.companyId), roadMph) : roadMph;
      const minutes = Math.min(budget, hosLeft, (truck.remainingMi / mph) * MINUTES_PER_HOUR);
      const miles = Math.min(truck.remainingMi, (mph * minutes) / MINUTES_PER_HOUR);
      truck.remainingMi -= miles;
      truck.shiftDrivenMin += minutes;
      creditDriving(w, truck, minutes);
      truck.overMin = Math.max(0, truck.shiftDrivenMin - legalDrivingMin(w, truck));
      budget -= minutes;
      if (truck.status === "loaded") truck.loadedMi += miles;
      else truck.emptyMi += miles;
      truck.odometer += miles;
      if (truck.lease === "owned") truck.milesSinceRebuild += miles;
      creditMiles(w, truck, miles);
      if (miles > 0 && w.rng.ops.next() < (breakdownsPer1000Mi(cfg, truck) * miles) / 1000) breakDown(w, truck);
      if (truck.remainingMi <= 1e-6) truck.remainingMi = 0;
      // Enforcement and crashes (safety.ts): a crash ends the truck's hour; an out-of-service order stops it.
      if (miles > 0 && safetyTick(w, truck, miles, truck.legMiles > 0 ? 1 - truck.remainingMi / truck.legMiles : 1) === "crash") break;
    }
  }
}

function arrive(w: World, truck: Truck): void {
  truck.remainingMi = 0;
  if (truck.status === "toPickup") startLoading(w, truck, w.loads.get(truck.loadId!)!);
  else if (truck.status === "loaded") startUnloading(w, truck);
  else arriveEmpty(w, truck);
}

function breakDown(w: World, truck: Truck): void {
  const { breakdowns } = w.cfg;
  truck.breakdownMin = w.rng.ops.int(breakdowns.delayHours[0], breakdowns.delayHours[1]) * MINUTES_PER_HOUR;
  // Major repairs on an NPC lease are the lessor's (§Owned vs. leased).
  let bill = 0;
  if (truck.lease === "owned") {
    bill = w.rng.ops.int(breakdowns.repairFd[0], breakdowns.repairFd[1]);
    w.ledger.post(w.t, companyAccount(truck.companyId), "sink:repairs", bill, `breakdown:${truck.id}`);
    companyById(w, truck.companyId).operating.costFd += bill;
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
  const c = tripCost(w.cfg, truck, fuelPrice(w), driven, truck.loadedMi);
  // Tolls come due with the miles: the share of the leg's tolls these miles cover.
  const tolls = truck.legMiles > 0 ? Math.min(truck.legTollFd, truck.legTollFd * (driven / truck.legMiles)) : 0;
  truck.legTollFd -= tolls;
  truck.emptyMi = 0;
  truck.loadedMi = 0;
  // Locked FD earns its discount on fuel and maintenance (staking.ts); wages and tolls are what they are.
  const keep = 1 - stakeDiscount(w, companyById(w, truck.companyId));
  w.ledger.post(w.t, acct, "sink:fuel", c.fuel * keep, ref);
  w.ledger.post(w.t, acct, "sink:driver_wages", c.wages, ref);
  w.ledger.post(w.t, acct, "sink:maintenance", c.maintenance * keep, ref);
  w.ledger.post(w.t, acct, "sink:tolls", tolls, ref);
  // Insurance isn't per trip: the yearly policy is billed weekly (insurance.ts).
  return (c.fuel + c.maintenance) * keep + c.wages + tolls;
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
  if (load.brokerId !== null) {
    const broker = companyById(w, load.brokerId);
    const brokerAcct = companyAccount(broker.id);
    // Credit risk: some NPC shippers don't pay, more often in a downturn. The
    // broker owes its carrier either way.
    const { brokerRisk } = cfg;
    const slump = Math.max(0, 1 - w.feeds.cycle(dayOf(w.t, cfg)));
    const defaulted = w.rng.ops.next() < brokerRisk.defaultRate * (1 + brokerRisk.downturnSensitivity * slump);
    const billed = load.shipperRate * load.miles * factor;
    if (!defaulted) {
      bill(w, { payer: 0, faucet: "faucet:npc_shipper", payee: broker, amountFd: billed, ref });
      w.ledger.post(w.t, brokerAcct, "sink:board_fee", cfg.board.posterFeePct * billed * (1 - stakeDiscount(w, broker)), ref);
      awardMiles(w, broker, cfg.miles.brokerPerMile * load.miles, load.laneId);
      broker.operating.revenueFd += billed;
      broker.operating.costFd += cfg.board.posterFeePct * billed;
    } else {
      w.metrics.onShipperDefault();
    }
    bill(w, { payer: broker.id, payee, amountFd: gross, ref, leased });
    broker.operating.costFd += gross;
    broker.openBrokerLoads--;
    broker.loadsThisWeek++;
  } else if (load.shipperId !== null) {
    // Player-shipper freight: the NPC market buys the goods from the shipper,
    // who pays the carrier. A company hauling its own freight pays itself nothing.
    const shipper = companyById(w, load.shipperId);
    const shipperAcct = companyAccount(shipper.id);
    const fee = cfg.board.posterFeePct * load.saleValue * (1 - stakeDiscount(w, shipper));
    bill(w, { payer: 0, faucet: "faucet:npc_market", payee: shipper, amountFd: load.saleValue, ref });
    if (shipper.id !== payee.id) bill(w, { payer: shipper.id, payee, amountFd: gross, ref, leased });
    w.ledger.post(w.t, shipperAcct, "sink:board_fee", fee, ref);
    const facility = w.facilities[load.facilityId! - 1];
    // Self-hauled freight's carrier side is the owner's own cost, so only the goods margin counts here.
    if (facility) facility.netFd += load.saleValue - fee - (shipper.id !== payee.id ? gross : 0);
    if (shipper.id !== payee.id) {
      awardMiles(w, shipper, cfg.facilities.shipperMilesPerMile * load.miles, load.laneId);
      shipper.loadsThisWeek++;
    }
  } else {
    bill(w, { payer: 0, faucet: "faucet:npc_shipper", payee, amountFd: gross, ref, leased });
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
  }
  carrier.operating.revenueFd += paid;
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
