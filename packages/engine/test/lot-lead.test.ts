import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { economyConfig as cfg, withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { applyAction, companyAccount, createWorld, dayOf, dealerBacklog, deliveryDays, formCompany, stepHour, type World } from "@lanes/engine";

// The used lot's wait (studio/reviews/economy-player2.md §2): today a lot rig waits in the new-truck queue and lengthens it;
// usedMarket.npcLot.deliveryDays gives the lot its own wait, and inBacklog: false leaves its rigs out of the queue's count.
const net = buildNetwork(hubs, cfg);
const lotCfg = (lot: Partial<EconomyConfig["usedMarket"]["npcLot"]>): EconomyConfig => ({
  ...cfg,
  breakdowns: { ...cfg.breakdowns, per1000MiNew: 0 },
  assets: { ...cfg.assets, enabled: true },
  dealerDelivery: { ...cfg.dealerDelivery, daysPerPendingOrder: 1 }, // a day an order, so one order shows
  usedMarket: { ...cfg.usedMarket, npcLot: { ...cfg.usedMarket.npcLot, enabled: true, stock: 4, perWeek: 4, ...lot } },
});
const buyer = (w: World) => {
  const c = formCompany(w, { name: "Lot buyer", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 1_000_000, "test");
  return c;
};
const buyLot = (w: World, id: number) => applyAction(w, id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, used: true });

describe("the used lot's wait", () => {
  it("today: a lot rig waits in the new-truck queue and lengthens it", () => {
    const w = createWorld({ cfg: lotCfg({}), net, feeds: neutralFeeds, seed: 7 });
    const c = buyer(w);
    const base = deliveryDays(w);
    expect(buyLot(w, c.id).ok).toBe(true);
    expect(w.orders[0]!.dueDay - dayOf(w.t, w.cfg)).toBe(base);
    expect(buyLot(w, c.id).ok).toBe(true);
    expect(deliveryDays(w)).toBe(base + 2);
    expect(dealerBacklog(w)).toEqual({ orders: 2, usedLot: 2, counted: 2 });
  });

  it("switched: the lot delivers in its own days and leaves the new-truck wait alone", () => {
    const w = createWorld({ cfg: lotCfg({ deliveryDays: 7, inBacklog: false }), net, feeds: neutralFeeds, seed: 7 });
    const c = buyer(w);
    const base = deliveryDays(w);
    for (let i = 0; i < 3; i++) expect(buyLot(w, c.id).ok).toBe(true);
    expect(w.orders.every((o) => o.dueDay - dayOf(w.t, w.cfg) === 7)).toBe(true);
    expect(deliveryDays(w)).toBe(base);
    expect(dealerBacklog(w)).toEqual({ orders: 3, usedLot: 3, counted: 0 });
    // A new truck still counts.
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false }).ok).toBe(true);
    expect(deliveryDays(w)).toBe(base + 1);
  });

  it("a free starter's first truck from the lot keeps the dealer's queue (step 9's pace)", () => {
    const w = createWorld({ cfg: lotCfg({ deliveryDays: 7 }), net, feeds: neutralFeeds, seed: 7 });
    const c = formCompany(w, { name: "Starter", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
    w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 1_000_000, "test");
    const base = deliveryDays(w);
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: true, used: true }).ok).toBe(true);
    expect(w.orders[0]!.replaceNpcLease).toBe(true);
    expect(w.orders[0]!.dueDay - dayOf(w.t, w.cfg)).toBe(base);
  });
});

/** The ten-day live-profile world's digest (apps/sim/src/determinism.ts's fields). */
function liveDigest(c: EconomyConfig): string {
  const w = createWorld({ cfg: c, net: buildNetwork(hubs, c), feeds: neutralFeeds, seed: 20_261_109 });
  populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 6 });
  for (let h = 0; h < 10 * 24; h++) stepHour(w, ruleBotHook);
  const s = JSON.stringify({ t: w.t, next: w.nextLoadId, supply: w.ledger.supply(), books: w.companies.map((x) => [x.id, w.ledger.balance(companyAccount(x.id)), x.delivered, x.onTime, x.operating]), days: w.metrics.days, loads: [...w.loads.values()], trucks: w.trucks });
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

describe("a starter's lot rig from the lot's stock (usedMarket.npcLot.startersFromStock)", () => {
  it("leaves the ten-day live world identical with the key false and absent", () => {
    const LIVE = withLiveLevers();
    expect(LIVE.usedMarket.npcLot.startersFromStock).toBe(false);
    const { startersFromStock: _, ...npcLot } = LIVE.usedMarket.npcLot;
    const absent = { ...LIVE, usedMarket: { ...LIVE.usedMarket, npcLot } } as unknown as EconomyConfig;
    expect(liveDigest(absent)).toBe(liveDigest(LIVE));
  }, 120_000);

  it("off: a starter's rig keeps the dealer's queue; on: it comes from stock in the lot's days; a fleet's rig is the lot's either way", () => {
    const starterWait = (on: boolean) => {
      const w = createWorld({ cfg: lotCfg({ deliveryDays: 7, startersFromStock: on }), net, feeds: neutralFeeds, seed: 7 });
      const c = formCompany(w, { name: "Starter", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
      w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 1_000_000, "test");
      const base = deliveryDays(w);
      expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: true, used: true }).ok).toBe(true);
      expect(w.orders[0]!.replaceNpcLease).toBe(true);
      return { wait: w.orders[0]!.dueDay - dayOf(w.t, w.cfg), base };
    };
    const off = starterWait(false);
    expect(off.wait).toBe(off.base);
    expect(off.base).not.toBe(7);
    expect(starterWait(true).wait).toBe(7);
    for (const on of [false, true]) {
      const w = createWorld({ cfg: lotCfg({ deliveryDays: 7, startersFromStock: on }), net, feeds: neutralFeeds, seed: 7 });
      const c = buyer(w);
      expect(buyLot(w, c.id).ok).toBe(true);
      expect(w.orders[0]!.dueDay - dayOf(w.t, w.cfg)).toBe(7);
    }
    // With the lot's own days unset, every lot rig queues, on or off.
    const w = createWorld({ cfg: lotCfg({ startersFromStock: true }), net, feeds: neutralFeeds, seed: 7 });
    const c = formCompany(w, { name: "Starter", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
    w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 1_000_000, "test");
    const base = deliveryDays(w);
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: true, used: true }).ok).toBe(true);
    expect(w.orders[0]!.dueDay - dayOf(w.t, w.cfg)).toBe(base);
  });
});
