import { economyConfig, type Equipment } from "@lanes/config";
import { contractRatingBlock, contractRoom, contractSlots, isLocal, localShare } from "@lanes/engine";
import { breakdownsPer1000Mi, collateralOf, companyAccount, condition, crewed, lotDeliveryDays, lotSpec, NEW_TRUCK, type Collateral, fuelPrice, layerOpen, locksOn, lotPrice, maintenancePerMile, npcDealerMult, opsCap, ordersOf, ownerDrawFd, resting, tripCost, truckValue, yardTrucks, type Company, type Listing, type Truck, type TruckSpec, type World } from "@lanes/engine";
import { boardRows, type BoardRow } from "./board.js";
import { buyPlan, cheapestNewRig, MILES_PER_MONTH } from "./finance.js";
import { invoices, weekCosts } from "./ledger.js";
import { PENDING } from "./copy-pending.js";
import { truckNumber } from "./trucknos.js";
import { PENDING_RULES } from "./copy-pending-rules.js";
import { fdFull, pct, shortDate, TIER_NAME, TRAILER_NAME } from "./format.js";

/**
 * The figures Iuliia computes (specs/guidance.md, section 4): read from the world and the company, saving nothing, with
 * no browser state, so What now? is right after every reload and the economy can run it as a bot. Each is also an
 * explain key (the writer's guidance-strings.md), and its parts are the breakdown that key's "how" describes.
 */

const day = (w: World): number => Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
const cash = (w: World, c: Company): number => w.ledger.balance(companyAccount(c.id));

/** The day whose close runs the weekly checks (solvency, overhead, the used lot): step.ts closes a week when (day + 1) % 7 is 0. */
export function nextWeeklyCheckDay(w: World): number {
  let d = day(w);
  while ((d + 1) % 7 !== 0) d++;
  return d;
}

/**
 * A company in its first month (R4, Jeff's yes): no lit dollar button on its screens; FD is the button, and the dollar
 * prices wait under Money's token fold.
 */
export const inFirstMonth = (w: World, c: Company): boolean => day(w) - c.createdDay < w.cfg.time.daysPerMonth;

/**
 * Every cap on the fleet (the director's R19), the one that binds first: the yard, the stake tiers (only while they're
 * the rule, not under the lock discounts), the operations managers, the company limit. `running` counts trucks on order,
 * as the engine's checks do.
 */
export type CapKind = "yard" | "stake" | "managers" | "company";
export interface FleetCaps {
  cap: number;
  running: number;
  binding: { kind: CapKind; n: number };
  others: { kind: CapKind; n: number }[];
}
export function fleetCaps(w: World, c: Company): FleetCaps {
  const k = w.cfg.token.staking;
  const rows: { kind: CapKind; n: number }[] = [];
  rows.push({ kind: "yard", n: w.cfg.token.catalogue.enabled ? yardTrucks(w, c) : w.cfg.company.maxTrucks });
  if (k.enabled && !locksOn(w)) {
    let n = 0;
    for (const [trucks, stake] of k.truckTiers) if (c.stakedFd + 1e-9 >= stake) n = Math.max(n, trucks);
    rows.push({ kind: "stake", n });
  }
  const ops = opsCap(w, c);
  if (Number.isFinite(ops)) rows.push({ kind: "managers", n: ops });
  rows.push({ kind: "company", n: w.cfg.company.maxTrucks });
  const binding = rows.reduce((a, b) => (b.n < a.n ? b : a));
  const running = (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired").length + ordersOf(w, c.id).length;
  return { cap: binding.n, running, binding, others: rows.filter((r) => r !== binding) };
}

/**
 * What a company spends a day, for the net-30 warning: its own average over the weeks it has (cushion), else, in its
 * first week, its fixed weekly costs and each crewed truck's running costs over a working day (fuel, upkeep and a hired
 * driver's pay at the legal day's miles; an owner's draw stays with the company).
 */
export function dailySpendFd(w: World, c: Company): number {
  const avg = cushion(w, c).avgWeeklyFd;
  if (avg > 0.5) return avg / 7;
  const k = weekCosts(w, c);
  let run = 0;
  const mi = w.cfg.hos.avgMph * w.cfg.hos.drivingHoursPerDay;
  for (const t of w.trucksByCompany.get(c.id) ?? []) {
    if (t.status === "retired" || t.status === "parked" || t.status === "listed" || !crewed(t)) continue;
    const r = tripCost(w.cfg, t, fuelPrice(w), mi, mi);
    run += r.fuel + r.maintenance + r.wages - ownerDrawFd(w, t, mi);
  }
  return (k.leaseMinimum + k.insurance + k.yard) / 7 + k.perDiemPerDay + run;
}

/**
 * The net-30 warning (the diaries, 2026-11-09: a small fleet kept 57,255 in January and stood at −7,742 with no word
 * before): cash today, less what the company spends a day, plus each invoice on its due day, over the next
 * `horizonDays`. When that goes under zero before an invoice due later would bring it back, the day it does, how far
 * under it goes, and the next invoice's day. Null while it holds, with no invoices, or once already under (What now?'s
 * danger rule says that). New deliveries' invoices aren't counted: they land after the horizon anyway.
 */
export function cashDipAhead(w: World, c: Company, horizonDays = 30): { day: number; lowFd: number; landsDay: number } | null {
  const inv = invoices(w, c);
  const start = cash(w, c);
  if (!inv.length || start < 0) return null;
  const perDay = dailySpendFd(w, c);
  if (!(perDay > 0)) return null;
  const today = day(w);
  let bal = start;
  let k = 0;
  let under = -1;
  let low = 0;
  for (let d = today + 1; d <= today + horizonDays; d++) {
    bal -= perDay;
    while (k < inv.length && inv[k]!.dueDay <= d) bal += inv[k++]!.amountFd;
    if (bal < 0 && under < 0) under = d;
    if (under >= 0) low = Math.min(low, bal);
  }
  if (under < 0) return null;
  const lands = inv.find((i) => i.dueDay > under);
  return lands ? { day: under, lowFd: -low, landsDay: lands.dueDay } : null;
}

/** guide.cushion: weeks of the company's own spending its cash covers, from its average over guide.cushionAvgWeeks. */
export function cushion(w: World, c: Company): { weeks: number | null; avgWeeklyFd: number; cashFd: number } {
  const n = w.cfg.guide.cushionAvgWeeks;
  const recent = c.weeklySpend.slice(-n);
  const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const fd = cash(w, c);
  return { weeks: avg > 0.5 ? Math.max(0, fd) / avg : null, avgWeeklyFd: avg, cashFd: fd };
}

/** guide.debtCountdown: weekly checks in a row under the line, the next check's day, and how far under the line cash is now. */
export function debtCountdown(w: World, c: Company): { n: number; of: number; nextDay: number; under: boolean; shortFd: number } {
  const k = w.cfg.insolvency;
  const fd = cash(w, c);
  return { n: c.weeksInDebt, of: k.weeksInDebt, nextDay: nextWeeklyCheckDay(w), under: fd < -k.debtLimitFd, shortFd: Math.max(0, -k.debtLimitFd - fd) };
}

/**
 * guide.gapToTruck, the one first-truck figure (the director, 2026-11-09): the cheapest open route to the next truck (the
 * used lot, a listing, or new at the cheapest source), as the cash it takes from the player on the day on a purchase
 * loan (the Dealer's own "Cash needed now": down payment, stake and tax, less the lease deposit when it replaces the
 * lessor's truck), less the cash the player has. The Dealer's teaser, Iuliia's page and the Dealer's card all read it
 * (firstTruckLine), and the Dealer opens on it (tabs.ts firstTruckAffordable), so the number and the opening never
 * disagree. holdFd, guide.gapCushionWeeks of the company's spending, is Iuliia's advice under it, never in it.
 */
/** The truck a first-truck figure prices (client batch 4): what the Dealer's card names, and its wear for Iuliia's catch. */
export type PricedTruck = { route: "lot" | "listing" | "new"; spec: TruckSpec; place: number | null; arrivesDay?: number };

export function gapToTruck(w: World, c: Company): { gapFd: number; route: "lot" | "listing" | "new"; needNowFd: number; grossNeedFd: number; depositFd: number; spareFd: number; holdFd: number; truck: PricedTruck | null; priceFd: number; cashOnly: string | null; routes: { truck: PricedTruck; needFd: number; price: number }[] } {
  const replacing = (w.trucksByCompany.get(c.id) ?? []).some((t) => t.lease === "npc");
  const routes: { route: "lot" | "listing" | "new"; price: number; truck: PricedTruck; col: Collateral }[] = [];
  const lot = w.cfg.usedMarket.npcLot;
  if (lot.enabled && w.cfg.assets.enabled && w.usedLot.stock > 0)
    routes.push({ route: "lot", price: lotPrice(w, "workhorse", "van") * npcDealerMult(w), truck: { route: "lot", spec: { tier: "workhorse", trailer: "van", lease: "owned", odometer: lot.odometer, milesSinceRebuild: lot.milesSinceRebuild, rebuilds: lot.rebuilds }, place: null, arrivesDay: Math.floor(w.t / w.cfg.time.gameMinutesPerDay) + lotDeliveryDays(w, replacing) }, col: collateralOf(w, lotSpec(w, "van")) });
  for (const l of w.listings) {
    if (l.status !== "open" || l.truckId <= 0 || l.sellerId === c.id || l.formerOwnerId === c.id) continue;
    const t = w.trucks[l.truckId - 1]!;
    // A listing changes hands on the purchase (market.ts buyListing): it delivers today.
    routes.push({ route: "listing", price: l.askFd, truck: { route: "listing", spec: { ...t, lease: "owned" }, place: t.place, arrivesDay: Math.floor(w.t / w.cfg.time.gameMinutesPerDay) }, col: collateralOf(w, t) });
  }
  const rig = cheapestNewRig(w, c);
  if (rig) routes.push({ route: "new", price: rig.price, truck: { route: "new", spec: { tier: rig.tier, trailer: rig.trailer, lease: "owned", odometer: 0, milesSinceRebuild: 0 }, place: null, arrivesDay: Math.floor(w.t / w.cfg.time.gameMinutesPerDay) + rig.days }, col: NEW_TRUCK });
  let best = { route: "new" as "lot" | "listing" | "new", need: Infinity, gross: Infinity, deposit: 0, truck: null as PricedTruck | null, price: Infinity, cashOnly: null as string | null };
  const priced: { truck: PricedTruck; needFd: number; price: number }[] = [];
  for (const r of routes) {
    // equipmentFinance.purchase.collateral: the loan on this truck (a declined one is cash only: its cash figure counts).
    const p = buyPlan(w, c, r.price, replacing, r.col);
    const need = p.loanNowFd ?? p.cashNowFd;
    priced.push({ truck: r.truck, needFd: need, price: r.price });
    // The least cash today; on a tie (the hold covering several trucks, all at 0), the cheapest of them (QA, client
    // batch 5: the card named a 52.2k lot rig over a 10.3k listing). What the route asks before the hold is released into
    // it is the explanation's two rows.
    if (need < best.need - 0.005 || (need <= best.need + 0.005 && r.price < best.price)) best = { route: r.route, need, gross: p.loan ? p.loan.cashNeed : p.cashNeed, deposit: Math.min(p.deposit, p.loan ? p.loan.cashNeed : p.cashNeed), truck: r.truck, price: r.price, cashOnly: p.cashOnly };
  }
  const hold = w.cfg.guide.gapCushionWeeks * cushion(w, c).avgWeeklyFd;
  const have = cash(w, c);
  return { gapFd: Math.max(0, best.need - have), route: best.route, needNowFd: best.need, grossNeedFd: best.gross, depositFd: best.deposit, spareFd: Math.max(0, have), holdFd: hold, truck: best.truck, priceFd: best.price, cashOnly: best.cashOnly, routes: priced };
}

/**
 * The lessor's truck out on a run (client batch 7, QA): a listing changes hands only while it's idle (market.ts
 * listingBlock), so a listing can be bought when it's next idle. Its number and where it's headed; null when idle or none.
 */
/** `no`: the number the player knows the truck by (trucknos.ts; client batch 8a item 1: the lines printed the engine's id). */
export function leaseOnRun(w: World, c: Company): { truckId: number; no: number; to: string | null } | null {
  const t = (w.trucksByCompany.get(c.id) ?? []).find((x) => x.lease === "npc");
  if (!t || t.status === "idle") return null;
  // Client batch 7b (the writer): only a run is "on a run to {place}"; in the shop or parked it's just not idle.
  const run = RUN_STATUSES.has(t.status);
  return { truckId: t.id, no: truckNumber(w, t), to: run ? (w.net.places[t.targetPlace]?.name ?? w.net.hubs[t.targetHub]!.name) : null };
}
/** The statuses that are a run: to the pickup, loading, loaded, unloading, repositioning. */
const RUN_STATUSES: ReadonlySet<Truck["status"]> = new Set(["toPickup", "loading", "loaded", "unloading", "repositioning"]);

/** A listing's block in the writer's words where the engine's is the lease on a run; any other block as the engine says it. */
export function listingWhy(w: World, c: Company, block: string | null): string | null {
  if (block !== "NPC-leased truck is on a trip") return block;
  const run = leaseOnRun(w, c);
  return run ? PENDING.listingWhenIdle(run.no, run.to) : block;
}

/**
 * A truck ordered to replace the lessor's, still at the dealer (client batch 6b, the director: once ordered, the wait is
 * counted): its due day and the days to it. `due` once the day has come: it takes over when the leased truck is next idle
 * at a day's close (dealer.ts deliverOrders), so it can come later than the date it was given.
 */
export function orderedFirstTruck(w: World, c: Company): { dueDay: number; days: number; due: boolean } | null {
  const o = ordersOf(w, c.id).find((x) => x.replaceNpcLease && x.kind !== "trailer");
  if (!o) return null;
  const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  return { dueDay: o.dueDay, days: Math.max(0, o.dueDay - today), due: o.dueDay <= today };
}

/**
 * What the company grosses in a week, on the better-founded basis (client batch 7, QA: last month alone read a month the
 * truck sat idle, 1,170 FD for 86 days): last month's revenue over its weeks, or the revenue since the company started over
 * its weeks, whichever covers more weeks (since the start, once the company is older than its last month), and which.
 */
export function weeklyGross(w: World, c: Company): { fd: number; basis: "month" | "start" } {
  const monthWeeks = w.cfg.time.daysPerMonth / 7;
  const startWeeks = Math.max(1, (Math.floor(w.t / w.cfg.time.gameMinutesPerDay) - c.createdDay) / 7);
  if (c.lastMonth && monthWeeks > startWeeks) return { fd: c.lastMonth.revenueFd / monthWeeks, basis: "month" };
  return { fd: c.operating.revenueFd / startWeeks, basis: "start" };
}

/**
 * What waiting for a queued truck keeps paying the lessor (client batch 6b, the director: Iuliia prices the wait): the
 * lease's share of gross (costs.npcLeaseShareOfGross) times the company's weekly gross lately (weeklyGross) times the
 * share of its fleet on the lessor's lease, over the days to the truck's delivery. 0 with nothing leased or no gross yet.
 */
export function waitCostFd(w: World, c: Company, days: number): number {
  const fleet = w.trucksByCompany.get(c.id) ?? [];
  const leased = fleet.filter((t) => t.lease === "npc").length;
  if (!leased || days <= 0) return 0;
  return w.cfg.costs.npcLeaseShareOfGross * weeklyGross(w, c).fd * (leased / fleet.length) * (days / 7);
}

/** A used truck under this condition gets Iuliia's catch line (the director, client batch 4: a worn truck on day 2). */
// Client batch 8b (the writer's flag 2a): one line for "sound" and "worn", the economy's guide.soundCondition, so a
// truck is never neither.
export const WORN_BELOW = economyConfig.guide.soundCondition;
/** Repairs every this many miles, the figure the catch names: the engine's wear is per mile, and it keeps no month's miles. */
export const REPAIR_PER_MI = 10_000;

/**
 * What a truck costs in repairs every REPAIR_PER_MI miles, by the engine's own figures (wear.ts): its breakdowns at the
 * average tow and repair bill (breakdowns.repairFd, an owner's to pay), and its maintenance per mile, worn as it is.
 */
export function repairsPer(w: World, spec: TruckSpec): number {
  const [lo, hi] = w.cfg.breakdowns.repairFd;
  return REPAIR_PER_MI * ((breakdownsPer1000Mi(w.cfg, spec) / 1000) * ((lo + hi) / 2) + maintenancePerMile(w.cfg, spec));
}

/**
 * Where a truck stands, one wording for the Dealer's card and the lists it's found in (client batch 6, QA: the card said
 * the town and the used list the hub, so the card's truck couldn't be found): the town, with its market where they differ.
 */
export function truckPlace(w: World, place: number): string {
  const p = w.net.places[place]!;
  const market = w.net.hubs[p.market]!.name;
  return p.name === market ? p.name : PENDING.townInMarket(p.name, market);
}

/** The leased truck's number (the new truck keeps it at the hand-over); 1 with none. */
export function leasedNo(w: World, c: Company): number {
  const t = (w.trucksByCompany.get(c.id) ?? []).find((x) => x.lease === "npc");
  return t ? truckNumber(w, t) || 1 : 1;
}

/** The used listings the Dealer shows, in its order (client batch 8a item 57): one choice for its list and the verdict. */
export function dealerUsed(w: World, c: Company): { l: Listing; t: Truck }[] {
  return w.listings
    .filter((l) => l.status === "open" && l.truckId > 0 && l.formerOwnerId !== c.id && l.sellerId !== c.id)
    .map((l) => ({ l, t: w.trucks[l.truckId - 1]! }))
    .sort((a, b) => a.l.askFd / Math.max(1, truckValue(w, a.t)) - b.l.askFd / Math.max(1, truckValue(w, b.t)) || a.l.id - b.l.id)
    .slice(0, 8);
}

/** A truck the Dealer shows, for the first-truck verdict: its row's id on the page (`open`), to bring it into view. */
type ShownTruck = { route: "lot" | "listing" | "new"; spec: TruckSpec; place: number | null; arrivesDay: number; price: number; col: Collateral; open: string };

/** The trucks the Dealer shows: the used lot's rigs, its used list, and the cheapest new rig in the company's freight. */
function shownTrucks(w: World, c: Company, own: Equipment, replacing: boolean): ShownTruck[] {
  const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  const out: ShownTruck[] = [];
  if (w.cfg.usedMarket.npcLot.enabled && w.cfg.assets.enabled && w.usedLot.stock > 0)
    for (const tr of ["van", "reefer", "flatbed"] as const) {
      const u = lotSpec(w, tr);
      out.push({ route: "lot", spec: { tier: "workhorse", trailer: tr, lease: "owned", odometer: u.odometer, milesSinceRebuild: u.milesSinceRebuild, rebuilds: u.rebuilds }, place: null, arrivesDay: today + lotDeliveryDays(w, replacing), price: lotPrice(w, "workhorse", tr) * npcDealerMult(w), col: collateralOf(w, u), open: `lot-${tr}` });
    }
  for (const { l, t } of dealerUsed(w, c)) out.push({ route: "listing", spec: { ...t, lease: "owned" }, place: t.place, arrivesDay: today, price: l.askFd, col: collateralOf(w, t), open: `used-${l.id}` });
  const rig = cheapestNewRig(w, c, own);
  if (rig) out.push({ route: "new", spec: { tier: rig.tier, trailer: rig.trailer, lease: "owned", odometer: 0, milesSinceRebuild: 0 }, place: null, arrivesDay: today + rig.days, price: rig.price, col: NEW_TRUCK, open: `new-${rig.tier}-${rig.trailer}` });
  return out;
}

/**
 * The first-truck card (the director's ruling A, 2026-11-10; client batch 8a item 57, which replaces items 23 and 39 and
 * the three-advice card): one verdict for the cheapest sound truck in the company's own freight that the Dealer shows.
 * Sound: guide.soundCondition (a placeholder until the economy gives it). The tests, in her order: the truck exists and
 * is shown, the cash on the day, the cushion afterwards (guide.gapCushionWeeks of the company's spending). One verdict:
 * "Buy it now.", "Order it now · ready {date}", or "Not yet: buy at N FD in cash, about n loads from here."; the card
 * named for what it prices ("To a sound first truck: N FD", N the cash still to find); every supporting figure under
 * "Why", never beside the verdict. With none listed: "No sound {trailer} truck on the lot today; I'll tell you when one
 * lists." `open` is the truck's row on the Dealer, so the card's truck is always one the player can open. One function
 * for the Dealer's card, its teaser, Iuliia's page and What now?. With a truck already ordered, its wait alone.
 */
/**
 * Client batch 8c item 70: `progress`, how far the company's cash is toward the cash the verdict needs (0–1; null with no
 * sound truck shown or one ordered); `watch`, the listing watch's line; `pick`, the truck it prices (Iuliia's watch reads
 * its price).
 */
export type FirstTruckVerdict = {
  figure: string;
  verdict: string;
  why: string[];
  open: string | null;
  met: boolean;
  needFd: number;
  gapFd: number;
  ordered: boolean;
  progress: number | null;
  watch: string | null;
  pick: { route: ShownTruck["route"]; price: number; desc: string } | null;
};
export function firstTruckLine(w: World, c: Company): FirstTruckVerdict | null {
  const ordered = orderedFirstTruck(w, c);
  if (ordered) {
    // Client batch 8b item 17: past its day, "ready since", with the leased truck's number and how the hand-over comes.
    const n = leasedNo(w, c);
    const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
    const figure = ordered.due ? PENDING.truckOrderedDue(ordered.dueDay < today ? shortDate(ordered.dueDay) : null, n, w.cfg.assets.swapAtNextIdle) : PENDING.truckOrdered(shortDate(ordered.dueDay), ordered.days);
    return { figure, verdict: "", why: [], open: null, met: true, needFd: 0, gapFd: 0, ordered: true, progress: null, watch: null, pick: null };
  }
  const fleet = w.trucksByCompany.get(c.id) ?? [];
  const own: Equipment = fleet[0]?.trailer ?? "van";
  const replacing = fleet.some((t) => t.lease === "npc");
  const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  const sound = w.cfg.guide.soundCondition;
  const shown = shownTrucks(w, c, own, replacing);
  const isSound = (x: ShownTruck) => x.spec.trailer === own && condition(w.cfg, x.spec) >= sound - 1e-9;
  const pick = shown.filter(isSound).sort((a, b) => a.price - b.price || a.arrivesDay - b.arrivesDay)[0];
  const trailer = TRAILER_NAME[own].toLowerCase();
  // The director's sound-lot ruling: the lot's rig in the company's freight, as a fact with its figures, first under Why.
  const lot = shown.find((x) => x.route === "lot" && x.spec.trailer === own && x !== pick);
  const lotLine = lot ? lotFact(w, c, lot, replacing, today) : null;
  if (!pick) return { figure: PENDING.soundTitle, verdict: PENDING.soundNone(trailer), why: lotLine ? [lotLine] : [], open: null, met: false, needFd: Infinity, gapFd: Infinity, ordered: false, progress: null, watch: null, pick: null };
  // 2. The cash on the day: the least cash it takes today (a purchase loan where the lender gives one), against cash.
  const plan = buyPlan(w, c, pick.price, replacing, pick.col);
  const need = plan.loanNowFd ?? plan.cashNowFd;
  const have = cash(w, c);
  // 3. The cushion afterwards: what's left against guide.gapCushionWeeks of the company's own spending.
  const hold = w.cfg.guide.gapCushionWeeks * cushion(w, c).avgWeeklyFd;
  const at = need + hold;
  const gap = Math.max(0, at - have);
  const met = gap <= 0.5;
  const later = pick.arrivesDay > today;
  // About how many loads from here, at what a load has kept the company so far; none said before a load is delivered.
  const perLoad = c.delivered > 0 ? (c.operating.revenueFd - c.operating.costFd) / c.delivered : 0;
  const loads = !met && perLoad > 0.5 ? Math.max(1, Math.ceil(gap / perLoad)) : null;
  // And in weeks at the recent average kept a week (the director's sound-lot ruling).
  const perWeek = (c.operating.revenueFd - c.operating.costFd) / Math.max(1, (today - c.createdDay) / 7);
  const weeksOff = !met && loads !== null && perWeek > 0.5 ? Math.max(1, Math.ceil(gap / perWeek)) : null;
  // Client batch 8c item 70 (the director): with an average to go on, where the player stands and what each load does.
  const progress = met ? 1 : Math.max(0, Math.min(1, have / Math.max(1, at)));
  const shown100 = (x: number) => `${Math.floor(x * 100)}%`;
  const verdict = !met
    ? loads !== null
      ? PENDING.soundNotYetPlan(loads, weeksOff !== null ? spanOfWeeks(weeksOff) : null, fdFull(Math.round(perLoad / 10) * 10), shown100(progress))
      : PENDING.soundNotYet(fdFull(Math.round(at / 100) * 100), loads, weeksOff)
    : later
      ? PENDING.soundOrder(shortDate(pick.arrivesDay))
      : PENDING.soundBuy;
  const desc = (x: ShownTruck) =>
    x.route === "new" ? PENDING.truckNew(TIER_NAME[x.spec.tier], TRAILER_NAME[x.spec.trailer].toLowerCase()) : PENDING.truckUsed(TIER_NAME[x.spec.tier], TRAILER_NAME[x.spec.trailer].toLowerCase(), `${Math.round(x.spec.odometer / 1000)}k`, pct(condition(w.cfg, x.spec)), x.place !== null ? truckPlace(w, x.place) : null);
  const why: string[] = [...(lotLine ? [lotLine] : []), PENDING.whyTruck(desc(pick)), PENDING.whyPrice(fdFull(pick.price), fdFull(Math.max(0, need)))];
  if (hold >= 0.5) why.push(PENDING.whyCushion(fdFull(have - need), fdFull(Math.round(hold / 100) * 100)));
  // A listing changes hands while the leased truck is idle (client batch 7).
  const run = pick.route === "listing" ? leaseOnRun(w, c) : null;
  if (run) why.push(PENDING.firstTruckWhenIdle(run.no, run.to));
  // The lessor's share while it waits, for a truck that comes on a later day.
  const days = pick.arrivesDay - today;
  const cost = later ? waitCostFd(w, c, days) : 0;
  if (cost >= 0.5) why.push(PENDING.waitCost(shortDate(pick.arrivesDay), pct(w.cfg.costs.npcLeaseShareOfGross), days, fdFull(Math.round(cost / 10) * 10), weeklyGross(w, c).basis));
  if (plan.cashOnly) why.push(PENDING_RULES.cashOnlyFigure);
  // The worn alternative, named as such: the cheapest the page shows under the sound one's price that's worn or for other freight.
  const cheaper = shown.filter((x) => !isSound(x) && x !== lot && x.price < pick.price).sort((a, b) => a.price - b.price)[0];
  if (cheaper) {
    const worn = condition(w.cfg, cheaper.spec) < sound - 1e-9;
    const other = cheaper.spec.trailer !== own;
    why.push(PENDING.whyWorn(desc(cheaper), fdFull(cheaper.price), worn && other ? "both" : other ? "freight" : "worn"));
  }
  return {
    figure: met ? PENDING.soundTitle : PENDING.soundName(fdFull(Math.round(gap))),
    verdict,
    why,
    open: pick.open,
    met,
    needFd: need,
    gapFd: gap,
    ordered: false,
    progress: met ? null : progress,
    watch: met ? null : PENDING.soundWatch,
    pick: { route: pick.route, price: pick.price, desc: desc(pick) },
  };
}

const SMALL = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
/** A wait in words, as the director wrote it: weeks under two months, then months ("around five months"). */
function spanOfWeeks(weeks: number): string {
  if (weeks < 9) return weeks === 1 ? "a week" : `${weeks} weeks`;
  const months = Math.round(weeks / 4.35);
  return `${SMALL[months] ?? months} months`;
}
/**
 * Where a carrier stands for a contract offer at its home market, for its trailer (client batch 8b item 41), as
 * contracts.ts weeklyContracts picks: the local carriers with room that run the trailer (`fit`), the offers expected a
 * week there (`expected`), and this carrier's rank by standing (reputation × (0.5 + 0.5 × tender acceptance), × the
 * newcomer boost with no contract held). Null when it isn't in the running (not local, no room, a rating block).
 */
export function contractStanding(w: World, c: Company): { fit: number; rank: number; expected: number } | null {
  const k = w.cfg.contracts;
  const m = c.homeHub;
  const eq = (w.trucksByCompany.get(c.id) ?? [])[0]?.trailer;
  if (!eq) return null;
  const held = (x: Company) => w.contracts.filter((q) => q.carrierId === x.id && (q.status === "active" || q.status === "offered")).length;
  const runs = (x: Company) => (w.trucksByCompany.get(x.id) ?? []).some((t) => t.trailer === eq && t.status !== "retired" && t.status !== "listed");
  const fit = w.companies.filter((x) => x.role === "carrier" && x.authority.status === "active" && x.liquidatingSince === null && isLocal(w, x, m) && held(x) < contractSlots(w, x) && contractRatingBlock(w, x) === null && runs(x) && contractRoom(w, x, eq) >= 1);
  if (!fit.some((x) => x.id === c.id)) return null;
  const score = (x: Company) => x.reputation * (0.5 + 0.5 * x.tenderAcceptance) * (w.contracts.some((q) => q.carrierId === x.id && q.status === "active") ? 1 : k.newcomerBoost);
  const mine = score(c);
  const rank = 1 + fit.filter((x) => x.id !== c.id && (score(x) > mine || (score(x) === mine && x.id < c.id))).length;
  return { fit: fit.length, rank, expected: fit.length * k.offerShareOfLocals * localShare(w, m, eq) * 2 };
}

/**
 * The lot's rig as a fact (the director's sound-lot ruling, 2026-11-12): its condition, when it's ready, the cash it takes
 * on a loan, and its repairs against a fresh truck's of the same make, a month at MILES_PER_MONTH, from the engine's own
 * wear figures (repairsPer).
 */
function lotFact(w: World, c: Company, x: ShownTruck, replacing: boolean, today: number): string {
  const plan = buyPlan(w, c, x.price, replacing, x.col);
  const cash = plan.loanNowFd ?? plan.cashNowFd;
  const days = x.arrivesDay - today;
  const ready = days <= 0 ? "ready today" : days === 7 ? "ready in a week" : `ready in ${days} ${days === 1 ? "day" : "days"}`;
  const fresh = repairsPer(w, { ...x.spec, odometer: 0, milesSinceRebuild: 0, rebuilds: 0 });
  const mine = repairsPer(w, x.spec);
  const ratio = fresh > 0 ? mine / fresh : 1;
  const times = Math.abs(ratio - 2) < 0.25 ? "twice" : Math.abs(ratio - 3) < 0.25 ? "three times" : `${ratio.toFixed(1)}×`;
  const month = Math.round((mine * (MILES_PER_MONTH / REPAIR_PER_MI)) / 100) * 100;
  return PENDING.whyLot(pct(condition(w.cfg, x.spec)), ready, fdFull(Math.round(Math.max(0, cash) / 100) * 100), times, fdFull(month));
}

/** Advice is a round number: to the hundred, to the thousand from ten thousand. */
const roundCushion = (fd: number): number => (fd >= 10_000 ? Math.round(fd / 1_000) * 1_000 : Math.max(100, Math.round(fd / 100) * 100));

/** The best load for an idle truck by the profit chip's one arithmetic (ruling 5): the most profit at book-now, if any pays. */
export function bestLoad(w: World, c: Company, truck: Truck): BoardRow | null {
  let best: BoardRow | null = null;
  for (const r of boardRows(w, c, truck, { dest: "any", maxDh: 300, query: "" })) {
    if (r.block || r.profitBook <= 0) continue;
    if (!best || r.profitBook > best.profitBook || (r.profitBook === best.profitBook && r.l.appointmentT < best.l.appointmentT)) best = r;
  }
  return best;
}

/** The trucks free to take a load now: idle, crewed, not on home time, no bid of the player's own in. */
export const freeTrucks = (w: World, c: Company): Truck[] =>
  (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status === "idle" && crewed(t) && !resting(w, t) && !w.manualBids.has(t.id));

/** Days to the next events What now? can name when nothing needs the player: the next round, the month's close, a layer, the factoring contract's end. */
export type NextEvent = { kind: "round"; atMin: number } | { kind: "monthClose"; atMin: number } | { kind: "layer"; layer: "businesses" | "brokerage"; atMin: number } | { kind: "factoring"; atMin: number };
export function nextEvent(w: World, c: Company): NextEvent {
  const perDay = w.cfg.time.gameMinutesPerDay;
  const today = day(w);
  const hour = (w.t % perDay) / 60;
  const rounds = w.cfg.time.boardRoundHours;
  const nextRound = rounds.find((h) => h > hour);
  const events: NextEvent[] = [{ kind: "round", atMin: (nextRound !== undefined ? today : today + 1) * perDay + (nextRound ?? rounds[0]!) * 60 }];
  let m = today;
  while ((m + 1) % w.cfg.time.daysPerMonth !== 0) m++;
  events.push({ kind: "monthClose", atMin: (m + 1) * perDay });
  for (const layer of ["businesses", "brokerage"] as const) {
    if (w.cfg.unlockLadder.enabled || w.cfg.unlockLadder.beta.enabled) {
      const at = w.cfg.unlockLadder.layers[layer].afterDays;
      if (!layerOpen(w, layer) && at > today) events.push({ kind: "layer", layer, atMin: at * perDay });
    }
  }
  if (c.factoring) events.push({ kind: "factoring", atMin: c.factoring.until * perDay });
  return events.filter((e) => e.atMin > w.t).sort((a, b) => a.atMin - b.atMin)[0] ?? events[0]!;
}

/** What the company is owed on open invoices (Getting paid), and whether quick pay could bring it in now. */
export function owed(w: World, c: Company): { fd: number; quickPayOpen: boolean } {
  const fd = invoices(w, c).reduce((s, r) => s + r.amountFd, 0);
  return { fd, quickPayOpen: w.cfg.token.payment.enabled && !c.factoring && c.payTerms !== "quick" };
}
