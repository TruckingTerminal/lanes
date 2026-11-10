import type { Truck, World } from "@lanes/engine";

/**
 * The number a player knows a truck by (client batch 8a, items 1 and 19): one per truck, given once in the company's own
 * sequence and never changed or reused. Before, the number was the truck's place in the company's list, so a truck the
 * lender took renumbered every truck after it, and a few lines printed the engine's id ("truck 897").
 *
 * Numbers are given in id order to every truck a person's company holds that has none yet, after each hour the page steps
 * (booksAfterHour, so a reload's replay gives the same numbers) and at a lookup between hours (a truck bought this minute).
 * Kept per world, in the page only; nothing in the engine.
 */
const NOS = new WeakMap<World, Map<number, { next: number; byTruck: Map<number, number> }>>();
/** Every number given in a world, by truck: a truck that left its company (taken, sold) keeps the number it had. */
const BY_ID = new WeakMap<World, Map<number, number>>();

function numbersFor(w: World, companyId: number): { next: number; byTruck: Map<number, number> } {
  let all = NOS.get(w);
  if (!all) NOS.set(w, (all = new Map()));
  let c = all.get(companyId);
  if (!c) all.set(companyId, (c = { next: 1, byTruck: new Map() }));
  const trucks = (w.trucksByCompany.get(companyId) ?? []).filter((t) => t.status !== "retired" && !c!.byTruck.has(t.id));
  let ids = BY_ID.get(w);
  if (!ids) BY_ID.set(w, (ids = new Map()));
  for (const t of trucks.sort((x, y) => x.id - y.id)) {
    c.byTruck.set(t.id, c.next);
    ids.set(t.id, c.next++);
  }
  return c;
}

/** Numbers every person's company's new trucks (after each hour the page steps). */
export function numberTrucks(w: World): void {
  for (const c of w.companies) if (c.human) numbersFor(w, c.id);
}

/** The truck's number in its company (0 for a truck no company holds). */
export function truckNumber(w: World, t: Pick<Truck, "id" | "companyId">): number {
  const mine = t.companyId ? numbersFor(w, t.companyId).byTruck.get(t.id) : undefined;
  return mine ?? BY_ID.get(w)?.get(t.id) ?? 0;
}
