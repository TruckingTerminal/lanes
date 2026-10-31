/**
 * Economies of scale (Jeff, 2026-10-31: grow one large company, not many small ones): a fleet pays less
 * per gallon at the NPC pumps (fleet fuel programs), less per truck for insurance with a clean record
 * (fleet rating), and less at the NPC dealer (fleet pricing). Nothing up to `from` trucks; then a step a
 * truck to `at10` at ten trucks; then a straight line to `at50` at fifty, flat after. Off: no discounts.
 */
import type { Company } from "./types.js";
import type { World } from "./world.js";

/** The discount for a fleet of this many trucks, 0 to `at50`. */
export function scaleDiscountFor(w: World, trucks: number): number {
  const k = w.cfg.scaleDiscounts;
  if (!k.enabled || trucks <= k.from) return 0;
  if (trucks <= 10) return (k.at10 * (trucks - k.from)) / (10 - k.from);
  return Math.min(k.at50, k.at10 + ((k.at50 - k.at10) * (trucks - 10)) / 40);
}

/** This company's discount, by the trucks it runs (owned and leased, not retired). */
export function scaleDiscount(w: World, c: Company): number {
  if (!w.cfg.scaleDiscounts.enabled) return 0;
  let n = 0;
  for (const t of w.trucksByCompany.get(c.id) ?? []) if (t.status !== "retired") n++;
  return scaleDiscountFor(w, n);
}
