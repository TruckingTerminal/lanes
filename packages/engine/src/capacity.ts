import type { Equipment, TractorTier } from "@lanes/config";
import { dayOf } from "./clock.js";
import { companyAccount } from "./ledger.js";
import type { Company, Truck } from "./types.js";
import { createTruck, detachTruck, type World } from "./world.js";

/**
 * Free entry: capacity that can grow into a boom. Carriers that own a truck can
 * lease more from the NPC lessor, and the dealer adds to its caps when they run
 * low while freight goes uncovered.
 */
const TIERS: TractorTier[] = ["workhorse", "highwayPro", "flagship"];
const TRAILERS: Equipment[] = ["van", "reefer", "flatbed"];

export function lessorTrucksOf(w: World, companyId: number): Truck[] {
  return w.trucksByCompany.get(companyId)!.filter((t) => t.lease === "lessor");
}

export function leaseTruck(w: World, c: Company, trailer: Equipment): string | null {
  const { cfg } = w;
  const rules = cfg.freeEntry.leases;
  if (!rules.enabled) return "no extra leases";
  if (c.role !== "carrier") return "only carriers run trucks in Phase 0";
  if (c.liquidatingSince !== null) return "in liquidation";
  const fleet = w.trucksByCompany.get(c.id)!;
  if (!fleet.some((t) => t.lease === "owned")) return "extra leases need an owned truck first";
  if (fleet.length >= cfg.company.maxTrucks) return "company truck cap";
  if (lessorTrucksOf(w, c.id).length >= rules.maxPerCompany) return "company lease cap";
  if (w.lessor.out >= w.lessor.fleet) return "the lessor has nothing left to lease";
  createTruck(w, c, "lessor", "workhorse", trailer);
  w.lessor.out++;
  return null;
}

/** Hands a leased truck back: idle at a hub, past the minimum term (waived in liquidation). */
export function returnLease(w: World, c: Company, truck: Truck): string | null {
  if (truck.companyId !== c.id || truck.lease !== "lessor") return "not a truck you lease";
  if (truck.status !== "idle") return "truck must be idle at a hub";
  const held = dayOf(w.t, w.cfg) - (truck.leasedDay ?? 0);
  if (held < w.cfg.freeEntry.leases.minTermDays && c.liquidatingSince === null) return "inside the minimum lease term";
  detachTruck(w, truck);
  truck.status = "retired";
  w.lessor.out--;
  return null;
}

/** Weekly: a leased truck whose share didn't reach the minimum rent pays the difference. */
export function chargeMinimumRent(w: World): void {
  const min = w.cfg.freeEntry.leases.minWeeklyFd;
  for (const t of w.trucks) {
    if (t.lease === "lessor" && t.companyId !== 0 && t.status !== "retired") {
      const short = min - t.leaseShareWeekFd;
      if (short > 0) w.ledger.post(w.t, companyAccount(t.companyId), "sink:npc_lease", short, `rent:${t.id}`);
    }
    t.leaseShareWeekFd = 0;
  }
}

/** Freight is going uncovered when the board's smoothed fill rate for this equipment is low. */
function uncovered(w: World, eq: Equipment): boolean {
  return w.fillRate[eq] < w.cfg.freeEntry.dealerGrowth.uncoveredFillRate;
}

function anyUncovered(w: World): boolean {
  return TRAILERS.some((eq) => uncovered(w, eq));
}

/**
 * Monthly: the lessor grows its fleet when nearly all of it is out and freight
 * is going uncovered, and lets it shrink (never below what's out) when leases
 * come back; the dealer adds 5% to any cap that's nearly sold out while freight
 * that equipment would haul goes uncovered.
 */
export function monthlyCapacity(w: World): void {
  const { freeEntry: fe } = w.cfg;
  const l = w.lessor;
  if (fe.leases.enabled) {
    const util = l.fleet > 0 ? l.out / l.fleet : 1;
    if (util >= fe.leases.tightUtilization && anyUncovered(w)) l.fleet = Math.min(fe.leases.maxFleet, Math.ceil(l.fleet * (1 + fe.leases.growthPerMonth)));
    else if (util < fe.leases.slackUtilization) l.fleet = Math.max(l.out, fe.leases.startFleet, Math.floor(l.fleet * (1 - fe.leases.shrinkPerMonth)));
    l.peakFleet = Math.max(l.peakFleet, l.fleet);
  }
  if (!fe.dealerGrowth.enabled) return;
  const g = fe.dealerGrowth;
  const grow = (left: number, cap: number) => (left < g.lowSupplyShare * cap ? Math.round(g.growthPerMonth * cap) : 0);
  // Tractors haul anything, so any uncovered equipment counts; the starter reserve isn't open to fleets, so it doesn't count as supply left.
  if (anyUncovered(w)) {
    for (const tier of TIERS) {
      const left = w.supply.tractor[tier] - (tier === "workhorse" ? w.starterReserve.workhorse : 0);
      const add = grow(left, w.supplyCap.tractor[tier]);
      w.supply.tractor[tier] += add;
      w.supplyCap.tractor[tier] += add;
      w.capAddedUnits += add;
    }
  }
  for (const eq of TRAILERS) {
    if (!uncovered(w, eq)) continue;
    const left = w.supply.trailer[eq] - (eq === "van" ? w.starterReserve.van : 0);
    const add = grow(left, w.supplyCap.trailer[eq]);
    w.supply.trailer[eq] += add;
    w.supplyCap.trailer[eq] += add;
  }
}
