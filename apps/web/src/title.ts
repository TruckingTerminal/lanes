import poster from "../assets/title/loop/frame-01.png";
import { TITLE_LOOP, titleLoop, titlePicture } from "./mapart.js";

/**
 * The title scene's poster, inside the page: the first frame of the side-view loop (tools/title-parallax.py),
 * 256×144, shown at a whole-number scale with the logo over the sky until the shots next to the page
 * (drawTitleShots below) can play, and for good when motion is reduced. One frame, so it never moves
 * in a way the shots don't.
 */
export const TITLE_FRAME_W = 256;
export const TITLE_FRAME_H = 144;
/** Milliseconds per inline frame. */
export const TITLE_FRAME_MS = 100;

const SRC = [poster];
let imgs: HTMLImageElement[] | null = null;
let decoded = 0;

/** The loop's frames once every one has decoded, else null (the code-drawn scene stands in). */
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

/** The frame to show at time `tMs`, or null until the loop is ready. */
export function titleFrame(tMs: number): HTMLImageElement | null {
  const f = titleFrames();
  return f ? f[Math.floor(tMs / TITLE_FRAME_MS) % f.length]! : null;
}

// --- The two shots (Jeff, 2026-11-01: "have the title screen cycle between both every 20 seconds") -------------
// The side view (title.loop.png, tools/title-parallax.py): the truck in profile holds its place while the world
// streams past. The head-on view (approach.png and approach-truck.png, tools/title-approach.py): a still camera on
// the original painting, the truck driving up its lane from the horizon to where the painting has it, so the shot
// ends on the painting. Each holds 20 s and fades into the other over the last second, side view first, as the poster.

const SHOT_MS = 20_000;
const FADE_MS = 1_000;
/** The head-on shot's numbers, from tools/title-approach.py: the truck's cells, its width at full size, the size it
 * starts at, the lane from the vanishing point to its place in the painting, its headlights' wash, the diner's neon. */
const APPROACH = { sizes: 40, cols: 8, cw: 76, ch: 56, w: 74, s0: 0.18, vp: [211, 89], at: [160, 112], glow: [-0.16, 0.05, 0.5, 0.11, 0.55], sign: [46, 63, 27, 14] } as const;

const arts: CanvasRenderingContext2D[] = [];
/** One of two scratch canvases at the art's own size, the outgoing shot and the incoming one. */
function art(n: number): CanvasRenderingContext2D {
  if (!arts[n]) {
    const c = document.createElement("canvas");
    c.width = TITLE_FRAME_W;
    c.height = TITLE_FRAME_H;
    arts[n] = c.getContext("2d")!;
  }
  arts[n]!.imageSmoothingEnabled = false;
  return arts[n]!;
}

function sideView(a: CanvasRenderingContext2D, sheet: HTMLImageElement, tMs: number): void {
  const { frames, cols, fps } = TITLE_LOOP;
  const i = Math.floor((tMs * fps) / 1000) % frames;
  a.drawImage(sheet, (i % cols) * TITLE_FRAME_W, Math.floor(i / cols) * TITLE_FRAME_H, TITLE_FRAME_W, TITLE_FRAME_H, 0, 0, TITLE_FRAME_W, TITLE_FRAME_H);
}

/** The head-on shot `u` ms in (0 to SHOT_MS + FADE_MS): the truck's size grows as 1 / its distance, closing at a steady speed. */
function headOn(a: CanvasRenderingContext2D, back: HTMLImageElement, truck: HTMLImageElement, u: number): void {
  const A = APPROACH;
  a.drawImage(back, 0, 0);
  const q = Math.floor(u / 70);
  if (((q * 2654435761) >>> 0) % 100 < 6) {
    // The neon buzzes off for a beat now and then.
    a.fillStyle = "rgba(18, 9, 26, 0.55)";
    a.fillRect(A.sign[0], A.sign[1], A.sign[2], A.sign[3]);
  }
  const k = Math.min(1, u / (SHOT_MS + FADE_MS));
  const s = 1 / (1 / A.s0 + (1 - 1 / A.s0) * k);
  const px = A.vp[0] + (A.at[0] - A.vp[0]) * s;
  const py = A.vp[1] + (A.at[1] - A.vp[1]) * s;
  const w = A.w * s;
  a.save();
  a.globalCompositeOperation = "lighter";
  a.translate(px + A.glow[0] * w, py + A.glow[1] * w);
  a.scale(A.glow[2] * w, A.glow[3] * w);
  const g = a.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(255, 196, 110, ${0.6 * A.glow[4]})`);
  g.addColorStop(1, "rgba(255, 196, 110, 0)");
  a.fillStyle = g;
  a.beginPath();
  a.arc(0, 0, 1, 0, Math.PI * 2);
  a.fill();
  a.restore();
  const i = Math.max(0, Math.min(A.sizes - 1, Math.round((Math.log(s / A.s0) / Math.log(1 / A.s0)) * (A.sizes - 1))));
  const cx = (i % A.cols) * A.cw;
  const cy = Math.floor(i / A.cols) * A.ch;
  a.drawImage(truck, cx, cy, A.cw, A.ch, Math.round(px - A.cw / 2), Math.round(py - A.ch), A.cw, A.ch);
}

/**
 * Draws the shot for time `tMs` onto ctx, a w × h canvas (a whole multiple of the art), fading between the shots;
 * false until the side view has decoded (the poster stands in). The head-on shot waits for its two pictures.
 */
export function drawTitleShots(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number): boolean {
  const sheet = titleLoop();
  if (!sheet) return false;
  const back = titlePicture("approach.png");
  const truck = titlePicture("approach-truck.png");
  const shot = (a: CanvasRenderingContext2D, n: number, u: number) => {
    if (n % 2 === 1 && back && truck) headOn(a, back, truck, u);
    else sideView(a, sheet, tMs);
  };
  const n = Math.floor(tMs / SHOT_MS);
  const into = tMs - n * SHOT_MS;
  const base = art(0);
  shot(base, n, into + FADE_MS);
  const fading = into - (SHOT_MS - FADE_MS);
  if (fading > 0) {
    const next = art(1);
    shot(next, n + 1, fading);
    base.globalAlpha = fading / FADE_MS;
    base.drawImage(next.canvas, 0, 0);
    base.globalAlpha = 1;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base.canvas, 0, 0, w, h);
  return true;
}
