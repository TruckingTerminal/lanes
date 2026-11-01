import type { Equipment, TractorTier } from "@lanes/config";
import { dayOf } from "./clock.js";
import { clamp } from "./economics.js";
import type { Company, Trailer, Truck, TruckOrder } from "./types.js";
import { marketValue, newPrice, tractorMarketValue, trailerMarketValue, type TruckSpec } from "./wear.js";
import { bindOrderLoan } from "./purchaseLoans.js";
import { createTruck, freshPaperwork, refundLeaseDeposit, syncTruck, unlockFreePathEarnings, type World } from "./world.js";
import { truckCap } from "./staking.js";
import { fitTrailer, handBack, hook, hookedTrailer, newTrailer, trailerCondition, trailerLifeUsed, trailersOf, unhook } from "./trailers.js";
import { notice } from "./safety.js";
import { stockOf } from "./dealerships.js";

/** The dealer's price today for this tractor + trailer: list price × each part's supply-and-demand index. */
export function dealerPrice(w: World, t: Pick<TruckSpec, "tier" | "trailer">): number {
  return tractorPrice(w, t.tier) + trailerPrice(w, t.trailer);
}

export function tractorPrice(w: World, tier: TractorTier): number {
  return w.cfg.dealerFd.tractor[tier] * w.dealerIndex.tractor[tier];
}

export function trailerPrice(w: World, type: Equipment): number {
  return w.cfg.dealerFd.trailer[type] * w.dealerIndex.trailer[type];
}

/** The NPC used lot's rig (usedMarket.npcLot), as it would be delivered today. */
export function lotSpec(w: World, trailer: Equipment): NonNullable<TruckOrder["used"]> {
  const k = w.cfg.usedMarket.npcLot;
  const life = w.cfg.assets.trailer.wearMi[trailer];
  return {
    odometer: k.odometer,
    milesSinceRebuild: k.milesSinceRebuild,
    rebuilds: k.rebuilds,
    builtDay: dayOf(w.t, w.cfg) - k.ageYears * w.cfg.time.daysPerSeason,
    trailerMilesSinceRefurb: Math.min(k.odometer, k.milesSinceRebuild * (life / w.cfg.wear.lifeMiles)),
  };
}

/** What the NPC used lot asks for a rig today: its used value (tractor and trailer), at the dealer's markup. */
export function lotPrice(w: World, tier: TractorTier, trailer: Equipment): number {
  const today = dayOf(w.t, w.cfg);
  const u = lotSpec(w, trailer);
  const tractor = tractorMarketValue(w.cfg, { tier, trailer, lease: "owned", odometer: u.odometer, milesSinceRebuild: u.milesSinceRebuild, rebuilds: u.rebuilds, builtDay: u.builtDay }, today) * w.dealerIndex.tractor[tier];
  const tr = { type: trailer, lease: "owned", odometer: u.odometer, milesSinceRefurb: u.trailerMilesSinceRefurb, refurbs: 0, builtDay: u.builtDay } as Trailer;
  const trailerV = trailerMarketValue(w.cfg, tr, trailerLifeUsed(w, tr), 1 - trailerCondition(w, tr), today) * w.dealerIndex.trailer[trailer];
  return tractor + trailerV;
}

/** Weekly: rigs come onto the NPC used lot, up to its stock. */
export function restockUsedLot(w: World): void {
  const k = w.cfg.usedMarket.npcLot;
  if (k.enabled) w.usedLot.stock = Math.min(k.stock, w.usedLot.stock + k.perWeek);
}

/** What an order costs at the dealer today: the rig, the tractor alone, or the trailer alone. */
export function orderPrice(w: World, o: Pick<TruckOrder, "kind" | "tier" | "trailer">): number {
  return o.kind === "trailer" ? trailerPrice(w, o.trailer) : o.kind === "tractor" ? tractorPrice(w, o.tier) : dealerPrice(w, o);
}

/**
 * A truck's used value today: its year, mileage and wear, against what the same truck costs new today.
 * Assets on: the tractor's value, plus the trailer it pulls if it's the owner's (a rental or NPC trailer is the lessor's).
 */
export function truckValue(w: World, t: TruckSpec & { builtDay: number; trailerId?: number }): number {
  const today = dayOf(w.t, w.cfg);
  if (!w.cfg.assets.enabled) return marketValue(w.cfg, t, today) * (dealerPrice(w, t) / newPrice(w.cfg, t));
  const tractor = tractorMarketValue(w.cfg, t, today) * w.dealerIndex.tractor[t.tier];
  const tr = t.trailerId ? w.trailers[t.trailerId - 1] : undefined;
  return tractor + (tr ? trailerValue(w, tr) : 0);
}

/** Assets: a trailer's used value today, against what one costs new today. */
export function trailerValue(w: World, tr: Trailer): number {
  return trailerMarketValue(w.cfg, tr, trailerLifeUsed(w, tr), 1 - trailerCondition(w, tr), dayOf(w.t, w.cfg)) * w.dealerIndex.trailer[tr.type];
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
  // Assets: scarcity is all the new stock (the NPC dealer's and the dealerships') against the months of
  // supply the factory allocation fills, and the index ranges wider (a tight allocation, dearer trucks).
  const assets = w.cfg.assets.enabled;
  const range = assets ? w.cfg.assets.factory.priceRange : k.range;
  const hi = assets ? range[1] - 1 : 0.35;
  const target = (left: number, cap: number) => 1 + k.backlogWeight * backlog + clamp(k.scarcityWeight * (k.scarceBelow - left / Math.max(1, cap)) * (assets ? 3 : 1), -0.15, hi);
  const move = (idx: number, to: number) => clamp(idx + k.stepShare * (to - idx), range[0], range[1]);
  for (const tier of ["workhorse", "highwayPro", "flagship"] as const) {
    const left = assets ? stockOf(w, "tractor", tier) : w.supply.tractor[tier];
    w.dealerIndex.tractor[tier] = move(w.dealerIndex.tractor[tier], target(left, w.supplyCap.tractor[tier]));
  }
  for (const eq of ["van", "reefer", "flatbed"] as const) {
    const left = assets ? stockOf(w, "trailer", eq) : w.supply.trailer[eq];
    w.dealerIndex.trailer[eq] = move(w.dealerIndex.trailer[eq], target(left, w.supplyCap.trailer[eq]));
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

/** Orders that bring a tractor (a rig or a tractor alone): what counts against the truck cap. */
export function tractorOrdersOf(w: World, companyId: number): TruckOrder[] {
  return w.orders.filter((o) => o.companyId === companyId && o.kind !== "trailer");
}

/** Orders that bring an owned trailer (a rig or a trailer alone): what counts against the yard's trailers. */
export function trailerOrdersOf(w: World, companyId: number): TruckOrder[] {
  return w.orders.filter((o) => o.companyId === companyId && o.kind !== "tractor");
}

/** Records a paid order; supply and payment are the caller's. */
export function placeOrder(w: World, company: Company, tier: TractorTier, trailer: Equipment, replaceNpcLease: boolean, kind: TruckOrder["kind"] = "rig", days = deliveryDays(w)): TruckOrder {
  const day = dayOf(w.t, w.cfg);
  const order: TruckOrder = { id: w.nextOrderId++, companyId: company.id, kind, tier, trailer, replaceNpcLease, orderedDay: day, dueDay: day + days };
  w.orders.push(order);
  w.metrics.onOrder();
  return order;
}

/**
 * Delivers orders that are due. A free-path truck takes over from the NPC lease
 * the next time the leased truck is idle; until then it waits at the dealer.
 * Assets on: a rig comes with its own new trailer; a tractor alone hooks a spare
 * from the yard (or a rental); a trailer alone goes behind a tractor at the yard
 * that pulls a rental, or waits in the yard.
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
    if (o.kind === "trailer") {
      deliverTrailer(w, company, o);
      w.metrics.onTrailerDelivered();
      continue;
    }
    const fleet = w.trucksByCompany.get(company.id)!;
    const npc = o.replaceNpcLease ? fleet.find((t) => t.lease === "npc") : undefined;
    if (npc && npc.status !== "idle") {
      waiting.push(o);
      continue;
    }
    // No room for it today (a tier or yard lost since it was ordered): it waits at the dealer.
    if (!npc && fleet.length >= truckCap(w, company)) {
      waiting.push(o);
      continue;
    }
    if (npc) {
      // The lease goes back to the NPC lessor (its trailer too, and its deposit back to the carrier); the new
      // truck starts where it stood, and takes its ladder slot.
      refundLeaseDeposit(w, npc);
      unlockFreePathEarnings(w, company);
      if (w.cfg.assets.enabled) unhook(w, npc);
      // A rig from the NPC used lot comes as worn as it was priced.
      const u = o.used;
      Object.assign(npc, {
        lease: "owned",
        tier: o.tier,
        trailer: o.trailer,
        odometer: u?.odometer ?? 0,
        milesSinceRebuild: u?.milesSinceRebuild ?? 0,
        rebuilds: u?.rebuilds ?? 0,
        builtDay: u?.builtDay ?? day,
        idleSinceDay: day,
        idleSinceT: w.t,
        defects: 0,
      });
      freshPaperwork(npc);
      if (w.cfg.assets.enabled) {
        if (o.kind === "rig") hook(w, npc, newTrailer(w, company, o.trailer, "owned", u ? { odometer: u.odometer, milesSinceRefurb: u.trailerMilesSinceRefurb, builtDay: u.builtDay } : undefined));
        else fitTrailer(w, npc, o.trailer);
      }
      syncTruck(w, npc);
    }
    const delivered = npc ?? createTruck(w, company, "owned", o.tier, o.trailer, o.used, company.homeHub, o.kind === "tractor" ? "fit" : "new");
    // The spend-only FD it was paid with is its locked basis (ledger.ts), shared with a rig's own trailer by list price.
    const basis = o.lockedPaidFd ?? 0;
    const tr = w.cfg.assets.enabled && o.kind === "rig" ? hookedTrailer(w, delivered) : null;
    if (tr && basis > 0) {
      const share = trailerPrice(w, o.trailer) / Math.max(1, trailerPrice(w, o.trailer) + tractorPrice(w, o.tier));
      tr.lockedBasisFd = basis * share;
      delivered.lockedBasisFd = basis * (1 - share);
    } else delivered.lockedBasisFd = basis;
    bindOrderLoan(w, o.id, delivered.id); // a purchase loan takes the truck it paid for as security
    w.metrics.onTruckDelivered();
    w.listener?.({ kind: "truckDelivered", companyId: company.id, truckId: delivered.id });
  }
  w.orders = waiting;
}

/** A trailer alone: behind a tractor idle at the yard that pulls a rental (handed back), else into the yard. */
function deliverTrailer(w: World, c: Company, o: TruckOrder): void {
  const tr = newTrailer(w, c, o.trailer, "owned");
  tr.lockedBasisFd = o.lockedPaidFd ?? 0; // paid with spend-only FD: sold for the same (ledger.ts)
  const truck = (w.trucksByCompany.get(c.id) ?? []).find((t) => t.status === "idle" && t.hub === c.homeHub && hookedTrailer(w, t)?.lease === "rental");
  if (truck) {
    unhook(w, truck);
    hook(w, truck, tr);
  }
  notice(w, c.id, "fleet", `A new ${o.trailer === "van" ? "dry van" : o.trailer} trailer arrived${truck ? ` and went behind truck ${truck.id}` : " and waits in the yard"}.`, "good");
}

/** Assets: hands back every rental and NPC trailer a company holds (its trucks gone or returned). */
export function returnStrayTrailers(w: World, c: Company): void {
  for (const tr of [...trailersOf(w, c.id)]) if (tr.lease !== "owned" && tr.status !== "hooked") handBack(w, tr);
}
