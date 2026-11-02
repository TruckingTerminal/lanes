import { ASSETS } from "./mapart.js";

/**
 * Iuliia, drawn live (Jeff, 2026-11-01: "She has 3 arms. This is slop. Don't make her animations loops either").
 *
 * Her body never moves: one portrait, two hands, the folder in one and the pen in the other (assets/people/iuliia.png,
 * which is also the rest frame and the poster). What she does happens in her face, pasted over it from one small sheet
 * (assets/people/iuliia-sheet.png, cut by tools/portrait-sprites.py), with the nod, the breath and the pen's glint done
 * here. When she does it comes from dice that are a pure function of time, so nothing repeats on a cycle: a blink every
 * few seconds, a breath, now and then a small nod, a glance down at the folder, a glint along the pen; the mood sets her
 * face at rest (wave: a warm grin; point: a glance to the side with an eyebrow up, looking back now and then; laugh: a
 * grin that breaks into a laugh). At tMs 0, or whenever nothing is scheduled, she is exactly the portrait.
 */
export type PortraitMood = "idle" | "wave" | "point" | "laugh";

// <portrait> written by tools/portrait-sprites.py
const CELLS: Record<string, readonly [number, number, number, number, number, number]> = {
  "grin-128": [157, 194, 26, 16, 50, 42],
  "grin-64": [61, 221, 13, 8, 25, 21],
  "grin-96": [0, 221, 20, 13, 37, 31],
  "half-128": [87, 194, 34, 16, 46, 24],
  "half-64": [21, 221, 19, 10, 22, 11],
  "half-96": [184, 194, 28, 14, 33, 17],
  "laugh1-128": [65, 129, 40, 44, 44, 18],
  "laugh1-64": [27, 194, 20, 22, 22, 9],
  "laugh1-96": [182, 129, 30, 34, 33, 13],
  "laugh2-128": [106, 129, 40, 44, 44, 18],
  "laugh2-64": [48, 194, 20, 22, 22, 9],
  "laugh2-96": [213, 129, 30, 34, 33, 13],
  "rest-128": [0, 0, 128, 128, 0, 0],
  "rest-64": [0, 129, 64, 64, 0, 0],
  "rest-96": [129, 0, 96, 96, 0, 0],
  "shut-128": [122, 194, 34, 16, 46, 24],
  "shut-64": [41, 221, 19, 10, 22, 11],
  "shut-96": [213, 194, 28, 14, 33, 17],
  "side-128": [147, 129, 34, 34, 46, 24],
  "side-64": [69, 194, 17, 17, 23, 12],
  "side-96": [0, 194, 26, 26, 34, 18],
};
const PEN = [[120, 102], [118, 103], [117, 104], [116, 105], [115, 106], [114, 107], [113, 108], [112, 109], [111, 111], [111, 112]] as const;
// </portrait>

const SIZES = [128, 96, 64] as const;
const BG = "rgb(32,23,41)";

let sheet: HTMLImageElement | null = null;
function ready(): boolean {
  if (!sheet) {
    sheet = new Image();
    sheet.src = `${ASSETS}people/iuliia-sheet.png`;
  }
  return sheet.complete && sheet.naturalWidth > 0;
}

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

/** The moment's state: the face over the rest frame (if any), and the nod, the breath and the glint. */
interface Moment {
  face: string | null;
  eyes: string | null;
  nod: boolean;
  breath: boolean;
  glint: number;
}

/** Inside a schedule slot of `len` s that fires with probability `p`: how far into its clip of `dur` s we are, or -1. */
function slot(t: number, len: number, p: number, dur: number, seed: number, lead = 0.4): number {
  const k = Math.floor(t / len);
  for (const j of [k, k - 1]) {
    if (j < 0 || dice(seed, j) > p) continue;
    const start = j * len + lead + dice(seed, j, 1) * Math.max(0, len - lead - dur);
    if (t >= start && t < start + dur) return (t - start) / dur;
  }
  return -1;
}

function moment(mood: PortraitMood, t: number): Moment {
  const m: Moment = { face: null, eyes: null, nod: false, breath: false, glint: -1 };
  // The mood's face at rest.
  if (mood === "wave" || mood === "laugh") m.face = "grin";
  if (mood === "point") m.face = slot(t, 6, 0.5, 1.2, 7) >= 0 ? null : "side";
  // A laugh, now and then, in the laughing mood: it breaks, peaks twice and settles back to the grin.
  const laugh = mood === "laugh" ? slot(t, 3.8, 0.8, 0.9, 11) : -1;
  if (laugh >= 0) m.face = laugh < 0.13 || (laugh >= 0.33 && laugh < 0.46) || laugh >= 0.8 ? "laugh1" : "laugh2";
  // Breathing: a slow rise every few seconds.
  m.breath = slot(t, 4.6, 0.95, 1.3, 1) >= 0;
  // A small nod.
  const nod = slot(t, 6.5, 0.4, 0.4, 2);
  m.nod = nod >= 0.25 && nod < 0.75;
  // A glance down at the folder (only when she has nothing else to do).
  const down = mood === "idle" ? slot(t, 9, 0.45, 1.2 + dice(3, Math.floor(t / 9)) * 0.5, 3) : -1;
  if (down >= 0) m.eyes = "half"; // lids lowered to the folder
  // A blink every few seconds, never in the middle of a laugh.
  const blink = slot(t, 3.4, 0.9, 0.24, 4);
  if (blink >= 0 && laugh < 0) m.eyes = blink < 0.25 || blink >= 0.7 ? "half" : "shut";
  // A glint running along the pen.
  const glint = slot(t, 5.5, 0.55, 0.32, 5);
  if (glint >= 0) m.glint = Math.min(PEN.length - 1, Math.floor(glint * PEN.length));
  return m;
}

const scratch: CanvasRenderingContext2D[] = [];
function canvas(n: number, s: number): CanvasRenderingContext2D {
  if (!scratch[n]) scratch[n] = document.createElement("canvas").getContext("2d")!;
  const c = scratch[n]!;
  if (c.canvas.width !== s) {
    c.canvas.width = s;
    c.canvas.height = s;
  }
  c.imageSmoothingEnabled = false;
  return c;
}

function cell(c: CanvasRenderingContext2D, name: string): void {
  const r = CELLS[name];
  if (r) c.drawImage(sheet!, r[0], r[1], r[2], r[3], r[4], r[5], r[2], r[3]);
}

/**
 * Draws Iuliia in a size × size square at (x, y) of ctx, in `mood`, at time tMs (a page clock in milliseconds). She is
 * drawn from the stored size (128, 96 or 64) that fills the square best at a whole-number scale, so her pixels stay
 * square; a square smaller than 64 gets the 64 smoothed down. False until her sheet has decoded: draw the poster,
 * people/iuliia.png, until then.
 */
export function drawPortrait(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, mood: PortraitMood, tMs: number): boolean {
  if (!ready()) return false;
  let s: number = 64;
  let k = 1;
  for (const z of SIZES) {
    const n = Math.floor(size / z);
    if (n >= 1 && z * n > s * k) {
      s = z;
      k = n;
    }
  }
  const m = moment(mood, Math.max(0, tMs) / 1000);
  // Her face over the rest frame, at the stored size.
  const face = canvas(0, s);
  cell(face, `rest-${s}`);
  if (m.face) cell(face, `${m.face}-${s}`);
  if (m.eyes) cell(face, `${m.eyes}-${s}`);
  if (m.glint >= 0) {
    const [px, py] = PEN[m.glint]!;
    face.fillStyle = "rgb(255,247,222)";
    face.fillRect(Math.floor((px * s) / 128), Math.floor((py * s) / 128), 1, 1);
  }
  // The nod and the breath: her head down a pixel, her whole figure up a pixel.
  const out = canvas(1, s);
  out.fillStyle = BG;
  out.fillRect(0, 0, s, s);
  const lift = m.breath ? 1 : 0;
  out.drawImage(face.canvas, 0, -lift);
  if (lift) out.drawImage(face.canvas, 0, s - 1, s, 1, 0, s - 1, s, 1);
  if (m.nod) {
    const x0 = Math.round((20 * s) / 128);
    const x1 = Math.round((93 * s) / 128);
    const y1 = Math.round((62 * s) / 128);
    out.drawImage(face.canvas, x0, 0, x1 - x0, y1, x0, 1 - lift, x1 - x0, y1);
    out.fillStyle = BG;
    out.fillRect(x0, 0, x1 - x0, 1);
  }
  const w = Math.min(size, s * k);
  ctx.save();
  ctx.imageSmoothingEnabled = s * k > size;
  ctx.drawImage(out.canvas, 0, 0, s, s, Math.round(x + (size - w) / 2), Math.round(y + (size - w) / 2), w, w);
  ctx.restore();
  return true;
}
