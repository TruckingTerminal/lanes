import "./seed.js";
import { describe, expect, it } from "vitest";
import { repDelivered, repFailed, type Load } from "@lanes/engine";
import { FIXES } from "../src/copy-fixes.js";
import { pct } from "../src/format.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { reputationLine, reputationRows } from "../src/reputationui.js";

/** Reputation in three parts on the page (reputation.threeParts): the one-line form and the explain sheet's rows. */
const ON = { ...GAME_CONFIG, reputation: { ...GAME_CONFIG.reputation, threeParts: { ...GAME_CONFIG.reputation.threeParts, enabled: true } } };

describe("reputation in three parts on the page", () => {
  it("the one-line form: the safety record, the service failures in order, the loads toward the cap", async () => {
    const g = await TestGame.create(undefined, undefined, 41, ON);
    const c = g.join("Record Freight", "oo", "CMH")!;
    const w = g.w;
    expect(c.reputation).toBeCloseTo(0.945, 9); // no experience yet
    expect(reputationLine(w, c)).toBe(`Reputation ${pct(c.reputation)}: safety record clean · no failures in 90 days · 0 of 30 recent loads`);
    for (let i = 0; i < 46; i++) repDelivered(w, c, { miles: 600, shipperId: null } as unknown as Load, false, false);
    repFailed(w, c, "release");
    repFailed(w, c, "release");
    expect(reputationLine(w, c)).toMatch(/^Reputation \d+%: safety record clean · 2 releases in 90 days · full experience, 30\+ recent loads$/);
    expect(reputationRows(w, c).map((r) => r.label)).toEqual([FIXES.repPartSafety(FIXES.repSafetyClean), FIXES.repPartService("2 releases in 90 days"), FIXES.repPartExperience("full experience, 30+ recent loads")]);
    const off = await TestGame.create(undefined, undefined, 41, GAME_CONFIG);
    const d = off.join("Record Freight", "oo", "CMH")!;
    expect(reputationLine(off.w, d)).toBeNull();
  }, 120_000);

  it("the failures name only the non-zero, late first, then releases, no-shows and claims", () => {
    expect(FIXES.repService(1, 2, 1, 0, 90)).toBe("1 late delivery, 2 releases and a no-show in 90 days");
    expect(FIXES.repService(0, 0, 0, 1, 90)).toBe("a claim in 90 days");
    expect(FIXES.repService(0, 0, 0, 0, 90)).toBe("no failures in 90 days");
    expect(FIXES.repRecord(2, 1)).toBe("2 violations and a crash in two years");
    expect(FIXES.repExperience(1, 30)).toBe("1 of 30 recent loads");
  });
});
