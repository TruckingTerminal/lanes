import "./seed.js";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { ARC_PATH, arcDocPath, arcDocs, DAYS_PATH, memoryBodies, memoryCuts, parseAlarm, parsePointer, readArc, recLine, REPLAY_BUILD, RH0, rollHash } from "../src/cuts.js";
import { PENDING } from "../src/copy-pending.js";
import { RULESET } from "../src/game.js";
import { BUDGET, LiveWorld, MS_PER_GAME_HOUR, parseActs, type DbLike, type WorldMeta } from "../src/live.js";
import { MemoryDb } from "../src/memdb.js";
import { archived, DAY, enc, G, kept1, MIN, oneWorld, ownHash, rhOf, Stage, started, starters } from "./shared-stage.js";

/**
 * The checkpoint's step 3b, part B (live.ts, keeper.ts, cuts.ts), all of it with the shared checkpoint on: the budget (which
 * of an account's records count, the same on every page and so in the archive); the pages' reports in one collection, and
 * which of them count; the archive read's tries; and what a page from the seed holds of the archives. And of part C: the
 * day's counts of lists of standing orders and of joins with no company, and how an archive's documents are named.
 */
const cancel = (n: number, at: number, extra: Record<string, unknown> = {}) => ({ s: n, at, a: { type: "cancel_bid", truckId: n, ...extra } });
const join = (n: number, at: number, name: string, hub = 2) => ({ s: n, at, a: { type: "join", name, hub: starters[hub]!, look: "m" } });
const pad = (n: number): string => "x".repeat(n);

/** A store that says which documents and collections were asked of it. */
function watched(db: DbLike): { db: DbLike; seen: string[] } {
  const seen: string[] = [];
  return { seen, db: { doc: (path) => (seen.push(path), db.doc(path)), collection: (path) => (seen.push(path), db.collection(path)) } };
}

describe("the shared checkpoint (step 3b): the budget", () => {
  it("of an account's records in a game day the first thousand by minute and number count, from an account with no company only its join, and an order over its kind's length not at all: an open page, a page from the body and a page from the seed compute one world, and the archive holds what counted", async () => {
    const s = await started();
    const { st, owner, a, b } = s;
    // Zed: a join, then more orders than a day's count, their minutes not in the order of their numbers. His document
    // comes to the pages in two writes, the later one bringing orders that sort before ones the pages already hold.
    const zed = [join(0, 380, "Zed Many"), ...Array.from({ length: BUDGET.perDay + 5 }, (_, i) => cancel(i + 1, 400 + (i % 600)))];
    const mixed = [...zed].reverse();
    await st.db.doc("players/zed").set({ v: 1, acts: mixed.slice(0, 500), archived: 0 });
    await st.settle();
    await st.db.doc("players/zed").set({ v: 1, acts: mixed, archived: 0 });
    // Nia: an order from before her company exists, her join, and an order after it.
    await st.db.doc("players/nia").set({ v: 1, acts: [cancel(0, 500), join(1, 600, "Nia Joins Later", 1), cancel(2, 700)], archived: 0 });
    // Otto: an order past an order's length, a list of standing orders past a list's length, and a long list within it.
    const list = (n: number, at: number, chars: number) => ({ s: n, at, a: { type: "set_standing_orders", orders: [], pad: pad(chars) } });
    await st.db.doc("players/otto").set({ v: 1, acts: [join(0, 390, "Otto Long", 0), cancel(1, 800, { pad: pad(BUDGET.chars) }), list(2, 801, BUDGET.standing), list(3, 802, 3000), cancel(4, 803)], archived: 0 });
    await st.settle();
    for (const p of st.pages) await ownHash(p, 1);
    const trust = await kept1(s);
    const records = await archived(st, 1);
    const of = (uid: string) => records.filter((x) => x[0] === uid).map((x) => x[1].s);
    expect(of("zed")).toEqual([...zed].sort((x, y) => x.at - y.at || x.s - y.s).slice(0, BUDGET.perDay).map((r) => r.s));
    expect(of("nia")).toEqual([1, 2]);
    expect(of("otto")).toEqual([0, 3, 4]);
    expect(trust.arc.n).toBe(2 + BUDGET.perDay + 2 + 3);
    const before = enc(a.lw.w);
    const fromSeed = await st.open("dave", { bodies: memoryBodies() });
    const fromBody = await st.open("carol");
    expect([fromSeed.lw.startedKind, fromBody.lw.startedKind]).toEqual(["seed", "shared"]);
    oneWorld(st, before);
    for (const p of st.pages) expect(p.lw.w.companies.filter((x) => /^(Zed|Nia|Otto) /.test(x.name)).length, p.uid).toBe(3);
    // The next game day the count starts again: Zed's next order is a record of day 2.
    await st.db.doc("players/zed").set({ v: 1, acts: [...mixed, cancel(5000, Math.ceil(st.minute()) + 5)], archived: 0 });
    await st.until(2 * DAY + G);
    const day2 = await ownHash(a, 2);
    for (const p of st.pages) expect(await ownHash(p, 2), p.uid).toBe(day2);
    await st.round(a, b);
    await st.round(owner);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect((await archived(st, 2)).filter((x) => x[0] === "zed").map((x) => x[1].s)).toEqual([5000]);
    oneWorld(st);
  }, 360_000);

  it("a tab sends nothing past its own budget, and says why: a game day's count, an order over its length, a document near the store's size", async () => {
    const st = new Stage();
    await st.open("olga", { owner: true });
    // Alice's document holds her join and all but one of a day's count, stamped today.
    const at = Math.ceil(st.minute()) + 3;
    await st.db.doc("players/alice").set({ v: 1, acts: [join(0, at - 2, "Alice Haul", 0), ...Array.from({ length: BUDGET.perDay - 2 }, (_, i) => cancel(i + 1, at))], archived: 0, next: BUDGET.perDay - 1 });
    // Bob's holds orders near their most length, close to what the store takes in one document.
    await st.db.doc("players/bob").set({ v: 1, acts: [join(0, at - 2, "Bob Freight", 1), ...Array.from({ length: 520 }, (_, i) => cancel(i + 1, at, { pad: pad(BUDGET.chars - 60) }))], archived: 0, next: 521 });
    const a = await st.open("alice");
    const b = await st.open("bob");
    await st.run(1);
    const stored = async (uid: string) => ((await st.doc(`players/${uid}`)) as { acts: unknown[] }).acts.length;
    expect((await a.lw.submit({ type: "cancel_bid", truckId: 1 })).s).toBe(BUDGET.perDay - 1);
    await expect(a.lw.submit({ type: "cancel_bid", truckId: 2 })).rejects.toThrow(PENDING.liveDayFull);
    expect(await stored("alice")).toBe(BUDGET.perDay);
    await expect(b.lw.submit({ type: "cancel_bid", truckId: 2 })).rejects.toThrow(PENDING.liveDocFull);
    expect(await stored("bob")).toBe(521);
    // After midnight, game time, her orders go through again; one over an order's length doesn't, and says so.
    await st.until(DAY + 60);
    await expect(a.lw.submit({ type: "cancel_bid", truckId: 3, pad: pad(BUDGET.chars) } as never)).rejects.toThrow(PENDING.liveOrderTooLong);
    expect((await a.lw.submit({ type: "cancel_bid", truckId: 4 })).s).toBe(BUDGET.perDay);
    expect(await stored("alice")).toBe(BUDGET.perDay + 1);
    await st.run(1);
    oneWorld(st);
  }, 240_000);

  it("of an account's records in a game day so many lists of standing orders count, and from an account with no company so many joins: an open page, a page from the body and a page from the seed compute one world, and the archive holds what counted", async () => {
    const s = await started();
    const { st, owner, a, b } = s;
    const list = (n: number, at: number) => ({ s: n, at, a: { type: "set_standing_orders", orders: [] } });
    const nowhere = (n: number, at: number) => ({ s: n, at, a: { type: "join", name: "Mort Nowhere", hub: "no such hub", look: "m" } });
    const inOrder = <T extends { s: number; at: number }>(acts: T[]): T[] => [...acts].sort((x, y) => x.at - y.at || x.s - y.s);
    // Lena: a join, more lists than a day's count, their minutes not in the order of their numbers, and an order after them.
    const lena = [join(0, 380, "Lena Lists"), ...Array.from({ length: BUDGET.lists + 4 }, (_, i) => list(i + 1, 400 + ((i * 7) % 50))), cancel(900, 700)];
    await st.db.doc("players/lena").set({ v: 1, acts: [...lena].reverse(), archived: 0 });
    // Mort: joins that give no company (no such hub), more than a day's count of them, then one that would give one.
    const mort = [...Array.from({ length: BUDGET.joins + 2 }, (_, i) => nowhere(i, 400 + i)), join(50, 600, "Mort Too Many", 1)];
    await st.db.doc("players/mort").set({ v: 1, acts: mort, archived: 0 });
    // Nora: a join that gives a company, then as many more: from an account with a company they count as its other orders do.
    const nora = [join(0, 390, "Nora First", 0), ...Array.from({ length: BUDGET.joins + 2 }, (_, i) => join(i + 1, 500 + i, "Nora Again", 0))];
    await st.db.doc("players/nora").set({ v: 1, acts: nora, archived: 0 });
    await st.settle();
    for (const p of st.pages) await ownHash(p, 1);
    const trust = await kept1(s);
    const records = await archived(st, 1);
    const of = (uid: string) => records.filter((x) => x[0] === uid).map((x) => x[1].s);
    let lists = 0;
    expect(of("lena")).toEqual(inOrder(lena).filter((r) => r.a.type !== "set_standing_orders" || lists++ < BUDGET.lists).map((r) => r.s));
    expect(of("lena").length).toBe(BUDGET.lists + 2);
    expect(of("mort")).toEqual(Array.from({ length: BUDGET.joins }, (_, i) => i));
    expect(of("nora")).toEqual(nora.map((r) => r.s));
    expect(trust.arc.n).toBe(2 + BUDGET.lists + 2 + BUDGET.joins + nora.length);
    const before = enc(a.lw.w);
    const fromSeed = await st.open("dave", { bodies: memoryBodies() });
    const fromBody = await st.open("carol");
    expect([fromSeed.lw.startedKind, fromBody.lw.startedKind]).toEqual(["seed", "shared"]);
    oneWorld(st, before);
    const theirs = (p: { lw: LiveWorld }) => p.lw.w.companies.filter((x) => /^(Lena|Mort|Nora) /.test(x.name)).map((x) => x.name).sort();
    for (const p of st.pages) expect(theirs(p), p.uid).toEqual(["Lena Lists", "Nora First"]);
    // The next game day both counts start again: Mort's join gives him a company, and Lena's next list is a record of day 2.
    const at = Math.ceil(st.minute()) + 5;
    await st.db.doc("players/mort").set({ v: 1, acts: [...mort, join(60, at, "Mort Next Day", 1)], archived: 0 });
    await st.db.doc("players/lena").set({ v: 1, acts: [...lena, list(2000, at)], archived: 0 });
    await st.until(2 * DAY + G);
    const day2 = await ownHash(a, 2);
    for (const p of st.pages) expect(await ownHash(p, 2), p.uid).toBe(day2);
    await st.round(a, b);
    await st.round(owner);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    const next = await archived(st, 2);
    expect(next.filter((x) => x[0] === "mort" || x[0] === "lena").map((x) => [x[0], x[1].s])).toEqual([["lena", 2000], ["mort", 60]]);
    for (const p of st.pages) expect(theirs(p), p.uid).toEqual(["Lena Lists", "Mort Next Day", "Nora First"]);
    oneWorld(st);
  }, 360_000);

  it("a tab sends no more lists of standing orders in a game day than count, and says why; its other orders go through, and after midnight its lists do", async () => {
    const st = new Stage();
    await st.open("olga", { owner: true });
    const at = Math.ceil(st.minute()) + 3;
    const list = { type: "set_standing_orders", orders: [] } as const;
    await st.db.doc("players/alice").set({ v: 1, acts: [join(0, at - 2, "Alice Haul", 0), ...Array.from({ length: BUDGET.lists - 1 }, (_, i) => ({ s: i + 1, at, a: list }))], archived: 0, next: BUDGET.lists });
    const a = await st.open("alice");
    await st.run(1);
    const stored = async () => ((await st.doc("players/alice")) as { acts: unknown[] }).acts.length;
    expect((await a.lw.submit({ ...list, orders: [] })).s).toBe(BUDGET.lists);
    await expect(a.lw.submit({ ...list, orders: [] })).rejects.toThrow(PENDING.liveListsFull);
    expect(await stored()).toBe(BUDGET.lists + 1);
    expect((await a.lw.submit({ type: "cancel_bid", truckId: 1 })).s).toBe(BUDGET.lists + 1);
    await st.until(DAY + 60);
    expect((await a.lw.submit({ ...list, orders: [] })).s).toBe(BUDGET.lists + 2);
    await st.run(1);
    oneWorld(st);
  }, 240_000);

  it("off, the budget shapes nothing: parseActs takes an order of any length up to the document's own, as it did", () => {
    const long = { s: 0, at: 5, a: { type: "cancel_bid", truckId: 1, pad: pad(BUDGET.chars) } };
    const list = { s: 1, at: 6, a: { type: "set_standing_orders", orders: [], pad: pad(BUDGET.standing) } };
    expect(parseActs([long, list]).map((r) => r.s)).toEqual([0, 1]);
    expect(parseActs([long, list], BUDGET)).toEqual([]);
    expect(parseActs([cancel(2, 7), { ...list, a: { ...list.a, pad: pad(3000) } }], BUDGET).map((r) => r.s)).toEqual([2, 1]);
  });
});

describe("the shared checkpoint (step 3b): the pages' reports", () => {
  it("the reports are one collection, read once a round; a report counts, either way, only from an account whose company is in the cut, only over the cut's own records, only for the last days, and not from an account ignored for good; a day computed again in answer to a report never starts from this browser's own cut", async () => {
    const s = await started({ players: ["alice", "bob", "mallory"], ownerOptions: { cuts: memoryCuts(), keep: { days: 1 } } });
    const { st, owner, a, b } = s;
    const world = owner.lw.worldKey();
    const t1 = await kept1(s);
    st.close(s.players.pop()!);
    await st.until(2 * DAY + G);
    for (const p of st.pages) await ownHash(p, 2);
    const rh = rhOf(owner, 2);
    const report = (hash: string, records = rh, more: unknown[] = []) => ({ v: 1, world, build: REPLAY_BUILD, days: [{ day: 2, hash, rh: records, from: "seed" }, ...more] });
    await st.round(a);
    await st.round(owner);
    const body = parsePointer(await st.doc("world/checkpoint")).bodies[0]!;
    expect([body.day, body.rh]).toEqual([2, rh]);
    // Two accounts with no company, one agreeing and one not; and Mallory's page, which computed the day over other records.
    await st.db.doc(`${DAYS_PATH}/ghost`).set(report(body.hash));
    await st.db.doc(`${DAYS_PATH}/ghoul`).set(report("e".repeat(64)));
    await st.db.doc(`${DAYS_PATH}/mallory`).set(report("d".repeat(64), "c".repeat(64)));
    const w = watched(st.db);
    (owner.keeper as unknown as { db: DbLike }).db = w.db;
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(w.seen.filter((p) => p === DAYS_PATH).length).toBe(1);
    expect(w.seen.filter((p) => p.startsWith(`${DAYS_PATH}/`) || p.includes("/x/days"))).toEqual([]);
    // One player's page agrees, of three: not kept. Nothing else counted, and nothing is on the alarm.
    expect(await st.trust(2)).toBeNull();
    expect(await st.doc("world/alarm")).toBeUndefined();
    // Her page over the cut's own records, with another hash for day 2, and for day 1, which is past the days read.
    await st.db.doc(`${DAYS_PATH}/mallory`).set(report("d".repeat(64), rh, [{ day: 1, hash: "d".repeat(64), rh: t1.rh, from: "seed" }]));
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(parseAlarm(await st.doc("world/alarm"), world).open.map((o) => [o.day, o.uid])).toEqual([[2, "mallory"]]);
    // The owner's page computes day 2 again from day 1's kept body, though this browser has its own cut of that minute.
    expect([owner.lw.startedKind, owner.lw.startedFrom]).toEqual(["shared", DAY]);
    await ownHash(owner, 2);
    await st.round(owner);
    expect(parseAlarm(await st.doc("world/alarm"), world).stood).toEqual([{ day: 2, hash: body.hash }]);
    // Ignored for good, her reports count for no day: Bob's page reports, and the cut is kept.
    await owner.keeper.ignore("mallory");
    await st.round(b);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect((await st.trust(2))!.by).toEqual(["alice", "bob"]);
    const alarm = parseAlarm(await st.doc("world/alarm"), world);
    expect([alarm.open, alarm.ignored]).toEqual([[], [{ uid: "mallory" }]]);
    oneWorld(st);
  }, 360_000);
});

describe("the shared checkpoint (step 3b): reading the archives", () => {
  it("an archive read that fails is tried three times, waiting longer each time; then the page stops with a reason a reload may clear", async () => {
    const s = await started();
    const { st } = s;
    await kept1(s);
    let failing = 2;
    const tries: number[] = [];
    const flaky: DbLike = {
      collection: (p) => st.db.collection(p),
      doc: (p) =>
        p.startsWith(ARC_PATH)
          ? {
              ...st.db.doc(p),
              get: async () => {
                tries.push(Date.now());
                if (failing-- > 0) throw new Error("no network");
                return st.db.doc(p).get();
              },
            }
          : st.db.doc(p),
    };
    const ok = await st.open("dave", { bodies: memoryBodies(), db: flaky, retryMs: [30, 90] });
    expect([ok.lw.startedKind, ok.lw.broken]).toEqual(["seed", null]);
    expect(tries.length).toBe(3);
    expect(tries[1]! - tries[0]!).toBeGreaterThanOrEqual(25);
    expect(tries[2]! - tries[1]!).toBeGreaterThanOrEqual(80);
    oneWorld(st);
    failing = Infinity;
    const stopped = await st.open("erin", { bodies: memoryBodies(), db: flaky });
    expect(tries.length).toBe(6);
    expect(stopped.lw.broken).toMatchObject({ reload: true });
    expect(stopped.lw.broken!.reason).toMatch(/archive of minutes 0 to 1440 couldn't be read/);
    expect(PENDING.liveHistoryUnread(stopped.lw.broken!.reason)).toMatch(/Reload the page/);
    st.close(stopped);
  }, 240_000);

  it("a page from the seed takes the archives six at a time as its replay reaches them, and holds no record of one once it has passed it", async () => {
    const days = 8;
    const meta: WorldMeta = { v: 1, seed: 4242, epochMs: 0, msPerGameHour: MS_PER_GAME_HOUR, ruleset: RULESET };
    const world = `${meta.seed}:${meta.epochMs}:${meta.ruleset}`;
    const now = (days * DAY + 6 * 60) * MIN;
    const db = new MemoryDb(() => now);
    await db.doc("world/meta").set({ ...meta });
    // A store with a kept cut a day, each day's archive one company's join.
    let rh = RH0;
    for (let d = 1; d <= days; d++) {
      const line = recLine(`u${d}`, parseActs([join(0, (d - 1) * DAY + 100, `Seed Co ${d}`, d % starters.length)])[0]);
      rh = rollHash(rh, [line]);
      const { ref, docs } = await arcDocs(world, (d - 1) * DAY, d * DAY, line, 1);
      for (const [path, body] of docs) await db.doc(path).set(body);
      await db.doc(`world/cpm-${d}`).set({ v: 2, world, build: "another", day: d, t: d * DAY, hash: "a".repeat(64), by: [], at: 0, rh, arc: { ...ref } });
    }
    const readAt: number[] = [];
    const page: { lw?: LiveWorld } = {};
    const store: DbLike = { collection: (p) => db.collection(p), doc: (p) => (p.startsWith(ARC_PATH) && readAt.push(page.lw!.w.t), db.doc(p)) };
    page.lw = await LiveWorld.open(store, meta, null, { now: () => now, shared: { bodies: memoryBodies(false) } });
    const lw = page.lw;
    await lw.rebuild();
    expect(lw.broken).toBeNull();
    expect(lw.w.companies.filter((c) => c.name.startsWith("Seed Co")).length).toBe(days);
    // Six archives before the first day is computed, the other two once the sixth day is.
    expect(readAt.length).toBe(days);
    expect(new Set(readAt.slice(0, 6)).size).toBe(1);
    expect(readAt.slice(6)).toEqual([readAt[0]! + 6 * DAY, readAt[0]! + 6 * DAY]);
    const held = lw as unknown as { queue: unknown[]; logs: Map<string, Map<number, unknown>>; arcs?: unknown };
    expect([held.queue.length, [...held.logs.values()].reduce((n, log) => n + log.size, 0), held.arcs]).toEqual([0, 0, undefined]);
    lw.close();
  }, 120_000);

  it("an archive's documents are named by its text, and its further parts by its packing: the same text packed otherwise, already in the store, is read and not written again; this page's own packing written beside it, the archive reads whole; another text for the same minutes shares no document with it", async () => {
    const s = await started({ ownerOptions: { keep: { arcPartChars: 60 } } });
    const { st, owner } = s;
    const world = owner.lw.worldKey();
    const arc = owner.lw.arcText(DAY, rhOf(owner, 1));
    if (!arc || arc === "days") throw new Error("the owner's page doesn't hold day 1's records");
    // The day's archive as the owner's page will pack it, and packed another way (not compressed), in more parts.
    const { ref, docs } = await arcDocs(world, 0, DAY, arc.text, arc.n, 60);
    const z = gzipSync(arc.text, { level: 0 }).toString("base64");
    const pieces = z.match(/.{1,60}/g)!;
    const key = "0123456789abcdef";
    expect(pieces.length).toBeGreaterThan(ref.parts);
    expect(ref.parts).toBeGreaterThan(2);
    for (let i = pieces.length - 1; i >= 1; i--) await st.db.doc(arcDocPath(ref, i, key)).set({ v: 1, world, from: 0, i, z: pieces[i]! });
    await st.db.doc(arcDocPath(ref)).set({ v: 1, world, from: 0, to: DAY, n: arc.n, hash: ref.hash, parts: pieces.length, bytes: z.length, key, z: pieces[0]! });
    const ids = async () => (await st.db.collection(ARC_PATH).get()).docs.map((d) => `${ARC_PATH}/${d.id}`).sort();
    const other = await ids();
    expect(other.length).toBe(pieces.length);
    const writes: string[] = [];
    const real = st.db.doc.bind(st.db);
    st.db.doc = (p) => ({ ...real(p), set: (data) => (writes.push(p), real(p).set(data)) });
    const trust = await kept1(s);
    expect(trust.arc.hash).toBe(ref.hash);
    expect(writes.filter((p) => p.startsWith(ARC_PATH))).toEqual([]);
    expect(await ids()).toEqual(other);
    const fromSeed = await st.open("dave", { bodies: memoryBodies() });
    expect([fromSeed.lw.startedKind, fromSeed.lw.broken]).toEqual(["seed", null]);
    oneWorld(st);
    // This page's own packing beside it: the head names its own parts now, and the other packing's are as they were.
    for (const [path, body] of docs) await st.db.doc(path).set(body);
    expect((await ids()).length).toBe(pieces.length + ref.parts - 1);
    expect(docs.map((d) => d[0]).filter((p) => other.includes(p))).toEqual([arcDocPath(ref)]);
    expect(await readArc(st.db, trust.arc)).toBe(arc.text);
    const again = await st.open("erin", { bodies: memoryBodies() });
    expect([again.lw.startedKind, again.lw.broken]).toEqual(["seed", null]);
    oneWorld(st);
    // Another text for the same minutes: no document of it is one of these.
    const text2 = JSON.stringify(["zed", cancel(0, 500)]);
    const two = await arcDocs(world, 0, DAY, text2, 1, 60);
    const here = await ids();
    expect(two.docs.map((d) => d[0]).filter((p) => here.includes(p))).toEqual([]);
    for (const [path, body] of two.docs) await st.db.doc(path).set(body);
    expect(await readArc(st.db, trust.arc)).toBe(arc.text);
    expect(await readArc(st.db, two.ref)).toBe(text2);
  }, 240_000);
});

describe("the shared checkpoint (step 3b): a page's own housekeeping", () => {
  it("a page whose subscription to the world's documents failed subscribes again; closed, it doesn't", async () => {
    const st = new Stage();
    let subs = 0;
    let fail: ((e: { code: string }) => void) | undefined;
    const db: DbLike = {
      doc: (p) => st.db.doc(p),
      collection: (p) => {
        const c = st.db.collection(p);
        return p === "world" ? { ...c, onSnapshot: (next, err) => (subs++, (fail = err), c.onSnapshot(next, err)) } : c;
      },
    };
    const a = await st.open("alice", { db });
    expect(subs).toBe(1);
    vi.useFakeTimers();
    try {
      fail!({ code: "unavailable" });
      vi.advanceTimersByTime(6000);
      expect(subs).toBe(2);
      fail!({ code: "unavailable" });
      a.lw.close();
      vi.advanceTimersByTime(6000);
      expect(subs).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  }, 60_000);

  it("off, a page reads no report and no archive, writes no next number, and sends an order of any length it did", async () => {
    const st = new Stage();
    await st.db.doc(`${DAYS_PATH}/zed`).set({ v: 1, world: "w", build: "b", days: [] });
    await st.db.doc(arcDocPath({ from: 0, hash: "a".repeat(64) })).set({ v: 1, z: "" });
    const w = watched(st.db);
    const a = await st.open("alice", { shared: false, db: w.db });
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await st.run(2);
    await a.lw.submit({ type: "cancel_bid", truckId: 1, pad: pad(BUDGET.chars) } as never);
    await st.until(DAY + G);
    expect(w.seen.length).toBeGreaterThan(0);
    expect(w.seen.filter((p) => p === DAYS_PATH || p.startsWith(`${DAYS_PATH}/`) || p === "world" || p.startsWith("world/"))).toEqual([]);
    const doc = (await st.doc("players/alice")) as { acts: unknown[] };
    expect(Object.keys(doc).sort()).toEqual(["acts", "archived", "v"]);
    expect(doc.acts.length).toBe(2);
  }, 120_000);
});
