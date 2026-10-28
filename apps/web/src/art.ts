import type { Equipment, FacilityType, TractorTier } from "@lanes/config";

/**
 * Every sprite in LANES is drawn here, in code, on one palette: "Interstate
 * Dusk" — night asphalt, sodium-vapor amber, sage plains, desert sand, chrome.
 * Shapes are filled first and outlined automatically afterward, which keeps the
 * silhouettes crisp at any size. A pixel artist's sheet can replace any of these
 * functions without touching the game.
 */
export const PAL = {
  ink0: "#0a0d18",
  ink1: "#121829",
  ink2: "#1c2540",
  ink3: "#2b3a5a",
  steel: "#475a7c",
  fog: "#7d8fae",
  mist: "#b6c4d9",
  paper: "#ece5d3",
  white: "#f8f5ec",
  amber: "#f2a541",
  amberD: "#c4692a",
  gold: "#ffd36b",
  rust: "#9e3b2c",
  red: "#d6493a",
  redD: "#8c2a24",
  pink: "#e98a7c",
  sand: "#dcbc87",
  sandD: "#b0905e",
  desert: "#c99a64",
  clay: "#93583a",
  sage: "#9a9c66",
  olive: "#6f7f3c",
  grass: "#527c3c",
  grassD: "#3d6232",
  forest: "#2e5636",
  forestD: "#1f3d2c",
  mtn: "#7d7068",
  mtnD: "#544943",
  snow: "#e3ebf1",
  sea: "#1b3c5c",
  seaD: "#13293f",
  seaL: "#2d5d80",
  foam: "#5b8fae",
  blue: "#3f6fc4",
  blueD: "#294a8a",
  teal: "#2f7d84",
  cyan: "#7fdcea",
  lime: "#a6d65e",
  plum: "#6b3d6e",
} as const;

export type Color = string;

/** A small pixel buffer: draw shapes, auto-outline, then turn into a canvas. */
export class Px {
  readonly px: (Color | null)[];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Array(w * h).fill(null);
  }
  set(x: number, y: number, c: Color | null): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }
  get(x: number, y: number): Color | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x]!;
  }
  rect(x: number, y: number, w: number, h: number, c: Color): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }
  hline(x: number, y: number, w: number, c: Color): this {
    return this.rect(x, y, w, 1, c);
  }
  vline(x: number, y: number, h: number, c: Color): this {
    return this.rect(x, y, 1, h, c);
  }
  /** Rows of characters through a key; "." is transparent. */
  stamp(x: number, y: number, rows: string[], key: Record<string, Color>): this {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]!;
        if (ch !== "." && key[ch]) this.set(x + i, y + j, key[ch]!);
      }
    });
    return this;
  }
  /** Outline every filled shape on its outside edge (4-neighbor). */
  outline(c: Color = PAL.ink0): this {
    const edge: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) edge.push(y * this.w + x);
      }
    }
    for (const i of edge) this.px[i] = c;
    return this;
  }
  canvas(scale = 1): HTMLCanvasElement {
    const cv = document.createElement("canvas");
    cv.width = this.w * scale;
    cv.height = this.h * scale;
    const ctx = cv.getContext("2d")!;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.px[y * this.w + x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return cv;
  }
}

const cache = new Map<string, HTMLCanvasElement>();
function cached(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let cv = cache.get(key);
  if (!cv) cache.set(key, (cv = make()));
  return cv;
}

// --- Trucks ------------------------------------------------------------------

/** Cab paint by tractor tier; the NPC lessor's trucks are fleet white with a blue band. */
const CAB_PAINT: Record<TractorTier | "lease", { body: Color; shade: Color; hi: Color; trim: Color }> = {
  workhorse: { body: PAL.red, shade: PAL.redD, hi: PAL.pink, trim: PAL.fog },
  highwayPro: { body: PAL.blue, shade: PAL.blueD, hi: "#7a9ee0", trim: PAL.mist },
  flagship: { body: PAL.ink2, shade: PAL.ink1, hi: PAL.steel, trim: PAL.gold },
  lease: { body: PAL.paper, shade: PAL.mist, hi: PAL.white, trim: PAL.blue },
};

function wheel(p: Px, x: number, y: number): void {
  p.stamp(x, y, [".ttt.", "ttrtt", "trhrt", "ttrtt", ".ttt."], { t: PAL.ink1, r: PAL.fog, h: PAL.mist });
}

/** A long-nose conventional tractor, facing right: 26 × 16. */
function drawTractor(p: Px, x: number, y: number, tier: TractorTier | "lease"): void {
  const c = CAB_PAINT[tier];
  // Exhaust stack and air horn.
  p.vline(x + 9, y, 7, PAL.mist).vline(x + 10, y + 1, 6, PAL.fog);
  // Sleeper.
  p.rect(x + 1, y + 3, 8, 8, c.body).hline(x + 1, y + 3, 8, c.hi).rect(x + 1, y + 9, 8, 2, c.shade);
  p.rect(x + 3, y + 5, 3, 2, c.shade);
  // Cab, with the window.
  p.rect(x + 11, y + 2, 6, 9, c.body).hline(x + 11, y + 2, 6, c.hi).rect(x + 11, y + 9, 6, 2, c.shade);
  p.rect(x + 12, y + 3, 4, 3, PAL.mist).set(x + 15, y + 3, PAL.white);
  p.set(x + 12, y + 5, PAL.fog);
  p.vline(x + 16, y + 3, 7, c.shade);
  // Long hood sloping to the grille.
  p.rect(x + 17, y + 5, 7, 6, c.body).hline(x + 17, y + 5, 7, c.hi).rect(x + 17, y + 9, 7, 2, c.shade);
  p.vline(x + 24, y + 5, 6, c.trim).set(x + 23, y + 6, PAL.gold);
  p.set(x + 22, y + 6, PAL.amber);
  // Bumper, fuel tank, trim stripe.
  p.hline(x + 21, y + 11, 5, PAL.mist);
  p.rect(x + 11, y + 11, 5, 2, PAL.mist).hline(x + 11, y + 12, 5, PAL.fog);
  p.hline(x + 1, y + 8, 23, c.trim);
  // Frame and wheels.
  p.hline(x + 1, y + 11, 24, PAL.ink1);
  wheel(p, x + 2, y + 11);
  wheel(p, x + 18, y + 11);
}

/** A 48 × 16 trailer, to the tractor's left. */
function drawTrailer(p: Px, x: number, y: number, kind: Equipment, stripe: Color): void {
  if (kind === "flatbed") {
    // Deck, then the load: steel coils or lumber under straps.
    p.rect(x, y + 9, 46, 2, PAL.mtnD).hline(x, y + 9, 46, PAL.mtn);
    for (let i = 0; i < 3; i++) {
      const bx = x + 3 + i * 14;
      p.rect(bx, y + 3, 11, 6, PAL.sand).hline(bx, y + 3, 11, PAL.paper).hline(bx, y + 6, 11, PAL.sandD);
      p.vline(bx + 5, y + 3, 6, PAL.amberD);
    }
  } else {
    const body = PAL.white;
    p.rect(x, y, 46, 11, body).hline(x, y, 46, PAL.white).rect(x, y + 9, 46, 2, PAL.mist);
    // Corrugation, rear door seam and a company stripe.
    for (let i = 3; i < 44; i += 4) p.vline(x + i, y + 1, 8, PAL.mist);
    p.vline(x + 1, y + 1, 9, PAL.fog);
    p.hline(x + 2, y + 6, 42, stripe).hline(x + 2, y + 7, 42, stripe);
    if (kind === "reefer") {
      // Refrigeration unit on the nose, frost-blue band.
      p.rect(x + 42, y + 1, 4, 7, PAL.fog).vline(x + 43, y + 2, 5, PAL.steel).vline(x + 45, y + 2, 5, PAL.mist);
      p.hline(x + 2, y + 2, 38, PAL.cyan);
    }
  }
  // Underride guard, landing gear, tandem axles at the back.
  p.hline(x, y + 11, 46, PAL.ink1);
  p.vline(x + 34, y + 11, 3, PAL.steel);
  wheel(p, x + 3, y + 11);
  wheel(p, x + 9, y + 11);
}

export function truckSprite(tier: TractorTier, trailer: Equipment, leased: boolean, stripe: Color, scale = 2): HTMLCanvasElement {
  return cached(`truck|${tier}|${trailer}|${leased}|${stripe}|${scale}`, () => {
    const p = new Px(72, 18);
    drawTrailer(p, 1, 1, trailer, stripe);
    drawTractor(p, 44, 0, leased ? "lease" : tier);
    return p.outline().canvas(scale);
  });
}

/** The tractor alone, for the title road scene. */
export function bigRig(scale: number): HTMLCanvasElement {
  return truckSprite("highwayPro", "van", false, PAL.amber, scale);
}

// --- Facilities ----------------------------------------------------------------

export function facilitySprite(type: FacilityType, scale = 2): HTMLCanvasElement {
  return cached(`fac|${type}|${scale}`, () => {
    const p = new Px(30, 22);
    if (type === "warehouse") {
      p.rect(1, 6, 28, 14, PAL.sandD).hline(1, 6, 28, PAL.sand).rect(1, 4, 28, 2, PAL.clay);
      for (let i = 0; i < 4; i++) p.rect(3 + i * 7, 11, 5, 9, PAL.steel).hline(3 + i * 7, 13, 5, PAL.fog).hline(3 + i * 7, 16, 5, PAL.fog);
      p.hline(1, 20, 28, PAL.ink3);
    } else if (type === "coldStorage") {
      p.rect(1, 5, 28, 15, PAL.white).hline(1, 5, 28, PAL.white).rect(1, 9, 28, 3, PAL.teal);
      p.stamp(12, 13, [".c.c.", "..c..", "ccccc", "..c..", ".c.c."], { c: PAL.cyan });
      p.rect(3, 15, 6, 5, PAL.steel).rect(21, 15, 6, 5, PAL.steel);
      p.rect(22, 2, 5, 3, PAL.fog);
    } else {
      // Sawtooth roof and a stack.
      p.rect(1, 9, 28, 11, PAL.clay).rect(1, 17, 28, 3, PAL.rust);
      for (let i = 0; i < 4; i++) p.stamp(1 + i * 7, 5, ["k......", "kk.....", "kkk....", "kkkk..."], { k: PAL.mtnD });
      p.rect(23, 0, 3, 9, PAL.mtn).hline(23, 0, 3, PAL.mist);
      for (let i = 0; i < 5; i++) p.rect(3 + i * 5, 12, 3, 3, PAL.amber);
    }
    return p.outline().canvas(scale);
  });
}

// --- Icons (8 × 8) ----------------------------------------------------------------

const ICONS: Record<string, { rows: string[]; key: Record<string, Color> }> = {
  fd: { rows: ["..gggg..", ".gGGGGg.", "gGg..gGg", "gGgg..Gg", "gG..ggGg", "gGg..gGg", ".gGGGGg.", "..gggg.."], key: { g: PAL.amberD, G: PAL.gold } },
  miles: { rows: ["bbbbbbbb", "bwwwwwwb", "bwbwwbwb", "bwbbbbwb", "bwbwwbwb", "bwwwwwwb", ".bwwwwb.", "..bbbb.."], key: { b: PAL.blueD, w: PAL.white } },
  usd: { rows: ["...g....", ".gggggg.", "gg.g....", ".ggggg..", "...g..gg", "gggggg..", "...g....", "........"], key: { g: PAL.lime } },
  wrench: { rows: ["....mm..", "...m..m.", "...m.m..", "..mmm...", ".mmm....", "mmm.....", "mm......", "........"], key: { m: PAL.mist } },
  clock: { rows: ["..aaaa..", ".a....a.", "a...p..a", "a...p..a", "a..pp..a", "a......a", ".a....a.", "..aaaa.."], key: { a: PAL.amber, p: PAL.paper } },
  pump: { rows: ["rrrr....", "rwwr.m..", "rwwr..m.", "rrrr..m.", "rrrr.m..", "rrrrm...", "rrrr....", "kkkk...."], key: { r: PAL.red, w: PAL.mist, m: PAL.fog, k: PAL.ink3 } },
  star: { rows: ["...g....", "...g....", "..ggg...", "ggggggg.", ".ggggg..", "..ggg...", ".gg.gg..", ".g...g.."], key: { g: PAL.gold } },
  pin: { rows: ["..aaa...", ".aGGGa..", ".aGkGa..", ".aGGGa..", "..aGa...", "..aGa...", "...a....", "........"], key: { a: PAL.ink0, G: PAL.cyan, k: PAL.ink0 } },
};

export function icon(name: keyof typeof ICONS | string, scale = 2): HTMLCanvasElement {
  return cached(`icon|${name}|${scale}`, () => {
    const spec = ICONS[name] ?? ICONS.star!;
    return new Px(8, 8).stamp(0, 0, spec.rows, spec.key).canvas(scale);
  });
}

const urls = new Map<string, string>();
function cachedUrl(key: string, make: () => HTMLCanvasElement): string {
  let u = urls.get(key);
  if (!u) urls.set(key, (u = make().toDataURL()));
  return u;
}

/** Sprites as data URIs, for <img> in panels. */
export function iconUrl(name: string, scale = 2): string {
  return cachedUrl(`icon|${name}|${scale}`, () => icon(name, scale));
}

export function truckUrl(tier: TractorTier, trailer: Equipment, leased: boolean, stripe: Color, scale = 2): string {
  return cachedUrl(`truck|${tier}|${trailer}|${leased}|${stripe}|${scale}`, () => truckSprite(tier, trailer, leased, stripe, scale));
}

export function facilityUrl(type: FacilityType, scale = 2): string {
  return cachedUrl(`fac|${type}|${scale}`, () => facilitySprite(type, scale));
}

// --- Title scene ----------------------------------------------------------------

/**
 * The title card: dusk over the high desert, a two-lane blacktop running to the
 * horizon, and a rig rolling under the sodium lights. 256 × 144, drawn at `scale`.
 */
export function drawTitleScene(ctx: CanvasRenderingContext2D, scale: number, tMs: number): void {
  const W = 256;
  const H = 144;
  ctx.imageSmoothingEnabled = false;
  const fill = (x: number, y: number, w: number, h: number, c: Color) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x) * scale, Math.round(y) * scale, Math.max(1, Math.round(w)) * scale, Math.max(1, Math.round(h)) * scale);
  };
  // Sky in dithered bands.
  const bands: [number, Color, Color][] = [
    [0, PAL.ink0, PAL.ink1],
    [18, PAL.ink1, PAL.ink2],
    [34, PAL.ink2, PAL.plum],
    [50, PAL.plum, PAL.rust],
    [62, PAL.rust, PAL.amberD],
    [72, PAL.amberD, PAL.amber],
  ];
  const horizon = 80;
  for (let b = 0; b < bands.length; b++) {
    const [y0, a, c] = bands[b]!;
    const y1 = b + 1 < bands.length ? bands[b + 1]![0] : horizon;
    for (let y = y0; y < y1; y++) {
      fill(0, y, W, 1, a);
      // Checker dither in the lower half of each band.
      if (y - y0 >= (y1 - y0) / 2) for (let x = (y % 2); x < W; x += 2) fill(x, y, 1, 1, c);
    }
  }
  // Stars.
  for (let i = 0; i < 40; i++) {
    const sx = (i * 97) % W;
    const sy = (i * 53) % 34;
    if ((Math.floor(tMs / 600) + i) % 7 !== 0) fill(sx, sy, 1, 1, i % 3 ? PAL.mist : PAL.white);
  }
  // Setting sun with horizontal cuts.
  const sunX = 176;
  const sunY = 72;
  for (let y = -14; y <= 14; y++) {
    const half = Math.floor(Math.sqrt(196 - y * y));
    if (sunY + y >= horizon) continue;
    if (y > 2 && y % 3 === 0) continue;
    fill(sunX - half, sunY + y, half * 2, 1, y < -4 ? PAL.gold : PAL.amber);
  }
  // Mesas.
  const mesa = (x0: number, w: number, h: number, c: Color) => {
    fill(x0, horizon - h, w, h, c);
    fill(x0 - 2, horizon - h + 2, 2, h - 2, c);
    fill(x0 + w, horizon - h + 3, 3, h - 3, c);
  };
  mesa(14, 30, 12, PAL.plum);
  mesa(66, 18, 8, PAL.plum);
  mesa(206, 34, 14, PAL.plum);
  mesa(30, 12, 6, PAL.rust);
  // Desert floor.
  fill(0, horizon, W, H - horizon, PAL.clay);
  for (let y = horizon; y < H; y += 2) for (let x = (y / 2) % 4; x < W; x += 4) fill(x, y, 1, 1, PAL.rust);
  // The road in perspective, with moving dashes.
  const vanishX = 128;
  for (let y = horizon; y < H; y++) {
    const k = (y - horizon) / (H - horizon);
    const half = 3 + k * 70;
    fill(vanishX - half, y, half * 2, 1, PAL.ink2);
    fill(vanishX - half, y, 1, 1, PAL.sand);
    fill(vanishX + half - 1, y, 1, 1, PAL.sand);
    const phase = (tMs / 40) % 16;
    if ((y * (1 + k * 2) + phase) % 16 < 8 * (0.4 + k)) fill(vanishX - Math.max(0.5, k * 2), y, Math.max(1, k * 4), 1, PAL.gold);
  }
  // Roadside lights.
  for (let i = 0; i < 4; i++) {
    const k = (((tMs / 3000) + i / 4) % 1) ** 2;
    const y = horizon + k * (H - horizon);
    const x = vanishX + 6 + k * 90;
    fill(x, y - 4 - k * 18, 1, 4 + k * 18, PAL.ink1);
    fill(x - 1, y - 5 - k * 18, 3, 1, PAL.gold);
  }
  // The rig, bobbing a pixel.
  const rig = truckSprite("highwayPro", "van", false, PAL.amber, scale);
  const bob = Math.floor(tMs / 180) % 2;
  ctx.drawImage(rig, 46 * scale, (H - 30 + bob) * scale);
}
