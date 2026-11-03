import { describe, expect, it } from "vitest";
import { economyConfig as cfg, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { acceptOffer, addTruck, borrow, borrowingCapacity, borrowLender, closeDutyDay, companyAccount, complianceReview, contractRatingBlock, createWorld, fine, formCompany, lendNowFd, monthlyIntel, POOL_ACCOUNT, truckValue, weeklySafety, type World } from "@lanes/engine";

// Stage 3 of economy-player34.md: R18's fines scaled to what the breach earned, an alert's audit, a bad rating closing
// contracts, the month record's fines, the Equipment Finance pledge hole, and Borrow's two reads for the screen (§5a).
const net = buildNetwork(hubs, cfg);
const world = (c: EconomyConfig): World => createWorld({ cfg: c, net, feeds: neutralFeeds, seed: 9 });
const r18: EconomyConfig = {
  ...cfg,
  safety: { ...cfg.safety, enforcement: { ...cfg.safety.enforcement, fineEarnedMult: 3 }, review: { ...cfg.safety.review, auditDays: 14, hiddenDetect: 1 } },
};
function cheat(c: EconomyConfig) {
  const w = world(c);
  const co = formCompany(w, { name: "Cheat", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(co.id), 500_000, "test");
  co.policy.hos = "always";
  const t = addTruck(w, co, "owned", "workhorse", "van");
  return { w, co, t };
}
const fined = (w: World, id: number) => w.ledger.balance(companyAccount(id));

describe("R18: fines that scale with what the breach earned", () => {
  it("today: a falsified log day is a flat 1,000 at audit", () => {
    const c: EconomyConfig = { ...cfg, safety: { ...cfg.safety, review: { ...cfg.safety.review, hiddenDetect: 1 } } };
    const { w, co, t } = cheat(c);
    w.metrics.days.push({ ...(w.metrics.days[0] ?? {}), avgClearedRate: 4, cleared: 100 } as never);
    t.overMin = 240;
    closeDutyDay(w, t);
    expect(co.safety.hidden[0]!.earnedFd).toBeUndefined();
    const before = fined(w, co.id);
    complianceReview(w, co);
    expect(before - fined(w, co.id)).toBeCloseTo(cfg.safety.review.fines.falseLogDay, 6);
  });

  it("on (×3): the day's four extra hours at 4/mi earned 800, so the fine is 2,400", () => {
    const { w, co, t } = cheat(r18);
    w.metrics.days.push({ ...(w.metrics.days[0] ?? {}), avgClearedRate: 4, cleared: 100 } as never);
    t.overMin = 240;
    closeDutyDay(w, t);
    expect(co.safety.hidden[0]!.earnedFd).toBeCloseTo(4 * cfg.hos.avgMph * 4, 6);
    const before = fined(w, co.id);
    complianceReview(w, co);
    expect(before - fined(w, co.id)).toBeCloseTo(3 * 4 * cfg.hos.avgMph * 4, 6);
  });

  it("an alert books an audit within auditDays for a company never rated", () => {
    const { w, co } = cheat(r18);
    co.safety.violations.push({ day: 0, basic: "hos", points: 50, what: "test" } as never);
    co.safety.inspections.push(0);
    weeklySafety(w);
    expect(co.safety.alerts.length).toBeGreaterThan(0);
    expect(co.safety.reviewDay).toBe(Math.floor(w.t / w.cfg.time.gameMinutesPerDay) + 14);
  });
});

describe("R18: a Conditional or Unsatisfactory rating closes contract offers", () => {
  const offered = (w: World, carrierId: number) => {
    const k = { id: 1, carrierId, status: "offered", loadsPerWeek: 1, rate: 3 } as never;
    w.contracts.push(k);
    return k;
  };
  it("today: a rating doesn't touch contracts", () => {
    const { w, co } = cheat(cfg);
    co.safety.rating = "conditional";
    expect(contractRatingBlock(w, co)).toBeNull();
    expect(acceptOffer(w, co, offered(w, co.id))).toBeNull();
  });
  it("on: a Conditional carrier can't take the offer it holds; a Satisfactory one can", () => {
    const on: EconomyConfig = { ...cfg, contracts: { ...cfg.contracts, closedToBadRating: true } };
    const { w, co } = cheat(on);
    co.safety.rating = "conditional";
    expect(acceptOffer(w, co, offered(w, co.id))).toBe("shippers don't sign contracts with a conditional safety rating");
    co.safety.rating = "satisfactory";
    expect(acceptOffer(w, co, offered(w, co.id))).toBeNull();
  });
});

describe("the month record counts the fines outside operating costs", () => {
  it("a safety fine is in the month's spent; a shoulder ticket, already an operating cost, isn't counted twice", () => {
    const { w, co } = cheat(cfg);
    monthlyIntel(w);
    const costs = () => co.operating.costFd + co.overheadPaidFd;
    const mark = costs();
    fine(w, co, 1_000, "test");
    co.operating.costFd += 75; // a shoulder ticket's operating cost (sites.ts)
    monthlyIntel(w);
    expect(co.lastMonth!.spentFd).toBeCloseTo(costs() - mark + 1_000, 6);
    monthlyIntel(w);
    expect(co.lastMonth!.spentFd).toBeCloseTo(0, 6);
  });
});

describe("Equipment Finance: a truck on a purchase loan pledges only what isn't owed", () => {
  const onLoan = (c: EconomyConfig, owedShare: number) => {
    const { w, t } = cheat(c);
    const principalFd = owedShare * truckValue(w, t);
    w.purchaseLoans.push({ id: 1, borrowerId: t.companyId, orderId: 0, truckId: t.id, originalFd: principalFd, principalFd, weeklyRate: 0.01, termWeeks: 26, stakeFd: 0, missed: 0, status: "active" });
    return { w, t };
  };
  const net: EconomyConfig = { ...cfg, equipmentFinance: { ...cfg.equipmentFinance, netOfPurchaseLoans: true } };
  it("today: 35% of the value, whatever the purchase loan", () => {
    const { w, t } = onLoan(cfg, 0.8);
    expect(borrowingCapacity(w, t)).toBeCloseTo(cfg.equipmentFinance.maxLoanToValue * truckValue(w, t), 6);
  });
  it("on: 35% of the value less the loan's principal, never below zero", () => {
    const a = onLoan(net, 0.2);
    expect(borrowingCapacity(a.w, a.t)).toBeCloseTo((cfg.equipmentFinance.maxLoanToValue - 0.2) * truckValue(a.w, a.t), 6);
    const b = onLoan(net, 0.8);
    expect(borrowingCapacity(b.w, b.t)).toBe(0);
  });
});

describe("Borrow's reads for the screen: who lends, and what it lends now", () => {
  const pools: EconomyConfig = { ...cfg, token: { ...cfg.token, pools: { ...cfg.token.pools, enabled: true } } };
  const fund = (w: World, fd: number) => w.ledger.post(w.t, "faucet:starting_grant", POOL_ACCOUNT, fd, "test");
  it("off while the pools are off: nothing offered", () => {
    const { w, co, t } = cheat({ ...cfg, token: { ...cfg.token, pools: { ...cfg.token.pools, enabled: false } } });
    fund(w, 1_000_000);
    expect(borrowLender(w)).toBe("off");
    expect(lendNowFd(w, co.id, t)).toBe(0);
  });
  it("on: the cap at 98%, no more than the pool's cash, to the 100, and borrow takes it", () => {
    const { w, co, t } = cheat(pools);
    expect(borrowLender(w)).toBe("pool");
    expect(lendNowFd(w, co.id, t)).toBe(0); // an empty pool lends nothing
    fund(w, 5_050);
    expect(lendNowFd(w, co.id, t)).toBe(5_000);
    fund(w, 1_000_000);
    const now = lendNowFd(w, co.id, t);
    expect(now).toBe(Math.floor((borrowingCapacity(w, t) * 0.98) / 100) * 100);
    expect(lendNowFd(w, co.id + 1, t)).toBe(0); // not the company's truck
    expect(borrow(w, co.id, t, now)).toBeNull();
  });
});
