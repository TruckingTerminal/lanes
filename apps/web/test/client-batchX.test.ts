import "./seed.js";
import { describe, expect, it } from "vitest";
import { canMake, dayOf, drivingLimitMin, whenLabel, type Load, type World } from "@lanes/engine";
import { blockReason, boardRows } from "../src/board.js";
import { PENDING } from "../src/copy-pending.js";
import { WINDOWS } from "../src/copy-windows.js";
import { grammar } from "../src/format.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { nightStop, restingUntil } from "../src/rolling.js";
import { feed, push, pushKeyed, tickerInView, todaysTicker } from "../src/state.js";
import { agreement, boardable, bookBar, busyNextLine, reachChip, readyAt, releaseCard, whenAt, windowLine } from "../src/windowsui.js";
import { breakdown } from "../src/explain.js";

/** Client batch X: QA's 0.25.0 replay (qa-0250-2026-11-13.md, "Fails and findings"), the client's half. */
const WIN = { ...GAME_CONFIG, windows: { ...GAME_CONFIG.windows, enabled: true } };
const any = { dest: "any", maxDh: 300, query: "" };
const DATED = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) [A-Z][a-z]{2} \d{1,2} \d\d:\d\d$/;
const windowed = (w: World) => [...w.loads.values()].filter((l): l is Load & { latestPickupT: number; latestDeliveryT: number } => l.status === "open" && l.latestPickupT !== undefined && l.latestDeliveryT !== undefined);

async function started(seed = 41, cfg = WIN) {
  const g = await TestGame.create(undefined, undefined, seed, cfg);
  const c = g.join("Window Freight", "oo", "LAX")!;
  return { g, w: g.w, c, truck: g.w.trucksByCompany.get(c.id)![0]! };
}

describe("client batch X: QA's 0.25.0 replay", () => {
  it("fail 1: dates a time 6 or more days off, every time on the sheet, and a past ready time as past", async () => {
    const { w, c, truck } = await started();
    expect(whenAt(w, w.t + 60)).toBe(whenLabel(w, w.t + 60));
    expect(whenAt(w, w.t + 5 * 1440)).toBe(whenLabel(w, w.t + 5 * 1440));
    // Next week's same weekday, and last week's: never a bare weekday.
    expect(whenAt(w, w.t + 6 * 1440)).toMatch(DATED);
    expect(whenAt(w, w.t + 7 * 1440)).toMatch(DATED);
    expect(whenAt(w, w.t + 60, true)).toMatch(DATED);
    expect(whenAt(w, w.t + 7 * 1440)).not.toBe(whenAt(w, w.t));
    expect(readyAt(w, w.t - 60)).toBe(WINDOWS.readySince(whenAt(w, w.t - 60)));
    expect(readyAt(w, w.t + 60)).toBe(whenAt(w, w.t + 60));
    // The sheet: the window's three times dated, and the projection's arrival with its day, the time canMake gives.
    const r = boardRows(w, c, truck, any).find((x) => !x.block && x.reach?.ok && x.l.latestPickupT !== undefined)!;
    const line = windowLine(w, r.l, true)!;
    expect(line.pickupBy).toMatch(DATED);
    expect(line.deliverBy).toMatch(DATED);
    expect(line.ready.replace(/^since /, "")).toMatch(DATED);
    const a = agreement(w, truck, r.l, r.l.bookNow, 1)!;
    const reach = canMake(w, truck, r.l);
    expect(a.lines.at(-1)).toContain(`by ${whenAt(w, reach.pickupT, true)}`);
    expect(a.lines.at(-1)).toContain(`delivers about ${whenAt(w, reach.deliverT, true)}`);
  }, 120_000);

  it("fail 2: Release's confirm card carries the claim in FD, never more than the cash, and the mark", async () => {
    const { g, w, c, truck } = await started();
    const first = boardRows(w, c, truck, any).find((x) => !x.block && x.reach?.ok)!;
    expect(g.act({ type: "book_load", truckId: truck.id, loadId: first.l.id }).ok).toBe(true);
    const next = boardRows(w, c, truck, any).find((x) => !x.block && x.reach?.ok)!;
    expect(g.act({ type: "book_load", truckId: truck.id, loadId: next.l.id }).ok).toBe(true);
    const cash = w.ledger.balance(`co:${c.id}`);
    const card = releaseCard(w, c, next.l, 402.4, 1);
    expect(card).toMatchObject({ verb: "Release", item: WINDOWS.releaseItem(next.l.id), costFd: 402, risk: WINDOWS.releaseRisk, destructive: true });
    expect(card.does).toBe(WINDOWS.releaseDoes(w.net.places[next.l.originPlace]!.name, w.net.places[next.l.destPlace]!.name, 1));
    expect(releaseCard(w, c, next.l, cash + 5_000, 1).costFd).toBe(Math.round(cash));
  }, 120_000);

  it("fail 3: a truck holding its next load says so on every chip and in the picker, and isn't the board's pick", async () => {
    const { w, c, truck } = await started();
    const held = windowed(w)[0]!;
    truck.nextLoadId = held.id; // rule H's hold, as the engine leaves it on an idle truck
    expect(boardable(w, truck)).toBe(false);
    expect(bookBar(w, truck, 1)).toEqual({ line: WINDOWS.twoDeep(1), short: WINDOWS.whyHasNext });
    const rows = boardRows(w, c, truck, any);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.block === WINDOWS.twoDeep(1))).toBe(true);
    // At home on days off: the hold and when the driver is back.
    const d = w.staff[truck.driverId - 1]!;
    d.homeUntilDay = dayOf(w.t, w.cfg) + 2;
    const back = whenAt(w, d.homeUntilDay * w.cfg.time.gameMinutesPerDay);
    expect(bookBar(w, truck, 1)).toEqual({ line: WINDOWS.heldDaysOff(1, d.name, back), short: WINDOWS.whyHeld(back) });
    truck.nextLoadId = undefined;
    d.homeUntilDay = null;
    expect(bookBar(w, truck, 1)).toBeNull();
  }, 120_000);

  it("fail 13: canMake's reason outranks the H or C line on the chip", async () => {
    const { w, c, truck } = await started();
    // A hired driver home for three more days (rule H, on in the live levers): a pickup before then is refused.
    const d = w.staff[truck.driverId - 1]!;
    d.owner = false;
    d.homeUntilDay = dayOf(w.t, w.cfg) + 3;
    const l = windowed(w).find((x) => blockReason(w, c, truck, x) !== null && (x.readyT ?? w.t) < d.homeUntilDay! * 1440)!;
    expect(blockReason(w, c, truck, l)).toContain(d.name);
    expect(blockReason(w, c, truck, l, "Truck 1 reaches X after the pickup.")).toBe("Truck 1 reaches X after the pickup.");
  }, 120_000);

  it("fail 5: with the mid-leg town on and chosen, tonight's line says the rule, never the shoulder outright", async () => {
    const b = GAME_CONFIG.businesses;
    const MID = { ...WIN, businesses: { ...b, enabled: true, parking: { ...b.parking, stopInTown: true, stopInTownMidLeg: true } } };
    const { g, w, c, truck } = await started(41, MID);
    for (const s of w.sites) s.spaces = 0; // no site with room: what's left is a town or the shoulder
    c.nightStop = "town" as typeof c.nightStop;
    const row = boardRows(w, c, truck, any).find((r) => !r.block && r.l.miles > 1200)!;
    expect(g.act({ type: "book_load", truckId: truck.id, loadId: row.l.id }).ok).toBe(true);
    let seen = 0;
    for (let h = 0; h < 24 * 8 && truck.loadId !== null; h++) {
      const stop = nightStop(w, truck, c);
      if (stop) {
        seen++;
        expect(stop).toEqual({ kind: "townNear", maxMi: MID.businesses.parking.stopInTownMaxMi });
        c.nightStop = "shoulder" as typeof c.nightStop;
        expect(nightStop(w, truck, c)).toEqual({ kind: "shoulder" });
        c.nightStop = "town" as typeof c.nightStop;
      }
      g.stepHour();
    }
    expect(seen).toBeGreaterThan(0);
    expect(PENDING.tonightTownNear(30)).toContain("30");
  }, 120_000);

  it("fail 8: no rest while the truck drives on after a night that ended within the hour", async () => {
    const { w, c, truck } = await started();
    const limit = drivingLimitMin(w, truck, c);
    // A night that ended mid-hour: a new duty day opened, the truck drove 30 min, its rest space kept until the next hour.
    const driving = { ...truck, restSite: 1, shiftStartT: w.t - 30, offDutySinceT: w.t, shiftDrivenMin: 30 };
    expect(restingUntil(w, driving, c)).toBeNull();
    // The day's hours spent (a town night or an early stop books them): resting until the reset.
    const spent = { ...truck, restSite: 0, shiftStartT: w.t - 600, offDutySinceT: w.t - 60, shiftDrivenMin: limit };
    expect(restingUntil(w, spent, c)).toBe(w.t - 60 + w.cfg.hos.restHours * 60);
  }, 120_000);

  it("fail 12: feed lines carry their minute for Today, and a released load's Booked line goes", async () => {
    const { g, w, c } = await started();
    push(g, "A line");
    expect(feed(g).ticker[0]).toMatchObject({ text: "A line", t: w.t });
    const l = windowed(w)[0]!;
    pushKeyed(g, `booked:${l.id}`, "Booked · here → there", "good");
    expect(tickerInView(g).some((x) => x.key === `booked:${l.id}`)).toBe(true);
    l.releasedBy = [c.id];
    expect(tickerInView(g).some((x) => x.key === `booked:${l.id}`)).toBe(false);
  }, 120_000);

  it("fail 7: an article before a figure follows how it's said, and a count of one is singular", () => {
    expect(grammar("a 804 FD claim")).toBe("an 804 FD claim");
    expect(grammar("A 8,000 FD bond")).toBe("An 8,000 FD bond");
    expect(grammar("a 11-min break and a 18,000 FD bill")).toBe("an 11-min break and an 18,000 FD bill");
    expect(grammar("a 1,100 FD claim, a 180 FD fee, a 110 mi run")).toBe("a 1,100 FD claim, a 180 FD fee, a 110 mi run");
    expect(grammar("You have 0 days, 1 loads.")).toBe("You have 0 days, 1 load.");
    expect(grammar("11 loads, 21 days, 1 day")).toBe("11 loads, 21 days, 1 day");
    // The copy objects pass their lines through it, the engine's notices through the feed.
    expect(WINDOWS.agreeNoShow("Mon 07:00", "804")).toContain("an 804 FD claim");
    expect(PENDING.atRiskReason("884", "Mon 07:00")).toContain("an 884 FD claim");
  });

  describe("batch X2: QA's re-check (qa-0250-batchX-2026-11-13.md)", () => {
    it("item 6: the reputation sheet's rows reach the figure, with the loads released or not picked up", async () => {
      const { w, c } = await started();
      c.onTime = 6;
      c.delivered = 7;
      c.failed = 1;
      const k = w.cfg.reputation;
      c.reputation = (c.onTime + k.priorLoads * k.start) / (c.delivered + c.failed + k.priorLoads);
      const sheet = breakdown(w, c, "standing.reputation", {})!;
      expect(sheet.rows.find((r) => r.label === WINDOWS.repFailedRow)?.value).toBe("1");
      const n = (label: string) => Number(sheet.rows.find((r) => r.label === label)!.value);
      expect((n("Loads on time") + k.priorLoads * k.start) / (n("Loads delivered") + n(WINDOWS.repFailedRow) + k.priorLoads)).toBeCloseTo(c.reputation, 9);
      expect(sheet.total.value).toBe(`${Math.round(c.reputation * 100)}%`);
    }, 120_000);

    it("item 3: a busy truck holding its next load says which", async () => {
      const { w, truck } = await started();
      const l = windowed(w)[0]!;
      truck.nextLoadId = l.id;
      expect(busyNextLine(w, truck, 1)).toBe(WINDOWS.busyNextBooked(1, w.net.places[l.originPlace]!.name, w.net.places[l.destPlace]!.name, whenAt(w, l.latestPickupT)));
    }, 120_000);

    it("the ticker rolls at midnight as Today does", async () => {
      const { g, w } = await started();
      push(g, "Yesterday's line");
      feed(g).ticker[0]!.t = Math.floor(w.t / 1440) * 1440 - 1;
      push(g, "Today's line");
      expect(todaysTicker(g).map((x) => x.text)).toContain("Today's line");
      expect(todaysTicker(g).map((x) => x.text)).not.toContain("Yesterday's line");
    }, 120_000);

    it("the reach chip's close has its day, dated 6 or more days out", async () => {
      const { w, c, truck } = await started();
      const l = windowed(w)[0]!;
      const chip = reachChip(w, l, { ok: false, why: "pickup", freeT: w.t, freePlace: truck.place, pickupT: l.latestPickupT + 60, deliverT: l.latestDeliveryT }, 1)!;
      expect(chip).toContain(`after the ${whenAt(w, l.latestPickupT)} pickup`);
      expect(whenAt(w, l.latestPickupT)).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) /);
      void c;
    }, 120_000);
  });
});
