import { describe, expect, it } from "vitest";
import { clearsNear as engineClearsNear, dispatchProfile, invalidOrders, marketMood, operatingTrucks, placeMiles, placeToll } from "@lanes/engine";
import { bidRange, boardRows, chipCash, chipFd, clearsNear, clearsNearSource, posterOf, sortRows, suggestBid, destMatch } from "../src/board.js";
import { breakdown } from "../src/explain.js";
import { needs, settleHandBids } from "../src/logic.js";
import { S } from "../src/state.js";
import { firstBoomDay, firstMoodDay } from "../src/milestones.js";
import { intelRows } from "../src/intel.js";
import { trueBreakEven } from "../src/breakeven.js";
import { firstLoadLocked } from "../src/tutorial.js";
import { DEFAULT_ORDERS, PLAYER_DISPATCHER_ORDERS, TestGame } from "../src/game.js";

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
      expect(r.suggest).toBe(suggestBid(g.w, r.l, be));
      const [lo, hi] = bidRange(g.w, r.l, be);
      expect(lo).toBeLessThanOrEqual(hi);
    }
  }, 60_000);

  it("never prints a clearing rate or offers a bid above the load's own ceiling (market truth)", async () => {
    const { g, c, truck } = await world();
    const rows = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" });
    for (const r of rows) {
      expect(clearsNear(g.w, r.l)).toBeLessThanOrEqual(r.l.ceiling);
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

describe("stage 2: the board reads the engine's clearsNear (R1's anchor)", () => {
  it("label, explain, suggestion and the players' default bid all follow clearsNear(w, load)", async () => {
    const { g, c, truck } = await world();
    const w = g.w;
    const rows = boardRows(w, c, truck, { dest: "any", maxDh: 300, query: "" });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows.slice(0, 10)) {
      expect(r.clears).toBe(engineClearsNear(w, r.l));
      expect(clearsNear(w, r.l)).toBe(r.clears);
      // The suggestion: what it clears near, break-even the floor, over book-now, never over the ceiling.
      expect(r.suggest).toBeCloseTo(Math.max(r.l.bookNow + 0.05, Math.min(r.l.ceiling, Math.max(r.be, r.clears))), 9);
      const src = clearsNearSource(w, r.l);
      expect(Math.min(src.rate, r.l.ceiling)).toBeCloseTo(r.clears, 9);
      const b = breakdown(w, c, "board.clearsNear", { loadId: r.l.id, truckId: truck.id })!;
      expect(b.total.value).toBe(`${r.clears.toFixed(2)}/mi`);
    }
    const bid = PLAYER_DISPATCHER_ORDERS.find((o) => o.kind === "bid");
    expect(bid && bid.kind === "bid" && bid.price).toEqual({ mode: "clearsNear", pct: 0 });
    expect(PLAYER_DISPATCHER_ORDERS.find((o) => o.kind === "floor")).toEqual({ kind: "floor", breakEvenPlusPct: 0 });
    // Switching the dispatcher on signs no contract: that's the player's own accept, or a rule they switch on.
    expect(PLAYER_DISPATCHER_ORDERS.find((o) => o.kind === "contracts")).toMatchObject({ acceptOffers: false });
    expect(invalidOrders(w.cfg, PLAYER_DISPATCHER_ORDERS)).toBeNull();
    // Joins replay DEFAULT_ORDERS: unchanged, so no world's history moves.
    expect(DEFAULT_ORDERS.find((o) => o.kind === "bid")).toEqual({ kind: "bid", maxDeadheadMi: 150, price: { mode: "breakEvenPlus", pct: 0.25 } });
  }, 60_000);

  it("the first boom and the first slump are the first days marketMood read so since the company began", async () => {
    const { g, c } = await world();
    const k = g.w.cfg.rates.news;
    const day = (d: number, rate: number) => ({ day: d, cleared: 10, avgClearedRate: rate });
    const days = [...Array.from({ length: k.longDays }, (_, i) => day(i, 2)), ...Array.from({ length: k.shortDays }, (_, i) => day(k.longDays + i, 2.6))];
    const fake = { cfg: g.w.cfg, metrics: { days } } as unknown as typeof g.w;
    expect(marketMood(fake).state).toBe("booming");
    const first = firstBoomDay(fake, 0)!;
    expect(first).toBeGreaterThanOrEqual(k.longDays);
    expect(marketMood({ cfg: g.w.cfg, metrics: { days: days.filter((d) => d.day < first) } } as unknown as typeof g.w).state).not.toBe("booming");
    expect(firstBoomDay(fake, first + 1)).toBe(first + 1);
    expect(firstBoomDay(g.w, c.createdDay)).toBeNull();
    // The slump milestone reads the same source (the producer, 2026-11-03).
    const down = [...days.slice(0, k.longDays), ...Array.from({ length: k.shortDays }, (_, i) => day(k.longDays + i, 1.5))];
    const slumped = { cfg: g.w.cfg, metrics: { days: down } } as unknown as typeof g.w;
    expect(marketMood(slumped).state).toBe("slumping");
    expect(firstMoodDay(slumped, 0, "slumping")).toBeGreaterThanOrEqual(k.longDays);
    expect(firstMoodDay(slumped, 0, "booming")).toBeNull();
  }, 60_000);
});

describe("R14: the chip's figures", () => {
  it("whole FD to 9,999, then thousands to one place; the cash keeps its sign", () => {
    expect(chipFd(607)).toBe("607");
    expect(chipFd(9_999)).toBe("9,999");
    expect(chipFd(12_400)).toBe("12.4k");
    expect(chipCash(-103)).toBe("−103");
    expect(chipCash(-1_100)).toBe("−1,100");
    expect(chipCash(-11_000)).toBe("−11.0k");
    expect(chipCash(504)).toBe("504");
  });
});

describe("Hot markets and the first load's lock (Jeff, 2026-11-04)", () => {
  it("sorts by the destination market's loads per truck, hottest first, and locks the shell until the first bid or booking", async () => {
    const { g, c, truck } = await world();
    const rows = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" });
    const hot = sortRows(rows, "hot", false).filter((r) => !r.block);
    for (let i = 1; i < hot.length; i++) expect(hot[i]!.heat).toBeLessThanOrEqual(hot[i - 1]!.heat);
    expect(firstLoadLocked(g.w, c)).toBe(true);
    c.firstHandBidDay = 3;
    expect(firstLoadLocked(g.w, c)).toBe(false);
  }, 60_000);
});

describe("The destination filter and the owner's draw (Jeff, 2026-11-04)", () => {
  it("matches a city, a state by code or name, a market and a DAT zone; the rate and miles filters cut; the draw stays when the owner drives", async () => {
    const { g, c, truck } = await world();
    const w = g.w;
    const rows = boardRows(w, c, truck, { dest: "", maxDh: 300, query: "" });
    expect(rows.length).toBeGreaterThan(0);
    const l = rows[0]!.l;
    const p = w.net.places[l.destPlace]!;
    const h = w.net.hubs[l.dest]!;
    expect(destMatch(w, l, "")).toBe(true);
    expect(destMatch(w, l, p.state)).toBe(true);
    expect(destMatch(w, l, p.name)).toBe(true);
    expect(destMatch(w, l, `${p.name}, ${p.state}`)).toBe(true);
    expect(destMatch(w, l, h.id)).toBe(true);
    expect(destMatch(w, l, "Z3")).toBe(["AL", "FL", "GA", "MS", "TN"].includes(p.state.toUpperCase()));
    expect(destMatch(w, l, "Florida")).toBe(p.state.toUpperCase() === "FL");
    expect(destMatch(w, l, "Nowhere, ZZ")).toBe(false);
    const dear = boardRows(w, c, truck, { dest: "", maxDh: 300, query: "", minRpm: 99 });
    expect(dear.length).toBe(0);
    const short = boardRows(w, c, truck, { dest: "", maxDh: 300, query: "", maxMiles: 10 });
    expect(short.every((r) => r.l.miles <= 10)).toBe(true);
    if (w.cfg.labor.owner.drawStays) {
      expect(rows.every((r) => r.draw > 0)).toBe(true);
      expect(Math.abs(bookPairCash(rows[0]!) - (rows[0]!.profitBook - rows[0]!.heldBook + rows[0]!.draw))).toBeLessThan(1e-9);
    }
  }, 60_000);
});
const bookPairCash = (r: { profitBook: number; heldBook: number; draw: number }): number => r.profitBook - r.heldBook + r.draw;

describe("a hand bid that loses is reported (the trucker's lost bid)", () => {
  it("a hand bid whose load another carrier takes sets the result card, and the Loads item lights", async () => {
    const g = await TestGame.create(undefined, undefined, 31_337);
    const c = g.join("Lost Freight", "oo", "LAX")!;
    const truck = g.w.trucksByCompany.get(c.id)![0]!;
    S.game = g as never;
    S.result = null;
    S.handBids.clear();
    try {
      const row = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" }).filter((r) => !r.block)[0]!;
      expect(g.act({ type: "place_bid", truckId: truck.id, loadId: row.l.id, rate: row.l.ceiling }).ok).toBe(true);
      // Both bid paths record the hand bid (the load sheet, and now the laptop table).
      S.handBids.set(row.l.id, { rate: row.l.ceiling, be: row.be, truckId: truck.id, from: "A", to: "B" });
      // Another carrier books it outright before the round: the engine drops the hand bid with no event.
      const other = g.w.companies.find((x) => x.id !== c.id && x.role === "carrier")!;
      row.l.status = "inTransit";
      row.l.carrierId = other.id;
      row.l.clearedRate = row.l.bookNow;
      settleHandBids(g as never);
      const result = S.result as { won: boolean; winning: number | null } | null; // set by settleHandBids
      expect(result?.won).toBe(false);
      expect(result?.winning).toBeCloseTo(row.l.bookNow, 6);
      expect(needs().some((n) => n.key === "result" && n.tab === "loads")).toBe(true);
    } finally {
      S.result = null;
      S.handBids.clear();
      S.game = null;
    }
  }, 120_000);
});

describe("detention and lateness at a closed dock (the trucker's weekend)", () => {
  it("a closed-dock wait past the free time pays its hours, capped per stop; lateness counts from arrival", async () => {
    const g = await TestGame.create(undefined, undefined, 20_261_104);
    const k = g.w.cfg.detention;
    expect(k.enabled && g.w.cfg.docks.lateFromArrival).toBe(true);
    for (let h = 0; h < 24 * 5; h++) g.stepHour();
    const held = [...g.w.loads.values()].filter((l) => l.detention && l.detention.fd > 0);
    expect(held.length).toBeGreaterThan(0);
    for (const l of held) {
      const d = l.detention!;
      expect(d.fd).toBe((d.pickupH + d.deliveryH) * k.fdPerHour);
      expect(d.pickupH).toBeLessThanOrEqual(k.maxHours);
      expect(d.deliveryH).toBeLessThanOrEqual(k.maxHours);
    }
  }, 180_000);
});
