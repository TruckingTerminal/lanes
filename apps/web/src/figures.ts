import { breakdownsPer1000Mi, collateralOf, companyAccount, condition, crewed, lotDeliveryDays, lotSpec, NEW_TRUCK, type Collateral, fuelPrice, layerOpen, locksOn, lotPrice, maintenancePerMile, npcDealerMult, opsCap, ordersOf, ownerDrawFd, resting, tripCost, yardTrucks, type Company, type Truck, type TruckSpec, type World } from "@lanes/engine";
import { boardRows, type BoardRow } from "./board.js";
import { buyPlan, cheapestNewRig } from "./finance.js";
import { invoices, weekCosts } from "./ledger.js";
import { PENDING } from "./copy-pending.js";
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
export function leaseOnRun(w: World, c: Company): { truckId: number; to: string | null } | null {
  const t = (w.trucksByCompany.get(c.id) ?? []).find((x) => x.lease === "npc");
  if (!t || t.status === "idle") return null;
  // Client batch 7b (the writer): only a run is "on a run to {place}"; in the shop or parked it's just not idle.
  const run = RUN_STATUSES.has(t.status);
  return { truckId: t.id, to: run ? (w.net.places[t.targetPlace]?.name ?? w.net.hubs[t.targetHub]!.name) : null };
}
/** The statuses that are a run: to the pickup, loading, loaded, unloading, repositioning. */
const RUN_STATUSES: ReadonlySet<Truck["status"]> = new Set(["toPickup", "loading", "loaded", "unloading", "repositioning"]);

/** A listing's block in the writer's words where the engine's is the lease on a run; any other block as the engine says it. */
export function listingWhy(w: World, c: Company, block: string | null): string | null {
  if (block !== "NPC-leased truck is on a trip") return block;
  const run = leaseOnRun(w, c);
  return run ? PENDING.listingWhenIdle(run.truckId, run.to) : block;
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
export const WORN_BELOW = 0.6;
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

/**
 * The first-truck figure's words, one function for the Dealer's teaser, Iuliia's page and the Dealer's card (as chipPair
 * is for a load's cash): "To your first truck: N FD", or once met "You can buy today" for a truck that delivers today and
 * "You can order today · delivered {date}" for one from the queue (client batch 6b, the director); and Iuliia's cushion
 * advice under it once a week of spending is known. The figure stays the least cash needed today; `sooner` names a truck
 * that delivers sooner than the priced one, with its cash today, and `wait` prices the priced one's wait in the lessor's
 * share. With a truck already ordered to replace the lease, the figure counts its wait instead. Null with no truck for
 * sale anywhere.
 */
export function firstTruckLine(w: World, c: Company): { figure: string; met: boolean; advice: string | null; needFd: number; gapFd: number; what: string | null; worn: string | null; cashOnly: string | null; sooner: string | null; wait: string | null; ordered: boolean } | null {
  const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  const ordered = orderedFirstTruck(w, c);
  if (ordered) {
    const figure = ordered.due ? PENDING.truckOrderedDue : PENDING.truckOrdered(shortDate(ordered.dueDay), ordered.days);
    return { figure, met: true, advice: null, needFd: 0, gapFd: 0, what: null, worn: null, cashOnly: null, sooner: null, wait: null, ordered: true };
  }
  const g = gapToTruck(w, c);
  if (!Number.isFinite(g.needNowFd)) return null;
  const met = g.gapFd <= 0;
  // Client batch 4 (the director): the Dealer's card names the truck it prices; Iuliia names a worn one's catch, in figures.
  const t = g.truck;
  const kmi = t ? `${Math.round(t.spec.odometer / 1000)}k` : "";
  const cond = t ? condition(w.cfg, t.spec) : 1;
  // The words fit the rule: the truck that takes the least cash today, or, the hold covering several, the cheapest of them.
  const desc = !t ? null : t.route === "new" ? PENDING.truckNew(TIER_NAME[t.spec.tier], TRAILER_NAME[t.spec.trailer].toLowerCase()) : PENDING.truckUsed(TIER_NAME[t.spec.tier], TRAILER_NAME[t.spec.trailer].toLowerCase(), kmi, pct(cond), t.place !== null ? truckPlace(w, t.place) : null);
  // A truck that delivers today says no date; one from the queue says its day.
  const later = t?.arrivesDay !== undefined && t.arrivesDay > today;
  // A listing changes hands when the leased truck is idle (client batch 7): while it runs, "when truck N is next idle".
  const run = leaseOnRun(w, c);
  const arrives = later ? shortDate(t!.arrivesDay!) : null;
  // The trailer, where it isn't the company's freight (the director): the company hauls what its trucks pull.
  const own = (w.trucksByCompany.get(c.id) ?? [])[0]?.trailer;
  const hauls = t && own && t.spec.trailer !== own ? TRAILER_NAME[own].toLowerCase() : null;
  const what = desc === null ? null : g.needNowFd <= 0.5 ? PENDING.pricesCovered(desc, arrives, hauls) : PENDING.pricesLeastCash(desc, arrives, hauls);
  // A truck that delivers sooner than the priced one: the soonest, and of those the least cash today (the director).
  let sooner: string | null = null;
  if (later) {
    const alt = g.routes.filter((r) => r.truck.arrivesDay !== undefined && r.truck.arrivesDay < t!.arrivesDay! && Number.isFinite(r.needFd)).sort((a, b) => a.truck.arrivesDay! - b.truck.arrivesDay! || a.needFd - b.needFd || a.price - b.price)[0];
    // Client batch 7: it names the company's freight too when its trailer isn't it, and a listing waits for the lease's run.
    const altHauls = own && alt && alt.truck.spec.trailer !== own ? TRAILER_NAME[own].toLowerCase() : null;
    const when = !alt ? null : alt.truck.route === "listing" && run ? PENDING.whenIdle(run.truckId) : alt.truck.arrivesDay! <= today ? null : shortDate(alt.truck.arrivesDay!);
    if (alt) sooner = PENDING.soonerTruck(TRAILER_NAME[alt.truck.spec.trailer].toLowerCase(), fdFull(Math.max(0, alt.needFd)), when, altHauls);
  }
  // Iuliia prices the wait: the lessor's share for the days to the priced truck's delivery, at the company's gross lately.
  const days = later ? t!.arrivesDay! - today : 0;
  const cost = waitCostFd(w, c, days);
  const wait = later && cost >= 0.5 ? PENDING.waitCost(shortDate(t!.arrivesDay!), pct(w.cfg.costs.npcLeaseShareOfGross), days, fdFull(Math.round(cost / 10) * 10), weeklyGross(w, c).basis) : null;
  const worn = t && t.route !== "new" && cond < WORN_BELOW ? PENDING.wornCatch(kmi, pct(cond), fdFull(Math.round(repairsPer(w, t.spec) / 100) * 100), REPAIR_PER_MI.toLocaleString("en-US")) : null;
  // equipmentFinance.purchase.collateral: the lender won't finance the truck it prices, so the figure is its cash.
  const figure = !met ? PENDING.firstTruckToGo(fdFull(g.gapFd)) : later ? PENDING.firstTruckOrderToday(arrives!) : t?.route === "listing" && run ? PENDING.firstTruckWhenIdle(run.truckId, run.to) : PENDING.firstTruckMet;
  return { figure, met, advice: g.holdFd >= 0.5 ? PENDING.firstTruckCushion(fdFull(roundCushion(g.holdFd))) : null, needFd: g.needNowFd, gapFd: g.gapFd, what, worn, cashOnly: g.cashOnly ? PENDING_RULES.cashOnlyFigure : null, sooner, wait, ordered: false };
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
