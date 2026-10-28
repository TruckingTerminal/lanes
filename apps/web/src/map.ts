import type { Hub } from "@lanes/data";
import { PAL, type Color } from "./art.js";

/**
 * The pixel map: the lower 48 in an Albers equal-area projection (the shape
 * people know from road atlases), painted once into a base layer — terrain,
 * lakes, rivers, roads, cities — at MAP_W × MAP_H art pixels.
 */
export const MAP_W = 400;
export const MAP_H = 248;

type LL = [lon: number, lat: number];

const PACIFIC: LL[] = [
  [-124.7, 48.4], [-124.1, 46.9], [-124.0, 46.2], [-123.9, 45.5], [-124.1, 44.6], [-124.2, 43.6], [-124.5, 42.8], [-124.2, 42.0],
  [-124.1, 41.0], [-123.8, 39.8], [-123.6, 38.9], [-122.9, 38.0], [-122.5, 37.7], [-122.4, 37.2], [-121.9, 36.6], [-121.4, 36.0],
  [-120.8, 35.3], [-120.6, 34.6], [-119.6, 34.4], [-118.8, 34.0], [-118.4, 33.8], [-117.9, 33.6], [-117.3, 33.0], [-117.1, 32.5],
];
const MEX_BORDER: LL[] = [
  [-114.7, 32.7], [-111.0, 31.33], [-108.2, 31.33], [-108.2, 31.78], [-106.5, 31.78], [-105.0, 30.7], [-104.4, 29.6], [-103.2, 28.98],
  [-102.7, 29.7], [-101.4, 29.8], [-100.6, 28.9], [-99.5, 27.5], [-99.1, 26.4], [-98.0, 26.0], [-97.4, 25.9],
];
const GULF_ATLANTIC: LL[] = [
  [-97.2, 26.6], [-97.4, 27.4], [-97.0, 28.0], [-96.0, 28.6], [-95.0, 29.2], [-94.0, 29.7], [-93.2, 29.8], [-92.0, 29.6], [-91.2, 29.3],
  [-90.2, 29.1], [-89.4, 29.0], [-89.2, 29.3], [-89.6, 30.2], [-88.6, 30.4], [-87.6, 30.3], [-86.5, 30.4], [-85.4, 29.9], [-84.6, 29.8],
  [-84.0, 30.1], [-83.4, 29.6], [-82.8, 28.9], [-82.7, 28.0], [-82.6, 27.4], [-82.1, 26.6], [-81.8, 25.9], [-81.1, 25.2], [-80.4, 25.2],
  [-80.1, 25.8], [-80.0, 26.7], [-80.2, 27.4], [-80.6, 28.4], [-81.0, 29.3], [-81.4, 30.3], [-81.4, 30.9], [-81.1, 31.8], [-80.5, 32.4],
  [-79.6, 32.9], [-78.9, 33.6], [-78.0, 33.9], [-77.3, 34.6], [-76.5, 34.7], [-75.5, 35.2], [-75.7, 36.2], [-75.9, 36.9], [-75.6, 37.5],
  [-75.2, 38.3], [-75.0, 38.8], [-74.9, 39.1], [-74.4, 39.5], [-74.0, 40.1], [-74.0, 40.5], [-73.8, 40.7], [-72.6, 40.9], [-71.9, 41.1],
  [-72.5, 41.25], [-71.5, 41.4], [-71.0, 41.5], [-70.6, 41.5], [-70.0, 41.7], [-70.0, 42.05], [-70.6, 41.9], [-70.9, 42.4], [-70.6, 42.7],
  [-70.7, 43.1], [-70.2, 43.7], [-69.5, 43.9], [-68.8, 44.3], [-68.0, 44.4], [-67.0, 44.8],
];
const CANADA_BORDER: LL[] = [
  [-67.8, 45.7], [-67.8, 47.1], [-68.3, 47.35], [-69.2, 47.45], [-70.0, 46.7], [-70.5, 45.7], [-71.5, 45.0], [-74.7, 45.0], [-75.8, 44.4],
  [-76.4, 44.1], [-76.8, 43.6], [-78.5, 43.6], [-79.2, 43.4], [-79.0, 42.9], [-79.8, 42.5], [-81.3, 42.2], [-82.5, 41.9], [-83.1, 42.1],
  [-82.5, 42.6], [-82.4, 43.0], [-82.2, 43.6], [-82.5, 45.3], [-83.4, 45.9], [-84.1, 46.2], [-84.6, 46.5], [-85.0, 46.9], [-86.5, 47.6],
  [-88.4, 48.3], [-89.6, 48.0], [-90.8, 48.2], [-91.6, 48.1], [-93.0, 48.6], [-94.6, 48.7], [-95.15, 49.0], [-123.3, 49.0], [-123.1, 48.7],
  [-123.4, 48.3],
];
/** The continent around the US, so Canada and Mexico read as land, not sea. */
const BC_COAST: LL[] = [[-131, 53], [-128.5, 51.0], [-127.5, 50.2], [-125.5, 49.5]];
const MEXICO: LL[] = [
  [-116.7, 31.8], [-116.3, 30.9], [-115.8, 30.3], [-115.0, 29.4], [-114.2, 28.6], [-114.1, 27.8], [-113.5, 26.8], [-112.6, 26.0], [-112.1, 24.8],
  [-111.6, 23.6], [-110.8, 24.2], [-111.3, 25.6], [-112.2, 27.0], [-112.9, 28.3], [-113.9, 29.9], [-114.6, 30.9], [-114.8, 31.7], [-114.0, 31.4],
  [-113.1, 31.2], [-112.2, 29.8], [-111.0, 28.0], [-110.1, 27.0], [-109.3, 25.6], [-108.4, 25.0], [-107.6, 23.0], [-97.8, 23.0], [-97.8, 24.2],
  [-97.5, 25.0],
];
const CANADA_EAST: LL[] = [[-66.0, 45.3], [-64.0, 46.0], [-61, 46.5], [-61, 53]];

const LAKES: LL[][] = [
  // Superior
  [[-92.1, 46.75], [-91.0, 46.9], [-90.4, 46.6], [-89.6, 46.85], [-88.4, 47.0], [-87.9, 47.45], [-87.2, 46.9], [-86.5, 46.45], [-85.6, 46.7], [-84.9, 46.5],
   [-84.6, 46.45], [-84.8, 47.0], [-84.9, 47.9], [-85.8, 48.0], [-86.6, 48.75], [-88.3, 48.8], [-89.3, 48.4], [-90.0, 47.9], [-91.0, 47.4], [-91.8, 47.0]],
  // Michigan
  [[-87.8, 41.65], [-87.2, 41.65], [-86.6, 41.9], [-86.3, 42.6], [-86.2, 43.4], [-86.5, 44.0], [-86.2, 44.7], [-85.5, 45.3], [-85.0, 45.8], [-85.6, 45.95],
   [-86.5, 45.9], [-87.0, 45.6], [-87.3, 45.2], [-87.9, 44.5], [-87.6, 44.0], [-87.75, 43.2], [-87.85, 42.5], [-87.7, 42.0]],
  // Huron and Georgian Bay
  [[-84.7, 45.9], [-84.0, 45.95], [-83.4, 45.3], [-83.3, 44.6], [-83.4, 44.0], [-82.9, 44.05], [-82.6, 43.8], [-82.4, 43.0], [-81.9, 43.3], [-81.7, 44.0],
   [-81.3, 44.9], [-80.6, 44.6], [-80.0, 44.8], [-80.8, 45.9], [-81.6, 46.1], [-83.0, 46.1], [-84.2, 46.2]],
  // Erie
  [[-83.4, 41.7], [-82.6, 41.45], [-81.7, 41.5], [-80.5, 41.95], [-79.8, 42.25], [-78.9, 42.85], [-79.4, 42.85], [-80.4, 42.6], [-81.3, 42.65], [-82.0, 42.3],
   [-82.6, 42.0], [-83.1, 42.05]],
  // Ontario
  [[-79.8, 43.3], [-79.2, 43.25], [-78.0, 43.35], [-76.8, 43.3], [-76.2, 43.55], [-76.3, 44.0], [-77.0, 44.1], [-77.6, 43.95], [-78.7, 43.95], [-79.4, 43.65]],
];

const RIVERS: LL[][] = [
  // Mississippi
  [[-93.3, 45.0], [-91.2, 43.5], [-91.0, 40.6], [-90.2, 38.6], [-89.5, 37.0], [-90.0, 35.1], [-91.1, 33.0], [-91.4, 31.0], [-90.1, 29.95], [-89.4, 29.2]],
  // Missouri
  [[-111.3, 47.5], [-104.0, 48.0], [-100.8, 46.8], [-96.6, 42.5], [-95.9, 41.3], [-94.6, 39.1], [-92.2, 38.6], [-90.2, 38.8]],
  // Ohio
  [[-80.0, 40.4], [-82.0, 38.8], [-84.5, 39.1], [-85.8, 38.2], [-88.0, 37.8], [-89.2, 37.0]],
  // Colorado
  [[-108.6, 39.1], [-110.2, 38.2], [-111.6, 36.9], [-113.8, 36.1], [-114.6, 35.0], [-114.7, 32.7]],
  // Columbia
  [[-117.0, 48.9], [-119.0, 46.2], [-121.0, 45.6], [-124.0, 46.2]],
];

/** Mountain spines and how wide each range runs (degrees). */
const RANGES: { spine: LL[]; width: number; kind: "rock" | "wood" }[] = [
  { spine: [[-113.5, 48.8], [-110.9, 45.3], [-109.8, 43.0], [-106.8, 40.5], [-105.8, 38.5], [-105.6, 36.0], [-105.8, 34.5]], width: 1.7, kind: "rock" },
  { spine: [[-121.5, 48.5], [-121.8, 46.0], [-122.0, 43.5], [-121.3, 41.2], [-120.2, 38.8], [-118.6, 36.5], [-118.0, 35.3]], width: 0.9, kind: "rock" },
  { spine: [[-85.6, 34.0], [-83.6, 35.6], [-81.5, 37.0], [-79.5, 38.6], [-78.0, 40.4], [-76.0, 41.7], [-74.0, 42.4], [-72.8, 44.0], [-71.3, 44.3]], width: 1.0, kind: "wood" },
];

// --- Projection -------------------------------------------------------------------

const RAD = Math.PI / 180;
const PHI1 = 29.5 * RAD;
const PHI2 = 45.5 * RAD;
const PHI0 = 37.5 * RAD;
const LAM0 = -96 * RAD;
const N = (Math.sin(PHI1) + Math.sin(PHI2)) / 2;
const C = Math.cos(PHI1) ** 2 + 2 * N * Math.sin(PHI1);
const RHO0 = Math.sqrt(C - 2 * N * Math.sin(PHI0)) / N;

function albers(lon: number, lat: number): [number, number] {
  const rho = Math.sqrt(C - 2 * N * Math.sin(lat * RAD)) / N;
  const theta = N * (lon * RAD - LAM0);
  return [rho * Math.sin(theta), RHO0 - rho * Math.cos(theta)];
}

function inverseAlbers(x: number, y: number): LL {
  const rho = Math.sqrt(x * x + (RHO0 - y) ** 2);
  const theta = Math.atan2(x, RHO0 - y);
  const lon = (LAM0 + theta / N) / RAD;
  const lat = Math.asin((C - (rho * N) ** 2) / (2 * N)) / RAD;
  return [lon, lat];
}

const US_RING: LL[] = [...PACIFIC, ...MEX_BORDER, ...GULF_ATLANTIC, ...CANADA_BORDER];
const NA_RING: LL[] = [...BC_COAST, ...PACIFIC, ...MEXICO, ...GULF_ATLANTIC, ...CANADA_EAST];

// Fit the US (with a margin) to the art canvas.
const projUs = US_RING.map(([lo, la]) => albers(lo, la));
const minX = Math.min(...projUs.map((p) => p[0]));
const maxX = Math.max(...projUs.map((p) => p[0]));
const minY = Math.min(...projUs.map((p) => p[1]));
const maxY = Math.max(...projUs.map((p) => p[1]));
const MARGIN = 10;
const SCALE = Math.min((MAP_W - 2 * MARGIN) / (maxX - minX), (MAP_H - 2 * MARGIN) / (maxY - minY));
const OFF_X = (MAP_W - (maxX - minX) * SCALE) / 2;
const OFF_Y = (MAP_H - (maxY - minY) * SCALE) / 2;

/** Longitude/latitude → art pixel (x right, y down). */
export function project(lon: number, lat: number): [number, number] {
  const [x, y] = albers(lon, lat);
  return [OFF_X + (x - minX) * SCALE, OFF_Y + (maxY - y) * SCALE];
}

function unproject(px: number, py: number): LL {
  return inverseAlbers((px - OFF_X) / SCALE + minX, maxY - (py - OFF_Y) / SCALE);
}

// --- Geometry helpers ---------------------------------------------------------------

function inRing(ring: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToPolyline(line: LL[], lon: number, lat: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, ay] = line[i]!;
    const [bx, by] = line[i + 1]!;
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((lon - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(lon - (ax + t * dx), lat - (ay + t * dy)));
  }
  return best;
}

function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sm = (t: number) => t * t * (3 - 2 * t);
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * sm(fx) + (c - a) * sm(fy) + (a - b - c + d) * sm(fx) * sm(fy);
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const dither = (x: number, y: number) => BAYER[(y % 4) * 4 + (x % 4)]!;

// --- Terrain ------------------------------------------------------------------------

/** Two tones per biome and how much of the second shows through. */
function terrain(lon0: number, lat0: number, x: number, y: number): Color {
  const n = valueNoise(x / 9, y / 9, 1) * 0.65 + valueNoise(x / 3, y / 3, 2) * 0.35;
  // Warp the coordinates so biome edges wander instead of following meridians.
  const lon = lon0 + (valueNoise(x / 14, y / 14, 21) - 0.5) * 3.2;
  const lat = lat0 + (valueNoise(x / 14, y / 14, 22) - 0.5) * 2.0;
  const pick = (a: Color, b: Color, share: number) => (dither(x, y) < share ? b : a);
  for (const r of RANGES) {
    const d = distToPolyline(r.spine, lon0, lat0);
    const w = r.width * (0.7 + n * 0.5);
    if (d < w) {
      const core = 1 - d / w;
      // Foothills under the peak glyphs drawn later.
      if (r.kind === "rock") return pick(PAL.sage, PAL.mtnD, 0.2 + core * 0.45);
      return pick(PAL.forest, PAL.forestD, 0.3 + core * 0.5);
    }
  }
  if (lon < -120 && lat > 41.5) return pick(PAL.forest, PAL.forestD, 0.35 + n * 0.3);
  if (lon < -117 && lat <= 41.5) return pick(PAL.sage, PAL.olive, 0.3 + n * 0.4);
  if (lat < 36.5 && lon < -103) return pick(PAL.desert, PAL.sand, 0.25 + n * 0.5);
  if (lon < -111) return pick(PAL.sage, PAL.sandD, 0.2 + n * 0.5);
  if (lon < -102) return pick(PAL.sage, PAL.olive, 0.2 + n * 0.5);
  if (lon < -97) return lat < 33 ? pick(PAL.sage, PAL.desert, n * 0.6) : pick(PAL.olive, PAL.sage, 0.3 + n * 0.3);
  if (lat > 44.5) return pick(PAL.forest, PAL.grassD, 0.3 + n * 0.4);
  if (lat < 29.5 && lon > -83) return pick(PAL.grass, PAL.teal, 0.15 + n * 0.25);
  if (lat < 34) return pick(PAL.grassD, PAL.forest, 0.25 + n * 0.45);
  if (lon < -82 && lat >= 37) {
    // Midwest section-line farms: a patchwork of fields.
    const fx = Math.floor((x + Math.floor(n * 2)) / 5);
    const fy = Math.floor(y / 4);
    const crop = [PAL.olive, PAL.grass, PAL.sage, PAL.grassD, PAL.sandD][Math.floor(hash(fx, fy, 7) * 5)]!;
    return (x % 5 === 0 || y % 4 === 0) && hash(fx, fy, 9) > 0.5 ? PAL.grassD : crop;
  }
  return pick(PAL.grass, PAL.grassD, 0.25 + n * 0.4);
}

export interface MapArt {
  base: HTMLCanvasElement;
  /** Pixel position of every hub, by index. */
  hubXY: [number, number][];
  /** Window pixels that light up at night. */
  lights: [number, number][];
  /** A few water pixels that glint. */
  glints: [number, number][];
}

export function buildMap(hubs: Hub[], milesBetween: (a: number, b: number) => number): MapArt {
  const cv = document.createElement("canvas");
  cv.width = MAP_W;
  cv.height = MAP_H;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(MAP_W, MAP_H);
  const us = US_RING.map(([lo, la]) => project(lo, la));
  const na = NA_RING.map(([lo, la]) => project(lo, la));
  const lakes = LAKES.map((ring) => ring.map(([lo, la]) => project(lo, la)));

  // 0 = sea, 1 = US land, 2 = foreign land, 3 = lake.
  const kind = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      let k = inRing(us, cx, cy) ? 1 : inRing(na, cx, cy) ? 2 : 0;
      if (k !== 0 && lakes.some((l) => inRing(l, cx, cy))) k = 3;
      kind[y * MAP_W + x] = k;
    }
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? 0 : kind[y * MAP_W + x]!);
  const isWater = (k: number) => k === 0 || k === 3;
  const nearLand = (x: number, y: number, r: number) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (!isWater(at(x + i, y + j))) return true;
    return false;
  };

  const glints: [number, number][] = [];
  const put = (x: number, y: number, c: Color) => {
    const i = (y * MAP_W + x) * 4;
    img.data[i] = parseInt(c.slice(1, 3), 16);
    img.data[i + 1] = parseInt(c.slice(3, 5), 16);
    img.data[i + 2] = parseInt(c.slice(5, 7), 16);
    img.data[i + 3] = 255;
  };
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const k = at(x, y);
      if (isWater(k)) {
        let c: Color = k === 3 ? PAL.sea : dither(x, y) < 0.18 ? PAL.sea : PAL.seaD;
        if (nearLand(x, y, 1)) c = PAL.foam;
        else if (nearLand(x, y, 3)) c = dither(x, y) < 0.5 ? PAL.seaL : PAL.sea;
        else if (k === 0 && hash(x, y, 3) < 0.004) glints.push([x, y]);
        put(x, y, c);
      } else if (k === 2) {
        // Canada and Mexico: land, but quiet — off the board.
        put(x, y, dither(x, y) < 0.25 + valueNoise(x / 8, y / 8, 5) * 0.35 ? PAL.mtnD : PAL.ink3);
      } else {
        const [lon, lat] = unproject(x + 0.5, y + 0.5);
        put(x, y, terrain(lon, lat, x, y));
      }
    }
  }
  // Coast and borders: a dark edge where land meets water, a dotted border with Canada and Mexico.
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const k = at(x, y);
      if (k === 1 && [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].some(isWater)) put(x, y, PAL.sandD);
      if (k === 1 && [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].includes(2) && (x + y) % 2 === 0) put(x, y, PAL.ink1);
    }
  }
  ctx.putImageData(img, 0, 0);

  const line = (pts: [number, number][], color: Color, every = 1) => {
    ctx.fillStyle = color;
    for (let i = 0; i + 1 < pts.length; i++) {
      let [x0, y0] = pts[i]!.map(Math.round) as [number, number];
      const [x1, y1] = pts[i + 1]!.map(Math.round) as [number, number];
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      let step = 0;
      for (;;) {
        if (step++ % every === 0 && at(x0, y0) === 1) ctx.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y0 += sy;
        }
      }
    }
  };
  for (const r of RIVERS) line(r.map(([lo, la]) => project(lo, la)), PAL.seaL);

  // Peaks along the rock ranges: little shaded triangles, snow on the tallest.
  for (const r of RANGES) {
    const pts = r.spine.map(([lo, la]) => project(lo, la));
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i]!;
      const [bx, by] = pts[i + 1]!;
      const len = Math.hypot(bx - ax, by - ay);
      for (let d = 0; d < len; d += 3.2) {
        const t = d / len;
        const side = (hash(Math.round(ax + d), i, 31) - 0.5) * (r.kind === "rock" ? 7 : 5);
        const px = Math.round(ax + (bx - ax) * t + side);
        const py = Math.round(ay + (by - ay) * t + (hash(i, Math.round(d), 32) - 0.5) * 3);
        if (at(px, py) !== 1) continue;
        const tall = hash(px, py, 33) > (r.kind === "rock" ? 0.45 : 0.85);
        const h = tall ? 3 : 2;
        for (let k = 0; k < h; k++) {
          for (let j = -k; j <= k; j++) {
            const lit = j < 0 || (j === 0 && k < h - 1);
            let c: Color = r.kind === "rock" ? (lit ? PAL.mtn : PAL.mtnD) : lit ? PAL.grassD : PAL.forestD;
            if (r.kind === "rock" && tall && k === 0) c = PAL.snow;
            ctx.fillStyle = c;
            ctx.fillRect(px + j, py - h + 1 + k, 1, 1);
          }
        }
      }
    }
  }

  // Roads: each hub to its three nearest neighbors, like the interstate grid.
  const hubXY = hubs.map((h) => project(h.lon, h.lat));
  const edges = new Set<string>();
  hubs.forEach((_, i) => {
    const near = hubs
      .map((_, j) => j)
      .filter((j) => j !== i)
      .sort((a, b) => milesBetween(i, a) - milesBetween(i, b))
      .slice(0, 3);
    for (const j of near) if (milesBetween(i, j) < 700) edges.add(i < j ? `${i}-${j}` : `${j}-${i}`);
  });
  for (const e of edges) {
    const [a, b] = e.split("-").map(Number) as [number, number];
    line([hubXY[a]!, hubXY[b]!], PAL.ink3);
    line([hubXY[a]!, hubXY[b]!], PAL.mtnD, 3);
  }

  // Cities: skylines sized by freight weight; windows remembered for the night.
  const lights: [number, number][] = [];
  hubs.forEach((h, i) => {
    const [hx, hy] = hubXY[i]!.map(Math.round) as [number, number];
    const size = h.weight >= 2.2 ? 3 : h.weight >= 1.2 ? 2 : 1;
    const towers = size === 3 ? 5 : size === 2 ? 3 : 2;
    for (let t = 0; t < towers; t++) {
      const tx = hx - Math.floor(towers / 2) + t;
      const height = 1 + Math.floor(hash(i, t, 11) * (size + 1)) + (t === Math.floor(towers / 2) ? size : 0);
      for (let k = 0; k < height + 1; k++) {
        const py = hy - k;
        ctx.fillStyle = k === height ? PAL.mist : t % 2 ? PAL.fog : PAL.steel;
        ctx.fillRect(tx, py, 1, 1);
        if (k > 0 && k < height && hash(tx, py, 13) > 0.45) lights.push([tx, py]);
      }
      ctx.fillStyle = PAL.ink0;
      ctx.fillRect(tx, hy + 1, 1, 1);
    }
    if (h.isStarter) {
      ctx.fillStyle = PAL.amber;
      ctx.fillRect(hx - Math.floor(towers / 2) - 1, hy + 1, towers + 2, 1);
    }
  });
  return { base: cv, hubXY, lights, glints };
}

/** Light level by in-game hour: 0 at midday, up to `max` at night. */
export function nightShade(hour: number, max = 0.55): number {
  if (hour >= 7 && hour <= 17) return 0;
  if (hour > 17 && hour < 20) return ((hour - 17) / 3) * max;
  if (hour > 4 && hour < 7) return ((7 - hour) / 3) * max;
  return max;
}
