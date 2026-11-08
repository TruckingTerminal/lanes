import "./seed.js";
import { describe, expect, it } from "vitest";
import { companyAccount } from "@lanes/engine";
import { boardRows } from "../src/board.js";
import { closedMonths, EARNED, monthReport, MOVED, openMonth, SPENT } from "../src/books.js";
import { PLAYER_DISPATCHER_ORDERS, TestGame } from "../src/game.js";

/**
 * R10's month report (player2-ux.md section 4): "Why your cash moved differently" must add up to the figure. Two starts
 * run past their first month's close with the dispatcher on; each closed month's lines are summed from cash at the start
 * to cash at the close, and the catch-all lines stay small (a posting the books can't name is a line to add).
 */
describe("The month's books", () => {
  for (const start of ["oo", "fleet"] as const)
    it(`adds up to cash at the close, line by line (${start})`, async () => {
      const g = await TestGame.create();
      const c = g.join("Books Freight", start, "DAL")!;
      const truck = g.w.trucksByCompany.get(c.id)![0]!;
      // The first bid by hand, then the dispatcher on, so the month has loads, fuel, tolls and the lessor's share.
      const row = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" }).find((r) => !r.block);
      expect(g.act({ type: "book_load", truckId: truck.id, loadId: row!.l.id }).ok).toBe(true);
      expect(g.act({ type: "set_standing_orders", orders: PLAYER_DISPATCHER_ORDERS }).ok).toBe(true);
      const perDay = g.w.cfg.time.gameMinutesPerDay;
      const days = g.w.cfg.time.daysPerMonth + 2;
      const before = JSON.stringify(c.operating);
      for (let h = 0; h < days * 24 && closedMonths(g.w, c).length < 1; h++) g.stepHour();
      const months = closedMonths(g.w, c);
      expect(months.length).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(c.operating)).not.toBe(before);
      for (const m of months) {
        const r = monthReport(m);
        const lines = r.cashStart + r.keptFd - r.owedChange + r.payChange + r.moved.reduce((s, x) => s + x.fd, 0);
        expect(Math.abs(lines - r.cashEnd)).toBeLessThan(0.05);
        expect(Math.abs(r.keptFd - (r.earnedFd - r.spentFd))).toBeLessThan(0.01);
        // Every line the books know has a name; what they can't name stays a sliver of the month.
        for (const x of [...r.earned, ...r.spent, ...r.moved]) expect([...EARNED, ...SPENT, ...MOVED]).toContain(x.line);
        const other = Math.abs(r.earned.find((x) => x.line === "otherIn")?.fd ?? 0) + Math.abs(r.spent.find((x) => x.line === "otherOut")?.fd ?? 0);
        expect(other).toBeLessThanOrEqual(0.02 * (r.earnedFd + r.spentFd) + 1);
        expect(r.loads).toBeGreaterThan(0);
        expect(r.allMi).toBeGreaterThan(0);
        expect(r.loadedMi).toBeLessThanOrEqual(r.allMi);
      }
      // The owner's draw kept by the company (labor.owner.drawStays) is the month's own share of Company.ownerDrawFd.
      const drawn = months.reduce((s, m) => s + monthReport(m).drawFd, 0);
      expect(drawn).toBeLessThanOrEqual(c.ownerDrawFd + 0.01);
      if (g.w.cfg.labor.owner.drawStays && start === "oo") expect(monthReport(months[0]!).drawFd).toBeGreaterThan(0);
      // The close is the engine's (intel.ts), its cash the company's as the month closed, and the next month starts there.
      const newest = months[0]!;
      expect(newest.closedDay).toBe(c.lastMonth!.closedDay);
      expect(Math.floor(g.w.t / perDay)).toBeGreaterThanOrEqual(newest.closedDay);
      expect(openMonth(g.w, c)!.cashStart).toBeCloseTo(newest.cashEnd, 2);
      // Stepped on to the next hour, the month so far adds up to cash now.
      g.stepHour();
      const o = openMonth(g.w, c)!;
      const sum = o.cashStart + Object.values(o.flows).reduce((s, x) => s + (x ?? 0), 0);
      expect(sum).toBeCloseTo(g.w.ledger.balance(companyAccount(c.id)), 1);
    }, 300_000);
});
