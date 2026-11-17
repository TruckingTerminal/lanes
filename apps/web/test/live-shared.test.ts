import "./seed.js";
import { describe, expect, it } from "vitest";
import { hubs } from "@lanes/data";
import { encodeWorld, hubMiles, type Action, type World } from "@lanes/engine";
import { BODY_MAX_BYTES, countsUnder, cutExtras, cutText, keptCuts, marksDoc, marksKey, memoryBodies, memoryCuts, noAlarm, packBody, parseAlarm, parseDays, parseMarks, parsePointer, parseTrust, readCut, REPLAY_BUILD, sha256, unpackBody } from "../src/cuts.js";
import type { BodyStore, CutStore, Marks, TrustDoc } from "../src/cuts.js";
import { RULESET } from "../src/game.js";
import { assetBodies, KEEP, Keeper, SHARED_CUTS } from "../src/keeper.js";
import { LiveWorld, MS_PER_GAME_HOUR, type CollLike, type DbLike, type DocLike, type LiveAction, type SnapLike, type WorldMeta } from "../src/live.js";
import { MemoryDb } from "../src/memdb.js";
import { liveDays } from "../../sim/src/liveDays.js";

/**
 * The checkpoint's step 3 (cuts.ts, live.ts, keeper.ts; engineering-checkpoint-design-2026-11-16.md §4 for this step, and
 * the red team's checkpoint review): the owner's page writes a day's cut, two other players' own hashes make it kept, a page
 * starts from its body and computes the same world as a page from the seed; a record stamped before a kept cut and not in
 * it is never applied, on any page, wherever its replay starts.
 */
const MIN = MS_PER_GAME_HOUR / 60;
const DAY = 24 * 60;
const G = KEEP.graceMin;
const starters = hubs.filter((h) => h.isStarter).map((h) => h.id);
const beat = () => new Promise((r) => setTimeout(r, 0));
/** The world and what a cut carries beside it (the bots' state, the month books, the truck numbers). */
const enc = (w: World) => encodeWorld(w, cutExtras(w));

interface Page {
  uid: string;
  lw: LiveWorld;
  keeper: Keeper;
}
interface OpenOptions {
  owner?: boolean;
  /** false: a page with the shared checkpoint off (as the live page is today). */
  shared?: boolean;
  cuts?: CutStore;
  bodies?: BodyStore;
  db?: DbLike;
  keep?: Partial<typeof KEEP>;
}

/** One store, one clock, and the pages open on them. */
class Stage {
  clock = 6 * MS_PER_GAME_HOUR;
  readonly now = () => this.clock;
  readonly db = new MemoryDb(this.now);
  readonly bodies = memoryBodies();
  readonly meta: WorldMeta;
  pages: Page[] = [];
  private tabs = 0;
  /** The store holds world/meta, as the live one does (no page of these writes it: the owner's opened the world long ago). */
  private readonly opened: Promise<void>;
  constructor(seed = 4242) {
    this.meta = { v: 1, seed, epochMs: 0, msPerGameHour: MS_PER_GAME_HOUR, ruleset: RULESET };
    this.opened = this.db.doc("world/meta").set({ ...this.meta });
  }
  minute(): number {
    return this.clock / MIN;
  }
  async open(uid: string, o: OpenOptions = {}): Promise<Page> {
    await this.opened;
    const db = o.db ?? this.db;
    const bodies = o.bodies ?? this.bodies;
    const owner = o.owner === true;
    const lw = await LiveWorld.open(db, this.meta, uid, { now: this.now, mono: this.now, holder: `tab-${uid}-${this.tabs++}`, manualRenewal: true, owner, ...(o.cuts ? { cuts: o.cuts } : {}), ...(o.shared === false ? {} : { shared: { bodies, keepText: owner } }) });
    await lw.rebuild();
    const p: Page = { uid, lw, keeper: new Keeper(lw, db, bodies, { owner, now: this.now, ...o.keep }) };
    this.pages.push(p);
    return p;
  }
  close(p: Page): void {
    p.lw.close();
    this.pages = this.pages.filter((x) => x !== p);
  }
  /** Every page hears what the store has to tell it, replays if it must, and keeps up with the clock. */
  async settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await beat();
      for (const p of this.pages) {
        if (p.lw.needRebuild) await p.lw.rebuild();
        p.lw.advance(1e9);
      }
    }
  }
  /** The clock moves on `hours` game hours. */
  async run(hours: number, each?: (hour: number) => Promise<void>): Promise<void> {
    for (let h = 0; h < hours; h++) {
      this.clock += 60 * MIN;
      await this.settle();
      if (each) await each(h);
    }
  }
  /** To a game minute. */
  async until(minute: number): Promise<void> {
    await this.run(Math.round((minute - this.minute()) / 60));
  }
  /** A keeper's round on each page given (all, with none given): the lease renewed first, since this clock moves an hour at a time. */
  async round(...pages: Page[]): Promise<void> {
    for (const p of pages.length ? pages : this.pages) {
      await p.lw.renewLease();
      await p.keeper.tick();
      await this.settle();
    }
  }
  async doc(path: string): Promise<Record<string, unknown> | undefined> {
    return (await this.db.doc(path).get()).data();
  }
  async trust(day: number): Promise<TrustDoc | null> {
    return parseTrust(await this.doc(`world/cpm-${day}`));
  }
}

/** A page's own hash of a day, once hashed. */
async function ownHash(p: Page, day: number): Promise<string> {
  for (let i = 0; i < 400; i++) {
    const c = p.lw.ownDays().find((x) => x.day === day);
    if (c?.hash) return c.hash;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`${p.uid} has no hash of day ${day}`);
}

/** A plausible bid for one of this player's idle trucks, read off that player's own world. */
function bidFor(lw: LiveWorld): Action | null {
  const w = lw.w;
  for (const t of w.trucksByCompany.get(lw.player!.id) ?? []) {
    if (t.status !== "idle") continue;
    for (const l of w.loads.values()) if (l.status === "open" && l.equipment === t.trailer && hubMiles(w, t.hub, l.origin) <= 300) return { type: "place_bid", truckId: t.id, loadId: l.id, rate: l.refRate * 0.97 };
  }
  return null;
}

/**
 * The usual start: the owner's page and two players' pages, both joined, run to six game hours past the first day boundary,
 * every page having hashed that day. Nothing is reported or written yet.
 */
async function started(o: { seed?: number; ownerOptions?: OpenOptions; players?: string[] } = {}) {
  const st = new Stage(o.seed);
  const owner = await st.open("olga", { owner: true, ...o.ownerOptions });
  const names = o.players ?? ["alice", "bob"];
  const players: Page[] = [];
  for (const [i, uid] of names.entries()) {
    const p = await st.open(uid);
    await p.lw.submit({ type: "join", name: `${uid} Haul`, hub: starters[i % starters.length]! });
    players.push(p);
  }
  await st.until(DAY + G);
  for (const p of st.pages) await ownHash(p, 1);
  return { st, owner, players, a: players[0]!, b: players[1]! };
}

/** The owner's page writes day 1's cut and, with the two players' reports in, keeps it. */
async function kept1(s: Awaited<ReturnType<typeof started>>): Promise<TrustDoc> {
  await s.st.round(...s.players);
  await s.st.round(s.owner); // the body, then its pointer
  await s.st.round(s.owner); // the reports read: the trust document
  const t = await s.st.trust(1);
  expect(t).not.toBeNull();
  return t!;
}

describe("the shared checkpoint (step 3): the switch", () => {
  it("is off, with the red team's grace and two confirmers", () => {
    expect(SHARED_CUTS).toBe(false);
    expect(KEEP.graceMin).toBe(6 * 60);
    expect(KEEP.confirmers).toBe(2);
    expect(KEEP.fewPlayers).toBe(false);
  });

  it("off, a page reads and writes no document of step 3", async () => {
    const seen: string[] = [];
    const st = new Stage();
    const spy: DbLike = {
      doc: (path) => {
        seen.push(path);
        return st.db.doc(path);
      },
      collection: (path) => {
        seen.push(path);
        return st.db.collection(path);
      },
    };
    const a = await st.open("alice", { shared: false, db: spy });
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await st.until(DAY + G);
    await st.run(2);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.filter((p) => p === "world" || p.startsWith("world/") || p.endsWith("/x/days"))).toEqual([]);
    expect(a.lw.ownDays()).toEqual([]);
    expect(a.lw.startedKind).toBe("seed");
  }, 120_000);
});

describe("the shared checkpoint (step 3): written, kept, and started from", () => {
  it("the owner's page writes the day's cut six game hours on; two other players' hashes keep it; a new page starts from its body and computes the seed's world, then stays in step", async () => {
    const st = new Stage();
    const owner = await st.open("olga", { owner: true });
    const a = await st.open("alice");
    const b = await st.open("bob");
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await b.lw.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });
    const meta = JSON.stringify(await st.doc("world/meta"));
    expect(JSON.parse(meta)).toEqual(st.meta);

    // An hour short of the grace: every page has hashed the day, and nothing is said or written.
    await st.until(DAY + G - 60);
    for (const p of st.pages) await ownHash(p, 1);
    await st.round();
    await st.round();
    expect(await st.doc("players/alice/x/days")).toBeUndefined();
    expect(await st.doc("world/checkpoint")).toBeUndefined();
    expect(st.bodies.bodies.size).toBe(0);

    // At the grace the owner's page writes the body, then its pointer; nobody else has reported, so it isn't kept.
    await st.until(DAY + G);
    await st.round(owner);
    const pointer = parsePointer(await st.doc("world/checkpoint"));
    expect(pointer.bodies.map((x) => [x.day, x.t, x.build])).toEqual([[1, DAY, REPLAY_BUILD]]);
    const body = pointer.bodies[0]!;
    expect(body.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.hash).toBe(await ownHash(owner, 1));
    expect(st.bodies.bodies.size).toBe(1);
    await st.round(owner);
    expect(await st.trust(1)).toBeNull();
    // The body is the cut's text, packed: its hash is the pointer's, and its first line carries the cut (finding 4).
    const text = (await unpackBody(st.bodies.bodies.get(body.asset)!))!;
    expect(await sha256(text)).toBe(body.hash);
    const cut = readCut(text)!;
    expect(cut.line).toMatchObject({ v: 1, world: owner.lw.worldKey(), build: REPLAY_BUILD, t: DAY });
    expect(cut.line.marks).toEqual([["alice", 0, 1], ["bob", 0, 1]]);
    expect(cut.line.companies.map((c) => c[0]).sort()).toEqual(["alice", "bob"]);

    // The owner's own hash never counts, and one other player's isn't enough.
    await st.round(a);
    const report = parseDays(await st.doc("players/alice/x/days"))!;
    expect(report).toMatchObject({ world: owner.lw.worldKey(), build: REPLAY_BUILD });
    expect(report.days).toEqual([{ day: 1, hash: body.hash, from: "seed" }]);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(await st.trust(1)).toBeNull();
    // A page opened now starts from the seed: the body isn't kept yet.
    const early = await st.open("erin");
    expect(early.lw.startedKind).toBe("seed");
    st.close(early);

    // The second player's makes it kept.
    await st.round(b);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    const trust = (await st.trust(1))!;
    expect(trust).toMatchObject({ day: 1, t: DAY, hash: body.hash, build: REPLAY_BUILD, by: ["alice", "bob"] });
    expect(trust.marks).toEqual(cut.line.marks);
    // In the store a trust document's marks are objects, never an array inside an array.
    expect(((await st.doc("world/cpm-1")) as { marks: unknown[] }).marks).toEqual([{ u: "alice", s: 0, n: 1 }, { u: "bob", s: 0, n: 1 }]);
    // No page replayed for it: each had applied exactly its records.
    for (const p of st.pages) expect(p.lw.needRebuild).toBe(false);

    // The day reports are their own documents (finding 9), the alarm was never needed, and world/meta was never rewritten (finding 8).
    expect(Object.keys((await st.doc("players/alice"))!).sort()).toEqual(["acts", "archived", "v"]);
    expect(await st.doc("world/alarm")).toBeUndefined();
    expect(JSON.stringify(await st.doc("world/meta"))).toBe(meta);

    // A new page starts from the body; a page with the checkpoint off replays from the seed. One world.
    await st.run(3);
    const c = await st.open("carol");
    expect(c.lw.startedKind).toBe("shared");
    expect(c.lw.startedFrom).toBe(DAY);
    const d = await st.open("dave", { shared: false });
    expect(d.lw.startedFrom).toBeNull();
    expect(enc(c.lw.w)).toBe(enc(d.lw.w));
    expect(enc(c.lw.w)).toBe(enc(a.lw.w));
    expect(c.lw.w.companies.filter((x) => x.strategy.startsWith("player:")).length).toBe(2);
    // On through the next boundary, with orders on the way: the page from the body computes the same day as the others.
    await st.run(DAY / 60, async (h) => {
      if (h % 5 !== 2) return;
      for (const p of [a, b]) {
        const bid = bidFor(p.lw);
        if (bid) await p.lw.submit(bid);
      }
    });
    expect(st.minute()).toBeGreaterThan(2 * DAY);
    expect(enc(c.lw.w)).toBe(enc(d.lw.w));
    expect(enc(c.lw.w)).toBe(enc(b.lw.w));
    const day2 = await ownHash(a, 2);
    expect(await ownHash(c, 2)).toBe(day2);
    expect(await ownHash(owner, 2)).toBe(day2);
    expect(c.lw.ownDays().find((x) => x.day === 2)!.from).toBe("cp:1");
    // The page from the body never computed day 1, so it has nothing to say about it.
    expect(c.lw.ownDays().some((x) => x.day === 1)).toBe(false);
  }, 240_000);

  it("the hash is of the whole cut: the same world with other marks, another minute, build, world or companies is another hash", async () => {
    const marks: Marks = [["alice", 3, 4], ["bob", 0, 1]];
    const line = { world: "1:0:r", build: "b1", t: DAY, marks, companies: [["alice", 7]] as [string, number][] };
    const h = await sha256(cutText(line, "{}"));
    const others = [
      { ...line, marks: [["alice", 4, 5], ["bob", 0, 1]] as Marks }, // a refused order moved a mark: the same world
      { ...line, marks: [["alice", 3, 3], ["bob", 0, 1]] as Marks },
      { ...line, t: 2 * DAY },
      { ...line, build: "b2" },
      { ...line, world: "1:0:r2" },
      { ...line, companies: [["alice", 8]] as [string, number][] },
    ];
    for (const o of others) expect(await sha256(cutText(o, "{}"))).not.toBe(h);
    expect(await sha256(cutText(line, "{ }"))).not.toBe(h);
    expect(await sha256(cutText({ ...line }, "{}"))).toBe(h);
    // And a cut's text comes apart again as it went in.
    const back = readCut(cutText(line, '{"a":"x\\ny"}'))!;
    expect(back.line).toEqual({ v: 1, ...line });
    expect(back.encoding).toBe('{"a":"x\\ny"}');
    expect(readCut("no line")).toBeNull();
    expect(readCut('{"v":2}\n{}')).toBeNull();
  });

  it("a body packs to JSON and back exactly, and never unpacks past its cap", async () => {
    const text = cutText({ world: "w", build: "b", t: DAY, marks: [], companies: [] }, JSON.stringify({ big: "x".repeat(200_000), odd: "é\u0000\n" }));
    const packed = await packBody(text);
    expect(JSON.parse(packed)).toMatchObject({ v: 1 });
    expect(packed.length).toBeLessThan(text.length / 20);
    expect(await unpackBody(packed)).toBe(text);
    expect(await unpackBody(packed, 1000)).toBeNull();
    expect(await unpackBody("not json")).toBeNull();
    expect(await unpackBody(JSON.stringify({ v: 1, gz: "AAAA" }))).toBeNull();
    expect(BODY_MAX_BYTES).toBeGreaterThan(64 * 1024 * 1024);
  });
});

describe("the shared checkpoint (step 3): the late-order rule", () => {
  it("countsUnder: before a kept cut, only what that cut had applied; a record an earlier cut left out stays out", () => {
    const doc = (day: number, marks: Marks): TrustDoc => ({ world: "w", build: "b", day, t: day * DAY, hash: `${day}`.padStart(64, "0"), by: ["x", "y"], at: 0, marks });
    const kept = keptCuts([doc(2, [["alice", 9, 10], ["bob", 1, 2]]), doc(1, [["alice", 4, 5]])], noAlarm(), "w");
    expect(kept.map((k) => k.day)).toEqual([1, 2]);
    // Before day 1's cut: alice's first five.
    expect(countsUnder(kept, "alice", 4, DAY - 1)).toBe(true);
    expect(countsUnder(kept, "alice", 5, DAY - 1)).toBe(false); // late then, and out for good though her mark is 9 a day on
    expect(countsUnder(kept, "bob", 0, 100)).toBe(false); // bob had nothing in day 1's cut
    // Between the two cuts: day 2's marks.
    expect(countsUnder(kept, "alice", 9, DAY)).toBe(true); // stamped at the boundary itself: after the cut
    expect(countsUnder(kept, "alice", 10, 2 * DAY - 1)).toBe(false);
    expect(countsUnder(kept, "bob", 1, DAY + 5)).toBe(true);
    // At or after the newest kept cut: always, whatever the sequence number (finding 6).
    expect(countsUnder(kept, "carol", 0, 2 * DAY)).toBe(true);
    expect(countsUnder(kept, "alice", 2, 2 * DAY + 500)).toBe(true);
    expect(countsUnder([], "anyone", 99, 0)).toBe(true);
    // Another world's trust document, and a barred cut, keep nothing.
    expect(keptCuts([doc(1, [])], noAlarm(), "another")).toEqual([]);
    expect(keptCuts([doc(1, [])], { ...noAlarm(), barred: [{ day: 1, hash: "1".padStart(64, "0") }] }, "w")).toEqual([]);
  });

  it("a record stamped before a kept cut and not in it is never applied and never replays a page: on pages that ran through it, a page from the body, and a page from the seed", async () => {
    const s = await started();
    const { st, owner, a, b } = s;
    await kept1(s);
    const c = await st.open("carol"); // from the body
    expect(c.lw.startedKind).toBe("shared");
    const before = enc(a.lw.w);
    const rebuilds = new Map(st.pages.map((p) => [p, 0]));
    for (const p of st.pages) {
      const real = p.lw.rebuild.bind(p.lw);
      p.lw.rebuild = async (f) => {
        rebuilds.set(p, rebuilds.get(p)! + 1);
        return real(f);
      };
    }
    // A held write lands, or a stamp is forged: Erin's join, stamped two hours before the boundary.
    await st.db.doc("players/erin").set({ v: 1, acts: [{ s: 0, at: DAY - 120, a: { type: "join", name: "Erin Late", hub: starters[2]!, look: "m" } }], archived: 0 });
    await st.settle();
    for (const p of st.pages) {
      expect(rebuilds.get(p), p.uid).toBe(0);
      expect(p.lw.needRebuild).toBe(false);
      expect(p.lw.w.companies.some((x) => x.name === "Erin Late")).toBe(false);
      expect(enc(p.lw.w)).toBe(before);
    }
    // A page that can't read the body replays from the seed, under the kept cut's marks (finding 7): the same world.
    const noBodies = memoryBodies();
    const fromSeed = await st.open("frank", { bodies: noBodies });
    expect(fromSeed.lw.startedKind).toBe("seed");
    expect(fromSeed.lw.w.companies.some((x) => x.name === "Erin Late")).toBe(false);
    expect(enc(fromSeed.lw.w)).toBe(before);
    // A page with the checkpoint off applies it: that is today's page, and why the rule needs every page on it.
    const plain = await st.open("gina", { shared: false });
    expect(plain.lw.w.companies.some((x) => x.name === "Erin Late")).toBe(true);
    st.close(plain);

    // Erin's next order, stamped after the cut, counts on every page, whatever its number (finding 6).
    const at = Math.ceil(st.minute()) + 5;
    await st.db.doc("players/erin").set({ v: 1, acts: [{ s: 0, at: DAY - 120, a: { type: "join", name: "Erin Late", hub: starters[2]!, look: "m" } }, { s: 1, at, a: { type: "join", name: "Erin Again", hub: starters[2]!, look: "m" } }], archived: 0 });
    await st.run(1);
    for (const p of st.pages) expect(p.lw.w.companies.some((x) => x.name === "Erin Again"), p.uid).toBe(true);
    expect(enc(c.lw.w)).toBe(enc(a.lw.w));
    expect(enc(fromSeed.lw.w)).toBe(enc(a.lw.w));
    expect(enc(owner.lw.w)).toBe(enc(b.lw.w));
    // The next day's cut carries the late record's absence: erin's mark is her second order's, with one applied.
    await st.until(2 * DAY + G);
    const day2 = await ownHash(a, 2);
    for (const p of [owner, b, c, fromSeed]) expect(await ownHash(p, 2), p.uid).toBe(day2);
    await st.round();
    await st.round(owner);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    const t2 = (await st.trust(2))!;
    expect(t2.marks.find((m) => m[0] === "erin")).toEqual(["erin", 1, 1]);
    // A page from the seed now reads both kept cuts: the first leaves Erin's first order out though her mark has passed it.
    const later = await st.open("hana", { bodies: noBodies });
    expect(later.lw.startedKind).toBe("seed");
    expect(later.lw.w.companies.some((x) => x.name === "Erin Late")).toBe(false);
    expect(enc(later.lw.w)).toBe(enc(a.lw.w));
  }, 240_000);

  it("a log forged out of order: sequence 10 before the cut and 9 after it; every page applies 9 (finding 6)", async () => {
    const st = new Stage();
    const owner = await st.open("olga", { owner: true });
    const a = await st.open("alice");
    const b = await st.open("bob");
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await b.lw.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });
    // In the store before the boundary: number 10 stamped before it (an order for no company: refused, and applied), number 9 after it.
    await st.db.doc("players/zed").set({ v: 1, acts: [{ s: 9, at: DAY + G + 90, a: { type: "join", name: "Zed Nine", hub: starters[2]!, look: "m" } }, { s: 10, at: DAY - 200, a: { type: "cancel_bid", truckId: 1 } }], archived: 0 });
    await st.until(DAY + G);
    for (const p of st.pages) await ownHash(p, 1);
    const s = { st, owner, players: [a, b], a, b };
    const trust = await kept1(s);
    expect(trust.marks.find((m) => m[0] === "zed")).toEqual(["zed", 10, 1]);
    const c = await st.open("carol");
    expect(c.lw.startedKind).toBe("shared");
    const seed = await st.open("dave", { bodies: memoryBodies() });
    expect(seed.lw.startedKind).toBe("seed");
    await st.run(3);
    for (const p of st.pages) expect(p.lw.w.companies.some((x) => x.name === "Zed Nine"), p.uid).toBe(true);
    expect(enc(c.lw.w)).toBe(enc(a.lw.w));
    expect(enc(seed.lw.w)).toBe(enc(a.lw.w));
  }, 240_000);

  it("history before a kept cut is frozen: an old order rewritten or erased in the store replays no page from the body (finding 7)", async () => {
    const s = await started();
    const { st, a } = s;
    // A third player's two orders before the boundary, in the store in time.
    const acts = [
      { s: 0, at: 400, a: { type: "join", name: "Ivan Old", hub: starters[2]!, look: "m" } },
      { s: 1, at: 500, a: { type: "cancel_bid", truckId: 1 } },
      { s: 2, at: 600, a: { type: "cancel_bid", truckId: 2 } },
    ];
    await st.db.doc("players/ivan").set({ v: 1, acts, archived: 0 });
    await st.settle();
    for (const p of st.pages) await ownHash(p, 1);
    await kept1(s);
    const c = await st.open("carol");
    expect(c.lw.startedKind).toBe("shared");
    expect(c.lw.w.companies.some((x) => x.name === "Ivan Old")).toBe(true);
    const world = enc(c.lw.w);
    // Rewritten (another body under number 1), then erased (number 1 gone, number 2 rewritten: the erasing write's mark).
    await st.db.doc("players/ivan").set({ v: 1, acts: [acts[0], { s: 1, at: 500, a: { type: "cancel_bid", truckId: 99 } }, acts[2]], archived: 0 });
    await st.settle();
    expect(c.lw.needRebuild).toBe(false);
    await st.db.doc("players/ivan").set({ v: 1, acts: [acts[0], { s: 2, at: 600, a: { type: "cancel_bid", truckId: 98 } }], archived: 0 });
    await st.settle();
    expect(c.lw.needRebuild).toBe(false);
    expect(enc(c.lw.w)).toBe(world);
    expect(enc(c.lw.w)).toBe(enc(a.lw.w));
  }, 240_000);

  it("a player's own order that reached the store after the cut was kept: said once, never carried out, and the page doesn't replay (finding 5)", async () => {
    const st = new Stage();
    // Alice's page writes through a store that can hold her orders document's writes.
    let held: (() => void)[] | null = null;
    const slow: DbLike = {
      collection: (p) => st.db.collection(p),
      doc: (p) => {
        const d = st.db.doc(p);
        if (p !== "players/alice") return d;
        return { ...d, set: (data) => (held ? new Promise<void>((res) => held!.push(() => void d.set(data).then(res))) : d.set(data)) };
      },
    };
    const owner = await st.open("olga", { owner: true });
    const a = await st.open("alice", { db: slow });
    const b = await st.open("bob");
    const c0 = await st.open("carol");
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await b.lw.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });
    await c0.lw.submit({ type: "join", name: "Carol Cartage", hub: starters[2]! });
    await st.until(DAY - 60);
    // An hour before the boundary Alice gives an order; the network holds its write.
    held = [];
    const told: number[] = [];
    a.lw.onLate = (r) => told.push(r.s);
    const sending = a.lw.submit({ type: "cancel_bid", truckId: 1 });
    for (let i = 0; i < 50 && held.length === 0; i++) await beat();
    expect(held.length).toBe(1);
    await st.until(DAY + G);
    for (const p of st.pages) await ownHash(p, 1);
    // The owner's page reads the store itself: Alice's order isn't in it, and the cut is made and kept without it.
    await st.round(b, c0);
    await st.round(owner);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    const trust = (await st.trust(1))!;
    expect(trust.by).toEqual(["bob", "carol"]);
    expect(trust.marks.find((m) => m[0] === "alice")).toEqual(["alice", 0, 1]);
    // The write lands, stamped an hour before the boundary.
    const release = held;
    held = null;
    for (const f of release) f();
    const sent = await sending;
    expect(sent.at).toBeLessThan(DAY);
    await st.settle();
    expect(told).toEqual([sent.s]);
    for (const p of st.pages) expect(p.lw.needRebuild, p.uid).toBe(false);
    expect(enc(a.lw.w)).toBe(enc(b.lw.w));
    // Said once, however often the store repeats it.
    await st.run(2);
    expect(told).toEqual([sent.s]);
    expect(a.lw.pending()).toEqual([]);
  }, 240_000);
});

describe("the shared checkpoint (step 3): the owner's page reads the store itself before it writes (finding 5)", () => {
  it("an order the owner's page hadn't heard is read, the day computed again, and the cut carries it", async () => {
    const st = new Stage();
    // The owner's page hears nothing of the players' collection after its first snapshot.
    let deaf = false;
    const quiet: DbLike = {
      doc: (p) => st.db.doc(p),
      collection: (p): CollLike => {
        const c = st.db.collection(p);
        if (p !== "players") return c;
        return { get: () => c.get(), onSnapshot: (next, err) => c.onSnapshot((snap) => (deaf ? undefined : next(snap)), err) };
      },
    };
    const owner = await st.open("olga", { owner: true, db: quiet });
    const a = await st.open("alice");
    const b = await st.open("bob");
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await b.lw.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });
    await st.until(DAY - 120);
    deaf = true;
    const order = await b.lw.submit({ type: "cancel_bid", truckId: 1 });
    expect(order.at).toBeLessThan(DAY);
    await st.until(DAY + G);
    for (const p of st.pages) await ownHash(p, 1);
    const theirs = await ownHash(a, 1);
    expect(await ownHash(owner, 1)).not.toBe(theirs); // the owner's page computed the day without Bob's order
    // Its round reads the store, finds the order, writes nothing, and computes the day again.
    await st.round(owner);
    expect(await st.doc("world/checkpoint")).toBeUndefined();
    expect(st.bodies.bodies.size).toBe(0);
    expect(await ownHash(owner, 1)).toBe(theirs);
    await st.round(a, b);
    await st.round(owner);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    const trust = (await st.trust(1))!;
    expect(trust.hash).toBe(theirs);
    expect(trust.marks.find((m) => m[0] === "bob")).toEqual(["bob", order.s, order.s + 1]);
  }, 240_000);

  it("a saved copy of the players' orders isn't an answer: nothing is written until the store itself answers", async () => {
    const st = new Stage();
    let cached = true;
    const mark = <T extends object>(x: T): T => (cached ? { ...x, metadata: { fromCache: true } } : x);
    const stale: DbLike = {
      doc: (p): DocLike => {
        const d = st.db.doc(p);
        return p.startsWith("players/") && p.split("/").length === 2 ? { ...d, get: async () => mark(await d.get()) as SnapLike } : d;
      },
      collection: (p): CollLike => {
        const c = st.db.collection(p);
        return p === "players" ? { ...c, get: async () => mark(await c.get()) } : c;
      },
    };
    const owner = await st.open("olga", { owner: true, db: stale });
    const a = await st.open("alice");
    const b = await st.open("bob");
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await b.lw.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });
    await st.until(DAY + G);
    for (const p of st.pages) await ownHash(p, 1);
    await st.round(owner);
    await st.round(owner);
    expect(await st.doc("world/checkpoint")).toBeUndefined();
    expect(owner.keeper.note).toMatch(/saved copy/);
    cached = false;
    await st.round(owner);
    expect(parsePointer(await st.doc("world/checkpoint")).bodies.length).toBe(1);
  }, 240_000);
});

describe("the shared checkpoint (step 3): a body left in the store (finding 5)", () => {
  it("a body from days ago, with reports that matched it then, is never kept over an order every page has applied since", async () => {
    const s = await started();
    const { st, owner, a, b } = s;
    await st.round(a, b);
    await st.round(owner); // the body and its pointer; the owner's page is closed before it reads the reports
    const body = parsePointer(await st.doc("world/checkpoint")).bodies[0]!;
    st.close(owner);
    // An order stamped before the boundary lands. Nothing is kept, so every page applies it (their reports stay as they were:
    // those pages are closed before they report again).
    await st.db.doc("players/erin").set({ v: 1, acts: [{ s: 0, at: DAY - 120, a: { type: "join", name: "Erin Late", hub: starters[2]!, look: "m" } }], archived: 0 });
    await st.settle();
    for (const p of [a, b]) expect(p.lw.w.companies.some((x) => x.name === "Erin Late")).toBe(true);
    // Three days on the owner's page opens again: day 1 is too far back for it to compute again on the way.
    await st.until(3 * DAY + G);
    const again = await st.open("olga", { owner: true });
    await ownHash(again, 3);
    expect(again.lw.ownDays().map((c) => c.day)).toEqual([3, 2]);
    await st.round(again);
    again.keeper["nextReadAt"] = 0;
    await st.round(again);
    const pointer = parsePointer(await st.doc("world/checkpoint"));
    expect(pointer.bodies.map((x) => x.day)).toEqual([3, 1]);
    expect(pointer.bodies[1]!.hash).toBe(body.hash);
    // Two players' reports match day 1's old body, and it is not kept: this page doesn't stand by it.
    expect(parseDays(await st.doc("players/alice/x/days"))!.days.find((d) => d.day === 1)!.hash).toBe(body.hash);
    expect(await st.trust(1)).toBeNull();
    for (const p of st.pages) expect(p.lw.w.companies.some((x) => x.name === "Erin Late"), p.uid).toBe(true);
  }, 240_000);
});

describe("the shared checkpoint (step 3): a report that differs, and the alarm (findings 3 and 8)", () => {
  it("one player's differing hash stops the cut being kept; the owner's page computes the day again and stands; ignoring that player keeps it", async () => {
    const s = await started();
    const { st, owner, a, b } = s;
    const meta = JSON.stringify(await st.doc("world/meta"));
    const world = owner.lw.worldKey();
    // Mallory reports another hash for the day, in her own document.
    const lie = "f".repeat(64);
    await st.db.doc("players/mallory").set({ v: 1, acts: [], archived: 0 });
    await st.db.doc("players/mallory/x/days").set({ v: 1, world, build: REPLAY_BUILD, days: [{ day: 1, hash: lie, from: "seed" }] });
    await st.round(a, b);
    await st.round(owner); // the body and its pointer
    const body = parsePointer(await st.doc("world/checkpoint")).bodies[0]!;
    await st.round(owner); // the reports: two match, one differs
    expect(await st.trust(1)).toBeNull();
    let alarm = parseAlarm(await st.doc("world/alarm"), world);
    expect(alarm.open.map((o) => [o.day, o.hash, o.uid, o.theirs])).toEqual([[1, body.hash, "mallory", lie]]);
    expect(JSON.stringify(await st.doc("world/meta"))).toBe(meta); // the alarm is its own document
    // The owner's page computes the day again, from a start before it, and gets its hash again: it stands.
    expect(owner.lw.startedFrom).toBeNull();
    await ownHash(owner, 1);
    await st.round(owner);
    alarm = parseAlarm(await st.doc("world/alarm"), world);
    expect(alarm.stood).toEqual([{ day: 1, hash: body.hash }]);
    expect(alarm.barred).toEqual([]);
    expect(await ownHash(owner, 1)).toBe(body.hash);
    // Still open, so still not kept, and a new page starts from the seed.
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(await st.trust(1)).toBeNull();
    const c = await st.open("carol");
    expect(c.lw.startedKind).toBe("seed");
    // The owner's decision: that player's reports for the day no longer count.
    await owner.keeper.ignore("mallory", 1);
    await st.round(owner);
    expect((await st.trust(1))!.by).toEqual(["alice", "bob"]);
    alarm = parseAlarm(await st.doc("world/alarm"), world);
    expect(alarm.open).toEqual([]);
    expect(alarm.ignored).toEqual([{ uid: "mallory", day: 1 }]);
    const d = await st.open("dave");
    expect(d.lw.startedKind).toBe("shared");
    expect(enc(d.lw.w)).toBe(enc(a.lw.w));
    // Her hash from another replay build would be of another text: it neither confirms nor disputes.
    expect(JSON.stringify(await st.doc("world/meta"))).toBe(meta);
  }, 240_000);

  it("a report against a kept cut: no page starts from its body while it stands; the rule's line stays; barred, pages from it start again", async () => {
    const s = await started();
    const { st, owner, a } = s;
    const trust = await kept1(s);
    const world = owner.lw.worldKey();
    const c = await st.open("carol");
    expect(c.lw.startedKind).toBe("shared");
    // A late record, left out by the kept cut.
    await st.db.doc("players/erin").set({ v: 1, acts: [{ s: 0, at: DAY - 120, a: { type: "join", name: "Erin Late", hub: starters[2]!, look: "m" } }], archived: 0 });
    // Mallory disputes the kept cut.
    await st.db.doc("players/mallory").set({ v: 1, acts: [], archived: 0 });
    await st.db.doc("players/mallory/x/days").set({ v: 1, world, build: REPLAY_BUILD, days: [{ day: 1, hash: "e".repeat(64), from: "seed" }] });
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(parseAlarm(await st.doc("world/alarm"), world).open.length).toBe(1);
    // Disputed: a new page doesn't start from the body. It replays from the seed under the kept cut's marks: the same world.
    const d = await st.open("dave");
    expect(d.lw.startedKind).toBe("seed");
    expect(d.lw.w.companies.some((x) => x.name === "Erin Late")).toBe(false);
    expect(enc(d.lw.w)).toBe(enc(a.lw.w));
    expect(enc(c.lw.w)).toBe(enc(a.lw.w));
    // The owner withdraws the cut for good: the page that came from its body starts again, and the late record counts again.
    await st.round(owner); // its own answer first (it stands)
    await owner.keeper.bar(1, trust.hash);
    await st.settle();
    expect(c.lw.startedKind).toBe("seed");
    for (const p of st.pages) expect(p.lw.w.companies.some((x) => x.name === "Erin Late"), p.uid).toBe(true);
    expect(enc(c.lw.w)).toBe(enc(a.lw.w));
    const e = await st.open("frank");
    expect(e.lw.startedKind).toBe("seed");
  }, 240_000);

  it("a page whose own hash of a kept day differs, over the same records, starts again from the body, and its report stands as the alarm", async () => {
    const s = await started();
    const { st, owner, a, b } = s;
    const world = owner.lw.worldKey();
    // Dora's page opens after the boundary and replays from the seed, hashing the recent days on the way. Her browser
    // computes the day differently (stood in for: her own hash of it is another).
    const odd = await st.open("dora");
    expect(odd.lw.startedKind).toBe("seed");
    await ownHash(odd, 1);
    await odd.lw.submit({ type: "join", name: "Dora Drayage", hub: starters[2]! });
    (odd.lw as unknown as { ownCuts: Map<number, { hash: string | null }> }).ownCuts.get(1)!.hash = "d".repeat(64);
    const trust = await kept1(s);
    await st.settle();
    // Kept by the two others; Dora's page sees its own hash differ over the same marks, and starts again from the body.
    expect(odd.lw.startedKind).toBe("shared");
    expect(enc(odd.lw.w)).toBe(enc(a.lw.w));
    // Its report of the day stands, and the owner's page raises the alarm on it.
    await st.round(odd);
    expect(parseDays(await st.doc("players/dora/x/days"))!.days).toEqual([{ day: 1, hash: "d".repeat(64), from: "seed" }]);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(parseAlarm(await st.doc("world/alarm"), world).open.map((o) => [o.uid, o.hash])).toEqual([["dora", trust.hash]]);
    expect(b.lw.needRebuild).toBe(false);
  }, 240_000);

  it("a page that had applied a record the cut left out replays under the rule and takes its hash back: no alarm stands", async () => {
    const st = new Stage();
    // Bob's page hears the world's documents only when the test lets it.
    let worldHeld = false;
    const waiting: (() => void)[] = [];
    const lagging: DbLike = {
      doc: (p) => st.db.doc(p),
      collection: (p): CollLike => {
        const c = st.db.collection(p);
        if (p !== "world") return c;
        return { get: () => c.get(), onSnapshot: (next, err) => c.onSnapshot((snap) => (worldHeld ? void waiting.push(() => next(snap)) : next(snap)), err) };
      },
    };
    const owner = await st.open("olga", { owner: true });
    const a = await st.open("alice");
    const b = await st.open("bob", { db: lagging });
    const c = await st.open("carol");
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await b.lw.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });
    await c.lw.submit({ type: "join", name: "Carol Cartage", hub: starters[2]! });
    await st.until(DAY + G);
    for (const p of st.pages) await ownHash(p, 1);
    const world = owner.lw.worldKey();
    worldHeld = true;
    // Kept by Alice's and Carol's hashes; Bob's page hasn't heard.
    await st.round(a, c);
    await st.round(owner);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    const trust = (await st.trust(1))!;
    expect(trust.by).toEqual(["alice", "carol"]);
    // A late record lands. Bob's page, not knowing the cut, applies it, and reports its new hash of the day.
    await st.db.doc("players/erin").set({ v: 1, acts: [{ s: 0, at: DAY - 120, a: { type: "join", name: "Erin Late", hub: starters[2]!, look: "m" } }], archived: 0 });
    await st.settle();
    expect(b.lw.w.companies.some((x) => x.name === "Erin Late")).toBe(true);
    expect(a.lw.w.companies.some((x) => x.name === "Erin Late")).toBe(false);
    const bobs = await ownHash(b, 1);
    expect(bobs).not.toBe(trust.hash);
    await st.round(b);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(parseAlarm(await st.doc("world/alarm"), world).open.map((o) => o.uid)).toEqual(["bob"]);
    // The owner's page answers (it stands). Then Bob's page hears of the kept cut: it replays under the rule.
    await st.round(owner);
    worldHeld = false;
    for (const f of waiting.splice(0)) f();
    await st.settle();
    expect(b.lw.w.companies.some((x) => x.name === "Erin Late")).toBe(false);
    expect(enc(b.lw.w)).toBe(enc(a.lw.w));
    // Its hash of the day is the kept one now; its report follows, and the alarm clears itself.
    expect(await ownHash(b, 1)).toBe(trust.hash);
    await st.round(b);
    expect(parseDays(await st.doc("players/bob/x/days"))!.days[0]).toMatchObject({ day: 1, hash: trust.hash });
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(parseAlarm(await st.doc("world/alarm"), world).open).toEqual([]);
    const d = await st.open("dave");
    expect(d.lw.startedKind).toBe("shared");
  }, 240_000);
});

describe("the shared checkpoint (step 3): small worlds, a store without the capability, and a body that fails its check", () => {
  it("no other player, or one: the cut is written and never kept, and pages start as they do today", async () => {
    const st = new Stage();
    const owner = await st.open("olga", { owner: true });
    await owner.lw.submit({ type: "join", name: "Olga Lines", hub: starters[0]! });
    await st.until(DAY + G);
    await ownHash(owner, 1);
    await st.round(owner);
    await st.round(owner);
    expect(parsePointer(await st.doc("world/checkpoint")).bodies.length).toBe(1);
    expect(await st.trust(1)).toBeNull();
    // A viewer who has given no order says nothing: only a player's page reports.
    const a = await st.open("alice");
    expect(a.lw.startedKind).toBe("seed");
    await ownHash(a, 1);
    await st.round(a);
    expect(await st.doc("players/alice/x/days")).toBeUndefined();
    // One other player, hashing the same day.
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[1]! });
    await st.round(a);
    expect(parseDays(await st.doc("players/alice/x/days"))!.days.map((d) => d.day)).toEqual([1]);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(await st.trust(1)).toBeNull();
    const b = await st.open("bob");
    expect(b.lw.startedKind).toBe("seed");
    expect(enc(b.lw.w)).toBe(enc(owner.lw.w));
    // The late-order rule isn't in force either: nothing is kept, so a late record is applied by every page, as today.
    const old = parsePointer(await st.doc("world/checkpoint")).bodies[0]!;
    await st.db.doc("players/erin").set({ v: 1, acts: [{ s: 0, at: DAY - 120, a: { type: "join", name: "Erin Late", hub: starters[2]!, look: "m" } }], archived: 0 });
    await st.settle();
    for (const p of st.pages) expect(p.lw.w.companies.some((x) => x.name === "Erin Late"), p.uid).toBe(true);
    // Until a cut is kept it follows the owner's page's own computation: the day computed again, its body replaces the old
    // one, and the old body is deleted from the store.
    const again = await ownHash(owner, 1);
    expect(again).not.toBe(old.hash);
    await st.round(owner);
    const now = parsePointer(await st.doc("world/checkpoint"));
    expect(now.bodies.map((x) => [x.day, x.hash])).toEqual([[1, again]]);
    expect(now.gone).toEqual([]);
    expect([...st.bodies.bodies.keys()]).toEqual([now.bodies[0]!.asset]);
  }, 240_000);

  it("the store keeps the newest bodies and the newest kept one, and deletes a body it drops", async () => {
    const st = new Stage();
    const owner = await st.open("olga", { owner: true, keep: { bodies: 2 } });
    const a = await st.open("alice");
    const b = await st.open("bob");
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await b.lw.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });
    for (let day = 1; day <= 4; day++) {
      await st.until(day * DAY + G);
      for (const p of st.pages) await ownHash(p, day);
      if (day <= 2) await st.round(a, b); // the players' pages are closed from day 3 on, as far as reports go
      await st.round(owner);
      owner.keeper["nextReadAt"] = 0;
      await st.round(owner);
    }
    const pointer = parsePointer(await st.doc("world/checkpoint"));
    expect(pointer.bodies.map((x) => x.day)).toEqual([4, 3, 2]);
    expect(pointer.gone).toEqual([]);
    expect([...st.bodies.bodies.keys()].sort()).toEqual(pointer.bodies.map((x) => x.asset).sort());
    expect(owner.lw.sharedView().kept.map((k) => k.day)).toEqual([1, 2]);
    // A new page starts from the newest kept body, two days back, and replays on under both days' marks.
    const c = await st.open("carol");
    expect(c.lw.startedKind).toBe("shared");
    expect(c.lw.startedFrom).toBe(2 * DAY);
    expect(enc(c.lw.w)).toBe(enc(a.lw.w));
  }, 240_000);

  it("with the fewPlayers lever on: an empty world's cut is kept on the owner's page alone, one other player's world needs that player, and a differing hash still stops it", async () => {
    const st = new Stage();
    const owner = await st.open("olga", { owner: true, keep: { fewPlayers: true } });
    await owner.lw.submit({ type: "join", name: "Olga Lines", hub: starters[0]! });
    await st.until(DAY + G);
    await ownHash(owner, 1);
    await st.round(owner);
    await st.round(owner);
    expect((await st.trust(1))!.by).toEqual([]);
    const a = await st.open("alice");
    expect(a.lw.startedKind).toBe("shared");
    expect(a.lw.startedFrom).toBe(DAY);
    // Day 2, with one other player in the world: her hash is needed, and enough.
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[1]! });
    await st.until(2 * DAY + G);
    await ownHash(owner, 2);
    await st.round(owner);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect(await st.trust(2)).toBeNull();
    await ownHash(a, 2);
    await st.round(a);
    owner.keeper["nextReadAt"] = 0;
    await st.round(owner);
    expect((await st.trust(2))!.by).toEqual(["alice"]);
  }, 240_000);

  it("a store that takes no body (the artifact without the assets capability): nothing is written but the players' reports, and every page runs as it did", async () => {
    const st = new Stage();
    const none = memoryBodies(false);
    const owner = await st.open("olga", { owner: true, bodies: none });
    const a = await st.open("alice", { bodies: none });
    const b = await st.open("bob", { bodies: none });
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await b.lw.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });
    await st.until(DAY + G);
    for (const p of st.pages) await ownHash(p, 1);
    await st.round();
    await st.round();
    expect(await st.doc("world/checkpoint")).toBeUndefined();
    expect(await st.trust(1)).toBeNull();
    expect(await st.doc("world/alarm")).toBeUndefined();
    expect(owner.keeper.note).toMatch(/assets capability/);
    expect(parseDays(await st.doc("players/alice/x/days"))!.days.length).toBe(1);
    const c = await st.open("carol", { bodies: none });
    expect(c.lw.startedKind).toBe("seed");
    expect(enc(c.lw.w)).toBe(enc(a.lw.w));
    // It doesn't ask the store again on every round.
    let puts = 0;
    const counted: BodyStore = { ...none, put: async (x) => (puts++, none.put(x)) };
    (owner.keeper as unknown as { bodies: BodyStore }).bodies = counted;
    await st.round(owner);
    await st.round(owner);
    expect(puts).toBe(0);
  }, 240_000);

  it("a body that doesn't hash to its pointer, or of another build or world, is never started from", async () => {
    const s = await started();
    const { st, owner, a } = s;
    const trust = await kept1(s);
    const pointer = parsePointer(await st.doc("world/checkpoint"));
    const body = pointer.bodies[0]!;
    const good = st.bodies.bodies.get(body.asset)!;
    // Spoiled in the store: another text under the same id.
    const text = (await unpackBody(good))!;
    st.bodies.bodies.set(body.asset, await packBody(text.replace('"t":1440', '"t":1441')));
    const c = await st.open("carol");
    expect(c.lw.startedKind).toBe("seed");
    expect(enc(c.lw.w)).toBe(enc(a.lw.w));
    st.bodies.bodies.set(body.asset, "garbage");
    expect((await st.open("dave")).lw.startedKind).toBe("seed");
    st.bodies.bodies.set(body.asset, good);
    expect((await st.open("erin")).lw.startedKind).toBe("shared");
    // The pointer says another replay build wrote it: not this page's to start from, though the cut's marks still hold.
    await st.db.doc("world/checkpoint").set({ v: 1, bodies: [{ ...body, build: "another-build" }], gone: [] });
    await st.settle();
    expect((await st.open("frank")).lw.startedKind).toBe("seed");
    // A trust document for another world (left from before a restart) keeps nothing.
    await st.db.doc("world/checkpoint").set({ v: 1, bodies: [body], gone: [] });
    await st.db.doc("world/cpm-1").set({ v: 1, ...trust, marks: marksDoc(trust.marks), world: "1:0:another" });
    await st.settle();
    expect((await st.open("gina")).lw.startedKind).toBe("seed");
    expect(owner.lw.sharedView().kept).toEqual([]);
  }, 240_000);

  it("the artifact's assets as the body store: a JSON file up, nothing without the capability, one more try on a busy store or a dropped read", async () => {
    const up: { type: string; text: string }[] = [];
    const deleted: string[] = [];
    let fail: string | null = null;
    const assets = {
      upload: async (blob: Blob, o?: { type?: string }) => {
        if (fail) {
          const code = fail;
          if (fail === "store_unavailable") fail = null;
          throw { code };
        }
        up.push({ type: `${blob.type}|${o?.type}`, text: await blob.text() });
        return { id: "a".repeat(32), sizeBytes: blob.size };
      },
      delete: async (id: string) => void deleted.push(id),
    };
    let reads = 0;
    const store = assetBodies(assets, async (id) => (++reads === 1 ? null : `body of ${id}`));
    const packed = await packBody(cutText({ world: "w", build: "b", t: DAY, marks: [], companies: [] }, "{}"));
    expect(await store.put(packed)).toEqual({ id: "a".repeat(32), bytes: packed.length });
    expect(up).toEqual([{ type: "application/json|application/json", text: packed }]);
    // A busy store: once more, and it lands.
    fail = "store_unavailable";
    expect((await store.put(packed))!.id).toBe("a".repeat(32));
    expect(up.length).toBe(2);
    // Not this view's after all: the same as no capability. Anything else is the caller's to hear.
    fail = "not_granted";
    expect(await store.put(packed)).toBeNull();
    fail = "quota_or_state";
    await expect(store.put(packed)).rejects.toMatchObject({ code: "quota_or_state" });
    fail = null;
    // A read that fails is tried once more.
    expect(await store.get("x1")).toBe("body of x1");
    expect(reads).toBe(2);
    await store.delete("x1");
    expect(deleted).toEqual(["x1"]);
    // No capability (every viewer but the owner and editors): nothing is stored or deleted, and bodies are still read.
    const reader = assetBodies(null, async (id) => `body of ${id}`);
    expect(await reader.put(packed)).toBeNull();
    await reader.delete("x2");
    expect(deleted).toEqual(["x1"]);
    expect(await reader.get("x2")).toBe("body of x2");
  }, 30_000);

  it("malformed store documents read as nothing", () => {
    expect(parsePointer(undefined)).toEqual({ bodies: [], gone: [] });
    expect(parsePointer({ v: 1, bodies: [{ day: 1, t: 1441, hash: "a".repeat(64), world: "w", build: "b", asset: "x" }] }).bodies).toEqual([]);
    expect(parsePointer({ v: 1, bodies: [{ day: 1, t: DAY, hash: "A".repeat(64), world: "w", build: "b", asset: "x" }] }).bodies).toEqual([]);
    expect(parsePointer({ v: 1, bodies: [{ day: 1, t: DAY, hash: "a".repeat(64), world: "w", build: "b", asset: "../x" }] }).bodies).toEqual([]);
    expect(parsePointer({ v: 2, bodies: [{ day: 1, t: DAY, hash: "a".repeat(64), world: "w", build: "b", asset: "x" }] }).bodies).toEqual([]);
    expect(parsePointer({ v: 1, bodies: [{ day: 1, t: DAY, hash: "a".repeat(64), world: "w", build: "b", asset: "x" }], gone: ["ok", "../no", 7] })).toMatchObject({ bodies: [{ day: 1 }], gone: ["ok"] });
    expect(parseTrust({ v: 1, world: "w", build: "b", day: 1, t: DAY, hash: "a".repeat(63), by: [], marks: [] })).toBeNull();
    expect(parseTrust({ v: 1, world: "w", build: "b", day: 1, t: DAY, hash: "a".repeat(64), by: ["x", 3], marks: [["u", 2, 3]] })).toMatchObject({ by: ["x"], marks: [["u", 2, 3]] });
    expect(parseTrust({ v: 1, world: "w", build: "b", day: 1, t: DAY, hash: "a".repeat(64), by: [], marks: [{ u: "v", s: 0, n: 1 }, { u: "u", s: 2, n: 3 }] })!.marks).toEqual([["u", 2, 3], ["v", 0, 1]]);
    expect(parseTrust({ v: 1, world: "w", build: "b", day: 1, t: DAY, hash: "a".repeat(64), by: [], marks: [{ u: "v", s: 0 }] })).toBeNull();
    expect(parseMarks([["u", 2, 3], ["u", 4, 5]])).toBeNull();
    expect(parseMarks([["b", 0, 1], ["a", 2, 3]])).toEqual([["a", 2, 3], ["b", 0, 1]]);
    expect(marksKey(parseMarks([["b", 0, 1], ["a", 2, 3]])!)).toBe('[["a",2,3],["b",0,1]]');
    expect(parseMarks([["u", -1, 1]])).toBeNull();
    expect(parseAlarm({ v: 1, world: "other", open: [{ day: 1, hash: "a".repeat(64), uid: "u", theirs: "b".repeat(64) }] }, "w")).toEqual(noAlarm());
    expect(parseAlarm({ v: 1, world: "w", open: [{ day: 1, hash: "a".repeat(64), uid: "u", theirs: "b".repeat(64) }, { day: "1" }], barred: [{ day: 2, hash: "c".repeat(64) }], ignored: [{ uid: "u", day: 3 }] }, "w")).toMatchObject({ open: [{ uid: "u" }], barred: [{ day: 2 }], ignored: [{ uid: "u", day: 3 }] });
    expect(parseDays({ v: 1, world: "w", build: "b", days: [{ day: 1, hash: "a".repeat(64), from: "seed" }, { day: 2, hash: "nope" }] })!.days).toEqual([{ day: 1, hash: "a".repeat(64), from: "seed" }]);
    expect(parseDays({ v: 2 })).toBeNull();
  });
});

describe("the shared checkpoint (step 3): the node replay of a copy of the store (finding 3's judge)", () => {
  it("replays the copy from the seed under the kept cuts and gives the pages' hash of each day, beside what the store says", async () => {
    const s = await started();
    const { st, a } = s;
    const trust = await kept1(s);
    // A late record, and a player whose report differs: both are in the copy.
    await st.db.doc("players/erin").set({ v: 1, acts: [{ s: 0, at: DAY - 120, a: { type: "join", name: "Erin Late", hub: starters[2]!, look: "m" } }], archived: 0 });
    await st.db.doc("players/mallory/x/days").set({ v: 1, world: a.lw.worldKey(), build: REPLAY_BUILD, days: [{ day: 1, hash: "f".repeat(64), from: "seed" }] });
    await st.settle();
    const copy = [...(st.db as unknown as { docs: Map<string, Record<string, unknown>> }).docs];
    const out = await liveDays(copy, st.clock);
    expect(out).toMatchObject({ world: a.lw.worldKey(), build: REPLAY_BUILD, minute: a.lw.w.t });
    expect(out.days.map((d) => d.day)).toEqual([1]);
    const day = out.days[0]!;
    expect(day.hash).toBe(trust.hash);
    expect(day.kept).toBe(trust.hash);
    expect(day.body).toBe(trust.hash);
    expect(day.reports.map((r) => [r.uid, r.hash === day.hash]).sort()).toEqual([["alice", true], ["bob", true], ["mallory", false], ["olga", true]]);
    // Without the trust document in the copy the late record counts, and the day hashes otherwise: the copy must carry them.
    const bare = await liveDays(copy.filter(([p]) => !p.startsWith("world/cpm-")), st.clock);
    expect(bare.days[0]!.hash).not.toBe(trust.hash);
    expect(bare.days[0]!.kept).toBeNull();
  }, 240_000);
});

describe("the shared checkpoint (step 3): with this browser's own cuts (step 2a)", () => {
  it("a page's own cut of the kept minute is the kept cut byte for byte: it starts from it without fetching, and what's before it is settled", async () => {
    const st = new Stage();
    const store = memoryCuts();
    const owner = await st.open("olga", { owner: true });
    const a = await st.open("alice", { cuts: store });
    const b = await st.open("bob");
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await b.lw.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });
    await st.until(DAY + G);
    for (const p of st.pages) await ownHash(p, 1);
    const trust = await kept1({ st, owner, players: [a, b], a, b });
    const local = [...store.cuts.values()].find((c) => c.t === DAY)!;
    expect(local.hash).toBe(trust.hash);
    expect(local.marks).toEqual(trust.marks);
    // Alice's page reloads: its own cut, no fetch.
    st.close(a);
    let fetched = 0;
    const counting: BodyStore = { ...st.bodies, get: async (id) => (fetched++, st.bodies.get(id)) };
    const again = await st.open("alice", { cuts: store, bodies: counting });
    expect(again.lw.startedKind).toBe("local");
    expect(again.lw.startedFrom).toBe(DAY);
    expect(fetched).toBe(0);
    expect(enc(again.lw.w)).toBe(enc(b.lw.w));
    // Its own computation of the day is still its own to report.
    expect(again.lw.ownDays().map((c) => [c.day, c.hash])).toEqual([[1, trust.hash]]);
    // A late record before the cut doesn't move it: everything before the kept minute is settled.
    await st.db.doc("players/erin").set({ v: 1, acts: [{ s: 0, at: DAY - 120, a: { type: "join", name: "Erin Late", hub: starters[2]!, look: "m" } }], archived: 0 });
    await st.settle();
    expect(again.lw.needRebuild).toBe(false);
    st.close(again);
    const third = await st.open("alice", { cuts: store, bodies: counting });
    expect(third.lw.startedKind).toBe("local");
    expect(third.lw.w.companies.some((x) => x.name === "Erin Late")).toBe(false);
    // A cut of its own that disagrees with the kept one of its minute is passed over for the body.
    for (const c of store.cuts.values()) if (c.t === DAY) c.hash = "c".repeat(64);
    st.close(third);
    const fourth = await st.open("alice", { cuts: store, bodies: counting });
    expect(fourth.lw.startedKind).toBe("shared");
    expect(fetched).toBe(1);
  }, 240_000);
});

describe("the shared checkpoint (step 3): fuzz (the design's §4)", () => {
  /** A small generator, so a failing run can be run again. */
  const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 2 ** 32);

  it("random orders from three players over three days: pages from each day's body, from the seed and straight through hash every boundary alike", async () => {
    for (const seed of [11, 20261117]) {
      const rand = rng(seed);
      const st = new Stage(1000 + seed);
      const owner = await st.open("olga", { owner: true });
      const players: Page[] = [];
      for (const [i, uid] of ["alice", "bob", "cora"].entries()) {
        const p = await st.open(uid);
        await p.lw.submit({ type: "join", name: `${uid} Haul`, hub: starters[i]! });
        players.push(p);
      }
      const order = (p: Page): LiveAction | null => {
        if (!p.lw.player) return null;
        const trucks = p.lw.w.trucksByCompany.get(p.lw.player.id) ?? [];
        const truck = trucks[Math.floor(rand() * trucks.length)];
        const pick = rand();
        if (pick < 0.4) return bidFor(p.lw);
        if (pick < 0.55 && truck) return { type: "cancel_bid", truckId: truck.id };
        if (pick < 0.7) return { type: "set_standing_orders", orders: [{ kind: "bid", maxDeadheadMi: 50 + Math.floor(rand() * 250), price: { mode: "ceilingPct", pct: 0.8 + rand() * 0.15 } }, { kind: "floor", breakEvenPlusPct: rand() * 0.2 }] };
        if (pick < 0.8 && truck) return { type: "reposition_truck", truckId: truck.id, hubId: starters[Math.floor(rand() * starters.length)]! };
        if (pick < 0.9 && truck) return rand() < 0.5 ? { type: "park_truck", truckId: truck.id } : { type: "unpark_truck", truckId: truck.id };
        return { type: "cancel_bid", truckId: 900_000 + Math.floor(rand() * 1000) }; // refused: it still moves a mark
      };
      const late: Page[] = [];
      for (let day = 1; day <= 3; day++) {
        await st.run((day * DAY + G - st.minute()) / 60, async () => {
          for (const p of players) {
            if (rand() > 0.35) continue;
            const a = order(p);
            if (a) await p.lw.submit(a);
          }
        });
        const want = await ownHash(owner, day);
        for (const p of [...players, ...late]) expect(await ownHash(p, day), `seed ${seed} day ${day} ${p.uid}`).toBe(want);
        await st.round(...players);
        await st.round(owner);
        owner.keeper["nextReadAt"] = 0;
        await st.round(owner);
        expect((await st.trust(day))!.hash).toBe(want);
        // A page from this day's body, and (once) one from the seed that can read no body.
        const fromBody = await st.open(`late${day}`);
        expect(fromBody.lw.startedKind).toBe("shared");
        expect(fromBody.lw.startedFrom).toBe(day * DAY);
        late.push(fromBody);
        if (day === 2) {
          const fromSeed = await st.open("seeded", { bodies: memoryBodies() });
          expect(fromSeed.lw.startedKind).toBe("seed");
          late.push(fromSeed);
        }
        for (const p of late) expect(enc(p.lw.w), `seed ${seed} day ${day} ${p.uid}`).toBe(enc(owner.lw.w));
      }
      await st.run(5);
      for (const p of [...players, ...late]) expect(enc(p.lw.w), `seed ${seed} ${p.uid}`).toBe(enc(owner.lw.w));
      for (const p of st.pages) p.lw.close();
    }
  }, 600_000);
});
