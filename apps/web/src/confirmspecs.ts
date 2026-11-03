import { condition, dayOf, leaseValueFd, effectiveMpg, fuelPrice, hubMiles, maintenancePerMile, rebuildable, rebuildCost, tractorLifeUsed, tractorScrapFd, truckValue, type Company, type Truck, type TruckSpec, type World } from "@lanes/engine";
import type { Equipment, TractorTier } from "@lanes/config";
import { CONFIRM } from "./copy.js";
import { fdFull, pct, shortDate, TIER_NAME, TRAILER_NAME } from "./format.js";

/**
 * What the confirm card says for each kind of act (the writer's copy-player2.md, R6): "what it does" and "the one risk",
 * from this company's own figures. Read from the world, saving nothing.
 */
export interface Lines {
  does: string;
  risk: string | null;
}

const make = (tier: TractorTier, trailer: Equipment): string => `${TIER_NAME[tier]} with a ${TRAILER_NAME[trailer].toLowerCase()}`;
const rebuildsLeft = (w: World, t: Pick<TruckSpec, "odometer" | "rebuilds">): number => (rebuildable(w.cfg, t) ? Math.max(0, w.cfg.assets.tractor.maxRebuilds - (t.rebuilds ?? 0)) : 0);

/** A used truck: worn with rebuilds left, or past its last; and, standing away from home, where (a listing). */
export function usedTruck(w: World, c: Company, t: TruckSpec & { tier: TractorTier; trailer: Equipment }, at?: number): Lines {
  const left = rebuildsLeft(w, t);
  const scrap = w.cfg.assets.tractor.scrapShare * w.cfg.dealerFd.tractor[t.tier];
  const base: Lines =
    left > 0
      ? { does: CONFIRM.usedFresh(make(t.tier, t.trailer), pct(condition(w.cfg, t)), left), risk: CONFIRM.usedFreshRisk(fdFull(rebuildCost(w.cfg, t))) }
      : { does: CONFIRM.usedLast(make(t.tier, t.trailer), pct(1 - tractorLifeUsed(w.cfg, t))), risk: CONFIRM.usedLastRisk(fdFull(scrap)) };
  if (at === undefined || at === c.homeHub) return base;
  const mi = Math.round(hubMiles(w, c.homeHub, at)).toLocaleString("en-US");
  return { does: `${base.does} ${CONFIRM.usedAway(w.net.hubs[at]!.name, mi)}`, risk: `${base.risk} ${CONFIRM.usedAwayRisk}` };
}

export const newTruck = (w: World, tier: TractorTier, trailer: Equipment, days: number): Lines => ({ does: CONFIRM.newTruck(make(tier, trailer), shortDate(dayOf(w.t, w.cfg) + days)), risk: CONFIRM.newRisk });

/** The deposit an extra lease takes today, and its weekly minimum (capacity.ts leaseTruck, chargeMinimumRent). */
export function leaseDepositNow(w: World, trailer: Equipment): number {
  const k = w.cfg.freeEntry.leases.byValue;
  return k.enabled ? k.depositShare * leaseValueFd(w.cfg, { tier: "workhorse", trailer, lease: "lessor" }) : 0;
}
export function leaseWeeklyMin(w: World, trailer: Equipment): number {
  const k = w.cfg.freeEntry.leases;
  return Math.max(k.minWeeklyFd, k.byValue.enabled ? k.byValue.weeklyShareOfValue * leaseValueFd(w.cfg, { tier: "workhorse", trailer, lease: "lessor" }) : 0);
}

export const leaseTruck = (w: World, trailer: Equipment, depositFd: number, minWeeklyFd: number): Lines => ({
  does: CONFIRM.lease(make("workhorse", trailer), fdFull(depositFd), fdFull(minWeeklyFd)),
  risk: CONFIRM.leaseRisk(w.cfg.freeEntry.leases.minTermDays),
});

export const trailer = (type: Equipment): Lines => ({ does: CONFIRM.trailer(TRAILER_NAME[type].toLowerCase()), risk: CONFIRM.trailerRisk });

export const rebuild = (w: World, t: Truck): Lines => ({ does: CONFIRM.rebuild, risk: CONFIRM.rebuildRisk(Math.max(0, w.cfg.assets.tractor.maxRebuilds - t.rebuilds - 1), w.cfg.assets.tractor.maxRebuilds) });

export const scrap = (w: World, t: Truck, n: number): Lines => ({ does: CONFIRM.scrap(n, fdFull(tractorScrapFd(w, t))), risk: CONFIRM.scrapRisk(fdFull(truckValue(w, t))) });

export const sell = (n: number, askFd: number): Lines => ({ does: CONFIRM.sell(n, fdFull(askFd)), risk: CONFIRM.sellRisk });

export const hire = (name: string, weeklyFd: number, keptFd: number): Lines => ({ does: CONFIRM.hire(name, fdFull(weeklyFd)), risk: CONFIRM.hireRisk(fdFull(keptFd)) });

/**
 * What the company kept in a week lately: last month's result over its weeks, else its result so far over its weeks
 * (player2-ux.md: a hire asks only when the wage passes this).
 */
export function weeklyKept(w: World, c: Company): number {
  const perMonth = w.cfg.time.daysPerMonth / 7;
  if (c.lastMonth) return (c.lastMonth.revenueFd - c.lastMonth.spentFd) / perMonth;
  const weeks = Math.max(1, (dayOf(w.t, w.cfg) - c.createdDay) / 7);
  return (c.operating.revenueFd - c.operating.costFd) / weeks;
}

/** A fitted item: what it cuts on this truck, and its payback from this truck's own miles, when it has a record. */
export function item(w: World, c: Company, m: "apu" | "aero" | "tires" | "sleeper", t: Truck, n: number, priceFd: number): Lines {
  const weeks = Math.max(0, (dayOf(w.t, w.cfg) - Math.max(c.createdDay, t.builtDay ?? c.createdDay)) / 7);
  const perWeekMi = weeks >= 2 ? (t.loadedMi + t.emptyMi) / weeks : 0;
  const saving = m === "aero" ? (perWeekMi / effectiveMpg(w.cfg, t)) * fuelPrice(w) * 0.05 : m === "tires" ? perWeekMi * maintenancePerMile(w.cfg, t) * 0.2 : 0;
  // A payback over ten years is a record too thin to read (QA: "5555 weeks" on a truck that had barely run): unknown.
  const weeksBack = saving > 0.5 ? Math.ceil(priceFd / saving) : Infinity;
  const payback = weeksBack <= 520 ? String(weeksBack) : null;
  const does = m === "apu" ? CONFIRM.item.apu(n, "half") : m === "aero" ? CONFIRM.item.aero(n, "5%") : m === "tires" ? CONFIRM.item.tires(n, "20%") : CONFIRM.item.sleeper("half");
  return { does, risk: payback ? CONFIRM.itemRisk[m](payback) : CONFIRM.paybackUnknown };
}

export const contract = (origin: string, dest: string, perWeek: number, rate: number, weeks: number): Lines => ({ does: CONFIRM.contract(origin, dest, perWeek, rate.toFixed(2), weeks), risk: CONFIRM.contractRisk });
