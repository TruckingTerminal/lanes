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
export const MAP_W = 1408;
export const MAP_H = 960;
/** The city sprites are drawn pixel for pixel at this many device pixels per level-0 art pixel. */
export const CITY_SCALE = 4;
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
  autumn: [level("autumn", 1, `${ASSETS}map/l0-autumn.png`)],
  winter: [level("winter", 1, `${ASSETS}map/l0-winter.png`)],
  spring: [level("spring", 1, `${ASSETS}map/l0-spring.png`)],
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
 * The painting to draw at `k` device pixels per level-0 art pixel: the season's own finest level,
 * or summer's when that is finer and the zoom is in (the view then washes it with the season).
 */
export function mapLevel(season: Season, k: number): { img: HTMLImageElement; scale: number; season: Season } | null {
  const own = pick(LEVELS[season], k);
  const summer = season === "summer" ? own : pick(LEVELS.summer, k);
  const best = own && summer && summer.scale > own.scale && k >= summer.scale ? summer : (own ?? summer);
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

const cities = new Map<string, Pic & { loop: boolean }>();
/** A hub's isometric city sprite once it has decoded: its 16-frame loop when one was painted, else the still. */
export function citySprite(hubId: string): Sprite | null {
  let p = cities.get(hubId);
  if (!p) {
    const loop = known(`${ASSETS}cities/${hubId}.loop.png`);
    if (!manifest) return null;
    p = { src: `${ASSETS}cities/${hubId}${loop ? ".loop" : ""}.png`, img: null, ready: false, loop };
    cities.set(hubId, p);
    load(p);
  }
  if (!p.ready) return null;
  const img = p.img!;
  return p.loop ? { img, fw: img.width / LOOP_COLS, fh: img.height / LOOP_COLS, frames: LOOP_COLS * LOOP_COLS, cols: LOOP_COLS } : { img, fw: img.width, fh: img.height, frames: 1, cols: 1 };
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
