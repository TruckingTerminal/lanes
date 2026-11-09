import { hubMiles, placeOfHub, type Company, type Truck, type World } from "@lanes/engine";
import { boardRows } from "./board.js";
import { emptyRun } from "./rolling.js";

/**
 * A stranded truck's ways out (the director, 2026-11-09, on the cautious diary's Palm Coast): an idle truck with nothing
 * in reach it may take that pays. Each exit is an empty run, priced as the Truck card prices it (rolling.ts emptyRun),
 * with the loads that would pay from where it ends: home (where a company is local, so its locals-first freight is
 * open), and the hubs within EXIT_WITHIN_MI where at least one load pays. Cheapest first. Pure: What now? (nextstep.ts),
 * the Truck card and the ways-out sheet read the same list.
 */
export interface Exit {
  hub: number;
  home: boolean;
  costFd: number;
  mi: string;
  fd: string;
  time: string;
  /** Loads that would pay from there, as the board would show them to this truck standing there. */
  pays: number;
}

/** How far a way out reaches, and how many hubs are read for one (the nearest, by road). */
export const EXIT_WITHIN_MI = 600;
const EXIT_HUBS = 10;

let memo: { w: World | null; t: number; at: Map<string, Exit[]>; pays: Map<string, number> } = { w: null, t: -1, at: new Map(), pays: new Map() };
const fresh = (w: World) => {
  if (memo.w !== w || memo.t !== w.t) memo = { w, t: w.t, at: new Map(), pays: new Map() };
};

/**
 * Loads that pay, read as the board reads them, for this truck as if it stood at the hub (the board's 300-mile reach).
 * The one count of a hub's loads for a move: the ways-out sheet and Send empty's list both say it (QA, client pass 2:
 * "2 loads pay there" against "3 loads there" for one Savannah). Kept for the game minute.
 */
export function paysFrom(w: World, c: Company, t: Truck, hub: number): number {
  fresh(w);
  const key = `${c.id}:${t.id}:${hub}`;
  const hit = memo.pays.get(key);
  if (hit !== undefined) return hit;
  const there: Truck = { ...t, hub, place: placeOfHub(hub) };
  const n = boardRows(w, c, there, { dest: "any", maxDh: 300, query: "" }).filter((r) => !r.block && r.profitBook > 0).length;
  memo.pays.set(key, n);
  return n;
}

export function exitsFor(w: World, c: Company, t: Truck): Exit[] {
  fresh(w);
  const key = `${c.id}:${t.id}:${t.place}`;
  const hit = memo.at.get(key);
  if (hit) return hit;
  const out: Exit[] = [];
  const exit = (hub: number, home: boolean, pays: number) => {
    const r = emptyRun(w, t, t.hub, hub);
    out.push({ hub, home, costFd: r.costFd, mi: r.mi, fd: r.fd, time: r.time, pays });
  };
  if (t.hub !== c.homeHub) exit(c.homeHub, true, paysFrom(w, c, t, c.homeHub));
  const near = w.net.hubs
    .map((_, i) => i)
    .filter((i) => i !== t.hub && i !== c.homeHub && hubMiles(w, t.hub, i) <= EXIT_WITHIN_MI)
    .sort((a, b) => hubMiles(w, t.hub, a) - hubMiles(w, t.hub, b) || a - b)
    .slice(0, EXIT_HUBS);
  for (const i of near) {
    const pays = paysFrom(w, c, t, i);
    if (pays > 0) exit(i, false, pays);
  }
  out.sort((a, b) => a.costFd - b.costFd || a.hub - b.hub);
  memo.at.set(key, out);
  return out;
}
