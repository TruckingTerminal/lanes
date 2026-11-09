/**
 * Delivery windows (item 4, batch 1: windows and loss). Config `windows`; engineering's proposal
 * (engineering-item4-delivery-windows.md), the director's calls (DECISIONS.md 2026-11-08) and the economy's sizes
 * (studio/reviews/economy-delivery-windows.md).
 *
 * - Posting (freight.ts): NPC and facility freight draws a lead from windows.leadDays (a contract tender is for now). The
 *   load is ready at its shipper's dock on the lead day, its pickup closes windows.pickupHours later, and it must be
 *   delivered within the legal transit and the commodity's window after that; a hot load's deadline is one only a team
 *   or more hours than one driver may legally run can make.
 * - The round (board.ts): unbooked when its pickup closes, a load is lost (giveUp: the broker's fall-off charge, NPC
 *   direct freight lost and counted, a player shipper's goods unsold), with no slide and no re-post. While more than
 *   windows.urgencyRounds rounds of slack remain its price holds; in those last rounds it walks (urgencyStep).
 * - The dispatcher's index (standingOrders.ts indexOpenLoads) files a load under its ready day: a round's work is the
 *   freight ready today, as before.
 *
 * Off, nothing here runs: windowsOn is read at posting, at the round, at the index and in the ratio, and every field it
 * sets is absent on a load posted while off, so those loads take today's path wherever they go.
 */
import { COMMODITIES } from "@lanes/data";
import type { EconomyConfig } from "@lanes/config";
import { dayOf } from "./clock.js";
import { dockHoursAt, dockRule, nextOpen } from "./docks.js";
import type { Load } from "./types.js";
import type { World } from "./world.js";

/** windows.enabled; a config without the key (an older profile) reads as off. */
export const windowsOn = (w: World): boolean => w.cfg.windows?.enabled === true;

/** Minutes for `hours` of driving at `perDay` driving hours a day, with the rest between duty days (freight.ts, board.ts). */
export function transitMinutes(cfg: EconomyConfig, hours: number, perDay: number): number {
  const fullDays = Math.max(0, Math.ceil(hours / perDay) - 1);
  return (fullDays * cfg.hos.dutyDayHours + (hours - fullDays * perDay)) * 60;
}

/** A lead in days from windows.leadDays: a bucket by weight, then a day inside it. Draws only from w.rng.windows. */
export function drawLeadDays(w: World): number {
  const buckets = w.cfg.windows!.leadDays;
  const rng = w.rng.windows;
  const [from, to] = buckets[rng.weighted(buckets.map((b) => b[2]))]!;
  return to > from ? rng.int(from, to) : from;
}

/** When a load posted now with this lead is ready: the posting time plus the lead, at the shipper's dock's next opening. */
export function readyAt(w: World, load: Load, leadDays: number): number {
  const t = w.t + leadDays * w.cfg.time.gameMinutesPerDay;
  const hours = w.cfg.docks.enabled ? dockHoursAt(w, load, "pickup") : null;
  return hours ? nextOpen(w, t, hours) : t;
}

/** Sets a just-posted load's window. Its appointment moves with the ready time and sits inside the window. */
export function openWindow(w: World, load: Load, leadDays: number): void {
  const { cfg } = w;
  const k = cfg.windows!;
  const readyT = readyAt(w, load, leadDays);
  const latestPickupT = readyT + (dockRule(w, load) === "appointment" ? k.pickupHours.appointment : k.pickupHours.firstCome) * 60;
  const legal = transitMinutes(cfg, load.routeHours, cfg.hos.drivingHoursPerDay);
  const windowMin = COMMODITIES[load.commodity]!.windowHours * 60;
  let latestDeliveryT = latestPickupT + legal + windowMin;
  if (load.hot > 0) {
    // The director's call 4: a hot load keeps its draw, and its deadline is today's hot rule (safety.hotLoads, the due time
    // at booking: the hot pace, the dock time and the slack) counted from the moment it's ready, a window meant for a team
    // or a driver over the legal hours.
    const hl = cfg.safety.hotLoads;
    const ops = cfg.equipmentOps;
    const dwell = cfg.dwell.loadMinutes[1] + cfg.dwell.unloadMinutes[1] + (ops.enabled && load.equipment === "flatbed" ? ops.flatbedSecureMinutes[1] + ops.flatbedUntarpMinutes[1] : 0);
    latestDeliveryT = readyT + transitMinutes(cfg, load.routeHours, hl.hoursPerDay) + dwell + hl.slackMinutes;
  }
  load.readyT = readyT;
  load.latestPickupT = latestPickupT;
  load.latestDeliveryT = latestDeliveryT;
  load.appointmentT = Math.min(readyT + windowMin + legal, latestDeliveryT);
}

/** True when a load counts in today's work: no window, windows off, or ready by today's end. */
export function readyToday(w: World, load: Load): boolean {
  return load.readyT === undefined || !windowsOn(w) || dayOf(load.readyT, w.cfg) <= dayOf(w.t, w.cfg);
}

/** True when the load's pickup has closed (windows on): it can no longer be booked, and the next round loses it. */
export const pickupClosed = (w: World, load: Load): boolean => load.latestPickupT !== undefined && windowsOn(w) && w.t >= load.latestPickupT;

/** Who posted a load, for the lost-freight metrics: an NPC shipper direct, an AI broker, a player's brokerage, a facility. */
export type PosterKind = "npc" | "broker" | "brokerage" | "shipper";
export const POSTER_KINDS: readonly PosterKind[] = ["npc", "broker", "brokerage", "shipper"];

/** A player poster: a person's company or a player's brokerage (brokerage.ts): its pay never walks (QA's S4). */
function byPlayer(w: World, id: number | null): boolean {
  const c = id !== null ? w.companies[id - 1] : undefined;
  return c !== undefined && (c.human || c.partnerId !== undefined);
}

export function posterKind(w: World, load: Load): PosterKind {
  if (load.shipperId !== null) return "shipper";
  if (load.brokerId === null) return "npc";
  return byPlayer(w, load.brokerId) ? "brokerage" : "broker";
}

/** Minutes between board rounds. */
const roundMinutes = (w: World): number => w.cfg.time.gameMinutesPerDay / w.cfg.time.boardRoundHours.length;

/** In its last rounds: no more than windows.urgencyRounds rounds of slack before the pickup closes. */
export function urgent(w: World, load: Load): boolean {
  return load.latestPickupT !== undefined && load.latestPickupT - w.t <= w.cfg.windows!.urgencyRounds * roundMinutes(w);
}

/**
 * One round of the urgency walk (the director's call 3): the ceiling steps as a rollover's does (`raiseCeiling`, board.ts:
 * an NPC shipper raises it, a broker eats it up to its fall-off reach) and book-now walks from where it opened to the
 * ceiling over windows.urgencyRounds steps (R11's walk), never above it. At most that many steps; a player poster's pay
 * never walks. The appointment never moves. True when the price moved.
 */
export function urgencyStep(w: World, load: Load, raiseCeiling: (w: World, load: Load) => void): boolean {
  const k = w.cfg.windows!;
  const steps = load.urgentSteps ?? 0;
  if (steps >= k.urgencyRounds) return false;
  load.urgentSteps = steps + 1;
  if (byPlayer(w, load.shipperId ?? load.brokerId)) return false;
  raiseCeiling(w, load);
  const open = (load.bookNowOpen ??= load.bookNow);
  load.bookNow = Math.min(load.ceiling, open + (load.ceiling - open) * Math.min(1, load.urgentSteps / k.urgencyRounds));
  return true;
}
