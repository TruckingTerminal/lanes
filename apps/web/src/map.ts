import type { Equipment } from "@lanes/config";
import type { Hub, RoadNetwork } from "@lanes/data";
import { BAYER, PAL, Px, mix, type Color } from "./art.js";
import { BC_COAST, CANADA_BORDER, CANADA_EAST, GULF_ATLANTIC, LAKES, MEXICO, MEX_BORDER, PACIFIC, RANGES, RIVERS, STATE_LINES, type LL } from "./geo.js";

/**
 * The pixel map: the lower 48 in an Albers equal-area projection (the shape
 * people know from road atlases), painted once into a base layer — terrain,
 * water, rivers, state lines, mountains, roads, skylines — at one art pixel per
 * screen pixel of the map window, so the whole country fits with room for detail
 * and zooming in shows chunky, square pixels.
 */

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

export interface Projection {
  project(lon: number, lat: number): [number, number];
  unproject(x: number, y: number): LL;
  /** Art pixels per projected unit (roughly, pixels per degree at the middle). */
  scale: number;
}

/** Fits the US (with a small margin) into W × H art pixels. */
export function fitProjection(W: number, H: number): Projection {
  const projUs = US_RING.map(([lo, la]) => albers(lo, la));
  const minX = Math.min(...projUs.map((p) => p[0]));
  const maxX = Math.max(...projUs.map((p) => p[0]));
  const minY = Math.min(...projUs.map((p) => p[1]));
  const maxY = Math.max(...projUs.map((p) => p[1]));
  const margin = Math.max(6, Math.round(Math.min(W, H) * 0.03));
  const scale = Math.min((W - 2 * margin) / (maxX - minX), (H - 2 * margin) / (maxY - minY));
  const offX = (W - (maxX - minX) * scale) / 2;
  const offY = (H - (maxY - minY) * scale) / 2;
  return {
    scale,
    project(lon, lat) {
      const [x, y] = albers(lon, lat);
      return [offX + (x - minX) * scale, offY + (maxY - y) * scale];
    },
    unproject(px, py) {
      return inverseAlbers((px - offX) / scale + minX, maxY - (py - offY) / scale);
    },
  };
}

// --- Noise and helpers -----------------------------------------------------------------

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

export function hash(x: number, y: number, s = 0): number {
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

const dither = (x: number, y: number) => BAYER[(y % 4) * 4 + (x % 4)]!;

const rgbCache = new Map<string, [number, number, number]>();
function rgb(c: Color): [number, number, number] {
  let v = rgbCache.get(c);
  if (!v) rgbCache.set(c, (v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]));
  return v;
}

/** Bounding boxes of the ranges, so most pixels skip the distance test. */
const RANGE_BOX = RANGES.map((r) => {
  const lons = r.spine.map((p) => p[0]);
  const lats = r.spine.map((p) => p[1]);
  const pad = r.width * 1.3;
  return { lo0: Math.min(...lons) - pad, lo1: Math.max(...lons) + pad, la0: Math.min(...lats) - pad, la1: Math.max(...lats) + pad };
});

// --- Terrain ------------------------------------------------------------------------

/** 0 open, 1 forest, 2 desert, 3 marsh, 4 fields, 5 rock: for the texture pass. */
type Veg = 0 | 1 | 2 | 3 | 4 | 5;

function terrain(lon0: number, lat0: number, x: number, y: number, out: { veg: Veg }): Color {
  const n = valueNoise(x / 9, y / 9, 1) * 0.65 + valueNoise(x / 3, y / 3, 2) * 0.35;
  // Warp the coordinates so biome edges wander instead of following meridians.
  const lon = lon0 + (valueNoise(x / 16, y / 16, 21) - 0.5) * 2.6;
  const lat = lat0 + (valueNoise(x / 16, y / 16, 22) - 0.5) * 1.6;
  const pick = (a: Color, b: Color, share: number) => (dither(x, y) < share ? b : a);
  out.veg = 0;
  for (let i = 0; i < RANGES.length; i++) {
    const bb = RANGE_BOX[i]!;
    if (lon0 < bb.lo0 || lon0 > bb.lo1 || lat0 < bb.la0 || lat0 > bb.la1) continue;
    const r = RANGES[i]!;
    const d = distToPolyline(r.spine, lon0, lat0);
    const w = r.width * (0.7 + n * 0.5);
    if (d < w) {
      const core = 1 - d / w;
      out.veg = r.kind === "rock" ? 5 : 1;
      if (r.kind === "rock") return pick(PAL.sage, PAL.mtn, 0.25 + core * 0.5);
      return pick(PAL.forest, PAL.forestD, 0.3 + core * 0.5);
    }
  }
  const fields = (a: Color[], lines: Color) => {
    const fx = Math.floor((x + Math.floor(n * 2)) / 7);
    const fy = Math.floor(y / 5);
    const crop = a[Math.floor(hash(fx, fy, 7) * a.length)]!;
    out.veg = 4;
    return (x % 7 === 0 || y % 5 === 0) && hash(fx, fy, 9) > 0.45 ? lines : crop;
  };
  if (lon < -120.5 && lat > 42) {
    out.veg = 1;
    return pick(PAL.forest, PAL.forestD, 0.35 + n * 0.3);
  }
  if (lon > -122.6 && lon < -119.2 && lat > 35.2 && lat < 40.2) return fields([PAL.sage, PAL.sand, PAL.olive, PAL.sandD, PAL.grass], PAL.olive);
  if (lon < -116 && lat < 35.2 && lat > 32.4) return pick(PAL.sage, PAL.desert, 0.4 + n * 0.3);
  if (lat < 37 && lon < -108.5) {
    out.veg = 2;
    return pick(PAL.desert, PAL.sand, 0.3 + n * 0.5);
  }
  if (lon < -111 && lat > 37) return pick(PAL.sage, PAL.sandD, 0.25 + n * 0.5);
  if (lon < -103 && lat < 37.8) {
    out.veg = 2;
    return pick(PAL.desert, PAL.clay, 0.2 + n * 0.45);
  }
  if (lon < -100 && lat < 33) {
    out.veg = 2;
    return pick(PAL.sage, PAL.desert, n * 0.6);
  }
  if (lat < 30 && lon > -100 && lon < -97) return pick(PAL.sage, PAL.olive, 0.4 + n * 0.3);
  if (lon < -100) return pick(PAL.sage, PAL.olive, 0.2 + n * 0.5);
  if (lon < -96.5) return lat > 36 ? fields([PAL.olive, PAL.sage, PAL.sandD, PAL.grass], PAL.olive) : pick(PAL.olive, PAL.sage, 0.3 + n * 0.3);
  if (lat < 30.6 && lon > -94.5 && lon < -88) {
    out.veg = 3;
    return pick(PAL.marsh, PAL.grassD, 0.4 + n * 0.3);
  }
  if (lon > -83.2 && lat < 30.6) {
    out.veg = 3;
    return lat < 27.3 ? pick(PAL.marsh, PAL.teal, 0.3 + n * 0.3) : pick(PAL.grass, PAL.marsh, 0.2 + n * 0.3);
  }
  if (lat < 36 && lon > -96) {
    out.veg = 1;
    return pick(PAL.grassD, PAL.forest, 0.3 + n * 0.45);
  }
  if (lat > 44.6 && lon < -82) {
    out.veg = 1;
    return pick(PAL.forest, PAL.grassD, 0.3 + n * 0.4);
  }
  if (lon < -80.5 && lat >= 37.5) return fields([PAL.olive, PAL.grass, PAL.sage, PAL.grassD, PAL.sandD, PAL.grass], PAL.grassD);
  if (lat > 41) {
    out.veg = 1;
    return pick(PAL.grass, PAL.forest, 0.3 + n * 0.4);
  }
  return pick(PAL.grass, PAL.grassD, 0.25 + n * 0.4);
}

// --- The base layer -------------------------------------------------------------------

export interface MapArt {
  W: number;
  H: number;
  base: HTMLCanvasElement;
  /** Pixel position of every hub, by index. */
  hubXY: [number, number][];
  /** Size class per hub: 0 town … 3 metro. */
  cityClass: number[];
  /** Window pixels that light up at night. */
  lights: [number, number][];
  /** A few water pixels that glint. */
  glints: [number, number][];
  project(lon: number, lat: number): [number, number];
  unproject(x: number, y: number): LL;
  /** 0 sea, 1 US land, 2 foreign land, 3 lake. */
  kindAt(x: number, y: number): number;
}

export function cityClassOf(h: Hub): number {
  return h.weight >= 2.2 ? 3 : h.weight >= 1.4 ? 2 : h.weight >= 0.8 ? 1 : 0;
}

export function buildMap(hubs: Hub[], roads: RoadNetwork | undefined, W: number, H: number): MapArt {
  const proj = fitProjection(W, H);
  const { project, unproject } = proj;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;

  // 0 = sea, 1 = US land, 2 = foreign land, 3 = lake — rasterised with the canvas
  // (one colour channel per class, thresholded, so edge blending can't mislabel).
  const kind = new Uint8Array(W * H);
  {
    const mask = document.createElement("canvas");
    mask.width = W;
    mask.height = H;
    const m = mask.getContext("2d")!;
    const ring = (pts: LL[], c: string) => {
      m.fillStyle = c;
      m.beginPath();
      pts.forEach(([lo, la], i) => {
        const [x, y] = project(lo, la);
        if (i === 0) m.moveTo(x, y);
        else m.lineTo(x, y);
      });
      m.closePath();
      m.fill();
    };
    ring(NA_RING, "#00ff00");
    ring(US_RING, "#ff0000");
    for (const l of LAKES) ring(l, "#0000ff");
    const d = m.getImageData(0, 0, W, H).data;
    for (let i = 0; i < W * H; i++) {
      const r = d[i * 4]!;
      const g = d[i * 4 + 1]!;
      const b = d[i * 4 + 2]!;
      kind[i] = b > 127 ? 3 : r > 127 ? 1 : g > 127 ? 2 : 0;
    }
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : kind[y * W + x]!);
  const isWater = (k: number) => k === 0 || k === 3;
  const nearLand = (x: number, y: number, r: number) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (!isWater(at(x + i, y + j))) return true;
    return false;
  };

  const img = ctx.createImageData(W, H);
  const data = img.data;
  const put = (x: number, y: number, c: Color) => {
    const i = (y * W + x) * 4;
    const [r, g, b] = rgb(c);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  };
  const glints: [number, number][] = [];
  const veg = new Uint8Array(W * H);
  const tmp = { veg: 0 as Veg };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = at(x, y);
      if (isWater(k)) {
        let c: Color;
        if (nearLand(x, y, 1)) c = k === 3 ? PAL.seaL : PAL.foam;
        else if (nearLand(x, y, 3)) c = dither(x, y) < 0.5 ? PAL.seaL : PAL.sea;
        else if (k === 3) c = PAL.sea;
        else if (nearLand(x, y, 7)) c = dither(x, y) < 0.35 ? PAL.sea : PAL.seaD;
        else {
          c = dither(x, y) < 0.12 ? PAL.sea : PAL.seaD;
          if (hash(x, y, 3) < 0.003) glints.push([x, y]);
        }
        put(x, y, c);
      } else if (k === 2) {
        // Canada and Mexico: land, but quiet — off the board.
        put(x, y, dither(x, y) < 0.3 + valueNoise(x / 8, y / 8, 5) * 0.3 ? PAL.mtnD : PAL.ink3);
      } else {
        const [lon, lat] = unproject(x + 0.5, y + 0.5);
        put(x, y, terrain(lon, lat, x, y, tmp));
        veg[y * W + x] = tmp.veg;
      }
    }
  }
  // Coast and borders: a sandy edge where land meets water; a dark edge for the foreign shore.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = at(x, y);
      if (k === 0 || k === 3) continue;
      const touchesWater = isWater(at(x + 1, y)) || isWater(at(x - 1, y)) || isWater(at(x, y + 1)) || isWater(at(x, y - 1));
      if (touchesWater) put(x, y, k === 1 ? PAL.sandD : PAL.steel);
    }
  }
  // Trees in the woods, cactus in the desert, reeds in the marsh.
  for (let y = 2; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (at(x, y) !== 1) continue;
      const v = veg[y * W + x];
      const h = hash(x, y, 41);
      if (v === 1 && h < 0.05) {
        put(x, y - 1, PAL.grassD);
        put(x, y, PAL.forestD);
        put(x + 1, y, PAL.forestD);
        if (at(x + 1, y - 1) === 1) put(x + 1, y - 1, PAL.forest);
      } else if (v === 2 && h < 0.006) {
        put(x, y - 1, PAL.sage);
        put(x, y, PAL.olive);
      } else if (v === 3 && h < 0.03) {
        put(x, y, PAL.teal);
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  const line = (pts: [number, number][], color: Color, every = 1, onlyKind: number | null = 1, thick = false) => {
    ctx.fillStyle = color;
    for (let i = 0; i + 1 < pts.length; i++) {
      let [x0, y0] = pts[i]!.map(Math.round) as [number, number];
      const [x1, y1] = pts[i + 1]!.map(Math.round) as [number, number];
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      const steep = -dy > dx;
      let err = dx + dy;
      let step = 0;
      for (;;) {
        if (step++ % every === 0 && (onlyKind === null || at(x0, y0) === onlyKind)) {
          ctx.fillRect(x0, y0, 1, 1);
          if (thick) ctx.fillRect(steep ? x0 + 1 : x0, steep ? y0 : y0 + 1, 1, 1);
        }
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
  const toPx = (pts: LL[]) => pts.map(([lo, la]) => project(lo, la));

  // Rivers, with a light bank on the wide ones.
  for (const r of RIVERS) {
    const pts = toPx(r.line);
    if (r.wide) line(pts, PAL.foam, 1, 1, true);
    line(pts, PAL.seaL);
  }
  // State lines: a dotted dark line.
  for (const s of STATE_LINES) line(toPx(s), PAL.ink3, 2);

  // Mountains: shaded peaks along the rock ranges, rounded hills along the wooded ones.
  const peak = (px: number, py: number, h: number, rock: boolean, snowy: boolean) => {
    for (let k = 0; k < h; k++) {
      const half = Math.round((k / (h - 1)) * (h - 1) * 0.8);
      for (let j = -half; j <= half; j++) {
        const x = px + j;
        const y = py - h + 1 + k;
        if (at(x, y) !== 1) continue;
        let c: Color;
        if (rock) c = j < 0 ? PAL.mtnL : j === 0 ? PAL.mtn : PAL.mtnD;
        else c = j < 0 ? PAL.grassD : j === 0 ? PAL.forest : PAL.forestD;
        if (rock && snowy && k < 2 && Math.abs(j) <= k) c = PAL.snow;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = rock ? PAL.mtnD : PAL.forestD;
    if (at(px, py + 1) === 1) ctx.fillRect(px - 1, py + 1, 3, 1);
  };
  for (const r of RANGES) {
    const pts = toPx(r.spine);
    const spread = r.width * proj.scale * 0.55;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i]!;
      const [bx, by] = pts[i + 1]!;
      const len = Math.hypot(bx - ax, by - ay);
      const step = r.kind === "rock" ? 7 : 8;
      for (let d = 0; d < len; d += step) {
        const t = d / len;
        const nx = -(by - ay) / len;
        const ny = (bx - ax) / len;
        const off = (hash(Math.round(ax + d), i, 31) - 0.5) * 2 * spread;
        const px = Math.round(ax + (bx - ax) * t + nx * off);
        const py = Math.round(ay + (by - ay) * t + ny * off);
        if (at(px, py) !== 1) continue;
        const core = 1 - Math.abs(off) / Math.max(1, spread);
        const h = r.kind === "rock" ? 4 + Math.round(core * 3 + hash(px, py, 33) * 2) : 3 + Math.round(hash(px, py, 33) * 1.5);
        peak(px, py, h, r.kind === "rock", r.kind === "rock" && h >= 6);
      }
    }
  }

  // Roads: US highways thin and dark, interstates on top, two pixels wide with a shoulder.
  const hubXY = hubs.map((h) => project(h.lon, h.lat));
  if (roads) {
    for (const pass of [1, 0] as const) {
      for (const e of roads.edges) {
        if (e.cls !== pass) continue;
        const pts: [number, number][] = [];
        for (let k = e.g0; k < e.g0 + e.gn; k++) pts.push(project(roads.lon[k]!, roads.lat[k]!));
        if (pass === 1) line(pts, PAL.mtnD, 1, 1);
        else {
          line(pts, PAL.ink3, 1, 1, true);
          line(pts, PAL.ink1, 1, 1);
          line(pts, PAL.sandD, 5, 1);
        }
      }
    }
  } else {
    const edges = new Set<string>();
    hubs.forEach((_, i) => {
      const near = hubs
        .map((_, j) => j)
        .filter((j) => j !== i)
        .sort((a, b) => Math.hypot(hubXY[a]![0] - hubXY[i]![0], hubXY[a]![1] - hubXY[i]![1]) - Math.hypot(hubXY[b]![0] - hubXY[i]![0], hubXY[b]![1] - hubXY[i]![1]))
        .slice(0, 3);
      for (const j of near) edges.add(i < j ? `${i}-${j}` : `${j}-${i}`);
    });
    for (const e of edges) {
      const [a, b] = e.split("-").map(Number) as [number, number];
      line([hubXY[a]!, hubXY[b]!], PAL.ink1, 1, 1, true);
    }
  }

  // Cities: skylines sized by freight weight, towers tallest in the middle; windows remembered for the night.
  const lights: [number, number][] = [];
  const cityClass = hubs.map(cityClassOf);
  hubs.forEach((h, i) => {
    const [hx, hy] = hubXY[i]!.map(Math.round) as [number, number];
    const cls = cityClass[i]!;
    const width = [5, 7, 9, 13][cls]!;
    const maxH = [3, 5, 8, 11][cls]!;
    const left = hx - Math.floor(width / 2);
    // Ground: a dark footing one pixel below the base line.
    ctx.fillStyle = PAL.ink0;
    ctx.fillRect(left - 1, hy + 1, width + 2, 1);
    for (let t = 0; t < width; t++) {
      const tx = left + t;
      const center = 1 - Math.abs(t - (width - 1) / 2) / ((width - 1) / 2);
      const height = 1 + Math.floor(hash(i, t, 11) * maxH * (0.35 + 0.65 * center)) + (cls >= 2 && center > 0.75 ? 2 : 0);
      for (let k = 0; k <= height; k++) {
        const py = hy - k;
        let c: Color = k === height ? PAL.mist : t % 2 ? PAL.fog : PAL.steel;
        if (k > 0 && k < height && hash(tx, py, 13) > 0.5) {
          c = PAL.ink3;
          lights.push([tx, py]);
        }
        ctx.fillStyle = c;
        ctx.fillRect(tx, py, 1, 1);
      }
      if (cls === 0 && t === width - 1) {
        // A water tower at the edge of town.
        ctx.fillStyle = PAL.paper;
        ctx.fillRect(tx, hy - 3, 1, 2);
        ctx.fillStyle = PAL.steel;
        ctx.fillRect(tx, hy - 1, 1, 2);
      }
    }
    if (h.isStarter) {
      ctx.fillStyle = PAL.amber;
      ctx.fillRect(left - 1, hy + 2, width + 2, 1);
    }
  });
  return { W, H, base: cv, hubXY, cityClass, lights, glints, project, unproject, kindAt: at };
}

// --- Day and night -----------------------------------------------------------------

/** Darkness by in-game hour: 0 at midday, up to `max` deep at night. */
export function nightShade(hour: number, max = 0.55): number {
  if (hour >= 7 && hour <= 17) return 0;
  if (hour > 17 && hour < 20) return ((hour - 17) / 3) * max;
  if (hour > 4 && hour < 7) return ((7 - hour) / 3) * max;
  return max;
}

/** The tint laid over the map: sodium amber at dusk and dawn, deep blue at night. */
export function nightColor(hour: number): Color {
  const dusk = hour > 16.5 && hour < 20.5 ? 1 - Math.abs(hour - 18.5) / 2 : hour > 4.5 && hour < 8 ? 1 - Math.abs(hour - 6.25) / 1.75 : 0;
  return mix(PAL.ink0, PAL.amberD, Math.max(0, dusk) * 0.6);
}

// --- Map markers: trucks seen from above --------------------------------------------------

export type MarkerKind = "mine" | "other" | "ai";
/** Headings, clockwise from east: E, SE, S, SW, W, NW, N, NE. */
export const DIRS = 8;

export function headingDir(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  const s = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return ((s % DIRS) + DIRS) % DIRS;
}

const markerCache = new Map<string, HTMLCanvasElement[]>();

function truckTop(kind: MarkerKind, trailer: Equipment): Px {
  const cab = kind === "mine" ? [PAL.cyan, PAL.teal] : kind === "other" ? [PAL.lime, PAL.olive] : [PAL.fog, PAL.steel];
  if (kind === "ai") {
    const p = new Px(10, 3);
    const roof = trailer === "flatbed" ? PAL.sandD : PAL.mist;
    p.rect(0, 0, 7, 3, roof).hline(0, 1, 7, trailer === "flatbed" ? PAL.mtnD : PAL.paper);
    if (trailer === "reefer") p.vline(6, 0, 3, PAL.cyan);
    p.rect(8, 0, 2, 3, cab[1]!).set(8, 1, cab[0]!);
    return p;
  }
  const p = new Px(14, 5);
  if (trailer === "flatbed") {
    p.rect(0, 0, 10, 5, PAL.sandD).rect(1, 1, 8, 3, PAL.mtnD).rect(2, 1, 3, 3, PAL.olive).rect(6, 1, 3, 3, PAL.mtnL);
  } else {
    p.rect(0, 0, 10, 5, PAL.mist).rect(1, 1, 8, 3, PAL.white).hline(1, 2, 8, PAL.paper);
    if (trailer === "reefer") p.vline(9, 0, 5, PAL.cyan).vline(8, 1, 3, PAL.teal);
  }
  p.rect(11, 0, 3, 5, cab[1]!).rect(11, 1, 2, 3, cab[0]!).vline(13, 1, 3, PAL.ink2).set(12, 2, PAL.white);
  return p;
}

/** The eight headings of a truck marker at `u` canvas pixels per art pixel. */
export function truckMarkers(kind: MarkerKind, trailer: Equipment, u: number): HTMLCanvasElement[] {
  const key = `${kind}|${trailer}|${u}`;
  let list = markerCache.get(key);
  if (list) return list;
  const top = truckTop(kind, trailer);
  const e = new Px(top.w + 2, top.h + 2).blit(top, 1, 1);
  const s = e.rot90();
  const w = s.rot90();
  const n = w.rot90();
  const se = e.rot45();
  const sw = se.rot90();
  const nw = sw.rot90();
  const ne = nw.rot90();
  list = [e, se, s, sw, w, nw, n, ne].map((p) => p.outline(PAL.ink0).canvas(u));
  markerCache.set(key, list);
  return list;
}
