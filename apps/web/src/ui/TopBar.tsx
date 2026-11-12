import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { companyAccount, type Company } from "@lanes/engine";
import { cls, fdFull, hhmm, shortDate, weekday } from "../format.js";
import { BROKERAGE, FIRST_ENTRY, NEEDS } from "../copy.js";
import { PENDING } from "../copy-pending.js";
import { hasTwo, kindInView, switchCompany, type CompanyKind } from "../companies.js";
import { ASSETS } from "../mapart.js";
import { H } from "../handlers.js";
import { needs as waiting, nextRoundHour, openNeed } from "../logic.js";
import { bumpData, clockMin, fsActive, fsEnabled, S, SPEEDS, toggleFullscreen, useData, useTick } from "../state.js";
import { Badge, Btn } from "./bits.js";
import { choosing } from "./ChooseHub.js";

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
  const needs = waiting();
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
    <>
    <header class={cls("topbar", hasTwo(g) && `co-${kindInView(g)}`)}>
      <CompanySwitch />
      <Clock />
      {c ? <span class={cls("cash num", bal < 0 && "bad")}>{fdFull(bal)} FD</span> : choosing() ? null : <Badge>Watching</Badge>}
      {needs.length ? <NeedsButton /> : null}
      {c && c.authority.status !== "active" ? <Badge tone="alert">{c.authority.status === "revoked" ? "Authority revoked" : "Suspended"}</Badge> : null}
      {g.kind === "live" && g.broken ? <Badge tone="alert" title={g.broken.reason}>World stopped</Badge> : null}
      <span class="grow" />
      {g.kind === "test" ? <Speeds /> : null}
      <Menu />
    </header>
    {/* QA's 0.24.1 replay, item 4: the watching tab says so for as long as it watches, not in a toast alone. */}
    {g.kind === "test" && S.testWatching ? <div class="watchbar" role="status">{PENDING.testWatching}</div> : null}
    </>
  );
}

/**
 * The company switch (brokerage-ux.md section 1): a chip at the left of the strip, only once the player has two
 * companies. Its ring is the company's colour; on a laptop it names the company. A tap opens both, one row each; the
 * other one's row switches at once.
 */
function CompanySwitch(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const g = S.game!;
  if (!hasTwo(g)) return null;
  const c = g.player!;
  const kind = kindInView(g);
  const rows: [CompanyKind, Company][] = [
    ["carrier", g.carrier!],
    ["brokerage", g.brokerage!],
  ];
  return (
    <span class="needswrap" ref={wrap}>
      <button type="button" class={cls("coswitch", `co-${kind}`)} aria-label={BROKERAGE.chipLabel(c.name)} aria-expanded={open} onClick={() => setOpen(!open)}>
        <img class="px" src={`${ASSETS}icons/switch16.png`} width={32} height={32} alt="" />
        <span class="coname">{BROKERAGE.chipLaptop(c.name)}</span>
      </button>
      {open ? (
        <div class="needslist" role="menu" aria-label={BROKERAGE.sheetTitle}>
          {rows.map(([k, co]) => (
            <button
              type="button"
              role="menuitem"
              key={k}
              class={`co-${k}`}
              onClick={() => {
                setOpen(false);
                switchCompany(k);
              }}
            >
              <span>{BROKERAGE.row(co.name, k === "carrier" ? BROKERAGE.kindCarrier : BROKERAGE.kindBrokerage, fdFull(g.w.ledger.balance(companyAccount(co.id))))}</span>
              {k === kind ? <span class="chev">{BROKERAGE.inView}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

/** The red count: one thing waiting opens it; more open a short list, each row opening its own (Jeff, 2026-11-02). */
function NeedsButton(): JSX.Element {
  const list = waiting();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  // A tap anywhere else, or Escape, closes the list.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const tap = () => (list.length === 1 ? openNeed(list[0]!) : setOpen(!open));
  return (
    <span class="needswrap" ref={wrap}>
      <button type="button" class="alertdot" aria-label={NEEDS.badge(list.length)} aria-expanded={list.length > 1 ? open : undefined} onClick={tap}>
        {list.length}
      </button>
      {open && list.length > 1 ? (
        <div class="needslist" role="group" aria-label={NEEDS.title}>
          {list.map((n) => (
            <div class="needrow" key={n.key} data-key={n.key}>
              <img class="px" src={`${ASSETS}icons/${n.company === "brokerage" ? "book" : n.icon}.png`} width={16} height={16} alt="" />
              <button
                type="button"
                class="needline"
                onClick={() => {
                  setOpen(false);
                  openNeed(n);
                }}
              >
                {n.company ? <span class="muted small">{n.company === "carrier" ? BROKERAGE.kindCarrier : BROKERAGE.kindBrokerage} · </span> : null}
                {n.text}
              </button>
              {/* R9: every row carries its action; it acts where it can, else it opens the card with the fix. */}
              <Btn
                sm
                primary
                class="needact"
                onClick={(ev: MouseEvent) => {
                  setOpen(false);
                  if (n.company && S.game && kindInView(S.game) !== n.company) switchCompany(n.company);
                  if (n.run) n.run(ev);
                  else openNeed(n);
                }}
              >
                {n.button}
              </Btn>
            </div>
          ))}
        </div>
      ) : null}
    </span>
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
          <Btn key={sp.icon} sm on={S.speed === i} title={S.speed === i ? `${sp.title} (now)` : sp.title} onClick={() => setSpeed(i)}>
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
