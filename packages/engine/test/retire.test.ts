import { describe, expect, it } from "vitest";
import { economyConfig, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { applyAction, companyAccount, createWorld, formCompany, generateRoundFreight, refile, restart, retireCompany, runDays, type World } from "@lanes/engine";

// A bot the population dial retires leaves nothing behind (the red team's leak, 2026-11-08, economy-emission.md §16.4):
// retired fleets kept their facilities, which went on shipping at a loss from an overdraft nothing bounded, paid to living
// carriers and never written off. Seasons off here: the close would move every balance in the world.
const cfg: EconomyConfig = { ...economyConfig, seasonClose: { ...economyConfig.seasonClose, enabled: false } };
const net = buildNetwork(hubs, cfg);
const carrier = (w: World, name: string) => formCompany(w, { name, role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
const fund = (w: World, id: number, fd: number) => w.ledger.post(w.t, "faucet:starting_grant", companyAccount(id), fd, "test");
const cents = (w: World, tag: string) => w.ledger.totals.get(tag) ?? 0;

/** Every posting that touches the account from now on. */
function watch(w: World, acct: string): string[] {
  const seen: string[] = [];
  const orig = w.ledger.post.bind(w.ledger);
  (w.ledger as unknown as { post: typeof orig }).post = (t, from, to, amountFd, ref, mode) => {
    if (from === acct || to === acct) seen.push(`${from} → ${to} ${amountFd.toFixed(2)} (${ref})`);
    return orig(t, from, to, amountFd, ref, mode);
  };
  return seen;
}

describe("a retired bot leaves nothing behind", () => {
  it("hands its facility back to the market, forfeits its airdrop, writes off what it owes as a bankruptcy, and its balance never moves again", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 11 });
    const c = carrier(w, "Mill & Haul");
    fund(w, c.id, 60_000);
    const supply = w.facilitySupply.warehouse;
    w.facilities.push({ id: 1, type: "warehouse", ownerId: c.id, hub: 0, equipment: "van", boughtDay: 0, netFd: 0 });
    w.facilitySupply.warehouse--;
    c.airdrop = { totalFd: 10_000, unlockedFd: 0, forfeitedFd: 0, queuedFd: 0, weeksLeft: 26, claimedEarly: false };
    c.autoStaff = true;
    // The facility has shipped: loads of its own stand on the board when the owner goes.
    for (let i = 0; i < 40 && ![...w.loads.values()].some((l) => l.shipperId === c.id); i++) generateRoundFreight(w);
    const own = [...w.loads.values()].filter((l) => l.shipperId === c.id);
    expect(own.length).toBeGreaterThan(0);
    // Deep in the red, as the retired fleets were.
    const acct = companyAccount(c.id);
    w.ledger.post(w.t, acct, "sink:test", w.ledger.balance(acct) + 25_000, "test");
    expect(w.ledger.balance(acct)).toBeCloseTo(-25_000, 6);
    const writtenOff = cents(w, "faucet:bankruptcy_writeoff");
    retireCompany(w, c, "wound down");
    expect(c.retiredDay).toBeDefined();
    expect(w.facilities[0]!.ownerId).toBe(0);
    expect(w.facilitySupply.warehouse).toBe(supply); // the slot is back
    expect(c.airdrop!.weeksLeft).toBe(0);
    expect(c.autoStaff).toBe(false);
    expect(w.ledger.balance(acct)).toBeCloseTo(0, 6);
    expect(cents(w, "faucet:bankruptcy_writeoff") - writtenOff).toBe(25_000 * 100); // tagged, so it shows as a faucet
    expect(c.bankruptcies).toBe(1);
    // Its loads on the board are the NPC market's now: still there, with no shipper, so a delivery pays from the shipper faucet.
    expect(own.every((l) => w.loads.has(l.id) && l.shipperId === null)).toBe(true);
    // Then two months of the world (every weekly and monthly charge there is): nothing posts to or from its account, and the
    // facility ships nothing for it.
    const seen = watch(w, acct);
    runDays(w, 60);
    expect(seen).toEqual([]);
    expect(w.ledger.balance(acct)).toBe(0);
    expect([...w.loads.values()].some((l) => l.shipperId === c.id)).toBe(false);
  });

  it("a retired bot with cash keeps it untouched: no holding cost, no premium, no wage, no unlock", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 11 });
    const c = carrier(w, "Done Hauling");
    fund(w, c.id, 40_000);
    c.airdrop = { totalFd: 10_000, unlockedFd: 0, forfeitedFd: 0, queuedFd: 0, weeksLeft: 26, claimedEarly: false };
    const acct = companyAccount(c.id);
    retireCompany(w, c, "held");
    expect(c.bankruptcies).toBe(0); // nothing owed, nothing written off
    const balance = w.ledger.balance(acct);
    expect(balance).toBeGreaterThan(30_000);
    // Nothing it could do is open to it any more: a bot's lease of a truck back, the leak's second form, is refused.
    expect(applyAction(w, c.id, { type: "lease_truck", trailer: "van" })).toEqual({ ok: false, reason: "the company has left the market" });
    expect(applyAction(w, c.id, { type: "wait" })).toEqual({ ok: true });
    const seen = watch(w, acct);
    runDays(w, 60);
    expect(seen).toEqual([]);
    expect(w.ledger.balance(acct)).toBe(balance);
  });

  it("a bot retired on the held path never restarts: a refile after its bar, or a restart outright, hands it no truck and moves nothing", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 11 });
    const c = carrier(w, "Held Back");
    fund(w, c.id, 20_000);
    c.liquidatingSince = 0; // held on the free-path restart: the liquidation mark stays, as it does in processLiquidations
    retireCompany(w, c, "held");
    const acct = companyAccount(c.id);
    const balance = w.ledger.balance(acct);
    expect(w.trucksByCompany.get(c.id) ?? []).toEqual([]);
    const seen = watch(w, acct);
    restart(w, c);
    c.authority.status = "revoked";
    c.authority.barredUntil = 0;
    refile(w, c);
    expect((w.trucksByCompany.get(c.id) ?? []).length).toBe(0); // no free-path truck
    expect(seen).toEqual([]);
    expect(w.ledger.balance(acct)).toBe(balance);
    expect(c.retiredDay).toBeDefined();
  });

  it("the daily debt figures count a retired bot's residue nowhere once it is written off", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 11 });
    const c = carrier(w, "Owes");
    const acct = companyAccount(c.id);
    w.ledger.post(w.t, acct, "sink:test", w.ledger.balance(acct) + 3_000, "test");
    retireCompany(w, c, "wound down");
    runDays(w, 1);
    const d = w.metrics.days[w.metrics.days.length - 1]!;
    expect(d.retiredDebtFd).toBe(0);
    expect(d.inDebt).toBe(0);
  });
});
