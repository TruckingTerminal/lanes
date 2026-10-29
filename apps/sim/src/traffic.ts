// Where does freight actually touch the ground? Runs an AI world and counts booked loads' ends per
// place, per one-degree cell and by town size; then checks every place's road distance to its market
// and how far towns sit from the road they join.
//   npx tsx apps/sim/src/traffic.ts [days]
import { populate, ruleBotHook } from "@lanes/agents";
import { economyConfig as cfg } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds, PLACE_OF_HUB, placeRoute } from "@lanes/data";
const greatCircleMiles = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const R = Math.PI / 180;
  const sLat = Math.sin(((b.lat - a.lat) * R) / 2);
  const sLon = Math.sin(((b.lon - a.lon) * R) / 2);
  const h = sLat * sLat + Math.cos(a.lat * R) * Math.cos(b.lat * R) * sLon * sLon;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
};
import { createWorld, runDays } from "@lanes/engine";

const days = Number(process.argv[2] ?? 60);
const t0 = Date.now();
const net = buildNetwork(hubs, cfg);
const t1 = Date.now();
const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 5 });
populate(w, { freeOwnerOperators: 400, fleets: 120, brokers: 60 });
const origins = new Map<number, number>();
const dests = new Map<number, number>();
const seen = new Set<number>();
let total = 0;
for (let d = 0; d < days; d++) {
  runDays(w, 1, ruleBotHook);
  for (const l of w.loads.values()) {
    if (seen.has(l.id) || l.status === "open") continue;
    seen.add(l.id);
    origins.set(l.originPlace, (origins.get(l.originPlace) ?? 0) + 1);
    dests.set(l.destPlace, (dests.get(l.destPlace) ?? 0) + 1);
    total++;
  }
}
const t2 = Date.now();
const places = net.places;
const ends = (p: number) => (origins.get(p) ?? 0) + (dests.get(p) ?? 0);
const cellOf = (p: { lat: number; lon: number }) => `${Math.floor(p.lat)},${Math.floor(p.lon)}`;
const cells = new Map<string, number>();
for (let p = 0; p < places.length; p++) cells.set(cellOf(places[p]!), (cells.get(cellOf(places[p]!)) ?? 0) + ends(p));
const brackets = [0, 10_000, 25_000, 50_000, 250_000, 1e9];
console.log(`network ${t1 - t0} ms, ${days} days ${t2 - t1} ms, places ${places.length}, booked loads ${total} (${(total / days).toFixed(0)}/day), trucks ${w.trucks.length}`);
for (let i = 0; i + 1 < brackets.length; i++) {
  const ps = places.map((_, p) => p).filter((p) => places[p]!.pop >= brackets[i]! && places[p]!.pop < brackets[i + 1]!);
  const o = ps.reduce((s, p) => s + (origins.get(p) ?? 0), 0);
  const dd = ps.reduce((s, p) => s + (dests.get(p) ?? 0), 0);
  console.log(`  pop ${brackets[i]}-${brackets[i + 1]}: ${ps.length} places, origins ${((100 * o) / total).toFixed(1)}%, dests ${((100 * dd) / total).toFixed(1)}%, touched ${ps.filter((p) => ends(p) > 0).length}`);
}
console.log(`cells with places ${cells.size}; with no load ends ${[...cells.values()].filter((c) => c === 0).length}; under one end per 10 days ${[...cells.values()].filter((c) => c < days / 10).length}`);
for (const st of ["MT", "WY", "ID", "NV", "ND", "SD", "NE", "KS", "NM", "WV", "ME", "VT"]) {
  const ps = places.map((_, i) => i).filter((i) => places[i]!.state === st);
  const e = ps.reduce((s, i) => s + ends(i), 0);
  console.log(`  ${st}: ${ps.length} places, ${e} ends (${(e / days).toFixed(1)}/day), touched ${ps.filter((i) => ends(i) > 0).length}`);
}
// Road sanity: places whose road to their market is far longer than the crow flies (dangling road data).
const odd: { id: string; road: number; gc: number; hub: string }[] = [];
for (let p = 0; p < places.length; p++) {
  const hp = PLACE_OF_HUB[places[p]!.market]!;
  if (p === hp) continue;
  const r = placeRoute(net, p, hp);
  const gc = greatCircleMiles(places[p]!, places[hp]!);
  if (!r) odd.push({ id: places[p]!.id, road: -1, gc, hub: hubs[places[p]!.market]!.id });
  else if (r.miles > 2 * gc + 40) odd.push({ id: places[p]!.id, road: r.miles, gc, hub: hubs[places[p]!.market]!.id });
}
odd.sort((a, b) => b.road / b.gc - a.road / a.gc);
console.log(`places with a road to market over twice the crow-flies distance: ${odd.length}`);
for (const o of odd.slice(0, 25)) console.log(`  ${o.id} -> ${o.hub}: road ${o.road.toFixed(0)} vs ${o.gc.toFixed(0)} mi`);
// How far towns sit from the road point they join.
const stubs = places.map((p) => greatCircleMiles(p, { lat: p.atLat, lon: p.atLon })).sort((a, b) => a - b);
console.log(`town to road point: median ${stubs[Math.floor(stubs.length / 2)]!.toFixed(1)} mi, p90 ${stubs[Math.floor(stubs.length * 0.9)]!.toFixed(1)} mi, max ${stubs.at(-1)!.toFixed(1)} mi`);
