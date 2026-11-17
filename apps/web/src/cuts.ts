/**
 * The world checkpoint, step 2a: each page's own local cuts (engineering-checkpoint-design-2026-11-16.md; the red team's
 * checkpoint review, "the writer: owner only, with a local cache for liveness"). A cut is this browser's own computation of
 * the live world at a day boundary (engine checkpoint.ts encodeWorld, with cutExtras and the credit cache), kept with
 * a digest of exactly the records it had applied. A page starts from the newest cut whose digest still matches the records
 * the store holds before it; anything else (a late, rewritten or erased record, another replay build, another world) makes
 * it fall back to an older cut or the seed. So a cut never drops an order and needs no trust: it only saves replaying
 * what this browser already computed.
 *
 * Off unless the page passes a store (LiveOptions.cuts; main.tsx with LOCAL_CUTS).
 *
 * Step 3, the shared, trusted checkpoint, is the second half of this file: what a cut is as one text every page can hash
 * (cutText), the store's documents that carry one (the body's pointer, the trust document with the marks, the alarm), and
 * the late-order rule's test (countsUnder). What a page does with them is in live.ts; what a page writes (its day hashes,
 * and the owner's checkpoint) is keeper.ts, outside the replay build.
 */

import { botState, restoreBotState, type BotState } from "@lanes/agents";
import type { World } from "@lanes/engine";
import { booksState, watchBooks, type BooksState } from "./books.js";
import { restoreTruckNos, truckNosState, type TruckNosState } from "./trucknos.js";

/** Per player, the records a world had applied before a minute: the highest sequence number and how many, sorted by uid. */
export type Marks = [uid: string, maxS: number, count: number][];

/** Whether the live page keeps local cuts (a page switch; off until the producer turns it on). */
export const LOCAL_CUTS = false;

declare const __LANES_REPLAY__: string | undefined;
/**
 * The replay build: a content hash of every source module the replay runs or a cut holds the work of (packages engine,
 * agents, config and data, and apps/web game.ts, live.ts, books.ts, trucknos.ts and cuts.ts), set by build.mjs (the red team's finding 10). A page whose replay code
 * differs never starts from a cut another build wrote, even after a page-only republish. "dev" outside a build.
 */
export const REPLAY_BUILD: string = typeof __LANES_REPLAY__ !== "undefined" ? __LANES_REPLAY__ : "dev";

/** A cut's head: what's needed to choose it without reading its body. */
export interface CutHead {
  key: string;
  world: string;
  build: string;
  /** The game minute it's at (a day boundary), and the SHA-256 of the records it had applied (recordsDigest). */
  t: number;
  digest: string;
  /**
   * Step 3, on a page with the shared checkpoint on: the cut's hash as every page computes it (cutText), the records it
   * had applied as marks, and the trusted body its world came from (the records before that one's minute are settled, and
   * the digest covers only the ones since).
   */
  hash?: string;
  marks?: Marks;
  since?: { t: number; hash: string };
}
export interface Cut extends CutHead {
  /** The world's encoding (engine encodeWorld, with cutExtras). */
  text: string;
  /** The players' companies: uid and carrier id, as the page's join map holds them. */
  companies: [string, number][];
}

export interface CutStore {
  list(world: string): Promise<CutHead[]>;
  get(key: string): Promise<Cut | null>;
  put(cut: Cut): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * What a cut carries beside the world: the bots' state outside it (agents ruleBots.ts botState), and the page's own
 * records the replay builds hour by hour, the month books (books.ts) and the trucks' numbers (trucknos.ts). So a page from
 * a cut shows what a page from the seed shows: the month so far, the closed months, the same truck numbers.
 */
export interface CutExtras {
  bots: BotState;
  books: BooksState | null;
  trucks: TruckNosState;
}
export const cutExtras = (w: World): CutExtras => ({ bots: botState(w), books: booksState(w), trucks: truckNosState(w) });
/** Puts them back on a restored world: the bots' state, the books (and their reader on the ledger), the truck numbers. */
export function restoreCutExtras(w: World, x: CutExtras): void {
  restoreBotState(w, x.bots);
  watchBooks(w, x.books);
  restoreTruckNos(w, x.trucks);
}

/** How many cuts a page keeps per world: the newest few day boundaries. */
export const CUTS_KEPT = 3;

/** SHA-256 of a text, as 64 hex. */
export async function sha256(text: string): Promise<string> {
  const d = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A store in memory: tests, and a page with no IndexedDB. */
export function memoryCuts(): CutStore & { cuts: Map<string, Cut> } {
  const cuts = new Map<string, Cut>();
  return {
    cuts,
    list: async (world) => [...cuts.values()].filter((c) => c.world === world).map(({ text: _text, companies: _companies, ...head }) => head),
    get: async (key) => cuts.get(key) ?? null,
    put: async (cut) => void cuts.set(cut.key, cut),
    delete: async (key) => void cuts.delete(key),
  };
}

/**
 * The page's store: IndexedDB, the body gzipped (CompressionStream; about 6:1). Every call fails soft: a browser that
 * refuses storage (a private window, a full disk) gets no cuts and replays from the seed, as before.
 */
export function idbCuts(name = "lanes.cuts.v1"): CutStore {
  const open = (): Promise<IDBDatabase> =>
    new Promise((res, rej) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("heads")) db.createObjectStore("heads", { keyPath: "key" });
        if (!db.objectStoreNames.contains("bodies")) db.createObjectStore("bodies");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  const tx = async <T>(stores: string[], mode: IDBTransactionMode, run: (t: IDBTransaction) => IDBRequest<T> | null): Promise<T | null> => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(stores, mode);
      const req = run(t);
      t.oncomplete = () => res(req ? (req.result as T) : null);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  const gzip = async (text: string) => new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  const gunzip = async (bytes: Uint8Array) => new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  return {
    list: async (world) => {
      try {
        const all = (await tx<CutHead[]>(["heads"], "readonly", (t) => t.objectStore("heads").getAll())) ?? [];
        return all.filter((h) => h.world === world);
      } catch {
        return [];
      }
    },
    get: async (key) => {
      try {
        const head = await tx<(CutHead & { companies: [string, number][] }) | undefined>(["heads"], "readonly", (t) => t.objectStore("heads").get(key));
        const body = await tx<Uint8Array | undefined>(["bodies"], "readonly", (t) => t.objectStore("bodies").get(key));
        if (!head || !body) return null;
        return { ...head, text: await gunzip(body) };
      } catch {
        return null;
      }
    },
    put: async (cut) => {
      try {
        const { text, ...head } = cut;
        const body = await gzip(text);
        await tx(["heads", "bodies"], "readwrite", (t) => {
          t.objectStore("bodies").put(body, cut.key);
          return t.objectStore("heads").put(head);
        });
      } catch {
        /* no storage: no cuts */
      }
    },
    delete: async (key) => {
      try {
        await tx(["heads", "bodies"], "readwrite", (t) => {
          t.objectStore("bodies").delete(key);
          return t.objectStore("heads").delete(key);
        });
      } catch {
        /* nothing to delete */
      }
    },
  };
}

// --- Step 3: the shared, trusted checkpoint ------------------------------------------------------------------------
//
// The red team's checkpoint review (redteam-checkpoint-2026-11-16.md), by finding:
//  3  a page starts from a body only once two other players' pages have reported its hash and none disputes it
//     (adoptable); a hash is compared whole, all 64 hex;
//  4  the hash is of the whole cut (cutText): the world, the bots' state, the credit cache and the page's own records the
//     replay builds, and with them the world's key, the replay build, the minute, the marks and the players' companies;
//  6  a record counts by its stamp alone (countsUnder): before a kept cut, only what that cut had applied;
//  7  every kept cut's marks stay in the store for good (TrustDoc, world/cpm-<day>), so a page replaying from the seed,
//     from its own cut or from an older body applies the same records as a page that started from the newest body;
//  8  the alarm is its own document (Alarm, world/alarm), written by the owner's page from the players' own reports;
//  9  a page's day hashes are their own document (DayReport, players/<uid>/x/days), never the player's orders document;
//  10 a body names its replay build, and a page of another build never starts from it;
//  11 the body is an asset (packBody: gzip inside JSON, the one text type that fits) and its pointer a document.

/** What a cut is of, before the world's encoding: the first line of its text. */
export interface CutLine {
  v: 1;
  /** The world: seed, epoch and ruleset (live.ts worldKey). */
  world: string;
  build: string;
  /** The game minute, a day boundary: after hour 23's step and before any order stamped at that minute. */
  t: number;
  marks: Marks;
  /** The players' companies: uid and carrier id, in the order they joined. */
  companies: [string, number][];
}

/**
 * A cut as one text: its line, then the world's encoding (engine encodeWorld with cutExtras). Its SHA-256 is the hash pages
 * report and compare, and the body the owner's page uploads is exactly this text.
 */
export function cutText(line: Omit<CutLine, "v">, encoding: string): string {
  const head: CutLine = { v: 1, world: line.world, build: line.build, t: line.t, marks: line.marks, companies: line.companies };
  return `${JSON.stringify(head)}\n${encoding}`;
}

const isInt = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x);
const isHash = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);
const isText = (x: unknown, max = 200): x is string => typeof x === "string" && x.length > 0 && x.length <= max;

/**
 * Marks from a cut's line ([uid, highest, count]) or from a store document ({ u, s, n }: a document holds no array inside
 * an array on every store): every entry well formed, one per uid, sorted by uid. Null when it isn't such a list.
 */
export function parseMarks(raw: unknown): Marks | null {
  if (!Array.isArray(raw)) return null;
  const by = new Map<string, [number, number]>();
  for (const x of raw as unknown[]) {
    const o = x as { u?: unknown; s?: unknown; n?: unknown } | null;
    const m: unknown[] | null = Array.isArray(x) ? x : o && typeof o === "object" ? [o.u, o.s, o.n] : null;
    if (!m || !isText(m[0]) || !isInt(m[1]) || !isInt(m[2]) || m[1] < 0 || m[2] < 1) return null;
    if (by.has(m[0])) return null;
    by.set(m[0], [m[1], m[2]]);
  }
  return marksOf(by);
}
/** Marks as a store document holds them. */
export const marksDoc = (m: Marks): { u: string; s: number; n: number }[] => m.map(([u, s, n]) => ({ u, s, n }));

/** A cut's text taken apart again; null when its line isn't one. */
export function readCut(text: string): { line: CutLine; encoding: string } | null {
  const nl = text.indexOf("\n");
  if (nl < 0) return null;
  let raw: Partial<CutLine>;
  try {
    raw = JSON.parse(text.slice(0, nl)) as Partial<CutLine>;
  } catch {
    return null;
  }
  const marks = parseMarks(raw?.marks);
  if (!raw || raw.v !== 1 || !isText(raw.world) || !isText(raw.build) || !isInt(raw.t) || !marks || !Array.isArray(raw.companies)) return null;
  const companies: [string, number][] = [];
  for (const c of raw.companies as unknown[]) {
    if (!Array.isArray(c) || !isText(c[0]) || !isInt(c[1])) return null;
    companies.push([c[0], c[1]]);
  }
  return { line: { v: 1, world: raw.world, build: raw.build, t: raw.t, marks, companies }, encoding: text.slice(nl + 1) };
}

/** The marks of a page's applied records (uid to highest sequence number and count), in their one order. */
export function marksOf(applied: ReadonlyMap<string, readonly [number, number]>): Marks {
  return [...applied].map(([uid, m]): Marks[number] => [uid, m[0], m[1]]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
/** Marks as one text, to compare two pages' applied records by. */
export const marksKey = (m: Marks): string => JSON.stringify(m);

/** `world/checkpoint`, one body: where the cut of a day is, and what its text must hash to. */
export interface BodyRef {
  day: number;
  t: number;
  hash: string;
  world: string;
  build: string;
  /** The body store's id (an asset's). */
  asset: string;
  bytes: number;
  /** The real time it was written (ms). */
  at: number;
}
/** `world/checkpoint`: the bodies kept, newest first, and the ids of dropped ones still to delete. */
export interface Pointer {
  bodies: BodyRef[];
  gone: string[];
}
const ASSET_ID = /^[A-Za-z0-9_-]{1,64}$/;
export function parsePointer(raw: unknown): Pointer {
  const out: Pointer = { bodies: [], gone: [] };
  const p = raw as { v?: unknown; bodies?: unknown; gone?: unknown } | undefined;
  if (!p || p.v !== 1) return out;
  for (const b of Array.isArray(p.bodies) ? (p.bodies as Partial<BodyRef>[]) : []) {
    if (!b || !isInt(b.day) || !isInt(b.t) || b.t !== b.day * 1440 || !isHash(b.hash) || !isText(b.world) || !isText(b.build)) continue;
    if (typeof b.asset !== "string" || !ASSET_ID.test(b.asset)) continue;
    out.bodies.push({ day: b.day, t: b.t, hash: b.hash, world: b.world, build: b.build, asset: b.asset, bytes: Number(b.bytes) || 0, at: Number(b.at) || 0 });
  }
  out.bodies.sort((x, y) => y.t - x.t);
  for (const id of Array.isArray(p.gone) ? (p.gone as unknown[]) : []) if (typeof id === "string" && ASSET_ID.test(id)) out.gone.push(id);
  return out;
}

/**
 * `world/cpm-<day>`: the owner's page writes one when a day's cut has its confirmations, and it stays for good. It is the
 * trust itself (a page starts from a body only with this beside it) and the cut's marks, which every page keeps to from then
 * on (countsUnder), wherever its replay starts.
 */
export interface TrustDoc {
  world: string;
  build: string;
  day: number;
  t: number;
  hash: string;
  /** The players whose own hashes matched (not the owner's). */
  by: string[];
  at: number;
  marks: Marks;
}
export function parseTrust(raw: unknown): TrustDoc | null {
  const d = raw as (Partial<TrustDoc> & { v?: unknown }) | undefined;
  if (!d || d.v !== 1 || !isText(d.world) || !isText(d.build) || !isInt(d.day) || !isInt(d.t) || d.t !== d.day * 1440 || !isHash(d.hash)) return null;
  const marks = parseMarks(d.marks);
  if (!marks) return null;
  const by = Array.isArray(d.by) ? (d.by as unknown[]).filter((u): u is string => isText(u)) : [];
  return { world: d.world, build: d.build, day: d.day, t: d.t, hash: d.hash, by, at: Number(d.at) || 0, marks };
}

/**
 * `world/alarm`: the owner's page writes it, never world/meta (the red team's finding 8).
 *  - open: a player whose own hash for a body's day differs from the body's. While one stands, no page starts from that
 *    body (pages take the one before, or their own cut, or the seed).
 *  - stood: the owner's page computed that day again from the cut before and got its own hash again.
 *  - barred: a cut withdrawn for good, by day and hash: its trust document and its body are never used again.
 *  - ignored: a player's reports for a day that no longer count (shown wrong by the node replay; the owner's decision).
 */
export interface Alarm {
  open: { day: number; hash: string; uid: string; theirs: string; at: number }[];
  stood: { day: number; hash: string }[];
  barred: { day: number; hash: string }[];
  ignored: { uid: string; day: number }[];
}
export const noAlarm = (): Alarm => ({ open: [], stood: [], barred: [], ignored: [] });
/** The alarm for `world`: another world's document (one left from before a restart) reads as none. */
export function parseAlarm(raw: unknown, world: string): Alarm {
  const out = noAlarm();
  const a = raw as { v?: unknown; world?: unknown; open?: unknown; stood?: unknown; barred?: unknown; ignored?: unknown } | undefined;
  if (!a || a.v !== 1 || a.world !== world) return out;
  const list = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? (x as unknown[]).filter((e): e is Record<string, unknown> => !!e && typeof e === "object") : []);
  for (const o of list(a.open)) if (isInt(o.day) && isHash(o.hash) && isText(o.uid) && isHash(o.theirs)) out.open.push({ day: o.day, hash: o.hash, uid: o.uid, theirs: o.theirs, at: Number(o.at) || 0 });
  for (const o of list(a.stood)) if (isInt(o.day) && isHash(o.hash)) out.stood.push({ day: o.day, hash: o.hash });
  for (const o of list(a.barred)) if (isInt(o.day) && isHash(o.hash)) out.barred.push({ day: o.day, hash: o.hash });
  for (const o of list(a.ignored)) if (isInt(o.day) && isText(o.uid)) out.ignored.push({ uid: o.uid, day: o.day });
  return out;
}

/**
 * `players/<uid>/x/days`: a page's own hashes of the last few day boundaries it computed itself, written by the tab that
 * holds the player's lease (the red team's finding 9: never the player's orders document, which a write replaces whole).
 * `from` says where that page's replay started ("seed", "local:<minute>" or "cp:<day>"), for reading a split afterwards.
 */
export interface DayReport {
  world: string;
  build: string;
  days: { day: number; hash: string; from: string }[];
}
export function parseDays(raw: unknown): DayReport | null {
  const d = raw as { v?: unknown; world?: unknown; build?: unknown; days?: unknown } | undefined;
  if (!d || d.v !== 1 || !isText(d.world) || !isText(d.build) || !Array.isArray(d.days)) return null;
  const days: DayReport["days"] = [];
  for (const x of d.days as { day?: unknown; hash?: unknown; from?: unknown }[]) {
    if (x && isInt(x.day) && isHash(x.hash)) days.push({ day: x.day, hash: x.hash, from: typeof x.from === "string" ? x.from.slice(0, 40) : "" });
  }
  return { world: d.world, build: d.build, days };
}

/** A cut pages keep to: a trust document's, its marks ready to look up. */
export interface KeptCut {
  day: number;
  t: number;
  hash: string;
  build: string;
  by: string[];
  /** Per player, the highest sequence number the cut had applied. */
  marks: Map<string, number>;
  /** The marks whole, as one text (marksKey). */
  marksKey: string;
}
/** A world's kept cuts from its trust documents, oldest first: this world's only, and none the alarm bars. */
export function keptCuts(trust: readonly TrustDoc[], alarm: Alarm, world: string): KeptCut[] {
  return trust
    .filter((d) => d.world === world && !alarm.barred.some((b) => b.day === d.day && b.hash === d.hash))
    .map((d) => ({ day: d.day, t: d.t, hash: d.hash, build: d.build, by: d.by, marks: new Map(d.marks.map((m) => [m[0], m[1]])), marksKey: marksKey(d.marks) }))
    .sort((x, y) => x.t - y.t);
}

/**
 * The late-order rule, the same on every page (the red team's findings 6 and 7): a record stamped before a kept cut is
 * part of history only if that cut had applied it, by its sequence number against the cut's mark for its player. Which cut:
 * the first kept one after the record's minute, so a record an earlier cut left out stays out however far the player's
 * mark moves on. A record stamped at or after the newest kept cut always counts.
 */
export function countsUnder(kept: readonly KeptCut[], uid: string, s: number, at: number): boolean {
  let lo = 0;
  let hi = kept.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (kept[mid]!.t > at) hi = mid;
    else lo = mid + 1;
  }
  const cut = kept[lo];
  return !cut || s <= (cut.marks.get(uid) ?? -1);
}

/**
 * The kept cut a page may start from for this body, or null: the body is this world's and this replay build's, a trust
 * document names the same day and hash, and no report against it stands (the red team's finding 3: a disputed checkpoint is
 * never loaded).
 */
export function adoptable(b: BodyRef, kept: readonly KeptCut[], alarm: Alarm, world: string, build: string): KeptCut | null {
  if (b.world !== world || b.build !== build) return null;
  const cut = kept.find((k) => k.day === b.day && k.hash === b.hash && k.build === build);
  if (!cut || alarm.open.some((o) => o.day === b.day && o.hash === b.hash)) return null;
  return cut;
}

/** A body's most bytes once unpacked: checked while it unpacks, before anything is parsed. */
export const BODY_MAX_BYTES = 128 * 1024 * 1024;

const B64 = 0x8000;
/**
 * A cut's text packed for the body store: gzipped (about 6:1), then base64 inside JSON, since the artifact's assets take
 * no gzip type and a text type must be valid UTF-8 (the red team's finding 11).
 */
export async function packBody(text: string): Promise<string> {
  const bytes = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += B64) s += String.fromCharCode(...bytes.subarray(i, i + B64));
  return JSON.stringify({ v: 1, gz: btoa(s) });
}
/** The text back, or null: not a packed body, or over `maxBytes` unpacked (it stops there, never holding more). */
export async function unpackBody(packed: string, maxBytes = BODY_MAX_BYTES): Promise<string | null> {
  try {
    const doc = JSON.parse(packed) as { v?: unknown; gz?: unknown };
    if (!doc || doc.v !== 1 || typeof doc.gz !== "string") return null;
    const bin = atob(doc.gz);
    const gz = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) gz[i] = bin.charCodeAt(i);
    const reader = new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
    const parts: Uint8Array[] = [];
    let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.byteLength;
      if (n > maxBytes) {
        await reader.cancel();
        return null;
      }
      parts.push(value);
    }
    return await new Blob(parts as Uint8Array<ArrayBuffer>[]).text();
  } catch {
    return null;
  }
}

/**
 * Where bodies are kept: the artifact's assets on the live page (keeper.ts assetBodies), memory in tests. A body is always
 * checked against its pointer's hash after it is read, so a store can lose or spoil one and never mislead a page.
 */
export interface BodyStore {
  /** Stores a packed body; null when this viewer can't (only the owner's page can, and only with the assets capability). */
  put(packed: string): Promise<{ id: string; bytes: number } | null>;
  /** The packed body, or null when it can't be read. */
  get(id: string): Promise<string | null>;
  delete(id: string): Promise<void>;
}
export function memoryBodies(canPut = true): BodyStore & { bodies: Map<string, string> } {
  const bodies = new Map<string, string>();
  let n = 0;
  return {
    bodies,
    put: async (packed) => {
      if (!canPut) return null;
      const id = `mem${String(++n).padStart(4, "0")}`;
      bodies.set(id, packed);
      return { id, bytes: packed.length };
    },
    get: async (id) => bodies.get(id) ?? null,
    delete: async (id) => void bodies.delete(id),
  };
}
