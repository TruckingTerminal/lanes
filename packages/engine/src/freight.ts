import type { EconomyConfig, Equipment } from "@lanes/config";
import { dexp, dpow, type Lane, type Network } from "@lanes/data";
import { dayOf } from "./clock.js";
import { EQUIPMENT, planFreight, planIndex, seasonality } from "./demand.js";
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
  const npcCounts = new Int32Array(n * EQUIPMENT.length);
  const loadsAtHub = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let e = 0; e < EQUIPMENT.length; e++) {
      const k = planIndex(i, e);
      npcCounts[k] = rng.count(plan.npcExpected[k]!);
      loadsAtHub[i]! += npcCounts[k]!;
    }
  }
  const facilityCounts = w.facilities.map((f, k) => {
    const c = rng.count(plan.facilityExpected[k]!);
    loadsAtHub[f.hub]! += c;
    return c;
  });
  for (const load of w.loads.values()) if (load.status === "open") loadsAtHub[load.origin]!++;

  // 2. Load-to-truck ratio within the nearby radius. Idle trucks that were priced
  // out this round don't count as capacity: they won't haul at these rates, and
  // counting them would push rates lower still.
  const trucksAtHub = new Float64Array(n);
  for (let i = 0; i < n; i++) trucksAtHub[i] = cfg.npc.trucksPerHubWeight * net.hubs[i]!.weight;
  for (const truck of w.trucks) if (truck.status === "idle" && truck.pricedOutRound !== w.round) trucksAtHub[truck.hub]!++;
  const ratio = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let loads = 0;
    let trucks = 0;
    for (const j of net.nearby[i]!) {
      loads += loadsAtHub[j]!;
      trucks += trucksAtHub[j]!;
    }
    ratio[i] = clamp(loads / Math.max(1, trucks), cfg.rates.ratioClamp[0], cfg.rates.ratioClamp[1]);
  }
  w.lastRatio = ratio;

  // Contract rates trail the spot market: smooth each hub's spot rate level over the contract lag.
  const alpha = 1 / (cfg.brokerRisk.contractLagDays * cfg.time.boardRoundHours.length);
  for (let i = 0; i < n; i++) {
    for (let e = 0; e < EQUIPMENT.length; e++) {
      const eq = EQUIPMENT[e]!;
      const spot = dpow(ratio[i]!, cfg.rates.ratioExponent) * feeds.weather(net.hubs[i]!.id, day) * seasonality(cfg, day, eq).rate;
      const k = planIndex(i, e);
      // The first round's contracts are signed at the market as it stands.
      w.contractIndex[k] = Number.isNaN(w.contractIndex[k]!) ? spot : w.contractIndex[k]! + alpha * (spot - w.contractIndex[k]!);
    }
  }

  const refRate = (lane: Lane, eq: Equipment) =>
    lane.baseRate *
      dpow(ratio[lane.origin]!, cfg.rates.ratioExponent) *
      feeds.weather(net.hubs[lane.origin]!.id, day) *
      cfg.rates.equipmentPremium[eq] *
      seasonality(cfg, day, eq).rate +
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
    };
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
        if (rng.next() < cfg.freight.npcBrokerOnlyShare) {
          const contractRef = lane.baseRate * w.contractIndex[planIndex(i, e)]! * cfg.rates.equipmentPremium[eq] + fsc;
          tenderToBroker(w, load, brokers, contractRef * cfg.rates.npcCeilingMarkup);
        }
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
  const margin = order && order.kind === "broker" ? order.marginPct : 0;
  load.brokerId = broker.id;
  load.shipperRate = contractShipperRate;
  load.ceiling = contractShipperRate * (1 - margin);
  broker.openBrokerLoads++;
}
