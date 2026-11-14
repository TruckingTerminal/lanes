import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { SCENES } from "../assets.js";
import { ASSETS, hasAsset } from "../mapart.js";
import { cropOf, kitData, pickWindow, type LoopArt } from "../menuart.js";
import { moving } from "../motion.js";
import { clockMin, isPhone, S, useData } from "../state.js";
import { screenWindow } from "../screenwindows.js";
import { brokeredLoads } from "../books.js";
import { bandOf, gradeForBand, type Band } from "./CityPicture.js";
import { seasonNow } from "./Loop.js";

/**
 * A screen's window (studio/specs/menu-system.md §1.3): a horizontal slice of its scene, full width, above the panel's
 * title: 72 CSS px on a phone, 96 on a laptop (the CSS sets the box; hidden at the sheet's strip height).
 *
 * - **Which painting:** UX's rule (menuart.ts pickWindow): the painted night still at night, the dusk still at dusk,
 *   the season's still outside summer, else the base painting with its loop; the existing scene of the name when the
 *   window isn't packed; `fallback`'s otherwise.
 * - **Pixel-art scaling:** a whole-number scale in device pixels (ceil(box width / 256)), cropped to the box around the
 *   art's focal point (menuart.ts cropOf), drawn without smoothing.
 * - **The hour grade:** CityPicture's, on any painting not already painted at its hour.
 * - **Before it decodes:** the box is already its size, filled with the painting's average colour; it fades in.
 * - **The loop:** on the base painting only, after the still, on idle, in Full motion and when the device hasn't asked
 *   to save data: graded once for the band into one row and stepped by CSS (no JavaScript per frame), paused off
 *   screen; at most two windows' loops are kept.
 */
const W = 256;
const H = 144;

interface Source {
  key: string;
  still: string;
  cell: { x: number; y: number; w: number; h: number };
  grade: boolean;
  loop: LoopArt | null;
  focalX: number;
  focalY: number;
  avg: string | null;
}

const SCENE_STILLS = SCENES as Record<string, string>;
/** The painting a window shows now, or null (no picture: the box shows its colour). */
export function windowSource(name: string, band: Band, fallback?: string, hero = false): Source | null {
  const k = kitData();
  const season = seasonNow();
  // A hero (512 × 288, the laptop's load sheet): the painting's hero cell where one ships, else its window.
  const h = hero ? k?.windows?.heroes?.cells?.[name] : undefined;
  if (h && k && hasAsset(k.windows.heroes!.image)) return { key: `heroes:${name}`, still: ASSETS + k.windows.heroes!.image, cell: h, grade: true, loop: null, focalX: h.focalX, focalY: h.focalY, avg: h.avg };
  for (const n of fallback ? [name, fallback] : [name]) {
    const p = pickWindow(k, n, band, season, SCENE_STILLS[n]);
    if (p) return { key: p.key, still: p.url, cell: p.cell, grade: p.grade, loop: p.loop, focalX: p.focalX, focalY: p.focalY, avg: p.avg };
  }
  return null;
}

/** Decoded images, by URL. */
const images = new Map<string, Promise<HTMLImageElement>>();
function image(url: string): Promise<HTMLImageElement> {
  let p = images.get(url);
  if (!p) {
    p = new Promise((ok, no) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = no;
      img.src = url;
    });
    images.set(url, p);
  }
  return p;
}

/** The still graded for a band, one canvas per source and band, at the painting's own size (256 × 144; a hero 512 × 288). */
const stills = new Map<string, HTMLCanvasElement>();
function gradedStill(src: Source, img: HTMLImageElement, band: Band): HTMLCanvasElement {
  const k = `${src.key}|${src.grade ? band : "painted"}`;
  let cv = stills.get(k);
  if (cv) return cv;
  if (stills.size > 24) stills.clear();
  cv = document.createElement("canvas");
  cv.width = src.cell.w;
  cv.height = src.cell.h;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(img, src.cell.x, src.cell.y, src.cell.w, src.cell.h, 0, 0, src.cell.w, src.cell.h);
  if (src.grade) {
    const id = ctx.getImageData(0, 0, src.cell.w, src.cell.h);
    gradeForBand(id.data, band);
    ctx.putImageData(id, 0, 0);
  }
  stills.set(k, cv);
  return cv;
}
/** A still's average colour, for its placeholder when the art's JSON gives none. */
const avgs = new Map<string, string>();
function averageOf(key: string, cv: HTMLCanvasElement): string {
  let a = avgs.get(key);
  if (a) return a;
  const d = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) (r += d[i]!), (g += d[i + 1]!), (b += d[i + 2]!);
  const n = d.length / 4;
  a = `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
  avgs.set(key, a);
  return a;
}

/**
 * The loop graded for a band as one row of frames, an object URL. At most two windows' loops are kept alive (the
 * current screen's and the last, §5.2); older ones are revoked.
 */
const loops = new Map<string, string>();
const loopOrder: string[] = [];
async function gradedLoop(src: Source, band: Band): Promise<string> {
  const k = `${src.key}|${band}`;
  const have = loops.get(k);
  if (have) return have;
  const L = src.loop!;
  const img = await image(ASSETS + L.image);
  const cv = document.createElement("canvas");
  cv.width = W * L.frames;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  for (let f = 0; f < L.frames; f++) ctx.drawImage(img, (f % L.cols) * L.w, Math.floor(f / L.cols) * L.h, L.w, L.h, f * W, 0, W, H);
  const id = ctx.getImageData(0, 0, cv.width, H);
  gradeForBand(id.data, band);
  ctx.putImageData(id, 0, 0);
  const url = await new Promise<string>((ok) => cv.toBlob((b) => ok(b ? URL.createObjectURL(b) : cv.toDataURL())));
  loops.set(k, url);
  loopOrder.push(k);
  while (loopOrder.length > 2) {
    const old = loopOrder.shift()!;
    const u = loops.get(old);
    if (u?.startsWith("blob:")) URL.revokeObjectURL(u);
    loops.delete(old);
  }
  return url;
}

const idle = (f: () => void): void => {
  const w = globalThis as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void };
  if (w.requestIdleCallback) w.requestIdleCallback(f, { timeout: 1000 });
  else setTimeout(f, 300);
};
const saveData = (): boolean => (globalThis.navigator as unknown as { connection?: { saveData?: boolean } } | undefined)?.connection?.saveData === true;

/** The window for the screen in view (screenwindows.ts screenWindow), or nothing. */
export function ScreenWindow({ tab, picking }: { tab: string; picking: boolean }): JSX.Element | null {
  useData();
  const g = S.game;
  const win = screenWindow(tab, g?.w ?? null, S.openLoad, picking, g?.brokerage ? brokeredLoads(g.w, g.brokerage) : 0);
  // The menu system §3: on a laptop, a load sheet shows its facility's hero where one ships.
  const hero = tab === "loads" && S.openLoad !== null && !isPhone();
  return win ? <Window key={`${win.name}|${hero}`} name={win.name} night={win.night} fallback={win.fallback} hero={hero} /> : null;
}

export function Window({ name, night, fallback, hero = false, class: extra }: { name: string; night?: string; fallback?: string; hero?: boolean; class?: string }): JSX.Element {
  useData();
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number; dpr: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [avg, setAvg] = useState<string | null>(null);
  const [loop, setLoop] = useState<string | null>(null);
  const [loopKey, setLoopKey] = useState<string | null>(null);
  const [onScreen, setOnScreen] = useState(true);
  const band = bandOf(Math.floor(clockMin() / 60) % 24);
  // A screen with its own night painting (the board's ops room) shows it in the night band.
  const src = windowSource(band === "night" && night ? night : name, band, fallback, hero);
  const animate = moving() && !saveData();

  // The box's size in device pixels, kept current.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const dpr = globalThis.devicePixelRatio || 1;
      setSize((s) => (s && s.w === Math.round(r.width * dpr) && s.h === Math.round(r.height * dpr) && s.dpr === dpr ? s : { w: Math.round(r.width * dpr), h: Math.round(r.height * dpr), dpr }));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    // Loops pause off screen (§2.5).
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((es) => setOnScreen(es.some((e) => e.isIntersecting))) : null;
    io?.observe(el);
    return () => {
      ro?.disconnect();
      io?.disconnect();
    };
  }, []);

  // The still, graded and cropped into the canvas; then the loop on idle.
  useEffect(() => {
    if (!src || !size || size.w <= 0 || size.h <= 0) return;
    let live = true;
    image(src.still)
      .then((img) => {
        if (!live || !cv.current) return;
        const g = gradedStill(src, img, band);
        const c = cropOf(src.cell.w, src.cell.h, size.w, size.h, src.focalX, src.focalY);
        const el = cv.current;
        el.width = size.w;
        el.height = size.h;
        const ctx = el.getContext("2d")!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(g, c.sx, c.sy, c.sw, c.sh, 0, 0, size.w, size.h);
        if (!src.avg) setAvg(averageOf(src.key, g));
        setReady(true);
        if (src.loop && animate)
          idle(
            () =>
              void gradedLoop(src, band)
                .then((u) => {
                  if (!live) return;
                  setLoop(u);
                  setLoopKey(`${src.key}|${band}`);
                })
                .catch(() => undefined),
          );
        else setLoop(null);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [src?.key, size?.w, size?.h, band, animate]);

  const fill = src?.avg ?? avg ?? "var(--bg-secondary)";
  // UX's picks §3: the painted dusk and night stills are of the summer base, so in another season they carry the CSS
  // season tint (as the city views do).
  const season = seasonNow();
  const tint = src && season !== "summer" && /^(dusk|night):|-night$/.test(src.key) ? season : null;
  let loopStyle: JSX.CSSProperties | null = null;
  // The loop belongs to the painting it was graded from: a stale one (the window moved to a painting without a loop,
  // or a painted hour) is never drawn.
  if (src?.loop && loop && loopKey === `${src.key}|${band}` && size && animate) {
    const c = cropOf(W, H, size.w, size.h, src.focalX, src.focalY);
    const k = c.scale / size.dpr; // CSS px per scene pixel
    loopStyle = {
      backgroundImage: `url(${loop})`,
      backgroundSize: `${W * src.loop!.frames * k}px ${H * k}px`,
      backgroundPositionY: `${-c.sy * k}px`,
      "--x0": `${-c.sx * k}px`,
      "--sheetw": `${W * src.loop!.frames * k}px`,
      animationDuration: `${src.loop!.frames / src.loop!.fps}s`,
      animationTimingFunction: `steps(${src.loop!.frames})`,
      animationPlayState: onScreen ? "running" : "paused",
    } as JSX.CSSProperties;
  }
  return (
    <div ref={box} class={`window ${hero ? "hero" : ""} ${tint ? `tint-${tint}` : ""} ${extra ?? ""}`} style={{ backgroundColor: fill }} aria-hidden="true" data-window={src?.key ?? name}>
      <canvas ref={cv} class={ready ? "ready" : ""} />
      {loopStyle ? <div class="winloop" style={loopStyle} /> : null}
    </div>
  );
}

/**
 * One painted cell of a window atlas at the full width of its box, its own proportions kept (the Economy's masthead,
 * 512 × 128). Nothing until the kit is in.
 */
export function AtlasCell({ family, id, class: extra }: { family: string; id: string; class?: string }): JSX.Element | null {
  useData();
  const k = kitData();
  const F = k?.windows?.[family];
  const c = F?.cells?.[id];
  if (!F || !c || !hasAsset(F.image)) return null;
  const style: JSX.CSSProperties = {
    aspectRatio: `${c.w} / ${c.h}`,
    backgroundColor: c.avg,
    backgroundImage: `url("${ASSETS + F.image}")`,
    backgroundSize: `${(F.w / c.w) * 100}% ${(F.h / c.h) * 100}%`,
    backgroundPosition: `${F.w === c.w ? 0 : (c.x / (F.w - c.w)) * 100}% ${F.h === c.h ? 0 : (c.y / (F.h - c.h)) * 100}%`,
  };
  return <div class={`atlascell ${extra ?? ""}`} style={style} role="img" aria-label="" />;
}
