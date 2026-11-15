import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { applyAction, companyAccount, createWorld, dailyDrivers, dayOf, hubMiles, onTheBus, seatDriver, stepHour, unseatDriver, type World } from "@lanes/engine";

/**
 * Ruleset 0.25.3's bus home (labor.busHome, off by default; the director's sprint §9, the economy's sizes in
 * economy-bus-home-2026-11-15.md): a driver with no truck away from home rides home, and only with
 * labor.truckLessHomeByHub on.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const DAY = LIVE.time.gameMinutesPerDay;
const labor = (o: Record<string, unknown>) => ({ ...LIVE, labor: { ...LIVE.labor, truckLessHomeByHub: true, ...o } }) as EconomyConfig;
const BUS = labor({ busHome: { ...LIVE.labor.busHome, enabled: true } });
const cash = (w: World, companyId: number) => w.ledger.balance(companyAccount(companyId));

/** A one-truck company's driver (the owner), or a fleet's hired driver, taken off the truck more than 1,000 miles from home, ten days out. */
function stranded(cfg: EconomyConfig, hire = false) {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 13 });
  populate(w, { freeOwnerOperators: 20, fleets: 6, brokers: 2 });
  for (let h = 0; h < 2; h++) stepHour(w, ruleBotHook);
  const s = w.staff.find((x) => x.status === "employed" && x.kind === "driver" && x.truckId > 0 && (hire ? !x.owner : w.trucksByCompany.get(x.companyId)!.length === 1))!;
  const c = w.companies[s.companyId - 1]!;
  const truck = w.trucksByCompany.get(c.id)![0]!;
  unseatDriver(w, s);
  const far = w.net.hubs.findIndex((_, i) => hubMiles(w, i, c.homeHub) > 1000 && i !== truck.hub);
  s.lastHub = far;
  s.awayDays = 10;
  s.restDays = 0;
  s.drivenMinToday = 0;
  const said: string[] = [];
  w.listener = (e) => {
    if (e.kind === "notice" && e.companyId === c.id) said.push(e.text);
  };
  return { w, s, c, truck, far, miles: hubMiles(w, far, c.homeHub), said };
}
/** The next day's driver pass. */
function nextDay(w: World): void {
  w.t = (dayOf(w.t, w.cfg) + 1) * DAY;
  dailyDrivers(w);
}

describe("the bus home (labor.busHome)", () => {
  it("off: a driver stranded away from home stays out, with a layover a day, as 0.25.2 left it", () => {
    const { w, s, c } = stranded(labor({}));
    const before = cash(w, c.id);
    dailyDrivers(w);
    expect(s.bus).toBeUndefined();
    expect(s.awayDays).toBe(11);
    expect(before - cash(w, c.id)).toBeCloseTo(w.cfg.labor.driver.perDiemFd, 6);
  });

  it("on, with truckLessHomeByHub off: nothing runs (a driver off the truck is home wherever they stand)", () => {
    const { w, s } = stranded({ ...BUS, labor: { ...BUS.labor, truckLessHomeByHub: false } } as EconomyConfig);
    dailyDrivers(w);
    expect(s.bus).toBeUndefined();
    expect(s.awayDays).toBe(0);
  });

  it("on: a bot's driver takes the bus at once, for a day's per diem plus a day's for each 800 miles, and is told as they leave", () => {
    const { w, s, c, far, miles, said } = stranded(BUS);
    const before = cash(w, c.id);
    const today = dayOf(w.t, w.cfg);
    dailyDrivers(w);
    const days = miles / 800;
    const fare = w.cfg.labor.driver.perDiemFd * (1 + days);
    expect(before - cash(w, c.id)).toBeCloseTo(fare, 6);
    expect(s.bus).toEqual({ from: far, miles, fareFd: fare, leftT: w.t, arriveDay: today + Math.ceil(days) });
    expect(onTheBus(s)).toBe(true);
    // An owner-operator's own notice says "you"; a hired driver's, "they".
    const who = s.owner ? "No truck for you" : "No truck for Driver";
    expect(said.at(-1)).toContain(who);
    expect(said.at(-1)).toContain(`at ${w.net.hubs[far]!.name}, so ${s.owner ? "you're" : "they're"} taking the bus home: about ${Math.round(days * 24)} h, ${Math.round(fare).toLocaleString("en-US")} FD.`);
  });

  it("a hired driver's notice names them", () => {
    const { w, s, said } = stranded(BUS, true);
    expect(s.owner).toBe(false);
    dailyDrivers(w);
    expect(said.find((x) => x.includes(s.name))).toMatch(new RegExp(`^No truck for Driver ${s.name} \\(\\d★\\) at .+, so they're taking the bus home: about \\d+ h, [\\d,]+ FD\\.$`));
  });

  it("on the bus: days away with no rest and no layover; arriving, home, the last hub the home hub", () => {
    const { w, s, c } = stranded(BUS);
    dailyDrivers(w);
    const trip = s.bus!;
    let away = s.awayDays;
    while (dayOf(w.t, w.cfg) + 1 < trip.arriveDay) {
      const before = cash(w, c.id);
      nextDay(w);
      expect(s.awayDays).toBe(++away);
      expect(s.restDays).toBe(0);
      expect(cash(w, c.id)).toBeCloseTo(before, 6);
      expect(onTheBus(s)).toBe(true);
    }
    nextDay(w);
    expect(dayOf(w.t, w.cfg)).toBe(trip.arriveDay);
    expect(onTheBus(s)).toBe(false);
    expect(s.bus!.done).toBe(true);
    expect(s.lastHub).toBe(c.homeHub);
    expect(s.awayDays).toBe(0);
    expect(s.restDays).toBe(1);
  });

  it("arriving due for days off, they start: the home-time order's days out, as at a truck's arrival home", () => {
    const { w, s, c, said } = stranded(BUS);
    const hm = c.orders.find((o) => o.kind === "homeTime") as { afterDays: number; restDays: number } | undefined;
    c.orders = [...c.orders.filter((o) => o.kind !== "homeTime"), { kind: "homeTime", afterDays: 14, restDays: 4 }];
    s.awayDays = 20;
    dailyDrivers(w);
    const arrive = s.bus!.arriveDay;
    while (dayOf(w.t, w.cfg) < arrive) nextDay(w);
    expect(s.homeUntilDay).toBe(arrive + 4);
    expect(said.at(-1)).toMatch(/^(You're|Driver .+ is) home off the bus, for 4 days off/);
    void hm;
  });

  it("a company that staffs by hand waits a day first (a seat swap or a relay at that hub); a bot waits while an empty truck of theirs there needs a driver", () => {
    const byHand = stranded(BUS);
    byHand.c.human = true;
    byHand.c.autoStaff = false;
    dailyDrivers(byHand.w);
    expect(byHand.s.bus).toBeUndefined();
    nextDay(byHand.w);
    expect(onTheBus(byHand.s)).toBe(true);

    const bot = stranded(BUS);
    bot.truck.hub = bot.far;
    bot.truck.status = "idle";
    dailyDrivers(bot.w);
    nextDay(bot.w);
    expect(bot.s.bus).toBeUndefined();
    expect(bot.s.awayDays).toBe(12);
  });

  it("seated on the way, the trip ends; on the bus, they can't be seated by hand", () => {
    const { w, s, c, truck } = stranded(BUS);
    dailyDrivers(w);
    expect(onTheBus(s)).toBe(true);
    const r = applyAction(w, c.id, { type: "assign_driver", staffId: s.id, truckId: truck.id });
    expect(r).toEqual({ ok: false, reason: "they're on the bus home" });
    // Auto-staff seats anywhere until the bus to a truck (§6): the trip ends there.
    seatDriver(w, s, truck);
    nextDay(w);
    expect(s.bus!.done).toBe(true);
    expect(onTheBus(s)).toBe(false);
  });
});
