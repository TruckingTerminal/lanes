/**
 * Red team, pass 2026-11-10: the seven rules behind switches for ruleset 0.24.1 (c1af286, c915f72, ad349e3; the report is
 * studio/reviews/redteam-0241.md). The fast probes: small worlds driven through applyAction, no population unless a probe
 * says so, read-only on the engine. Every switch is on, as the ruleset would turn them. The clears-near manipulation runs
 * in the full population (clears.ts).
 *
 *   reach     board.bidReachFromTown: the geometry of a 300-mile reach from the truck's town against market to market;
 *   turn      labor.turnWhileEmpty: ten turns in an hour (miles, costs, the towns), the stations ahead, a breakdown carried;
 *   home      labor.sendHomeToWork: a driver's fatigue over 90 days never home, passed home every 20 days with no day off,
 *             and on the client's home-time rule (21 days out, 5 off); every other day an eight-hour driving day;
 *   town      businesses.parking.stopInTown: sites standing at a leg's start (the free night the reach check skips), and
 *             the town against the shoulder with three hours left: miles, fines, idling;
 *   hold      leverage.localHoldHandBids: one filed bid per truck, the ceiling's step through the hold;
 *   turntown  the group, turn + town: a turn an hour before the hours run out starts a leg at the nearest town, and the town rule sleeps there;
 *   loan      equipmentFinance.purchase.collateral: a listing bought leaves firstOwnedTruckDay null (the new-business
 *             points stay), a dealer order sets it at the order, the wreck-first dodge's prices, the year's edge, a broker.
 *
 * Run: npx tsx apps/sim/src/redteam/rules0241.ts [--probe reach,turn,home,town,hold,loan] [--out runs/redteam-0241]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import {
  addTruck,
  applyAction,
  collateralOf,
  companyAccount,
  createWorld,
  dayOf,
  dealerPrice,
  formCompany,
  hubMiles,
  isRoundBoundary,
  lotPrice,
  NEW_TRUCK,
  placeLegMiles,
  placeMiles,
  placeOfHub,
  placeRoute,
  purchaseTerms,
  sitesAlong,
  stationsOnLeg,
  stepHour,
  truckValue,
  type Company,
  type Load,
  type Truck,
  type World,
} from "@lanes/engine";
import type { EconomyConfig } from "@lanes/config";
import { liveConfig, RULES_0241 } from "./harness.js";

const CFG: EconomyConfig = liveConfig(RULES_0241);
const net = buildNetwork(hubs, CFG);
const DAY = CFG.time.gameMinutesPerDay;
const r2 = (x: number) => Math.round(x * 100) / 100;

/** One leased owner-operator at a hub (the rules test's), no population: the board posts NPC freight, nobody else bids. */
function oo(hub = "DAL", seed = 7, cfg = CFG) {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed, keepLedgerEntries: true });
  const c = formCompany(w, { name: "Probe Freight", role: "carrier", homeHubId: hub, strategy: "test", orders: [], freePath: true });
  c.authority.status = "active";
  c.firstHandBidDay = 0;
  const t = w.trucksByCompany.get(c.id)![0]!;
  const d = w.staff[t.driverId - 1]!;
  return { w, c, t, d };
}
const standAt = (t: Truck, hub: number) => {
  t.hub = hub;
  t.targetHub = hub;
  t.place = placeOfHub(hub);
  t.targetPlace = t.place;
  t.status = "idle";
  t.remainingMi = 0;
};
const farFrom = (w: World, hub: number, lo: number, hi: number) => w.net.hubs.findIndex((_, i) => hubMiles(w, i, hub) > lo && hubMiles(w, i, hub) < hi);
const sumRefs = (w: World, prefix: string) => w.ledger.entries.filter((e) => e.ref.startsWith(prefix)).reduce((s, e) => s + e.amount, 0);

/** board.bidReachFromTown: what a 300-mile reach from the truck's own town adds to, and takes from, market to market. */
function probeReach() {
  const w = createWorld({ cfg: CFG, net, feeds: neutralFeeds, seed: 1 });
  const H = w.net.hubs.length;
  const townsOf = (h: number) => w.net.places.map((p, i) => (p.market === h ? i : -1)).filter((i) => i >= 0);
  let pairsOver300 = 0;
  let pairsOpened = 0; // market to market over 300, some town pair within 300
  let pairsClosed = 0; // market to market within 300, the hubs' own places over 300 (a truck at the hub's own town loses the pickup's far towns)
  let maxExtra = 0;
  const opened: { from: string; to: string; hubMi: number; townMi: number }[] = [];
  let townPairsOpened = 0;
  let townPairsAll = 0;
  for (let a = 0; a < H; a++) {
    for (let b = 0; b < H; b++) {
      if (a === b) continue;
      const hm = hubMiles(w, a, b);
      const ta = townsOf(a);
      const tb = townsOf(b);
      let best = Infinity;
      for (const p of ta) for (const q of tb) {
        const m = placeMiles(w, p, q);
        townPairsAll++;
        if (m < best) best = m;
        if (hm > 300 && m <= 300) townPairsOpened++;
      }
      if (hm > 300) {
        pairsOver300++;
        if (best <= 300) {
          pairsOpened++;
          maxExtra = Math.max(maxExtra, hm - best);
          if (opened.length < 12) opened.push({ from: w.net.hubs[a]!.id, to: w.net.hubs[b]!.id, hubMi: Math.round(hm), townMi: Math.round(best) });
        }
      } else {
        // Within 300 market to market: a truck at the hub's own town bidding on a pickup at the far side of the other market.
        let worst = 0;
        for (const q of tb) worst = Math.max(worst, placeMiles(w, placeOfHub(a), q));
        if (worst > 300) pairsClosed++;
      }
    }
  }
  return { hubs: H, places: w.net.places.length, pairsOver300, pairsOpened, pairsClosed, maxExtraMi: Math.round(maxExtra), townPairsAll, townPairsOpened, sample: opened };
}

/** labor.turnWhileEmpty: ten turns inside one hour, and what each paid; the stations ahead before and after; a breakdown carried through a turn. */
function probeTurn() {
  const { w, c, t } = oo("DAL", 7);
  const far = farFrom(w, c.homeHub, 700, 1_100);
  const other = w.net.hubs.findIndex((_, i) => i !== far && i !== c.homeHub && hubMiles(w, i, c.homeHub) > 150 && hubMiles(w, i, c.homeHub) < 400);
  if (!applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[far]!.id }).ok) throw new Error("no run");
  for (let h = 0; h < 6 && t.emptyMi < 150; h++) stepHour(w);
  const driven0 = t.odometer;
  const stationsBefore = stationsOnLeg(w, t.place, t.targetPlace).length;
  const remainingBefore = t.remainingMi;
  const turns: { to: string; place: number; remainingMi: number; straightMi: number; offMi: number; paidFd: number; odometer: number }[] = [];
  let paidSoFar = sumRefs(w, `turn:${t.id}`);
  for (let k = 0; k < 10; k++) {
    const to = k % 2 === 0 ? other : far;
    const r = applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[to]!.id });
    if (!r.ok) throw new Error(`turn refused: ${(r as { reason: string }).reason}`);
    const paid = sumRefs(w, `turn:${t.id}`);
    const straight = placeLegMiles(w, t.place, t.targetPlace);
    turns.push({ to: w.net.hubs[to]!.id, place: t.place, remainingMi: Math.round(t.remainingMi), straightMi: Math.round(straight), offMi: Math.round(t.remainingMi - straight), paidFd: r2(paid - paidSoFar), odometer: Math.round(t.odometer) });
    paidSoFar = paid;
  }
  const stationsAfter = stationsOnLeg(w, t.place, t.targetPlace).length;
  // A breakdown carried: set one, turn, and see the truck sit it out.
  t.breakdownMin = 6 * 60;
  applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[other]!.id });
  const bdAfterTurn = t.breakdownMin;
  const miBefore = t.remainingMi;
  stepHour(w);
  const movedDuringBreakdown = miBefore - t.remainingMi;
  for (let h = 0; h < 72 && t.status !== "idle"; h++) stepHour(w);
  const ok = (() => {
    try {
      w.ledger.assertBalanced();
      return true;
    } catch {
      return false;
    }
  })();
  return {
    drivenBeforeTurns: Math.round(driven0),
    remainingBefore: Math.round(remainingBefore),
    stationsOnLegBefore: stationsBefore,
    stationsOnLegAfterTenTurns: stationsAfter,
    turns,
    breakdownMinAfterTurn: bdAfterTurn,
    milesMovedInBreakdownHour: r2(movedDuringBreakdown),
    arrivedIdle: t.status === "idle",
    ledgerBalanced: ok,
  };
}

/**
 * labor.sendHomeToWork: the driver's fatigue (fatigue.roadDays 21, roadPerDay 0.03 growing) over 90 days away, in three regimes:
 * never home; standing at home at a day's close every 20 days with no day off (what a run home to work does); the client's
 * home-time rule, 21 days out then 5 days off at home. The truck stands idle all along (no driving: only the days-out rule speaks).
 */
function probeHome() {
  const regime = (kind: "never" | "pass20" | "homeTime") => {
    const { w, c, t, d } = oo("DAL", 7);
    const far = farFrom(w, c.homeHub, 700, 1_100);
    standAt(t, far);
    const series: number[] = [];
    let offDays = 0;
    for (let day = 1; day <= 90; day++) {
      let atHome = false;
      if (kind === "pass20" && day % 20 === 0) atHome = true;
      if (kind === "homeTime") {
        if (d.awayDays >= 21 || offDays > 0) {
          atHome = true;
          offDays = offDays > 0 ? offDays - 1 : 4;
        }
      }
      standAt(t, atHome ? c.homeHub : far);
      // A driving day everywhere but the home-time rule's days off: eight hours on the log at the day's close, so a pass
      // home is a truck that drove today and stands at home tonight (no day off), as a run home to work leaves it.
      const dayOff = kind === "homeTime" && atHome;
      for (let h = 0; h < 24; h++) {
        if (!dayOff) d.drivenMinToday = 8 * 60;
        stepHour(w);
      }
      series.push(r2(d.fatigue));
    }
    return { fatigueD30: series[29], fatigueD60: series[59], fatigueD90: series[89], max: Math.max(...series), daysTired: series.filter((f) => f >= w.cfg.fatigue.tiredAt).length, awayDaysEnd: d.awayDays, morale: r2(d.morale), perDiemFd: Math.round(sumRefs(w, "perdiem:")) };
  };
  return { never: regime("never"), pass20: regime("pass20"), homeTime21x5: regime("homeTime"), cfg: { roadDays: CFG.fatigue.roadDays, roadPerDay: CFG.fatigue.roadPerDay, tiredAt: CFG.fatigue.tiredAt, crashMult: CFG.fatigue.crashMult, paceLoss: CFG.fatigue.paceLoss } };
}

/**
 * businesses.parking.stopInTown: (a) legs that start within 0.1 miles of a site (the reach check skips a site at the start,
 * so a chosen company sleeps in town for free beside it); (b) three hours left at a leg's start, every site in the first
 * 200 miles full: the town against the shoulder over 48 hours.
 */
function probeTown() {
  const w0 = createWorld({ cfg: CFG, net, feeds: neutralFeeds, seed: 1 });
  let legs = 0;
  let siteAtStart = 0;
  let siteHere = 0;
  const H = w0.net.hubs.length;
  for (let a = 0; a < H; a++) {
    for (let b = 0; b < H; b++) {
      if (a === b) continue;
      const r = placeRoute(w0, placeOfHub(a), placeOfHub(b));
      if (!r) continue;
      legs++;
      const along = sitesAlong(w0, r);
      if (along.some((s) => s.mile <= 0.1)) siteAtStart++;
      if (along.some((s) => s.mile <= 1.5)) siteHere++;
    }
  }
  const run = (choose: boolean, hoursLeft: number) => {
    const { w, c, t } = oo("DAL", 7);
    const far = farFrom(w, c.homeHub, 700, 1_100);
    w.t = 14 * 60;
    if (choose && !applyAction(w, c.id, { type: "set_night_stop", choice: "town" }).ok) throw new Error("no choice");
    applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[far]!.id });
    const route = placeRoute(w, t.place, t.targetPlace)!;
    for (const s of sitesAlong(w, route)) if (s.mile < 200) w.sites[s.site - 1]!.parked = w.sites[s.site - 1]!.spaces;
    const limit = w.cfg.hos.drivingHoursPerDay * 60;
    t.shiftStartT = w.t - 10 * 60;
    t.shiftDrivenMin = limit - hoursLeft * 60;
    t.offDutySinceT = w.t;
    const mi0 = t.remainingMi;
    const at = (h: number) => {
      for (let k = 0; k < h; k++) stepHour(w);
      return Math.round(mi0 - t.remainingMi);
    };
    const p24 = at(24);
    const p48 = at(24);
    const fines = sumRefs(w, `fine:shoulder:${t.id}`);
    const idle = w.ledger.entries.filter((e) => e.ref === `rest:${t.id}`).reduce((s, e) => s + e.amount, 0);
    return { progress24: p24, progress48: p48, finesFd: fines, idlingFd: r2(idle), nights: w.metrics.days.reduce((s, d) => s + ((d as unknown as { nights?: { site?: number; shoulder?: number } }).nights?.shoulder ?? 0), 0) };
  };
  return {
    legs,
    legsWithSiteAtStart: siteAtStart,
    legsWithSiteWithin1_5mi: siteHere,
    threeHoursLeft: { town: run(true, 3), shoulder: run(false, 3) },
    oneHourLeft: { town: run(true, 1), shoulder: run(false, 1) },
    fineExpectedFd: r2(CFG.businesses.parking.patrolOdds * CFG.businesses.parking.shoulderFineFd),
  };
}

/** leverage.localHoldHandBids: one truck files on three held loads — one bid stands; the held load's ceiling steps through the hold. */
function probeHold() {
  const w = createWorld({ cfg: CFG, net, feeds: neutralFeeds, seed: 61, keepLedgerEntries: true });
  populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
  const c = formCompany(w, { name: "Visiting Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
  c.authority.status = "active";
  c.firstHandBidDay = 0;
  const t = w.trucksByCompany.get(c.id)![0]!;
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
  const loads = [...w.loads.values()].filter((l) => l.status === "open" && l.brokerId === null && l.shipperId === null && l.equipment === t.trailer && l.vet === 0 && l.hot === 0 && l.tenderedTo === 0 && !l.hold && hubMiles(w, l.origin, c.homeHub) > 400);
  const picks = loads.filter((l) => l.origin === loads[0]!.origin).slice(0, 3);
  if (picks.length < 2) return { note: "fewer than two loads at one far hub this round", loads: loads.length };
  t.status = "idle";
  t.hub = t.targetHub = picks[0]!.origin;
  t.place = t.targetPlace = picks[0]!.originPlace;
  t.remainingMi = 0;
  for (const l of picks) l.localUntilRound = w.round; // the hold's last round
  const results = picks.map((l) => applyAction(w, c.id, { type: "place_bid", truckId: t.id, loadId: l.id, rate: l.ceiling }).ok);
  const filed = w.manualBids.size;
  const standsFor = w.manualBids.get(t.id)?.loadId;
  const ceilBefore = picks.map((l) => r2(l.ceiling));
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
  return {
    bidsAccepted: results,
    bidsStanding: filed,
    standsForLoad: standsFor,
    lastPick: picks[picks.length - 1]!.id,
    ceilingBefore: ceilBefore,
    ceilingAfterOpening: picks.map((l) => r2(l.ceiling)),
    won: picks.map((l) => l.carrierId === c.id),
    statusAfter: picks.map((l) => l.status),
  };
}

/**
 * equipmentFinance.purchase.collateral: (a) a listing bought for cash leaves firstOwnedTruckDay null, so the new-business ten
 * points stay on the next loan; a dealer order sets it the day of the order; (b) the wreck-first dodge's prices; (c) the
 * authority's year edge; (d) a broker may buy no truck.
 */
function probeLoan() {
  const w = createWorld({ cfg: CFG, net, feeds: neutralFeeds, seed: 3, keepLedgerEntries: true });
  const buyer = formCompany(w, { name: "Loan Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
  buyer.authority.status = "active";
  const grant = (c: Company, fd: number) => w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), fd, `grant:${c.id}`);
  grant(buyer, 400_000);
  const k = CFG.equipmentFinance.purchase.collateral;
  const before = purchaseTerms(w, buyer, NEW_TRUCK);
  // A seller lists a worn truck; the buyer takes it for cash.
  const seller = formCompany(w, { name: "Seller Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
  seller.authority.status = "active";
  const worn = addTruck(w, seller, "owned", "workhorse", "van", false, { odometer: 520_000, milesSinceRebuild: 40_000, builtDay: -4 * 365 });
  const value = truckValue(w, worn);
  const listed = applyAction(w, seller.id, { type: "list_truck", truckId: worn.id, askFd: Math.round(value), floorFd: Math.round(value * 0.6), stepFd: 500 });
  const listing = w.listings.find((l) => l.truckId === worn.id);
  const bought = listing ? applyAction(w, buyer.id, { type: "buy_listing", listingId: listing.id }) : { ok: false, reason: "no listing" };
  const ownsAfterListing = (w.trucksByCompany.get(buyer.id) ?? []).filter((t) => t.lease === "owned").length;
  const afterListing = purchaseTerms(w, buyer, NEW_TRUCK);
  const firstOwnedAfterListing = buyer.firstOwnedTruckDay;
  // A second newcomer orders a used-lot rig: firstOwnedTruckDay the day of the order, before delivery.
  const b2 = formCompany(w, { name: "Order Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
  b2.authority.status = "active";
  grant(b2, 400_000);
  const lot = lotPrice(w, "workhorse", "van");
  const ordered = applyAction(w, b2.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, used: true });
  const firstOwnedAfterOrder = b2.firstOwnedTruckDay;
  const ownedAfterOrder = (w.trucksByCompany.get(b2.id) ?? []).filter((t) => t.lease === "owned").length;
  const afterOrder = purchaseTerms(w, b2, NEW_TRUCK);
  // The wreck-first dodge's prices: the cheapest truck that still sets the day, against ten points of a new rig's price.
  const newRig = dealerPrice(w, { tier: "workhorse", trailer: "van" });
  const wreck = addTruck(w, seller, "owned", "workhorse", "van", false, { odometer: 690_000, milesSinceRebuild: 90_000, builtDay: -9 * 365 - 300 });
  const wreckValue = truckValue(w, wreck);
  // (c) the authority's year edge.
  const edge = (days: number) => {
    const c = formCompany(w, { name: `Edge ${days}`, role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
    c.authority.since = dayOf(w.t, w.cfg) - days;
    return r2(purchaseTerms(w, c, NEW_TRUCK).downShare);
  };
  // (d) a broker.
  const broker = formCompany(w, { name: "Loan Logistics", role: "broker", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
  grant(broker, 400_000);
  const brokerBuys = applyAction(w, broker.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, finance: true });
  // (e) the caps' edges on the truck itself.
  const yr = (y: number, mi: number) => {
    const t = purchaseTerms(w, buyer, { ageYears: y, odometer: mi });
    return { down: r2(t.downShare), weeks: t.termWeeks, rate: +t.weeklyRate.toFixed(5), declined: t.declined !== null };
  };
  return {
    newBusinessPoints: k.newBusiness.downAdd,
    downBefore: r2(before.downShare),
    listing: { listed: listed.ok, bought: bought.ok, reason: bought.ok ? null : (bought as { reason: string }).reason, ownsAfter: ownsAfterListing, firstOwnedTruckDay: firstOwnedAfterListing, downAfter: r2(afterListing.downShare), newBusinessAfter: afterListing.parts?.newBusiness ?? null, paidFd: Math.round(value) },
    order: { ordered: ordered.ok, reason: ordered.ok ? null : (ordered as { reason: string }).reason, lotPriceFd: Math.round(lot), firstOwnedTruckDay: firstOwnedAfterOrder, ownedTrucksNow: ownedAfterOrder, downAfter: r2(afterOrder.downShare), newBusinessAfter: afterOrder.parts?.newBusiness ?? null },
    wreckFirst: { newRigFd: Math.round(newRig), tenPointsFd: Math.round(0.1 * newRig), wreck: { ageYears: r2(collateralOf(w, wreck).ageYears), odometer: wreck.odometer, valueFd: Math.round(wreckValue), fireSaleFloorFd: Math.round(wreckValue * CFG.insolvency.fireSaleFloorPctOfValue) }, resaleFeePct: CFG.usedMarket.feePct, salesTaxPct: (CFG.costs as unknown as { salesTax?: { pct?: number } }).salesTax?.pct ?? null },
    yearEdge: { d364: edge(364), d366: edge(366) },
    brokerBuys: { ok: brokerBuys.ok, reason: brokerBuys.ok ? null : (brokerBuys as { reason: string }).reason },
    truckEdges: { y9_99_mi699k: yr(9.99, 699_000), y10_01: yr(10.01, 100_000), mi700_001: yr(2, 700_001), y6_5: yr(6.5, 200_000), new: yr(0, 0) },
  };
}

/**
 * The group: labor.turnWhileEmpty with businesses.parking.stopInTown. A turn starts a new leg at the nearest town, and the
 * town rule reads "a leg's start": a company that chose the town turns its empty truck an hour before its hours run out and
 * sleeps in that town, legally, instead of on the shoulder. Each hour of a 364-hour run: with 1 hour of driving left, mid-leg,
 * turn toward the same far hub by way of another, then back (two turns), and see where the night is spent.
 */
function probeTurnTown() {
  const run = (turn: boolean) => {
    const { w, c, t } = oo("DAL", 7);
    const far = farFrom(w, c.homeHub, 1_300, 1_900);
    const other = w.net.hubs.findIndex((_, i) => i !== far && i !== c.homeHub && hubMiles(w, i, c.homeHub) > 150 && hubMiles(w, i, c.homeHub) < 400);
    if (!applyAction(w, c.id, { type: "set_night_stop", choice: "town" }).ok) throw new Error("no choice");
    w.t = 6 * 60;
    applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[far]!.id });
    // Every site on the way is full (the rules test's set-up): the night is the shoulder, or the town.
    const route = placeRoute(w, t.place, t.targetPlace)!;
    for (const s of sitesAlong(w, route)) w.sites[s.site - 1]!.parked = w.sites[s.site - 1]!.spaces;
    let turns = 0;
    let townNights = 0;
    for (let h = 0; h < 24 * 6 && t.status === "repositioning"; h++) {
      const limit = w.cfg.hos.drivingHoursPerDay * 60;
      // An hour of driving left, mid-leg: turn away and back, so the leg "starts" here.
      if (turn && t.shiftDrivenMin >= limit - 60 && t.shiftDrivenMin < limit && t.remainingMi > 100 && t.emptyMi > 0 && !t.townNight) {
        if (applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[other]!.id }).ok && applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[far]!.id }).ok) {
          turns += 2;
          // The turned truck's sites, full too (the new route from the town).
          const r2 = placeRoute(w, t.place, t.targetPlace);
          if (r2) for (const s of sitesAlong(w, r2)) w.sites[s.site - 1]!.parked = w.sites[s.site - 1]!.spaces;
        }
      }
      const mi = t.remainingMi;
      const before = t.townNight === true;
      stepHour(w);
      if (before && t.townNight === undefined && t.remainingMi === mi) townNights++;
    }
    const nights = w.metrics.days.reduce((s, d) => ({ site: s.site + ((d as unknown as { siteNights?: number }).siteNights ?? 0), shoulder: s.shoulder + ((d as unknown as { shoulderNights?: number }).shoulderNights ?? 0) }), { site: 0, shoulder: 0 });
    return { turns, townNights, siteNights: nights.site, shoulderNights: nights.shoulder, finesFd: sumRefs(w, `fine:shoulder:${t.id}`), turnPaidFd: Math.round(sumRefs(w, `turn:${t.id}`)), arrived: t.status === "idle", odometer: Math.round(t.odometer), days: w.metrics.days.length };
  };
  return { straight: run(false), turning: run(true) };
}

function main(): void {
  const { values } = parseArgs({ options: { probe: { type: "string", default: "reach,turn,home,town,hold,loan,turntown" }, out: { type: "string", default: "runs/redteam-0241" } } });
  mkdirSync(values.out!, { recursive: true });
  const probes: Record<string, () => unknown> = { reach: probeReach, turn: probeTurn, home: probeHome, town: probeTown, hold: probeHold, loan: probeLoan, turntown: probeTurnTown };
  const out: Record<string, unknown> = {};
  for (const p of values.probe!.split(",")) {
    if (!probes[p]) continue;
    const t0 = performance.now();
    out[p] = probes[p]!();
    console.log(`== ${p} (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
    console.log(JSON.stringify(out[p], null, 1));
  }
  writeFileSync(`${values.out}/probes.json`, JSON.stringify(out, null, 1));
}

main();
