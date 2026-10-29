import type { Equipment } from "@lanes/config";
import { COMMODITIES, COMMODITY_INDEX, SEASON_MONTHS, type CommodityId } from "./commodities.js";
import { BASE_PRODUCTION, CONSUMPTION_PER_100K, PLACE_PRODUCTION, PRODUCE_SEASON_OF_STATE, PRODUCE_SEASONS, STATE_CONSUMPTION, STATE_PRODUCTION } from "./economy.js";
import { PLACE_ROWS } from "./places.js";

/** A place: a town or metro under one of the 60 markets (DESIGN-PLACES.md). */
export interface Place {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  pop: number;
  /** The hub whose board this place's freight trades on. */
  market: number;
  /** Where the place joins the road network (the nearest road that actually goes somewhere). */
  atLat: number;
  atLon: number;
}

/** Farm, ranch, mine and forest output doesn't scale with a town's size; factories and warehouses do. */
const LAND_BASED = new Set<CommodityId>(["produce", "dairy", "meat", "hay", "potatoes", "trees", "feed", "oilfield", "lumber"]);

export interface Economy {
  places: Place[];
  /** Relative production of commodity c at place p: production[p * C + c]. */
  production: Float64Array;
  /** Relative consumption, same layout. */
  consumption: Float64Array;
  /** Place indices under each market, biggest first. */
  byMarket: number[][];
  /** Per market and commodity, the sum of its places' production: marketProduction[m * C + c]. */
  marketProduction: Float64Array;
}

export const COMMODITY_COUNT = COMMODITIES.length;

export function loadPlaces(): Place[] {
  return PLACE_ROWS.map((r) => ({ id: r[0], name: r[1], state: r[2], lat: r[3], lon: r[4], pop: r[5], market: r[6], atLat: r[7], atLon: r[8] }));
}

/** Builds who-makes-what and who-buys-what from the tables in economy.ts. */
export function buildEconomy(places: Place[], marketCount: number): Economy {
  const C = COMMODITY_COUNT;
  const P = places.length;
  const production = new Float64Array(P * C);
  const consumption = new Float64Array(P * C);
  const byMarket: number[][] = Array.from({ length: marketCount }, () => []);
  const marketProduction = new Float64Array(marketCount * C);
  for (let p = 0; p < P; p++) {
    const place = places[p]!;
    // Factories and warehouses go with people: a town of 5,000 ships a twentieth of what a city of 100,000 does
    // (the land-based goods below don't scale, which is what puts freight at a town of 1,200 in Montana).
    const size = Math.max(place.pop, 1_000) / 100_000;
    const state = STATE_PRODUCTION[place.state] ?? {};
    const extra = PLACE_PRODUCTION[place.id] ?? {};
    const stateCons = STATE_CONSUMPTION[place.state] ?? {};
    for (let c = 0; c < C; c++) {
      const id = COMMODITIES[c]!.id;
      const land = LAND_BASED.has(id);
      const base = (BASE_PRODUCTION[id] ?? 0) * size + (state[id] ?? 0) * (land ? 1 : size) + (extra[id] ?? 0) * (land ? 1 : Math.max(size, 0.5));
      production[p * C + c] = base;
      consumption[p * C + c] = (CONSUMPTION_PER_100K[id] ?? 0) * (place.pop / 100_000) + (stateCons[id] ?? 0) * size;
      marketProduction[place.market * C + c] = (marketProduction[place.market * C + c] ?? 0) + base;
    }
    byMarket[place.market]!.push(p);
  }
  for (const list of byMarket) list.sort((a, b) => places[b]!.pop - places[a]!.pop || a - b);
  return { places, production, consumption, byMarket, marketProduction };
}

/** This month's volume multiplier for a commodity shipped from a place (produce follows its region's calendar). */
export function seasonMult(c: number, place: Place, month: number): number {
  const k = COMMODITIES[c]!;
  if (k.id === "produce") {
    const region = PRODUCE_SEASON_OF_STATE[place.state];
    if (region) return PRODUCE_SEASONS[region]![month]!;
  }
  return SEASON_MONTHS[k.season][month]!;
}

/** Commodities that ride in this trailer type. */
export const commoditiesFor = (eq: Equipment): number[] => COMMODITIES.flatMap((k, i) => (k.equipment === eq ? [i] : []));

/**
 * Weights for drawing what ships from a market this month, for one trailer type:
 * each commodity's production over the market's places times its season there.
 */
export function marketMix(eco: Economy, market: number, eq: Equipment, month: number): { commodity: number; weight: number }[] {
  const out: { commodity: number; weight: number }[] = [];
  for (const c of commoditiesFor(eq)) {
    let w = 0;
    for (const p of eco.byMarket[market] ?? []) w += eco.production[p * COMMODITY_COUNT + c]! * seasonMult(c, eco.places[p]!, month);
    if (w > 0) out.push({ commodity: c, weight: w });
  }
  return out;
}

/** Weights over a market's places for shipping commodity c this month. */
export function originWeights(eco: Economy, market: number, c: number, month: number): { place: number; weight: number }[] {
  return (eco.byMarket[market] ?? []).map((p) => ({ place: p, weight: eco.production[p * COMMODITY_COUNT + c]! * seasonMult(c, eco.places[p]!, month) })).filter((x) => x.weight > 0);
}

/** Weights over a market's places for receiving commodity c (population and industry). */
export function destWeights(eco: Economy, market: number, c: number): { place: number; weight: number }[] {
  return (eco.byMarket[market] ?? []).map((p) => ({ place: p, weight: eco.consumption[p * COMMODITY_COUNT + c]! })).filter((x) => x.weight > 0);
}

export { COMMODITIES, COMMODITY_INDEX };
