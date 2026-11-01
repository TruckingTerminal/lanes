/**
 * Trailers as their own assets (assets.enabled; the EVE plan, step 4, Jeff 2026-10-30).
 *
 * A tractor pulls one trailer. A fleet with a yard keeps spares there and swaps at the home hub, so it
 * can pull whatever pays this week; the NPC lessor rents trailers by the week at any hub. Each trailer
 * wears with its own miles (a refurbishment restores it, once) and goes for scrap at the end of its
 * life, its type's miles: a reefer's unit sooner, a flatbed later. Nothing is recycled.
 *
 * Every truck on the road pulls a trailer: when its own is gone (stolen, scrapped, sold) and there is no
 * spare to hook, it is given a rental of the same type, so freight matching can always read `truck.trailer`.
 * A dropped trailer waits in the yard at its owner's home hub.
 */
import type { Equipment } from "@lanes/config";
import { dayOf } from "./clock.js";
import { companyAccount } from "./ledger.js";
import { securityTheftMult } from "./labor.js";
import { hubTheftRisk } from "./risk.js";
import type { Company, Trailer, Truck } from "./types.js";
import type { World } from "./world.js";

export const assetsOn = (w: World): boolean => w.cfg.assets.enabled;

export function trailerById(w: World, id: number): Trailer | null {
  return id > 0 ? (w.trailers[id - 1] ?? null) : null;
}

export function trailersOf(w: World, companyId: number): Trailer[] {
  return w.trailersByCompany.get(companyId) ?? [];
}

/** The trailer a truck pulls, or null (assets off, or none hooked). */
export function hookedTrailer(w: World, truck: Truck): Trailer | null {
  return trailerById(w, truck.trailerId);
}

/** Condition 1 (fresh) → 0 (worn) with miles since the last refurbishment; the lessor's trailers hold a fixed condition. */
export function trailerCondition(w: World, tr: Trailer): number {
  const a = w.cfg.assets;
  if (tr.lease !== "owned") return a.rental.condition;
  return Math.max(0, Math.min(1, 1 - tr.milesSinceRefurb / a.trailer.wearMi[tr.type]));
}

/** The share of its life used: by miles, or by refurbishments spent and wear. */
export function trailerLifeUsed(w: World, tr: Trailer): number {
  const a = w.cfg.assets.trailer;
  return Math.min(1, Math.max(tr.odometer / a.lifeMi[tr.type], (tr.refurbs + 1 - trailerCondition(w, tr)) / (a.maxRefurbs + 1)));
}

/** Can it still be refurbished? */
export function trailerRefurbishable(w: World, tr: Trailer): boolean {
  const a = w.cfg.assets.trailer;
  return tr.lease === "owned" && tr.refurbs < a.maxRefurbs && tr.odometer < a.lifeMi[tr.type];
}

/** At the end of its life: past its miles, or worn out with no refurbishment left. It goes for scrap at the next hub. */
export function trailerWornOut(w: World, tr: Trailer): boolean {
  const a = w.cfg.assets.trailer;
  if (tr.lease !== "owned") return false;
  return tr.odometer >= a.lifeMi[tr.type] || (!trailerRefurbishable(w, tr) && trailerCondition(w, tr) <= a.scrapAtCondition);
}

/** Keeps the truck's cached trailer type and wear in step with the trailer it pulls. */
export function syncTrailer(w: World, truck: Truck): void {
  const tr = hookedTrailer(w, truck);
  if (!tr) {
    truck.trailerWear = 0;
    return;
  }
  truck.trailer = tr.type;
  truck.trailerWear = 1 - trailerCondition(w, tr);
}

export interface UsedTrailer {
  odometer: number;
  milesSinceRefurb: number;
  builtDay: number;
  refurbs?: number;
}

/** A new trailer for this company, dropped in its yard (the caller hooks it). */
export function newTrailer(w: World, c: Company, type: Equipment, lease: Trailer["lease"], used?: UsedTrailer): Trailer {
  const day = dayOf(w.t, w.cfg);
  const tr: Trailer = {
    id: w.trailers.length + 1,
    companyId: c.id,
    type,
    lease,
    status: "dropped",
    truckId: 0,
    hub: c.homeHub,
    odometer: used?.odometer ?? 0,
    milesSinceRefurb: used?.milesSinceRefurb ?? 0,
    refurbs: used?.refurbs ?? 0,
    builtDay: used?.builtDay ?? day,
    rentedDay: lease === "rental" ? day : -1,
    rentPaidFd: 0,
    refurbUntilT: null,
  };
  w.trailers.push(tr);
  w.trailersByCompany.get(c.id)!.push(tr);
  return tr;
}

export function hook(w: World, truck: Truck, tr: Trailer): void {
  tr.status = "hooked";
  tr.truckId = truck.id;
  tr.hub = truck.hub;
  truck.trailerId = tr.id;
  syncTrailer(w, truck);
}

/** Takes the trailer off the truck: an owned one is dropped in the yard, a rental or NPC trailer handed back. */
export function unhook(w: World, truck: Truck): Trailer | null {
  const tr = hookedTrailer(w, truck);
  truck.trailerId = 0;
  truck.trailerWear = 0;
  if (!tr) return null;
  tr.truckId = 0;
  if (tr.lease === "owned") drop(w, tr);
  else handBack(w, tr);
  return tr;
}

/** Dropped trailers wait in the yard at the owner's home hub. */
function drop(w: World, tr: Trailer): void {
  tr.status = "dropped";
  tr.truckId = 0;
  tr.hub = tr.companyId ? w.companies[tr.companyId - 1]!.homeHub : tr.hub;
}

/** Off the company's books: scrapped, stolen, written off, sold away, or a rental handed back. */
export function trailerGone(w: World, tr: Trailer): void {
  const list = w.trailersByCompany.get(tr.companyId);
  if (list) {
    const i = list.indexOf(tr);
    if (i >= 0) list.splice(i, 1);
  }
  if (tr.truckId) {
    const truck = w.trucks[tr.truckId - 1];
    if (truck && truck.trailerId === tr.id) {
      truck.trailerId = 0;
      truck.trailerWear = 0;
    }
  }
  tr.status = "gone";
  tr.companyId = 0;
  tr.truckId = 0;
}

/** A rental (owing what's left of its minimum term) or an NPC lease's trailer goes back to the lessor. */
export function handBack(w: World, tr: Trailer): void {
  if (tr.lease === "rental" && tr.companyId) {
    const k = w.cfg.assets.rental;
    const owed = Math.max(0, k.minWeeks * k.weeklyFd[tr.type] - tr.rentPaidFd);
    if (owed > 0.01) {
      w.ledger.post(w.t, companyAccount(tr.companyId), "sink:trailer_rent", owed, `rent:trailer:${tr.id}`);
      w.companies[tr.companyId - 1]!.operating.costFd += owed;
    }
  }
  trailerGone(w, tr);
}

/** Moves a trailer to a new owner (a used sale): dropped in the buyer's yard. */
export function transferTrailer(w: World, tr: Trailer, buyer: Company): void {
  const list = w.trailersByCompany.get(tr.companyId);
  if (list) {
    const i = list.indexOf(tr);
    if (i >= 0) list.splice(i, 1);
  }
  tr.companyId = buyer.id;
  w.trailersByCompany.get(buyer.id)!.push(tr);
  drop(w, tr);
}

/** Rents a trailer of this type from the NPC lessor and hooks it to a truck that pulls none. */
export function rentTrailer(w: World, truck: Truck, type: Equipment): Trailer {
  const c = w.companies[truck.companyId - 1]!;
  const tr = newTrailer(w, c, type, "rental");
  hook(w, truck, tr);
  w.metrics.onTrailerRental();
  return tr;
}

/** Gives a truck that pulls nothing a trailer: a spare from the yard if it's home and one is there, else a rental. */
export function fitTrailer(w: World, truck: Truck, type: Equipment): Trailer {
  const c = w.companies[truck.companyId - 1]!;
  if (truck.hub === c.homeHub) {
    const spares = yardTrailers(w, c);
    const spare = spares.find((t) => t.type === type) ?? spares[0];
    if (spare) {
      hook(w, truck, spare);
      return spare;
    }
  }
  return rentTrailer(w, truck, type);
}

/** Weekly: every rental out pays its week to the lessor (a sink). */
export function billRentals(w: World): void {
  if (!assetsOn(w)) return;
  const k = w.cfg.assets.rental;
  for (const [cid, list] of w.trailersByCompany) {
    for (const tr of list) {
      if (tr.lease !== "rental") continue;
      const fee = k.weeklyFd[tr.type];
      w.ledger.post(w.t, companyAccount(cid), "sink:trailer_rent", fee, `rent:trailer:${tr.id}`);
      tr.rentPaidFd += fee;
      w.companies[cid - 1]!.operating.costFd += fee;
    }
  }
}

/** The miles a truck drives go on the trailer it pulls too. */
export function addTrailerMiles(w: World, truck: Truck, miles: number): void {
  const tr = hookedTrailer(w, truck);
  if (!tr) return;
  tr.odometer += miles;
  if (tr.lease === "owned") {
    tr.milesSinceRefurb += miles;
    truck.trailerWear = 1 - trailerCondition(w, tr);
  }
}

/** Trailers the company owns that count against its yard: hooked, dropped or listed. */
export function ownedTrailers(w: World, c: Company): Trailer[] {
  return trailersOf(w, c.id).filter((tr) => tr.lease === "owned");
}

/** Trailers the yard holds: the yard's own, plus space bought (catalogue trailerSpace). */
export function trailerCap(w: World, c: Company): number {
  const y = w.cfg.assets.yard;
  return y[c.yard].trailers + c.trailerSpaces * y.spacePerPurchase;
}

/** Trailers waiting in the yard at the home hub, ready to hook (not in the shop). */
export function yardTrailers(w: World, c: Company): Trailer[] {
  return trailersOf(w, c.id).filter((tr) => tr.status === "dropped" && tr.lease === "owned" && tr.refurbUntilT === null);
}

/** Its scrap value: a share of a new one's list price, paid by the scrapyard (a small faucet). */
export function trailerScrapFd(w: World, tr: Trailer): number {
  return w.cfg.assets.trailer.scrapShare * w.cfg.dealerFd.trailer[tr.type];
}

/** Scraps an owned trailer: the scrapyard pays its scrap value, and the trailer is gone for good. */
export function scrapTrailer(w: World, tr: Trailer): void {
  if (tr.lease !== "owned" || tr.status === "gone") return;
  const owner = tr.companyId;
  const scrap = trailerScrapFd(w, tr);
  if (tr.truckId) {
    const truck = w.trucks[tr.truckId - 1]!;
    truck.trailerId = 0;
    truck.trailerWear = 0;
  }
  // Any listing it had is off the market.
  for (const l of w.listings) if (l.trailerId === tr.id && l.status === "open") l.status = "withdrawn";
  trailerGone(w, tr);
  if (owner && scrap > 0.01) {
    w.ledger.post(w.t, "faucet:scrap", companyAccount(owner), scrap, `scrap:trailer:${tr.id}`);
    w.ledger.lock(companyAccount(owner), Math.min(scrap, tr.lockedBasisFd ?? 0)); // bought with spend-only FD: scrapped for the same
  }
  w.metrics.onScrap("trailer");
}

/**
 * Nightly: a trailer dropped in a yard can be stolen, at the hub's theft risk. Physical-damage cover
 * (insurance.ts) pays its value less the deductible.
 */
export function yardTheftTonight(w: World, onStolen: (c: Company, tr: Trailer) => void): void {
  const odds = w.cfg.assets.trailerTheftPerNight;
  if (odds <= 0) return;
  for (const c of w.companies) {
    const list = w.trailersByCompany.get(c.id);
    if (!list || list.length === 0) continue;
    const risk = (w.cfg.theft.enabled ? hubTheftRisk(w, c.homeHub) : 1) * securityTheftMult(w, c);
    for (const tr of [...list]) {
      if (tr.status !== "dropped" || tr.lease !== "owned") continue;
      if (w.rng.ops.next() < odds * risk) onStolen(c, tr);
    }
  }
}
