import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { applyAction, companyAccount, createWorld, dayOf, formCompany, hookedTrailer, hubMiles, stepHour, type World } from "@lanes/engine";

/**
 * A lease-replacing truck handed over on time (assets.swapAtNextIdle; the producer, 2026-11-10, from engineering's probe
 * of client batch 6b): once due, it takes over the moment the leased truck next goes idle, not only at a day's close.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const ON: EconomyConfig = { ...LIVE, assets: { ...LIVE.assets, swapAtNextIdle: true } };
// Off by its own key (0.24.1 switched it on in the live levers).
const OFF: EconomyConfig = { ...LIVE, assets: { ...LIVE.assets, swapAtNextIdle: false } };

function digest(cfg: EconomyConfig): string {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 20_261_109 });
  populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 6 });
  for (let h = 0; h < 10 * 24; h++) stepHour(w, ruleBotHook);
  const s = JSON.stringify({ t: w.t, next: w.nextLoadId, supply: w.ledger.supply(), books: w.companies.map((c) => [c.id, w.ledger.balance(companyAccount(c.id)), c.delivered, c.onTime, c.operating]), days: w.metrics.days, loads: [...w.loads.values()], trucks: w.trucks });
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

/** A starter at Dallas with a new rig on order to replace its lease, already due, its leased truck sent on a long empty run. */
function busyStarter(cfg: EconomyConfig) {
  const w: World = createWorld({ cfg, net, feeds: neutralFeeds, seed: 7, keepLedgerEntries: true });
  const c = formCompany(w, { name: "Swap Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 2_000_000, "test");
  const t = w.trucksByCompany.get(c.id)![0]!;
  expect(t.lease).toBe("npc");
  expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: true }).ok).toBe(true);
  const o = w.orders.find((x) => x.companyId === c.id)!;
  expect(o.replaceNpcLease).toBe(true);
  o.dueDay = dayOf(w.t, w.cfg); // due today
  const far = w.net.hubs.findIndex((_, i) => hubMiles(w, i, c.homeHub) > 250 && hubMiles(w, i, c.homeHub) < 400);
  expect(applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[far]!.id }).ok).toBe(true);
  return { w, c, t };
}

describe("a lease-replacing truck handed over on time (assets.swapAtNextIdle)", () => {
  it("leaves the ten-day world byte-identical with the key false and absent", () => {
    const { swapAtNextIdle: _, ...assets } = OFF.assets;
    expect(digest({ ...OFF, assets } as unknown as EconomyConfig)).toBe(digest(OFF));
  }, 120_000);

  it("off: the order waits through an idle hour until a day's close finds the leased truck idle", () => {
    const { w, c, t } = busyStarter(OFF);
    let h = 0;
    while (t.status !== "idle" && h++ < 72) stepHour(w);
    expect(t.status).toBe("idle");
    if (w.t % w.cfg.time.gameMinutesPerDay !== 0) {
      // Idle, due, and still the lessor's truck until the day closes.
      expect(t.lease).toBe("npc");
      expect(w.orders.some((x) => x.companyId === c.id)).toBe(true);
    }
    w.ledger.assertBalanced();
  });

  it("on: the leased truck swaps the hour it goes idle after the due day, the lease and its trailer back, the driver's day kept", () => {
    const { w, c, t } = busyStarter(ON);
    const deposit = t.depositFd;
    let h = 0;
    while (t.lease === "npc" && h++ < 72) {
      stepHour(w);
      if (t.status !== "idle") expect(t.lease).toBe("npc"); // never while it's running
    }
    expect(t.lease).toBe("owned");
    expect(w.orders.some((x) => x.companyId === c.id)).toBe(false);
    expect(t.trailer).toBe("van");
    expect(hookedTrailer(w, t)?.lease).toBe("owned");
    // The lessor's deposit comes back as deliverOrders returns it (unless it already went into the purchase).
    expect(t.depositFd).toBe(0);
    if (deposit > 0.005) expect(w.ledger.entries.some((e) => e.ref === `deposit:${t.id}` && e.from === "faucet:lease_deposit")).toBe(true);
    // The driver's duty day carried over: the run's minutes are still on it.
    expect(t.shiftDrivenMin).toBeGreaterThan(0);
    w.ledger.assertBalanced();
  });
});
