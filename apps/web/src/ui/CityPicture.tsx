import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { ASSETS, hasAsset, vfxSprite } from "../mapart.js";
import { hash } from "../map.js";
import { clockMin, S, useData } from "../state.js";
import { weatherAt, type WeatherKind } from "../weather.js";

/**
 * A city's picture in the pane, lit for the hour and the weather. Every hub has its golden-hour
 * painting (tools/paint-cityviews.py) and, where painted, a clear day, a night, a rainy and a
 * snowy one; the picture shows the nearest and relights it for the rest: a painting's sky is cut
 * out once (the colours common at the top of the painting and rare at the bottom, down to each
 * column's skyline, smoothed and feathered) and replaced by the hour's sky with drifting painted
 * clouds and stars, the ground is graded for the hour and the weather with the lit windows kept
 * at night, and the paintings crossfade into each other at dawn, in the late afternoon and at
 * dusk. A painting with a full-resolution loop (tools/animate-cityviews.py) plays it in place of
 * the still, every frame graded the same way. The precipitation falls over it (Sky).
 */
export const VIEW_W = 688;
export const VIEW_H = 384;

export type Band = "night" | "dawn" | "morning" | "midday" | "afternoon" | "golden" | "dusk";
export function bandOf(hour: number): Band {
  if (hour < 5 || hour >= 21) return "night";
  if (hour < 7) return "dawn";
  if (hour < 11) return "morning";
  if (hour < 16) return "midday";
  if (hour < 18) return "afternoon";
  if (hour < 20) return "golden";
  return "dusk";
}
export const BAND_LABEL: Record<Band, string> = { night: "night", dawn: "dawn", morning: "morning", midday: "midday", afternoon: "afternoon", golden: "golden hour", dusk: "dusk" };

interface Painting {
  img: HTMLImageElement;
  ready: boolean;
  mask: HTMLCanvasElement | null;
  graded: Map<string, HTMLCanvasElement>;
  /** The painting's full-resolution loop (tools/animate-cityviews.py): a 4 × 4 sheet of 16 frames, when one was made. */
  loop: HTMLImageElement | null;
  loopReady: boolean;
}
/** The loops play at this many frames a second. */
const LOOP_FPS = 8;
const LOOP_FRAMES = 16;
const LOOP_COLS = 4;
const paintings = new Map<string, Painting>();
/** A painting next to the page once it has decoded, else null; its loop sheet starts loading with it. */
function painting(path: string): Painting | null {
  if (!hasAsset(path)) return null;
  let p = paintings.get(path);
  if (!p) {
    const img = new Image();
    const entry: Painting = { img, ready: false, mask: null, graded: new Map(), loop: null, loopReady: false };
    img.onload = () => (entry.ready = true);
    img.src = ASSETS + path;
    paintings.set(path, (p = entry));
  }
  if (!p.loop && hasAsset(path.replace(/\.png$/, ".loop.png"))) {
    const loop = new Image();
    const entry = p;
    loop.onload = () => (entry.loopReady = true);
    loop.src = ASSETS + path.replace(/\.png$/, ".loop.png");
    p.loop = loop;
  }
  return p.ready ? p : null;
}

/**
 * The painting's sky as an alpha mask: colours common in the top quarter and rare in the bottom half
 * are sky; each column is sky from the top to its first run of three pixels that are not; the
 * skyline is the median over nine columns (stray clouds and poles drop out, towers stay) and the
 * mask feathers six pixels under it.
 */
function skyMask(img: HTMLImageElement): HTMLCanvasElement {
  const W = img.width;
  const H = img.height;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data;
  const key = new Uint16Array(W * H);
  for (let i = 0; i < W * H; i++) key[i] = ((d[i * 4]! >> 4) << 8) | ((d[i * 4 + 1]! >> 4) << 4) | (d[i * 4 + 2]! >> 4);
  const ct = new Float32Array(4096);
  const cb = new Float32Array(4096);
  const nt = Math.floor(H / 4) * W;
  const b0 = Math.floor(H / 2) * W;
  const nb = W * H - b0;
  for (let i = 0; i < nt; i++) ct[key[i]!]!++;
  for (let i = b0; i < W * H; i++) cb[key[i]!]!++;
  const skyset = new Uint8Array(4096);
  for (let k = 0; k < 4096; k++) {
    if (!(ct[k]! / nt > 0.0002 && ct[k]! / nt > (1.5 * cb[k]!) / nb)) continue;
    const r = k >> 8;
    const g = (k >> 4) & 15;
    const b = k & 15;
    for (let dr = -1; dr <= 1; dr++) for (let dg = -1; dg <= 1; dg++) for (let db = -1; db <= 1; db++) {
      const rr = r + dr;
      const gg = g + dg;
      const bb = b + db;
      if (rr >= 0 && rr < 16 && gg >= 0 && gg < 16 && bb >= 0 && bb < 16) skyset[(rr << 8) | (gg << 4) | bb] = 1;
    }
  }
  const stop = new Int32Array(W);
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H) {
      if (skyset[key[y * W + x]!]) {
        y++;
        continue;
      }
      if (y + 2 < H && !skyset[key[(y + 1) * W + x]!] && !skyset[key[(y + 2) * W + x]!]) break;
      y++;
    }
    stop[x] = y;
  }
  const win = new Int32Array(9);
  const m = ctx.createImageData(W, H);
  for (let x = 0; x < W; x++) {
    for (let j = -4; j <= 4; j++) win[j + 4] = stop[Math.max(0, Math.min(W - 1, x + j))]!;
    win.sort();
    const h = win[4]!;
    for (let y = 0; y < H; y++) {
      const a = Math.max(0, Math.min(1, (h - y) / 6));
      const o = (y * W + x) * 4;
      m.data[o] = m.data[o + 1] = m.data[o + 2] = 255;
      m.data[o + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(m, 0, 0);
  return cv;
}

/** How a painting is graded: channel gains, desaturation, a lift of the blacks, whether lit windows are kept, overall gain. */
interface Grade {
  m: [number, number, number];
  d: number;
  lift: number;
  lights: boolean;
  gain: number;
}
/** The golden-hour painting taken to each hour: the orange cast is pulled out by day and the light taken down at night. */
const BAND_GRADE: Record<Band, Partial<Grade>> = {
  night: { m: [0.3, 0.34, 0.56], d: 0.25, lights: true },
  dawn: { m: [1.0, 0.84, 0.9], d: 0.1, gain: 0.92 },
  morning: { m: [0.97, 1.0, 1.07], d: 0.3 },
  midday: { m: [1.0, 1.02, 1.1], d: 0.35, gain: 1.06 },
  afternoon: { m: [1.02, 0.98, 0.92], d: 0.15 },
  golden: {},
  dusk: { m: [0.6, 0.54, 0.7], d: 0.15, lights: true },
};
/** The clear-day painting taken to the daylight hours: a little cool early, warm late. */
const DAY_GRADE: Partial<Record<Band, Partial<Grade>>> = {
  morning: { m: [0.98, 0.99, 1.03], gain: 0.97 },
  midday: {},
  afternoon: { m: [1.04, 0.99, 0.9], gain: 0.98 },
};
const KIND_GRADE: Record<WeatherKind, Partial<Grade>> = {
  clear: {},
  heat: { m: [1.05, 1.0, 0.92], d: 0.1 },
  cloud: { m: [0.88, 0.9, 0.95], d: 0.15 },
  rain: { m: [0.68, 0.72, 0.82], d: 0.3 },
  storm: { m: [0.55, 0.58, 0.7], d: 0.35 },
  snow: { m: [1.04, 1.05, 1.12], d: 0.4, lift: 0.1 },
  fog: { m: [0.92, 0.93, 0.96], d: 0.35, lift: 0.18 },
};
function gradeOf(a: Partial<Grade>, kind: WeatherKind): Grade {
  const b = KIND_GRADE[kind];
  const ma = a.m ?? [1, 1, 1];
  const mb = b.m ?? [1, 1, 1];
  return {
    m: [ma[0] * mb[0], ma[1] * mb[1], ma[2] * mb[2]],
    d: 1 - (1 - (a.d ?? 0)) * (1 - (b.d ?? 0)),
    lift: Math.max(a.lift ?? 0, b.lift ?? 0),
    lights: a.lights ?? false,
    gain: (a.gain ?? 1) * (b.gain ?? 1),
  };
}
/**
 * The painting, or the frame of its loop due now, graded for an hour (`key` names the hour grade)
 * and a weather; cached per frame and pair, the cache emptied when it grows past a few grades.
 */
function graded(p: Painting, key: string, hour: Partial<Grade>, kind: WeatherKind, now: number): HTMLCanvasElement {
  const frame = p.loop && p.loopReady ? Math.floor((now / 1000) * LOOP_FPS) % LOOP_FRAMES : -1;
  const k = `${key}|${kind}|${frame}`;
  let cv = p.graded.get(k);
  if (cv) return cv;
  if (p.graded.size > 48) p.graded.clear();
  cv = document.createElement("canvas");
  cv.width = p.img.width;
  cv.height = p.img.height;
  const ctx = cv.getContext("2d")!;
  if (frame >= 0) ctx.drawImage(p.loop!, (frame % LOOP_COLS) * cv.width, Math.floor(frame / LOOP_COLS) * cv.height, cv.width, cv.height, 0, 0, cv.width, cv.height);
  else ctx.drawImage(p.img, 0, 0);
  if (Object.keys(hour).length || kind !== "clear") {
    const id = ctx.getImageData(0, 0, cv.width, cv.height);
    applyGrade(id.data, gradeOf(hour, kind));
    ctx.putImageData(id, 0, 0);
  }
  p.graded.set(k, cv);
  return cv;
}
/** A grade applied to RGBA pixels in place (the city pane's, and the menu windows' hour grade, menu-system §1.3). */
function applyGrade(d: Uint8ClampedArray, g: Grade): void {
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]!;
    let gg = d[i + 1]!;
    let b = d[i + 2]!;
    // Lit windows, headlights and neon stay lit when the light goes.
    if (g.lights && r > 180 && gg > 120 && b < 170 && r - b > 40) {
      d[i] = Math.min(255, r * 1.08);
      d[i + 1] = Math.min(255, gg * 1.04);
      continue;
    }
    const l = 0.299 * r + 0.587 * gg + 0.114 * b;
    r = (r + (l - r) * g.d) * g.m[0] * g.gain;
    gg = (gg + (l - gg) * g.d) * g.m[1] * g.gain;
    b = (b + (l - b) * g.d) * g.m[2] * g.gain;
    d[i] = Math.min(255, r + (255 - r) * g.lift);
    d[i + 1] = Math.min(255, gg + (255 - gg) * g.lift);
    d[i + 2] = Math.min(255, b + (255 - b) * g.lift);
  }
}
/** The menu windows' hour grade (menu-system §1.3): a scene's pixels taken to an hour band, in clear weather. */
export function gradeForBand(d: Uint8ClampedArray, band: Band): void {
  if (band === "golden") return; // the paintings are golden hour already
  applyGrade(d, gradeOf(BAND_GRADE[band], "clear"));
}

/** The sky for an hour (top, horizon), and the one the weather puts over it. */
const BAND_SKY: Record<Band, [string, string]> = {
  night: ["#0a0f2c", "#1f2a5a"],
  dawn: ["#3a3f7a", "#f2a56e"],
  morning: ["#4f86d4", "#cfe4f7"],
  midday: ["#3b7bd4", "#b9dcf7"],
  afternoon: ["#5a8fd8", "#f0d2a0"],
  golden: ["#6a3d7a", "#ff9a4a"],
  dusk: ["#262660", "#b8505e"],
};
const KIND_SKY: Partial<Record<WeatherKind, [string, string]>> = {
  rain: ["#4a5261", "#8e97a3"],
  storm: ["#2f3540", "#616a78"],
  snow: ["#9aa6b5", "#e3e8ee"],
  fog: ["#aeb6bf", "#d9dde2"],
  cloud: ["#6f7f99", "#b9c3d0"],
};
const NIGHT_KIND_SKY: Partial<Record<WeatherKind, [string, string]>> = {
  rain: ["#0e1220", "#232a3c"],
  storm: ["#090c16", "#1b2030"],
  snow: ["#1a2030", "#39435a"],
  fog: ["#1c2230", "#3a4150"],
  cloud: ["#0f1530", "#2a3350"],
};

let skyCv: HTMLCanvasElement | null = null;
/** Paints the hour's sky with its stars and drifting painted clouds through the painting's sky mask. */
function drawSky(ctx: CanvasRenderingContext2D, mask: HTMLCanvasElement, band: Band, kind: WeatherKind, now: number, alpha: number): void {
  const W = mask.width;
  const H = mask.height;
  if (!skyCv) skyCv = document.createElement("canvas");
  skyCv.width = W;
  skyCv.height = H;
  const s = skyCv.getContext("2d")!;
  const [top, hz] = (band === "night" ? NIGHT_KIND_SKY[kind] : KIND_SKY[kind]) ?? BAND_SKY[band];
  const grad = s.createLinearGradient(0, 0, 0, H * 0.62);
  grad.addColorStop(0, top);
  grad.addColorStop(1, hz);
  s.fillStyle = grad;
  s.fillRect(0, 0, W, H);
  if (band === "night" && (kind === "clear" || kind === "heat" || kind === "cloud")) {
    s.fillStyle = "#ffffff";
    for (let i = 0; i < 110; i++) {
      s.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now / 500 + i * 1.7));
      s.fillRect(Math.round(hash(i, 1, 91) * W), Math.round(hash(i, 2, 92) * H * 0.5), hash(i, 3, 93) < 0.2 ? 2 : 1, 1);
    }
    s.globalAlpha = 1;
  }
  const cloud = vfxSprite("cloud");
  if (cloud && kind !== "rain" && kind !== "storm" && kind !== "fog") {
    const n = kind === "cloud" ? 8 : kind === "snow" ? 6 : 4;
    s.imageSmoothingEnabled = true;
    for (let i = 0; i < n; i++) {
      const w = 90 + hash(i, 4, 94) * 180;
      const h = (w * cloud.fh) / cloud.fw;
      const x = ((now / (80 + hash(i, 5, 95) * 100) + hash(i, 6, 96) * (W + w)) % (W + w)) - w;
      const y = 6 + hash(i, 7, 97) * H * 0.3;
      s.globalAlpha = (kind === "cloud" ? 0.85 : kind === "snow" ? 0.6 : 0.5) * (band === "night" ? 0.3 : 1);
      s.drawImage(cloud.img, 0, 0, cloud.fw, cloud.fh, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }
    s.globalAlpha = 1;
  }
  s.globalCompositeOperation = "destination-in";
  s.drawImage(mask, 0, 0);
  s.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha;
  ctx.drawImage(skyCv, 0, 0);
  ctx.globalAlpha = 1;
}

export function CityPicture({ hub }: { hub: number }): JSX.Element {
  useData();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const g = S.game;
      if (!g) return;
      const at = g.w.net.hubs[hub]!;
      const minute = clockMin();
      const hour = (minute / 60) % 24;
      const wx = weatherAt(at.lon, at.lat, Math.floor(minute / 1440), hour, g.w.seed);
      const band = bandOf(hour);
      const kind = wx.kind;
      const base = painting(`cityviews/${at.id}.png`);
      if (!base) {
        ctx.fillStyle = "#1a1430";
        ctx.fillRect(0, 0, cv.width, cv.height);
        return;
      }
      const day = painting(`cityviews/${at.id}-day.png`);
      const night = painting(`cityviews/${at.id}-night.png`);
      const rain = painting(`cityviews/${at.id}-rain.png`);
      const snow = painting(`cityviews/${at.id}-snow.png`);
      const wet = kind === "rain" || kind === "storm" || kind === "fog";
      const clearish = kind === "clear" || kind === "heat";
      const daytime = band === "morning" || band === "midday" || band === "afternoon";
      // The painting nearest the hour and the weather, with the grade that takes it the rest of the way.
      let main = base;
      let key: string = band;
      let hourGrade: Partial<Grade> = BAND_GRADE[band];
      if (daytime && day) (main = day), (key = `day-${band}`), (hourGrade = DAY_GRADE[band] ?? {});
      if (kind === "snow" && snow && band !== "night") (main = snow), (key = "snow"), (hourGrade = {});
      else if (wet && rain && band !== "night") (main = rain), (key = "rain"), (hourGrade = {});
      if (band === "night" && night) (main = night), (key = "night-painted"), (hourGrade = {});
      // The golden-hour painting keeps its sky only at golden hour in clear weather, the day painting only in clear weather by day.
      const swapSky = (main === base && !(band === "golden" && clearish)) || (main === day && !clearish);
      ctx.drawImage(graded(main, key, hourGrade, kind, now), 0, 0);
      if (swapSky) {
        if (!main.mask) main.mask = skyMask(main.img);
        drawSky(ctx, main.mask, band, kind, now, 0.94);
      }
      // Crossfades: dusk into the night painting and dawn out of it; the last hour of the afternoon
      // into the golden hour and the first hour of the morning out of the dawn.
      let over: Painting | null = null;
      let overKey = "";
      let overGrade: Partial<Grade> = {};
      let alpha = 0;
      if (night && band === "dusk") (over = night), (overKey = "night-painted"), (alpha = Math.min(1, hour - 20));
      else if (night && band === "dawn") (over = night), (overKey = "night-painted"), (alpha = Math.max(0, 1 - (hour - 5) / 2));
      else if (main === day && band === "afternoon" && hour >= 17 && clearish) (over = base), (overKey = "golden"), (alpha = hour - 17);
      else if (main === day && band === "morning" && hour < 8) (over = base), (overKey = "dawn"), (overGrade = BAND_GRADE.dawn), (alpha = 1 - (hour - 7));
      if (over && alpha > 0.01) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(graded(over, overKey, overGrade, kind, now), 0, 0);
        if (over === base && !clearish) {
          if (!base.mask) base.mask = skyMask(base.img);
          drawSky(ctx, base.mask, band, kind, now, 0.94 * alpha);
        }
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [hub]);
  return <canvas ref={ref} class="pic" width={VIEW_W} height={VIEW_H} aria-hidden="true" />;
}
