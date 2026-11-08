import { describe, expect, it } from "vitest";
import { economyConfig as cfg } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { companyAccount, createWorld, formCompany, runDays, type World } from "@lanes/engine";

// The launch gate's debt line (killCriteria.gate; apps/sim/src/gate.ts) reads the companies in debt and what they owe from
// the daily metrics at the ends of years 3 and 4, so closeDay counts them the way the report's failures do at the end.
const net = buildNetwork(hubs, cfg);
const carrier = (w: World, name: string) => formCompany(w, { name, role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
const owed = (w: World) => w.companies.map((c) => w.ledger.balance(companyAccount(c.id))).filter((b) => b < 0);

describe("the daily debt figures for the gate", () => {
  it("counts the companies below zero at the day's end and what they owe, as the report's failures do", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 7 });
    const a = carrier(w, "Owes");
    carrier(w, "Solvent");
    // Spend past the grant: the ledger lets a company's cash go below zero (a day's costs do it in the sim); the gate reads the result.
    w.ledger.post(w.t, companyAccount(a.id), "sink:test", w.ledger.balance(companyAccount(a.id)) + 1_234.5, "test");
    expect(w.ledger.balance(companyAccount(a.id))).toBeCloseTo(-1_234.5, 6);
    runDays(w, 1);
    const d = w.metrics.days[w.metrics.days.length - 1]!;
    const debts = owed(w);
    expect(debts.length).toBeGreaterThanOrEqual(1);
    expect(d.inDebt).toBe(debts.length);
    expect(d.debtFd).toBeCloseTo(-debts.reduce((s, b) => s + b, 0), 6);
    expect(d.debtFd).toBeGreaterThanOrEqual(1_234.5 - 1e-6);
  });

  it("leaves what a retired company still owes out of the market's debt and reports it apart", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 7 });
    const gone = carrier(w, "Gone");
    const here = carrier(w, "Here");
    w.ledger.post(w.t, companyAccount(gone.id), "sink:test", w.ledger.balance(companyAccount(gone.id)) + 5_000, "test");
    w.ledger.post(w.t, companyAccount(here.id), "sink:test", w.ledger.balance(companyAccount(here.id)) + 700, "test");
    gone.retiredDay = 0; // the population dial retired it: it has left the market
    runDays(w, 1);
    const d = w.metrics.days[w.metrics.days.length - 1]!;
    expect(d.inDebt).toBe(1);
    expect(d.debtFd).toBeCloseTo(-w.ledger.balance(companyAccount(here.id)), 6);
    expect(d.retiredDebtFd).toBeCloseTo(-w.ledger.balance(companyAccount(gone.id)), 6);
    expect(d.retiredDebtFd).toBeGreaterThanOrEqual(5_000 - 1e-6);
  });

  it("reads zero when nobody owes", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 7 });
    carrier(w, "Solvent");
    runDays(w, 1);
    const d = w.metrics.days[w.metrics.days.length - 1]!;
    expect(owed(w)).toEqual([]);
    expect(d.inDebt).toBe(0);
    expect(d.debtFd).toBe(0);
  });
});
