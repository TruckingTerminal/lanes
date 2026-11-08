import "./seed.js";
import { describe, expect, it } from "vitest";
import { PLAYER_DISPATCHER_ORDERS, TestGame } from "../src/game.js";
import { intelRows, ranked } from "../src/intel.js";

describe("Intel", () => {
  it("closes each month with last month's revenue, loads and on-time counts, read from the counters the rules keep", async () => {
    // A fixed seed (TestGame.create picks a random one), so every run plays the same world (the flake QA's suite runs
    // hit, 2026-11-03). With the bump the dispatcher waits for the player: switch it on, as "Let the dispatcher bid" does.
    const g = await TestGame.create(undefined, undefined, 55_433);
    const c = g.join("Intel Freight", "fleet", "DAL")!;
    if (!c.orders.some((o) => o.kind === "bid")) expect(g.act({ type: "set_standing_orders", orders: [...PLAYER_DISPATCHER_ORDERS, ...c.orders] }).ok).toBe(true);
    // A fine kept outside operating costs inside the measured month (fraud.ts and safety.ts add to finesOffCostsFd; a
    // legal fleet under the bump draws none), so the fines term below is exercised every run.
    const FINE = 250;
    const perMonth = g.w.cfg.time.daysPerMonth;
    // Run to the second month close after joining, so one whole month sits between two marks.
    const closes: number[] = [];
    let markAtFirst: NonNullable<typeof c.monthMark> = { revenueFd: 0, delivered: 0, onTime: 0, costFd: 0, overheadFd: 0, finesFd: 0 };
    let firstRecord: typeof c.lastMonth;
    for (let h = 0; h < 24 * (2 * perMonth + 2) && closes.length < 2; h++) {
      const before = c.lastMonth?.closedDay;
      g.stepHour();
      if (c.lastMonth && c.lastMonth.closedDay !== before) {
        closes.push(c.lastMonth.closedDay);
        if (closes.length === 1) {
          markAtFirst = { ...c.monthMark! };
          firstRecord = { ...c.lastMonth };
          c.finesOffCostsFd = (c.finesOffCostsFd ?? 0) + FINE;
        }
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
    // What the month spent: operating costs, fleet overhead and fines kept outside costs between the marks. The first
    // record is kept whole.
    const fines = (c.monthMark!.finesFd ?? 0) - (markAtFirst.finesFd ?? 0);
    expect(fines).toBeCloseTo(FINE, 6);
    expect(lm.spentFd).toBeCloseTo(c.monthMark!.costFd - markAtFirst.costFd + (c.monthMark!.overheadFd - markAtFirst.overheadFd) + fines, 6);
    expect(c.firstMonth).toEqual(firstRecord);
    // Every company has its record, and the list ranks them all.
    expect(g.w.companies.every((x) => x.lastMonth !== undefined)).toBe(true);
    const rows = ranked(intelRows(g.w), "miles");
    expect(rows).toHaveLength(g.w.companies.length);
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.r.miles).toBeLessThanOrEqual(rows[i - 1]!.r.miles);
    // No row carries a cash figure (the director's row 1).
    expect(Object.keys(rows[0]!.r).sort()).toEqual(["broker", "c", "credit", "drivers", "facilities", "miles", "pastMiles", "player", "trailers", "trucks"]);
  }, 300_000);
});
