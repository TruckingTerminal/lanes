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

/**
 * The explain sheet's rows: each part's words and what it takes off, in whole points that add up to the figure shown
 * (QA's 0.25.4 replay: a new company read Experience −6% over Reputation 95%, 0.945). The points are 100 less the
 * rounded reputation, shared out by the parts' exact sizes, the largest remainders first.
 */
export function reputationRows(w: World, c: Company): { label: string; value: string }[] {
  const p = reputationParts(w, c);
  const k = w.cfg.reputation.threeParts;
  const [s, f, e] = wholePoints([k.safety * p.s, k.service * p.f, k.experience * p.e], 100 - Math.round(c.reputation * 100));
  const off = (n: number) => (n > 0 ? `−${n}%` : "0");
  return [
    { label: FIXES.repPartSafety(safetyWords(c)), value: off(s!) },
    { label: FIXES.repPartService(FIXES.repService(p.failures.late, p.failures.release, p.failures.noShow, p.failures.claim, k.displayDays)), value: off(f!) },
    { label: FIXES.repPartExperience(FIXES.repExperience(Math.round(p.loads), k.experienceCap)), value: off(e!) },
  ];
}

/** `total` whole points shared by `parts` (shares of 1) in proportion, the largest remainders taking what's left. */
export function wholePoints(parts: number[], total: number): number[] {
  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total <= 0) return parts.map(() => 0);
  const exact = parts.map((x) => (x / sum) * total);
  const out = exact.map((x) => Math.floor(x));
  let left = total - out.reduce((a, b) => a + b, 0);
  for (const i of exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i).map((x) => x.i)) {
    if (left <= 0) break;
    out[i]!++;
    left--;
  }
  return out;
}

/** The sheet's words with three parts on (QA's 0.25.4 replay, fix soon 1), or undefined off: the sheet keeps today's. */
export function reputationExplain(w: World): { what: string; how: string; moves: string } | undefined {
  if (!threePartsOn(w)) return undefined;
  const k = w.cfg.reputation.threeParts;
  return FIXES.repExplain(pct(k.safety), pct(k.service), pct(k.experience), k.experienceCap);
}
