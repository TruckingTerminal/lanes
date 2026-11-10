import "./seed.js";
import { describe, expect, it } from "vitest";
import { hubs } from "@lanes/data";
import { hubMiles, type Action, type World } from "@lanes/engine";
import { PLAYER_DISPATCHER_ORDERS, RULESET } from "../src/game.js";
import { LEAD_MIN, LiveWorld, MS_PER_GAME_HOUR, type WorldMeta } from "../src/live.js";
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

  describe("the red team's persistence fixes (studio/reviews/redteam-persistence.md §1, §2)", () => {
    const meta: WorldMeta = { v: 1, seed: 4242, epochMs: 0, msPerGameHour: MS_PER_GAME_HOUR, ruleset: RULESET };
    const LEASE_GONE = 5 * 60_000; // longer than the lease's 120 s life
    const orders = (n: number): Action => ({ type: "set_standing_orders", orders: n === 0 ? [] : PLAYER_DISPATCHER_ORDERS.slice(0, n) });
    const stored = async (db: MemoryDb, uid: string) => {
      const body = (await db.doc(`players/${uid}`).get()).data() as { acts: { s: number; a: Action }[] };
      return body.acts.map((r) => `${r.s}:${r.a.type}:${"orders" in r.a ? (r.a as { orders: unknown[] }).orders.length : ""}`);
    };

    /** Device A writes and sleeps past its lease; device B takes the lease, writes two orders and closes. */
    async function twoDevices() {
      let clock = 6 * MS_PER_GAME_HOUR;
      const now = () => clock;
      const db = new MemoryDb(now);
      const A = await LiveWorld.open(db, meta, "p1", { now, holder: "A", manualRenewal: true });
      await A.rebuild();
      await A.submit({ type: "join", name: "One Truck Co", hub: starters[0]! });
      clock += 5 * MIN;
      A.advance(1e9); // the company is in before its first order
      await A.submit(orders(1));
      expect(await stored(db, "p1")).toEqual(["0:join:", "1:set_standing_orders:1"]);
      clock += LEASE_GONE; // A's device sleeps: no renewal, the lease lapses
      const B = await LiveWorld.open(db, meta, "p1", { now, holder: "B", manualRenewal: true });
      expect(B.writer).toBe(true);
      await B.rebuild();
      await B.submit(orders(2));
      await B.submit(orders(3));
      expect(await stored(db, "p1")).toEqual(["0:join:", "1:set_standing_orders:1", "2:set_standing_orders:2", "3:set_standing_orders:3"]);
      B.close();
      clock += LEASE_GONE; // B's lease lapses too
      return { db, A, now, advance: (ms: number) => (clock += ms) };
    }

    it("a stale writer tab woken by its renewal re-reads, and the second device's orders survive (§1, the red team's sequence)", async () => {
      const { db, A, now } = await twoDevices();
      await A.renewLease(); // the renewal fires by hand: held again after a gap longer than the lease's life
      expect(A.writer).toBe(true);
      await A.submit(orders(0));
      expect(await stored(db, "p1")).toEqual(["0:join:", "1:set_standing_orders:1", "2:set_standing_orders:2", "3:set_standing_orders:3", "4:set_standing_orders:0"]);
      // A fresh page computes the world with B's orders in its history.
      const fresh = await LiveWorld.open(db, meta, null, { now });
      await fresh.rebuild();
      expect(fresh.isPlayer("p1")).toBe(true);
      A.close();
      fresh.close();
    });

    it("a stale writer tab that orders before its renewal takes the lease again first, and appends after what's there (§1)", async () => {
      const { db, A } = await twoDevices();
      // No renewal yet: the order itself finds the lease stale, takes it again and reads the store before writing.
      await A.submit(orders(0));
      expect(await stored(db, "p1")).toEqual(["0:join:", "1:set_standing_orders:1", "2:set_standing_orders:2", "3:set_standing_orders:3", "4:set_standing_orders:0"]);
      A.close();
    });

    it("a stale writer tab refuses to write while another device holds the lease (§1)", async () => {
      let clock = 6 * MS_PER_GAME_HOUR;
      const now = () => clock;
      const db = new MemoryDb(now);
      const A = await LiveWorld.open(db, meta, "p1", { now, holder: "A", manualRenewal: true });
      await A.rebuild();
      await A.submit({ type: "join", name: "One Truck Co", hub: starters[0]! });
      clock += LEASE_GONE;
      A.advance(1e9);
      const B = await LiveWorld.open(db, meta, "p1", { now, holder: "B", manualRenewal: true });
      await B.rebuild();
      await B.submit(orders(2));
      // B still holds the lease: A's order is refused, and nothing B wrote is touched.
      await expect(A.submit(orders(0))).rejects.toThrow(/only watching/);
      expect(await stored(db, "p1")).toEqual(["0:join:", "1:set_standing_orders:2"]);
      A.close();
      B.close();
    });

    it("stamps orders on the store's clock whatever the device's clock says (§2, the honest half)", async () => {
      const server = 6 * MS_PER_GAME_HOUR;
      const db = new MemoryDb(() => server);
      // A device an hour slow: before the fix its clock was kept (the offset was taken only under ten minutes).
      const slow = await LiveWorld.open(db, meta, "p2", { now: () => server - 60 * 60_000, holder: "S", manualRenewal: true });
      await slow.rebuild();
      const r = await slow.submit({ type: "join", name: "Slow Clock Co", hub: starters[1]! });
      expect(r.at).toBe(Math.ceil(server / MIN) + LEAD_MIN);
      slow.close();
    });

    it("a watching page drops a player's entries the store no longer holds, and rebuilds (§1, no split pages)", async () => {
      let clock = 6 * MS_PER_GAME_HOUR;
      const now = () => clock;
      const db = new MemoryDb(now);
      const A = await LiveWorld.open(db, meta, "p1", { now, holder: "A", manualRenewal: true });
      await A.rebuild();
      await A.submit({ type: "join", name: "One Truck Co", hub: starters[0]! });
      clock += 5 * MIN;
      A.advance(1e9);
      await A.submit(orders(1));
      await A.submit(orders(2));
      const watcher = await LiveWorld.open(db, meta, "p3", { now, holder: "W", manualRenewal: true });
      await watcher.rebuild();
      expect(watcher.needRebuild).toBe(false);
      // An older device's whole-list write, as before the fix: the last order is gone from the store.
      const body = (await db.doc("players/p1").get()).data() as { acts: unknown[]; archived: number };
      await db.doc("players/p1").set({ v: 1, acts: body.acts.slice(0, 2), archived: 0 });
      await settle();
      expect(watcher.needRebuild).toBe(true);
      await watcher.rebuild();
      const fresh = await LiveWorld.open(db, meta, null, { now });
      await fresh.rebuild();
      expect(summary(watcher.w)).toBe(summary(fresh.w));
      A.close();
      watcher.close();
      fresh.close();
    });

    /** Every order this page holds for a player (its own log, archives included). */
    const held = (lw: LiveWorld, uid: string) => (lw as unknown as { logs: Map<string, Map<number, unknown>> }).logs.get(uid)?.size ?? 0;

    it("a stale writer tab, and a page that missed the snapshots, read the archive chunk another device wrote meanwhile (§1, the archive edge)", async () => {
      const { db, A, now, advance } = await twoDevices(); // the store holds s0–s3; A saw s0–s1
      const W = await LiveWorld.open(db, meta, "p3", { now, holder: "W", manualRenewal: true });
      await W.rebuild();
      // W stops hearing (asleep, offline) while device C writes 310 orders over a game day, past the document's 300: its
      // writes move the oldest 200 into players/p1/log/c00000.
      db.hold = true;
      const C = await LiveWorld.open(db, meta, "p1", { now, holder: "C", manualRenewal: true });
      await C.rebuild();
      for (let i = 0; i < 250; i++) await C.submit(orders(1 + (i % 3)));
      advance(26 * MS_PER_GAME_HOUR);
      C.advance(1e9);
      for (let i = 0; i < 60; i++) await C.submit(orders(1 + (i % 3)));
      const body = (await db.doc("players/p1").get()).data() as { acts: { s: number }[]; archived: number };
      expect(body.archived).toBe(1);
      expect(body.acts[0]!.s).toBe(200);
      expect(body.acts.at(-1)!.s).toBe(313);
      C.close();
      advance(LEASE_GONE);
      // W hears again: the document's latest state, without s0–s199. It reads the chunk.
      db.hold = false;
      db.flush();
      await settle();
      await settle();
      expect(held(W, "p1")).toBe(314);
      // A wakes: its renewal re-reads the document and the chunk before it writes, then appends after s313.
      await A.renewLease();
      expect(held(A, "p1")).toBe(314);
      await A.submit(orders(0));
      expect((await stored(db, "p1")).at(-1)).toBe("314:set_standing_orders:0");
      await settle();
      await A.rebuild();
      await W.rebuild();
      const fresh = await LiveWorld.open(db, meta, null, { now });
      await fresh.rebuild();
      expect(held(A, "p1")).toBe(315);
      expect(held(W, "p1")).toBe(315);
      expect(held(fresh, "p1")).toBe(315);
      expect(summary(A.w)).toBe(summary(fresh.w));
      expect(summary(W.w)).toBe(summary(fresh.w));
      A.close();
      W.close();
      fresh.close();
    }, 120_000);

    it("a renewal that throws leaves the tab watching; the next that succeeds re-reads before it writes (§1)", async () => {
      const { db, A } = await twoDevices();
      let failing = true;
      const doc = db.doc.bind(db);
      db.doc = (path: string) => {
        const d = doc(path);
        if (failing && path.endsWith("/x/tab")) d.acquire = async () => Promise.reject(new Error("network"));
        return d;
      };
      await A.renewLease();
      expect(A.writer).toBe(false);
      await expect(A.submit(orders(0))).rejects.toThrow(/only watching/);
      expect(await stored(db, "p1")).toEqual(["0:join:", "1:set_standing_orders:1", "2:set_standing_orders:2", "3:set_standing_orders:3"]);
      failing = false;
      await A.renewLease();
      expect(A.writer).toBe(true);
      await A.submit(orders(0));
      expect(await stored(db, "p1")).toEqual(["0:join:", "1:set_standing_orders:1", "2:set_standing_orders:2", "3:set_standing_orders:3", "4:set_standing_orders:0"]);
      A.close();
    });

    it("the owner's page lists another player's order that arrived stamped in the past; nobody else's page does (§2, the marker)", async () => {
      let clock = 6 * MS_PER_GAME_HOUR;
      const now = () => clock;
      const db = new MemoryDb(now);
      const join = (name: string, hub: string) => ({ type: "join", name, hub });
      // In the store before the owner's page opened: history, never marked.
      await db.doc("players/old").set({ v: 1, acts: [{ s: 0, at: 60, a: join("Old Co", starters[2]!) }], archived: 0 });
      const owner = await LiveWorld.open(db, meta, "owner", { now, holder: "O", manualRenewal: true, owner: true });
      const player = await LiveWorld.open(db, meta, "p5", { now, holder: "P", manualRenewal: true });
      await owner.rebuild();
      await player.rebuild();
      // An honest order, stamped on the shared clock plus the lead.
      await player.submit({ type: "join", name: "Honest Co", hub: starters[0]! });
      await settle();
      expect(owner.earlyStamps).toEqual([]);
      // An order written to the store stamped an hour of game time in the past (a forged stamp, or a page far behind).
      const past = Math.ceil(clock / MIN) - 60;
      await db.doc("players/forger").set({ v: 1, acts: [{ s: 0, at: past, a: join("Back Dated Co", starters[1]!) }], archived: 0 });
      await settle();
      expect(owner.earlyStamps).toEqual([{ uid: "forger", s: 0, at: past, minutesEarly: 60, seenAt: Math.floor(clock / MIN) }]);
      expect(player.earlyStamps).toEqual([]);
      // An owner's page out of touch (no renewal within the lease's life) marks nothing: a backlog is its own lateness.
      clock += LEASE_GONE;
      await db.doc("players/late").set({ v: 1, acts: [{ s: 0, at: past, a: join("Late Co", starters[3]!) }], archived: 0 });
      await settle();
      expect(owner.earlyStamps).toHaveLength(1);
      owner.close();
      player.close();
    });
  });
});
