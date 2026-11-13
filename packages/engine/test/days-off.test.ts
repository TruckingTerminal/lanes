import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { applyAction, createWorld, dayOf, placeMiles, resting, startHomeTime, stepHour, type Truck, type World } from "@lanes/engine";

/**
 * labor.daysOffFull (the economy's ruling, studio/reviews/economy-bundle-0250-gate.md): the daily check frees a driver at
 * home once the end day has come, so an order of 5 days off gives 5 and fatigue resets at fatigue.resetDays. Off: a day
 * early, as before.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const cfgOf = (full: boolean, extra: Partial<EconomyConfig> = {}): EconomyConfig => ({ ...LIVE, ...extra, labor: { ...LIVE.labor, daysOffFull: full, ...(extra.labor ?? {}) } });
function world(cfg: EconomyConfig): World {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 13 });
  populate(w, { freeOwnerOperators: 20, fleets: 6, brokers: 2 });
  for (let h = 0; h < 30; h++) stepHour(w, ruleBotHook);
  return w;
}
/** A crewed idle truck stood at its company's home hub, its driver sent home for 5 days off now, tired. */
function sendHome(w: World): { t: Truck; d: (typeof w.staff)[number] } {
  const t = w.trucks.find((x) => x.status === "idle" && x.driverId && x.companyId)!;
  const c = w.companies[t.companyId - 1]!;
  c.orders = [...c.orders.filter((o) => o.kind !== "homeTime"), { kind: "homeTime", afterDays: 21, restDays: 5 }];
  t.hub = c.homeHub;
  const d = w.staff[t.driverId - 1]!;
  d.drivenMinToday = 0;
  d.restDays = 0;
  d.fatigue = 0.9;
  startHomeTime(w, c, t);
  return { t, d };
}
/** Whole days the driver spends resting (sampled at noon), stepping without the bots' daily hook. */
function daysOff(w: World, t: Truck): number {
  let n = 0;
  for (let day = 0; day < 8; day++) {
    for (let h = 0; h < 24; h++) {
      stepHour(w);
      if (h === 12 && resting(w, t)) n++;
    }
  }
  return n;
}

describe("the days off kept whole (labor.daysOffFull)", () => {
  it("on: a 5-day order gives 5 days off, and fatigue resets at resetDays 5", () => {
    const w = world(cfgOf(true));
    const { t, d } = sendHome(w);
    const until = d.homeUntilDay!;
    expect(until - dayOf(w.t, w.cfg)).toBe(5);
    let peak = 0;
    let n = 0;
    for (let day = 0; day < 8; day++) {
      for (let h = 0; h < 24; h++) {
        stepHour(w);
        if (h === 12 && resting(w, t)) n++;
        peak = Math.max(peak, d.restDays);
      }
      if (d.restDays >= w.cfg.fatigue.resetDays) expect(d.fatigue).toBe(0);
    }
    expect(n).toBe(5);
    expect(peak).toBeGreaterThanOrEqual(w.cfg.fatigue.resetDays);
  }, 120_000);

  it("off: as before, the driver is freed a day early (4 of 5)", () => {
    const w = world(cfgOf(false));
    const { t } = sendHome(w);
    expect(daysOff(w, t)).toBe(4);
  }, 120_000);

  it("on, rule H's hold sets out only once the days off are over", () => {
    const cfg = cfgOf(true, { windows: { ...LIVE.windows, enabled: true }, labor: { ...LIVE.labor, daysOffFull: true, homeTimeHolds: true } });
    const w = world(cfg);
    const { t, d } = sendHome(w);
    d.owner = false;
    const back = d.homeUntilDay! * w.cfg.time.gameMinutesPerDay;
    const l = [...w.loads.values()].find((x) => x.status === "open" && x.equipment === t.trailer && x.latestPickupT !== undefined && x.tenderedTo === 0 && !x.hold && x.originPlace !== t.place && x.brokerId === null && x.shipperId === null && placeMiles(w, t.place, x.originPlace) <= 300)!;
    l.readyT = back + 12 * 60;
    l.latestPickupT = l.readyT + 24 * 60;
    l.latestDeliveryT = l.latestPickupT + 4 * 24 * 60;
    expect(applyAction(w, t.companyId, { type: "book_load", truckId: t.id, loadId: l.id }).ok).toBe(true);
    let left = -1;
    for (let h = 0; h < 8 * 24 && left < 0; h++) {
      stepHour(w);
      if (t.status !== "idle") left = w.t;
    }
    expect(left).toBeGreaterThanOrEqual(back); // the days off kept, every one
    expect(left).toBeLessThanOrEqual(l.latestPickupT);
    expect(t.loadId).toBe(l.id);
  }, 120_000);
});
