import { describe, expect, it } from "vitest";
import { economyConfig, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { applyAction, createWorld, formCompany, hubMiles, type World } from "@lanes/engine";

/**
 * R9's Send home when idle (player2-ux.md section 3): with labor.sendHomeWhileMoving on, send_home on a moving truck
 * sets the drivers' standing intent (Staff.wantsHome) and leaves the truck on its job; the dispatcher's home-time rules
 * (standingOrders.ts needsHome, board.ts maybeReposition) take it home once it's idle. Off, as today: it waits until idle.
 */
const net = buildNetwork(hubs, economyConfig);
const withSwitch = (on: boolean): EconomyConfig => ({ ...economyConfig, labor: { ...economyConfig.labor, sendHomeWhileMoving: on } });

function setup(cfg: EconomyConfig) {
  const w: World = createWorld({ cfg, net, feeds: neutralFeeds, seed: 7 });
  const c = formCompany(w, { name: "Home Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
  const t = w.trucksByCompany.get(c.id)![0]!;
  const d = w.staff[t.driverId - 1]!;
  return { w, c, t, d };
}

describe("send home when idle (labor.sendHomeWhileMoving)", () => {
  it("is off by default: a moving truck's send_home is refused and nothing changes", () => {
    expect(economyConfig.labor.sendHomeWhileMoving).toBe(false);
    const { w, c, t, d } = setup(economyConfig);
    t.status = "loaded";
    const r = applyAction(w, c.id, { type: "send_home", truckId: t.id });
    expect(r.ok).toBe(false);
    expect(d.wantsHome).toBe(false);
    expect(t.status).toBe("loaded");
  });

  it("on: a moving truck keeps its job and its driver heads home after it", () => {
    const { w, c, t, d } = setup(withSwitch(true));
    t.status = "loaded";
    const before = { hub: t.hub, target: t.targetHub, remaining: t.remainingMi };
    expect(applyAction(w, c.id, { type: "send_home", truckId: t.id }).ok).toBe(true);
    expect(d.wantsHome).toBe(true);
    expect(t.status).toBe("loaded");
    expect({ hub: t.hub, target: t.targetHub, remaining: t.remainingMi }).toEqual(before);
    // Asked twice, it says so rather than doing it again.
    expect(applyAction(w, c.id, { type: "send_home", truckId: t.id }).ok).toBe(false);
  });

  it("on: an idle truck is sent home at once, as before", () => {
    const { w, c, t, d } = setup(withSwitch(true));
    const away = w.net.hubs.findIndex((_, i) => hubMiles(w, i, c.homeHub) > w.cfg.map.nearbyRadiusMi * 3);
    t.hub = away;
    t.status = "idle";
    expect(applyAction(w, c.id, { type: "send_home", truckId: t.id }).ok).toBe(true);
    expect(d.wantsHome).toBe(true);
    expect(t.status).toBe("repositioning");
    expect(t.targetHub).toBe(c.homeHub);
  });
});
