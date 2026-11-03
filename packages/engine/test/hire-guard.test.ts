import { describe, expect, it } from "vitest";
import { economyConfig as cfg, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { addTruck, askingPay, autoStaff, companyAccount, createWorld, formCompany, poolOf, weeklyWage, type World } from "@lanes/engine";

// R8 (studio/reviews/director-player2.md; sized in studio/reviews/economy-player2.md §3): auto-staff never hires while
// cash covers less than guard.hireCoverWeeks weeks of the new wages, and a player's auto-staff can start off.
const net = buildNetwork(hubs, cfg);
const r8: EconomyConfig = { ...cfg, guard: { ...cfg.guard, hireCoverWeeks: 4, hireCoverHumansOnly: false, autoStaffDefault: false } };
const world = (c: EconomyConfig, seed = 1): World => createWorld({ cfg: c, net, feeds: neutralFeeds, seed });
const fleet = (w: World, trucks: number, human = false) => {
  const c = formCompany(w, { name: "Fleet", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false, human });
  for (let i = 0; i < trucks; i++) addTruck(w, c, "owned", "workhorse", "van");
  return c;
};
const setCash = (w: World, id: number, fd: number) => {
  const b = w.ledger.balance(companyAccount(id));
  if (b > fd) w.ledger.post(w.t, companyAccount(id), "sink:test", b - fd, "test");
  else w.ledger.post(w.t, "faucet:starting_grant", companyAccount(id), fd - b, "test");
};
const hired = (w: World, id: number, kind: "driver" | "dispatcher") => (w.staffByCompany.get(id) ?? []).filter((s) => s.kind === kind && !s.owner && s.status === "employed").length;

describe("R8: the hire guard", () => {
  it("today (guard 0) hires drivers and a dispatcher on 772 FD, as in the diary", () => {
    const w = world(cfg);
    const c = fleet(w, 5);
    c.autoStaff = true;
    setCash(w, c.id, 772);
    autoStaff(w, c);
    expect(hired(w, c.id, "driver")).toBe(4);
    expect(hired(w, c.id, "dispatcher")).toBe(1);
    expect(c.hireBlock ?? null).toBeNull();
  });

  it("on, it holds the hire back and names what it needs; with the cover there, it hires as far as the cover goes", () => {
    const w = world(r8);
    const c = fleet(w, 5);
    c.autoStaff = true;
    setCash(w, c.id, 772);
    autoStaff(w, c);
    expect(hired(w, c.id, "driver")).toBe(0);
    expect(c.hireBlock?.kind).toBe("driver");
    const s = w.staff[c.hireBlock!.staffId - 1]!;
    expect(c.hireBlock!.weeklyFd).toBeCloseTo(askingPay(w, s) * cfg.labor.hiring.milesPerWeek, 6);
    expect(c.hireBlock!.needFd).toBeCloseTo(4 * c.hireBlock!.weeklyFd, 6);
    expect(c.hireBlockedDays).toBe(1);
    // Cash for exactly the first hire's four weeks: one driver, then the guard holds the second (the sum of the pass's wages).
    setCash(w, c.id, c.hireBlock!.needFd + 1);
    autoStaff(w, c);
    expect(hired(w, c.id, "driver")).toBe(1);
    expect(c.hireBlock?.kind).toBe("driver");
    expect(c.hireBlock!.needFd).toBeGreaterThan(w.ledger.balance(companyAccount(c.id)));
    expect(c.hireBlockedDays).toBe(2);
    // Flush: every seat and the dispatcher are hired, and nothing is held back.
    setCash(w, c.id, 1_000_000);
    autoStaff(w, c);
    expect(hired(w, c.id, "driver")).toBe(4);
    expect(hired(w, c.id, "dispatcher")).toBe(1);
    expect(c.hireBlock).toBeNull();
    w.ledger.assertBalanced();
  });

  it("humans only (the R8 proposal): a bot still hires on 772 FD, a player's company is held", () => {
    const w = world({ ...r8, guard: { ...r8.guard, hireCoverHumansOnly: true } });
    const bot = fleet(w, 5);
    const player = fleet(w, 5, true);
    for (const c of [bot, player]) {
      c.autoStaff = true;
      setCash(w, c.id, 772);
      autoStaff(w, c);
    }
    expect(hired(w, bot.id, "driver")).toBe(4);
    expect(bot.hireBlock ?? null).toBeNull();
    expect(hired(w, player.id, "driver")).toBe(0);
    expect(player.hireBlock?.kind).toBe("driver");
  });

  it("a dispatcher's week is the quoted weekly pay", () => {
    const w = world(r8);
    const d = poolOf(w, "dispatcher")[0]!;
    expect(weeklyWage(w, d, 843)).toBe(843);
  });

  it("a player's auto-staff starts off under R8; a bot's stays on", () => {
    const w = world(r8);
    expect(fleet(w, 0, true).autoStaff).toBe(false);
    expect(fleet(w, 0, false).autoStaff).toBe(true);
    const today = world(cfg);
    expect(fleet(today, 0, true).autoStaff).toBe(true);
  });
});
