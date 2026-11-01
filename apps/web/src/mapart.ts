import l0Summer from "../assets/map/l0-summer.png";
import { bumpData } from "./state.js";

/**
 * The painted map: the code-drawn base (map.ts, the real projection and data) repainted by
 * PixelLab as isometric tycoon ground in the painterly hand (tools/paint-map.py), one image
 * per level of the zoom pyramid and per season, plus one isometric city sprite per hub for the
 * closest zooms (tools/paint-cities.py). Level 0 is the country at MAP_W × MAP_H art pixels and
 * rides inside the page; level n is 2ⁿ× that and, like the cities, loads from `assets/` next to
 * the page (dist/site/assets on the test site, the artifact's published files on claude.ai).
 */
export const MAP_W = 1584;
export const MAP_H = 856;
/** The city sprites are drawn pixel for pixel at this many device pixels per level-0 art pixel. */
export const CITY_SCALE = 8;
/** The town sprites (128 px) are drawn pixel for pixel at this many device pixels per level-0 art pixel. */
export const TOWN_SCALE = 12;
export type TownKind = "plains" | "forest" | "desert" | "south" | "coast" | "rust";

export type Season = "summer" | "autumn" | "winter" | "spring";

/** Where the files next to the page live, relative to it. */
export const ASSETS = "assets/";

interface Pic {
  src: string;
  img: HTMLImageElement | null;
  ready: boolean;
}
interface Level extends Pic {
  scale: number;
  season: Season;
}

const level = (season: Season, scale: number, src: string): Level => ({ season, scale, src, img: null, ready: false });
const LEVELS: Record<Season, Level[]> = {
  summer: [level("summer", 1, l0Summer), level("summer", 2, `${ASSETS}map/l1-summer.png`)],
  autumn: [level("autumn", 1, `${ASSETS}map/l0-autumn.png`), level("autumn", 2, `${ASSETS}map/l1-autumn.png`)],
  winter: [level("winter", 1, `${ASSETS}map/l0-winter.png`), level("winter", 2, `${ASSETS}map/l1-winter.png`)],
  spring: [level("spring", 1, `${ASSETS}map/l0-spring.png`), level("spring", 2, `${ASSETS}map/l1-spring.png`)],
};

/** Whether a painted map ships in this build (the view then sizes the base to it). */
export const hasPaintedMap = (): boolean => LEVELS.summer.length > 0;

let onReady: (() => void) | null = null;
export function whenMapReady(f: () => void): void {
  onReady = f;
}

/** Which files are next to the page (assets/manifest.json, written by the build); null until it has been read. */
let manifest: Record<string, string[]> | null = null;
let manifestAsked = false;
function known(src: string): boolean {
  if (!manifestAsked) {
    manifestAsked = true;
    fetch(`${ASSETS}manifest.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: Record<string, string[]>) => {
        manifest = m;
        onReady?.();
        bumpData();
      })
      .catch(() => (manifest = {}));
  }
  if (!src.startsWith(ASSETS)) return true;
  if (!manifest) return false;
  const [sub, file] = src.slice(ASSETS.length).split("/");
  return (manifest[sub!] ?? []).includes(file!);
}

/** Whether a file (a path under assets/) is next to the page; false until the manifest has been read. */
export function hasAsset(path: string): boolean {
  return known(ASSETS + path);
}

function load(p: Pic): void {
  if (p.img || !known(p.src)) return;
  const img = new Image();
  img.onload = () => {
    p.ready = true;
    onReady?.();
  };
  img.src = p.src;
  p.img = img;
}

/** The finest decoded level of a set that is not drawn below its own pixels at `k`, else its coarsest. */
function pick(levels: Level[], k: number): Level | null {
  let best: Level | null = null;
  for (const l of levels) {
    load(l);
    if (!l.ready) continue;
    if (l.scale <= Math.max(1, k) || !best) best = l;
  }
  return best;
}

/**
 * The painting to draw at `k` device pixels per level-0 art pixel: the season's own finest level
 * (every season has both levels: level 1's seasons carry the level-0 painting's colour onto level
 * 1's detail, tools/season-l1.py), or summer's when that is finer and the zoom is in, which only
 * happens while a season's level 1 has not decoded yet (the view then washes it with the season).
 */
export function mapLevel(season: Season, k: number): { img: HTMLImageElement; scale: number; season: Season } | null {
  const own = pick(LEVELS[season], k);
  const summer = season === "summer" ? own : pick(LEVELS.summer, k);
  // Summer's finer level only once the season's own painting would be stretched 3× or more: its
  // real snow or leaves beat a washed summer until then.
  const best = own && summer && summer.scale > own.scale && k >= own.scale * 3 ? summer : (own ?? summer);
  return best ? { img: best.img!, scale: best.scale, season: best.season } : null;
}

/** A sprite, still or a loop: `frames` cells of `fw` × `fh` in `cols` columns of the image. */
export interface Sprite {
  img: HTMLImageElement;
  fw: number;
  fh: number;
  frames: number;
  cols: number;
}
/** The loops play at this many frames a second. */
export const LOOP_FPS = 8;
const LOOP_COLS = 4;

const sheets = new Map<string, Pic & { loop: boolean }>();
/** A sprite from a folder next to the page once it has decoded: its 16-frame 4 × 4 loop sheet when one was painted, else the still. */
function sheetSprite(path: string): Sprite | null {
  let p = sheets.get(path);
  if (!p) {
    const loop = known(`${ASSETS}${path}.loop.png`);
    if (!manifest) return null;
    p = { src: `${ASSETS}${path}${loop ? ".loop" : ""}.png`, img: null, ready: false, loop };
    sheets.set(path, p);
    load(p);
  }
  if (!p.ready) return null;
  const img = p.img!;
  return p.loop ? { img, fw: img.width / LOOP_COLS, fh: img.height / LOOP_COLS, frames: LOOP_COLS * LOOP_COLS, cols: LOOP_COLS } : { img, fw: img.width, fh: img.height, frames: 1, cols: 1 };
}
/** A hub's isometric city sprite once it has decoded: its 16-frame loop when one was painted, else the still. */
export const citySprite = (hubId: string): Sprite | null => sheetSprite(`cities/${hubId}`);
/**
 * A painted weather effect (assets/vfx, tools/vfx.sh): rain and snow as 256-wide tiles on
 * transparency that the map and the scenes scroll along the fall, a bank of fog and a cloud they
 * drift, and a lightning bolt; null until it has decoded (the code's own strokes stand in).
 */
export const vfxSprite = (name: "rain" | "snow" | "fog" | "cloud" | "bolt"): Sprite | null => sheetSprite(`vfx/${name}`);
/** Tiles a sprite's current frame over a rectangle at `scale`, clipped to it, the tiling shifted by (`ox`, `oy`) so it can scroll. */
export function tileSprite(ctx: CanvasRenderingContext2D, sp: Sprite, now: number, phase: number, x: number, y: number, w: number, h: number, scale: number, alpha: number, ox = 0, oy = 0): void {
  const [sx, sy] = spriteFrame(sp, now, phase);
  const tw = sp.fw * scale;
  const th = sp.fh * scale;
  const px = ((ox % tw) + tw) % tw;
  const py = ((oy % th) + th) % th;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = !Number.isInteger(scale);
  for (let ty = Math.floor((y - py) / th) * th + py; ty < y + h; ty += th) for (let tx = Math.floor((x - px) / tw) * tw + px; tx < x + w; tx += tw) ctx.drawImage(sp.img, sx, sy, sp.fw, sp.fh, Math.round(tx), Math.round(ty), Math.ceil(tw), Math.ceil(th));
  ctx.restore();
}
/** Falling rain from the painted tile: the tiling scrolls down the way the streaks fall. */
export function drawRain(ctx: CanvasRenderingContext2D, sp: Sprite, now: number, x: number, y: number, w: number, h: number, scale: number, alpha: number): void {
  tileSprite(ctx, sp, now, 0, x, y, w, h, scale, alpha, 0, now * 0.4 * scale);
}
/** Falling snow from the painted tile: a far layer, small and slow, under a near one that sways. */
export function drawSnow(ctx: CanvasRenderingContext2D, sp: Sprite, now: number, x: number, y: number, w: number, h: number, scale: number, alpha: number): void {
  tileSprite(ctx, sp, now, 0, x, y, w, h, scale * 0.6, alpha * 0.55, Math.sin(now / 2300) * 10 * scale, now * 0.05 * scale);
  tileSprite(ctx, sp, now, 0, x, y, w, h, scale, alpha, Math.sin(now / 1500) * 18 * scale + 70 * scale, now * 0.09 * scale);
}
/** The cell of a sprite to show at time `tMs`. */
export function spriteFrame(sp: Sprite, tMs: number, phase = 0): [number, number] {
  const i = sp.frames > 1 ? (Math.floor((tMs * LOOP_FPS) / 1000) + phase) % sp.frames : 0;
  return [(i % sp.cols) * sp.fw, Math.floor(i / sp.cols) * sp.fh];
}

const towns = new Map<TownKind, Pic>();
/** The generic small-town sprite of a kind once it has decoded. */
export function townSprite(kind: TownKind): HTMLImageElement | null {
  let p = towns.get(kind);
  if (!p) {
    p = { src: `${ASSETS}towns/${kind}.png`, img: null, ready: false };
    towns.set(kind, p);
    load(p);
  }
  return p.ready ? p.img : null;
}

/** Which town sprite a place gets, from where it is: the coast, the woods, the desert, the South, the old mill belt, or the plains. */
export function townKindAt(lon: number, lat: number, nearWater: boolean): TownKind {
  if (nearWater && (lon < -117 || lon > -82 || (lat < 31 && lon > -98))) return "coast";
  if ((lon < -120.5 && lat > 42) || (lat > 44.6 && lon < -82) || (lon < -104 && lon > -116 && lat > 37 && lat < 49 && lat > 40)) return "forest";
  if (lat < 37.5 && lon < -102) return "desert";
  if (lat > 39 && lon > -91 && lon < -70) return "rust";
  if (lat < 36.5 && lon > -97) return "south";
  return "plains";
}

let titlePic: Pic | null = null;
/** The title's long loop (assets/title/title.loop.png, 96 frames of 256 × 144 in 12 columns) once decoded. */
export function titleLoop(): HTMLImageElement | null {
  if (!titlePic) {
    if (!hasAsset("title/title.loop.png")) return null;
    titlePic = { src: `${ASSETS}title/title.loop.png`, img: null, ready: false };
    load(titlePic);
  }
  return titlePic.ready ? titlePic.img : null;
}
/** A side-view parallax (tools/title-parallax.py) whose last frame leads into its first, so nothing crossfades. */
export const TITLE_LOOP = { frames: 96, cols: 12, fps: 24, fade: 0 };

let loadingPic: Pic | null = null;
/** The loading screen's rig strip (16 frames of 256 × 72) once it has decoded. */
export function loadingStrip(): HTMLImageElement | null {
  if (!loadingPic) {
    if (!hasAsset("loading/rig.loop.png")) return null;
    loadingPic = { src: `${ASSETS}loading/rig.loop.png`, img: null, ready: false };
    load(loadingPic);
  }
  return loadingPic.ready ? loadingPic.img : null;
}

/** The season of an in-game month (1–12), for the seasonal paintings. */
export function seasonOf(month: number): Season {
  return month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";
}
