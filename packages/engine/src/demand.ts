import type { EconomyConfig, Equipment, FacilityType } from "@lanes/config";
import { monthOf } from "./clock.js";
import { clamp } from "./economics.js";
import type { Facility } from "./types.js";
import type { World } from "./world.js";

export const EQUIPMENT: readonly Equipment[] = ["van", "reefer", "flatbed"];

/** season(t) from the in-game calendar (§Rates — load volume). */
export function seasonality(cfg: EconomyConfig, day: number, eq: Equipment): { volume: number; rate: number } {
  const s = cfg.rates.seasonality;
  const month = monthOf(day, cfg);
  const dayOfSeason = day % cfg.time.daysPerSeason;
  let volume = 1;
  let rate = 1;
  if (eq === "reefer" && month >= 2 && month <= 6) volume *= s.reeferMarToJul;
  if (eq === "van" && month >= 7 && month <= 10) volume *= s.vanAugToNov;
  if (dayOfSeason >= cfg.time.daysPerSeason - 14) {
    volume *= s.lateDecVolume;
    rate *= s.lateDecRate;
  }
  return { volume, rate };
}

function sectorFactor(w: World, hubIdx: number, day: number): number {
  const { cfg } = w;
  return clamp(w.feeds.sector(w.net.hubs[hubIdx]!.id, day), cfg.rates.sectorClamp[0], cfg.rates.sectorClamp[1]);
}

/**
 * A hub's total freight demand per round for one equipment type, NPC and player
 * shippers together (§Rates — load volume):
 *   base(hub,eq) × season(t) × sector(hub) × imbalance(hub,eq) × weather × cycle
 * times the stabilizer's volume dial and, in token mode, the player-base scale.
 */
export function hubDemandPerRound(w: World, hubIdx: number, eq: Equipment, day: number): number {
  const { cfg, net, feeds } = w;
  const hub = net.hubs[hubIdx]!;
  const totalWeight = totalHubWeight(w);
  return (
    ((cfg.freight.baseLoadsPerRound * hub.weight) / totalWeight) *
    cfg.freight.equipmentShare[eq] *
    seasonality(cfg, day, eq).volume *
    sectorFactor(w, hubIdx, day) *
    hub.imbalance[eq] *
    feeds.weather(hub.id, day) *
    feeds.cycle(day) *
    w.stab.volumeMult *
    w.demandScale
  );
}

const weightCache = new WeakMap<object, number>();
function totalHubWeight(w: World): number {
  let total = weightCache.get(w.net);
  if (total === undefined) weightCache.set(w.net, (total = w.net.hubs.reduce((s, h) => s + h.weight, 0)));
  return total;
}

/** What a facility would ship per round on its own, before the hub's player-share cap. */
export function facilityNominalOutput(w: World, type: FacilityType, hubIdx: number, eq: Equipment, day: number): number {
  const hub = w.net.hubs[hubIdx]!;
  return (
    w.cfg.facilities.types[type].loadsPerRound *
    seasonality(w.cfg, day, eq).volume *
    sectorFactor(w, hubIdx, day) *
    w.feeds.weather(hub.id, day) *
    w.feeds.cycle(day)
  );
}

/** Factories ship what their hub makes: flatbed for industry and energy, reefer for food, van otherwise. */
export function facilityEquipment(w: World, type: FacilityType, hubIdx: number): Equipment {
  const eq = w.cfg.facilities.types[type].equipment;
  if (eq !== "bySector") return eq;
  const sectors = Object.entries(w.net.hubs[hubIdx]!.sectorWeights).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const top = sectors[0]?.[0];
  if (top === "industrial" || top === "energy") return "flatbed";
  if (top === "food") return "reefer";
  return "van";
}

export interface FreightPlan {
  /** Expected NPC loads per (hub, equipment), after player facilities take their share. */
  npcExpected: Float64Array;
  /** Expected loads per facility (index = position in w.facilities). */
  facilityExpected: Float64Array;
}

export const planIndex = (hubIdx: number, e: number) => hubIdx * EQUIPMENT.length + e;

/**
 * Splits each hub's demand between NPC shippers and player facilities. Facilities
 * take their output out of the hub's demand, up to 60% of it; past that, every
 * facility at that hub and equipment is scaled down together, so crowding a hub
 * has diminishing returns (§Load board — NPC share falls from 70% toward 40%).
 */
export function planFreight(w: World, day: number): FreightPlan {
  const n = w.net.hubs.length;
  const nominal = new Float64Array(w.facilities.length);
  const facilityTotal = new Float64Array(n * EQUIPMENT.length);
  w.facilities.forEach((f, k) => {
    nominal[k] = f.ownerId === 0 ? 0 : facilityNominalOutput(w, f.type, f.hub, f.equipment, day);
    facilityTotal[planIndex(f.hub, EQUIPMENT.indexOf(f.equipment))]! += nominal[k]!;
  });
  const npcExpected = new Float64Array(n * EQUIPMENT.length);
  const scale = new Float64Array(n * EQUIPMENT.length).fill(1);
  for (let i = 0; i < n; i++) {
    for (let e = 0; e < EQUIPMENT.length; e++) {
      const k = planIndex(i, e);
      const demand = hubDemandPerRound(w, i, EQUIPMENT[e]!, day);
      const cap = w.cfg.facilities.maxPlayerShareOfHub * demand;
      const player = Math.min(facilityTotal[k]!, cap);
      if (facilityTotal[k]! > cap) scale[k] = cap / facilityTotal[k]!;
      npcExpected[k] = demand - player;
    }
  }
  const facilityExpected = new Float64Array(w.facilities.length);
  w.facilities.forEach((f, k) => {
    facilityExpected[k] = nominal[k]! * scale[planIndex(f.hub, EQUIPMENT.indexOf(f.equipment))]!;
  });
  return { npcExpected, facilityExpected };
}

/** What a new facility of this type would ship per round at this hub today, given the facilities already there. */
export function facilityOutlook(w: World, type: FacilityType, hubIdx: number, day: number): { equipment: Equipment; loadsPerRound: number } {
  const equipment = facilityEquipment(w, type, hubIdx);
  const nominal = facilityNominalOutput(w, type, hubIdx, equipment, day);
  const cap = w.cfg.facilities.maxPlayerShareOfHub * hubDemandPerRound(w, hubIdx, equipment, day);
  let existing = 0;
  for (const f of w.facilities) {
    if (f.ownerId !== 0 && f.hub === hubIdx && f.equipment === equipment) existing += facilityNominalOutput(w, f.type, f.hub, f.equipment, day);
  }
  const total = existing + nominal;
  return { equipment, loadsPerRound: total <= cap ? nominal : (nominal * cap) / total };
}

export function facilitiesOf(w: World, companyId: number): Facility[] {
  return w.facilities.filter((f) => f.ownerId === companyId);
}
