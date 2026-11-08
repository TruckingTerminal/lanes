import "./seed.js";
import { describe, expect, it } from "vitest";
import { TestGame } from "../src/game.js";
import { needs, rankNeeds, truckDayCostFd, type Need } from "../src/logic.js";
import { S } from "../src/state.js";

/** R9 (player2-ux.md section 3): the red count is only what the player can act on, each with its button, ranked. */
describe("the badge means needs you (R9)", () => {
  it("gives every item a button and an icon, never counts a tab just opened, and ranks what costs a day first", async () => {
    const g = await TestGame.create();
    const c = g.join("Needs Freight", "fleet", "LAX")!;
    S.game = g;
    try {
      const trucks = g.w.trucksByCompany.get(c.id)!;
      // A fleet start's second truck has no driver: Hire, with what the empty seat costs a day.
      const seat = needs().find((n) => n.key.startsWith("driver:"));
      expect(seat).toBeDefined();
      expect(seat!.button).toBe("Hire");
      expect(seat!.riskFdPerDay).toBeGreaterThan(0);
      expect(seat!.text).toContain(`${Math.round(seat!.riskFdPerDay!).toLocaleString("en-US")} FD a day`);
      // A truck broken down on the road: See the truck, with when it's back.
      const crewed = trucks.find((t) => t.driverId > 0)!;
      crewed.breakdownMin = 600;
      const down = needs().find((n) => n.key === `down:${crewed.id}`);
      expect(down?.button).toBe("See the truck");
      expect(down?.dueMin).toBe(g.w.t + 600);
      expect(down?.riskFdPerDay).toBeCloseTo(truckDayCostFd(g.w, c, crewed), 6);
      crewed.breakdownMin = 0;
      for (const n of needs()) {
        expect(n.button.length, n.key).toBeGreaterThan(0);
        expect(n.icon.length, n.key).toBeGreaterThan(0);
        // A tab just opened is More's dot (Rack's navdot), never the count.
        expect(n.key.startsWith("opened:"), n.key).toBe(false);
      }
    } finally {
      S.game = null;
    }
  }, 60_000);

  it("ranks the authority and the company first, then FD at risk a day, then the soonest deadline", () => {
    const n = (key: string, x: Partial<Need>): Need => ({ key, text: key, tab: "fleet", target: "", button: "Go", icon: "fleet", ...x });
    const ranked = rankNeeds([n("late", { dueMin: 900 }), n("cheap", { riskFdPerDay: 10 }), n("soon", { dueMin: 100 }), n("dear", { riskFdPerDay: 140 }), n("safety", { first: true })]);
    expect(ranked.map((x) => x.key)).toEqual(["safety", "dear", "cheap", "soon", "late"]);
  });
});
