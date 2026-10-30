/**
 * Terrain along the roads (Jeff, 2026-10-29/30, TODO.md 13): from the elevation grid, every edge and
 * every route gets its climb, its miles on grades over `mountainGrade`, and its miles above
 * `passElevM`. The engine turns those into fuel, speed, breakdown and crash risk, and winter
 * closures. Elevations are read once per geometry point and kept per network.
 */
import { elevationAt } from "./elevation.js";
import type { RoadNetwork, Route } from "./roadNetwork.js";

export interface Terrain {
  /** Meters climbed and descended along the way. */
  climbM: number;
  descentM: number;
  /** The steepest grade met (rise over run), and the highest point. */
  maxGrade: number;
  maxElevM: number;
  /** Miles on grades steeper than the rule's `mountainGrade`, and miles above its `passElevM`. */
  mountainMi: number;
  passMi: number;
}

export interface TerrainRule {
  mountainGrade: number;
  passElevM: number;
}

export const NO_TERRAIN: Terrain = { climbM: 0, descentM: 0, maxGrade: 0, maxElevM: 0, mountainMi: 0, passMi: 0 };

const pointElev = new WeakMap<RoadNetwork, Float32Array>();
const edgeCache = new WeakMap<RoadNetwork, Map<string, Terrain>>();
const routeCache = new WeakMap<Route, Map<string, Terrain>>();
const ruleKey = (r: TerrainRule) => `${r.mountainGrade}|${r.passElevM}`;
const METERS_PER_MILE = 1609.344;

function elevOfPoint(roads: RoadNetwork, k: number): number {
  let e = pointElev.get(roads);
  if (!e || e.length < roads.lat.length) {
    const grown = new Float32Array(roads.lat.length).fill(NaN);
    if (e) grown.set(e);
    pointElev.set(roads, (e = grown));
  }
  let v = e[k]!;
  if (Number.isNaN(v)) e[k] = v = elevationAt(roads.lat[k]!, roads.lon[k]!);
  return v;
}

/** An edge's terrain, walking its geometry points. */
export function edgeTerrain(roads: RoadNetwork, ei: number, rule: TerrainRule): Terrain {
  let cache = edgeCache.get(roads);
  if (!cache) edgeCache.set(roads, (cache = new Map()));
  const key = `${ei}|${ruleKey(rule)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const e = roads.edges[ei]!;
  const t: Terrain = { ...NO_TERRAIN };
  const end = e.g0 + e.gn - 1;
  let prevElev = elevOfPoint(roads, e.g0);
  t.maxElevM = prevElev;
  for (let k = e.g0; k < end; k++) {
    const dMi = roads.along[k + 1]! - roads.along[k]!;
    const elev = elevOfPoint(roads, k + 1);
    t.maxElevM = Math.max(t.maxElevM, elev);
    if (dMi > 0.05) {
      const dz = elev - prevElev;
      const grade = Math.abs(dz) / (dMi * METERS_PER_MILE);
      if (dz > 0) t.climbM += dz;
      else t.descentM -= dz;
      t.maxGrade = Math.max(t.maxGrade, grade);
      if (grade > rule.mountainGrade) t.mountainMi += dMi;
      if (Math.max(elev, prevElev) > rule.passElevM) t.passMi += dMi;
    }
    prevElev = elev;
  }
  cache.set(key, t);
  return t;
}

/** A route's terrain: its edges summed (direction only swaps climb and descent). */
export function routeTerrain(roads: RoadNetwork, route: Route, rule: TerrainRule): Terrain {
  let cache = routeCache.get(route);
  if (!cache) routeCache.set(route, (cache = new Map()));
  const key = ruleKey(rule);
  const hit = cache.get(key);
  if (hit) return hit;
  const t: Terrain = { ...NO_TERRAIN };
  for (const signed of route.edges) {
    const et = edgeTerrain(roads, signed >= 0 ? signed : -signed - 1, rule);
    const forward = signed >= 0;
    t.climbM += forward ? et.climbM : et.descentM;
    t.descentM += forward ? et.descentM : et.climbM;
    t.maxGrade = Math.max(t.maxGrade, et.maxGrade);
    t.maxElevM = Math.max(t.maxElevM, et.maxElevM);
    t.mountainMi += et.mountainMi;
    t.passMi += et.passMi;
  }
  cache.set(key, t);
  return t;
}
