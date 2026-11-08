import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { staffById, type Company, type World } from "@lanes/engine";
import { FIGURE_ACT, GUIDE_LABEL, MILESTONE, RETURN } from "../copy.js";
import { cushion, gapToTruck } from "../figures.js";
import { cls, fdFull, shortDate, weekdayDate } from "../format.js";
import { closedMonths, monthReport } from "../books.js";
import { hasMonthReport, openMonthReport } from "./MonthReport.js";
import { reopenReturn } from "./ReturnCard.js";
import { iuliiaMayStart, iuliiaMuted, iuliiaStarted } from "../iuliia.js";
import { dueMilestone, history, milestones, type Milestone } from "../milestones.js";
import { bumpData, S, setOnboard, setTab, useData } from "../state.js";
import { GAME_CONFIG } from "../game.js";
import { Btn, Card } from "./bits.js";
import { Fig } from "./Explain.js";
import { Iuliia } from "./Walkthrough.js";
import { askWhatNow, WhatNowChip } from "./WhatNow.js";

/**
 * Milestones (guidance-ux.md section 4): caption rule 3, after the walkthrough's lines and before her tab lines. One at a
 * time, each for ui.iuliia.showSeconds; Quiet mutes them, and each is marked seen as it reaches the caption, so it
 * speaks once per browser. They queue in order (at lines first, then by date): when one ends, the next due follows at
 * once rather than waiting out the quiet time, so two on one day are said one after the other (QA: a slump line held
 * the caption and the hire day's line never spoke). Her line, the reason, and one button to where to act or prepare.
 */
let chainUntil = -Infinity;

/** The company a milestone key belongs to: its world (by seed), its id, and the day it began (a fresh start is new). */
export const milestoneScope = (w: World, c: Company): string => `${w.seed}:${c.id}:${c.createdDay}`;
export function MilestoneLine(): JSX.Element | null {
  const g = S.game;
  const c = g?.player;
  if (!g || !c) return null;
  // Said once per company, not per browser: the seen record is the browser's, so each key carries the company in its
  // world (QA: a new test world in the same browser found the last world's slump and payday lines already said).
  const scope = milestoneScope(g.w, c);
  const seen = (k: string) => S.onboard.seen.includes(`${scope}|${k}`);
  let cur = S.milestone;
  if (cur && cur.tab !== S.tab) cur = S.milestone = null;
  // A line has its seconds, then gives way; the next one due may follow straight on, for a moment. R10: a line with a
  // button keeps the caption until it's tapped, dismissed (its ×) or its tab is left; no timer retires it.
  if (cur && !cur.held && performance.now() - cur.at > GAME_CONFIG.ui.iuliia.showSeconds * 1000) {
    cur = S.milestone = null;
    chainUntil = performance.now() + 2000;
  }
  if (!cur) {
    if (performance.now() < chainUntil ? iuliiaMuted() : !iuliiaMayStart()) return null;
    const due = dueMilestone(g.w, c, seen);
    if (!due) return null;
    cur = S.milestone = { key: due.m.key, phase: due.phase, tab: S.tab, at: performance.now() };
    iuliiaStarted();
    // Held for ui.iuliia.showSeconds before a step line may take the caption back (milestoneHeld): redraw when it ends.
    setTimeout(bumpData, GAME_CONFIG.ui.iuliia.showSeconds * 1000 + 50);
    const k = `${scope}|ms:${due.m.key}:${due.phase}`;
    queueMicrotask(() => setOnboard({ seen: [...S.onboard.seen, k] }));
  }
  const m = milestones(g.w, c).find((x) => x.key === cur!.key);
  if (!m) return null;
  const v = words(g.w, c, m, cur.phase);
  cur.held = !!(v.button && v.go);
  return (
    <div class={cls("caption iuliia", cur.held && "heldline")}>
      {cur.held ? (
        <Btn sm ghost class="capx" label={MILESTONE.dismiss} onClick={dismissMilestone}>
          ×
        </Btn>
      ) : null}
      <Iuliia mood="point" size={64} />
      <div class="stack">
        <span class="small">{v.line}</span>
        {v.reason ? <span class="small muted">{v.reason}</span> : null}
        {v.button && v.go ? (
          <Btn
            sm
            onClick={() => {
              S.milestone = null;
              v.go!();
            }}
          >
            {v.button}
          </Btn>
        ) : null}
      </div>
      <WhatNowChip />
    </div>
  );
}

/** R10: the × on a held line. It goes, and the next one due may follow at once, as when a line's seconds end. */
export function dismissMilestone(): void {
  S.milestone = null;
  chainUntil = performance.now() + 2000;
  bumpData();
}

/** Whether a milestone line started under ui.iuliia.showSeconds ago on this tab, or carries a button (R10): it keeps the caption until then. */
export const milestoneHeld = (): boolean => !!S.milestone && S.milestone.tab === S.tab && (!!S.milestone.held || performance.now() - S.milestone.at < GAME_CONFIG.ui.iuliia.showSeconds * 1000);

/** A milestone's line, reason and button, in the writer's strings with this company's figures. */
function words(w: World, c: Company, m: Milestone, phase: "before" | "at"): { line: string; reason: string | null; button?: string; go?: () => void } {
  const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  const go = (tab: string) => () => setTab(tab as Parameters<typeof setTab>[0]);
  switch (m.key) {
    case "ownTruck":
      return { line: MILESTONE.ownTruck.at, reason: MILESTONE.ownTruck.reason, button: MILESTONE.ownTruck.button, go: go("loads") };
    case "hiredWeek": {
      // Drivers are paid by the mile: the miles since the last weekly close (labor.ts `pending`), at the driver's rate. The
      // figure resets at the close, so the timeline re-reads the reason alone once it has.
      const s = m.staffId !== undefined ? staffById(w, m.staffId) : null;
      const name = s?.name ?? "";
      const reason = MILESTONE.hiredWeek.reason(fdFull(w.cfg.labor.driver.perDiemFd));
      const line =
        phase === "before"
          ? MILESTONE.hiredWeek.before(name, shortDate(m.day!))
          : today <= (m.atUntil ?? Infinity)
            ? MILESTONE.hiredWeek.at(name, fdFull(s?.pending ?? 0), fdFull((s?.pending ?? 0) * (s?.pay ?? 0)))
            : reason;
      return { line, reason: line === reason ? null : reason, button: MILESTONE.hiredWeek.button, go: go("loads") };
    }
    case "dispatcher":
      return {
        // Three trucks and no dispatcher: no dispatcher starts, so the timeline re-reads the reason alone.
        line: m.via === "trucks" ? MILESTONE.dispatcher.reason : MILESTONE.dispatcher.at,
        reason: m.via === "trucks" ? null : MILESTONE.dispatcher.reason,
        button: MILESTONE.dispatcher.button,
        go: () => {
          setTab("fleet");
          requestAnimationFrame(() => document.querySelector(".dispatcher")?.scrollIntoView({ block: "start" }));
        },
      };
    case "monthClose":
      if (phase === "before") return { line: MILESTONE.monthClose.before(Math.max(0, m.day! - today)), reason: MILESTONE.monthClose.reason, button: MILESTONE.monthClose.beforeButton, go: go("money") };
    {
      // The first month's books (books.ts, the month report's own figures, so the line and the report agree), else the
      // engine's first month-close record (intel.ts). "Read the month" (R10) opens the report; with none, no button.
      const r = c.firstMonth ? closedMonths(w, c).find((x) => x.closedDay === c.firstMonth!.closedDay) : undefined;
      const rep = r ? monthReport(r) : null;
      return {
        line: rep ? MILESTONE.monthClose.at(fdFull(rep.earnedFd), fdFull(rep.spentFd), fdFull(rep.keptFd)) : c.firstMonth ? MILESTONE.monthClose.at(fdFull(c.firstMonth.revenueFd), fdFull(c.firstMonth.spentFd), fdFull(c.firstMonth.revenueFd - c.firstMonth.spentFd)) : MILESTONE.monthClose.atNoRecord,
        reason: MILESTONE.monthClose.reason,
        ...(hasMonthReport() ? { button: MILESTONE.monthClose.button, go: openMonthReport } : {}),
      };
    }
    case "day28":
      return {
        line: phase === "before" ? MILESTONE.day28.before(shortDate(m.day!)) : MILESTONE.day28.at,
        reason: MILESTONE.day28.reason(fdFull(gapToTruck(w, c).gapFd)),
        button: phase === "before" ? MILESTONE.day28.beforeButton : MILESTONE.day28.button,
        go: go("market"),
      };
    case "firstBoom":
      return { line: MILESTONE.firstBoom.at, reason: MILESTONE.firstBoom.reason, button: MILESTONE.firstBoom.button, go: go("loads") };
    case "slump": {
      const cu = cushion(w, c);
      return { line: MILESTONE.slump.at, reason: MILESTONE.slump.reason(cu.weeks === null ? "–" : cu.weeks.toFixed(1)), button: MILESTONE.slump.button, go: go("money") };
    }
    case "debt": {
      const k = w.cfg.insolvency;
      return {
        line: phase === "before" ? MILESTONE.debt.before(shortDate(m.day!)) : MILESTONE.debt.at(k.weeksInDebt),
        reason: MILESTONE.debt.reason(k.weeksInDebt, fdFull(-k.debtLimitFd)),
        button: MILESTONE.debt.button,
        go: askWhatNow,
      };
    }
    case "day91":
      return { line: phase === "before" ? MILESTONE.day91.before(shortDate(m.day!)) : MILESTONE.day91.at, reason: MILESTONE.day91.reason, button: phase === "before" ? MILESTONE.day91.beforeButton : MILESTONE.day91.button, go: go("guide") };
  }
}

/** More › Iuliia, "Your company so far": what has happened, newest first, a tap re-reads her line; above it, the next figure. */
export function CompanySoFar(): JSX.Element | null {
  useData();
  const [open, setOpen] = useState<string | null>(null);
  const g = S.game;
  const c = g?.player;
  if (!g || !c) return null;
  const done = history(g.w, c);
  return (
    <Card title={MILESTONE.timeline}>
      <p class="small">
        <b>{MILESTONE.nextOnRoad}</b> {nextOnRoad(g.w, c)}
      </p>
      {/* R21: the last return card, as "Back {date}"; a tap reopens it as it was. */}
      {S.lastReturn ? (
        <ul class="timeline">
          <li>
            <button type="button" class="linkish" onClick={reopenReturn}>
              {RETURN.timeline(weekdayDate(Math.floor(S.lastReturn.backT / g.w.cfg.time.gameMinutesPerDay)))}
            </button>
          </li>
        </ul>
      ) : null}
      {done.length ? (
        <ul class="timeline">
          {done.map((m) => {
            const v = words(g.w, c, m, "at");
            return (
              <li key={m.key}>
                <button type="button" class="linkish" onClick={() => setOpen(open === m.key ? null : m.key)}>
                  <span class="muted small">{m.day !== null ? shortDate(m.day) : MILESTONE.noDate}</span> {m.via === "trucks" ? MILESTONE.dispatcher.nameTrucks : MILESTONE[m.key].name}
                </button>
                {open === m.key ? (
                  <p class="small">
                    {v.line} {v.reason ? <span class="muted">{v.reason}</span> : null}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p class="muted small">{MILESTONE.timelineNone}</p>
      )}
    </Card>
  );
}

/**
 * What moved the next-truck gap since the player last opened its explanation (row 4): the cheapest route changed, or
 * the first week closed and the gap began holding back weeks of spending. Kept in the page, per company.
 */
export function gapNotes(w: World, c: Company, route: string): string[] {
  const scope = milestoneScope(w, c);
  const weeks = c.weeklySpend.length;
  const seen = S.gapSeen?.scope === scope ? S.gapSeen : (S.gapSeen = { scope, route, weeks, why: [] });
  if (route !== seen.route && !seen.why.includes("cheapest")) seen.why.push("cheapest");
  if (seen.weeks === 0 && weeks > 0 && !seen.why.includes("cushion")) seen.why.push("cushion");
  seen.route = route;
  seen.weeks = weeks;
  return seen.why.map((k) => (k === "cheapest" ? GUIDE_LABEL.gapWhyCheapest : GUIDE_LABEL.gapWhyCushion(w.cfg.guide.gapCushionWeeks)));
}

/** The one figure that matters most now: the gap to the next truck, else the next layer to open, else the month's close. */
function nextOnRoad(w: World, c: Company): JSX.Element | string {
  const gap = gapToTruck(w, c);
  const notes = gapNotes(w, c, gap.route);
  // A truck within reach today (a listing the cash and the hold already cover) still names the next truck, not the next
  // layer (QA's cheap-batch replay: the gap vanished for an owner-operator with a cheap listing open).
  if (gap.gapFd <= 0 && Number.isFinite(gap.needNowFd) && !(w.trucksByCompany.get(c.id) ?? []).some((t) => t.lease === "owned"))
    return (
      <Fig k="guide.gapToTruck" label={GUIDE_LABEL.gap} ctx={{ notes }}>
        {FIGURE_ACT.gapClosed}
      </Fig>
    );
  if (gap.gapFd > 0 && Number.isFinite(gap.gapFd))
    return (
      <>
        <Fig k="guide.gapToTruck" label={GUIDE_LABEL.gap} ctx={{ notes }}>
          {MILESTONE.nextTruck(fdFull(gap.gapFd))}
        </Fig>
        {notes.map((n) => (
          <span class="muted small" key={n}>
            {" "}
            {n}
          </span>
        ))}
      </>
    );
  const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  const ahead = milestones(w, c)
    .filter((m) => !m.happened && m.day !== null && m.day > today)
    .sort((a, b) => a.day! - b.day!)[0];
  if (ahead?.key === "day28") return MILESTONE.nextLayer("Businesses", shortDate(ahead.day!));
  if (ahead?.key === "day91") return MILESTONE.nextLayer("Brokerages", shortDate(ahead.day!));
  if (ahead?.key === "monthClose") return MILESTONE.nextMonth(ahead.day! - today);
  return GUIDE_LABEL.cushionValue(cushion(w, c).weeks);
}
