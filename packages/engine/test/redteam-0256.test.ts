import { describe, expect, it } from "vitest";
import { economyConfig, withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { aroundTheClock, companyAccount, createWorld, detentionMinutes, dockHoursAt, dockRule, formCompany, isRoundBoundary, nextOpen, pickupWait, retireCompany, stepHour, type World } from "@lanes/engine";

/**
 * The red team's 0.25.6 figures (redteam-0256-2026-11-16.md), two older holes behind new switches, off: a retired bot's
 * books (insolvency.retireSettlesFully) and detention from the dock's opening (detention.fromOpening).
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const D = LIVE.time.gameMinutesPerDay;
const at = (day: number, hour: number) => day * D + hour * 60; // day 0 is a Monday

describe("a retired bot leaves nothing behind (insolvency.retireSettlesFully)", () => {
  const settles = (on: boolean): EconomyConfig => ({ ...LIVE, insolvency: { ...LIVE.insolvency, retireSettlesFully: on } });
  /** A bot carrier with 10,000 FD in cash and an NPC shipper's invoice of 7,409 FD it holds, due in 11 days. */
  function bot(cfg: EconomyConfig): { w: World; acct: string; id: number } {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 11, keepLedgerEntries: true });
    const c = formCompany(w, { name: "Newark Express", role: "carrier", homeHubId: "DAL", strategy: "fleet:greedy", orders: [], freePath: false });
    const acct = companyAccount(c.id);
    const have = w.ledger.balance(acct);
    if (have < 10_000) w.ledger.post(w.t, "faucet:starting_grant", acct, 10_000 - have, "test");
    else w.ledger.post(w.t, acct, "sink:test", have - 10_000, "test");
    w.receivables.push({ id: w.nextReceivableId++, payer: 0, faucet: "faucet:npc_shipper", payeeId: c.id, amountFd: 7_409, dueDay: 11, holder: c.id });
    retireCompany(w, c, "held");
    return { w, acct, id: c.id };
  }

  it("is off by default, on in the live levers since 0.25.6", () => {
    expect(economyConfig.insolvency.retireSettlesFully).toBe(false);
    expect(LIVE.insolvency.retireSettlesFully).toBe(true);
  });

  it("on: the invoice it holds is paid at the retirement, then its cash goes to sink:retired_cash; nothing posts after", () => {
    const { w, acct, id } = bot(settles(true));
    expect(w.receivables.some((r) => r.holder === id)).toBe(false);
    expect(w.ledger.balance(acct)).toBeCloseTo(0, 6);
    expect(w.ledger.totals.get("sink:retired_cash")).toBe(17_409 * 100); // cents
    const posts = w.ledger.entries.length;
    for (let h = 0; h < 14 * 24; h++) stepHour(w);
    expect(w.ledger.entries.slice(posts).filter((e) => e.from === acct || e.to === acct)).toEqual([]);
    w.ledger.assertBalanced();
  }, 120_000);

  it("off: as before, the invoice stays open and the cash stays in the account", () => {
    const { w, acct, id } = bot(settles(false));
    expect(w.receivables.some((r) => r.holder === id)).toBe(true);
    expect(w.ledger.balance(acct)).toBeCloseTo(10_000, 6);
    expect(w.ledger.totals.get("sink:retired_cash")).toBeUndefined();
  });
});

describe("detention from the dock's opening (detention.fromOpening)", () => {
  /** A first-come van load at a dock that keeps hours (Mon–Fri 07:00–19:00). */
  function vanLoad(cfg: EconomyConfig) {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 18 });
    populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
    do stepHour(w);
    while (!isRoundBoundary(w.t, w.cfg));
    const l = [...w.loads.values()].find((x) => x.status === "open" && dockRule(w, x) === "fcfs" && !aroundTheClock(w, x.originPlace))!;
    expect(dockHoursAt(w, l, "pickup")).toEqual(w.cfg.docks.hours.fcfs);
    return { w, l };
  }

  it("is off by default, on in the live levers since 0.25.6 (the director's §26)", () => {
    expect(economyConfig.detention.fromOpening).toBe(false);
    expect(LIVE.detention.fromOpening).toBe(true);
  });

  it("a truck at the shut dock at Mon 20:00 waits for Tue 07:00: off, all 11 h count; on, none, nor 2 h before a 07:00 opening", () => {
    const off = vanLoad({ ...LIVE, detention: { ...LIVE.detention, fromOpening: false } }); // off by its own key
    const wait = pickupWait(off.w, off.l, at(0, 20));
    expect(wait).toBe(11 * 60);
    expect(nextOpen(off.w, at(0, 20), off.w.cfg.docks.hours.fcfs)).toBe(at(1, 7));
    expect(detentionMinutes(off.w, off.l, "pickup", at(0, 20), wait)).toBe(11 * 60);
    const on = vanLoad({ ...LIVE, detention: { ...LIVE.detention, fromOpening: true } });
    expect(detentionMinutes(on.w, on.l, "pickup", at(0, 20), wait)).toBe(0);
    expect(detentionMinutes(on.w, on.l, "pickup", at(1, 5), pickupWait(on.w, on.l, at(1, 5)))).toBe(0); // Tue 05:00, 2 h early
    // A wait that ran past the opening counts its part past it (the engine has none today: every wait ends at the opening).
    expect(detentionMinutes(on.w, on.l, "pickup", at(1, 5), 4 * 60)).toBe(2 * 60);
  });
});
