import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { afterBreakdown, applyAction, companyAccount, createWorld, formCompany, isRoundBoundary, mayTake, placeMiles, stepHour, urgent, vettingBlock, type Load, type World } from "@lanes/engine";

/**
 * The director's sprint §1 (windows.releaseCurrent, off by default): the load a truck is heading to may be released
 * until it's picked up, at a load booked ahead's shares, and the truck stops at the next town.
 */
const LIVE = withLiveLevers();
const ON: EconomyConfig = { ...LIVE, windows: { ...LIVE.windows, enabled: true, releaseCurrent: true } };
const OFF: EconomyConfig = { ...LIVE, windows: { ...LIVE.windows, enabled: true, releaseCurrent: false } };
const net = buildNetwork(hubs, LIVE);
const DAY = LIVE.time.gameMinutesPerDay;

function toNextRound(w: World): void {
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
}

/** A company's truck heading empty to a load's pickup, `done` of the way there (0: not rolled yet); a second load booked ahead if asked. */
function heading(cfg: EconomyConfig, seed: number, o: { human?: boolean; done?: number; ahead?: boolean } = {}) {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed, keepLedgerEntries: true });
  populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
  const c = formCompany(w, { name: "Release Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
  c.authority.status = "active";
  c.human = o.human ?? true;
  const t = w.trucksByCompany.get(c.id)![0]!;
  toNextRound(w);
  const ok = (l: Load) => l.status === "open" && l.equipment === t.trailer && l.hot === 0 && l.contractId === 0 && !l.hold && l.doubleBroker === null && vettingBlock(w, c, l) === null && mayTake(w, c, l);
  const a = [...w.loads.values()].find((l) => ok(l) && l.routeHours > 1 && l.routeHours < 6)!;
  // The truck stands at a town 80 to 250 miles from the pickup (within book_load's reach by hand).
  const from = w.net.places.findIndex((p, i) => p.market !== undefined && i !== a.originPlace && placeMiles(w, i, a.originPlace) > 80 && placeMiles(w, i, a.originPlace) < 250);
  const hub = w.net.places[from]!.market;
  Object.assign(a, { readyT: w.t, latestPickupT: w.t + 2 * DAY, latestDeliveryT: w.t + 8 * DAY });
  Object.assign(t, { status: "idle", hub, targetHub: hub, place: from, targetPlace: from, remainingMi: 0, loadId: null, shiftStartT: null, shiftDrivenMin: 0, emptyMi: 0, loadedMi: 0 });
  expect(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: a.id })).toEqual({ ok: true });
  expect(t.status).toBe("toPickup");
  let b: Load | undefined;
  if (o.ahead) {
    b = [...w.loads.values()].filter((l) => ok(l) && l.id !== a.id).sort((x, y) => placeMiles(w, a.destPlace, x.originPlace) - placeMiles(w, a.destPlace, y.originPlace))[0]!;
    Object.assign(b, { readyT: w.t + DAY, latestPickupT: w.t + 3 * DAY, latestDeliveryT: w.t + 9 * DAY });
    expect(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: b.id })).toEqual({ ok: true });
    expect(t.nextLoadId).toBe(b.id);
  }
  const leg = t.remainingMi;
  const done = o.done ?? 0.5;
  t.legMiles = leg;
  t.remainingMi = leg * (1 - done);
  t.emptyMi = leg * done;
  const notices: string[] = [];
  const prev = w.listener;
  w.listener = (e) => {
    prev?.(e);
    if (e.kind === "notice" && e.companyId === c.id) notices.push(e.text);
  };
  return { w, c, t, a, b, leg, notices };
}
const claims = (w: World, l: Load) => w.ledger.entries.filter((e) => e.ref === `claim:cancel:${l.id}`);

describe("releasing the current load before pickup (windows.releaseCurrent)", () => {
  it("off: only a load booked ahead can be released, as before", () => {
    const { w, c, a } = heading(OFF, 71);
    expect(applyAction(w, c.id, { type: "release_load", loadId: a.id })).toEqual({ ok: false, reason: "only a load booked ahead can be released" });
    expect(a.status).toBe("assigned");
  }, 60_000);

  it("on: released on the way, at a load booked ahead's share with the mark; the load goes back on the board, never to the same carrier; the truck stops at the next town, the miles so far sunk", () => {
    const { w, c, t, a, leg, notices } = heading(ON, 72);
    const failed = c.failed ?? 0;
    const cash = w.ledger.balance(companyAccount(c.id));
    // The early share, or the urgent one in the load's last rounds; read first: back on the board, the load's rate clears.
    const fd = (urgent(w, a) ? ON.windows.cancelClaimShare.urgent : ON.windows.cancelClaimShare.early) * a.clearedRate * a.miles;
    expect(applyAction(w, c.id, { type: "release_load", loadId: a.id })).toEqual({ ok: true });
    expect(claims(w, a)[0]!.amount).toBeCloseTo(fd, 2);
    expect(c.failed).toBe(failed + 1);
    expect(a.status).toBe("open");
    expect(a.releasedBy).toEqual([c.id]);
    expect(mayTake(w, c, a)).toBe(false);
    expect(t.loadId).toBeNull();
    expect(t.status).toBe("repositioning");
    expect(t.targetPlace).toBe(t.place);
    expect(t.emptyMi).toBe(0); // the half-leg paid
    expect(w.ledger.balance(companyAccount(c.id))).toBeLessThan(cash - claims(w, a)[0]!.amount);
    expect(notices.at(-1)).toMatch(new RegExp(`^Truck ${t.id} stops at .+: load #${a.id} released before pickup, its ${Math.round(leg / 2).toLocaleString("en-US")} empty miles so far sunk\\.$`));
    // It runs on to the town and stands there.
    for (let h = 0; h < 12 && t.status !== "idle"; h++) stepHour(w);
    expect(t.status).toBe("idle");
    w.ledger.assertBalanced();
  }, 60_000);

  it("on: a truck that hasn't rolled stands where it is; once loaded, never", () => {
    const still = heading(ON, 73, { done: 0 });
    const place = still.t.place;
    expect(applyAction(still.w, still.c.id, { type: "release_load", loadId: still.a.id })).toEqual({ ok: true });
    expect(still.t.status).toBe("idle");
    expect(still.t.place).toBe(place);
    const loaded = heading(ON, 74);
    loaded.a.status = "inTransit";
    loaded.t.status = "loaded";
    expect(applyAction(loaded.w, loaded.c.id, { type: "release_load", loadId: loaded.a.id })).toEqual({ ok: false, reason: "only a load not yet picked up can be released" });
  }, 60_000);

  it("on: a load booked ahead moves up once the truck stands, checked again; one it can't make now is the ask", () => {
    const { w, c, t, a, b } = heading(ON, 75, { ahead: true });
    expect(applyAction(w, c.id, { type: "release_load", loadId: a.id })).toEqual({ ok: true });
    expect(t.nextLoadId).toBe(b!.id);
    expect(b!.releaseAsk).toBeUndefined();
    for (let h = 0; h < 12 && t.loadId !== b!.id; h++) stepHour(w);
    expect(t.loadId).toBe(b!.id);
    // Another world: the load ahead's pickup now too soon for the truck from the town: the ask, at the early share.
    const o = heading(ON, 76, { ahead: true });
    o.b!.latestPickupT = o.w.t + 30;
    expect(applyAction(o.w, o.c.id, { type: "release_load", loadId: o.a.id })).toEqual({ ok: true });
    expect(o.b!.releaseAsk).toEqual({ truckId: o.t.id, fd: ON.windows.cancelClaimShare.early * o.b!.clearedRate * o.b!.miles, t: o.w.t });
    expect(o.notices.at(-1)).toMatch(/stops at .+, so it can't reach .+\. Release load #\d+ now \(−[\d,]+ FD\) or keep it\.$/);
  }, 60_000);

  it("on: a breakdown on the way that breaks the pickup: a bot releases at once at the early share; a load booked by hand asks first", () => {
    const bot = heading(ON, 77, { human: false });
    bot.t.breakdownMin = 4 * DAY;
    const fd = ON.windows.cancelClaimShare.early * bot.a.clearedRate * bot.a.miles;
    afterBreakdown(bot.w, bot.t);
    expect(bot.a.status).toBe("open");
    expect(claims(bot.w, bot.a)[0]!.amount).toBeCloseTo(fd, 2);
    expect(bot.t.loadId).toBeNull();
    const byHand = heading(ON, 78);
    byHand.c.orders = [{ kind: "bid", maxDeadheadMi: 300, price: { mode: "ceilingPct", pct: 0.95 } }];
    expect(byHand.a.byHand).toBe(true);
    byHand.t.breakdownMin = 4 * DAY;
    afterBreakdown(byHand.w, byHand.t);
    expect(byHand.a.status).toBe("assigned");
    expect(byHand.a.releaseAsk?.truckId).toBe(byHand.t.id);
    expect(byHand.notices.at(-1)).toMatch(/breakdown means it can't reach .+\. Release load #\d+ now \(−[\d,]+ FD\) or keep it\.$/);
    expect(applyAction(byHand.w, byHand.c.id, { type: "keep_load", loadId: byHand.a.id })).toEqual({ ok: true });
    expect(byHand.a.releaseAsk).toBeUndefined();
  }, 60_000);

  it("on: past the pickup's close it's a no-show, as before", () => {
    const { w, c, a } = heading(ON, 79);
    a.latestPickupT = w.t - 1;
    expect(applyAction(w, c.id, { type: "release_load", loadId: a.id })).toEqual({ ok: true });
    expect(w.ledger.entries.filter((e) => e.ref === `claim:noshow:${a.id}`)).toHaveLength(1);
  }, 60_000);
});
