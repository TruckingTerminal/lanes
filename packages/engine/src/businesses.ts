/**
 * Player businesses (Jeff, 2026-10-29/30; TODO.md "the big sinks"): a shop or a fuel station at a hub,
 * or a truck stop at an interstate site (sites.ts), bought for FD through the catalogue split plus a
 * staked bond, with weekly upkeep.
 *
 * - A hub shop does the hub's maintenance, repairs and rebuilds at its own price against the NPC
 *   shop's list: the parts share of list is a sink, the rest is the owner's margin. Carriers use the
 *   cheapest shop at the hub that beats the NPC shop; the owner's own trucks pay parts only.
 * - A hub fuel station keeps a margin on the fuel bought at its hub; its owner fuels at wholesale.
 * - A truck stop bundles the three on the road: fuel at a wider margin for the blocks of a leg that
 *   pass it (the 400-mile rule), a shop that charges over list and comes out to breakdowns nearby
 *   (road service), and parking that cuts a resting truck's idling to a quarter for a nightly fee.
 */
import { dayOf } from "./clock.js";
import { clamp } from "./economics.js";
import { priceIndex } from "./items.js";
import { companyAccount } from "./ledger.js";
import { contractAccount } from "./receivables.js";
import { chargeSalesTax, salesTaxOn } from "./salesTax.js";
import { inCloseWindow } from "./season.js";
import { legMile, legRoute, nearestStopOnLeg, siteOf, sitePriceFd } from "./sites.js";
import type { Business, BusinessKind, Company, Truck } from "./types.js";
import type { World } from "./world.js";

export type ServiceKind = "maintenance" | "repairs" | "rebuild";
export type HubBusinessKind = Exclude<BusinessKind, "truckStop">;

export const businessesOf = (w: World, companyId: number): Business[] => w.businesses.filter((b) => b.ownerId === companyId);
/** Hub businesses of a kind, open, at a hub. */
export const businessesAt = (w: World, hub: number, kind: HubBusinessKind): Business[] => w.businesses.filter((b) => b.ownerId > 0 && b.hub === hub && b.kind === kind);

/** Today's price of a hub business: the list price, scaled by the freight-rate index when the catalogue is on. */
export function businessPriceFd(w: World, kind: HubBusinessKind): number {
  return w.cfg.businesses.kinds[kind].priceFd * (w.cfg.token.catalogue.enabled ? priceIndex(w) : 1);
}

function pay(w: World, c: Company, price: number, bond: number, ref: string): string | null {
  const tax = salesTaxOn(w, price);
  const acct = companyAccount(c.id);
  if (w.ledger.balance(acct) < price + bond + tax) return "insufficient FD";
  if (w.cfg.token.catalogue.enabled) {
    const s = w.cfg.token.catalogue.split;
    w.ledger.post(w.t, acct, "sink:asset_burn", price * s.burn, ref);
    w.ledger.post(w.t, acct, "alloc:treasury", price * s.treasury, ref);
    w.ledger.post(w.t, acct, "sink:asset_reserve", price * s.reserve, ref);
  } else {
    w.ledger.post(w.t, acct, "sink:business_dealer", price, ref);
  }
  chargeSalesTax(w, c.id, price, ref);
  if (bond > 0) w.ledger.post(w.t, acct, contractAccount(c.id), bond, `bond:business:${c.id}`);
  return null;
}

function canBuy(w: World, c: Company): string | null {
  const k = w.cfg.businesses;
  if (!k.enabled) return "businesses aren't open";
  if (c.liquidatingSince !== null) return "in liquidation";
  if (inCloseWindow(w)) return "no permanent purchases in the season close";
  if (businessesOf(w, c.id).length >= k.maxPerCompany) return "company business cap";
  return null;
}

export function buyBusiness(w: World, c: Company, kind: HubBusinessKind, hubId: string): string | null {
  const bad = canBuy(w, c);
  if (bad) return bad;
  const hub = w.net.hubs.findIndex((h) => h.id === hubId);
  if (hub < 0) return "unknown hub";
  const spec = w.cfg.businesses.kinds[kind];
  if (businessesAt(w, hub, kind).length >= spec.perHub) return "no room for another at this hub";
  const price = businessPriceFd(w, kind);
  const ref = `business:${kind}:${c.id}`;
  const paid = pay(w, c, price, spec.bondFd, ref);
  if (paid) return paid;
  const outlay = price + salesTaxOn(w, price);
  w.businesses.push({ id: w.businesses.length + 1, kind, ownerId: c.id, hub, site: 0, boughtDay: dayOf(w.t, w.cfg), bondFd: spec.bondFd, markup: kind === "shop" ? 1 : 0, netFd: -outlay, purchaseFd: outlay });
  return null;
}

/** A truck stop at an open site, at the site's traffic-scaled price. */
export function buyTruckStop(w: World, c: Company, siteId: number): string | null {
  const bad = canBuy(w, c);
  if (bad) return bad;
  const site = siteOf(w, siteId);
  if (!site) return "unknown site";
  if (!site.open) return "this site isn't for sale yet";
  if (site.businessId !== 0) return "a truck stop stands here already";
  const spec = w.cfg.businesses.kinds.truckStop;
  const price = sitePriceFd(w, site);
  const ref = `business:truckStop:${c.id}`;
  const paid = pay(w, c, price, spec.bondFd, ref);
  if (paid) return paid;
  const outlay = price + salesTaxOn(w, price);
  const b: Business = { id: w.businesses.length + 1, kind: "truckStop", ownerId: c.id, hub: -1, site: site.id, boughtDay: dayOf(w.t, w.cfg), bondFd: spec.bondFd, markup: spec.markupRange[0], netFd: -outlay, purchaseFd: outlay };
  w.businesses.push(b);
  site.businessId = b.id;
  return null;
}

/** Shops and truck stops price their work against the NPC shop's list, within their kind's range. */
export function setShopMarkup(w: World, c: Company, businessId: number, markup: number): string | null {
  const b = w.businesses[businessId - 1];
  if (!b || b.ownerId !== c.id) return "not your business";
  if (b.kind === "fuelStation") return "only a shop prices its work";
  const [lo, hi] = w.cfg.businesses.kinds[b.kind].markupRange;
  b.markup = clamp(markup, lo, hi);
  return null;
}

/** Liquidation: every business closes, its site frees, and its bond comes back to cash for the creditors. */
export function releaseBusinesses(w: World, c: Company): void {
  for (const b of businessesOf(w, c.id)) {
    if (b.bondFd > 0) w.ledger.post(w.t, contractAccount(c.id), companyAccount(c.id), b.bondFd, `bond:business:${c.id}`);
    b.bondFd = 0;
    b.ownerId = 0;
    if (b.site) {
      const site = siteOf(w, b.site);
      if (site && site.businessId === b.id) site.businessId = 0;
    }
  }
}

/** Weekly upkeep, a sink. */
export function weeklyBusinesses(w: World): void {
  if (!w.cfg.businesses.enabled) return;
  for (const b of w.businesses) {
    if (b.ownerId === 0) continue;
    const upkeep = w.cfg.businesses.kinds[b.kind].upkeepPerWeekFd;
    w.ledger.post(w.t, companyAccount(b.ownerId), "sink:business_upkeep", upkeep, `upkeep:business:${b.id}`);
    b.netFd -= upkeep;
  }
}

export const fuelStationAt = (w: World, hub: number): Business | null => (w.cfg.businesses.enabled ? (businessesAt(w, hub, "fuelStation")[0] ?? null) : null);

/** The cheapest player shop at the hub that beats the NPC shop, or the owner's own. */
export function shopAt(w: World, hub: number, companyId: number): Business | null {
  if (!w.cfg.businesses.enabled) return null;
  let best: Business | null = null;
  for (const b of businessesAt(w, hub, "shop")) {
    if (b.ownerId === companyId) return b;
    if (b.markup <= 1 + 1e-9 && (!best || b.markup < best.markup)) best = b;
  }
  return best;
}

/**
 * A bill for work at a shop (a hub shop or a truck stop's): the parts share of list is a sink, the
 * price over it the owner's margin; the owner's own trucks pay parts. With no shop, the NPC shop at
 * list. Sales tax on top. Returns what the company paid, tax included.
 */
export function billService(w: World, c: Company, listFd: number, kind: ServiceKind, ref: string, shop: Business | null): number {
  if (listFd <= 0) return 0;
  const acct = companyAccount(c.id);
  let price = listFd;
  if (shop && shop.kind !== "fuelStation") {
    const parts = listFd * w.cfg.businesses.kinds[shop.kind].partsShare;
    price = shop.ownerId === c.id ? parts : Math.max(parts, listFd * shop.markup);
    w.ledger.post(w.t, acct, "sink:parts", parts, ref);
    const margin = price - parts;
    if (margin > 0.005) {
      w.ledger.post(w.t, acct, companyAccount(shop.ownerId), margin, ref);
      shop.netFd += margin;
    }
  } else {
    w.ledger.post(w.t, acct, `sink:${kind}`, price, ref);
  }
  return price + chargeSalesTax(w, c.id, price, ref);
}

/** A maintenance, repair or rebuild bill at a hub: the hub's shop if one beats the NPC shop, else the NPC shop. */
export function serviceBill(w: World, c: Company, hub: number, listFd: number, kind: ServiceKind, ref: string): number {
  return billService(w, c, listFd, kind, ref, shopAt(w, hub, c.id));
}

/** Fuel from a seller: its margin to the owner (the owner's own trucks fuel at wholesale), the rest to the pump. */
export function payFuelWith(w: World, c: Company, seller: Business | null, fuelFd: number, ref: string): void {
  if (fuelFd <= 0.005) return;
  const acct = companyAccount(c.id);
  if (!seller || seller.kind === "shop") {
    w.ledger.post(w.t, acct, "sink:fuel", fuelFd, ref);
    return;
  }
  const pct = seller.kind === "truckStop" ? w.cfg.businesses.kinds.truckStop.fuelMarginPct : w.cfg.businesses.kinds.fuelStation.marginPct;
  const margin = fuelFd * pct;
  w.ledger.post(w.t, acct, "sink:fuel", fuelFd - margin, ref);
  if (seller.ownerId !== c.id) {
    w.ledger.post(w.t, acct, companyAccount(seller.ownerId), margin, ref);
    seller.netFd += margin;
  }
}

/** Fuel bought at a hub (the hub's station if there is one, else the pump). */
export function payFuel(w: World, c: Company, hub: number, fuelFd: number, ref: string): void {
  payFuelWith(w, c, fuelStationAt(w, hub), fuelFd, ref);
}

/**
 * A leg's fuel by the block rule: the first block of miles at the origin hub (its station or the
 * pump), each further block at the nearest truck stop to that mile of the route within reach, else the
 * pump. Miles beyond the leg (the deadhead before it) count as bought at the origin.
 */
export function payLegFuel(w: World, c: Company, truck: Truck, fuelFd: number, driven: number, ref: string): void {
  const k = w.cfg.businesses;
  const route = k.enabled ? legRoute(w, truck) : null;
  const legMiles = route ? Math.min(route.miles, truck.legMiles > 0 ? truck.legMiles : route.miles) : 0;
  if (!route || driven <= 0 || legMiles <= k.fuelRule.blockMi) {
    payFuel(w, c, truck.hub, fuelFd, ref);
    return;
  }
  const perMile = fuelFd / driven;
  const before = Math.max(0, driven - legMiles);
  payFuel(w, c, truck.hub, perMile * (before + Math.min(legMiles, k.fuelRule.blockMi)), ref);
  for (let mile = k.fuelRule.blockMi; mile < legMiles; mile += k.fuelRule.blockMi) {
    const block = Math.min(k.fuelRule.blockMi, legMiles - mile);
    const stop = nearestStopOnLeg(w, route, mile, k.fuelRule.stopRangeMi);
    payFuelWith(w, c, stop?.business ?? null, perMile * block, ref);
  }
}

/**
 * Road service for a breakdown where the truck is: the cheapest provider within reach comes out — a
 * truck stop's shop at its markup or a hub shop at either end of the leg at its own — for the call-out
 * fee plus the drive, or NPC road service at its markup and its wait. Returns what the company paid
 * and the extra delay the drive out adds.
 */
export function roadService(w: World, truck: Truck, c: Company, listFd: number): { paid: number; delayMin: number } {
  const k = w.cfg.businesses;
  const ref = `breakdown:${truck.id}`;
  const route = k.enabled ? legRoute(w, truck) : null;
  if (!route) return { paid: serviceBill(w, c, truck.hub, listFd, "repairs", ref), delayMin: 0 };
  const mile = legMile(truck);
  const r = k.roadService;
  const callOut = (distMi: number) => r.callOutFd + r.callOutPerMi * distMi;
  const cost = (b: Business, distMi: number) => (b.ownerId === c.id ? listFd * k.kinds[b.kind === "fuelStation" ? "shop" : b.kind].partsShare : callOut(distMi) + listFd * b.markup);
  let best: { b: Business; distMi: number } | null = null;
  const consider = (b: Business | null, distMi: number) => {
    if (!b || distMi > r.rangeMi) return;
    if (!best || cost(b, distMi) < cost(best.b, best.distMi)) best = { b, distMi };
  };
  const stop = nearestStopOnLeg(w, route, mile, r.rangeMi);
  if (stop) consider(stop.business, stop.distMi);
  consider(shopAt(w, truck.hub, c.id), mile);
  consider(shopAt(w, truck.targetHub, c.id), Math.max(0, truck.legMiles - mile));
  if (!best) {
    const acct = companyAccount(c.id);
    const price = listFd * r.npcMarkup;
    w.ledger.post(w.t, acct, "sink:road_service", price, ref);
    return { paid: price + chargeSalesTax(w, c.id, price, ref), delayMin: r.npcHours * 60 };
  }
  const { b, distMi } = best as { b: Business; distMi: number };
  let paid = billService(w, c, listFd, "repairs", ref, b);
  if (b.ownerId !== c.id) {
    const fee = callOut(distMi);
    w.ledger.post(w.t, companyAccount(c.id), companyAccount(b.ownerId), fee, ref);
    b.netFd += fee;
    paid += fee + chargeSalesTax(w, c.id, fee, ref);
  }
  return { paid, delayMin: Math.round((distMi / r.mph) * 60) };
}
