import { dcos } from "./dmath.js";

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
  ["GA-VAL", "Lake Park", "I-75", 30.73, -83.27],
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

const MI_PER_DEG_LAT = 69.0;

/**
 * Stations within `radiusMi` of the straight route from a to b, as fractions of
 * the way along it (sorted). Flat-earth math around the route's mid-latitude:
 * plenty for corridors a few hundred miles wide.
 */
export function stationsOnRoute(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  radiusMi: number,
  stations: readonly WeighStation[] = weighStations,
): { station: number; frac: number }[] {
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const kx = MI_PER_DEG_LAT * dcos(midLat);
  const ax = a.lon * kx;
  const ay = a.lat * MI_PER_DEG_LAT;
  const dx = b.lon * kx - ax;
  const dy = b.lat * MI_PER_DEG_LAT - ay;
  const len2 = dx * dx + dy * dy;
  const out: { station: number; frac: number }[] = [];
  if (len2 === 0) return out;
  stations.forEach((s, i) => {
    const px = s.lon * kx - ax;
    const py = s.lat * MI_PER_DEG_LAT - ay;
    const f = (px * dx + py * dy) / len2;
    if (f <= 0.02 || f >= 0.98) return; // at either end is the hub itself, not the road between
    const ex = px - f * dx;
    const ey = py - f * dy;
    if (ex * ex + ey * ey <= radiusMi * radiusMi) out.push({ station: i, frac: f });
  });
  return out.sort((p, q) => p.frac - q.frac || p.station - q.station);
}
