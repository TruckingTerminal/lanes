import { dayOf, MINUTES_PER_HOUR } from "./clock.js";
import { resting } from "./standingOrders.js";
import type { Company, Load, Scorecard, StandingCause, StandingStats, Truck } from "./types.js";
import { canMake, windowsOn } from "./windows.js";
import { companyById, crewed, hubMiles, operatingTrucks, type World } from "./world.js";

/**
 * Standing with a market's shippers, ten tiers (the director: studio/reviews/director-standing-10.md and
 * director-standing-final.md; the economy's sizes: economy-standing.md). Behind standing.enabled; off, nothing here runs
 * and no state is made.
 *
 * One scorecard per carrier and origin market ("Standing with Dallas shippers"): the market's NPC direct and contract
 * loads only, a contract load double and a short hop half, over a trailing window. Against it, fixed hits that stay in
 * the window: a cargo claim, a no-show and a release two loads, a late delivery one, a first call declined or let lapse
 * one. Each tier has a floor on loads and one on time. Reviewed weekly at the day's close (step.ts), a tier at most;
 * eight weeks without a load costs a tier, and again each eight weeks after. The perks open at the milestones: dock
 * priority (3), net-15 (5), first call (7), contract offers first (9), a dedicated lane (10). Between milestones the tier
 * orders who is called and offered first. Kept at the company: never sold or shared, and gone at a liquidation.
 *
 * No draws: the order among equal tiers is a hash of the load and the company, so the world's streams draw as before.
 */

/** The switch. A config without the section (a world made before it) reads as off. */
export const standingOn = (w: World): boolean => w.cfg.standing?.enabled === true;

/** A load that builds standing with its origin market's shippers: the NPC shipper's own, direct or on contract. */
export function standingLoad(load: Load): boolean {
  return load.brokerId === null && load.shipperId === null && load.facilityId === null && !load.doubleBroker;
}

// A day's row in Scorecard.days.
const DAY = 0;
const WEIGHT = 1;
const LOADS = 2;
const CONTRACT = 3;
const DELIVERED = 4;
const ON_TIME = 5;
const CLAIMS = 6;
const LATE = 7;
const NO_SHOW = 8;
const RELEASE = 9;
const DECLINED = 10;
const ROW = 11;
/** The lanes a scorecard remembers (its last loads, laneId × 4 + trailer), for the dedicated lane. */
const LANES_KEPT = 20;
const TRAILERS = ["van", "reefer", "flatbed"] as const;

export function standingStats(w: World): StandingStats {
  return (w.standingStats ??= {
    firstCalls: { offered: 0, taken: 0, declined: 0, lost: 0 },
    moves: { up: 0, down: 0, decays: 0 },
    dedicatedOffered: 0,
    netBills: 0,
    dockStops: 0,
    quarters: [],
  });
}

/** The best tier each operating carrier holds, counts for tiers 1 to 10: one-truck carriers and fleets apart. */
export function tierCounts(w: World): { oneTruck: number[]; fleet: number[] } {
  const oneTruck = new Array<number>(w.cfg.standing.loadFloors.length).fill(0);
  const fleet = new Array<number>(w.cfg.standing.loadFloors.length).fill(0);
  for (const c of w.companies) {
    if (c.role !== "carrier" || c.retiredDay !== undefined || c.liquidatingSince !== null) continue;
    const n = operatingTrucks(w, c.id);
    if (n === 0) continue;
    (n === 1 ? oneTruck : fleet)[bestTier(w, c) - 1]!++;
  }
  return { oneTruck, fleet };
}

/** A company's scorecard with a market, if it has one. */
export function scorecard(w: World, c: Company, hub: number): Scorecard | undefined {
  return standingOn(w) ? c.standing?.[hub] : undefined;
}

function card(c: Company, hub: number): Scorecard {
  const all = (c.standing ??= {});
  return (all[hub] ??= { tier: 1, days: [], lastLoadT: -1, trend: [], log: [] });
}

function today(w: World, s: Scorecard): number[] {
  const day = dayOf(w.t, w.cfg);
  const last = s.days[s.days.length - 1];
  if (last && last[DAY] === day) return last;
  const row = new Array<number>(ROW).fill(0);
  row[DAY] = day;
  s.days.push(row);
  return row;
}

/** The tier a company holds with a market's shippers: 1 with no scorecard, and with standing off. */
export function tierAt(w: World, c: Company, hub: number): number {
  return scorecard(w, c, hub)?.tier ?? 1;
}

/** The director's three bands: Approved 1–4, Preferred 5–8, Core 9–10. */
export type StandingBand = "approved" | "preferred" | "core";
export const bandOf = (tier: number): StandingBand => (tier >= 9 ? "core" : tier >= 5 ? "preferred" : "approved");

/** What a tier opens, by milestone. */
export type StandingPerk = "dock" | "net" | "firstCall" | "contracts" | "dedicated";
export const STANDING_PERKS: readonly StandingPerk[] = ["dock", "net", "firstCall", "contracts", "dedicated"];

/** The tier that opens a perk. */
export function perkTier(w: World, perk: StandingPerk): number {
  const k = w.cfg.standing.perks;
  return perk === "dock" ? k.dockTier : perk === "net" ? k.netTier : perk === "firstCall" ? k.firstCallTier : perk === "contracts" ? k.contractTier : k.dedicatedTier;
}

/** Whether a company holds a perk with a market's shippers. */
export function hasPerk(w: World, c: Company, hub: number, perk: StandingPerk): boolean {
  return standingOn(w) && tierAt(w, c, hub) >= perkTier(w, perk);
}

/** A scorecard's window, summed: the figures the floors and the card read. */
export interface StandingTally {
  /** Loads in the window as the floors count them (a contract load double, a short hop half), net of the hits. */
  score: number;
  /** Loads delivered for the market in the window, and how many on contract. */
  loads: number;
  contractLoads: number;
  /** On time over the window's deliveries; null with none. */
  onTimeShare: number | null;
  claims: number;
  late: number;
  noShows: number;
  releases: number;
  declined: number;
}

export function tallyOf(w: World, s: Scorecard): StandingTally {
  const k = w.cfg.standing;
  const from = dayOf(w.t, w.cfg) - k.windowDays;
  let weight = 0;
  let loads = 0;
  let contract = 0;
  let delivered = 0;
  let onTime = 0;
  let claims = 0;
  let late = 0;
  let noShows = 0;
  let releases = 0;
  let declined = 0;
  for (const r of s.days) {
    if (r[DAY]! <= from) continue;
    weight += r[WEIGHT]!;
    loads += r[LOADS]!;
    contract += r[CONTRACT]!;
    delivered += r[DELIVERED]!;
    onTime += r[ON_TIME]!;
    claims += r[CLAIMS]!;
    late += r[LATE]!;
    noShows += r[NO_SHOW]!;
    releases += r[RELEASE]!;
    declined += r[DECLINED]!;
  }
  const h = k.hits;
  const score = weight - (claims * h.claim + late * h.late + noShows * h.noShow + releases * h.release + declined * h.declinedFirstCall);
  return { score, loads, contractLoads: contract, onTimeShare: delivered > 0 ? onTime / delivered : null, claims, late, noShows, releases, declined };
}

/** The highest tier whose floors a tally meets. */
export function tierFor(w: World, t: StandingTally): number {
  const k = w.cfg.standing;
  let tier = 1;
  for (let i = 1; i < k.loadFloors.length; i++) {
    if (t.score < k.loadFloors[i]! || (k.onTimeFloors[i]! > 0 && (t.onTimeShare ?? 0) < k.onTimeFloors[i]!)) break;
    tier = i + 1;
  }
  return tier;
}

// --- What builds and costs standing -------------------------------------------------------------------------------

/** trips.ts deliver: a load delivered for its origin market's shippers, on time or not, with a cargo claim or not. */
export function standingDelivered(w: World, c: Company, load: Load, onTime: boolean, claimed: boolean): void {
  if (!standingOn(w) || !standingLoad(load) || c.liquidatingSince !== null) return;
  const k = w.cfg.standing;
  const s = card(c, load.origin);
  const row = today(w, s);
  const contract = load.contractId !== 0;
  // By its miles (the red team's S2): a 50-mile hop counts a tenth of a load, a run of fullLoadMi or more a whole one.
  row[WEIGHT]! += (contract ? k.contractWeight : 1) * Math.min(1, load.miles / k.fullLoadMi);
  row[LOADS]!++;
  if (contract) row[CONTRACT]!++;
  row[DELIVERED]!++;
  if (onTime) row[ON_TIME]!++;
  else {
    row[LATE]!++;
    s.lastHit = { t: w.t, cause: "late" };
  }
  if (claimed) {
    row[CLAIMS]!++;
    s.lastHit = { t: w.t, cause: "claim" };
  }
  s.lastLoadT = w.t;
  const lanes = (s.lanes ??= []);
  lanes.push(load.laneId * 4 + TRAILERS.indexOf(load.equipment));
  if (lanes.length > LANES_KEPT) lanes.shift();
  if (onTime && !c.standingNoticed) {
    c.standingNoticed = true;
    w.listener?.({ kind: "standing", companyId: c.id, hub: load.origin, what: "noticed", loadId: load.id });
  }
}

/** windows.ts noShow and releaseLoad: a booked load of the market's never hauled, a fixed hit in the window. */
export function standingHit(w: World, c: Company, load: Load, cause: "noShow" | "release"): void {
  if (!standingOn(w) || !standingLoad(load) || c.liquidatingSince !== null) return;
  const s = card(c, load.origin);
  today(w, s)[cause === "noShow" ? NO_SHOW : RELEASE]!++;
  s.lastHit = { t: w.t, cause };
}

// --- The perks ------------------------------------------------------------------------------------------------------

/** trips.ts startLoading and startUnloading: minutes off the dwell at one of a market's docks, for a carrier at the dock tier there. */
export function dockPriority(w: World, companyId: number, hub: number): number {
  if (!standingOn(w) || companyId === 0) return 0;
  const k = w.cfg.standing.perks;
  if (tierAt(w, companyById(w, companyId), hub) < k.dockTier) return 0;
  standingStats(w).dockStops++;
  return k.dockMinutes;
}

/** trips.ts collectUpstream: the days a market's paper falls due in, for a carrier at the net tier there; undefined, the usual terms. */
export function standingTerms(w: World, c: Company, load: Load): number | undefined {
  if (!standingOn(w) || !standingLoad(load)) return undefined;
  const k = w.cfg.standing.perks;
  if (tierAt(w, c, load.origin) < k.netTier) return undefined;
  standingStats(w).netBills++;
  return k.netDays;
}

/** A deterministic order among equals: a hash of two ids (no draw). */
function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  return (h ^ (h >>> 15)) >>> 0;
}

/** The carriers at or above a tier, by market: highest tier first. Only operating carriers. */
export function standingIndex(w: World, minTier: number): Map<number, { c: Company; tier: number }[]> {
  const out = new Map<number, { c: Company; tier: number }[]>();
  if (!standingOn(w)) return out;
  for (const c of w.companies) {
    if (!c.standing || c.role !== "carrier" || c.authority.status !== "active" || c.liquidatingSince !== null || c.retiredDay !== undefined) continue;
    for (const key of Object.keys(c.standing)) {
      const tier = c.standing[Number(key)]!.tier;
      if (tier < minTier) continue;
      const hub = Number(key);
      let list = out.get(hub);
      if (!list) out.set(hub, (list = []));
      list.push({ c, tier });
    }
  }
  return out;
}

/** The time of the next board round after now (the first call's clearing). */
export function nextRoundT(w: World): number {
  const perDay = w.cfg.time.gameMinutesPerDay;
  const base = Math.floor(w.t / perDay) * perDay;
  const hours = [...(w.cfg.time.boardRoundHours as readonly number[])].sort((a, b) => a - b);
  for (const h of hours) if (base + h * MINUTES_PER_HOUR > w.t) return base + h * MINUTES_PER_HOUR;
  return base + perDay + hours[0]! * MINUTES_PER_HOUR;
}

/** The nearest of a carrier's idle crewed trucks of the load's trailer within reach of it that can make it, not given a call this round. */
function callTruck(w: World, c: Company, load: Load, used: Set<number>): Truck | null {
  const reach = w.cfg.standing.perks.firstCallReachMi;
  const win = windowsOn(w);
  let best: Truck | null = null;
  let bestMi = Infinity;
  for (const t of w.trucksByCompany.get(c.id) ?? []) {
    if (used.has(t.id) || t.status !== "idle" || !crewed(t) || t.trailer !== load.equipment || t.nextLoadId !== undefined || resting(w, t)) continue;
    const mi = hubMiles(w, t.hub, load.origin);
    if (mi > reach || mi > bestMi || (mi === bestMi && best !== null && t.id > best.id)) continue;
    if (win && !canMake(w, t, load).ok) continue;
    best = t;
    bestMi = mi;
  }
  return best;
}

/**
 * board.ts runBoardRound, after the posting: first calls whose clearing has passed and that nobody took lapse (a hit in
 * the window, the locals-first hold back a round later), and the market's direct loads just posted (no tender, no hold,
 * not hot) go to the carriers at the first-call tier there: the highest tier first, a truck each that can make the load,
 * one call a truck a round, and only loads with a day or more of life left after the call's clearing. The call holds the
 * load for its carrier alone through the next clearing (tenderedTo, as a tender does): it books it or bids it as on the
 * board, or the call lapses.
 */
export function firstCallRound(w: World, posted: readonly Load[]): void {
  // Settled whether or not the switch is still on, so a world switched off mid-call never keeps a load held (none has a
  // first call unless it was on).
  for (const load of w.loads.values()) {
    const fc = load.firstCall;
    if (fc && fc.state === "open" && fc.round <= w.round) declineFirstCall(w, load);
  }
  if (!standingOn(w)) return;
  const k = w.cfg.standing.perks;
  const callers = standingIndex(w, k.firstCallTier);
  if (callers.size === 0) return;
  const clearT = nextRoundT(w);
  const life = k.firstCallLifeHours * MINUTES_PER_HOUR;
  const win = windowsOn(w);
  // Windows off, a load lives a count of rounds (board.giveUpAfterRounds): the call's round must leave a day of them.
  const roundMin = w.cfg.time.gameMinutesPerDay / w.cfg.time.boardRoundHours.length;
  const roundsLife = (w.cfg.board.giveUpAfterRounds - 1) * roundMin >= life;
  const used = new Set<number>();
  const eligible = (load: Load) => load.status === "open" && load.contractId === 0 && load.tenderedTo === 0 && !load.hold && load.hot === 0 && standingLoad(load) && callers.has(load.origin) && (win ? load.latestPickupT !== undefined && load.latestPickupT - clearT >= life : roundsLife);
  // firstCallMaxShare (the red team's S3): at most that share of a market's eligible loads this round go to first call.
  const room = new Map<number, number>();
  if (k.firstCallMaxShare < 1) {
    const n = new Map<number, number>();
    for (const load of posted) if (eligible(load)) n.set(load.origin, (n.get(load.origin) ?? 0) + 1);
    for (const [hub, m] of n) room.set(hub, Math.floor(m * k.firstCallMaxShare));
  }
  for (const load of posted) {
    if (!eligible(load)) continue;
    const list = callers.get(load.origin)!;
    if (room.has(load.origin) && room.get(load.origin)! <= 0) continue;
    const ranked = [...list].sort((a, b) => b.tier - a.tier || mix(load.id, a.c.id) - mix(load.id, b.c.id) || a.c.id - b.c.id);
    for (const { c } of ranked) {
      const truck = callTruck(w, c, load, used);
      if (!truck) continue;
      used.add(truck.id);
      load.firstCall = { companyId: c.id, round: w.round + 1, localUntil: load.localUntilRound, state: "open" };
      load.tenderedTo = c.id;
      load.tenderUntil = clearT;
      load.localUntilRound = 0;
      if (room.has(load.origin)) room.set(load.origin, room.get(load.origin)! - 1);
      // Their own acceptance figure (the red team's S4), apart from the contract tenders' tenderAcceptance.
      const calls = (card(c, load.origin).calls ??= [0, 0]);
      calls[0]!++;
      standingStats(w).firstCalls.offered++;
      w.listener?.({ kind: "standing", companyId: c.id, hub: load.origin, what: "firstCall", loadId: load.id, truckId: truck.id });
      break;
    }
  }
}

/** board.ts assign: a first call booked or won by its carrier (taken by another, it lapses at its round's end). */
export function firstCallTaken(w: World, load: Load, companyId: number): void {
  const fc = load.firstCall;
  if (!fc || fc.state !== "open" || companyId !== fc.companyId) return;
  fc.state = "taken";
  if (load.tenderedTo === fc.companyId) {
    load.tenderedTo = 0;
    load.tenderUntil = 0;
  }
  load.localUntilRound = fc.localUntil;
  const s = companyById(w, fc.companyId).standing?.[load.origin];
  if (s?.calls) s.calls[1]!++;
  standingStats(w).firstCalls.taken++;
}

/**
 * A first call turned down (contracts.ts rejectTender, the decline) or let lapse (firstCallRound): a hit in the window,
 * the load to the locals-first hold it had (a round later once the call has run its clearing) or the board.
 */
export function declineFirstCall(w: World, load: Load): void {
  const fc = load.firstCall;
  if (!fc || fc.state !== "open") return;
  fc.state = "declined";
  if (load.tenderedTo === fc.companyId) {
    load.tenderedTo = 0;
    load.tenderUntil = 0;
  }
  load.localUntilRound = fc.localUntil > 0 ? fc.localUntil + (w.round >= fc.round ? 1 : 0) : 0;
  if (!standingOn(w)) return; // switched off since: the load goes on, nothing is counted
  standingStats(w).firstCalls.declined++;
  const c = companyById(w, fc.companyId);
  if (c.liquidatingSince !== null) return;
  const s = card(c, load.origin);
  today(w, s)[DECLINED]!++;
  s.lastHit = { t: w.t, cause: "declined" };
  w.listener?.({ kind: "standing", companyId: c.id, hub: load.origin, what: "declined", loadId: load.id });
}

/** board.ts giveUp: a load lost after its first call was turned down. */
export function firstCallLost(w: World, load: Load): void {
  if (load.firstCall?.state === "declined") standingStats(w).firstCalls.lost++;
}

/** The lane a scorecard's last loads ran most (laneId, trailer), for the dedicated lane; ties to the latest. */
export function busiestLane(s: Scorecard): { laneId: number; equipment: (typeof TRAILERS)[number] } | null {
  const lanes = s.lanes ?? [];
  if (lanes.length === 0) return null;
  const n = new Map<number, number>();
  let best = lanes[lanes.length - 1]!;
  for (const x of lanes) n.set(x, (n.get(x) ?? 0) + 1);
  for (let i = lanes.length - 1; i >= 0; i--) if (n.get(lanes[i]!)! > n.get(best)!) best = lanes[i]!;
  return { laneId: Math.floor(best / 4), equipment: TRAILERS[best % 4]! };
}

// --- The weekly review ----------------------------------------------------------------------------------------------

/**
 * step.ts, weekly at the day's close (before the contract offers): each scorecard moves a tier at most, toward the
 * highest tier whose floors its window meets. Down: below the floors, or eight weeks without a load (one step serves
 * both). Up: only with a load in the last eight weeks. A warning a week before a decay. A scorecard back at tier 1 with
 * nothing in its window is dropped.
 */
export function weeklyStanding(w: World): void {
  if (!standingOn(w)) return;
  const k = w.cfg.standing;
  const week = 7 * w.cfg.time.gameMinutesPerDay;
  const decayMin = k.decayWeeks * week;
  const warnMin = k.decayWarnWeeks * week;
  const day = dayOf(w.t, w.cfg);
  const from = day - k.windowDays;
  const stats = standingStats(w);
  const last = stats.quarters.at(-1);
  if (!last || Math.floor(last.day / 91) < Math.floor(day / 91)) stats.quarters.push({ day, ...tierCounts(w) });
  for (const c of w.companies) {
    if (!c.standing) continue;
    if (c.liquidatingSince !== null) {
      delete c.standing;
      continue;
    }
    for (const key of Object.keys(c.standing)) {
      const hub = Number(key);
      const s = c.standing[hub]!;
      while (s.days.length > 0 && s.days[0]![DAY]! <= from) s.days.shift();
      const t = tallyOf(w, s);
      const target = tierFor(w, t);
      const since = Math.max(s.lastLoadT, s.decayedT ?? -1);
      const away = s.lastLoadT < 0 || w.t - s.lastLoadT >= decayMin;
      const decayDue = s.tier > 1 && s.lastLoadT >= 0 && w.t - since >= decayMin;
      const was = s.tier;
      let cause: StandingCause | null = null;
      if (target < s.tier) {
        s.tier--;
        cause = fallCause(w, s, t);
        if (decayDue) s.decayedT = w.t; // one step serves both
      } else if (decayDue) {
        s.tier--;
        cause = "decay";
        s.decayedT = w.t;
        stats.moves.decays++;
      } else if (target > s.tier && !away) {
        s.tier++;
        cause = "rise";
      }
      s.trend.push(s.tier - was);
      if (s.trend.length > k.trendReviews) s.trend.shift();
      if (cause !== null) {
        if (s.tier > was) stats.moves.up++;
        else stats.moves.down++;
        s.log.push({ t: w.t, from: was, to: s.tier, cause });
        w.listener?.({ kind: "standing", companyId: c.id, hub, what: "tier", from: was, to: s.tier, cause });
      } else if (s.tier > 1 && s.lastLoadT >= 0 && w.t - since >= warnMin && w.t - since < decayMin && (s.warnedT ?? -1) < since) {
        s.warnedT = w.t;
        w.listener?.({ kind: "standing", companyId: c.id, hub, what: "decayAhead" });
      }
      const logFrom = w.t - k.windowDays * w.cfg.time.gameMinutesPerDay;
      while (s.log.length > 0 && s.log[0]!.t <= logFrom) s.log.shift();
      if (s.tier === 1 && s.days.length === 0 && s.log.length === 0) delete c.standing[hub];
    }
  }
}

/**
 * Why a scorecard fell (called once its tier is one lower): a hit in the last reviews' weeks (trendReviews), else the
 * on-time floor of the tier it fell from, else loads gone from the window.
 */
function fallCause(w: World, s: Scorecard, t: StandingTally): StandingCause {
  const k = w.cfg.standing;
  const recent = k.trendReviews * 7 * w.cfg.time.gameMinutesPerDay;
  if (s.lastHit && w.t - s.lastHit.t <= recent) return s.lastHit.cause;
  const floor = k.onTimeFloors[s.tier]!; // the floors' index of the tier fallen from is the tier now
  if (floor > 0 && (t.onTimeShare ?? 0) < floor) return "onTime";
  return "aged";
}

// --- The card -------------------------------------------------------------------------------------------------------

export interface StandingCard extends StandingTally {
  hub: number;
  tier: number;
  band: StandingBand;
  /** From the last reviews: rising, steady or slipping. */
  trend: "rising" | "steady" | "slipping";
  /** The next tier's floors (loads as the floors count them, the on-time share; 0, none); null at the top. */
  next: { tier: number; loads: number; onTime: number } | null;
  /** The next milestone and what it opens; null past the last. */
  nextPerk: { tier: number; perk: StandingPerk } | null;
  /** What the tier holds now. */
  perks: StandingPerk[];
  /** The last load for the market (game minutes), -1 for none; and the tier changes in the window, newest last. */
  lastLoadT: number;
  log: Scorecard["log"];
}

/** The card for a company's standing with a market's shippers, or null with standing off. */
export function standingCard(w: World, c: Company, hub: number): StandingCard | null {
  if (!standingOn(w)) return null;
  const k = w.cfg.standing;
  const s = c.standing?.[hub];
  const tier = s?.tier ?? 1;
  const tally: StandingTally = s ? tallyOf(w, s) : { score: 0, loads: 0, contractLoads: 0, onTimeShare: null, claims: 0, late: 0, noShows: 0, releases: 0, declined: 0 };
  const moved = (s?.trend ?? []).reduce((a, b) => a + b, 0);
  const perks = STANDING_PERKS.filter((p) => tier >= perkTier(w, p));
  const ahead = STANDING_PERKS.map((p) => ({ tier: perkTier(w, p), perk: p })).filter((x) => x.tier > tier).sort((a, b) => a.tier - b.tier)[0] ?? null;
  return {
    ...tally,
    hub,
    tier,
    band: bandOf(tier),
    trend: moved > 0 ? "rising" : moved < 0 ? "slipping" : "steady",
    next: tier < k.loadFloors.length ? { tier: tier + 1, loads: k.loadFloors[tier]!, onTime: k.onTimeFloors[tier]! } : null,
    nextPerk: ahead,
    perks,
    lastLoadT: s?.lastLoadT ?? -1,
    log: s?.log ?? [],
  };
}

/** The markets a company has standing with, highest tier first (ties by the latest load). */
export function standingMarkets(w: World, c: Company): number[] {
  if (!standingOn(w) || !c.standing) return [];
  const all = c.standing;
  return Object.keys(all)
    .map(Number)
    .sort((a, b) => all[b]!.tier - all[a]!.tier || all[b]!.lastLoadT - all[a]!.lastLoadT || a - b);
}

/** The best tier a company holds anywhere (1 with none). */
export function bestTier(w: World, c: Company): number {
  if (!standingOn(w) || !c.standing) return 1;
  let best = 1;
  for (const key of Object.keys(c.standing)) best = Math.max(best, c.standing[Number(key)]!.tier);
  return best;
}
