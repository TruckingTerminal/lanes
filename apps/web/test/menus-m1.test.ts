import "./seed.js";
import { describe, expect, it } from "vitest";
import { dockWaits } from "../src/board.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";

/** Batch M1, the player's pass on the menus (play-2026-11-14-menus.md): what can be checked without a page. */
describe("batch M1", () => {
  it("item 9: the dock line reads the dock at the load's ready time, never before it", async () => {
    const g = await TestGame.create(undefined, undefined, 41, GAME_CONFIG);
    const c = g.join("Dock Freight", "oo", "CMH")!;
    const w = g.w;
    const t = w.trucksByCompany.get(c.id)![0]!;
    const loads = [...w.loads.values()].filter((l) => l.status === "open" && l.readyT !== undefined && l.readyT > w.t + 2 * 1440);
    expect(loads.length).toBeGreaterThan(0);
    for (const l of loads.slice(0, 20)) {
      const d = dockWaits(w, t, l, 100);
      // A dock that opens only after the truck stands there waiting for a ready load: never before it's ready.
      if (d.pickup) expect(d.pickup.openT).toBeGreaterThanOrEqual(l.readyT!);
    }
  }, 120_000);
});
