import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { applyAction, brokerKey, brokerUncovered, companyAccount, createWorld, dayOf, facilityCovered, facilityKey, factoringLog, isRoundBoundary, lostShare, npcKey, stepHour, tally, type World } from "@lanes/engine";

/**
 * Delivery windows batch 6 (studio/reviews/economy-delivery-windows-batch5.md §3; DECISIONS.md 2026-11-10): an AI broker
 * covers what it takes, the bots' facility test reads the window, and a losing facility is closed.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
// The unlock ladder off, so brokers and facilities are open on day 0.
const noLadder = (c: EconomyConfig): EconomyConfig => ({ ...c, unlockLadder: { ...c.unlockLadder, enabled: false, beta: { ...c.unlockLadder.beta, enabled: false } } });
const ON = noLadder({ ...LIVE, windows: { ...LIVE.windows, enabled: true } });
const OFF = noLadder(LIVE);

function digest(cfg: EconomyConfig): string {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 20_261_109 });
  populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 6 });
  for (let h = 0; h < 10 * 24; h++) stepHour(w, ruleBotHook);
  const s = JSON.stringify({ t: w.t, next: w.nextLoadId, supply: w.ledger.supply(), books: w.companies.map((c) => [c.id, w.ledger.balance(companyAccount(c.id)), c.delivered, c.onTime, c.operating]), days: w.metrics.days, loads: [...w.loads.values()], trucks: w.trucks });
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}
const toNextRound = (w: World) => {
  do stepHour(w, ruleBotHook);
  while (!isRoundBoundary(w.t, w.cfg));
};

describe("delivery windows batch 6", () => {
  it("leaves the ten-day world byte-identical with windows off, the new keys present or absent", () => {
    const { coverDays: _a, coverMinLoads: _b, brokerMaxLostShare: _c, facilityCloseWeeks: _d, ...windows } = LIVE.windows;
    expect(digest({ ...LIVE, windows } as unknown as EconomyConfig)).toBe(digest(LIVE));
  }, 120_000);

  it("keeps a trailing week of loads taken and lost, and reads a share once enough were taken", () => {
    const w = createWorld({ cfg: ON, net, feeds: neutralFeeds, seed: 3 });
    const key = brokerKey(4);
    for (let i = 0; i < 3; i++) tally(w, key, "taken");
    tally(w, key, "lost");
    expect(lostShare(w, key)).toEqual({ taken: 3, lost: 1, share: null }); // under coverMinLoads
    tally(w, key, "taken");
    expect(lostShare(w, key).share).toBe(0.25);
    // A week on, it has gone.
    w.t += ON.windows.coverDays * ON.time.gameMinutesPerDay;
    expect(lostShare(w, key)).toEqual({ taken: 0, lost: 0, share: null });
    // Off, nothing is kept.
    const off = createWorld({ cfg: OFF, net, feeds: neutralFeeds, seed: 3 });
    tally(off, key, "taken");
    expect(off.winTally).toBeUndefined();
  });

  it("AI brokers that lose a quarter of what they take at a hub take no tender there; the load goes to the board", () => {
    const w = createWorld({ cfg: ON, net, feeds: neutralFeeds, seed: 4 });
    populate(w, { freeOwnerOperators: 20, fleets: 4, brokers: 6 });
    for (let d = 0; d < 3; d++) for (let h = 0; h < 24; h++) stepHour(w, ruleBotHook);
    const brokers = w.companies.filter((c) => c.role === "broker");
    expect(brokers.length).toBeGreaterThan(0);
    // The AI brokers at every hub have lost half of what they took (batch 7: one tally per hub across them).
    const day = dayOf(w.t, w.cfg);
    for (let hub = 0; hub < w.net.hubs.length; hub++) (w.winTally ??= {})[brokerKey(hub)] = [{ day, taken: 100, lost: 50 }];
    expect(brokerUncovered(w, brokers[0]!.id, 0)).toBe(true);
    const before = new Set(w.loads.keys());
    const uncovered = factoringLog(w).tendersUncovered ?? 0;
    toNextRound(w);
    const fresh = [...w.loads.values()].filter((l) => !before.has(l.id) && l.shipperId === null);
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.filter((l) => l.brokerId !== null)).toEqual([]);
    expect(factoringLog(w).tendersUncovered ?? 0).toBeGreaterThan(uncovered);
    w.ledger.assertBalanced();
  }, 120_000);

  it("reads a facility's chance of a haul from the hub's facility freight, else (batch 7) the hub's NPC freight, else 0", () => {
    const w = createWorld({ cfg: ON, net, feeds: neutralFeeds, seed: 5 });
    const hub = 3;
    const day = dayOf(w.t, w.cfg);
    // Nothing read at the hub: nothing says freight moves there.
    expect(facilityCovered(w, hub, "van")).toBe(0);
    // Too few NPC loads to read (under coverMinLoads): still 0.
    (w.winTally ??= {})[npcKey(hub)] = [{ day, taken: 3, lost: 0 }];
    expect(facilityCovered(w, hub, "van")).toBe(0);
    // The hub's NPC freight: 2 of 10 lost.
    w.winTally[npcKey(hub)] = [{ day, taken: 10, lost: 2 }];
    expect(facilityCovered(w, hub, "van")).toBeCloseTo(0.8, 12);
    // The hub's own facility freight, once it has enough, comes first.
    w.winTally[facilityKey(hub)] = [{ day, taken: 10, lost: 4 }];
    expect(facilityCovered(w, hub, "van")).toBeCloseTo(0.6, 12);
  });

  it("a bot closes a facility that has run at a loss for eight weeks, with windows on only", () => {
    const run = (cfg: EconomyConfig) => {
      const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 6 });
      populate(w, { freeOwnerOperators: 3, fleets: 2, brokers: 0 });
      // A fleet: it owns its trucks, so nothing holds its investing back (a free owner-operator invests only once it owns one).
      const c = w.companies.find((x) => x.role === "carrier" && (w.trucksByCompany.get(x.id) ?? []).some((t) => t.lease === "owned"))!;
      w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 5_000_000, "test");
      expect(applyAction(w, c.id, { type: "buy_facility", facility: "warehouse", hubId: w.net.hubs[c.homeHub]!.id })).toEqual({ ok: true });
      const f = w.facilities.find((x) => x.ownerId === c.id)!;
      const supply = w.facilitySupply[f.type];
      f.boughtDay = dayOf(w.t, w.cfg) - 7 * ON.windows.facilityCloseWeeks;
      f.netFd = -5_000;
      for (let h = 0; h < 24; h++) stepHour(w, ruleBotHook);
      return { f, supply, w };
    };
    const on = run(ON);
    expect(on.f.ownerId).toBe(0);
    expect(on.w.facilitySupply[on.f.type]).toBe(on.supply + 1);
    on.w.ledger.assertBalanced();
    const off = run(OFF);
    expect(off.f.ownerId).not.toBe(0);
  }, 120_000);
});
