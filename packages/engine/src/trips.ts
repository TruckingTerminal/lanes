import { dayOf, MINUTES_PER_HOUR } from "./clock.js";
import { clamp, fuelPrice, tripCost } from "./economics.js";
import { companyAccount } from "./ledger.js";
import type { Company, Load, Truck } from "./types.js";
import { breakdownsPer1000Mi } from "./wear.js";
import { companyById, type World } from "./world.js";

/** Truck is at the shipper: load for 1–2 hours, then roll. */
export function startLoading(w: World, truck: Truck, load: Load): void {
  const [lo, hi] = w.cfg.dwell.loadMinutes;
  truck.status = "loading";
  truck.hub = load.origin;
  truck.targetHub = load.dest;
  truck.remainingMi = load.miles;
  truck.dwellMin = w.rng.ops.int(lo, hi);
  load.status = "inTransit";
}

function startUnloading(w: World, truck: Truck): void {
  const [lo, hi] = w.cfg.dwell.unloadMinutes;
  truck.status = "unloading";
  truck.dwellMin = w.rng.ops.int(lo, hi);
}

/** Driving minutes a truck has left in its current duty day; opens a new day if the last one ended. */
export function drivingMinutesLeft(w: World, truck: Truck, now: number): number {
  const { hos } = w.cfg;
  if (truck.shiftStartT === null || now >= truck.shiftStartT + hos.dutyDayHours * MINUTES_PER_HOUR) {
    truck.shiftStartT = now;
    truck.shiftDrivenMin = 0;
  }
  return hos.drivingHoursPerDay * MINUTES_PER_HOUR - truck.shiftDrivenMin;
}

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
      const minutes = Math.min(budget, hosLeft, (truck.remainingMi / cfg.hos.avgMph) * MINUTES_PER_HOUR);
      const miles = Math.min(truck.remainingMi, (cfg.hos.avgMph * minutes) / MINUTES_PER_HOUR);
      truck.remainingMi -= miles;
      truck.shiftDrivenMin += minutes;
      budget -= minutes;
      if (truck.status === "loaded") truck.loadedMi += miles;
      else truck.emptyMi += miles;
      truck.odometer += miles;
      if (truck.lease === "owned") truck.milesSinceRebuild += miles;
      if (miles > 0 && w.rng.ops.next() < (breakdownsPer1000Mi(cfg, truck) * miles) / 1000) breakDown(w, truck);
      if (truck.remainingMi <= 1e-6) truck.remainingMi = 0;
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
  truck.loadId = null;
  truck.idleRounds = 0;
  truck.idleSinceDay = dayOf(w.t, w.cfg);
  truck.emptyMi = 0;
  truck.loadedMi = 0;
}

/** Pays operating costs for the miles driven since the last settlement. Returns their total. */
function payTripCosts(w: World, truck: Truck, ref: string): number {
  const acct = companyAccount(truck.companyId);
  const c = tripCost(w.cfg, truck, fuelPrice(w), truck.emptyMi + truck.loadedMi, truck.loadedMi);
  w.ledger.post(w.t, acct, "sink:fuel", c.fuel, ref);
  w.ledger.post(w.t, acct, "sink:driver_wages", c.wages, ref);
  w.ledger.post(w.t, acct, "sink:maintenance", c.maintenance, ref);
  w.ledger.post(w.t, acct, "sink:insurance", c.insurance, ref);
  return c.fuel + c.wages + c.maintenance + c.insurance;
}

function arriveEmpty(w: World, truck: Truck): void {
  companyById(w, truck.companyId).operating.costFd += payTripCosts(w, truck, `reposition:${truck.id}`);
  setIdle(w, truck);
}

function deliver(w: World, truck: Truck, now: number): void {
  const { cfg } = w;
  const load = w.loads.get(truck.loadId!)!;
  const carrier = companyById(w, truck.companyId);
  const carrierAcct = companyAccount(carrier.id);
  const ref = `load:${load.id}`;
  const gross = load.clearedRate * load.miles;

  if (load.brokerId !== null) {
    const broker = companyById(w, load.brokerId);
    const brokerAcct = companyAccount(broker.id);
    // Credit risk: some NPC shippers don't pay, more often in a downturn. The
    // broker owes its carrier either way.
    const { brokerRisk } = cfg;
    const slump = Math.max(0, 1 - w.feeds.cycle(dayOf(w.t, cfg)));
    const defaulted = w.rng.ops.next() < brokerRisk.defaultRate * (1 + brokerRisk.downturnSensitivity * slump);
    if (!defaulted) {
      w.ledger.post(w.t, "faucet:npc_shipper", brokerAcct, load.shipperRate * load.miles, ref);
      w.ledger.post(w.t, brokerAcct, "sink:board_fee", cfg.board.posterFeePct * load.shipperRate * load.miles, ref);
      awardMiles(w, broker, cfg.miles.brokerPerMile * load.miles, load.laneId);
      broker.operating.revenueFd += load.shipperRate * load.miles;
      broker.operating.costFd += cfg.board.posterFeePct * load.shipperRate * load.miles;
    } else {
      w.metrics.onShipperDefault();
    }
    w.ledger.post(w.t, brokerAcct, carrierAcct, gross, ref);
    broker.operating.costFd += gross;
    broker.openBrokerLoads--;
    broker.loadsThisWeek++;
  } else if (load.shipperId !== null) {
    // Player-shipper freight: the NPC market buys the goods from the shipper,
    // who pays the carrier. A company hauling its own freight pays itself nothing.
    const shipper = companyById(w, load.shipperId);
    const shipperAcct = companyAccount(shipper.id);
    const fee = cfg.board.posterFeePct * load.saleValue;
    w.ledger.post(w.t, "faucet:npc_market", shipperAcct, load.saleValue, ref);
    if (shipper.id !== carrier.id) w.ledger.post(w.t, shipperAcct, carrierAcct, gross, ref);
    w.ledger.post(w.t, shipperAcct, "sink:board_fee", fee, ref);
    const facility = w.facilities[load.facilityId! - 1];
    // Self-hauled freight's carrier side is the owner's own cost, so only the goods margin counts here.
    if (facility) facility.netFd += load.saleValue - fee - (shipper.id !== carrier.id ? gross : 0);
    if (shipper.id !== carrier.id) {
      awardMiles(w, shipper, cfg.facilities.shipperMilesPerMile * load.miles, load.laneId);
      shipper.loadsThisWeek++;
    }
  } else {
    w.ledger.post(w.t, "faucet:npc_shipper", carrierAcct, gross, ref);
  }

  let costs = payTripCosts(w, truck, ref);
  if (truck.lease !== "owned") {
    const lease = gross * cfg.costs.npcLeaseShareOfGross;
    w.ledger.post(w.t, carrierAcct, "sink:npc_lease", lease, ref);
    truck.leaseShareWeekFd += lease;
    costs += lease;
  }
  carrier.operating.revenueFd += gross;
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
  const margin = (gross - costs) / gross;
  const marginFactor = clamp(margin / cfg.miles.marginTarget, cfg.miles.marginClamp[0], cfg.miles.marginClamp[1]);
  const outlier = Math.abs(load.clearedRate - load.refRate) / load.refRate > cfg.miles.rateOutlierPct;
  const amount = outlier ? 0 : load.miles * onTime * marginFactor * reputationFactor(w, carrier) * ladderFactor(w, truck);
  awardMiles(w, carrier, amount, load.laneId);

  w.metrics.onDelivery(w, carrier, load, gross, costs, onTime);
  w.listener?.({ kind: "delivered", companyId: carrier.id, truckId: truck.id, loadId: load.id, origin: load.origin, dest: load.dest, grossFd: gross, costFd: costs, onTime: now <= load.dueT });
  load.status = "delivered";
  w.loads.delete(load.id);
  setIdle(w, truck);
}

export function reputationFactor(w: World, c: Company): number {
  const { reputation, miles } = w.cfg;
  const level = Math.min(reputation.maxLevel, Math.floor(Math.sqrt(c.delivered / reputation.loadsPerLevelSq)));
  return miles.reputationRange[0] + ((miles.reputationRange[1] - miles.reputationRange[0]) * level) / reputation.maxLevel;
}

/** Diminishing Miles per truck: 100/90/80/70/60%, then 50% (§Owned vs. leased). */
export function ladderFactor(w: World, truck: Truck): number {
  // Position among operating trucks: parked trucks don't hold a ladder slot.
  let i = 0;
  for (const t of w.trucksByCompany.get(truck.companyId)!) {
    if (t === truck) break;
    if (t.status !== "parked") i++;
  }
  return w.cfg.company.truckLadder[i] ?? w.cfg.company.truckLadderFloor;
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
