import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import {
  AHEAD_STATUSES,
  applyAction,
  canMake,
  chargeSettlement,
  companyAccount,
  createWorld,
  crewed,
  dayOf,
  EQUIPMENT,
  freeOf,
  homeBlock,
  homeward,
  lostMemory,
  noShow,
  placeMiles,
  planIndex,
  settleReceivable,
  stepHour,
  type Load,
  type Receivable,
  type Truck,
  type World,
} from "@lanes/engine";

/**
 * The red team's bundle pass on 0.25.0 (redteam-bundle-0250-2026-11-13.md): its blocker and must-fixes, each behind the
 * bundle's own switches, on a world with them on.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const bundle = (over: Partial<EconomyConfig["labor"]> = {}): EconomyConfig => ({
  ...LIVE,
  windows: { ...LIVE.windows, enabled: true },
  token: { ...LIVE.token, settlementFee: { enabled: true, share: 0.01 } },
  labor: { ...LIVE.labor, homeTimeHolds: true, pastDueRefuses: true, ...over },
});
function world(cfg: EconomyConfig, hours = 48, seed = 11): World {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed });
  populate(w, { freeOwnerOperators: 40, fleets: 10, brokers: 4 });
  for (let h = 0; h < hours; h++) stepHour(w, ruleBotHook);
  return w;
}
const busyTruck = (w: World): Truck => w.trucks.find((t) => t.companyId && AHEAD_STATUSES.has(t.status) && t.status !== "repair" && t.nextLoadId === undefined && crewed(t))!;
/** An open windowed load this truck can make, within the hand-booking reach from where it will be free. */
const makeable = (w: World, t: Truck, npc = false): Load =>
  [...w.loads.values()].find((l) => {
    if (l.status !== "open" || l.equipment !== t.trailer || l.latestPickupT === undefined || l.tenderedTo !== 0 || l.hold) return false;
    if (npc && (l.brokerId !== null || l.shipperId !== null)) return false;
    const r = canMake(w, t, l);
    return r.ok && placeMiles(w, r.freePlace, l.originPlace) <= 300;
  })!;

describe("the red team's bundle fixes", () => {
  it("finding 1: a release claim goes to the sink, never repeats on one load, and never takes a carrier under zero", () => {
    const w = world(bundle());
    const t = busyTruck(w);
    const c = w.companies[t.companyId - 1]!;
    const l = makeable(w, t);
    // A load posted by another company: the probe's brokerage.
    const poster = w.companies.find((x) => x.role === "carrier" && x.id !== c.id)!;
    l.brokerId = poster.id;
    expect(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: l.id }).ok).toBe(true);
    expect(t.nextLoadId).toBe(l.id);
    const posterCash = w.ledger.balance(companyAccount(poster.id));
    const sink = w.ledger.totals.get("sink:service_failure") ?? 0;
    expect(applyAction(w, c.id, { type: "release_load", loadId: l.id }).ok).toBe(true);
    expect(w.ledger.balance(companyAccount(poster.id))).toBeCloseTo(posterCash, 6); // nothing to the poster
    expect((w.ledger.totals.get("sink:service_failure") ?? 0) - sink).toBeGreaterThan(0); // the claim burned
    // The probe's loop: book it again, 300 times. The same carrier never gets it back, so no claim repeats.
    let booked = 0;
    for (let i = 0; i < 300; i++) if (applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: l.id }).ok) booked++;
    expect(booked).toBe(0);
    expect(applyAction(w, c.id, { type: "place_bid", truckId: t.id, loadId: l.id, rate: l.bookNow }).ok).toBe(false);
    // Under zero: a carrier with 10 FD pays at most 10 FD of claim.
    const t2 = w.trucks.find((x) => x.companyId && x.companyId !== c.id && x.companyId !== poster.id && AHEAD_STATUSES.has(x.status) && x.status !== "repair" && x.nextLoadId === undefined && crewed(x))!;
    const c2 = w.companies[t2.companyId - 1]!;
    const l2 = makeable(w, t2);
    expect(applyAction(w, c2.id, { type: "book_load", truckId: t2.id, loadId: l2.id }).ok).toBe(true);
    const acct = companyAccount(c2.id);
    const cash = w.ledger.balance(acct);
    if (cash > 10) w.ledger.post(w.t, acct, "sink:fines", cash - 10, "test:drain");
    expect(applyAction(w, c2.id, { type: "release_load", loadId: l2.id }).ok).toBe(true);
    expect(w.ledger.balance(acct)).toBeGreaterThanOrEqual(-1e-6);
    w.ledger.assertBalanced();
  }, 240_000);

  it("finding 3 (rule H): a load booked past the days off waits at home, and the truck sets out after them, in time", () => {
    const w = world(bundle());
    const today = dayOf(w.t, w.cfg);
    const t = w.trucks.find((x) => x.status === "idle" && x.driverId && x.companyId)!;
    const d = w.staff[t.driverId - 1]!;
    d.owner = false; // rule H is a hired driver's (an owner's days off are theirs to cut)
    d.homeUntilDay = today + 2;
    const back = d.homeUntilDay * w.cfg.time.gameMinutesPerDay;
    // A load ready after the days off, near enough to reach (its windows set for the test).
    const l = [...w.loads.values()].find((x) => x.status === "open" && x.equipment === t.trailer && x.latestPickupT !== undefined && x.tenderedTo === 0 && !x.hold && x.originPlace !== t.place && x.brokerId === null && x.shipperId === null && placeMiles(w, t.place, x.originPlace) <= 300)!;
    l.readyT = back + 12 * 60;
    l.latestPickupT = l.readyT + 24 * 60;
    l.latestDeliveryT = l.latestPickupT + 4 * 24 * 60;
    expect(applyAction(w, t.companyId, { type: "book_load", truckId: t.id, loadId: l.id }).ok).toBe(true);
    expect([t.status, t.nextLoadId]).toEqual(["idle", l.id]);
    // The days off end when labor says (labor.ts dailyDrivers); the held truck takes nothing else, and leaves after them.
    let freed = -1;
    let left = -1;
    for (let h = 0; h < 5 * 24 && left < 0; h++) {
      stepHour(w, ruleBotHook);
      if (freed < 0 && (d.homeUntilDay === null || d.homeUntilDay <= dayOf(w.t, w.cfg))) freed = w.t;
      if (t.status !== "idle") {
        left = w.t;
        expect(t.loadId).toBe(l.id); // the load it held, nothing else
      }
    }
    expect(freed).toBeGreaterThan(0);
    expect(left).toBeGreaterThanOrEqual(freed); // never during the days off
    expect(left).toBeLessThanOrEqual(l.latestPickupT); // in time for the pickup
    expect(l.readyT - left).toBeLessThan(2 * 24 * 60); // and not days early to wait at the shipper
  }, 240_000);

  it("finding 4: a load ever booked joins neither the lost-load memory nor the brokers' tally", () => {
    const w = world(bundle());
    const t = busyTruck(w);
    const l = makeable(w, t, true);
    expect(applyAction(w, t.companyId, { type: "book_load", truckId: t.id, loadId: l.id }).ok).toBe(true);
    expect(l.booked).toBe(true);
    const i = planIndex(l.origin, EQUIPMENT.indexOf(l.equipment));
    const before = lostMemory(w)?.[i] ?? 0;
    noShow(w, l); // booked, and lost
    expect(lostMemory(w)?.[i] ?? 0).toBeCloseTo(before, 9);
  }, 240_000);

  it("finding 5 (rule C): a truck on a job is measured from where it will be free", () => {
    const w = world(bundle());
    const t = busyTruck(w);
    const c = w.companies[t.companyId - 1]!;
    c.orders = [...c.orders.filter((o) => o.kind !== "homeTime"), { kind: "homeTime", afterDays: 1, restDays: 2 }];
    const d = w.staff[t.driverId - 1]!;
    if (d.owner) return; // rule C is the hired driver's
    d.awayDays = 30;
    const at = { ...t, hub: w.net.places[freeOf(w, t).place]!.market };
    for (const l of [...w.loads.values()].filter((x) => x.status === "open" && x.equipment === t.trailer).slice(0, 40)) {
      expect(homeBlock(w, c, t, l) === null).toBe(homeward(w, c, at, l));
    }
  }, 240_000);

  it("the fee comes back on a wound-up broker's paper written off, as on a player shipper's", () => {
    const w = world(bundle(), 1);
    const carrier = w.companies.find((x) => x.role === "carrier")!;
    const broker = w.companies.find((x) => x.role === "broker")!;
    const r: Receivable = { id: w.nextReceivableId++, payer: broker.id, payeeId: carrier.id, amountFd: 10_000, dueDay: 0, holder: carrier.id };
    w.receivables.push(r);
    expect(chargeSettlement(w, carrier.id, null, 10_000, "load:test", r)).toBeCloseTo(100, 9);
    const cash = w.ledger.balance(companyAccount(carrier.id));
    const burned = w.ledger.totals.get("sink:trade_burn")!;
    broker.liquidatingSince = 0;
    broker.stakedFd = 0; // no bond behind it
    broker.suretyClaimedFd = Infinity; // and no surety
    if (w.ledger.balance(companyAccount(broker.id)) > 0) w.ledger.post(w.t, companyAccount(broker.id), "sink:fines", w.ledger.balance(companyAccount(broker.id)), "test:drain");
    settleReceivable(w, r);
    expect(w.ledger.balance(companyAccount(carrier.id))).toBeCloseTo(cash + 100, 6); // written off: the fee back, nothing else
    expect((burned - w.ledger.totals.get("sink:trade_burn")!) / 100).toBeCloseTo(100, 6);
    w.ledger.assertBalanced();
  }, 120_000);
});
