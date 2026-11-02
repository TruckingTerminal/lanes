import { ruleBotHook } from "@lanes/agents";
import { applyAction, stepHour, type Action, type ActionResult, type Company, type GameEvent, type World } from "@lanes/engine";
import { joinCompany, newWorld, RULESET } from "./game.js";

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
  onSnapshot(next: (s: { docs: SnapLike[] }) => void, error?: (e: { code: string }) => void): () => void;
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
    out.push({ s: s as number, at: at as number, a: body });
  }
  return out;
}

type Entry = { uid: string; r: ActRecord };
const before = (x: Entry, y: Entry) => x.r.at - y.r.at || (x.uid < y.uid ? -1 : x.uid > y.uid ? 1 : 0) || x.r.s - y.r.s;

export interface LiveOptions {
  now?: () => number;
  holder?: string;
}

export class LiveWorld {
  readonly kind = "live";
  w: World;
  player: Company | null = null;
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
  private readonly now: () => number;
  private readonly holder: string;

  private constructor(
    readonly meta: WorldMeta,
    private readonly db: DbLike,
    readonly uid: string | null,
    o: LiveOptions,
  ) {
    this.now = o.now ?? Date.now;
    this.holder = o.holder ?? `tab-${Math.floor(Math.random() * 1e12).toString(36)}`;
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
  async submit(a: LiveAction): Promise<ActRecord> {
    if (!this.uid || !this.writer) throw new Error("This tab is only watching");
    if (a.type !== "join" && !this.player) throw new Error("Your company isn't registered yet");
    if (a.type === "join" && (this.companies.has(this.uid) || this.own.acts.some((r) => r.a.type === "join"))) throw new Error("You already have a company");
    const prev = this.own.acts.at(-1);
    const nextS = prev ? prev.s + 1 : this.own.archived > 0 ? this.maxSeq(this.uid) + 1 : 0;
    const at = Math.max(prev?.at ?? 0, Math.ceil(this.gameMinute()) + LEAD_MIN);
    const r: ActRecord = { s: nextS, at, a };
    this.own.acts.push(r);
    try {
      await this.flushOwn();
    } catch (e) {
      this.own.acts = this.own.acts.filter((x) => x !== r);
      throw e;
    }
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
      for (const l of this.events) l(e);
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
        archivedOf.slice(i, i + 6).map(async ([uid]) => {
          const chunks = await this.db.collection(`players/${uid}/log`).get();
          for (const c of chunks.docs) this.ingest(uid, parseActs(c.data()?.acts));
        }),
      );
    }
    this.needRebuild = false;
  }

  private subscribe(): void {
    this.unsub = this.db.collection("players").onSnapshot(
      (snap) => {
        for (const d of snap.docs) {
          if (d.id === this.uid && this.writer) continue; // this tab writes that log itself
          const body = d.data();
          if (body) this.ingest(d.id, parseActs(body.acts));
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
    let res: { acquired: boolean; expiresAt?: string };
    try {
      res = await doc.acquire({ holder: this.holder, ttlMs: LEASE_TTL_MS });
    } catch {
      this.lease = "denied";
      return (this.writer = false);
    }
    const t1 = this.now();
    if (!res.acquired) {
      this.lease = "busy";
      return (this.writer = false);
    }
    // The lease's expiry is stamped by the store, which gives this page the shared clock.
    const server = res.expiresAt ? Date.parse(res.expiresAt) - LEASE_TTL_MS : NaN;
    const offset = server - (t0 + t1) / 2;
    if (Number.isFinite(offset) && Math.abs(offset) < 10 * 60_000) this.clockOffsetMs = offset;
    this.writer = true;
    this.lease = "held";
    if (!this.leaseTimer) {
      this.leaseTimer = setInterval(async () => {
        try {
          const r = await doc.acquire({ holder: this.holder, ttlMs: LEASE_TTL_MS });
          const had = this.writer;
          this.writer = r.acquired;
          this.lease = r.acquired ? "held" : "busy";
          // Back in charge after another tab had it: pick up whatever that tab wrote.
          if (r.acquired && !had && this.uid) {
            const snap = await this.db.doc(`players/${this.uid}`).get();
            const body = snap.data();
            this.own = { acts: parseActs(body?.acts), archived: Number(body?.archived) || 0 };
          }
        } catch {
          /* transient: the next renewal tries again */
        }
      }, 30_000);
    }
    return true;
  }

  /** Tries to make this tab the writer again (after another tab let go). */
  async retakeLease(): Promise<boolean> {
    const ok = await this.takeLease();
    if (ok && this.uid) {
      const snap = await this.db.doc(`players/${this.uid}`).get();
      const body = snap.data();
      this.own = { acts: parseActs(body?.acts), archived: Number(body?.archived) || 0 };
    }
    return ok;
  }

  /** Writes this player's document; one write at a time, each carrying the latest list. */
  private flushOwn(): Promise<void> {
    const job = this.writes.then(async () => {
      const uid = this.uid!;
      const done = this.w.t - 24 * 60;
      if (this.own.acts.length > KEEP_IN_DOC) {
        const old = this.own.acts.filter((r) => r.at < done).slice(0, ARCHIVE_CHUNK);
        if (old.length === ARCHIVE_CHUNK) {
          await this.db.doc(`players/${uid}/log/c${String(this.own.archived).padStart(5, "0")}`).set({ acts: old });
          this.own.archived++;
          const moved = new Set(old);
          this.own.acts = this.own.acts.filter((r) => !moved.has(r));
        }
      }
      await this.db.doc(`players/${uid}`).set({ v: 1, acts: this.own.acts, archived: this.own.archived });
    });
    this.writes = job.catch(() => undefined);
    return job;
  }

  private ingest(uid: string, acts: ActRecord[]): void {
    let log = this.logs.get(uid);
    if (!log) this.logs.set(uid, (log = new Map()));
    for (const r of acts) {
      const seen = log.get(r.s);
      if (seen) {
        // The same sequence number with a different body: the document was rewritten. Take the store's version, like a late joiner would.
        if (JSON.stringify(seen) === JSON.stringify(r)) continue;
        this.needRebuild = true;
      }
      log.set(r.s, r);
      if (seen) continue;
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
    const cid = this.companies.get(uid);
    if (cid === undefined) return;
    let res: ActionResult;
    try {
      res = applyAction(this.w, cid, r.a);
    } catch {
      res = { ok: false, reason: "that order couldn't be carried out" };
    }
    if (uid === this.uid && !this.replaying) this.onOwnResult?.(r, res);
  }
}
