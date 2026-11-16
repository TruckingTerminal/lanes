import "./seed.js";
import { describe, expect, it } from "vitest";
import { busRide, hubMiles, placeOfHub, unseatDriver } from "@lanes/engine";
import { nearestRider, riderLine, sendTargets } from "../src/busui.js";
import { FIXES } from "../src/copy-fixes.js";
import { fdFull, weekday } from "../src/format.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";

/** The bus to a truck on the page (labor.busToTruck; the director's sprint §19): the card's Send, Staff's targets, who's on the way. */
const ON = { ...GAME_CONFIG, labor: { ...GAME_CONFIG.labor, busToTruck: { ...GAME_CONFIG.labor.busToTruck, enabled: true } } };
// Off by its own key: on in the live levers since 0.25.5.
const OFF = { ...GAME_CONFIG, labor: { ...GAME_CONFIG.labor, busToTruck: { ...GAME_CONFIG.labor.busToTruck, enabled: false } } };

async function stranded(cfg: typeof GAME_CONFIG) {
  const g = await TestGame.create(undefined, undefined, 41, cfg);
  const c = g.join("Bus Freight", "oo", "CMH")!;
  const w = g.w;
  const t = w.trucksByCompany.get(c.id)![0]!;
  const me = w.staff[t.driverId - 1]!;
  unseatDriver(w, me); // off the truck at home
  const far = w.net.hubs.findIndex((_h, i) => hubMiles(w, i, c.homeHub) > 300 && hubMiles(w, i, c.homeHub) < 700);
  Object.assign(t, { hub: far, targetHub: far, place: placeOfHub(far), targetPlace: placeOfHub(far) }); // the truck, empty, elsewhere
  return { g, w, c, t, me };
}

describe("the bus to a truck on the page", () => {
  it("the empty truck's card offers the nearest driver who can ride, priced; once he's on the way, it says who and when", async () => {
    const { g, w, c, t, me } = await stranded(ON);
    const r = busRide(w, me.lastHub!, t.hub);
    const rider = nearestRider(w, c, t)!;
    expect(rider.s.id).toBe(me.id);
    expect(rider.label).toBe(FIXES.sendButton(null, w.net.places[me.lastPlace!]!.name, FIXES.rideDays(r.arriveDays), fdFull(r.fareFd)));
    expect(sendTargets(w, c, me, [t]).map((x) => x.id)).toEqual([t.id]);
    expect(riderLine(w, t)).toBeNull();
    expect(g.act({ type: "send_driver", staffId: me.id, truckId: t.id }).ok).toBe(true);
    expect(riderLine(w, t)).toBe(FIXES.riderOnWay(null, weekday(me.bus!.arriveDay)));
    expect(nearestRider(w, c, t)).toBeNull();
  }, 120_000);

  it("off, nothing is offered", async () => {
    const { w, c, t, me } = await stranded(OFF);
    expect(nearestRider(w, c, t)).toBeNull();
    expect(sendTargets(w, c, me, [t])).toEqual([]);
    expect(riderLine(w, t)).toBeNull();
  }, 120_000);
});
