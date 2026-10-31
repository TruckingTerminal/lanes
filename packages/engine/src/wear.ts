import type { EconomyConfig, Equipment } from "@lanes/config";
import type { Truck } from "./types.js";

/**
 * The parts of a truck that set its running costs. The crew and policy fields
 * (labor.ts, safety.ts) default to a typical driver on full maintenance.
 */
export type TruckSpec = Pick<Truck, "tier" | "trailer" | "lease" | "odometer" | "milesSinceRebuild"> &
  Partial<Pick<Truck, "driverSkill" | "wagePerMile" | "maintPolicyMult" | "insuranceMult" | "defects" | "rebuilds" | "trailerWear">>;

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
 * Maintenance per mile, everything in: the tractor's and the trailer's, each at its own wear (assets on;
 * with assets off the whole rig wears with the tractor), the driver, and the company's policy.
 */
export function maintenancePerMile(cfg: EconomyConfig, t: TruckSpec): number {
  const tractor = cfg.tractors[t.tier].maintPerMile;
  const trailer = cfg.trailers[t.trailer].maintPerMile;
  if (!cfg.assets.enabled) return (tractor + trailer) * maintMultiplier(cfg, t);
  const crew = (1 - cfg.labor.driver.maintRange * skillOffset(t)) * (t.maintPolicyMult ?? 1);
  const tractorWear = 1 + cfg.wear.maintRiseWorn * (1 - condition(cfg, t));
  const trailerWear = 1 + cfg.assets.trailer.maintRiseWorn * (t.trailerWear ?? 0);
  return (tractor * tractorWear + trailer * trailerWear) * crew;
}

/**
 * Assets: the share of a tractor's life used, by miles or by rebuilds spent and wear. At 1 it can't be
 * rebuilt again and runs until it's worn out.
 */
export function tractorLifeUsed(cfg: EconomyConfig, t: Pick<TruckSpec, "lease" | "odometer" | "milesSinceRebuild" | "rebuilds">): number {
  const a = cfg.assets.tractor;
  return Math.min(1, Math.max(t.odometer / a.lifeMi, ((t.rebuilds ?? 0) + 1 - condition(cfg, t)) / (a.maxRebuilds + 1)));
}

/** Assets: may this tractor be rebuilt again (rebuilds and miles left)? Always, with assets off. */
export function rebuildable(cfg: EconomyConfig, t: Pick<TruckSpec, "odometer" | "rebuilds">): boolean {
  if (!cfg.assets.enabled) return true;
  return (t.rebuilds ?? 0) < cfg.assets.tractor.maxRebuilds && t.odometer < cfg.assets.tractor.lifeMi;
}

/** Assets: a tractor at the end of its life, worn out with no rebuild left: it goes for scrap at the next hub. */
export function tractorWornOut(cfg: EconomyConfig, t: TruckSpec): boolean {
  return cfg.assets.enabled && t.lease === "owned" && !rebuildable(cfg, t) && condition(cfg, t) <= cfg.assets.tractor.scrapAtCondition;
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
 * What an NPC lease is priced on (freeEntry.leases.byValue): a new rig at list for an extra lease, an older
 * one for the free path's truck.
 */
export function leaseValueFd(cfg: EconomyConfig, t: Pick<TruckSpec, "tier" | "trailer" | "lease">): number {
  return newPrice(cfg, t) * (t.lease === "npc" ? cfg.freeEntry.leases.byValue.starterValueShare : 1);
}

/**
 * Used value: new price, down with mileage and age ("year/mileage"), then down
 * again for wear. NPC-leased trucks belong to the lessor and have no value to the
 * lessee.
 */
export function marketValue(cfg: EconomyConfig, t: TruckSpec & { builtDay: number }, today: number): number {
  if (t.lease !== "owned") return 0;
  if (cfg.assets.enabled) return tractorMarketValue(cfg, t, today);
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

/**
 * Assets: a tractor's used value alone, against its list price: down with the share of its life used
 * and with age, to its scrap value at the end, then down again for wear. (The trailer it pulls is
 * valued on its own: trailerMarketValue.)
 */
export function tractorMarketValue(cfg: EconomyConfig, t: TruckSpec & { builtDay: number }, today: number): number {
  if (t.lease !== "owned") return 0;
  const d = cfg.depreciation;
  const years = Math.max(0, today - t.builtDay) / cfg.time.daysPerSeason;
  const left = Math.max(cfg.assets.tractor.scrapShare, 1 - tractorLifeUsed(cfg, t) - years * d.perYear);
  return cfg.dealerFd.tractor[t.tier] * left * (1 - d.conditionWeight * (1 - condition(cfg, t)));
}

/** Assets: a trailer's used value, the same way, from its share of life used, age and wear. */
export function trailerMarketValue(cfg: EconomyConfig, tr: { type: Equipment; lease: string; builtDay: number }, lifeUsed: number, wear: number, today: number): number {
  if (tr.lease !== "owned") return 0;
  const d = cfg.depreciation;
  const years = Math.max(0, today - tr.builtDay) / cfg.time.daysPerSeason;
  const left = Math.max(cfg.assets.trailer.scrapShare, 1 - lifeUsed - years * d.perYear * 0.5); // trailers age slower than tractors
  return cfg.dealerFd.trailer[tr.type] * left * (1 - d.conditionWeight * wear);
}
