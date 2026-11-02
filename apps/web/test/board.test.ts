import { describe, expect, it } from "vitest";
import { dispatchProfile, operatingTrucks, placeMiles, placeToll } from "@lanes/engine";
import { bidRange, boardRows, clearsNear, posterOf, sortRows, suggestBid } from "../src/board.js";
import { intelRows } from "../src/intel.js";
import { trueBreakEven } from "../src/breakeven.js";
import { TestGame } from "../src/game.js";

async function world() {
  const g = await TestGame.create();
  const c = g.join("Board Freight", "oo", "LAX")!;
  const truck = g.w.trucksByCompany.get(c.id)![0]!;
  return { g, c, truck };
}

describe("the board", () => {
  it("prices every card on the one break-even, and the chip is profit at book-now and at the suggested bid", async () => {
    const { g, c, truck } = await world();
    const rows = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" });
    expect(rows.length).toBeGreaterThan(0);
    const prof = dispatchProfile(g.w, c, operatingTrucks(g.w, c.id));
    for (const r of rows.slice(0, 10)) {
      const be = trueBreakEven(g.w, truck, r.l, placeMiles(g.w, truck.place, r.l.originPlace), placeToll(g.w, truck.place, r.l.originPlace), prof.foresightDays, prof.reloadWeight);
      expect(r.be).toBeCloseTo(be, 9);
      expect(r.profitBook).toBeCloseTo((r.l.bookNow - be) * r.l.miles, 6);
      expect(r.suggest).toBe(suggestBid(r.l, be));
      const [lo, hi] = bidRange(g.w, r.l, be);
      expect(lo).toBeLessThanOrEqual(hi);
    }
  }, 60_000);

  it("never prints a clearing rate or offers a bid above the load's own ceiling (market truth)", async () => {
    const { g, c, truck } = await world();
    const rows = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" });
    for (const r of rows) {
      expect(clearsNear(r.l)).toBeLessThanOrEqual(r.l.ceiling);
      const [lo, hi] = bidRange(g.w, r.l, r.be);
      expect(hi).toBe(r.l.ceiling);
      expect(lo).toBeLessThanOrEqual(hi);
      expect(r.suggest).toBeLessThanOrEqual(Math.max(r.l.ceiling, r.l.bookNow + 0.05));
    }
  }, 60_000);

  it("filters to one poster's loads (Intel's 'Their loads on the board'), and Intel lists a company joined this hour", async () => {
    const g = await TestGame.create();
    const before = intelRows(g.w).length;
    const c = g.join("Poster Freight", "oo", "LAX")!;
    // The rows cache keys on the company count too, so the new company is listed within the same game hour.
    expect(intelRows(g.w).length).toBe(before + 1);
    expect(intelRows(g.w).some((r) => r.c === c)).toBe(true);
    const truck = g.w.trucksByCompany.get(c.id)![0]!;
    const all = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" });
    const poster = all.map((r) => posterOf(r.l)).find((p) => p !== null);
    if (poster) {
      const mine = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "", poster });
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((r) => posterOf(r.l) === poster)).toBe(true);
    }
  }, 60_000);

  it("puts blocked loads last, and on a first visit the loads that pay at book-now first", async () => {
    const { g, c, truck } = await world();
    const rows = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" });
    const first = sortRows(rows, "nearest", true);
    const firstBlocked = first.findIndex((r) => r.block);
    if (firstBlocked >= 0) expect(first.slice(firstBlocked).every((r) => r.block)).toBe(true);
    const open = first.filter((r) => !r.block);
    const firstLoss = open.findIndex((r) => r.profitBook < 0);
    if (firstLoss >= 0) expect(open.slice(firstLoss).every((r) => r.profitBook < 0)).toBe(true);
    const later = sortRows(rows, "nearest", false).filter((r) => !r.block);
    for (let i = 1; i < later.length; i++) expect(later[i]!.dh).toBeGreaterThanOrEqual(later[i - 1]!.dh);
  }, 60_000);

  it("filters by destination, empty miles and commodity or place", async () => {
    const { g, c, truck } = await world();
    const all = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" });
    const dest = g.w.net.hubs[all[0]!.l.dest]!.id;
    expect(boardRows(g.w, c, truck, { dest, maxDh: 300, query: "" }).every((r) => g.w.net.hubs[r.l.dest]!.id === dest)).toBe(true);
    expect(boardRows(g.w, c, truck, { dest: "any", maxDh: 0, query: "" }).every((r) => r.dh === 0)).toBe(true);
    expect(boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "zzzz-nowhere" })).toHaveLength(0);
  }, 60_000);
});

describe("the walkthrough's first bid", () => {
  it("ticks step 2 on the player's own bid or booking, or, for a fleet whose dispatcher books from the start, on its first load", async () => {
    const { walkSteps } = await import("../src/walkthrough.js");
    const { GAME_CONFIG } = await import("../src/game.js");
    const g = await TestGame.create();
    // A small fleet's dispatcher runs from the start (the first bid by hand is a one-truck rule), so the step can't wait
    // for a bid by hand that may never come (QA's guidance replay): its first load ticks it.
    const c = g.join("Fleet Freight", "fleet", "DAL")!;
    const board = walkSteps(GAME_CONFIG).find((s) => s.id === "board")!;
    expect(board.done(g.w, c)).toBe(false);
    for (let h = 0; h < 24 * 4 && c.bidStats.wins === 0; h++) g.stepHour();
    expect(c.firstHandBidDay).toBeNull();
    expect(board.done(g.w, c)).toBe(c.bidStats.wins > 0 || c.delivered > 0);
    // A one-truck company still waits for the player's own bid or booking.
    const g1 = await TestGame.create();
    const solo = g1.join("Solo Freight", "oo", "DAL")!;
    for (let h = 0; h < 24; h++) g1.stepHour();
    expect(board.done(g1.w, solo)).toBe(false);
    const truck = g1.w.trucksByCompany.get(solo.id)!.find((t) => t.status === "idle");
    if (truck) {
      const row = boardRows(g1.w, solo, truck, { dest: "any", maxDh: 300, query: "" }).find((r) => !r.block);
      if (row && g1.act({ type: "book_load", truckId: truck.id, loadId: row.l.id }).ok) expect(board.done(g1.w, solo)).toBe(true);
    }
  }, 120_000);
});
