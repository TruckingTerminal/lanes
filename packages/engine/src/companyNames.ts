import { Rng } from "./rng.js";
import { STAFF_FIRST_NAMES as FIRST, STAFF_LAST_NAMES as STAFF_LAST, type World } from "./world.js";

/**
 * Names for the companies the world forms itself (Jeff, 2026-11-03: every carrier and broker has a name, never
 * "Fleet-97"). A name is drawn from the world's seed and the company's id alone, on a stream of its own, so the
 * sim's own dice (the population's hubs, wallets and trucks) draw exactly as before and every client of one world
 * sees the same names. Unique among the companies formed so far. The words are fictional: no national carrier or
 * brokerage is named, and the three brands counsel is to search (Keystone, Meridian, Ironwood) stay out.
 */
export type CompanyNameKind = "oo" | "fleet" | "broker";

/** The drivers' surnames and more, so the owners of the world's companies come from the same towns as its drivers. */
const SURNAMES: readonly string[] = [
  ...STAFF_LAST,
  "Abernathy", "Alvarez", "Baptiste", "Bergstrom", "Calloway", "Castillo", "Delgado", "Donnelly", "Eriksen", "Farrow",
  "Galloway", "Garza", "Gutierrez", "Herrera", "Hollis", "Ibarra", "Jablonski", "Kaminski", "Keller", "Lindqvist",
  "Lozano", "Marchetti", "McAllister", "Mendoza", "Nakamura", "Navarro", "Oyelaran", "Pacheco", "Petrakis", "Quintero",
  "Rasmussen", "Salazar", "Sandoval", "Schreiber", "Sorensen", "Tanaka", "Thibodeaux", "Torres", "Underwood", "Valdez",
  "Villanueva", "Whitaker", "Wojcik", "Yazzie", "Zamora", "Ashworth", "Bellamy", "Cardenas", "Dubois", "Escobar",
  "Fontaine", "Greer", "Hinojosa", "Kessler", "Landry", "Maldonado", "Novak", "Ochoa", "Pruitt", "Rangel",
  "Stroud", "Tillman", "Vega", "Winslow", "Acosta", "Brandt", "Carrillo", "Dominguez", "Esparza", "Fuentes",
  "Guerrero", "Holloway", "Jimenez", "Kirkland", "Luna", "Medina", "Nolasco", "Orellana", "Padilla", "Rojas",
  "Serrano", "Trujillo", "Vasquez", "Whitfield", "Ybarra", "Zepeda", "Barlow", "Coburn", "Decker", "Ellison",
];

/** Country the fleets are named after: ranges, rivers, basins and corners of it. */
const REGIONS: readonly string[] = [
  "High Plains", "Piedmont", "Cascade", "Sierra", "Cumberland", "Blue Ridge", "Gulf Coast", "Tidewater", "Bluegrass",
  "Big Sky", "Red River", "Rio Grande", "Lakeshore", "Delta", "Bayou", "Panhandle", "Front Range", "Wasatch", "Sonoran",
  "Mojave", "Palouse", "Badlands", "Black Hills", "Great Basin", "Ohio Valley", "Four Corners", "Hill Country",
  "Low Country", "Upstate", "Northwoods", "Iron Range", "Flint Hills", "Sandhills", "Big Bend", "Pine Barrens",
  "Shenandoah", "Allegheny", "Platte", "Susquehanna", "Monongahela", "Brazos", "Sabine", "Yellowstone", "Snake River",
  "Columbia Basin", "Central Valley", "Mid-South", "Western Slope", "Southern Tier", "Three Rivers", "Twin Rivers",
  "Great Plains", "Tri-State", "Mid-States", "Prairie", "Timberline", "Driftless", "Thumb", "Bootheel", "Cross Timbers",
];
const ADJECTIVES: readonly string[] = [
  "Blue", "Red", "Black", "White", "Silver", "Gray", "Green", "Golden", "Iron", "Copper", "Granite", "Cedar", "Pine",
  "Oak", "Birch", "Willow", "Cottonwood", "Mesquite", "Sage", "Juniper", "Stone", "North", "South", "East", "West",
  "Twin", "Lone", "High", "Big", "Little", "Old", "Broad", "Clear", "Still", "Deep", "Cold", "Dry",
];
const NOUNS: readonly string[] = [
  "Ridge", "Creek", "Fork", "Hollow", "Bluff", "Mesa", "Pass", "Gap", "Bend", "Run", "Falls", "Point", "Hills", "Rapids",
  "Landing", "Crossing", "Junction", "Mill", "Forge", "Trail", "Summit", "Canyon", "Valley", "Lake", "River",
  "Timber", "Ranch", "Mountain", "Prairie", "Springs", "Grove", "Fields", "Bottoms", "Flats", "Knob", "Notch",
];
/** Words a brokerage names itself after: a bearing, a landmark, a promise. */
const BROKER_WORDS: readonly string[] = [
  "Compass", "Lantern", "Beacon", "Anchor", "Summit", "Ridgeline", "Pinnacle", "Vantage", "Crossroads",
  "Junction", "Milepost", "Gateway", "Landmark", "Cornerstone", "Waypoint", "Northstar", "Horizon", "Frontier",
  "Latitude", "Clearview", "Broadview", "Mainline", "Throughline", "Steadfast", "Granary", "Open Road", "Long Haul",
  "Straightline", "Five Points", "Two Harbors", "Mid-Continent", "Interstate", "Parallel", "Benchmark", "Keel",
  "Ballast", "Tailwind", "Headway", "Foothold", "Bridgeway", "Causeway", "Trestle", "Signal", "Semaphore",
];

const CITY_FLEET: readonly string[] = ["Freight Lines", "Motor Freight", "Cartage", "Truck Lines", "Transport", "Carriers", "Express", "Freightways", "Transportation"];
const FLEET_SUFFIX: readonly string[] = ["Freight", "Transport", "Carriers", "Express", "Trucking", "Freight Lines", "Truck Lines", "Logistics", "Transportation", "Hauling", "Cartage", "Motor Freight"];
const SURNAME_FLEET: readonly string[] = ["Transportation", "Transport", "Truck Lines", "Freight Lines", "& Co. Trucking", "Brothers Transport", "Trucking Inc."];
const BROKER_SUFFIX: readonly string[] = ["Logistics", "Freight Services", "Freight Solutions", "Freight Partners", "Freight Group", "Logistics Group", "Brokerage", "Freight Brokerage", "Freight Management", "Transport Services"];
const CITY_BROKER: readonly string[] = ["Freight Brokers", "Logistics Group", "Freight Services", "Freight Exchange"];

/** A stream for one company: the world's seed and the company's id, mixed; never the sim's own streams. */
function stream(seed: number, id: number, kind: CompanyNameKind): Rng {
  let h = (2166136261 ^ (seed >>> 0)) >>> 0;
  const label = `company:${kind}:${id}`;
  for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 16777619) >>> 0;
  return new Rng(h);
}

function ooName(rng: Rng): string {
  const last = rng.pick(SURNAMES);
  const first = rng.pick(FIRST);
  const forms: readonly (() => string)[] = [
    () => `${last} Trucking`,
    () => `${first[0]}. ${last} Trucking`,
    () => `${first} ${last} Transport`,
    () => `${last} Hauling`,
    () => `${last} & Sons Trucking`,
    () => `${last} Bros. Trucking`,
    () => `${last} Freight`,
    () => `${last} Family Trucking`,
    () => `${first} ${last} Trucking`,
  ];
  const name = forms[rng.weighted([30, 15, 12, 10, 8, 8, 7, 5, 5])]!();
  return rng.next() < 0.25 ? `${name} LLC` : name;
}

function fleetName(rng: Rng, city: string): string {
  const form = rng.weighted([city ? 30 : 0, 35, 20, 15]);
  const name =
    form === 0 ? `${city} ${rng.pick(CITY_FLEET)}`
    : form === 1 ? `${rng.pick(ADJECTIVES)} ${rng.pick(NOUNS)} ${rng.pick(FLEET_SUFFIX)}`
    : form === 2 ? `${rng.pick(REGIONS)} ${rng.pick(FLEET_SUFFIX)}`
    : `${rng.pick(SURNAMES)} ${rng.pick(SURNAME_FLEET)}`;
  return form !== 3 && rng.next() < 0.15 ? `${name} Inc.` : name;
}

function brokerName(rng: Rng, city: string): string {
  const form = rng.weighted([35, 15, 25, 15, city ? 10 : 0]);
  if (form === 1) {
    const a = rng.pick(SURNAMES);
    let b = rng.pick(SURNAMES);
    while (b === a) b = rng.pick(SURNAMES);
    return `${a} & ${b} Freight`;
  }
  const name =
    form === 0 ? `${rng.pick(SURNAMES)} Logistics`
    : form === 2 ? `${rng.pick(BROKER_WORDS)} ${rng.pick(BROKER_SUFFIX)}`
    : form === 3 ? `${rng.pick(REGIONS)} ${rng.pick(BROKER_SUFFIX)}`
    : `${city} ${rng.pick(CITY_BROKER)}`;
  return rng.next() < 0.15 ? `${name} LLC` : name;
}

/**
 * The name for the company the world is about to form (its id is the next one, as formCompany gives it), of this kind,
 * based at this hub. Unique among the names in use; the same for the same world, seed and id, whatever else has been drawn.
 */
export function companyName(w: World, kind: CompanyNameKind, homeHubId: string): string {
  const id = w.companies.length + 1;
  const rng = stream(w.seed, id, kind);
  const city = w.net.hubs.find((h: { id: string }) => h.id === homeHubId)?.name ?? "";
  const used = new Set<string>();
  for (const c of w.companies) used.add(c.name);
  let name = "";
  for (let tries = 0; tries < 60; tries++) {
    name = kind === "oo" ? ooName(rng) : kind === "fleet" ? fleetName(rng, city) : brokerName(rng, city);
    if (!used.has(name)) return name;
  }
  // Sixty collisions in a row can't happen with these lists; the id keeps the name unique if it ever did.
  return `${name} ${id}`;
}
