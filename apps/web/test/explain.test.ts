import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { cashNowRate, companyAccount, truckValue } from "@lanes/engine";
import { boardRows } from "../src/board.js";
import { EXPLAIN } from "../src/copy.js";
import { breakdown, FIRST_MONTH_KEYS } from "../src/explain.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { dueMilestone, history, milestones } from "../src/milestones.js";
import { stepDo, stepText, walkSteps } from "../src/walkthrough.js";
import { S } from "../src/state.js";
import { milestoneHeld, MilestoneLine, milestoneScope } from "../src/ui/Milestones.js";

/** Keys the writer's table names that no first-month screen shows yet, each with why. The test fails if one appears. */
const NOT_ON_A_SCREEN: Record<string, string> = {
  "truck.hosLeft": "no screen shows a driver's hours left today yet",
  "pay.fuelTax": "the monthly fuel tax shows only on Economy (the dev panel), not on a first-month screen",
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

describe("help on every figure (explain.ts)", () => {
  it("every first-month figure key is on a screen as a Fig, or listed with a reason", () => {
    const ui = sources(join(__dirname, "../src/ui"))
      .filter((p) => !p.endsWith("Explain.tsx"))
      .map((p) => readFileSync(p, "utf8"))
      .join("\n");
    // A key counts where a tappable figure names it: k="key", or a quoted key passed on to one (a ternary, a row helper).
    const wired = (k: string) => ui.includes(`"${k}"`);
    const missing = FIRST_MONTH_KEYS(GAME_CONFIG).filter((k) => !wired(k) && !(k in NOT_ON_A_SCREEN));
    expect(missing).toEqual([]);
    for (const k of Object.keys(NOT_ON_A_SCREEN)) expect(wired(k), `${k} is on a screen now: take it off the list`).toBe(false);
  });

  it("every entry has what it is and what moves it; another company's has no how", () => {
    for (const [k, e] of Object.entries(EXPLAIN(GAME_CONFIG))) {
      expect(e.what.length, k).toBeGreaterThan(0);
      expect(e.moves.length, k).toBeGreaterThan(0);
      if (k.endsWith(".other")) expect(e.how, k).toBe("");
    }
  });

  it("the break-even's parts add up to the board's break-even, and the profit chip's to its profit", async () => {
    const g = await TestGame.create();
    const c = g.join("Explain Freight", "oo", "LAX")!;
    const truck = g.w.trucksByCompany.get(c.id)![0]!;
    const rows = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" }).filter((r) => !r.block).slice(0, 5);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const ctx = { loadId: r.l.id, truckId: truck.id };
      const be = breakdown(g.w, c, "truck.breakEven", ctx)!;
      expect(be.total.value).toBe(`${r.be.toFixed(2)}/mi`);
      const p = breakdown(g.w, c, "board.profitChip", ctx)!;
      expect(p.total.value).toBe(`${r.profitBook < 0 ? "−" : ""}${Math.round(Math.abs(r.profitBook)).toLocaleString("en-US")} FD`);
    }
    // The truck's worth: rows from the price new to the figure on the Fleet card.
    const g2 = await TestGame.create();
    const fleet = g2.join("Value Freight", "fleet", "DAL")!;
    const owned = g2.w.trucksByCompany.get(fleet.id)!.find((t) => t.lease === "owned")!;
    const v = breakdown(g2.w, fleet, "truck.value", { truckId: owned.id })!;
    expect(v.total.value).toBe(`${Math.round(truckValue(g2.w, owned)).toLocaleString("en-US")} FD`);
    const num = (s: string) => Number(s.replace("−", "-").replace(/[^0-9-]/g, ""));
    expect(Math.abs(v.rows.reduce((a, r) => a + num(r.value), 0) - truckValue(g2.w, owned))).toBeLessThanOrEqual(v.rows.length);
    // Another company's figure never breaks down its inputs (Intel's row 1).
    expect(breakdown(g.w, c, "intel.creditBand.other", {})).toBeNull();
  }, 60_000);
});

describe("the walkthrough's board step", () => {
  it("ticks for a fleet whose dispatcher books from the start, once a truck has a load (QA's guidance replay)", async () => {
    const g = await TestGame.create();
    const c = g.join("Fleet Freight", "fleet", "LAX")!;
    const board = walkSteps(GAME_CONFIG).find((s) => s.id === "board")!;
    expect(board.done(g.w, c)).toBe(false);
    for (let h = 0; h < 48 && !board.done(g.w, c); h++) g.stepHour();
    expect(c.firstHandBidDay).toBeNull();
    expect(board.done(g.w, c)).toBe(true);
  }, 120_000);
});

describe("the walkthrough's words for a fleet that owns its trucks", () => {
  it("drops the lessor from the paid step when the company has no lessor's truck (QA)", async () => {
    const paid = walkSteps(GAME_CONFIG).find((s) => s.id === "paid")!;
    const g = await TestGame.create();
    const fleet = g.join("Owner Freight", "fleet", "LAX")!;
    // No lessor pays it, takes a share or holds anything back toward a truck.
    const wrong = /lessor sees|lessor's share|the hold/;
    for (const line of [stepText(paid, g.w, fleet).brief, ...stepText(paid, g.w, fleet).say, stepDo(paid, g.w, fleet)]) expect(line).not.toMatch(wrong);
    const g1 = await TestGame.create();
    const leased = g1.join("Lease Freight", "oo", "LAX")!;
    expect(stepText(paid, g1.w, leased).brief).toMatch(/lessor sees/);
  }, 60_000);
});

describe("milestone lines queue", () => {
  it("says two due on one day one after the other, each its seconds, each marked seen as it shows (QA)", async () => {
    const g = await TestGame.create();
    const c = g.join("Queue Freight", "fleet", "LAX")!;
    const perDay = g.w.cfg.time.gameMinutesPerDay;
    const today = Math.floor(g.w.t / perDay);
    // Two due today: the first owned truck's at line, and a driver hired today (the payday's before line).
    c.firstOwnedTruckDay = today;
    const d = g.w.staff.find((s) => s.companyId === c.id && s.kind === "driver")!;
    d.owner = false;
    d.hiredDay = today;
    S.game = g;
    S.tab = "fleet";
    S.milestone = null;
    const sc = milestoneScope(g.w, c);
    S.onboard = { ...S.onboard, seen: ["ms:monthClose:before", "ms:day28:before", "ms:day91:before", "ms:slump:at", "ms:debt:before"].map((k) => `${sc}|${k}`) };
    let now = 1e9;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    try {
      expect(MilestoneLine()).not.toBeNull();
      expect(S.milestone).toMatchObject({ key: "ownTruck", phase: "at" });
      await Promise.resolve();
      expect(S.onboard.seen).toContain(`${sc}|ms:ownTruck:at`);
      expect(S.onboard.seen).not.toContain(`${sc}|ms:hiredWeek:before`);
      // Its seconds pass: the next due follows at once, without waiting out the quiet time.
      now += GAME_CONFIG.ui.iuliia.showSeconds * 1000 + 1;
      expect(MilestoneLine()).not.toBeNull();
      expect(S.milestone).toMatchObject({ key: "hiredWeek", phase: "before" });
      await Promise.resolve();
      expect(S.onboard.seen).toContain(`${sc}|ms:hiredWeek:before`);
      // A new world in the same browser (QA's replays): the last world's record doesn't silence this one's lines.
      const g2 = await TestGame.create();
      const c2 = g2.join("Queue Freight", "fleet", "LAX")!;
      c2.firstOwnedTruckDay = Math.floor(g2.w.t / perDay);
      S.game = g2;
      S.milestone = null;
      now += GAME_CONFIG.ui.iuliia.showSeconds * 1000 + 61_000;
      expect(MilestoneLine()).not.toBeNull();
      expect(S.milestone).toMatchObject({ key: "ownTruck", phase: "at" });
    } finally {
      clock.mockRestore();
      S.milestone = null;
      S.game = null;
    }
  }, 60_000);
});

describe("a milestone line's hold", () => {
  it("keeps the caption for ui.iuliia.showSeconds on its tab, then lets go", () => {
    S.tab = "fleet";
    S.milestone = { key: "ownTruck", phase: "at", tab: "fleet", at: performance.now() };
    expect(milestoneHeld()).toBe(true);
    S.milestone.at = performance.now() - GAME_CONFIG.ui.iuliia.showSeconds * 1000 - 1;
    expect(milestoneHeld()).toBe(false);
    S.milestone = { key: "ownTruck", phase: "at", tab: "money", at: performance.now() };
    expect(milestoneHeld()).toBe(false);
    S.milestone = null;
  });
});

describe("milestones (milestones.ts)", () => {
  it("derived from the world: the month close's before line inside the window, the at line once it's past, each once", async () => {
    const g = await TestGame.create();
    const c = g.join("Milestone Freight", "oo", "LAX")!;
    const perDay = g.w.cfg.time.gameMinutesPerDay;
    const win = g.w.cfg.guide.milestoneWindowDays;
    const seen = new Set<string>();
    const s = (k: string) => seen.has(k);
    const month = c.createdDay + 30;
    // Before the window: no month-close line.
    expect(milestones(g.w, c).find((m) => m.key === "monthClose")).toMatchObject({ day: month, happened: false });
    g.w.t = (month - win - 1) * perDay;
    expect(dueMilestone(g.w, c, (k) => s(k) || !k.startsWith("ms:monthClose"))).toBeNull();
    g.w.t = (month - 3) * perDay;
    // Only the month close: the world's own slump or payday may be due too, by its seed.
    const only = (k: string) => s(k) || !k.startsWith("ms:monthClose");
    const before = dueMilestone(g.w, c, only)!;
    expect(before).toMatchObject({ phase: "before", m: { key: "monthClose" } });
    seen.add("ms:monthClose:before");
    g.w.t = (month + 1) * perDay;
    const at = dueMilestone(g.w, c, only)!;
    expect(at).toMatchObject({ phase: "at", m: { key: "monthClose" } });
    seen.add("ms:monthClose:at");
    // Past its window, only the timeline has it.
    g.w.t = (month + win + 1) * perDay;
    expect(dueMilestone(g.w, c, (k) => s(k) || !k.startsWith("ms:monthClose"))).toBeNull();
    expect(history(g.w, c).some((m) => m.key === "monthClose")).toBe(true);
  }, 60_000);

  it("the first payday speaks before, then on its day only; the debt check warns ahead", async () => {
    const g = await TestGame.create();
    const c = g.join("Payday Freight", "oo", "LAX")!;
    const perDay = g.w.cfg.time.gameMinutesPerDay;
    const only = (key: string) => (k: string) => !k.startsWith(`ms:${key}:`);
    const today = Math.floor(g.w.t / perDay);
    const driver = g.w.staff.find((s) => s.companyId === c.id && s.kind === "driver")!;
    driver.owner = false;
    driver.hiredDay = today;
    const pay = today + ((6 - (today % 7) + 7) % 7);
    if (pay > today) expect(dueMilestone(g.w, c, only("hiredWeek"))).toMatchObject({ phase: "before", m: { key: "hiredWeek", day: pay } });
    g.w.t = pay * perDay + 60;
    expect(dueMilestone(g.w, c, only("hiredWeek"))).toMatchObject({ phase: "at", m: { key: "hiredWeek" } });
    g.w.t = (pay + 1) * perDay + 60;
    expect(dueMilestone(g.w, c, only("hiredWeek"))).toBeNull();
    expect(history(g.w, c).some((m) => m.key === "hiredWeek")).toBe(true);
    // Under the line before any check in debt: the next check's day, ahead.
    const bal = g.w.ledger.balance(companyAccount(c.id));
    g.w.ledger.post(g.w.t, companyAccount(c.id), "sink:test", bal + g.w.cfg.insolvency.debtLimitFd + 1_000, "test");
    expect(dueMilestone(g.w, c, only("debt"))).toMatchObject({ phase: "before", m: { key: "debt" } });
  }, 60_000);

  it("a missed before line is dropped, never shown late; the debt run dates from its first check", async () => {
    const g = await TestGame.create();
    const c = g.join("Late Freight", "oo", "LAX")!;
    const perDay = g.w.cfg.time.gameMinutesPerDay;
    g.w.t = (c.createdDay + 31) * perDay;
    const due = dueMilestone(g.w, c, (k) => !k.startsWith("ms:monthClose"));
    expect(due).toMatchObject({ phase: "at", m: { key: "monthClose" } });
    // In debt at two weekly checks: the run began at the check a week before the last.
    const bal = g.w.ledger.balance(companyAccount(c.id));
    g.w.ledger.post(g.w.t, companyAccount(c.id), "sink:test", bal + g.w.cfg.insolvency.debtLimitFd + 1_000, "test");
    c.weeksInDebt = 2;
    const debt = milestones(g.w, c).find((m) => m.key === "debt")!;
    expect((debt.day! + 1) % 7).toBe(0);
    expect(debt.day).toBeLessThan(Math.floor(g.w.t / perDay) - 6);
  }, 60_000);
});

describe("cash it now's figures (explain.ts)", () => {
  it("break down to the engine's rate: the fee, and what lands today", async () => {
    const pay = GAME_CONFIG.token.payment as { enabled: boolean; cashNow: { enabled: boolean } };
    const was = [pay.enabled, pay.cashNow.enabled];
    pay.enabled = true;
    pay.cashNow.enabled = true;
    try {
      const g = await TestGame.create();
      const c = g.join("Cash Freight", "fleet", "LAX")!;
      const today = Math.floor(g.w.t / g.w.cfg.time.gameMinutesPerDay);
      const r = { id: 999_101, payer: 0, faucet: "faucet:test", payeeId: c.id, amountFd: 2_380, dueDay: today + 19, holder: c.id };
      g.w.receivables.push(r);
      const rate = cashNowRate(g.w, c, r) as number;
      expect(typeof rate).toBe("number");
      const fee = breakdown(g.w, c, "invoice.cashNowFee", { invoiceId: r.id })!;
      const lands = breakdown(g.w, c, "invoice.cashNowLands", { invoiceId: r.id })!;
      expect(fee.total.value).toBe(`${Math.round(2_380 * rate).toLocaleString("en-US")} FD`);
      expect(lands.total.value).toBe(`${Math.round(2_380 * (1 - rate)).toLocaleString("en-US")} FD`);
      // Own-company or player paper has no breakdown: it can't be cashed.
      expect(breakdown(g.w, c, "invoice.cashNowFee", { invoiceId: 123_456 })).toBeNull();
    } finally {
      [pay.enabled, pay.cashNow.enabled] = was as [boolean, boolean];
    }
  }, 60_000);
});
