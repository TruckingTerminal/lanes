/**
 * Player lessors (assets.enabled; the EVE plan, step 4, Jeff 2026-10-30). An owner leases a tractor to
 * another carrier by the week, for a minimum term it sets. The tractor runs under the lessee: its crew,
 * its trailer (a spare from its yard or a rental), its fuel and maintenance, its insurance. The title
 * stays the lessor's: the lessee can't sell, borrow against, rebuild or scrap it, a write-off's payout
 * and the scrap value go to the lessor, and any loan stays the lessor's. The lessor's own trailer stays
 * in the lessor's yard. The free path keeps its NPC lease, so newcomers never depend on a player.
 */
import { dayOf } from "./clock.js";
import { companyAccount } from "./ledger.js";
import { notice } from "./safety.js";
import { fitTrailer, unhook } from "./trailers.js";
import type { Company, LeaseOffer, Truck } from "./types.js";
import { freshPaperwork, staffById, syncTruck, unseatDriver, type World } from "./world.js";
import { tractorOrdersOf } from "./dealer.js";
import { truckCap } from "./staking.js";
import { chargeSettlement } from "./settlement.js";

export const openLeaseOffers = (w: World): LeaseOffer[] => w.leaseOffers.filter((o) => o.status === "open");

/** Leased out to another carrier (the operator isn't the owner). */
export const leasedOut = (t: Truck): boolean => t.lessorId !== 0 && t.lessorId !== t.companyId;

function unseatCrew(w: World, truck: Truck): void {
  if (truck.coDriverId) unseatDriver(w, staffById(w, truck.coDriverId));
  if (truck.driverId) unseatDriver(w, staffById(w, truck.driverId));
}

function moveFleet(w: World, truck: Truck, to: Company): void {
  const from = w.trucksByCompany.get(truck.companyId);
  if (from) {
    const i = from.indexOf(truck);
    if (i >= 0) from.splice(i, 1);
  }
  truck.companyId = to.id;
  w.trucksByCompany.get(to.id)!.push(truck);
}

/** Offers an idle owned tractor for lease. It parks off the road; its own trailer waits in the yard. */
export function offerLease(w: World, c: Company, truck: Truck, weeklyFd: number, minWeeks: number): string | null {
  const k = w.cfg.assets.playerLeases;
  if (!w.cfg.assets.enabled) return "no player leases";
  if (truck.companyId !== c.id || truck.lease !== "owned" || leasedOut(truck)) return "not a truck you own";
  if (truck.status !== "idle" && truck.status !== "parked") return "the truck must be idle or parked at a hub";
  if (weeklyFd < k.weeklyFdRange[0] || weeklyFd > k.weeklyFdRange[1]) return `a weekly rent between ${k.weeklyFdRange[0]} and ${k.weeklyFdRange[1]} FD`;
  if (!Number.isInteger(minWeeks) || minWeeks < 1 || minWeeks > k.maxMinWeeks) return `a minimum term of 1 to ${k.maxMinWeeks} weeks`;
  if (w.listings.some((l) => l.truckId === truck.id && l.status === "open")) return "it's for sale";
  if (openLeaseOffers(w).some((o) => o.truckId === truck.id)) return "it's already offered";
  unseatCrew(w, truck);
  unhook(w, truck);
  truck.status = "parked";
  w.manualBids.delete(truck.id);
  w.leaseOffers.push({ id: w.leaseOffers.length + 1, truckId: truck.id, lessorId: c.id, weeklyFd, minWeeks, listedDay: dayOf(w.t, w.cfg), status: "open" });
  return null;
}

export function withdrawLeaseOffer(w: World, c: Company, offerId: number): string | null {
  const o = w.leaseOffers[offerId - 1];
  if (!o || o.status !== "open" || o.lessorId !== c.id) return "no such offer";
  o.status = "withdrawn";
  return null;
}

/** Takes a tractor on lease: it joins the lessee's fleet at the hub where it stands, with the lessee's trailer. */
export function takeLease(w: World, lessee: Company, o: LeaseOffer): string | null {
  if (!w.cfg.assets.enabled) return "no player leases";
  if (o.status !== "open") return "that offer is gone";
  if (o.lessorId === lessee.id) return "your own truck";
  if (lessee.role !== "carrier") return "only carriers run trucks";
  if (lessee.liquidatingSince !== null) return "in liquidation";
  const fleet = w.trucksByCompany.get(lessee.id)!;
  if (fleet.length + tractorOrdersOf(w, lessee.id).length >= truckCap(w, lessee)) return "company truck cap";
  const truck = w.trucks[o.truckId - 1]!;
  if (truck.companyId !== o.lessorId || truck.status !== "parked") return "that truck isn't available";
  const today = dayOf(w.t, w.cfg);
  moveFleet(w, truck, lessee);
  truck.lessorId = o.lessorId;
  truck.leaseWeekFd = o.weeklyFd;
  truck.leaseMinUntilDay = today + o.minWeeks * 7;
  truck.status = "idle";
  truck.idleRounds = 0;
  truck.idleSinceDay = today;
  truck.idleSinceT = w.t;
  freshPaperwork(truck);
  fitTrailer(w, truck, truck.trailer);
  syncTruck(w, truck);
  o.status = "taken";
  w.metrics.onPlayerLease();
  notice(w, o.lessorId, "fleet", `Truck ${truck.id} went out on lease at ${Math.round(o.weeklyFd)} FD a week for at least ${o.minWeeks} weeks.`, "good", truck.id);
  return null;
}

/**
 * The tractor goes back to its owner where it stands, idle: the lessee's trailer stays with the lessee (in
 * its yard, or back to the lessor if a rental). Handed back inside the minimum term, the lessee owes the
 * rest of it, unless `waive` (a liquidation on either side).
 */
export function endPlayerLease(w: World, truck: Truck, waive = false): string | null {
  if (!leasedOut(truck)) return "not a leased truck";
  if (truck.status !== "idle" && truck.status !== "parked") return "the truck must be idle at a hub";
  const lessee = w.companies[truck.companyId - 1]!;
  const lessor = w.companies[truck.lessorId - 1]!;
  const today = dayOf(w.t, w.cfg);
  if (!waive && today < truck.leaseMinUntilDay) {
    const owed = (Math.ceil((truck.leaseMinUntilDay - today) / 7) * truck.leaseWeekFd);
    if (owed > 0.01) w.ledger.post(w.t, companyAccount(lessee.id), companyAccount(lessor.id), owed, `lease:term:${truck.id}`);
  }
  unseatCrew(w, truck);
  unhook(w, truck);
  w.manualBids.delete(truck.id);
  moveFleet(w, truck, lessor);
  truck.lessorId = 0;
  truck.leaseWeekFd = 0;
  truck.leaseMinUntilDay = 0;
  truck.status = "idle";
  truck.idleRounds = 0;
  truck.idleSinceDay = today;
  truck.idleSinceT = w.t;
  freshPaperwork(truck);
  fitTrailer(w, truck, truck.trailer);
  syncTruck(w, truck);
  notice(w, lessor.id, "fleet", `Truck ${truck.id} came back off lease.`, "info", truck.id);
  return null;
}

/** Weekly: every lessee pays its lessor the week's rent. */
export function billPlayerLeases(w: World): void {
  if (!w.cfg.assets.enabled) return;
  for (const t of w.trucks) {
    if (!leasedOut(t) || t.status === "retired") continue;
    w.ledger.post(w.t, companyAccount(t.companyId), companyAccount(t.lessorId), t.leaseWeekFd, `lease:week:${t.id}`);
    chargeSettlement(w, t.lessorId, t.companyId, t.leaseWeekFd, `lease:week:${t.id}`); // token.settlementFee, from the lessor
    w.companies[t.companyId - 1]!.operating.costFd += t.leaseWeekFd;
  }
}
