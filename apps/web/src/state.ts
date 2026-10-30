import { useLayoutEffect, useState } from "preact/hooks";
import { type Action, type Company, type Truck } from "@lanes/engine";
import { RULESET, TestGame, type TestLog } from "./game.js";
import type { DbLike, LiveWorld } from "./live.js";
import { fd, hhmm, realUntil, TIER_NAME, TRAILER_NAME, FAC_NAME, usd } from "./format.js";
import type { LiveAction } from "./live.js";
import { VETTING_NAMES } from "@lanes/engine";

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
export type Tab = "fleet" | "loads" | "staff" | "market" | "money" | "company" | "guide";
export type Layout = "split" | "panel" | "map";
export type Platform = { db: DbLike | null; uid: string | null; owner: boolean; local: boolean };
export type TitleMenu =
  | { kind: "connecting" }
  | { kind: "signin" }
  | { kind: "unreachable" }
  | { kind: "notopen" }
  | { kind: "openworld" }
  | { kind: "update"; theirs: string }
  | { kind: "join" }
  | { kind: "test" };
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
  selTruck: null as number | null,
  selHub: null as number | null,
  /** The hub whose city pane is open over the map (opened by clicking the city or a town of its market), if any. */
  cityView: null as number | null,
  /** The town (an index into net.places) the pane was opened from, if it was a town. */
  townView: null as number | null,
  /** Load board: the expanded row. */
  openLoad: null as number | null,
  guidePage: "start",
  /** Test-world speeds only: the live clock can't be changed. */
  speed: 1,
  toast: null as { text: string; err: boolean; at: number } | null,
  theme: "cyber-ops",
  /** Success messages for this player's live orders, shown when each takes effect. */
  okText: new Map<number, string>(),
};

export const SPEEDS: { label: string; title: string; hoursPerSec: number; icon: string }[] = [
  { label: "❚❚", title: "Pause", hoursPerSec: 0, icon: "pause" },
  { label: "▶", title: "One game day a minute", hoursPerSec: 24 / 60, icon: "play" },
  { label: "▶▶", title: "One game day every 10 seconds", hoursPerSec: 2.4, icon: "ff" },
  { label: "▶▶▶", title: "One game day every 2 seconds", hoursPerSec: 12, icon: "fff" },
];

// --- Change channels ---------------------------------------------------------------

type Channel = { v: number; subs: Set<() => void> };
const tick: Channel = { v: 0, subs: new Set() };
const data: Channel = { v: 0, subs: new Set() };
function emit(ch: Channel): void {
  ch.v++;
  for (const s of ch.subs) s();
}
/** The clock moved: cheap components that show the time re-render. */
export const bumpTick = (): void => emit(tick);
/** Something the panels show changed. */
export const bumpData = (): void => emit(data);
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
  ticker: { text: string; cls: string }[];
  history: { day: number; cash: number }[];
  band: string;
  lastT: number;
}
const feeds = new Map<Session, Feed>();
export function feed(s: Session | null = S.game): Feed {
  if (!s) return { ticker: [], history: [], band: "", lastT: 0 };
  let f = feeds.get(s);
  if (!f) feeds.set(s, (f = { ticker: [], history: [], band: "", lastT: s.w.t }));
  return f;
}
export function push(s: Session, text: string, cls = ""): void {
  const f = feed(s);
  f.ticker.unshift({ text, cls });
  if (f.ticker.length > 30) f.ticker.pop();
  if (s === S.game) bumpData();
}

// --- Reading the world -------------------------------------------------------------------

/** The player's company on screen; panels only call this once they've checked there is one. */
export const me = (): Company => S.game!.player!;
/** Game time on screen: the live world shows the clock's minute, a test world its own hour. */
export const clockMin = (s: Session | null = S.game): number => (!s ? 0 : s.kind === "live" ? Math.max(s.w.t, s.gameMinute()) : s.w.t);
export function myTrucks(): Truck[] {
  const g = S.game;
  return g?.player ? g.w.trucksByCompany.get(g.player.id)!.filter((t) => t.status !== "retired") : [];
}
export function truckNo(id: number): number {
  return myTrucks().findIndex((t) => t.id === id) + 1 || 0;
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

export function setTab(tab: Tab): void {
  S.tab = tab;
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
let persistedAt = 0;
let persistedT = -1;
let persistedActs = -1;

/** Writes the test world's log when it has changed, at most every few seconds unless forced. */
export function persistTest(force = false): void {
  if (!TEST_BUILD || !S.test) return;
  const log = S.test.log;
  if (log.t === persistedT && log.acts.length === persistedActs) return;
  if (!force && performance.now() - persistedAt < 5000) return;
  try {
    localStorage.setItem(TEST_KEY, JSON.stringify(log));
  } catch {
    /* storage blocked or full: the world still runs, it just won't be here next visit */
  }
  persistedAt = performance.now();
  persistedT = log.t;
  persistedActs = log.acts.length;
}
export function markPersisted(t: TestGame): void {
  persistedT = t.log.t;
  persistedActs = t.log.acts.length;
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
      return `Order a ${TIER_NAME[a.tier]} + ${TRAILER_NAME[a.trailer]}`;
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
    case "deposit_finance":
      return `Deposit ${fd(a.amountFd)} FD`;
    case "withdraw_finance":
      return `Withdraw ${fd(a.amountFd)} FD`;
    case "borrow":
      return `Borrow against truck ${truckNo(a.truckId)}`;
    case "repay_loan":
      return "Repay a loan";
    case "buy_fd":
      return `Buy FD with ${usd(a.usd)}`;
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
    case "rebroker_load":
      return `Re-post load #${a.loadId} at ${a.rate.toFixed(2)}/mi`;
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
    default:
      return a.type.replace(/_/g, " ");
  }
}

/**
 * Gives an order. In a test world it happens at once; in the live world it's sent
 * to everyone and takes effect half a minute later, at the same moment on every page.
 */
export function act(a: Action, ok: string): void {
  const g = S.game!;
  if (g.kind === "test") {
    const r = g.act(a);
    persistTest(true);
    if (r.ok) toast(ok);
    else toast(r.reason.charAt(0).toUpperCase() + r.reason.slice(1), true);
    bumpData();
    return;
  }
  if (!g.writer) {
    toast("This tab is only watching.", true);
    return;
  }
  g.submit(a).then(
    (r) => {
      S.okText.set(r.s, ok);
      toast(`Sent: ${describe(a)}. In effect at ${hhmm(r.at)} (${realUntil(g.msUntil(r.at))}).`);
      bumpData();
    },
    (e: unknown) => toast(`Couldn't send that order: ${(e as { message?: string })?.message ?? "the store refused it"}`, true),
  );
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

// --- Themes (Trucking Terminal's) -----------------------------------------------------

export const THEMES: { id: string; name: string; group: "dark" | "light" | "mixed" }[] = [
  { id: "cyber-ops", name: "Cyber Ops", group: "dark" },
  { id: "midnight-navy", name: "Midnight Navy", group: "dark" },
  { id: "carbon-fiber", name: "Carbon Fiber", group: "dark" },
  { id: "emerald-freight", name: "Emerald Freight", group: "dark" },
  { id: "titanium", name: "Titanium", group: "dark" },
  { id: "neon-night", name: "Neon Night", group: "dark" },
  { id: "gold-standard", name: "Gold Standard", group: "dark" },
  { id: "matrix-green", name: "Matrix Green", group: "dark" },
  { id: "stealth-mode", name: "Stealth Mode", group: "dark" },
  { id: "deep-ocean", name: "Deep Ocean", group: "dark" },
  { id: "crimson-command", name: "Crimson Command", group: "dark" },
  { id: "slate-pro", name: "Slate Pro", group: "dark" },
  { id: "obsidian", name: "Obsidian", group: "dark" },
  { id: "aurora", name: "Aurora", group: "dark" },
  { id: "arctic-clean", name: "Arctic Clean", group: "light" },
  { id: "ice-chrome", name: "Ice Chrome", group: "light" },
  { id: "cloud-white", name: "Cloud White", group: "light" },
  { id: "paper", name: "Paper", group: "light" },
  { id: "daylight", name: "Daylight", group: "light" },
  { id: "ivory-rose", name: "Ivory Rose", group: "light" },
  { id: "mint-fresh", name: "Mint Fresh", group: "light" },
  { id: "silver-lining", name: "Silver Lining", group: "light" },
  { id: "sunset-dispatch", name: "Sunset Dispatch", group: "mixed" },
  { id: "desert-sand", name: "Desert Sand", group: "mixed" },
  { id: "polar-night", name: "Polar Night", group: "mixed" },
  { id: "storm-front", name: "Storm Front", group: "mixed" },
  { id: "midnight-sun", name: "Midnight Sun", group: "mixed" },
  { id: "ocean-breeze", name: "Ocean Breeze", group: "mixed" },
  { id: "amber-terminal", name: "Amber Terminal", group: "mixed" },
  { id: "blue-dispatch", name: "Blue Dispatch", group: "mixed" },
  { id: "red-command", name: "Red Command", group: "mixed" },
  { id: "sunset-hauler", name: "Sunset Hauler", group: "mixed" },
  { id: "steel-runner", name: "Steel Runner", group: "mixed" },
  { id: "fleet-classic", name: "Fleet Classic", group: "mixed" },
];
export function setTheme(id: string): void {
  S.theme = id;
  document.documentElement.setAttribute("data-theme", id);
  try {
    localStorage.setItem("lanes.theme", id);
  } catch {
    /* fine */
  }
  bumpData();
}
export function loadTheme(): void {
  let id = "cyber-ops";
  try {
    id = localStorage.getItem("lanes.theme") ?? id;
  } catch {
    /* fine */
  }
  if (!THEMES.some((t) => t.id === id)) id = "cyber-ops";
  S.theme = id;
  document.documentElement.setAttribute("data-theme", id);
}
