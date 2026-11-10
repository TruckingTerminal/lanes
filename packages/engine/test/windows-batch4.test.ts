import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import {
  afterBreakdown,
  applyAction,
  canMake,
  companyAccount,
  createWorld,
  EQUIPMENT,
  formCompany,
  isRoundBoundary,
  lostMemory,
  mayTake,
  noteLost,
  placeMiles,
  planIndex,
  stepHour,
  vettingBlock,
  type Load,
  type World,
} from "@lanes/engine";

/**
 * Item 4 batch 4 (the economy's sizing, studio/reviews/economy-delivery-windows-sizing.md; the director's amendments and
 * Jeff's yes, DECISIONS.md 2026-11-09): unserved NPC demand prices the next posting, the same-day premium, and release
 * on a breakdown as the player set it up. On the live profile with windows on. The off identity is windows.test.ts test 1.
 */
const LIVE = withLiveLevers();
const ON: EconomyConfig = { ...LIVE, windows: { ...LIVE.windows, enabled: true } };
const net = buildNetwork(hubs, LIVE);
const DAY = LIVE.time.gameMinutesPerDay;
const ROUND = DAY / LIVE.time.boardRoundHours.length;

function toNextRound(w: World): void {
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
}
const brokersOnly = (cfg: EconomyConfig, seed: number): World => {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed, keepLedgerEntries: true });
  populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
  return w;
};

describe("unserved demand prices the next posting (windows.lostMemoryHalfLifeDays)", () => {
  it("remembers NPC freight lost at the close, decays it by its half-life, and ignores a player's postings", () => {
    const w = brokersOnly(ON, 41);
    toNextRound(w);
    const any = [...w.loads.values()].find((l) => l.brokerId === null && l.shipperId === null)!;
    const k = planIndex(any.origin, EQUIPMENT.indexOf(any.equipment));
    // NPC direct freight and an AI broker's count; a person's brokerage and a facility's don't.
    noteLost(w, any);
    expect(lostMemory(w)![k]).toBe(1);
    const broker = w.companies.find((c) => c.role === "broker")!;
    noteLost(w, { ...any, brokerId: broker.id });
    expect(lostMemory(w)![k]).toBe(2);
    broker.human = true;
    noteLost(w, { ...any, brokerId: broker.id });
    broker.human = false;
    noteLost(w, { ...any, shipperId: broker.id, facilityId: 1 });
    expect(lostMemory(w)![k]).toBe(2);
    // A half-life later, half.
    w.t += w.cfg.windows.lostMemoryHalfLifeDays * DAY;
    expect(lostMemory(w)![k]).toBeCloseTo(1, 9);
  });

  it("fills the memory as loads are lost, and lifts the hub's load-to-truck ratio for its next postings", () => {
    // Lost loads fill it in a world nobody hauls in.
    const w = brokersOnly(ON, 42);
    for (let d = 0; d < 4; d++) for (let h = 0; h < 24; h++) stepHour(w);
    expect(w.lostMem).toBeDefined();
    expect(lostMemory(w)!.reduce((s, x) => s + x, 0)).toBeGreaterThan(10);
    // The same world twice, one with a hub's memory full: at the next round that hub reads as short of trucks.
    const a = brokersOnly(ON, 43);
    const b = brokersOnly(ON, 43);
    toNextRound(a);
    toNextRound(b);
    const [lo, hi] = ON.rates.ratioClamp;
    const k = [...a.lastRatioEq.keys()].find((i) => a.lastRatioEq[i]! > lo && a.lastRatioEq[i]! < hi / 2)!;
    b.lostMem = { t: b.t, v: new Array<number>(a.lastRatioEq.length).fill(0) };
    b.lostMem.v[k] = 40;
    toNextRound(a);
    toNextRound(b);
    expect(b.lastRatioEq[k]!).toBeGreaterThan(a.lastRatioEq[k]!);
  }, 60_000);
});

describe("the same-day premium (windows.sameDayPremium)", () => {
  it("prices an NPC load for pickup the same day 1.10 on its reference at posting, never a hot one, book-now never over the ceiling", () => {
    const on = brokersOnly(ON, 51);
    const flat = brokersOnly({ ...ON, windows: { ...ON.windows, sameDayPremium: 1 } }, 51);
    toNextRound(on);
    toNextRound(flat);
    let same = 0;
    for (const l of on.loads.values()) {
      const f = flat.loads.get(l.id);
      expect(l.bookNow).toBeLessThanOrEqual(l.ceiling + 1e-9);
      if (!f || f.originPlace !== l.originPlace || f.commodity !== l.commodity) continue;
      if (l.sameDay) {
        same++;
        expect(l.hot).toBe(0);
        expect(l.shipperId).toBeNull();
        expect(l.refRate / f.refRate).toBeCloseTo(ON.windows.sameDayPremium, 9);
        if (l.brokerId === null) expect(l.ceiling / f.ceiling).toBeCloseTo(ON.windows.sameDayPremium, 9);
      } else expect(l.refRate).toBeCloseTo(f.refRate, 9);
    }
    expect(same).toBeGreaterThan(0);
  }, 60_000);
});

describe("release on a breakdown (the director's rule)", () => {
  /** A busy truck with a load booked ahead by hand; then a breakdown long enough to break the plan. */
  function booked(seed: number, human: boolean) {
    const w = createWorld({ cfg: ON, net, feeds: neutralFeeds, seed, keepLedgerEntries: true });
    populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
    const c = formCompany(w, { name: "Breakdown Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
    c.authority.status = "active";
    c.human = human;
    const t = w.trucksByCompany.get(c.id)![0]!;
    toNextRound(w);
    const ok = (l: Load) => l.status === "open" && l.equipment === t.trailer && l.hot === 0 && l.contractId === 0 && !l.hold && l.doubleBroker === null && vettingBlock(w, c, l) === null && mayTake(w, c, l);
    const a = [...w.loads.values()].find((l) => ok(l) && l.routeHours > 1 && l.routeHours < 6)!;
    Object.assign(a, { readyT: w.t, latestPickupT: w.t + DAY, latestDeliveryT: w.t + 8 * DAY });
    Object.assign(t, { status: "idle", hub: a.origin, targetHub: a.origin, place: a.originPlace, targetPlace: a.originPlace, remainingMi: 0, loadId: null, shiftStartT: null, shiftDrivenMin: 0 });
    expect(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: a.id })).toEqual({ ok: true });
    const b = [...w.loads.values()].filter((l) => ok(l) && l.id !== a.id).sort((x, y) => placeMiles(w, a.destPlace, x.originPlace) - placeMiles(w, a.destPlace, y.originPlace))[0]!;
    Object.assign(b, { readyT: w.t + DAY, latestPickupT: w.t + 2 * DAY, latestDeliveryT: w.t + 9 * DAY });
    expect(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: b.id })).toEqual({ ok: true });
    expect(b.aheadByHand).toBe(true);
    // A breakdown the plan can't absorb.
    t.breakdownMin = 5 * DAY;
    expect(canMake(w, t, b).ok).toBe(false);
    const notices: string[] = [];
    const prev = w.listener;
    w.listener = (e) => {
      prev?.(e);
      if (e.kind === "notice" && e.companyId === c.id) notices.push(e.text);
    };
    return { w, c, t, a, b, notices };
  }
  const cancel = (w: World, l: Load) => w.ledger.entries.filter((e) => e.ref === `claim:cancel:${l.id}`);

  it("a bot releases at once, at the early share, and the load goes back on the board", () => {
    const { w, c, t, b } = booked(61, false);
    const fd = ON.windows.cancelClaimShare.early * b.clearedRate * b.miles;
    afterBreakdown(w, t);
    expect(b.status).toBe("open");
    expect(t.nextLoadId).toBeUndefined();
    expect(cancel(w, b)).toEqual([expect.objectContaining({ from: companyAccount(c.id) })]);
    expect(cancel(w, b)[0]!.amount).toBeCloseTo(fd, 2);
    w.ledger.assertBalanced();
  }, 60_000);

  it("a player's dispatcher releases what it booked, and says why; a load booked by hand asks first", () => {
    const { w, c, t, b, notices } = booked(62, true);
    c.orders = [{ kind: "bid", maxDeadheadMi: 300, price: { mode: "ceilingPct", pct: 0.95 } }];
    // Booked by hand: the ask, with the early share's figure; the load stays the truck's.
    afterBreakdown(w, t);
    expect(b.releaseAsk).toEqual({ truckId: t.id, fd: ON.windows.cancelClaimShare.early * b.clearedRate * b.miles, t: w.t });
    expect(b.status).toBe("assigned");
    expect(notices.at(-1)).toMatch(/breakdown means it can't reach .+ by \w{3} \d\d:\d\d\. Release load #\d+ now \(−[\d,]+ FD\) or keep it\.$/);
    // Keep it: the ask goes. As if the dispatcher had booked it: released at once, and the notice says why.
    expect(applyAction(w, c.id, { type: "keep_load", loadId: b.id })).toEqual({ ok: true });
    expect(b.releaseAsk).toBeUndefined();
    delete b.aheadByHand;
    afterBreakdown(w, t);
    expect(b.status).toBe("open");
    expect(notices.at(-1)).toMatch(/broke down and can't reach .+: your dispatcher released load #\d+, a [\d,]+ FD claim\.$/);
    w.ledger.assertBalanced();
  }, 60_000);

  it("with the dispatcher off, asks; released when answered at the early share even in the urgency rounds; unanswered, a no-show at the close", () => {
    const { w, c, t, b } = booked(63, true);
    afterBreakdown(w, t);
    expect(b.releaseAsk).toBeDefined();
    b.latestPickupT = w.t + ROUND; // in the urgency rounds: an ordinary release would cost the urgent share
    const fd = ON.windows.cancelClaimShare.early * b.clearedRate * b.miles;
    expect(applyAction(w, c.id, { type: "release_load", loadId: b.id })).toEqual({ ok: true });
    expect(cancel(w, b)[0]!.amount).toBeCloseTo(fd, 2);
    expect(b.releaseAsk).toBeUndefined();
    // Another world: the ask left unanswered becomes the no-show at its share.
    const o = booked(64, true);
    afterBreakdown(o.w, o.t);
    expect(o.b.releaseAsk).toBeDefined();
    o.b.latestPickupT = o.w.t + 1;
    toNextRound(o.w);
    const noshow = o.w.ledger.entries.filter((e) => e.ref === `claim:noshow:${o.b.id}`);
    expect(noshow).toHaveLength(1);
    expect(noshow[0]!.amount).toBeCloseTo(ON.windows.noShowClaimShare * o.b.clearedRate * o.b.miles, 2);
    w.ledger.assertBalanced();
    o.w.ledger.assertBalanced();
  }, 60_000);
});

