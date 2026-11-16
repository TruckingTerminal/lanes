import "./seed.js";
import { describe, expect, it } from "vitest";
import type { EconomyConfig } from "@lanes/config";
import { aroundTheClock, canMake, dayOf, dockRule, freeOf, type Load, type Truck, type World } from "@lanes/engine";
import { FIXES } from "../src/copy-fixes.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { agreement, shutDockOpens, whenAt } from "../src/windowsui.js";

/** QA's 0.25.6 pass (qa-0256-2026-11-16.md): the sheet's "delivers about" at a Friday-evening dock, and the card at a shut one. */
const D = 24 * 60;
/** The first day after today that falls on weekday `wd` (0 Monday … 6 Sunday). */
const next = (w: World, wd: number): number => {
  let d = dayOf(w.t, w.cfg) + 1;
  while ((d + w.cfg.time.weekdayOfDay0) % 7 !== wd) d++;
  return d;
};

async function scene() {
  const g = await TestGame.create(undefined, undefined, 41, GAME_CONFIG);
  const c = g.join("Friday Freight", "oo", "LAX")!;
  const w = g.w;
  const truck = w.trucksByCompany.get(c.id)![0]!;
  return { w, truck };
}

describe("QA's 0.25.6 pass", () => {
  it("item 2: a load ready Fri 18:00 at a dock that shuts at 19:00 delivers on the sheet as it's run, loaded at 18:00", async () => {
    const { w, truck } = await scene();
    const base = [...w.loads.values()].find((l) => l.status === "open" && l.latestPickupT !== undefined && l.hot === 0 && dockRule(w, l) === "fcfs" && !aroundTheClock(w, l.originPlace))!;
    const fri = next(w, 4);
    // The truck waits at the shipper's town from 04:00; the load is ready at 18:00, an hour before the dock shuts.
    w.t = fri * D + 4 * 60;
    truck.place = base.originPlace;
    truck.hub = base.origin;
    const l: Load = { ...base, readyT: fri * D + 18 * 60, latestPickupT: fri * D + 30 * 60, latestDeliveryT: (fri + 10) * D };
    const asBefore = canMake(w, truck, l); // the switch off: the margin counts from the ready time, so it loads Monday
    const asRun = canMake(w, truck, l, freeOf(w, truck, true));
    expect(asBefore.ok).toBe(true);
    expect(asRun.ok).toBe(true);
    expect(asRun.deliverT).toBeLessThan(asBefore.deliverT - 2 * D); // the weekend the old plan lost
    expect(asRun.deliverT).toBeGreaterThan(l.readyT!);
    // The sheet shows the run's figures; the yes stays the engine's.
    const a = agreement(w, truck, l, l.bookNow, 1)!;
    const line = a.lines[a.kinds.indexOf("truck")]!;
    expect(line).toContain(`delivers about ${whenAt(w, asRun.deliverT, true)}`);
    expect(a.spareMin).toBe(l.latestDeliveryT! - asRun.deliverT);
    // windows.marginFromArrival on: the engine's own plan agrees with the sheet.
    const was = w.cfg;
    const on: EconomyConfig = { ...was, windows: { ...was.windows!, marginFromArrival: true } };
    (w as { cfg: EconomyConfig }).cfg = on;
    expect(canMake(w, truck, l).deliverT).toBe(asRun.deliverT);
    // An arrival within the margin of the close still counts the dock closed: at 18:30 it loads Monday, as before.
    w.t = fri * D + 18 * 60 + 30;
    const late = canMake(w, truck, l);
    (w as { cfg: EconomyConfig }).cfg = was;
    expect(late.deliverT).toBe(canMake(w, truck, l).deliverT);
    expect(late.deliverT).toBeGreaterThan((fri + 3) * D + 7 * 60);
  }, 120_000);

  it("the card at a receiver shut when the truck came: waiting for the opening, then unloading", async () => {
    const { w, truck } = await scene();
    const l = [...w.loads.values()].find((x) => dockRule(w, x) === "fcfs" && !aroundTheClock(w, x.destPlace))!;
    const t: Truck = { ...truck, status: "unloading", loadId: l.id };
    const sun = next(w, 6);
    l.arrivedT = sun * D + 20 * 60;
    w.t = l.arrivedT + 60;
    expect(shutDockOpens(w, t)).toBe((sun + 1) * D + 7 * 60);
    expect(FIXES.waitingForDock("Provo", "Mon 07:00")).toBe("Waiting at Provo for the dock to open Mon 07:00");
    w.t = (sun + 1) * D + 7 * 60; // open: unloading
    expect(shutDockOpens(w, t)).toBeNull();
    l.arrivedT = (sun + 1) * D + 10 * 60; // came in open hours
    w.t = l.arrivedT + 30;
    expect(shutDockOpens(w, t)).toBeNull();
    expect(shutDockOpens(w, { ...t, status: "loaded" })).toBeNull();
  }, 120_000);
});
