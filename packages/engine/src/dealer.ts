import type { Equipment, TractorTier } from "@lanes/config";
import { dayOf } from "./clock.js";
import { clamp } from "./economics.js";
import type { Company, TruckOrder } from "./types.js";
import { marketValue, newPrice, type TruckSpec } from "./wear.js";
import { createTruck, freshPaperwork, type World } from "./world.js";

/** The dealer's price today for this tractor + trailer: list price × each part's supply-and-demand index. */
export function dealerPrice(w: World, t: Pick<TruckSpec, "tier" | "trailer">): number {
  const { cfg, dealerIndex: idx } = w;
  return cfg.dealerFd.tractor[t.tier] * idx.tractor[t.tier] + cfg.dealerFd.trailer[t.trailer] * idx.trailer[t.trailer];
}

/** A truck's used value today: its year, mileage and wear, against what the same truck costs new today. */
export function truckValue(w: World, t: TruckSpec & { builtDay: number }): number {
  return marketValue(w.cfg, t, dayOf(w.t, w.cfg)) * (dealerPrice(w, t) / newPrice(w.cfg, t));
}

/**
 * Monthly (design proposal, Jeff 2026-10-28): each tractor tier and trailer type
 * moves a third of the way toward a price set by demand — the dealer's order
 * backlog — and supply — how much of its cap is left.
 */
export function monthlyDealerPrices(w: World): void {
  const k = w.cfg.dealerPrices;
  const base = w.cfg.dealerDelivery.baseDays;
  const backlog = clamp((deliveryDays(w) - base) / base, 0, 1);
  const target = (left: number, cap: number) => 1 + k.backlogWeight * backlog + clamp(k.scarcityWeight * (k.scarceBelow - left / Math.max(1, cap)), -0.15, 0.35);
  const move = (idx: number, to: number) => clamp(idx + k.stepShare * (to - idx), k.range[0], k.range[1]);
  for (const tier of ["workhorse", "highwayPro", "flagship"] as const) {
    w.dealerIndex.tractor[tier] = move(w.dealerIndex.tractor[tier], target(w.supply.tractor[tier], w.supplyCap.tractor[tier]));
  }
  for (const eq of ["van", "reefer", "flatbed"] as const) {
    w.dealerIndex.trailer[eq] = move(w.dealerIndex.trailer[eq], target(w.supply.trailer[eq], w.supplyCap.trailer[eq]));
  }
}

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
        idleSinceDay: day,
        defects: 0,
      });
      freshPaperwork(npc);
    }
    const delivered = npc ?? createTruck(w, company, "owned", o.tier, o.trailer);
    w.metrics.onTruckDelivered();
    w.listener?.({ kind: "truckDelivered", companyId: company.id, truckId: delivered.id });
  }
  w.orders = waiting;
}
