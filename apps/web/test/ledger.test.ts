import "./seed.js";
import { describe, expect, it } from "vitest";
import { boardRows } from "../src/board.js";
import { TestGame } from "../src/game.js";
import { invoices, milesOf, weekCosts } from "../src/ledger.js";

describe("Money as a ledger", () => {
  it("reads this week's costs and the open invoices without changing the world; a leased starter is paid on delivery", async () => {
    const g = await TestGame.create();
    const c = g.join("Ledger Freight", "oo", "DAL")!;
    const truck = g.w.trucksByCompany.get(c.id)![0]!;
    const before = JSON.stringify(c) + JSON.stringify(truck);
    const week = weekCosts(g.w, c);
    expect(JSON.stringify(c) + JSON.stringify(truck)).toBe(before);
    for (const v of Object.values(week)) expect(v).toBeGreaterThanOrEqual(0);
    // One leased truck: the lessor's policy covers it and there is no yard past the first truck.
    expect(week.insurance).toBe(0);
    expect(week.yard).toBe(0);
    expect(invoices(g.w, c)).toHaveLength(0);
    const row = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" }).find((r) => !r.block);
    expect(g.act({ type: "book_load", truckId: truck.id, loadId: row!.l.id }).ok).toBe(true);
    for (let h = 0; h < 24 * 8 && c.delivered === 0; h++) g.stepHour();
    expect(c.delivered).toBe(1);
    // A leased truck's loads are paid on delivery (token.payment.lessorPaysOnDelivery): the lessor holds the paper, so the
    // starter has nothing owed; only invoices the company itself holds are listed.
    const open = invoices(g.w, c);
    expect(open.every((r) => g.w.receivables.find((x) => x.id === r.id)!.holder === c.id)).toBe(true);
    if (g.w.cfg.token.payment.enabled && g.w.cfg.token.payment.lessorPaysOnDelivery) expect(open).toHaveLength(0);
    expect(milesOf(c)).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
