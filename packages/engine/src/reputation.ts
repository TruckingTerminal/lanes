import { dpow } from "@lanes/data";
import { dayOf } from "./clock.js";
import type { Company, Load } from "./types.js";
import type { World } from "./world.js";

/**
 * Reputation in three parts (reputation.threeParts; the director's ruling of 2026-11-14, director-reputation; the
 * economy's sizes, economy-reputation-2026-11-15.md; the red team's R1–R3). Off, nothing here runs and the on-time
 * formula sets reputation as before, byte for byte.
 *
 * Reputation = 1 − safety × s − service × f − experience × e, each part from 0 (clean) to 1 (at its worst):
 * - s, the safety record: the CSA-style measures the weekly safety pass leaves (violation points per inspection, and
 *   crashes per truck), floored by a conditional rating, an open alert and an unsatisfactory one; for a year after a
 *   refile, at least what it read before (R3);
 * - f, service failures: no-shows, releases, deliveries past "Deliver by" and cargo claims, against loads delivered,
 *   both decayed (serviceHalfLifeDays), over the newcomer prior; kept through a bankruptcy and a refile (R2);
 * - e, experience: loads delivered for an NPC payer, each by its miles as standing counts them, decayed
 *   (experienceHalfLifeDays) toward a cap; the company's own freight never counts (R1). A new company starts at e = 1.
 *
 * The counters are kept decayed to `day` and aged on read, so a part fades between events; reputation is set at each
 * delivery and failure, and weekly after the safety pass. No draws.
 */
export const threePartsOn = (w: World): boolean => w.cfg.reputation.threeParts?.enabled === true;
/** The dated failures are kept with three parts on, and for the logbook's service milestones (logbook.ts, the red team's L3). */
export const failureLogOn = (w: World): boolean => threePartsOn(w) || w.cfg.token.airdrop.logbook.serviceMilestones === true;

type FailureKind = "late" | "release" | "noShow" | "claim";
type Rep3 = NonNullable<Company["rep3"]>;

const LOG_DAYS = 120; // the display's 90 days and the logbook's quarter

function rep3(c: Company, day: number): Rep3 {
  return (c.rep3 ??= { day, x: 0, l: 0, f: 0, log: [] });
}

/** The counters aged to `day`: x (experience), l (loads, for service) and f (failures), each by its half-life. */
function aged(w: World, r: Rep3, day: number): { x: number; l: number; f: number } {
  const k = w.cfg.reputation.threeParts;
  const dt = Math.max(0, day - r.day);
  if (dt === 0) return { x: r.x, l: r.l, f: r.f };
  const sv = dpow(0.5, dt / k.serviceHalfLifeDays);
  return { x: r.x * dpow(0.5, dt / k.experienceHalfLifeDays), l: r.l * sv, f: r.f * sv };
}
function age(w: World, r: Rep3, day: number): void {
  const a = aged(w, r, day);
  r.x = a.x;
  r.l = a.l;
  r.f = a.f;
  r.day = day;
  while (r.log.length > 0 && r.log[0]!.day <= day - LOG_DAYS) r.log.shift();
}

/** The safety part, s, from the record as the weekly pass left it. */
export function safetyPart(w: World, c: Company): number {
  const k = w.cfg.reputation.threeParts;
  const m = c.safety.measures;
  let s = Math.min(1, (m.hos + m.unsafe + m.maintenance) / k.safetyPoints + m.crash / k.crashPoints);
  if (c.safety.rating === "conditional") s = Math.max(s, k.floors.conditional);
  if (c.safety.alerts.length > 0) s = Math.max(s, k.floors.alert);
  if (c.safety.rating === "unsatisfactory") s = 1;
  // R3: for a year after a refile, the new authority's clean record reads no better than the old one did.
  const r = c.rep3;
  if (r?.priorS !== undefined && r.priorUntil !== undefined && dayOf(w.t, w.cfg) < r.priorUntil) s = Math.max(s, r.priorS);
  return s;
}

/** The three parts and their figures, for the reputation and the page's line. */
export function reputationParts(w: World, c: Company): { s: number; f: number; e: number; loads: number; failures: Record<FailureKind, number>; reputation: number } {
  const k = w.cfg.reputation.threeParts;
  const day = dayOf(w.t, w.cfg);
  const r = c.rep3;
  const a = r ? aged(w, r, day) : { x: 0, l: 0, f: 0 };
  const s = safetyPart(w, c);
  const f = Math.min(1, a.f / (a.l + w.cfg.reputation.priorLoads) / k.serviceWorstShare);
  const e = 1 - Math.min(1, a.x / k.experienceCap);
  const failures: Record<FailureKind, number> = { late: 0, release: 0, noShow: 0, claim: 0 };
  for (const x of r?.log ?? []) if (x.day > day - k.displayDays) failures[x.kind]++;
  return { s, f, e, loads: a.x, failures, reputation: 1 - k.safety * s - k.service * f - k.experience * e };
}

/** Sets the company's reputation from its three parts. */
export function setThreeParts(w: World, c: Company): void {
  c.reputation = reputationParts(w, c).reputation;
}

/**
 * trips.ts deliver: a load delivered, `late` past its "Deliver by", `claimed` with a cargo claim (spoiled or damaged).
 * Experience counts it by its miles when an NPC pays for it (never the company's own freight, nor a player shipper's:
 * R1); service counts it whole, and each failure on it once.
 */
export function repDelivered(w: World, c: Company, load: Load, late: boolean, claimed: boolean): void {
  const day = dayOf(w.t, w.cfg);
  const log = failureLogOn(w);
  if (!threePartsOn(w) && !log) return;
  const r = rep3(c, day);
  age(w, r, day);
  if (threePartsOn(w)) {
    if (load.shipperId === null) r.x += Math.min(1, load.miles / w.cfg.reputation.threeParts.fullLoadMi);
    r.l += 1;
    r.f += (late ? 1 : 0) + (claimed ? 1 : 0);
  }
  if (late) r.log.push({ day, kind: "late" });
  if (claimed) r.log.push({ day, kind: "claim" });
  if (threePartsOn(w)) setThreeParts(w, c);
}

/** windows.ts markFailed (a no-show, a release) and fraud.ts's theft (a cargo claim): a service failure, dated. */
export function repFailed(w: World, c: Company, kind: FailureKind): void {
  if (!failureLogOn(w)) return;
  const day = dayOf(w.t, w.cfg);
  const r = rep3(c, day);
  age(w, r, day);
  if (threePartsOn(w)) r.f += 1;
  r.log.push({ day, kind });
  if (threePartsOn(w)) setThreeParts(w, c);
}

/** The dated failures since `fromDay` (the logbook's service milestones), by kind. */
export function failuresSince(c: Company, fromDay: number): number {
  return (c.rep3?.log ?? []).filter((x) => x.day > fromDay).length;
}

/**
 * solvency.ts restart (a bankruptcy's fresh start): experience starts over, service failures are kept for their
 * window (R2). refile (new authority after a revocation): the old safety part is kept for refileLookbackDays (R3).
 */
export function repRestart(w: World, c: Company): void {
  if (!threePartsOn(w)) return;
  const day = dayOf(w.t, w.cfg);
  const r = rep3(c, day);
  age(w, r, day);
  r.x = 0;
  setThreeParts(w, c);
}
export function repRefile(w: World, c: Company, priorS: number): void {
  if (!threePartsOn(w)) return;
  const day = dayOf(w.t, w.cfg);
  const r = rep3(c, day);
  age(w, r, day);
  r.priorS = Math.max(r.priorS !== undefined && r.priorUntil !== undefined && day < r.priorUntil ? r.priorS : 0, priorS);
  r.priorUntil = day + w.cfg.reputation.threeParts.refileLookbackDays;
}
