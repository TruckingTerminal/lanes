import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, COMMODITIES, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { createWorld, isRoundBoundary, stepHour, transitMinutes, windowHoursOf, type Load, type World } from "@lanes/engine";

/**
 * The director's sprint §18 (windows.windowScale; economy-deadline-gate-2026-11-15.md): "Deliver by" at a multiple of every
 * commodity's windowHours, to the hour, where a load's deadline and appointment are set. The table stays as it is.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const scaled = (scale: number, windows = true): EconomyConfig => ({ ...LIVE, windows: { ...LIVE.windows, enabled: windows, windowScale: scale } });

/** Brokers and no carriers, to the first round's close: the loads it posted, none booked. */
function firstRound(cfg: EconomyConfig): { w: World; loads: Load[] } {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 18 });
  populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
  const loads = [...w.loads.values()].filter((l) => l.postedRound === w.round && l.hot === 0);
  expect(loads.length).toBeGreaterThan(100);
  return { w, loads };
}

describe("windows.windowScale (the director's §18)", () => {
  it("the hours: the table's at 1 or with no key; a quarter, to the hour, at 0.25", () => {
    const { windowScale: _, ...noKey } = LIVE.windows;
    COMMODITIES.forEach((c, i) => {
      expect(windowHoursOf(scaled(1), i)).toBe(c.windowHours);
      expect(windowHoursOf({ ...LIVE, windows: noKey } as EconomyConfig, i)).toBe(c.windowHours);
      expect(windowHoursOf(scaled(0.25), i)).toBe(Math.round(c.windowHours / 4));
    });
    // The gate's figures: produce 9, parcels 6, retail 30.
    const at = (id: string) => windowHoursOf(scaled(0.25), COMMODITIES.findIndex((c) => c.id === id));
    expect([at("produce"), at("parcels"), at("retail")]).toEqual([9, 6, 30]);
  });

  it("windows on: a load's Deliver by is the pickup's close, the legal drive and the scaled hours; the appointment sits inside it", () => {
    for (const scale of [1, 0.25]) {
      const { w, loads } = firstRound(scaled(scale));
      for (const l of loads) {
        const legal = transitMinutes(w.cfg, l.routeHours, w.cfg.hos.drivingHoursPerDay);
        const windowMin = Math.round(COMMODITIES[l.commodity]!.windowHours * scale) * 60;
        expect(l.latestDeliveryT! - l.latestPickupT!).toBeCloseTo(legal + windowMin, 6);
        expect(l.appointmentT).toBeCloseTo(Math.min(l.readyT! + windowMin + legal, l.latestDeliveryT!), 6);
      }
    }
  });

  it("windows off: the appointment is the posting time, the scaled hours and the drive", () => {
    const { w, loads } = firstRound(scaled(0.25, false));
    const posted = new Set(loads.map((l) => Math.round(l.appointmentT - windowHoursOf(w.cfg, l.commodity) * 60 - transitMinutes(w.cfg, l.routeHours, w.cfg.hos.drivingHoursPerDay))));
    expect(posted.size).toBe(1); // one posting time for the round, whatever the commodity
    const today = new Set(loads.map((l) => Math.round(l.appointmentT - COMMODITIES[l.commodity]!.windowHours * 60 - transitMinutes(w.cfg, l.routeHours, w.cfg.hos.drivingHoursPerDay))));
    expect(today.size).toBeGreaterThan(1); // the table's hours don't fit
  });
});
