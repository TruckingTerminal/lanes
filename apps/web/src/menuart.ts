import { ASSETS, hasAsset } from "./mapart.js";
import { bumpData } from "./state.js";

/**
 * The menu system's art (studio/specs/menu-system.md §5.2; UX's picks, ux-menu-picks-2026-11-14.md; the art role's pack,
 * art-menu-pack-2026-11-14.md): one `ui/kit.json` next to the page describes every atlas.
 * - `kit`, `fx`, `icons`, `badges`: `{image, w, h, pieces: {name: {x, y, w, h, …}}}`; frames and buttons carry `slice`
 *   (a number or [top, right, bottom, left]) for border-image; multi-frame pieces carry `frames`, `step`, `fps`.
 * - `windows`: `{family: {image, w, h, cells: {id: {x, y, w, h, focalX, focalY, avg}}}}`: the stills in family atlases
 *   (truck, shp, screens; the seasons autumn, winter, spring; dusk; night; heroes).
 * - `scenes`: the focal point and average colour of the existing scene stills (assets/scenes, inlined in the page).
 * - `loops`: `{id: {image, w, h, frames, cols, fps, live}}`, one sheet per window.
 * - `iuliia`: her breathing loop, the new faces and her backdrop colour.
 * Every `image` is a path under assets/. Nothing here waits on the art: every reader has a fallback (rule 4.6), and
 * the JSON reads as absent until it's next to the page.
 */
export interface Piece {
  x: number;
  y: number;
  w: number;
  h: number;
  frames?: number;
  step?: number;
  cols?: number;
  rowStep?: number;
  fps?: number;
  once?: boolean;
  /** Nine-slice insets in source px, for border-image: one number, or [top, right, bottom, left]. */
  slice?: number | [number, number, number, number];
  fill?: string;
  centre?: [number, number];
  radius?: number;
}
export interface Atlas {
  image: string;
  w: number;
  h: number;
  pieces: Record<string, Piece>;
}
export interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
  focalX: number;
  focalY: number;
  avg: string;
}
export interface Family {
  image: string;
  w: number;
  h: number;
  cells: Record<string, Cell>;
}
export interface LoopArt {
  image: string;
  w: number;
  h: number;
  frames: number;
  cols: number;
  fps: number;
  live?: boolean;
}
export interface KitJson {
  kit: Atlas;
  fx: Atlas;
  icons: Atlas;
  badges: Atlas;
  windows: Record<string, Family>;
  scenes: Record<string, { focalX: number; focalY: number; avg: string }>;
  loops: Record<string, LoopArt>;
  iuliia?: { breathe: LoopArt; faces: Record<string, string>; backdrop: string };
}

export const KIT_JSON = "ui/kit.json";
let kitJson: KitJson | null = null;
let asked = false;
/** The kit's JSON once read, else null (and a read started once the manifest says it's there). */
export function kitData(): KitJson | null {
  if (kitJson || asked) return kitJson;
  if (!hasAsset(KIT_JSON)) return null; // the manifest isn't read yet, or the kit isn't shipped: ask again later
  asked = true;
  fetch(ASSETS + KIT_JSON)
    .then((r) => (r.ok ? r.json() : null))
    .then((j: KitJson | null) => {
      kitJson = j;
      bumpData();
    })
    .catch(() => undefined);
  return null;
}
/** For tests: the kit as if read. */
export function setKitData(j: KitJson | null): void {
  kitJson = j;
  asked = j !== null;
}
export const atlasUrl = (image: string): string => ASSETS + image;

/** The painted families that hold a window's base still, in the order looked at. */
const BASE_FAMILIES = ["truck", "shp", "screens"];
export type Band = "night" | "dawn" | "morning" | "midday" | "afternoon" | "golden" | "dusk";
export type SeasonName = "summer" | "autumn" | "winter" | "spring";

/** Which painting a window shows now, and whether the hour grade still applies to it. */
export interface WindowPick {
  /** The atlas or scene image's URL, and the cell in it (a scene still is its own 256 × 144 image). */
  url: string;
  cell: { x: number; y: number; w: number; h: number };
  focalX: number;
  focalY: number;
  avg: string | null;
  /** A painted dusk or night still is already at its hour: no grade. */
  grade: boolean;
  /** The loop, only on the base painting (UX §3: "Loops play only on the base painting"), and only when shipped. */
  loop: LoopArt | null;
  /** Names the painting, for caches. */
  key: string;
}

/**
 * UX's rule (picks §3): the night still in the night band, the dusk still in dusk, else the season's still outside
 * summer, else the base painting with its loop. A window with no variant for the moment uses its base painting with
 * the hour grade. A name that isn't packed falls back to the existing scene of that name (its still inlined in the page,
 * `sceneStill`), whose seasons are in the season atlases now.
 */
export function pickWindow(k: KitJson | null, id: string, band: Band, season: SeasonName, sceneStill?: string, has: (path: string) => boolean = hasAsset): WindowPick | null {
  const fam = (f: string) => k?.windows?.[f];
  const inFamily = (f: string, cellId: string): WindowPick | null => {
    const F = fam(f);
    const c = F?.cells?.[cellId];
    if (!F || !c || !has(F.image)) return null;
    return { url: atlasUrl(F.image), cell: c, focalX: c.focalX, focalY: c.focalY, avg: c.avg, grade: true, loop: null, key: `${f}:${cellId}` };
  };
  if (band === "night") {
    const n = inFamily("night", id) ?? BASE_FAMILIES.map((f) => inFamily(f, `${id}-night`)).find((x) => x) ?? null;
    if (n) return { ...n, grade: false };
  }
  if (band === "dusk") {
    const d = inFamily("dusk", id);
    if (d) return { ...d, grade: false };
  }
  if (season !== "summer") {
    const s = inFamily(season, id);
    if (s) return s;
  }
  const loopArt = k?.loops?.[id];
  const loop = loopArt && has(loopArt.image) ? loopArt : null;
  const base = BASE_FAMILIES.map((f) => inFamily(f, id)).find((x) => x);
  if (base) return { ...base, loop };
  if (sceneStill) {
    const sc = k?.scenes?.[id];
    // The old scenes' loops are one row of 16 frames (tools/pack-loop.py).
    const sceneLoop = has(`scenes/${id}.loop.png`) ? { image: `scenes/${id}.loop.png`, w: 256, h: 144, frames: 16, cols: 16, fps: 8 } : null;
    return { url: sceneStill, cell: { x: 0, y: 0, w: 256, h: 144 }, focalX: sc?.focalX ?? 0.5, focalY: sc?.focalY ?? 0.5, avg: sc?.avg ?? null, grade: true, loop: sceneLoop, key: `scene:${id}` };
  }
  return null;
}

/**
 * A focal point as a fraction of the scene: the art role gives 0–1 fractions; scene pixels read the same.
 */
export function focalFraction(v: number, size: number): number {
  const f = v > 1 ? v / size : v;
  return Math.min(1, Math.max(0, f));
}

/**
 * The whole-number scale and crop of a scene in a box (§1.3, the pixel-art rule): scale = ceil(box width in device px
 * / scene width), then the box cut from the scaled scene around the focal point, kept inside the scene. All in device
 * pixels; the source rectangle in scene pixels.
 */
export function cropOf(sceneW: number, sceneH: number, boxW: number, boxH: number, focalX: number, focalY: number): { scale: number; sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(1, Math.ceil(boxW / sceneW), Math.ceil(boxH / sceneH));
  const sw = boxW / scale;
  const sh = boxH / scale;
  const fx = focalFraction(focalX, sceneW) * sceneW;
  const fy = focalFraction(focalY, sceneH) * sceneH;
  // Whole scene pixels, so every scene pixel lands on exactly `scale` device pixels, and never past the far edge.
  const sx = Math.min(Math.round(Math.max(0, fx - sw / 2)), Math.floor(sceneW - sw));
  const sy = Math.min(Math.round(Math.max(0, fy - sh / 2)), Math.floor(sceneH - sh));
  return { scale, sx, sy, sw, sh };
}

/** The nine-slice insets of a piece as CSS `border-image-slice` (source px) and widths. */
export function sliceOf(p: Piece): [number, number, number, number] {
  const s = p.slice ?? 0;
  return typeof s === "number" ? [s, s, s, s] : s;
}
