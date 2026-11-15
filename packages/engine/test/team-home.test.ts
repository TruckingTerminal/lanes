import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { createWorld, dayOf, homeBlock, needsHome, resting, seatDriver, type Load, type Staff, type Truck, type World } from "@lanes/engine";

/**
 * The red team's L5 (labor.coDriversCount, off by default): on a team truck the home rules read the co-driver too,
 * not the lead alone.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const ON = { ...LIVE, labor: { ...LIVE.labor, coDriversCount: true } } as EconomyConfig;
/** Off by its own key: on in the live levers from 0.25.3. */
const OFF = { ...LIVE, labor: { ...LIVE.labor, coDriversCount: false } } as EconomyConfig;

/** A fleet's truck with a hired lead and a hired co-driver, both clean, and a load to try. */
function team(cfg: EconomyConfig) {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 13 });
  populate(w, { freeOwnerOperators: 0, fleets: 2, brokers: 1 });
  // A fleet's idle truck with a hired lead, and a driver from the pool hired to it as co-driver (as labor.ts hire does).
  const truck = w.trucks.find((t) => t.status === "idle" && t.driverId > 0 && !w.staff[t.driverId - 1]!.owner)!;
  const co: Staff = w.staff.find((s) => s.kind === "driver" && s.status === "pool")!;
  Object.assign(co, { status: "employed", companyId: truck.companyId, pay: 0.6, hiredDay: 0, offer: null, unseatedWeeks: 0 });
  w.staffByCompany.get(truck.companyId)!.push(co);
  seatDriver(w, co, truck, true);
  expect(truck.coDriverId).toBe(co.id);
  const c = w.companies[truck.companyId - 1]!;
  c.orders = [...c.orders.filter((o) => o.kind !== "homeTime"), { kind: "homeTime", afterDays: 21, restDays: 3 }];
  const load = { readyT: w.t, origin: truck.hub, dest: truck.hub, originPlace: truck.place, destPlace: truck.place } as unknown as Load;
  return { w, c, truck, co, load };
}
const today = (w: World) => dayOf(w.t, w.cfg);

describe("team trucks and the home rules (labor.coDriversCount)", () => {
  it("off: a co-driver on days off or past due isn't read, as before", () => {
    const { w, c, truck, co, load } = team(OFF);
    co.homeUntilDay = today(w) + 3;
    expect(resting(w, truck)).toBe(false);
    co.homeUntilDay = null;
    co.awayDays = 30;
    expect(needsHome(w, c, truck)).toBe(false);
    expect(homeBlock(w, c, truck, load)).toBeNull();
  });

  it("on: a co-driver on days off holds the truck (resting, rule H)", () => {
    const { w, c, truck, co, load } = team(ON);
    co.homeUntilDay = today(w) + 3;
    expect(resting(w, truck)).toBe(true);
    expect(homeBlock(w, c, truck, load)).toBe(`${co.name} is home until the days off end; this pickup comes before them`);
  });

  it("on: a co-driver past due turns the truck for home (the home rule), and rule C takes loads toward home only", () => {
    const { w, c, truck, co } = team(ON);
    co.awayDays = 30;
    expect(needsHome(w, c, truck)).toBe(true);
    const away = w.net.hubs.findIndex((_h, i) => i !== c.homeHub && w.net.nearby[c.homeHub]!.indexOf(i) > 30);
    const outbound = { readyT: w.t, origin: truck.hub, dest: away, originPlace: truck.place, destPlace: truck.place } as unknown as Load;
    expect(homeBlock(w, c, { ...truck, hub: c.homeHub } as Truck, outbound)).toBe(`${co.name} is past due home: loads toward home only, until you send them home`);
  });
});
