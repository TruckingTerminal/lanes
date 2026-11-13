import { describe, expect, it } from "vitest";
import { withLiveLevers } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { balanceSinksFd, companyAccount, createWorld, ratioOf, stepHour, trailingSinksPerMonthFd, type DayMetrics } from "@lanes/engine";

/**
 * The settlement fee's first step (economy-settlement-fee-spec-2026-11-13.md; the producer, 2026-11-13): the balance
 * readers count the fee's burn (sink:trade_burn) as a sink, the cap's refill never does. With the fee off nothing posts
 * to the tag, so every reading is as before (the live digest, unchanged).
 */
const LIVE = withLiveLevers();

describe("the settlement fee's readers", () => {
  it("the balance readers add the fee's burn; the cap's refill doesn't", () => {
    expect(balanceSinksFd({ sinkFd: 100 })).toBe(100);
    expect(balanceSinksFd({ sinkFd: 100, burnByTag: { trade_burn: 10, buyback: 50 } })).toBe(110);
    const day = { faucetFd: 200, sinkFd: 100, burnByTag: { trade_burn: 10 }, faucetByTag: {}, sinkByTag: {} } as unknown as DayMetrics;
    expect(ratioOf([day]).raw).toBeCloseTo(110 / 200, 12);

    const w = createWorld({ cfg: LIVE, net: buildNetwork(hubs, LIVE), feeds: neutralFeeds, seed: 5 });
    populate(w, { freeOwnerOperators: 10, fleets: 2, brokers: 1 });
    for (let h = 0; h < 2 * 24; h++) stepHour(w, ruleBotHook);
    const refill = trailingSinksPerMonthFd(w, 30);
    const last = w.metrics.days.at(-1)!;
    last.burnByTag = { ...last.burnByTag, trade_burn: 1e9 };
    expect(trailingSinksPerMonthFd(w, 30)).toBe(refill); // the fee never refills next month's pay
    expect(ratioOf(w.metrics.days).sinkFd).toBeGreaterThan(1e9); // and the balance readers see it
  }, 120_000);

  it("a posting to sink:trade_burn is a burn in the day's books, not an operating sink", () => {
    const w = createWorld({ cfg: LIVE, net: buildNetwork(hubs, LIVE), feeds: neutralFeeds, seed: 5 });
    populate(w, { freeOwnerOperators: 10, fleets: 2, brokers: 1 });
    for (let h = 0; h < 24; h++) stepHour(w, ruleBotHook);
    const c = w.companies.find((x) => x.role === "carrier")!;
    w.ledger.post(w.t, companyAccount(c.id), "sink:trade_burn", 123, "fee:test");
    for (let h = 0; h < 24; h++) stepHour(w, ruleBotHook);
    const day = w.metrics.days.at(-1)!;
    expect(day.burnByTag.trade_burn).toBeCloseTo(123, 6);
    expect(day.sinkByTag.trade_burn).toBeUndefined();
    w.ledger.assertBalanced();
  }, 120_000);
});
