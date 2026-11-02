import poster from "../assets/title/poster.png";
import sideBackUrl from "../assets/title/parallax/back.png";
import headBackUrl from "../assets/title/approach.png";
import atlasUrl from "../assets/title/sprites.png";
import { PAL } from "./art.js";
import { drawText, textWidth } from "./font.js";

/**
 * The title scene's poster, inside the page: the head-on shot's first frame (the painting with its own rig, before the
 * road starts moving; rendered by drawTitleShots itself), 256×144, shown until the shots below can play, and for good
 * when motion is reduced.
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
// cycle and there is no seam. Head-on: the original painting's rig holds its place at the centre of the screen, alive,
// in the lane the painting has it, while the road and everything beside it (its lines, the poles and wires, the scrub,
// the signs, the painting's diner) stream at the camera from the horizon, growing as they come; clouds drift, birds
// cross, a train runs along the foot of the mesas, and once a shot a car overtakes the camera in the far lane and pulls
// away. Side view: the camera rides beside a cyan semi heading right in the near lane (its trailer drawn here, so the
// gap, the fifth wheel, the landing gear and both tandems are exact) while the road, the poles and the roadside stream
// past, and now and then a pickup, a sedan or another rig comes the other way in the far lane.
// Jeff's rules (2026-11-02), both shots: one lane each way and nothing ever drives against its lane; it's a desert, so
// barely any traffic and never two on screen at once; a track carries one train at a time, always the same way, led by
// its locomotive; the roadside is placed so nothing stands in anything else; nothing on the road is a still (wheels
// roll, bodies bounce, stacks smoke, and at this hour every lamp is lit). Each shot holds 30 s and fades into the other
// over a second; the first is head-on, from the frame the poster shows. On a screen of any other shape the 256 × 144
// band keeps its pixel size and the sky grows above it and the ground below.

const SHOT_MS = 30_000;
const FADE_MS = 1_000;
const BW = 256; // the scene band
const BH = 144;
const V = 140; // the side view's road speed, art px a second (the rig's own, about 45 mph at this scale)
const FG = 1.5; // the ground in front of the road moves this much faster
const NIGHT: RGB = [9, 12, 23];

// <sprites> written by tools/title-sprites.py
const SPR: Record<string, readonly [number, number, number, number]> = {
  "diner": [332, 0, 108, 52],
  "grass": [368, 90, 25, 22],
  "head-diner": [0, 90, 77, 36],
  "head-sky": [0, 0, 256, 89],
  "pear": [441, 0, 29, 38],
  "pickup": [431, 90, 41, 20],
  "pickup-teal": [0, 127, 41, 20],
  "rocks": [394, 90, 36, 21],
  "sage": [333, 90, 34, 33],
  "saguaro": [78, 90, 22, 35],
  "sedan": [118, 127, 35, 15],
  "tractor": [101, 90, 57, 33],
  "tractor-amber": [275, 90, 57, 33],
  "tractor-red": [159, 90, 57, 33],
  "tractor-white": [217, 90, 57, 33],
  "truck": [257, 0, 74, 54],
  "weed0": [42, 127, 18, 18],
  "weed1": [61, 127, 18, 18],
  "weed2": [80, 127, 18, 18],
  "weed3": [99, 127, 18, 18],
};
const TRACTOR = {"wheels": [[6.3, 28.9], [15.5, 28.9], [50.0, 28.9]], "r": 3.5, "fifth": 10.6, "frame": 22.5, "back": 22.5} as const;
const CARS = {"pickup": {"wheels": [[9, 16], [35, 16]], "r": 3, "head": [39, 10], "tail": [1, 9], "pipe": [3, 16]}, "sedan": {"wheels": [[9, 12], [29, 12]], "r": 2, "head": [34, 8], "tail": [0, 9], "pipe": [2, 12]}} as const;
const TRUCK_AT = [123, 58] as const;
const DINER_AT = [8, 62] as const;
// </sprites>
// <vehicles> written by tools/title-vehicles.py
const VCAM = {"px": 211.0, "py": 89.0, "f": 120.0, "h": 7.0} as const;
const VLANES = {"coming": -14.0, "going": -26.0} as const;
const VSPAWN = 420.0;
const VPOSTER = 36.5;
const VSUN = [0.3498, -0.5997, 0.7197] as const;
const VRAMPS: Record<string, readonly (readonly [number, number, number])[]> = {"chrome": [[59, 51, 70], [77, 79, 98], [110, 110, 132], [143, 140, 151], [202, 199, 206]], "cream": [[96, 86, 76], [138, 126, 108], [178, 166, 144], [214, 202, 176], [244, 236, 212]], "dark": [[13, 11, 34], [38, 35, 57], [59, 51, 70]], "glass": [[13, 11, 34], [24, 26, 44], [40, 44, 66], [77, 79, 98]], "lamp": [[244, 168, 60], [255, 217, 106]], "red": [[64, 16, 24], [110, 26, 32], [158, 40, 40], [204, 62, 52], [236, 110, 88]], "tail": [[142, 42, 36], [216, 74, 58]], "tyre": [[13, 11, 34], [24, 21, 42], [38, 35, 57]], "white": [[143, 140, 151], [166, 173, 198], [184, 189, 208], [214, 216, 230], [242, 240, 252]]};
const VMODELS = {"pickup":{"L":19.1,"W":3.3,"top":6.33,"over":true,"prims":[["b",0.0,0.45,-3.35,3.35,1.05,1.85,"chrome"],["b",0.1,0.5,-3.0,3.0,0.8,1.05,"dark"],["b",0.35,0.55,-2.35,2.35,1.9,3.35,"chrome"],["b",0.28,0.4,-2.15,2.15,2.0,3.25,"dark"],["b",0.25,0.3,-2.15,2.15,2.3,2.42,"chrome"],["b",0.25,0.3,-2.15,2.15,2.65,2.77,"chrome"],["b",0.25,0.3,-2.15,2.15,3.0,3.12,"chrome"],["b",0.35,0.55,2.35,3.25,2.45,3.35,"chrome"],["b",0.35,0.55,-3.25,-2.35,2.45,3.35,"chrome"],["b",0.27,0.36,2.45,3.15,2.55,3.25,"lamp"],["b",0.27,0.36,-3.15,-2.45,2.55,3.25,"lamp"],["b",0.5,6.0,-3.25,3.25,2.95,3.6,"red"],["b",5.8,6.4,-3.25,3.25,3.6,4.0,"red"],["b",6.0,10.6,-3.3,3.3,2.95,4.0,"red"],["b",6.4,10.4,-3.1,3.1,4.0,6.2,"red"],["b",6.6,10.3,-2.95,2.95,6.2,6.33,"red"],["b",6.33,6.43,-2.85,2.85,4.1,6.05,"glass"],["b",6.9,10.0,3.1,3.14,4.2,5.95,"glass"],["b",6.9,10.0,-3.14,-3.1,4.2,5.95,"glass"],["b",10.38,10.48,-2.6,2.6,4.3,5.85,"glass"],["b",6.5,6.9,3.3,3.9,4.4,4.9,"dark"],["b",6.5,6.9,-3.9,-3.3,4.4,4.9,"dark"],["b",9.6,9.95,3.3,3.34,3.45,3.62,"chrome"],["b",9.6,9.95,-3.34,-3.3,3.45,3.62,"chrome"],["b",0.6,18.6,3.3,3.34,2.95,3.05,"chrome"],["b",0.6,18.6,-3.34,-3.3,2.95,3.05,"chrome"],["b",10.6,18.6,-2.9,2.9,2.0,2.6,"dark"],["b",10.6,18.8,2.9,3.3,2.95,3.95,"red"],["b",10.6,18.8,-3.3,-2.9,2.95,3.95,"red"],["b",10.6,18.8,2.85,3.3,3.95,4.05,"chrome"],["b",10.6,18.8,-3.3,-2.85,3.95,4.05,"chrome"],["b",10.6,10.9,-3.3,3.3,2.0,3.95,"red"],["b",18.5,18.8,-3.3,3.3,2.0,3.85,"red"],["b",18.79,18.83,-2.0,2.0,2.6,3.5,"dark"],["b",18.78,18.88,2.6,3.25,2.6,3.7,"tail"],["b",18.78,18.88,-3.25,-2.6,2.6,3.7,"tail"],["b",18.7,19.1,-3.35,3.35,1.05,1.85,"chrome"],["b",5.99,6.11,3.3,3.33,2.1,3.95,"dark"],["b",5.99,6.11,-3.33,-3.3,2.1,3.95,"dark"],["b",10.44,10.56,3.3,3.33,2.1,3.95,"dark"],["b",10.44,10.56,-3.33,-3.3,2.1,3.95,"dark"],["b",1.6,5.0,-3.0,3.0,0.9,2.95,"dark"],["b",13.3,16.7,-3.0,3.0,0.9,2.95,"dark"],["b",0.5,1.6,-3.3,3.3,1.0,2.95,"red"],["b",5.0,13.3,-3.3,3.3,1.0,2.95,"red"],["b",16.7,18.7,-3.3,3.3,1.0,2.95,"red"]],"wheels":[[3.3,1.45,2.55,3.35],[15.0,1.45,2.55,3.35]],"heads":[[0.3,2.8,2.9],[0.3,-2.8,2.9]],"tails":[[18.9,2.92,3.15],[18.9,-2.92,3.15]],"stacks":[],"pipe":[18.9,2.2,1.0]},"sedan":{"L":16.4,"W":3.1,"top":4.55,"over":true,"prims":[["b",0.0,0.4,-3.15,3.15,0.9,1.6,"chrome"],["b",0.1,0.45,-2.8,2.8,0.7,0.9,"dark"],["b",0.3,0.45,-1.9,1.9,1.75,2.7,"chrome"],["b",0.25,0.35,-1.75,1.75,1.85,2.6,"dark"],["b",0.22,0.27,-1.75,1.75,2.05,2.15,"chrome"],["b",0.22,0.27,-1.75,1.75,2.35,2.45,"chrome"],["b",0.3,0.45,1.95,3.0,1.95,2.75,"chrome"],["b",0.3,0.45,-3.0,-1.95,1.95,2.75,"chrome"],["b",0.25,0.32,2.05,2.9,2.05,2.65,"lamp"],["b",0.25,0.32,-2.9,-2.05,2.05,2.65,"lamp"],["b",0.45,16.0,-3.1,3.1,2.45,3.0,"cream"],["b",4.8,11.2,-2.75,2.75,3.0,4.4,"cream"],["b",5.3,10.9,-2.6,2.6,4.4,4.55,"cream"],["b",4.75,4.85,-2.5,2.5,3.1,4.3,"glass"],["b",11.15,11.25,-2.4,2.4,3.1,4.25,"glass"],["b",5.3,7.9,2.75,2.79,3.12,4.3,"glass"],["b",8.2,10.7,2.75,2.79,3.12,4.3,"glass"],["b",5.3,7.9,-2.79,-2.75,3.12,4.3,"glass"],["b",8.2,10.7,-2.79,-2.75,3.12,4.3,"glass"],["b",0.6,15.9,3.1,3.14,2.25,2.33,"chrome"],["b",0.6,15.9,-3.14,-3.1,2.25,2.33,"chrome"],["b",15.98,16.08,1.6,3.0,2.2,2.85,"tail"],["b",15.98,16.08,-3.0,-1.6,2.2,2.85,"tail"],["b",16.0,16.4,-3.15,3.15,0.9,1.6,"chrome"],["b",4.84,4.96,3.1,3.13,1.7,2.95,"dark"],["b",4.84,4.96,-3.13,-3.1,1.7,2.95,"dark"],["b",7.99,8.11,3.1,3.13,1.7,2.95,"dark"],["b",7.99,8.11,-3.13,-3.1,1.7,2.95,"dark"],["b",10.94,11.06,3.1,3.13,1.7,2.95,"dark"],["b",10.94,11.06,-3.13,-3.1,1.7,2.95,"dark"],["b",1.5,4.5,-2.8,2.8,0.9,2.45,"dark"],["b",11.4,14.4,-2.8,2.8,0.9,2.45,"dark"],["b",0.45,1.5,-3.1,3.1,1.0,2.45,"cream"],["b",4.5,11.4,-3.1,3.1,1.0,2.45,"cream"],["b",14.4,16.0,-3.1,3.1,1.0,2.45,"cream"]],"wheels":[[3.0,1.25,2.35,3.08],[12.9,1.25,2.35,3.08]],"heads":[[0.28,2.48,2.35],[0.28,-2.48,2.35]],"tails":[[16.1,2.3,2.5],[16.1,-2.3,2.5]],"stacks":[],"pipe":[16.4,2.0,0.9]}} as const;
const VGAP = {"coming": {"pickup>pickup": 257.2, "pickup>sedan": 257.2, "sedan>pickup": 238.3, "sedan>sedan": 238.3}, "going": {"pickup>pickup": 162.8, "pickup>sedan": 162.8, "sedan>pickup": 162.8, "sedan>sedan": 162.8}} as const;
// </vehicles>

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

// --- Things that cross either shot: birds, a train, lights -----------------------------------------------------

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

/** A lamp at dusk: its bright pixel and a soft halo, added to what's behind it. */
function lamp(a: Ctx, x: number, y: number, c: RGB, r: number, core = 1): void {
  a.save();
  a.globalCompositeOperation = "lighter";
  const rr = Math.max(1, r);
  for (let dy = -Math.ceil(rr); dy <= Math.ceil(rr); dy++) {
    for (let dx = -Math.ceil(rr); dx <= Math.ceil(rr); dx++) {
      const d = Math.hypot(dx, dy) / (rr + 0.5);
      if (d >= 1) continue;
      a.fillStyle = rgb(c, 0.38 * (1 - d) * (1 - d));
      a.fillRect(Math.round(x) + dx, Math.round(y) + dy, 1, 1);
    }
  }
  a.restore();
  rect(a, x - (core > 1 ? 1 : 0), y, core, core > 1 ? 2 : 1, rgb(c.map((v) => Math.min(255, v + 60)) as unknown as RGB));
}
const HEAD: RGB = [255, 232, 170];
const TAIL: RGB = [255, 40, 30];
const MARKER: RGB = [255, 160, 50];

/** A headlight's wash on the road ahead, `dir` the way it points, from (x, y) at the road's level, `len` long. */
function beam(a: Ctx, x: number, y: number, dir: number, len: number, alpha: number): void {
  a.save();
  a.globalCompositeOperation = "lighter";
  for (let i = 1; i < len; i++) {
    const half = 0.5 + i / 9;
    a.fillStyle = `rgba(255,226,150,${alpha * (1 - i / len)})`;
    a.fillRect(Math.round(x + dir * i), Math.round(y - half), 1, Math.max(1, Math.round(half * 2)));
  }
  a.restore();
}

/** Puffs of exhaust from (x, y), drifting back (`dir` the way the vehicle faces) and up, fading; `pale` for diesel smoke. */
function exhaust(a: Ctx, x: number, y: number, dir: number, t: number, seed: number, n: number, reach: number, pale: boolean): void {
  for (let i = 0; i < n; i++) {
    const age = (t * 1.7 + i / n + dice(seed, 9)) % 1;
    const c: RGB = pale ? (age < 0.5 ? [182, 196, 220] : [123, 141, 176]) : [104, 98, 118];
    a.fillStyle = rgb(c, (pale ? 0.75 : 0.5) * (1 - age));
    const s = 1 + Math.round(age * (pale ? 3 : 1.5));
    a.fillRect(Math.round(x - dir * age * reach), Math.round(y - age * reach * 0.5), s, s);
  }
}

/**
 * Now and then a train on the far rails, always led by its locomotive: a freight (its cars in railroad colours, a red
 * caboose or a flashing end-of-train marker at the back) or a short passenger train with its windows lit. The engine is
 * drawn for the way it runs: a short nose, the cab (taller, its window lit), the long hood with its stripe and its stack
 * puffing, the headlight and its beam down the rails, the trucks' wheels flickering as they turn. A track only ever
 * carries one train at a time, and always the same way (`dir`): each 34 s slot holds at most one, wholly inside the
 * slot, so two never meet.
 */
function train(a: Ctx, aw: number, rail: number, t: number, seed: number, carW: number, carH: number, dir: number, drift: number): void {
  const SLOT = 34;
  const k = Math.floor(t / SLOT);
  if (dice(seed, k, 11) > 0.6) return;
  const passenger = dice(seed, k, 17) < 0.35;
  const caboose = !passenger && dice(seed, k, 18) < 0.5;
  const LOC = carW * 2 + 2; // the locomotive's length
  const speed = (26 + dice(seed, k, 14) * 16) * (carW / 9) + drift; // on screen, px a second
  const fit = Math.floor((speed * (SLOT - 2) - aw - 8 - LOC) / (carW + 1)) - 2; // the most cars that cross inside the slot
  const n = Math.max(3, Math.min(fit, passenger ? 4 + Math.floor(dice(seed, k, 15) * 4) : 12 + Math.floor(dice(seed, k, 15) * 18)));
  const len = LOC + 1 + (n + (caboose ? 1 : 0)) * (carW + 1);
  const dur = (aw + len + 8) / speed;
  const t0 = k * SLOT + dice(seed, k, 12) * Math.max(0, SLOT - 1 - dur);
  if (t < t0 || t > t0 + dur) return;
  const head = dir > 0 ? -4 + (t - t0) * speed : aw + 4 - (t - t0) * speed;
  // The left x of a piece `w` long whose front is `off` behind the engine's nose.
  const at = (off: number, w: number): number => Math.round(dir > 0 ? head - off - w : head + off);
  const turn = Math.floor(t * 7) % 2;
  const wheels = (x: number, w: number) => {
    rect(a, x + 1, rail, w - 2, 1, PAL.ink0);
    for (const bx of w > 6 ? [x + 1, x + 2, x + w - 3, x + w - 2] : [x + 1, x + w - 2]) if ((bx + turn) % 2 === 0) rect(a, bx, rail, 1, 1, PAL.steel);
  };
  const cars = [PAL.rust, PAL.clay, PAL.mtnD, PAL.amberD, PAL.steel, PAL.redD, PAL.mtn];
  for (let i = n - 1 + (caboose ? 1 : 0); i >= 0; i--) {
    const x = at(LOC + 1 + i * (carW + 1), carW);
    if (x < -carW - 16 || x > aw + 16) continue;
    const last = i === n - 1 + (caboose ? 1 : 0);
    if (caboose && i === n) {
      // The caboose: red, its cupola up out of the roof, a lit window, the marker lamp at its tail.
      rect(a, x, rail - carH, carW, carH, PAL.red);
      rect(a, x, rail - carH, carW, 1, PAL.redD);
      rect(a, x + Math.floor(carW / 2) - 1, rail - carH - 1, Math.max(2, Math.floor(carW / 3)), 1, PAL.redD);
      rect(a, x + Math.floor(carW / 2), rail - carH + Math.min(1, carH - 1), 1, 1, PAL.gold);
    } else if (passenger) {
      rect(a, x, rail - carH, carW, carH, PAL.fog);
      rect(a, x, rail - carH, carW, 1, PAL.mist);
      for (let wx = x + 1; wx < x + carW - 1; wx += 2) rect(a, wx, rail - carH + Math.min(1, carH - 2), 1, 1, PAL.gold);
    } else rect(a, x, rail - carH, carW, carH, pick(cars, dice(seed, k, i, 16)));
    wheels(x, carW);
    if (last) lamp(a, dir > 0 ? x : x + carW - 1, rail - 1, TAIL, 1 + (Math.floor(t * 2) % 2)); // the end-of-train marker, flashing
  }
  // The locomotive, last, over the cars: nose, cab, long hood, from its front back.
  const lx = at(0, LOC);
  const hoodH = carH + 1;
  const cabH = carH + 3;
  const nose = Math.max(1, Math.round(LOC * 0.1));
  const cab = Math.max(3, Math.round(LOC * 0.25));
  const body = passenger ? PAL.mist : PAL.ink3;
  const stripe = passenger ? PAL.red : PAL.amber;
  for (let u = 0; u < LOC; u++) {
    const x = dir > 0 ? lx + LOC - 1 - u : lx + u;
    const h = u < nose ? hoodH - 1 : u < nose + cab ? cabH : hoodH;
    rect(a, x, rail - h, 1, h, body);
    rect(a, x, rail - h, 1, 1, passenger ? PAL.white : PAL.steel);
    rect(a, x, rail - 2, 1, 1, stripe);
  }
  for (let u = nose + 1; u < nose + cab - 1; u++) rect(a, dir > 0 ? lx + LOC - 1 - u : lx + u, rail - cabH + 1, 1, Math.max(1, Math.floor(carH / 2)), PAL.gold);
  wheels(lx, LOC);
  const nx = dir > 0 ? lx + LOC : lx - 1; // just ahead of the nose
  beam(a, nx, rail - hoodH + 1, dir, carW * 3 + 8, 0.34);
  lamp(a, nx, rail - hoodH + 1, HEAD, carW > 6 ? 2 : 1);
  const stack = dir > 0 ? lx + LOC - 1 - (nose + cab + 2) : lx + nose + cab + 2;
  exhaust(a, stack, rail - hoodH - 1, dir, t, seed * 31 + k, 5, carW + 6, false);
}

// --- The side view -------------------------------------------------------------------------------------------

// The road's rows in the band: the dirt shoulder, the asphalt with its edge lines, the far lane (the oncoming traffic's
// tyres on `far`), the centre line, the near lane (the rig's tyres on `near`); the poles' tops and crossarms; the rails.
const ROW = { shoulder: 96, road: 103, far: 111, centre: 115, near: 125, roadEnd: 128, arm: 44, poleTop: 40, rail: 95 } as const;
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

/** A wheel centred on (cx, cy): 7 × 7 (r 3) or 5 × 5 (r 2); `turn` (0–3) walks its spoke round so it rolls. */
function wheel(a: Ctx, cx: number, cy: number, turn: number, r = 3): void {
  const d = r * 2 + 1;
  const x = Math.round(cx) - r;
  const y = Math.round(cy) - r;
  a.fillStyle = PAL.ink0;
  a.fillRect(x + 1, y, d - 2, d);
  a.fillRect(x, y + 1, d, d - 2);
  a.fillStyle = PAL.ink2;
  a.fillRect(x + 1, y + 1, d - 2, d - 2);
  if (r > 2) {
    a.fillStyle = PAL.fog;
    a.fillRect(x + 2, y + 2, 3, 3);
  }
  // The bright hub and one bright spoke out to the rim, a quarter turn a step.
  const [dx, dy] = ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const)[turn & 3]!;
  a.fillStyle = PAL.white;
  a.fillRect(x + r, y + r, 1, 1);
  for (let i = 1; i < r; i++) a.fillRect(x + r + dx * i, y + r + dy * i, 1, 1);
  a.fillStyle = PAL.mist;
  a.fillRect(x + r + dx * r, y + r + dy * r, 1, 1);
}
/** How far round a wheel of radius r has turned after rolling `dist` px, in quarter turns; mirrored for one facing left. */
const turnOf = (dist: number, r: number, dir: number): number => {
  const q = Math.floor(dist / ((Math.PI * (2 * r + 1)) / 4)) & 3;
  return dir > 0 ? q : (4 - q) & 3;
};
/** A body's bounce on the road: a pixel up, now and then, at a rhythm set by the distance it has covered. */
const bounce = (dist: number, seed: number): number => (Math.floor(dist / 23 + dice(seed, 8) * 5) % 5 === 0 ? -1 : 0);

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

/**
 * A semi, its left end at x and its tyres on `ground`, facing right (dir 1) or left, at dusk: wheels rolling with the
 * distance it has covered, the tractor riding its springs, the headlight and its wash, the trailer's amber clearance
 * lights and red tail lights, smoke from the stack.
 */
function semi(a: Ctx, x: number, ground: number, dir: number, paint: string, kind: Trailer, dist: number, t: number, seed: number, wash = 40): void {
  const len = rigLength();
  const tx = rigTractorX();
  const th = sh(paint);
  const bob = bounce(dist, seed);
  const turn = turnOf(dist, 3, 1);
  const at = (lx: number): number => (dir > 0 ? x + lx : x + len - 1 - lx); // the rig's own x to the screen's
  if (wash > 0) beam(a, at(len), ground - 3, dir, wash, 0.3);
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
  const top = ground - (TH - 1);
  if (kind !== "flatbed" && kind !== "tanker") {
    lamp(a, at(1), top + 1, MARKER, 1);
    lamp(a, at(TL - 2), top + 1, MARKER, 1);
  }
  lamp(a, at(1), ground - 12, TAIL, 1);
  lamp(a, at(TL / 2), ground - 12, MARKER, 1);
  lamp(a, at(len - 1), ground - (th - 1) + 25 + bob, HEAD, 2);
  exhaust(a, at(tx + Math.round(sw(paint) * 0.56)), ground - (th - 1) + bob - 2, dir, t, seed, 6, 18, true);
}

/**
 * The pickup or the sedan from the side, its left end at x and its tyres on `ground`, facing right or left, at dusk;
 * `paint` is its sprite (the pickup has two).
 */
function sideCar(a: Ctx, kind: "pickup" | "sedan", paint: string, x: number, ground: number, dir: number, dist: number, t: number, seed: number): void {
  const m = CARS[kind];
  const w = sw(paint);
  const top = ground - sh(paint) + 1;
  const bob = bounce(dist, seed);
  const at = (lx: number): number => (dir > 0 ? x + lx : x + w - 1 - lx);
  beam(a, at(w), ground - 2, dir, 34, 0.28);
  exhaust(a, at(m.pipe[0]), top + m.pipe[1], dir, t, seed, 3, 9, false);
  spr(a, paint, x, top + bob, dir < 0);
  const turn = turnOf(dist, m.r, dir);
  for (const [wx, wy] of m.wheels) wheel(a, at(wx), top + wy, turn, m.r);
  lamp(a, at(m.head[0]), top + m.head[1] + bob, HEAD, 2);
  lamp(a, at(m.tail[0]), top + m.tail[1] + bob, TAIL, 1);
}

// The speed limit sign's small letters, 3 × 5 (I is one wide): rows as 3-bit numbers, most significant bit on the left.
const MICRO: Record<string, readonly number[]> = {
  S: [7, 4, 7, 1, 7],
  P: [7, 5, 7, 4, 4],
  E: [7, 4, 6, 4, 7],
  D: [6, 5, 5, 5, 6],
  L: [4, 4, 4, 4, 7],
  I: [1, 1, 1, 1, 1],
  M: [5, 7, 7, 5, 5],
  T: [7, 2, 2, 2, 2],
};
const microW = (s: string): number => [...s].reduce((w, ch) => w + (ch === "I" ? 1 : 3) + 1, -1);
function micro(a: Ctx, s: string, x: number, y: number, c: string): void {
  a.fillStyle = c;
  for (const ch of s) {
    const w = ch === "I" ? 1 : 3;
    (MICRO[ch] ?? []).forEach((row, r) => {
      for (let i = 0; i < w; i++) if (row & (1 << (w - 1 - i))) a.fillRect(x + i, y + r, 1, 1);
    });
    x += w + 1;
  }
}

/** A speed limit sign as the road has them: a white panel with a black border, SPEED LIMIT, then 65 in big numerals. */
const SPEED_W = 23;
function speedSign(a: Ctx, x: number, base: number): void {
  const h = 26;
  const top = base - 12 - h;
  rect(a, x + 11, base - 12, 1, 13, PAL.fog);
  rect(a, x, top, SPEED_W, h, PAL.ink0);
  rect(a, x + 1, top + 1, SPEED_W - 2, h - 2, PAL.white);
  micro(a, "SPEED", x + Math.round((SPEED_W - microW("SPEED")) / 2), top + 3, PAL.ink0);
  micro(a, "LIMIT", x + Math.round((SPEED_W - microW("LIMIT")) / 2), top + 9, PAL.ink0);
  drawText(a, "65", x + Math.round((SPEED_W - textWidth("65")) / 2), top + 16, 1, PAL.ink0);
}

const guideW = (text: string): number => textWidth(text) + 5;
function guideSign(a: Ctx, x: number, base: number, text: string): void {
  const w = guideW(text);
  rect(a, x + 3, base - 16, 1, 17, PAL.mist);
  rect(a, x + w - 4, base - 16, 1, 17, PAL.mist);
  rect(a, x, base - 28, w, 12, PAL.paper);
  rect(a, x + 1, base - 27, w - 2, 10, PAL.forest);
  drawText(a, text, x + 3, base - 26, 1, PAL.white);
}

const BILLBOARD_W = 64;
function billboard(a: Ctx, x: number, base: number, lines: readonly string[]): void {
  rect(a, x + 14, base - 14, 2, 15, PAL.mtnD);
  rect(a, x + 48, base - 14, 2, 15, PAL.mtnD);
  rect(a, x, base - 34, BILLBOARD_W, 21, PAL.ink0);
  rect(a, x + 1, base - 33, BILLBOARD_W - 2, 19, PAL.ink2);
  drawText(a, lines[0]!, x + 32 - Math.round(textWidth(lines[0]!) / 2), base - 31, 1, PAL.gold);
  drawText(a, lines[1]!, x + 32 - Math.round(textWidth(lines[1]!) / 2), base - 22, 1, PAL.paper);
  lamp(a, x + 5, base - 36, MARKER, 1);
  lamp(a, x + 58, base - 36, MARKER, 1);
}

// Everything by the road is placed by distance along it, so nothing ever stands in anything else: the poles first, one
// every POLE_GAP px; a gap between two poles holds a diner (most stretches of 16 gaps have one), or a billboard across
// its middle, or else one thing in each half (a plant, the mile marker, and in every seventh gap at most one sign), kept
// inside its half and clear of the poles.
const POLE_GAP = 128;
const HALF = POLE_GAP / 2;
const SIGNS = ["FUEL 2 MI", "GALLUP 42", "REST AREA", "EXIT 117"] as const;
const BOARDS = [["DINER", "NEXT EXIT"], ["ONE WORLD", "REAL CLOCK"], ["DIESEL", "OPEN 24 HRS"]] as const;
type Stand = { kind: "diner" } | { kind: "billboard"; lines: readonly string[] } | { kind: "halves"; parts: readonly (string | null)[] };
function standIn(g: number): Stand {
  const block = Math.floor(g / 16);
  if (dice(block, 49) < 0.75 && g === block * 16 + 3 + Math.floor(dice(block, 50) * 10)) return { kind: "diner" };
  const signAt = g % 7 === 3 && dice(g, 41) < 0.6 ? Math.floor(dice(g, 42) * 2) : -1;
  if (signAt < 0 && dice(g, 31) < 0.07) return { kind: "billboard", lines: pick(BOARDS, dice(g, 15)) };
  const part = (h: number): string | null => {
    if (h === 0 && g % 16 === 0) return "mile";
    if (h === signAt) return dice(g, 43) < 0.55 ? "speed" : `sign:${pick(SIGNS, dice(g, h, 14))}`;
    const r = dice(g, h, 11);
    return r < 0.14 ? "saguaro" : r < 0.26 ? "pear" : r < 0.42 ? "sage" : r < 0.52 ? "rocks" : r < 0.64 ? "grass" : null;
  };
  return { kind: "halves", parts: [part(0), part(1)] };
}
const partW = (p: string): number => (p === "mile" ? 7 : p === "speed" ? SPEED_W : p.startsWith("sign:") ? guideW(p.slice(5)) : sw(p));

function roadside(a: Ctx, aw: number, by: number, D: number, t: number): void {
  const base = by + ROW.road - 1;
  const g0 = Math.floor((D - POLE_GAP) / POLE_GAP);
  const g1 = Math.floor((D + aw) / POLE_GAP);
  // The diners first: set back behind the poles' line, each filling a whole gap.
  for (let g = g0; g <= g1; g++) {
    if (standIn(g).kind !== "diner") continue;
    const x = g * POLE_GAP + 10 - D;
    spr(a, "diner", x, base - sh("diner") + 1);
    if (dice(Math.floor(t * 9), g) < 0.07) rect(a, x + 40, base - sh("diner") + 1, 40, 12, "rgba(18,9,26,0.5)");
  }
  poles(a, aw, by, D);
  for (let g = g0; g <= g1; g++) {
    const s = standIn(g);
    const X = g * POLE_GAP - D;
    if (s.kind === "billboard") billboard(a, X + HALF - BILLBOARD_W / 2, base, s.lines);
    if (s.kind !== "halves") continue;
    s.parts.forEach((p, h) => {
      if (!p) return;
      const lo = X + h * HALF + 4;
      const room = HALF - 7 - partW(p);
      const x = Math.round(lo + dice(g, h, 12) * Math.max(0, room));
      const y = base + Math.floor(dice(g, h, 13) * 2);
      if (p === "mile") {
        rect(a, x + 3, base - 8, 1, 9, PAL.mist);
        rect(a, x, base - 17, 7, 9, PAL.grassD);
        drawText(a, String((117 + g / 16) % 10), x + 1, base - 16, 1, PAL.white);
      } else if (p === "speed") speedSign(a, x, base);
      else if (p.startsWith("sign:")) guideSign(a, x, base, p.slice(5));
      else spr(a, p, x, y - sh(p) + (p === "sage" ? 6 : 0));
    });
  }
}

/** Telephone poles along the road, one every POLE_GAP px, and the wires sagging between them. */
function poles(a: Ctx, aw: number, by: number, D: number): void {
  const k0 = Math.floor((D - 10) / POLE_GAP);
  const k1 = Math.ceil((D + aw + 10) / POLE_GAP);
  a.fillStyle = WIRE;
  for (let k = k0; k <= k1; k++) {
    const x0 = k * POLE_GAP - D;
    for (const end of [-6, 6]) {
      for (let i = 0; i <= POLE_GAP; i++) {
        const f = i / POLE_GAP;
        const x = Math.round(x0 + end + i);
        if (x < 0 || x >= aw) continue;
        a.fillRect(x, by + ROW.arm + 1 + Math.round(12 * f * (1 - f)), 1, 1);
      }
    }
  }
  for (let k = k0; k <= k1; k++) {
    const x = Math.round(k * POLE_GAP - D);
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
  dist: number;
  seed: number;
  paint: string; // its sprite: a tractor's paint, or the pickup's
  trailer: Trailer;
}
/**
 * The oncoming traffic at time t of side shot n, driving left in the far lane. It's a desert (Jeff, 2026-11-02: "barely
 * any traffic"): the shot's 30 s are three 10 s slots, shuffled, one holding a pickup (the first titles' own, red or
 * slate teal), one a semi in another paint with a van, a reefer, a flatbed or a tanker, and one a sedan, the other
 * pickup or nothing. Each crosses the screen in two seconds or less, well inside its slot and clear of the fades, so two
 * are never on screen at once.
 */
function oncoming(n: number, aw: number, t: number): Car | null {
  const OWN = 80; // its speed over the road; on screen it closes at that and the rig's
  const SLOT = 10;
  const s0 = (n * SHOT_MS) / 1000;
  const j = Math.floor((t - s0) / SLOT);
  if (j < 0 || j > 2) return null;
  const order = [0, 1, 2];
  for (let i = 2; i > 0; i--) {
    const r = Math.floor(dice(n, i, 81) * (i + 1));
    [order[i], order[r]] = [order[r]!, order[i]!];
  }
  const teal = dice(n, 82) < 0.5;
  let kind: Car["kind"] = "pickup";
  let paint = teal ? "pickup-teal" : "pickup";
  if (order[j] === 1) {
    kind = "semi";
    paint = pick(["tractor-red", "tractor-white", "tractor-amber"], dice(n, 83));
  } else if (order[j] === 2) {
    const r = dice(n, 84);
    if (r < 0.3) return null;
    if (r < 0.7) kind = paint = "sedan";
    else paint = teal ? "pickup" : "pickup-teal";
  }
  const len = kind === "semi" ? rigLength() : sw(paint);
  // It comes in at the right edge somewhere in its slot: after the fade in, and early enough to be gone before the slot
  // ends (the last one's before the shot fades out).
  const ts = s0 + j * SLOT + 1.5 + dice(n, j, 85) * (j === 2 ? 4.5 : 5.5);
  const x = aw + 4 - (t - ts) * (V + OWN);
  if (t < ts || x < -len - 4) return null;
  return { kind, x, dist: (t - ts) * OWN, seed: n * 7 + j, paint, trailer: pick(TRAILERS, dice(n, 86)) };
}

/** Tumbleweeds rolling along the far shoulder with the wind, bouncing, slower than the ground they roll over, half size. */
function tumbleweeds(a: Ctx, aw: number, baseY: number, t: number, ground: number, seed: number): void {
  const SLOT = 6;
  for (let k = Math.floor((t - 8) / SLOT); k <= Math.floor(t / SLOT); k++) {
    if (dice(seed, k, 51) > 0.45) continue;
    const t0 = k * SLOT + dice(seed, k, 52) * SLOT;
    const wind = 40 + dice(seed, k, 53) * 40;
    const x = aw + 6 - (t - t0) * (ground - wind);
    if (t < t0 || x < -20) continue;
    const name = `weed${Math.floor((t - t0) * 9) % 4}`;
    const r = SPR[name];
    if (!r) continue;
    const size = Math.round(r[2] / 2);
    const y = baseY - Math.floor(dice(seed, k, 54) * 2) - Math.abs(Math.sin((t - t0) * 6)) * 3;
    a.drawImage(atlas(), r[0], r[1], r[2], r[3], Math.round(x), Math.round(y - size), size, size);
  }
}

function sideShot(a: Ctx, aw: number, ah: number, t: number, n: number): void {
  const by = bandTop(ah);
  const D = Math.round(V * t);
  const back = pics![1]!;
  const tx = textures();
  if (by > 0) skyAbove(a, aw, by, topOf(back), t);
  a.drawImage(back, Math.round((aw - BW) / 2), by);
  birds(a, aw, Math.max(4, by + 14), by + 56, t, 1);
  rect(a, 0, by + ROW.rail, aw, 1, "rgba(16,23,42,0.55)");
  train(a, aw, by + ROW.rail, t, 6, 9, 5, -1, V * 0.15);
  tile(a, tx.dirt, -D, by + ROW.shoulder, aw);
  roadside(a, aw, by, D, t);
  tumbleweeds(a, aw, by + ROW.road - 1, t, V, 3); // on the shoulder beyond the road, never on it
  tile(a, tx.asphalt, -D, by + ROW.road, aw);
  a.fillStyle = DASH;
  for (let x = ((-D % 32) + 32) % 32 - 32; x < aw; x += 32) a.fillRect(x, by + ROW.centre, 12, 2);
  // Now and then something coming the other way in the far lane, behind the rig (Jeff, 2026-11-02: "the right (bottom)
  // lane with incoming traffic in the left lane").
  const c = oncoming(n, aw, t);
  if (c?.kind === "semi") semi(a, c.x, by + ROW.far, -1, c.paint, c.trailer, c.dist, t, c.seed);
  else if (c) sideCar(a, c.kind, c.paint, c.x, by + ROW.far, -1, c.dist, t, c.seed);
  // The rig in the near lane: its shadow, then the rig with its lights and smoke.
  const len = rigLength();
  const x = Math.round(aw / 2 - len / 2) + 4;
  const g = by + ROW.near;
  rect(a, x + 3, g - 1, len - 6, 2, "rgba(10,8,20,0.35)");
  semi(a, x, g, 1, "tractor", "ours", D, t, 0, 56);
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
    const fy = by + ROW.roadEnd + 2 + sh(name) + Math.floor(dice(k, 62) * 6); // wholly below the road's edge
    spr(a, name, k * SLOT + dice(k, 63) * 24 - F, fy - sh(name));
  }
}

// --- The head-on view ----------------------------------------------------------------------------------------

const RAIL = 86; // the far rails, along the foot of the mesas
const PASS = 60; // feet a second the far lane's car pulls away from the camera once it has overtaken it
const HSPEED = 80; // the world's speed past the camera, feet a second (55 mph)
// Which way the world goes by (Jeff, 2026-11-02: the things beside the road stood still while the road moved): the
// road and everything by it stream at the camera from the horizon, growing as they come and sliding out past the
// frame (-1); +1 would have them fall away toward the horizon behind the rig.
const DRIFT = -1;
const ROAD = { right: -1.8, left: -32, centre: -17 } as const; // across the road from the camera, feet
const HAZE: RGB = [122, 84, 104]; // the painting's ground at the horizon
const RIG_DEPTH = 40; // feet: what's nearer than this draws in front of the painted rig
const DINER_U = 100; // the painted diner stands this far off when the shot opens
const DINER_X = ((DINER_AT[0] + 38.5 - 211) * 100) / 120; // and this far across (from its place in the painting)
// The painted rig's parts, in the painting: its stacks' tops, its headlights, a grille bar (x, top, length), a mirror,
// the hubs of the front wheels you can see.
const RIG_STACKS = [[147, 62], [170, 61]] as const;
const RIG_LAMPS = [[136, 96], [157, 96]] as const;
const RIG_GRILLE = [145, 86, 12] as const;
const RIG_MIRROR = [130, 81] as const;
const RIG_HUBS = [[139, 105], [162, 104]] as const;

type VKind = keyof typeof VMODELS;
type View = "coming" | "going";
type V3 = [number, number, number];

/** A point in front of the painting's camera (x feet to its right, y ahead, z up), in band pixels. */
const proj = (p: V3): [number, number] => [VCAM.px + (VCAM.f * p[0]) / p[1], VCAM.py + (VCAM.f * (VCAM.h - p[2])) / p[1]];

interface Rider {
  kind: VKind;
  view: View;
  /** The anchor's depth in feet: its front bumper's when coming, its rear bumper's when going. */
  d: number;
  /** Feet it has driven, for its wheels and its springs. */
  dist: number;
  seed: number;
}

/** A vehicle-frame point (x from the front bumper back, y to its right, z up) in the world, for rider r. */
function worldOf(r: Rider, x: number, y: number, z: number): V3 {
  const X = VLANES[r.view];
  return r.view === "coming" ? [X - y, r.d + x, z] : [X + y, r.d + (VMODELS[r.kind].L - x), z];
}
/** A vehicle-frame direction in the world. */
function dirOf(r: Rider, x: number, y: number, z: number): V3 {
  return r.view === "coming" ? [-y, x, z] : [y, -x, z];
}

// The traffic is rasterised live into its own buffer at the art's pixel size, one sample a pixel so its edges are as
// crisp as the painting's: every face of every model, nearest wins, then the dark outline round each silhouette and
// wherever the depth jumps (the old sheets' look), then it's laid over the painting.
let rast: { w: number; h: number; col: Uint32Array; near: Float64Array; cv: HTMLCanvasElement; img: ImageData; box: [number, number, number, number] } | null = null;
function raster(w: number, h: number): NonNullable<typeof rast> {
  if (!rast || rast.w !== w || rast.h !== h) {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const img = cv.getContext("2d")!.createImageData(w, h);
    rast = { w, h, col: new Uint32Array(img.data.buffer), near: new Float64Array(w * h), cv, img, box: [w, h, 0, 0] };
  }
  return rast;
}
const GRADED = new Set(["cyan", "red", "cream", "amberp", "whitep", "white", "tarp", "deck"]);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const ramps = new Map<string, number[]>();
/** A material's ramp as little-endian RGBA words, dark to light. */
function rampOf(mat: string): number[] {
  let r = ramps.get(mat);
  if (!r) {
    r = (VRAMPS[mat] ?? VRAMPS["dark"]!).map(([red, g, b]) => ((255 << 24) | (b << 16) | (g << 8) | red) >>> 0);
    ramps.set(mat, r);
  }
  return r;
}
const packed = new Map<string, number>();
/** A material's colour at a light level in [0, 1], as one little-endian RGBA word. */
function shadeOf(mat: string, s: number): number {
  const ramp = VRAMPS[mat] ?? VRAMPS["dark"]!;
  const i = Math.max(0, Math.min(ramp.length - 1, Math.floor(s * ramp.length)));
  const key = `${mat}${i}`;
  let c = packed.get(key);
  if (c === undefined) {
    const [r, g, b] = ramp[i]!;
    c = (255 << 24) | (b << 16) | (g << 8) | r;
    packed.set(key, c >>> 0);
    c = c >>> 0;
  }
  return c;
}

/** One flat face (a convex polygon in the world, its outward normal) filled into the raster where it's nearest. */
function face(R: NonNullable<typeof rast>, ox: number, by: number, pts: V3[], n: V3, mat: string, lit?: number): void {
  // Facing away from the camera (at 0, 0, h)?
  const p0 = pts[0]!;
  if (n[0] * p0[0] + n[1] * p0[1] + n[2] * (p0[2] - VCAM.h) >= 0) return;
  // Clip to just in front of the camera.
  const NEAR = 0.6;
  const poly: V3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    if (a[1] >= NEAR) poly.push(a);
    if (a[1] >= NEAR !== b[1] >= NEAR) {
      const f = (NEAR - a[1]) / (b[1] - a[1]);
      poly.push([a[0] + (b[0] - a[0]) * f, NEAR, a[2] + (b[2] - a[2]) * f]);
    }
  }
  if (poly.length < 3) return;
  const sc = poly.map((p) => {
    const [x, y] = proj(p);
    return [x + ox, y + by, 1 / p[1]] as const;
  });
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of sc) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const yA = Math.max(0, Math.ceil(y0 - 0.5));
  const yB = Math.min(R.h - 1, Math.floor(y1 - 0.5));
  if (yB < yA || x1 < 0 || x0 > R.w) return;
  // Nearness (1/depth) is a plane over the screen for a flat face.
  const [ax, ay, az] = sc[0]!;
  let pl: [number, number, number] | null = null;
  for (let i = 1; i + 1 < sc.length && !pl; i++) {
    const [bx, by2, bz] = sc[i]!;
    const [cx, cy, cz] = sc[i + 1]!;
    const det = (bx - ax) * (cy - ay) - (cx - ax) * (by2 - ay);
    if (Math.abs(det) < 1e-9) continue;
    const A = ((bz - az) * (cy - ay) - (cz - az) * (by2 - ay)) / det;
    const B = ((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / det;
    pl = [A, B, az - A * ax - B * ay];
  }
  if (!pl) return;
  const s = lit ?? 0.3 + 0.7 * Math.max(0, n[0] * VSUN[0] + n[1] * VSUN[1] + n[2] * VSUN[2]);
  const col = shadeOf(mat, s);
  // Painted panels darken toward the road, dithered between their ramp's steps, so a big face reads as lit sheet
  // metal rather than a slab of one colour.
  const ramp = lit === undefined && GRADED.has(mat) ? rampOf(mat) : null;
  const box = R.box;
  for (let y = yA; y <= yB; y++) {
    const cy = y + 0.5;
    let l = Infinity;
    let r = -Infinity;
    for (let i = 0; i < sc.length; i++) {
      const [px, py] = sc[i]!;
      const [qx, qy] = sc[(i + 1) % sc.length]!;
      if (py <= cy !== qy <= cy) {
        const x = px + ((cy - py) / (qy - py)) * (qx - px);
        l = Math.min(l, x);
        r = Math.max(r, x);
      }
    }
    const xa = Math.max(0, Math.ceil(l - 0.5));
    const xb = Math.min(R.w - 1, Math.floor(r - 0.5));
    if (xb < xa) continue;
    const row = y * R.w;
    for (let x = xa; x <= xb; x++) {
      const z = pl[0] * (x + 0.5) + pl[1] * cy + pl[2];
      if (z > R.near[row + x]!) {
        R.near[row + x] = z;
        if (ramp) {
          const height = VCAM.h - (cy - by - VCAM.py) / (z * VCAM.f); // the pixel's height above the road, feet
          const g = 0.78 + 0.27 * Math.min(1, Math.max(0, height / 9));
          const i = Math.floor(s * g * ramp.length + BAYER[(x & 3) + (y & 3) * 4]! - 0.5);
          R.col[row + x] = ramp[Math.max(0, Math.min(ramp.length - 1, i))]!;
        } else R.col[row + x] = col;
      }
    }
    box[0] = Math.min(box[0], xa);
    box[2] = Math.max(box[2], xb + 1);
    box[1] = Math.min(box[1], y);
    box[3] = Math.max(box[3], y + 1);
  }
}

/** A box (vehicle frame bounds) as its six faces, lifted by `lift` feet. */
function boxFaces(R: NonNullable<typeof rast>, ox: number, by: number, r: Rider, b: readonly number[], mat: string, lift: number): void {
  const [x0, x1, y0, y1, z0, z1] = b as [number, number, number, number, number, number];
  const P = (x: number, y: number, z: number) => worldOf(r, x, y, z + lift);
  const faces: [V3, V3[]][] = [
    [dirOf(r, -1, 0, 0), [P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)]],
    [dirOf(r, 1, 0, 0), [P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)]],
    [dirOf(r, 0, -1, 0), [P(x0, y0, z0), P(x0, y0, z1), P(x1, y0, z1), P(x1, y0, z0)]],
    [dirOf(r, 0, 1, 0), [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)]],
    [dirOf(r, 0, 0, -1), [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)]],
    [dirOf(r, 0, 0, 1), [P(x0, y0, z1), P(x0, y1, z1), P(x1, y1, z1), P(x1, y0, z1)]],
  ];
  for (const [n, pts] of faces) face(R, ox, by, pts, n, mat);
}

/** A cylinder along a vehicle axis, as a prism of `sides` faces and its two caps. */
function cylFaces(R: NonNullable<typeof rast>, ox: number, by: number, r: Rider, axis: string, c0: number, c1: number, rad: number, lo: number, hi: number, mat: string, lift: number, sides = 10, capMat = mat): void {
  const P = (u: number, v: number, w: number): V3 => {
    // u, v round the axis, w along it
    const [x, y, z] = axis === "x" ? [w, u, v] : axis === "y" ? [u, w, v] : [u, v, w];
    return worldOf(r, x, y, z + lift);
  };
  const N = (u: number, v: number, w: number): V3 => {
    const [x, y, z] = axis === "x" ? [w, u, v] : axis === "y" ? [u, w, v] : [u, v, w];
    return dirOf(r, x, y, z);
  };
  const ring: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    ring.push([c0 + Math.cos(a) * rad, c1 + Math.sin(a) * rad]);
  }
  for (let i = 0; i < sides; i++) {
    const [ua, va] = ring[i]!;
    const [ub, vb] = ring[(i + 1) % sides]!;
    const am = ((i + 0.5) / sides) * Math.PI * 2;
    face(R, ox, by, [P(ua, va, lo), P(ub, vb, lo), P(ub, vb, hi), P(ua, va, hi)], N(Math.cos(am), Math.sin(am), 0), mat);
  }
  face(R, ox, by, ring.map(([u, v]) => P(u, v, lo)).reverse(), N(0, 0, -1), capMat);
  face(R, ox, by, ring.map(([u, v]) => P(u, v, hi)), N(0, 0, 1), capMat);
}

/**
 * A wheel at x (radius rad) on the side `sign` (+1 right, -1 left), from yin to yout across: the tyre, the rim on its
 * outer face, the bright hub and one bright spoke at angle `turn`, so it reads as turning from about 32 px.
 */
function wheelFaces(R: NonNullable<typeof rast>, ox: number, by: number, r: Rider, x: number, rad: number, yin: number, yout: number, sign: number, turn: number): void {
  const a = sign * yin;
  const b = sign * yout;
  cylFaces(R, ox, by, r, "y", x, rad, rad, Math.min(a, b), Math.max(a, b), "tyre", 0, 12);
  const out = b + sign * 0.04;
  const disc = (rr: number, yy: number, mat: string, lit?: number) => {
    const pts: V3[] = [];
    for (let i = 0; i < 10; i++) {
      const t = (i / 10) * Math.PI * 2 * sign;
      pts.push(worldOf(r, x + Math.cos(t) * rr, yy, rad + Math.sin(t) * rr));
    }
    face(R, ox, by, pts, dirOf(r, 0, sign, 0), mat, lit);
  };
  disc(rad * 0.6, out, "chrome");
  // The spoke: a thin bar from the hub to the rim's edge, turning.
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const w = rad * 0.11;
  const L = rad * 0.58;
  const yy = out + sign * 0.03;
  const q = (u: number, v: number): V3 => worldOf(r, x + u * c - v * s, yy, rad + u * s + v * c);
  const bar = sign > 0 ? [q(0, -w), q(L, -w), q(L, w), q(0, w)] : [q(0, w), q(L, w), q(L, -w), q(0, -w)];
  face(R, ox, by, bar, dirOf(r, 0, sign, 0), "white", 1);
  disc(rad * 0.16, yy + sign * 0.02, "white", 1);
}

/** The outlines: a dark ring round every silhouette, and the farther side wherever the depth jumps. */
function outline(R: NonNullable<typeof rast>): void {
  const [x0, y0, x1, y1] = R.box;
  const ink = ((255 << 24) | (34 << 16) | (11 << 8) | 13) >>> 0;
  const marks: number[] = [];
  const nbs = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
  for (let y = Math.max(0, y0 - 1); y < Math.min(R.h, y1 + 1); y++) {
    for (let x = Math.max(0, x0 - 1); x < Math.min(R.w, x1 + 1); x++) {
      const i = y * R.w + x;
      const me = R.near[i]!;
      for (const [dx, dy] of nbs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= R.w || ny >= R.h) continue;
        const nb = R.near[ny * R.w + nx]!;
        if (nb <= 0) continue;
        if (me <= 0 || 1 / me - 1 / nb > 1.5 + 0.06 / nb) {
          marks.push(i);
          break;
        }
      }
    }
  }
  for (const i of marks) {
    R.col[i] = ink;
    if (R.near[i]! <= 0) R.near[i] = 1e-9;
  }
}

/** Rider r into the raster: its body (on its springs) and its wheels. */
function rideInto(R: NonNullable<typeof rast>, ox: number, by: number, r: Rider): void {
  const m = VMODELS[r.kind];
  const lift = -bounce(r.dist, r.seed) * 0.16;
  for (const solid of m.prims) {
    const p = solid as readonly (string | number)[];
    if (p[0] === "b") boxFaces(R, ox, by, r, p.slice(1, 7) as number[], p[7] as string, lift);
    else cylFaces(R, ox, by, r, p[1] as string, p[2] as number, p[3] as number, p[4] as number, p[5] as number, p[6] as number, p[7] as string, lift);
  }
  for (const [x, rad, yin, yout] of m.wheels) {
    const turn = (r.dist / rad) * (r.view === "coming" ? 1 : -1);
    for (const sign of [-1, 1]) wheelFaces(R, ox, by, r, x!, rad!, yin!, yout!, sign, turn + sign);
  }
}

/** What goes over the raster for rider r: its lamps (pulsing a little), the wash of its headlights, its exhaust. */
function rideLights(a: Ctx, ox: number, by: number, r: Rider, t: number): void {
  const m = VMODELS[r.kind];
  const lift = -bounce(r.dist, r.seed) * 0.16;
  const scale = VCAM.f / Math.max(1, r.d + (r.view === "coming" ? 0 : 0));
  const pulse = 1 + 0.14 * Math.sin(t * 7 + r.seed * 1.7);
  const lamps = r.view === "coming" ? m.heads : m.tails;
  const core = scale > 9 ? 2 : 1;
  for (const [x, y, z] of lamps) {
    const w = worldOf(r, x!, y!, z! + lift);
    if (w[1] < 0.8) continue;
    const [sx, sy] = proj(w);
    lamp(a, ox + sx, by + sy, r.view === "coming" ? HEAD : TAIL, Math.min(5, (0.7 + (VCAM.f / w[1]) * 0.45) * pulse), core);
  }
  if (r.view === "coming" && r.d > 12) {
    // The headlights' wash on the road ahead of it.
    const [gx, gy] = proj(worldOf(r, -9, 0, 0));
    const ww = (VCAM.f / Math.max(2, r.d - 9)) * 5;
    a.save();
    a.globalCompositeOperation = "lighter";
    a.translate(ox + gx, by + gy);
    a.scale(ww, ww * 0.22);
    const gr = a.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, "rgba(255,196,110,0.26)");
    gr.addColorStop(1, "rgba(255,196,110,0)");
    a.fillStyle = gr;
    a.beginPath();
    a.arc(0, 0, 1, 0, Math.PI * 2);
    a.fill();
    a.restore();
  }
  for (const st of m.stacks) {
    const w = worldOf(r, st[0]!, st[1]!, st[2]! + lift);
    if (w[1] < 1) continue;
    const [sx, sy] = proj(w);
    exhaust(a, ox + sx, by + sy, r.view === "coming" ? -1 : 1, t, r.seed * 7 + (st[1]! > 0 ? 1 : 2), 5, Math.min(22, (VCAM.f / w[1]) * 3), false);
  }
  if (m.pipe && r.view === "going") {
    const w = worldOf(r, m.pipe[0]!, m.pipe[1]!, m.pipe[2]!);
    if (w[1] > 1) {
      const [sx, sy] = proj(w);
      exhaust(a, ox + sx, by + sy, 1, t, r.seed * 5, 3, Math.min(14, (VCAM.f / w[1]) * 2), false);
    }
  }
}

/** Its shadow on the road, under everything else of it. */
function rideShadow(a: Ctx, ox: number, by: number, r: Rider): void {
  const m = VMODELS[r.kind];
  const corners: V3[] = [worldOf(r, -0.3, -m.W - 0.4, 0), worldOf(r, m.L + 0.3, -m.W - 0.4, 0), worldOf(r, m.L + 0.3, m.W + 0.4, 0), worldOf(r, -0.3, m.W + 0.4, 0)];
  const pts: V3[] = [];
  for (let i = 0; i < 4; i++) {
    const p = corners[i]!;
    const q = corners[(i + 1) % 4]!;
    if (p[1] >= 0.6) pts.push(p);
    if (p[1] >= 0.6 !== q[1] >= 0.6) {
      const f = (0.6 - p[1]) / (q[1] - p[1]);
      pts.push([p[0] + (q[0] - p[0]) * f, 0.6, 0]);
    }
  }
  if (pts.length < 3) return;
  a.fillStyle = "rgba(10,8,20,0.38)";
  a.beginPath();
  pts.forEach((p, i) => {
    const [x, y] = proj(p);
    if (i === 0) a.moveTo(ox + x, by + y);
    else a.lineTo(ox + x, by + y);
  });
  a.closePath();
  a.fill();
}

/**
 * Head-on traffic: one car a shot in the far lane, going the other way from the rig: it overtakes the camera from
 * behind and pulls away up the road toward the horizon, seen from behind with its tail lights, the way the first
 * painted title's pickup did. One is plenty: it's a desert (Jeff, 2026-11-02: "barely any traffic").
 */
function headTraffic(n: number, u: number): Rider[] {
  const kind: VKind = dice(n, 78) < 0.5 ? "pickup" : "sedan";
  const ts = 6 + dice(n, 76) * 14;
  const d = -VMODELS[kind].L - 2 + PASS * (u - ts);
  return u >= ts && d < VSPAWN ? [{ kind, view: "going", d, dist: (HSPEED + PASS) * (u - ts), seed: n * 37 }] : [];
}

// The ground under the head-on camera, drawn every frame: for each pixel below the horizon, the point of the road or
// the desert it sees (the camera level, seven feet up), shifted by how far the world has gone by; asphalt with its
// edge lines and dashed centre line, gravel shoulders, the desert's dirt, fading into the painting's haze far off.
let ground: { w: number; h: number; cv: HTMLCanvasElement; img: ImageData; px: Uint32Array } | null = null;
const hash = (x: number, y: number, s: number): number => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const pack = (r: number, g: number, b: number): number => ((255 << 24) | (Math.min(255, Math.max(0, b)) << 16) | (Math.min(255, Math.max(0, g)) << 8) | Math.min(255, Math.max(0, r))) >>> 0;
function streamGround(a: Ctx, aw: number, ah: number, by: number, ox: number, gone: number): void {
  const top = Math.max(0, by + Math.ceil(VCAM.py));
  const rows = ah - top;
  if (rows <= 0) return;
  if (!ground || ground.w !== aw || ground.h !== rows) {
    const cv = document.createElement("canvas");
    cv.width = aw;
    cv.height = rows;
    const img = cv.getContext("2d")!.createImageData(aw, rows);
    ground = { w: aw, h: rows, cv, img, px: new Uint32Array(img.data.buffer) };
  }
  const G = ground;
  for (let r = 0; r < rows; r++) {
    const dy = top + r - by - VCAM.py + 0.5;
    if (dy <= 0) continue;
    const Y = (VCAM.f * VCAM.h) / dy; // depth, feet
    const per = Y / VCAM.f; // feet a pixel across, here
    const cell = Math.pow(2, Math.ceil(Math.log2(Math.max(0.4, per))));
    const haze = Math.min(1, Math.max(0, (Y - 90) / 900)) ** 0.6;
    const dark = Math.min(0.35, Math.max(0, (60 - Y) / 140)); // the foreground a little darker, as in the painting
    const U = Y - gone; // where on the ground this row is
    const dash = ((U % 40) + 40) % 40 < 10;
    for (let x = 0; x < aw; x++) {
      const X = (x - ox + 0.5 - VCAM.px) * per;
      const n1 = hash(Math.floor(X / cell), Math.floor(U / cell), 3);
      const n2 = hash(Math.floor(X / (cell * 6)), Math.floor(U / (cell * 6)), 5);
      let rr: number;
      let gg: number;
      let bb: number;
      const line = (c: number, w: number): number => Math.max(0, Math.min(1, (w / 2 - Math.abs(X - c)) / per + 0.5)); // a line's cover of this pixel
      if (X > ROAD.left && X < ROAD.right) {
        const v = (n1 - 0.5) * 10 + (n2 - 0.5) * 8;
        // The tyre tracks worn darker down each lane, and now and then a patch of tar.
        const track = Math.max(line(-12.5, 1.6), line(-6.3, 1.6), line(-27.6, 1.6), line(-21.4, 1.6)) * 7;
        const tar = hash(Math.floor(X / 3), Math.floor(U / 3), 11) < 0.04 ? 9 : 0;
        rr = 54 + v - track - tar;
        gg = 48 + v - track - tar;
        bb = 66 + v - track - tar * 0.7;
        const edge = Math.max(line(ROAD.right - 0.6, 0.5), line(ROAD.left + 0.6, 0.5));
        const centre = dash ? line(ROAD.centre, 0.6) : 0;
        rr += (196 - rr) * edge + (230 - rr) * centre;
        gg += (184 - gg) * edge + (186 - gg) * centre;
        bb += (168 - bb) * edge + (92 - bb) * centre;
      } else if (X > ROAD.left - 2.5 && X < ROAD.right + 2.5) {
        const v = (n1 - 0.5) * 22;
        rr = 104 + v;
        gg = 82 + v;
        bb = 78 + v;
      } else {
        const v = (n1 - 0.5) * 18;
        const w = n2;
        rr = 140 + w * 34 + v;
        gg = 88 + w * 24 + v;
        bb = 64 + w * 14 + v * 0.6;
        const fleck = hash(Math.floor(X / cell), Math.floor(U / cell), 9);
        if (fleck < 0.06) {
          // dark flecks of scrub and shade
          rr *= 0.6;
          gg *= 0.62;
          bb *= 0.7;
        } else if (fleck > 0.96) {
          // pale pebbles
          rr += 36;
          gg += 30;
          bb += 26;
        }
      }
      rr = (rr * (1 - haze) + HAZE[0] * haze) * (1 - dark);
      gg = (gg * (1 - haze) + HAZE[1] * haze) * (1 - dark);
      bb = (bb * (1 - haze) + HAZE[2] * haze) * (1 - dark);
      G.px[r * aw + x] = pack(rr | 0, gg | 0, bb | 0);
    }
  }
  G.cv.getContext("2d")!.putImageData(G.img, 0, 0);
  a.drawImage(G.cv, 0, top);
}

// What stands by the road, placed along the ground (U, feet) and drawn where it is now, far to near: telephone poles
// on the right with their wires, scrub, rocks and cacti on both sides, a speed limit sign and the guide signs now and
// then, and the diner (the painting's own), where the painting has it when the shot opens.
interface Thing {
  Y: number;
  draw: () => void;
}
let signArt: Map<string, HTMLCanvasElement> | null = null;
/** The roadside signs drawn once at their own pixel size (the side view's), to be scaled to their distance. */
function signCanvas(kind: string): HTMLCanvasElement {
  signArt ??= new Map();
  let c = signArt.get(kind);
  if (!c) {
    c = document.createElement("canvas");
    const text = kind.slice(5);
    c.width = kind === "speed" ? SPEED_W : guideW(text);
    c.height = 40;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    if (kind === "speed") speedSign(g, 0, 39);
    else guideSign(g, 0, 39, text);
    signArt.set(kind, c);
  }
  return c;
}
function roadThings(a: Ctx, aw: number, ox: number, by: number, gone: number, t: number): Thing[] {
  const things: Thing[] = [];
  const at = (X: number, Y: number, Z: number): [number, number] => {
    const [x, y] = proj([X, Y, Z]);
    return [ox + x, by + y];
  };
  const seen = (Y: number) => Y > 2.5 && Y < 1400;
  const uFor = (Y: number) => Y - gone;
  // Poles, every 132 feet on the right, and the two wires between each and the next.
  const POLE = 132;
  for (let k = Math.floor(uFor(2.5) / POLE); k <= Math.ceil(uFor(1400) / POLE); k++) {
    const Y = k * POLE + gone;
    if (!seen(Y)) continue;
    const X = 6.5;
    things.push({
      Y,
      draw: () => {
        const [bx, byy] = at(X, Y, 0);
        const [, ty] = at(X, Y, 30);
        const w = Math.max(1, Math.round((0.9 * VCAM.f) / Y));
        rect(a, bx - w / 2, ty, w, byy - ty, "rgb(52,36,32)");
        const [ax0, ay] = at(X - 4, Y, 27);
        const [ax1] = at(X + 4, Y, 27);
        rect(a, ax0, ay, ax1 - ax0, Math.max(1, Math.round((0.5 * VCAM.f) / Y)), "rgb(52,36,32)");
        // The wires on to the next pole, sagging.
        const Y2 = Y + POLE;
        for (const dx of [-3.5, 3.5]) {
          const [sx0, sy0] = at(X + dx, Y, 27);
          const [sx1, sy1] = at(X + dx, Y2, 27);
          const steps = Math.max(8, Math.min(900, Math.ceil(Math.hypot(sx1 - sx0, sy1 - sy0) * 1.5)));
          for (let i = 0; i <= steps; i++) {
            // Even steps on screen are even steps in 1/depth; the sag goes by the true share of the span.
            const yy = 1 / ((1 - i / steps) / Y + i / steps / Y2);
            const f = (yy - Y) / POLE;
            const [wx, wy] = at(X + dx, yy, 27 - 3 * 4 * f * (1 - f));
            if (wx >= 0 && wx < aw) a.fillRect(Math.round(wx), Math.round(wy), 1, 1);
          }
        }
      },
    });
  }
  // Scrub, rocks and cacti in slots on both sides.
  const SLOT = 16;
  for (let k = Math.floor(uFor(2.5) / SLOT); k <= Math.ceil(uFor(900) / SLOT); k++) {
    for (const side of [-1, 1]) {
      const r = hash(k, side, 61);
      if (r > 0.55) continue;
      const Y = k * SLOT + hash(k, side, 62) * SLOT + gone;
      if (!seen(Y)) continue;
      const X = side > 0 ? 3 + hash(k, side, 63) * 34 : ROAD.left - 4 - hash(k, side, 63) * 60;
      const name = r < 0.16 ? "sage" : r < 0.3 ? "grass" : r < 0.4 ? "rocks" : r < 0.48 ? "pear" : "saguaro";
      const tall = { sage: 4, grass: 2.6, rocks: 3, pear: 4.5, saguaro: 13 }[name]!;
      things.push({
        Y,
        draw: () => {
          const R = SPR[name];
          if (!R) return;
          const h = (VCAM.f * tall) / Y;
          if (h < 1.5) return;
          const w = (h * R[2]) / R[3];
          const [x, y] = at(X, Y, 0);
          a.drawImage(atlas(), R[0], R[1], R[2], R[3], Math.round(x - w / 2), Math.round(y - h), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
        },
      });
    }
  }
  // Signs on the right now and then.
  const SIGN_EVERY = 520;
  for (let k = Math.floor(uFor(2.5) / SIGN_EVERY); k <= Math.ceil(uFor(1400) / SIGN_EVERY); k++) {
    if (hash(k, 7, 71) > 0.7) continue;
    const Y = k * SIGN_EVERY + 200 + gone;
    if (!seen(Y)) continue;
    const kind = hash(k, 7, 72) < 0.5 ? "speed" : `sign:${pick(SIGNS, hash(k, 7, 73))}`;
    things.push({
      Y,
      draw: () => {
        const c = signCanvas(kind);
        const s = (VCAM.f * 9) / Y / c.height; // nine feet tall, post and all
        const w = c.width * s;
        const h = c.height * s;
        if (h < 2) return;
        const [x, y] = at(4.5, Y, 0);
        a.drawImage(c, Math.round(x - w / 2), Math.round(y - h), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
      },
    });
  }
  // The diner: where the painting has it at the opening, and again every few thousand feet.
  const DINER_EVERY = 1800; // so another one comes up the road within the shot
  const [dw, dh] = [sw("head-diner"), sh("head-diner")];
  for (let k = Math.floor((uFor(60) - DINER_U) / DINER_EVERY); k <= Math.ceil((uFor(1400) - DINER_U) / DINER_EVERY); k++) {
    const Y = DINER_U + k * DINER_EVERY + gone;
    if (!seen(Y) || Y < 60) continue;
    things.push({
      Y,
      draw: () => {
        const s = DINER_U / Y;
        const R = SPR["head-diner"];
        if (!R) return;
        const [x, y] = at(DINER_X, Y, 0);
        const w = dw * s;
        const h = dh * s;
        a.drawImage(atlas(), R[0], R[1], R[2], R[3], Math.round(x - w / 2), Math.round(y - h), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
        if (dice(Math.floor(t * 9), k) < 0.06) rect(a, x - w / 2 + 37 * s, y - h + 1 * s, 30 * s, 15 * s, "rgba(18,9,26,0.55)"); // the neon catching
      },
    });
  }
  return things.sort((p, q) => q.Y - p.Y);
}

/** Clouds drifting slowly across the high sky, above the mesas. */
function clouds(a: Ctx, aw: number, by: number, t: number, n: number): void {
  for (let k = 0; k < 6; k++) {
    const y = by + 3 + Math.floor(dice(n, k, 41) * 28);
    const len = 26 + Math.floor(dice(n, k, 42) * 44);
    const speed = 1.5 + dice(n, k, 43) * 2.5;
    const span = aw + len + 40;
    const x = ((((dice(n, k, 44) * span - t * speed) % span) + span) % span) - len - 20;
    const c = pick(["rgba(150,84,130,0.32)", "rgba(196,110,120,0.28)", "rgba(110,66,120,0.34)"], dice(n, k, 45));
    a.fillStyle = c;
    a.fillRect(Math.round(x + 4), y, len - 8, 1);
    a.fillRect(Math.round(x), y + 1, len, 2);
    a.fillRect(Math.round(x + len * 0.3), y - 1, Math.round(len * 0.35), 1);
  }
}

/**
 * The painting's rig, where the painting has it, alive: a pixel's bounce on its springs now and then, smoke from both
 * stacks, its headlights glowing and washing the road ahead, a glint running down the grille and catching a mirror,
 * the hubs of the wheels you can see turning.
 */
function paintedRig(a: Ctx, ox: number, by: number, t: number): void {
  const bob = Math.floor(t * 2.6) % 3 === 0 && (t * 2.6) % 1 < 0.35 ? -1 : 0;
  const X0 = ox + TRUCK_AT[0];
  const Y0 = by + TRUCK_AT[1] + bob;
  // The wash of its headlights on the road ahead (drawn under it).
  a.save();
  a.globalCompositeOperation = "lighter";
  a.translate(ox + 146, by + 118);
  a.scale(46, 9);
  const gr = a.createRadialGradient(0, 0, 0, 0, 0, 1);
  gr.addColorStop(0, "rgba(255,200,120,0.30)");
  gr.addColorStop(1, "rgba(255,200,120,0)");
  a.fillStyle = gr;
  a.beginPath();
  a.arc(0, 0, 1, 0, Math.PI * 2);
  a.fill();
  a.restore();
  spr(a, "truck", X0, Y0);
  for (const [sx, sy] of RIG_STACKS) exhaust(a, ox + sx, by + sy + bob - 1, -1, t, sx, 6, 16, true);
  const pulse = 1 + 0.15 * Math.sin(t * 6);
  for (const [lx, ly] of RIG_LAMPS) lamp(a, ox + lx, by + ly + bob, HEAD, 2.6 * pulse, 2);
  // The glint down a grille bar, every few seconds; a mirror catching the light.
  const g = (t * 0.4) % 1;
  if (g < 0.12) rect(a, ox + RIG_GRILLE[0], by + RIG_GRILLE[1] + bob + Math.floor((g / 0.12) * RIG_GRILLE[2]), 1, 1, PAL.white);
  if (Math.floor(t * 3) % 7 === 0) rect(a, ox + RIG_MIRROR[0], by + RIG_MIRROR[1] + bob, 1, 1, PAL.white);
  // The front wheels' hubs, a glint walking round each.
  const turn = Math.floor(t * 12) % 4;
  const [dx, dy] = ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const)[turn]!;
  for (const [hx, hy] of RIG_HUBS) {
    rect(a, ox + hx, by + hy, 1, 1, PAL.fog);
    rect(a, ox + hx + dx, by + hy + dy, 1, 1, PAL.white);
  }
}

function headShot(a: Ctx, aw: number, ah: number, u: number, n: number, t: number): void {
  const by = bandTop(ah);
  // A narrow screen keeps the rig at its centre, as far as the painting reaches.
  const ox = Math.max(aw - BW, Math.min(0, Math.round(aw / 2 - (TRUCK_AT[0] + 40))));
  const gone = HSPEED * u * DRIFT; // feet the world has moved along the road, away from the camera
  if (by > 0) skyAbove(a, aw, by, topOf(back()), t);
  spr(a, "head-sky", ox, by);
  clouds(a, aw, by, t, n);
  birds(a, aw, Math.max(4, by + 8), by + 50, t, 5 + n, 0.8);
  // The train runs along the foot of the mesas, the farthest thing; everything else passes in front of it.
  train(a, aw, by + RAIL, t, 10, 5, 2, 1, 0);
  streamGround(a, aw, ah, by, ox, gone);
  // The roadside and the far lane's traffic, far to near, the rig among them where its depth puts it.
  const things = roadThings(a, aw, ox, by, gone, t);
  const riders = headTraffic(n, u);
  const R = raster(aw, ah);
  const drawRiders = (near: boolean) => {
    const these = riders.filter((r) => (r.d < 38) === near);
    if (!these.length) return;
    for (const r of these) rideShadow(a, ox, by, r);
    R.col.fill(0);
    R.near.fill(0);
    R.box = [aw, ah, 0, 0];
    for (const r of these) rideInto(R, ox, by, r);
    if (R.box[2] > R.box[0]) {
      outline(R);
      R.cv.getContext("2d")!.putImageData(R.img, 0, 0);
      a.drawImage(R.cv, 0, 0);
    }
    for (const r of these) rideLights(a, ox, by, r, t);
  };
  a.fillStyle = "rgb(34,24,28)"; // the wires' colour
  for (const th of things) if (th.Y >= RIG_DEPTH) th.draw();
  drawRiders(false);
  paintedRig(a, ox, by, t);
  a.fillStyle = "rgb(34,24,28)";
  for (const th of things) if (th.Y < RIG_DEPTH) th.draw();
  drawRiders(true);
}
const back = (): HTMLImageElement => pics![2]!;


// --- The shots, on any screen ----------------------------------------------------------------------------------

function shot(a: Ctx, n: number, aw: number, ah: number, tMs: number): void {
  if (n % 2 === 0) headShot(a, aw, ah, (tMs - n * SHOT_MS) / 1000, n, tMs / 1000);
  else sideShot(a, aw, ah, tMs / 1000, n);
}

/**
 * Draws the shot for time `tMs` onto ctx, a w × h canvas, fading from one shot into the next over the last second
 * of each 30; false until the pictures have decoded (the poster stands in).
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
