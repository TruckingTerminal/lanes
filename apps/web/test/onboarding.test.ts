import "./seed.js";
import { describe, expect, it } from "vitest";
import type { Company, World } from "@lanes/engine";
import { freshOnboard, parseOnboard } from "../src/onboard.js";
import { MORE, NAV, navOf, TAB_IDS, TAB_NAME, TABS, tabLabel } from "../src/tabs.js";

describe("the tab registry", () => {
  it("lists every tab once, in the order of its ids, each with a name", () => {
    expect(TABS.map((t) => t.id)).toEqual([...TAB_IDS]);
    for (const id of TAB_IDS) expect(TAB_NAME[id]).toBeTruthy();
  });

  it("puts four in the nav and everything else under More", () => {
    expect([...NAV]).toEqual(["fleet", "loads", "money", "more"]);
    expect(TAB_NAME.fleet).toBe("Truck");
    for (const t of MORE) expect(navOf(t)).toBe("more");
    for (const t of TABS.filter((d) => d.teaser)) expect(navOf(t.id)).toBe("more");
    expect(TABS.filter((d) => d.teaser).map((d) => d.label)).toEqual(["Staff", "Dealer", "Rates", "Logbook", "Finance", "Economy", "Business", "Back Lot", "Brokerage"]);
  });

  it("reads Truck as Trucks from the second truck", () => {
    const w = (n: number) => ({ trucksByCompany: new Map([[1, Array.from({ length: n }, () => ({ status: "idle" }))]]) }) as unknown as World;
    const c = { id: 1 } as Company;
    expect(tabLabel("fleet", w(1), c)).toBe("Truck");
    expect(tabLabel("fleet", w(2), c)).toBe("Trucks");
  });
});

describe("the onboarding record", () => {
  it("reads nothing, garbage, an older version or a wrong shape as a fresh start", () => {
    expect(parseOnboard(null)).toEqual(freshOnboard());
    expect(parseOnboard("{not json")).toEqual(freshOnboard());
    expect(parseOnboard("null")).toEqual(freshOnboard());
    expect(parseOnboard(JSON.stringify({ v: 0, seen: ["welcome"] }))).toEqual(freshOnboard());
    expect(parseOnboard(JSON.stringify({ v: 1, seen: "welcome", boardVisited: "yes" }))).toEqual(freshOnboard());
  });

  it("keeps what it can read and drops the rest", () => {
    const o = parseOnboard(JSON.stringify({ v: 1, seen: ["welcome", 3, "board"], boardVisited: true, extra: 1 }));
    expect(o).toEqual({ v: 1, seen: ["welcome", "board"], boardVisited: true, visited: [] });
  });

  it("round-trips through its stored text", () => {
    const o = { v: 1 as const, seen: ["welcome"], boardVisited: true, visited: ["staff"] };
    expect(parseOnboard(JSON.stringify(o))).toEqual(o);
  });
});
