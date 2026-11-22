import { ruleBotHook } from "@lanes/agents";
import { applyAction, decodeWorld, encodeWorld, stepHour, type Action, type ActionResult, type Company, type GameEvent, type World } from "@lanes/engine";
import { joinCompany, newWorld, RULESET } from "./game.js";
import { booksAfterHour } from "./books.js";
import { adoptable, countsUnder, cutExtras, cutText, CUTS_KEPT, keptCuts, marksKey, marksOf, noAlarm, parseAlarm, parsePointer, parseTrust, readCut, REPLAY_BUILD, restoreCutExtras, sha256, unpackBody } from "./cuts.js";
import type { Alarm, BodyRef, BodyStore, CutExtras, CutHead, CutStore, KeptCut, Marks, Pointer, TrustDoc } from "./cuts.js";
import { PENDING } from "./copy-pending.js";

/**
 * The live world: one shared, permanent world that every player's page computes.
 *
 * There is no game server. The world is a seed plus every player's actions, kept in
 * the artifact's shared store, and the deterministic engine turns that log into the
 * same world on every machine. The clock is the real one (spec: one in-game day per
 * six real hours) and never pauses. Each action takes effect a little after it is
 * taken, at a game minute stamped on it, so it reaches every page before that
 * moment; all pages apply actions in the same order (minute, player, sequence).
 *
 * Store layout:
 *   world/meta                 seed, epoch, clock rate, ruleset (owner only)
 *   players/<uid>              { acts: ActRecord[], archived }  (that player only)
 *   players/<uid>/log/<n>      older actions moved out of the player document
 *   players/<uid>/x/tab        the lease that makes one tab the player's writer
 *   reports/<uid>              { items: Report[] }  the player's bug reports and ideas (that player writes, the owner reads)
 *
 * With the shared checkpoint on (step 3; cuts.ts, keeper.ts), and never read or written with it off:
 *   world/checkpoint           where the day cuts' bodies are (owner only)
 *   world/cpm-<day>            a cut every page keeps to: its hash, who confirmed it, its marks (owner only; kept for good)
 *   world/alarm                reports against a body, and cuts withdrawn (owner only)
 *   players/<uid>/x/days       that player's page's own hashes of the last few day boundaries (that player only)
 */

export const MS_PER_GAME_HOUR = (6 * 3600 * 1000) / 24;
const MS_PER_GAME_MIN = MS_PER_GAME_HOUR / 60;
/** Game minutes between taking an action and its effect (30 real seconds): time for it to reach every page. */
export const LEAD_MIN = 2;
const LEASE_TTL_MS = 120_000;
const KEEP_IN_DOC = 300;
const ARCHIVE_CHUNK = 200;
/**
 * The most chunks a player's log holds. A chunk is 200 orders, each over a game day old, so this is 200,000 orders: 550 a
 * day for a year. At it a page stops moving orders out of the player's document.
 */
export const MAX_ARCHIVE_CHUNKS = 1000;

/**
 * A player's document says how many chunks its log holds (`archived`). It is read as a count only when it is a whole
 * number from 0 to MAX_ARCHIVE_CHUNKS; anything else reads as `seen`, the count this page already has.
 */
export function archiveCount(raw: unknown, seen: number): number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= MAX_ARCHIVE_CHUNKS ? raw : seen;
}
/** A log chunk's document id: c00000, c00001, … */
const chunkId = (n: number): string => `c${String(n).padStart(5, "0")}`;

export interface WorldMeta {
  v: 1;
  seed: number;
  epochMs: number;
  msPerGameHour: number;
  ruleset: string;
}

export type JoinAction = { type: "join"; name: string; hub: string; look?: "m" | "f" };
/** A bug report or an idea from a player, with what the page knew at the time. */
export interface Report {
  kind: "bug" | "idea";
  text: string;
  atMs: number;
  day: number;
  t: number;
  ruleset: string;
  tab: string;
  company: string | null;
  truckId: number | null;
  /** The player's last orders: type and the game minute they took effect. */
  acts: { type: string; at: number }[];
  ua: string;
}
const REPORTS_KEPT = 50;
export type LiveAction = Action | JoinAction;
/** One entry in a player's log: sequence number, the game minute it takes effect, the action. */
export interface ActRecord {
  s: number;
  at: number;
  a: LiveAction;
  /** Given by the player's brokerage rather than its carrier (both are this uid's: brokerage.ts partnerId). */
  as?: "brokerage";
}

// The subset of the artifact store this uses, so tests and local runs can supply their own.
export interface SnapLike {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  /** The store marks a copy it hasn't confirmed (saved on an earlier visit, or delivered in a connectivity gap). */
  metadata?: { fromCache?: boolean };
}
export interface DocLike {
  get(): Promise<SnapLike>;
  set(data: Record<string, unknown>): Promise<void>;
  acquire(o: { holder: string; ttlMs?: number }): Promise<{ acquired: boolean; expiresAt?: string }>;
}
export interface CollLike {
  get(): Promise<{ docs: SnapLike[]; metadata?: { fromCache?: boolean } }>;
  /** The store's answer may come first as a copy saved on an earlier visit (`metadata.fromCache`). */
  onSnapshot(next: (s: { docs: SnapLike[]; metadata?: { fromCache?: boolean } }) => void, error?: (e: { code: string }) => void): () => void;
}
export interface DbLike {
  doc(path: string): DocLike;
  collection(path: string): CollLike;
}

export async function readMeta(db: DbLike): Promise<WorldMeta | null> {
  const snap = await db.doc("world/meta").get();
  const m = snap.exists ? (snap.data() as Partial<WorldMeta>) : null;
  if (!m || m.v !== 1 || !Number.isInteger(m.seed) || typeof m.epochMs !== "number" || typeof m.msPerGameHour !== "number" || typeof m.ruleset !== "string") return null;
  return m as WorldMeta;
}

/** Opens the world now, at 06:00 on day 1 so the first board round is under way. */
export async function createMeta(db: DbLike, now = Date.now()): Promise<WorldMeta> {
  // Never over a world that exists: a double click or a second owner tab must not reseed everyone's history.
  const existing = await readMeta(db);
  if (existing) return existing;
  const meta: WorldMeta = { v: 1, seed: Math.floor(Math.random() * 1e9), epochMs: now - 6 * MS_PER_GAME_HOUR, msPerGameHour: MS_PER_GAME_HOUR, ruleset: RULESET };
  await db.doc("world/meta").set({ ...meta });
  return meta;
}

/** The most an action may take up in a player's document. */
const MAX_ACTION_CHARS = 8_192;
const MAX_NAME_CHARS = 32;

/** Keeps only well-formed entries. Bodies are cloned, since store snapshots are frozen and the engine keeps some action fields. */
export function parseActs(raw: unknown): ActRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: ActRecord[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const { s, at, a } = r as { s: unknown; at: unknown; a: unknown };
    if (!Number.isInteger(s) || (s as number) < 0 || !Number.isInteger(at) || (at as number) < 0) continue;
    if (!a || typeof a !== "object" || typeof (a as { type?: unknown }).type !== "string") continue;
    const text = JSON.stringify(a);
    if (text.length > MAX_ACTION_CHARS) continue;
    const body = JSON.parse(text) as LiveAction;
    if (body.type === "join") {
      // The engine takes these on trust, so they're shaped here.
      if (typeof body.name !== "string" || typeof body.hub !== "string") continue;
      body.name = body.name.slice(0, MAX_NAME_CHARS);
      body.look = body.look === "f" ? "f" : "m";
    }
    // The red team's re-check §1: a brokerage's order keeps the company that gave it, on every page and after every
    // re-read (dropped here, it acted for the carrier). The second re-check §1: the body's keys sorted at every depth, so
    // a store that keeps keys in its own order (as Postgres jsonb does) never makes this page's copy and the stored one
    // differ, which read as a rewrite and cost the sender's page a full replay on every order.
    const rec: ActRecord = { s: s as number, at: at as number, a: sortKeys(body) };
    if ((r as { as?: unknown }).as === "brokerage") rec.as = "brokerage";
    out.push(rec);
  }
  return out;
}

/** A value with every object's keys in sorted order, at every depth (arrays keep theirs). */
function sortKeys<T>(x: T): T {
  if (Array.isArray(x)) return x.map(sortKeys) as T;
  if (x && typeof x === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(x).sort()) out[k] = sortKeys((x as Record<string, unknown>)[k]);
    return out as T;
  }
  return x;
}

type Entry = { uid: string; r: ActRecord };
const before = (x: Entry, y: Entry) => x.r.at - y.r.at || (x.uid < y.uid ? -1 : x.uid > y.uid ? 1 : 0) || x.r.s - y.r.s;

export interface LiveOptions {
  now?: () => number;
  holder?: string;
  /** Tests: no renewal timer; the test fires `renewLease()` by hand (the red team's sequence). */
  manualRenewal?: boolean;
  /** The world owner's page: it keeps the list of orders that arrived stamped in the past (`earlyStamps`). */
  owner?: boolean;
  /** A monotonic clock (performance.now by default; tests move it apart from `now` to stand for a device clock changed). */
  mono?: () => number;
  /** The checkpoint's step 2a (cuts.ts): this browser's own local cuts, to start a replay from. Absent: from the seed. */
  cuts?: CutStore;
  /** The checkpoint's step 3 (cuts.ts): the shared, trusted checkpoint and the late-order rule. Absent: none of it. */
  shared?: SharedOptions;
}

/** Step 3: what a page with the shared checkpoint on is given. */
export interface SharedOptions {
  /** Where the bodies are read from (and, by the owner's page, written to: keeper.ts). */
  bodies: BodyStore;
  /** The owner's page keeps its newest cuts' texts, to upload one. */
  keepText?: boolean;
  /** The node replay (apps/sim live-days.ts): every day boundary is hashed, not only the recent ones. */
  everyDay?: boolean;
}

/** Step 3: a day boundary this page computed itself, as it reports it (keeper.ts). */
export interface OwnCut {
  day: number;
  t: number;
  /** The cut's hash (cuts.ts cutText); null until the text is hashed. */
  hash: string | null;
  /** The records it had applied, as marks in one text (cuts.ts marksKey). */
  marks: string;
  /** Where the replay that computed it started: "seed", "local:<minute>" or "cp:<day>". */
  from: string;
  /** The cut's text, on a page that keeps it (SharedOptions.keepText). */
  text: string | null;
}

/** A replay's start that isn't the seed: this browser's own cut, or a shared body. */
interface Base {
  kind: "local" | "shared";
  t: number;
  w: World;
  companies: [string, number][];
  /** Step 3: the records applied before it, as marks; the trusted body its world came from; its own hash, when known. */
  marks: Marks | null;
  since: { t: number; hash: string } | null;
  hash: string | null;
  /** A local cut's encoding (to make the cut's text again). */
  text: string | null;
}

/** Step 2a: the day boundaries a page keeps a local cut of, the ones within this many game minutes of its clock. */
const CUT_WINDOW_MIN = 2 * 24 * 60;
/** Step 3: how many of its own day hashes a page keeps. */
const OWN_DAYS = 6;

/** A gap between the wall clock and the monotonic one this large since the last lease call means the wall clock moved. */
const CLOCK_JUMP_MS = 5_000;

/**
 * An order that reached the owner's page stamped earlier than that page's shared clock by more than the lead and the
 * margins (persistence §2, the marker): for the owner only, never shown to players. A slow network can put an honest
 * player here; it marks, it never refuses or undoes (every page applies the order at its stamp).
 */
export interface EarlyStamp {
  /**
   * The red team's re-check §8: "early", a new record stamped in the past; "rewrite", a record the page held came back
   * with another body; "drop", a record the page held is gone from the player's document; "chunk", a record found in a
   * newly read archive chunk stamped within a game day (an honest page archives only records over a day old).
   */
  kind: "early" | "rewrite" | "drop" | "chunk";
  uid: string;
  s: number;
  /** The order's stamped game minute, and how many game minutes before this page's clock it was when it arrived. */
  at: number;
  minutesEarly: number;
  /** This page's game minute when it arrived. */
  seenAt: number;
}
/** The most early stamps an owner's page keeps (the latest). */
const EARLY_KEPT = 50;

export class LiveWorld {
  readonly kind = "live";
  w: World;
  /**
   * The player's companies (specs/brokerage-rule.md section 2): the carrier, and the brokerage once formed, at most one
   * of each. `player` is the company in view: what the screens show and the orders act for. Switching changes nothing
   * in the world.
   */
  carrier: Company | null = null;
  inView: "carrier" | "brokerage" = "carrier";
  /** Set only by tests; otherwise the brokerage is the carrier's partner (brokerage.ts), so it survives every replay. */
  private brokerageOverride: Company | null | undefined = undefined;
  get brokerage(): Company | null {
    if (this.brokerageOverride !== undefined) return this.brokerageOverride;
    const id = this.carrier?.partnerId;
    return id ? (this.w.companies[id - 1] ?? null) : null;
  }
  set brokerage(c: Company | null) {
    this.brokerageOverride = c;
  }
  get player(): Company | null {
    return this.inView === "brokerage" && this.brokerage ? this.brokerage : this.carrier;
  }
  set player(c: Company | null) {
    this.carrier = c;
  }
  /** True while this page is replaying history rather than keeping up with the clock. */
  replaying = true;
  /** This tab holds the player's writer lease and may send actions. */
  writer = false;
  /** Why it doesn't: another tab holds the lease, or this viewer can't write to the world. */
  lease: "held" | "busy" | "denied" | "none" = "none";
  /** Set when an action arrives for a moment already computed; the page then rebuilds from the log. */
  needRebuild = false;
  /** Set when the engine threw while replaying: the world can't go on until the log is repaired. */
  broken: { at: number; reason: string } | null = null;
  clockOffsetMs = 0;

  /** The owner's page only (LiveOptions.owner): orders that arrived stamped in the past, the latest EARLY_KEPT. */
  readonly earlyStamps: EarlyStamp[] = [];

  onOwnResult: ((r: ActRecord, res: ActionResult) => void) | null = null;
  onJoin: ((uid: string, c: Company) => void) | null = null;
  /** Sees the world after every hour it steps, the replay's included. It must only read: every page has to compute the same world. */
  onHour: ((w: World) => void) | null = null;
  private events: ((e: GameEvent) => void)[] = [];

  private logs = new Map<string, Map<number, ActRecord>>();
  private queue: Entry[] = [];
  private last: Entry | null = null;
  private companies = new Map<string, number>();
  private own: { acts: ActRecord[]; archived: number } = { acts: [], archived: 0 };
  private writes: Promise<void> = Promise.resolve();
  private unsub: (() => void) | null = null;
  private leaseTimer: ReturnType<typeof setInterval> | null = null;
  /** The last time (this page's clock) the lease was taken or renewed: a gap longer than its life means it was lost. */
  private leaseOkAt = -Infinity;
  /** The monotonic clock at leaseOkAt (the re-check §2: a wall clock moved after the page opened). */
  private leaseMono = -Infinity;
  /** The last lease call saw the device clock move during it (jumped), so its stamp wasn't taken. */
  private callJumped = false;
  private readonly mono: () => number;
  private readonly now: () => number;
  private readonly holder: string;
  private readonly manualRenewal: boolean;
  private readonly owner: boolean;
  private readonly cuts: CutStore | null;
  /** Step 2a: the game minute of the cut the last replay started from (this browser's own, or a shared body), or null from the seed. */
  startedFrom: number | null = null;
  /** Step 3: which it was. */
  startedKind: "seed" | "local" | "shared" = "seed";

  // --- Step 3: the shared checkpoint (cuts.ts). All of it is idle when `shared` is null. ---
  private readonly shared: SharedOptions | null;
  /** The store's world documents as last read whole: where the bodies are, the alarm, the cuts pages keep to (oldest first). */
  private pointer: Pointer = { bodies: [], gone: [] };
  private alarm: Alarm = noAlarm();
  private kept: KeptCut[] = [];
  /** The trusted body this page's world came from: the records before its minute are settled, never read again. */
  private since: { t: number; hash: string } | null = null;
  private get settled(): number {
    return this.since ? this.since.t : -Infinity;
  }
  /** Where the last replay started: its minute, and the records applied before it as marks. */
  private base: { t: number; marks: Marks } = { t: -Infinity, marks: [] };
  /** Per player, the records this world has applied: the highest sequence number, and how many. */
  private applied = new Map<string, [number, number]>();
  /** The day boundaries this page computed itself, by day. */
  private ownCuts = new Map<number, OwnCut>();
  /** Where the replay in force started, as own cuts say it. */
  private from = "seed";
  /** Bodies that failed their check (by asset id): never tried again by this page. */
  private avoid = new Set<string>();
  /** This page computed a kept day over the same records and got another hash: its own cuts from that minute on are passed over. */
  private offAt = Infinity;
  /** The kept cuts (minute:hash) it has started again for, once each: a body that can't be read never loops it. */
  private offTried = new Set<string>();
  /** The next replay starts before this minute (recompute), and hashes every boundary from it. */
  private rebaseBefore = Infinity;
  private recapFrom = Infinity;
  /** The orders this page sent, and the ones it has said were too late (by sequence number). */
  private sent = new Set<number>();
  private lateTold = new Set<number>();
  private unsubWorld: (() => void) | null = null;
  /** The rebuild pending came from a change in the kept cuts, not from an order that arrived late. */
  quietRebuild = false;
  /** One of this page's own orders reached the store after a kept cut had passed its minute: it is never carried out. */
  onLate: ((r: ActRecord) => void) | null = null;
  /** Past the first load: records ingested from here on arrived while this page watched. */
  private loaded = false;
  /** Half the round trip of the lease call that set this page's clock, in game minutes; null until it's set. */
  private clockErrMin: number | null = null;
  /**
   * Per player, the log's chunks as this page has them (players/<uid>/log/c00000 …): `read`, how many in a row from the
   * first it has read or written; `asked`, the highest count from the player's document it has acted on; `want`, the
   * count a read under way is going to; `busy`, that read. One read at a time per player.
   */
  private archives = new Map<string, { read: number; asked: number; want: number; busy: Promise<void> | null }>();
  private archiveOf(uid: string): { read: number; asked: number; want: number; busy: Promise<void> | null } {
    let a = this.archives.get(uid);
    if (!a) this.archives.set(uid, (a = { read: 0, asked: 0, want: 0, busy: null }));
    return a;
  }

  private constructor(
    readonly meta: WorldMeta,
    private readonly db: DbLike,
    readonly uid: string | null,
    o: LiveOptions,
  ) {
    this.now = o.now ?? Date.now;
    this.mono = o.mono ?? (() => performance.now());
    this.holder = o.holder ?? `tab-${Math.floor(Math.random() * 1e12).toString(36)}`;
    this.manualRenewal = o.manualRenewal === true;
    this.owner = o.owner === true;
    this.cuts = o.cuts ?? null;
    this.shared = o.shared ?? null;
    this.w = this.fresh();
  }

  /** Sends a report: appended to this player's reports document (at most the last few dozen). */
  async report(r: Omit<Report, "acts" | "ruleset">): Promise<void> {
    if (!this.uid) throw new Error("not signed in");
    const doc = this.db.doc(`reports/${this.uid}`);
    const snap = await doc.get();
    const items = ((snap.exists ? snap.data()?.items : null) as Report[] | undefined) ?? [];
    const acts = this.own.acts.slice(-10).map((a) => ({ type: a.a.type, at: a.at }));
    items.push({ ...r, ruleset: this.meta.ruleset, acts });
    await doc.set({ items: items.slice(-REPORTS_KEPT) });
  }

  /** Loads the log, takes the writer lease if it can, and subscribes for other players' actions. */
  static async open(db: DbLike, meta: WorldMeta, uid: string | null, o: LiveOptions = {}): Promise<LiveWorld> {
    const lw = new LiveWorld(meta, db, uid, o);
    await lw.load();
    lw.loaded = true;
    if (uid) await lw.takeLease();
    lw.subscribe();
    return lw;
  }

  /** Current game time in minutes, from the shared clock. */
  gameMinute(): number {
    return (this.now() + this.clockOffsetMs - this.meta.epochMs) / MS_PER_GAME_MIN;
  }

  /** Real milliseconds until a game minute arrives. */
  msUntil(gameMin: number): number {
    return (gameMin - this.gameMinute()) * MS_PER_GAME_MIN;
  }

  onEvent(fn: (e: GameEvent) => void): void {
    this.events.push(fn);
  }

  isPlayer(uid: string): boolean {
    return this.companies.has(uid);
  }

  /** This player's actions sent but not yet in effect. */
  pending(): ActRecord[] {
    if (!this.uid) return [];
    return this.queue.filter((e) => e.uid === this.uid).map((e) => e.r);
  }

  /**
   * Runs the world up to the clock, within a time budget. Returns true once it has
   * caught up. Actions apply at their minute; the hour steps when the clock passes it.
   */
  advance(budgetMs: number): boolean {
    if (this.broken) return true;
    const end = performance.now() + budgetMs;
    const now = this.gameMinute();
    while (performance.now() < end) {
      const hourEnd = this.w.t + 60;
      while (this.queue.length && this.queue[0]!.r.at < hourEnd && this.queue[0]!.r.at <= now) this.apply(this.queue.shift()!);
      if (now < hourEnd) {
        this.replaying = false;
        return true;
      }
      try {
        stepHour(this.w, ruleBotHook);
      } catch (e) {
        // The engine should never throw on replayed input; if it does, stop here and say so rather than freeze every page silently.
        this.broken = { at: this.w.t, reason: (e as { message?: string })?.message ?? String(e) };
        this.replaying = false;
        return true;
      }
      // The screen's read of the hour, apart from the engine's try: a page's own error never marks the world broken.
      booksAfterHour(this.w);
      // Step 2a: a recent day boundary, before any order stamped at its minute applies, becomes a local cut (cuts.ts).
      // Step 3: the same boundary, hashed as every page hashes it (the owner's recompute and the node replay take older ones too).
      if ((this.cuts || this.shared) && this.w.t % (24 * 60) === 0 && !this.needRebuild && (this.w.t >= now - CUT_WINDOW_MIN || this.w.t >= this.recapFrom || this.shared?.everyDay === true)) this.captureCut();
      try {
        this.onHour?.(this.w);
      } catch (e) {
        console.error(e);
      }
    }
    return false;
  }

  /**
   * Replays the log, a slice at a time: from this browser's newest local cut whose records still match the store's (step
   * 2a, cuts.ts), else from the seed.
   */
  async rebuild(onProgress?: (share: number) => void): Promise<void> {
    this.needRebuild = false;
    this.quietRebuild = false;
    this.replaying = true;
    this.startedFrom = null;
    this.startedKind = "seed";
    const startBefore = this.rebaseBefore;
    this.rebaseBefore = Infinity;
    const cut = await this.bestCut(startBefore);
    this.player = null;
    this.companies.clear();
    this.last = null;
    this.queue = [];
    if (cut) {
      this.w = cut.w;
      this.startedFrom = cut.t;
      this.startedKind = cut.kind;
      for (const [uid, id] of cut.companies) {
        this.companies.set(uid, id);
        if (uid === this.uid) this.player = this.w.companies[id - 1] ?? null;
      }
    } else this.w = this.fresh();
    if (this.shared) this.rebased(cut);
    // The records the cut had applied are behind it (the last of them, for the late check); the rest are to apply.
    const from = cut ? cut.t : -Infinity;
    const all: Entry[] = [];
    for (const [uid, log] of this.logs) for (const r of log.values()) all.push({ uid, r });
    all.sort(before);
    for (const e of all) {
      // Step 3, the late-order rule: a settled record, or one a kept cut left out, is never applied.
      if (this.shared && this.inert(e.uid, e.r)) {
        this.late(e.uid, e.r);
        continue;
      }
      if (e.r.at < from) this.last = e;
      else this.queue.push(e);
    }
    const target = Math.max(1, this.gameMinute());
    while (!this.advance(30)) {
      onProgress?.(Math.min(1, this.w.t / target));
      await new Promise((r) => setTimeout(r, 0));
    }
    onProgress?.(1);
  }

  /** Sends one of this player's actions. It takes effect at the returned game minute. */
  /** Sends one of this player's actions, for the company in view or for `as`. It takes effect at the returned game minute. */
  async submit(a: LiveAction, as: "brokerage" | "carrier" | undefined = this.inView === "brokerage" && this.brokerage ? "brokerage" : "carrier"): Promise<ActRecord> {
    if (!this.uid || !this.writer) throw new Error(PENDING.liveWatching);
    if (a.type !== "join" && !this.player) throw new Error("Your company isn't registered yet");
    if (a.type === "join" && (this.companies.has(this.uid) || this.own.acts.some((r) => r.a.type === "join"))) throw new Error("You already have a company");
    // One carrier and one brokerage per uid (brokerage-rule.md section 8; the server holds it per person later).
    if (a.type === "form_brokerage" && (this.brokerage || this.pending().some((r) => r.a.type === "form_brokerage"))) throw new Error("You already have a brokerage");
    // The red team's stale writer (persistence §1): a lease not renewed within its life was lost while this tab slept or was
    // cut off; take it again (re-reading what another device wrote) before writing, or refuse if another tab holds it.
    // The re-check §2: a lease past its life, or a wall clock that moved since the last lease call, is retaken first,
    // which re-reads the document and re-stamps this page's clock from the store.
    if (this.leaseLost() && !(await this.retakeLease())) throw new Error(this.callJumped ? PENDING.liveClockOff : PENDING.liveWatching);
    const uid = this.uid;
    // The write appends after whatever the store holds (writeOwn), so the record is made inside it.
    const r = await this.writeOwn((own) => {
      const prev = own.acts.at(-1);
      const nextS = prev ? prev.s + 1 : own.archived > 0 ? this.maxSeq(uid) + 1 : 0;
      // The second re-check §3: at the clock's upper bound (the estimate plus half the last lease call's round trip), so a
      // slow or held lease reply never puts an order in the past; the refusal below reads the same bound.
      const now = Math.ceil(this.gameMinute() + (this.clockErrMin ?? 0));
      const at = Math.max(prev?.at ?? 0, now + LEAD_MIN);
      // Persistence §2, the honest half: the stamp is this page's server-set clock plus the lead. One pushed further out
      // by an earlier order stamped on a wrong clock is refused; a lead's slack lets a small correction of this page's
      // clock between two quick orders through.
      // The third re-check, finding 1: widened by the lease's life, so a lease request a stall held and then let through
      // (its upper bound pushed later by half the stall) never refuses an honest player's next orders.
      if (at > now + 2 * LEAD_MIN + LEASE_TTL_MS / MS_PER_GAME_MIN) throw new Error(PENDING.liveClockOff);
      return as === "brokerage" ? { s: nextS, at, a, as } : { s: nextS, at, a };
    });
    if (this.shared) this.sent.add(r.s);
    this.ingest(this.uid, [r]);
    return r;
  }

  close(): void {
    this.unsub?.();
    this.unsubWorld?.();
    if (this.leaseTimer) clearInterval(this.leaseTimer);
  }

  // --- internals --------------------------------------------------------------------

  private fresh(): World {
    return this.attach(newWorld(this.meta.seed));
  }

  // --- Step 2a: local cuts (cuts.ts) -----------------------------------------------------------

  /** Which world a cut belongs to: the seed, the epoch and the ruleset. */
  worldKey(): string {
    return `${this.meta.seed}:${this.meta.epochMs}:${this.meta.ruleset}`;
  }

  /**
   * Every record stamped before `t`, in the order the world applies them, as one text: what a cut at `t` had applied. With
   * the shared checkpoint on, only the records that count under the kept cuts, and only those since `from` (the trusted body
   * the cut's world came from: what is before it is settled, and may be rewritten in the store without a page caring).
   */
  private recordsBefore(t: number, from = -Infinity): string {
    const out: Entry[] = [];
    for (const [uid, log] of this.logs) for (const r of log.values()) if (r.at < t && r.at >= from && (!this.shared || countsUnder(this.kept, uid, r.s, r.at))) out.push({ uid, r });
    out.sort(before);
    return out.map((e) => `${e.uid}\u0000${JSON.stringify(e.r)}`).join("\n");
  }

  /**
   * The world now, at a day boundary: saved as a local cut with the digest of what it applied, the oldest pruned (step 2a);
   * and hashed as every page hashes it, with the records applied as marks, for this page to report (step 3).
   */
  private captureCut(): void {
    const t = this.w.t;
    let text: string;
    try {
      text = encodeWorld(this.w, cutExtras(this.w));
    } catch (e) {
      console.error(e);
      return;
    }
    const companies = [...this.companies];
    const world = this.worldKey();
    let marks: Marks | null = null;
    let hashed: Promise<string | null> = Promise.resolve(null);
    if (this.shared) {
      marks = marksOf(this.applied);
      const full = cutText({ world, build: REPLAY_BUILD, t, marks, companies }, text);
      const own: OwnCut = { day: t / (24 * 60), t, hash: null, marks: marksKey(marks), from: this.from, text: this.shared.keepText ? full : null };
      this.noteOwn(own);
      hashed = sha256(full).then(
        (h) => {
          // Only if a later replay hasn't computed the day again meanwhile.
          if (this.ownCuts.get(own.day) === own) {
            own.hash = h;
            this.checkOff();
          }
          return h;
        },
        (e) => {
          console.error(e);
          return null;
        },
      );
    }
    if (!this.cuts) return;
    const since = this.since;
    const list = this.recordsBefore(t, this.shared ? this.settled : -Infinity);
    const cuts = this.cuts;
    void (async () => {
      const digest = await sha256(list);
      const hash = await hashed;
      const head: CutHead = { key: `${world}|${REPLAY_BUILD}|${t}`, world, build: REPLAY_BUILD, t, digest };
      if (marks) head.marks = marks;
      if (hash) head.hash = hash;
      if (since) head.since = since;
      await cuts.put({ ...head, text, companies });
      const mine = (await cuts.list(world)).sort((a, b) => b.t - a.t);
      for (const old of mine.slice(CUTS_KEPT)) await cuts.delete(old.key);
    })().catch((e) => console.error(e));
  }

  /**
   * Where a replay starts, the newest that holds: this browser's own cut of this world and this replay build whose applied
   * records are exactly the store's records before it (step 2a), or a shared body a page may start from, its text hashing
   * to its pointer's hash (step 3). Restored, with what it carries beside the world (cuts.ts cutExtras) back on. Null: the
   * seed. `startBefore`: only cuts before that minute (the owner's recompute).
   */
  private async bestCut(startBefore = Infinity): Promise<Base | null> {
    const target = this.gameMinute();
    const world = this.worldKey();
    const cands: { t: number; local?: CutHead; body?: BodyRef; cut?: KeptCut }[] = [];
    if (this.cuts) {
      try {
        for (const h of await this.cuts.list(world)) if (h.build === REPLAY_BUILD && h.t <= target && h.t < startBefore) cands.push({ t: h.t, local: h });
      } catch {
        /* no storage: no local cuts */
      }
    }
    if (this.shared) {
      for (const b of this.pointer.bodies) {
        if (b.t > target || b.t >= startBefore || this.avoid.has(b.asset)) continue;
        const cut = adoptable(b, this.kept, this.alarm, world, REPLAY_BUILD);
        if (cut) cands.push({ t: b.t, body: b, cut });
      }
    }
    // The newest first; at the same minute this browser's own cut before the body (nothing to fetch).
    cands.sort((x, y) => y.t - x.t || (x.local ? -1 : 1));
    for (const c of cands) {
      const got = c.local ? await this.fromLocal(c.local) : await this.fromBody(c.body!, c.cut!);
      if (got) return got;
    }
    return null;
  }

  /** This browser's own cut, if its applied records are still exactly the store's (and, step 3, it isn't of a world this page left). */
  private async fromLocal(h: CutHead): Promise<Base | null> {
    if (!this.cuts) return null;
    let since = h.since ?? null;
    if (this.shared) {
      // A cut that disagrees with the kept one of its minute, one from a body no longer kept, or one this page made
      // after it parted from a kept day: passed over.
      const at = this.kept.find((k) => k.t === h.t && k.build === REPLAY_BUILD);
      if (at && h.hash && h.hash !== at.hash) return null;
      if (since && !this.kept.some((k) => k.t === since!.t && k.hash === since!.hash)) return null;
      if (h.t >= this.offAt && !(since && since.t >= this.offAt) && !(at && h.hash === at.hash)) return null;
    } else since = null;
    const from = since ? since.t : -Infinity;
    const list = this.recordsBefore(h.t, from);
    if ((await sha256(list)) !== h.digest) return null; // a late, rewritten or erased record before it
    const cut = await this.cuts.get(h.key).catch(() => null);
    if (!cut || cut.digest !== h.digest) return null;
    if (this.recordsBefore(h.t, from) !== list) return null; // a record came in while the cut was read
    try {
      const fresh = newWorld(this.meta.seed);
      const { w, extras } = decodeWorld(cut.text, { cfg: fresh.cfg, net: fresh.net, feeds: fresh.feeds });
      restoreCutExtras(w, extras as CutExtras);
      // Byte for byte the kept cut of its minute: everything before it is settled, as from that cut's body.
      if (this.shared && h.hash && this.kept.some((k) => k.t === h.t && k.hash === h.hash && k.build === REPLAY_BUILD)) since = { t: h.t, hash: h.hash };
      return { kind: "local", t: h.t, w: this.attach(w), companies: cut.companies, marks: h.marks ?? null, since, hash: h.hash ?? null, text: cut.text };
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  // --- Step 3: the shared, trusted checkpoint (cuts.ts) -----------------------------------------

  /**
   * A shared body a page may start from (cuts.ts adoptable): read, unpacked within its size cap, and checked before
   * anything is decoded: its text hashes to the pointer's hash, whole, and its line names this world, this replay build,
   * the pointer's minute and the kept cut's marks. One that fails is never tried again; one that can't be read is.
   */
  private async fromBody(b: BodyRef, kept: KeptCut): Promise<Base | null> {
    const packed = await this.shared!.bodies.get(b.asset).catch(() => null);
    if (!packed) return null;
    const bad = (why: string): null => {
      this.avoid.add(b.asset);
      console.error(`[checkpoint] day ${b.day}'s body isn't used: ${why}`);
      return null;
    };
    const text = await unpackBody(packed);
    if (text === null) return bad("it doesn't unpack");
    if ((await sha256(text)) !== b.hash) return bad("its hash isn't its pointer's");
    const cut = readCut(text);
    if (!cut || cut.line.world !== this.worldKey() || cut.line.build !== REPLAY_BUILD || cut.line.t !== b.t || marksKey(cut.line.marks) !== kept.marksKey) return bad("its first line isn't its pointer's");
    try {
      const fresh = newWorld(this.meta.seed);
      const { w, extras } = decodeWorld(cut.encoding, { cfg: fresh.cfg, net: fresh.net, feeds: fresh.feeds });
      restoreCutExtras(w, extras as CutExtras);
      return { kind: "shared", t: b.t, w: this.attach(w), companies: cut.line.companies, marks: cut.line.marks, since: { t: b.t, hash: b.hash }, hash: b.hash, text: null };
    } catch (e) {
      return bad(String((e as { message?: string })?.message ?? e));
    }
  }

  /** A replay's start is chosen (null: the seed): what's settled, the marks so far, and which own cuts still stand. */
  private rebased(cut: Base | null): void {
    this.since = cut ? cut.since : null;
    const t = cut ? cut.t : -Infinity;
    // A local cut from before the switch-on carries no marks: they are those of the records before it, which its digest
    // covered (counted from the seed, so from an empty start).
    this.base = { t: -Infinity, marks: [] };
    if (cut) this.base = { t, marks: cut.marks ?? this.marksBefore(t) };
    this.applied = new Map(this.base.marks.map((m) => [m[0], [m[1], m[2]]]));
    this.from = !cut ? "seed" : cut.kind === "shared" ? `cp:${cut.t / (24 * 60)}` : `local:${cut.t}`;
    // The days after the start are computed again on the way (the recent ones); the days before it stand as they were.
    for (const [day, c] of [...this.ownCuts]) if (c.t > t || (c.t === t && c.marks !== marksKey(this.base.marks))) this.ownCuts.delete(day);
    // Started from this browser's own cut: that day is its own computation still, to report (and, the owner's, to upload).
    if (cut?.kind === "local" && cut.hash && cut.marks && !this.ownCuts.has(t / (24 * 60))) {
      const full = this.shared!.keepText && cut.text !== null ? cutText({ world: this.worldKey(), build: REPLAY_BUILD, t, marks: cut.marks, companies: cut.companies }, cut.text) : null;
      this.noteOwn({ day: t / (24 * 60), t, hash: cut.hash, marks: marksKey(cut.marks), from: this.from, text: full });
    }
  }

  /** Keeps an own cut: the newest few days, and the texts of the newest two (the node replay keeps every day). */
  private noteOwn(own: OwnCut): void {
    this.ownCuts.set(own.day, own);
    const days = [...this.ownCuts.keys()].sort((a, b) => b - a);
    if (!this.shared?.everyDay) for (const d of days.slice(OWN_DAYS)) this.ownCuts.delete(d);
    for (const d of days.slice(2)) {
      const c = this.ownCuts.get(d);
      if (c) c.text = null;
    }
  }

  /**
   * The late-order rule on this page (cuts.ts countsUnder; the red team's findings 6 and 7): a record is inert when it is
   * stamped before the trusted body this page's world came from (it is in that body, or it was left out for good), or when
   * a kept cut after its minute hadn't applied it. An inert record is never applied and never makes this page replay.
   */
  private inert(uid: string, r: ActRecord): boolean {
    return r.at < this.settled || !countsUnder(this.kept, uid, r.s, r.at);
  }

  /** One of this page's own orders, sent from here, that a kept cut left out: said once (finding 5). */
  private late(uid: string, r: ActRecord): void {
    if (uid !== this.uid || !this.sent.has(r.s) || this.lateTold.has(r.s) || countsUnder(this.kept, uid, r.s, r.at)) return;
    this.lateTold.add(r.s);
    try {
      this.onLate?.(r);
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * The marks of the records this world has applied before `t` (a minute at or after the replay's start), under `kept`:
   * the start's marks and every record since that counts. With no replay pending, what `applied` held at `t`.
   */
  private marksBefore(t: number, kept: readonly KeptCut[] = this.kept): Marks {
    const m = new Map<string, [number, number]>(this.base.marks.map((x) => [x[0], [x[1], x[2]]]));
    for (const [uid, log] of this.logs) {
      for (const r of log.values()) {
        if (r.at < this.base.t || r.at >= t || r.at < this.settled || !countsUnder(kept, uid, r.s, r.at)) continue;
        const e = m.get(uid);
        if (!e) m.set(uid, [r.s, 1]);
        else {
          if (r.s > e[0]) e[0] = r.s;
          e[1]++;
        }
      }
    }
    return marksOf(m);
  }

  /**
   * The store's world documents, read whole (never a saved copy): where the bodies are, the alarm, and the cuts pages keep
   * to. A cut newly kept, or one withdrawn, changes which records count; unless this page's world had applied exactly the
   * new cut's records before it, the page replays under the rule.
   */
  private worldDocs(docs: SnapLike[]): void {
    const world = this.worldKey();
    let pointer: Pointer = { bodies: [], gone: [] };
    let alarmRaw: unknown;
    const trust: TrustDoc[] = [];
    for (const d of docs) {
      const body = d.data();
      if (!body) continue;
      if (d.id === "checkpoint") pointer = parsePointer(body);
      else if (d.id === "alarm") alarmRaw = body;
      else if (d.id.startsWith("cpm-")) {
        const t = parseTrust(body);
        if (t && d.id === `cpm-${t.day}`) trust.push(t);
      }
    }
    const was = this.kept;
    this.pointer = pointer;
    this.alarm = parseAlarm(alarmRaw, world);
    this.kept = keptCuts(trust, this.alarm, world);
    const key = (k: KeptCut): string => `${k.t}:${k.hash}`;
    const had = new Set(was.map(key));
    const has = new Set(this.kept.map(key));
    // This world came from a body that is no longer kept (withdrawn): it starts again without it.
    let redo = this.since !== null && !has.has(`${this.since.t}:${this.since.hash}`);
    for (const k of this.kept) {
      if (had.has(key(k)) || k.t <= this.settled) continue;
      if (this.replaying || k.t > this.w.t || k.t < this.base.t || marksKey(this.marksBefore(k.t, was)) !== k.marksKey) redo = true;
    }
    // A cut withdrawn: what it left out may count again.
    for (const k of was) if (!has.has(key(k)) && k.t > this.settled) redo = true;
    if (redo && !this.needRebuild) {
      this.needRebuild = true;
      this.quietRebuild = true;
    }
    this.checkOff();
  }

  /**
   * This page against the newest kept cut of its replay build that it computed itself (and still stands by):
   *  - the same hash: its world at that minute IS the kept cut, byte for byte, so the records before it are settled here
   *    too, exactly as on a page that started from the cut's body (a rewrite or an erasure of one never replays it);
   *  - another hash, over the same records: its world isn't the one pages keep to. It starts again from that cut's body,
   *    when one may be started from, and its own cuts from that minute on are passed over. Its report of the day stands
   *    (keeper.ts): that is the disagreement the alarm is for.
   */
  private checkOff(): void {
    if (!this.shared) return;
    let mine: OwnCut[] | null = null;
    for (let i = this.kept.length - 1; i >= 0; i--) {
      const k = this.kept[i]!;
      if (k.t <= this.settled) return; // this world already comes from a kept cut at or after it
      if (k.build !== REPLAY_BUILD || k.t > this.w.t) continue;
      const own = (mine ??= this.ownDays()).find((c) => c.day === k.day);
      if (!own || own.marks !== k.marksKey) continue;
      if (own.hash === k.hash) {
        if (this.needRebuild) return;
        this.since = { t: k.t, hash: k.hash };
        this.base = { t: k.t, marks: JSON.parse(k.marksKey) as Marks };
        return;
      }
      const body = this.pointer.bodies.find((b) => b.day === k.day && b.hash === k.hash);
      if (!body || this.avoid.has(body.asset) || !adoptable(body, this.kept, this.alarm, this.worldKey(), REPLAY_BUILD)) continue;
      if (this.offTried.has(`${k.t}:${k.hash}`)) return;
      this.offTried.add(`${k.t}:${k.hash}`);
      this.offAt = Math.min(this.offAt, k.t);
      if (!this.needRebuild) {
        this.needRebuild = true;
        this.quietRebuild = true;
      }
      return;
    }
  }

  private subscribeWorld(): void {
    this.unsubWorld = this.db.collection("world").onSnapshot(
      (snap) => {
        if (snap.metadata?.fromCache !== true) this.worldDocs(snap.docs);
      },
      () => {
        setTimeout(() => this.subscribeWorld(), 5000);
      },
    );
  }

  // What the keeper reads and asks (keeper.ts: a page's day reports, and the owner's checkpoint).

  /** Whether this tab holds the player's lease now, its clock the store's. */
  leaseFresh(): boolean {
    return this.writer && !this.leaseLost();
  }

  /** Every player this page has heard of. */
  players(): string[] {
    return [...this.logs.keys()];
  }

  /** The store's world documents as this page last read them. */
  sharedView(): { pointer: Pointer; alarm: Alarm; kept: readonly KeptCut[] } {
    return { pointer: this.pointer, alarm: this.alarm, kept: this.kept };
  }

  /**
   * The day boundaries this page computed itself and stands by now, newest first: hashed; over the same records as the
   * kept cut of that day, where there is one (a page that had applied a record the cut left out doesn't dispute it: it
   * computes the day again under the rule); and, for the days this replay computed, its records unchanged since.
   */
  ownDays(): OwnCut[] {
    const out: OwnCut[] = [];
    for (const c of this.ownCuts.values()) {
      if (!c.hash) continue;
      const k = this.kept.find((x) => x.t === c.t);
      if (k && k.marksKey !== c.marks) continue;
      if (c.t >= this.base.t && c.marks !== marksKey(this.marksBefore(c.t))) continue;
      out.push(c);
    }
    return out.sort((a, b) => b.t - a.t);
  }

  /**
   * Every player's orders read again, the store's own answer (the red team's finding 5: the owner's page writes a
   * checkpoint only after this, so an order every other page heard in time is never left out through this page's lag).
   * False when the store's answer was a saved copy, for the players and then for any one player's document: nothing can
   * be said then. What it brings in is taken as any snapshot's is; the caller looks at needRebuild after.
   */
  async reread(): Promise<boolean> {
    await this.writes;
    const snap = await this.db.collection("players").get();
    let docs = snap.docs;
    if (snap.metadata?.fromCache === true) {
      docs = [];
      const uids = [...this.logs.keys()];
      for (let i = 0; i < uids.length; i += 6) {
        const got = await Promise.all(uids.slice(i, i + 6).map((u) => this.db.doc(`players/${u}`).get()));
        if (got.some((d) => d.metadata?.fromCache === true)) return false;
        docs.push(...got);
      }
    }
    for (const d of docs) {
      const body = d.data();
      if (!body || (d.id === this.uid && this.writer)) continue; // this tab writes its own log itself
      const acts = parseActs(body.acts);
      this.dropMissing(d.id, acts);
      this.ingest(d.id, acts, true);
      await this.readArchive(d.id, body.archived);
    }
    return true;
  }

  /**
   * The owner's page, answering a report against its cut of a day (finding 3): it replays from a start before `t`, the
   * cut before or this browser's own, and hashes that boundary again.
   */
  recompute(t: number): void {
    this.rebaseBefore = t;
    this.recapFrom = Math.min(this.recapFrom, t);
    this.needRebuild = true;
    this.quietRebuild = true;
  }

  /** The page's listener on a world, a fresh one or one restored from a cut. */
  private attach(w: World): World {
    w.listener = (e) => {
      if (this.replaying) return;
      // A screen's handler that throws must not abort the engine's hour (the red team, persistence §6): it would mark the
      // world broken in advance's try. The page's error is logged; the world goes on.
      for (const l of this.events) {
        try {
          l(e);
        } catch (err) {
          console.error(err);
        }
      }
    };
    return w;
  }

  private maxSeq(uid: string): number {
    let m = -1;
    for (const s of this.logs.get(uid)?.keys() ?? []) m = Math.max(m, s);
    return m;
  }

  private async load(): Promise<void> {
    // Step 3: the kept cuts first, so the records are read under them. A saved copy is passed over: the subscription's
    // definitive answer brings them, and the page replays then if they change what counts.
    if (this.shared) {
      const world = await this.db.collection("world").get();
      if (world.metadata?.fromCache !== true) this.worldDocs(world.docs);
    }
    const players = await this.db.collection("players").get();
    const archivedOf: [string, number][] = [];
    for (const d of players.docs) {
      const body = d.data();
      if (!body) continue;
      this.ingest(d.id, parseActs(body.acts));
      const archived = archiveCount(body.archived, 0);
      if (archived > 0) archivedOf.push([d.id, archived]);
      if (d.id === this.uid) this.own = { acts: parseActs(body.acts), archived };
    }
    // Player documents first, then their archives: an archive is always written before the document drops those entries.
    for (let i = 0; i < archivedOf.length; i += 6) {
      await Promise.all(
        archivedOf.slice(i, i + 6).map(async ([uid, archived]) => {
          const chunks = await this.db.collection(`players/${uid}/log`).get();
          // The chunks the document counts, in a row from the first: the same ones a page already open reads (readArchive).
          const byId = new Map(chunks.docs.map((c) => [c.id, c]));
          const a = this.archiveOf(uid);
          while (a.read < archived) {
            const c = byId.get(chunkId(a.read));
            if (!c?.exists) break;
            this.ingest(uid, parseActs(c.data()?.acts));
            a.read++;
          }
          a.asked = a.want = archived;
        }),
      );
    }
    this.needRebuild = false;
  }

  private subscribe(): void {
    if (this.shared && !this.unsubWorld) this.subscribeWorld();
    this.unsub = this.db.collection("players").onSnapshot(
      (snap) => {
        // The second re-check §4: the store marks fromCache a copy saved on an earlier visit, a collection too large to read
        // whole, or a delivery in a connectivity gap. Such a snapshot brings in new entries, but is never read as a rewrite
        // and never drops one: only the store's definitive answer does (a skip would leave every page deaf to the others
        // once the players collection is that large).
        const cached = snap.metadata?.fromCache === true;
        for (const d of snap.docs) {
          if (d.id === this.uid && this.writer) continue; // this tab writes that log itself
          const body = d.data();
          if (body) {
            const acts = parseActs(body.acts);
            if (!cached) this.dropMissing(d.id, acts);
            this.ingest(d.id, acts, true, cached);
            // Chunks archived while this page wasn't hearing (asleep, offline): read before they're missed for good.
            if (archiveCount(body.archived, 0) > this.archiveOf(d.id).want) void this.readArchive(d.id, body.archived).catch((e) => console.error(e));
          }
        }
      },
      () => {
        // A dead subscription: try again shortly, so the world keeps hearing other players.
        setTimeout(() => this.subscribe(), 5000);
      },
    );
  }

  private async takeLease(): Promise<boolean> {
    const doc = this.db.doc(`players/${this.uid}/x/tab`);
    const t0 = this.now();
    const m0 = this.mono();
    let res: { acquired: boolean; expiresAt?: string };
    try {
      res = await doc.acquire({ holder: this.holder, ttlMs: LEASE_TTL_MS });
    } catch {
      this.lease = "denied";
      return (this.writer = false);
    }
    const t1 = this.now();
    const m1 = this.mono();
    if (!res.acquired) {
      this.lease = "busy";
      return (this.writer = false);
    }
    if (!this.leaseTimer && !this.manualRenewal) this.leaseTimer = setInterval(() => void this.renewLease(), 30_000);
    this.writer = true;
    this.lease = "held";
    // The second re-check §3: the device clock moved during the call. The reply's stamp can't be placed, so it isn't
    // taken: the lease is held, but counted as lost, and the next order takes it again.
    if (this.jumped(t0, t1, m0, m1)) return false;
    // The lease's expiry is stamped by the store, which gives this page the shared clock. Always (persistence §2): a large
    // drift is the one that matters, and with no lease a tab can't write anyway.
    this.stampClock(res.expiresAt, t0, t1);
    this.leaseOkAt = t1;
    this.leaseMono = m1;
    return true;
  }

  /**
   * The renewal (every 30 s, or by hand in tests). Held again after a gap longer than the lease's life, or after a renewal
   * that failed, the lease was lost meanwhile (persistence §1: a sleeping device, a cut network): re-read what another
   * device wrote before this tab writes again. A failed renewal leaves the tab watching until one succeeds.
   */
  async renewLease(): Promise<void> {
    if (!this.uid) return;
    const doc = this.db.doc(`players/${this.uid}/x/tab`);
    const lapsed = this.leaseLost();
    try {
      const t0 = this.now();
      const m0 = this.mono();
      const r = await doc.acquire({ holder: this.holder, ttlMs: LEASE_TTL_MS });
      const t1 = this.now();
      const m1 = this.mono();
      const had = this.writer && !lapsed;
      this.writer = r.acquired;
      this.lease = r.acquired ? "held" : "busy";
      if (!r.acquired) return;
      // The second re-check §3: a clock moved during the call; nothing stamped, and the next order or renewal retakes.
      if (this.jumped(t0, t1, m0, m1)) return;
      // The re-check §2: the store stamps every renewal, so this page's clock is re-read from it each time (a device clock
      // changed after the page opened, either way, never stamps an order off the shared clock for long).
      this.stampClock(r.expiresAt, t0, t1);
      this.leaseOkAt = t1;
      this.leaseMono = m1;
      // Back in charge after another tab had it, after a gap, after a failed renewal or a moved clock: pick up whatever was
      // written, in the write chain (the re-check §6: a re-read answered late never overtakes an order sent meanwhile).
      if (!had) await this.chained(() => this.rereadOwn());
    } catch {
      this.writer = false; // until a renewal succeeds: a tab that may have lost the lease doesn't write
    }
  }

  /**
   * Whether the lease must be taken again before writing (the re-check §2): past its life by the wall clock or the
   * monotonic one, or the two disagree by more than CLOCK_JUMP_MS since the last lease call (the device clock was set
   * back or forward; on macOS a sleep that stops the monotonic clock reads the same, and wants a retake anyway).
   */
  private leaseLost(): boolean {
    const wall = this.now() - this.leaseOkAt;
    const mono = this.mono() - this.leaseMono;
    return !(wall <= LEASE_TTL_MS && mono <= LEASE_TTL_MS && Math.abs(wall - mono) <= CLOCK_JUMP_MS);
  }

  /**
   * Whether the wall clock and the monotonic one disagreed over a lease call by more than CLOCK_JUMP_MS (the second
   * re-check §3). When they did, the lease counts as lost (leaseOkAt), so the next order retakes it on a still clock.
   */
  private jumped(t0: number, t1: number, m0: number, m1: number): boolean {
    this.callJumped = Math.abs(t1 - t0 - (m1 - m0)) > CLOCK_JUMP_MS;
    if (this.callJumped) this.leaseOkAt = -Infinity;
    return this.callJumped;
  }

  /** This page's clock from a lease's server stamp (`expiresAt`), taken between t0 and t1 by this page's clock. */
  private stampClock(expiresAt: string | undefined, t0: number, t1: number): void {
    const server = expiresAt ? Date.parse(expiresAt) - LEASE_TTL_MS : NaN;
    const offset = server - (t0 + t1) / 2;
    if (!Number.isFinite(offset)) return;
    this.clockOffsetMs = offset;
    this.clockErrMin = (t1 - t0) / 2 / MS_PER_GAME_MIN;
  }

  /** Runs `f` in the write chain (after every write sent before it), and waits for it. */
  private chained<T>(f: () => Promise<T>): Promise<T> {
    const job = this.writes.then(f);
    this.writes = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  }

  /** Tries to make this tab the writer again (after another tab let go). */
  async retakeLease(): Promise<boolean> {
    const ok = await this.takeLease();
    if (ok && this.uid) await this.chained(() => this.rereadOwn());
    return ok;
  }

  /** This player's document as the store has it: this tab's list becomes it, and what another device wrote joins the world. */
  private async rereadOwn(): Promise<void> {
    const snap = await this.db.doc(`players/${this.uid}`).get();
    const body = snap.data();
    this.own = { acts: parseActs(body?.acts), archived: body ? archiveCount(body.archived, this.own.archived) : 0 };
    await this.readArchive(this.uid!, this.own.archived);
    this.dropMissing(this.uid!, this.own.acts);
    this.ingest(this.uid!, this.own.acts);
  }

  /**
   * A player's archive chunks this page hasn't read, up to the count the player's document gives (persistence §1, the
   * archive edge): another device that wrote more than a chunk while this page slept moved orders this page never saw out
   * of the document. Older orders, so the page rebuilds (ingest), and never marked early.
   *
   * `archived` is the document's own field (archiveCount). One read at a time per player: a count that asks for nothing
   * new waits for the read under way, if there is one, and a higher count carries that read further. The read takes the
   * chunks in a row from the last it has and ends at the count or at the first chunk that isn't there, so it is never
   * more than MAX_ARCHIVE_CHUNKS reads for a player.
   */
  private readArchive(uid: string, archived: unknown): Promise<void> {
    const a = this.archiveOf(uid);
    const count = archiveCount(archived, a.asked);
    if (count > a.want) a.want = count;
    if (a.want <= a.asked) return a.busy ?? Promise.resolve();
    a.busy ??= this.readChunks(uid, a).finally(() => {
      a.busy = null;
    });
    return a.busy;
  }

  private async readChunks(uid: string, a: { read: number; asked: number; want: number }): Promise<void> {
    try {
      while (a.asked < a.want) {
        const want = a.want;
        while (a.read < want) {
          const chunk = await this.db.doc(`players/${uid}/log/${chunkId(a.read)}`).get();
          if (!chunk.exists) break;
          const acts = parseActs(chunk.data()?.acts);
          // The re-check §8: an honest page archives only records over a game day old; a younger one in a new chunk is marked.
          const log = this.logs.get(uid);
          for (const r of acts) if (!log?.has(r.s) && r.at > this.gameMinute() - 24 * 60) this.mark("chunk", uid, r);
          this.ingest(uid, acts, false);
          a.read++;
        }
        a.asked = want;
      }
    } catch (e) {
      // A read that failed: the count stays unanswered, and the next document that gives it asks again.
      a.want = a.asked;
      throw e;
    }
  }

  /**
   * Appends one record to this player's document; one write at a time. The red team's stale writer (persistence §1): the
   * store's `set` replaces the whole document, so the write first reads it, and a list holding entries this tab hasn't
   * seen (another device wrote while this tab slept) becomes this tab's list, its new entries joining the world, before the
   * record is made after it (`make`). Never this tab's list whole over a list it hasn't seen.
   */
  private writeOwn(make: (own: { acts: ActRecord[]; archived: number }) => ActRecord): Promise<ActRecord> {
    const job = this.writes.then(async () => {
      const uid = this.uid!;
      const snap = await this.db.doc(`players/${uid}`).get();
      const body = snap.exists ? snap.data() : undefined;
      if (body) {
        const stored = parseActs(body.acts);
        const archived = archiveCount(body.archived, this.own.archived);
        const mine = new Set(this.own.acts.map((x) => `${x.s}:${JSON.stringify(x)}`));
        const unseen = archived !== this.own.archived || stored.length !== this.own.acts.length || stored.some((x) => !mine.has(`${x.s}:${JSON.stringify(x)}`));
        if (unseen) {
          this.own = { acts: stored, archived };
          await this.readArchive(uid, archived);
          this.dropMissing(uid, stored);
          this.ingest(uid, stored);
        }
      }
      // Shaped as a reader of the store shapes it (parseActs: a join's look and name), so this page's own copy and the
      // stored one never differ and a re-read never reads as a rewrite.
      const made = make(this.own);
      const r = parseActs([made])[0];
      if (!r) throw new Error("That order couldn't be written");
      const acts = [...this.own.acts, r];
      let archived = this.own.archived;
      let kept = acts;
      const done = this.w.t - 24 * 60;
      if (acts.length > KEEP_IN_DOC && archived < MAX_ARCHIVE_CHUNKS) {
        const old = acts.filter((x) => x.at < done).slice(0, ARCHIVE_CHUNK);
        if (old.length === ARCHIVE_CHUNK) {
          await this.db.doc(`players/${uid}/log/${chunkId(archived)}`).set({ acts: old });
          archived++;
          // This page has these: the chunk it just wrote follows the ones it had read.
          const a = this.archiveOf(uid);
          if (a.read === archived - 1) a.read = archived;
          a.asked = Math.max(a.asked, archived);
          a.want = Math.max(a.want, archived);
          const moved = new Set(old);
          kept = acts.filter((x) => !moved.has(x));
        }
      }
      await this.db.doc(`players/${uid}`).set({ v: 1, acts: kept, archived });
      this.own = { acts: kept, archived };
      return r;
    });
    this.writes = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  }

  /**
   * Persistence §1: a page drops the entries of a player's that the store's document no longer holds (an older device's
   * write erased them, before the merge above), so two pages can't run two worlds. Only entries the document's span
   * covers: those under its first sequence number are archived in its log chunks and stay. A change rebuilds the page.
   */
  private dropMissing(uid: string, acts: ActRecord[]): void {
    const log = this.logs.get(uid);
    if (!log || acts.length === 0) return;
    // The second re-check §2: an honest list is contiguous (archiving moves a prefix, an order appends at the end), so a
    // held entry strictly inside the document's span that it lacks was removed: dropped and marked, whatever else.
    const stored = new Set(acts.map((x) => x.s));
    let lo = Infinity;
    let hi = -Infinity;
    for (const x of stored) {
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    for (const s of [...log.keys()]) {
      if (s <= lo || s >= hi || stored.has(s)) continue;
      this.mark("drop", uid, log.get(s)!);
      // Step 3: an inert record gone from the store changes nothing this page computes.
      if (!(this.shared && this.inert(uid, log.get(s)!))) this.needRebuild = true;
      log.delete(s);
    }
    // The re-check §5: an erasure always comes with a rewritten entry (the erasing write's own record lands on a number
    // the page holds); a copy that's merely older (a cached snapshot, a re-read answered late) never has one, and drops
    // nothing.
    if (!acts.some((x) => log.has(x.s) && JSON.stringify(log.get(x.s)) !== JSON.stringify(x))) return;
    const held = new Set(acts.map((x) => x.s));
    const first = Math.min(...held);
    for (const s of [...log.keys()]) {
      if (s < first || held.has(s)) continue;
      this.mark("drop", uid, log.get(s)!);
      if (!(this.shared && this.inert(uid, log.get(s)!))) this.needRebuild = true;
      log.delete(s);
    }
  }

  /**
   * Persistence §2, the marker (the owner's page only): another player's order that arrived stamped before this page's
   * shared clock by more than the lead, this page's clock error (half its lease call's round trip) and the time since the
   * store last answered this page (a backlog delivered after a sleep is this page's lateness, not the player's). Only
   * while this page holds a fresh lease (its clock is the store's and it's in touch), and never during the first load.
   */
  private markEarly(uid: string, r: ActRecord): void {
    if (!this.markable(uid)) return;
    const sinceContactMin = (this.now() - this.leaseOkAt) / MS_PER_GAME_MIN;
    const early = this.gameMinute() - r.at;
    if (early <= LEAD_MIN + this.clockErrMin! + sinceContactMin) return;
    this.mark("early", uid, r);
  }

  /** Whether this page may mark another player's records (the owner's, past its first load, its lease fresh). */
  private markable(uid: string): boolean {
    // Its clock is the store's only while the lease is fresh and the device clock hasn't moved (leaseLost).
    return this.owner && this.loaded && uid !== this.uid && this.writer && this.clockErrMin !== null && !this.leaseLost();
  }

  /** Adds one to the owner's list (the latest EARLY_KEPT), with a console line. */
  private mark(kind: EarlyStamp["kind"], uid: string, r: ActRecord): void {
    if (!this.markable(uid)) return;
    const clock = this.gameMinute();
    const e: EarlyStamp = { kind, uid, s: r.s, at: r.at, minutesEarly: Math.floor(clock - r.at), seenAt: Math.floor(clock) };
    this.earlyStamps.push(e);
    if (this.earlyStamps.length > EARLY_KEPT) this.earlyStamps.shift();
    const what = kind === "early" ? `arrived stamped ${e.minutesEarly} game minutes in the past` : kind === "rewrite" ? "was rewritten" : kind === "drop" ? "was erased" : `turned up in an archive chunk, stamped ${e.minutesEarly} game minutes ago`;
    console.warn(`[owner] player ${uid}'s order #${r.s} ${what}`, e);
  }

  /** `fresh`: the records came from a player's document as it is now, not from an archive chunk (only those can be early). */
  private ingest(uid: string, acts: ActRecord[], fresh = true, onlyNew = false): void {
    let log = this.logs.get(uid);
    if (!log) this.logs.set(uid, (log = new Map()));
    for (const r of acts) {
      const seen = log.get(r.s);
      if (seen && onlyNew) continue; // a cached copy never rewrites (subscribe)
      if (seen) {
        // The same sequence number with a different body: the document was rewritten. Take the store's version, like a late joiner would.
        if (JSON.stringify(seen) === JSON.stringify(r)) continue;
        // Step 3: an inert record rewritten into another inert one changes nothing this page computes (history before a
        // kept cut is frozen: the red team's finding 7).
        if (!(this.shared && this.inert(uid, seen) && this.inert(uid, r))) this.needRebuild = true;
        if (fresh) this.mark("rewrite", uid, r); // the re-check §8
      }
      log.set(r.s, r);
      if (seen) continue;
      if (fresh) this.markEarly(uid, r);
      // Step 3, the late-order rule: never applied, and never a replay.
      if (this.shared && this.inert(uid, r)) {
        this.late(uid, r);
        continue;
      }
      const e: Entry = { uid, r };
      // Too late for a moment already computed: the page rebuilds so it agrees with everyone else.
      if (r.at < this.w.t || (this.last && before(e, this.last) < 0)) {
        this.needRebuild = true;
        continue;
      }
      let i = this.queue.length;
      while (i > 0 && before(this.queue[i - 1]!, e) > 0) i--;
      this.queue.splice(i, 0, e);
    }
  }

  private apply(e: Entry): void {
    this.last = e;
    const { uid, r } = e;
    if (this.shared) {
      // Step 3: the marks of what this world has applied (a refused order moves them too: finding 4).
      const m = this.applied.get(uid);
      if (!m) this.applied.set(uid, [r.s, 1]);
      else {
        if (r.s > m[0]) m[0] = r.s;
        m[1]++;
      }
    }
    if (r.a.type === "join") {
      if (this.companies.has(uid)) return;
      let c: ReturnType<typeof joinCompany>;
      try {
        c = joinCompany(this.w, uid, String(r.a.name ?? ""), String(r.a.hub ?? ""), "oo", r.a.look === "f" ? "f" : "m");
      } catch {
        return;
      }
      if (!c) return;
      this.companies.set(uid, c.id);
      if (uid === this.uid) this.player = c;
      if (!this.replaying) this.onJoin?.(uid, c);
      return;
    }
    const carrierId = this.companies.get(uid);
    if (carrierId === undefined) return;
    // An order the brokerage gave acts for the carrier's partner; with none, it's refused like any order for nobody.
    const cid = r.as === "brokerage" ? this.w.companies[carrierId - 1]?.partnerId : carrierId;
    let res: ActionResult;
    try {
      res = cid === undefined ? { ok: false, reason: "you have no brokerage" } : applyAction(this.w, cid, r.a);
    } catch {
      res = { ok: false, reason: "that order couldn't be carried out" };
    }
    if (uid === this.uid && !this.replaying) this.onOwnResult?.(r, res);
  }
}
