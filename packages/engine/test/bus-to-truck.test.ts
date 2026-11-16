import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { applyAction, autoStaff, busRide, companyAccount, createWorld, dailyDrivers, dayOf, heldFor, hubMiles, offerStaff, placeOfHub, releaseStaff, seatBlock, sendBlock, sendByBus, unseatDriver, weekdayName, fmtInt, type Company, type Staff, type Truck, type World } from "@lanes/engine";

/**
 * The director's sprint §19 and §20 (labor.busToTruck): the bus to a truck, as the bus home mirrored. A driver with no
 * truck rides to an empty seat at another hub at the bus home's fare, days away with no rest, the seat held while he
 * rides; auto-staff sends one before it hires; and a driver let go keeps the hub four weeks, so a hire elsewhere rides first.
 */
const LIVE = withLiveLevers(); // the bus home and home by hub on
const net = buildNetwork(hubs, LIVE);
const DAY = LIVE.time.gameMinutesPerDay;
const ON = { ...LIVE, labor: { ...LIVE.labor, busToTruck: { ...LIVE.labor.busToTruck, enabled: true } } } as EconomyConfig;
// Off by its own key: on in the live levers since 0.25.5.
const OFF = { ...LIVE, labor: { ...LIVE.labor, busToTruck: { ...LIVE.labor.busToTruck, enabled: false } } } as EconomyConfig;
const cash = (w: World, c: Company) => w.ledger.balance(companyAccount(c.id));
const park = (t: Truck, hub: number) => Object.assign(t, { status: "idle", loadId: null, hub, targetHub: hub, place: placeOfHub(hub), targetPlace: placeOfHub(hub), remainingMi: 0 });

/** A fleet with two trucks: Truck A at its home hub, Truck B 400–900 miles away; A's driver off the truck at A, B empty. */
function fleet(cfg: EconomyConfig = ON) {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 13, keepLedgerEntries: true });
  populate(w, { freeOwnerOperators: 0, fleets: 4, brokers: 1 });
  // Hired drivers (an owner isn't let go), two trucks of theirs.
  const hired = (x: Company) => (w.trucksByCompany.get(x.id) ?? []).filter((t) => t.driverId > 0 && !w.staff[t.driverId - 1]!.owner);
  const c = w.companies.find((x) => x.role === "carrier" && hired(x).length >= 2)!;
  const [a, b] = hired(c) as [Truck, Truck];
  const far = w.net.hubs.findIndex((_h, i) => hubMiles(w, i, c.homeHub) > 400 && hubMiles(w, i, c.homeHub) < 900);
  park(a, c.homeHub);
  park(b, far);
  const s = w.staff[a.driverId - 1]!;
  unseatDriver(w, s);
  a.status = "listed"; // Truck A off the road: no seat for him where he stands
  releaseStaff(w, w.staff[b.driverId - 1]!); // Truck B stands empty
  if (!c.orders.some((o) => o.kind === "homeTime")) c.orders.push({ kind: "homeTime", afterDays: 21, restDays: 3 });
  s.awayDays = 0;
  s.homeUntilDay = null;
  return { w, c, a, b, s, far };
}

describe("the bus to a truck (labor.busToTruck)", () => {
  it("sent to an empty seat at another hub: the bus home's fare, the seat held while he rides, days away, seated on arrival", () => {
    const { w, c, b, s } = fleet();
    const r = busRide(w, s.lastHub!, b.hub);
    expect(r.fareFd).toBeCloseTo(w.cfg.labor.driver.perDiemFd * (w.cfg.labor.busHome.fareDays + r.miles / w.cfg.labor.busHome.miPerDay), 9);
    const before = cash(w, c);
    expect(applyAction(w, c.id, { type: "send_driver", staffId: s.id, truckId: b.id })).toEqual({ ok: true });
    expect(before - cash(w, c)).toBeCloseTo(r.fareFd, 2); // the ledger posts to the cent
    expect(heldFor(w, b)?.id).toBe(s.id);
    // Held: no one else takes the seat, by hand or by hire.
    const other = w.staffByCompany.get(c.id)!.find((x) => x.kind === "driver" && x.id !== s.id && x.status === "employed")!;
    if (other.truckId) unseatDriver(w, other);
    other.lastHub = b.hub;
    expect(seatBlock(w, c, other, b, false)).toBe(`that seat is held for ${s.name}, on the bus`);
    const pool = w.staff.find((x) => x.status === "pool" && x.kind === "driver")!;
    expect(offerStaff(w, c, pool, 5, b.id)).toBe(`that seat is held for ${s.name}, on the bus`);
    // On the bus: days away with no rest, then the held seat.
    const away = s.awayDays;
    const arrive = s.bus!.arriveDay;
    while (dayOf(w.t, w.cfg) < arrive) {
      w.t += DAY;
      dailyDrivers(w);
    }
    expect(s.truckId).toBe(b.id);
    expect(s.awayDays).toBeGreaterThan(away);
    expect(heldFor(w, b)).toBeUndefined();
  });

  it("who can't ride: on days off, due for them, already there, a truck with a driver; and nothing with the switch off", () => {
    const { w, c, a, b, s } = fleet();
    s.homeUntilDay = dayOf(w.t, w.cfg) + 2;
    expect(sendBlock(w, c, s, b)).toBe(`${s.owner ? "you're" : `${s.name} is`} on days off`);
    s.homeUntilDay = null;
    s.awayDays = 99;
    expect(sendBlock(w, c, s, b)).toBe(`${s.owner ? "you're" : `${s.name} is`} due for days off first`);
    s.awayDays = 0;
    expect(sendBlock(w, c, s, a)).toMatch(/can take that seat now$/);
    expect(sendBlock(w, c, s, b)).toBeNull();
    const off = fleet(OFF);
    expect(sendByBus(off.w, off.c, off.s, off.b)).toBe("there's no bus to a truck");
  });

  it("the ride's notice names the day the seat is taken, and auto-staff's send says so (the writer's §15 item 7)", () => {
    const said = (w: World) => {
      const out: string[] = [];
      w.listener = (e) => {
        if (e.kind === "notice") out.push(e.text);
      };
      return out;
    };
    const tail = (w: World, s: Staff, b: Truck) => `to Truck ${b.id} at ${w.net.places[b.place]!.name}, arriving ${weekdayName(s.bus!.arriveDay * DAY, w.cfg).slice(0, 3)}: ${fmtInt(s.bus!.fareFd)} FD.`;
    const sent = fleet();
    const heard = said(sent.w);
    expect(applyAction(sent.w, sent.c.id, { type: "send_driver", staffId: sent.s.id, truckId: sent.b.id })).toEqual({ ok: true });
    const line = heard.find((x) => x.includes(" takes the bus from "))!;
    expect(line.endsWith(tail(sent.w, sent.s, sent.b))).toBe(true);
    expect(line).not.toMatch(/about \d+ h/);
    const auto = fleet();
    const told = said(auto.w);
    autoStaff(auto.w, auto.c);
    const sentLine = told.find((x) => x.startsWith("Auto-staff sent "))!;
    expect(sentLine).toContain(" by bus from ");
    expect(sentLine.endsWith(tail(auto.w, auto.s, auto.b))).toBe(true);
  });

  it("auto-staff sends a driver with no truck before it hires, the nearest within maxDays; past it, it hires", () => {
    const { w, c, b, s } = fleet();
    const staff = w.staffByCompany.get(c.id)!.length;
    autoStaff(w, c);
    expect(s.bus?.to).toBe(b.id);
    expect(w.staffByCompany.get(c.id)!.length).toBe(staff); // no hire for Truck B
    const far = fleet({ ...ON, labor: { ...ON.labor, busToTruck: { ...ON.labor.busToTruck, maxDays: 0 } } } as EconomyConfig);
    autoStaff(far.w, far.c);
    expect(far.s.bus?.to).toBeUndefined();
    expect(far.b.driverId).toBeGreaterThan(0); // a hire from the pool instead
  });

  it("§20: let go, a driver keeps the hub four weeks; a hire for a truck elsewhere rides first at the hirer's cost; then a hire starts at the truck", () => {
    const { w, c, a, b, s } = fleet();
    releaseStaff(w, s);
    expect(s.lastHub).toBe(a.hub);
    expect(s.pooledDay).toBe(dayOf(w.t, w.cfg));
    // Re-hired for Truck B, at another hub: the bus there first.
    const before = cash(w, c);
    expect(offerStaff(w, c, s, s.kind === "driver" ? 5 : 5_000, b.id)).toBeNull();
    expect(s.bus?.to).toBe(b.id);
    expect(s.truckId).toBe(0);
    expect(before - cash(w, c)).toBeCloseTo(busRide(w, a.hub, b.hub).fareFd, 2);
    // Four weeks on: moved on, a hire starts at the truck.
    const later = fleet();
    releaseStaff(later.w, later.s);
    later.w.t += (later.w.cfg.labor.busToTruck.poolWeeks * 7 + 1) * DAY;
    expect(offerStaff(later.w, later.c, later.s, 5, later.b.id)).toBeNull();
    expect(later.s.truckId).toBe(later.b.id);
    expect(later.s.bus?.to).toBeUndefined();
  });

  it("off: a driver let go leaves no hub behind, as before", () => {
    const { w, s } = fleet(OFF);
    releaseStaff(w, s);
    expect(s.lastHub).toBeUndefined();
    expect(s.pooledDay).toBeUndefined();
  });
});
