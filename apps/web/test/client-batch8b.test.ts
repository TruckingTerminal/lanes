import "./seed.js";
import { describe, expect, it } from "vitest";
import { askOf, hubMiles, ownerDrawFd, payFloor, placeLegMiles, placeMiles, placeOfHub, poolOf, truckValue, type ExpediteWaitParts, type GameEvent } from "@lanes/engine";
import { chipPair, typedRate } from "../src/board.js";
import { bestLoad } from "../src/figures.js";
import { monthReport, shownReport, type MonthBooks } from "../src/books.js";
import { PENDING } from "../src/copy-pending.js";
import { expediteLines, waitSentence } from "../src/expediteui.js";
import { calendarDate, monthName, shortDate } from "../src/format.js";
import { GAME_CONFIG, PLAYER_DISPATCHER_ORDERS, TestGame } from "../src/game.js";
import { monthKept, ranked, type IntelRow } from "../src/intel.js";
import { blankName } from "../src/ui/ChooseHub.js";
import { fitName, FUNDING_MAX_CHARS, FundingField } from "../src/ui/panels/Brokerage.js";
import { sell as sellLines } from "../src/confirmspecs.js";
import { freeDriverFor, nextAction } from "../src/nextstep.js";
import { emptyRun, payLine } from "../src/rolling.js";
import { walkSteps } from "../src/walkthrough.js";

/** Client batch 8b (the producer's client list of 2026-11-10, the items not in 8a, and the early-delivery fee's screens). */

describe("client batch 8b", () => {
  it("item 9: a name of only spaces is refused; a typed name or none (the default) goes", () => {
    expect(blankName("   ")).toBe(true);
    expect(blankName("")).toBe(true);
    expect(blankName(null)).toBe(false);
    expect(blankName(" Ana Freight ")).toBe(false);
  });

  it("item 10: the bid field tells a rate from something that isn't one", () => {
    expect(typedRate("")).toEqual({ kind: "empty" });
    expect(typedRate("2,45")).toEqual({ kind: "rate", rate: 2.45 });
    expect(typedRate("abc")).toEqual({ kind: "bad" });
    expect(typedRate("-5")).toEqual({ kind: "bad" });
    expect(typedRate("0")).toEqual({ kind: "bad" });
    expect(typedRate("99999")).toEqual({ kind: "rate", rate: 99999 }); // over the ceiling: the ceiling's refusal says so
  });

  it("item 14: every date shown is one the calendar has", () => {
    const seen = new Set<string>();
    for (let d = 0; d < 365; d++) {
      const { month, date } = calendarDate(d);
      expect(date).toBeGreaterThanOrEqual(1);
      expect(date).toBeLessThanOrEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month]!);
      seen.add(shortDate(d));
    }
    expect(seen.size).toBe(365);
    expect(seen.has("Feb 29")).toBe(false);
    expect(seen.has("Feb 30")).toBe(false);
    expect([shortDate(0), shortDate(58), shortDate(59), shortDate(364), shortDate(365)]).toEqual(["Jan 1", "Feb 28", "Mar 1", "Dec 31", "Jan 1"]);
    expect(monthName(59)).toBe("March");
  });

  it("item 15: the month's report shows what's owed in its two parts, still adding up to the cash", () => {
    const m: MonthBooks = {
      // February: January's 35,552 in invoices paid in (the loads flow), 17,000 invoiced and still owed, nothing spent.
      fromDay: 30, closedDay: 60, cashStart: 10_000, cashEnd: 45_552, owedStart: 35_552, owedEnd: 17_000, owedEarlierEnd: 0, goodsOwedStart: 0, goodsOwedEnd: 0,
      payStart: 0, payEnd: 0, flows: { loads: 35_552 }, loadedMi: 0, emptyMi: 0, drawStart: 0, drawEnd: 0, loads: 0, onTime: 0,
    };
    const r = shownReport(monthReport(m));
    expect(r.owedNew).toBe(17_000); // February's invoices still owed
    expect(r.owedEarlierPaid).toBe(35_552); // January's, paid in February
    expect(r.owedNew! - r.owedEarlierPaid!).toBe(r.owedChange);
    expect(r.keptFd).toBe(17_000); // loads delivered: the cash in less what was owed before, plus what's owed now
    expect(r.cashStart + r.keptFd - r.owedChange).toBe(r.cashEnd);
    // A month kept before the split shows the net, as before.
    const { owedEarlierEnd: _, ...old } = m;
    expect(shownReport(monthReport(old as MonthBooks)).owedNew).toBeUndefined();
  });

  it("item 33: brokers rank by what they kept last month, and before any close nobody is ranked by nothing", () => {
    const row = (id: number, kept: number | null) => ({ c: { id, lastMonth: kept === null ? undefined : { revenueFd: kept + 1_000, spentFd: 1_000, loads: 0, onTime: 0, closedDay: 30 } }, miles: 0, trucks: 0 }) as unknown as IntelRow;
    const order = ranked([row(1, 500), row(2, 9_000), row(3, null)], "month").map((x) => [x.r.c.id, x.rank]);
    expect(order).toEqual([[2, 1], [1, 2], [3, 3]]);
    expect(monthKept(row(2, 9_000).c)).toBe(9_000);
  });

  it("item 34: a prefilled name fits whole words inside the limit", () => {
    expect(fitName("Peachtree Freight Exchange Logistics", 32)).toBe("Peachtree Freight Exchange");
    expect(fitName("Short Name", 32)).toBe("Short Name");
  });

  // Item 52: the lessor's share off the margin (board.ts profitOver). One delivery can't match to the FD: the forecast
  // counts the expected empty run out of the destination (the director's one break-even), and the drive picks up its
  // night stops' detours (businesses.parking.stopInTown). On these five seeds the forecast now lands 0 to 93 FD under the
  // pay (at most 5.4%); before, it ran 18% to 26% over (2,685 against 2,160 on seed 11).
  it("item 52: What now?'s cash now lands within 8% of the delivery's pay on the probe seeds", async () => {
    for (const seed of [11, 12, 13, 14, 15]) {
      const g = await TestGame.create(undefined, undefined, seed);
      const c = g.join("Probe Freight", "oo", "LAX")!;
      const w = g.w;
      const t = w.trucksByCompany.get(c.id)![0]!;
      c.firstHandBidDay = 0;
      const r = bestLoad(w, c, t)!;
      const l = r.l;
      const draw = ownerDrawFd(w, t, l.miles + placeMiles(w, t.place, l.originPlace));
      const cash = chipPair(w, t, r.profitBook, l.bookNow * l.miles, draw).cash; // What now?'s idle reason (WhatNow.tsx)
      let got = null as Extract<GameEvent, { kind: "delivered" }> | null;
      const before = { emptyMi: 0, depositFd: t.depositFd ?? 0 };
      g.onEvent((e) => {
        if (e.kind === "delivered" && e.truckId === t.id) got = e;
      });
      expect(g.act({ type: "book_load", truckId: t.id, loadId: l.id }).ok).toBe(true);
      for (let h = 0; h < 24 * 12 && !got; h++) g.stepHour();
      const e = got as Extract<GameEvent, { kind: "delivered" }> | null;
      expect(e).not.toBeNull();
      const yours = payLine(w, t, l, e!.grossFd, e!.costFd, before).yours;
      expect(Math.abs(cash - yours) / yours).toBeLessThan(0.08);
    }
  }, 300_000);

  it("item 63: turning the dispatcher on sets bidding and its floor, not the further orders", () => {
    expect(PLAYER_DISPATCHER_ORDERS.map((o) => o.kind)).toEqual(["bid", "floor", "contracts"]);
    expect(PLAYER_DISPATCHER_ORDERS.find((o) => o.kind === "contracts")).toMatchObject({ acceptOffers: false });
  });
});

describe("client batch 8b: the early-delivery fee's lines (section D, the director's order)", () => {
  const parts = (p: Partial<ExpediteWaitParts>): ExpediteWaitParts => ({
    readyDay: 40, daysSaved: 28, feeFd: 6_900, paymentsFd: 4_400, lessorFd: 0, addsTruck: true, driver: true, keptCase: "counts", emptyTruckNo: null, keptPerTruckWeekFd: 2_200, keptWeeks: 8, keptFd: 8_800, ...p,
  });
  it("puts the dates and days sooner first, then the fee, paid now and not refunded", async () => {
    expect(expediteLines({ readyDay: 40, daysSaved: 28, feeFd: 6_900, priceFd: 100_000 }, 68)).toEqual([PENDING.expediteDates("Feb 10", "Mar 10", 28), PENDING.expediteFee("6,900")]);
  });

  it("says the payments first, then what the trucks kept if this one does the same, the fee last and the verdict on the freight", async () => {
    const g = await TestGame.create();
    const c = g.join("Fee Freight", "fleet", "DAL")!;
    const s = waitSentence(g.w, c, parts({}));
    expect(s.indexOf("in payments")).toBeLessThan(s.indexOf("kept about"));
    expect(s.indexOf("kept about")).toBeLessThan(s.indexOf("The fee is"));
    expect(s.endsWith(PENDING.waitPays)).toBe(true);
    expect(s).not.toContain("13,200"); // never summed
    // The other three cases: that's all she can count, and why.
    expect(waitSentence(g.w, c, parts({ keptCase: "noTruckSeated", keptFd: 0 }))).toContain(PENDING.waitNoneSeated); // item 65
    expect(waitSentence(g.w, c, parts({ keptCase: "books", keptFd: 0 }))).toContain(PENDING.waitBooks(GAME_CONFIG.assets.expedite.keptMinHistoryWeeks));
    const t = g.w.trucksByCompany.get(c.id)![1]!;
    t.driverId = 0;
    expect(waitSentence(g.w, c, parts({ keptCase: "emptyTruck", keptFd: 0, emptyTruckNo: 2 }))).toContain(PENDING.waitEmptyTruck(2));
  }, 120_000);
});

describe("QA's 0.24.1 replay (qa-0241-8a-2026-11-12.md), folded into 8b", () => {
  it("fail 1: the brokerage's funding field is its own input, with its own length, and takes typing", () => {
    const texts: string[] = [];
    const caps: number[] = [];
    const v = FundingField({ text: "90300", minCap: 76_000, maxCap: 200_000, onText: (t) => texts.push(t), onCapital: (n) => caps.push(n) }) as unknown as {
      type: string;
      key: unknown;
      props: { maxLength: number; onInput?: (e: unknown) => void; oninput?: (e: unknown) => void };
    };
    expect(v.type).toBe("input");
    expect(v.key).toBe("funding");
    expect(v.props.maxLength).toBe(FUNDING_MAX_CHARS);
    // One key at a time, as QA typed: every keystroke is kept; the amount moves only for a number in range.
    // Preact's JSX runtime hands the handler over as `oninput` (lower case) for a DOM element.
    const onInput = v.props.onInput ?? v.props.oninput!;
    for (const value of ["80000", "abc", "80,500", "-50000", "1000"]) onInput({ currentTarget: { value } });
    expect(texts).toEqual(["80000", "abc", "80,500", "-50000", "1000"]);
    expect(caps).toEqual([80_000, 80_500]);
  });

  it("fail 2: the lot's order note and the walkthrough's first-truck step say the rules as they run", () => {
    expect(PENDING.lotOrderNote("Mar 28", true, true, 1)).toContain("handed over when leased truck 1 next stands idle");
    expect(PENDING.lotOrderNote("Mar 28", true, false, 1)).toContain("at the first day's end");
    const own = walkSteps(GAME_CONFIG).find((x) => x.id === "own")!;
    const text = [own.brief, ...own.say, own.do].join(" ");
    expect(text).not.toMatch(/Buy the used one first|like new/);
    const days = GAME_CONFIG.usedMarket.npcLot.deliveryDays;
    if (days !== null) expect(text).toContain(`ready ${days} days after you order it`);
    if (GAME_CONFIG.equipmentFinance.purchase.collateral.enabled) expect(text).toContain("The lender reads the truck");
  });

  it("fail 3: listing takes the driver off and the sheet says so; What now? sees the parked truck; off sale seats him back", async () => {
    const g = await TestGame.create();
    const c = g.join("Sale Freight", "fleet", "LAX")!;
    const w = g.w;
    const truck = w.trucksByCompany.get(c.id)!.find((t) => !t.driverId)!;
    const s = poolOf(w, "driver")[0]!;
    expect(g.act({ type: "offer_staff", staffId: s.id, pay: Math.max(askOf(w, c, s), payFloor(w, s)), truckId: truck.id }).ok).toBe(true);
    expect(truck.driverId).toBe(s.id);
    const value = truckValue(w, truck);
    // Said plainly before listing, right after what the sale is (the producer, 2026-11-12).
    expect(sellLines(w, truck, 2, value).does).toContain(PENDING.sellCrew([s.name], w.cfg.labor.morale.unseatedWeeks));
    expect(g.act({ type: "list_truck", truckId: truck.id, askFd: value, floorFd: value * 0.6, stepFd: value * 0.05 }).ok).toBe(true);
    expect(truck.driverId).toBe(0); // the engine's rule (market.ts listTruck): the crew stays with the company, off the truck
    const listing = w.listings.find((l) => l.truckId === truck.id && l.status === "open")!;
    expect(g.act({ type: "withdraw_listing", listingId: listing.id }).ok).toBe(true);
    expect(truck.status).toBe("parked");
    // The owner's truck parked too, so nothing else stands in front at tier 2.
    w.trucksByCompany.get(c.id)!.find((t) => t.id !== truck.id)!.status = "parked";
    expect(nextAction(GAME_CONFIG, w, c)).toMatchObject({ rule: 2, kind: "driver", truckId: truck.id, parked: true, freeId: s.id });
    // Off sale's seat back, as the page sends it (logic.ts seatBack): the driver in, then the truck on the road.
    // Its own driver first, by the crew the page listed it with; another free one at the hub only when he's gone.
    expect(freeDriverFor(w, c, truck, [s.id])?.id).toBe(s.id);
    expect(freeDriverFor(w, c, truck)?.id).toBe(s.id);
    expect(g.act({ type: "assign_driver", staffId: s.id, truckId: truck.id }).ok).toBe(true);
    expect(g.act({ type: "unpark_truck", truckId: truck.id }).ok).toBe(true);
    expect([truck.driverId, truck.status]).toEqual([s.id, "idle"]);
  }, 120_000);

  it("item 5: an idle truck due home gets the home warning at its idle answer's rank", async () => {
    const g = await TestGame.create();
    const c = g.join("Home Freight", "oo", "LAX")!;
    const w = g.w;
    const t = w.trucksByCompany.get(c.id)![0]!;
    c.orders = [{ kind: "homeTime", afterDays: 21, restDays: 5 }]; // the dispatcher off: no bid order
    const away = w.net.hubs.findIndex((_, i) => i !== c.homeHub && hubMiles(w, c.homeHub, i) > 600);
    t.hub = away;
    t.place = placeOfHub(away);
    w.staff[t.driverId - 1]!.awayDays = 18;
    expect(nextAction(GAME_CONFIG, w, c)).toMatchObject({ rule: 2, kind: "homeDue", truckId: t.id, days: 3 });
  }, 60_000);

  it("item 8: a truck running empty is priced from its point on the leg, as the engine turns it", async () => {
    const g = await TestGame.create();
    const c = g.join("Turn Freight", "oo", "DAL")!;
    const w = g.w;
    const t = w.trucksByCompany.get(c.id)![0]!;
    const start = t.hub;
    const far = w.net.hubs.findIndex((_, i) => i !== start && hubMiles(w, start, i) > 700);
    expect(g.act({ type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[far]!.id }).ok).toBe(true);
    for (let h = 0; h < 6 && t.remainingMi > placeLegMiles(w, t.place, t.targetPlace) - 150; h++) g.stepHour();
    expect(t.status).toBe("repositioning");
    const near = w.net.hubs.findIndex((_, i) => i !== start && i !== far && hubMiles(w, start, i) < 400);
    const priced = emptyRun(w, t, t.hub, near);
    expect(priced.mi).not.toBe(Math.round(placeLegMiles(w, t.place, placeOfHub(near))).toLocaleString("en-US")); // not from the start
    expect(g.act({ type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[near]!.id }).ok).toBe(true);
    expect(Math.round(t.remainingMi).toLocaleString("en-US")).toBe(priced.mi);
  }, 60_000);
});
