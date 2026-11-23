import "./seed.js";
import { describe, expect, it } from "vitest";
import { ARC_PART_CHARS, ARC_PATH, arcDocPath, arcDocs, memoryBodies, memoryCuts, parseAlarm, parseDays, parsePointer, readArc, REPLAY_BUILD } from "../src/cuts.js";
import type { DbLike, DocLike, SnapLike } from "../src/live.js";
import { MemoryDb } from "../src/memdb.js";
import { liveDays } from "../../sim/src/liveDays.js";
import { archived, DAY, enc, eventually, G, kept1, oneWorld, ownHash, Stage, started, starters, type Page } from "./shared-stage.js";

/**
 * The checkpoint's step 3b, part A (cuts.ts, live.ts, keeper.ts): a kept cut comes with the archive of the records applied
 * up to it (world/arc/d/<first minute>), named by its trust document; a record stamped before the newest trust document's
 * minute is part of history only if the archive holds it, on every page, wherever its replay starts; a cut is withdrawn
 * together with every cut kept after it, and an archive never is.
 */

/** A store that says which documents and collections a page asked it for. */
function watched(db: DbLike): { db: DbLike; seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    db: {
      doc: (path) => (seen.push(path), db.doc(path)),
      collection: (path) => (seen.push(path), db.collection(path)),
    },
  };
}
const archiveReads = (seen: string[]): string[] => seen.filter((p) => p.startsWith(ARC_PATH));
const erase = (st: Stage, path: string): void => void (st.db as unknown as { docs: Map<string, unknown> }).docs.delete(path);
/** The companies on a page whose names match. */
const named = (p: Page, what: RegExp): string[] => p.lw.w.companies.filter((x) => what.test(x.name)).map((x) => x.name);
const join = (s: number, at: number, name: string, hub = 2) => ({ s, at, a: { type: "join", name, hub: starters[hub]!, look: "m" } });
const cancel = (s: number, at: number, truckId = 1) => ({ s, at, a: { type: "cancel_bid", truckId } });

/** The players report, and the owner's page writes the day's cut and keeps it. */
async function keepDay(s: { st: Stage; owner: Page; players: Page[] }, day: number): Promise<void> {
  for (const p of s.st.pages) await ownHash(p, day);
  await s.st.round(...s.players);
  await s.st.round(s.owner);
  s.owner.keeper["nextReadAt"] = 0;
  await s.st.round(s.owner);
  expect((await s.st.trust(day))?.day).toBe(day);
}

describe("the shared checkpoint (step 3b): a kept day's records are the archive's", () => {
  it("a kept day's order reads otherwise in its player's document, and a report differs from the kept cut: the owner's page computes the day again over the archive, the cut stands, and every page shows the order as the archive has it", async () => {
    const s = await started({ players: ["alice", "bob", "mallory"] });
    const { st, owner, a } = s;
    const world = owner.lw.worldKey();
    const trust = await kept1(s);
    const c = await st.open("carol");
    expect(c.lw.startedKind).toBe("shared");
    const before = enc(a.lw.w);
    st.close(s.players[2]!);
    const doc = (await st.doc("players/mallory")) as { acts: { a: Record<string, unknown> }[] };
    await st.db.doc("players/mallory").set({ ...doc, acts: doc.acts.map((r) => (r.a.type === "join" ? { ...r, a: { ...r.a, name: "Mallory Renamed" } } : r)) });
    await st.settle();
    oneWorld(st, before);
    // Another hash for the day, in her report.
    await st.db.doc("days/mallory").set({ v: 1, world, build: REPLAY_BUILD, days: [{ day: 1, hash: "e".repeat(64), rh: trust.rh, from: "seed" }] });
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(parseAlarm(await st.doc("world/alarm"), world).open.map((o) => o.uid)).toEqual(["mallory"]);
    // The owner's page starts again from the seed, takes the day's records from the archive, and hashes the day again.
    expect(owner.lw.startedKind).toBe("seed");
    await ownHash(owner, 1);
    await st.round(owner);
    const alarm = parseAlarm(await st.doc("world/alarm"), world);
    expect(alarm.stood).toEqual([{ day: 1, hash: trust.hash }]);
    expect(alarm.barred).toEqual([]);
    expect(owner.lw.sharedView().kept.map((k) => [k.day, k.hash])).toEqual([[1, trust.hash]]);
    expect(parsePointer(await st.doc("world/checkpoint")).bodies.map((x) => [x.day, x.hash])).toEqual([[1, trust.hash]]);
    oneWorld(st, before);
    for (const p of st.pages) expect(named(p, /allory/), p.uid).toEqual(["mallory Haul"]);
    // The cut stood, so a page opening starts from its body again, though the report is still on the owner's list.
    expect(alarm.open.map((o) => o.uid)).toEqual(["mallory"]);
    const e = await st.open("erin");
    expect(e.lw.startedKind).toBe("shared");
    expect(enc(e.lw.w)).toBe(before);
  }, 240_000);

  it("the same order, and no report: a page that can read no body computes the kept world from the seed and the archive, hashes the day as it was kept, and no report differs", async () => {
    const s = await started({ players: ["alice", "bob", "mallory"] });
    const { st, owner, a } = s;
    const world = owner.lw.worldKey();
    const trust = await kept1(s);
    const before = enc(a.lw.w);
    st.close(s.players[2]!);
    const doc = (await st.doc("players/mallory")) as { acts: { a: Record<string, unknown> }[] };
    await st.db.doc("players/mallory").set({ ...doc, acts: doc.acts.map((r) => (r.a.type === "join" ? { ...r, a: { ...r.a, name: "Mallory Renamed" } } : r)) });
    await st.settle();
    const w = watched(st.db);
    const frank = await st.open("frank", { bodies: memoryBodies(), db: w.db });
    expect(frank.lw.startedKind).toBe("seed");
    expect(archiveReads(w.seen)).toEqual([arcDocPath(0)]);
    expect(enc(frank.lw.w)).toBe(before);
    await frank.lw.submit({ type: "join", name: "Frank Freight", hub: starters[0]! });
    await st.run(1);
    expect(await ownHash(frank, 1)).toBe(trust.hash);
    await st.round(frank);
    expect(parseDays(await st.doc("days/frank"))!.days).toEqual([{ day: 1, hash: trust.hash, rh: trust.rh, from: "seed" }]);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    await st.round(owner);
    expect(parseAlarm(await st.doc("world/alarm"), world)).toEqual({ open: [], stood: [], barred: [], ignored: [] });
    expect(owner.lw.sharedView().kept.map((k) => [k.day, k.hash])).toEqual([[1, trust.hash]]);
    oneWorld(st);
    for (const p of st.pages) expect(named(p, /allory/), p.uid).toEqual(["mallory Haul"]);
  }, 240_000);

  it("a kept day's orders read otherwise in a player's document (one gone, others on numbers the day hadn't used, others with another text): no page replays, and a page from the seed and a page from the body compute the kept world", async () => {
    const s = await started();
    const { st, a } = s;
    // A third player's orders before the boundary: numbers 0, 2 and 5.
    const acts = [join(0, 400, "Ivan Old"), cancel(2, 500), cancel(5, 600, 2)];
    await st.db.doc("players/ivan").set({ v: 1, acts, archived: 0 });
    await st.settle();
    for (const p of st.pages) await ownHash(p, 1);
    await kept1(s);
    expect((await archived(st, 1)).filter((x) => x[0] === "ivan")).toEqual(acts.map((r) => ["ivan", r]));
    const before = enc(a.lw.w);
    // Afterwards his document holds other orders for that day: number 2 gone, numbers 1 and 3 new, number 5 and the join
    // with another text.
    await st.db.doc("players/ivan").set({ v: 1, acts: [join(0, 400, "Ivan New"), join(1, 450, "Ivan Filled"), cancel(3, 550, 7), cancel(5, 600, 9)], archived: 0 });
    await st.settle();
    oneWorld(st, before);
    const fromSeed = await st.open("dave", { bodies: memoryBodies() });
    const fromBody = await st.open("carol");
    expect([fromSeed.lw.startedKind, fromBody.lw.startedKind]).toEqual(["seed", "shared"]);
    oneWorld(st, before);
    for (const p of st.pages) expect(named(p, /Ivan/), p.uid).toEqual(["Ivan Old"]);
    // His next order, stamped after the cut, counts on every page, and the pages stay in step through the next day's cut.
    await st.db.doc("players/ivan").set({ v: 1, acts: [join(0, 400, "Ivan New"), cancel(5, 600, 9), cancel(6, Math.ceil(st.minute()) + 5, 3)], archived: 0 });
    await st.until(2 * DAY + G);
    const day2 = await ownHash(a, 2);
    for (const p of st.pages) expect(await ownHash(p, 2), p.uid).toBe(day2);
    oneWorld(st);
  }, 240_000);

  it("a player's log reads otherwise after the cut (its count, its chunks, the document's oldest orders): every page, open or opening, computes the kept world", async () => {
    const s = await started();
    const { st, a } = s;
    // Zed's log: one chunk of his first orders, the join among them, and the newer ones in his document.
    const zed = [join(0, 380, "Zed Chunked"), ...Array.from({ length: 199 }, (_, i) => cancel(i + 1, 400 + i, i))];
    await st.db.doc("players/zed/log/c00000").set({ acts: zed });
    await st.db.doc("players/zed").set({ v: 1, acts: [cancel(200, 700), cancel(201, 710), cancel(202, 720)], archived: 1 });
    // Yan's: a count of two with one chunk there.
    await st.db.doc("players/yan/log/c00000").set({ acts: [join(0, 390, "Yan Yard", 1), cancel(1, 500), cancel(2, 510)] });
    await st.db.doc("players/yan").set({ v: 1, acts: [cancel(3, 900)], archived: 2 });
    await st.settle();
    for (const p of st.pages) await ownHash(p, 1);
    const trust = await kept1(s);
    expect(trust.arc.n).toBe(2 + 203 + 4);
    const before = enc(a.lw.w);
    // After the cut both logs read otherwise in the store: Zed's count, chunk and document; Yan's first chunk, and a second
    // one where there was none.
    erase(st, "players/zed/log/c00000");
    await st.db.doc("players/zed").set({ v: 1, acts: [cancel(202, 720)], archived: 0 });
    await st.db.doc("players/yan/log/c00000").set({ acts: [join(0, 390, "Yan Other", 1), cancel(1, 500, 44)] });
    await st.db.doc("players/yan/log/c00001").set({ acts: [cancel(10, 520), cancel(11, 530)] });
    await st.db.doc("players/yan").set({ v: 1, acts: [cancel(3, 900)], archived: 2 });
    await st.settle();
    oneWorld(st, before);
    const fromSeed = await st.open("dave", { bodies: memoryBodies() });
    const fromBody = await st.open("carol");
    expect([fromSeed.lw.startedKind, fromBody.lw.startedKind]).toEqual(["seed", "shared"]);
    oneWorld(st, before);
    for (const p of st.pages) expect(named(p, /Zed|Yan/).sort(), p.uid).toEqual(["Yan Yard", "Zed Chunked"]);
  }, 240_000);

  it("no chunks with the shared checkpoint on: a tab's document lets go of the orders stamped before the newest kept cut and keeps its next number; an open page and a page opening compute the same world", async () => {
    const s = await started();
    const { st, a } = s;
    for (let i = 0; i < 305; i++) await a.lw.submit({ type: "cancel_bid", truckId: 900_000 + i });
    const stored = async () => (await st.doc("players/alice")) as { acts: { s: number; at: number }[]; archived: number; next: number };
    // Two days on with no cut kept: over a day old, and still in her document.
    await st.until(2 * DAY + G + 120);
    await a.lw.submit({ type: "cancel_bid", truckId: 1 });
    expect([(await stored()).acts.length, (await stored()).archived, (await stored()).next]).toEqual([307, 0, 307]);
    // Day 2's cut kept: her next order leaves the orders stamped before it out of her document. No chunk is written.
    await keepDay(s, 2);
    const order = await a.lw.submit({ type: "cancel_bid", truckId: 2 });
    expect(order.s).toBe(307);
    expect([(await stored()).acts.map((r) => r.s), (await stored()).archived, (await stored()).next]).toEqual([[306, 307], 0, 308]);
    expect((await stored()).acts.every((r) => r.at >= 2 * DAY)).toBe(true);
    expect((await st.db.collection("players/alice/log").get()).docs).toEqual([]);
    await st.run(1);
    oneWorld(st);
    // A page opening reads no log, and computes the same world from the seed and the archive.
    const w = watched(st.db);
    const late = await st.open("dave", { bodies: memoryBodies(), db: w.db });
    expect(late.lw.startedKind).toBe("seed");
    expect(w.seen.filter((x) => /\/log(\/|$)/.test(x))).toEqual([]);
    oneWorld(st);
    // Her page, opened again on the shorter document, numbers its next order after the ones the archive holds.
    st.close(a);
    const again = await st.open("alice");
    expect((await again.lw.submit({ type: "cancel_bid", truckId: 3 })).s).toBe(308);
    await st.run(1);
    oneWorld(st);
  }, 240_000);
});

describe("the shared checkpoint (step 3b): a cut withdrawn", () => {
  it("two kept cuts and the older withdrawn: the newer goes with it in the same write and no archive is touched; a page from the newer body starts again; every page, from the seed with or without a body store, computes the same world, and the order the older cut left out stays out", async () => {
    let alarmWrites = 0;
    const s = await started();
    const { st, owner, a } = s;
    const world = owner.lw.worldKey();
    const counted: DbLike = {
      collection: (p) => st.db.collection(p),
      doc: (p): DocLike => {
        const d = st.db.doc(p);
        return p === "world/alarm" ? { ...d, set: (data) => (alarmWrites++, d.set(data)) } : d;
      },
    };
    (owner.keeper as unknown as { db: DbLike }).db = counted;
    const t1 = await kept1(s);
    // An order the first cut left out: stamped before it, in the store after it was kept. Its player plays on.
    await st.db.doc("players/erin").set({ v: 1, acts: [join(0, DAY - 120, "Erin Late")], archived: 0 });
    await st.settle();
    await st.db.doc("players/erin").set({ v: 1, acts: [join(0, DAY - 120, "Erin Late"), join(1, Math.ceil(st.minute()) + 5, "Erin Again")], archived: 0 });
    await st.until(2 * DAY + G);
    await keepDay(s, 2);
    const t2 = (await st.trust(2))!;
    expect(t2.arc).toMatchObject({ from: DAY, to: 2 * DAY });
    const x = await st.open("xena");
    expect([x.lw.startedKind, x.lw.startedFrom]).toEqual(["shared", 2 * DAY]);
    const before = enc(a.lw.w);
    const archives = [await st.doc(arcDocPath(0)), await st.doc(arcDocPath(DAY))];
    expect(alarmWrites).toBe(0);
    await owner.keeper.bar(1, t1.hash);
    expect(alarmWrites).toBe(1);
    expect(parseAlarm(await st.doc("world/alarm"), world).barred).toEqual([{ day: 1, hash: t1.hash }, { day: 2, hash: t2.hash }]);
    await st.settle();
    // No cut stands; both trust documents still freeze their records, and their archives are as they were.
    expect(owner.lw.sharedView().kept).toEqual([]);
    expect(owner.lw.sharedView().trust.map((d) => d.day)).toEqual([1, 2]);
    expect([await st.doc(arcDocPath(0)), await st.doc(arcDocPath(DAY))]).toEqual(archives);
    expect(x.lw.startedKind).toBe("seed");
    const y = await st.open("yuri");
    const w = watched(st.db);
    const z = await st.open("zoe", { bodies: memoryBodies(), db: w.db });
    expect([y.lw.startedKind, z.lw.startedKind]).toEqual(["seed", "seed"]);
    expect(archiveReads(w.seen)).toEqual([arcDocPath(0), arcDocPath(DAY)]);
    oneWorld(st, before);
    for (const p of st.pages) expect(named(p, /Erin/), p.uid).toEqual(["Erin Again"]);
    // The owner's page writes no cut of a withdrawn day again with the hash it withdrew.
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    await st.round(owner);
    expect(owner.lw.sharedView().kept).toEqual([]);
    // The next day's cut is kept on its own, its archive beginning where day 2's ended, and a page starts from its body.
    await st.until(3 * DAY + G);
    await keepDay(s, 3);
    expect((await st.trust(3))!.arc).toMatchObject({ from: 2 * DAY, to: 3 * DAY });
    expect(owner.lw.sharedView().kept.map((k) => k.day)).toEqual([3]);
    const v = await st.open("vera");
    expect([v.lw.startedKind, v.lw.startedFrom]).toEqual(["shared", 3 * DAY]);
    oneWorld(st);
  }, 360_000);

  it("the owner's page, answering a report against a kept cut, hashes the day otherwise: that cut and the one kept after it are withdrawn in one write, and their records stay", async () => {
    const s = await started({ players: ["alice", "bob", "mallory"], ownerOptions: { cuts: memoryCuts() } });
    const { st, owner, a } = s;
    const world = owner.lw.worldKey();
    const t1 = await kept1(s);
    await st.until(2 * DAY + G);
    await keepDay(s, 2);
    const t2 = (await st.trust(2))!;
    const before = enc(a.lw.w);
    st.close(s.players[2]!);
    s.players.pop();
    await st.db.doc("days/mallory").set({ v: 1, world, build: REPLAY_BUILD, days: [{ day: 1, hash: "e".repeat(64), rh: t1.rh, from: "seed" }] });
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(parseAlarm(await st.doc("world/alarm"), world).open.map((o) => [o.day, o.uid])).toEqual([[1, "mallory"]]);
    // It computes day 1 again from the seed, over the archive (stood in for another result: its own hash of it is another).
    expect(owner.lw.startedKind).toBe("seed");
    await ownHash(owner, 1);
    (owner.lw as unknown as { ownCuts: Map<number, { hash: string | null }> }).ownCuts.get(1)!.hash = "7".repeat(64);
    await st.round(owner);
    const alarm = parseAlarm(await st.doc("world/alarm"), world);
    expect(alarm.barred).toEqual([{ day: 1, hash: t1.hash }, { day: 2, hash: t2.hash }]);
    expect(alarm.stood).toEqual([]);
    await st.settle();
    for (const p of st.pages) {
      expect(p.lw.sharedView().kept, p.uid).toEqual([]);
      expect(p.lw.sharedView().trust.map((d) => [d.day, d.arc.hash]), p.uid).toEqual([[1, t1.arc.hash], [2, t2.arc.hash]]);
    }
    expect(enc(a.lw.w)).toBe(before);
    const late = await st.open("dave");
    expect(late.lw.startedKind).toBe("seed");
    expect(enc(late.lw.w)).toBe(before);
  }, 240_000);

  it("a withdrawn day gets another cut over the same records: the trust document names the same archive, which is not written again", async () => {
    const st = new Stage();
    const owner = await st.open("olga", { owner: true, keep: { fewPlayers: true } });
    await owner.lw.submit({ type: "join", name: "Olga Lines", hub: starters[0]! });
    await st.until(DAY + G);
    const first = await ownHash(owner, 1);
    await st.round(owner);
    await st.round(owner);
    const t1 = (await st.trust(1))!;
    expect(t1.hash).toBe(first);
    const head = JSON.stringify(await st.doc(arcDocPath(0)));
    await owner.keeper.bar(1, first);
    await st.settle();
    expect(owner.lw.sharedView().kept).toEqual([]);
    // The owner's page hashes the day otherwise now (stood in for: its own hash of it is another), over the same records.
    const other = "9".repeat(64);
    (owner.lw as unknown as { ownCuts: Map<number, { hash: string | null }> }).ownCuts.get(1)!.hash = other;
    const writes: string[] = [];
    const real = st.db.doc.bind(st.db);
    st.db.doc = (p) => ({ ...real(p), set: (data) => (writes.push(p), real(p).set(data)) });
    await st.round(owner);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    const t2 = (await st.trust(1))!;
    expect(t2.hash).toBe(other);
    expect([t2.rh, t2.arc]).toEqual([t1.rh, t1.arc]);
    expect(JSON.stringify(await st.doc(arcDocPath(0)))).toBe(head);
    expect(writes.filter((p) => p.startsWith(ARC_PATH))).toEqual([]);
    expect(owner.lw.sharedView().kept.map((k) => [k.day, k.hash])).toEqual([[1, other]]);
    expect(owner.lw.sharedView().trust.length).toBe(1);
  }, 120_000);
});

describe("the shared checkpoint (step 3b): the archive in the store", () => {
  it("days with no kept cut, then a kept one: its archive covers them all, in one document read by a page from the seed and none by a page from the body; an order of an unkept day is as frozen as any; the node replay of a copy gives the kept hashes", async () => {
    const s = await started();
    const { st, owner, a, b } = s;
    await kept1(s);
    // Days 2 and 3: the owner's page writes each day's cut, the players' pages don't report, and neither is kept.
    await st.until(DAY + 20 * 60);
    await st.db.doc("players/ivan").set({ v: 1, acts: [join(0, Math.ceil(st.minute()) + 5, "Ivan Day Two")], archived: 0 });
    for (const day of [2, 3]) {
      await st.until(day * DAY + G);
      await ownHash(owner, day);
      await st.round(owner);
      owner.keeper["nextReadAt"] = 0;
      await st.round(owner);
      expect(await st.trust(day)).toBeNull();
    }
    expect(await st.doc(arcDocPath(DAY))).toBeUndefined();
    await st.until(4 * DAY + G);
    await keepDay(s, 4);
    const t4 = (await st.trust(4))!;
    expect(t4.arc).toMatchObject({ from: DAY, to: 4 * DAY, parts: 1 });
    // The archives are a level below the world's own documents: a read of that collection doesn't bring them.
    expect((await st.db.collection("world").get()).docs.map((d) => d.id).sort()).toEqual(["checkpoint", "cpm-1", "cpm-4", "meta"]);
    expect((await st.db.collection(ARC_PATH).get()).docs.map((d) => d.id).sort()).toEqual(["0", "1440"]);
    expect((await archived(st, 4)).filter((x) => x[0] === "ivan").length).toBe(1);
    // The bodies of days 2 and 3 are behind the frozen minute now: never kept, whatever is reported for them.
    await st.round(a, b);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect([await st.trust(2), await st.trust(3)]).toEqual([null, null]);
    expect(await st.doc("world/alarm")).toBeUndefined();
    const before = enc(a.lw.w);
    // Ivan's order of day 2 reads otherwise in his document: no page replays, and the pages opening compute the world as
    // it was kept.
    await st.db.doc("players/ivan").set({ v: 1, acts: [join(0, DAY + 20 * 60 + 9, "Ivan Renamed")], archived: 0 });
    await st.settle();
    oneWorld(st, before);
    const ws = watched(st.db);
    const wb = watched(st.db);
    const fromSeed = await st.open("dave", { bodies: memoryBodies(), db: ws.db });
    const fromBody = await st.open("carol", { db: wb.db });
    expect([fromSeed.lw.startedKind, fromBody.lw.startedKind, fromBody.lw.startedFrom]).toEqual(["seed", "shared", 4 * DAY]);
    expect(archiveReads(ws.seen)).toEqual([arcDocPath(0), arcDocPath(DAY)]);
    expect(archiveReads(wb.seen)).toEqual([]);
    oneWorld(st, before);
    for (const p of st.pages) expect(named(p, /Ivan/), p.uid).toEqual(["Ivan Day Two"]);
    // The node replay of a copy of the store, the archives in it: the kept days hash as they were kept.
    const copy = [...(st.db as unknown as { docs: Map<string, Record<string, unknown>> }).docs];
    const out = await liveDays(copy, st.clock);
    expect(out.days.map((d) => [d.day, d.kept === null ? null : d.kept === d.hash])).toEqual([[1, true], [2, null], [3, null], [4, true]]);
    // Without the archives in the copy there is nothing to replay the kept days from.
    await expect(liveDays(copy.filter(([p]) => !p.startsWith(ARC_PATH)), st.clock)).rejects.toThrow(/archive/);
  }, 360_000);

  it("an archive half written is used by no page: its parts without its head, then whole without its trust document; an order that arrives meanwhile is in the archive the trust document names", async () => {
    const st = new Stage();
    let fail: string | null = null;
    const writes: string[] = [];
    const flaky: DbLike = {
      collection: (p) => st.db.collection(p),
      doc: (p): DocLike => {
        const d = st.db.doc(p);
        return {
          ...d,
          set: async (data) => {
            if (p === fail) {
              fail = null;
              throw new Error("the tab closed");
            }
            writes.push(p);
            return d.set(data);
          },
        };
      },
    };
    // A small part size, so that a day of a few orders is an archive in several documents.
    const s = await started({ st, ownerOptions: { db: flaky, keep: { arcPartChars: 60 } } });
    const { owner, a, b } = s;
    await st.round(a, b);
    await st.round(owner);
    // The head's write fails: further parts in the store, no head, no trust document.
    fail = arcDocPath(0);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(owner.keeper.note).toMatch(/the tab closed/);
    expect(await st.doc(arcDocPath(0, 1))).toBeDefined();
    expect([await st.doc(arcDocPath(0)), await st.doc("world/cpm-1")]).toEqual([undefined, undefined]);
    // Then the archive whole, and the trust document's write fails.
    fail = "world/cpm-1";
    await st.round(owner);
    const head = (await st.doc(arcDocPath(0))) as { parts: number; n: number };
    expect(head.parts).toBeGreaterThan(2);
    expect(head.n).toBe(2);
    expect(await st.doc("world/cpm-1")).toBeUndefined();
    const w = watched(st.db);
    const c = await st.open("carol", { db: w.db });
    expect(c.lw.startedKind).toBe("seed");
    expect(archiveReads(w.seen)).toEqual([]);
    // Not frozen yet: an order stamped before the boundary arrives, and every page applies it.
    await st.db.doc("players/erin").set({ v: 1, acts: [join(0, DAY - 120, "Erin Late")], archived: 0 });
    await st.settle();
    for (const p of st.pages) expect(named(p, /Erin/), p.uid).toEqual(["Erin Late"]);
    // The day computed again: its body and its archive are replaced, and the trust document names the archive with her order.
    await keepDay(s, 1);
    const trust = (await st.trust(1))!;
    expect(trust.arc.n).toBe(3);
    expect(trust.arc.parts).toBeGreaterThan(2);
    expect((await archived(st, 1)).map((x) => x[0])).toEqual(["alice", "bob", "erin"]);
    // The order of the owner's writes: the pointer (its body is in the store by then); later the archive's further parts,
    // its head, and last the trust document.
    const last = writes.lastIndexOf("world/cpm-1");
    expect(writes.slice(last - trust.arc.parts)).toEqual([...Array.from({ length: trust.arc.parts - 1 }, (_, i) => arcDocPath(0, trust.arc.parts - 1 - i)), arcDocPath(0), "world/cpm-1"]);
    expect(writes.lastIndexOf("world/checkpoint")).toBeLessThan(last - trust.arc.parts);
    expect(writes.lastIndexOf("world/checkpoint")).toBeGreaterThanOrEqual(0);
    const fromSeed = await st.open("dave", { bodies: memoryBodies(), db: w.db });
    expect(fromSeed.lw.startedKind).toBe("seed");
    expect(archiveReads(w.seen).length).toBe(trust.arc.parts);
    oneWorld(st);
  }, 240_000);

  it("an archive over one document's size is carried in parts, the head written last, and reads back whole; with a part missing or changed it doesn't read, and a saved copy is no answer", async () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed.toString(36));
    const lines = Array.from({ length: 4000 }, (_, i) => JSON.stringify(["u", { s: i, at: i, a: { type: "x", pad: Array.from({ length: 30 }, rand).join("") } }]));
    const text = lines.join("\n");
    const db = new MemoryDb();
    const { ref, docs } = await arcDocs("w", 0, DAY, text, lines.length);
    expect(ref.parts).toBeGreaterThan(1);
    expect(ref).toMatchObject({ from: 0, to: DAY, n: 4000 });
    expect(docs.length).toBe(ref.parts);
    expect(docs[docs.length - 1]![0]).toBe(arcDocPath(0));
    for (const [path, body] of docs) {
      expect((body.z as string).length).toBeLessThanOrEqual(ARC_PART_CHARS);
      expect(JSON.stringify(body).length).toBeLessThan(256 * 1024);
      await db.doc(path).set(body);
    }
    expect(await readArc(db, ref)).toBe(text);
    // Another text's hash, a part gone, a part changed.
    expect(await readArc(db, { ...ref, hash: "0".repeat(64) })).toBeNull();
    const part = (await db.doc(arcDocPath(0, 1)).get()).data()!;
    await db.doc(arcDocPath(0, 1)).set({ ...part, z: `${(part.z as string).slice(0, -8)}AAAAAAAA` });
    expect(await readArc(db, ref)).toBeNull();
    await db.doc(arcDocPath(0, 1)).set({ v: 1 });
    expect(await readArc(db, ref)).toBeNull();
    await db.doc(arcDocPath(0, 1)).set(part);
    expect(await readArc(db, ref)).toBe(text);
    const cached = { doc: (p: string) => ({ get: async (): Promise<SnapLike> => ({ ...(await db.doc(p).get()), metadata: { fromCache: true } }) }) };
    await expect(readArc(cached, ref)).rejects.toThrow(/saved copy/);
    // An archive of no records is one document.
    const none = await arcDocs("w", DAY, 2 * DAY, "", 0);
    expect(none.ref.parts).toBe(1);
    await db.doc(none.docs[0]![0]).set(none.docs[0]![1]);
    expect(await readArc(db, none.ref)).toBe("");
  }, 60_000);

  it("an archive that isn't its trust document's stops the page rather than have it compute other records", async () => {
    const s = await started();
    const { st } = s;
    await kept1(s);
    const head = (await st.doc(arcDocPath(0)))!;
    // The archive's document gone from the store.
    erase(st, arcDocPath(0));
    const gone = await st.open("dave", { bodies: memoryBodies() });
    expect(gone.lw.broken?.reason).toMatch(/archive of minutes 0 to 1440/);
    st.close(gone);
    // Another day's records under its name: a text that isn't the trust document's.
    const other = await arcDocs(s.owner.lw.worldKey(), 0, DAY, JSON.stringify(["zed", cancel(0, 500)]), 1);
    await st.db.doc(arcDocPath(0)).set(other.docs[0]![1]);
    const wrong = await st.open("erin", { bodies: memoryBodies() });
    expect(wrong.lw.broken?.reason).toMatch(/archive of minutes 0 to 1440/);
    st.close(wrong);
    // A page from the kept body needs no archive, and runs.
    const fromBody = await st.open("carol");
    expect([fromBody.lw.startedKind, fromBody.lw.broken]).toEqual(["shared", null]);
    // Back as it was, a page from the seed computes the kept world.
    await st.db.doc(arcDocPath(0)).set(head);
    const back = await st.open("frank", { bodies: memoryBodies() });
    expect(back.lw.broken).toBeNull();
    oneWorld(st);
  }, 240_000);
});

describe("the shared checkpoint (step 3b): with this browser's own cuts (step 2a)", () => {
  it("a page's own cut made after the frozen minute is started from while the players' orders since that minute are the ones it applied; frozen further, a cut of that very minute is placed by its running hash", async () => {
    const st = new Stage();
    const store = memoryCuts();
    const owner = await st.open("olga", { owner: true });
    const a = await st.open("alice", { cuts: store });
    const b = await st.open("bob");
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await b.lw.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });
    const s = { st, owner, players: [a, b] };
    await st.until(DAY + G);
    await keepDay(s, 1);
    const t1 = (await st.trust(1))!;
    // Her cut of day 2's boundary is made over day 1's frozen records.
    await st.until(2 * DAY + 3 * 60);
    await eventually(() => store.cuts.size >= 2);
    const local = [...store.cuts.values()].find((c) => c.t === 2 * DAY)!;
    expect(local.under).toEqual({ t: DAY, rh: t1.rh });
    st.close(a);
    // An order of day 1 that reads otherwise in the store changes nothing for it.
    const doc = (await st.doc("players/bob")) as { acts: { a: Record<string, unknown> }[] };
    await st.db.doc("players/bob").set({ ...doc, acts: doc.acts.map((r) => ({ ...r, a: { ...r.a, name: "Bob Renamed" } })) });
    await st.settle();
    let again = await st.open("alice", { cuts: store });
    expect([again.lw.startedKind, again.lw.startedFrom]).toEqual(["local", 2 * DAY]);
    oneWorld(st);
    st.close(again);
    // An order stamped after the frozen minute and before her cut arrives: that cut is passed over for her cut of day 1's
    // boundary, which is the trust document's own minute.
    await st.db.doc("players/erin").set({ v: 1, acts: [join(0, DAY + 600, "Erin Day Two")], archived: 0 });
    await st.settle();
    again = await st.open("alice", { cuts: store });
    expect([again.lw.startedKind, again.lw.startedFrom]).toEqual(["local", DAY]);
    oneWorld(st);
    for (const p of st.pages) expect(named(p, /Erin|Renamed/), p.uid).toEqual(["Erin Day Two"]);
  }, 240_000);
});
