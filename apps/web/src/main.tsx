import { render } from "preact";
import { companyAccount, type GameEvent } from "@lanes/engine";
import { installTheme } from "./art.js";
import { fd, hhmm, realUntil } from "./format.js";
import { DEFAULT_ORDERS, RULESET, TestGame, type StartKind } from "./game.js";
import { H } from "./handlers.js";
import { createMeta, LiveWorld, readMeta, type DbLike, type WorldMeta } from "./live.js";
import { setDefaultOrders } from "./logic.js";
import { drawMap, fitMap, resetArt, setZoom, zoomIndex } from "./mapview.js";
import { MemoryDb } from "./memdb.js";
import { bumpData, bumpTick, feed, loadTheme, markPersisted, persistTest, push, readTest, S, setLayout, SPEEDS, TEST_BUILD, toast, toggleFullscreen, truckNo, type Session, type TitleMenu } from "./state.js";
import { App } from "./ui/App.js";

/**
 * Boot, sessions and the game loop. The screen itself is the Preact app in ui/;
 * the map draws straight to its canvas every frame (mapview.ts).
 */

// --- Platform: the artifact's shared store and who is viewing ----------------------------------

async function connect(): Promise<typeof S.platform> {
  const c = (window as any).claude;
  if (!c?.use) {
    let uid = "";
    try {
      uid = sessionStorage.getItem("lanes.dev.uid") ?? "";
      if (!uid) sessionStorage.setItem("lanes.dev.uid", (uid = `dev-${Math.floor(Math.random() * 1e9).toString(36)}`));
    } catch {
      uid = `dev-${Math.floor(Math.random() * 1e9).toString(36)}`;
    }
    return { db: new MemoryDb(Date.now, "lanes.devdb.v1"), uid, owner: true, local: true };
  }
  try {
    const [db, user] = await Promise.all([c.use("db"), c.use("user")]);
    const uid: string | null = user ? await user.id() : null;
    const owner = user ? Boolean(await user.isOwner()) : false;
    return { db: db as DbLike | null, uid, owner, local: false };
  } catch {
    return { db: null, uid: null, owner: false, local: false };
  }
}

// --- Screens ------------------------------------------------------------------------------

function showTitle(menu: TitleMenu): void {
  S.screen = { kind: "title", menu };
  bumpData();
}
function showLoading(title: string, note: string): void {
  S.loadShare = 0;
  S.screen = { kind: "loading", title, note };
  bumpData();
}
function showGame(s: Session): void {
  if (S.game !== s) resetArt();
  S.game = s;
  feed(s).lastT = s.w.t;
  S.selTruck = s.player ? (s.w.trucksByCompany.get(s.player.id)?.find((t) => t.status !== "retired")?.id ?? null) : null;
  S.tab = "fleet";
  S.screen = { kind: "game" };
  bumpData();
  if (!looping) {
    looping = true;
    last = performance.now();
    schedule();
  }
}

// --- Events --------------------------------------------------------------------------------

function onEvent(s: Session, e: GameEvent): void {
  const w = s.w;
  const hubName = (i: number) => w.net.hubs[i]!.id;
  if (e.kind === "launched") {
    push(s, "FD is live on the exchange. Your airdrop's first quarter has landed.", "warn");
    if (s === S.game) toast("Launch day: FD can now be bought and sold.");
  }
  if (!s.player || !("companyId" in e) || e.companyId !== s.player.id) return;
  if (e.kind === "won") push(s, `Won ${hubName(e.origin)}→${hubName(e.dest)}, ${e.miles} mi at ${e.rate.toFixed(2)}/mi${e.manual ? " (your bid)" : ""}`, "good");
  if (e.kind === "delivered") push(s, `Delivered ${hubName(e.origin)}→${hubName(e.dest)}: +${fd(e.grossFd)} FD, ${fd(e.grossFd - e.costFd)} after costs${e.onTime ? "" : " (late)"}`);
  if (e.kind === "lostBid") push(s, `Lost ${hubName(e.origin)}→${hubName(e.dest)} at ${e.rate.toFixed(2)}/mi${e.winningRate !== null ? `: it went for ${e.winningRate.toFixed(2)}/mi` : ": nobody took it this round"}`, "warn");
  if (e.kind === "breakdown") push(s, `Breakdown on truck ${truckNo(e.truckId)}${e.repairFd ? `: ${fd(e.repairFd)} FD repair bill` : " (lessor pays)"}`, "bad");
  if (e.kind === "truckDelivered") push(s, `New truck delivered: truck ${truckNo(e.truckId)} is ready`, "good");
  if (e.kind === "liquidated") push(s, "Your company went into liquidation: trucks are being sold and you'll restart on an NPC lease.", "bad");
  if (e.kind === "notice") {
    const text = s === S.game ? e.text.replace(/\bTruck (\d+)\b/g, (m, id: string) => (truckNo(Number(id)) ? `Truck ${truckNo(Number(id))}` : m)) : e.text;
    push(s, text, e.tone === "good" ? "good" : e.tone === "bad" ? "bad" : "");
    if (s === S.game && (e.topic === "crash" || e.topic === "authority")) toast(text, e.tone === "bad");
  }
  if (s === S.game) bumpData();
}

// --- Boot ---------------------------------------------------------------------------------

async function boot(): Promise<void> {
  installTheme();
  loadTheme();
  setDefaultOrders(() => DEFAULT_ORDERS);
  wireHandlers();
  wireKeys();
  render(<App />, document.getElementById("app")!);
  if (TEST_BUILD) return bootTest();
  showTitle({ kind: "connecting" });
  S.platform = await connect();
  if (!S.platform.db) return showTitle({ kind: "signin" });
  let meta: WorldMeta | null = null;
  try {
    meta = await readMeta(S.platform.db);
  } catch {
    return showTitle({ kind: "unreachable" });
  }
  if (!meta) return showTitle(S.platform.owner ? { kind: "openworld" } : { kind: "notopen" });
  await enterLive(meta);
}

async function enterLive(meta: WorldMeta): Promise<void> {
  if (meta.ruleset !== RULESET) return showTitle({ kind: "update", theirs: meta.ruleset });
  showLoading("Catching up with the live world", "Every page replays the world's history from the start, so everyone sees the same world.");
  const lw = await LiveWorld.open(S.platform.db!, meta, S.platform.uid);
  S.live = lw;
  lw.onEvent((e) => onEvent(lw, e));
  lw.onOwnResult = (r, res) => {
    const ok = S.okText.get(r.s);
    S.okText.delete(r.s);
    if (res.ok) toast(ok ?? "Done");
    else toast(`${r.a.type.replace(/_/g, " ")} failed: ${res.reason}`, true);
    bumpData();
  };
  lw.onJoin = (uid, c) => {
    push(lw, uid === S.platform.uid ? `${c.name} is on the road out of ${lw.w.net.hubs[c.homeHub]!.id}. Good luck.` : `${c.name} joined the world, hauling out of ${lw.w.net.hubs[c.homeHub]!.id}`, "good");
    if (uid === S.platform.uid) {
      S.selTruck = lw.w.trucksByCompany.get(c.id)?.[0]?.id ?? null;
      bumpData();
    }
  };
  await lw.rebuild((share) => {
    S.loadShare = share;
    S.screen = { kind: "loading", title: "Catching up with the live world", note: `${hhmm(lw.w.t)}` };
  });
  if (!lw.player && S.platform.uid && lw.writer) showTitle({ kind: "join" });
  else showGame(lw);
}

async function bootTest(): Promise<void> {
  S.platform = { db: null, uid: null, owner: true, local: true };
  const log = readTest();
  if (!log || log === "stale") {
    showTitle({ kind: "test" });
    if (log === "stale") toast("The rules changed since your last visit, so your old test world can't be replayed. Start a new one.");
    return;
  }
  showLoading("Loading your test world", "Replaying its history in this browser.");
  let t: TestGame;
  try {
    if (!log.acts.every((x) => Array.isArray(x) && Number.isFinite(x[0]) && x[1] && typeof x[1] === "object")) throw new Error("bad log");
    t = await TestGame.restore(log, (share) => {
      S.loadShare = share;
    });
  } catch {
    showTitle({ kind: "test" });
    toast("Your saved test world couldn't be replayed, so it was set aside. Start a new one.", true);
    return;
  }
  S.test = t;
  t.onEvent((e) => onEvent(t, e));
  markPersisted(t);
  S.speed = 0;
  showGame(t);
  toast("Welcome back. The clock is paused; press ▶ or 1–3 to run it.");
}

function wireHandlers(): void {
  H.openTest = (name: string, start: StartKind, hub: string) => {
    const t = new TestGame(name, start, hub);
    S.test = t;
    t.onEvent((e) => onEvent(t, e));
    S.speed = 1;
    acc = 0;
    showGame(t);
    persistTest(true);
    toast("Test world open. Pause and speed up from the top bar.");
  };
  H.backToLive = () => {
    S.test = null;
    if (S.live) {
      if (S.live.player || !S.live.writer) showGame(S.live);
      else showTitle({ kind: "join" });
    } else void boot();
  };
  H.backToTest = () => {
    if (S.test) showGame(S.test);
  };
  H.showTestMenu = () => {
    if (S.platform.owner) showTitle({ kind: "test" });
  };
  H.openWorld = () => {
    void createMeta(S.platform.db!).then(
      (m) => enterLive(m),
      () => toast("Couldn't open the world: the store refused the write.", true),
    );
  };
  H.takeover = () => {
    void S.live?.retakeLease().then((ok) => {
      toast(ok ? "This tab now runs your company." : "Your company is still open somewhere else.", !ok);
      if (ok && S.live && !S.live.player && !S.live.isPlayer(S.platform.uid ?? "")) showTitle({ kind: "join" });
      bumpData();
    });
  };
  H.join = (name: string, hub: string) => {
    const lw = S.live!;
    lw.submit({ type: "join", name, hub }).then(
      (r) => {
        showGame(lw);
        toast(`Registering ${name}. Your truck is ready at ${hhmm(r.at)}, in ${realUntil(lw.msUntil(r.at))}.`);
      },
      (e: unknown) => toast(`Couldn't join: ${(e as { message?: string })?.message ?? "the store refused it"}`, true),
    );
  };
}

function wireKeys(): void {
  addEventListener("resize", () => S.game && fitMap());
  addEventListener("pagehide", () => persistTest(true));
  document.addEventListener("visibilitychange", () => document.hidden && persistTest(true));
  document.addEventListener("fullscreenchange", () => S.game && fitMap());
  document.addEventListener("webkitfullscreenchange", () => S.game && fitMap());
  // F toggles full screen, + - 0 zoom the map, Esc restores the split layout; in the test world only, space pauses and 1–3 set the speed.
  document.addEventListener("keydown", (ev) => {
    if ((ev.target as HTMLElement).closest("input,select,textarea")) return;
    const g = S.game;
    if (!g) return;
    if (ev.key === "f" || ev.key === "F") toggleFullscreen();
    if (ev.key === "+" || ev.key === "=") setZoom(zoomIndex() + 1);
    if (ev.key === "-" || ev.key === "_") setZoom(zoomIndex() - 1);
    if (ev.key === "0") setZoom(0);
    if (ev.key === "Escape" && S.layout !== "split") setLayout("split");
    if (g.kind !== "test") return;
    if (ev.key === " ") {
      S.speed = S.speed === 0 ? 1 : 0;
      ev.preventDefault();
      bumpData();
    }
    if (ev.key >= "1" && ev.key <= "3") {
      S.speed = Number(ev.key);
      bumpData();
    }
  });
}

// --- The loop --------------------------------------------------------------------------------

let looping = false;
let last = 0;
let rafId = 0;
let timerId = 0;
let acc = 0;
let lastPanelAt = 0;
let rebuilding = false;
let brokenShown = false;
let lastSpeed = -1;

function schedule(): void {
  if (!document.hidden) rafId = requestAnimationFrame(loop);
  timerId = window.setTimeout(() => loop(performance.now()), document.hidden ? 500 : 250);
}

async function resync(): Promise<void> {
  const lw = S.live;
  if (!lw || rebuilding) return;
  rebuilding = true;
  push(lw, "An order reached this page late. Replaying the world so it matches everyone else's.", "warn");
  await lw.rebuild();
  rebuilding = false;
  bumpData();
}

/** Daily bookkeeping for the screen: the cash sparkline and the freight-cycle headlines. */
function observe(s: Session): void {
  const f = feed(s);
  const w = s.w;
  if (w.t === f.lastT) return;
  const crossed = Math.floor(w.t / 1440) !== Math.floor(f.lastT / 1440);
  f.lastT = w.t;
  if (!crossed) return;
  const day = Math.floor(w.t / 1440) - 1;
  if (s.player) {
    f.history.push({ day, cash: w.ledger.balance(companyAccount(s.player.id)) });
    if (f.history.length > 120) f.history.shift();
  }
  const cyc = w.feeds.cycle(day);
  const band = cyc > 1.12 ? "boom" : cyc < 0.88 ? "slump" : "normal";
  if (band !== f.band && f.band !== "") {
    push(s, band === "boom" ? `Freight is booming: the Cass dial reads ${cyc.toFixed(2)}. Rates are climbing.` : band === "slump" ? `Freight is slumping: the Cass dial reads ${cyc.toFixed(2)}. Expect thin loads and price cuts.` : "Freight demand is back to normal.", band === "boom" ? "good" : band === "slump" ? "bad" : "");
  }
  f.band = band;
}

function loop(now: number): void {
  cancelAnimationFrame(rafId);
  clearTimeout(timerId);
  const dt = Math.min(250, now - last);
  last = now;
  const lw = S.live;
  if (lw && !rebuilding) {
    if (lw.needRebuild) void resync();
    else lw.advance(S.game === lw ? 8 : 4);
  }
  const t = S.test;
  if (t && S.game === t) {
    acc += (dt / 1000) * SPEEDS[S.speed]!.hoursPerSec;
    const budget = now + 10;
    while (acc >= 1 && performance.now() < budget) {
      t.stepHour();
      acc -= 1;
    }
    if (acc > 48) acc = 48;
    persistTest();
    if (S.speed !== lastSpeed) {
      lastSpeed = S.speed;
      bumpData();
    }
  }
  const g = S.game;
  if (g && S.screen.kind === "game") {
    try {
      const before = g.w.t;
      observe(g);
      drawMap(now);
      bumpTick();
      if (g.w.t !== before || now - lastPanelAt > 1000) {
        lastPanelAt = now;
        bumpData();
      }
    } catch (e) {
      console.error(e);
    }
    if (lw?.broken && !brokenShown) {
      brokenShown = true;
      toast(`The live world stopped at ${hhmm(lw.broken.at)}: ${lw.broken.reason}. The owner has to repair the log.`, true);
    }
  }
  schedule();
}

const hot = (window as any).claude?.hot;
if (hot?.ready) hot.ready(() => void boot());
else void boot();
