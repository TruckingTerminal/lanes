import type { EconomyConfig } from "@lanes/config";
import { dasin, dcos, dsin } from "./dmath.js";
import type { Hub } from "./hubs.js";

export interface Lane {
  id: number;
  origin: number; // hub index
  dest: number; // hub index
  miles: number;
  /** Linehaul base rate per mile before ratio, weather, equipment and FSC. */
  baseRate: number;
}

const EARTH_RADIUS_MI = 3958.8;

export function greatCircleMiles(a: Hub, b: Hub): number {
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
}

/**
 * Builds the lane network. Road miles are great-circle × circuity until the OSRM
 * polyline precompute lands (Phase 0 task: "precomputed OSRM polylines").
 */
export function buildNetwork(hubs: Hub[], cfg: EconomyConfig): Network {
  const n = hubs.length;
  const miles = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      miles[i * n + j] = i === j ? 0 : Math.round(greatCircleMiles(hubs[i]!, hubs[j]!) * cfg.map.circuity);
    }
  }

  const lanes: Lane[] = [];
  const lanesFrom: Lane[][] = hubs.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const m = miles[i * n + j]!;
      if (i === j || m < cfg.map.minLaneMiles || m > cfg.map.maxLaneMiles) continue;
      const lane: Lane = {
        id: lanes.length,
        origin: i,
        dest: j,
        miles: m,
        baseRate: cfg.rates.baseRatePerMile + cfg.rates.shortHaulBonus / m,
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
  return { hubs, lanes, miles, lanesFrom, nearby, starterIdx };
}
