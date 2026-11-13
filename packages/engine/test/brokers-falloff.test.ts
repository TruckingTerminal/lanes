import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { aiBroker, brokerKey, brokerUncovered, createWorld, giveUp, lostShare, raiseCeiling, stepHour, tally, type World } from "@lanes/engine";

/**
 * brokerRisk.fallOffLine (economy-ai-brokers-2026-11-13.md): with windows off, the AI brokers' per-hub cover rule runs
 * (a fall-off counted as lost), and the walk never pays a carrier past contract × (1 + fallOffShare). Off, neither.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const line = (on: boolean): EconomyConfig => ({ ...LIVE, windows: { ...LIVE.windows, enabled: false }, brokerRisk: { ...LIVE.brokerRisk, fallOffLine: { enabled: on } } });
function world(cfg: EconomyConfig, hours: number): World {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 23 });
  populate(w, { freeOwnerOperators: 30, fleets: 6, brokers: 6 });
  for (let h = 0; h < hours; h++) stepHour(w, ruleBotHook);
  return w;
}
const brokered = (w: World) => [...w.loads.values()].filter((l) => l.status === "open" && l.brokerId !== null && aiBroker(w, l.brokerId));

describe("the AI brokers hold to the fall-off line", () => {
  it("off windows, a fall-off counts as lost at its hub, and a hub losing a quarter of what it took takes no AI tender", () => {
    for (const on of [false, true]) {
      const w = world(line(on), 48);
      const l = brokered(w)[0]!;
      expect(l).toBeDefined();
      const key = brokerKey(l.origin);
      const before = lostShare(w, key);
      giveUp(w, l);
      expect(lostShare(w, key).lost).toBe(before.lost + (on ? 1 : 0));
      // Four taken and one lost in the week at a quiet hub: a quarter, and the rule holds the hub's tenders back.
      const hub = w.net.hubs.findIndex((_, i) => lostShare(w, brokerKey(i)).taken === 0 && lostShare(w, brokerKey(i)).lost === 0);
      for (let i = 0; i < 4; i++) tally(w, brokerKey(hub), "taken");
      expect(brokerUncovered(w, l.brokerId!, hub)).toBe(false);
      tally(w, brokerKey(hub), "lost");
      expect(brokerUncovered(w, l.brokerId!, hub)).toBe(on);
    }
  }, 240_000);

  it("the walk pays a carrier up to the fall-off line and no further, the spot branch inside it", () => {
    for (const on of [false, true]) {
      const w = world(line(on), 48);
      const l = brokered(w)[0]!;
      l.shipperRate = 3;
      l.spotShipperRate = 5; // a boom's spot above the contract's fall-off line
      l.ceiling = 2.7;
      for (let i = 0; i < 30; i++) raiseCeiling(w, l);
      if (on) expect(l.ceiling).toBeCloseTo(3 * (1 + w.cfg.brokerRisk.fallOffShare), 9);
      else expect(l.ceiling).toBeCloseTo(5, 9);
    }
  }, 240_000);
});
