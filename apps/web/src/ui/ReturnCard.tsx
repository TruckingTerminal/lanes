import type { JSX } from "preact";
import { dutyResetAt, hubMiles, type Company, type Truck, type World } from "@lanes/engine";
import { boardRows } from "../board.js";
import { RETURN } from "../copy.js";
import { fdFull, hhmm, shortDate } from "../format.js";
import { drivingLeftMin, etaMin } from "../rolling.js";
import { bumpData, S } from "../state.js";
import { Btn } from "./bits.js";
import { Iuliia } from "./Walkthrough.js";
import { whatNowWords } from "./WhatNow.js";

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

/** Where one truck is and what it's doing, in the writer's words. */
function truckLines(w: World, c: Company, t: Truck): string[] {
  if (t.status === "idle") {
    const where = t.hub === c.homeHub ? RETURN.whereHome(w.net.hubs[t.hub]!.name) : RETURN.whereIdle(placeName(w, t.place), Math.round(hubMiles(w, c.homeHub, t.hub)).toLocaleString("en-US"));
    const rows = boardRows(w, c, t, { dest: "any", maxDh: 300, query: "" });
    const pays = rows.filter((r) => !r.block && r.profitBook > 0).length;
    // The wall only when every load in reach is blocked, in R22's one reason (the board's own chip words).
    const wall = rows.length > 0 && rows.every((r) => r.block) ? rows[0]!.block : null;
    const why = pays > 0 ? RETURN.whyIdlePays(pays) : wall ? RETURN.whyIdle(wall) : null;
    return why ? [where, why] : [where];
  }
  if (t.status === "loading") return [RETURN.doingLoading(placeName(w, t.place), hhmm(w.t + t.dwellMin))];
  const dest = placeName(w, t.targetPlace);
  const lines = [RETURN.whereMoving(Math.round(t.remainingMi).toLocaleString("en-US"), dest, when(etaMin(w, t, c)))];
  const reset = dutyResetAt(w, t);
  if (drivingLeftMin(w, t, c) <= 0 && reset !== null) lines.push(RETURN.doingResting(placeName(w, t.place), hhmm(reset)));
  return lines;
}

export function ReturnCard(): JSX.Element | null {
  const g = S.game;
  const c = g?.player;
  const away = S.returnCard;
  if (!g || !c || !away) return null;
  const w = g.w;
  const close = () => {
    S.returnCard = null;
    bumpData();
  };
  // R10: a line with a button holds until answered or the player leaves its tab.
  if (S.tab !== "fleet") {
    queueMicrotask(close);
    return null;
  }
  const trucks = (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired");
  const lines: string[] = [RETURN.hello];
  if (trucks.length === 1) lines.push(...truckLines(w, c, trucks[0]!));
  else if (trucks.length > 1) {
    const idle = trucks.filter((t) => t.status === "idle");
    const home = idle.filter((t) => t.hub === c.homeHub).length;
    lines.push(RETURN.whereFleet(trucks.length, trucks.length - idle.length, idle.length - home, home));
  }
  if (!away.live) lines.push(RETURN.awayTest);
  else if (away.delivered > 0 || away.inFd > 0.5 || away.outFd > 0.5) {
    lines.push(RETURN.awayLive(away.delivered, fdFull(away.inFd), fdFull(away.outFd)));
    const trouble = [...(away.late ? [RETURN.late(away.late)] : []), ...(away.tickets ? [RETURN.ticket(away.tickets)] : [])];
    if (trouble.length) lines.push(RETURN.awayTrouble(trouble.join(" and ")));
  } else lines.push(RETURN.awayQuiet);
  if (away.month) lines.push(RETURN.month(away.month.name, fdFull(away.month.keptFd)));
  const next = whatNowWords();
  return (
    <div class="caption iuliia returncard">
      <Iuliia mood="wave" size={96} />
      <div class="stack">
        {lines.map((l, i) => (
          <span class="small" key={i}>
            {l}
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
    </div>
  );
}
