import "./seed.js";
import { describe, expect, it } from "vitest";
import { TestGame } from "../src/game.js";
import { breakdown } from "../src/explain.js";
import { needs, stuckTrucks, wallAt, wallTrucks, waysOut } from "../src/logic.js";
import { RETURN_HOURS, returnFor, saveVisit } from "../src/returncard.js";
import { emptyRun } from "../src/rolling.js";
import { NEEDS } from "../src/copy.js";
import { S } from "../src/state.js";

/** The return sitting's rulings (player5-ux.md, reviews/director-player5.md): R24's prices, R22's wall, R21's rest. */
describe("the return sitting (R21, R22, R24)", () => {
  it("R24: an empty run's price is its parts, and its explanation adds up to the same figure", async () => {
    const g = await TestGame.create();
    const c = g.join("Move Freight", "oo", "DAL")!;
    const t = g.w.trucksByCompany.get(c.id)![0]!;
    const far = g.w.net.hubs.findIndex((_, i) => i !== t.hub && i !== c.homeHub);
    const r = emptyRun(g.w, t, t.hub, far);
    expect(r.costFd).toBeCloseTo(r.parts.fuel + r.parts.wages + r.parts.tolls, 6);
    expect(r.fd).toBe(Math.round(r.costFd).toLocaleString("en-US"));
    const b = breakdown(g.w, c, "move.cost", { truckId: t.id, toHub: far })!;
    expect(b.rows.map((x) => x.label)).toHaveLength(3);
    expect(b.total.value).toBe(`${r.fd} FD`);
  }, 60_000);

  it("R22: a truck at a wall is a Needs-you item from the moment it's idle, with the board's one reason and its ways out", async () => {
    const g = await TestGame.create();
    const c = g.join("Wall Freight", "oo", "DAL")!;
    const t = g.w.trucksByCompany.get(c.id)![0]!;
    S.game = g;
    try {
      // Every open load hot, and the truck a solo driver on legal hours: nothing in reach is its to take.
      for (const l of g.w.loads.values()) if (l.status === "open") l.hot = 1.5;
      const wall = wallAt(t);
      expect(wall.rows).toBeGreaterThan(0);
      // The one reason most loads in reach share, in the engine's order (vetting before a hot load's team).
      expect(wall.reason).not.toBeNull();
      expect(wall.pays).toBe(0);
      expect(typeof wall.same).toBe("boolean");
      expect(wallTrucks().map((x) => x.id)).toEqual([t.id]);
      // Not a day later: no idle hours have passed, and the idle item gives way to the wall's.
      expect(stuckTrucks().some((x) => x.id === t.id)).toBe(false);
      const item = needs().find((n) => n.key === `wall:${t.id}`)!;
      expect(item.button).toBe(NEEDS.waysOut);
      // The writer's two sentences (item 7, NEEDS.stuck: `Truck ${n} is idle at ${place}. ${reason}`): "Truck 1 is idle at
      // Dallas. A hot load needs a team." The reason as the board gives it, its capital and its stop kept.
      expect(item.text).toContain(`. ${wall.reason!}`);
      expect(needs().some((n) => n.key === `idle:${t.id}`)).toBe(false);
      // Until R23, the ways out are the board for this truck, sorted by pay.
      waysOut(t);
      expect(S.boardSortOnce).toBe("pay");
      expect(S.tab).toBe("loads");
      S.boardSortOnce = null;
    } finally {
      S.game = null;
    }
  }, 60_000);

  it("R21: the card knows when the player came back and what broke down meanwhile", async () => {
    const g = await TestGame.create();
    const c = g.join("Back Freight", "oo", "DAL")!;
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
    try {
      saveVisit(g.w, c);
      const saved = JSON.parse(store.get("lanes.lastVisit")!) as { realMs: number };
      for (let h = 0; h < 24; h++) g.stepHour(); // client batch 8b item 60: a game day away
      const back = returnFor(g.w, c, true, saved.realMs)!;
      expect(back.backT).toBe(g.w.t);
      expect(back.breakdowns).toBe(0);
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  }, 60_000);
});
