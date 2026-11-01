import type { JSX } from "preact";
import { companyAccount } from "@lanes/engine";
import { cls, fdFull, hhmm, shortDate, weekday } from "../format.js";
import { FIRST_ENTRY } from "../copy.js";
import { H } from "../handlers.js";
import { attentionItems, nextRoundHour, stuckTrucks, tiredTrucks } from "../logic.js";
import { bumpData, clockMin, fsActive, fsEnabled, S, setTab, SPEEDS, toggleFullscreen, useData, useTick } from "../state.js";
import { Badge, Btn } from "./bits.js";
import { choosing } from "./ChooseHub.js";
import { myTenders } from "./panels/Contracts.js";

/**
 * The top strip (specs/first-ten-minutes.md, Layout): the clock, cash, a dot counting what needs you, and "≡". The test
 * build adds its speeds: four buttons on a laptop, one that cycles on a phone. One row, 44 px, on both.
 */
export function TopBar(): JSX.Element {
  useData();
  const g = S.game!;
  const w = g.w;
  const c = g.player;
  const bal = c ? w.ledger.balance(companyAccount(c.id)) : 0;
  const needs = c ? stuckTrucks().length + tiredTrucks().length + myTenders(c).length + attentionItems().length : 0;
  // Before a company (S1): the date, the clock and the next round, and nothing that belongs to a company yet.
  if (choosing()) {
    return (
      <header class="topbar">
        <Clock long />
        <span class="muted">{FIRST_ENTRY.nextRound(nextRoundHour())}</span>
        <span class="grow" />
        <Menu />
      </header>
    );
  }
  return (
    <header class="topbar">
      <Clock />
      {c ? <span class={cls("cash num", bal < 0 && "bad")}>{fdFull(bal)} FD</span> : choosing() ? null : <Badge>Watching</Badge>}
      {needs ? (
        <button type="button" class="alertdot" title={`Needs you: ${needs}`} onClick={() => setTab("fleet")}>
          {needs}
        </button>
      ) : null}
      {c && c.authority.status !== "active" ? <Badge tone="alert">{c.authority.status === "revoked" ? "Authority revoked" : "Suspended"}</Badge> : null}
      {g.kind === "live" && g.broken ? <Badge tone="alert" title={g.broken.reason}>World stopped</Badge> : null}
      <span class="grow" />
      {g.kind === "test" ? <Speeds /> : null}
      <Menu />
    </header>
  );
}

function Clock({ long = false }: { long?: boolean }): JSX.Element {
  useTick();
  const minute = clockMin();
  const day = Math.floor(minute / 1440);
  return (
    <span class="clock">
      {long ? `${weekday(day)} ${shortDate(day)} · ${hhmm(minute)}` : `${weekday(day)} ${hhmm(minute)}`}
    </span>
  );
}

function Speeds(): JSX.Element {
  const next = () => setSpeed((S.speed + 1) % SPEEDS.length);
  return (
    <>
      <div class="speeds laptop-only" role="group" aria-label="Test world speed">
        {SPEEDS.map((sp, i) => (
          <Btn key={sp.icon} sm on={S.speed === i} title={sp.title} onClick={() => setSpeed(i)}>
            {sp.label}
          </Btn>
        ))}
      </div>
      <Btn sm class="phone-only" title={`${SPEEDS[S.speed]!.title}: tap for the next speed`} onClick={next}>
        {SPEEDS[S.speed]!.label}
      </Btn>
    </>
  );
}

/** "≡": the title screen, full screen and the report form (and, for the owner in a test world, the way back to the live one). */
function Menu(): JSX.Element {
  const close = (ev: MouseEvent) => (ev.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
  const item = (label: string, run: () => void) => (
    <button
      type="button"
      onClick={(ev) => {
        close(ev);
        run();
      }}
    >
      {label}
    </button>
  );
  return (
    <details class="menudd">
      <summary class="btn sm" aria-label="Menu">≡</summary>
      <div class="menudd-list">
        {item("Title screen", H.showMenu)}
        {fsEnabled() ? item(fsActive() ? "Exit full screen" : "Full screen", toggleFullscreen) : null}
        {item("Report a bug or an idea", () => {
          S.reportKind = "bug";
          S.reporting = true;
          bumpData();
        })}
        {S.game?.kind === "test" && S.live ? item("Back to the live world", H.backToLive) : null}
      </div>
    </details>
  );
}

export function setSpeed(i: number): void {
  if (S.game?.kind === "test") S.speed = i;
  bumpData();
}
