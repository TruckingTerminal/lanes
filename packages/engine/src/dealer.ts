import type { Equipment, TractorTier } from "@lanes/config";
import { dayOf } from "./clock.js";
import type { Company, TruckOrder } from "./types.js";
import { createTruck, type World } from "./world.js";

/**
 * Dealer lead time today: the base wait plus a day for every few trucks already
 * on order nationally, like an OEM backlog. Booms lengthen it, so capacity
 * ordered at the peak arrives as the market turns.
 */
export function deliveryDays(w: World): number {
  const d = w.cfg.dealerDelivery;
  return Math.min(d.maxDays, Math.round(d.baseDays + d.daysPerPendingOrder * w.orders.length));
}

export function ordersOf(w: World, companyId: number): TruckOrder[] {
  return w.orders.filter((o) => o.companyId === companyId);
}

/** Records a paid order; supply and payment are the caller's. */
export function placeOrder(w: World, company: Company, tier: TractorTier, trailer: Equipment, replaceNpcLease: boolean): TruckOrder {
  const day = dayOf(w.t, w.cfg);
  const order: TruckOrder = { id: w.nextOrderId++, companyId: company.id, tier, trailer, replaceNpcLease, orderedDay: day, dueDay: day + deliveryDays(w) };
  w.orders.push(order);
  w.metrics.onOrder();
  return order;
}

/**
 * Delivers orders that are due. A free-path truck takes over from the NPC lease
 * the next time the leased truck is idle; until then it waits at the dealer.
 */
export function deliverOrders(w: World): void {
  const day = dayOf(w.t, w.cfg);
  const waiting: TruckOrder[] = [];
  for (const o of w.orders) {
    if (o.dueDay > day) {
      waiting.push(o);
      continue;
    }
    const company = w.companies[o.companyId - 1]!;
    const fleet = w.trucksByCompany.get(company.id)!;
    const npc = o.replaceNpcLease ? fleet.find((t) => t.lease === "npc") : undefined;
    if (npc && npc.status !== "idle") {
      waiting.push(o);
      continue;
    }
    if (npc) {
      // The lease goes back to the NPC lessor; the new truck starts where it stood, and takes its ladder slot.
      Object.assign(npc, {
        lease: "owned",
        tier: o.tier,
        trailer: o.trailer,
        odometer: 0,
        milesSinceRebuild: 0,
        builtDay: day,
        breakdownMin: 0,
        idleSinceDay: day,
      });
    }
    const delivered = npc ?? createTruck(w, company, "owned", o.tier, o.trailer);
    w.metrics.onTruckDelivered();
    w.listener?.({ kind: "truckDelivered", companyId: company.id, truckId: delivered.id });
  }
  w.orders = waiting;
}
