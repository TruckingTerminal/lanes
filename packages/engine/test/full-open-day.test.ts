import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { aroundTheClock, createWorld, dockRule, fullOpenDay, isRoundBoundary, openWindow, stepHour, transitMinutes, windowHoursOf, type Load, type World } from "@lanes/engine";

/**
 * The director's ruling 21 (windows.fullOpenDay; QA's 0.25.5 replay, item 4): a pickup window always holds the pickup
 * dock's first full open day, and "Deliver by" counts from that close. Xenia → Philadelphia, ready Fri 18:00 at a dock
 * open Mon–Fri 07:00–19:00, picks up by Mon 19:00.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const D = LIVE.time.gameMinutesPerDay;
const ON: EconomyConfig = { ...LIVE, windows: { ...LIVE.windows, fullOpenDay: true } };
const at = (day: number, hour: number) => day * D + hour * 60; // day 0 is a Monday (time.weekdayOfDay0)

/** A world's posted loads, one of each kind the test needs: a first-come van load at a dock with hours, a reefer (appointment). */
function loads(cfg: EconomyConfig): { w: World; van: Load; reefer: Load } {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 18 });
  populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
  const open = [...w.loads.values()].filter((l) => l.status === "open" && l.hot === 0 && l.readyT !== undefined);
  const van = open.find((l) => dockRule(w, l) === "fcfs" && !aroundTheClock(w, l.originPlace))!;
  const reefer = open.find((l) => dockRule(w, l) === "appointment")!;
  expect(van && reefer).toBeTruthy();
  return { w, van: { ...van }, reefer: { ...reefer } };
}
const win = (l: Load) => ({ readyT: l.readyT, latestPickupT: l.latestPickupT, latestDeliveryT: l.latestDeliveryT, appointmentT: l.appointmentT });
/** The load's window opened at `t`, ready then (lead 0), on a copy. */
function windowAt(w: World, l: Load, t: number): Load {
  const was = w.t;
  w.t = t;
  const x = { ...l };
  openWindow(w, x, 0);
  w.t = was;
  return x;
}

describe("the dock's first full open day (windows.fullOpenDay, the director's ruling 21)", () => {
  it("is off by default and in the live levers", () => {
    expect(LIVE.windows.fullOpenDay).toBe(false);
  });

  it("ready Fri 18:00 at a weekday dock: picks up by Mon 19:00, and Deliver by counts from there; off, Sun 18:00", () => {
    const { w, van } = loads(ON);
    const legal = transitMinutes(w.cfg, van.routeHours, w.cfg.hos.drivingHoursPerDay);
    const windowMin = windowHoursOf(w.cfg, van.commodity) * 60;
    const x = windowAt(w, van, at(4, 18));
    expect(x.readyT).toBe(at(4, 18));
    expect(fullOpenDay(w, x, x.readyT!)).toEqual({ open: at(7, 7), close: at(7, 19) });
    expect(x.latestPickupT).toBe(at(7, 19));
    expect(x.latestDeliveryT).toBeCloseTo(at(7, 19) + legal + windowMin, 6);
    expect(x.appointmentT).toBeLessThanOrEqual(x.latestDeliveryT!);
    expect(x.appointmentT).toBeGreaterThanOrEqual(at(7, 7)); // counted from Monday's opening, not Friday's ready time
    const off = loads(LIVE);
    const y = windowAt(off.w, off.van, at(4, 18));
    expect(y.latestPickupT).toBe(at(4, 18) + LIVE.windows.pickupHours.firstCome * 60); // Sun 18:00
    expect(y.latestDeliveryT).toBeCloseTo(y.latestPickupT! + legal + windowMin, 6);
  });

  it("a window that already holds a full open day doesn't change; nor does an appointment dock's", () => {
    const { w, van, reefer } = loads(ON);
    const off = loads(LIVE);
    // Ready Wed 08:00: Thursday's 07:00–19:00 sits inside the 48 hours.
    expect(win(windowAt(w, van, at(2, 8)))).toEqual(win(windowAt(off.w, off.van, at(2, 8))));
    // Ready Fri 06:59: Friday's own hours are whole after it.
    expect(windowAt(w, van, at(4, 6.5)).latestPickupT).toBe(windowAt(off.w, off.van, at(4, 6.5)).latestPickupT);
    // An appointment dock keeps no hours here: unchanged, Friday evening or not.
    expect(fullOpenDay(w, reefer, at(4, 18))).toBeNull();
    expect(win(windowAt(w, reefer, at(4, 18)))).toEqual(win(windowAt(off.w, off.reefer, at(4, 18))));
  });

  it("the red team's 0.25.6 hole: ready Friday with a loading's hours left, the close moves but every deadline counts from the ready time", () => {
    const { w, van } = loads(ON);
    const off = loads(LIVE);
    for (const hot of [0, 1.5]) {
      for (const at8 of [at(4, 8), at(4, 7 + 5 / 60), at(4, 17)]) {
        const on = windowAt(w, { ...van, hot }, at8);
        const was = windowAt(off.w, { ...off.van, hot }, at8);
        expect(on.latestPickupT).toBe(at(7, 19)); // the letter of the ruling: the director's call
        expect(on.latestDeliveryT).toBeCloseTo(was.latestDeliveryT!, 6); // no weekend bought
        expect(on.appointmentT).toBeCloseTo(was.appointmentT, 6);
      }
    }
    // A release a minute either side of the opening buys nothing: 06:59 (no move at all) and 07:05 differ by their 6 minutes.
    const early = windowAt(w, van, at(4, 6 + 59 / 60));
    const late = windowAt(w, van, at(4, 7 + 5 / 60));
    expect(late.latestDeliveryT! - early.latestDeliveryT!).toBeCloseTo(5, 6); // 07:00 (nextOpen) to 07:05
    // 17:01 leaves under the 120-minute loading before 19:00: from Monday, as the director's 18:00.
    expect(windowAt(w, van, at(4, 17 + 1 / 60)).latestDeliveryT! - at(7, 19)).toBeCloseTo(windowAt(w, van, at(4, 18)).latestDeliveryT! - at(7, 19), 6);
  });

  it("the director's pending call, fullOpenDayKeepsClose: on, a ready day that can load keeps its close too; a shut one still moves", () => {
    const KEEP: EconomyConfig = { ...ON, windows: { ...ON.windows, fullOpenDayKeepsClose: true } };
    expect(LIVE.windows.fullOpenDayKeepsClose).toBe(false);
    const { w, van } = loads(KEEP);
    const off = loads(LIVE);
    expect(win(windowAt(w, van, at(4, 8)))).toEqual(win(windowAt(off.w, off.van, at(4, 8)))); // Friday loads: as with the rule off
    expect(windowAt(w, van, at(4, 18)).latestPickupT).toBe(at(7, 19)); // the director's Fri 18:00: Monday, as before
  });

  it("a hot load: the close moves the same way, and its deadline counts from Monday's opening", () => {
    const { w, van } = loads(ON);
    const off = loads(LIVE);
    const hot = { ...van, hot: 1.5 };
    const on = windowAt(w, hot, at(4, 18));
    const was = windowAt(off.w, { ...off.van, hot: 1.5 }, at(4, 18));
    expect(on.latestPickupT).toBe(at(7, 19));
    // The hot rule's deadline, counted from the opening instead of the ready time: the same span, moved by the difference.
    expect(on.latestDeliveryT! - at(7, 7)).toBeCloseTo(was.latestDeliveryT! - at(4, 18), 6);
  });
});
