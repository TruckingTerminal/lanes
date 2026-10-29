import l0Summer from "../assets/map/l0-summer.png";

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

export type Season = "summer" | "autumn" | "winter" | "spring";

const ASSETS = "assets/";

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

function load(p: Pic): void {
  if (p.img) return;
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

const cities = new Map<string, Pic>();
/** A hub's isometric city sprite once it has decoded (loading starts on the first ask). */
export function citySprite(hubId: string): HTMLImageElement | null {
  let p = cities.get(hubId);
  if (!p) {
    p = { src: `${ASSETS}cities/${hubId}.png`, img: null, ready: false };
    cities.set(hubId, p);
    load(p);
  }
  return p.ready ? p.img : null;
}

/** The season of an in-game month (1–12), for the seasonal paintings. */
export function seasonOf(month: number): Season {
  return month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";
}
