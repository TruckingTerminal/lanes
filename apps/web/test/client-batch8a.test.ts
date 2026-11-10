import "./seed.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addTruck, companyAccount, detachTruck, type Company, type Load, type World } from "@lanes/engine";
import { bidRange, clampToCeiling, overCeiling, rateShown, suggestBid } from "../src/board.js";
import { DISPATCHER } from "../src/copy.js";
import { PENDING } from "../src/copy-pending.js";
import { dealerUsed, firstTruckLine } from "../src/figures.js";
import { GAME_CONFIG, PLAYER_DISPATCHER_ORDERS, TestGame } from "../src/game.js";
import { idleWhy, letDispatcherBid } from "../src/logic.js";
import { nextAction } from "../src/nextstep.js";
import { nextWeeklyCheckDay } from "../src/figures.js";
import { panelsMoved } from "../src/panelclock.js";
import { S } from "../src/state.js";
import { numberTrucks, truckNumber } from "../src/trucknos.js";
import { answerShown } from "../src/ui/WhatNow.js";
import { walkProgress, walkSteps } from "../src/walkthrough.js";

/** Client batch 8a (the producer's client list of 2026-11-10, studio side notes producer-client-list-2026-11-10.md). */

const today = (w: World) => Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
async function starter(cashFd = 0): Promise<{ g: TestGame; w: World; c: Company }> {
  const g = await TestGame.create();
  const c = g.join("Batch Eight Freight", "oo", "LAX")!;
  if (cashFd) g.w.ledger.post(g.w.t, "faucet:starting_grant", companyAccount(c.id), cashFd, "test");
  return { g, w: g.w, c };
}

afterEach(() => {
  S.game = null;
  vi.unstubAllGlobals();
});

describe("client batch 8a: the small items", () => {
  it("item 4: a bid more than a cent over the shown ceiling is refused, and no rate shows over the shown ceiling", () => {
    const l = { ceiling: 4.6731 } as Load;
    expect(overCeiling(l, 4.68)).toBe(false); // within a cent: held to the ceiling
    expect(clampToCeiling(l, 4.68)).toBe(4.67);
    expect(overCeiling(l, 4.69)).toBe(true); // refused in words, nothing placed
    expect(rateShown(l, 4.6799)).toBe("4.67"); // "Book now 4.68" beside "Ceiling 4.67" never shows
    expect(rateShown(l, 4.1)).toBe("4.10");
  });

  it("item 3: What now?'s answer follows the day while it's the same answer", () => {
    const asked = { rule: 7, kind: "ordered", days: 5 } as const;
    const now = { rule: 7, kind: "ordered", days: 4 } as const;
    expect(answerShown(asked, now)).toEqual(now);
    expect(answerShown(asked, { rule: 7, kind: "gap", gapFd: 10 })).toBeNull();
  });

  it("item 61: the bid's floor is break-even itself, to the cent", () => {
    const l = { ceiling: 3 } as Load;
    expect(bidRange(null as never, l, 2.2131)).toEqual([2.22, 3]);
    expect(bidRange(null as never, l, 2.21)).toEqual([2.21, 3]);
  });

  it("item 66: the panels redraw once each time the world's minute moves", () => {
    expect(panelsMoved(60)).toBe(true);
    expect(panelsMoved(60)).toBe(false);
    expect(panelsMoved(120)).toBe(true);
  });
});

describe("client batch 8a: on a world", () => {
  it("items 1 and 19: a truck's number is given once and never changes when another truck leaves", async () => {
    const g = await TestGame.create();
    const c = g.join("Numbered Freight", "fleet", "DAL")!;
    const w = g.w;
    numberTrucks(w);
    const [one, two] = w.trucksByCompany.get(c.id)!;
    expect([truckNumber(w, one!), truckNumber(w, two!)]).toEqual([1, 2]);
    // The lender takes Truck 1 (as purchaseLoans.ts seize does): Truck 2 keeps its number, which it had before.
    detachTruck(w, one!);
    one!.status = "retired";
    numberTrucks(w);
    expect(truckNumber(w, two!)).toBe(2);
    expect(truckNumber(w, one!)).toBe(1);
    // A truck that comes later gets the next number, never a used one.
    const three = addTruck(w, c, "owned", "workhorse", "van", false);
    numberTrucks(w);
    expect(truckNumber(w, three)).toBe(3);
  }, 120_000);

  it("item 57: one verdict for the cheapest sound truck in the company's freight that the Dealer shows", async () => {
    const { w, c } = await starter();
    const f = firstTruckLine(w, c)!;
    // Whatever it prices is on the page: the used list's, the lot's or a new rig's row.
    const shown = new Set([...dealerUsed(w, c).map(({ l }) => `used-${l.id}`), "lot-van", "lot-reefer", "lot-flatbed", ...["workhorse", "highwayPro", "flagship"].flatMap((t) => ["van", "reefer", "flatbed"].map((e) => `new-${t}-${e}`))]);
    if (f.open !== null) expect(shown.has(f.open)).toBe(true);
    // A starter with its starting cash: not yet, with the cash it takes; the figures sit under Why, not beside the verdict.
    if (!f.met && f.open !== null) {
      expect(f.verdict).toMatch(/^Not yet: buy at /);
      expect(f.figure).toMatch(/^To a sound first truck: /);
      expect(f.why.length).toBeGreaterThan(0);
    }
    // With the cash for anything: buy or order it now.
    w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 5_000_000, "test");
    const rich = firstTruckLine(w, c)!;
    if (rich.open !== null) expect(rich.verdict === PENDING.soundBuy || rich.verdict.startsWith("Order it now · ready ")).toBe(true);
    // Nothing sound on the page: the one line, and no truck to open.
    const k = w.cfg.guide as { soundCondition: number };
    const was = k.soundCondition;
    k.soundCondition = 1.01;
    try {
      const none = firstTruckLine(w, c)!;
      expect(none.verdict).toBe(PENDING.soundNone("dry van"));
      expect(none.open).toBeNull();
    } finally {
      k.soundCondition = was;
    }
  }, 120_000);

  it("item 58: the dispatcher's step follows the first hand-booked load, and steps wait until they can be done", async () => {
    const { w, c } = await starter();
    const steps = walkSteps(GAME_CONFIG);
    expect(steps.map((s) => s.id).slice(0, 4)).toEqual(["welcome", "board", "orders", "haul"]);
    expect(steps.find((s) => s.id === "orders")!.title).toBe("Set your dispatcher before you go");
    // Before a hand booking the dispatcher waits, so its step can't be done yet.
    expect(walkProgress(GAME_CONFIG, w, c).step?.id).toBe("board");
    // The first hand booking: the dispatcher (on from the join) has its step that day, done the day after or once off.
    c.firstHandBidDay = today(w);
    expect(walkProgress(GAME_CONFIG, w, c).step?.id).toBe("orders");
    // Never the condition bar on a lessor-maintained truck, never a second driver with one truck.
    expect(steps.find((s) => s.id === "maintenance")!.can!(w, c)).toBe(false);
    expect(steps.find((s) => s.id === "driver")!.can!(w, c)).toBe(false);
    // A shut page holds its step, and the next one that can is current.
    expect(walkProgress(GAME_CONFIG, w, c, [], (tab) => tab !== "fleet").step?.id).not.toBe("orders");
  }, 120_000);

  it("item 59: the debt line names the nearest clock, and a lost bid's follow-up expires at the next round", async () => {
    const { w, c } = await starter();
    const truck = w.trucksByCompany.get(c.id)![0]!;
    // A purchase loan a payment from default: tier 1, the lender's day named.
    w.purchaseLoans.push({ id: 999, borrowerId: c.id, orderId: 0, truckId: truck.id, originalFd: 52_000, principalFd: 40_000, weeklyRate: 0.003, termWeeks: 104, stakeFd: 0, missed: 1, status: "active" });
    const a = nextAction(GAME_CONFIG, w, c);
    expect(a).toMatchObject({ rule: 1, kind: "loanDefault", truckId: truck.id, day: nextWeeklyCheckDay(w), missed: 1, of: w.cfg.equipmentFinance.purchase.missedToDefault });
    w.purchaseLoans.pop();
    // A lost bid from an earlier round says nothing now.
    const lost = { loadId: -1, truckId: truck.id, profitAtWinningFd: 0, round: w.round - 1 };
    expect(nextAction(GAME_CONFIG, w, c, lost)).not.toMatchObject({ kind: "lost" });
    // A tender is a load to book (tier 5): an idle truck that could earn (tier 2) comes first.
    const load = [...w.loads.values()].find((l) => l.status === "open")!;
    load.tenderedTo = c.id;
    load.tenderUntil = w.t + 600;
    const now = nextAction(GAME_CONFIG, w, c);
    expect(now.rule).toBeLessThanOrEqual(5);
    if (now.kind !== "idle" && now.kind !== "stranded") expect(now).toMatchObject({ rule: 5, kind: "tender" });
  }, 120_000);

  it("item 61: no default bid without the lane's own clears", async () => {
    const { w } = await starter();
    const l = [...w.loads.values()].find((x) => x.status === "open")!;
    // A fresh world has no lane clears yet: no default, so What now? recommends Book, never "Bid on…".
    w.clears = { lane: {}, hub: w.clears?.hub ?? {} } as typeof w.clears;
    expect(suggestBid(w, l, 0)).toBeNull();
  }, 120_000);
});

describe("client batch 8a item 29: the carrier's trucks read the carrier, with the brokerage in view", () => {
  it("explains and fixes a carrier truck's idle from the carrier's orders, not the brokerage's", async () => {
    const k = GAME_CONFIG.brokerage as { enabled: boolean };
    const was = k.enabled;
    k.enabled = true;
    vi.stubGlobal("window", { setTimeout: () => 0 });
    try {
      const g = await TestGame.create();
      const c = g.join("Red River Lines", "fleet", "DAL")!;
      if (g.w.ladder) g.w.ladder.brokerage = today(g.w);
      g.w.ledger.post(g.w.t, "faucet:test", companyAccount(c.id), 120_000, "test");
      const capital = g.w.cfg.token.staking.roles.broker + g.w.cfg.permits.brokerLicenseRenewalFd + 5_000;
      expect(g.act({ type: "form_brokerage", name: "Red River Logistics", capitalFd: capital }, "carrier")).toEqual({ ok: true });
      c.firstHandBidDay = today(g.w);
      expect(g.act({ type: "set_standing_orders", orders: [...PLAYER_DISPATCHER_ORDERS] }, "carrier").ok).toBe(true);
      S.game = g;
      g.inView = "brokerage";
      const t = g.w.trucksByCompany.get(c.id)![0]!;
      // The carrier's dispatcher is on: the brokerage's orders (no bid) don't make it "off".
      expect(idleWhy(t).why).not.toBe(DISPATCHER.offIdle);
      // With the carrier's dispatcher off, "Let the dispatcher bid" from the brokerage's view sets the carrier's orders.
      expect(g.act({ type: "set_standing_orders", orders: [] }, "carrier").ok).toBe(true);
      expect(idleWhy(t).why).toBe(DISPATCHER.offIdle);
      const brokerOrders = JSON.stringify(g.brokerage!.orders);
      letDispatcherBid();
      expect(c.orders.some((o) => o.kind === "bid")).toBe(true);
      expect(JSON.stringify(g.brokerage!.orders)).toBe(brokerOrders);
    } finally {
      k.enabled = was;
    }
  }, 120_000);
});
