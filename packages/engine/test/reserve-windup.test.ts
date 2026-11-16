import { describe, expect, it } from "vitest";
import { economyConfig as cfg, withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { applyAction, checkSolvency, closeKeepFd, closeSeason, companyAccount, createWorld, formCompany, reserveHeldFd, windUpFd, type World } from "@lanes/engine";

/**
 * The director's sprint §15 (insolvency.countReserve): the weekly winding-up check reads cash plus the Reserve and what's
 * settling out of it, the claims cap's own figure; off, cash alone, as before. And the close's keep, exported for the
 * Reserve card (UX §3.8), is what the close keeps.
 */
const net = buildNetwork(hubs, cfg);
const calm: EconomyConfig = { ...cfg, breakdowns: { ...cfg.breakdowns, per1000MiNew: 0 }, cashReserve: { ...cfg.cashReserve, enabled: true } };
const ON: EconomyConfig = { ...calm, insolvency: { ...calm.insolvency, countReserve: true } };
const fund = (w: World, id: number, fd: number) => w.ledger.post(w.t, "faucet:starting_grant", companyAccount(id), fd, "test");
const take = (w: World, id: number, fd: number) => w.ledger.post(w.t, companyAccount(id), "sink:test", fd, "test");
const cash = (w: World, id: number) => w.ledger.balance(companyAccount(id));

/** A carrier with 10,000 FD in the Reserve and its cash at `cashFd`. */
function company(config: EconomyConfig, cashFd: number) {
  const w = createWorld({ cfg: config, net, feeds: neutralFeeds, seed: 3, keepLedgerEntries: true });
  const c = formCompany(w, { name: "Drawer", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
  fund(w, c.id, 10_000);
  expect(applyAction(w, c.id, { type: "reserve_deposit", fd: 10_000 })).toEqual({ ok: true });
  take(w, c.id, cash(w, c.id) - cashFd);
  expect(cash(w, c.id)).toBeCloseTo(cashFd, 6);
  return { w, c };
}

describe("the winding-up check and the Reserve (insolvency.countReserve)", () => {
  it("on: cash under the line with the Reserve covering it isn't a week in debt, settling FD counted too", () => {
    const { w, c } = company(ON, -3_000);
    expect(windUpFd(w, c)).toBeCloseTo(7_000, 6);
    for (let i = 0; i < 5; i++) checkSolvency(w);
    expect(c.weeksInDebt).toBe(0);
    expect(c.liquidatingSince).toBeNull();
    // On its way to cash, it still counts: it leaves the Reserve at once and lands tomorrow.
    expect(applyAction(w, c.id, { type: "reserve_withdraw", fd: 10_000 })).toEqual({ ok: true });
    expect(reserveHeldFd(w, c.id)).toBeCloseTo(10_000, 6);
    checkSolvency(w);
    expect(c.weeksInDebt).toBe(0);
  });

  it("on: the sum under the line counts, and four checks in a row wind the company up", () => {
    const { w, c } = company(ON, -13_000);
    expect(windUpFd(w, c)).toBeCloseTo(-3_000, 6);
    for (let i = 0; i < 3; i++) checkSolvency(w);
    expect(c.weeksInDebt).toBe(3);
    expect(c.liquidatingSince).toBeNull();
    checkSolvency(w);
    expect(c.liquidatingSince).not.toBeNull();
  });

  it("off: cash alone, as before, whatever the Reserve holds", () => {
    const { w, c } = company(calm, -3_000);
    expect(windUpFd(w, c)).toBeCloseTo(-3_000, 6);
    checkSolvency(w);
    expect(c.weeksInDebt).toBe(1);
    // On in the live levers since 0.25.5 (economy-ruleset-0255-gate-2026-11-15.md).
    expect(withLiveLevers().insolvency.countReserve).toBe(true);
  });

  it("the close's keep, exported for the Reserve card, is what the close keeps", () => {
    const seasons: EconomyConfig = { ...calm, seasonClose: { ...calm.seasonClose, enabled: true, burn: true } };
    for (const [bal, spend] of [
      [300_000, [10_000, 10_000, 10_000, 10_000]],
      [40_000, [1_000]],
      [8_000, [20_000]],
    ] as const) {
      const w = createWorld({ cfg: seasons, net, feeds: neutralFeeds, seed: 4, keepLedgerEntries: true });
      const c = formCompany(w, { name: "Closer", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
      fund(w, c.id, bal - cash(w, c.id));
      c.weeklySpend = [...spend];
      const keep = closeKeepFd(w, c, bal);
      closeSeason(w, 0, 364);
      expect(cash(w, c.id)).toBeCloseTo(keep - seasons.permits.carrierAuthorityFd, 2); // less the season's permit renewal
    }
  });
});
