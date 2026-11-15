import { companyAccount, dayOf, hasPerk, perkTier, standingCard, standingLoad, standingMarkets, standingOn, standingOwed, standingPaid, tallyOf, tierAt, type Company, type GameEvent, type Load, type Scorecard, type StandingPerk, type World } from "@lanes/engine";
import { STANDING, STANDING_UX } from "./copy-standing.js";
import { fdFull, hhmm, pct, shortDate, TRAILER_NAME, weekdayDate } from "./format.js";

/**
 * Standing with a market's shippers on the page (standing.ts): the card's lines in the director's words, the perks
 * where they apply, and the words for the engine's standing events. Nothing here with standing off.
 */

const market = (w: World, hub: number): string => w.net.hubs[hub]!.name;
/** A score as the card says it: whole, or to a half (a short hop counts half). */
const loadsSaid = (x: number): string => (Number.isInteger(x) ? String(x) : x.toFixed(1));

export interface StandingLines {
  hub: number;
  tier: number;
  band: "approved" | "preferred" | "core";
  head: string;
  next: string;
  detail: string;
  /** No-shows, releases, lates and first calls turned down, when there are any. */
  marks: string | null;
}

/** The card's three lines for a company's standing with a market (the director's card), or null with standing off. */
export function standingLines(w: World, c: Company, hub: number): StandingLines | null {
  const card = standingCard(w, c, hub);
  if (!card) return null;
  const days = w.cfg.standing.windowDays;
  const m = market(w, hub);
  const next = card.next
    ? `${STANDING.next(card.next.tier, card.next.loads, card.next.onTime > 0 ? pct(card.next.onTime) : null, loadsSaid(Math.max(0, card.score)), days)}${card.nextPerk ? ` ${STANDING.nextPerk(STANDING.perk[card.nextPerk.perk], card.nextPerk.tier)}` : ""}`
    : STANDING.top;
  return {
    hub,
    tier: card.tier,
    band: card.band,
    head: STANDING.head(m, STANDING.band[card.band], card.tier, STANDING.trend[card.trend]),
    next,
    detail: STANDING.detail(card.onTimeShare === null ? STANDING.noOnTime : pct(card.onTimeShare), days, card.loads, card.contractLoads, card.claims),
    // The director's sprint §14: a first call passed is no mark while it's no hit.
    marks: STANDING.marks(card.noShows, card.releases, card.late, w.cfg.standing.hits.declinedFirstCall > 0 ? card.declined : 0) || null,
  };
}

/** The markets a company has standing with, highest tier first, as card lines. */
export function standingList(w: World, c: Company): StandingLines[] {
  return standingMarkets(w, c)
    .map((hub) => standingLines(w, c, hub))
    .filter((x): x is StandingLines => x !== null);
}

/** A first call held for this company on this load, open: when it goes to the board (the clearing's hour). */
export function firstCallFor(w: World, c: Company, l: Load): { until: string; market: string } | null {
  const fc = l.firstCall;
  if (!standingOn(w) || !fc || fc.state !== "open" || fc.companyId !== c.id || l.status !== "open") return null;
  return { until: hhmm(l.tenderUntil), market: market(w, l.origin) };
}

/** Where a perk applies on a load: the lines that name the tier holding it (the dock at either end, the pay terms). */
export function perksOnLoad(w: World, c: Company, l: Load): string[] {
  if (!standingOn(w)) return [];
  const out: string[] = [];
  const dock = (hub: number) => hasPerk(w, c, hub, "dock");
  if (dock(l.origin)) out.push(STANDING.dockHere(market(w, l.origin), tierAt(w, c, l.origin)));
  if (l.dest !== l.origin && dock(l.dest)) out.push(STANDING.dockHere(market(w, l.dest), tierAt(w, c, l.dest)));
  if (standingLoad(l) && hasPerk(w, c, l.origin, "net")) out.push(STANDING.netHere(market(w, l.origin), tierAt(w, c, l.origin), w.cfg.standing.perks.netDays));
  return out;
}

/** The tier a contract offer at a market carries for this company: the dedicated lane, or contract offers first. */
export function offerTierLine(w: World, c: Company, k: { origin: number; dedicated?: true }): string | null {
  if (!standingOn(w)) return null;
  if (k.dedicated) return STANDING.dedicatedOffer(market(w, k.origin));
  return hasPerk(w, c, k.origin, "contracts") ? STANDING.offeredFirst(market(w, k.origin), tierAt(w, c, k.origin)) : null;
}

/** The milestone a tier opens, if it's one. */
export function milestoneAt(w: World, tier: number): StandingPerk | null {
  for (const p of ["dock", "net", "firstCall", "contracts", "dedicated"] as const) if (perkTier(w, p) === tier) return p;
  return null;
}

/** The highest milestone a fall took the company below (from `from` to `to`), if any. */
export function milestoneLost(w: World, from: number, to: number): StandingPerk | null {
  let lost: StandingPerk | null = null;
  for (const p of ["dock", "net", "firstCall", "contracts", "dedicated"] as const) {
    const t = perkTier(w, p);
    if (from >= t && to < t) lost = p;
  }
  return lost;
}

type StandingEvent = Extract<GameEvent, { kind: "standing" }>;

/**
 * The words an engine standing event gives the page: the feed's line, Iuliia's, and whether it's good or bad news.
 * `byHand`: a first call the player turned down themself (else it lapsed).
 */
export function standingWords(w: World, e: StandingEvent, byHand = false): { feed: string | null; iuliia: string | null; tone: "good" | "bad" | "" } {
  const m = market(w, e.hub);
  const l = e.loadId !== undefined ? w.loads.get(e.loadId) : undefined;
  const places = l ? [w.net.places[l.originPlace]!.name, w.net.places[l.destPlace]!.name] : [m, "?"];
  if (e.what === "tier" && e.from !== undefined && e.to !== undefined) {
    if (e.to > e.from) {
      const opened = milestoneAt(w, e.to);
      return { feed: STANDING.feedUp(m, e.to), iuliia: opened ? STANDING.iuliiaMilestone(m, e.to) : null, tone: "good" };
    }
    const cause = STANDING.cause[e.cause ?? "aged"];
    const lost = milestoneLost(w, e.from, e.to);
    return { feed: STANDING.feedDown(m, e.to, cause), iuliia: lost ? STANDING.iuliiaFell(m, e.to, cause, STANDING.perk[lost], perkTier(w, lost)) : null, tone: "bad" };
  }
  if (e.what === "firstCall") return { feed: STANDING.firstCallFeed(m, places[0]!, places[1]!, l ? hhmm(l.tenderUntil) : "the next round"), iuliia: null, tone: "good" };
  if (e.what === "declined") return { feed: byHand ? STANDING.firstCallDeclined(m) : STANDING.firstCallLapsed(m, places[0]!, places[1]!), iuliia: null, tone: "bad" };
  if (e.what === "decayAhead") return { feed: null, iuliia: STANDING.iuliiaDecayAhead(m), tone: "" };
  // §13: on notice; Iuliia speaks only when the step down would lose a perk, and nothing is toasted.
  if (e.what === "onNotice" && e.from !== undefined && e.to !== undefined) {
    const lost = milestoneLost(w, e.from, e.to);
    return { feed: null, iuliia: lost ? STANDING.iuliiaOnNotice(m, reviewWhen(w).day, STANDING.perk[lost]) : null, tone: "" };
  }
  if (e.what === "noticed") return { feed: null, iuliia: STANDING.iuliiaNoticed(m), tone: "" };
  return { feed: null, iuliia: null, tone: "" };
}

/** The tier changes in a span of game minutes, with their cause, for the month report: every market, oldest first. */
export function standingMoves(w: World, c: Company, from: number, to: number): string[] {
  if (!standingOn(w) || !c.standing) return [];
  const out: { t: number; line: string }[] = [];
  for (const hub of standingMarkets(w, c)) {
    for (const x of c.standing[hub]!.log) if (x.t >= from && x.t < to) out.push({ t: x.t, line: STANDING_UX.reportMove(market(w, hub), x.from, x.to, STANDING.cause[x.cause], weekdayDate(Math.floor(x.t / w.cfg.time.gameMinutesPerDay))) });
  }
  return out.sort((a, b) => a.t - b.t).map((x) => x.line);
}

// --- UX's standing screens (ux-next-screens-2026-11-15.md part 1) ------------------------------------------------------

/** §1.0: nothing of standing shows before the player's first on-time direct delivery (the engine's first notice). */
export const standingShown = (w: World, c: Company | null | undefined): boolean => !!c && standingOn(w) && c.standingNoticed === true;

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekdayOf = (w: World, day: number): number => (day + w.cfg.time.weekdayOfDay0) % 7;
/** The weekly review runs at the close of each seventh day (step.ts): the game minute of the first at or after `t`. */
export function reviewAtOrAfter(w: World, t: number): number {
  const D = w.cfg.time.gameMinutesPerDay;
  return Math.ceil(t / D / 7) * 7 * D;
}
/** The review's weekday and hour, for the ladder's foot. */
export function reviewWhen(w: World): { day: string; hour: string } {
  return { day: DAY_NAMES[weekdayOf(w, 7)]!, hour: "00:00" };
}

/** A load's weight on a scorecard, as the engine counts it (standing.ts standingDelivered). */
export function loadWeight(w: World, l: Load): number {
  const k = w.cfg.standing;
  return (l.contractId !== 0 ? k.contractWeight : 1) * Math.min(1, l.miles / k.fullLoadMi);
}

export interface CardUx {
  hub: number;
  market: string;
  tier: number;
  band: "approved" | "preferred" | "core";
  title: string;
  bandWord: string;
  line2: string;
  next: string | null;
  have: string;
  /** The two figures against the next tier's (or, at the top, the top's) floors, for the static bars. */
  bars: { loads: [number, number]; onTime: [number, number] | null };
  top: string | null;
  unlocks: string | null;
  record: string;
  /** From a week before a decay: the amber chip. */
  decay: string | null;
  /** §13: on notice, the line with the figure under the floor and the review that steps it down; `noticeNeed` when that would lose a perk. */
  notice: string | null;
  noticeNeed: boolean;
  /** §14, from the first-call tier: the calls taken of those made in the window. */
  calls: string | null;
}

/** §1.1: a market's card in UX's form, or null (standing off, or not yet shown). */
export function cardUx(w: World, c: Company, hub: number): CardUx | null {
  if (!standingShown(w, c)) return null;
  const card = standingCard(w, c, hub);
  if (!card) return null;
  const k = w.cfg.standing;
  const m = market(w, hub);
  const top = card.next === null;
  const floorL = top ? k.loadFloors[k.loadFloors.length - 1]! : card.next!.loads;
  const floorT = top ? k.onTimeFloors[k.onTimeFloors.length - 1]! : card.next!.onTime;
  const s = c.standing?.[hub];
  let decay: string | null = null;
  if (s && s.tier > 1 && s.lastLoadT >= 0) {
    const week = 7 * w.cfg.time.gameMinutesPerDay;
    const since = Math.max(s.lastLoadT, s.decayedT ?? -1);
    if (w.t - since >= k.decayWarnWeeks * week) {
      const at = reviewAtOrAfter(w, since + k.decayWeeks * week);
      decay = STANDING_UX.decayChip(m, Math.floor((w.t - s.lastLoadT) / week), DAY_SHORT[weekdayOf(w, Math.floor(at / w.cfg.time.gameMinutesPerDay))]!);
    }
  }
  return {
    hub,
    market: m,
    tier: card.tier,
    band: card.band,
    title: STANDING.title(m),
    bandWord: STANDING.band[card.band],
    line2: STANDING_UX.line2(card.tier, STANDING.trend[card.trend]),
    next: top ? null : STANDING_UX.next(card.next!.tier, card.next!.loads, card.next!.onTime > 0 ? pct(card.next!.onTime) : null),
    // QA's 0.25.3 replay: a hit can take the count under zero (a release is two loads off); it reads 0, and the record line names it.
    have: STANDING_UX.have(loadsSaid(Math.max(0, card.score)), card.onTimeShare === null ? null : pct(card.onTimeShare)),
    bars: { loads: [Math.max(0, card.score), floorL], onTime: floorT > 0 ? [card.onTimeShare ?? 0, floorT] : null },
    top: top ? STANDING_UX.topTier(floorL, pct(floorT)) : null,
    unlocks: card.nextPerk && card.nextPerk.tier >= card.tier + 1 ? STANDING_UX.unlocks(STANDING.perk[card.nextPerk.perk], card.nextPerk.tier) : null,
    record: recordLine(w, card),
    ...noticeAndDecay(noticeOf(w, card, m), decay),
    calls: card.tier >= perkTier(w, "firstCall") && card.callsTaken + card.declined > 0 ? STANDING_UX.callsLine(card.callsTaken, card.callsTaken + card.declined, k.windowDays, m) : null,
  };
}

/** §1.1's record line: on time, loads and claims, and the other marks in the window when there are any (a release, a no-show, a late). */
function recordLine(w: World, card: NonNullable<ReturnType<typeof standingCard>>): string {
  const k = w.cfg.standing;
  const base = STANDING.detail(card.onTimeShare === null ? STANDING.noOnTime : pct(card.onTimeShare), k.windowDays, card.loads, card.contractLoads, card.claims);
  const marks = STANDING.marks(card.noShows, card.releases, card.late, k.hits.declinedFirstCall > 0 ? card.declined : 0);
  return marks ? `${base} · ${marks}` : base;
}

/** §1.1: on notice shows in the decay chip's place, since it comes first; one chip at most. */
const noticeAndDecay = (n: { notice: string | null; noticeNeed: boolean }, decay: string | null): { notice: string | null; noticeNeed: boolean; decay: string | null } => ({ ...n, decay: n.notice ? null : decay });

/** §13: the card's on-notice line, from the floor it's under (loads first, then the on-time share), and whether it would lose a perk. */
function noticeOf(w: World, card: NonNullable<ReturnType<typeof standingCard>>, m: string): { notice: string | null; noticeNeed: boolean } {
  if (!card.notice) return { notice: null, noticeNeed: false };
  const k = w.cfg.standing;
  const day = reviewWhen(w).day;
  const needL = k.loadFloors[card.tier - 1]!;
  const needT = k.onTimeFloors[card.tier - 1]!;
  const notice = card.score < needL ? STANDING_UX.onNoticeLoads(loadsSaid(Math.max(0, card.score)), card.tier, needL, day, m) : STANDING_UX.onNoticeOnTime(pct(card.onTimeShare ?? 0), card.tier, pct(needT), day, m);
  return { notice, noticeNeed: milestoneLost(w, card.tier, card.tier - 1) !== null };
}

/**
 * §1.3a (0.25.3's client polish): a scorecard is listed when it holds a perk, at dock priority's tier or above (a perk in
 * force is never folded away), or when a load from its market was delivered within the decay window, the weeks without
 * one that cost a tier. The rest fold under "Other markets". Listing moves no money and changes no rule.
 */
export function standingListed(w: World, c: Company, hub: number): boolean {
  const s = c.standing?.[hub];
  if (!s) return false;
  if (s.tier >= perkTier(w, "dock")) return true;
  return s.lastLoadT >= 0 && w.t - s.lastLoadT < w.cfg.standing.decayWeeks * 7 * w.cfg.time.gameMinutesPerDay;
}
/** A scorecard with anything to show: above tier 1, or a load in its window (§1.1). */
const hasCard = (s: Scorecard): boolean => s.tier > 1 || s.days.length > 0;

/** §1.3a: a folded market's compact row, a tap target opening its ladder. */
export interface FoldRow {
  hub: number;
  tier: number;
  band: "approved" | "preferred" | "core";
  text: string;
  lastLoadT: number;
}

/**
 * §1.3 and §1.3a, the Standing screen: the listed cards, highest tier first, then the nearest next tier; the fold's compact
 * rows, highest tier first, then the latest load; and how many markets both hold, for the header.
 */
export function standingScreen(w: World, c: Company): { cards: CardUx[]; fold: FoldRow[]; markets: number } {
  if (!standingShown(w, c)) return { cards: [], fold: [], markets: 0 };
  const hubs = standingMarkets(w, c).filter((hub) => hasCard(c.standing![hub]!));
  const gap = (x: CardUx) => (x.bars.loads[1] > 0 ? Math.max(0, x.bars.loads[1] - x.bars.loads[0]) : 0);
  const cards = hubs
    .filter((hub) => standingListed(w, c, hub))
    .map((hub) => cardUx(w, c, hub)!)
    .sort((a, b) => b.tier - a.tier || gap(a) - gap(b) || a.hub - b.hub);
  const D = w.cfg.time.gameMinutesPerDay;
  const fold = hubs
    .filter((hub) => !standingListed(w, c, hub))
    .map((hub): FoldRow => {
      const s = c.standing![hub]!;
      return { hub, tier: s.tier, band: bandOfTier(s.tier), text: STANDING_UX.foldRow(market(w, hub), s.tier, s.lastLoadT >= 0 ? shortDate(Math.floor(s.lastLoadT / D)) : null), lastLoadT: s.lastLoadT };
    })
    .sort((a, b) => b.tier - a.tier || b.lastLoadT - a.lastLoadT || a.hub - b.hub);
  return { cards, fold, markets: hubs.length };
}

/** §1.3a: the listed cards (the Company card's top one, and Needs you's decay and notice lines). */
export const cardsUx = (w: World, c: Company): CardUx[] => standingScreen(w, c).cards;

/**
 * §1.3a, moments follow the list: of a review's tier steps, the page tells a listed market's (a step up to a perk's tier
 * lists the market by itself) and a lost milestone, which is still the plain notice (§1.6). A folded market's other steps
 * go to the feed and the month report only, and don't count in "Standing moved in n markets".
 */
export function stepShown(w: World, c: Company, hub: number, from: number, to: number): boolean {
  return standingListed(w, c, hub) || (to < from && milestoneLost(w, from, to) !== null);
}

export interface LadderRow {
  tier: number;
  band: "approved" | "preferred" | "core";
  /** The band's heading, on the first row of a band from the top. */
  heading: string | null;
  floors: string;
  perk: string | null;
  state: "you" | "next" | "reached" | "above";
}

/** §1.2: the ten rows, 10 at the top, with the player's place and the next step. */
export function ladderRows(w: World, c: Company, hub: number): LadderRow[] {
  const k = w.cfg.standing;
  const mine = tierAt(w, c, hub);
  const rows: LadderRow[] = [];
  let lastBand: string | null = null;
  for (let tier = k.loadFloors.length; tier >= 1; tier--) {
    const band = bandOfTier(tier);
    const perk = milestoneAt(w, tier);
    rows.push({
      tier,
      band,
      heading: band !== lastBand ? STANDING_UX.ladderBand[band] : null,
      floors: STANDING_UX.ladderFloors(k.loadFloors[tier - 1]!, k.onTimeFloors[tier - 1]! > 0 ? pct(k.onTimeFloors[tier - 1]!) : null),
      perk: perk ? STANDING.perk[perk] : null,
      state: tier === mine ? "you" : tier === mine + 1 ? "next" : tier < mine ? "reached" : "above",
    });
    lastBand = band;
  }
  return rows;
}
const bandOfTier = (tier: number): "approved" | "preferred" | "core" => (tier >= 9 ? "core" : tier >= 5 ? "preferred" : "approved");

/** §1.2's foot: the rules in four sentences, the review's day and hour from the engine's calendar. */
export function ladderFoot(w: World): string {
  const k = w.cfg.standing;
  const r = reviewWhen(w);
  // The director's §13: a step down after the reviews on notice and the one that steps it down.
  const notice = k.noticeReviews ?? 0;
  return STANDING_UX.ladderFoot(r.day, r.hour, k.hits.late, k.hits.noShow, k.decayWeeks, notice > 0 ? STANDING_UX.ladderStepDown(notice + 1) : null);
}

/** §1.4 line 1: under the poster line, what the load builds, or that a broker's builds none. */
export function sheetLine(w: World, c: Company, l: Load): { text: string; tier: number | null; band: "approved" | "preferred" | "core" } | null {
  if (!standingShown(w, c)) return null;
  if (!standingLoad(l)) return { text: STANDING_UX.brokered, tier: null, band: "approved" };
  const s = c.standing?.[l.origin];
  const m = market(w, l.origin);
  if (!s) return { text: STANDING_UX.countsNew(m), tier: null, band: "approved" };
  return { text: STANDING_UX.countsToward(m, STANDING.band[bandOfTier(s.tier)], s.tier), tier: s.tier, band: bandOfTier(s.tier) };
}

/** §1.4 line 2: the standing cost each claim line of "What you're agreeing to" gains, for a load that builds standing. */
export function claimCosts(w: World, c: Company, l: Load): { late: string; noShow: string; release: string } | null {
  if (!standingShown(w, c) || !standingLoad(l)) return null;
  const h = w.cfg.standing.hits;
  const m = market(w, l.origin);
  return { late: STANDING_UX.claimCost(h.late, m), noShow: STANDING_UX.claimCost(h.noShow, m), release: STANDING_UX.claimCost(h.release, m) };
}

/** §1.4 line 3: the perks in force on this load: dock priority at either end, net terms on the market's own paper. */
export function perkChips(w: World, c: Company, l: Load): { dock: boolean; net: number | null } {
  if (!standingShown(w, c)) return { dock: false, net: null };
  return { dock: hasPerk(w, c, l.origin, "dock") || hasPerk(w, c, l.dest, "dock"), net: standingLoad(l) && hasPerk(w, c, l.origin, "net") ? w.cfg.standing.perks.netDays : null };
}

/** §1.4, WON: the count toward the next tier once this load is delivered on time. */
export function wonLine(w: World, c: Company, l: Load): string | null {
  if (!standingShown(w, c) || !standingLoad(l)) return null;
  const card = standingCard(w, c, l.origin);
  if (!card || !card.next) return null;
  const have = Math.max(0, card.score) + loadWeight(w, l);
  // QA's 0.25.3 replay: past the floor already (the review steps it up, or the on-time share holds it), it says so.
  return (have > card.next.loads + 1e-9 ? STANDING_UX.wonPast : STANDING_UX.won)(market(w, l.origin), loadsSaid(have), card.next.loads, card.next.tier);
}

/** §1.5: the first calls held for the player, soonest deadline first. */
export function firstCallsFor(w: World, c: Company): Load[] {
  if (!standingOn(w)) return [];
  return [...w.loads.values()].filter((l) => l.firstCall?.state === "open" && l.firstCall.companyId === c.id && l.status === "open").sort((a, b) => a.tenderUntil - b.tenderUntil || a.id - b.id);
}

// --- §1.6 the tier-reached moments ------------------------------------------------------------------------------------

export const bandAt = bandOfTier;

/**
 * The figures for a moment's perk line, from the player's own books (UX §1.6): what the market's loads paid in the last
 * 30 days (the scorecard's FD column) for net-15, the scorecard's loads and on-time share for first call and contract
 * offers, the dedicated lane's own lane once it's offered. The engine doesn't count dock time by market, so dock
 * priority names the perk alone; a figure it has none for is null and its clause drops.
 */
export function momentFigures(w: World, c: Company, hub: number, tier: number): Parameters<typeof STANDING.heroPerk>[2] {
  const s = c.standing?.[hub];
  const t = s ? tallyOf(w, s) : null;
  const perk = milestoneAt(w, tier);
  if (perk === "net") {
    const paid = w.cfg.token.payment.enabled ? standingPaid(w, c, hub, 30) : 0;
    return { netDays: w.cfg.standing.perks.netDays, termsDays: w.cfg.token.payment.termsDays, soonerFd: paid >= 0.5 ? fdFull(paid) : null };
  }
  if (perk === "firstCall") return { loads: t && t.loads > 0 ? t.loads : null };
  if (perk === "contracts") return { loads: t && t.loads > 0 ? t.loads : null, onTime: t && t.onTimeShare !== null ? pct(t.onTimeShare) : null };
  if (perk === "dedicated") {
    const k = w.contracts.find((x) => x.carrierId === c.id && x.dedicated === true && x.origin === hub && (x.status === "offered" || x.status === "active"));
    return { lane: k ? `${market(w, k.origin)} → ${market(w, k.dest)}, ${TRAILER_NAME[k.equipment].toLowerCase()}` : null };
  }
  return { dockHours: null };
}

/** The perk line of a hero or a stamp (UX §1.6), with its figure. */
export const momentPerk = (w: World, c: Company, hub: number, tier: number): string | null => STANDING.heroPerk(market(w, hub), tier, momentFigures(w, c, hub, tier));

/** A stamp's head line: a milestone in a later market, or back to it after a fall there (the scorecard's log). */
export function stampLine(w: World, c: Company, hub: number, tier: number): string {
  const log = c.standing?.[hub]?.log ?? [];
  const back = log.slice(0, -1).some((x) => x.to < x.from && x.from >= tier);
  return STANDING.stamp(market(w, hub), STANDING.band[bandOfTier(tier)], tier, back);
}

/**
 * UX §1.6, never over trouble: a tier-1 item is open, so an owed hero waits. The company in the red past its line
 * (the debt countdown), its authority lost or a bad rating with a revocation or probation running, or a loan payment
 * already missed with the truck next. A repossession is its own serious hero, which holds the frame anyway.
 */
export function troubleOpen(w: World, c: Company): boolean {
  if (w.ledger.balance(companyAccount(c.id)) < -w.cfg.insolvency.debtLimitFd) return true;
  if (c.authority.status !== "active") return true;
  const s = c.safety;
  if ((s.rating === "conditional" || s.rating === "unsatisfactory") && (s.revokeDay !== null || (s.probationUntil ?? -1) >= dayOf(w.t, w.cfg))) return true;
  return w.purchaseLoans.some((l) => l.borrowerId === c.id && (l.status === "active" || l.status === "defaulted") && l.missed > 0) || w.finance.loans.some((l) => l.borrowerId === c.id && l.status === "active" && l.missed > 0);
}

/**
 * The return card's standing lines (UX §1.3): each market whose tier moved while the player was away, one line with its
 * badge (from the first tier to the last); a hero owed adds "See it", which opens Standing to play it, except while a
 * tier-1 item is open. A hero owed from before the time away, on a market that didn't move, gets its own line.
 */
export function awayStanding(w: World, c: Company, from: number, to: number): { text: string; badge: { tier: number; band: "approved" | "preferred" | "core" }; seeIt: boolean }[] {
  if (!standingShown(w, c) || !c.standing) return [];
  const owed = standingOwed(w, c);
  const can = !troubleOpen(w, c);
  const out: { hub: number; text: string; badge: { tier: number; band: "approved" | "preferred" | "core" }; seeIt: boolean }[] = [];
  for (const hub of standingMarkets(w, c)) {
    const log = c.standing[hub]!.log.filter((x) => x.t > from && x.t <= to);
    if (log.length === 0 || log[0]!.from === log.at(-1)!.to) continue;
    const tier = log.at(-1)!.to;
    out.push({ hub, text: STANDING_UX.returnLine(market(w, hub), log[0]!.from, tier), badge: { tier, band: bandOfTier(tier) }, seeIt: can && owed.some((o) => o.hub === hub) });
  }
  for (const o of owed) {
    if (out.some((x) => x.hub === o.hub)) continue;
    out.push({ hub: o.hub, text: STANDING_UX.returnOwed(market(w, o.hub), STANDING.band[bandOfTier(o.tier)], o.tier), badge: { tier: o.tier, band: bandOfTier(o.tier) }, seeIt: can });
  }
  return out.map(({ hub: _h, ...x }) => x);
}
