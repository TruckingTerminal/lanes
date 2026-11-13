import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { createWorld, nightInTown, stepHour, truckLatLon, type World } from "@lanes/engine";

/**
 * The night in town reaching mid-leg (businesses.parking.stopInTownMidLeg; the director's option 1, the producer
 * 2026-11-13): a day whose hours run out mid-leg with no site ends in the town nearest the truck's point, or the nearest
 * one not ahead of it, the miles there and back counted as driven.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const parking = (midLeg: boolean): EconomyConfig => ({ ...LIVE, businesses: { ...LIVE.businesses, parking: { ...LIVE.businesses.parking, stopInTownMidLeg: midLeg } } });

function world(cfg: EconomyConfig, town: boolean, days: number): World {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 31 });
  populate(w, { freeOwnerOperators: 40, fleets: 10, brokers: 4 });
  if (town) for (const c of w.companies) if (c.role === "carrier") c.nightStop = "town";
  for (let h = 0; h < days * 24; h++) stepHour(w, ruleBotHook);
  return w;
}
const shoulderNights = (w: World) => w.metrics.days.reduce((s, d) => s + d.shoulderNights, 0);

describe("the night in town reaching mid-leg", () => {
  it("picks the town nearest the truck's point, or the nearest not ahead of it, and adds the miles there and back", () => {
    const w = world(parking(true), false, 2);
    const t = w.trucks.find((x) => (x.status === "loaded" || x.status === "repositioning" || x.status === "toPickup") && x.legMiles - x.remainingMi > 20 && x.remainingMi > 50)!;
    expect(t).toBeDefined();
    const [lat, lon] = truckLatLon(w, t);
    const at = t.legMiles - t.remainingMi;
    const { place, offMi } = nightInTown(w, t);
    // The same point on the leg, and both ways counted.
    expect(t.legMiles - t.remainingMi).toBeCloseTo(at, 9);
    expect(offMi).toBeGreaterThanOrEqual(0);
    // Never a town nearer the leg's end than the truck when a nearer-or-level one exists: it's short of the hours.
    const end = w.net.places[t.targetPlace]!;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const toEnd = (p: { lat: number; lon: number }) => (p.lat - end.lat) ** 2 + ((p.lon - end.lon) * cosLat) ** 2;
    const mine = toEnd({ lat, lon });
    const picked = w.net.places[place]!;
    const level = w.net.places.some((p) => toEnd(p) >= mine);
    if (level) expect(toEnd(picked)).toBeGreaterThanOrEqual(mine - 1e-12);
  }, 120_000);

  it("with every carrier choosing the town, fewer nights end on the shoulder; with none choosing it, nothing moves", () => {
    const on = world(parking(true), true, 6);
    const off = world(parking(false), true, 6);
    expect(shoulderNights(on)).toBeLessThan(shoulderNights(off));
    on.ledger.assertBalanced();
    // No bot chooses the town by itself, so the switch alone moves nothing.
    const sum = (w: World) => JSON.stringify({ t: w.t, loads: [...w.loads.values()].map((l) => [l.id, l.status, l.carrierId]), trucks: w.trucks.map((x) => [x.id, x.status, x.place, x.remainingMi]) });
    expect(sum(world(parking(true), false, 3))).toBe(sum(world(parking(false), false, 3)));
  }, 240_000);
});
