import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { companyAccount, createWorld, financeBlock, financedCashNeed, formCompany, NEW_TRUCK, purchaseTerms, stepHour, type World } from "@lanes/engine";

/**
 * The lender reads the truck (equipmentFinance.purchase.collateral; the economy's economy-worn-truck-loans-2026-11-09.md,
 * Jeff's yes, DECISIONS.md 2026-11-09): the down payment by age, miles and a new business, the cap, the decline past
 * 10 years or 700k miles, the term by the 7th birthday, the rate by age. On the live profile.
 */
const LIVE = withLiveLevers();
const ON: EconomyConfig = { ...LIVE, equipmentFinance: { ...LIVE.equipmentFinance, purchase: { ...LIVE.equipmentFinance.purchase, collateral: { ...LIVE.equipmentFinance.purchase.collateral, enabled: true } } } };
const net = buildNetwork(hubs, LIVE);

function digest(cfg: EconomyConfig): string {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 20_261_109 });
  populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 6 });
  for (let h = 0; h < 10 * 24; h++) stepHour(w, ruleBotHook);
  const s = JSON.stringify({ t: w.t, next: w.nextLoadId, supply: w.ledger.supply(), books: w.companies.map((c) => [c.id, w.ledger.balance(companyAccount(c.id)), c.delivered, c.onTime, c.operating]), days: w.metrics.days, loads: [...w.loads.values()], trucks: w.trucks, loans: w.purchaseLoans });
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

/** A newcomer: formed today. */
function newcomer(cfg: EconomyConfig) {
  const w: World = createWorld({ cfg, net, feeds: neutralFeeds, seed: 3 });
  const c = formCompany(w, { name: "Loan Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
  return { w, c };
}

describe("the lender reads the truck (equipmentFinance.purchase.collateral)", () => {
  it("leaves the ten-day world identical with the key false and absent", () => {
    expect(LIVE.equipmentFinance.purchase.collateral.enabled).toBe(false);
    const { collateral: _, ...purchase } = LIVE.equipmentFinance.purchase;
    const absent = { ...LIVE, equipmentFinance: { ...LIVE.equipmentFinance, purchase } } as unknown as EconomyConfig;
    expect(digest(absent)).toBe(digest(LIVE));
  }, 120_000);

  it("adds age, miles and a new business to the credit share, capped at half; declines past 10 years or 700k miles", () => {
    const { w, c } = newcomer(ON);
    const k = ON.equipmentFinance.purchase.collateral;
    const credit = purchaseTerms(w, c).parts!.credit;
    // Off: the credit alone, whatever the truck.
    const off = newcomer(LIVE);
    expect(purchaseTerms(off.w, off.c, { ageYears: 9, odometer: 690_000 }).downShare).toBeCloseTo(purchaseTerms(off.w, off.c).downShare, 12);
    // A new rig for a newcomer: the credit share and the new business.
    expect(purchaseTerms(w, c, NEW_TRUCK).downShare).toBeCloseTo(credit + k.newBusiness.downAdd, 12);
    // QA's day-2 listing: 4 years, 502,339 miles.
    const worn = { ageYears: 4, odometer: 502_339 };
    const t = purchaseTerms(w, c, worn);
    expect(t.downShare).toBeCloseTo(credit + 0.1 + 0.03 + 0.03 * 2.02339, 9);
    expect(t.parts).toEqual({ credit, age: expect.closeTo(0.03, 12), miles: expect.closeTo(0.0607017, 6), newBusiness: 0.1 });
    // A truck owned (or a wreck bought and resold) doesn't end the new-business share: the authority's age alone does (the
    // red team's 0.24.1 pass §7).
    c.firstOwnedTruckDay = 0;
    expect(purchaseTerms(w, c, NEW_TRUCK).downShare).toBeCloseTo(credit + k.newBusiness.downAdd, 12);
    c.firstOwnedTruckDay = null;
    // A company a year old or more gets none.
    const since = c.authority.since;
    c.authority.since = since - k.newBusiness.years * ON.time.daysPerSeason;
    expect(purchaseTerms(w, c, NEW_TRUCK).parts!.newBusiness).toBe(0);
    c.authority.since = since;
    // Capped at half.
    expect(purchaseTerms(w, c, { ageYears: 10, odometer: 700_000 }).downShare).toBe(k.maxDownShare);
    // Declined past either cap: cash only, said by financeBlock too.
    expect(purchaseTerms(w, c, { ageYears: 10.5, odometer: 400_000 }).declined).toMatch(/over 10 years old: cash only$/);
    expect(purchaseTerms(w, c, { ageYears: 5, odometer: 720_000 }).declined).toMatch(/past 700,000 miles: cash only$/);
    expect(financeBlock(w, c, 10_000, 1e9, { ageYears: 5, odometer: 720_000 })).toMatch(/cash only$/);
    expect(financeBlock(w, c, 10_000, 1e9, worn)).toBeNull();
  });

  it("ends the term by the truck's 7th birthday, never under 26 weeks, and raises the rate by age", () => {
    const { w, c } = newcomer(ON);
    const k = ON.equipmentFinance.purchase;
    const weeksPerYear = ON.time.daysPerSeason / 7;
    const base = purchaseTerms(w, c);
    expect(purchaseTerms(w, c, { ageYears: 4, odometer: 0 }).termWeeks).toBe(k.termWeeks); // 3 years left, longer than the term
    expect(purchaseTerms(w, c, { ageYears: 6, odometer: 0 }).termWeeks).toBe(Math.floor(weeksPerYear));
    expect(purchaseTerms(w, c, { ageYears: 6.9, odometer: 0 }).termWeeks).toBe(k.collateral.minTermWeeks);
    expect(purchaseTerms(w, c, { ageYears: 6, odometer: 0 }).weeklyRate).toBeCloseTo(base.weeklyRate + 3 * k.collateral.weeklyRatePerYear, 12);
    expect(purchaseTerms(w, c, NEW_TRUCK).weeklyRate).toBeCloseTo(base.weeklyRate, 12);
  });

  it("asks QA's day-2 company far more cash for a 502k-mile listing, and a new rig 10 points more down", () => {
    const { w, c } = newcomer(ON);
    const off = newcomer(LIVE);
    const worn = { ageYears: 4, odometer: 502_339 };
    const stake = ON.equipmentFinance.purchase.stakeShare;
    const before = financedCashNeed(off.w, off.c, 17_800, worn);
    const after = financedCashNeed(w, c, 17_800, worn);
    const dDown = purchaseTerms(w, c, worn).downShare - purchaseTerms(off.w, off.c).downShare;
    expect(after - before).toBeCloseTo(17_800 * dDown * (1 - stake), 6);
    expect(dDown).toBeGreaterThan(0.19);
  });

  it("the bots borrow under it for a month, and the ledger balances", () => {
    const w = createWorld({ cfg: ON, net, feeds: neutralFeeds, seed: 11 });
    populate(w, { freeOwnerOperators: 60, fleets: 10, brokers: 6 });
    for (let h = 0; h < 30 * 24; h++) stepHour(w, ruleBotHook);
    w.ledger.assertBalanced();
    const k = ON.equipmentFinance.purchase;
    expect(w.purchaseLoans.length).toBeGreaterThan(0);
    for (const l of w.purchaseLoans) {
      expect(l.termWeeks).toBeLessThanOrEqual(k.termWeeks);
      expect(l.termWeeks).toBeGreaterThanOrEqual(k.collateral.minTermWeeks);
    }
  }, 120_000);
});
