import type { JSX } from "preact";
import { dockHoursAt, dutyResetAt, hubMiles, nextOpen, type Company, type Truck, type World } from "@lanes/engine";
import { needs, wallAt } from "../logic.js";
import { RETURN } from "../copy.js";
import { fdFull, hhmm, pct, shortDate, weekdayDate } from "../format.js";
import { PENDING } from "../copy-pending.js";
import { drivingLeftMin, etaMin } from "../rolling.js";
import { bumpData, S, setTab, truckNo } from "../state.js";
import { Btn } from "./bits.js";
import { Iuliia } from "./Walkthrough.js";
import { WhatNowChip, whatNowWords } from "./WhatNow.js";
import { hasMonthReport, openMonthReport } from "./MonthReport.js";
import { awayIsHere } from "../returncard.js";

/**
 * The return card (the director's R21, player5-ux.md section 2; the writer's copy-player5.md): after a long absence,
 * Iuliia's caption on the Truck tab says where the trucks are, what they're doing and why, what happened while the player
 * was away, a month that closed, and What now?'s top action. It goes when that action runs, on OK, or when the player
 * leaves the Truck tab (R10's rule for a line with a button); never on a timer.
 */
const placeName = (w: World, p: number): string => {
  const pl = w.net.places[p]!;
  return pl.state ? `${pl.name}, ${pl.state}` : pl.name;
};
const when = (t: number): string => `${shortDate(Math.floor(t / 1440))} ${hhmm(t)}`;

/** Where one truck is and what it's doing, in the writer's words; `who` names it in a fleet ("Truck 2"). */
function truckLines(w: World, c: Company, t: Truck, who?: string): string[] {
  if (t.status === "idle") {
    const where = t.hub === c.homeHub ? RETURN.whereHome(w.net.hubs[t.hub]!.name, who) : RETURN.whereIdle(placeName(w, t.place), Math.round(hubMiles(w, c.homeHub, t.hub)).toLocaleString("en-US"), who);
    // The wall only when every load in reach is blocked, in R22's one reason (logic.ts wallAt, the board's own chip).
    const wall = wallAt(t);
    const why = wall.pays > 0 ? RETURN.whyIdlePays(wall.pays) : wall.reason ? RETURN.whyIdle(wall.reason) : null;
    return why ? [where, why] : [where];
  }
  // At a dock that isn't open yet (docks.ts, read only): the writer's return.doingDock.
  const load = t.loadId !== null ? w.loads.get(t.loadId) : undefined;
  if (load && (t.status === "loading" || t.status === "unloading")) {
    const hours = dockHoursAt(w, load, t.status === "loading" ? "pickup" : "delivery");
    const opens = hours ? nextOpen(w, w.t, hours) : w.t;
    if (opens > w.t) return [RETURN.doingDock(placeName(w, t.place), when(opens))];
  }
  if (t.status === "loading") return [RETURN.doingLoading(placeName(w, t.place), hhmm(w.t + t.dwellMin))];
  const dest = placeName(w, t.targetPlace);
  const lines = [RETURN.whereMoving(Math.round(t.remainingMi).toLocaleString("en-US"), dest, when(etaMin(w, t, c)), who)];
  const reset = dutyResetAt(w, t);
  if (drivingLeftMin(w, t, c) <= 0 && reset !== null) lines.push(RETURN.doingResting(placeName(w, t.place), hhmm(reset)));
  return lines;
}

/** The fleet's trucks in the badge's order (R9's rank: the one with most at stake first), then the rest in fleet order. */
function rankedTrucks(trucks: Truck[]): Truck[] {
  const order: number[] = [];
  for (const n of needs()) {
    const id = Number(/:(\d+)$/.exec(n.key)?.[1]);
    if (trucks.some((t) => t.id === id) && !order.includes(id)) order.push(id);
  }
  return [...trucks].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib) || a.id - b.id;
  });
}

/** The one line the card keeps at the phone's strip height (the UX spec): the first truck's state. */
function stripLine(w: World, c: Company, t: Truck | undefined): string {
  if (!t) return RETURN.hello;
  const n = truckNo(t.id);
  if (t.status === "idle") return t.hub === c.homeHub ? RETURN.stripHome(n) : RETURN.stripIdle(n, w.net.places[t.place]!.name);
  return RETURN.stripMoving(n, w.net.places[t.targetPlace]!.name);
}

/** Opens the Truck tab's Today list, from the card's "while you were away" row. */
function seeToday(): void {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(".todaycard")?.scrollIntoView({ block: "start" }));
}

export function ReturnCard(): JSX.Element | null {
  const g = S.game;
  const c = g?.player;
  const away = S.returnCard;
  if (!g || !c || !away) return null;
  const w = g.w;
  // Another world's or company's card never shows here; it goes, and so does its timeline row.
  if (!awayIsHere(away, w, c)) {
    S.returnCard = null;
    if (S.lastReturn && !awayIsHere(S.lastReturn, w, c)) S.lastReturn = null;
    return null;
  }
  const close = () => {
    S.returnCard = null;
    bumpData();
  };
  // R10: a line with a button holds until answered or the player leaves its tab.
  if (S.tab !== "fleet") {
    queueMicrotask(close);
    return null;
  }
  // It stays in More › Iuliia's timeline as "Back {date}", where a tap reopens it as it was.
  S.lastReturn = away;
  const trucks = (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired");
  const ranked = rankedTrucks(trucks);
  const day = Math.floor(away.backT / w.cfg.time.gameMinutesPerDay);
  const lines: { text: string; go?: () => void; button?: string }[] = [{ text: RETURN.helloAt(`${weekdayDate(day)}, ${hhmm(away.backT)}`) }];
  // Client batch 8b item 60 (the director's E): the time away, then what went wrong, the money, on time; the next step is
  // What now?'s, below. Iuliia's line from the worst item, else the best, never the same twice running.
  const e = away.e;
  if (e) {
    lines.push({ text: PENDING.awayFor(Math.floor(e.awayMin / 1440), Math.floor((e.awayMin % 1440) / 60)) });
    const wrong = [
      ...(e.taken ? [PENDING.awayTaken(e.taken)] : []),
      ...(e.missed ? [PENDING.awayMissed(e.missed)] : []),
      ...(e.claims ? [PENDING.awayClaims(e.claims, fdFull(e.claimsFd))] : []),
      ...(away.late ? [PENDING.awayLate(away.late)] : []),
      ...(e.emptyMi >= 1 ? [PENDING.awayEmpty(Math.round(e.emptyMi).toLocaleString("en-US"))] : []),
      ...(away.breakdowns ? [PENDING.awayBreakdowns(away.breakdowns)] : []),
      ...(e.finesFd >= 0.5 ? [PENDING.awayFines(fdFull(e.finesFd))] : []),
    ];
    lines.push({ text: wrong.length ? PENDING.awayWrong(wrong.join(", ")) : PENDING.awayNothingWrong });
    lines.push({ text: PENDING.awayMoney(away.delivered, fdFull(away.inFd), fdFull(e.keptFd), fdFull(e.cashThen), fdFull(e.cashNow)), go: seeToday, button: RETURN.seeToday });
    if (away.delivered > 0) lines.push({ text: PENDING.awayOnTime(pct(Math.max(0, away.delivered - away.late) / away.delivered)) });
  }
  if (trucks.length === 1) lines.push(...truckLines(w, c, trucks[0]!).map((text) => ({ text })));
  else if (trucks.length > 1) {
    const idle = trucks.filter((t) => t.status === "idle");
    const home = idle.filter((t) => t.hub === c.homeHub).length;
    lines.push({ text: RETURN.whereFleet(trucks.length, trucks.length - idle.length, idle.length - home, home) });
    // Up to three trucks, the one with most at stake first, then "and n more on Truck".
    for (const t of ranked.slice(0, 3)) lines.push(...truckLines(w, c, t, `Truck ${truckNo(t.id)}`).map((text) => ({ text })));
    if (trucks.length > 3) lines.push({ text: RETURN.more(trucks.length - 3) });
  }
  if (e) {
    /* the interval said above, in the director's order */
  } else if (!away.live) lines.push({ text: RETURN.awayTest });
  else if (away.delivered > 0 || away.inFd > 0.5 || away.outFd > 0.5) {
    lines.push({ text: RETURN.awayLive(away.delivered, fdFull(away.inFd), fdFull(away.outFd)), go: seeToday, button: RETURN.seeToday });
    const trouble = [...(away.breakdowns ? [RETURN.breakdown(away.breakdowns)] : []), ...(away.late ? [RETURN.late(away.late)] : []), ...(away.tickets ? [RETURN.ticket(away.tickets)] : [])];
    if (trouble.length) lines.push({ text: RETURN.awayTrouble(trouble.join(" and ")) });
  } else lines.push({ text: RETURN.awayQuiet });
  if (away.month) lines.push({ text: RETURN.month(away.month.name, fdFull(away.month.keptFd)), ...(hasMonthReport() ? { go: () => (close(), openMonthReport()), button: RETURN.readMonth } : {}) });
  const next = whatNowWords();
  return (
    <div class="caption iuliia returncard">
      <span class="small stripline">{stripLine(w, c, ranked[0])}</span>
      <Iuliia mood="wave" size={96} />
      <div class="stack full">
        {e ? <i class="small">{awayLine(away)}</i> : null}
        {lines.map((l, i) => (
          <span class="small" key={i}>
            {l.text}
            {l.go ? (
              <>
                {" "}
                <button type="button" class="linkish" onClick={l.go}>
                  {l.button} ›
                </button>
              </>
            ) : null}
          </span>
        ))}
        {next ? (
          <>
            <b class={next.red ? "bad" : ""}>{next.action}</b>
            <span class="small">{next.reason}</span>
          </>
        ) : null}
        <div class="row">
          {next ? (
            <Btn sm primary onClick={() => (close(), next.go())}>
              {next.button}
            </Btn>
          ) : null}
          <Btn sm ghost onClick={close}>
            {RETURN.ok}
          </Btn>
        </div>
      </div>
      <span class="stripline">
        <WhatNowChip />
      </span>
    </div>
  );
}

/**
 * Iuliia's line for a return (the director's E): from the interval's worst item, else its best; never the line she said
 * last time (kept in this browser), so the next kind down speaks instead.
 */
const AWAY_LINE_KEY = "lanes.awayLine";
const lineMemo = new WeakMap<object, string>();
function awayLine(a: NonNullable<typeof S.returnCard>): string {
  const hit = lineMemo.get(a);
  if (hit) return hit;
  const e = a.e!;
  const kinds = [
    ...(e.taken ? ["taken"] : []),
    ...(e.missed ? ["missed"] : []),
    ...(e.claims ? ["claims"] : []),
    ...(a.breakdowns ? ["breakdowns"] : []),
    ...(a.late ? ["late"] : []),
    ...(e.emptyMi >= 100 ? ["empty"] : []),
    ...(e.finesFd >= 0.5 ? ["fines"] : []),
    ...(e.keptFd >= 0.5 ? ["kept"] : []),
    ...(a.delivered > 0 ? ["delivered"] : []),
    "quiet",
  ];
  let last: string | null = null;
  try {
    last = localStorage.getItem(AWAY_LINE_KEY);
  } catch {
    last = null;
  }
  const all = kinds.flatMap((k) => PENDING.awayLines[k] ?? []);
  const line = all.find((x) => x !== last) ?? all[0] ?? "";
  try {
    localStorage.setItem(AWAY_LINE_KEY, line);
  } catch {
    /* a private window: no memory of the last line */
  }
  lineMemo.set(a, line);
  return line;
}

/** More › Iuliia's timeline: the last return's card, reopened as it was (the UX spec). */
export function reopenReturn(): void {
  const g = S.game;
  if (!S.lastReturn || !g?.player || !awayIsHere(S.lastReturn, g.w, g.player)) return;
  S.returnCard = S.lastReturn;
  setTab("fleet");
  bumpData();
}
