import { canMakeHot, clearsNear as engineClearsNear, dayOf, dockHoursAt, dutyResetAt, nextOpen, dispatchProfile, EQUIPMENT, expectedReloadDeadheadMi, mayTake, operatingTrucks, ownerDrawFd, placeMiles, placeToll, planIndex, vettingBlock, type Company, type Load, type Truck, type World } from "@lanes/engine";
import { COMMODITIES } from "@lanes/data";
import { trueBreakEven } from "./breakeven.js";
import { WALL } from "./copy.js";
import { shortDate } from "./format.js";

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
  suggest: number;
  profitSuggest: number;
  /** The destination market's loads per truck for this trailer last round (the Rates table's figure): hot at 1.5, tight at 1.1. */
  heat: number;
  /** The owner's draw over the loaded and empty miles when it stays with the company (ownerDrawFd): the cash segment counts it. */
  draw: number;
  /** Why this company can't take it now, as the chip says it; null when it can. */
  block: string | null;
}

/** "hot" (Jeff, 2026-11-04, in place of "deliver"): loads bound for the hottest markets first. */
export type BoardSort = "nearest" | "pay" | "hot" | "clears";

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
export function clearsNearSource(w: World, l: Load): { from: "lane" | "market" | "load"; n: number; rate: number; capped: boolean } {
  const lane = w.clears?.lane[`${l.laneId}:${l.equipment}`];
  const hub = w.clears?.hub[`${l.origin}:${l.equipment}`];
  const [from, rate, n] = lane && lane[1] >= CLEARS_MIN ? (["lane", lane[0], lane[1]] as const) : hub && hub[1] >= CLEARS_MIN ? (["market", hub[0], hub[1]] as const) : (["load", l.refRate * (l.hot || 1), 0] as const);
  return { from, n, rate, capped: rate > l.ceiling };
}

/** The suggested bid, as the players' default rule bids (R1): what it usually clears near, break-even the floor, over book-now, never over the ceiling. */
export const suggestBid = (w: World, l: Load, be: number): number => Math.max(l.bookNow + 0.05, Math.min(l.ceiling, Math.max(be, clearsNear(w, l))));

/**
 * The bid range the stepper allows: a little over break-even, up to the ceiling. The engine still takes a bid over the
 * ceiling (it wins only if nobody bids within it), but the board doesn't offer one (market truth, row 15).
 */
export function bidRange(_w: World, l: Load, be: number): [number, number] {
  return [Math.min(l.ceiling, Math.max(0.5, be * 1.05)), l.ceiling];
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
  if (!mayTake(w, c, l)) return WALL.localFirst(nextRoundHH(w));
  return null;
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
}
/** `drawFd`: the owner's draw the company keeps on this load (ownerDrawFd), which lands as cash though break-even counts it as the driver's pay. */
export function chipPair(w: World, t: Truck, profitFd: number, grossFd: number, drawFd = 0): ChipPair {
  const held = leaseHold(w, t, grossFd);
  return { profit: profitFd, cash: profitFd - held + drawFd, held };
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
  for (const l of w.loads.values()) {
    if (l.status !== "open" || l.equipment !== truck.trailer || l.brokerId === c.id) continue;
    if (l.tenderedTo !== 0 && l.tenderedTo !== c.id) continue; // someone else's contract tender
    const dh = placeMiles(w, truck.place, l.originPlace);
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
    const tolls = placeToll(w, truck.place, l.originPlace);
    const be = trueBreakEven(w, truck, l, dh, tolls, prof.foresightDays, prof.reloadWeight);
    const suggest = suggestBid(w, l, be);
    rows.push({
      l,
      dh,
      be,
      reloadMi: expectedReloadDeadheadMi(w, l.dest, l.equipment, prof.foresightDays),
      tolls: tolls + l.routeTollFd,
      total: l.bookNow * l.miles,
      profitBook: (l.bookNow - be) * l.miles,
      heldBook: leaseHold(w, truck, l.bookNow * l.miles),
      clears: clearsNear(w, l),
      suggest,
      profitSuggest: (suggest - be) * l.miles,
      heat: marketHeat(w, l.dest, l.equipment),
      draw: ownerDrawFd(w, truck, l.miles + dh),
      block: blockReason(w, c, truck, l),
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
    sort === "nearest" ? r.dh : sort === "pay" ? -r.total : sort === "hot" ? -r.heat : -(r.clears - r.be) * r.l.miles;
  return [...rows].sort((a, b) => {
    if (!!a.block !== !!b.block) return a.block ? 1 : -1;
    if (firstVisit && a.profitBook >= 0 !== b.profitBook >= 0) return a.profitBook >= 0 ? -1 : 1;
    return key(a) - key(b) || (sort === "hot" ? b.profitBook - a.profitBook : 0) || a.l.id - b.l.id;
  });
}
