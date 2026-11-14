import "./seed.js";
import { describe, expect, it } from "vitest";
import { dayOf, hubMiles, onTimeBy } from "@lanes/engine";
import { WINDOWS } from "../src/copy-windows.js";
import { MENUS } from "../src/copy-menus.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { atHomeMarket, homeMarketLine, homeNoDrive } from "../src/windowsui.js";

/**
 * The director's three 0.25.1 rulings on the page (director-0250-rulings-2026-11-13.md): the late chips on "Deliver by"
 * (windows.oneDeadline), home is the home market (labor.homeAtOnce), and the due-home words with the dispatcher off
 * (labor.homeNeedsDispatcher). Each switch on and off.
 */
const WIN = { ...GAME_CONFIG, windows: { ...GAME_CONFIG.windows, enabled: true } };
const ON = { ...WIN, windows: { ...WIN.windows, oneDeadline: true }, labor: { ...WIN.labor, homeAtOnce: true, homeNeedsDispatcher: true } };
const OFF = { ...WIN, windows: { ...WIN.windows, oneDeadline: false }, labor: { ...WIN.labor, homeAtOnce: false, homeNeedsDispatcher: false } };

async function started(cfg: typeof ON) {
  const g = await TestGame.create(undefined, undefined, 41, cfg);
  const c = g.join("Home Freight", "oo", "CMH")!;
  return { g, w: g.w, c, t: g.w.trucksByCompany.get(c.id)![0]! };
}

describe("the 0.25.1 rulings on the page", () => {
  it("ruling 1: the late chips read \"Deliver by\" with the rule on, the old due time off", async () => {
    for (const [cfg, on] of [[ON, true], [OFF, false]] as const) {
      const { w } = await started(cfg);
      const l = [...w.loads.values()].find((x) => x.latestDeliveryT !== undefined)!;
      l.dueT = l.latestDeliveryT! - 3 * 24 * 60;
      expect(onTimeBy(w, l)).toBe(on ? l.latestDeliveryT : l.dueT);
    }
  }, 120_000);

  it("ruling 2: home is the market's radius; on days off there, the card names the place and the market", async () => {
    const { w, c, t } = await started(ON);
    const near = w.net.hubs.findIndex((_, i) => i !== c.homeHub && hubMiles(w, i, c.homeHub) <= w.cfg.map.nearbyRadiusMi);
    const far = w.net.hubs.findIndex((_, i) => hubMiles(w, i, c.homeHub) > w.cfg.map.nearbyRadiusMi);
    expect(near).toBeGreaterThanOrEqual(0);
    t.hub = near;
    expect(atHomeMarket(w, c, t)).toBe(true);
    t.hub = far;
    expect(atHomeMarket(w, c, t)).toBe(false);
    t.hub = near;
    const d = w.staff[t.driverId - 1]!;
    d.drivenMinToday = 0;
    d.restDays = 0; // the days off's first day
    d.homeUntilDay = dayOf(w.t, w.cfg) + 5;
    expect(homeMarketLine(w, c, t)).toBe(WINDOWS.homeInMarket(d.owner ? "You're" : `${d.name} is`, w.net.places[t.place]!.name, w.net.hubs[c.homeHub]!.name, 5, false));
    // Batch M2: from the second day on, a count of the days left, not "starting now" again.
    d.restDays = 2;
    d.homeUntilDay = dayOf(w.t, w.cfg) + 3;
    expect(homeMarketLine(w, c, t)).toBe(MENUS.homeDaysLeft(d.owner ? "You're" : `${d.name} is`, w.net.places[t.place]!.name, w.net.hubs[c.homeHub]!.name, 3));
    // Off: home is the home hub itself, and the old line stands.
    const off = await started(OFF);
    off.t.hub = near;
    expect(atHomeMarket(off.w, off.c, off.t)).toBe(false);
    expect(homeMarketLine(off.w, off.c, off.t)).toBeNull();
  }, 120_000);

  it("ruling 3: with the dispatcher off, the due-home words say nobody drives it home; with it on, or the rule off, not", async () => {
    const { w, c } = await started(ON);
    c.orders = c.orders.filter((o) => o.kind !== "bid");
    expect(homeNoDrive(w, c)).toBe(true);
    c.orders = [...c.orders, { kind: "bid", maxDeadheadMi: 300, price: { mode: "breakEvenPlus", pct: 0.1 } } as (typeof c.orders)[number]];
    expect(homeNoDrive(w, c)).toBe(false);
    const off = await started(OFF);
    off.c.orders = off.c.orders.filter((o) => o.kind !== "bid");
    expect(homeNoDrive(off.w, off.c)).toBe(false);
    expect(WINDOWS.homeDueNoDrive("Columbus", true)).toContain("Columbus");
  }, 120_000);
});
