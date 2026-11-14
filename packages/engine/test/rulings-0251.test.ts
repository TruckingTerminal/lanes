import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { createWorld, homeArrival, hubMiles, resting, stepHour, type Company, type GameEvent, type Truck, type World } from "@lanes/engine";

/**
 * The director's three rulings from the 0.25.0 replays (director-0250-rulings-2026-11-13.md), each behind its switch, off:
 * windows.oneDeadline (on time means by "Deliver by"), labor.homeAtOnce (a driver due home starts the days off as the truck
 * goes idle inside the home radius) and labor.homeNeedsDispatcher (with the dispatcher off, the home rule moves no truck).
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
type Sw = { oneDeadline?: boolean; homeAtOnce?: boolean; homeNeedsDispatcher?: boolean };
const cfgOf = (s: Sw): EconomyConfig => ({
  ...LIVE,
  windows: { ...LIVE.windows, ...(s.oneDeadline !== undefined ? { oneDeadline: s.oneDeadline } : {}) },
  labor: { ...LIVE.labor, ...(s.homeAtOnce !== undefined ? { homeAtOnce: s.homeAtOnce } : {}), ...(s.homeNeedsDispatcher !== undefined ? { homeNeedsDispatcher: s.homeNeedsDispatcher } : {}) },
});
function world(cfg: EconomyConfig, hours = 30): World {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 13 });
  populate(w, { freeOwnerOperators: 20, fleets: 6, brokers: 2 });
  for (let h = 0; h < hours; h++) stepHour(w, ruleBotHook);
  return w;
}
const snapshot = (w: World) => JSON.stringify({ t: w.t, trucks: w.trucks, loads: [...w.loads.values()], staff: w.staff, books: w.companies.map((c) => [c.id, w.ledger.balance(`co:${c.id}`), c.delivered, c.onTime, c.late, c.reputation]) });
/** The company's home-rule order: due home after 21 days out, 5 days off. */
const homeRule = (c: Company) => (c.orders = [...c.orders.filter((o) => o.kind !== "homeTime"), { kind: "homeTime", afterDays: 21, restDays: 5 }]);

describe("the 0.25.1 rulings, all off", () => {
  it("leave a three-day world byte-identical with the keys false and with them absent", () => {
    const absent = world(LIVE, 72);
    const off = world(cfgOf({ oneDeadline: false, homeAtOnce: false, homeNeedsDispatcher: false }), 72);
    expect(snapshot(off)).toBe(snapshot(absent));
  }, 240_000);
});

describe("one deadline (windows.oneDeadline, the director's ruling 1)", () => {
  /** A loaded truck whose load's old due time is already past, delivered: the event, and its carrier's counts before. */
  function deliverPastDue(cfg: EconomyConfig) {
    const w = world(cfg);
    const t = w.trucks.find((x) => x.status === "loaded" && x.loadId !== null && w.loads.get(x.loadId)?.latestDeliveryT !== undefined)!;
    const l = w.loads.get(t.loadId!)!;
    l.dueT = w.t - 60; // the old due time, gone; the "Deliver by" still ahead
    const c = w.companies[t.companyId - 1]!;
    const before = { onTime: c.onTime, late: c.late };
    let ev: Extract<GameEvent, { kind: "delivered" }> | null = null;
    w.listener = (e) => {
      if (e.kind === "delivered" && e.loadId === l.id) ev = e;
    };
    for (let h = 0; h < 24 * 6 && !ev; h++) stepHour(w);
    expect(ev).not.toBeNull();
    expect(w.t).toBeLessThanOrEqual(l.latestDeliveryT! + 60); // delivered inside its window
    return { c, before, ev: ev! as Extract<GameEvent, { kind: "delivered" }>, l };
  }

  it("on: a load inside its \"Deliver by\" is on time, whatever the old due time said", () => {
    const { c, before, ev, l } = deliverPastDue(cfgOf({ oneDeadline: true }));
    expect(ev.onTime).toBe((l.arrivedT ?? Infinity) <= l.latestDeliveryT!);
    expect(c.onTime).toBe(before.onTime + (ev.onTime ? 1 : 0));
    expect(c.late).toBe(before.late + (ev.onTime ? 0 : 1));
    expect(ev.onTime).toBe(true);
  }, 120_000);

  it("on: no early tier, however early it lands (the producer's choice (c)); off, the early tier pays as before", () => {
    for (const on of [true, false]) {
      const w = world(cfgOf({ oneDeadline: on }));
      const t = w.trucks.find((x) => x.status === "loaded" && x.loadId !== null && w.loads.get(x.loadId)?.latestDeliveryT !== undefined)!;
      const l = w.loads.get(t.loadId!)!;
      l.dueT = w.t + 30 * 24 * 60; // the old due time a month out: early by it, whatever the drive
      let miles: number | null = null;
      const k = w.cfg.miles.onTime;
      const real = w.metrics.onDelivery.bind(w.metrics);
      w.metrics.onDelivery = (ww, c, load, gross, costs, onTime) => {
        if (load.id === l.id) miles = onTime;
        real(ww, c, load, gross, costs, onTime);
      };
      for (let h = 0; h < 24 * 6 && miles === null; h++) stepHour(w);
      expect(miles).toBe(on ? k.onTime : k.early);
    }
  }, 240_000);

  it("off: the old due time marks it late, as before", () => {
    const { c, before, ev } = deliverPastDue(cfgOf({ oneDeadline: false }));
    expect(ev.onTime).toBe(false);
    expect(c.late).toBe(before.late + 1);
  }, 120_000);
});

describe("home at once (labor.homeAtOnce, the director's ruling 2)", () => {
  /** A crewed idle truck whose driver is past the home rule's days out, not yet sent home, at `miles` from its home hub. */
  function dueIdle(cfg: EconomyConfig, atHome: boolean) {
    const w = world(cfg);
    const t = w.trucks.find((x) => x.status === "idle" && x.driverId && x.companyId && !x.coDriverId && x.nextLoadId === undefined)!;
    const c = w.companies[t.companyId - 1]!;
    homeRule(c);
    const far = w.net.hubs.findIndex((_, i) => hubMiles(w, i, t.hub) > 600);
    c.homeHub = atHome ? t.hub : far;
    const d = w.staff[t.driverId - 1]!;
    Object.assign(d, { awayDays: 30, wantsHome: false, homeUntilDay: null, drivenMinToday: 0 });
    return { w, t, d };
  }

  it("on: idle inside the radius, the days off start at once; outside it, nothing", () => {
    const home = dueIdle(cfgOf({ homeAtOnce: true }), true);
    homeArrival(home.w, home.t);
    expect(resting(home.w, home.t)).toBe(true);
    expect(home.d.homeUntilDay).not.toBeNull();
    const away = dueIdle(cfgOf({ homeAtOnce: true }), false);
    homeArrival(away.w, away.t);
    expect(away.d.homeUntilDay).toBeNull();
  }, 120_000);

  it("off: they wait for the round, as before", () => {
    const { w, t, d } = dueIdle(cfgOf({ homeAtOnce: false }), true);
    homeArrival(w, t);
    expect(d.homeUntilDay).toBeNull();
  }, 120_000);
});

describe("the home rule moves no truck without the dispatcher (labor.homeNeedsDispatcher, the director's ruling 3)", () => {
  /** A company with the dispatcher off (only the home rule), its truck idle 600+ mi from home with its driver past due. */
  function dispatcherOff(cfg: EconomyConfig, sentHome = false): { w: World; t: Truck } {
    const w = world(cfg);
    const t = w.trucks.find((x) => x.status === "idle" && x.driverId && x.companyId && x.nextLoadId === undefined)!;
    const c = w.companies[t.companyId - 1]!;
    c.orders = [];
    homeRule(c);
    c.firstHandBidDay = 0; // past the first bid by hand
    c.homeHub = w.net.hubs.findIndex((_, i) => hubMiles(w, i, t.hub) > 600);
    for (const id of [t.driverId, t.coDriverId]) if (id) Object.assign(w.staff[id - 1]!, { awayDays: 30, wantsHome: sentHome, homeUntilDay: null });
    t.idleRounds = 99;
    for (let h = 0; h < 24; h++) stepHour(w);
    return { w, t };
  }

  it("on: no run home; the truck stands where it is", () => {
    const { w, t } = dispatcherOff(cfgOf({ homeNeedsDispatcher: true }));
    expect(t.status).toBe("idle");
    expect(t.targetHub).not.toBe(w.companies[t.companyId - 1]!.homeHub);
  }, 120_000);

  it("on: a Send home the player gave still runs it home", () => {
    const { w, t } = dispatcherOff(cfgOf({ homeNeedsDispatcher: true }), true);
    expect(t.targetHub).toBe(w.companies[t.companyId - 1]!.homeHub);
  }, 120_000);

  it("off: the home rule runs it home empty, as before (QA's 1,167 miles)", () => {
    const { w, t } = dispatcherOff(cfgOf({ homeNeedsDispatcher: false }));
    expect(t.targetHub).toBe(w.companies[t.companyId - 1]!.homeHub);
    expect(["repositioning", "idle"]).toContain(t.status);
  }, 120_000);
});
