import type { JSX } from "preact";
import { brokeredLoads } from "../books.js";
import { MENUS } from "../copy-menus.js";
import { brokerageStage, brokerageWindow } from "../screenwindows.js";
import { bumpData, push, S, setTab, toast, truckNo, useData } from "../state.js";
import { FIXES } from "../copy-fixes.js";
import { fdFull } from "../format.js";
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
  /**
   * A serious sheet, not a celebration (UX next-screens §3.3, the repossession): always calm (a fade, no loop), its facts on
   * paper, and a second button to where the player can act.
   */
  serious?: true;
  action?: { label: string; run: () => void };
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

/**
 * Batch M1 (the player's pass: BUY · 25,512 FD and no hero): a truck bought is a hero moment whichever way it came, an
 * order delivered or a used rig handed over at once (which raises no delivery event), so the page watches the
 * company's owned trucks and plays it for each new one. The fleet as first seen in a session plays nothing.
 */
const ownedSeen = new WeakMap<object, Set<number>>();
function watchTrucks(): void {
  const g = S.game;
  const c = g?.player;
  if (!g || !c) return;
  const owned = (g.w.trucksByCompany.get(c.id) ?? []).filter((t) => t.lease === "owned" && t.status !== "retired" && t.status !== "listed").map((t) => t.id);
  const seen = ownedSeen.get(g);
  if (!seen) {
    ownedSeen.set(g, new Set(owned));
    return;
  }
  for (const id of owned) {
    if (seen.has(id)) continue;
    seen.add(id);
    showHero({ name: "mkt-keys", title: MENUS.heroTruck(truckNo(id)) });
  }
}

/**
 * The player's long runs, item 1 (the truck and its driver gone with no word): the lender taking a truck is a serious
 * sheet (UX next-screens §3.3), read from the loans themselves, so it shows whichever path took it (a purchase loan's
 * seizure, an equipment loan's repossession) and a reload's replay plays nothing: the loans as first seen in a session are
 * where it starts.
 */
const loansSeen = new WeakMap<object, Map<string, string>>();
function watchLoans(): void {
  const g = S.game;
  const c = g?.player;
  if (!g || !c) return;
  const w = g.w;
  const now = new Map<string, string>();
  for (const l of w.purchaseLoans) if (l.borrowerId === c.id) now.set(`p${l.id}`, l.status);
  for (const l of w.finance.loans) if (l.borrowerId === c.id) now.set(`e${l.id}`, l.status);
  const seen = loansSeen.get(g);
  loansSeen.set(g, now);
  if (!seen) return;
  for (const l of w.purchaseLoans) {
    const was = seen.get(`p${l.id}`);
    const t = l.truckId ? w.trucks[l.truckId - 1] : undefined;
    // Seized: closed after missed payments, its truck off the books (purchaseLoans.ts seize).
    if (l.borrowerId === c.id && was !== undefined && was !== "closed" && l.status === "closed" && l.missed > 0 && t && t.companyId === 0) {
      showHero({ name: "mkt-repo", title: FIXES.repoTitle(truckNo(t.id)), line: FIXES.repoSeized(truckNo(t.id), l.missed), serious: true, action: { label: FIXES.repoSeeLoans, run: () => setTab("finance") } });
      return;
    }
  }
  for (const l of w.finance.loans) {
    const was = seen.get(`e${l.id}`);
    if (l.borrowerId === c.id && was !== undefined && was !== "repossessed" && l.status === "repossessed") {
      showHero({ name: "mkt-repo", title: FIXES.repoTitle(truckNo(l.truckId)), line: FIXES.repoListed(truckNo(l.truckId), l.missed), serious: true, action: { label: FIXES.repoSeeLoans, run: () => setTab("finance") } });
      return;
    }
  }
}

/**
 * The player's long runs, item 6 (auto-staff hired a 1,485 FD a week manager without a word): every hire into the player's
 * company that the player didn't make by hand (S.handHires) is said, with its wage. The staff as first seen in a session
 * say nothing.
 */
const staffSeen = new WeakMap<object, Set<number>>();
function watchHires(): void {
  const g = S.game;
  const c = g?.player;
  if (!g || !c) return;
  const now = (g.w.staffByCompany.get(c.id) ?? []).filter((s) => s.status === "employed" && !s.owner);
  const seen = staffSeen.get(g);
  if (!seen) {
    staffSeen.set(g, new Set(now.map((s) => s.id)));
    return;
  }
  for (const s of now) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    if (S.handHires.delete(s.id)) continue;
    const line = FIXES.autoHired(s.name, FIXES.staffKind[s.kind] ?? s.kind, fdFull(s.pay));
    push(g, line, "warn");
    toast(line);
  }
}

export function HeroMoment(): JSX.Element | null {
  useData();
  watchStage();
  watchTrucks();
  watchHires();
  watchLoans();
  if (!hero) return null;
  const h = hero;
  return (
    <div class={h.serious ? "heroscrim serious" : "heroscrim"} role="dialog" aria-label={h.title} onClick={dismiss}>
      <div class="herocard" onClick={(ev) => ev.stopPropagation()}>
        <Window key={h.name} name={h.name} fallback="yard" class="hero" still={h.serious === true} />
        <h2>{h.title}</h2>
        {h.line ? <p class={h.serious ? "paperline" : "muted"}>{h.line}</p> : null}
        <div class="row">
          <span class="grow" />
          {h.action ? (
            <Btn
              onClick={() => {
                const run = h.action!.run;
                dismiss();
                run();
              }}
            >
              {h.action.label}
            </Btn>
          ) : null}
          <Btn primary onClick={dismiss}>
            {MENUS.heroOk}
          </Btn>
        </div>
      </div>
    </div>
  );
}
