import { activeLoanOn, condition, dayOf, settlementShare, leaseValueFd, purchaseLoanOn, effectiveMpg, fuelPrice, hubMiles, maintenancePerMile, rebuildable, rebuildCost, tractorLifeUsed, tractorScrapFd, truckValue, type Company, type Truck, type TruckSpec, type World } from "@lanes/engine";
import type { Equipment, TractorTier } from "@lanes/config";
import { CONFIRM } from "./copy.js";
import { MILES_PER_MONTH } from "./finance.js";
import { fdFull, pct, shortDate, TIER_NAME, TRAILER_NAME } from "./format.js";
import { PENDING } from "./copy-pending.js";

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
      : // Client batch 8b item 28: condition and life named apart, each for what it is.
        { does: PENDING.usedLastNamed(make(t.tier, t.trailer), pct(condition(w.cfg, t)), pct(1 - tractorLifeUsed(w.cfg, t))), risk: CONFIRM.usedLastRisk(fdFull(scrap)) };
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

/**
 * The sell sheet (client batch 8b items 8 and 18, the director's order): what it does, then the price's path to its
 * floor, the cost of waiting, the end; the buyer line above the starters' band; and the truck's loans, repaid first.
 */
export function sell(w: World, t: Truck, n: number, askFd: number, floorShare = 0.6, stepShare = 0.05): Lines {
  const floor = fdFull(askFd * floorShare);
  const weeks = Math.round((1 - floorShare) / stepShare);
  // QA's 0.24.1 replay, fail 3 (the producer: said plainly, before listing): the crew comes off the truck when it's
  // listed (market.ts listTruck), right after what the sale is.
  const crew = [t.driverId, t.coDriverId].filter((id) => id > 0).map((id) => w.staff[id - 1]!);
  const hired = crew.filter((s) => !s.owner).map((s) => s.name);
  const crewLines = [...(hired.length ? [PENDING.sellCrew(hired, w.cfg.labor.morale.unseatedWeeks)] : []), ...(crew.some((s) => s.owner) ? [PENDING.sellOwnerOff] : [])];
  // token.settlementFee: folded into the market's fee as one named line (the director: one fee, not a stack); off, unsaid.
  const settle = settlementShare(w.cfg);
  const feeLine = settle > 0 ? [PENDING.sellFees(pct(w.cfg.usedMarket.feePct + settle), fdFull(askFd * (w.cfg.usedMarket.feePct + settle)))] : [];
  const does = [CONFIRM.sell(n, fdFull(askFd)), ...crewLines, ...feeLine, PENDING.sellPath(pct(stepShare), pct(floorShare), floor, weeks), PENDING.sellEnd(floor)];
  const risk = [PENDING.sellWaiting(fdFull(w.cfg.costs.idleFeePerDay))];
  if (askFd > STARTERS_BAND_FD) risk.push(PENDING.sellFewBuyers);
  const pl = purchaseLoanOn(w, t.id);
  const fl = activeLoanOn(w, t.id);
  const owed = (pl && (pl.status === "active" || pl.status === "defaulted") ? pl.principalFd : 0) + (fl ? fl.principalFd : 0);
  if (owed > 0.5) risk.push(PENDING.sellLoan(fdFull(owed), !!pl));
  return { does: does.join(" "), risk: risk.join(" ") };
}

/** What a starter's spare cash buys up to (the economy's listing-worth note): above it, few buyers. */
export const STARTERS_BAND_FD = 60_000;
/** What such a truck really sells for, by how sure that is (the director's listing-worth ruling §1). */
export function sellsFor(bookFd: number): string {
  if (bookFd <= STARTERS_BAND_FD) return PENDING.sellsUsually(fdFull(Math.round((bookFd * 0.9) / 100) * 100));
  const k = (x: number) => `${Math.round(x / 1000)}k`;
  return PENDING.sellsFew(k(bookFd * 0.6), k(bookFd * 0.8));
}

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

/**
 * A fitted item's weekly saving, from the engine's own effects (economics.ts tripCost, step.ts, labor.ts): an aero kit
 * 5% of the fuel per mile, premium tires 20% of the maintenance per mile, an APU half the idle fuel
 * (costs.idleFuelGalPerDay) and a sleeper half the per diem (labor.driver.perDiemFd) on each night the truck sits. Miles
 * a week are this truck's own once it has run two weeks, else a typical month's (MILES_PER_MONTH); the nights it sits
 * are the week's days its miles leave undriven at hos.avgMph for hos.drivingHoursPerDay.
 */
export function itemSaving(w: World, c: Company, m: "apu" | "aero" | "tires" | "sleeper", t: Truck): { perWeekFd: number; perWeekMi: number; ownRecord: boolean } {
  const weeks = Math.max(0, (dayOf(w.t, w.cfg) - Math.max(c.createdDay, t.builtDay ?? c.createdDay)) / 7);
  const ownRecord = weeks >= 2 && t.loadedMi + t.emptyMi > 0;
  const perWeekMi = ownRecord ? (t.loadedMi + t.emptyMi) / weeks : (MILES_PER_MONTH * 7) / w.cfg.time.daysPerMonth;
  const nights = Math.max(0, 7 - perWeekMi / (w.cfg.hos.avgMph * w.cfg.hos.drivingHoursPerDay));
  const perWeekFd =
    m === "aero"
      ? (perWeekMi / effectiveMpg(w.cfg, t)) * fuelPrice(w) * 0.05
      : m === "tires"
        ? perWeekMi * maintenancePerMile(w.cfg, t) * 0.2
        : m === "apu"
          ? nights * w.cfg.costs.idleFuelGalPerDay * fuelPrice(w) * 0.5
          : nights * w.cfg.labor.driver.perDiemFd * 0.5;
  return { perWeekFd, perWeekMi, ownRecord };
}

/** A fitted item: what it cuts on this truck, and its payback in weeks at that saving. */
export function item(w: World, c: Company, m: "apu" | "aero" | "tires" | "sleeper", t: Truck, n: number, priceFd: number): Lines {
  const saving = itemSaving(w, c, m, t).perWeekFd;
  const payback = saving > 0.5 ? Math.ceil(priceFd / saving).toLocaleString("en-US") : null;
  const does = m === "apu" ? CONFIRM.item.apu(n, "half") : m === "aero" ? CONFIRM.item.aero(n, "5%") : m === "tires" ? CONFIRM.item.tires(n, "20%") : CONFIRM.item.sleeper("half");
  return { does, risk: payback ? CONFIRM.itemRisk[m](payback) : CONFIRM.paybackUnknown };
}

export const contract = (origin: string, dest: string, perWeek: number, rate: number, weeks: number): Lines => ({ does: CONFIRM.contract(origin, dest, perWeek, rate.toFixed(2), weeks), risk: CONFIRM.contractRisk });
