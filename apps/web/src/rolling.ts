import { drivingLimitMin, fuelPrice, legRoute, legMile, mphFor, planNight, tripCost, type Company, type Load, type Truck, type World } from "@lanes/engine";

/**
 * A truck on the road, as the Truck tab shows it (specs/first-ten-minutes.md, S6–S7), read without touching the
 * world: the client must never change what it reads, or the live world forks between pages.
 */

const MIN_PER_HOUR = 60;

/**
 * Driving minutes left in the truck's duty day. The engine's drivingMinutesLeft (trips.ts) also opens the next duty
 * day when the last one has run out, which writes to the truck, so the screen reads this copy of its arithmetic.
 */
export function drivingLeftMin(w: World, t: Truck, c: Company): number {
  const limit = drivingLimitMin(w, t, c);
  const expired = t.shiftStartT === null || w.t >= t.shiftStartT + w.cfg.hos.dutyDayHours * MIN_PER_HOUR;
  return Math.max(0, expired ? limit : limit - t.shiftDrivenMin);
}

/** The road's pace for this truck on its leg (the route's miles over its hours, then the driver and the speed policy). */
function legMph(w: World, t: Truck, c: Company): number {
  const r = legRoute(w, t);
  return mphFor(w, t, c, r && r.hours > 0 ? r.miles / r.hours : w.cfg.hos.avgMph);
}

/**
 * When the truck should reach the end of its leg: the miles left at its pace, with a night off for every day of
 * driving the hours don't cover. A forecast: the grades, the docks and the weather can move it.
 */
export function etaMin(w: World, t: Truck, c: Company): number {
  const mph = legMph(w, t, c);
  if (mph <= 0) return w.t;
  let left = (t.remainingMi / mph) * MIN_PER_HOUR;
  let at = w.t;
  let today = drivingLeftMin(w, t, c);
  const full = drivingLimitMin(w, t, c);
  const off = (24 - w.cfg.hos.drivingHoursPerDay) * MIN_PER_HOUR;
  while (left > today + 1e-6) {
    at += today + off;
    left -= today;
    today = full;
  }
  return at + left;
}

/** Where tonight's stop is planned, or null when the leg ends within today's hours. */
export type NightStop = { kind: "site"; siteId: number; lat: number; lon: number } | { kind: "shoulder" } | null;

/**
 * Tonight's planned stop (engineering's answer to the spec's question, read-only): the engine's own planNight
 * (sites.ts), asked with the whole of today's reach, names the last site with room the hours still reach. None in
 * reach means the shoulder. It is "planned": sites fill and the pace changes.
 */
export function nightStop(w: World, t: Truck, c: Company): NightStop {
  if (t.status !== "loaded" && t.status !== "toPickup" && t.status !== "repositioning") return null;
  const route = legRoute(w, t);
  if (!route) return null;
  const reach = (drivingLeftMin(w, t, c) / MIN_PER_HOUR) * legMph(w, t, c);
  if (t.remainingMi <= reach + 1e-9) return null;
  const mile = planNight(w, t, route, legMile(t), reach, reach);
  if (mile === null) return w.cfg.businesses.enabled ? { kind: "shoulder" } : null;
  let best: { id: number; lat: number; lon: number; d: number } | null = null;
  for (const s of w.sites) {
    // The site at that mile of the route: the one the planner chose, found by its place along the leg.
    const d = Math.abs(siteMile(w, route, s.id) - mile);
    if (d < (best?.d ?? 2)) best = { id: s.id, lat: s.lat, lon: s.lon, d };
  }
  return best ? { kind: "site", siteId: best.id, lat: best.lat, lon: best.lon } : { kind: "shoulder" };
}
function siteMile(w: World, route: NonNullable<ReturnType<typeof legRoute>>, siteId: number): number {
  const s = w.sites[siteId - 1]!;
  for (let i = 0; i < route.edges.length; i++) {
    const signed = route.edges[i]!;
    if ((signed >= 0 ? signed : -signed - 1) !== s.edge) continue;
    const { e, forward } = w.net.roads.edgeOf(signed);
    return route.cum[i]! + (forward ? s.frac : 1 - s.frac) * e.miles;
  }
  return Infinity;
}

/** The nearest named place to a point, for "near Amarillo". */
export function nearestPlace(w: World, lat: number, lon: number): string {
  let best = "";
  let bd = Infinity;
  for (const p of w.net.places) {
    const d = (p.lat - lat) ** 2 + ((p.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bd) {
      bd = d;
      best = p.name;
    }
  }
  return best;
}

/** What the truck looked like on the screen's last look before a delivery: its empty miles on the trip and its deposit. */
export interface TruckBefore {
  emptyMi: number;
  depositFd: number;
}

export interface PayLine {
  load: number;
  fuel: number;
  tolls: number;
  driver: number;
  upkeep: number;
  lessor: number;
  held: number;
  yours: number;
}

/**
 * S7's pay line, one row each, summing to what reached the company. The paid amount, the lessor's share and the
 * deposit held are exact; the trip's cost is the engine's total, split into fuel, tolls, the driver's pay and upkeep
 * in the proportions of the same trip arithmetic the break-even uses (economics.ts tripCost), so the card and the chip
 * tell one story.
 */
export function payLine(w: World, t: Truck, load: Load, grossFd: number, costFd: number, before: TruckBefore): PayLine {
  const leased = t.lease !== "owned";
  const lessor = leased ? grossFd * w.cfg.costs.npcLeaseShareOfGross : 0;
  const held = Math.max(0, (t.depositFd ?? 0) - before.depositFd);
  const trip = Math.max(0, costFd - lessor);
  const fuel = fuelPrice(w);
  const c = tripCost(w.cfg, t, fuel, before.emptyMi + load.miles, load.miles);
  const tr = w.cfg.roads.terrain;
  const lane = w.net.lanes[load.laneId];
  const climb = tr.enabled && lane ? tr.fuelGalPerClimbM * lane.climbM * fuel : 0;
  const parts = { fuel: c.fuel + climb, tolls: load.routeTollFd, driver: c.wages, upkeep: c.maintenance };
  const sum = parts.fuel + parts.tolls + parts.driver + parts.upkeep;
  const k = sum > 0 ? trip / sum : 0;
  return {
    load: grossFd,
    fuel: parts.fuel * k,
    tolls: parts.tolls * k,
    driver: parts.driver * k,
    upkeep: parts.upkeep * k,
    lessor,
    held,
    yours: grossFd - costFd - held,
  };
}
