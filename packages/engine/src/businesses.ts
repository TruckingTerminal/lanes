/**
 * Player businesses (Jeff, 2026-10-29; TODO.md "the big sinks"): a shop, a truck stop or a fuel station
 * at a hub, bought for FD through the catalogue split plus a staked bond, with weekly upkeep.
 *
 * - A shop does the hub's maintenance, repairs and rebuilds at its own price against the NPC shop's
 *   list: the parts share of list is a sink, the rest is the owner's margin. Carriers use the cheapest
 *   shop at the hub that beats the NPC shop; without one they pay the NPC shop (a sink at list). The
 *   owner's own trucks pay parts only.
 * - A truck stop halves the idle fuel of trucks resting at its hub (shore power) for a nightly fee.
 * - A fuel station keeps a margin on the fuel bought at its hub; its owner fuels at wholesale.
 */
import { dayOf } from "./clock.js";
import { clamp } from "./economics.js";
import { priceIndex } from "./items.js";
import { companyAccount } from "./ledger.js";
import { contractAccount } from "./receivables.js";
import { chargeSalesTax, salesTaxOn } from "./salesTax.js";
import { inCloseWindow } from "./season.js";
import type { Business, BusinessKind, Company } from "./types.js";
import type { World } from "./world.js";

export type ServiceKind = "maintenance" | "repairs" | "rebuild";

export const businessesOf = (w: World, companyId: number): Business[] => w.businesses.filter((b) => b.ownerId === companyId);
export const businessesAt = (w: World, hub: number, kind: BusinessKind): Business[] => w.businesses.filter((b) => b.ownerId > 0 && b.hub === hub && b.kind === kind);

/** Today's price: the list price, scaled by the freight-rate index when the catalogue is on. */
export function businessPriceFd(w: World, kind: BusinessKind): number {
  return w.cfg.businesses.kinds[kind].priceFd * (w.cfg.token.catalogue.enabled ? priceIndex(w) : 1);
}

export function buyBusiness(w: World, c: Company, kind: BusinessKind, hubId: string): string | null {
  const k = w.cfg.businesses;
  if (!k.enabled) return "businesses aren't open";
  if (c.liquidatingSince !== null) return "in liquidation";
  if (inCloseWindow(w)) return "no permanent purchases in the season close";
  const hub = w.net.hubs.findIndex((h) => h.id === hubId);
  if (hub < 0) return "unknown hub";
  const spec = k.kinds[kind];
  if (businessesAt(w, hub, kind).length >= spec.perHub) return "no room for another at this hub";
  if (businessesOf(w, c.id).length >= k.maxPerCompany) return "company business cap";
  const price = businessPriceFd(w, kind);
  const tax = salesTaxOn(w, price);
  const acct = companyAccount(c.id);
  if (w.ledger.balance(acct) < price + spec.bondFd + tax) return "insufficient FD";
  const ref = `business:${kind}:${c.id}`;
  if (w.cfg.token.catalogue.enabled) {
    const s = w.cfg.token.catalogue.split;
    w.ledger.post(w.t, acct, "sink:asset_burn", price * s.burn, ref);
    w.ledger.post(w.t, acct, "alloc:treasury", price * s.treasury, ref);
    w.ledger.post(w.t, acct, "sink:asset_reserve", price * s.reserve, ref);
  } else {
    w.ledger.post(w.t, acct, "sink:business_dealer", price, ref);
  }
  chargeSalesTax(w, c.id, price, ref);
  if (spec.bondFd > 0) w.ledger.post(w.t, acct, contractAccount(c.id), spec.bondFd, `bond:business:${c.id}`);
  w.businesses.push({ id: w.businesses.length + 1, kind, ownerId: c.id, hub, boughtDay: dayOf(w.t, w.cfg), bondFd: spec.bondFd, markup: kind === "shop" ? 1 : 0, netFd: -price - tax });
  return null;
}

export function setShopMarkup(w: World, c: Company, businessId: number, markup: number): string | null {
  const b = w.businesses[businessId - 1];
  if (!b || b.ownerId !== c.id) return "not your business";
  if (b.kind !== "shop") return "only a shop prices its work";
  const [lo, hi] = w.cfg.businesses.kinds.shop.markupRange;
  b.markup = clamp(markup, lo, hi);
  return null;
}

/** Liquidation: every business closes and its bond comes back to cash for the creditors. */
export function releaseBusinesses(w: World, c: Company): void {
  for (const b of businessesOf(w, c.id)) {
    if (b.bondFd > 0) w.ledger.post(w.t, contractAccount(c.id), companyAccount(c.id), b.bondFd, `bond:business:${c.id}`);
    b.bondFd = 0;
    b.ownerId = 0;
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

export const truckStopAt = (w: World, hub: number): Business | null => (w.cfg.businesses.enabled ? (businessesAt(w, hub, "truckStop")[0] ?? null) : null);
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
 * A maintenance, repair or rebuild bill at the hub: at the shop's price when a player shop beats the
 * NPC shop (parts are a sink, the margin the owner's; the owner's own trucks pay parts), else at list
 * to the NPC shop. Sales tax on top. Returns what the company paid, tax included.
 */
export function serviceBill(w: World, c: Company, hub: number, listFd: number, kind: ServiceKind, ref: string): number {
  if (listFd <= 0) return 0;
  const acct = companyAccount(c.id);
  const shop = shopAt(w, hub, c.id);
  let price = listFd;
  if (shop) {
    const parts = listFd * w.cfg.businesses.kinds.shop.partsShare;
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

/** The fuel bill at the hub: the station's margin to its owner (its own trucks fuel at wholesale), the rest the pump's. */
export function payFuel(w: World, c: Company, hub: number, fuelFd: number, ref: string): void {
  if (fuelFd <= 0) return;
  const acct = companyAccount(c.id);
  const station = fuelStationAt(w, hub);
  if (!station) {
    w.ledger.post(w.t, acct, "sink:fuel", fuelFd, ref);
    return;
  }
  const margin = fuelFd * w.cfg.businesses.kinds.fuelStation.marginPct;
  w.ledger.post(w.t, acct, "sink:fuel", fuelFd - margin, ref);
  if (station.ownerId !== c.id) {
    w.ledger.post(w.t, acct, companyAccount(station.ownerId), margin, ref);
    station.netFd += margin;
  }
}
