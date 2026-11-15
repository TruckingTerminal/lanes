import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { createWorld, formCompany, MILESTONES, openLogbook, refile, repDelivered, repFailed, reputationParts, restart, safetyPart, scoreBid, startLiquidation, type Company, type Load, type World } from "@lanes/engine";

/**
 * Reputation in three parts (reputation.threeParts, off by default; the director's ruling of 2026-11-14, the economy's
 * sizes in economy-reputation-2026-11-15.md, the red team's R1–R3 and L3): its tests as the economy listed them.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const ON = { ...LIVE, reputation: { ...LIVE.reputation, threeParts: { ...LIVE.reputation.threeParts, enabled: true } } } as EconomyConfig;
const DAY = LIVE.time.gameMinutesPerDay;

function world(cfg: EconomyConfig): { w: World; c: Company } {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 13 });
  populate(w, { freeOwnerOperators: 2, fleets: 0, brokers: 1 });
  const c = formCompany(w, { name: "Record Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
  return { w, c };
}
/** A load as repDelivered reads it: NPC-paid unless `shipper`, 500 miles unless said. */
const load = (o: { miles?: number; shipper?: number } = {}) => ({ miles: o.miles ?? 500, shipperId: o.shipper ?? null }) as unknown as Load;
const deliver = (w: World, c: Company, n: number, o: { miles?: number; shipper?: number; late?: boolean } = {}) => {
  for (let i = 0; i < n; i++) repDelivered(w, c, load(o), o.late === true, false);
};

describe("reputation in three parts (reputation.threeParts)", () => {
  it("off: no state, and the on-time rate as before", () => {
    const { w, c } = world(LIVE);
    expect(c.reputation).toBe(LIVE.reputation.start);
    deliver(w, c, 5);
    repFailed(w, c, "release");
    expect(c.rep3).toBeUndefined();
    expect(c.reputation).toBe(LIVE.reputation.start);
  });

  it("a new company reads 0.945; thirty loads make it 1.00 with a clean record; ninety idle days halve its experience", () => {
    const { w, c } = world(ON);
    expect(c.reputation).toBeCloseTo(1 - ON.reputation.threeParts.experience, 9);
    deliver(w, c, 30);
    expect(c.reputation).toBeCloseTo(1, 9);
    w.t += 90 * DAY;
    const p = reputationParts(w, c);
    expect(p.loads).toBeCloseTo(15, 6);
    expect(p.e).toBeCloseTo(0.5, 6);
  });

  it("two releases in 90 days on 40 loads put service near 0.4; on 300 loads, under 0.07", () => {
    for (const [loads, below] of [[40, 0.41], [300, 0.07]] as const) {
      const { w, c } = world(ON);
      deliver(w, c, loads);
      repFailed(w, c, "release");
      repFailed(w, c, "release");
      const p = reputationParts(w, c);
      expect(p.f).toBeLessThan(below);
      if (loads === 40) expect(p.f).toBeCloseTo(0.4, 6);
      expect(p.failures.release).toBe(2);
    }
  });

  it("the safety record: a violation lowers it, an alert floors it at 0.75, unsatisfactory sets it to 1", () => {
    const { w, c } = world(ON);
    expect(safetyPart(w, c)).toBe(0);
    c.safety.measures = { ...c.safety.measures, maintenance: 0.2 };
    expect(safetyPart(w, c)).toBeCloseTo(0.2, 9);
    c.safety.alerts = ["maintenance"];
    expect(safetyPart(w, c)).toBe(0.75);
    c.safety.rating = "unsatisfactory";
    expect(safetyPart(w, c)).toBe(1);
  });

  it("the bid score's reputation term spans at most 0.0633 of the score", () => {
    const k = ON.reputation.threeParts;
    const worst = 1 - k.safety - k.service - k.experience;
    expect(worst).toBeCloseTo(0.747, 9);
    const { w } = world(ON);
    const span = scoreBid(w, 3, 2.5, 1, 100) - scoreBid(w, 3, 2.5, worst, 100);
    expect(span).toBeCloseTo(0.25 * 0.253, 9);
  });

  it("experience counts an NPC-paid load by its miles, never the company's own freight or a player shipper's (the red team's R1)", () => {
    const { w, c } = world(ON);
    deliver(w, c, 10, { shipper: c.id });
    expect(reputationParts(w, c).loads).toBe(0);
    deliver(w, c, 10, { miles: 50 });
    expect(reputationParts(w, c).loads).toBeCloseTo(1, 9);
  });

  it("a bankruptcy's fresh start keeps the service failures and starts experience over (R2); a refile keeps the old safety part a year (R3)", () => {
    const { w, c } = world(ON);
    deliver(w, c, 30);
    repFailed(w, c, "noShow");
    startLiquidation(w, c);
    restart(w, c);
    const p = reputationParts(w, c);
    expect(p.loads).toBe(0);
    expect(p.failures.noShow).toBe(1);
    expect(c.rep3!.f).toBeGreaterThan(0.99);
    c.safety.rating = "unsatisfactory";
    refile(w, c);
    expect(c.safety.rating).not.toBe("unsatisfactory");
    expect(safetyPart(w, c)).toBe(1);
    w.t += 366 * DAY;
    expect(safetyPart(w, c)).toBe(0);
  });
});

describe("the logbook's service milestones (token.airdrop.logbook.serviceMilestones, the red team's L3)", () => {
  const SERVICE = { ...LIVE, token: { ...LIVE.token, airdrop: { ...LIVE.token.airdrop, logbook: { ...LIVE.token.airdrop.logbook, serviceMilestones: true } } } } as EconomyConfig;
  const onTime = MILESTONES.find((m) => m.id === "onTime")!;
  const clean = MILESTONES.find((m) => m.id === "cleanQuarter")!;

  it("100 loads at 95% reads service failures: releases and no-shows count against it, as late deliveries do", () => {
    const { w, c } = world(SERVICE);
    const lb = openLogbook(w, c, 1_000);
    c.delivered += 100;
    c.onTime += 100; // all on time under one deadline
    expect(onTime.reached(w, c, lb)).toBe(true);
    c.failed = (c.failed ?? 0) + 6; // six releases and no-shows: 6 of 106
    expect(onTime.reached(w, c, lb)).toBe(false);
    const off = world(LIVE);
    const lb0 = openLogbook(off.w, off.c, 1_000);
    off.c.delivered += 100;
    off.c.onTime += 100;
    off.c.failed = 6;
    expect(onTime.reached(off.w, off.c, lb0)).toBe(true); // as before: the on-time share alone
  });

  it("a clean quarter counts the quarter's windows failures and cargo claims", () => {
    const { w, c } = world(SERVICE);
    const lb = openLogbook(w, c, 1_000);
    lb.handled = 30;
    w.t += 100 * DAY;
    expect(clean.reached(w, c, lb)).toBe(true);
    repFailed(w, c, "late");
    expect(clean.reached(w, c, lb)).toBe(false);
  });
});
