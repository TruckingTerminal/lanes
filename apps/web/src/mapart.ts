import l0Summer from "../assets/map/l0-summer.png";

/**
 * The painted map: the code-drawn base (map.ts, the real projection and data) repainted by
 * PixelLab as isometric tycoon ground in the painterly hand (tools/paint-map.py), one image
 * per level of the zoom pyramid. Level 0 is the country at MAP_W × MAP_H art pixels; level n
 * is 2ⁿ× that. The view draws the highest level whose scale fits the zoom.
 */
export const MAP_W = 1408;
export const MAP_H = 960;

export type Season = "summer" | "autumn" | "winter" | "spring";

interface Level {
  scale: number;
  src: string;
  img: HTMLImageElement | null;
  ready: boolean;
}

const LEVELS: Record<Season, Level[]> = {
  summer: [{ scale: 1, src: l0Summer, img: null, ready: false }],
  autumn: [],
  winter: [],
  spring: [],
};

/** Whether a painted map ships in this build (the view then sizes the base to it). */
export const hasPaintedMap = (): boolean => LEVELS.summer.length > 0;

let onReady: (() => void) | null = null;
export function whenMapReady(f: () => void): void {
  onReady = f;
}

function load(l: Level): void {
  if (l.img) return;
  const img = new Image();
  img.onload = () => {
    l.ready = true;
    onReady?.();
  };
  img.src = l.src;
  l.img = img;
}

/** The painted image to draw at `k` device pixels per level-0 art pixel, with its scale, or null until one has decoded. */
export function mapLevel(season: Season, k: number): { img: HTMLImageElement; scale: number } | null {
  const levels = LEVELS[season].length ? LEVELS[season] : LEVELS.summer;
  let pick: Level | null = null;
  for (const l of levels) {
    load(l);
    if (!l.ready) continue;
    // The finest level that is not drawn below its own pixels, else the coarsest available.
    if (l.scale <= Math.max(1, k) || !pick) pick = l;
  }
  return pick ? { img: pick.img!, scale: pick.scale } : null;
}

/** The season of an in-game month (1–12), for the seasonal paintings. */
export function seasonOf(month: number): Season {
  return month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";
}
