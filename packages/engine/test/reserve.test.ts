import { describe, expect, it } from "vitest";
import { economyConfig as cfg, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import {
  applyAction,
  closeSeason,
  companyAccount,
  createWorld,
  creditScore,
  formCompany,
  reserveAccount,
  reserveCapFd,
  reserveFd,
  runDays,
  shelteredFd,
  type World,
} from "../src/index.js";
import { chargeHoldingCost, startLiquidation } from "../src/solvency.js";
import { dailyReserve, weeklyReserve } from "../src/cashReserve.js";

// The Reserve (config cashReserve; studio/reviews/economy-reserve.md).
const net = buildNetwork(hubs, cfg);
const calm: EconomyConfig = { ...cfg, breakdowns: { ...cfg.breakdowns, per1000MiNew: 0 } };
const on: EconomyConfig = { ...calm, cashReserve: { ...calm.cashReserve, enabled: true } };
const rate = on.holdingCost.weeklyRate;

const fund = (w: World, id: number, fd: number) => w.ledger.post(w.t, "faucet:starting_grant", companyAccount(id), fd, "test");
const cash = (w: World, id: number) => w.ledger.balance(companyAccount(id));

/** A carrier with four weeks of 10k spending on its books (a 130k cap at 13 weeks) and 300k of cash. */
function company(seed: number, config = on) {
  const w = createWorld({ cfg: config, net, feeds: neutralFeeds, seed, keepLedgerEntries: true });
  const c = formCompany(w, { name: "Saver", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
  fund(w, c.id, 300_000 - cash(w, c.id));
  c.weeklySpend = [10_000, 10_000, 10_000, 10_000];
  return { w, c };
}

describe("the Reserve (cashReserve.enabled)", () => {
  it("is off by default: no deposits, and nothing changes", () => {
    expect(cfg.cashReserve.enabled).toBe(false);
    expect(cfg.cashReserve.capWeeks).toBe(13);
    expect(cfg.seasonClose.burn).toBe(true);
    const { w, c } = company(1, calm);
    expect(applyAction(w, c.id, { type: "reserve_deposit", fd: 10_000 })).toEqual({ ok: false, reason: "there's no Reserve" });
  });

  it("caps the shelter at thirteen weeks of the company's own spending, read from the week's lowest balance", () => {
    const { w, c } = company(2);
    expect(reserveCapFd(w, c)).toBeCloseTo(130_000, 6);
    expect(applyAction(w, c.id, { type: "reserve_deposit", fd: 200_000 })).toEqual({ ok: true });
    expect(reserveFd(w, c.id)).toBe(200_000);
    // Deposited this week: the check reads the week's low, which was nothing, so none of it is sheltered yet.
    expect(shelteredFd(w, c)).toBe(0);
    const before = reserveFd(w, c.id);
    chargeHoldingCost(w);
    expect(before - reserveFd(w, c.id)).toBeCloseTo(200_000 * rate, 2);
    // Next week the low is the balance: 130k sheltered, the 70k-odd over the cap pays as cash does.
    weeklyReserve(w);
    expect(shelteredFd(w, c)).toBeCloseTo(130_000, 6);
    const held = reserveFd(w, c.id);
    chargeHoldingCost(w);
    expect(held - reserveFd(w, c.id)).toBeCloseTo((held - 130_000) * rate, 2);
    // A dip during the week counts: withdraw 100k and put it back, and the low stays at the dip.
    weeklyReserve(w);
    const top = reserveFd(w, c.id);
    expect(applyAction(w, c.id, { type: "reserve_withdraw", fd: 100_000 })).toEqual({ ok: true });
    expect(applyAction(w, c.id, { type: "reserve_deposit", fd: 50_000 })).toEqual({ ok: true });
    expect(shelteredFd(w, c)).toBeCloseTo(Math.min(130_000, top - 100_000), 2);
    w.ledger.assertBalanced();
  });

  it("red team E3-CAPINFLATE: a refundable lease deposit isn't spending, so it raises neither working capital nor the cap", () => {
    const { w, c } = company(7);
    const acct = companyAccount(c.id);
    const before = w.ledger.outflowCents(acct);
    w.ledger.post(w.t, acct, "sink:lease_deposit", 45_000, `deposit:${c.id}`);
    expect(w.ledger.outflowCents(acct)).toBe(before);
    w.ledger.post(w.t, acct, "sink:fuel", 1_000, "fuel:test");
    expect(w.ledger.outflowCents(acct)).toBe(before + 100_000);
  });

  it("settles a withdrawal into cash the next day, free", () => {
    const { w, c } = company(3);
    expect(applyAction(w, c.id, { type: "reserve_deposit", fd: 50_000 })).toEqual({ ok: true });
    const start = cash(w, c.id);
    expect(applyAction(w, c.id, { type: "reserve_withdraw", fd: 20_000 })).toEqual({ ok: true });
    expect(cash(w, c.id)).toBe(start);
    expect(reserveFd(w, c.id)).toBe(30_000);
    dailyReserve(w); // the same day: still settling
    expect(cash(w, c.id)).toBe(start);
    runDays(w, 2);
    expect(cash(w, c.id) - start).toBeGreaterThan(20_000 - 1_000); // landed, less whatever the day's bills took
    expect(w.ledger.entries.filter((e) => e.from === reserveAccount(c.id) && e.to.startsWith("sink:")).length).toBe(0);
    expect(applyAction(w, c.id, { type: "reserve_withdraw", fd: 1_000_000 })).toEqual({ ok: false, reason: "the Reserve hasn't that much" });
  });

  it("keeps what it shelters through the season close and burns the rest as cash; with the burn off, nothing burns", () => {
    const { w, c } = company(4);
    expect(applyAction(w, c.id, { type: "reserve_deposit", fd: 200_000 })).toEqual({ ok: true });
    weeklyReserve(w);
    closeSeason(w, 1, 364);
    expect(reserveFd(w, c.id)).toBeCloseTo(130_000, 2);
    const off: EconomyConfig = { ...on, seasonClose: { ...on.seasonClose, burn: false } };
    const x = company(5, off);
    expect(applyAction(x.w, x.c.id, { type: "reserve_deposit", fd: 200_000 })).toEqual({ ok: true });
    weeklyReserve(x.w);
    const before = { cash: cash(x.w, x.c.id), reserve: reserveFd(x.w, x.c.id) };
    closeSeason(x.w, 1, 364);
    expect(reserveFd(x.w, x.c.id)).toBe(before.reserve);
    expect(cash(x.w, x.c.id)).toBeCloseTo(before.cash - off.permits.carrierAuthorityFd, 2); // only the season's permit renewal
  });

  it("counts as capital in the credit score, and goes to the creditors with the cash in a liquidation", () => {
    const { w, c } = company(6);
    const other = formCompany(w, { name: "Owed", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
    // Owed 400k on open invoices, against 300k of cash: under the cover, the score drops.
    w.receivables.push({ id: w.nextReceivableId++, payer: c.id, payeeId: other.id, amountFd: 400_000, dueDay: 30, holder: other.id });
    fund(w, c.id, 100_000);
    expect(applyAction(w, c.id, { type: "reserve_deposit", fd: 350_000 })).toEqual({ ok: true });
    const withReserve = creditScore(w, c);
    const w2 = company(6, calm);
    const o2 = formCompany(w2.w, { name: "Owed", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
    w2.w.receivables.push({ id: w2.w.nextReceivableId++, payer: w2.c.id, payeeId: o2.id, amountFd: 400_000, dueDay: 30, holder: o2.id });
    fund(w2.w, w2.c.id, 100_000);
    w2.w.ledger.post(w2.w.t, companyAccount(w2.c.id), "sink:fuel", 350_000, "test"); // the same 50k of cash, nothing beside it
    expect(withReserve).toBeGreaterThan(creditScore(w2.w, w2.c));
    startLiquidation(w, c);
    expect(reserveFd(w, c.id)).toBe(0);
    w.ledger.assertBalanced();
  });
});
