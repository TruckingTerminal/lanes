import { breakEvenPerMile, fuelPrice } from "./economics.js";
import type { Bid, Company, Load, StandingOrder, Truck } from "./types.js";
import { hubMiles, type World } from "./world.js";

/** Open loads indexed by origin hub and equipment, rebuilt each round. */
export type BoardIndex = Map<string, Load[]>;

export const boardKey = (hub: number, eq: string) => `${hub}|${eq}`;

export function indexOpenLoads(w: World): BoardIndex {
  const idx: BoardIndex = new Map();
  for (const load of w.loads.values()) {
    if (load.status !== "open") continue;
    const key = boardKey(load.origin, load.equipment);
    let list = idx.get(key);
    if (!list) idx.set(key, (list = []));
    list.push(load);
  }
  return idx;
}

/** Bid score (§Load board — bid scoring), poster defaults. */
export function scoreBid(w: World, ceiling: number, rate: number, reputation: number, deadheadMi: number): number {
  const s = w.cfg.board.scoreWeights;
  return (
    s.price * ((ceiling - rate) / ceiling) +
    s.reputation * reputation +
    s.deadhead * (1 - deadheadMi / w.cfg.board.deadheadScaleMi)
  );
}

/**
 * Turns a company's standing orders into sealed bids for its idle trucks. This
 * is the only bidding path, used identically by humans' saved orders and bots.
 */
export function bidsFromStandingOrders(w: World, company: Company, idx: BoardIndex): Bid[] {
  const bidOrders = company.orders.filter((o): o is Extract<StandingOrder, { kind: "bid" }> => o.kind === "bid");
  if (bidOrders.length === 0) return [];
  const floor = company.orders.find((o): o is Extract<StandingOrder, { kind: "floor" }> => o.kind === "floor");
  const fuel = fuelPrice(w);
  const maxDh = Math.max(...bidOrders.map((o) => o.maxDeadheadMi));
  const out: Bid[] = [];

  for (const truck of w.trucksByCompany.get(company.id)!) {
    if (truck.status !== "idle") continue;
    const candidates: { bid: Bid; profit: number }[] = [];
    let inRange = 0;
    for (const hub of w.net.nearby[truck.hub]!) {
      const dh = hubMiles(w, truck.hub, hub);
      if (dh > maxDh) break; // nearby is sorted nearest first
      const loads = idx.get(boardKey(hub, truck.trailer));
      if (!loads) continue;
      for (const load of loads) {
        if (load.brokerId === company.id) continue;
        inRange++;
        const priced = priceLoad(w, truck, load, dh, fuel, bidOrders, floor);
        if (priced === null) continue;
        candidates.push({
          profit: (priced.rate - priced.breakEven) * load.miles,
          bid: {
            loadId: load.id,
            truckId: truck.id,
            companyId: company.id,
            rate: priced.rate,
            deadheadMi: dh,
            score: scoreBid(w, load.ceiling, priced.rate, company.reputation, dh),
            tiebreak: 0,
          },
        });
      }
    }
    // Freight was there but none of it paid enough: this truck isn't supply at today's rates.
    if (inRange > 0 && candidates.length === 0) truck.pricedOutRound = w.round;
    candidates.sort((a, b) => b.profit - a.profit || a.bid.loadId - b.bid.loadId);
    for (const c of candidates.slice(0, w.cfg.board.maxBidsPerTruckPerRound)) out.push(c.bid);
  }
  return out;
}

function priceLoad(
  w: World,
  truck: Truck,
  load: Load,
  dh: number,
  fuel: number,
  bidOrders: Extract<StandingOrder, { kind: "bid" }>[],
  floor: Extract<StandingOrder, { kind: "floor" }> | undefined,
): { rate: number; breakEven: number } | null {
  const hubId = w.net.hubs[load.origin]!.id;
  const breakEven = breakEvenPerMile(w.cfg, truck, fuel, load.miles, dh);
  for (const o of bidOrders) {
    if (o.equipment && !o.equipment.includes(load.equipment)) continue;
    if (o.originHubs && !o.originHubs.includes(hubId)) continue;
    if (dh > o.maxDeadheadMi) continue;
    if (o.minCeilingPerMile !== undefined && load.ceiling < o.minCeilingPerMile) continue;
    // A bid never exceeds the ceiling: a carrier asking more takes the load at the
    // ceiling, provided that still clears its floor.
    const ask = o.price.mode === "ceilingPct" ? load.ceiling * o.price.pct : breakEven * (1 + o.price.pct);
    const rate = Math.min(ask, load.ceiling);
    if (floor && rate < breakEven * (1 + floor.breakEvenPlusPct)) continue;
    return { rate, breakEven };
  }
  return null;
}
