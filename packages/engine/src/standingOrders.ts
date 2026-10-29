import { mayTake } from "./contracts.js";
import { dayOf, MINUTES_PER_HOUR } from "./clock.js";
import { breakEvenPerMile, fuelPrice } from "./economics.js";
import { expectedReloadDeadheadMi } from "./freight.js";
import { vettingBlock } from "./fraud.js";
import { homeEdge } from "./home.js";
import { dispatchProfile, type DispatchProfile } from "./labor.js";
import type { Bid, Company, Load, StandingOrder, Truck } from "./types.js";
import { crewed, hubMiles, hubToll, type World, placeMiles, placeToll } from "./world.js";

/** A solo truck makes a hot load's window only on falsified logs; a team makes it legally. */
export const canMakeHot = (c: Company, t: Truck) => t.coDriverId !== 0 || c.policy.hos !== "legal";

/** Would this load's tracking show the company's illegal hours? Dispatchers steer those trucks clear of it. */
export const trackingWouldShow = (c: Company, load: Load) => load.vet === 2 && (c.policy.hos === "always" || (c.policy.hos === "hot" && load.hot > 0));

/** A driver on home time (labor.ts): the dispatcher leaves the truck alone until it's over. */
export function resting(w: World, t: Truck): boolean {
  if (!t.driverId) return false;
  const d = w.staff[t.driverId - 1]!;
  return d.homeUntilDay !== null && d.homeUntilDay > dayOf(w.t, w.cfg);
}

/** The truck's driver is due home: a send-home order, or the home-time rule's days out are up. */
export function needsHome(w: World, c: Company, t: Truck): boolean {
  if (!t.driverId) return false;
  const d = w.staff[t.driverId - 1]!;
  if (d.wantsHome) return true;
  const hm = c.orders.find((o): o is Extract<StandingOrder, { kind: "homeTime" }> => o.kind === "homeTime");
  return hm !== undefined && d.awayDays >= hm.afterDays;
}

/** A load that brings a truck due home closer: delivers within the home radius, or well on the way. */
export function homeward(w: World, c: Company, t: Truck, load: Load): boolean {
  const toHome = hubMiles(w, load.dest, c.homeHub);
  return toHome <= w.cfg.map.nearbyRadiusMi || toHome <= hubMiles(w, t.hub, c.homeHub) - w.cfg.fatigue.homeward.closerByMi;
}

/**
 * How badly this truck needs to move, 0 (content) to 1 (take anything that covers
 * costs): idle time, and a driver's days from home. Sitting at home is half as pressing.
 */
export function desperation(w: World, c: Company, t: Truck): number {
  const k = w.cfg.bookNow.desperation;
  const idle = Math.min(1, Math.max(0, w.t - t.idleSinceT) / MINUTES_PER_HOUR / k.idleHours);
  const d = t.driverId ? w.staff[t.driverId - 1]! : null;
  const away = d ? Math.min(1, Math.max(0, d.awayDays - k.awayAfterDays) / k.awayDays) : 0;
  const atHome = hubMiles(w, c.homeHub, t.hub) <= w.cfg.map.nearbyRadiusMi;
  return Math.max(idle, away) * (atHome ? k.atHomeMult : 1);
}

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

/**
 * Bid score (§Load board — bid scoring), poster defaults. A counter above the ceiling
 * ranks below every offer within it (the poster pays over its max only when it has to),
 * and among those the cheapest first.
 */
export function scoreBid(w: World, ceiling: number, rate: number, reputation: number, deadheadMi: number, homeEdge = 0): number {
  const s = w.cfg.board.scoreWeights;
  if (!(ceiling > 0)) return -Infinity;
  return (
    (rate > ceiling ? -10 : 0) +
    s.price * ((ceiling - rate) / ceiling) +
    s.reputation * reputation +
    s.deadhead * (1 - deadheadMi / w.cfg.board.deadheadScaleMi) +
    homeEdge
  );
}

/** The most a poster will pay in the round: its ceiling, or in a pinch overCeilingMax × that. */
export const hardCap = (w: World, load: Load) => load.ceiling * w.cfg.board.overCeilingMax;

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
    if (truck.status !== "idle" || !crewed(truck) || resting(w, truck)) continue;
    if (team.coverage < 1 && rng.next() >= team.coverage) continue;
    const goHome = needsHome(w, company, truck);
    const candidates: { bid: Bid; profit: number }[] = [];
    let inRange = 0;
    for (const hub of w.net.nearby[truck.hub]!) {
      if (hubMiles(w, truck.hub, hub) > maxDh + w.cfg.commodities.placeSlackMi) break; // nearby is sorted nearest first
      const loads = idx.get(boardKey(hub, truck.trailer));
      if (!loads) continue;
      for (const load of loads) {
        const dh = placeMiles(w, truck.place, load.originPlace);
        if (dh > maxDh) continue;
        if (!mayTake(w, company, load)) continue;
        if (load.brokerId === company.id || load.doubleBroker?.companyId === company.id) continue;
        if (!allowed[load.vet]) continue;
        if (load.hot > 0 && !canMakeHot(company, truck)) continue;
        if (trackingWouldShow(company, load)) continue;
        if (goHome && !homeward(w, company, truck, load)) continue; // due home: only loads that head that way
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

/** A dispatch team's read of a load's break-even for this truck: the true figure, off by their noise. */
export function estimateBreakEven(w: World, truck: Truck, load: Load, dh: number, fuel: number, team: DispatchProfile): number {
  // Price in the empty run out of the destination, so a cheap load into a dead market isn't worth taking —
  // as much of it as this dispatcher knows to, and as far ahead on the season as they can see.
  const reloadMi = expectedReloadDeadheadMi(w, load.dest, load.equipment, team.foresightDays);
  // Tolls on the way to the pickup and on the load's own route are part of the cost of the load.
  const tolls = placeToll(w, truck.place, load.originPlace) + load.routeTollFd;
  const trueBreakEven = breakEvenPerMile(w.cfg, truck, fuel, load.miles, dh + team.reloadWeight * reloadMi, tolls);
  // Their read of their own costs is off by a few percent, more for an inexperienced dispatcher.
  const z = (w.rng.dispatch.next() + w.rng.dispatch.next() + w.rng.dispatch.next() - 1.5) * 2;
  return trueBreakEven * (1 + team.noise * z);
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
  const breakEven = estimateBreakEven(w, truck, load, dh, fuel, team);
  for (const o of bidOrders) {
    if (o.equipment && !o.equipment.includes(load.equipment)) continue;
    if (o.originHubs && !o.originHubs.includes(hubId)) continue;
    if (dh > o.maxDeadheadMi) continue;
    if (o.minCeilingPerMile !== undefined && load.ceiling < o.minCeilingPerMile) continue;
    // A counter: above the book-now (else the dispatcher just books), up to the ceiling,
    // or past it when the market is that hot — taken only if nobody offers within.
    const ask = o.price.mode === "ceilingPct" ? load.ceiling * o.price.pct : breakEven * (1 + o.price.pct);
    const rate = Math.min(ask, hardCap(w, load));
    if (!(rate > 0)) continue; // nobody hauls for nothing
    if (floor && rate < breakEven * (1 + floor.breakEvenPlusPct)) continue;
    return { rate, breakEven };
  }
  return null;
}
