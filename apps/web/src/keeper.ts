/**
 * The shared checkpoint's keeper (step 3; cuts.ts has what a cut is, live.ts what a page does with one): what a page WRITES
 * into the store for it. It is outside the replay build (build.mjs): nothing here changes the world a page computes from
 * the store's documents, so a fix here never makes pages replay from the seed.
 *
 *  - Every page whose tab holds its player's lease reports its own hashes of the day boundaries it computed itself
 *    (days/<uid>), once its clock is G past the boundary (the red team's findings 4, 5 and 9). Only a page whose account
 *    has a company in its world: a report counts only from an account whose company is in the cut, and a document for
 *    every visitor would fill the store.
 *  - The owner's page, and only it (the store's rules give world/* to the owner): writes the newest such day's cut, the
 *    body first and its pointer last, after reading every player's orders again from the store itself (finding 5); reads
 *    the players' reports; when enough match and none differs (finding 3), or none has differed for the wait (KEEP.waitMin),
 *    reads the orders again, stores the archive of the records applied since the frozen minute (its parts, then its head,
 *    then read back whole) and last the trust document, which names it; writes the alarm when a report differs (finding
 *    8), and answers such a report by computing the day again from the cut before, over the archive's records. A cut it
 *    withdraws goes with every cut kept after it; an archive's documents are named by its text, and none is ever written
 *    over with another text, withdrawn or deleted.
 *
 * Nothing here runs unless the page switch is on (SHARED_CUTS; main.tsx).
 */
import { encodeWorld, type World } from "@lanes/engine";
import { ARC_PART_CHARS, arcDocs, cutExtras, DAYS_PATH, packBody, parseAlarm, parseDays, parsePointer, parseTrust, readArc, REPLAY_BUILD, sha256 } from "./cuts.js";
import type { Alarm, ArcRef, BodyRef, BodyStore, DayReport, KeptCut, Pointer } from "./cuts.js";
import type { DbLike, LiveWorld, OwnCut } from "./live.js";

/** The page switch, the producer's: off, the page reads and writes nothing of step 3 and runs as it did. */
export const SHARED_CUTS = false;

export const KEEP = {
  /** The red team's G: game minutes after a day boundary before a page reports its hash and the owner's page writes the cut. */
  graceMin: 6 * 60,
  /** How many other players' matching reports a cut needs before pages keep to it and start from its body. */
  confirmers: 2,
  /**
   * A world with fewer other players than `confirmers`: off, a cut still needs `confirmers` (so it is kept only once the
   * wait below has passed); on, it needs as many as there are other players, none in a world with no other player.
   * A player here is an account whose company is in the cut.
   */
  fewPlayers: true,
  /**
   * The wait: game minutes after a day boundary from which a cut that no report differs from is kept with the matching
   * reports it has, however few (a player who is away sends none). Until then a cut needs its confirmations; a report
   * that differs stops it at any time. The grace and one game day, which is inside the days a page reports (`days`) and
   * the bodies the store keeps (`bodies`). Infinity: a cut is kept on its confirmations only.
   */
  waitMin: 6 * 60 + 24 * 60,
  /** Bodies kept in the store. The newest kept cut's body is never dropped. */
  bodies: 3,
  /** Days in a page's report. */
  days: 4,
  /**
   * How often the owner's page reads the players' reports: while a body waits for its confirmations (twice as long after
   * each round that changed nothing, up to the other figure), and once all are kept (ms).
   */
  readWaitingMs: 60_000,
  readKeptMs: 30 * 60_000,
  /** After the store refused a body (no capability for this viewer, or its quota), the owner's page tries again this much later (ms). */
  retryStoreMs: 10 * 60_000,
  /** A body's most bytes packed: under the assets' 20 MiB a file. */
  maxPacked: 19 * 1024 * 1024,
  /** The most characters of a packed archive in one document: under the store's 256 KiB a document. */
  arcPartChars: ARC_PART_CHARS,
};

export interface KeeperOptions extends Partial<typeof KEEP> {
  /** The world owner's page (user.isOwner): the one that writes world/*. */
  owner: boolean;
  now?: () => number;
}

/** What `lanesOwner.checkpoints()` shows. */
export interface KeeperStatus {
  on: true;
  build: string;
  /** Why the owner's page isn't writing, when it isn't. */
  note: string;
  own: { day: number; hash: string; from: string }[];
  bodies: { day: number; hash: string; build: string; bytes: number; kept: boolean; disputed: boolean }[];
  kept: { day: number; hash: string; by: string[] }[];
  /** The archives the trust documents name: their minutes, records, documents and size packed. */
  archive: { from: number; to: number; records: number; parts: number; bytes: number }[];
  alarm: Alarm;
}

const dayKey = (x: { day: number; hash: string }): string => `${x.day}:${x.hash}`;

export class Keeper {
  private readonly k: typeof KEEP;
  private readonly now: () => number;
  private busy = false;
  /** This page's report as the store holds it; null until it's been read once. */
  private reported: string | null = null;
  private nextReadAt = 0;
  /** The rounds in a row that read the reports and changed nothing. */
  private idle = 0;
  /** The store refused a body: not asked again before this time, and why. */
  private storeBackAt = 0;
  private storeNote = "";
  /** The bodies this page has computed again in answer to a report (day:hash), and the one whose answer is awaited (for how many rounds). */
  private readonly recomputed = new Set<string>();
  private awaiting: { day: number; hash: string; rounds: number } | null = null;
  note = "";

  constructor(
    private readonly lw: LiveWorld,
    private readonly db: DbLike,
    private readonly bodies: BodyStore,
    private readonly o: KeeperOptions,
  ) {
    this.k = { ...KEEP, ...Object.fromEntries(Object.entries(o).filter(([key, v]) => key in KEEP && v !== undefined)) } as typeof KEEP;
    this.now = o.now ?? Date.now;
  }

  /** One round: the page's report, then the owner's work. It never throws and never runs twice at once. */
  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.report();
      if (this.o.owner) await this.keep();
    } catch (e) {
      this.note = `stopped: ${String((e as { message?: string })?.message ?? e)}`;
      console.error("[checkpoint]", e);
    } finally {
      this.busy = false;
    }
  }

  /** This page's own days, past the grace: the ones it reports, and the owner's page writes the newest of. */
  private due(): OwnCut[] {
    const clock = this.lw.gameMinute();
    return this.lw.ownDays().filter((c) => clock >= c.t + this.k.graceMin);
  }

  /** Whether this page may write for its player now: it holds the lease, and its world is up to the clock. */
  private steady(): boolean {
    const lw = this.lw;
    return lw.uid !== null && lw.leaseFresh() && !lw.replaying && !lw.needRebuild && !lw.broken;
  }

  /**
   * The page's report: the days it stands by now, written when that differs from what the store holds. A day it computed
   * again with another result replaces the old one; a day it no longer stands by (its records weren't the kept cut's)
   * leaves the list.
   */
  private async report(): Promise<void> {
    const lw = this.lw;
    if (!this.steady() || !lw.isPlayer(lw.uid!)) return;
    const doc = this.db.doc(`${DAYS_PATH}/${lw.uid}`);
    if (this.reported === null) {
      const snap = await doc.get();
      if (snap.metadata?.fromCache === true) return;
      const had = snap.exists ? parseDays(snap.data()) : null;
      this.reported = had ? JSON.stringify({ v: 1, world: had.world, build: had.build, days: had.days }) : "";
    }
    const days = this.due()
      .slice(0, this.k.days)
      .map((c) => ({ day: c.day, hash: c.hash!, rh: c.rh, from: c.from }));
    const body = { v: 1, world: lw.worldKey(), build: REPLAY_BUILD, days };
    const text = JSON.stringify(body);
    if (text === this.reported || (!days.length && this.reported === "")) return;
    await doc.set(body);
    this.reported = text;
  }

  // --- The owner's page ---------------------------------------------------------------------------------------------

  private need(others: number): number {
    return this.k.fewPlayers ? Math.min(this.k.confirmers, others) : this.k.confirmers;
  }

  private async keep(): Promise<void> {
    if (!this.steady()) {
      this.note = "waiting: this tab doesn't hold the owner's lease, or its world is replaying";
      return;
    }
    this.note = this.now() < this.storeBackAt ? this.storeNote : "";
    if (this.awaiting) return this.answer();
    const lw = this.lw;
    const world = lw.worldKey();
    const { pointer, alarm, trust, kept } = lw.sharedView();
    // The newest day this page stands by: its cut in the store, unless pages already keep to a cut of that day. Never a
    // day behind the frozen minute: its records are inside a later cut's archive, and it gets no cut of its own.
    const own = this.due()[0];
    const frozen = trust.length ? trust[trust.length - 1]!.t : 0;
    if (own?.text && own.t >= frozen && this.now() >= this.storeBackAt) {
      const there = pointer.bodies.find((b) => b.day === own.day && b.world === world);
      const isKept = kept.some((k) => k.day === own.day);
      const barred = alarm.barred.some((b) => b.day === own.day && b.hash === own.hash);
      if (!isKept && !barred && (!there || there.hash !== own.hash || there.build !== REPLAY_BUILD)) return this.write(own);
    }
    if (this.now() >= this.nextReadAt) await this.judge();
  }

  /** Writes a day's cut: the store's own answer about every player's orders first, then the body, then the pointer. */
  private async write(own: OwnCut): Promise<void> {
    const lw = this.lw;
    if (!(await lw.reread())) {
      this.note = "waiting: the store's answer about the players' orders was a saved copy";
      return;
    }
    if (lw.needRebuild) {
      this.note = "an order arrived that this page hadn't heard: computing the day again";
      return;
    }
    // Still the same computation, its records unchanged by what was just read.
    if (lw.ownDays().find((c) => c.day === own.day) !== own || !own.text || !own.hash) return;
    // The store's own copy of the pointer, before anything is stored: a write replaces the whole document.
    const stored = parsePointer(await this.read("world/checkpoint"));
    const refused = (why: string): void => {
      this.note = this.storeNote = why;
      this.storeBackAt = this.now() + this.k.retryStoreMs;
    };
    const packed = await packBody(own.text);
    if (packed.length > this.k.maxPacked) return refused(`day ${own.day}'s body is ${packed.length} bytes packed, over the store's file size`);
    let put: { id: string; bytes: number } | null = null;
    try {
      put = await this.bodies.put(packed);
    } catch (e) {
      return refused(`the store refused day ${own.day}'s body: ${String((e as { code?: string; message?: string })?.code ?? (e as { message?: string })?.message ?? e)}`);
    }
    if (!put) return refused("this page can't store a body: the artifact's assets capability isn't granted to this viewer");
    const ref: BodyRef = { day: own.day, t: own.t, hash: own.hash, rh: own.rh, world: lw.worldKey(), build: REPLAY_BUILD, asset: put.id, bytes: put.bytes, at: this.now() };
    // The pointer last: the body it names is already in the store.
    const { kept } = lw.sharedView();
    const gone = new Set(stored.gone);
    const bodies: BodyRef[] = [ref];
    for (const b of stored.bodies) {
      if (b.world !== ref.world || b.day === ref.day) gone.add(b.asset);
      else bodies.push(b);
    }
    bodies.sort((x, y) => y.t - x.t);
    const newestKept = bodies.find((b) => kept.some((k) => k.day === b.day && k.hash === b.hash));
    const keep = bodies.filter((b, i) => i < this.k.bodies || b === newestKept);
    for (const b of bodies) if (!keep.includes(b)) gone.add(b.asset);
    gone.delete(ref.asset);
    try {
      await this.setPointer({ bodies: keep, gone: [...gone] });
    } catch (e) {
      // No pointer names the body just stored: it is taken out again, so the store never fills with bodies nothing points at.
      await this.bodies.delete(put.id).catch(() => undefined);
      throw e;
    }
    // The dropped bodies, only ever ones this pointer named: deleted now, or on a later round.
    const left: string[] = [];
    for (const id of gone) {
      try {
        await this.bodies.delete(id);
      } catch {
        left.push(id);
      }
    }
    if (left.length !== gone.size) await this.setPointer({ bodies: keep, gone: left });
    this.nextReadAt = 0;
    this.idle = 0;
  }

  /** A document as the store itself holds it: a saved copy stops the round (the next one asks again). */
  private async read(path: string): Promise<Record<string, unknown> | undefined> {
    const snap = await this.db.doc(path).get();
    if (snap.metadata?.fromCache === true) throw new Error(`the store's answer for ${path} was a saved copy`);
    return snap.exists ? snap.data() : undefined;
  }

  private setPointer(p: Pointer): Promise<void> {
    return this.db.doc("world/checkpoint").set({ v: 1, bodies: p.bodies.map((b) => ({ ...b })), gone: p.gone });
  }

  /** Every page's report, in one read of their collection: this world's, and not this page's own. */
  private async readReports(): Promise<Map<string, DayReport>> {
    const lw = this.lw;
    const world = lw.worldKey();
    const snap = await this.db.collection(DAYS_PATH).get();
    // A saved copy of the reports says nothing: one may since have been taken back.
    if (snap.metadata?.fromCache === true) throw new Error("the store's answer for the pages' reports was a saved copy");
    const out = new Map<string, DayReport>();
    for (const d of snap.docs) {
      const r = d.id !== lw.uid ? parseDays(d.data()) : null;
      if (r && r.world === world) out.set(d.id, r);
    }
    return out;
  }

  /**
   * The archive for a day's cut, in the store as this page's records, and how the trust document will name it. The records
   * are the ones this world applied from the frozen minute up to the cut's (live.ts arcText). They are read back from the
   * store as a page reads them (cuts.ts readArc), and written when the store doesn't hold exactly that text: the further
   * parts, then the head, then read back once more. No document of another text is touched, and none is deleted. A day
   * that already has a trust document has its archive for good: it is named again and never written. Null, with a note,
   * when this page's records for the day aren't the ones to store.
   */
  private async archive(own: OwnCut): Promise<ArcRef | null> {
    const lw = this.lw;
    // The store's own trust documents first: the frozen minute is where this archive begins.
    if (!(await lw.rereadWorld())) {
      this.note = "waiting: the store's answer about the world's documents was a saved copy";
      return null;
    }
    const had = lw.trustAt(own.t);
    if (had) {
      if (had.rh === own.rh) return had.arc;
      this.note = `day ${own.day}'s records on this page aren't its archive's`;
      return null;
    }
    const a = lw.arcText(own.t, own.rh);
    if (a === "days") {
      // This page's replay started after the frozen minute: it computes the days since again, from the cut there.
      this.note = `computing the days up to day ${own.day} again, from the frozen minute`;
      lw.recompute(lw.sharedView().trust.reduce((t, d) => Math.max(t, d.t), 0) + 1);
      return null;
    }
    if (!a) {
      this.note = `waiting: day ${own.day}'s records on this page changed, or it is behind the frozen minute`;
      return null;
    }
    const { ref, docs } = await arcDocs(lw.worldKey(), a.from, a.to, a.text, a.n, this.k.arcPartChars);
    // The documents are named by the text (cuts.ts arcDocPath): another text for these minutes, an earlier attempt's or
    // another page's, is in other documents, and stays as it is.
    const stored = async (): Promise<boolean> => (await readArc(this.db, ref).catch(() => null)) === a.text;
    if (await stored()) return ref;
    for (const [path, body] of docs) await this.db.doc(path).set(body);
    if (await stored()) return ref;
    this.note = `day ${own.day}'s archive didn't read back from the store as it was written`;
    return null;
  }

  /**
   * Reads the pages' reports against each body in the store: the trust document for a body with none differing and
   * enough matching, or as many as it has once the wait has passed (KEEP.waitMin); the alarm for one a player's own hash
   * differs from; and this page's own answer to such a report, once.
   * A report counts, either way, only from an account whose company is in the cut, only over the same records as the
   * cut (one running hash), and only for the last few days up to the newest body's.
   */
  private async judge(): Promise<void> {
    const lw = this.lw;
    const world = lw.worldKey();
    const now = this.now();
    const clock = lw.gameMinute();
    const reports = await this.readReports();
    const pointer = parsePointer(await this.read("world/checkpoint"));
    const alarm = parseAlarm(await this.read("world/alarm"), world);
    const { trust, kept } = lw.sharedView();
    const frozen = trust.length ? trust[trust.length - 1]!.t : 0;
    const newest = pointer.bodies.reduce((day, b) => (b.world === world ? Math.max(day, b.day) : day), 0);
    const open: Alarm["open"] = [];
    let waiting = false;
    let ask: BodyRef | null = null;
    // Asked once a round, before the first trust document: the store's own answer about every player's orders.
    let heard: boolean | null = null;
    // One trust document a round: it moves the frozen minute, and the next one's archive begins there.
    let wrote = false;
    // The real time the earliest wait of a body short of its confirmations ends.
    let waitEnds = Infinity;
    for (const b of pointer.bodies) {
      if (b.world !== world || b.day <= newest - this.k.days) continue;
      const barred = alarm.barred.some((x) => dayKey(x) === dayKey(b));
      const isKept = kept.some((k: KeptCut) => k.day === b.day && k.hash === b.hash);
      // A body may be kept when its day is past the frozen minute; or when its day has a trust document whose cut was
      // withdrawn (the records stay as they are, and another cut of them may be kept).
      const keepable = !isKept && !barred && (b.t > frozen || (lw.trustAt(b.t) !== null && !kept.some((k) => k.day === b.day)));
      // A body behind the frozen minute with no cut of its own: its day's records are inside a later cut's archive, it is
      // never kept, and no report is read against it.
      if (!isKept && !keepable) continue;
      // The accounts whose company the cut holds: the only ones whose reports count. This page can't say for a cut from
      // before its own replay started, and reads no report against that one.
      const players = lw.companiesAt(b.t);
      if (!players) continue;
      const match: string[] = [];
      let differs = false;
      for (const [uid, r] of reports) {
        // Another replay build's hash is of another text: it neither confirms nor disputes.
        if (!players.has(uid) || r.build !== b.build || alarm.ignored.some((x) => x.uid === uid && (x.day === undefined || x.day === b.day))) continue;
        const d = r.days.find((x) => x.day === b.day);
        // Over other records than the cut's, that page computed another day: it will compute this one again.
        if (!d || d.rh !== b.rh) continue;
        if (d.hash === b.hash) match.push(uid);
        else {
          differs = true;
          const was = alarm.open.find((o) => o.day === b.day && o.hash === b.hash && o.uid === uid && o.theirs === d.hash);
          open.push({ day: b.day, hash: b.hash, uid, theirs: d.hash, at: was ? was.at : now });
        }
      }
      if (keepable) {
        // Kept only while this page itself stands by that cut now, over the body's own records, after the store's own
        // answer: a body left in the store from days ago, with reports that matched it then, is never kept over an order
        // every page has applied since.
        const mine = (): OwnCut | undefined => (b.build === REPLAY_BUILD ? lw.ownDays().find((x) => x.day === b.day && x.hash === b.hash && x.rh === b.rh) : undefined);
        const others = [...players].filter((u) => u !== lw.uid).length;
        // Enough matching reports; or, the wait past, the ones it has: a page that says nothing is not a report against it.
        const enough = match.length >= this.need(others) || clock >= b.t + this.k.waitMin;
        if (!differs && !enough) waitEnds = Math.min(waitEnds, now + lw.msUntil(b.t + this.k.waitMin));
        if (!wrote && !differs && enough && mine()) {
          heard ??= await lw.reread();
          const own = heard && !lw.needRebuild ? mine() : undefined;
          // The archive is in the store, whole, before the trust document that names it. Reading it took the store's own
          // trust documents: a cut they already hold is not written again.
          const arc = own ? await this.archive(own) : null;
          if (own && arc && !lw.needRebuild && mine() === own) {
            if (lw.sharedView().kept.some((k) => k.day === b.day && k.hash === b.hash)) wrote = true;
            else if (await this.unfrozen(b, own, arc, alarm)) {
              await this.db.doc(`world/cpm-${b.day}`).set({ v: 2, world, build: b.build, day: b.day, t: b.t, hash: b.hash, by: match.sort().slice(0, Math.max(2, this.k.confirmers)), at: now, rh: own.rh, arc: { ...arc } });
              wrote = true;
            } else waiting = true;
          } else waiting = true;
        } else waiting = true;
      }
      if (differs && !barred && !ask && !alarm.stood.some((x) => dayKey(x) === dayKey(b)) && !this.recomputed.has(dayKey(b))) ask = b;
    }
    const days = new Set(pointer.bodies.map((b) => b.day));
    const next: Alarm = { open, stood: alarm.stood.filter((x) => days.has(x.day)), barred: alarm.barred, ignored: alarm.ignored };
    const changed = wrote || ask !== null || JSON.stringify(alarm) !== JSON.stringify(next);
    await this.setAlarm(alarm, next);
    // While a body waits, the reports are read again a minute on, then twice as long after each round that changed nothing.
    this.idle = changed ? 0 : this.idle + 1;
    this.nextReadAt = now + (waiting || open.length ? Math.min(this.k.readWaitingMs * 2 ** Math.min(Math.max(this.idle - 1, 0), 16), this.k.readKeptMs) : this.k.readKeptMs);
    // And no later than the end of a body's wait.
    if (waitEnds > now) this.nextReadAt = Math.min(this.nextReadAt, waitEnds);
    // A report against a body: this page computes that day again, from the cut before it, after the store's own answer.
    if (ask && (await lw.reread())) {
      this.recomputed.add(dayKey(ask));
      this.awaiting = { day: ask.day, hash: ask.hash, rounds: 0 };
      lw.recompute(ask.t);
    }
  }

  /**
   * Just before a day's trust document is written, whether it may be: this tab still holds its lease, and the store
   * itself holds no trust document of this world for the day, or holds one over the same records whose cut was withdrawn
   * (another cut of those records takes its place). A day's records are frozen once, and another of the owner's pages may
   * have written the day's trust document since this round read the world's.
   */
  private async unfrozen(b: BodyRef, own: OwnCut, arc: ArcRef, alarm: Alarm): Promise<boolean> {
    const there = parseTrust(await this.read(`world/cpm-${b.day}`));
    const none = !there || there.world !== b.world;
    const withdrawn = !none && there.rh === own.rh && there.arc.hash === arc.hash && alarm.barred.some((x) => x.day === there.day && x.hash === there.hash);
    if (this.lw.leaseFresh() && (none || withdrawn)) return true;
    this.note = `waiting: day ${b.day} has a trust document already, or this tab no longer holds the owner's lease`;
    return false;
  }

  /**
   * The day computed again, from the cut before it and over the archive's records where history is frozen: the same hash,
   * and this page stands by its cut (the report stays open, and no page starts from that body until the owner rules: the
   * node replay decides); another hash, and the cut is withdrawn for good with every cut kept after it, its replacement
   * written on a later round.
   */
  private async answer(): Promise<void> {
    const a = this.awaiting!;
    const again = this.lw.ownDays().find((c) => c.day === a.day);
    if (!again) {
      // Still being hashed, or its records changed again: the next round. After a few it isn't coming, and the report stays open.
      if (++a.rounds > 10) this.awaiting = null;
      return;
    }
    if (again.hash !== a.hash && !(await this.lw.rereadWorld())) return;
    this.awaiting = null;
    const world = this.lw.worldKey();
    const alarm = parseAlarm(await this.read("world/alarm"), world);
    let next: Alarm = { ...alarm, stood: [...alarm.stood] };
    if (again.hash === a.hash) {
      if (!next.stood.some((x) => dayKey(x) === dayKey(a))) next.stood.push({ day: a.day, hash: a.hash });
    } else next = this.withdrawn(next, a.day, a.hash);
    await this.setAlarm(alarm, next);
    this.nextReadAt = 0;
  }

  /**
   * The alarm with a cut barred and, with it, every cut that stands after its day (each was computed on top of it): one
   * document, so one write. No archive is touched.
   */
  private withdrawn(alarm: Alarm, day: number, hash: string): Alarm {
    const barred = [...alarm.barred];
    for (const x of [{ day, hash }, ...this.lw.sharedView().kept.filter((k) => k.day > day)]) {
      if (!barred.some((y) => dayKey(y) === dayKey(x))) barred.push({ day: x.day, hash: x.hash });
    }
    return { ...alarm, barred };
  }

  private async setAlarm(was: Alarm, next: Alarm): Promise<void> {
    if (JSON.stringify(was) === JSON.stringify(next)) return;
    await this.db.doc("world/alarm").set({ v: 1, world: this.lw.worldKey(), ...next });
  }

  // --- The owner's own decisions (the console: lanesOwner) ----------------------------------------------------------

  /** A player's reports no longer count: for one day, or with no day given, for good (the owner's decision). */
  async ignore(uid: string, day?: number): Promise<void> {
    const world = this.lw.worldKey();
    const alarm = parseAlarm(await this.read("world/alarm"), world);
    if (alarm.ignored.some((x) => x.uid === uid && (x.day === undefined || x.day === day))) return;
    // For good takes the place of that player's single days.
    const ignored = day === undefined ? [...alarm.ignored.filter((x) => x.uid !== uid), { uid }] : [...alarm.ignored, { uid, day }];
    await this.setAlarm(alarm, { ...alarm, ignored });
    this.nextReadAt = 0;
  }

  /**
   * A cut is withdrawn for good, by day and hash, and with it every cut kept after it, in one write: its body is never
   * started from again and its hash never compared. The records its trust document froze stay frozen.
   */
  async bar(day: number, hash: string): Promise<void> {
    const world = this.lw.worldKey();
    if (!(await this.lw.rereadWorld())) throw new Error("the store's answer for the world's documents was a saved copy");
    const alarm = parseAlarm(await this.read("world/alarm"), world);
    await this.setAlarm(alarm, this.withdrawn(alarm, day, hash));
    this.nextReadAt = 0;
  }

  status(): KeeperStatus {
    const { pointer, alarm, trust, kept } = this.lw.sharedView();
    return {
      on: true,
      build: REPLAY_BUILD,
      note: this.note,
      own: this.lw.ownDays().map((c) => ({ day: c.day, hash: c.hash!, from: c.from })),
      bodies: pointer.bodies.map((b) => ({ day: b.day, hash: b.hash, build: b.build, bytes: b.bytes, kept: kept.some((k) => k.day === b.day && k.hash === b.hash), disputed: alarm.open.some((o) => dayKey(o) === dayKey(b)) })),
      kept: kept.map((k) => ({ day: k.day, hash: k.hash, by: k.by })),
      archive: trust.map((d) => ({ from: d.arc.from, to: d.arc.to, records: d.arc.n, parts: d.arc.parts, bytes: d.arc.bytes })),
      alarm,
    };
  }
}

/**
 * The hash of a world as it stands this instant (not a cut: no line, any minute): for comparing two pages by hand at the
 * same game minute (`lanesCuts().now()` in each page's console), a page from a body against a page from the seed.
 */
export async function worldHash(w: World): Promise<{ minute: number; hash: string; encodeMs: number; bytes: number }> {
  const t0 = performance.now();
  const text = encodeWorld(w, cutExtras(w));
  // The encoding is the part a page does in one piece at each day boundary: how long it took here, and its size.
  const encodeMs = Math.round(performance.now() - t0);
  return { minute: w.t, hash: await sha256(text), encodeMs, bytes: text.length };
}

// --- Where the bodies are ---------------------------------------------------------------------------------------------

/** The part of the artifact's assets capability the owner's page uses. */
export interface AssetsLike {
  upload(blob: Blob, options?: { type?: string }): Promise<{ id: string; sizeBytes: number }>;
  delete(ref: string): Promise<unknown>;
}

/** A body's text from the artifact's own asset path, or null: refused (a viewer from outside the organization may be), gone, or slow. */
async function fetchBody(id: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 20_000);
  try {
    const r = await fetch(`/_blob/${id}`, { signal: stop.signal });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The live page's body store: the artifact's assets. Every viewer reads a body at its asset path; only a viewer the
 * platform gives the capability (the owner, and editors) stores or deletes one, and `assets` is null for everyone else.
 * A packed body is JSON, the one accepted type that fits (cuts.ts packBody).
 */
export function assetBodies(assets: AssetsLike | null, read: (id: string) => Promise<string | null> = fetchBody): BodyStore {
  return {
    put: async (packed) => {
      if (!assets) return null;
      const blob = new Blob([packed], { type: "application/json" });
      const up = (): Promise<{ id: string; sizeBytes: number }> => assets.upload(blob, { type: "application/json" });
      try {
        const r = await up();
        return { id: r.id, bytes: r.sizeBytes };
      } catch (e) {
        const code = (e as { code?: string })?.code;
        // Not for this view after all: the same as no capability.
        if (code === "not_granted" || code === "capability_disabled" || code === "capability_removed") return null;
        if (code !== "store_unavailable") throw e;
        await new Promise((res) => setTimeout(res, 1500));
        const r = await up();
        return { id: r.id, bytes: r.sizeBytes };
      }
    },
    // Once more after a moment: one dropped request shouldn't cost a page its replay from the seed.
    get: async (id) => (await read(id)) ?? (await new Promise((res) => setTimeout(res, 1500)), await read(id)),
    delete: async (id) => {
      if (assets) await assets.delete(id);
    },
  };
}

/** The page run off the artifact (local-lanes.html): bodies in IndexedDB, shared by this browser's tabs. Every call fails soft. */
export function localBodies(name = "lanes.bodies.v1"): BodyStore {
  const run = <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    new Promise((res, rej) => {
      const open = indexedDB.open(name, 1);
      open.onupgradeneeded = () => void open.result.createObjectStore("bodies");
      open.onerror = () => rej(open.error);
      open.onsuccess = () => {
        const t = open.result.transaction("bodies", mode);
        const req = f(t.objectStore("bodies"));
        t.oncomplete = () => res(req.result);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      };
    });
  return {
    put: async (packed) => {
      const id = `local${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
      try {
        await run("readwrite", (s) => s.put(packed, id));
        return { id, bytes: packed.length };
      } catch {
        return null;
      }
    },
    get: async (id) => {
      try {
        return ((await run("readonly", (s) => s.get(id))) as string | undefined) ?? null;
      } catch {
        return null;
      }
    },
    delete: async (id) => {
      await run("readwrite", (s) => s.delete(id));
    },
  };
}
