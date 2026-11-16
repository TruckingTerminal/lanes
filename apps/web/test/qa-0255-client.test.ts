import "./seed.js";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { heldFor, hubMiles, placeOfHub, unseatDriver } from "@lanes/engine";
import { busRowLine, ridingToSeat, seatHeld } from "../src/busui.js";
import { FIXES } from "../src/copy-fixes.js";
import { weekdayDate } from "../src/format.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { attentionItems, needs } from "../src/logic.js";
import { S } from "../src/state.js";

/**
 * QA's 0.25.5 replay (qa-0255-2026-11-15.md, fix soon 1–3): a seat held for a rider on the bus to it is offered nowhere
 * (Staff's hire rows, Needs you, the truck card's no-driver line), a hire for it sends nothing (not the unpark), and the
 * rider's Staff row says where they're riding and when they arrive.
 */
async function riding() {
  const g = await TestGame.create(undefined, undefined, 41, GAME_CONFIG);
  const c = g.join("Rider Freight", "oo", "CMH")!;
  const w = g.w;
  const t = w.trucksByCompany.get(c.id)![0]!;
  const me = w.staff[t.driverId - 1]!;
  unseatDriver(w, me); // off the truck at home
  const far = w.net.hubs.findIndex((_h, i) => hubMiles(w, i, c.homeHub) > 300 && hubMiles(w, i, c.homeHub) < 700);
  Object.assign(t, { hub: far, targetHub: far, place: placeOfHub(far), targetPlace: placeOfHub(far) }); // the truck, empty, elsewhere
  c.delivered = 1; // past the first load, so Staff and the empty seat's items aren't held back
  return { g, w, c, t, me };
}

describe("QA's 0.25.5 replay: the held seat and the rider's row", () => {
  it("Needs you and the attention list leave a held seat out; before the send they offer the hire", async () => {
    const { g, w, t, me } = await riding();
    S.game = g as never;
    try {
      expect(w.cfg.labor.busToTruck.enabled).toBe(true); // live since 0.25.5
      expect(seatHeld(w, t)).toBe(false);
      expect(needs().some((n) => n.key === `driver:${t.id}`)).toBe(true);
      expect(attentionItems().some((n) => n.key === `driver:${t.id}`)).toBe(true);
      expect(g.act({ type: "send_driver", staffId: me.id, truckId: t.id }).ok).toBe(true);
      expect(heldFor(w, t)?.id).toBe(me.id);
      expect(seatHeld(w, t)).toBe(true);
      expect(needs().some((n) => n.key === `driver:${t.id}`)).toBe(false);
      expect(attentionItems().some((n) => n.key === `driver:${t.id}`)).toBe(false);
    } finally {
      S.game = null;
    }
  }, 120_000);

  it("the rider's Staff row: on the bus to the truck's town, arriving; the bus home keeps its line", async () => {
    const { g, w, t, me } = await riding();
    expect(busRowLine(w, me)).toBeNull();
    expect(g.act({ type: "send_driver", staffId: me.id, truckId: t.id }).ok).toBe(true);
    expect(ridingToSeat(me)).toBe(true);
    expect(busRowLine(w, me)).toBe(FIXES.onBusTo(w.net.places[t.place]!.name, weekdayDate(me.bus!.arriveDay)));
    expect(FIXES.onBusTo("Saint Paul", "Sat Jan 20")).toBe("on the bus to Saint Paul · arriving Sat Jan 20");
    const home = { ...me, bus: { ...me.bus!, to: undefined, toHub: undefined, toPlace: undefined } };
    expect(ridingToSeat(home)).toBe(false);
    expect(busRowLine(w, home)).toBe(FIXES.onBus(weekdayDate(me.bus!.arriveDay)));
  }, 120_000);

  it("Staff: a held seat isn't open to a hire or another driver, and a hire for one held since the Confirm runs nothing", () => {
    const src = readFileSync(join(__dirname, "..", "src", "ui", "panels", "Staff.tsx"), "utf8");
    expect(src).toContain("const openSeat = (t: Truck) => !crewed(t) && atHub(t) && !seatHeld(w, t);");
    // The guard comes before the unpark in the Confirm's run.
    const run = src.slice(src.indexOf("const run = () => {"), src.indexOf("hireNow();", src.indexOf("const run = () => {")));
    expect(run.indexOf("seatHeld(w, target)")).toBeGreaterThan(0);
    expect(run.indexOf("seatHeld(w, target)")).toBeLessThan(run.indexOf('type: "unpark_truck"'));
    // The row's ride line and chip, and no "paid with no truck" while riding to a held seat.
    expect(src).toContain("{busRowLine(w, s)}");
    expect(src).toContain("!ridingToSeat(s) ? PENDING.paidNoTruck(");
    const fleet = readFileSync(join(__dirname, "..", "src", "ui", "panels", "Fleet.tsx"), "utf8");
    expect(fleet).toContain("{seatHeld(w, t) ? null : <span class=\"bad small\">{TRUCK.noDriver(truckNo(t.id))}</span>}");
  });
});
