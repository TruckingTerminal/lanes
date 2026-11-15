import type { JSX } from "preact";
import { brokeredLoads } from "../books.js";
import { MENUS } from "../copy-menus.js";
import { brokerageStage, brokerageWindow } from "../screenwindows.js";
import { bumpData, push, S, setTab, toast, truckNo, useData } from "../state.js";
import { FIXES } from "../copy-fixes.js";
import { fdFull } from "../format.js";
import { Btn } from "./bits.js";
import { Window } from "./Window.js";
import { standingMarkets } from "@lanes/engine";
import { STANDING, STANDING_UX } from "../copy-standing.js";
import { milestoneAt, standingShown } from "../standingui.js";
import { TierBadge } from "./Standing.js";
import { CityPicture } from "./CityPicture.js";
import { Iuliia } from "./Walkthrough.js";

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
  /** Standing's moments (UX §1.6): the new tier's badge at 128, the market's own city in place of a painting, Iuliia's face. */
  badge?: { tier: number; band: "approved" | "preferred" | "core" };
  city?: number;
  face?: "proud" | "concerned";
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
 * Standing's moments (UX next-screens §1.6), read from the scorecards whenever the page draws:
 * - a milestone reached is a hero on the painting of what it opens (3 the appointment wall, 5 the bank, 7 the shipper's
 *   office, 9 a rate confirmation, 10 the market's own city), its badge at 128 and Iuliia's line;
 * - any other step up is a toast, and a step down a toast with its cause (Iuliia's falling line comes with the engine's
 *   event, main.tsx);
 * - one per review: the highest milestone gets the hero, and the review's other changes one toast.
 * The tiers as first seen in a session play nothing; a milestone reached while away plays once when the Standing screen
 * opens (checkMissedMoments), from the tiers this browser last saw for this world and company.
 */
const MOMENT_PAINTING: Record<number, string> = { 3: "shp-appt-wall", 5: "bank", 7: "shp-office", 9: "brk-ratecon" };
const tiersSeen = new WeakMap<object, Map<number, number>>();
type Game = NonNullable<typeof S.game>;
const seenKey = (g: Game) => `lanes.standing.seen.${g.kind}.${g.w.seed}.${g.player!.id}`;
function storeSeen(g: Game, now: Map<number, number>): void {
  try {
    localStorage.setItem(seenKey(g), JSON.stringify([...now]));
  } catch {
    /* a private window: the moments last the sitting */
  }
}
function readSeen(g: Game): Map<number, number> | null {
  try {
    const v = localStorage.getItem(seenKey(g));
    return v ? new Map(JSON.parse(v) as [number, number][]) : null;
  } catch {
    return null;
  }
}
const tiersNow = (g: Game): Map<number, number> => new Map(standingMarkets(g.w, g.player!).map((hub) => [hub, g.player!.standing![hub]!.tier]));

function standingHero(g: Game, hub: number, tier: number): void {
  const w = g.w;
  const market = w.net.hubs[hub]!.name;
  const band = tier >= 9 ? "core" : tier >= 5 ? "preferred" : "approved";
  showHero({
    name: MOMENT_PAINTING[tier] ?? "shp-office",
    ...(tier === 10 ? { city: hub } : {}),
    title: STANDING_UX.heroPaper(market, STANDING.band[band], tier),
    line: STANDING.iuliiaMilestone(market, tier) ?? undefined,
    badge: { tier, band },
    face: "proud",
    action: {
      label: STANDING_UX.heroLadder,
      run: () => {
        S.ladder = hub;
        setTab("standing");
      },
    },
  });
}

/** The moments between two readings of the tiers; `downs` false for a check after time away (rises only). */
function tierMoments(g: Game, before: Map<number, number>, now: Map<number, number>, downs: boolean): void {
  const w = g.w;
  const ups: { hub: number; tier: number }[] = [];
  const falls: { hub: number; tier: number }[] = [];
  for (const [hub, tier] of now) {
    const was = before.get(hub) ?? 1;
    if (tier > was) ups.push({ hub, tier });
    else if (tier < was) falls.push({ hub, tier });
  }
  for (const [hub, was] of before) if (!now.has(hub) && was > 1) falls.push({ hub, tier: 1 });
  const hero = ups.filter((u) => milestoneAt(w, u.tier) !== null).sort((a, b) => b.tier - a.tier || a.hub - b.hub)[0];
  if (hero) standingHero(g, hero.hub, hero.tier);
  const rest = [...ups.filter((u) => u !== hero), ...(downs ? falls : [])];
  if (rest.length === 0) return;
  if (rest.length > 1 || hero) {
    if (rest.length > 1) toast(STANDING_UX.moved(rest.length + (hero ? 1 : 0)));
    else toast(stepWords(g, rest[0]!, before));
    return;
  }
  toast(stepWords(g, rest[0]!, before));
}
function stepWords(g: Game, x: { hub: number; tier: number }, before: Map<number, number>): string {
  const market = g.w.net.hubs[x.hub]!.name;
  if (x.tier > (before.get(x.hub) ?? 1)) return STANDING_UX.stepUp(market, x.tier);
  const cause = g.player!.standing?.[x.hub]?.log.at(-1)?.cause ?? "aged";
  return STANDING_UX.stepDown(market, x.tier, STANDING.cause[cause]);
}

function watchTiers(): void {
  const g = S.game;
  const c = g?.player;
  if (!g || !c || !standingShown(g.w, c)) return;
  const now = tiersNow(g);
  const seen = tiersSeen.get(g);
  tiersSeen.set(g, now);
  if (!seen) return;
  let changed = now.size !== seen.size;
  for (const [hub, tier] of now) if (seen.get(hub) !== tier) changed = true;
  if (!changed) return;
  tierMoments(g, seen, now, true);
  storeSeen(g, now);
}

/** §1.6: a milestone reached while away plays once, when the player opens Standing (never on the title or first screen). */
export function checkMissedMoments(): void {
  const g = S.game;
  const c = g?.player;
  if (!g || !c || !standingShown(g.w, c)) return;
  const now = tiersNow(g);
  const before = readSeen(g);
  if (before) tierMoments(g, before, now, false);
  storeSeen(g, now);
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
  watchTiers();
  watchHires();
  watchLoans();
  if (!hero) return null;
  const h = hero;
  return (
    <div class={h.serious ? "heroscrim serious" : "heroscrim"} role="dialog" aria-label={h.title} onClick={dismiss}>
      <div class="herocard" onClick={(ev) => ev.stopPropagation()}>
        {h.city !== undefined ? <CityPicture hub={h.city} /> : <Window key={h.name} name={h.name} fallback="yard" class="hero" still={h.serious === true} />}
        {h.badge ? (
          <div class="herobadge">
            <TierBadge tier={h.badge.tier} band={h.badge.band} size={128} />
          </div>
        ) : null}
        <h2>{h.title}</h2>
        {h.line ? (
          h.face ? (
            <div class="row paperline herosay">
              <span class="heroface">
                <Iuliia mood={h.face} size={64} />
              </span>
              <p>{h.line}</p>
            </div>
          ) : (
            <p class={h.serious ? "paperline" : "muted"}>{h.line}</p>
          )
        ) : null}
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
