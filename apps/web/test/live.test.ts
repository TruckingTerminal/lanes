import { describe, expect, it } from "vitest";
import { hubs } from "@lanes/data";
import { hubMiles, type Action, type World } from "@lanes/engine";
import { RULESET } from "../src/game.js";
import { LiveWorld, MS_PER_GAME_HOUR, type WorldMeta } from "../src/live.js";
import { MemoryDb } from "../src/memdb.js";

const MIN = MS_PER_GAME_HOUR / 60;
const starters = hubs.filter((h) => h.isStarter).map((h) => h.id);
const settle = () => new Promise((r) => setTimeout(r, 0));

/** Everything that matters about a world, in a form two worlds can be compared by. */
function summary(w: World): string {
  const balances = [...(w.ledger as unknown as { balances: Map<string, number> }).balances.entries()].sort();
  const trucks = w.trucks.map((t) => [t.id, t.companyId, t.status, t.hub, t.targetHub, t.remainingMi, t.odometer]);
  return JSON.stringify({ t: w.t, balances, trucks, loads: [...w.loads.keys()], companies: w.companies.map((c) => [c.name, c.reputation, c.orders]) });
}

/** A plausible bid for one of this player's idle trucks, read off that player's own world. */
function bidFor(lw: LiveWorld): Action | null {
  const w = lw.w;
  for (const t of w.trucksByCompany.get(lw.player!.id)!) {
    if (t.status !== "idle") continue;
    for (const l of w.loads.values()) {
      if (l.status === "open" && l.equipment === t.trailer && hubMiles(w, t.hub, l.origin) <= 300) return { type: "place_bid", truckId: t.id, loadId: l.id, rate: l.refRate * 0.97 };
    }
  }
  return null;
}

describe("live world", () => {
  it("computes the same world on every page, including one that loads later and one that hears an action late", async () => {
    let clock = 6 * MS_PER_GAME_HOUR;
    const now = () => clock;
    const db = new MemoryDb(now);
    const meta: WorldMeta = { v: 1, seed: 4242, epochMs: 0, msPerGameHour: MS_PER_GAME_HOUR, ruleset: RULESET };
    const a = await LiveWorld.open(db, meta, "alice", { now, holder: "a" });
    const b = await LiveWorld.open(db, meta, "bob", { now, holder: "b" });
    await a.rebuild();
    await b.rebuild();
    expect(a.writer && b.writer).toBe(true);
    await a.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await b.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });

    let compared = 0;
    for (let step = 1; step <= (3 * 24 * 60) / 5; step++) {
      clock += 5 * MIN;
      await settle();
      a.advance(1e9);
      b.advance(1e9);
      expect(a.needRebuild || b.needRebuild).toBe(false);
      if (a.player && b.player && step % 24 === 0) {
        for (const lw of [a, b]) {
          const bid = bidFor(lw);
          if (bid) await lw.submit(bid);
        }
      }
      if (step === 100) await a.submit({ type: "set_standing_orders", orders: [{ kind: "bid", maxDeadheadMi: 100, price: { mode: "ceilingPct", pct: 0.9 } }, { kind: "floor", breakEvenPlusPct: 0.1 }] });
      if (step === 150) {
        const t = b.w.trucksByCompany.get(b.player!.id)!.find((x) => x.status === "idle");
        if (t) await b.submit({ type: "reposition_truck", truckId: t.id, hubId: starters[2]! });
      }
      if (step % 12 === 0) {
        expect(summary(a.w)).toBe(summary(b.w));
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(50);
    expect(a.player!.name).toBe("Alice Haul");
    expect(a.w.companies.filter((c) => c.strategy.startsWith("player:")).length).toBe(2);

    // A spectator opening now replays the log to the same world.
    const c = await LiveWorld.open(db, meta, null, { now });
    await c.rebuild();
    a.advance(1e9);
    expect(summary(c.w)).toBe(summary(a.w));

    // Bob's next action reaches Alice's page only after its minute has passed.
    db.hold = true;
    await b.submit({ type: "set_standing_orders", orders: [{ kind: "floor", breakEvenPlusPct: 0.2 }] });
    clock += 90 * MIN;
    a.advance(1e9);
    b.advance(1e9);
    expect(summary(a.w)).not.toBe(summary(b.w));
    db.hold = false;
    db.flush();
    await settle();
    expect(a.needRebuild).toBe(true);
    await a.rebuild();
    expect(summary(a.w)).toBe(summary(b.w));
  }, 120_000);
});

describe("the live rings", () => {
  it("reads the starter hubs during the replay's last two game days, so the page rings from the first look, and the world is the same", async () => {
    const { rankStarters, sampleStarters, seasonRounds, starterHubs } = await import("../src/hubcard.js");
    const clock = 5 * 24 * MS_PER_GAME_HOUR + 7 * MS_PER_GAME_HOUR;
    const now = () => clock;
    const meta: WorldMeta = { v: 1, seed: 77, epochMs: 0, msPerGameHour: MS_PER_GAME_HOUR, ruleset: RULESET };
    const sampled = await LiveWorld.open(new MemoryDb(now), meta, "carol", { now, holder: "c" });
    sampled.onHour = (w) => {
      if (w.t % 720 === 360 && w.t >= sampled.gameMinute() - 2 * 1440) sampleStarters(w);
    };
    const plain = await LiveWorld.open(new MemoryDb(now), meta, "dave", { now, holder: "d" });
    await sampled.rebuild();
    await plain.rebuild();
    expect(starterHubs(sampled.w).every((i) => seasonRounds(sampled.w, i) >= 4)).toBe(true);
    expect(rankStarters(sampled.w)).toHaveLength(starterHubs(sampled.w).length);
    // Reading the world changes nothing in it.
    expect(summary(sampled.w)).toBe(summary(plain.w));
  }, 120_000);
});
