import "./seed.js";
import { describe, expect, it } from "vitest";
import { ARC_PATH, memoryBodies, parseAlarm, readArc, REPLAY_BUILD } from "../src/cuts.js";
import { KEEP } from "../src/keeper.js";
import type { DbLike, SnapLike } from "../src/live.js";
import { DAY, enc, G, oneWorld, ownHash, rhOf, Stage, starters, type Page } from "./shared-stage.js";

/**
 * The checkpoint's step 3b, part C (keeper.ts, cuts.ts), with the shared checkpoint on: a cut no report differs from is
 * kept once the wait has passed, with the reports it has; the owner's page keeps a body only over the body's own records;
 * and two of the owner's pages that keep one day over different records write two archives, each in documents of its own.
 */
const join = (s: number, at: number, name: string, hub = 2) => ({ s, at, a: { type: "join", name, hub: starters[hub]!, look: "m" } });
const named = (p: Page, what: RegExp): string[] => p.lw.w.companies.filter((x) => what.test(x.name)).map((x) => x.name);

/** A store on which the writes of the documents `held` names wait to be let through. */
function holding(db: DbLike, held: (path: string) => boolean): { db: DbLike; reached: Promise<void>; release: () => void } {
  let hit!: () => void;
  let release!: () => void;
  const reached = new Promise<void>((r) => (hit = r));
  const gate = new Promise<void>((r) => (release = r));
  return {
    reached,
    release,
    db: {
      collection: (p) => db.collection(p),
      doc: (p) => {
        const d = db.doc(p);
        return !held(p)
          ? d
          : {
              ...d,
              set: async (data) => {
                hit();
                await gate;
                return d.set(data);
              },
            };
      },
    },
  };
}
/** Waits for a step of a page's round, and says the keeper's note if it never comes. */
const reach = (step: Promise<void>, p: Page): Promise<void> => Promise.race([step, new Promise<void>((_, no) => setTimeout(() => no(new Error(`not reached: ${p.keeper.note}`)), 30_000))]);

describe("the shared checkpoint (step 3b): a cut nobody reports against", () => {
  it("in a world of two players with one away, the day's cut is kept once the wait has passed, with the one report it has, and the active tab's document lets go of the orders its archive holds; a report that differs within the wait still stops the next day's", async () => {
    // The wait: the grace and one game day, inside the days a page reports and the bodies the store keeps.
    expect(KEEP.waitMin).toBe(G + DAY);
    expect(KEEP.waitMin).toBeLessThan((Math.min(KEEP.days, KEEP.bodies) - 1) * DAY);
    const st = new Stage();
    const owner = await st.open("olga", { owner: true });
    const a = await st.open("alice");
    const b = await st.open("bob");
    const world = owner.lw.worldKey();
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await b.lw.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });
    await st.run(1);
    for (let i = 0; i < 6; i++) await a.lw.submit({ type: "cancel_bid", truckId: 900_000 + i });
    await st.until(DAY + G);
    for (const p of st.pages) await ownHash(p, 1);
    // Bob is away: his page is closed and reports nothing.
    st.close(b);
    await st.round(a);
    await st.round(owner);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(await st.trust(1)).toBeNull();
    const stored = async () => (await st.doc("players/alice")) as { acts: { s: number; at: number }[]; next: number };
    await a.lw.submit({ type: "cancel_bid", truckId: 1 });
    expect((await stored()).acts.length).toBe(8);
    // An hour short of the wait, one report of two is still not enough.
    await st.until(DAY + KEEP.waitMin - 60);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(await st.trust(1)).toBeNull();
    // The wait past: kept with her report alone. (That minute the next day's cut is due too, and is written first.)
    await st.until(DAY + KEEP.waitMin);
    for (const p of st.pages) await ownHash(p, 2);
    await st.round(owner);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    const t1 = (await st.trust(1))!;
    expect([t1.by, t1.arc.n]).toEqual([["alice"], 8]);
    expect(await st.trust(2)).toBeNull();
    for (const p of st.pages) expect(p.lw.needRebuild, p.uid).toBe(false);
    // Her next order leaves in her document only the orders stamped since that cut.
    expect((await a.lw.submit({ type: "cancel_bid", truckId: 2 })).s).toBe(8);
    expect([(await stored()).acts.map((r) => r.s), (await stored()).next]).toEqual([[7, 8], 9]);
    expect((await stored()).acts.every((r) => r.at >= DAY)).toBe(true);
    const c = await st.open("carol");
    expect([c.lw.startedKind, c.lw.startedFrom]).toEqual(["shared", DAY]);
    await st.run(1);
    oneWorld(st);
    // Day 2: Bob's report, with another hash for the day over its records. The wait passes, and the cut is not kept.
    await st.db.doc("days/bob").set({ v: 1, world, build: REPLAY_BUILD, days: [{ day: 2, hash: "e".repeat(64), rh: rhOf(owner, 2), from: "seed" }] });
    await st.until(2 * DAY + KEEP.waitMin);
    for (let i = 0; i < 5; i++) {
      await ownHash(owner, 2);
      owner.keeper["nextReadAt"] = 0;
      await st.round(owner);
    }
    expect(await st.trust(2)).toBeNull();
    const alarm = parseAlarm(await st.doc("world/alarm"), world);
    expect(alarm.open.map((o) => [o.day, o.uid])).toEqual([[2, "bob"]]);
    expect(alarm.barred).toEqual([]);
    oneWorld(st);
  }, 480_000);

  it("with the wait off, such a cut is never kept", async () => {
    const st = new Stage();
    const owner = await st.open("olga", { owner: true, keep: { waitMin: Infinity } });
    const a = await st.open("alice");
    const b = await st.open("bob");
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await b.lw.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });
    await st.until(DAY + G);
    for (const p of st.pages) await ownHash(p, 1);
    st.close(b);
    await st.round(a);
    await st.round(owner);
    await st.until(DAY + KEEP.waitMin + 60);
    for (let i = 0; i < 3; i++) {
      owner.keeper["nextReadAt"] = 0;
      await st.round(owner);
    }
    expect([await st.trust(1), await st.trust(2)]).toEqual([null, null]);
  }, 240_000);
});

describe("the shared checkpoint (step 3b): the owner's page stands by a body over the body's own records", () => {
  it("a body whose pointer names another running hash than this page's own cut of the day is not kept; with its own, it is", async () => {
    const st = new Stage();
    const owner = await st.open("olga", { owner: true });
    await owner.lw.submit({ type: "join", name: "Olga Lines", hub: starters[0]! });
    await st.until(DAY + G);
    const hash = await ownHash(owner, 1);
    await st.round(owner);
    const pointer = (await st.doc("world/checkpoint")) as { bodies: { hash: string; rh: string }[] };
    expect(pointer.bodies.map((x) => [x.hash, x.rh])).toEqual([[hash, rhOf(owner, 1)]]);
    await st.db.doc("world/checkpoint").set({ ...pointer, bodies: pointer.bodies.map((x) => ({ ...x, rh: "c".repeat(64) })) });
    await st.settle();
    for (let i = 0; i < 2; i++) {
      owner.keeper["nextReadAt"] = 0;
      await st.round(owner);
    }
    expect(await st.trust(1)).toBeNull();
    expect((await st.db.collection(ARC_PATH).get()).docs).toEqual([]);
    await st.db.doc("world/checkpoint").set(pointer);
    await st.settle();
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect((await st.trust(1))!.rh).toBe(rhOf(owner, 1));
  }, 120_000);
});

describe("the shared checkpoint (step 3b): two of the owner's pages", () => {
  /**
   * Two pages of the owner's account on one store, the first holding the lease. The first is shown every player's
   * document but Zed's, so the two compute day 1 over different records. Each page's writes of the documents its rule
   * names wait to be let through.
   */
  async function twoPages(heldA: (path: string) => boolean, heldB: (path: string) => boolean) {
    const st = new Stage();
    const noZed = (docs: SnapLike[]): SnapLike[] => docs.filter((d) => d.id !== "zed");
    const partial: DbLike = {
      doc: (p) => (p === "players/zed" ? { ...st.db.doc(p), get: async () => ({ id: "zed", exists: false, data: () => undefined }) } : st.db.doc(p)),
      collection: (p) => {
        const c = st.db.collection(p);
        if (p !== "players") return c;
        return { get: async () => ({ docs: noZed((await c.get()).docs) }), onSnapshot: (next, err) => c.onSnapshot((snap) => next({ ...snap, docs: noZed(snap.docs) }), err) };
      },
    };
    const holdA = holding(partial, heldA);
    const holdB = holding(st.db, heldB);
    const A = await st.open("olga", { owner: true, db: holdA.db, keep: { confirmers: 0 } });
    const B = await st.open("olga", { owner: true, db: holdB.db, keep: { confirmers: 0 } });
    expect([A.lw.writer, B.lw.writer]).toEqual([true, false]);
    await A.lw.submit({ type: "join", name: "Olga Lines", hub: starters[0]! });
    await st.db.doc("players/zed").set({ v: 1, acts: [join(0, 500, "Zed Seen By One", 1)], archived: 0 });
    await st.until(DAY + G);
    const hashA = await ownHash(A, 1);
    const hashB = await ownHash(B, 1);
    expect(hashA).not.toBe(hashB);
    expect([named(A, /Zed/), named(B, /Zed/)]).toEqual([[], ["Zed Seen By One"]]);
    const ids = async () => (await st.db.collection(ARC_PATH).get()).docs.map((d) => d.id).sort();
    /** The lease passes to a page (the other's has run out), which then writes its own cut of the day. */
    const takeOver = async (p: Page): Promise<void> => {
      st.clock += 3 * 60_000;
      await p.lw.renewLease();
      expect(p.lw.leaseFresh()).toBe(true);
      await p.keeper.tick();
      p.keeper["nextReadAt"] = 0;
    };
    return { st, A, B, holdA, holdB, hashA, hashB, ids, takeOver };
  }
  const trustDoc = (p: string): boolean => p === "world/cpm-1";

  it("keep the same day over different records, each about to write the trust document: each archive is in documents of its own, the trust document in the store names a text the store holds, whichever page wrote it last, and every page reads it", async () => {
    const { st, A, B, holdA, holdB, hashA, hashB, ids, takeOver } = await twoPages(trustDoc, trustDoc);
    // The first page writes its cut, then its archive, and is about to write the trust document.
    await st.round(A);
    A.keeper["nextReadAt"] = 0;
    await A.lw.renewLease();
    const roundA = A.keeper.tick();
    await reach(holdA.reached, A);
    const first = await ids();
    expect(first.length).toBe(1);
    // The lease passes to the second page, which does the same over its own records.
    await takeOver(B);
    const roundB = B.keeper.tick();
    await reach(holdB.reached, B);
    const both = await ids();
    expect(both.length).toBe(2);
    expect(both).toEqual(expect.arrayContaining(first));
    // The first page's trust document lands: its archive is in the store as it wrote it.
    holdA.release();
    await roundA;
    const tA = (await st.trust(1))!;
    expect(tA.hash).toBe(hashA);
    const textA = await readArc(st.db, tA.arc);
    expect(textA?.split("\n").length).toBe(1);
    await st.settle();
    const fromSeed = await st.open("dave", { bodies: memoryBodies() });
    expect([fromSeed.lw.startedKind, fromSeed.lw.broken]).toEqual(["seed", null]);
    oneWorld(st);
    for (const p of st.pages) expect(named(p, /Olga|Zed/), p.uid).toEqual(["Olga Lines"]);
    // Then the second page's, in its place: the archive it names is in the store too, and every page computes its world.
    holdB.release();
    await roundB;
    const tB = (await st.trust(1))!;
    expect([tB.hash, tB.arc.n]).toEqual([hashB, 2]);
    expect(tB.arc.hash).not.toBe(tA.arc.hash);
    expect((await readArc(st.db, tB.arc))?.split("\n").length).toBe(2);
    expect(await readArc(st.db, tA.arc)).toBe(textA);
    expect(await ids()).toEqual(both);
    await st.settle();
    const late = await st.open("erin", { bodies: memoryBodies() });
    expect(late.lw.startedKind).toBe("seed");
    oneWorld(st);
    for (const p of st.pages) {
      expect(p.lw.broken, p.uid).toBeNull();
      expect(named(p, /Olga|Zed/).sort(), p.uid).toEqual(["Olga Lines", "Zed Seen By One"]);
    }
    expect(enc(A.lw.w)).toBe(enc(late.lw.w));
  }, 360_000);

  it("a page whose round was under way while the other wrote the day's trust document writes none over it, though it hasn't heard of it", async () => {
    const { st, A, B, holdA, hashB, ids, takeOver } = await twoPages((p) => p.startsWith(ARC_PATH), () => false);
    // The first page's round stops at the write of its archive.
    await st.round(A);
    A.keeper["nextReadAt"] = 0;
    await A.lw.renewLease();
    const roundA = A.keeper.tick();
    await reach(holdA.reached, A);
    expect(await ids()).toEqual([]);
    // The second page takes the lease and keeps the day; no page hears of its trust document yet.
    await takeOver(B);
    st.db.hold = true;
    await B.keeper.tick();
    const tB = (await st.trust(1))!;
    expect([tB.hash, tB.arc.n]).toEqual([hashB, 2]);
    expect(A.lw.sharedView().trust).toEqual([]);
    // The first page's round goes on: its archive is written, and no trust document.
    holdA.release();
    await roundA;
    expect((await ids()).length).toBe(2);
    expect(await st.trust(1)).toEqual(tB);
    expect(A.keeper.note).toMatch(/^waiting: day 1 has a trust document already/);
    st.db.hold = false;
    st.db.flush();
    await st.settle();
    const late = await st.open("erin", { bodies: memoryBodies() });
    expect(late.lw.startedKind).toBe("seed");
    oneWorld(st);
    for (const p of st.pages) {
      expect(p.lw.broken, p.uid).toBeNull();
      expect(named(p, /Olga|Zed/).sort(), p.uid).toEqual(["Olga Lines", "Zed Seen By One"]);
    }
  }, 360_000);
});
