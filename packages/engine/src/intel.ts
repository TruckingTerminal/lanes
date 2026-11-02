import { dayOf } from "./clock.js";
import type { World } from "./world.js";

/**
 * The month-close record per company (the director's Intel page, rows 5 and 6): last month's revenue, loads delivered
 * and loads on time, a month behind and never live (Jeff: live cash stays private; financials show a month behind).
 * Read from the counters the rules already keep (operating revenue, delivered, on time), so no rule reads or changes
 * anything here: it is state for the screens, taken at the month close.
 */
export function monthlyIntel(w: World): void {
  const day = dayOf(w.t, w.cfg);
  for (const c of w.companies) {
    const m = c.monthMark ?? { revenueFd: 0, delivered: 0, onTime: 0 };
    // A bankruptcy's fresh start zeroes the record mid-month (solvency.ts): a counter below its mark counts from zero.
    const since = (now: number, mark: number) => (now >= mark ? now - mark : now);
    c.lastMonth = { revenueFd: c.operating.revenueFd - m.revenueFd, loads: since(c.delivered, m.delivered), onTime: since(c.onTime, m.onTime), closedDay: day };
    c.monthMark = { revenueFd: c.operating.revenueFd, delivered: c.delivered, onTime: c.onTime };
  }
}
