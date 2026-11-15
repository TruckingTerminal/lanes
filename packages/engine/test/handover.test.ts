import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { createWorld, dayOf, deliverOrders, handOverWaiting, hubMiles, isRoundBoundary, placeOfHub, placeOrder, stepHour, swapAtIdle, type Company, type Truck, type World } from "@lanes/engine";

/**
 * The director's sprint §6 (assets.handOverAtTruck, off by default): a bought truck has a place, the hand-over happens
 * there, and the leased truck it replaces gets there on a real run.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const ON = { ...LIVE, assets: { ...LIVE.assets, handOverAtTruck: true } } as EconomyConfig;
const OFF = { ...LIVE, assets: { ...LIVE.assets, handOverAtTruck: false } } as EconomyConfig;

function toNextRound(w: World): void {
  do stepHour(w, ruleBotHook);
  while (!isRoundBoundary(w.t, w.cfg));
}
/** A company on the free path's NPC lease, the leased truck idle at a hub far from home. */
function leased(cfg: EconomyConfig, seed = 13) {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed });
  populate(w, { freeOwnerOperators: 12, fleets: 2, brokers: 1 });
  for (let h = 0; h < 2; h++) stepHour(w, ruleBotHook);
  let c: Company | undefined;
  let t: Truck | undefined;
  for (const x of w.companies) {
    const lease = (w.trucksByCompany.get(x.id) ?? []).find((y) => y.lease === "npc");
    if (x.role === "carrier" && lease) {
      c = x;
      t = lease;
      break;
    }
  }
  const far = w.net.hubs.findIndex((_h, i) => hubMiles(w, i, c!.homeHub) > 500);
  Object.assign(t!, { status: "idle", hub: far, targetHub: far, place: placeOfHub(far), targetPlace: placeOfHub(far), remainingMi: 0, loadId: null });
  return { w, c: c!, t: t!, far };
}

describe("the bought truck's hand-over (assets.handOverAtTruck)", () => {
  it("off: the order is handed over wherever the leased truck stands idle, as before", () => {
    const { w, c, t, far } = leased(OFF);
    const o = placeOrder(w, c, "workhorse", t.trailer, true, "rig", 0);
    expect(o.hub).toBeUndefined();
    deliverOrders(w);
    expect(t.lease).toBe("owned");
    expect(t.hub).toBe(far);
  });

  it("on: the order waits at the dealer at home; idle elsewhere the lease runs on, and at home it's handed over", () => {
    const { w, c, t } = leased(ON);
    const o = placeOrder(w, c, "workhorse", t.trailer, true, "rig", 0);
    expect(o.hub).toBe(c.homeHub);
    expect(handOverWaiting(w, c, t)).toEqual({ hub: c.homeHub, orderId: o.id });
    deliverOrders(w);
    expect(swapAtIdle(w, t)).toBe(false);
    expect(t.lease).toBe("npc");
    expect(w.orders).toContain(o);
    Object.assign(t, { hub: c.homeHub, targetHub: c.homeHub, place: placeOfHub(c.homeHub), targetPlace: placeOfHub(c.homeHub) });
    expect(handOverWaiting(w, c, t)).toBeNull();
    deliverOrders(w);
    expect(t.lease).toBe("owned");
    expect(w.orders).not.toContain(o);
  });

  it("on: a truck that adds to the fleet waits for its driver at its dealer's hub", () => {
    const { w, c, far } = leased(ON);
    const before = new Set((w.trucksByCompany.get(c.id) ?? []).map((x) => x.id));
    placeOrder(w, c, "workhorse", "van", false, "rig", 0, far);
    deliverOrders(w);
    const added = (w.trucksByCompany.get(c.id) ?? []).find((x) => !before.has(x.id))!;
    expect(added.hub).toBe(far);
  });

  it("on: a bot books the leased truck no new load once its replacement is ready elsewhere, and runs it there empty", () => {
    const { w, c, t } = leased(ON);
    expect(c.human).toBeFalsy();
    expect(c.orders.some((o) => o.kind === "bid")).toBe(true);
    c.firstHandBidDay ??= 0; // its first bid by hand placed, as a bot does in its first rounds (freeEntry.firstBidByHand)
    placeOrder(w, c, "workhorse", t.trailer, true, "rig", 0);
    toNextRound(w);
    expect(t.loadId).toBeNull();
    expect(["repositioning", "idle"]).toContain(t.status);
    expect(t.targetHub).toBe(c.homeHub);
  }, 60_000);

  it("on: with the dispatcher off the game never moves the leased truck", () => {
    const { w, c, t, far } = leased(ON);
    c.human = true;
    c.orders = c.orders.filter((o) => o.kind !== "bid" && o.kind !== "bookNow" && o.kind !== "reposition");
    placeOrder(w, c, "workhorse", t.trailer, true, "rig", 0);
    toNextRound(w);
    expect(t.hub).toBe(far);
    expect(t.status).toBe("idle");
    expect(dayOf(w.t, w.cfg)).toBeGreaterThanOrEqual(0);
  }, 60_000);
});
