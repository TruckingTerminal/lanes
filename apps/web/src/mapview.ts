import type { Equipment } from "@lanes/config";
import { hubMiles, hubRoute, type Truck } from "@lanes/engine";
import { icon, PAL } from "./art.js";
import { drawText, textWidth } from "./font.js";
import { isHuman } from "./game.js";
import { buildMap, headingDir, nightColor, nightShade, truckMarkers, type MapArt, type MarkerKind } from "./map.js";
import { truckFrame } from "./assets.js";
import { bumpData, clockMin, myTrucks, S, selectTruck, setTab } from "./state.js";
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

/** Whole-number zoom levels keep every map pixel square. */
const ZOOMS = [1, 2, 3, 4, 6];
/** Device pixels per map pixel at 1×: the whole part of the device pixel ratio, so a map pixel is one CSS pixel. */
let sDev = 1;
let zoomIdx = 0;
let panX = 0;
let panY = 0;
let buildTimer = 0;
export const zoom = (): number => ZOOMS[zoomIdx]!;
export const zoomIndex = (): number => zoomIdx;
export const maxZoom = (): boolean => zoomIdx === ZOOMS.length - 1;
const fitK = () => (cv?.width || 1) / (art?.W ?? 1);
const kScale = () => fitK() * zoom();

/** Last heading per truck, so a parked truck keeps facing the way it arrived. */
const headings = new Map<number, number>();
const DIR_VEC: [number, number][] = [[1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071]];
/** Tallest tower of each city class, in art pixels, for placing pins and labels above the skyline. */
const CITY_TOP = [4, 6, 10, 13];
/** Dot colour by equipment for the other carriers' trucks: white van, blue reefer, amber flatbed. */
const EQUIP_DOT: Record<Equipment, string> = { van: PAL.white, reefer: PAL.blueL, flatbed: PAL.amber };

export function resetArt(): void {
  art = null;
  headings.clear();
}

function buildArt(W: number, H: number): void {
  const g = S.game;
  if (!g || !cv) return;
  const old = art;
  const center = old ? toWorld(cv.width / 2, cv.height / 2) : null;
  const t0 = performance.now();
  art = buildMap(g.w.net.hubs, g.w.net.roads, W, H, g.w.net.places);
  headings.clear();
  console.info(`map ${W}×${H} painted in ${Math.round(performance.now() - t0)} ms`);
  cv.width = W * sDev;
  cv.height = H * sDev;
  if (center && old) centerOn((center[0] / old.W) * W, (center[1] / old.H) * H);
  else clampPan();
}

/** Sizes the canvas to the map window in device pixels and (re)paints the base to match. */
export function fitMap(): void {
  if (!S.game || !wrap || !cv) return;
  const cssW = wrap.clientWidth;
  const cssH = wrap.clientHeight;
  if (cssW < 40 || cssH < 40) return;
  const dpr = window.devicePixelRatio || 1;
  sDev = Math.max(1, Math.floor(dpr));
  const W = Math.min(1600, Math.max(320, Math.floor((cssW * dpr) / sDev)));
  const H = Math.min(1000, Math.max(200, Math.floor((cssH * dpr) / sDev)));
  if (!art) buildArt(W, H);
  else if (art.W !== W || art.H !== H) {
    clearTimeout(buildTimer);
    buildTimer = window.setTimeout(() => buildArt(W, H), 200);
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
function clampPan(): void {
  if (!cv) return;
  const k = kScale();
  const maxX = Math.max(0, (art?.W ?? 0) * k - cv.width);
  const maxY = Math.max(0, (art?.H ?? 0) * k - cv.height);
  panX = Math.round(Math.max(0, Math.min(maxX, panX)));
  panY = Math.round(Math.max(0, Math.min(maxY, panY)));
}
export function centerOn(wx: number, wy: number): void {
  if (!cv) return;
  panX = wx * kScale() - cv.width / 2;
  panY = wy * kScale() - cv.height / 2;
  clampPan();
}
/** Changes the zoom level, keeping the map point under canvas pixel (ax, ay) where it is. */
export function setZoom(idx: number, ax?: number, ay?: number): void {
  if (!cv) return;
  const next = Math.max(0, Math.min(ZOOMS.length - 1, idx));
  if (next === zoomIdx) return;
  const x = ax ?? cv.width / 2;
  const y = ay ?? cv.height / 2;
  const [wx, wy] = toWorld(x, y);
  zoomIdx = next;
  panX = wx * kScale() - x;
  panY = wy * kScale() - y;
  clampPan();
  if (tip) tip.hidden = true;
  cv.style.cursor = zoomIdx > 0 ? "grab" : "crosshair";
  bumpData();
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
  const r = 5 + 2.6 * Math.sqrt(i);
  const a = i * 2.39996;
  return [p[0] + Math.cos(a) * r, p[1] + 3 + Math.abs(Math.sin(a)) * r * 0.7];
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
  if (!cv || !art || !S.game) return;
  if (S.layout === "panel") return;
  const ctx = cv.getContext("2d")!;
  const w = S.game.w;
  const W = cv.width;
  const H = cv.height;
  const f = fitK();
  const k = f * zoom();
  const u = Math.max(1, Math.round(f * Math.min(zoom(), 4)));
  const visible = (X: number, Y: number) => X > -40 * u && Y > -40 * u && X < W + 40 * u && Y < H + 40 * u;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PAL.seaD;
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(k, 0, 0, k, -panX, -panY);
  ctx.drawImage(art.base, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PAL.foam;
  for (let i = 0; i < art.glints.length; i++) {
    if ((Math.floor(now / 450) + i * 7) % 11 === 0) {
      const [X, Y] = toScreen(...art.glints[i]!);
      if (visible(X, Y)) ctx.fillRect(X, Y, 2 * u, u);
    }
  }
  const hour = (clockMin() / 60) % 24;
  const shade = nightShade(hour);
  const mine = S.game.player?.id ?? -1;
  const humans = new Set(w.companies.filter(isHuman).map((c) => c.id));
  if (S.selHub !== null) {
    const [X, Y] = toScreen(...art.hubXY[S.selHub]!);
    const pin = icon("pin", u);
    const bob = (Math.floor(now / 400) % 2) * u;
    ctx.drawImage(pin, X - 6 * u, Math.round(Y - CITY_TOP[art.cityClass[S.selHub]!]! * k - 12 * u - bob));
  }
  // Other carriers are dots: colour says the equipment, a lime ring says a player.
  const dot = (t: Truck, player: boolean) => {
    const p = truckPoint(t);
    if (!p) return;
    const [X, Y] = toScreen(p[0], p[1]);
    if (!visible(X, Y)) return;
    if (player) {
      ctx.fillStyle = PAL.ink0;
      ctx.fillRect(X - 3 * u, Y - 3 * u, 6 * u, 6 * u);
      ctx.fillStyle = PAL.lime;
      ctx.fillRect(X - 2 * u, Y - 2 * u, 4 * u, 4 * u);
    } else {
      ctx.fillStyle = PAL.ink0;
      ctx.fillRect(X - 2 * u, Y - 2 * u, 4 * u, 4 * u);
    }
    ctx.fillStyle = EQUIP_DOT[t.trailer];
    ctx.fillRect(X - u, Y - u, 2 * u, 2 * u);
  };
  for (const t of w.trucks) if (t.companyId !== mine && !humans.has(t.companyId)) dot(t, false);
  for (const t of w.trucks) if (t.companyId !== mine && humans.has(t.companyId)) dot(t, true);
  if (shade > 0) {
    ctx.globalAlpha = shade;
    ctx.fillStyle = nightColor(hour);
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.gold;
    for (let i = 0; i < art.lights.length; i++) {
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
  const draw = (t: Truck, kind: MarkerKind): [number, number, number] | null => {
    const p = truckPoint(t);
    if (!p) return null;
    const [X, Y] = toScreen(p[0], p[1]);
    if (!visible(X, Y)) return null;
    const dir = headings.get(t.id) ?? 0;
    // The PixelLab truck (42-px cells) at half the marker scale so it stays a marker, not a billboard.
    const sprite = truckFrame(dir, Math.max(1, Math.round(u / 2)), kind, t.trailer) ?? truckMarkers(kind, t.trailer, u)[dir]!;
    ctx.drawImage(sprite, X - Math.floor(sprite.width / 2), Y - Math.floor(sprite.height / 2));
    return [X, Y, dir];
  };
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
  }
  drawHubLabels(ctx, f, k, u, visible);
}

function drawHubLabels(ctx: CanvasRenderingContext2D, f: number, k: number, u: number, visible: (X: number, Y: number) => boolean): void {
  const w = S.game!.w;
  const z = zoom();
  const L = Math.max(1, Math.round(f * (z >= 3 ? 3 : 2)));
  let open: Map<number, number> | null = null;
  if (z >= 3) {
    open = new Map();
    for (const l of w.loads.values()) if (l.status === "open") open.set(l.origin, (open.get(l.origin) ?? 0) + 1);
  }
  w.net.hubs.forEach((h, i) => {
    const cls = art!.cityClass[i]!;
    if (z === 1 && cls < 3 && i !== S.selHub) return;
    const [X, Y] = toScreen(...art!.hubXY[i]!);
    if (!visible(X, Y)) return;
    const text = z >= 4 ? h.name.toUpperCase() : h.id;
    const count = open ? String(open.get(i) ?? 0) : "";
    const tw = textWidth(text) * L;
    const x = X - Math.round(tw / 2);
    const y = Math.round(Y - CITY_TOP[cls]! * k - 7 * L - 2 * u);
    drawText(ctx, text, x, y, L, i === S.selHub ? PAL.gold : PAL.white, PAL.ink0);
    if (count) drawText(ctx, count, x + tw + 3 * L, y, L, PAL.gold, PAL.ink0);
  });
}

// --- Pointer -------------------------------------------------------------------------

function canvasPoint(ev: { clientX: number; clientY: number }): [number, number] {
  const r = cv!.getBoundingClientRect();
  return [((ev.clientX - r.left) / r.width) * cv!.width, ((ev.clientY - r.top) / r.height) * cv!.height];
}
function nearestHub(x: number, y: number, max = 14 / zoom()): number | null {
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
/** Selects your truck under the pointer, else the nearest hub. */
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
  if (best) {
    S.selTruck = best.id;
    S.tab = best.status === "idle" ? "loads" : "fleet";
  } else {
    const h = nearestHub(x, y);
    S.selHub = h;
    if (h !== null) S.tab = "loads";
  }
  bumpData();
}
function showHubTip(ev: { clientX: number; clientY: number }): void {
  if (!tip || !wrap || !art) return;
  const [x, y] = toWorld(...canvasPoint(ev));
  const h = nearestHub(x, y);
  if (h === null) {
    tip.hidden = true;
    return;
  }
  const hub = S.game!.w.net.hubs[h]!;
  const season = (["reefer", "van", "flatbed"] as Equipment[]).map((eq) => `${TRAILER_NAME[eq].toLowerCase()} ${signedPct(seasonSwing(h, eq))}`).join(", ");
  const eq: Equipment = myTrucks().find((t) => t.id === S.selTruck)?.trailer ?? "van";
  tip.textContent = `${hub.name} (${hub.id}) · ${openLoadsAt(h).length} open loads · ${TRAILER_NAME[eq].toLowerCase()} reload ${reloadLabel(h, eq)} · season: ${season}`;
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
  const pointers = new Map<number, { x: number; y: number }>();
  let drag: { x: number; y: number; panX: number; panY: number; moved: boolean } | null = null;
  let pinch: { dist: number; idx: number } | null = null;
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1;
  };
  const down = (ev: PointerEvent) => {
    if (!S.game) return;
    canvas.setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 1) drag = { x: ev.clientX, y: ev.clientY, panX, panY, moved: false };
    if (pointers.size === 2) {
      pinch = { dist: spread(), idx: zoomIdx };
      drag = null;
    }
  };
  const move = (ev: PointerEvent) => {
    if (!S.game) return;
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const [cx, cy] = canvasPoint({ clientX: (a!.x + b!.x) / 2, clientY: (a!.y + b!.y) / 2 });
      setZoom(pinch.idx + Math.round(Math.log(spread() / pinch.dist) / Math.log(1.6)), cx, cy);
      return;
    }
    if (drag) {
      const r = canvas.getBoundingClientRect();
      const dx = ev.clientX - drag.x;
      const dy = ev.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved && zoomIdx > 0) {
        panX = drag.panX - dx * (canvas.width / r.width);
        panY = drag.panY - dy * (canvas.height / r.height);
        clampPan();
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
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) drag = null;
    if (tap) selectOnMap(ev);
    canvas.style.cursor = zoomIdx > 0 ? "grab" : "crosshair";
  };
  const leave = () => (tipEl.hidden = true);
  let wheelAcc = 0;
  const wheel = (ev: WheelEvent) => {
    if (!S.game) return;
    ev.preventDefault();
    wheelAcc += ev.deltaY * (ev.deltaMode === 1 ? 33 : 1);
    if (Math.abs(wheelAcc) < 80) return;
    setZoom(zoomIdx + (wheelAcc < 0 ? 1 : -1), ...canvasPoint(ev));
    wheelAcc = 0;
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
