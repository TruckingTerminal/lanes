import { describe, expect, it } from "vitest";
import { fuzzSeed } from "../src/redteam/fuzz.js";
import { liveConfig } from "../src/redteam/harness.js";

// The red team's fuzz seeds (studio/reviews/redteam-2026-11-03.md, section 2), replayed past the days they broke on.
describe("the red team's fuzz seeds (2026-11-03): the two breaks stay fixed", () => {
  it("E2-EXIT, live seed 5: the unstake queue's escrow never goes negative (it broke on day 76)", () => {
    const res = fuzzSeed(5, 80, { cfg: liveConfig(), seasons: true }, 50);
    expect(res.violations).toEqual([]);
    expect(res.replayMatch).toBe(true);
  }, 600_000);

  it("E3-LOCK, launch seed 2: no account's spend-only FD ever stands above its balance (it broke on day 35)", () => {
    const res = fuzzSeed(2, 40, { cfg: liveConfig({ "token.betaYears": 0 }), seasons: true }, 50);
    expect(res.violations).toEqual([]);
    expect(res.replayMatch).toBe(true);
  }, 600_000);
});

// Pass 2026-11-03b (studio/reviews/redteam-2026-11-03b.md): the three rules of the next restart on together — the player
// brokerage, the Reserve and cash now — with their actions in the fuzz menu, every new action's answer checked against the
// state it was given, the stricter invariants (checkThree) and the replay compared account by account (ledgerHash).
describe("the red team's three-rule fuzz (2026-11-03b): the guards that hold stay held", () => {
  it("live seed 1 past the brokerage layer: money conserved, no untrue answer, the replay identical", () => {
    const res = fuzzSeed(1, 110, { cfg: liveConfig(), seasons: true }, 50, false, { three: true });
    expect(res.violations).toEqual([]);
    expect(res.replayMatch).toBe(true);
    expect(res.three?.hash).toBe(res.three?.replayHash);
  }, 600_000);
});
