import { reputationParts, threePartsOn, type Company, type World } from "@lanes/engine";
import { FIXES } from "./copy-fixes.js";
import { pct } from "./format.js";

/**
 * Reputation in three parts on the page (reputation.threeParts; the director's display, the writer's drafts in
 * writer-sprint-2026-11-15.md §1): the one-line form and the explain sheet's rows, from the engine's own parts.
 */
const BASIC_WORD: Record<string, string> = { hos: "hours of service", unsafe: "unsafe driving", maintenance: "vehicle maintenance", crash: "crashes" };

/** The safety record's words: the rating when it isn't satisfactory, an alert, the record's violations and crashes, or clean. */
export function safetyWords(c: Company): string {
  const s = c.safety;
  if (s.rating === "unsatisfactory" || s.rating === "conditional") return FIXES.repRated(s.rating);
  if (s.alerts.length > 0) return FIXES.repAlert(BASIC_WORD[s.alerts[0]!] ?? s.alerts[0]!);
  const crashes = s.crashes.filter((x) => x.atFault).length;
  return s.violations.length + crashes > 0 ? FIXES.repRecord(s.violations.length, crashes) : FIXES.repSafetyClean;
}

/** The one-line form, or null with three parts off: "Reputation 91%: safety record clean · 2 releases in 90 days · 46 loads delivered". */
export function reputationLine(w: World, c: Company): string | null {
  if (!threePartsOn(w)) return null;
  const p = reputationParts(w, c);
  const k = w.cfg.reputation.threeParts;
  return FIXES.repLine(pct(c.reputation), safetyWords(c), FIXES.repService(p.failures.late, p.failures.release, p.failures.noShow, p.failures.claim, k.displayDays), FIXES.repExperience(Math.round(p.loads), k.experienceCap));
}

/** The explain sheet's rows: each part's words and what it takes off, of the score's 1. */
export function reputationRows(w: World, c: Company): { label: string; value: string }[] {
  const p = reputationParts(w, c);
  const k = w.cfg.reputation.threeParts;
  const off = (x: number) => (x > 0.0005 ? `−${pct(x)}` : "0");
  return [
    { label: FIXES.repPartSafety(safetyWords(c)), value: off(k.safety * p.s) },
    { label: FIXES.repPartService(FIXES.repService(p.failures.late, p.failures.release, p.failures.noShow, p.failures.claim, k.displayDays)), value: off(k.service * p.f) },
    { label: FIXES.repPartExperience(FIXES.repExperience(Math.round(p.loads), k.experienceCap)), value: off(k.experience * p.e) },
  ];
}
