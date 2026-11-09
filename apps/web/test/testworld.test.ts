import "./seed.js";
import { describe, expect, it } from "vitest";
import { companyAccount } from "@lanes/engine";
import { RULESET, TestGame, WARM_HOURS, type TestLog } from "../src/game.js";

describe("the test world's warm start", () => {
  it("opens at 06:00 of day ten, past the cap's warm week, with no company until the hub is chosen", async () => {
    const g = await TestGame.create();
    expect(g.w.t).toBe(WARM_HOURS * 60);
    expect((g.w.t / 60) % 24).toBe(6);
    expect(g.player).toBeNull();
    expect(g.act({ type: "set_auto_staff", on: true }).ok).toBe(false);
  }, 60_000);

  it("joins at the minute the hub is chosen and replays the same world from its log", async () => {
    const g = await TestGame.create();
    // The clock may run while the player looks around before choosing.
    for (let h = 0; h < 3; h++) g.stepHour();
    const c = g.join("Warm Freight", "oo", "DAL")!;
    expect(g.log.warm).toBe(WARM_HOURS + 3);
    for (let h = 0; h < 12; h++) g.stepHour();
    const r = await TestGame.restore(JSON.parse(JSON.stringify(g.log)) as TestLog);
    expect(r.w.t).toBe(g.w.t);
    expect(r.player!.id).toBe(c.id);
    expect(r.w.ledger.balance(companyAccount(c.id))).toBe(g.w.ledger.balance(companyAccount(c.id)));
  }, 60_000);

  it("still restores a log from before the warm start, which joined at 0 and opened at 06:00", async () => {
    const log: TestLog = { v: 1, ruleset: RULESET, seed: 7, name: "Old Freight", start: "oo", hub: "DAL", t: 6 * 60, acts: [] };
    const r = await TestGame.restore(log);
    expect(r.w.t).toBe(6 * 60);
    expect(r.player!.name).toBe("Old Freight");
  }, 60_000);
});

describe("the hub card's season measure", () => {
  it("reads a warm world's starter hubs on the economy's scale, and the same twice in one minute", async () => {
    const { seasonMeasure, seasonLine } = await import("../src/hubcard.js");
    const g = await TestGame.create();
    for (const id of ["DAL", "LAX", "PHX"]) {
      const i = g.w.net.hubs.findIndex((h) => h.id === id);
      const x = seasonMeasure(g.w, i);
      expect(Number.isFinite(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(20);
      expect(seasonMeasure(g.w, i)).toBe(x);
      expect(seasonLine(g.w, i)).toMatch(/January/);
    }
  }, 60_000);
});

describe("the season line's rolling mean", () => {
  it("averages the last four rounds' readings for a hub", async () => {
    const { seasonMeasure, seasonReading } = await import("../src/hubcard.js");
    const g = await TestGame.create();
    const i = g.w.net.hubs.findIndex((h) => h.id === "LAX");
    const seen: number[] = [];
    for (let r = 0; r < 6; r++) {
      seen.push(seasonMeasure(g.w, i));
      const mean = seasonReading(g.w, i);
      const last = seen.slice(-4);
      expect(mean).toBeCloseTo(last.reduce((a, x) => a + x, 0) / last.length, 9);
      for (let h = 0; h < 12; h++) g.stepHour();
    }
  }, 120_000);
});

describe("the live rings", () => {
  it("falls back to Dallas, Los Angeles, Phoenix until the readings are in, then ranks the starters by the four-round mean", async () => {
    const { rankStarters, sampleStarters, seasonReading, starterHubs } = await import("../src/hubcard.js");
    const cold = await TestGame.create();
    const ids = (w: typeof cold.w, xs: number[]) => xs.map((i) => w.net.hubs[i]!.id);
    expect(ids(cold.w, rankStarters(cold.w).slice(0, 3))).toEqual(["DAL", "LAX", "PHX"]);
    const warm = await TestGame.create(undefined, (w) => {
      if (w.t % 720 === 360) sampleStarters(w);
    });
    const ranked = rankStarters(warm.w);
    expect(ranked).toHaveLength(starterHubs(warm.w).length);
    const scores = ranked.map((i) => seasonReading(warm.w, i));
    for (let k = 1; k < scores.length; k++) expect(scores[k]!).toBeLessThanOrEqual(scores[k - 1]! + 1e-12);
  }, 120_000);
});
