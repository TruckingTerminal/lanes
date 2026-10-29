import { ROAD_EDGES_PACKED, ROAD_EDGE_COUNT, ROAD_GEOM_PACKED, ROAD_HUBS, ROAD_LABELS, ROAD_NODES_PACKED, ROAD_NODE_COUNT, ROAD_STATIONS } from "./roads.js";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_INDEX = new Int8Array(128).fill(-1);
for (let i = 0; i < 64; i++) B64_INDEX[B64.charCodeAt(i)] = i;

/** Decodes a base64 string of zigzag varints (the format roads.ts is packed in), without any browser API. */
function unpack(packed: string): Int32Array {
  const out: number[] = [];
  let bits = 0;
  let have = 0;
  let value = 0;
  let shift = 1;
  for (let i = 0; i < packed.length; i++) {
    const c = packed.charCodeAt(i);
    if (c === 61) break; // '='
    bits = (bits << 6) | B64_INDEX[c]!;
    have += 6;
    if (have >= 8) {
      have -= 8;
      const byte = (bits >> have) & 255;
      bits &= (1 << have) - 1;
      value += (byte & 127) * shift;
      if (byte & 128) shift *= 128;
      else {
        out.push(value % 2 === 0 ? value / 2 : -(value + 1) / 2);
        value = 0;
        shift = 1;
      }
    }
  }
  return Int32Array.from(out);
}

const ROAD_NODES_FLAT = unpack(ROAD_NODES_PACKED);
for (let i = 2; i < ROAD_NODES_FLAT.length; i++) ROAD_NODES_FLAT[i] = ROAD_NODES_FLAT[i]! + ROAD_NODES_FLAT[i - 2]!;
const ROAD_EDGES_FLAT = unpack(ROAD_EDGES_PACKED);
const ROAD_GEOM = unpack(ROAD_GEOM_PACKED);

/**
 * The US road network (roads.ts: interstates, US highways, toll roads and a few
 * state corridors, from Natural Earth) and routing over it. Routes between hubs
 * are the fastest path, with tolls priced as time (`timeValueFdPerHour`) and a
 * few minutes' penalty for every stretch of two-lane highway, so trucks stay on
 * the interstate unless the highway is a real shortcut. Everything here is
 * deterministic: integer geometry, IEEE adds and divides, ties by node index.
 */
export interface RoadRouting {
  /** Average mph on [interstates, US highways]. */
  mph: readonly [number, number];
  highwayStopHours: number;
  timeValueFdPerHour: number;
}

export interface RoadEdge {
  a: number;
  b: number;
  miles: number;
  /** 0 interstate, 1 US highway (and other two-lane corridors). */
  cls: 0 | 1;
  /** Toll per mile for a truck (0 on free roads). */
  tollPerMile: number;
  label: string;
  /** Index of the first point and the point count in the geometry arrays. */
  g0: number;
  gn: number;
}

/** A route between two hubs: edges in order (each signed: +i forward, −(i+1) reversed) and its totals. */
export interface Route {
  miles: number;
  hours: number;
  tollFd: number;
  highwayMi: number;
  edges: Int32Array;
  /** Miles at the start of each edge, plus the total at the end. */
  cum: Float64Array;
}

/** A binary heap of (key, node) pairs; ties break on the node so the order is the same everywhere. */
class MinHeap {
  private readonly h: [number, number][] = [];
  get size(): number {
    return this.h.length;
  }
  private less(x: [number, number], y: [number, number]): boolean {
    return x[0] < y[0] || (x[0] === y[0] && x[1] < y[1]);
  }
  push(x: [number, number]): void {
    const h = this.h;
    h.push(x);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(h[i]!, h[p]!)) break;
      [h[p], h[i]] = [h[i]!, h[p]!];
      i = p;
    }
  }
  pop(): [number, number] {
    const h = this.h;
    const top = h[0]!;
    const last = h.pop()!;
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && this.less(h[l]!, h[m]!)) m = l;
        if (r < h.length && this.less(h[r]!, h[m]!)) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i]!, h[m]!];
        i = m;
      }
    }
    return top;
  }
}

export class RoadNetwork {
  readonly edges: RoadEdge[];
  /** Geometry, decoded: latitude and longitude per point. */
  readonly lat: Float64Array;
  readonly lon: Float64Array;
  /** Per point: miles from the start of its edge (flat-earth lengths scaled to the edge's road miles; for drawing). */
  readonly along: Float64Array;
  /** Each hub's node and the miles of its connecting stub. */
  readonly hubNode: Int32Array;
  readonly hubStub: Float64Array;
  /** Each node's position: the first or last geometry point of an edge at it. */
  readonly nodeLat: Float64Array;
  readonly nodeLon: Float64Array;
  /**
   * Terminals are the points routes run between: the hubs (0–59, attached at build time with
   * an edge split) and then every place added with addTerminal (attached to the nearest node).
   */
  private readonly terminals: { node: number; stub: number }[] = [];
  private grid: Map<string, number[]> | null = null;
  private readonly adj: number[][];
  private readonly stationsByEdge = new Map<number, { station: number; frac: number }[]>();
  private readonly routes = new Map<number, Route>();
  private readonly fromTerminal = new Map<number, { cost: Float64Array; prev: Int32Array }>();
  /** Searches from places are kept for a while only; the hubs' stay. */
  private readonly recent: number[] = [];

  constructor(private readonly routing: RoadRouting) {
    const n = ROAD_GEOM.length / 2;
    this.lat = new Float64Array(n);
    this.lon = new Float64Array(n);
    this.along = new Float64Array(n);
    this.edges = [];
    this.adj = [];
    for (let i = 0; i < ROAD_NODE_COUNT; i++) this.adj.push([]);
    let g = 0;
    let prevB = 0;
    for (let i = 0; i < ROAD_EDGE_COUNT; i++) {
      const o = i * 7;
      const a = prevB + ROAD_EDGES_FLAT[o]!;
      const b = a + ROAD_EDGES_FLAT[o + 1]!;
      prevB = b;
      const [tenths, cls, cents, label, gn] = [ROAD_EDGES_FLAT[o + 2], ROAD_EDGES_FLAT[o + 3], ROAD_EDGES_FLAT[o + 4], ROAD_EDGES_FLAT[o + 5], ROAD_EDGES_FLAT[o + 6]];
      const e: RoadEdge = { a: a!, b: b!, miles: tenths! / 10, cls: cls as 0 | 1, tollPerMile: cents! / 100, label: ROAD_LABELS[label!]!, g0: g, gn: gn! };
      this.edges.push(e);
      this.adj[a!]!.push(i);
      this.adj[b!]!.push(i);
      // Decode the deltas, then the flat-earth length of each segment to spread the edge's miles over its points.
      let plat = 0;
      let plon = 0;
      let flat = 0;
      for (let k = 0; k < gn!; k++) {
        plat = k === 0 ? ROAD_GEOM[g * 2]! : plat + ROAD_GEOM[(g + k) * 2]!;
        plon = k === 0 ? ROAD_GEOM[g * 2 + 1]! : plon + ROAD_GEOM[(g + k) * 2 + 1]!;
        this.lat[g + k] = plat / 1000;
        this.lon[g + k] = plon / 1000;
        if (k > 0) {
          const dy = this.lat[g + k]! - this.lat[g + k - 1]!;
          const dx = (this.lon[g + k]! - this.lon[g + k - 1]!) * Math.cos((this.lat[g + k]! * Math.PI) / 180);
          flat += Math.sqrt(dx * dx + dy * dy);
          this.along[g + k] = flat;
        }
      }
      const scale = flat > 0 ? e.miles / flat : 0;
      for (let k = 0; k < gn!; k++) this.along[g + k] = this.along[g + k]! * scale;
      g += gn!;
    }
    this.hubNode = new Int32Array(ROAD_HUBS.map((h) => h[0]!));
    this.hubStub = new Float64Array(ROAD_HUBS.map((h) => h[1]!));
    this.nodeLat = new Float64Array(ROAD_NODE_COUNT);
    this.nodeLon = new Float64Array(ROAD_NODE_COUNT);
    for (const e of this.edges) {
      this.nodeLat[e.a] = this.lat[e.g0]!;
      this.nodeLon[e.a] = this.lon[e.g0]!;
      this.nodeLat[e.b] = this.lat[e.g0 + e.gn - 1]!;
      this.nodeLon[e.b] = this.lon[e.g0 + e.gn - 1]!;
    }
    for (let i = 0; i < ROAD_HUBS.length; i++) this.terminals.push({ node: this.hubNode[i]!, stub: this.hubStub[i]! });
    ROAD_STATIONS.forEach(([edge, frac], station) => {
      if (edge! < 0) return;
      let list = this.stationsByEdge.get(edge!);
      if (!list) this.stationsByEdge.set(edge!, (list = []));
      list.push({ station, frac: frac! });
    });
  }

  /** How many terminals exist (hubs first, then places). */
  get terminalCount(): number {
    return this.terminals.length;
  }

  /** The road node nearest a point, by a flat-earth search over a quarter-degree grid. */
  nearestNode(lat: number, lon: number): number {
    if (!this.grid) {
      this.grid = new Map();
      for (let i = 0; i < ROAD_NODE_COUNT; i++) {
        const k = `${Math.floor(this.nodeLat[i]! * 4)},${Math.floor(this.nodeLon[i]! * 4)}`;
        let cell = this.grid.get(k);
        if (!cell) this.grid.set(k, (cell = []));
        cell.push(i);
      }
    }
    const cy = Math.floor(lat * 4);
    const cx = Math.floor(lon * 4);
    const k = Math.cos((lat * Math.PI) / 180);
    let best = -1;
    let bestD = Infinity;
    for (let ring = 0; ring <= 8 && best < 0; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dy), Math.abs(dx)) !== ring) continue;
          for (const i of this.grid.get(`${cy + dy},${cx + dx}`) ?? []) {
            const ddy = this.nodeLat[i]! - lat;
            const ddx = (this.nodeLon[i]! - lon) * k;
            const d = ddy * ddy + ddx * ddx;
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          }
        }
      }
      // Finish the ring that found something, then one more, so a nearer node in the next ring isn't missed.
      if (best >= 0 && ring < 8) {
        const r = ring + 1;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dy), Math.abs(dx)) !== r) continue;
            for (const i of this.grid.get(`${cy + dy},${cx + dx}`) ?? []) {
              const ddy = this.nodeLat[i]! - lat;
              const ddx = (this.nodeLon[i]! - lon) * k;
              const d = ddy * ddy + ddx * ddx;
              if (d < bestD) {
                bestD = d;
                best = i;
              }
            }
          }
        }
        break;
      }
    }
    return best;
  }

  /** Attaches a place to the nearest road node with a local-road stub, returning its terminal index. */
  addTerminal(lat: number, lon: number): number {
    const node = this.nearestNode(lat, lon);
    const dy = (this.nodeLat[node]! - lat) * 69.0;
    const dx = (this.nodeLon[node]! - lon) * 69.0 * Math.cos((lat * Math.PI) / 180);
    const stub = Math.sqrt(dx * dx + dy * dy) * 1.2; // local roads wander
    this.terminals.push({ node, stub });
    return this.terminals.length - 1;
  }

  private edgeCost(e: RoadEdge): number {
    const r = this.routing;
    return e.miles / r.mph[e.cls] + (e.cls === 1 ? r.highwayStopHours : 0) + (e.tollPerMile * e.miles) / r.timeValueFdPerHour;
  }

  /** Dijkstra from a terminal's node. A binary heap keyed on (cost, node) keeps the order the same everywhere. */
  private search(terminal: number): { cost: Float64Array; prev: Int32Array } {
    let s = this.fromTerminal.get(terminal);
    if (s) return s;
    const n = this.adj.length;
    const cost = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const src = this.terminals[terminal]!.node;
    cost[src] = 0;
    const heap: [number, number][] = [[0, src]];
    const less = (x: [number, number], y: [number, number]) => x[0] < y[0] || (x[0] === y[0] && x[1] < y[1]);
    const push = (x: [number, number]) => {
      heap.push(x);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!less(heap[i]!, heap[p]!)) break;
        [heap[p], heap[i]] = [heap[i]!, heap[p]!];
        i = p;
      }
    };
    const pop = (): [number, number] => {
      const top = heap[0]!;
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && less(heap[l]!, heap[m]!)) m = l;
          if (r < heap.length && less(heap[r]!, heap[m]!)) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i]!, heap[m]!];
          i = m;
        }
      }
      return top;
    };
    while (heap.length) {
      const [d, u] = pop();
      if (d > cost[u]!) continue;
      for (const ei of this.adj[u]!) {
        const e = this.edges[ei]!;
        const v = e.a === u ? e.b : e.a;
        const nd = d + this.edgeCost(e);
        if (nd < cost[v]!) {
          cost[v] = nd;
          prev[v] = ei;
          push([nd, v]);
        }
      }
    }
    s = { cost, prev };
    this.fromTerminal.set(terminal, s);
    if (terminal >= ROAD_HUBS.length) {
      this.recent.push(terminal);
      if (this.recent.length > 64) this.fromTerminal.delete(this.recent.shift()!);
    }
    return s;
  }

  /**
   * A* from one node to another, the heuristic a straight-line time at interstate speed
   * (never more than the road takes). Explores a band between the two instead of the whole
   * country, so a route from a place costs a fraction of a full search.
   */
  private astar(src: number, dst: number): Int32Array | null {
    const n = this.adj.length;
    const cost = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const mph = this.routing.mph[0];
    const dLat = this.nodeLat[dst]!;
    const dLon = this.nodeLon[dst]!;
    const h = (v: number) => {
      const dy = (this.nodeLat[v]! - dLat) * 69;
      const dx = (this.nodeLon[v]! - dLon) * 69 * Math.cos((((this.nodeLat[v]! + dLat) / 2) * Math.PI) / 180);
      return Math.sqrt(dx * dx + dy * dy) / mph;
    };
    cost[src] = 0;
    const heap = new MinHeap();
    heap.push([h(src), src]);
    while (heap.size) {
      const [, u] = heap.pop();
      if (u === dst) return prev;
      if (closed[u]) continue;
      closed[u] = 1;
      for (const ei of this.adj[u]!) {
        const e = this.edges[ei]!;
        const v = e.a === u ? e.b : e.a;
        if (closed[v]) continue;
        const nd = cost[u]! + this.edgeCost(e);
        if (nd < cost[v]!) {
          cost[v] = nd;
          prev[v] = ei;
          heap.push([nd + h(v), v]);
        }
      }
    }
    return null;
  }

  /** The route between two terminals: hubs (0–59) or places (null if the road network doesn't connect them). */
  route(a: number, b: number): Route | null {
    const key = a * 1_000_000 + b;
    const hit = this.routes.get(key);
    if (hit) return hit;
    if (a === b) return null;
    const src = this.terminals[a]!.node;
    let v = this.terminals[b]!.node;
    let prev: Int32Array;
    if (a < ROAD_HUBS.length) {
      // From a hub: one full search, kept for good.
      const s = this.search(a);
      if (!Number.isFinite(s.cost[v]!)) return null;
      prev = s.prev;
    } else {
      const p = src === v ? null : this.astar(src, v);
      if (!p) return null;
      prev = p;
    }
    const signed: number[] = [];
    while (v !== src) {
      const ei = prev[v]!;
      const e = this.edges[ei]!;
      // Forward if the edge runs a→b in the direction we travel it.
      signed.push(e.b === v ? ei : -(ei + 1));
      v = e.b === v ? e.a : e.b;
    }
    signed.reverse();
    const edges = new Int32Array(signed);
    const cum = new Float64Array(edges.length + 1);
    const stubA = this.terminals[a]!.stub;
    let miles = stubA + this.terminals[b]!.stub;
    let hours = miles / this.routing.mph[1];
    let tollFd = 0;
    let highwayMi = 0;
    let run = stubA;
    for (let i = 0; i < edges.length; i++) {
      const { e } = this.edgeOf(edges[i]!);
      cum[i] = run;
      run += e.miles;
      miles += e.miles;
      hours += e.miles / this.routing.mph[e.cls] + (e.cls === 1 ? this.routing.highwayStopHours : 0);
      tollFd += e.tollPerMile * e.miles;
      if (e.cls === 1) highwayMi += e.miles;
    }
    cum[edges.length] = run;
    const route: Route = { miles, hours, tollFd, highwayMi, edges, cum };
    this.routes.set(key, route);
    return route;
  }

  /** The edge an entry of `route.edges` refers to, and whether it's travelled forward. */
  edgeOf(signed: number): { e: RoadEdge; forward: boolean } {
    return signed >= 0 ? { e: this.edges[signed]!, forward: true } : { e: this.edges[-signed - 1]!, forward: false };
  }

  /** A node's position, for drawing. */
  nodeAt(i: number): [number, number] {
    return [ROAD_NODES_FLAT[i * 2]! / 1000, ROAD_NODES_FLAT[i * 2 + 1]! / 1000];
  }

  /** Where a truck is, `milesFromStart` along a route: [lat, lon] (the hub itself on the stubs). */
  pointAlong(route: Route, milesFromStart: number, from: { lat: number; lon: number }, to: { lat: number; lon: number }): [number, number] {
    if (milesFromStart <= route.cum[0]!) return [from.lat, from.lon];
    if (milesFromStart >= route.cum[route.edges.length]!) return [to.lat, to.lon];
    // Binary search the edge.
    let lo = 0;
    let hi = route.edges.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (route.cum[mid]! <= milesFromStart) lo = mid;
      else hi = mid - 1;
    }
    const { e, forward } = this.edgeOf(route.edges[lo]!);
    const within = forward ? milesFromStart - route.cum[lo]! : e.miles - (milesFromStart - route.cum[lo]!);
    // Walk the edge's points.
    let k = e.g0;
    const end = e.g0 + e.gn - 1;
    while (k < end && this.along[k + 1]! < within) k++;
    if (k >= end) return [this.lat[end]!, this.lon[end]!];
    const span = this.along[k + 1]! - this.along[k]!;
    const t = span > 0 ? Math.min(1, Math.max(0, (within - this.along[k]!) / span)) : 0;
    return [this.lat[k]! + t * (this.lat[k + 1]! - this.lat[k]!), this.lon[k]! + t * (this.lon[k + 1]! - this.lon[k]!)];
  }

  /** Weigh stations on a route, as fractions of the way along it, in order. */
  stationsAlong(route: Route): { station: number; frac: number }[] {
    const out: { station: number; frac: number }[] = [];
    for (let i = 0; i < route.edges.length; i++) {
      const signed = route.edges[i]!;
      const ei = signed >= 0 ? signed : -signed - 1;
      const list = this.stationsByEdge.get(ei);
      if (!list) continue;
      const { e, forward } = this.edgeOf(signed);
      for (const s of list) {
        const at = route.cum[i]! + (forward ? s.frac : 1 - s.frac) * e.miles;
        out.push({ station: s.station, frac: at / route.miles });
      }
    }
    return out.sort((p, q) => p.frac - q.frac || p.station - q.station);
  }
}
