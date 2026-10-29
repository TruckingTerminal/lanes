// Builds packages/data/src/places.ts from GeoNames cities500 (CC BY 4.0, geonames.org): every
// lower-48 town over BIG people, every county seat and state capital, every hub, and then a
// coverage pass over a half-degree grid that adds the largest remaining town in any cell without
// one, so no stretch of country is empty. A place within FOLD_MI of a bigger chosen place is its
// suburb: folded in, its people counted with the parent's. Each place's market is the hub it
// reaches soonest by road among its four nearest as the crow flies, computed here on the real
// road network so the game doesn't route twenty thousand legs at startup.
//
//   npx tsx packages/data/tools/build-places.mjs <cities500.txt> <repo root>
import { readFileSync, writeFileSync } from "node:fs";
import { economyConfig } from "@lanes/config";
import { RoadNetwork } from "../src/roadNetwork.js";

const [srcPath, repo = "."] = process.argv.slice(2);
if (!srcPath) throw new Error("usage: build-places.mjs <cities500.txt> [repo]");

const BIG = 10_000; // every town this size is in
const FOLD_MI = 5; // a place this close to a bigger one is its suburb
const ANCHOR_MIN = 1_000; // the smallest town that can anchor an empty grid cell
const GRID = 0.5; // degrees: about 35 miles
const SEAT_MIN = 500; // county seats and capitals this size are in
const STATES = new Set("AL AZ AR CA CO CT DE DC FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "));
const KEEP = new Set(["PPL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLC"]); // towns, capitals, county seats; not neighbourhoods or ghost towns
const BOROUGHS = new Set(["5110302", "5133273", "5125771", "5110266", "5139568"]); // Brooklyn, Queens, Manhattan, the Bronx, Staten Island: New York City already counts them

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

// --- GeoNames places, lower 48 ---
const all = readFileSync(srcPath, "utf8")
  .split("\n")
  .map((line) => line.split("\t"))
  .filter((f) => f.length > 15 && f[8] === "US" && STATES.has(f[10]) && KEEP.has(f[7]) && !BOROUGHS.has(f[0]))
  .map((f) => ({ name: f[2] || f[1], state: f[10], lat: Number(f[4]), lon: Number(f[5]), pop: Number(f[14]) || 0, code: f[7] }))
  .filter((p) => p.lat > 24 && p.lat < 50 && p.lon > -125 && p.lon < -66)
  .sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name));

// A grid over the chosen places so folding stays quick with thousands of them.
const chosen = [];
const buckets = new Map();
const bucketKey = (p) => `${Math.floor(p.lat / 0.2)},${Math.floor(p.lon / 0.2)}`;
const nearChosen = (p, within) => {
  const la = Math.floor(p.lat / 0.2);
  const lo = Math.floor(p.lon / 0.2);
  for (let a = la - 1; a <= la + 1; a++) {
    for (let b = lo - 1; b <= lo + 1; b++) {
      for (const i of buckets.get(`${a},${b}`) ?? []) if (mi(p, chosen[i]) < within) return i;
    }
  }
  return -1;
};
const pick = (p, why) => {
  const near = nearChosen(p, FOLD_MI);
  if (near >= 0) {
    const q = chosen[near];
    q.pop += p.pop; // a suburb's people count with the town they live beside
    q.folded++;
    // A county seat of about the same size keeps its name when a suburb got there first (Naples,
    // not Golden Gate; but Kansas City, Missouri, not the Kansas one).
    if (p.code !== "PPL" && q.code === "PPL" && p.pop >= 0.75 * (q.pop - p.pop)) Object.assign(q, { name: p.name, state: p.state, lat: p.lat, lon: p.lon, code: p.code });
    return false;
  }
  chosen.push({ ...p, why, folded: 0 });
  const k = bucketKey(p);
  if (!buckets.has(k)) buckets.set(k, []);
  buckets.get(k).push(chosen.length - 1);
  return true;
};
// 1. Big places, biggest first.
for (const p of all) if (p.pop >= BIG) pick(p, "big");
// 2. County seats and capitals.
for (const p of all) if (p.pop >= SEAT_MIN && p.code !== "PPL") pick(p, p.code === "PPLA2" ? "seat" : "capital");
// 3. Every hub is a place: the chosen place within 15 miles, else the nearest GeoNames place within 25, else the hub itself.
const placeOfHub = hubs.map((h) => {
  let best = -1;
  for (let i = 0; i < chosen.length; i++) if (mi(h, chosen[i]) < 15 && (best < 0 || chosen[i].pop > chosen[best].pop)) best = i;
  if (best >= 0) return best;
  const near = all.filter((p) => mi(h, p) < 25).sort((a, b) => b.pop - a.pop)[0];
  chosen.push(near ? { ...near, why: "hub", folded: 0 } : { name: h.name, state: "", lat: h.lat, lon: h.lon, pop: 0, code: "", why: "hub", folded: 0 });
  return chosen.length - 1;
});
// 4. Coverage: the largest remaining town in every half-degree cell that has none.
const cellOf = (p) => `${Math.floor(p.lat / GRID)},${Math.floor(p.lon / GRID)}`;
const covered = new Set(chosen.map(cellOf));
for (const p of all) {
  if (p.pop < ANCHOR_MIN || covered.has(cellOf(p))) continue;
  if (pick(p, "anchor")) covered.add(cellOf(p));
}

// --- where each place joins the road, and its market ---
// Natural Earth's roads have loose ends (a bypass whose junction never stitched, a highway that
// stops a mile short of the one it meets), so the nearest point isn't always on a road that goes
// anywhere: Castle Rock's nearest road ran 209 miles to Denver, 26 miles away. Each place looks at
// the nearest point on every road within reach and takes the one that gets a truck to a hub
// soonest, by the hubs' own searches over the unsplit network; the market is that hub. The game
// attaches the place at that point (the row carries it), so it never routes this at startup.
const roads = new RoadNetwork(economyConfig.roads.routing);
const { mph } = economyConfig.roads.routing;
const hubOfChosen = new Map(placeOfHub.map((c, h) => [c, h]));
const hours = hubs.map((_, j) => roads.hoursFrom(j));
let far = { mi: 0 };
let moved = 0;
let unreached = 0;
for (let i = 0; i < chosen.length; i++) {
  const p = chosen[i];
  const h = hubOfChosen.get(i);
  if (h !== undefined) {
    p.market = h;
    continue;
  }
  const near = hubs
    .map((hub, j) => ({ j, gc: mi(p, hub) }))
    .sort((a, b) => a.gc - b.gc)
    .slice(0, 4);
  // Each road's best time to a hub; then the nearest road that isn't a real detour (a quarter
  // longer than the best, plus ten minutes), so towns join the road beside them, not the
  // interstate ten miles off, unless the road beside them leads nowhere.
  const cands = roads.nearestPoints(p.lat, p.lon, 40).map((c) => {
    const e = roads.edges[c.edge];
    const along = c.along;
    const stubH = (c.mi * 1.2) / mph[1];
    let t = Infinity;
    let j = near[0].j;
    for (const h of near) {
      const th = stubH + Math.min(hours[h.j][e.a] + along / mph[e.cls], hours[h.j][e.b] + (e.miles - along) / mph[e.cls]);
      if (th < t) {
        t = th;
        j = h.j;
      }
    }
    return { c, t, j };
  });
  const bestT = Math.min(...cands.map((x) => x.t));
  const pick = cands.find((x) => x.t <= bestT * 1.25 + 0.17) ?? null;
  if (!pick) {
    unreached++;
    p.market = near[0].j;
    p.at = { lat: p.lat, lon: p.lon };
    continue;
  }
  p.market = pick.j;
  p.at = { lat: pick.c.lat, lon: pick.c.lon };
  if (pick !== cands[0]) moved++;
  const road = pick.t * mph[0];
  if (road > far.mi) far = { mi: road, name: `${p.name}, ${p.state}`, hub: hubs[pick.j].id };
}
console.log(`${moved} places join a road other than the nearest; ${unreached} have no road within 40 miles`);

// Ids: state + name, unique.
const used = new Set();
const places = chosen.map((p) => {
  let id = `${p.state || "US"}-${p.name.replace(/[^A-Za-z]/g, "").slice(0, 12)}`;
  while (used.has(id)) id += "2";
  used.add(id);
  const at = p.at ?? { lat: p.lat, lon: p.lon };
  return { id, name: p.name, state: p.state, lat: Math.round(p.lat * 1000) / 1000, lon: Math.round(p.lon * 1000) / 1000, pop: p.pop, market: p.market, atLat: Math.round(at.lat * 1000) / 1000, atLon: Math.round(at.lon * 1000) / 1000, why: p.why };
});
// Sort by population so the big ones come first, but keep hub places findable.
const order = places.map((_, i) => i).sort((a, b) => places[b].pop - places[a].pop || a - b);
const sorted = order.map((i) => places[i]);
const newIndex = new Map(order.map((old, i) => [old, i]));
const hubPlaces = placeOfHub.map((old) => newIndex.get(old));

// --- stats ---
const byWhy = {};
for (const p of sorted) byWhy[p.why] = (byWhy[p.why] ?? 0) + 1;
let worst = { d: 0 };
for (const p of all) {
  if (p.pop < ANCHOR_MIN) continue;
  const near = nearChosen(p, 1e9);
  let d = Infinity;
  const la = Math.floor(p.lat / 0.2);
  const lo = Math.floor(p.lon / 0.2);
  for (let a = la - 3; a <= la + 3; a++) for (let b = lo - 3; b <= lo + 3; b++) for (const i of buckets.get(`${a},${b}`) ?? []) d = Math.min(d, mi(p, chosen[i]));
  if (near < 0 && d > worst.d) worst = { d, name: `${p.name}, ${p.state}` };
}
const byState = {};
for (const p of sorted) byState[p.state] = (byState[p.state] ?? 0) + 1;
const byMarket = new Array(hubs.length).fill(0);
for (const p of sorted) byMarket[p.market]++;
console.log(`places ${sorted.length} (${Object.entries(byWhy).map(([k, v]) => `${k} ${v}`).join(", ")}); farthest town of ${ANCHOR_MIN}+ from a place: ${worst.name} ${worst.d.toFixed(0)} mi; farthest place from its market: ${far.name} about ${far.mi.toFixed(0)} mi to ${far.hub}`);
console.log("by state:", Object.entries(byState).sort().map(([s, n]) => `${s} ${n}`).join(" "));
console.log("by market:", hubs.map((h, i) => `${h.id} ${byMarket[i]}`).join(" "));

// --- emit ---
const lines = sorted.map((p) => `  [${JSON.stringify(p.id)}, ${JSON.stringify(p.name)}, ${JSON.stringify(p.state)}, ${p.lat}, ${p.lon}, ${p.pop}, ${p.market}, ${p.atLat}, ${p.atLon}],`);
const out = `// Generated by packages/data/tools/build-places.mjs from GeoNames cities500 (geonames.org, CC BY 4.0).
// Every lower-48 town over ${BIG.toLocaleString("en-US")} people (suburbs within ${FOLD_MI} miles folded in, their people counted),
// every county seat and state capital, every hub, and the largest town in every half-degree cell that had none.
// [id, name, state, lat, lon, population, market hub index, road lat, road lon]: the market is the hub reached
// soonest by road, and the road point is where the place joins the network (the nearest road that goes somewhere).
export type PlaceRow = readonly [id: string, name: string, state: string, lat: number, lon: number, pop: number, market: number, atLat: number, atLon: number];

export const PLACE_ROWS: readonly PlaceRow[] = [
${lines.join("\n")}
];

/** Each hub's own place, by hub index. */
export const PLACE_OF_HUB: readonly number[] = [${hubPlaces.join(", ")}];
`;
writeFileSync(`${repo}/packages/data/src/places.ts`, out);
console.log(`wrote packages/data/src/places.ts (${(out.length / 1024).toFixed(0)} KB)`);
