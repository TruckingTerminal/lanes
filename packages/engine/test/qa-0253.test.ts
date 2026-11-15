import { describe, expect, it } from "vitest";
import { withLiveLevers } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { applyAction, createWorld, dailyDrivers, dayOf, hubMiles, placeOfHub, seatBlock, seatReach, unseatDriver, type Truck, type World } from "@lanes/engine";

/**
 * QA's 0.25.3 replay (qa-0253-2026-11-15.md, fix soon 1 and lower): a driver is seated only where they can reach the
 * truck, the page offers only that (labor.ts seatBlock), and every refusal or notice names towns, never airport codes or
 * the market's hub for a town in it.
 */
const LIVE = withLiveLevers(); // 0.25.3: the bus home, home by hub, and R12's clocks on
const net = buildNetwork(hubs, LIVE);

function fleet() {
  const w: World = createWorld({ cfg: LIVE, net, feeds: neutralFeeds, seed: 13 });
  populate(w, { freeOwnerOperators: 0, fleets: 4, brokers: 1 });
  const c = w.companies.find((x) => x.role === "carrier" && (w.trucksByCompany.get(x.id) ?? []).filter((t) => t.driverId > 0).length >= 2)!;
  const [a, b] = w.trucksByCompany.get(c.id)!.filter((t) => t.driverId > 0) as [Truck, Truck];
  // Two towns that aren't their markets' hubs, far from home, in different markets.
  const town = (not: number) => w.net.places.findIndex((p) => p.market !== not && w.net.places[placeOfHub(p.market)]!.name !== p.name && hubMiles(w, p.market, c.homeHub) > 400);
  const pA = town(-1);
  const hA = w.net.places[pA]!.market;
  const pB = town(hA);
  const hB = w.net.places[pB]!.market;
  for (const [t, p, h] of [
    [a, pA, hA],
    [b, pB, hB],
  ] as const)
    Object.assign(t, { status: "idle", loadId: null, hub: h, targetHub: h, place: p, targetPlace: p, remainingMi: 0 });
  return { w, c, a, b, pA, pB };
}

describe("QA's 0.25.3 replay: the seat a driver can reach", () => {
  it("off a truck in one town, not seated in a truck in another market; the refusal names both towns, and the page's check is the action's", () => {
    const { w, c, a, b, pA, pB } = fleet();
    const name = (p: number) => w.net.places[p]!.name;
    const s = w.staff[a.driverId - 1]!;
    unseatDriver(w, s);
    expect(s.lastPlace).toBe(pA);
    unseatDriver(w, w.staff[b.driverId - 1]!); // Truck B stands empty
    const r = applyAction(w, c.id, { type: "assign_driver", staffId: s.id, truckId: b.id });
    expect(r).toEqual({ ok: false, reason: `they're at ${name(pA)}, and that truck is at ${name(pB)}` });
    expect(seatBlock(w, c, s, b, false)).toBe((r as { reason: string }).reason);
    expect((r as { reason: string }).reason).not.toMatch(/\b[A-Z]{3}\b/);
    // Where they stand, their own truck: the seat is theirs.
    expect(seatBlock(w, c, s, a, false)).toBeNull();
    // On the bus home: no seat anywhere until they're home.
    s.bus = { from: a.hub, miles: 900, fareFd: 0, leftT: w.t, arriveDay: dayOf(w.t, w.cfg) + 2 };
    expect(seatReach(w, s, a)).toBe("they're on the bus home");
    expect(applyAction(w, c.id, { type: "assign_driver", staffId: s.id, truckId: a.id })).toEqual({ ok: false, reason: "they're on the bus home" });
  });

  it("the bus notice names the town where the driver stepped off, not its market's hub", () => {
    const { w, c, a, pA } = fleet();
    const s = w.staff[a.driverId - 1]!;
    unseatDriver(w, s);
    a.status = "listed"; // no empty truck of theirs there to wait for
    const notes: string[] = [];
    w.listener = (e) => void (e.kind === "notice" && e.companyId === c.id && notes.push(e.text));
    dailyDrivers(w);
    const bus = notes.find((x) => x.startsWith("No truck for "))!;
    expect(bus).toContain(` at ${w.net.places[pA]!.name}, so`);
    expect(bus).not.toContain(` at ${w.net.hubs[a.hub]!.name}, so`);
  });
});
