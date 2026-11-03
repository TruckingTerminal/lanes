import { describe, expect, it } from "vitest";
import { companyAccount } from "@lanes/engine";
import { GAME_CONFIG, TestGame } from "../src/game.js";

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
