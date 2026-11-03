import type { ComponentChildren, JSX } from "preact";
import { createPortal } from "preact/compat";
import { useRef } from "preact/hooks";
import { EXPLAIN, EXPLAIN_HEAD, NOW } from "../copy.js";
import { breakdown, type FigureCtx } from "../explain.js";
import { GAME_CONFIG } from "../game.js";
import { bumpData, isPhone, S, useData } from "../state.js";
import { Btn } from "./bits.js";
import { Iuliia } from "./Walkthrough.js";
import { askWhatNow } from "./WhatNow.js";

/**
 * Help on every figure (specs/guidance.md section 2, guidance-ux.md section 3). A covered figure is a `Fig`: a dotted
 * underline and a 44 px target; a tap opens the explain sheet. The sheet rises from the bottom to at most 60% of the
 * screen; first the page's foot is padded by its height and the figure scrolled to the top, so the sheet never covers it
 * (U1), and the figure keeps an accent outline while it's open. Plain throughout: no joke in any of it.
 */
export function Fig({ k, ctx = {}, label, children }: { k: string; ctx?: FigureCtx; label: string; children: ComponentChildren }): JSX.Element {
  return (
    <button type="button" class="fig" data-explain={k} onClick={(e) => openExplain(k, ctx, label, (e.currentTarget as HTMLElement).textContent ?? "", e.currentTarget as HTMLElement)}>
      {children}
    </button>
  );
}

let lit: HTMLElement | null = null;
function openExplain(key: string, ctx: FigureCtx, label: string, value: string, el: HTMLElement): void {
  closeExplain(false);
  // On the laptop the card takes the corner away from the figure: the map's side for a figure in the panel.
  S.explain = { key, ctx, label, value, side: el.closest(".side") ? "left" : "right", tab: S.tab };
  lit = el;
  el.classList.add("figon");
  // Pad the page's foot by the sheet's height, then bring the figure to the top: the sheet can never sit on it. On the
  // phone the rack opens full first, so the figure's top is near the screen's and the sheet's 60% stays below it.
  const box = el.closest(".panelbox") as HTMLElement | null;
  if (box) box.style.paddingBottom = "62vh";
  if (isPhone() && S.sheet !== "full") S.sheet = "full";
  // The phone's Back gesture closes it: the sheet pushes one history entry (guidance-ux.md section 3).
  if (!history.state?.explain) history.pushState({ ...(history.state ?? {}), explain: true }, "");
  bumpData();
  requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
}
function closeExplain(bump = true, fromBack = false): void {
  lit?.classList.remove("figon");
  lit = null;
  for (const b of document.querySelectorAll<HTMLElement>(".panelbox")) b.style.paddingBottom = "";
  const was = S.explain !== null;
  S.explain = null;
  // Closed any other way: take back the history entry it pushed, so Back doesn't land on nothing.
  if (was && !fromBack && history.state?.explain) history.back();
  if (bump) bumpData();
}
// Back and Escape close it (in a page; tests load this module without one).
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => S.explain && closeExplain(true, true));
  window.addEventListener("keydown", (ev) => ev.key === "Escape" && S.explain && closeExplain());
}

/** The explain sheet: the figure, what it is, how it's computed with this company's inputs, what moves it, and What now?. */
export function ExplainSheet(): JSX.Element | null {
  useData();
  const down = useRef<number | null>(null);
  const e = S.explain;
  const g = S.game;
  if (!e || !g) return null;
  // A tab change closes it (the player's first month: it trapped them until a reload).
  if (e.tab && e.tab !== S.tab) {
    queueMicrotask(() => closeExplain());
    return null;
  }
  const c = g.player;
  const entry = EXPLAIN(GAME_CONFIG)[e.key];
  if (!entry) return null;
  const b = c ? breakdown(g.w, c, e.key, e.ctx) : null;
  const other = e.key.endsWith(".other");
  // At the page's top level (inside the phone's sheet it fell under the tab bar). Five ways out on a phone
  // (guidance-ux.md section 3): Close in the pinned foot; the × in the header; a tap outside, on a transparent layer
  // that stops above the nav; a swipe down on the header or its grab bar; a tab change. Plus Back and Escape.
  const swipe = {
    onPointerDown: (ev: PointerEvent) => (down.current = ev.clientY),
    onPointerUp: (ev: PointerEvent) => {
      if (down.current !== null && ev.clientY - down.current > 60) closeExplain();
      down.current = null;
    },
  };
  return createPortal(
    <>
    <div class="explainscrim" aria-hidden="true" onClick={() => closeExplain()} />
    <section class={`explainsheet ${e.side ?? "right"}`} role="dialog" aria-label={e.label}>
      <header class="explainhead" {...swipe}>
        <span class="grab" aria-hidden="true" />
        <div class="row">
          <Iuliia mood="point" size={64} />
          <div class="stack grow">
            <span class="label">{e.label}</span>
            <b class="bighead">{e.value}</b>
          </div>
          <button type="button" class="explainx" aria-label="Close" onClick={() => closeExplain()}>
            ×
          </button>
        </div>
      </header>
      <div class="explainbody">
      <p class="label">{EXPLAIN_HEAD.what}</p>
      <p class="small">{entry.what}</p>
      {!other ? (
        <>
          <p class="label">{EXPLAIN_HEAD.how}</p>
          <p class="small">{entry.how}</p>
          {b ? (
            <div class="explainrows">
              {b.rows.map((r, i) => (
                <div class="kvrow" key={i}>
                  <span class="small">{r.label}</span>
                  {r.key && EXPLAIN(GAME_CONFIG)[r.key] ? (
                    <button type="button" class="fig" onClick={() => (S.explain = { key: r.key!, ctx: e.ctx, label: r.label, value: r.value, side: e.side, tab: e.tab }, bumpData())}>
                      {r.value}
                    </button>
                  ) : (
                    <span class="num">{r.value}</span>
                  )}
                </div>
              ))}
              <div class="kvrow">
                <b class="small">{b.total.label}</b>
                <b class="num">{b.total.value}</b>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      <p class="label">{EXPLAIN_HEAD.moves}</p>
      <p class="small">{entry.moves}</p>
      </div>
      <div class="row explainfoot">
        <Btn sm onClick={() => (closeExplain(), askWhatNow())}>{NOW.chip}</Btn>
        <Btn sm ghost onClick={() => closeExplain()}>
          Close
        </Btn>
      </div>
    </section>
    </>,
    document.body,
  );
}
