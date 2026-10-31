/**
 * Receiving and shipping hours (Jeff, 2026-10-30): appointment freight (cold chain, and the dry food
 * that goes to the same distribution centers) by slot at any hour; first come, first served in weekday
 * business hours; flatbed in daylight. A truck that arrives early for its slot, at a closed dock, or
 * past its slot waits at the gate. Config `docks`.
 *
 * Dry van (Jeff, 2026-10-31): the bigger first-come docks run around the clock, the rest keep weekday
 * business hours, 7am to 7pm (aroundTheClock below).
 */
import { COMMODITIES, COMMODITY_COUNT, type Economy } from "@lanes/data";
import type { Load } from "./types.js";
import type { World } from "./world.js";

export type DockRule = "appointment" | "fcfs" | "daylight";
export interface DockHours {
  open: number;
  close: number;
  days: readonly number[];
}

export function dockRule(w: World, load: Load): DockRule {
  const k = w.cfg.docks;
  const id = COMMODITIES[load.commodity]?.id;
  if (id && k.appointmentCommodities.includes(id)) return "appointment";
  return k.byEquipment[load.equipment] as DockRule;
}

/**
 * The places whose first-come docks never close: the biggest by first-come freight (what they ship and
 * what they take in, each as a share of the national total), until they cover `fcfsAroundTheClockShare`
 * of all first-come stops. Computed once per economy and share.
 */
const roundTheClock = new WeakMap<Economy, Map<string, Uint8Array>>();
export function aroundTheClock(w: World, place: number): boolean {
  const k = w.cfg.docks;
  const share = k.fcfsAroundTheClockShare;
  if (!(share > 0)) return false;
  const eco = w.net.economy;
  let byKey = roundTheClock.get(eco);
  if (!byKey) roundTheClock.set(eco, (byKey = new Map()));
  const key = `${share}|${k.appointmentCommodities.join(",")}`;
  let flags = byKey.get(key);
  if (!flags) {
    const n = eco.places.length;
    const fcfs = COMMODITIES.map((c, i) => (c.equipment === "van" && !k.appointmentCommodities.includes(c.id) ? i : -1)).filter((i) => i >= 0);
    const prod = new Float64Array(n);
    const cons = new Float64Array(n);
    let pTot = 0;
    let cTot = 0;
    for (let p = 0; p < n; p++) {
      for (const c of fcfs) {
        prod[p]! += eco.production[p * COMMODITY_COUNT + c]!;
        cons[p]! += eco.consumption[p * COMMODITY_COUNT + c]!;
      }
      pTot += prod[p]!;
      cTot += cons[p]!;
    }
    const weight = (p: number) => (pTot > 0 ? prod[p]! / pTot : 0) + (cTot > 0 ? cons[p]! / cTot : 0);
    const order = Array.from({ length: n }, (_, p) => p).sort((a, b) => weight(b) - weight(a) || a - b);
    flags = new Uint8Array(n);
    let covered = 0;
    const target = share * 2; // the two shares add up to 2
    for (const p of order) {
      if (covered >= target) break;
      flags[p] = 1;
      covered += weight(p);
    }
    byKey.set(key, flags);
  }
  return flags[place] === 1;
}

/** The hours a load's dock keeps at one end, or null when it never closes (appointment freight is by slot). */
export function dockHoursAt(w: World, load: Load, end: "pickup" | "delivery"): DockHours | null {
  const rule = dockRule(w, load);
  if (rule === "appointment") return null;
  if (rule === "fcfs" && aroundTheClock(w, end === "pickup" ? load.originPlace : load.destPlace)) return null;
  return w.cfg.docks.hours[rule];
}

/** The first minute at or after `t` that a dock keeping these hours is open. */
export function nextOpen(w: World, t: number, h: DockHours): number {
  const D = w.cfg.time.gameMinutesPerDay;
  const first = Math.floor(t / D);
  for (let day = first; day < first + 8; day++) {
    if (!h.days.includes((day + w.cfg.time.weekdayOfDay0) % 7)) continue;
    const close = day * D + h.close * 60;
    if (t < close) return Math.max(t, day * D + h.open * 60);
  }
  return t;
}

/** An appointment load's slot, set at booking: the arrival estimate plus the lead, on the hour, never after the shipper's appointment; due at the slot's grace. */
export function setSlot(w: World, load: Load, etaT: number): void {
  const k = w.cfg.docks;
  if (!k.enabled || dockRule(w, load) !== "appointment") {
    load.slotT = 0;
    return;
  }
  const a = k.appointment;
  load.slotT = Math.min(load.appointmentT, Math.ceil((etaT + a.leadMinutes) / 60) * 60);
  load.dueT = load.slotT + a.graceMinutes;
}

/** At the shipper: appointment freight loads at any hour; first come, first served waits for the dock to open. */
export function pickupWait(w: World, load: Load, now: number): number {
  if (!w.cfg.docks.enabled) return 0;
  const hours = dockHoursAt(w, load, "pickup");
  return hours ? nextOpen(w, now, hours) - now : 0;
}

export interface DockWait {
  minutes: number;
  /** Past the slot's grace: waiting for the next slot (the carrier's fault: it doesn't move the due time). */
  missed: boolean;
  /** Waiting for the receiver's hours (not the carrier's fault: it moves the due time). */
  receiversHours: boolean;
}

const NONE: DockWait = { minutes: 0, missed: false, receiversHours: false };

/** At the receiver: early for a slot waits for its window, late waits for the next slot; first come, first served waits for the dock to open. */
export function deliveryWait(w: World, load: Load, now: number): DockWait {
  const k = w.cfg.docks;
  if (!k.enabled) return NONE;
  const rule = dockRule(w, load);
  if (rule === "appointment") {
    if (load.slotT <= 0) return NONE;
    const a = k.appointment;
    if (now < load.slotT - a.earlyMinutes) return { minutes: load.slotT - a.earlyMinutes - now, missed: false, receiversHours: false };
    if (now > load.slotT + a.graceMinutes) return { minutes: w.rng.ops.int(a.nextSlotHours[0], a.nextSlotHours[1]) * 60, missed: true, receiversHours: false };
    return NONE;
  }
  const hours = dockHoursAt(w, load, "delivery");
  if (!hours) return NONE;
  const minutes = nextOpen(w, now, hours) - now;
  return minutes > 0 ? { minutes, missed: false, receiversHours: true } : NONE;
}
