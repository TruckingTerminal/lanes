import { describe, expect, it } from "vitest";
import { economyConfig as cfg, withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds, syntheticCassCycle, PLACE_OF_HUB, PLACE_ROWS } from "@lanes/data";
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
  frequencyFee,
  sellLimitShare,
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
  factoringRate,
  brokerApFd,
  bookingCapBlock,
  apCapBlock,
  brokerBooks,
  CIRCULAR_BURNS,
  BURN_TAGS,
  processLiquidations,
  bandState,
  dailyPopulationDial,
  dialState,
  lockSlash,
  activeLocks,
  noteDiscount,
  type Load,
  type TruckSpec,
  type World,
} from "@lanes/engine";
import { monthlyFuelTax } from "../src/fuelTax.js";
import { stakeAccount } from "../src/staking.js";
import { payTripCosts } from "../src/trips.js";
import { createTruck } from "../src/world.js";
import { businessesOf, payFuel, payLegFuel, roadService, serviceBill, shopAt } from "../src/businesses.js";
import { bestOpenSite, hasRoom, legMile, parkForTheNight, planNight, siteHere, sitePriceFd, sitesAlong } from "../src/sites.js";
import { hubRoute, syncTruck } from "../src/world.js";
import { fuelPrice as fuelPriceNow } from "../src/economics.js";
import { beginLeg } from "../src/trips.js";
import { winterNow } from "../src/safety.js";
import { elevationAt } from "@lanes/data";
import { dispatchProfile, managerBreakdownMult, opsCap, payDispatchers, poolOf as poolStaff } from "../src/labor.js";
import { askingPay as asking } from "../src/world.js";
import type { Company, Truck } from "../src/types.js";
import { aroundTheClock, deliveryWait, dockRule, nextOpen, pickupWait, setSlot } from "../src/docks.js";
import { highValueMult, theftRatePerMile, theftRiskAt } from "../src/risk.js";
import { startLoading } from "../src/trips.js";
import { dockWaitCost } from "../src/standingOrders.js";
import { ceilingFd, outstandingFd, queuedAirdropFd } from "../src/ceiling.js";
import { debtToEquity, financedCashNeed, purchaseTerms, riskPremium, riskStats } from "../src/purchaseLoans.js";
import { detachTruck, truckById } from "../src/world.js";
import { loadFactor, managerEffect, managersNeeded, offerStaff, securityPremiumMult, securityTheftMult } from "../src/labor.js";
import { acceptOffer, contractRoom, contractSlots, contractStakeAccount, rejectTender, weeklyContracts } from "../src/contracts.js";
import { scaleDiscount, scaleDiscountFor } from "../src/scale.js";
import { bridgeAccount, bridgeDelayDays, buyFeeRate, convictionForfeit, dailyBridge, launchFeeRate, launchTaxRate, sizeFeeRate } from "../src/token.js";
import { logbookCatalogue } from "../src/logbook.js";
import { dailyLadder, layerBlock, layerOpen } from "../src/ladder.js";
import { dealerPrice, deliverOrders, lotPrice } from "../src/dealer.js";
import { salesTaxOn } from "../src/salesTax.js";
import { bountyAccount, crewFeeFd, crewOn, crewStakeAccount, crewStrike, fenceShareOf, fittingsCut, notoriety } from "../src/robbery.js";
import { truckValue } from "../src/dealer.js";
import { stealCargo } from "../src/risk.js";
import { chopBoardMult, chopBoardPrice, crewById, heatOf, lotFeeFd, lotOdds, yardCut } from "../src/backlot.js";
import { lotStrike } from "../src/robbery.js";
import { complianceReview } from "../src/safety.js";
import { dayOf } from "../src/clock.js";
import { dockWaitTheft } from "../src/trips.js";
import type { Contract } from "../src/types.js";
import { COMMODITY_INDEX } from "@lanes/data";
import { ordersWaitForHand } from "../src/standingOrders.js";
import { hubMiles } from "../src/world.js";
import type { StandingOrder } from "../src/types.js";

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
    commodity: 0, originPlace: PLACE_OF_HUB[lane.origin]!, destPlace: PLACE_OF_HUB[lane.dest]!, appointmentT: 1e12, slotT: 0, routeHours: lane.miles / 50, routeTollFd: 0, localUntilRound: 0, contractId: 0, tenderedTo: 0, tenderUntil: 0,
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
  function longHaul(seed: number, c: EconomyConfig = calm, onHour?: (t: Truck, offBefore: number | undefined, shiftBefore: number | null) => void) {
    const w = createWorld({ cfg: c, net, feeds: neutralFeeds, seed });
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
      const offBefore = truck.offDutySinceT;
      const shiftBefore = truck.shiftStartT;
      runDays(w, 1 / 24);
      onHour?.(truck, offBefore, shiftBefore);
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

  it("R12 at its defaults leaves today's rule untouched: no field set, the 24-hour reset", () => {
    const { truck, milesByDutyDay } = longHaul(11);
    expect([truck.offDutySinceT, truck.breakShiftT, truck.pauseMin, truck.fuelMi]).toEqual([undefined, undefined, undefined, undefined]);
    expect(milesByDutyDay.length).toBeGreaterThan(1);
  });

  it("R12 at its values: the hours come back only after 10 hours off, with a break and fuel stops on the way", () => {
    const r12: EconomyConfig = { ...calm, hos: { ...calm.hos, restHours: 10, breakMinutes: 30 }, fuel: { ...calm.fuel, stopEveryMi: 400, stopMinutes: 15 } };
    const gaps: number[] = [];
    const { truck, milesByDutyDay, lane } = longHaul(11, r12, (t, offBefore, shiftBefore) => {
      // A new duty day opened this hour: it is at least 10 hours after the truck last drove.
      if (shiftBefore !== null && t.shiftStartT !== shiftBefore && offBefore !== undefined) gaps.push(t.shiftStartT! - offBefore);
      expect(t.shiftDrivenMin).toBeLessThanOrEqual(r12.hos.drivingHoursPerDay * 60 + 1e-6);
    });
    expect(lane.miles).toBeGreaterThan(1100);
    expect(milesByDutyDay.length).toBeGreaterThan(1);
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(10 * 60 - 1e-6);
    expect(truck.breakShiftT).toBeDefined();
    expect(truck.fuelMi).toBeDefined();
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
    expect(w.ledger.locked(companyAccount(a.id))).toBeCloseTo(keep, 2);
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

describe("the supply ceiling (2026-10-31): complete supply control", () => {
  // A circular economy that launches at day ~36, with the vest selling from launch so it can be held.
  const ceil = (over: Partial<EconomyConfig["token"]["supplyCeiling"]>, betaYears = 0.1): EconomyConfig => ({
    ...calm,
    seasonClose: { ...calm.seasonClose, enabled: false },
    token: {
      ...calm.token,
      enabled: true,
      betaYears,
      circular: { ...calm.token.circular, enabled: true },
      treasury: { ...calm.token.treasury, vest: { ...calm.token.treasury.vest, cliffWeeks: 0 } },
      supplyCeiling: { ...calm.token.supplyCeiling, enabled: true, ...over },
    },
  });

  it("holds the airdrop's slices and the vest while there's no room, and pays the queue back once there is", () => {
    // No room: the dial can't cut (its floor is normal rates) and the target sits far under the supply.
    const w = createWorld({ cfg: ceil({ growth: 0, rateFloor: 1, headroom: 0.5 }), net, feeds: neutralFeeds, seed: 61 });
    populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 4 });
    runDays(w, Math.round(0.1 * cfg.time.daysPerSeason) + 30, ruleBotHook);
    const st = w.token.ceiling;
    expect(st.baseFd).toBeGreaterThan(0);
    expect(ceilingFd(w)).toBeCloseTo(st.baseFd!, 6); // a flat path
    expect(st.weeksHolding).toBeGreaterThanOrEqual(3);
    expect(st.vestHeldWeeks).toBe(st.weeksHolding);
    expect(w.token.treasury.vestedFd).toBe(0);
    const queued = queuedAirdropFd(w);
    expect(queued).toBeGreaterThan(0);
    // Owed, not lost: unlocked slices are either paid or queued.
    const unlocked = w.companies.reduce((s, c) => s + (c.airdrop?.unlockedFd ?? 0), 0);
    expect(w.token.airdrop.mintedFd + queued + w.token.airdrop.forfeitedFd).toBeGreaterThanOrEqual(unlocked - 0.01);
    // Room again (the path steepens well past what this fast-growing test world adds, and the headroom
    // goes): the queue is paid out of it.
    const k = w.cfg.token.supplyCeiling as { growth: number; headroom: number };
    k.growth = 100;
    k.headroom = 0;
    const minted = w.token.airdrop.mintedFd;
    runDays(w, 21, ruleBotHook);
    expect(st.releasedFd).toBeGreaterThan(0);
    expect(queuedAirdropFd(w)).toBeLessThan(queued);
    expect(w.token.airdrop.mintedFd).toBeGreaterThan(minted);
    w.ledger.assertBalanced();
  });

  it("keeps the dial between its floor and the rates at launch, cutting while the supply runs over its path", () => {
    // A small test world grows far faster than its sinks after launch, so the flat path is overrun: the dial
    // cuts to its floor and stays within bounds, and the payouts wait. (Whether the full economy stays under
    // its path is the batches' question.)
    const w = createWorld({ cfg: ceil({ growth: 0, headroom: 0.02, stepPerWeek: 0.05, rateFloor: 0.8 }), net, feeds: neutralFeeds, seed: 62 });
    populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 4 });
    const mults: number[] = [];
    runDays(w, Math.round(0.1 * cfg.time.daysPerSeason) + 60, ruleBotHook, (d) => {
      if (d.ceilingFd > 0) mults.push(d.rateMult);
    });
    expect(mults.length).toBeGreaterThan(50);
    // The dial runs from where rates stood at launch down to 80% of that, never above it.
    const top = w.token.ceiling.launchMult;
    for (const m of mults) {
      expect(m).toBeGreaterThanOrEqual(0.8 * top - 1e-9);
      expect(m).toBeLessThanOrEqual(top + 1e-9);
    }
    expect(outstandingFd(w)).toBeGreaterThan(ceilingFd(w));
    expect(Math.min(...mults)).toBeCloseTo(0.8 * top, 9);
    expect(w.token.ceiling.weeksAtFloor).toBeGreaterThan(0);
    expect(w.token.ceiling.weeksHolding).toBeGreaterThan(0);
    expect(queuedAirdropFd(w)).toBeGreaterThan(0);
  });

  it("replays exactly from the seed with the ceiling on", () => {
    const run = () => {
      const w = createWorld({ cfg: ceil({ growth: 0.1, headroom: 0.02, rateFloor: 0.8 }, 0.05), net, feeds: { ...neutralFeeds, cycle: syntheticCassCycle({ seed: 63 }) }, seed: 63 });
      populate(w, { freeOwnerOperators: 30, fleets: 6, brokers: 3 });
      runDays(w, 45, ruleBotHook);
      return { prices: w.token.priceHistory, supply: w.ledger.supply(), mult: w.stab.rateMult, queued: queuedAirdropFd(w), ceiling: w.token.ceiling };
    };
    expect(run()).toEqual(run());
  });
});

describe("trucks and the money behind them (2026-10-31): leases by value, purchase loans, the free tier", () => {
  // Dear trucks (ten times the base list), so a lease's value floor and a loan's sizes stand out.
  const dear = (c: EconomyConfig): EconomyConfig => ({
    ...c,
    dealerFd: { tractor: { workhorse: 140_000, highwayPro: 320_000, flagship: 700_000 }, trailer: { van: 40_000, reefer: 100_000, flatbed: 70_000 } },
  });
  const byValue: EconomyConfig = dear({ ...calm, freeEntry: { ...calm.freeEntry, leases: { ...calm.freeEntry.leases, byValue: { ...calm.freeEntry.leases.byValue, enabled: true } } } });
  const lending: EconomyConfig = dear({ ...calm, equipmentFinance: { ...calm.equipmentFinance, purchase: { ...calm.equipmentFinance.purchase, enabled: true } } });

  it("prices an NPC lease by value: the deposit up front, a weekly floor on the truck's value, and the deposit back when it's returned", () => {
    const w = createWorld({ cfg: byValue, net, feeds: neutralFeeds, seed: 71, keepLedgerEntries: true });
    const c = carrier(w);
    const acct = companyAccount(c.id);
    addTruck(w, c, "owned", "workhorse", "van");
    const k = byValue.freeEntry.leases.byValue;
    const value = 140_000 + 100_000; // a new Workhorse and reefer at list
    fund(w, c.id, k.depositShare * value - 1 - w.ledger.balance(acct));
    expect(applyAction(w, c.id, { type: "lease_truck", trailer: "reefer" })).toEqual({ ok: false, reason: "not enough FD for the lessor's deposit" });
    fund(w, c.id, 1_000);
    const before = w.ledger.balance(acct);
    expect(applyAction(w, c.id, { type: "lease_truck", trailer: "reefer" }).ok).toBe(true);
    const leased = w.trucksByCompany.get(c.id)!.find((t) => t.lease === "lessor")!;
    expect(leased.depositFd).toBeCloseTo(k.depositShare * value, 2);
    expect(before - w.ledger.balance(acct)).toBeCloseTo(k.depositShare * value, 2);
    // Idle, it pays the floor: a share of its value, well over the flat minimum.
    runDays(w, 7);
    const rent = w.ledger.entries.filter((e) => e.ref === `rent:${leased.id}`).reduce((s, e) => s + e.amount, 0);
    expect(rent).toBeCloseTo(k.weeklyShareOfValue * value, 2);
    expect(rent).toBeGreaterThan(byValue.freeEntry.leases.minWeeklyFd);
    runDays(w, byValue.freeEntry.leases.minTermDays);
    const id = leased.id;
    expect(applyAction(w, c.id, { type: "return_lease", truckId: id }).ok).toBe(true);
    const back = w.ledger.entries.filter((e) => e.from === "faucet:lease_deposit" && e.ref === `deposit:${id}`).reduce((s, e) => s + e.amount, 0);
    expect(back).toBeCloseTo(k.depositShare * value, 2);
    w.ledger.assertBalanced();
  });

  it("holds the free path's deposit back from its settlements, and pays it back when an owned truck replaces the lease", () => {
    const w = createWorld({ cfg: byValue, net, feeds: neutralFeeds, seed: 73, keepLedgerEntries: true });
    populate(w, { freeOwnerOperators: 30, fleets: 4, brokers: 3 });
    const k = byValue.freeEntry.leases.byValue;
    const due = k.depositShare * k.starterValueShare * (140_000 + 40_000);
    runDays(w, 20, ruleBotHook);
    const starters = w.trucks.filter((t) => t.lease === "npc" && t.companyId !== 0);
    expect(starters.length).toBeGreaterThan(10);
    for (const t of starters) {
      expect(t.depositDueFd).toBeCloseTo(due, 2);
      expect(t.depositFd).toBeLessThanOrEqual(due + 1e-6);
    }
    const held = starters.filter((t) => t.depositFd > 0);
    expect(held.length).toBeGreaterThan(0);
    // A free owner-operator buys its first truck: the lease goes back and so does the deposit.
    const t = held.find((x) => x.status === "idle") ?? held[0]!;
    const c = w.companies[t.companyId - 1]!;
    const deposit = t.depositFd;
    fund(w, c.id, 400_000);
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: true }).ok).toBe(true);
    runDays(w, 60, ruleBotHook);
    expect(t.lease).toBe("owned");
    const back = w.ledger.entries.filter((e) => e.from === "faucet:lease_deposit" && e.ref === `deposit:${t.id}`).reduce((s, e) => s + e.amount, 0);
    expect(back).toBeGreaterThanOrEqual(deposit - 1e-6);
    expect(t.depositFd).toBe(0);
    w.ledger.assertBalanced();
  });

  it("finances a truck on the NPC lender: the down payment and stake from the buyer, weekly payments, the truck as security, and taken back on default", () => {
    const w = createWorld({ cfg: lending, net, feeds: neutralFeeds, seed: 72, keepLedgerEntries: true });
    const c = carrier(w);
    const acct = companyAccount(c.id);
    const price = 140_000 + 40_000; // a Workhorse and van at list
    const terms = purchaseTerms(w, c);
    fund(w, c.id, financedCashNeed(w, c, price) + 10 - w.ledger.balance(acct));
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false })).toEqual({ ok: false, reason: "insufficient FD" });
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, finance: true }).ok).toBe(true);
    const loan = w.purchaseLoans[0]!;
    expect(loan.originalFd).toBeCloseTo(price * (1 - terms.downShare), 2);
    expect(w.ledger.balance(`co:loanstake:${loan.id}`)).toBeCloseTo(loan.originalFd * lending.equipmentFinance.purchase.stakeShare, 2);
    expect(w.ledger.balance(acct)).toBeCloseTo(10, 1);
    // Cash for the payments; the truck arrives and secures its loan.
    fund(w, c.id, 30_000);
    runDays(w, 45);
    const truck = w.trucksByCompany.get(c.id)!.find((t) => t.lease === "owned")!;
    expect(loan.truckId).toBe(truck.id);
    expect(loan.status).toBe("active");
    expect(loan.principalFd).toBeLessThan(loan.originalFd - 5 * (loan.originalFd / loan.termWeeks));
    expect(w.purchaseLending.interestFd).toBeGreaterThan(0);
    // Broke, with an old truck worth less than it owes: two missed payments, then the lender takes it.
    w.ledger.post(w.t, acct, "sink:permits", w.ledger.balance(acct), "test");
    truck.odometer = 950_000;
    runDays(w, 21);
    expect(w.purchaseLending.defaults).toBe(1);
    expect(w.purchaseLending.seized).toBe(1);
    expect(truck.status).toBe("retired");
    expect(w.trucksByCompany.get(c.id)!.length).toBe(0);
    expect(w.purchaseLending.stakeSlashedFd).toBeGreaterThan(0);
    expect(w.purchaseLending.writtenOffFd).toBeGreaterThan(0);
    expect(w.ledger.balance(`co:loanstake:${loan.id}`)).toBeCloseTo(0, 2);
    expect(loan.status).toBe("closed");
    w.ledger.assertBalanced();
  });

  it("risk pricing (purchase.risk, off by default): a thin borrower pays a premium on its leverage, and in a bust the covenant defaults it on the first miss", () => {
    expect(cfg.equipmentFinance.purchase.risk.enabled).toBe(false);
    const risky: EconomyConfig = { ...lending, equipmentFinance: { ...lending.equipmentFinance, purchase: { ...lending.equipmentFinance.purchase, risk: { ...lending.equipmentFinance.purchase.risk, enabled: true } } } };
    // A bust all the way through: the freight cycle at 0.8, under the covenant's 0.9.
    const w = createWorld({ cfg: risky, net, feeds: { ...neutralFeeds, cycle: () => 0.8 }, seed: 72, keepLedgerEntries: true });
    const c = carrier(w);
    const acct = companyAccount(c.id);
    const price = 140_000 + 40_000;
    fund(w, c.id, financedCashNeed(w, c, price) + 10 - w.ledger.balance(acct));
    expect(debtToEquity(w, c)).toBe(0);
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, finance: true }).ok).toBe(true);
    const loan = w.purchaseLoans[0]!;
    expect(debtToEquity(w, c)).toBeGreaterThan(risky.equipmentFinance.purchase.risk.freeDebtToEquity);
    // Cash for two or three weeks of payments, well under the covenant's eight: a premium and a breach every week.
    fund(w, c.id, 6_000);
    const premium = riskPremium(w, c);
    expect(premium.breach).toBe(true);
    expect(premium.rate).toBeGreaterThan(risky.equipmentFinance.purchase.risk.covenant.premium);
    for (let d = 0; d < 70 && w.purchaseLending.defaults === 0; d++) runDays(w, 1);
    expect(w.ledger.entries.some((e) => e.to === "sink:loan_risk" && e.ref === `loan:${loan.id}`)).toBe(true);
    expect(riskStats(w).premiumFd).toBeGreaterThan(0);
    expect(riskStats(w).breachWeeks).toBeGreaterThan(0);
    // The first miss defaulted it, not the second.
    expect(w.purchaseLending.defaults).toBe(1);
    expect(loan.missed).toBe(1);
    expect(riskStats(w).covenantDefaults).toBe(1);
    w.ledger.assertBalanced();
  });

  it("settles a purchase loan from the owner's cash when its truck leaves (a sale, a trade-in, a write-off), and gives the stake back", () => {
    const w = createWorld({ cfg: lending, net, feeds: neutralFeeds, seed: 74, keepLedgerEntries: true });
    const c = carrier(w);
    const acct = companyAccount(c.id);
    fund(w, c.id, 300_000);
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, finance: true }).ok).toBe(true);
    runDays(w, 45);
    const loan = w.purchaseLoans[0]!;
    const truck = truckById(w, loan.truckId);
    const stake = w.ledger.balance(`co:loanstake:${loan.id}`);
    const owed = loan.principalFd;
    const cash = w.ledger.balance(acct);
    detachTruck(w, truck);
    expect(loan.status).toBe("repaid");
    expect(w.ledger.balance(`co:loanstake:${loan.id}`)).toBe(0);
    expect(w.ledger.balance(acct)).toBeCloseTo(cash - owed + stake, 2);
    w.ledger.assertBalanced();
  });

  it("the free tier: spend-only earnings until a truck is owned, or no free path at all after launch", () => {
    const run = (mode: "spendOnly" | "none") => {
      const c: EconomyConfig = { ...calm, seasonClose: { ...calm.seasonClose, enabled: false }, freeEntry: { ...calm.freeEntry, freePath: mode }, token: { ...calm.token, enabled: true, betaYears: 0.05, newCompanies: { ...calm.token.newCompanies, perWeek: 5 } } };
      const w = createWorld({ cfg: c, net, feeds: neutralFeeds, seed: 75 });
      populate(w, { freeOwnerOperators: 30, fleets: 4, brokers: 3 });
      runDays(w, 50, ruleBotHook);
      return w;
    };
    const spend = run("spendOnly");
    expect(spend.token.launchDay).not.toBeNull();
    const onFreePath = spend.companies.filter((x) => (spend.trucksByCompany.get(x.id) ?? []).some((t) => t.lease === "npc"));
    expect(onFreePath.some((x) => x.freePathLockedFd > 0)).toBe(true);
    // Spending draws the lock down as it happens (ledger.ts); the free path's counter is clamped to it at the unlock.
    for (const x of onFreePath) expect(spend.ledger.locked(companyAccount(x.id))).toBeGreaterThanOrEqual(0);
    // Off the free path (its own truck arrived): what it earned there is sellable again.
    const graduated = spend.companies.filter((y) => y.freePath && y.firstOwnedTruckDay !== null && !(spend.trucksByCompany.get(y.id) ?? []).some((t) => t.lease === "npc"));
    expect(graduated.length).toBeGreaterThan(0);
    for (const x of graduated) expect(x.freePathLockedFd).toBe(0);
    const none = run("none");
    const newcomers = none.companies.filter((x) => x.strategy.startsWith("new:") || x.strategy.startsWith("farm:new-"));
    expect(newcomers.length).toBeGreaterThan(0);
    for (const x of newcomers) {
      expect(x.freePath).toBe(false);
      expect((none.trucksByCompany.get(x.id) ?? []).some((t) => t.lease === "npc")).toBe(false);
    }
  });

  it("replays exactly from the seed with leases by value, purchase loans and the spend-only free tier on", () => {
    const all: EconomyConfig = {
      ...lending,
      seasonClose: { ...calm.seasonClose, enabled: false },
      freeEntry: { ...byValue.freeEntry, freePath: "spendOnly" },
      token: { ...calm.token, enabled: true, betaYears: 0.05, newCompanies: { ...calm.token.newCompanies, perWeek: 3 } },
    };
    const run = () => {
      const w = createWorld({ cfg: all, net, feeds: { ...neutralFeeds, cycle: syntheticCassCycle({ seed: 76 }) }, seed: 76 });
      populate(w, { freeOwnerOperators: 30, fleets: 6, brokers: 3 });
      runDays(w, 45, ruleBotHook);
      return { supply: w.ledger.supply(), loans: w.purchaseLoans.map((l) => [l.borrowerId, l.principalFd, l.status]), deposits: w.trucks.map((t) => t.depositFd), prices: w.token.priceHistory };
    };
    expect(run()).toEqual(run());
  });
});

describe("staff, sales and direct freight (2026-10-31): the ladder, the optional roles, stake-backed contracts, scale and the early-sale tax", () => {
  const ladderCfg: EconomyConfig = {
    ...calm,
    labor: {
      ...calm.labor,
      owner: { ...calm.labor.owner, span: 2 },
      dispatcher: { ...calm.labor.dispatcher, span: [10, 10] },
      ladder: { ...calm.labor.ladder, enabled: true },
      managers: { ...calm.labor.managers, enabled: true, roles: true, ops: { ...calm.labor.managers.ops, requiredAbove: 7, span: 20 }, maint: { ...calm.labor.managers.maint, requiredAbove: 4, span: 15 } },
    },
  };

  it("the ladder: full strength to half a span, sliding to 70% at a full one (less for the skilled); the whole fleet counts against each span", () => {
    const w = createWorld({ cfg: ladderCfg, net, feeds: neutralFeeds, seed: 81 });
    expect(loadFactor(w, 0.5, 0)).toBe(1);
    expect(loadFactor(w, 0.75, 0)).toBeCloseTo(0.85, 9);
    expect(loadFactor(w, 1, 0)).toBeCloseTo(0.7, 9);
    expect(loadFactor(w, 1, 1)).toBeCloseTo(0.85, 9);
    expect(managersNeeded(w, "ops", 7)).toBe(0);
    expect(managersNeeded(w, "ops", 8)).toBe(1);
    expect(managersNeeded(w, "ops", 20)).toBe(1);
    expect(managersNeeded(w, "ops", 21)).toBe(2);
    expect(managersNeeded(w, "maint", 4)).toBe(0);
    expect(managersNeeded(w, "maint", 5)).toBe(1);
    expect(managersNeeded(w, "maint", 16)).toBe(2);
    const c = carrier(w);
    expect(opsCap(w, c)).toBe(7);
    // Dispatch: one dispatcher on a full span of trucks works worse than the same team on half of it.
    for (let i = 0; i < 12; i++) addTruck(w, c, "owned", "workhorse", "van");
    const d = poolStaff(w, "dispatcher").sort((a, b) => a.skill - b.skill)[0]!;
    expect(offerStaff(w, c, d, asking(w, d) * 1.2, 0)).toBeNull();
    const full = dispatchProfile(w, c, 12).skill;
    const half = dispatchProfile(w, c, 7).skill;
    expect(full).toBeLessThan(half);
  });

  it("the optional roles: a CEO lifts every manager's edge, a security manager cuts theft odds and the premium", () => {
    const w = createWorld({ cfg: ladderCfg, net, feeds: neutralFeeds, seed: 82 });
    const c = carrier(w);
    for (let i = 0; i < 6; i++) addTruck(w, c, "owned", "workhorse", "van");
    fund(w, c.id, 200_000);
    expect(securityTheftMult(w, c)).toBe(1);
    const sec = poolStaff(w, "securityManager").sort((a, b) => b.skill - a.skill)[0]!;
    expect(offerStaff(w, c, sec, asking(w, sec) * 1.2, 0)).toBeNull();
    const alone = managerEffect(w, c, "securityManager");
    expect(alone).toBeGreaterThan(0);
    expect(securityTheftMult(w, c)).toBeCloseTo(1 - ladderCfg.labor.managers.security.theftCut * alone, 9);
    expect(securityPremiumMult(w, c)).toBeLessThan(1);
    const ceo = poolStaff(w, "ceo").sort((a, b) => b.skill - a.skill)[0]!;
    expect(offerStaff(w, c, ceo, asking(w, ceo) * 1.2, 0)).toBeNull();
    expect(managerEffect(w, c, "securityManager")).toBeCloseTo(Math.min(1, alone * (1 + ladderCfg.labor.managers.ceo.boost * ceo.skill)), 9);
  });

  it("direct freight: contracts only with a sales rep, up to what the fleet hauls; a performance stake, slashed to make the shipper whole, back at the end", () => {
    const direct: EconomyConfig = { ...ladderCfg, contracts: { ...ladderCfg.contracts, direct: { ...ladderCfg.contracts.direct, enabled: true } } };
    const w = createWorld({ cfg: direct, net, feeds: neutralFeeds, seed: 83, keepLedgerEntries: true });
    const c = carrier(w);
    for (let i = 0; i < 3; i++) addTruck(w, c, "owned", "workhorse", "van");
    fund(w, c.id, 500_000);
    expect(contractSlots(w, c)).toBe(0);
    expect(contractRoom(w, c, "van")).toBe(3 * direct.contracts.direct.loadsPerTruckWeek);
    expect(contractRoom(w, c, "reefer")).toBe(0);
    const rep = poolStaff(w, "salesRep")[0]!;
    expect(offerStaff(w, c, rep, asking(w, rep) * 1.2, 0)).toBeNull();
    expect(contractSlots(w, c)).toBe(direct.labor.managers.sales.contractsEach);
    const lane = w.net.lanesFrom[c.homeHub]![0]!;
    const k: Contract = { id: w.nextContractId++, carrierId: c.id, origin: c.homeHub, dest: lane.dest, laneId: lane.id, equipment: "van", originPlace: PLACE_OF_HUB[c.homeHub]!, destPlace: PLACE_OF_HUB[lane.dest]!, ratePerMile: 3, loadsPerWeek: 2, startDay: 0, endDay: 0, offerExpiresDay: 7, tendered: 0, accepted: 0, acceptance: 1, cut: false, status: "offered", stakeFd: 0 };
    w.contracts.push(k);
    expect(acceptOffer(w, c, k)).toBeNull();
    const stake = direct.contracts.direct.stakeWeeks * 2 * lane.miles * 3;
    expect(w.ledger.balance(contractStakeAccount(k.id))).toBeCloseTo(stake, 2);
    expect(contractRoom(w, c, "van")).toBe(3 * direct.contracts.direct.loadsPerTruckWeek - 2);
    // A tender turned down: the stake pays what moving it at spot cost over the contract, plus the fee.
    const load = { ...testLoad(w, lane), contractId: k.id, tenderedTo: c.id, bookNow: 4, miles: lane.miles };
    rejectTender(w, load);
    const owed = (4 - 3 + direct.contracts.direct.failFee * 3) * lane.miles;
    expect(w.ledger.balance(contractStakeAccount(k.id))).toBeCloseTo(stake - owed, 2);
    // The term ends: what's left comes back.
    const before = w.ledger.balance(companyAccount(c.id));
    k.endDay = 0;
    weeklyContracts(w);
    expect(k.status).toBe("ended");
    expect(w.ledger.balance(contractStakeAccount(k.id))).toBe(0);
    expect(w.ledger.balance(companyAccount(c.id))).toBeCloseTo(before + stake - owed, 2);
    w.ledger.assertBalanced();
  });

  it("scale discounts: nothing to five trucks, 1% at ten, a straight line to 10% at fifty, on fuel, the NPC dealer and a clean fleet's insurance", () => {
    const scaled: EconomyConfig = { ...calm, scaleDiscounts: { ...calm.scaleDiscounts, enabled: true } };
    const w = createWorld({ cfg: scaled, net, feeds: neutralFeeds, seed: 84 });
    expect(scaleDiscountFor(w, 5)).toBe(0);
    expect(scaleDiscountFor(w, 6)).toBeCloseTo(0.002, 9);
    expect(scaleDiscountFor(w, 10)).toBeCloseTo(0.01, 9);
    expect(scaleDiscountFor(w, 30)).toBeCloseTo(0.055, 9);
    expect(scaleDiscountFor(w, 50)).toBeCloseTo(0.1, 9);
    expect(scaleDiscountFor(w, 90)).toBeCloseTo(0.1, 9);
    const big = carrier(w, "Big");
    for (let i = 0; i < 30; i++) addTruck(w, big, "owned", "workhorse", "van");
    const small = carrier(w, "Small");
    addTruck(w, small, "owned", "workhorse", "van");
    expect(scaleDiscount(w, big)).toBeCloseTo(0.055, 9);
    expect(scaleDiscount(w, small)).toBe(0);
  });

  it("the early-sale tax: 75% at launch, falling in a line to the normal fee over its days; contract theft can be switched off", () => {
    const early: EconomyConfig = { ...calm, token: { ...calm.token, enabled: true, exchange: { ...calm.token.exchange, launchTax: { ...calm.token.exchange.launchTax, enabled: true } } }, fraud: { ...calm.fraud, theft: { ...calm.fraud.theft, byCarrier: false } } };
    const w = createWorld({ cfg: early, net, feeds: neutralFeeds, seed: 85 });
    const k = early.token.exchange;
    expect(launchTaxRate(w)).toBe(0); // not launched
    w.token.launchDay = 0;
    expect(launchTaxRate(w)).toBeCloseTo(k.launchTax.startPct, 9);
    w.t = (k.launchTax.days / 2) * early.time.gameMinutesPerDay;
    expect(launchTaxRate(w)).toBeCloseTo(k.launchTax.startPct - (k.launchTax.startPct - k.sellFeePct) / 2, 9);
    w.t = k.launchTax.days * early.time.gameMinutesPerDay;
    expect(launchTaxRate(w)).toBe(0);
    const c = carrier(w);
    const t = addTruck(w, c, "owned", "workhorse", "van");
    expect(applyAction(w, c.id, { type: "steal_load", truckId: t.id })).toEqual({ ok: false, reason: "carriers can't steal the loads they haul" });
  });

  it("replays exactly from the seed with the ladder, the roles, direct freight, scale discounts, the early-sale tax and the truck money on", () => {
    const all: EconomyConfig = {
      ...ladderCfg,
      dealerFd: { tractor: { workhorse: 140_000, highwayPro: 320_000, flagship: 700_000 }, trailer: { van: 40_000, reefer: 100_000, flatbed: 70_000 } },
      seasonClose: { ...calm.seasonClose, enabled: false },
      contracts: { ...ladderCfg.contracts, direct: { ...ladderCfg.contracts.direct, enabled: true } },
      scaleDiscounts: { ...calm.scaleDiscounts, enabled: true },
      equipmentFinance: { ...calm.equipmentFinance, purchase: { ...calm.equipmentFinance.purchase, enabled: true } },
      freeEntry: { ...calm.freeEntry, leases: { ...calm.freeEntry.leases, byValue: { ...calm.freeEntry.leases.byValue, enabled: true } } },
      fraud: { ...calm.fraud, theft: { ...calm.fraud.theft, byCarrier: false } },
      token: { ...calm.token, enabled: true, betaYears: 0.05, exchange: { ...calm.token.exchange, launchTax: { ...calm.token.exchange.launchTax, enabled: true } } },
    };
    const run = () => {
      const w = createWorld({ cfg: all, net, feeds: { ...neutralFeeds, cycle: syntheticCassCycle({ seed: 86 }) }, seed: 86 });
      populate(w, { freeOwnerOperators: 30, fleets: 8, brokers: 3 });
      runDays(w, 50, ruleBotHook);
      const roles = w.staff.filter((s) => s.status === "employed" && (s.kind === "salesRep" || s.kind === "securityManager" || s.kind === "ceo")).map((s) => [s.kind, s.companyId]);
      return { supply: w.ledger.supply(), roles, contracts: w.contracts.map((k) => [k.carrierId, k.status, k.stakeFd]), prices: w.token.priceHistory };
    };
    const a = run();
    expect(a).toEqual(run());
  });
});

describe("hired robbers (2026-10-31): player against player, in the open", () => {
  const robbers: EconomyConfig = { ...calm, robbery: { ...calm.robbery, enabled: true, protectDays: 0 } };

  it("hires a crew against another company's truck: the fee a sink, the hire on the public feed, the owner warned; not your own, not a new company, not without stake", () => {
    const w = createWorld({ cfg: { ...robbers, robbery: { ...robbers.robbery, protectDays: 30 } }, net, feeds: neutralFeeds, seed: 91, keepLedgerEntries: true });
    const hirer = carrier(w, "Hirer");
    const victim = carrier(w, "Victim");
    const mine = addTruck(w, hirer, "owned", "workhorse", "van");
    const target = addTruck(w, victim, "owned", "workhorse", "van");
    expect(applyAction(w, hirer.id, { type: "hire_crew", truckId: mine.id })).toEqual({ ok: false, reason: "that's your own truck" });
    expect(applyAction(w, hirer.id, { type: "hire_crew", truckId: target.id })).toEqual({ ok: false, reason: "that company is too new to be a target" });
    runDays(w, 30);
    fund(w, hirer.id, 50_000);
    const fee = crewFeeFd(w, target);
    const before = w.ledger.balance(companyAccount(hirer.id));
    expect(applyAction(w, hirer.id, { type: "hire_crew", truckId: target.id })).toEqual({ ok: true });
    expect(before - w.ledger.balance(companyAccount(hirer.id))).toBeCloseTo(fee, 2);
    expect(crewOn(w, target.id)?.hirerId).toBe(hirer.id);
    expect(w.robbery.feed.at(-1)!.kind).toBe("hire");
    expect(applyAction(w, hirer.id, { type: "hire_crew", truckId: target.id })).toEqual({ ok: false, reason: "a crew is already on that truck" });
    // A hirer with nothing at stake can't.
    const broke = carrier(w, "Broke");
    w.ledger.post(w.t, companyAccount(broke.id), "sink:permits", w.ledger.balance(companyAccount(broke.id)), "test");
    const other = addTruck(w, victim, "owned", "workhorse", "van");
    expect(applyAction(w, broke.id, { type: "hire_crew", truckId: other.id })).toEqual({ ok: false, reason: "not enough at stake to hire a crew for that truck" });
    // The window runs out: the crew gives up.
    runDays(w, robbers.robbery.windowDays + 1);
    expect(w.robbery.jobs[0]!.status).toBe("missed");
    w.ledger.assertBalanced();
  });

  it("a crew strikes a truck asleep in a corridor outside a truck stop: the load and the rig are taken, the hirer paid the fence's washed share; never at a truck stop", () => {
    const sure: EconomyConfig = { ...robbers, robbery: { ...robbers.robbery, odds: 10, maxOdds: 1, rigShare: 1 } };
    const w = createWorld({ cfg: sure, net, feeds: neutralFeeds, seed: 92, keepLedgerEntries: true });
    const hirer = carrier(w, "Hirer");
    const victim = carrier(w, "Victim");
    addTruck(w, hirer, "owned", "workhorse", "van");
    const target = addTruck(w, victim, "owned", "workhorse", "van");
    fund(w, hirer.id, 50_000);
    expect(applyAction(w, hirer.id, { type: "hire_crew", truckId: target.id }).ok).toBe(true);
    crewStrike(w, target, victim, "truckStop", 3);
    expect(crewOn(w, target.id)).toBeDefined(); // out of reach at a truck stop
    crewStrike(w, target, victim, "shoulder", 1.2);
    expect(crewOn(w, target.id)).toBeDefined(); // not a corridor
    const value = truckValue(w, target);
    const before = w.ledger.balance(companyAccount(hirer.id));
    crewStrike(w, target, victim, "shoulder", 3);
    expect(crewOn(w, target.id)).toBeUndefined();
    expect(w.robbery.jobs[0]!.status).toBe("hit");
    expect(target.status).toBe("retired");
    expect(w.robbery.stats.rigsTaken).toBe(1);
    expect(w.ledger.balance(companyAccount(hirer.id)) - before).toBeCloseTo(sure.robbery.rigFenceShare * value * (1 - sure.robbery.washFee), 2);
    expect(w.robbery.feed.at(-1)!.kind).toBe("hit");
    // The victim can't be targeted again inside the cooldown.
    const next = addTruck(w, victim, "owned", "workhorse", "van");
    expect(applyAction(w, hirer.id, { type: "hire_crew", truckId: next.id })).toEqual({ ok: false, reason: "that company was hit too recently" });
    w.ledger.assertBalanced();
  });

  it("security fittings: up to three a truck, each bought once (a sink), each cutting a crew's odds", () => {
    const w = createWorld({ cfg: robbers, net, feeds: neutralFeeds, seed: 93, keepLedgerEntries: true });
    const c = carrier(w);
    const t = addTruck(w, c, "owned", "workhorse", "van");
    fund(w, c.id, 20_000);
    expect(fittingsCut(w, t)).toBe(0);
    expect(applyAction(w, c.id, { type: "fit_security", truckId: t.id, item: "tracker" })).toEqual({ ok: true });
    expect(applyAction(w, c.id, { type: "fit_security", truckId: t.id, item: "tracker" })).toEqual({ ok: false, reason: "already fitted" });
    expect(applyAction(w, c.id, { type: "fit_security", truckId: t.id, item: "locks" })).toEqual({ ok: true });
    expect(applyAction(w, c.id, { type: "fit_security", truckId: t.id, item: "camera" })).toEqual({ ok: true });
    const k = robbers.security.items;
    expect(fittingsCut(w, t)).toBeCloseTo(k.tracker.cut + k.locks.cut + k.camera.cut, 9);
    expect(w.robbery.stats.fittingsFd).toBeCloseTo(k.tracker.fd + k.locks.fd + k.camera.fd, 2);
  });

  it("replays exactly from the seed with the bots hiring crews and fitting security", () => {
    const run = () => {
      const w = createWorld({ cfg: robbers, net, feeds: { ...neutralFeeds, cycle: syntheticCassCycle({ seed: 94 }) }, seed: 94 });
      populate(w, { freeOwnerOperators: 40, fleets: 10, brokers: 4 });
      runDays(w, 45, ruleBotHook);
      return { supply: w.ledger.supply(), jobs: w.robbery.jobs.map((j) => [j.hirerId, j.truckId, j.status]), stats: { ...w.robbery.stats } };
    };
    const a = run();
    expect(a.stats.hires).toBeGreaterThan(0);
    expect(a).toEqual(run());
  });
});

describe("theft gaps (2026-10-31): claims move the insurance market; a closed dock's night is a night in the open", () => {
  const gaps: EconomyConfig = { ...calm, theft: { ...calm.theft, enabled: true, claimsMoveMarket: true, dockWaits: true, oddsPerLoadedNight: 10 } };

  it("a cargo theft counts toward the insurers' loss ratio", () => {
    const w = createWorld({ cfg: gaps, net, feeds: neutralFeeds, seed: 95 });
    const c = carrier(w);
    const t = addTruck(w, c, "owned", "workhorse", "van");
    const lane = w.net.lanesFrom[t.hub]![0]!;
    const load = { ...testLoad(w, lane), cargoValue: 50_000, status: "assigned" as const, carrierId: c.id, truckId: t.id };
    w.loads.set(load.id, load);
    t.loadId = load.id;
    t.status = "loaded";
    const before = w.insuranceMarket.claims.at(-1)!;
    stealCargo(w, t, c, load);
    expect(w.insuranceMarket.claims.at(-1)! - before).toBeCloseTo(50_000 - gaps.safety.crash.cargoDeductibleFd, 2);
  });

  it("a loaded truck that waits out a night at a closed dock can be robbed there; a short wait can't", () => {
    const w = createWorld({ cfg: gaps, net, feeds: neutralFeeds, seed: 96 });
    const c = carrier(w);
    const t = addTruck(w, c, "owned", "workhorse", "van");
    const lane = w.net.lanesFrom[t.hub]![0]!;
    const load = { ...testLoad(w, lane), cargoValue: 60_000, status: "assigned" as const, carrierId: c.id, truckId: t.id };
    w.loads.set(load.id, load);
    t.loadId = load.id;
    t.status = "loaded";
    expect(dockWaitTheft(w, t, load, 3 * 60)).toBe(false);
    expect(t.loadId).toBe(load.id);
    expect(dockWaitTheft(w, t, load, 12 * 60)).toBe(true);
    expect(t.loadId).toBeNull();
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

  it("without the price floor (Jeff, 2026-11-01) the vest is a clock: the week's share sells below the launch price too", () => {
    const clock: EconomyConfig = { ...calm, seasonClose: { ...calm.seasonClose, enabled: false }, token: { ...calm.token, enabled: true, circular: { ...calm.token.circular, enabled: true }, treasury: { ...calm.token.treasury, vest: { ...calm.token.treasury.vest, priceFloor: false } } } };
    const w = createWorld({ cfg: clock, net, feeds: neutralFeeds, seed: 68 });
    const a = carrier(w, "A");
    fund(w, a.id, 50_000);
    a.milesTotal = 1_000;
    launchToken(w);
    const held = w.ledger.balance("alloc:treasury");
    weeklyVest(w); // inside the cliff: nothing
    expect(w.token.treasury.vestedFd).toBe(0);
    w.token.launchDay = -clock.token.treasury.vest.cliffWeeks * 7 - 1;
    for (let i = 0; i < 7; i++) w.token.priceHistory.push(w.token.launchPriceUsd / 2);
    weeklyVest(w); // below launch, and the sale takes the price lower still: it sells all the same
    expect(w.token.treasury.vestedFd).toBeCloseTo(held * clock.token.treasury.vest.perWeekShare, 2);
    expect(fdPriceUsd(w)).toBeLessThan(w.token.launchPriceUsd);
    expect(w.token.treasury.devUsd).toBeGreaterThan(0);
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

    // A customer's truck sleeping at the site: a space taken, a quarter of the idling, and the nightly price (taxed) to the owner.
    const { t, r } = onLeg(w, cust, road.a, road.b, road.mile);
    expect(legMile(t)).toBeCloseTo(road.mile, 6);
    expect(siteHere(w, r, road.mile)).toBe(site);
    const o2 = w.ledger.balance(companyAccount(owner.id));
    const idleBefore = w.ledger.entries.filter((e) => e.to === "sink:idle_fuel").reduce((s, e) => s + e.amount, 0);
    parkForTheNight(w, t, site);
    parkForTheNight(w, t, site); // the same shift: charged once
    expect(site.parked).toBe(1);
    expect(t.restSite).toBe(site.id);
    expect(w.ledger.balance(companyAccount(owner.id)) - o2).toBeCloseTo(stop.parkingFd, 2);
    expect(stop.parkingFd).toBe(sinks.businesses.parking.defaultPriceFd);
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

describe("parking (0.18.2): rest areas by traffic, the night at a site or on the shoulder, the planner, owners' prices and spaces", () => {
  const sinks: EconomyConfig = {
    ...calm,
    costs: { ...calm.costs, salesTax: { enabled: true, pct: 0.05 } },
    businesses: { ...calm.businesses, enabled: true, parking: { ...calm.businesses.parking, patrolOdds: 1 } },
  };
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

  it("sizes every site's rest area by its traffic, and tickets a truck that sleeps on the shoulder unless it broke down", () => {
    const w = createWorld({ cfg: sinks, net, feeds: neutralFeeds, seed: 90, keepLedgerEntries: true });
    const [lo, hi] = sinks.businesses.parking.spaces;
    const busiest = [...w.sites].sort((a, b) => b.traffic - a.traffic)[0]!;
    const quietest = [...w.sites].sort((a, b) => a.traffic - b.traffic)[0]!;
    expect(busiest.spaces).toBe(hi);
    expect(quietest.spaces).toBeGreaterThanOrEqual(lo);
    expect(quietest.spaces).toBeLessThan(busiest.spaces);
    const c = carrier(w, "C");
    fund(w, c.id, 20_000);
    const r = hubRoute(w, 0, 1)!;
    const { t } = onLeg(w, c, 0, 1, r.miles / 2);
    const fines = () => w.ledger.entries.filter((e) => e.to === "sink:fines").reduce((s, e) => s + e.amount, 0);
    parkForTheNight(w, t, null); // the shoulder, certain patrol
    expect(fines()).toBeCloseTo(sinks.businesses.parking.shoulderFineFd, 2);
    expect(w.metrics.days.length).toBe(0);
    // Broken down: legal, no ticket.
    const { t: t2 } = onLeg(w, c, 0, 1, r.miles / 3);
    t2.breakdownMin = 120;
    parkForTheNight(w, t2, null);
    expect(fines()).toBeCloseTo(sinks.businesses.parking.shoulderFineFd, 2);
    // At a public rest area: free, a space taken, the full idling.
    const site = bestOpenSite(w)!;
    const { t: t3 } = onLeg(w, c, 0, 1, 10);
    const idleBefore = w.ledger.entries.filter((e) => e.to === "sink:idle_fuel").reduce((s, e) => s + e.amount, 0);
    parkForTheNight(w, t3, site);
    expect(site.parked).toBe(1);
    expect(w.ledger.entries.filter((e) => e.to === "sink:idle_fuel").reduce((s, e) => s + e.amount, 0) - idleBefore).toBeCloseTo(sinks.costs.idleFuelGalPerDay * fuelPriceNow(w), 1);
    expect(fines()).toBeCloseTo(sinks.businesses.parking.shoulderFineFd, 2);
    w.ledger.assertBalanced();
  });

  it("plans the night at the last site with room the hours reach, and skips a full one", () => {
    const w = createWorld({ cfg: sinks, net, feeds: neutralFeeds, seed: 91 });
    const c = carrier(w, "C");
    // A long road with at least two sites on it.
    const n = w.net.hubs.length;
    let pick: { a: number; b: number; r: ReturnType<typeof hubRoute> } | null = null;
    for (let a = 0; a < n && !pick; a++) for (let b = 0; b < n; b++) {
      const r = a === b ? null : hubRoute(w, a, b);
      if (r && r.miles > 600 && sitesAlong(w, r).length >= 3) { pick = { a, b, r }; break; }
    }
    const { a, b, r } = pick!;
    const along = sitesAlong(w, r!);
    const { t } = onLeg(w, c, a, b, 0);
    const reach = 400;
    const within = along.filter((s) => s.mile > 0.1 && s.mile <= reach);
    expect(within.length).toBeGreaterThan(0);
    const last = within[within.length - 1]!;
    // Not passing it this hour: drive on. Passing it: stop there.
    expect(planNight(w, t, r!, 0, reach, Math.max(0, last.mile - 5))).toBeNull();
    expect(planNight(w, t, r!, 0, reach, last.mile + 5)).toBeCloseTo(last.mile, 6);
    // The leg ends within the hours: no night planned.
    expect(planNight(w, t, r!, 0, r!.miles + 1, 60)).toBeNull();
    // That site full: the previous one with room, or none.
    const lastSite = w.sites[last.site - 1]!;
    lastSite.parked = lastSite.spaces;
    expect(hasRoom(lastSite)).toBe(false);
    const prev = within.filter((s) => s.site !== last.site).at(-1);
    const planned = planNight(w, t, r!, 0, reach, last.mile + 5);
    if (prev) expect(planned).toBeCloseTo(prev.mile, 6);
    else expect(planned).toBeNull();
  });

  it("lets an owner price the parking within the band and buy more spaces through the catalogue split", () => {
    const cat: EconomyConfig = { ...sinks, token: { ...sinks.token, catalogue: { ...sinks.token.catalogue, enabled: true } } };
    const w = createWorld({ cfg: cat, net, feeds: neutralFeeds, seed: 92, keepLedgerEntries: true });
    const owner = carrier(w, "Owner");
    fund(w, owner.id, 2_000_000);
    const site = bestOpenSite(w)!;
    expect(applyAction(w, owner.id, { type: "buy_business", kind: "truckStop", siteId: site.id })).toEqual({ ok: true });
    const stop = businessesOf(w, owner.id)[0]!;
    const [lo, hi] = cat.businesses.parking.priceRange;
    expect(applyAction(w, owner.id, { type: "set_parking_price", businessId: stop.id, fd: hi + 100 })).toEqual({ ok: true });
    expect(stop.parkingFd).toBe(hi);
    expect(applyAction(w, owner.id, { type: "set_parking_price", businessId: stop.id, fd: 0 })).toEqual({ ok: true });
    expect(stop.parkingFd).toBe(lo);
    const spaces = site.spaces;
    const before = w.ledger.balance(companyAccount(owner.id));
    const burnBefore = w.ledger.entries.filter((e) => e.to === "sink:asset_burn").reduce((s, e) => s + e.amount, 0);
    expect(applyAction(w, owner.id, { type: "add_parking", businessId: stop.id })).toEqual({ ok: true });
    const p = cat.businesses.parking;
    const price = p.spacesPerPurchase * p.spacePriceFd * priceIndex(w);
    expect(site.spaces).toBe(spaces + p.spacesPerPurchase);
    expect(before - w.ledger.balance(companyAccount(owner.id))).toBeCloseTo(price * 1.05, 2);
    expect(w.ledger.entries.filter((e) => e.to === "sink:asset_burn").reduce((s, e) => s + e.amount, 0) - burnBefore).toBeCloseTo(price * cat.token.catalogue.split.burn, 2);
    w.ledger.assertBalanced();
  });
});

describe("the trailer pass and the risk corridors (0.18.3)", () => {
  const ops: EconomyConfig = { ...calm, equipmentOps: { ...calm.equipmentOps, enabled: true } };
  const docked: EconomyConfig = { ...ops, docks: { ...calm.docks, enabled: true } };
  const D = calm.time.gameMinutesPerDay;

  it("burns more on a loaded mile than an empty one, runs a loaded reefer's unit by the hour, and pays drivers more on reefer and flatbed miles", () => {
    const van = { ...NEW_WORKHORSE, trailer: "van" as const };
    const reefer = { ...NEW_WORKHORSE, trailer: "reefer" as const };
    const flatbed = { ...NEW_WORKHORSE, trailer: "flatbed" as const };
    const k = ops.equipmentOps;
    const loaded = tripCost(ops, van, 4, 1_000, 1_000);
    const empty = tripCost(ops, van, 4, 1_000, 0);
    expect(loaded.gallons / empty.gallons).toBeCloseTo(k.loadedFuelMult / k.emptyFuelMult, 9);
    expect(tripCost(ops, reefer, 4, 1_000, 1_000).gallons - tripCost(ops, van, 4, 1_000, 1_000).gallons).toBeCloseTo((1_000 / k.reeferUnitMph) * k.reeferUnitGalPerHour, 6);
    expect(tripCost(ops, flatbed, 4, 1_000, 1_000).wages).toBeCloseTo(loaded.wages * k.driverPayMult.flatbed, 6);
    expect(tripCost(ops, reefer, 4, 1_000, 1_000).wages).toBeCloseTo(loaded.wages * k.driverPayMult.reefer, 6);
    // Off, a mile is a mile.
    expect(tripCost(calm, van, 4, 1_000, 0).gallons).toBeCloseTo(tripCost(calm, van, 4, 1_000, 1_000).gallons, 9);
  });

  it("keeps first-come docks to weekday business hours and flatbed to daylight, and books appointment freight into slots", () => {
    const w = createWorld({ cfg: docked, net, feeds: neutralFeeds, seed: 100 });
    const h = docked.docks.hours;
    // Friday 19:00 (day 4: days count from a Monday): first come opens Monday 07:00, daylight Saturday 06:00.
    expect(nextOpen(w, 4 * D + 19 * 60, h.fcfs)).toBe(7 * D + 7 * 60);
    expect(nextOpen(w, 4 * D + 19 * 60, h.daylight)).toBe(5 * D + 6 * 60);
    expect(nextOpen(w, 2 * D + 10 * 60, h.fcfs)).toBe(2 * D + 10 * 60);
    expect(nextOpen(w, 2 * D + 3 * 60, h.fcfs)).toBe(2 * D + 7 * 60);
    // The biggest first-come docks never close; a small town's keep business hours.
    const small = PLACE_ROWS.length - 1;
    expect(aroundTheClock(w, 0)).toBe(true);
    expect(aroundTheClock(w, small)).toBe(false);
    const load = testLoad(w, w.net.lanes[0]!);
    load.equipment = "van";
    load.commodity = COMMODITY_INDEX.grocery;
    expect(dockRule(w, load)).toBe("appointment");
    load.commodity = COMMODITY_INDEX.retail;
    expect(dockRule(w, load)).toBe("fcfs");
    load.equipment = "reefer";
    load.commodity = COMMODITY_INDEX.produce;
    expect(dockRule(w, load)).toBe("appointment");
    // The slot: the estimate plus the lead, on the hour; due at its grace.
    const a = docked.docks.appointment;
    setSlot(w, load, 10_000);
    expect(load.slotT % 60).toBe(0);
    expect(load.slotT).toBeGreaterThanOrEqual(10_000 + a.leadMinutes);
    expect(load.dueT).toBe(load.slotT + a.graceMinutes);
    // Five hours early waits for the window (it opens two hours before the slot); on time, none; past the grace, the next slot hours later.
    expect(deliveryWait(w, load, load.slotT - 300)).toEqual({ minutes: 300 - a.earlyMinutes, missed: false, receiversHours: false });
    expect(deliveryWait(w, load, load.slotT).minutes).toBe(0);
    const late = deliveryWait(w, load, load.slotT + a.graceMinutes + 60);
    expect(late.missed).toBe(true);
    expect(late.minutes).toBeGreaterThanOrEqual(a.nextSlotHours[0] * 60);
    expect(late.minutes).toBeLessThanOrEqual(a.nextSlotHours[1] * 60);
    // Appointment freight ships at any hour; a first-come van load on a Saturday waits for Monday, a small receiver's hours.
    expect(pickupWait(w, load, 5 * D + 23 * 60)).toBe(0);
    load.equipment = "van";
    load.commodity = COMMODITY_INDEX.retail;
    load.originPlace = small;
    load.destPlace = small;
    const sat = deliveryWait(w, load, 5 * D + 10 * 60);
    expect(sat).toEqual({ minutes: 7 * D + 7 * 60 - (5 * D + 10 * 60), missed: false, receiversHours: true });
    expect(pickupWait(w, load, 5 * D + 23 * 60)).toBe(7 * D + 7 * 60 - (5 * D + 23 * 60));
    // A big distribution center takes it at any hour, any day.
    load.destPlace = 0;
    load.originPlace = 0;
    expect(deliveryWait(w, load, 5 * D + 23 * 60).minutes).toBe(0);
    expect(pickupWait(w, load, 6 * D + 2 * 60)).toBe(0);
  });

  it("has a skilled dispatcher price the wait at a closed first-come dock into the load, and an unskilled one barely see it", () => {
    const w = createWorld({ cfg: docked, net, feeds: neutralFeeds, seed: 103 });
    const a = carrier(w, "A");
    const t = createTruck(w, a, "owned", "workhorse", "van");
    const load = testLoad(w, w.net.lanes[0]!);
    load.equipment = "van";
    load.commodity = COMMODITY_INDEX.retail;
    load.routeHours = 6;
    // Small towns at both ends: their docks keep business hours.
    load.originPlace = PLACE_ROWS.length - 1;
    load.destPlace = PLACE_ROWS.length - 2;
    const team = { skill: 1 } as Parameters<typeof dockWaitCost>[4];
    // Picked up at 14:00 on a Friday: unloaded after 20:00, past the receiver's hours: it waits for Monday.
    w.t = 4 * D + 14 * 60;
    const friday = dockWaitCost(w, t, load, 0, team);
    // Picked up at 08:00 on a Tuesday: delivered the same afternoon, no wait.
    w.t = 1 * D + 8 * 60;
    const tuesday = dockWaitCost(w, t, load, 0, team);
    expect(friday).toBeGreaterThan(50 * docked.roads.routing.timeValueFdPerHour);
    expect(tuesday).toBe(0);
    // Appointment freight is booked into a slot; a dispatcher with no skill doesn't see the wait at all.
    w.t = 4 * D + 14 * 60;
    expect(dockWaitCost(w, t, load, 0, { skill: 0 } as Parameters<typeof dockWaitCost>[4])).toBe(0);
    load.commodity = COMMODITY_INDEX.grocery;
    expect(dockWaitCost(w, t, load, 0, team)).toBe(0);
  });

  it("secures a flatbed at the shipper and waits out a closed dock, moving the due time by the wait", () => {
    const w = createWorld({ cfg: docked, net, feeds: neutralFeeds, seed: 101 });
    const a = carrier(w, "A");
    const t = createTruck(w, a, "owned", "workhorse", "flatbed");
    const load = testLoad(w, w.net.lanes[0]!);
    load.equipment = "flatbed";
    load.commodity = COMMODITY_INDEX.steel;
    load.dueT = 1e9;
    const sunday = 6 * D + 12 * 60;
    const wait = 7 * D + 6 * 60 - sunday;
    startLoading(w, t, load, sunday);
    const [lo] = docked.dwell.loadMinutes;
    const [slo] = docked.equipmentOps.flatbedSecureMinutes;
    expect(t.dwellMin).toBeGreaterThanOrEqual(wait + lo + slo);
    expect(load.dueT).toBe(1e9 + wait);
  });

  it("finds the theft hotspots, steals a high-value load from a truck asleep on the shoulder near one, and prices the risk into rates and insurance", () => {
    const th: EconomyConfig = { ...calm, businesses: { ...calm.businesses, enabled: true }, theft: { ...calm.theft, enabled: true, oddsPerLoadedNight: 1e6 } };
    const w = createWorld({ cfg: th, net, feeds: neutralFeeds, seed: 102, keepLedgerEntries: true });
    const idx = (id: string) => w.net.hubs.findIndex((h) => h.id === id);
    const la = w.net.hubs[idx("LAX")]!;
    const fargo = w.net.hubs[idx("FAR")]!;
    expect(theftRiskAt(w, la.lat, la.lon)).toBeGreaterThan(2.5);
    expect(theftRiskAt(w, fargo.lat, fargo.lon)).toBe(1);
    // A hotspot lane pays a premium; a lane between quiet hubs doesn't. High-value freight pays more on every load.
    expect(theftRatePerMile(w, idx("LAX"), idx("DAL"), "van")).toBeGreaterThan(0);
    expect(theftRatePerMile(w, idx("FAR"), idx("BOI"), "van")).toBe(0);
    expect(highValueMult(th, COMMODITY_INDEX.electronics)).toBeGreaterThan(1);
    expect(highValueMult(th, COMMODITY_INDEX.hay)).toBe(1);
    // A loaded truck thirty miles out of Los Angeles, asleep on the shoulder.
    const c = carrier(w, "C");
    fund(w, c.id, 50_000);
    const lane = w.net.lanes.find((l) => l.origin === idx("LAX"))!;
    const r = hubRoute(w, lane.origin, lane.dest)!;
    const t = createTruck(w, c, "owned", "workhorse", "van");
    t.status = "loaded";
    t.hub = lane.origin;
    t.targetHub = lane.dest;
    t.place = PLACE_OF_HUB[lane.origin]!;
    t.targetPlace = PLACE_OF_HUB[lane.dest]!;
    t.legMiles = r.miles;
    t.remainingMi = r.miles - 30;
    t.shiftStartT = 1_000;
    const driver = w.staffByCompany.get(c.id)!.find((s) => s.owner)!;
    t.driverId = driver.id;
    driver.truckId = t.id;
    const load = testLoad(w, lane);
    load.commodity = COMMODITY_INDEX.electronics;
    load.cargoValue = 20_000;
    load.status = "inTransit";
    load.carrierId = c.id;
    load.truckId = t.id;
    w.loads.set(load.id, load);
    t.loadId = load.id;
    const claims = () => w.ledger.entries.filter((e) => e.to === "sink:cargo_claim").reduce((s, e) => s + e.amount, 0);
    const before = claims();
    parkForTheNight(w, t, null);
    expect(w.loads.has(load.id)).toBe(false);
    expect(t.loadId).toBeNull();
    expect(t.status).toBe("repositioning");
    expect(claims() - before).toBeCloseTo(th.safety.crash.cargoDeductibleFd, 2);
    expect(t.breakdownMin).toBeGreaterThanOrEqual(th.theft.reportHours * 60);
    expect(c.nightRisk).toBeGreaterThan(1);
    // The insurer prices where the fleet sleeps.
    c.nightRisk = 3;
    const risky = quote(w, c).annualPerTruck;
    c.nightRisk = th.theft.insuranceRefExposure;
    expect(risky).toBeGreaterThan(quote(w, c).annualPerTruck);
    w.ledger.assertBalanced();
  });
});

describe("the bear-case fixes (EVE plan step 2): selling often costs more, and a falling price tightens the door", () => {
  it("adds to the sell fee past the free selling days, and shrinks the daily limit while the price is below its weekly average", () => {
    const fixes: EconomyConfig = {
      ...calm,
      seasonClose: { ...calm.seasonClose, enabled: false },
      token: {
        ...calm.token,
        enabled: true,
        launch: { ...calm.token.launch, seedUsd: 0 },
        exchange: { ...calm.token.exchange, frequency: { ...calm.token.exchange.frequency, enabled: true }, fallingLimit: { ...calm.token.exchange.fallingLimit, enabled: true } },
      },
    };
    const w = createWorld({ cfg: fixes, net, feeds: neutralFeeds, seed: 58, keepLedgerEntries: true });
    const a = carrier(w, "A");
    fund(w, a.id, 100_000);
    a.milesTotal = 1_000;
    launchToken(w);
    a.usd.wallet = 20_000;
    expect(applyAction(w, a.id, { type: "buy_fd", usd: 20_000 })).toEqual({ ok: true });
    const fq = fixes.token.exchange.frequency;
    const extra: number[] = [];
    for (let d = 0; d < fq.freeSellDays + 3; d++) {
      extra.push(frequencyFee(w, a));
      expect(applyAction(w, a.id, { type: "sell_fd", fd: 100 })).toEqual({ ok: true });
      w.t += w.cfg.time.gameMinutesPerDay;
    }
    // Free for the first days, then a step more for each further day with a sale in the window.
    expect(extra.slice(0, fq.freeSellDays)).toEqual(new Array(fq.freeSellDays).fill(0));
    expect(extra[fq.freeSellDays]).toBeCloseTo(fq.perSellDay, 9);
    expect(extra[fq.freeSellDays + 2]).toBeCloseTo(3 * fq.perSellDay, 9);
    // A falling price: the last week traded well above today, so the limit shrinks, never below its floor.
    const now = fdPriceUsd(w);
    const k = fixes.token.exchange;
    w.token.priceHistory = new Array(7).fill(now * 1.25);
    expect(sellLimitShare(w)).toBeCloseTo(k.dailySellShareOfPool * Math.max(k.fallingLimit.minShare, (1 / 1.25) ** k.fallingLimit.power), 9);
    w.token.priceHistory = new Array(7).fill(now * 10);
    expect(sellLimitShare(w)).toBeCloseTo(k.dailySellShareOfPool * k.fallingLimit.minShare, 9);
    w.token.priceHistory = new Array(7).fill(now * 0.9);
    expect(sellLimitShare(w)).toBe(k.dailySellShareOfPool);
    w.ledger.assertBalanced();
  });
});

describe("the daily price band (Jeff, 2026-10-31): ±15% a day for the first three real months", () => {
  it("fills a buy only up to today's high and a sale only down to today's low, the rest waiting; off after its days", () => {
    const banded: EconomyConfig = {
      ...calm,
      seasonClose: { ...calm.seasonClose, enabled: false },
      token: { ...calm.token, enabled: true, exchange: { ...calm.token.exchange, dailySellShareOfPool: 0, priceBand: { ...calm.token.exchange.priceBand, enabled: true } } },
    };
    const w = createWorld({ cfg: banded, net, feeds: neutralFeeds, seed: 59, keepLedgerEntries: true });
    const a = carrier(w, "A");
    fund(w, a.id, 100_000);
    a.milesTotal = 1_000;
    launchToken(w);
    const k = banded.token.exchange.priceBand;
    const open = fdPriceUsd(w);
    expect(open).toBeGreaterThan(0);
    // A buy many times the band's depth fills to today's high and no further; the rest of the dollars wait.
    a.usd.wallet = w.token.poolUsd * 10;
    expect(applyAction(w, a.id, { type: "buy_fd", usd: a.usd.wallet })).toEqual({ ok: true });
    expect(fdPriceUsd(w) / (open * (1 + k.pct))).toBeCloseTo(1, 6); // to the cent the ledger keeps
    expect(a.usd.wallet).toBeGreaterThan(w.token.poolUsd * 5);
    expect(w.token.bandClips).toBe(1);
    expect(applyAction(w, a.id, { type: "buy_fd", usd: 100 })).toEqual({ ok: false, reason: "the price is at today's limit up" });
    // The next day opens where the last one closed: a sale far past the band fills down to today's low, net of its fee.
    w.t += w.cfg.time.gameMinutesPerDay;
    const open2 = fdPriceUsd(w);
    fund(w, a.id, w.ledger.balance(EXCHANGE_ACCOUNT) * 5);
    const held = sellableFd(w, a);
    expect(applyAction(w, a.id, { type: "sell_fd", fd: held })).toEqual({ ok: true });
    expect(fdPriceUsd(w) / (open2 * (1 - k.pct))).toBeCloseTo(1, 6);
    expect(sellableFd(w, a)).toBeGreaterThan(held / 2);
    expect(w.token.bandClips).toBe(2);
    expect(applyAction(w, a.id, { type: "sell_fd", fd: 100 })).toEqual({ ok: false, reason: "the price is at today's limit down" });
    // After its days, no band.
    w.t = (w.token.launchDay! + k.days) * w.cfg.time.gameMinutesPerDay;
    const p = fdPriceUsd(w);
    a.usd.wallet = w.token.poolUsd * 10;
    expect(applyAction(w, a.id, { type: "buy_fd", usd: a.usd.wallet })).toEqual({ ok: true });
    expect(fdPriceUsd(w)).toBeGreaterThan(p * 2);
    expect(w.token.bandClips).toBe(2);
    w.ledger.assertBalanced();
  });
});

describe("the launch on a standard pool (Jeff, 2026-11-01, option A): the opening auction and the pool's launch fees", () => {
  const tokenOn = (over: Partial<EconomyConfig["token"]>): EconomyConfig => ({ ...calm, seasonClose: { ...calm.seasonClose, enabled: false }, token: { ...calm.token, enabled: true, ...over } });

  it("the auction: bids held to the cap, the tranche sold at one price for every dollar bid, every dollar into the pool, which opens at that price", () => {
    const au = tokenOn({ launch: { ...calm.token.launch, auction: { ...calm.token.launch.auction, enabled: true, trancheFd: 1_000_000, capUsd: 1_000 } } });
    const w = createWorld({ cfg: au, net, feeds: neutralFeeds, seed: 63, keepLedgerEntries: true });
    const a = carrier(w, "A");
    const b = carrier(w, "B");
    a.usd.wallet = 5_000;
    b.usd.wallet = 300;
    expect(applyAction(w, a.id, { type: "bid_auction", usd: 1_500 })).toEqual({ ok: false, reason: "at most $1,000 a person in the auction" });
    expect(applyAction(w, a.id, { type: "bid_auction", usd: 600 })).toEqual({ ok: true });
    expect(applyAction(w, a.id, { type: "bid_auction", usd: 400 })).toEqual({ ok: true });
    expect(applyAction(w, a.id, { type: "bid_auction", usd: 1 })).toEqual({ ok: false, reason: "at most $1,000 a person in the auction" });
    expect(applyAction(w, b.id, { type: "bid_auction", usd: 400 })).toEqual({ ok: false, reason: "not enough dollars" });
    expect(applyAction(w, b.id, { type: "bid_auction", usd: 300 })).toEqual({ ok: true });
    expect(a.usd.wallet).toBe(4_000);
    expect(b.usd.wallet).toBe(0);
    a.milesTotal = 1_000;
    launchToken(w);
    const seedUsd = au.token.launch.seedUsd;
    const r = w.token.auction!;
    expect(r).toMatchObject({ usd: 1_300, fd: 1_000_000, bidders: 2, treasuryUsd: 0 });
    expect(r.priceUsd).toBeCloseTo(0.0013, 12);
    expect(w.token.launchPriceUsd).toBeCloseTo(0.0013, 12);
    expect(w.token.floorUsd).toBe(0);
    expect(fdPriceUsd(w)).toBeCloseTo(0.0013, 9);
    expect(w.token.poolUsd).toBeCloseTo(seedUsd + 1_300, 6);
    expect(w.token.treasury.seedUsd).toBeCloseTo(seedUsd + 1_300, 6);
    expect(w.ledger.balance(EXCHANGE_ACCOUNT)).toBeCloseTo((seedUsd + 1_300) / 0.0013, 0); // to the cent
    const got = (id: number) => w.ledger.entries.filter((e) => e.ref === `auction:${id}`).reduce((s, e) => s + e.amount, 0);
    expect(got(a.id)).toBeCloseTo(1_000_000 * (1_000 / 1_300), 1);
    expect(got(b.id)).toBeCloseTo(1_000_000 * (300 / 1_300), 1);
    expect(a.usd.in).toBe(1_000);
    expect(w.token.auctionBids).toEqual([]);
    expect(applyAction(w, b.id, { type: "bid_auction", usd: 10 })).toEqual({ ok: false, reason: "the auction closed at launch" });
    w.ledger.assertBalanced();
  });

  it("the reserve price: thin bids sell fewer FD at the reserve, and the pool opens there; the treasury keeps its share of the dollars", () => {
    const au = tokenOn({ launch: { ...calm.token.launch, auction: { enabled: true, trancheFd: 1_000_000, capUsd: 1_000, reservePriceUsd: 0.01, poolShare: 0.8 } } });
    const w = createWorld({ cfg: au, net, feeds: neutralFeeds, seed: 64, keepLedgerEntries: true });
    const a = carrier(w, "A");
    a.usd.wallet = 1_000;
    a.milesTotal = 1_000;
    expect(applyAction(w, a.id, { type: "bid_auction", usd: 1_000 })).toEqual({ ok: true });
    const t0 = w.token.treasury.usd;
    launchToken(w);
    const r = w.token.auction!;
    expect(r.priceUsd).toBe(0.01);
    expect(r.fd).toBeCloseTo(100_000, 6);
    expect(r.treasuryUsd).toBeCloseTo(200, 9);
    expect(w.token.treasury.usd - t0).toBeCloseTo(200, 9);
    expect(w.token.poolUsd).toBeCloseTo(au.token.launch.seedUsd + 800, 6);
    expect(fdPriceUsd(w)).toBeCloseTo(0.01, 9);
    w.ledger.assertBalanced();
  });

  it("with no bids the launch is the plain one", () => {
    const au = tokenOn({ launch: { ...calm.token.launch, auction: { ...calm.token.launch.auction, enabled: true } } });
    const w = createWorld({ cfg: au, net, feeds: neutralFeeds, seed: 67, keepLedgerEntries: true });
    const a = carrier(w, "A");
    fund(w, a.id, 100_000);
    a.milesTotal = 1_000;
    launchToken(w);
    expect(w.token.auction).toBeNull();
    expect(w.token.poolUsd).toBe(au.token.launch.seedUsd);
    expect(w.token.launch!.liquidityFd).toBeCloseTo(au.token.launch.poolDepthShareOfFloat * w.token.launch!.floatFd, 6);
    w.ledger.assertBalanced();
  });

  it("the launch fee: the pool charges its start fee both ways at launch, falling to the normal fees over its days; the size fee charges one big buy for its size", () => {
    const feed = tokenOn({ exchange: { ...calm.token.exchange, dailySellShareOfPool: 0, launchFee: { enabled: true, startPct: 0.5, days: 10, curve: "linear" }, sizeFee: { enabled: true, refUsd: 1_000, perRefPct: 0.1, maxPct: 0.5, days: 30 } } });
    const w = createWorld({ cfg: feed, net, feeds: neutralFeeds, seed: 65, keepLedgerEntries: true });
    const a = carrier(w, "A");
    fund(w, a.id, 100_000);
    a.milesTotal = 1_000;
    const k = feed.token.exchange;
    expect(launchFeeRate(w, k.buyFeePct)).toBe(0); // not launched
    expect(sizeFeeRate(w, 100_000)).toBe(0);
    launchToken(w);
    expect(launchFeeRate(w, k.buyFeePct)).toBeCloseTo(0.5, 12);
    expect(launchFeeRate(w, k.sellFeePct)).toBeCloseTo(0.5, 12);
    expect(buyFeeRate(w, 100)).toBeCloseTo(0.5, 12);
    expect(sizeFeeRate(w, 100)).toBe(0);
    expect(sizeFeeRate(w, 3_000)).toBeCloseTo(0.2, 12);
    expect(buyFeeRate(w, 3_000)).toBeCloseTo(0.7, 12);
    expect(sizeFeeRate(w, 100_000)).toBe(0.5);
    // A $3,000 buy on launch day: 70% of it is fees, to the treasury; 30% reaches the pool.
    a.usd.wallet = 3_000;
    const pool0 = w.token.poolUsd;
    const fee0 = w.token.treasury.feeUsd;
    const held0 = w.ledger.balance(companyAccount(a.id));
    expect(applyAction(w, a.id, { type: "buy_fd", usd: 3_000 })).toEqual({ ok: true });
    expect(w.token.poolUsd - pool0).toBeCloseTo(900, 6);
    expect(w.token.treasury.feeUsd - fee0).toBeCloseTo(2_100, 6);
    expect(w.token.launchFee.buyUsd).toBeCloseTo(2_100 - 3_000 * k.buyFeePct, 6);
    expect(w.ledger.balance(companyAccount(a.id))).toBeGreaterThan(held0);
    // A sale on launch day pays the start fee, burned, bought FD or not.
    const burned = () => w.ledger.entries.filter((e) => e.to === "sink:exchange_fee").reduce((s, e) => s + e.amount, 0);
    const b0 = burned();
    const sold = Math.floor(sellableFd(w, a) / 2);
    expect(sold).toBeGreaterThan(100);
    expect(applyAction(w, a.id, { type: "sell_fd", fd: sold })).toEqual({ ok: true });
    expect(burned() - b0).toBeCloseTo(sold * 0.5, 0);
    expect(w.token.launchFee.sellFd).toBeGreaterThan(sold * 0.2); // what the normal fee would not have taken
    // Half way through its days: half way down the line to the normal fees; the size fee whole.
    w.t += 5 * w.cfg.time.gameMinutesPerDay;
    expect(launchFeeRate(w, k.buyFeePct)).toBeCloseTo(0.5 - (0.5 - k.buyFeePct) / 2, 12);
    expect(launchFeeRate(w, k.sellFeePct)).toBeCloseTo(0.5 - (0.5 - k.sellFeePct) / 2, 12);
    expect(buyFeeRate(w, 3_000)).toBeCloseTo(0.5 - (0.5 - k.buyFeePct) / 2 + 0.2, 12);
    // After its days the normal fees stand; the size fee until its own days are over.
    w.t += 5 * w.cfg.time.gameMinutesPerDay;
    expect(launchFeeRate(w, k.buyFeePct)).toBe(0);
    expect(buyFeeRate(w, 100)).toBe(k.buyFeePct);
    expect(buyFeeRate(w, 3_000)).toBeCloseTo(k.buyFeePct + 0.2, 12);
    w.t += 20 * w.cfg.time.gameMinutesPerDay;
    expect(buyFeeRate(w, 3_000)).toBe(k.buyFeePct);
    w.ledger.assertBalanced();
    // The exponential curve: a constant factor a day from the start fee down to the normal fee.
    const w2 = createWorld({ cfg: { ...feed, token: { ...feed.token, exchange: { ...feed.token.exchange, launchFee: { ...feed.token.exchange.launchFee, curve: "exponential" } } } }, net, feeds: neutralFeeds, seed: 66 });
    carrier(w2, "A");
    launchToken(w2);
    expect(launchFeeRate(w2, 0.01)).toBeCloseTo(0.5, 9);
    w2.t += 5 * w2.cfg.time.gameMinutesPerDay;
    expect(launchFeeRate(w2, 0.01)).toBeCloseTo(0.01 * Math.sqrt(50), 6);
    w2.t += 5 * w2.cfg.time.gameMinutesPerDay;
    expect(launchFeeRate(w2, 0.01)).toBe(0);
  });
});

describe("the airdrop paid locked at the TGE, sticky locks and the bridge (Jeff, 2026-11-01)", () => {
  const base = (over: Partial<EconomyConfig["token"]>): EconomyConfig => ({ ...calm, seasonClose: { ...calm.seasonClose, enabled: false }, token: { ...calm.token, enabled: true, ...over } });

  it("pays the whole allocation at launch, 1% free and the rest spend-only; a milestone unlocks what's still there; locked FD travels locked; the deadline burns the rest", () => {
    const cfg2 = base({ airdrop: { ...calm.token.airdrop, logbook: { ...calm.token.airdrop.logbook, enabled: true, paidLocked: true } } });
    const w = createWorld({ cfg: cfg2, net, feeds: neutralFeeds, seed: 69, keepLedgerEntries: true });
    const a = carrier(w, "A");
    const b = carrier(w, "B");
    fund(w, a.id, 100_000);
    a.milesTotal = 3_000;
    launchToken(w);
    const k = cfg2.token.airdrop.logbook;
    const acct = companyAccount(a.id);
    const total = a.airdrop!.totalFd;
    expect(total).toBeGreaterThan(0);
    // The whole share is in the account at once; the working capital kept and the locked part are spend-only.
    expect(w.token.airdrop.mintedFd).toBeCloseTo(total, 2);
    expect(a.airdrop!.lockedFd).toBeCloseTo(total * (1 - k.atLaunch), 2);
    expect(sellableFd(w, a)).toBeCloseTo(total * k.atLaunch, 2);
    expect(w.ledger.locked(acct)).toBeGreaterThanOrEqual(total * (1 - k.atLaunch) - 0.01);
    // A milestone unlocks its share for withdrawal; nothing is minted.
    const cat = Object.fromEntries(logbookCatalogue(w, "carrier").map((m) => [m.id, m.share]));
    const minted = w.token.airdrop.mintedFd;
    a.loadsThisWeek = 30;
    weeklyToken(w);
    expect(a.airdrop!.logbook!.done).toEqual(["haul25"]);
    expect(w.token.airdrop.mintedFd).toBe(minted);
    expect(sellableFd(w, a)).toBeCloseTo(total * (k.atLaunch + cat.haul25!), 1);
    expect(a.airdrop!.lockedFd).toBeCloseTo(total * (1 - k.atLaunch - cat.haul25!), 1);
    // Spending draws on the locked FD first; a payment to another player carries the lock with it.
    const lockedBefore = w.ledger.locked(acct);
    w.ledger.post(w.t, acct, "sink:fuel", 1_000, `fuel:${a.id}`);
    expect(w.ledger.locked(acct)).toBeCloseTo(lockedBefore - 1_000, 2);
    const bAcct = companyAccount(b.id);
    const bLocked = w.ledger.locked(bAcct);
    const bFree = w.ledger.free(bAcct);
    expect(w.ledger.post(w.t, acct, bAcct, 2_000, "lease:week:test")).toBeCloseTo(2_000, 6);
    expect(w.ledger.locked(bAcct)).toBeCloseTo(bLocked + 2_000, 2);
    expect(w.ledger.free(bAcct)).toBeCloseTo(bFree, 2);
    expect(() => w.ledger.post(w.t, acct, bAcct, w.ledger.free(acct) + 1, "test", "freeOnly")).toThrow();
    // A withdrawal takes free FD only.
    expect(applyAction(w, a.id, { type: "sell_fd", fd: sellableFd(w, a) + 10 }).ok).toBe(false);
    // At the deadline what is still locked and unspent burns; what was spent out of it is simply gone.
    const forfeits = () => w.ledger.entries.filter((e) => e.to === "sink:airdrop_forfeit").reduce((s, e) => s + e.amount, 0);
    const f0 = forfeits();
    w.t = a.airdrop!.logbook!.deadlineDay * w.cfg.time.gameMinutesPerDay;
    weeklyToken(w);
    expect(a.airdrop!.logbook!.closed).toBe(true);
    const burned = forfeits() - f0;
    expect(burned).toBeGreaterThan(0);
    expect(burned).toBeLessThanOrEqual(total * (1 - k.atLaunch - cat.haul25!) + 0.01);
    expect(a.airdrop!.lockedFd).toBeCloseTo(0, 1);
    expect(w.token.airdrop.mintedFd).toBe(minted);
    w.ledger.assertBalanced();
  });

  it("the bridge: a sale is a withdrawal that waits out the timer, then clears through the exchange's rules under the daily cap; a wallet outside the game meets the pool at once", () => {
    const cfg2 = base({ bridge: { ...calm.token.bridge, enabled: true, delayDays: { start: 4, end: 2, overDays: 100 }, dailyOutflowShareOfPool: 0.02 }, exchange: { ...calm.token.exchange, dailySellShareOfPool: 0 } });
    const w = createWorld({ cfg: cfg2, net, feeds: neutralFeeds, seed: 70, keepLedgerEntries: true });
    const a = carrier(w, "A");
    const h = carrier(w, "H");
    fund(w, a.id, 100_000);
    a.milesTotal = 3_000;
    h.milesTotal = 3_000;
    launchToken(w);
    const free0 = sellableFd(w, a);
    expect(free0).toBeGreaterThan(1_000);
    const want = Math.floor(free0 / 2);
    expect(applyAction(w, a.id, { type: "sell_fd", fd: want })).toEqual({ ok: true });
    expect(a.usd.out).toBe(0);
    expect(w.ledger.balance(bridgeAccount(a.id))).toBeCloseTo(want, 2);
    expect(sellableFd(w, a)).toBeCloseTo(free0 - want, 2);
    expect(a.withdrawals).toEqual([{ fd: want, day: w.token.launchDay! }]);
    expect(w.token.bridge.requestedFd).toBeCloseTo(want, 6);
    // The timer: four days at launch, two once its days have run.
    expect(bridgeDelayDays(w, w.token.launchDay!)).toBe(4);
    expect(bridgeDelayDays(w, w.token.launchDay! + 100)).toBe(2);
    dailyBridge(w);
    expect(a.usd.out).toBe(0);
    w.t += 4 * w.cfg.time.gameMinutesPerDay;
    const pool = w.ledger.balance(EXCHANGE_ACCOUNT);
    dailyBridge(w);
    // Cleared as far as the day's cap allows: at most 2% of the pool's FD a day for the whole game; the rest waits.
    const cap = 0.02 * pool;
    const cleared = Math.min(want, cap);
    expect(w.token.bridge.clearedFd).toBeCloseTo(cleared, 1);
    expect(a.usd.out).toBeGreaterThan(0);
    expect(w.ledger.balance(bridgeAccount(a.id))).toBeCloseTo(want - cleared, 1);
    if (want > cap) {
      expect(a.withdrawals[0]!.fd).toBeCloseTo(want - cap, 1);
      expect(w.token.bridge.cappedDays).toBe(1);
      expect(w.token.bridge.cappedFd).toBeCloseTo(want - cap, 1);
    } else expect(a.withdrawals).toEqual([]);
    // A wallet outside the game: no bridge, the pool alone.
    h.onChain = true;
    const hf = sellableFd(w, h);
    expect(hf).toBeGreaterThan(0);
    expect(applyAction(w, h.id, { type: "sell_fd", fd: hf })).toEqual({ ok: true });
    expect(h.usd.out).toBeGreaterThan(0);
    expect(h.withdrawals).toEqual([]);
    // A change of mind: what waits comes back, less the cancel burn.
    const left = w.ledger.balance(bridgeAccount(a.id));
    const free1 = sellableFd(w, a);
    const burned = () => w.ledger.entries.filter((e) => e.to === "sink:exchange_fee" && e.ref.startsWith("bridge:cancel")).reduce((s, e) => s + e.amount, 0);
    if (left > 1) {
      expect(applyAction(w, a.id, { type: "cancel_withdrawal" })).toEqual({ ok: true });
      expect(a.withdrawals).toEqual([]);
      expect(w.ledger.balance(bridgeAccount(a.id))).toBeCloseTo(0, 2);
      expect(burned()).toBeCloseTo(Math.floor(left * cfg2.token.bridge.cancelBurn * 100) / 100, 2);
      expect(sellableFd(w, a) - free1).toBeCloseTo(left - burned(), 1);
    }
    expect(applyAction(w, a.id, { type: "cancel_withdrawal" })).toEqual({ ok: false, reason: "nothing is waiting" });
    w.ledger.assertBalanced();
  });

  it("assets remember their locked basis: a rig bought with spend-only FD sells for spend-only FD; in the farming season a rig sells for dollars held for the pool", () => {
    const cfg2 = base({ airdrop: { ...calm.token.airdrop, logbook: { ...calm.token.airdrop.logbook, enabled: true, paidLocked: true } } });
    const w = createWorld({ cfg: cfg2, net, feeds: neutralFeeds, seed: 71, keepLedgerEntries: true });
    const a = carrier(w, "A");
    const b = carrier(w, "B");
    a.milesTotal = 3_000;
    launchToken(w);
    fund(w, b.id, 200_000);
    const acct = companyAccount(a.id);
    const locked0 = w.ledger.locked(acct);
    expect(locked0).toBeGreaterThan(20_000);
    expect(applyAction(w, a.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false })).toEqual({ ok: true });
    const order = w.orders.find((o) => o.companyId === a.id)!;
    expect(order.lockedPaidFd).toBeGreaterThan(0);
    expect(w.ledger.locked(acct)).toBeCloseTo(locked0 - order.lockedPaidFd!, 1);
    w.t = (order.dueDay + 1) * w.cfg.time.gameMinutesPerDay;
    deliverOrders(w);
    const truck = w.trucksByCompany.get(a.id)!.find((t) => (t.lockedBasisFd ?? 0) > 0)!;
    expect(truck).toBeTruthy();
    expect(truck.lockedBasisFd).toBeCloseTo(order.lockedPaidFd!, 6);
    // Sold to B on the used market: A's proceeds are locked up to the basis; the truck's basis is now B's locked payment.
    expect(applyAction(w, a.id, { type: "list_truck", truckId: truck.id, askFd: 10_000, floorFd: 8_000, stepFd: 500 })).toEqual({ ok: true });
    const listing = w.listings.find((l) => l.truckId === truck.id && l.status === "open")!;
    const basis = truck.lockedBasisFd!;
    const bLocked = w.ledger.locked(companyAccount(b.id));
    const free0 = w.ledger.free(acct);
    const lockedBefore = w.ledger.locked(acct);
    expect(applyAction(w, b.id, { type: "buy_listing", listingId: listing.id })).toEqual({ ok: true });
    const netFd = 10_000 * (1 - w.cfg.usedMarket.feePct);
    expect(w.ledger.locked(acct) - lockedBefore).toBeCloseTo(Math.min(netFd, basis), 1);
    expect(w.ledger.free(acct) - free0).toBeCloseTo(netFd - Math.min(netFd, basis), 1);
    expect(truck.lockedBasisFd).toBeCloseTo(Math.min(10_000, bLocked), 1);
    w.ledger.assertBalanced();
    // The farming season's dollar window: before launch, a paying company buys a rig for dollars, held for the pool.
    const beta = { ...cfg2, token: { ...cfg2.token, betaYears: 10, catalogue: { ...cfg2.token.catalogue, usdWindow: { ...cfg2.token.catalogue.usdWindow, assets: { enabled: true, capUsdPerMc: null } } } } };
    const w2 = createWorld({ cfg: beta, net, feeds: neutralFeeds, seed: 72 });
    const d = carrier(w2, "D");
    d.usd.wallet = 5_000;
    const priceFd = dealerPrice(w2, { tier: "workhorse", trailer: "van" });
    const usd = priceFd * beta.token.catalogue.usdWindow.referencePriceUsd * beta.token.catalogue.usdWindow.premium;
    const bal = w2.ledger.balance(companyAccount(d.id));
    expect(applyAction(w2, d.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, pay: "usd" })).toEqual({ ok: true });
    expect(d.usd.wallet).toBeCloseTo(5_000 - usd, 6);
    expect(d.usdSpentBetaAssets).toBeCloseTo(usd, 6);
    expect(w2.token.treasury.seedEscrowUsd).toBeCloseTo(usd, 6);
    expect(w2.ledger.balance(companyAccount(d.id))).toBeCloseTo(bal, 2);
    expect(w2.orders.find((o) => o.companyId === d.id)!.lockedPaidFd).toBe(0);
    d.usd.wallet = 1;
    expect(applyAction(w2, d.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, pay: "usd" })).toEqual({ ok: false, reason: "not enough dollars" });
  });
});

describe("the Back Lot (2026-11-01): the stake behind the hire, one crew a company, fences and chop shops, bounties, the fence's share by commodity, the take spend-only", () => {
  const lot: EconomyConfig = {
    ...calm,
    businesses: { ...calm.businesses, enabled: true },
    robbery: { ...calm.robbery, enabled: true, protectDays: 0, odds: 10, maxOdds: 1, rigShare: 1, realStake: true, oneCrewPerVictim: true, takeLocked: true, fenceByCommodityOn: true, npcFenceShare: 0.6, backLot: { ...calm.robbery.backLot, enabled: true }, bounty: { ...calm.robbery.bounty, enabled: true } },
  };

  it("a hire locks its stake, one crew on a company at a time, only an operating company hires; a hit pays the victim's deductibles from the stake and the rest comes back", () => {
    const w = createWorld({ cfg: lot, net, feeds: neutralFeeds, seed: 94, keepLedgerEntries: true });
    const hirer = carrier(w, "Hirer");
    const victim = carrier(w, "Victim");
    addTruck(w, hirer, "owned", "workhorse", "van");
    const target = addTruck(w, victim, "owned", "workhorse", "van");
    const other = addTruck(w, victim, "owned", "workhorse", "van");
    fund(w, hirer.id, 200_000);
    const k = lot.robbery;
    const fee = crewFeeFd(w, target);
    const stake = k.stakeCover * (k.rigFenceShare * truckValue(w, target));
    const before = w.ledger.balance(companyAccount(hirer.id));
    expect(applyAction(w, hirer.id, { type: "hire_crew", truckId: target.id })).toEqual({ ok: true });
    const job = crewOn(w, target.id)!;
    expect(job.stakeFd).toBeCloseTo(stake, 2);
    expect(w.ledger.balance(crewStakeAccount(job.id))).toBeCloseTo(stake, 2);
    expect(before - w.ledger.balance(companyAccount(hirer.id))).toBeCloseTo(fee + stake, 2);
    expect(applyAction(w, hirer.id, { type: "hire_crew", truckId: other.id })).toEqual({ ok: false, reason: "a crew is already on that company" });
    expect(notoriety(w, hirer)).toBe(1);
    // A wallet outside the game can't hire.
    const wallet = carrier(w, "Wallet");
    wallet.role = "holder";
    fund(w, wallet.id, 200_000);
    expect(applyAction(w, wallet.id, { type: "hire_crew", truckId: other.id })).toEqual({ ok: false, reason: "only an operating company hires crews" });
    // The hit: the rig goes; the victim's physical-damage deductible comes out of the stake first, the rest back to the hirer; the take is spend-only.
    const value = truckValue(w, target);
    const victimBefore = w.ledger.balance(companyAccount(victim.id));
    const hirerBefore = w.ledger.balance(companyAccount(hirer.id));
    const hirerLocked = w.ledger.locked(companyAccount(hirer.id));
    crewStrike(w, target, victim, "shoulder", 3);
    expect(job.status).toBe("hit");
    const deductible = Math.min(value, lot.assets.physicalDamage.deductibleFd);
    expect(w.robbery.stats.victimsPaidFd).toBeCloseTo(Math.min(stake, deductible), 2);
    expect(w.ledger.balance(crewStakeAccount(job.id))).toBeCloseTo(0, 2);
    // No player's chop shop: the reserve's fence pays its share of the washed take.
    const take = k.npcFenceShare * k.rigFenceShare * value * (1 - k.washFee);
    expect(w.ledger.balance(companyAccount(hirer.id)) - hirerBefore).toBeCloseTo(take + (stake - Math.min(stake, deductible)), 1);
    expect(w.ledger.locked(companyAccount(hirer.id)) - hirerLocked).toBeCloseTo(take, 1);
    expect(w.ledger.balance(companyAccount(victim.id)) - victimBefore).toBeGreaterThan(0); // the deductible back, and the insurer's payout
    w.ledger.assertBalanced();
  });

  it("a fence and a chop shop buy what a crew takes and resell it a week later; a bounty on the victim pays the hirer; the fence's share follows the commodity", () => {
    const w = createWorld({ cfg: lot, net, feeds: neutralFeeds, seed: 95, keepLedgerEntries: true });
    const hirer = carrier(w, "Hirer");
    const victim = carrier(w, "Victim");
    const owner = carrier(w, "Owner");
    const avenger = carrier(w, "Avenger");
    addTruck(w, hirer, "owned", "workhorse", "van");
    const target = addTruck(w, victim, "owned", "workhorse", "van");
    fund(w, hirer.id, 300_000);
    fund(w, owner.id, 1_000_000);
    fund(w, avenger.id, 100_000);
    const hubId = w.net.hubs[target.hub]!.id;
    expect(applyAction(w, owner.id, { type: "buy_business", kind: "fence", hubId })).toEqual({ ok: true });
    expect(applyAction(w, owner.id, { type: "buy_business", kind: "chopShop", hubId })).toEqual({ ok: true });
    const shops = w.businesses.filter((b) => b.ownerId === owner.id);
    expect(shops.map((b) => b.kind)).toEqual(["fence", "chopShop"]);
    // A bounty on the victim, from a third company: held in escrow, on Channel 19.
    const k = lot.robbery;
    expect(applyAction(w, avenger.id, { type: "post_bounty", targetId: victim.id, fd: 500 })).toEqual({ ok: false, reason: `a bounty is at least ${k.bounty.minFd.toLocaleString("en-US")} FD` });
    expect(applyAction(w, avenger.id, { type: "post_bounty", targetId: victim.id, fd: 5_000 })).toEqual({ ok: true });
    expect(w.ledger.balance(bountyAccount(1))).toBeCloseTo(5_000, 2);
    expect(w.robbery.feed.at(-1)!.kind).toBe("bounty");
    // The fence's share by commodity.
    expect(fenceShareOf(w, undefined)).toBe(k.fenceShare);
    expect(applyAction(w, hirer.id, { type: "hire_crew", truckId: target.id })).toEqual({ ok: true });
    const job = crewOn(w, target.id)!;
    const value = truckValue(w, target);
    const ownerBefore = w.ledger.balance(companyAccount(owner.id));
    const hirerBefore = w.ledger.balance(companyAccount(hirer.id));
    crewStrike(w, target, victim, "shoulder", 3);
    expect(job.status).toBe("hit");
    // The chop shop paid the rig's share (washed on the hirer's end), and the bounty went to the hirer.
    const share = k.rigFenceShare * value;
    expect(ownerBefore - w.ledger.balance(companyAccount(owner.id))).toBeCloseTo(share, 1);
    expect(w.robbery.stats.chopPaidFd).toBeCloseTo(share * (1 - k.washFee), 1);
    expect(w.robbery.stats.bountiesPaidFd).toBeCloseTo(5_000, 2);
    expect(w.ledger.balance(bountyAccount(1))).toBeCloseTo(0, 2);
    expect(w.ledger.balance(companyAccount(hirer.id)) - hirerBefore).toBeCloseTo(share * (1 - k.washFee) + 5_000 + (job.stakeFd ?? 0) - Math.min(job.stakeFd ?? 0, Math.min(value, lot.assets.physicalDamage.deductibleFd)), 1);
    expect(w.robbery.resales).toHaveLength(1);
    expect(w.robbery.resales[0]!.fd).toBeCloseTo(value * k.backLot.chopPartsYield, 1);
    // A week on, the parts sell: the shop's income, a faucet.
    const soldBefore = w.ledger.balance(companyAccount(owner.id));
    w.t += (k.backLot.resaleDays + 1) * w.cfg.time.gameMinutesPerDay;
    runDays(w, 1);
    expect(w.ledger.balance(companyAccount(owner.id)) - soldBefore).toBeGreaterThan(value * k.backLot.chopPartsYield * 0.9);
    expect(w.robbery.stats.resaleFd).toBeCloseTo(value * k.backLot.chopPartsYield, 1);
    w.ledger.assertBalanced();
  });

  it("the logbook's shop item brings a milestone forward, once, for a share of the allocation", () => {
    const boosted: EconomyConfig = { ...calm, seasonClose: { ...calm.seasonClose, enabled: false }, token: { ...calm.token, enabled: true, airdrop: { ...calm.token.airdrop, logbook: { ...calm.token.airdrop.logbook, enabled: true, boost: { ...calm.token.airdrop.logbook.boost, enabled: true } } } } };
    const w = createWorld({ cfg: boosted, net, feeds: neutralFeeds, seed: 96, keepLedgerEntries: true });
    const a = carrier(w, "A");
    fund(w, a.id, 100_000);
    a.milesTotal = 3_000;
    launchToken(w);
    fund(w, a.id, 50_000);
    const k = boosted.token.airdrop.logbook;
    const lb = a.airdrop!.logbook!;
    const price = Math.max(k.boost.minFd, lb.allocationFd * k.boost.share);
    expect(applyAction(w, a.id, { type: "buy_logbook_boost", milestone: "truck1" })).toEqual({ ok: false, reason: "that milestone can't be bought forward" });
    const before = w.ledger.balance(companyAccount(a.id));
    expect(applyAction(w, a.id, { type: "buy_logbook_boost", milestone: "haul25" })).toEqual({ ok: true });
    expect(before - w.ledger.balance(companyAccount(a.id))).toBeCloseTo(price, 2);
    expect(applyAction(w, a.id, { type: "buy_logbook_boost", milestone: "haul25" })).toEqual({ ok: false, reason: "already bought" });
    // 19 loads reach a milestone that asked 25.
    a.loadsThisWeek = 19;
    weeklyToken(w);
    expect(lb.done).toEqual(["haul25"]);
    expect(applyAction(w, a.id, { type: "buy_logbook_boost", milestone: "haul25" })).toEqual({ ok: false, reason: "already reached" });
    w.ledger.assertBalanced();
  });
});

describe("the team allocation and the real-time linear vest; the dollar window for facilities (2026-11-01)", () => {
  it("vests the team's allocation, not the treasury's, a real week at a time, linearly, with no price floor", () => {
    const cfg2: EconomyConfig = {
      ...calm,
      seasonClose: { ...calm.seasonClose, enabled: false },
      token: {
        ...calm.token,
        enabled: true,
        circular: { ...calm.token.circular, enabled: true, shares: { ...calm.token.circular.shares, dev: 0.1 } },
        treasury: { ...calm.token.treasury, vest: { cliffWeeks: 1, perWeekShare: 0.1, priceFloor: false, realTime: true, linear: true } },
      },
    };
    const w = createWorld({ cfg: cfg2, net, feeds: neutralFeeds, seed: 97 });
    const a = carrier(w, "A");
    fund(w, a.id, 50_000);
    a.milesTotal = 1_000;
    const devFd = cfg2.token.circular.capFd * 0.1;
    expect(w.ledger.balance("alloc:dev")).toBeCloseTo(devFd, 2);
    launchToken(w);
    expect(w.token.treasury.vestBaseFd).toBeCloseTo(devFd, 2);
    const treasury = w.ledger.balance("alloc:treasury");
    weeklyVest(w); // inside the cliff (a real week is 28 game days): nothing
    expect(w.token.treasury.vestedFd).toBe(0);
    w.t += 28 * w.cfg.time.gameMinutesPerDay;
    for (let i = 0; i < 7; i++) w.token.priceHistory.push(w.token.launchPriceUsd / 2); // below launch: no floor, it sells anyway
    weeklyVest(w);
    // A game week's part of the real week's share of the allocation at launch: 10% × 7/28.
    expect(w.token.treasury.vestedFd).toBeCloseTo(devFd * 0.1 * (7 / 28), 2);
    expect(w.ledger.balance("alloc:dev")).toBeCloseTo(devFd - w.token.treasury.vestedFd, 2);
    expect(w.ledger.balance("alloc:treasury")).toBeCloseTo(treasury, 2);
    expect(w.token.treasury.devUsd).toBeGreaterThan(0);
    w.ledger.assertBalanced();
  });

  it("a facility and a business sell for dollars in the farming season, every dollar held for the pool", () => {
    const beta: EconomyConfig = {
      ...calm,
      businesses: { ...calm.businesses, enabled: true },
      token: { ...calm.token, enabled: true, betaYears: 10, catalogue: { ...calm.token.catalogue, usdWindow: { ...calm.token.catalogue.usdWindow, assets: { enabled: true, capUsdPerMc: null } } } },
    };
    const w = createWorld({ cfg: beta, net, feeds: neutralFeeds, seed: 98, keepLedgerEntries: true });
    const c = carrier(w, "C");
    fund(w, c.id, 100_000);
    c.usd.wallet = 20_000;
    const uw = beta.token.catalogue.usdWindow;
    const hubId = w.net.hubs[c.homeHub]!.id;
    const fPrice = beta.facilities.types.warehouse.priceFd;
    const bal0 = w.ledger.balance(companyAccount(c.id));
    expect(applyAction(w, c.id, { type: "buy_facility", facility: "warehouse", hubId, pay: "usd" })).toEqual({ ok: true });
    expect(w.token.treasury.seedEscrowUsd).toBeCloseTo(fPrice * uw.referencePriceUsd * uw.premium, 6);
    expect(w.ledger.balance(companyAccount(c.id))).toBeCloseTo(bal0, 2);
    const bPrice = beta.businesses.kinds.shop.priceFd;
    const esc = w.token.treasury.seedEscrowUsd;
    expect(applyAction(w, c.id, { type: "buy_business", kind: "shop", hubId, pay: "usd" })).toEqual({ ok: true });
    expect(w.token.treasury.seedEscrowUsd - esc).toBeCloseTo(bPrice * uw.referencePriceUsd * uw.premium, 6);
    // Only the bond left the account, in FD.
    expect(bal0 - w.ledger.balance(companyAccount(c.id))).toBeCloseTo(beta.businesses.kinds.shop.bondFd, 2);
    expect(w.businesses.at(-1)!.lockedBasisFd).toBe(0);
    w.ledger.assertBalanced();
  });
});

describe("the logbook (Jeff, 2026-10-31): 1% at launch, the rest only for milestones", () => {
  const book: EconomyConfig = {
    ...calm,
    seasonClose: { ...calm.seasonClose, enabled: false },
    token: { ...calm.token, enabled: true, airdrop: { ...calm.token.airdrop, logbook: { ...calm.token.airdrop.logbook, enabled: true } } },
  };

  it("pays 1% at launch; milestones unlock their shares; no early claim; a criminal one waits out an open case; a conviction forfeits the rest; the deadline loses it", () => {
    const w = createWorld({ cfg: book, net, feeds: neutralFeeds, seed: 61, keepLedgerEntries: true });
    const a = carrier(w, "A");
    const b = carrier(w, "B");
    fund(w, a.id, 100_000);
    fund(w, b.id, 100_000);
    a.milesTotal = 3_000;
    b.milesTotal = 3_000;
    launchToken(w);
    const k = book.token.airdrop.logbook;
    const total = a.airdrop!.totalFd;
    expect(total).toBeGreaterThan(0);
    expect(a.airdrop!.unlockedFd).toBeCloseTo(total * k.atLaunch, 6);
    expect(a.airdrop!.weeksLeft).toBe(0);
    expect(a.airdrop!.logbook!.deadlineDay).toBe(w.token.launchDay! + k.deadlineDays);
    expect(applyAction(w, a.id, { type: "claim_airdrop_now" })).toEqual({ ok: false, reason: "the logbook unlocks the airdrop: there's no early claim" });
    // A quiet week unlocks nothing; 30 loads handled reach the first milestone, and its share is paid.
    const cat = Object.fromEntries(logbookCatalogue(w, "carrier").map((m) => [m.id, m.share]));
    const honest = logbookCatalogue(w, "carrier").filter((m) => m.path === "honest");
    expect(honest.reduce((s, m) => s + m.share, 0)).toBeCloseTo(1 - k.atLaunch, 9);
    weeklyToken(w);
    expect(a.airdrop!.unlockedFd).toBeCloseTo(total * k.atLaunch, 6);
    a.loadsThisWeek = 30;
    weeklyToken(w);
    expect(a.airdrop!.logbook!.done).toEqual(["haul25"]);
    expect(a.airdrop!.unlockedFd).toBeCloseTo(total * (k.atLaunch + cat.haul25!), 6);
    expect(w.token.airdrop.logbook!.reached.haul25).toBe(1);
    // B's case gone cold counts on the criminal path, but not while another case is open.
    b.airdrop!.logbook!.coldCases = 1;
    const today = w.token.launchDay!;
    w.cases.push({ id: 1, kind: "doubleBroker", companyId: b.id, victimId: 0, loadId: 1, resolveDay: today + 30, caught: false, amountFd: 0, lossFd: 0, escrowFd: 0, truckId: 0, driverId: 0, unpaidCarrierId: 0 });
    weeklyToken(w);
    expect(b.airdrop!.logbook!.done).toEqual([]);
    w.cases[0]!.resolveDay = today;
    weeklyToken(w);
    expect(b.airdrop!.logbook!.done).toEqual(["coldCase"]);
    expect(b.airdrop!.unlockedFd).toBeCloseTo(total * (k.atLaunch + cat.coldCase!), 6);
    expect(cat.coldCase!).toBeLessThan(k.criminalShare);
    // A conviction forfeits whatever B still has locked.
    convictionForfeit(w, b);
    expect(b.airdrop!.logbook!.closed).toBe(true);
    expect(b.airdrop!.forfeitedFd).toBeCloseTo(total - b.airdrop!.unlockedFd, 6);
    expect(w.token.airdrop.logbook!.convictedFd).toBeCloseTo(b.airdrop!.forfeitedFd, 6);
    // Past the deadline what A still has locked is never minted.
    const minted = w.token.airdrop.mintedFd;
    w.t = a.airdrop!.logbook!.deadlineDay * w.cfg.time.gameMinutesPerDay;
    a.loadsThisWeek = 500;
    weeklyToken(w);
    expect(a.airdrop!.logbook!.closed).toBe(true);
    expect(w.token.airdrop.mintedFd).toBe(minted);
    expect(w.token.airdrop.logbook!.lostFd).toBeCloseTo(total * (1 - k.atLaunch - cat.haul25!), 6);
    w.ledger.assertBalanced();
  });

  it("keeps one book: a later season's share joins it, the milestones already reached paying their shares at once", () => {
    const w = createWorld({ cfg: book, net, feeds: neutralFeeds, seed: 63, keepLedgerEntries: true });
    const a = carrier(w, "A");
    fund(w, a.id, 100_000);
    a.milesTotal = 3_000;
    launchToken(w);
    const k = book.token.airdrop.logbook;
    const first = a.airdrop!.totalFd;
    a.loadsThisWeek = 30;
    weeklyToken(w);
    const cat = Object.fromEntries(logbookCatalogue(w, "carrier").map((m) => [m.id, m.share]));
    const before = a.airdrop!.unlockedFd;
    const lb = a.airdrop!.logbook!;
    a.milesTotal += 5_000;
    a.operating.revenueFd += 50_000;
    for (let i = 0; i < 10; i++) w.token.priceHistory.push(w.token.launchPriceUsd);
    w.t = 100 * w.cfg.time.gameMinutesPerDay;
    seasonAirdrop(w);
    expect(a.airdrop!.logbook).toBe(lb); // the same book
    const share = a.airdrop!.totalFd - first;
    expect(share).toBeGreaterThan(0);
    expect(lb.allocationFd).toBeCloseTo(first + share, 6);
    expect(lb.done).toEqual(["haul25"]);
    expect(lb.deadlineDay).toBe(100 + k.deadlineDays);
    expect(a.airdrop!.unlockedFd - before).toBeCloseTo(share * (k.atLaunch + cat.haul25!), 6);
    w.ledger.assertBalanced();
  });

  it("replays exactly from the seed with the logbook on, and the bots reach milestones", () => {
    const run = () => {
      const w = createWorld({ cfg: { ...book, token: { ...book.token, betaYears: 0.05 } }, net, feeds: { ...neutralFeeds, cycle: syntheticCassCycle({ seed: 62 }) }, seed: 62 });
      populate(w, { freeOwnerOperators: 30, fleets: 8, brokers: 3 });
      runDays(w, 75, ruleBotHook);
      return { supply: w.ledger.supply(), stats: w.token.airdrop.logbook, done: w.companies.map((c) => c.airdrop?.logbook?.done ?? []) };
    };
    const first = run();
    expect(first.stats).toBeDefined();
    expect(Object.keys(first.stats!.reached).length).toBeGreaterThan(0);
    expect(first.stats!.honestFd).toBeGreaterThan(0);
    expect(run()).toEqual(first);
  });
});

describe("the unlock ladder (Jeff, 2026-10-31): the game opens in layers after launch", () => {
  it("keeps businesses, re-brokering and crews closed after launch until each layer's day and metrics, then open for good; the beta is open", () => {
    const k0 = calm.unlockLadder;
    const ladder: EconomyConfig = {
      ...calm,
      seasonClose: { ...calm.seasonClose, enabled: false },
      businesses: { ...calm.businesses, enabled: true },
      robbery: { ...calm.robbery, enabled: true, protectDays: 0 },
      unlockLadder: { ...k0, enabled: true, layers: { ...k0.layers, robbery: { ...k0.layers.robbery, minPoolUsd: 1e12 } } },
      token: { ...calm.token, enabled: true },
    };
    const w = createWorld({ cfg: ladder, net, feeds: neutralFeeds, seed: 64 });
    const a = carrier(w, "A");
    fund(w, a.id, 100_000);
    a.milesTotal = 1_000;
    expect(layerOpen(w, "businesses")).toBe(true); // the beta is open
    launchToken(w);
    expect(layerOpen(w, "businesses")).toBe(false);
    expect(applyAction(w, a.id, { type: "buy_business", kind: "shop", hubId: "DAL" })).toEqual({ ok: false, reason: layerBlock(w, "businesses")! });
    const k = ladder.unlockLadder.layers;
    const at = (d: number) => (w.t = (w.token.launchDay! + d) * w.cfg.time.gameMinutesPerDay);
    at(k.businesses.afterDays - 1);
    dailyLadder(w);
    expect(layerOpen(w, "businesses")).toBe(false);
    at(k.businesses.afterDays);
    dailyLadder(w);
    expect(layerOpen(w, "businesses")).toBe(true);
    expect(layerOpen(w, "brokerage")).toBe(false);
    at(k.robbery.afterDays);
    dailyLadder(w);
    expect(layerOpen(w, "brokerage")).toBe(true);
    expect(layerOpen(w, "robbery")).toBe(false); // its pool-dollar bar isn't met yet
    w.token.poolUsd = 2e12;
    dailyLadder(w);
    expect(w.ladder.robbery).toBe(w.token.launchDay! + k.robbery.afterDays);
    w.token.poolUsd = 0;
    dailyLadder(w);
    expect(layerOpen(w, "robbery")).toBe(true); // once open, open for good
  });
});

describe("the NPC used lot (Jeff, 2026-10-31: used trucks at a quarter of new, older and riskier)", () => {
  it("sells a worn rig at its used value from the lot's stock, delivered as priced, and restocks weekly", () => {
    const k0 = calm.usedMarket.npcLot;
    const lotCfg: EconomyConfig = { ...calm, assets: { ...calm.assets, enabled: true }, usedMarket: { ...calm.usedMarket, npcLot: { ...k0, enabled: true, stock: 1, perWeek: 1 } } };
    const w = createWorld({ cfg: lotCfg, net, feeds: neutralFeeds, seed: 65, keepLedgerEntries: true });
    const c = carrier(w);
    fund(w, c.id, 500_000);
    const price = lotPrice(w, "workhorse", "van");
    const fresh = dealerPrice(w, { tier: "workhorse", trailer: "van" });
    expect(price / fresh).toBeGreaterThan(0.15);
    expect(price / fresh).toBeLessThan(0.35);
    const before = w.ledger.balance(companyAccount(c.id));
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, used: true })).toEqual({ ok: true });
    expect(before - w.ledger.balance(companyAccount(c.id))).toBeGreaterThanOrEqual(price - 0.01);
    expect(w.usedLot.stock).toBe(0);
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, used: true })).toEqual({ ok: false, reason: "the used lot is empty this week" });
    // Delivered like a new truck, as worn as it was priced: worth what the lot asks for one today.
    let t: Truck | undefined;
    for (let d = 0; d < 60 && !t; d++) {
      runDays(w, 1);
      t = w.trucksByCompany.get(c.id)!.find((x) => x.lease === "owned");
    }
    expect(t).toBeDefined();
    expect(t!.odometer).toBe(k0.odometer);
    expect(t!.milesSinceRebuild).toBe(k0.milesSinceRebuild);
    expect(truckValue(w, t!) / lotPrice(w, "workhorse", "van")).toBeCloseTo(1, 1); // no buying cheap to resell
    runDays(w, 7); // and the lot restocks weekly
    expect(w.usedLot.stock).toBe(1);
    expect(w.usedLot.sold).toBe(1);
    w.ledger.assertBalanced();
  });
});

describe("the lease deposit toward the first truck (2026-10-31, after v45)", () => {
  it("releases a free starter's lease deposit into the purchase that replaces the lease, when the switch is on", () => {
    const k0 = calm.freeEntry.leases.byValue;
    const attempt = (on: boolean) => {
      const cfg2: EconomyConfig = { ...calm, freeEntry: { ...calm.freeEntry, leases: { ...calm.freeEntry.leases, byValue: { ...k0, enabled: true, depositToPurchase: on } } } };
      const w = createWorld({ cfg: cfg2, net, feeds: neutralFeeds, seed: 66, keepLedgerEntries: true });
      const seller = carrier(w, "Seller");
      const truck = addTruck(w, seller, "owned", "workhorse", "van", false, { odometer: 400_000, milesSinceRebuild: 50_000, builtDay: -800 });
      const oo = carrier(w, "OO", true);
      const acct = companyAccount(oo.id);
      const npc = w.trucksByCompany.get(oo.id)!.find((t) => t.lease === "npc")!;
      // The lessor holds a whole 3,000 FD deposit; the starter has 4,000 FD of its own; the truck asks 6,000.
      fund(w, oo.id, 3_000);
      w.ledger.post(w.t, acct, "sink:lease_deposit", 3_000, "deposit:test");
      npc.depositFd = npc.depositDueFd = 3_000;
      const bal = w.ledger.balance(acct);
      if (bal > 4_000) w.ledger.post(w.t, acct, "sink:fines", bal - 4_000, "test");
      else fund(w, oo.id, 4_000 - bal);
      expect(applyAction(w, seller.id, { type: "list_truck", truckId: truck.id, askFd: 6_000, floorFd: 4_000, stepFd: 500 })).toEqual({ ok: true });
      return { w, oo, npc, acct, r: applyAction(w, oo.id, { type: "buy_listing", listingId: 1 }) };
    };
    const off = attempt(false);
    expect(off.r).toEqual({ ok: false, reason: "insufficient FD" });
    expect(off.npc.depositFd).toBe(3_000);
    const on = attempt(true);
    expect(on.r).toEqual({ ok: true });
    expect(on.npc.depositFd).toBe(0);
    expect(on.w.ledger.balance(on.acct)).toBeCloseTo(4_000 + 3_000 - 6_000 - salesTaxOn(on.w, 6_000), 2);
    expect(on.oo.firstOwnedTruckDay).toBe(0);
    on.w.ledger.assertBalanced();
  });
});

describe("the early-sale tax on farmed FD only (proposal, 2026-10-31)", () => {
  it("charges FD a company bought, up to what it bought, the normal fee; the rest pays the early-sale tax", () => {
    const tax: EconomyConfig = {
      ...calm,
      seasonClose: { ...calm.seasonClose, enabled: false },
      token: { ...calm.token, enabled: true, exchange: { ...calm.token.exchange, dailySellShareOfPool: 0, launchTax: { ...calm.token.exchange.launchTax, enabled: true, boughtExempt: true } } },
    };
    const w = createWorld({ cfg: tax, net, feeds: neutralFeeds, seed: 67, keepLedgerEntries: true });
    const a = carrier(w, "A");
    fund(w, a.id, 100_000);
    a.milesTotal = 1_000;
    launchToken(w);
    const k = tax.token.exchange;
    a.usd.wallet = 1_000;
    const before = w.ledger.balance(companyAccount(a.id));
    expect(applyAction(w, a.id, { type: "buy_fd", usd: 1_000 })).toEqual({ ok: true });
    const bought = w.ledger.balance(companyAccount(a.id)) - before;
    expect(a.boughtFdOpen).toBeCloseTo(bought, 1); // the ledger keeps cents
    // Selling back what it bought: the normal fee, not 75%.
    const burned = () => w.ledger.entries.filter((e) => e.to === "sink:exchange_fee").reduce((s, e) => s + e.amount, 0);
    const b0 = burned();
    expect(applyAction(w, a.id, { type: "sell_fd", fd: bought / 2 })).toEqual({ ok: true });
    expect((burned() - b0) / (bought / 2)).toBeLessThan(k.sellFeeMax + 1e-9);
    expect(a.boughtFdOpen).toBeCloseTo(bought / 2, 1);
    // Selling more than it bought: the excess pays the early-sale tax.
    const b1 = burned();
    const more = bought / 2 + 1_000;
    expect(applyAction(w, a.id, { type: "sell_fd", fd: more })).toEqual({ ok: true });
    expect((burned() - b1) / more).toBeGreaterThan(launchTaxRate(w) * (1_000 / more) - 1e-9);
    expect(a.boughtFdOpen).toBe(0);
    w.ledger.assertBalanced();
  });
});

describe("beta one (Jeff, 2026-11-01): the ladder opens the beta in layers from day one", () => {
  it("blocks businesses before day 28 of the beta with a message that says so, opens them on it, and keeps them open", () => {
    const k0 = calm.unlockLadder;
    const beta: EconomyConfig = { ...calm, businesses: { ...calm.businesses, enabled: true }, unlockLadder: { ...k0, enabled: true, beta: { enabled: true } } };
    const w = createWorld({ cfg: beta, net, feeds: neutralFeeds, seed: 99 });
    const c = carrier(w, "Starter");
    fund(w, c.id, 1_000_000);
    expect(w.token.launchDay).toBeNull();
    expect(layerOpen(w, "businesses")).toBe(false);
    expect(layerBlock(w, "businesses")).toBe(`Businesses open on day ${beta.unlockLadder.layers.businesses.afterDays} of the beta`);
    const hubId = w.net.hubs[c.homeHub]!.id;
    expect(applyAction(w, c.id, { type: "buy_business", kind: "shop", hubId }).ok).toBe(false);
    runDays(w, beta.unlockLadder.layers.businesses.afterDays + 1);
    expect(layerOpen(w, "businesses")).toBe(true);
    expect(layerOpen(w, "brokerage")).toBe(false);
    expect(w.ladder.businesses).toBe(beta.unlockLadder.layers.businesses.afterDays);
    // An open beta (the switch off) opens everything before launch, as before.
    const open = createWorld({ cfg: { ...beta, unlockLadder: { ...beta.unlockLadder, beta: { enabled: false } } }, net, feeds: neutralFeeds, seed: 99 });
    expect(layerOpen(open, "brokerage")).toBe(true);
  });
});

describe("the Back Lot v2 (2026-11-01, Jeff's morning rules): crews off the lot's board, the fee prepaid and burned, the victim a victim, heat, the NPC boards, yard security, the lessor's cover", () => {
  const lotCfg: EconomyConfig = {
    ...calm,
    token: { ...calm.token, catalogue: { ...calm.token.catalogue, enabled: true } },
    robbery: {
      ...calm.robbery,
      enabled: true,
      rigShare: 1,
      takeLocked: true,
      lot: {
        ...calm.robbery.lot,
        enabled: true,
        crews: { ...calm.robbery.lot.crews, skill: [1, 1], discretion: [0, 0], priceMult: [1, 1] },
        baseOdds: 1,
        maxOdds: 1,
        catchOnMiss: 2,
        catchOnHit: 2,
        heat: { ...calm.robbery.lot.heat, findAtMax: 1 },
      },
    },
  };

  it("hires off the board at the boards' fee, burned, with no stake, no cooldown, no shield and nothing on Channel 19; a hit pays the boards' prices less the wash, spend-only, and the victim gets nothing back; a crew that talks heats the hirer", () => {
    const w = createWorld({ cfg: lotCfg, net, feeds: neutralFeeds, seed: 96, keepLedgerEntries: true });
    const hirer = carrier(w, "Hirer");
    const victim = carrier(w, "Victim");
    addTruck(w, hirer, "owned", "workhorse", "van");
    const target = addTruck(w, victim, "owned", "workhorse", "van");
    const other = addTruck(w, victim, "owned", "workhorse", "van");
    fund(w, hirer.id, 300_000);
    const k = lotCfg.robbery;
    const crew = crewById(w, undefined)!;
    expect(w.backlot.crews).toHaveLength(k.lot.crews.count);
    const fee = lotFeeFd(w, target, crew);
    expect(fee).toBeCloseTo(Math.max(k.lot.feeMinFd, k.lot.feeShareOfBoard * k.rigShare * chopBoardPrice(w, target)) * crew.priceMult, 2);
    const before = w.ledger.balance(companyAccount(hirer.id));
    // A brand-new company is fair game, and a second crew on the same company is fine.
    expect(applyAction(w, hirer.id, { type: "hire_crew", truckId: target.id, crewId: crew.id })).toEqual({ ok: true });
    expect(applyAction(w, hirer.id, { type: "hire_crew", truckId: other.id, crewId: crew.id })).toEqual({ ok: true });
    expect(applyAction(w, hirer.id, { type: "hire_crew", truckId: other.id, crewId: 999 })).toEqual({ ok: false, reason: "a crew is already on that truck" });
    const job = crewOn(w, target.id)!;
    expect(job.feeFd).toBeCloseTo(fee, 2);
    expect(job.stakeFd).toBeUndefined();
    expect(job.crew?.name).toBe(crew.name);
    expect(before - w.ledger.balance(companyAccount(hirer.id))).toBeCloseTo(fee + lotFeeFd(w, other, crew), 2);
    expect(w.robbery.feed).toHaveLength(0);
    expect(heatOf(hirer)).toBeCloseTo(2 * k.lot.heat.perHire, 6);
    // The hit: the rig, at the chop board's price less the wash, spend-only; nothing goes back to the victim.
    const price = chopBoardPrice(w, target);
    const multBefore = chopBoardMult(w, "workhorse");
    const hirerBefore = w.ledger.balance(companyAccount(hirer.id));
    const lockedBefore = w.ledger.locked(companyAccount(hirer.id));
    lotStrike(w, job, target, victim, "road");
    expect(job.status).toBe("hit");
    expect(w.ledger.balance(companyAccount(hirer.id)) - hirerBefore).toBeCloseTo(price * (1 - k.washFee), 1);
    expect(w.ledger.locked(companyAccount(hirer.id)) - lockedBefore).toBeCloseTo(price * (1 - k.washFee), 1);
    expect(w.robbery.stats.victimsPaidFd).toBe(0);
    expect(target.status).toBe("retired");
    expect(chopBoardMult(w, "workhorse")).toBeLessThan(multBefore);
    // Channel 19 heard of the hit with no name on it, then of the crew getting pinched and talking.
    const hit = w.robbery.feed.find((f) => f.kind === "hit")!;
    expect(hit.hirerId).toBe(0);
    const caught = w.robbery.feed.find((f) => f.kind === "caught")!;
    expect(caught.hirerId).toBe(hirer.id);
    expect(w.robbery.stats.caught).toBe(1);
    expect(w.robbery.stats.talked).toBe(1);
    expect(heatOf(hirer)).toBeCloseTo(2 * k.lot.heat.perHire + k.lot.heat.perTalk, 6);
    w.ledger.assertBalanced();
  });

  it("odds: a bare truck in the open is the base; fittings, the lessor's tracker and a security manager cut them; a fully secured yard is out of reach; the lessor's policy carries the cargo deductible", () => {
    const w = createWorld({ cfg: lotCfg, net, feeds: neutralFeeds, seed: 97 });
    const victim = carrier(w, "Victim");
    const bare = addTruck(w, victim, "owned", "workhorse", "van");
    const leased = addTruck(w, victim, "npc", "workhorse", "van");
    const k = lotCfg.robbery.lot;
    const crew = { skill: 1 };
    expect(lotOdds(w, bare, victim, crew, "road")).toBeCloseTo(k.baseOdds, 6);
    expect(lotOdds(w, bare, victim, crew, "truckStop")).toBe(0);
    expect(lotOdds(w, leased, victim, crew, "road")).toBeCloseTo(k.baseOdds * (1 - k.cuts.tracker), 6);
    bare.security = { tracker: true, locks: true, camera: true };
    expect(lotOdds(w, bare, victim, crew, "road")).toBeCloseTo(k.baseOdds * (1 - k.cuts.tracker - k.cuts.locks - k.cuts.camera), 6);
    expect(lotOdds(w, bare, victim, { skill: 0.6 }, "road")).toBeCloseTo(k.baseOdds * (1 - k.cuts.tracker - k.cuts.locks - k.cuts.camera) * (1 - k.skillSpan * 0.4), 6);
    // Yard security needs a yard and the lot; all of it and nothing at home is within reach.
    fund(w, victim.id, 500_000);
    expect(applyAction(w, victim.id, { type: "buy_item", item: "yardGate", pay: "fd" })).toEqual({ ok: false, reason: "yard security needs a yard" });
    expect(applyAction(w, victim.id, { type: "buy_item", item: "yardSmall", pay: "fd" })).toEqual({ ok: true });
    expect(applyAction(w, victim.id, { type: "buy_item", item: "yardGate", pay: "fd" })).toEqual({ ok: true });
    expect(applyAction(w, victim.id, { type: "buy_item", item: "yardGate", pay: "fd" })).toEqual({ ok: false, reason: "already installed" });
    expect(yardCut(w, victim)).toBeCloseTo(k.yard.yardGate.cut, 6);
    for (const item of ["yardCameras", "yardLighting", "yardGuard"] as const) expect(applyAction(w, victim.id, { type: "buy_item", item, pay: "fd" })).toEqual({ ok: true });
    expect(yardCut(w, victim)).toBe(1);
    expect(lotOdds(w, leased, victim, crew, "yard")).toBe(0);
    expect(w.robbery.stats.yardSecurityFd).toBeGreaterThan(0);
    // The free path's rig: the lessor's policy carries the cargo deductible.
    const lane = w.net.lanesFrom[leased.hub]![0]!;
    const load = { ...testLoad(w, lane), cargoValue: 20_000, status: "assigned" as const, carrierId: victim.id, truckId: leased.id };
    w.loads.set(load.id, load);
    leased.loadId = load.id;
    leased.status = "loaded";
    const cash = w.ledger.balance(companyAccount(victim.id));
    stealCargo(w, leased, victim, load, true);
    expect(w.ledger.balance(companyAccount(victim.id))).toBeCloseTo(cash, 2);
    w.ledger.assertBalanced();
  });

  it("heat: a review of a hot company becomes an investigation that convicts, fines three times the quarter's fees, suspends the authority and halves the heat; heat cools daily, faster when laying low", () => {
    const w = createWorld({ cfg: lotCfg, net, feeds: neutralFeeds, seed: 98, keepLedgerEntries: true });
    const hirer = carrier(w, "Hirer");
    const victim = carrier(w, "Victim");
    addTruck(w, hirer, "owned", "workhorse", "van");
    const target = addTruck(w, victim, "owned", "workhorse", "van");
    fund(w, hirer.id, 300_000);
    const crew = crewById(w, undefined)!;
    expect(applyAction(w, hirer.id, { type: "hire_crew", truckId: target.id, crewId: crew.id })).toEqual({ ok: true });
    const fee = crewOn(w, target.id)!.feeFd!;
    hirer.heat = 100;
    const k = lotCfg.robbery.lot.heat;
    const cash = w.ledger.balance(companyAccount(hirer.id));
    complianceReview(w, hirer);
    expect(w.robbery.stats.investigations).toBe(1);
    expect(w.robbery.stats.convictions).toBe(1);
    expect(w.robbery.stats.finesFd).toBeCloseTo(Math.round(k.fineMultOfFees * fee), 2);
    expect(cash - w.ledger.balance(companyAccount(hirer.id))).toBeCloseTo(Math.round(k.fineMultOfFees * fee), 2);
    expect(hirer.authority.status).toBe("suspended");
    expect(hirer.authority.suspendedUntil).toBe(dayOf(w.t, w.cfg) + k.suspendDays);
    expect(heatOf(hirer)).toBeCloseTo(50, 6);
    // Cooling: the daily step, and twice as fast once the company has laid low.
    runDays(w, 1);
    expect(heatOf(hirer)).toBeCloseTo(50 - k.decayPerDay, 3);
    w.backlot.lastHireDay.set(hirer.id, -1_000);
    runDays(w, 1);
    expect(heatOf(hirer)).toBeCloseTo(50 - k.decayPerDay - k.decayPerDay * k.quietMult, 3);
    w.ledger.assertBalanced();
  });
});

describe("the first bid by hand (sprint 1, 2026-11-02): a one-truck company's standing orders wait for the owner's first bid", () => {
  const byHand: EconomyConfig = { ...calm, freeEntry: { ...calm.freeEntry, firstBidByHand: true } };
  // The web's default dispatcher, in short: a counter at break-even + 25%, a floor, a reposition toward open freight, a book-now at +20%.
  const orders: StandingOrder[] = [
    { kind: "bid", maxDeadheadMi: 150, price: { mode: "breakEvenPlus", pct: 0.25 } },
    { kind: "floor", breakEvenPlusPct: 0.05 },
    { kind: "reposition", afterIdleRounds: 1, to: { openLoadsWithinMi: 400 } },
    { kind: "bookNow", breakEvenPlusPct: 0.2, maxDeadheadMi: 150 },
  ];
  const dal = net.hubs.findIndex((h) => h.id === "DAL");
  const starter = (w: World) => formCompany(w, { name: "Starter", role: "carrier", homeHubId: "DAL", strategy: "player:test", human: true, orders, freePath: true });
  /** An open van load on a hub's longest lane at 10 FD/mi, book-now included: it beats every NPC load on the board. */
  const richLoad = (w: World, origin = dal) => {
    const lane = net.lanesFrom[origin]!.reduce((a, b) => (b.miles > a.miles ? b : a));
    const load = testLoad(w, lane);
    w.loads.set(load.id, load);
    return load;
  };
  // Oklahoma City: 203 road miles from Dallas, past the dispatcher's 150-mile reach and inside the reposition order's 400.
  const okc = net.hubs.findIndex((h) => h.id === "OKC");

  it("keeps the orders inert, the book-now closed and the truck at home until the owner bids by hand, then runs them", () => {
    const w = createWorld({ cfg: byHand, net, feeds: neutralFeeds, seed: 61 });
    const c = starter(w);
    const truck = w.trucksByCompany.get(c.id)![0]!;
    expect(ordersWaitForHand(w, c)).toBe(true);
    const load = richLoad(w);
    runDays(w, 6 / 24); // book-now checks at 02:00 and 04:00, then the 06:00 round
    expect(load.status).toBe("open");
    expect(truck.status).toBe("idle");
    expect(c.bidStats.truckRounds).toBe(0);
    // A loaded board next door doesn't move the truck either: it waits at home.
    expect(hubMiles(w, dal, okc)).toBeGreaterThan(150);
    for (let i = 0; i < 3; i++) richLoad(w, okc);
    runDays(w, 12 / 24); // the 18:00 round: two rounds idle, the reposition order would fire
    expect(truck.status).toBe("idle");
    expect(truck.hub).toBe(dal);
    // Changing the dispatcher isn't a bid.
    expect(applyAction(w, c.id, { type: "set_standing_orders", orders })).toEqual({ ok: true });
    expect(ordersWaitForHand(w, c)).toBe(true);
    // The owner's first bid lifts the gate, win or lose: cancelled before the round, the dispatcher still takes over.
    expect(applyAction(w, c.id, { type: "place_bid", truckId: truck.id, loadId: load.id, rate: 6 })).toEqual({ ok: true });
    expect(c.firstHandBidDay).toBe(0);
    expect(ordersWaitForHand(w, c)).toBe(false);
    expect(applyAction(w, c.id, { type: "cancel_bid", truckId: truck.id })).toEqual({ ok: true });
    runDays(w, 12 / 24); // to the next 06:00 round: booked, loaded and on the road by now
    expect(load.status).not.toBe("open");
    expect(load.carrierId).toBe(c.id);
    expect(truck.loadId).toBe(load.id);
  });

  it("with the switch off, or with a second truck, the dispatcher runs from the first round, and runs the truck empty to freight", () => {
    const off = createWorld({ cfg: calm, net, feeds: neutralFeeds, seed: 62 });
    const a = starter(off);
    expect(ordersWaitForHand(off, a)).toBe(false);
    const loadA = richLoad(off);
    runDays(off, 6 / 24);
    expect(loadA.status).not.toBe("open");
    expect(loadA.carrierId).toBe(a.id);

    const two = createWorld({ cfg: byHand, net, feeds: neutralFeeds, seed: 63 });
    const b = starter(two);
    addTruck(two, b, "owned", "workhorse", "van");
    expect(ordersWaitForHand(two, b)).toBe(false);
    const loadB = richLoad(two);
    runDays(two, 6 / 24);
    expect(loadB.status).not.toBe("open");
    expect(loadB.carrierId).toBe(b.id);

    const roam = createWorld({ cfg: calm, net, feeds: neutralFeeds, seed: 64 });
    const r = starter(roam);
    const truck = roam.trucksByCompany.get(r.id)![0]!;
    for (let i = 0; i < 3; i++) richLoad(roam, okc);
    runDays(roam, 6 / 24);
    expect(truck.status).toBe("repositioning");
  });

  it("bots place their first bid by hand, the way a player would, so their companies don't stall", () => {
    const w = createWorld({ cfg: byHand, net, feeds: neutralFeeds, seed: 65 });
    populate(w, { freeOwnerOperators: 60, fleets: 10, brokers: 6 });
    const starters = w.companies.filter((c) => c.freePath);
    expect(starters.every((c) => ordersWaitForHand(w, c))).toBe(true);
    runDays(w, 2, ruleBotHook); // day 0's rounds pass the starters by; the hook at midnight bids; day 1's rounds clear
    const bid = starters.filter((c) => c.firstHandBidDay !== null);
    expect(bid.length).toBeGreaterThan(starters.length / 2);
    for (const c of bid) expect(c.firstHandBidDay).toBeLessThanOrEqual(1);
    expect(starters.some((c) => c.bidStats.wins > 0)).toBe(true);
    // With the switch off nobody bids by hand: the orders did it.
    const off = createWorld({ cfg: calm, net, feeds: neutralFeeds, seed: 65 });
    populate(off, { freeOwnerOperators: 60, fleets: 10, brokers: 6 });
    runDays(off, 2, ruleBotHook);
    expect(off.companies.every((c) => c.firstHandBidDay === null)).toBe(true);
    expect(off.companies.filter((c) => c.freePath && c.bidStats.wins > 0).length).toBeGreaterThan(0);
  });
});

describe("the factoring contract (Jeff, 2026-11-02): three months over the whole fleet, priced by the fleet, every discount a sink; a broker's payables within its bond", () => {
  const k = calm.token.payment.factoring.contract;
  const withContract = (contract: Partial<typeof k> = {}): EconomyConfig => ({
    ...calm,
    token: {
      ...calm.token,
      staking: { ...calm.token.staking, enabled: true },
      pools: { ...calm.token.pools, enabled: true }, // on, as in the live levers: the contract stands them down
      payment: { ...calm.token.payment, enabled: true, factoring: { ...calm.token.payment.factoring, contract: { ...k, enabled: true, ...contract } } },
    },
  });
  const on = withContract();
  const broker = (w: World, name = "Broker") => formCompany(w, { name, role: "broker", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
  const today = (w: World) => dayOf(w.t, w.cfg);

  it("runs three full game months from signing, can't be left early, lapses at its end unless renewed, and a renewal re-reads the fleet", () => {
    const w = createWorld({ cfg: on, net, feeds: neutralFeeds, seed: 61, keepLedgerEntries: true });
    const c = carrier(w);
    fund(w, c.id, 500_000);
    addTruck(w, c, "owned", "workhorse", "van");
    const term = k.months * on.time.daysPerMonth;
    expect(term).toBe(90);
    expect(applyAction(w, c.id, { type: "set_pay_terms", terms: "factor" })).toEqual({ ok: true });
    expect(c.factoring).toMatchObject({ until: term, stakeFd: 0, rate: 0.06, trucks: 1, renew: false });
    expect(w.ledger.balance(contractAccount(c.id))).toBe(0); // no stake behind it
    // No early exit: asking for net only says what to lapse into.
    expect(applyAction(w, c.id, { type: "set_pay_terms", terms: "net" })).toEqual({ ok: true });
    expect(c.factoring).not.toBeNull();
    expect(c.payTerms).toBe("factor");
    runDays(w, term - 1);
    expect(today(w)).toBe(term - 1);
    expect(c.factoring).not.toBeNull();
    runDays(w, 1);
    expect(c.factoring).toBeNull();
    expect(c.payTerms).toBe("net");
    // Signed again, then asked to renew; four more trucks join before the term ends, and the renewal prices them.
    expect(applyAction(w, c.id, { type: "set_pay_terms", terms: "factor" })).toEqual({ ok: true });
    const end = c.factoring!.until;
    expect(applyAction(w, c.id, { type: "set_pay_terms", terms: "factor" })).toEqual({ ok: true });
    expect(c.factoring!.renew).toBe(true);
    for (let i = 0; i < 4; i++) addTruck(w, c, "owned", "workhorse", "van");
    expect(c.factoring!.rate).toBe(0.06); // fixed for the term
    runDays(w, end - today(w) + 1);
    expect(c.factoring).toMatchObject({ until: end + term, trucks: 5, renew: false });
    expect(c.factoring!.rate).toBeCloseTo(factoringRate(w, 5), 12);
    const log = w.factoringLog!;
    expect(log.contracts.map((x) => x.renewal)).toEqual([false, false, true]);
    expect(log.lapses).toBe(1);
  });

  it("prices a carrier by its fleet, 6% at one truck down a straight line to a 2.5% floor at fifty, and a broker at a flat 5%", () => {
    const w = createWorld({ cfg: on, net, feeds: neutralFeeds, seed: 62 });
    expect(factoringRate(w, 0)).toBe(0.06);
    expect(factoringRate(w, 1)).toBe(0.06);
    expect(factoringRate(w, 25.5)).toBeCloseTo(0.0425, 12);
    expect(factoringRate(w, 50)).toBeCloseTo(0.025, 12);
    expect(factoringRate(w, 80)).toBeCloseTo(0.025, 12);
    for (let n = 1; n < 60; n++) expect(factoringRate(w, n + 1)).toBeLessThanOrEqual(factoringRate(w, n));
    expect((factoringRate(w, 1) - factoringRate(w, 2)) * 100).toBeCloseTo(3.5 / 49, 10); // about 0.071 points a truck
    const b = broker(w);
    expect(applyAction(w, b.id, { type: "set_pay_terms", terms: "factor" })).toEqual({ ok: true });
    expect(b.factoring!.rate).toBe(0.05);
  });

  it("factors every invoice of the whole fleet on delivery, a truck added mid-term too, and the discount is a sink that refills the reserve, never a burn", () => {
    const w = createWorld({ cfg: on, net, feeds: neutralFeeds, seed: 63, keepLedgerEntries: true });
    const c = carrier(w);
    fund(w, c.id, 100_000);
    addTruck(w, c, "owned", "workhorse", "van");
    expect(applyAction(w, c.id, { type: "set_pay_terms", terms: "factor" })).toEqual({ ok: true });
    const later = addTruck(w, c, "owned", "workhorse", "van");
    // Quick pay is closed while the contract runs: asking for it only sets the terms to lapse into.
    expect(applyAction(w, c.id, { type: "set_pay_terms", terms: "quick" })).toEqual({ ok: true });
    const before = w.ledger.balance(companyAccount(c.id));
    bill(w, { payer: 0, faucet: "faucet:npc_shipper", payee: c, amountFd: 10_000, ref: "load:test", truckId: later.id });
    expect(w.ledger.balance(companyAccount(c.id)) - before).toBeCloseTo(9_400, 2);
    expect(w.ledger.balance("sink:factoring_fee")).toBeCloseTo(600, 2);
    expect(w.receivables.at(-1)).toMatchObject({ holder: HOLDER_NPC_FACTOR, amountFd: 10_000 });
    expect(w.factoringLog!.contracts[0]).toMatchObject({ invoicesFd: 10_000, feesFd: 600 });
    // Not whole-fleet: a truck added after signing waits for its due day.
    const some = createWorld({ cfg: withContract({ wholeFleet: false }), net, feeds: neutralFeeds, seed: 63 });
    const s = carrier(some);
    addTruck(some, s, "owned", "workhorse", "van");
    expect(applyAction(some, s.id, { type: "set_pay_terms", terms: "factor" })).toEqual({ ok: true });
    const extra = addTruck(some, s, "owned", "workhorse", "van");
    bill(some, { payer: 0, faucet: "faucet:npc_shipper", payee: s, amountFd: 10_000, ref: "load:test", truckId: extra.id });
    expect(some.receivables.at(-1)).toMatchObject({ holder: s.id });
    // In the circular economy the discount goes where the lessor's share goes: back to the reserve, nothing burned.
    expect(CIRCULAR_BURNS.has("sink:factoring_fee") || BURN_TAGS.has("sink:factoring_fee")).toBe(false);
    const l = new Ledger(true, { enabled: true, capFd: 1_000_000, shares: { reserve: 0.6, pool: 0.025, airdrop: 0.023 } });
    l.post(0, "faucet:npc_factor", "co:1", 10_000, "load:1");
    l.post(0, "co:1", "sink:factoring_fee", 600, "load:1");
    l.post(0, "co:1", "sink:npc_lease", 1_500, "load:2");
    expect(l.reserve()).toBe(600_000 - 10_000 + 600 + 1_500);
    expect(l.burned()).toBe(0);
    w.ledger.assertBalanced();
  });

  it("stands the pools down: the NPC insurer writes at its own price into its sink, and no pool takes deposits", () => {
    const w = createWorld({ cfg: on, net, feeds: neutralFeeds, seed: 64, keepLedgerEntries: true });
    const c = carrier(w);
    fund(w, c.id, 2_000_000);
    addTruck(w, c, "owned", "workhorse", "van");
    expect(applyAction(w, c.id, { type: "deposit_pool", line: "insurance", amountFd: 1_000_000 })).toEqual({ ok: false, reason: "pools aren't open" });
    const plain = { ...on, token: { ...on.token, pools: { ...on.token.pools, enabled: false } } };
    const base = quote(createWorld({ cfg: plain, net, feeds: neutralFeeds, seed: 64 }), c).annualPerTruck;
    signPolicy(w, c, "rewrite");
    expect(c.insurance.writer).toBe("npc");
    expect(c.insurance.annualPerTruck).toBeCloseTo(base, 6); // no backstop markup: there is no pool to be thin
    runDays(w, 7);
    expect(w.ledger.balance("sink:insurance")).toBeGreaterThan(0);
    expect(w.ledger.balance(poolAccount("insurance"))).toBe(0);
  });

  it("never buys a player shipper's paper: a shipper that defaults leaves its carrier unpaid and the factor out of it", () => {
    const w = createWorld({ cfg: on, net, feeds: neutralFeeds, seed: 65, keepLedgerEntries: true });
    const c = carrier(w);
    addTruck(w, c, "owned", "workhorse", "van");
    expect(applyAction(w, c.id, { type: "set_pay_terms", terms: "factor" })).toEqual({ ok: true });
    const shipper = carrier(w, "Shipper");
    bill(w, { payer: shipper.id, payee: c, amountFd: 8_000, ref: "load:shipper" });
    expect(w.receivables.at(-1)).toMatchObject({ holder: c.id, payer: shipper.id });
    shipper.liquidatingSince = 0;
    w.receivables.at(-1)!.dueDay = 0;
    const before = w.ledger.balance(companyAccount(c.id));
    dailyReceivables(w);
    expect(w.ledger.balance(companyAccount(c.id))).toBe(before);
    expect(w.ledger.entries.some((e) => e.from === "faucet:npc_factor")).toBe(false);
  });

  it("caps a broker's accounts payable at its posted bond: a booking past it is refused with the reason, a post past it passes the broker by, and the bond can't be pulled under it", () => {
    const w = createWorld({ cfg: on, net, feeds: neutralFeeds, seed: 66, keepLedgerEntries: true });
    const b = broker(w);
    fund(w, b.id, 100_000);
    expect(applyAction(w, b.id, { type: "stake_fd", fd: 75_000 })).toEqual({ ok: true });
    const c = carrier(w);
    // 70k owed to carriers on delivered loads: 5k of room under the bond.
    w.receivables.push({ id: w.nextReceivableId++, payer: b.id, payeeId: c.id, amountFd: 70_000, dueDay: 30, holder: c.id });
    expect(brokerApFd(w, b.id)).toBe(70_000);
    const lane = net.lanes.find((l) => l.miles > 400 && l.miles < 600)!;
    const load = { ...testLoad(w, lane), brokerId: b.id };
    w.loads.set(load.id, load);
    const big = 6_000 / lane.miles;
    expect(bookingCapBlock(w, load, big)).toMatch(/can't owe carriers more than its posted bond/);
    expect(w.factoringLog!.bookingsCapped).toBe(1);
    expect(bookingCapBlock(w, load, 4_000 / lane.miles)).toBeNull();
    // A post counts what is open on the board too: this load, open at its ceiling, plus a new one past the room.
    const books = brokerBooks(w);
    expect(books.get(b.id)!.postedFd).toBeCloseTo(load.ceiling * lane.miles, 6);
    expect(apCapBlock(w, b, books.get(b.id), 75_000 - 70_000 - load.ceiling * lane.miles + 1, true)).not.toBeNull();
    expect(apCapBlock(w, b, books.get(b.id), 75_000 - 70_000 - load.ceiling * lane.miles - 1, true)).toBeNull();
    // The bond backs the payables: no unstaking under them.
    expect(applyAction(w, b.id, { type: "unstake_fd", fd: 10_000, instant: false })).toEqual({ ok: false, reason: "your bond backs what you owe carriers: pay it down first" });
    expect(applyAction(w, b.id, { type: "unstake_fd", fd: 4_000, instant: false })).toEqual({ ok: true });
    // Off, there's no cap.
    const off = createWorld({ cfg: calm, net, feeds: neutralFeeds, seed: 66 });
    const ob = broker(off);
    const ol = { ...testLoad(off, lane), brokerId: ob.id };
    expect(bookingCapBlock(off, ol, 1_000)).toBeNull();
  });

  it("holds every broker's payables within its bond while the bots run the world, and settles their paper without a faucet", () => {
    const w = createWorld({ cfg: on, net, feeds: neutralFeeds, seed: 67, keepLedgerEntries: true });
    populate(w, { freeOwnerOperators: 60, fleets: 12, brokers: 4 });
    for (let d = 0; d < 45; d++) {
      runDays(w, 1, ruleBotHook);
      for (const c of w.companies) if (c.role === "broker" && c.liquidatingSince === null) expect(brokerApFd(w, c.id)).toBeLessThanOrEqual(c.stakedFd + 0.01);
    }
    const log = w.factoringLog!;
    expect(log.uncoveredFd).toBe(0);
    expect(log.overdraftFd).toBe(0);
    // Owned-truck carriers sign when thin; the discounts they paid are the sink's whole balance.
    const fees = log.contracts.reduce((s, x) => s + x.feesFd, 0);
    expect(log.contracts.length).toBeGreaterThan(0);
    expect(Math.abs(w.ledger.balance("sink:factoring_fee") - fees)).toBeLessThan(1); // the ledger rounds each entry to the cent
    w.ledger.assertBalanced();
  });

  it("makes the NPC factor whole from a defaulting broker's bond first, then its carriers, and holds the bond through the liquidation until the paper is paid", () => {
    const w = createWorld({ cfg: on, net, feeds: neutralFeeds, seed: 68, keepLedgerEntries: true });
    const b = broker(w);
    fund(w, b.id, 60_000);
    expect(applyAction(w, b.id, { type: "stake_fd", fd: 60_000 })).toEqual({ ok: true });
    const drain = (x: World, id: number) => x.ledger.post(x.t, companyAccount(id), "sink:fuel", Math.max(0, x.ledger.balance(companyAccount(id))), "test");
    drain(w, b.id); // broke: nothing but the bond to pay with
    const c1 = carrier(w, "Net carrier");
    const c2 = carrier(w, "Factored carrier");
    // The carrier's own paper falls due first in the list; the factor's 50k beside it. The bond is 60k, short of the 70k.
    w.receivables.push({ id: w.nextReceivableId++, payer: b.id, payeeId: c1.id, amountFd: 20_000, dueDay: 0, holder: c1.id });
    w.receivables.push({ id: w.nextReceivableId++, payer: b.id, payeeId: c2.id, amountFd: 50_000, dueDay: 0, holder: HOLDER_NPC_FACTOR });
    startLiquidation(w, b);
    expect(b.stakedFd).toBe(60_000); // the bond stays behind the paper
    expect(w.ledger.balance(stakeAccount(b.id))).toBe(60_000);
    const c1Before = w.ledger.balance(companyAccount(c1.id));
    dailyReceivables(w);
    expect(w.ledger.balance("sink:npc_factor")).toBeCloseTo(50_000, 2); // the factor first, in full
    expect(w.ledger.balance(companyAccount(c1.id)) - c1Before).toBeCloseTo(10_000, 2); // the carrier gets what's left
    expect(b.stakedFd).toBeCloseTo(0, 6);
    const log = w.factoringLog!;
    expect(log.bondToNpcFd).toBeCloseTo(50_000, 2);
    expect(log.uncoveredFd).toBe(0);
    expect(w.receivables).toHaveLength(0);
    // With the paper paid, the liquidation can finish and the broker restart.
    b.liquidatingSince = -on.insolvency.restartAfterDays;
    processLiquidations(w);
    expect(b.liquidatingSince).toBeNull();
    // Within the cap the bond covers all of it: a 75k bond against 70k of paper pays every holder in full.
    const w2 = createWorld({ cfg: on, net, feeds: neutralFeeds, seed: 68, keepLedgerEntries: true });
    const b2 = broker(w2);
    fund(w2, b2.id, 75_000);
    expect(applyAction(w2, b2.id, { type: "stake_fd", fd: 75_000 })).toEqual({ ok: true });
    drain(w2, b2.id);
    const d1 = carrier(w2, "Net carrier");
    const d1Before = w2.ledger.balance(companyAccount(d1.id));
    w2.receivables.push({ id: w2.nextReceivableId++, payer: b2.id, payeeId: d1.id, amountFd: 20_000, dueDay: 0, holder: d1.id });
    w2.receivables.push({ id: w2.nextReceivableId++, payer: b2.id, payeeId: d1.id, amountFd: 50_000, dueDay: 0, holder: HOLDER_NPC_FACTOR });
    startLiquidation(w2, b2);
    dailyReceivables(w2);
    expect(w2.ledger.balance("sink:npc_factor")).toBeCloseTo(50_000, 2);
    expect(w2.ledger.balance(companyAccount(d1.id)) - d1Before).toBeCloseTo(20_000, 2);
    expect(b2.stakedFd).toBeCloseTo(5_000, 6);
    w.ledger.assertBalanced();
    w2.ledger.assertBalanced();
  });
});

describe("the population dial (Jeff, 2026-11-02): the ratio held in a band by the simulated carriers, never by freight or money", () => {
  const dial = (d: Partial<EconomyConfig["population"]["dial"]> = {}, base: EconomyConfig = calm): EconomyConfig => ({
    ...base,
    population: { ...base.population, dial: { ...base.population.dial, enabled: true, ...d } },
  });
  /** A day closed with this many loads posted against this many trucks on the road (the dial reads nothing else). */
  const closeWith = (w: World, day: number, posted: number, trucks: number) => {
    w.metrics.days.push({ ...(w.metrics.days.at(-1) ?? ({} as never)), day, posted, trucksInService: trucks } as never);
    dailyPopulationDial(w, day);
  };

  it("reads the window's mean against the band, and only once the window is full and the opening is past", () => {
    expect(bandState(0.49, [0.5, 1.2])).toBe("under");
    expect(bandState(0.5, [0.5, 1.2])).toBe("within");
    expect(bandState(1.2, [0.5, 1.2])).toBe("within");
    expect(bandState(1.21, [0.5, 1.2])).toBe("over");
    const w = createWorld({ cfg: dial({ windowDays: 7, startDay: 10, band: [0.5, 1.2] }), net, feeds: neutralFeeds, seed: 71 });
    // A deep slump from day 0: nothing before day 10, however low the ratio.
    for (let d = 0; d < 10; d++) closeWith(w, d, 300, 1_000);
    expect(dialState(w)).toBe("within");
    closeWith(w, 10, 300, 1_000);
    expect(dialState(w)).toBe("under");
    expect(w.population!.mean).toBeCloseTo(0.3, 12);
    // Good days lift the mean back slowly, as the window turns over: (5 × 0.3 + 2 × 0.9) / 7 = 0.47, then 0.56.
    for (let d = 11; d < 13; d++) closeWith(w, d, 900, 1_000);
    expect(dialState(w)).toBe("under");
    closeWith(w, 13, 900, 1_000);
    expect(dialState(w)).toBe("within");
    expect(w.population!.daysUnder).toBe(3);
    // A boom: over the ceiling once the window's mean passes 1.2, (3 × 0.9 + 4 × 1.5) / 7 = 1.24 on the fourth day.
    for (let d = 14; d < 17; d++) closeWith(w, d, 1_500, 1_000);
    expect(dialState(w)).toBe("within");
    closeWith(w, 17, 1_500, 1_000);
    expect(dialState(w)).toBe("over");
    expect(w.population!.daysOver).toBe(1);
    // Off, the state is always within and nothing is kept.
    const off = createWorld({ cfg: calm, net, feeds: neutralFeeds, seed: 71 });
    for (let d = 0; d < 20; d++) closeWith(off, d, 100, 1_000);
    expect(dialState(off)).toBe("within");
    expect(off.population).toBeUndefined();
  });

  it("under the floor a bot that went under leaves the market instead of restarting, what it owes written off as a bankruptcy's and tagged; inside the band it restarts as before", () => {
    const run = (state: "under" | "within") => {
      const w = createWorld({ cfg: dial({ startDay: 0 }), net, feeds: neutralFeeds, seed: 72, keepLedgerEntries: true });
      populate(w, { freeOwnerOperators: 4, fleets: 0, brokers: 0 });
      const c = w.companies.find((x) => x.role === "carrier")!;
      w.ledger.post(w.t, companyAccount(c.id), "sink:fuel", w.ledger.balance(companyAccount(c.id)) + 10_000, "test"); // 10k in the red
      startLiquidation(w, c);
      c.liquidatingSince = -on_restartAfter();
      w.population = { daily: [], mean: 0, state, retired: 0, woundDown: 0, entered: 0, daysUnder: 0, daysOver: 0 };
      processLiquidations(w);
      return { w, c };
    };
    const on_restartAfter = () => calm.insolvency.restartAfterDays;
    const held = run("under");
    expect(held.c.retiredDay).toBe(0);
    expect(held.c.liquidatingSince).not.toBeNull(); // never restarted
    expect(held.w.trucksByCompany.get(held.c.id)!.filter((t) => t.status !== "retired")).toHaveLength(0);
    // Since 2026-11-08 (economy-emission.md §16.6) a retired bot leaves nothing behind: what it owed is written off through
    // the bankruptcy faucet, tagged so it shows, and its account is never posted to again. Its liquidation was counted once.
    expect(held.w.ledger.entries.some((e) => e.from === "faucet:bankruptcy_writeoff")).toBe(true);
    expect(held.w.ledger.balance(companyAccount(held.c.id))).toBeCloseTo(0, 6);
    expect(held.c.bankruptcies).toBe(1);
    expect(held.w.population!.retired).toBe(1);
    // A player is never held, whatever the dial reads.
    const back = run("within");
    expect(back.c.retiredDay).toBeUndefined();
    expect(back.c.liquidatingSince).toBeNull();
    expect(back.w.ledger.entries.some((e) => e.from === "faucet:bankruptcy_writeoff")).toBe(true);
  });

  it("acts slowly on the bots alone: over the ceiling a few entrants a week on the free path with no grant, under the floor a few of the weakest wind down and leave", () => {
    // A band the world never leaves on its own, so only the states set here act.
    const k = { startDay: 0, entrantsPerWeek: 3, windDownPerWeek: 2, band: [0, 1e9] as const };
    const w = createWorld({ cfg: dial(k), net, feeds: neutralFeeds, seed: 73, keepLedgerEntries: true });
    populate(w, { freeOwnerOperators: 20, fleets: 4, brokers: 1 });
    const player = formCompany(w, { name: "Player", role: "carrier", homeHubId: "DAL", strategy: "player:test", orders: [], freePath: true, human: true });
    const grants = () => w.ledger.entries.filter((e) => e.from === "faucet:starting_grant").length;
    const before = { companies: w.companies.length, grants: grants() };
    w.population = { daily: [], mean: 2, state: "over", retired: 0, woundDown: 0, entered: 0, daysUnder: 0, daysOver: 0 };
    ruleBotHook(w, 0);
    expect(w.companies.length - before.companies).toBe(3);
    expect(grants()).toBe(before.grants); // the entrants mint nothing
    const entrants = w.companies.slice(before.companies);
    expect(entrants.every((c) => c.freePath && w.trucksByCompany.get(c.id)!.some((t) => t.lease === "npc"))).toBe(true);
    runDays(w, 1);
    ruleBotHook(w, dayOf(w.t, w.cfg)); // not a dial day: nothing more
    expect(w.companies.length - before.companies).toBe(3);
    // Under the floor: the losing bots wind down, two a week at most; the player never.
    runDays(w, 62, ruleBotHook);
    for (const c of w.companies) if (c.role === "carrier") c.operating.costFd += 1e6; // every carrier deep in the red on its books
    runDays(w, 14, ruleBotHook);
    runDays(w, 7 - (dayOf(w.t, w.cfg) % 7));
    expect(dayOf(w.t, w.cfg) % 7).toBe(0);
    w.population!.state = "under";
    ruleBotHook(w, dayOf(w.t, w.cfg));
    const winding = w.companies.filter((c) => c.windingDownDay !== undefined);
    expect(winding.length).toBeLessThanOrEqual(2);
    expect(winding.length).toBeGreaterThan(0);
    expect(winding.every((c) => c.orders.length === 0 && !c.human)).toBe(true);
    expect(player.windingDownDay).toBeUndefined();
    // They leave as their trucks come home: leases handed back, owned trucks for sale, then retired.
    w.population!.state = "within";
    runDays(w, 30, ruleBotHook);
    expect(winding.some((c) => c.retiredDay !== undefined)).toBe(true);
    for (const c of winding.filter((x) => x.retiredDay !== undefined)) expect(w.trucksByCompany.get(c.id)!.filter((t) => t.status !== "retired" && t.status !== "parked")).toHaveLength(0);
    w.ledger.assertBalanced();
  });

  it("adds no faucet: with the dial on and the ratio inside its band the world, reserve and all, runs exactly as with it off", () => {
    const live = withLiveLevers(calm);
    const runWith = (c: EconomyConfig) => {
      const w = createWorld({ cfg: c, net, feeds: neutralFeeds, seed: 74 });
      populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 2 });
      runDays(w, 30, ruleBotHook);
      return w;
    };
    const off = runWith(live);
    const on = runWith(dial({ startDay: 0, windowDays: 7, band: [0, 1e9] }, live));
    expect(on.population!.state).toBe("within");
    expect(on.metrics.days.map((d) => d.reserveFd)).toEqual(off.metrics.days.map((d) => d.reserveFd));
    expect([...on.ledger.totals.entries()]).toEqual([...off.ledger.totals.entries()]);
    expect(on.population!.daily.length).toBe(7);
  });
});

describe("staking locks (Jeff, 2026-11-02): truck prices are the entry fee, a stake earns its discount by its term, and leaving early burns a slash", () => {
  const locks: EconomyConfig = {
    ...calm,
    token: { ...calm.token, staking: { ...calm.token.staking, enabled: true, lockDiscounts: { ...calm.token.staking.lockDiscounts, enabled: true } } },
  };
  const tiered: EconomyConfig = { ...calm, token: { ...calm.token, staking: { ...calm.token.staking, enabled: true } } };

  it("drops the truck and facility tiers: no stake needed past five trucks; the broker licence stake stays", () => {
    const w = createWorld({ cfg: locks, net, feeds: neutralFeeds, seed: 81 });
    const c = carrier(w);
    fund(w, c.id, 500_000);
    for (let i = 0; i < 5; i++) addTruck(w, c, "owned", "workhorse", "van");
    expect(truckCap(w, c)).toBe(locks.company.maxTrucks);
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false })).toEqual({ ok: true });
    const t = createWorld({ cfg: tiered, net, feeds: neutralFeeds, seed: 81 });
    const d = carrier(t);
    fund(t, d.id, 500_000);
    for (let i = 0; i < 5; i++) addTruck(t, d, "owned", "workhorse", "van");
    expect(applyAction(t, d.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false })).toEqual({ ok: false, reason: "company truck cap" });
    const b = formCompany(w, { name: "Broker", role: "broker", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
    expect(brokerLicensed(w, b)).toBe(false);
  });

  it("gives the term's discount for the whole term, on running costs and purchases alike, until its budget is spent, and none after", () => {
    const w = createWorld({ cfg: locks, net, feeds: neutralFeeds, seed: 82, keepLedgerEntries: true });
    const c = carrier(w);
    fund(w, c.id, 1_000_000);
    expect(applyAction(w, c.id, { type: "stake_fd", fd: 4_000, months: 12 })).toEqual({ ok: false, reason: "a lock is at least 5000 FD" });
    expect(applyAction(w, c.id, { type: "stake_fd", fd: 50_000, months: 2 })).toEqual({ ok: false, reason: "a lock runs 1, 3, 6, 12 game months" });
    expect(applyAction(w, c.id, { type: "stake_fd", fd: 100_000, months: 12 })).toEqual({ ok: true });
    const [lock] = activeLocks(w, c);
    expect(lock).toMatchObject({ fd: 100_000, months: 12, rate: 0.12, budgetFd: 24_000, usedFd: 0, endDay: 360 });
    expect(stakeDiscount(w, c)).toBe(0.12);
    // A truck from the NPC dealer: 12% off its price, the saving against the lock's budget.
    const list = dealerPrice(w, { tier: "workhorse", trailer: "van" });
    const before = w.ledger.balance(companyAccount(c.id));
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false })).toEqual({ ok: true });
    const paid = before - w.ledger.balance(companyAccount(c.id));
    expect(paid).toBeCloseTo(list * 0.88 + salesTaxOn(w, list * 0.88), 2);
    expect(lock!.usedFd).toBeCloseTo(list * 0.12, 2);
    // The budget caps every discount: a minimum lock (budget 1,200) can't buy a truck at the full 12%.
    const w3 = createWorld({ cfg: locks, net, feeds: neutralFeeds, seed: 87, keepLedgerEntries: true });
    const e = carrier(w3);
    fund(w3, e.id, 200_000);
    expect(applyAction(w3, e.id, { type: "stake_fd", fd: 5_000, months: 12 })).toEqual({ ok: true });
    const list3 = dealerPrice(w3, { tier: "flagship", trailer: "reefer" });
    expect(list3 * 0.12).toBeGreaterThan(1_200);
    const before3 = w3.ledger.balance(companyAccount(e.id));
    expect(applyAction(w3, e.id, { type: "buy_asset", tier: "flagship", trailer: "reefer", replaceNpcLease: false })).toEqual({ ok: true });
    expect(before3 - w3.ledger.balance(companyAccount(e.id))).toBeCloseTo(list3 - 1_200 + salesTaxOn(w3, list3 - 1_200), 2);
    expect(activeLocks(w3, e)[0]!.usedFd).toBe(1_200);
    expect(stakeDiscount(w3, e)).toBe(0);
    // Spend the rest of the budget: then no discount, though the lock still runs.
    noteDiscount(w, c, 1e9);
    expect(lock!.usedFd).toBe(24_000);
    expect(stakeDiscount(w, c)).toBe(0);
    // At term end it matures into free stake (no roll asked), and leaves with no slash.
    const w2 = createWorld({ cfg: locks, net, feeds: neutralFeeds, seed: 83, keepLedgerEntries: true });
    const d = carrier(w2);
    fund(w2, d.id, 100_000);
    expect(applyAction(w2, d.id, { type: "stake_fd", fd: 50_000, months: 1 })).toEqual({ ok: true });
    expect(stakeDiscount(w2, d)).toBe(0.03);
    runDays(w2, 31);
    expect(activeLocks(w2, d)).toHaveLength(0);
    expect(stakeDiscount(w2, d)).toBe(0);
    expect(applyAction(w2, d.id, { type: "unstake_fd", fd: 50_000, instant: false })).toEqual({ ok: true });
    expect(w2.ledger.balance("sink:lock_slash")).toBe(0);
  });

  it("burns a slash of twice the discounts taken plus a tenth of the lock when it is left early, and only when asked to break it", () => {
    const w = createWorld({ cfg: locks, net, feeds: neutralFeeds, seed: 84, keepLedgerEntries: true });
    const c = carrier(w);
    fund(w, c.id, 200_000);
    expect(applyAction(w, c.id, { type: "stake_fd", fd: 50_000, months: 3 })).toEqual({ ok: true });
    const [lock] = activeLocks(w, c);
    noteDiscount(w, c, 1_000); // 1,000 FD of discounts taken (the budget is 4% of 50k: 2,000)
    expect(lock!.usedFd).toBe(1_000);
    expect(lockSlash(w, lock!)).toBeCloseTo(2 * 1_000 + 0.1 * 50_000, 6);
    const refused = applyAction(w, c.id, { type: "unstake_fd", fd: 50_000, instant: false });
    expect(refused.ok).toBe(false);
    expect(c.stakedFd).toBe(50_000);
    expect(applyAction(w, c.id, { type: "unstake_fd", fd: 50_000, instant: false, breakLocks: true })).toEqual({ ok: true });
    expect(w.ledger.balance("sink:lock_slash")).toBeCloseTo(7_000, 2);
    expect(c.stakedFd).toBeCloseTo(0, 6);
    expect(c.unstaking.reduce((s, e) => s + e.fd, 0)).toBeCloseTo(43_000, 2); // the rest leaves through the queue
    // Breaking never pays: at any term, with the whole budget taken, the slash exceeds the discount.
    for (const [months, , share] of locks.token.staking.lockDiscounts.terms) {
      const l = { id: 1, fd: 100_000, months, startDay: 0, endDay: 1, rate: 0, budgetFd: 100_000 * share, usedFd: 100_000 * share, roll: false };
      expect(lockSlash(w, l)).toBeGreaterThan(l.usedFd);
    }
    // The slash is a burn: in the circular economy it leaves the cap, unlike the factor's fee.
    expect(CIRCULAR_BURNS.has("sink:lock_slash") && BURN_TAGS.has("sink:lock_slash")).toBe(true);
    const l = new Ledger(true, { enabled: true, capFd: 1_000_000, shares: { reserve: 0.6, pool: 0.025, airdrop: 0.023 } });
    l.post(0, "faucet:npc_shipper", "co:stake:1", 10_000, "load:1");
    l.post(0, "co:stake:1", "sink:lock_slash", 7_000, "lock:1:1");
    expect(l.burned()).toBe(7_000);
    w.ledger.assertBalanced();
  });

  it("breaks locks soonest-ending first until the FD asked for is free, and never unstakes FD still under a lock", () => {
    const w = createWorld({ cfg: locks, net, feeds: neutralFeeds, seed: 86, keepLedgerEntries: true });
    const c = carrier(w);
    fund(w, c.id, 100_000);
    expect(applyAction(w, c.id, { type: "stake_fd", fd: 7_400, months: 3 })).toEqual({ ok: true });
    runDays(w, 1);
    expect(applyAction(w, c.id, { type: "stake_fd", fd: 6_500, months: 3 })).toEqual({ ok: true });
    // 6,000: breaking the first lock frees 7,400 less its slash (740), enough; the second stays, still fully staked.
    expect(applyAction(w, c.id, { type: "unstake_fd", fd: 6_000, instant: true, breakLocks: true })).toEqual({ ok: true });
    expect(activeLocks(w, c)).toHaveLength(1);
    expect(c.stakedFd).toBeCloseTo(13_900 - 740 - 6_000, 2);
    expect(c.stakedFd).toBeGreaterThanOrEqual(6_500 - 0.01); // what is still locked is still staked
    // 1,000 more: only 660 is free, so the second lock breaks too (its slash 650) and the 1,000 leaves.
    expect(applyAction(w, c.id, { type: "unstake_fd", fd: 1_000, instant: true, breakLocks: true })).toEqual({ ok: true });
    expect(activeLocks(w, c)).toHaveLength(0);
    expect(c.stakedFd).toBeCloseTo(7_160 - 650 - 1_000, 2);
    expect(w.ledger.balance("sink:lock_slash")).toBeCloseTo(740 + 650, 2);
    w.ledger.assertBalanced();
  });

  it("changes nothing with the switch off: the tiers gate, and their discounts apply", () => {
    const w = createWorld({ cfg: tiered, net, feeds: neutralFeeds, seed: 85 });
    const c = carrier(w);
    fund(w, c.id, 200_000);
    expect(applyAction(w, c.id, { type: "stake_fd", fd: 20_000, months: 12 })).toEqual({ ok: false, reason: "stakes aren't locked for a term" });
    expect(applyAction(w, c.id, { type: "stake_fd", fd: 20_000 })).toEqual({ ok: true });
    expect(stakeDiscount(w, c)).toBe(0.05);
    expect(truckCap(w, c)).toBe(10);
  });
});

describe("the red team's ledger breaks (2026-11-03): escrows never overdrawn, spend-only FD conserved", () => {
  it("E3-LOCK: locked FD that lands in an account in the red is owed, paid by the next free FD, and never stands above the balance", () => {
    const l = new Ledger(true);
    const total = () => l.lockedSupply() + l.lockDebtSupply();
    // A broker's licence stake of spend-only FD sits in escrow; its cash is 297 in the red (paid out free FD it didn't have).
    l.post(0, "faucet:starting_grant", "co:84", 75_000, "test");
    l.lock("co:84", 75_000);
    l.post(0, "co:84", "co:stake:84", 75_000, "stake:84");
    expect(l.locked("co:stake:84")).toBe(75_000);
    l.post(0, "co:84", "co:7", 297, "payment"); // an overdraft that paid another company free FD
    expect(l.balance("co:84")).toBe(-297);
    expect(l.free("co:7")).toBe(297);
    // The stake comes home: 74,703 of cash, all spend-only, and 297 owed.
    l.post(0, "co:stake:84", "co:84", 75_000, "unstake:84");
    expect(l.balance("co:84")).toBe(74_703);
    expect(l.locked("co:84")).toBe(74_703);
    expect(l.lockDebt("co:84")).toBe(297);
    expect(l.free("co:84")).toBe(0);
    expect(total()).toBe(75_000); // conserved: nothing spend-only turned free
    // The next free FD pays the debt first.
    l.post(0, "faucet:npc_shipper", "co:84", 1_000, "load:1");
    expect(l.locked("co:84")).toBe(75_000);
    expect(l.lockDebt("co:84")).toBe(0);
    expect(l.free("co:84")).toBe(703);
    expect(total()).toBe(75_000);
    // Spending still draws on it first, and the lock never exceeds the balance on the way down.
    l.post(0, "co:84", "sink:fuel", 75_500, "fuel:1");
    expect(l.locked("co:84")).toBeLessThanOrEqual(Math.max(0, l.balance("co:84")));
    expect(l.locked("co:84")).toBe(0);
    l.assertBalanced();
  });

  it("E3-LOCK: a bankruptcy discharges the spend-only FD owed but never frees what is still held", () => {
    const tk: EconomyConfig = { ...calm, token: { ...calm.token, staking: { ...calm.token.staking, enabled: true } } };
    const w = createWorld({ cfg: tk, net, feeds: neutralFeeds, seed: 91 });
    const c = carrier(w);
    const acct = companyAccount(c.id);
    fund(w, c.id, 60_000);
    w.ledger.lock(acct, w.ledger.balance(acct)); // all of it spend-only (an airdrop paid locked, say)
    expect(applyAction(w, c.id, { type: "stake_fd", fd: 50_000 })).toEqual({ ok: true });
    w.ledger.post(w.t, acct, "sink:fuel", w.ledger.balance(acct) + 3_000, "test"); // 3,000 in the red
    startLiquidation(w, c); // the stake comes back to cash for the creditors: 47,000, all of it still spend-only
    expect(w.ledger.balance(acct)).toBeCloseTo(47_000, 2);
    expect(w.ledger.locked(acct)).toBeCloseTo(47_000, 2);
    expect(w.ledger.lockDebt(acct)).toBeCloseTo(3_000, 2);
    restart(w, c);
    expect(w.ledger.locked(acct)).toBeCloseTo(47_000, 2); // a restart is no way to free locked FD
    expect(w.ledger.lockDebt(acct)).toBe(0);
    expect(w.ledger.free(acct)).toBe(0);
    w.ledger.assertBalanced();
  });

  it("E2-EXIT: the unstake queue pays out in cents within its escrow, however the global limit slices it", () => {
    const tight: EconomyConfig = { ...calm, token: { ...calm.token, staking: { ...calm.token.staking, enabled: true, exitLimitPerDay: 0.0137 } } };
    const w = createWorld({ cfg: tight, net, feeds: neutralFeeds, seed: 92 });
    const cs = [carrier(w, "A"), carrier(w, "B"), carrier(w, "C")];
    const odd = [12_345.678, 9_876.543, 31_415.926];
    cs.forEach((c, i) => {
      fund(w, c.id, 100_000);
      expect(applyAction(w, c.id, { type: "stake_fd", fd: odd[i]! })).toEqual({ ok: true });
    });
    cs.forEach((c, i) => expect(applyAction(w, c.id, { type: "unstake_fd", fd: odd[i]! / 3, instant: false })).toEqual({ ok: true }));
    cs.forEach((c) => expect(applyAction(w, c.id, { type: "unstake_fd", fd: 1_234.567, instant: false })).toEqual({ ok: true }));
    expect(applyAction(w, cs[0]!.id, { type: "unstake_fd", fd: 777.777, instant: true })).toEqual({ ok: true });
    for (let d = 0; d < 90; d++) {
      runDays(w, 1);
      for (const c of cs) expect(w.ledger.balance(exitAccount(c.id))).toBeGreaterThanOrEqual(0);
    }
    for (const c of cs) {
      expect(c.unstaking).toEqual([]);
      expect(w.ledger.balance(exitAccount(c.id))).toBe(0);
      expect(w.ledger.balance(stakeAccount(c.id))).toBeCloseTo(c.stakedFd, 6); // the stake and its account agree to the cent
    }
    w.ledger.assertBalanced();
  });
});
