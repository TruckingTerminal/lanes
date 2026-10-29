import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { ASSETS, hasAsset, seasonOf, spriteFrame, tileSprite, vfxSprite } from "../mapart.js";
import { PEOPLE, PEOPLE_FILE, rig, type Person } from "../assets.js";
import type { Equipment } from "@lanes/config";
import { clockMin, S, useData } from "../state.js";
import { cls } from "../format.js";
import { PAL } from "../art.js";
import { hash } from "../map.js";
import { weatherAt } from "../weather.js";

/**
 * A painted loop where a still used to be: a strip of frames next to the page
 * (assets/<name>.loop.png, packed by tools/pack-loop.py) stepped through by CSS, or
 * the still until the strip is there. Every scene and portrait in the menus is one.
 */
export function Loop({ name, still, w, h, scale, frames = 16, fps = 8, smooth, class: extra, alt = "" }: { name: string; still: string; w: number; h: number; scale: number; frames?: number; fps?: number; smooth?: boolean; class?: string; alt?: string }): JSX.Element {
  useData();
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  if (hasAsset(`${name}.loop.png`)) {
    return (
      <div
        class={cls("loop", smooth ? "smooth" : "", extra)}
        role="img"
        aria-label={alt}
        style={{ width: `${cw}px`, height: `${ch}px`, "--fw": `${cw}px`, "--n": String(frames), backgroundImage: `url(${ASSETS}${name}.loop.png)`, backgroundSize: `${frames * 100}% 100%`, animationDuration: `${frames / fps}s`, animationTimingFunction: `steps(${frames}, jump-none)` }}
      />
    );
  }
  return <img class={cls("still", smooth ? "smooth" : "", extra)} src={still} alt={alt} style={{ width: `${cw}px`, height: `${ch}px` }} />;
}

/** The in-game season right now. */
export function seasonNow(): "summer" | "autumn" | "winter" | "spring" {
  return seasonOf(Math.min(11, Math.floor((Math.floor(clockMin() / 1440) % 365) / 30)) + 1);
}

/**
 * A menu's location: a 256 × 144 scene at 2× in the season's own painting when it has one, with
 * the sky over it: the weather at the player's home hub, drawn the way the map draws it.
 */
export function Scene({ name, still, alt }: { name: string; still: string; alt?: string }): JSX.Element {
  useData();
  const season = seasonNow();
  const seasonal = season !== "summer" && hasAsset(`scenes/${name}-${season}.loop.png`);
  return (
    <div class="scenebox">
      <Loop name={`scenes/${seasonal ? `${name}-${season}` : name}`} still={still} w={256} h={144} scale={2} class="scene" alt={alt ?? ""} />
      <Sky />
    </div>
  );
}

/**
 * The weather over a scene: rain, snow, fog, cloud and lightning at a hub (the player's home
 * unless one is given), animated on a canvas of the scene's size (256 × 144 unless given).
 */
export function Sky({ hub, w = 256, h = 144 }: { hub?: number; w?: number; h?: number }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const g = S.game;
      if (!g) return;
      const at = g.w.net.hubs[hub ?? g.player?.homeHub ?? 0] ?? g.w.net.hubs[0]!;
      const minute = clockMin();
      const wx = weatherAt(at.lon, at.lat, Math.floor(minute / 1440), (minute / 60) % 24, g.w.seed);
      const W = cv.width;
      const H = cv.height;
      // Everything is sized for the 256-wide scene: the count grows with the canvas, the drops and flakes more gently.
      const q = W / 256;
      const r = Math.sqrt(q);
      ctx.clearRect(0, 0, W, H);
      if (wx.kind === "clear" || wx.kind === "heat") return;
      if (wx.kind !== "fog") {
        ctx.globalAlpha = (wx.kind === "cloud" ? 0.1 : wx.kind === "storm" ? 0.3 : 0.18) * (0.6 + 0.4 * wx.intensity);
        ctx.fillStyle = PAL.ink0;
        ctx.fillRect(0, 0, W, H);
      }
      const n = Math.round((40 + 120 * wx.intensity) * q);
      // The painted effects (assets/vfx) tile over the scene pixel for pixel; the code's strokes stand in until they decode.
      const fx = wx.kind === "rain" || wx.kind === "storm" ? vfxSprite("rain") : wx.kind === "snow" ? vfxSprite("snow") : wx.kind === "fog" ? vfxSprite("fog") : null;
      if (wx.kind === "rain" || wx.kind === "storm") {
        if (fx) tileSprite(ctx, fx, now, 0, 0, 0, W, H, 1, 0.55 + 0.4 * wx.intensity);
        else {
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = PAL.blueL;
          for (let i = 0; i < n; i++) {
            const x = hash(i, 1, 61) * W;
            const y = (now / 3 + hash(i, 2, 62) * H * 2) % (H + 12 * q) - 12 * q;
            ctx.fillRect(Math.round(x - y * 0.2), Math.round(y), Math.round(r), Math.round(6 * r));
          }
        }
        if (wx.kind === "storm" && Math.floor(now / 90) % 61 === 0) {
          const bolt = vfxSprite("bolt");
          ctx.globalAlpha = bolt ? 0.3 : 0.45;
          ctx.fillStyle = PAL.white;
          ctx.fillRect(0, 0, W, H);
          if (bolt) {
            const [bx, by] = spriteFrame(bolt, now);
            const bh = H * 0.8;
            const bw = (bolt.fw / bolt.fh) * bh;
            ctx.globalAlpha = 1;
            ctx.drawImage(bolt.img, bx, by, bolt.fw, bolt.fh, Math.round(hash(Math.floor(now / 90), 5, 65) * (W - bw)), 0, Math.round(bw), Math.round(bh));
          }
        }
      } else if (wx.kind === "snow") {
        if (fx) tileSprite(ctx, fx, now, 0, 0, 0, W, H, 1, 0.75 + 0.25 * wx.intensity);
        else {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = PAL.white;
          for (let i = 0; i < n; i++) {
            const x = hash(i, 3, 63) * W + Math.sin(now / 900 + i) * 4 * q;
            const y = (now / 18 + hash(i, 4, 64) * H * 2) % (H + 4 * q) - 2 * q;
            ctx.fillRect(Math.round(x), Math.round(y), Math.round(1.5 * r), Math.round(1.5 * r));
          }
        }
      } else if (wx.kind === "fog") {
        if (fx) {
          // Banks of painted mist drift across the lower half, each at its own pace.
          const [sx, sy] = spriteFrame(fx, now);
          ctx.globalAlpha = 0.35 + 0.35 * wx.intensity;
          for (let i = 0; i < 3; i++) {
            const x = ((now / (120 + i * 40) + i * 170 * q) % (W + fx.fw)) - fx.fw;
            ctx.drawImage(fx.img, sx, sy, fx.fw, fx.fh, Math.round(x), Math.round(H - fx.fh * (0.6 + i * 0.35)), fx.fw, fx.fh);
          }
        } else {
          ctx.globalAlpha = 0.25 + 0.3 * wx.intensity;
          ctx.fillStyle = PAL.fog;
          for (let i = 0; i < 6; i++) {
            const x = ((now / 140 + i * 97 * q) % (W + 120 * q)) - 120 * q;
            ctx.beginPath();
            ctx.ellipse(x, H * 0.55 + i * 9 * q, 90 * q, 22 * q, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [hub]);
  return <canvas ref={ref} class="sky" width={w} height={h} aria-hidden="true" />;
}

/** A side-view rig for the cards and the start form: 256 × 96 with its rolling loop; `paint` recolours the cab by hue. */
export function Rig({ eq, paint, alt, scale = 1 }: { eq: Equipment; paint?: "red" | "lime" | "grey"; alt?: string; scale?: number }): JSX.Element {
  return <Loop name={`rigs/${eq}`} still={rig(eq)} w={256} h={96} scale={scale} class={cls("rig", paint ? `paint-${paint}` : "")} alt={alt ?? ""} />;
}

/** Someone's portrait: a 128 × 128 painting with its idle loop, 48 CSS px (32 when small). */
export function Portrait({ who, sm }: { who: Person; sm?: boolean }): JSX.Element {
  return <Loop name={`people/${PEOPLE_FILE[who]}`} still={PEOPLE[who]} w={128} h={128} scale={sm ? 0.25 : 0.375} smooth class={cls("portrait", sm ? "sm" : "")} alt="" />;
}
