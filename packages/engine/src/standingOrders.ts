import { breakEvenPerMile, fuelPrice } from "./economics.js";
import { expectedReloadDeadheadMi } from "./freight.js";
import { vettingBlock } from "./fraud.js";
import { homeEdge } from "./home.js";
import { dispatchProfile, type DispatchProfile } from "./labor.js";
import type { Bid, Company, Load, StandingOrder, Truck } from "./types.js";
import { crewed, hubMiles, hubToll, type World } from "./world.js";

/** A solo truck makes a hot load's window only on falsified logs; a team makes it legally. */
export const canMakeHot = (c: Company, t: Truck) => t.coDriverId !== 0 || c.policy.hos !== "legal";

/** Would this load's tracking show the company's illegal hours? Dispatchers steer those trucks clear of it. */
export const trackingWouldShow = (c: Company, load: Load) => load.vet === 2 && (c.policy.hos === "always" || (c.policy.hos === "hot" && load.hot > 0));

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
export function scoreBid(w: World, ceiling: number, rate: number, reputation: number, deadheadMi: number, homeEdge = 0): number {
  const s = w.cfg.board.scoreWeights;
  if (!(ceiling > 0)) return -Infinity;
  return (
    s.price * ((ceiling - rate) / ceiling) +
    s.reputation * reputation +
    s.deadhead * (1 - deadheadMi / w.cfg.board.deadheadScaleMi) +
    homeEdge
  );
}

/**
 * Turns a company's standing orders into sealed bids for its idle trucks. This
 * is the only bidding path, used identically by humans' saved orders and bots.
 */
export function bidsFromStandingOrders(w: World, company: Company, idx: BoardIndex): Bid[] {
  const bidOrders = company.orders.filter((o): o is Extract<StandingOrder, { kind: "bid" }> => o.kind === "bid");
  if (bidOrders.length === 0 || company.authority.status !== "active") return [];
  const floor = company.orders.find((o): o is Extract<StandingOrder, { kind: "floor" }> => o.kind === "floor");
  const fuel = fuelPrice(w);
  const maxDh = Math.max(...bidOrders.map((o) => o.maxDeadheadMi));
  const out: Bid[] = [];
  const fleet = w.trucksByCompany.get(company.id)!;
  // The dispatch team (labor.ts): past its span some trucks sit out each round, and the less skilled it is the noisier its pricing.
  const team = dispatchProfile(w, company, fleet.filter((t) => t.status !== "parked" && t.status !== "listed").length);
  const allowed = [true, vettingBlock(w, company, { vet: 1 } as Load) === null, vettingBlock(w, company, { vet: 2 } as Load) === null];
  const rng = w.rng.dispatch;

  for (const truck of fleet) {
    if (truck.status !== "idle" || !crewed(truck)) continue;
    if (team.coverage < 1 && rng.next() >= team.coverage) continue;
    const candidates: { bid: Bid; profit: number }[] = [];
    let inRange = 0;
    for (const hub of w.net.nearby[truck.hub]!) {
      const dh = hubMiles(w, truck.hub, hub);
      if (dh > maxDh) break; // nearby is sorted nearest first
      const loads = idx.get(boardKey(hub, truck.trailer));
      if (!loads) continue;
      for (const load of loads) {
        if (load.brokerId === company.id || load.doubleBroker?.companyId === company.id) continue;
        if (!allowed[load.vet]) continue;
        if (load.hot > 0 && !canMakeHot(company, truck)) continue;
        if (trackingWouldShow(company, load)) continue;
        inRange++;
        const priced = priceLoad(w, truck, load, dh, fuel, bidOrders, floor, team);
        if (priced === null) continue;
        candidates.push({
          profit: (priced.rate - priced.breakEven) * load.miles,
          bid: {
            loadId: load.id,
            truckId: truck.id,
            companyId: company.id,
            rate: priced.rate,
            deadheadMi: dh,
            score: scoreBid(w, load.ceiling, priced.rate, company.reputation, dh, homeEdge(w, company, load.origin)),
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
  team: DispatchProfile,
): { rate: number; breakEven: number } | null {
  const hubId = w.net.hubs[load.origin]!.id;
  // Price in the empty run out of the destination, so a cheap load into a dead market isn't worth taking —
  // as much of it as this dispatcher knows to, and as far ahead on the season as they can see.
  const reloadMi = expectedReloadDeadheadMi(w, load.dest, load.equipment, team.foresightDays);
  // Tolls on the way to the pickup and on the lane itself are part of the cost of the load.
  const tolls = hubToll(w, truck.hub, load.origin) + w.net.lanes[load.laneId]!.tollFd;
  const trueBreakEven = breakEvenPerMile(w.cfg, truck, fuel, load.miles, dh + team.reloadWeight * reloadMi, tolls);
  // Their read of their own costs is off by a few percent, more for an inexperienced dispatcher.
  const z = (w.rng.dispatch.next() + w.rng.dispatch.next() + w.rng.dispatch.next() - 1.5) * 2;
  const breakEven = trueBreakEven * (1 + team.noise * z);
  for (const o of bidOrders) {
    if (o.equipment && !o.equipment.includes(load.equipment)) continue;
    if (o.originHubs && !o.originHubs.includes(hubId)) continue;
    if (dh > o.maxDeadheadMi) continue;
    if (o.minCeilingPerMile !== undefined && load.ceiling < o.minCeilingPerMile) continue;
    // A bid never exceeds the ceiling: a carrier asking more takes the load at the
    // ceiling, provided that still clears its floor.
    const ask = o.price.mode === "ceilingPct" ? load.ceiling * o.price.pct : breakEven * (1 + o.price.pct);
    const rate = Math.min(ask, load.ceiling);
    if (!(rate > 0)) continue; // nobody hauls for nothing
    if (floor && rate < breakEven * (1 + floor.breakEvenPlusPct)) continue;
    return { rate, breakEven };
  }
  return null;
}
