/**
 * The factory allocation and player dealerships (assets.enabled; the EVE plan, step 4, Jeff 2026-10-30).
 *
 * New tractors and trailers arrive monthly as a factory allocation, a policy number: a share of the
 * tractors on the road, by tier and type. Player dealerships take their share wholesale first, paid
 * through the catalogue split (half burned, a quarter each to the treasury and the reserve), and sell
 * from stock at their own markup over list, delivered in a week. The rest stocks the NPC dealer, which
 * holds a few months of it at most (the rest isn't built) and sells at list, or, while a player
 * dealership is open, as the backstop: dearer and slower. Dealerships take trade-ins at a share of value
 * and sell them on from their used lot. Nothing used goes back to the factory.
 */
import type { Equipment, TractorTier } from "@lanes/config";
import { deliveryDays, tractorPrice, trailerPrice, truckValue } from "./dealer.js";
import { activeLoanOn, settleLoanFromSale } from "./finance.js";
import { companyAccount } from "./ledger.js";
import { listTruck } from "./market.js";
import { chargeSalesTax, salesTaxOn } from "./salesTax.js";
import type { Business, Company, Truck, TruckOrder } from "./types.js";
import { detachTruck, type World } from "./world.js";

const TIERS: TractorTier[] = ["workhorse", "highwayPro", "flagship"];
const TYPES: Equipment[] = ["van", "reefer", "flatbed"];

export const emptyStock = (): Business["stock"] => ({ tractor: { workhorse: 0, highwayPro: 0, flagship: 0 }, trailer: { van: 0, reefer: 0, flatbed: 0 } });

export function dealershipsOpen(w: World): Business[] {
  return w.businesses.filter((b) => b.kind === "dealership" && b.ownerId > 0);
}

/** While a player dealership is open, the NPC dealer is only the backstop: its premium and its longer wait. */
export function npcBackstop(w: World): boolean {
  return w.cfg.assets.enabled && w.cfg.businesses.enabled && w.businesses.some((b) => b.kind === "dealership" && b.ownerId > 0);
}

export const npcDealerMult = (w: World): number => (npcBackstop(w) ? w.cfg.assets.factory.npcPremium : 1);
export const npcDealerDays = (w: World): number => deliveryDays(w) + (npcBackstop(w) ? w.cfg.assets.factory.npcExtraDays : 0);
/**
 * The NPC used lot's wait. A rig that adds to a fleet comes from the lot's stock in usedMarket.npcLot.deliveryDays when
 * that is set. A free starter's first truck, which replaces the lessor's, keeps the NPC dealer's queue so step 9 keeps its
 * pace (economy-player2.md §1c: delivering those sooner raised owner-operator liquidations), unless
 * usedMarket.npcLot.startersFromStock is on: then it comes from stock as a fleet's does (the economy's worn-truck loans
 * gate §5: the loan rule now brakes the first truck at its cause). Unset, every rig queues, as today.
 */
export const lotDeliveryDays = (w: World, replacesLease = false): number => {
  const lot = w.cfg.usedMarket.npcLot;
  const own = lot.deliveryDays;
  return own !== null && (!replacesLease || lot.startersFromStock === true) ? own : npcDealerDays(w);
};

/** List price today (list × the dealer index) of a rig, a tractor alone or a trailer alone. */
export function listPrice(w: World, kind: TruckOrder["kind"], tier: TractorTier, type: Equipment): number {
  return kind === "trailer" ? trailerPrice(w, type) : kind === "tractor" ? tractorPrice(w, tier) : tractorPrice(w, tier) + trailerPrice(w, type);
}

export function hasStock(b: Business, kind: TruckOrder["kind"], tier: TractorTier, type: Equipment): boolean {
  return (kind === "trailer" || b.stock.tractor[tier] > 0) && (kind === "tractor" || b.stock.trailer[type] > 0);
}

/** A dealership's price: its markup over list. Its owner takes its own stock (already paid for wholesale). */
export function dealershipPrice(w: World, b: Business, buyerId: number, kind: TruckOrder["kind"], tier: TractorTier, type: Equipment): number {
  return b.ownerId === buyerId ? 0 : listPrice(w, kind, tier, type) * b.markup;
}

export interface Source {
  dealershipId: number;
  price: number;
  days: number;
}

/** The cheapest place to buy it today: a dealership with it in stock, or the NPC dealer. */
export function bestSource(w: World, buyerId: number, kind: TruckOrder["kind"], tier: TractorTier, type: Equipment): Source {
  let best: Source = { dealershipId: 0, price: listPrice(w, kind, tier, type) * npcDealerMult(w), days: npcDealerDays(w) };
  if (!w.cfg.assets.enabled) return best;
  for (const b of dealershipsOpen(w)) {
    if (!hasStock(b, kind, tier, type)) continue;
    const price = dealershipPrice(w, b, buyerId, kind, tier, type);
    if (price < best.price) best = { dealershipId: b.id, price, days: w.cfg.businesses.kinds.dealership.deliveryDays };
  }
  return best;
}

/** Sells a unit out of a dealership's stock: the buyer pays the owner (and the sales tax). Returns a reason it can't, or null. */
export function sellFromStock(w: World, buyer: Company, b: Business, kind: TruckOrder["kind"], tier: TractorTier, type: Equipment): string | null {
  if (b.kind !== "dealership" || b.ownerId === 0) return "no such dealership";
  if (!hasStock(b, kind, tier, type)) return "out of stock";
  const price = dealershipPrice(w, b, buyer.id, kind, tier, type);
  const acct = companyAccount(buyer.id);
  if (price > 0) {
    if (w.ledger.balance(acct) < price + salesTaxOn(w, price)) return "insufficient FD";
    const ref = `dealership:${b.id}:${buyer.id}`;
    b.lastSaleLockedFd = w.ledger.post(w.t, acct, companyAccount(b.ownerId), price, ref);
    chargeSalesTax(w, buyer.id, price, ref);
    b.netFd += price;
    // Stock bought with spend-only FD (ledger.ts) sells for spend-only FD: the unit's share of the lot's locked basis.
    const units = Object.values(b.stock.tractor).reduce((s, n) => s + n, 0) + Object.values(b.stock.trailer).reduce((s, n) => s + n, 0);
    const basis = (b.stockLockedFd ?? 0) / Math.max(1, units);
    if (basis > 0) {
      w.ledger.lock(companyAccount(b.ownerId), Math.max(0, Math.min(price, basis) - (b.lastSaleLockedFd ?? 0)));
      b.stockLockedFd = Math.max(0, (b.stockLockedFd ?? 0) - basis);
    }
  } else b.lastSaleLockedFd = 0;
  if (kind !== "trailer") b.stock.tractor[tier]--;
  if (kind !== "tractor") b.stock.trailer[type]--;
  b.soldMonth++;
  w.metrics.onDealershipSale(price);
  return null;
}

/** Units in stock across the NPC dealer and the dealerships. */
export function stockOf(w: World, part: "tractor", key: TractorTier): number;
export function stockOf(w: World, part: "trailer", key: Equipment): number;
export function stockOf(w: World, part: "tractor" | "trailer", key: string): number {
  let n = (w.supply[part] as Record<string, number>)[key]!;
  for (const b of dealershipsOpen(w)) n += (b.stock[part] as Record<string, number>)[key]!;
  return n;
}

/**
 * Monthly: the factories build the allocation. Dealerships take their share first, weighted by last
 * month's sales, as their stock room and their owners' cash allow, at the wholesale price through the
 * catalogue split; the NPC dealer takes the rest, up to its months of stock. The dealer index reads
 * scarcity against those months of stock (dealer.ts monthlyDealerPrices).
 */
export function monthlyFactory(w: World): void {
  if (!w.cfg.assets.enabled) return;
  const f = w.cfg.assets.factory;
  const d = w.cfg.businesses.kinds.dealership;
  const split = w.cfg.token.catalogue.split;
  let onRoad = 0;
  for (const t of w.trucks) if (t.lease === "owned" && t.companyId && t.status !== "retired") onRoad++;
  const tractors = Math.max(f.minTractorsPerMonth, f.monthlyShareOfFleet * onRoad);
  const open = w.cfg.businesses.enabled ? dealershipsOpen(w) : [];
  const weightSum = open.reduce((s, b) => s + b.soldLastMonth + 1, 0);
  const built = { tractors: 0, trailers: 0 };
  const run = (part: "tractor" | "trailer", key: string, units: number, unitPrice: number) => {
    let left = units;
    if (open.length > 0) {
      const forDealers = Math.round(units * f.dealershipShare);
      let given = 0;
      for (const b of open) {
        const want = Math.round((forDealers * (b.soldLastMonth + 1)) / weightSum);
        const stock = b.stock[part] as Record<string, number>;
        const room = Math.max(0, d.maxStock - stock[key]!);
        const wholesale = unitPrice * d.wholesaleShare;
        const cash = w.ledger.balance(companyAccount(b.ownerId));
        const n = Math.max(0, Math.min(want, room, forDealers - given, Math.floor(cash / Math.max(1, wholesale))));
        if (n <= 0) continue;
        const cost = n * wholesale;
        const acct = companyAccount(b.ownerId);
        const ref = `wholesale:${b.id}:${key}`;
        let lockedPaid = w.ledger.post(w.t, acct, "sink:asset_burn", cost * split.burn, ref);
        lockedPaid += w.ledger.post(w.t, acct, "alloc:treasury", cost * split.treasury, ref);
        lockedPaid += w.ledger.post(w.t, acct, "sink:asset_reserve", cost * split.reserve, ref);
        b.stockLockedFd = (b.stockLockedFd ?? 0) + lockedPaid;
        b.netFd -= cost;
        w.metrics.onWholesale(cost);
        stock[key]! += n;
        given += n;
        left -= n;
        if (part === "tractor") built.tractors += n;
        else built.trailers += n;
      }
    }
    // The NPC dealer: its stock tops up to its months of supply; anything past that isn't built (and the
    // PoC supply the world started with is cut back to it on the first month: the factory sets supply now).
    const cap = Math.max(1, Math.round(units * f.stockMonths));
    const npc = w.supply[part] as Record<string, number>;
    const before = npc[key]!;
    npc[key] = Math.min(before + left, cap);
    (w.supplyCap[part] as Record<string, number>)[key] = cap;
    if (part === "tractor") built.tractors += Math.max(0, npc[key]! - before);
    else built.trailers += Math.max(0, npc[key]! - before);
  };
  for (const tier of TIERS) run("tractor", tier, Math.round(tractors * f.tractorMix[tier]), w.cfg.dealerFd.tractor[tier] * w.dealerIndex.tractor[tier]);
  for (const type of TYPES) run("trailer", type, Math.round(tractors * f.trailersPerTractor * f.trailerMix[type]), w.cfg.dealerFd.trailer[type] * w.dealerIndex.trailer[type]);
  // The first-truck reserve: a share of the NPC dealer's Workhorses and vans kept for first-truck buyers.
  w.starterReserve.workhorse = Math.min(w.supply.tractor.workhorse, Math.round(w.cfg.starterReserveShare * w.supplyCap.tractor.workhorse));
  w.starterReserve.van = Math.min(w.supply.trailer.van, Math.round(w.cfg.starterReserveShare * w.supplyCap.trailer.van));
  for (const b of open) {
    b.soldLastMonth = b.soldMonth;
    b.soldMonth = 0;
  }
  w.metrics.onFactory(built.tractors, built.trailers);
}

/**
 * A trade-in: the dealership's owner pays the trade-in share of the truck's value (which must clear any
 * loan on it), and the truck goes on its used lot at its value, a listing like any other.
 */
export function tradeIn(w: World, seller: Company, truck: Truck, b: Business): string | null {
  const d = w.cfg.businesses.kinds.dealership;
  if (!w.cfg.assets.enabled) return "no dealerships";
  if (b.kind !== "dealership" || b.ownerId === 0) return "no such dealership";
  if (b.ownerId === seller.id) return "your own dealership: list it instead";
  if (truck.companyId !== seller.id || truck.lease !== "owned") return "not your truck";
  if (truck.status !== "idle" && truck.status !== "parked") return "the truck must be idle or parked at a hub";
  if (lotOf(w, b).length >= d.lotMax) return "the dealership's lot is full";
  const value = truckValue(w, truck);
  const offer = value * d.tradeInShare;
  const ownerAcct = companyAccount(b.ownerId);
  if (w.ledger.balance(ownerAcct) < offer) return "the dealership can't take it today";
  const loan = activeLoanOn(w, truck.id);
  if (loan && offer < loan.principalFd) return "the trade-in doesn't cover the loan on it";
  const sellerAcct = companyAccount(seller.id);
  const ref = `tradein:${b.id}:${truck.id}`;
  const lockedPaid = w.ledger.post(w.t, ownerAcct, sellerAcct, offer, ref);
  w.ledger.lock(sellerAcct, Math.max(0, Math.min(offer, truck.lockedBasisFd ?? 0) - lockedPaid)); // bought with spend-only FD: traded in for the same
  truck.lockedBasisFd = lockedPaid;
  if (loan) settleLoanFromSale(w, loan, sellerAcct, offer);
  b.netFd -= offer;
  const listing = listTruck(w, seller.id, truck, value, value * 0.85, value * 0.03);
  if (typeof listing === "string") throw new Error(`trade-in listing: ${listing}`);
  listing.sellerId = b.ownerId;
  listing.formerOwnerId = seller.id;
  listing.loanId = null;
  detachTruck(w, truck);
  seller.usedSold++;
  w.metrics.onTradeIn();
  return null;
}

/** A dealership's used lot: its owner's open listings of trucks off any fleet (its trade-ins). */
export function lotOf(w: World, b: Business): number[] {
  const out: number[] = [];
  for (const l of w.listings) if (l.status === "open" && l.sellerId === b.ownerId && l.truckId && w.trucks[l.truckId - 1]!.companyId === 0) out.push(l.id);
  return out;
}

/** What a dealership pays to take this truck in trade today, or 0 if it can't. */
export function tradeInOffer(w: World, b: Business, truck: Truck): number {
  const d = w.cfg.businesses.kinds.dealership;
  if (b.kind !== "dealership" || b.ownerId === 0 || b.ownerId === truck.companyId || lotOf(w, b).length >= d.lotMax) return 0;
  const offer = truckValue(w, truck) * d.tradeInShare;
  if (w.ledger.balance(companyAccount(b.ownerId)) < offer) return 0;
  const loan = activeLoanOn(w, truck.id);
  return loan && offer < loan.principalFd ? 0 : offer;
}

/** Liquidation: a dealership's unsold new stock goes back to the NPC dealer, which pays 70% of wholesale for it. */
export function releaseDealershipStock(w: World, b: Business): void {
  if (b.kind !== "dealership") return;
  const d = w.cfg.businesses.kinds.dealership;
  let refund = 0;
  for (const tier of TIERS) {
    refund += b.stock.tractor[tier] * w.cfg.dealerFd.tractor[tier] * w.dealerIndex.tractor[tier] * d.wholesaleShare * 0.7;
    w.supply.tractor[tier] += b.stock.tractor[tier];
    b.stock.tractor[tier] = 0;
  }
  for (const type of TYPES) {
    refund += b.stock.trailer[type] * w.cfg.dealerFd.trailer[type] * w.dealerIndex.trailer[type] * d.wholesaleShare * 0.7;
    w.supply.trailer[type] += b.stock.trailer[type];
    b.stock.trailer[type] = 0;
  }
  if (refund > 0.01 && b.ownerId) {
    w.ledger.post(w.t, "faucet:dealer_buyback", companyAccount(b.ownerId), refund, `buyback:stock:${b.id}`);
    w.ledger.lock(companyAccount(b.ownerId), Math.min(refund, b.stockLockedFd ?? 0)); // stock bought with spend-only FD comes back as such
  }
  b.stockLockedFd = 0;
}
