import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import {
  applyAction,
  autoBook,
  bidsFromStandingOrders,
  canMake,
  dispatchPlan,
  homeward,
  indexOpenLoads,
  claimOn,
  companyAccount,
  createWorld,
  dockHoursAt,
  formCompany,
  isRoundBoundary,
  mayTake,
  nextOpen,
  placeMiles,
  reachRefusal,
  stepHour,
  vettingBlock,
  type Company,
  type Load,
  type StandingOrder,
  type Truck,
  type World,
} from "@lanes/engine";

/**
 * Item 4 batch 2, booking ahead (windows.ts canMake, releaseLoad, noShow, claimOn; trips.ts takeNextLoad;
 * engineering-item4-delivery-windows.md, tests 3, 4 and 7). On the live profile with windows on; a world of brokers and
 * one leased owner-operator at Dallas, so nothing else books.
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

/** Brokers posting freight and one owner-operator at Dallas with no standing orders, the board's first round posted. */
function setup(seed: number) {
  const w = createWorld({ cfg: ON, net, feeds: neutralFeeds, seed, keepLedgerEntries: true });
  populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
  const c = formCompany(w, { name: "Ahead Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
  c.authority.status = "active";
  const t = w.trucksByCompany.get(c.id)![0]!;
  toNextRound(w);
  return { w, c, t };
}

/** The truck stands idle at a load's shipper, its duty day not yet begun. */
function standAt(t: Truck, l: Load): void {
  t.status = "idle";
  t.hub = t.targetHub = l.origin;
  t.place = t.targetPlace = l.originPlace;
  t.remainingMi = 0;
  t.loadId = null;
  t.shiftStartT = null;
  t.shiftDrivenMin = 0;
}

/** An open load this truck may take: its trailer, no vetting or local hold against it, not hot, not a tender. */
function pick(w: World, c: Company, t: Truck, pred: (l: Load) => boolean, not: Load[] = []): Load {
  const l = [...w.loads.values()].find(
    (l) => l.status === "open" && l.equipment === t.trailer && l.hot === 0 && l.contractId === 0 && l.hold === undefined && l.doubleBroker === null && !not.includes(l) && vettingBlock(w, c, l) === null && mayTake(w, c, l) && pred(l),
  );
  if (!l) throw new Error("no such load in this world");
  return l;
}

/** The open load this truck may take whose shipper is nearest a place. */
function near(w: World, c: Company, t: Truck, place: number, not: Load[] = [], pred: (l: Load) => boolean = () => true): Load {
  let best: Load | null = null;
  for (const l of w.loads.values()) {
    if (l.status !== "open" || l.equipment !== t.trailer || l.hot !== 0 || l.contractId !== 0 || l.hold !== undefined || l.doubleBroker !== null || not.includes(l)) continue;
    if (vettingBlock(w, c, l) !== null || !mayTake(w, c, l) || !pred(l)) continue;
    if (!best || placeMiles(w, place, l.originPlace) < placeMiles(w, place, best.originPlace)) best = l;
  }
  if (!best) throw new Error("no such load in this world");
  return best;
}

/** A wide window from a ready time: a day to pick up, a week to deliver. */
function widen(l: Load, readyT: number): void {
  l.readyT = readyT;
  l.latestPickupT = readyT + DAY;
  l.latestDeliveryT = readyT + 8 * DAY;
}

const ok = (r: { ok: boolean; reason?: string }) => expect(r).toEqual({ ok: true });

describe("canMake (test 3)", () => {
  it("projects an idle truck from here and now, a busy one from its delivery; rests, a team, a closed dock; reads only", () => {
    const { w, c, t } = setup(31);
    const a = pick(w, c, t, (l) => l.routeHours > 13 && l.routeHours < 20);
    widen(a, w.t);
    standAt(t, a);
    const snap = () => JSON.stringify({ rng: w.rng, t, a, loads: [...w.loads.values()] });
    const before = snap();
    const solo = canMake(w, t, a);
    expect(snap()).toBe(before); // no write anywhere, w.rng included
    expect(solo).toMatchObject({ ok: true, why: null, freeT: w.t, freePlace: a.originPlace, pickupT: w.t });
    // More than a day's legal driving: a rest at least.
    const drive = a.routeHours * 60;
    expect(solo.deliverT - w.t).toBeGreaterThanOrEqual(drive + w.cfg.dwell.loadMinutes[1] + w.cfg.hos.restHours * 60);
    // A team drives on through it.
    t.coDriverId = t.driverId;
    const team = canMake(w, t, a);
    t.coDriverId = 0;
    expect(team.deliverT).toBeLessThan(solo.deliverT);

    // A closed shipper's dock: ready while it's shut, loaded once it opens.
    const d = [...w.loads.values()].find((l) => l.status === "open" && dockHoursAt(w, l, "pickup") !== null)!;
    const h = dockHoursAt(w, d, "pickup")!;
    let shut = w.t;
    while (nextOpen(w, shut, h) - shut < 120) shut += 60;
    widen(d, shut);
    standAt(t, d);
    const docked = canMake(w, t, d);
    (w as { cfg: EconomyConfig }).cfg = { ...ON, docks: { ...ON.docks, enabled: false } };
    const open = canMake(w, t, d);
    (w as { cfg: EconomyConfig }).cfg = ON;
    expect(docked.deliverT - open.deliverT).toBeGreaterThanOrEqual(nextOpen(w, shut, h) - shut - 1e-6);

    // Busy: free when its delivery is done, at the receiver; a load whose pickup closes before then is refused, with figures.
    widen(a, w.t);
    standAt(t, a);
    ok(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: a.id }));
    expect(t.loadId).toBe(a.id);
    const b = near(w, c, t, a.destPlace, [a]);
    widen(b, w.t);
    const late = canMake(w, t, b);
    expect(late.freePlace).toBe(a.destPlace);
    expect(late.freeT).toBeGreaterThan(w.t + drive);
    expect(late).toMatchObject({ ok: false, why: "pickup" });
    expect(reachRefusal(w, b, late)).toMatch(/^The truck is free \w{3} \d\d:\d\d at .+: it reaches .+ \w{3} \d\d:\d\d, after the pickup closes \w{3} \d\d:\d\d$/);
    // Ready after the truck is free: it waits for the load, and makes it.
    widen(b, late.freeT + DAY);
    const fits = canMake(w, t, b);
    expect(fits).toMatchObject({ ok: true, why: null });
    expect(fits.pickupT).toBeGreaterThanOrEqual(fits.freeT);
    // A deadline before it can get there: refused on the delivery.
    b.latestDeliveryT = fits.deliverT - 60;
    const tight = canMake(w, t, b);
    expect(tight).toMatchObject({ ok: false, why: "delivery" });
    expect(reachRefusal(w, b, tight)).toMatch(/delivers at .+ \w{3} \d\d:\d\d, after the \w{3} \d\d:\d\d deadline$/);
  }, 60_000);
});

describe("booking ahead (test 4)", () => {
  it("books one load ahead of a busy truck and never a third; it starts when the first is delivered; the wait for readyT is dwell", () => {
    const { w, c, t } = setup(41);
    const a = pick(w, c, t, (l) => l.routeHours > 2 && l.routeHours < 8);
    widen(a, w.t);
    standAt(t, a);
    ok(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: a.id }));
    const free = canMake(w, t, pick(w, c, t, () => true, [a])).freeT;
    // The load after it, ready a while after the truck is free: at the shipper early, the truck waits.
    const b = near(w, c, t, a.destPlace, [a]);
    const h = dockHoursAt(w, b, "pickup");
    const ready = h ? nextOpen(w, free + 8 * 60, h) : free + 8 * 60;
    widen(b, ready);
    const dueBefore = b.dueT;
    const entries = w.ledger.entries.length;
    const paper = w.receivables.length;
    ok(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: b.id }));
    expect(t.loadId).toBe(a.id);
    expect(t.nextLoadId).toBe(b.id);
    expect(b).toMatchObject({ status: "assigned", ahead: true, carrierId: c.id, truckId: t.id, dueT: dueBefore });
    // Nothing moves on it until pickup: no ledger entry, no receivable.
    expect(w.ledger.entries.length).toBe(entries);
    expect(w.receivables.length).toBe(paper);
    // Never a third: by hand or by bid.
    const x = pick(w, c, t, () => true, [a, b]);
    widen(x, w.t + 3 * DAY);
    const third = applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: x.id });
    expect(third.ok).toBe(false);
    expect(applyAction(w, c.id, { type: "place_bid", truckId: t.id, loadId: x.id, rate: x.ceiling }).ok).toBe(false);
    // The first delivered, the next is the truck's.
    for (let h = 0; h < 10 * 24 && w.loads.has(a.id); h++) stepHour(w);
    expect(w.loads.has(a.id)).toBe(false);
    expect(t.loadId).toBe(b.id);
    expect(t.nextLoadId).toBeUndefined();
    expect(b.ahead).toBeUndefined();
    expect(b.dueT).toBeLessThanOrEqual(b.latestDeliveryT!);
    // At the shipper before readyT, it waits: dwell, never detention.
    for (let h = 0; h < 5 * 24 && t.status === "toPickup"; h++) stepHour(w);
    expect(["loading", "loaded"]).toContain(t.status);
    expect(b.status).toBe("inTransit");
    expect(b.detention?.pickupH ?? 0).toBe(0);
    // A bid ahead on the busy truck stands for the load after this one, and wins it at the round.
    const y = near(w, c, t, b.destPlace, [a, b, x]);
    widen(y, w.t + 4 * DAY);
    expect(canMake(w, t, y).ok).toBe(true);
    ok(applyAction(w, c.id, { type: "place_bid", truckId: t.id, loadId: y.id, rate: y.ceiling }));
    toNextRound(w);
    expect(y.carrierId).toBe(c.id);
    expect([t.nextLoadId, t.loadId]).toContain(y.id);
    w.ledger.assertBalanced();
  }, 60_000);
});

describe("claims (test 7)", () => {
  it("takes a release early and in the urgency rounds, a no-show and a late delivery at their shares, to the poster or the sink; the ledger balanced", () => {
    const { w, c, t } = setup(71);
    const k = w.cfg.windows;
    const a = pick(w, c, t, (l) => l.routeHours > 2 && l.routeHours < 8);
    widen(a, w.t);
    standAt(t, a);
    ok(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: a.id }));
    const claims = (kind: string, l: Load) => w.ledger.entries.filter((e) => e.ref === `claim:${kind}:${l.id}`);
    const posterAcct = (l: Load) => (l.brokerId ?? l.shipperId) !== null ? companyAccount((l.brokerId ?? l.shipperId)!) : "sink:service_failure";
    const ahead = (pred: (l: Load) => boolean, not: Load[]) => {
      const l = near(w, c, t, a.destPlace, not, pred);
      widen(l, w.t + 3 * DAY);
      ok(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: l.id }));
      expect(t.nextLoadId).toBe(l.id);
      return l;
    };

    // Released early, a broker's load: the early share to the broker; back on the board; the record marked.
    const b = ahead((l) => l.brokerId !== null, [a]);
    const rep = c.reputation;
    const early = k.cancelClaimShare.early * b.clearedRate * b.miles; // the pay as booked: the reopened load's rate is cleared
    ok(applyAction(w, c.id, { type: "release_load", loadId: b.id }));
    expect(claims("cancel", b)).toEqual([expect.objectContaining({ from: companyAccount(c.id), to: companyAccount(b.brokerId!) })]);
    expect(claims("cancel", b)[0]!.amount).toBeCloseTo(early, 2);
    expect(b.status).toBe("open");
    expect(b.ahead).toBeUndefined();
    expect(t.nextLoadId).toBeUndefined();
    expect(c.failed).toBe(1);
    expect(c.reputation).toBeLessThan(rep);
    expect(c.delivered).toBe(0); // a mark on the record, not a load delivered
    // Only a load booked ahead can be released: never the job in hand.
    expect(applyAction(w, c.id, { type: "release_load", loadId: a.id }).ok).toBe(false);

    // Released in the urgency rounds, NPC paper: the urgent share, to the sink.
    const d = ahead((l) => l.brokerId === null && l.shipperId === null, [a, b]);
    d.latestPickupT = w.t + ROUND;
    const urgentFd = k.cancelClaimShare.urgent * d.clearedRate * d.miles;
    ok(applyAction(w, c.id, { type: "release_load", loadId: d.id }));
    expect(claims("cancel", d)).toEqual([expect.objectContaining({ from: companyAccount(c.id), to: "sink:service_failure" })]);
    expect(claims("cancel", d)[0]!.amount).toBeCloseTo(urgentFd, 2);

    // A no-show: booked ahead, the pickup closed before the truck got there. Claimed at the round and lost.
    const e = ahead(() => true, [a, b, d]);
    e.latestPickupT = w.t + 1;
    toNextRound(w);
    expect(claims("noshow", e)).toEqual([expect.objectContaining({ from: companyAccount(c.id), to: posterAcct(e) })]);
    expect(claims("noshow", e)[0]!.amount).toBeCloseTo(k.noShowClaimShare * e.clearedRate * e.miles, 2);
    expect(w.loads.has(e.id)).toBe(false);
    expect(t.nextLoadId).toBeUndefined();
    expect(c.failed).toBe(3);

    // Late: the job in hand past its deadline is delivered, paid, and claimed.
    expect(w.loads.has(a.id)).toBe(true);
    {
      a.latestDeliveryT = (a.arrivedT ?? w.t) - 1; // before its arrival at the receiver, which the deadline reads
      const delivered = c.delivered;
      for (let h = 0; h < 10 * 24 && w.loads.has(a.id); h++) stepHour(w);
      expect(c.delivered).toBe(delivered + 1);
      expect(claims("late", a)).toEqual([expect.objectContaining({ from: companyAccount(c.id), to: posterAcct(a) })]);
      expect(claims("late", a)[0]!.amount).toBeCloseTo(k.lateClaimShare * a.clearedRate * a.miles, 2);
    }
    // A carrier running late comes out ahead by delivering: it keeps the pay and owes a fifth, against a quarter and no pay.
    expect(1 - k.lateClaimShare).toBeGreaterThan(-k.noShowClaimShare);

    // One owner's two sides: the claim goes to the sink, never across.
    const f = pick(w, c, t, (l) => l.brokerId !== null, [a, b, d, e]);
    f.clearedRate = f.ceiling;
    const broker = w.companies[f.brokerId! - 1]!;
    broker.partnerId = c.id; // a pair links both ways (brokerage.ts form_brokerage)
    c.partnerId = broker.id;
    const fd = claimOn(w, c, f, k.cancelClaimShare.early, "cancel");
    expect(fd).toBeCloseTo(k.cancelClaimShare.early * f.clearedRate * f.miles, 6);
    expect(claims("cancel", f)).toEqual([expect.objectContaining({ from: companyAccount(c.id), to: "sink:service_failure" })]);
    delete broker.partnerId;
    delete c.partnerId;
    w.ledger.assertBalanced();
  }, 60_000);
});

describe("the dispatcher two deep (test 5)", () => {
  /** Standing orders that bid and book freely, the first call by hand made. */
  const orders: StandingOrder[] = [
    { kind: "bid", maxDeadheadMi: 300, price: { mode: "ceilingPct", pct: 0.95 } },
    { kind: "floor", breakEvenPlusPct: -0.5 },
    { kind: "bookNow", breakEvenPlusPct: -0.5, maxDeadheadMi: 300 },
  ];
  /** A truck on a short job, free within the plan-ahead hours; the loads near where it will be free made feasible, one not. */
  function busy(seed: number) {
    const { w, c, t } = setup(seed);
    toNextRound(w); // two rounds of freight on the board
    c.orders = orders;
    c.firstHandBidDay = 0;
    // A short first load into the market with the most freight this carrier may take, so the plan has a board to read.
    const takeable = (l: Load) => l.status === "open" && l.equipment === t.trailer && l.hot === 0 && l.contractId === 0 && l.hold === undefined && vettingBlock(w, c, l) === null && mayTake(w, c, l);
    const around = (place: number) => [...w.loads.values()].filter((l) => takeable(l) && placeMiles(w, place, l.originPlace) <= 250).length;
    // Docks open around the clock at both ends, so the truck is free within the plan-ahead hours.
    const a = [...w.loads.values()].filter((l) => takeable(l) && l.doubleBroker === null && l.routeHours > 1 && l.routeHours < 5 && dockHoursAt(w, l, "pickup") === null && dockHoursAt(w, l, "delivery") === null).sort((x, y) => around(y.destPlace) - around(x.destPlace) || x.id - y.id)[0]!;
    expect(around(a.destPlace)).toBeGreaterThan(2);
    widen(a, w.t);
    standAt(t, a);
    ok(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: a.id }));
    const plan = dispatchPlan(w, t)!;
    expect(plan).not.toBeNull();
    const nearby = [...w.loads.values()].filter((l) => l.status === "open" && l.equipment === t.trailer && placeMiles(w, a.destPlace, l.originPlace) <= 300);
    for (const l of nearby) widen(l, plan.startT);
    const missed = nearby[0]!;
    missed.latestPickupT = w.t + 60; // closes before the truck is free
    return { w, c, t, a, plan, missed };
  }

  it("plans a soon-free truck from where and when it's free, and bids and books only what canMake passes, one ahead", () => {
    const { w, c, t, a, plan, missed } = busy(51);
    expect(plan).toMatchObject({ ahead: true });
    expect(plan.at.place).toBe(a.destPlace);
    expect(plan.at.hub).toBe(w.net.places[a.destPlace]!.market);
    expect(plan.startT).toBeGreaterThan(w.t);
    expect(plan.startT - w.t).toBeLessThanOrEqual(w.cfg.windows.planAheadHours * 60);
    const bids = bidsFromStandingOrders(w, c, indexOpenLoads(w)).filter((b) => b.truckId === t.id);
    expect(bids.length).toBeGreaterThan(0);
    for (const b of bids) {
      const l = w.loads.get(b.loadId)!;
      expect(b.deadheadMi).toBe(placeMiles(w, a.destPlace, l.originPlace)); // from the current receiver
      expect(canMake(w, t, l).ok).toBe(true);
    }
    expect(canMake(w, t, missed).ok).toBe(false);
    expect(bids.some((b) => b.loadId === missed.id)).toBe(false);
    // Between rounds the dispatcher books ahead, never what the truck can't make, and never a third.
    autoBook(w);
    expect(t.loadId).toBe(a.id);
    const next = w.loads.get(t.nextLoadId!)!;
    expect(next).toMatchObject({ status: "assigned", ahead: true, truckId: t.id });
    expect(canMake(w, t, next).ok).toBe(true);
    expect(dispatchPlan(w, t)).toBeNull();
    expect(bidsFromStandingOrders(w, c, indexOpenLoads(w)).filter((b) => b.truckId === t.id)).toEqual([]);
    w.ledger.assertBalanced();
  }, 60_000);

  it("books ahead only homeward loads for a truck due home; plans nothing for a truck free later than the plan-ahead hours", () => {
    const { w, c, t, plan } = busy(52);
    w.staff[t.driverId - 1]!.wantsHome = true;
    const bids = bidsFromStandingOrders(w, c, indexOpenLoads(w)).filter((b) => b.truckId === t.id);
    for (const b of bids) expect(homeward(w, c, plan.at, w.loads.get(b.loadId)!)).toBe(true);
    autoBook(w);
    if (t.nextLoadId !== undefined) expect(homeward(w, c, plan.at, w.loads.get(t.nextLoadId)!)).toBe(true);
    // A long haul: free past the plan-ahead hours, so the dispatcher leaves it be for now.
    const { w: w2, c: c2, t: t2 } = setup(53);
    c2.orders = orders;
    c2.firstHandBidDay = 0;
    const long = pick(w2, c2, t2, (l) => l.routeHours > 20);
    widen(long, w2.t);
    standAt(t2, long);
    ok(applyAction(w2, c2.id, { type: "book_load", truckId: t2.id, loadId: long.id }));
    expect(dispatchPlan(w2, t2)).toBeNull();
    expect(bidsFromStandingOrders(w2, c2, indexOpenLoads(w2)).filter((b) => b.truckId === t2.id)).toEqual([]);
  }, 60_000);
});
