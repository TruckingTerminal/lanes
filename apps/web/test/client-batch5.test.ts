import "./seed.js";
import { describe, expect, it } from "vitest";
import { lotPrice, npcDealerMult } from "@lanes/engine";
import { cheapestNewRig } from "../src/finance.js";
import { firstTruckLine, gapToTruck } from "../src/figures.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { marketPages } from "../src/guide/market.js";

/** Client batch 5 (2026-11-09): QA's replay of client batch 4 on 68083bb. */

describe("client batch 5", () => {
  it("prices the cheapest truck the hold covers when it covers several, and says so", async () => {
    const g = await TestGame.create();
    const c = g.join("Batch Five Freight", "oo", "LAX")!;
    const w = g.w;
    const truck = w.trucksByCompany.get(c.id)![0]!;
    if (!(w.cfg.freeEntry.leases.byValue.enabled && w.cfg.freeEntry.leases.byValue.depositToPurchase)) return;
    // A hold larger than any truck's cash at signing: every route needs 0 FD today, so the tie goes to the lowest price.
    truck.depositFd = 10_000_000;
    const gap = gapToTruck(w, c);
    expect(gap.needNowFd).toBe(0);
    const prices = [
      ...(w.cfg.usedMarket.npcLot.enabled && w.cfg.assets.enabled && w.usedLot.stock > 0 ? [lotPrice(w, "workhorse", "van") * npcDealerMult(w)] : []),
      ...w.listings.filter((l) => l.status === "open" && l.truckId > 0 && l.sellerId !== c.id && l.formerOwnerId !== c.id).map((l) => l.askFd),
      ...(cheapestNewRig(w, c) ? [cheapestNewRig(w, c)!.price] : []),
    ];
    expect(gap.priceFd).toBeCloseTo(Math.min(...prices), 6);
    // Client batch 8a item 57: the card prices the cheapest sound truck the page shows, named under Why.
    const f = firstTruckLine(w, c)!;
    if (f.open !== null) expect(f.why.some((x) => x.startsWith("The truck: "))).toBe(true); // after the lot's rig, if any
  }, 120_000);

  it("the guide's Book-now page says no bid over the ceiling wins where the poster refuses one, and eases as the floor does", () => {
    const page = marketPages(GAME_CONFIG).find((p) => p.id === "booknow")!;
    expect(GAME_CONFIG.board.refuseOverCeiling).toBe(true);
    expect(page.html).not.toContain("the cheapest above");
    expect(page.html).toContain("refuses one over it");
    const k = GAME_CONFIG.bookNow.desperation;
    expect(page.html).toContain(`from ${k.awayAfterDays} to ${k.awayAfterDays + k.awayDays}`);
  });
});
