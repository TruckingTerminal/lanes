import poster from "../assets/title/title.png";
import sideBackUrl from "../assets/title/parallax/back.png";
import headBackUrl from "../assets/title/approach.png";
import atlasUrl from "../assets/title/sprites.png";
import { PAL } from "./art.js";
import { drawText, textWidth } from "./font.js";

/**
 * The title scene's poster, inside the page: the original painting (the truck where the head-on shot leaves it),
 * 256×144, shown until the shots below can play, and for good when motion is reduced.
 */
export const TITLE_FRAME_W = 256;
export const TITLE_FRAME_H = 144;
/** Milliseconds per inline frame. */
export const TITLE_FRAME_MS = 100;

const SRC = [poster];
let imgs: HTMLImageElement[] | null = null;
let decoded = 0;

/** The poster's frames once every one has decoded, else null (the code-drawn scene stands in). */
export function titleFrames(): HTMLImageElement[] | null {
  if (!imgs) {
    imgs = SRC.map((url) => {
      const im = new Image();
      im.onload = () => {
        decoded++;
      };
      im.src = url;
      return im;
    });
  }
  return decoded === imgs.length ? imgs : null;
}

/** The frame to show at time `tMs`, or null until the poster is ready. */
export function titleFrame(tMs: number): HTMLImageElement | null {
  const f = titleFrames();
  return f ? f[Math.floor(tMs / TITLE_FRAME_MS) % f.length]! : null;
}

// --- The two shots (Jeff, 2026-11-01) ------------------------------------------------------------------------
// Both are drawn live, every frame, from one sprite atlas (tools/title-sprites.py) and a schedule of dice that are a
// pure function of time: what passes, when and how fast is fixed by the slot it falls in, so nothing repeats on a
// cycle and there is no seam. Head-on: a still camera on the original painting; the painting's truck comes up its lane
// from the horizon at highway speed and passes, then pickups, sedans and more rigs come and go in both lanes, with
// birds, a train on the horizon, tumbleweeds and the diner's neon. Side view: the camera rides beside a cyan semi (its
// trailer drawn here, so the gap, the fifth wheel, the landing gear and both tandems are exact) while the road, the
// poles, the roadside and the traffic stream past at speeds set by distance. Each shot holds 20 s and fades into the
// other over a second; the first is head-on, picking up the painting's truck where the poster has it. On a screen of
// any other shape the 256 × 144 band keeps its pixel size and the sky grows above it and the ground below.

const SHOT_MS = 20_000;
const FADE_MS = 1_000;
const BW = 256; // the scene band
const BH = 144;
const V = 140; // the side view's road speed, art px a second (the rig's own, about 45 mph at this scale)
const FG = 1.5; // the ground in front of the road moves this much faster
const NIGHT: RGB = [9, 12, 23];

// <sprites> written by tools/title-sprites.py
const SPR: Record<string, readonly [number, number, number, number]> = {
  "diner": [0, 359, 108, 52],
  "grass": [468, 532, 25, 22],
  "pear": [425, 412, 29, 38],
  "pickup": [177, 562, 41, 20],
  "pickup-ne-0": [115, 614, 3, 2],
  "pickup-ne-1": [119, 614, 3, 2],
  "pickup-ne-10": [352, 602, 9, 6],
  "pickup-ne-11": [292, 602, 11, 7],
  "pickup-ne-12": [304, 602, 12, 7],
  "pickup-ne-13": [213, 602, 13, 8],
  "pickup-ne-14": [138, 602, 15, 9],
  "pickup-ne-15": [72, 602, 17, 10],
  "pickup-ne-16": [431, 584, 19, 12],
  "pickup-ne-17": [348, 584, 21, 13],
  "pickup-ne-18": [200, 584, 24, 15],
  "pickup-ne-19": [0, 584, 27, 17],
  "pickup-ne-2": [123, 614, 4, 2],
  "pickup-ne-20": [425, 562, 30, 18],
  "pickup-ne-21": [102, 562, 34, 21],
  "pickup-ne-22": [389, 532, 38, 23],
  "pickup-ne-23": [183, 532, 42, 26],
  "pickup-ne-24": [463, 498, 47, 29],
  "pickup-ne-25": [151, 498, 53, 33],
  "pickup-ne-26": [132, 459, 60, 37],
  "pickup-ne-27": [286, 412, 67, 41],
  "pickup-ne-28": [330, 359, 75, 46],
  "pickup-ne-29": [406, 359, 75, 46],
  "pickup-ne-3": [128, 614, 4, 2],
  "pickup-ne-4": [59, 614, 5, 3],
  "pickup-ne-5": [65, 614, 5, 3],
  "pickup-ne-6": [506, 602, 6, 4],
  "pickup-ne-7": [0, 614, 7, 4],
  "pickup-ne-8": [433, 602, 8, 5],
  "pickup-ne-9": [442, 602, 8, 5],
  "pickup-sw-0": [97, 614, 3, 2],
  "pickup-sw-1": [101, 614, 3, 2],
  "pickup-sw-10": [423, 602, 9, 5],
  "pickup-sw-11": [267, 602, 11, 7],
  "pickup-sw-12": [279, 602, 12, 7],
  "pickup-sw-13": [199, 602, 13, 8],
  "pickup-sw-14": [122, 602, 15, 9],
  "pickup-sw-15": [54, 602, 17, 10],
  "pickup-sw-16": [411, 584, 19, 12],
  "pickup-sw-17": [326, 584, 21, 13],
  "pickup-sw-18": [175, 584, 24, 15],
  "pickup-sw-19": [60, 584, 27, 16],
  "pickup-sw-2": [105, 614, 4, 2],
  "pickup-sw-20": [394, 562, 30, 18],
  "pickup-sw-21": [67, 562, 34, 21],
  "pickup-sw-22": [350, 532, 38, 23],
  "pickup-sw-23": [140, 532, 42, 26],
  "pickup-sw-24": [415, 498, 47, 29],
  "pickup-sw-25": [262, 498, 53, 32],
  "pickup-sw-26": [71, 459, 60, 37],
  "pickup-sw-27": [218, 412, 67, 41],
  "pickup-sw-28": [254, 359, 75, 46],
  "pickup-sw-29": [176, 359, 77, 47],
  "pickup-sw-3": [110, 614, 4, 2],
  "pickup-sw-4": [47, 614, 5, 3],
  "pickup-sw-5": [53, 614, 5, 3],
  "pickup-sw-6": [491, 602, 6, 4],
  "pickup-sw-7": [498, 602, 7, 4],
  "pickup-sw-8": [405, 602, 8, 5],
  "pickup-sw-9": [414, 602, 8, 5],
  "rocks": [0, 562, 36, 21],
  "sage": [116, 498, 34, 33],
  "saguaro": [256, 459, 22, 35],
  "sedan": [117, 584, 35, 15],
  "sedan-ne-0": [156, 614, 3, 2],
  "sedan-ne-1": [160, 614, 3, 2],
  "sedan-ne-10": [481, 602, 9, 5],
  "sedan-ne-11": [374, 602, 10, 6],
  "sedan-ne-12": [385, 602, 11, 6],
  "sedan-ne-13": [330, 602, 12, 7],
  "sedan-ne-14": [242, 602, 14, 8],
  "sedan-ne-15": [171, 602, 16, 9],
  "sedan-ne-16": [21, 602, 18, 11],
  "sedan-ne-17": [474, 584, 20, 12],
  "sedan-ne-18": [370, 584, 22, 13],
  "sedan-ne-19": [254, 584, 25, 15],
  "sedan-ne-2": [164, 614, 4, 2],
  "sedan-ne-20": [88, 584, 28, 16],
  "sedan-ne-21": [456, 562, 31, 18],
  "sedan-ne-22": [219, 562, 35, 20],
  "sedan-ne-23": [428, 532, 39, 23],
  "sedan-ne-24": [226, 532, 44, 26],
  "sedan-ne-25": [0, 532, 50, 29],
  "sedan-ne-26": [205, 498, 56, 33],
  "sedan-ne-27": [193, 459, 62, 36],
  "sedan-ne-28": [354, 412, 70, 41],
  "sedan-ne-29": [0, 412, 78, 46],
  "sedan-ne-3": [169, 614, 4, 2],
  "sedan-ne-4": [174, 614, 4, 2],
  "sedan-ne-5": [91, 614, 5, 3],
  "sedan-ne-6": [25, 614, 6, 4],
  "sedan-ne-7": [32, 614, 6, 4],
  "sedan-ne-8": [39, 614, 7, 4],
  "sedan-ne-9": [472, 602, 8, 5],
  "sedan-sw-0": [133, 614, 3, 2],
  "sedan-sw-1": [137, 614, 3, 2],
  "sedan-sw-10": [451, 602, 9, 5],
  "sedan-sw-11": [461, 602, 10, 5],
  "sedan-sw-12": [362, 602, 11, 6],
  "sedan-sw-13": [317, 602, 12, 7],
  "sedan-sw-14": [227, 602, 14, 8],
  "sedan-sw-15": [154, 602, 16, 9],
  "sedan-sw-16": [90, 602, 18, 10],
  "sedan-sw-17": [0, 602, 20, 11],
  "sedan-sw-18": [451, 584, 22, 12],
  "sedan-sw-19": [300, 584, 25, 14],
  "sedan-sw-2": [141, 614, 4, 2],
  "sedan-sw-20": [225, 584, 28, 15],
  "sedan-sw-21": [28, 584, 31, 17],
  "sedan-sw-22": [282, 562, 35, 19],
  "sedan-sw-23": [137, 562, 39, 21],
  "sedan-sw-24": [305, 532, 44, 24],
  "sedan-sw-25": [89, 532, 50, 27],
  "sedan-sw-26": [358, 498, 56, 30],
  "sedan-sw-27": [327, 459, 62, 34],
  "sedan-sw-28": [0, 459, 70, 38],
  "sedan-sw-29": [139, 412, 78, 42],
  "sedan-sw-3": [146, 614, 4, 2],
  "sedan-sw-4": [151, 614, 4, 2],
  "sedan-sw-5": [71, 614, 5, 3],
  "sedan-sw-6": [77, 614, 6, 3],
  "sedan-sw-7": [84, 614, 6, 3],
  "sedan-sw-8": [8, 614, 7, 4],
  "sedan-sw-9": [16, 614, 8, 4],
  "tractor": [390, 459, 57, 33],
  "tractor-amber": [58, 498, 57, 33],
  "tractor-red": [448, 459, 57, 33],
  "tractor-white": [0, 498, 57, 33],
  "truck-sw-0": [397, 602, 7, 5],
  "truck-sw-1": [343, 602, 8, 6],
  "truck-sw-10": [488, 562, 23, 17],
  "truck-sw-11": [255, 562, 26, 19],
  "truck-sw-12": [37, 562, 29, 21],
  "truck-sw-13": [271, 532, 33, 24],
  "truck-sw-14": [51, 532, 37, 27],
  "truck-sw-15": [316, 498, 41, 30],
  "truck-sw-16": [279, 459, 47, 34],
  "truck-sw-17": [455, 412, 52, 38],
  "truck-sw-18": [79, 412, 59, 43],
  "truck-sw-19": [109, 359, 66, 48],
  "truck-sw-2": [257, 602, 9, 7],
  "truck-sw-20": [401, 273, 74, 54],
  "truck-sw-21": [317, 273, 83, 60],
  "truck-sw-22": [223, 273, 93, 68],
  "truck-sw-23": [118, 273, 104, 76],
  "truck-sw-24": [0, 273, 117, 85],
  "truck-sw-25": [314, 152, 131, 95],
  "truck-sw-26": [166, 152, 147, 107],
  "truck-sw-27": [0, 152, 165, 120],
  "truck-sw-28": [208, 0, 185, 135],
  "truck-sw-29": [0, 0, 207, 151],
  "truck-sw-3": [188, 602, 10, 8],
  "truck-sw-4": [109, 602, 12, 9],
  "truck-sw-5": [40, 602, 13, 10],
  "truck-sw-6": [495, 584, 15, 11],
  "truck-sw-7": [393, 584, 17, 12],
  "truck-sw-8": [280, 584, 19, 14],
  "truck-sw-9": [153, 584, 21, 15],
  "weed0": [318, 562, 18, 18],
  "weed1": [337, 562, 18, 18],
  "weed2": [356, 562, 18, 18],
  "weed3": [375, 562, 18, 18],
};
const TRACTOR = {"wheels": [[6.3, 28.9], [15.5, 28.9], [50.0, 28.9]], "r": 3.5, "fifth": 10.6, "frame": 22.5, "back": 22.5} as const;
const HEADS = [0.1, 0.1122, 0.1258, 0.1412, 0.1583, 0.1776, 0.1993, 0.2235, 0.2507, 0.2813, 0.3155, 0.3539, 0.397, 0.4454, 0.4996, 0.5604, 0.6287, 0.7052, 0.7911, 0.8874, 0.9955, 1.1167, 1.2527, 1.4052, 1.5763, 1.7683, 1.9836, 2.2251, 2.4961, 2.8] as const;
const HEAD_W1 = {"truck": 74, "pickup": 30, "sedan": 28} as const;
const PAINTED_AT = [160.0, 112] as const;
// </sprites>

type RGB = readonly [number, number, number];
type Ctx = CanvasRenderingContext2D;

let pics: HTMLImageElement[] | null = null;
function ready(): boolean {
  pics ??= [atlasUrl, sideBackUrl, headBackUrl].map((u) => {
    const im = new Image();
    im.src = u;
    return im;
  });
  return pics.every((p) => p.complete && p.naturalWidth > 0);
}
const atlas = (): HTMLImageElement => pics![0]!;

/** A fraction in [0, 1) fixed by its arguments: the schedule's dice, the same on every frame. */
function dice(...ns: number[]): number {
  let h = 0x811c9dc5;
  for (const n of ns) {
    h = Math.imul(h ^ (n | 0), 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}
const pick = <T>(xs: readonly T[], r: number): T => xs[Math.min(xs.length - 1, Math.floor(r * xs.length))]!;
const rgb = (c: RGB, a = 1): string => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);

/** Draws a sprite from the atlas with its top-left at (x, y), mirrored when it faces left. */
function spr(a: Ctx, name: string, x: number, y: number, flip = false): void {
  const r = SPR[name];
  if (!r) return;
  const [sx, sy, w, h] = r;
  if (flip) {
    a.save();
    a.translate(Math.round(x) + w, Math.round(y));
    a.scale(-1, 1);
    a.drawImage(atlas(), sx, sy, w, h, 0, 0, w, h);
    a.restore();
  } else a.drawImage(atlas(), sx, sy, w, h, Math.round(x), Math.round(y), w, h);
}
const sw = (name: string): number => SPR[name]?.[2] ?? 0;
const sh = (name: string): number => SPR[name]?.[3] ?? 0;

function rect(a: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  a.fillStyle = c;
  a.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

// --- The art canvas: the band at its own pixel size, grown to the screen's shape ------------------------------

/** The pixel size and the art's width and height for a w × h screen: at most 256 art pixels across. */
function viewport(w: number, h: number): { p: number; aw: number; ah: number } {
  const p = Math.max(1, Math.ceil(w / BW));
  return { p, aw: Math.ceil(w / p), ah: Math.ceil(h / p) };
}
/** Where the band's top sits: most of a tall screen's extra height is sky; a short one loses sky first. */
const bandTop = (ah: number): number => (ah >= BH ? Math.round((ah - BH) * 0.62) : ah - BH);

const arts: Ctx[] = [];
function art(n: number, aw: number, ah: number): Ctx {
  if (!arts[n]) arts[n] = document.createElement("canvas").getContext("2d")!;
  const a = arts[n]!;
  if (a.canvas.width !== aw || a.canvas.height !== ah) {
    a.canvas.width = aw;
    a.canvas.height = ah;
  }
  a.imageSmoothingEnabled = false;
  a.globalAlpha = 1;
  a.globalCompositeOperation = "source-over";
  return a;
}

const tops = new Map<HTMLImageElement, RGB>();
/** An image's top-row colour, where the sky above the band grows from. */
function topOf(img: HTMLImageElement): RGB {
  let top = tops.get(img);
  if (!top) {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = 1;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, 1).data;
    let r = 0;
    let gg = 0;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i]!;
      gg += d[i + 1]!;
      b += d[i + 2]!;
    }
    const n = d.length / 4;
    top = [r / n, gg / n, b / n];
    tops.set(img, top);
  }
  return top;
}

/** The sky above the band: its top colour deepening to night, with stars that come and go. */
function skyAbove(a: Ctx, aw: number, rows: number, top: RGB, t: number): void {
  for (let y = 0; y < rows; y++) {
    const f = Math.pow((rows - y) / rows, 0.8);
    a.fillStyle = rgb([top[0] + (NIGHT[0] - top[0]) * f, top[1] + (NIGHT[1] - top[1]) * f, top[2] + (NIGHT[2] - top[2]) * f].map(Math.round) as unknown as RGB);
    a.fillRect(0, y, aw, 1);
  }
  const n = Math.floor((aw * rows) / 110);
  for (let i = 0; i < n; i++) {
    const y = Math.floor(dice(i, 2) * rows);
    if (dice(i, 7) < Math.pow(y / rows, 1.5)) continue; // fewer toward the sunset
    if (dice(i, 5, Math.floor(t * 1.5 + dice(i, 3) * 9)) < 0.12) continue;
    rect(a, Math.floor(dice(i, 1) * aw), y, 1, 1, pick([PAL.paper, PAL.mist, PAL.fog, PAL.white], dice(i, 6)));
  }
}

// --- Things that cross either shot: birds, a train -------------------------------------------------------------

/** Flocks crossing the sky, wings beating; `seed` keeps the two shots' skies apart. */
function birds(a: Ctx, aw: number, y0: number, y1: number, t: number, seed: number, slow = 1): void {
  const SLOT = 7;
  for (let k = Math.floor((t - 14) / SLOT); k <= Math.floor(t / SLOT); k++) {
    if (dice(seed, k, 1) > 0.5) continue;
    const t0 = k * SLOT + dice(seed, k, 2) * SLOT;
    const dir = dice(seed, k, 3) < 0.5 ? 1 : -1;
    const speed = (16 + dice(seed, k, 4) * 18) * slow;
    const lead = dir > 0 ? -12 + (t - t0) * speed : aw + 12 - (t - t0) * speed;
    if (lead < -60 || lead > aw + 60) continue;
    const y = y0 + dice(seed, k, 5) * (y1 - y0);
    const n = 3 + Math.floor(dice(seed, k, 6) * 5);
    for (let i = 0; i < n; i++) {
      const bx = lead - dir * (i * 5 + dice(seed, k, i, 7) * 3);
      const by = y + Math.abs(i - n / 2) * 2 + Math.sin(t * 2 + i) * 0.8;
      const up = Math.floor(t * 6 + i * 1.7) % 2 === 0;
      a.fillStyle = PAL.ink1;
      if (up) {
        a.fillRect(Math.round(bx), Math.round(by), 1, 1);
        a.fillRect(Math.round(bx) + 1, Math.round(by) + 1, 1, 1);
        a.fillRect(Math.round(bx) + 2, Math.round(by), 1, 1);
      } else a.fillRect(Math.round(bx), Math.round(by) + 1, 3, 1);
    }
  }
}

/** Now and then a freight train along the far rails: a locomotive or two and a string of cars. */
function train(a: Ctx, aw: number, rail: number, t: number, seed: number, carW: number, carH: number, drift: number): void {
  const SLOT = 22;
  const cars = [PAL.rust, PAL.clay, PAL.mtnD, PAL.amberD, PAL.steel, PAL.redD, PAL.mtn];
  for (let k = Math.floor((t - 60) / SLOT); k <= Math.floor(t / SLOT); k++) {
    if (dice(seed, k, 11) > 0.55) continue;
    const t0 = k * SLOT + dice(seed, k, 12) * 8;
    const dir = dice(seed, k, 13) < 0.5 ? 1 : -1;
    const speed = (24 + dice(seed, k, 14) * 22) * (carW / 9) + dir * drift;
    const n = 14 + Math.floor(dice(seed, k, 15) * 22);
    const len = n * (carW + 1) + carW * 2;
    const head = dir > 0 ? -4 + (t - t0) * speed : aw + 4 - (t - t0) * speed;
    if (dir > 0 ? head - len > aw : head + len < 0) continue;
    for (let i = 0; i <= n; i++) {
      const x = head - dir * i * (carW + 1) - (dir > 0 ? carW : 0);
      if (x < -carW || x > aw) continue;
      if (i === 0) {
        rect(a, x, rail - carH - 1, carW, carH + 1, PAL.amber);
        rect(a, x + (dir > 0 ? carW - 3 : 1), rail - carH - 2, 2, 1, PAL.ink1);
        rect(a, dir > 0 ? x + carW - 1 : x, rail - carH, 1, 1, PAL.white);
      } else rect(a, x, rail - carH, carW, carH, pick(cars, dice(seed, k, i, 16)));
      rect(a, x + 1, rail, carW - 2, 1, PAL.ink0);
    }
  }
}

// --- The side view -------------------------------------------------------------------------------------------

const ROW = { shoulder: 96, road: 106, centre: 114, roadEnd: 124, arm: 48, poleTop: 44, rail: 95 } as const;
const DIRT: RGB = [104, 64, 54];
const ASPHALT: RGB = [46, 42, 60];
const SAND: RGB = [80, 47, 41];
const POLE = "rgb(60,40,34)";
const POLE_D = "rgb(40,27,26)";
const WIRE = "rgb(34,24,28)";
const DASH = "rgb(230,186,92)";
const LINE = "rgb(196,176,150)";

let tex: { dirt: HTMLCanvasElement; asphalt: HTMLCanvasElement; sand: HTMLCanvasElement } | null = null;
/** A band of colour with fixed noise, 96 wide so that it tiles. */
function noise(w: number, h: number, base: RGB, spread: number, seed: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const img = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const d = Math.round((dice(seed, i) * 2 - 1) * spread);
    img.data[i * 4] = base[0] + d;
    img.data[i * 4 + 1] = base[1] + d;
    img.data[i * 4 + 2] = base[2] + d;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
function textures(): NonNullable<typeof tex> {
  if (!tex) {
    const asphalt = noise(96, ROW.roadEnd - ROW.road, ASPHALT, 5, 3);
    const g = asphalt.getContext("2d")!;
    g.fillStyle = "rgb(64,54,74)";
    g.fillRect(0, 0, 96, 3);
    g.fillStyle = LINE;
    g.fillRect(0, 1, 96, 1);
    g.fillRect(0, ROW.roadEnd - ROW.road - 2, 96, 1);
    tex = { dirt: noise(96, ROW.road - ROW.shoulder, DIRT, 9, 1), asphalt, sand: noise(96, 48, SAND, 7, 4) };
  }
  return tex;
}
/** A tiling texture across the screen, shifted by `off` (its own speed already applied). */
function tile(a: Ctx, c: HTMLCanvasElement, off: number, y: number, aw: number): void {
  const w = c.width;
  for (let x = (((Math.round(off) % w) + w) % w) - w; x < aw; x += w) a.drawImage(c, x, y);
}

/** A 7 × 7 wheel; `turn` (0–3) walks the hub's glint round so it rolls. */
function wheel(a: Ctx, cx: number, cy: number, turn: number): void {
  const x = Math.round(cx) - 3;
  const y = Math.round(cy) - 3;
  a.fillStyle = PAL.ink0;
  a.fillRect(x + 1, y, 5, 7);
  a.fillRect(x, y + 1, 7, 5);
  a.fillStyle = PAL.ink2;
  a.fillRect(x + 1, y + 1, 5, 5);
  a.fillStyle = PAL.fog;
  a.fillRect(x + 2, y + 2, 3, 3);
  a.fillStyle = PAL.steel;
  a.fillRect(x + 3, y + 3, 1, 1);
  const [dx, dy] = ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const)[turn & 3]!;
  a.fillStyle = PAL.white;
  a.fillRect(x + 3 + dx, y + 3 + dy, 1, 1);
}

// The trailers, facing right, 112 long (53 ft at the tractor's scale), drawn once: the box or the load from its rear at
// x 0 to its front at x 111; the floor rides 10 px up, level with the fifth wheel; ground at y 30. Their tandem's
// wheels are drawn each frame at TANDEM.
const TL = 112;
const TH = 31;
const TANDEM = [12, 21] as const;
type Trailer = "van" | "ours" | "reefer" | "flatbed" | "tanker";
const TRAILERS: readonly Trailer[] = ["van", "van", "reefer", "flatbed", "tanker"];
const trailers = new Map<Trailer, HTMLCanvasElement>();
function trailerArt(kind: Trailer): HTMLCanvasElement {
  let c = trailers.get(kind);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = TL + 4;
  c.height = TH;
  const g = c.getContext("2d")!;
  const f = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  const floor = 20; // the deck's underside
  // Running gear under every kind: the slider at the rear, the landing gear, the rear bumper, the mud flaps.
  f(4, floor, 26, 2, PAL.ink1);
  f(TL - 26, floor, 1, 8, PAL.ink1);
  f(TL - 23, floor, 1, 8, PAL.ink1);
  f(TL - 27, 28, 3, 1, PAL.ink0);
  f(TL - 24, 28, 3, 1, PAL.ink0);
  f(TL - 25, floor + 3, 3, 1, PAL.steel);
  f(TL - 10, floor, 7, 1, PAL.ink1);
  f(0, floor + 4, 4, 2, PAL.ink1);
  f(2, floor, 1, 4, PAL.ink1);
  f(5, floor + 2, 2, 7, PAL.ink0);
  if (kind === "flatbed") {
    f(0, floor - 3, TL, 3, PAL.mtnD);
    f(0, floor - 3, TL, 1, PAL.mtnL);
    for (let i = 0; i < 4; i++) {
      // steel coils, strapped
      const x = 10 + i * 24;
      f(x + 1, floor - 13, 12, 10, PAL.fog);
      f(x, floor - 12, 14, 8, PAL.fog);
      f(x + 4, floor - 10, 6, 4, PAL.steel);
      f(x + 6, floor - 9, 2, 2, PAL.ink2);
      f(x + 1, floor - 13, 12, 1, PAL.mist);
      f(x + 7, floor - 14, 1, 11, PAL.amberD);
    }
  } else if (kind === "tanker") {
    f(6, 7, TL - 10, 13, PAL.mist);
    f(4, 9, TL - 6, 9, PAL.mist);
    f(6, 7, TL - 10, 2, PAL.white);
    f(6, 17, TL - 10, 3, PAL.fog);
    for (let x = 18; x < TL - 8; x += 22) f(x, 7, 1, 13, PAL.fog);
    f(30, 5, 6, 2, PAL.steel);
    f(70, 5, 6, 2, PAL.steel);
    f(4, floor - 1, TL - 4, 1, PAL.ink1);
  } else {
    const body = kind === "reefer" ? PAL.white : PAL.paper;
    f(0, 0, TL, floor, PAL.ink1);
    f(1, 1, TL - 2, floor - 2, body);
    f(1, 1, TL - 2, 1, PAL.white);
    f(1, floor - 3, TL - 2, 2, PAL.mist);
    for (let x = 8; x < TL - 2; x += 7) f(x, 2, 1, floor - 5, kind === "reefer" ? PAL.mist : PAL.sandD + "55");
    f(1, 1, 2, floor - 2, PAL.mist);
    f(2, floor - 3, 1, 1, PAL.red);
    f(TL - 3, 2, 1, 1, PAL.amber);
    f(TL / 2, floor - 3, 1, 1, PAL.amber);
    if (kind === "reefer") {
      f(TL, 2, 3, 10, PAL.steel);
      f(TL, 2, 3, 1, PAL.fog);
      f(TL + 1, 5, 1, 4, PAL.ink2);
    }
    if (kind === "ours") {
      f(1, 12, TL - 2, 2, PAL.teal);
      drawText(g, "LANES", Math.round(TL / 2 - textWidth("LANES") / 2), 3, 1, PAL.blueD);
    }
  }
  trailers.set(kind, c);
  return c;
}

/** The rig's length and its parts: the trailer from 0 to TL, the tractor coupled with its fifth wheel under the kingpin. */
const rigTractorX = (): number => Math.round(TL - 6 - TRACTOR.fifth);
const rigLength = (): number => rigTractorX() + sw("tractor");

/** A semi, its left end at x and its tyres on `ground`, facing right (dir 1) or left. */
function semi(a: Ctx, x: number, ground: number, dir: number, paint: string, kind: Trailer, turn: number, bob: number): void {
  const len = rigLength();
  const tx = rigTractorX();
  const th = sh(paint);
  a.save();
  if (dir > 0) a.translate(Math.round(x), 0);
  else {
    a.translate(Math.round(x) + len, 0);
    a.scale(-1, 1);
  }
  a.drawImage(trailerArt(kind), 0, ground - (TH - 1));
  for (const wx of TANDEM) wheel(a, wx, ground - 3, turn);
  spr(a, paint, tx, ground - (th - 1) + bob);
  for (const [wx, wy] of TRACTOR.wheels) wheel(a, tx + wx, ground - (th - 1) + wy, turn);
  a.restore();
}

/** What stands by the road, placed by distance along it: one slot every 56 px, a diner now and then. */
function roadside(a: Ctx, aw: number, by: number, D: number, t: number): void {
  const base = by + ROW.road - 1;
  // A diner every so often, set back from the road (behind the poles).
  const DS = 1920;
  const dinerAt = (m: number) => (dice(m, 21) < 0.45 ? m * DS + 200 + dice(m, 22) * 1100 : null);
  const diners: number[] = [];
  for (let m = Math.floor((D - 200) / DS) - 1; m <= Math.floor((D + aw) / DS) + 1; m++) {
    const X = dinerAt(m);
    if (X === null) continue;
    diners.push(X);
    const x = X - D;
    if (x > -sw("diner") && x < aw) {
      spr(a, "diner", x, base - sh("diner") + 1);
      if (dice(Math.floor(t * 9), m) < 0.07) rect(a, x + 40, base - sh("diner") + 1, 40, 12, "rgba(18,9,26,0.5)");
    }
  }
  poles(a, aw, by, D);
  const SLOT = 56;
  for (let k = Math.floor((D - 80) / SLOT); k <= Math.floor((D + aw) / SLOT); k++) {
    const X = k * SLOT + dice(k, 12) * 40;
    if (diners.some((d) => X > d - 30 && X < d + 130)) continue;
    const x = X - D;
    const y = base + Math.floor(dice(k, 13) * 2);
    const r = dice(k, 11);
    if (r < 0.1) spr(a, "saguaro", x, y - sh("saguaro"));
    else if (r < 0.19) spr(a, "pear", x, y - sh("pear"));
    else if (r < 0.32) spr(a, "sage", x, y - sh("sage") + 6);
    else if (r < 0.39) spr(a, "rocks", x, y - sh("rocks"));
    else if (r < 0.47) spr(a, "grass", x, y - sh("grass"));
    else if (r < 0.51) speedSign(a, x, y);
    else if (r < 0.54) guideSign(a, x, y, pick(["FUEL 2 MI", "GALLUP 42", "REST AREA", "EXIT 117"], dice(k, 14)));
    else if (r < 0.56) billboard(a, x, y, pick([["DINER", "NEXT EXIT"], ["ONE WORLD", "REAL CLOCK"], ["DIESEL", "OPEN 24 HRS"]], dice(k, 15)));
  }
  // Mile markers, one a mile (shortened to a stretch the screen sees in a minute).
  const MS = 2240;
  for (let m = Math.floor((D - 20) / MS); m <= Math.floor((D + aw) / MS); m++) {
    const x = m * MS + 300 - D;
    if (x < -10 || x > aw) continue;
    rect(a, x + 3, base - 8, 1, 9, PAL.mist);
    rect(a, x, base - 17, 7, 9, PAL.grassD);
    drawText(a, String((117 + m) % 10), x + 1, base - 16, 1, PAL.white);
  }
}

function speedSign(a: Ctx, x: number, base: number): void {
  rect(a, x + 7, base - 14, 1, 15, PAL.mist);
  rect(a, x, base - 27, 15, 13, PAL.ink1);
  rect(a, x + 1, base - 26, 13, 11, PAL.paper);
  drawText(a, "65", x + 2, base - 24, 1, PAL.ink0);
}

function guideSign(a: Ctx, x: number, base: number, text: string): void {
  const w = textWidth(text) + 5;
  rect(a, x + 3, base - 16, 1, 17, PAL.mist);
  rect(a, x + w - 4, base - 16, 1, 17, PAL.mist);
  rect(a, x, base - 28, w, 12, PAL.paper);
  rect(a, x + 1, base - 27, w - 2, 10, PAL.forest);
  drawText(a, text, x + 3, base - 26, 1, PAL.white);
}

function billboard(a: Ctx, x: number, base: number, lines: readonly string[]): void {
  rect(a, x + 14, base - 14, 2, 15, PAL.mtnD);
  rect(a, x + 48, base - 14, 2, 15, PAL.mtnD);
  rect(a, x, base - 34, 64, 21, PAL.ink0);
  rect(a, x + 1, base - 33, 62, 19, PAL.ink2);
  drawText(a, lines[0]!, x + 32 - Math.round(textWidth(lines[0]!) / 2), base - 31, 1, PAL.gold);
  drawText(a, lines[1]!, x + 32 - Math.round(textWidth(lines[1]!) / 2), base - 22, 1, PAL.paper);
  rect(a, x + 4, base - 36, 2, 2, PAL.amber);
  rect(a, x + 58, base - 36, 2, 2, PAL.amber);
}

/** Telephone poles along the road, one every 96 px, and the wires sagging between them. */
function poles(a: Ctx, aw: number, by: number, D: number): void {
  const k0 = Math.floor((D - 30) / 96);
  const k1 = Math.ceil((D + aw + 30) / 96);
  a.fillStyle = WIRE;
  for (let k = k0; k <= k1; k++) {
    const x0 = k * 96 + 30 - D;
    for (const end of [-6, 6]) {
      for (let i = 0; i <= 96; i++) {
        const f = i / 96;
        const x = Math.round(x0 + end + i);
        if (x < 0 || x >= aw) continue;
        a.fillRect(x, by + ROW.arm + 1 + Math.round(20 * f * (1 - f)), 1, 1);
      }
    }
  }
  for (let k = k0; k <= k1; k++) {
    const x = Math.round(k * 96 + 30 - D);
    if (x < -10 || x > aw + 10) continue;
    rect(a, x, by + ROW.poleTop, 1, ROW.road - ROW.poleTop - 1, POLE);
    rect(a, x + 1, by + ROW.poleTop, 1, ROW.road - ROW.poleTop - 1, POLE_D);
    rect(a, x - 7, by + ROW.arm, 15, 1, POLE);
    rect(a, x - 7, by + ROW.arm + 1, 15, 1, POLE_D);
    for (const dx of [-6, 0, 6]) rect(a, x + dx, by + ROW.arm - 1, 1, 1, PAL.paper);
  }
}

interface Car {
  kind: "pickup" | "sedan" | "semi";
  x: number;
  dir: number;
  paint: string;
  trailer: Trailer;
}
/** The far lane at time t: traffic coming the other way, fast, and now and then someone passing the rig. */
function farLane(aw: number, t: number): Car[] {
  const out: Car[] = [];
  const ON = 2.4;
  for (let k = Math.floor((t - 4) / ON); k <= Math.floor(t / ON); k++) {
    if (dice(k, 31) > 0.62) continue;
    const t0 = k * ON + dice(k, 32) * 1.8;
    const r = dice(k, 33);
    const kind = r < 0.32 ? "pickup" : r < 0.62 ? "sedan" : "semi";
    const x = aw + 8 - (t - t0) * (V + 110 + dice(k, 34) * 50);
    const len = kind === "semi" ? rigLength() : sw(kind);
    if (t < t0 || x < -len - 8) continue;
    out.push({ kind, x, dir: -1, paint: pick(["tractor-red", "tractor-white", "tractor-amber", "tractor"], dice(k, 35)), trailer: pick(TRAILERS, dice(k, 36)) });
  }
  const PS = 11;
  for (let k = Math.floor((t - 16) / PS); k <= Math.floor(t / PS); k++) {
    if (dice(k, 41) > 0.4) continue;
    const t0 = k * PS + dice(k, 42) * 4;
    const kind = dice(k, 43) < 0.5 ? "pickup" : "sedan";
    const x = -sw(kind) - 4 + (t - t0) * (24 + dice(k, 44) * 18);
    if (t < t0 || x > aw + 4) continue;
    out.push({ kind, x, dir: 1, paint: "", trailer: "van" });
  }
  return out;
}

/** Tumbleweeds rolling along with the wind, bouncing, slower than the ground they roll over. */
function tumbleweeds(a: Ctx, aw: number, baseY: number, t: number, ground: number, seed: number): void {
  const SLOT = 6;
  for (let k = Math.floor((t - 6) / SLOT); k <= Math.floor(t / SLOT); k++) {
    if (dice(seed, k, 51) > 0.45) continue;
    const t0 = k * SLOT + dice(seed, k, 52) * SLOT;
    const wind = 50 + dice(seed, k, 53) * 40;
    const x = aw + 6 - (t - t0) * (ground - wind);
    if (t < t0 || x < -20) continue;
    const y = baseY + Math.floor(dice(seed, k, 54) * 4) - Math.abs(Math.sin((t - t0) * 6)) * 5;
    const name = `weed${Math.floor((t - t0) * 9) % 4}`;
    spr(a, name, x, y - sh(name));
  }
}

function sideShot(a: Ctx, aw: number, ah: number, t: number): void {
  const by = bandTop(ah);
  const D = Math.round(V * t);
  const back = pics![1]!;
  const tx = textures();
  if (by > 0) skyAbove(a, aw, by, topOf(back), t);
  a.drawImage(back, Math.round((aw - BW) / 2), by);
  birds(a, aw, Math.max(4, by + 14), by + 56, t, 1);
  rect(a, 0, by + ROW.rail, aw, 1, "rgba(16,23,42,0.55)");
  train(a, aw, by + ROW.rail, t, 2, 9, 5, V * 0.15);
  tile(a, tx.dirt, -D, by + ROW.shoulder, aw);
  roadside(a, aw, by, D, t);
  tile(a, tx.asphalt, -D, by + ROW.road, aw);
  a.fillStyle = DASH;
  for (let x = ((-D % 32) + 32) % 32 - 32; x < aw; x += 32) a.fillRect(x, by + ROW.centre, 12, 2);
  // The far lane, behind the rig.
  const turnOf = (d: number) => Math.floor(d / 5.5) & 3;
  for (const c of farLane(aw, t)) {
    const g = by + 113;
    if (c.kind === "semi") semi(a, c.x, g, c.dir, c.paint, c.trailer, turnOf(D * 2.4), 0);
    else spr(a, c.kind, c.x, g - sh(c.kind) + 1, c.dir < 0);
  }
  // The rig: its shadow, the headlights' wash ahead, the rig, exhaust, and the dust it raises.
  const len = rigLength();
  const x = Math.round(aw / 2 - len / 2) + 4;
  const g = by + 121;
  rect(a, x + 3, g - 1, len - 6, 2, "rgba(10,8,20,0.35)");
  a.save();
  a.globalCompositeOperation = "lighter";
  for (let i = 0; i < 56; i++) {
    const half = 1 + i / 8;
    a.fillStyle = `rgba(255,226,150,${0.32 * (1 - i / 56)})`;
    a.fillRect(x + len + i, Math.round(g - 4 - half), 1, Math.round(half * 2 + 1));
  }
  a.restore();
  const bob = Math.floor(t * 4.5) % 5 === 0 ? -1 : 0;
  semi(a, x, g, 1, "tractor", "ours", turnOf(D), bob);
  const stack = x + rigTractorX() + Math.round(sw("tractor") * 0.56);
  const stackTop = g - (sh("tractor") - 1) + bob;
  for (let i = 0; i < 6; i++) {
    const age = (t * 1.6 + i / 6) % 1;
    a.fillStyle = rgb(age < 0.5 ? [182, 196, 220] : [123, 141, 176], 0.75 * (1 - age));
    const s = 1 + Math.round(age * 3);
    a.fillRect(Math.round(stack - age * 18), Math.round(stackTop - 2 - age * 9), s, s);
  }
  for (let i = 0; i < 8; i++) {
    const age = (t * 2.2 + i / 8) % 1;
    a.fillStyle = rgb(age < 0.5 ? [224, 196, 142] : [184, 148, 95], 0.6 * (1 - age));
    a.fillRect(Math.round(x + 6 - age * 26 + (i % 3)), Math.round(g - 1 - age * 5 - (i % 2)), 1 + (i % 2), 1);
  }
  // The ground in front of the road, to the bottom of the screen, darker toward the viewer.
  const fx = -Math.round(D * FG);
  for (let y = by + ROW.roadEnd; y < ah; y += tx.sand.height) tile(a, tx.sand, fx, y, aw);
  for (let y = by + ROW.roadEnd + 20; y < ah; y++) {
    a.fillStyle = `rgba(9,7,15,${Math.min(0.6, (y - by - ROW.roadEnd - 20) / 160)})`;
    a.fillRect(0, y, aw, 1);
  }
  const SLOT = 40;
  const F = D * FG;
  for (let k = Math.floor((F - 60) / SLOT); k <= Math.floor((F + aw) / SLOT); k++) {
    const r = dice(k, 61);
    if (r > 0.42) continue;
    const name = r < 0.15 ? "sage" : r < 0.3 ? "grass" : "rocks";
    const fy = by + ROW.roadEnd + 21 + Math.floor(dice(k, 62) * 5);
    spr(a, name, k * SLOT + dice(k, 63) * 24 - F, fy - sh(name));
  }
  tumbleweeds(a, aw, by + ROW.roadEnd + 18, t, V * FG, 3);
}

// --- The head-on view ----------------------------------------------------------------------------------------

/** Where the lane meets the horizon, and the far lane's offset (at the painting's depth) from the near one. */
const VP = [211, 89] as const;
const LANE_L = [-36, 4] as const;
const SIGN = [46, 63, 27, 14] as const;
const HS0 = HEADS[0]!;
const HS1 = HEADS[HEADS.length - 1]!;

/** The sprite for a coming (sw) or going (ne) vehicle at scale s, or null when it's too small or past the camera. */
function headSprite(kind: "truck" | "pickup" | "sedan", d: "sw" | "ne", s: number): string | null {
  if (s < HS0 || s > HS1) return null;
  const i = Math.round((Math.log(s / HS0) / Math.log(HS1 / HS0)) * (HEADS.length - 1));
  return `${kind}-${d}-${i}`;
}
/** Where a vehicle at scale s stands; close to the camera it sweeps out to the left, as a rig passing it would. */
function lanePoint(s: number, far: boolean): [number, number] {
  const sweep = 80 * Math.max(0, s - 1.2) ** 2;
  return [VP[0] + (PAINTED_AT[0] - VP[0]) * s + (far ? LANE_L[0] * s : 0) - sweep, VP[1] + (PAINTED_AT[1] - VP[1]) * s + (far ? LANE_L[1] * s : 0)];
}

let ground: { key: string; c: HTMLCanvasElement } | null = null;
/**
 * The ground below the head-on painting on a tall screen, built once per screen size (the camera never moves). Each
 * pixel takes the painting's bottom row where the same line from the vanishing point crosses it, so the asphalt, its
 * edge line and the dirt beside it run on toward the camera, widening as they come and matching the painting at the
 * seam; deeper down they soften, take a little grain and darken, and scrub grows where the ground is dirt.
 */
function headGround(back: HTMLImageElement, aw: number, rows: number, ox: number): HTMLCanvasElement {
  const key = `${aw}×${rows}@${ox}`;
  if (ground?.key === key) return ground.c;
  const src = document.createElement("canvas");
  src.width = BW;
  src.height = 1;
  const sg = src.getContext("2d")!;
  sg.drawImage(back, 0, BH - 1, BW, 1, 0, 0, BW, 1);
  const row = sg.getImageData(0, 0, BW, 1).data;
  const soft = new Float32Array(BW * 3);
  for (let x = 0; x < BW; x++) {
    for (let ch = 0; ch < 3; ch++) {
      let s = 0;
      for (let dx = -5; dx <= 5; dx++) s += row[Math.min(BW - 1, Math.max(0, x + dx)) * 4 + ch]!;
      soft[x * 3 + ch] = s / 11;
    }
  }
  const c = document.createElement("canvas");
  c.width = aw;
  c.height = rows;
  const g = c.getContext("2d")!;
  const img = g.createImageData(aw, rows);
  const dirt: [number, number][] = [];
  for (let y = 0; y < rows; y++) {
    const f = (BH - 0.5 - VP[1]) / (BH + y + 0.5 - VP[1]);
    const blur = Math.min(0.7, y / 40);
    const dark = Math.min(0.5, y / 220);
    for (let x = 0; x < aw; x++) {
      const x0 = Math.max(0, Math.min(BW - 1, Math.round(VP[0] + (x - ox - VP[0]) * f)));
      const grain = (dice(x, y, 91) * 2 - 1) * Math.min(7, 2 + y / 6);
      const i = (y * aw + x) * 4;
      for (let ch = 0; ch < 3; ch++) img.data[i + ch] = (row[x0 * 4 + ch]! * (1 - blur) + soft[x0 * 3 + ch]! * blur + grain) * (1 - dark);
      img.data[i + 3] = 255;
      if (y > 6 && img.data[i]! > img.data[i + 2]! + 18 && dice(x, y, 92) < 0.0016) dirt.push([x, y]);
    }
  }
  g.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = false;
  for (const [x, y] of dirt.sort((p, q) => p[1] - q[1])) {
    const name = pick(["sage", "grass", "rocks", "grass"], dice(x, y, 93));
    spr(g, name, x - sw(name) / 2, y - sh(name));
  }
  ground = { key, c };
  return c;
}

interface Comer {
  kind: "truck" | "pickup" | "sedan";
  d: "sw" | "ne";
  s: number;
}
/** Everyone on the road `u` s into head-on shot n: the painting's truck first, then traffic both ways. */
function headTraffic(n: number, u: number): Comer[] {
  const out: Comer[] = [];
  // The painting's truck: 1/scale closes at a steady rate, so it creeps out of the distance and rushes the camera.
  const uh = n === 0 ? u + 4.9 : u;
  const inv = 1 / 0.12 - 1.5 * uh;
  if (inv > 0) out.push({ kind: "truck", d: "sw", s: 1 / inv });
  for (let k = 0; k < 9; k++) {
    if (dice(n, k, 71) < 0.65) {
      const t0 = 5.4 + k * 2.6 + dice(n, k, 72) * 1.2;
      const r = dice(n, k, 73);
      const kind = r < 0.45 ? "pickup" : r < 0.85 ? "sedan" : "truck";
      const iv = 10 - (1.3 + dice(n, k, 74) * 0.8) * (u - t0);
      if (u >= t0 && iv > 0) out.push({ kind, d: "sw", s: 1 / iv });
    }
    if (dice(n, k, 75) < 0.55) {
      const t0 = -2 + k * 3.1 + dice(n, k, 76) * 1.4;
      const iv = 1 / HS1 + (1.2 + dice(n, k, 77) * 0.8) * (u - t0);
      if (u >= t0) out.push({ kind: dice(n, k, 78) < 0.5 ? "pickup" : "sedan", d: "ne", s: 1 / iv });
    }
  }
  return out.sort((p, q) => p.s - q.s);
}

function headShot(a: Ctx, aw: number, ah: number, u: number, n: number, t: number): void {
  const by = bandTop(ah);
  const ox = Math.round((aw - BW) * 0.35);
  const back = pics![2]!;
  if (by > 0) skyAbove(a, aw, by, topOf(back), t);
  a.drawImage(back, ox, by);
  if (by + BH < ah) a.drawImage(headGround(back, aw, ah - by - BH, ox), 0, by + BH);
  if (dice(Math.floor(u * 1000 / 70), n) < 0.06) rect(a, ox + SIGN[0], by + SIGN[1], SIGN[2], SIGN[3], "rgba(18,9,26,0.55)");
  birds(a, aw, Math.max(4, by + 8), by + 50, t, 5 + n, 0.8);
  train(a, aw, by + 88, t, 6, 5, 2, 0);
  // Tumbleweeds blowing across the road at some depth.
  for (let k = 0; k < 4; k++) {
    if (dice(n, k, 81) > 0.5) continue;
    const t0 = 1 + k * 5 + dice(n, k, 82) * 3;
    const s = 0.5 + dice(n, k, 83) * 0.9;
    const [px, py] = lanePoint(s, false);
    const x = px - 80 * s + (u - t0) * 34 * s;
    if (u < t0 || x > px + 60 * s) continue;
    const name = `weed${Math.floor((u - t0) * 8) % 4}`;
    const r = SPR[name];
    if (!r) continue;
    const w = Math.max(2, Math.round(r[2] * s * 0.7));
    const hgt = Math.max(2, Math.round(r[3] * s * 0.7));
    a.drawImage(atlas(), r[0], r[1], r[2], r[3], Math.round(ox + x), Math.round(by + py - hgt - Math.abs(Math.sin((u - t0) * 5)) * 3 * s), w, hgt);
  }
  for (const c of headTraffic(n, u)) {
    const name = headSprite(c.kind, c.d, c.s);
    if (!name) continue;
    const [px, py] = lanePoint(c.s, c.d === "ne");
    const x = ox + px;
    const y = by + py;
    if (c.d === "sw") {
      // Its headlights' wash on the road ahead.
      const w = HEAD_W1[c.kind] * c.s;
      a.save();
      a.globalCompositeOperation = "lighter";
      a.translate(x - 0.16 * w, y + 0.05 * w);
      a.scale(0.5 * w, 0.11 * w);
      const gr = a.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, "rgba(255,196,110,0.33)");
      gr.addColorStop(1, "rgba(255,196,110,0)");
      a.fillStyle = gr;
      a.beginPath();
      a.arc(0, 0, 1, 0, Math.PI * 2);
      a.fill();
      a.restore();
    }
    spr(a, name, x - sw(name) / 2, y - sh(name));
  }
}

// --- The shots, on any screen ----------------------------------------------------------------------------------

function shot(a: Ctx, n: number, aw: number, ah: number, tMs: number): void {
  if (n % 2 === 0) headShot(a, aw, ah, (tMs - n * SHOT_MS) / 1000, n, tMs / 1000);
  else sideShot(a, aw, ah, tMs / 1000);
}

/**
 * Draws the shot for time `tMs` onto ctx, a w × h canvas, fading from one shot into the next over the last second
 * of each 20; false until the pictures have decoded (the poster stands in).
 */
export function drawTitleShots(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number): boolean {
  if (!ready()) return false;
  const { p, aw, ah } = viewport(w, h);
  const n = Math.floor(tMs / SHOT_MS);
  const base = art(0, aw, ah);
  shot(base, n, aw, ah, tMs);
  const fading = tMs - n * SHOT_MS - (SHOT_MS - FADE_MS);
  if (fading > 0) {
    const next = art(1, aw, ah);
    shot(next, n + 1, aw, ah, tMs);
    base.globalAlpha = fading / FADE_MS;
    base.drawImage(next.canvas, 0, 0);
    base.globalAlpha = 1;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base.canvas, 0, 0, aw, ah, Math.floor((w - aw * p) / 2), Math.floor((h - ah * p) / 2), aw * p, ah * p);
  return true;
}
