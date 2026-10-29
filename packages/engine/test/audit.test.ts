import { describe, expect, it } from "vitest";
import { economyConfig as cfg } from "@lanes/config";
import { buildNetwork, dasin, datan2, hubs, neutralFeeds, stationsOnRoute, weighStations, PLACE_OF_HUB } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import {
  activeLoanOn,
  addTruck,
  applyAction,
  askingPay,
  companyAccount,
  crash,
  createWorld,
  formCompany,
  offerStaff,
  poolOf,
  runDays,
  setPay,
  type Action,
  type Load,
  type World,
} from "@lanes/engine";

// Regression tests for the 2026-10-28 audit: every one of these was a reported, reproduced bug.

const net = buildNetwork(hubs, cfg);
const world = (seed = 1): World => createWorld({ cfg, net, feeds: neutralFeeds, seed });
const carrier = (w: World, o: { hub?: string; freePath?: boolean; human?: boolean } = {}) =>
  formCompany(w, { name: "T", role: "carrier", homeHubId: o.hub ?? "DAL", strategy: o.human ? "player:x" : "test", orders: [], freePath: o.freePath ?? true, human: o.human ?? false });
const fund = (w: World, id: number, fd: number) => w.ledger.post(w.t, "faucet:starting_grant", companyAccount(id), fd, "test");
const balance = (w: World, id: number) => w.ledger.balance(companyAccount(id));

function mkLoad(w: World, origin: number, dest: number, hot = 0): Load {
  const lane = net.lanesFrom[origin]!.find((l) => l.dest === dest) ?? net.lanesFrom[origin]![0]!;
  const load: Load = {
    id: w.nextLoadId++, laneId: lane.id, origin: lane.origin, dest: lane.dest, miles: lane.miles, equipment: "van",
    brokerId: null, shipperId: null, facilityId: null, saleValue: 0, shipperRate: 3, spotShipperRate: 3, refRate: 3, ceiling: 3, bookNow: 3,
    postedRound: w.round, roundsUnfilled: 0, status: "open", carrierId: null, truckId: null, clearedRate: 0, dueT: 0,
    hot, vet: 0, cargoValue: 5_000, doubleBroker: null,
    commodity: 0, originPlace: PLACE_OF_HUB[lane.origin]!, destPlace: PLACE_OF_HUB[lane.dest]!, appointmentT: 1e12, routeHours: lane.miles / 50, routeTollFd: 0,
  };
  w.loads.set(load.id, load);
  return load;
}

describe("the action boundary", () => {
  it("refuses malformed actions instead of letting them reach the ledger", () => {
    const w = world(21);
    populate(w, { freeOwnerOperators: 20, fleets: 5, brokers: 2 });
    const c = carrier(w, { human: true });
    fund(w, c.id, 50_000);
    const truck = addTruck(w, c, "owned", "workhorse", "van");
    const bad = [
      { type: "deposit_finance", amountFd: "abc" },
      { type: "deposit_finance" },
      { type: "withdraw_finance", amountFd: NaN },
      { type: "borrow", truckId: truck.id, amountFd: Infinity },
      { type: "buy_asset", tier: "__proto__", trailer: "van", replaceNpcLease: false },
      { type: "buy_facility", facility: "constructor", hubId: "DAL" },
      { type: "list_truck", truckId: truck.id, askFd: -1, floorFd: -1, stepFd: 0 },
      { type: "list_truck", truckId: truck.id, askFd: "x", floorFd: 1, stepFd: 1 },
      { type: "set_standing_orders", orders: [{ kind: "bid", maxDeadheadMi: 100, price: { mode: "ceilingPct", pct: -1 } }] },
      { type: "set_standing_orders", orders: [{ kind: "bid", maxDeadheadMi: 100 }] },
      { type: "set_standing_orders", orders: [{ kind: "reposition", afterIdleRounds: 1, to: 5 }] },
      { type: "set_standing_orders", orders: [{ kind: "broker", marginPct: 2, maxOpenLoads: 5 }] },
      { type: "set_standing_orders", orders: Array.from({ length: 100 }, () => ({ kind: "floor", breakEvenPlusPct: 0 })) },
      { type: "offer_staff", staffId: 1, pay: "5" },
      { type: "set_staff_pay", staffId: 1, pay: 1e20 },
      { type: "place_bid", truckId: truck.id, loadId: 1, rate: -3 },
      { type: "lease_truck", trailer: "tank" },
      { type: "reposition_truck", truckId: truck.id, hubId: 5 },
      { type: "nonsense" },
      { type: "cancel_bid", truckId: 1.5 },
    ] as unknown as Action[];
    for (const a of bad) expect(applyAction(w, c.id, a).ok, JSON.stringify(a)).toBe(false);
    expect(() => runDays(w, 2, ruleBotHook)).not.toThrow();
    w.ledger.assertBalanced();
  });

  it("rejects non-finite amounts in the ledger itself", () => {
    const w = world(22);
    expect(() => w.ledger.post(0, "co:1", "sink:test", NaN, "t")).toThrow();
    expect(() => w.ledger.post(0, "co:1", "sink:test", Infinity, "t")).toThrow();
    expect(() => w.ledger.post(0, "co:1", "co:1", 5, "t")).toThrow();
  });

  it("only the truck's owner can withdraw its bid, and a solo driver can't bid a hot load by hand", () => {
    const w = world(23);
    const a = carrier(w);
    const b = carrier(w);
    const [ta] = w.trucksByCompany.get(a.id)!;
    const load = mkLoad(w, ta!.hub, net.lanesFrom[ta!.hub]![0]!.dest);
    expect(applyAction(w, a.id, { type: "place_bid", truckId: ta!.id, loadId: load.id, rate: 2 }).ok).toBe(true);
    expect(applyAction(w, b.id, { type: "cancel_bid", truckId: ta!.id }).ok).toBe(false);
    expect(w.manualBids.size).toBe(1);
    const hot = mkLoad(w, ta!.hub, net.lanesFrom[ta!.hub]![0]!.dest, 1.8);
    expect(applyAction(w, a.id, { type: "place_bid", truckId: ta!.id, loadId: hot.id, rate: 4 })).toEqual({ ok: false, reason: "a hot load's window takes a team" });
  });
});

describe("staff exploits", () => {
  it("cutting pay and restoring it is a net loss, not a morale reset", () => {
    const w = world(24);
    const c = carrier(w);
    fund(w, c.id, 20_000);
    const t = addTruck(w, c, "owned", "workhorse", "van"); // the owner drives the lease; this seat is open
    const s = poolOf(w, "driver")[0]!;
    expect(offerStaff(w, c, s, askingPay(w, s), t.id)).toBeNull();
    s.morale = 0.2;
    const pay = s.pay;
    setPay(w, s, 0.01);
    setPay(w, s, pay);
    expect(s.morale).toBeLessThanOrEqual(0.2);
  });

  it("matching an offer and then cutting the pay back sends the driver packing", () => {
    const w = world(25);
    const a = carrier(w);
    const b = carrier(w, { hub: "ATL" });
    a.autoStaff = false;
    b.autoStaff = false;
    fund(w, a.id, 50_000);
    fund(w, b.id, 50_000);
    const ta = addTruck(w, a, "owned", "workhorse", "van");
    const tb = addTruck(w, b, "owned", "workhorse", "van");
    const s = poolOf(w, "driver")[0]!;
    expect(offerStaff(w, a, s, askingPay(w, s), ta.id)).toBeNull();
    const before = balance(w, b.id);
    expect(offerStaff(w, b, s, s.pay * 1.3, tb.id)).toBeNull();
    expect(balance(w, b.id)).toBe(before); // the bonus is paid on signing, not on offering
    const original = s.pay;
    expect(applyAction(w, a.id, { type: "set_staff_pay", staffId: s.id, pay: s.pay * 1.3 }).ok).toBe(true);
    expect(s.offer).toBeNull();
    expect(applyAction(w, a.id, { type: "set_staff_pay", staffId: s.id, pay: original }).ok).toBe(true);
    expect(s.offer?.companyId).toBe(0);
    expect(s.morale).toBe(0);
  });

  it("hiring someone away costs a sign-on bonus, and poaching can't overwrite a quit notice", () => {
    const w = world(26);
    const a = carrier(w);
    const b = carrier(w, { hub: "ATL" });
    fund(w, a.id, 50_000);
    fund(w, b.id, 50_000);
    const ta = addTruck(w, a, "owned", "workhorse", "van");
    const tb = addTruck(w, b, "owned", "workhorse", "van");
    const s = poolOf(w, "driver")[0]!;
    expect(offerStaff(w, a, s, askingPay(w, s), ta.id)).toBeNull();
    s.offer = { companyId: 0, pay: 0, truckId: 0, day: 0 };
    expect(offerStaff(w, b, s, s.pay * 2, tb.id)).toContain("given notice");
  });
});

describe("crashes and loans", () => {
  it("a crash on the way to a pickup reopens the load and a totaled truck's loan is written off", () => {
    const w = world(27);
    const lender = carrier(w, { hub: "ATL" });
    fund(w, lender.id, 50_000);
    expect(applyAction(w, lender.id, { type: "deposit_finance", amountFd: 30_000 }).ok).toBe(true);
    const c = carrier(w, { freePath: false });
    fund(w, c.id, 20_000);
    const t = addTruck(w, c, "owned", "workhorse", "van");
    expect(applyAction(w, c.id, { type: "borrow", truckId: t.id, amountFd: 3_000 }).ok).toBe(true);
    const load = mkLoad(w, net.lanesFrom[t.hub]![0]!.dest, t.hub);
    load.status = "assigned";
    load.carrierId = c.id;
    load.truckId = t.id;
    t.loadId = load.id;
    t.status = "toPickup";
    t.targetHub = load.origin;
    t.remainingMi = 50;
    t.legMiles = 100;
    const insuredBefore = w.ledger.totals.get("faucet:cargo_insurance") ?? 0;
    // Worst case without wrongdoing: fatal, at fault, not willful.
    w.rng.safety.next = () => 0;
    crash(w, t, c);
    expect(load.status).toBe("open");
    expect(load.carrierId).toBeNull();
    expect(w.loads.has(load.id)).toBe(true);
    expect(w.ledger.totals.get("faucet:cargo_insurance") ?? 0).toBe(insuredBefore);
    expect(t.status).toBe("retired");
    expect(activeLoanOn(w, t.id)).toBeUndefined();
    expect(w.finance.outstandingFd).toBe(0);
    expect(c.authority.status).toBe("active");
    w.ledger.assertBalanced();
  });

  it("a truck sale has to cover the loan on it", () => {
    const w = world(28);
    const lender = carrier(w, { hub: "ATL" });
    fund(w, lender.id, 50_000);
    applyAction(w, lender.id, { type: "deposit_finance", amountFd: 30_000 });
    const c = carrier(w, { freePath: false });
    fund(w, c.id, 20_000);
    const t = addTruck(w, c, "owned", "workhorse", "van");
    expect(applyAction(w, c.id, { type: "borrow", truckId: t.id, amountFd: 3_000 }).ok).toBe(true);
    expect(applyAction(w, c.id, { type: "list_truck", truckId: t.id, askFd: 100, floorFd: 1, stepFd: 10 }).ok).toBe(false);
    expect(applyAction(w, c.id, { type: "list_truck", truckId: t.id, askFd: 10_000, floorFd: 5_000, stepFd: 500 }).ok).toBe(true);
  });
});

describe("costs that can't be dodged", () => {
  it("parking and unparking doesn't restart the idle-fee clock", () => {
    const w = world(29);
    const c = carrier(w, { freePath: false });
    fund(w, c.id, 20_000);
    const t = addTruck(w, c, "owned", "workhorse", "van");
    runDays(w, 6);
    expect(applyAction(w, c.id, { type: "park_truck", truckId: t.id }).ok).toBe(true);
    runDays(w, 1);
    expect(applyAction(w, c.id, { type: "unpark_truck", truckId: t.id }).ok).toBe(true);
    runDays(w, 2);
    expect(w.ledger.totals.get("sink:idle_fee") ?? 0).toBeGreaterThan(0);
  });

  it("paying another company isn't spending, so it can't pad working capital", () => {
    const w = world(30);
    const a = carrier(w, { freePath: false });
    const b = carrier(w, { hub: "ATL", freePath: false });
    fund(w, a.id, 200_000);
    const t = addTruck(w, b, "owned", "workhorse", "van");
    expect(applyAction(w, b.id, { type: "list_truck", truckId: t.id, askFd: 30_000, floorFd: 30_000, stepFd: 1 }).ok).toBe(true);
    const before = w.ledger.outflowCents(companyAccount(a.id));
    expect(applyAction(w, a.id, { type: "buy_listing", listingId: 1 }).ok).toBe(true);
    // Only the market fee (a sink) counts.
    expect(w.ledger.outflowCents(companyAccount(a.id)) - before).toBe(Math.round(30_000 * cfg.usedMarket.feePct * 100));
  });

  it("a wiped-out finance pool starts over instead of minting infinite shares", () => {
    const w = world(31);
    const a = carrier(w, { hub: "ATL" });
    fund(w, a.id, 10_000);
    applyAction(w, a.id, { type: "deposit_finance", amountFd: 6_000 });
    w.finance.outstandingFd = 0;
    w.ledger.post(w.t, "co:pool:equipment_finance", "sink:test", 6_000, "wipe");
    const b = carrier(w, { hub: "ATL" });
    fund(w, b.id, 10_000);
    const had = balance(w, b.id);
    expect(applyAction(w, b.id, { type: "deposit_finance", amountFd: 1_000 }).ok).toBe(true);
    expect(Number.isFinite(w.finance.totalShares)).toBe(true);
    expect(applyAction(w, b.id, { type: "withdraw_finance", amountFd: 1_000 }).ok).toBe(true);
    expect(balance(w, b.id)).toBeCloseTo(had, 6);
    w.ledger.assertBalanced();
  });
});

describe("data", () => {
  it("routes weigh stations along the great circle, the same both ways (the fallback when roads don't connect)", () => {
    const mia = hubs.find((h) => h.id === "MIA")!;
    const atl = hubs.find((h) => h.id === "ATL")!;
    const ids = stationsOnRoute(mia, atl, cfg.safety.enforcement.stationRadiusMi).map((s) => weighStations[s.station]!.id);
    expect(ids).toContain("FL-WLD");
    const back = stationsOnRoute(atl, mia, cfg.safety.enforcement.stationRadiusMi).map((s) => weighStations[s.station]!.id);
    expect([...back].sort()).toEqual([...ids].sort());
  });

  it("keeps dasin accurate at the edges and gives datan2 the right quadrants", () => {
    expect(dasin(1)).toBeCloseTo(Math.PI / 2, 15);
    expect(dasin(0.9999999)).toBeCloseTo(Math.asin(0.9999999), 12);
    expect(datan2(1, 0)).toBe(Math.PI / 2);
    expect(datan2(0, -1)).toBe(Math.PI);
    expect(datan2(-1, -1)).toBeCloseTo(-0.75 * Math.PI, 14);
    expect(datan2(0, 0)).toBe(0);
  });
});
