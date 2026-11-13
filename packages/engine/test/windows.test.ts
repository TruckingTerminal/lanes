import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, COMMODITIES, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import {
  boardKey,
  companyAccount,
  createWorld,
  dayOf,
  dockHoursAt,
  dockRule,
  drawLeadDays,
  indexOpenLoads,
  isRoundBoundary,
  nextOpen,
  openWindow,
  readyKey,
  stepHour,
  transitMinutes,
  type Load,
  type World,
} from "@lanes/engine";

/**
 * Item 4 batch 1, delivery windows: windows and loss (windows.ts; engineering-item4-delivery-windows.md, tests 1, 2, 6, 7
 * and 8). On the live profile, as the live world runs.
 */
const LIVE = withLiveLevers();
const ON: EconomyConfig = { ...LIVE, windows: { ...LIVE.windows, enabled: true } };
// Windows off by its own key: on in the live levers since 0.25.0.
const OFF: EconomyConfig = { ...LIVE, windows: { ...LIVE.windows, enabled: false } };
const net = buildNetwork(hubs, LIVE);
const DAY = LIVE.time.gameMinutesPerDay;
const ROUND = DAY / LIVE.time.boardRoundHours.length;

/** A world of brokers and no carriers: nothing is ever booked, so every load lives out its window. */
function brokersOnly(seed: number): World {
  const w = createWorld({ cfg: ON, net, feeds: neutralFeeds, seed, keepLedgerEntries: true });
  populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
  return w;
}
/** Steps to the next round boundary, inclusive of it. */
function toNextRound(w: World): void {
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
}
const ownedLoads = (w: World, pred: (l: Load) => boolean): Load[] => [...w.loads.values()].filter((l) => l.status === "open" && l.hold === undefined && pred(l));

describe("delivery windows off (test 1)", () => {
  /** The ten-day world's digest: the clock, the books, every day's metrics, the board and the trucks. */
  function digest(cfg: EconomyConfig): string {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 20_261_109 });
    populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 6 });
    for (let h = 0; h < 10 * 24; h++) stepHour(w, ruleBotHook);
    const s = JSON.stringify({
      t: w.t,
      next: w.nextLoadId,
      supply: w.ledger.supply(),
      books: w.companies.map((c) => [c.id, w.ledger.balance(companyAccount(c.id)), c.delivered, c.onTime, c.operating]),
      days: w.metrics.days,
      loads: [...w.loads.values()],
      trucks: w.trucks,
    });
    return createHash("sha256").update(s).digest("hex").slice(0, 16);
  }

  it("leaves the ten-day world byte-identical with the key false and with it absent, as at HEAD before windows", () => {
    const { windows: _, ...absent } = OFF;
    const off = digest(OFF);
    expect(digest(absent as unknown as EconomyConfig)).toBe(off);
    // The record, not a pin: this world read 8015ff2ae10527c4 at 0c03873 (before the windows code) and on this tree, on the
    // Mac Studio's Node 26; CI's Node 22 reads c06f5b2fd6c6c451 for the same world, so the digest is not the same across
    // JavaScript engines and a hard-coded value cannot be asserted (the producer, 2026-11-09; the cross-engine difference is
    // an open determinism item). The off path's identity with HEAD is checked at each commit by a 60-day live-profile sim in
    // the verification worktree; the absent-and-false pair above holds on any engine.
    expect(off).toMatch(/^[0-9a-f]{16}$/);
  }, 120_000);
});

describe("delivery windows on: posting (test 2)", () => {
  it("draws lead days by the weights, within three points of each", () => {
    const w = createWorld({ cfg: ON, net, feeds: neutralFeeds, seed: 2 });
    const n = 20_000;
    const days = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) days[drawLeadDays(w)]!++;
    const buckets = [days[0]!, days[1]!, days[2]!, days[3]! + days[4]! + days[5]!].map((c) => c / n);
    ON.windows.leadDays.forEach(([, , weight], i) => expect(Math.abs(buckets[i]! - weight)).toBeLessThan(0.03));
    // Three to five days: a day inside the bucket, each about a third of it.
    for (const d of [3, 4, 5]) expect(Math.abs(days[d]! / n - 0.1 / 3)).toBeLessThan(0.01);
  });

  it("posts each load ready at an open dock, with its pickup window and a deadline that covers the legal transit; the index files it by ready day", () => {
    const w = brokersOnly(3);
    const postedAt = new Map<number, number>();
    for (let r = 0; r < 6; r++) {
      toNextRound(w);
      for (const l of w.loads.values()) if (l.postedRound === w.round && !postedAt.has(l.id)) postedAt.set(l.id, w.t);
      // The index: a round's work is the freight ready today; a later day's is filed under that day.
      const today = dayOf(w.t, w.cfg);
      for (const [key, loads] of indexOpenLoads(w)) {
        for (const l of loads) {
          const ready = dayOf(l.readyT!, w.cfg);
          expect(key).toBe(ready > today ? readyKey(l.origin, l.equipment, ready) : boardKey(l.origin, l.equipment));
        }
      }
    }
    expect(postedAt.size).toBeGreaterThan(500);
    const legalPace = w.cfg.hos.drivingHoursPerDay;
    const leads = new Set<number>();
    let hot = 0;
    for (const [id, t] of postedAt) {
      const l = w.loads.get(id);
      if (!l) continue; // lost already: its window was checked while it was on the board, by the same rule
      const { readyT, latestPickupT, latestDeliveryT } = l as Required<Load>;
      expect(readyT).toBeGreaterThanOrEqual(t);
      leads.add(dayOf(readyT, w.cfg) - dayOf(t, w.cfg));
      const hours = w.cfg.docks.enabled ? dockHoursAt(w, l, "pickup") : null;
      if (hours) expect(nextOpen(w, readyT, hours)).toBe(readyT);
      const k = w.cfg.windows.pickupHours;
      expect(latestPickupT - readyT).toBe((dockRule(w, l) === "appointment" ? k.appointment : k.firstCome) * 60);
      const legal = transitMinutes(w.cfg, l.routeHours, legalPace);
      expect(l.appointmentT).toBeGreaterThanOrEqual(readyT);
      expect(l.appointmentT).toBeLessThanOrEqual(latestDeliveryT);
      if (l.hot > 0) {
        hot++;
        // Today's hot rule, counted from the moment it's ready: the hot pace's transit, the dock time and its slack, far
        // tighter than an ordinary load's deadline.
        const hl = w.cfg.safety.hotLoads;
        const ops = w.cfg.equipmentOps;
        const dwell = w.cfg.dwell.loadMinutes[1] + w.cfg.dwell.unloadMinutes[1] + (ops.enabled && l.equipment === "flatbed" ? ops.flatbedSecureMinutes[1] + ops.flatbedUntarpMinutes[1] : 0);
        expect(latestDeliveryT).toBeCloseTo(readyT + transitMinutes(w.cfg, l.routeHours, hl.hoursPerDay) + dwell + hl.slackMinutes, 6);
        expect(latestDeliveryT).toBeLessThan(latestPickupT + legal + COMMODITIES[l.commodity]!.windowHours * 60);
      } else {
        expect(latestDeliveryT - latestPickupT).toBeCloseTo(legal + COMMODITIES[l.commodity]!.windowHours * 60, 6);
        expect(latestDeliveryT - latestPickupT).toBeGreaterThanOrEqual(legal);
      }
    }
    expect(hot).toBeGreaterThan(0);
    for (const d of [0, 1, 2, 3]) expect(leads.has(d)).toBe(true);
  }, 120_000);
});

describe("delivery windows on: the board (tests 6, 7 and 8)", () => {
  it("loses an unbooked load when its pickup closes: no ten-round give-up, no slide, the poster's claim, counted by poster", () => {
    const w = brokersOnly(6);
    toNextRound(w);
    const direct = ownedLoads(w, (l) => l.brokerId === null && l.shipperId === null && l.hot === 0 && l.contractId === 0)[0]!;
    const brokered = ownedLoads(w, (l) => l.brokerId !== null && l.hot === 0)[0]!;
    const reposted = ownedLoads(w, (l) => l.brokerId !== null && l.brokerId !== brokered.brokerId && l.hot === 0)[0]!;
    // Five days out: longer than the ten rounds today's board gives a load.
    openWindow(w, direct, 5);
    expect(direct.latestPickupT! - w.t).toBeGreaterThan(w.cfg.board.giveUpAfterRounds * ROUND);
    // A broker's load re-posted by another broker (double brokering): the re-poster owes its upstream the same share.
    const reposter = w.companies.find((c) => c.role === "broker" && c.id !== reposted.brokerId)!;
    reposted.doubleBroker = { companyId: reposter.id, upstreamRate: reposted.ceiling * 0.97, pays: true };
    const watch = [direct, brokered, reposted].map((l) => ({ l, appt: l.appointmentT, gone: 0 }));
    while (watch.some((x) => !x.gone)) {
      toNextRound(w);
      for (const x of watch) {
        if (x.gone) continue;
        if (w.loads.has(x.l.id)) {
          expect(w.t).toBeLessThan(x.l.latestPickupT!);
          expect(x.l.appointmentT).toBe(x.appt);
        } else x.gone = w.t;
      }
    }
    // Lost at the first round once the pickup closed, never earlier, never later.
    for (const x of watch) {
      expect(x.gone).toBeGreaterThanOrEqual(x.l.latestPickupT!);
      expect(x.gone - x.l.latestPickupT!).toBeLessThan(ROUND);
    }
    expect(direct.roundsUnfilled).toBeGreaterThan(w.cfg.board.giveUpAfterRounds);
    const share = w.cfg.brokerRisk.fallOffShare;
    const byRef = (l: Load) => w.ledger.entries.filter((e) => e.ref === `load:${l.id}`);
    // NPC direct freight: lost and counted, no claim.
    expect(byRef(direct)).toEqual([]);
    // A broker's: its fall-off charge, the share of its contract, to the sink.
    expect(byRef(brokered)).toEqual([expect.objectContaining({ from: companyAccount(brokered.brokerId!), to: "sink:broker_falloff" })]);
    expect(byRef(brokered)[0]!.amount).toBeCloseTo(share * brokered.shipperRate * brokered.miles, 2);
    // A re-post: the broker pays the sink on its contract; the re-poster pays the broker on the rate it took it at.
    const rp = byRef(reposted);
    expect(rp.find((e) => e.to === "sink:broker_falloff")!.amount).toBeCloseTo(share * reposted.shipperRate * reposted.miles, 2);
    const up = rp.find((e) => e.from === companyAccount(reposter.id))!;
    expect(up.to).toBe(companyAccount(reposted.brokerId!));
    expect(up.amount).toBeCloseTo(share * reposted.doubleBroker!.upstreamRate * reposted.miles, 2);
    // Counted by who posted it, at what its shipper would have paid; every load lost in this world counts in `expired`.
    while (w.t % DAY !== 0) stepHour(w);
    const days = w.metrics.days;
    const lost = (k: "npc" | "broker") => days.reduce((s, d) => s + d.lostLoads![k], 0);
    expect(lost("npc")).toBeGreaterThan(0);
    expect(lost("broker")).toBeGreaterThan(0);
    expect(days.reduce((s, d) => s + d.lostLoads!.npc + d.lostLoads!.broker + d.lostLoads!.brokerage + d.lostLoads!.shipper, 0)).toBe(days.reduce((s, d) => s + d.expired, 0));
    expect(days.reduce((s, d) => s + d.lostFd!.npc, 0)).toBeGreaterThan(0);
  }, 120_000);

  it("keeps the claim shares the batches after read, in their order (test 7, the shares that exist now)", () => {
    const k = ON.windows;
    expect([k.lateClaimShare, k.noShowClaimShare, k.cancelClaimShare.early, k.cancelClaimShare.urgent]).toEqual([0.2, 0.25, 0.1, 0.25]);
    expect(k.cancelClaimShare.early).toBeLessThan(k.lateClaimShare);
    expect(k.lateClaimShare).toBeLessThan(k.noShowClaimShare);
    expect(k.cancelClaimShare.urgent).toBe(k.noShowClaimShare);
    // The lost shipment's claim is the fall-off share: one figure for "the shipper gave up".
    expect(ON.brokerRisk.fallOffShare).toBe(0.1); // Jeff, 2026-11-13: the brokers' charge at 10% (0.25.0)
  });

  it("holds the price while slack remains, walks it in the last two rounds never over the ceiling, and never walks a player poster's pay (test 8)", () => {
    const w = brokersOnly(8);
    toNextRound(w);
    const direct = ownedLoads(w, (l) => l.brokerId === null && l.shipperId === null && l.contractId === 0 && l.hot === 0)[0]!;
    const brokered = ownedLoads(w, (l) => l.brokerId !== null && l.hot === 0)[0]!;
    const hot = ownedLoads(w, (l) => l.brokerId === null && l.shipperId === null && l.hot > 0)[0]!;
    const players = ownedLoads(w, (l) => l.brokerId !== null && l.brokerId !== brokered.brokerId && l.hot === 0)[0]!;
    // A person's brokerage: its pay never walks (QA's S4).
    w.companies[players.brokerId! - 1]!.human = true;
    const watch = [direct, brokered, hot, players].map((l) => {
      openWindow(w, l, 2);
      return { l, ceiling: l.ceiling, bookNow: l.bookNow, appt: l.appointmentT, steps: 0 };
    });
    const reach = brokered.shipperRate * (1 + w.cfg.brokerRisk.fallOffShare);
    while (watch.some((x) => w.loads.has(x.l.id))) {
      const before = w.t;
      toNextRound(w);
      for (const x of watch) {
        const l = x.l;
        if (!w.loads.has(l.id)) continue;
        expect(l.appointmentT).toBe(x.appt);
        expect(l.bookNow).toBeLessThanOrEqual(l.ceiling + 1e-9);
        const steps = l.urgentSteps ?? 0;
        expect(steps).toBeLessThanOrEqual(w.cfg.windows.urgencyRounds);
        if (l.latestPickupT! - w.t > w.cfg.windows.urgencyRounds * ROUND || l === players) {
          // Slack left (or a player's load): flat.
          expect(l.ceiling).toBe(x.ceiling);
          expect(l.bookNow).toBe(x.bookNow);
          if (l !== players) expect(steps).toBe(0);
          continue;
        }
        expect(steps).toBe(x.steps + 1);
        x.steps = steps;
        if (l === brokered) {
          // The broker eats the raise up to its fall-off reach.
          expect(l.ceiling).toBeGreaterThan(x.ceiling - 1e-9);
          expect(l.ceiling).toBeLessThanOrEqual(Math.max(reach, l.spotShipperRate, x.ceiling) + 1e-9);
        } else {
          // An NPC shipper raises it a step a round (the hot premium inside it, never stacked past it), and book-now walks to it.
          expect(l.ceiling).toBeCloseTo(x.ceiling * (1 + w.cfg.board.rolloverCeilingStep) ** steps, 9);
          expect(l.bookNow).toBeCloseTo(x.bookNow + (l.ceiling - x.bookNow) * Math.min(1, steps / w.cfg.windows.urgencyRounds), 9);
        }
      }
      expect(w.t).toBeGreaterThan(before);
    }
    // Every walking load took both steps before it was lost; book-now reached the ceiling.
    for (const x of watch) if (x.l !== players) expect(x.steps).toBe(w.cfg.windows.urgencyRounds);
    expect(direct.bookNow).toBeCloseTo(direct.ceiling, 9);
  }, 120_000);
});
