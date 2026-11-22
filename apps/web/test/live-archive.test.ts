import "./seed.js";
import { describe, expect, it } from "vitest";
import { hubs } from "@lanes/data";
import type { Action } from "@lanes/engine";
import { PLAYER_DISPATCHER_ORDERS, RULESET } from "../src/game.js";
import { archiveCount, LiveWorld, MAX_ARCHIVE_CHUNKS, MS_PER_GAME_HOUR, type DbLike, type SnapLike, type WorldMeta } from "../src/live.js";
import { MemoryDb } from "../src/memdb.js";

/**
 * A player's log chunks (live.ts archiveCount, readArchive): the count a player's document gives is read only as a whole
 * number up to MAX_ARCHIVE_CHUNKS, the chunks are read one at a time per player, and a read ends at the count or at the
 * first chunk that isn't there. A page opening and a page already open hold the same chunks.
 */
const MIN = MS_PER_GAME_HOUR / 60;
const starters = hubs.filter((h) => h.isStarter).map((h) => h.id);
const meta: WorldMeta = { v: 1, seed: 4242, epochMs: 0, msPerGameHour: MS_PER_GAME_HOUR, ruleset: RULESET };
const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
};
const orders = (n: number): Action => ({ type: "set_standing_orders", orders: n === 0 ? [] : PLAYER_DISPATCHER_ORDERS.slice(0, n) });
const join = (name: string) => ({ type: "join", name, hub: starters[0]!, look: "m" });
/** Every order this page holds for a player (its document's and its chunks'). */
const held = (lw: LiveWorld, uid: string) => [...((lw as unknown as { logs: Map<string, Map<number, unknown>> }).logs.get(uid)?.keys() ?? [])].sort((a, b) => a - b);

/** A store that counts the reads of log chunks, and can hold them. */
function counting(db: MemoryDb) {
  const gets: string[] = [];
  let pending = 0;
  let most = 0;
  let gate: (() => void)[] | null = null;
  const spy: DbLike = {
    collection: (p) => db.collection(p),
    doc: (p) => {
      const d = db.doc(p);
      if (!/\/log\//.test(p)) return d;
      return {
        ...d,
        get: async (): Promise<SnapLike> => {
          gets.push(p.slice(p.lastIndexOf("/") + 1));
          most = Math.max(most, ++pending);
          if (gate) await new Promise<void>((res) => gate!.push(res));
          pending--;
          return d.get();
        },
      };
    },
  };
  return {
    spy,
    gets,
    most: () => most,
    pending: () => pending,
    hold: () => void (gate = []),
    release: () => {
      const g = gate ?? [];
      gate = null;
      for (const f of g) f();
    },
    /** Lets the read that is waiting through, and holds the next. */
    step: () => {
      const g = gate ?? [];
      gate = [];
      for (const f of g) f();
    },
  };
}

async function stage() {
  let clock = 6 * MS_PER_GAME_HOUR;
  const now = () => clock;
  const db = new MemoryDb(now);
  const c = counting(db);
  const page = await LiveWorld.open(c.spy, meta, "watcher", { now, holder: "W", manualRenewal: true });
  await page.rebuild();
  return { db, now, c, page, advance: (ms: number) => void (clock += ms) };
}

describe("a player's log chunks: the count and the read", () => {
  it("archiveCount: a whole number from 0 to the most chunks a log holds; anything else is the count already seen", () => {
    expect(MAX_ARCHIVE_CHUNKS).toBe(1000);
    for (const ok of [0, 1, 7, MAX_ARCHIVE_CHUNKS]) expect(archiveCount(ok, 3)).toBe(ok);
    for (const not of [MAX_ARCHIVE_CHUNKS + 1, 1e12, Number.MAX_SAFE_INTEGER, Infinity, -1, -1e12, 2.5, 0.1, NaN, "7", "", null, undefined, true, [3], { n: 3 }]) expect(archiveCount(not, 3), String(not)).toBe(3);
    expect(archiveCount("7", 0)).toBe(0);
  });

  it("a count that isn't one asks for no chunk, on a page already open and on a page opening", async () => {
    const { db, now, c, page } = await stage();
    const acts = [{ s: 0, at: 60, a: join("Far Count Co") }];
    for (const [i, archived] of [1e12, MAX_ARCHIVE_CHUNKS + 1, -3, 2.5, "7", null, [4], 1e308].entries()) {
      await db.doc(`players/p${i}`).set({ v: 1, acts, archived });
      await db.doc(`players/p${i}/log/c00000`).set({ acts: [{ s: 50, at: 30, a: orders(1) }] });
    }
    await settle();
    expect(c.gets).toEqual([]);
    // The document's own orders are heard as always.
    for (let i = 0; i < 8; i++) expect(held(page, `p${i}`)).toEqual([0]);
    await page.rebuild();
    // A page opening reads the same: none of those chunks.
    const late = counting(db);
    const fresh = await LiveWorld.open(late.spy, meta, "late", { now, holder: "L", manualRenewal: true });
    await fresh.rebuild();
    for (let i = 0; i < 8; i++) expect(held(fresh, `p${i}`)).toEqual([0]);
    expect(late.gets).toEqual([]);
    page.close();
    fresh.close();
  }, 60_000);

  it("a read ends at the first chunk that isn't there, and the same count isn't asked twice", async () => {
    const { db, c, page } = await stage();
    const acts = [{ s: 400, at: 60, a: join("Empty Log Co") }];
    await db.doc("players/p1").set({ v: 1, acts, archived: 900 });
    await settle();
    expect(c.gets).toEqual(["c00000"]);
    // The same document again (another order in it): nothing more is read.
    await db.doc("players/p1").set({ v: 1, acts: [...acts, { s: 401, at: 70, a: orders(1) }], archived: 900 });
    await db.doc("players/p2").set({ v: 1, acts: [{ s: 0, at: 80, a: join("Other Co") }], archived: 0 });
    await settle();
    expect(c.gets).toEqual(["c00000"]);
    // A higher count asks once more, from the same chunk.
    await db.doc("players/p1").set({ v: 1, acts, archived: 901 });
    await settle();
    expect(c.gets).toEqual(["c00000", "c00000"]);
    expect(c.most()).toBe(1);
    page.close();
  }, 60_000);

  it("one read at a time per player: a document that comes while a read runs starts no second one, and a higher count carries the read on", async () => {
    const { db, c, page } = await stage();
    for (let n = 0; n < 4; n++) await db.doc(`players/p1/log/c0000${n}`).set({ acts: [{ s: n, at: 20 + n, a: n === 0 ? join("Long Log Co") : orders(1 + (n % 3)) }] });
    const acts = [{ s: 4, at: 60, a: orders(2) }];
    c.hold();
    await db.doc("players/p1").set({ v: 1, acts, archived: 3 });
    await settle();
    expect(c.gets).toEqual(["c00000"]);
    expect(c.pending()).toBe(1);
    // More documents while that read waits: the same count, then a higher one, then another player's.
    await db.doc("players/p1").set({ v: 1, acts: [...acts, { s: 5, at: 70, a: orders(1) }], archived: 3 });
    await db.doc("players/p1").set({ v: 1, acts: [...acts, { s: 5, at: 70, a: orders(1) }], archived: 4 });
    await db.doc("players/p2").set({ v: 1, acts: [{ s: 0, at: 80, a: join("Other Co") }], archived: 0 });
    await settle();
    expect(c.gets).toEqual(["c00000"]);
    expect(c.pending()).toBe(1);
    // Let through one at a time: each chunk once, in order, up to the higher count.
    for (const want of [["c00000", "c00001"], ["c00000", "c00001", "c00002"], ["c00000", "c00001", "c00002", "c00003"]]) {
      c.step();
      await settle();
      expect(c.gets).toEqual(want);
      expect(c.pending()).toBe(1);
    }
    c.release();
    await settle();
    expect(c.gets).toEqual(["c00000", "c00001", "c00002", "c00003"]);
    expect(c.most()).toBe(1);
    expect(held(page, "p1")).toEqual([0, 1, 2, 3, 4, 5]);
    // Two players' reads run side by side: one each.
    for (const uid of ["p3", "p4"]) await db.doc(`players/${uid}/log/c00000`).set({ acts: [{ s: 0, at: 30, a: join(`${uid} Co`) }] });
    c.hold();
    await db.doc("players/p3").set({ v: 1, acts: [{ s: 1, at: 90, a: orders(1) }], archived: 1 });
    await db.doc("players/p4").set({ v: 1, acts: [{ s: 1, at: 90, a: orders(1) }], archived: 1 });
    await settle();
    expect(c.pending()).toBe(2);
    c.release();
    await settle();
    expect(held(page, "p3")).toEqual([0, 1]);
    expect(held(page, "p4")).toEqual([0, 1]);
    page.close();
  }, 60_000);

  it("a read that fails is asked again by the next document that gives the count", async () => {
    const { db, c, page } = await stage();
    await db.doc("players/p1/log/c00000").set({ acts: [{ s: 0, at: 30, a: join("Retry Co") }] });
    let failing = true;
    const doc = c.spy.doc.bind(c.spy);
    c.spy.doc = (p) => {
      const d = doc(p);
      return failing && /\/log\//.test(p) ? { ...d, get: async () => Promise.reject(new Error("network")) } : d;
    };
    const errors: unknown[] = [];
    const logged = console.error;
    console.error = (e) => void errors.push(e);
    try {
      await db.doc("players/p1").set({ v: 1, acts: [{ s: 1, at: 90, a: orders(1) }], archived: 1 });
      await settle();
      expect(held(page, "p1")).toEqual([1]);
      expect(errors.length).toBe(1);
      failing = false;
      await db.doc("players/p1").set({ v: 1, acts: [{ s: 1, at: 90, a: orders(1) }, { s: 2, at: 95, a: orders(2) }], archived: 1 });
      await settle();
      expect(held(page, "p1")).toEqual([0, 1, 2]);
    } finally {
      console.error = logged;
    }
    page.close();
  }, 60_000);

  it("a page opening and a page already open hold the same chunks: the ones the count covers, in a row from the first", async () => {
    const { db, now, c, page } = await stage();
    // Chunks 0 and 2 are there, 1 isn't; a chunk past the count and documents of other names are in the log too.
    const one = (s: number, at: number) => ({ acts: [{ s, at, a: s === 0 ? join("Gap Co") : orders(1 + (s % 3)) }] });
    await db.doc("players/p1/log/c00000").set(one(0, 20));
    await db.doc("players/p1/log/c00002").set(one(2, 22));
    await db.doc("players/p1/log/c00003").set(one(3, 23));
    await db.doc("players/p1/log/extra").set(one(8, 28));
    await db.doc("players/p1/log/c0").set(one(9, 29));
    await db.doc("players/p1").set({ v: 1, acts: [{ s: 10, at: 60, a: orders(2) }], archived: 3 });
    await settle();
    expect(c.gets).toEqual(["c00000", "c00001"]);
    expect(held(page, "p1")).toEqual([0, 10]);
    const fresh = await LiveWorld.open(db, meta, "late", { now, holder: "L", manualRenewal: true });
    await fresh.rebuild();
    expect(held(fresh, "p1")).toEqual([0, 10]);
    // The missing chunk written and the count raised: both read on from it.
    await db.doc("players/p1/log/c00001").set(one(1, 21));
    await db.doc("players/p1").set({ v: 1, acts: [{ s: 10, at: 60, a: orders(2) }], archived: 4 });
    await settle();
    expect(c.gets).toEqual(["c00000", "c00001", "c00001", "c00002", "c00003"]);
    expect(held(page, "p1")).toEqual([0, 1, 2, 3, 10]);
    expect(held(fresh, "p1")).toEqual([0, 1, 2, 3, 10]);
    const third = await LiveWorld.open(db, meta, "later", { now, holder: "M", manualRenewal: true });
    expect(held(third, "p1")).toEqual([0, 1, 2, 3, 10]);
    for (const p of [page, fresh, third]) p.close();
  }, 60_000);

  it("a tab's own document with a count that isn't one: the tab keeps the count it had, and its next order stores it", async () => {
    let clock = 6 * MS_PER_GAME_HOUR;
    const now = () => clock;
    const db = new MemoryDb(now);
    const A = await LiveWorld.open(db, meta, "p1", { now, holder: "A", manualRenewal: true });
    await A.rebuild();
    await A.submit({ type: "join", name: "Own Count Co", hub: starters[0]! });
    clock += 5 * MIN;
    A.advance(1e9);
    const body = (await db.doc("players/p1").get()).data()!;
    for (const archived of [1e12, "x", -1, 0.5]) {
      await db.doc("players/p1").set({ ...body, archived });
      clock += 5 * 60_000; // past the lease's life: the renewal reads the document again
      await A.renewLease();
      expect(A.writer).toBe(true);
    }
    await A.submit(orders(1));
    const after = (await db.doc("players/p1").get()).data() as { acts: { s: number }[]; archived: unknown };
    expect(after.archived).toBe(0);
    expect(after.acts.map((r) => r.s)).toEqual([0, 1]);
    A.close();
  }, 60_000);

  it("at the most chunks a log holds the tab moves no more orders out of its document; one below, it writes the last chunk", async () => {
    for (const [start, wrote] of [[MAX_ARCHIVE_CHUNKS - 1, true], [MAX_ARCHIVE_CHUNKS, false]] as const) {
      let clock = 6 * MS_PER_GAME_HOUR;
      const now = () => clock;
      const db = new MemoryDb(now);
      // A long-standing player: 300 orders in the document, all over a game day old by the time the tab writes.
      const acts = [{ s: 5000, at: 60, a: join("Old Hand Co") }, ...Array.from({ length: 299 }, (_, i) => ({ s: 5001 + i, at: 61 + i, a: orders(1 + (i % 3)) }))];
      await db.doc("players/p1").set({ v: 1, acts, archived: start });
      clock += 30 * MS_PER_GAME_HOUR;
      const A = await LiveWorld.open(db, meta, "p1", { now, holder: "A", manualRenewal: true });
      await A.rebuild();
      await A.submit(orders(0));
      const after = (await db.doc("players/p1").get()).data() as { acts: { s: number }[]; archived: number };
      const last = (await db.doc(`players/p1/log/c${String(start).padStart(5, "0")}`).get()).exists;
      expect(last, String(start)).toBe(wrote);
      expect(after.archived).toBe(MAX_ARCHIVE_CHUNKS);
      expect(after.acts.length).toBe(wrote ? 101 : 301);
      expect(after.acts.at(-1)!.s).toBe(5300);
      A.close();
    }
  }, 120_000);
});
