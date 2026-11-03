import { hubMiles } from "./world.js";
import { highValueMult, theftRatePerMile } from "./risk.js";
import { localShare, tender, tenderOdds, isLocal } from "./contracts.js";
import { creditScore } from "./credit.js";
import type { EconomyConfig, Equipment } from "@lanes/config";
import { COMMODITIES, destWeights as placeDestWeights, dexp, dpow, marketMix, originWeights, PLACE_OF_HUB, placeMiles as netPlaceMiles, placeMilesFast as netPlaceMilesFast, placeRoute as netPlaceRoute, type Lane, type Network } from "@lanes/data";
import { dayOf } from "./clock.js";
import { EQUIPMENT, planFreight, planIndex, seasonality } from "./demand.js";
import type { VettingTier, Company } from "./types.js";
import { clamp, fscPerMile, fuelPrice } from "./economics.js";
import { brokerLicensed } from "./staking.js";
import { apCapBlock, brokerBooks, contractOn, factoringLog, type BrokerBook } from "./receivables.js";

/**
 * The circular economy (0.18.0): what NPC shippers pay per mile follows the reserve against its
 * genesis level, so FD hoarded away from the reserve lowers rates and FD spent back into it raises
 * them. 1 in the open mode.
 */
export function reserveFactor(w: World): number {
  const k = w.cfg.token.circular;
  if (!k.enabled) return 1;
  const genesis = k.capFd * k.shares.reserve;
  return clamp(dpow(Math.max(0, w.ledger.reserve()) / genesis, k.reserveFactor.exponent), k.reserveFactor.clamp[0], k.reserveFactor.clamp[1]);
}
import type { Load } from "./types.js";
import { startHold } from "./brokerage.js";
import type { World } from "./world.js";

/** Destination weights per origin hub and equipment; static, so cached per network. */
const destWeightCache = new WeakMap<Network, Map<string, number[]>>();

function destWeights(cfg: EconomyConfig, net: Network, origin: number, eq: Equipment): number[] {
  let cache = destWeightCache.get(net);
  if (!cache) destWeightCache.set(net, (cache = new Map()));
  const key = `${origin}|${eq}`;
  let weights = cache.get(key);
  if (!weights) {
    weights = net.lanesFrom[origin]!.map((lane) => {
      const dest = net.hubs[lane.dest]!;
      // Strong-outbound hubs pull less inbound freight, so imbalance shows up both
      // ways, damped by `inboundPull` so backhaul deserts don't swallow the fleet.
      const inbound = clamp(1 + cfg.freight.inboundPull * (1 - dest.imbalance[eq]), 0.3, 1.7);
      return dest.weight * inbound * dexp(-lane.miles / cfg.freight.destDistanceDecayMi);
    });
    cache.set(key, weights);
  }
  return weights;
}

export interface RoundFreight {
  loads: Load[];
  facilityLoads: number;
}

/**
 * Generates one round of freight (§Load board — freight sources; §Rates):
 * NPC shippers fill whatever share of each hub's demand player facilities
 * don't take, and every load is priced from the lane reference rate:
 *   ref = base(lane) × (loads / trucks)^0.35 × weather × equipment premium + FSC
 */
export function generateRoundFreight(w: World): RoundFreight {
  const { cfg, net, feeds } = w;
  const rng = w.rng.freight;
  const day = dayOf(w.t, cfg);
  const n = net.hubs.length;
  const fsc = fscPerMile(cfg, fuelPrice(w));
  const plan = planFreight(w, day);

  // 1. Counts: NPC per hub and equipment, then each facility in id order.
  const E = EQUIPMENT.length;
  const npcCounts = new Int32Array(n * E);
  const loadsAt = new Float64Array(n * E);
  for (let i = 0; i < n; i++) {
    for (let e = 0; e < E; e++) {
      const k = planIndex(i, e);
      npcCounts[k] = rng.count(plan.npcExpected[k]!);
      loadsAt[k]! += npcCounts[k]!;
    }
  }
  const facilityCounts = w.facilities.map((f, k) => {
    const c = rng.count(plan.facilityExpected[k]!);
    loadsAt[planIndex(f.hub, EQUIPMENT.indexOf(f.equipment))]! += c;
    return c;
  });
  for (const load of w.loads.values()) if (load.status === "open") loadsAt[planIndex(load.origin, EQUIPMENT.indexOf(load.equipment))]!++;

  // 2. Load-to-truck ratio within the nearby radius, per trailer type: Miami can be
  // swamped with idle vans while its reefer market is tight in produce season. Idle
  // trucks that were priced out this round don't count as capacity: they won't haul
  // at these rates, and counting them would push rates lower still.
  const trucksAt = new Float64Array(n * E);
  for (let i = 0; i < n; i++) {
    for (let e = 0; e < E; e++) trucksAt[planIndex(i, e)] = cfg.npc.trucksPerHubWeight * net.hubs[i]!.weight * cfg.freight.equipmentShare[EQUIPMENT[e]!];
  }
  for (const truck of w.trucks) {
    if (truck.status === "idle" && truck.pricedOutRound !== w.round) trucksAt[planIndex(truck.hub, EQUIPMENT.indexOf(truck.trailer))]!++;
  }
  const [lo, hi] = cfg.rates.ratioClamp;
  const ratio = new Float64Array(n);
  const ratioEq = new Float64Array(n * E);
  for (let i = 0; i < n; i++) {
    let loads = 0;
    let trucks = 0;
    for (let e = 0; e < E; e++) {
      let l = 0;
      let t = 0;
      for (const j of net.nearby[i]!) {
        l += loadsAt[planIndex(j, e)]!;
        t += trucksAt[planIndex(j, e)]!;
      }
      ratioEq[planIndex(i, e)] = clamp(l / Math.max(1, t), lo, hi);
      loads += l;
      trucks += t;
    }
    ratio[i] = clamp(loads / Math.max(1, trucks), lo, hi);
  }
  w.lastRatio = ratio;
  w.lastRatioEq = ratioEq;
  // How easily a truck reloads after delivering at each hub, smoothed so one round doesn't swing prices.
  const beta = 1 / cfg.rates.reloadSmoothingRounds;
  for (let k = 0; k < n * E; k++) w.reloadIndex[k] = w.reloadIndex[k]! + beta * (ratioEq[k]! - w.reloadIndex[k]!);
  for (let e = 0; e < E; e++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += w.reloadIndex[planIndex(i, e)]!;
    w.reloadMean[e] = sum / n;
  }

  // Contract rates trail the spot market: smooth each hub's spot rate level over the contract lag.
  const alpha = 1 / (cfg.brokerRisk.contractLagDays * cfg.time.boardRoundHours.length);
  for (let i = 0; i < n; i++) {
    for (let e = 0; e < EQUIPMENT.length; e++) {
      const eq = EQUIPMENT[e]!;
      const k = planIndex(i, e);
      const spot = dpow(ratioEq[k]!, cfg.rates.ratioExponent) * feeds.weather(net.hubs[i]!.id, day) * seasonality(w, i, eq, day).rate;
      // The first round's contracts are signed at the market as it stands.
      w.contractIndex[k] = Number.isNaN(w.contractIndex[k]!) ? spot : w.contractIndex[k]! + alpha * (spot - w.contractIndex[k]!);
    }
  }

  // Toll roads cost the carrier, so (like fuel) the shipper's rate carries them.
  const tollPerMile = (lane: Lane) => (cfg.roads.tollsInRates ? lane.tollFd / lane.miles : 0);
  // The climb's fuel (roads.terrain), in the rate like tolls: a mountain lane pays for its grades.
  const tr = cfg.roads.terrain;
  const terrainPerMile = (lane: Lane) => (tr.enabled && tr.inRates ? (tr.fuelGalPerClimbM * lane.climbM * fuelPrice(w)) / lane.miles : 0);
  // Cargo-theft risk on the lane (risk.ts), in the rate: a hotspot lane pays more.
  const theftPerMile = (lane: Lane, eq: Equipment) => theftRatePerMile(w, lane.origin, lane.dest, eq);
  // Freight into a market trucks can't reload in carries part of the empty run out, per loaded mile.
  const exitPerMile = (lane: Lane, eq: Equipment) => (cfg.rates.exitDeadheadShare * cfg.rates.deadheadFdPerMile * expectedReloadDeadheadMi(w, lane.dest, eq)) / lane.miles;
  const rf = reserveFactor(w) * w.stab.rateMult; // the reserve, and the balance dial (step.ts monthlyStabilizers)
  const refRate = (lane: Lane, eq: Equipment) =>
    lane.baseRate *
      rf *
      dpow(ratioEq[planIndex(lane.origin, EQUIPMENT.indexOf(eq))]!, cfg.rates.ratioExponent) *
      feeds.weather(net.hubs[lane.origin]!.id, day) *
      cfg.rates.equipmentPremium[eq] *
      seasonality(w, lane.origin, eq, day).rate *
      reloadFactor(w, lane.dest, eq) +
    fsc +
    tollPerMile(lane) +
    terrainPerMile(lane) +
    theftPerMile(lane, eq) +
    exitPerMile(lane, eq);

  const month = Math.floor(((day % cfg.time.daysPerSeason) / cfg.time.daysPerSeason) * 12);
  const eco = net.economy;
  /** Sets a load's miles, hours, tolls and appointment from the route between its places. */
  const routeLoad = (load: Load) => {
    const r = netPlaceRoute(net, load.originPlace, load.destPlace);
    if (r) {
      load.miles = Math.max(1, Math.round(r.miles));
      load.routeHours = r.hours;
      load.routeTollFd = r.tollFd;
    } else if (load.originPlace !== load.destPlace) {
      load.miles = Math.max(1, netPlaceMiles(net, load.originPlace, load.destPlace));
      load.routeHours = load.miles / cfg.hos.avgMph;
      load.routeTollFd = 0;
    }
    // The appointment: the commodity's window plus the drive at the legal pace.
    const perDay = cfg.hos.drivingHoursPerDay;
    const fullDays = Math.max(0, Math.ceil(load.routeHours / perDay) - 1);
    const transitMin = (fullDays * cfg.hos.dutyDayHours + (load.routeHours - fullDays * perDay)) * 60;
    load.appointmentT = w.t + COMMODITIES[load.commodity]!.windowHours * 60 + transitMin;
  };
  /** Draws what ships and between which places: the market's mix this month, then a shipper and a receiver by weight. */
  const placeLoad = (load: Load, lane: Lane, eq: Equipment) => {
    const mix = marketMix(eco, lane.origin, eq, month);
    if (mix.length > 0) {
      load.commodity = mix[rng.weighted(mix.map((m) => m.weight))]!.commodity;
      const o = originWeights(eco, lane.origin, load.commodity, month);
      if (o.length > 0) load.originPlace = o[rng.weighted(o.map((x) => x.weight))]!.place;
      const d = placeDestWeights(eco, lane.dest, load.commodity);
      if (d.length > 0) load.destPlace = d[rng.weighted(d.map((x) => x.weight))]!.place;
    }
    routeLoad(load);
  };

  /** How much more a shipper pays per mile for a pickup far from its market's hub. */
  const remoteMult = (load: Load) => 1 + Math.min(cfg.rates.remotePremiumCap, (cfg.rates.remotePremiumPer100Mi * netPlaceMilesFast(net, load.originPlace, PLACE_OF_HUB[load.origin]!)) / 100);

  const newLoad = (lane: Lane, eq: Equipment, baseRef: number): Load => {
    let ref = baseRef;
    const ceiling = ref * cfg.rates.npcCeilingMarkup;
    const load: Load = {
      bookNow: openBookNow(w, ref, ceiling, ratioEq[planIndex(lane.origin, EQUIPMENT.indexOf(eq))]!),
      id: w.nextLoadId++,
      laneId: lane.id,
      origin: lane.origin,
      dest: lane.dest,
      miles: lane.miles,
      equipment: eq,
      brokerId: null,
      shipperId: null,
      facilityId: null,
      saleValue: 0,
      shipperRate: ceiling,
      spotShipperRate: ceiling,
      refRate: ref,
      ceiling,
      postedRound: w.round,
      roundsUnfilled: 0,
      status: "open",
      carrierId: null,
      truckId: null,
      clearedRate: 0,
      dueT: 0,
      hot: 0,
      vet: 0,
      cargoValue: 0,
      doubleBroker: null,
      commodity: 0,
      originPlace: PLACE_OF_HUB[lane.origin]!,
      destPlace: PLACE_OF_HUB[lane.dest]!,
      appointmentT: 0,
      slotT: 0,
      routeHours: lane.hours,
      routeTollFd: lane.tollFd,
      localUntilRound: 0,
      contractId: 0,
      tenderedTo: 0,
      tenderUntil: 0,
    };
    placeLoad(load, lane, eq);
    // A pickup out of town pays for the empty run to it: the premium lifts every price on the load.
    const mult = remoteMult(load);
    if (mult > 1) {
      ref *= mult;
      load.refRate = ref;
      load.ceiling *= mult;
      load.bookNow *= mult;
      load.shipperRate *= mult;
      load.spotShipperRate *= mult;
    }
    return load;
  };

  // Hot loads (safety.ts): long hauls with a window only falsified logs or a team can make, at a premium.
  const hl = cfg.safety.hotLoads;
  const hotOdds = (eq: Equipment) => (hl.share * hl.equipmentShare[eq]) / cfg.freight.equipmentShare[eq];
  const makeHot = (load: Load) => {
    if (load.miles < hl.minMiles || rng.next() >= hotOdds(load.equipment)) return;
    load.hot = rng.range(hl.premium[0], hl.premium[1]);
    load.ceiling *= load.hot;
    load.bookNow = Math.min(load.ceiling, load.bookNow * load.hot);
    load.shipperRate = load.ceiling;
    load.spotShipperRate = load.ceiling;
  };
  /** What the goods are worth, and who the poster lets haul them. */
  const finish = (load: Load, vet: VettingTier) => {
    // A high-value load pays for its security (risk.ts): every price on it lifts.
    const hv = highValueMult(cfg, load.commodity);
    if (hv > 1) {
      load.refRate *= hv;
      load.ceiling *= hv;
      load.bookNow *= hv;
      load.shipperRate *= hv;
      load.spotShipperRate *= hv;
    }
    const m = cfg.fraud.cargoMultiple;
    const bill = load.refRate * (load.hot || 1) * load.miles;
    load.cargoValue = load.facilityId !== null ? load.saleValue : bill * (load.brokerId !== null ? m[load.equipment] : m.npcDirect) * (load.hot ? m.hot : 1);
    load.vet = (load.hot > 0 ? Math.max(1, vet) : vet) as VettingTier;
  };

  // 3. NPC loads, half of them tendered to brokers.
  const brokers = w.companies.filter((c) => c.role === "broker");
  // The AP cap (token.payment.factoring.contract): a broker takes a tender only while what it owes and has posted fits its bond.
  const books = contractOn(w) && brokers.length > 0 ? brokerBooks(w) : undefined;
  const created: Load[] = [];
  for (let i = 0; i < n; i++) {
    const lanes = net.lanesFrom[i]!;
    if (lanes.length === 0) continue;
    for (let e = 0; e < EQUIPMENT.length; e++) {
      const eq = EQUIPMENT[e]!;
      const weights = destWeights(cfg, net, i, eq);
      for (let k = 0; k < npcCounts[planIndex(i, e)]!; k++) {
        const lane = lanes[rng.weighted(weights)]!;
        const load = newLoad(lane, eq, refRate(lane, eq));
        makeHot(load);
        // Shipper leverage: where trucks pile up, most loads go to local carriers first.
        if (rng.next() < localShare(w, i, eq)) load.localUntilRound = w.round + cfg.leverage.localRounds;
        if (rng.next() < cfg.freight.npcBrokerOnlyShare) {
          const contractRef = lane.baseRate * w.contractIndex[planIndex(i, e)]! * cfg.rates.equipmentPremium[eq] * reloadFactor(w, lane.dest, eq) + fsc + tollPerMile(lane) + terrainPerMile(lane) + theftPerMile(lane, eq) + exitPerMile(lane, eq);
          tenderToBroker(w, load, brokers, contractRef * remoteMult(load) * cfg.rates.npcCeilingMarkup * (load.hot || 1), books);
        }
        finish(load, load.brokerId !== null ? w.companies[load.brokerId - 1]!.vetting : 0);
        w.loads.set(load.id, load);
        created.push(load);
      }
    }
  }

  // 4. Contract tenders: a load on the contract's lane and places, at spot prices on paper but held for its carrier.
  for (const c of w.contracts) {
    if (c.status !== "active" || rng.next() >= tenderOdds(w, c)) continue;
    const lane = net.lanes[c.laneId]!;
    const load = newLoad(lane, c.equipment, refRate(lane, c.equipment));
    finish(load, 0);
    tender(w, load, c);
    routeLoad(load);
    w.loads.set(load.id, load);
    created.push(load);
  }

  // 5. Facility loads: posted by their owner to the open board.
  let facilityLoads = 0;
  w.facilities.forEach((f, k) => {
    const lanes = net.lanesFrom[f.hub]!;
    if (lanes.length === 0 || f.ownerId === 0) return;
    const weights = destWeights(cfg, net, f.hub, f.equipment);
    for (let c = 0; c < facilityCounts[k]!; c++) {
      const lane = lanes[rng.weighted(weights)]!;
      const ref = refRate(lane, f.equipment);
      const load = newLoad(lane, f.equipment, ref);
      // A facility ships from its own hub's place.
      load.originPlace = PLACE_OF_HUB[f.hub]!;
      routeLoad(load);
      load.shipperId = f.ownerId;
      load.facilityId = f.id;
      load.saleValue = ref * cfg.facilities.types[f.type].saleValueOfRef * lane.miles;
      finish(load, w.companies[f.ownerId - 1]!.vetting);
      w.loads.set(load.id, load);
      created.push(load);
      facilityLoads++;
    }
  });
  return { loads: created, facilityLoads };
}

/**
 * Broker-only NPC freight goes to a broker at the broker's contract rate with
 * that shipper (trailing the spot market), and the broker reposts it at its margin.
 */
/**
 * The poster's opening book-now price: a share of the reference set by the origin's
 * load-to-truck ratio (shipper leverage), never above the ceiling. Brokers fish low
 * where trucks pile up and open near the ceiling where they're scarce.
 */
export function openBookNow(w: World, ref: number, ceiling: number, ratio: number): number {
  const pts = w.cfg.bookNow.openAtRatio;
  let share = pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [r0, s0] = pts[i - 1]!;
    const [r1, s1] = pts[i]!;
    share = s1;
    if (ratio <= r1) {
      share = s0 + (s1 - s0) * clamp((ratio - r0) / (r1 - r0), 0, 1);
      break;
    }
  }
  return Math.min(ceiling, ref * share);
}

function tenderToBroker(w: World, load: Load, brokers: Company[], contractShipperRate: number, books?: Map<number, BrokerBook>): void {
  const eligible: Company[] = [];
  const weights: number[] = [];
  // What the load would add to a broker's books if posted at its ceiling (the high-value lift lands after the tender).
  const posts = (b: Company) => contractShipperRate * (1 - clamp(marginOf(b), 0, 0.9)) * load.miles * highValueMult(w.cfg, load.commodity);
  let capped = false;
  for (const b of brokers) {
    const order = b.orders.find((o) => o.kind === "broker");
    if (order && order.kind === "broker" && b.openBrokerLoads < order.maxOpenLoads && brokerLicensed(w, b)) {
      if (books) {
        const why = apCapBlock(w, b, books.get(b.id), posts(b), true);
        if (why) {
          capNotice(w, b, why);
          capped = true;
          continue;
        }
      }
      eligible.push(b);
      // Shippers favor brokers with strong credit that take a thinner cut (credit.ts).
      weights.push((0.25 + creditScore(w, b) / 100) / dpow(Math.max(0.01, order.marginPct), 2));
    }
  }
  if (capped) factoringLog(w).tendersCapped++;
  // With no broker capacity the load stays on the open board as NPC spot freight.
  if (eligible.length === 0) {
    if (capped) factoringLog(w).tendersToBoard++;
    return;
  }
  const broker = eligible[w.rng.freight.weighted(weights)]!;
  const order = broker.orders.find((o) => o.kind === "broker");
  const margin = clamp(order && order.kind === "broker" ? order.marginPct : 0, 0, 0.9);
  load.brokerId = broker.id;
  load.shipperRate = contractShipperRate;
  load.ceiling = contractShipperRate * (1 - margin);
  load.bookNow = Math.min(load.bookNow, load.ceiling);
  broker.openBrokerLoads++;
  startHold(w, load, broker); // a player's brokerage holds it off the board first (brokerage.ts)
  if (books) {
    let b = books.get(broker.id);
    if (!b) books.set(broker.id, (b = { apFd: 0, postedFd: 0 }));
    b.postedFd += posts(broker);
  }
}

const marginOf = (b: Company) => {
  const order = b.orders.find((o) => o.kind === "broker");
  return order && order.kind === "broker" ? order.marginPct : 0;
};

/** A broker at its bond hears so once a game day; the tender goes to another broker or to the open board. */
function capNotice(w: World, b: Company, why: string): void {
  const log = factoringLog(w);
  const today = dayOf(w.t, w.cfg);
  if (log.capNoticeDay[b.id] === today) return;
  log.capNoticeDay[b.id] = today;
  w.listener?.({ kind: "notice", companyId: b.id, topic: "board", text: `A shipper's tender passed you by: ${why}. Post more bond to take more freight.`, tone: "bad" });
}

/**
 * How easily a truck of this type reloads after delivering at a hub (1 = average):
 * the hub's production/consumption balance for that trailer (Miami consumes far more
 * than it ships), times its live load-to-truck ratio against the national average
 * (Miami's reefer market is tight in May and dead in September).
 */
export function reloadOdds(w: World, hub: number, eq: Equipment): number {
  const e = EQUIPMENT.indexOf(eq);
  const live = w.reloadIndex[planIndex(hub, e)]! / Math.max(0.01, w.reloadMean[e]!);
  return w.net.hubs[hub]!.imbalance[eq] * live;
}

/**
 * Destination pricing: freight into a market where trucks of that type pile up
 * (reloading is harder than average) pays a premium, because the carrier will run
 * empty to reload; freight into a tight market pays a little less.
 */
export function reloadFactor(w: World, destHub: number, eq: Equipment): number {
  const { reloadExponent, reloadClamp } = w.cfg.rates;
  return clamp(dpow(reloadOdds(w, destHub, eq), -reloadExponent), reloadClamp[0], reloadClamp[1]);
}

/**
 * Days a carrier can expect to wait for a load at a market: one over its effective load-to-truck
 * ratio (a visitor sees only the share of loads not held for local carriers), in rounds, halved.
 */
export function expectedWaitDays(w: World, hub: number, eq: Equipment, company: Company | null): number {
  const k = w.cfg.bookNow.desperation;
  const e = EQUIPMENT.indexOf(eq);
  const ratio = w.reloadIndex[planIndex(hub, e)] ?? 1;
  const local = company ? isLocal(w, company, hub) : false;
  const eff = ratio * (local ? 1 : 1 - localShare(w, hub, eq));
  const rounds = Math.max(0, 1 / Math.max(0.02, eff) - 1);
  return clamp(rounds / w.cfg.time.boardRoundHours.length, 0, k.maxWaitDays);
}

/**
 * Where a truck that can't reload at a hub should run empty to, if anywhere: the market where
 * the days saved waiting are worth more than the empty miles, by the most. A visitor stuck in a
 * market that keeps its freight for locals leaves; a local that can afford to wait doesn't.
 * The same rule moves stuck trucks (board.ts) and prices the exit into freight going in.
 */
export function bestExitHub(w: World, hub: number, eq: Equipment, company: Company | null = null): { hub: number; miles: number } | null {
  const k = w.cfg.bookNow.desperation;
  const waitHere = expectedWaitDays(w, hub, eq, company);
  let best = -1;
  let bestValue = 0;
  for (let j = 0; j < w.net.hubs.length; j++) {
    if (j === hub) continue;
    const miles = hubMiles(w, hub, j);
    if (miles > k.repositionWithinMi) continue;
    const saved = waitHere - expectedWaitDays(w, j, eq, company) - miles / (w.cfg.hos.avgMph * w.cfg.hos.drivingHoursPerDay);
    const value = saved * k.opportunityFdPerDay - miles * w.cfg.rates.deadheadFdPerMile;
    if (value > bestValue) {
      bestValue = value;
      best = j;
    }
  }
  return best < 0 ? null : { hub: best, miles: hubMiles(w, hub, best) };
}

/**
 * Empty miles a truck of this type can expect to run to reload after delivering
 * at a hub: a short hop where it reloads easily, and the way out of the market
 * where it doesn't, in proportion. Looking `aheadDays` out, the reload odds move
 * with the hub's season: a market about to boom reloads easier than it does today.
 */
export function expectedReloadDeadheadMi(w: World, destHub: number, eq: Equipment, aheadDays = 0): number {
  const { reloadDeadheadMi, reloadDeadheadClamp } = w.cfg.board;
  let odds = reloadOdds(w, destHub, eq);
  if (aheadDays > 0) {
    const day = dayOf(w.t, w.cfg);
    odds *= seasonality(w, destHub, eq, day + aheadDays).volume / Math.max(0.01, seasonality(w, destHub, eq, day).volume);
  }
  const local = reloadDeadheadMi / Math.max(0.01, odds);
  const stuck = clamp(1 - odds, 0, 1);
  const exit = stuck > 0 ? bestExitHub(w, destHub, eq) : null;
  const expected = exit ? (1 - stuck) * local + stuck * Math.max(local, exit.miles) : local;
  return clamp(expected, reloadDeadheadClamp[0], reloadDeadheadClamp[1]);
}

/** Destination weights over a hub's lanes, for contract offers (contracts.ts). */
export const laneDestWeights = destWeights;
