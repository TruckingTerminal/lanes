import "./seed.js";
import { describe, expect, it } from "vitest";
import { companyAccount } from "@lanes/engine";
import { boardRows } from "../src/board.js";
import { closedMonths, EARNED, monthReport, MOVED, openMonth, SPENT } from "../src/books.js";
import { GAME_CONFIG, joinCompany, PLAYER_DISPATCHER_ORDERS, TestGame } from "../src/game.js";

/**
 * R10's month report (player2-ux.md section 4): "Why your cash moved differently" must add up to the figure. Two starts
 * run past their first month's close with the dispatcher on; each closed month's lines are summed from cash at the start
 * to cash at the close, and the catch-all lines stay small (a posting the books can't name is a line to add).
 */
describe("The month's books", () => {
  for (const start of ["oo", "fleet"] as const)
    it(`adds up to cash at the close, line by line (${start})`, async () => {
      const g = await TestGame.create();
      const c = g.join("Books Freight", start, "DAL")!;
      const truck = g.w.trucksByCompany.get(c.id)![0]!;
      // The first bid by hand, then the dispatcher on, so the month has loads, fuel, tolls and the lessor's share.
      const row = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" }).find((r) => !r.block);
      expect(g.act({ type: "book_load", truckId: truck.id, loadId: row!.l.id }).ok).toBe(true);
      expect(g.act({ type: "set_standing_orders", orders: PLAYER_DISPATCHER_ORDERS }).ok).toBe(true);
      const perDay = g.w.cfg.time.gameMinutesPerDay;
      const days = g.w.cfg.time.daysPerMonth + 2;
      const before = JSON.stringify(c.operating);
      for (let h = 0; h < days * 24 && closedMonths(g.w, c).length < 1; h++) g.stepHour();
      const months = closedMonths(g.w, c);
      expect(months.length).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(c.operating)).not.toBe(before);
      for (const m of months) {
        const r = monthReport(m);
        const lines = r.cashStart + r.keptFd - r.owedChange + r.payChange + r.moved.reduce((s, x) => s + x.fd, 0);
        expect(Math.abs(lines - r.cashEnd)).toBeLessThan(0.05);
        expect(Math.abs(r.keptFd - (r.earnedFd - r.spentFd))).toBeLessThan(0.01);
        // Every line the books know has a name; what they can't name stays a sliver of the month.
        for (const x of [...r.earned, ...r.spent, ...r.moved]) expect([...EARNED, ...SPENT, ...MOVED]).toContain(x.line);
        const other = Math.abs(r.earned.find((x) => x.line === "otherIn")?.fd ?? 0) + Math.abs(r.spent.find((x) => x.line === "otherOut")?.fd ?? 0);
        expect(other).toBeLessThanOrEqual(0.02 * (r.earnedFd + r.spentFd) + 1);
        expect(r.loads).toBeGreaterThan(0);
        expect(r.allMi).toBeGreaterThan(0);
        expect(r.loadedMi).toBeLessThanOrEqual(r.allMi);
      }
      // The owner's draw kept by the company (labor.owner.drawStays) is the month's own share of Company.ownerDrawFd.
      const drawn = months.reduce((s, m) => s + monthReport(m).drawFd, 0);
      expect(drawn).toBeLessThanOrEqual(c.ownerDrawFd + 0.01);
      if (g.w.cfg.labor.owner.drawStays && start === "oo") expect(monthReport(months[0]!).drawFd).toBeGreaterThan(0);
      // The close is the engine's (intel.ts), its cash the company's as the month closed, and the next month starts there.
      const newest = months[0]!;
      expect(newest.closedDay).toBe(c.lastMonth!.closedDay);
      expect(Math.floor(g.w.t / perDay)).toBeGreaterThanOrEqual(newest.closedDay);
      expect(openMonth(g.w, c)!.cashStart).toBeCloseTo(newest.cashEnd, 2);
      // Stepped on to the next hour, the month so far adds up to cash now.
      g.stepHour();
      const o = openMonth(g.w, c)!;
      const sum = o.cashStart + Object.values(o.flows).reduce((s, x) => s + (x ?? 0), 0);
      expect(sum).toBeCloseTo(g.w.ledger.balance(companyAccount(c.id)), 1);
    }, 300_000);

  it("counts an NPC's advance on a broker's paper (faucet:npc_advance) as loads delivered", async () => {
    const g = await TestGame.create();
    const c = g.join("Advance Freight", "oo", "DAL")!;
    g.stepHour();
    const o = openMonth(g.w, c);
    const loadsBefore = o?.flows.loads ?? 0;
    const otherBefore = Math.abs(o?.flows.otherIn ?? 0) + Math.abs(o?.flows.otherOut ?? 0);
    // The factor's cash now (or the lessor's pay on delivery) for a load a broker posted: receivables.ts NPC_ADVANCE.
    g.w.ledger.post(g.w.t, "faucet:npc_advance", companyAccount(c.id), 2400, "load:999999");
    const after = openMonth(g.w, c)!;
    expect((after.flows.loads ?? 0) - loadsBefore).toBeCloseTo(2400, 2);
    const other = Math.abs(after.flows.otherIn ?? 0) + Math.abs(after.flows.otherOut ?? 0);
    expect(other - otherBefore).toBeCloseTo(0, 2);
    const total = Object.values(after.flows).reduce((s, x) => s + Math.abs(x ?? 0), 0);
    expect(other).toBeLessThanOrEqual(0.02 * total + 1);
    // The open month still adds up to cash now.
    const sum = after.cashStart + Object.values(after.flows).reduce((s, x) => s + (x ?? 0), 0);
    expect(sum).toBeCloseTo(g.w.ledger.balance(companyAccount(c.id)), 1);
  });

  it("counts a broker's repayment of the factor's advance (sink:npc_factor) as carrier pay, not negative loads", async () => {
    // brokerage.enabled flipped for this test only (the config is read-only to the game; tests may vary it).
    const k = GAME_CONFIG.brokerage as { enabled: boolean };
    const was = k.enabled;
    k.enabled = true;
    try {
      const g = await TestGame.create();
      const c = g.join("Repay Lines", "fleet", "DAL")!;
      if (g.w.ladder) g.w.ladder.brokerage = Math.floor(g.w.t / g.w.cfg.time.gameMinutesPerDay);
      g.w.ledger.post(g.w.t, "faucet:test", companyAccount(c.id), 120_000, "test");
      const capital = g.w.cfg.token.staking.roles.broker + g.w.cfg.permits.brokerLicenseRenewalFd + 5_000;
      expect(g.act({ type: "form_brokerage", name: "Repay Logistics", capitalFd: capital }, "carrier")).toEqual({ ok: true });
      const b = g.brokerage!;
      g.stepHour();
      const flows = (id: number) => ({ ...(openMonth(g.w, g.w.companies[id - 1]!)?.flows ?? {}) });
      const cBefore = flows(c.id);
      const bBefore = flows(b.id);
      // The factor's advance to the carrier on the broker's paper, then the broker's repayment at the due day.
      g.w.ledger.post(g.w.t, "faucet:npc_advance", companyAccount(c.id), 1800, "load:999998");
      g.w.ledger.post(g.w.t, companyAccount(b.id), "sink:npc_factor", 1800, "receivable:999998");
      const cAfter = flows(c.id);
      // form_brokerage's sink:capital_transfer_fee (the reserve's 3%) is a fee, not the catch-all.
      expect(cAfter.fees ?? 0).toBeLessThan(0);
      expect(cAfter.otherOut ?? 0).toBeCloseTo(0, 2);
      const bAfter = flows(b.id);
      const d = (a: Record<string, number | undefined>, z: Record<string, number | undefined>, k: string) => (z[k] ?? 0) - (a[k] ?? 0);
      expect(d(cBefore, cAfter, "loads")).toBeCloseTo(1800, 2);
      expect(d(bBefore, bAfter, "carrierPay")).toBeCloseTo(-1800, 2);
      expect(d(bBefore, bAfter, "loads")).toBeCloseTo(0, 2);
      // Neither side's catch-all moves; the broker's whole month stays under 2% of its flows. (The carrier's month holds this
      // test's seed grant and the brokerage's sink:capital_transfer_fee, neither of them freight.)
      for (const [a, z] of [[cBefore, cAfter], [bBefore, bAfter]] as const) {
        expect(d(a, z, "otherIn")).toBeCloseTo(0, 2);
        expect(d(a, z, "otherOut")).toBeCloseTo(0, 2);
      }
      const other = Math.abs(bAfter.otherIn ?? 0) + Math.abs(bAfter.otherOut ?? 0);
      const total = Object.values(bAfter).reduce((s, x) => s + Math.abs(x ?? 0), 0);
      expect(other).toBeLessThanOrEqual(0.02 * total + 1);
      // The broker's open month still adds up to its cash.
      const o = openMonth(g.w, b)!;
      const sum = o.cashStart + Object.values(o.flows).reduce((s, x) => s + (x ?? 0), 0);
      expect(sum).toBeCloseTo(g.w.ledger.balance(companyAccount(b.id)), 1);
    } finally {
      k.enabled = was;
    }
  });

  /** Both companies' catch-all rows, unmoved by the postings, and under 2% of the open month's flows. */
  const catchAllFlat = (a: Record<string, number | undefined>, z: Record<string, number | undefined>) => {
    expect((z.otherIn ?? 0) - (a.otherIn ?? 0)).toBeCloseTo(0, 2);
    expect((z.otherOut ?? 0) - (a.otherOut ?? 0)).toBeCloseTo(0, 2);
    const other = Math.abs(z.otherIn ?? 0) + Math.abs(z.otherOut ?? 0);
    const total = Object.values(z).reduce<number>((s, x) => s + Math.abs(x ?? 0), 0);
    expect(other).toBeLessThanOrEqual(0.02 * total + 1);
  };
  const delta = (a: Record<string, number | undefined>, z: Record<string, number | undefined>, k: string) => (z[k] ?? 0) - (a[k] ?? 0);

  it("counts paper settled company to company (ref receivable:) as carrier pay out and loads in", async () => {
    const g = await TestGame.create();
    const c = g.join("Payee Lines", "oo", "DAL")!;
    const p = joinCompany(g.w, "payer", "Payer Lines", "DAL", "oo")!;
    g.stepHour();
    const flows = (id: number) => ({ ...(openMonth(g.w, g.w.companies[id - 1]!)?.flows ?? {}) });
    const cBefore = flows(c.id);
    const pBefore = flows(p.id);
    // The payer settles an invoice the payee holds (receivables.ts collect: holder = payee).
    g.w.ledger.post(g.w.t, companyAccount(p.id), companyAccount(c.id), 2000, "receivable:999997");
    const cAfter = flows(c.id);
    const pAfter = flows(p.id);
    expect(delta(cBefore, cAfter, "loads")).toBeCloseTo(2000, 2);
    expect(delta(pBefore, pAfter, "carrierPay")).toBeCloseTo(-2000, 2);
    expect(delta(pBefore, pAfter, "bought")).toBeCloseTo(0, 2);
    expect(delta(cBefore, cAfter, "sold")).toBeCloseTo(0, 2);
    catchAllFlat(cBefore, cAfter);
    catchAllFlat(pBefore, pAfter);
    for (const x of [c, p]) {
      const o = openMonth(g.w, x)!;
      expect(o.cashStart + Object.values(o.flows).reduce((s, v) => s + (v ?? 0), 0)).toBeCloseTo(g.w.ledger.balance(companyAccount(x.id)), 1);
    }
  });

  it("counts paper settled to the pool as carrier pay, and an invoice collected from a broker's bond as loads", async () => {
    const g = await TestGame.create();
    const c = g.join("Bond Payee Lines", "oo", "DAL")!;
    const p = joinCompany(g.w, "payer", "Pool Payer Lines", "DAL", "oo")!;
    g.stepHour();
    const flows = (id: number) => ({ ...(openMonth(g.w, g.w.companies[id - 1]!)?.flows ?? {}) });
    const cBefore = flows(c.id);
    const pBefore = flows(p.id);
    // The payer settles paper the factoring pool holds; the payee's own paper is paid from the payer's bond (drawBond).
    g.w.ledger.post(g.w.t, companyAccount(p.id), "co:pool:factoring", 1500, "receivable:999996");
    g.w.ledger.post(g.w.t, "faucet:test", `co:stake:${p.id}`, 900, "test");
    g.w.ledger.post(g.w.t, `co:stake:${p.id}`, companyAccount(c.id), 900, "receivable:999995");
    const cAfter = flows(c.id);
    const pAfter = flows(p.id);
    expect(delta(pBefore, pAfter, "carrierPay")).toBeCloseTo(-1500, 2);
    expect(delta(pBefore, pAfter, "setAside")).toBeCloseTo(0, 2);
    expect(delta(cBefore, cAfter, "loads")).toBeCloseTo(900, 2);
    expect(delta(cBefore, cAfter, "setAside")).toBeCloseTo(0, 2);
    catchAllFlat(cBefore, cAfter);
    catchAllFlat(pBefore, pAfter);
  });
});
