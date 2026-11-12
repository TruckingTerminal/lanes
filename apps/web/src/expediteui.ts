import { keptPerTruck, quoteFor, staffsWhatItOwns, weeklyGrossFd, type Company, type ExpediteQuote, type ExpediteWaitParts, type World } from "@lanes/engine";
import type { Equipment, TractorTier } from "@lanes/config";
import { PENDING } from "./copy-pending.js";
import { fdFull, shortDate } from "./format.js";
import { truckNumber } from "./trucknos.js";

/**
 * The early-delivery fee's words (client batch 8b, section D; the director's director-expedite-wait-cost ruling and its
 * re-ruling): the card's lines in her fixed order (the dates and days sooner; the fee, paid now, not refunded; what
 * waiting costs), and Iuliia's sentence from the wait's parts (engine expedite.ts expediteWaitParts), each figure named
 * for what it is and never summed into a promise. Shown only behind assets.expedite.enabled.
 */

/** "6 days" under two weeks, else "4 weeks". */
const span = (days: number): string => (days < 14 ? `${days} ${days === 1 ? "day" : "days"}` : `${Math.round(days / 7)} weeks`);

/** The card's first two lines: the dates and the days sooner, then the fee. */
export function expediteLines(q: ExpediteQuote, wasDay: number): string[] {
  return [PENDING.expediteDates(shortDate(q.readyDay), shortDate(wasDay), q.daysSaved), PENDING.expediteFee(fdFull(q.feeFd))];
}

/**
 * Iuliia's sentence (the director's shape): the certain costs first (payments, the lessor's share), then, where the
 * term counts, what the trucks have kept "if this one does the same" with the fee last and the verdict on the freight;
 * otherwise "that's all I can count" and why (a truck standing empty, none seated, too few weeks of books).
 */
export function waitSentence(w: World, c: Company, p: ExpediteWaitParts): string {
  const s = span(p.daysSaved);
  const base =
    p.paymentsFd >= 0.5 && p.lessorFd >= 0.5
      ? PENDING.waitBoth(s, fdFull(p.paymentsFd), fdFull(p.lessorFd))
      : p.paymentsFd >= 0.5
        ? PENDING.waitPayments(s, fdFull(p.paymentsFd))
        : p.lessorFd >= 0.5
          ? PENDING.waitLessor(s, fdFull(p.lessorFd))
          : PENDING.waitNothing(s);
  const verdict = p.paymentsFd + p.lessorFd + p.keptFd > p.feeFd ? PENDING.waitPays : PENDING.waitDoesNot;
  switch (p.keptCase) {
    case "counts":
      return `${base}. ${PENDING.waitCounts(fdFull(p.keptPerTruckWeekFd), Math.round(p.keptWeeks), fdFull(p.keptFd), fdFull(p.feeFd))} ${verdict}`;
    case "emptyTruck": {
      // The player's own number for the empty truck (trucknos.ts), not the engine's place in the list.
      const t = (w.trucksByCompany.get(c.id) ?? []).find((x) => x.status !== "retired" && x.status !== "parked" && x.status !== "listed" && x.driverId === 0);
      return `${base}; ${PENDING.waitAllICount} ${PENDING.waitEmptyTruck(t ? truckNumber(w, t) : (p.emptyTruckNo ?? 1))}`;
    }
    case "noTruckSeated":
      return `${base}; ${PENDING.waitAllICount} ${PENDING.waitNoneSeated}`;
    case "books":
      return `${base}; ${PENDING.waitAllICount} ${PENDING.waitBooks(w.cfg.assets.expedite.keptMinHistoryWeeks)}`;
    default:
      return `${base}. ${PENDING.waitFeeOnly(fdFull(p.feeFd))}${p.paymentsFd + p.lessorFd >= 0.5 ? ` ${verdict}` : ""}`;
  }
}

/**
 * The wait's parts for an order not yet placed (the Dealer's second button), as expediteWaitParts reads a placed one:
 * no loan yet, so no payments; the lessor's share for an order replacing the lease; and the kept term by the same rule.
 */
export function partsBeforeOrder(
  w: World,
  c: Company,
  o: { kind: "rig" | "tractor"; tier: TractorTier; trailer: Equipment; priceFd: number; dueDay: number; replaceNpcLease: boolean },
): ExpediteWaitParts | null {
  const q = quoteFor(w, { kind: o.kind, tier: o.tier, trailer: o.trailer, priceFd: o.priceFd, dueDay: o.dueDay });
  if ("why" in q) return null;
  const k = w.cfg.assets.expedite;
  const weeks = q.daysSaved / 7;
  const fleet = w.trucksByCompany.get(c.id) ?? [];
  const leased = fleet.filter((t) => t.lease === "npc").length;
  const lessor = o.replaceNpcLease && leased > 0 ? w.cfg.costs.npcLeaseShareOfGross * weeklyGrossFd(w, c) * (leased / fleet.length) * weeks : 0;
  const addsTruck = k.countsKeptPerTruck && !o.replaceNpcLease;
  const staff = staffsWhatItOwns(w, c);
  const kept = keptPerTruck(w, c);
  const keptCase = !addsTruck ? "notApplicable" : staff.emptyTruckNo !== null ? "emptyTruck" : !staff.staffed ? "noTruckSeated" : kept.weeks < k.keptMinHistoryWeeks ? "books" : "counts";
  return {
    readyDay: q.readyDay,
    daysSaved: q.daysSaved,
    feeFd: q.feeFd,
    paymentsFd: 0,
    lessorFd: lessor,
    addsTruck,
    driver: staff.staffed,
    keptCase,
    emptyTruckNo: keptCase === "emptyTruck" ? staff.emptyTruckNo : null,
    keptPerTruckWeekFd: kept.perWeekFd,
    keptWeeks: kept.weeks,
    keptFd: keptCase === "counts" ? kept.perWeekFd * weeks : 0,
  };
}
