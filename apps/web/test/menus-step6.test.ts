import "./seed.js";
import { describe, expect, it } from "vitest";
import { COMMODITIES } from "@lanes/data";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { boardWindow, brokerageWindow, FACILITY, facilityWindow, truckWindow } from "../src/screenwindows.js";

/** The menu system, step 6 (studio/specs/menu-system.md §3; UX's picks §3.1): which window each screen shows. */

describe("the per-screen windows (UX §3.1)", () => {
  it("maps every commodity to one of the seven facilities (the producer's approved mapping)", () => {
    const kinds = new Set(["shp-docks", "shp-factory", "shp-coldstore", "shp-produce", "shp-dc", "shp-steel", "shp-lumber"]);
    for (const [i, c] of COMMODITIES.entries()) {
      expect(FACILITY[c.id], c.id).toBeDefined();
      expect(kinds.has(facilityWindow({ commodity: i })), c.id).toBe(true);
    }
    expect(Object.keys(FACILITY).sort()).toEqual(COMMODITIES.map((c) => c.id).sort());
    expect(facilityWindow({ commodity: COMMODITIES.findIndex((c) => c.id === "imports") })).toBe("shp-docks");
    expect(facilityWindow({ commodity: COMMODITIES.findIndex((c) => c.id === "pharma") })).toBe("shp-coldstore");
    expect(facilityWindow({ commodity: 999 })).toBe("dock");
  });

  it("the board is the office by day and the ops room at night; the brokerage grows by stage", () => {
    expect(boardWindow("midday")).toBe("office");
    expect(boardWindow("night")).toBe("bg-board-s2");
    expect([1, 2, 3, 4].map(brokerageWindow)).toEqual(["brk-stage1-kitchen", "brk-stage2-office", "brk-stage3-room", "brk-stage4-floor"]);
    expect(brokerageWindow(9)).toBe("brk-stage4-floor");
  });

  it("the truck card's window follows what the truck is doing, and only the road and the yard carry the rig", async () => {
    const g = await TestGame.create(undefined, undefined, 41, GAME_CONFIG);
    const c = g.join("Window Freight", "oo", "LAX")!;
    const w = g.w;
    const t = w.trucksByCompany.get(c.id)![0]!;
    expect(truckWindow(w, c, t)).toEqual({ name: "yard", rig: true });
    t.status = "repair";
    expect(truckWindow(w, c, t).name).toBe("plan-repair");
    t.status = "idle";
    const d = w.staff[t.driverId - 1]!;
    d.homeUntilDay = Math.floor(w.t / 1440) + 3;
    expect(truckWindow(w, c, t)).toEqual({ name: "plan-hometime", rig: false });
    d.homeUntilDay = null;
    t.status = "unloading";
    expect(truckWindow(w, c, t).name).toBe("dock");
    t.status = "loaded";
    expect(["road-golden", "plan-winter-road", "truckstop", "plan-restarea"]).toContain(truckWindow(w, c, t).name);
  }, 120_000);
});
