import "./seed.js";
import { describe, expect, it } from "vitest";
import { askOf, payFloor, poolOf, type StandingOrder } from "@lanes/engine";
import { lineOf } from "../src/books.js";
import { formOf, ordersFrom } from "../src/dispatcherform.js";
import { firstTruckLine } from "../src/figures.js";
import { DEFAULT_ORDERS, PLAYER_DISPATCHER_ORDERS, TestGame } from "../src/game.js";
import { intelRows } from "../src/intel.js";

/** Client batch 8d: QA's 8b replay (qa-8b-2026-11-13.md), its two fails and the smaller findings. */
const byKind = (os: readonly StandingOrder[]) => [...os].sort((a, b) => a.kind.localeCompare(b.kind));

describe("client batch 8d", () => {
  it("fail 2: the dispatcher's Save with nothing changed writes the orders it was shown", () => {
    const home: StandingOrder = { kind: "homeTime", afterDays: 21, restDays: 5 };
    const sets: StandingOrder[][] = [
      [...PLAYER_DISPATCHER_ORDERS, home], // the switch's first defaults: contracts taken as tenders, no offers
      DEFAULT_ORDERS, // offers taken, reposition and Book now on
      [...PLAYER_DISPATCHER_ORDERS.filter((o) => o.kind !== "contracts"), { kind: "contracts", acceptOffers: true, spotAbovePct: 0.1, maxDeadheadMi: 150 }, home],
    ];
    for (const shown of sets) expect(byKind(ordersFrom(formOf(shown), true, shown))).toEqual(byKind(shown));
    // The box reads the offers: a contracts order without them shows unticked, and saving keeps it without them.
    const f = formOf(sets[0]!);
    expect(f.ct).toBe(false);
    expect(ordersFrom(f, true, sets[0]!).find((o) => o.kind === "contracts")).toMatchObject({ acceptOffers: false });
    // Ticking it is the one way to take offers.
    expect(ordersFrom({ ...f, ct: true }, true, sets[0]!).find((o) => o.kind === "contracts")).toMatchObject({ acceptOffers: true });
  });

  it("fail 1: a hire for a parked truck goes in once the truck is back on the road, as the page now sends it", async () => {
    const g = await TestGame.create();
    const c = g.join("Parked Freight", "fleet", "LAX")!;
    const w = g.w;
    const truck = w.trucksByCompany.get(c.id)!.find((t) => !t.driverId)!;
    expect(g.act({ type: "park_truck", truckId: truck.id }).ok).toBe(true);
    const s = poolOf(w, "driver")[0]!;
    const offer = { type: "offer_staff" as const, staffId: s.id, pay: Math.max(askOf(w, c, s), payFloor(w, s)), truckId: truck.id };
    expect(g.act(offer).ok).toBe(false); // QA's "That truck isn't on the road"
    expect(g.act({ type: "unpark_truck", truckId: truck.id }).ok).toBe(true);
    expect(g.act(offer).ok).toBe(true);
    expect([truck.driverId, truck.status]).toEqual([s.id, "idle"]);
  }, 120_000);

  it("item 4: the lender's surplus on a seized truck is the truck's value back, not a loan", async () => {
    const g = await TestGame.create();
    const c = g.join("Seized Freight", "oo", "LAX")!;
    expect(lineOf(g.w, c, "faucet:npc_finance", "seized:3", true)).toBe("sold");
    expect(lineOf(g.w, c, "faucet:npc_finance", "loan:3", true)).toBe("loansIn");
  }, 60_000);

  it("item 5: no 'Not yet' count from under four weeks of history", async () => {
    const g = await TestGame.create();
    const c = g.join("Young Freight", "oo", "LAX")!;
    const w = g.w;
    const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
    c.delivered = 3;
    c.operating.revenueFd = 3 * 1_210;
    c.operating.costFd = 3 * 1_000;
    c.createdDay = today - 7; // a week's books
    const young = firstTruckLine(w, c)!;
    if (young.met || young.open === null) return;
    expect(young.verdict).toMatch(/^Not yet: buy once you have /);
    c.createdDay = today - 30; // past four weeks: the count comes
    expect(firstTruckLine(w, c)!.verdict).toMatch(/^Not yet: a sound truck is about \d+ loads? away/);
  }, 60_000);

  it("item 9: Intel counts every truck the company has, a parked one too", async () => {
    const g = await TestGame.create();
    const c = g.join("Two Truck Freight", "fleet", "LAX")!;
    const t = g.w.trucksByCompany.get(c.id)!.find((x) => x.status === "idle")!;
    expect(g.act({ type: "park_truck", truckId: t.id }).ok).toBe(true);
    expect(intelRows(g.w).find((r) => r.c.id === c.id)!.trucks).toBe(2);
  }, 60_000);
});
