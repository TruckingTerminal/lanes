import "./seed.js";
import { describe, expect, it } from "vitest";
import { lotDeliveryDays, marketMood } from "@lanes/engine";
import { gapToTruck, truckPlace } from "../src/figures.js";
import { TestGame } from "../src/game.js";
import { hubFacts, moodLine, seasonLine } from "../src/hubcard.js";

/** Client batch 6 (2026-11-10): QA's replay of client batch 5 on e017980. */

describe("client batch 6", () => {
  it("names a truck's place one way: the town, with its market where they differ (the Dealer's card and its lists)", async () => {
    const g = await TestGame.create();
    const w = g.w;
    const away = w.net.places.findIndex((p) => p.name !== w.net.hubs[p.market]!.name);
    const atHub = w.net.places.findIndex((p) => p.name === w.net.hubs[p.market]!.name);
    expect(away).toBeGreaterThanOrEqual(0);
    const p = w.net.places[away]!;
    expect(truckPlace(w, away)).toContain(p.name);
    expect(truckPlace(w, away)).toContain(w.net.hubs[p.market]!.name);
    if (atHub >= 0) expect(truckPlace(w, atHub)).toBe(w.net.places[atHub]!.name);
  }, 120_000);

  it("dates the used lot's rig by the engine's own wait for the buyer: a starter replacing its lease queues at the NPC dealer", async () => {
    const g = await TestGame.create();
    const c = g.join("Batch Six Freight", "oo", "LAX")!;
    const w = g.w;
    if (!(w.cfg.usedMarket.npcLot.enabled && w.cfg.assets.enabled && w.usedLot.stock > 0)) return;
    // No listings, so the lot rig is the cheapest truck the figure prices.
    for (const l of w.listings) l.status = "sold" as never;
    const t = gapToTruck(w, c).truck!;
    expect(t.route).toBe("lot");
    const replacing = (w.trucksByCompany.get(c.id) ?? []).some((x) => x.lease === "npc");
    expect(replacing).toBe(true);
    expect(t.arrivesDay).toBe(Math.floor(w.t / w.cfg.time.gameMinutesPerDay) + lotDeliveryDays(w, replacing));
  }, 120_000);

  it("lets a hub's own line lead and says the country's apart, as rates", async () => {
    const g = await TestGame.create();
    const w = g.w;
    const k = w.cfg.rates.news;
    // A boom: the last week's cleared rate 30% over the four weeks before.
    const days = w.metrics.days;
    while (days.length < k.shortDays + k.longDays) days.unshift({ ...days[0]! });
    for (let i = 0; i < days.length; i++) {
      days[i] = { ...days[i]!, cleared: 10, avgClearedRate: i >= days.length - k.shortDays ? 3.9 : 3 };
    }
    expect(marketMood(w).state).toBe("booming");
    const hub = w.net.hubs.findIndex((h) => h.id === "DAL");
    const f = hubFacts(w, hub);
    expect(f.season).toBe(seasonLine(w, hub));
    expect(f.country).toBe(moodLine(w));
    expect(f.country).toMatch(/^Across the country, rates over the last week are up 30%/);
    expect(f.season).not.toContain("country");
  }, 120_000);
});
