import type { JSX } from "preact";
import { brokeredLoads } from "../books.js";
import { MENUS } from "../copy-menus.js";
import { brokerageStage, brokerageWindow } from "../screenwindows.js";
import { bumpData, order, push, S, setTab, toast, toastRich, truckNo, useData } from "../state.js";
import { FIXES } from "../copy-fixes.js";
import { fdFull } from "../format.js";
import { Btn } from "./bits.js";
import { Window } from "./Window.js";
import { standingMarkets, standingOwed } from "@lanes/engine";
import { STANDING, STANDING_UX } from "../copy-standing.js";
import { atlasUrl, kitData } from "../menuart.js";
import { motion } from "../motion.js";
import { bandAt, milestoneAt, momentPerk, stampLine, standingShown, troubleOpen } from "../standingui.js";
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
  /**
   * Standing's moments (UX §1.6): the new tier's badge at 128 with the fx glint once at its corner (Full motion only), the
   * market's own city in place of a painting, the paper's lines under the title, Iuliia's face.
   */
  badge?: { tier: number; band: "approved" | "preferred" | "core" };
  glint?: true;
  paper?: string[];
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
/** The hero up now, and closing it (for the tests). */
export const heroNow = (): Hero | null => hero;
export const closeHero = (): void => dismiss();

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
 * Standing's moments (UX next-screens §1.6, the director's §8):
 * - a hero only the first time the company reaches a milestone in any market (3 the appointment wall, 5 the bank, 7 the
 *   shipper's office, 9 a rate confirmation, 10 the market's own city), one a review at most: the engine keeps the best
 *   tier ever and the heroes owed (standing.ts standingOwed), and seeing one clears it (standing_seen), so a reload or a
 *   second device never plays it twice and a missed one waits;
 * - at a review the player is here for, it plays when no sheet, Confirm or tier-1 item is open; missed while away, it
 *   plays once the next time the player opens Standing or the Company card, never on the title or the first screen;
 * - a milestone reached again (a later market, or back after a fall) is a stamp: the badge at 32, the tier, the perk with
 *   its figure and Iuliia's line in her strip; a step between milestones is a toast, and so is a fall, with its cause
 *   (Iuliia's falling line comes with the engine's event, main.tsx);
 * - the review's other changes are one toast: one change, its own toast or stamp; more, "Standing moved in n markets".
 */
const MOMENT_PAINTING: Record<number, string> = { 3: "shp-appt-wall", 5: "bank", 7: "shp-office", 9: "brk-ratecon" };
const tiersSeen = new WeakMap<object, Map<number, number>>();
type Game = NonNullable<typeof S.game>;
/** Per sitting and company: the heroes owed when it was first read (missed while away), and those played since. */
const owedAtOpen = new WeakMap<object, Map<number, Set<number>>>();
const owedPlayed = new WeakMap<object, Map<number, Set<number>>>();
const perCompany = (m: WeakMap<object, Map<number, Set<number>>>, g: Game): Map<number, Set<number>> => {
  let x = m.get(g);
  if (!x) m.set(g, (x = new Map()));
  return x;
};
const playedOf = (g: Game): Set<number> => {
  const m = perCompany(owedPlayed, g);
  let x = m.get(g.player!.id);
  if (!x) m.set(g.player!.id, (x = new Set()));
  return x;
};
const tiersNow = (g: Game): Map<number, number> => new Map(standingMarkets(g.w, g.player!).map((hub) => [hub, g.player!.standing![hub]!.tier]));
/** §1.6: no other hero, no sheet or Confirm open, and no tier-1 item. */
const heroFree = (g: Game): boolean => hero === null && S.openLoad === null && S.confirm === null && S.ladder === null && S.waysOut === null && !troubleOpen(g.w, g.player!);

function standingHero(g: Game, hub: number, tier: number): void {
  const w = g.w;
  const market = w.net.hubs[hub]!.name;
  const band = bandAt(tier);
  const perk = momentPerk(w, g.player!, hub, tier);
  showHero({
    name: MOMENT_PAINTING[tier] ?? "shp-office",
    ...(tier === 10 ? { city: hub } : {}),
    title: STANDING.heroTitle(market, tier, STANDING.band[band]),
    paper: [STANDING_UX.heroPaper(market, STANDING.band[band], tier), ...(perk ? [perk] : [])],
    line: STANDING.iuliiaMilestone(market, tier) ?? undefined,
    badge: { tier, band },
    face: "proud",
    glint: true,
    action: {
      label: STANDING_UX.heroLadder,
      run: () => {
        S.ladder = hub;
        setTab("standing");
      },
    },
  });
}

/** Plays an owed hero and tells the engine it was seen (no toast: the hero is the answer). */
function playOwed(g: Game, o: { tier: number; hub: number }): void {
  playedOf(g).add(o.tier);
  standingHero(g, o.hub, o.tier);
  void order({ type: "standing_seen", tier: o.tier }, "");
}

/** A milestone reached again: the stamp (§1.6), a toast with the badge, the perk with its figure and Iuliia's line. */
function stampToast(g: Game, hub: number, tier: number): void {
  const w = g.w;
  const market = w.net.hubs[hub]!.name;
  toastRich({
    text: stampLine(w, g.player!, hub, tier),
    badge: { tier, band: bandAt(tier) },
    sub: momentPerk(w, g.player!, hub, tier) ?? undefined,
    say: STANDING.iuliiaMilestone(market, tier) ?? undefined,
  });
}

/** The moments between two readings of the tiers: a hero the engine owes for one of them is watchOwed's; the rest, one toast. */
function tierMoments(g: Game, before: Map<number, number>, now: Map<number, number>): void {
  const w = g.w;
  const ups: { hub: number; tier: number }[] = [];
  const falls: { hub: number; tier: number }[] = [];
  for (const [hub, tier] of now) {
    const was = before.get(hub) ?? 1;
    if (tier > was) ups.push({ hub, tier });
    else if (tier < was) falls.push({ hub, tier });
  }
  for (const [hub, was] of before) if (!now.has(hub) && was > 1) falls.push({ hub, tier: 1 });
  const owed = standingOwed(w, g.player!);
  const heroUp = ups.find((u) => owed.some((o) => o.tier === u.tier && o.hub === u.hub));
  const rest = [...ups.filter((u) => u !== heroUp), ...falls];
  if (rest.length > 1) return toastRich({ text: STANDING_UX.moved(rest.length + (heroUp ? 1 : 0)), go: () => setTab("standing") });
  const x = rest[0];
  if (!x) return;
  const market = w.net.hubs[x.hub]!.name;
  const badge = { tier: x.tier, band: bandAt(x.tier) };
  if (x.tier > (before.get(x.hub) ?? 1)) {
    if (milestoneAt(w, x.tier) !== null) stampToast(g, x.hub, x.tier);
    else toastRich({ text: STANDING_UX.stepUp(market, x.tier), badge });
    return;
  }
  const cause = g.player!.standing?.[x.hub]?.log.at(-1)?.cause ?? "aged";
  toastRich({ text: STANDING_UX.stepDown(market, x.tier, STANDING.cause[cause]), badge });
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
  if (changed) tierMoments(g, seen, now);
}

/** §1.6: a hero owed at a review the player is here for plays at the first free moment. */
function watchOwed(): void {
  const g = S.game;
  const c = g?.player;
  if (!g || !c || !standingShown(g.w, c)) return;
  const owed = standingOwed(g.w, c);
  const atOpen = perCompany(owedAtOpen, g);
  const missed = atOpen.get(c.id);
  if (!missed) {
    atOpen.set(c.id, new Set(owed.map((o) => o.tier)));
    return;
  }
  const next = owed.find((o) => !missed.has(o.tier) && !playedOf(g).has(o.tier));
  if (next && heroFree(g)) playOwed(g, next);
}

/** §1.6: a hero missed while away plays once, when the player opens Standing or the Company card (never the title or the first screen). */
export function checkMissedMoments(): void {
  const g = S.game;
  const c = g?.player;
  if (!g || !c || !standingShown(g.w, c)) return;
  const missed = perCompany(owedAtOpen, g).get(c.id);
  const next = standingOwed(g.w, c).find((o) => (!missed || missed.has(o.tier)) && !playedOf(g).has(o.tier));
  if (next && heroFree(g)) playOwed(g, next);
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
  for (const l of w.purchaseLoans) if (l.borrowerId === c.id) now.set(`p${l.id}`, l.seized ? "seized" : l.status);
  for (const l of w.finance.loans) if (l.borrowerId === c.id) now.set(`e${l.id}`, l.status);
  const seen = loansSeen.get(g);
  loansSeen.set(g, now);
  if (!seen) return;
  for (const l of w.purchaseLoans) {
    const was = seen.get(`p${l.id}`);
    const t = l.truckId ? w.trucks[l.truckId - 1] : undefined;
    // Seized: the lender took its truck (purchaseLoans.ts seize marks it), whether the truck covered the loan ("repaid")
    // or not ("closed"; QA's 0.25.2 replay: the common case was silent).
    if (l.borrowerId === c.id && was !== undefined && was !== "seized" && l.seized === true && t) {
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
    // QA's 0.25.2 replay: a driver's pay is per mile (0.61 FD/mi), so a weekly figure read "1 FD a week".
    const kind = FIXES.staffKind[s.kind] ?? s.kind;
    const line = s.kind === "driver" ? FIXES.autoHiredPerMile(s.name, kind, s.pay.toFixed(2)) : FIXES.autoHired(s.name, kind, fdFull(s.pay));
    push(g, line, "warn");
    toast(line);
  }
}

export function HeroMoment(): JSX.Element | null {
  useData();
  watchStage();
  watchTrucks();
  watchTiers();
  watchOwed();
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
            {h.glint ? <Glint /> : null}
          </div>
        ) : null}
        <h2>{h.title}</h2>
        {h.paper ? (
          <div class="heropaper">
            {h.paper.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}
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

/** §1.6: the fx glint, once, at the badge's corner; none in Calm or Still. */
function Glint(): JSX.Element | null {
  const k = kitData();
  const p = k?.fx?.pieces?.shine;
  if (!k || !p || motion() !== "full") return null;
  return <span class="heroglint" aria-hidden="true" style={{ backgroundImage: `url("${atlasUrl(k.fx.image)}")`, "--glint-x": `${-p.x}px`, "--glint-y": `${-p.y}px`, "--glint-run": `${-(p.x + (p.frames ?? 9) * (p.step ?? 64))}px` } as JSX.CSSProperties} />;
}
