import poster from "../assets/title/loop/frame-01.png";

/**
 * The title scene's poster, inside the page: the first frame of the parallax loop (tools/title-parallax.py),
 * 256×144, shown at a whole-number scale with the logo over the sky until the loop next to the page
 * (mapart.ts titleLoop) has decoded, and for good when motion is reduced. One frame, so it never moves
 * in a way the loop doesn't.
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
