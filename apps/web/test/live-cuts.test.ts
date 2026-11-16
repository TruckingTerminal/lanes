import "./seed.js";
import { describe, expect, it } from "vitest";
import { hubs } from "@lanes/data";
import * as agents from "@lanes/agents";
import * as config from "@lanes/config";
import * as data from "@lanes/data";
import * as engine from "@lanes/engine";
import { encodeWorld, outsideRefs, type World } from "@lanes/engine";
import * as books from "../src/books.js";
import { booksState } from "../src/books.js";
import * as cuts from "../src/cuts.js";
import { cutExtras, memoryCuts, CUTS_KEPT, type Cut } from "../src/cuts.js";
import * as game from "../src/game.js";
import { RULESET } from "../src/game.js";
import * as live from "../src/live.js";
import { LiveWorld, MS_PER_GAME_HOUR, type WorldMeta } from "../src/live.js";
import * as trucknos from "../src/trucknos.js";
import { truckNumber } from "../src/trucknos.js";
import { MemoryDb } from "../src/memdb.js";

/**
 * The checkpoint's step 2a (cuts.ts): a page starts its replay from this browser's own newest local cut whose records
 * still match the store's, and computes the same world as a page replaying from the seed. A late record before a cut
 * sends a page to an older cut (never drops it); another replay build's cut is never used.
 */
const MIN = MS_PER_GAME_HOUR / 60;
const DAY = 24 * 60;
const starters = hubs.filter((h) => h.isStarter).map((h) => h.id);
const pause = () => new Promise((r) => setTimeout(r, 5));
/** The world and what a cut carries beside it (the bots' state, the month books, the truck numbers). */
const enc = (w: World) => encodeWorld(w, cutExtras(w));

/** A world two players run for `days` game days, one page of theirs keeping local cuts in `store`. */
async function played(days: number) {
  let clock = 6 * MS_PER_GAME_HOUR;
  const now = () => clock;
  const db = new MemoryDb(now);
  const meta: WorldMeta = { v: 1, seed: 4242, epochMs: 0, msPerGameHour: MS_PER_GAME_HOUR, ruleset: RULESET };
  const store = memoryCuts();
  const a = await LiveWorld.open(db, meta, "alice", { now, holder: "a", cuts: store, manualRenewal: true });
  const b = await LiveWorld.open(db, meta, "bob", { now, holder: "b", manualRenewal: true });
  await a.rebuild();
  await b.rebuild();
  await a.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
  await b.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });
  for (let h = 1; h <= days * 24; h++) {
    clock += 60 * MIN;
    await pause();
    a.advance(1e9);
    b.advance(1e9);
    if (h % 17 === 0) await (h % 2 ? a : b).submit({ type: "wait" });
  }
  await pause();
  const at = () => clock;
  const step = async (hours: number, ...pages: LiveWorld[]) => {
    for (let h = 0; h < hours; h++) {
      clock += 60 * MIN;
      await pause();
      for (const p of pages) p.advance(1e9);
    }
  };
  return { db, meta, now, store, a, b, at, step };
}

describe("local cuts (the checkpoint's step 2a)", () => {
  it("a page starts from the newest cut and computes the same world as a page from the seed, then keeps in step", async () => {
    const { db, meta, now, store, a, b, at, step } = await played(3);
    expect(store.cuts.size).toBeGreaterThan(0);
    expect(store.cuts.size).toBeLessThanOrEqual(CUTS_KEPT);
    // Nothing in the world is an object a module holds (game.ts's default orders were, for a joined company).
    expect(outsideRefs(a.w, [agents, config, data, engine, books, cuts, game, live, trucknos, a.w.cfg, a.w.net, a.w.feeds])).toEqual([]);
    const newest = Math.max(...[...store.cuts.values()].map((c) => c.t));
    expect(newest % DAY).toBe(0);
    expect(newest).toBeLessThanOrEqual(at() / MIN);
    const fromCut = await LiveWorld.open(db, meta, "carol", { now, holder: "c", cuts: store, manualRenewal: true });
    await fromCut.rebuild();
    expect(fromCut.startedFrom).toBe(newest);
    const fromSeed = await LiveWorld.open(db, meta, "dave", { now, holder: "d", manualRenewal: true });
    await fromSeed.rebuild();
    expect(fromSeed.startedFrom).toBeNull();
    for (const p of [a, b, fromCut, fromSeed]) p.advance(1e9);
    expect(enc(fromCut.w)).toBe(enc(fromSeed.w));
    expect(enc(a.w)).toBe(enc(fromSeed.w));
    // The page's own records came with it: the players' month books, and their trucks' numbers.
    const alice = fromCut.w.companies.find((c) => c.name === "Alice Haul")!;
    expect(booksState(fromCut.w)!.byCompany.get(alice.id)).toBeDefined();
    const truck = fromCut.w.trucksByCompany.get(alice.id)![0]!;
    expect(truckNumber(fromCut.w, truck)).toBe(truckNumber(fromSeed.w, fromSeed.w.trucks[truck.id - 1]!));
    expect(truckNumber(fromCut.w, truck)).toBeGreaterThan(0);
    // A day on, with an order on the way: still one world.
    await a.submit({ type: "wait" });
    await step(24, a, b, fromCut, fromSeed);
    expect(enc(fromCut.w)).toBe(enc(fromSeed.w));
    expect(enc(b.w)).toBe(enc(fromSeed.w));
  }, 240_000);

  it("a late record before the newest cut: that cut is passed over for an older one, and the world agrees with the seed's", async () => {
    const { db, meta, now, store, at } = await played(3);
    const cuts = [...store.cuts.values()].sort((x, y) => y.t - x.t);
    expect(cuts.length).toBeGreaterThanOrEqual(2);
    const [newest, older] = cuts as [Cut, Cut];
    // Another player's order, stamped between the two cuts, turns up late (a held write, a forged stamp).
    await db.doc("players/erin").set({ v: 1, acts: [{ s: 0, at: newest.t - 60, a: { type: "join", name: "Erin Late", hub: starters[2]!, look: "m" } }], archived: 0 });
    await pause();
    const fromCut = await LiveWorld.open(db, meta, "carol", { now, holder: "c", cuts: store, manualRenewal: true });
    await fromCut.rebuild();
    expect(fromCut.startedFrom).toBe(older.t);
    const fromSeed = await LiveWorld.open(db, meta, "dave", { now, holder: "d", manualRenewal: true });
    await fromSeed.rebuild();
    fromCut.advance(1e9);
    fromSeed.advance(1e9);
    expect(enc(fromCut.w)).toBe(enc(fromSeed.w));
    expect(fromCut.w.companies.some((c) => c.name === "Erin Late")).toBe(true); // applied, never dropped
    expect(at()).toBeGreaterThan(0);
  }, 240_000);

  it("a cut from another replay build, or another world, is never used", async () => {
    const { db, meta, now, store } = await played(2);
    expect(store.cuts.size).toBeGreaterThan(0);
    const other = memoryCuts();
    for (const c of store.cuts.values()) other.cuts.set(c.key, { ...c, build: "another-build" });
    const p = await LiveWorld.open(db, meta, "carol", { now, holder: "c", cuts: other, manualRenewal: true });
    await p.rebuild();
    expect(p.startedFrom).toBeNull();
    const elsewhere = memoryCuts();
    for (const c of store.cuts.values()) elsewhere.cuts.set(c.key, { ...c, world: "1:0:another" });
    const q = await LiveWorld.open(db, meta, "dave", { now, holder: "d", cuts: elsewhere, manualRenewal: true });
    await q.rebuild();
    expect(q.startedFrom).toBeNull();
  }, 240_000);
});
