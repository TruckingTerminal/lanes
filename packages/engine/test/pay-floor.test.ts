import { describe, expect, it } from "vitest";
import { economyConfig as cfg, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { addTruck, applyAction, askOf, askingPay, companyAccount, createWorld, dailyLabor, formCompany, hardCap, marketPay, payFloor, poolOf, stepHour, type World } from "@lanes/engine";

// R16 and R17 (studio/reviews/director-player4.md; sized in studio/reviews/economy-player34.md).
const net = buildNetwork(hubs, cfg);
const r16: EconomyConfig = { ...cfg, labor: { ...cfg.labor, payFloorShareOfMarket: 0.8, unhappyNoticeDays: 7, underpayMemory: { days: 56, askPremium: 0.1 } } };
const world = (c: EconomyConfig): World => createWorld({ cfg: c, net, feeds: neutralFeeds, seed: 11 });
function withDriver(w: World) {
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

describe("R16: the pay floor", () => {
  it("today a driver can be set to a penny a mile and stays", () => {
    const w = world(cfg);
    const { c, s } = withDriver(w);
    expect(applyAction(w, c.id, { type: "set_staff_pay", staffId: s.id, pay: 0.01 }).ok).toBe(true);
    days(w, 10);
    expect(s.companyId).toBe(c.id);
    expect(s.unhappyNotice ?? false).toBe(false);
  });

  it("on, pay below the floor is refused; at the floor the driver turns unhappy, gives notice, and a raise keeps them", () => {
    const w = world(r16);
    const { c, s } = withDriver(w);
    const floor = payFloor(w, s);
    expect(floor).toBeCloseTo(0.8 * marketPay(w, "driver", s.skill), 9);
    const r = applyAction(w, c.id, { type: "set_staff_pay", staffId: s.id, pay: 0.01 });
    expect(r.ok ? "" : r.reason).toMatch(/below the pay floor/);
    expect(applyAction(w, c.id, { type: "set_staff_pay", staffId: s.id, pay: floor }).ok).toBe(true);
    s.morale = 0.2; // as unhappy as a cut to the floor makes them within a week or two
    days(w, 1);
    expect(s.unhappyNotice).toBe(true);
    expect(s.offer?.companyId).toBe(0);
    expect(applyAction(w, c.id, { type: "set_staff_pay", staffId: s.id, pay: askingPay(w, s) }).ok).toBe(true);
    expect(s.unhappyNotice).toBe(false);
    expect(s.offer).toBeNull();
    days(w, 10);
    expect(s.companyId).toBe(c.id);
  });

  it("left unhappy, they quit on the notice's last day, and drivers then ask the company more", () => {
    const w = world(r16);
    const { c, s } = withDriver(w);
    s.morale = 0.2;
    days(w, 1);
    expect(s.unhappyNotice).toBe(true);
    days(w, 6);
    expect(s.companyId).toBe(c.id); // still there on day 6 of 7
    days(w, 1);
    expect(s.status).toBe("pool");
    expect(c.underpaidUntilDay).toBeGreaterThan(0);
    const next = poolOf(w, "driver")[0]!;
    expect(askOf(w, c, next)).toBeCloseTo(askingPay(w, next) * 1.1, 9);
  });
});

describe("R17: a ceiling is a ceiling", () => {
  it("on, a hand bid above the ceiling is refused with the ceiling; the hard cap is the ceiling at overCeilingMax 1", () => {
    const r17: EconomyConfig = { ...cfg, board: { ...cfg.board, overCeilingMax: 1, refuseOverCeiling: true } };
    const w = world(r17);
    const { c, t } = withDriver(w);
    const open = () => [...w.loads.values()].find((l) => l.status === "open" && l.equipment === t.trailer && l.origin === t.hub && !l.hold && !l.tenderedTo);
    for (let h = 0; h < 72 && !(open() && t.status === "idle"); h++) stepHour(w);
    const load = open()!;
    expect(load).toBeDefined();
    expect(hardCap(w, load)).toBeCloseTo(load.ceiling, 9);
    const r = applyAction(w, c.id, { type: "place_bid", truckId: t.id, loadId: load.id, rate: load.ceiling * 2 });
    expect(r.ok ? "" : r.reason).toMatch(/above the ceiling/);
    expect(applyAction(w, c.id, { type: "place_bid", truckId: t.id, loadId: load.id, rate: load.ceiling }).ok).toBe(true);
  });
});
