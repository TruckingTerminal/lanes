import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { aroundTheClock, createWorld, dockRule, fullOpenDay, isRoundBoundary, lastOpenEnd, loadableBetween, openWindow, stepHour, transitMinutes, windowHoursOf, type Load, type World } from "@lanes/engine";

/**
 * The director's ruling 21 as amended by §24 (windows.fullOpenDay; director-sprint-2026-11-15.md §21 and §24, the red team's
 * 0.25.6 pass): one test, a loading's hours (dwell.loadMinutes[1], 2 h) open inside ready + 24/48 h. Yes: nothing moves to
 * another day, and the close is the end of the last open hours inside the window. No: the window is the dock's next full
 * open day. "Deliver by" counts from the close; a hot load's deadline and the appointment from the ready time.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const D = LIVE.time.gameMinutesPerDay;
const ON: EconomyConfig = { ...LIVE, windows: { ...LIVE.windows, fullOpenDay: true } };
const at = (day: number, hour: number) => day * D + Math.round(hour * 60); // day 0 is a Monday (time.weekdayOfDay0)

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
const win = (l: Load) => ({ readyT: l.readyT, latestPickupT: l.latestPickupT, latestDeliveryT: l.latestDeliveryT, appointmentT: l.appointmentT, windowShift: l.windowShift });
/** The load's window opened at `t`, ready then (lead 0), on a copy. */
function windowAt(w: World, l: Load, t: number): Load {
  const was = w.t;
  w.t = t;
  const x = { ...l };
  openWindow(w, x, 0);
  w.t = was;
  return x;
}

describe("ruling 21 as amended by §24 (windows.fullOpenDay)", () => {
  it("is off by default and in the live levers", () => {
    expect(LIVE.windows.fullOpenDay).toBe(false);
  });

  it("the test and the clip, at a Mon–Fri 07:00–19:00 dock", () => {
    const h = LIVE.docks.hours.fcfs;
    const w = createWorld({ cfg: ON, net, feeds: neutralFeeds, seed: 1 });
    expect(loadableBetween(w, h, at(4, 8), at(6, 8))).toBe(true); // Friday's 11 hours
    expect(loadableBetween(w, h, at(4, 17), at(6, 17))).toBe(true); // exactly the 2 h
    expect(loadableBetween(w, h, at(4, 17 + 1 / 60), at(6, 17 + 1 / 60))).toBe(false); // a minute short, then the weekend
    expect(loadableBetween(w, h, at(3, 18), at(5, 18))).toBe(true); // Thursday's last hour, but Friday's day is inside
    expect(lastOpenEnd(w, h, at(6, 8))).toBe(at(4, 19)); // Sun 08:00: Friday's close
    expect(lastOpenEnd(w, h, at(2, 8))).toBe(at(2, 8)); // open then: itself
    expect(lastOpenEnd(w, h, at(2, 7))).toBe(at(2, 7)); // the opening minute is open
  });

  it("yes, ready Fri 08:00: picks up by Fri 19:00, Deliver by from there; the hot deadline and the appointment as with the rule off", () => {
    const { w, van } = loads(ON);
    const off = loads(LIVE);
    const legal = transitMinutes(w.cfg, van.routeHours, w.cfg.hos.drivingHoursPerDay);
    const windowMin = windowHoursOf(w.cfg, van.commodity) * 60;
    const x = windowAt(w, van, at(4, 8));
    expect(x).toMatchObject({ readyT: at(4, 8), latestPickupT: at(4, 19), windowShift: "clip" });
    expect(x.latestDeliveryT).toBeCloseTo(at(4, 19) + legal + windowMin, 6);
    expect(x.appointmentT).toBeCloseTo(Math.min(at(4, 8) + windowMin + legal, x.latestDeliveryT!), 6);
    const hot = windowAt(w, { ...van, hot: 1.5 }, at(4, 8));
    expect(hot.latestPickupT).toBe(at(4, 19));
    expect(hot.latestDeliveryT).toBeCloseTo(windowAt(off.w, { ...off.van, hot: 1.5 }, at(4, 8)).latestDeliveryT!, 6); // from the ready time
    // Off: Sun 08:00, as before.
    const y = windowAt(off.w, off.van, at(4, 8));
    expect(y.latestPickupT).toBe(at(4, 8) + LIVE.windows.pickupHours.firstCome * 60);
    expect(y.windowShift).toBeUndefined();
  });

  it("yes, ready Thu 18:00: Friday's hours are inside, so nothing moves to another day; the close is Fri 19:00", () => {
    const { w, van } = loads(ON);
    expect(windowAt(w, van, at(3, 18))).toMatchObject({ readyT: at(3, 18), latestPickupT: at(4, 19), windowShift: "clip" });
  });

  it("no, ready Fri 18:00: the window is Monday's full open day, ready at its opening; a hot load counts from Mon 07:00", () => {
    const { w, van } = loads(ON);
    const legal = transitMinutes(w.cfg, van.routeHours, w.cfg.hos.drivingHoursPerDay);
    const windowMin = windowHoursOf(w.cfg, van.commodity) * 60;
    expect(fullOpenDay(w, van, at(4, 18))).toEqual({ open: at(7, 7), close: at(7, 19) });
    const x = windowAt(w, van, at(4, 18));
    expect(x).toMatchObject({ readyT: at(7, 7), latestPickupT: at(7, 19), windowShift: "move" });
    expect(x.latestDeliveryT).toBeCloseTo(at(7, 19) + legal + windowMin, 6);
    expect(x.appointmentT).toBeGreaterThanOrEqual(at(7, 7));
    const off = loads(LIVE);
    const hot = windowAt(w, { ...van, hot: 1.5 }, at(4, 18));
    const was = windowAt(off.w, { ...off.van, hot: 1.5 }, at(4, 18));
    expect(hot.latestDeliveryT! - at(7, 7)).toBeCloseTo(was.latestDeliveryT! - at(4, 18), 6);
    // 17:01 is the same case, a minute short of a loading.
    expect(win(windowAt(w, van, at(4, 17 + 1 / 60)))).toEqual(win(x));
  });

  it("no minute worth choosing: 06:59 and 07:05 close and deliver alike; mid-week and appointment docks don't change", () => {
    const { w, van, reefer } = loads(ON);
    const off = loads(LIVE);
    const early = windowAt(w, van, at(4, 6 + 59 / 60));
    const late = windowAt(w, van, at(4, 7 + 5 / 60));
    expect(early.latestPickupT).toBe(at(4, 19));
    expect(late.latestPickupT).toBe(at(4, 19));
    expect(late.latestDeliveryT).toBeCloseTo(early.latestDeliveryT!, 6);
    // Ready Wed 08:00: Fri 08:00 is open, so nothing changes.
    const { windowShift: _a, ...mid } = win(windowAt(w, van, at(2, 8)));
    const { windowShift: _b, ...midOff } = win(windowAt(off.w, off.van, at(2, 8)));
    expect(mid).toEqual(midOff);
    expect(windowAt(w, van, at(2, 8)).windowShift).toBeUndefined();
    // An appointment dock keeps no hours here: unchanged, Friday evening or not.
    expect(fullOpenDay(w, reefer, at(4, 18))).toBeNull();
    expect(win(windowAt(w, reefer, at(4, 18)))).toEqual(win(windowAt(off.w, off.reefer, at(4, 18))));
  });
});
