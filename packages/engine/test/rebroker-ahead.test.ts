import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { applyAction, companyAccount, createWorld, formCompany, isRoundBoundary, placeMiles, rebrokerLoad, stepHour, type Load, type World } from "@lanes/engine";

/**
 * A load re-posted from a truck's plan (the economy's windows-on twins, 2026-11-10: "Ledger entry to itself" in
 * fraud.ts settleDoubleBroker). The rebroker standing order re-posts some of what the dispatcher won in a round; with
 * delivery windows a load can be won ahead, for a truck heading for another load's pickup.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
// The unlock ladder off, so re-posting (the brokerage layer) is open on day 0.
const noLadder = (c: EconomyConfig): EconomyConfig => ({ ...c, unlockLadder: { ...c.unlockLadder, enabled: false, beta: { ...c.unlockLadder.beta, enabled: false } } });
const OFF = noLadder(LIVE);
const ON = noLadder({ ...LIVE, windows: { ...LIVE.windows, enabled: true } });

/** A carrier whose truck is heading for one load's pickup (booked by Book now). */
function heading(cfg: EconomyConfig) {
  const w: World = createWorld({ cfg, net, feeds: neutralFeeds, seed: 11, keepLedgerEntries: true });
  const c = formCompany(w, { name: "Repost Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: true });
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 1_000_000, "test");
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
  const t = w.trucksByCompany.get(c.id)![0]!;
  // A pickup away from where the truck stands, so it heads there (one at its own town has it loading at once).
  const open = [...w.loads.values()].filter((l) => l.status === "open" && l.equipment === t.trailer && l.vet === 0 && l.shipperId === null && placeMiles(w, t.place, l.originPlace) > 40);
  const first = open.find((l) => applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: l.id }).ok);
  expect(first).toBeDefined();
  expect(t.status).toBe("toPickup");
  expect(t.loadId).toBe(first!.id);
  const other = open.find((l) => l !== first && l.status === "open")!;
  return { w, c, t, first: first!, other };
}
/** Booked ahead for that truck, as board.ts assign does while it's on a job. */
function bookAhead(w: World, load: Load, carrierId: number, truckId: number): void {
  load.status = "assigned";
  load.carrierId = carrierId;
  load.truckId = truckId;
  load.clearedRate = load.bookNow;
  load.ahead = true;
  w.trucks[truckId - 1]!.nextLoadId = load.id;
}

describe("re-posting a load won ahead (fraud.ts rebrokerLoad)", () => {
  it("windows off: a truck heading for one load's pickup can't have another re-posted under it", () => {
    const { w, c, other } = heading(OFF);
    // A load assigned to the truck that isn't the one it's heading for: refused, the truck's job untouched.
    other.status = "assigned";
    other.carrierId = c.id;
    other.truckId = w.trucksByCompany.get(c.id)![0]!.id;
    other.clearedRate = other.bookNow;
    expect(rebrokerLoad(w, c, other, other.clearedRate * 0.9, true)).toBe("the truck is already loading");
  });

  it("windows on: the load leaves the truck's plan, the truck stays on its job, and the world runs on", () => {
    const { w, c, t, first, other } = heading(ON);
    bookAhead(w, other, c.id, t.id);
    expect(rebrokerLoad(w, c, other, other.clearedRate * 0.9, true)).toBeNull();
    // The truck is still heading for the first load; the re-posted one is open, off its plan.
    expect(t.loadId).toBe(first.id);
    expect(t.nextLoadId).toBeUndefined();
    expect(first.status).toBe("assigned");
    expect(other.status).toBe("open");
    expect(other.doubleBroker?.companyId).toBe(c.id);
    expect(other.ahead).toBeUndefined();
    // Before the fix the truck abandoned the first load, took this one and delivered it to its own re-poster: a ledger
    // entry to itself. Three days on, the world runs and balances.
    for (let h = 0; h < 72; h++) stepHour(w);
    w.ledger.assertBalanced();
    expect(w.ledger.entries.some((e) => e.from === e.to)).toBe(false);
  }, 60_000);
});
