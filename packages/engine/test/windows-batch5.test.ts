import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { applyAction, companyAccount, createWorld, formCompany, isRoundBoundary, stepHour, type World } from "@lanes/engine";

/**
 * Delivery windows batch 5 (studio/reviews/economy-delivery-windows-batch4.md §3; DECISIONS.md 2026-11-10): the windows top
 * on the ratio clamp, and a facility's goods priced from the ratio without the lost-load memory.
 */
const LIVE = withLiveLevers();
const ON: EconomyConfig = { ...LIVE, windows: { ...LIVE.windows, enabled: true } };
// Windows off by its own key: on in the live levers since 0.25.0.
const OFF: EconomyConfig = { ...LIVE, windows: { ...LIVE.windows, enabled: false } };
const net = buildNetwork(hubs, LIVE);

function digest(cfg: EconomyConfig): string {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 20_261_109 });
  populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 6 });
  for (let h = 0; h < 10 * 24; h++) stepHour(w, ruleBotHook);
  const s = JSON.stringify({ t: w.t, next: w.nextLoadId, supply: w.ledger.supply(), books: w.companies.map((c) => [c.id, w.ledger.balance(companyAccount(c.id)), c.delivered, c.onTime, c.operating]), days: w.metrics.days, loads: [...w.loads.values()], trucks: w.trucks });
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}
function toNextRound(w: World): void {
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
}
/** The lost-load memory at every hub and trailer, as of now. */
const remember = (w: World, x: number) => {
  w.lostMem = { t: w.t, v: new Array(w.net.hubs.length * 3).fill(x) };
};

describe("delivery windows batch 5", () => {
  it("leaves the ten-day world byte-identical with windows off, the new key present or absent", () => {
    expect(OFF.windows.ratioClampTop).toBe(6);
    const { ratioClampTop: _, ...windows } = OFF.windows;
    expect(digest({ ...OFF, windows } as unknown as EconomyConfig)).toBe(digest(OFF));
  }, 120_000);

  it("clamps the ratio at windows.ratioClampTop only while windows are on", () => {
    const top = (cfg: EconomyConfig) => {
      const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 5 });
      remember(w, 2_000);
      toNextRound(w);
      return Math.max(...w.lastRatioEq, ...w.lastRatio);
    };
    const [, rates] = LIVE.rates.ratioClamp;
    expect(top(OFF)).toBeLessThanOrEqual(rates); // off: the memory isn't read, and the top is rates.ratioClamp's
    const on = top(ON);
    expect(on).toBeGreaterThan(rates);
    expect(on).toBeLessThanOrEqual(ON.windows.ratioClampTop);
    expect(top({ ...ON, windows: { ...ON.windows, ratioClampTop: rates } })).toBeLessThanOrEqual(rates);
  }, 60_000);

  it("prices a facility's goods the same with the memory full or empty, while its haul's reference rises", () => {
    // Two like worlds, a carrier with a factory at Chicago in each; one remembers no lost loads, the other a great many.
    // The unlock ladder off, so the factory can be bought on day 0 (live, businesses open on day 28 of the beta).
    const cfg: EconomyConfig = { ...ON, unlockLadder: { ...ON.unlockLadder, enabled: false, beta: { ...ON.unlockLadder.beta, enabled: false } } };
    const world = () => {
      const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 2 });
      const co = formCompany(w, { name: "Goods Freight", role: "carrier", homeHubId: "CHI", strategy: "test", orders: [], freePath: false });
      w.ledger.post(w.t, "faucet:starting_grant", companyAccount(co.id), 5_000_000, "test");
      expect(applyAction(w, co.id, { type: "buy_facility", facility: "factory", hubId: "CHI" })).toEqual({ ok: true });
      return w;
    };
    const a = world();
    const b = world();
    const facilityLoads = (w: World) => [...w.loads.values()].filter((l) => l.facilityId !== null).sort((x, y) => x.id - y.id);
    for (let round = 0; round < 12 && facilityLoads(a).length < 3; round++) {
      remember(a, 0);
      remember(b, 500);
      toNextRound(a);
      toNextRound(b);
    }
    const la = facilityLoads(a);
    const lb = facilityLoads(b);
    expect(la.length).toBeGreaterThan(0);
    expect(lb.map((l) => l.id)).toEqual(la.map((l) => l.id));
    for (let i = 0; i < la.length; i++) {
      expect(lb[i]!.saleValue).toBe(la[i]!.saleValue); // the goods: the reference without the memory, in both
      expect(lb[i]!.refRate).toBeGreaterThan(la[i]!.refRate); // the haul: the memory's lift
    }
    a.ledger.assertBalanced();
    b.ledger.assertBalanced();
  }, 120_000);
});
