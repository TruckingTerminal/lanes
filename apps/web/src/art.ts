import type { Equipment, FacilityType, TractorTier } from "@lanes/config";
import { drawText, textWidth } from "./font.js";

/**
 * Every sprite in LANES is drawn here, in code, on one palette: "Interstate
 * Dusk" — night asphalt, sodium-vapor amber, sage plains, desert sand, chrome.
 * The palette is a set of hue-shifted ramps (shadows lean blue, highlights lean
 * warm), shapes are filled first and outlined afterward, and everything is drawn
 * at 1× then scaled by whole numbers, so every pixel stays square and crisp.
 */
export const PAL = {
  // Night and steel: the interface ramp.
  ink0: "#090c17",
  ink1: "#10172a",
  ink2: "#1a2340",
  ink3: "#283659",
  steel: "#45587c",
  fog: "#7b8db0",
  mist: "#b6c4dc",
  paper: "#ece4cf",
  white: "#fbf7ea",
  // Sodium light.
  gold: "#ffd96a",
  amber: "#f4a83c",
  amberD: "#c96a26",
  rust: "#9b3c26",
  clay: "#8f573a",
  red: "#d84a3a",
  redD: "#8e2a24",
  pink: "#ee9680",
  // Ground.
  sand: "#e0c48e",
  sandD: "#b8945f",
  desert: "#cf9f66",
  dune: "#f1dcab",
  sage: "#9ea36b",
  olive: "#707f3f",
  grass: "#5d8a44",
  grassD: "#44703a",
  forest: "#2f5a3a",
  forestD: "#203f2d",
  marsh: "#4d7a63",
  mtn: "#857870",
  mtnD: "#594c45",
  mtnL: "#a89b90",
  snow: "#e8eef3",
  // Water.
  seaD: "#112640",
  sea: "#18385a",
  seaL: "#2b5a7e",
  foam: "#5f93b4",
  teal: "#2f7f86",
  cyan: "#7fdcea",
  // Paint.
  blue: "#4070c8",
  blueD: "#2a4b8c",
  blueL: "#7fa0e4",
  lime: "#a9dc62",
  plum: "#6a3d70",
  violet: "#3b2a5e",
  chrome: "#dfe8f2",
  chromeD: "#9fb0c8",
} as const;

export type Color = string;

/** Linear blend of two hex colours. */
export function mix(a: Color, b: Color, t: number): Color {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${pa.map((v, i) => h(v + (pb[i]! - v) * t)).join("")}`;
}

/** A small pixel buffer: draw shapes, auto-outline, then turn into a canvas. */
export class Px {
  readonly px: (Color | null)[];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Array(w * h).fill(null);
  }
  set(x: number, y: number, c: Color | null): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
    return this;
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
  /** A checker-dithered rectangle: `share` of the pixels take colour `b`. */
  dither(x: number, y: number, w: number, h: number, a: Color, b: Color, share = 0.5): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, BAYER[((y + j) % 4) * 4 + ((x + i) % 4)]! < share ? b : a);
    return this;
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
  blit(src: Px, x: number, y: number): this {
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
      const c = src.get(i, j);
      if (c) this.set(x + i, y + j, c);
    }
    return this;
  }
  /** Outline every filled shape on its outside edge (4-neighbour). */
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
  /** A copy turned a quarter turn clockwise. */
  rot90(): Px {
    const out = new Px(this.h, this.w);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out.set(this.h - 1 - y, x, this.get(x, y));
    return out;
  }
  flipX(): Px {
    const out = new Px(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out.set(this.w - 1 - x, y, this.get(x, y));
    return out;
  }
  /** A copy turned 45° (nearest pixel), gaps closed, for the diagonal map sprites. */
  rot45(): Px {
    const n = Math.ceil((this.w + this.h) * 0.7071) + 2;
    const out = new Px(n, n);
    const cx = (this.w - 1) / 2;
    const cy = (this.h - 1) / 2;
    const ox = (n - 1) / 2;
    const oy = (n - 1) / 2;
    const k = Math.SQRT1_2;
    // Sample the source twice per pixel so thin shapes don't break into dots.
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y);
        if (!c) continue;
        for (const [sx, sy] of [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]] as const) {
          const dx = x + sx - cx;
          const dy = y + sy - cy;
          out.set(Math.round(ox + (dx - dy) * k), Math.round(oy + (dx + dy) * k), c);
        }
      }
    }
    return out;
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

export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

const cache = new Map<string, HTMLCanvasElement>();
function cached(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let cv = cache.get(key);
  if (!cv) cache.set(key, (cv = make()));
  return cv;
}
const urls = new Map<string, string>();
function cachedUrl(key: string, make: () => HTMLCanvasElement): string {
  let u = urls.get(key);
  if (!u) urls.set(key, (u = make().toDataURL()));
  return u;
}

// --- Frames: nine-slice borders for panels, cards, buttons and inputs ----------------

interface FrameSpec {
  /** Slice size in art pixels. */
  s: number;
  /** Ring colours from the outside in: [lit side, shaded side]. */
  rings: [Color, Color][];
  center: Color | null;
  /** Clip this many corner pixels for a rounded look. */
  round?: number;
  /** A two-pixel rivet this far in from each corner. */
  rivet?: number;
}

function frame(spec: FrameSpec): Px {
  const n = spec.s * 3;
  const p = new Px(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dl = x;
      const dt = y;
      const dr = n - 1 - x;
      const db = n - 1 - y;
      const d = Math.min(dl, dt, dr, db);
      if (spec.round && dl + dt < spec.round) continue;
      if (spec.round && dr + dt < spec.round) continue;
      if (spec.round && dl + db < spec.round) continue;
      if (spec.round && dr + db < spec.round) continue;
      const ring = spec.rings[d];
      if (ring) {
        const lit = dt === d || (dl === d && db !== d);
        p.set(x, y, lit ? ring[0] : ring[1]);
      } else if (spec.center) p.set(x, y, spec.center);
    }
  }
  if (spec.rivet !== undefined) {
    const r = spec.rivet;
    for (const [rx, ry] of [[r, r], [n - 2 - r, r], [r, n - 2 - r], [n - 2 - r, n - 2 - r]] as const) {
      p.set(rx, ry, PAL.mist).set(rx + 1, ry, PAL.fog).set(rx, ry + 1, PAL.fog).set(rx + 1, ry + 1, PAL.ink1);
    }
  }
  return p;
}

const FRAMES: Record<string, FrameSpec> = {
  panel: { s: 6, rings: [[PAL.ink0, PAL.ink0], [PAL.steel, PAL.ink1], [PAL.ink3, PAL.ink3], [PAL.ink3, PAL.ink3], [PAL.ink1, PAL.ink1]], center: PAL.ink2, round: 1, rivet: 2 },
  hud: { s: 4, rings: [[PAL.ink0, PAL.ink0], [PAL.steel, PAL.ink1], [PAL.ink3, PAL.ink3]], center: PAL.ink2, round: 1 },
  map: { s: 6, rings: [[PAL.ink0, PAL.ink0], [PAL.steel, PAL.ink1], [PAL.ink3, PAL.ink3], [PAL.ink3, PAL.ink3], [PAL.ink1, PAL.ink1], [PAL.ink0, PAL.ink0]], center: null, round: 1, rivet: 2 },
  card: { s: 4, rings: [[PAL.ink3, PAL.ink3], [PAL.ink0, PAL.steel]], center: PAL.ink1, round: 1 },
  cardSel: { s: 4, rings: [[PAL.cyan, PAL.cyan], [PAL.teal, PAL.teal]], center: PAL.ink1, round: 1 },
  cardAlert: { s: 4, rings: [[PAL.red, PAL.red], [PAL.redD, PAL.redD]], center: PAL.ink1, round: 1 },
  cardMine: { s: 4, rings: [[PAL.lime, PAL.lime], [PAL.olive, PAL.olive]], center: PAL.ink1, round: 1 },
  btn: { s: 3, rings: [[PAL.ink0, PAL.ink0], [PAL.fog, PAL.ink1]], center: PAL.ink3, round: 1 },
  btnHover: { s: 3, rings: [[PAL.ink0, PAL.ink0], [PAL.mist, PAL.ink2]], center: PAL.steel, round: 1 },
  btnDown: { s: 3, rings: [[PAL.ink0, PAL.ink0], [PAL.ink1, PAL.steel]], center: PAL.ink2, round: 1 },
  btnPrimary: { s: 3, rings: [[PAL.ink0, PAL.ink0], [PAL.gold, PAL.rust]], center: PAL.amber, round: 1 },
  btnPrimaryHover: { s: 3, rings: [[PAL.ink0, PAL.ink0], [PAL.white, PAL.amberD]], center: PAL.gold, round: 1 },
  btnPrimaryDown: { s: 3, rings: [[PAL.ink0, PAL.ink0], [PAL.rust, PAL.gold]], center: PAL.amberD, round: 1 },
  input: { s: 3, rings: [[PAL.ink3, PAL.ink3], [PAL.ink0, PAL.ink3]], center: PAL.ink0, round: 1 },
  ticker: { s: 4, rings: [[PAL.ink0, PAL.ink0], [PAL.ink3, PAL.ink3], [PAL.ink1, PAL.ink1]], center: PAL.ink0, round: 1 },
  toast: { s: 4, rings: [[PAL.gold, PAL.amberD], [PAL.amberD, PAL.rust]], center: PAL.ink0, round: 1 },
  toastErr: { s: 4, rings: [[PAL.pink, PAL.redD], [PAL.red, PAL.redD]], center: PAL.ink0, round: 1 },
  tip: { s: 3, rings: [[PAL.amber, PAL.amberD], [PAL.ink0, PAL.ink0]], center: PAL.ink0, round: 1 },
  choice: { s: 4, rings: [[PAL.ink3, PAL.ink3], [PAL.ink1, PAL.ink1]], center: PAL.ink1, round: 1 },
  choiceOn: { s: 4, rings: [[PAL.amber, PAL.amberD], [PAL.ink1, PAL.ink1]], center: PAL.ink2, round: 1 },
  load: { s: 4, rings: [[PAL.ink3, PAL.ink3], [PAL.ink2, PAL.ink0]], center: PAL.ink1, round: 1 },
  bar: { s: 2, rings: [[PAL.ink3, PAL.ink3]], center: PAL.ink0 },
};

/** The frame as a 2× data URL, for `border-image`. */
export function frameUrl(kind: keyof typeof FRAMES): string {
  return cachedUrl(`frame|${kind}`, () => frame(FRAMES[kind]!).canvas(2));
}

/**
 * Puts every frame and a few sprites on the root element as CSS variables, so the
 * stylesheet can wear them. Called once at boot.
 */
export function installTheme(): void {
  const root = document.documentElement.style;
  for (const k of Object.keys(FRAMES)) root.setProperty(`--f-${k}`, `url("${frameUrl(k)}")`);
  root.setProperty("--f-panel-s", `${FRAMES.panel!.s * 2}px`);
  root.setProperty("--asphalt", `url("${asphaltUrl()}")`);
  root.setProperty("--sky", `url("${skyUrl()}")`);
}

/** A tiling asphalt texture for the page background. */
function asphaltUrl(): string {
  return cachedUrl("asphalt", () => {
    const p = new Px(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const h = hash2(x, y, 5);
      p.set(x, y, h < 0.06 ? PAL.ink2 : h < 0.1 ? PAL.ink0 : PAL.ink1);
    }
    return p.canvas(2);
  });
}

/** A dithered night-sky gradient for the title page. */
function skyUrl(): string {
  return cachedUrl("sky", () => {
    const p = new Px(4, 64);
    for (let y = 0; y < 64; y++) {
      const t = y / 63;
      const a = t < 0.5 ? PAL.ink0 : PAL.ink1;
      const b = t < 0.5 ? PAL.ink1 : PAL.ink2;
      const share = (t % 0.5) * 2;
      for (let x = 0; x < 4; x++) p.set(x, y, BAYER[(y % 4) * 4 + x]! < share ? b : a);
    }
    return p.canvas(4);
  });
}

function hash2(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// --- Trucks (side view, for cards and the title scene) ------------------------------

/** Cab paint by tractor tier; the NPC lessor's trucks are fleet white with a blue band. */
const CAB_PAINT: Record<TractorTier | "lease", { body: Color; shade: Color; hi: Color; trim: Color }> = {
  workhorse: { body: PAL.red, shade: PAL.redD, hi: PAL.pink, trim: PAL.chromeD },
  highwayPro: { body: PAL.blue, shade: PAL.blueD, hi: PAL.blueL, trim: PAL.chrome },
  flagship: { body: PAL.ink2, shade: PAL.ink1, hi: PAL.steel, trim: PAL.gold },
  lease: { body: PAL.paper, shade: PAL.mist, hi: PAL.white, trim: PAL.blue },
};

/** A 7 × 7 wheel; `turn` moves the hub highlight so the wheels roll in animation. */
function wheel(p: Px, x: number, y: number, turn = 0): void {
  p.stamp(x, y, [".ttttt.", "ttrrrtt", "trhhhrt", "trhhhrt", "trhhhrt", "ttrrrtt", ".ttttt."], { t: PAL.ink1, r: PAL.fog, h: PAL.mist });
  const spots: [number, number][] = [[3, 2], [4, 3], [3, 4], [2, 3]];
  const [sx, sy] = spots[turn % 4]!;
  p.set(x + sx, y + sy, PAL.white);
  p.set(x + 3, y + 3, PAL.steel);
}

/** A long-nose conventional tractor with a sleeper, facing right: 34 × 26, ground at y + 25. */
function drawTractor(p: Px, x: number, y: number, tier: TractorTier | "lease", turn = 0): void {
  const c = CAB_PAINT[tier];
  // Chrome stack with a heat shield, and the air horns on the roof.
  p.vline(x + 12, y + 1, 10, PAL.chrome).vline(x + 13, y + 2, 9, PAL.chromeD).set(x + 12, y + 0, PAL.fog);
  p.rect(x + 11, y + 5, 4, 3, PAL.steel).hline(x + 11, y + 5, 4, PAL.fog);
  p.hline(x + 15, y + 2, 3, PAL.chromeD).hline(x + 16, y + 3, 2, PAL.chromeD);
  // Sleeper: roof fairing, body, a small window, the stripe.
  p.rect(x + 1, y + 5, 11, 14, c.body).hline(x + 1, y + 5, 11, c.hi).hline(x + 1, y + 6, 11, c.hi).rect(x + 1, y + 16, 11, 3, c.shade);
  p.rect(x + 2, y + 4, 10, 1, c.shade).rect(x + 3, y + 3, 8, 1, c.body);
  p.rect(x + 3, y + 8, 3, 3, PAL.steel).hline(x + 3, y + 8, 3, PAL.mist);
  // Cab: tall window with a sky reflection, door line, grab handle.
  p.rect(x + 12, y + 4, 9, 15, c.body).hline(x + 12, y + 4, 9, c.hi).rect(x + 12, y + 16, 9, 3, c.shade);
  p.rect(x + 13, y + 6, 7, 6, PAL.steel).rect(x + 13, y + 6, 7, 2, PAL.mist).rect(x + 17, y + 6, 3, 1, PAL.white).vline(x + 19, y + 7, 5, PAL.fog);
  p.vline(x + 20, y + 5, 14, c.shade).vline(x + 15, y + 12, 5, c.shade).set(x + 16, y + 13, PAL.chrome);
  // Sun visor and the mirror out front.
  p.hline(x + 13, y + 5, 9, c.shade);
  p.rect(x + 21, y + 7, 2, 4, PAL.ink1).set(x + 21, y + 7, PAL.steel);
  // Long hood sloping to a chrome grille, headlights and turn signal.
  p.rect(x + 21, y + 11, 11, 8, c.body).hline(x + 21, y + 11, 11, c.hi).rect(x + 21, y + 16, 11, 3, c.shade);
  p.rect(x + 22, y + 10, 9, 1, c.hi).set(x + 24, y + 9, c.trim).set(x + 25, y + 9, c.trim);
  p.rect(x + 32, y + 12, 2, 6, PAL.chrome).vline(x + 33, y + 12, 6, PAL.chromeD).set(x + 32, y + 14, PAL.chromeD).set(x + 32, y + 16, PAL.chromeD);
  p.set(x + 31, y + 14, PAL.gold).set(x + 31, y + 15, PAL.white).set(x + 31, y + 17, PAL.amber);
  // Trim stripe along the whole rig, bumper, steps, fuel tank, mud flaps.
  p.hline(x + 1, y + 13, 20, c.trim);
  p.rect(x + 29, y + 19, 5, 2, PAL.chrome).hline(x + 29, y + 20, 5, PAL.chromeD);
  p.rect(x + 13, y + 19, 3, 1, PAL.steel);
  p.rect(x + 13, y + 20, 9, 3, PAL.chrome).hline(x + 13, y + 21, 9, PAL.chromeD).hline(x + 13, y + 22, 9, PAL.steel);
  p.rect(x + 0, y + 19, 2, 5, PAL.ink1).set(x + 0, y + 19, PAL.ink2);
  // Frame rail, fifth wheel, wheels.
  p.hline(x + 0, y + 19, 30, PAL.ink1).hline(x + 1, y + 20, 11, PAL.ink2);
  p.rect(x + 3, y + 17, 6, 2, PAL.ink1);
  wheel(p, x + 2, y + 19, turn);
  wheel(p, x + 9, y + 19, turn);
  wheel(p, x + 25, y + 19, turn);
}

/** A 54 × 26 trailer, to the tractor's left; ground at y + 25. */
function drawTrailer(p: Px, x: number, y: number, kind: Equipment, stripe: Color, turn = 0): void {
  if (kind === "flatbed") {
    // Deck and headboard, then the load: steel coils under straps and a tarped stack.
    p.rect(x, y + 14, 52, 2, PAL.mtnD).hline(x, y + 14, 52, PAL.mtnL).hline(x, y + 16, 52, PAL.ink1);
    p.rect(x + 50, y + 6, 2, 8, PAL.steel).vline(x + 51, y + 6, 8, PAL.fog);
    for (let i = 0; i < 2; i++) {
      const bx = x + 4 + i * 13;
      p.rect(bx, y + 6, 11, 8, PAL.mtn).rect(bx + 1, y + 7, 9, 6, PAL.mtnL).rect(bx + 3, y + 9, 5, 2, PAL.mtnD);
      p.vline(bx + 5, y + 5, 9, PAL.amberD).hline(bx, y + 5, 11, PAL.amberD);
    }
    p.rect(x + 31, y + 4, 17, 10, PAL.olive).hline(x + 31, y + 4, 17, PAL.sage).rect(x + 31, y + 11, 17, 3, PAL.forestD);
    p.vline(x + 35, y + 4, 10, PAL.amberD).vline(x + 43, y + 4, 10, PAL.amberD);
  } else {
    // Box: roof, corrugated sides, the company stripe, a rear door seam with hinges, DOT tape.
    p.rect(x, y + 1, 52, 15, PAL.paper).hline(x, y + 1, 52, PAL.white).hline(x, y + 2, 52, PAL.white).rect(x, y + 14, 52, 2, PAL.mist);
    for (let i = 3; i < 50; i += 3) p.vline(x + i, y + 3, 11, PAL.mist);
    p.vline(x + 1, y + 2, 13, PAL.fog).set(x + 1, y + 4, PAL.steel).set(x + 1, y + 11, PAL.steel);
    p.rect(x + 3, y + 8, 47, 2, stripe).hline(x + 3, y + 10, 47, mix(stripe, PAL.ink0, 0.35));
    for (let i = 2; i < 52; i += 4) p.hline(x + i, y + 15, 2, i % 8 === 2 ? PAL.red : PAL.white);
    if (kind === "reefer") {
      // Refrigeration unit on the nose, a frost-blue band.
      p.rect(x + 48, y + 2, 4, 8, PAL.chromeD).vline(x + 49, y + 3, 6, PAL.steel).vline(x + 51, y + 3, 6, PAL.chrome).rect(x + 48, y + 2, 4, 1, PAL.chrome);
      p.hline(x + 3, y + 4, 45, PAL.cyan).hline(x + 3, y + 5, 45, PAL.teal);
    }
  }
  // Frame, landing gear, mud flaps, underride guard, tandem axles.
  p.hline(x, y + 16, 52, PAL.ink1).hline(x + 2, y + 17, 48, PAL.ink2);
  p.rect(x + 40, y + 17, 2, 6, PAL.steel).set(x + 40, y + 22, PAL.fog);
  p.rect(x + 17, y + 18, 2, 5, PAL.ink1);
  p.rect(x, y + 17, 2, 5, PAL.ink1).set(x, y + 21, PAL.steel);
  wheel(p, x + 3, y + 19, turn);
  wheel(p, x + 10, y + 19, turn);
}

/** The whole rig: 86 × 28 with its outline. `turn` (0–3) rolls the wheels. */
export function truckSprite(tier: TractorTier, trailer: Equipment, leased: boolean, stripe: Color, scale = 2, turn = 0): HTMLCanvasElement {
  return cached(`truck|${tier}|${trailer}|${leased}|${stripe}|${scale}|${turn}`, () => {
    const p = new Px(86, 28);
    drawTrailer(p, 1, 1, trailer, stripe, turn);
    drawTractor(p, 49, 1, leased ? "lease" : tier, turn);
    return p.outline().canvas(scale);
  });
}

/** The rig for the title road scene. */
export function bigRig(scale: number, turn = 0): HTMLCanvasElement {
  return truckSprite("highwayPro", "van", false, PAL.amber, scale, turn);
}

// --- Facilities ----------------------------------------------------------------

export function facilitySprite(type: FacilityType, scale = 2): HTMLCanvasElement {
  return cached(`fac|${type}|${scale}`, () => {
    const p = new Px(38, 26);
    if (type === "warehouse") {
      // A long dock building: tan walls, a dark roof lip, four dock doors with bumpers.
      p.rect(1, 7, 36, 17, PAL.sandD).hline(1, 7, 36, PAL.sand).hline(1, 8, 36, PAL.sand).rect(1, 5, 36, 2, PAL.clay).hline(1, 5, 36, PAL.rust);
      for (let i = 0; i < 4; i++) {
        const dx = 3 + i * 9;
        p.rect(dx, 12, 7, 12, PAL.steel).hline(dx, 14, 7, PAL.fog).hline(dx, 17, 7, PAL.fog).hline(dx, 20, 7, PAL.fog);
        p.rect(dx - 1, 23, 9, 1, PAL.ink1);
      }
      p.rect(2, 9, 34, 2, PAL.amber);
      p.hline(1, 24, 36, PAL.ink3);
    } else if (type === "coldStorage") {
      // A white box with a teal band, snowflake badge, rooftop compressors.
      p.rect(1, 6, 36, 18, PAL.white).hline(1, 6, 36, PAL.white).rect(1, 11, 36, 3, PAL.teal).hline(1, 11, 36, PAL.cyan);
      p.stamp(15, 15, ["c..c..c", ".c.c.c.", "..ccc..", "ccccccc", "..ccc..", ".c.c.c.", "c..c..c"], { c: PAL.cyan });
      p.rect(3, 17, 7, 7, PAL.steel).hline(3, 19, 7, PAL.fog).rect(28, 17, 7, 7, PAL.steel).hline(28, 19, 7, PAL.fog);
      p.rect(26, 2, 6, 4, PAL.fog).hline(26, 2, 6, PAL.mist).rect(6, 3, 5, 3, PAL.fog).hline(6, 3, 5, PAL.mist);
      p.hline(1, 24, 36, PAL.mist);
    } else {
      // A plant: sawtooth roof, brick walls, a tall stack, lit windows.
      p.rect(1, 11, 36, 13, PAL.clay).rect(1, 21, 36, 3, PAL.rust).hline(1, 11, 36, PAL.sandD);
      for (let i = 0; i < 4; i++) p.stamp(1 + i * 9, 5, ["k........", "kk.......", "kkk......", "kkkk.....", "kkkkk....", "kkkkkkkkk"], { k: PAL.mtnD });
      for (let i = 0; i < 4; i++) p.stamp(2 + i * 9, 6, ["m.......", "mm......", "mmm.....", "mmmm...."], { m: PAL.mtn });
      p.rect(29, 0, 4, 11, PAL.mtn).vline(29, 0, 11, PAL.mtnL).hline(29, 0, 4, PAL.mist).hline(29, 1, 4, PAL.red).hline(29, 2, 4, PAL.white);
      for (let i = 0; i < 6; i++) p.rect(3 + i * 6, 14, 3, 4, i % 2 ? PAL.amber : PAL.gold);
      p.rect(16, 18, 6, 6, PAL.ink3).hline(16, 18, 6, PAL.steel);
    }
    return p.outline().canvas(scale);
  });
}

// --- Icons ------------------------------------------------------------------------

const K: Record<string, Color> = {
  k: PAL.ink0, d: PAL.ink2, D: PAL.ink3, s: PAL.steel, f: PAL.fog, m: PAL.mist, w: PAL.white, p: PAL.paper,
  a: PAL.amber, A: PAL.amberD, g: PAL.gold, r: PAL.red, R: PAL.redD, l: PAL.lime, L: PAL.grass, c: PAL.cyan, t: PAL.teal,
  b: PAL.blue, B: PAL.blueD, n: PAL.sandD, N: PAL.sand, o: PAL.clay, e: PAL.olive, h: PAL.chrome, H: PAL.chromeD,
};

/** 12 × 12 icons for the top bar and the tabs. */
const ICONS12: Record<string, string[]> = {
  fd: ["...gggggg...", "..gggggggg..", ".ggAAAAAAgg.", "ggAggggggAgg", "gAgggAAAAgAg", "gAggAggggAAg", "gAggAAAgggAg", "gAggAggggAAg", "gAgggggggAAg", ".gAAAAAAAAg.", "..gAAAAAAg..", "...AAAAAA..."],
  miles: ["....BBBB....", "..BBwwwwBB..", ".BwwwwwwwwB.", ".BwwBwwBwwB.", "BwwwBwwBwwwB", "BwwwBBBBwwwB", "BwwwBwwBwwwB", "BwwwBwwBwwwB", ".BwwwwwwwwB.", ".BBwwwwwwBB.", "..BBBBBBBB..", "....BBBB...."],
  usd: ["....llll....", "..llllllll..", ".llLLLLLLll.", "llLLlllLLLll", "lLLlLLLLLLLl", "lLLlllllLLLl", "lLLLLLLlLLLl", "lLLLLLLlLLLl", "lLLlllllLLLl", ".lLLLlllLLl.", "..llllllll..", "....llll...."],
  clock: ["....aaaa....", "..aappppaa..", ".appppppppa.", ".apppkppppa.", "appppkpppppa", "appppkkkpppa", "apppppppkppa", "appppppppppa", ".appppppppa.", ".appppppppa.", "..aappppaa..", "....aaaa...."],
  truck: ["............", "............", "pppppppp.rr.", "pwwwwwwp.rrr", "pwwwwwwprrmr", "pwwwwwwprrrr", "pwwwwwwprrrr", "pppppppphhhh", "kkkkkkkkkkkk", ".kk.kk...kk.", ".kk.kk...kk.", "............"],
  board: ["....sss.....", "..pppsppp...", ".ppppppppp..", ".pkkkkkkkp..", ".ppppppppp..", ".pkkkkpppp..", ".ppppppppp..", ".pkkkkkkpp..", ".ppppppppp..", ".pkkkppppp..", ".ppppppppp..", "............"],
  people: ["...mm...mm..", "..mmmm.mmmm.", "..mmmm.mmmm.", "...mm...mm..", "..bbbb.bbbb.", ".bbbbbbbbbbb", ".bbbbbbbbbbb", ".bbbbbbbbbbb", ".bbbbbbbbbbb", ".bbbbbbbbbbb", "............", "............"],
  tag: ["......aaaaa.", ".....aaaaaga", "....aaaaagka", "...aaaaaaaaa", "..aaaaaaaaa.", ".aaaaaaaaa..", "aaaaaaaaa...", "aaaaaaaa....", "aaaaaaa.....", ".aaaaa......", "..aaa.......", "............"],
  money: ["............", ".lllllllllll", ".lLLLLLLLLLl", ".lLlLLlLLlLl", ".lLLLlllLLLl", ".lLLLlllLLLl", ".lLlLLlLLlLl", ".lLLLLLLLLLl", ".lllllllllll", "...kkkkkkkkk", "...kkkkkkkkk", "............"],
  building: ["....ssss....", "...ssssss...", "..ssssssss..", ".ssssssssss.", ".sggssggssg.", ".ssssssssss.", ".sggssggssg.", ".ssssssssss.", ".sggssggssg.", ".ssssssssss.", ".ssssDDssss.", ".ssssDDssss."],
  book: ["............", ".AAAAAAAAAA.", ".AppppppppA.", ".ApkkkkkkpA.", ".ApppppppppA", ".ApkkkkkppA.", ".ApppppppppA", ".ApkkkkkkpA.", ".ApppppppppA", ".AAAAAAAAAA.", "..kkkkkkkk..", "............"],
  alert: [".....rr.....", "....rrrr....", "....rkkr....", "...rrkkrr...", "...rrkkrr...", "..rrrkkrrr..", "..rrrkkrrr..", ".rrrrrrrrrr.", ".rrrrkkrrrr.", "rrrrrkkrrrrr", "rrrrrrrrrrrr", "............"],
  home: [".....rr.....", "....rrrr....", "...rrrrrr...", "..rrrrrrrr..", ".rrrrrrrrrr.", "rrrrrrrrrrrr", ".ppppppppppp", ".ppppkkpppp.", ".ppppkkpppp.", ".ppppkkpppp.", ".ppppkkpppp.", "............"],
  pin: ["....cccc....", "...cccccc...", "..cccccccc..", "..cckkkkcc..", "..cckkkkcc..", "..cccccccc..", "...cccccc...", "....cccc....", "....cccc....", ".....cc.....", ".....cc.....", "............"],
  moon: ["....pppp....", "..pppp......", ".pppp.......", ".ppp........", "pppp........", "pppp........", "pppp........", "pppp........", ".ppp........", ".pppp.......", "..pppp......", "....pppp...."],
  sun: [".....gg.....", "..g..gg..g..", "...gggggg...", "..gggggggg..", ".ggggggggg..", "gggggggggggg", "gggggggggggg", ".ggggggggg..", "..gggggggg..", "...gggggg...", "..g..gg..g..", ".....gg....."],
  fuel: ["..rrrrrr....", "..rwwwwr.k..", "..rwwwwr..k.", "..rrrrrr..k.", "..rrrrrr..k.", "..rrrrrr..k.", "..rrrrrr.k..", "..rrrrrrk...", "..rrrrrr....", "..rrrrrr....", ".kkkkkkkk...", "............"],
  wrench: ["........hh..", ".......hhhh.", "......hh.hh.", ".....hhhhhh.", "....hhhhh...", "...hhhhh....", "..hhhhh.....", ".hhhhh......", "hhhhh.......", "hhhh........", "hh..........", "............"],
};

/** 8 × 8 glyphs for the speed buttons and the zoom controls. */
const ICONS8: Record<string, string[]> = {
  pause: ["........", ".pp..pp.", ".pp..pp.", ".pp..pp.", ".pp..pp.", ".pp..pp.", ".pp..pp.", "........"],
  play: ["........", ".pp.....", ".pppp...", ".pppppp.", ".pppppp.", ".pppp...", ".pp.....", "........"],
  ff: ["........", "p...p...", "pp..pp..", "ppp.ppp.", "ppp.ppp.", "pp..pp..", "p...p...", "........"],
  fff: ["........", "p..p..p.", "pp.pp.pp", "pp.pp.pp", "pp.pp.pp", "pp.pp.pp", "p..p..p.", "........"],
  plus: ["........", "...pp...", "...pp...", ".pppppp.", ".pppppp.", "...pp...", "...pp...", "........"],
  minus: ["........", "........", "........", ".pppppp.", ".pppppp.", "........", "........", "........"],
  fit: ["pp....pp", "p......p", "........", "...pp...", "...pp...", "........", "p......p", "pp....pp"],
  star: ["...g....", "...g....", "..ggg...", "ggggggg.", ".ggggg..", "..ggg...", ".gg.gg..", ".g...g.."],
  full: ["pppp....", "p.......", "p..pp...", "p..pp..p", "p......p", "...pp..p", ".......p", "....pppp"],
  x: ["........", ".p....p.", "..p..p..", "...pp...", "...pp...", "..p..p..", ".p....p.", "........"],
};

export function icon(name: string, scale = 2): HTMLCanvasElement {
  return cached(`icon|${name}|${scale}`, () => {
    const rows = ICONS12[name] ?? ICONS8[name] ?? ICONS8.star!;
    const n = rows.length;
    return new Px(n, n).stamp(0, 0, rows, K).canvas(scale);
  });
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

// --- The logo ----------------------------------------------------------------------

const LOGO: string[] = [
  "XXX.......  ..XXXXX..  XXX....XXX  XXXXXXXXX  .XXXXXXXX",
  "XXX.......  .XXXXXXX.  XXXX...XXX  XXXXXXXXX  XXXXXXXXX",
  "XXX.......  XXX...XXX  XXXXX..XXX  XXX......  XXX......",
  "XXX.......  XXX...XXX  XXXXXX.XXX  XXX......  XXX......",
  "XXX.......  XXX...XXX  XXX.XXXXXX  XXXXXXX..  .XXXXXXX.",
  "XXX.......  XXXXXXXXX  XXX..XXXXX  XXXXXXX..  ..XXXXXXX",
  "XXX.......  XXXXXXXXX  XXX...XXXX  XXX......  ......XXX",
  "XXX.......  XXX...XXX  XXX....XXX  XXX......  ......XXX",
  "XXXXXXXXX.  XXX...XXX  XXX....XXX  XXXXXXXXX  XXXXXXXXX",
  "XXXXXXXXX.  XXX...XXX  XXX....XXX  XXXXXXXXX  XXXXXXXX.",
];

/** "LANES" in chromed pixel letters with a deep extrusion; 1× is 59 × 15. */
export function logo(scale: number): HTMLCanvasElement {
  return cached(`logo|${scale}`, () => {
    const rowColor = [PAL.white, PAL.white, PAL.gold, PAL.gold, PAL.paper, PAL.amber, PAL.amber, PAL.amberD, PAL.amberD, PAL.rust];
    const w = LOGO[0]!.length;
    const h = LOGO.length;
    const depth = 3;
    const p = new Px(w + depth + 2, h + depth + 2);
    // Extrusion first, darkest at the bottom.
    for (let d = depth; d >= 1; d--) {
      const c = d === depth ? PAL.ink0 : d === 2 ? PAL.redD : PAL.rust;
      LOGO.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] === "X") p.set(x + 1 + d, y + 1 + d, c);
      });
    }
    LOGO.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === "X") p.set(x + 1, y + 1, rowColor[y]!);
    });
    // A glint on the top-left of each letter.
    for (let x = 0; x < w; x++) if (LOGO[0]![x] === "X" && LOGO[0]![x - 1] !== "X") p.set(x + 1, 1, PAL.cyan);
    return p.outline(PAL.ink0).canvas(scale);
  });
}

// --- Title scene ----------------------------------------------------------------

const SCENE_W = 320;
const SCENE_H = 180;
export const TITLE_W = SCENE_W;
export const TITLE_H = SCENE_H;

/** Ridge heights, built once. */
const RIDGE_FAR = Array.from({ length: SCENE_W + 1 }, (_, x) => 10 + Math.round(6 * Math.sin(x / 23) + 4 * Math.sin(x / 7.3 + 1) + 3 * Math.sin(x / 3.1)));
const RIDGE_NEAR = Array.from({ length: SCENE_W + 1 }, (_, x) => 4 + Math.round(3 * Math.sin(x / 17 + 2) + 2 * Math.sin(x / 5.1)));

/**
 * The title card: dusk over the high desert, a two-lane blacktop running to the
 * horizon, a billboard, poles ticking past, and a rig rolling under the sodium
 * lights. 320 × 180, drawn at `scale`.
 */
export function drawTitleScene(ctx: CanvasRenderingContext2D, scale: number, tMs: number): void {
  const W = SCENE_W;
  const H = SCENE_H;
  ctx.imageSmoothingEnabled = false;
  const fill = (x: number, y: number, w: number, h: number, c: Color) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x) * scale, Math.round(y) * scale, Math.max(1, Math.round(w)) * scale, Math.max(1, Math.round(h)) * scale);
  };
  const dot = (x: number, y: number, c: Color) => fill(x, y, 1, 1, c);
  const horizon = 104;
  // Sky: eight bands, each dithering into the next.
  const bands: [number, Color][] = [
    [0, PAL.ink0], [14, PAL.ink1], [30, PAL.violet], [46, PAL.plum], [60, PAL.rust], [74, PAL.amberD], [86, PAL.amber], [96, PAL.gold],
  ];
  for (let b = 0; b < bands.length; b++) {
    const [y0, a] = bands[b]!;
    const y1 = b + 1 < bands.length ? bands[b + 1]![0] : horizon;
    const c = b + 1 < bands.length ? bands[b + 1]![1] : PAL.gold;
    for (let y = y0; y < y1; y++) {
      fill(0, y, W, 1, a);
      const share = (y - y0) / (y1 - y0);
      for (let x = 0; x < W; x++) if (BAYER[(y % 4) * 4 + (x % 4)]! < share * share) dot(x, y, c);
    }
  }
  // Stars that twinkle, and a crescent moon.
  for (let i = 0; i < 70; i++) {
    const sx = (i * 97 + 13) % W;
    const sy = (i * 53) % 46;
    const on = (Math.floor(tMs / 500) + i) % 9 !== 0;
    if (on) dot(sx, sy, i % 4 === 0 ? PAL.white : i % 3 === 0 ? PAL.paper : PAL.mist);
    if (i % 11 === 0 && on) {
      dot(sx + 1, sy, PAL.fog);
      dot(sx, sy + 1, PAL.fog);
    }
  }
  ctx.drawImage(icon("moon", scale), 258 * scale, 14 * scale);
  // The setting sun, cut by heat haze.
  const sunX = 196;
  const sunY = 96;
  for (let y = -16; y <= 16; y++) {
    const half = Math.floor(Math.sqrt(256 - y * y));
    if (sunY + y >= horizon - 1) continue;
    if (y > 4 && y % 3 === 0) continue;
    fill(sunX - half, sunY + y, half * 2, 1, y < -8 ? PAL.white : y < -2 ? PAL.gold : PAL.amber);
  }
  // Far ridge, then the nearer one.
  for (let x = 0; x < W; x++) {
    const h = RIDGE_FAR[x]!;
    fill(x, horizon - h, 1, h, PAL.violet);
    if (h > 16) dot(x, horizon - h, PAL.plum);
  }
  for (let x = 0; x < W; x++) fill(x, horizon - RIDGE_NEAR[x]!, 1, RIDGE_NEAR[x]!, PAL.plum);
  // Mesas with strata.
  const mesa = (x0: number, w: number, h: number) => {
    fill(x0, horizon - h, w, h, PAL.rust);
    fill(x0 - 3, horizon - h + 3, 3, h - 3, PAL.rust);
    fill(x0 + w, horizon - h + 2, 4, h - 2, PAL.rust);
    fill(x0 - 1, horizon - h, w + 2, 1, PAL.amberD);
    for (let y = horizon - h + 4; y < horizon; y += 4) fill(x0 - 3, y, w + 7, 1, PAL.clay);
    fill(x0 + w + 2, horizon - h + 5, 2, h - 5, PAL.redD);
  };
  mesa(22, 36, 22);
  mesa(84, 16, 12);
  mesa(236, 44, 26);
  mesa(296, 14, 9);
  // Desert floor, sagebrush, a fence.
  fill(0, horizon, W, H - horizon, PAL.clay);
  for (let y = horizon; y < H; y++) {
    const k = (y - horizon) / (H - horizon);
    for (let x = 0; x < W; x++) {
      const h = hash2(x, y, 1);
      if (h < 0.08 + k * 0.1) dot(x, y, PAL.rust);
      else if (h > 0.985 - k * 0.01) dot(x, y, PAL.sandD);
    }
  }
  for (let i = 0; i < 26; i++) {
    const k = ((i * 0.618) % 1) ** 1.6;
    const y = horizon + 3 + k * (H - horizon - 6);
    const x = (i * 131 + 40) % W;
    if (Math.abs(x - 160) < 20 + k * 70) continue;
    const s = 1 + Math.round(k * 2);
    fill(x, y - s, s + 1, s, PAL.olive);
    dot(x + 1, y - s - 1, PAL.sage);
  }
  // The road in perspective: shoulders, asphalt, edge lines and the moving centre dash.
  const vanishX = 160;
  for (let y = horizon; y < H; y++) {
    const k = (y - horizon) / (H - horizon);
    const half = 2 + k * k * 150 + k * 10;
    fill(vanishX - half - 2 - k * 6, y, half * 2 + 4 + k * 12, 1, PAL.sandD);
    fill(vanishX - half, y, half * 2, 1, k < 0.15 ? PAL.ink3 : PAL.ink2);
    if (k > 0.1) {
      fill(vanishX - half, y, Math.max(1, k * 2), 1, PAL.paper);
      fill(vanishX + half - Math.max(1, k * 2), y, Math.max(1, k * 2), 1, PAL.paper);
    }
    const phase = (tMs / 30) % 24;
    const z = 1 / Math.max(0.02, k);
    if (((z * 3 + phase / 4) % 2) < 0.9 && k > 0.06) fill(vanishX - Math.max(0.5, k * 1.5), y, Math.max(1, k * 3), 1, PAL.gold);
  }
  // Power poles on the right, ticking toward the viewer.
  for (let i = 0; i < 7; i++) {
    const k = (((tMs / 5000) + i / 7) % 1) ** 2.2;
    const y = horizon + k * (H - horizon);
    const x = vanishX + 8 + k * 185;
    const h = 6 + k * 60;
    fill(x, y - h, 1 + k * 2, h, PAL.ink1);
    fill(x - 2 - k * 4, y - h + 1 + k * 3, 5 + k * 10, 1, PAL.ink1);
    if (k > 0.3) {
      dot(x - 1 - k * 4, y - h + k * 3, PAL.fog);
      dot(x + 3 + k * 7, y - h + k * 3, PAL.fog);
    }
  }
  // A billboard on the left shoulder.
  const bb = { x: 18, y: 68, w: 70, h: 24 };
  fill(bb.x + 30, bb.y + bb.h, 3, 30, PAL.mtnD);
  fill(bb.x + 36, bb.y + bb.h, 3, 30, PAL.mtnD);
  fill(bb.x - 1, bb.y - 1, bb.w + 2, bb.h + 2, PAL.ink0);
  fill(bb.x, bb.y, bb.w, bb.h, PAL.ink2);
  fill(bb.x + 1, bb.y + 1, bb.w - 2, 1, PAL.ink3);
  drawText(ctx, "ONE WORLD", (bb.x + 5) * scale, (bb.y + 4) * scale, scale, PAL.gold);
  drawText(ctx, "ON THE REAL", (bb.x + 5) * scale, (bb.y + 12) * scale, scale, PAL.paper);
  drawText(ctx, "CLOCK", (bb.x + 5) * scale, (bb.y + 20) * scale, scale, PAL.paper);
  fill(bb.x + 2, bb.y - 4, 3, 3, PAL.amber);
  fill(bb.x + bb.w - 5, bb.y - 4, 3, 3, PAL.amber);
  // The rig, rolling: bob a pixel, wheels turning, exhaust and dust.
  const turn = Math.floor(tMs / 90) % 4;
  const rig = bigRig(scale, turn);
  const bob = Math.floor(tMs / 220) % 2;
  const rigX = 118;
  const rigY = H - 46 + bob;
  // Headlight cone and the glow on the road.
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 40; i++) fill(rigX + 84 + i, rigY + 14 - i * 0.12, 1, 6 + i * 0.5, PAL.gold);
  ctx.globalAlpha = 1;
  ctx.drawImage(rig, rigX * scale, rigY * scale);
  for (let i = 0; i < 4; i++) {
    const age = ((tMs / 700) + i / 4) % 1;
    const px = rigX + 61 - age * 10;
    const py = rigY - 2 - age * 14;
    const c = age < 0.5 ? PAL.fog : PAL.steel;
    fill(px, py, 2 + age * 3, 1 + age * 2, c);
  }
  for (let i = 0; i < 6; i++) {
    const age = ((tMs / 500) + i / 6) % 1;
    dot(rigX + 2 - age * 14 + (i % 3), rigY + 25 - age * 4, age < 0.5 ? PAL.sand : PAL.sandD);
  }
  // Foreground: a mile marker and a cactus.
  fill(292, 138, 2, 24, PAL.paper);
  fill(291, 136, 4, 6, PAL.grass);
  drawText(ctx, "1", 291 * scale, 143 * scale, scale, PAL.ink0);
  fill(14, 128, 4, 40, PAL.grassD);
  fill(8, 136, 4, 14, PAL.grassD);
  fill(8, 136, 10, 3, PAL.grassD);
  fill(20, 142, 4, 12, PAL.grass);
  fill(14, 142, 10, 3, PAL.grass);
  fill(15, 128, 1, 40, PAL.grass);
  for (let y = 130; y < 168; y += 3) dot(13, y, PAL.paper);
}

/** Used by the loading bar: a little rig at `share` along a road. */
export function drawLoadingRoad(ctx: CanvasRenderingContext2D, scale: number, share: number, tMs: number): void {
  const W = Math.floor(ctx.canvas.width / scale);
  const H = Math.floor(ctx.canvas.height / scale);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PAL.ink1;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const road = H - 10;
  ctx.fillStyle = PAL.ink2;
  ctx.fillRect(0, road * scale, W * scale, 8 * scale);
  ctx.fillStyle = PAL.gold;
  const phase = Math.floor(tMs / 60) % 12;
  for (let x = -phase; x < W; x += 12) ctx.fillRect(x * scale, (road + 4) * scale, 6 * scale, scale);
  ctx.fillStyle = PAL.amber;
  ctx.fillRect(0, (road - 1) * scale, Math.round(W * share) * scale, scale);
  const rig = bigRig(scale, Math.floor(tMs / 90) % 4);
  ctx.drawImage(rig, Math.round(Math.min(W - 84, share * (W - 84))) * scale, (road - 24) * scale);
  drawText(ctx, `${Math.round(share * 100)}%`, 2 * scale, 2 * scale, scale, PAL.paper);
  void textWidth;
}
