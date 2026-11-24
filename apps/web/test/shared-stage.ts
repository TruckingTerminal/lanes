import "./seed.js";
import { expect } from "vitest";
import { hubs } from "@lanes/data";
import { encodeWorld, hubMiles, type Action, type World } from "@lanes/engine";
import { cutExtras, memoryBodies, parseTrust, readArc } from "../src/cuts.js";
import type { BodyStore, CutStore, TrustDoc } from "../src/cuts.js";
import { RULESET } from "../src/game.js";
import { KEEP, Keeper } from "../src/keeper.js";
import { LiveWorld, MS_PER_GAME_HOUR, type ActRecord, type DbLike, type WorldMeta } from "../src/live.js";
import { MemoryDb } from "../src/memdb.js";

/**
 * The stage the shared checkpoint's tests play on (live-shared.test.ts, live-frozen.test.ts): one store, one clock, and
 * the pages open on them, each with its keeper.
 */
export const MIN = MS_PER_GAME_HOUR / 60;
export const DAY = 24 * 60;
export const G = KEEP.graceMin;
export const starters = hubs.filter((h) => h.isStarter).map((h) => h.id);
export const beat = () => new Promise((r) => setTimeout(r, 0));
/** The world and what a cut carries beside it (the bots' state, the month books, the truck numbers). */
export const enc = (w: World) => encodeWorld(w, cutExtras(w));

export interface Page {
  uid: string;
  lw: LiveWorld;
  keeper: Keeper;
}
export interface OpenOptions {
  owner?: boolean;
  /** false: a page with the shared checkpoint off (as the live page is today). */
  shared?: boolean;
  cuts?: CutStore;
  bodies?: BodyStore;
  db?: DbLike;
  keep?: Partial<typeof KEEP>;
  /** The waits between the tries of an archive read that fails (ms); a few milliseconds unless given. */
  retryMs?: number[];
  /** The page's first replay, run by the test itself (to act while it runs) in place of one awaited call. */
  replay?: (lw: LiveWorld) => Promise<void>;
}

/** One store, one clock, and the pages open on them. */
export class Stage {
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
    const lw = await LiveWorld.open(db, this.meta, uid, { now: this.now, mono: this.now, holder: `tab-${uid}-${this.tabs++}`, manualRenewal: true, owner, ...(o.cuts ? { cuts: o.cuts } : {}), ...(o.shared === false ? {} : { shared: { bodies, keepText: owner, retryMs: o.retryMs ?? [5, 5] } }) });
    await (o.replay ? o.replay(lw) : lw.rebuild());
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
export async function ownHash(p: Page, day: number): Promise<string> {
  for (let i = 0; i < 400; i++) {
    const c = p.lw.ownDays().find((x) => x.day === day);
    if (c?.hash) return c.hash;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`${p.uid} has no hash of day ${day}`);
}

/** A plausible bid for one of this player's idle trucks, read off that player's own world. */
export function bidFor(lw: LiveWorld): Action | null {
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
export async function started(o: { seed?: number; st?: Stage; ownerOptions?: OpenOptions; players?: string[] } = {}) {
  const st = o.st ?? new Stage(o.seed);
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
export async function kept1(s: Awaited<ReturnType<typeof started>>): Promise<TrustDoc> {
  await s.st.round(...s.players);
  await s.st.round(s.owner); // the body, then its pointer
  await s.st.round(s.owner); // the reports read: the archive, then the trust document
  const t = await s.st.trust(1);
  expect(t).not.toBeNull();
  return t!;
}

/** The archive a day's trust document names, read as a page reads it: each record with its player. */
export async function archived(st: Stage, day: number): Promise<[string, ActRecord][]> {
  const text = await readArc(st.db, (await st.trust(day))!.arc);
  expect(text).not.toBeNull();
  return text ? text.split("\n").map((line) => JSON.parse(line) as [string, ActRecord]) : [];
}

/** The running hash of the records a page had applied at a day boundary it computed. */
export function rhOf(p: Page, day: number): string {
  return p.lw.ownDays().find((c) => c.day === day)!.rh;
}

/** Waits for something a page does a moment after it hears the store. */
export async function eventually(what: () => boolean): Promise<void> {
  for (let i = 0; i < 400 && !what(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(what()).toBe(true);
}

/** Every page open on the stage has computed one world. */
export function oneWorld(st: Stage, as: string = enc(st.pages[0]!.lw.w)): void {
  for (const p of st.pages) {
    expect(p.lw.needRebuild, p.uid).toBe(false);
    expect(enc(p.lw.w) === as, p.uid).toBe(true);
  }
}
