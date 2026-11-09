import { acceptTender, autoTenders, expireTenders, mayTake, settleTender } from "./contracts.js";
import { holdsAtEnd, onAssign, onFallOff } from "./brokerage.js";
import { fmtInt, fuelPrice } from "./economics.js";
import { seasonality, EQUIPMENT } from "./demand.js";
import { dayOf } from "./clock.js";
import { creditScore } from "./credit.js";
import { generateRoundFreight, bestExitHub, noteClear } from "./freight.js";
import { rebrokerLoad, vettingBlock } from "./fraud.js";
import { homeEdge, updateHomeCrowding } from "./home.js";
import { creditDispatch, dispatchProfile, startHomeTime } from "./labor.js";
import { companyAccount } from "./ledger.js";
import { bidsFromStandingOrders, boardKey, canMakeHot, dockWaitCost, indexOpenLoads, scoreBid, desperation, estimateBreakEven, resting, trackingWouldShow, needsHome, homeward, hardCap, floorRate, lookaheadValue, ordersWaitForHand } from "./standingOrders.js";
import { startJob } from "./trips.js";
import { bookingCapBlock, brokerBooks, contractOn, type BrokerBook } from "./receivables.js";
import { AHEAD_STATUSES, canMake, noShow, pickupClosed, posterKind, readyToday, urgencyStep, urgent, windowsOn } from "./windows.js";
import type { Bid, Company, Load, StandingOrder, Truck } from "./types.js";
import { companyById, crewed, hubHours, hubMiles, truckById, type World, placeMiles, placeOfHub, placeLegMiles } from "./world.js";

export interface RoundResult {
  round: number;
  bids: number;
  cleared: number;
  rolled: number;
  /** Loads whose shipper gave up this round: nobody hauled them (0.17.0: no NPC carrier ever does). */
  expired: number;
  posted: number;
  facilityPosted: number;
  clearedRateSum: number;
}

/**
 * One board round at a round boundary (§Load board — a round, step by step):
 * collect sealed bids from standing orders, clear each load to its best-scoring
 * bid, roll what's left (or let its shipper give up), reposition idle trucks,
 * then post the next round's freight.
 */
export function runBoardRound(w: World): RoundResult {
  w.round++;
  updateHomeCrowding(w);
  expireTenders(w);
  holdsAtEnd(w); // tenders held for player brokerages whose window has ended (brokerage.ts)
  // Delivery windows (windows.ts): a load still open when its pickup closed is lost before the round clears. No slide, no
  // re-post. A booked one whose truck never reached the shipper is a no-show (batch 2): claimed, and lost the same way.
  let expired = 0;
  if (windowsOn(w)) {
    for (const load of [...w.loads.values()]) {
      if (!pickupClosed(w, load)) continue;
      if (load.status === "open") giveUp(w, load);
      else if (load.status === "assigned") noShow(w, load);
      else continue;
      expired++;
    }
  }
  const idx = indexOpenLoads(w);
  const openByEq = { van: 0, reefer: 0, flatbed: 0 };
  for (const load of w.loads.values()) if (load.status === "open" && readyToday(w, load)) openByEq[load.equipment]++;
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
  // The AP cap (token.payment.factoring.contract): a broker's load clears only within what its bond covers.
  const books = contractOn(w) ? brokerBooks(w) : undefined;
  for (const bid of bids) {
    const load = w.loads.get(bid.loadId)!;
    if (load.status !== "open" || truckTaken.has(bid.truckId)) continue;
    if (books && bookingCapBlock(w, load, bid.rate, books)) continue;
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
  const win = windowsOn(w);
  for (const load of [...w.loads.values()]) {
    if (load.status !== "open" || load.postedRound >= w.round || load.hold) continue;
    load.roundsUnfilled++;
    // Delivery windows: the price holds while the load has slack, and walks in its last rounds; the deadline, not a count of
    // rounds, ends it (above).
    if (win && load.latestPickupT !== undefined) {
      if (urgent(w, load) && urgencyStep(w, load, raiseCeiling)) rolled++;
      continue;
    }
    if (load.roundsUnfilled >= w.cfg.board.giveUpAfterRounds + (load.localUntilRound > 0 ? w.cfg.leverage.localRounds : 0)) {
      giveUp(w, load);
      expired++;
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
    expired,
    posted: freight.loads.length,
    facilityPosted: freight.facilityLoads,
    clearedRateSum,
  };
  w.metrics.onRound(result);
  return result;
}

/**
 * Hand-placed bids still valid this round (truck idle, load open, same trailer), capped at the ceiling. Delivery windows
 * (batch 2): a busy truck's bid stands for the load after its job (one ahead, never two), and any bid on a windowed load
 * only while canMake says the truck can still make it; the deadhead is from where the truck will be free.
 */
function manualRoundBids(w: World): Bid[] {
  const out: Bid[] = [];
  const win = windowsOn(w);
  for (const [truckId, mb] of w.manualBids) {
    const truck = truckById(w, truckId);
    const load = w.loads.get(mb.loadId);
    const ahead = win && truck.status !== "idle" && AHEAD_STATUSES.has(truck.status) && truck.nextLoadId === undefined;
    if (!load || load.status !== "open" || (truck.status !== "idle" && !ahead) || truck.trailer !== load.equipment || truck.companyId === 0 || !crewed(truck)) continue;
    const company = companyById(w, truck.companyId);
    if (company.authority.status !== "active" || vettingBlock(w, company, load) !== null || load.doubleBroker?.companyId === company.id) continue;
    if (!mayTake(w, company, load)) continue;
    if (load.hot > 0 && !canMakeHot(company, truck)) continue;
    const reach = win && (ahead || load.latestPickupT !== undefined) ? canMake(w, truck, load) : null;
    if (reach && !reach.ok) continue;
    const deadheadMi = placeMiles(w, reach ? reach.freePlace : truck.place, load.originPlace);
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
  noteClear(w, load, bid.rate); // what loads really clear at (freight.ts clearsNear)
  if (cfg.brokerage.enabled) onAssign(w, load, bid.companyId, bid.rate); // player brokerages: the rate flag, a passed load covered
  // Delivery windows (batch 2): won for a truck still on a job, it's booked ahead: nothing moves on it until the truck takes
  // it (trips.ts takeNextLoad), which sets its due time and slot from then.
  if (truck.status !== "idle" && windowsOn(w)) {
    load.ahead = true;
    truck.nextLoadId = load.id;
    return;
  }
  startJob(w, truck, load, bid.deadheadMi);
}

export function rollover(w: World, load: Load): void {
  raiseCeiling(w, load);
  // Nobody took it at the book-now: the poster raises it toward the ceiling. R11 (bookNow.towardCeilingRounds): from where it
  // opened to the ceiling over that many rounds, so only a waited load books at the ceiling.
  const toward = w.cfg.bookNow.towardCeilingRounds;
  if (toward > 0) {
    const open = (load.bookNowOpen ??= load.bookNow);
    load.bookNow = Math.min(load.ceiling, open + (load.ceiling - open) * Math.min(1, (load.roundsUnfilled) / toward));
  } else load.bookNow = Math.min(load.ceiling, load.bookNow * (1 + w.cfg.bookNow.stepPerRound));
  // The shipper still wants it moved, just later: the appointment slides back a round.
  load.appointmentT += w.cfg.time.gameMinutesPerDay / w.cfg.time.boardRoundHours.length;
}

/** A rollover's ceiling step: an NPC shipper raises it (and pays it); a broker eats the raise up to its fall-off reach. */
export function raiseCeiling(w: World, load: Load): void {
  const raised = load.ceiling * (1 + w.cfg.board.rolloverCeilingStep);
  if (load.brokerId === null) {
    load.ceiling = raised;
    load.shipperRate = raised;
  } else {
    // The broker eats the raise. To keep its contract it will pay carriers up to the spot rate,
    // or up to the fall-off charge over what the contract brings in, whichever is more: past
    // that, losing the load is the cheaper way out.
    const most = Math.max(load.shipperRate * (1 + w.cfg.brokerRisk.fallOffShare), load.spotShipperRate);
    // A player's brokerage (QA's S4): the round never re-prices its load over what the shipper pays it. The owner sets
    // the pay; the AI brokers go on eating the raise.
    const broker = w.companies[load.brokerId - 1];
    const own = w.cfg.brokerage.enabled && broker !== undefined && broker.partnerId !== undefined;
    load.ceiling = Math.max(load.ceiling, Math.min(raised, own ? Math.max(load.ceiling, load.shipperRate) : most));
  }
}

/**
 * Takes an open load at its book-now price for an idle truck, now (§Load board —
 * book-now). The caller has checked ownership, vetting and the hot-load rule;
 * this checks what can change under it and assigns.
 */
export function bookLoad(w: World, company: Company, truck: Truck, load: Load, deadheadMi: number, manual: boolean, rate = load.bookNow, books?: Map<number, BrokerBook>): string | null {
  if (load.status !== "open") return "that load is gone";
  if (pickupClosed(w, load)) return "that load's pickup has closed";
  // Delivery windows (batch 2): a truck on a job books one load ahead (the caller has checked canMake), never a second.
  const ahead = truck.status !== "idle" && windowsOn(w) && AHEAD_STATUSES.has(truck.status);
  if ((truck.status !== "idle" && !ahead) || !crewed(truck)) return "the truck isn't idle with a driver";
  if (ahead && truck.nextLoadId !== undefined) return "this truck already has its next load booked";
  if (truck.trailer !== load.equipment) return "wrong trailer";
  if (company.authority.status !== "active") return "your authority isn't active";
  if (!mayTake(w, company, load)) return load.tenderedTo ? "that load is tendered to another carrier" : "local shippers only for now";
  settleTender(w, company, load);
  if (!(rate > 0)) return "that load has no book-now price";
  // The AP cap: a booking that would push the load's broker past its bond is refused.
  const capped = bookingCapBlock(w, load, rate, books);
  if (capped) return capped;
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
  const books = contractOn(w) ? brokerBooks(w) : undefined;
  for (const t of autoTenders(w)) {
    if (acceptTender(w, t.company, t.load, t.truck) === null && bookLoad(w, t.company, t.truck, t.load, t.dh, false, t.rate, books) === null) creditDispatch(w, t.company);
  }
  const idx = indexOpenLoads(w);
  if (idx.size === 0) return;
  const fuel = fuelPrice(w);
  const rng = w.rng.dispatch;
  for (const company of w.companies) {
    if (company.role !== "carrier" || company.authority.status !== "active") continue;
    const order = company.orders.find((o): o is Extract<StandingOrder, { kind: "bookNow" }> => o.kind === "bookNow");
    if (!order || ordersWaitForHand(w, company)) continue; // the first bid by hand: no booking for the owner either
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
          if (load.brokerId !== null && creditScore(w, companyById(w, load.brokerId)) < company.minBrokerCredit) continue; // no paper below the floor
          if (load.hot > 0 && !canMakeHot(company, truck)) continue;
          if (trackingWouldShow(company, load)) continue;
          if (goHome && !homeward(w, company, truck, load)) continue;
          const be = estimateBreakEven(w, truck, load, dh, fuel, team);
          const min = Math.max(be * (1 + want), floorRate(w, load, be, floor, desperate));
          if (load.bookNow < min) continue;
          const profit = (load.bookNow - be) * load.miles + lookaheadValue(w, team, load.dest, load.equipment) - dockWaitCost(w, truck, load, dh, team);
          if (!best || profit > best.profit || (profit === best.profit && load.id < best.load.id)) best = { load, dh, profit };
        }
      }
      if (best && bookLoad(w, company, truck, best.load, best.dh, false, undefined, books) === null) creditDispatch(w, company);
    }
  }
}

/**
 * Nobody hauled it before the shipper gave up, so the freight is lost: no NPC carrier covers it
 * (Jeff, 2026-10-29: freight moves only on AI and player trucks). A broker holding the contract
 * pays the shipper a fall-off charge; a carrier that re-posted the load pays that broker the
 * same on the rate it took it at; a facility's goods go unsold. The load leaves the board.
 */
export function giveUp(w: World, load: Load, noShow = false): void {
  const { fallOffShare } = w.cfg.brokerRisk;
  const ref = `load:${load.id}`;
  const rounds = load.roundsUnfilled;
  // Delivery windows: lost when its pickup closed, counted by who posted it, at what its shipper would have paid. A no-show
  // (windows.ts noShow) is lost the same way: its carrier never reached the shipper.
  const closed = noShow || pickupClosed(w, load);
  if (closed) w.metrics.onLost(posterKind(w, load), load.shipperRate * load.miles);
  const unhauled = noShow ? "after its carrier failed to show at the pickup" : closed ? "before its pickup closed" : `in ${rounds} rounds`;
  load.status = "expired";
  if (w.cfg.brokerage.enabled) onFallOff(w, load);
  if (load.brokerId !== null) {
    const broker = companyById(w, load.brokerId);
    const charge = fallOffShare * load.shipperRate * load.miles;
    w.ledger.post(w.t, companyAccount(broker.id), "sink:broker_falloff", charge, ref);
    broker.operating.costFd += charge;
    broker.openBrokerLoads--;
    w.listener?.({ kind: "notice", companyId: broker.id, topic: "board", text: `${noShow ? `Load #${load.id} was lost` : `No carrier took load #${load.id}`} ${unhauled} and the shipper gave up: a ${fmtInt(charge)} FD fall-off charge.`, tone: "bad" });
  }
  if (load.doubleBroker) {
    const db = companyById(w, load.doubleBroker.companyId);
    const charge = fallOffShare * load.doubleBroker.upstreamRate * load.miles;
    const to = load.brokerId !== null ? companyAccount(load.brokerId) : "sink:broker_falloff";
    w.ledger.post(w.t, companyAccount(db.id), to, charge, ref);
    db.operating.costFd += charge;
    if (load.brokerId !== null) companyById(w, load.brokerId).operating.revenueFd += charge;
    w.listener?.({ kind: "notice", companyId: db.id, topic: "board", text: `Nobody took load #${load.id} off your re-post and the shipper gave up: a ${fmtInt(charge)} FD fall-off charge.`, tone: "bad" });
  }
  if (load.shipperId !== null) {
    w.listener?.({ kind: "notice", companyId: load.shipperId, topic: "board", text: `No carrier took load #${load.id} ${unhauled}: the goods went unsold.`, tone: "bad" });
  }
  w.loads.delete(load.id);
}

/** Open loads minus idle trucks, per hub and equipment, after clearing. */
function openLoadSurplus(w: World): Map<string, number> {
  const surplus = new Map<string, number>();
  const bump = (key: string, d: number) => surplus.set(key, (surplus.get(key) ?? 0) + d);
  for (const load of w.loads.values()) if (load.status === "open" && readyToday(w, load)) bump(boardKey(load.origin, load.equipment), 1);
  for (const truck of w.trucks) if (truck.status === "idle") bump(boardKey(truck.hub, truck.trailer), -1);
  return surplus;
}

function maybeReposition(w: World, truck: Truck, surplus: Map<string, number>): void {
  const company = companyById(w, truck.companyId);
  if (!crewed(truck) || company.authority.status !== "active") return;
  if (resting(w, truck)) return;
  if (ordersWaitForHand(w, company)) return; // the first bid by hand: the truck waits at home
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
