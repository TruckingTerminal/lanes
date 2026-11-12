import { describe, expect, it } from "vitest";
import { withLiveLevers } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { companyWealthFd, createWorld, econDestroyed, econUsedSale, gini, monthlyEconomy, REPORT_MIN_COMPANIES, scrapOwnedTractor, stepHour, truckValue, type World } from "@lanes/engine";

/**
 * The public monthly report's tallies (econMonth.ts; studio/reviews/economy-eve-sinks.md §2): the rate by trailer, the
 * book value destroyed, the used price over book, wealth at the close; no cell from fewer than ten companies.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
function world(days: number): World {
  const w = createWorld({ cfg: LIVE, net, feeds: neutralFeeds, seed: 13 });
  populate(w, { freeOwnerOperators: 30, fleets: 6, brokers: 4 });
  for (let h = 0; h < days * 24; h++) stepHour(w, ruleBotHook);
  return w;
}

describe("the monthly report's tallies", () => {
  it("closes a month every 30 days with the rate by trailer, from ten carriers or more only", () => {
    // Up to the close itself, so the world read here is the one the record froze.
    const w = world(29);
    while ((w.econ?.months.length ?? 0) < 1) stepHour(w, ruleBotHook);
    const months = w.econ!.months;
    expect(months).toHaveLength(1);
    const m = months[0]!;
    expect([m.index, m.fromDay, m.toDay]).toEqual([0, 0, 29]);
    // Dry van, the starters' freight, clears for many carriers; a trailer with fewer than ten behind it shows nothing.
    expect(m.rateByTrailer.van.perMi).not.toBeNull();
    expect(m.rateByTrailer.van.perMi!).toBeGreaterThan(1);
    for (const eq of ["reefer", "flatbed"] as const) if (m.rateByTrailer[eq].perMi === null) expect(m.rateByTrailer[eq].mi).toBe(0);
    // Wealth at the close: the shared measure, national.
    const counted = w.companies.filter((c) => c.role !== "holder" && c.retiredDay === undefined);
    expect(m.wealth.companies).toBe(counted.length);
    expect(m.wealth.gini).toBeCloseTo(gini(counted.map((c) => companyWealthFd(w, c.id))), 9);
    // A segment with fewer than ten companies shows no median.
    expect(m.wealth.medianBySegment.broker).toBeNull(); // four brokers
    expect(m.work.wageIndex).toBe(w.labor.wageIndex);
    // The tallies start afresh after the close.
    expect(w.econ!.tally.rate.van.mi).toBe(0);
  }, 120_000);

  it("counts the book value destroyed and the used price over book, and hides the ratio behind fewer than ten companies", () => {
    const w = world(2);
    const c = w.companies.find((x) => x.role === "carrier" && (w.trucksByCompany.get(x.id) ?? []).some((t) => t.lease === "owned" && t.status === "idle"))!;
    const t = w.trucksByCompany.get(c.id)!.find((x) => x.lease === "owned" && x.status === "idle")!;
    const before = w.econ?.tally.destroyed.fd ?? 0;
    const value = truckValue(w, t);
    scrapOwnedTractor(w, c, t);
    expect(w.econ!.tally.destroyed.n).toBeGreaterThanOrEqual(1);
    expect(w.econ!.tally.destroyed.fd - before).toBeGreaterThanOrEqual(value - 1e-6);
    econDestroyed(w, 1_000, false); // a trailer alone: value, not a tractor
    // Used sales between nine companies: the ratio stays private; a tenth company makes it public.
    for (let i = 1; i <= 4; i++) econUsedSale(w, 40_000, 50_000, i, i + 4);
    w.t = 30 * 1440 - 1;
    monthlyEconomy(w);
    expect(w.econ!.months.at(-1)!.used).toEqual({ n: 4, priceOverBook: null });
    for (let i = 1; i <= REPORT_MIN_COMPANIES / 2; i++) econUsedSale(w, 45_000, 50_000, 100 + i, 200 + i);
    monthlyEconomy(w);
    expect(w.econ!.months.at(-1)!.used.priceOverBook).toBeCloseTo(0.9, 9);
    w.ledger.assertBalanced();
  }, 120_000);
});
