import "./seed.js";
import { describe, expect, it } from "vitest";
import { hubMiles, placeMiles, placeOfHub, placeOrder } from "@lanes/engine";
import { FIXES } from "../src/copy-fixes.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { nextAction } from "../src/nextstep.js";
import { S } from "../src/state.js";
import { handOverAt } from "../src/ui/panels/Showroom.js";

/** The director's sprint §6 on the page (assets.handOverAtTruck): the Confirm says where the truck is; What now? offers the run. */
const ON = { ...GAME_CONFIG, assets: { ...GAME_CONFIG.assets, handOverAtTruck: true } };

describe("the bought truck's hand-over on the page", () => {
  it("before buying, the Confirm says where the truck waits and how far it is from the truck that goes to it", async () => {
    const g = await TestGame.create(undefined, undefined, 41, ON);
    const c = g.join("Hand-over Freight", "oo", "CMH")!;
    const w = g.w;
    const t = w.trucksByCompany.get(c.id)![0]!;
    S.game = g as never;
    try {
      const far = w.net.hubs.findIndex((_h, i) => hubMiles(w, i, c.homeHub) > 120 && hubMiles(w, i, c.homeHub) < 300);
      Object.assign(t, { hub: far, targetHub: far, place: placeOfHub(far), targetPlace: placeOfHub(far) });
      const line = handOverAt(w, c, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: t.lease === "npc" })!;
      // QA's 0.25.4 replay: the town it waits in and the miles from the truck's own town.
      expect(line).toBe(FIXES.handOverAt(w.net.places[placeOfHub(c.homeHub)]!.name, Math.round(placeMiles(w, placeOfHub(far), placeOfHub(c.homeHub))), 1));
      const off = { ...GAME_CONFIG, assets: { ...GAME_CONFIG.assets, handOverAtTruck: false } }; // on in the live levers from 0.25.3
      expect(handOverAt({ ...w, cfg: off } as never, c, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: true })).toBeNull();
    } finally {
      S.game = null;
    }
  }, 120_000);

  it("with the dispatcher off, What now? offers the leased truck's run to its ready replacement", async () => {
    const g = await TestGame.create(undefined, undefined, 41, ON);
    const c = g.join("Hand-over Freight", "oo", "CMH")!;
    const w = g.w;
    const t = w.trucksByCompany.get(c.id)![0]!;
    expect(t.lease).toBe("npc");
    c.orders = c.orders.filter((o) => o.kind !== "bid");
    const far = w.net.hubs.findIndex((_h, i) => hubMiles(w, i, c.homeHub) > 200);
    Object.assign(t, { status: "idle", hub: far, targetHub: far, place: placeOfHub(far), targetPlace: placeOfHub(far), remainingMi: 0, loadId: null });
    placeOrder(w, c, "workhorse", t.trailer, true, "rig", 0);
    expect(nextAction(w.cfg, w, c)).toMatchObject({ kind: "handOver", truckId: t.id, hub: c.homeHub });
    expect(FIXES.handOverGo("185", "3 h")).toBe("Go to the hand-over · about 185 FD · 3 h");
    expect(FIXES.handOverReady("Columbus", "143")).toBe("Your new truck is ready at Columbus, 143 mi away.");
  }, 120_000);
});
