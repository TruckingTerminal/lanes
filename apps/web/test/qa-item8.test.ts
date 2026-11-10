import "./seed.js";
import { h } from "preact";
import { describe, expect, it, vi } from "vitest";
import { companyAccount, condition, crewed, hubMiles, placeOfHub } from "@lanes/engine";
import { closedMonths, monthReport, shownReport, type MonthBooks } from "../src/books.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { needs, REBUILD_DUE, stuckTrucks } from "../src/logic.js";
import { S } from "../src/state.js";
import { firstTruckOpen, tabOpen } from "../src/tabs.js";
import { awayIsHere, type Away } from "../src/returncard.js";
import { stepScope } from "../src/walkthrough.js";
import { dismissMilestone, MilestoneLine, milestoneScope } from "../src/ui/Milestones.js";
import { standingLine } from "../src/ui/Walkthrough.js";

/** QA's item 8 replays (qa-item8-2026-11-08.md): each failure that a test can hold, pinned. */

const MILESTONE_KEYS = ["ownTruck", "hiredWeek", "dispatcher", "monthClose", "day28", "firstBoom", "slump", "debt", "day91"];
const allSeen = (sc: string, except: string[] = []) =>
  MILESTONE_KEYS.flatMap((k) => [`ms:${k}:before`, `ms:${k}:at`])
    .filter((k) => !except.includes(k))
    .map((k) => `${sc}|${k}`);

describe("the caption's precedence (QA item 8, failures 1 and 7)", () => {
  it("a standing line has its seconds, then a due milestone takes the caption, and the line comes back after it", async () => {
    const g = await TestGame.create();
    const c = g.join("Precedence Freight", "oo", "LAX")!;
    const today = Math.floor(g.w.t / g.w.cfg.time.gameMinutesPerDay);
    c.firstOwnedTruckDay = today; // the first truck's at line is due…
    g.w.trucksByCompany.get(c.id)![0]!.lease = "owned"; // …a truck owned today (client batch 7: "Your own truck" dates the hand-over, not an order)
    S.game = g;
    S.tab = "fleet";
    S.milestone = null;
    const sc = milestoneScope(g.w, c);
    S.onboard = { ...S.onboard, seen: allSeen(sc, ["ms:ownTruck:at"]) };
    let now = 2e9;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    try {
      const line = h("div", { id: "standing" });
      // Its seconds first: the standing line (the lock's lifting, a step's Next) keeps the caption.
      expect(standingLine(sc, "tut:open", line)).toBe(line);
      expect(S.milestone).toBeNull();
      // Then the due milestone takes its turn, and holds by its button (R10).
      now += GAME_CONFIG.ui.iuliia.showSeconds * 1000 + 1;
      const ms = standingLine(sc, "tut:open", line);
      expect(ms).not.toBe(line);
      expect(S.milestone).toMatchObject({ key: "ownTruck", phase: "at" });
      // Answered or dismissed, the standing line comes back, unmarked: nothing else is due (the milestone's seen mark is
      // written in a microtask, as the page's next render would find it).
      await Promise.resolve();
      dismissMilestone();
      expect(standingLine(sc, "tut:open", line)).toBe(line);
      expect(S.onboard.seen).not.toContain(`${sc}|tut:open`);
    } finally {
      clock.mockRestore();
      S.milestone = null;
      S.game = null;
    }
  }, 60_000);

  it("a held line before its date retires once the date comes, and the at line follows", async () => {
    const g = await TestGame.create();
    const c = g.join("Before Freight", "oo", "LAX")!;
    const perDay = g.w.cfg.time.gameMinutesPerDay;
    const today = Math.floor(g.w.t / perDay);
    S.game = g;
    S.tab = "fleet";
    // The month's close came while its before line was held (QA: "The weekly check is Jan 28…" on Jan 29). The company
    // is dated back first: the scope carries its start day, and the world's warm week may hold a boom or a slump.
    c.createdDay = today - 30;
    const sc = milestoneScope(g.w, c);
    S.onboard = { ...S.onboard, seen: allSeen(sc, ["ms:monthClose:at"]) };
    let now = 3e9;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    try {
      S.milestone = { key: "monthClose", phase: "before", tab: "fleet", at: now, held: true };
      expect(MilestoneLine()).toBeNull();
      expect(S.milestone).toBeNull();
      now += 61_000;
      expect(MilestoneLine()).not.toBeNull();
      expect(S.milestone).toMatchObject({ key: "monthClose", phase: "at" });
    } finally {
      clock.mockRestore();
      S.milestone = null;
      S.game = null;
    }
  }, 60_000);
});

describe("the Dealer opens when Iuliia points at it (QA item 8, failure 2)", () => {
  it("opens on day 28 for a company that hears the line, not before; the line before it has no button while it's locked", async () => {
    const g = await TestGame.create();
    const c = g.join("Dealer Freight", "oo", "LAX")!;
    const perDay = g.w.cfg.time.gameMinutesPerDay;
    const ladder = g.w.cfg.unlockLadder;
    if (!ladder.enabled && !ladder.beta.enabled) return;
    const d28 = ladder.layers.businesses.afterDays;
    const t0 = g.w.t;
    S.game = g;
    S.tab = "fleet";
    S.milestone = null;
    const sc = milestoneScope(g.w, c);
    S.onboard = { ...S.onboard, seen: allSeen(sc, ["ms:day28:before"]) };
    let now = 4e9;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    try {
      g.w.t = (d28 - 2) * perDay + 600;
      expect(firstTruckOpen(g.w, c)).toBe(false);
      expect(tabOpen("market", g.w, c)).toBe(false);
      // Day 28's line before its date: no "See the Dealer" while the Dealer is a teaser.
      expect(MilestoneLine()).not.toBeNull();
      expect(S.milestone).toMatchObject({ key: "day28", phase: "before", held: false });
      g.w.t = d28 * perDay + 600;
      expect(tabOpen("market", g.w, c)).toBe(true);
      expect(tabOpen("finance", g.w, c)).toBe(true);
      // A company that began after the line's window never hears it: it waits for the first-truck step.
      c.createdDay = d28 + g.w.cfg.guide.milestoneWindowDays + 1;
      g.w.t = (c.createdDay + 1) * perDay;
      expect(firstTruckOpen(g.w, c)).toBe(false);
    } finally {
      g.w.t = t0;
      clock.mockRestore();
      S.milestone = null;
      S.game = null;
    }
  }, 60_000);
});

describe("Needs you counts only what can be done now (QA item 8, failures 6, 8, 9, 10)", () => {
  it("a rebuild is an item only when due and affordable, and ranks after the rest; a driverless truck isn't stuck", async () => {
    const g = await TestGame.create();
    const c = g.join("Badge Freight", "fleet", "LAX")!;
    S.game = g;
    try {
      const trucks = g.w.trucksByCompany.get(c.id)!;
      const owned = trucks.find((t) => t.lease === "owned" && crewed(t))!;
      const life = g.w.cfg.wear.lifeMiles;
      // 81% condition, both rebuilds left: allowed (rebuildMaxCondition), not due.
      owned.milesSinceRebuild = life * 0.19;
      expect(condition(g.w.cfg, owned)).toBeGreaterThan(REBUILD_DUE);
      expect(needs().some((n) => n.key === `rebuild:${owned.id}`)).toBe(false);
      // Due, with the cash to pay: an item, after everything else in the list.
      owned.milesSinceRebuild = life * 0.5;
      const acct = companyAccount(c.id);
      g.w.ledger.post(g.w.t, "faucet:test", acct, 200_000, "test");
      const list = needs();
      expect(list.at(-1)?.key).toBe(`rebuild:${owned.id}`);
      // Due, without the cash (the confirm card's button would be disabled): not an item.
      g.w.ledger.post(g.w.t, acct, "sink:test", g.w.ledger.balance(acct) - 100, "test");
      expect(needs().some((n) => n.key === `rebuild:${owned.id}`)).toBe(false);
      // The empty seat's truck, idle for days, is the seat's item, never "Let the dispatcher bid".
      const seat = trucks.find((t) => !crewed(t));
      if (seat) {
        seat.idleSinceT = g.w.t - 5 * g.w.cfg.time.gameMinutesPerDay;
        expect(stuckTrucks().some((t) => t.id === seat.id)).toBe(false);
        expect(needs().some((n) => n.key === `idle:${seat.id}`)).toBe(false);
      }
    } finally {
      S.game = null;
    }
  }, 60_000);

  it("the badge's Send home goes through R6's card past the share of cash", async () => {
    const g = await TestGame.create();
    const c = g.join("Tired Freight", "oo", "LAX")!;
    S.game = g;
    S.tab = "fleet";
    S.confirm = null;
    try {
      const t = g.w.trucksByCompany.get(c.id)!.find((x) => crewed(x))!;
      const d = g.w.staff[t.driverId - 1]!;
      // Out past the road days, idle far from home, with little cash: the run home is over the share.
      d.awayDays = g.w.cfg.fatigue.roadDays + 1;
      const far = g.w.net.hubs.map((_, i) => i).sort((a, b) => hubMiles(g.w, c.homeHub, b) - hubMiles(g.w, c.homeHub, a))[0]!;
      t.hub = far;
      t.place = placeOfHub(far); // a truck stands in a town of its market: the empty run home is priced from there
      t.status = "idle";
      const acct = companyAccount(c.id);
      g.w.ledger.post(g.w.t, acct, "sink:test", g.w.ledger.balance(acct) - 50, "test");
      const item = needs().find((n) => n.key === `tired:${t.id}`)!;
      expect(item).toBeDefined();
      item.run!();
      expect(S.confirm).not.toBeNull();
      expect(d.wantsHome).toBe(false); // nothing sent until the card's confirm
    } finally {
      S.confirm = null;
      S.game = null;
    }
  }, 60_000);
});

describe("the month report's rows add up as shown (QA item 8, failure 13)", () => {
  it("rows sum to earned and spent, kept is their difference, and the cash path lands on cash at the close, in whole FD", () => {
    const m: MonthBooks = {
      fromDay: 0,
      closedDay: 29,
      cashStart: 1000.4,
      cashEnd: 0,
      owedStart: 0,
      owedEnd: 500.4,
      goodsOwedStart: 0,
      goodsOwedEnd: 0,
      payStart: 0,
      payEnd: 0,
      // Rows whose halves each round up alone: 3 × 0.5 more than the total.
      flows: { loads: 1000.5, detention: 200.5, fuel: -300.5, wages: -100.5, tolls: -50.5, bought: -400.4 },
      loadedMi: 0,
      emptyMi: 0,
      drawStart: 0,
      drawEnd: 0,
      loads: 1,
      onTime: 1,
    };
    const raw = monthReport(m);
    m.cashEnd = raw.cashStart + raw.keptFd - raw.owedChange + raw.payChange + raw.moved.reduce((s, x) => s + x.fd, 0);
    const r = shownReport(monthReport(m));
    const sum = (xs: { fd: number }[]) => xs.reduce((s, x) => s + x.fd, 0);
    for (const x of [...r.earned, ...r.spent, ...r.moved]) expect(Number.isInteger(x.fd)).toBe(true);
    expect(sum(r.earned)).toBe(r.earnedFd);
    expect(sum(r.spent)).toBe(r.spentFd);
    expect(r.keptFd).toBe(r.earnedFd - r.spentFd);
    expect(r.cashStart + r.keptFd - r.owedChange + r.payChange + sum(r.moved)).toBe(r.cashEnd);
  });

  it("holds on a real month: the books' first close for a fleet", async () => {
    const g = await TestGame.create();
    const c = g.join("Shown Freight", "fleet", "DAL")!;
    for (let h = 0; h < 34 * 24 && closedMonths(g.w, c).length < 1; h++) g.stepHour();
    const r = shownReport(monthReport(closedMonths(g.w, c)[0]!));
    const sum = (xs: { fd: number }[]) => xs.reduce((s, x) => s + x.fd, 0);
    expect(sum(r.earned) - sum(r.spent)).toBe(r.keptFd);
    expect(r.cashStart + r.keptFd - r.owedChange + r.payChange + sum(r.moved)).toBe(r.cashEnd);
  }, 300_000);
});

describe("the return card is its own world's (QA item 8, failure 16)", () => {
  it("shows only for the world and company it was kept for", async () => {
    const g = await TestGame.create();
    const c = g.join("Return Freight", "oo", "LAX")!;
    const here: Away = { scope: stepScope(g.w, c), live: false, delivered: 0, inFd: 0, outFd: 0, late: 0, tickets: 0, month: null, breakdowns: 0, backT: g.w.t };
    expect(awayIsHere(here, g.w, c)).toBe(true);
    expect(awayIsHere({ ...here, scope: "1:2:3" }, g.w, c)).toBe(false);
    expect(awayIsHere(null, g.w, c)).toBe(false);
  }, 60_000);
});
