import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, COMMODITIES, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { claimOn, companyAccount, createWorld, dailyDrivers, hubMiles, reserveAccount, stepHour, unseatDriver, type Company, type GameEvent, type Load, type World } from "@lanes/engine";

/**
 * Ruleset 0.25.2's switches from the red team's sprint pass, each off by default: claims in full (windows.claimsInFull),
 * a driver off the truck is home only near home (labor.truckLessHomeByHub), spoilage from "Deliver by"
 * (windows.spoilAfterDeadline) and a hot load's premium read at arrival (safety.hotLoads.premiumFromArrival).
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const withWindows = (o: Record<string, unknown>) => ({ ...LIVE, windows: { ...LIVE.windows, ...o } }) as EconomyConfig;
function world(cfg: EconomyConfig = LIVE, hours = 30, seed = 13): World {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed });
  populate(w, { freeOwnerOperators: 20, fleets: 6, brokers: 2 });
  for (let h = 0; h < hours; h++) stepHour(w, ruleBotHook);
  return w;
}
const cash = (w: World, c: Company) => w.ledger.balance(companyAccount(c.id));
/** A sink's running total (the circular ledger credits the reserve, so a sink's balance stays 0; its tag keeps the total). */
const sunk = (w: World, tag: string) => (w.ledger.totals.get(tag) ?? 0) / 100;
/** Moves FD straight between two of a company's own accounts (the test's shortcut for a deposit). */
const move = (w: World, from: string, to: string, fd: number) => fd > 0.005 && w.ledger.post(w.t, from, to, fd, "test:move");
/** A booked load as claimOn reads it: `pay` FD at a 10% share is a claim of pay / 10. */
function booked(c: Company, pay: number, brokerId: number | null = null): Load {
  return { id: 990_001, clearedRate: pay / 100, miles: 100, brokerId, shipperId: null, doubleBroker: undefined, carrierId: c.id, truckId: null, latestDeliveryT: 0 } as unknown as Load;
}

describe("claims in full (windows.claimsInFull)", () => {
  it("off: a claim is held to the cash account, as before", () => {
    const w = world(LIVE, 2);
    const c = w.companies.find((x) => x.role === "carrier")!;
    move(w, companyAccount(c.id), "sink:test", Math.max(0, cash(w, c)));
    expect(claimOn(w, c, booked(c, 10_000), 0.1, "cancel")).toBe(0);
    expect(cash(w, c)).toBeCloseTo(0, 6);
  });

  it("on: the claim posts in full, as any bill, past what the cash account holds", () => {
    const w = world(withWindows({ claimsInFull: true }), 2);
    const c = w.companies.find((x) => x.role === "carrier")!;
    move(w, companyAccount(c.id), "sink:test", Math.max(0, cash(w, c)));
    const sink = sunk(w, "sink:service_failure");
    expect(claimOn(w, c, booked(c, 10_000), 0.1, "cancel")).toBeCloseTo(1000, 6);
    expect(cash(w, c)).toBeCloseTo(-1000, 6);
    expect(sunk(w, "sink:service_failure") - sink).toBeCloseTo(1000, 6);
  });

  it("on: a player poster's part is held to what the carrier held (cash, Reserve, settling); the rest goes to the sink", () => {
    const w = world(withWindows({ claimsInFull: true }), 2);
    const c = w.companies.find((x) => x.role === "carrier")!;
    const broker = w.companies.find((x) => x.role === "broker")!;
    // The carrier holds 100 FD in cash and 50 in the Reserve.
    move(w, companyAccount(c.id), "sink:test", Math.max(0, cash(w, c)));
    w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 150, "test");
    move(w, companyAccount(c.id), reserveAccount(c.id), 50);
    const toBroker = w.ledger.balance(companyAccount(broker.id));
    const sink = sunk(w, "sink:service_failure");
    const notes: string[] = [];
    w.listener = (e: GameEvent) => {
      if (e.kind === "notice" && e.companyId === c.id) notes.push(e.text);
    };
    expect(claimOn(w, c, booked(c, 4_000, broker.id), 0.25, "noshow")).toBeCloseTo(1000, 6);
    expect(w.ledger.balance(companyAccount(broker.id)) - toBroker).toBeCloseTo(150, 6);
    expect(sunk(w, "sink:service_failure") - sink).toBeCloseTo(850, 6);
    expect(cash(w, c)).toBeCloseTo(100 - 1000, 6);
    expect(notes.at(-1)).toContain(`(150 FD of it to ${broker.name})`);
  });
});

describe("claims in full: the poster's cap over several claims", () => {
  it("on: claims past what a carrier held, its FD all in the Reserve, pay the poster no more than it held in all", () => {
    const w = world(withWindows({ claimsInFull: true }), 2);
    const c = w.companies.find((x) => x.role === "carrier")!;
    const broker = w.companies.find((x) => x.role === "broker")!;
    // The carrier holds 300 FD, all of it in the Reserve.
    move(w, companyAccount(c.id), "sink:test", Math.max(0, cash(w, c)));
    w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 300, "test");
    move(w, companyAccount(c.id), reserveAccount(c.id), 300);
    const before = w.ledger.balance(companyAccount(broker.id));
    claimOn(w, c, booked(c, 4_000, broker.id), 0.25, "noshow");
    claimOn(w, c, { ...booked(c, 4_000, broker.id), id: 990_002 }, 0.25, "noshow");
    expect(w.ledger.balance(companyAccount(broker.id)) - before).toBeCloseTo(300, 6);
    expect(cash(w, c)).toBeCloseTo(-2000, 6);
  });
});

describe("a driver off the truck (labor.truckLessHomeByHub)", () => {
  /** A company's own driver taken off its truck, standing `far` from home or not, 25 days out. */
  function offTheTruck(cfg: EconomyConfig, far: boolean) {
    const w = world(cfg, 2);
    // A one-truck company's driver, so the company's books move only for them.
    const s = w.staff.find((x) => x.status === "employed" && x.kind === "driver" && x.truckId > 0 && w.trucksByCompany.get(x.companyId)!.length === 1)!;
    const c = w.companies[s.companyId - 1]!;
    unseatDriver(w, s);
    s.lastHub = far ? w.net.hubs.findIndex((_, i) => hubMiles(w, i, c.homeHub) > 1000) : c.homeHub;
    s.awayDays = 25;
    s.restDays = 0;
    s.fatigue = 0.6;
    s.drivenMinToday = 0;
    return { w, s, c };
  }

  it("on: away from home, an undriven day is a day away, with a layover's per diem", () => {
    const { w, s, c } = offTheTruck({ ...LIVE, labor: { ...LIVE.labor, truckLessHomeByHub: true } } as EconomyConfig, true);
    expect(s.truckId).toBe(0);
    const before = cash(w, c);
    dailyDrivers(w);
    expect(s.awayDays).toBe(26);
    expect(s.restDays).toBe(0);
    expect(before - cash(w, c)).toBeCloseTo(w.cfg.labor.driver.perDiemFd, 6);
  });

  it("on: inside the home radius it's home, as before", () => {
    const { w, s } = offTheTruck({ ...LIVE, labor: { ...LIVE.labor, truckLessHomeByHub: true } } as EconomyConfig, false);
    dailyDrivers(w);
    expect(s.awayDays).toBe(0);
    expect(s.restDays).toBe(1);
  });

  it("off: home wherever they stand, as before", () => {
    const { w, s, c } = offTheTruck(LIVE, true);
    const before = cash(w, c);
    dailyDrivers(w);
    expect(s.awayDays).toBe(0);
    expect(s.restDays).toBe(1);
    expect(cash(w, c)).toBeCloseTo(before, 6);
  });
});

describe("spoilage after the deadline (windows.spoilAfterDeadline) and a hot load's premium at arrival", () => {
  /** A truck carrying a load of `kind`s (or any), its event once delivered after `set` shapes the load. */
  function deliverWith(cfg: EconomyConfig, pick: (l: Load) => boolean, set: (l: Load, w: World) => void) {
    const w = world(cfg, 40, 11);
    const t = w.trucks.find((x) => x.status === "loaded" && x.loadId !== null && pick(w.loads.get(x.loadId)!))!;
    expect(t).toBeDefined();
    const l = w.loads.get(t.loadId!)!;
    set(l, w);
    let ev: Extract<GameEvent, { kind: "delivered" }> | null = null;
    w.listener = (e) => {
      if (e.kind === "delivered" && e.loadId === l.id) ev = e;
    };
    for (let h = 0; h < 24 * 8 && !ev; h++) stepHour(w);
    expect(ev).not.toBeNull();
    return { l, ev: ev! as Extract<GameEvent, { kind: "delivered" }> };
  }
  const perishable = (l: Load) => COMMODITIES[l.commodity]!.spoilHours !== null && l.latestDeliveryT !== undefined;
  // The old clock already run out (the appointment long past), "Deliver by" still ahead.
  const pastAppointment = (l: Load, w: World) => {
    l.appointmentT = w.t - (COMMODITIES[l.commodity]!.spoilHours! + 1) * 60;
    l.latestDeliveryT = Math.max(l.latestDeliveryT!, w.t + 6 * 24 * 60);
  };

  it("on: a perishable whose appointment is long past but whose \"Deliver by\" is ahead arrives sound and on time", () => {
    const { l, ev } = deliverWith(withWindows({ spoilAfterDeadline: true }), perishable, pastAppointment);
    expect(ev.grossFd).toBeGreaterThan(0);
    expect(ev.onTime).toBe(true);
    expect(l.latestDeliveryT).toBeGreaterThan(0);
  }, 240_000);

  it("off: the same load spoils on the old clock, as before", () => {
    const { ev } = deliverWith(LIVE, perishable, pastAppointment);
    expect(ev.grossFd).toBe(0);
  }, 240_000);

  it("on: past \"Deliver by\" and its spoil hours, it spoils, and a spoiled load is never on time", () => {
    const { ev } = deliverWith(withWindows({ spoilAfterDeadline: true }), perishable, (l, w) => {
      l.latestDeliveryT = w.t - (COMMODITIES[l.commodity]!.spoilHours! + 1) * 60;
    });
    expect(ev.grossFd).toBe(0);
    expect(ev.onTime).toBe(false);
  }, 240_000);

  it("a hot load that arrives by its deadline keeps its premium with the switch on, and loses part of it off", () => {
    const run = (on: boolean) => {
      const cfg = { ...LIVE, safety: { ...LIVE.safety, hotLoads: { ...LIVE.safety.hotLoads, premiumFromArrival: on } } } as EconomyConfig;
      const w = world(cfg, 40, 11);
      const t = w.trucks.find((x) => x.status === "loaded" && x.loadId !== null && w.loads.get(x.loadId)!.latestDeliveryT !== undefined && COMMODITIES[w.loads.get(x.loadId)!.commodity]!.spoilHours === null)!;
      const l = w.loads.get(t.loadId!)!;
      l.hot = 2;
      let ev: Extract<GameEvent, { kind: "delivered" }> | null = null;
      w.listener = (e) => {
        if (e.kind === "delivered" && e.loadId === l.id) ev = e;
      };
      // At the receiver the deadline moves to a minute after its arrival: on time by arrival, late by the end of unloading.
      for (let h = 0; h < 24 * 8 && !ev; h++) {
        stepHour(w);
        if (l.arrivedT !== undefined && l.latestDeliveryT !== l.arrivedT + 1) l.latestDeliveryT = l.arrivedT + 1;
      }
      expect(ev).not.toBeNull();
      return { ev: ev! as Extract<GameEvent, { kind: "delivered" }>, full: l.clearedRate * l.miles };
    };
    const on = run(true);
    const off = run(false);
    expect(on.ev.onTime).toBe(true);
    expect(on.ev.grossFd).toBeCloseTo(on.full, 4);
    expect(off.ev.grossFd).toBeCloseTo(off.full * 0.75, 4);
  }, 300_000);
});
