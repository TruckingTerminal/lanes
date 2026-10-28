import type { EconomyConfig } from "@lanes/config";
import type { Truck } from "./types.js";

/**
 * The parts of a truck that set its running costs. The crew and policy fields
 * (labor.ts, safety.ts) default to a typical driver on full maintenance.
 */
export type TruckSpec = Pick<Truck, "tier" | "trailer" | "lease" | "odometer" | "milesSinceRebuild"> &
  Partial<Pick<Truck, "driverSkill" | "wagePerMile" | "maintPolicyMult" | "insuranceMult" | "defects">>;

/** A driver's skill against the middle (0.5): positive is better than typical. */
const skillOffset = (t: Partial<Pick<Truck, "driverSkill">>) => (t.driverSkill ?? 0.5) - 0.5;

/**
 * Condition 1 (fresh) → 0 (worn out) with miles since the last rebuild
 * (§Assets — wear and rebuild). NPC-leased trucks are serviced by the lessor and
 * hold a fixed condition (lessor trucks too).
 */
export function condition(cfg: EconomyConfig, t: Pick<TruckSpec, "lease" | "milesSinceRebuild">): number {
  if (t.lease !== "owned") return cfg.wear.npcLeaseCondition;
  return Math.max(0, Math.min(1, 1 - t.milesSinceRebuild / cfg.wear.lifeMiles));
}

/** Million-mile trucks: a level every 50,000 miles, max 20 (§Assets). */
export function truckLevel(cfg: EconomyConfig, odometer: number): number {
  return Math.min(cfg.wear.maxLevel, Math.floor(odometer / cfg.wear.milesPerLevel));
}

/** +1% fuel efficiency every 5 levels, max +4%. */
export function levelFuelBonus(cfg: EconomyConfig, odometer: number): number {
  return Math.min(cfg.wear.maxFuelBonus, Math.floor(truckLevel(cfg, odometer) / 5) * cfg.wear.fuelBonusPerFiveLevels);
}

export function effectiveMpg(cfg: EconomyConfig, t: TruckSpec): number {
  const wear = 1 - condition(cfg, t);
  return cfg.tractors[t.tier].mpg * (1 - cfg.wear.mpgLossWorn * wear) * (1 + levelFuelBonus(cfg, t.odometer)) * (1 + cfg.labor.driver.mpgRange * skillOffset(t));
}

/** Maintenance per mile × this: wear, the driver (a good one is easier on the truck), and the company's policy (deferred is cheaper, for now). */
export function maintMultiplier(cfg: EconomyConfig, t: TruckSpec): number {
  return (1 + cfg.wear.maintRiseWorn * (1 - condition(cfg, t))) * (1 - cfg.labor.driver.maintRange * skillOffset(t)) * (t.maintPolicyMult ?? 1);
}

/**
 * Expected breakdowns per 1,000 miles: tier-weighted, rising with the square of
 * wear and with age (§Events — breakdown). A rebuild resets wear, not age.
 */
export function breakdownsPer1000Mi(cfg: EconomyConfig, t: TruckSpec): number {
  const wear = 1 - condition(cfg, t);
  const age = t.lease !== "owned" ? 1 : 1 + t.odometer / cfg.breakdowns.ageMi;
  const crew = 1 - cfg.labor.driver.maintRange * skillOffset(t);
  const defects = 1 + cfg.safety.maintenance.breakdownPerDefect * (t.defects ?? 0);
  return cfg.breakdowns.per1000MiNew * cfg.tractors[t.tier].breakdownMult * (1 + cfg.breakdowns.wornMultiplier * wear * wear) * age * crew * defects;
}

/** What a rebuild costs: more the older the truck (×2 at 500k miles). */
export function rebuildCost(cfg: EconomyConfig, t: Pick<TruckSpec, "tier" | "odometer">): number {
  return cfg.wear.rebuildFd[t.tier] * (1 + t.odometer / cfg.wear.rebuildAgeMi);
}

/** The dealer's price for this tractor + trailer, new. */
export function newPrice(cfg: EconomyConfig, t: Pick<TruckSpec, "tier" | "trailer">): number {
  return cfg.dealerFd.tractor[t.tier] + cfg.dealerFd.trailer[t.trailer];
}

/**
 * Used value: new price, down with mileage and age ("year/mileage"), then down
 * again for wear. NPC-leased trucks belong to the lessor and have no value to the
 * lessee.
 */
export function marketValue(cfg: EconomyConfig, t: TruckSpec & { builtDay: number }, today: number): number {
  if (t.lease !== "owned") return 0;
  const d = cfg.depreciation;
  const years = Math.max(0, today - t.builtDay) / cfg.time.daysPerSeason;
  const age = Math.max(d.floorPct, 1 - t.odometer / d.lifetimeMiles - years * d.perYear);
  return newPrice(cfg, t) * age * (1 - d.conditionWeight * (1 - condition(cfg, t)));
}

/** Expected repair bill per mile; the NPC lessor pays repairs on leased trucks. */
export function expectedRepairPerMile(cfg: EconomyConfig, t: TruckSpec): number {
  if (t.lease !== "owned") return 0;
  const [lo, hi] = cfg.breakdowns.repairFd;
  return (breakdownsPer1000Mi(cfg, t) * (lo + hi)) / 2 / 1000;
}
