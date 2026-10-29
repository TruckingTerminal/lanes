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
}

/** The road route between two places (null if unconnected). Cached in the road network. */
export function placeRoute(net: Network, a: number, b: number): Route | null {
  if (a === b) return null;
  return net.roads.route(net.placeTerminal[a]!, net.placeTerminal[b]!);
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

  // Places: attached to the nearest road node; the hubs' own places share the hubs' terminals.
  // A place's market is the hub it reaches by road soonest, among the few nearest as the crow flies.
  const places = loadPlaces();
  const placeTerminal = new Int32Array(places.length);
  const hubPlace = new Map<number, number>(PLACE_OF_HUB.map((p, h) => [p, h]));
  for (let p = 0; p < places.length; p++) {
    const h = hubPlace.get(p);
    placeTerminal[p] = h !== undefined ? h : roads.addTerminal(places[p]!.lat, places[p]!.lon);
    if (h !== undefined) continue;
    const near = hubs
      .map((hub, i) => ({ i, gc: greatCircleMiles(places[p]!, hub) }))
      .sort((a, b) => a.gc - b.gc)
      .slice(0, 4);
    let best = near[0]!.i;
    let bestMi = Infinity;
    for (const { i } of near) {
      const r = roads.route(placeTerminal[p]!, i);
      const mi = r ? r.miles : Infinity;
      if (mi < bestMi) {
        bestMi = mi;
        best = i;
      }
    }
    places[p]!.market = best;
  }
  const economy = buildEconomy(places, n);
  return { hubs, lanes, miles, lanesFrom, nearby, starterIdx, roads, routes, places, placeTerminal, economy };
}
