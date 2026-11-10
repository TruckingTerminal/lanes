import "./seed.js";
import { describe, expect, it } from "vitest";
import { companyAccount, type Company, type Load, type World } from "@lanes/engine";
import { bidCeiling, bidRange, clampToCeiling } from "../src/board.js";
import { firstTruckLine, gapToTruck, listingWhy, weeklyGross } from "../src/figures.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { nextAction } from "../src/nextstep.js";
import { walkProgress } from "../src/walkthrough.js";
import { milestones } from "../src/milestones.js";

/** Client batch 7 (2026-11-10): QA's replay of client batches 6 and 6b on 9f46d1f (qa-client6-2026-11-10.md). */

const today = (w: World) => Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
/** A starter with the cash for any truck, the used lot priced (every listing asks ten times its price). */
async function starter(): Promise<{ g: TestGame; w: World; c: Company } | null> {
  const g = await TestGame.create();
  const c = g.join("Batch Seven Freight", "oo", "LAX")!;
  const w = g.w;
  if (!(w.cfg.usedMarket.npcLot.enabled && w.cfg.assets.enabled && w.usedLot.stock > 0)) return null;
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 5_000_000, "test");
  return { g, w, c };
}

describe("client batch 7", () => {
  it("shows the ceiling a bid can be placed at, and holds a typed bid a cent over it to it", () => {
    const l = { ceiling: 4.0573 } as Load;
    expect(bidCeiling(l)).toBe(4.05);
    expect(clampToCeiling(l, 4.06)).toBe(4.05);
    expect(clampToCeiling(l, 4.07)).toBe(4.07); // more than a cent over: the engine refuses it, as it should
    expect(clampToCeiling(l, 3.9)).toBe(3.9);
    expect(bidRange(null as never, l, 2)[1]).toBe(4.05);
    expect(bidCeiling({ ceiling: 4.06 } as Load)).toBe(4.06); // an exact ceiling stays itself
  });

  it("counts step 9 met once a truck is ordered to replace the lease, and What now? says the wait, not a step", async () => {
    const s = await starter();
    if (!s) return;
    const { g, w, c } = s;
    for (const l of w.listings) if (l.status === "open") l.askFd *= 10;
    expect(g.act({ type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: true, used: true }).ok).toBe(true);
    const own = walkProgress(GAME_CONFIG, w, c);
    expect(own.step?.id).not.toBe("own");
    const a = nextAction(GAME_CONFIG, w, c);
    expect(a.rule).not.toBe(4);
    // The log says the order as an order, on its day; "Your own truck" waits for the hand-over.
    const keys = milestones(w, c).map((m) => m.key);
    expect(keys).toContain("truckOrdered");
    expect(keys).not.toContain("ownTruck");
    expect(milestones(w, c).find((m) => m.key === "truckOrdered")!.day).toBe(today(w));
    // A day before the truck is ready, the count says so.
    const o = w.orders.find((x) => x.companyId === c.id)!;
    o.dueDay = today(w) + 1;
    expect(firstTruckLine(w, c)!.figure).toMatch(/, in 1 day; /);
  }, 120_000);

  it("says a listing can be bought when the leased truck is next idle, never 'You can buy today' while it runs", async () => {
    const s = await starter();
    if (!s) return;
    const { w, c } = s;
    const listing = w.listings.find((l) => l.status === "open" && l.truckId > 0);
    if (!listing) return;
    // Every listing but one priced out, and the lot emptied: the listing is the cheapest truck.
    for (const l of w.listings) if (l.status === "open" && l !== listing) l.askFd *= 100;
    w.usedLot.stock = 0;
    expect(gapToTruck(w, c).truck!.route).toBe("listing");
    expect(firstTruckLine(w, c)!.figure).toBe("You can buy today");
    const t = w.trucksByCompany.get(c.id)![0]!;
    t.status = "repositioning";
    const f = firstTruckLine(w, c)!;
    expect(f.figure).toMatch(new RegExp(`^You can buy once truck ${t.id} is idle; it's on a run to `));
    expect(listingWhy(w, c, "NPC-leased truck is on a trip")).toMatch(/^A truck changes hands only while your leased one stands idle, and truck \d+ is on a run to /);
    expect(listingWhy(w, c, "insufficient FD")).toBe("insufficient FD");
    // Client batch 7b: in the shop the leased truck isn't idle, and isn't on a run either, so no run is claimed.
    t.status = "repair";
    expect(firstTruckLine(w, c)!.figure).toBe(`You can buy once truck ${t.id} is idle`);
    expect(listingWhy(w, c, "NPC-leased truck is on a trip")).toBe(`A truck changes hands only while your leased one stands idle, and truck ${t.id} isn't idle now.`);
  }, 120_000);

  it("prices the wait on the basis that covers more weeks, and says which", async () => {
    const s = await starter();
    if (!s) return;
    const { w, c } = s;
    expect(weeklyGross(w, c).basis).toBe("start");
    c.createdDay = today(w) - 120;
    c.operating.revenueFd = 120_000;
    c.lastMonth = { revenueFd: 1_000, spentFd: 0 } as never;
    const g = weeklyGross(w, c);
    expect(g.basis).toBe("start");
    expect(g.fd).toBeCloseTo(120_000 / (120 / 7), 6);
  }, 120_000);
});
