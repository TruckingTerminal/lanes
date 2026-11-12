import "./seed.js";
import { describe, expect, it } from "vitest";
import { hubs } from "@lanes/data";
import { hubMiles, type Action, type World } from "@lanes/engine";
import { GAME_CONFIG, PLAYER_DISPATCHER_ORDERS, RULESET } from "../src/game.js";
import { LEAD_MIN, LiveWorld, MS_PER_GAME_HOUR, type LiveAction, type SnapLike, type WorldMeta } from "../src/live.js";
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
      await A.submit(orders(3));
      const watcher = await LiveWorld.open(db, meta, "p3", { now, holder: "W", manualRenewal: true });
      await watcher.rebuild();
      expect(watcher.needRebuild).toBe(false);
      // An older device's whole-list write, as before the fix: it never saw the last two orders, and its own lands on the
      // first of their numbers (the re-check §5: an erasure always comes with a rewritten entry).
      const body = (await db.doc("players/p1").get()).data() as { acts: { s: number; at: number }[]; archived: number };
      await db.doc("players/p1").set({ v: 1, acts: [...body.acts.slice(0, 2), { s: 2, at: body.acts[2]!.at, a: orders(0) }], archived: 0 });
      await settle();
      expect(watcher.needRebuild).toBe(true);
      expect(held(watcher, "p1")).toBe(3);
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
      const owner = await LiveWorld.open(db, meta, "owner", { now, mono: now, holder: "O", manualRenewal: true, owner: true });
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
      expect(owner.earlyStamps).toEqual([{ kind: "early", uid: "forger", s: 0, at: past, minutesEarly: 60, seenAt: Math.floor(clock / MIN) }]);
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

  describe("the red team's re-check (redteam-persistence-recheck-2026-11-12.md §1, §2, §5, §8)", () => {
    const meta: WorldMeta = { v: 1, seed: 4242, epochMs: 0, msPerGameHour: MS_PER_GAME_HOUR, ruleset: RULESET };
    const LEASE_GONE = 5 * 60_000;
    const orders = (n: number): Action => ({ type: "set_standing_orders", orders: n === 0 ? [] : PLAYER_DISPATCHER_ORDERS.slice(0, n) });
    const held = (lw: LiveWorld, uid: string) => (lw as unknown as { logs: Map<string, Map<number, unknown>> }).logs.get(uid)?.size ?? 0;
    const join = (name: string, hub: string): LiveAction => ({ type: "join", name, hub });

    it("a brokerage's order, stored and read again, acts for the brokerage on every page (§1)", async () => {
      // The ladder's brokerage layer open, and a bond the new carrier's cash covers: the config varied for this test only.
      const cfg = GAME_CONFIG as unknown as { unlockLadder: { enabled: boolean }; token: { staking: { roles: { broker: number } } } };
      const was = { ladder: cfg.unlockLadder.enabled, bond: cfg.token.staking.roles.broker };
      cfg.unlockLadder.enabled = false;
      cfg.token.staking.roles.broker = 1_000;
      try {
        let clock = 6 * MS_PER_GAME_HOUR;
        const now = () => clock;
        const db = new MemoryDb(now);
        const A = await LiveWorld.open(db, meta, "p1", { now, holder: "A", manualRenewal: true });
        const W = await LiveWorld.open(db, meta, "p3", { now, holder: "W", manualRenewal: true });
        await A.rebuild();
        await W.rebuild();
        await A.submit(join("One Truck Co", starters[0]!));
        clock += 5 * MIN;
        A.advance(1e9);
        await A.submit({ type: "form_brokerage", name: "Red River Logistics", capitalFd: 2_500 } as Action, "carrier");
        clock += 5 * MIN;
        A.advance(1e9);
        expect(A.brokerage?.name).toBe("Red River Logistics");
        const terms = [{ kind: "broker", marginPct: 0.1, maxOpenLoads: 40 }];
        await A.submit({ type: "set_standing_orders", orders: terms } as Action, "brokerage");
        const body = (await db.doc("players/p1").get()).data() as { acts: { as?: string }[] };
        expect(body.acts.at(-1)!.as).toBe("brokerage");
        clock += 5 * MIN;
        await settle();
        A.close();
        // The page that sent it, a page that heard it, the sender's own reopened, and one opened afterwards by nobody.
        const A2 = await LiveWorld.open(db, meta, "p1", { now, holder: "A", manualRenewal: true });
        const fresh = await LiveWorld.open(db, meta, null, { now });
        for (const lw of [A, W, A2, fresh]) {
          await lw.rebuild();
          const cos = lw.w.companies;
          expect(cos.find((c) => c.name === "Red River Logistics")!.orders).toEqual(terms);
          expect(cos.find((c) => c.name === "One Truck Co")!.orders).not.toEqual(terms);
        }
        expect(summary(A.w)).toBe(summary(fresh.w));
        expect(summary(W.w)).toBe(summary(fresh.w));
        expect(summary(A2.w)).toBe(summary(fresh.w));
        for (const lw of [W, A2, fresh]) lw.close();
      } finally {
        cfg.unlockLadder.enabled = was.ladder;
        cfg.token.staking.roles.broker = was.bond;
      }
    });

    it("a device clock set back after the page opened stamps on the store's clock: no order lands in a round already cleared (§2)", async () => {
      let server = 6 * MS_PER_GAME_HOUR;
      let skew = 0;
      const db = new MemoryDb(() => server);
      const A = await LiveWorld.open(db, meta, "p1", { now: () => server + skew, mono: () => server, holder: "A", manualRenewal: true });
      await A.rebuild();
      await A.submit(join("One Truck Co", starters[0]!));
      server += 5 * MIN;
      A.advance(1e9);
      // Set back an hour, and an order before any renewal: the jump between the two clocks reads as a lost lease.
      skew = -60 * 60_000;
      expect((await A.submit(orders(1))).at).toBe(Math.ceil(server / MIN) + LEAD_MIN);
      // Set back again, and the renewal comes first: it reads the store's clock again.
      server += MIN;
      skew = -2 * 60 * 60_000;
      await A.renewLease();
      expect((await A.submit(orders(2))).at).toBe(Math.ceil(server / MIN) + LEAD_MIN);
      A.close();
    });

    it("a device clock set forward after the page opened doesn't lock the player's other device out (§2)", async () => {
      let server = 6 * MS_PER_GAME_HOUR;
      let skew = 0;
      const db = new MemoryDb(() => server);
      const A = await LiveWorld.open(db, meta, "p1", { now: () => server + skew, mono: () => server, holder: "A", manualRenewal: true });
      await A.rebuild();
      await A.submit(join("One Truck Co", starters[0]!));
      server += 5 * MIN;
      A.advance(1e9);
      // Twelve minutes ahead (48 game minutes), then the renewal's timer fires: before the fix the renewal kept the old
      // offset, the order went out 48 game minutes ahead, and every later order on the other device was refused till then.
      skew = 12 * 60_000;
      await A.renewLease();
      expect((await A.submit(orders(1))).at).toBe(Math.ceil(server / MIN) + LEAD_MIN);
      A.close();
      server += LEASE_GONE;
      const B = await LiveWorld.open(db, meta, "p1", { now: () => server, mono: () => server, holder: "B", manualRenewal: true });
      await B.rebuild();
      expect((await B.submit(orders(2))).at).toBe(Math.ceil(server / MIN) + LEAD_MIN);
      B.close();
    });

    it("a returning page whose subscription hands it older copies first drops nothing and needs no second replay (§5)", async () => {
      let clock = 6 * MS_PER_GAME_HOUR;
      const now = () => clock;
      const db = new MemoryDb(now);
      const A = await LiveWorld.open(db, meta, "p1", { now, holder: "A", manualRenewal: true });
      await A.rebuild();
      await A.submit(join("One Truck Co", starters[0]!));
      clock += 5 * MIN;
      A.advance(1e9);
      for (const n of [1, 2, 3]) await A.submit(orders(n));
      const acts = ((await db.doc("players/p1").get()).data() as { acts: { s: number; at: number }[] }).acts;
      const copy = (list: unknown[]) => [{ id: "p1", exists: true, data: () => ({ v: 1, acts: JSON.parse(JSON.stringify(list)) as unknown[], archived: 0 }) }];
      // The store's saved copy from the last visit, marked so (it even holds a rewrite), then one older and unmarked.
      const marked = copy([acts[0], { s: 1, at: acts[1]!.at, a: orders(0) }]);
      const older = copy(acts.slice(0, 2));
      const coll = db.collection.bind(db);
      db.collection = (path: string) => {
        const c = coll(path);
        return {
          get: () => c.get(),
          onSnapshot: (next, err) => {
            if (path === "players") {
              queueMicrotask(() => next({ docs: marked, metadata: { fromCache: true } }));
              queueMicrotask(() => next({ docs: older }));
            }
            return c.onSnapshot(next, err);
          },
        };
      };
      const W = await LiveWorld.open(db, meta, "p3", { now, holder: "W", manualRenewal: true });
      await settle();
      await settle();
      expect(held(W, "p1")).toBe(4);
      expect(W.needRebuild).toBe(false);
      A.close();
      W.close();
    });

    it("the owner's page lists a rewritten record, an erased one, and a young one slipped into an archive chunk (§8)", async () => {
      let clock = 6 * MS_PER_GAME_HOUR;
      const now = () => clock;
      const db = new MemoryDb(now);
      const m = Math.ceil(clock / MIN);
      const first = [{ s: 0, at: 60, a: join("Forge Co", starters[1]!) }, { s: 1, at: 70, a: orders(1) }, { s: 2, at: 80, a: orders(2) }];
      await db.doc("players/f").set({ v: 1, acts: first, archived: 0 }); // history before the owner's page opened
      const owner = await LiveWorld.open(db, meta, "owner", { now, mono: now, holder: "O", manualRenewal: true, owner: true });
      const player = await LiveWorld.open(db, meta, "p5", { now, holder: "P", manualRenewal: true });
      await owner.rebuild();
      await player.rebuild();
      // From the console: s1 rewritten (an undo), and s2 gone with it.
      await db.doc("players/f").set({ v: 1, acts: [first[0], { s: 1, at: 70, a: orders(0) }], archived: 0 });
      await settle();
      // Then an "archive" that slips in a record stamped ten game minutes ago.
      await db.doc("players/f/log/c00000").set({ acts: [first[0], { s: 9, at: m - 10, a: orders(2) }] });
      await db.doc("players/f").set({ v: 1, acts: [{ s: 10, at: m + LEAD_MIN, a: orders(1) }], archived: 1 });
      for (let i = 0; i < 4; i++) await settle();
      expect(owner.earlyStamps.map((e) => [e.kind, e.uid, e.s])).toEqual([
        ["drop", "f", 2],
        ["rewrite", "f", 1],
        ["chunk", "f", 9],
      ]);
      expect(player.earlyStamps).toEqual([]);
      owner.close();
      player.close();
    });
  });

  describe("the red team's second re-check (redteam-persistence-recheck2-2026-11-12.md §1–§4)", () => {
    const meta: WorldMeta = { v: 1, seed: 4242, epochMs: 0, msPerGameHour: MS_PER_GAME_HOUR, ruleset: RULESET };
    const LEASE_GONE = 5 * 60_000;
    const orders = (n: number): Action => ({ type: "set_standing_orders", orders: n === 0 ? [] : PLAYER_DISPATCHER_ORDERS.slice(0, n) });
    const held = (lw: LiveWorld, uid: string) => (lw as unknown as { logs: Map<string, Map<number, unknown>> }).logs.get(uid)?.size ?? 0;
    const join = (name: string, hub: string): LiveAction => ({ type: "join", name, hub });
    /** Every object's keys in reverse order, at every depth: a store that keeps keys its own way. */
    const reorder = (x: unknown): unknown =>
      Array.isArray(x) ? x.map(reorder) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).reverse().map(([k, v]) => [k, reorder(v)])) : x;
    const reordered = (s: SnapLike): SnapLike => ({ id: s.id, exists: s.exists, data: () => reorder(s.data()) as Record<string, unknown> | undefined });

    it("a store that hands keys back in its own order costs the sender's page no replay (§1)", async () => {
      let clock = 6 * MS_PER_GAME_HOUR;
      const now = () => clock;
      const db = new MemoryDb(now);
      const doc = db.doc.bind(db);
      db.doc = (path: string) => {
        const d = doc(path);
        const get = d.get.bind(d);
        d.get = async () => reordered(await get());
        return d;
      };
      const coll = db.collection.bind(db);
      db.collection = (path: string) => {
        const c = coll(path);
        return { get: async () => ({ docs: (await c.get()).docs.map(reordered) }), onSnapshot: (next, err) => c.onSnapshot((x) => next({ ...x, docs: x.docs.map(reordered) }), err) };
      };
      const A = await LiveWorld.open(db, meta, "p1", { now, mono: now, holder: "A", manualRenewal: true });
      const W = await LiveWorld.open(db, meta, "p3", { now, mono: now, holder: "W", manualRenewal: true });
      await A.rebuild();
      await W.rebuild();
      await A.submit(join("One Truck Co", starters[0]!));
      clock += 5 * MIN;
      A.advance(1e9);
      for (const n of [1, 2, 3, 0, 2]) {
        await A.submit(orders(n));
        expect(A.needRebuild).toBe(false); // before the fix, every order after the first read as a rewrite: a full replay
      }
      await settle();
      expect(W.needRebuild).toBe(false);
      const fresh = await LiveWorld.open(db, meta, null, { now });
      for (const lw of [A, W, fresh]) await lw.rebuild();
      expect(summary(A.w)).toBe(summary(fresh.w));
      expect(summary(W.w)).toBe(summary(fresh.w));
      A.close();
      W.close();
      fresh.close();
    });

    it("a players collection the store only ever hands over as fromCache still brings other players' new orders, and never drops one (§4)", async () => {
      let clock = 6 * MS_PER_GAME_HOUR;
      const now = () => clock;
      const db = new MemoryDb(now);
      const P = await LiveWorld.open(db, meta, "p1", { now, holder: "P", manualRenewal: true });
      await P.rebuild();
      await P.submit(join("One Truck Co", starters[0]!));
      clock += 5 * MIN;
      P.advance(1e9);
      // Too large to read whole: every snapshot this page gets is marked fromCache, and no definitive one follows.
      const coll = db.collection.bind(db);
      db.collection = (path: string) => {
        const c = coll(path);
        return { get: () => c.get(), onSnapshot: (next, err) => c.onSnapshot((x) => next({ ...x, metadata: { fromCache: true } }), err) };
      };
      const W = await LiveWorld.open(db, meta, "p3", { now, holder: "W", manualRenewal: true });
      await W.rebuild();
      expect(held(W, "p1")).toBe(1);
      await P.submit(orders(1));
      await P.submit(orders(2));
      await settle();
      expect(held(W, "p1")).toBe(3); // the new orders arrive
      // A cached copy that lacks the newest order and rewrites one drops nothing and rewrites nothing.
      const body = (await db.doc("players/p1").get()).data() as { acts: { s: number; at: number }[] };
      await db.doc("players/p1").set({ v: 1, acts: [body.acts[0], { s: 1, at: body.acts[1]!.at, a: orders(0) }], archived: 0 });
      await settle();
      expect(held(W, "p1")).toBe(3);
      expect(W.needRebuild).toBe(false);
      P.close();
      W.close();
    });

    it("a record removed from the middle of a player's list is dropped and marked on every running page (§2)", async () => {
      let clock = 6 * MS_PER_GAME_HOUR;
      const now = () => clock;
      const db = new MemoryDb(now);
      const owner = await LiveWorld.open(db, meta, "owner", { now, mono: now, holder: "O", manualRenewal: true, owner: true });
      const P = await LiveWorld.open(db, meta, "p1", { now, mono: now, holder: "P", manualRenewal: true });
      await owner.rebuild();
      await P.rebuild();
      await P.submit(join("One Truck Co", starters[0]!));
      clock += 5 * MIN;
      P.advance(1e9);
      for (const n of [1, 2, 3]) await P.submit(orders(n));
      await settle();
      expect(held(owner, "p1")).toBe(4);
      // From the console: s2 taken out of the middle, nothing rewritten.
      const body = (await db.doc("players/p1").get()).data() as { acts: { s: number }[] };
      await db.doc("players/p1").set({ v: 1, acts: body.acts.filter((r) => r.s !== 2), archived: 0 });
      await settle();
      expect(held(owner, "p1")).toBe(3);
      expect(owner.needRebuild).toBe(true);
      expect(owner.earlyStamps.map((e) => [e.kind, e.uid, e.s])).toEqual([["drop", "p1", 2]]);
      const fresh = await LiveWorld.open(db, meta, null, { now });
      await owner.rebuild();
      await fresh.rebuild();
      expect(summary(owner.w)).toBe(summary(fresh.w));
      owner.close();
      P.close();
      fresh.close();
    });

    it("a clock moved during a lease call stamps nothing; the next order retakes on a still clock (§3)", async () => {
      let server = 6 * MS_PER_GAME_HOUR;
      let skew = 0;
      let moveInFlight = 0;
      const db = new MemoryDb(() => server);
      const doc = db.doc.bind(db);
      db.doc = (path: string) => {
        const d = doc(path);
        if (path.endsWith("/x/tab")) {
          const acquire = d.acquire.bind(d);
          d.acquire = async (o) => {
            const r = await acquire(o);
            skew += moveInFlight; // the device clock moves while the reply is on its way
            moveInFlight = 0;
            return r;
          };
        }
        return d;
      };
      const A = await LiveWorld.open(db, meta, "p1", { now: () => server + skew, mono: () => server, holder: "A", manualRenewal: true });
      await A.rebuild();
      await A.submit(join("One Truck Co", starters[0]!));
      server += 5 * MIN;
      A.advance(1e9);
      moveInFlight = -6.25 * 60_000;
      await A.renewLease();
      // Before the fix the renewal's stamp was taken across the move: the order went out 10 game minutes in the past.
      expect((await A.submit(orders(1))).at).toBe(Math.ceil(server / MIN) + LEAD_MIN);
      A.close();
    });

    it("a lease reply held on its way stamps at the clock's upper bound, never in the past (§3)", async () => {
      let server = 6 * MS_PER_GAME_HOUR;
      let hold = 0;
      const db = new MemoryDb(() => server);
      const doc = db.doc.bind(db);
      db.doc = (path: string) => {
        const d = doc(path);
        if (path.endsWith("/x/tab")) {
          const acquire = d.acquire.bind(d);
          d.acquire = async (o) => {
            const r = await acquire(o);
            server += hold; // a proxy holds the reply
            return r;
          };
        }
        return d;
      };
      const A = await LiveWorld.open(db, meta, "p1", { now: () => server, mono: () => server, holder: "A", manualRenewal: true });
      await A.rebuild();
      await A.submit(join("One Truck Co", starters[0]!));
      server += 5 * MIN;
      A.advance(1e9);
      hold = 110_000;
      await A.renewLease();
      const at = (await A.submit(orders(1))).at;
      // The store's minute now, plus the lead, at the least (before the fix: 1.33 game minutes in the past).
      expect(at).toBeGreaterThanOrEqual(Math.ceil(server / MIN) + LEAD_MIN);
      expect(at).toBeLessThanOrEqual(Math.ceil(server / MIN) + LEAD_MIN + 1);
      A.close();
    });

    it("a lease request a stall held 110 s, then let through, leaves the next orders accepted (the third re-check, finding 1)", async () => {
      let server = 6 * MS_PER_GAME_HOUR;
      let hold = 0;
      const db = new MemoryDb(() => server);
      const doc = db.doc.bind(db);
      db.doc = (path: string) => {
        const d = doc(path);
        if (path.endsWith("/x/tab")) {
          const acquire = d.acquire.bind(d);
          d.acquire = async (o) => {
            server += hold; // the stall holds the request on its way: the store stamps the lease that much later
            return acquire(o);
          };
        }
        return d;
      };
      const A = await LiveWorld.open(db, meta, "p1", { now: () => server, mono: () => server, holder: "A", manualRenewal: true });
      await A.rebuild();
      await A.submit(join("One Truck Co", starters[0]!));
      server += 5 * MIN;
      A.advance(1e9);
      hold = 110_000;
      await A.renewLease();
      hold = 0;
      // Stamped at the clock's upper bound after the stall: well ahead of the store's minute.
      await A.submit(orders(1));
      // A renewal without a stall puts the clock's error back to nothing; the next orders follow the one stamped ahead.
      // Before the widening they were refused as off the shared clock, and a reload didn't help (the stamp is stored).
      await A.renewLease();
      for (const n of [2, 3, 0, 2]) {
        await expect(A.submit(orders(n))).resolves.toMatchObject({ a: { type: "set_standing_orders" } });
        server += 10_000;
      }
      A.close();
    });
  });
});
