import { describe, expect, it } from "vitest";
import { companyAccount } from "@lanes/engine";
import { boardRows } from "../src/board.js";
import { cushion, debtCountdown, gapToTruck, nextEvent, nextWeeklyCheckDay } from "../src/figures.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { nextAction } from "../src/nextstep.js";

async function fresh() {
  const g = await TestGame.create();
  const c = g.join("Next Freight", "oo", "LAX")!;
  const truck = g.w.trucksByCompany.get(c.id)![0]!;
  return { g, c, truck };
}

describe("What now? (nextAction), rule by rule", () => {
  it("rule 3: an idle truck with a paying load in reach, ahead of the walkthrough's step", async () => {
    const { g, c, truck } = await fresh();
    const a = nextAction(GAME_CONFIG, g.w, c);
    expect(a.rule).toBe(3);
    if (a.kind !== "idle") throw new Error(a.kind);
    expect(a.truckId).toBe(truck.id);
    expect(a.profitFd).toBeGreaterThan(0);
  }, 60_000);

  it("rule 4: the walkthrough's step once no truck is free", async () => {
    const { g, c, truck } = await fresh();
    const row = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" }).find((r) => !r.block)!;
    expect(g.act({ type: "book_load", truckId: truck.id, loadId: row.l.id }).ok).toBe(true);
    const a = nextAction(GAME_CONFIG, g.w, c);
    expect(a.rule).toBe(4);
  }, 60_000);

  it("rule 2: a truck without a driver, and a tender before it", async () => {
    const { g, c, truck } = await fresh();
    truck.driverId = 0;
    expect(nextAction(GAME_CONFIG, g.w, c)).toMatchObject({ rule: 2, kind: "driver", truckId: truck.id });
    const load = [...g.w.loads.values()].find((l) => l.status === "open")!;
    load.tenderedTo = c.id;
    load.tenderUntil = g.w.t + 600;
    expect(nextAction(GAME_CONFIG, g.w, c)).toMatchObject({ rule: 2, kind: "tender", loadId: load.id });
  }, 60_000);

  it("rule 1: danger outranks everything, with the countdown and a real lever", async () => {
    const { g, c } = await fresh();
    const bal = g.w.ledger.balance(companyAccount(c.id));
    g.w.ledger.post(g.w.t, companyAccount(c.id), "sink:test", bal + g.w.cfg.insolvency.debtLimitFd + 1_000, "test");
    const a = nextAction(GAME_CONFIG, g.w, c);
    if (a.kind !== "danger") throw new Error(a.kind);
    expect(a.debt.under).toBe(true);
    expect(a.debt.nextDay).toBe(nextWeeklyCheckDay(g.w));
    expect(a.lever?.kind).toBe("book");
  }, 60_000);

  it("rule 2: a lost hand bid with a better load beside it, at its usually-clears-near rate; none when nothing beats it", async () => {
    const { g, c, truck } = await fresh();
    const rows = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" }).filter((r) => !r.block);
    const lostLoad = rows[0]!.l;
    const a = nextAction(GAME_CONFIG, g.w, c, { loadId: lostLoad.id, truckId: truck.id, profitAtWinningFd: 0 });
    if (a.kind !== "lost") throw new Error(a.kind);
    expect(a.truckId).toBe(truck.id);
    expect(a.loadId).not.toBe(lostLoad.id);
    expect(a.profitFd).toBeGreaterThan(0);
    // Nothing beside it would have left as much as the lost load at the winning rate: rule 3 as usual.
    expect(nextAction(GAME_CONFIG, g.w, c, { loadId: lostLoad.id, truckId: truck.id, profitAtWinningFd: 1e9 }).rule).toBe(3);
  }, 60_000);

  it("rule 1: invoices due before the deciding check come before selling a truck (QA's guidance replay)", async () => {
    const g = await TestGame.create();
    const c = g.join("Owed Freight", "fleet", "LAX")!;
    // Both trucks busy: no load to book, so the levers are collect, then sell.
    for (const t of g.w.trucksByCompany.get(c.id)!) g.w.manualBids.set(t.id, { loadId: 0, rate: 0 } as never);
    const acct = companyAccount(c.id);
    const short = 10_000;
    g.w.ledger.post(g.w.t, acct, "sink:test", g.w.ledger.balance(acct) + g.w.cfg.insolvency.debtLimitFd + short, "test");
    c.weeksInDebt = 1;
    const before = nextAction(GAME_CONFIG, g.w, c);
    if (before.kind !== "danger") throw new Error(before.kind);
    expect(before.lever?.kind).toBe("sell");
    // An invoice dated before the check that would wind the company up, covering the shortfall: collect, not sell.
    const deciding = before.debt.nextDay + 7 * (before.debt.of - before.debt.n - 1);
    g.w.receivables.push({ id: 999_001, payer: 0, faucet: "faucet:test", payeeId: c.id, amountFd: short + 500, dueDay: deciding, holder: c.id });
    const after = nextAction(GAME_CONFIG, g.w, c);
    if (after.kind !== "danger") throw new Error(after.kind);
    expect(after.lever).toMatchObject({ kind: "collect", byDay: deciding });
    // Due after that check, it can't save the company: selling stays the lever.
    g.w.receivables.at(-1)!.dueDay = deciding + 1;
    const late = nextAction(GAME_CONFIG, g.w, c);
    expect(late.kind === "danger" && late.lever?.kind).toBe("sell");
  }, 60_000);

  it("rule 0: being wound up answers with the restart's day", async () => {
    const { g, c } = await fresh();
    c.liquidatingSince = 10;
    expect(nextAction(GAME_CONFIG, g.w, c)).toEqual({ rule: 0, kind: "liquidating", restartDay: 10 + g.w.cfg.insolvency.restartAfterDays });
  }, 60_000);

  it("rules 5 and 6's figures: the cushion, the gap to the next truck, the countdown and the next event", async () => {
    const { g, c } = await fresh();
    c.weeklySpend = [1_000, 2_000, 3_000, 2_000];
    const cu = cushion(g.w, c);
    expect(cu.avgWeeklyFd).toBe(2_000);
    expect(cu.weeks).toBeCloseTo(Math.max(0, cu.cashFd) / 2_000, 9);
    const gap = gapToTruck(g.w, c);
    expect(gap.holdFd).toBe(g.w.cfg.guide.gapCushionWeeks * 2_000);
    expect(gap.gapFd).toBeCloseTo(Math.max(0, gap.needNowFd - gap.spareFd), 6);
    expect(debtCountdown(g.w, c)).toMatchObject({ n: 0, of: g.w.cfg.insolvency.weeksInDebt, under: false });
    const e = nextEvent(g.w, c);
    expect(e.atMin).toBeGreaterThan(g.w.t);
  }, 60_000);
});
