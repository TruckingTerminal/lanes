import "./seed.js";
import { describe, expect, it } from "vitest";
import { hubs, PLACE_OF_HUB } from "@lanes/data";
import { askOf, companyAccount, condition, payFloor, poolOf } from "@lanes/engine";
import { PENDING } from "../src/copy-pending.js";
import { firstTruckLine } from "../src/figures.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { checkAttention, checkIdleAlerts } from "../src/logic.js";
import { dropKeyed, feed, pushKeyed, S } from "../src/state.js";
import { stepDo, walkSteps } from "../src/walkthrough.js";

/** Client batch 8e: QA's 8d replay (producer-client-list-2026-11-10.md, section N, items 71 to 77). */
describe("client batch 8e", () => {
  it("item 71: a hub's own town is called by the hub's name", async () => {
    const g = await TestGame.create();
    hubs.forEach((h, i) => expect(g.w.net.places[PLACE_OF_HUB[i]!]!.name).toBe(h.name));
  }, 60_000);

  it("items 72 and 73: the haul step fits a booking; step 3 asks to turn the dispatcher on while it's off", async () => {
    const steps = walkSteps(GAME_CONFIG);
    const text = JSON.stringify(steps.map((s) => [s.say, s.do]));
    expect(text).not.toContain("You won one.");
    expect(text).toContain("It's yours. Now the slow part");
    const g = await TestGame.create();
    const c = g.join("Orders Freight", "oo", "LAX")!;
    const step = steps.find((s) => s.id === "orders")!;
    c.orders = c.orders.filter((o) => o.kind !== "bid");
    expect(stepDo(step, g.w, c)).toBe(PENDING.dispatcherTurnOn);
    c.orders = [...c.orders, { kind: "bid" } as never];
    expect(stepDo(step, g.w, c)).toBe(step.do);
  }, 60_000);

  it("item 75: a listing carries the card only while it can be bought today, and its sale is said for a day", async () => {
    const g = await TestGame.create();
    const c = g.join("Steady Freight", "oo", "LAX")!;
    const w = g.w;
    const own = w.trucksByCompany.get(c.id)![0]!.trailer;
    // Only the new rig is shown: every listing priced out, the lot emptied.
    for (const l of w.listings) if (l.status === "open") l.status = "withdrawn";
    w.usedLot.stock = 0;
    const plain = firstTruckLine(w, c)!;
    expect(plain.pick?.route).toBe("new");
    // A sound used truck of the company's freight, listed at half the new rig's price, more than the company has.
    const t = w.trucks.find((x) => x.companyId !== c.id && x.lease === "owned" && x.trailer === own && x.status === "idle")!;
    Object.assign(t, { odometer: 1_000, milesSinceRebuild: 1_000, rebuilds: 0 });
    expect(condition(w.cfg, t)).toBeGreaterThanOrEqual(w.cfg.guide.soundCondition - 1e-9);
    const day = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
    const ask = plain.pick!.price / 2;
    const listing = { id: w.listings.length + 1, truckId: t.id, trailerId: 0, sellerId: t.companyId, loanId: null, formerOwnerId: t.companyId, listedDay: day, askFd: ask, floorFd: ask * 0.6, stepFd: ask * 0.05, status: "open" as const };
    w.listings.push(listing);
    // Out of reach today: the count stays on the new rig, as it was before the listing came.
    const short = firstTruckLine(w, c)!;
    expect(short.met).toBe(false);
    expect(short.pick?.route).toBe("new");
    expect(short.gapFd).toBeCloseTo(plain.gapFd, 6);
    // Within reach: "Buy it now" on the listing, said to be a listing.
    w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 5_000_000, "test");
    const now = firstTruckLine(w, c)!;
    expect([now.met, now.open]).toEqual([true, `used-${listing.id}`]);
    expect(now.why[0]).toBe(PENDING.soundHeldListing);
    // Sold to someone else: the card says so that day and the next, then forgets it.
    listing.status = "sold" as never;
    const gone = firstTruckLine(w, c)!;
    expect(gone.pick?.route).toBe("new");
    expect(gone.why[0]).toBe(PENDING.soundListingGone);
    w.t += w.cfg.time.gameMinutesPerDay;
    expect(firstTruckLine(w, c)!.why[0]).toBe(PENDING.soundListingGone);
    w.t += w.cfg.time.gameMinutesPerDay;
    expect(firstTruckLine(w, c)!.why).not.toContain(PENDING.soundListingGone);
  }, 120_000);

  it("item 77: a truck's idle line goes once it's back on the road", async () => {
    const g = await TestGame.create();
    const c = g.join("Idle Freight", "oo", "LAX")!;
    const t = g.w.trucksByCompany.get(c.id)![0]!;
    S.game = g as never;
    try {
      const has = () => feed(g as never).ticker.some((x) => x.key === `idle:${t.id}`);
      t.status = "idle";
      t.idleSinceT = g.w.t - 30 * 60;
      checkIdleAlerts();
      expect(has()).toBe(true);
      t.status = "repositioning";
      checkIdleAlerts();
      expect(has()).toBe(false);
      // dropKeyed itself: one keyed line out, the rest kept.
      pushKeyed(g as never, "k:1", "one");
      pushKeyed(g as never, "k:2", "two");
      dropKeyed(g as never, "k:1");
      expect(feed(g as never).ticker.map((x) => x.key).filter((k) => k?.startsWith("k:"))).toEqual(["k:2"]);
    } finally {
      S.game = null;
    }
  }, 60_000);

  it("item 77: the no-driver line leaves the day's feed once the driver is hired", async () => {
    const g = await TestGame.create();
    const c = g.join("Hiring Freight", "fleet", "LAX")!;
    const w = g.w;
    const t = w.trucksByCompany.get(c.id)!.find((x) => !x.driverId)!;
    c.delivered = 1; // past the first load: Staff is open, so the empty seat is an item
    S.game = g as never;
    // The item's toast sets a browser timer; node has no window.
    const g0 = globalThis as { window?: unknown };
    const hadWindow = "window" in g0;
    if (!hadWindow) g0.window = globalThis;
    try {
      const has = () => feed(g as never).ticker.some((x) => x.key === `need:driver:${t.id}`);
      checkAttention();
      expect(has()).toBe(true);
      const s = poolOf(w, "driver")[0]!;
      expect(g.act({ type: "offer_staff", staffId: s.id, pay: Math.max(askOf(w, c, s), payFloor(w, s)), truckId: t.id }).ok).toBe(true);
      checkAttention();
      expect(has()).toBe(false);
    } finally {
      S.game = null;
      S.toast = null;
      if (!hadWindow) delete g0.window;
    }
  }, 120_000);
});
