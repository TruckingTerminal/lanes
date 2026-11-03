import { describe, expect, it } from "vitest";
import { economyConfig as cfg, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds, PLACE_OF_HUB } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import {
  addTruck,
  applyAction,
  bill,
  brokerageLog,
  companyAccount,
  createWorld,
  dailyReceivables,
  formCompany,
  holdsAtEnd,
  laneRate,
  launchHold,
  mayTake,
  ownBand,
  partnerOf,
  rebrokerLoad,
  releaseLaunchHolds,
  runDays,
  samePerson,
  startHold,
  stakeAccount,
  type Company,
  type Load,
  type World,
} from "../src/index.js";
import { HOLDER_NPC_FACTOR, callBond } from "../src/receivables.js";
import { startLiquidation } from "../src/solvency.js";
import { seatDriver } from "../src/world.js";

// Player brokerages (config brokerage; studio/specs/brokerage-rule.md, studio/reviews/economy-brokerage.md).
const net = buildNetwork(hubs, cfg);
const calm: EconomyConfig = { ...cfg, breakdowns: { ...cfg.breakdowns, per1000MiNew: 0 } };
const k = calm.token.payment.factoring.contract;
const on: EconomyConfig = {
  ...calm,
  brokerage: { ...calm.brokerage, enabled: true },
  token: {
    ...calm.token,
    staking: { ...calm.token.staking, enabled: true },
    payment: { ...calm.token.payment, enabled: true, factoring: { ...calm.token.payment.factoring, contract: { ...k, enabled: true } } },
  },
};
const fee = on.brokerage.transferFeePct;
const bond = on.token.staking.roles.broker;
const licence = on.permits.brokerLicenseRenewalFd;

const fund = (w: World, id: number, fd: number) => w.ledger.post(w.t, "faucet:starting_grant", companyAccount(id), fd, "test");
const cash = (w: World, c: Company) => w.ledger.balance(companyAccount(c.id));
const carrier = (w: World, name = "Owner Freight") => formCompany(w, { name, role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });

function testLoad(w: World, lane: { id: number; origin: number; dest: number; miles: number }, over: Partial<Load> = {}): Load {
  const load: Load = {
    id: w.nextLoadId++, laneId: lane.id, origin: lane.origin, dest: lane.dest, miles: lane.miles, equipment: "van",
    brokerId: null, shipperId: null, facilityId: null, saleValue: 0, shipperRate: 3, spotShipperRate: 3, refRate: 2.5, ceiling: 2.8, bookNow: 2.6,
    postedRound: -1, roundsUnfilled: 0, status: "open", carrierId: null, truckId: null, clearedRate: 0, dueT: 0,
    hot: 0, vet: 0, cargoValue: 0, doubleBroker: null,
    commodity: 0, originPlace: PLACE_OF_HUB[lane.origin]!, destPlace: PLACE_OF_HUB[lane.dest]!, appointmentT: 1e12, slotT: 0, routeHours: lane.miles / 50, routeTollFd: 0, localUntilRound: 0, contractId: 0, tenderedTo: 0, tenderUntil: 0,
    ...over,
  };
  w.loads.set(load.id, load);
  return load;
}

/** A carrier with its brokerage formed: the bond, the licence and a 20k float as the starting capital. */
function pair(seed: number, config = on) {
  const w = createWorld({ cfg: config, net, feeds: neutralFeeds, seed, keepLedgerEntries: true });
  const c = carrier(w);
  fund(w, c.id, 200_000);
  const capital = bond + licence + 20_000;
  expect(applyAction(w, c.id, { type: "form_brokerage", name: "Owner Brokerage", capitalFd: capital })).toEqual({ ok: true });
  return { w, c, b: partnerOf(w, c)!, capital };
}

describe("player brokerages (brokerage.enabled)", () => {
  it("is off by default, and a carrier forms one only with the rule on and the ladder's layer open", () => {
    expect(cfg.brokerage.enabled).toBe(false);
    expect(cfg.brokerage.transferFeePct).toBe(0.03);
    const off = createWorld({ cfg: calm, net, feeds: neutralFeeds, seed: 1 });
    const c0 = carrier(off);
    fund(off, c0.id, 200_000);
    expect(applyAction(off, c0.id, { type: "form_brokerage", name: "X", capitalFd: 100_000 })).toEqual({ ok: false, reason: "brokerages aren't open to players" });
    // The staged beta's ladder: the brokerage layer opens on day 91.
    const laddered: EconomyConfig = { ...on, unlockLadder: { ...on.unlockLadder, enabled: true, beta: { ...on.unlockLadder.beta, enabled: true } } };
    const w = createWorld({ cfg: laddered, net, feeds: neutralFeeds, seed: 2 });
    const c = carrier(w);
    fund(w, c.id, 200_000);
    expect(applyAction(w, c.id, { type: "form_brokerage", name: "X", capitalFd: 100_000 }).ok).toBe(false);
    runDays(w, laddered.unlockLadder.layers.brokerage.afterDays + 1);
    expect(applyAction(w, c.id, { type: "form_brokerage", name: "X", capitalFd: 100_000 })).toEqual({ ok: true });
  });

  it("forms the brokerage as its own company: no grant, its licence paid, the bond staked out of the owner's capital, the fee to the reserve, one per owner", () => {
    const { w, c, b, capital } = pair(3);
    expect(b.role).toBe("broker");
    expect(b.partnerId).toBe(c.id);
    expect(c.partnerId).toBe(b.id);
    expect(samePerson(w, c.id, b.id)).toBe(true);
    expect(b.stakedFd).toBe(bond);
    expect(w.ledger.balance(stakeAccount(b.id))).toBe(bond);
    // No grant: the brokerage holds its capital less the licence and the bond.
    expect(cash(w, b)).toBeCloseTo(capital - licence - bond, 2);
    expect(cash(w, c)).toBeCloseTo(200_000 + w.cfg.company.startingGrantFd - w.cfg.permits.carrierAuthorityFd - capital * (1 + fee), 2);
    expect(w.ledger.balance("sink:capital_transfer_fee")).toBeCloseTo(capital * fee, 2);
    expect(w.ledger.entries.some((e) => e.ref === `grant:${b.id}`)).toBe(false);
    // Fresh credit: no payment record.
    expect(b.credit).toEqual({ onTimeFd: 0, lateFd: 0 });
    expect(applyAction(w, c.id, { type: "form_brokerage", name: "Again", capitalFd: capital })).toEqual({ ok: false, reason: "one carrier and one brokerage per owner" });
    expect(applyAction(w, b.id, { type: "form_brokerage", name: "Again", capitalFd: capital })).toEqual({ ok: false, reason: "a brokerage is formed by a carrier" });
    w.ledger.assertBalanced();
  });

  it("moves the owner's capital either way for the fee, never as revenue, and refuses it out of a company in debt, or one it would leave negative", () => {
    const { w, c, b } = pair(4);
    const before = { c: cash(w, c), b: cash(w, b), rev: c.operating.revenueFd + b.operating.revenueFd, cost: c.operating.costFd + b.operating.costFd };
    expect(applyAction(w, b.id, { type: "transfer_capital", fd: 10_000 })).toEqual({ ok: true });
    expect(cash(w, b)).toBeCloseTo(before.b - 10_000 * (1 + fee), 2);
    expect(cash(w, c)).toBeCloseTo(before.c + 10_000, 2);
    expect(c.operating.revenueFd + b.operating.revenueFd).toBe(before.rev);
    expect(c.operating.costFd + b.operating.costFd).toBe(before.cost);
    expect(applyAction(w, b.id, { type: "transfer_capital", fd: 1_000_000 })).toEqual({ ok: false, reason: "that would leave the company negative" });
    c.weeksInDebt = 1;
    expect(applyAction(w, c.id, { type: "transfer_capital", fd: 1_000 })).toEqual({ ok: false, reason: "the company has paper overdue" });
    c.weeksInDebt = 0;
    startLiquidation(w, c);
    expect(applyAction(w, c.id, { type: "transfer_capital", fd: 1_000 }).ok).toBe(false);
    // A stranger is not the owner's other company.
    const stranger = carrier(w, "Stranger");
    expect(partnerOf(w, stranger)).toBeNull();
    expect(applyAction(w, stranger.id, { type: "transfer_capital", fd: 1_000 })).toEqual({ ok: false, reason: "you have no other company" });
    const log = brokerageLog(w);
    expect(log.transfers).toBe(2); // the starting capital and the one above
    w.ledger.assertBalanced();
  });

  it("keeps own paper at net, never factored, out of both credit records, and the own carrier last in the bond's queue", () => {
    const { w, c, b } = pair(5);
    addTruck(w, c, "owned", "workhorse", "van");
    expect(applyAction(w, c.id, { type: "set_pay_terms", terms: "factor" })).toEqual({ ok: true });
    expect(c.factoring).not.toBeNull();
    // The brokerage's paper to its own carrier is held by the carrier, unfactored, though the carrier's contract covers the whole fleet.
    bill(w, { payer: b.id, payee: c, amountFd: 8_000, ref: "load:own" });
    const own = w.receivables.find((r) => r.payer === b.id && r.payeeId === c.id)!;
    expect(own.holder).toBe(c.id);
    // A stranger's paper from the same brokerage is factored as usual.
    const s = carrier(w, "Stranger");
    addTruck(w, s, "owned", "workhorse", "van");
    expect(applyAction(w, s.id, { type: "set_pay_terms", terms: "factor" })).toEqual({ ok: true });
    bill(w, { payer: b.id, payee: s, amountFd: 8_000, ref: "load:stranger" });
    expect(w.receivables.find((r) => r.payeeId === s.id)!.holder).toBe(HOLDER_NPC_FACTOR);
    // Settled at due: the own payment enters no credit record; the stranger's does.
    for (const r of w.receivables) r.dueDay = 0;
    dailyReceivables(w);
    expect(b.credit.onTimeFd).toBeCloseTo(8_000, 2);
    expect(c.credit).toEqual({ onTimeFd: 0, lateFd: 0 });
    // The bond's queue: a broke brokerage with 10k of bond left pays the stranger's 8k first, its own carrier the rest.
    w.ledger.post(w.t, companyAccount(b.id), "sink:fuel", Math.max(0, cash(w, b)), "test");
    w.ledger.post(w.t, stakeAccount(b.id), companyAccount(b.id), bond - 10_000, "test");
    b.stakedFd = 10_000;
    w.ledger.post(w.t, companyAccount(b.id), "sink:fuel", Math.max(0, cash(w, b)), "test");
    w.receivables.push({ id: w.nextReceivableId++, payer: b.id, payeeId: c.id, amountFd: 8_000, dueDay: 0, holder: c.id });
    w.receivables.push({ id: w.nextReceivableId++, payer: b.id, payeeId: s.id, amountFd: 8_000, dueDay: 5, holder: s.id });
    const before = { c: cash(w, c), s: cash(w, s) };
    callBond(w, b);
    expect(cash(w, s) - before.s).toBeCloseTo(8_000, 2);
    expect(cash(w, c) - before.c).toBeCloseTo(2_000, 2);
    w.ledger.assertBalanced();
  });

  it("Rule B: tenders the brokerage's own load to its own carrier only inside the lane's band, and the carrier hauls it at that pay", () => {
    const { w, c, b } = pair(6);
    const lane = net.lanes.find((l) => l.origin === net.hubs.findIndex((h) => h.id === "DAL") && l.miles > 300 && l.miles < 600)!;
    const load = testLoad(w, lane, { brokerId: b.id });
    const [lo, hi] = ownBand(w, load);
    expect(lo).toBeCloseTo(laneRate(w, load) * on.brokerage.band[0], 9);
    expect(hi).toBeCloseTo(laneRate(w, load) * on.brokerage.band[1], 9);
    expect(laneRate(w, load)).toBeGreaterThan(0);
    expect(applyAction(w, b.id, { type: "tender_own", loadId: load.id, rate: hi * 1.01 })).toEqual({ ok: false, reason: "the pay is outside the lane's band" });
    expect(applyAction(w, b.id, { type: "tender_own", loadId: load.id, rate: lo * 0.99 })).toEqual({ ok: false, reason: "the pay is outside the lane's band" });
    expect(applyAction(w, b.id, { type: "tender_own", loadId: load.id, rate: hi })).toEqual({ ok: true });
    expect(load.tenderedTo).toBe(c.id);
    const truck = addTruck(w, c, "owned", "workhorse", "van");
    seatDriver(w, w.staffByCompany.get(c.id)!.find((s) => s.owner)!, truck);
    expect(applyAction(w, c.id, { type: "accept_tender", truckId: truck.id, loadId: load.id })).toEqual({ ok: true });
    expect(load.carrierId).toBe(c.id); // booked: assigned, or already loading at its pickup
    expect(load.status).not.toBe("open");
    expect(load.clearedRate).toBeCloseTo(hi, 9);
    expect(brokerageLog(w).ownTendersBooked).toBe(1);
    expect(brokerageLog(w).ownAtEdge).toBe(1);
    // Someone else's load, or a stranger's carrier, can't be tendered this way.
    const other = testLoad(w, lane);
    expect(applyAction(w, b.id, { type: "tender_own", loadId: other.id, rate: (lo + hi) / 2 }).ok).toBe(false);
  });

  it("Rule A: passes a direct contract tender to the brokerage inside its window, re-papered at the contract rate, and never back to the carrier that passed it", () => {
    const { w, c, b } = pair(7);
    const lane = net.lanes.find((l) => l.miles > 300 && l.miles < 600)!;
    w.contracts.push({ id: w.nextContractId++, carrierId: c.id, origin: lane.origin, dest: lane.dest, laneId: lane.id, equipment: "van", originPlace: PLACE_OF_HUB[lane.origin]!, destPlace: PLACE_OF_HUB[lane.dest]!, ratePerMile: 2.7, loadsPerWeek: 2, startDay: 0, endDay: 90, offerExpiresDay: 0, tendered: 0, accepted: 0, acceptance: 1, cut: false, status: "active", stakeFd: 0 });
    const contract = w.contracts.at(-1)!;
    const load = testLoad(w, lane, { contractId: contract.id, tenderedTo: c.id, tenderUntil: w.t + 12 * 60 });
    // A board load can't be passed: only a direct tender held for the carrier.
    const board = testLoad(w, lane);
    expect(applyAction(w, c.id, { type: "pass_tender", loadId: board.id })).toEqual({ ok: false, reason: "only a direct contract tender held for you" });
    expect(applyAction(w, c.id, { type: "pass_tender", loadId: load.id })).toEqual({ ok: true });
    expect(load.brokerId).toBe(b.id);
    expect(load.shipperRate).toBe(2.7);
    expect(load.passedBy).toBe(c.id);
    expect(load.tenderedTo).toBe(0);
    expect(applyAction(w, b.id, { type: "tender_own", loadId: load.id, rate: load.refRate })).toEqual({ ok: false, reason: "a passed load never goes back to the carrier that passed it" });
    // Outside the window, refused.
    const late = testLoad(w, lane, { contractId: contract.id, tenderedTo: c.id, tenderUntil: w.t - 1 });
    expect(applyAction(w, c.id, { type: "pass_tender", loadId: late.id })).toEqual({ ok: false, reason: "the tender's window has closed" });
  });

  it("starts a brokerage with the default standing order and vetting, so shippers tender to it from its first round", () => {
    const { b } = pair(11);
    expect(b.orders).toEqual([{ kind: "broker", marginPct: on.brokerage.defaultMarginPct, maxOpenLoads: on.brokerage.defaultOpenLoads }]);
    expect(b.vetting).toBe(on.brokerage.defaultVetting);
    expect(on.brokerage.startCashFd).toBe(15_000);
  });

  it("holds a shipper's tender off the board for the brokerage: posted at a margin, declined to the open board, or, at the window's end, as the standing order says", () => {
    const { w, c, b } = pair(12);
    const lane = net.lanes.find((l) => l.miles > 300 && l.miles < 600)!;
    const stranger = carrier(w, "Stranger");
    const held = () => {
      const load = testLoad(w, lane, { brokerId: b.id, shipperRate: 3, spotShipperRate: 3.2, ceiling: 2.85 });
      b.openBrokerLoads++;
      startHold(w, load, b);
      return load;
    };
    // Held: no carrier may take it, not even the owner's.
    const a = held();
    expect(a.hold).toMatchObject({ brokerId: b.id, declinable: true });
    expect(mayTake(w, stranger, a)).toBe(false);
    expect(mayTake(w, c, a)).toBe(false);
    // Posted by hand at 8%: on the board at 92% of the shipper's rate.
    expect(applyAction(w, b.id, { type: "post_tender", loadId: a.id, marginPct: 0.08 })).toEqual({ ok: true });
    expect(a.hold).toBeUndefined();
    expect(a.ceiling).toBeCloseTo(3 * 0.92, 9);
    expect(mayTake(w, stranger, a)).toBe(true);
    // Declined: it goes on as the shipper's own spot freight.
    const d = held();
    expect(applyAction(w, b.id, { type: "decline_tender", loadId: d.id })).toEqual({ ok: true });
    expect(d.brokerId).toBeNull();
    expect(d.ceiling).toBeCloseTo(3.2, 9);
    // At the window's end the standing order posts it at its margin; with no order it is declined.
    const e = held();
    w.t = e.hold!.until;
    holdsAtEnd(w);
    expect(e.hold).toBeUndefined();
    expect(e.ceiling).toBeCloseTo(3 * (1 - on.brokerage.defaultMarginPct), 9);
    b.orders = [];
    const f = held();
    w.t = f.hold!.until;
    holdsAtEnd(w);
    expect(f.brokerId).toBeNull();
    // A passed load can't be declined, and with no order it is posted at the default margin.
    const g = held();
    g.hold!.declinable = false;
    expect(applyAction(w, b.id, { type: "decline_tender", loadId: g.id })).toEqual({ ok: false, reason: "a load your carrier passed you can't be declined" });
    w.t = g.hold!.until;
    holdsAtEnd(w);
    expect(g.brokerId).toBe(b.id);
    expect(g.ceiling).toBeCloseTo(3 * (1 - on.brokerage.defaultMarginPct), 9);
    expect(brokerageLog(w).holds).toMatchObject({ held: 5, postedByHand: 1, declined: 2, postedByOrder: 2, passedPosted: 1 });
  });

  it("closes double brokering to a carrier with a brokerage, as an action and as a standing order", () => {
    const { w, c } = pair(8);
    const lane = net.lanes.find((l) => l.miles > 300 && l.miles < 600)!;
    const load = testLoad(w, lane, { status: "assigned", carrierId: c.id, clearedRate: 2.6 });
    expect(rebrokerLoad(w, c, load, 2.0, true)).toBe("a carrier brokers through its own brokerage");
    expect(applyAction(w, c.id, { type: "rebroker_load", loadId: load.id, rate: 2.0, pay: true })).toEqual({ ok: false, reason: "a carrier brokers through its own brokerage" });
    expect(applyAction(w, c.id, { type: "set_standing_orders", orders: [{ kind: "rebroker", share: 0.1, keepPct: 0.15, pays: true }] })).toEqual({ ok: false, reason: "a carrier brokers through its own brokerage" });
  });

  it("keeps the part of a beta brokerage's bond behind paper open at the launch reset until that paper is paid, then burns what is left", () => {
    const { w, c, b } = pair(10);
    // 30k owed to a stranger carrier at the reset, against the 75k bond: 30k is kept, the rest goes with the reset.
    const s = carrier(w, "Stranger");
    w.receivables.push({ id: w.nextReceivableId++, payer: b.id, payeeId: s.id, amountFd: 30_000, dueDay: 40, holder: s.id });
    expect(launchHold(w, b)).toBeCloseTo(30_000, 6);
    expect(b.launchBond).toMatchObject({ heldFd: 30_000, drawnFd: 0 });
    // While the paper is open nothing more burns.
    releaseLaunchHolds(w);
    expect(b.launchBond).toBeDefined();
    // At due the kept bond pays the carrier in full, before the brokerage's own cash.
    const brokerCash = cash(w, b);
    for (const r of w.receivables) r.dueDay = 0;
    const before = cash(w, s);
    dailyReceivables(w);
    expect(cash(w, s) - before).toBeCloseTo(30_000, 2);
    expect(b.launchBond!.drawnFd).toBeCloseTo(30_000, 2);
    expect(cash(w, b)).toBeCloseTo(brokerCash, 2);
    // Paid: the hold ends, burning only what it kept and didn't use (nothing here), never the rest of the stake.
    const stake = b.stakedFd;
    releaseLaunchHolds(w);
    expect(b.launchBond).toBeUndefined();
    expect(b.stakedFd).toBeCloseTo(stake, 6);
    expect(brokerageLog(w).launchHeldFd).toBeCloseTo(30_000, 6);
    w.ledger.assertBalanced();
  });

  it("runs the bots' pairs in a live world: loads counted once per person, the bond cap held, the ledger balanced", () => {
    const config: EconomyConfig = { ...on, brokerage: { ...on.brokerage, bots: { ...on.brokerage.bots, share: 1 } } };
    const w = createWorld({ cfg: config, net, feeds: neutralFeeds, seed: 9 });
    populate(w, { freeOwnerOperators: 40, fleets: 12, brokers: 4 });
    for (const c of w.companies) if (c.strategy.startsWith("fleet:")) fund(w, c.id, 150_000);
    runDays(w, 40, ruleBotHook);
    const log = brokerageLog(w);
    expect(log.formed.length).toBeGreaterThan(0);
    for (const f of log.formed) {
      const b = w.companies[f.brokerId - 1]!;
      expect(b.partnerId).toBe(f.carrierId);
      expect(b.stakedFd).toBeGreaterThanOrEqual(0);
    }
    w.ledger.assertBalanced();
  });
});
