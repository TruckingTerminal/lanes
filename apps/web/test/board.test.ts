import { describe, expect, it } from "vitest";
import { dispatchProfile, operatingTrucks, placeMiles, placeToll } from "@lanes/engine";
import { bidRange, boardRows, sortRows, suggestBid } from "../src/board.js";
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
  it("ticks step 2 on the player's own bid or booking, never on the dispatcher's win", async () => {
    const { walkSteps } = await import("../src/walkthrough.js");
    const { GAME_CONFIG } = await import("../src/game.js");
    const g = await TestGame.create();
    // A small fleet's dispatcher runs from the start (the first bid by hand is a one-truck rule).
    const c = g.join("Fleet Freight", "fleet", "DAL")!;
    const board = walkSteps(GAME_CONFIG).find((s) => s.id === "board")!;
    for (let h = 0; h < 24 * 4 && c.bidStats.wins === 0; h++) g.stepHour();
    expect(board.done(g.w, c)).toBe(c.firstHandBidDay !== null);
    expect(c.firstHandBidDay).toBeNull();
    const truck = g.w.trucksByCompany.get(c.id)!.find((t) => t.status === "idle");
    if (truck) {
      const row = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" }).find((r) => !r.block);
      if (row && g.act({ type: "book_load", truckId: truck.id, loadId: row.l.id }).ok) expect(board.done(g.w, c)).toBe(true);
    }
  }, 120_000);
});
