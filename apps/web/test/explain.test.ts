import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { companyAccount } from "@lanes/engine";
import { boardRows } from "../src/board.js";
import { EXPLAIN } from "../src/copy.js";
import { breakdown, FIRST_MONTH_KEYS } from "../src/explain.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { dueMilestone, history, milestones } from "../src/milestones.js";

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
    // Another company's figure never breaks down its inputs (Intel's row 1).
    expect(breakdown(g.w, c, "intel.creditBand.other", {})).toBeNull();
  }, 60_000);
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
    expect(dueMilestone(g.w, c, s)?.m.key === "monthClose").toBe(false);
    g.w.t = (month - 3) * perDay;
    const before = dueMilestone(g.w, c, (k) => s(k) || k.startsWith("ms:day"))!;
    expect(before).toMatchObject({ phase: "before", m: { key: "monthClose" } });
    seen.add("ms:monthClose:before");
    g.w.t = (month + 1) * perDay;
    const at = dueMilestone(g.w, c, (k) => s(k) || k.startsWith("ms:day") || k.startsWith("ms:slump"))!;
    expect(at).toMatchObject({ phase: "at", m: { key: "monthClose" } });
    seen.add("ms:monthClose:at");
    // Past its window, only the timeline has it.
    g.w.t = (month + win + 1) * perDay;
    expect(dueMilestone(g.w, c, (k) => s(k) || !k.startsWith("ms:monthClose"))).toBeNull();
    expect(history(g.w, c).some((m) => m.key === "monthClose")).toBe(true);
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
