import type { Equipment } from "@lanes/config";
import { creditBand, creditScore, operatingTrucks, purchaseTerms, ratingLabel, vettingBlock, type Company, type Load, type World } from "@lanes/engine";
import { isHuman } from "./game.js";

/**
 * Intel's figures (specs/intel.md, specs/intel-ux.md): every company's size and standing, as counts, bands, Miles and
 * last month's record. Row 1 of the director's page governs every field here: nothing from which live cash can be
 * derived, so no cash, worth, balance, stake amount, loan or debt is ever read into a row.
 */

export interface IntelRow {
  c: Company;
  player: boolean;
  broker: boolean;
  trucks: number;
  trailers: Record<Equipment, number>;
  drivers: number;
  facilities: Record<string, number>;
  /** Miles this season (the standing measure), and past seasons. */
  miles: number;
  pastMiles: number[];
  credit: string;
}

/** Insurance bands from the at-fault surcharge (insurance.ts): clean at none, heavily surcharged from this. The economy's cut-off to set; a client constant until it does. */
export const HEAVY_SURCHARGE = 0.5;
export type InsuranceBand = "clean" | "surcharged" | "heavy";
export const insuranceBand = (c: Company): InsuranceBand => (c.safety.insuranceSurcharge <= 1e-9 ? "clean" : c.safety.insuranceSurcharge < HEAVY_SURCHARGE ? "surcharged" : "heavy");

/** The safety band: the engine's own rating, and the names of any BASIC alerts. Never the hidden (undetected) record. */
export const safetyBand = (c: Company): { rating: string; alerts: string[] } => ({ rating: ratingLabel(c), alerts: [...c.safety.alerts] });

const cache = new WeakMap<World, { t: number; n: number; rows: IntelRow[] }>();

/**
 * Every company's row, built in one pass over trailers, facilities, businesses and staff; cached for the game hour and
 * the company count, so a company created or joined this hour shows at once (QA's Intel replay: the new player's own row).
 */
export function intelRows(w: World): IntelRow[] {
  const hit = cache.get(w);
  const hour = Math.floor(w.t / 60);
  if (hit && hit.t === hour && hit.n === w.companies.length) return hit.rows;
  const zero = (): Record<Equipment, number> => ({ van: 0, reefer: 0, flatbed: 0 });
  const trailers = new Map<number, Record<Equipment, number>>();
  const add = (id: number, eq: Equipment) => {
    let r = trailers.get(id);
    if (!r) trailers.set(id, (r = zero()));
    r[eq]++;
  };
  if (w.cfg.assets.enabled) {
    for (const t of w.trailers) if (t.companyId > 0 && t.status !== "gone") add(t.companyId, t.type);
  } else {
    // Assets off: each truck pulls its own trailer, so the trailers are the trucks' (the lessor's on a lease).
    for (const t of w.trucks) if (t.status !== "retired") add(t.companyId, t.trailer);
  }
  const facilities = new Map<number, Record<string, number>>();
  const addFac = (id: number, kind: string) => {
    if (!id) return;
    let r = facilities.get(id);
    if (!r) facilities.set(id, (r = {}));
    r[kind] = (r[kind] ?? 0) + 1;
  };
  for (const f of w.facilities) addFac(f.ownerId, f.type);
  for (const b of w.businesses) addFac(b.ownerId, b.kind);
  const rows = w.companies.map((c) => ({
    c,
    player: isHuman(c),
    broker: c.role === "broker",
    trucks: operatingTrucks(w, c.id),
    trailers: trailers.get(c.id) ?? zero(),
    drivers: (w.staffByCompany.get(c.id) ?? []).filter((s) => s.kind === "driver" && s.status === "employed").length,
    facilities: facilities.get(c.id) ?? {},
    miles: c.milesTotal,
    pastMiles: c.milesHistory,
    credit: creditBand(creditScore(w, c)),
  }));
  cache.set(w, { t: hour, n: w.companies.length, rows });
  return rows;
}

export type IntelSort = "miles" | "trucks" | "month";
/** Rank by the sort, descending; ties share a rank. */
/** What a company kept in its last closed month (revenue less spending); 0 before its first close. */
export const monthKept = (c: Company): number => (c.lastMonth ? c.lastMonth.revenueFd - c.lastMonth.spentFd : 0);

export function ranked(rows: IntelRow[], sort: IntelSort): { r: IntelRow; rank: number }[] {
  // Client batch 8b item 33: the month's ranking by what each kept in its last closed month (revenue less spending).
  const key = (r: IntelRow) => (sort === "miles" ? r.miles : sort === "trucks" ? r.trucks : monthKept(r.c));
  const sorted = [...rows].sort((a, b) => key(b) - key(a) || a.c.id - b.c.id);
  let rank = 0;
  let prev = NaN;
  return sorted.map((r, i) => {
    const k = key(r);
    if (k !== prev) (rank = i + 1), (prev = k);
    return { r, rank };
  });
}

/** Past seasons with the company's rank among every company in each. */
export function pastSeasons(w: World, c: Company): { season: number; miles: number; rank: number }[] {
  return c.milesHistory.map((miles, i) => ({ season: i + 1, miles, rank: 1 + w.companies.filter((x) => (x.milesHistory[i] ?? 0) > miles).length }));
}

/** The owner's own lines under each band (specs/intel-ux.md, Your own card), computed from the rules. */
export function ownCosts(w: World, c: Company): { credit: { down: number; weeklyRate: number; maxLoans: number }; vetting: { tier: "standard" | "strict"; reason: string } | null; premiumOver: number } {
  const probe = (vet: 1 | 2) => vettingBlock(w, c, { vet } as Load);
  const standard = probe(1);
  const strict = probe(2);
  const vetting = standard ? { tier: "standard" as const, reason: standard } : strict ? { tier: "strict" as const, reason: strict } : null;
  const ins = w.cfg.insurance;
  const s = c.safety;
  const premiumOver = (ins.rating[s.rating] / ins.rating.satisfactory) * (1 + ins.perAlert * s.alerts.length) * (1 + s.insuranceSurcharge) - 1;
  const t = purchaseTerms(w, c);
  return { credit: { down: t.downShare, weeklyRate: t.weeklyRate, maxLoans: t.maxLoans }, vetting, premiumOver };
}
