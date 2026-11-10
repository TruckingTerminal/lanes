import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { applyAction, companyAccount, createWorld, dayOf, driverFree, expediteFee, expediteQuote, expediteSlotsPerWeek, expediteWaitParts, formCompany, keptPerTruck, stepHour, type World } from "@lanes/engine";

/**
 * Early delivery for a fee (assets.expedite; the director's design, studio/reviews/director-early-delivery.md, and the
 * economy's sizes, economy-early-delivery.md): the fee, the floor, the slots, no refund.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const ON: EconomyConfig = { ...LIVE, assets: { ...LIVE.assets, expedite: { ...LIVE.assets.expedite, enabled: true } } };

function digest(cfg: EconomyConfig): string {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 20_261_109 });
  populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 6 });
  for (let h = 0; h < 10 * 24; h++) stepHour(w, ruleBotHook);
  const s = JSON.stringify({ t: w.t, next: w.nextLoadId, supply: w.ledger.supply(), books: w.companies.map((c) => [c.id, w.ledger.balance(companyAccount(c.id)), c.delivered, c.onTime, c.operating]), days: w.metrics.days, loads: [...w.loads.values()], trucks: w.trucks });
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}
/** A carrier with the cash for several new rigs, at Dallas. */
function buyer(cfg: EconomyConfig) {
  const w: World = createWorld({ cfg, net, feeds: neutralFeeds, seed: 9, keepLedgerEntries: true });
  const c = formCompany(w, { name: "Early Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 5_000_000, "test");
  return { w, c, today: dayOf(w.t, w.cfg) };
}
const newRig = (w: World, id: number, expedite?: boolean) => applyAction(w, id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, ...(expedite ? { expedite: true } : {}) });

describe("early delivery for a fee (assets.expedite)", () => {
  it("leaves the ten-day world byte-identical with the key false and absent", () => {
    expect(LIVE.assets.expedite.enabled).toBe(false);
    const { expedite: _, ...assets } = LIVE.assets;
    expect(digest({ ...LIVE, assets } as unknown as EconomyConfig)).toBe(digest(LIVE));
  }, 120_000);

  it("prices 1.5% of the truck a week saved, to the day, at least 300 FD and at most 9%", () => {
    const { w } = buyer(ON);
    expect(expediteFee(w, 46_000, 28)).toBe(2_760); // four weeks on a starter's rig: the economy's 2,760
    expect(expediteFee(w, 46_000, 2)).toBe(300); // two days, 197 by the rate: the floor
    expect(expediteFee(w, 46_000, 10)).toBeCloseTo((46_000 * 0.015 * 10) / 7, 2); // read to the day
    expect(expediteFee(w, 115_000, 56)).toBe(10_350); // eight weeks, 13,800 by the rate: capped at 9%
  });

  it("brings an order to the earliest open slot, never inside seven days, and burns the fee with no refund", () => {
    const { w, c, today } = buyer(ON);
    expect(newRig(w, c.id).ok).toBe(true);
    const o = w.orders.find((x) => x.companyId === c.id)!;
    const wait = o.dueDay - today;
    expect(wait).toBeGreaterThan(ON.assets.expedite.floorDays);
    const q = expediteQuote(w, c, o.id);
    if ("why" in q) throw new Error(q.why);
    expect(q.readyDay).toBe(today + ON.assets.expedite.floorDays);
    expect(q.daysSaved).toBe(wait - ON.assets.expedite.floorDays);
    expect(q.priceFd).toBe(o.priceFd);
    const cash = w.ledger.balance(companyAccount(c.id));
    expect(applyAction(w, c.id, { type: "expedite_order", orderId: o.id })).toEqual({ ok: true });
    expect(o.dueDay).toBe(q.readyDay);
    expect(w.ledger.balance(companyAccount(c.id))).toBeCloseTo(cash - q.feeFd, 2);
    const fees = w.ledger.entries.filter((e) => e.ref === `expedite:${o.id}`);
    expect(fees).toEqual([expect.objectContaining({ from: companyAccount(c.id), to: "sink:expedite", amount: q.feeFd })]);
    // Nothing more to save: a second expedite is refused, and nothing ever comes back (no refund, the order delivered).
    expect(applyAction(w, c.id, { type: "expedite_order", orderId: o.id }).ok).toBe(false);
    for (let h = 0; h < 24 * (ON.assets.expedite.floorDays + 1); h++) stepHour(w);
    expect(w.orders.some((x) => x.id === o.id)).toBe(false);
    expect(w.ledger.entries.some((e) => e.from === "sink:expedite")).toBe(false);
    w.ledger.assertBalanced();
  }, 60_000);

  it("runs out of slots in a week and offers the next week's; a new week's slots are open again", () => {
    const { w, c, today } = buyer(ON);
    const slots = expediteSlotsPerWeek(w);
    expect(slots).toBe(ON.assets.expedite.minSlotsPerWeek); // a new world has delivered nothing: the floor of 2
    // One more order than the week's slots, each its own company's (so no fleet's truck cap is in the way).
    const buyers = [c, ...Array.from({ length: slots }, (_, i) => {
      const x = formCompany(w, { name: `Early Freight ${i + 2}`, role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
      w.ledger.post(w.t, "faucet:starting_grant", companyAccount(x.id), 5_000_000, "test");
      return x;
    })];
    const ids = buyers.map((b) => {
      expect(newRig(w, b.id).ok).toBe(true);
      return w.orders.find((x) => x.companyId === b.id)!.id;
    });
    const first = today + ON.assets.expedite.floorDays;
    for (let i = 0; i < slots; i++) {
      expect(applyAction(w, buyers[i]!.id, { type: "expedite_order", orderId: ids[i]! })).toEqual({ ok: true });
      expect(w.orders.find((x) => x.id === ids[i])!.dueDay).toBe(first);
    }
    // The week is full: the next order's earliest slot is the first day of the week after.
    const last = buyers[slots]!;
    const q = expediteQuote(w, last, ids[slots]!);
    if ("why" in q) throw new Error(q.why);
    expect(q.readyDay).toBe((Math.floor(first / 7) + 1) * 7);
    // A week on, the earliest slot is in a week nobody has taken yet.
    for (let h = 0; h < 7 * 24; h++) stepHour(w);
    const later = expediteQuote(w, last, ids[slots]!);
    if ("why" in later) throw new Error(later.why);
    expect(later.readyDay).toBe(dayOf(w.t, w.cfg) + ON.assets.expedite.floorDays);
    w.ledger.assertBalanced();
  }, 60_000);

  it("expedites at the order, and refuses a used-lot rig, which comes from stock", () => {
    const { w, c, today } = buyer(ON);
    expect(newRig(w, c.id, true)).toEqual({ ok: true });
    const o = w.orders.find((x) => x.companyId === c.id)!;
    expect(o.dueDay).toBe(today + ON.assets.expedite.floorDays);
    expect(o.expediteFeesFd).toBeGreaterThan(0);
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, used: true, expedite: true }).ok).toBe(false);
    // Off, nothing is offered.
    const off = buyer(LIVE);
    expect(newRig(off.w, off.c.id, true).ok).toBe(false);
    w.ledger.assertBalanced();
  });

  it("keeps its fee outside the emission cap's refill: a burn by its own tag, not an operating sink", () => {
    const { w, c } = buyer(ON);
    expect(newRig(w, c.id, true)).toEqual({ ok: true });
    const fee = w.orders.find((x) => x.companyId === c.id)!.expediteFeesFd!;
    for (let h = 0; h < 24; h++) stepHour(w);
    const day = w.metrics.days.at(-1)!;
    expect(day.burnByTag.expedite).toBeCloseTo(fee, 2);
    expect(day.sinkByTag.expedite).toBeUndefined();
    // The refill's base (emission.ts trailingSinksPerMonthFd) sums sinkFd, which is the operating sinks alone.
    expect(Object.values(day.sinkByTag).reduce((s, x) => s + x, 0)).toBeCloseTo(day.sinkFd, 2);
    w.ledger.assertBalanced();
  });

  it("sizes the slots from the NPC queue's deliveries only, one an order", () => {
    const { w, c } = buyer(ON);
    expect(newRig(w, c.id).ok).toBe(true);
    expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, used: true }).ok).toBe(true);
    const queue = w.orders.find((x) => x.companyId === c.id && x.used === undefined)!;
    expect(applyAction(w, c.id, { type: "expedite_order", orderId: queue.id })).toEqual({ ok: true });
    // Both delivered by the time the expedited one is ready (the lot's rig in its own days), only the queue's counted.
    for (let h = 0; h < 24 * (ON.assets.expedite.floorDays + 1); h++) stepHour(w);
    expect(w.orders.filter((x) => x.companyId === c.id)).toEqual([]);
    expect(Object.values(w.expedite!.deliveredByDay!).reduce((s, x) => s + x, 0)).toBe(1);
    w.ledger.assertBalanced();
  }, 60_000);

  it("the bots, on the director's rule: the fee against the payments and the trucks' kept per week, with its guards", () => {
    const B: EconomyConfig = { ...ON, assets: { ...ON.assets, expedite: { ...ON.assets.expedite, countsKeptPerTruck: false } } };
    expect(ON.assets.expedite.countsKeptPerTruck).toBe(true); // the default: C, with guards
    const run = (cfg: EconomyConfig, opts: { driver?: boolean; tweak?: (w: World, o: { dueDay: number }, id: number) => void } = {}) => {
      const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 12 });
      populate(w, { freeOwnerOperators: 0, fleets: 2, brokers: 0 });
      const c = w.companies.find((x) => x.role === "carrier")!;
      w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 5_000_000, "test");
      // Eight weeks of books: each truck kept 5,000 a week (30,000 in, 15,000 out over 3 truck-weeks a week).
      c.expediteBooks = Array.from({ length: 9 }, (_, i) => ({ revenueFd: i * 30_000, costFd: i * 15_000, truckWeeks: i * 3 }));
      expect(keptPerTruck(w, c)).toEqual({ perWeekFd: 5_000, weeks: 8 });
      expect(driverFree(w, c)).toBe(false); // every driver on a truck
      // A spare driver, when asked for: one more than the trucks (as after selling a truck), so the day's staffing finds no
      // empty seat for them. A driver lifted off a truck would be seated again at the day's close (labor.ts autoStaff).
      if (opts.driver !== false) {
        const s = w.staff.find((x) => x.status === "pool" && x.kind === "driver")!;
        Object.assign(s, { status: "employed", companyId: c.id, truckId: 0, pay: 1, hiredDay: dayOf(w.t, w.cfg), offer: null });
        w.staffByCompany.get(c.id)!.push(s);
        expect(driverFree(w, c)).toBe(true);
      }
      expect(applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, finance: true }).ok).toBe(true);
      const o = w.orders.filter((x) => x.companyId === c.id).at(-1)!;
      opts.tweak?.(w, o, c.id);
      const parts = expediteWaitParts(w, c, o.id);
      for (let h = 0; h < 24; h++) stepHour(w, ruleBotHook);
      const after = w.orders.find((x) => x.id === o.id);
      w.ledger.assertBalanced();
      return { expedited: after?.expediteFeesFd !== undefined, parts };
    };
    // B: the fee against the loan's payments alone, more than a few weeks of payments save.
    const b = run(B);
    expect(b.expedited).toBe(false);
    if ("why" in b.parts) throw new Error(b.parts.why);
    expect(b.parts.keptFd).toBe(0);
    expect(b.parts.feeFd).toBeGreaterThan(b.parts.paymentsFd);
    // C with a driver: what the trucks kept is counted, said apart from the payments.
    const c = run(ON);
    if ("why" in c.parts) throw new Error(c.parts.why);
    expect(c.parts.keptFd).toBeCloseTo((5_000 * c.parts.daysSaved) / 7, 6);
    expect(c.parts.driver).toBe(true);
    expect(c.expedited).toBe(true);
    // No driver for it: the earnings count nothing, and it waits.
    const n = run(ON, { driver: false });
    if ("why" in n.parts) throw new Error(n.parts.why);
    expect(n.parts.keptFd).toBe(0);
    expect(n.expedited).toBe(false);
    // Not inside the 21-day wait…
    expect(run(ON, { tweak: (w, o) => (o.dueDay = dayOf(w.t, w.cfg) + 20) }).expedited).toBe(false);
    // …nor without two months of payments kept past its cushion.
    expect(
      run(ON, {
        tweak: (w, _o, id) => {
          const acct = companyAccount(id);
          w.ledger.post(w.t, acct, "sink:fines", w.ledger.balance(acct) - 3_000, "test");
        },
      }).expedited,
    ).toBe(false);
  }, 120_000);
});

