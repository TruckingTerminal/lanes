import { describe, expect, it } from "vitest";
import { companyAccount } from "@lanes/engine";
import { BROKERAGE, poss } from "../src/copy.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { bookStates, carrierCantTake } from "../src/ui/panels/Brokerage.js";

/** Flips `brokerage.enabled` for one test (the config is read-only to the game; tests may vary it). */
async function withBrokerage<T>(fn: () => Promise<T>): Promise<T> {
  const k = GAME_CONFIG.brokerage as { enabled: boolean };
  const was = k.enabled;
  k.enabled = true;
  try {
    return await fn();
  } finally {
    k.enabled = was;
  }
}

describe("a player's brokerage, from the client (game.ts)", () => {
  it("starts from the carrier; its own orders act for it and the log says so; capital moves home", () =>
    withBrokerage(async () => {
      const g = await TestGame.create();
      const c = g.join("Red River Lines", "fleet", "DAL")!;
      // The ladder's brokerage layer, opened as dailyLadder would on its day.
      if (g.w.ladder) g.w.ladder.brokerage = Math.floor(g.w.t / g.w.cfg.time.gameMinutesPerDay);
      g.w.ledger.post(g.w.t, "faucet:test", companyAccount(c.id), 120_000, "test");
      const bond = g.w.cfg.token.staking.roles.broker;
      const capital = bond + g.w.cfg.permits.brokerLicenseRenewalFd + 5_000;
      expect(g.act({ type: "form_brokerage", name: "Red River Logistics", capitalFd: capital }, "carrier")).toEqual({ ok: true });
      const b = g.brokerage!;
      expect(b.name).toBe("Red River Logistics");
      expect(b.partnerId).toBe(c.id);
      // formBrokerage sets its first order and vetting from config; the client sends terms only when they change.
      expect(b.orders).toEqual([{ kind: "broker", marginPct: g.w.cfg.brokerage.defaultMarginPct, maxOpenLoads: g.w.cfg.brokerage.defaultOpenLoads }]);
      expect(b.vetting).toBe(g.w.cfg.brokerage.defaultVetting);
      // The brokerage's terms, sent as it.
      expect(g.act({ type: "set_standing_orders", orders: [{ kind: "broker", marginPct: 0.1, maxOpenLoads: 40 }] }, "brokerage").ok).toBe(true);
      expect(b.orders).toEqual([{ kind: "broker", marginPct: 0.1, maxOpenLoads: 40 }]);
      expect(c.orders.some((o) => o.kind === "broker")).toBe(false);
      expect(g.log.acts.at(-1)).toEqual([g.w.t, { type: "set_standing_orders", orders: [{ kind: "broker", marginPct: 0.1, maxOpenLoads: 40 }] }, "brokerage"]);
      // In view, the brokerage gives orders by default; capital home lands with the carrier, less the fee.
      g.inView = "brokerage";
      expect(g.player).toBe(b);
      const before = g.w.ledger.balance(companyAccount(c.id));
      expect(g.act({ type: "transfer_capital", fd: 1_000 }).ok).toBe(true);
      expect(g.w.ledger.balance(companyAccount(c.id)) - before).toBeCloseTo(1_000, 6);
      // A second brokerage is never offered.
      g.inView = "carrier";
      expect(g.act({ type: "form_brokerage", name: "Again", capitalFd: capital }, "carrier").ok).toBe(false);
    }), 60_000);
});

describe("the brokerage's Book (QA's hold replay, S1–S3)", () => {
  it("offers aren't posts, a load tendered to the own carrier is its own state, and Tender is refused with the reason", () =>
    withBrokerage(async () => {
      const g = await TestGame.create();
      const c = g.join("Red River Lines", "fleet", "DAL")!;
      if (g.w.ladder) g.w.ladder.brokerage = Math.floor(g.w.t / g.w.cfg.time.gameMinutesPerDay);
      g.w.ledger.post(g.w.t, "faucet:test", companyAccount(c.id), 120_000, "test");
      const capital = g.w.cfg.token.staking.roles.broker + g.w.cfg.permits.brokerLicenseRenewalFd + 5_000;
      expect(g.act({ type: "form_brokerage", name: "Red River Logistics", capitalFd: capital }, "carrier").ok).toBe(true);
      const b = g.brokerage!;
      // Three open loads made the brokerage's: one held as an offer, one tendered to the carrier, one on the board.
      const [held, tendered, posted] = [...g.w.loads.values()].filter((l) => l.status === "open" && l.shipperId === null).slice(0, 3);
      for (const l of [held!, tendered!, posted!]) l.brokerId = b.id;
      held!.hold = { brokerId: b.id, until: g.w.t + 600, declinable: true };
      tendered!.tenderedTo = c.id;
      tendered!.ownTenderRate = 2.48;
      const s = bookStates(g.w, b);
      expect(s.held).toEqual([held]);
      expect(s.tendered).toEqual([tendered]);
      expect(s.onBoard).toContain(posted);
      expect(s.onBoard).not.toContain(held);
      expect(s.onBoard).not.toContain(tendered);
      // No truck of the carrier free near the pickup: the button's reason is the writer's.
      for (const t of g.w.trucksByCompany.get(c.id) ?? []) t.status = "parked";
      expect(carrierCantTake(g.w, c, posted!)).toBe(BROKERAGE.refuseNoTruck("Red River Lines"));
      expect(poss("Red River Logistics")).toBe("Red River Logistics'");
      expect(poss("Red River Lines")).toBe("Red River Lines'");
      expect(poss("Scioto Freight")).toBe("Scioto Freight's");
    }), 60_000);
});
