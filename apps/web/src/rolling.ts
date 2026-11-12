import { dcos, greatCircleMiles } from "@lanes/data";
import { drivingLimitMin, dutyResetAt, fuelPrice, hubMiles, hubToll, legRoute, legMile, mphFor, placeHours, placeLegMiles, placeOfHub, placeToll, planNight, tripCost, truckLatLon, type Company, type Load, type Receivable, type Truck, type World, ownerDrawFd } from "@lanes/engine";
import { DELIVERED, MOVE } from "./copy.js";
import { shortDate } from "./format.js";

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
  const reset = dutyResetAt(w, t);
  const expired = reset === null || w.t >= reset;
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
  return drive(w, t, c, w.t + (t.pauseMin ?? 0), drivingLeftMin(w, t, c), (t.remainingMi / mph) * MIN_PER_HOUR, mph)[0];
}

/**
 * From `at`, with `today` driving minutes left in the duty day, `left` minutes of driving at `mph`: when it ends, and
 * what's left of that day. R12's stops count, as the engine runs them: the rest between days (hos.restHours, or the rest
 * of the 24 hours), a break in each long day, and a fuel stop every fuel.stopEveryMi.
 */
function drive(w: World, t: Truck, c: Company, at: number, today: number, left: number, mph = w.cfg.hos.avgMph): [number, number] {
  const { hos, fuel } = w.cfg;
  const full = drivingLimitMin(w, t, c);
  const off = hos.restHours > 0 ? hos.restHours * MIN_PER_HOUR : (24 - hos.drivingHoursPerDay) * MIN_PER_HOUR;
  const breakAfter = hos.breakAfterHours * MIN_PER_HOUR;
  const pauses = (drivenToday: number, driven: number) =>
    (hos.breakMinutes > 0 && drivenToday > breakAfter ? hos.breakMinutes : 0) + (fuel.stopEveryMi > 0 ? Math.floor(((driven / MIN_PER_HOUR) * mph) / fuel.stopEveryMi) * fuel.stopMinutes : 0);
  while (left > today + 1e-6) {
    at += today + pauses(today, today) + off;
    left -= today;
    today = full;
  }
  return [at + left + pauses(full - today + left, left), today - left];
}

/**
 * When the load should reach its delivery, whatever the truck is doing now (QA row 18: one ETA, the board's busy line
 * and the Truck card alike): rolling, the leg's ETA; on its way to the pickup, that ETA, the dock's average loading time,
 * then the loaded miles at the same pace and nights; loading, the dock time left, then the same; unloading, now.
 */
export function deliveryEtaMin(w: World, t: Truck, c: Company, l: Load): number {
  if (t.status === "loaded") return etaMin(w, t, c);
  if (t.status === "unloading") return w.t;
  const [lo, hi] = w.cfg.dwell.loadMinutes;
  const dwell = (lo + hi) / 2;
  const mph = mphFor(w, t, c, w.cfg.hos.avgMph);
  const loadedMin = mph > 0 ? (l.miles / mph) * MIN_PER_HOUR : 0;
  if (t.status === "toPickup") {
    const legMphNow = legMph(w, t, c);
    const [atPickup, todayLeft] = legMphNow > 0 ? drive(w, t, c, w.t, drivingLeftMin(w, t, c), (t.remainingMi / legMphNow) * MIN_PER_HOUR) : [w.t, drivingLeftMin(w, t, c)];
    return drive(w, t, c, atPickup + dwell, todayLeft, loadedMin)[0];
  }
  return drive(w, t, c, w.t + (t.status === "loading" ? t.dwellMin : dwell), drivingLeftMin(w, t, c), loadedMin)[0];
}

/** Where tonight's stop is planned, or null when the leg ends within today's hours. */
export type NightStop = { kind: "site"; siteId: number; lat: number; lon: number } | { kind: "town"; place: number } | { kind: "shoulder" } | null;

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
  if (mile === null) {
    // businesses.parking.stopInTown with "town" chosen (trips.ts moveTrucks): at a leg's start with less than a full day's
    // hours and no site with room in reach, the truck sleeps in the town it stands in (client batch 4: else the shoulder
    // line is false while the switch is on). Midway along a leg it can only reach the shoulder, as before.
    const k = w.cfg.businesses;
    const inTown = k.enabled && k.parking.stopInTown && c.nightStop === "town" && (t.townNight === true || (legMile(t) <= 1e-6 && drivingLeftMin(w, t, c) < drivingLimitMin(w, t, c) - 1e-6));
    if (inTown) return { kind: "town", place: t.place };
    return k.enabled ? { kind: "shoulder" } : null;
  }
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
  /** The owner's draw the company kept on this load (Jeff, 2026-11-04), inside `yours`. */
  draw: number;
  /** Detention the poster paid with the load (cfg.detention), and its hours at each stop; inside `yours`. */
  detention: number;
  detentionAt: { pickupH: number; deliveryH: number };
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
  // The owner's draw stays with the company (ownerDrawFd): the engine's cost leaves it out, so the split does too, and "yours" carries it.
  const draw = Math.min(c.wages, ownerDrawFd(w, t, before.emptyMi + load.miles));
  const parts = { fuel: c.fuel + climb, tolls: load.routeTollFd, driver: c.wages - draw, upkeep: c.maintenance };
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
    draw,
    detention: load.detention?.fd ?? 0,
    detentionAt: { pickupH: load.detention?.pickupH ?? 0, deliveryH: load.detention?.deliveryH ?? 0 },
    yours: grossFd - costFd - held + (load.detention?.fd ?? 0),
  };
}

/**
 * How a delivered load is paid, from the settlement's true terms (diary 2, row 7): the lessor on delivery; quick pay today
 * less its fee; the factor today less its rate; else the invoice's due day. `fresh` is the invoice this delivery raised.
 */
export function paidLine(w: World, c: Company, truck: Truck, fresh: Receivable | undefined): string {
  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
  if (truck.lease === "npc" || (!fresh && c.payTerms !== "quick")) return DELIVERED.paidToday;
  if (!fresh) return DELIVERED.paidQuick(pct(w.cfg.token.payment.quickPayPct));
  if (fresh.holder !== c.id) return DELIVERED.paidFactor(pct(c.factoring?.rate ?? w.cfg.token.payment.factoring.discountNpc));
  return DELIVERED.due(shortDate(fresh.dueDay));
}

/**
 * An empty run's price before the tap (R24): fuel and the driver's pay over the empty miles, from the same parts as
 * break-even (economics.ts tripCost), plus the tolls; and its time at the nominal pace and the day's driving hours.
 */
/**
 * Where a truck running empty would turn from, read without moving it (trips.ts turnTruck, the same arithmetic): the town
 * nearest its point on the leg (risk.ts truckLatLon), and the road miles to that town (the great circle × 1.2).
 */
export function turnPoint(w: World, t: Truck): { place: number; offMi: number } {
  const [lat, lon] = truckLatLon(w, t);
  let best = t.place;
  let bd = Infinity;
  const cosLat = dcos((lat * Math.PI) / 180);
  w.net.places.forEach((p, i) => {
    const dy = p.lat - lat;
    const dx = (p.lon - lon) * cosLat;
    const d = dy * dy + dx * dx;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return { place: best, offMi: Math.round(greatCircleMiles({ lat, lon }, w.net.places[best]!) * 1.2) };
}

export function emptyRun(w: World, t: Truck, fromHub: number, toHub: number): { mi: string; fd: string; time: string; costFd: number; parts: { fuel: number; wages: number; tolls: number } } {
  // From where the truck stands, the run the engine drives (reposition_truck, send_home: placeLegMiles from the truck's
  // town to the hub's): the diaries' Send home said 894 mi and drove 956 when it priced hub to hub.
  const here = fromHub === t.hub;
  // QA's 0.24.1 replay, item 8: a truck running empty turns from its point on the leg (labor.turnWhileEmpty, trips.ts
  // turnTruck), so it's priced from the town nearest that point plus the miles to it, never from where the run began.
  const turn = here && t.status === "repositioning" && w.cfg.labor.turnWhileEmpty ? turnPoint(w, t) : null;
  const from = turn ? turn.place : t.place;
  const off = turn ? turn.offMi : 0;
  const to = placeOfHub(toHub);
  const mi = here ? placeLegMiles(w, from, to) + off : hubMiles(w, fromHub, toHub);
  const run = tripCost(w.cfg, t, fuelPrice(w), mi, 0);
  const hours = here && from !== to ? placeHours(w, from, to) + off / w.cfg.hos.avgMph : mi / w.cfg.hos.avgMph;
  const days = hours / w.cfg.hos.drivingHoursPerDay;
  const parts = { fuel: run.fuel, wages: run.wages, tolls: here ? placeToll(w, from, to) : hubToll(w, fromHub, toHub) };
  const costFd = parts.fuel + parts.wages + parts.tolls;
  return {
    costFd,
    parts,
    mi: Math.round(mi).toLocaleString("en-US"),
    fd: Math.round(costFd).toLocaleString("en-US"),
    time: MOVE.time(days < 1 ? 0 : Math.ceil(days), Math.max(1, Math.ceil(hours))),
  };
}
