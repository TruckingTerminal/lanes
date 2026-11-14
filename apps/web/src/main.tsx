import { MENUS } from "./copy-menus.js";
import { costLeft, payLanding } from "./moneymotion.js";
import { onCost } from "./books.js";
import { initMotion } from "./motion.js";
import { render } from "preact";
import { companyAccount, condition, crewed, marketMood, onTimeBy, resting, staffById, type Company, type GameEvent, type World } from "@lanes/engine";
import { installTheme } from "./art.js";
import { truckSheet, whenAssetsReady } from "./assets.js";
import { fd, fdFull, hhmm, realUntil, shortDate } from "./format.js";
import { DELIVERED, FEED, LOADING, MARKET, MONTH, ROUND } from "./copy.js";
import { iuliiaOnChange, iuliiaSay, iuliiaSayText } from "./iuliia.js";
import { RULESET, TestGame, type StartKind } from "./game.js";
import { H } from "./handlers.js";
import { createMeta, LiveWorld, readMeta, type DbLike, type WorldMeta } from "./live.js";
import { checkAttention, checkIdleAlerts, needs, settleHandBids } from "./logic.js";
import { invoices } from "./ledger.js";
import { nightStop, paidLine, payLine, type TruckBefore } from "./rolling.js";
import { sampleStarters } from "./hubcard.js";
import { drawMap, fitMap, flyTo, resetArt, setZoom, zoomIndex } from "./mapview.js";
import { MemoryDb } from "./memdb.js";
import { bumpData, bumpTick, feed, holdStill, loadOnboard, onWorldReset, resetWorldState, setOnboard, loadTheme, claimTestLock, markPersisted, persistTest, push, pushKeyed, readTest, S, setLayout, setTab, SPEEDS, TEST_BUILD, toast, toggleFullscreen, truckNo, type Session, type TitleMenu } from "./state.js";
import { App } from "./ui/App.js";
import { askWhatNow } from "./ui/WhatNow.js";
import { poachResult } from "./ui/panels/Staff.js";
import { returnFor, saveVisit } from "./returncard.js";
import { checkVersion } from "./version.js";
import { lostWhy, profitOver } from "./board.js";
import { firstTruckLine } from "./figures.js";
import { PENDING } from "./copy-pending.js";
import { panelsMoved } from "./panelclock.js";

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
  if (S.game !== s) {
    resetArt();
    // A world's cards, results, badges and records are its own (QA item 8 for the return card; the diaries of
    // 2026-11-09 for the rest): a new world starts as a reload would.
    resetWorldState();
  }
  S.game = s;
  feed(s).lastT = s.w.t;
  const truck = s.player ? s.w.trucksByCompany.get(s.player.id)?.find((t) => t.status !== "retired") : undefined;
  S.selTruck = truck?.id ?? null;
  setTab("fleet");
  S.sheet = "half";
  // Before a company, the first entry starts at Iuliia's welcome; a returning player opens on their truck, no flight.
  if (!s.player) S.entry = { stage: "welcome", beat: 0, hub: null, rings: null };
  else if (truck) flyTo(truck.hub, true);
  // R21: a return after RETURN_HOURS away opens on the return card; this visit is then kept for the next one.
  if (s.player) {
    S.returnCard = returnFor(s.w, s.player, s.kind === "live");
    saveVisit(s.w, s.player);
  }
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
  // The feed names cities, never airport codes (copy-audit.md), and a load by its own places, the ones its card showed
  // (QA, 2026-11-02: the load said Carrollton → El Dorado, the result Dallas → Wichita).
  const hubName = (i: number) => w.net.hubs[i]!.name;
  const ends = (loadId: number, o: number, d: number): [string, string] => {
    const l = w.loads.get(loadId);
    return l ? [w.net.places[l.originPlace]!.name, w.net.places[l.destPlace]!.name] : [hubName(o), hubName(d)];
  };
  if (e.kind === "launched") {
    push(s, "FD is live on the exchange. Your airdrop's first quarter has landed.", "warn");
    if (s === S.game) toast("Launch day: FD can now be bought and sold.");
  }
  // Client batch 8b item 37: a notice for the player's other company (the carrier's, with the brokerage in view, or the
  // reverse) is kept in that company's own lines; every other event acts for the company in view only.
  if (!s.player || !("companyId" in e)) return;
  const other = e.companyId !== s.player.id;
  if (other && !(e.kind === "notice" && (e.companyId === s.carrier?.id || e.companyId === s.brokerage?.id))) return;
  // A bid placed by hand from the board: the round's result card says how it did (S5) until OK or the next bid.
  if ((e.kind === "won" || e.kind === "lostBid") && s === S.game) {
    const mine = S.handBids.get(e.loadId);
    if (mine) {
      S.handBids.delete(e.loadId);
      const load = w.loads.get(e.loadId);
      const winning = e.kind === "won" ? e.rate : e.winningRate;
      iuliiaSay(e.kind === "won" ? "result:won" : e.winningRate === null ? "result:nobody" : "result:lost");
      S.result = { won: e.kind === "won", from: ends(e.loadId, e.origin, e.dest)[0], to: ends(e.loadId, e.origin, e.dest)[1], rate: e.kind === "won" ? e.rate : mine.rate, winning, be: mine.be, total: e.kind === "won" && load ? e.rate * load.miles : 0, seen: false, winnerId: e.kind === "lostBid" && load && load.carrierId ? load.carrierId : undefined, lost: e.kind === "lostBid" && winning !== null && load ? { loadId: e.loadId, truckId: e.truckId, profitAtWinningFd: profitOver(w, w.trucks[e.truckId - 1], winning, mine.be, load.miles), round: w.round } : undefined, why: e.kind === "lostBid" && load ? lostWhy(w, load, { truckId: e.truckId, rate: mine.rate }) : null };
    }
  }
  if (e.kind === "won") {
    const [from, to] = ends(e.loadId, e.origin, e.dest);
    const booked = S.bookedLoads.delete(e.loadId);
    const load = w.loads.get(e.loadId);
    // A book-now (by hand, or by the dispatcher's book-now rule) clears at the load's book-now rate; a bid rarely lands on it.
    const atBookNow = load !== undefined && Math.abs(e.rate - load.bookNow) < 0.005;
    // Client batch X (fail 12): keyed by the load, so its line goes if the load is released (state.ts tickerInView).
    pushKeyed(s, `booked:${e.loadId}`, booked ? ROUND.booked(from, to, fdFull(load ? e.rate * load.miles : 0)) : atBookNow ? FEED.booked(from, to, e.miles, e.rate.toFixed(2)) : FEED.won(from, to, e.miles, e.rate.toFixed(2), e.manual), "good");
  }
  if (e.kind === "delivered") {
    // S7: the pay line, on the Truck tab until OK; Money gets a dot for the invoice.
    const truck = w.trucks[e.truckId - 1];
    const load = w.loads.get(e.loadId);
    const held = truck && beforeDelivery.has(truck.id) ? Math.max(0, (truck.depositFd ?? 0) - beforeDelivery.get(truck.id)!.depositFd) : 0;
    // The invoice this delivery raised, if any: the newest receivable, and the player's as payee (under factoring the
    // factor holds it). Labelling "the newest the player holds" put a new lane on an older invoice (diary 2, row 7).
    const fresh = w.receivables.find((r) => r.id === w.nextReceivableId - 1 && r.payeeId === s.player!.id);
    const paid = truck ? paidLine(w, s.player!, truck, fresh) : DELIVERED.paidToday;
    // "Yours" as the pay card reads it (rolling.ts payLine): the detention the poster paid is in it (the diaries: 2,825 here, 3,305 there).
    push(s, FEED.delivered(...ends(e.loadId, e.origin, e.dest), fdFull(e.grossFd), fdFull(e.grossFd - e.costFd - held + (load?.detention?.fd ?? 0)), paid, held >= 0.5));
    const fd = feed(s).deliveries;
    fd.push({ day: Math.floor(w.t / 1440), grossFd: e.grossFd });
    if (fd.length > 60) fd.shift();
    // Not while a replay passes old deliveries (a late order makes the live world replay its history).
    if (s === S.game && !rebuilding && truck && load) {
      const line = payLine(w, truck, load, e.grossFd, e.costFd, beforeDelivery.get(truck.id) ?? { emptyMi: 0, depositFd: truck.depositFd ?? 0 });
      if (fresh) S.invoiceLanes.set(fresh.id, ends(e.loadId, e.origin, e.dest).join(" → "));
      const driver = truck.driverId ? w.staff[truck.driverId - 1] : undefined;
      S.delivered = { from: ends(e.loadId, e.origin, e.dest)[0], to: ends(e.loadId, e.origin, e.dest)[1], lateH: e.onTime ? 0 : Math.max(0, Math.ceil(((w.cfg.docks.lateFromArrival && load.arrivedT !== undefined ? load.arrivedT : w.t) - onTimeBy(w, load)) / 60)), line, paid, hiredDriver: driver && !driver.owner ? driver.name : null };
      S.moneyDot = fresh ? "invoice" : "paid";
      // The menu system §2.4: the pay landing: the toast with what reached you, then the spark to the cash.
      toast(MENUS.paidToast(S.delivered.from, S.delivered.to, fdFull(line.yours)));
      payLanding(() => document.querySelector(".toast"));
      iuliiaSay(e.onTime ? "delivered:onTime" : "delivered:late");
    }
  }
  if (e.kind === "lostBid") push(s, FEED.lost(...ends(e.loadId, e.origin, e.dest), e.rate.toFixed(2), e.winningRate !== null ? e.winningRate.toFixed(2) : null), "warn");
  // R9: one at or over guard.newsFd is a money event (books.ts), in the money style on Today; the ticker keeps its line.
  if (e.kind === "breakdown") push(s, `Breakdown on truck ${truckNo(e.truckId)}${e.repairFd ? `: ${fd(e.repairFd)} FD repair bill` : " (lessor pays)"}`, e.repairFd >= s.w.cfg.guard.newsFd ? "bad money" : "bad");
  if (e.kind === "truckDelivered") {
    const t = w.trucks[e.truckId - 1];
    const needs = t && !crewed(t);
    push(s, `New truck delivered: truck ${truckNo(e.truckId)} is ready${needs ? " and needs a driver: hire one on the Staff tab" : ""}`, needs ? "warn" : "good");
    if (s === S.game && needs) toast(`Truck ${truckNo(e.truckId)} was delivered with no driver. Hire one on the Staff tab or it earns nothing.`, true);
  }
  if (e.kind === "liquidated") push(s, FEED.woundUp, "bad");
  if (e.kind === "notice") {
    const text = s === S.game ? e.text.replace(/\bTruck (\d+)\b/g, (m, id: string) => (truckNo(Number(id)) ? `Truck ${truckNo(Number(id))}` : m)) : e.text;
    push(s, text, e.tone === "good" ? "good" : e.tone === "bad" ? "bad" : "", e.companyId);
    if (other) return;
    if (s === S.game && (e.topic === "crash" || e.topic === "authority")) toast(text, e.tone === "bad");
    if (s === S.game && e.topic === "staff") poachResult(w, s.player!, e.text);
  }
  if (s === S.game) bumpData();
}

// --- Boot ---------------------------------------------------------------------------------

async function boot(): Promise<void> {
  installTheme();
  loadTheme();
  initMotion(); // the Motion setting (the menu system §2.6): <html data-motion>, from the system until the player chooses
  // The menu system §2.4: a cost leaving the player's cash, as it happens, shows in the chip under the cash.
  // Batch M2 (QA: "−1,953 FD · 8 costs" beside the toast's "1,533 FD yours" read as a second loss): a delivery's own
  // deductions (fuel, tolls, upkeep, the lessor's share and the fee, all posted on the load's ref) stay out of the chip,
  // since the toast and the pay card already net them; the chip is for costs that leave on their own.
  onCost((w, c, fd, line, ref) => {
    if (ref.startsWith("load:")) return;
    if (S.game?.w === w && S.game.player?.id === c.id) costLeft(fd, (MONTH.row[line] ?? line).toLowerCase());
  });
  loadOnboard();
  whenAssetsReady(() => bumpData());
  truckSheet();
  wireHandlers();
  wireKeys();
  render(<App />, document.getElementById("app")!);
  void checkVersion(); // a page from before the last deploy reloads once onto it (version.ts)
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
  const lw = await LiveWorld.open(S.platform.db!, meta, S.platform.uid, { owner: S.platform.owner });
  S.live = lw;
  // The owner's page only (persistence §2, the marker): orders that arrived stamped in the past, read in the console as
  // lanesOwner.earlyStamps(). Never shown to players; each one also logs a console warning as it lands.
  if (S.platform.owner) (window as unknown as { lanesOwner?: unknown }).lanesOwner = { earlyStamps: () => lw.earlyStamps.slice() };
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
        setTab("fleet");
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
  // Said on the title itself, standing until a new world starts: a toast renders only inside the game (QA client 5).
  S.titleNote = log === "stale" ? "stale" : null;
  showTitle({ kind: "test" });
}

/** Replays the saved test world (the title's Continue button). */
async function continueTest(): Promise<void> {
  const log = readTest();
  if (!log || log === "stale") {
    S.savedTest = null;
    S.titleNote = log === "stale" ? "stale" : null;
    showTitle({ kind: "test" });
    return;
  }
  showLoading(LOADING.title, "");
  // Persistence §4: one tab plays this browser's world; a second one opened on it only watches.
  const mine = await claimTestLock();
  let t: TestGame;
  try {
    if (!log.acts.every((x) => Array.isArray(x) && Number.isFinite(x[0]) && x[1] && typeof x[1] === "object")) throw new Error("bad log");
    t = await TestGame.restore(log, (share) => {
      S.loadShare = share;
    });
  } catch {
    S.savedTest = null;
    S.titleNote = "unreadable";
    showTitle({ kind: "test" });
    return;
  }
  S.test = t;
  t.onEvent((e) => onEvent(t, e));
  markPersisted(t, log);
  S.testWatching = !mine;
  S.speed = 0;
  showGame(t);
  toast("Welcome back. The clock is paused; press a speed or 1–4 to run it.");
  // Persistence §6: orders the replay refused are kept in the save; the player hears how many.
  if (t.refusedOnRestore) toast(PENDING.testRefusedOnRestore(t.refusedOnRestore), true);
  if (!mine) toast(PENDING.testWatching, true);
}

/**
 * A new test world: the market runs its warm start (game.ts WARM_HOURS) behind the loading screen, then you're in it with no company,
 * the clock paused, choosing your home hub (Jeff, 2026-11-02).
 */
async function openTest(): Promise<void> {
  // "Starting the world…" over the title loop while the market runs its warm start (S0). A new world ends the title's note.
  S.titleNote = null;
  showTitle({ kind: "starting" });
  const mine = await claimTestLock();
  // The warm-up reads the starter hubs after each round (the mean keeps the last four), so the rings are ready on arrival.
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
  markPersisted(t);
  S.testWatching = !mine;
  S.speed = 0;
  acc = 0;
  showGame(t);
  if (!mine) toast(PENDING.testWatching, true);
}

/** The hub chosen inside the world: in a test world the company joins now; live, the join is sent like any order. */
let joiningLive = false;
/** The longest a press holds the screen still (state.ts holdStill): long enough for a tap, short of a reading pause. */
const HOLD_CAP_MS = 1500;
/** The test world speeds up to Day a minute once, at the player's first bid by hand. */
let firstBidSped = true;
function choose(name: string, hub: string, start: StartKind, look: "m" | "f" = "m"): void {
  const g = S.game;
  if (!g || g.player) return;
  const at = g.w.net.hubs.findIndex((h) => h.id === hub);
  // A new company hears Iuliia's arrival line, even in a browser that heard it for an earlier one.
  setOnboard({ seen: S.onboard.seen.filter((x) => x !== "arrival") });
  if (g.kind === "test") {
    const c = g.join(name, start, hub, look);
    if (!c) return toast("That hub can't take a new company.", true);
    S.selTruck = g.w.trucksByCompany.get(c.id)?.[0]?.id ?? null;
    // Live pace until the first bid by hand (QA, 2026-11-02: at Day a minute the first round cleared while a stranger
    // read a load). The world still moves at its real rhythm; the first bid sets Day a minute, so the round comes soon.
    // A small fleet's dispatcher runs from the start (no first bid by hand to wait for), so it starts at Day a minute.
    S.speed = start === "fleet" ? 2 : 1;
    firstBidSped = start === "fleet";
    // The arrival opens where the player lands (S1): the Truck tab, the sheet at half, Iuliia's arrival line.
    setTab("fleet");
    S.sheet = "half";
    persistTest(true);
    flyTo(at);
    bumpData();
    return;
  }
  // Live: the join is an order like any other; the flight home waits for the company to exist (lw.onJoin).
  joiningLive = true;
  H.join(name, hub, look);
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
  H.join = (name: string, hub: string, look: "m" | "f" = "m") => {
    const lw = S.live!;
    lw.submit({ type: "join", name, hub, look }).then(
      (r) => {
        toast(`Registering ${name}. Your truck is ready at ${hhmm(r.at)}, in ${realUntil(lw.msUntil(r.at))}.`);
      },
      (e: unknown) => toast(`Couldn't join: ${(e as { message?: string })?.message ?? "the store refused it"}`, true),
    );
  };
}

function wireKeys(): void {
  addEventListener("resize", () => S.game && fitMap());
  // A press on the panel holds the screen still until it lifts and its click has run (state.ts holdStill); never the
  // map, whose drag is its own; a long press lets go after HOLD_CAP_MS.
  let holdTimer = 0;
  const release = () => {
    clearTimeout(holdTimer);
    setTimeout(() => holdStill(false), 0);
  };
  document.addEventListener(
    "pointerdown",
    (ev) => {
      if ((ev.target as Element | null)?.closest?.("#map")) return;
      holdStill(true);
      clearTimeout(holdTimer);
      holdTimer = window.setTimeout(() => holdStill(false), HOLD_CAP_MS);
    },
    true,
  );
  document.addEventListener("pointerup", release, true);
  document.addEventListener("pointercancel", release, true);
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
    // "?" asks What now? from anywhere outside a text field (guidance-ux.md, laptop).
    if (ev.key === "?") askWhatNow();
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
onWorldReset(() => {
  beforeDelivery.clear();
  firstBidSped = true;
  soundSeen = null;
});

/**
 * Client batch 8c item 70 (the director, director-qa-0241-2026-11-12.md §3), while the company owns no truck, read once a
 * game hour: Iuliia marks a quarter, half and three quarters of the way to a sound truck (the furthest reached this
 * sitting, so a dip and a climb back say nothing twice), and keeps the listing watch: a sound used truck listed for less
 * than the one the card priced. The first look only sets a baseline, as her other change lines do.
 */
let soundSeen: { co: number; hour: number; best: number; price: number | null } | null = null;
function soundWatch(w: World, c: Company): void {
  const hour = Math.floor(w.t / 60);
  if (soundSeen && soundSeen.co === c.id && soundSeen.hour === hour) return;
  if ((w.trucksByCompany.get(c.id) ?? []).some((t) => t.lease === "owned")) return;
  const f = firstTruckLine(w, c);
  const bucket = f && f.progress !== null ? Math.floor(f.progress * 4) : -1;
  const price = f?.pick?.price ?? null;
  const was = soundSeen && soundSeen.co === c.id ? soundSeen : null;
  soundSeen = { co: c.id, hour, best: Math.max(was?.best ?? bucket, bucket), price };
  if (!was || !f) return;
  if (bucket > was.best && (bucket === 1 || bucket === 2 || bucket === 3)) iuliiaSayText(PENDING.soundQuarter(bucket));
  else if (f.pick?.route === "listing" && price !== null && was.price !== null && price < was.price - 0.5) iuliiaSayText(PENDING.soundListed(f.pick.desc, fdFull(price)));
}
function observe(s: Session): void {
  const f = feed(s);
  const w = s.w;
  if (s.player) for (const t of w.trucksByCompany.get(s.player.id) ?? []) beforeDelivery.set(t.id, { emptyMi: t.emptyMi, depositFd: t.depositFd ?? 0 });
  if (s === S.game && s.player) {
    for (const t of w.trucksByCompany.get(s.player.id) ?? []) {
      const home = resting(w, t);
      if (home) S.homeNow.add(t.id);
      else if (S.homeNow.delete(t.id)) S.idleFrom.set(t.id, w.t);
    }
  }
  if (w.t === f.lastT) return;
  if (s === S.game) settleHandBids(s);
  // Iuliia on named changes (iuliia-lines.md): a truck rolling or waiting for its first load, wear past the rebuild line,
  // a shoulder night on a load of the player's own, the first thing waiting, cash below zero, the first invoice on an owned
  // truck, the safety rating moving, the policy renewing, a driver turning restless. The first look only sets a baseline.
  if (s === S.game && s.player) {
    const c = s.player;
    soundWatch(w, c);
    for (const t of w.trucksByCompany.get(c.id) ?? []) {
      // Who last drove each truck, while this page watched: What now? names a driver who has gone only when one did.
      const d = t.driverId ? staffById(w, t.driverId) : null;
      if (d && !d.owner) S.lastDriver.set(t.id, d.name);
      iuliiaOnChange(`truck:${t.id}`, t.status, t.status === "loaded" ? "truck:rolling" : t.status === "idle" && c.firstHandBidDay === null ? "truck:waiting" : null);
      const worn = t.lease === "owned" && condition(w.cfg, t) < w.cfg.wear.rebuildMaxCondition;
      iuliiaOnChange(`worn:${t.id}`, worn, worn ? "truck:worn" : null);
      const shoulder = t.status === "loaded" && t.loadId !== null && S.handLoads.has(t.loadId) && nightStop(w, t, c)?.kind === "shoulder";
      iuliiaOnChange(`shoulder:${t.id}`, shoulder, shoulder ? "truck:shoulder" : null);
    }
    const waitingNow = needs().length > 0;
    iuliiaOnChange("needs", waitingNow, waitingNow ? "needs:first" : null);
    const red = w.ledger.balance(companyAccount(c.id)) < 0;
    iuliiaOnChange("cash", red, red ? "money:red" : null);
    const invoiced = invoices(w, c).length > 0 && (w.trucksByCompany.get(c.id) ?? []).some((t) => t.lease === "owned");
    iuliiaOnChange("invoice", invoiced, invoiced ? "money:invoice" : null);
    iuliiaOnChange("rating", c.safety.rating, "company:rating");
    iuliiaOnChange("policy", c.insurance.signedDay, "company:renewed");
    // Restless: below the morale where the engine's quit odds start to rise (labor.morale: base + slope × (0.5 − morale)).
    const restless = (w.staffByCompany.get(c.id) ?? []).some((p) => !p.owner && p.status === "employed" && p.morale < 0.5);
    iuliiaOnChange("restless", restless, restless ? "staff:restless" : null);
  }
  const crossed = Math.floor(w.t / 1440) !== Math.floor(f.lastT / 1440);
  f.lastT = w.t;
  if (!crossed) return;
  const day = Math.floor(w.t / 1440) - 1;
  if (s.player) {
    f.history.push({ day, cash: w.ledger.balance(companyAccount(s.player.id)) });
    if (f.history.length > 120) f.history.shift();
  }
  // The market line on the day the mood crosses (freight.ts marketMood: the last week's cleared rate against the four before).
  const band = marketMood(w).state;
  if (band !== f.band && f.band !== "") push(s, MARKET.feed[band], band === "booming" ? "good" : band === "slumping" ? "bad" : "");
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
  if (t && S.game === t && !firstBidSped && t.player?.firstHandBidDay !== null && t.player) {
    firstBidSped = true;
    // Client batch 8e item 74 (QA: "the clock changes speed by itself"): the first load by hand runs at a day a minute,
    // by design (the truck's first run, watched), and now it says so.
    if (S.speed === 1) {
      S.speed = 2;
      toast(PENDING.speedFirstLoad);
    }
  }
  if (t && S.game === t) {
    acc += (dt / 1000) * SPEEDS[S.speed]!.hoursPerSec;
    const budget = now + 10;
    while (acc >= 1 && performance.now() < budget && !t.broken) {
      // Persistence §6: the hour's step wrapped as the live page's is. The engine throwing stops this world's clock for
      // good (the hour is half done): no more steps, saves or orders, and the save keeps the hour before.
      try {
        t.stepHour();
      } catch (e) {
        console.error(e);
        t.broken = { at: t.w.t, reason: (e as { message?: string })?.message ?? String(e) };
        S.speed = 0;
        toast(PENDING.testBroken, true);
        break;
      }
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
      observe(g);
      drawMap(now);
      bumpTick();
      // Client batch 8a item 66 (QA's reload hunt): `before` was read after the hour's stepping, so the panels never saw
      // the clock move and redrew only on the one-second timer; at fast speeds a truck's card, its ETA and the cash sat
      // hours behind the clock. They redraw whenever the world's minute differs from the one last drawn.
      if (panelsMoved(g.w.t) || now - lastPanelAt > 1000) {
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

// R21: the visit is kept every minute and when the page hides, so the next return knows what this one saw.
if (typeof window !== "undefined") {
  const keep = () => S.game?.player && saveVisit(S.game.w, S.game.player);
  setInterval(keep, 60_000);
  window.addEventListener("pagehide", keep);
}
