import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { staffById, type Company, type World } from "@lanes/engine";
import { GUIDE_LABEL, MILESTONE } from "../copy.js";
import { cushion, gapToTruck } from "../figures.js";
import { fdFull, shortDate } from "../format.js";
import { iuliiaMayStart, iuliiaStarted } from "../iuliia.js";
import { dueMilestone, history, milestones, type Milestone } from "../milestones.js";
import { S, setOnboard, setTab, useData } from "../state.js";
import { Btn, Card } from "./bits.js";
import { Fig } from "./Explain.js";
import { Iuliia } from "./Walkthrough.js";
import { askWhatNow, WhatNowChip } from "./WhatNow.js";

/**
 * Milestones (guidance-ux.md section 4): caption rule 3, after the walkthrough's lines and before her tab lines. One at a
 * time; it waits for the quiet time, Quiet mutes it, and it's marked seen as it starts, so it speaks once per browser.
 * It stays until its button or a change of tab. Her line, the reason, and one button to where to act or prepare.
 */
export function MilestoneLine(): JSX.Element | null {
  const g = S.game;
  const c = g?.player;
  if (!g || !c) return null;
  const seen = (k: string) => S.onboard.seen.includes(k);
  let cur = S.milestone;
  if (cur && cur.tab !== S.tab) cur = S.milestone = null;
  if (!cur) {
    if (!iuliiaMayStart()) return null;
    const due = dueMilestone(g.w, c, seen);
    if (!due) return null;
    cur = S.milestone = { key: due.m.key, phase: due.phase, tab: S.tab };
    iuliiaStarted();
    const k = `ms:${due.m.key}:${due.phase}`;
    queueMicrotask(() => setOnboard({ seen: [...S.onboard.seen, k] }));
  }
  const m = milestones(g.w, c).find((x) => x.key === cur!.key);
  if (!m) return null;
  const v = words(g.w, c, m, cur.phase);
  return (
    <div class="caption iuliia">
      <Iuliia mood="point" size={64} />
      <div class="stack">
        <span class="small">{v.line}</span>
        {v.reason ? <span class="small muted">{v.reason}</span> : null}
        <Btn
          sm
          onClick={() => {
            S.milestone = null;
            v.go();
          }}
        >
          {v.button}
        </Btn>
      </div>
      <WhatNowChip />
    </div>
  );
}

/** A milestone's line, reason and button, in the writer's strings with this company's figures. */
function words(w: World, c: Company, m: Milestone, phase: "before" | "at"): { line: string; reason: string | null; button: string; go: () => void } {
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
      // The engine's first month-close record (intel.ts): earned, spent (operating costs and overhead), kept.
      return {
        line: c.firstMonth ? MILESTONE.monthClose.at(fdFull(c.firstMonth.revenueFd), fdFull(c.firstMonth.spentFd), fdFull(c.firstMonth.revenueFd - c.firstMonth.spentFd)) : MILESTONE.monthClose.atNoRecord,
        reason: MILESTONE.monthClose.reason,
        button: MILESTONE.monthClose.button,
        go: go("money"),
      };
    case "day28":
      return {
        line: phase === "before" ? MILESTONE.day28.before(shortDate(m.day!)) : MILESTONE.day28.at,
        reason: MILESTONE.day28.reason(fdFull(gapToTruck(w, c).gapFd)),
        button: phase === "before" ? MILESTONE.day28.beforeButton : MILESTONE.day28.button,
        go: go("market"),
      };
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

/** The one figure that matters most now: the gap to the next truck, else the next layer to open, else the month's close. */
function nextOnRoad(w: World, c: Company): JSX.Element | string {
  const gap = gapToTruck(w, c);
  if (gap.gapFd > 0)
    return (
      <Fig k="guide.gapToTruck" label={GUIDE_LABEL.gap}>
        {MILESTONE.nextTruck(fdFull(gap.gapFd))}
      </Fig>
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
