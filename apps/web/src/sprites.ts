/**
 * Sprite sheets from PixelLab (apps/web/assets): one PNG with the eight headings in a
 * row and a layout JSON beside it. Frames are cut out on demand, scaled by whole
 * numbers and optionally recoloured (one carrier's cab paint into another's), and
 * cached as canvases for the map and as data URLs for <img>.
 */

export interface SheetLayout {
  spritesheet: { cell_size: { width: number; height: number }; columns: number; rows: { type: string; directions: string[] }[] };
}

export interface Sheet {
  img: HTMLImageElement;
  cell: { w: number; h: number };
  /** Column index per direction name. */
  columns: Map<string, number>;
  ready: boolean;
}

const sheets = new Map<string, Sheet>();

/** Loads a sheet once; `onReady` fires when the image has decoded (frames before that are blank). */
export function loadSheet(key: string, url: string, layout: SheetLayout, onReady?: () => void): Sheet {
  let s = sheets.get(key);
  if (s) return s;
  const img = new Image();
  const columns = new Map<string, number>();
  const row = layout.spritesheet.rows.find((r) => r.type === "rotations") ?? layout.spritesheet.rows[0];
  row?.directions.forEach((d, i) => columns.set(d, i));
  s = { img, cell: { w: layout.spritesheet.cell_size.width, h: layout.spritesheet.cell_size.height }, columns, ready: false };
  img.onload = () => {
    s!.ready = true;
    frames.clear();
    onReady?.();
  };
  img.src = url;
  sheets.set(key, s);
  return s;
}

type Recolor = [from: string, to: string][];
/** Repaints every pixel whose hue (degrees) falls in `hue` and is saturated enough: shift the hue, scale the saturation. */
export interface HueShift {
  hue: [number, number];
  shift: number;
  sat?: number;
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
/** Applies a hue shift to the pixels of an image's data in place. */
export function shiftHue(d: Uint8ClampedArray, hs: HueShift): void {
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 8) continue;
    const [h, s, l] = rgbToHsl(d[i]!, d[i + 1]!, d[i + 2]!);
    if (s < 0.25 || h < hs.hue[0] || h > hs.hue[1]) continue;
    const [r, g, b] = hslToRgb((((h + hs.shift) % 360) + 360) % 360, Math.min(1, s * (hs.sat ?? 1)), l);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
}
const frames = new Map<string, HTMLCanvasElement>();

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

/**
 * One heading of a sheet at `scale` canvas pixels per art pixel. Recolouring maps exact
 * palette entries, and nearby shades of them, so a cyan cab becomes a lime one.
 */
export function frame(sheet: Sheet, direction: string, scale: number, recolor?: Recolor, tag = "", hue?: HueShift): HTMLCanvasElement | null {
  if (!sheet.ready) return null;
  const col = sheet.columns.get(direction) ?? 0;
  const key = `${sheet.img.src.length}|${col}|${scale}|${tag}`;
  let cv = frames.get(key);
  if (cv) return cv;
  const { w, h } = sheet.cell;
  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  const sctx = src.getContext("2d")!;
  sctx.drawImage(sheet.img, col * w, 0, w, h, 0, 0, w, h);
  if (recolor?.length) {
    const id = sctx.getImageData(0, 0, w, h);
    const d = id.data;
    const map = recolor.map(([a, b]) => [hex(a), hex(b)] as const);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3]! < 8) continue;
      for (const [from, to] of map) {
        // A loose match catches the shaded variants of the same paint.
        const dr = d[i]! - from[0];
        const dg = d[i + 1]! - from[1];
        const db = d[i + 2]! - from[2];
        if (dr * dr + dg * dg + db * db < 2600) {
          d[i] = Math.max(0, Math.min(255, to[0] + dr));
          d[i + 1] = Math.max(0, Math.min(255, to[1] + dg));
          d[i + 2] = Math.max(0, Math.min(255, to[2] + db));
          break;
        }
      }
    }
    sctx.putImageData(id, 0, 0);
  }
  if (hue) {
    const id = sctx.getImageData(0, 0, w, h);
    shiftHue(id.data, hue);
    sctx.putImageData(id, 0, 0);
  }
  cv = document.createElement("canvas");
  cv.width = w * scale;
  cv.height = h * scale;
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, w * scale, h * scale);
  frames.set(key, cv);
  return cv;
}

const urls = new Map<string, string>();
/** A heading as a data URL for <img>, at `scale`. */
export function frameUrl(sheet: Sheet, direction: string, scale: number, recolor?: Recolor, tag = "", hue?: HueShift): string | null {
  const cv = frame(sheet, direction, scale, recolor, tag, hue);
  if (!cv) return null;
  const key = `${sheet.img.src.length}|${direction}|${scale}|${tag}`;
  let u = urls.get(key);
  if (!u) urls.set(key, (u = cv.toDataURL()));
  return u;
}

/**
 * Background removal sometimes hollows out a white trailer along with the backdrop.
 * This fills every transparent region that isn't connected to the image border with
 * `fill`, and hands back a data URL once the image has decoded (null before that).
 */
const fixed = new Map<string, string>();
const fixing = new Set<string>();
export function filledUrl(url: string, fill: string, onReady?: () => void): string | null {
  const done = fixed.get(url);
  if (done) return done;
  if (fixing.has(url)) return null;
  fixing.add(url);
  const img = new Image();
  img.onload = () => {
    const w = img.width;
    const h = img.height;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    const outside = new Uint8Array(w * h);
    const stack: number[] = [];
    const push = (i: number) => {
      if (!outside[i] && d[i * 4 + 3]! < 8) {
        outside[i] = 1;
        stack.push(i);
      }
    };
    for (let x = 0; x < w; x++) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w);
      push(y * w + w - 1);
    }
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w);
      if (y < h - 1) push(i + w);
    }
    const [r, g, b] = hex(fill);
    for (let i = 0; i < w * h; i++) {
      if (d[i * 4 + 3]! < 8 && !outside[i]) {
        d[i * 4] = r;
        d[i * 4 + 1] = g;
        d[i * 4 + 2] = b;
        d[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
    fixed.set(url, cv.toDataURL());
    onReady?.();
  };
  img.src = url;
  return null;
}
