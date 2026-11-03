import { describe, expect, it } from "vitest";
import { economyConfig as cfg, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { addTruck, clearsNear, createWorld, cycleLimitMin, drivingMinutesLeft, formCompany, invalidOrders, marketMood, noteClear, rollover, type World } from "@lanes/engine";

// Stage 2 of economy-player34.md: R11's board keys, R1's bid anchor and R12's weekly clock, each off at today's value.
const net = buildNetwork(hubs, cfg);
const world = (c: EconomyConfig): World => createWorld({ cfg: c, net, feeds: neutralFeeds, seed: 5 });
const H = 60;

describe("R12: the 70-hour clock and the 34-hour restart", () => {
  const r12: EconomyConfig = { ...cfg, hos: { ...cfg.hos, cycleHours: 70, restartHours: 34 } };
  function truckAt(c: EconomyConfig, hos: "legal" | "always" = "legal") {
    const w = world(c);
    const co = formCompany(w, { name: "Clock", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
    co.policy.hos = hos;
    const t = addTruck(w, co, "owned", "workhorse", "van");
    t.shiftStartT = w.t;
    t.shiftDrivenMin = 0;
    return { w, t };
  }

  it("off today: no clock", () => {
    const { w, t } = truckAt(cfg);
    t.cycleMin = 69.5 * H;
    expect(drivingMinutesLeft(w, t, w.t)).toBe(cfg.hos.drivingHoursPerDay * H);
  });

  it("on: a legal log stops at 70 hours, and 34 hours off gives the week back", () => {
    const { w, t } = truckAt(r12);
    expect(cycleLimitMin(w, t)).toBe(70 * H);
    t.cycleMin = 69.5 * H;
    t.cycleLastT = w.t;
    expect(drivingMinutesLeft(w, t, w.t)).toBeCloseTo(30, 6);
    expect(drivingMinutesLeft(w, t, w.t + 33 * H)).toBeLessThanOrEqual(30);
    expect(drivingMinutesLeft(w, t, w.t + 34 * H)).toBe(r12.hos.drivingHoursPerDay * H);
    expect(t.cycleMin).toBe(0);
  });

  it("on falsified logs the company drives through the clock", () => {
    const { w, t } = truckAt(r12, "always");
    t.cycleMin = 69.5 * H;
    t.cycleLastT = w.t;
    expect(drivingMinutesLeft(w, t, w.t)).toBe((r12.hos.drivingHoursPerDay + r12.safety.hos.overHours) * H);
  });
});

describe("R11: book-now walks to the ceiling as a load waits", () => {
  function load(c: EconomyConfig) {
    const w = world(c);
    for (let i = 0; i < 6 && w.loads.size === 0; i++) w.t += H; // nothing posted before the first round: make one by hand below
    const l = { bookNow: 100, ceiling: 200, shipperRate: 200, brokerId: null, roundsUnfilled: 0, appointmentT: 0 } as unknown as Parameters<typeof rollover>[1];
    return { w, l };
  }
  it("today: the 12% step", () => {
    const { w, l } = load(cfg);
    l.roundsUnfilled = 1;
    rollover(w, l);
    expect(l.bookNow).toBeCloseTo(112, 6);
  });
  it("on (4 rounds): from where it opened to the ceiling, a quarter of the way a round", () => {
    const c: EconomyConfig = { ...cfg, bookNow: { ...cfg.bookNow, towardCeilingRounds: 4 } };
    const { w, l } = load(c);
    l.roundsUnfilled = 2;
    rollover(w, l); // the ceiling rose 10% to 220 first
    expect(l.ceiling).toBeCloseTo(220, 6);
    expect(l.bookNow).toBeCloseTo(100 + (220 - 100) * 0.5, 6);
    l.roundsUnfilled = 4;
    rollover(w, l);
    expect(l.bookNow).toBeCloseTo(l.ceiling, 6);
  });
});

describe("R1's bid anchor and the dial's start", () => {
  it("accepts a bid order anchored to what loads usually clear near", () => {
    expect(invalidOrders(cfg, [{ kind: "bid", maxDeadheadMi: 150, price: { mode: "clearsNear", pct: 0 } }])).toBeNull();
    expect(invalidOrders(cfg, [{ kind: "bid", maxDeadheadMi: 150, price: { mode: "clearsNear", pct: -0.1 } }])).toBeNull();
  });
  it("opens the balance dial where rateStabilizer.start says, with the circular economy and the dial on", () => {
    const c: EconomyConfig = { ...cfg, token: { ...cfg.token, circular: { ...cfg.token.circular, enabled: true, rateStabilizer: { ...cfg.token.circular.rateStabilizer, enabled: true, start: 0.6 } } } };
    expect(world(c).stab.rateMult).toBe(0.6);
    expect(world(cfg).stab.rateMult).toBe(1);
  });
});

describe("R11: the market line and what loads really clear at", () => {
  it("reads booming when the last week clears 15% over the four weeks before", () => {
    const w = world(cfg);
    const d = (rate: number) => ({ ...(w.metrics.days[0] ?? {}), avgClearedRate: rate, cleared: 100 }) as never;
    for (let i = 0; i < 28; i++) w.metrics.days.push(d(4));
    for (let i = 0; i < 7; i++) w.metrics.days.push(d(4.8));
    expect(marketMood(w).state).toBe("booming");
    for (let i = 0; i < 35; i++) w.metrics.days.push(d(4));
    expect(marketMood(w).state).toBe("steady");
  });
  it("usually clears near: the lane's trailing clears once it has five, never above the ceiling", () => {
    const w = world(cfg);
    const load = { laneId: 7, equipment: "van", origin: 3, refRate: 3, hot: 0, ceiling: 6, contractId: 0 } as unknown as Parameters<typeof clearsNear>[1];
    expect(clearsNear(w, load)).toBe(3); // no clears yet: the reference
    for (let i = 0; i < 5; i++) noteClear(w, load, 5);
    expect(clearsNear(w, load)).toBeCloseTo(5, 9);
    for (let i = 0; i < 5; i++) noteClear(w, load, 9);
    expect(clearsNear(w, load)).toBe(6); // capped at the ceiling
    noteClear(w, { ...load, contractId: 4 } as never, 100); // a contract tender doesn't count
    expect(w.clears!.lane["7:van"]![1]).toBe(10);
  });
});
