import { describe, expect, it } from "vitest";
import { populate } from "@lanes/agents";
import { economyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { companyName, createWorld, formCompany } from "../src/index.js";

const world = (seed: number) => createWorld({ cfg: economyConfig, net: buildNetwork(hubs, economyConfig), feeds: neutralFeeds, seed });

/** What the sim drew for the population, name aside: the same before and after the names (a digest of seed 7's 148). */
function digest(seed: number): string {
  const w = world(seed);
  populate(w, { freeOwnerOperators: 120, fleets: 20, brokers: 8 });
  let h = 2166136261;
  const mix = (x: string) => {
    for (let i = 0; i < x.length; i++) h = Math.imul(h ^ x.charCodeAt(i), 16777619) >>> 0;
  };
  for (const c of w.companies) {
    const trucks = w.trucksByCompany.get(c.id) ?? [];
    mix(`${c.role}|${c.homeHub}|${c.strategy}|${c.usd.wallet.toFixed(2)}|${c.authority.since}|${trucks.map((t) => `${t.tier}:${t.trailer}:${t.odometer}`).join(",")}|`);
  }
  mix(`staff:${w.staff.length}|t:${w.t}`);
  return (h >>> 0).toString(16);
}

describe("company names (every carrier and broker has one)", () => {
  it("names the whole population, uniquely, with no placeholder left", () => {
    const w = world(11);
    populate(w, { freeOwnerOperators: 400, fleets: 120, brokers: 60 });
    const names = w.companies.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).not.toMatch(/^(OO|Fleet|Broker|New|Wave|Sybil)-\d/);
    for (const n of names) expect(n).toMatch(/^[A-Z]/);
    // Brokers read as brokers, carriers as carriers.
    const brokers = w.companies.filter((c) => c.role === "broker").map((c) => c.name);
    expect(brokers.some((n) => /Logistics|Freight|Brokers|Brokerage|Transport Services/.test(n))).toBe(true);
    const fleets = w.companies.filter((c) => c.strategy.startsWith("fleet:")).map((c) => c.name);
    // Some fleets carry their home city's name.
    expect(fleets.some((n) => hubs.some((h) => n.startsWith(`${h.name} `)))).toBe(true);
  });

  it("draws the same names for the same world whatever else was drawn, and different ones for another seed", () => {
    const a = world(5);
    const b = world(5);
    for (let i = 0; i < 25; i++) b.rng.agents.next();
    const c = world(6);
    const kinds = ["oo", "fleet", "broker"] as const;
    for (let i = 0; i < 30; i++) {
      const kind = kinds[i % 3]!;
      const na = companyName(a, kind, "DAL");
      const nb = companyName(b, kind, "DAL");
      expect(nb).toBe(na);
      for (const w of [a, b, c]) formCompany(w, { name: w === c ? companyName(c, kind, "DAL") : na, role: kind === "broker" ? "broker" : "carrier", homeHubId: "DAL", strategy: `${kind}:test`, orders: [], freePath: kind === "oo" });
    }
    expect(c.companies.map((x) => x.name)).not.toEqual(a.companies.map((x) => x.name));
  });

  it("leaves the population's own draws exactly as they were", () => {
    expect(digest(7)).toBe("351e88da");
  });
});
