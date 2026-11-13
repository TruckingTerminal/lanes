import "./seed.js";
import { describe, expect, it } from "vitest";
import { companyAccount, placeLegMiles, placeOfHub, settlementShare, type Load } from "@lanes/engine";
import { boardRows, chipPair, profitOver } from "../src/board.js";
import { exitsFor } from "../src/exits.js";
import { cashDipAhead } from "../src/figures.js";
import { TestGame } from "../src/game.js";
import { hubFacts, moodLine, seasonLine } from "../src/hubcard.js";
import { nextAction } from "../src/nextstep.js";
import { emptyRun } from "../src/rolling.js";
import { KEPT_ACROSS_WORLDS, onWorldReset, PER_WORLD, resetWorldState, S } from "../src/state.js";
import { firstTruckAffordable, firstTruckOpen, tabOpen } from "../src/tabs.js";
import { stepKey, walkSteps } from "../src/walkthrough.js";
import { GAME_CONFIG } from "../src/game.js";

/** The five player diaries of 0.24.0 (play-2026-11-09-*.md) and the director's calls on them (DECISIONS.md 2026-11-09). */

describe("a replaced world starts clean (diaries item 1)", () => {
  it("resets every per-world field and hook, and every field of S is either one world's or kept", () => {
    const keys = Object.keys(S).sort();
    expect([...PER_WORLD, ...KEPT_ACROSS_WORLDS].sort()).toEqual(keys);
    expect(PER_WORLD.filter((k) => (KEPT_ACROSS_WORLDS as readonly string[]).includes(k))).toEqual([]);
    let hook = 0;
    onWorldReset(() => hook++);
    // The last world's pay card, lost bid, cashed invoice, badges and records.
    S.delivered = { from: "Reading", to: "Knoxville", lateH: 25, line: {} as never, paid: "", hiredDriver: "Adaeze Patel" };
    S.result = { won: false, from: "A", to: "B", rate: 2.87, winning: 2.47, be: 2.24, total: 0, seen: false };
    S.cashed = [{ id: 1 } as never];
    S.moneyDot = "invoice";
    S.handBids.set(9, { rate: 3, be: 2 });
    S.invoiceLanes.set(4, "Lake Elsinore → Great Falls");
    S.intel = { ...S.intel, q: "x", card: 3 };
    S.speed = 3;
    resetWorldState();
    expect(S.delivered).toBeNull();
    expect(S.result).toBeNull();
    expect(S.cashed).toEqual([]);
    expect(S.moneyDot).toBe(false);
    expect(S.handBids.size).toBe(0);
    expect(S.invoiceLanes.size).toBe(0);
    expect(S.intel.q).toBe("");
    expect(S.intel.card).toBeNull();
    expect(hook).toBe(1);
    // The page's own state stays.
    expect(S.speed).toBe(3);
    S.speed = 1;
  });
});

describe("the Dealer opens when the first truck is affordable (diaries item 2)", () => {
  it("opens the moment the gap closes whatever the step, a skipped step counts as passed, and once open it stays", async () => {
    const g = await TestGame.create();
    const c = g.join("Dealer Freight", "oo", "LAX")!;
    S.game = g;
    try {
      const w = g.w;
      // A newcomer at the start: the walkthrough is early and the gap is open, so the Dealer is the teaser.
      expect(firstTruckAffordable(w, c)).toBe(false);
      expect(firstTruckOpen(w, c)).toBe(false);
      expect(tabOpen("market", w, c)).toBe(false);
      // Skipping every step before the first-truck step: a skipped step never keeps a tab closed.
      const steps = walkSteps(GAME_CONFIG);
      const own = steps.findIndex((s) => s.id === "own");
      expect(firstTruckOpen(w, c, steps.slice(0, own).map((s) => s.id))).toBe(true);
      // As the skip marks read from the browser's record (walkthrough.ts skippedSteps).
      expect(stepKey(w, c, "skip:law")).toContain("|skip:law");
      // Cash enough for the truck, the step untouched: open, and Iuliia's "you can afford it now" with it.
      const bal = w.ledger.balance(companyAccount(c.id));
      w.ledger.post(w.t, "faucet:test", companyAccount(c.id), 400_000, "test");
      w.t += 1; // a new minute for the memo
      expect(firstTruckAffordable(w, c)).toBe(true);
      expect(tabOpen("market", w, c)).toBe(true);
      expect(tabOpen("finance", w, c)).toBe(true);
      await Promise.resolve();
      // The cash goes again: the tab stays open (no tab ever vanishes from More).
      w.ledger.post(w.t, companyAccount(c.id), "sink:test", w.ledger.balance(companyAccount(c.id)) - bal, "test");
      w.t += 1;
      expect(firstTruckAffordable(w, c)).toBe(false);
      expect(tabOpen("market", w, c)).toBe(true);
    } finally {
      S.game = null;
    }
  }, 60_000);
});

describe("a stranded truck's ways out (diaries item 3)", () => {
  it("What now? names the cheapest way out, never the step, when nothing in reach it may take pays", async () => {
    const g = await TestGame.create();
    const c = g.join("Stranded Freight", "oo", "LAX")!;
    const w = g.w;
    const truck = w.trucksByCompany.get(c.id)![0]!;
    // Every load in the truck's reach pays nothing.
    for (const r of boardRows(w, c, truck, { dest: "any", maxDh: 300, query: "" })) {
      const l: Load = r.l;
      l.bookNow = 0.05;
      l.ceiling = 0.05;
    }
    expect(boardRows(w, c, truck, { dest: "any", maxDh: 300, query: "" }).some((r) => !r.block && r.profitBook > 0)).toBe(false);
    const a = nextAction(GAME_CONFIG, w, c);
    expect(a).toMatchObject({ rule: 2, kind: "stranded", truckId: truck.id }); // client batch 8a: the director's tier 2
    const exits = exitsFor(w, c, truck);
    expect(exits.length).toBeGreaterThan(0);
    for (let i = 1; i < exits.length; i++) expect(exits[i]!.costFd).toBeGreaterThanOrEqual(exits[i - 1]!.costFd);
    for (const e of exits) if (!e.home) expect(e.pays).toBeGreaterThan(0);
    if (a.kind === "stranded") expect(a.exits.map((e) => e.hub)).toEqual(exits.slice(0, 2).map((e) => e.hub));
  }, 60_000);

  it("prices an empty run from the truck's own town, the miles the engine drives", async () => {
    const g = await TestGame.create();
    const c = g.join("Run Freight", "oo", "LAX")!;
    const w = g.w;
    const truck = w.trucksByCompany.get(c.id)![0]!;
    const to = w.net.hubs.findIndex((h) => h.id === "PHX");
    truck.place = w.net.places.findIndex((p, i) => i !== placeOfHub(truck.hub) && p.name !== w.net.hubs[truck.hub]!.name && placeLegMiles(w, i, placeOfHub(truck.hub)) < 80);
    expect(truck.place).toBeGreaterThanOrEqual(0);
    expect(emptyRun(w, truck, truck.hub, to).mi).toBe(Math.round(placeLegMiles(w, truck.place, placeOfHub(to))).toLocaleString("en-US"));
  }, 60_000);
});

describe("one cash figure (diaries item 5)", () => {
  it("the pair carries the owner's draw it counts in cash, as the pay card says it", async () => {
    const g = await TestGame.create();
    const c = g.join("Cash Freight", "oo", "LAX")!;
    const truck = g.w.trucksByCompany.get(c.id)![0]!;
    // The starter is leased: the lessor's share comes off the margin (client batch 8b item 52, board.ts profitOver), and the
    // settlement fee's share with it (on in the live levers since 0.25.0); the pair reads that profit.
    const profit = profitOver(g.w, truck, 3.0, 2.0, 1_000);
    expect(profit).toBeCloseTo(1_000 * (1 - g.w.cfg.costs.npcLeaseShareOfGross - settlementShare(g.w.cfg)), 6);
    const p = chipPair(g.w, truck, profit, 3_000, 250);
    expect(p.cash).toBeCloseTo(profit - p.held + 250, 6);
    expect(p.draw).toBe(250);
  }, 60_000);
});

describe("the net-30 warning (diaries item 7)", () => {
  it("says cash goes under zero before the invoices due land, and nothing without invoices", async () => {
    const g = await TestGame.create();
    const c = g.join("Net Freight", "fleet", "LAX")!;
    const w = g.w;
    const acct = companyAccount(c.id);
    const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
    w.ledger.post(w.t, acct, "sink:test", w.ledger.balance(acct) - 1_000, "test");
    expect(cashDipAhead(w, c)).toBeNull();
    w.receivables.push({ id: 999_201, payer: 0, faucet: "faucet:test", payeeId: c.id, amountFd: 60_000, dueDay: today + 24, holder: c.id } as never);
    const dip = cashDipAhead(w, c)!;
    expect(dip).not.toBeNull();
    expect(dip.day).toBeGreaterThan(today);
    expect(dip.day).toBeLessThan(dip.landsDay);
    expect(dip.landsDay).toBe(today + 24);
    expect(dip.lowFd).toBeGreaterThan(0);
  }, 60_000);
});

describe("the hub list says the country's mood once (diaries item 8)", () => {
  it("a row carries the hub's own line; the mood is apart", async () => {
    const g = await TestGame.create();
    const w = g.w;
    const hub = w.net.hubs.findIndex((h) => h.id === "DAL");
    const f = hubFacts(w, hub);
    // Client batch 6: the hub's own line leads, alone, and the country's stands apart on its own line.
    expect(f.season).toBe(seasonLine(w, hub));
    expect(f.country).toBe(moodLine(w));
  }, 60_000);
});
