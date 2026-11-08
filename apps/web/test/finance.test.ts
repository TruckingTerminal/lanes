import "./seed.js";
import { describe, expect, it } from "vitest";
import { factoringRate } from "@lanes/engine";
import { TestGame } from "../src/game.js";
import { hasLeasedTrucks, loanRows, monthOfCosts, ownsATruck, rateLadder, rateToday } from "../src/finance.js";

describe("Finance's figures", () => {
  it("reads a new company as on the lessor's truck, with a month of costs, the contract's rate and a ladder to the cap", async () => {
    const g = await TestGame.create();
    const c = g.join("Finance Freight", "oo", "LAX")!;
    const before = JSON.stringify(c);
    expect(ownsATruck(g.w, c)).toBe(false);
    expect(hasLeasedTrucks(g.w, c)).toBe(true);
    expect(loanRows(g.w, c)).toEqual([]);
    const month = monthOfCosts(g.w, c);
    expect(month).toBeGreaterThan(5_000);
    expect(month).toBeLessThan(100_000);
    expect(rateToday(g.w, c)).toBeCloseTo(factoringRate(g.w, 1), 9);
    const ladder = rateLadder(g.w, 1);
    expect(ladder[0]).toEqual({ n: 1, rate: factoringRate(g.w, 1), you: true });
    expect(ladder.every((x) => x.n <= g.w.cfg.company.maxTrucks)).toBe(true);
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]!.rate).toBeLessThanOrEqual(ladder[i - 1]!.rate);
    // Read-only, like every screen.
    expect(JSON.stringify(c)).toBe(before);
  }, 60_000);

  it("stores the owner's look picked at first entry, and keeps the man's when none was picked", async () => {
    const g = await TestGame.create();
    const c = g.join("Look Freight", "oo", "LAX", "f")!;
    expect(g.w.staffByCompany.get(c.id)!.find((s) => s.owner)!.look).toBe("f");
    const h = await TestGame.create();
    const d = h.join("Plain Freight", "oo", "LAX")!;
    expect(h.w.staffByCompany.get(d.id)!.find((s) => s.owner)!.look).toBe("m");
  }, 120_000);
});
