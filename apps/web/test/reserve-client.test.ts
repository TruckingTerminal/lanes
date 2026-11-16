import "./seed.js";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyAction, companyAccount, dailyReserve, dayOf, weeklyReserve, type Company, type World } from "@lanes/engine";
import { RESERVE } from "../src/copy-reserve.js";
import { debtCountdown } from "../src/figures.js";
import { fdFull, weekday, weekdayDate } from "../src/format.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { S } from "../src/state.js";
import { depositLines, depositSheet, reserveCard, reserveDebtLine, reserveNeed, reservePhase, weekCostsFd, withdrawSheet } from "../src/reserveui.js";
import { reserveLanded } from "../src/ui/ReserveCard.js";

/** The Reserve on Money (UX next-screens §3.8) and the director's §15 on the page: every figure the engine's own. */
const COUNTS = { ...GAME_CONFIG, insolvency: { ...GAME_CONFIG.insolvency, countReserve: true } };
// Cash alone by its own key: countReserve is on in the live levers since 0.25.5.
const CASH = { ...GAME_CONFIG, insolvency: { ...GAME_CONFIG.insolvency, countReserve: false } };
const fund = (w: World, c: Company, fd: number) => w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), fd, "test");
const take = (w: World, c: Company, fd: number) => w.ledger.post(w.t, companyAccount(c.id), "sink:test", fd, "test");
const cash = (w: World, c: Company) => w.ledger.balance(companyAccount(c.id));
const toCash = (w: World, c: Company, fd: number) => (cash(w, c) < fd ? fund(w, c, fd - cash(w, c)) : take(w, c, cash(w, c) - fd));

async function saver(cfg: typeof GAME_CONFIG = GAME_CONFIG) {
  const g = await TestGame.create(undefined, undefined, 41, cfg);
  const c = g.join("Saver Freight", "oo", "CMH")!;
  return { g, w: g.w, c };
}

describe("the Reserve card (UX next-screens §3.8)", () => {
  it("keeps FD from the weekly holding cost in the live world, and from the close in a world with seasons", async () => {
    const { w } = await saver();
    expect(reservePhase(w)).toBe("holding");
    const seasons = await saver({ ...GAME_CONFIG, seasonClose: { ...GAME_CONFIG.seasonClose, enabled: true, burn: true } });
    expect(reservePhase(seasons.w)).toBe("close");
  }, 120_000);

  it("folds on a new company's Money; opens with cash over the free line, and its figures are the engine's", async () => {
    const { w, c } = await saver();
    const first = reserveCard(w, c)!;
    expect(first.open).toBe(false); // the first hour: Money doesn't change
    expect(first.shelterLine).toBe(RESERVE.shelterNone(13));
    toCash(w, c, 300_000);
    c.weeklySpend = [10_000, 10_000, 10_000, 10_000]; // a 130,000 shelter; 40,000 of working capital
    const x = reserveCard(w, c)!;
    expect(x.open).toBe(true);
    expect(x.cap).toBeCloseTo(130_000, 6);
    expect(x.shelterLine).toBe(RESERVE.shelterIs(13));
    expect(x.phaseLine).toBe(RESERVE.phaseHolding("2%"));
    expect(x.roomLine).toBe(RESERVE.roomHolding(fdFull((300_000 - 40_000) * 0.02), fdFull(130_000)));
    expect(x.foot).toEqual([RESERVE.foot, RESERVE.footCounts, RESERVE.footLaunch]); // footCounts: countReserve, live since 0.25.5
    // Put in this week, it's sheltered from the next full week: until then the charge reads it as cash.
    expect(applyAction(w, c.id, { type: "reserve_deposit", fd: 100_000 })).toEqual({ ok: true });
    // UX §3.8's first week: waiting, not over the cap (the cap is 130,000), and the line keyed on the holding cost.
    const wk = reserveCard(w, c)!;
    expect([wk.overCap, wk.waiting, wk.overLine]).toEqual([0, 100_000, null]);
    expect(wk.waitingLine).toBe(RESERVE.firstWeekHolding("100,000", "Monday"));
    weeklyReserve(w);
    const y = reserveCard(w, c)!;
    expect([y.balance, y.sheltered, y.overLine, y.waitingLine]).toEqual([100_000, 100_000, null, null]);
    // Over the cap: only that part is amber.
    expect(applyAction(w, c.id, { type: "reserve_deposit", fd: 50_000 })).toEqual({ ok: true });
    weeklyReserve(w);
    const z = reserveCard(w, c)!;
    expect([z.overCap, z.waiting]).toEqual([20_000, 0]);
    expect(z.overLine).toBe(RESERVE.overShelter("20,000"));
    // A withdrawal settles: its row, the day it lands, and a toast when it does.
    S.game = { w, player: c } as never;
    try {
      expect(reserveLanded()).toBe(0); // the sitting's first look
      expect(applyAction(w, c.id, { type: "reserve_withdraw", fd: 20_000 })).toEqual({ ok: true });
      const today = dayOf(w.t, w.cfg);
      expect(reserveCard(w, c)!.settling.map((s) => s.text)).toEqual([RESERVE.settling("20,000", weekday(today + 1))]);
      expect(reserveLanded()).toBe(0); // on its way
      w.t += w.cfg.time.gameMinutesPerDay;
      dailyReserve(w);
      expect(reserveLanded()).toBe(20_000); // landed: the toast says RESERVE.landed, once
      expect(reserveLanded()).toBe(0);
      expect(RESERVE.landed(fdFull(20_000))).toBe("20,000 FD from the Reserve is in cash.");
      expect(reserveCard(w, c)!.settling).toEqual([]);
    } finally {
      S.game = null;
    }
  }, 120_000);

  it("the deposit sheet: its default and chips, the outcome, the warnings, and why it's off", async () => {
    const { w, c } = await saver();
    toCash(w, c, 300_000);
    c.weeklySpend = [10_000, 10_000, 10_000, 10_000];
    const s = depositSheet(w, c);
    expect(s.dflt).toBe(130_000); // the smaller of the room (130,000) and the cash over working capital (260,000)
    expect(s.chips.map((x) => x.label)).toEqual([RESERVE.chipRoom("130,000"), RESERVE.chipOver("260,000")]);
    expect(s.disabled).toBeNull();
    const ok = depositLines(w, c, 130_000);
    expect(ok.lines).toEqual([RESERVE.depositAfter("170,000", "130,000"), RESERVE.depositFrom]);
    expect(ok.warns).toEqual([]);
    const all = depositLines(w, c, 299_000);
    expect(all.warns).toContain(RESERVE.warnOver(fdFull(299_000 - 130_000)));
    if (weekCostsFd(w, c) > 1_000) expect(all.warns).toContain(RESERVE.warnWeek("1,000", fdFull(weekCostsFd(w, c))));
    c.authority.status = "revoked";
    expect(depositSheet(w, c).disabled).toBe(RESERVE.revoked);
    c.authority.status = "active";
    c.liquidatingSince = dayOf(w.t, w.cfg);
    expect(depositSheet(w, c).disabled).toBe(RESERVE.windingUp);
    c.liquidatingSince = null;
    toCash(w, c, 0);
    expect(depositSheet(w, c).disabled).toBe(RESERVE.noCash);
  }, 120_000);

  it("the withdraw sheet: All, and what cash is short while it's under zero", async () => {
    const { w, c } = await saver();
    toCash(w, c, 50_000);
    expect(applyAction(w, c.id, { type: "reserve_deposit", fd: 40_000 })).toEqual({ ok: true });
    expect(withdrawSheet(w, c).chips.map((x) => x.label)).toEqual([RESERVE.chipAll("40,000")]);
    toCash(w, c, -3_100);
    const s = withdrawSheet(w, c);
    expect(s.chips.map((x) => x.label)).toEqual([RESERVE.chipAll("40,000"), RESERVE.chipShort("3,100")]);
    expect(s.dflt).toBe(3_100);
    expect(s.when).toBe(RESERVE.withdrawWhen(weekday(dayOf(w.t, w.cfg) + 1)));
  }, 120_000);
});

describe("the director's §15 on the page (insolvency.countReserve)", () => {
  async function short(cfg: typeof GAME_CONFIG, cashFd: number) {
    const x = await saver(cfg);
    toCash(x.w, x.c, 10_000);
    expect(applyAction(x.w, x.c.id, { type: "reserve_deposit", fd: 10_000 })).toEqual({ ok: true });
    toCash(x.w, x.c, cashFd);
    return x;
  }

  it("on, cash under zero with the Reserve covering it: the tier-2 line, no countdown, and the foot says the line reads both", async () => {
    const { w, c } = await short(COUNTS, -3_000);
    const n = reserveNeed(w, c)!;
    expect(n).toMatchObject({ key: "reserve:covers", first: false, shortFd: 3_000, text: RESERVE.needCovers("−3,000"), button: RESERVE.needWithdraw("3,000") });
    expect(debtCountdown(w, c).under).toBe(false);
    expect(reserveDebtLine(w, c)).toBeNull();
    expect(reserveCard(w, c)!.foot).toContain(RESERVE.footCounts);
  }, 120_000);

  it("on, the sum under the line: the countdown in the director's words, and the Reserve's item ranks with it", async () => {
    const { w, c } = await short(COUNTS, -13_000);
    const d = debtCountdown(w, c);
    expect(d.under).toBe(true);
    expect(d.shortFd).toBeCloseTo(1_000, 6); // −3,000 together, 1,000 under the −2,000 line
    expect(reserveDebtLine(w, c)).toBe(RESERVE.debtTogether("1,000", "2,000", 0, 4, weekdayDate(d.nextDay), weekdayDate(d.nextDay + 21)));
    // QA's 0.25.5 replay: before the first weekly check, no "week 0 of 4"; the first check and the one that winds it up.
    expect(reserveDebtLine(w, c)).toBe(`Cash and the Reserve together are 1,000 FD under the −2,000 FD line. No weekly check has counted it yet: the first is ${weekdayDate(d.nextDay)}, and four in a row under the line wind the company up on ${weekdayDate(d.nextDay + 21)}.`);
    expect(reserveNeed(w, c)).toMatchObject({ key: "reserve:count", first: true, text: RESERVE.needCount("−13,000", "10,000") });
  }, 120_000);

  it("off: cash alone, as before; the Reserve's item ranks with the count when cash is under the line", async () => {
    const { w, c } = await short(CASH, -3_000);
    expect(debtCountdown(w, c).under).toBe(true);
    expect(reserveDebtLine(w, c)).toBeNull();
    expect(reserveNeed(w, c)).toMatchObject({ key: "reserve:count", first: true });
    expect(reserveCard(w, c)!.foot).not.toContain(RESERVE.footCounts);
    const small = await short(CASH, -500);
    expect(reserveNeed(small.w, small.c)).toMatchObject({ key: "reserve:covers", first: false });
  }, 120_000);

  it("the sheets act at once, with no Confirm, and Money shows the card under what's owed or in its fold", () => {
    const card = readFileSync(join(__dirname, "..", "src", "ui", "ReserveCard.tsx"), "utf8");
    expect(card).not.toContain("confirmAct(");
    expect(card).toContain('act({ type: "reserve_deposit", fd }');
    const money = readFileSync(join(__dirname, "..", "src", "ui", "panels", "Money.tsx"), "utf8");
    expect(money).toContain("{rv?.open ? <ReserveCardView c={c} /> : null}");
    expect(money).toContain("<summary>{RESERVE.fold}</summary>");
  });
});
