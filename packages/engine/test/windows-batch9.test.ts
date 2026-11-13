import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { chooseFacility, populate, ruleBotHook } from "@lanes/agents";
import { createWorld, isRoundBoundary, memoryLift, stepHour, type World } from "@lanes/engine";

/**
 * Delivery windows batch 9 (economy-delivery-windows-batch8-2026-11-13.md): the bots price a facility's haul at the hub's
 * memory lift, so they buy only where the lost-load memory is quiet. Behind windows.enabled.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const noLadder = (c: EconomyConfig): EconomyConfig => ({ ...c, unlockLadder: { ...c.unlockLadder, enabled: false, beta: { ...c.unlockLadder.beta, enabled: false } } });
const ON = noLadder({ ...LIVE, windows: { ...LIVE.windows, enabled: true } });
const OFF = noLadder(LIVE);

function world(cfg: EconomyConfig): World {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 9 });
  populate(w, { freeOwnerOperators: 20, fleets: 4, brokers: 4 });
  do stepHour(w, ruleBotHook);
  while (w.t < 2 * 24 * 60 || !isRoundBoundary(w.t, w.cfg));
  return w;
}

describe("delivery windows batch 9", () => {
  it("reads the memory's lift by hub and trailer, 1 with a quiet memory or windows off", () => {
    const w = world(ON);
    expect(w.lastRatioEqBase).toBeDefined();
    const base = w.lastRatioEqBase!;
    w.lastRatioEq = Float64Array.from(base, (x) => 2 * x);
    expect(memoryLift(w, 0, "van")).toBeCloseTo(2 ** w.cfg.windows.ratioExponent, 9);
    w.lastRatioEq = Float64Array.from(base);
    expect(memoryLift(w, 0, "van")).toBeCloseTo(1, 12);
    const off = world(OFF);
    expect(off.lastRatioEqBase).toBeUndefined();
    expect(memoryLift(off, 0, "van")).toBe(1);
  }, 120_000);

  it("a bot buys a facility where the memory is quiet, and none where it lifts every hub", () => {
    const w = world(ON);
    const base = Float64Array.from(w.lastRatioEqBase!);
    w.lastRatioEq = Float64Array.from(base); // quiet everywhere
    const quiet = chooseFacility(w, 1e12, 1e9);
    expect(quiet).not.toBeNull();
    w.lastRatioEq = Float64Array.from(base, (x) => 9 * x); // loud everywhere: the haul costs three times the reference
    expect(chooseFacility(w, 1e12, 1e9)).toBeNull();
  }, 120_000);
});
