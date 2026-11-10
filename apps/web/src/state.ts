import type { Equipment } from "@lanes/config";
import { useLayoutEffect, useState } from "preact/hooks";
import { type Action, type Company, type Truck } from "@lanes/engine";
import { RULESET, TestGame, type TestLog } from "./game.js";
import type { DbLike, LiveWorld } from "./live.js";
import { fd, hhmm, realUntil, TIER_NAME, TRAILER_NAME, FAC_NAME, usd } from "./format.js";
import type { LiveAction } from "./live.js";
import { VETTING_NAMES } from "@lanes/engine";
import type { Tab } from "./tabs.js";
import { freshOnboard, ONBOARD_KEY, parseOnboard, worldMark, type Onboard } from "./onboard.js";
import type { PayLine } from "./rolling.js";
import { tabLocked } from "./tutorial.js";
import { TUTORIAL } from "./copy.js";
import { PENDING } from "./copy-pending.js";
import { truckNumber } from "./trucknos.js";

/**
 * The screen's shared state: which world is on screen, what is selected, and the
 * two change channels components subscribe to — `tick` every animation frame (the
 * clock), `data` when something the panels show has changed (at most a few times a
 * second). Mutable on purpose: the game loop writes it, components read it.
 */

declare const __LANES_TEST__: boolean | undefined;
/** The test build (the GitHub Pages site) has no shared store: it opens straight into a private test world. */
export const TEST_BUILD = typeof __LANES_TEST__ !== "undefined" && __LANES_TEST__;

export type Session = LiveWorld | TestGame;
export type { Tab } from "./tabs.js";
export type Layout = "split" | "panel" | "map";
/** The phone's sheet over the map (specs/first-ten-minutes.md, Layout): a strip with the state line, half, or full. */
export type SheetStop = "strip" | "half" | "full";
/** The first entry, before a company (specs/first-ten-minutes.md, S1): where the hub-choosing sheet stands; `beat` is how far through Iuliia's intro the welcome stage is. */
export type EntryStage = "welcome" | "home" | "all" | "card" | "board" | "name";
export type Platform = { db: DbLike | null; uid: string | null; owner: boolean; local: boolean };
export type TitleMenu =
  | { kind: "connecting" }
  | { kind: "signin" }
  | { kind: "unreachable" }
  | { kind: "notopen" }
  | { kind: "openworld" }
  | { kind: "update"; theirs: string }
  | { kind: "ready" }
  | { kind: "starting" }
  | { kind: "test" }
  | { kind: "menu" };
export type Screen = { kind: "title"; menu: TitleMenu } | { kind: "loading"; title: string; note: string } | { kind: "game" };

export const S = {
  platform: { db: null, uid: null, owner: false, local: false } as Platform,
  live: null as LiveWorld | null,
  test: null as TestGame | null,
  game: null as Session | null,
  screen: { kind: "title", menu: { kind: "connecting" } } as Screen,
  loadShare: 0,
  tab: "fleet" as Tab,
  layout: "split" as Layout,
  sheet: "half" as SheetStop,
  /** The first entry's sheet, and the three ringed hubs, ranked once when it opens so they never shuffle under a thumb. */
  entry: { stage: "welcome" as EntryStage, beat: 0, hub: null as number | null, rings: null as number[] | null },
  selTruck: null as number | null,
  selHub: null as number | null,
  /** The hub whose city pane is open over the map (opened by clicking the city or a town of its market), if any. */
  cityView: null as number | null,
  /** The town (an index into net.places) the pane was opened from, if it was a town. */
  townView: null as number | null,
  /** Load board: the load whose sheet is open (S3), or the expanded table row. */
  openLoad: null as number | null,
  /** Bids placed by hand from the board, by load: their rate and break-even, so the round's result can say how they did (S5). */
  // `filed`: a bid filed for a locals-first load's opening round (leverage.localHoldHandBids).
  handBids: new Map<number, { rate: number; be: number; truckId?: number; from?: string; to?: string; filed?: boolean }>(),
  /** Loads booked by hand from the board, so the feed says "Booked" for them, not "Won" (S4). */
  bookedLoads: new Set<number>(),
  /**
   * When each of your trucks last came off home time (game minute), as this page saw it: the idle clock restarts there,
   * so home time never counts as idling (QA, carry-over row 3). The engine's own idle clock is a rule (per diem, idle
   * fees) and stays as it is.
   */
  idleFrom: new Map<number, number>(),
  /** Loads the player bid on or booked by hand, so the Truck card can tell the dispatcher's loads from the player's own. */
  handLoads: new Set<number>(),
  /** Intel (specs/intel-ux.md): the open card, where it was opened from, and the list's filters and sort. */
  /** The board filtered to one poster's loads (Intel's "Their loads on the board"), until cleared. */
  boardPoster: null as number | null,
  /** The explain sheet while open: the figure's key, what it was computed from, its label and value (ui/Explain.tsx). */
  /** The milestone line on the caption now (caption rule 3), kept until its button or a change of tab. */
  /** The milestone line in the caption; `held` when it carries a button (R10: it stays until answered, dismissed or left). */
  /** R22's "See the ways out" until R23: the board opens once on this sort. */
  boardSortOnce: null as null | import("./board.js").BoardSort,
  /** The ways-out sheet (the director, 2026-11-09): the stranded truck whose exits head the board, until it moves. */
  waysOut: null as number | null,
  milestone: null as null | { key: string; phase: "before" | "at"; tab: string; at: number; held?: boolean },
  /** The confirm card open now (R6, ui/Confirm.tsx), and when it opened (its confirm is inert for ui.tapSettleMs). */
  /** The Dealer's row to bring into view when it next draws (the first-truck card's "See it", client batch 8a item 57). */
  dealerFocus: null as string | null,
  confirm: null as null | import("./ui/Confirm.js").ConfirmSpec & { openedAt: number; swap: boolean; tab: string; anchor?: { top: number; left: number } },
  /** The player's last order: on which tab, at which real time (R2: a caption line retires when the player acts on another screen). */
  lastAct: null as null | { tab: string; at: number },
  /** R21: what changed while the player was away, shown as the return card until answered (returncard.ts). */
  returnCard: null as null | import("./returncard.js").Away,
  /** The last return card shown in this sitting: the timeline's "Back {date}" reopens it (R21). */
  lastReturn: null as null | import("./returncard.js").Away,
  /** Our hire-away offers answered, newest first, in the writer's words: from the engine's own notice at the deadline (QA's R7 replay). */
  poachResults: [] as { staffId: number; text: string }[],
  /** The next-truck gap as last shown, and what moved it since the player last opened its explanation (row 4). */
  gapSeen: null as null | { scope: string; route: string; weeks: number; why: ("cheapest" | "cushion")[] },
  /** The invoices What now? chose to cash (rule 1's cash lever): Money opens on them. */
  cashPlan: [] as number[],
  /** Invoices cashed early in this page (Cash it now): shown greyed on their rows until the due day. */
  cashed: [] as import("./ui/panels/CashNow.js").Cashed[],
  /** A brokerage started in the live world: switch to it once the world applies the start. */
  brokerSwitch: false,
  /** Who last drove each of the player's trucks, as this page saw it (What now?'s "has gone" needs one who did). */
  lastDriver: new Map<number, string>(),
  explain: null as null | { key: string; ctx: import("./explain.js").FigureCtx; label: string; value: string; side?: "left" | "right"; tab?: string },
  /** What now?'s answer while it shows, and the tab it was asked on (ui/WhatNow.tsx). */
  whatNow: null as null | { a: import("./nextstep.js").NextAction; tab: Tab },
  /** Iuliia's tab-and-card line waiting for, or in, the caption strip (iuliia.ts). */
  iuliiaLine: null as null | { text: string; shownAt: number | null },
  intel: { card: null as number | null, back: null as Tab | null, q: "", myHub: false, hub: null as string | null, players: false, brokers: false, sort: "miles" as "miles" | "trucks" | "month", shown: 50 },
  homeNow: new Set<number>(),
  /** The last delivery, shown on the Truck tab until OK (S7); Money keeps a dot until it's opened. */
  delivered: null as null | { from: string; to: string; lateH: number; line: PayLine; paid: string; hiredDriver: string | null },
  /** Money's dot: what's new there since the last visit, a delivery's invoice or pay that landed (QA item 8: a lease has no invoices). */
  moneyDot: false as false | "invoice" | "paid",
  /** The lane each invoice was for, by receivable id, as this page saw the deliveries (Money's "Load" column). */
  invoiceLanes: new Map<number, string>(),
  /** The map follows your moving truck until you pan it (S6); "Follow" turns it back on. */
  following: true,
  /** The last round's result for a hand bid, shown on the board until OK or the next bid (S5); `seen` clears the Loads dot. */
  result: null as null | { won: boolean; from: string; to: string; rate: number; winning: number | null; be: number; total: number; seen: boolean; winnerId?: number; lost?: import("./nextstep.js").LostBid },
  /** The truck-stop site selected on the map (an id into w.sites), shown on the Business tab. */
  selSite: null as number | null,
  /** The market view's trailer type. */
  ratesEq: "van" as Equipment,
  guidePage: "start",
  /** The test build: the world saved in this browser, for the title's Continue button (name and the day it reached). */
  savedTest: null as { name: string; day: number } | null,
  /** The test build: why the saved world was set aside (QA client 5: a toast never shows on the title), said on the title until a new world starts. */
  titleNote: null as null | "stale" | "unreadable",
  /**
   * The test build (the red team's persistence §4): another tab holds this browser's world (a Web Lock, or without locks
   * another tab's write seen in the key). This tab only watches: it never saves and takes no orders.
   */
  testWatching: false,
  /** The walkthrough card (walkthrough.ts): the step being read ahead, or null for the current one. */
  walkView: null as number | null,
  /** What this browser has already been shown in the first ten minutes (onboard.ts). */
  onboard: freshOnboard(),
  /** The report form is open, and which kind it opens on. */
  reporting: false,
  reportKind: "bug" as "bug" | "idea",
  /** Test-world speeds only: the live clock can't be changed. */
  speed: 1,
  toast: null as { text: string; err: boolean; at: number } | null,
  theme: "cyber-ops",
  /** Success messages for this player's live orders, shown when each takes effect. */
  okText: new Map<number, string>(),
};

/**
 * What on the screen belongs to one world: its cards, results, badges, selections and the page's own records of it.
 * A replaced world (≡ → Title screen → New test world → Replace it) starts from these as a reload would (the diaries of
 * 2026-11-09: the last world's pay card, lost bid, cashed invoice and badges showed in the new one; QA item 8's #16 did
 * the return card alone). Everything else in S is the page's or the browser's and stays: KEPT_ACROSS_WORLDS.
 */
export const PER_WORLD = [
  "entry", "selTruck", "selHub", "cityView", "townView", "openLoad", "handBids", "bookedLoads", "idleFrom", "handLoads",
  "boardPoster", "boardSortOnce", "waysOut", "milestone", "confirm", "lastAct", "returnCard", "lastReturn", "poachResults",
  "gapSeen", "cashPlan", "cashed", "brokerSwitch", "lastDriver", "explain", "whatNow", "iuliiaLine", "intel", "homeNow",
  "delivered", "moneyDot", "invoiceLanes", "following", "result", "selSite", "walkView", "okText", "dealerFocus",
] as const satisfies readonly (keyof typeof S)[];
export const KEPT_ACROSS_WORLDS = [
  "platform", "live", "test", "game", "screen", "loadShare", "tab", "layout", "sheet", "ratesEq", "guidePage", "savedTest",
  "titleNote", "testWatching", "onboard", "reporting", "reportKind", "speed", "toast", "theme",
] as const satisfies readonly (keyof typeof S)[];
const blank = (v: unknown): unknown => (v instanceof Map ? new Map() : v instanceof Set ? new Set() : Array.isArray(v) ? [] : v !== null && typeof v === "object" ? structuredClone(v) : v);
const WORLD_START = Object.fromEntries(PER_WORLD.map((k) => [k, blank(S[k])])) as Record<string, unknown>;
/** Hooks for module state that is one world's (main.tsx's trucks as last seen, the dispatcher's set-aside orders). */
const worldResets: (() => void)[] = [];
export const onWorldReset = (f: () => void): void => void worldResets.push(f);
/** Clears everything that belongs to the world on screen; showGame calls it when the world changes. */
export function resetWorldState(): void {
  for (const k of PER_WORLD) (S as Record<string, unknown>)[k] = blank(WORLD_START[k]);
  for (const f of worldResets) f();
}

/**
 * The test world's speeds, named by what they are (Jeff, 2026-11-02: "1×" read as the game's real pace). "Live pace" is
 * the live world's own clock (live.ts: a game day every six real hours), so a tester can feel the real rhythm.
 */
export const SPEEDS: { label: string; title: string; hoursPerSec: number; icon: string }[] = [
  { label: "Paused", title: "Paused", hoursPerSec: 0, icon: "pause" },
  { label: "Live pace", title: "Test speed: the live world's pace, a game day every 6 real hours", hoursPerSec: 24 / 21600, icon: "play" },
  { label: "Day a minute", title: "Test speed: a game day every real minute", hoursPerSec: 24 / 60, icon: "ff" },
  { label: "Day in 6 s", title: "Test speed: a game day every 6 real seconds", hoursPerSec: 4, icon: "fff" },
  { label: "Day in 2 s", title: "Test speed: a game day every 2 real seconds", hoursPerSec: 12, icon: "ffff" },
];
// --- Change channels ---------------------------------------------------------------

type Channel = { v: number; subs: Set<() => void> };
const tick: Channel = { v: 0, subs: new Set() };
const data: Channel = { v: 0, subs: new Set() };
function emit(ch: Channel): void {
  ch.v++;
  for (const s of ch.subs) s();
}
/**
 * A finger or the mouse held on the panel (main.tsx): the screen holds still under it, its changes waiting until it
 * lifts, so a visible button stays where it is and pressable until the player acts (the diaries, 2026-11-09: at Day in
 * 2 s, Send home and the ⋯ menu moved or went before the press landed). A press is short; a long one lets go at a cap.
 */
let held = false;
let heldMissed = { tick: false, data: false };
export function holdStill(on: boolean): void {
  held = on;
  if (on) return;
  const missed = heldMissed;
  heldMissed = { tick: false, data: false };
  if (missed.data) emit(data);
  if (missed.tick) emit(tick);
}
/** The clock moved: cheap components that show the time re-render. */
export const bumpTick = (): void => (held ? void (heldMissed.tick = true) : emit(tick));
/** Something the panels show changed. */
export const bumpData = (): void => (held ? void (heldMissed.data = true) : emit(data));
function useChannel(ch: Channel): number {
  const [v, setV] = useState(ch.v);
  useLayoutEffect(() => {
    const f = () => setV(ch.v);
    ch.subs.add(f);
    // A bump between the first render and this subscription would be missed; catch up.
    if (ch.v !== v) setV(ch.v);
    return () => {
      ch.subs.delete(f);
    };
  }, []);
  return v;
}
export const useTick = (): number => useChannel(tick);
export const useData = (): number => useChannel(data);

// --- The feed: ticker and the cash history, per session ------------------------------

export interface Feed {
  /** `key`: a line kept current in place (pushKeyed), not one more line each time. */
  ticker: { text: string; cls: string; key?: string }[];
  history: { day: number; cash: number }[];
  /** The company's deliveries as this page saw them (gross, game day), newest last: Finance's "average load" (specs/finance.md). */
  deliveries: { day: number; grossFd: number }[];
  band: string;
  lastT: number;
}
const feeds = new Map<Session, Feed>();
export function feed(s: Session | null = S.game): Feed {
  if (!s) return { ticker: [], history: [], deliveries: [], band: "", lastT: 0 };
  let f = feeds.get(s);
  if (!f) feeds.set(s, (f = { ticker: [], history: [], deliveries: [], band: "", lastT: s.w.t }));
  return f;
}
export function push(s: Session, text: string, cls = ""): void {
  const f = feed(s);
  f.ticker.unshift({ text, cls });
  if (f.ticker.length > 30) f.ticker.pop();
  if (s === S.game) bumpData();
}
/**
 * One line per key, kept current (client batch 8a item 48, the stubborn specialist: a truck standing idle wrote a new
 * "idle N d" line into Today every day and buried everything else): the key's earlier line goes, and the new one leads.
 */
export function pushKeyed(s: Session, key: string, text: string, cls = ""): void {
  const f = feed(s);
  const i = f.ticker.findIndex((x) => x.key === key);
  if (i >= 0) f.ticker.splice(i, 1);
  f.ticker.unshift({ text, cls, key });
  if (f.ticker.length > 30) f.ticker.pop();
  if (s === S.game) bumpData();
}

// --- Reading the world -------------------------------------------------------------------

/** The player's company on screen; panels only call this once they've checked there is one. */
export const me = (): Company => S.game!.player!;
/**
 * The company a truck belongs to (client batch 8a item 29, engineering's dispatcher triage): what's said and done about a
 * truck reads its own company, never the company in view, so the brokerage's view doesn't explain the carrier's trucks
 * from the brokerage's orders.
 */
export const ownerOf = (t: Truck): Company => S.game!.w.companies[t.companyId - 1]!;
/** The carrier: the company whose trucks the screens show, whichever company is in view. */
export const carrierCo = (): Company => S.game!.carrier ?? S.game!.player!;
/** Game time on screen: the live world shows the clock's minute, a test world its own hour. */
export const clockMin = (s: Session | null = S.game): number => (!s ? 0 : s.kind === "live" ? Math.max(s.w.t, s.gameMinute()) : s.w.t);
/** The player's trucks: the carrier's, whichever company is in view (a brokerage runs none; the map shows them both ways). */
export function myTrucks(): Truck[] {
  const g = S.game;
  const c = g?.carrier ?? g?.player;
  return g && c ? (g.w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired") : [];
}
/** The number the player knows a truck by: given once and never changed (trucknos.ts, client batch 8a items 1 and 19). */
export function truckNo(id: number): number {
  const g = S.game;
  const t = g?.w.trucks[id - 1];
  return g && t ? truckNumber(g.w, t) : 0;
}

let toastTimer = 0;
export function toast(text: string, err = false): void {
  S.toast = { text, err, at: Date.now() };
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    S.toast = null;
    bumpData();
  }, 4200);
  bumpData();
}

/** Updates this browser's onboarding record (onboard.ts) and keeps it. */
export function setOnboard(change: Partial<Omit<Onboard, "v">>): void {
  S.onboard = { ...S.onboard, ...change };
  try {
    localStorage.setItem(ONBOARD_KEY, JSON.stringify(S.onboard));
  } catch {
    /* a private window: the first visit just plays again next time */
  }
  bumpData();
}
/** This company's mark in this world (onboard.ts worldMark); before a company is chosen, the browser's own. */
export const markKey = (k: string): string => (S.game?.player ? worldMark(S.game.w, S.game.player, k) : k);
/** Whether this company has opened a tab (or `board`) in this world. */
export const visited = (tab: string): boolean => S.onboard.visited.includes(markKey(tab));
/** Marks a tab (or `board`) opened for this company in this world. */
export function markVisited(tab: string): void {
  if (S.game?.player && !visited(tab)) setOnboard({ visited: [...S.onboard.visited, markKey(tab)] });
}
export function loadOnboard(): void {
  try {
    S.onboard = parseOnboard(localStorage.getItem(ONBOARD_KEY));
  } catch {
    S.onboard = freshOnboard();
  }
}

/** Opens Intel at a company's card, or at the list filtered (a hub, the brokers); its back arrow returns to where it came from. */
export function openIntel(at: { card?: number; hub?: string; brokers?: boolean; sort?: "miles" | "trucks" | "month" }): void {
  const back = S.tab === "intel" ? S.intel.back : S.tab;
  S.intel = { ...S.intel, card: at.card ?? null, back: at.card !== undefined ? back : null, hub: at.hub ?? (at.card !== undefined ? S.intel.hub : null), brokers: at.brokers ?? (at.card !== undefined ? S.intel.brokers : false), sort: at.sort ?? S.intel.sort, shown: 50 };
  if (isPhone()) S.sheet = at.card !== undefined ? "full" : "half";
  setTab("intel");
}
export function setTab(tab: Tab): void {
  // The first load's lock (tutorial.ts; Jeff, 2026-11-04): until it, only Truck and Loads open; a locked tab says so and stays put.
  const g = S.game;
  if (g?.player && tabLocked(g.w, g.player, tab)) return toast(TUTORIAL.locked);
  S.tab = tab;
  if (tab === "money") S.moneyDot = false;
  // The first visit clears an opened teaser's "New" under More.
  markVisited(tab);
  bumpData();
}
/** The phone layout's breakpoint: under 900 px the map fills the screen and the panel rides in a sheet. */
export const PHONE_QUERY = "(max-width: 899px)";
export const isPhone = (): boolean => window.matchMedia(PHONE_QUERY).matches;
export function setSheet(stop: SheetStop): void {
  if (S.sheet === stop) return;
  S.sheet = stop;
  bumpData();
}
export function setLayout(l: Layout): void {
  S.layout = l;
  bumpData();
}
export function selectTruck(id: number | null): void {
  S.selTruck = id;
  bumpData();
}

// --- The test build's world, kept in this browser -------------------------------------

const TEST_KEY = "lanes.testworld.v1";
/**
 * The test page's guard against two tabs on one saved world (the red team, persistence §4): a Web Lock on the world's
 * key, taken at Continue and at New world and held for the tab's life. A tab that can't take it only watches.
 */
let lockHeld = false;
/** Whether this browser's Web Locks work here (every current browser has them; a refused request clears it). */
let locksWork = typeof navigator !== "undefined" && typeof navigator.locks?.request === "function";
/** Takes the world's lock for this tab if it's free; true when this tab may save (also where there are no locks). */
export function claimTestLock(): Promise<boolean> {
  if (lockHeld || !locksWork) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    navigator.locks
      .request(TEST_KEY, { ifAvailable: true }, (lock) => {
        if (!lock) return void resolve(false);
        lockHeld = true;
        resolve(true);
        // Never settles: the lock is this tab's until it closes.
        return new Promise<never>(() => {});
      })
      .catch(() => {
        // No usable locks after all: the fallback in persistTest guards instead.
        locksWork = false;
        resolve(true);
      });
  });
}
/** This tab only watches the world (persistence §4): no saves, no orders, and the player told so. */
export function startWatching(): void {
  if (S.testWatching) return;
  S.testWatching = true;
  toast(PENDING.testWatching, true);
  bumpData();
}
let persistedAt = 0;
let persistedT = -1;
let persistedActs = -1;
/** What this tab last wrote or restored, for the fallback without locks; null for a new world not yet saved. */
let keyWas: { t: number; n: number } | null = null;

/** Writes the test world's log when it has changed, at most every few seconds unless forced. */
export function persistTest(force = false): void {
  if (!TEST_BUILD || !S.test?.player || S.testWatching || S.test.broken) return;
  const log = S.test.log;
  if (log.t === persistedT && log.acts.length === persistedActs) return;
  if (!force && performance.now() - persistedAt < 5000) return;
  // Without Web Locks (§4's fallback): the key should still hold what this tab last wrote or restored. Anything else is
  // another tab's write: this one stops saving and says so, rather than overwrite that tab's world.
  if (!locksWork && keyWas) {
    const other = ((): { t?: unknown; acts?: unknown } | null => {
      try {
        return JSON.parse(localStorage.getItem(TEST_KEY) ?? "null") as { t?: unknown; acts?: unknown } | null;
      } catch {
        return null; // unreadable: treated as changed
      }
    })();
    if (!other || other.t !== keyWas.t || !Array.isArray(other.acts) || other.acts.length !== keyWas.n) return startWatching();
  }
  try {
    localStorage.setItem(TEST_KEY, JSON.stringify(log));
    keyWas = { t: log.t, n: log.acts.length };
  } catch {
    /* storage blocked or full: the world still runs, it just won't be here next visit */
  }
  persistedAt = performance.now();
  persistedT = log.t;
  persistedActs = log.acts.length;
}
/**
 * After a restore, with the log it read: saved as it stands. With none, a new world: its first save (the hub choice)
 * replaces the key whole.
 */
export function markPersisted(t: TestGame, saved?: TestLog): void {
  persistedT = saved ? t.log.t : -1;
  persistedActs = saved ? t.log.acts.length : -1;
  keyWas = saved ? { t: saved.t, n: saved.acts.length } : null;
}
/** The stored test world, or "stale" when it was played under rules this build no longer runs. */
export function readTest(): TestLog | "stale" | null {
  try {
    const raw = localStorage.getItem(TEST_KEY);
    const log = raw ? (JSON.parse(raw) as TestLog) : null;
    if (!log || log.v !== 1 || !Number.isInteger(log.seed) || !Array.isArray(log.acts)) return null;
    return log.ruleset === RULESET ? log : "stale";
  } catch {
    return null;
  }
}

// --- Orders --------------------------------------------------------------------------

/** What a pending live order is, in a few words. */
export function describe(a: LiveAction): string {
  const w = S.game!.w;
  const hub = (i: number) => w.net.hubs[i]?.id ?? "?";
  switch (a.type) {
    case "join":
      return `Registering ${a.name}`;
    case "place_bid": {
      const l = w.loads.get(a.loadId);
      return `Counter ${a.rate.toFixed(2)}/mi on ${l ? `${hub(l.origin)}→${hub(l.dest)}` : "a load"} (truck ${truckNo(a.truckId)})`;
    }
    case "cancel_bid":
      return `Withdraw truck ${truckNo(a.truckId)}'s bid`;
    case "reposition_truck":
      return `Send truck ${truckNo(a.truckId)} empty to ${a.hubId}`;
    case "buy_asset":
      return a.tractorOnly ? `Order a ${TIER_NAME[a.tier]} tractor` : `Order a ${TIER_NAME[a.tier]} + ${TRAILER_NAME[a.trailer]}`;
    case "buy_trailer":
      return `Order a ${TRAILER_NAME[a.trailer].toLowerCase()} trailer`;
    case "swap_trailer":
      return `Swap truck ${truckNo(a.truckId)}'s trailer at the yard`;
    case "rent_trailer":
      return `Rent a ${TRAILER_NAME[a.trailer].toLowerCase()} for truck ${truckNo(a.truckId)}`;
    case "refurbish_trailer":
      return "Refurbish a trailer";
    case "scrap_truck":
      return `Scrap truck ${truckNo(a.truckId)}`;
    case "scrap_trailer":
      return "Scrap a trailer";
    case "list_trailer":
      return "List a trailer for sale";
    case "trade_in":
      return `Trade in truck ${truckNo(a.truckId)}`;
    case "offer_lease":
      return `Offer truck ${truckNo(a.truckId)} for lease at ${fd(a.weeklyFd)} FD a week`;
    case "withdraw_lease_offer":
      return "Take a lease offer down";
    case "take_lease":
      return "Lease a tractor from another carrier";
    case "list_asset_sale":
      return `Put your ${a.kind} up for sale at ${fd(a.askFd)} FD`;
    case "withdraw_asset_sale":
      return "Take a sale down";
    case "buy_asset_sale":
      return "Buy from another player";
    case "buy_listing":
      return "Buy a used truck";
    case "set_standing_orders":
      return "Update the dispatcher";
    case "rebuild_truck":
      return `Rebuild truck ${truckNo(a.truckId)}`;
    case "park_truck":
      return `Park truck ${truckNo(a.truckId)}`;
    case "unpark_truck":
      return `Put truck ${truckNo(a.truckId)} back on the road`;
    case "list_truck":
      return `List truck ${truckNo(a.truckId)} for sale`;
    case "lease_truck":
      return `Lease a ${TRAILER_NAME[a.trailer].toLowerCase()}`;
    case "return_lease":
      return `Return truck ${truckNo(a.truckId)}'s lease`;
    case "buy_facility":
      return `Open a ${FAC_NAME[a.facility].toLowerCase()} at ${a.hubId}`;
    case "borrow":
      return `Borrow against truck ${truckNo(a.truckId)}`;
    case "repay_loan":
      return "Repay a loan";
    case "buy_fd":
      return `Buy FD with ${usd(a.usd)}`;
    case "bid_auction":
      return `Bid ${usd(a.usd)} in the opening auction`;
    case "cancel_withdrawal":
      return "Take back the withdrawals waiting at the bridge";
    case "sell_fd":
      return `Sell ${fd(a.fd)} FD`;
    case "claim_airdrop_now":
      return "Claim the airdrop at half";
    case "offer_staff":
      return `Offer ${w.staff[a.staffId - 1]?.name ?? "someone"} a job`;
    case "release_staff":
      return `Let ${w.staff[a.staffId - 1]?.name ?? "someone"} go`;
    case "set_staff_pay":
      return `Change ${w.staff[a.staffId - 1]?.name ?? "someone"}'s pay`;
    case "assign_driver":
      return `Seat ${w.staff[a.staffId - 1]?.name ?? "a driver"}${a.truckId ? ` on truck ${truckNo(a.truckId)}` : ""}`;
    case "set_auto_staff":
      return a.on ? "Turn auto-staff on" : "Turn auto-staff off";
    case "set_compliance":
      return "Change the company's safety policy";
    case "fix_defects":
      return `Fix truck ${truckNo(a.truckId)}'s defects`;
    case "set_vetting":
      return `Require ${VETTING_NAMES[a.tier].toLowerCase()} vetting on your freight`;
    case "refile_authority":
      return "File for new authority";
    case "book_load":
      return `Book load #${a.loadId} now (truck ${truckNo(a.truckId)})`;
    case "send_home":
      return `Send truck ${truckNo(a.truckId)} home`;
    case "accept_contract":
      return `Take contract offer #${a.contractId}`;
    case "decline_contract":
      return `Decline contract offer #${a.contractId}`;
    case "accept_tender":
      return `Take contract tender #${a.loadId} (truck ${truckNo(a.truckId)})`;
    case "decline_tender":
      return `Leave tender #${a.loadId} for the board`;
    case "steal_load":
      return `Steal truck ${truckNo(a.truckId)}'s load`;
    case "stake_fd":
      return `Stake ${fd(a.fd)} FD`;
    case "unstake_fd":
      return a.instant ? `Unstake ${fd(a.fd)} FD now` : `Unstake ${fd(a.fd)} FD`;
    case "set_pay_terms":
      return a.terms === "net" ? "Get paid net 30" : a.terms === "quick" ? "Take quick pay" : "Sign a factoring contract";
    case "buy_item":
      return `Buy ${a.item}${a.truckId ? ` for truck ${truckNo(a.truckId)}` : ""}${a.pay === "usd" ? " with dollars" : ""}`;
    case "buy_business":
      return a.kind === "truckStop" ? "Build a truck stop" : `Open a ${a.kind === "shop" ? "shop" : a.kind === "dealership" ? "dealership" : "fuel station"} at ${a.hubId}`;
    case "set_shop_markup":
      return `Price work at ${a.markup.toFixed(2)}× list`;
    case "set_parking_price":
      return `Charge ${fd(a.fd)} a night for parking`;
    case "add_parking":
      return "Add parking spaces";
    default:
      return a.type.replace(/_/g, " ");
  }
}

/**
 * Gives an order. In a test world it happens at once; in the live world it's sent
 * to everyone and takes effect half a minute later, at the same moment on every page.
 */
/** Iuliia's line for an order that went through (iuliia.ts sets it; a hook, so state.ts needn't import her). */
let saidHook: (key: string) => void = () => {};
export function setSaidHook(f: (key: string) => void): void {
  saidHook = f;
}

/** Gives an order with a toast; `said` is Iuliia's line for it, spoken only when it goes through (never on a refusal). */
/**
 * Who an order acts for when the caller didn't say (client batch 8a item 29): an order about one of the carrier's trucks
 * is the carrier's, whichever company is in view; anything else, the company in view.
 */
function actsFor(a: Action, as: "brokerage" | "carrier" | undefined): "brokerage" | "carrier" | undefined {
  if (as !== undefined) return as;
  const g = S.game;
  const id = (a as { truckId?: unknown }).truckId;
  if (!g?.carrier || typeof id !== "number") return undefined;
  return g.w.trucks[id - 1]?.companyId === g.carrier.id ? "carrier" : undefined;
}

export function act(a: Action, ok: string, said?: string, as0?: "brokerage" | "carrier"): void {
  const g = S.game!;
  const as = actsFor(a, as0);
  S.lastAct = { tab: S.tab, at: performance.now() };
  if (g.kind === "test") {
    if (S.testWatching || g.broken) return void toast(S.testWatching ? PENDING.testWatching : PENDING.testBroken, true);
    const r = g.act(a, as);
    persistTest(true);
    if (r.ok) {
      toast(ok);
      if (said) saidHook(said);
    } else toast(r.reason.charAt(0).toUpperCase() + r.reason.slice(1), true);
    bumpData();
    return;
  }
  if (!g.writer) {
    toast(PENDING.liveWatching, true);
    return;
  }
  g.submit(a, as).then(
    (r) => {
      S.okText.set(r.s, ok);
      toast(`Sent: ${describe(a)}. In effect at ${hhmm(r.at)} (${realUntil(g.msUntil(r.at))}).`);
      if (said) saidHook(said);
      bumpData();
    },
    (e: unknown) => toast(`Couldn't send that order: ${(e as { message?: string })?.message ?? "the store refused it"}`, true),
  );
}

/** An order's outcome for a screen that shows it in place (S3: "Refused → the reason in red under it; no toast"). */
export type OrderResult = { ok: true; at: number | null } | { ok: false; reason: string };

/**
 * Gives an order and answers in place: in a test world, at once; live, once it's in the store (it takes effect at
 * `at`, and its own result arrives later through onOwnResult). No toast: the screen that asked says what happened.
 */
/** An order for the company in view, or for `as` (the brokerage's first orders, sent as it's formed). */
export async function order(a: Action, ok: string, as0?: "brokerage" | "carrier"): Promise<OrderResult> {
  const g = S.game!;
  const as = actsFor(a, as0);
  S.lastAct = { tab: S.tab, at: performance.now() };
  const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (g.kind === "test") {
    if (S.testWatching || g.broken) return { ok: false, reason: S.testWatching ? PENDING.testWatching : PENDING.testBroken };
    const r = g.act(a, as);
    persistTest(true);
    bumpData();
    return r.ok ? { ok: true, at: null } : { ok: false, reason: sentence(r.reason) };
  }
  if (!g.writer) return { ok: false, reason: PENDING.liveWatching };
  try {
    const r = await g.submit(a, as);
    S.okText.set(r.s, ok);
    bumpData();
    return { ok: true, at: r.at };
  } catch (e) {
    return { ok: false, reason: `Couldn't send that order: ${(e as { message?: string })?.message ?? "the store refused it"}` };
  }
}

// Full screen, where the browser lets the page ask for it (Safari still uses the webkit names).
export const fsEnabled = (): boolean => Boolean(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled);
export const fsActive = (): boolean => Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
export function toggleFullscreen(): void {
  const d = document as any;
  const el = document.documentElement as any;
  const p = fsActive() ? (document.exitFullscreen?.() ?? d.webkitExitFullscreen?.()) : (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
  Promise.resolve(p).catch(() => toast("The browser didn't allow full screen here. Use its own full-screen view instead.", true));
}

// --- Theme ---------------------------------------------------------------------------

/** One theme for now (Jeff, 2026-11-02: the picker goes); a theme stored by the old picker is ignored. */
export function loadTheme(): void {
  S.theme = "cyber-ops";
  document.documentElement.setAttribute("data-theme", S.theme);
}
