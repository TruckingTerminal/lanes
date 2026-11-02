import { describe, expect, it } from "vitest";
import { economyConfig as cfg, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { addTruck, applyAction, companyAccount, createWorld, formCompany, type World } from "../src/index.js";
import { cashNowRate, HOLDER_NPC_FACTOR } from "../src/receivables.js";

// Cash now (token.payment.cashNow; studio/reviews/economy-reserve.md).
const net = buildNetwork(hubs, cfg);
const calm: EconomyConfig = { ...cfg, breakdowns: { ...cfg.breakdowns, per1000MiNew: 0 } };
const pay = calm.token.payment;
const on: EconomyConfig = {
  ...calm,
  token: { ...calm.token, staking: { ...calm.token.staking, enabled: true }, payment: { ...pay, enabled: true, cashNow: { ...pay.cashNow, enabled: true }, factoring: { ...pay.factoring, contract: { ...pay.factoring.contract, enabled: true } } } },
};
const k = on.token.payment.cashNow;
const cash = (w: World, id: number) => w.ledger.balance(companyAccount(id));
const company = (w: World, name: string, role: "carrier" | "broker" = "carrier") => formCompany(w, { name, role, homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
const invoice = (w: World, payer: number, payeeId: number, amountFd: number, ageDays: number) => {
  const r = { id: w.nextReceivableId++, payer, faucet: payer === 0 ? "faucet:npc_shipper" : undefined, payeeId, amountFd, dueDay: on.token.payment.termsDays - ageDays, holder: payeeId };
  w.receivables.push(r);
  return r;
};

describe("cash now (token.payment.cashNow)", () => {
  it("is off by default", () => {
    expect(cfg.token.payment.cashNow.enabled).toBe(false);
    const w = createWorld({ cfg: { ...on, token: { ...on.token, payment: { ...on.token.payment, cashNow: { ...k, enabled: false } } } }, net, feeds: neutralFeeds, seed: 1 });
    const c = company(w, "A");
    const r = invoice(w, 0, c.id, 10_000, 0);
    expect(applyAction(w, c.id, { type: "cash_invoice", receivableId: r.id })).toEqual({ ok: false, reason: "cash now isn't open" });
  });

  it("sells an NPC shipper's invoice to the factor today at the spot rate plus the aging surcharge, the fee a sink; once only", () => {
    const w = createWorld({ cfg: on, net, feeds: neutralFeeds, seed: 2, keepLedgerEntries: true });
    const c = company(w, "A");
    const r = invoice(w, 0, c.id, 10_000, 10);
    expect(cashNowRate(w, c, r)).toBeCloseTo(k.spotPct + 10 * k.agingPerDay, 9);
    const before = cash(w, c.id);
    expect(applyAction(w, c.id, { type: "cash_invoice", receivableId: r.id })).toEqual({ ok: true });
    expect(cash(w, c.id) - before).toBeCloseTo(10_000 * (1 - k.spotPct - 10 * k.agingPerDay), 2);
    expect(w.ledger.balance("sink:factoring_fee")).toBeCloseTo(10_000 * (k.spotPct + 10 * k.agingPerDay), 2);
    expect(r.holder).toBe(HOLDER_NPC_FACTOR);
    expect(applyAction(w, c.id, { type: "cash_invoice", receivableId: r.id })).toEqual({ ok: false, reason: "only an open invoice you hold" });
    // The surcharge stops at its cap.
    const old = invoice(w, 0, c.id, 10_000, 29);
    expect(cashNowRate(w, c, old)).toBeCloseTo(k.spotPct + Math.min(k.agingCap, 29 * k.agingPerDay), 9);
    w.ledger.assertBalanced();
  });

  it("charges the contract's rate under a factoring contract, and refuses a player shipper's paper and paper due today", () => {
    const w = createWorld({ cfg: on, net, feeds: neutralFeeds, seed: 3 });
    const c = company(w, "A");
    w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 200_000, "test");
    addTruck(w, c, "owned", "workhorse", "van");
    expect(applyAction(w, c.id, { type: "set_pay_terms", terms: "factor" })).toEqual({ ok: true });
    const r = invoice(w, 0, c.id, 10_000, 0);
    expect(cashNowRate(w, c, r)).toBeCloseTo(c.factoring!.rate!, 9);
    const shipper = company(w, "Player shipper");
    expect(cashNowRate(w, c, invoice(w, shipper.id, c.id, 10_000, 0))).toBe("a player shipper's paper has no bond behind it");
    const broker = company(w, "Broker", "broker");
    expect(typeof cashNowRate(w, c, invoice(w, broker.id, c.id, 10_000, 0))).toBe("number");
    expect(cashNowRate(w, c, invoice(w, 0, c.id, 10_000, on.token.payment.termsDays))).toBe("it falls due today");
  });
});
