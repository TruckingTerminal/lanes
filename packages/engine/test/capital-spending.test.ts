import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { applyAction, companyAccount, createWorld, formCompany, stepHour, type World } from "@lanes/engine";

/**
 * Capital isn't operating spending (ledger.capitalNotSpending; studio/reviews/economy-weekly-spend.md, QA's finding the
 * economy confirmed): a truck, a facility or a business bought, and a listing's fee, leave the week's spending; repairs,
 * loan payments and the rest of running a fleet stay in.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
// The unlock ladder off, so a facility can be bought on day 0 (live, businesses open on day 28 of the beta).
const BASE: EconomyConfig = { ...LIVE, unlockLadder: { ...LIVE.unlockLadder, enabled: false, beta: { ...LIVE.unlockLadder.beta, enabled: false } } };
const ON: EconomyConfig = { ...BASE, ledger: { ...BASE.ledger, capitalNotSpending: true } };

function digest(cfg: EconomyConfig): string {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 20_261_109 });
  populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 6 });
  for (let h = 0; h < 10 * 24; h++) stepHour(w, ruleBotHook);
  const s = JSON.stringify({ t: w.t, next: w.nextLoadId, supply: w.ledger.supply(), books: w.companies.map((c) => [c.id, w.ledger.balance(companyAccount(c.id)), c.delivered, c.onTime, c.operating]), days: w.metrics.days, loads: [...w.loads.values()], trucks: w.trucks });
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}
function buyer(cfg: EconomyConfig) {
  const w: World = createWorld({ cfg, net, feeds: neutralFeeds, seed: 7, keepLedgerEntries: true });
  const c = formCompany(w, { name: "Capital Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 5_000_000, "test");
  const out = () => w.ledger.outflowCents(companyAccount(c.id)) / 100;
  return { w, c, out };
}
const buyLot = (w: World, id: number) => applyAction(w, id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, used: true });

describe("capital isn't operating spending (ledger.capitalNotSpending)", () => {
  it("leaves the ten-day world byte-identical with the key false and absent", () => {
    expect(LIVE.ledger.capitalNotSpending).toBe(false);
    const { ledger: _, ...absent } = LIVE;
    expect(digest(absent as unknown as EconomyConfig)).toBe(digest(LIVE));
  }, 120_000);

  it("off: a truck from the lot counts in the week's spending, its price and tax, as today", () => {
    const { w, c, out } = buyer(BASE);
    const before = out();
    expect(buyLot(w, c.id).ok).toBe(true);
    const paid = w.ledger.entries.filter((e) => e.from === companyAccount(c.id) && e.kind === "sink" && e.ref.startsWith("buy:")).reduce((s, e) => s + e.amount, 0);
    expect(paid).toBeGreaterThan(0);
    expect(out() - before).toBeCloseTo(paid, 2);
  });

  it("on: a truck from the lot, a facility and a listing's fee leave it as it was; a repair and a loan payment still count", () => {
    const { w, c, out } = buyer(ON);
    const acct = companyAccount(c.id);
    const before = out();
    expect(buyLot(w, c.id).ok).toBe(true);
    expect(applyAction(w, c.id, { type: "buy_facility", facility: "warehouse", hubId: "DAL" })).toEqual({ ok: true });
    w.ledger.post(w.t, acct, "sink:market_fee", 250, "listing:9");
    w.ledger.post(w.t, acct, "sink:sales_tax", 600, "listing:9");
    expect(out()).toBeCloseTo(before, 2);
    // Running the fleet stays spending: a repair (billed under its breakdown's ref) and a loan's weekly payment.
    w.ledger.post(w.t, acct, "sink:repairs", 1_200, "breakdown:1");
    w.ledger.post(w.t, acct, "sink:loan_principal", 300, "loan:1");
    w.ledger.post(w.t, acct, "sink:loan_interest", 40, "loan:1");
    expect(out() - before).toBeCloseTo(1_540, 2);
    w.ledger.assertBalanced();
  });
});
