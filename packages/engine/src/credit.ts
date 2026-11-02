/**
 * Credit ratings (Jeff, 2026-10-29): a score the game computes from the ledger, the way a credit
 * bureau does; nobody sets it. It is built from the payment record (invoices paid with cash in hand
 * against invoices paid from an overdraft or never), unpaid claims on record, bankruptcies and
 * revocations, the licence's age, and stake plus cash against what is owed on open invoices.
 * Carriers' dispatchers refuse paper below their floor and ask a premium on weak paper, the surety
 * prices the bond by it, the factoring pool prices a player's paper by it, and NPC shippers tender to
 * brokers in credit order. Scores are cached per board round: they move with the day's facts, not
 * within a round.
 */
import { dayOf } from "./clock.js";
import { clamp } from "./economics.js";
import { companyAccount } from "./ledger.js";
import { reserveHeldFd } from "./cashReserve.js";
import type { Company } from "./types.js";
import type { World } from "./world.js";

const cache = new WeakMap<World, { round: number; day: number; scores: Map<number, number>; owed: Map<number, number> }>();

function roundCache(w: World) {
  const day = dayOf(w.t, w.cfg);
  let c = cache.get(w);
  if (!c || c.round !== w.round || c.day !== day) {
    const owed = new Map<number, number>();
    for (const r of w.receivables) if (r.payer !== 0) owed.set(r.payer, (owed.get(r.payer) ?? 0) + r.amountFd);
    c = { round: w.round, day, scores: new Map(), owed };
    cache.set(w, c);
  }
  return c;
}

/** The company's credit score, 0–100. */
export function creditScore(w: World, c: Company): number {
  const rc = roundCache(w);
  const hit = rc.scores.get(c.id);
  if (hit !== undefined) return hit;
  const k = w.cfg.token.credit;
  const today = rc.day;
  const paid = c.credit.onTimeFd + c.credit.lateFd;
  const record = paid > 0 ? c.credit.onTimeFd / paid : k.newRecord;
  let score = k.base + k.recordPoints * record;
  score += k.agePoints * clamp((today - c.authority.since) / (k.ageYears * w.cfg.time.daysPerSeason), 0, 1);
  score -= k.claimPoints * c.claims.filter((x) => x.until > today).length;
  score -= k.bankruptcyPoints * c.bankruptcies;
  score -= k.revocationPoints * c.authority.revocations;
  const owed = rc.owed.get(c.id) ?? 0;
  // The Reserve (cashReserve.ts) counts as capital beside cash.
  const reserve = w.cfg.cashReserve.enabled ? reserveHeldFd(w, c.id) : 0;
  if (owed > 0 && (c.stakedFd + Math.max(0, w.ledger.balance(companyAccount(c.id))) + reserve) / owed < k.coverageMin) score -= k.coveragePoints;
  const s = clamp(score, 0, 100);
  rc.scores.set(c.id, s);
  return s;
}

export function creditBand(score: number): "A" | "B" | "C" | "D" | "E" {
  return score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "E";
}

/** What weak paper costs over strong: nothing at the strong line, rising to premiumMax at zero credit. */
export function creditPremium(w: World, score: number): number {
  const k = w.cfg.token.credit;
  return k.premiumMax * clamp((k.strongScore - score) / k.strongScore, 0, 1);
}

/** The premium a carrier asks on a load, by its broker's credit (none on NPC freight). */
export function loadCreditPremium(w: World, brokerId: number | null): number {
  if (brokerId === null) return 0;
  return creditPremium(w, creditScore(w, w.companies[brokerId - 1]!));
}

/** A payment went on the record: with cash in hand, or from an overdraft (late), or never. */
export function recordPayment(c: Company, amountFd: number, late: boolean): void {
  if (late) c.credit.lateFd += amountFd;
  else c.credit.onTimeFd += amountFd;
}
