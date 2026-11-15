import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { companyAccount, createWorld, stepHour, windUpDormantBrokers, type Company, type World } from "@lanes/engine";

/**
 * The AI brokers that can no longer trade (brokerRisk.windUpDormant, off by default; the economy's condition in
 * economy-broker-windup-2026-11-15.md): wound up after dormantWeeks weekly checks running, the surety premium stopped.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
/** The switch, with the world's own copy of the staking roles (the licence is raised on it after the brokers stake). */
const raise = (cfg: EconomyConfig, on: boolean) =>
  ({ ...cfg, brokerRisk: { ...cfg.brokerRisk, windUpDormant: on }, token: { ...cfg.token, staking: { ...cfg.token.staking, roles: { ...cfg.token.staking.roles } } } }) as EconomyConfig;

/** An AI broker under its licence (staked at 75,000 FD, the licence then raised to 80,000), nothing open, 1,000 FD in cash. */
function dormant(cfg: EconomyConfig): { w: World; b: Company } {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 13, keepLedgerEntries: true });
  populate(w, { freeOwnerOperators: 2, fleets: 0, brokers: 3 });
  const b = w.companies.find((c) => c.role === "broker" && !c.human)!;
  expect(b.stakedFd).toBe(75_000);
  (w.cfg.token.staking.roles as { broker: number }).broker = 80_000;
  const acct = companyAccount(b.id);
  w.ledger.post(w.t, acct, "sink:test", w.ledger.balance(acct) - 1_000, "test");
  expect(b.openBrokerLoads).toBe(0);
  return { w, b };
}
const weeks = (w: World, n: number) => {
  for (let i = 0; i < n; i++) windUpDormantBrokers(w);
};

describe("winding up the AI brokers that can no longer trade (brokerRisk.windUpDormant)", () => {
  it("off: a dormant broker stays on the books", () => {
    const { w, b } = dormant(raise(LIVE, false));
    weeks(w, 12);
    expect(b.retiredDay).toBeUndefined();
    expect(w.brokersWoundUp).toBeUndefined();
  });

  it("on: wound up at the eighth weekly check running, counted once, and its surety premium stops", () => {
    const { w, b } = dormant(raise(LIVE, true));
    weeks(w, 7);
    expect(b.retiredDay).toBeUndefined();
    expect(b.dormantWeeks).toBe(7);
    weeks(w, 1);
    expect(b.retiredDay).toBeDefined();
    // Every AI broker here starts with less cash than the 5,000 FD gap to the raised licence, so all go; each once.
    expect(w.brokersWoundUp!.filter((x) => x.companyId === b.id)).toEqual([{ day: b.retiredDay, companyId: b.id }]);
    const n = w.brokersWoundUp!.length;
    weeks(w, 4);
    expect(w.brokersWoundUp).toHaveLength(n);
    const before = w.ledger.entries.filter((e) => e.ref === `surety:${b.id}`).length;
    for (let h = 0; h < 48; h++) stepHour(w);
    expect(w.ledger.entries.filter((e) => e.ref === `surety:${b.id}`).length).toBe(before);
    w.ledger.assertBalanced();
  }, 60_000);

  it("on: the cash to restake, paper it owes, or a licence restored keeps a broker; a player's brokerage never goes", () => {
    const rich = dormant(raise(LIVE, true));
    rich.w.ledger.post(rich.w.t, "faucet:starting_grant", companyAccount(rich.b.id), 10_000, "test"); // 11,000 ≥ 80,000 − 75,000
    weeks(rich.w, 10);
    expect(rich.b.retiredDay).toBeUndefined();

    const owing = dormant(raise(LIVE, true));
    owing.w.receivables.push({ id: 990_001, payer: owing.b.id, payeeId: owing.w.companies.find((c) => c.role === "carrier")!.id, amountFd: 500, dueDay: 30, holder: 0 });
    weeks(owing.w, 10);
    expect(owing.b.retiredDay).toBeUndefined();

    const dip = dormant(raise(LIVE, true));
    weeks(dip.w, 5);
    dip.b.stakedFd = 80_000; // restaked: the count starts over
    weeks(dip.w, 1);
    expect(dip.b.dormantWeeks).toBeUndefined();
    dip.b.stakedFd = 75_000;
    weeks(dip.w, 7);
    expect(dip.b.retiredDay).toBeUndefined();

    const player = dormant(raise(LIVE, true));
    player.b.human = true;
    weeks(player.w, 10);
    expect(player.b.retiredDay).toBeUndefined();
  });
});
