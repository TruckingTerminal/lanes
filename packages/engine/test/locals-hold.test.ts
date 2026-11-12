import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { applyAction, companyAccount, createWorld, formCompany, hubMiles, isRoundBoundary, mayTake, stepHour, type Company, type Load, type Truck, type World } from "@lanes/engine";

/**
 * leverage.localHoldHandBids (the economy's locals-first look, 2026-11-09): a visitor's bid by hand on a locals-first load
 * is filed in the last round of its hold and cleared at the opening; refused earlier; a local who books it first wins it.
 * On the live profile.
 */
const LIVE = withLiveLevers();
const ON: EconomyConfig = { ...LIVE, leverage: { ...LIVE.leverage, localHoldHandBids: true } };
// Off by its own key (0.24.1 switched it on in the live levers).
const OFF: EconomyConfig = { ...LIVE, leverage: { ...LIVE.leverage, localHoldHandBids: false } };
const net = buildNetwork(hubs, LIVE);

function digest(cfg: EconomyConfig): string {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 20_261_109 });
  populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 6 });
  for (let h = 0; h < 10 * 24; h++) stepHour(w, ruleBotHook);
  const s = JSON.stringify({ t: w.t, next: w.nextLoadId, supply: w.ledger.supply(), books: w.companies.map((c) => [c.id, w.ledger.balance(companyAccount(c.id)), c.delivered, c.onTime, c.operating]), days: w.metrics.days, loads: [...w.loads.values()], trucks: w.trucks });
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

function toNextRound(w: World): void {
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
}

/** Brokers posting freight and a visiting owner-operator based at Dallas, its truck standing at a load's shipper. */
function setup(seed: number) {
  const w = createWorld({ cfg: ON, net, feeds: neutralFeeds, seed, keepLedgerEntries: true });
  populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
  const c = formCompany(w, { name: "Visiting Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
  c.authority.status = "active";
  c.firstHandBidDay = 0;
  const t = w.trucksByCompany.get(c.id)![0]!;
  toNextRound(w);
  // An NPC load far from Dallas the visitor may otherwise take: its trailer, no vetting, not hot, no tender or hold.
  const load = [...w.loads.values()].find((l) => l.status === "open" && l.brokerId === null && l.shipperId === null && l.equipment === t.trailer && l.vet === 0 && l.hot === 0 && l.tenderedTo === 0 && !l.hold && hubMiles(w, l.origin, c.homeHub) > 400)!;
  standAt(t, load);
  return { w, c, t, load };
}
function standAt(t: Truck, l: Load): void {
  t.status = "idle";
  t.hub = t.targetHub = l.origin;
  t.place = t.targetPlace = l.originPlace;
  t.remainingMi = 0;
}
const bid = (w: World, c: Company, t: Truck, l: Load) => applyAction(w, c.id, { type: "place_bid", truckId: t.id, loadId: l.id, rate: l.ceiling });
const FIRST_CALL = { ok: false, reason: "the shipper is giving local carriers first call this round" };

describe("the hand bidder's round (leverage.localHoldHandBids)", () => {
  it("leaves the ten-day world identical with the key false and absent, and on, since no bot files a bid", () => {
    const { localHoldHandBids: _, ...leverage } = OFF.leverage;
    const off = digest(OFF);
    expect(digest({ ...OFF, leverage } as unknown as EconomyConfig)).toBe(off);
    expect(digest(ON)).toBe(off);
  }, 120_000);

  it("refuses a hand bid a round before the hold's last, files it in the last, and clears it at the opening", () => {
    const { w, c, t, load } = setup(61);
    // A round before the last: today's refusal.
    load.localUntilRound = w.round + 1;
    expect(mayTake(w, c, load)).toBe(false);
    expect(bid(w, c, t, load)).toEqual(FIRST_CALL);
    // Off, the last round refuses too.
    load.localUntilRound = w.round;
    (w as { cfg: EconomyConfig }).cfg = OFF;
    expect(bid(w, c, t, load)).toEqual(FIRST_CALL);
    (w as { cfg: EconomyConfig }).cfg = ON;
    // On, in the last round: filed for the opening clearing.
    expect(bid(w, c, t, load)).toEqual({ ok: true });
    expect(w.manualBids.get(t.id)).toEqual({ loadId: load.id, rate: load.ceiling });
    toNextRound(w);
    expect(load.status).not.toBe("open");
    expect(load.carrierId).toBe(c.id);
    expect(t.loadId).toBe(load.id);
  }, 60_000);

  it("loses to a local carrier who books the load first in the hold", () => {
    const { w, c, t, load } = setup(62);
    const local = formCompany(w, { name: "Local Freight", role: "carrier", homeHubId: w.net.hubs[load.origin]!.id, strategy: "test", orders: [], freePath: true });
    local.authority.status = "active";
    local.firstHandBidDay = 0;
    const lt = w.trucksByCompany.get(local.id)![0]!;
    standAt(lt, load);
    load.localUntilRound = w.round;
    expect(bid(w, c, t, load)).toEqual({ ok: true });
    // The local takes it at Book now while it's still theirs.
    expect(mayTake(w, local, load)).toBe(true);
    expect(applyAction(w, local.id, { type: "book_load", truckId: lt.id, loadId: load.id })).toEqual({ ok: true });
    toNextRound(w);
    expect(load.carrierId).toBe(local.id);
    expect(t.loadId).toBeNull();
    expect(t.status).toBe("idle");
  }, 60_000);
});
