import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { atlasUrl, kitData } from "../menuart.js";

/**
 * The dock clock (the menu system §2.5, UX's picks §1): a picture of the deadline, never a countdown. The kit's face
 * (layer A, the guard erased), then code hands set to the deadline's clock time, then the wire guard (layer B) over
 * them: a caged clock. A tight load (under 4 h of slack) lights an amber lamp on the rim, steady. Until the kit is in,
 * a code-drawn face.
 */
const faces = new Map<string, Promise<HTMLImageElement>>();
function atlas(url: string): Promise<HTMLImageElement> {
  let p = faces.get(url);
  if (!p) {
    p = new Promise((ok, no) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = no;
      img.src = url;
    });
    faces.set(url, p);
  }
  return p;
}

/** The hands' angles (radians, clockwise from 12) for a game minute. */
export function handAngles(minute: number): { hour: number; min: number } {
  const m = ((minute % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60) % 12;
  const mm = m % 60;
  return { hour: ((h + mm / 60) / 12) * Math.PI * 2, min: (mm / 60) * Math.PI * 2 };
}

export function DockClock({ at, tight = false, size = 48 }: { at: number; tight?: boolean; size?: number }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  const k = kitData();
  const face = k?.kit?.pieces?.["dockclock-face"];
  const guard = k?.kit?.pieces?.["dockclock-guard"];
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = globalThis.devicePixelRatio || 1;
    const px = Math.round(size * dpr);
    cv.width = px;
    cv.height = px;
    const ctx = cv.getContext("2d")!;
    const S = 128; // the face's own size; everything below is drawn in its units
    const draw = (img: HTMLImageElement | null) => {
      ctx.setTransform(px / S, 0, 0, px / S, 0, 0);
      ctx.clearRect(0, 0, S, S);
      const [cx, cy] = face?.centre ?? [64, 64];
      const r = face?.radius ?? 40;
      if (img && face) ctx.drawImage(img, face.x, face.y, face.w, face.h, 0, 0, S, S);
      else {
        ctx.fillStyle = "#e9dcc2";
        ctx.strokeStyle = "#5b4636";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      const a = handAngles(at);
      const hand = (angle: number, len: number, width: number) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.sin(angle) * len, cy - Math.cos(angle) * len);
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#2a1d2e";
        ctx.stroke();
      };
      hand(a.hour, r * 0.55, 5);
      hand(a.min, r * 0.85, 3);
      if (img && guard) ctx.drawImage(img, guard.x, guard.y, guard.w, guard.h, 0, 0, S, S);
      if (tight) {
        // The amber lamp on the rim, steady (no lamp ships lit, so code draws its glow).
        const lx = cx + (r + 14) * Math.sin(Math.PI / 4);
        const ly = cy - (r + 14) * Math.cos(Math.PI / 4);
        const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, 14);
        g.addColorStop(0, "#ffd27a");
        g.addColorStop(0.4, "#ffb454");
        g.addColorStop(1, "rgba(255,180,84,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lx, ly, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    if (k && face) atlas(atlasUrl(k.kit.image)).then(draw, () => draw(null));
    else draw(null);
  }, [at, tight, size, !!face]);
  return <canvas ref={ref} class="dockclock" style={{ width: `${size}px`, height: `${size}px` }} aria-hidden="true" />;
}
