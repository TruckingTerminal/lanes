import { crewed, type Company, type World } from "@lanes/engine";

/**
 * The first load's lock (Jeff, 2026-11-04: a real tutorial, where no other menu opens until the first load is booked).
 * Read from the world, never saved: a carrier with no bid or booking by hand, no load on a truck and nothing delivered
 * is locked to Truck and Loads; Money, More and everything under them wait. The beats she says meanwhile are
 * copy.ts TUTORIAL, played by ui/Walkthrough.tsx FirstLoad.
 */
export const FIRST_LOAD_TABS: readonly string[] = ["fleet", "loads"];

/**
 * Whether a tab is shut by the first load's lock. Client batch 8a item 47 (the stubborn specialist: More said Staff was
 * locked, "First, a load", while What now?'s HIRE A DRIVER opened it): one answer from every door. Hiring is allowed
 * before the first load, and the one reason to hire then is a truck with no driver; with one, Staff and More (the way
 * to it) open, as Staff's own teaser does ("or a truck without a driver").
 */
export function tabLocked(w: World, c: Company | null, tab: string): boolean {
  if (FIRST_LOAD_TABS.includes(tab) || !firstLoadLocked(w, c)) return false;
  if ((tab === "staff" || tab === "more") && hasDriverlessTruck(w, c!)) return false;
  return true;
}
const hasDriverlessTruck = (w: World, c: Company): boolean =>
  (w.trucksByCompany.get(c.id) ?? []).some((t) => !crewed(t) && t.status !== "listed" && t.status !== "parked" && t.status !== "retired");

export function firstLoadLocked(w: World, c: Company | null): boolean {
  if (!c || c.role !== "carrier" || c.liquidatingSince !== null) return false;
  if (c.firstHandBidDay !== null || c.delivered > 0) return false;
  return !(w.trucksByCompany.get(c.id) ?? []).some((t) => t.loadId !== null);
}
