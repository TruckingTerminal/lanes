import type { Equipment, FacilityType, TractorTier } from "@lanes/config";
import {
  availableSupply,
  averagePriceUsd,
  borrowingCapacity,
  breakEvenPerMile,
  companyAccount,
  condition,
  deliveryDays,
  depositorValue,
  facilityOutlook,
  fdPriceUsd,
  fuelPrice,
  hubMiles,
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
  tokenLive,
  type Action,
  type Company,
  type GameEvent,
  type Load,
  type StandingOrder,
  type Truck,
} from "@lanes/engine";
import { hubs as HUBS } from "@lanes/data";
import { drawTitleScene, facilityUrl, iconUrl, PAL, truckUrl } from "./art.js";
import { DEFAULT_ORDERS, GAME_CONFIG, isHuman, RULESET, TestGame, type StartKind, type TestLog } from "./game.js";
import { createMeta, LiveWorld, readMeta, type DbLike, type LiveAction, type WorldMeta } from "./live.js";
import { buildMap, MAP_H, MAP_W, nightShade, type MapArt } from "./map.js";
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
type Tab = "fleet" | "loads" | "market" | "money" | "company";
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
    meta = null;
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
  art ??= buildMap(s.w.net.hubs, (a, b) => hubMiles(s.w, a, b));
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
    observe(game);
    drawMap(now);
    renderHud();
    const refreshEvery = 1000;
    if (panelDirty || now - lastPanelAt > refreshEvery) {
      if (!(document.activeElement && $("panel").contains(document.activeElement) && document.activeElement.tagName !== "BUTTON")) {
        renderPanel();
        lastPanelAt = now;
        panelDirty = false;
      }
    }
    renderTicker();
  }
  schedule();
}

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
  let total = hubMiles(w, t.hub, t.targetHub);
  if (t.status === "loaded" && t.loadId !== null) total = w.loads.get(t.loadId)?.miles ?? total;
  // The engine moves trucks hour by hour; between hours, a truck still on the clock keeps rolling on screen.
  const { hos } = w.cfg;
  const rolling = t.dwellMin <= 0 && t.breakdownMin <= 0 && t.shiftDrivenMin < hos.drivingHoursPerDay * 60;
  const ahead = rolling ? (Math.min(60, clockMin() - w.t) / 60) * hos.avgMph : 0;
  const left = Math.max(0, t.remainingMi - ahead);
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
  const badge =
    g.kind === "test"
      ? `<span class="badge test" title="A private test world: nothing here is stored">TEST WORLD</span><div class="speeds" role="group" aria-label="Test world speed">${SPEEDS.map((sp, i) => `<button class="btn ${i === speed ? "on" : ""}" data-speed="${i}" title="${esc(sp.title)}" aria-pressed="${i === speed}">${sp.label}</button>`).join("")}</div>${live ? `<button class="btn" data-act="backlive">Back to the live world</button>` : ""}`
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
  if (g.kind === "live") stats += `<span class="label" title="Human players in the live world">${w.companies.filter(isHuman).length} players</span>`;
  if (fsEnabled()) stats += `<button class="btn" data-act="fullscreen" title="Full screen (F)">${fsActive() ? "Exit full screen" : "Full screen"}</button>`;
  const html = `
    <div class="clock">${img(iconUrl("clock", 2), "Clock")}<span class="num">${dateLabel(day)} · ${hhmm(minute)}</span>${badge}</div>
    <div class="stats">${stats}</div>`;
  const hud = $("hud");
  if (hud.dataset.html !== html) {
    hud.innerHTML = html;
    hud.dataset.html = html;
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
    ["market", "Dealer"],
    ["money", "Money"],
    ["company", "Company"],
  ];
  $("tabs").innerHTML = tabs.map(([k, l]) => `<button class="btn ${k === tab ? "on" : ""}" data-tab="${k}" aria-pressed="${k === tab}">${l}</button>`).join("");
}

// --- Panels -------------------------------------------------------------------------

function renderPanel(): void {
  const p = $("panel");
  const html = !game!.player && tab !== "company" ? watchPanel() : tab === "fleet" ? fleetPanel() : tab === "loads" ? loadsPanel() : tab === "market" ? marketPanel() : tab === "money" ? moneyPanel() : companyPanel();
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

function statusLine(t: Truck): string {
  const w = game!.w;
  const hub = (i: number) => esc(w.net.hubs[i]!.name);
  switch (t.status) {
    case "idle": {
      const bid = w.manualBids.get(t.id);
      return `Idle at ${hub(t.hub)}${bid ? ` · <span class="good">your bid ${bid.rate.toFixed(2)}/mi is in</span>` : ""}`;
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
      return `In the shop for a rebuild`;
    case "parked":
      return `Parked at ${hub(t.hub)} (off the road, 50 FD/day idle fee)`;
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
      const kind = t.lease === "npc" ? "NPC lease (15% of gross)" : t.lease === "lessor" ? "Extra lease (15% of gross, 250 FD/wk minimum)" : `Owned · worth ${fd(marketValue(w.cfg, t, today))} FD`;
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
      return `<div class="card ${t.id === selTruck ? "sel" : ""}" data-select="${t.id}">
        <div class="truckhead">${img(truckUrl(t.tier, t.trailer, leased, PAL.cyan, 2), `${TIER_NAME[t.tier]} with ${TRAILER_NAME[t.trailer]}`)}
          <div><h3>Truck ${idx + 1} · ${TIER_NAME[t.tier]}</h3><p class="muted">${TRAILER_NAME[t.trailer]} · ${kind}</p></div></div>
        <p>${statusLine(t)}</p>
        <div class="row"><span class="label">Condition</span><span class="bar"><i style="width:${Math.round(cond * 100)}%;background:${cond > 0.6 ? PAL.lime : cond > 0.35 ? PAL.amber : PAL.red}"></i></span><span class="num">${pct(cond)}</span><span class="label">Odometer</span><span class="num">${Math.round(t.odometer).toLocaleString("en-US")} mi</span></div>
        ${actions.length ? `<div class="row">${actions.join("")}</div>` : ""}
      </div>`;
    })
    .join("");
  const orders = pending.length
    ? `<p class="muted">On order: ${pending.map((o) => `${TIER_NAME[o.tier]} + ${TRAILER_NAME[o.trailer]}, arrives ${dateLabel(o.dueDay)}`).join("; ")}</p>`
    : "";
  return `<div class="stack"><h2>Your fleet</h2>${pendingCard()}${orders}${cards}${dispatcherCard()}</div>`;
}

function dispatcherCard(): string {
  const c = me();
  const bid = c.orders.find((o) => o.kind === "bid") as Extract<StandingOrder, { kind: "bid" }> | undefined;
  const floor = c.orders.find((o) => o.kind === "floor") as Extract<StandingOrder, { kind: "floor" }> | undefined;
  const repo = c.orders.find((o) => o.kind === "reposition") as Extract<StandingOrder, { kind: "reposition" }> | undefined;
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
    const rows: { l: Load; dh: number; be: number; suggest: number; profit: number }[] = [];
    for (const l of w.loads.values()) {
      if (l.status !== "open" || l.equipment !== truck.trailer || l.brokerId === me().id) continue;
      const dh = hubMiles(w, truck.hub, l.origin);
      if (dh > MANUAL_BID_MAX_DEADHEAD_MI) continue;
      const be = breakEvenPerMile(w.cfg, truck, fuel, l.miles, dh);
      // Loads tend to clear near the lane's reference rate; the ceiling is the most the poster pays.
      const suggest = Math.min(l.ceiling, Math.max(be * 1.08, l.refRate * 0.97));
      rows.push({ l, dh, be, suggest, profit: (suggest - be) * l.miles });
    }
    rows.sort((a, b) => b.profit - a.profit);
    const list = rows
      .slice(0, 25)
      .map(({ l, dh, be, suggest, profit }) => {
        const mine = pending?.loadId === l.id;
        const o = w.net.hubs[l.origin]!;
        const d = w.net.hubs[l.dest]!;
        return `<div class="load ${mine ? "mine" : ""}">
          <div><div class="lane">${o.id} <span class="arrow">to</span> ${d.id}</div><div class="muted" style="font-size:14px">${esc(o.name)} to ${esc(d.name)} · ${l.miles} mi${dh ? ` · ${dh} mi empty first` : ""}${l.brokerId !== null ? " · brokered" : ""}${l.shipperId !== null ? " · player shipper" : ""}</div>
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
          const price = newPrice(w.cfg, { tier, trailer: tr });
          const left = availableSupply(w, tier, tr, firstTruck);
          return `<div class="card"><div class="truckhead">${img(truckUrl(tier, tr, false, PAL.amber, 2), `${TIER_NAME[tier]} with ${TRAILER_NAME[tr]}`)}<div><h3>${TIER_NAME[tier]} + ${TRAILER_NAME[tr]}</h3><p><span class="num">${fd(price)}</span> FD · ${left} left · ${lead} days to deliver</p></div></div>
          <div class="row"><button class="btn primary" data-act="buynew" data-tier="${tier}" data-trailer="${tr}" ${cash >= price && left > 0 ? "" : "disabled"}>Order${onLease ? " (replaces your lease)" : ""}</button></div></div>`;
        })
        .join(""),
    )
    .join("");
  const today = Math.floor(w.t / 1440);
  const used = openListings(w)
    .filter((l) => l.formerOwnerId !== c.id && l.sellerId !== c.id)
    .map((l) => ({ l, t: w.trucks[l.truckId - 1]! }))
    .sort((a, b) => a.l.askFd / Math.max(1, marketValue(w.cfg, a.t, today)) - b.l.askFd / Math.max(1, marketValue(w.cfg, b.t, today)))
    .slice(0, 8)
    .map(
      ({ l, t }) => `<div class="card"><div class="truckhead">${img(truckUrl(t.tier, t.trailer, false, PAL.fog, 2), "Used truck")}<div><h3>${TIER_NAME[t.tier]} + ${TRAILER_NAME[t.trailer]}</h3>
      <p>${Math.round(t.odometer).toLocaleString("en-US")} mi · ${pct(condition(w.cfg, t))} condition · at ${esc(w.net.hubs[t.hub]!.id)}${l.sellerId === 0 ? ' · <span class="warn">repo</span>' : ""}</p>
      <p>Asking <span class="num">${fd(l.askFd)}</span> FD (value ${fd(marketValue(w.cfg, t, today))})</p></div></div>
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
    w.ledger.balance(companyAccount(x.id)) + w.trucksByCompany.get(x.id)!.reduce((s, t) => s + marketValue(w.cfg, t, day), 0);
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
    ${players}
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

function readTest(): TestLog | null {
  try {
    const raw = localStorage.getItem(TEST_KEY);
    const log = raw ? (JSON.parse(raw) as TestLog) : null;
    return log && log.v === 1 && Number.isInteger(log.seed) && Array.isArray(log.acts) ? log : null;
  } catch {
    return null;
  }
}

async function bootTest(): Promise<void> {
  platform = { db: null, uid: null, owner: true, local: true };
  document.querySelector(".tagline")!.textContent = "Test build: the full game against the AI, with pause and speed controls.";
  const log = readTest();
  if (!log) {
    showTitle(testMenu());
    return;
  }
  showLoading("Loading your test world", "Replaying its history in this browser.");
  const t = await TestGame.restore(log, (share) => ($("loadbar").style.width = `${Math.round(share * 100)}%`));
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
  tip.textContent = `${hub.name} (${hub.id}) · ${openLoadsAt(h).length} open loads · ratio ${game!.w.lastRatio[h]!.toFixed(2)}`;
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
        const value = marketValue(w.cfg, t, Math.floor(w.t / 1440));
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
        act({ type: "set_standing_orders", orders }, "Dispatcher updated");
        break;
      }
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
