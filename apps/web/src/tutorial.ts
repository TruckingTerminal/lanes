import type { Company, World } from "@lanes/engine";

/**
 * The first load's lock (Jeff, 2026-11-04: a real tutorial, where no other menu opens until the first load is booked).
 * Read from the world, never saved: a carrier with no bid or booking by hand, no load on a truck and nothing delivered
 * is locked to Truck and Loads; Money, More and everything under them wait. The beats she says meanwhile are
 * copy.ts TUTORIAL, played by ui/Walkthrough.tsx FirstLoad.
 */
export const FIRST_LOAD_TABS: readonly string[] = ["fleet", "loads"];

export function firstLoadLocked(w: World, c: Company | null): boolean {
  if (!c || c.role !== "carrier" || c.liquidatingSince !== null) return false;
  if (c.firstHandBidDay !== null || c.delivered > 0) return false;
  return !(w.trucksByCompany.get(c.id) ?? []).some((t) => t.loadId !== null);
}
