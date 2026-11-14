import type { JSX } from "preact";
import { brokeredLoads } from "../books.js";
import { MENUS } from "../copy-menus.js";
import { brokerageStage, brokerageWindow } from "../screenwindows.js";
import { bumpData, S, useData } from "../state.js";
import { Btn } from "./bits.js";
import { Window } from "./Window.js";

/**
 * A hero moment (the menu system §1.3, §2.2): a 16:9 painting over a dimmed screen, only for moments, never a working
 * screen: a truck bought (`mkt-keys`), a brokerage reaching its next stage. It fades in (300 ms in Full, 120 in Calm, at
 * once in Still), its loop starts after it lands, and a tap anywhere or OK dismisses it. Nothing waits on it: the act
 * that raised it has already happened.
 */
export interface Hero {
  name: string;
  title: string;
  line?: string;
}
let hero: Hero | null = null;
export function showHero(h: Hero): void {
  hero = h;
  bumpData();
}
const dismiss = (): void => {
  hero = null;
  bumpData();
};

/** The stage each brokerage was last seen at, so reaching the next one is a moment once. */
const stageSeen = new Map<number, number>();
function watchStage(): void {
  const g = S.game;
  const b = g?.brokerage;
  if (!g || !b) return;
  const stage = brokerageStage(brokeredLoads(g.w, b));
  const was = stageSeen.get(b.id);
  stageSeen.set(b.id, stage);
  if (was !== undefined && stage > was) showHero({ name: brokerageWindow(stage), title: MENUS.heroStage(stage) });
}

export function HeroMoment(): JSX.Element | null {
  useData();
  watchStage();
  if (!hero) return null;
  const h = hero;
  return (
    <div class="heroscrim" role="dialog" aria-label={h.title} onClick={dismiss}>
      <div class="herocard" onClick={(ev) => ev.stopPropagation()}>
        <Window key={h.name} name={h.name} fallback="yard" class="hero" />
        <h2>{h.title}</h2>
        {h.line ? <p class="muted">{h.line}</p> : null}
        <div class="row">
          <span class="grow" />
          <Btn primary onClick={dismiss}>
            {MENUS.heroOk}
          </Btn>
        </div>
      </div>
    </div>
  );
}
