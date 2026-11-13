import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { applyAction, createWorld, crewed, dailyLabor, dayOf, homeBlock, hubMiles, placeOfHub, stepHour, unseatDriver, vettingBlock, type Load, type World } from "@lanes/engine";

/**
 * The director's rules C, H and I (director-playtest-rulings-2026-11-10.md), each behind its switch (labor.pastDueRefuses,
 * labor.homeTimeHolds, labor.seatPaidDrivers), off in the live levers.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const labor = (on: Partial<EconomyConfig["labor"]>): EconomyConfig => ({ ...LIVE, labor: { ...LIVE.labor, ...on } });

function world(cfg: EconomyConfig): World {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 21 });
  populate(w, { freeOwnerOperators: 6, fleets: 8, brokers: 2 });
  for (let h = 0; h < 30; h++) stepHour(w, ruleBotHook);
  return w;
}
/**
 * A truck with a hired driver and no load, standing idle at its town, and an open load posted there for its trailer (a
 * test's own: no vetting, no locals' hold, no tender), so nothing but the rules under test can refuse it.
 */
function hiredTruck(w: World) {
  for (const c of w.companies) {
    if (c.role !== "carrier") continue;
    for (const t of w.trucksByCompany.get(c.id) ?? []) {
      if (!crewed(t) || w.staff[t.driverId - 1]!.owner || t.loadId !== null || t.status === "retired" || t.status === "listed") continue;
      t.status = "idle";
      t.remainingMi = 0;
      const base = [...w.loads.values()][0]!;
      const load = { ...base, id: w.nextLoadId++, status: "open", origin: t.hub, originPlace: t.place, equipment: t.trailer, tenderedTo: 0, carrierId: null, truckId: null, hot: 0, vet: 0, brokerId: null, doubleBroker: null, localUntilRound: 0, hold: undefined, readyT: undefined } as unknown as Load;
      w.loads.set(load.id, load);
      return { c, t, d: w.staff[t.driverId - 1]!, load };
    }
  }
  throw new Error("no hired truck");
}

describe("the director's rules C, H and I", () => {
  it("H: a hired driver on home time isn't called out; a pickup after the days off is fine; the owner may cut theirs", () => {
    for (const on of [false, true]) {
      const w = world(labor({ homeTimeHolds: on }));
      const { c, t, d, load } = hiredTruck(w);
      const today = dayOf(w.t, w.cfg);
      d.homeUntilDay = today + 2;
      const why = homeBlock(w, c, t, load);
      if (!on) {
        expect(why).toBeNull();
        continue;
      }
      expect(why).toMatch(/is home until the days off end/);
      // The action says the same, before anything else is tried.
      expect(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: load.id })).toEqual({ ok: false, reason: why });
      expect(applyAction(w, c.id, { type: "place_bid", truckId: t.id, loadId: load.id, rate: load.bookNow })).toEqual({ ok: false, reason: why });
      // Booked ahead, past the days off: fine.
      load.readyT = (today + 2) * w.cfg.time.gameMinutesPerDay + 60;
      expect(homeBlock(w, c, t, load)).toBeNull();
      load.readyT = undefined;
      // The owner's own days off are theirs to cut.
      d.owner = true;
      expect(homeBlock(w, c, t, load)).toBeNull();
    }
  }, 120_000);

  it("C: past the home rule's days out, a hired driver takes loads toward home only", () => {
    for (const on of [false, true]) {
      const w = world(labor({ pastDueRefuses: on }));
      const { c, t, d } = hiredTruck(w);
      c.orders = [...c.orders.filter((o) => o.kind !== "homeTime"), { kind: "homeTime", afterDays: 21, restDays: 5 }];
      // Out on the road, away from home, past the 21 days.
      const away = w.net.hubs.findIndex((_, i) => hubMiles(w, c.homeHub, i) > 800);
      t.hub = away;
      t.place = placeOfHub(away);
      d.awayDays = 25;
      const mk = (dest: number): Load => ({ ...[...w.loads.values()][0]!, origin: away, dest, equipment: t.trailer, readyT: undefined }) as Load;
      const outbound = mk(w.net.hubs.findIndex((_, i) => hubMiles(w, c.homeHub, i) > hubMiles(w, c.homeHub, away) + 200));
      const homebound = mk(c.homeHub);
      expect(homeBlock(w, c, t, homebound)).toBeNull();
      if (on) expect(homeBlock(w, c, t, outbound)).toMatch(/is past due home: loads toward home only/);
      else expect(homeBlock(w, c, t, outbound)).toBeNull();
      // Not yet due: any load.
      d.awayDays = 10;
      expect(homeBlock(w, c, t, outbound)).toBeNull();
    }
  }, 120_000);

  it("I: a paid driver with no truck takes an empty one where they stand, each day, for a company that staffs by hand", () => {
    for (const on of [false, true]) {
      const w = world(labor({ seatPaidDrivers: on }));
      const { c, t, d } = hiredTruck(w);
      c.autoStaff = false;
      // The driver off the truck, standing by it: the truck stands empty.
      unseatDriver(w, d);
      d.lastHub = t.hub;
      expect(crewed(t)).toBe(false);
      dailyLabor(w);
      expect(crewed(t)).toBe(on);
      if (!on) continue;
      expect(w.staff[t.driverId - 1]!.owner).toBe(false);
      // Parked is the player's to restart: nobody is put in it.
      unseatDriver(w, d);
      t.status = "parked";
      dailyLabor(w);
      expect(crewed(t)).toBe(false);
      // A driver at another hub doesn't take it either (every other free driver of the company sent elsewhere too).
      for (const s of w.staff) if (s.companyId === c.id && s.truckId === 0 && s.kind === "driver") s.lastHub = w.net.hubs.findIndex((_, i) => i !== t.hub);
      t.status = "idle";
      dailyLabor(w);
      expect(crewed(t)).toBe(false);
    }
  }, 120_000);

  it("moves nothing for the bots: every bot staffs itself and books through its dispatcher", () => {
    const run = (on: boolean) => {
      const w = world(labor({ homeTimeHolds: on, pastDueRefuses: on, seatPaidDrivers: on }));
      for (let h = 0; h < 3 * 24; h++) stepHour(w, ruleBotHook);
      return JSON.stringify({ t: w.t, loads: [...w.loads.values()].map((l) => [l.id, l.status, l.carrierId, l.clearedRate]), trucks: w.trucks.map((x) => [x.id, x.status, x.place, x.driverId]) });
    };
    expect(run(true)).toBe(run(false));
  }, 120_000);
});
