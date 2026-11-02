import { describe, expect, it } from "vitest";
import { TestGame } from "../src/game.js";
import { intelRows, ranked } from "../src/intel.js";

describe("Intel", () => {
  it("closes each month with last month's revenue, loads and on-time counts, read from the counters the rules keep", async () => {
    const g = await TestGame.create();
    const c = g.join("Intel Freight", "fleet", "DAL")!;
    const perMonth = g.w.cfg.time.daysPerMonth;
    // Run to the second month close after joining, so one whole month sits between two marks.
    const closes: number[] = [];
    let markAtFirst = { revenueFd: 0, delivered: 0, onTime: 0 };
    for (let h = 0; h < 24 * (2 * perMonth + 2) && closes.length < 2; h++) {
      const before = c.lastMonth?.closedDay;
      g.stepHour();
      if (c.lastMonth && c.lastMonth.closedDay !== before) {
        closes.push(c.lastMonth.closedDay);
        if (closes.length === 1) markAtFirst = { ...c.monthMark! };
      }
    }
    expect(closes.length).toBe(2);
    expect(closes[1]! - closes[0]!).toBe(perMonth);
    // The second record is exactly the month between the two marks.
    const lm = c.lastMonth!;
    expect(lm.revenueFd).toBeCloseTo(c.monthMark!.revenueFd - markAtFirst.revenueFd, 6);
    expect(lm.loads).toBe(c.monthMark!.delivered >= markAtFirst.delivered ? c.monthMark!.delivered - markAtFirst.delivered : c.monthMark!.delivered);
    expect(lm.loads).toBeGreaterThanOrEqual(0);
    expect(lm.onTime).toBeLessThanOrEqual(lm.loads);
    // Every company has its record, and the list ranks them all.
    expect(g.w.companies.every((x) => x.lastMonth !== undefined)).toBe(true);
    const rows = ranked(intelRows(g.w), "miles");
    expect(rows).toHaveLength(g.w.companies.length);
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.r.miles).toBeLessThanOrEqual(rows[i - 1]!.r.miles);
    // No row carries a cash figure (the director's row 1).
    expect(Object.keys(rows[0]!.r).sort()).toEqual(["broker", "c", "credit", "drivers", "facilities", "miles", "pastMiles", "player", "trailers", "trucks"]);
  }, 300_000);
});
