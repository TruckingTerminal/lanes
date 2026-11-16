import "./seed.js";
import { describe, expect, it } from "vitest";
import { applyAction, companyAccount, windUpFd, type Company, type World } from "@lanes/engine";
import { FIXES } from "../src/copy-fixes.js";
import { breakdown } from "../src/explain.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";

/** The writer's §15 item 4: the debt countdown's explain rows read cash and the Reserve together with countReserve on. */
const toCash = (w: World, c: Company, fd: number) => {
  const have = w.ledger.balance(companyAccount(c.id));
  if (have < fd) w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), fd - have, "test");
  else if (have > fd) w.ledger.post(w.t, companyAccount(c.id), "sink:test", have - fd, "test");
};

describe("the debt countdown's explain rows", () => {
  it("with countReserve on: cash, the Reserve and what's settling, and the two together; off, cash alone", async () => {
    const g = await TestGame.create(undefined, undefined, 41, GAME_CONFIG);
    const c = g.join("Reserve Freight", "oo", "CMH")!;
    const w = g.w;
    expect(w.cfg.insolvency.countReserve).toBe(true); // live since 0.25.5
    toCash(w, c, 10_000);
    expect(applyAction(w, c.id, { type: "reserve_deposit", fd: 10_000 })).toEqual({ ok: true });
    toCash(w, c, -3_000);
    const rows = breakdown(w, c, "guide.debtCountdown", {} as never)!.rows;
    expect(rows.map((r) => r.label).slice(0, 3)).toEqual(["Cash", FIXES.explainReserveRow, FIXES.explainTogetherRow]);
    expect(windUpFd(w, c)).toBeCloseTo(7_000, 6);
    expect(rows[1]!.value).toBe("10,000 FD"); // the explain sheet's own figures, with their unit
    expect(rows[2]!.value).toBe("7,000 FD");
    const off = await TestGame.create(undefined, undefined, 41, { ...GAME_CONFIG, insolvency: { ...GAME_CONFIG.insolvency, countReserve: false } });
    const c2 = off.join("Reserve Freight", "oo", "CMH")!;
    const labels = breakdown(off.w, c2, "guide.debtCountdown", {} as never)!.rows.map((r) => r.label);
    expect(labels).not.toContain(FIXES.explainReserveRow);
    expect(labels).not.toContain(FIXES.explainTogetherRow);
  }, 120_000);
});
