import type { JSX } from "preact";
import { createPortal } from "preact/compat";
import { useRef } from "preact/hooks";
import { CONFIRM } from "../copy.js";
import { cushion } from "../figures.js";
import { fdFull } from "../format.js";
import { GAME_CONFIG } from "../game.js";
import { bumpData, isPhone, me, S, useData } from "../state.js";
import { Btn } from "./bits.js";

/**
 * The confirm card (the director's R6, player2-ux.md section 1; the writer's copy-player2.md): before anything that
 * can't be undone, or that spends more than guard.confirmShareOfCash of cash, four lines (what it costs, what's left
 * with the cushion after, what it does, the one risk) and a foot with Not now and the act. It opens as the explain
 * sheet does, standing on the nav at most 60% high, and its confirm ignores the tap that opened it: any touch begun
 * before it opened, and anything for ui.tapSettleMs after.
 */
export interface ConfirmSpec {
  /** "Buy", "Scrap", "Hire": the act, for the title and the button. */
  verb: string;
  /** "this truck", "truck 2": the title's object. */
  item: string;
  /** What leaves cash now; null for an act that costs nothing today (a sale, a lease's weekly minimum is in `costLine`). */
  costFd: number | null;
  /** A cost said another way: a hire's weekly wage, a contract's terms. */
  costLine?: string;
  does: string;
  risk: string | null;
  /** The confirm button's words, when not "{verb} · {fd} FD". */
  go?: string;
  destructive?: boolean;
  run: () => void;
}

/** Opens the card for an act that always asks (the list in player2-ux.md section 1). `ev` is the opening tap. */
export function confirmAct(spec: ConfirmSpec, ev?: MouseEvent): void {
  // Never under the first tap (QA's R6 replay): the confirm sits at the foot's right, Not now at its left. When the tap
  // landed in the foot's band on the right half, they swap, so Not now takes the spot the thumb is on.
  const inFoot = typeof window !== "undefined" && ev !== undefined && ev.clientY > window.innerHeight - 140;
  const swap = inFoot && ev!.clientX > window.innerWidth / 2;
  S.confirm = { ...spec, openedAt: performance.now(), swap, tab: S.tab };
  // The item stays in sight above the card (player2-ux.md section 1): pad the page's foot by the card's height, open the
  // phone's rack full, and bring the tapped control to the top, as the explain sheet does.
  const el = ev?.currentTarget as HTMLElement | undefined;
  if (el) {
    const box = el.closest(".panelbox") as HTMLElement | null;
    if (box) box.style.paddingBottom = "62vh";
    if (isPhone() && S.sheet !== "full") S.sheet = "full";
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start" });
      // Client batch 8a item 7 (the exploit hunter: the loan's confirm opened in the window's far corner, below the fold
      // of the pane, and was pressed three times unseen): on a laptop the card opens just under the control that was
      // tapped, kept inside the window, so it is where the eye already is.
      if (!isPhone() && S.confirm && typeof window !== "undefined" && window.innerWidth >= 900) {
        const r = el.getBoundingClientRect();
        const left = Math.max(16, Math.min(r.left, window.innerWidth - 336));
        const top = Math.max(16, Math.min(r.bottom + 8, window.innerHeight - 260));
        S.confirm = { ...S.confirm, anchor: { top, left } };
        bumpData();
      }
    });
  }
  bumpData();
}

/** Any other spend: the card only when it passes guard.confirmShareOfCash of cash; else it just runs. */
export function confirmSpend(spec: ConfirmSpec, ev?: MouseEvent): void {
  const w = S.game!.w;
  const cash = w.ledger.balance(`co:${me().id}`);
  if (spec.costFd !== null && spec.costFd > GAME_CONFIG.guard.confirmShareOfCash * Math.max(0, cash)) confirmAct(spec, ev);
  else spec.run();
}

function close(): void {
  S.confirm = null;
  for (const b of document.querySelectorAll<HTMLElement>(".panelbox")) b.style.paddingBottom = "";
  bumpData();
}

/** The card itself, at the page's top level beside the explain sheet. */
export function ConfirmSheet(): JSX.Element | null {
  useData();
  const down = useRef<number>(0);
  const s = S.confirm;
  const g = S.game;
  if (!s || !g?.player) return null;
  if (s.tab !== S.tab) {
    queueMicrotask(close);
    return null;
  }
  const w = g.w;
  const c = g.player;
  const cash = w.ledger.balance(`co:${c.id}`);
  const after = cash - (s.costFd ?? 0);
  const avg = cushion(w, c).avgWeeklyFd;
  const weeks = avg > 0.5 ? Math.max(0, after) / avg : null;
  const tone = after < 0 || (weeks !== null && weeks < 1) ? "bad" : weeks !== null && weeks < 2 ? "warn" : "";
  // Nothing offers what it won't give (R7): a spend cash can't cover says so, and its confirm is off.
  const short = s.costFd !== null && after < 0 ? -after : 0;
  const settle = GAME_CONFIG.ui.tapSettleMs;
  const confirm = () => {
    // Inert for the settle time, and for a touch that began before the card opened.
    if (short > 0 || performance.now() - s.openedAt < settle || down.current < s.openedAt) return;
    close();
    s.run();
  };
  const go = (
    <Btn sm primary={!s.destructive} danger={s.destructive} disabled={short > 0} onPointerDown={() => (down.current = performance.now())} onClick={confirm}>
      {s.go ?? CONFIRM.go(s.verb, fdFull(s.costFd ?? 0))}
    </Btn>
  );
  const cancel = (
    <Btn sm ghost onClick={close}>
      {CONFIRM.cancel}
    </Btn>
  );
  return createPortal(
    <>
      <div class="explainscrim" aria-hidden="true" onClick={close} />
      <section
        class="explainsheet right confirmsheet"
        role="dialog"
        aria-label={CONFIRM.title(s.verb, s.item)}
        style={s.anchor ? { top: `${s.anchor.top}px`, left: `${s.anchor.left}px`, right: "auto", bottom: "auto", maxHeight: `calc(100vh - ${s.anchor.top + 16}px)` } : undefined}
      >
        <header class="explainhead">
          <span class="grab" aria-hidden="true" />
          <b class="bighead">{CONFIRM.title(s.verb, s.item)}</b>
        </header>
        <div class="explainbody">
          {s.costLine === "" ? null : <p class="small">{s.costLine ?? CONFIRM.cost(fdFull(s.costFd ?? 0))}</p>}
          {s.costFd !== null ? <p class={`small ${tone}`}>{weeks === null ? CONFIRM.afterNoWeeks(fdFull(after)) : CONFIRM.after(fdFull(after), weeks.toFixed(1))}</p> : null}
          {short > 0 ? (
            <p class="small bad">{CONFIRM.short(fdFull(s.costFd ?? 0), fdFull(cash))}</p>
          ) : weeks !== null && weeks < w.cfg.guide.gapCushionWeeks && s.costFd !== null ? (
            <p class="small bad">{CONFIRM.lowCushion(w.cfg.guide.gapCushionWeeks)}</p>
          ) : null}
          <p class="label">{CONFIRM.does}</p>
          <p class="small">{s.does}</p>
          {s.risk ? (
            <>
              <p class="label">{CONFIRM.risk}</p>
              <p class="small">{s.risk}</p>
            </>
          ) : null}
        </div>
        <div class="row explainfoot">
          {s.swap ? go : cancel}
          <span class="grow" />
          {s.swap ? cancel : go}
        </div>
      </section>
    </>,
    document.body,
  );
}
