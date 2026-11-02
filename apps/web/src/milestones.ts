import { type Company, type World } from "@lanes/engine";
import { nextWeeklyCheckDay } from "./figures.js";

/**
 * Milestones after the walkthrough (specs/guidance.md section 3, guidance-ux.md section 4): events in the company's
 * life, derived from the world and saving nothing, like the walkthrough. Each has a line at the event and, where its
 * date is known ahead, a line before it; each line speaks once per browser (the client's seen record, `ms:{key}:before`
 * and `ms:{key}:at`) and only inside `guide.milestoneWindowDays` of the date. A milestone whose date the world doesn't
 * keep (a third truck) has `day` null: its at line shows while it holds, and the timeline lists it without a date.
 */
export type MilestoneKey = "ownTruck" | "hiredWeek" | "dispatcher" | "monthClose" | "day28" | "slump" | "debt" | "day91";

export interface Milestone {
  key: MilestoneKey;
  /** The game day of the event, or null when the world doesn't keep it. */
  day: number | null;
  happened: boolean;
  /** Whether it has a line before (the writer's table: the month close, day 28, day 91). */
  before: boolean;
  /** The staff member, for the first payday. */
  staffId?: number;
}

const today = (w: World): number => Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
/** The weekly close on or after `d` (step.ts closes a week when (day + 1) % 7 is 0). */
const closeOnOrAfter = (d: number): number => d + ((6 - (d % 7) + 7) % 7);

/** Every milestone to day 91 that has happened or has a known date ahead. */
export function milestones(w: World, c: Company): Milestone[] {
  const now = today(w);
  const out: Milestone[] = [];
  if (c.firstOwnedTruckDay !== null) out.push({ key: "ownTruck", day: c.firstOwnedTruckDay, happened: true, before: false });
  // The first payday: the weekly close after the first hired driver's hiring day; it has happened once that close ran.
  const hired = w.staff.filter((s) => s.companyId === c.id && s.kind === "driver" && !s.owner).sort((a, b) => a.hiredDay - b.hiredDay)[0];
  if (hired) {
    const pay = closeOnOrAfter(hired.hiredDay);
    if (now > pay) out.push({ key: "hiredWeek", day: pay, happened: true, before: false, staffId: hired.id });
  }
  const disp = w.staff.filter((s) => s.companyId === c.id && s.kind === "dispatcher" && !s.owner).sort((a, b) => a.hiredDay - b.hiredDay)[0];
  const trucks = (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired").length;
  if (disp) out.push({ key: "dispatcher", day: disp.hiredDay, happened: true, before: false });
  else if (trucks >= 3) out.push({ key: "dispatcher", day: null, happened: true, before: false });
  const month = c.createdDay + 30;
  out.push({ key: "monthClose", day: month, happened: now >= month, before: true });
  const ladder = w.cfg.unlockLadder;
  if (ladder.enabled || ladder.beta.enabled) {
    out.push({ key: "day28", day: ladder.layers.businesses.afterDays, happened: now >= ladder.layers.businesses.afterDays, before: true });
    out.push({ key: "day91", day: ladder.layers.brokerage.afterDays, happened: now >= ladder.layers.brokerage.afterDays, before: true });
  }
  // The first slump: the first day since the company began that the demand dial read under 0.9 (it's a function of the day).
  for (let d = c.createdDay; d <= now; d++) {
    if (w.feeds.cycle(d) < 0.9) {
      out.push({ key: "slump", day: d, happened: true, before: false });
      break;
    }
  }
  // In debt at a weekly check: the check that began the current run under the line.
  if (c.weeksInDebt > 0) {
    const last = nextWeeklyCheckDay(w) - 7;
    out.push({ key: "debt", day: last - 7 * (c.weeksInDebt - 1), happened: true, before: false });
  }
  return out;
}

/** The line due now, if any: at lines first, then by date; a before line only ahead of its date, never late. */
export function dueMilestone(w: World, c: Company, seen: (key: string) => boolean): { m: Milestone; phase: "before" | "at" } | null {
  const now = today(w);
  const win = w.cfg.guide.milestoneWindowDays;
  const due: { m: Milestone; phase: "before" | "at" }[] = [];
  for (const m of milestones(w, c)) {
    if (m.happened) {
      if (!seen(`ms:${m.key}:at`) && (m.day === null || now - m.day <= win)) due.push({ m, phase: "at" });
    } else if (m.before && m.day !== null && m.day - now <= win && !seen(`ms:${m.key}:before`)) due.push({ m, phase: "before" });
  }
  due.sort((a, b) => (a.phase === b.phase ? (a.m.day ?? Infinity) - (b.m.day ?? Infinity) : a.phase === "at" ? -1 : 1));
  return due[0] ?? null;
}

/** The company's history for the timeline: what has happened, newest first (undated ones first, as they hold now). */
export const history = (w: World, c: Company): Milestone[] =>
  milestones(w, c)
    .filter((m) => m.happened)
    .sort((a, b) => (b.day ?? Infinity) - (a.day ?? Infinity));
