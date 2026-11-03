import { describe, expect, it } from "vitest";
import { economyConfig as cfg, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { addTruck, applyAction, askingPay, companyAccount, complianceReview, createWorld, dailyLabor, drivingMinutesLeft, formCompany, ownBand, poolOf, type Load, type World } from "@lanes/engine";

// The red team's pass 3 on the bump (studio/reviews/redteam-2026-11-03b.md), each fixed behind the key that governs it,
// and R18's probation (economy-player34.md §3c).
const net = buildNetwork(hubs, cfg);
const world = (c: EconomyConfig): World => createWorld({ cfg: c, net, feeds: neutralFeeds, seed: 13 });
const H = 60;
const r16: EconomyConfig = { ...cfg, labor: { ...cfg.labor, payFloorShareOfMarket: 0.8, unhappyNoticeDays: 7, underpayMemory: { days: 56, askPremium: 0.1 } } };
const r12: EconomyConfig = { ...cfg, hos: { ...cfg.hos, restHours: 10, cycleHours: 70, restartHours: 34 } };
function fleet(w: World) {
  const c = formCompany(w, { name: "Fleet", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false, human: true });
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 100_000, "test");
  addTruck(w, c, "owned", "workhorse", "van"); // the owner's
  const t = addTruck(w, c, "owned", "workhorse", "van");
  const s = poolOf(w, "driver")[0]!;
  expect(applyAction(w, c.id, { type: "offer_staff", staffId: s.id, pay: askingPay(w, s), truckId: t.id }).ok).toBe(true);
  return { c, s, t };
}
const days = (w: World, n: number) => {
  for (let i = 0; i < n; i++) {
    w.t += w.cfg.time.gameMinutesPerDay;
    dailyLabor(w);
  }
};
const onNotice = (w: World, s: ReturnType<typeof fleet>["s"]) => {
  s.morale = 0.2;
  days(w, 1);
  expect(s.unhappyNotice).toBe(true);
};

describe("R16: the underpay memory can't be dodged", () => {
  it("firing a driver on an unhappy notice writes the memory, as the notice running out does", () => {
    const w = world(r16);
    const { c, s } = fleet(w);
    onNotice(w, s);
    expect(c.underpaidUntilDay ?? 0).toBe(0);
    expect(applyAction(w, c.id, { type: "release_staff", staffId: s.id }).ok).toBe(true);
    expect(c.underpaidUntilDay).toBeGreaterThan(0);
  });
  it("a raise that withdrew the notice, cut back within the memory's days, re-opens it at once", () => {
    const w = world(r16);
    const { c, s } = fleet(w);
    onNotice(w, s);
    const ask = askingPay(w, s);
    expect(applyAction(w, c.id, { type: "set_staff_pay", staffId: s.id, pay: ask }).ok).toBe(true);
    expect(s.unhappyNotice).toBe(false);
    days(w, 1);
    expect(applyAction(w, c.id, { type: "set_staff_pay", staffId: s.id, pay: ask * 0.9 }).ok).toBe(true);
    expect(s.unhappyNotice).toBe(true);
    days(w, 1); // they leave at the next pass, their truck at its hub
    expect(s.status).toBe("pool");
    expect(c.underpaidUntilDay).toBeGreaterThan(0);
  });
  it("today (no memory): the cut after a withdrawn notice is just a cut", () => {
    const w = world({ ...r16, labor: { ...r16.labor, underpayMemory: { days: 0, askPremium: 0 } } });
    const { c, s } = fleet(w);
    onNotice(w, s);
    const ask = askingPay(w, s);
    applyAction(w, c.id, { type: "set_staff_pay", staffId: s.id, pay: ask });
    applyAction(w, c.id, { type: "set_staff_pay", staffId: s.id, pay: ask * 0.9 });
    expect(s.unhappyNotice).toBe(false);
  });
});

describe("R12: the clocks follow the driver", () => {
  function tiredDriver(c: EconomyConfig) {
    const w = world(c);
    const { c: co, s, t } = fleet(w);
    const rested = addTruck(w, co, "owned", "workhorse", "van");
    t.shiftStartT = w.t;
    t.shiftDrivenMin = 11 * H; // the day's hours are spent
    t.offDutySinceT = w.t;
    t.cycleMin = 69 * H;
    t.cycleLastT = w.t;
    return { w, co, s, t, rested };
  }
  it("today: a tired driver moved to a rested truck starts a fresh day", () => {
    const { w, co, s, rested } = tiredDriver(cfg);
    expect(applyAction(w, co.id, { type: "assign_driver", staffId: s.id, truckId: rested.id }).ok).toBe(true);
    expect(drivingMinutesLeft(w, rested, w.t)).toBe(cfg.hos.drivingHoursPerDay * H);
  });
  it("on: the day's and the week's clocks go with the driver", () => {
    const { w, co, s, rested } = tiredDriver(r12);
    expect(applyAction(w, co.id, { type: "assign_driver", staffId: s.id, truckId: rested.id }).ok).toBe(true);
    expect(rested.shiftDrivenMin).toBe(11 * H);
    expect(rested.cycleMin).toBe(69 * H);
    expect(drivingMinutesLeft(w, rested, w.t)).toBeLessThanOrEqual(0);
  });
  it("on: a move to a truck at another hub is refused", () => {
    const { w, co, s, rested } = tiredDriver(r12);
    rested.hub = rested.hub === 0 ? 1 : 0;
    const r = applyAction(w, co.id, { type: "assign_driver", staffId: s.id, truckId: rested.id });
    expect(r.ok ? "" : r.reason).toMatch(/their truck is at/);
  });
});

describe("R17: the own-carrier tender's band stays under the load's ceiling", () => {
  const load = { ceiling: 3, laneId: -1, origin: 0, equipment: "van" } as unknown as Load; // no lane history: the band is around the ceiling
  it("today: the band runs to 115% of the lane's rate, over the ceiling", () => {
    expect(ownBand(world(cfg), load)[1]).toBeCloseTo(3 * cfg.brokerage.band[1], 9);
  });
  it("on (board.refuseOverCeiling): capped at the ceiling", () => {
    const w = world({ ...cfg, board: { ...cfg.board, refuseOverCeiling: true } });
    const [lo, hi] = ownBand(w, load);
    expect(hi).toBeCloseTo(3, 9);
    expect(lo).toBeLessThanOrEqual(hi);
  });
});

describe("R18's probation: clean up for the follow-up, then cheat again, and the next Unsatisfactory revokes", () => {
  it("an Unsatisfactory within probationDays of the last one revokes at once", () => {
    const r18: EconomyConfig = { ...cfg, safety: { ...cfg.safety, review: { ...cfg.safety.review, auditDays: 14, hiddenDetect: 1, probationDays: 365 } } };
    for (const [c, revoked] of [[{ ...r18, safety: { ...r18.safety, review: { ...r18.safety.review, probationDays: null } } }, false], [r18, true]] as const) {
      const w = world(c);
      const co = formCompany(w, { name: "Cycle", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
      const s = co.safety;
      const cheatFor = (from: number) => {
        for (let d = from; d < from + 12; d++) s.hidden.push({ day: d, kind: "falseLog", truckId: 1 });
      };
      w.t = 40 * w.cfg.time.gameMinutesPerDay;
      cheatFor(20);
      complianceReview(w, co); // Unsatisfactory on day 40
      expect(s.rating).toBe("unsatisfactory");
      w.t = 85 * w.cfg.time.gameMinutesPerDay;
      complianceReview(w, co); // clean since: passes the follow-up (the window)
      expect(s.rating).toBe("satisfactory");
      cheatFor(90);
      w.t = 120 * w.cfg.time.gameMinutesPerDay;
      complianceReview(w, co); // cheating again: Unsatisfactory
      expect(co.authority.status === "revoked").toBe(revoked);
    }
  });
});
