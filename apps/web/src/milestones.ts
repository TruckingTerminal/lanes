import { type Company, type World } from "@lanes/engine";
import { debtCountdown, nextWeeklyCheckDay } from "./figures.js";

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
  /** Whether it has a line before (the month close, day 28, day 91, the first payday, the debt check). */
  before: boolean;
  /** The last day its at line may show, when shorter than the window (the first payday's figure resets at the close). */
  atUntil?: number;
  /** The dispatcher milestone reached by a third truck, with no dispatcher hired: undated, named "Three trucks". */
  via?: "trucks";
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
  // The first payday: the weekly close after the first hired driver's hiring day. Its before line runs from the hiring
  // to the day before; its at line is the week so far, on the payday itself, before the close resets the figure (the
  // director). Queued behind other lines rather than dropped, both reach the caption (QA's guidance replays).
  const hired = w.staff.filter((s) => s.companyId === c.id && s.kind === "driver" && !s.owner).sort((a, b) => a.hiredDay - b.hiredDay)[0];
  if (hired) {
    const pay = closeOnOrAfter(hired.hiredDay);
    out.push({ key: "hiredWeek", day: pay, happened: now >= pay, before: true, atUntil: pay, staffId: hired.id });
  }
  const disp = w.staff.filter((s) => s.companyId === c.id && s.kind === "dispatcher" && !s.owner).sort((a, b) => a.hiredDay - b.hiredDay)[0];
  const trucks = (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired").length;
  if (disp) out.push({ key: "dispatcher", day: disp.hiredDay, happened: true, before: false });
  else if (trucks >= 3) out.push({ key: "dispatcher", day: null, happened: true, before: false, via: "trucks" });
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
  // In debt at a weekly check: the check that began the current run under the line; before it, the next check's day
  // while cash is under the line now.
  if (c.weeksInDebt > 0) {
    const last = nextWeeklyCheckDay(w) - 7;
    out.push({ key: "debt", day: last - 7 * (c.weeksInDebt - 1), happened: true, before: false });
  } else if (debtCountdown(w, c).under) out.push({ key: "debt", day: nextWeeklyCheckDay(w), happened: false, before: true });
  return out;
}

/** The line due now, if any: at lines first, then by date; a before line only ahead of its date, never late. */
export function dueMilestone(w: World, c: Company, seen: (key: string) => boolean): { m: Milestone; phase: "before" | "at" } | null {
  const now = today(w);
  const win = w.cfg.guide.milestoneWindowDays;
  const due: { m: Milestone; phase: "before" | "at" }[] = [];
  for (const m of milestones(w, c)) {
    // Three trucks with no dispatcher has a name in the timeline but no line of its own yet (the writer's).
    if (m.via === "trucks") continue;
    if (m.happened) {
      if (!seen(`ms:${m.key}:at`) && (m.day === null || (now - m.day <= win && now <= (m.atUntil ?? Infinity)))) due.push({ m, phase: "at" });
    } else if (m.before && m.day !== null && m.day - now <= win && !seen(`ms:${m.key}:before`)) due.push({ m, phase: "before" });
  }
  due.sort((a, b) => (a.phase === b.phase ? (a.m.day ?? Infinity) - (b.m.day ?? Infinity) : a.phase === "at" ? -1 : 1));
  return due[0] ?? null;
}

/** The order milestones come in, for placing an undated one between its neighbours. */
const ORDER: MilestoneKey[] = ["ownTruck", "hiredWeek", "dispatcher", "monthClose", "day28", "slump", "debt", "day91"];

/** The company's history for the timeline: what has happened, newest first; an undated one sits just after its last dated forerunner. */
export function history(w: World, c: Company): Milestone[] {
  const now = today(w);
  // The timeline lists what has happened by its date: the first payday once it's paid.
  const done = milestones(w, c).filter((m) => m.happened && (m.day === null || m.day <= now));
  const when = (m: Milestone): number => {
    if (m.day !== null) return m.day;
    const before = done.filter((x) => x.day !== null && ORDER.indexOf(x.key) < ORDER.indexOf(m.key)).map((x) => x.day!);
    return (before.length ? Math.max(...before) : -Infinity) + 0.5;
  };
  return done.sort((a, b) => when(b) - when(a));
}
