import type { Equipment } from "@lanes/config";
import { hubMiles, hubRoute, type Truck } from "@lanes/engine";
import { icon, PAL } from "./art.js";
import { drawText, textWidth } from "./font.js";
import { isHuman } from "./game.js";
import { buildMap, hash, headingDir, nightColor, nightShade, truckMarkers, type MapArt, type MarkerKind } from "./map.js";
import { TRUCK_SCALE, truckFrame } from "./assets.js";
import { CITY_SCALE, citySprite, drawRain, drawSnow, hasPaintedMap, MAP_H, MAP_W, mapLevel, mapSurround, seasonOf, spriteFrame, TOWN_SCALE, townKindAt, townSprite, vfxSprite, type Season } from "./mapart.js";
import { weatherAt, weatherLabel, type Weather } from "./weather.js";
import { bumpData, clockMin, myTrucks, S, selectTruck, setTab } from "./state.js";
import { hasTwo } from "./companies.js";
import { rankStarters } from "./hubcard.js";
import { openLoadsAt, reloadLabel, seasonSwing } from "./logic.js";
import { signedPct, TRAILER_NAME } from "./format.js";

/**
 * The map window: the pixel base layer sized to the window, zoom and pan in device
 * pixels, trucks and labels drawn every frame, and the pointer handling. Imperative
 * on purpose: it draws to a canvas the MapView component owns.
 */

let art: MapArt | null = null;
let cv: HTMLCanvasElement | null = null;
let wrap: HTMLElement | null = null;
let tip: HTMLElement | null = null;

/**
 * The zoom levels are device pixels per level-0 art pixel: the fit (whatever fills the window, drawn
 * smoothed) and then the whole numbers above it, where the painted levels draw pixel for pixel.
 */
const STEPS = [1, 2, 3, 4, 6, 8];
function levels(): number[] {
  const f = fitK();
  const L = [f];
  for (const n of STEPS) if (n > f * 1.08) L.push(n);
  return L;
}
/** Device pixels per map pixel at 1×: the whole part of the device pixel ratio, so a map pixel is one CSS pixel. */
let sDev = 1;
/** The nearest level to where the zoom is heading: what the labels, markers and hit radii size by. */
let zoomIdx = 0;
/** The zoom in motion: `zf` is what is drawn, `zt` where it is heading; eased every frame, and the levels are where it settles. */
let zf = 1;
let zt = 1;
/** Where a wheel or pinch gesture started, so a short flick still moves one level. */
let gestureFrom = 1;
/** The map point (world x, y) held under canvas point (x, y) while the zoom moves. */
let anchor: [number, number, number, number] | null = null;
/** Pan inertia after a drag, in canvas pixels per millisecond. */
let vel: [number, number] = [0, 0];
let dragging = false;
let lastFrame = 0;
let snapTimer = 0;
let panX = 0;
let panY = 0;
let buildTimer = 0;
/** The zoom relative to the fit: 1 with the whole country in view. */
export const zoom = (): number => levels()[zoomIdx]! / fitK();
export const zoomIndex = (): number => zoomIdx;
/** What the zoom readout shows: Fit, or the whole-number scale the map rests at. */
export const zoomLabel = (): string => (zoomIdx === 0 ? "Fit" : `${levels()[zoomIdx]}×`);
export const maxZoom = (): boolean => zoomIdx === levels().length - 1;
/**
 * Device pixels per art pixel at the fit: the whole map in the window, except in a portrait window (a phone), where
 * the country at full width is a thin band; there the map fills at least the room above the half sheet, and pans.
 */
const fitK = () => {
  if (!cv || !art) return 1;
  const contain = Math.min(cv.width / art.W, cv.height / art.H);
  // Before a company (S1) the whole country fits, so every ringed city is in view (QA: cut at Kansas City on a phone).
  // On a phone, a margin, so a coast city's label isn't cut at the screen's edge (Seattle, Los Angeles).
  if (cv.height > cv.width) return S.game?.player ? Math.max(contain, (0.5 * cv.height) / art.H) : 0.9 * contain;
  return contain;
};
/** Device pixels at the canvas's foot hidden by the phone's sheet: centring and panning keep the map above them. */
let insetB = 0;
export function setMapInset(cssPx: number): void {
  insetB = Math.round(cssPx * (window.devicePixelRatio || 1));
  clampPan();
}
const viewH = (): number => Math.max(1, (cv?.height ?? 1) - insetB);
const kScale = () => zf;
const nearestLevel = (z: number): number => {
  const L = levels();
  let best = 0;
  for (let i = 1; i < L.length; i++) if (Math.abs(Math.log(L[i]! / z)) < Math.abs(Math.log(L[best]! / z))) best = i;
  return best;
};

/** Last heading per truck, so a parked truck keeps facing the way it arrived. */
const headings = new Map<number, number>();
const DIR_VEC: [number, number][] = [[1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071]];
/** Tallest tower of each city class, in art pixels, for placing pins and labels above the skyline. */
const CITY_TOP = [4, 6, 10, 13];
/** Dot colour by equipment for the other carriers' trucks: white van, blue reefer, amber flatbed. */
const EQUIP_DOT: Record<Equipment, string> = { van: PAL.white, reefer: PAL.blueL, flatbed: PAL.amber };
const diamonds = new Map<string, HTMLCanvasElement>();
/** The reefer's mark: a blue diamond `r` device pixels from centre to tip, outlined in ink (inside a lime one for a player). */
function reeferDiamond(r: number, edge: number, player: boolean): HTMLCanvasElement {
  const key = `${r}|${edge}|${player}`;
  let cv = diamonds.get(key);
  if (cv) return cv;
  cv = document.createElement("canvas");
  cv.width = cv.height = 2 * r + 1;
  const g = cv.getContext("2d")!;
  const fill = (rr: number, c: string) => {
    g.fillStyle = c;
    for (let dy = -rr; dy <= rr; dy++) g.fillRect(r - (rr - Math.abs(dy)), r + dy, 2 * (rr - Math.abs(dy)) + 1, 1);
  };
  fill(r, PAL.ink0);
  if (player) fill(r - edge, PAL.lime);
  fill(r - (player ? 2 : 1) * edge, EQUIP_DOT.reefer);
  diamonds.set(key, cv);
  return cv;
}

export function resetArt(): void {
  art = null;
  headings.clear();
}

function buildArt(W: number, H: number, devW: number, devH: number): void {
  const g = S.game;
  if (!g || !cv) return;
  const old = art;
  const center = old ? toWorld(cv.width / 2, cv.height / 2) : null;
  const t0 = performance.now();
  art = buildMap(g.w.net.hubs, g.w.net.roads, W, H, g.w.net.places);
  headings.clear();
  console.info(`map ${W}×${H} painted in ${Math.round(performance.now() - t0)} ms`);
  cv.width = devW;
  cv.height = devH;
  const f = fitK();
  if (zoomIdx === 0 || zf < f) {
    zoomIdx = 0;
    zf = zt = f;
    anchor = null;
  }
  if (center && old) centerOn((center[0] / old.W) * W, (center[1] / old.H) * H);
  else clampPan();
}

/**
 * Sizes the canvas to the map window in device pixels and (re)builds the base to match: the painted
 * map keeps its own size and the fit level scales it to the window; the code-drawn fallback is
 * built at the window size, one art pixel per device pixel.
 */
export function fitMap(): void {
  if (!S.game || !wrap || !cv) return;
  const cssW = wrap.clientWidth;
  const cssH = wrap.clientHeight;
  if (cssW < 40 || cssH < 40) return;
  const dpr = window.devicePixelRatio || 1;
  sDev = Math.max(1, Math.floor(dpr));
  const devW = Math.floor(cssW * dpr);
  const devH = Math.floor(cssH * dpr);
  const painted = hasPaintedMap();
  const W = painted ? MAP_W : Math.min(1600, Math.max(320, Math.floor(devW / sDev)));
  const H = painted ? MAP_H : Math.min(1000, Math.max(200, Math.floor(devH / sDev)));
  if (!art) buildArt(W, H, devW, devH);
  else if (art.W !== W || art.H !== H) {
    clearTimeout(buildTimer);
    buildTimer = window.setTimeout(() => buildArt(W, H, devW, devH), 200);
  } else if (cv.width !== devW || cv.height !== devH) {
    const center = toWorld(cv.width / 2, cv.height / 2);
    cv.width = devW;
    cv.height = devH;
    if (zoomIdx === 0) {
      zf = zt = fitK();
      anchor = null;
    }
    centerOn(center[0], center[1]);
  }
  bumpData();
}

function toScreen(x: number, y: number): [number, number] {
  const k = kScale();
  return [Math.round(x * k - panX), Math.round(y * k - panY)];
}
function toWorld(cx: number, cy: number): [number, number] {
  const k = kScale();
  return [(cx + panX) / k, (cy + panY) / k];
}
/** Whether the map is larger than the window in either direction, so there is somewhere to pan. */
function canPan(): boolean {
  if (!cv || !art) return false;
  const k = kScale();
  return art.W * k > cv.width + 1 || art.H * k > cv.height + 1;
}
const shades = new WeakMap<HTMLImageElement, string>();
/** The painting's deep-sea colour at its corner, darkened: what the window shows around the map. */
function edgeShade(img: HTMLImageElement): string {
  let s = shades.get(img);
  if (!s) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    // The sea itself, as painted: the darkest of a few points along the painting's foot (the Gulf and the Pacific). Its
    // top corner is land (snow in winter) and its outer margin a pale slate, which both read as a grey band (Jeff).
    let best = [0, 0, 0, Infinity];
    for (const fx of [0.35, 0.45, 0.5, 0.55, 0.6]) {
      g.drawImage(img, Math.floor(img.width * fx), img.height - 3, 1, 1, 0, 0, 1, 1);
      const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
      const lum = r! + gg! + b!;
      if (lum < best[3]!) best = [r!, gg!, b!, lum];
    }
    s = `rgb(${best[0]},${best[1]},${best[2]})`;
    shades.set(img, s);
  }
  return s;
}
/** Keeps the map on the canvas: panned within its edges when larger than the window, centred when smaller. */
function clampPan(): void {
  if (!cv) return;
  const k = kScale();
  const mw = (art?.W ?? 0) * k;
  const mh = (art?.H ?? 0) * k;
  const vh = viewH();
  panX = mw <= cv.width ? -Math.round((cv.width - mw) / 2) : Math.round(Math.max(0, Math.min(mw - cv.width, panX)));
  panY = mh <= vh ? -Math.round((vh - mh) / 2) : Math.round(Math.max(0, Math.min(mh - vh, panY)));
}
export function centerOn(wx: number, wy: number): void {
  if (!cv) return;
  anchor = null;
  vel = [0, 0];
  panX = wx * kScale() - cv.width / 2;
  panY = wy * kScale() - viewH() / 2;
  clampPan();
}

/**
 * The arrival (specs/first-ten-minutes.md, S1): the view flies from where it is to a hub, at a zoom where the hub, its
 * roads and your truck read, in 1.5 s (at once under reduced motion). Asked for before the map is painted, it waits.
 */
let fly: { hub: number; t0: number; z0: number; c0: [number, number] } | null = null;
let flyPending: number | null = null;
const FLY_MS = 1500;
let flyInstant = false;
export function flyTo(hub: number, instant = false): void {
  flyPending = hub;
  flyInstant = instant;
}
function startFly(now: number): void {
  if (flyPending === null || !cv || !art) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  fly = { hub: flyPending, t0: reduced || flyInstant ? now - FLY_MS : now, z0: zf, c0: toWorld(cv.width / 2, viewH() / 2) };
  flyPending = null;
  anchor = null;
  vel = [0, 0];
}
/** The fly's end: about two CSS pixels per art pixel, the level nearest that. */
const flyZoom = (): number => levels()[nearestLevel(2 * sDev)]!;
function stepFly(now: number): void {
  if (!fly || !cv || !art) return;
  const p = Math.min(1, (now - fly.t0) / FLY_MS);
  const e = p * p * (3 - 2 * p);
  const z1 = flyZoom();
  const [hx, hy] = art.hubXY[fly.hub]!;
  zf = zt = Math.exp(Math.log(fly.z0) + (Math.log(z1) - Math.log(fly.z0)) * e);
  const cx = fly.c0[0] + (hx - fly.c0[0]) * e;
  const cy = fly.c0[1] + (hy - fly.c0[1]) * e;
  panX = cx * zf - cv.width / 2;
  panY = cy * zf - viewH() / 2;
  clampPan();
  if (p >= 1) {
    zoomIdx = nearestLevel(z1);
    fly = null;
    bumpData();
  }
}
/** The truck the map follows (S6): the selected one if it's on the road, else your first truck on the road. */
export function followed(): Truck | undefined {
  const moving = myTrucks().filter((t) => isMoving(t));
  return moving.find((t) => t.id === S.selTruck) ?? moving[0];
}
/** Eases the view toward the followed truck, at the zoom the player chose, while following is on. */
function followTruck(): void {
  if (!S.following || dragging || !cv) return;
  const t = followed();
  const p = t ? truckPoint(t) : null;
  if (!p) return;
  const k = kScale();
  const tx = p[0] * k - cv.width / 2;
  const ty = p[1] * k - viewH() / 2;
  panX += (tx - panX) * 0.15;
  panY += (ty - panY) * 0.15;
  clampPan();
}

/** Whether the map has its painting up (or has given up waiting for it): until then the map shows the hub's picture. */
let mountedAt = 0;
export const mapPainted = (): boolean => !!art && (hasPaintedMap() || performance.now() - mountedAt > 4000);
/** Heads for a zoom level, keeping the map point under canvas pixel (ax, ay) where it is; the frame loop eases the view there. */
export function setZoom(idx: number, ax?: number, ay?: number): void {
  const L = levels();
  const next = Math.max(0, Math.min(L.length - 1, idx));
  if (next === zoomIdx && zt === L[next]) return;
  zoomTo(L[next]!, ax, ay);
}
/** Heads for any zoom factor between the first and last level (wheel and pinch move freely; `snapZoom` settles them). */
function zoomTo(target: number, ax?: number, ay?: number): void {
  if (!cv) return;
  const L = levels();
  zt = Math.max(L[0]!, Math.min(L[L.length - 1]!, target));
  zoomIdx = nearestLevel(zt);
  const x = ax ?? cv.width / 2;
  const y = ay ?? cv.height / 2;
  const [wx, wy] = toWorld(x, y);
  anchor = [wx, wy, x, y];
  vel = [0, 0];
  if (tip) tip.hidden = true;
  cv.style.cursor = canPan() ? "grab" : "crosshair";
  bumpData();
}
/** Settles a free zoom on a level, so the map rests at a whole-number scale: the nearest one, or the next one along for a short flick. */
function snapZoom(): void {
  const L = levels();
  let idx = nearestLevel(zt);
  const moved = Math.log(zt / gestureFrom);
  if (L[idx] === gestureFrom && Math.abs(moved) > 0.1) idx = Math.max(0, Math.min(L.length - 1, idx + Math.sign(moved)));
  gestureFrom = L[idx]!;
  zoomTo(L[idx]!, anchor?.[2], anchor?.[3]);
}
/** A wheel or pinch step: remembers where the gesture started the first time, then moves the target. */
function freeZoom(target: number, x: number, y: number): void {
  if (!snapTimer) gestureFrom = zt;
  zoomTo(target, x, y);
}
/** Moves the zoom and the pan toward where they are heading; called once per frame before drawing. */
function stepView(now: number): void {
  const dt = Math.min(50, lastFrame ? now - lastFrame : 16);
  lastFrame = now;
  if (zf !== zt) {
    zf = Math.abs(zt - zf) < 0.003 * zt ? zt : zf + (zt - zf) * (1 - Math.exp(-dt / 70));
    if (anchor) {
      const k = kScale();
      panX = anchor[0] * k - anchor[2];
      panY = anchor[1] * k - anchor[3];
    }
    clampPan();
    if (zf === zt) anchor = null;
  }
  if (!dragging && (vel[0] !== 0 || vel[1] !== 0)) {
    panX += vel[0] * dt;
    panY += vel[1] * dt;
    const d = Math.exp(-dt / 240);
    vel = [vel[0] * d, vel[1] * d];
    if (Math.hypot(vel[0], vel[1]) < 0.02) vel = [0, 0];
    clampPan();
  }
}
/** Centres the view on one of the player's trucks when zoomed in. */
export function focusTruck(t: Truck): void {
  const p = zoomIdx > 0 ? truckPoint(t) : null;
  if (p) centerOn(p[0], p[1]);
}

// --- Trucks on the map ----------------------------------------------------------------

function truckXY(t: Truck): [number, number] | null {
  const w = S.game!.w;
  const xy = art!.hubXY;
  if (t.status === "retired" || t.status === "listed" || t.companyId === 0) return null;
  const a = xy[t.hub]!;
  const moving = t.status === "toPickup" || t.status === "loaded" || t.status === "repositioning";
  if (!moving || t.targetHub === t.hub) return t.status === "unloading" ? xy[t.targetHub]! : a;
  const b = xy[t.targetHub]!;
  const route = hubRoute(w, t.hub, t.targetHub);
  const total = t.legMiles > 0 ? t.legMiles : route ? route.miles : hubMiles(w, t.hub, t.targetHub);
  const { hos } = w.cfg;
  const rolling = t.dwellMin <= 0 && t.breakdownMin <= 0 && t.shiftDrivenMin < hos.drivingHoursPerDay * 60;
  const pace = route && route.hours > 0 ? route.miles / route.hours : hos.avgMph;
  const ahead = rolling ? (Math.min(60, clockMin() - w.t) / 60) * pace : 0;
  const left = Math.max(0, t.remainingMi - ahead);
  if (route) {
    const from = w.net.hubs[t.hub]!;
    const to = w.net.hubs[t.targetHub]!;
    const at = (mi: number): [number, number] => {
      const [lat, lon] = w.net.roads.pointAlong(route, mi, from, to);
      return art!.project(lon, lat);
    };
    const done = total - left;
    const p = at(done);
    const q = done + 12 < total ? at(done + 12) : at(Math.max(0, done - 12));
    const sign = done + 12 < total ? 1 : -1;
    if (q[0] !== p[0] || q[1] !== p[1]) headings.set(t.id, headingDir((q[0] - p[0]) * sign, (q[1] - p[1]) * sign));
    return p;
  }
  headings.set(t.id, headingDir(b[0] - a[0], b[1] - a[1]));
  const k = total > 0 ? Math.max(0, Math.min(1, 1 - left / total)) : 1;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}
const isMoving = (t: Truck) => (t.status === "toPickup" || t.status === "loaded" || t.status === "repositioning") && t.targetHub !== t.hub;

function truckPoint(t: Truck): [number, number] | null {
  const p = truckXY(t);
  if (!p || isMoving(t)) return p;
  const i = t.id % 64;
  // Your own trucks stay at their hub: the crowd's scatter (up to ~26 map pixels) put a Columbus truck near Cincinnati at 4×.
  const r = t.companyId === (S.game?.carrier ?? S.game?.player)?.id ? 3 : 5 + 2.6 * Math.sqrt(i);
  const a = i * 2.39996;
  return [p[0] + Math.cos(a) * r, p[1] + 3 + Math.abs(Math.sin(a)) * r * 0.7];
}

/** A road route between two hubs as map points (the board's lanes, S3–S4). */
function routePoints(a: number, b: number): [number, number][] | null {
  const w = S.game!.w;
  if (a === b) return null;
  const route = hubRoute(w, a, b);
  if (!route) return null;
  const roads = w.net.roads;
  const pts: [number, number][] = [art!.hubXY[a]!];
  for (const signed of route.edges) {
    const e = roads.edges[signed >= 0 ? signed : -signed - 1]!;
    for (let n = 0; n < e.gn; n++) {
      const k = signed >= 0 ? e.g0 + n : e.g0 + e.gn - 1 - n;
      pts.push(art!.project(roads.lon[k]!, roads.lat[k]!));
    }
  }
  pts.push(art!.hubXY[b]!);
  return pts;
}

function routeAhead(t: Truck): [number, number][] | null {
  const w = S.game!.w;
  const route = hubRoute(w, t.hub, t.targetHub);
  const p = truckXY(t);
  if (!route || !p) return null;
  const roads = w.net.roads;
  const total = t.legMiles > 0 ? t.legMiles : route.miles;
  const done = Math.max(0, Math.min(total, total - t.remainingMi));
  const pts: [number, number][] = [p];
  let lo = 0;
  while (lo + 1 < route.edges.length && route.cum[lo + 1]! <= done) lo++;
  for (let i = lo; i < route.edges.length; i++) {
    const signed = route.edges[i]!;
    const ei = signed >= 0 ? signed : -signed - 1;
    const fwd = signed >= 0;
    const e = roads.edges[ei]!;
    const within = fwd ? done - route.cum[i]! : e.miles - (done - route.cum[i]!);
    for (let n = 0; n < e.gn; n++) {
      const k = fwd ? e.g0 + n : e.g0 + e.gn - 1 - n;
      if (i === lo) {
        const along = roads.along[k]!;
        if (fwd ? along < within : along > within) continue;
      }
      pts.push(art!.project(roads.lon[k]!, roads.lat[k]!));
    }
  }
  pts.push(art!.hubXY[t.targetHub]!);
  return pts;
}

export function drawMap(now: number): void {
  // A canvas briefly zero-sized (a layout change mid-resize) can't be drawn on or drawn from (QA's console, 2026-11-02).
  if (!cv || !art || !S.game || !cv.width || !cv.height) return;
  if (S.layout === "panel") return;
  startFly(now);
  if (fly) stepFly(now);
  else {
    stepView(now);
    followTruck();
  }
  let ctx = cv.getContext("2d")!;
  const w = S.game.w;
  const W = cv.width;
  const H = cv.height;
  const f = fitK();
  // Device pixels per level-0 art pixel: the zoom is already absolute (the fit is its first level).
  const k = zf;
  const u = Math.max(1, Math.round(f * Math.min(zoom(), 4)));
  const visible = (X: number, Y: number) => X > -40 * u && Y > -40 * u && X < W + 40 * u && Y < H + 40 * u;
  ctx.imageSmoothingEnabled = false;
  // The painted level for this zoom, pixel for pixel at a whole-number scale and smoothed while the
  // zoom is moving or at the fit; the code-drawn base until it has decoded. Around it, where the
  // map does not reach the window's edge, the painting's own deep sea, darkened.
  const season = seasonOf(Math.min(11, Math.floor((Math.floor(clockMin() / 1440) % 365) / 30)) + 1);
  const lvl = mapLevel(season, k);
  ctx.fillStyle = lvl ? edgeShade(lvl.img) : PAL.seaD;
  ctx.fillRect(0, 0, W, H);
  // The world past the map's edge (Graphics' surround, per season), wherever the map doesn't reach the window's edge;
  // the painting's last 48 px fade into it (tools/map-surround.py), so it's under them too, even at the panning limits.
  const sur = mapSurround(season);
  const fade = 48 * k;
  if (sur && (panX < fade || panY < fade || art.W * k - panX < W + fade || art.H * k - panY < H + fade)) {
    ctx.imageSmoothingEnabled = !Number.isInteger(k);
    ctx.setTransform(k, 0, 0, k, -panX, -panY);
    ctx.drawImage(sur, -(sur.width - MAP_W) / 2, -(sur.height - MAP_H) / 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  if (lvl) {
    const s = k / lvl.scale;
    ctx.imageSmoothingEnabled = !Number.isInteger(s);
    ctx.imageSmoothingQuality = "high";
    ctx.setTransform(s, 0, 0, s, -panX, -panY);
    ctx.drawImage(lvl.img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (lvl.season !== season) washSeason(ctx, season, W, H);
    // The towns as generic sprites by region (the bigger ones first as the zoom comes in), then the hub cities as their own,
    // on their own layer so a season can tint them to match the painting beneath.
    const sprites = k >= 4 ? spriteLayer(W, H) : null;
    const base = ctx;
    if (sprites) ctx = sprites.getContext("2d")!;
    if (k >= 4) {
      const ts = k / TOWN_SCALE;
      const minPop = k >= 8 ? 10_000 : k >= 6 ? 30_000 : 80_000;
      ctx.imageSmoothingEnabled = !Number.isInteger(ts);
      for (const p of w.net.places) {
        if (p.pop < minPop) continue;
        const [px, py] = art!.project(p.lon, p.lat);
        const [X, Y] = toScreen(px, py);
        if (X < -80 * ts || Y < -80 * ts || X > W + 80 * ts || Y > H + 80 * ts) continue;
        // The hub's own sprite stands for its metro: no town sprites under it.
        if (art!.hubXY.some(([hx, hy]) => Math.abs(hx - px) < 34 && Math.abs(hy - py) < 30)) continue;
        const rx = Math.round(px);
        const ry = Math.round(py);
        const nearWater = [-4, 0, 4].some((dx) => [-4, 0, 4].some((dy) => art!.kindAt(rx + dx, ry + dy) === 0 || art!.kindAt(rx + dx, ry + dy) === 3));
        const img = townSprite(townKindAt(p.lon, p.lat, nearWater));
        if (!img) continue;
        const tw = img.width * ts;
        const th = img.height * ts;
        ctx.drawImage(img, Math.round(X - tw / 2), Math.round(Y - th * 0.6), Math.round(tw), Math.round(th));
      }
      ctx.imageSmoothingEnabled = false;
    }
    // Level 1 already paints each city with its landmarks; the sprites take over from 4×, where its pixels would double.
    if (sprites && k >= CITY_SCALE) {
      const cs = k / CITY_SCALE;
      ctx.imageSmoothingEnabled = !Number.isInteger(cs);
      w.net.hubs.forEach((h, i) => {
        const sp = citySprite(h.id);
        if (!sp) return;
        const [X, Y] = toScreen(...art!.hubXY[i]!);
        const cw = sp.fw * cs;
        const ch = sp.fh * cs;
        if (X + cw / 2 < 0 || Y + ch / 2 < 0 || X - cw / 2 > W || Y - ch / 2 > H) return;
        const [sx, sy] = spriteFrame(sp, now, i * 3);
        ctx.drawImage(sp.img, sx, sy, sp.fw, sp.fh, Math.round(X - cw / 2), Math.round(Y - ch * 0.6), Math.round(cw), Math.round(ch));
      });
      ctx.imageSmoothingEnabled = false;
    }
    if (sprites) {
      if (season !== "summer") tintSprites(ctx, season, W, H);
      ctx = base;
      ctx.drawImage(sprites, 0, 0);
    }
  } else {
    ctx.setTransform(k, 0, 0, k, -panX, -panY);
    ctx.drawImage(art.base, 0, 0);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PAL.foam;
  // The code-drawn base's glints and window lights belong to its own skylines; the painting has its own.
  for (let i = 0; i < (lvl ? 0 : art.glints.length); i++) {
    if ((Math.floor(now / 450) + i * 7) % 11 === 0) {
      const [X, Y] = toScreen(...art.glints[i]!);
      if (visible(X, Y)) ctx.fillRect(X, Y, 2 * u, u);
    }
  }
  const hour = (clockMin() / 60) % 24;
  const shade = nightShade(hour, 0.42);
  // The player's own: the carrier's trucks and sites, whichever company is in view (brokerage-ux.md section 1).
  const mine = S.game.carrier?.id ?? S.game.player?.id ?? -1;
  const humans = new Set(w.companies.filter(isHuman).map((c) => c.id));
  if (S.selHub !== null) {
    const [X, Y] = toScreen(...art.hubXY[S.selHub]!);
    const pin = icon("pin", u);
    const bob = (Math.floor(now / 400) % 2) * u;
    ctx.drawImage(pin, X - 6 * u, Math.round(Y - CITY_TOP[art.cityClass[S.selHub]!]! * k - 12 * u - bob));
  }
  // Truck-stop sites on the interstates (0.18.0) from 2×: an open rest area is a blue-grey cross, a
  // truck stop the fuel pump (yours underlined in lime); the selected site is ringed. Sites not yet for
  // sale aren't drawn.
  if (zoom() >= 2 && w.cfg.businesses.enabled) {
    const pump = icon("fuel", u);
    for (const s of w.sites) {
      const b = s.businessId ? w.businesses[s.businessId - 1] : undefined;
      const built = b !== undefined && b.ownerId > 0;
      if (!built && !s.open && s.id !== S.selSite) continue;
      const [X, Y] = toScreen(...art.project(s.lon, s.lat));
      if (!visible(X, Y)) continue;
      if (built) {
        ctx.drawImage(pump, Math.round(X - pump.width / 2), Math.round(Y - pump.height / 2));
        if (b!.ownerId === mine) {
          ctx.fillStyle = PAL.lime;
          ctx.fillRect(Math.round(X - pump.width / 2), Math.round(Y + pump.height / 2), pump.width, u);
        }
      } else {
        ctx.fillStyle = PAL.ink0;
        ctx.fillRect(X - 3 * u, Y - u, 7 * u, 3 * u);
        ctx.fillRect(X - u, Y - 3 * u, 3 * u, 7 * u);
        ctx.fillStyle = PAL.foam;
        ctx.fillRect(X - 2 * u, Y, 5 * u, u);
        ctx.fillRect(X, Y - 2 * u, u, 5 * u);
      }
      if (s.id === S.selSite) {
        const r = 7 * u;
        ctx.fillStyle = PAL.white;
        ctx.fillRect(X - r, Y - r, 2 * r, u);
        ctx.fillRect(X - r, Y + r - u, 2 * r, u);
        ctx.fillRect(X - r, Y - r, u, 2 * r);
        ctx.fillRect(X + r - u, Y - r, u, 2 * r);
      }
    }
  }
  // The weather under every truck: a hint over the roads, never a blanket over what moves on them.
  drawWeather(ctx, now, k, u);
  const myMarks: [number, number][] = [];
  // Other carriers are dots: colour says the equipment, a lime ring says a player. Zoomed out, a dot is
  // never under about 3.5 screen pixels with a one-pixel dark outline, so a busy interstate reads as a
  // string of trucks (Jeff, 2026-11-02).
  const dpr = window.devicePixelRatio || 1;
  const edge = Math.max(1, Math.round(dpr));
  const minDot = Math.max(4 * u, Math.round(3.5 * dpr) + 2 * edge);
  const dot = (t: Truck, player: boolean) => {
    const p = truckPoint(t);
    if (!p) return;
    const [X, Y] = toScreen(p[0], p[1]);
    if (!visible(X, Y)) return;
    // The trailer reads by shape as well as colour (the director's gate: colour alone at 3–4 px): a van a solid square,
    // a reefer a diamond, a flatbed a low wide bar. (A hollow square for the reefer read as a dark dot: QA, 2026-11-03.)
    const outer = player ? minDot + 2 * edge : minDot;
    if (t.trailer === "reefer") {
      const r = Math.round(outer * 0.62);
      ctx.drawImage(reeferDiamond(r, edge, player), Math.round(X) - r, Math.round(Y) - r);
      return;
    }
    const ow = t.trailer === "flatbed" ? Math.round(outer * 1.6) : outer;
    const oh = t.trailer === "flatbed" ? Math.max(3 * edge, Math.round(outer * 0.6)) : outer;
    const x0 = X - Math.floor(ow / 2);
    const y0 = Y - Math.floor(oh / 2);
    ctx.fillStyle = PAL.ink0;
    ctx.fillRect(x0, y0, ow, oh);
    let e = edge;
    if (player) {
      ctx.fillStyle = PAL.lime;
      ctx.fillRect(x0 + edge, y0 + edge, ow - 2 * edge, oh - 2 * edge);
      e = 2 * edge;
    }
    ctx.fillStyle = EQUIP_DOT[t.trailer];
    ctx.fillRect(x0 + e, y0 + e, ow - 2 * e, oh - 2 * e);
  };
  // The AI at 80 % once you have a company (Jeff, 2026-11-02, over draft 4's 35 %): the interstates look busy and your
  // own truck, at full strength and drawn last, is still what the eye finds. Before that, the whole market at full.
  ctx.globalAlpha = S.game.player ? 0.8 : 1;
  for (const t of w.trucks) if (t.companyId !== mine && !humans.has(t.companyId)) dot(t, false);
  ctx.globalAlpha = 1;
  for (const t of w.trucks) if (t.companyId !== mine && humans.has(t.companyId)) dot(t, true);
  if (shade > 0) {
    ctx.globalAlpha = shade;
    ctx.fillStyle = nightColor(hour);
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.gold;
    for (let i = 0; i < (lvl ? 0 : art.lights.length); i++) {
      if ((i * 13 + Math.floor(now / 900)) % 17 === 0) continue;
      const [X, Y] = toScreen(...art.lights[i]!);
      if (visible(X, Y)) ctx.fillRect(X, Y, u, u);
    }
  }
  // The road ahead of the selected truck, as marching gold dots, above every other truck.
  const sel = myTrucks().find((t) => t.id === S.selTruck);
  if (sel && isMoving(sel)) {
    const pts = routeAhead(sel);
    if (pts) {
      ctx.fillStyle = PAL.gold;
      const gap = 5 * u;
      let carry = (now / 50) % gap;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x0, y0] = toScreen(...pts[i]!);
        const [x1, y1] = toScreen(...pts[i + 1]!);
        const len = Math.hypot(x1 - x0, y1 - y0);
        let d = carry;
        for (; d < len; d += gap) {
          const X = Math.round(x0 + ((x1 - x0) * d) / len);
          const Y = Math.round(y0 + ((y1 - y0) * d) / len);
          if (visible(X, Y)) ctx.fillRect(X, Y, u, u);
        }
        carry = d - len;
      }
    }
  }
  // The board's lanes (S3–S4): the open load's empty leg dotted and its lane solid; a bid in, its lane dashed.
  const stroke = (pts: [number, number][] | null, dash: number[], color: string) => {
    if (!pts) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * u;
    ctx.setLineDash(dash.map((d) => d * u));
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [X, Y] = toScreen(p[0], p[1]);
      if (i) ctx.lineTo(X, Y);
      else ctx.moveTo(X, Y);
    });
    ctx.stroke();
    ctx.restore();
  };
  if (S.game.player) {
    const idleTruck = myTrucks().find((t) => t.id === S.selTruck && t.status === "idle") ?? myTrucks().find((t) => t.status === "idle");
    const openL = S.openLoad !== null ? w.loads.get(S.openLoad) : undefined;
    if (openL && openL.status === "open") {
      if (idleTruck) stroke(routePoints(idleTruck.hub, openL.origin), [1, 3], PAL.white);
      stroke(routePoints(openL.origin, openL.dest), [], PAL.cyan);
    }
    for (const t of myTrucks()) {
      const bid = w.manualBids.get(t.id);
      const bl = bid ? w.loads.get(bid.loadId) : undefined;
      if (bl && bl.id !== openL?.id) stroke(routePoints(bl.origin, bl.dest), [6, 4], PAL.cyan);
    }
  }
  // The player's brokerage (brokerage-ux.md section 1): a brokered load in motion is an amber dashed lane under its
  // hauler; its open postings are amber pins at their origins (drawn after the trucks).
  const brokerage = hasTwo(S.game) ? S.game.brokerage : null;
  if (brokerage) for (const t of w.trucks) {
    const l = t.loadId !== null ? w.loads.get(t.loadId) : undefined;
    if (l && l.brokerId === brokerage.id) stroke(routePoints(l.origin, l.dest), [6, 4], PAL.amber);
  }
  const draw = (t: Truck, kind: MarkerKind): [number, number, number] | null => {
    const p = truckPoint(t);
    if (!p) return null;
    const [X, Y] = toScreen(p[0], p[1]);
    if (!visible(X, Y)) return null;
    const dir = headings.get(t.id) ?? 0;
    // The painted rig (68-px cells, its own pixels at 4×) scaled to the zoom, smoothed between whole scales.
    const painted = truckFrame(dir, 1, kind, t.trailer);
    if (painted) {
      const m = k / TRUCK_SCALE;
      const dw = painted.width * m;
      const dh = painted.height * m;
      ctx.imageSmoothingEnabled = !Number.isInteger(m);
      ctx.drawImage(painted, Math.round(X - dw / 2), Math.round(Y - dh / 2), Math.round(dw), Math.round(dh));
      ctx.imageSmoothingEnabled = false;
    } else {
      const sprite = truckMarkers(kind, t.trailer, u)[dir]!;
      ctx.drawImage(sprite, X - Math.floor(sprite.width / 2), Y - Math.floor(sprite.height / 2));
    }
    return [X, Y, dir];
  };
  if (brokerage) {
    for (const l of w.loads.values()) {
      if (l.status !== "open" || l.brokerId !== brokerage.id) continue;
      const [X, Y] = toScreen(...art.hubXY[l.origin]!);
      if (!visible(X, Y)) continue;
      // A pin: an amber head on an ink stem, standing on the origin, so it reads apart from the trucks' dots.
      const x = Math.round(X), y = Math.round(Y);
      ctx.fillStyle = PAL.ink0;
      ctx.fillRect(x - u, y - 6 * u, 2 * u, 6 * u);
      ctx.fillRect(x - 5 * u, y - 15 * u, 10 * u, 10 * u);
      ctx.fillStyle = PAL.amber;
      ctx.fillRect(x - 4 * u, y - 14 * u, 8 * u, 8 * u);
      ctx.fillStyle = PAL.white;
      ctx.fillRect(x - 2 * u, y - 12 * u, 2 * u, 2 * u);
    }
  }
  for (const t of myTrucks()) {
    const r = draw(t, "mine");
    if (!r) continue;
    const [X, Y, dir] = r;
    if (shade > 0.2 && isMoving(t)) {
      const [dx, dy] = DIR_VEC[dir]!;
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(Math.round(X + dx * 9 * u), Math.round(Y + dy * 9 * u), u, u);
      ctx.fillStyle = PAL.red;
      ctx.fillRect(Math.round(X - dx * 9 * u), Math.round(Y - dy * 9 * u), u, u);
    }
    if (t.id === S.selTruck && Math.floor(now / 350) % 2 === 0) {
      ctx.fillStyle = PAL.white;
      const r0 = 9 * u;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const cx = X + sx * r0;
        const cy = Y + sy * r0;
        ctx.fillRect(sx < 0 ? cx : cx - 3 * u + u, cy, 3 * u, u);
        ctx.fillRect(cx, sy < 0 ? cy : cy - 3 * u + u, u, 3 * u);
      }
    }
    if (t.status === "repair" || t.breakdownMin > 0) ctx.drawImage(icon("wrench", u), X - 6 * u, Y - 16 * u);
    myMarks.push([X, Y]);
  }
  drawHubLabels(ctx, f, k, u, visible);
  // Your trucks over everything (Jeff, 2026-11-02): a cyan ring and "You" at every zoom, after the labels.
  const L = Math.max(1, Math.round(f * 2));
  const ring = Math.max(10 * u, Math.round(8 * dpr));
  ctx.strokeStyle = PAL.cyan;
  ctx.lineWidth = Math.max(2 * u, Math.round(1.5 * dpr));
  for (const [X, Y] of myMarks) {
    ctx.beginPath();
    ctx.arc(X, Y, ring, 0, Math.PI * 2);
    ctx.stroke();
    drawText(ctx, "YOU", X - Math.round((textWidth("YOU") * L) / 2), Y + ring + 2 * u, L, PAL.cyan, PAL.ink0);
  }
}

let spriteCanvas: HTMLCanvasElement | null = null;
/** The transparent layer the sprites draw on, cleared, the size of the map canvas. */
function spriteLayer(W: number, H: number): HTMLCanvasElement {
  spriteCanvas ??= document.createElement("canvas");
  if (spriteCanvas.width !== W || spriteCanvas.height !== H) {
    spriteCanvas.width = W;
    spriteCanvas.height = H;
  }
  spriteCanvas.getContext("2d")!.clearRect(0, 0, W, H);
  return spriteCanvas;
}
/** Tints the sprites (only where they are drawn) toward the season: cold and pale in winter, warm in autumn, fresh in spring. */
function tintSprites(ctx: CanvasRenderingContext2D, season: Season, W: number, H: number): void {
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = season === "winter" ? "rgba(214,228,255,0.28)" : season === "autumn" ? "rgba(255,170,90,0.22)" : "rgba(190,240,160,0.16)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
}

/** A seasonal wash over the summer painting while a season's own fine level is missing: snow screening the north, autumn warmth, spring green. */
function washSeason(ctx: CanvasRenderingContext2D, season: Season, W: number, H: number): void {
  if (season === "winter") {
    const yTop = toScreen(0, art!.project(-96, 49)[1])[1];
    const yMid = toScreen(0, art!.project(-96, 35)[1])[1];
    const g = ctx.createLinearGradient(0, yTop, 0, yMid);
    g.addColorStop(0, "rgba(222,234,255,0.34)");
    g.addColorStop(1, "rgba(222,234,255,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = g;
  } else if (season === "autumn") {
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(255,196,130,0.22)";
  } else {
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = "rgba(170,230,140,0.16)";
  }
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
}

/**
 * The sky over the map: the weather sampled on a grid of the visible map and drawn as moving
 * rain streaks, drifting snow, fog banks, cloud shade and lightning, all deterministic from the
 * world seed and the in-game day so every player sees the same storm.
 */
function drawWeather(ctx: CanvasRenderingContext2D, now: number, k: number, u: number): void {
  if (!cv || !art || !S.game) return;
  const w = S.game.w;
  const minute = clockMin();
  const day = Math.floor(minute / 1440);
  const hour = (minute / 60) % 24;
  const seed = w.seed;
  const W = cv.width;
  const H = cv.height;
  const cell = Math.max(48, Math.round(64 * Math.min(k, 2)));
  const [wx0, wy0] = toWorld(0, 0);
  const [wx1, wy1] = toWorld(W, H);
  const cx0 = Math.floor((wx0 * k) / cell) * cell;
  const cy0 = Math.floor((wy0 * k) / cell) * cell;
  const lights: [number, number, Weather][] = [];
  // The painted effects (assets/vfx): the code's strokes stand in until they decode. Rain and snow
  // tile at the painting's own scale (a quarter of the zoom, never under half nor over twice), the
  // clouds drift over every cloudy cell at their own sizes and paces.
  const rainFx = vfxSprite("rain");
  const snowFx = vfxSprite("snow");
  const fogFx = vfxSprite("fog");
  const cloudFx = vfxSprite("cloud");
  const fxScale = Math.max(0.5, Math.min(2, k / 4));
  // Only over the map itself: nothing falls on the band around it.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-panX, -panY, art.W * k, art.H * k);
  ctx.clip();
  for (let gy = Math.max(cy0, 0); gy < Math.min(wy1, art.H) * k; gy += cell) {
    for (let gx = Math.max(cx0, 0); gx < Math.min(wx1, art.W) * k; gx += cell) {
      const [lon, lat] = art.unproject((gx + cell / 2) / k, (gy + cell / 2) / k);
      const wx = weatherAt(lon, lat, day, hour, seed);
      if (wx.kind === "clear" || wx.kind === "heat") continue;
      const X = gx - panX;
      const Y = gy - panY;
      const cs = Math.floor(gx / cell) * 73 + Math.floor(gy / cell) * 151;
      // A painted cloud over a quarter of the cloudy cells, never wider than its cell and faint, so the
      // weather reads as weather without hiding the roads and the trucks (Jeff, 2026-11-02).
      if (cloudFx && wx.kind !== "fog" && hash(cs, 9, 73) < 0.25) {
        const cw = cell * (0.5 + hash(cs, 10, 74) * 0.5);
        const chh = (cw * cloudFx.fh) / cloudFx.fw;
        const drift = ((now / (160 + hash(cs, 11, 75) * 160) + cs * 3) % (cell * 3)) - cell * 1.2;
        const cx = X + drift + (hash(cs, 14, 78) - 0.5) * cell;
        const cy = Y + (hash(cs, 12, 76) - 0.5) * cell * 0.8;
        const flip = hash(cs, 15, 79) < 0.5;
        ctx.globalAlpha = 0.25 * (0.7 + 0.3 * hash(cs, 16, 80)) * (0.8 + 0.2 * wx.intensity);
        ctx.imageSmoothingEnabled = true;
        ctx.save();
        ctx.translate(Math.round(cx + cw / 2), Math.round(cy + chh / 2));
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(cloudFx.img, 0, 0, cloudFx.fw, cloudFx.fh, Math.round(-cw / 2), Math.round(-chh / 2), Math.round(cw), Math.round(chh));
        ctx.restore();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1;
      }
      // Fog banks: faint soft-edged patches no wider than their cell (the storm shade is gone: it blanketed the map).
      const blob = (r: number, g: number, b: number, alpha: number, speed: number) => {
        const rad = cell * (0.4 + hash(cs, 7, 71) * 0.1);
        const drift = ((now / speed + cs * 3) % (cell * 2)) - cell;
        const cx = X + cell / 2 + drift;
        const cy = Y + cell / 2 + (hash(cs, 8, 72) - 0.5) * cell * 0.6;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
        grad.addColorStop(0.55, `rgba(${r},${g},${b},${(alpha * 0.55).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.globalAlpha = 1;
        ctx.fillStyle = grad;
        ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      };
      if (wx.kind === "rain" || wx.kind === "storm") {
        if (rainFx) drawRain(ctx, rainFx, now, X, Y, cell, cell, fxScale, (wx.kind === "storm" ? 0.45 : 0.3) * (0.6 + 0.4 * wx.intensity));
        else {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = PAL.blueL;
          const n = 3 + Math.round(wx.intensity * 6);
          for (let i = 0; i < n; i++) {
            const ox = hash(cs, i, 51) * cell;
            const fall = ((now / 4 + hash(cs, i, 52) * cell * 3) % (cell * 1.2)) - cell * 0.1;
            ctx.fillRect(Math.round(X + ox - fall * 0.25), Math.round(Y + fall), u, 4 * u);
          }
        }
        if (wx.kind === "storm" && (Math.floor(now / 90) + cs) % 97 === 0) lights.push([X, Y, wx]);
      } else if (wx.kind === "snow") {
        if (snowFx) drawSnow(ctx, snowFx, now, X, Y, cell, cell, fxScale, 0.35 + 0.25 * wx.intensity);
        else {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = PAL.white;
          const n = 3 + Math.round(wx.intensity * 6);
          for (let i = 0; i < n; i++) {
            const ox = hash(cs, i, 53) * cell;
            const fall = (now / 22 + hash(cs, i, 54) * cell * 3) % cell;
            const sway = Math.sin((now / 700) + i) * 3 * u;
            ctx.fillRect(Math.round(X + ox + sway), Math.round(Y + fall), u, u);
          }
        }
      } else if (wx.kind === "fog") {
        blob(182, 196, 220, 0.06 + 0.08 * wx.intensity, 220);
        if (fogFx) {
          const [sx, sy] = spriteFrame(fogFx, now, cs);
          const fw = cell;
          const fh = (fw * fogFx.fh) / fogFx.fw;
          const drift = ((now / (200 + hash(cs, 13, 77) * 100) + cs * 5) % (cell * 2)) - cell;
          ctx.globalAlpha = 0.15 + 0.15 * wx.intensity;
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(fogFx.img, sx, sy, fogFx.fw, fogFx.fh, Math.round(X + drift * 0.5), Math.round(Y + cell * 0.2), Math.round(fw), Math.round(fh));
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = 1;
        }
      }
    }
  }
  // Lightning: a flash over the cell and a bolt for one frame, the painted one when it is there.
  ctx.restore();
  const boltFx = vfxSprite("bolt");
  for (const [X, Y] of lights) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = PAL.white;
    ctx.fillRect(X, Y, cell, cell);
    ctx.globalAlpha = 1;
    if (boltFx) {
      const bh = cell * 1.4;
      const bw = (bh * boltFx.fw) / boltFx.fh;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(boltFx.img, 0, 0, boltFx.fw, boltFx.fh, Math.round(X + cell / 2 - bw / 2), Math.round(Y - cell * 0.4), Math.round(bw), Math.round(bh));
      ctx.imageSmoothingEnabled = false;
      continue;
    }
    let bx = X + cell / 2;
    for (let by = Y; by < Y + cell; by += 4 * u) {
      bx += (hash(Math.round(bx), Math.round(by), 55) - 0.5) * 6 * u;
      ctx.fillRect(Math.round(bx), Math.round(by), u, 4 * u);
    }
  }
  ctx.globalAlpha = 1;
}

function drawHubLabels(ctx: CanvasRenderingContext2D, f: number, k: number, u: number, visible: (X: number, Y: number) => boolean): void {
  const w = S.game!.w;
  const dprL = window.devicePixelRatio || 1;
  // Zoomed out it's the map, not text (Jeff, 2026-11-02): no city names until 4×, where the sprite layer starts (the
  // towns; the hub cities' own sprites come at 8×, the last level, too deep to wait for). Then about 9–14 screen pixels.
  if (k < LABEL_K) {
    // The one exception, before a company: the three ringed starters, small under the ring, since one must be picked.
    if (!S.game!.player) starterRings(ctx, u, visible, Math.max(1, Math.round(dprL)));
    return;
  }
  const L = Math.max(2, Math.round(1.4 * dprL)) + (k >= 8 ? 1 : 0);
  const open = new Map<number, number>();
  for (const l of w.loads.values()) if (l.status === "open") open.set(l.origin, (open.get(l.origin) ?? 0) + 1);
  // Every city by its full name, the biggest first; a name that would overlap one already placed
  // waits for the next zoom in, so the crowded corridors stay readable at every level.
  const order = w.net.hubs.map((_, i) => i).sort((a, b) => (a === S.selHub ? -1 : b === S.selHub ? 1 : w.net.hubs[b]!.weight - w.net.hubs[a]!.weight));
  const placed: [number, number, number, number][] = [];
  for (const i of order) {
    const h = w.net.hubs[i]!;
    const cls = art!.cityClass[i]!;
    const [X, Y] = toScreen(...art!.hubXY[i]!);
    if (!visible(X, Y)) continue;
    const text = h.name.toUpperCase();
    const count = String(open.get(i) ?? 0);
    const tw = textWidth(text) * L;
    const x = X - Math.round(tw / 2);
    const top = k >= CITY_SCALE && citySprite(h.id) ? ((128 * k) / CITY_SCALE) * 1.2 : CITY_TOP[cls]! * k;
    const y = Math.round(Y - top - 7 * L - 2 * u);
    const box: [number, number, number, number] = [x - 3 * L, y - 2 * L, x + tw + (count ? (3 + textWidth(count)) * L : 0) + 3 * L, y + 9 * L];
    if (placed.some((b) => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3])) continue;
    placed.push(box);
    drawText(ctx, text, x, y, L, i === S.selHub ? PAL.gold : PAL.white, PAL.ink0);
    if (count) drawText(ctx, count, x + tw + 3 * L, y, L, PAL.gold, PAL.ink0);
  }
  if (!S.game!.player) starterRings(ctx, u, visible, 0);
}
/** City names show from this many device pixels per level-0 art pixel (the 4× level). */
const LABEL_K = 4;

/** Before a company (S1): the three starter hubs carry a cyan ring, so the first look finds a home; `L` > 0 names them under it. */
function starterRings(ctx: CanvasRenderingContext2D, u: number, visible: (X: number, Y: number) => boolean, L: number): void {
  const w = S.game!.w;
  const dprR = window.devicePixelRatio || 1;
  const r = Math.max(12 * u, Math.round(14 * dprR));
  ctx.strokeStyle = PAL.cyan;
  ctx.lineWidth = Math.max(2 * u, Math.round(2 * dprR));
  const placed: [number, number, number, number][] = [];
  // The same three the hub list names (ChooseHub ringedHubs): from the first look, not only once the list has shown.
  S.entry.rings ??= rankStarters(w).slice(0, 3);
  for (const i of S.entry.rings) {
    const [X, Y] = toScreen(...art!.hubXY[i]!);
    if (!visible(X, Y)) continue;
    ctx.beginPath();
    ctx.arc(X, Y, r, 0, Math.PI * 2);
    ctx.stroke();
    if (!L) continue;
    // Under the ring, or above it when that would run into a name already placed (Los Angeles and Phoenix).
    const text = w.net.hubs[i]!.name.toUpperCase();
    const tw = textWidth(text) * L;
    const x = X - Math.round(tw / 2);
    const hit = (y: number) => placed.some((b) => b[0] < x + tw && x < b[2] && b[1] < y + 8 * L && y < b[3]);
    const below = Y + r + 2 * u;
    const y = hit(below) ? Y - r - 2 * u - 8 * L : below;
    placed.push([x - L, y - L, x + tw + L, y + 8 * L]);
    drawText(ctx, text, x, y, L, i === S.selHub ? PAL.gold : PAL.cyan, PAL.ink0);
  }
}

// --- Pointer -------------------------------------------------------------------------

function canvasPoint(ev: { clientX: number; clientY: number }): [number, number] {
  const r = cv!.getBoundingClientRect();
  return [((ev.clientX - r.left) / r.width) * cv!.width, ((ev.clientY - r.top) / r.height) * cv!.height];
}
// A hub is hit within 14 screen pixels, or anywhere on its city sprite (32 art pixels wide) when zoomed in.
// A hub is hit within about 22 screen pixels at any zoom (QA, 2026-11-02: at the whole map a near miss fell through to
// the double-click zoom), and anywhere on its city sprite when zoomed in.
function nearestHub(x: number, y: number, max = Math.max(14 / zoom(), 12, (22 * (window.devicePixelRatio || 1)) / kScale())): number | null {
  let best: number | null = null;
  let bd = max;
  art!.hubXY.forEach(([hx, hy], i) => {
    const d = Math.hypot(hx - x, hy - y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}
/** The truck-stop site under the pointer (drawn from 2×), if any. */
function nearestSite(x: number, y: number): number | null {
  const w = S.game!.w;
  if (zoom() < 2 || !w.cfg.businesses.enabled) return null;
  let best: number | null = null;
  let bd = Math.max(8 / zoom(), 3);
  for (const s of w.sites) {
    const [px, py] = art!.project(s.lon, s.lat);
    const d = Math.hypot(px - x, py - y);
    if (d < bd) {
      bd = d;
      best = s.id;
    }
  }
  return best;
}
/** Selects your truck under the pointer, else a truck-stop site, else the nearest hub. */
function selectOnMap(ev: { clientX: number; clientY: number }): void {
  const [x, y] = toWorld(...canvasPoint(ev));
  let best: Truck | null = null;
  let bd = 9 / zoom();
  for (const t of myTrucks()) {
    const p = truckPoint(t);
    if (!p) continue;
    const d = Math.hypot(p[0] - x, p[1] - y);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  const site = best ? null : nearestSite(x, y);
  if (best) {
    S.selTruck = best.id;
    setTab(best.status === "idle" ? "loads" : "fleet");
  } else if (site !== null) {
    S.selSite = site;
    setTab("business");
  } else {
    const h = nearestHub(x, y);
    S.selHub = h;
    if (h !== null) {
      setTab("loads");
      S.cityView = h;
      S.townView = null;
    } else if (zf >= 4) {
      // The towns are drawn from 4×: a tap on one opens the market it trades on, as that town.
      const pl = S.game!.w.net.places;
      const minPop = zf >= 8 ? 10_000 : zf >= 6 ? 30_000 : 80_000;
      let bt: number | null = null;
      let bd = Math.max(10 / zoom(), 7);
      for (let i = 0; i < pl.length; i++) {
        const p = pl[i]!;
        if (p.pop < minPop) continue;
        const [px, py] = art!.project(p.lon, p.lat);
        const d = Math.hypot(px - x, py - y);
        if (d < bd) {
          bd = d;
          bt = i;
        }
      }
      if (bt !== null) {
        S.townView = bt;
        S.cityView = pl[bt]!.market;
        S.selHub = pl[bt]!.market;
        setTab("loads");
      }
    }
  }
  // On a phone a tap on the map drops the sheet to its strip, so the map is what you see (specs/first-ten-minutes.md);
  // before there is a company a hub tap opens that hub's card in the sheet instead, never the city pane.
  if (S.game?.player) S.sheet = "strip";
  else if (S.selHub !== null) {
    S.cityView = null;
    S.townView = null;
    S.entry = { ...S.entry, stage: "card", hub: S.selHub };
    S.sheet = "full";
  }
  bumpData();
}
function showHubTip(ev: { clientX: number; clientY: number }): void {
  if (!tip || !wrap || !art) return;
  const [x, y] = toWorld(...canvasPoint(ev));
  const siteId = nearestSite(x, y);
  if (siteId !== null) {
    const w = S.game!.w;
    const s = w.sites[siteId - 1]!;
    const b = s.businessId ? w.businesses[s.businessId - 1] : undefined;
    const road = w.net.roads.edges[s.edge]?.label ?? "Interstate";
    tip.textContent = `${road} · rest area, ${s.spaces} spaces (${s.parked} taken)${b && b.ownerId > 0 ? ` · truck stop, parking ${Math.round(b.parkingFd)} FD a night` : s.open ? " · for sale" : ""}${s.theftRisk > 1.05 ? ` · theft risk ${s.theftRisk.toFixed(1)}×` : ""}`;
    tip.hidden = false;
    const r = wrap.getBoundingClientRect();
    tip.style.left = `${Math.min(r.width - 260, Math.max(4, ev.clientX - r.left + 12))}px`;
    tip.style.top = `${Math.max(4, ev.clientY - r.top - 34)}px`;
    return;
  }
  const h = nearestHub(x, y);
  if (h === null) {
    tip.hidden = true;
    return;
  }
  const hub = S.game!.w.net.hubs[h]!;
  const season = (["reefer", "van", "flatbed"] as Equipment[]).map((eq) => `${TRAILER_NAME[eq].toLowerCase()} ${signedPct(seasonSwing(h, eq))}`).join(", ");
  const eq: Equipment = myTrucks().find((t) => t.id === S.selTruck)?.trailer ?? "van";
  const minute = clockMin();
  const sky = weatherLabel(weatherAt(hub.lon, hub.lat, Math.floor(minute / 1440), (minute / 60) % 24, S.game!.w.seed));
  tip.textContent = `${hub.name} (${hub.id}) · ${sky} · ${openLoadsAt(h).length} open loads · ${TRAILER_NAME[eq].toLowerCase()} reload ${reloadLabel(h, eq)} · season: ${season}`;
  tip.hidden = false;
  const r = wrap.getBoundingClientRect();
  tip.style.left = `${Math.min(r.width - 260, Math.max(4, ev.clientX - r.left + 12))}px`;
  tip.style.top = `${Math.max(4, ev.clientY - r.top - 34)}px`;
}

/** Attaches the map to its canvas; returns a detach function. */
export function mountMap(canvas: HTMLCanvasElement, wrapEl: HTMLElement, tipEl: HTMLElement): () => void {
  cv = canvas;
  wrap = wrapEl;
  tip = tipEl;
  mountedAt = performance.now();
  const pointers = new Map<number, { x: number; y: number }>();
  let drag: { x: number; y: number; panX: number; panY: number; moved: boolean; lx: number; ly: number; lt: number; vx: number; vy: number } | null = null;
  let pinch: { dist: number; z0: number } | null = null;
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1;
  };
  const down = (ev: PointerEvent) => {
    if (!S.game) return;
    canvas.setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    vel = [0, 0];
    // A touch takes the map back from the arrival's flight.
    if (fly) {
      zoomIdx = nearestLevel(zf);
      fly = null;
    }
    if (pointers.size === 1) {
      drag = { x: ev.clientX, y: ev.clientY, panX, panY, moved: false, lx: ev.clientX, ly: ev.clientY, lt: performance.now(), vx: 0, vy: 0 };
      dragging = true;
    }
    if (pointers.size === 2) {
      pinch = { dist: spread(), z0: zt };
      gestureFrom = zt;
      drag = null;
    }
  };
  const move = (ev: PointerEvent) => {
    if (!S.game) return;
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const [cx, cy] = canvasPoint({ clientX: (a!.x + b!.x) / 2, clientY: (a!.y + b!.y) / 2 });
      zoomTo(pinch.z0 * (spread() / pinch.dist), cx, cy);
      return;
    }
    if (drag) {
      const r = canvas.getBoundingClientRect();
      const dx = ev.clientX - drag.x;
      const dy = ev.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) {
        drag.moved = true;
        // A pan takes the map from following the truck; "Follow" gives it back (S6).
        if (S.following) {
          S.following = false;
          bumpData();
        }
      }
      if (drag.moved && canPan()) {
        const sx = canvas.width / r.width;
        const sy = canvas.height / r.height;
        panX = drag.panX - dx * sx;
        panY = drag.panY - dy * sy;
        clampPan();
        // The drag's speed, smoothed over the last few moves, carries the map on after release.
        const t = performance.now();
        const dtm = Math.max(1, t - drag.lt);
        drag.vx = drag.vx * 0.5 - ((ev.clientX - drag.lx) * sx) / dtm / 2;
        drag.vy = drag.vy * 0.5 - ((ev.clientY - drag.ly) * sy) / dtm / 2;
        drag.lx = ev.clientX;
        drag.ly = ev.clientY;
        drag.lt = t;
        canvas.style.cursor = "grabbing";
        tipEl.hidden = true;
      }
      return;
    }
    if (ev.pointerType === "mouse") showHubTip(ev);
  };
  const release = (ev: PointerEvent) => {
    const tap = drag && !drag.moved && ev.type === "pointerup";
    pointers.delete(ev.pointerId);
    if (pointers.size < 2 && pinch) {
      pinch = null;
      snapZoom();
    }
    if (pointers.size === 0) {
      if (drag?.moved && canPan() && performance.now() - drag.lt < 80 && Math.hypot(drag.vx, drag.vy) > 0.05) vel = [drag.vx, drag.vy];
      drag = null;
      dragging = false;
    }
    if (tap) selectOnMap(ev);
    canvas.style.cursor = canPan() ? "grab" : "crosshair";
  };
  const leave = () => (tipEl.hidden = true);
  // The wheel zooms freely (a trackpad glides, a mouse notch is a bigger step) and settles on a level once it stops.
  const wheel = (ev: WheelEvent) => {
    if (!S.game) return;
    ev.preventDefault();
    const dy = Math.max(-160, Math.min(160, ev.deltaY * (ev.deltaMode === 1 ? 33 : ev.deltaMode === 2 ? 400 : 1)));
    freeZoom(zt * Math.exp(-dy * 0.0035), ...canvasPoint(ev));
    clearTimeout(snapTimer);
    snapTimer = window.setTimeout(() => {
      snapTimer = 0;
      snapZoom();
    }, 150);
  };
  const dbl = (ev: MouseEvent) => S.game && setZoom(zoomIdx + 1, ...canvasPoint(ev));
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("mouseleave", leave);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("dblclick", dbl);
  const ro = new ResizeObserver(() => S.game && fitMap());
  ro.observe(wrapEl);
  fitMap();
  return () => {
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", release);
    canvas.removeEventListener("pointercancel", release);
    canvas.removeEventListener("mouseleave", leave);
    canvas.removeEventListener("wheel", wheel);
    canvas.removeEventListener("dblclick", dbl);
    ro.disconnect();
    cv = null;
    wrap = null;
    tip = null;
  };
}

void selectTruck;
void setTab;
