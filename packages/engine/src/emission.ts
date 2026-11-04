import type { EconomyConfig } from "@lanes/config";
import type { World } from "./world.js";

/**
 * The emission cap (token.emission; economy-emission.md): NPC freight pays carriers out of a fixed, declining monthly
 * budget. Month m's budget is first × r^m with r = 1 − first ÷ (cap − genesis), so the schedule sums to the cap less
 * genesis. Every FD an NPC shipper or the NPC factor pays a company draws on it (ledger.npcPaidFd); what a month leaves
 * unspent rolls forward and what it overspends comes out of the next, so the cumulative pay never passes the schedule
 * for long. Daily, NPC pay per mile is scaled by remaining ÷ expected remaining spend, clamped, so rates ease down as a
 * month's budget runs low instead of stopping at a cliff. Bots price off it through the reference rate (freight.ts).
 */
export type EmissionConfig = EconomyConfig["token"]["emission"];

export function emissionRatio(k: EmissionConfig): number {
  return 1 - k.firstMonthFd / (k.capFd - k.genesisFd);
}

/** Month m's budget (m from 0). */
export function budgetFd(k: EmissionConfig, month: number): number {
  return k.firstMonthFd * emissionRatio(k) ** month;
}

/** The schedule's cumulative budget through month m (inclusive). */
export function cumulativeBudgetFd(k: EmissionConfig, month: number): number {
  const r = emissionRatio(k);
  return (k.firstMonthFd * (1 - r ** (month + 1))) / (1 - r);
}

/** remaining ÷ (month budget × days left ÷ days in month), clamped to the configured range. */
export function emissionMultiplier(k: EmissionConfig, remainingFd: number, monthBudgetFd: number, daysLeft: number, daysInMonth: number): number {
  const expected = (monthBudgetFd * daysLeft) / daysInMonth;
  const [lo, hi] = k.multRange;
  if (expected <= 0) return remainingFd > 0 ? hi : lo;
  return Math.min(hi, Math.max(lo, remainingFd / expected));
}

/** End of day: the multiplier for the day to come. */
export function dailyEmission(w: World, day: number): void {
  const k = w.cfg.token.emission;
  if (!k.enabled) return;
  const per = w.cfg.time.daysPerMonth;
  const next = day + 1;
  const month = Math.floor(next / per);
  const daysLeft = per - (next % per);
  const remaining = cumulativeBudgetFd(k, month) - w.ledger.npcPaidFd();
  w.stab.emissionMult = emissionMultiplier(k, remaining, budgetFd(k, month), daysLeft, per);
}
