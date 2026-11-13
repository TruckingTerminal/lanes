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
/**
 * R11's market line (rates.news): the national cleared rate over the last `shortDays` against the `longDays` before them,
 * weighted by loads cleared. "booming" past boomAt, "slumping" under slumpAt, else "steady". Screens only.
 */
export function marketMood(w: World): { state: "booming" | "slumping" | "steady"; change: number } {
  const k = w.cfg.rates.news;
  const days = w.metrics.days;
  const avg = (xs: typeof days) => {
    const n = xs.reduce((s, d) => s + d.cleared, 0);
    return n > 0 ? xs.reduce((s, d) => s + d.avgClearedRate * d.cleared, 0) / n : 0;
  };
  const recent = avg(days.slice(-k.shortDays));
  const before = avg(days.slice(-(k.shortDays + k.longDays), -k.shortDays));
  if (!(recent > 0 && before > 0)) return { state: "steady", change: 0 };
  const change = recent / before - 1;
  return { state: change >= k.boomAt ? "booming" : change <= k.slumpAt ? "slumping" : "steady", change };
}

const CLEARS_MIN = 5;
const CLEARS_ALPHA = 1 / 40;
/**
 * The trailing clearing rate under a key. `halfLifeMin` 0 (freight.clearsNear.halfLifeDays off): a plain mean for 40
 * clears, then a trailing mean by count, exactly as before. On: a mean weighted by time, each clear's weight halving every
 * half-life, so a lane's first days fade with the days rather than holding the mean for its first 40 clears (item 5: the
 * week-one lag). Its weight and last minute sit beside the entry under `${key}|decay`, read by nothing else.
 */
function trackClears(table: Record<string, [number, number]>, key: string, rate: number, t: number, halfLifeMin: number): void {
  const x = table[key];
  if (!x) {
    table[key] = [rate, 1];
    if (halfLifeMin > 0) table[`${key}|decay`] = [1, t];
    return;
  }
  if (halfLifeMin > 0) {
    // Switched on in a running world: the clears so far weigh what the trailing mean gave them.
    const d = table[`${key}|decay`] ?? [Math.min(x[1], 1 / CLEARS_ALPHA), t];
    const weight = d[0] * dpow(0.5, Math.max(0, t - d[1]) / halfLifeMin);
    x[0] += (rate - x[0]) / (weight + 1);
    table[`${key}|decay`] = [weight + 1, t];
  } else x[0] += (x[1] < 1 / CLEARS_ALPHA ? 1 / (x[1] + 1) : CLEARS_ALPHA) * (rate - x[0]); // a plain mean for 40 clears, then trailing
  x[1]++;
}

/** freight.clearsNear.halfLifeDays in game minutes; 0 (off) keeps the trailing mean by count. */
const clearsHalfLifeMin = (w: World): number => w.cfg.freight.clearsNear.halfLifeDays * w.cfg.time.gameMinutesPerDay;

/** freight.clearsNear.ratio: the economy's rule (ratios to the reference, read with a prior); a config without the key is off. */
const ratioOn = (w: World): boolean => w.cfg.freight.clearsNear.ratio === true;
/** What a clear is measured against under the ratio rule: the load's own reference, its hot premium in it (as the figure's base). */
const clearsBase = (load: Load): number => load.refRate * (load.hot || 1);

/**
 * The clears table for the rule in force. Its meaning changes with freight.clearsNear.ratio (rates per mile, or ratios to
 * the reference), so a table kept under the other rule starts afresh when the switch turns: an empty table, which reads
 * the reference until clears arrive, as a fresh world does (the economy's note).
 */
function clearsTable(w: World): NonNullable<World["clears"]> {
  const ratio = ratioOn(w);
  if (!w.clears || (w.clears.ratio === true) !== ratio) w.clears = ratio ? { lane: {}, hub: {}, ratio: true } : { lane: {}, hub: {} };
  return w.clears;
}

/** Every cleared spot load (board.ts assign; not contract tenders): the lane's and the origin market's trailing clearing rate. */
export function noteClear(w: World, load: Load, rate: number): void {
  if (load.contractId) return;
  const c = clearsTable(w);
  const half = clearsHalfLifeMin(w);
  const x = c.ratio ? rate / clearsBase(load) : rate;
  trackClears(c.lane, `${load.laneId}:${load.equipment}`, x, w.t, half);
  trackClears(c.hub, `${load.origin}:${load.equipment}`, x, w.t, half);
}

/**
 * A key's weight now, under the ratio rule: its time weight decayed to this minute by the half-life (read only: nothing is
 * written), or its count with the half-life off; 0 for a key with no entry.
 */
function clearsWeight(table: Record<string, [number, number]>, key: string, t: number, halfLifeMin: number): number {
  const x = table[key];
  if (!x) return 0;
  if (!(halfLifeMin > 0)) return x[1];
  const d = table[`${key}|decay`];
  return d ? d[0] * dpow(0.5, Math.max(0, t - d[1]) / halfLifeMin) : Math.min(x[1], 1 / CLEARS_ALPHA);
}

/**
 * The ratio rule's parts for a load (freight.clearsNear.ratio): the hub's ratio blends its clears with the reference (1)
 * at priorClears' weight; the lane's blends its clears with the hub's ratio the same way. Weights are decayed to now at
 * read time. The board's explanation reads the shares (apps/web board.ts clearsNearSource).
 */
export function clearsNearParts(w: World, load: Load): { laneW: number; laneM: number; hubW: number; hubM: number; prior: number; hubRatio: number; laneRatio: number } {
  // Read only: a table kept under the other rule (before the switch's first clear resets it) reads as empty.
  const t = w.clears?.ratio === true ? w.clears : { lane: {}, hub: {} };
  const half = clearsHalfLifeMin(w);
  const p = w.cfg.freight.clearsNear.priorClears ?? CLEARS_MIN;
  const laneKey = `${load.laneId}:${load.equipment}`;
  const hubKey = `${load.origin}:${load.equipment}`;
  const hubW = clearsWeight(t.hub, hubKey, w.t, half);
  const laneW = clearsWeight(t.lane, laneKey, w.t, half);
  const hubM = t.hub[hubKey]?.[0] ?? 1;
  const laneM = t.lane[laneKey]?.[0] ?? 1;
  const hubRatio = (hubW * hubM + p * 1) / (hubW + p);
  const laneRatio = (laneW * laneM + p * hubRatio) / (laneW + p);
  return { laneW, laneM, hubW, hubM, prior: p, hubRatio, laneRatio };
}

/**
 * "Usually clears near" (R11, R1's bid anchor): the lane's trailing clearing rate for this trailer, else its origin market's,
 * else the load's own reference; never above the load's ceiling. Under the ratio rule (freight.clearsNear.ratio), the lane's
 * blended ratio times this load's own reference, never above its ceiling.
 */
export function clearsNear(w: World, load: Load): number {
  if (ratioOn(w)) return Math.min(load.ceiling, clearsNearParts(w, load).laneRatio * clearsBase(load));
  const lane = w.clears?.lane[`${load.laneId}:${load.equipment}`];
  const hub = w.clears?.hub[`${load.origin}:${load.equipment}`];
  const r = lane && lane[1] >= CLEARS_MIN ? lane[0] : hub && hub[1] >= CLEARS_MIN ? hub[0] : load.refRate * (load.hot || 1);
  return Math.min(r, load.ceiling);
}

export function reserveFactor(w: World): number {
  const k = w.cfg.token.circular;
  if (!k.enabled) return 1;
  const genesis = k.capFd * k.shares.reserve;
  return clamp(dpow(Math.max(0, w.ledger.reserve()) / genesis, k.reserveFactor.exponent), k.reserveFactor.clamp[0], k.reserveFactor.clamp[1]);
}
import type { Load } from "./types.js";
import { startHold } from "./brokerage.js";
import { aiBroker, brokerKey, brokerUncovered, drawLeadDays, facilityKey, lostMemory, noteNpcPosted, openWindow, readyToday, sameDayMult, tally, windowsOn } from "./windows.js";
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
  // Delivery windows: freight ready on a later day isn't today's market (windows.ts readyToday).
  for (const load of w.loads.values()) if (load.status === "open" && readyToday(w, load)) loadsAt[planIndex(load.origin, EQUIPMENT.indexOf(load.equipment))]!++;
  // Batch 4: the NPC freight lost at its pickup's close, remembered and decayed (windows.ts lostMemory), counts as open
  // demand, so a hub where freight goes unhauled reads as short of trucks and its next postings price higher.
  const lost = windowsOn(w) ? lostMemory(w) : null;
  // Windows batch 8: under windows, windows.ratioExponent in each of the ratio's three reads below (the contract index,
  // the memory-free contract index, the reference); off, rates.ratioExponent, term for term as before.
  const ratioEx = windowsOn(w) ? cfg.windows!.ratioExponent : cfg.rates.ratioExponent;
  // Batch 5: the open loads without the memory, for a facility's goods (facilityRef): worth what they were; the haul got dearer.
  const loadsBase = windowsOn(w) ? Float64Array.from(loadsAt) : null;
  if (lost) {
    const weight = cfg.windows!.lostMemoryWeight;
    for (let k = 0; k < n * E; k++) loadsAt[k]! += weight * lost[k]!;
  }

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
  const [lo, hiRates] = cfg.rates.ratioClamp;
  // Batch 5: while windows are on, the ratio's top is windows.ratioClampTop (the memory's lift reaches further); this one
  // clamp is what every reader of the ratio sees (economy.config.ts windows.ratioClampTop lists them).
  const hi = loadsBase ? (cfg.windows!.ratioClampTop ?? hiRates) : hiRates;
  const ratio = new Float64Array(n);
  const ratioEq = new Float64Array(n * E);
  const ratioEqBase = loadsBase ? new Float64Array(n * E) : null;
  for (let i = 0; i < n; i++) {
    let loads = 0;
    let trucks = 0;
    for (let e = 0; e < E; e++) {
      let l = 0;
      let lb = 0;
      let t = 0;
      for (const j of net.nearby[i]!) {
        l += loadsAt[planIndex(j, e)]!;
        if (loadsBase) lb += loadsBase[planIndex(j, e)]!;
        t += trucksAt[planIndex(j, e)]!;
      }
      ratioEq[planIndex(i, e)] = clamp(l / Math.max(1, t), lo, hi);
      if (ratioEqBase) ratioEqBase[planIndex(i, e)] = clamp(lb / Math.max(1, t), lo, hiRates);
      loads += l;
      trucks += t;
    }
    ratio[i] = clamp(loads / Math.max(1, trucks), lo, hi);
  }
  w.lastRatio = ratio;
  w.lastRatioEq = ratioEq;
  if (ratioEqBase) w.lastRatioEqBase = ratioEqBase; // windows batch 9: the bots' memory lift (windows.ts memoryLift)
  // How easily a truck reloads after delivering at each hub, smoothed so one round doesn't swing prices.
  const beta = 1 / cfg.rates.reloadSmoothingRounds;
  // Batch 5: the same index without the memory and under rates.ratioClamp, for a facility's goods (facilityRef); it starts
  // from the index as it stood the first round windows are on.
  if (ratioEqBase) {
    if (!w.reloadIndexBase || !w.reloadMeanBase) {
      w.reloadIndexBase = Float64Array.from(w.reloadIndex);
      w.reloadMeanBase = Float64Array.from(w.reloadMean);
    }
    const ib = w.reloadIndexBase;
    for (let k = 0; k < n * E; k++) ib[k] = ib[k]! + beta * (ratioEqBase[k]! - ib[k]!);
    for (let e = 0; e < E; e++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += ib[planIndex(i, e)]!;
      w.reloadMeanBase[e] = sum / n;
    }
  }
  for (let k = 0; k < n * E; k++) w.reloadIndex[k] = w.reloadIndex[k]! + beta * (ratioEq[k]! - w.reloadIndex[k]!);
  for (let e = 0; e < E; e++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += w.reloadIndex[planIndex(i, e)]!;
    w.reloadMean[e] = sum / n;
  }

  // Contract rates trail the spot market: smooth each hub's spot rate level over the contract lag.
  const alpha = 1 / (cfg.brokerRisk.contractLagDays * cfg.time.boardRoundHours.length);
  // Batch 7: the same index without the memory and under rates.ratioClamp, for every brokered tender's contract
  // (contractRef); it starts from the index as it stood the first round windows are on.
  if (ratioEqBase && !w.contractIndexBase) w.contractIndexBase = Float64Array.from(w.contractIndex);
  const cb = ratioEqBase ? w.contractIndexBase! : null;
  for (let i = 0; i < n; i++) {
    for (let e = 0; e < EQUIPMENT.length; e++) {
      const eq = EQUIPMENT[e]!;
      const k = planIndex(i, e);
      const weather = feeds.weather(net.hubs[i]!.id, day);
      const season = seasonality(w, i, eq, day).rate;
      const spot = dpow(ratioEq[k]!, ratioEx) * weather * season;
      // The first round's contracts are signed at the market as it stands.
      w.contractIndex[k] = Number.isNaN(w.contractIndex[k]!) ? spot : w.contractIndex[k]! + alpha * (spot - w.contractIndex[k]!);
      if (cb) {
        const spotBase = dpow(ratioEqBase![k]!, ratioEx) * weather * season;
        cb[k] = Number.isNaN(cb[k]!) ? spotBase : cb[k]! + alpha * (spotBase - cb[k]!);
      }
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
  const exitCap = cfg.rates.exitDeadheadMaxShareOfMiles;
  const exitPerMile = (lane: Lane, eq: Equipment) => {
    const dh = expectedReloadDeadheadMi(w, lane.dest, eq);
    return (cfg.rates.exitDeadheadShare * cfg.rates.deadheadFdPerMile * (exitCap === null ? dh : Math.min(dh, exitCap * lane.miles))) / lane.miles;
  };
  const rf = reserveFactor(w) * w.stab.rateMult * (w.stab.emissionMult ?? 1); // the emission cap (emission.ts), the reserve, and the balance dial (step.ts monthlyStabilizers)
  const refRateOf = (r: Float64Array) => (lane: Lane, eq: Equipment) =>
    lane.baseRate *
      rf *
      dpow(r[planIndex(lane.origin, EQUIPMENT.indexOf(eq))]!, ratioEx) *
      feeds.weather(net.hubs[lane.origin]!.id, day) *
      cfg.rates.equipmentPremium[eq] *
      seasonality(w, lane.origin, eq, day).rate *
      reloadFactor(w, lane.dest, eq) +
    fsc +
    tollPerMile(lane) +
    terrainPerMile(lane) +
    theftPerMile(lane, eq) +
    exitPerMile(lane, eq);
  const refRate = refRateOf(ratioEq);
  /**
   * Batch 5: what a facility's goods are worth per mile, the reference without the lost-load memory and under
   * rates.ratioClamp (the economy: the goods' value inflated with the lifted reference and took the NPC market's budget
   * from the hauls). The ratio term reads the memory-free ratio, and the destination's reload terms (reloadFactor, and
   * the expected empty run out in exitPerMile, through reloadOdds, expectedWaitDays and localShare) read the memory-free
   * index, put in w.reloadIndex for the call (nothing on that path caches). Off, the reference itself.
   */
  const facilityRef = (lane: Lane, eq: Equipment): number => {
    if (!ratioEqBase || !w.reloadIndexBase || !w.reloadMeanBase) return refRate(lane, eq);
    return withBaseReload(() => refRateOf(ratioEqBase)(lane, eq));
  };
  /** Runs `f` with the memory-free reload index in w.reloadIndex and w.reloadMean (batch 5; nothing on these paths caches). */
  const withBaseReload = <T>(f: () => T): T => {
    const index = w.reloadIndex;
    const mean = w.reloadMean;
    w.reloadIndex = w.reloadIndexBase!;
    w.reloadMean = w.reloadMeanBase!;
    try {
      return f();
    } finally {
      w.reloadIndex = index;
      w.reloadMean = mean;
    }
  };
  /**
   * What an NPC shipper's contract with its broker pays per mile, before the tender's own multipliers: every brokered
   * tender, an AI broker's and a player's brokerage's alike. The emission cap's rate lever reaches it as it reaches spot
   * (rf above): the haul's pay, not the cost pass-throughs; the contract index itself stays the market's own (red team,
   * 2026-11-08). Windows batch 7 (studio/reviews/economy-delivery-windows-batch6.md §4.1): while windows are on, the
   * contract reads the memory-free contract index under rates.ratioClamp (w.contractIndexBase), and its destination's
   * reload terms the memory-free reload index, as a facility's goods do; so the lost-load memory lifts what the board pays
   * a carrier for the load and not what the shipper pays the broker for it.
   */
  const contractRefOf = (index: Float64Array, lane: Lane, eq: Equipment): number =>
    lane.baseRate * (w.stab.emissionMult ?? 1) * index[planIndex(lane.origin, EQUIPMENT.indexOf(eq))]! * cfg.rates.equipmentPremium[eq] * reloadFactor(w, lane.dest, eq) + fsc + tollPerMile(lane) + terrainPerMile(lane) + theftPerMile(lane, eq) + exitPerMile(lane, eq);
  const contractRef = (lane: Lane, eq: Equipment): number => {
    const base = w.contractIndexBase;
    if (!ratioEqBase || !base || !w.reloadIndexBase || !w.reloadMeanBase) return contractRefOf(w.contractIndex, lane, eq);
    return withBaseReload(() => contractRefOf(base, lane, eq));
  };

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

  // Delivery windows (windows.ts): each load posted ahead, by a lead drawn from its own stream, so the rest draw as before.
  const win = windowsOn(w);
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
        // Delivery windows: the lead, from its own stream (drawn here, before the tender, so batch 4's same-day premium can
        // price it: the reference, then the ceiling, book-now and a broker's contract follow; windows.ts sameDayMult).
        const lead = win ? drawLeadDays(w) : 0;
        const sameDay = win ? sameDayMult(w, load, lead) : 1;
        // Shipper leverage: where trucks pile up, most loads go to local carriers first.
        if (rng.next() < localShare(w, i, eq)) load.localUntilRound = w.round + cfg.leverage.localRounds;
        if (rng.next() < cfg.freight.npcBrokerOnlyShare) {
          tenderToBroker(w, load, brokers, contractRef(lane, eq) * remoteMult(load) * cfg.rates.npcCeilingMarkup * (load.hot || 1) * sameDay, books);
        }
        finish(load, load.brokerId !== null ? w.companies[load.brokerId - 1]!.vetting : 0);
        if (win) noteNpcPosted(w, load); // batch 7: the hub's NPC freight posted, against what it loses (the facility test)
        // Batch 7 (the economy): a tender held for a player's brokerage opens its window at the release, not now
        // (brokerage.ts endHold), so the hold doesn't eat its pickup hours.
        if (win && load.hold) load.hold.lead = lead;
        else if (win) openWindow(w, load, lead);
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
    if (win) noteNpcPosted(w, load); // batch 7: NPC freight as the lost-load memory counts it
    if (win) openWindow(w, load, 0); // a tender is for now: its carrier answers within the tender's hours
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
      tally(w, facilityKey(f.hub), "taken"); // windows batch 6: the hub's facility freight posted, against what it loses
      // Batch 5: the goods at the reference without the lost-load memory (facilityRef); the haul itself pays `ref`.
      load.saleValue = facilityRef(lane, f.equipment) * cfg.facilities.types[f.type].saleValueOfRef * lane.miles;
      finish(load, w.companies[f.ownerId - 1]!.vetting);
      if (win) openWindow(w, load, drawLeadDays(w));
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
  let uncovered = false;
  for (const b of brokers) {
    const order = b.orders.find((o) => o.kind === "broker");
    if (order && order.kind === "broker" && b.openBrokerLoads < order.maxOpenLoads && brokerLicensed(w, b)) {
      // Windows batch 6: an AI broker that loses too much of what it takes at this hub doesn't take another tender here.
      if (brokerUncovered(w, b.id, load.origin)) {
        uncovered = true;
        continue;
      }
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
  if (uncovered) factoringLog(w).tendersUncovered = (factoringLog(w).tendersUncovered ?? 0) + 1; // windows batch 6
  // With no broker capacity (or none covering what it takes, windows batch 6) the load stays on the open board as NPC spot freight.
  if (eligible.length === 0) {
    if (capped || uncovered) factoringLog(w).tendersToBoard++;
    return;
  }
  const broker = eligible[w.rng.freight.weighted(weights)]!;
  const order = broker.orders.find((o) => o.kind === "broker");
  const margin = clamp(order && order.kind === "broker" ? order.marginPct : 0, 0, 0.9);
  load.brokerId = broker.id;
  // Windows batch 6: what the AI brokers take at the hub, against what they lose (batch 7: all of them together, windows.ts).
  if (aiBroker(w, broker.id)) tally(w, brokerKey(load.origin), "taken");
  load.shipperRate = contractShipperRate;
  load.ceiling = contractShipperRate * (1 - margin);
  load.bookNow = Math.min(load.bookNow, load.ceiling);
  broker.openBrokerLoads++;
  startHold(w, load, broker, margin); // a player's brokerage holds it off the board first, at the margin it was drawn at (brokerage.ts)
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
