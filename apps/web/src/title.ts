import f01 from "../assets/title/loop/frame-01.png";
import f02 from "../assets/title/loop/frame-02.png";
import f03 from "../assets/title/loop/frame-03.png";
import f04 from "../assets/title/loop/frame-04.png";
import f05 from "../assets/title/loop/frame-05.png";
import f06 from "../assets/title/loop/frame-06.png";
import f07 from "../assets/title/loop/frame-07.png";
import f08 from "../assets/title/loop/frame-08.png";
import f09 from "../assets/title/loop/frame-09.png";
import f10 from "../assets/title/loop/frame-10.png";
import f11 from "../assets/title/loop/frame-11.png";
import f12 from "../assets/title/loop/frame-12.png";
import f13 from "../assets/title/loop/frame-13.png";
import f14 from "../assets/title/loop/frame-14.png";
import f15 from "../assets/title/loop/frame-15.png";
import f16 from "../assets/title/loop/frame-16.png";

/**
 * The animated title scene: the Pro painterly image (apps/web/assets/title/title.png) and its
 * 16-frame PixMiniMax loop, 256×144, shown at a whole-number scale with the logo over the sky.
 * Frame 0 of the loop is the still itself, so the loop plays frames 1–16 and repeats.
 */
export const TITLE_FRAME_W = 256;
export const TITLE_FRAME_H = 144;
/** Milliseconds per frame: 10 fps reads as a slow roll, not a flicker. */
export const TITLE_FRAME_MS = 100;

const SRC = [f01, f02, f03, f04, f05, f06, f07, f08, f09, f10, f11, f12, f13, f14, f15, f16];
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
