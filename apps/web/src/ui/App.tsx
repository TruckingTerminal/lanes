import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { drawLoadingRoad, drawTitleScene, TITLE_H, TITLE_W } from "../art.js";
import { drawTitleShots, TITLE_FRAME_H, TITLE_FRAME_W, titleFrame } from "../title.js";
import { RULESET } from "../game.js";
import { H } from "../handlers.js";
import { drawText } from "../font.js";
import { loadingStrip, LOOP_FPS } from "../mapart.js";
import { LOGO_TITLE, LOGO_TITLE_H, LOGO_W } from "../assets.js";
import { GameScreen } from "./Shell.js";
import { fsEnabled, S, TEST_BUILD, toggleFullscreen, useData } from "../state.js";
import { LOGIN } from "../copy.js";
import { Btn } from "./bits.js";

/** The whole screen: title, loading, or the game. */
export function App(): JSX.Element {
  useData();
  const s = S.screen;
  if (s.kind === "title") return <TitleScreen />;
  if (s.kind === "loading") return <LoadingScreen />;
  return <GameScreen />;
}

// --- Title -------------------------------------------------------------------------------

function TitleScene(): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let shown: HTMLImageElement | null | undefined;
    const frame = (t: number) => {
      const avail = Math.min(1280, cv.parentElement?.clientWidth || 960);
      const img = titleFrame(reduced ? 0 : t);
      if (img) {
        // The painted loop at a whole-number scale, 2× to 4×, so every pixel stays square.
        const scale = Math.max(2, Math.min(4, Math.floor(avail / TITLE_FRAME_W)));
        const resized = cv.width !== TITLE_FRAME_W * scale;
        if (resized) {
          cv.width = TITLE_FRAME_W * scale;
          cv.height = TITLE_FRAME_H * scale;
        }
        if (resized || img !== shown || !reduced) {
          ctx.imageSmoothingEnabled = false;
          // The two shots next to the page, 20 s each (title.ts drawTitleShots); the poster until they can play.
          if (reduced || !drawTitleShots(ctx, cv.width, cv.height, t)) ctx.drawImage(img, 0, 0, cv.width, cv.height);
          drawLogo(ctx, cv.width, scale);
          shown = img;
        }
      } else {
        // Until the frames decode: the code-drawn scene.
        const scale = Math.max(2, Math.min(4, Math.floor(avail / TITLE_W)));
        if (cv.width !== TITLE_W * scale) {
          cv.width = TITLE_W * scale;
          cv.height = TITLE_H * scale;
        }
        drawTitleScene(ctx, scale, reduced ? 0 : t);
        drawLogo(ctx, cv.width, scale);
        shown = undefined;
      }
      if (!reduced || !img) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={1024} height={576} aria-label="A rig rolling down a desert highway at dusk past a neon diner, under the LANES sign" />;
}

/**
 * The login (specs/first-ten-minutes.md, S0, draft 4): the title loop and its shots, and one action under them.
 * Connecting and failing show on the button, never in a card; the company and the hub are chosen inside the world.
 */
function TitleScreen(): JSX.Element {
  return (
    <section class="title">
      <h1 class="sr">LANES</h1>
      <TitleScene />
      <div class="titleaction">
        <TitleAction />
      </div>
      <TitleMenuButton />
    </section>
  );
}

function TitleAction(): JSX.Element {
  const m = (S.screen as Extract<typeof S.screen, { kind: "title" }>).menu;
  const [confirm, setConfirm] = useState(false);
  const lw = S.live;
  switch (m.kind) {
    case "connecting":
      return <Btn primary disabled>{LOGIN.connecting}</Btn>;
    case "signin":
      return <Btn primary onClick={H.retry}>{LOGIN.signIn}</Btn>;
    case "unreachable":
      return <Btn primary onClick={H.retry}>{LOGIN.unreachable}</Btn>;
    case "notopen":
      return <Btn primary disabled>Not open yet</Btn>;
    case "update":
      return <Btn primary disabled title={`The world runs ${m.theirs}; this page has ${RULESET}.`}>Update in progress</Btn>;
    case "openworld":
      return (
        <div class="row center">
          <Btn primary onClick={H.openWorld}>Open the live world</Btn>
          <TestButton />
        </div>
      );
    case "starting":
      return <p class="starting">{LOGIN.starting}</p>;
    case "ready":
    case "menu":
      if (m.kind === "menu" && S.game?.kind === "test") break;
      return (
        <div class="row center">
          <Btn primary onClick={H.enterWorld}>{lw?.player ? LOGIN.continueLive(lw.player.name) : LOGIN.enter}</Btn>
          <TestButton />
        </div>
      );
    default:
      break;
  }
  // The test build (and the owner's test world): Continue, and a new world that asks once before it replaces one.
  const current = S.test?.player ? { name: S.test.player.name, day: Math.floor(S.test.w.t / 1440) + 1, go: H.backToTest } : S.savedTest ? { name: S.savedTest.name, day: S.savedTest.day + 1, go: H.continueTest } : null;
  if (confirm && current) {
    return (
      <div class="stack center">
        <p>{LOGIN.replaces(current.name)}</p>
        <div class="row center">
          <Btn primary onClick={H.openTest}>{LOGIN.replace}</Btn>
          <Btn onClick={() => setConfirm(false)}>{LOGIN.keep}</Btn>
        </div>
      </div>
    );
  }
  return (
    <div class="row center">
      {current ? (
        <Btn primary onClick={current.go}>
          {LOGIN.continueTest(current.name, current.day)}
        </Btn>
      ) : null}
      <Btn primary={!current} onClick={() => (current ? setConfirm(true) : H.openTest())}>
        {LOGIN.newTest}
      </Btn>
      {S.live ? <Btn onClick={H.backToLive}>Back to the live world</Btn> : null}
    </div>
  );
}

/** The owner's way to a private test world from the live page. */
function TestButton(): JSX.Element | null {
  return S.platform.owner && !TEST_BUILD ? <Btn ghost onClick={H.showTestMenu}>Test world</Btn> : null;
}

/** "≡" in the title's corner: full screen (and, with a world open, the report form's way in from the game). */
function TitleMenuButton(): JSX.Element | null {
  if (!fsEnabled()) return null;
  return (
    <div class="titlemenu">
      <Btn sm ghost title={LOGIN.fullScreen} onClick={toggleFullscreen}>
        ≡ {LOGIN.fullScreen}
      </Btn>
    </div>
  );
}

// --- Loading -----------------------------------------------------------------------

function LoadingScreen(): JSX.Element {
  const s = S.screen as Extract<typeof S.screen, { kind: "loading" }>;
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0;
    const frame = (t: number) => {
      const strip = loadingStrip();
      if (strip) {
        if (cv.width !== 512) {
          cv.width = 512;
          cv.height = 144;
        }
        const i = Math.floor((t * LOOP_FPS) / 1000) % 16;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.drawImage(strip, i * 256, 0, 256, 72, 0, 0, 512, 144);
        drawText(ctx, `${Math.round(S.loadShare * 100)}%`, 12, 12, 2, "#fbf7ea", "#090c17");
      } else drawLoadingRoad(ctx, 3, S.loadShare, t);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <section class="loading">
      <h2>{s.title}</h2>
      <p class="muted">{s.note}</p>
      <canvas ref={ref} width={960} height={144} aria-label="Loading" />
    </section>
  );
}

let logoImg: HTMLImageElement | null = null;
/** The HD logo over the title at a quarter of the scene's scale (its own pixels at 4×), plain: one colour at every moment (Jeff, 2026-11-02). */
function drawLogo(ctx: CanvasRenderingContext2D, cw: number, scale: number): void {
  if (!logoImg) {
    logoImg = new Image();
    logoImg.src = LOGO_TITLE;
  }
  if (!logoImg.complete || !logoImg.naturalWidth) return;
  const s = scale / 4;
  const w = Math.round(LOGO_W * s);
  const h = Math.round(LOGO_TITLE_H * s);
  ctx.imageSmoothingEnabled = s !== 1;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(logoImg, Math.round((cw - w) / 2), 10 * scale, w, h);
  ctx.imageSmoothingEnabled = false;
}
