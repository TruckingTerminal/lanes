import type { Equipment } from "@lanes/config";

export type Sector = "retail" | "food" | "industrial" | "energy" | "auto" | "import";

export interface Hub {
  id: string;
  name: string;
  lat: number;
  lon: number;
  isStarter: boolean;
  /** Relative freight size; drives NPC load volume and destination choice. */
  weight: number;
  /** Outbound/inbound strength per equipment type (§World — lane imbalance). 1 = balanced. */
  imbalance: Record<Equipment, number>;
  sectorWeights: Partial<Record<Sector, number>>;
}

type Row = [
  id: string,
  name: string,
  lat: number,
  lon: number,
  weight: number,
  van: number,
  reefer: number,
  flatbed: number,
  sectors: Partial<Record<Sector, number>>,
];

// The 10 starter hubs come first (§World — 10 starter hubs).
const STARTERS: Row[] = [
  ["DAL", "Dallas", 32.78, -96.8, 2.6, 1.1, 0.9, 1.1, { retail: 0.4, industrial: 0.3, energy: 0.3 }],
  ["HOU", "Houston", 29.76, -95.37, 2.4, 1.0, 0.8, 1.4, { energy: 0.5, import: 0.3, industrial: 0.2 }],
  ["ATL", "Atlanta", 33.75, -84.39, 2.5, 1.0, 0.9, 0.9, { retail: 0.6, food: 0.2, import: 0.2 }],
  ["CHI", "Chicago", 41.88, -87.63, 3.0, 1.2, 1.0, 1.1, { retail: 0.4, industrial: 0.4, food: 0.2 }],
  ["LAX", "Los Angeles", 34.05, -118.24, 3.0, 1.5, 1.1, 0.7, { import: 0.6, retail: 0.3, food: 0.1 }],
  ["EWR", "Newark", 40.74, -74.17, 2.4, 1.0, 0.8, 0.7, { import: 0.5, retail: 0.5 }],
  ["MEM", "Memphis", 35.15, -90.05, 1.8, 1.2, 0.9, 0.9, { retail: 0.7, industrial: 0.3 }],
  ["CMH", "Columbus", 39.96, -83.0, 1.6, 1.2, 0.9, 0.9, { retail: 0.6, auto: 0.2, industrial: 0.2 }],
  ["PHX", "Phoenix", 33.45, -112.07, 1.6, 0.7, 0.8, 0.8, { retail: 0.7, industrial: 0.3 }],
  ["MIA", "Miami", 25.76, -80.19, 1.6, 0.55, 0.9, 0.5, { import: 0.4, food: 0.4, retail: 0.2 }],
];

const OTHERS: Row[] = [
  ["LRD", "Laredo", 27.53, -99.49, 1.6, 1.4, 1.1, 1.4, { import: 0.6, auto: 0.3, industrial: 0.1 }],
  ["ELP", "El Paso", 31.76, -106.49, 1.0, 1.2, 0.8, 1.1, { import: 0.5, industrial: 0.5 }],
  ["SAT", "San Antonio", 29.42, -98.49, 1.1, 0.9, 0.9, 1.0, { retail: 0.4, auto: 0.3, energy: 0.3 }],
  ["OKC", "Oklahoma City", 35.47, -97.52, 0.8, 0.9, 0.8, 1.3, { energy: 0.6, industrial: 0.4 }],
  ["MKC", "Kansas City", 39.1, -94.58, 1.4, 1.1, 1.0, 1.0, { retail: 0.4, food: 0.3, industrial: 0.3 }],
  ["STL", "St. Louis", 38.63, -90.2, 1.3, 1.0, 0.9, 1.0, { industrial: 0.4, retail: 0.4, food: 0.2 }],
  ["IND", "Indianapolis", 39.77, -86.16, 1.5, 1.2, 0.9, 1.0, { retail: 0.6, auto: 0.2, industrial: 0.2 }],
  ["SDF", "Louisville", 38.25, -85.76, 1.1, 1.1, 0.9, 1.0, { retail: 0.4, auto: 0.4, industrial: 0.2 }],
  ["BNA", "Nashville", 36.16, -86.78, 1.3, 1.0, 0.9, 1.0, { retail: 0.5, auto: 0.3, industrial: 0.2 }],
  ["BHM", "Birmingham", 33.52, -86.8, 0.9, 0.9, 0.8, 1.3, { industrial: 0.6, auto: 0.4 }],
  ["JAX", "Jacksonville", 30.33, -81.66, 1.1, 0.7, 0.8, 0.7, { import: 0.5, retail: 0.5 }],
  ["MCO", "Orlando", 28.54, -81.38, 1.2, 0.55, 0.9, 0.5, { retail: 0.6, food: 0.4 }],
  ["TPA", "Tampa", 27.95, -82.46, 1.0, 0.6, 1.0, 0.6, { food: 0.5, retail: 0.5 }],
  ["SAV", "Savannah", 32.08, -81.09, 1.3, 1.3, 0.9, 0.9, { import: 0.8, retail: 0.2 }],
  ["CLT", "Charlotte", 35.23, -80.84, 1.3, 1.0, 0.9, 1.0, { retail: 0.5, industrial: 0.5 }],
  ["RDU", "Raleigh", 35.78, -78.64, 0.8, 0.9, 1.0, 0.9, { food: 0.4, retail: 0.4, industrial: 0.2 }],
  ["RIC", "Richmond", 37.54, -77.44, 0.8, 0.9, 0.8, 0.9, { retail: 0.5, industrial: 0.5 }],
  ["BWI", "Baltimore", 39.29, -76.61, 1.2, 1.0, 0.8, 0.9, { import: 0.5, retail: 0.5 }],
  ["PHL", "Philadelphia", 39.95, -75.17, 1.5, 1.0, 0.9, 0.8, { retail: 0.5, food: 0.3, import: 0.2 }],
  ["MDT", "Harrisburg", 40.27, -76.88, 1.2, 1.3, 1.0, 0.9, { retail: 0.8, food: 0.2 }],
  ["ABE", "Allentown", 40.6, -75.49, 1.2, 1.3, 0.9, 0.8, { retail: 0.9, food: 0.1 }],
  ["BOS", "Boston", 42.36, -71.06, 1.3, 0.6, 0.8, 0.6, { retail: 0.7, food: 0.3 }],
  ["ALB", "Albany", 42.65, -73.75, 0.6, 0.8, 0.8, 0.8, { retail: 0.5, industrial: 0.5 }],
  ["BUF", "Buffalo", 42.89, -78.88, 0.7, 0.9, 0.8, 1.1, { industrial: 0.6, auto: 0.4 }],
  ["PIT", "Pittsburgh", 40.44, -79.99, 0.9, 0.9, 0.8, 1.3, { industrial: 0.7, energy: 0.3 }],
  ["CLE", "Cleveland", 41.5, -81.69, 1.0, 1.0, 0.8, 1.2, { industrial: 0.6, auto: 0.4 }],
  ["DTW", "Detroit", 42.33, -83.05, 1.5, 1.1, 0.8, 1.3, { auto: 0.8, industrial: 0.2 }],
  ["CVG", "Cincinnati", 39.1, -84.51, 1.2, 1.1, 0.9, 1.0, { retail: 0.5, industrial: 0.3, auto: 0.2 }],
  ["MKE", "Milwaukee", 43.04, -87.91, 0.9, 1.0, 1.1, 1.1, { industrial: 0.5, food: 0.5 }],
  ["MSP", "Minneapolis", 44.98, -93.27, 1.3, 0.9, 1.1, 0.9, { food: 0.5, retail: 0.5 }],
  ["DSM", "Des Moines", 41.59, -93.62, 0.7, 1.0, 1.3, 1.0, { food: 0.8, industrial: 0.2 }],
  ["OMA", "Omaha", 41.26, -95.93, 0.8, 1.0, 1.3, 1.0, { food: 0.8, industrial: 0.2 }],
  ["DEN", "Denver", 39.74, -104.99, 1.4, 0.7, 0.8, 0.9, { retail: 0.6, energy: 0.4 }],
  ["SLC", "Salt Lake City", 40.76, -111.89, 1.0, 1.0, 0.9, 1.0, { retail: 0.6, industrial: 0.4 }],
  ["ABQ", "Albuquerque", 35.08, -106.65, 0.6, 0.8, 0.8, 0.9, { retail: 0.6, energy: 0.4 }],
  ["LAS", "Las Vegas", 36.17, -115.14, 0.9, 0.5, 0.7, 0.6, { retail: 1.0 }],
  ["ONT", "Ontario", 34.06, -117.65, 2.0, 1.4, 1.0, 0.8, { import: 0.6, retail: 0.4 }],
  ["FAT", "Fresno", 36.74, -119.79, 1.0, 0.9, 1.6, 0.9, { food: 0.9, industrial: 0.1 }],
  ["SCK", "Stockton", 37.96, -121.29, 1.0, 1.1, 1.5, 0.9, { food: 0.6, retail: 0.4 }],
  ["OAK", "Oakland", 37.8, -122.27, 1.3, 1.1, 1.0, 0.8, { import: 0.6, retail: 0.4 }],
  ["PDX", "Portland", 45.52, -122.68, 1.1, 0.9, 1.0, 1.1, { retail: 0.4, industrial: 0.4, food: 0.2 }],
  ["SEA", "Seattle", 47.61, -122.33, 1.4, 0.9, 1.0, 0.9, { import: 0.5, retail: 0.5 }],
  ["BOI", "Boise", 43.62, -116.2, 0.6, 0.8, 1.2, 0.9, { food: 0.8, retail: 0.2 }],
  ["RNO", "Reno", 39.53, -119.81, 0.8, 1.1, 0.8, 0.9, { retail: 0.8, industrial: 0.2 }],
  ["LIT", "Little Rock", 34.75, -92.29, 0.7, 1.0, 0.9, 1.0, { retail: 0.5, industrial: 0.5 }],
  ["MSY", "New Orleans", 29.95, -90.07, 1.0, 0.9, 0.9, 1.2, { energy: 0.5, import: 0.5 }],
  ["TYS", "Knoxville", 35.96, -83.92, 0.7, 1.0, 0.8, 1.0, { retail: 0.5, industrial: 0.5 }],
  ["FAR", "Fargo", 46.88, -96.79, 0.5, 0.8, 1.1, 1.0, { food: 0.7, industrial: 0.3 }],
  ["ICT", "Wichita", 37.69, -97.34, 0.6, 0.9, 1.0, 1.2, { industrial: 0.6, food: 0.4 }],
  ["AMA", "Amarillo", 35.22, -101.83, 0.6, 0.9, 1.3, 1.0, { food: 0.7, energy: 0.3 }],
];

function toHub([id, name, lat, lon, weight, van, reefer, flatbed, sectors]: Row, isStarter: boolean): Hub {
  return { id, name, lat, lon, isStarter, weight, imbalance: { van, reefer, flatbed }, sectorWeights: sectors };
}

export const hubs: Hub[] = [...STARTERS.map((r) => toHub(r, true)), ...OTHERS.map((r) => toHub(r, false))];
