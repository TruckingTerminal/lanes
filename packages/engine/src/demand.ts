import type { Equipment, FacilityType } from "@lanes/config";
import { HUB_SEASONS } from "@lanes/data";
import { clamp } from "./economics.js";
import type { Facility } from "./types.js";
import type { World } from "./world.js";

export const EQUIPMENT: readonly Equipment[] = ["van", "reefer", "flatbed"];

const seasonCache = new WeakMap<object, WeakMap<object, Float64Array>>();

/** Each hub's weekly relative swing per equipment, from the regional season table (static per network and config). */
function seasonTable(w: World): Float64Array {
  let byCfg = seasonCache.get(w.net);
  if (!byCfg) seasonCache.set(w.net, (byCfg = new WeakMap()));
  let t = byCfg.get(w.cfg);
  if (t) return t;
  const { refRpm, flatbedFromVan } = w.cfg.rates.seasons;
  t = new Float64Array(w.net.hubs.length * EQUIPMENT.length * 52);
  w.net.hubs.forEach((h, i) => {
    const s = HUB_SEASONS[h.id];
    if (!s) return;
    for (let wk = 0; wk < 52; wk++) {
      t![(i * 3 + 0) * 52 + wk] = s.van[wk]! / refRpm.van;
      t![(i * 3 + 1) * 52 + wk] = s.reefer[wk]! / refRpm.reefer;
      t![(i * 3 + 2) * 52 + wk] = (flatbedFromVan * s.van[wk]!) / refRpm.van;
    }
  });
  byCfg.set(w.cfg, t);
  return t;
}

/**
 * A hub's seasonal swing for one equipment type on a given day, relative to that
 * market's yearly average (+0.15 = rates 15% above normal), interpolated between weeks.
 */
export function seasonSwing(w: World, hubIdx: number, eq: Equipment, day: number): number {
  const t = seasonTable(w);
  // Week 0 is the week of Jan 7; 52 weeks are spread over the 365-day year so Dec 31 runs on into Jan 1.
  const D = w.cfg.time.daysPerSeason;
  const pos = (((((day % D) - 6) % D) + D) % D) * (52 / D);
  const i0 = Math.floor(pos);
  const frac = pos - i0;
  const base = (hubIdx * EQUIPMENT.length + EQUIPMENT.indexOf(eq)) * 52;
  const a = t[base + (((i0 % 52) + 52) % 52)]!;
  const b = t[base + ((((i0 + 1) % 52) + 52) % 52)]!;
  return a + (b - a) * frac;
}

/** A hub's season (§Rates — load volume): the regional swing moves freight volume and the posted rate; late December slows down. */
export function seasonality(w: World, hubIdx: number, eq: Equipment, day: number): { volume: number; rate: number } {
  const s = w.cfg.rates.seasons;
  const swing = seasonSwing(w, hubIdx, eq, day);
  let volume = clamp(1 + s.volumeGain * swing, s.volumeClamp[0], s.volumeClamp[1]);
  const rate = clamp(1 + s.rateGain * swing, s.rateClamp[0], s.rateClamp[1]);
  if (day % w.cfg.time.daysPerSeason >= w.cfg.time.daysPerSeason - 14) volume *= s.lateDecVolume;
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
    seasonality(w, hubIdx, eq, day).volume *
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
    seasonality(w, hubIdx, eq, day).volume *
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
