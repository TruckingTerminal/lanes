import type { JSX } from "preact";
import { reserveOn, type Company } from "@lanes/engine";
import { RESERVE } from "../copy-reserve.js";
import { fdFull, weekday } from "../format.js";
import { depositLines, depositSheet, reserveCard, withdrawAfterLine, withdrawSheet } from "../reserveui.js";
import { act, bumpData, me, S, toast, useData } from "../state.js";
import { Fig } from "./Explain.js";
import { Btn, Card } from "./bits.js";

/**
 * The Reserve on Money (UX next-screens §3.8): the card, its two half sheets, and the toast when a withdrawal lands. The
 * figures are reserveui.ts's, from the engine's own rules. Deposit and Withdraw act at once, with no Confirm: a deposit
 * is undone by a withdrawal at the cost of a day, and the delay is said on the sheet, the card's foot and the settling row.
 */

let sheet: "deposit" | "withdraw" | null = null;
let field = "";

/** Opens a sheet with the field at its default (the deposit's: the smaller of the room and the cash over the free line). */
export function openReserveSheet(k: "deposit" | "withdraw" | null): void {
  sheet = k;
  const g = S.game;
  if (g && k) {
    const c = me();
    const d = k === "deposit" ? depositSheet(g.w, c).dflt : withdrawSheet(g.w, c).dflt;
    field = d !== null ? String(d) : "";
  }
  bumpData();
}

/** §3.8, the card: the balance, the shelter and its bar, the phase and room lines, what's settling, the buttons and the foot. */
export function ReserveCardView({ c }: { c: Company }): JSX.Element | null {
  const x = reserveCard(S.game!.w, c);
  if (!x) return null;
  return (
    <Card class="reservecard" title={RESERVE.title}>
      <p class="bigcash">
        <Fig k="money.reserve" label={RESERVE.title}>
          {RESERVE.balance(fdFull(x.balance))}
        </Fig>
      </p>
      {x.cap >= 0.5 ? (
        <>
          <p class="small">
            <Fig k="money.reserveShelter" label={RESERVE.title}>
              {RESERVE.sheltered(fdFull(x.sheltered), fdFull(x.cap))}
            </Fig>
          </p>
          <ReserveBar x={x} />
        </>
      ) : null}
      <p class="small muted">{x.shelterLine}</p>
      {x.waitingLine ? <p class="small muted">{x.waitingLine}</p> : null}
      {x.overLine ? <p class="small warn">{x.overLine}</p> : null}
      {x.phaseLine ? <p class="small">{x.phaseLine}</p> : null}
      {x.roomLine ? <p class="small">{x.roomLine}</p> : null}
      {x.settling.map((s, i) => (
        <p key={`${s.day}:${s.fd}:${i}`} class="small reservesettle">
          <Fig k="money.reserveSettling" label={RESERVE.title}>
            {s.text}
          </Fig>
        </p>
      ))}
      <div class="row">
        <Btn primary onClick={() => openReserveSheet("deposit")}>
          {RESERVE.deposit}
        </Btn>
        <Btn disabled={x.balance < 0.5} onClick={() => openReserveSheet("withdraw")}>
          {RESERVE.withdraw}
        </Btn>
      </div>
      {x.foot.map((f) => (
        <p key={f} class="muted small">
          {f}
        </p>
      ))}
    </Card>
  );
}

/**
 * UX §3.8's bar, static, full at the cap: what's sheltered; put in this week and waiting for its first full week (hatched
 * grey); over the cap (amber). Past the cap, the bar is the balance.
 */
function ReserveBar({ x }: { x: NonNullable<ReturnType<typeof reserveCard>> }): JSX.Element {
  const total = Math.max(x.cap, x.balance, 1);
  const w = (fd: number) => `${Math.round((Math.max(0, fd) / total) * 1000) / 10}%`;
  return (
    <span class="bar reservebar" aria-hidden="true">
      <i style={{ width: w(x.sheltered) }} />
      {x.waiting >= 0.5 ? <i class="waiting" style={{ width: w(x.waiting) }} /> : null}
      {x.overCap >= 0.5 ? <i class="over" style={{ width: w(x.overCap) }} /> : null}
    </span>
  );
}

/** §3.8's two sheets, over the page (a half sheet on a phone, the rack's panel on a laptop). */
export function ReserveSheet(): JSX.Element | null {
  useData();
  const g = S.game;
  if (!g || !sheet || !reserveOn(g.w)) return null;
  const w = g.w;
  const c = me();
  const fd = Number(field);
  const valid = field.trim() !== "" && Number.isFinite(fd) && fd > 0;
  const close = () => openReserveSheet(null);
  const set = (v: number) => {
    field = String(Math.round(v * 100) / 100);
    bumpData();
  };
  const input = (label: string) => (
    <label class="row reservefield">
      <input
        type="number"
        inputMode="decimal"
        min="1"
        step="1"
        value={field}
        aria-label={label}
        onInput={(ev) => {
          field = (ev.currentTarget as HTMLInputElement).value;
          bumpData();
        }}
      />
      <span class="num">{RESERVE.amount}</span>
    </label>
  );
  const chips = (list: { label: string; fd: number }[], whole: boolean) =>
    list.length ? (
      <div class="row reservechips">
        {list.map((ch) => (
          <button type="button" class="chip" key={ch.label} onClick={() => set(whole ? Math.floor(ch.fd) : ch.fd)}>
            {ch.label}
          </button>
        ))}
      </div>
    ) : null;
  const head = (title: string) => (
    <div class="row">
      <strong class="grow">{title}</strong>
      <Btn sm ghost label={RESERVE.close} onClick={close}>
        ×
      </Btn>
    </div>
  );
  if (sheet === "deposit") {
    const s = depositSheet(w, c);
    const out = valid ? depositLines(w, c, fd) : null;
    const tooMuch = valid && fd > s.cash + 0.005;
    return (
      <div class="heroscrim reservescrim" role="dialog" aria-label={RESERVE.depositTitle} onClick={close}>
        <div class="herocard reservesheet" onClick={(ev) => ev.stopPropagation()}>
          {head(RESERVE.depositTitle)}
          {input(RESERVE.depositTitle)}
          {chips(s.chips, true)}
          {out?.lines.map((l) => (
            <p key={l} class="small">
              {l}
            </p>
          ))}
          {out?.warns.map((l) => (
            <p key={l} class="small warn">
              {l}
            </p>
          ))}
          {s.disabled ? <p class="small muted">{s.disabled}</p> : null}
          <Btn
            primary
            disabled={s.disabled !== null || !valid || tooMuch}
            onClick={() => {
              act({ type: "reserve_deposit", fd }, RESERVE.depositDone(fdFull(fd)));
              close();
            }}
          >
            {RESERVE.deposit}
          </Btn>
        </div>
      </div>
    );
  }
  const s = withdrawSheet(w, c);
  const tooMuch = valid && fd > s.balance + 0.005;
  return (
    <div class="heroscrim reservescrim" role="dialog" aria-label={RESERVE.withdrawTitle} onClick={close}>
      <div class="herocard reservesheet" onClick={(ev) => ev.stopPropagation()}>
        {head(RESERVE.withdrawTitle)}
        {input(RESERVE.withdrawTitle)}
        {chips(s.chips, false)}
        <p class="small">{s.when}</p>
        {valid && !tooMuch && withdrawAfterLine(w, c, fd) !== null ? <p class="small">{withdrawAfterLine(w, c, fd)}</p> : null}
        <Btn
          primary
          disabled={!valid || tooMuch}
          onClick={() => {
            act({ type: "reserve_withdraw", fd: Math.min(fd, s.balance) }, RESERVE.withdrawDone(fdFull(fd), weekday(s.settleDay)));
            close();
          }}
        >
          {RESERVE.withdraw}
        </Btn>
      </div>
    </div>
  );
}

/** Withdraws what cash is short at once (Needs you's and the cash card's button): it lands the next day. */
export function withdrawShort(shortFd: number, after: string): void {
  act({ type: "reserve_withdraw", fd: shortFd }, after);
}

/** The settling withdrawals as last seen, per sitting and company, so a landing toasts once ("in cash", UX §3.8's motion). */
const outSeen = new WeakMap<object, Map<number, string[]>>();
/** The FD that landed in cash since the last look, and this look remembered (the sitting's first look lands nothing). */
export function reserveLanded(): number {
  const g = S.game;
  const c = g?.player;
  if (!g || !c || !reserveOn(g.w)) return 0;
  const now = (c.reserveOut ?? []).map((x) => `${x.day}:${x.fd}`);
  let seen = outSeen.get(g);
  if (!seen) outSeen.set(g, (seen = new Map()));
  const was = seen.get(c.id);
  seen.set(c.id, now);
  if (!was || c.liquidatingSince !== null) return 0;
  const left = [...was];
  for (const k of now) {
    const i = left.indexOf(k);
    if (i >= 0) left.splice(i, 1);
  }
  return left.reduce((s, k) => s + Number(k.slice(k.indexOf(":") + 1)), 0);
}
export function watchReserveLanding(): void {
  const landed = reserveLanded();
  if (landed >= 0.5) toast(RESERVE.landed(fdFull(landed)));
}
