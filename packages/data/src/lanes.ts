import { buildEconomy, loadPlaces, type Economy, type Place } from "./flows.js";
import { PLACE_OF_HUB } from "./places.js";
import type { EconomyConfig } from "@lanes/config";
import { dasin, dcos, dsin } from "./dmath.js";
import type { Hub } from "./hubs.js";
import { RoadNetwork, type Route } from "./roadNetwork.js";

export interface Lane {
  id: number;
  origin: number; // hub index
  dest: number; // hub index
  /** Road miles along the route. */
  miles: number;
  /** Linehaul base rate per mile before ratio, weather, equipment and FSC. */
  baseRate: number;
  /** Driving hours along the route at each road's speed. */
  hours: number;
  /** Tolls for a truck, the whole lane. */
  tollFd: number;
  /** Share of the miles on two-lane US highways rather than interstates. */
  highwayShare: number;
}

const EARTH_RADIUS_MI = 3958.8;

export function greatCircleMiles(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const sLat = dsin(dLat / 2);
  const sLon = dsin(dLon / 2);
  const h = sLat * sLat + dcos(a.lat * rad) * dcos(b.lat * rad) * sLon * sLon;
  return 2 * EARTH_RADIUS_MI * dasin(Math.sqrt(h));
}

export interface Network {
  hubs: Hub[];
  lanes: Lane[];
  /** Road miles between hub i and j (n × n, row-major). */
  miles: Float64Array;
  /** lanes from origin hub index. */
  lanesFrom: Lane[][];
  /** Hub indices within `nearbyRadiusMi` of each hub, nearest first (includes self). */
  nearby: number[][];
  starterIdx: number[];
  /** The road network, and the route between every pair of hubs (n × n, row-major; null on the diagonal). */
  roads: RoadNetwork;
  routes: (Route | null)[];
  /** Places under the markets, their road terminals, and who makes and buys what (DESIGN-PLACES.md). */
  places: Place[];
  placeTerminal: Int32Array;
  economy: Economy;
  /** Each place's three nearest hubs as the crow flies: long routes run through them. */
  placeHubs: number[][];
  placeRoutes: Map<number, Route | null>;
}

/** Within this distance two places are routed directly; beyond it the route runs hub to hub between them. */
const DIRECT_MI = 300;

/** Joins road routes end to end into one. */
function joinRoutes(parts: Route[]): Route {
  let n = 0;
  for (const p of parts) n += p.edges.length;
  const edges = new Int32Array(n);
  const cum = new Float64Array(n + 1);
  let miles = 0;
  let hours = 0;
  let tollFd = 0;
  let highwayMi = 0;
  let k = 0;
  let run = 0;
  for (const p of parts) {
    for (let i = 0; i < p.edges.length; i++) {
      edges[k] = p.edges[i]!;
      cum[k] = run + (p.cum[i]! - p.cum[0]!);
      k++;
    }
    run += p.cum[p.edges.length]! - p.cum[0]!;
    miles += p.miles;
    hours += p.hours;
    tollFd += p.tollFd;
    highwayMi += p.highwayMi;
  }
  cum[n] = run;
  return { miles, hours, tollFd, highwayMi, edges, cum };
}

/**
 * The road route between two places (null if unconnected). Nearby pairs are routed
 * directly; long hauls run place → a nearby hub → a hub near the destination → place,
 * the cheapest of the nine combinations, so every route is a real road path and the
 * expensive searches are the few from each place to its own hubs. Cached per pair.
 */
export function placeRoute(net: Network, a: number, b: number): Route | null {
  if (a === b) return null;
  const key = a * 1_000_000 + b;
  const hit = net.placeRoutes.get(key);
  if (hit !== undefined) return hit;
  const ta = net.placeTerminal[a]!;
  const tb = net.placeTerminal[b]!;
  let route: Route | null = null;
  const direct = greatCircleMiles(net.places[a]!, net.places[b]!) < DIRECT_MI || ta < net.hubs.length || tb < net.hubs.length;
  if (direct) {
    route = net.roads.route(ta, tb);
  } else {
    let best: Route[] | null = null;
    let bestCost = Infinity;
    for (const h1 of net.placeHubs[a]!) {
      const leg1 = net.roads.route(ta, h1);
      if (!leg1) continue;
      for (const h2 of net.placeHubs[b]!) {
        const leg2 = h1 === h2 ? null : net.routes[h1 * net.hubs.length + h2];
        if (h1 !== h2 && !leg2) continue;
        const leg3 = net.roads.route(h2, tb);
        if (!leg3) continue;
        const cost = leg1.hours + (leg2?.hours ?? 0) + leg3.hours;
        if (cost < bestCost) {
          bestCost = cost;
          best = leg2 ? [leg1, leg2, leg3] : [leg1, leg3];
        }
      }
    }
    route = best ? joinRoutes(best) : net.roads.route(ta, tb);
  }
  net.placeRoutes.set(key, route);
  return route;
}

/** A quick estimate of road miles between two places (great circle × circuity), for scanning boards. */
export function placeMilesFast(net: Network, a: number, b: number, circuity = 1.2): number {
  if (a === b) return 0;
  return Math.round(greatCircleMiles(net.places[a]!, net.places[b]!) * circuity);
}

/** Road miles between two places, or great-circle × circuity where the roads don't connect them. */
export function placeMiles(net: Network, a: number, b: number, circuity = 1.2): number {
  if (a === b) return 0;
  const r = placeRoute(net, a, b);
  if (r) return Math.round(r.miles);
  const pa = net.places[a]!;
  const pb = net.places[b]!;
  return Math.round(greatCircleMiles(pa, pb) * circuity);
}

/**
 * Builds the lane network over the real road network: every hub pair is routed
 * along interstates and US highways, which sets its miles, hours, tolls and how
 * much of it is two-lane road. A pair the roads don't connect (none today) falls
 * back to great-circle × circuity.
 */
export function buildNetwork(hubs: Hub[], cfg: EconomyConfig): Network {
  const n = hubs.length;
  const roads = new RoadNetwork(cfg.roads.routing);

  // Places first: each one splits the road nearest it so routes run through the town. The hubs'
  // own places share the hubs' terminals. A place's market comes with the data (build-places.mjs
  // routes each one to the hub it reaches soonest by road).
  const places = loadPlaces();
  const placeTerminal = new Int32Array(places.length);
  const hubPlace = new Map<number, number>(PLACE_OF_HUB.map((p, h) => [p, h]));
  for (let p = 0; p < places.length; p++) {
    const h = hubPlace.get(p);
    const place = places[p]!;
    placeTerminal[p] = h !== undefined ? h : roads.addTerminal(place.lat, place.lon, { lat: place.atLat, lon: place.atLon });
  }

  const routes: (Route | null)[] = new Array<Route | null>(n * n).fill(null);
  const miles = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const r = roads.route(i, j);
      routes[i * n + j] = r;
      miles[i * n + j] = Math.round(r ? r.miles : greatCircleMiles(hubs[i]!, hubs[j]!) * cfg.map.circuity);
    }
  }

  const lanes: Lane[] = [];
  const lanesFrom: Lane[][] = hubs.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const m = miles[i * n + j]!;
      if (i === j || m < cfg.map.minLaneMiles || m > cfg.map.maxLaneMiles) continue;
      const r = routes[i * n + j];
      const lane: Lane = {
        id: lanes.length,
        origin: i,
        dest: j,
        miles: m,
        baseRate: cfg.rates.baseRatePerMile + cfg.rates.shortHaulBonus / m,
        hours: r ? r.hours : m / cfg.hos.avgMph,
        tollFd: r ? r.tollFd : 0,
        highwayShare: r && r.miles > 0 ? r.highwayMi / r.miles : 0,
      };
      lanes.push(lane);
      lanesFrom[i]!.push(lane);
    }
  }

  const nearby = hubs.map((_, i) =>
    hubs
      .map((_, j) => j)
      .filter((j) => miles[i * n + j]! <= cfg.map.nearbyRadiusMi)
      .sort((a, b) => miles[i * n + a]! - miles[i * n + b]! || a - b),
  );

  const starterIdx = hubs.flatMap((h, i) => (h.isStarter ? [i] : []));

  const economy = buildEconomy(places, n);
  const placeHubs = places.map((p) =>
    hubs
      .map((h, i) => ({ i, gc: greatCircleMiles(p, h) }))
      .sort((x, y) => x.gc - y.gc || x.i - y.i)
      .slice(0, 3)
      .map((x) => x.i),
  );
  return { hubs, lanes, miles, lanesFrom, nearby, starterIdx, roads, routes, places, placeTerminal, economy, placeHubs, placeRoutes: new Map() };
}
