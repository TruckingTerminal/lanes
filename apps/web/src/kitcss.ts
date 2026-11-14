import { atlasUrl, kitData, sliceOf, type Atlas, type Piece } from "./menuart.js";

/**
 * The painted frames and buttons (studio/specs/menu-system.md §1.2, step 3): CSS `border-image` takes a whole image, never
 * a region of an atlas, so once the kit atlas has decoded each nine-slice piece is cut into its own image and given to
 * CSS as custom properties on <html>: `--frame-card`, `--frame-card-slice`, `--button-primary`, … (page.html's rules
 * read them, with today's 1 px borders until they're set). Once a page; nothing redraws.
 */
export const FRAME_PIECES = ["frame-panel", "frame-card", "frame-dialog", "frame-ticket", "frame-toast", "frame-sheet", "frame-clipboard", "frame-paper", "button-primary", "button-primary-press", "button-secondary", "button-secondary-press", "button-danger", "button-danger-press"] as const;

/** The custom properties for one piece: its image, and its slice as CSS reads it ("12 12 0 12"). */
export function pieceVars(name: string, p: Piece, url: string): Record<string, string> {
  const [t, r, b, l] = sliceOf(p);
  return { [`--${name}`]: `url("${url}")`, [`--${name}-slice`]: `${t} ${r} ${b} ${l}`, [`--${name}-width`]: `${t}px ${r}px ${b}px ${l}px` };
}

let done = false;
/** Cuts the kit's frames into CSS once the kit's JSON and atlas are in; safe to call on every render. */
export function applyKitFrames(): void {
  if (done || typeof document === "undefined") return;
  const k = kitData();
  if (!k?.kit) return;
  done = true;
  const atlas: Atlas = k.kit;
  const img = new Image();
  img.onload = () => {
    const root = document.documentElement;
    for (const name of FRAME_PIECES) {
      const p = atlas.pieces[name];
      if (!p) continue;
      const cv = document.createElement("canvas");
      cv.width = p.w;
      cv.height = p.h;
      cv.getContext("2d")!.drawImage(img, p.x, p.y, p.w, p.h, 0, 0, p.w, p.h);
      for (const [k2, v] of Object.entries(pieceVars(name, p, cv.toDataURL()))) root.style.setProperty(k2, v);
      if (p.fill) root.style.setProperty(`--${name}-fill`, p.fill);
    }
    // The page's frames switch from the fallback borders to the painted rims in one go.
    root.setAttribute("data-kit", "1");
  };
  img.onerror = () => (done = false);
  img.src = atlasUrl(atlas.image);
}
