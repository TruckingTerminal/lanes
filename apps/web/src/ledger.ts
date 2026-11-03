import { insuredValue, leaseValueFd, stakeDiscount, yardPerTruck, type Company, type Truck, type World } from "@lanes/engine";

/**
 * Money as a ledger (specs/first-ten-minutes.md, S8): what is owed to the company and when, what this week will cost
 * it, and its standing, each read from the same rules that bill it (capacity.ts chargeMinimumRent, insurance.ts
 * billInsurance, home.ts chargeYards, labor.ts per diem), without touching the world.
 */

export interface Invoice {
  id: number;
  amountFd: number;
  dueDay: number;
}

/** The company's open invoices, soonest due first. */
export function invoices(w: World, c: Company): Invoice[] {
  return w.receivables
    .filter((r) => r.holder === c.id)
    .map((r) => ({ id: r.id, amountFd: r.amountFd, dueDay: r.dueDay }))
    .sort((a, b) => a.dueDay - b.dueDay || a.id - b.id);
}

export interface WeekCosts {
  /** Leased trucks whose share of the week's loads falls short of the rent pay the difference: the most this can be. */
  leaseMinimum: number;
  insurance: number;
  yard: number;
  /** Per diem a day for each driver idle away from home a day or more, now. */
  perDiemPerDay: number;
}

/**
 * A leased truck's weekly minimum, as capacity.ts chargeMinimumRent bills it: the larger of the flat minimum (an extra
 * lease) and the by-value share. The one figure the truck card, Finance, What now? and the Dealer all show (QA's R20
 * replay: the card said 250 where the lease row said 910). 0 for a truck that isn't leased.
 */
export function leaseMinFor(w: World, t: Truck): number {
  const rules = w.cfg.freeEntry.leases;
  const leased = t.lease === "lessor" || (rules.byValue.enabled && t.lease === "npc");
  if (!leased) return 0;
  const byValue = rules.byValue.enabled ? rules.byValue.weeklyShareOfValue * leaseValueFd(w.cfg, t) : 0;
  return Math.max(t.lease === "lessor" ? rules.minWeeklyFd : 0, byValue);
}

export function weekCosts(w: World, c: Company): WeekCosts {
  const rules = w.cfg.freeEntry.leases;
  const trucks = (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired");
  let leaseMinimum = 0;
  for (const t of trucks) leaseMinimum += leaseMinFor(w, t);
  // The lessor's policy covers its own trucks; the company's covers the rest that are on the road.
  const insured = trucks.filter((t) => t.lease !== "npc" && t.status !== "parked" && t.status !== "listed").length;
  const pd = insured && w.cfg.assets.enabled ? (w.cfg.assets.physicalDamage.annualShareOfValue * insuredValue(w, c)) / 52 : 0;
  const insurance = insured ? ((insured * c.insurance.annualPerTruck) / 52 + pd) * (1 - stakeDiscount(w, c)) : 0;
  const yard = Math.max(0, trucks.length - 1) * yardPerTruck(w, c);
  const day = w.cfg.time.gameMinutesPerDay;
  let perDiemPerDay = 0;
  for (const t of trucks) {
    if (t.status !== "idle" || t.hub === c.homeHub || w.t - t.idleSinceT < day) continue;
    perDiemPerDay += w.cfg.labor.driver.perDiemFd * (t.mods.sleeper ? 0.5 : 1);
  }
  return { leaseMinimum, insurance, yard, perDiemPerDay };
}

/** Miles: the company's standing in the beta. */
export const milesOf = (c: Company): number => c.milesHistory.reduce((a, b) => a + b, 0) + c.milesTotal;
