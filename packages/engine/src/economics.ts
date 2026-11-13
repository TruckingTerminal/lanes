import type { EconomyConfig, Equipment, TractorTier } from "@lanes/config";
import { dayOf } from "./clock.js";
import { effectiveMpg, expectedRepairPerMile, maintenancePerMile, type TruckSpec } from "./wear.js";
import type { World } from "./world.js";
import { settlementShare } from "./settlement.js";

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
export function tripCost(cfg: EconomyConfig, truck: TruckSpec & { mods?: { aero?: boolean; tires?: boolean } }, fuel: number, driven: number, loaded: number) {
  // Upgrades (items.ts): an aero kit saves 5% of fuel, premium tires 20% of maintenance.
  // The trailer pass (equipmentOps): a loaded mile burns more than an empty one, a loaded reefer's unit
  // runs by the hour, and drivers earn more per mile on reefer and flatbed freight.
  const ops = cfg.equipmentOps;
  const empty = Math.max(0, driven - loaded);
  const weighted = ops.enabled ? loaded * ops.loadedFuelMult + empty * ops.emptyFuelMult : driven;
  const unit = ops.enabled && truck.trailer === "reefer" ? (loaded / ops.reeferUnitMph) * ops.reeferUnitGalPerHour : 0;
  const gallons = (weighted / effectiveMpg(cfg, truck)) * (truck.mods?.aero ? 0.95 : 1) + unit;
  return {
    gallons,
    fuel: gallons * fuel,
    wages: wagesFor(cfg, truck, driven),
    maintenance: driven * maintenancePerMile(cfg, truck) * (truck.mods?.tires ? 0.8 : 1),
    // Billed weekly per truck on a yearly policy (insurance.ts); here, its share per loaded mile.
    insurance: ((loaded * cfg.insurance.baseAnnualPerTruck) / cfg.insurance.loadedMilesPerYear) * (truck.insuranceMult ?? 1),
  };
}

/**
 * Lowest per-mile rate that covers the trip: variable costs at current wear,
 * expected repairs, and the NPC lease share. A worn truck's break-even is higher,
 * so it loses bids to fresher trucks; that, not a rule, is the incentive to rebuild.
 */
export function breakEvenPerMile(cfg: EconomyConfig, truck: TruckSpec, fuel: number, loadedMi: number, deadheadMi: number, tollFd = 0): number {
  const driven = loadedMi + deadheadMi;
  const c = tripCost(cfg, truck, fuel, driven, loadedMi);
  const variable = c.fuel + c.wages + c.maintenance + c.insurance + expectedRepairPerMile(cfg, truck) * driven + tollFd;
  // token.settlementFee, a share of gross like the lessor's (0 off).
  const keep = (truck.lease !== "owned" ? 1 - cfg.costs.npcLeaseShareOfGross : 1) - settlementShare(cfg);
  return variable / (loadedMi * keep);
}

/** A whole number with thousands separators, the same on every runtime (no locale). */
export function fmtInt(x: number): string {
  const s = String(Math.round(Math.abs(x)));
  let out = "";
  for (let i = 0; i < s.length; i++) out += (i > 0 && (s.length - i) % 3 === 0 ? "," : "") + s[i];
  return (x < 0 ? "-" : "") + out;
}

/** A finite number within [lo, hi]: the check every player-supplied number gets before it touches the ledger. */
export const finiteIn = (x: unknown, lo: number, hi: number): x is number => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** A leg's driver pay: the truck's wage per mile (its driver's), more on reefer and flatbed freight (equipmentOps). */
export function wagesFor(cfg: EconomyConfig, truck: { wagePerMile?: number; trailer: Equipment }, driven: number): number {
  const ops = cfg.equipmentOps;
  return driven * (truck.wagePerMile ?? cfg.costs.driverWagePerMile) * (ops.enabled ? ops.driverPayMult[truck.trailer] : 1);
}

/**
 * The owner's draw on a leg (Jeff, 2026-11-04: "pay it to myself"): when the owner drives and `labor.owner.drawStays`,
 * the driver's pay stays with the company, since it is the owner's own; it is still priced into break-even (tripCost's
 * wages), so one-truck carriers don't bid their labor away. 0 for a hired driver or with the switch off.
 */
export function ownerDrawFd(w: { cfg: EconomyConfig; staff: readonly { owner: boolean }[] }, truck: { driverId: number; wagePerMile?: number; trailer: Equipment }, driven: number): number {
  if (!w.cfg.labor.owner.drawStays || !truck.driverId) return 0;
  const d = w.staff[truck.driverId - 1];
  return d?.owner ? wagesFor(w.cfg, truck, driven) : 0;
}
