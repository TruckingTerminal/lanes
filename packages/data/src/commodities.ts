import type { Equipment } from "@lanes/config";

/**
 * What rides in the trailer (DESIGN-PLACES.md). A commodity brings its equipment, what a
 * load of it is worth, how long the poster gives before the delivery appointment, whether it
 * spoils (and how long past the appointment it survives), how far it typically travels, and
 * its season. Values in FD (≈$) per load; hours in game hours.
 */
export interface Commodity {
  id: CommodityId;
  name: string;
  equipment: Equipment;
  /** Cargo value of a load (claims, theft). */
  valueFd: number;
  /** Hours from posting to the delivery appointment, before transit is added. */
  windowHours: number;
  /** Perishable: hours past the appointment (or after a reefer failure) before the load is a total loss; null never spoils. */
  spoilHours: number | null;
  /** Typical haul: the gravity model's distance scale in miles. */
  reachMi: number;
  season: SeasonKey;
}

export type CommodityId =
  | "produce"
  | "frozen"
  | "dairy"
  | "meat"
  | "beverages"
  | "grocery"
  | "retail"
  | "parcels"
  | "paper"
  | "autoParts"
  | "electronics"
  | "pharma"
  | "furniture"
  | "textiles"
  | "chemicals"
  | "imports"
  | "machinery"
  | "steel"
  | "lumber"
  | "building"
  | "oilfield"
  | "hay"
  | "potatoes"
  | "trees"
  | "feed";

export type SeasonKey = "flat" | "produce" | "retail" | "imports" | "building" | "harvest" | "potatoes" | "trees" | "summer" | "spring";

export const COMMODITIES: readonly Commodity[] = [
  { id: "produce", name: "Fresh produce", equipment: "reefer", valueFd: 40_000, windowHours: 36, spoilHours: 24, reachMi: 1_500, season: "produce" },
  { id: "frozen", name: "Frozen foods", equipment: "reefer", valueFd: 55_000, windowHours: 72, spoilHours: 48, reachMi: 1_200, season: "flat" },
  { id: "dairy", name: "Dairy", equipment: "reefer", valueFd: 35_000, windowHours: 48, spoilHours: 24, reachMi: 600, season: "flat" },
  { id: "meat", name: "Meat and poultry", equipment: "reefer", valueFd: 85_000, windowHours: 48, spoilHours: 36, reachMi: 1_200, season: "flat" },
  { id: "beverages", name: "Beverages", equipment: "van", valueFd: 30_000, windowHours: 96, spoilHours: null, reachMi: 500, season: "summer" },
  { id: "grocery", name: "Packaged groceries", equipment: "van", valueFd: 45_000, windowHours: 96, spoilHours: null, reachMi: 800, season: "flat" },
  { id: "retail", name: "General merchandise", equipment: "van", valueFd: 60_000, windowHours: 120, spoilHours: null, reachMi: 1_000, season: "retail" },
  { id: "parcels", name: "Parcels", equipment: "van", valueFd: 50_000, windowHours: 24, spoilHours: null, reachMi: 900, season: "retail" },
  { id: "paper", name: "Paper and packaging", equipment: "van", valueFd: 25_000, windowHours: 120, spoilHours: null, reachMi: 600, season: "flat" },
  { id: "autoParts", name: "Auto parts", equipment: "van", valueFd: 70_000, windowHours: 36, spoilHours: null, reachMi: 700, season: "flat" },
  { id: "electronics", name: "Electronics", equipment: "van", valueFd: 250_000, windowHours: 72, spoilHours: null, reachMi: 1_500, season: "retail" },
  { id: "pharma", name: "Pharmaceuticals", equipment: "reefer", valueFd: 400_000, windowHours: 48, spoilHours: 48, reachMi: 1_500, season: "flat" },
  { id: "furniture", name: "Furniture", equipment: "van", valueFd: 40_000, windowHours: 120, spoilHours: null, reachMi: 900, season: "flat" },
  { id: "textiles", name: "Textiles and apparel", equipment: "van", valueFd: 30_000, windowHours: 120, spoilHours: null, reachMi: 900, season: "retail" },
  { id: "chemicals", name: "Chemicals and plastics", equipment: "van", valueFd: 60_000, windowHours: 96, spoilHours: null, reachMi: 800, season: "flat" },
  { id: "imports", name: "Import containers", equipment: "van", valueFd: 80_000, windowHours: 72, spoilHours: null, reachMi: 900, season: "imports" },
  { id: "machinery", name: "Machinery", equipment: "flatbed", valueFd: 150_000, windowHours: 120, spoilHours: null, reachMi: 1_000, season: "spring" },
  { id: "steel", name: "Steel", equipment: "flatbed", valueFd: 60_000, windowHours: 96, spoilHours: null, reachMi: 600, season: "flat" },
  { id: "lumber", name: "Lumber", equipment: "flatbed", valueFd: 35_000, windowHours: 96, spoilHours: null, reachMi: 800, season: "building" },
  { id: "building", name: "Building materials", equipment: "flatbed", valueFd: 25_000, windowHours: 72, spoilHours: null, reachMi: 300, season: "building" },
  { id: "oilfield", name: "Oilfield equipment", equipment: "flatbed", valueFd: 120_000, windowHours: 48, spoilHours: null, reachMi: 600, season: "flat" },
  { id: "hay", name: "Hay and feed", equipment: "flatbed", valueFd: 12_000, windowHours: 120, spoilHours: null, reachMi: 400, season: "harvest" },
  { id: "potatoes", name: "Potatoes and onions", equipment: "reefer", valueFd: 25_000, windowHours: 72, spoilHours: 96, reachMi: 1_500, season: "potatoes" },
  { id: "trees", name: "Christmas trees", equipment: "van", valueFd: 30_000, windowHours: 48, spoilHours: 240, reachMi: 1_500, season: "trees" },
  { id: "feed", name: "Grain and feed", equipment: "van", valueFd: 20_000, windowHours: 120, spoilHours: null, reachMi: 500, season: "harvest" },
];

export const COMMODITY_INDEX: Record<CommodityId, number> = Object.fromEntries(COMMODITIES.map((c, i) => [c.id, i])) as Record<CommodityId, number>;
export const commodityById = (id: CommodityId): Commodity => COMMODITIES[COMMODITY_INDEX[id]]!;

/**
 * Monthly volume multipliers (January first), by season. "produce" is regional and comes from
 * economy.ts (a growing region's own months); the national profile here is for the few places
 * without one.
 */
export const SEASON_MONTHS: Record<SeasonKey, readonly number[]> = {
  flat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  produce: [0.8, 0.8, 0.9, 1, 1.1, 1.2, 1.2, 1.2, 1.1, 1, 0.9, 0.8],
  retail: [0.8, 0.8, 0.9, 0.95, 1, 1, 1.05, 1.1, 1.2, 1.3, 1.35, 0.9],
  imports: [0.9, 0.85, 0.95, 1, 1.05, 1.1, 1.2, 1.3, 1.3, 1.2, 0.95, 0.85],
  building: [0.7, 0.75, 1, 1.15, 1.25, 1.25, 1.25, 1.2, 1.15, 1.05, 0.85, 0.7],
  harvest: [0.7, 0.7, 0.7, 0.7, 0.7, 0.8, 1, 1.4, 1.6, 1.6, 1.2, 0.8],
  potatoes: [1.2, 1.2, 1.2, 1.1, 1, 0.5, 0.4, 0.6, 1.3, 1.4, 1.3, 1.2],
  trees: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 4, 0.6],
  summer: [0.8, 0.8, 0.9, 1, 1.2, 1.3, 1.35, 1.3, 1.1, 0.9, 0.8, 0.9],
  spring: [0.9, 1, 1.15, 1.2, 1.15, 1.05, 1, 1, 1, 0.95, 0.85, 0.8],
};
