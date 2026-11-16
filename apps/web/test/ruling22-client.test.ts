import "./seed.js";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dayOf } from "@lanes/engine";
import { FIXES } from "../src/copy-fixes.js";
import { TestGame } from "../src/game.js";
import { hubFacts, YOUNG_MARKET_DAYS, youngMarketLine, youngRatesLine } from "../src/hubcard.js";

/**
 * The director's ruling 22 (director-sprint-2026-11-15.md §22): a young market says so, by the world's age only: under the
 * country line on the hub list and a hub's page, and Iuliia's line on the loan and lease sheets under "Weekly payment".
 */
const src = (...p: string[]) => readFileSync(join(__dirname, "..", "src", ...p), "utf8");

describe("the young market's two lines (ruling 22)", () => {
  it("show from a test world's opening at day 10 until its day 42, by the world's age alone", async () => {
    const g = await TestGame.create();
    const w = g.w;
    const D = w.cfg.time.gameMinutesPerDay;
    expect(dayOf(w.t, w.cfg)).toBe(10); // the warm start: it opens at 06:00 of day 10
    expect(YOUNG_MARKET_DAYS).toBe(42);
    expect(youngMarketLine(w)).toBe(FIXES.youngMarket(10));
    expect(hubFacts(w, 0).young).toBe(FIXES.youngMarket(10));
    expect(youngRatesLine(w)).toBe(FIXES.iuliiaYoungRates);
    w.t = 41 * D + 23 * 60; // the last hour of day 41
    expect(youngMarketLine(w)).toBe(FIXES.youngMarket(41));
    w.t = 42 * D; // day 42, and so any world that opens past it (§23's day 45): never
    expect(youngMarketLine(w)).toBeNull();
    expect(hubFacts(w, 0).young).toBeNull();
    expect(youngRatesLine(w)).toBeNull();
    w.t = 45 * D + 6 * 60;
    expect(youngMarketLine(w)).toBeNull();
  }, 120_000);

  it("the director's example words, and no figure for how far rates fall", () => {
    expect(FIXES.youngMarket(12)).toBe("This market opened 12 days ago. Opening rates run high while trucks catch up with the freight, and they fall back over the first six weeks.");
    expect(FIXES.iuliiaYoungRates).toBe("Rates are still in the market's opening weeks, and they run high. Check this payment against lower ones.");
    expect(FIXES.youngMarket(12)).not.toMatch(/\d+%/);
  });

  it("where they show: under the country line on the hub list and the hub's page; under Weekly payment on the loan and lease sheets", () => {
    const choose = src("ui", "ChooseHub.tsx");
    expect(choose).toContain("{young ? <p class=\"muted small\">{young}</p> : null}");
    expect(choose.indexOf("{f.young ?")).toBeGreaterThan(choose.indexOf("{f.country ?"));
    const showroom = src("ui", "panels", "Showroom.tsx");
    expect(showroom.indexOf("{youngRatesLine(w) ?")).toBeGreaterThan(showroom.indexOf("[DEALER.weekly,"));
    expect(showroom.indexOf("{youngRatesLine(w) ?")).toBeLessThan(showroom.indexOf("{DEALER.missed(ef.missedToDefault)}"));
    expect(showroom).toContain("{offers.length && youngRatesLine(w) ?"); // the lease offers, once
    const finance = src("ui", "panels", "Finance.tsx");
    expect(finance.indexOf("{youngRatesLine(w) ?")).toBeGreaterThan(finance.indexOf("[FINANCE.borrowWeekly,"));
    expect(src("ui", "panels", "Dealer.tsx")).toContain("{youngRatesLine(w) ? <p class=\"small\">{youngRatesLine(w)}</p> : null}");
    // Not the ticker (Shell.tsx draws it).
    expect(src("ui", "Shell.tsx").includes("youngMarket")).toBe(false);
  });
});
