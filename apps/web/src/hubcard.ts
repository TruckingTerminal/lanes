import { dayOf, EQUIPMENT, marketMood, garagingOf, homeCrowding, hubTheftRisk, localShare, planIndex, reloadOdds, type World } from "@lanes/engine";
import { hubs as HUBS } from "@lanes/data";
import { starterBreakEven } from "./breakeven.js";
import { FIRST_HUBS } from "./game.js";
import { HUB_CARD, MARKET, SEASON, STARTERS, SECURITY } from "./copy.js";
import { fd, pct } from "./format.js";

/**
 * A hub as the first entry shows it (specs/first-ten-minutes.md, S1, "The hub card"): every figure is one the engine
 * already reports, read for a dry van, and none of them needs a company. The world is enough, so the card reads the
 * same before the player's company exists as after.
 */
export interface HubFacts {
  name: string;
  character: string | null;
  season: string;
  /** The hub's own season line alone, for a row in a list, which says the country's mood once above it (moodLine). */
  seasonOnly: string;
  freight: string[];
  whosHere: string[];
  costs: string[];
  outbound: string;
  /** Open dry-van loads leaving the hub: what "busiest first" sorts by. */
  posted: number;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** The game calendar's month, spelled out (30-day months, as format.ts dates them). */
export const monthName = (day: number): string => MONTHS[Math.min(11, Math.floor((day % 365) / 30))]!;

/**
 * The season line (studio/reviews/economy-first-board.md, "the measure"): the hub's open dry-van loads a starter would
 * clear by `ui.season.margin` over its break-even, per round of the hub's base van freight. It reads the board as it
 * stands this round (the engine keeps no past boards to average over), so near a cut point it can move round to round.
 */
const measured = new WeakMap<World, { t: number; byHub: Map<number, number> }>();
export function seasonMeasure(w: World, hub: number): number {
  // Once per hub per game minute: the All hubs list reads every hub on every redraw.
  let memo = measured.get(w);
  if (!memo || memo.t !== w.t) measured.set(w, (memo = { t: w.t, byHub: new Map() }));
  const hit = memo.byHub.get(hub);
  if (hit !== undefined) return hit;
  const x = measure(w, hub);
  memo.byHub.set(hub, x);
  return x;
}
function measure(w: World, hub: number): number {
  const m = w.cfg.ui.season.margin;
  let good = 0;
  for (const l of w.loads.values()) {
    if (l.status !== "open" || l.equipment !== "van" || l.origin !== hub) continue;
    if (l.ceiling / starterBreakEven(w, hub, l) - 1 >= m) good++;
  }
  const f = w.cfg.freight;
  const totalWeight = w.net.hubs.reduce((a, h) => a + h.weight, 0);
  const h = w.net.hubs[hub]!;
  const base = (f.baseLoadsPerRound * h.weight) / totalWeight * f.equipmentShare.van * h.imbalance.van;
  return base > 0 ? good / base : 0;
}
/**
 * The reading the card shows: the mean of the last four rounds' readings for the hub, so the line doesn't flip from
 * round to round near a cut point. Kept in memory as the page sees rounds pass; it starts again on a reload.
 */
const ROUNDS_KEPT = 4;
const history = new WeakMap<World, Map<number, { round: number; value: number }[]>>();
export function seasonReading(w: World, hub: number): number {
  let byHub = history.get(w);
  if (!byHub) history.set(w, (byHub = new Map()));
  const list = byHub.get(hub) ?? [];
  const round = Math.floor(w.t / (12 * 60));
  const value = seasonMeasure(w, hub);
  if (list.length && list[list.length - 1]!.round === round) list[list.length - 1]!.value = value;
  else list.push({ round, value });
  while (list.length > ROUNDS_KEPT) list.shift();
  byHub.set(hub, list);
  return list.reduce((a, x) => a + x.value, 0) / list.length;
}
/** How many rounds' readings the rolling mean has for a hub so far. */
export const seasonRounds = (w: World, hub: number): number => history.get(w)?.get(hub)?.length ?? 0;

/** The starter hubs (the only ones a company may call home), as world hub indices. */
export const starterHubs = (w: World): number[] => w.net.hubs.map((h, i) => (HUBS.some((x) => x.id === h.id && x.isStarter) ? i : -1)).filter((i) => i >= 0);

/** Takes a reading of every starter hub for the rolling mean (the test world's warm-up calls it after each round). */
export function sampleStarters(w: World): void {
  for (const i of starterHubs(w)) seasonReading(w, i);
}

/**
 * The starter hubs, best freight right now first (Jeff, 2026-11-02): by the four-round mean of the season measure.
 * Until every starter has its four rounds, and between equal readings, the fallback order (game.ts FIRST_HUBS) decides.
 */
export function rankStarters(w: World): number[] {
  const starters = starterHubs(w);
  const fall = (i: number) => {
    const k = FIRST_HUBS.indexOf(w.net.hubs[i]!.id);
    return k < 0 ? FIRST_HUBS.length : k;
  };
  const ready = starters.every((i) => seasonRounds(w, i) >= ROUNDS_KEPT);
  const score = new Map(starters.map((i) => [i, ready ? seasonReading(w, i) : 0]));
  return [...starters].sort((a, b) => score.get(b)! - score.get(a)! || fall(a) - fall(b) || a - b);
}

export function seasonLine(w: World, hub: number): string {
  const k = w.cfg.ui.season;
  const x = seasonReading(w, hub);
  const month = monthName(dayOf(w.t, w.cfg));
  if (x < k.thinUnder) return SEASON.thin(month);
  if (x < k.fineFrom) return SEASON.littleThin(month);
  if (x >= k.busyFrom) return SEASON.busy(w.net.hubs[hub]!.name, month);
  return SEASON.fine(month);
}

/** The country's mood while the market is booming or slumping (marketMood), null while steady: one line above a list of hubs. */
export function moodLine(w: World): string | null {
  const mood = marketMood(w).state;
  return mood === "steady" ? null : MARKET.card[mood];
}

/** The season line, and the country's mood after it while the market is booming or slumping (marketMood; steady says nothing). */
function seasonWithMood(w: World, hub: number): string {
  const mood = marketMood(w).state;
  return mood === "steady" ? seasonLine(w, hub) : `${seasonLine(w, hub)} ${MARKET.card[mood]}`;
}

const timesWord = (x: number): string => (Math.abs(x - 2) < 0.25 ? "twice" : Math.abs(x - 3) < 0.25 ? "three times" : `${x.toFixed(1)} times`);
const outWord = (x: number): string => (x >= 1.15 ? "strong" : x <= 0.75 ? "thin" : "even");

export function hubFacts(w: World, hub: number): HubFacts {
  const h = w.net.hubs[hub]!;
  const van = EQUIPMENT.indexOf("van");
  let posted = 0;
  let rateSum = 0;
  for (const l of w.loads.values()) {
    if (l.status !== "open" || l.equipment !== "van" || l.origin !== hub) continue;
    posted++;
    rateSum += l.bookNow;
  }
  const ratio = w.lastRatioEq[planIndex(hub, van)] ?? 1;
  const ratioWord = ratio >= 1.5 ? "hot" : ratio >= 1.1 ? "busy" : ratio <= 0.7 ? "slow" : "even";
  const imb = h.imbalance.van;
  const reload = reloadOdds(w, hub, "van");
  const crowd = homeCrowding(w)[hub] ?? 1;
  const k = w.cfg.homeBase;
  const metro = k.yardTier[0] + k.yardTier[1] * h.weight;
  const yard = k.yardPerTruckWeek * metro * Math.min(k.yardCrowdClamp[1], Math.max(k.yardCrowdClamp[0], crowd));
  const ins = garagingOf(h.id) - 1;
  const theft = hubTheftRisk(w, hub);
  return {
    name: h.name,
    character: STARTERS[h.id]?.character ?? null,
    season: seasonWithMood(w, hub),
    seasonOnly: seasonLine(w, hub),
    freight: [
      HUB_CARD.posted(posted, posted ? (rateSum / posted).toFixed(2) : "–"),
      HUB_CARD.perTruck(ratio.toFixed(1), ratioWord),
      HUB_CARD.ships(imb >= 1.1 ? "more than" : imb <= 0.9 ? "less than" : "about what"),
      HUB_CARD.reload(reload >= 1.25 ? "easy" : reload >= 0.8 ? "fair" : "hard"),
    ],
    whosHere: [HUB_CARD.carriers(crowd >= 1.25 ? "many" : crowd <= 0.8 ? "few" : "a fair share"), HUB_CARD.locals(pct(localShare(w, hub, "van")))],
    costs: [HUB_CARD.insurance(pct(Math.abs(ins)), Math.abs(ins) < 0.02 ? null : ins > 0 ? "above" : "below"), HUB_CARD.yard(fd(yard)), HUB_CARD.security(SECURITY.band(theft))],
    outbound: `Van ${outWord(h.imbalance.van)} · Reefer ${outWord(h.imbalance.reefer)} · Flatbed ${outWord(h.imbalance.flatbed)}`,
    posted,
  };
}
