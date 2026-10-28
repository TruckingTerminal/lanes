import { generateRoundFreight } from "./freight.js";
import { companyAccount } from "./ledger.js";
import { bidsFromStandingOrders, boardKey, indexOpenLoads, scoreBid } from "./standingOrders.js";
import { startLoading } from "./trips.js";
import type { Bid, Load, Truck } from "./types.js";
import { companyById, hubMiles, truckById, type World } from "./world.js";

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
  let cleared = 0;
  let clearedRateSum = 0;
  for (const bid of bids) {
    const load = w.loads.get(bid.loadId)!;
    if (load.status !== "open" || truckTaken.has(bid.truckId)) continue;
    truckTaken.add(bid.truckId);
    assign(w, load, truckById(w, bid.truckId), bid);
    companyById(w, bid.companyId).bidStats.wins++;
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
    } else if (load.shipperId === null && load.roundsUnfilled >= w.cfg.board.npcFallbackAfterRounds) {
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
    if (!load || load.status !== "open" || truck.status !== "idle" || truck.trailer !== load.equipment || truck.companyId === 0) continue;
    const company = companyById(w, truck.companyId);
    const deadheadMi = hubMiles(w, truck.hub, load.origin);
    const rate = Math.min(mb.rate, load.ceiling);
    out.push({ loadId: load.id, truckId, companyId: company.id, rate, deadheadMi, score: scoreBid(w, load.ceiling, rate, company.reputation, deadheadMi), tiebreak: 0 });
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
  const drivingH = (bid.deadheadMi + load.miles) / cfg.hos.avgMph;
  const fullDays = Math.floor(drivingH / cfg.hos.drivingHoursPerDay);
  const transitMin = (fullDays * cfg.hos.dutyDayHours + (drivingH - fullDays * cfg.hos.drivingHoursPerDay)) * 60;
  const dwellMin = cfg.dwell.loadMinutes[1] + cfg.dwell.unloadMinutes[1];
  load.dueT = w.t + transitMin + dwellMin + cfg.freight.deliverySlackMinutes;
  truck.loadId = load.id;
  truck.idleRounds = 0;
  if (bid.deadheadMi === 0) {
    startLoading(w, truck, load);
  } else {
    truck.status = "toPickup";
    truck.targetHub = load.origin;
    truck.remainingMi = bid.deadheadMi;
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
}

/**
 * NPC loads never go uncovered: an NPC carrier takes them at 95% of reference.
 * For direct NPC freight the NPC shipper pays the NPC carrier, so no player FD
 * moves.
 */
function npcCover(w: World, load: Load): void {
  load.status = "npcCovered";
  if (load.brokerId !== null) {
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
  w.ledger.post(w.t, "faucet:npc_market", acct, load.saleValue, ref);
  w.ledger.post(w.t, acct, "sink:npc_expediter", cost, ref);
  const facility = w.facilities[load.facilityId! - 1];
  if (facility) facility.netFd += load.saleValue - cost;
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
        const value = open - miles / 200;
        if (open >= 1 && value > best) {
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
    truck.remainingMi = hubMiles(w, truck.hub, target);
    truck.idleRounds = 0;
    return;
  }
}
