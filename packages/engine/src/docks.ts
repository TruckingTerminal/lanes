/**
 * Receiving and shipping hours (Jeff, 2026-10-30): appointment freight (cold chain, and the dry food
 * that goes to the same distribution centers) by slot at any hour; first come, first served in weekday
 * business hours; flatbed in daylight. A truck that arrives early for its slot, at a closed dock, or
 * past its slot waits at the gate. Config `docks`.
 */
import { COMMODITIES } from "@lanes/data";
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
  const k = w.cfg.docks;
  if (!k.enabled) return 0;
  const rule = dockRule(w, load);
  if (rule === "appointment") return 0;
  return nextOpen(w, now, k.hours[rule]) - now;
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
  return { minutes: nextOpen(w, now, k.hours[rule]) - now, missed: false, receiversHours: true };
}
