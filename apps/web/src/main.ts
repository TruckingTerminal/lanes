import type { Equipment, FacilityType, TractorTier } from "@lanes/config";
import {
  askingPay,
  availableSupply,
  averagePriceUsd,
  canMakeHot,
  canRefile,
  crewed,
  dealerPrice,
  garagingOf,
  homeCrowding,
  homeEdge,
  lossRatio,
  yardPerTruck,
  truckValue,
  dispatchProfile,
  marketPay,
  PERMANENT_BAR,
  poolOf,
  ratingLabel,
  spanOf,
  stars,
  VETTING_NAMES,
  vettingBlock,
  borrowingCapacity,
  breakEvenPerMile,
  companyAccount,
  condition,
  deliveryDays,
  depositorValue,
  expectedReloadDeadheadMi,
  reloadOdds,
  facilityOutlook,
  fdPriceUsd,
  fuelPrice,
  hubMiles,
  hubRoute,
  hubToll,
  lessorTrucksOf,
  MANUAL_BID_MAX_DEADHEAD_MI,
  marketValue,
  newPrice,
  openListings,
  operatingTrucks,
  ordersOf,
  poolCash,
  rebuildCost,
  sellableFd,
  seasonality,
  tokenLive,
  type Action,
  type Company,
  type GameEvent,
  type Load,
  type Basic,
  type CompliancePolicy,
  type Staff,
  type StandingOrder,
  type Truck,
  type VettingTier,
  type World,
} from "@lanes/engine";
import { hubs as HUBS } from "@lanes/data";
import { drawTitleScene, facilityUrl, iconUrl, PAL, truckUrl } from "./art.js";
import { guidePages } from "./guide.js";
import { DEFAULT_ORDERS, GAME_CONFIG, isHuman, RULESET, TestGame, type StartKind, type TestLog } from "./game.js";
import { createMeta, LiveWorld, readMeta, type DbLike, type LiveAction, type WorldMeta } from "./live.js";
import { buildMap, MAP_H, MAP_W, nightShade, project, type MapArt } from "./map.js";
import { MemoryDb } from "./memdb.js";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fd = (x: number) => {
  const a = Math.abs(x);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `${(a / 1e3).toFixed(1)}k` : Math.round(a).toLocaleString("en-US");
  return `${x < 0 ? "−" : ""}${s}`;
};
const usd = (x: number) => `$${x < 10 ? x.toFixed(2) : Math.round(x).toLocaleString("en-US")}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const img = (src: string, alt: string, cls = "px") => `<img class="${cls}" src="${src}" alt="${esc(alt)}">`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIER_NAME: Record<TractorTier, string> = { workhorse: "Workhorse", highwayPro: "Highway Pro", flagship: "Flagship" };
const TRAILER_NAME: Record<Equipment, string> = { van: "Dry van", reefer: "Reefer", flatbed: "Flatbed" };
const FAC_NAME: Record<FacilityType, string> = { warehouse: "Warehouse", coldStorage: "Cold storage", factory: "Factory" };

function dateLabel(day: number): string {
  const doy = day % 365;
  const m = Math.min(11, Math.floor(doy / 30));
  return `${DAYS[day % 7]} ${MONTHS[m]} ${doy - m * 30 + 1}, Year ${Math.floor(day / 365) + 1}`;
}
const hhmm = (gameMin: number) => `${String(Math.floor(gameMin / 60) % 24).padStart(2, "0")}:${String(Math.floor(gameMin) % 60).padStart(2, "0")}`;
/** Real time until a game minute, for the live world: "45s", "12m", "2h 05m". */
function realUntil(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

let toastTimer = 0;
function toast(msg: string, err = false): void {
  const t = $("toast");
  t.textContent = msg;
  t.className = err ? "toast err" : "toast";
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 4200);
}

/**
 * The test build (the GitHub Pages site) has no shared store: it opens straight into
 * a private test world with pause and speed controls, kept in this browser.
 */
declare const __LANES_TEST__: boolean | undefined;
const TEST_BUILD = typeof __LANES_TEST__ !== "undefined" && __LANES_TEST__;

// ---------------------------------------------------------------------------
// Platform: the artifact's shared store and who is viewing. Opened outside
// claude.ai (a local run), the page keeps a store in this browser instead, and
// each tab plays as its own company.
// ---------------------------------------------------------------------------

type Platform = { db: DbLike | null; uid: string | null; owner: boolean; local: boolean };
let platform: Platform = { db: null, uid: null, owner: false, local: false };

async function connect(): Promise<Platform> {
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

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type Session = LiveWorld | TestGame;
/** The live world keeps running whatever is on screen; the test world exists only while the owner uses it. */
let live: LiveWorld | null = null;
let test: TestGame | null = null;
let game: Session | null = null;
let art: MapArt | null = null;
type Tab = "fleet" | "loads" | "staff" | "market" | "money" | "company" | "guide";
let tab: Tab = "fleet";
let selTruck: number | null = null;
let selHub: number | null = null;
/** Test-world speeds only: the live clock can't be changed. */
let speed = 1;
const SPEEDS: { label: string; title: string; hoursPerSec: number }[] = [
  { label: "❚❚", title: "Pause", hoursPerSec: 0 },
  { label: "▶", title: "One game day a minute", hoursPerSec: 24 / 60 },
  { label: "▶▶", title: "One game day every 10 seconds", hoursPerSec: 2.4 },
  { label: "▶▶▶", title: "One game day every 2 seconds", hoursPerSec: 12 },
];
let acc = 0;
let panelDirty = true;
let lastPanelAt = 0;
let rebuilding = false;
/** Success messages for this player's live orders, shown when each takes effect. */
const okText = new Map<number, string>();

interface Feed {
  ticker: { text: string; cls: string }[];
  history: { day: number; cash: number }[];
  band: string;
  lastT: number;
}
const feeds = new Map<Session, Feed>();
function feed(s: Session = game!): Feed {
  let f = feeds.get(s);
  if (!f) feeds.set(s, (f = { ticker: [], history: [], band: "", lastT: s.w.t }));
  return f;
}
function push(s: Session, text: string, cls = ""): void {
  const f = feed(s);
  f.ticker.unshift({ text, cls });
  if (f.ticker.length > 30) f.ticker.pop();
}

/** The player's company on screen; panels only call this once they've checked there is one. */
const me = (): Company => game!.player!;
/** Game time on screen: the live world shows the clock's minute, a test world its own hour. */
const clockMin = (s: Session = game!) => (s.kind === "live" ? Math.max(s.w.t, s.gameMinute()) : s.w.t);

function onEvent(s: Session, e: GameEvent): void {
  const w = s.w;
  const hubName = (i: number) => w.net.hubs[i]!.id;
  if (e.kind === "launched") {
    push(s, "FD is live on the exchange. Your airdrop's first quarter has landed.", "warn");
    if (s === game) toast("Launch day: FD can now be bought and sold.");
  }
  if (!s.player || !("companyId" in e) || e.companyId !== s.player.id) return;
  if (s === game) panelDirty = true;
  if (e.kind === "won") push(s, `Won ${hubName(e.origin)}→${hubName(e.dest)}, ${e.miles} mi at ${e.rate.toFixed(2)}/mi${e.manual ? " (your bid)" : ""}`, "good");
  if (e.kind === "delivered") push(s, `Delivered ${hubName(e.origin)}→${hubName(e.dest)}: +${fd(e.grossFd)} FD, ${fd(e.grossFd - e.costFd)} after costs${e.onTime ? "" : " (late)"}`);
  if (e.kind === "lostBid")
    push(
      s,
      `Lost ${hubName(e.origin)}→${hubName(e.dest)} at ${e.rate.toFixed(2)}/mi${e.winningRate !== null ? `: it went for ${e.winningRate.toFixed(2)}/mi` : ": nobody took it this round"}`,
      "warn",
    );
  if (e.kind === "breakdown") push(s, `Breakdown on truck ${truckNo(e.truckId)}${e.repairFd ? `: ${fd(e.repairFd)} FD repair bill` : " (lessor pays)"}`, "bad");
  if (e.kind === "truckDelivered") push(s, `New truck delivered: truck ${truckNo(e.truckId)} is ready`, "good");
  if (e.kind === "liquidated") push(s, "Your company went into liquidation: trucks are being sold and you'll restart on an NPC lease.", "bad");
  if (e.kind === "notice") {
    // The engine names trucks by their world id; the player knows theirs by fleet number.
    const text = s === game ? e.text.replace(/\bTruck (\d+)\b/g, (m, id: string) => (truckNo(Number(id)) ? `Truck ${truckNo(Number(id))}` : m)) : e.text;
    push(s, text, e.tone === "good" ? "good" : e.tone === "bad" ? "bad" : "");
    if (s === game && (e.topic === "crash" || e.topic === "authority")) toast(text, e.tone === "bad");
  }
}

function myTrucks(): Truck[] {
  return game?.player ? game.w.trucksByCompany.get(game.player.id)!.filter((t) => t.status !== "retired") : [];
}
function truckNo(id: number): number {
  return myTrucks().findIndex((t) => t.id === id) + 1 || 0;
}

/** What a pending live order is, in a few words. */
function describe(a: LiveAction): string {
  const w = game!.w;
  const hub = (i: number) => w.net.hubs[i]?.id ?? "?";
  switch (a.type) {
    case "join":
      return `Registering ${a.name}`;
    case "place_bid": {
      const l = w.loads.get(a.loadId);
      return `Bid ${a.rate.toFixed(2)}/mi on ${l ? `${hub(l.origin)}→${hub(l.dest)}` : "a load"} (truck ${truckNo(a.truckId)})`;
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
    case "steal_load":
      return `Steal truck ${truckNo(a.truckId)}'s load`;
    default:
      return a.type.replace(/_/g, " ");
  }
}

// ---------------------------------------------------------------------------
// Title screen: connecting, joining, and the owner's test world
// ---------------------------------------------------------------------------

let titleRaf = 0;
function showTitle(menuHtml: string): void {
  $("title").hidden = false;
  $("game").hidden = true;
  $("loading").hidden = true;
  const cv = $<HTMLCanvasElement>("titleCanvas");
  const ctx = cv.getContext("2d")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frame = (t: number) => {
    drawTitleScene(ctx, 3, reduced ? 0 : t);
    if (!reduced && !$("title").hidden) titleRaf = requestAnimationFrame(frame);
  };
  cancelAnimationFrame(titleRaf);
  titleRaf = requestAnimationFrame(frame);
  $("menu").innerHTML = menuHtml;
}

const card = (title: string, body: string) => `<div class="panel stack"><h2>${title}</h2>${body}</div>`;
const testButton = () => (platform.owner ? `<button class="btn" data-act="testform">Test world (private, pausable)</button>` : "");
const starterOptions = () =>
  HUBS.filter((h) => h.isStarter)
    .map((h) => `<option value="${h.id}">${esc(h.name)} (${h.id})</option>`)
    .join("");

function joinMenu(): string {
  return `<form class="panel stack" id="joinform">
    <h2>Join the live world</h2>
    <p style="font-size:15px">One world, shared by every player, running on the real clock: one game day every 6 real hours. It never pauses and nothing resets. Every order you give stands.</p>
    <div class="field"><label class="label" for="cname">Company name</label><input type="text" id="cname" maxlength="32" value="Lone Star Freight" required></div>
    <div class="field"><label class="label" for="chub">Home hub</label><select id="chub">${starterOptions()}</select></div>
    ${hubChoiceTable(live?.w ?? null)}
    <div class="choice" style="cursor:default">${img(truckUrl("workhorse", "van", true, PAL.blue, 2), "Leased truck")}<span><b>You start as an owner-operator,</b> like everyone: one NPC-leased Workhorse and dry van, 5,000 FD. The lessor takes 15% of every load. Go broke and you start over on a lease.</span></div>
    <div class="row"><button class="btn primary" type="submit">Start hauling</button>${testButton()}</div>
    <p class="muted" style="font-size:14px">Year 1–2 is the beta: FD is play money and you earn Miles. At the end of Year 2, FD launches on the exchange and Miles turn into an airdrop. This build uses play dollars only.</p>
  </form>`;
}

function testMenu(): string {
  return `<form class="panel stack" id="testform">
    <h2>Test world</h2>
    <p style="font-size:15px">${
      TEST_BUILD
        ? "The full game with only you and the AI in it, plus pause and speed controls for testing. Your world stays in this browser; starting a new one replaces it."
        : "A private copy of the rules with only you and the AI in it. You can pause it and run it fast. It isn't stored and doesn't touch the live world."
    }</p>
    <div class="field"><label class="label" for="tname">Company name</label><input type="text" id="tname" maxlength="32" value="Test Freight"></div>
    <div class="field"><span class="label">How you start</span>
      <label class="choice"><input type="radio" name="start" value="oo" checked><span>${img(truckUrl("workhorse", "van", true, PAL.blue, 2), "Leased truck")}<br><b>Owner-operator.</b> The live world's start.</span></label>
      <label class="choice"><input type="radio" name="start" value="fleet"><span>${img(truckUrl("workhorse", "reefer", false, PAL.amber, 2), "Owned truck")}<br><b>Small fleet.</b> Two used trucks and 25,000 FD, to test the fleet game.</span></label>
    </div>
    <div class="field"><label class="label" for="thub">Home hub</label><select id="thub">${starterOptions()}</select></div>
    ${hubChoiceTable(null)}
    <div class="row"><button class="btn primary" type="submit">${test ? "Start a new test world" : "Open the test world"}</button>${test ? `<button class="btn" type="button" data-act="backtest">Keep playing this one</button>` : ""}${live ? `<button class="btn" type="button" data-act="backlive">Back to the live world</button>` : ""}</div>
  </form>`;
}

function showLoading(title: string, note: string): void {
  $("title").hidden = true;
  $("game").hidden = true;
  $("loading").hidden = false;
  $("loadtitle").textContent = title;
  $("loadnote").textContent = note;
  $("loadbar").style.width = "0%";
}

async function boot(): Promise<void> {
  wireInput();
  if (TEST_BUILD) return bootTest();
  showTitle(card("Connecting", `<p class="muted">Finding the live world…</p>`));
  platform = await connect();
  if (!platform.db) {
    showTitle(card("Sign in to play", `<p>The live world is kept on claude.ai. Sign in there and open this page again to join it.</p>`));
    return;
  }
  let meta: WorldMeta | null = null;
  try {
    meta = await readMeta(platform.db);
  } catch {
    showTitle(card("Couldn't reach the world", `<p>The store didn't answer. Reload in a moment.</p>`));
    return;
  }
  if (!meta) {
    showTitle(
      platform.owner
        ? card(
            "Open the live world",
            `<p>Nobody has opened the world yet. Opening it starts the clock for good: from then on it runs whether or not anyone is playing.</p><div class="row"><button class="btn primary" data-act="openworld">Open the live world</button>${testButton()}</div>`,
          )
        : card("Not open yet", `<p>The live world hasn't opened yet. Check back soon.</p>`),
    );
    return;
  }
  await enterLive(meta);
}

async function enterLive(meta: WorldMeta): Promise<void> {
  if (meta.ruleset !== RULESET) {
    showTitle(card("Update in progress", `<p>The live world runs on rules <span class="num">${esc(meta.ruleset)}</span> and this page has <span class="num">${esc(RULESET)}</span>. It won't replay history under different rules. Reload in a little while.</p>`));
    return;
  }
  showLoading("Catching up with the live world", "Every page replays the world's history from the start, so everyone sees the same world.");
  const lw = await LiveWorld.open(platform.db!, meta, platform.uid);
  live = lw;
  lw.onEvent((e) => onEvent(lw, e));
  lw.onOwnResult = (r, res) => {
    panelDirty = true;
    const ok = okText.get(r.s);
    okText.delete(r.s);
    if (res.ok) toast(ok ?? "Done");
    else toast(`${describe(r.a)} failed: ${res.reason}`, true);
  };
  lw.onJoin = (uid, c) => {
    push(lw, uid === platform.uid ? `${c.name} is on the road out of ${lw.w.net.hubs[c.homeHub]!.id}. Good luck.` : `${c.name} joined the world, hauling out of ${lw.w.net.hubs[c.homeHub]!.id}`, "good");
    if (uid === platform.uid) {
      selTruck = myTrucks()[0]?.id ?? null;
      panelDirty = true;
    }
  };
  await lw.rebuild((share) => {
    $("loadbar").style.width = `${Math.round(share * 100)}%`;
    $("loadnote").textContent = `${dateLabel(Math.floor(lw.w.t / 1440))}, ${hhmm(lw.w.t)}`;
  });
  if (!lw.player && platform.uid && lw.writer) showTitle(joinMenu());
  else showGame(lw);
}

// ---------------------------------------------------------------------------
// Game screen
// ---------------------------------------------------------------------------

function showGame(s: Session): void {
  game = s;
  feed(s).lastT = s.w.t;
  art ??= buildMap(s.w.net.hubs, (a, b) => hubMiles(s.w, a, b), s.w.net.roads);
  cancelAnimationFrame(titleRaf);
  $("title").hidden = true;
  $("loading").hidden = true;
  $("game").hidden = false;
  selTruck = myTrucks()[0]?.id ?? null;
  tab = "fleet";
  panelDirty = true;
  renderTabs();
  fitMap();
  if (!looping) {
    looping = true;
    last = performance.now();
    schedule();
  }
}

async function resync(): Promise<void> {
  if (!live || rebuilding) return;
  rebuilding = true;
  push(live, "An order reached this page late. Replaying the world so it matches everyone else's.", "warn");
  await live.rebuild();
  rebuilding = false;
  panelDirty = true;
}

let looping = false;
let last = 0;
let rafId = 0;
let timerId = 0;
/**
 * Next frame, with a timer behind it: browsers stop animation frames for hidden or
 * covered pages, and the live world has to keep up with the clock regardless.
 */
function schedule(): void {
  if (!document.hidden) rafId = requestAnimationFrame(loop);
  timerId = window.setTimeout(() => loop(performance.now()), document.hidden ? 500 : 250);
}
function loop(now: number): void {
  cancelAnimationFrame(rafId);
  clearTimeout(timerId);
  const dt = Math.min(250, now - last);
  last = now;
  // The live world runs on the real clock, on screen or not.
  if (live && !rebuilding) {
    if (live.needRebuild) void resync();
    else live.advance(game === live ? 8 : 4);
  }
  if (test && game === test) {
    acc += (dt / 1000) * SPEEDS[speed]!.hoursPerSec;
    const budget = now + 10;
    while (acc >= 1 && performance.now() < budget) {
      test.stepHour();
      acc -= 1;
    }
    if (acc > 48) acc = 48; // don't bank more than two days if the machine falls behind
    persistTest();
  }
  if (game) {
    // A rendering slip must never stop the clock: the world keeps running whatever the screen does.
    try {
      observe(game);
      drawMap(now);
      renderHud();
      const refreshEvery = 1000;
      if (panelDirty || now - lastPanelAt > refreshEvery) {
        const focus = document.activeElement;
        const typing = focus && $("panel").contains(focus) && (focus.tagName === "INPUT" || focus.tagName === "SELECT" || focus.tagName === "TEXTAREA");
        if (!typing) {
          renderPanel();
          lastPanelAt = now;
          panelDirty = false;
        }
      }
      renderTicker();
    } catch (e) {
      console.error(e);
    }
    if (live?.broken && !brokenShown) {
      brokenShown = true;
      toast(`The live world stopped at ${hhmm(live.broken.at)}: ${live.broken.reason}. The owner has to repair the log.`, true);
    }
  }
  schedule();
}
let brokenShown = false;

// --- Map view: whole-number fit, zoom levels and pan --------------------------------

/** Whole-number zoom levels keep every map pixel square. */
const ZOOMS = [1, 2, 3, 4, 6];
/** Canvas pixels per map pixel at 1×: the largest whole number that fits the screen. */
let fitScale = 1;
let zoomIdx = 0;
/** Top-left of the view, in canvas pixels of the zoomed map. */
let panX = 0;
let panY = 0;
const zoom = () => ZOOMS[zoomIdx]!;
/** Canvas pixels per map pixel right now. */
const kScale = () => fitScale * zoom();

/** Sizes the canvas to the largest whole-number scale that fits; below 400 px wide it scales down to fit. */
function fitMap(): void {
  const wrap = $("mapwrap");
  const cv = $<HTMLCanvasElement>("map");
  // As big as the width allows, but not taller than the screen below the top bar (room left for the ticker).
  const tall = Math.floor((window.innerHeight - wrap.getBoundingClientRect().top - 48) / MAP_H);
  const s = Math.min(Math.floor(wrap.clientWidth / MAP_W), Math.max(1, tall));
  const next = Math.max(1, s);
  if (next !== fitScale || cv.width !== MAP_W * next) {
    // Keep the same place in the middle of the view when the fit changes.
    const [cx, cy] = toWorld(cv.width / 2, cv.height / 2);
    fitScale = next;
    cv.width = MAP_W * fitScale;
    cv.height = MAP_H * fitScale;
    centerOn(cx, cy);
  }
  cv.style.width = s >= 1 ? `${MAP_W * s}px` : "100%";
  cv.style.height = s >= 1 ? `${MAP_H * s}px` : "auto";
  renderZoomUi();
}

function toScreen(x: number, y: number): [number, number] {
  const k = kScale();
  return [Math.round(x * k - panX), Math.round(y * k - panY)];
}
function toWorld(cx: number, cy: number): [number, number] {
  const k = kScale();
  return [(cx + panX) / k, (cy + panY) / k];
}
function clampPan(): void {
  const extra = kScale() - fitScale;
  panX = Math.round(Math.max(0, Math.min(MAP_W * extra, panX)));
  panY = Math.round(Math.max(0, Math.min(MAP_H * extra, panY)));
}
function centerOn(wx: number, wy: number): void {
  const cv = $<HTMLCanvasElement>("map");
  panX = wx * kScale() - cv.width / 2;
  panY = wy * kScale() - cv.height / 2;
  clampPan();
}
/** Changes the zoom level, keeping the map point under canvas pixel (ax, ay) where it is. */
function setZoom(idx: number, ax?: number, ay?: number): void {
  const cv = $<HTMLCanvasElement>("map");
  const next = Math.max(0, Math.min(ZOOMS.length - 1, idx));
  if (next === zoomIdx) return;
  const x = ax ?? cv.width / 2;
  const y = ay ?? cv.height / 2;
  const [wx, wy] = toWorld(x, y);
  zoomIdx = next;
  panX = wx * kScale() - x;
  panY = wy * kScale() - y;
  clampPan();
  renderZoomUi();
  $("tip").hidden = true;
}
function renderZoomUi(): void {
  $("zoomlevel").textContent = `${zoom()}×`;
  $<HTMLButtonElement>("zoomin").disabled = zoomIdx === ZOOMS.length - 1;
  $<HTMLButtonElement>("zoomout").disabled = zoomIdx === 0;
  $<HTMLButtonElement>("zoomfit").disabled = zoomIdx === 0;
  $("map").style.cursor = zoomIdx > 0 ? "grab" : "crosshair";
}

/** Daily bookkeeping for the screen: the cash sparkline and the freight-cycle headlines. */
function observe(s: Session): void {
  const f = feed(s);
  const w = s.w;
  if (w.t === f.lastT) return;
  const crossed = Math.floor(w.t / 1440) !== Math.floor(f.lastT / 1440);
  f.lastT = w.t;
  panelDirty = true;
  if (!crossed) return;
  const day = Math.floor(w.t / 1440) - 1;
  if (s.player) {
    f.history.push({ day, cash: w.ledger.balance(companyAccount(s.player.id)) });
    if (f.history.length > 120) f.history.shift();
  }
  const cyc = w.feeds.cycle(day);
  const band = cyc > 1.12 ? "boom" : cyc < 0.88 ? "slump" : "normal";
  if (band !== f.band && f.band !== "") {
    push(
      s,
      band === "boom" ? `Freight is booming: the Cass dial reads ${cyc.toFixed(2)}. Rates are climbing.` : band === "slump" ? `Freight is slumping: the Cass dial reads ${cyc.toFixed(2)}. Expect thin loads and price cuts.` : "Freight demand is back to normal.",
      band === "boom" ? "good" : band === "slump" ? "bad" : "",
    );
  }
  f.band = band;
}

// --- Map --------------------------------------------------------------------

function truckXY(t: Truck): [number, number] | null {
  const w = game!.w;
  const xy = art!.hubXY;
  if (t.status === "retired" || t.status === "listed" || t.companyId === 0) return null;
  const a = xy[t.hub]!;
  const moving = t.status === "toPickup" || t.status === "loaded" || t.status === "repositioning";
  if (!moving || t.targetHub === t.hub) return t.status === "unloading" ? xy[t.targetHub]! : a;
  const b = xy[t.targetHub]!;
  const route = hubRoute(w, t.hub, t.targetHub);
  const total = t.legMiles > 0 ? t.legMiles : route ? route.miles : hubMiles(w, t.hub, t.targetHub);
  // The engine moves trucks hour by hour; between hours, a truck still on the clock keeps rolling on screen.
  const { hos } = w.cfg;
  const rolling = t.dwellMin <= 0 && t.breakdownMin <= 0 && t.shiftDrivenMin < hos.drivingHoursPerDay * 60;
  const pace = route && route.hours > 0 ? route.miles / route.hours : hos.avgMph;
  const ahead = rolling ? (Math.min(60, clockMin() - w.t) / 60) * pace : 0;
  const left = Math.max(0, t.remainingMi - ahead);
  // Along the real road when there is one; straight between the hubs otherwise.
  if (route) {
    const [lat, lon] = w.net.roads.pointAlong(route, total - left, w.net.hubs[t.hub]!, w.net.hubs[t.targetHub]!);
    return project(lon, lat);
  }
  const k = total > 0 ? Math.max(0, Math.min(1, 1 - left / total)) : 1;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

const isMoving = (t: Truck) => (t.status === "toPickup" || t.status === "loaded" || t.status === "repositioning") && t.targetHub !== t.hub;

/** Where a truck shows: on its lane, or, zoomed in, fanned out around its hub so each one is visible. */
function truckPoint(t: Truck): [number, number] | null {
  const p = truckXY(t);
  if (!p || zoom() < 2 || isMoving(t)) return p;
  const i = t.id % 48;
  const r = 0.45 * Math.sqrt(i);
  const a = i * 2.39996; // golden angle: an even spiral
  return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
}

function drawMap(now: number): void {
  const cv = $<HTMLCanvasElement>("map");
  const ctx = cv.getContext("2d")!;
  const w = game!.w;
  const W = cv.width;
  const H = cv.height;
  const k = kScale();
  // Markers are drawn in their own pixels: the map's pixel size at 1×, doubled from 3×, so they stay sharp without ballooning.
  const u = fitScale * (zoom() >= 3 ? 2 : 1);
  const visible = (X: number, Y: number) => X > -16 * u && Y > -16 * u && X < W + 16 * u && Y < H + 16 * u;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(k, 0, 0, k, -panX, -panY);
  ctx.drawImage(art!.base, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Glints on the water.
  ctx.fillStyle = PAL.foam;
  for (let i = 0; i < art!.glints.length; i++) {
    if ((Math.floor(now / 450) + i * 7) % 11 === 0) {
      const [X, Y] = toScreen(...art!.glints[i]!);
      if (visible(X, Y)) ctx.fillRect(X, Y, 2 * u, u);
    }
  }
  const shade = nightShade(Math.floor(clockMin() / 60) % 24);
  if (shade > 0) {
    ctx.fillStyle = `rgba(10,13,24,${shade})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PAL.gold;
    for (let i = 0; i < art!.lights.length; i++) {
      if ((i * 13 + Math.floor(now / 900)) % 17 === 0) continue;
      const [X, Y] = toScreen(...art!.lights[i]!);
      if (visible(X, Y)) ctx.fillRect(X, Y, u, u);
    }
  }
  if (zoom() >= 2) drawHubLabels(ctx, k, u, visible);
  // AI carriers one dot each; other players' trucks a size up, in lime.
  const mine = game!.player?.id ?? -1;
  const humans = new Set(w.companies.filter(isHuman).map((c) => c.id));
  ctx.fillStyle = shade > 0.2 ? PAL.amber : PAL.paper;
  for (const t of w.trucks) {
    if (t.companyId === mine || humans.has(t.companyId)) continue;
    const p = truckPoint(t);
    if (!p) continue;
    const [X, Y] = toScreen(p[0], p[1]);
    if (visible(X, Y)) ctx.fillRect(X, Y, u, u);
  }
  for (const t of w.trucks) {
    if (t.companyId === mine || !humans.has(t.companyId)) continue;
    const p = truckPoint(t);
    if (!p) continue;
    const [X, Y] = toScreen(p[0], p[1]);
    if (!visible(X, Y)) continue;
    ctx.fillStyle = PAL.ink0;
    ctx.fillRect(X - u, Y - u, 4 * u, 4 * u);
    ctx.fillStyle = PAL.lime;
    ctx.fillRect(X, Y, 2 * u, 2 * u);
  }
  // Selected hub marker.
  if (selHub !== null) {
    const [X, Y] = toScreen(...art!.hubXY[selHub]!);
    ctx.fillStyle = PAL.ink0;
    ctx.fillRect(X - 4 * u, Y - 9 * u, 9 * u, 6 * u);
    ctx.fillStyle = PAL.amber;
    ctx.fillRect(X - 3 * u, Y - 8 * u, 7 * u, 4 * u);
    ctx.fillRect(X, Y - 4 * u, u, 3 * u);
  }
  // Your trucks: outlined cyan, the selected one blinking with its route.
  for (const t of myTrucks()) {
    const p = truckPoint(t);
    if (!p) continue;
    const [X, Y] = toScreen(p[0], p[1]);
    if (t.id === selTruck && isMoving(t)) {
      const [TX, TY] = toScreen(...art!.hubXY[t.targetHub]!);
      const n = Math.max(1, Math.round(Math.hypot(TX - X, TY - Y) / u));
      ctx.fillStyle = PAL.gold;
      for (let i = 0; i < n; i += 3) ctx.fillRect(Math.round(X + ((TX - X) * i) / n), Math.round(Y + ((TY - Y) * i) / n), u, u);
    }
    if (!visible(X, Y)) continue;
    const blink = t.id === selTruck && Math.floor(now / 300) % 2 === 0;
    ctx.fillStyle = PAL.ink0;
    ctx.fillRect(X - 2 * u, Y - 2 * u, 5 * u, 5 * u);
    ctx.fillStyle = blink ? PAL.white : t.status === "repair" ? PAL.red : PAL.cyan;
    ctx.fillRect(X - u, Y - u, 3 * u, 3 * u);
  }
}

/** Hub codes once zoomed in; from 3× each also shows its open loads. */
function drawHubLabels(ctx: CanvasRenderingContext2D, k: number, u: number, visible: (X: number, Y: number) => boolean): void {
  const w = game!.w;
  const px = 8 * Math.max(1, Math.floor(k / 4));
  const step = px / 8;
  let open: Map<number, number> | null = null;
  if (zoom() >= 3) {
    open = new Map();
    for (const l of w.loads.values()) if (l.status === "open") open.set(l.origin, (open.get(l.origin) ?? 0) + 1);
  }
  ctx.font = `${px}px "Press Start 2P", ui-monospace, monospace`;
  ctx.textBaseline = "top";
  w.net.hubs.forEach((h, i) => {
    const [X, Y] = toScreen(...art!.hubXY[i]!);
    if (!visible(X, Y)) return;
    const x = X + 3 * u;
    const y = Y - px - 2 * u;
    const count = open ? ` ${open.get(i) ?? 0}` : "";
    ctx.fillStyle = PAL.ink0;
    ctx.fillText(h.id + count, x + step, y + step);
    ctx.fillStyle = i === selHub ? PAL.amber : PAL.paper;
    ctx.fillText(h.id, x, y);
    if (count) {
      ctx.fillStyle = PAL.gold;
      ctx.fillText(count, x + ctx.measureText(h.id).width, y);
    }
  });
}

/** A pointer position in canvas pixels. */
function canvasPoint(ev: { clientX: number; clientY: number }): [number, number] {
  const cv = $<HTMLCanvasElement>("map");
  const r = cv.getBoundingClientRect();
  return [((ev.clientX - r.left) / r.width) * cv.width, ((ev.clientY - r.top) / r.height) * cv.height];
}
/** The map point under a pointer, in map pixels. */
function mapPoint(ev: { clientX: number; clientY: number }): [number, number] {
  return toWorld(...canvasPoint(ev));
}
/** The hub nearest a map point, within a reach that stays the same on screen at every zoom. */
function nearestHub(x: number, y: number, max = 7 / zoom()): number | null {
  let best: number | null = null;
  let bd = max;
  art!.hubXY.forEach(([hx, hy], i) => {
    const d = Math.hypot(hx - x, hy - y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

function openLoadsAt(hub: number): Load[] {
  const out: Load[] = [];
  for (const l of game!.w.loads.values()) if (l.status === "open" && l.origin === hub) out.push(l);
  return out;
}

// --- HUD ----------------------------------------------------------------------

function renderHud(): void {
  const g = game!;
  const w = g.w;
  const c = g.player;
  const minute = clockMin();
  const day = Math.floor(minute / 1440);
  const tokenNow = tokenLive(w);
  checkIdleAlerts();
  const badge =
    g.kind === "test"
      ? `<span class="badge test" title="A private test world: nothing here is stored">TEST WORLD</span><div class="speeds" role="group" aria-label="Test world speed">${SPEEDS.map((sp, i) => `<button class="btn" data-speed="${i}" title="${esc(sp.title)}">${sp.label}</button>`).join("")}</div>${live ? `<button class="btn" data-act="backlive">Back to the live world</button>` : ""}`
      : `<span class="badge live" title="One game day every 6 real hours. The live clock never stops.">● LIVE</span>${!c ? `<span class="badge watch">Watching</span>` : ""}`;
  let stats = "";
  if (c) {
    const bal = w.ledger.balance(companyAccount(c.id));
    const miles = c.milesHistory.reduce((a, b) => a + b, 0) + c.milesTotal;
    stats = `<span class="stat" title="Freight Dollars">${img(iconUrl("fd", 2), "FD")}<span class="num ${bal < 0 ? "bad" : ""}">${fd(bal)} FD</span></span>
      <span class="stat" title="Miles (airdrop points)">${img(iconUrl("miles", 2), "Miles")}<span class="num">${fd(miles)}</span></span>`;
  }
  stats += tokenNow
    ? `<span class="stat" title="FD price on the exchange">${img(iconUrl("usd", 2), "Price")}<span class="num">$${fdPriceUsd(w).toFixed(4)}</span></span>`
    : `<span class="stat label" title="FD launches on the exchange at the end of Year 2">Beta · launch in ${Math.max(0, GAME_CONFIG.token.betaYears * 365 - day)}d</span>`;
  if (c && c.authority.status !== "active") stats += `<span class="badge test" title="Your authority isn't active">${c.authority.status === "revoked" ? "AUTHORITY REVOKED" : "SUSPENDED"}</span>`;
  if (g.kind === "live" && g.broken) stats += `<span class="badge test" title="${esc(g.broken.reason)}">WORLD STOPPED</span>`;
  if (g.kind === "live") stats += `<span class="label" title="Human players in the live world">${w.companies.filter(isHuman).length} players</span>`;
  if (c) {
    const stuck = stuckTrucks().length;
    if (stuck) stats += `<span class="badge alert" title="Trucks idle a day or more: the Fleet tab says why">${stuck} IDLE</span>`;
  }
  if (fsEnabled()) stats += `<button class="btn" data-act="fullscreen" title="Full screen (F)">${fsActive() ? "Exit full screen" : "Full screen"}</button>`;
  // The clock text changes many times a second at the fast speeds, so it's updated in
  // place: rebuilding the bar would replace the speed buttons under a finger mid-press
  // and the tap would never land.
  const hud = $("hud");
  const parts: [string, string][] = [
    ["clock", `${img(iconUrl("clock", 2), "Clock")}<span class="num" data-clock></span>${badge}`],
    ["stats", stats],
  ];
  for (const [cls, html] of parts) {
    let el = hud.querySelector<HTMLElement>(`:scope > .${cls}`);
    if (!el) {
      el = document.createElement("div");
      el.className = cls;
      hud.appendChild(el);
    }
    if (el.dataset.html !== html) {
      el.innerHTML = html;
      el.dataset.html = html;
    }
  }
  const time = `${dateLabel(day)} · ${hhmm(minute)}`;
  const clockEl = hud.querySelector<HTMLElement>("[data-clock]");
  if (clockEl && clockEl.textContent !== time) clockEl.textContent = time;
  // The chosen speed is a class toggle, so changing it doesn't rebuild the buttons either.
  for (const b of hud.querySelectorAll<HTMLButtonElement>("[data-speed]")) {
    const on = Number(b.dataset.speed) === speed;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  }
}

function renderTicker(): void {
  const f = feed();
  const html = f.ticker
    .slice(0, 8)
    .map((t) => `<span class="${t.cls}">${esc(t.text)}</span>`)
    .join("");
  const el = $("ticker");
  if (el.dataset.html !== html) {
    el.innerHTML = html || `<span class="muted">Your dispatcher is watching the board. Bids clear at 06:00 and 18:00.</span>`;
    el.dataset.html = html;
  }
}

function renderTabs(): void {
  const tabs: [Tab, string][] = [
    ["fleet", "Fleet"],
    ["loads", "Load board"],
    ["staff", "Staff"],
    ["market", "Dealer"],
    ["money", "Money"],
    ["company", "Company"],
    ["guide", "Guide"],
  ];
  $("tabs").innerHTML = tabs.map(([k, l]) => `<button class="btn ${k === tab ? "on" : ""}" data-tab="${k}" aria-pressed="${k === tab}">${l}</button>`).join("");
}

// --- Panels -------------------------------------------------------------------------

function renderPanel(): void {
  const p = $("panel");
  const panels: Record<Tab, () => string> = {
    fleet: fleetPanel,
    loads: loadsPanel,
    staff: staffPanel,
    market: marketPanel,
    money: moneyPanel,
    company: companyPanel,
    guide: guidePanel,
  };
  const html = !game!.player && tab !== "company" && tab !== "guide" ? watchPanel() : panels[tab]();
  if (p.dataset.html !== html) {
    const scroll = p.scrollTop;
    p.innerHTML = html;
    p.dataset.html = html;
    p.scrollTop = scroll;
  }
}

/** For a page with no company on screen: joining, watching from another tab, or a viewer who can't play. */
function watchPanel(): string {
  const lw = live!;
  const joining = lw.pending().find((r) => r.a.type === "join");
  let head: string;
  if (joining) head = `<div class="card"><h3>Registering your company</h3><p>Your leased truck is ready at ${hhmm(joining.at)}, in ${realUntil(lw.msUntil(joining.at))}.</p></div>`;
  else if (lw.lease === "busy")
    head = `<div class="card"><h3>Open in another tab</h3><p>Your company is being run from another tab or device. This one is watching.</p><div class="row"><button class="btn primary" data-act="takeover">Play here instead</button></div></div>`;
  else if (lw.lease === "denied") head = `<div class="card"><h3>Watching</h3><p>You can watch the live world. To run a company in it, ask the owner to share this page with you as a Contributor.</p></div>`;
  else head = `<div class="card"><h3>Watching</h3><p>Sign in to claude.ai to run a company.</p></div>`;
  const hubCard = selHub !== null ? hubLoadsTable(selHub) : `<p class="muted">Click a hub on the map to see its open loads.</p>`;
  return `<div class="stack"><h2>The live world</h2>${head}${hubCard}</div>`;
}

/** Live orders on their way, with when each takes effect. */
function pendingCard(): string {
  if (game?.kind !== "live") return "";
  const lw = game;
  const p = lw.pending();
  if (!p.length) return "";
  return `<div class="card"><h3>Orders on the way</h3>${p.map((r) => `<p style="font-size:15px">${esc(describe(r.a))} · <span class="muted">at ${hhmm(r.at)}, in ${realUntil(lw.msUntil(r.at))}</span></p>`).join("")}</div>`;
}

// --- Idle trucks ------------------------------------------------------------------------

/** A truck counts as stuck after this many hours idle: the dispatcher has had two rounds at it. */
const IDLE_ALERT_HOURS = 24;
const idleHours = (t: Truck) => Math.max(0, (clockMin() - t.idleSinceT) / 60);
const idleDays = (t: Truck) => Math.floor(idleHours(t) / 24);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** "5 h", "1 day 3 h", "4 days". */
function idleLabel(t: Truck): string {
  const h = Math.floor(idleHours(t));
  const d = Math.floor(h / 24);
  return d === 0 ? `${h} h` : `${plural(d, "day")}${h % 24 ? ` ${h % 24} h` : ""}`;
}

interface IdleWhy {
  /** One sentence, plain text, on why the truck is sitting. */
  why: string;
  /** Buttons that address it. */
  fixes: string[];
}

/** Why one of the player's idle trucks isn't moving, and what would move it. */
function idleWhy(t: Truck): IdleWhy {
  const w = game!.w;
  const c = me();
  const hubName = w.net.hubs[t.hub]!.name;
  const trailer = TRAILER_NAME[t.trailer].toLowerCase();
  const board = `<button class="btn" data-act="findloads" data-truck="${t.id}">Bid by hand</button>`;
  if (!crewed(t)) return { why: "No driver is seated, so it can't run.", fixes: [`<button class="btn primary" data-act="tostaff">Hire a driver</button>`] };
  if (c.authority.status !== "active") return { why: c.authority.status === "revoked" ? "Your authority is revoked: nothing can haul." : "Your authority is suspended: nothing can haul until it's back.", fixes: [] };
  if (t.breakdownMin > 0) return { why: `Broken down: about ${Math.ceil(t.breakdownMin / 60)} h until the tow and repair are done.`, fixes: [] };
  const bid = w.manualBids.get(t.id);
  if (bid) return { why: `Your bid of ${bid.rate.toFixed(2)}/mi is in for the next round.`, fixes: [] };
  const order = c.orders.find((o): o is Extract<StandingOrder, { kind: "bid" }> => o.kind === "bid");
  if (!order) return { why: "Your dispatcher has no bid order, so nobody bids for this truck.", fixes: [`<button class="btn primary" data-act="ordersReset">Restore the default dispatcher</button>`, board] };
  const floor = c.orders.find((o): o is Extract<StandingOrder, { kind: "floor" }> => o.kind === "floor");
  const maxDh = order.maxDeadheadMi;
  const loads = [...w.loads.values()].filter((l) => l.status === "open" && l.equipment === t.trailer && l.brokerId !== c.id && hubMiles(w, t.hub, l.origin) <= maxDh);
  if (loads.length === 0) {
    // The dispatcher's reach is empty: point at the nearest freight worth the run.
    const best = w.net.hubs
      .map((h, i) => ({ h, i, mi: hubMiles(w, t.hub, i), n: openLoadsAt(i).filter((l) => l.equipment === t.trailer).length }))
      .filter((x) => x.i !== t.hub && x.n > 0 && x.mi <= 800)
      .sort((a, b) => b.n - b.mi / 200 - (a.n - a.mi / 200))[0];
    return {
      why: `No ${trailer} loads within ${maxDh} mi of ${hubName}, the dispatcher's limit${best ? `. The nearest freight worth the run is ${plural(best.n, "load")} at ${best.h.name}, ${best.mi} mi away` : ""}.`,
      fixes: [...(best ? [`<button class="btn primary" data-act="sendto" data-truck="${t.id}" data-hub="${best.h.id}">Send empty to ${best.h.id} · ${best.mi} mi</button>`] : []), `<button class="btn" data-act="findloads" data-truck="${t.id}">Load board</button>`],
    };
  }
  if (loads.every((l) => l.hot > 0) && !canMakeHot(c, t)) return { why: `The only ${trailer} loads in range are hot, and a solo driver can't make a hot window legally.`, fixes: [`<button class="btn primary" data-act="tostaff">Seat a co-driver</button>`] };
  const blocked = loads.map((l) => vettingBlock(w, c, l)).filter((x): x is string => x !== null);
  if (blocked.length === loads.length) return { why: `Every load in range requires vetting you don't pass: ${blocked[0]}.`, fixes: [] };
  const fuel = fuelPrice(w);
  const floorPct = floor?.breakEvenPlusPct ?? 0;
  const payable = loads.filter((l) => {
    const dh = hubMiles(w, t.hub, l.origin);
    const be = breakEvenPerMile(w.cfg, t, fuel, l.miles, dh + w.cfg.board.reloadWeight * expectedReloadDeadheadMi(w, l.dest, l.equipment), hubToll(w, t.hub, l.origin) + w.net.lanes[l.laneId]!.tollFd);
    return l.ceiling >= be * (1 + floorPct);
  });
  if (payable.length === 0) return { why: `${plural(loads.length, `${trailer} load`)} in range, but none pays your floor (break-even + ${Math.round(floorPct * 100)}%) even at its ceiling.`, fixes: [board] };
  const running = operatingTrucks(w, c.id);
  const prof = dispatchProfile(w, c, running);
  if (prof.coverage < 1) return { why: `Your dispatcher is stretched: ${prof.span} trucks' worth of attention for the ${running} you run, so this truck sits out about ${Math.round((1 - prof.coverage) * 100)}% of rounds.`, fixes: [`<button class="btn primary" data-act="tostaff">Hire a dispatcher</button>`, board] };
  return { why: `${plural(payable.length, `${trailer} load`)} in range pay enough, but the dispatcher's bids keep losing: other carriers bid lower or have the better record.`, fixes: [`<button class="btn primary" data-act="findloads" data-truck="${t.id}">Bid by hand</button>`] };
}

/** The player's trucks idle a day or more. */
const stuckTrucks = () => myTrucks().filter((t) => t.status === "idle" && idleHours(t) >= IDLE_ALERT_HOURS);

function idleAlertsCard(): string {
  const w = game!.w;
  return stuckTrucks()
    .map((t) => {
      const d = idleWhy(t);
      return `<div class="card alert"><h3>Truck ${truckNo(t.id)} has been idle ${idleLabel(t)} at ${esc(w.net.hubs[t.hub]!.name)}</h3>
        <p>${esc(d.why)} It has sat out ${plural(t.idleRounds, "bidding round")}${t.lease === "owned" ? ` and pays ${w.cfg.costs.idleFeePerDay} FD a day idle after ${w.cfg.costs.idleFeeAfterDays}` : ""}.</p>
        ${d.fixes.length ? `<div class="row">${d.fixes.join("")}</div>` : ""}</div>`;
    })
    .join("");
}

/** Shouts once per idle day per truck, in the ticker and as a toast. */
const idleAlerted = new Map<string, number>();
function checkIdleAlerts(): void {
  const g = game;
  if (!g?.player) return;
  for (const t of myTrucks()) {
    const key = `${g.kind}:${t.id}`;
    if (t.status !== "idle") {
      idleAlerted.delete(key);
      continue;
    }
    const days = idleDays(t);
    if (idleHours(t) < IDLE_ALERT_HOURS || idleAlerted.get(key) === days) continue;
    idleAlerted.set(key, days);
    const text = `Truck ${truckNo(t.id)} has been idle ${idleLabel(t)} at ${g.w.net.hubs[t.hub]!.name}: ${idleWhy(t).why}`;
    push(g, text, "bad");
    toast(text, true);
    panelDirty = true;
  }
}

function statusLine(t: Truck): string {
  const w = game!.w;
  const hub = (i: number) => esc(w.net.hubs[i]!.name);
  switch (t.status) {
    case "idle": {
      const bid = w.manualBids.get(t.id);
      const h = idleHours(t);
      const since = `<span class="${h >= IDLE_ALERT_HOURS ? "bad" : h >= 12 ? "warn" : ""}">${idleLabel(t)}</span>`;
      return `Idle at ${hub(t.hub)} for ${since}${t.idleRounds ? ` · sat out ${plural(t.idleRounds, "round")}` : ""}${bid ? ` · <span class="good">your bid ${bid.rate.toFixed(2)}/mi is in</span>` : ""}`;
    }
    case "toPickup":
      return `Heading empty to ${hub(t.targetHub)} for a pickup · ${Math.round(t.remainingMi)} mi`;
    case "loading":
      return `Loading at ${hub(t.hub)}`;
    case "loaded": {
      const l = t.loadId !== null ? w.loads.get(t.loadId) : undefined;
      return `Loaded ${hub(t.hub)} → ${hub(t.targetHub)} · ${Math.round(t.remainingMi)} mi to go${l ? ` · ${l.clearedRate.toFixed(2)}/mi` : ""}${t.breakdownMin > 0 ? ' · <span class="bad">broken down</span>' : ""}`;
    }
    case "unloading":
      return `Unloading at ${hub(t.targetHub)}`;
    case "repositioning":
      return `Running empty to ${hub(t.targetHub)} · ${Math.round(t.remainingMi)} mi`;
    case "repair":
      return `In the shop`;
    case "parked":
      return `Parked at ${hub(t.hub)} (off the road; an owned truck unused ${w.cfg.costs.idleFeeAfterDays}+ days pays ${w.cfg.costs.idleFeePerDay} FD/day)`;
    case "listed":
      return `Listed for sale`;
    default:
      return t.status;
  }
}

function fleetPanel(): string {
  const g = game!;
  const w = g.w;
  const trucks = myTrucks();
  const today = Math.floor(w.t / 1440);
  const pending = ordersOf(w, me().id);
  const hubsByDist = (from: number) =>
    w.net.hubs
      .map((h, i) => ({ h, i, mi: hubMiles(w, from, i) }))
      .filter((x) => x.i !== from)
      .sort((a, b) => a.mi - b.mi)
      .slice(0, 14);
  const cards = trucks
    .map((t, idx) => {
      const leased = t.lease !== "owned";
      const cond = condition(w.cfg, t);
      const kind = t.lease === "npc" ? "NPC lease (15% of gross)" : t.lease === "lessor" ? "Extra lease (15% of gross, 250 FD/wk minimum)" : `Owned · worth ${fd(truckValue(w, t))} FD`;
      const actions: string[] = [];
      if (t.status === "idle") {
        actions.push(`<button class="btn" data-act="findloads" data-truck="${t.id}">Find loads</button>`);
        actions.push(
          `<select id="send-${t.id}" aria-label="Destination hub">${hubsByDist(t.hub)
            .map((x) => `<option value="${x.h.id}">${esc(x.h.id)} · ${x.mi} mi · ${openLoadsAt(x.i).filter((l) => l.equipment === t.trailer).length} loads</option>`)
            .join("")}</select><button class="btn" data-act="send" data-truck="${t.id}">Send empty</button>`,
        );
      }
      if (t.lease === "owned" && t.status === "idle" && cond <= w.cfg.wear.rebuildMaxCondition) actions.push(`<button class="btn" data-act="rebuild" data-truck="${t.id}">Rebuild · ${fd(rebuildCost(w.cfg, t))} FD</button>`);
      if (t.lease === "owned" && t.status === "idle") actions.push(`<button class="btn" data-act="park" data-truck="${t.id}">Park</button>`);
      if (t.status === "parked") actions.push(`<button class="btn" data-act="unpark" data-truck="${t.id}">Back on the road</button>`);
      if (t.lease === "owned" && (t.status === "idle" || t.status === "parked") && trucks.length > 1) actions.push(`<button class="btn" data-act="sell" data-truck="${t.id}">Sell</button>`);
      if (t.lease === "lessor" && t.status === "idle") actions.push(`<button class="btn" data-act="return" data-truck="${t.id}">Return lease</button>`);
      if (t.defects > 0 && (t.status === "idle" || t.status === "parked")) actions.push(`<button class="btn" data-act="fix" data-truck="${t.id}">Fix ${t.defects} defect${t.defects > 1 ? "s" : ""} · ${fd(t.defects * w.cfg.safety.maintenance.fixFdPerDefect)} FD</button>`);
      if (!crewed(t)) actions.push(`<button class="btn primary" data-act="tostaff">Hire a driver</button>`);
      const load = t.loadId !== null ? w.loads.get(t.loadId) : undefined;
      if (t.status === "toPickup" && load && load.status === "assigned" && load.carrierId === me().id && !load.doubleBroker && load.shipperId !== me().id)
        actions.push(
          `<input type="number" id="rb-${t.id}" step="0.01" min="0.5" max="${(load.clearedRate - 0.01).toFixed(2)}" value="${(load.clearedRate * 0.85).toFixed(2)}" aria-label="Rate to re-post at"><label class="label"><input type="checkbox" id="rbpay-${t.id}" checked> pay the hauler</label><button class="btn" data-act="rebroker" data-truck="${t.id}" data-load="${load.id}">Re-post the load (won at ${load.clearedRate.toFixed(2)})</button>`,
        );
      if (t.status === "loaded" && load && load.shipperId !== me().id) actions.push(`<button class="btn" data-act="steal" data-truck="${t.id}">Steal the load · cargo ${fd(load.cargoValue)} FD</button>`);
      return `<div class="card ${t.id === selTruck ? "sel" : ""}" data-select="${t.id}">
        <div class="truckhead">${img(truckUrl(t.tier, t.trailer, leased, PAL.cyan, 2), `${TIER_NAME[t.tier]} with ${TRAILER_NAME[t.trailer]}`)}
          <div><h3>Truck ${idx + 1} · ${TIER_NAME[t.tier]}</h3><p class="muted">${TRAILER_NAME[t.trailer]} · ${kind}</p></div></div>
        <p>${statusLine(t)}${t.breakdownMin > 0 && t.status !== "loaded" ? ' · <span class="bad">stopped</span>' : ""}</p>
        <p style="font-size:15px">${crewLine(t)}</p>
        <div class="row"><span class="label">Condition</span><span class="bar"><i style="width:${Math.round(cond * 100)}%;background:${cond > 0.6 ? PAL.lime : cond > 0.35 ? PAL.amber : PAL.red}"></i></span><span class="num">${pct(cond)}</span><span class="label">Odometer</span><span class="num">${Math.round(t.odometer).toLocaleString("en-US")} mi</span></div>
        ${actions.length ? `<div class="row">${actions.join("")}</div>` : ""}
      </div>`;
    })
    .join("");
  const orders = pending.length
    ? `<p class="muted">On order: ${pending.map((o) => `${TIER_NAME[o.tier]} + ${TRAILER_NAME[o.trailer]}, arrives ${dateLabel(o.dueDay)}`).join("; ")}</p>`
    : "";
  return `<div class="stack"><h2>Your fleet</h2>${idleAlertsCard()}${pendingCard()}${orders}${cards}${dispatcherCard()}</div>`;
}

function dispatcherCard(): string {
  const c = me();
  const bid = c.orders.find((o) => o.kind === "bid") as Extract<StandingOrder, { kind: "bid" }> | undefined;
  const floor = c.orders.find((o) => o.kind === "floor") as Extract<StandingOrder, { kind: "floor" }> | undefined;
  const repo = c.orders.find((o) => o.kind === "reposition") as Extract<StandingOrder, { kind: "reposition" }> | undefined;
  const rb = c.orders.find((o) => o.kind === "rebroker") as Extract<StandingOrder, { kind: "rebroker" }> | undefined;
  const mode = bid?.price.mode ?? "breakEvenPlus";
  return `<div class="card">
    <h3>Dispatcher (standing orders)</h3>
    <p class="muted" style="font-size:14px">Your dispatcher bids for idle trucks every round you don't bid by hand.</p>
    <div class="row"><label class="label" for="o-mode">Bid at</label>
      <select id="o-mode"><option value="breakEvenPlus" ${mode === "breakEvenPlus" ? "selected" : ""}>break-even plus %</option><option value="ceilingPct" ${mode === "ceilingPct" ? "selected" : ""}>% of the posted ceiling</option></select>
      <input type="number" id="o-pct" step="1" min="0" max="120" value="${Math.round((bid?.price.pct ?? 0.25) * 100)}"><span class="muted">%</span></div>
    <div class="row"><label class="label" for="o-floor">Never below break-even +</label><input type="number" id="o-floor" min="0" max="50" value="${Math.round((floor?.breakEvenPlusPct ?? 0.05) * 100)}"><span class="muted">%</span></div>
    <div class="row"><label class="label" for="o-dh">Max empty miles to a pickup</label><input type="number" id="o-dh" min="0" max="150" value="${bid?.maxDeadheadMi ?? 150}"></div>
    <div class="row"><label class="label"><input type="checkbox" id="o-repo" ${repo ? "checked" : ""}> Move idle trucks to busier hubs</label>
      <span class="muted">after</span><input type="number" id="o-repo-r" min="1" max="20" value="${repo?.afterIdleRounds ?? 3}"><span class="muted">idle rounds</span></div>
    <div class="row"><label class="label"><input type="checkbox" id="o-rb" ${rb ? "checked" : ""}> Re-post some won loads to other carriers before pickup</label>
      <input type="number" id="o-rb-share" min="0" max="100" value="${Math.round((rb?.share ?? 0.1) * 100)}"><span class="muted">% of loads, keeping</span><input type="number" id="o-rb-keep" min="0" max="90" value="${Math.round((rb?.keepPct ?? 0.15) * 100)}"><span class="muted">% of the rate</span>
      <label class="label"><input type="checkbox" id="o-rb-pays" ${!rb || rb.pays ? "checked" : ""}> pay the hauler</label></div>
    <div class="row"><button class="btn primary" data-act="orders">Save dispatcher</button><button class="btn" data-act="ordersReset">Defaults</button></div>
  </div>`;
}

function nextRoundLabel(): string {
  const g = game!;
  const minute = clockMin();
  const hour = (minute / 60) % 24;
  const next = hour < 6 ? 6 : hour < 18 ? 18 : 30;
  const at = minute + (next - hour) * 60;
  const wait = g.kind === "live" ? realUntil(g.msUntil(at)) : `${Math.ceil(next - hour)}h`;
  return `${String(next % 24).padStart(2, "0")}:00 (in ${wait})`;
}

const signedPct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.round(Math.abs(x) * 100)}%`;

/** How easily a truck of this type reloads after delivering at a hub, against the national average. */
function reloadLabel(hub: number, eq: Equipment): string {
  const r = reloadOdds(game!.w, hub, eq);
  return r >= 1.25 ? "good" : r >= 0.8 ? "fair" : "poor";
}
function reloadClass(hub: number, eq: Equipment): string {
  const r = reloadOdds(game!.w, hub, eq);
  return r >= 1.25 ? "good" : r >= 0.8 ? "" : "bad";
}
/** The origin's season for this trailer, when it's moving rates noticeably. */
function seasonNote(hub: number, eq: Equipment): string {
  const swing = seasonality(game!.w, hub, eq, Math.floor(clockMin() / 1440)).rate - 1;
  if (Math.abs(swing) < 0.05) return "";
  return ` · <span class="${swing > 0 ? "good" : "bad"}">${swing > 0 ? "in season" : "off season"} ${signedPct(swing)}</span>`;
}

/** Where the season has rates running hottest and coldest right now. */
function seasonCard(day: number): string {
  const w = game!.w;
  const rows = (eq: Equipment) => {
    const all = w.net.hubs.map((h, i) => ({ id: h.id, r: seasonality(w, i, eq, day).rate - 1 })).sort((a, b) => b.r - a.r);
    const fmt = (x: { id: string; r: number }) => `${x.id} <span class="${x.r >= 0 ? "good" : "bad"}">${signedPct(x.r)}</span>`;
    return `<dt>${TRAILER_NAME[eq]}</dt><dd>hot: ${all.slice(0, 3).map(fmt).join(", ")} · cold: ${all.slice(-2).map(fmt).join(", ")}</dd>`;
  };
  return `<div class="card"><h3>Seasons now</h3><p class="muted" style="font-size:14px">Seasonal rate swing by origin, against each market's yearly average. Produce moves from South Florida and the Rio Grande Valley in spring to Georgia and the Carolinas in summer and the West and North in fall; northern markets also tighten in winter.</p><dl class="kv">${rows("reefer")}${rows("van")}${rows("flatbed")}</dl></div>`;
}

function loadsPanel(): string {
  const g = game!;
  const w = g.w;
  const trucks = myTrucks();
  const idle = trucks.filter((t) => t.status === "idle");
  const truck = trucks.find((t) => t.id === selTruck && t.status === "idle") ?? idle[0];
  const chips = trucks
    .map((t, i) => `<button class="btn ${truck && t.id === truck.id ? "on" : ""}" data-select="${t.id}" ${t.status === "idle" ? "" : "disabled"} title="${esc(statusLine(t).replace(/<[^>]+>/g, ""))}">Truck ${i + 1}${t.status === "idle" ? "" : " · busy"}</button>`)
    .join("");
  let body = "";
  if (!truck) {
    body = `<p class="muted">No idle trucks right now. Loads show here when a truck is free at a hub.</p>`;
    if (selHub !== null) body += hubLoadsTable(selHub);
  } else {
    const fuel = fuelPrice(w);
    const pending = w.manualBids.get(truck.id);
    const sent = g.kind === "live" ? g.pending().find((r) => r.a.type === "place_bid" && r.a.truckId === truck.id) : undefined;
    const rows: { l: Load; dh: number; be: number; suggest: number; profit: number; reloadMi: number; tolls: number; highway: number; hours: number }[] = [];
    for (const l of w.loads.values()) {
      if (l.status !== "open" || l.equipment !== truck.trailer || l.brokerId === me().id) continue;
      const dh = hubMiles(w, truck.hub, l.origin);
      if (dh > MANUAL_BID_MAX_DEADHEAD_MI) continue;
      // Same break-even the dispatcher uses: part of the empty run out of the destination is priced in.
      const reloadMi = expectedReloadDeadheadMi(w, l.dest, l.equipment);
      // Tolls on the way to the pickup and on the lane are part of the cost, like the dispatcher counts them.
      const lane = w.net.lanes[l.laneId]!;
      const tolls = hubToll(w, truck.hub, l.origin) + lane.tollFd;
      const be = breakEvenPerMile(w.cfg, truck, fuel, l.miles, dh + w.cfg.board.reloadWeight * reloadMi, tolls);
      // Loads tend to clear near the lane's reference rate; the ceiling is the most the poster pays.
      const suggest = Math.min(l.ceiling, Math.max(be * 1.08, l.refRate * 0.97));
      rows.push({ l, dh, be, suggest, profit: (suggest - be) * l.miles, reloadMi, tolls, highway: lane.highwayShare, hours: lane.hours });
    }
    rows.sort((a, b) => b.profit - a.profit);
    const list = rows
      .slice(0, 25)
      .map(({ l, dh, be, suggest, profit, reloadMi, tolls, highway, hours }) => {
        const mine = pending?.loadId === l.id;
        const o = w.net.hubs[l.origin]!;
        const d = w.net.hubs[l.dest]!;
        return `<div class="load ${mine ? "mine" : ""}">
          <div><div class="lane">${o.id} <span class="arrow">to</span> ${d.id}</div><div class="muted" style="font-size:14px">${esc(o.name)} to ${esc(d.name)} · ${l.miles} mi${dh ? ` · ${dh} mi empty first` : ""}${l.brokerId !== null ? " · brokered" : ""}${l.shipperId !== null ? " · player shipper" : ""}</div>
          <div style="font-size:14px">Reload at ${d.id}: <span class="${reloadClass(l.dest, l.equipment)}">${reloadLabel(l.dest, l.equipment)}</span> (about ${Math.round(reloadMi)} mi empty to the next load)${seasonNote(l.origin, l.equipment)}</div>
          <div style="font-size:14px">${hours.toFixed(1)} h driving${tolls > 0 ? ` · <span class="warn">tolls ${fd(tolls)} FD</span>` : " · no tolls"}${highway >= 0.05 ? ` · <span class="warn">${pct(highway)} two-lane highway</span>` : " · interstate"}</div>
          <div style="font-size:14px">Pays up to <span class="num">${l.ceiling.toFixed(2)}</span>/mi (<span class="num">${fd(l.ceiling * l.miles)}</span> FD) · usually clears near <span class="num">${l.refRate.toFixed(2)}</span> · your break-even <span class="num">${be.toFixed(2)}</span>/mi · <span class="${profit > 0 ? "good" : "bad"}">about ${fd(profit)} FD profit</span></div></div>
          <div class="row" style="justify-content:end"><input type="number" id="bid-${l.id}" step="0.01" min="0.5" max="${l.ceiling.toFixed(2)}" value="${(mine ? pending!.rate : suggest).toFixed(2)}" aria-label="Your rate per mile">
          <button class="btn ${mine ? "on" : "primary"}" data-act="bid" data-load="${l.id}" data-truck="${truck.id}">${mine ? "Rebid" : "Bid"}</button></div>
        </div>`;
      })
      .join("");
    body = `<p class="muted" style="font-size:14px">Sealed bids clear at ${nextRoundLabel()}. Lower rates, a better on-time record and fewer empty miles win. One bid per truck per round; a bid by hand replaces your dispatcher's bids for that truck.</p>
      ${sent && sent.a.type === "place_bid" ? `<p class="warn">Bid on its way: ${sent.a.rate.toFixed(2)}/mi, in at ${hhmm(sent.at)}.</p>` : ""}
      ${pending ? `<div class="row"><span class="good">Bid in: ${pending.rate.toFixed(2)}/mi</span><button class="btn" data-act="cancelbid" data-truck="${truck.id}">Withdraw bid</button></div>` : ""}
      <div class="loads">${list || `<p class="muted">No ${TRAILER_NAME[truck.trailer].toLowerCase()} loads within ${MANUAL_BID_MAX_DEADHEAD_MI} miles right now. Send the truck to a busier hub or wait for the next round.</p>`}</div>`;
  }
  return `<div class="stack"><h2>Load board</h2><div class="row">${chips}</div>${body}</div>`;
}

function hubLoadsTable(hub: number): string {
  const w = game!.w;
  const h = w.net.hubs[hub]!;
  const loads = openLoadsAt(hub).sort((a, b) => b.ceiling - a.ceiling).slice(0, 12);
  return `<div class="card"><h3>${esc(h.name)} (${h.id})</h3><p class="muted">Load-to-truck ratio ${w.lastRatio[hub]!.toFixed(2)} · ${openLoadsAt(hub).length} open loads</p>
    <table><tr><th>To</th><th>Equip</th><th>Miles</th><th>Ceiling</th></tr>${loads.map((l) => `<tr><td>${w.net.hubs[l.dest]!.id}</td><td>${TRAILER_NAME[l.equipment]}</td><td class="num">${l.miles}</td><td class="num">${l.ceiling.toFixed(2)}</td></tr>`).join("")}</table></div>`;
}

function marketPanel(): string {
  const g = game!;
  const w = g.w;
  const c = me();
  const cash = w.ledger.balance(companyAccount(c.id));
  const fleet = myTrucks();
  const onLease = fleet.some((t) => t.lease === "npc");
  const firstTruck = !fleet.some((t) => t.lease === "owned") && ordersOf(w, c.id).length === 0;
  const lead = deliveryDays(w);
  const tiers: TractorTier[] = ["workhorse", "highwayPro", "flagship"];
  const trailers: Equipment[] = ["van", "reefer", "flatbed"];
  const dealer = tiers
    .map((tier) =>
      trailers
        .map((tr) => {
          const price = dealerPrice(w, { tier, trailer: tr });
          const vsList = price / newPrice(w.cfg, { tier, trailer: tr }) - 1;
          const left = availableSupply(w, tier, tr, firstTruck);
          const move = Math.abs(vsList) < 0.01 ? "list price" : `<span class="${vsList > 0 ? "bad" : "good"}">${signedPct(vsList)} vs list</span>`;
          return `<div class="card"><div class="truckhead">${img(truckUrl(tier, tr, false, PAL.amber, 2), `${TIER_NAME[tier]} with ${TRAILER_NAME[tr]}`)}<div><h3>${TIER_NAME[tier]} + ${TRAILER_NAME[tr]}</h3><p><span class="num">${fd(price)}</span> FD (${move}) · ${left} left · ${lead} days to deliver</p></div></div>
          <div class="row"><button class="btn primary" data-act="buynew" data-tier="${tier}" data-trailer="${tr}" ${cash >= price && left > 0 ? "" : "disabled"}>Order${onLease ? " (replaces your lease)" : ""}</button></div></div>`;
        })
        .join(""),
    )
    .join("");
  const today = Math.floor(w.t / 1440);
  const used = openListings(w)
    .filter((l) => l.formerOwnerId !== c.id && l.sellerId !== c.id)
    .map((l) => ({ l, t: w.trucks[l.truckId - 1]! }))
    .sort((a, b) => a.l.askFd / Math.max(1, truckValue(w, a.t)) - b.l.askFd / Math.max(1, truckValue(w, b.t)))
    .slice(0, 8)
    .map(
      ({ l, t }) => `<div class="card"><div class="truckhead">${img(truckUrl(t.tier, t.trailer, false, PAL.fog, 2), "Used truck")}<div><h3>${TIER_NAME[t.tier]} + ${TRAILER_NAME[t.trailer]}</h3>
      <p>${Math.round(t.odometer).toLocaleString("en-US")} mi · ${pct(condition(w.cfg, t))} condition · at ${esc(w.net.hubs[t.hub]!.id)}${l.sellerId === 0 ? ' · <span class="warn">repo</span>' : ""}</p>
      <p>Asking <span class="num">${fd(l.askFd)}</span> FD (value ${fd(truckValue(w, t))})</p></div></div>
      <div class="row"><button class="btn primary" data-act="buyused" data-listing="${l.id}" ${cash >= l.askFd ? "" : "disabled"}>Buy today</button></div></div>`,
    )
    .join("");
  const canLease = fleet.some((t) => t.lease === "owned") && lessorTrucksOf(w, c.id).length < w.cfg.freeEntry.leases.maxPerCompany;
  const lease = `<div class="card"><h3>Lease another truck</h3><p class="muted" style="font-size:14px">No money down: the lessor takes 15% of each load, 250 FD a week minimum, 28-day minimum term. Needs one truck you own. Lessor has ${w.lessor.fleet - w.lessor.out} free.</p>
    <div class="row">${trailers.map((tr) => `<button class="btn" data-act="lease" data-trailer="${tr}" ${canLease && w.lessor.out < w.lessor.fleet ? "" : "disabled"}>${TRAILER_NAME[tr]}</button>`).join("")}</div></div>`;
  const facTypes: FacilityType[] = ["warehouse", "coldStorage", "factory"];
  const fac = facTypes
    .map((type) => {
      const spec = w.cfg.facilities.types[type];
      const best = w.net.hubs
        .map((h, i) => ({ h, o: facilityOutlook(w, type, i, today) }))
        .sort((a, b) => b.o.loadsPerRound - a.o.loadsPerRound)
        .slice(0, 3);
      return `<div class="card"><div class="truckhead">${img(facilityUrl(type, 2), FAC_NAME[type])}<div><h3>${FAC_NAME[type]}</h3><p><span class="num">${fd(spec.priceFd)}</span> FD · upkeep ${fd(spec.upkeepPerWeekFd)}/wk · ${w.facilitySupply[type]} left</p></div></div>
        <p class="muted" style="font-size:14px">Ships its own freight from its hub; you earn the goods margin and shipper Miles.</p>
        <div class="row">${best.map((b) => `<button class="btn" data-act="facility" data-type="${type}" data-hub="${b.h.id}" ${cash >= spec.priceFd && w.facilitySupply[type] > 0 ? "" : "disabled"}>${b.h.id} · ${(b.o.loadsPerRound * 2).toFixed(1)} loads/day</button>`).join("")}</div></div>`;
    })
    .join("");
  return `<div class="stack"><h2>Dealer</h2><p class="muted" style="font-size:14px">New trucks are paid now and delivered in ${lead} days; the wait grows when the whole market is ordering. Used trucks deliver today.</p>
    <h3>Used trucks</h3>${used || '<p class="muted">Nothing listed right now.</p>'}
    ${lease}
    <h3>New from the dealer</h3>${dealer}
    <h3>Facilities</h3>${fac}</div>`;
}

function sparkline(values: number[], color: string): string {
  if (values.length < 2) return "";
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 200).toFixed(1)},${(44 - ((v - lo) / span) * 40).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="2" points="${pts}" shape-rendering="crispEdges"/></svg>`;
}

function moneyPanel(): string {
  const g = game!;
  const w = g.w;
  const c = me();
  const bal = w.ledger.balance(companyAccount(c.id));
  const live = tokenLive(w);
  const deposit = depositorValue(w, c.id);
  const loans = w.finance.loans.filter((l) => l.borrowerId === c.id && l.status === "active");
  const owned = myTrucks().filter((t) => t.lease === "owned");
  const borrowable = owned.map((t, i) => ({ t, i, cap: borrowingCapacity(w, t) })).filter((x) => x.cap > 100);
  const day = Math.floor(w.t / 1440);
  const finance = `<div class="card"><h3>Equipment Finance</h3>
    <p class="muted" style="font-size:14px">Borrow up to 35% of a truck's value at 1% a week over 26 weeks. Miss two payments and the repo man takes the truck. Or deposit spare FD and earn what borrowers pay.</p>
    <dl class="kv"><dt>Pool cash</dt><dd class="num">${fd(poolCash(w))} FD</dd><dt>Your deposit</dt><dd class="num">${fd(deposit)} FD</dd></dl>
    <div class="row"><input type="number" id="dep-amt" min="1000" step="1000" value="10000" aria-label="Amount"><button class="btn" data-act="deposit">Deposit</button><button class="btn" data-act="withdraw" ${deposit > 1 ? "" : "disabled"}>Withdraw</button></div>
    ${borrowable.map((x) => `<div class="row"><span>Truck ${myTrucks().indexOf(x.t) + 1}: borrow up to <span class="num">${fd(x.cap)}</span> FD</span><button class="btn" data-act="borrow" data-truck="${x.t.id}">Borrow</button></div>`).join("")}
    ${loans.map((l) => `<div class="row"><span>Loan on truck ${truckNo(l.truckId)}: <span class="num">${fd(l.principalFd)}</span> FD owed${l.missed ? ` · <span class="bad">${l.missed} missed</span>` : ""}</span><button class="btn" data-act="repay" data-loan="${l.id}" ${bal >= l.principalFd ? "" : "disabled"}>Repay</button></div>`).join("")}
  </div>`;
  let token: string;
  if (!live) {
    const daysLeft = GAME_CONFIG.token.betaYears * 365 - day;
    const miles = c.milesHistory.reduce((a, b) => a + b, 0) + c.milesTotal;
    const total = w.companies.reduce((s, x) => s + x.milesHistory.reduce((a, b) => a + b, 0) + x.milesTotal, 0) || 1;
    const share = Math.min(GAME_CONFIG.token.airdrop.capShare, miles / total) * GAME_CONFIG.token.airdrop.fd;
    token = `<div class="card"><h3>FD exchange · opens in ${daysLeft} days</h3>
      <p class="muted" style="font-size:14px">At the end of Year 2, FD launches on an FD/USDC pool. Your FD above working capital is burned and what you keep is locked for operating; your Miles become an airdrop that unlocks as you keep hauling.</p>
      <dl class="kv"><dt>Your Miles so far</dt><dd class="num">${fd(miles)} (${(100 * miles / total).toFixed(2)}% of all)</dd><dt>Airdrop at today's share</dt><dd class="num">≈ ${fd(share)} FD</dd></dl></div>`;
  } else {
    const price = fdPriceUsd(w);
    const hist = w.token.priceHistory.slice(-90);
    const a = c.airdrop;
    token = `<div class="card"><h3>FD exchange</h3>
      ${sparkline(hist, PAL.amber)}
      <dl class="kv"><dt>Price</dt><dd class="num">$${price.toFixed(5)} / FD (8-week avg $${averagePriceUsd(w, 56).toFixed(5)})</dd>
      <dt>Your dollars</dt><dd class="num">${usd(c.usd.wallet)} play $ · taken out ${usd(c.usd.out)}</dd>
      <dt>Sellable FD</dt><dd class="num">${fd(sellableFd(w, c))} (locked ${fd(c.lockedFd)})</dd>
      ${a ? `<dt>Airdrop</dt><dd class="num">${fd(a.unlockedFd)} of ${fd(a.totalFd)} unlocked${a.weeksLeft > 0 ? ` · ${a.weeksLeft} weeks left (3+ loads a week)` : ""}</dd>` : ""}</dl>
      <div class="row"><input type="number" id="buy-usd" min="1" step="1" value="10" aria-label="Dollars to spend"><button class="btn" data-act="buyfd" ${c.usd.wallet >= 1 ? "" : "disabled"}>Buy FD with $</button></div>
      <div class="row"><input type="number" id="sell-fd" min="100" step="100" value="${Math.max(100, Math.floor(sellableFd(w, c) / 2))}" aria-label="FD to sell"><button class="btn" data-act="sellfd" ${sellableFd(w, c) >= 100 ? "" : "disabled"}>Sell FD for $</button></div>
      ${a && a.weeksLeft > 0 && !a.claimedEarly ? `<div class="row"><button class="btn" data-act="claim">Claim the rest now at half</button></div>` : ""}
      <p class="muted" style="font-size:14px">Buying pays 1% to the treasury; selling burns 5% of the FD. Half the treasury's revenue buys FD back and burns it.</p></div>`;
  }
  const cashHist = feed().history.map((h) => h.cash);
  return `<div class="stack"><h2>Money</h2>
    <div class="card"><dl class="kv"><dt>Cash</dt><dd class="num ${bal < 0 ? "bad" : ""}">${fd(bal)} FD</dd><dt>Freight revenue</dt><dd class="num">${fd(c.operating.revenueFd)} FD</dd><dt>Operating costs</dt><dd class="num">${fd(c.operating.costFd)} FD</dd><dt>Fleet overhead paid</dt><dd class="num">${fd(c.overheadPaidFd)} FD</dd></dl>
    ${cashHist.length > 1 ? `<span class="label">Cash, last ${cashHist.length} days</span>${sparkline(cashHist, PAL.cyan)}` : ""}
    ${bal < 0 ? `<p class="bad">You're in the red. Four weekly checks more than 2,000 FD under and the company is liquidated.</p>` : ""}</div>
    ${token}${finance}</div>`;
}

function companyPanel(): string {
  const g = game!;
  const w = g.w;
  const c = g.player;
  const day = Math.floor(clockMin() / 1440);
  const lastDay = w.metrics.days.at(-1);
  const cyc = w.feeds.cycle(day);
  const miles = (x: Company) => x.milesHistory.reduce((a, b) => a + b, 0) + x.milesTotal;
  const worth = (x: Company) =>
    w.ledger.balance(companyAccount(x.id)) + w.trucksByCompany.get(x.id)!.reduce((s, t) => s + truckValue(w, t), 0);
  const carriers = w.companies.filter((x) => x.role === "carrier");
  const byWorth = [...w.companies].sort((a, b) => worth(b) - worth(a));
  const top = byWorth.slice(0, 8);
  if (c && !top.includes(c)) top.push(c);
  const humans = w.companies.filter(isHuman).sort((a, b) => worth(b) - worth(a));
  let mine = "";
  if (c) {
    const level = Math.min(w.cfg.reputation.maxLevel, Math.floor(Math.sqrt(c.delivered / w.cfg.reputation.loadsPerLevelSq)));
    const rankMiles = [...carriers].sort((a, b) => miles(b) - miles(a)).indexOf(c) + 1;
    mine = `<div class="card"><dl class="kv">
      <dt>Home hub</dt><dd>${esc(w.net.hubs[c.homeHub]!.name)}</dd>
      <dt>Loads delivered</dt><dd class="num">${Math.round(c.delivered)} · ${c.delivered ? pct(c.onTime / c.delivered) : "–"} on time</dd>
      <dt>Reputation</dt><dd class="num">${pct(c.reputation)} · level ${level}</dd>
      <dt>Miles</dt><dd class="num">${fd(miles(c))} · #${rankMiles} of ${carriers.length} carriers</dd>
      <dt>Net worth</dt><dd class="num">${fd(worth(c))} FD · #${byWorth.indexOf(c) + 1} of ${w.companies.length}</dd>
      <dt>Trucks</dt><dd class="num">${operatingTrucks(w, c.id)} running</dd>
    </dl></div>`;
  }
  const players =
    g.kind === "live"
      ? `<div class="card"><h3>Players in the world</h3>${
          humans.length
            ? `<table><tr><th>#</th><th>Company</th><th>Home</th><th>Worth</th></tr>${humans.map((x) => `<tr class="${x === c ? "you" : ""}"><td class="num">${byWorth.indexOf(x) + 1}</td><td>${esc(x.name)}</td><td>${w.net.hubs[x.homeHub]!.id}</td><td class="num">${fd(worth(x))}</td></tr>`).join("")}</table>`
            : `<p class="muted">Nobody has joined yet.</p>`
        }</div>`
      : "";
  const controls =
    g.kind === "test"
      ? `<div class="row"><button class="btn" data-act="testform">New test world</button>${live ? `<button class="btn" data-act="backlive">Back to the live world</button>` : ""}</div>`
      : platform.owner
        ? `<div class="row"><button class="btn" data-act="testform">Open a test world</button></div><p class="muted" style="font-size:14px">Only you see this. A test world is a private copy you can pause and speed up; the live world keeps running meanwhile.</p>`
        : "";
  return `<div class="stack"><h2>${c ? esc(c.name) : "The live world"}</h2>
    ${mine}
    ${c ? recordCard(c) : ""}
    ${c ? homeAndInsuranceCard(c) : ""}
    ${players}
    ${seasonCard(day)}
    <div class="card"><h3>Market report</h3><dl class="kv">
      <dt>Freight demand (Cass dial)</dt><dd class="num ${cyc > 1.1 ? "good" : cyc < 0.9 ? "bad" : ""}">${cyc.toFixed(2)} · ${cyc > 1.1 ? "boom" : cyc < 0.9 ? "slump" : "normal"}</dd>
      <dt>Average rate yesterday</dt><dd class="num">${lastDay ? lastDay.avgClearedRate.toFixed(2) : "–"} FD/mi</dd>
      <dt>Diesel</dt><dd class="num">${fuelPrice(w).toFixed(2)} FD/gal</dd>
      ${c ? `<dt>Your hub's load-to-truck</dt><dd class="num">${w.lastRatio[c.homeHub]!.toFixed(2)}</dd>` : ""}
      <dt>Loads cleared yesterday</dt><dd class="num">${lastDay ? `${lastDay.cleared} of ${lastDay.posted}` : "–"}</dd>
      <dt>Companies in liquidation</dt><dd class="num">${lastDay?.liquidating ?? 0}</dd>
    </dl></div>
    <div class="card"><h3>Biggest companies</h3><table><tr><th>#</th><th>Company</th><th>Worth</th></tr>
      ${top.map((x) => `<tr class="${x === c ? "you" : ""}"><td class="num">${byWorth.indexOf(x) + 1}</td><td>${esc(x.name)}${isHuman(x) && x !== c ? ' <span class="good">·player</span>' : ""}</td><td class="num">${fd(worth(x))}</td></tr>`).join("")}</table></div>
    ${controls}
  </div>`;
}

// --- Staff --------------------------------------------------------------------------

const starBar = (skill: number) => `<span class="stars" title="${Math.round(skill * 100)}% skill">${"★".repeat(stars(skill))}${"☆".repeat(5 - stars(skill))}</span>`;
const moraleWord = (m: number) => (m >= 0.65 ? "happy" : m >= 0.45 ? "settled" : m >= 0.3 ? "restless" : "unhappy");
const moraleClass = (m: number) => (m >= 0.45 ? "good" : m >= 0.3 ? "warn" : "bad");
const staffPay = (s: Staff, x: number) => (s.kind === "driver" ? `${x.toFixed(2)} FD/mi` : `${fd(x)} FD/wk`);
/** At a hub (or in the shop), where a crew can change. */
const atHub = (t: Truck) => t.status === "idle" || t.status === "parked" || t.status === "repair";

/** Who drives a truck, for its fleet card. */
function crewLine(t: Truck): string {
  const w = game!.w;
  if (!crewed(t)) return `<span class="bad">No driver: the truck can't run.</span>`;
  const d = w.staff[t.driverId - 1]!;
  const co = t.coDriverId ? w.staff[t.coDriverId - 1]! : null;
  const who = (s: Staff) => `${s.owner ? "You" : esc(s.name)} ${starBar(s.skill)}`;
  const defects = t.defects > 0 ? ` · <span class="warn">${t.defects} defect${t.defects > 1 ? "s" : ""}</span>` : "";
  return `Driver: ${who(d)}${co ? ` · team with ${who(co)}` : ""} · ${t.wagePerMile.toFixed(2)} FD/mi${defects}`;
}

/** Options for the player's trucks that pass `pick`, labelled by fleet number. */
function truckOptions(pick: (t: Truck) => boolean): string {
  return myTrucks()
    .map((t, i) => (pick(t) ? `<option value="${t.id}">Truck ${i + 1} · ${TRAILER_NAME[t.trailer]}</option>` : ""))
    .join("");
}

function staffPanel(): string {
  const w = game!.w;
  const c = me();
  const trucks = myTrucks();
  const operating = trucks.filter((t) => t.status !== "parked" && t.status !== "listed").length;
  const prof = dispatchProfile(w, c, operating);
  const team = w.staffByCompany.get(c.id) ?? [];
  const owner = team.find((s) => s.owner);
  const hired = team.filter((s) => !s.owner);
  const openSeat = (t: Truck) => !crewed(t) && atHub(t);
  const teamSeat = (t: Truck) => crewed(t) && t.coDriverId === 0 && atHub(t);

  const ownerCard = `<div class="card"><h3>You</h3><dl class="kv">
    <dt>Driving</dt><dd>${owner ? `${starBar(owner.skill)} · ${owner.truckId ? `truck ${truckNo(owner.truckId)}` : "not driving"} · ${fd(owner.experience + owner.pending)} mi driven` : "–"}</dd>
    <dt>Dispatching</dt><dd>${starBar(c.ownerDispatch.skill)} · ${Math.round(c.ownerDispatch.experience)} loads booked · you can run ${w.cfg.labor.owner.span} trucks</dd>
  </dl></div>`;

  const dispatchCard = `<div class="card"><h3>Dispatch</h3><dl class="kv">
    <dt>Coverage</dt><dd class="${prof.coverage < 1 ? "bad" : "good"}">${prof.span} trucks for the ${operating} you run${prof.coverage < 1 ? ` · about ${Math.round((1 - prof.coverage) * 100)}% of idle trucks sit out each round` : ""}</dd>
    <dt>Skill</dt><dd>${starBar(prof.skill)} · costs misread by ~${Math.round(prof.noise * 100)}% · ${prof.reloadWeight.toFixed(2)}× the reload run priced in · ${prof.foresightDays} days of season foresight</dd>
  </dl><p class="muted" style="font-size:14px">Your bids by hand aren't limited by any of this.</p>
    <label class="row"><input type="checkbox" id="autostaff" ${c.autoStaff ? "checked" : ""} data-act="autostaff"> Auto-staff: fill empty seats and hire or let go a dispatcher as the fleet changes</label></div>`;

  const offerLine = (s: Staff) => {
    if (!s.offer) return "";
    if (s.offer.companyId === 0) return `<p class="bad">Leaving once their truck is at a hub.</p>`;
    const from = w.companies[s.offer.companyId - 1]!;
    return `<div class="row"><span class="bad">${esc(from.name)} offered ${staffPay(s, s.offer.pay)}. They go unless you match.</span><button class="btn primary" data-act="setpay" data-staff="${s.id}" data-pay="${s.offer.pay}">Match</button></div>`;
  };
  const personCard = (s: Staff) => {
    const seat =
      s.kind === "dispatcher"
        ? `runs up to ${spanOf(w, s)} trucks`
        : s.truckId
          ? `truck ${truckNo(s.truckId)}${w.trucks[s.truckId - 1]!.coDriverId === s.id ? " (co-driver)" : ""}`
          : `<span class="bad">no truck</span>`;
    const seats = s.kind === "driver" ? truckOptions(openSeat) : "";
    const teams = s.kind === "driver" ? truckOptions((t) => teamSeat(t) && t.driverId !== s.id) : "";
    const record = s.violations || s.crashes ? ` · <span class="warn">${s.violations} violations, ${s.crashes} crashes on record</span>` : "";
    return `<div class="card">
      <div class="row"><b>${esc(s.name)}</b>${starBar(s.skill)}<span class="muted">${s.kind === "driver" ? "Driver" : "Dispatcher"}</span><span class="${moraleClass(s.morale)}">${moraleWord(s.morale)}</span></div>
      <p style="font-size:15px">${seat} · paid ${staffPay(s, s.pay)} · market ${staffPay(s, marketPay(w, s.kind, s.skill))}${record}</p>
      ${offerLine(s)}
      <div class="row"><input type="number" id="pay-${s.id}" step="${s.kind === "driver" ? "0.01" : "10"}" min="0" value="${s.kind === "driver" ? s.pay.toFixed(2) : Math.round(s.pay)}" aria-label="Pay"><button class="btn" data-act="setpay" data-staff="${s.id}">Set pay</button>
      ${seats ? `<select id="seat-${s.id}" aria-label="Truck to drive">${seats}</select><button class="btn" data-act="seat" data-staff="${s.id}">Drive it</button>` : ""}
      ${teams ? `<select id="team-${s.id}" aria-label="Truck to co-drive">${teams}</select><button class="btn" data-act="seat" data-staff="${s.id}" data-team="1">Co-drive</button>` : ""}
      <button class="btn" data-act="release" data-staff="${s.id}">Let go</button></div>
    </div>`;
  };

  // The pool, best value first: what they ask against what their skill saves.
  const value = (s: Staff) => askingPay(w, s) - (s.kind === "driver" ? 0.35 * s.skill : 0);
  const seatsOpen = truckOptions(openSeat);
  const poolRow = (s: Staff) => {
    const ask = askingPay(w, s);
    const driver = s.kind === "driver";
    const can = !driver || seatsOpen;
    return `<tr><td>${esc(s.name)}</td><td>${starBar(s.skill)}</td><td class="num">${staffPay(s, ask)}</td><td>${driver ? `${s.violations}/${s.crashes}` : `${spanOf(w, s)} trucks`}</td>
      <td>${can ? `${driver ? `<select id="hire-${s.id}" aria-label="Truck">${seatsOpen}</select>` : ""}<button class="btn" data-act="hire" data-staff="${s.id}" data-pay="${ask}">Hire</button>` : `<span class="muted">no open seat</span>`}</td></tr>`;
  };
  const poolDrivers = poolOf(w, "driver").sort((a, b) => value(a) - value(b) || a.id - b.id).slice(0, 10);
  const poolDispatchers = poolOf(w, "dispatcher").sort((a, b) => askingPay(w, a) / spanOf(w, a) - askingPay(w, b) / spanOf(w, b) || a.id - b.id).slice(0, 6);

  // Poaching: skilled people elsewhere, and what it would take to move them.
  const poachable = w.staff
    .filter((s) => s.status === "employed" && !s.owner && s.companyId !== c.id && s.skill >= 0.55 && !s.offer)
    .sort((a, b) => b.skill - a.skill || a.id - b.id)
    .slice(0, 8);
  const poachRow = (s: Staff) => {
    const needed = Math.max(askingPay(w, s), s.pay * (1 + w.cfg.labor.morale.loyalty[0] + (w.cfg.labor.morale.loyalty[1] - w.cfg.labor.morale.loyalty[0]) * s.morale));
    const driver = s.kind === "driver";
    const can = !driver || seatsOpen;
    return `<tr><td>${esc(s.name)}<br><span class="muted">${esc(w.companies[s.companyId - 1]!.name)}</span></td><td>${starBar(s.skill)}</td><td class="num">${staffPay(s, s.pay)}</td><td class="${moraleClass(s.morale)}">${moraleWord(s.morale)}</td>
      <td>${can ? `${driver ? `<select id="poach-${s.id}" aria-label="Truck">${seatsOpen}</select>` : ""}<button class="btn" data-act="poach" data-staff="${s.id}" data-pay="${needed}">Offer ${staffPay(s, needed)}</button>` : `<span class="muted">no open seat</span>`}</td></tr>`;
  };

  return `<div class="stack"><h2>Staff</h2>${pendingCard()}${ownerCard}${dispatchCard}
    ${hired.length ? hired.map(personCard).join("") : `<p class="muted">Nobody on the payroll yet. You drive your own truck and dispatch it yourself.</p>`}
    <div class="card"><h3>Hire a driver</h3><p class="muted" style="font-size:14px">Market pay rises with skill (wage index ${w.labor.wageIndex.toFixed(2)}). Drivers improve with every mile, and expect a raise as they do.</p>
      <table><tr><th>Name</th><th>Skill</th><th>Asks</th><th>Viol./crashes</th><th></th></tr>${poolDrivers.map(poolRow).join("")}</table></div>
    <div class="card"><h3>Hire a dispatcher</h3><p class="muted" style="font-size:14px">Pay is quoted for a full span and billed for the trucks they run past your own ${w.cfg.labor.owner.span}, with a quarter as a retainer.</p>
      <table><tr><th>Name</th><th>Skill</th><th>Asks</th><th>Runs</th><th></th></tr>${poolDispatchers.map(poolRow).join("")}</table></div>
    <div class="card"><h3>Hire away from other companies</h3><p class="muted" style="font-size:14px">Their employer gets ${w.cfg.labor.morale.noticeDays} days to match. Unhappy people come cheaper.</p>
      <table><tr><th>Name</th><th>Skill</th><th>Paid</th><th>Mood</th><th></th></tr>${poachable.map(poachRow).join("")}</table></div>
  </div>`;
}

// --- Home market and insurance ------------------------------------------------------------

const crowdWord = (r: number) => (r >= 1.5 ? "crowded" : r >= 1.1 ? "busy" : r >= 0.75 ? "fair share" : "wide open");

/** The company's authority, its safety record by area, and the policy its trucks run on. */
function recordCard(c: Company): string {
  const w = game!.w;
  const cfg = w.cfg;
  const day = Math.floor(clockMin() / 1440);
  const th = cfg.safety.score.thresholds;
  const m = c.safety.measures;
  const area = (k: Basic, name: string) => {
    const alert = c.safety.alerts.includes(k);
    return `<dt>${name}</dt><dd class="num ${alert ? "bad" : ""}">${m[k].toFixed(1)} of ${th[k]}${alert ? " · alert" : ""}</dd>`;
  };
  const a = c.authority;
  const authority =
    a.status === "active"
      ? `<span class="good">Active</span> since ${dateLabel(a.since)}`
      : a.status === "suspended"
        ? `<span class="bad">Suspended</span> until ${dateLabel(a.suspendedUntil ?? day)}`
        : a.barredUntil === null || a.barredUntil >= PERMANENT_BAR
          ? `<span class="bad">Revoked</span> · barred for good`
          : `<span class="bad">Revoked</span> · can file again ${dateLabel(a.barredUntil)}`;
  const claims = c.claims.filter((k) => k.until > day).length;
  const cases = w.cases.filter((k) => k.companyId === c.id && k.resolveDay > day).length;
  const history = a.record
    .slice(-4)
    .reverse()
    .map((r) => `<li>${dateLabel(r.day)}: ${esc(r.text)}</li>`)
    .join("");
  const p = c.policy;
  const opt = (v: string, cur: string, label: string) => `<option value="${v}" ${v === cur ? "selected" : ""}>${label}</option>`;
  const legalH = cfg.hos.drivingHoursPerDay;
  const overH = legalH + cfg.safety.hos.overHours;
  const fast = cfg.safety.speed.fastMph;
  return `<div class="card"><h3>Safety and authority</h3><dl class="kv">
      <dt>Authority</dt><dd>${authority}</dd>
      <dt>Rating</dt><dd>${ratingLabel(c)}${c.safety.reviewDay !== null ? ` · review ${dateLabel(c.safety.reviewDay)}` : ""}</dd>
      ${area("hos", "Hours of service")}${area("unsafe", "Unsafe driving")}${area("maintenance", "Vehicle maintenance")}${area("crash", "Crashes per truck")}
      <dt>Fines paid</dt><dd class="num">${fd(c.safety.finesFd)} FD${c.safety.outOfService ? ` · ${c.safety.outOfService} out-of-service order${c.safety.outOfService > 1 ? "s" : ""}` : ""}</dd>
      ${claims || cases ? `<dt>Claims</dt><dd class="bad">${claims} on your record${cases ? ` · ${cases} under investigation` : ""}</dd>` : ""}
    </dl>${history ? `<ul class="muted" style="font-size:14px">${history}</ul>` : ""}
    <h3>Policy</h3>
    <div class="row"><label class="label" for="pol-hos">Driving hours</label><select id="pol-hos">${opt("legal", p.hos, `Legal: ${legalH} h a day`)}${opt("hot", p.hos, `${overH} h on hot loads`)}${opt("always", p.hos, `${overH} h every day`)}</select></div>
    <div class="row"><label class="label" for="pol-speed">Speed</label><select id="pol-speed">${opt("legal", p.speed, `Legal pace`)}${opt("hot", p.speed, `${fast} mph on hot loads`)}${opt("always", p.speed, `${fast} mph always`)}</select></div>
    <div class="row"><label class="label" for="pol-maint">Maintenance</label><select id="pol-maint">${opt("full", p.maintenance, "Full")}${opt("deferred", p.maintenance, `Deferred: ${pct(1 - cfg.safety.maintenance.deferredCostMult)} cheaper, defects build up`)}</select></div>
    <div class="row"><button class="btn primary" data-act="policy">Set policy</button></div>
    <p class="muted" style="font-size:14px">What inspectors find, and what a crash turns up, goes on the record above. The AI companies choose from the same options.</p>
  </div>`;
}

function homeAndInsuranceCard(c: Company): string {
  const w = game!.w;
  const hub = w.net.hubs[c.homeHub]!;
  const r = homeCrowding(w)[c.homeHub]!;
  const p = c.insurance;
  return `<div class="card"><h3>Home market: ${esc(hub.name)}</h3><dl class="kv">
      <dt>Carriers based here</dt><dd>${r.toFixed(2)}× its fair share by freight · ${crowdWord(r)}</dd>
      <dt>Local edge</dt><dd class="num">+${(homeEdge(w, c, c.homeHub) * 100).toFixed(1)} bid-score points on loads within ${w.cfg.map.nearbyRadiusMi} mi of home</dd>
      <dt>Yard rent</dt><dd class="num">${fd(yardPerTruck(w, c))} FD a week for each truck past your first</dd>
    </dl></div>
    <div class="card"><h3>Insurance</h3><dl class="kv">
      <dt>Policy</dt><dd class="num">${fd(p.annualPerTruck)} FD per truck a year (${fd(p.annualPerTruck / 52)} a week), renews ${dateLabel(p.renewDay)}</dd>
      <dt>Priced from</dt><dd>your record ×${p.risk.toFixed(2)} · ${esc(hub.id)} garaging ×${p.garaging.toFixed(2)} · market ×${p.market.toFixed(2)}</dd>
      <dt>Insurance market</dt><dd>index ×${w.insuranceMarket.index.toFixed(2)} · insurers paid out ${pct(lossRatio(w))} of premiums this year</dd>
    </dl><p class="muted" style="font-size:14px">The price holds for the year. A serious at-fault crash, or a review that changes your rating, gets the policy re-written on the spot.</p></div>`;
}

/** Each starter hub as a home base: freight balance, insurance, yard rent and (in a running world) how crowded it is. */
function hubChoiceTable(w: World | null): string {
  const arrow = (x: number) => (x >= 1.15 ? `<span class="good">strong</span>` : x <= 0.75 ? `<span class="bad">weak</span>` : "even");
  const cfg = GAME_CONFIG;
  const rows = HUBS.filter((h) => h.isStarter).map((h) => {
    const i = HUBS.indexOf(h);
    const metro = cfg.homeBase.yardTier[0] + cfg.homeBase.yardTier[1] * h.weight;
    const r = w ? homeCrowding(w)[i]! : 1;
    const yard = cfg.homeBase.yardPerTruckWeek * metro * Math.min(cfg.homeBase.yardCrowdClamp[1], Math.max(cfg.homeBase.yardCrowdClamp[0], r));
    return `<tr><td>${esc(h.name)}</td><td>${arrow(h.imbalance.van)} / ${arrow(h.imbalance.reefer)} / ${arrow(h.imbalance.flatbed)}</td><td class="num">×${garagingOf(h.id).toFixed(2)}</td><td class="num">${fd(yard)}</td>${w ? `<td>${crowdWord(r)}</td>` : ""}</tr>`;
  });
  return `<table><tr><th>Hub</th><th>Outbound van / reefer / flatbed</th><th>Insurance</th><th>Yard FD/wk per extra truck</th>${w ? "<th>Carriers</th>" : ""}</tr>${rows.join("")}</table>
    <p class="muted" style="font-size:14px">Strong outbound means plenty of freight to reload on; weak means trucks pile up and outbound pays little (inbound pays more). Local shippers favor carriers based nearby, an edge that shrinks the more carriers share the hub.</p>`;
}

// --- Guide ------------------------------------------------------------------------------

let guidePage = "start";

const DOCS_URL = TEST_BUILD ? "docs.html" : "https://truckingterminal.github.io/lanes-play/docs.html";

function guidePanel(): string {
  const pages = guidePages(GAME_CONFIG);
  const page = pages.find((p) => p.id === guidePage) ?? pages[0]!;
  const sections = [...new Set(pages.map((p) => p.section))];
  const nav = sections
    .map(
      (s) =>
        `<div class="guidenav"><span class="label">${esc(s)}</span>${pages
          .filter((p) => p.section === s)
          .map((p) => `<button class="btn ${p.id === page.id ? "on" : ""}" data-act="guide" data-page="${p.id}">${esc(p.title)}</button>`)
          .join("")}</div>`,
    )
    .join("");
  const i = pages.indexOf(page);
  const step = (p: (typeof pages)[number] | undefined, label: string) => (p ? `<button class="btn" data-act="guide" data-page="${p.id}">${label}: ${esc(p.title)}</button>` : "");
  return `<div class="stack"><h2>Guide</h2>
    <div class="card guide"><span class="label">${esc(page.section)}</span><h3>${esc(page.title)}</h3>${page.html}
      <div class="row">${step(pages[i - 1], "Back")}${step(pages[i + 1], "Next")}</div></div>
    ${nav}
    <p class="muted" style="font-size:14px">Every page, on one screen: <a href="${DOCS_URL}" target="_blank" rel="noopener">the LANES docs</a>.</p></div>`;
}

// --- Input ---------------------------------------------------------------------------

/**
 * Gives an order. In a test world it happens at once; in the live world it's sent
 * to everyone and takes effect half a minute later, at the same moment on every page.
 */
function act(a: Action, ok: string): void {
  const g = game!;
  panelDirty = true;
  if (g.kind === "test") {
    const r = g.act(a);
    persistTest(true);
    if (r.ok) toast(ok);
    else toast(r.reason.charAt(0).toUpperCase() + r.reason.slice(1), true);
    return;
  }
  if (!g.writer) {
    toast("This tab is only watching.", true);
    return;
  }
  g.submit(a).then(
    (r) => {
      okText.set(r.s, ok);
      toast(`Sent: ${describe(a)}. In effect at ${hhmm(r.at)} (${realUntil(g.msUntil(r.at))}).`);
      panelDirty = true;
    },
    (e: unknown) => toast(`Couldn't send that order: ${(e as { message?: string })?.message ?? "the store refused it"}`, true),
  );
}
const num = (id: string) => Number($<HTMLInputElement>(id)?.value);

// Full screen, where the browser lets the page ask for it (Safari still uses the webkit names).
const fsEnabled = () => Boolean(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled);
const fsActive = () => Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
function toggleFullscreen(): void {
  const d = document as any;
  const el = document.documentElement as any;
  const p = fsActive() ? (document.exitFullscreen?.() ?? d.webkitExitFullscreen?.()) : (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
  Promise.resolve(p).catch(() => toast("The browser didn't allow full screen here. Use its own full-screen view instead.", true));
}

function openTest(name: string, start: StartKind, hub: string): void {
  test = new TestGame(name, start, hub);
  const t = test;
  t.onEvent((e) => onEvent(t, e));
  speed = 1;
  acc = 0;
  showGame(t);
  persistTest(true);
  toast("Test world open. Pause and speed up from the top bar.");
}

// --- The test build's world, kept in this browser -------------------------------------

const TEST_KEY = "lanes.testworld.v1";
let persistedAt = 0;
let persistedT = -1;
let persistedActs = -1;

/** Writes the test world's log when it has changed, at most every few seconds unless forced. */
function persistTest(force = false): void {
  if (!TEST_BUILD || !test) return;
  const log = test.log;
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

/** The stored test world, or "stale" when it was played under rules this build no longer runs. */
function readTest(): TestLog | "stale" | null {
  try {
    const raw = localStorage.getItem(TEST_KEY);
    const log = raw ? (JSON.parse(raw) as TestLog) : null;
    if (!log || log.v !== 1 || !Number.isInteger(log.seed) || !Array.isArray(log.acts)) return null;
    return log.ruleset === RULESET ? log : "stale";
  } catch {
    return null;
  }
}

async function bootTest(): Promise<void> {
  platform = { db: null, uid: null, owner: true, local: true };
  document.querySelector(".tagline")!.textContent = "Test build: the full game against the AI, with pause and speed controls.";
  const log = readTest();
  if (!log || log === "stale") {
    showTitle(testMenu());
    if (log === "stale") toast("The rules changed since your last visit (staff, safety and fraud are in), so your old test world can't be replayed. Start a new one.");
    return;
  }
  showLoading("Loading your test world", "Replaying its history in this browser.");
  let t: TestGame;
  try {
    if (!log.acts.every((x) => Array.isArray(x) && Number.isFinite(x[0]) && x[1] && typeof x[1] === "object")) throw new Error("bad log");
    t = await TestGame.restore(log, (share) => ($("loadbar").style.width = `${Math.round(share * 100)}%`));
  } catch {
    showTitle(testMenu());
    toast("Your saved test world couldn't be replayed, so it was set aside. Start a new one.", true);
    return;
  }
  test = t;
  t.onEvent((e) => onEvent(t, e));
  persistedT = t.log.t;
  persistedActs = t.log.acts.length;
  speed = 0;
  showGame(t);
  toast("Welcome back. The clock is paused; press ▶ or 1–3 to run it.");
}


function backToLive(): void {
  test = null;
  if (live) {
    if (live.player || !live.writer) showGame(live);
    else showTitle(joinMenu());
  } else void boot();
}

/** Selects your truck under the pointer, else the nearest hub. */
function selectOnMap(ev: { clientX: number; clientY: number }): void {
  const [x, y] = mapPoint(ev);
  let best: Truck | null = null;
  let bd = 5 / zoom();
  for (const t of myTrucks()) {
    const p = truckPoint(t);
    if (!p) continue;
    const d = Math.hypot(p[0] - x, p[1] - y);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  if (best) {
    selTruck = best.id;
    tab = best.status === "idle" ? "loads" : "fleet";
  } else {
    const h = nearestHub(x, y);
    selHub = h;
    if (h !== null) tab = "loads";
  }
  renderTabs();
  panelDirty = true;
}

function showHubTip(ev: { clientX: number; clientY: number }): void {
  const [x, y] = mapPoint(ev);
  const h = nearestHub(x, y);
  const tip = $("tip");
  if (h === null) {
    tip.hidden = true;
    return;
  }
  const hub = game!.w.net.hubs[h]!;
  const day = Math.floor(clockMin() / 1440);
  const season = (["reefer", "van", "flatbed"] as Equipment[]).map((eq) => `${TRAILER_NAME[eq].toLowerCase()} ${signedPct(seasonality(game!.w, h, eq, day).rate - 1)}`).join(", ");
  const eq: Equipment = myTrucks().find((t) => t.id === selTruck)?.trailer ?? "van";
  tip.textContent = `${hub.name} (${hub.id}) · ${openLoadsAt(h).length} open loads · ${TRAILER_NAME[eq].toLowerCase()} reload ${reloadLabel(h, eq)} · season: ${season}`;
  tip.hidden = false;
  const wrap = $("mapwrap").getBoundingClientRect();
  tip.style.left = `${Math.min(wrap.width - 260, Math.max(4, ev.clientX - wrap.left + 12))}px`;
  tip.style.top = `${Math.max(4, ev.clientY - wrap.top - 34)}px`;
}

function wireInput(): void {
  document.addEventListener("submit", (ev) => {
    const form = ev.target as HTMLFormElement;
    if (form.id === "joinform") {
      ev.preventDefault();
      const name = ($<HTMLInputElement>("cname").value.trim() || "Lone Star Freight").slice(0, 32);
      const hub = $<HTMLSelectElement>("chub").value;
      const lw = live!;
      lw.submit({ type: "join", name, hub }).then(
        (r) => {
          showGame(lw);
          toast(`Registering ${name}. Your truck is ready at ${hhmm(r.at)}, in ${realUntil(lw.msUntil(r.at))}.`);
        },
        (e: unknown) => toast(`Couldn't join: ${(e as { message?: string })?.message ?? "the store refused it"}`, true),
      );
    }
    if (form.id === "testform") {
      ev.preventDefault();
      const name = ($<HTMLInputElement>("tname").value.trim() || "Test Freight").slice(0, 32);
      const start = (document.querySelector('input[name="start"]:checked') as HTMLInputElement).value as StartKind;
      openTest(name, start, $<HTMLSelectElement>("thub").value);
    }
  });
  document.addEventListener("click", (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>("[data-speed],[data-tab],[data-act],[data-select]");
    if (!el) return;
    // Title-screen buttons work before any world is on screen.
    switch (el.dataset.act) {
      case "fullscreen":
        toggleFullscreen();
        return;
      case "openworld": {
        const db = platform.db!;
        void createMeta(db).then(
          (m) => enterLive(m),
          () => toast("Couldn't open the world: the store refused the write.", true),
        );
        return;
      }
      case "testform":
        if (platform.owner) showTitle(testMenu());
        return;
      case "backlive":
        backToLive();
        return;
      case "backtest":
        if (test) showGame(test);
        return;
      case "takeover":
        void live?.retakeLease().then((ok) => {
          toast(ok ? "This tab now runs your company." : "Your company is still open somewhere else.", !ok);
          if (ok && live && !live.player && !live.isPlayer(platform.uid ?? "")) showTitle(joinMenu());
          panelDirty = true;
        });
        return;
    }
    if (!game) return;
    if (el.dataset.speed) {
      if (game.kind === "test") speed = Number(el.dataset.speed);
      return;
    }
    if (el.dataset.tab) {
      tab = el.dataset.tab as Tab;
      renderTabs();
      panelDirty = true;
      return;
    }
    if (el.dataset.select && !el.dataset.act) {
      // Truck chips on the load board; clicks on a fleet card's body are handled below.
      if (el.tagName === "BUTTON") {
        selTruck = Number(el.dataset.select);
        panelDirty = true;
      }
      return;
    }
    const truck = Number(el.dataset.truck);
    const w = game.w;
    switch (el.dataset.act) {
      case "findloads":
        selTruck = truck;
        tab = "loads";
        renderTabs();
        panelDirty = true;
        break;
      case "sendto":
        act({ type: "reposition_truck", truckId: truck, hubId: el.dataset.hub! }, `Truck heading empty to ${el.dataset.hub}`);
        break;
      case "send": {
        const hubId = $<HTMLSelectElement>(`send-${truck}`).value;
        act({ type: "reposition_truck", truckId: truck, hubId }, `Truck heading empty to ${hubId}`);
        break;
      }
      case "rebuild":
        act({ type: "rebuild_truck", truckId: truck }, "Truck is in the shop for two days");
        break;
      case "park":
        act({ type: "park_truck", truckId: truck }, "Truck parked");
        break;
      case "unpark":
        act({ type: "unpark_truck", truckId: truck }, "Truck back on the road");
        break;
      case "sell": {
        const t = w.trucks[truck - 1]!;
        const value = truckValue(w, t);
        act({ type: "list_truck", truckId: truck, askFd: value, floorFd: value * 0.6, stepFd: value * 0.05 }, `Listed at ${fd(value)} FD; the price drops 5% a week until it sells`);
        break;
      }
      case "return":
        act({ type: "return_lease", truckId: truck }, "Lease returned");
        break;
      case "bid": {
        const loadId = Number(el.dataset.load);
        const rate = num(`bid-${loadId}`);
        act({ type: "place_bid", truckId: truck, loadId, rate }, `Bid in at ${rate.toFixed(2)}/mi. It clears at ${nextRoundLabel()}`);
        break;
      }
      case "cancelbid":
        act({ type: "cancel_bid", truckId: truck }, "Bid withdrawn");
        break;
      case "orders": {
        const mode = $<HTMLSelectElement>("o-mode").value as "breakEvenPlus" | "ceilingPct";
        const orders: StandingOrder[] = [
          { kind: "bid", maxDeadheadMi: Math.max(0, Math.min(150, num("o-dh"))), price: { mode, pct: Math.max(0, num("o-pct")) / 100 } },
          { kind: "floor", breakEvenPlusPct: Math.max(0, num("o-floor")) / 100 },
        ];
        if ($<HTMLInputElement>("o-repo").checked) orders.push({ kind: "reposition", afterIdleRounds: Math.max(1, num("o-repo-r")), to: { openLoadsWithinMi: 400 } });
        if ($<HTMLInputElement>("o-rb").checked)
          orders.push({ kind: "rebroker", share: Math.min(1, Math.max(0, num("o-rb-share") / 100 || 0)), keepPct: Math.min(0.9, Math.max(0, num("o-rb-keep") / 100 || 0)), pays: $<HTMLInputElement>("o-rb-pays").checked });
        act({ type: "set_standing_orders", orders }, "Dispatcher updated");
        break;
      }
      case "rebroker":
        act({ type: "rebroker_load", loadId: Number(el.dataset.load), rate: num(`rb-${truck}`), pay: $<HTMLInputElement>(`rbpay-${truck}`).checked }, "Load re-posted. The truck is free where it stands");
        break;
      case "steal":
        if (confirm("Steal this load? Police will investigate, and a theft claim stays on your record for a year.")) act({ type: "steal_load", truckId: truck }, "The load won't be delivered. The truck runs on empty to where it was going");
        break;
      case "policy":
        act(
          {
            type: "set_compliance",
            policy: { hos: $<HTMLSelectElement>("pol-hos").value as CompliancePolicy["hos"], speed: $<HTMLSelectElement>("pol-speed").value as CompliancePolicy["speed"], maintenance: $<HTMLSelectElement>("pol-maint").value as CompliancePolicy["maintenance"] },
          },
          "Policy set",
        );
        break;
      case "ordersReset":
        act({ type: "set_standing_orders", orders: DEFAULT_ORDERS }, "Dispatcher back to defaults");
        break;
      case "buynew": {
        const onLease = myTrucks().some((t) => t.lease === "npc");
        act(
          { type: "buy_asset", tier: el.dataset.tier as TractorTier, trailer: el.dataset.trailer as Equipment, replaceNpcLease: onLease },
          `Ordered. Delivery in ${deliveryDays(w)} days`,
        );
        break;
      }
      case "buyused":
        act({ type: "buy_listing", listingId: Number(el.dataset.listing) }, "Bought. It's yours, idle where it stands");
        break;
      case "lease":
        act({ type: "lease_truck", trailer: el.dataset.trailer as Equipment }, "Leased truck ready at your home hub");
        break;
      case "facility":
        act({ type: "buy_facility", facility: el.dataset.type as FacilityType, hubId: el.dataset.hub! }, `${FAC_NAME[el.dataset.type as FacilityType]} open at ${el.dataset.hub}`);
        break;
      case "deposit":
        act({ type: "deposit_finance", amountFd: num("dep-amt") }, "Deposited");
        break;
      case "withdraw":
        act({ type: "withdraw_finance", amountFd: num("dep-amt") }, "Withdrawn");
        break;
      case "borrow": {
        const t = w.trucks[truck - 1]!;
        act({ type: "borrow", truckId: truck, amountFd: Math.floor(borrowingCapacity(w, t)) }, "Loan funded");
        break;
      }
      case "repay":
        act({ type: "repay_loan", loanId: Number(el.dataset.loan) }, "Loan repaid");
        break;
      case "buyfd":
        act({ type: "buy_fd", usd: num("buy-usd") }, "FD bought");
        break;
      case "sellfd":
        act({ type: "sell_fd", fd: num("sell-fd") }, "FD sold");
        break;
      case "claim":
        act({ type: "claim_airdrop_now" }, "Airdrop claimed at half");
        break;
      case "guide":
        ev.preventDefault();
        guidePage = el.dataset.page ?? "start";
        panelDirty = true;
        $("panel").scrollTop = 0;
        break;
      case "tostaff":
        tab = "staff";
        renderTabs();
        panelDirty = true;
        break;
      case "fix":
        act({ type: "fix_defects", truckId: truck }, "Defects fixed");
        break;
      case "autostaff":
        act({ type: "set_auto_staff", on: $<HTMLInputElement>("autostaff").checked }, $<HTMLInputElement>("autostaff").checked ? "Auto-staff on" : "Auto-staff off");
        break;
      case "setpay": {
        const id = Number(el.dataset.staff);
        const s = w.staff[id - 1];
        const pay = Math.min(s?.kind === "driver" ? 20 : 50_000, Math.max(0.01, el.dataset.pay ? Number(el.dataset.pay) : num(`pay-${id}`)));
        act({ type: "set_staff_pay", staffId: id, pay }, "Pay changed");
        break;
      }
      case "seat": {
        const id = Number(el.dataset.staff);
        const team = el.dataset.team === "1";
        const truckId = Number($<HTMLSelectElement>(`${team ? "team" : "seat"}-${id}`).value);
        act({ type: "assign_driver", staffId: id, truckId, team }, team ? "Co-driver seated: the truck runs as a team" : "Driver seated");
        break;
      }
      case "release":
        act({ type: "release_staff", staffId: Number(el.dataset.staff) }, "Let go");
        break;
      case "hire":
      case "poach": {
        const id = Number(el.dataset.staff);
        const sel = document.getElementById(`${el.dataset.act}-${id}`) as HTMLSelectElement | null;
        act(
          { type: "offer_staff", staffId: id, pay: Number(el.dataset.pay), truckId: sel ? Number(sel.value) : undefined },
          el.dataset.act === "hire" ? "Hired" : "Offer made: their employer has two days to match",
        );
        break;
      }
    }
  });
  // Selecting a truck card by clicking its body.
  $("panel").addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest("button,select,input,label")) return;
    const c = t.closest<HTMLElement>("[data-select]");
    if (c && game) {
      selTruck = Number(c.dataset.select);
      panelDirty = true;
      const truck = myTrucks().find((x) => x.id === selTruck);
      const p = truck && zoomIdx > 0 ? truckPoint(truck) : null;
      if (p) centerOn(p[0], p[1]);
    }
  });
  const cv = $<HTMLCanvasElement>("map");
  // A tap or click selects; a drag pans once zoomed in; two fingers pinch to zoom.
  const pointers = new Map<number, { x: number; y: number }>();
  let drag: { x: number; y: number; panX: number; panY: number; moved: boolean } | null = null;
  let pinch: { dist: number; idx: number } | null = null;
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1;
  };
  cv.addEventListener("pointerdown", (ev) => {
    if (!game) return;
    cv.setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 1) drag = { x: ev.clientX, y: ev.clientY, panX, panY, moved: false };
    if (pointers.size === 2) {
      pinch = { dist: spread(), idx: zoomIdx };
      drag = null;
    }
  });
  cv.addEventListener("pointermove", (ev) => {
    if (!game) return;
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const [cx, cy] = canvasPoint({ clientX: (a!.x + b!.x) / 2, clientY: (a!.y + b!.y) / 2 });
      setZoom(pinch.idx + Math.round(Math.log(spread() / pinch.dist) / Math.log(1.6)), cx, cy);
      return;
    }
    if (drag) {
      const r = cv.getBoundingClientRect();
      const dx = ev.clientX - drag.x;
      const dy = ev.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved && zoomIdx > 0) {
        panX = drag.panX - dx * (cv.width / r.width);
        panY = drag.panY - dy * (cv.height / r.height);
        clampPan();
        cv.style.cursor = "grabbing";
        $("tip").hidden = true;
      }
      return;
    }
    if (ev.pointerType === "mouse") showHubTip(ev);
  });
  const release = (ev: PointerEvent) => {
    const tap = drag && !drag.moved && ev.type === "pointerup";
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) drag = null;
    if (tap) selectOnMap(ev);
    renderZoomUi();
  };
  cv.addEventListener("pointerup", release);
  cv.addEventListener("pointercancel", release);
  cv.addEventListener("mouseleave", () => ($("tip").hidden = true));
  // The wheel and trackpad pinch zoom toward the cursor; small trackpad deltas add up to one step.
  let wheel = 0;
  cv.addEventListener(
    "wheel",
    (ev) => {
      if (!game) return;
      ev.preventDefault();
      wheel += ev.deltaY * (ev.deltaMode === 1 ? 33 : 1);
      if (Math.abs(wheel) < 80) return;
      setZoom(zoomIdx + (wheel < 0 ? 1 : -1), ...canvasPoint(ev));
      wheel = 0;
    },
    { passive: false },
  );
  cv.addEventListener("dblclick", (ev) => game && setZoom(zoomIdx + 1, ...canvasPoint(ev)));
  $("zoomin").addEventListener("click", () => setZoom(zoomIdx + 1));
  $("zoomout").addEventListener("click", () => setZoom(zoomIdx - 1));
  $("zoomfit").addEventListener("click", () => setZoom(0));
  new ResizeObserver(() => game && fitMap()).observe($("mapwrap"));
  addEventListener("resize", () => game && fitMap());
  addEventListener("pagehide", () => persistTest(true));
  document.addEventListener("visibilitychange", () => document.hidden && persistTest(true));
  document.addEventListener("fullscreenchange", () => game && fitMap());
  document.addEventListener("webkitfullscreenchange", () => game && fitMap());
  // F toggles full screen and + - 0 zoom the map anywhere; in the test world only, space pauses and 1–3 set the speed.
  document.addEventListener("keydown", (ev) => {
    if ((ev.target as HTMLElement).closest("input,select,textarea")) return;
    if ((ev.key === "f" || ev.key === "F") && game && fsEnabled()) toggleFullscreen();
    if (game && (ev.key === "+" || ev.key === "=")) setZoom(zoomIdx + 1);
    if (game && (ev.key === "-" || ev.key === "_")) setZoom(zoomIdx - 1);
    if (game && ev.key === "0") setZoom(0);
    if (game?.kind !== "test") return;
    if (ev.key === " ") {
      speed = speed === 0 ? 1 : 0;
      ev.preventDefault();
    }
    if (ev.key >= "1" && ev.key <= "3") speed = Number(ev.key);
  });
}

// ---------------------------------------------------------------------------
// Boot. There's nothing to restore on a live update: the world is in the store.
// ---------------------------------------------------------------------------

const hot = (window as any).claude?.hot;
if (hot?.ready) hot.ready(() => void boot());
else void boot();
