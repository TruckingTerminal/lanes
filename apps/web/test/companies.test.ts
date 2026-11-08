import "./seed.js";
import { describe, expect, it } from "vitest";
import { hasTwo, kindInView, navFor, switchCompany } from "../src/companies.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { myTrucks, S } from "../src/state.js";
import { needs } from "../src/logic.js";
import { BROKER_NAV, NAV, navOf } from "../src/tabs.js";

/** Flips `brokerage.enabled` for one test (the config is read-only to the game; tests may vary it). */
function withBrokerage<T>(on: boolean, fn: () => T): T {
  const k = GAME_CONFIG.brokerage as { enabled: boolean };
  const was = k.enabled;
  k.enabled = on;
  try {
    return fn();
  } finally {
    k.enabled = was;
  }
}

describe("two companies under one login (companies.ts)", () => {
  it("keeps one company and the carrier's bar while the switch is off, or until a brokerage exists", async () => {
    const g = await TestGame.create();
    const c = g.join("Pair Freight", "oo", "LAX")!;
    expect(g.carrier).toBe(c);
    expect(g.player).toBe(c);
    // In view with no brokerage: still the carrier.
    g.inView = "brokerage";
    expect(g.player).toBe(c);
    g.inView = "carrier";
    const broker = g.w.companies.find((x) => x.role === "broker")!;
    g.brokerage = broker;
    withBrokerage(false, () => {
      expect(hasTwo(g)).toBe(false);
      expect(kindInView(g)).toBe("carrier");
      expect(navFor(g)).toBe(NAV);
    });
  }, 60_000);

  it("switches between the two, each with its own bar; switching changes nothing in the world", async () => {
    const g = await TestGame.create();
    const c = g.join("Pair Freight", "oo", "LAX")!;
    const broker = g.w.companies.find((x) => x.role === "broker")!;
    g.brokerage = broker;
    S.game = g;
    withBrokerage(true, () => {
      const t = g.w.t;
      expect(hasTwo(g)).toBe(true);
      switchCompany("brokerage");
      expect(g.player).toBe(broker);
      expect(S.tab).toBe("book");
      expect(navFor(g)).toEqual([...BROKER_NAV]);
      switchCompany("carrier");
      expect(g.player).toBe(c);
      expect(S.tab).toBe("fleet");
      expect(g.w.t).toBe(t);
    });
    S.game = null;
  }, 60_000);

  it("counts both companies' needs and says whose each is; the map's own trucks stay the carrier's", async () => {
    const g = await TestGame.create();
    const c = g.join("Pair Freight", "fleet", "LAX")!;
    g.brokerage = g.w.companies.find((x) => x.role === "broker")!;
    S.game = g;
    withBrokerage(true, () => {
      // The fleet's second truck has no driver: a need of the carrier's, whichever company is in view.
      const carrierOnly = needs().filter((n) => n.company === "carrier");
      expect(carrierOnly.length).toBeGreaterThan(0);
      expect(needs().every((n) => n.company === "carrier" || n.company === "brokerage")).toBe(true);
      // A brokerage runs no trucks: none of the carrier's truck needs is counted twice under it.
      expect(needs().filter((n) => n.company === "brokerage" && /(driver|idle|tired):/.test(n.key))).toEqual([]);
      switchCompany("brokerage");
      const fromBroker = needs();
      expect(fromBroker.filter((n) => n.company === "carrier").length).toBe(carrierOnly.length);
      expect(fromBroker.filter((n) => n.company === "carrier").every((n) => n.key.startsWith("carrier:"))).toBe(true);
      expect(kindInView(g)).toBe("brokerage");
      expect(myTrucks().map((t) => t.companyId)).toEqual(myTrucks().map(() => c.id));
      expect(myTrucks().length).toBe(2);
      switchCompany("carrier");
    });
    S.game = null;
  }, 60_000);

  it("holds the bond's two keys at one figure: the stake the rules read, and the face the surety premium is charged on", () => {
    expect(GAME_CONFIG.permits.brokerBondFd).toBe(GAME_CONFIG.token.staking.roles.broker);
  });

  it("puts Book and Carriers in the brokerage's bar, not under More", () => {
    expect([...BROKER_NAV]).toEqual(["book", "carriers", "money", "more"]);
    expect(navOf("book")).toBe("book");
    expect(navOf("carriers")).toBe("carriers");
  });
});
