import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { breakEvenPerMile, chargeSettlement, companyAccount, createWorld, HOLDER_NPC_FACTOR, settleReceivable, stepHour, type Receivable, type World } from "@lanes/engine";

/**
 * The settlement fee itself (token.settlementFee; economy-settlement-fee-spec-2026-11-13.md): 1% on the seller of every
 * cleared load and sale between companies, burned as sink:trade_burn; never between one owner's two companies.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const fee = (on: boolean): EconomyConfig => ({ ...LIVE, token: { ...LIVE.token, settlementFee: { enabled: on, share: 0.01 } } });
function world(cfg: EconomyConfig, hours: number): World {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 17 });
  populate(w, { freeOwnerOperators: 30, fleets: 6, brokers: 4 });
  for (let h = 0; h < hours; h++) stepHour(w, ruleBotHook);
  return w;
}

describe("the settlement fee", () => {
  it("charges the seller its share, burned; never itself, never off", () => {
    const on = world(fee(true), 1);
    const [a, b] = on.companies.filter((c) => c.role === "carrier");
    const before = on.ledger.balance(companyAccount(a!.id));
    const burned = on.ledger.totals.get("sink:trade_burn") ?? 0;
    expect(chargeSettlement(on, a!.id, b!.id, 10_000, "test:1")).toBeCloseTo(100, 9);
    expect(on.ledger.balance(companyAccount(a!.id))).toBeCloseTo(before - 100, 6);
    expect(((on.ledger.totals.get("sink:trade_burn") ?? 0) - burned) / 100).toBeCloseTo(100, 6); // the ledger's totals are in cents
    expect(chargeSettlement(on, a!.id, a!.id, 10_000, "test:2")).toBe(0); // not a sale
    expect(chargeSettlement(on, 0, a!.id, 10_000, "test:3")).toBe(0); // the NPC sells: no fee
    const off = world(fee(false), 1);
    expect(chargeSettlement(off, a!.id, b!.id, 10_000, "test:4")).toBe(0);
    on.ledger.assertBalanced();
  }, 120_000);

  it("burns on deliveries as the world runs, and the ledger balances", () => {
    const w = world(fee(true), 3 * 24);
    const burned = w.ledger.totals.get("sink:trade_burn") ?? 0;
    expect(burned).toBeGreaterThan(0);
    expect(w.metrics.days.reduce((s, d) => s + (d.burnByTag.trade_burn ?? 0), 0)).toBeGreaterThan(0);
    w.ledger.assertBalanced();
    // Off, the tag never moves.
    expect(world(fee(false), 3 * 24).ledger.totals.get("sink:trade_burn") ?? 0).toBe(0);
  }, 240_000);

  it("gives the fee back on a player shipper's paper written off, through the same tag, and only to a payee still holding it", () => {
    const w = world(fee(true), 1);
    const [carrier, shipper] = w.companies.filter((c) => c.role === "carrier");
    const acct = companyAccount(carrier!.id);
    const paper = (holder: number): Receivable => {
      const r: Receivable = { id: w.nextReceivableId++, payer: shipper!.id, payeeId: carrier!.id, amountFd: 10_000, dueDay: 0, holder, shipperPaper: true };
      w.receivables.push(r);
      return r;
    };
    // The carrier waits on the shipper's paper, its fee paid at delivery and kept on the paper.
    const held = paper(carrier!.id);
    expect(chargeSettlement(w, carrier!.id, shipper!.id, 10_000, "load:test", held)).toBeCloseTo(100, 9);
    expect(held.fee).toMatchObject({ onFd: 10_000 });
    expect(held.fee!.fd).toBeCloseTo(100, 9);
    const cash = w.ledger.balance(acct);
    const burned = w.ledger.totals.get("sink:trade_burn")!;
    const cost = carrier!.operating.costFd;
    // The shipper is wound up before it pays: the paper is written off, and the fee on it comes back out of the burn.
    shipper!.liquidatingSince = 0;
    settleReceivable(w, held);
    expect(w.ledger.balance(acct)).toBeCloseTo(cash + 100, 6);
    expect((burned - w.ledger.totals.get("sink:trade_burn")!) / 100).toBeCloseTo(100, 6); // cents
    expect(carrier!.operating.costFd).toBeCloseTo(cost - 100, 6);
    w.ledger.assertBalanced();
    // Paper sold to the factor was paid: the loss is the factor's, and no fee comes back.
    const sold = paper(HOLDER_NPC_FACTOR);
    chargeSettlement(w, carrier!.id, shipper!.id, 10_000, "load:test2", sold);
    const after = w.ledger.balance(acct);
    settleReceivable(w, sold);
    expect(w.ledger.balance(acct)).toBeCloseTo(after, 6);
    w.ledger.assertBalanced();
  }, 120_000);

  it("break-even counts it as a share of gross, like the lessor's", () => {
    const spec = { tier: "workhorse" as const, trailer: "van" as const, lease: "npc" as const, odometer: 0, milesSinceRebuild: 0 };
    const off = breakEvenPerMile(fee(false), spec, 4, 500, 50);
    const on = breakEvenPerMile(fee(true), spec, 4, 500, 50);
    const keep = 1 - LIVE.costs.npcLeaseShareOfGross;
    expect(on / off).toBeCloseTo(keep / (keep - 0.01), 9);
  });
});
