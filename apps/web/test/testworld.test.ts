import { describe, expect, it } from "vitest";
import { companyAccount } from "@lanes/engine";
import { RULESET, TestGame, WARM_HOURS, type TestLog } from "../src/game.js";

describe("the test world's warm start", () => {
  it("opens two game days in, at 06:00, with no company until the hub is chosen", async () => {
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
