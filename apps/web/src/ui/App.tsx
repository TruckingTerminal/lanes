import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { garagingOf, homeCrowding, localShare, type World } from "@lanes/engine";
import { hubs as HUBS } from "@lanes/data";
import { drawLoadingRoad, drawTitleScene, TITLE_H, TITLE_W } from "../art.js";
import { drawTitleShots, TITLE_FRAME_H, TITLE_FRAME_W, titleFrame } from "../title.js";
import { cls, fd, pct } from "../format.js";
import { GAME_CONFIG, RULESET, type StartKind } from "../game.js";
import { H } from "../handlers.js";
import { drawText } from "../font.js";
import { loadingStrip, LOOP_FPS } from "../mapart.js";
import { LOGO_TITLE, LOGO_TITLE_H, LOGO_W } from "../assets.js";
import { Rig } from "./Loop.js";
import { GameScreen } from "./Shell.js";
import { S, TEST_BUILD, useData } from "../state.js";
import { Btn, Card } from "./bits.js";

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
          drawLogo(ctx, cv.width, scale, reduced ? 0 : t);
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
        drawLogo(ctx, cv.width, scale, reduced ? 0 : t);
        shown = undefined;
      }
      if (!reduced || !img) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={1024} height={576} aria-label="A rig rolling down a desert highway at dusk past a neon diner, under the LANES sign" />;
}

function TitleScreen(): JSX.Element {
  const m = (S.screen as Extract<typeof S.screen, { kind: "title" }>).menu;
  return (
    <section class="title">
      <h1 class="sr">LANES</h1>
      <TitleScene />
      <p class="tagline">{TEST_BUILD ? "Test build: the full game against the AI, with pause and speed controls." : "One shared world on the real clock. Bid the board. Build the fleet."}</p>
      <div class="menu">
        {m.kind === "connecting" ? (
          <Card title="Connecting">
            <p class="muted">Finding the live world…</p>
          </Card>
        ) : m.kind === "signin" ? (
          <Card title="Sign in to play">
            <p>The live world is kept on claude.ai. Sign in there and open this page again to join it.</p>
          </Card>
        ) : m.kind === "unreachable" ? (
          <Card title="Couldn't reach the world">
            <p>The store didn't answer. Reload in a moment.</p>
          </Card>
        ) : m.kind === "notopen" ? (
          <Card title="Not open yet">
            <p>The live world hasn't opened yet. Check back soon.</p>
          </Card>
        ) : m.kind === "openworld" ? (
          <Card title="Open the live world">
            <p>Nobody has opened the world yet. Opening it starts the clock for good: from then on it runs whether or not anyone is playing.</p>
            <div class="row">
              <Btn primary onClick={H.openWorld}>
                Open the live world
              </Btn>
              <TestButton />
            </div>
          </Card>
        ) : m.kind === "update" ? (
          <Card title="Update in progress">
            <p>
              The live world runs on rules <span class="num">{m.theirs}</span> and this page has <span class="num">{RULESET}</span>. It won't replay history under different rules. Reload in a little while.
            </p>
          </Card>
        ) : m.kind === "join" ? (
          <JoinMenu />
        ) : m.kind === "menu" ? (
          <MenuCard />
        ) : (
          <TestMenu />
        )}
      </div>
    </section>
  );
}

function TestButton(): JSX.Element | null {
  return S.platform.owner ? <Btn onClick={H.showTestMenu}>Test world (private, pausable)</Btn> : null;
}

/** The Menu button's title: the game keeps running underneath. */
function MenuCard(): JSX.Element {
  const g = S.game;
  return (
    <section class="card stack">
      <h2>Menu</h2>
      <p>{g?.kind === "live" ? "The live world keeps running while you're here." : "Your test world is paused while you're here."}</p>
      <div class="row">
        <Btn primary onClick={g?.kind === "live" ? H.backToLive : H.backToTest}>
          Back to the game
        </Btn>
        {g?.kind === "live" ? <TestButton /> : null}
        {g?.kind === "test" && S.live ? <Btn onClick={H.backToLive}>Back to the live world</Btn> : null}
      </div>
    </section>
  );
}

function StarterOptions(): JSX.Element {
  return (
    <>
      {HUBS.filter((h) => h.isStarter).map((h) => (
        <option value={h.id} key={h.id}>
          {h.name} ({h.id})
        </option>
      ))}
    </>
  );
}

/** Each starter hub as a home base: freight balance, insurance, yard rent and (in a running world) how crowded it is. */
export function HubChoiceTable({ w }: { w: World | null }): JSX.Element {
  const arrow = (x: number) => (x >= 1.15 ? <span class="good">strong</span> : x <= 0.75 ? <span class="bad">weak</span> : <>even</>);
  const cfg = GAME_CONFIG;
  const crowdWord = (r: number) => (r >= 1.5 ? "crowded" : r >= 1.1 ? "busy" : r >= 0.75 ? "fair share" : "wide open");
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Hub</th>
            <th>Outbound van / reefer / flatbed</th>
            <th>Local first</th>
            <th>Insurance</th>
            <th>Yard FD/wk per extra truck</th>
            {w ? <th>Carriers</th> : null}
          </tr>
        </thead>
        <tbody>
          {HUBS.filter((h) => h.isStarter).map((h) => {
            const i = HUBS.indexOf(h);
            const metro = cfg.homeBase.yardTier[0] + cfg.homeBase.yardTier[1] * h.weight;
            const r = w ? homeCrowding(w)[i]! : 1;
            const yard = cfg.homeBase.yardPerTruckWeek * metro * Math.min(cfg.homeBase.yardCrowdClamp[1], Math.max(cfg.homeBase.yardCrowdClamp[0], r));
            // Local-first share: from the live market, or from the hub's outbound balance before a world exists.
            const lv = cfg.leverage;
            const share = w ? localShare(w, i, "van") : Math.min(lv.localShareClamp[1], Math.max(lv.localShareClamp[0], lv.localShareAtBalance - lv.localShareSlope * Math.log2(h.imbalance.van)));
            return (
              <tr key={h.id}>
                <td>{h.name}</td>
                <td>
                  {arrow(h.imbalance.van)} / {arrow(h.imbalance.reefer)} / {arrow(h.imbalance.flatbed)}
                </td>
                <td class={cls("num", share >= 0.6 && "good", share <= 0.3 && "warn")}>{pct(share)}</td>
                <td class="num">×{garagingOf(h.id).toFixed(2)}</td>
                <td class="num">{fd(yard)}</td>
                {w ? <td>{crowdWord(r)}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p class="muted small">Strong outbound means plenty of freight to reload on; weak means trucks pile up and outbound pays little (inbound pays more). "Local first" is the share of the hub's van loads its shippers hold for carriers based nearby for the first round: where trucks pile up, shippers work with locals almost exclusively, and offer the reliable ones contract lanes. The edge from being local shrinks the more carriers share the hub.</p>
    </>
  );
}

function JoinMenu(): JSX.Element {
  const submit = (ev: Event) => {
    ev.preventDefault();
    const name = ((document.getElementById("cname") as HTMLInputElement).value.trim() || "Lone Star Freight").slice(0, 32);
    H.join(name, (document.getElementById("chub") as HTMLSelectElement).value);
  };
  return (
    <form class="card stack" onSubmit={submit}>
      <h2>Join the live world</h2>
      <p>One world, shared by every player, running on the real clock: one game day every 6 real hours. It never pauses and nothing resets. Every order you give stands.</p>
      <div class="field">
        <label class="label" for="cname">
          Company name
        </label>
        <input type="text" id="cname" maxLength={32} defaultValue="Lone Star Freight" required />
      </div>
      <div class="field">
        <label class="label" for="chub">
          Home hub
        </label>
        <select id="chub">
          <StarterOptions />
        </select>
      </div>
      <HubChoiceTable w={S.live?.w ?? null} />
      <div class="choice" style={{ cursor: "default" }}>
        <Rig eq="van" alt="Leased truck" />
        <span>
          <b>You start as an owner-operator,</b> like everyone: one NPC-leased Workhorse and dry van, 5,000 FD. The lessor takes 15% of every load. Go broke and you start over on a lease.
        </span>
      </div>
      <div class="row">
        <Btn primary type="submit">
          Start hauling
        </Btn>
        <TestButton />
      </div>
      <p class="muted small">Year 1–2 is the beta: FD is play money and you earn Miles. At the end of Year 2, FD launches on the exchange and Miles turn into an airdrop. This build uses play dollars only.</p>
    </form>
  );
}

function TestMenu(): JSX.Element {
  const submit = (ev: Event) => {
    ev.preventDefault();
    const name = ((document.getElementById("tname") as HTMLInputElement).value.trim() || "Test Freight").slice(0, 32);
    const start = (document.querySelector('input[name="start"]:checked') as HTMLInputElement).value as StartKind;
    H.openTest(name, start, (document.getElementById("thub") as HTMLSelectElement).value);
  };
  return (
    <form class="card stack" onSubmit={submit}>
      <h2>Test world</h2>
      {S.test ? (
        <div class="row">
          <Btn primary onClick={H.backToTest}>
            Back to {S.test.player?.name ?? "your world"}
          </Btn>
          {S.live ? <Btn onClick={H.backToLive}>Back to the live world</Btn> : null}
        </div>
      ) : S.savedTest ? (
        <div class="row">
          <Btn primary onClick={H.continueTest}>
            Continue: {S.savedTest.name}, day {S.savedTest.day + 1}
          </Btn>
        </div>
      ) : null}
      <p>{TEST_BUILD ? `The full game with only you and the AI in it, plus pause and speed controls for testing. Your world stays in this browser${S.savedTest || S.test ? "; starting a new one below replaces it" : ""}.` : "A private copy of the rules with only you and the AI in it. You can pause it and run it fast. It isn't stored and doesn't touch the live world."}</p>
      <div class="field">
        <label class="label" for="tname">
          Company name
        </label>
        <input type="text" id="tname" maxLength={32} defaultValue="Test Freight" />
      </div>
      <div class="field">
        <span class="label">How you start</span>
        <label class="choice">
          <input type="radio" name="start" value="oo" defaultChecked />
          <span>
            <Rig eq="van" alt="Leased truck" />
            <br />
            <b>Owner-operator.</b> The live world's start.
          </span>
        </label>
        <label class="choice">
          <input type="radio" name="start" value="fleet" />
          <span>
            <Rig eq="reefer" paint="red" alt="Owned truck" />
            <br />
            <b>Small fleet.</b> Two used trucks and 25,000 FD, to test the fleet game.
          </span>
        </label>
      </div>
      <div class="field">
        <label class="label" for="thub">
          Home hub
        </label>
        <select id="thub">
          <StarterOptions />
        </select>
      </div>
      <HubChoiceTable w={null} />
      <div class="row">
        <Btn primary type="submit">
          {S.test ? "Start a new test world" : "Open the test world"}
        </Btn>
        {S.test ? <Btn onClick={H.backToTest}>Keep playing this one</Btn> : null}
        {S.live ? <Btn onClick={H.backToLive}>Back to the live world</Btn> : null}
      </div>
    </form>
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
let logoGlint: HTMLCanvasElement | null = null;
/** The HD logo over the title at a quarter of the scene's scale (its own pixels at 4×), with a glint sweeping across every five seconds. */
function drawLogo(ctx: CanvasRenderingContext2D, cw: number, scale: number, t: number): void {
  if (!logoImg) {
    logoImg = new Image();
    logoImg.src = LOGO_TITLE;
  }
  if (!logoImg.complete || !logoImg.naturalWidth) return;
  logoGlint ??= document.createElement("canvas");
  logoGlint.width = LOGO_W;
  logoGlint.height = LOGO_TITLE_H;
  const g = logoGlint.getContext("2d")!;
  g.clearRect(0, 0, LOGO_W, LOGO_TITLE_H);
  g.drawImage(logoImg, 0, 0);
  if (t > 0) {
    const x = ((t % 5000) / 5000) * (LOGO_W + 240) - 120;
    const grad = g.createLinearGradient(x - 50, 0, x + 50, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.6)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = grad;
    g.fillRect(x - 50, 0, 100, LOGO_TITLE_H);
    g.globalCompositeOperation = "source-over";
  }
  const s = scale / 4;
  const w = Math.round(LOGO_W * s);
  const h = Math.round(LOGO_TITLE_H * s);
  ctx.imageSmoothingEnabled = s !== 1;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(logoGlint, Math.round((cw - w) / 2), 10 * scale, w, h);
  ctx.imageSmoothingEnabled = false;
}
