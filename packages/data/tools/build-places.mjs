// Builds packages/data/src/places.ts from Natural Earth's 10m populated places (public domain):
// every lower-48 place over 50,000 people (suburbs within 20 miles of a bigger place folded in),
// every state capital, every hub, and then a coverage pass over a one-degree grid that adds the
// largest remaining place in any cell without one — the rural anchors. Each place gets the
// nearest hub as its market.
//
//   node packages/data/tools/build-places.mjs <ne_10m_populated_places_simple.dbf> <repo root>
import { readFileSync, writeFileSync } from "node:fs";
import { readDbf } from "./shp.mjs";

const [dbfPath, repo = "."] = process.argv.slice(2);
if (!dbfPath) throw new Error("usage: build-places.mjs <places.dbf> [repo]");

const BIG = 50_000;
const FOLD_MI = 20; // a place this close to a bigger one is its suburb
const ANCHOR_MIN = 1_000; // the smallest town that can anchor an empty grid cell
const GRID = 1; // degrees
const EXCLUDE = new Set(["Alaska", "Hawaii", "Puerto Rico", "Guam", "American Samoa", "Northern Mariana Islands", "United States Virgin Islands"]);

const RAD = Math.PI / 180;
const mi = (a, b) => {
  const sLat = Math.sin(((b.lat - a.lat) * RAD) / 2);
  const sLon = Math.sin(((b.lon - a.lon) * RAD) / 2);
  const h = sLat * sLat + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * sLon * sLon;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
};

// --- hubs, parsed from the data package like build-roads does ---
const hubsTs = readFileSync(`${repo}/packages/data/src/hubs.ts`, "utf8");
const hubs = [...hubsTs.matchAll(/\["([A-Z]{3})", "([^"]+)", (-?[\d.]+), (-?[\d.]+)/g)].map((m) => ({ id: m[1], name: m[2], lat: Number(m[3]), lon: Number(m[4]) }));
if (hubs.length !== 60) throw new Error(`parsed ${hubs.length} hubs`);

// --- Natural Earth places, lower 48 ---
const STATE = {
  Alabama: "AL", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC", Florida: "FL", Georgia: "GA",
  Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI",
  Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
  Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};
const dbf = readDbf(dbfPath);
const all = dbf.rows
  .filter((r) => r.adm0_a3 === "USA" && !EXCLUDE.has(r.adm1name) && STATE[r.adm1name] && r.latitude > 24 && r.latitude < 50 && r.longitude > -125 && r.longitude < -66)
  .map((r) => ({ name: r.nameascii || r.name, state: STATE[r.adm1name], lat: r.latitude, lon: r.longitude, pop: Math.max(r.pop_max ?? 0, r.pop_min ?? 0), capital: /Admin-1/.test(r.featurecla) }))
  .sort((a, b) => b.pop - a.pop);

// 1. Big places, biggest first; a place within FOLD_MI of one already chosen is its suburb.
const chosen = [];
const pick = (p, why) => {
  if (chosen.some((q) => mi(p, q) < FOLD_MI)) return false;
  chosen.push({ ...p, why });
  return true;
};
for (const p of all) if (p.pop >= BIG) pick(p, "big");
// 2. State capitals.
for (const p of all) if (p.capital) pick(p, "capital");
// 3. Every hub is a place: the chosen place within 15 miles, else the nearest NE place within 25, else the hub itself.
const placeOfHub = hubs.map((h) => {
  let best = null;
  for (let i = 0; i < chosen.length; i++) if (mi(h, chosen[i]) < 15 && (!best || chosen[i].pop > chosen[best].pop)) best = i;
  if (best !== null) return best;
  const near = all.filter((p) => mi(h, p) < 25).sort((a, b) => b.pop - a.pop)[0];
  chosen.push(near ? { ...near, why: "hub" } : { name: h.name, state: "", lat: h.lat, lon: h.lon, pop: 0, capital: false, why: "hub" });
  return chosen.length - 1;
});
// 4. Coverage: the largest remaining town in every one-degree cell that has none.
const cellOf = (p) => `${Math.floor(p.lat / GRID)},${Math.floor(p.lon / GRID)}`;
const covered = new Set(chosen.map(cellOf));
for (const p of all) {
  if (p.pop < ANCHOR_MIN || covered.has(cellOf(p))) continue;
  if (pick(p, "anchor")) covered.add(cellOf(p));
}

// Markets: the nearest hub. Ids: state + name, unique.
const used = new Set();
const places = chosen.map((p) => {
  let market = 0;
  for (let i = 1; i < hubs.length; i++) if (mi(p, hubs[i]) < mi(p, hubs[market])) market = i;
  let id = `${p.state || "US"}-${p.name.replace(/[^A-Za-z]/g, "").slice(0, 12)}`;
  while (used.has(id)) id += "2";
  used.add(id);
  return { id, name: p.name, state: p.state, lat: Math.round(p.lat * 1000) / 1000, lon: Math.round(p.lon * 1000) / 1000, pop: p.pop, market, why: p.why };
});
// Sort by population so the big ones come first, but keep hub places findable.
const order = places.map((_, i) => i).sort((a, b) => places[b].pop - places[a].pop);
const sorted = order.map((i) => places[i]);
const newIndex = new Map(order.map((old, i) => [old, i]));
const hubPlaces = placeOfHub.map((old) => newIndex.get(old));

// --- stats ---
const byWhy = {};
for (const p of sorted) byWhy[p.why] = (byWhy[p.why] ?? 0) + 1;
let worst = { d: 0 };
for (const p of all) {
  if (p.pop < ANCHOR_MIN) continue;
  let d = Infinity;
  for (const q of sorted) d = Math.min(d, mi(p, q));
  if (d > worst.d) worst = { d, name: `${p.name}, ${p.state}` };
}
const byState = {};
for (const p of sorted) byState[p.state] = (byState[p.state] ?? 0) + 1;
console.log(`places ${sorted.length} (${Object.entries(byWhy).map(([k, v]) => `${k} ${v}`).join(", ")}); farthest town of ${ANCHOR_MIN}+ from a place: ${worst.name} ${worst.d.toFixed(0)} mi`);
console.log("by state:", Object.entries(byState).sort().map(([s, n]) => `${s} ${n}`).join(" "));
console.log("MT/WY/ID:", sorted.filter((p) => ["MT", "WY", "ID"].includes(p.state)).map((p) => p.name).join(", "));

// --- emit ---
const lines = sorted.map((p) => `  [${JSON.stringify(p.id)}, ${JSON.stringify(p.name)}, ${JSON.stringify(p.state)}, ${p.lat}, ${p.lon}, ${p.pop}, ${p.market}],`);
const out = `// Generated by packages/data/tools/build-places.mjs from Natural Earth 10m populated places (public domain).
// Every lower-48 place over ${BIG.toLocaleString("en-US")} people (suburbs within ${FOLD_MI} miles folded in), every state capital,
// every hub, and the largest town in every one-degree cell that had none. [id, name, state, lat, lon, population, market hub index].
export type PlaceRow = readonly [id: string, name: string, state: string, lat: number, lon: number, pop: number, market: number];

export const PLACE_ROWS: readonly PlaceRow[] = [
${lines.join("\n")}
];

/** Each hub's own place, by hub index. */
export const PLACE_OF_HUB: readonly number[] = [${hubPlaces.join(", ")}];
`;
writeFileSync(`${repo}/packages/data/src/places.ts`, out);
console.log(`wrote packages/data/src/places.ts (${(out.length / 1024).toFixed(0)} KB)`);
