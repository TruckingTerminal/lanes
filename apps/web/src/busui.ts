import { busRide, busToTruckOn, heldFor, sendBlock, type Company, type Staff, type Truck, type World } from "@lanes/engine";
import { FIXES } from "./copy-fixes.js";
import { fdFull, weekday } from "./format.js";

/**
 * The bus to a truck on the page (labor.busToTruck; the director's sprint §19 and §20): who can ride to an empty seat, at
 * what fare and how long, and who's on the way. The engine's own checks and prices (labor.ts sendBlock, busRide); the page
 * offers only what they allow (R7).
 */

/** A rider's ride to a truck, as the button says it: the town they leave from, the time and the fare. */
export function rideWords(w: World, s: Staff, t: Truck): { from: string; time: string; fare: string; fareFd: number } {
  const r = busRide(w, s.lastHub!, t.hub);
  const from = s.lastPlace !== undefined ? w.net.places[s.lastPlace]!.name : w.net.hubs[s.lastHub!]!.name;
  return { from, time: FIXES.rideDays(r.arriveDays), fare: fdFull(r.fareFd), fareFd: r.fareFd };
}

/** §19: the trucks `s` can be sent to by bus now. */
export const sendTargets = (w: World, c: Company, s: Staff, trucks: Truck[]): Truck[] => (busToTruckOn(w) ? trucks.filter((t) => sendBlock(w, c, s, t) === null) : []);

/** §19, the empty truck's card: the nearest driver of the company who can ride to it, with the ride; null when none can. */
export function nearestRider(w: World, c: Company, t: Truck): { s: Staff; label: string } | null {
  if (!busToTruckOn(w)) return null;
  let best: { s: Staff; days: number } | null = null;
  for (const s of w.staffByCompany.get(c.id) ?? []) {
    if (sendBlock(w, c, s, t) !== null) continue;
    const days = busRide(w, s.lastHub!, t.hub).days;
    if (!best || days < best.days) best = { s, days };
  }
  if (!best) return null;
  const r = rideWords(w, best.s, t);
  return { s: best.s, label: FIXES.sendButton(best.s.owner ? null : best.s.name, r.from, r.time, r.fare) };
}

/** §19: the rider on the way to this truck's held seat, as the card says it; null when none. */
export function riderLine(w: World, t: Truck): string | null {
  const s = busToTruckOn(w) ? heldFor(w, t) : undefined;
  return s ? FIXES.riderOnWay(s.owner ? null : s.name, weekday(s.bus!.arriveDay)) : null;
}
