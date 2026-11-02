import type { Equipment } from "@lanes/config";
import { useLayoutEffect, useState } from "preact/hooks";
import { type Action, type Company, type Truck } from "@lanes/engine";
import { RULESET, TestGame, type TestLog } from "./game.js";
import type { DbLike, LiveWorld } from "./live.js";
import { fd, hhmm, realUntil, TIER_NAME, TRAILER_NAME, FAC_NAME, usd } from "./format.js";
import type { LiveAction } from "./live.js";
import { VETTING_NAMES } from "@lanes/engine";
import type { Tab } from "./tabs.js";
import { freshOnboard, ONBOARD_KEY, parseOnboard, type Onboard } from "./onboard.js";
import type { PayLine } from "./rolling.js";

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
/** The first entry, before a company (specs/first-ten-minutes.md, S1): where the hub-choosing sheet stands. */
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
  entry: { stage: "welcome" as EntryStage, hub: null as number | null },
  selTruck: null as number | null,
  selHub: null as number | null,
  /** The hub whose city pane is open over the map (opened by clicking the city or a town of its market), if any. */
  cityView: null as number | null,
  /** The town (an index into net.places) the pane was opened from, if it was a town. */
  townView: null as number | null,
  /** Load board: the load whose sheet is open (S3), or the expanded table row. */
  openLoad: null as number | null,
  /** Bids placed by hand from the board, by load: their rate and break-even, so the round's result can say how they did (S5). */
  handBids: new Map<number, { rate: number; be: number }>(),
  /** The last delivery, shown on the Truck tab until OK (S7); Money keeps a dot until it's opened. */
  delivered: null as null | { origin: number; dest: number; lateH: number; line: PayLine; dueDay: number | null; hiredDriver: string | null },
  moneyDot: false,
  /** The lane each invoice was for, by receivable id, as this page saw the deliveries (Money's "Load" column). */
  invoiceLanes: new Map<number, string>(),
  /** The map follows your moving truck until you pan it (S6); "Follow" turns it back on. */
  following: true,
  /** The last round's result for a hand bid, shown on the board until OK or the next bid (S5); `seen` clears the Loads dot. */
  result: null as null | { won: boolean; origin: number; dest: number; rate: number; winning: number | null; be: number; total: number; seen: boolean },
  /** The truck-stop site selected on the map (an id into w.sites), shown on the Business tab. */
  selSite: null as number | null,
  /** The market view's trailer type. */
  ratesEq: "van" as Equipment,
  guidePage: "start",
  /** The test build: the world saved in this browser, for the title's Continue button (name and the day it reached). */
  savedTest: null as { name: string; day: number } | null,
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
export function loadOnboard(): void {
  try {
    S.onboard = parseOnboard(localStorage.getItem(ONBOARD_KEY));
  } catch {
    S.onboard = freshOnboard();
  }
}

export function setTab(tab: Tab): void {
  S.tab = tab;
  if (tab === "money") S.moneyDot = false;
  // The first visit clears an opened teaser's "New" under More.
  if (S.game?.player && !S.onboard.visited.includes(tab)) setOnboard({ visited: [...S.onboard.visited, tab] });
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
let persistedAt = 0;
let persistedT = -1;
let persistedActs = -1;

/** Writes the test world's log when it has changed, at most every few seconds unless forced. */
export function persistTest(force = false): void {
  if (!TEST_BUILD || !S.test?.player) return;
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
    case "stake_fd":
      return `Stake ${fd(a.fd)} FD`;
    case "unstake_fd":
      return a.instant ? `Unstake ${fd(a.fd)} FD now` : `Unstake ${fd(a.fd)} FD`;
    case "deposit_pool":
      return `Deposit ${fd(a.amountFd)} FD in the ${a.line} pool`;
    case "withdraw_pool":
      return `Withdraw ${fd(a.amountFd)} FD from the ${a.line} pool`;
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

/** An order's outcome for a screen that shows it in place (S3: "Refused → the reason in red under it; no toast"). */
export type OrderResult = { ok: true; at: number | null } | { ok: false; reason: string };

/**
 * Gives an order and answers in place: in a test world, at once; live, once it's in the store (it takes effect at
 * `at`, and its own result arrives later through onOwnResult). No toast: the screen that asked says what happened.
 */
export async function order(a: Action, ok: string): Promise<OrderResult> {
  const g = S.game!;
  const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (g.kind === "test") {
    const r = g.act(a);
    persistTest(true);
    bumpData();
    return r.ok ? { ok: true, at: null } : { ok: false, reason: sentence(r.reason) };
  }
  if (!g.writer) return { ok: false, reason: "This tab is only watching." };
  try {
    const r = await g.submit(a);
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
