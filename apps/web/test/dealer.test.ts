import "./seed.js";
import { describe, expect, it } from "vitest";
import { companyAccount, financedCashNeed, listTruck } from "@lanes/engine";
import { buyPlan, cheapestNewRig, firstTruckRoute } from "../src/finance.js";
import { stepDo, walkSteps } from "../src/walkthrough.js";
import { GAME_CONFIG } from "../src/game.js";
import { boardRows } from "../src/board.js";
import { TestGame } from "../src/game.js";

describe("the Dealer's refusals", () => {
  it("leaves the lease deposit where it was when a purchase is refused (QA's Dealer replay)", async () => {
    const g = await TestGame.create();
    const c = g.join("Deposit Freight", "oo", "LAX")!;
    const npc = g.w.trucksByCompany.get(c.id)![0]!;
    // The lease holds a deposit, and the truck is out on a load.
    npc.depositFd = 15_000;
    npc.depositDueFd = 15_000;
    const row = boardRows(g.w, c, npc, { dest: "any", maxDh: 300, query: "" }).find((r) => !r.block);
    expect(g.act({ type: "book_load", truckId: npc.id, loadId: row!.l.id }).ok).toBe(true);
    expect(npc.status).not.toBe("idle");
    // Another carrier's owned truck, listed cheaper than cash plus the deposit.
    const seller = g.w.companies.find((x) => x.id !== c.id && x.role === "carrier" && (g.w.trucksByCompany.get(x.id) ?? []).some((t) => t.lease === "owned" && t.status === "idle"))!;
    const truck = g.w.trucksByCompany.get(seller.id)!.find((t) => t.lease === "owned" && t.status === "idle")!;
    const cash = g.w.ledger.balance(companyAccount(c.id));
    const listing = listTruck(g.w, seller.id, truck, Math.max(100, cash + 5_000), 100, 100);
    expect(typeof listing).not.toBe("string");
    const id = (listing as { id: number }).id;
    for (const finance of [false, true]) {
      const r = g.act({ type: "buy_listing", listingId: id, finance });
      expect(r.ok).toBe(false);
      expect(g.w.ledger.balance(companyAccount(c.id))).toBeCloseTo(cash, 6);
      expect(npc.depositFd).toBe(15_000);
    }
  }, 60_000);

  it("puts the cash out of pocket on the loan sheet at the engine's need less the deposit it releases", async () => {
    const g = await TestGame.create();
    const c = g.join("Sheet Freight", "oo", "LAX")!;
    const npc = g.w.trucksByCompany.get(c.id)![0]!;
    npc.depositFd = 12_000;
    const p = buyPlan(g.w, c, 80_000, true);
    expect(p.deposit).toBe(12_000);
    expect(p.loan!.cashNeed).toBeCloseTo(financedCashNeed(g.w, c, 80_000), 6);
    expect(p.loanNowFd).toBeCloseTo(Math.max(0, p.loan!.cashNeed - 12_000), 6);
    expect(p.have).toBeCloseTo(g.w.ledger.balance(companyAccount(c.id)) + 12_000, 6);
  }, 60_000);

  it("has step 9 read the Dealer's own figures, counting only routes the company can take now (QA's step-9 replay)", async () => {
    const g = await TestGame.create();
    const c = g.join("Gap Freight", "oo", "LAX")!;
    const own = walkSteps(GAME_CONFIG).find((s) => s.id === "own")!;
    const npc = g.w.trucksByCompany.get(c.id)![0]!;
    g.w.usedLot.stock = 0;
    for (const l of g.w.listings) if (l.status === "open") l.status = "withdrawn" as typeof l.status;
    // A listing the company could pay for, but the leased truck is out on a load: it doesn't count.
    const seller = g.w.companies.find((x) => x.id !== c.id && x.role === "carrier" && (g.w.trucksByCompany.get(x.id) ?? []).some((t) => t.lease === "owned" && t.status === "idle"))!;
    const truck = g.w.trucksByCompany.get(seller.id)!.find((t) => t.lease === "owned" && t.status === "idle")!;
    const listing = listTruck(g.w, seller.id, truck, 500, 100, 100);
    expect(typeof listing).not.toBe("string");
    const row = boardRows(g.w, c, npc, { dest: "any", maxDh: 300, query: "" }).find((r) => !r.block)!;
    expect(g.act({ type: "book_load", truckId: npc.id, loadId: row.l.id }).ok).toBe(true);
    let r = firstTruckRoute(g.w, c);
    expect(r.route === "listing").toBe(false);
    const rig = cheapestNewRig(g.w, c);
    if (rig) {
      const plan = buyPlan(g.w, c, rig.price, true);
      expect(r.need).toBeCloseTo(plan.loanNowFd!, 6);
      expect(r.have).toBeCloseTo(plan.have - plan.deposit, 6);
      expect(stepDo(own, g.w, c)).toContain(Math.round(r.need).toLocaleString("en-US"));
    } else expect(r.route).toBe("none");
    expect(stepDo(own, g.w, c)).not.toBe(own.do);
    // The factory sold out: no new route, and the line says so.
    for (const k of Object.keys(g.w.supply.tractor) as (keyof typeof g.w.supply.tractor)[]) g.w.supply.tractor[k] = 0;
    expect(firstTruckRoute(g.w, c).route).toBe("none");
    // The truck back and idle: the listing it can buy now becomes the step's line.
    npc.status = "idle";
    r = firstTruckRoute(g.w, c);
    expect(r.route).toBe("listing");
    expect(stepDo(own, g.w, c)).toContain("500");
  }, 60_000);
});
