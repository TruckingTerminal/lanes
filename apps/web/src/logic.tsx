import type { ComponentChildren } from "preact";
import type { Equipment } from "@lanes/config";
import {
  canMakeHot,
  companyAccount,
  condition,
  crewed,
  MANUAL_BID_MAX_DEADHEAD_MI,
  offeredContracts,
  rebuildable,
  rebuildCost,
  dispatchProfile,
  fleetOverheadPerWeek,
  lessorTrucksOf,
  yardPerTruck,
  driverFatigue,
  hubMiles,
  marketPay,
  operatingTrucks,
  ordersWaitForHand,
  placeMiles,
  placeToll,
  reloadOdds,
  resting,
  seasonality,
  stars,
  vettingBlock,
  type Company,
  type Load,
  type Staff,
  type StandingOrder,
  type Truck,
  type World,
} from "@lanes/engine";
import { DISPATCHER_ORDERS, GAME_CONFIG, PLAYER_DISPATCHER_ORDERS } from "./game.js";
import { trueBreakEven } from "./breakeven.js";
import { boardRows } from "./board.js";
import { ARRIVAL, BROKERAGE, DEBT, DISPATCHER, FIRST_ENTRY, NEEDS, SAFETY_NEWS, TRUCK } from "./copy.js";
import { debtCountdown } from "./figures.js";
import { hasTwo, kindInView, switchCompany, type CompanyKind } from "./companies.js";
import { act, bumpData, clockMin, isPhone, me, myTrucks, push, S, setTab, selectTruck, toast, truckNo, type Session } from "./state.js";
import { iuliiaSay } from "./iuliia.js";
import { tabOpen, teaserTabs, type Tab } from "./tabs.js";
import { leaseMinFor } from "./ledger.js";
import { rebuild as rebuildLines } from "./confirmspecs.js";
import { confirmAct } from "./ui/Confirm.js";
import { askWhatNow } from "./ui/WhatNow.js";
import { myTenders } from "./ui/panels/Contracts.js";
import { dateLabel, fd, fdFull, hhmm, hoursLabel, pct, plural, realUntil, signedPct, TRAILER_NAME, weekday } from "./format.js";
import { Btn } from "./ui/bits.js";

/** Game reasoning the panels share: idle diagnoses, status lines, crew lines, reload and season reads. */

export function openLoadsAt(hub: number): Load[] {
  const out: Load[] = [];
  for (const l of S.game!.w.loads.values()) if (l.status === "open" && l.origin === hub) out.push(l);
  return out;
}

/** A truck counts as stuck after this many hours idle: the dispatcher has had two rounds at it. */
export const IDLE_ALERT_HOURS = 24;
/** Hours idle, counted from the later of the engine's idle start and the end of the truck's last home time (S.idleFrom). */
export const idleHours = (t: Truck): number => Math.max(0, (clockMin() - Math.max(t.idleSinceT, S.idleFrom.get(t.id) ?? -Infinity)) / 60);
export const idleDays = (t: Truck): number => Math.floor(idleHours(t) / 24);
export const idleLabel = (t: Truck): string => hoursLabel(idleHours(t));

/**
 * R22 (player5-ux.md section 4): where a truck stands with nothing in reach it may take, or nothing that pays. The one
 * reason is the board's own chip (board.ts blockReason, the engine's order), the one most of the loads in reach share.
 * Read the moment the truck is idle, not a day later; memoized for the game minute, since the badge reads it each draw.
 */
export interface Wall {
  /** Every load in reach is closed to the truck, for this reason; null when some are open. */
  reason: string | null;
  /** Whether every load in reach shares that one reason (the board's line under its header). */
  same: boolean;
  /** Loads in reach the truck may take that clear break-even. */
  pays: number;
  rows: number;
}
let wallMemo: { t: number; at: Map<string, Wall> } = { t: -1, at: new Map() };
export function wallAt(t: Truck): Wall {
  const w = S.game!.w;
  const c = me();
  if (wallMemo.t !== w.t) wallMemo = { t: w.t, at: new Map() };
  const key = `${c.id}:${t.id}:${t.place}`;
  const hit = wallMemo.at.get(key);
  if (hit) return hit;
  const rows = boardRows(w, c, t, { dest: "any", maxDh: 300, query: "" });
  const pays = rows.filter((r) => !r.block && r.profitBook > 0).length;
  let reason: string | null = null;
  let same = false;
  if (rows.length && rows.every((r) => r.block)) {
    const n = new Map<string, number>();
    for (const r of rows) n.set(r.block!, (n.get(r.block!) ?? 0) + 1);
    reason = [...n.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    same = n.size === 1;
  }
  const out = { reason, same, pays, rows: rows.length };
  wallMemo.at.set(key, out);
  return out;
}
/** R22: the player's idle trucks with nothing in reach they may take that pays, from the moment they're idle. */
export const wallTrucks = (): Truck[] => {
  const w = S.game!.w;
  if (me().authority.status !== "active") return [];
  return myTrucks().filter((t) => t.status === "idle" && crewed(t) && !resting(w, t) && t.breakdownMin <= 0 && !w.manualBids.has(t.id) && wallAt(t).pays === 0);
};
/** R22's line for a stuck truck: the wall's reason, or that nothing in reach pays. */
export function wallLine(t: Truck): string {
  const w = S.game!.w;
  const wall = wallAt(t);
  const place = w.net.places[t.place]!.name;
  return wall.reason ? NEEDS.stuck(truckNo(t.id), place, wall.reason) : NEEDS.stuckPays(truckNo(t.id), place);
}
/**
 * "See the ways out": What now?'s rule 3b once R23 is built (guidance.md, "Stuck: the ways out"); until then, as the
 * writer's copy-player5.md says, the board for this truck sorted by pay.
 */
export function waysOut(t: Truck): void {
  S.boardSortOnce = "pay";
  goLoads(t.id);
}

/** The player's trucks idle a day or more. */
/** R1: with the dispatcher off, the idle card offers it after one idle round, not two. */
const roundHours = (): number => 24 / S.game!.w.cfg.time.boardRoundHours.length;
export const stuckTrucks = (): Truck[] => {
  const off = !me().orders.some((o) => o.kind === "bid");
  const walls = new Set(wallTrucks().map((t) => t.id));
  return myTrucks().filter((t) => t.status === "idle" && idleHours(t) >= (off ? roundHours() : IDLE_ALERT_HOURS) && !resting(S.game!.w, t) && !walls.has(t.id));
};

/** R1's one button ("Let the dispatcher bid"): the dispatcher's default rules on, the company's other orders kept. */
export function letDispatcherBid(): void {
  const keep = me().orders.filter((o) => !DISPATCHER_ORDERS.has(o.kind));
  act({ type: "set_standing_orders", orders: [...PLAYER_DISPATCHER_ORDERS, ...keep] }, DISPATCHER.saved, "dispatcher:on");
}

/** Shouts once per idle day per truck, in the ticker and as a toast. */
const idleAlerted = new Map<string, number>();
export function checkIdleAlerts(): void {
  const g = S.game;
  if (!g?.player) return;
  for (const t of myTrucks()) {
    const key = `${g.kind}:${t.id}`;
    if (t.status !== "idle") {
      idleAlerted.delete(key);
      continue;
    }
    const days = idleDays(t);
    if (idleHours(t) < IDLE_ALERT_HOURS || idleAlerted.get(key) === days || resting(g.w, t)) continue;
    idleAlerted.set(key, days);
    const text = `Truck ${truckNo(t.id)} has been idle ${idleLabel(t)} at ${g.w.net.hubs[t.hub]!.name}: ${idleWhy(t).why}`;
    // R22: the idle card and the badge carry it from the moment the truck is idle; it no longer arrives as a toast.
    push(g, text, "bad");
    bumpData();
  }
}

/**
 * Things that cost money while nobody looks: a truck with no driver, cash running out, weeks in
 * the red, a stretched dispatcher, defects piling up (Jeff, 2026-10-29: alerts for whatever is
 * missing, so time doesn't just pass).
 */
export interface Attention {
  key: string;
  text: string;
  tone: "bad" | "warn";
  fix: ComponentChildren;
}

export function attentionItems(): Attention[] {
  const g = S.game;
  if (!g?.player) return [];
  const w = g.w;
  const c = g.player;
  const out: Attention[] = [];
  const trucks = myTrucks();
  for (const t of trucks) {
    if (crewed(t) || t.status === "listed") continue;
    out.push({ key: `driver:${t.id}`, text: `Truck ${truckNo(t.id)} has no driver and earns nothing.`, tone: "bad", fix: <Btn primary onClick={goStaff}>Hire a driver</Btn> });
  }
  const bal = w.ledger.balance(companyAccount(c.id));
  const running = trucks.filter((t) => t.status !== "parked" && t.status !== "listed");
  const weeklyFixed = running.length * (c.insurance.annualPerTruck / 52) + fleetOverheadPerWeek(w.cfg, running.length) + lessorTrucksOf(w, c.id).length * 250 + yardPerTruck(w, c) * Math.max(0, trucks.length - 1);
  const money = <Btn onClick={() => setTab("money")}>Money</Btn>;
  if (bal < -w.cfg.insolvency.debtLimitFd) {
    // The figures the engine's weekly check reads (solvency.ts checkSolvency: this ledger balance against the line, at
    // the week's close), from figures.ts debtCountdown, the same as What now? and Money. The key carries the count, so
    // the toast and the ticker say it again when a check moves it rather than keeping the first line's figure.
    const d = debtCountdown(w, c);
    out.push({ key: `debt:${d.n}`, text: DEBT.line(fdFull(-bal), fdFull(w.cfg.insolvency.debtLimitFd), d.n, d.of, dateLabel(d.nextDay)), tone: "bad", fix: money });
  } else if (weeklyFixed > 0 && bal < 2 * weeklyFixed) {
    out.push({ key: "cash", text: `Cash is low: ${fd(bal)} FD against about ${fd(weeklyFixed)} FD a week of insurance, overhead, leases and yard before a wheel turns.`, tone: "warn", fix: money });
  }
  const prof = dispatchProfile(w, c, running.length);
  if (prof.coverage < 0.8) out.push({ key: "dispatch", text: `Your dispatch team covers ${prof.span} trucks and you run ${running.length}: about ${Math.round((1 - prof.coverage) * 100)}% of idle trucks sit out each round.`, tone: "warn", fix: <Btn primary onClick={goStaff}>Hire a dispatcher</Btn> });
  for (const t of trucks) {
    if (t.defects >= 3 && (t.status === "idle" || t.status === "parked"))
      out.push({ key: `defects:${t.id}`, text: `Truck ${truckNo(t.id)} is carrying ${t.defects} defects: an inspection finds them, and they raise crash odds.`, tone: "warn", fix: <Btn onClick={() => act({ type: "fix_defects", truckId: t.id }, "Defects fixed")}>Fix · {fd(t.defects * w.cfg.safety.maintenance.fixFdPerDefect)} FD</Btn> });
  }
  return out;
}

export function AttentionCard(): ComponentChildren {
  const items = attentionItems();
  if (!items.length) return null;
  return (
    <section class="card alert">
      <h3>{TRUCK.needsYou}</h3>
      {items.map((a) => (
        <div class="row" key={a.key} data-need={a.key}>
          <span class={a.tone}>{a.text}</span>
          {a.fix}
        </div>
      ))}
    </section>
  );
}

/**
 * Everything waiting on the player (the top strip's red count): where its card is, so a tap on the count opens that tab
 * and brings the card, with its fix, into view (Jeff, 2026-11-02). The money alarms open Money, a bid's result Loads;
 * the rest are cards on their tabs.
 *
 * R9 (player2-ux.md section 3): the count is only what the player can act on now, each row with its action button, and
 * ranked by what's at stake: the authority and the company itself first, then FD at risk a day where the engine's
 * figures give it, then the deadline. A tab just opened is the dot on More, never the count; an item engineering can't
 * give a button isn't an item.
 */
export interface Need {
  key: string;
  text: string;
  tab: Tab;
  /** A CSS selector for the card to scroll to. */
  target: string;
  /** With two companies, whose it is (the list names it and switches to it before opening). */
  company?: CompanyKind;
  /** The row's action, in the writer's words (R9: every badge item has one). */
  button: string;
  /** What the button does; without it, the button opens the item's card, where its fix is. */
  run?: (ev?: MouseEvent) => void;
  /** The row's icon (assets/icons). */
  icon: string;
  /** The authority or the company's survival is at stake: these rank first. */
  first?: boolean;
  /** FD a day this costs while it waits, where the engine's figures give it. */
  riskFdPerDay?: number;
  /** When it lapses or lands, as a game minute. */
  dueMin?: number;
}

/** R9's order: what's at stake first, then FD at risk a day, then the soonest deadline; ties keep the list's order. */
export function rankNeeds(list: Need[]): Need[] {
  return list
    .map((n, i) => ({ n, i }))
    .sort((a, b) => Number(!!b.n.first) - Number(!!a.n.first) || (b.n.riskFdPerDay ?? 0) - (a.n.riskFdPerDay ?? 0) || (a.n.dueMin ?? Infinity) - (b.n.dueMin ?? Infinity) || a.i - b.i)
    .map((x) => x.n);
}

/**
 * What a truck costs a day while it earns nothing: its insurance, a lease's weekly minimum and its yard space, by the
 * week as the engine bills them, and the idle fee once an owned truck has sat past costs.idleFeeAfterDays.
 */
export function truckDayCostFd(w: World, c: Company, t: Truck): number {
  const fleet = (w.trucksByCompany.get(c.id) ?? []).filter((x) => x.status !== "retired");
  const insured = t.lease !== "npc" && t.status !== "parked" && t.status !== "listed";
  const week = (insured ? c.insurance.annualPerTruck / 52 : 0) + leaseMinFor(w, t) + (fleet.length > 1 ? yardPerTruck(w, c) : 0);
  const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  const idleFee = t.lease === "owned" && t.status === "idle" && today - t.idleSinceDay >= w.cfg.costs.idleFeeAfterDays ? w.cfg.costs.idleFeePerDay : 0;
  return week / 7 + idleFee;
}

/**
 * What needs the player. With two companies (brokerage-ux.md section 1) it counts both: each is read in view in turn,
 * and every row says whose it is.
 */
export function needs(): Need[] {
  const g = S.game;
  if (!g?.player) return [];
  if (!hasTwo(g)) return rankNeeds(needsInView(true));
  const here = kindInView(g);
  const there: CompanyKind = here === "carrier" ? "brokerage" : "carrier";
  const mine = needsInView(here === "carrier").map((n) => ({ ...n, company: here }));
  g.inView = there;
  try {
    return rankNeeds([...mine, ...needsInView(there === "carrier").map((n) => ({ ...n, key: `${there}:${n.key}`, company: there }))]);
  } finally {
    g.inView = here;
  }
}

/** The tabs just opened and not yet visited: More's dot (R9), never the red count. */
export function newTabs(): Tab[] {
  const g = S.game;
  if (!g?.player) return [];
  return teaserTabs()
    .filter((t) => tabOpen(t.id, g.w, g.player) && !S.onboard.visited.includes(t.id))
    .map((t) => t.id);
}

/**
 * The company in view's needs. The carrier's (`fleet`) are everything, with the page's own (a bid's result); a brokerage
 * runs no trucks, so it has only its own money's (the trucks' needs read the carrier's trucks).
 */
function needsInView(fleet: boolean): Need[] {
  const page = fleet;
  const g = S.game!;
  const c = g.player!;
  const w = g.w;
  const out: Need[] = fleet ? safetyNeeds(w, c) : [];
  const here = (place: number) => w.net.places[place]!.name;
  const trucks = fleet ? myTrucks() : [];
  const bal = w.ledger.balance(companyAccount(c.id));
  // The money alarms: the debt countdown (the engine's weekly check, figures.ts debtCountdown) and low cash. What now?
  // is their button: it names the one move that helps most (nextstep.ts).
  if (bal < -w.cfg.insolvency.debtLimitFd) {
    const d = debtCountdown(w, c);
    out.push({ key: `debt:${d.n}`, text: DEBT.badge(fdFull(-bal), d.n, d.of, dateLabel(d.nextDay)), tab: "money", target: ".cashcard", button: NEEDS.whatNow, run: askWhatNow, icon: "money", first: true, dueMin: d.nextDay * w.cfg.time.gameMinutesPerDay });
  }
  for (const a of attentionItems()) {
    if (a.key === "cash") out.push({ key: a.key, text: a.text, tab: "money", target: ".cashcard", button: NEEDS.whatNow, run: askWhatNow, icon: "money" });
    if (!fleet) continue;
    if (a.key === "dispatch") out.push({ key: a.key, text: a.text, tab: "fleet", target: `[data-need="${a.key}"]`, button: NEEDS.hireDispatcher, run: goStaff, icon: "staff" });
  }
  for (const t of trucks) {
    const n = truckNo(t.id);
    const at = { tab: "fleet" as const, icon: "fleet" };
    if (!crewed(t) && t.status !== "listed")
      out.push({ key: `driver:${t.id}`, text: NEEDS.noDriver(n, fd(truckDayCostFd(w, c, t))), ...at, target: `[data-need="driver:${t.id}"]`, button: NEEDS.hire, run: goStaff, icon: "staff", riskFdPerDay: truckDayCostFd(w, c, t) });
    else if (t.breakdownMin > 0)
      out.push({ key: `down:${t.id}`, text: NEEDS.truckDown(n, here(t.place), `${weekday(Math.floor((w.t + t.breakdownMin) / w.cfg.time.gameMinutesPerDay))} ${hhmm(w.t + t.breakdownMin)}`), ...at, target: `[data-need="truck:${t.id}"]`, button: NEEDS.seeTruck, run: () => seeTruck(t.id), riskFdPerDay: truckDayCostFd(w, c, t), dueMin: w.t + t.breakdownMin });
    if (t.defects >= 3 && (t.status === "idle" || t.status === "parked")) {
      const cost = t.defects * w.cfg.safety.maintenance.fixFdPerDefect;
      out.push({ key: `defects:${t.id}`, text: NEEDS.defects(n, t.defects), ...at, target: `[data-need="defects:${t.id}"]`, button: NEEDS.fix(fd(cost)), run: () => act({ type: "fix_defects", truckId: t.id }, "Defects fixed") });
    }
    // A rebuild due: an owned truck at or under the rebuild line, idle so the shop can take it (R6's card first).
    const cond = condition(w.cfg, t);
    if (t.lease === "owned" && t.status === "idle" && cond <= w.cfg.wear.rebuildMaxCondition && rebuildable(w.cfg, t)) {
      const cost = rebuildCost(w.cfg, t);
      out.push({ key: `rebuild:${t.id}`, text: NEEDS.rebuildDue(n, pct(cond)), ...at, target: `[data-need="truck:${t.id}"]`, button: NEEDS.rebuild(fd(cost)), run: (ev) => confirmAct({ verb: "Rebuild", item: `truck ${n}`, costFd: cost, ...rebuildLines(w, t), run: () => act({ type: "rebuild_truck", truckId: t.id }, "Truck is in the shop for two days", "truck:rebuild") }, ev) });
    }
  }
  // R16: a driver on notice for pay (Staff.unhappyNotice; labor.ts dailyLabor lets them go at offer.day + noticeDays).
  for (const s of fleet ? w.staffByCompany.get(c.id) ?? [] : [])
    if (s.unhappyNotice && s.status === "employed" && s.offer?.companyId === 0) {
      const leaves = s.offer.day + w.cfg.labor.morale.noticeDays;
      const truck = trucks.find((t) => t.driverId === s.id || t.coDriverId === s.id);
      out.push({ key: `notice:${s.id}`, text: NEEDS.notice(s.name, dateLabel(leaves)), tab: "staff", target: `[data-need="notice:${s.id}"]`, button: NEEDS.noticeButton, icon: "staff", riskFdPerDay: truck ? truckDayCostFd(w, c, truck) : undefined, dueMin: leaves * w.cfg.time.gameMinutesPerDay });
    }
  // A contract tender: Accept puts the nearest idle truck that can take it on it; with none, the button opens the card.
  for (const l of myTenders(c)) {
    const truck = trucks
      .filter((t) => t.status === "idle" && crewed(t) && t.trailer === l.equipment && placeMiles(w, t.place, l.originPlace) <= MANUAL_BID_MAX_DEADHEAD_MI)
      .sort((a, b) => placeMiles(w, a.place, l.originPlace) - placeMiles(w, b.place, l.originPlace))[0];
    const rate = l.ownTenderRate ?? w.contracts.find((x) => x.id === l.contractId)?.ratePerMile ?? 0;
    out.push({
      key: `tender:${l.id}`,
      text: NEEDS.tender(here(l.originPlace), here(l.destPlace), hhmm(l.tenderUntil)),
      tab: "fleet",
      target: `[data-need="tender:${l.id}"]`,
      icon: "loads",
      ...(truck ? { button: NEEDS.accept, run: () => act({ type: "accept_tender", loadId: l.id, truckId: truck.id }, "Tender accepted at your contract rate") } : { button: NEEDS.seeTender }),
      riskFdPerDay: rate * l.miles,
      dueMin: l.tenderUntil,
    });
  }
  for (const k of fleet ? offeredContracts(w, c.id) : [])
    out.push({ key: `offer:${k.id}`, text: NEEDS.offer(here(k.originPlace), here(k.destPlace), k.loadsPerWeek), tab: "company", target: `[data-need="offer:${k.id}"]`, button: NEEDS.seeOffer, icon: "company", dueMin: (k.offerExpiresDay + 1) * w.cfg.time.gameMinutesPerDay });
  // A tired driver: Send home (idle), or Send home when idle (moving, labor.sendHomeWhileMoving); once asked, it's done.
  for (const t of fleet ? tiredTrucks() : []) {
    const d = w.staff[t.driverId - 1]!;
    if (d.wantsHome) continue;
    const idle = t.status === "idle";
    if (!idle && !sendHomeWhileMoving(w)) continue;
    out.push({ key: `tired:${t.id}`, text: NEEDS.tired(d.owner ? "You" : d.name, d.awayDays), tab: "fleet", target: `[data-need="tired:${t.id}"]`, button: idle ? NEEDS.sendHome : NEEDS.sendHomeWhenIdle, run: () => act({ type: "send_home", truckId: t.id }, idle ? "Heading home for days off" : TRUCK.goingHomeToast, "truck:sendHome"), icon: "staff" });
  }
  for (const t of fleet ? wallTrucks() : [])
    out.push({ key: `wall:${t.id}`, text: wallLine(t), tab: "fleet", target: `[data-need="wall:${t.id}"]`, button: NEEDS.waysOut, run: () => waysOut(t), icon: "fleet", riskFdPerDay: truckDayCostFd(w, c, t) });
  const stuck = fleet ? stuckTrucks() : [];
  for (const t of trucks.filter((x) => stuck.includes(x))) {
    const fix = idleFix(t);
    out.push({ key: `idle:${t.id}`, text: NEEDS.idle(truckName(t), w.net.hubs[t.hub]!.name, idleLabel(t)), tab: "fleet", target: `[data-need="idle:${t.id}"]`, button: fix.button, run: fix.run, icon: "fleet", riskFdPerDay: truckDayCostFd(w, c, t) });
  }
  if (page && S.result && !S.result.seen) out.push({ key: "result", text: NEEDS.result(S.result.won), tab: "loads", target: ".resultcard", button: NEEDS.seeResult, icon: "loads" });
  return out;
}

/** labor.sendHomeWhileMoving: send_home on a moving truck sets the standing intent (off until the bump). */
const sendHomeWhileMoving = (w: World): boolean => w.cfg.labor.sendHomeWhileMoving;

/** The one move for a truck stuck idle, as a button: the first fix its idle diagnosis gives. */
function idleFix(t: Truck): { button: string; run: () => void } {
  const w = S.game!.w;
  const c = me();
  if (ordersWaitForHand(w, c)) return { button: ARRIVAL.showBoard, run: () => goLoads(t.id) };
  if (!c.orders.some((o) => o.kind === "bid")) return { button: DISPATCHER.letBid, run: letDispatcherBid };
  return { button: TRUCK.bidByHand, run: () => goLoads(t.id) };
}

/** Opens the Truck tab on this truck's card. */
function seeTruck(id: number): void {
  selectTruck(id);
  openNeed({ key: `truck:${id}`, text: "", tab: "fleet", target: `[data-need="truck:${id}"]`, button: "", icon: "fleet" });
}

const BASIC_NAME: Record<string, string> = { hos: "hours of service", unsafe: "unsafe driving", maintenance: "vehicle maintenance", crash: "crashes" };
/**
 * R18 (the director's ruling: the road to revocation is shown at every step): the rating an audit set, while its
 * probation or a revocation date stands; the audit's date once set; an alert before its audit has a date. First in the
 * list, since the authority is what's at stake. Each opens Company's safety card, where the record and the policy are.
 */
export function safetyNeeds(w: World, c: Company): Need[] {
  const s = c.safety;
  const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  const out: Need[] = [];
  const at = { tab: "company" as const, target: '[data-need="safety"]', button: SAFETY_NEWS.button, icon: "company", first: true };
  const bad = s.rating === "conditional" || s.rating === "unsatisfactory";
  if (bad && (s.revokeDay !== null || (s.probationUntil ?? -1) >= today || (s.ratingDay !== null && today - s.ratingDay <= 7))) {
    const name = s.rating === "conditional" ? "Conditional" : "Unsatisfactory";
    const revoke = s.rating === "unsatisfactory" && s.revokeDay !== null ? ` ${SAFETY_NEWS.revokes(dateLabel(s.revokeDay))}` : "";
    out.push({ key: `safety:rating:${s.ratingDay}`, text: `${SAFETY_NEWS.auditResult(name)} ${SAFETY_NEWS.consequence[s.rating as "conditional" | "unsatisfactory"]}${revoke}`, ...at });
  }
  if (s.reviewDay !== null && s.reviewDay >= today) out.push({ key: `safety:audit:${s.reviewDay}`, text: `${SAFETY_NEWS.auditDue(dateLabel(s.reviewDay))}${s.alerts.length ? ` ${SAFETY_NEWS.auditWhy(s.alerts.length)}` : ""}`, ...at });
  else if (s.alerts.length) out.push({ key: `safety:alert:${s.alerts.join(",")}`, text: SAFETY_NEWS.alert(s.alerts.map((a) => BASIC_NAME[a] ?? a).join(", "), w.cfg.safety.review.auditDays), ...at });
  return out;
}

/**
 * A hand bid whose load left the board before the round (booked outright by another carrier) is dropped by the engine
 * without an event, and the dispatcher bids for the truck as usual (QA's Intel replay; the trucker's lost bid): the
 * result card says so, and the Loads item lights (needs' "result").
 */
export function settleHandBids(s: Session): void {
  if (!s.player) return;
  const w = s.w;
  for (const [loadId, hb] of S.handBids) {
    const load = w.loads.get(loadId);
    if (load && load.status === "open") continue;
    S.handBids.delete(loadId);
    if (load && load.carrierId === s.player.id) continue; // ours after all: the won event has said so
    iuliiaSay(load ? "result:lost" : "result:nobody");
    S.result = { won: false, from: hb.from ?? "", to: hb.to ?? "", rate: hb.rate, winning: load ? load.clearedRate : null, be: hb.be, total: 0, seen: false, winnerId: load?.carrierId ?? undefined, lost: load && hb.truckId !== undefined ? { loadId, truckId: hb.truckId, profitAtWinningFd: (load.clearedRate - hb.be) * load.miles } : undefined };
    bumpData();
  }
}

/** Opens a waiting thing's tab (the sheet at half on a phone) and scrolls its card into view, flashing it once. */
export function openNeed(n: Need): void {
  if (n.company && S.game && kindInView(S.game) !== n.company) switchCompany(n.company);
  if (isPhone() && S.sheet === "strip") S.sheet = "half";
  setTab(n.tab);
  // Two frames: the tab renders, then the sheet has its height.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(n.target);
      if (!el) return;
      el.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }),
  );
}

/** Says each new item once, as a toast, the moment it appears. */
const attentionSeen = new Set<string>();
export function checkAttention(): void {
  const g = S.game;
  if (!g?.player) return;
  const items = attentionItems();
  const keys = new Set(items.map((a) => `${g.kind}:${a.key}`));
  for (const k of [...attentionSeen]) if (!keys.has(k)) attentionSeen.delete(k);
  for (const a of items) {
    const k = `${g.kind}:${a.key}`;
    if (attentionSeen.has(k)) continue;
    attentionSeen.add(k);
    toast(a.text, a.tone === "bad");
    push(g, a.text, a.tone === "bad" ? "bad" : "warn");
  }
}
/** The player's trucks whose driver has been out past the fatigue line or is already tired. */
export const tiredTrucks = (): Truck[] => {
  const f = GAME_CONFIG.fatigue;
  const w = S.game!.w;
  return myTrucks().filter((t) => crewed(t) && !resting(w, t) && (driverFatigue(w, t) >= f.tiredAt || w.staff[t.driverId - 1]!.awayDays >= f.roadDays));
};

export interface IdleWhy {
  why: string;
  fixes: ComponentChildren[];
}

export const goStaff = (): void => setTab("staff");
export const goLoads = (truck: number): void => {
  selectTruck(truck);
  setTab("loads");
};

/** Why one of the player's idle trucks isn't moving, and what would move it. */
export function idleWhy(t: Truck): IdleWhy {
  const w = S.game!.w;
  const c = me();
  const hubName = w.net.hubs[t.hub]!.name;
  const trailer = TRAILER_NAME[t.trailer].toLowerCase();
  const board = <Btn onClick={() => goLoads(t.id)}>{TRUCK.bidByHand}</Btn>;
  if (!crewed(t)) return { why: "No driver is seated, so it can't run.", fixes: [<Btn primary onClick={goStaff}>Hire a driver</Btn>] };
  if (c.authority.status !== "active") return { why: c.authority.status === "revoked" ? "Your authority is revoked: nothing can haul." : "Your authority is suspended: nothing can haul until it's back.", fixes: [] };
  if (t.breakdownMin > 0) return { why: `Broken down: about ${Math.ceil(t.breakdownMin / 60)} h until the tow and repair are done.`, fixes: [] };
  // Home time is rest, not a losing dispatcher (the director's gate, sprint 1).
  if (resting(w, t)) {
    const d = w.staff[t.driverId - 1]!;
    return { why: TRUCK.homeTime(d.owner ? "you're" : `${d.name} is`, dateLabel(d.homeUntilDay!)), fixes: [] };
  }
  const bid = w.manualBids.get(t.id);
  if (bid) return { why: `Your bid of ${bid.rate.toFixed(2)}/mi is in for the next round.`, fixes: [] };
  // The first bid by hand (S9): the dispatcher waits for the owner's first call, so the fix is the board, not the orders.
  if (ordersWaitForHand(w, c)) return { why: DISPATCHER.waitingCard(hubName), fixes: [<Btn primary onClick={() => goLoads(t.id)}>{ARRIVAL.showBoard}</Btn>] };
  const order = c.orders.find((o): o is Extract<StandingOrder, { kind: "bid" }> => o.kind === "bid");
  if (!order) return { why: DISPATCHER.offIdle, fixes: [<Btn primary onClick={letDispatcherBid}>{DISPATCHER.letBid}</Btn>, board] };
  const floor = c.orders.find((o): o is Extract<StandingOrder, { kind: "floor" }> => o.kind === "floor");
  const maxDh = order.maxDeadheadMi;
  const loads = [...w.loads.values()].filter((l) => l.status === "open" && l.equipment === t.trailer && l.brokerId !== c.id && placeMiles(w, t.place, l.originPlace) <= maxDh);
  if (loads.length === 0) {
    const best = w.net.hubs
      .map((h, i) => ({ h, i, mi: hubMiles(w, t.hub, i), n: openLoadsAt(i).filter((l) => l.equipment === t.trailer).length }))
      .filter((x) => x.i !== t.hub && x.n > 0 && x.mi <= 800)
      .sort((a, b) => b.n - b.mi / 200 - (a.n - a.mi / 200))[0];
    return {
      why: `${TRUCK.noLoadsInRange(trailer, maxDh, hubName)}${best ? ` The nearest freight worth the run is ${plural(best.n, "load")} at ${best.h.name}, ${best.mi} mi away.` : ""}`,
      fixes: [
        ...(best ? [<Btn primary onClick={() => act({ type: "reposition_truck", truckId: t.id, hubId: best.h.id }, TRUCK.sentEmpty, "truck:sendEmpty")}>{TRUCK.sendEmpty(best.h.name, best.mi)}</Btn>] : []),
        <Btn onClick={() => goLoads(t.id)}>{TRUCK.bidByHand}</Btn>,
      ],
    };
  }
  if (loads.every((l) => l.hot > 0) && !canMakeHot(c, t)) return { why: `The only ${trailer} loads in range are hot, and a solo driver can't make a hot window legally.`, fixes: [<Btn primary onClick={goStaff}>Seat a co-driver</Btn>] };
  const blocked = loads.map((l) => vettingBlock(w, c, l)).filter((x): x is string => x !== null);
  if (blocked.length === loads.length) return { why: `Every load in range requires vetting you don't pass: ${blocked[0]}.`, fixes: [] };
  const floorPct = floor?.breakEvenPlusPct ?? 0;
  const running = operatingTrucks(w, c.id);
  const prof = dispatchProfile(w, c, running);
  // The board's own break-even (breakeven.ts), so the alert and the cards never disagree about what pays.
  const payable = loads.filter((l) => l.ceiling >= trueBreakEven(w, t, l, placeMiles(w, t.place, l.originPlace), placeToll(w, t.place, l.originPlace), prof.foresightDays, prof.reloadWeight) * (1 + floorPct));
  if (payable.length === 0) return { why: `${plural(loads.length, `${trailer} load`)} in range, but none pays your floor (break-even + ${Math.round(floorPct * 100)}%) even at its ceiling.`, fixes: [board] };
  if (prof.coverage < 1) return { why: `Your dispatcher is stretched: ${prof.span} trucks' worth of attention for the ${running} you run, so this truck sits out about ${Math.round((1 - prof.coverage) * 100)}% of rounds.`, fixes: [<Btn primary onClick={goStaff}>Hire a dispatcher</Btn>, board] };
  return { why: `${plural(payable.length, `${trailer} load`)} in range pay enough, but the dispatcher's bids keep losing: other carriers bid lower or have the better record.`, fixes: [<Btn primary onClick={() => goLoads(t.id)}>Bid by hand</Btn>] };
}

/** Plain-text status, for tooltips and the ticker. */
export function statusText(t: Truck): string {
  const w = S.game!.w;
  const name = (i: number) => w.net.places[i]!.name;
  switch (t.status) {
    case "idle":
      return resting(w, t) ? `Home time at ${name(t.place)}` : `Idle at ${name(t.place)} for ${idleLabel(t)}`;
    case "toPickup":
      return `Heading empty to ${name(t.targetPlace)} for a pickup · ${Math.round(t.remainingMi)} mi`;
    case "loading":
      return `Loading at ${name(t.place)}`;
    case "loaded":
      return `Loaded ${name(t.place)} → ${name(t.targetPlace)} · ${Math.round(t.remainingMi)} mi to go`;
    case "unloading":
      return `Unloading at ${name(t.targetPlace)}`;
    case "repositioning":
      return `Running empty to ${name(t.targetPlace)} · ${Math.round(t.remainingMi)} mi`;
    case "repair":
      return "In the shop";
    case "parked":
      return `Parked at ${name(t.place)}`;
    case "listed":
      return "Listed for sale";
    default:
      return t.status;
  }
}

/** The status line on a fleet card, with the idle clock coloured as it ages. */
export function StatusLine({ t }: { t: Truck }): ComponentChildren {
  const w = S.game!.w;
  const name = (i: number) => w.net.places[i]!.name;
  switch (t.status) {
    case "idle": {
      const bid = w.manualBids.get(t.id);
      if (!bid && ordersWaitForHand(w, me())) return <>{DISPATCHER.waitingCard(name(t.place))}</>;
      if (resting(w, t)) {
        const d = w.staff[t.driverId - 1]!;
        const left = d.homeUntilDay! - Math.floor(clockMin() / 1440) - (d.drivenMinToday > 0 ? 1 : 0);
        return (
          <>
            Home time at {name(t.place)}: {plural(Math.max(1, left), "day")} off{d.drivenMinToday > 0 ? ", starting tomorrow" : " left"}
          </>
        );
      }
      // The audit: not "sat out a round" thirty seconds in; the idle clock turns amber, then red, as it ages.
      const h = idleHours(t);
      return (
        <>
          <span class={h >= IDLE_ALERT_HOURS ? "bad" : h >= 12 ? "warn" : ""}>{TRUCK.idle(name(t.place), nextRoundHour())}</span>
          {bid ? <span class="good"> · your bid {bid.rate.toFixed(2)}/mi is in</span> : null}
        </>
      );
    }
    case "loaded": {
      const l = t.loadId !== null ? w.loads.get(t.loadId) : undefined;
      return (
        <>
          Loaded {name(t.place)} → {name(t.targetPlace)} · {Math.round(t.remainingMi)} mi to go{l ? ` · ${l.clearedRate.toFixed(2)}/mi` : ""}
          {t.breakdownMin > 0 ? <span class="bad"> · broken down</span> : null}
        </>
      );
    }
    case "parked":
      return <>Parked at {name(t.place)} (off the road; an owned truck unused {w.cfg.costs.idleFeeAfterDays}+ days pays {w.cfg.costs.idleFeePerDay} FD/day)</>;
    default:
      return <>{statusText(t)}</>;
  }
}

/** The next bidding round's hour of the day (6 or 18) and its game minute. */
function nextRound(): { hour: number; at: number } {
  const minute = clockMin();
  const hour = (minute / 60) % 24;
  const next = hour < 6 ? 6 : hour < 18 ? 18 : 30;
  return { hour: next % 24, at: minute + (next - hour) * 60 };
}
/** "18:00": the next round, for short lines. */
export const nextRoundHour = (): string => `${String(nextRound().hour).padStart(2, "0")}:00`;
/** How long until the next round: real time live, game hours in a test world. */
export function nextRoundWait(): string {
  const g = S.game!;
  const { at } = nextRound();
  return g.kind === "live" ? realUntil(g.msUntil(at)) : `${Math.ceil((at - clockMin()) / 60)}h`;
}
/** How far through the current round the clock is, 0 to 1: the pinned bid's ring (S4). */
export function roundProgress(): number {
  const { at } = nextRound();
  return Math.max(0, Math.min(1, 1 - (at - clockMin()) / (12 * 60)));
}
export function nextRoundLabel(): string {
  return `${nextRoundHour()} (in ${nextRoundWait()})`;
}

/** A brokerage's loads posted to the board: open, not held as an offer, not tendered to its own carrier (QA's S1: offers aren't posts). */
function postedCount(w: World, id: number): number {
  let n = 0;
  for (const l of w.loads.values()) if (l.brokerId === id && l.status === "open" && !l.hold && !(l.ownTenderRate !== undefined && l.tenderedTo !== 0)) n++;
  return n;
}

/**
 * The sheet's state line on a phone (copy-first-ten-minutes.md): the bids waiting on the round when there are any,
 * else the selected truck (or the first) in a few words.
 */
export function sheetLine(): string {
  const g = S.game!;
  const c = g.player;
  if (!c) return g.kind === "test" || g.writer ? (S.entry.stage === "welcome" ? FIRST_ENTRY.welcomeTitle : "Choose your home hub") : "Watching the live world";
  // With two companies the line opens with the one in view (brokerage-ux.md section 1).
  if (hasTwo(g)) return kindInView(g) === "brokerage" ? BROKERAGE.stateLine(c.name, postedCount(g.w, c.id)) : `${c.name} · ${carrierLine(g, c)}`;
  return carrierLine(g, c);
}

/** The carrier's own state line: the bids waiting on the round, else the selected truck in a few words. */
function carrierLine(g: NonNullable<typeof S.game>, c: Company): string {
  const trucks = myTrucks();
  const bids = trucks.filter((t) => g.w.manualBids.has(t.id)).length;
  if (bids) return `${bids === 1 ? "1 bid in" : `${bids} bids in`} · clears ${nextRoundHour()}`;
  const t = trucks.find((x) => x.id === S.selTruck) ?? trucks[0];
  if (!t) return "No trucks on the road";
  const name = `Truck ${truckNo(t.id)}`;
  // Under the first-bid rule the dispatcher waits for your first bid, and the truck waits at home (copy spec, S6).
  if (t.status === "idle" && ordersWaitForHand(g.w, c)) return `${name} · Waiting at ${g.w.net.places[t.place]!.name} · round ${nextRoundHour()}`;
  if (t.status === "idle" && !resting(g.w, t)) return `${name} · Idle at ${g.w.net.places[t.place]!.name} · round ${nextRoundHour()}`;
  return `${name} · ${statusText(t)}`;
}

/** How easily a truck of this type reloads after delivering at a hub, against the national average. */
export function reloadLabel(hub: number, eq: Equipment): string {
  const r = reloadOdds(S.game!.w, hub, eq);
  return r >= 1.25 ? "good" : r >= 0.8 ? "fair" : "poor";
}
export function reloadClass(hub: number, eq: Equipment): string {
  const r = reloadOdds(S.game!.w, hub, eq);
  return r >= 1.25 ? "good" : r >= 0.8 ? "" : "bad";
}
/** The origin's season for this trailer, when it's moving rates noticeably. */
export function seasonSwing(hub: number, eq: Equipment): number {
  return seasonality(S.game!.w, hub, eq, Math.floor(clockMin() / 1440)).rate - 1;
}
export function SeasonNote({ hub, eq }: { hub: number; eq: Equipment }): ComponentChildren {
  const swing = seasonSwing(hub, eq);
  if (Math.abs(swing) < 0.05) return null;
  return (
    <span class={swing > 0 ? "good" : "bad"}>
      {swing > 0 ? "in season" : "off season"} {signedPct(swing)}
    </span>
  );
}

// --- People ------------------------------------------------------------------------

export function Stars({ skill }: { skill: number }): ComponentChildren {
  const n = stars(skill);
  return (
    <span class="stars" title={`${Math.round(skill * 100)}% skill`}>
      {"★".repeat(n)}
      {"☆".repeat(5 - n)}
    </span>
  );
}
export const moraleWord = (m: number): string => (m >= 0.65 ? "happy" : m >= 0.45 ? "settled" : m >= 0.3 ? "restless" : "unhappy");
export const moraleClass = (m: number): string => (m >= 0.45 ? "good" : m >= 0.3 ? "warn" : "bad");
export const staffPay = (s: Staff, x: number): string => (s.kind === "driver" ? `${x.toFixed(2)} FD/mi` : `${fd(x)} FD/wk`);
/** At a hub (or in the shop), where a crew can change. */
export const atHub = (t: Truck): boolean => t.status === "idle" || t.status === "parked" || t.status === "repair";

/** Days out and fatigue, for a driver. */
export function FatigueTag({ s }: { s: Staff }): ComponentChildren {
  const f = GAME_CONFIG.fatigue;
  const out = s.awayDays > 0 ? ` · ${s.awayDays} d out` : "";
  if (s.fatigue >= f.tiredAt)
    return (
      <>
        {out} · <span class="bad">tired {pct(s.fatigue)}</span>
      </>
    );
  if (s.fatigue >= f.tiredAt / 2)
    return (
      <>
        {out} · <span class="warn">wearing {pct(s.fatigue)}</span>
      </>
    );
  return <>{out}</>;
}

/** Who drives a truck, for its fleet card. */
export function CrewLine({ t }: { t: Truck }): ComponentChildren {
  const w = S.game!.w;
  if (!crewed(t)) return <span class="bad">No driver: the truck can't run.</span>;
  const d = w.staff[t.driverId - 1]!;
  const co = t.coDriverId ? w.staff[t.coDriverId - 1]! : null;
  const who = (s: Staff) => (
    <>
      {s.owner ? "You" : s.name} <Stars skill={s.skill} />
      <FatigueTag s={s} />
    </>
  );
  return (
    <>
      Driver: {who(d)}
      {co ? <> · team with {who(co)}</> : null} · {t.wagePerMile.toFixed(2)} FD/mi
      {t.defects > 0 ? <span class="warn"> · {plural(t.defects, "defect")}</span> : null}
    </>
  );
}

export const marketPayOf = (s: Staff): number => marketPay(S.game!.w, s.kind, s.skill);
export const truckName = (t: Truck): string => `Truck ${truckNo(t.id)}`;
