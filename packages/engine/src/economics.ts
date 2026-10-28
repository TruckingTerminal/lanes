import type { EconomyConfig, Equipment, TractorTier } from "@lanes/config";
import { dayOf } from "./clock.js";
import { effectiveMpg, expectedRepairPerMile, maintMultiplier, type TruckSpec } from "./wear.js";
import type { World } from "./world.js";

/** In-game diesel (§Rates — scaled fuel), times the rack-spread stabilizer. */
export function fuelPrice(w: World): number {
  const { fuel } = w.cfg;
  const real = w.feeds.dieselRatio(dayOf(w.t, w.cfg));
  const scaled = clamp(1 + fuel.realStrength * (real - 1), fuel.clamp[0], fuel.clamp[1]);
  return fuel.baseFd * scaled * w.stab.rackSpread;
}

/** Fuel surcharge per mile: passes 80% of the move off base to shippers. */
export function fscPerMile(cfg: EconomyConfig, price: number): number {
  return (cfg.fuel.surchargePassThrough * (price - cfg.fuel.baseFd)) / cfg.fuel.surchargeMpg;
}

export function maintPerMile(cfg: EconomyConfig, tier: TractorTier, trailer: Equipment): number {
  return cfg.tractors[tier].maintPerMile + cfg.trailers[trailer].maintPerMile;
}

/**
 * Variable cost of driving `driven` miles with `loaded` of them loaded, at the
 * truck's current wear. Excludes the lease share and breakdown repair bills,
 * which are paid when they happen.
 */
export function tripCost(cfg: EconomyConfig, truck: TruckSpec, fuel: number, driven: number, loaded: number) {
  return {
    fuel: (driven / effectiveMpg(cfg, truck)) * fuel,
    wages: driven * cfg.costs.driverWagePerMile,
    maintenance: driven * maintPerMile(cfg, truck.tier, truck.trailer) * maintMultiplier(cfg, truck),
    insurance: loaded * cfg.costs.insurancePerLoadedMile,
  };
}

/**
 * Lowest per-mile rate that covers the trip: variable costs at current wear,
 * expected repairs, and the NPC lease share. A worn truck's break-even is higher,
 * so it loses bids to fresher trucks; that, not a rule, is the incentive to rebuild.
 */
export function breakEvenPerMile(cfg: EconomyConfig, truck: TruckSpec, fuel: number, loadedMi: number, deadheadMi: number): number {
  const driven = loadedMi + deadheadMi;
  const c = tripCost(cfg, truck, fuel, driven, loadedMi);
  const variable = c.fuel + c.wages + c.maintenance + c.insurance + expectedRepairPerMile(cfg, truck) * driven;
  const keep = truck.lease !== "owned" ? 1 - cfg.costs.npcLeaseShareOfGross : 1;
  return variable / (loadedMi * keep);
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
