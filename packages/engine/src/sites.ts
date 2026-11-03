/**
 * Truck-stop sites (Jeff, 2026-10-30): places on the interstates where a truck stop can be built, one
 * every so many miles of interstate, ranked by the freight that passes (a gravity model over the lanes
 * and the hubs' weights). The busiest open for sale at the start; more open as the fleet grows. A truck
 * on a leg knows its mile along the route, so it can rest at the nearest stop, fuel at the stops it
 * passes, and call the nearest shop when it breaks down (businesses.ts).
 */
import { crewOn, crewStrike } from "./robbery.js";
import type { RoadEdge, RoadNetwork, Route } from "@lanes/data";
import { clamp, fuelPrice } from "./economics.js";
import { priceIndex } from "./items.js";
import { companyAccount } from "./ledger.js";
import { chargeSalesTax } from "./salesTax.js";
import { lockCost, stakeDiscount } from "./staking.js";
import { reeferUnit } from "./equipment.js";
import { nightTheft, theftRiskAt, truckLatLon } from "./risk.js";
import type { Business, Truck, TruckStopSite } from "./types.js";
import { companyById, placeRoute, type World } from "./world.js";

/** [lat, lon] `within` road miles from the a end of an edge, walking its points (as RoadNetwork.pointAlong does). */
function pointOnEdge(roads: RoadNetwork, e: RoadEdge, within: number): [number, number] {
  let k = e.g0;
  const end = e.g0 + e.gn - 1;
  while (k < end && roads.along[k + 1]! < within) k++;
  if (k >= end) return [roads.lat[end]!, roads.lon[end]!];
  const span = roads.along[k + 1]! - roads.along[k]!;
  const t = span > 0 ? clamp((within - roads.along[k]!) / span, 0, 1) : 0;
  return [roads.lat[k]! + t * (roads.lat[k + 1]! - roads.lat[k]!), roads.lon[k]! + t * (roads.lon[k + 1]! - roads.lon[k]!)];
}

/** Lays the sites out on the interstates and opens the busiest. Once, when the world is built. */
export function buildSites(w: World): void {
  const k = w.cfg.businesses.sites;
  const roads = w.net.roads;
  const n = w.net.hubs.length;
  const traffic = new Float64Array(roads.edges.length);
  for (const lane of w.net.lanes) {
    const r = w.net.routes[lane.origin * n + lane.dest] ?? null;
    if (!r) continue;
    const weight = w.net.hubs[lane.origin]!.weight * w.net.hubs[lane.dest]!.weight;
    for (const signed of r.edges) {
      const i = signed >= 0 ? signed : -signed - 1;
      traffic[i] = (traffic[i] ?? 0) + weight;
    }
  }
  // The roads are split into short edges at every town, so sites are laid by walking the interstate
  // edges in order and dropping one every `everyMi` miles of accumulated length (an edge longer than
  // that gets one per block), at the midpoint of the edge the count lands on.
  const sites: TruckStopSite[] = [];
  let max = 0;
  let acc = k.everyMi / 2;
  roads.edges.forEach((e, ei) => {
    if (e.cls !== 0) return;
    acc += e.miles;
    while (acc >= k.everyMi) {
      acc -= k.everyMi;
      const frac = e.miles > 0 ? clamp(1 - acc / e.miles, 0.05, 0.95) : 0.5;
      const [lat, lon] = pointOnEdge(roads, e, frac * e.miles);
      sites.push({ id: sites.length + 1, edge: ei, frac, lat, lon, traffic: traffic[ei]!, open: false, businessId: 0, spaces: 0, parked: 0, theftRisk: 1 });
      max = Math.max(max, traffic[ei]!);
    }
  });
  const [loSp, hiSp] = w.cfg.businesses.parking.spaces;
  for (const s of sites) {
    s.traffic = max > 0 ? s.traffic / max : 0;
    s.spaces = Math.round(loSp + (hiSp - loSp) * s.traffic); // a public rest area at every site, sized by its traffic
    s.theftRisk = theftRiskAt(w, s.lat, s.lon);
  }
  const order = [...sites].sort((a, b) => b.traffic - a.traffic || a.id - b.id);
  for (let i = 0; i < Math.min(k.openAtStart, order.length); i++) order[i]!.open = true;
  w.sites = sites;
  w.sitesBaseTrucks = 0;
}

/** Monthly: more sites open as the fleet grows past what it was when the sites first counted, and as stops get built (so many for sale per one built), busiest first. */
export function monthlySites(w: World): void {
  const k = w.cfg.businesses.sites;
  if (!w.cfg.businesses.enabled || w.sites.length === 0) return;
  if (w.sitesBaseTrucks === 0) w.sitesBaseTrucks = Math.max(1, w.trucks.length);
  let built = 0;
  for (const s of w.sites) if (s.businessId !== 0 && siteBusiness(w, s)) built++;
  const target = Math.min(w.sites.length, Math.max(k.openAtStart, Math.round((k.openAtStart * w.trucks.length) / w.sitesBaseTrucks), built * k.openPerBuilt));
  let open = 0;
  for (const s of w.sites) if (s.open) open++;
  if (open >= target) return;
  const closed = w.sites.filter((s) => !s.open).sort((a, b) => b.traffic - a.traffic || a.id - b.id);
  for (const s of closed) {
    if (open >= target) break;
    s.open = true;
    open++;
  }
}

export const siteOf = (w: World, id: number): TruckStopSite | null => w.sites[id - 1] ?? null;

/** The truck stop built at a site, if it is open for business. */
export function siteBusiness(w: World, site: TruckStopSite): Business | null {
  const b = site.businessId ? w.businesses[site.businessId - 1] : undefined;
  return b && b.ownerId > 0 ? b : null;
}

/** The busiest site for sale with nothing built on it. */
export function bestOpenSite(w: World): TruckStopSite | null {
  let best: TruckStopSite | null = null;
  for (const s of w.sites) if (s.open && s.businessId === 0 && (!best || s.traffic > best.traffic)) best = s;
  return best;
}

/** A site's price: the kind's list price scaled by its traffic against the open sites' median, and by the catalogue index. */
export function sitePriceFd(w: World, site: TruckStopSite): number {
  const k = w.cfg.businesses;
  const open = w.sites.filter((s) => s.open).map((s) => s.traffic).sort((a, b) => a - b);
  const median = open.length ? open[Math.floor(open.length / 2)]! : 1;
  const scale = clamp(median > 0 ? site.traffic / median : 1, k.sites.priceRange[0], k.sites.priceRange[1]);
  return k.kinds.truckStop.priceFd * scale * (w.cfg.token.catalogue.enabled ? priceIndex(w) : 1);
}

const alongByWorld = new WeakMap<World, WeakMap<Route, { site: number; mile: number }[]>>();
const byEdgeByWorld = new WeakMap<World, Map<number, TruckStopSite[]>>();

/** The sites a route passes, with the mile each sits at, in order. */
export function sitesAlong(w: World, route: Route): { site: number; mile: number }[] {
  let cache = alongByWorld.get(w);
  if (!cache) alongByWorld.set(w, (cache = new WeakMap()));
  const hit = cache.get(route);
  if (hit) return hit;
  let byEdge = byEdgeByWorld.get(w);
  if (!byEdge) {
    byEdge = new Map();
    for (const s of w.sites) {
      let list = byEdge.get(s.edge);
      if (!list) byEdge.set(s.edge, (list = []));
      list.push(s);
    }
    byEdgeByWorld.set(w, byEdge);
  }
  const out: { site: number; mile: number }[] = [];
  for (let i = 0; i < route.edges.length; i++) {
    const signed = route.edges[i]!;
    const list = byEdge.get(signed >= 0 ? signed : -signed - 1);
    if (!list) continue;
    const { e, forward } = w.net.roads.edgeOf(signed);
    for (const s of list) out.push({ site: s.id, mile: route.cum[i]! + (forward ? s.frac : 1 - s.frac) * e.miles });
  }
  out.sort((p, q) => p.mile - q.mile || p.site - q.site);
  cache.set(route, out);
  return out;
}

/** The road route of the leg a truck is on (null between a place and itself). */
export const legRoute = (w: World, truck: Truck): Route | null => placeRoute(w, truck.place, truck.targetPlace);
/** How far along its leg a truck is, in miles. */
export const legMile = (truck: Truck): number => Math.max(0, truck.legMiles - truck.remainingMi);

/** The nearest built truck stop to a mile of a route, within range. */
export function nearestStopOnLeg(w: World, route: Route, mile: number, rangeMi: number): { business: Business; site: TruckStopSite; distMi: number } | null {
  let best: { business: Business; site: TruckStopSite; distMi: number } | null = null;
  for (const s of sitesAlong(w, route)) {
    const distMi = Math.abs(s.mile - mile);
    if (distMi > rangeMi) continue;
    const site = w.sites[s.site - 1]!;
    const business = siteBusiness(w, site);
    if (!business) continue;
    if (!best || distMi < best.distMi) best = { business, site, distMi };
  }
  return best;
}

/** The site at a mile of the route, within a mile and a half, if any. */
export function siteHere(w: World, route: Route, mile: number): TruckStopSite | null {
  for (const s of sitesAlong(w, route)) if (Math.abs(s.mile - mile) <= 1.5) return w.sites[s.site - 1] ?? null;
  return null;
}

export const hasRoom = (site: TruckStopSite): boolean => site.parked < site.spaces;

/**
 * Where the day should end: the last site with room the hours still reach. Returns that site's mile
 * when the truck would pass it this hour (so it stops there, early if the next is beyond the hours),
 * else null: drive on. No stop within reach means the night will be wherever the hours run out.
 */
export function planNight(w: World, truck: Truck, route: Route, mile: number, reachMi: number, milesThisHour: number): number | null {
  if (!w.cfg.businesses.enabled) return null;
  if (truck.legMiles - mile <= reachMi + 1e-9) return null; // the leg ends within the hours
  let last: { site: number; mile: number } | null = null;
  // A crew on this truck (robbery.ts): the last truck stop in reach, where the crew can't get at it, if there is one.
  const wary = w.cfg.robbery.enabled && crewOn(w, truck.id) !== undefined;
  let lastStop: { site: number; mile: number } | null = null;
  for (const s of sitesAlong(w, route)) {
    if (s.mile <= mile + 0.1) continue;
    if (s.mile > mile + reachMi) break;
    if (hasRoom(w.sites[s.site - 1]!)) {
      last = s;
      if (wary && siteBusiness(w, w.sites[s.site - 1]!)) lastStop = s;
    }
  }
  if (lastStop) last = lastStop;
  if (!last || last.mile > mile + milesThisHour + 1e-9) return null;
  return last.mile;
}

/**
 * The night, charged once per shift. At a site: a space (the public rest area is free, the full
 * idling; a player's truck stop idles at a quarter for its nightly price, taxed, the owner's own
 * trucks free). On the shoulder: illegal unless broken down — the full idling and, at the patrol's
 * odds, a ticket (a sink). The gallons count toward the fuel tax.
 */
export function parkForTheNight(w: World, truck: Truck, site: TruckStopSite | null): void {
  if (truck.restShiftT === truck.shiftStartT) return;
  truck.restShiftT = truck.shiftStartT;
  if (!truck.companyId || !truck.driverId) return;
  const { cfg } = w;
  const c = companyById(w, truck.companyId);
  const stop = site ? siteBusiness(w, site) : null;
  if (site) {
    site.parked++;
    truck.restSite = site.id;
    w.metrics.onNight("site");
  } else {
    w.metrics.onNight("shoulder");
  }
  const gal = cfg.costs.idleFuelGalPerDay * (truck.mods.apu ? 0.5 : 1) * (stop ? cfg.businesses.kinds.truckStop.idleFuelMult : 1);
  const burned = lockCost(w, c, gal * fuelPrice(w), () => gal * fuelPrice(w) * (1 - stakeDiscount(w, c)));
  c.fuelGalMonth += gal;
  if (burned > 0.005) {
    w.ledger.post(w.t, companyAccount(c.id), "sink:idle_fuel", burned, `rest:${truck.id}`);
    c.operating.costFd += burned;
  }
  if (stop && stop.ownerId !== c.id && stop.parkingFd > 0.005) {
    w.ledger.post(w.t, companyAccount(c.id), companyAccount(stop.ownerId), stop.parkingFd, `rest:${truck.id}`);
    stop.netFd += stop.parkingFd;
    c.operating.costFd += stop.parkingFd + chargeSalesTax(w, c.id, stop.parkingFd, `rest:${truck.id}`);
  }
  const p = cfg.businesses.parking;
  if (!site && cfg.businesses.enabled && truck.breakdownMin <= 1e-9 && w.rng.ops.next() < p.patrolOdds) {
    w.ledger.post(w.t, companyAccount(c.id), "sink:fines", p.shoulderFineFd, `fine:shoulder:${truck.id}`);
    c.operating.costFd += p.shoulderFineFd;
    c.safety.finesFd += p.shoulderFineFd; // the Company page's fines row counts tickets too (diary 2, row 7); no rule reads it
    w.metrics.onTicket();
    w.listener?.({ kind: "notice", companyId: c.id, topic: "safety", text: `Truck ${truck.id}: ticketed ${p.shoulderFineFd} FD for shutting down on the shoulder — sleep at a rest area or a truck stop.`, tone: "bad", truckId: truck.id });
  }
  // A loaded reefer's unit runs through the night (equipmentOps).
  const ops = cfg.equipmentOps;
  if (ops.enabled && truck.trailer === "reefer" && truck.status === "loaded") reeferUnit(w, c, ops.nightHours * 60, `rest:${truck.id}`);
  // Cargo theft (risk.ts): where it sleeps, near what, with what aboard.
  nightTheft(w, truck, c, site ? (stop ? "truckStop" : "restArea") : "shoulder", site ? site.theftRisk : null);
  // A hired crew (robbery.ts), when one is on this truck.
  if (cfg.robbery.enabled && truck.companyId) crewStrike(w, truck, c, site ? (stop ? "truckStop" : "restArea") : "shoulder", site ? site.theftRisk : theftRiskAt(w, ...truckLatLon(w, truck)));
}

/** The morning: the space is free again. */
export function leaveParking(w: World, truck: Truck): void {
  if (!truck.restSite) return;
  const site = w.sites[truck.restSite - 1];
  if (site && site.parked > 0) site.parked--;
  truck.restSite = 0;
}
