import "./seed.js";
import { describe, expect, it } from "vitest";
import { companyAccount, type Load } from "@lanes/engine";
import { FIXES } from "../src/copy-fixes.js";
import { PENDING } from "../src/copy-pending.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { shortOf } from "../src/ui/Confirm.js";
import { claimLine } from "../src/ui/MonthReport.js";
import { releaseCard, releaseCostFd } from "../src/windowsui.js";

/**
 * QA's 0.25.2 replay (qa-0252-2026-11-15.md), the publish blocker: under windows.claimsInFull the engine takes a release's
 * claim in full, into the red, while the Confirm named it held to the cash and turned RELEASE off. The producer's call: a
 * release may go into debt like any bill, so the Confirm names it in full, reads the true result, says it puts the
 * company into debt, and stays on. With the switch off, as before. And a release's claim goes to no one.
 */
async function at91(claimsInFull: boolean) {
  const cfg = { ...GAME_CONFIG, windows: { ...GAME_CONFIG.windows, claimsInFull } };
  const g = await TestGame.create(undefined, undefined, 41, cfg);
  const c = g.join("Release Freight", "oo", "CMH")!;
  const w = g.w;
  const acct = companyAccount(c.id);
  w.ledger.post(w.t, acct, "sink:test", w.ledger.balance(acct) - 91, "test"); // QA's 91 FD in cash
  const l = { id: 3614, originPlace: 0, destPlace: 1 } as unknown as Load;
  return { w, c, l };
}

describe("the release Confirm under claims in full (QA's 0.25.2 replay)", () => {
  it("on: the full claim, a release that stays on past the cash, and the line that says it goes into debt", async () => {
    const { w, c, l } = await at91(true);
    const card = releaseCard(w, c, l, 503, 1);
    expect(card.costFd).toBe(503);
    expect(shortOf(card, 91)).toBe(0);
    expect(card.intoDebt!("412")).toBe(FIXES.releaseIntoDebt("412"));
    expect(FIXES.releaseIntoDebt("412")).toBe("This puts the company 412 FD into debt: the claim is paid in full, like any bill.");
    expect(releaseCostFd(w, c, 503)).toBe(503);
  }, 120_000);

  it("off: held to the cash as before, with no debt line; any other spend past the cash still turns its act off (R7)", async () => {
    const { w, c, l } = await at91(false);
    const card = releaseCard(w, c, l, 503, 1);
    expect(card.costFd).toBe(91);
    expect(card.intoDebt).toBeUndefined();
    expect(shortOf(card, 91)).toBe(0);
    expect(shortOf({ costFd: 503 }, 91)).toBe(412);
    expect(shortOf({ costFd: null }, 91)).toBe(0);
  }, 120_000);

  it("the live levers have claims in full on (since 0.25.2)", () => {
    expect(GAME_CONFIG.windows.claimsInFull).toBe(true);
  });
});

describe("a release's claim in the month card", () => {
  it("goes to no one: no \"to the poster\"; a late delivery's and a no-show's read as before", () => {
    expect(claimLine({ loadId: 3614, sub: "cancel" }, "503")).toBe("Released load #3614: −503 FD claim.");
    expect(claimLine({ loadId: 3614, sub: "late" }, "503")).toBe(PENDING.newsServiceClaim("late", "3614", "503"));
    expect(claimLine({ loadId: 3614, sub: "noshow" }, "503")).toBe(PENDING.newsServiceClaim("noshow", "3614", "503"));
  });
});
