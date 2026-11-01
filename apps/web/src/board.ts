import { canMakeHot, dayOf, dispatchProfile, expectedReloadDeadheadMi, mayTake, operatingTrucks, placeMiles, placeToll, vettingBlock, type Company, type Load, type Truck, type World } from "@lanes/engine";
import { COMMODITIES } from "@lanes/data";
import { trueBreakEven } from "./breakeven.js";

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
  suggest: number;
  profitSuggest: number;
  /** Why this company can't take it now, as the chip says it; null when it can. */
  block: string | null;
}

export type BoardSort = "nearest" | "pay" | "deliver" | "clears";
export interface BoardFilter {
  dest: string;
  maxDh: number;
  query: string;
}

/** The suggested bid: above book-now, toward the market and a margin over break-even, never over the ceiling. */
export const suggestBid = (l: Load, be: number): number => Math.max(l.bookNow + 0.05, Math.min(l.ceiling, Math.max(be * 1.15, l.refRate)));

/** The bid range the stepper allows: a little over break-even, up to what the poster takes over its ceiling. */
export function bidRange(w: World, l: Load, be: number): [number, number] {
  const hi = l.ceiling * w.cfg.board.overCeilingMax;
  return [Math.min(hi, Math.max(0.5, be * 1.05)), hi];
}

/** The chip's words for a load this company can't take (copy-first-ten-minutes.md, S2 "Blocked chips"). */
export function blockReason(w: World, c: Company, truck: Truck, l: Load): string | null {
  const v = vettingBlock(w, c, l);
  if (v) {
    const k = w.cfg.fraud.vetting;
    const age = dayOf(w.t, w.cfg) - c.authority.since;
    if (v.startsWith("authority under") && l.vet === 1) return `Needs ${k.standard.minAuthorityDays}-day authority · day ${age + 1}`;
    if (v.startsWith("authority under") || v.startsWith("fewer than")) return `Needs ${k.strict.minAuthorityDays}-day authority or ${k.strict.minDelivered} loads`;
    return v.charAt(0).toUpperCase() + v.slice(1);
  }
  if (l.hot > 0 && !canMakeHot(c, truck)) return "A hot load needs a team";
  if (!mayTake(w, c, l)) return "Local carriers first this round";
  return null;
}

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
    if (f.dest !== "any" && w.net.hubs[l.dest]!.id !== f.dest) continue;
    if (q) {
      const op = w.net.places[l.originPlace]!;
      const dp = w.net.places[l.destPlace]!;
      if (![COMMODITIES[l.commodity]!.name, op.name, op.state, dp.name, dp.state].some((s) => s.toLowerCase().includes(q))) continue;
    }
    const tolls = placeToll(w, truck.place, l.originPlace);
    const be = trueBreakEven(w, truck, l, dh, tolls, prof.foresightDays, prof.reloadWeight);
    const suggest = suggestBid(l, be);
    rows.push({
      l,
      dh,
      be,
      reloadMi: expectedReloadDeadheadMi(w, l.dest, l.equipment, prof.foresightDays),
      tolls: tolls + l.routeTollFd,
      total: l.bookNow * l.miles,
      profitBook: (l.bookNow - be) * l.miles,
      suggest,
      profitSuggest: (suggest - be) * l.miles,
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
    sort === "nearest" ? r.dh : sort === "pay" ? -r.total : sort === "deliver" ? r.l.appointmentT : -(r.l.refRate - r.be) * r.l.miles;
  return [...rows].sort((a, b) => {
    if (!!a.block !== !!b.block) return a.block ? 1 : -1;
    if (firstVisit && a.profitBook >= 0 !== b.profitBook >= 0) return a.profitBook >= 0 ? -1 : 1;
    return key(a) - key(b) || a.l.id - b.l.id;
  });
}
