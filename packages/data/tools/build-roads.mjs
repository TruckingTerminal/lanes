// Builds packages/data/src/roads.ts from Natural Earth's North America roads (public domain):
// US interstates and US highways as a graph of junction nodes and edges with miles, class, toll
// and simplified geometry, plus each hub's attachment and each weigh station's edge.
//   node packages/data/tools/build-roads.mjs <na.shp> <na.dbf> <repo root> [--tol 0.03] [--stats]
// Source: ne_10m_roads_north_america.{shp,dbf} from github.com/nvkelso/natural-earth-vector/10m_cultural
// (public domain). Download into an empty folder outside the repo; the tool only reads them.
import { readFileSync, writeFileSync } from "node:fs";
import { readDbf, readShp } from "./shp.mjs";

const [shpPath, dbfPath, repo] = process.argv.slice(2);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TOL = Number(arg("--tol", "0.02"));
const STATS = process.argv.includes("--stats");
const GRID = 0.004; // degrees (~0.3 mi): vertices that coincide are one junction; crossings and road ends are joined explicitly
const EXCLUDE_STATES = new Set(["Alaska", "Hawaii", "Puerto Rico"]);

// --- the repo's hubs and weigh stations (parsed from their TS tables) ---
const hubsTs = readFileSync(`${repo}/packages/data/src/hubs.ts`, "utf8");
const hubs = [...hubsTs.matchAll(/\["([A-Z]{3})", "([^"]+)", (-?[\d.]+), (-?[\d.]+),/g)].map((m) => ({ id: m[1], name: m[2], lat: Number(m[3]), lon: Number(m[4]) }));
const wsTs = readFileSync(`${repo}/packages/data/src/weighStations.ts`, "utf8");
const stations = [...wsTs.matchAll(/\["([A-Z]{2}-[A-Z0-9]+)", "([^"]+)", "([^"]+)", (-?[\d.]+), (-?[\d.]+)\]/g)].map((m) => ({ id: m[1], name: m[2], route: m[3], lat: Number(m[4]), lon: Number(m[5]) }));
if (hubs.length !== 60) throw new Error(`parsed ${hubs.length} hubs`);
if (stations.length < 50) throw new Error(`parsed ${stations.length} stations`);

// --- toll rates, FD (≈$) per mile for a 5-axle truck, by state and route; default for any other tollway ---
const TOLL = [
  [/^Pennsylvania$/, /^I-(76|276|476|70|80|95)$/, 0.8],
  [/^Ohio$/, /^I-(80|90|76)$/, 0.35],
  [/^Indiana$/, /^I-(80|90)$/, 0.45],
  [/^Illinois$/, /^I-(88|90|294|355|94)$/, 0.45],
  [/^New Jersey$/, /^I-95$/, 0.55],
  [/^New Jersey$/, /.*/, 0.4],
  [/^Delaware$/, /^I-95$/, 0.45],
  [/^Maryland$/, /.*/, 0.3],
  [/^New York$/, /^I-(87|90|95)$/, 0.35],
  [/^Massachusetts$/, /^I-90$/, 0.3],
  [/^New Hampshire$/, /.*/, 0.25],
  [/^Maine$/, /^I-95$/, 0.35],
  [/^Kansas$/, /^I-(35|70|335)$/, 0.2],
  [/^Oklahoma$/, /.*/, 0.25],
  [/^Florida$/, /.*/, 0.4],
  [/^West Virginia$/, /^I-77$/, 0.3],
  [/^Texas$/, /.*/, 0.5],
  [/^Virginia$/, /.*/, 0.3],
  [/^California$/, /.*/, 0.5],
  [/^Colorado$/, /.*/, 0.6],
];
const tollRate = (state, label) => TOLL.find(([s, r]) => s.test(state) && r.test(label))?.[2] ?? 0.35;

// --- geometry helpers ---
const RAD = Math.PI / 180;
const mi = (a, b) => {
  const sLat = Math.sin(((b[1] - a[1]) * RAD) / 2);
  const sLon = Math.sin(((b[0] - a[0]) * RAD) / 2);
  const h = sLat * sLat + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * sLon * sLon;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
};
const cell = (p) => `${Math.round(p[1] / GRID)},${Math.round(p[0] / GRID)}`;
// Douglas–Peucker on [lon, lat], tolerance in degrees (lon scaled by cos lat).
function simplify(pts, tol) {
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    const a = pts[i], b = pts[j];
    const k = Math.cos(((a[1] + b[1]) / 2) * RAD);
    const dx = (b[0] - a[0]) * k, dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let best = -1, bestD = tol;
    for (let m = i + 1; m < j; m++) {
      const px = (pts[m][0] - a[0]) * k, py = pts[m][1] - a[1];
      const t = len2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
      const d = Math.hypot(px - t * dx, py - t * dy);
      if (d > bestD) { bestD = d; best = m; }
    }
    if (best > 0) { keep[best] = 1; stack.push([i, best], [best, j]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// --- read and filter ---
const shp = readShp(shpPath);
const dbf = readDbf(dbfPath);
const feats = [];
dbf.rows.forEach((r, i) => {
  if (r.country !== "United States" || EXCLUDE_STATES.has(r.state)) return;
  // Interstates, US highways, every toll road, and the state freeways that are major truck corridors.
  const corridor = r.class === "State" && (r.type === "Tollway" || (r.state === "California" && r.number === "99"));
  if (!(r.class === "Interstate" || (r.class === "Federal" && r.prefix === "US") || corridor)) return;
  if (r.type === "Ferry") return;
  const rec = shp.records[i];
  if (!rec) return;
  const cls = r.class === "Interstate" ? 0 : 1;
  const label = `${r.prefix || (r.class === "Interstate" ? "I" : r.class === "Federal" ? "US" : "SR")}-${r.number}`;
  for (const line of rec) if (line.length >= 2) feats.push({ id: feats.length, cls, label, state: r.state, toll: r.type === "Tollway", pts: line });
});

// --- crossings: where two roads cross without a shared vertex, give both a vertex there ---
{
  const CELL = 0.05;
  const bucket = new Map();
  const key = (lon, lat) => `${Math.floor(lat / CELL)},${Math.floor(lon / CELL)}`;
  feats.forEach((f, fi) => {
    for (let k = 1; k < f.pts.length; k++) {
      const a = f.pts[k - 1], b = f.pts[k];
      const cells = new Set([key(a[0], a[1]), key(b[0], b[1]), key(a[0], b[1]), key(b[0], a[1])]);
      for (const c of cells) { let l = bucket.get(c); if (!l) bucket.set(c, (l = [])); l.push([fi, k - 1]); }
    }
  });
  const inserts = new Map(); // "fi:seg" → [[t, pt], ...]
  const add = (fi, seg, t, pt) => { const k = `${fi}:${seg}`; let l = inserts.get(k); if (!l) inserts.set(k, (l = [])); l.push([t, pt]); };
  let crossings = 0;
  for (const list of bucket.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const [fa, sa] = list[i], [fb, sb] = list[j];
      if (fa === fb) continue;
      const p = feats[fa].pts[sa], p2 = feats[fa].pts[sa + 1], q = feats[fb].pts[sb], q2 = feats[fb].pts[sb + 1];
      const rx = p2[0] - p[0], ry = p2[1] - p[1], sx = q2[0] - q[0], sy = q2[1] - q[1];
      const den = rx * sy - ry * sx;
      if (Math.abs(den) < 1e-12) continue;
      const qpx = q[0] - p[0], qpy = q[1] - p[1];
      const t = (qpx * sy - qpy * sx) / den, u = (qpx * ry - qpy * rx) / den;
      if (t <= 1e-6 || t >= 1 - 1e-6 || u <= 1e-6 || u >= 1 - 1e-6) continue;
      const pt = [p[0] + t * rx, p[1] + t * ry];
      add(fa, sa, t, pt); add(fb, sb, u, pt);
      crossings++;
    }
  }
  // T-junctions: a polyline that ends within ~0.6 mi of another road's segment joins it at the nearest point.
  let tees = 0;
  const SNAP = 0.015;
  for (const f of feats) {
    for (const end of [0, f.pts.length - 1]) {
      const p = f.pts[end];
      let best = null;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const list = bucket.get(`${Math.floor(p[1] / CELL) + dy},${Math.floor(p[0] / CELL) + dx}`);
        if (!list) continue;
        for (const [fi, seg] of list) {
          if (fi === f.id) continue;
          const a = feats[fi].pts[seg], b = feats[fi].pts[seg + 1];
          if (!a || !b) continue;
          const kx = Math.cos(a[1] * RAD);
          const rx = (b[0] - a[0]) * kx, ry = b[1] - a[1];
          const px = (p[0] - a[0]) * kx, py = p[1] - a[1];
          const len2 = rx * rx + ry * ry;
          if (len2 === 0) continue;
          const t = Math.max(0, Math.min(1, (px * rx + py * ry) / len2));
          const d = Math.hypot(px - t * rx, py - t * ry);
          // At a vertex of the other road, join exactly there; inside a segment, at the nearest point.
          const pt = t <= 0.02 ? a : t >= 0.98 ? b : [a[0] + t * (b[0] - a[0]), a[1] + t * ry];
          if (d < SNAP && (!best || d < best.d)) best = { d, fi, seg, t: t <= 0.02 || t >= 0.98 ? -1 : t, pt };
        }
      }
      if (best) { if (best.t >= 0) add(best.fi, best.seg, best.t, best.pt); f.pts[end] = best.pt; tees++; }
    }
  }
  // Road ends that meet other road ends (a state line, a route change) become one point.
  let ends = 0;
  const endCells = new Map();
  const ek = (p) => `${Math.round(p[1] / 0.01)},${Math.round(p[0] / 0.01)}`;
  for (const f of feats) for (const end of [0, f.pts.length - 1]) {
    const p = f.pts[end];
    let joined = false;
    for (let dy = -1; dy <= 1 && !joined; dy++) for (let dx = -1; dx <= 1 && !joined; dx++) {
      const list = endCells.get(`${Math.round(p[1] / 0.01) + dy},${Math.round(p[0] / 0.01) + dx}`);
      if (!list) continue;
      for (const q of list) {
        if (Math.hypot((q[0] - p[0]) * Math.cos(p[1] * RAD), q[1] - p[1]) < 0.015) { f.pts[end] = q; joined = true; ends++; break; }
      }
    }
    if (!joined) { const k = ek(p); let l = endCells.get(k); if (!l) endCells.set(k, (l = [])); l.push(p); }
  }
  for (const f of feats) {
    const out = [];
    for (let k = 0; k < f.pts.length; k++) {
      out.push(f.pts[k]);
      const l = inserts.get(`${f.id}:${k}`);
      if (l) { l.sort((x, y) => x[0] - y[0]); for (const [, pt] of l) out.push(pt); }
    }
    f.pts = out;
  }
  console.log(`crossings added: ${crossings}, road ends joined to roads: ${tees}, to other ends: ${ends}`);
}

// --- junctions: cells shared by two features, plus every polyline end ---
const cellFeats = new Map();
for (const f of feats) for (const p of f.pts) {
  const c = cell(p);
  let s = cellFeats.get(c);
  if (!s) cellFeats.set(c, (s = new Set()));
  s.add(f.id);
}
const isJunction = (c) => cellFeats.get(c).size >= 2;

// --- nodes and edges ---
const nodeOf = new Map(); // cell → node index
const nodes = [];
const node = (p) => {
  const c = cell(p);
  let n = nodeOf.get(c);
  if (n === undefined) { n = nodes.length; nodeOf.set(c, n); nodes.push([Math.round(p[1] * 1000) / 1000, Math.round(p[0] * 1000) / 1000]); }
  return n;
};
const edges = []; // {a, b, miles, cls, toll, label, state, geom}
for (const f of feats) {
  let start = 0;
  for (let i = 1; i < f.pts.length; i++) {
    const last = i === f.pts.length - 1;
    if (!last && !isJunction(cell(f.pts[i]))) continue;
    const seg = f.pts.slice(start, i + 1);
    const a = node(seg[0]), b = node(seg[seg.length - 1]);
    if (a !== b) {
      let miles = 0;
      for (let k = 1; k < seg.length; k++) miles += mi(seg[k - 1], seg[k]);
      if (miles > 0.05) edges.push({ a, b, miles, cls: f.cls, toll: f.toll ? tollRate(f.state, f.label) : 0, label: f.label, state: f.state, geom: simplify(seg, TOL) });
    }
    start = i;
  }
}

// --- merge edges through nodes that only join two pieces of the same road (state lines, feature breaks) ---
{
  const deg = new Map();
  for (const e of edges) { deg.set(e.a, (deg.get(e.a) ?? 0) + 1); deg.set(e.b, (deg.get(e.b) ?? 0) + 1); }
  const byNode = new Map();
  edges.forEach((e, i) => { for (const n of [e.a, e.b]) { let l = byNode.get(n); if (!l) byNode.set(n, (l = [])); l.push(i); } });
  const dead = new Set();
  for (const [n, d] of deg) {
    if (d !== 2) continue;
    const [i, j] = byNode.get(n);
    if (i === j || dead.has(i) || dead.has(j)) continue;
    const x = edges[i], y = edges[j];
    if (x.cls !== y.cls || x.toll !== y.toll || x.label !== y.label) continue;
    const xg = x.b === n ? x.geom : [...x.geom].reverse();
    const xa = x.b === n ? x.a : x.b;
    const yg = y.a === n ? y.geom : [...y.geom].reverse();
    const yb = y.a === n ? y.b : y.a;
    if (xa === yb) continue;
    x.a = xa; x.b = yb; x.geom = [...xg, ...yg.slice(1)]; x.miles += y.miles;
    dead.add(j);
    const l = byNode.get(yb); l[l.indexOf(j)] = i;
    deg.set(n, 0);
  }
  const live = edges.filter((_, i) => !dead.has(i));
  edges.length = 0; edges.push(...live);
}

// --- largest connected component ---
const parent = nodes.map((_, i) => i);
const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
for (const e of edges) parent[find(e.a)] = find(e.b);
const compSize = new Map();
for (let i = 0; i < nodes.length; i++) compSize.set(find(i), (compSize.get(find(i)) ?? 0) + 1);
const mainComp = [...compSize.entries()].sort((x, y) => y[1] - x[1])[0][0];
const keepNode = nodes.map((_, i) => find(i) === mainComp);

// --- hubs attach to the nearest point on any road of the main network: an interstate within 8 mi if there is one,
// else the nearest road. A junction node within 2 mi is used as is; otherwise the edge is split there. ---
const hubAttach = hubs.map((h) => {
  const p = [h.lon, h.lat];
  let bestI = null, bestAny = null;
  edges.forEach((e, i) => {
    if (!keepNode[e.a]) return;
    const r = nearestOnEdge(e, p);
    if (e.cls === 0 && (!bestI || r.d < bestI.d)) bestI = { ...r, i };
    if (!bestAny || r.d < bestAny.d) bestAny = { ...r, i };
  });
  const pick = bestI && bestI.d <= 8 ? bestI : bestAny;
  const e = edges[pick.i];
  const stub = Math.round(pick.d * 1.2 * 10) / 10;
  // Close enough to an end of the edge: use that node.
  const dA = mi(p, [nodes[e.a][1], nodes[e.a][0]]), dB = mi(p, [nodes[e.b][1], nodes[e.b][0]]);
  if (dA <= 2) return { node: e.a, miles: Math.round(dA * 1.2 * 10) / 10 };
  if (dB <= 2) return { node: e.b, miles: Math.round(dB * 1.2 * 10) / 10 };
  // Split the edge at the nearest point.
  const nid = nodes.length;
  nodes.push([Math.round(pick.pt[1] * 1000) / 1000, Math.round(pick.pt[0] * 1000) / 1000]);
  keepNode.push(true);
  const g = e.geom;
  const g1 = [...g.slice(0, pick.seg), pick.pt];
  const g2 = [pick.pt, ...g.slice(pick.seg)];
  const m1 = e.miles * pick.frac, m2 = e.miles - m1;
  const tail = { ...e, a: nid, b: e.b, miles: m2, geom: g2 };
  e.b = nid; e.miles = m1; e.geom = g1;
  edges.push(tail);
  return { node: nid, miles: stub };
});

// --- weigh stations: the nearest edge of their road within 12 mi, and where along it ---
function nearestOnEdge(e, p) {
  let best = Infinity, at = 0, run = 0, seg = 0, pt = null;
  const g = e.geom;
  let total = 0;
  for (let k = 1; k < g.length; k++) total += mi(g[k - 1], g[k]);
  for (let k = 1; k < g.length; k++) {
    const a = g[k - 1], b = g[k];
    const kx = Math.cos(a[1] * RAD);
    const dx = (b[0] - a[0]) * kx, dy = b[1] - a[1];
    const px = (p[0] - a[0]) * kx, py = p[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
    const q = [a[0] + (t * dx) / kx, a[1] + t * dy];
    const d = mi(p, q);
    const segMi = mi(a, b);
    if (d < best) { best = d; at = total > 0 ? (run + t * segMi) / total : 0; seg = k; pt = q; }
    run += segMi;
  }
  return { d: best, frac: at, seg, pt };
}
const stationEdges = stations.map((s) => {
  const want = s.route.replace(/^I-/, "I-").replace(/^US /, "US-");
  let best = null;
  edges.forEach((e, i) => {
    if (!keepNode[e.a]) return;
    const r = nearestOnEdge(e, [s.lon, s.lat]);
    const sameRoad = e.label === want;
    const score = r.d + (sameRoad ? 0 : 6); // a station is on its own road unless nothing of it is near
    if (r.d <= 12 && (!best || score < best.score)) best = { edge: i, frac: r.frac, d: r.d, score, sameRoad };
  });
  return best ? { id: s.id, edge: best.edge, frac: Math.round(best.frac * 1000) / 1000, d: best.d, sameRoad: best.sameRoad } : { id: s.id, edge: -1 };
});

// --- stats ---
const kept = edges.filter((e) => keepNode[e.a]);
// Node ids in `kept` index `nodes` (some unused nodes sit outside the main component; the emitter renumbers).
const pts = kept.reduce((s, e) => s + e.geom.length, 0);
const tollMi = kept.filter((e) => e.toll > 0).reduce((s, e) => s + e.miles, 0);
console.log(`features ${feats.length}, nodes ${nodes.length} (main component ${keepNode.filter(Boolean).length}), edges ${kept.length}, geometry points ${pts}, interstate miles ${Math.round(kept.filter((e) => e.cls === 0).reduce((s, e) => s + e.miles, 0))}, US-highway miles ${Math.round(kept.filter((e) => e.cls === 1).reduce((s, e) => s + e.miles, 0))}, toll miles ${Math.round(tollMi)}`);
console.log("hubs attached beyond 12 mi:", hubAttach.map((a, i) => (a.miles / 1.2 > 12 ? `${hubs[i].id} ${(a.miles / 1.2).toFixed(0)}` : null)).filter(Boolean).join(", ") || "none");
// Why: the nearest nodes of any component, with their roads.
const labelsAt = new Map();
for (const e of edges) for (const n of [e.a, e.b]) { let l = labelsAt.get(n); if (!l) labelsAt.set(n, (l = new Set())); l.add(e.label); }
hubAttach.forEach((a, i) => {
  if (a.miles / 1.2 <= 12) return;
  const h = hubs[i];
  const near = nodes.map((nd, k) => ({ k, d: mi([h.lon, h.lat], [nd[1], nd[0]]) })).sort((x, y) => x.d - y.d).slice(0, 4);
  console.log(`  ${h.id}: ` + near.map((x) => `node ${x.k} ${x.d.toFixed(1)} mi [${[...(labelsAt.get(x.k) ?? [])].join(",")}] comp ${compSize.get(find(x.k))}`).join(" | "));
});
console.log("stations unmatched:", stationEdges.filter((s) => s.edge < 0).map((s) => s.id).join(", ") || "none", "| off their road:", stationEdges.filter((s) => s.edge >= 0 && !s.sameRoad).map((s) => `${s.id}(${s.d.toFixed(0)}mi)`).join(", ") || "none");

// --- a quick routing sanity check: hub-to-hub road miles vs great circle (time-based Dijkstra) ---
const adj = nodes.map(() => []);
kept.forEach((e, i) => { adj[e.a].push([e.b, i]); adj[e.b].push([e.a, i]); });
const SPEED = [58, 42];
const STOP_H = 0.05; // leaving the interstate for a highway stretch costs a few minutes
const VOT = 90; // FD an hour of truck time is worth, for the toll trade-off
function dijkstra(src) {
  const dist = new Float64Array(nodes.length).fill(Infinity);
  const milesTo = new Float64Array(nodes.length).fill(Infinity);
  const prev = new Int32Array(nodes.length).fill(-1);
  dist[src] = 0; milesTo[src] = 0;
  const heap = [[0, src]];
  const push = (x) => { heap.push(x); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [d, u] = pop();
    if (d > dist[u]) continue;
    for (const [v, ei] of adj[u]) {
      const e = kept[ei];
      const nd = d + e.miles / SPEED[e.cls] + (e.cls === 1 ? STOP_H : 0) + (e.toll * e.miles) / VOT;
      if (nd < dist[v]) { dist[v] = nd; milesTo[v] = milesTo[u] + e.miles; prev[v] = ei; push([nd, v]); }
    }
  }
  return { dist, milesTo, prev };
}
const pairs = [["DAL", "CHI"], ["MIA", "ATL"], ["LAX", "EWR"], ["HOU", "MIA"], ["SEA", "MIA"], ["PIT", "PHL"], ["CHI", "EWR"], ["DEN", "PHX"], ["BOS", "MIA"], ["OMA", "LRD"]];
const byId = Object.fromEntries(hubs.map((h, i) => [h.id, i]));
let unreachable = 0;
const from = {};
for (const [a] of pairs) if (!from[a]) from[a] = dijkstra(hubAttach[byId[a]].node);
for (const [a, b] of pairs) {
  const r = from[a];
  const nb = hubAttach[byId[b]].node;
  const gc = mi([hubs[byId[a]].lon, hubs[byId[a]].lat], [hubs[byId[b]].lon, hubs[byId[b]].lat]);
  if (!Number.isFinite(r.dist[nb])) { unreachable++; console.log(`${a}→${b}: unreachable`); continue; }
  // toll along the path
  let toll = 0, hw = 0, v = nb;
  const labels = [];
  while (v !== hubAttach[byId[a]].node && r.prev[v] >= 0) { const e = kept[r.prev[v]]; toll += e.toll * e.miles; if (e.cls === 1) hw += e.miles; if (labels.at(-1) !== e.label) labels.push(e.label); v = e.a === v ? e.b : e.a; }
  console.log(`${a}→${b}: road ${r.milesTo[nb].toFixed(0)} mi (gc ${gc.toFixed(0)}, ×${(r.milesTo[nb] / gc).toFixed(2)}), ${r.dist[nb].toFixed(1)} h, toll ${toll.toFixed(0)} FD, highway share ${(hw / r.milesTo[nb] * 100).toFixed(0)}% via ${labels.reverse().slice(0, 8).join(" ")}`);
}
if (STATS) process.exit(0);

// --- emit roads.ts: nodes, edges, delta-encoded geometry ---
const nodeMap = new Int32Array(nodes.length).fill(-1);
let n = 0;
nodes.forEach((_, i) => { if (keepNode[i]) nodeMap[i] = n++; });
const outNodes = nodes.filter((_, i) => keepNode[i]).map(([lat, lon]) => [Math.round(lat * 1000), Math.round(lon * 1000)]);
const labels = [];
const labelIx = new Map();
const lab = (s) => { let i = labelIx.get(s); if (i === undefined) { i = labels.length; labelIx.set(s, i); labels.push(s); } return i; };
const geomStarts = [];
const geom = []; // flat deltas in milli-degrees: lat0, lon0, dlat, dlon, ...
const outEdges = kept.map((e) => {
  geomStarts.push(geom.length);
  let plat = 0, plon = 0;
  e.geom.forEach(([lon, lat], k) => {
    const ql = Math.round(lat * 1000), qo = Math.round(lon * 1000);
    geom.push(k === 0 ? ql : ql - plat, k === 0 ? qo : qo - plon);
    plat = ql; plon = qo;
  });
  return [nodeMap[e.a], nodeMap[e.b], Math.round(e.miles * 10), e.cls, Math.round(e.toll * 100), lab(e.label), e.geom.length];
});
const keptIndex = new Int32Array(edges.length).fill(-1);
let ki = 0;
edges.forEach((e, i) => { if (keepNode[e.a]) keptIndex[i] = ki++; });
const outStations = stationEdges.map((s) => (s.edge >= 0 ? [keptIndex[s.edge], s.frac] : [-1, 0]));
const outHubs = hubAttach.map((a) => [nodeMap[a.node], a.miles]);
const varints = (nums) => {
  const bytes = [];
  for (const v of nums) {
    let z = v >= 0 ? v * 2 : -v * 2 - 1;
    while (z >= 128) { bytes.push((z & 127) | 128); z = Math.floor(z / 128); }
    bytes.push(z);
  }
  return Buffer.from(bytes).toString("base64");
};
// Node ids as deltas: edges come out road by road, so one edge's start is usually the last one's end.
const edgeNums = [];
let prevB = 0;
for (const e of outEdges) { edgeNums.push(e[0] - prevB, e[1] - e[0], ...e.slice(2)); prevB = e[1]; }
const ts = `// Generated by the roads build tool from Natural Earth's North America roads (public domain, 1:10m):
// US interstates and US highways as a graph. Do not edit by hand.
//   nodes: [lat, lon] in thousandths of a degree, flat, each as a delta from the previous node.
//   edges: 7 numbers each: nodeA (as a delta from the previous edge's nodeB), nodeB (as a delta from nodeA), tenths of a mile, class (0 interstate, 1 US highway), toll in cents per mile, label index, geometry points.
//   geom: each edge's geometry in order, lat/lon in thousandths, the first point absolute and the rest as deltas.
//   hubs: for each hub in hubs.ts order, [the node it attaches to, stub miles]. stations: for each weigh station, [edge, fraction along it].
export const ROAD_LABELS: string[] = ${JSON.stringify(labels)};
// Packed as zigzag varints, base64 (see unpack in roadNetwork.ts).
export const ROAD_NODE_COUNT = ${outNodes.length};
export const ROAD_NODES_PACKED = "${varints(outNodes.flatMap(([lat, lon], i) => (i === 0 ? [lat, lon] : [lat - outNodes[i - 1][0], lon - outNodes[i - 1][1]])))}";
export const ROAD_EDGE_COUNT = ${outEdges.length};
export const ROAD_EDGES_PACKED = "${varints(edgeNums)}";
export const ROAD_GEOM_PACKED = "${varints(geom)}";
export const ROAD_HUBS: number[][] = ${JSON.stringify(outHubs)};
export const ROAD_STATIONS: number[][] = ${JSON.stringify(outStations)};
`;
writeFileSync(`${repo}/packages/data/src/roads.ts`, ts);
console.log(`wrote packages/data/src/roads.ts: ${(ts.length / 1024).toFixed(0)} KB, ${outNodes.length} nodes, ${outEdges.length} edges, ${geom.length / 2} points`);
