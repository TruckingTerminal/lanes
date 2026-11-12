import { describe, expect, it } from "vitest";
import { withLiveLevers } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { createWorld, seizedNotice, soldNotice, truckValue, weeklyPurchaseLoans, type GameEvent } from "@lanes/engine";

/** Client batch 8a item 19: the lender's taking a truck is said to its borrower on the day, once, with the figures. */
describe("the lender's notice when it takes a truck (purchaseLoans.ts seize)", () => {
  it("fires once per truck taken, with what the loan owed, what the truck covered and what came back", () => {
    const LIVE = withLiveLevers();
    const w = createWorld({ cfg: LIVE, net: buildNetwork(hubs, LIVE), feeds: neutralFeeds, seed: 11 });
    populate(w, { freeOwnerOperators: 4, fleets: 2, brokers: 0 });
    const notices: Extract<GameEvent, { kind: "notice" }>[] = [];
    w.listener = (e) => {
      if (e.kind === "notice" && e.topic === "fleet") notices.push(e);
    };
    // Two of a fleet's idle trucks on defaulted loans: one owing more than the truck is worth, one less.
    const c = w.companies.find((x) => x.role === "carrier" && (w.trucksByCompany.get(x.id) ?? []).filter((t) => t.status === "idle").length >= 2)!;
    const [a, b] = (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status === "idle");
    const va = truckValue(w, a!);
    const vb = truckValue(w, b!);
    const loan = (id: number, truckId: number, owed: number) => ({ id, borrowerId: c.id, orderId: 0, truckId, originalFd: owed, principalFd: owed, weeklyRate: 0, termWeeks: 52, stakeFd: 0, missed: 2, status: "defaulted" as const });
    w.purchaseLoans.push(loan(901, a!.id, va + 5_000), loan(902, b!.id, vb - 4_000));
    weeklyPurchaseLoans(w);
    expect(notices.map((n) => n.truckId)).toEqual([a!.id, b!.id]);
    expect(notices[0]!.companyId).toBe(c.id);
    expect(notices[0]!.text).toBe(seizedNotice(a!.id, 2, va + 5_000, va, 0));
    expect(notices[1]!.text).toBe(seizedNotice(b!.id, 2, vb - 4_000, vb - 4_000, 4_000));
    expect(notices[1]!.text).toContain("worth 4,000 FD more than the loan");
    // Taken once: the next week says nothing more.
    weeklyPurchaseLoans(w);
    expect(notices).toHaveLength(2);
    w.ledger.assertBalanced();
  });
});

/** Client batch 8b item 8: a listing that sells is said to its seller, with the price, the fee and what the loan took. */
describe("the seller's notice when a listing sells (market.ts buyListing)", () => {
  it("says the price and the fee, and, with a loan repaid from it, what it took and what was kept", () => {
    expect(soldNotice(7, 40_000, 2_000, 38_000, 38_000)).toBe("Truck 7 sold on the used market for 40,000 FD; after the 2,000 FD market fee, 38,000 FD came to you.");
    expect(soldNotice(7, 40_000, 2_000, 38_000, 12_000)).toContain("26,000 FD of it repaid the truck's loan, with the loan's stake back to you: you kept 12,000 FD.");
    expect(soldNotice(7, 40_000, 2_000, 38_000, 41_000)).toContain("its 3,000 FD stake came back to you too");
  });
});
