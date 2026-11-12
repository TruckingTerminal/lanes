import { ruleBotHook } from "@lanes/agents";
import { applyAction, stepHour, type Action, type ActionResult, type Company, type GameEvent, type World } from "@lanes/engine";
import { joinCompany, newWorld, RULESET } from "./game.js";
import { booksAfterHour } from "./books.js";
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
 */

export const MS_PER_GAME_HOUR = (6 * 3600 * 1000) / 24;
const MS_PER_GAME_MIN = MS_PER_GAME_HOUR / 60;
/** Game minutes between taking an action and its effect (30 real seconds): time for it to reach every page. */
export const LEAD_MIN = 2;
const LEASE_TTL_MS = 120_000;
const KEEP_IN_DOC = 300;
const ARCHIVE_CHUNK = 200;

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
}
export interface DocLike {
  get(): Promise<SnapLike>;
  set(data: Record<string, unknown>): Promise<void>;
  acquire(o: { holder: string; ttlMs?: number }): Promise<{ acquired: boolean; expiresAt?: string }>;
}
export interface CollLike {
  get(): Promise<{ docs: SnapLike[] }>;
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
}

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
  /** Past the first load: records ingested from here on arrived while this page watched. */
  private loaded = false;
  /** Half the round trip of the lease call that set this page's clock, in game minutes; null until it's set. */
  private clockErrMin: number | null = null;
  /** Per player, the archive chunks this page has read or written (players/<uid>/log/c00000 …). */
  private archivedSeen = new Map<string, number>();

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
      try {
        this.onHour?.(this.w);
      } catch (e) {
        console.error(e);
      }
    }
    return false;
  }

  /** Replays the whole log from the seed, a slice at a time. */
  async rebuild(onProgress?: (share: number) => void): Promise<void> {
    this.needRebuild = false;
    this.replaying = true;
    this.w = this.fresh();
    this.player = null;
    this.companies.clear();
    this.last = null;
    this.queue = [];
    for (const [uid, log] of this.logs) for (const r of log.values()) this.queue.push({ uid, r });
    this.queue.sort(before);
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
    this.ingest(this.uid, [r]);
    return r;
  }

  close(): void {
    this.unsub?.();
    if (this.leaseTimer) clearInterval(this.leaseTimer);
  }

  // --- internals --------------------------------------------------------------------

  private fresh(): World {
    const w = newWorld(this.meta.seed);
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
    const players = await this.db.collection("players").get();
    const archivedOf: [string, number][] = [];
    for (const d of players.docs) {
      const body = d.data();
      if (!body) continue;
      this.ingest(d.id, parseActs(body.acts));
      const archived = Number(body.archived) || 0;
      if (archived > 0) archivedOf.push([d.id, archived]);
      if (d.id === this.uid) this.own = { acts: parseActs(body.acts), archived };
    }
    // Player documents first, then their archives: an archive is always written before the document drops those entries.
    for (let i = 0; i < archivedOf.length; i += 6) {
      await Promise.all(
        archivedOf.slice(i, i + 6).map(async ([uid, archived]) => {
          const chunks = await this.db.collection(`players/${uid}/log`).get();
          for (const c of chunks.docs) this.ingest(uid, parseActs(c.data()?.acts));
          this.archivedSeen.set(uid, archived);
        }),
      );
    }
    this.needRebuild = false;
  }

  private subscribe(): void {
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
            const archived = Number(body.archived) || 0;
            if (archived > (this.archivedSeen.get(d.id) ?? 0)) void this.readArchive(d.id, archived).catch((e) => console.error(e));
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
    this.own = { acts: parseActs(body?.acts), archived: Number(body?.archived) || 0 };
    await this.readArchive(this.uid!, this.own.archived);
    this.dropMissing(this.uid!, this.own.acts);
    this.ingest(this.uid!, this.own.acts);
  }

  /**
   * A player's archive chunks this page hasn't read, up to `archived` (persistence §1, the archive edge): another device
   * that wrote more than a chunk while this page slept moved orders this page never saw out of the document. Older
   * orders, so the page rebuilds (ingest), and never marked early.
   */
  private async readArchive(uid: string, archived: number): Promise<void> {
    const had = this.archivedSeen.get(uid) ?? 0;
    for (let n = had; n < archived; n++) {
      const chunk = await this.db.doc(`players/${uid}/log/c${String(n).padStart(5, "0")}`).get();
      const acts = parseActs(chunk.data()?.acts);
      // The re-check §8: an honest page archives only records over a game day old; a younger one in a new chunk is marked.
      const log = this.logs.get(uid);
      for (const r of acts) if (!log?.has(r.s) && r.at > this.gameMinute() - 24 * 60) this.mark("chunk", uid, r);
      this.ingest(uid, acts, false);
    }
    if (archived > (this.archivedSeen.get(uid) ?? 0)) this.archivedSeen.set(uid, archived);
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
        const archived = Number(body.archived) || 0;
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
      if (acts.length > KEEP_IN_DOC) {
        const old = acts.filter((x) => x.at < done).slice(0, ARCHIVE_CHUNK);
        if (old.length === ARCHIVE_CHUNK) {
          await this.db.doc(`players/${uid}/log/c${String(archived).padStart(5, "0")}`).set({ acts: old });
          archived++;
          this.archivedSeen.set(uid, Math.max(this.archivedSeen.get(uid) ?? 0, archived)); // this page has these
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
      log.delete(s);
      this.needRebuild = true;
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
      log.delete(s);
      this.needRebuild = true;
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
        this.needRebuild = true;
        if (fresh) this.mark("rewrite", uid, r); // the re-check §8
      }
      log.set(r.s, r);
      if (seen) continue;
      if (fresh) this.markEarly(uid, r);
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
