import "./seed.js";
import { describe, expect, it } from "vitest";
import type { GameEvent } from "@lanes/engine";
import { boardRows } from "../src/board.js";
import { TestGame } from "../src/game.js";
import { deliveryEtaMin, drivingLeftMin, etaMin, nightStop, payLine, type TruckBefore } from "../src/rolling.js";

/** A test world with your one truck booked on the first load it can take, rolling. */
async function rolling() {
  const g = await TestGame.create();
  const c = g.join("Rolling Freight", "oo", "LAX")!;
  const truck = g.w.trucksByCompany.get(c.id)![0]!;
  const row = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" }).find((r) => !r.block && r.l.miles > 600);
  expect(row).toBeTruthy();
  expect(g.act({ type: "book_load", truckId: truck.id, loadId: row!.l.id }).ok).toBe(true);
  for (let h = 0; h < 48 && truck.status !== "loaded"; h++) g.stepHour();
  return { g, c, truck, load: row!.l };
}

describe("the truck on the road", () => {
  it("reads the ETA, the hours left and tonight's stop without changing the world", async () => {
    const { g, c, truck } = await rolling();
    expect(truck.status).toBe("loaded");
    for (let h = 0; h < 30; h++) {
      const before = JSON.stringify(truck) + JSON.stringify(g.w.sites.map((s) => s.parked));
      const eta = etaMin(g.w, truck, c);
      drivingLeftMin(g.w, truck, c);
      nightStop(g.w, truck, c);
      expect(JSON.stringify(truck) + JSON.stringify(g.w.sites.map((s) => s.parked))).toBe(before);
      expect(eta).toBeGreaterThanOrEqual(g.w.t);
      g.stepHour();
      if (truck.status !== "loaded") break;
    }
  }, 120_000);

  it("gives one delivery ETA from the booking on: after the pickup, never before now, and the rolling ETA once loaded", async () => {
    const g = await TestGame.create();
    const c = g.join("Rolling Freight", "oo", "LAX")!;
    const truck = g.w.trucksByCompany.get(c.id)![0]!;
    const row = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" }).find((r) => !r.block && r.dh > 20 && r.l.miles > 600);
    expect(row).toBeTruthy();
    expect(g.act({ type: "book_load", truckId: truck.id, loadId: row!.l.id }).ok).toBe(true);
    const seen = new Set<string>();
    // Eight days: under delivery windows (on in the live levers since 0.25.0) a load can be ready days after its booking.
    for (let h = 0; h < 24 * 8 && truck.status !== "unloading" && truck.loadId !== null; h++) {
      const before = JSON.stringify(truck);
      const eta = deliveryEtaMin(g.w, truck, c, row!.l);
      expect(JSON.stringify(truck)).toBe(before);
      expect(eta).toBeGreaterThanOrEqual(g.w.t);
      if (truck.status === "toPickup") expect(eta).toBeGreaterThan(etaMin(g.w, truck, c));
      if (truck.status === "loaded") expect(eta).toBe(etaMin(g.w, truck, c));
      seen.add(truck.status);
      g.stepHour();
    }
    expect(seen.has("loaded")).toBe(true);
  }, 120_000);

  it("splits a delivery into a pay line that sums to what reached the company", async () => {
    const { g, c, truck, load } = await rolling();
    let delivered: Extract<GameEvent, { kind: "delivered" }> | null = null;
    g.onEvent((e) => {
      if (e.kind === "delivered" && e.companyId === c.id) delivered = e;
    });
    let before: TruckBefore = { emptyMi: truck.emptyMi, depositFd: truck.depositFd ?? 0 };
    for (let h = 0; h < 24 * 8 && !delivered; h++) {
      before = { emptyMi: truck.emptyMi, depositFd: truck.depositFd ?? 0 };
      g.stepHour();
    }
    expect(delivered).not.toBeNull();
    const d = delivered as unknown as Extract<GameEvent, { kind: "delivered" }>;
    const p = payLine(g.w, truck, load, d.grossFd, d.costFd, before);
    expect(p.load).toBe(d.grossFd);
    expect(p.lessor).toBeCloseTo(d.grossFd * g.w.cfg.costs.npcLeaseShareOfGross, 6);
    // The settlement fee's own line (on in the live levers since 0.25.0) is in the sum.
    expect(p.load - p.fuel - p.tolls - p.driver - p.upkeep - p.lessor - p.settlement - p.held).toBeCloseTo(p.yours, 6);
    expect(p.yours).toBeCloseTo(d.grossFd - d.costFd - p.held, 6);
  }, 120_000);
});
