import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { applyAction, autoStaff, createWorld, dailyDrivers, dayOf, formCompany, hubMiles, isRoundBoundary, mayTake, placeMiles, placeOfHub, stepHour, unseatDriver, vettingBlock, type Load, type World } from "@lanes/engine";

/** The red team's pass on ruleset 0.25.3 (redteam-sprint-2026-11-15.md, the 0.25.3 section): findings 1, 3, 4, 5 and 6. */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const DAY = LIVE.time.gameMinutesPerDay;
const BUS = { ...LIVE, labor: { ...LIVE.labor, truckLessHomeByHub: true, busHome: { ...LIVE.labor.busHome, enabled: true } } } as EconomyConfig;

function toNextRound(w: World): void {
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
}
/** A company with an idle truck, and an open load of its trailer near it. */
function withLoad(cfg: EconomyConfig, seed: number) {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed, keepLedgerEntries: true });
  populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
  const c = formCompany(w, { name: "Probe Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
  c.authority.status = "active";
  c.human = true;
  const t = w.trucksByCompany.get(c.id)![0]!;
  toNextRound(w);
  const ok = (l: Load) => l.status === "open" && l.equipment === t.trailer && l.hot === 0 && l.contractId === 0 && !l.hold && l.doubleBroker === null && vettingBlock(w, c, l) === null && mayTake(w, c, l) && l.brokerId === null && l.shipperId === null;
  const l = [...w.loads.values()].find((x) => ok(x) && x.routeHours > 1 && x.routeHours < 8)!;
  Object.assign(t, { status: "idle", hub: l.origin, targetHub: l.origin, place: l.originPlace, targetPlace: l.originPlace, remainingMi: 0, loadId: null });
  return { w, c, t, l };
}

describe("the red team's 0.25.3 pass", () => {
  it("1: a first call's holder clears at no more than Book now, however high the bid", () => {
    const ON = { ...LIVE, standing: { ...LIVE.standing, enabled: true } } as EconomyConfig;
    const { w, c, t, l } = withLoad(ON, 91);
    Object.assign(l, { firstCall: { companyId: c.id, round: w.round + 1, localUntil: 0, state: "open" }, tenderedTo: c.id, tenderUntil: w.t + DAY, localUntilRound: 0, latestPickupT: w.t + 3 * DAY });
    expect(applyAction(w, c.id, { type: "place_bid", truckId: t.id, loadId: l.id, rate: l.ceiling })).toMatchObject({ ok: true });
    toNextRound(w);
    expect(l.carrierId).toBe(c.id);
    expect(l.clearedRate).toBeLessThanOrEqual(l.bookNow + 1e-9);
  }, 60_000);

  it("3: a truck waiting at the dock for a load not yet ready may release it; it stands in the shipper's town", () => {
    const ON = { ...LIVE, windows: { ...LIVE.windows, enabled: true, releaseCurrent: true } } as EconomyConfig;
    const { w, c, t, l } = withLoad(ON, 92);
    Object.assign(l, { readyT: w.t + 68 * 60, latestPickupT: w.t + 5 * DAY, latestDeliveryT: w.t + 10 * DAY });
    expect(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: l.id })).toEqual({ ok: true });
    expect(t.status).toBe("loading"); // at the shipper, waiting for the ready time
    const place = t.place;
    expect(applyAction(w, c.id, { type: "release_load", loadId: l.id })).toEqual({ ok: true });
    expect(l.status).toBe("open");
    expect(t.loadId).toBeNull();
    for (let h = 0; h < 3 && t.status !== "idle"; h++) stepHour(w);
    expect(t.status).toBe("idle");
    expect(t.place).toBe(place);
    expect(placeMiles(w, t.place, l.originPlace)).toBe(0);
  }, 60_000);

  it("3: driven to the dock first, its empty miles there are paid and sunk, and it stands in the shipper's town", () => {
    const ON = { ...LIVE, windows: { ...LIVE.windows, enabled: true, releaseCurrent: true } } as EconomyConfig;
    const { w, c, t, l } = withLoad(ON, 93);
    const near = w.net.places.findIndex((_p, i) => placeMiles(w, i, l.originPlace) > 80 && placeMiles(w, i, l.originPlace) < 250);
    const hub = w.net.places[near]!.market;
    Object.assign(t, { hub, targetHub: hub, place: near, targetPlace: near });
    Object.assign(l, { readyT: w.t + 68 * 60, latestPickupT: w.t + 5 * DAY, latestDeliveryT: w.t + 10 * DAY });
    expect(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: l.id })).toEqual({ ok: true });
    for (let h = 0; h < 12 && t.status !== "loading"; h++) stepHour(w);
    expect(t.status).toBe("loading");
    expect(w.t).toBeLessThan(l.readyT!);
    expect(t.emptyMi).toBeGreaterThan(0);
    const notices: string[] = [];
    w.listener = (e) => void (e.kind === "notice" && notices.push(e.text));
    expect(applyAction(w, c.id, { type: "release_load", loadId: l.id })).toEqual({ ok: true });
    expect(t.status).toBe("idle");
    expect(t.place).toBe(l.originPlace);
    expect(t.emptyMi).toBe(0); // paid
    expect(notices.some((x) => /empty miles so far sunk/.test(x))).toBe(true);
    // Once the load is ready, it's being loaded: not releasable.
    const { w: w2, c: c2, t: t2, l: l2 } = withLoad(ON, 92);
    Object.assign(l2, { readyT: w2.t + 60, latestPickupT: w2.t + 5 * DAY, latestDeliveryT: w2.t + 10 * DAY });
    expect(applyAction(w2, c2.id, { type: "book_load", truckId: t2.id, loadId: l2.id })).toEqual({ ok: true });
    stepHour(w2);
    stepHour(w2);
    if (t2.status === "loading") expect(applyAction(w2, c2.id, { type: "release_load", loadId: l2.id })).toMatchObject({ ok: false });
  }, 60_000);

  it("4 and 5: with the bus, auto-staff seats a driver only where they stand, and an owner beside his own empty truck takes it", () => {
    const w = createWorld({ cfg: BUS, net, feeds: neutralFeeds, seed: 13 });
    populate(w, { freeOwnerOperators: 6, fleets: 2, brokers: 1 });
    // An owner-operator off his own idle truck: beside it, he takes it back.
    const s = w.staff.find((x) => x.owner && x.status === "employed" && x.truckId > 0 && w.trucksByCompany.get(x.companyId)!.length === 1 && w.trucks[x.truckId - 1]!.status === "idle")!;
    const c = w.companies[s.companyId - 1]!;
    const t = w.trucks[s.truckId - 1]!;
    unseatDriver(w, s);
    s.lastHub = t.hub;
    autoStaff(w, c);
    expect(s.truckId).toBe(t.id);
    // Off it again, standing at another hub: not seated in it there.
    unseatDriver(w, s);
    s.lastHub = w.net.hubs.findIndex((_h, i) => hubMiles(w, i, t.hub) > 500);
    autoStaff(w, c);
    expect(s.truckId).toBe(0);
    // Riding the bus home from beside it: seated neither there nor anywhere until home.
    s.lastHub = t.hub;
    s.bus = { from: t.hub, miles: 900, fareFd: 0, leftT: w.t, arriveDay: dayOf(w.t, w.cfg) + 2 };
    autoStaff(w, c);
    expect(s.truckId).toBe(0);
  });

  it("6: with home by hub, a cut days-off window counts as home only at home", () => {
    const ON = { ...LIVE, labor: { ...LIVE.labor, truckLessHomeByHub: true } } as EconomyConfig;
    const w = createWorld({ cfg: ON, net, feeds: neutralFeeds, seed: 13 });
    populate(w, { freeOwnerOperators: 6, fleets: 0, brokers: 1 });
    const s = w.staff.find((x) => x.owner && x.status === "employed" && x.truckId > 0)!;
    const c = w.companies[s.companyId - 1]!;
    const t = w.trucks[s.truckId - 1]!;
    const far = w.net.hubs.findIndex((_h, i) => hubMiles(w, i, c.homeHub) > 500);
    Object.assign(t, { status: "idle", hub: far, targetHub: far, place: placeOfHub(far), targetPlace: placeOfHub(far), remainingMi: 0, loadId: null });
    s.homeUntilDay = dayOf(w.t, w.cfg) + 3; // a days-off window, cut by driving out
    s.awayDays = 5;
    s.drivenMinToday = 0;
    dailyDrivers(w);
    expect(s.awayDays).toBe(6); // away from home: the window's day isn't rest here
    const off = createWorld({ cfg: LIVE, net, feeds: neutralFeeds, seed: 13 });
    populate(off, { freeOwnerOperators: 6, fleets: 0, brokers: 1 });
    const s0 = off.staff.find((x) => x.owner && x.status === "employed" && x.truckId > 0)!;
    const t0 = off.trucks[s0.truckId - 1]!;
    const far0 = off.net.hubs.findIndex((_h, i) => hubMiles(off, i, off.companies[s0.companyId - 1]!.homeHub) > 500);
    Object.assign(t0, { status: "idle", hub: far0, targetHub: far0, place: placeOfHub(far0), targetPlace: placeOfHub(far0), remainingMi: 0, loadId: null });
    s0.homeUntilDay = dayOf(off.t, off.cfg) + 3;
    s0.awayDays = 5;
    s0.drivenMinToday = 0;
    dailyDrivers(off);
    expect(s0.awayDays).toBe(0); // as before: the window counts as home wherever the driver is
  });
});
