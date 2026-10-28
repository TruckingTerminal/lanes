import { clamp } from "./economics.js";
import { companyAccount } from "./ledger.js";
import type { Company } from "./types.js";
import { hubMiles, type World } from "./world.js";

/**
 * Home markets (design proposal, Jeff 2026-10-28). Where a carrier is based is a
 * supply-and-demand choice: each starter hub's crowding is the carriers based
 * there against its fair share by freight volume. Local shippers favor carriers
 * with a yard nearby, an edge diluted by crowding; and a home base costs yard
 * rent per truck, dearer in big metros and dearer again when crowded.
 */

/**
 * Carriers based at each hub ÷ its fair share of all carriers by freight volume
 * (1 = fair; starter hubs only, others 1), as last computed by the engine. Never
 * computed on demand: a query function must not cache mutable world state, or a
 * client that happens to ask earlier in the day replays differently.
 */
export const homeCrowding = (w: World): Float64Array => w.homeCrowding;

/** Recomputes crowding. Called at fixed points of the simulation (each board round, the weekly yard bill). */
export function updateHomeCrowding(w: World): void {
  const n = w.net.hubs.length;
  const counts = new Float64Array(n);
  let total = 0;
  for (const c of w.companies) {
    if (c.role !== "carrier" || c.authority.status === "revoked") continue;
    counts[c.homeHub]!++;
    total++;
  }
  const starters = w.net.starterIdx;
  const weight = starters.reduce((s, i) => s + w.net.hubs[i]!.weight, 0);
  const crowding = new Float64Array(n).fill(1);
  for (const i of starters) {
    const fair = (total * w.net.hubs[i]!.weight) / weight;
    crowding[i] = counts[i]! / Math.max(1, fair);
  }
  w.homeCrowding = crowding;
}

/** The bid-score edge on a load from near this carrier's home hub, larger the fewer carriers share that home. */
export function homeEdge(w: World, c: Company, originHub: number): number {
  const k = w.cfg.homeBase;
  if (hubMiles(w, c.homeHub, originHub) > w.cfg.map.nearbyRadiusMi) return 0;
  const r = homeCrowding(w)[c.homeHub]!;
  return k.preference * clamp(1 / Math.max(0.01, r), k.preferenceClamp[0], k.preferenceClamp[1]);
}

/** Weekly yard and terminal rent per truck at this company's home hub. */
export function yardPerTruck(w: World, c: Company): number {
  const k = w.cfg.homeBase;
  const metro = k.yardTier[0] + k.yardTier[1] * w.net.hubs[c.homeHub]!.weight;
  return k.yardPerTruckWeek * metro * clamp(homeCrowding(w)[c.homeHub]!, k.yardCrowdClamp[0], k.yardCrowdClamp[1]);
}

/** Weekly: every company pays yard rent for each truck it keeps past its first (parked and listed ones too: they still need a spot). */
export function chargeYards(w: World): void {
  updateHomeCrowding(w);
  for (const c of w.companies) {
    let trucks = -1;
    for (const t of w.trucksByCompany.get(c.id) ?? []) if (t.status !== "retired") trucks++;
    if (trucks <= 0) continue;
    const rent = trucks * yardPerTruck(w, c);
    w.ledger.post(w.t, companyAccount(c.id), "sink:yard", rent, `yard:${c.id}`);
    c.operating.costFd += rent;
  }
}
