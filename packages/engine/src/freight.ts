import type { EconomyConfig, Equipment } from "@lanes/config";
import { dexp, dpow, type Lane, type Network } from "@lanes/data";
import { dayOf } from "./clock.js";
import { EQUIPMENT, planFreight, planIndex, seasonality } from "./demand.js";
import type { VettingTier } from "./types.js";
import { clamp, fscPerMile, fuelPrice } from "./economics.js";
import type { Company, Load } from "./types.js";
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

  const refRate = (lane: Lane, eq: Equipment) =>
    lane.baseRate *
      dpow(ratioEq[planIndex(lane.origin, EQUIPMENT.indexOf(eq))]!, cfg.rates.ratioExponent) *
      feeds.weather(net.hubs[lane.origin]!.id, day) *
      cfg.rates.equipmentPremium[eq] *
      seasonality(w, lane.origin, eq, day).rate *
      reloadFactor(w, lane.dest, eq) +
    fsc;

  const newLoad = (lane: Lane, eq: Equipment, ref: number): Load => {
    const ceiling = ref * cfg.rates.npcCeilingMarkup;
    return {
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
    };
  };

  // Hot loads (safety.ts): long hauls with a window only falsified logs or a team can make, at a premium.
  const hl = cfg.safety.hotLoads;
  const hotOdds = (eq: Equipment) => (hl.share * hl.equipmentShare[eq]) / cfg.freight.equipmentShare[eq];
  const makeHot = (load: Load) => {
    if (load.miles < hl.minMiles || rng.next() >= hotOdds(load.equipment)) return;
    load.hot = rng.range(hl.premium[0], hl.premium[1]);
    load.ceiling *= load.hot;
    load.shipperRate = load.ceiling;
    load.spotShipperRate = load.ceiling;
  };
  /** What the goods are worth, and who the poster lets haul them. */
  const finish = (load: Load, vet: VettingTier) => {
    const m = cfg.fraud.cargoMultiple;
    const bill = load.refRate * (load.hot || 1) * load.miles;
    load.cargoValue = load.facilityId !== null ? load.saleValue : bill * (load.brokerId !== null ? m[load.equipment] : m.npcDirect) * (load.hot ? m.hot : 1);
    load.vet = (load.hot > 0 ? Math.max(1, vet) : vet) as VettingTier;
  };

  // 3. NPC loads, half of them tendered to brokers.
  const brokers = w.companies.filter((c) => c.role === "broker");
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
        if (rng.next() < cfg.freight.npcBrokerOnlyShare) {
          const contractRef = lane.baseRate * w.contractIndex[planIndex(i, e)]! * cfg.rates.equipmentPremium[eq] * reloadFactor(w, lane.dest, eq) + fsc;
          tenderToBroker(w, load, brokers, contractRef * cfg.rates.npcCeilingMarkup * (load.hot || 1));
        }
        finish(load, load.brokerId !== null ? w.companies[load.brokerId - 1]!.vetting : 0);
        w.loads.set(load.id, load);
        created.push(load);
      }
    }
  }

  // 4. Facility loads: posted by their owner to the open board.
  let facilityLoads = 0;
  w.facilities.forEach((f, k) => {
    const lanes = net.lanesFrom[f.hub]!;
    if (lanes.length === 0 || f.ownerId === 0) return;
    const weights = destWeights(cfg, net, f.hub, f.equipment);
    for (let c = 0; c < facilityCounts[k]!; c++) {
      const lane = lanes[rng.weighted(weights)]!;
      const ref = refRate(lane, f.equipment);
      const load = newLoad(lane, f.equipment, ref);
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
function tenderToBroker(w: World, load: Load, brokers: Company[], contractShipperRate: number): void {
  const eligible: Company[] = [];
  const weights: number[] = [];
  for (const b of brokers) {
    const order = b.orders.find((o) => o.kind === "broker");
    if (order && order.kind === "broker" && b.openBrokerLoads < order.maxOpenLoads) {
      eligible.push(b);
      // Shippers favor reputable brokers that take a thinner cut.
      weights.push((0.25 + b.reputation) / dpow(Math.max(0.01, order.marginPct), 2));
    }
  }
  // With no broker capacity the load stays on the open board as NPC spot freight.
  if (eligible.length === 0) return;
  const broker = eligible[w.rng.freight.weighted(weights)]!;
  const order = broker.orders.find((o) => o.kind === "broker");
  const margin = clamp(order && order.kind === "broker" ? order.marginPct : 0, 0, 0.9);
  load.brokerId = broker.id;
  load.shipperRate = contractShipperRate;
  load.ceiling = contractShipperRate * (1 - margin);
  broker.openBrokerLoads++;
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
 * Empty miles a truck of this type can expect to run to reload after delivering
 * at a hub. Looking `aheadDays` out, the reload odds move with the hub's season:
 * a market about to boom reloads easier than it does today.
 */
export function expectedReloadDeadheadMi(w: World, destHub: number, eq: Equipment, aheadDays = 0): number {
  const { reloadDeadheadMi, reloadDeadheadClamp } = w.cfg.board;
  let odds = reloadOdds(w, destHub, eq);
  if (aheadDays > 0) {
    const day = dayOf(w.t, w.cfg);
    odds *= seasonality(w, destHub, eq, day + aheadDays).volume / Math.max(0.01, seasonality(w, destHub, eq, day).volume);
  }
  return clamp(reloadDeadheadMi / Math.max(0.01, odds), reloadDeadheadClamp[0], reloadDeadheadClamp[1]);
}
