import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import {
  applyAction,
  clearsNear,
  companyAccount,
  createWorld,
  formCompany,
  hubMiles,
  noteClear,
  placeLegMiles,
  placeMiles,
  placeOfHub,
  placeRoute,
  sitesAlong,
  stepHour,
  type Load,
  type World,
} from "@lanes/engine";

/**
 * The rules batch (2026-11-09), five player-facing rules each behind its own switch, off: "usually clears near" as a ratio
 * to the reference (freight.clearsNear.ratio, the economy's note economy-clears-near-2026-11-09.md), Send home to work
 * (labor.sendHomeToWork), turning a truck running empty (labor.turnWhileEmpty), one reach for a bid and Book now
 * (board.bidReachFromTown), and a night in town (businesses.parking.stopInTown). On the live profile.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const DAY = LIVE.time.gameMinutesPerDay;
const on = (patch: (c: EconomyConfig) => EconomyConfig): EconomyConfig => patch(LIVE);
const RATIO = on((c) => ({ ...c, freight: { ...c.freight, clearsNear: { ...c.freight.clearsNear, ratio: true } } }));
// Each rule off by its own key (0.24.1 switched sendHomeToWork, turnWhileEmpty, bidReachFromTown and stopInTown on in the
// live levers), and all four off together for the identity test.
const OFF_HOME = on((c) => ({ ...c, labor: { ...c.labor, sendHomeToWork: false } }));
const OFF_TURN = on((c) => ({ ...c, labor: { ...c.labor, turnWhileEmpty: false } }));
const OFF_REACH = on((c) => ({ ...c, board: { ...c.board, bidReachFromTown: false } }));
const OFF_TOWN = on((c) => ({ ...c, businesses: { ...c.businesses, parking: { ...c.businesses.parking, stopInTown: false } } }));
const OFF = on((c) => ({ ...c, board: { ...c.board, bidReachFromTown: false }, labor: { ...c.labor, sendHomeToWork: false, turnWhileEmpty: false }, businesses: { ...c.businesses, parking: { ...c.businesses.parking, stopInTown: false } } }));

/** The ten-day world's digest (the windows batch's): the clock, the books, every day's metrics, the board and the trucks. */
function digest(cfg: EconomyConfig): string {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 20_261_109 });
  populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 6 });
  for (let h = 0; h < 10 * 24; h++) stepHour(w, ruleBotHook);
  const s = JSON.stringify({
    t: w.t,
    next: w.nextLoadId,
    supply: w.ledger.supply(),
    books: w.companies.map((c) => [c.id, w.ledger.balance(companyAccount(c.id)), c.delivered, c.onTime, c.operating]),
    days: w.metrics.days,
    loads: [...w.loads.values()],
    trucks: w.trucks,
  });
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

describe("the switches off", () => {
  it("leave the ten-day world byte-identical with the keys false and absent; the ratio rule moves no bot either", () => {
    expect(LIVE.freight.clearsNear.ratio).toBe(false);
    const { ratio: _r, priorClears: _p, ...cn } = OFF.freight.clearsNear;
    const { bidReachFromTown: _b, ...board } = OFF.board;
    const { sendHomeToWork: _s, turnWhileEmpty: _t, ...labor } = OFF.labor;
    const { stopInTown: _n, ...parking } = OFF.businesses.parking;
    const absent = { ...OFF, freight: { ...OFF.freight, clearsNear: cn }, board, labor, businesses: { ...OFF.businesses, parking } } as unknown as EconomyConfig;
    expect(digest(absent)).toBe(digest(OFF));
    // The economy's test 4: no bot reads "usually clears near", so its rule moves nothing but the table (not in the digest).
    expect(digest(RATIO)).toBe(digest(LIVE));
  }, 240_000);
});

describe("usually clears near, as a ratio to the reference (freight.clearsNear.ratio)", () => {
  const load = (laneId: number, refRate: number, miles: number, extra: Partial<Load> = {}): Load =>
    ({ laneId, equipment: "van", origin: 3, refRate, hot: 0, ceiling: 99, contractId: 0, miles, ...extra }) as unknown as Load;
  const world = (cfg: EconomyConfig): World => createWorld({ cfg, net, feeds: neutralFeeds, seed: 1 });

  it("reads each load's own reference times its hub's ratio, not one per-mile figure (test 1)", () => {
    const w = world(RATIO);
    // The hub's clears, on a third lane, at the reference exactly.
    for (let i = 0; i < 30; i++) noteClear(w, load(9, 3, 600), 3);
    const short = load(7, 4.6, 200);
    const long = load(8, 2.4, 1_200);
    expect(clearsNear(w, short)).toBeCloseTo(4.6, 6);
    expect(clearsNear(w, long)).toBeCloseTo(2.4, 6);
    // Under the old rule the two read one market figure, the hub's mean per mile.
    const old = world(LIVE);
    for (let i = 0; i < 30; i++) noteClear(old, load(9, 3, 600), 3);
    expect(clearsNear(old, short)).toBeCloseTo(clearsNear(old, long), 6);
  });

  it("lets a lane quiet for a week fade to its hub, and a quiet hub to the reference (test 2)", () => {
    const w = world(RATIO);
    expect(w.cfg.freight.clearsNear.halfLifeDays).toBe(1);
    const l = load(7, 3, 500);
    for (let i = 0; i < 40; i++) noteClear(w, l, 3 * 1.15);
    expect(clearsNear(w, l)).toBeGreaterThan(3 * 1.12);
    w.t += 7 * DAY;
    // The hub's figure: a load on another lane out of the same hub, with no clears of its own.
    const hubOnly = clearsNear(w, load(99, 3, 500));
    expect(Math.abs(clearsNear(w, l) / hubOnly - 1)).toBeLessThan(0.02);
    expect(Math.abs(hubOnly / 3 - 1)).toBeLessThan(0.02);
  });

  it("with no clears anywhere reads the reference with its hot premium, at most the ceiling (test 3)", () => {
    const w = world(RATIO);
    expect(clearsNear(w, load(7, 3, 500))).toBeCloseTo(3, 9);
    expect(clearsNear(w, load(7, 3, 900, { hot: 1.3 }))).toBeCloseTo(3.9, 9);
    expect(clearsNear(w, load(7, 3, 900, { hot: 1.3, ceiling: 3.5 }))).toBeCloseTo(3.5, 9);
  });

  it("starts the table afresh when the switch turns, and a read writes nothing", () => {
    const w = world(LIVE);
    for (let i = 0; i < 10; i++) noteClear(w, load(7, 3, 500), 4.5);
    const before = JSON.stringify(w.clears);
    (w as { cfg: EconomyConfig }).cfg = RATIO;
    expect(clearsNear(w, load(7, 3, 500))).toBeCloseTo(3, 9); // the rates table reads as empty under the ratio rule
    expect(JSON.stringify(w.clears)).toBe(before);
    noteClear(w, load(7, 3, 500), 3.3);
    expect(w.clears!.ratio).toBe(true);
    expect(w.clears!.lane["7:van"]![0]).toBeCloseTo(1.1, 9);
  });
});

/** One leased owner-operator at Dallas, on the live profile with these switches. */
function oo(cfg: EconomyConfig, keep = false) {
  const w: World = createWorld({ cfg, net, feeds: neutralFeeds, seed: 7, keepLedgerEntries: keep });
  const c = formCompany(w, { name: "Rules Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
  const t = w.trucksByCompany.get(c.id)![0]!;
  const d = w.staff[t.driverId - 1]!;
  const far = w.net.hubs.findIndex((_, i) => hubMiles(w, i, c.homeHub) > 700 && hubMiles(w, i, c.homeHub) < 1_100);
  return { w, c, t, d, far };
}
/** The truck stands idle at a hub's own place. */
const standAt = (t: World["trucks"][number], hub: number) => {
  t.hub = hub;
  t.targetHub = hub;
  t.place = placeOfHub(hub);
  t.targetPlace = t.place;
  t.status = "idle";
  t.remainingMi = 0;
};

describe("Send home to work (labor.sendHomeToWork)", () => {
  const ON = on((c) => ({ ...c, labor: { ...c.labor, sendHomeToWork: true } }));

  it("off: home to work is refused, and Send home is today's", () => {
    const { w, c, t, far } = oo(OFF_HOME);
    standAt(t, far);
    expect(applyAction(w, c.id, { type: "send_home", truckId: t.id, work: true }).ok).toBe(false);
    expect(t.status).toBe("idle");
  });

  it("on, idle: an empty run home at once, and no days off asked", () => {
    const { w, c, t, d, far } = oo(ON);
    standAt(t, far);
    expect(applyAction(w, c.id, { type: "send_home", truckId: t.id, work: true }).ok).toBe(true);
    expect(t.status).toBe("repositioning");
    expect(t.targetHub).toBe(c.homeHub);
    expect(d.wantsHome).toBe(false);
  });

  it("on, at work: queued until the job in hand ends, then home with no days off", () => {
    // The job in hand is an empty run, which labor.turnWhileEmpty (on in the live levers since 0.24.1) turns for home at
    // once (its own describe below); the queue is this rule's alone, so the turn is off here.
    const { w, c, t, d, far } = oo(on((x) => ({ ...x, labor: { ...x.labor, sendHomeToWork: true, turnWhileEmpty: false } })));
    standAt(t, far);
    const next = w.net.hubs.findIndex((_, i) => i !== far && hubMiles(w, i, far) > 60 && hubMiles(w, i, far) < 150);
    expect(applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[next]!.id }).ok).toBe(true);
    expect(applyAction(w, c.id, { type: "send_home", truckId: t.id, work: true }).ok).toBe(true);
    expect(t.homeAfter).toBe("work");
    // The job in hand isn't touched.
    expect(t.targetHub).toBe(next);
    expect(applyAction(w, c.id, { type: "send_home", truckId: t.id, work: true }).ok).toBe(false);
    for (let h = 0; h < 48 && t.targetHub !== c.homeHub; h++) stepHour(w);
    expect(t.status).toBe("repositioning");
    expect(t.targetHub).toBe(c.homeHub);
    expect(t.homeAfter).toBeUndefined();
    expect(d.wantsHome).toBe(false);
  });
});

describe("turning a truck running empty (labor.turnWhileEmpty)", () => {
  const ON = on((c) => ({ ...c, labor: { ...c.labor, turnWhileEmpty: true } }));

  it("off: a truck running empty can't be turned until it arrives", () => {
    const { w, c, t, far } = oo(OFF_TURN);
    expect(applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[far]!.id }).ok).toBe(true);
    for (let h = 0; h < 6; h++) stepHour(w);
    const other = w.net.hubs.findIndex((_, i) => i !== far && i !== c.homeHub);
    expect(applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[other]!.id }).ok).toBe(false);
    expect(t.targetHub).toBe(far);
  });

  it("on: it turns from the town nearest where it is, pays the miles so far, and runs from there", () => {
    const { w, c, t, far } = oo(ON, true);
    expect(applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[far]!.id }).ok).toBe(true);
    for (let h = 0; h < 6 && t.emptyMi < 150; h++) stepHour(w);
    expect(t.emptyMi).toBeGreaterThan(50);
    const start = t.place;
    const other = w.net.hubs.findIndex((_, i) => i !== far && i !== c.homeHub && hubMiles(w, i, c.homeHub) < 400 && hubMiles(w, i, c.homeHub) > 150);
    expect(applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[other]!.id }).ok).toBe(true);
    expect(t.status).toBe("repositioning");
    expect(t.targetHub).toBe(other);
    expect(t.place).not.toBe(start);
    expect(t.emptyMi).toBe(0);
    expect(t.remainingMi).toBeGreaterThanOrEqual(placeLegMiles(w, t.place, placeOfHub(other)));
    expect(w.ledger.entries.some((e) => e.ref === `turn:${t.id}`)).toBe(true);
    // Send home turns it home now, with days off (no work asked).
    expect(applyAction(w, c.id, { type: "send_home", truckId: t.id }).ok).toBe(true);
    expect(t.targetHub).toBe(c.homeHub);
    expect(w.staff[t.driverId - 1]!.wantsHome).toBe(true);
    for (let h = 0; h < 72 && t.status !== "idle"; h++) stepHour(w);
    w.ledger.assertBalanced();
  });
});

describe("one reach for a bid and Book now (board.bidReachFromTown)", () => {
  const ON = on((c) => ({ ...c, board: { ...c.board, bidReachFromTown: true } }));

  /** A truck in a town of its market near another market whose load is within 300 miles of it, town to town, and over 300 market to market. */
  function edge(cfg: EconomyConfig) {
    const { w, c, t } = oo(cfg);
    w.t = 5 * 60;
    stepHour(w); // 06:00, a round: the board posts
    const load = [...w.loads.values()].find((l) => l.status === "open" && l.equipment === t.trailer)!;
    expect(load).toBeDefined();
    for (let a = 0; a < w.net.hubs.length; a++) {
      for (let b = 0; b < w.net.hubs.length; b++) {
        const hm = hubMiles(w, a, b);
        if (a === b || hm <= 300 || hm > 420) continue;
        for (let p = 0; p < w.net.places.length; p++) {
          if (w.net.places[p]!.market !== a) continue;
          const q = w.net.places.findIndex((x, i) => x.market === b && placeMiles(w, p, i) <= 280);
          if (q < 0) continue;
          standAt(t, a);
          t.place = p;
          t.targetPlace = p;
          // The load picks up at that town of the other market, open to anyone.
          Object.assign(load, { origin: b, originPlace: q, localUntilRound: 0, tenderedTo: 0, vet: 0, hot: 0, brokerId: null });
          return { w, c, t, load };
        }
      }
    }
    throw new Error("no such pair");
  }

  it("off: the bid measures market to market and is refused where Book now's reach takes the load", () => {
    const { w, c, t, load } = edge(OFF_REACH);
    const r = applyAction(w, c.id, { type: "place_bid", truckId: t.id, loadId: load.id, rate: load.ceiling * 0.9 });
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/miles empty to the pickup/) });
  }, 60_000);

  it("on: the bid measures as Book now does, from the truck's own town", () => {
    const { w, c, t, load } = edge(ON);
    const r = applyAction(w, c.id, { type: "place_bid", truckId: t.id, loadId: load.id, rate: load.ceiling * 0.9 });
    expect(r.ok ? "" : (r as { reason: string }).reason).not.toMatch(/miles empty to the pickup/);
  }, 60_000);
});

describe("a night in town (businesses.parking.stopInTown)", () => {
  const ON = on((c) => ({ ...c, businesses: { ...c.businesses, parking: { ...c.businesses.parking, stopInTown: true } } }));

  /** A truck with an hour of driving left at the start of a long empty run, every site in its first 200 miles full. */
  function lateStart(cfg: EconomyConfig, choose: boolean) {
    const { w, c, t, far } = oo(cfg, true);
    w.t = 14 * 60;
    if (choose) expect(applyAction(w, c.id, { type: "set_night_stop", choice: "town" }).ok).toBe(true);
    expect(applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[far]!.id }).ok).toBe(true);
    const route = placeRoute(w, t.place, t.targetPlace)!;
    for (const s of sitesAlong(w, route)) if (s.mile < 200) w.sites[s.site - 1]!.parked = w.sites[s.site - 1]!.spaces;
    const limit = w.cfg.hos.drivingHoursPerDay * 60;
    t.shiftStartT = w.t - 10 * 60;
    t.shiftDrivenMin = limit - 60;
    t.offDutySinceT = w.t;
    return { w, c, t };
  }

  it("off, or not chosen: the shoulder, as today; the choice is refused while off", () => {
    const { w, c } = oo(OFF_TOWN);
    expect(applyAction(w, c.id, { type: "set_night_stop", choice: "town" }).ok).toBe(false);
    const { w: w2, t } = lateStart(ON, false);
    const mi = t.remainingMi;
    stepHour(w2);
    expect(t.remainingMi).toBeLessThan(mi);
  });

  it("chosen: it doesn't set out, sleeps in town with no ticket, and leaves with the morning's hours", () => {
    const { w, t } = lateStart(ON, true);
    const mi = t.remainingMi;
    for (let h = 0; h < 6; h++) stepHour(w);
    expect(t.remainingMi).toBe(mi);
    expect(t.townNight).toBeUndefined(); // slept: the stop is spent
    expect(w.ledger.entries.some((e) => e.ref === `fine:shoulder:${t.id}`)).toBe(false);
    for (let h = 0; h < 14; h++) stepHour(w);
    expect(t.remainingMi).toBeLessThan(mi);
  });

  it("with the weekly clock all but out, the day closes in one pass at the full limit", () => {
    const { w, t } = lateStart(ON, true);
    // A legal log with a sliver of the week's 70 hours left: the hours left are that sliver, not the day's hour. Adding
    // the sliver to the day would bring the loop back to the town once per sliver (60 million passes here).
    t.cycleMin = w.cfg.hos.cycleHours * 60 - 1e-6;
    t.cycleLastT = w.t;
    const mi = t.remainingMi;
    stepHour(w);
    expect(t.remainingMi).toBe(mi);
    expect(t.shiftDrivenMin).toBe(w.cfg.hos.drivingHoursPerDay * 60);
    expect(t.cycleMin).toBe(w.cfg.hos.cycleHours * 60 - 1e-6); // the weekly clock counts no minute of it
    expect(t.townNight).toBeUndefined(); // slept in town
    expect(w.ledger.entries.some((e) => e.ref === `fine:shoulder:${t.id}`)).toBe(false);
  }, 10_000);

  describe("with labor.turnWhileEmpty (the red team's 0.24.1 pass: turn + town)", () => {
    const BOTH = on((c) => ({ ...c, labor: { ...c.labor, turnWhileEmpty: true }, businesses: { ...c.businesses, parking: { ...c.businesses.parking, stopInTown: true } } }));

    it("a turn an hour before the hours run out drives on and sleeps on the shoulder, as before the town", () => {
      const { w, c, t, far } = oo(BOTH, true);
      w.t = 6 * 60;
      expect(applyAction(w, c.id, { type: "set_night_stop", choice: "town" }).ok).toBe(true);
      expect(applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[far]!.id }).ok).toBe(true);
      for (let h = 0; h < 3; h++) stepHour(w);
      expect(t.emptyMi).toBeGreaterThan(50);
      // An hour of driving left, then a turn toward a hub that hour can't reach, every site on its first 200 miles full.
      const limit = w.cfg.hos.drivingHoursPerDay * 60;
      t.shiftDrivenMin = limit - 60;
      const other = w.net.hubs.findIndex((_, i) => i !== far && i !== c.homeHub && hubMiles(w, i, c.homeHub) < 400 && hubMiles(w, i, c.homeHub) > 150);
      expect(applyAction(w, c.id, { type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[other]!.id }).ok).toBe(true);
      expect(t.turnedToday).toBe(true);
      const route = placeRoute(w, t.place, t.targetPlace)!;
      for (const s of sitesAlong(w, route)) if (s.mile < 200) w.sites[s.site - 1]!.parked = w.sites[s.site - 1]!.spaces;
      const nights: string[] = [];
      const onNight = w.metrics.onNight.bind(w.metrics);
      w.metrics.onNight = ((k: Parameters<typeof onNight>[0]) => {
        nights.push(k);
        onNight(k);
      }) as typeof onNight;
      const mi = t.remainingMi;
      stepHour(w);
      // It set out: no night in town on a leg a turn began.
      expect(t.remainingMi).toBeLessThan(mi);
      expect(t.townNight).toBeUndefined();
      // The hour spent, the night is the shoulder's (no site with room in reach), and the next duty day clears the mark.
      for (let h = 0; h < 14 && t.turnedToday; h++) stepHour(w);
      expect(t.turnedToday).toBeUndefined();
      expect(t.shiftDrivenMin).toBeLessThan(limit);
      expect(t.townNight).toBeUndefined();
      expect(nights[0]).toBe("shoulder");
      w.ledger.assertBalanced();
    });

    it("a truck that began the leg idle in the town still sleeps there", () => {
      const { w, t } = lateStart(BOTH, true);
      expect(t.turnedToday).toBeUndefined();
      const mi = t.remainingMi;
      for (let h = 0; h < 6; h++) stepHour(w);
      expect(t.remainingMi).toBe(mi);
      expect(w.ledger.entries.some((e) => e.ref === `fine:shoulder:${t.id}`)).toBe(false);
    });
  });
});
