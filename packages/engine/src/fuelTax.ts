/**
 * The fuel tax (Jeff, 2026-10-29), modelled on IFTA: every gallon a company burns in a month, on the
 * road (trips.ts) and idling (step.ts), is taxed at the month's close at a flat rate per gallon. A sink
 * that scales with miles, so it lands hardest on the fleets that haul the most. Per-state rates wait for
 * routes that carry their states (TODO.md "terrain and weather").
 */
import { companyAccount } from "./ledger.js";
import type { World } from "./world.js";

export function monthlyFuelTax(w: World): void {
  const k = w.cfg.costs.fuelTax;
  for (const c of w.companies) {
    const gal = c.fuelGalMonth;
    c.fuelGalMonth = 0;
    if (!k.enabled || gal <= 0) continue;
    const tax = gal * k.perGal;
    w.ledger.post(w.t, companyAccount(c.id), "sink:fuel_tax", tax, `ifta:${c.id}`);
    c.operating.costFd += tax;
  }
}
