import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { applyAction, canMake, createWorld, dayOf, formCompany, hubMiles, isRoundBoundary, mayTake, placeMiles, reachRefusal, stepHour, vettingBlock, type Company, type Load, type Truck, type World } from "@lanes/engine";

/**
 * The director's ruling 17 (director-sprint-2026-11-15.md), on the red team's 0.25.3 pass, finding 2, under
 * labor.dueHomePlan: a load booked ahead goes before a due driver's days off, which start once home with nothing booked; and
 * canMake counts the days off a booking would be held for (rule H) as time the truck isn't free.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const DAY = LIVE.time.gameMinutesPerDay;
const on = (): EconomyConfig => ({ ...LIVE, windows: { ...LIVE.windows, enabled: true }, docks: { ...LIVE.docks, enabled: false }, labor: { ...LIVE.labor, dueHomePlan: { ...LIVE.labor.dueHomePlan, enabled: true } } }) as EconomyConfig;

function toNextRound(w: World): void {
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
}
const takeable = (w: World, c: Company, t: Truck) => (l: Load) =>
  l.status === "open" && l.equipment === t.trailer && l.hot === 0 && l.contractId === 0 && !l.hold && l.doubleBroker === null && vettingBlock(w, c, l) === null && mayTake(w, c, l) && l.brokerId === null && l.shipperId === null;
const onDaysOff = (w: World, id: number) => {
  const d = w.staff[id - 1]!;
  return d.homeUntilDay !== null && d.homeUntilDay > dayOf(w.t, w.cfg);
};

describe("the director's ruling 17 (labor.dueHomePlan)", () => {
  it("the red team's case: a due owner home with a load booked ahead hauls it, no no-show, told; the days off wait", () => {
    const w = createWorld({ cfg: on(), net, feeds: neutralFeeds, seed: 21, keepLedgerEntries: true });
    populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
    const c = formCompany(w, { name: "Trap Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
    c.authority.status = "active";
    c.human = true;
    const t = w.trucksByCompany.get(c.id)![0]!;
    const d = w.staff[t.driverId - 1]!;
    toNextRound(w);
    // L1 into "Los Angeles", L2 out of it (the probe's Phoenix → Los Angeles, then Los Angeles → Las Vegas).
    const open = [...w.loads.values()].filter(takeable(w, c, t));
    let A: Load | undefined;
    let B: Load | undefined;
    for (const a of open) {
      if (a.routeHours < 2 || a.routeHours > 8) continue;
      B = open.find((x) => x !== a && x.routeHours > 1 && x.routeHours < 8 && placeMiles(w, a.destPlace, x.originPlace) < 40 && hubMiles(w, x.dest, a.dest) > 150);
      if (B) {
        A = a;
        break;
      }
    }
    expect(A && B).toBeTruthy();
    c.homeHub = A!.dest;
    Object.assign(t, { status: "idle", hub: A!.origin, targetHub: A!.origin, place: A!.originPlace, targetPlace: A!.originPlace, remainingMi: 0, loadId: null });
    expect(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: A!.id })).toEqual({ ok: true });
    // L2's pickup closes six hours after the truck could reach it from L1's delivery: the days off would make it a no-show.
    delete (B as { readyT?: number }).readyT;
    const r = canMake(w, t, B!);
    Object.assign(B!, { latestPickupT: r.pickupT + 6 * 60, latestDeliveryT: r.deliverT + DAY });
    expect(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: B!.id })).toEqual({ ok: true });
    expect(t.nextLoadId).toBe(B!.id);
    // Then the driver comes due: 30 days out on a 21-day home rule.
    c.orders.push({ kind: "homeTime", afterDays: 21, restDays: 3 });
    d.awayDays = 30;
    const notes: string[] = [];
    w.listener = (e) => void (e.kind === "notice" && notes.push(e.text));
    for (let h = 0; h < 72 && !(t.loadId === B!.id && t.status === "loaded"); h++) stepHour(w);
    expect(t.loadId).toBe(B!.id);
    expect(t.status).toBe("loaded"); // picked up: no no-show
    expect(onDaysOff(w, d.id)).toBe(false); // the days off wait
    expect(notes.some((x) => /due for days off, but .+ → .+ is booked for \w+day\. It goes first; (your|their) days off start when (you're|they're) home with nothing booked\./.test(x))).toBe(true);
    // Delivered away from home, with nothing booked: still no days off; they start at home.
    for (let h = 0; h < 72 && w.loads.has(B!.id); h++) stepHour(w);
    expect(w.loads.has(B!.id)).toBe(false);
    expect(hubMiles(w, t.hub, c.homeHub) > w.cfg.map.nearbyRadiusMi).toBe(true);
    expect(onDaysOff(w, d.id)).toBe(false);
  }, 60_000);

  it("the guard: held for a hired driver's days off, canMake counts them as time the truck isn't free", () => {
    const cfg = on();
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 22 });
    populate(w, { freeOwnerOperators: 0, fleets: 3, brokers: 4 });
    toNextRound(w);
    const t = w.trucks.find((x) => x.companyId > 0 && x.status === "idle" && x.driverId > 0 && !w.staff[x.driverId - 1]!.owner && x.nextLoadId === undefined)!;
    expect(t).toBeTruthy();
    const c = w.companies[t.companyId - 1]!;
    const d = w.staff[t.driverId - 1]!;
    d.homeUntilDay = dayOf(w.t, w.cfg) + 2; // home on days off: rule H holds a booking now until they end
    d.awayDays = 0;
    const back = d.homeUntilDay * DAY;
    const B = [...w.loads.values()].find((l) => takeable(w, c, t)(l) && placeMiles(w, t.place, l.originPlace) > 600 && placeMiles(w, t.place, l.originPlace) < 800)!;
    expect(B).toBeTruthy();
    // Ready after the days off end, closing before the truck can get there from them.
    Object.assign(B, { readyT: back + 10 * 60, latestPickupT: back + 12 * 60, latestDeliveryT: back + 6 * DAY });
    const held = canMake(w, t, B);
    expect(held).toMatchObject({ ok: false, why: "pickup", freeT: back });
    expect(reachRefusal(w, B, held)).toMatch(/^The truck is free .+: it reaches .+, after the pickup closes /);
    const booked = applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: B.id });
    expect(booked.ok).toBe(false);
    expect((booked as { reason: string }).reason).toMatch(/after the pickup closes/);
    // Closing before the days off end: the director's words.
    Object.assign(B, { readyT: back - 20 * 60, latestPickupT: back - 14 * 60 });
    const off = canMake(w, t, B);
    expect(off.why).toBe("daysOff");
    expect(reachRefusal(w, B, off)).toMatch(/^this truck is on days off until \w{3} 00:00, after the \w{3} \d\d:\d\d pickup$/);
    // An owner's days off are his to cut: nothing is held, so the reach is from here and now.
    Object.assign(B, { readyT: back + 10 * 60, latestPickupT: back + 12 * 60 });
    d.owner = true;
    expect(canMake(w, t, B).ok).toBe(true);
    d.owner = false;
    // Off (the switch), the reach is from here and now as before, though the booking would wait for the days off.
    (cfg.labor.dueHomePlan as { enabled: boolean }).enabled = false;
    expect(canMake(w, t, B).ok).toBe(true);
  }, 60_000);

  it("the guard: a booking it allows is held for the days off and still makes its pickup", () => {
    const w = createWorld({ cfg: on(), net, feeds: neutralFeeds, seed: 22 });
    populate(w, { freeOwnerOperators: 0, fleets: 3, brokers: 4 });
    toNextRound(w);
    const t = w.trucks.find((x) => x.companyId > 0 && x.status === "idle" && x.driverId > 0 && !w.staff[x.driverId - 1]!.owner && x.nextLoadId === undefined)!;
    const c = w.companies[t.companyId - 1]!;
    const d = w.staff[t.driverId - 1]!;
    d.homeUntilDay = dayOf(w.t, w.cfg) + 1;
    d.awayDays = 0;
    const back = d.homeUntilDay * DAY;
    // A load of its trailer, the truck standing a few hours' run from its pickup.
    let B: Load | undefined;
    let near = -1;
    for (const l of [...w.loads.values()].filter(takeable(w, c, t))) {
      near = w.net.places.findIndex((_p, i) => placeMiles(w, i, l.originPlace) > 100 && placeMiles(w, i, l.originPlace) < 250);
      if (near >= 0) {
        B = l;
        break;
      }
    }
    if (!B) throw new Error("no load to hold");
    const hub = w.net.places[near]!.market;
    Object.assign(t, { hub, targetHub: hub, place: near, targetPlace: near });
    Object.assign(B, { readyT: back + 8 * 60, latestPickupT: back + 20 * 60, latestDeliveryT: back + 6 * DAY });
    expect(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: B.id })).toEqual({ ok: true });
    expect(t.nextLoadId).toBe(B.id); // held for the days off
    for (let h = 0; h < 72 && !(t.loadId === B.id && t.status === "loaded"); h++) stepHour(w);
    expect(t.loadId).toBe(B.id);
    expect(t.status).toBe("loaded");
    expect(w.t).toBeLessThanOrEqual(B.latestPickupT! + 3 * 60); // loaded within the dwell of the close
  }, 60_000);
});
