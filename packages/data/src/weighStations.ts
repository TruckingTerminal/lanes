import { dasin, datan2, dcos, dsin } from "./dmath.js";

export interface WeighStation {
  id: string;
  name: string;
  /** The interstate it sits on. */
  route: string;
  lat: number;
  lon: number;
}

/**
 * Permanent scales and ports of entry on the main freight corridors. Locations
 * are approximate (within a few miles), good enough for a route on this map to
 * know which stations it passes. Texas mostly enforces with mobile units, so it
 * has none here.
 */
type Row = [id: string, name: string, route: string, lat: number, lon: number];
const ROWS: Row[] = [
  ["CA-COR", "Cordelia", "I-80", 38.22, -122.13],
  ["CA-CAS", "Castaic", "I-5", 34.48, -118.62],
  ["CA-GRV", "Grapevine", "I-5", 34.93, -118.92],
  ["CA-CAB", "Cabazon", "I-10", 33.93, -116.82],
  ["CA-SON", "San Onofre", "I-5", 33.38, -117.57],
  ["CA-YER", "Yermo", "I-15", 34.91, -116.82],
  ["CA-TRK", "Truckee", "I-80", 39.33, -120.16],
  ["AZ-EHR", "Ehrenberg POE", "I-10", 33.6, -114.52],
  ["AZ-SSM", "San Simon POE", "I-10", 32.27, -109.22],
  ["AZ-SAN", "Sanders POE", "I-40", 35.21, -109.33],
  ["AZ-TOP", "Topock POE", "I-40", 34.72, -114.48],
  ["NM-LOR", "Lordsburg POE", "I-10", 32.35, -108.7],
  ["NM-GAL", "Gallup POE", "I-40", 35.52, -108.74],
  ["NM-SJN", "San Jon POE", "I-40", 35.11, -103.33],
  ["NM-ANT", "Anthony POE", "I-10", 32.0, -106.6],
  ["OK-ERK", "Erick POE", "I-40", 35.22, -99.87],
  ["OK-THK", "Thackerville POE", "I-35", 33.79, -97.14],
  ["AR-WMP", "West Memphis", "I-40", 35.15, -90.22],
  ["AR-ALM", "Alma", "I-40", 35.48, -94.22],
  ["TN-HAY", "Haywood County", "I-40", 35.58, -89.3],
  ["TN-ROB", "Robertson County", "I-65", 36.55, -86.62],
  ["TN-MON", "Monteagle", "I-24", 35.24, -85.84],
  ["GA-RIN", "Ringgold", "I-75", 34.92, -85.12],
  ["GA-VAL", "Lake Park", "I-75", 30.72, -83.22],
  ["GA-KNG", "Kingsland", "I-95", 30.83, -81.67],
  ["GA-CAR", "Carnesville", "I-85", 34.38, -83.24],
  ["GA-TAL", "Tallapoosa", "I-20", 33.73, -85.29],
  ["FL-YUL", "Yulee", "I-95", 30.65, -81.62],
  ["FL-WLD", "Wildwood", "I-75", 28.84, -82.06],
  ["FL-PGD", "Punta Gorda", "I-75", 26.94, -82.03],
  ["FL-STL", "St. Lucie", "I-95", 27.37, -80.4],
  ["FL-ESC", "Escambia", "I-10", 30.6, -87.34],
  ["LA-VIN", "Vinton", "I-10", 30.19, -93.58],
  ["LA-GRW", "Greenwood", "I-20", 32.45, -93.97],
  ["MS-MER", "Meridian", "I-20", 32.33, -88.6],
  ["AL-BAL", "Baldwin County", "I-10", 30.67, -87.86],
  ["SC-HRD", "Hardeeville", "I-95", 32.3, -81.08],
  ["NC-CHL", "Kings Mountain", "I-85", 35.2, -81.39],
  ["VA-DUM", "Dumfries", "I-95", 38.57, -77.33],
  ["VA-STC", "Stephens City", "I-81", 39.08, -78.22],
  ["MD-PER", "Perryville", "I-95", 39.58, -76.05],
  ["NJ-BLM", "Bloomsbury", "I-78", 40.65, -75.08],
  ["PA-LIN", "Lamar", "I-80", 41.0, -77.53],
  ["KY-SIM", "Simpson County", "I-65", 36.65, -86.5],
  ["KY-KEN", "Kenton County", "I-75", 38.96, -84.6],
  ["OH-FIN", "Findlay", "I-75", 41.1, -83.66],
  ["IN-RIC", "Richmond", "I-70", 39.83, -84.85],
  ["IL-MAR", "Marshall", "I-70", 39.4, -87.7],
  ["IA-DEX", "Dexter", "I-80", 41.52, -94.2],
  ["IA-LAM", "Lamoni POE", "I-35", 40.62, -93.94],
  ["MO-CON", "Concordia", "I-70", 38.98, -93.57],
  ["MO-JOP", "Joplin", "I-44", 37.07, -94.5],
  ["NE-WAC", "Waco", "I-80", 40.9, -97.47],
  ["NE-GIB", "Gibbon", "I-80", 40.73, -98.85],
  ["WY-CHY", "Cheyenne POE", "I-80", 41.1, -104.8],
  ["WY-EVN", "Evanston POE", "I-80", 41.26, -111.0],
  ["UT-PER", "Perry", "I-15", 41.47, -112.03],
  ["OR-WOO", "Woodburn", "I-5", 45.15, -122.85],
  ["OR-ASH", "Ashland POE", "I-5", 42.17, -122.64],
  ["WA-RID", "Ridgefield", "I-5", 45.8, -122.73],
];

export const weighStations: WeighStation[] = ROWS.map(([id, name, route, lat, lon]) => ({ id, name, route, lat, lon }));

const RAD = Math.PI / 180;
const EARTH_MI = 3958.8;
/** Points sampled along a route, about this far apart. */
const SAMPLE_MI = 15;

type LL = { lat: number; lon: number };

function milesBetween(a: LL, b: LL): number {
  const sLat = dsin(((b.lat - a.lat) * RAD) / 2);
  const sLon = dsin(((b.lon - a.lon) * RAD) / 2);
  const h = sLat * sLat + dcos(a.lat * RAD) * dcos(b.lat * RAD) * sLon * sLon;
  return 2 * EARTH_MI * dasin(Math.sqrt(h));
}

/** Points along the great circle from a to b, as fractions of the way and positions, deterministic (dmath only). */
function greatCirclePoints(a: LL, b: LL, n: number): { f: number; p: LL }[] {
  const toVec = (p: LL): [number, number, number] => {
    const la = p.lat * RAD;
    const lo = p.lon * RAD;
    return [dcos(la) * dcos(lo), dcos(la) * dsin(lo), dsin(la)];
  };
  const va = toVec(a);
  const vb = toVec(b);
  // Products, not ** 2: a square is exact either way, but ** goes through each engine's own pow.
  const dx = va[0] - vb[0];
  const dy = va[1] - vb[1];
  const dz = va[2] - vb[2];
  const chord = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const ang = 2 * dasin(Math.min(1, chord / 2));
  const sinAng = dsin(ang);
  const out: { f: number; p: LL }[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = sinAng > 1e-12 ? dsin((1 - f) * ang) / sinAng : 1 - f;
    const B = sinAng > 1e-12 ? dsin(f * ang) / sinAng : f;
    const x = A * va[0] + B * vb[0];
    const y = A * va[1] + B * vb[1];
    const z = A * va[2] + B * vb[2];
    out.push({ f, p: { lat: datan2(z, Math.sqrt(x * x + y * y)) / RAD, lon: datan2(y, x) / RAD } });
  }
  return out;
}

/**
 * Stations within `radiusMi` of the great-circle route from a to b, as fractions
 * of the way along it (sorted). The route is sampled every ~15 miles, so a station
 * is matched to the nearest sample: good to about a mile. Stations within
 * `endMarginMi` of either hub belong to the hub, not to the road between.
 */
export function stationsOnRoute(a: LL, b: LL, radiusMi: number, stations: readonly WeighStation[] = weighStations, endMarginMi = 5): { station: number; frac: number }[] {
  const total = milesBetween(a, b);
  const out: { station: number; frac: number }[] = [];
  if (total <= 2 * endMarginMi) return out;
  const samples = greatCirclePoints(a, b, Math.max(2, Math.ceil(total / SAMPLE_MI)));
  stations.forEach((s, i) => {
    let best = Infinity;
    let at = 0;
    for (const { f, p } of samples) {
      const d = milesBetween(s, p);
      if (d < best) {
        best = d;
        at = f;
      }
    }
    const along = at * total;
    if (best <= radiusMi && along >= endMarginMi && total - along >= endMarginMi) out.push({ station: i, frac: at });
  });
  return out.sort((p, q) => p.frac - q.frac || p.station - q.station);
}
