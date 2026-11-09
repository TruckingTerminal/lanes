import { describe, expect, it } from "vitest";
import { economyConfig, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { clearsNear, companyAccount, createWorld, noteClear, stepHour, type World } from "@lanes/engine";

/**
 * Item 5 (the itinerary): "usually clears near" lagged the board in week one, since a lane's first 40 clears held a
 * plain mean. freight.clearsNear.halfLifeDays weighs clears by time instead. Off (0) it is today's rule exactly; on, it
 * moves only the clears table, which no bot prices through (rule bots bid breakEvenPlus or ceilingPct), so a world
 * of bots plays the same either way.
 */
const net = buildNetwork(hubs, economyConfig);
const withHalfLife = (days: number): EconomyConfig => ({ ...economyConfig, freight: { ...economyConfig.freight, clearsNear: { ...economyConfig.freight.clearsNear, halfLifeDays: days } } });
const load = { laneId: 7, equipment: "van", origin: 3, refRate: 3, hot: 0, ceiling: 99, contractId: 0 } as unknown as Parameters<typeof clearsNear>[1];

function bots(cfg: EconomyConfig, days: number): World {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 20_261_107 });
  populate(w, { freeOwnerOperators: 60, fleets: 12, brokers: 8 });
  for (let h = 0; h < days * 24; h++) stepHour(w, ruleBotHook);
  return w;
}
const books = (w: World) => w.companies.map((c) => [c.id, Math.round(w.ledger.balance(companyAccount(c.id)) * 100), c.delivered, c.operating.revenueFd.toFixed(2)].join(":")).join("|");

describe("usually clears near, weighed by time (freight.clearsNear.halfLifeDays)", () => {
  it("off: a plain mean for the first 40 clears, then trailing by count, with nothing else kept", () => {
    expect(economyConfig.freight.clearsNear.halfLifeDays).toBe(0);
    for (const cfg of [economyConfig, withHalfLife(0)]) {
      const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 1 });
      const rates = Array.from({ length: 41 }, (_, i) => 3 + (i % 7) * 0.25);
      for (const r of rates) noteClear(w, load, r);
      const mean40 = rates.slice(0, 40).reduce((s, r) => s + r, 0) / 40;
      expect(w.clears!.lane["7:van"]![0]).toBeCloseTo(mean40 + (rates[40]! - mean40) / 40, 9);
      expect(Object.keys(w.clears!.lane).some((k) => k.includes("|"))).toBe(false);
    }
  });

  it("on: the first days fade with time, so a lane's rate follows the board", () => {
    const w = createWorld({ cfg: withHalfLife(2), net, feeds: neutralFeeds, seed: 1 });
    const day = w.cfg.time.gameMinutesPerDay;
    for (let i = 0; i < 40; i++) noteClear(w, load, 5); // the first days' clears
    w.t += 4 * day; // two half-lives: they weigh a quarter of 40
    noteClear(w, load, 3);
    expect(w.clears!.lane["7:van"]![0]).toBeCloseTo(5 + (3 - 5) / (40 / 4 + 1), 9);
    expect(w.clears!.lane["7:van"]![1]).toBe(41);
    // Off, the same clears would have moved it by a fortieth.
    const off = createWorld({ cfg: withHalfLife(0), net, feeds: neutralFeeds, seed: 1 });
    for (let i = 0; i < 40; i++) noteClear(off, load, 5);
    noteClear(off, load, 3);
    expect(off.clears!.lane["7:van"]![0]).toBeCloseTo(5 + (3 - 5) / 40, 9);
  });

  it("leaves a world of bots byte-identical: no bot prices through it, so only the table differs", () => {
    const a = bots(withHalfLife(0), 4);
    const b = bots(withHalfLife(2), 4);
    expect(books(b)).toBe(books(a));
    expect(b.ledger.supply()).toBe(a.ledger.supply());
    expect(JSON.stringify(b.clears?.lane)).not.toBe(JSON.stringify(a.clears?.lane));
  }, 300_000);
});
