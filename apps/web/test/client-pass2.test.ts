import "./seed.js";
import { describe, expect, it } from "vitest";
import { companyAccount } from "@lanes/engine";
import { PENDING } from "../src/copy-pending.js";
import { exitsFor, paysFrom } from "../src/exits.js";
import { firstTruckLine, gapToTruck } from "../src/figures.js";
import { fdFull } from "../src/format.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { freshOnboard } from "../src/onboard.js";
import { markKey, markVisited, S, visited } from "../src/state.js";
import { firstTruckAffordable } from "../src/tabs.js";
import { reloadTarget } from "../src/version.js";
import { stepKey } from "../src/walkthrough.js";

/** Client pass 2 (2026-11-09): QA's replay of the diaries' batch and the writer's pass. */

describe("client pass 2 on one world", () => {
  it("keeps the seen and visited marks per world, gives one first-truck figure, and counts a hub's loads once", async () => {
    const g = await TestGame.create();
    const c = g.join("Pass Two Freight", "oo", "LAX")!;
    const w = g.w;
    S.game = g;
    const kept = S.onboard;
    try {
      // (1) A tab visited, the board's first visit and Money's held note are this company's in this world.
      S.onboard = freshOnboard();
      expect(visited("market")).toBe(false);
      markVisited("market");
      markVisited("board");
      expect(visited("market")).toBe(true);
      expect(visited("board")).toBe(true);
      expect(markKey("money:held")).toBe(stepKey(w, c, "money:held"));
      // Another company in the same browser (a replaced world starts a company afresh) sees none of them.
      const day = c.createdDay;
      c.createdDay = day + 1;
      expect(visited("market")).toBe(false);
      expect(visited("board")).toBe(false);
      expect(markKey("money:held")).not.toBe(stepKey(w, { ...c, createdDay: day }, "money:held"));
      c.createdDay = day;

      // (2) The one figure: the cheapest truck's cash on the day less the player's cash, never a cushion.
      const acct = companyAccount(c.id);
      const gap = gapToTruck(w, c);
      expect(Number.isFinite(gap.needNowFd)).toBe(true);
      expect(gap.gapFd).toBeCloseTo(Math.max(0, gap.needNowFd - w.ledger.balance(acct)), 6);
      // Client batch 8a item 57: the card is named for what it prices, the cash still to find with the cushion counted.
      let f = firstTruckLine(w, c)!;
      if (f.open !== null) expect(f.figure).toBe(f.met ? PENDING.soundTitle : PENDING.soundName(fdFull(Math.round(f.gapFd))));
      // A week of spending known: the cushion is under Why, and the gap's own figure doesn't move.
      c.weeklySpend = [1_000];
      f = firstTruckLine(w, c)!;
      if (f.open !== null) expect(f.why.some((x) => x.includes("I'd keep back"))).toBe(true);
      expect(gapToTruck(w, c).gapFd).toBe(gap.gapFd);
      expect(gapToTruck(w, c).holdFd).toBe(GAME_CONFIG.guide.gapCushionWeeks * 1_000);
      // The Dealer opens on the same figure: short, closed; the cash met, open and "You can buy today".
      w.t += 1;
      expect(firstTruckAffordable(w, c)).toBe(gap.gapFd <= 0);
      w.ledger.post(w.t, "faucet:test", acct, gap.gapFd + 1, "test");
      w.t += 1;
      expect(firstTruckAffordable(w, c)).toBe(true);
      // Client batch 8a item 57: the card's own test is the cushion after too, so it may still read "Not yet".
      const met = firstTruckLine(w, c)!;
      if (met.open !== null) expect(met.met ? met.figure : met.verdict).toMatch(met.met ? /^A sound first truck$/ : /^Not yet: /);

      // (6) One count of a hub's paying loads: the ways-out sheet's exits and Send empty's list read paysFrom.
      const truck = w.trucksByCompany.get(c.id)![0]!;
      for (const e of exitsFor(w, c, truck)) expect(e.pays).toBe(paysFrom(w, c, truck, e.hub));
    } finally {
      S.onboard = kept;
      S.game = null;
    }
  }, 120_000);
});

describe("client pass 2's strings and the reload rule", () => {
  it("says the draw, plurals the idle lines, says a hub with nothing paying, and home's loads", () => {
    expect(PENDING.idleBidsLosing(1, "dry van")).toMatch(/^1 dry van load in range pays enough,/);
    expect(PENDING.idleBidsLosing(2, "dry van")).toMatch(/^2 dry van loads in range pay enough,/);
    expect(PENDING.idleUnderFloor(1, "reefer", 10)).toMatch(/^1 reefer load in range, and it doesn't cover your floor, break-even \+ 10%,/);
    expect(PENDING.exitTo("Tampa", "120", "150", "3 h", 0)).toMatch(/nothing pays there now$/);
    expect(PENDING.exitHome("1,059", "1,300", "1 day", 3)).toMatch(/· 3 loads pay there$/);
    // Pass 2b: "A gamble" first, what it pays, then what beats it; no odds.
    expect(PENDING.bidGamble("41", "18:00", "4.52")).toBe("A gamble: pays 41 FD more than Book now if it wins at 18:00. Until then anyone can book it at 4.52/mi, and at 18:00 a lower bid, a nearer truck or a better record can beat yours.");
    expect(PENDING.bidGamble("41", "18:00", "4.52")).not.toMatch(/%/);
    expect(PENDING.idleReasonHeldDraw("2,109", "1,510", false, "797", "1,396")).toContain("plus your 797 draw as the driver");
  });

  it("reloads once onto a newer deployed build, never for the same, a local one, or one already tried", () => {
    const here = "https://truckingterminal.github.io/lanes-play/";
    expect(reloadTarget(here, "aaaaaaa", "bbbbbbb", null)).toBe(`${here}?v=bbbbbbb`);
    expect(reloadTarget(`${here}?v=aaaaaaa#x`, "aaaaaaa", "bbbbbbb", null)).toBe(`${here}?v=bbbbbbb#x`);
    expect(reloadTarget(here, "aaaaaaa", "aaaaaaa", null)).toBeNull();
    expect(reloadTarget(here, "local", "bbbbbbb", null)).toBeNull();
    expect(reloadTarget(here, "aaaaaaa", "bbbbbbb", "bbbbbbb")).toBeNull();
    expect(reloadTarget(here, "aaaaaaa", undefined, null)).toBeNull();
  });
});
