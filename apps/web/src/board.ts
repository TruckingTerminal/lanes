import { canMakeHot, filesForOpening, freeOf, homeBlock, windowsOn, type Reach, homeEdge, resting, settlementShare, clearsNear as engineClearsNear, clearsNearParts, dayOf, dockHoursAt, dutyResetAt, nextOpen, dispatchProfile, EQUIPMENT, expectedReloadDeadheadMi, mayTake, operatingTrucks, ownerDrawFd, placeMiles, placeToll, planIndex, vettingBlock, type Company, type Load, type Truck, type World } from "@lanes/engine";
import { COMMODITIES } from "@lanes/data";
import { trueBreakEven } from "./breakeven.js";
import { WALL } from "./copy.js";
import { hhmm, shortDate, weekday } from "./format.js";
import { PENDING } from "./copy-pending.js";
import { truckNumber } from "./trucknos.js";
import { reachChip, reachFor } from "./windowsui.js";

/**
 * The board's arithmetic (specs/first-ten-minutes.md, S2–S5), apart from the screen so it can be tested: each open load
 * a truck could take, with its profit at book-now and at the suggested bid on the one break-even (breakeven.ts), the
 * reason it's blocked if it is, and the sorts and filters the cards use.
 */
export interface BoardRow {
  l: Load;
  /** Empty miles to the pickup. */
  dh: number;
  /** The break-even per mile: the same number the chip, S3's row and S7's pay line show. */
  be: number;
  /** The expected empty run out of the destination, which the break-even prices in (S3 names it as an expectation). */
  reloadMi: number;
  tolls: number;
  total: number;
  profitBook: number;
  /** What the lease would hold back toward the player's own truck from the load at book-now (leaseHold). */
  heldBook: number;
  /** What it usually clears near (clearsNear), per mile. */
  clears: number;
  /** The suggested bid (suggestBid), or null when nothing above book-now is worth betting on. */
  suggest: number | null;
  profitSuggest: number | null;
  /** The destination market's loads per truck for this trailer last round (the Rates table's figure): hot at 1.5, tight at 1.1. */
  heat: number;
  /** The owner's draw over the loaded and empty miles when it stays with the company (ownerDrawFd): the cash segment counts it. */
  draw: number;
  /** Why this company can't take it now, as the chip says it; null when it can. */
  block: string | null;
  /** leverage.localHoldHandBids: the only block is a locals-first hold in its last round, so a bid by hand is filed for the opening. */
  files: boolean;
  /** Delivery windows (client batch W): canMake's answer for this truck, from where it will be free; null with windows off. */
  reach: Reach | null;
}

/**
 * "hot" (Jeff, 2026-11-04, in place of "deliver"): loads bound for the hottest markets first. "pickup" (client batch W, the
 * director): the pickup's close first, the default once windows are on.
 */
export type BoardSort = "nearest" | "pay" | "hot" | "clears" | "pickup";

/** A market's loads per truck for a trailer last round, as the Rates table reads it. */
export const marketHeat = (w: World, hub: number, eq: Load["equipment"]): number => w.lastRatioEq[planIndex(hub, EQUIPMENT.indexOf(eq))] ?? 1;
export interface BoardFilter {
  /** Where it delivers (destMatch): a city, a state, a market or a DAT zone; "" or "any" for anywhere. */
  dest: string;
  /** The loaded rate per mile at least, and the trip at most this long (0: no limit). */
  minRpm?: number;
  maxMiles?: number;
  maxDh: number;
  query: string;
  /** Only the loads this company posted, as broker or shipper (Intel's "Their loads on the board"). */
  poster?: number | null;
}

/** The rate over the loaded and empty miles together (Jeff, 2026-11-04: the empty miles cost what loaded ones do); null with no empty miles. */
export const allInRate = (total: number, loadedMi: number, dh: number): string | null => (dh >= 1 ? (total / (loadedMi + dh)).toFixed(2) : null);

const STATE_NAMES: Record<string, string> = { AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california", CO: "colorado", CT: "connecticut", DE: "delaware", DC: "district of columbia", FL: "florida", GA: "georgia", HI: "hawaii", ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa", KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland", MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi", MO: "missouri", MT: "montana", NE: "nebraska", NV: "nevada", NH: "new hampshire", NJ: "new jersey", NM: "new mexico", NY: "new york", NC: "north carolina", ND: "north dakota", OH: "ohio", OK: "oklahoma", OR: "oregon", PA: "pennsylvania", RI: "rhode island", SC: "south carolina", SD: "south dakota", TN: "tennessee", TX: "texas", UT: "utah", VT: "vermont", VA: "virginia", WA: "washington", WV: "west virginia", WI: "wisconsin", WY: "wyoming" };
/** DAT's zones, the ZIP code's first digit: Z0 New England to Z9 the Pacific. */
export const ZONES: Record<string, readonly string[]> = { Z0: ["CT", "MA", "ME", "NH", "NJ", "RI", "VT"], Z1: ["DE", "NY", "PA"], Z2: ["DC", "MD", "NC", "SC", "VA", "WV"], Z3: ["AL", "FL", "GA", "MS", "TN"], Z4: ["IN", "KY", "MI", "OH"], Z5: ["IA", "MN", "MT", "ND", "SD", "WI"], Z6: ["IL", "KS", "MO", "NE"], Z7: ["AR", "LA", "OK", "TX"], Z8: ["AZ", "CO", "ID", "NM", "NV", "UT", "WY"], Z9: ["AK", "CA", "HI", "OR", "WA"] };

/**
 * Whether a load delivers where the destination filter says (Jeff, 2026-11-04, as on DAT): a city ("Tampa", "Tampa, FL",
 * "Dallas TX"), a state ("FL", "Florida"), a market ("DAL") or a zone ("Z3"); several, separated by commas or spaces,
 * match any; empty matches every load.
 */
export function destMatch(w: World, l: Load, text: string): boolean {
  const q = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q || q === "any" || q === "anywhere") return true;
  const p = w.net.places[l.destPlace]!;
  const h = w.net.hubs[l.dest]!;
  const st = p.state.toUpperCase();
  const stateOf = (term: string): boolean => term === st.toLowerCase() || STATE_NAMES[st] === term || (/^z\d$/.test(term) && (ZONES[term.toUpperCase()] ?? []).includes(st));
  const cityOf = (term: string): boolean => term.length >= 3 && (p.name.toLowerCase().startsWith(term) || h.name.toLowerCase().startsWith(term) || h.id.toLowerCase() === term);
  if (stateOf(q)) return true;
  const m = /^(.+?)[,\s]+([a-z]{2}|z\d)$/.exec(q);
  // "Tampa, FL" needs both; a city that merely ends in two letters ("Santa Fe") falls through to the terms below.
  if (m && stateOf(m[2]!)) return cityOf(m[1]!);
  return q.split(/[,\s]+/).some((t) => stateOf(t) || cityOf(t));
}

/** The company that posted a load: its broker, else its shipper (null for an NPC shipper's load). */
export const posterOf = (l: Load): number | null => l.brokerId ?? l.shipperId ?? null;

/**
 * What a load "usually clears near" on the board: the engine's figure (freight.ts clearsNear), the lane's trailing clears
 * for this trailer, else its origin market's, else the load's own reference; never above this load's ceiling.
 */
export const clearsNear = (w: World, l: Load): number => engineClearsNear(w, l);

/** Where clearsNear's figure came from, for its explanation. freight.ts reads a table once it has CLEARS_MIN clears (5). */
const CLEARS_MIN = 5;
export function clearsNearSource(w: World, l: Load): { from: "lane" | "market" | "load"; n: number; rate: number; capped: boolean; shares?: { lane: number; market: number; load: number } } {
  // The economy's ratio rule (freight.clearsNear.ratio): the figure's share from the lane, its market and the load's own
  // reference, by the weights the engine blends them with (freight.ts clearsNearParts); the largest names the source.
  if (w.cfg.freight.clearsNear.ratio) {
    const p = clearsNearParts(w, l);
    const lane = p.laneW / (p.laneW + p.prior);
    const market = (1 - lane) * (p.hubW / (p.hubW + p.prior));
    const load = Math.max(0, 1 - lane - market);
    const rate = p.laneRatio * l.refRate * (l.hot || 1);
    const from = lane >= market && lane >= load ? "lane" : market >= load ? "market" : "load";
    return { from, n: Math.round(from === "lane" ? p.laneW : p.hubW), rate, capped: rate > l.ceiling, shares: { lane, market, load } };
  }
  const lane = w.clears?.lane[`${l.laneId}:${l.equipment}`];
  const hub = w.clears?.hub[`${l.origin}:${l.equipment}`];
  const [from, rate, n] = lane && lane[1] >= CLEARS_MIN ? (["lane", lane[0], lane[1]] as const) : hub && hub[1] >= CLEARS_MIN ? (["market", hub[0], hub[1]] as const) : (["load", l.refRate * (l.hot || 1), 0] as const);
  return { from, n, rate, capped: rate > l.ceiling };
}

/**
 * The suggested bid (the director, 2026-11-09, pass 2b): what the load usually clears near, never over the ceiling. Null
 * when there is nothing above Book now worth betting on: the figure at or under book-now, or under break-even. Then the
 * sheet shows Book now and an empty bid field. A suggestion is only ever a default the player presses; nothing places it.
 * (A bid pays the bidder's rate and a booking at book-now takes the load first, so a bid is a bet on nobody booking.)
 */
export function suggestBid(w: World, l: Load, be: number): number | null {
  // Client batch 8a item 61 (the director's G): a default only where the lane has enough clears of its own (the market's
  // or the load's own figure is not a lane's usual clear), and so "Bid on…" is recommended only then.
  if (clearsNearSource(w, l).from !== "lane") return null;
  const s = Math.min(l.ceiling, clearsNear(w, l));
  return s > l.bookNow + 0.005 && s >= be ? s : null;
}

/**
 * The bid range the stepper allows: a little over break-even, up to the ceiling. The engine still takes a bid over the
 * ceiling (it wins only if nobody bids within it), but the board doesn't offer one (market truth, row 15).
 */
/**
 * The highest bid a player can place, to the cent: the ceiling rounded down (client batch 7, QA: "Ceiling 4.06/mi" showed
 * a ceiling of 4.0573 rounded up, and a bid of 4.06 was refused as above it). Shown wherever the ceiling is a bid's top.
 */
export const bidCeiling = (l: Load): number => Math.floor(l.ceiling * 100 + 1e-6) / 100;
/**
 * A rate as shown beside the ceiling (client batch 8a item 4, QA): never over the shown ceiling. "Book now 4.68/mi" and
 * "Usually clears near 4.68/mi" beside "Ceiling 4.67/mi" read as a contradiction; a figure that would show over it shows
 * the ceiling's.
 */
export const rateShown = (l: Load, rate: number): string => Math.min(Math.round(rate * 100) / 100, bidCeiling(l)).toFixed(2);
/** The over-ceiling test for a typed bid: more than a cent above the shown ceiling is refused, never lowered in silence. */
export const overCeiling = (l: Load, rate: number): boolean => rate > bidCeiling(l) + 0.01 + 1e-9;
/**
 * What a typed bid field holds (client batch 8b item 10): empty, a rate a mile (above 0), or something that isn't one
 * ("abc", −5, 0). A comma counts as the decimal point.
 */
export function typedRate(text: string): { kind: "empty" } | { kind: "rate"; rate: number } | { kind: "bad" } {
  const t = text.trim().replace(",", ".");
  if (t === "") return { kind: "empty" };
  const n = /^\d*\.?\d+$/.test(t) ? Number(t) : NaN;
  return Number.isFinite(n) && n > 0 ? { kind: "rate", rate: n } : { kind: "bad" };
}
/** A typed bid within a cent above the shown ceiling is the shown ceiling (the cent the display rounded away). */
export const clampToCeiling = (l: Load, rate: number): number => (rate > bidCeiling(l) && rate <= bidCeiling(l) + 0.01 + 1e-9 ? bidCeiling(l) : rate);

/**
 * Client batch 8a item 61 (the director's G; the stubborn specialist's 2.32 floor above the 2.28 that won): the stepper's
 * floor is break-even itself, to the cent; a bid typed under it is allowed, with the loss said.
 */
export function bidRange(_w: World, l: Load, be: number): [number, number] {
  const top = bidCeiling(l);
  return [Math.min(top, Math.max(0.01, Math.ceil(be * 100 - 1e-6) / 100)), top];
}

/** The next board round's hour, "18:00": when a round's local-first window opens to everyone. */
function nextRoundHH(w: World): string {
  const hour = (w.t % w.cfg.time.gameMinutesPerDay) / 60;
  const h = w.cfg.time.boardRoundHours.find((x) => x > hour) ?? w.cfg.time.boardRoundHours[0]!;
  return `${String(h).padStart(2, "0")}:00`;
}

/** The chip's words for a load this company can't take (copy-first-ten-minutes.md, S2 "Blocked chips"). */
export function blockReason(w: World, c: Company, truck: Truck, l: Load): string | null {
  const v = vettingBlock(w, c, l);
  if (v) {
    const k = w.cfg.fraud.vetting;
    const age = dayOf(w.t, w.cfg) - c.authority.since;
    if (v.startsWith("authority under") && l.vet === 1) return WALL.vettingStandard(k.standard.minAuthorityDays, shortDate(c.authority.since + k.standard.minAuthorityDays));
    // Strict: only the date is short once the loads are there; else both counts, theirs and yours.
    if (v.startsWith("authority under") && c.delivered >= k.strict.minDelivered) return WALL.vettingStrictDate(k.strict.minAuthorityDays, shortDate(c.authority.since + k.strict.minAuthorityDays));
    if (v.startsWith("authority under") || v.startsWith("fewer than")) return WALL.vettingStrict(k.strict.minAuthorityDays, k.strict.minDelivered, age, c.delivered);
    return v.charAt(0).toUpperCase() + v.slice(1);
  }
  if (l.hot > 0 && !canMakeHot(c, truck)) return WALL.hot;
  // The director's rules H and C (engine standingOrders.ts homeBlock, each behind its switch), in her words.
  if (homeBlock(w, c, truck, l)) {
    const d = w.staff[truck.driverId - 1]!;
    if (!resting(w, truck)) return PENDING.pastDueHome(d.name);
    const back = d.homeUntilDay! * w.cfg.time.gameMinutesPerDay;
    const pickup = Math.max(w.t, l.readyT ?? w.t);
    const when = (t: number) => `${weekday(Math.floor(t / w.cfg.time.gameMinutesPerDay))} ${hhmm(t)}`;
    return PENDING.homeUntil(d.name, when(back), when(pickup));
  }
  if (!mayTake(w, c, l)) return WALL.localFirst(nextRoundHH(w));
  return null;
}

/**
 * The director's rule H, the owner's half: an owner-operator on home time may cut their own days off, warned first (on
 * the page, under labor.homeTimeHolds). The days at home so far, or null when no warning is due.
 */
export function cutsDaysOff(w: World, truck: Truck): number | null {
  if (!w.cfg.labor.homeTimeHolds || !truck.driverId || !resting(w, truck)) return null;
  const d = w.staff[truck.driverId - 1]!;
  return d.owner ? d.restDays : null;
}

/**
 * leverage.localHoldHandBids (the economy's locals-first look): the load's one wall is the locals-first hold, in its last
 * round, so Book now stays shut but a bid by hand is filed for the opening clearing (engine contracts.ts filesForOpening).
 */
export function bidFiles(w: World, c: Company, truck: Truck, l: Load): boolean {
  return vettingBlock(w, c, l) === null && !(l.hot > 0 && !canMakeHot(c, truck)) && filesForOpening(w, c, l);
}

/**
 * What the lessor holds back toward the player's own truck from a load paying `grossFd`, as trips.ts settles it: a share
 * of each leased load (freeEntry.leases.byValue.escrowShareOfPay) until the deposit is whole. It is the player's money,
 * held, so the profit chip says it apart from what lands (the director's row 2).
 */
export function leaseHold(w: World, t: Truck, grossFd: number): number {
  const owed = t.depositDueFd - t.depositFd;
  if (t.lease === "owned" || owed <= 0.005 || grossFd <= 0) return 0;
  return Math.min(owed, grossFd * w.cfg.freeEntry.leases.byValue.escrowShareOfPay);
}

/**
 * R14's one arithmetic: what a load leaves (profit), what of it reaches cash now, and what the lease holds toward the
 * player's truck. The chip, Book now, Bid and What now? all read it.
 */
export interface ChipPair {
  profit: number;
  cash: number;
  held: number;
  /** The owner's draw inside `cash` (it stays with the company), said beside the figure as the pay card says it. */
  draw?: number;
}
/**
 * `profitFd`: what the load leaves at the rate (profitOver). `drawFd`: the owner's draw the company keeps on this load
 * (ownerDrawFd), which lands as cash though break-even counts it as the driver's pay.
 */
export function chipPair(w: World, t: Truck, profitFd: number, grossFd: number, drawFd = 0): ChipPair {
  const held = leaseHold(w, t, grossFd);
  return drawFd ? { profit: profitFd, cash: profitFd - held + drawFd, held, draw: drawFd } : { profit: profitFd, cash: profitFd - held, held };
}

/** What beat a hand bid (client batch 8c item 69); PENDING.lostWhy words each. */
export type LostWhy = "record" | "nearer" | "home" | "local" | "outright";

/**
 * Client batch 8c item 69 (the director, director-qa-0241-2026-11-12.md §2): what beat a hand bid in the round, read off the
 * clearing's own score (engine standingOrders.ts scoreBid: the price against the ceiling, the carrier's reputation, the
 * empty miles to the pickup, the home edge of a carrier based near it). When a higher bid won, the term that gave the
 * winner the most over the player's: its record, its truck nearer the pickup, or its home there. Null when the winner bid
 * the same or lower. A higher bid with none of these behind it is an engine bug (the director): logged, and said as nothing.
 */
export function lostWhy(w: World, load: Load, mine: { truckId: number; rate: number }): LostWhy | null {
  if (load.carrierId === null || load.truckId === null || load.clearedRate <= mine.rate + 1e-9) return null;
  const myTruck = w.trucks[mine.truckId - 1];
  const theirTruck = w.trucks[load.truckId - 1];
  if (!myTruck || !theirTruck) return null;
  const me = w.companies[myTruck.companyId - 1]!;
  const them = w.companies[load.carrierId - 1]!;
  const k = w.cfg.board;
  const dh = (t: Truck) => placeMiles(w, t.place, load.originPlace);
  const terms: [LostWhy, number][] = [
    ["record", k.scoreWeights.reputation * (them.reputation - me.reputation)],
    ["nearer", (k.scoreWeights.deadhead * (dh(myTruck) - dh(theirTruck))) / k.deadheadScaleMi],
    ["home", homeEdge(w, them, load.origin) - homeEdge(w, me, load.origin)],
  ];
  const best = terms.sort((a, b) => b[1] - a[1])[0]!;
  if (best[1] > 1e-9) return best[0];
  console.warn(`[engine] load ${load.id}: a higher bid (${load.clearedRate.toFixed(2)}) beat a hand bid (${mine.rate.toFixed(2)}) with no reason in the score`);
  return null;
}

/**
 * What a load leaves the company at `rate`, over break-even `be` (client batch 8b item 52, the producer's call of
 * 2026-11-12). Break-even prices the lessor's share at break-even revenue only (economics.ts breakEvenPerMile divides the
 * costs by what the lessor leaves), so on a leased truck the lessor still takes its share of every FD over it, as the
 * pay line settles it (rolling.ts payLine). Before, the margin was shown whole, and What now?'s "to cash now" ran about
 * 15% of the profit over the pay. Every profit a screen shows comes through here (the board's and the Loads table's
 * rows, a bid's profit, What now?'s and a lost bid's, the profit chip's sheet), so they agree; chipPair reads it.
 */
export function profitOver(w: World, t: { lease: Truck["lease"] } | undefined, rate: number, be: number, miles: number): number {
  // token.settlementFee: a share of gross like the lessor's (0 off), as break-even counts it (economics.ts).
  return (rate - be) * miles * ((t && t.lease !== "owned" ? 1 - w.cfg.costs.npcLeaseShareOfGross : 1) - settlementShare(w.cfg));
}
/** A chip figure: whole FD up to 9,999, then thousands to one place ("12.4k"); no sign. */
export function chipFd(x: number): string {
  const a = Math.abs(x);
  return a < 9_999.5 ? Math.round(a).toLocaleString("en-US") : `${(Math.round(a / 100) / 10).toFixed(1)}k`;
}
/** The cash segment's figure: its sign kept ("−103", "504"). */
export const chipCash = (x: number): string => `${x < -0.5 ? "−" : ""}${chipFd(x)}`;

/**
 * The dock warning at booking (the trucker booked Friday night and sat all weekend): when this truck would reach the
 * pickup and the receiver, at the nominal pace with a rest when the day's hours run out, and how long each closed dock
 * would hold it (docks.ts dockHoursAt and nextOpen, which draw nothing). An appointment dock sets its own slot, so it
 * has none.
 */
export function dockWaits(w: World, t: Truck, l: Load, dhMi: number): { pickup: { openT: number; waitMin: number } | null; delivery: { openT: number; waitMin: number } | null } {
  const k = w.cfg.hos;
  const rest = (k.restHours > 0 ? k.restHours : 24 - k.drivingHoursPerDay) * 60;
  const drive = (mi: number, leftMin: number) => {
    const min = (mi / k.avgMph) * 60;
    return min <= leftMin ? min : min + Math.ceil((min - leftMin) / (k.drivingHoursPerDay * 60)) * rest;
  };
  const at = (end: "pickup" | "delivery", arrive: number) => {
    const h = dockHoursAt(w, l, end);
    if (!h) return null;
    const open = nextOpen(w, arrive, h);
    return open - arrive >= 30 ? { openT: open, waitMin: open - arrive } : null;
  };
  // The day's hours left, read without opening a new duty day (trips.ts drivingMinutesLeft writes to the truck).
  const reset = dutyResetAt(w, t);
  const left = reset === null || w.t >= reset ? k.drivingHoursPerDay * 60 : Math.max(0, k.drivingHoursPerDay * 60 - t.shiftDrivenMin);
  const toPickup = w.t + drive(dhMi, left);
  const pickup = at("pickup", toPickup);
  const rolling = (pickup ? pickup.openT : toPickup) + ((w.cfg.dwell.loadMinutes[0] + w.cfg.dwell.loadMinutes[1]) / 2);
  const delivery = at("delivery", rolling + drive(l.miles, k.drivingHoursPerDay * 60));
  return { pickup, delivery };
}

/** A leased truck whose deposit is whole: nothing more is held, so the chip says all of the profit lands. */
export const depositWhole = (t: Truck): boolean => t.lease !== "owned" && t.depositDueFd > 0.005 && t.depositDueFd - t.depositFd <= 0.005;

/** Every open load this truck could haul within the filter, with its numbers. */
export function boardRows(w: World, c: Company, truck: Truck, f: BoardFilter): BoardRow[] {
  const prof = dispatchProfile(w, c, operatingTrucks(w, c.id));
  const q = f.query.trim().toLowerCase();
  const rows: BoardRow[] = [];
  // Client batch W: a truck on a job books its next load from where it will be free (engine actions.ts book_load); once
  // per truck, canMake's first half.
  const free = windowsOn(w) ? freeOf(w, truck) : null;
  const from = free && truck.status !== "idle" ? free.place : truck.place;
  const no = truckNumber(w, truck);
  for (const l of w.loads.values()) {
    if (l.status !== "open" || l.equipment !== truck.trailer || l.brokerId === c.id) continue;
    if (l.tenderedTo !== 0 && l.tenderedTo !== c.id) continue; // someone else's contract tender
    const dh = placeMiles(w, from, l.originPlace);
    if (dh > f.maxDh) continue;
    if (!destMatch(w, l, f.dest)) continue;
    if (f.minRpm && l.bookNow < f.minRpm - 1e-9) continue;
    if (f.maxMiles && l.miles > f.maxMiles) continue;
    if (f.poster && posterOf(l) !== f.poster) continue;
    if (q) {
      const op = w.net.places[l.originPlace]!;
      const dp = w.net.places[l.destPlace]!;
      if (![COMMODITIES[l.commodity]!.name, op.name, op.state, dp.name, dp.state].some((s) => s.toLowerCase().includes(q))) continue;
    }
    const tolls = placeToll(w, from, l.originPlace);
    const be = trueBreakEven(w, truck, l, dh, tolls, prof.foresightDays, prof.reloadWeight);
    const reach = reachFor(w, truck, l, free);
    const suggest = suggestBid(w, l, be);
    rows.push({
      l,
      dh,
      be,
      reloadMi: expectedReloadDeadheadMi(w, l.dest, l.equipment, prof.foresightDays),
      tolls: tolls + l.routeTollFd,
      total: l.bookNow * l.miles,
      profitBook: profitOver(w, truck, l.bookNow, be, l.miles),
      heldBook: leaseHold(w, truck, l.bookNow * l.miles),
      clears: clearsNear(w, l),
      suggest,
      profitSuggest: suggest === null ? null : profitOver(w, truck, suggest, be, l.miles),
      heat: marketHeat(w, l.dest, l.equipment),
      draw: ownerDrawFd(w, truck, l.miles + dh),
      // Client batch W: a load this truck can't make is closed with canMake's reason as its chip (R22).
      block: blockReason(w, c, truck, l) ?? (reach ? reachChip(w, l, reach, no) : null),
      files: bidFiles(w, c, truck, l) && (!reach || reach.ok),
      reach,
    });
  }
  return rows;
}

/**
 * The cards' order: blocked loads always last; on the first visit, loads that pay at book-now first; then the chosen
 * sort ("clears" is Bid again's: profit at the usual clearing rate).
 */
export function sortRows(rows: BoardRow[], sort: BoardSort, firstVisit: boolean): BoardRow[] {
  const key = (r: BoardRow): number =>
    sort === "nearest" ? r.dh : sort === "pay" ? -r.total : sort === "hot" ? -r.heat : sort === "pickup" ? (r.l.latestPickupT ?? r.l.appointmentT) : -(r.clears - r.be) * r.l.miles;
  return [...rows].sort((a, b) => {
    if (!!a.block !== !!b.block) return a.block ? 1 : -1;
    if (firstVisit && a.profitBook >= 0 !== b.profitBook >= 0) return a.profitBook >= 0 ? -1 : 1;
    return key(a) - key(b) || (sort === "hot" ? b.profitBook - a.profitBook : 0) || a.l.id - b.l.id;
  });
}
