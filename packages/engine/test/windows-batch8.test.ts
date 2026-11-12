import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { applyAction, blockFacilityHub, companyAccount, createWorld, dayOf, EQUIPMENT, facilityBlocked, isRoundBoundary, planIndex, stepHour, type Load, type World } from "@lanes/engine";

/**
 * Delivery windows batch 8 (economy-delivery-windows-batch7-2026-11-12.md §4; the producer, 2026-11-12): under windows the
 * ratio's lift reads windows.ratioExponent in all three of its reads (the reference, the contract index and the
 * memory-free contract index), and a bot facility closed at a loss blocks bot facilities at its hub for
 * windows.facilityBlockWeeks.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const noLadder = (c: EconomyConfig): EconomyConfig => ({ ...c, unlockLadder: { ...c.unlockLadder, enabled: false, beta: { ...c.unlockLadder.beta, enabled: false } } });
/** A config of its own (the windows block copied), so one world's exponent can change without the other's. */
const withWindows = (enabled: boolean, ratioExponent: number): EconomyConfig => noLadder({ ...LIVE, windows: { ...LIVE.windows, enabled, ratioExponent } });

const toNextRound = (w: World) => {
  do stepHour(w, ruleBotHook);
  while (!isRoundBoundary(w.t, w.cfg));
};
function world(cfg: EconomyConfig, seed: number): World {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed });
  populate(w, { freeOwnerOperators: 20, fleets: 4, brokers: 6 });
  for (let h = 0; h < 3 * 24; h++) stepHour(w, ruleBotHook);
  toNextRound(w);
  return w;
}
/** The NPC shippers' loads the next round posts. */
function nextRound(w: World): Load[] {
  const before = new Set(w.loads.keys());
  toNextRound(w);
  return [...w.loads.values()].filter((l) => !before.has(l.id) && l.shipperId === null && l.facilityId === null).sort((x, y) => x.id - y.id);
}

describe("delivery windows batch 8", () => {
  it("under windows, windows.ratioExponent lifts the reference and both contract indexes by the hub's ratio", () => {
    const rates = LIVE.rates.ratioExponent;
    // Two windows worlds on rates.ratioExponent, the same to the round; then one turns to 0.5 for the next round's posting.
    const a = world(withWindows(true, rates), 8);
    const b = world(withWindows(true, rates), 8);
    expect([...b.contractIndex]).toEqual([...a.contractIndex]);
    (b.cfg.windows as { ratioExponent: number }).ratioExponent = 0.5;
    const fa = nextRound(a);
    const fb = nextRound(b);
    // The same freight drawn: the exponent moves prices, not the draws.
    expect(fb.map((l) => [l.id, l.laneId, l.equipment])).toEqual(fa.map((l) => [l.id, l.laneId, l.equipment]));
    expect(fa.length).toBeGreaterThan(20);
    const ratio = b.lastRatioEq!;
    let up = 0;
    for (let i = 0; i < fa.length; i++) {
      const r = ratio[planIndex(fa[i]!.origin, EQUIPMENT.indexOf(fa[i]!.equipment))]!;
      const d = fb[i]!.refRate - fa[i]!.refRate;
      // ratio^0.5 against ratio^0.35: higher where the hub is short of trucks, lower where it has too many.
      if (r > 1 + 1e-9) expect(d).toBeGreaterThan(0);
      else if (r < 1 - 1e-9) expect(d).toBeLessThan(0);
      if (d > 0) up++;
    }
    expect(up).toBeGreaterThan(0);
    // The contract index (the carriers' contract pay) moves the same way, hub by hub.
    for (let k = 0; k < ratio.length; k++) {
      const d = b.contractIndex[k]! - a.contractIndex[k]!;
      if (ratio[k]! > 1 + 1e-9) expect(d).toBeGreaterThan(0);
      else if (ratio[k]! < 1 - 1e-9) expect(d).toBeLessThan(0);
    }
    // And the memory-free contract index (every brokered tender) reads it too.
    expect([...b.contractIndexBase!]).not.toEqual([...a.contractIndexBase!]);
  }, 120_000);

  it("with windows off, windows.ratioExponent is never read", () => {
    const run = (x: number) => {
      const w = world(withWindows(false, x), 8);
      for (let h = 0; h < 48; h++) stepHour(w, ruleBotHook);
      return JSON.stringify({ t: w.t, loads: [...w.loads.values()].map((l) => [l.id, l.refRate, l.bookNow, l.status]), contract: [...w.contractIndex] });
    };
    expect(run(0.9)).toBe(run(0.5));
  }, 120_000);

  it("a bot facility closed at a loss blocks bot facilities at its hub for facilityBlockWeeks, with windows on only", () => {
    const run = (cfg: EconomyConfig) => {
      const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 6 });
      populate(w, { freeOwnerOperators: 3, fleets: 2, brokers: 0 });
      const c = w.companies.find((x) => x.role === "carrier" && (w.trucksByCompany.get(x.id) ?? []).some((t) => t.lease === "owned"))!;
      w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 5_000_000, "test");
      expect(applyAction(w, c.id, { type: "buy_facility", facility: "warehouse", hubId: w.net.hubs[c.homeHub]!.id })).toEqual({ ok: true });
      const f = w.facilities.find((x) => x.ownerId === c.id)!;
      f.boughtDay = dayOf(w.t, w.cfg) - 7 * cfg.windows.facilityCloseWeeks;
      f.netFd = -5_000;
      for (let h = 0; h < 24; h++) stepHour(w, ruleBotHook);
      return { f, w };
    };
    const on = run(withWindows(true, 0.5));
    expect(on.f.ownerId).toBe(0); // closed (batch 6)
    const until = on.w.facilityBlocked?.[on.f.hub];
    expect(until).toBe(dayOf(on.w.t, on.w.cfg) + 7 * on.w.cfg.windows.facilityBlockWeeks);
    expect(facilityBlocked(on.w, on.f.hub)).toBe(true);
    // No other hub is blocked, and the block lifts on its day.
    expect(Object.keys(on.w.facilityBlocked!)).toEqual([String(on.f.hub)]);
    on.w.t = until! * on.w.cfg.time.gameMinutesPerDay;
    expect(facilityBlocked(on.w, on.f.hub)).toBe(false);
    // Off: nothing is closed, nothing blocked, and the block's writer is a no-op.
    const off = run(withWindows(false, 0.5));
    expect(off.f.ownerId).not.toBe(0);
    blockFacilityHub(off.w, off.f.hub);
    expect(off.w.facilityBlocked).toBeUndefined();
    expect(facilityBlocked(off.w, off.f.hub)).toBe(false);
  }, 120_000);
});
