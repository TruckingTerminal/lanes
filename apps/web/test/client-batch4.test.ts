import "./seed.js";
import { describe, expect, it } from "vitest";
import { boardRows } from "../src/board.js";
import { lineOf } from "../src/books.js";
import { PENDING } from "../src/copy-pending.js";
import { bestLoad, firstTruckLine, repairsPer, WORN_BELOW } from "../src/figures.js";
import { TestGame } from "../src/game.js";
import { nextAction } from "../src/nextstep.js";
import { GAME_CONFIG } from "../src/game.js";

/** Client batch 4 (2026-11-09): QA's replay of client pass 2, the writer's notes and windows batch 2's leftover. */

describe("client batch 4", () => {
  it("What now? carries the sheet's own call; the books file the windows' claims; the Dealer names what it prices", async () => {
    const g = await TestGame.create();
    const c = g.join("Batch Four Freight", "oo", "LAX")!;
    const w = g.w;
    const truck = w.trucksByCompany.get(c.id)![0]!;

    // (1) Rule 3's line follows board.ts suggestBid for the very load it names: "Bid on" only with a suggestion.
    const a = nextAction(GAME_CONFIG, w, c);
    if (a.kind === "idle") {
      const row = bestLoad(w, c, truck)!;
      expect(row.l.id).toBe(a.loadId);
      expect(a.suggest).toBe(row.suggest);
    }
    expect(boardRows(w, c, truck, { dest: "any", maxDh: 300, query: "" }).length).toBeGreaterThan(0);

    // (8) The books: the windows' claims land on the Claims row, paid or received, from the sink or another company.
    const other = w.companies.find((x) => x.id !== c.id && x.partnerId === undefined)!;
    expect(lineOf(w, c, "sink:service_failure", "claim:late:12", false)).toBe("claims");
    expect(lineOf(w, c, `co:${other.id}`, "claim:noshow:12", false)).toBe("claims");
    expect(lineOf(w, c, `co:${other.id}`, "claim:cancel:12", true)).toBe("claims");

    // (9) The first-truck card names the truck it prices (client batch 8a item 57: under Why, beside one verdict).
    const f = firstTruckLine(w, c)!;
    if (f.open !== null) expect(f.why[0]).toMatch(/^The truck: a (new|used) /);
    const fresh = { tier: "workhorse" as const, trailer: "van" as const, lease: "owned" as const, odometer: 0, milesSinceRebuild: 0 };
    const worn = { ...fresh, odometer: 480_000, milesSinceRebuild: 0.55 * w.cfg.wear.lifeMiles, rebuilds: 1 };
    expect(repairsPer(w, worn)).toBeGreaterThan(repairsPer(w, fresh));
    expect(WORN_BELOW).toBe(0.6);
  }, 120_000);

  it("words the batch's placeholders: Book when no bid is suggested, the catch in figures, home time as the engine does it", () => {
    expect(PENDING.idleBookAction("Pomona", "Windsor")).toBe("Book Pomona to Windsor.");
    expect(PENDING.wornCatch("480k", "48%", "3,100", "10,000")).toBe("The truck I've priced for your first is worn, at 48% condition: expect about 3,100 FD in breakdowns and upkeep every 10,000 miles, and more as it wears. I'd wait for a sounder one.");
    expect(PENDING.homeTimeQueued("400", 2)).toMatch(/within 400 mi of home or has waited 2 days for one\.$/);
    expect(PENDING.newsServiceClaim("noshow", "77", "1,253")).toContain("−1,253 FD");
  });
});
