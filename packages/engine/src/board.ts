import { acceptTender, autoTenders, expireTenders, mayTake, settleTender } from "./contracts.js";
import { fuelPrice } from "./economics.js";
import { seasonality, EQUIPMENT } from "./demand.js";
import { dayOf } from "./clock.js";
import { generateRoundFreight, bestExitHub } from "./freight.js";
import { rebrokerLoad, vettingBlock } from "./fraud.js";
import { homeEdge, updateHomeCrowding } from "./home.js";
import { creditDispatch, dispatchProfile, startHomeTime } from "./labor.js";
import { companyAccount } from "./ledger.js";
import { bidsFromStandingOrders, boardKey, canMakeHot, indexOpenLoads, scoreBid, desperation, estimateBreakEven, resting, trackingWouldShow, needsHome, homeward, hardCap, floorRate, lookaheadValue } from "./standingOrders.js";
import { coverDoubleBrokered, startLoading } from "./trips.js";
import type { Bid, Company, Load, StandingOrder, Truck } from "./types.js";
import { companyById, crewed, hubHours, hubMiles, truckById, type World, placeHours, placeMiles, placeOfHub, placeLegMiles } from "./world.js";

export interface RoundResult {
  round: number;
  bids: number;
  cleared: number;
  rolled: number;
  npcCovered: number;
  posted: number;
  facilityPosted: number;
  expedited: number;
  clearedRateSum: number;
}

/**
 * One board round at a round boundary (§Load board — a round, step by step):
 * collect sealed bids from standing orders, clear each load to its best-scoring
 * bid, roll or NPC-cover what's left, reposition idle trucks, then post the next
 * round's freight.
 */
export function runBoardRound(w: World): RoundResult {
  w.round++;
  updateHomeCrowding(w);
  expireTenders(w);
  const idx = indexOpenLoads(w);
  const openByEq = { van: 0, reefer: 0, flatbed: 0 };
  for (const load of w.loads.values()) if (load.status === "open") openByEq[load.equipment]++;
  const clearedByEq = { van: 0, reefer: 0, flatbed: 0 };
  const bids: Bid[] = [];
  const manual = manualRoundBids(w);
  const byHand = new Set(manual.map((b) => b.truckId));
  for (const c of w.companies) {
    if (c.role !== "carrier") continue;
    // A truck bid by hand this round doesn't also bid through standing orders.
    const own = bidsFromStandingOrders(w, c, idx).filter((b) => !byHand.has(b.truckId));
    if (own.length === 0) continue;
    c.bidStats.truckRounds += new Set(own.map((b) => b.truckId)).size;
    for (const b of own) bids.push(b);
  }
  for (const b of manual) {
    companyById(w, b.companyId).bidStats.truckRounds++;
    bids.push(b);
  }

  // Ties break by a seeded random draw, assigned in a stable order.
  for (const b of bids) b.tiebreak = w.rng.board.next();
  bids.sort((a, b) => b.score - a.score || a.tiebreak - b.tiebreak);

  const truckTaken = new Set<number>();
  const rebrokered: [Company, Load, Extract<StandingOrder, { kind: "rebroker" }>][] = [];
  let cleared = 0;
  let clearedRateSum = 0;
  for (const bid of bids) {
    const load = w.loads.get(bid.loadId)!;
    if (load.status !== "open" || truckTaken.has(bid.truckId)) continue;
    truckTaken.add(bid.truckId);
    assign(w, load, truckById(w, bid.truckId), bid);
    companyById(w, bid.companyId).bidStats.wins++;
    if (!byHand.has(bid.truckId)) {
      const company = companyById(w, bid.companyId);
      creditDispatch(w, company);
      const rb = company.orders.find((o): o is Extract<StandingOrder, { kind: "rebroker" }> => o.kind === "rebroker");
      if (rb) rebrokered.push([company, load, rb]);
    }
    w.listener?.({ kind: "won", companyId: bid.companyId, truckId: bid.truckId, loadId: load.id, origin: load.origin, dest: load.dest, miles: load.miles, rate: bid.rate, manual: byHand.has(bid.truckId) });
    clearedByEq[load.equipment]++;
    cleared++;
    clearedRateSum += bid.rate;
  }

  // Tell hand bidders who lost, and what the load went for.
  if (w.listener) {
    for (const b of manual) {
      if (truckTaken.has(b.truckId)) continue;
      const load = w.loads.get(b.loadId);
      if (!load) continue;
      w.listener({ kind: "lostBid", companyId: b.companyId, truckId: b.truckId, loadId: load.id, origin: load.origin, dest: load.dest, rate: b.rate, winningRate: load.status === "open" ? null : load.clearedRate });
    }
  }

  // A rebroker standing order re-posts some of what the dispatcher won, once clearing is done.
  for (const [company, load, rb] of rebrokered) {
    if (load.status === "assigned" && w.rng.fraud.next() < rb.share) rebrokerLoad(w, company, load, load.clearedRate * (1 - rb.keepPct), rb.pays);
  }

  for (const eq of ["van", "reefer", "flatbed"] as const) {
    if (openByEq[eq] > 0) w.fillRate[eq] = 0.95 * w.fillRate[eq] + 0.05 * (clearedByEq[eq] / openByEq[eq]);
  }

  let rolled = 0;
  let npcCovered = 0;
  let expedited = 0;
  for (const load of [...w.loads.values()]) {
    if (load.status !== "open" || load.postedRound >= w.round) continue;
    load.roundsUnfilled++;
    if (load.shipperId !== null && load.roundsUnfilled >= w.cfg.facilities.expediteAfterRounds) {
      expedite(w, load);
      expedited++;
    } else if (load.shipperId === null && load.roundsUnfilled >= w.cfg.board.npcFallbackAfterRounds + (load.localUntilRound > 0 ? w.cfg.leverage.localRounds : 0)) {
      npcCover(w, load);
      npcCovered++;
    } else {
      rollover(w, load);
      rolled++;
    }
  }

  // Repositioning sees what's still on the board. Trucks take turns in a rotating
  // order so low ids don't always get first pick of the open freight.
  const surplus = openLoadSurplus(w);
  const n = w.trucks.length;
  const start = n ? (w.round * 7919) % n : 0;
  for (let k = 0; k < n; k++) {
    const truck = w.trucks[(start + k) % n]!;
    if (truck.status !== "idle" || truckTaken.has(truck.id)) continue;
    truck.idleRounds++;
    maybeReposition(w, truck, surplus);
  }

  const freight = generateRoundFreight(w);
  // Loads booked at their book-now price since the last round count as cleared, at what they paid.
  cleared += w.booked.n;
  clearedRateSum += w.booked.rateSum;
  w.booked = { n: 0, rateSum: 0 };
  const result: RoundResult = {
    round: w.round,
    bids: bids.length,
    cleared,
    rolled,
    npcCovered,
    posted: freight.loads.length,
    facilityPosted: freight.facilityLoads,
    expedited,
    clearedRateSum,
  };
  w.metrics.onRound(result);
  return result;
}

/** Hand-placed bids still valid this round (truck idle, load open, same trailer), capped at the ceiling. */
function manualRoundBids(w: World): Bid[] {
  const out: Bid[] = [];
  for (const [truckId, mb] of w.manualBids) {
    const truck = truckById(w, truckId);
    const load = w.loads.get(mb.loadId);
    if (!load || load.status !== "open" || truck.status !== "idle" || truck.trailer !== load.equipment || truck.companyId === 0 || !crewed(truck)) continue;
    const company = companyById(w, truck.companyId);
    if (company.authority.status !== "active" || vettingBlock(w, company, load) !== null || load.doubleBroker?.companyId === company.id) continue;
    if (!mayTake(w, company, load)) continue;
    if (load.hot > 0 && !canMakeHot(company, truck)) continue;
    const deadheadMi = placeMiles(w, truck.place, load.originPlace);
    // A counter can go past the ceiling (taken only if nobody offers within it), up to the hard cap.
    const rate = Math.min(mb.rate, hardCap(w, load));
    out.push({ loadId: load.id, truckId, companyId: company.id, rate, deadheadMi, score: scoreBid(w, load.ceiling, rate, company.reputation, deadheadMi, homeEdge(w, company, load.origin)), tiebreak: 0 });
  }
  w.manualBids.clear();
  return out;
}

function assign(w: World, load: Load, truck: Truck, bid: Bid): void {
  const { cfg } = w;
  load.status = "assigned";
  load.carrierId = bid.companyId;
  load.truckId = truck.id;
  load.clearedRate = bid.rate;
  // Due = the HOS schedule (11 driving hours, then off until the 24-hour duty day
  // resets) + worst-case loading and unloading + slack. A long breakdown makes it late.
  // A hot load's window assumes 15 driving hours a day and little slack: a solo driver makes it only on falsified logs.
  // Driving time follows the roads: interstates are quicker than two-lane highways.
  const perDay = load.hot > 0 ? cfg.safety.hotLoads.hoursPerDay : cfg.hos.drivingHoursPerDay;
  const drivingH = (bid.deadheadMi > 0 ? placeHours(w, truck.place, load.originPlace) : 0) + load.routeHours;
  // Full rest days before the last driving day: a run of exactly one day's driving has none.
  const fullDays = Math.max(0, Math.ceil(drivingH / perDay) - 1);
  const transitMin = (fullDays * cfg.hos.dutyDayHours + (drivingH - fullDays * perDay)) * 60;
  const dwellMin = cfg.dwell.loadMinutes[1] + cfg.dwell.unloadMinutes[1];
  // Due by the HOS schedule, and never after the shipper's appointment.
  load.dueT = Math.min(load.appointmentT, w.t + transitMin + dwellMin + (load.hot > 0 ? cfg.safety.hotLoads.slackMinutes : cfg.freight.deliverySlackMinutes));
  truck.loadId = load.id;
  truck.idleRounds = 0;
  if (bid.deadheadMi === 0) {
    startLoading(w, truck, load);
  } else {
    truck.status = "toPickup";
    truck.targetHub = load.origin;
    truck.targetPlace = load.originPlace;
    truck.remainingMi = placeLegMiles(w, truck.place, load.originPlace); // the bid's estimate, now the road's own figure
  }
}

function rollover(w: World, load: Load): void {
  const raised = load.ceiling * (1 + w.cfg.board.rolloverCeilingStep);
  if (load.brokerId === null) {
    load.ceiling = raised;
    load.shipperRate = raised;
  } else {
    // The broker eats the raise. To keep its contract it will pay carriers up to
    // the spot rate, even above what the contract with the shipper brings in.
    load.ceiling = Math.min(raised, Math.max(load.shipperRate, load.spotShipperRate));
  }
  // Nobody took it at the book-now: the poster raises it toward the ceiling.
  load.bookNow = Math.min(load.ceiling, load.bookNow * (1 + w.cfg.bookNow.stepPerRound));
}

/**
 * Takes an open load at its book-now price for an idle truck, now (§Load board —
 * book-now). The caller has checked ownership, vetting and the hot-load rule;
 * this checks what can change under it and assigns.
 */
export function bookLoad(w: World, company: Company, truck: Truck, load: Load, deadheadMi: number, manual: boolean, rate = load.bookNow): string | null {
  if (load.status !== "open") return "that load is gone";
  if (truck.status !== "idle" || !crewed(truck)) return "the truck isn't idle with a driver";
  if (truck.trailer !== load.equipment) return "wrong trailer";
  if (company.authority.status !== "active") return "your authority isn't active";
  if (!mayTake(w, company, load)) return load.tenderedTo ? "that load is tendered to another carrier" : "local shippers only for now";
  settleTender(w, company, load);
  if (!(rate > 0)) return "that load has no book-now price";
  w.manualBids.delete(truck.id);
  assign(w, load, truck, { loadId: load.id, truckId: truck.id, companyId: company.id, rate, deadheadMi, score: 0, tiebreak: 0 });
  company.bidStats.truckRounds++;
  company.bidStats.wins++;
  w.booked.n++;
  w.booked.rateSum += rate;
  w.listener?.({ kind: "won", companyId: company.id, truckId: truck.id, loadId: load.id, origin: load.origin, dest: load.dest, miles: load.miles, rate, manual });
  return null;
}

/**
 * Between rounds, dispatchers with a book-now standing order take loads whose
 * book-now price clears their threshold, lowered by how badly the truck needs to
 * move (desperation). Same reach and rules as sealed bidding.
 */
export function autoBook(w: World): void {
  // Contract tenders first: honoured at the contract rate.
  for (const t of autoTenders(w)) {
    if (acceptTender(w, t.company, t.load, t.truck) === null && bookLoad(w, t.company, t.truck, t.load, t.dh, false, t.rate) === null) creditDispatch(w, t.company);
  }
  const idx = indexOpenLoads(w);
  if (idx.size === 0) return;
  const fuel = fuelPrice(w);
  const rng = w.rng.dispatch;
  for (const company of w.companies) {
    if (company.role !== "carrier" || company.authority.status !== "active") continue;
    const order = company.orders.find((o): o is Extract<StandingOrder, { kind: "bookNow" }> => o.kind === "bookNow");
    if (!order) continue;
    const floor = company.orders.find((o): o is Extract<StandingOrder, { kind: "floor" }> => o.kind === "floor");
    const fleet = w.trucksByCompany.get(company.id)!;
    const team = dispatchProfile(w, company, fleet.filter((t) => t.status !== "parked" && t.status !== "listed").length);
    const allowed = [true, vettingBlock(w, company, { vet: 1 } as Load) === null, vettingBlock(w, company, { vet: 2 } as Load) === null];
    for (const truck of fleet) {
      if (truck.status !== "idle" || !crewed(truck) || resting(w, truck) || w.manualBids.has(truck.id)) continue;
      if (team.coverage < 1 && rng.next() >= team.coverage) continue;
      const desperate = desperation(w, company, truck);
      const want = order.breakEvenPlusPct * (1 - desperate);
      const goHome = needsHome(w, company, truck);
      let best: { load: Load; dh: number; profit: number } | null = null;
      for (const hub of w.net.nearby[truck.hub]!) {
        if (hubMiles(w, truck.hub, hub) > order.maxDeadheadMi + w.cfg.commodities.placeSlackMi) break; // nearby is sorted nearest first
        const loads = idx.get(boardKey(hub, truck.trailer));
        if (!loads) continue;
        for (const load of loads) {
          if (load.status !== "open") continue; // booked a moment ago by another truck
          const dh = placeMiles(w, truck.place, load.originPlace);
          if (dh > order.maxDeadheadMi) continue;
          if (!mayTake(w, company, load)) continue;
          if (load.brokerId === company.id || load.doubleBroker?.companyId === company.id) continue;
          if (!allowed[load.vet]) continue;
          if (load.hot > 0 && !canMakeHot(company, truck)) continue;
          if (trackingWouldShow(company, load)) continue;
          if (goHome && !homeward(w, company, truck, load)) continue;
          const be = estimateBreakEven(w, truck, load, dh, fuel, team);
          const min = Math.max(be * (1 + want), floorRate(w, load, be, floor, desperate));
          if (load.bookNow < min) continue;
          const profit = (load.bookNow - be) * load.miles + lookaheadValue(w, team, load.dest, load.equipment);
          if (!best || profit > best.profit || (profit === best.profit && load.id < best.load.id)) best = { load, dh, profit };
        }
      }
      if (best && bookLoad(w, company, truck, best.load, best.dh, false) === null) creditDispatch(w, company);
    }
  }
}

/**
 * NPC loads never go uncovered: an NPC carrier takes them at 95% of reference.
 * For direct NPC freight the NPC shipper pays the NPC carrier, so no player FD
 * moves.
 */
function npcCover(w: World, load: Load): void {
  load.status = "npcCovered";
  if (load.doubleBroker) {
    // Nobody took the re-posted load: the double broker has to buy NPC capacity to cover it.
    coverDoubleBrokered(w, load, Math.max(load.ceiling, w.cfg.board.npcFallbackRateOfRef * load.refRate));
  } else if (load.brokerId !== null) {
    // The broker still owes the shipper the haul: it collects its contract rate
    // and buys NPC capacity at what it has been offering (the rolled-up ceiling),
    // or at the NPC fallback rate on spot if that's higher — so when spot has run
    // well above the contract the broker loses on the load.
    const acct = companyAccount(load.brokerId);
    const ref = `load:${load.id}`;
    const npcRate = Math.max(load.ceiling, w.cfg.board.npcFallbackRateOfRef * load.refRate);
    const broker = companyById(w, load.brokerId);
    w.ledger.post(w.t, "faucet:npc_shipper", acct, load.shipperRate * load.miles, ref);
    w.ledger.post(w.t, acct, "sink:npc_carrier", npcRate * load.miles, ref);
    broker.operating.revenueFd += load.shipperRate * load.miles;
    broker.operating.costFd += npcRate * load.miles;
    broker.openBrokerLoads--;
  }
  w.loads.delete(load.id);
}

/**
 * Player freight nobody hauled goes to an NPC expediter at the current ceiling
 * plus a premium, paid by the shipper. The goods still sell, but the shipper
 * nets less than a player carrier would have cost, so shippers want carriers.
 */
function expedite(w: World, load: Load): void {
  const acct = companyAccount(load.shipperId!);
  const ref = `load:${load.id}`;
  const cost = load.ceiling * w.cfg.facilities.expeditePremium * load.miles;
  const fee = w.cfg.board.posterFeePct * load.saleValue;
  w.ledger.post(w.t, "faucet:npc_market", acct, load.saleValue, ref);
  w.ledger.post(w.t, acct, "sink:npc_expediter", cost, ref);
  w.ledger.post(w.t, acct, "sink:board_fee", fee, ref);
  const facility = w.facilities[load.facilityId! - 1];
  if (facility) facility.netFd += load.saleValue - cost - fee;
  load.status = "npcCovered";
  w.loads.delete(load.id);
}

/** Open loads minus idle trucks, per hub and equipment, after clearing. */
function openLoadSurplus(w: World): Map<string, number> {
  const surplus = new Map<string, number>();
  const bump = (key: string, d: number) => surplus.set(key, (surplus.get(key) ?? 0) + d);
  for (const load of w.loads.values()) if (load.status === "open") bump(boardKey(load.origin, load.equipment), 1);
  for (const truck of w.trucks) if (truck.status === "idle") bump(boardKey(truck.hub, truck.trailer), -1);
  return surplus;
}

function maybeReposition(w: World, truck: Truck, surplus: Map<string, number>): void {
  const company = companyById(w, truck.companyId);
  if (!crewed(truck) || company.authority.status !== "active") return;
  if (resting(w, truck)) return;
  // Home time first: a driver due days off starts them if the truck is home. Otherwise the
  // truck keeps taking loads that head home (bids and book-now only consider those) and
  // runs empty only once it's near, or after a couple of days without a homeward load.
  if (needsHome(w, company, truck)) {
    for (const id of [truck.driverId, truck.coDriverId]) if (id) w.staff[id - 1]!.wantsHome = true;
    const miles = hubMiles(w, truck.hub, company.homeHub);
    const hw = w.cfg.fatigue.homeward;
    if (miles <= w.cfg.map.nearbyRadiusMi) {
      startHomeTime(w, company, truck);
      return;
    }
    if (miles <= hw.deadheadWithinMi || truck.idleRounds >= hw.deadheadAfterRounds) {
      truck.status = "repositioning";
      truck.targetHub = company.homeHub;
      truck.targetPlace = placeOfHub(company.homeHub);
      truck.remainingMi = placeLegMiles(w, truck.place, truck.targetPlace);
      truck.idleRounds = 0;
    }
    return;
  }
  const foresight = company.orders.some((o) => o.kind === "reposition" && typeof o.to === "object" && "openLoadsWithinMi" in o.to)
    ? dispatchProfile(w, company, w.trucksByCompany.get(company.id)!.length).foresightDays
    : 0;
  const day = dayOf(w.t, w.cfg);
  for (const o of company.orders) {
    if (o.kind !== "reposition" || truck.idleRounds < o.afterIdleRounds) continue;
    let target = truck.hub;
    if (o.to === "nearestStarterHub") {
      if (w.net.starterIdx.includes(truck.hub)) continue;
      target = w.net.starterIdx.reduce((best, s) => (hubMiles(w, truck.hub, s) < hubMiles(w, truck.hub, best) ? s : best));
    } else if ("openLoadsWithinMi" in o.to) {
      // Head for the hub with the most uncovered freight for this trailer, net of
      // idle trucks already there, discounted by the empty miles to reach it.
      let best = 0;
      for (let j = 0; j < w.net.hubs.length; j++) {
        const miles = hubMiles(w, truck.hub, j);
        if (j === truck.hub || miles > o.to.openLoadsWithinMi) continue;
        const open = surplus.get(boardKey(j, truck.trailer)) ?? 0;
        // A dispatcher who sees the season coming moves trucks toward markets about to heat up.
        let rising = 0;
        if (foresight > 0) {
          const now = seasonality(w, j, truck.trailer, day).volume;
          rising = 4 * Math.max(0, seasonality(w, j, truck.trailer, day + foresight).volume / Math.max(0.01, now) - 1);
        }
        const value = open + rising - miles / 200;
        if ((open >= 1 || rising >= 0.6) && value > best) {
          best = value;
          target = j;
        }
      }
      if (target !== truck.hub) {
        surplus.set(boardKey(target, truck.trailer), (surplus.get(boardKey(target, truck.trailer)) ?? 0) - 1);
        surplus.set(boardKey(truck.hub, truck.trailer), (surplus.get(boardKey(truck.hub, truck.trailer)) ?? 0) + 1);
      }
    } else {
      const hubId = o.to.hubId;
      target = w.net.hubs.findIndex((h) => h.id === hubId);
    }
    if (target < 0 || target === truck.hub) continue;
    truck.status = "repositioning";
    truck.targetHub = target;
    truck.targetPlace = placeOfHub(target);
    truck.remainingMi = placeLegMiles(w, truck.place, truck.targetPlace);
    truck.idleRounds = 0;
    return;
  }
  // Stuck: nothing bookable for a day. Run empty to the best market in reach by its load-to-truck
  // ratio, deadhead and all; sitting is the dearer choice (Jeff, 2026-10-29).
  const k = w.cfg.bookNow.desperation;
  if (truck.idleRounds < k.repositionAfterRounds) return;
  if (!company.orders.some((o) => o.kind === "bid" || o.kind === "bookNow" || o.kind === "reposition")) return; // no dispatcher at all
  const exit = bestExitHub(w, truck.hub, truck.trailer, company);
  if (!exit) return;
  const best = exit.hub;
  truck.status = "repositioning";
  truck.targetHub = best;
  truck.targetPlace = placeOfHub(best);
  truck.remainingMi = placeLegMiles(w, truck.place, truck.targetPlace);
  truck.idleRounds = 0;
}
