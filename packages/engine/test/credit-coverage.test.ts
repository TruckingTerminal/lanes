import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { applyAction, companyAccount, createWorld, creditScore, formCompany, type World } from "@lanes/engine";

/**
 * The red team's 0.25.5 low item (redteam-0255-2026-11-15.md; token.credit.coverageNetsReserve): the credit score's
 * coverage read max(0, cash) + the Reserve, so an overdrawn company was scored on its whole Reserve. On, the stake plus
 * max(0, cash + Reserve); off, as before.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const base: EconomyConfig = { ...LIVE, cashReserve: { ...LIVE.cashReserve, enabled: true } };
const withKey = (on: boolean): EconomyConfig => ({ ...base, token: { ...base.token, credit: { ...base.token.credit, coverageNetsReserve: on } } });
const fund = (w: World, id: number, fd: number) => w.ledger.post(w.t, "faucet:starting_grant", companyAccount(id), fd, "test");
const take = (w: World, id: number, fd: number) => w.ledger.post(w.t, companyAccount(id), "sink:test", fd, "test");
const cash = (w: World, id: number) => w.ledger.balance(companyAccount(id));

/** A carrier with `reserveFd` in the Reserve, its cash at `cashFd`, no stake, and 100,000 owed on an open invoice. */
function scored(cfg: EconomyConfig, reserveFd: number, cashFd: number): number {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 5, keepLedgerEntries: true });
  const c = formCompany(w, { name: "Overdrawn", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
  const other = formCompany(w, { name: "Owed", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
  fund(w, c.id, reserveFd);
  expect(applyAction(w, c.id, { type: "reserve_deposit", fd: reserveFd })).toEqual({ ok: true });
  if (cash(w, c.id) > cashFd) take(w, c.id, cash(w, c.id) - cashFd);
  else if (cash(w, c.id) < cashFd) fund(w, c.id, cashFd - cash(w, c.id));
  expect(cash(w, c.id)).toBeCloseTo(cashFd, 6);
  c.stakedFd = 0;
  w.receivables.push({ id: w.nextReceivableId++, payer: c.id, payeeId: other.id, amountFd: 100_000, dueDay: 30, holder: other.id });
  return creditScore(w, c);
}

describe("the credit score's coverage and the Reserve (token.credit.coverageNetsReserve)", () => {
  it("on: an overdraft is set against the Reserve; off, the whole Reserve counts, as before", () => {
    const k = base.token.credit;
    // Cash −50,000 and a Reserve of 60,000: 10,000 netted, under half of the 100,000 owed; 60,000 beside cash, over it.
    const off = scored(withKey(false), 60_000, -50_000);
    const on = scored(withKey(true), 60_000, -50_000);
    expect(on).toBeCloseTo(off - k.coveragePoints, 6);
    // With the cash over zero, the two read the same.
    expect(scored(withKey(true), 30_000, 30_000)).toBeCloseTo(scored(withKey(false), 30_000, 30_000), 6);
    // Overdrawn past the Reserve, the netted capital floors at zero: the one penalty, no more.
    expect(scored(withKey(true), 20_000, -50_000)).toBeCloseTo(on, 6);
  });

  it("is off in the base config and the live levers, and absent reads as off", () => {
    expect(base.token.credit.coverageNetsReserve).toBe(false);
    expect(withLiveLevers().token.credit.coverageNetsReserve).toBe(false);
    const { coverageNetsReserve: _, ...absent } = base.token.credit;
    const noKey = { ...base, token: { ...base.token, credit: absent } } as unknown as EconomyConfig;
    expect(scored(noKey, 60_000, -50_000)).toBeCloseTo(scored(withKey(false), 60_000, -50_000), 6);
  });
});
