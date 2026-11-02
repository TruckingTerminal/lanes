import { describe, expect, it } from "vitest";
import { companyAccount, financedCashNeed, listTruck } from "@lanes/engine";
import { buyPlan, firstTruckRoute } from "../src/finance.js";
import { stepDo, walkSteps } from "../src/walkthrough.js";
import { GAME_CONFIG } from "../src/game.js";
import { bestSource } from "@lanes/engine";
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

  it("has step 9 read the gap from the Dealer's own figures when the used lot can't serve it", async () => {
    const g = await TestGame.create();
    const c = g.join("Gap Freight", "oo", "LAX")!;
    const own = walkSteps(GAME_CONFIG).find((s) => s.id === "own")!;
    g.w.usedLot.stock = 0;
    for (const l of g.w.listings) if (l.status === "open") l.status = "withdrawn" as typeof l.status;
    const r = firstTruckRoute(g.w, c);
    expect(r.used).toBe(false);
    const plan = buyPlan(g.w, c, bestSource(g.w, c.id, "rig", "workhorse", "van").price, true);
    expect(r.need).toBeCloseTo(plan.loan!.cashNeed, 6);
    expect(r.have).toBeCloseTo(plan.have, 6);
    const line = stepDo(own, g.w, c);
    expect(line).not.toBe(own.do);
    expect(line).toContain(Math.round(r.need).toLocaleString("en-US"));
    // With a rig on the lot, the step keeps its own line.
    g.w.usedLot.stock = 3;
    expect(stepDo(own, g.w, c)).toBe(own.do);
  }, 60_000);
});
