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
  RESERVE_ACCOUNT,
  payClaim,
  bill,
  itemPriceFd,
  itemPriceUsd,
  priceIndex,
  stakeDiscount,
  truckCap,
  weeklyVest,
  askPriceUsd,
  brokerLicensed,
  creditBand,
  creditPremium,
  creditScore,
  restart,
  startLiquidation,
  contractAccount,
  HOLDER_NPC_FACTOR,
  dailyReceivables,
  HOLDER_POOL,
  seasonAirdrop,
  poolAccount,
  poolDepositorValue,
  quote,
  signPolicy,
  exitAccount,
  revoke,
  liveGameMinutes,
  planFreight,
  hubDemandPerRound,
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
import { monthlyFuelTax } from "../src/fuelTax.js";
import { stakeAccount } from "../src/staking.js";
import { payTripCosts } from "../src/trips.js";
import { createTruck } from "../src/world.js";
import { businessesOf, payFuel, payLegFuel, roadService, serviceBill, shopAt } from "../src/businesses.js";
import { bestOpenSite, legMile, restOnRoad, sitePriceFd, sitesAlong } from "../src/sites.js";
import { hubRoute, syncTruck } from "../src/world.js";
import { fuelPrice as fuelPriceNow } from "../src/economics.js";
import { beginLeg } from "../src/trips.js";
import { winterNow } from "../src/safety.js";
import { elevationAt } from "@lanes/data";
import { dispatchProfile, managerBreakdownMult, opsCap, payDispatchers, poolOf as poolStaff } from "../src/labor.js";
import { askingPay as asking } from "../src/world.js";
import type { Company } from "../src/types.js";

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
    commodity: 0, originPlace: PLACE_OF_HUB[lane.origin]!, destPlace: PLACE_OF_HUB[lane.dest]!, appointmentT: 1e12, routeHours: lane.miles / 50, routeTollFd: 0, localUntilRound: 0, contractId: 0, tenderedTo: 0, tenderUntil: 0,
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
    // With no trucks in this world its freight rolls, then goes unsold: no NPC expediter hauls it (0.17.0).
    expect(w.metrics.days.reduce((s, d) => s + d.facilityPosted, 0)).toBeGreaterThan(10);
    expect(w.metrics.days.reduce((s, d) => s + d.expired, 0)).toBeGreaterThan(0);
    expect(w.ledger.entries.some((e) => e.from === "faucet:npc_market")).toBe(false);
    expect([...w.loads.values()].every((l) => l.roundsUnfilled < cfg.board.giveUpAfterRounds + cfg.leverage.localRounds)).toBe(true);
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

  it("keeps parked trucks off the road, and lets them come back", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 10 });
    const fleet = carrier(w, "Fleet");
    const [a] = [addTruck(w, fleet, "owned", "workhorse", "van"), addTruck(w, fleet, "owned", "workhorse", "van")];
    applyAction(w, fleet.id, { type: "park_truck", truckId: a.id });
    expect(a.status).toBe("parked");
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
    // The rest of the debt is written off; since then the fresh NPC truck has only burned idle fuel sitting (0.17.0).
    const writeOff = w.ledger.entries.findIndex((e) => e.from === "faucet:bankruptcy_writeoff");
    expect(writeOff).toBeGreaterThanOrEqual(0);
    const since = w.ledger.entries.slice(writeOff + 1).filter((e) => e.from === companyAccount(failing.id) || e.to === companyAccount(failing.id));
    expect(since.every((e) => e.to === "sink:idle_fuel")).toBe(true);
    expect(w.ledger.balance(companyAccount(failing.id)) + since.reduce((s, e) => s + e.amount, 0)).toBeCloseTo(0, 2);
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
    expect(paidOnDelivery).toHaveLength(0); // and no NPC carrier covers a brokered load any more (0.17.0)
    expect(w.ledger.entries.some((e) => e.to === "sink:npc_carrier")).toBe(false);
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
  // The treasury mechanism is tested with a stand-in product revenue; the live config has none.
  const tk: EconomyConfig = { ...calm, seasonClose: { ...calm.seasonClose, enabled: false }, token: { ...calm.token, enabled: true, treasury: { ...calm.token.treasury, productUsdPerCompanyWeek: 5 } } };

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
    // The pool is as deep as the float that survived the reset, and the launch price is the seed over it.
    const L = w.token.launch!;
    expect(w.ledger.balance(EXCHANGE_ACCOUNT)).toBeCloseTo(L.floatFd * tk.token.launch.poolDepthShareOfFloat, 2);
    expect(w.token.launchPriceUsd).toBeCloseTo(tk.token.launch.seedUsd / L.liquidityFd, 12);
    expect(fdPriceUsd(w)).toBeCloseTo(w.token.launchPriceUsd, 12);
    expect(w.token.floorUsd).toBe(0); // two-sided: buyers pay the pool's price, no floor
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
    expect(fdPriceUsd(w)).toBeGreaterThan(w.token.launchPriceUsd);
    // Bought FD is unlocked; selling it back pays the burned sell fee plus the round trip. The fee
    // rises with the sale's price impact (the whale rules, 0.18.0).
    const poolFd = w.ledger.balance(EXCHANGE_ACCOUNT);
    expect(applyAction(w, a.id, { type: "sell_fd", fd: bought }).ok).toBe(true);
    expect(a.usd.out).toBeLessThan(1_000 * (1 - tk.token.exchange.sellFeePct));
    const burned = w.ledger.entries.filter((e) => e.to === "sink:exchange_fee").reduce((s, e) => s + e.amount, 0);
    const x = tk.token.exchange;
    expect(burned).toBeCloseTo(bought * Math.min(x.sellFeeMax, x.sellFeePct + x.sellFeePerImpact * (bought / (poolFd + bought))), 1);
    // Swaps aren't spending, and neither is the launch burn.
    expect(w.ledger.outflowCents(companyAccount(a.id))).toBe(spentBefore);
    w.ledger.assertBalanced();
  });

  it("taxes only a week's operating profit above the allowance, and buys back FD with half the treasury's revenue", () => {
    const { w, a, b } = launched(38);
    a.operating.revenueFd += 20_000;
    a.operating.costFd += 6_000; // a 14,000 FD week: the part above the exemption is taxed
    b.operating.costFd += 3_000; // a losing week pays nothing
    const poolBefore = w.ledger.balance(EXCHANGE_ACCOUNT);
    weeklyToken(w);
    const tax = (id: number) => w.ledger.entries.filter((e) => e.ref === `tax:${id}`).reduce((s, e) => s + e.amount, 0);
    expect(tax(a.id)).toBeCloseTo((14_000 - tk.token.profitTaxAllowanceFd) * tk.token.profitTaxRate, 2);
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

describe("real market (0.17.0): freight moves only on AI and player trucks", () => {
  it("never hands a load to an NPC carrier: unfilled loads roll with the ceiling up each round, then the shipper gives up and brokers pay the fall-off", () => {
    // Brokers but no carriers at all: nothing can haul, so every load rolls and then expires.
    const w = createWorld({ cfg: calm, net, feeds: neutralFeeds, seed: 41, keepLedgerEntries: true });
    populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
    runDays(w, 8, ruleBotHook);
    expect(w.ledger.entries.some((e) => e.to === "sink:npc_carrier" || e.to === "sink:npc_expediter")).toBe(false);
    expect(w.metrics.days.reduce((s, d) => s + d.expired, 0)).toBeGreaterThan(100);
    expect(w.metrics.days.reduce((s, d) => s + d.cleared, 0)).toBe(0);
    for (const l of w.loads.values()) {
      expect(l.status).toBe("open");
      expect(l.roundsUnfilled).toBeLessThan(cfg.board.giveUpAfterRounds + cfg.leverage.localRounds);
      // An NPC shipper's own load: the ceiling compounds by the rollover step every round it sits.
      if (l.brokerId === null && l.hot === 0 && l.roundsUnfilled > 0) {
        expect(l.ceiling / (l.refRate * cfg.rates.npcCeilingMarkup)).toBeCloseTo((1 + cfg.board.rolloverCeilingStep) ** l.roundsUnfilled, 6);
        expect(l.bookNow).toBeLessThanOrEqual(l.ceiling + 1e-9);
      }
    }
    // Brokers that took contracts and never covered them paid the shipper's fall-off charge.
    const fallOff = w.ledger.entries.filter((e) => e.to === "sink:broker_falloff");
    expect(fallOff.length).toBeGreaterThan(0);
    const brokerAccts = new Set(w.companies.filter((c) => c.role === "broker").map((c) => companyAccount(c.id)));
    expect(fallOff.every((e) => brokerAccts.has(e.from))).toBe(true);
    // No broker is left holding an open load it never had a chance to settle.
    for (const b of w.companies.filter((c) => c.role === "broker")) expect(b.openBrokerLoads).toBeGreaterThanOrEqual(0);
  });

  it("charges idle fuel to a crewed truck that sits, from its first day", () => {
    const w = smallWorld(42, true);
    runDays(w, 3, ruleBotHook);
    const idleFuel = w.ledger.entries.filter((e) => e.to === "sink:idle_fuel");
    expect(idleFuel.length).toBeGreaterThan(0);
    for (const e of idleFuel) expect(e.amount).toBeGreaterThan(0);
    const perTruckDay = cfg.costs.idleFuelGalPerDay * w.metrics.days.at(-1)!.fuelPrice;
    expect(Math.abs(idleFuel.at(-1)!.amount - perTruckDay)).toBeLessThan(perTruckDay * 0.2); // the day's pump price moves a little
  });

  it("holds the AI fleet at its starting size during the token beta, and lets it grow with the token off", () => {
    const run = (enabled: boolean) => {
      const tokenCfg: EconomyConfig = { ...calm, token: { ...calm.token, enabled }, freeEntry: { ...calm.freeEntry, leases: { ...calm.freeEntry.leases, enabled: true } } };
      const w = createWorld({ cfg: tokenCfg, net, feeds: neutralFeeds, seed: 43 });
      populate(w, { freeOwnerOperators: 60, fleets: 20, brokers: 4 });
      const start = w.aiFleetStart;
      expect(start).toBeGreaterThan(60);
      runDays(w, 120, ruleBotHook);
      return { start, end: w.trucks.filter((t) => t.companyId !== 0 && t.status !== "retired").length };
    };
    const beta = run(true);
    expect(beta.end).toBeLessThanOrEqual(beta.start * cfg.token.betaAiFleetCap!);
    const free = run(false);
    expect(free.end).toBeGreaterThan(free.start);
  });
});

describe("circular economy (0.18.0): a capped supply with a reserve", () => {
  const circular = { enabled: true, capFd: 1_000_000, shares: { reserve: 0.6, pool: 0.025, airdrop: 0.023 } };

  it("mints only at genesis: faucets draw on the reserve or their allocation, sinks refill it, burns leave the cap", () => {
    const l = new Ledger(true, circular);
    expect(l.minted()).toBe(1_000_000);
    expect(l.reserve()).toBe(600_000);
    l.post(0, "faucet:npc_shipper", "co:1", 1_000, "load:1");
    expect(l.reserve()).toBe(599_000);
    expect(l.supply()).toBe(1_000);
    l.post(0, "co:1", "sink:fuel", 400, "fuel:1");
    expect(l.reserve()).toBe(599_400);
    l.post(0, "co:1", "sink:buyback", 100, "buyback:1");
    expect(l.burned()).toBe(100);
    l.post(0, "faucet:airdrop", "co:1", 50, "airdrop:1");
    expect(l.balance("alloc:airdrop")).toBe(23_000 - 50);
    expect(l.supply() + l.reserve() + l.allocated() + l.burned()).toBeCloseTo(1_000_000, 6);
    expect(l.totals.get("faucet:npc_shipper")).toBe(100_000); // the tags still count the flows, in cents
    expect(l.entries.map((e) => e.from)).toContain("faucet:npc_shipper");
    l.assertBalanced();
  });

  it("conserves the cap through a populated month, and pays less per mile when the reserve is drained", () => {
    const circ: EconomyConfig = { ...calm, token: { ...calm.token, enabled: true, circular: { ...calm.token.circular, enabled: true } } };
    const run = (drainShare: number) => {
      const w = createWorld({ cfg: circ, net, feeds: neutralFeeds, seed: 44 });
      populate(w, { freeOwnerOperators: 60, fleets: 20, brokers: 4 });
      if (drainShare > 0) w.ledger.post(0, RESERVE_ACCOUNT, "sink:buyback", w.ledger.reserve() * drainShare, "test");
      runDays(w, 30, ruleBotHook);
      const l = w.ledger;
      expect(l.supply() + l.reserve() + l.allocated() + l.burned()).toBeCloseTo(circ.token.circular.capFd, 1);
      expect(l.reserve()).toBeGreaterThan(0);
      return w.metrics.days.slice(-14).reduce((s, d) => s + d.avgClearedRate, 0) / 14;
    };
    const full = run(0);
    const drained = run(0.5);
    expect(drained).toBeLessThan(full * 0.8);
  });
});

describe("staking (0.18.0): the bond behind the licence", () => {
  const staked: EconomyConfig = { ...calm, token: { ...calm.token, staking: { ...calm.token.staking, enabled: true } } };

  it("gates the truck tiers, queues an exit under the global limit, haircuts an instant exit, and is slashed on revocation", () => {
    const w = createWorld({ cfg: staked, net, feeds: neutralFeeds, seed: 45, keepLedgerEntries: true });
    const c = carrier(w);
    fund(w, c.id, 200_000);
    for (let i = 0; i < 5; i++) addTruck(w, c, "owned", "workhorse", "van");
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false })).toEqual({ ok: false, reason: "company truck cap" });
    const cashBefore = w.ledger.balance(companyAccount(c.id));
    expect(applyAction(w, c.id, { type: "stake_fd", fd: 20_000 })).toEqual({ ok: true });
    expect(c.stakedFd).toBe(20_000);
    expect(w.ledger.balance(companyAccount(c.id))).toBeCloseTo(cashBefore - 20_000, 2);
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false })).toEqual({ ok: true });
    // Into the queue: nothing comes back before the wait, then at most the daily limit of all staked FD.
    expect(applyAction(w, c.id, { type: "unstake_fd", fd: 10_000, instant: false })).toEqual({ ok: true });
    expect(c.stakedFd).toBe(10_000);
    const released = () => w.ledger.entries.filter((e) => e.from === exitAccount(c.id) && e.to === companyAccount(c.id)).reduce((s, e) => s + e.amount, 0);
    runDays(w, staked.token.staking.exitDays - 1);
    expect(released()).toBe(0);
    runDays(w, 2);
    expect(released()).toBeGreaterThan(0);
    expect(released()).toBeLessThanOrEqual(20_000 * staked.token.staking.exitLimitPerDay * 2 + 1);
    // Instant: three quarters back, a quarter burned.
    const before = w.ledger.balance(companyAccount(c.id));
    expect(applyAction(w, c.id, { type: "unstake_fd", fd: 4_000, instant: true })).toEqual({ ok: true });
    expect(w.ledger.balance(companyAccount(c.id)) - before).toBeCloseTo(3_000, 2);
    expect(w.ledger.balance("sink:unstake_haircut")).toBeCloseTo(1_000, 2);
    // Revoked: whatever is still staked or exiting is seized.
    const held = c.stakedFd + c.unstaking.reduce((s, e) => s + e.fd, 0);
    expect(held).toBeGreaterThan(0);
    revoke(w, c, "test", 365);
    expect(c.stakedFd).toBe(0);
    expect(c.unstaking).toEqual([]);
    expect(w.ledger.balance("sink:seized")).toBeCloseTo(held, 1);
  });

  it("licenses brokers by their stake: an unstaked broker takes no loads, and the bots start staked", () => {
    const w = createWorld({ cfg: staked, net, feeds: neutralFeeds, seed: 46 });
    populate(w, { freeOwnerOperators: 30, fleets: 5, brokers: 3 });
    const brokers = w.companies.filter((c) => c.role === "broker");
    expect(brokers.every((b) => b.stakedFd === staked.token.staking.roles.broker)).toBe(true);
    const idle = brokers[0]!;
    expect(applyAction(w, idle.id, { type: "unstake_fd", fd: idle.stakedFd, instant: true })).toEqual({ ok: true });
    runDays(w, 5, ruleBotHook);
    expect(idle.openBrokerLoads).toBe(0);
    expect(brokers.slice(1).some((b) => b.openBrokerLoads > 0)).toBe(true);
  });
});

describe("pools (0.18.0): a player-funded insurance pool", () => {
  const pooled: EconomyConfig = { ...calm, token: { ...calm.token, pools: { ...calm.token.pools, enabled: true } } };

  it("writes policies only when capitalised, prices by capital, earns the premiums and pays claims as far as it goes", () => {
    const w = createWorld({ cfg: pooled, net, feeds: neutralFeeds, seed: 47, keepLedgerEntries: true });
    const c = carrier(w);
    fund(w, c.id, 50_000);
    addTruck(w, c, "owned", "workhorse", "van");
    // An empty pool: the NPC backstop writes, at its markup over the plain price.
    const plain = { ...pooled, token: { ...pooled.token, pools: { ...pooled.token.pools, enabled: false } } };
    const base = quote(createWorld({ cfg: plain, net, feeds: neutralFeeds, seed: 47 }), c).annualPerTruck;
    signPolicy(w, c, "rewrite");
    expect(c.insurance.writer).toBe("npc");
    expect(c.insurance.annualPerTruck).toBeCloseTo(base * pooled.token.pools.insurance.backstopMarkup, 2);
    // A depositor capitalises the pool: the next policy is pool-written at no more than the plain price.
    const d = carrier(w, "Depositor");
    fund(w, d.id, 2_000_000);
    expect(applyAction(w, d.id, { type: "deposit_pool", line: "insurance", amountFd: 1_000_000 })).toEqual({ ok: true });
    expect(w.ledger.balance(poolAccount("insurance"))).toBe(1_000_000);
    signPolicy(w, c, "rewrite");
    expect(c.insurance.writer).toBe("pool");
    expect(c.insurance.annualPerTruck).toBeLessThanOrEqual(base + 1e-6);
    expect(c.insuranceStakeFd).toBe(pooled.safety.crash.deductibleFd); // the deductible, locked behind the pool-written policy
    expect(w.ledger.balance(contractAccount(c.id))).toBe(pooled.safety.crash.deductibleFd);
    // Premiums reach the pool, and the exposure is what it has written.
    runDays(w, 7);
    expect(w.pools.insurance.premiumsFd).toBeGreaterThan(0);
    expect(w.ledger.balance(poolAccount("insurance"))).toBeGreaterThan(1_000_000);
    expect(w.pools.insurance.exposureFd).toBeCloseTo(c.insurance.annualPerTruck, 2);
    // A claim comes out of the pool; past its cash the shortfall is recorded.
    const cash = w.ledger.balance(poolAccount("insurance"));
    expect(payClaim(w, "insurance", "sink:liability", 5_000, "claim:test")).toBe(5_000);
    expect(w.ledger.balance(poolAccount("insurance"))).toBeCloseTo(cash - 5_000, 2);
    expect(payClaim(w, "insurance", "sink:liability", cash * 2, "claim:test")).toBeCloseTo(cash - 5_000, 2);
    expect(w.pools.insurance.shortfallFd).toBeCloseTo(cash * 2 - (cash - 5_000), 2);
    expect(w.ledger.balance(poolAccount("insurance"))).toBeCloseTo(0, 2);
  });

  it("pays depositors out through the exit queue, at most the daily share of the pool a day", () => {
    const w = createWorld({ cfg: pooled, net, feeds: neutralFeeds, seed: 48, keepLedgerEntries: true });
    const d = carrier(w, "Depositor");
    fund(w, d.id, 300_000);
    expect(applyAction(w, d.id, { type: "deposit_pool", line: "insurance", amountFd: 200_000 })).toEqual({ ok: true });
    expect(poolDepositorValue(w, "insurance", d.id)).toBeCloseTo(200_000, 2);
    expect(applyAction(w, d.id, { type: "withdraw_pool", line: "insurance", amountFd: 100_000 })).toEqual({ ok: true });
    expect(poolDepositorValue(w, "insurance", d.id)).toBeCloseTo(100_000, 2);
    const paid = () => w.ledger.entries.filter((e) => e.from === poolAccount("insurance") && e.to === companyAccount(d.id)).reduce((s, e) => s + e.amount, 0);
    runDays(w, pooled.token.pools.exitDays - 1);
    expect(paid()).toBe(0);
    runDays(w, 3);
    expect(paid()).toBeGreaterThan(0);
    expect(paid()).toBeLessThanOrEqual(200_000 * pooled.token.pools.exitLimitPerDay * 3 + 1);
  });
});

describe("payment terms, factoring, surety and airdrop seasons (0.18.0)", () => {
  const terms: EconomyConfig = { ...calm, token: { ...calm.token, payment: { ...calm.token.payment, enabled: true }, pools: { ...calm.token.pools, enabled: true } } };

  it("pays freight net-30: carriers hold receivables and collect on the due day; on quick pay nothing waits", () => {
    const w = createWorld({ cfg: terms, net, feeds: neutralFeeds, seed: 49, keepLedgerEntries: true });
    populate(w, { freeOwnerOperators: 40, fleets: 10, brokers: 3 });
    runDays(w, 10, ruleBotHook);
    expect(w.receivables.length).toBeGreaterThan(0);
    const collected = () => w.ledger.entries.filter((e) => e.ref.startsWith("receivable:")).length;
    expect(collected()).toBe(0);
    runDays(w, terms.token.payment.termsDays, ruleBotHook);
    expect(collected()).toBeGreaterThan(0);
    for (const c of w.companies) c.payTerms = "quick";
    const day = w.metrics.days.length;
    runDays(w, 5);
    expect(w.receivables.filter((r) => r.dueDay > day + terms.token.payment.termsDays && r.holder === r.payeeId)).toHaveLength(0); // only the lessor's paper on leased trucks
    w.ledger.assertBalanced();
  });

  it("factors an invoice through the pool when it is capitalised, at the discount, and the pool collects at due", () => {
    const w = createWorld({ cfg: terms, net, feeds: neutralFeeds, seed: 50, keepLedgerEntries: true });
    const d = carrier(w, "Depositor");
    fund(w, d.id, 3_000_000);
    expect(applyAction(w, d.id, { type: "deposit_pool", line: "factoring", amountFd: 2_000_000 })).toEqual({ ok: true });
    const c = carrier(w, "Factoring carrier");
    expect(applyAction(w, c.id, { type: "set_pay_terms", terms: "factor" })).toEqual({ ok: false, reason: "the contract stake needs more FD" });
    fund(w, c.id, 20_000);
    expect(applyAction(w, c.id, { type: "set_pay_terms", terms: "factor" })).toEqual({ ok: true });
    expect(c.factoring).toEqual({ until: terms.token.payment.factoring.termDays, stakeFd: terms.token.payment.factoring.stakePerTruckFd });
    expect(w.ledger.balance(contractAccount(c.id))).toBe(terms.token.payment.factoring.stakePerTruckFd);
    const cashBefore = w.ledger.balance(companyAccount(c.id));
    bill(w, { payer: 0, faucet: "faucet:npc_shipper", payee: c, amountFd: 10_000, ref: "load:test" });
    const advance = 10_000 * (1 - terms.token.payment.factoring.discountNpc); // a fresh pool against no exposure: markup 1
    expect(w.ledger.balance(companyAccount(c.id)) - cashBefore).toBeCloseTo(advance, 2);
    expect(w.receivables).toHaveLength(1);
    expect(w.receivables[0]!.holder).toBe(HOLDER_POOL);
    expect(w.pools.factoring.exposureFd).toBe(10_000);
    const poolBefore = w.ledger.balance(poolAccount("factoring"));
    runDays(w, terms.token.payment.termsDays + 1);
    expect(w.receivables).toHaveLength(0);
    expect(w.ledger.balance(poolAccount("factoring")) - poolBefore).toBeCloseTo(10_000, 2);
    expect(w.pools.factoring.premiumsFd).toBeCloseTo(10_000 - advance, 2);
    expect(w.pools.factoring.exposureFd).toBe(0);
  });

  it("the surety pool covers a broker's carrier when the broker is wound up unpaid, up to the bond", () => {
    const w = createWorld({ cfg: terms, net, feeds: neutralFeeds, seed: 51, keepLedgerEntries: true });
    const d = carrier(w, "Depositor");
    fund(w, d.id, 500_000);
    expect(applyAction(w, d.id, { type: "deposit_pool", line: "surety", amountFd: 300_000 })).toEqual({ ok: true });
    const b = formCompany(w, { name: "Broker", role: "broker", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
    b.suretyWriter = "pool";
    const c = carrier(w);
    const owed = 100_000;
    w.receivables.push({ id: w.nextReceivableId++, payer: b.id, payeeId: c.id, amountFd: owed, dueDay: 0, holder: c.id });
    b.liquidatingSince = 0;
    const before = w.ledger.balance(companyAccount(c.id));
    dailyReceivables(w);
    const bond = terms.token.staking.roles.broker;
    expect(w.ledger.balance(companyAccount(c.id)) - before).toBeCloseTo(Math.min(owed, bond), 2);
    expect(w.pools.surety.claimsFd).toBeCloseTo(Math.min(owed, bond), 2);
    expect(w.receivables).toHaveLength(0);
  });

  it("pays a later airdrop season by that season's Miles and profit, scaled by the price against launch", () => {
    const tk2: EconomyConfig = { ...calm, token: { ...calm.token, enabled: true } };
    const w = createWorld({ cfg: tk2, net, feeds: neutralFeeds, seed: 52, keepLedgerEntries: true });
    const a = carrier(w, "A");
    const b = carrier(w, "B");
    fund(w, a.id, 100_000);
    a.milesTotal = 3_000;
    b.milesTotal = 1_000;
    launchToken(w);
    // The launch vests are over; in the season that follows only A hauls and earns, and the price runs at half of launch.
    a.airdrop!.weeksLeft = 0;
    b.airdrop!.weeksLeft = 0;
    a.milesTotal += 5_000;
    a.operating.revenueFd += 50_000;
    for (let i = 0; i < 10; i++) w.token.priceHistory.push(w.token.launchPriceUsd / 2);
    const hist = w.token.priceHistory.slice(-tk2.time.daysPerSeason);
    const scale = Math.min(1, hist.reduce((s, p) => s + p, 0) / hist.length / w.token.launchPriceUsd);
    const minted = w.token.airdrop.mintedFd;
    seasonAirdrop(w);
    const pot = tk2.token.airdrop.laterSeasons[0]! * scale;
    expect(scale).toBeLessThan(1);
    expect(a.airdrop!.totalFd).toBeCloseTo(Math.min(pot * tk2.token.airdrop.capShare, pot), 2); // the whole season was A's, capped
    expect(a.airdrop!.weeksLeft).toBe(tk2.token.airdrop.unlockWeeks);
    expect(b.airdrop!.weeksLeft).toBe(0);
    expect(w.token.airdrop.mintedFd - minted).toBeCloseTo(a.airdrop!.totalFd * tk2.token.airdrop.atLaunch, 2);
    expect(w.token.airdrop.seasonsPaid).toBe(1);
    w.ledger.assertBalanced();
  });
});

describe("contracts (0.18.0): the factoring term, its stake, and the lessor's same-day pay", () => {
  const terms: EconomyConfig = { ...calm, token: { ...calm.token, payment: { ...calm.token.payment, enabled: true }, pools: { ...calm.token.pools, enabled: true } } };

  it("forfeits the stake to the pool on an early exit, and returns it at term", () => {
    const w = createWorld({ cfg: terms, net, feeds: neutralFeeds, seed: 53, keepLedgerEntries: true });
    const c = carrier(w);
    fund(w, c.id, 40_000);
    expect(applyAction(w, c.id, { type: "set_pay_terms", terms: "factor" })).toEqual({ ok: true });
    const stake = c.factoring!.stakeFd;
    const poolBefore = w.ledger.balance(poolAccount("factoring"));
    expect(applyAction(w, c.id, { type: "set_pay_terms", terms: "net" })).toEqual({ ok: true });
    expect(c.factoring).toBeNull();
    expect(w.ledger.balance(poolAccount("factoring")) - poolBefore).toBeCloseTo(stake, 2);
    expect(w.ledger.balance(contractAccount(c.id))).toBe(0);
    // Signed again and left to run: at term, still wanting it, the contract renews; wanting out, the stake comes home.
    expect(applyAction(w, c.id, { type: "set_pay_terms", terms: "factor" })).toEqual({ ok: true });
    const stake2 = c.factoring!.stakeFd;
    c.payTerms = "net"; // the wish to leave at term, without an early exit
    runDays(w, terms.token.payment.factoring.termDays + 1);
    expect(c.factoring).toBeNull();
    const returned = w.ledger.entries.filter((e) => e.from === contractAccount(c.id) && e.to === companyAccount(c.id)).reduce((s, e) => s + e.amount, 0);
    expect(returned).toBeCloseTo(stake2, 2);
    expect(w.ledger.balance(contractAccount(c.id))).toBe(0);
  });

  it("the lessor pays its leased trucks on delivery and takes the paper, so the free path holds no receivables", () => {
    const w = createWorld({ cfg: terms, net, feeds: neutralFeeds, seed: 54, keepLedgerEntries: true });
    populate(w, { freeOwnerOperators: 40, fleets: 5, brokers: 2 });
    runDays(w, 12, ruleBotHook);
    const lessorPaid = w.ledger.entries.filter((e) => e.from === "faucet:npc_lessor");
    expect(lessorPaid.length).toBeGreaterThan(0);
    const leasedIds = new Set(w.trucks.filter((t) => t.lease === "npc").map((t) => t.companyId));
    expect(w.receivables.filter((r) => leasedIds.has(r.payeeId) && r.holder === r.payeeId)).toHaveLength(0);
    expect(w.receivables.some((r) => leasedIds.has(r.payeeId) && r.holder === HOLDER_NPC_FACTOR)).toBe(true);
    w.ledger.assertBalanced();
  });
});

describe("credit (0.18.0): a score from the ledger, and a broker's licence that lapses with its stake", () => {
  const staked: EconomyConfig = { ...calm, token: { ...calm.token, staking: { ...calm.token.staking, enabled: true }, payment: { ...calm.token.payment, enabled: true } } };

  it("scores a new licence as middling, lowers it for bankruptcies, claims and paying from an overdraft, and prices the premium", () => {
    const w = createWorld({ cfg: staked, net, feeds: neutralFeeds, seed: 55 });
    const b = formCompany(w, { name: "Broker", role: "broker", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
    const k = staked.token.credit;
    expect(creditScore(w, b)).toBeCloseTo(k.base + k.recordPoints * k.newRecord, 6);
    expect(creditBand(creditScore(w, b))).toBe("C");
    expect(creditPremium(w, 60)).toBeCloseTo(k.premiumMax * ((k.strongScore - 60) / k.strongScore), 6);
    expect(creditPremium(w, 90)).toBe(0);
    b.bankruptcies = 2;
    b.credit = { onTimeFd: 2_000, lateFd: 8_000 };
    w.round++; // the score is cached per round
    expect(creditScore(w, b)).toBeCloseTo(k.base + k.recordPoints * 0.2 - 2 * k.bankruptcyPoints, 6);
    expect(creditBand(creditScore(w, b))).toBe("E");
  });

  it("drops a bankrupt broker's licence: no stake, no loads, until it posts the stake again", () => {
    const w = createWorld({ cfg: staked, net, feeds: neutralFeeds, seed: 56, keepLedgerEntries: true });
    const b = formCompany(w, { name: "Broker", role: "broker", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
    fund(w, b.id, 100_000);
    expect(applyAction(w, b.id, { type: "stake_fd", fd: staked.token.staking.roles.broker })).toEqual({ ok: true });
    expect(brokerLicensed(w, b)).toBe(true);
    startLiquidation(w, b);
    restart(w, b);
    expect(b.stakedFd).toBe(0);
    expect(brokerLicensed(w, b)).toBe(false);
    expect(w.ledger.entries.filter((e) => e.ref === `grant:stake:${b.id}`)).toHaveLength(0); // nothing granted
    fund(w, b.id, 80_000);
    expect(applyAction(w, b.id, { type: "stake_fd", fd: staked.token.staking.roles.broker })).toEqual({ ok: true });
    expect(brokerLicensed(w, b)).toBe(true);
  });
});

describe("launch without capital (0.18.0): the treasury's one-sided range", () => {
  it("opens with FD alone at the floor: buys pay the floor and fund the bid side, a sale before any buy is refused, later sales clear at the pool's price", () => {
    const unseeded: EconomyConfig = { ...calm, seasonClose: { ...calm.seasonClose, enabled: false }, token: { ...calm.token, enabled: true, launch: { ...calm.token.launch, seedUsd: 0 } } };
    const w = createWorld({ cfg: unseeded, net, feeds: neutralFeeds, seed: 57, keepLedgerEntries: true });
    const a = carrier(w, "A");
    fund(w, a.id, 100_000);
    a.milesTotal = 1_000;
    launchToken(w);
    const k = unseeded.token.launch;
    expect(w.ledger.balance(EXCHANGE_ACCOUNT)).toBe(k.liquidityFd);
    expect(w.token.poolUsd).toBe(0);
    expect(fdPriceUsd(w)).toBe(0);
    expect(askPriceUsd(w)).toBe(k.priceUsd);
    expect(applyAction(w, a.id, { type: "sell_fd", fd: 100 })).toEqual({ ok: false, reason: "no dollars on the bid side yet" });
    a.usd.wallet = 1_000;
    const before = w.ledger.balance(companyAccount(a.id));
    expect(applyAction(w, a.id, { type: "buy_fd", usd: 1_000 })).toEqual({ ok: true });
    const bought = w.ledger.balance(companyAccount(a.id)) - before;
    expect(bought).toBeCloseTo((1_000 * (1 - unseeded.token.exchange.buyFeePct)) / k.priceUsd, 2);
    expect(w.token.poolUsd).toBeCloseTo(1_000 * (1 - unseeded.token.exchange.buyFeePct), 6);
    // The bid side exists now: a small sale clears against it at the pool's own (lower) price.
    expect(applyAction(w, a.id, { type: "sell_fd", fd: 1_000 })).toEqual({ ok: true });
    expect(a.usd.out).toBeGreaterThan(0);
    expect(a.usd.out).toBeLessThan(1_000 * k.priceUsd);
    w.ledger.assertBalanced();
  });
});

describe("the catalogue (0.18.0, FD only): yards, upgrades, the farming-season dollar window, discounts and the vest", () => {
  const shop: EconomyConfig = { ...calm, token: { ...calm.token, enabled: true, staking: { ...calm.token.staking, enabled: true }, catalogue: { ...calm.token.catalogue, enabled: true } } };

  it("needs a yard past five trucks: an FD yard splits its price burn / treasury / reserve and locks the bond; a dollar yard in the season is held for the pool", () => {
    const w = createWorld({ cfg: shop, net, feeds: neutralFeeds, seed: 58, keepLedgerEntries: true });
    const c = carrier(w);
    fund(w, c.id, 400_000);
    expect(applyAction(w, c.id, { type: "stake_fd", fd: 100_000 })).toEqual({ ok: true }); // the 30-truck tier
    for (let i = 0; i < 5; i++) addTruck(w, c, "owned", "workhorse", "van");
    expect(truckCap(w, c)).toBe(shop.token.catalogue.trucksWithoutYard);
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false })).toEqual({ ok: false, reason: "company truck cap" });
    expect(priceIndex(w)).toBe(1); // no market yet
    const price = itemPriceFd(w, "yardSmall");
    const spec = shop.token.catalogue.items.yardSmall;
    const cash = w.ledger.balance(companyAccount(c.id));
    expect(applyAction(w, c.id, { type: "buy_item", item: "yardSmall", pay: "fd" })).toEqual({ ok: true });
    expect(c.yard).toBe("small");
    expect(cash - w.ledger.balance(companyAccount(c.id))).toBeCloseTo(price + spec.bondFd, 2);
    expect(w.ledger.balance("sink:asset_burn")).toBeCloseTo(price * shop.token.catalogue.split.burn, 2);
    expect(w.ledger.balance("alloc:treasury")).toBeCloseTo(price * shop.token.catalogue.split.treasury, 2);
    expect(w.ledger.balance("sink:asset_reserve")).toBeCloseTo(price * shop.token.catalogue.split.reserve, 2);
    expect(c.yardBondFd).toBe(spec.bondFd);
    expect(truckCap(w, c)).toBe(spec.trucks);
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false })).toEqual({ ok: true });
    // The season's dollar window: a large yard for dollars, the bond still in FD, every dollar held for the launch pool.
    c.usd.wallet = 10_000;
    const usd = itemPriceUsd(w, "yardLarge");
    expect(applyAction(w, c.id, { type: "buy_item", item: "yardLarge", pay: "usd" })).toEqual({ ok: false, reason: "over this season's dollar cap" });
    const roomy: EconomyConfig = { ...shop, token: { ...shop.token, catalogue: { ...shop.token.catalogue, usdWindow: { ...shop.token.catalogue.usdWindow, capUsdPerMc: 10_000 } } } };
    w.cfg = roomy;
    expect(applyAction(w, c.id, { type: "buy_item", item: "yardLarge", pay: "usd" })).toEqual({ ok: true });
    expect(c.yard).toBe("large");
    expect(w.token.treasury.seedEscrowUsd).toBeCloseTo(usd, 6);
    expect(c.yardBondFd).toBe(shop.token.catalogue.items.yardLarge.bondFd);
    w.ledger.assertBalanced();
  });

  it("fits upgrades that cut costs, and locked FD earns its discount", () => {
    const w = createWorld({ cfg: shop, net, feeds: neutralFeeds, seed: 59, keepLedgerEntries: true });
    const c = carrier(w);
    fund(w, c.id, 300_000);
    const t = addTruck(w, c, "owned", "workhorse", "van");
    expect(applyAction(w, c.id, { type: "buy_item", item: "apu", pay: "fd", truckId: t.id })).toEqual({ ok: true });
    expect(t.mods.apu).toBe(true);
    expect(applyAction(w, c.id, { type: "buy_item", item: "apu", pay: "fd", truckId: t.id })).toEqual({ ok: false, reason: "already fitted" });
    expect(stakeDiscount(w, c)).toBe(0);
    expect(applyAction(w, c.id, { type: "stake_fd", fd: 100_000 })).toEqual({ ok: true });
    expect(stakeDiscount(w, c)).toBe(0.1);
    runDays(w, 2);
    const idle = w.ledger.entries.filter((e) => e.to === "sink:idle_fuel" && e.from === companyAccount(c.id));
    expect(idle.length).toBeGreaterThan(0);
    const full = shop.costs.idleFuelGalPerDay * w.metrics.days.at(-1)!.fuelPrice;
    expect(idle.at(-1)!.amount).toBeCloseTo(full * 0.5 * 0.9, 0); // an APU halves it, the stake takes 10% off
  });

  it("vests the developer's FD into the pool after the cliff, never below the floor, and the dollars are revenue", () => {
    const capped: EconomyConfig = { ...calm, seasonClose: { ...calm.seasonClose, enabled: false }, token: { ...calm.token, enabled: true, circular: { ...calm.token.circular, enabled: true } } };
    const w = createWorld({ cfg: capped, net, feeds: neutralFeeds, seed: 60 });
    const a = carrier(w, "A");
    fund(w, a.id, 50_000);
    a.milesTotal = 1_000;
    launchToken(w);
    const held = w.ledger.balance("alloc:treasury");
    expect(held).toBeGreaterThan(0);
    weeklyVest(w); // inside the cliff: nothing
    expect(w.token.treasury.vestedFd).toBe(0);
    w.token.launchDay = -capped.token.treasury.vest.cliffWeeks * 7 - 1;
    for (let i = 0; i < 7; i++) w.token.priceHistory.push(w.token.launchPriceUsd / 2);
    weeklyVest(w); // below the floor: nothing
    expect(w.token.treasury.vestedFd).toBe(0);
    for (let i = 0; i < 7; i++) w.token.priceHistory.push(w.token.launchPriceUsd * 2);
    // The pool sits exactly at the launch price: a sale would push it through, so nothing sells.
    weeklyVest(w);
    expect(w.token.treasury.vestedFd).toBe(0);
    // Buyers lift the pool to four times the launch price: the week's share sells, as much of it as
    // leaves the price at or above the launch price after the sale.
    w.token.poolUsd *= 4;
    const poolUsd = w.token.poolUsd;
    const poolFd = w.ledger.balance(EXCHANGE_ACCOUNT);
    const room = Math.sqrt((poolUsd * poolFd) / w.token.launchPriceUsd) - poolFd;
    weeklyVest(w);
    expect(w.token.treasury.vestedFd).toBeCloseTo(Math.min(held * capped.token.treasury.vest.perWeekShare, room), 2);
    expect(w.token.treasury.devUsd).toBeGreaterThan(0);
    expect(w.token.poolUsd).toBeCloseTo(poolUsd - w.token.treasury.devUsd, 6);
    expect(fdPriceUsd(w)).toBeGreaterThanOrEqual(w.token.launchPriceUsd * (1 - 1e-6));
    // A pool barely above the launch price sells only what keeps it there.
    w.token.poolUsd = w.ledger.balance(EXCHANGE_ACCOUNT) * w.token.launchPriceUsd * 1.0001;
    const before = w.token.treasury.vestedFd;
    weeklyVest(w);
    expect(w.token.treasury.vestedFd - before).toBeLessThan(held * capped.token.treasury.vest.perWeekShare * 0.01);
    expect(fdPriceUsd(w)).toBeGreaterThanOrEqual(w.token.launchPriceUsd * (1 - 1e-6));
    w.ledger.assertBalanced();
  });
});

describe("the fuel tax and the lean launch (0.18.0)", () => {
  it("taxes every gallon burned in the month at the close, on the road and idling, and resets the meter", () => {
    const taxed: EconomyConfig = { ...calm, costs: { ...calm.costs, fuelTax: { enabled: true, perGal: 0.5 } } };
    const w = createWorld({ cfg: taxed, net, feeds: neutralFeeds, seed: 61 });
    const a = carrier(w, "A");
    fund(w, a.id, 50_000);
    const t = createTruck(w, a, "owned", "workhorse", "van");
    t.loadedMi = 650;
    payTripCosts(w, t, "test");
    expect(a.fuelGalMonth).toBeGreaterThan(0);
    expect(a.fuelGalMonth).toBeCloseTo(650 / effectiveMpg(taxed, t), 6);
    const gal = a.fuelGalMonth;
    const before = w.ledger.balance(companyAccount(a.id));
    monthlyFuelTax(w);
    expect(Math.abs(before - w.ledger.balance(companyAccount(a.id)) - gal * 0.5)).toBeLessThan(0.01); // the ledger keeps cents
    expect(a.fuelGalMonth).toBe(0);
    // Off, the meter still resets and nothing is charged.
    const off = createWorld({ cfg: calm, net, feeds: neutralFeeds, seed: 62 });
    const b = carrier(off, "B");
    fund(off, b.id, 1_000);
    b.fuelGalMonth = 100;
    const b0 = off.ledger.balance(companyAccount(b.id));
    monthlyFuelTax(off);
    expect(off.ledger.balance(companyAccount(b.id))).toBe(b0);
    expect(b.fuelGalMonth).toBe(0);
    w.ledger.assertBalanced();
  });

  it("burns stakes and contract stakes at launch like wallets, so every position after launch is re-posted in real FD", () => {
    const capped: EconomyConfig = { ...calm, seasonClose: { ...calm.seasonClose, enabled: false }, token: { ...calm.token, enabled: true, circular: { ...calm.token.circular, enabled: true }, staking: { ...calm.token.staking, enabled: true } } };
    const w = createWorld({ cfg: capped, net, feeds: neutralFeeds, seed: 63 });
    const a = carrier(w, "A");
    fund(w, a.id, 200_000);
    a.milesTotal = 1_000;
    const stake = capped.token.staking.truckTiers[1]![1];
    expect(applyAction(w, a.id, { type: "stake_fd", fd: stake }).ok).toBe(true);
    expect(w.ledger.balance(stakeAccount(a.id))).toBeCloseTo(stake, 2);
    launchToken(w);
    expect(w.ledger.balance(stakeAccount(a.id))).toBe(0);
    expect(a.stakedFd).toBe(0);
    expect(w.token.launch!.resetBurnedFd).toBeGreaterThanOrEqual(stake);
    // The float the dollars must support is what survived: working capital and the day-one airdrop, no stake.
    expect(w.token.launch!.floatFd).toBeCloseTo(w.ledger.balance(companyAccount(a.id)), 2);
    w.ledger.assertBalanced();
  });
});

describe("the big sinks (0.18.0): sales tax, player businesses, the maintenance market, managers", () => {
  const sinks: EconomyConfig = {
    ...calm,
    costs: { ...calm.costs, salesTax: { enabled: true, pct: 0.05 } },
    businesses: { ...calm.businesses, enabled: true },
    labor: { ...calm.labor, managers: { ...calm.labor.managers, enabled: true } },
  };
  const hubIdOf = (w: World, c: Company) => w.net.hubs[c.homeHub]!.id;
  /** A truck of `c` partway along the road from hub a to hub b, at `mile`. */
  function onLeg(w: World, c: Company, a: number, b: number, mile: number) {
    const t = createTruck(w, c, "owned", "workhorse", "van");
    const r = hubRoute(w, a, b)!;
    t.status = "loaded";
    t.hub = a;
    t.targetHub = b;
    t.place = PLACE_OF_HUB[a]!;
    t.targetPlace = PLACE_OF_HUB[b]!;
    t.legMiles = r.miles;
    t.remainingMi = r.miles - mile;
    t.shiftStartT = 1_000;
    const driver = w.staffByCompany.get(c.id)!.find((s) => s.owner)!;
    t.driverId = driver.id;
    driver.truckId = t.id;
    return { t, r };
  }
  /** A hub pair whose road passes the site, with the site's mile along it; `far` picks a road that passes no site at all. */
  function roadPast(w: World, siteId: number | null, minMile = 0, minLen = 0) {
    const n = w.net.hubs.length;
    for (let a = 0; a < n; a++)
      for (let b = 0; b < n; b++) {
        const r = a === b ? null : hubRoute(w, a, b);
        if (!r || r.miles < minLen) continue;
        const along = sitesAlong(w, r);
        if (siteId === null) {
          if (along.length === 0) return { a, b, mile: r.miles / 2, r };
          continue;
        }
        const hit = along.find((s) => s.site === siteId);
        if (hit && hit.mile >= minMile && r.miles - hit.mile >= minMile) return { a, b, mile: hit.mile, r };
      }
    throw new Error("no road fits");
  }

  it("lays truck-stop sites along the interstates, the busiest open first, priced by traffic", () => {
    const w = createWorld({ cfg: sinks, net, feeds: neutralFeeds, seed: 74 });
    expect(w.sites.length).toBeGreaterThan(sinks.businesses.sites.openAtStart);
    expect(w.sites.filter((s) => s.open)).toHaveLength(sinks.businesses.sites.openAtStart);
    expect(w.sites.every((s) => w.net.roads.edges[s.edge]!.cls === 0)).toBe(true);
    const best = bestOpenSite(w)!;
    expect(best.traffic).toBeGreaterThan(0);
    expect(w.sites.filter((s) => s.open).every((s) => s.traffic <= best.traffic)).toBe(true);
    const [lo, hi] = sinks.businesses.sites.priceRange;
    for (const s of w.sites.filter((x) => x.open)) {
      expect(sitePriceFd(w, s)).toBeGreaterThanOrEqual(sinks.businesses.kinds.truckStop.priceFd * lo - 1e-6);
      expect(sitePriceFd(w, s)).toBeLessThanOrEqual(sinks.businesses.kinds.truckStop.priceFd * hi + 1e-6);
    }
    // A road's sites come back in order of the mile they sit at.
    const r = hubRoute(w, 0, 1)!;
    const along = sitesAlong(w, r);
    for (let i = 1; i < along.length; i++) expect(along[i]!.mile).toBeGreaterThanOrEqual(along[i - 1]!.mile);
  });

  it("charges the sales tax on a purchase and on a used truck, and never on freight", () => {
    const cat: EconomyConfig = { ...sinks, token: { ...sinks.token, catalogue: { ...sinks.token.catalogue, enabled: true } } };
    const w = createWorld({ cfg: cat, net, feeds: neutralFeeds, seed: 70, keepLedgerEntries: true });
    const a = carrier(w, "A");
    fund(w, a.id, 200_000);
    const price = itemPriceFd(w, "yardSmall");
    const before = w.ledger.balance(companyAccount(a.id));
    expect(applyAction(w, a.id, { type: "buy_item", item: "yardSmall", pay: "fd" })).toEqual({ ok: true });
    const bond = cat.token.catalogue.items.yardSmall.bondFd;
    expect(before - w.ledger.balance(companyAccount(a.id))).toBeCloseTo(price + bond + price * 0.05, 2);
    expect(w.ledger.entries.filter((e) => e.to === "sink:sales_tax").reduce((s, e) => s + e.amount, 0)).toBeCloseTo(price * 0.05, 2);
    w.ledger.assertBalanced();
  });

  it("sells a shop at a hub for FD plus a bond, lets it price the hub's repairs under the NPC shop, and pays the owner the margin over parts", () => {
    const w = createWorld({ cfg: sinks, net, feeds: neutralFeeds, seed: 71, keepLedgerEntries: true });
    const owner = carrier(w, "Owner");
    const cust = carrier(w, "Customer");
    owner.homeHub = cust.homeHub;
    fund(w, owner.id, 300_000);
    fund(w, cust.id, 50_000);
    const spec = sinks.businesses.kinds.shop;
    const hubId = hubIdOf(w, owner);
    const before = w.ledger.balance(companyAccount(owner.id));
    expect(applyAction(w, owner.id, { type: "buy_business", kind: "shop", hubId })).toEqual({ ok: true });
    expect(before - w.ledger.balance(companyAccount(owner.id))).toBeCloseTo(spec.priceFd + spec.bondFd + spec.priceFd * 0.05, 2);
    expect(w.ledger.balance(contractAccount(owner.id))).toBeCloseTo(spec.bondFd, 2);
    const shop = businessesOf(w, owner.id)[0]!;
    expect(applyAction(w, owner.id, { type: "set_shop_markup", businessId: shop.id, markup: 0.9 })).toEqual({ ok: true });
    expect(shopAt(w, owner.homeHub, cust.id)).toBe(shop);
    expect(applyAction(w, owner.id, { type: "buy_business", kind: "shop", hubId })).toEqual({ ok: true });
    expect(applyAction(w, owner.id, { type: "buy_business", kind: "shop", hubId }).ok).toBe(false);
    const list = 1_000;
    const parts = list * spec.partsShare;
    const o0 = w.ledger.balance(companyAccount(owner.id));
    const c0 = w.ledger.balance(companyAccount(cust.id));
    expect(serviceBill(w, cust, cust.homeHub, list, "repairs", "test")).toBeCloseTo(900 * 1.05, 6);
    expect(c0 - w.ledger.balance(companyAccount(cust.id))).toBeCloseTo(900 * 1.05, 2);
    expect(w.ledger.balance(companyAccount(owner.id)) - o0).toBeCloseTo(900 - parts, 2);
    expect(w.ledger.entries.filter((e) => e.to === "sink:parts").reduce((s, e) => s + e.amount, 0)).toBeCloseTo(parts, 2);
    const o1 = w.ledger.balance(companyAccount(owner.id));
    expect(serviceBill(w, owner, owner.homeHub, list, "maintenance", "test")).toBeCloseTo(parts * 1.05, 6);
    expect(o1 - w.ledger.balance(companyAccount(owner.id))).toBeCloseTo(parts * 1.05, 2);
    startLiquidation(w, owner);
    expect(businessesOf(w, owner.id)).toHaveLength(0);
    expect(w.ledger.balance(contractAccount(owner.id))).toBeCloseTo(0, 2);
    expect(shopAt(w, cust.homeHub, cust.id)).toBeNull();
    w.ledger.assertBalanced();
  });

  it("gives a hub fuel station its margin, and a truck stop at a site its nightly fee for a quarter of the idling, its fuel blocks and its road-service work", () => {
    const w0 = createWorld({ cfg: sinks, net, feeds: neutralFeeds, seed: 72 });
    const site0 = bestOpenSite(w0)!;
    const road = roadPast(w0, site0.id, 120, 0);
    // The same world again, with the fuel block set to the site's mile, so the leg's second block fuels there.
    const blocked: EconomyConfig = { ...sinks, businesses: { ...sinks.businesses, fuelRule: { ...sinks.businesses.fuelRule, blockMi: Math.floor(road.mile) } } };
    const w = createWorld({ cfg: blocked, net, feeds: neutralFeeds, seed: 72, keepLedgerEntries: true });
    const owner = carrier(w, "Owner");
    const cust = carrier(w, "Customer");
    owner.homeHub = cust.homeHub;
    fund(w, owner.id, 2_000_000);
    fund(w, cust.id, 200_000);
    const hubId = hubIdOf(w, owner);
    expect(applyAction(w, owner.id, { type: "buy_business", kind: "fuelStation", hubId })).toEqual({ ok: true });
    const o0 = w.ledger.balance(companyAccount(owner.id));
    payFuel(w, cust, cust.homeHub, 1_000, "test");
    expect(w.ledger.balance(companyAccount(owner.id)) - o0).toBeCloseTo(1_000 * sinks.businesses.kinds.fuelStation.marginPct, 2);
    expect(w.ledger.entries.filter((e) => e.to === "sink:fuel").reduce((s, e) => s + e.amount, 0)).toBeCloseTo(1_000 * (1 - sinks.businesses.kinds.fuelStation.marginPct), 2);

    // The truck stop at the busiest site, priced by traffic, bonded.
    const site = bestOpenSite(w)!;
    expect(site.id).toBe(site0.id);
    const price = sitePriceFd(w, site);
    const k = sinks.businesses.kinds.truckStop;
    const o1 = w.ledger.balance(companyAccount(owner.id));
    expect(applyAction(w, owner.id, { type: "buy_business", kind: "truckStop", siteId: site.id })).toEqual({ ok: true });
    expect(o1 - w.ledger.balance(companyAccount(owner.id))).toBeCloseTo(price + k.bondFd + price * 0.05, 2);
    expect(site.businessId).toBeGreaterThan(0);
    expect(applyAction(w, cust.id, { type: "buy_business", kind: "truckStop", siteId: site.id }).ok).toBe(false);
    const stop = businessesOf(w, owner.id).find((b) => b.kind === "truckStop")!;
    expect(applyAction(w, owner.id, { type: "set_shop_markup", businessId: stop.id, markup: 1.2 })).toEqual({ ok: true });

    // A customer's truck resting at the site's mile: a quarter of the idling, and the nightly fee (taxed) to the owner.
    const { t, r } = onLeg(w, cust, road.a, road.b, road.mile);
    expect(legMile(t)).toBeCloseTo(road.mile, 6);
    const o2 = w.ledger.balance(companyAccount(owner.id));
    const idleBefore = w.ledger.entries.filter((e) => e.to === "sink:idle_fuel").reduce((s, e) => s + e.amount, 0);
    restOnRoad(w, t);
    restOnRoad(w, t); // the same shift: charged once
    expect(w.ledger.balance(companyAccount(owner.id)) - o2).toBeCloseTo(k.nightlyFd, 2);
    const idle = w.ledger.entries.filter((e) => e.to === "sink:idle_fuel").reduce((s, e) => s + e.amount, 0) - idleBefore;
    expect(idle).toBeCloseTo(sinks.costs.idleFuelGalPerDay * k.idleFuelMult * fuelPriceNow(w), 1);

    // Road service: the truck stop's shop comes out (no drive: the truck sits at its mile), at its markup plus the call-out fee.
    const rs = sinks.businesses.roadService;
    const o3 = w.ledger.balance(companyAccount(owner.id));
    const service = roadService(w, t, cust, 1_000);
    expect(service.delayMin).toBe(0);
    expect(service.paid).toBeCloseTo((1_000 * 1.2 + rs.callOutFd) * 1.05, 6);
    expect(w.ledger.balance(companyAccount(owner.id)) - o3).toBeCloseTo(1_000 * (1.2 - k.partsShare) + rs.callOutFd, 2);

    // The leg's fuel by the block rule: the first block at the origin, the second at the stop (its margin to the owner), the rest at the pump.
    const o4 = w.ledger.balance(companyAccount(owner.id));
    payLegFuel(w, cust, t, 1_000, r.miles, "test");
    const blockMi = blocked.businesses.fuelRule.blockMi;
    // The first block fuels at the origin: the owner's hub station too, when the road starts at that hub.
    let expected = road.a === cust.homeHub ? ((1_000 * Math.min(blockMi, r.miles)) / r.miles) * sinks.businesses.kinds.fuelStation.marginPct : 0;
    for (let mile = blockMi; mile < r.miles; mile += blockMi) {
      if (Math.abs(mile - road.mile) <= blocked.businesses.fuelRule.stopRangeMi) expected += ((1_000 * Math.min(blockMi, r.miles - mile)) / r.miles) * k.fuelMarginPct;
    }
    expect(expected).toBeGreaterThan(road.a === cust.homeHub ? 1 : 0); // the second block fuels at the stop
    expect(w.ledger.balance(companyAccount(owner.id)) - o4).toBeCloseTo(expected, 2);

    // With no provider in reach, NPC road service at its markup and its wait.
    const far = roadPast(w, null);
    const { t: t2 } = onLeg(w, cust, far.a, far.b, far.mile);
    const npc = roadService(w, t2, cust, 1_000);
    expect(npc.delayMin).toBe(rs.npcHours * 60);
    expect(npc.paid).toBeCloseTo(1_000 * rs.npcMarkup * 1.05, 6);
    w.ledger.assertBalanced();
  });

  it("hires managers from the pool, needs an operations manager past four trucks (one per twenty-five), and the best one's skill sets the edge", () => {
    const w = createWorld({ cfg: sinks, net, feeds: neutralFeeds, seed: 73, keepLedgerEntries: true });
    const a = carrier(w, "A");
    fund(w, a.id, 100_000);
    const k = sinks.labor.managers;
    for (let i = 0; i < k.maint.requiredAbove + 2; i++) createTruck(w, a, "owned", "workhorse", "van");
    expect(opsCap(w, a)).toBe(k.ops.requiredAbove);
    expect(managerBreakdownMult(w, a)).toBe(k.maint.breakdownWithout);
    const without = dispatchProfile(w, a, k.ops.requiredAbove + 2).noise;
    const t = w.trucksByCompany.get(a.id)![0]!;
    const owner = w.staffByCompany.get(a.id)!.find((s) => s.owner)!;
    t.driverId = owner.id;
    owner.truckId = t.id;
    syncTruck(w, t);
    const skill0 = t.driverSkill;
    // The pool has managers; the best operations manager and any maintenance manager are hired at their ask.
    const ops = poolStaff(w, "opsManager").sort((p, q) => q.skill - p.skill || p.id - q.id)[0]!;
    const maint = poolStaff(w, "maintManager")[0]!;
    expect(ops.skill).toBeGreaterThan(0);
    expect(applyAction(w, a.id, { type: "offer_staff", staffId: ops.id, pay: asking(w, ops) })).toEqual({ ok: true });
    expect(applyAction(w, a.id, { type: "offer_staff", staffId: maint.id, pay: asking(w, maint) })).toEqual({ ok: true });
    expect(t.driverSkill).toBeCloseTo(Math.min(1, skill0 + k.ops.skillBonus * ops.skill), 9);
    expect(opsCap(w, a)).toBe(k.ops.requiredAbove + k.ops.span);
    expect(managerBreakdownMult(w, a)).toBeCloseTo(1 - (1 - k.maint.breakdownWith) * maint.skill, 9);
    expect(dispatchProfile(w, a, k.ops.requiredAbove + 2).noise).toBeLessThan(without);
    // Weekly pay: a full week each, a sink.
    const before = w.ledger.balance(companyAccount(a.id));
    payDispatchers(w);
    expect(before - w.ledger.balance(companyAccount(a.id))).toBeCloseTo(ops.pay + maint.pay, 2);
    expect(w.ledger.entries.filter((e) => e.to === "sink:management").reduce((s, e) => s + e.amount, 0)).toBeCloseTo(ops.pay + maint.pay, 2);
    // Let the operations manager go: the cap falls back and the fleet is over it again.
    expect(applyAction(w, a.id, { type: "release_staff", staffId: ops.id })).toEqual({ ok: true });
    expect(opsCap(w, a)).toBe(k.ops.requiredAbove);
    w.ledger.assertBalanced();
  });
});

describe("terrain (0.18.0, Phase A): climb, grades and passes on the road", () => {
  const hilly: EconomyConfig = { ...calm, roads: { ...calm.roads, terrain: { ...calm.roads.terrain, enabled: true } } };

  it("reads the elevation grid, and gives mountain lanes their climb where flat lanes have almost none", () => {
    expect(elevationAt(39.7, -105.0)).toBeGreaterThan(1_400); // Denver
    expect(elevationAt(29.8, -95.4)).toBeLessThan(60); // Houston
    expect(elevationAt(0, 0)).toBe(0); // beyond the map
    const w = createWorld({ cfg: hilly, net, feeds: neutralFeeds, seed: 80 });
    const byClimb = [...w.net.lanes].sort((a, b) => b.climbM / b.miles - a.climbM / a.miles);
    const steep = byClimb[0]!;
    const flat = byClimb.at(-1)!;
    expect(steep.climbM).toBeGreaterThan(1_000);
    expect(steep.mountainMi).toBeGreaterThan(0);
    expect(flat.climbM / flat.miles).toBeLessThan(steep.climbM / steep.miles / 5);
    expect(w.net.lanes.some((l) => l.passMi > 0)).toBe(true);
  });

  it("burns more fuel on a climb, runs slower on grades, and a winter pass can close the road", () => {
    const sure: EconomyConfig = { ...hilly, roads: { ...hilly.roads, terrain: { ...hilly.roads.terrain, closureOddsPerPassMi: 1e6 } } };
    const w = createWorld({ cfg: sure, net, feeds: neutralFeeds, seed: 81, keepLedgerEntries: true });
    const a = carrier(w, "A");
    fund(w, a.id, 50_000);
    const lane = [...w.net.lanes].filter((l) => l.passMi > 0).sort((p, q) => q.climbM - p.climbM)[0]!;
    const r = hubRoute(w, lane.origin, lane.dest)!;
    const t = createTruck(w, a, "owned", "workhorse", "van");
    t.status = "loaded";
    t.hub = lane.origin;
    t.targetHub = lane.dest;
    t.place = PLACE_OF_HUB[lane.origin]!;
    t.targetPlace = PLACE_OF_HUB[lane.dest]!;
    t.remainingMi = r.miles;
    expect(winterNow(w)).toBe(true); // the world starts in January
    beginLeg(w, t, r);
    expect(t.legMiles).toBe(r.miles);
    expect(t.legClimbM).toBeCloseTo(lane.climbM, 3);
    expect(t.legMountainMi).toBeGreaterThan(0);
    expect(t.legPassMi).toBeGreaterThan(0);
    expect(t.breakdownMin).toBeGreaterThanOrEqual(sure.roads.terrain.closureHours[0] * 60); // held by the closure
    // The same miles on the flat against this climb, the same driver at the wheel: the difference is the climb's gallons at the pump price.
    const flat = createTruck(w, a, "owned", "workhorse", "van");
    flat.legMiles = r.miles;
    flat.driverSkill = t.driverSkill;
    t.loadedMi = r.miles;
    flat.loadedMi = r.miles;
    const fuelSunk = () => w.ledger.entries.filter((e) => e.to === "sink:fuel").reduce((s, e) => s + e.amount, 0);
    const f0 = fuelSunk();
    payTripCosts(w, t, "mountain");
    const mountainFuel = fuelSunk() - f0;
    payTripCosts(w, flat, "flat");
    const flatFuel = fuelSunk() - f0 - mountainFuel;
    expect(mountainFuel - flatFuel).toBeCloseTo(sure.roads.terrain.fuelGalPerClimbM * lane.climbM * fuelPriceNow(w), 0);
    w.ledger.assertBalanced();
  });
});
