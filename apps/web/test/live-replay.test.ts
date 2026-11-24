import "./seed.js";
import { describe, expect, it } from "vitest";
import { ARC_PATH, arcDocPath, memoryBodies } from "../src/cuts.js";
import type { DbLike } from "../src/live.js";
import { beat, DAY, eventually, G, kept1, oneWorld, ownHash, Stage, started, starters, type Page } from "./shared-stage.js";

/**
 * The checkpoint's step 3b, part C (live.ts), with the shared checkpoint on: a replay that reads archives. Whatever reaches
 * the page while it waits for them is applied once, in the world's order; one call of rebuild ends with the world at the
 * clock, whatever became due meanwhile; nothing else moves the world during it; and a tab's sent orders behind a new
 * frozen minute are placed against its archive with one read.
 */

/** A store whose archive reads can be made to wait, and which says the ones it was asked for. */
class Gate {
  readonly reads: string[] = [];
  readonly db: DbLike;
  private shut = false;
  private waiting: (() => void)[] = [];
  private onAsk: (() => void) | null = null;
  constructor(inner: DbLike) {
    this.db = {
      collection: (p) => inner.collection(p),
      doc: (p) => {
        const d = inner.doc(p);
        if (!p.startsWith(ARC_PATH)) return d;
        return {
          ...d,
          get: async () => {
            this.reads.push(p);
            if (this.shut) {
              this.onAsk?.();
              await new Promise<void>((r) => this.waiting.push(r));
            }
            return d.get();
          },
        };
      },
    };
  }
  /** From now on an archive read waits. Resolves once one is waiting. */
  asked(): Promise<void> {
    this.shut = true;
    return new Promise((r) => (this.onAsk = r));
  }
  /** The reads that wait go on, and later ones don't wait. */
  open(): void {
    this.shut = false;
    for (const r of this.waiting.splice(0)) r();
  }
}

const join = (s: number, at: number, name: string, hub = 2) => ({ s, at, a: { type: "join", name, hub: starters[hub]!, look: "m" } });
const named = (p: Page, what: RegExp): string[] => p.lw.w.companies.filter((x) => what.test(x.name)).map((x) => x.name);
const archiveReads = (seen: string[]): string[] => seen.filter((p) => p.startsWith(ARC_PATH));

describe("the shared checkpoint (step 3b): what reaches a page while its replay waits for an archive", () => {
  it("another player's order, delivered while a page from the seed waits for an archive: the page reads the archive once and computes the world of a page that was open all along", async () => {
    const s = await started();
    const { st } = s;
    const trust = await kept1(s);
    const gate = new Gate(st.db);
    const asked = gate.asked();
    const dave = await st.open("dave", {
      bodies: memoryBodies(),
      db: gate.db,
      replay: async (lw) => {
        const done = lw.rebuild();
        await asked;
        await st.db.doc("players/erin").set({ v: 1, acts: [join(0, Math.ceil(st.minute()) + 5, "Erin Arrives")], archived: 0 });
        await beat();
        expect(lw.players()).toContain("erin");
        gate.open();
        await done;
      },
    });
    expect([dave.lw.startedKind, dave.lw.needRebuild, dave.lw.replaying, dave.lw.broken]).toEqual(["seed", false, false, null]);
    expect(gate.reads).toEqual([arcDocPath(trust.arc)]);
    oneWorld(st);
    await st.run(1);
    oneWorld(st);
    for (const p of st.pages) expect(named(p, /Erin|alice|bob/).sort(), p.uid).toEqual(["Erin Arrives", "alice Haul", "bob Haul"]);
  }, 240_000);

  it("the same on a replay after a cut is withdrawn, the order brought by the page's own read of the players' documents", async () => {
    const s = await started();
    const { st, owner } = s;
    const trust = await kept1(s);
    const gate = new Gate(st.db);
    const x = await st.open("xena", { db: gate.db });
    expect([x.lw.startedKind, gate.reads]).toEqual(["shared", []]);
    await owner.keeper.bar(1, trust.hash);
    await beat();
    expect(x.lw.needRebuild).toBe(true);
    const asked = gate.asked();
    const done = x.lw.rebuild();
    await asked;
    // The subscription says nothing meanwhile: the page reads the players' documents itself.
    st.db.hold = true;
    await st.db.doc("players/erin").set({ v: 1, acts: [join(0, Math.ceil(st.minute()) + 5, "Erin Arrives")], archived: 0 });
    expect(await x.lw.reread()).toBe(true);
    expect(x.lw.players()).toContain("erin");
    st.db.hold = false;
    st.db.flush();
    gate.open();
    await done;
    expect([x.lw.startedKind, x.lw.needRebuild, x.lw.replaying, x.lw.broken]).toEqual(["seed", false, false, null]);
    expect(gate.reads).toEqual([arcDocPath(trust.arc)]);
    await st.settle();
    oneWorld(st);
    await st.run(1);
    oneWorld(st);
    for (const p of st.pages) expect(named(p, /Erin|alice|bob/).sort(), p.uid).toEqual(["Erin Arrives", "alice Haul", "bob Haul"]);
  }, 240_000);

  it("and for the tab's own order, sent while its page waits for an archive", async () => {
    const s = await started();
    const { st } = s;
    const trust = await kept1(s);
    const gate = new Gate(st.db);
    const asked = gate.asked();
    const dave = await st.open("dave", {
      bodies: memoryBodies(),
      db: gate.db,
      replay: async (lw) => {
        const done = lw.rebuild();
        await asked;
        const sent = await lw.submit({ type: "join", name: "Dave Sends Early", hub: starters[2]! });
        expect(sent.at).toBeGreaterThan(st.minute());
        gate.open();
        await done;
      },
    });
    expect([dave.lw.startedKind, dave.lw.needRebuild, dave.lw.broken]).toEqual(["seed", false, null]);
    expect(gate.reads).toEqual([arcDocPath(trust.arc)]);
    expect(dave.lw.pending().map((r) => r.a.type)).toEqual(["join"]);
    await st.settle();
    oneWorld(st);
    await st.run(1);
    oneWorld(st);
    expect(dave.lw.player?.name).toBe("Dave Sends Early");
    for (const p of st.pages) expect(named(p, /Dave|alice|bob/).sort(), p.uid).toEqual(["Dave Sends Early", "alice Haul", "bob Haul"]);
  }, 240_000);
});

describe("the shared checkpoint (step 3b): one replay at a time, ended at the clock", () => {
  it("a trust document that arrives while a page replays from its archives: the one call of rebuild starts the replay again and ends with the world every page has; meanwhile nothing else moves the world, and a second call waits for the same end", async () => {
    const s = await started();
    const { st, owner, a, b } = s;
    const t1 = await kept1(s);
    await st.until(2 * DAY + G);
    for (const p of st.pages) await ownHash(p, 2);
    await st.round(a, b);
    await st.round(owner);
    expect(await st.trust(2)).toBeNull();
    const gate = new Gate(st.db);
    const asked = gate.asked();
    let second: Promise<void> | null = null;
    const dave = await st.open("dave", {
      bodies: memoryBodies(),
      db: gate.db,
      replay: async (lw) => {
        const done = lw.rebuild();
        await asked;
        // The page is on day 1's archive. A frame's call moves nothing.
        const at = lw.w.t;
        expect([lw.advance(1e9), lw.w.t, lw.replaying]).toEqual([false, at, true]);
        // Day 2's cut is kept meanwhile.
        owner.keeper["nextReadAt"] = 0;
        await st.round(owner);
        expect((await st.trust(2))?.day).toBe(2);
        await beat();
        expect(lw.needRebuild).toBe(true);
        second = lw.rebuild();
        gate.open();
        await done;
      },
    });
    const t2 = (await st.trust(2))!;
    expect([dave.lw.startedKind, dave.lw.needRebuild, dave.lw.replaying, dave.lw.broken]).toEqual(["seed", false, false, null]);
    await second;
    // Day 1's archive, asked for when the replay began; then both, when it began again.
    expect(gate.reads).toEqual([arcDocPath(t1.arc), arcDocPath(t1.arc), arcDocPath(t2.arc)]);
    expect(dave.lw.w.t).toBe(a.lw.w.t);
    oneWorld(st);
    await st.run(1);
    oneWorld(st);
  }, 360_000);
});

describe("the shared checkpoint (step 3b): a tab's sent orders behind a new frozen minute", () => {
  it("are placed against that minute's archive with one read of it, and an order the archive holds is not called late", async () => {
    const st = new Stage();
    const owner = await st.open("olga", { owner: true });
    const seen: string[] = [];
    const watched: DbLike = { doc: (p) => (seen.push(p), st.db.doc(p)), collection: (p) => (seen.push(p), st.db.collection(p)) };
    const a = await st.open("alice", { db: watched });
    const b = await st.open("bob");
    await a.lw.submit({ type: "join", name: "Alice Haul", hub: starters[0]! });
    await b.lw.submit({ type: "join", name: "Bob Freight", hub: starters[1]! });
    await st.run(1);
    for (let i = 0; i < 12; i++) await a.lw.submit({ type: "cancel_bid", truckId: 900_000 + i });
    const late: number[] = [];
    a.lw.onLate = (r) => late.push(r.s);
    await st.until(DAY + G);
    for (const p of st.pages) await ownHash(p, 1);
    const trust = await kept1({ st, owner, players: [a, b], a, b });
    expect(trust.arc.n).toBe(14);
    await eventually(() => archiveReads(seen).length > 0);
    for (let i = 0; i < 20; i++) await beat();
    expect(archiveReads(seen)).toEqual([arcDocPath(trust.arc)]);
    expect(late).toEqual([]);
    expect(a.lw.needRebuild).toBe(false);
    oneWorld(st);
  }, 240_000);
});
