import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { applyAction, brokerKey, dockRule, brokerUncovered, companyAccount, createWorld, dayOf, formCompany, isRoundBoundary, lostMemory, lostShare, npcKey, partnerOf, postHeld, posterKind, readyAt, stepHour, type Load, type World } from "@lanes/engine";

/**
 * Delivery windows batch 7 (studio/reviews/economy-delivery-windows-batch6.md §4): every brokered tender is priced from the
 * memory-free contract index, the AI brokers' cover is read per hub across them, and the bots' facility test falls back
 * to the hub's NPC freight (the facility test itself: windows-batch6.test.ts).
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
// The unlock ladder off, so brokers and facilities are open on day 0.
const noLadder = (c: EconomyConfig): EconomyConfig => ({ ...c, unlockLadder: { ...c.unlockLadder, enabled: false, beta: { ...c.unlockLadder.beta, enabled: false } } });
const ON = noLadder({ ...LIVE, windows: { ...LIVE.windows, enabled: true } });

const toNextRound = (w: World) => {
  do stepHour(w, ruleBotHook);
  while (!isRoundBoundary(w.t, w.cfg));
};
/** A windows world three days in, at a round. */
function world(seed: number): World {
  const w = createWorld({ cfg: ON, net, feeds: neutralFeeds, seed });
  populate(w, { freeOwnerOperators: 20, fleets: 4, brokers: 6 });
  for (let h = 0; h < 3 * 24; h++) stepHour(w, ruleBotHook);
  toNextRound(w);
  return w;
}
/** The NPC shippers' loads the next round posts (not a facility's). */
function nextRound(w: World): Load[] {
  const before = new Set(w.loads.keys());
  toNextRound(w);
  return [...w.loads.values()].filter((l) => !before.has(l.id) && l.shipperId === null && l.facilityId === null).sort((x, y) => x.id - y.id);
}
const sumOver = (w: World, prefix: string, kind: "taken" | "lost") =>
  Object.entries(w.winTally ?? {})
    .filter(([k]) => k.startsWith(prefix))
    .reduce((s, [, list]) => s + list.reduce((t, e) => t + e[kind], 0), 0);

/** Windows on with players' brokerages (the bond, the factoring contract), as brokerage.test.ts runs them. */
const BROKERS: EconomyConfig = {
  ...ON,
  brokerage: { ...ON.brokerage, enabled: true },
  token: { ...ON.token, staking: { ...ON.token.staking, enabled: true }, payment: { ...ON.token.payment, enabled: true, factoring: { ...ON.token.payment.factoring, contract: { ...ON.token.payment.factoring.contract, enabled: true } } } },
};

describe("delivery windows batch 7", () => {
  it("prices a brokered tender from the memory-free contract index: the lost-load memory lifts the board's reference, not the shipper's contract", () => {
    const a = world(7);
    const b = world(7);
    expect(b.contractIndexBase).toBeDefined();
    expect([...b.contractIndexBase!]).toEqual([...a.contractIndexBase!]);
    // b remembers 40 lost loads at every hub and trailer; a remembers what it lost.
    b.lostMem ??= { t: b.t, v: new Array<number>(b.net.hubs.length * 3).fill(0) };
    const v = lostMemory(b)!;
    for (let k = 0; k < v.length; k++) v[k]! += 40;
    const fa = nextRound(a);
    const fb = nextRound(b);
    // The same freight drawn in both: the memory moves prices, not the draws.
    expect(fb.map((l) => [l.id, l.origin, l.dest, l.equipment, l.brokerId])).toEqual(fa.map((l) => [l.id, l.origin, l.dest, l.equipment, l.brokerId]));
    // The board's reference rises with the memory...
    const direct = (ls: Load[]) => ls.filter((l) => l.brokerId === null).reduce((s, l) => s + l.refRate, 0);
    expect(direct(fb)).toBeGreaterThan(direct(fa) * 1.05);
    expect([...b.contractIndex]).not.toEqual([...a.contractIndex]);
    // ...and a broker's contract with the shipper doesn't: the same rate, to the cent, and the same ceiling for the carrier.
    const brokered = fa.filter((l) => l.brokerId !== null);
    expect(brokered.length).toBeGreaterThan(0);
    for (const l of brokered) {
      const m = fb.find((x) => x.id === l.id)!;
      expect(m.shipperRate).toBe(l.shipperRate);
      expect(m.ceiling).toBe(l.ceiling);
    }
    expect([...b.contractIndexBase!]).toEqual([...a.contractIndexBase!]);
    a.ledger.assertBalanced();
    b.ledger.assertBalanced();
  }, 120_000);

  it("opens a tender held for a player's brokerage at its release, not at its posting, so the hold doesn't eat its pickup hours", () => {
    const w = createWorld({ cfg: BROKERS, net, feeds: neutralFeeds, seed: 9 });
    populate(w, { freeOwnerOperators: 10, fleets: 2, brokers: 6 });
    const c = formCompany(w, { name: "Owner Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
    w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 500_000, "test");
    const capital = BROKERS.token.staking.roles.broker + BROKERS.permits.brokerLicenseRenewalFd + 50_000;
    expect(applyAction(w, c.id, { type: "form_brokerage", name: "Owner Brokerage", capitalFd: capital })).toEqual({ ok: true });
    const b = partnerOf(w, c)!;
    // A cheap advertised margin wins the shippers' tenders.
    b.orders = [{ kind: "broker", marginPct: 0.01, maxOpenLoads: 20 }];
    toNextRound(w);
    const held = [...w.loads.values()].filter((l) => l.status === "open" && l.hold?.brokerId === b.id);
    expect(held.length).toBeGreaterThan(0);
    // Held: no window yet, the lead it was posted with kept.
    for (const l of held) {
      expect(l.readyT).toBeUndefined();
      expect(l.latestPickupT).toBeUndefined();
      expect(l.hold!.lead).toBeGreaterThanOrEqual(0);
    }
    // Released ten hours later (posted by hand): the window opens from now, with its lead.
    for (let h = 0; h < 10; h++) stepHour(w, ruleBotHook);
    const l = held.find((x) => x.status === "open" && x.hold)!;
    const lead = l.hold!.lead!;
    const opens = readyAt(w, l, lead);
    expect(postHeld(w, b, l, 0.01)).toBeNull();
    expect(l.hold).toBeUndefined();
    expect(l.readyT).toBe(opens);
    expect(l.readyT!).toBeGreaterThanOrEqual(w.t);
    const hours = (dockRule(w, l) === "appointment" ? BROKERS.windows.pickupHours.appointment : BROKERS.windows.pickupHours.firstCome) * 60;
    expect(l.latestPickupT! - l.readyT!).toBe(hours);
    w.ledger.assertBalanced();
  }, 120_000);

  it("keeps one cover tally per hub across the AI brokers, and holds every AI broker at an uncovered hub, never a player's brokerage", () => {
    const w = world(8);
    const takenBefore = sumOver(w, "b:", "taken");
    const npcBefore = sumOver(w, "n:", "taken");
    const fresh = nextRound(w);
    // What the AI brokers took this round, at its hub, under one key per hub; and the hub's NPC freight posted.
    expect(sumOver(w, "b:", "taken") - takenBefore).toBe(fresh.filter((l) => l.brokerId !== null).length);
    expect(sumOver(w, "n:", "taken") - npcBefore).toBe(fresh.filter((l) => ["npc", "broker"].includes(posterKind(w, l))).length);
    expect(Object.keys(w.winTally!).some((k) => /^b:\d+:\d+$/.test(k))).toBe(false);
    // A hub whose brokered loads lost a quarter last week: every AI broker is held there, and nowhere else.
    const brokers = w.companies.filter((c) => c.role === "broker");
    const hub = 5;
    const day = dayOf(w.t, w.cfg);
    w.winTally![brokerKey(hub)] = [{ day, taken: 8, lost: 2 }];
    expect(lostShare(w, brokerKey(hub)).share).toBe(0.25);
    // The hub beside it covers what it takes (pinned: on this seed it really loses a quarter by day four).
    w.winTally![brokerKey(hub + 1)] = [{ day, taken: 8, lost: 1 }];
    for (const c of brokers) {
      expect(brokerUncovered(w, c.id, hub)).toBe(true);
      expect(brokerUncovered(w, c.id, hub + 1)).toBe(false);
    }
    // A player's brokerage (linked to its carrier) isn't held by the rule.
    const carrier = w.companies.find((c) => c.role === "carrier")!;
    brokers[0]!.partnerId = carrier.id;
    expect(brokerUncovered(w, brokers[0]!.id, hub)).toBe(false);
  }, 120_000);
});
