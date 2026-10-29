import { describe, expect, it } from "vitest";
import { economyConfig as cfg, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds, syntheticCassCycle, PLACE_OF_HUB } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import {
  addTruck,
  applyAction,
  breakdownsPer1000Mi,
  breakEvenPerMile,
  buildReport,
  closeSeason,
  companyAccount,
  condition,
  createWorld,
  effectiveMpg,
  formCompany,
  fscPerMile,
  inCloseWindow,
  Ledger,
  liveGameMinutes,
  planFreight,
  hubDemandPerRound,
  ladderFactor,
  marketValue,
  newPrice,
  rebuildCost,
  poolCash,
  deliveryDays,
  chargeHoldingCost,
  runBoardRound,
  clearBuyback,
  launchToken,
  fdPriceUsd,
  sellableFd,
  weeklyToken,
  EXCHANGE_ACCOUNT,
  EQUIPMENT,
  fleetOverheadPerWeek,
  marginalOverhead,
  planIndex,
  runDays,
  scoreBid,
  seasonality,
  reloadFactor,
  expectedReloadDeadheadMi,
  tripCost,
  type Load,
  type TruckSpec,
  type World,
} from "@lanes/engine";

const net = buildNetwork(hubs, cfg);
/** Same economy with breakdowns switched off, for tests that time trips exactly. */
const calm: EconomyConfig = { ...cfg, breakdowns: { ...cfg.breakdowns, per1000MiNew: 0 } };
const NEW_WORKHORSE: TruckSpec = { tier: "workhorse", trailer: "van", lease: "owned", odometer: 0, milesSinceRebuild: 0 };

/** Grants a company FD for a test, as a faucet so the ledger stays balanced. */
function fund(w: World, companyId: number, fd: number): void {
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(companyId), fd, "test");
}

function carrier(w: World, name = "Test Carrier", freePath = false) {
  return formCompany(w, { name, role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath });
}

function testLoad(w: World, lane: { id: number; origin: number; dest: number; miles: number }): Load {
  return {
    id: w.nextLoadId++, laneId: lane.id, origin: lane.origin, dest: lane.dest, miles: lane.miles, equipment: "van",
    brokerId: null, shipperId: null, facilityId: null, saleValue: 0, shipperRate: 10, spotShipperRate: 10, refRate: 10, ceiling: 10, bookNow: 10,
    postedRound: -1, roundsUnfilled: 0, status: "open", carrierId: null, truckId: null, clearedRate: 0, dueT: 0,
    hot: 0, vet: 0, cargoValue: 0, doubleBroker: null,
    commodity: 0, originPlace: PLACE_OF_HUB[lane.origin]!, destPlace: PLACE_OF_HUB[lane.dest]!, appointmentT: 1e12, routeHours: lane.miles / 50, routeTollFd: 0,
  };
}

function smallWorld(seed: number, keepLedgerEntries = false) {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed, keepLedgerEntries });
  populate(w, { freeOwnerOperators: 120, fleets: 20, brokers: 8 });
  return w;
}

describe("network", () => {
  it("seeds about 60 hubs with the 10 starters first", () => {
    expect(hubs.length).toBe(60);
    expect(hubs.slice(0, 10).every((h) => h.isStarter)).toBe(true);
    expect(net.starterIdx).toHaveLength(10);
  });

  it("keeps every lane within 1,500 miles", () => {
    expect(net.lanes.length).toBeGreaterThan(1000);
    expect(Math.max(...net.lanes.map((l) => l.miles))).toBeLessThanOrEqual(cfg.map.maxLaneMiles);
  });
});

describe("ledger", () => {
  it("balances and classifies faucets, sinks and transfers", () => {
    const l = new Ledger(true);
    l.post(0, "faucet:npc_shipper", "co:1", 3000, "a");
    l.post(0, "co:1", "co:2", 1000.5, "b");
    l.post(0, "co:2", "sink:fuel", 708.25, "c");
    l.assertBalanced();
    expect(l.entries.map((e) => e.kind)).toEqual(["faucet", "transfer", "sink"]);
    expect(l.supply()).toBeCloseTo(3000 - 708.25, 6);
  });

  it("rejects reversed entries", () => {
    const l = new Ledger(false);
    expect(() => l.post(0, "co:1", "faucet:npc_shipper", 1, "x")).toThrow();
    expect(() => l.post(0, "sink:fuel", "co:1", 1, "x")).toThrow();
  });
});

describe("spec formulas", () => {
  it("reproduces the worked example (1,000 loaded mi, 150 deadhead, fuel at base)", () => {
    const c = tripCost(cfg, NEW_WORKHORSE, 4.0, 1150, 1000);
    expect(c.fuel).toBeCloseTo(707.7, 1);
    expect(c.wages).toBeCloseTo(862.5, 1);
    expect(c.insurance).toBeCloseTo(80, 6);
    // Spec rounds maintenance to the tractor's 0.15/mi; the dry van adds 0.03/mi.
    expect(1150 * cfg.tractors.workhorse.maintPerMile).toBeCloseTo(172.5, 1);
  });

  it("FSC passes 80% of a fuel move: +0.40 fuel → ~49 FD on 1,000 mi", () => {
    expect(fscPerMile(cfg, 4.4) * 1000).toBeCloseTo(49.2, 1);
  });

  it("break-even for a free lease on that trip sits below the ~3.00 ceiling", () => {
    const be = breakEvenPerMile(cfg, { ...NEW_WORKHORSE, lease: "npc" }, 4.0, 1000, 150);
    expect(be).toBeGreaterThan(2);
    expect(be).toBeLessThan(2.6);
  });

  it("scores cheaper, closer, more reputable bids higher", () => {
    const w = smallWorld(1);
    expect(scoreBid(w, 3, 2.7, 0.5, 0)).toBeGreaterThan(scoreBid(w, 3, 2.9, 0.5, 0));
    expect(scoreBid(w, 3, 2.7, 0.5, 20)).toBeGreaterThan(scoreBid(w, 3, 2.7, 0.5, 120));
    expect(scoreBid(w, 3, 2.7, 0.9, 50)).toBeGreaterThan(scoreBid(w, 3, 2.7, 0.2, 50));
  });

  it("follows each region's own season: Miami produce peaks in late spring, then goes dead; Georgia peaks later", () => {
    const w = smallWorld(1);
    const hub = (id: string) => w.net.hubs.findIndex((h) => h.id === id);
    const mia = hub("MIA");
    const sav = hub("SAV");
    const rate = (i: number, eq: "van" | "reefer" | "flatbed", day: number) => seasonality(w, i, eq, day).rate;
    // Slow build through winter, a frenzy in late May, dead from August through October.
    expect(rate(mia, "reefer", 20)).toBeLessThan(1.02);
    expect(rate(mia, "reefer", 75)).toBeLessThan(rate(mia, "reefer", 115));
    expect(rate(mia, "reefer", 145)).toBeGreaterThan(1.15);
    expect(rate(mia, "reefer", 270)).toBeLessThan(0.9);
    expect(seasonality(w, mia, "reefer", 145).volume).toBeGreaterThan(seasonality(w, mia, "reefer", 270).volume * 1.5);
    // Georgia's peak comes after Miami's: in July Savannah is still hot while Miami is falling.
    expect(rate(sav, "reefer", 190) - rate(mia, "reefer", 190)).toBeGreaterThan(0.05);
    // Dry van rises with the produce season too, by less; flatbed follows van.
    expect(rate(mia, "van", 145)).toBeGreaterThan(1.05);
    expect(rate(mia, "van", 145)).toBeLessThan(rate(mia, "reefer", 145));
    expect(rate(mia, "flatbed", 145)).toBeGreaterThan(1);
    // Late December slows freight everywhere.
    expect(seasonality(w, mia, "van", 360).volume).toBeLessThan(seasonality(w, mia, "van", 345).volume);
  });

  it("prices destinations: freight into a slack market pays more, and dispatchers price in the empty run out", () => {
    const w = smallWorld(1);
    // Hub 0's vans pile up; hub 1's van market is tight; the national van average sits at 1.
    w.reloadIndex[planIndex(0, 0)] = 0.5;
    w.reloadIndex[planIndex(1, 0)] = 2;
    w.reloadMean[0] = 1;
    w.net.hubs[0]!.imbalance.van = 1;
    w.net.hubs[1]!.imbalance.van = 1;
    expect(reloadFactor(w, 0, "van")).toBeGreaterThan(1.1);
    expect(reloadFactor(w, 1, "van")).toBeLessThan(0.9);
    expect(expectedReloadDeadheadMi(w, 0, "van")).toBeGreaterThan(expectedReloadDeadheadMi(w, 1, "van") * 3);
  });

  it("maps live time at 6 real hours per in-game day", () => {
    expect(liveGameMinutes(6 * 3_600_000, 0, cfg)).toBe(1440);
  });
});

describe("hours of service and dock time", () => {
  /** One truck, one long haul it is sure to win; returns what happened hour by hour. */
  function longHaul(seed: number) {
    const w = createWorld({ cfg: calm, net, feeds: neutralFeeds, seed });
    const co = formCompany(w, {
      name: "Solo",
      role: "carrier",
      homeHubId: "DAL",
      strategy: "test",
      orders: [{ kind: "bid", maxDeadheadMi: 0, price: { mode: "ceilingPct", pct: 1 } }],
      freePath: true,
      ownerSkill: 0.5, // a typical driver: exactly 50 mph
    });
    const truck = w.trucksByCompany.get(co.id)![0]!;
    const lane = net.lanesFrom[truck.hub]!.reduce((a, b) => (b.miles > a.miles ? b : a));
    const load = testLoad(w, lane);
    w.loads.set(load.id, load);
    runDays(w, 6 / 24); // to the 06:00 round
    expect(truck.status).toBe("loading");
    const loadId = truck.loadId;
    const assignedT = w.t;
    const milesByDutyDay = new Map<number, number>();
    const statuses = new Set<string>();
    let driven = 0;
    for (let h = 0; h < 24 * 6 && truck.loadId === loadId; h++) {
      const before = truck.emptyMi + truck.loadedMi;
      runDays(w, 1 / 24);
      statuses.add(truck.status);
      // On delivery the truck may win its next load within the same hour; stop at ours.
      const delivered = truck.loadId !== loadId;
      const delta = delivered ? lane.miles - driven : truck.emptyMi + truck.loadedMi - before;
      driven += delta;
      if (truck.shiftStartT === null) continue; // still at the dock, no duty day opened yet
      const day = truck.shiftStartT;
      milesByDutyDay.set(day, (milesByDutyDay.get(day) ?? 0) + delta);
    }
    return { w, truck, lane, assignedT, deliveredT: w.t, milesByDutyDay: [...milesByDutyDay.values()], statuses };
  }

  it("drives a full duty day's miles at the road's pace and never more", () => {
    const { lane, milesByDutyDay, truck } = longHaul(11);
    expect(lane.miles).toBeGreaterThan(1100);
    expect(truck.status).toBe("idle");
    // 11 hours at the fastest road (an interstate) is the most a day can hold; a full day is at least 11 hours at the slowest.
    for (const m of milesByDutyDay) expect(m).toBeLessThanOrEqual(cfg.hos.drivingHoursPerDay * cfg.roads.routing.mph[0] + 1e-6);
    for (const m of milesByDutyDay.slice(0, -1)) expect(m).toBeGreaterThanOrEqual(cfg.hos.drivingHoursPerDay * cfg.roads.routing.mph[1] * 0.9);
  });

  it("adds 1–2 hours loading and 1–2 hours unloading to the trip", () => {
    const { lane, assignedT, deliveredT, milesByDutyDay, statuses } = longHaul(12);
    expect(statuses.has("loaded")).toBe(true);
    expect(statuses.has("unloading")).toBe(true);
    const drivingMin = (lane.miles / cfg.hos.avgMph) * 60;
    const restMin = (milesByDutyDay.length - 1) * (24 - cfg.hos.drivingHoursPerDay) * 60;
    const elapsed = deliveredT - assignedT;
    // Hour-granular stepping can add up to an hour at delivery.
    expect(elapsed).toBeGreaterThanOrEqual(drivingMin + 120);
    expect(elapsed).toBeLessThanOrEqual(drivingMin + restMin + 240 + 60);
  });
});

describe("simulation", () => {
  it("is deterministic: same seed + config → identical results", () => {
    const a = smallWorld(42);
    const b = smallWorld(42);
    runDays(a, 20, ruleBotHook);
    runDays(b, 20, ruleBotHook);
    expect(JSON.stringify(a.metrics.days)).toBe(JSON.stringify(b.metrics.days));
    expect(a.companies.map((c) => c.milesTotal)).toEqual(b.companies.map((c) => c.milesTotal));
  });

  it("diverges with a different seed", () => {
    const a = smallWorld(1);
    const b = smallWorld(2);
    runDays(a, 10, ruleBotHook);
    runDays(b, 10, ruleBotHook);
    expect(JSON.stringify(a.metrics.days)).not.toBe(JSON.stringify(b.metrics.days));
  });

  it("keeps the ledger balanced every tick and moves freight", () => {
    const w = smallWorld(7, true);
    runDays(w, 30, ruleBotHook); // stepHour asserts balance after every tick
    const days = w.metrics.days;
    expect(days).toHaveLength(30);
    expect(days.reduce((s, d) => s + d.delivered, 0)).toBeGreaterThan(500);
    expect(w.ledger.entries.every((e) => e.amount > 0)).toBe(true);
    // Every FD created came from a faucet entry and every FD destroyed went to a sink.
    const faucets = w.ledger.entries.filter((e) => e.kind === "faucet").reduce((s, e) => s + e.amount, 0);
    const sinks = w.ledger.entries.filter((e) => e.kind === "sink").reduce((s, e) => s + e.amount, 0);
    expect(w.ledger.supply()).toBeCloseTo(faucets - sinks, 2);
  });

  it("never lets a truck drive past its company's hours limit in a duty day", () => {
    const w = smallWorld(3);
    for (let h = 0; h < 24 * 5; h++) {
      runDays(w, 1 / 24, ruleBotHook);
      for (const t of w.trucks) {
        if (t.companyId === 0) continue;
        const c = w.companies[t.companyId - 1]!;
        // Legal: 11 hours solo, 22 for a team; a company running over hours gets 4 more.
        const limit = (t.coDriverId ? cfg.safety.hos.teamHours : cfg.hos.drivingHoursPerDay) + (c.policy.hos === "legal" || t.coDriverId ? 0 : cfg.safety.hos.overHours);
        expect(t.shiftDrivenMin).toBeLessThanOrEqual(limit * 60 + 1e-6);
      }
    }
  });

  it("produces a report with every kill-criteria metric", () => {
    const w = smallWorld(5);
    // Long enough for the six-month warm-up the supply check skips and the strategy table's minimum age.
    runDays(w, 200, ruleBotHook);
    const r = buildReport(w);
    expect(r.quarters).toHaveLength(2);
    expect(r.supply.fromGrants).toBeGreaterThan(0);
    expect(r.supply.afterWarmup).toBeGreaterThan(0);
    expect(r.supply.yearOverYear).toBeNull(); // one partial season
    expect(r.strategies.length).toBeGreaterThan(0);
    expect(r.freePath.companies).toBe(120);
  });
});

describe("truck wear and rebuilds", () => {
  it("wears owned trucks with miles; the NPC lessor keeps leased trucks serviced", () => {
    const worn = { ...NEW_WORKHORSE, milesSinceRebuild: 100_000 };
    expect(condition(cfg, NEW_WORKHORSE)).toBe(1);
    expect(condition(cfg, worn)).toBeCloseTo(0.5, 6);
    expect(condition(cfg, { ...worn, milesSinceRebuild: 1e9 })).toBe(0);
    expect(condition(cfg, { ...worn, lease: "npc" })).toBe(cfg.wear.npcLeaseCondition);
  });

  it("makes a worn truck burn more fuel, cost more to maintain, break down more and need a higher rate", () => {
    const worn = { ...NEW_WORKHORSE, milesSinceRebuild: 160_000 };
    expect(effectiveMpg(cfg, worn)).toBeLessThan(effectiveMpg(cfg, NEW_WORKHORSE));
    const fresh = tripCost(cfg, NEW_WORKHORSE, 4, 1000, 1000);
    const tired = tripCost(cfg, worn, 4, 1000, 1000);
    expect(tired.fuel).toBeGreaterThan(fresh.fuel);
    expect(tired.maintenance).toBeGreaterThan(fresh.maintenance);
    expect(breakdownsPer1000Mi(cfg, worn)).toBeGreaterThan(3 * breakdownsPer1000Mi(cfg, NEW_WORKHORSE));
    expect(breakEvenPerMile(cfg, worn, 4, 1000, 100)).toBeGreaterThan(breakEvenPerMile(cfg, NEW_WORKHORSE, 4, 1000, 100) * 1.08);
  });

  it("gives million-mile trucks their fuel bonus: +1% per 5 levels, capped at +4%", () => {
    const veteran = { ...NEW_WORKHORSE, odometer: 1_000_000 };
    expect(effectiveMpg(cfg, veteran) / effectiveMpg(cfg, NEW_WORKHORSE)).toBeCloseTo(1.04, 6);
    expect(effectiveMpg(cfg, { ...NEW_WORKHORSE, odometer: 260_000 }) / effectiveMpg(cfg, NEW_WORKHORSE)).toBeCloseTo(1.01, 6);
  });

  it("rebuilds for FD, takes the truck off the road for two days and restores condition", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 1, keepLedgerEntries: true });
    const co = carrier(w);
    const truck = addTruck(w, co, "owned", "workhorse", "van", false, { odometer: 300_000, milesSinceRebuild: 90_000, builtDay: -700 });
    fund(w, co.id, 20_000);
    const before = w.ledger.balance(companyAccount(co.id));
    expect(applyAction(w, co.id, { type: "rebuild_truck", truckId: truck.id })).toEqual({ ok: true });
    // An old truck costs more to restore: ×1.6 at 300k miles.
    expect(w.ledger.balance(companyAccount(co.id))).toBeCloseTo(before - cfg.wear.rebuildFd.workhorse * 1.6, 2);
    expect(w.ledger.entries.at(-1)).toMatchObject({ to: "sink:rebuild", kind: "sink" });
    expect(truck.status).toBe("repair");
    expect(condition(cfg, truck)).toBe(1);
    runDays(w, 1);
    expect(truck.status).toBe("repair");
    runDays(w, 1.05);
    expect(truck.status).toBe("idle");
    // A nearly-new truck can't be rebuilt, so FD can't be parked in fresh condition.
    expect(applyAction(w, co.id, { type: "rebuild_truck", truckId: truck.id }).ok).toBe(false);
  });

  it("bills owners for breakdowns and delays the trip", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 4, keepLedgerEntries: true });
    populate(w, { freeOwnerOperators: 40, fleets: 20, brokers: 4 });
    runDays(w, 30, ruleBotHook);
    const bills = w.ledger.entries.filter((e) => e.to === "sink:repairs" && e.ref.startsWith("breakdown:"));
    expect(w.metrics.days.reduce((s, d) => s + d.breakdowns, 0)).toBeGreaterThan(bills.length); // leased trucks: delay, no bill
    expect(bills.length).toBeGreaterThan(0);
    for (const b of bills) {
      expect(b.amount).toBeGreaterThanOrEqual(cfg.breakdowns.repairFd[0]);
      expect(b.amount).toBeLessThanOrEqual(cfg.breakdowns.repairFd[1]);
    }
  });
});

describe("facilities", () => {
  it("are bought for FD, pay weekly upkeep and originate freight at their hub", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 2, keepLedgerEntries: true });
    const co = carrier(w);
    fund(w, co.id, 200_000);
    expect(applyAction(w, co.id, { type: "buy_facility", facility: "factory", hubId: "CHI" })).toEqual({ ok: true });
    expect(w.facilitySupply.factory).toBe(cfg.facilities.types.factory.pocCap - 1);
    const f = w.facilities[0]!;
    expect(net.hubs[f.hub]!.id).toBe("CHI");
    runDays(w, 7);
    const upkeep = w.ledger.entries.filter((e) => e.to === "sink:facility_upkeep");
    expect(upkeep).toHaveLength(1);
    expect(upkeep[0]!.amount).toBe(cfg.facilities.types.factory.upkeepPerWeekFd);
    // With no trucks in this world its freight rolls, then goes to the expediter at the owner's cost.
    expect(w.metrics.days.reduce((s, d) => s + d.facilityPosted, 0)).toBeGreaterThan(10);
    expect(w.ledger.entries.some((e) => e.to === "sink:npc_expediter")).toBe(true);
    expect(w.ledger.entries.some((e) => e.from === "faucet:npc_market")).toBe(true);
  });

  it("take freight out of the hub's demand, never more than 60% of it", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 3 });
    const co = carrier(w);
    fund(w, co.id, 2_000_000);
    for (let k = 0; k < 6; k++) applyAction(w, co.id, { type: "buy_facility", facility: "warehouse", hubId: "MCO" });
    const hub = net.hubs.findIndex((h) => h.id === "MCO");
    const plan = planFreight(w, 0);
    const demand = hubDemandPerRound(w, hub, "van", 0);
    const player = [...plan.facilityExpected].reduce((a, b) => a + b, 0);
    expect(player).toBeCloseTo(cfg.facilities.maxPlayerShareOfHub * demand, 6); // six warehouses overfill Orlando's van demand
    expect(plan.npcExpected[planIndex(hub, EQUIPMENT.indexOf("van"))]! + player).toBeCloseTo(demand, 6);
    // A seventh facility is over the company cap.
    expect(applyAction(w, co.id, { type: "buy_facility", facility: "warehouse", hubId: "ATL" }).ok).toBe(false);
  });

  it("pay the shipper the sale value and the carrier its rate on delivery", () => {
    const w = createWorld({ cfg: calm, net, feeds: neutralFeeds, seed: 5, keepLedgerEntries: true });
    const shipper = carrier(w, "Shipper");
    fund(w, shipper.id, 200_000);
    applyAction(w, shipper.id, { type: "buy_facility", facility: "warehouse", hubId: "DAL" });
    const hauler = carrier(w, "Hauler");
    for (let k = 0; k < 6; k++) addTruck(w, hauler, "owned", "workhorse", "van");
    // Dallas freight only, and straight back to Dallas after each delivery, so the trucks keep meeting the facility's loads.
    applyAction(w, hauler.id, {
      type: "set_standing_orders",
      orders: [
        { kind: "bid", maxDeadheadMi: 0, originHubs: ["DAL"], price: { mode: "ceilingPct", pct: 1 } },
        { kind: "reposition", afterIdleRounds: 1, to: { hubId: "DAL" } },
      ],
    });
    runDays(w, 10);
    const sales = w.ledger.entries.filter((e) => e.from === "faucet:npc_market" && e.to === companyAccount(shipper.id));
    const paid = w.ledger.entries.filter((e) => e.from === companyAccount(shipper.id) && e.to === companyAccount(hauler.id));
    expect(paid.length).toBeGreaterThan(0);
    expect(sales.length).toBeGreaterThanOrEqual(paid.length);
    expect(shipper.milesTotal).toBeGreaterThan(0); // shipper Miles: 0.15 × load miles
  });
});

describe("season close", () => {
  it("keeps 10% of each balance, capped at 25,000 FD, and burns the rest", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 6, keepLedgerEntries: true });
    const rich = carrier(w, "Rich");
    const modest = carrier(w, "Modest");
    fund(w, rich.id, 1_000_000 - w.ledger.balance(companyAccount(rich.id)));
    fund(w, modest.id, 40_000 - w.ledger.balance(companyAccount(modest.id)));
    rich.milesTotal = 1234;
    rich.delivered = 100;
    rich.onTime = 100;
    const record = closeSeason(w, 0, 364);
    const renewal = cfg.permits.carrierAuthorityFd;
    expect(w.ledger.balance(companyAccount(rich.id))).toBeCloseTo(25_000 - renewal, 2);
    expect(w.ledger.balance(companyAccount(modest.id))).toBeCloseTo(4_000 - renewal, 2);
    expect(record.burnedFd).toBeCloseTo(975_000 + 36_000, 0);
    expect(record.companiesAtCap).toBe(1);
    expect(w.ledger.entries.filter((e) => e.to === "sink:season_close")).toHaveLength(2);
    // Miles are snapshotted and reset; the reputation record decays 30%.
    expect(rich.milesHistory).toEqual([1234]);
    expect(rich.milesTotal).toBe(0);
    expect(rich.delivered).toBeCloseTo(70, 6);
  });

  it("locks permanent purchases in the last 30 days", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 7 });
    const co = carrier(w, "Late Buyer", true);
    fund(w, co.id, 500_000);
    w.t = 340 * cfg.time.gameMinutesPerDay;
    expect(inCloseWindow(w)).toBe(true);
    expect(applyAction(w, co.id, { type: "buy_facility", facility: "warehouse", hubId: "DAL" }).ok).toBe(false);
    expect(applyAction(w, co.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: true }).ok).toBe(false);
    w.t = 300 * cfg.time.gameMinutesPerDay;
    expect(applyAction(w, co.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: true }).ok).toBe(true);
  });

  it("runs across a season boundary with the ledger balanced and the burn kept out of operating sinks", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 8 });
    populate(w, { freeOwnerOperators: 20, fleets: 6, brokers: 2 });
    runDays(w, 365, ruleBotHook); // stepHour asserts the ledger balances every tick
    expect(w.seasonCloses).toHaveLength(1);
    const renewal = Math.min(cfg.permits.carrierAuthorityFd, cfg.permits.brokerLicenseRenewalFd);
    for (const c of w.companies) {
      const keepUpTo = Math.max(cfg.seasonClose.carryoverCapFd, c.weeklySpend.reduce((a, b) => a + b, 0));
      expect(w.ledger.balance(companyAccount(c.id))).toBeLessThanOrEqual(keepUpTo - renewal + 1e-6);
    }
    runDays(w, 5, ruleBotHook);
    const close = w.metrics.days[364]!;
    expect(close.burnFd).toBeCloseTo(w.seasonCloses[0]!.burnedFd, 0);
    expect(close.sinkByTag.season_close).toBeUndefined();
    expect(w.metrics.days[365]!.season).toBe(1);
    const r = buildReport(w);
    expect(r.seasons[0]!.ratioWithBurn).toBeGreaterThan(r.seasons[0]!.sinkFaucetRatio);
  });
});

describe("fleet overhead", () => {
  it("leaves the first three trucks free and charges each later truck its bracket", () => {
    expect(fleetOverheadPerWeek(cfg, 1)).toBe(0);
    expect(fleetOverheadPerWeek(cfg, 3)).toBe(0);
    expect(fleetOverheadPerWeek(cfg, 5)).toBe(2 * 210);
    expect(fleetOverheadPerWeek(cfg, 10)).toBe(2 * 210 + 5 * 410);
    expect(fleetOverheadPerWeek(cfg, 30)).toBe(2 * 210 + 5 * 410 + 10 * 560 + 10 * 660);
    expect(marginalOverhead(cfg, 3)).toBe(210);
    expect(marginalOverhead(cfg, 20)).toBe(660);
  });

  it("is charged weekly on operating trucks only: parking a truck takes it off the bill", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 9, keepLedgerEntries: true });
    const fleet = carrier(w, "Fleet");
    const solo = carrier(w, "Solo", true);
    for (let k = 0; k < 6; k++) addTruck(w, fleet, "owned", "workhorse", "van");
    fund(w, fleet.id, 100_000);
    runDays(w, 7);
    const bills = () => w.ledger.entries.filter((e) => e.to === "sink:fleet_overhead");
    expect(bills()).toHaveLength(1); // the one-truck owner-operator pays nothing
    expect(bills()[0]).toMatchObject({ from: companyAccount(fleet.id), amount: fleetOverheadPerWeek(cfg, 6) });
    expect(applyAction(w, fleet.id, { type: "park_truck", truckId: w.trucksByCompany.get(fleet.id)![5]!.id })).toEqual({ ok: true });
    runDays(w, 7);
    expect(bills()[1]!.amount).toBe(fleetOverheadPerWeek(cfg, 5));
    expect(fleet.truckWeeks).toBe(6 + 5);
    expect(solo.overheadPaidFd).toBe(0);
  });

  it("keeps parked trucks off the road and out of the Miles ladder, and lets them come back", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 10 });
    const fleet = carrier(w, "Fleet");
    const [a, b] = [addTruck(w, fleet, "owned", "workhorse", "van"), addTruck(w, fleet, "owned", "workhorse", "van")];
    expect(ladderFactor(w, b)).toBe(0.9);
    applyAction(w, fleet.id, { type: "park_truck", truckId: a.id });
    expect(a.status).toBe("parked");
    expect(ladderFactor(w, b)).toBe(1.0);
    runDays(w, 2);
    expect(a.status).toBe("parked");
    expect(applyAction(w, fleet.id, { type: "unpark_truck", truckId: a.id })).toEqual({ ok: true });
    expect(a.status).toBe("idle");
  });
});

describe("freight cycle", () => {
  it("replays the same demand dial for a seed and swings it both ways", () => {
    const a = syntheticCassCycle({ seed: 3 });
    const b = syntheticCassCycle({ seed: 3 });
    const series = Array.from({ length: 600 }, (_, d) => a(d));
    expect(Array.from({ length: 600 }, (_, d) => b(d))).toEqual(series);
    expect(Math.max(...series)).toBeGreaterThan(1.15);
    expect(Math.min(...series)).toBeLessThan(0.85);
    for (const v of series) expect(v).toBeGreaterThanOrEqual(0.5);
  });

  it("depreciates trucks by mileage, age and wear, and charges more to rebuild old ones", () => {
    const fresh = { ...NEW_WORKHORSE, builtDay: 0 };
    const old = { ...NEW_WORKHORSE, odometer: 500_000, builtDay: -3 * 365 };
    expect(marketValue(cfg, fresh, 0)).toBeCloseTo(newPrice(cfg, fresh), 6);
    expect(marketValue(cfg, old, 0)).toBeCloseTo(newPrice(cfg, old) * 0.35, 6);
    expect(marketValue(cfg, { ...old, milesSinceRebuild: 200_000 }, 0)).toBeCloseTo(newPrice(cfg, old) * 0.35 * 0.6, 6);
    expect(rebuildCost(cfg, old)).toBeCloseTo(2 * rebuildCost(cfg, fresh), 6);
  });

  it("delivers dealer trucks after the lead time, which grows with the national backlog", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 11 });
    const co = carrier(w);
    addTruck(w, co, "owned", "workhorse", "van");
    fund(w, co.id, 200_000);
    expect(deliveryDays(w)).toBe(cfg.dealerDelivery.baseDays);
    expect(applyAction(w, co.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false })).toEqual({ ok: true });
    expect(co.firstOwnedTruckDay).toBe(0);
    for (let k = 0; k < 7; k++) applyAction(w, co.id, { type: "buy_asset", tier: "workhorse", trailer: "reefer", replaceNpcLease: false });
    expect(deliveryDays(w)).toBe(cfg.dealerDelivery.baseDays + 2); // 8 on order × 0.25 days
    // Each order's wait reflects the backlog when it was placed.
    const dueByBase = w.orders.filter((o) => o.dueDay <= cfg.dealerDelivery.baseDays).length;
    expect(dueByBase).toBeGreaterThanOrEqual(1);
    expect(dueByBase).toBeLessThan(8);
    runDays(w, cfg.dealerDelivery.baseDays - 1);
    expect(w.trucksByCompany.get(co.id)!).toHaveLength(1);
    runDays(w, 1);
    expect(w.trucksByCompany.get(co.id)!).toHaveLength(1 + dueByBase);
    runDays(w, 2);
    expect(w.trucksByCompany.get(co.id)!).toHaveLength(9);
  });

  it("sells used trucks for 95% to the seller and a 5% fee, and lets an owner-operator start on one", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 12, keepLedgerEntries: true });
    const seller = carrier(w, "Seller");
    const truck = addTruck(w, seller, "owned", "workhorse", "van", false, { odometer: 400_000, milesSinceRebuild: 50_000, builtDay: -800 });
    const oo = carrier(w, "OO", true);
    fund(w, oo.id, 20_000);
    expect(applyAction(w, seller.id, { type: "list_truck", truckId: truck.id, askFd: 6_000, floorFd: 4_000, stepFd: 500 })).toEqual({ ok: true });
    const sellerBefore = w.ledger.balance(companyAccount(seller.id));
    expect(applyAction(w, oo.id, { type: "buy_listing", listingId: 1 })).toEqual({ ok: true });
    expect(w.ledger.balance(companyAccount(seller.id)) - sellerBefore).toBeCloseTo(5_700, 2);
    expect(w.ledger.entries.find((e) => e.to === "sink:market_fee")!.amount).toBeCloseTo(300, 2);
    const fleet = w.trucksByCompany.get(oo.id)!;
    expect(fleet).toEqual([truck]); // the NPC lease went back to the lessor
    expect(oo.firstOwnedTruckDay).toBe(0);
    expect(w.trucksByCompany.get(seller.id)!).toHaveLength(0);
  });

  it("lends from depositors, repossesses after two missed payments and sells the truck", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 13, keepLedgerEntries: true });
    const saver = carrier(w, "Saver");
    const borrower = carrier(w, "Borrower");
    const buyer = carrier(w, "Buyer");
    addTruck(w, buyer, "owned", "workhorse", "van");
    const truck = addTruck(w, borrower, "owned", "workhorse", "van");
    fund(w, saver.id, 50_000);
    fund(w, buyer.id, 50_000);
    expect(applyAction(w, saver.id, { type: "deposit_finance", amountFd: 40_000 })).toEqual({ ok: true });
    const limit = cfg.equipmentFinance.maxLoanToValue * marketValue(cfg, truck, 0);
    expect(applyAction(w, borrower.id, { type: "borrow", truckId: truck.id, amountFd: limit * 1.1 }).ok).toBe(false);
    expect(applyAction(w, borrower.id, { type: "borrow", truckId: truck.id, amountFd: limit })).toEqual({ ok: true });
    // Spend the borrower's cash so the payments bounce.
    w.ledger.post(w.t, companyAccount(borrower.id), "sink:fuel", w.ledger.balance(companyAccount(borrower.id)), "test");
    runDays(w, 14);
    expect(w.finance.loans[0]!.missed).toBe(2);
    runDays(w, 1);
    expect(borrower.repossessions).toBe(1);
    expect(w.trucksByCompany.get(borrower.id)!).toHaveLength(0);
    const listing = w.listings.find((l) => l.sellerId === 0)!;
    expect(listing.askFd).toBeCloseTo(marketValue(cfg, truck, 15) * cfg.equipmentFinance.repoStartPctOfValue, 0);
    const cashBefore = poolCash(w);
    expect(applyAction(w, buyer.id, { type: "buy_listing", listingId: listing.id })).toEqual({ ok: true });
    expect(w.trucksByCompany.get(buyer.id)!).toContain(truck);
    expect(w.finance.loans[0]!.status).toBe("closed");
    expect(poolCash(w)).toBeGreaterThan(cashBefore);
    expect(w.finance.outstandingFd).toBeCloseTo(0, 6);
  });

  it("protects a season of working capital at the close, and runs without seasons when switched off", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 14 });
    const fleet = carrier(w, "Fleet");
    fund(w, fleet.id, 200_000);
    fleet.weeklySpend = [20_000, 20_000, 20_000, 20_000];
    closeSeason(w, 0, 364);
    expect(w.ledger.balance(companyAccount(fleet.id))).toBeCloseTo(80_000 - cfg.permits.carrierAuthorityFd, 2);

    const off: EconomyConfig = { ...cfg, seasonClose: { ...cfg.seasonClose, enabled: false } };
    const v = createWorld({ cfg: off, net, feeds: neutralFeeds, seed: 15 });
    populate(v, { freeOwnerOperators: 10, fleets: 3, brokers: 1 });
    v.t = 340 * cfg.time.gameMinutesPerDay;
    expect(inCloseWindow(v)).toBe(false);
    v.t = 0;
    runDays(v, 366, ruleBotHook);
    expect(v.seasonCloses).toHaveLength(0);
    expect(v.metrics.days.every((d) => d.burnFd === 0)).toBe(true);
  });
});

describe("a seasons-off economy: holding cost, insolvency, broker risk", () => {
  const off: EconomyConfig = { ...cfg, seasonClose: { ...cfg.seasonClose, enabled: false } };

  it("charges 2% a week on cash above working capital, and on the finance pool's idle cash", () => {
    const w = createWorld({ cfg: off, net, feeds: neutralFeeds, seed: 21, keepLedgerEntries: true });
    const rich = carrier(w, "Rich");
    const small = carrier(w, "Small");
    fund(w, rich.id, 200_000 - w.ledger.balance(companyAccount(rich.id)));
    fund(w, small.id, 20_000 - w.ledger.balance(companyAccount(small.id)));
    rich.weeklySpend = [10_000, 10_000, 10_000, 10_000]; // working capital 40k
    applyAction(w, rich.id, { type: "deposit_finance", amountFd: 50_000 });
    chargeHoldingCost(w);
    const charges = w.ledger.entries.filter((e) => e.to === "sink:holding_cost");
    expect(charges.find((e) => e.from === companyAccount(rich.id))!.amount).toBeCloseTo((150_000 - 40_000) * 0.02, 2);
    expect(charges.find((e) => e.from === companyAccount(small.id))).toBeUndefined(); // under the 25k floor
    expect(charges.find((e) => e.ref === "holding:pool")!.amount).toBeCloseTo(50_000 * 0.02, 2);
  });

  it("liquidates a company deep in the red, fire-sells its trucks and restarts it on the free path", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 22, keepLedgerEntries: true });
    const failing = carrier(w, "Failing");
    const truck = addTruck(w, failing, "owned", "workhorse", "van");
    fund(w, failing.id, 50_000);
    applyAction(w, failing.id, { type: "buy_facility", facility: "warehouse", hubId: "DAL" });
    w.ledger.post(w.t, companyAccount(failing.id), "sink:fuel", w.ledger.balance(companyAccount(failing.id)) + 10_000, "test");
    runDays(w, 28); // four weekly solvency checks
    expect(failing.liquidatingSince).not.toBeNull();
    expect(w.facilities[0]!.ownerId).toBe(0); // closed, slot back in supply
    expect(w.facilitySupply.warehouse).toBe(cfg.facilities.types.warehouse.pocCap);
    runDays(w, 1);
    const listing = w.listings.find((l) => l.truckId === truck.id && l.status === "open")!;
    expect(listing.sellerId).toBe(failing.id);
    const buyer = carrier(w, "Vulture");
    addTruck(w, buyer, "owned", "workhorse", "van");
    fund(w, buyer.id, 50_000);
    expect(applyAction(w, buyer.id, { type: "buy_listing", listingId: listing.id })).toEqual({ ok: true });
    // The fleet is gone, but a bankrupt sits out a couple of weeks before the restart.
    runDays(w, 1);
    expect(failing.liquidatingSince).not.toBeNull();
    runDays(w, cfg.insolvency.restartAfterDays);
    expect(failing.liquidatingSince).toBeNull();
    expect(failing.bankruptcies).toBe(1);
    expect(w.ledger.balance(companyAccount(failing.id))).toBeCloseTo(0, 2); // the rest of the debt written off
    expect(w.ledger.entries.some((e) => e.from === "faucet:bankruptcy_writeoff")).toBe(true);
    expect(w.trucksByCompany.get(failing.id)!.map((t) => t.lease)).toEqual(["npc"]);
  });

  it("squeezes brokers when spot runs above their contract rate, and makes them pay carriers when shippers default", () => {
    const always: EconomyConfig = { ...calm, brokerRisk: { ...calm.brokerRisk, defaultRate: 1 } };
    // Contracts are signed in a calm market; on day 2 weather lifts spot rates by half and the contract index lags behind.
    const w = createWorld({ cfg: always, net, feeds: { ...neutralFeeds, weather: (_hub: string, day: number) => (day >= 2 ? 1.5 : 1) }, seed: 23, keepLedgerEntries: true });
    populate(w, { freeOwnerOperators: 40, fleets: 10, brokers: 3 });
    runDays(w, 3);
    const brokered = [...w.loads.values()].filter((l) => l.brokerId !== null && l.postedRound >= w.round - 1);
    expect(brokered.length).toBeGreaterThan(0);
    expect(brokered.every((l) => l.shipperRate < l.spotShipperRate)).toBe(true);
    runDays(w, 6, ruleBotHook);
    // Every shipper defaults here, so brokers collect nothing on delivery but still pay carriers.
    expect(w.metrics.days.reduce((s, d) => s + d.shipperDefaults, 0)).toBeGreaterThan(0);
    const brokerAccts = new Set(w.companies.filter((c) => c.role === "broker").map((c) => companyAccount(c.id)));
    const paidOnDelivery = w.ledger.entries.filter((e) => e.from === "faucet:npc_shipper" && brokerAccts.has(e.to) && e.ref.startsWith("load:"));
    const fallbackLoads = new Set(w.ledger.entries.filter((e) => e.to === "sink:npc_carrier").map((e) => e.ref));
    expect(paidOnDelivery.every((e) => fallbackLoads.has(e.ref))).toBe(true); // only the NPC-covered contracts paid
  });
});

describe("free entry", () => {
  it("leases extra trucks only to carriers that own one, on the 15% share plus a minimum rent", () => {
    const w = createWorld({ cfg: calm, net, feeds: neutralFeeds, seed: 31, keepLedgerEntries: true });
    const c = carrier(w);
    expect(applyAction(w, c.id, { type: "lease_truck", trailer: "reefer" })).toEqual({ ok: false, reason: "extra leases need an owned truck first" });
    addTruck(w, c, "owned", "workhorse", "van");
    fund(w, c.id, 10_000);
    expect(applyAction(w, c.id, { type: "lease_truck", trailer: "reefer" })).toEqual({ ok: true });
    const leased = w.trucksByCompany.get(c.id)!.find((t) => t.lease === "lessor")!;
    expect(leased.trailer).toBe("reefer");
    expect(w.lessor.out).toBe(1);
    expect(condition(cfg, leased)).toBe(cfg.wear.npcLeaseCondition);
    expect(marketValue(cfg, leased, 0)).toBe(0);
    expect(applyAction(w, c.id, { type: "return_lease", truckId: leased.id })).toEqual({ ok: false, reason: "inside the minimum lease term" });
    // An idle leased truck still pays the minimum rent each week.
    runDays(w, 7);
    const rent = w.ledger.entries.filter((e) => e.ref === `rent:${leased.id}`).reduce((s, e) => s + e.amount, 0);
    expect(rent).toBeCloseTo(cfg.freeEntry.leases.minWeeklyFd, 2);
    runDays(w, cfg.freeEntry.leases.minTermDays);
    expect(applyAction(w, c.id, { type: "return_lease", truckId: leased.id })).toEqual({ ok: true });
    expect(w.lessor.out).toBe(0);
    expect(w.trucksByCompany.get(c.id)!.some((t) => t.lease === "lessor")).toBe(false);
  });

  it("caps leases at what the lessor has out", () => {
    const tight: EconomyConfig = { ...calm, freeEntry: { ...calm.freeEntry, leases: { ...calm.freeEntry.leases, startFleet: 1 } } };
    const w = createWorld({ cfg: tight, net, feeds: neutralFeeds, seed: 32 });
    const a = carrier(w, "A");
    const b = carrier(w, "B");
    addTruck(w, a, "owned", "workhorse", "van");
    addTruck(w, b, "owned", "workhorse", "van");
    expect(applyAction(w, a.id, { type: "lease_truck", trailer: "van" }).ok).toBe(true);
    expect(applyAction(w, b.id, { type: "lease_truck", trailer: "van" })).toEqual({ ok: false, reason: "the lessor has nothing left to lease" });
  });
});

describe("buyback auction", () => {
  const bb: EconomyConfig = { ...calm, seasonClose: { ...calm.seasonClose, enabled: false }, buyback: { enabled: true, usdPerWeek: 1_000 } };

  it("fills the cheapest offers at one clearing price and burns the FD", () => {
    const w = createWorld({ cfg: bb, net, feeds: neutralFeeds, seed: 33, keepLedgerEntries: true });
    const [a, b, c] = [carrier(w, "A"), carrier(w, "B"), carrier(w, "C")];
    for (const x of [a, b, c]) fund(w, x.id, 200_000);
    applyAction(w, a.id, { type: "offer_fd", amountFd: 50_000, minPriceUsd: 0.005 });
    applyAction(w, b.id, { type: "offer_fd", amountFd: 100_000, minPriceUsd: 0.008 });
    applyAction(w, c.id, { type: "offer_fd", amountFd: 100_000, minPriceUsd: 0.02 });
    const before = w.ledger.supply();
    const spentBefore = w.ledger.outflowCents(companyAccount(a.id));
    const week = clearBuyback(w);
    // A fills fully; B fills in part at its own minimum, which sets the price; C misses.
    expect(week.priceUsd).toBeCloseTo(0.008, 9);
    expect(week.spentUsd).toBeCloseTo(1_000, 6);
    expect(week.boughtFd).toBeCloseTo(1_000 / 0.008, 4);
    expect(a.usd.out).toBeCloseTo(50_000 * 0.008, 6);
    expect(c.usd.out).toBe(0);
    expect(before - w.ledger.supply()).toBeCloseTo(week.boughtFd, 1);
    expect(w.buyback.lastFill.get(a.id)).toBe(1);
    expect(w.buyback.lastFill.get(c.id)).toBe(0);
    // Selling FD isn't spending: it doesn't count toward working capital.
    expect(w.ledger.outflowCents(companyAccount(a.id))).toBe(spentBefore);
  });

  it("spends the whole budget when little is offered, so the price rises", () => {
    const w = createWorld({ cfg: bb, net, feeds: neutralFeeds, seed: 34 });
    const a = carrier(w, "A");
    fund(w, a.id, 20_000);
    applyAction(w, a.id, { type: "offer_fd", amountFd: 10_000, minPriceUsd: 0 });
    const week = clearBuyback(w);
    expect(week.priceUsd).toBeCloseTo(0.1, 9);
    expect(a.usd.out).toBeCloseTo(1_000, 6);
  });
});

describe("token", () => {
  const tk: EconomyConfig = { ...calm, seasonClose: { ...calm.seasonClose, enabled: false }, token: { ...calm.token, enabled: true } };

  function launched(seed: number) {
    const w = createWorld({ cfg: tk, net, feeds: neutralFeeds, seed, keepLedgerEntries: true });
    const a = carrier(w, "A");
    const b = carrier(w, "B");
    fund(w, a.id, 100_000);
    a.milesTotal = 3_000;
    b.milesTotal = 1_000;
    launchToken(w);
    return { w, a, b };
  }

  it("burns beta FD above working capital at launch, locks the rest, and opens the pool at the launch price", () => {
    const { w, a } = launched(35);
    const keep = cfg.holdingCost.minProtectedFd;
    expect(w.ledger.balance(companyAccount(a.id)) - (a.airdrop!.unlockedFd)).toBeCloseTo(keep, 2);
    expect(a.lockedFd).toBeCloseTo(keep, 2);
    expect(fdPriceUsd(w)).toBeCloseTo(tk.token.launch.priceUsd, 9);
    expect(w.ledger.balance(EXCHANGE_ACCOUNT)).toBeCloseTo(tk.token.launch.seedUsd / tk.token.launch.priceUsd, 2);
    // Only the airdrop's launch slice is sellable; working capital is spend-only.
    expect(sellableFd(w, a)).toBeCloseTo(a.airdrop!.unlockedFd, 2);
    expect(applyAction(w, a.id, { type: "sell_fd", fd: a.airdrop!.unlockedFd + 100 }).ok).toBe(false);
    w.ledger.assertBalanced();
  });

  it("splits the airdrop by Miles, capped per company, and unlocks it only in weeks with loads", () => {
    const { w, a, b } = launched(36);
    const cap = tk.token.airdrop.fd * tk.token.airdrop.capShare;
    expect(a.airdrop!.totalFd).toBeCloseTo(cap, 2); // 75% of Miles, capped at 1%
    expect(b.airdrop!.totalFd).toBeCloseTo(cap, 2);
    expect(a.airdrop!.unlockedFd).toBeCloseTo(cap * tk.token.airdrop.atLaunch, 2);
    a.loadsThisWeek = tk.token.airdrop.loadsPerWeek;
    b.loadsThisWeek = 0;
    weeklyToken(w);
    const slice = (cap * (1 - tk.token.airdrop.atLaunch)) / tk.token.airdrop.unlockWeeks;
    expect(a.airdrop!.unlockedFd).toBeCloseTo(cap * tk.token.airdrop.atLaunch + slice, 2);
    expect(b.airdrop!.forfeitedFd).toBeCloseTo(slice, 2);
    expect(applyAction(w, b.id, { type: "claim_airdrop_now" }).ok).toBe(true);
    expect(b.airdrop!.unlockedFd + b.airdrop!.forfeitedFd).toBeCloseTo(cap, 2);
  });

  it("trades on a constant-product pool: buy fees go to the treasury, sell fees are burned", () => {
    const { w, a } = launched(37);
    a.usd.wallet = 1_000;
    const spentBefore = w.ledger.outflowCents(companyAccount(a.id)); // the authority fee at formation
    const k = w.token.poolUsd * w.ledger.balance(EXCHANGE_ACCOUNT);
    const before = w.ledger.balance(companyAccount(a.id));
    expect(applyAction(w, a.id, { type: "buy_fd", usd: 1_000 }).ok).toBe(true);
    const bought = w.ledger.balance(companyAccount(a.id)) - before;
    expect(w.token.treasury.feeUsd).toBeCloseTo(1_000 * tk.token.exchange.buyFeePct, 6);
    expect(w.token.poolUsd * w.ledger.balance(EXCHANGE_ACCOUNT)).toBeCloseTo(k, -4);
    expect(fdPriceUsd(w)).toBeGreaterThan(tk.token.launch.priceUsd);
    // Bought FD is unlocked; selling it back pays the burned sell fee plus the round trip.
    expect(applyAction(w, a.id, { type: "sell_fd", fd: bought }).ok).toBe(true);
    expect(a.usd.out).toBeLessThan(1_000 * (1 - tk.token.exchange.sellFeePct));
    const burned = w.ledger.entries.filter((e) => e.to === "sink:exchange_fee").reduce((s, e) => s + e.amount, 0);
    expect(burned).toBeCloseTo(bought * tk.token.exchange.sellFeePct, 1);
    // Swaps aren't spending, and neither is the launch burn.
    expect(w.ledger.outflowCents(companyAccount(a.id))).toBe(spentBefore);
    w.ledger.assertBalanced();
  });

  it("taxes only a week's operating profit above the allowance, and buys back FD with half the treasury's revenue", () => {
    const { w, a, b } = launched(38);
    a.operating.revenueFd += 10_000;
    a.operating.costFd += 6_000;
    b.operating.costFd += 3_000; // a losing week pays nothing
    const poolBefore = w.ledger.balance(EXCHANGE_ACCOUNT);
    weeklyToken(w);
    const tax = (id: number) => w.ledger.entries.filter((e) => e.ref === `tax:${id}`).reduce((s, e) => s + e.amount, 0);
    expect(tax(a.id)).toBeCloseTo((4_000 - tk.token.profitTaxAllowanceFd) * tk.token.profitTaxRate, 2);
    expect(tax(b.id)).toBe(0);
    expect(w.token.treasury.productUsd).toBeCloseTo(2 * tk.token.treasury.productUsdPerCompanyWeek, 6);
    // The week's buyback share is spent a seventh a day over the next week.
    runDays(w, 6);
    expect(w.token.treasury.buybackUsd).toBeCloseTo((6 / 7) * w.token.treasury.productUsd * tk.token.treasury.buybackShare, 6);
    expect(w.ledger.balance(EXCHANGE_ACCOUNT)).toBeLessThan(poolBefore);
    w.ledger.assertBalanced();
  });

  it("launches on its own at the end of beta in a populated world, with the ledger balanced", () => {
    const short: EconomyConfig = { ...tk, token: { ...tk.token, betaYears: 0.1 } };
    const w = createWorld({ cfg: short, net, feeds: neutralFeeds, seed: 39 });
    populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 4 });
    runDays(w, Math.round(0.1 * cfg.time.daysPerSeason) + 14, ruleBotHook);
    expect(w.token.launchDay).toBe(Math.round(0.1 * cfg.time.daysPerSeason)); // the first live day
    expect(w.token.priceHistory.length).toBeGreaterThan(10);
    expect(w.metrics.days.at(-1)!.priceUsd).toBeGreaterThan(0);
  });

  it("replays exactly from the seed, newcomers and trading included", () => {
    const short: EconomyConfig = { ...tk, token: { ...tk.token, betaYears: 0.05, newCompanies: { ...tk.token.newCompanies, perWeek: 3 } } };
    const run = () => {
      const w = createWorld({ cfg: short, net, feeds: { ...neutralFeeds, cycle: syntheticCassCycle({ seed: 40 }) }, seed: 40 });
      populate(w, { freeOwnerOperators: 30, fleets: 6, brokers: 3 });
      runDays(w, 40, ruleBotHook);
      return { prices: w.token.priceHistory, companies: w.companies.length, supply: w.ledger.supply() };
    };
    expect(run()).toEqual(run());
  });
});
