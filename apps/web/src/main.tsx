import { render } from "preact";
import { companyAccount, crewed, type GameEvent } from "@lanes/engine";
import { installTheme } from "./art.js";
import { truckSheet, whenAssetsReady } from "./assets.js";
import { fd, fdFull, hhmm, realUntil, shortDate } from "./format.js";
import { FEED } from "./copy.js";
import { DEFAULT_ORDERS, RULESET, TestGame, type StartKind } from "./game.js";
import { H } from "./handlers.js";
import { createMeta, LiveWorld, readMeta, type DbLike, type WorldMeta } from "./live.js";
import { checkAttention, checkIdleAlerts, setDefaultOrders } from "./logic.js";
import { payLine, type TruckBefore } from "./rolling.js";
import { sampleStarters } from "./hubcard.js";
import { drawMap, fitMap, flyTo, resetArt, setZoom, zoomIndex } from "./mapview.js";
import { MemoryDb } from "./memdb.js";
import { bumpData, bumpTick, feed, loadOnboard, setOnboard, loadTheme, markPersisted, persistTest, push, readTest, S, setLayout, setTab, SPEEDS, TEST_BUILD, toast, toggleFullscreen, truckNo, type Session, type TitleMenu } from "./state.js";
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
  const truck = s.player ? s.w.trucksByCompany.get(s.player.id)?.find((t) => t.status !== "retired") : undefined;
  S.selTruck = truck?.id ?? null;
  setTab("fleet");
  S.sheet = "half";
  // Before a company, the first entry starts at Iuliia's welcome; a returning player opens on their truck, no flight.
  if (!s.player) S.entry = { stage: "welcome", hub: null, rings: null };
  else if (truck) flyTo(truck.hub, true);
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
  // The feed names cities, never airport codes (copy-audit.md).
  const hubName = (i: number) => w.net.hubs[i]!.name;
  if (e.kind === "launched") {
    push(s, "FD is live on the exchange. Your airdrop's first quarter has landed.", "warn");
    if (s === S.game) toast("Launch day: FD can now be bought and sold.");
  }
  if (!s.player || !("companyId" in e) || e.companyId !== s.player.id) return;
  // A bid placed by hand from the board: the round's result card says how it did (S5) until OK or the next bid.
  if ((e.kind === "won" || e.kind === "lostBid") && s === S.game) {
    const mine = S.handBids.get(e.loadId);
    if (mine) {
      S.handBids.delete(e.loadId);
      const load = w.loads.get(e.loadId);
      const winning = e.kind === "won" ? e.rate : e.winningRate;
      S.result = { won: e.kind === "won", origin: e.origin, dest: e.dest, rate: e.kind === "won" ? e.rate : mine.rate, winning, be: mine.be, total: e.kind === "won" && load ? e.rate * load.miles : 0, seen: false };
    }
  }
  if (e.kind === "won") push(s, FEED.won(hubName(e.origin), hubName(e.dest), e.miles, e.rate.toFixed(2), e.manual), "good");
  if (e.kind === "delivered") {
    // S7: the pay line, on the Truck tab until OK; Money gets a dot for the invoice.
    const truck = w.trucks[e.truckId - 1];
    const load = w.loads.get(e.loadId);
    const held = truck && beforeDelivery.has(truck.id) ? Math.max(0, (truck.depositFd ?? 0) - beforeDelivery.get(truck.id)!.depositFd) : 0;
    const owedTo = w.receivables.filter((r) => r.holder === s.player!.id).reduce<{ id: number; dueDay: number } | null>((a, r) => (!a || r.id > a.id ? r : a), null);
    const paidOn = owedTo && owedTo.dueDay > Math.floor(w.t / 1440) ? shortDate(owedTo.dueDay) : "today";
    push(s, FEED.delivered(hubName(e.origin), hubName(e.dest), fdFull(e.grossFd), fdFull(e.grossFd - e.costFd - held), paidOn));
    // Not while a replay passes old deliveries (a late order makes the live world replay its history).
    if (s === S.game && !rebuilding && truck && load) {
      const line = payLine(w, truck, load, e.grossFd, e.costFd, beforeDelivery.get(truck.id) ?? { emptyMi: 0, depositFd: truck.depositFd ?? 0 });
      const due = w.receivables.filter((r) => r.holder === s.player!.id).reduce<{ id: number; dueDay: number } | null>((a, r) => (!a || r.id > a.id ? r : a), null);
      if (due) S.invoiceLanes.set(due.id, `${w.net.hubs[e.origin]!.name} → ${w.net.hubs[e.dest]!.name}`);
      const driver = truck.driverId ? w.staff[truck.driverId - 1] : undefined;
      S.delivered = { origin: e.origin, dest: e.dest, lateH: Math.max(0, Math.ceil((w.t - load.dueT) / 60)), line, dueDay: due && due.dueDay > Math.floor(w.t / 1440) ? due.dueDay : null, hiredDriver: driver && !driver.owner ? driver.name : null };
      S.moneyDot = true;
    }
  }
  if (e.kind === "lostBid") push(s, FEED.lost(hubName(e.origin), hubName(e.dest), e.rate.toFixed(2), e.winningRate !== null ? e.winningRate.toFixed(2) : null), "warn");
  if (e.kind === "breakdown") push(s, `Breakdown on truck ${truckNo(e.truckId)}${e.repairFd ? `: ${fd(e.repairFd)} FD repair bill` : " (lessor pays)"}`, "bad");
  if (e.kind === "truckDelivered") {
    const t = w.trucks[e.truckId - 1];
    const needs = t && !crewed(t);
    push(s, `New truck delivered: truck ${truckNo(e.truckId)} is ready${needs ? " and needs a driver: hire one on the Staff tab" : ""}`, needs ? "warn" : "good");
    if (s === S.game && needs) toast(`Truck ${truckNo(e.truckId)} was delivered with no driver. Hire one on the Staff tab or it earns nothing.`, true);
  }
  if (e.kind === "liquidated") push(s, FEED.woundUp, "bad");
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
  loadOnboard();
  whenAssetsReady(() => bumpData());
  truckSheet();
  setDefaultOrders(() => DEFAULT_ORDERS);
  wireHandlers();
  wireKeys();
  render(<App />, document.getElementById("app")!);
  if (TEST_BUILD) return bootTest();
  await connectLive();
}

/** Signs in to the store and reads the world; the title's Sign in and Retry run this again. */
async function connectLive(): Promise<void> {
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
  // The replay runs behind the title, the button reading "Connecting…" (S0), so the title is the login and nothing else.
  showTitle({ kind: "connecting" });
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
  // The live rings (S1): read the starter hubs after each round of the replay's last two game days and from then on, so
  // the rings' four-round mean is ready at the first look instead of falling back.
  lw.onHour = (w) => {
    if (w.t % 720 === 360 && w.t >= lw.gameMinute() - 2 * 1440) sampleStarters(w);
  };
  lw.onJoin = (uid, c) => {
    push(lw, uid === S.platform.uid ? `${c.name} is on the road out of ${lw.w.net.hubs[c.homeHub]!.id}. Good luck.` : `${c.name} joined the world, hauling out of ${lw.w.net.hubs[c.homeHub]!.id}`, "good");
    if (uid === S.platform.uid) {
      S.selTruck = lw.w.trucksByCompany.get(c.id)?.[0]?.id ?? null;
      // The flight home runs once, when this page's own join lands, never when a replay passes an old one.
      if (joiningLive) {
        joiningLive = false;
        S.sheet = "half";
        flyTo(c.homeHub);
      }
      bumpData();
    }
  };
  await lw.rebuild((share) => {
    S.loadShare = share;
  });
  // Caught up: the title offers Continue (with a company) or Enter the world (without one, the hub is chosen inside).
  showTitle({ kind: "ready" });
}

/** The test build always opens on the title (Jeff, 2026-11-01); a world saved in this browser gets a Continue button there. */
async function bootTest(): Promise<void> {
  S.platform = { db: null, uid: null, owner: true, local: true };
  const log = readTest();
  S.savedTest = log && log !== "stale" ? { name: log.name, day: Math.floor(log.t / 1440) } : null;
  showTitle({ kind: "test" });
  if (log === "stale") toast("The rules changed since your last visit, so your old test world can't be replayed. Start a new one.");
}

/** Replays the saved test world (the title's Continue button). */
async function continueTest(): Promise<void> {
  const log = readTest();
  if (!log || log === "stale") {
    S.savedTest = null;
    showTitle({ kind: "test" });
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
    S.savedTest = null;
    showTitle({ kind: "test" });
    toast("Your saved test world couldn't be replayed, so it was set aside. Start a new one.", true);
    return;
  }
  S.test = t;
  t.onEvent((e) => onEvent(t, e));
  markPersisted(t);
  S.speed = 0;
  showGame(t);
  toast("Welcome back. The clock is paused; press a speed or 1–4 to run it.");
}

/**
 * A new test world: the market runs its two warm days behind the loading screen, then you're in it with no company,
 * the clock paused, choosing your home hub (Jeff, 2026-11-02).
 */
async function openTest(): Promise<void> {
  // "Starting the world…" over the title loop while the market runs its two warm days (S0).
  showTitle({ kind: "starting" });
  // The warm-up reads the starter hubs after each of its four rounds, so the rings' four-round mean is ready on arrival.
  const t = await TestGame.create(
    (share) => {
      S.loadShare = share;
    },
    (w) => {
      if (w.t % 720 === 360) sampleStarters(w);
    },
  );
  S.test = t;
  t.onEvent((e) => onEvent(t, e));
  S.speed = 0;
  acc = 0;
  showGame(t);
}

/** The hub chosen inside the world: in a test world the company joins now; live, the join is sent like any order. */
let joiningLive = false;
function choose(name: string, hub: string, start: StartKind): void {
  const g = S.game;
  if (!g || g.player) return;
  const at = g.w.net.hubs.findIndex((h) => h.id === hub);
  // A new company hears Iuliia's arrival line, even in a browser that heard it for an earlier one.
  setOnboard({ seen: S.onboard.seen.filter((x) => x !== "arrival") });
  if (g.kind === "test") {
    const c = g.join(name, start, hub);
    if (!c) return toast("That hub can't take a new company.", true);
    S.selTruck = g.w.trucksByCompany.get(c.id)?.[0]?.id ?? null;
    S.speed = 2; // a game day a minute (state.ts SPEEDS)
    persistTest(true);
    flyTo(at);
    bumpData();
    return;
  }
  // Live: the join is an order like any other; the flight home waits for the company to exist (lw.onJoin).
  joiningLive = true;
  H.join(name, hub);
}

function wireHandlers(): void {
  H.continueTest = () => void continueTest();
  H.showMenu = () => {
    if (!S.game) return;
    showTitle(S.game.kind === "test" && !S.live ? { kind: "test" } : { kind: "menu" });
  };
  H.openTest = () => void openTest();
  H.enterWorld = () => {
    if (S.live) showGame(S.live);
  };
  H.retry = () => void connectLive();
  H.choose = choose;
  H.backToLive = () => {
    S.test = null;
    if (S.live) {
      showGame(S.live);
    } else void connectLive();
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
      bumpData();
    });
  };
  H.join = (name: string, hub: string) => {
    const lw = S.live!;
    lw.submit({ type: "join", name, hub }).then(
      (r) => {
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
  // F toggles full screen, + - 0 zoom the map, Esc restores the split layout; in the test world only, space pauses and 1–4 set the speed.
  document.addEventListener("keydown", (ev) => {
    if ((ev.target as HTMLElement).closest("input,select,textarea")) return;
    const g = S.game;
    if (!g) return;
    if (ev.key === "f" || ev.key === "F") toggleFullscreen();
    if (ev.key === "+" || ev.key === "=") setZoom(zoomIndex() + 1);
    if (ev.key === "-" || ev.key === "_") setZoom(zoomIndex() - 1);
    if (ev.key === "0") setZoom(0);
    if (ev.key === "Escape" && S.cityView !== null) {
      S.cityView = null;
      S.townView = null;
      bumpData();
      return;
    }
    if (ev.key === "Escape" && S.layout !== "split") setLayout("split");
    if (g.kind !== "test") return;
    if (ev.key === " ") {
      S.speed = S.speed === 0 ? 2 : 0;
      ev.preventDefault();
      bumpData();
    }
    if (ev.key >= "1" && ev.key <= "4") {
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
/** Each of your trucks as the screen last saw it, for the pay line of a delivery that happens between frames (rolling.ts). */
const beforeDelivery = new Map<number, TruckBefore>();
function observe(s: Session): void {
  const f = feed(s);
  const w = s.w;
  if (s.player) for (const t of w.trucksByCompany.get(s.player.id) ?? []) beforeDelivery.set(t.id, { emptyMi: t.emptyMi, depositFd: t.depositFd ?? 0 });
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
        checkIdleAlerts();
        checkAttention();
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
