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
 * (cutText), the running hash of the records a world has applied (rollHash), the store's documents that carry a cut (the
 * body's pointer, the trust document, the alarm) and the archive of the records before one (arcDocs, readArc). What a page
 * does with them is in live.ts; what a page writes (its day hashes, and the owner's checkpoint) is keeper.ts, outside the
 * replay build.
 */

import { botState, restoreBotState, type BotState } from "@lanes/agents";
import type { World } from "@lanes/engine";
import { booksState, watchBooks, type BooksState } from "./books.js";
import { restoreTruckNos, truckNosState, type TruckNosState } from "./trucknos.js";

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
   * Step 3, on a page with the shared checkpoint on: the cut's hash as every page computes it (cutText); the running hash
   * of the records it had applied (rollHash); the trusted body its world came from, if it came from one; and the minute
   * history was frozen to when it was made, with the running hash there (the digest covers the records since that minute:
   * the ones before it are the archive's).
   */
  hash?: string;
  rh?: string;
  since?: { t: number; hash: string };
  under?: { t: number; rh: string };
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
// The red team's checkpoint reviews (redteam-checkpoint-2026-11-16.md, and the nine rules of 2026-11-22), by finding:
//  3  a page starts from a body only once two other players' pages have reported its hash and none disputes it
//     (adoptable); a hash is compared whole, all 64 hex;
//  4  the hash is of the whole cut (cutText): the world, the bots' state, the credit cache and the page's own records the
//     replay builds, and with them the world's key, the replay build, the minute, the running hash of the records applied
//     (rollHash) and the players' companies;
//  6, 7  a kept cut comes with the archive of the records applied up to it (arcDocs, world/arc/d/<first minute>), named by
//     its trust document (TrustDoc, world/cpm-<day>), and both stay in the store for good. A record stamped before the
//     newest trust document's minute is part of history only if the archive holds it, on every page, wherever its replay
//     starts (trustChain);
//  8  the alarm is its own document (Alarm, world/alarm), written by the owner's page from the players' own reports;
//  9  a page's day hashes are their own document (DayReport, days/<uid>), never the player's orders document;
//  10 a body names its replay build, and a page of another build never starts from it;
//  11 the body is an asset (packBody: gzip inside JSON, the one text type that fits) and its pointer a document.

/** What a cut is of, before the world's encoding: the first line of its text. */
export interface CutLine {
  v: 2;
  /** The world: seed, epoch and ruleset (live.ts worldKey). */
  world: string;
  build: string;
  /** The game minute, a day boundary: after hour 23's step and before any order stamped at that minute. */
  t: number;
  /** The running hash of every record the world had applied (rollHash). */
  rh: string;
  /** The players' companies: uid and carrier id, in the order they joined. */
  companies: [string, number][];
}

/**
 * A cut as one text: its line, then the world's encoding (engine encodeWorld with cutExtras). Its SHA-256 is the hash pages
 * report and compare, and the body the owner's page uploads is exactly this text.
 */
export function cutText(line: Omit<CutLine, "v">, encoding: string): string {
  const head: CutLine = { v: 2, world: line.world, build: line.build, t: line.t, rh: line.rh, companies: line.companies };
  return `${JSON.stringify(head)}\n${encoding}`;
}

const isInt = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x);
const isHash = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);
const isText = (x: unknown, max = 200): x is string => typeof x === "string" && x.length > 0 && x.length <= max;

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
  if (!raw || raw.v !== 2 || !isText(raw.world) || !isText(raw.build) || !isInt(raw.t) || !isHash(raw.rh) || !Array.isArray(raw.companies)) return null;
  const companies: [string, number][] = [];
  for (const c of raw.companies as unknown[]) {
    if (!Array.isArray(c) || !isText(c[0]) || !isInt(c[1])) return null;
    companies.push([c[0], c[1]]);
  }
  return { line: { v: 2, world: raw.world, build: raw.build, t: raw.t, rh: raw.rh, companies }, encoding: text.slice(nl + 1) };
}

// --- The records a world has applied: their text, and its running hash ---

const K256 = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/**
 * SHA-256 of a text, as 64 hex, computed here and now: the same value as sha256, without the wait. The replay takes the
 * running hash of its records inside its loop, at each day boundary, where it can't wait for the browser's own. Whole-number
 * arithmetic only, so every engine gives the same answer.
 */
export function hashNow(text: string): string {
  const data = new TextEncoder().encode(text);
  const n = data.length;
  const total = ((n + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[n] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor(n / 0x20000000));
  view.setUint32(total - 4, (n << 3) >>> 0);
  const h = new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Int32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getInt32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15]!;
      const y = w[i - 2]!;
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) | 0;
    }
    let a = h[0]!;
    let b = h[1]!;
    let c = h[2]!;
    let d = h[3]!;
    let e = h[4]!;
    let f = h[5]!;
    let g = h[6]!;
    let k = h[7]!;
    for (let i = 0; i < 64; i++) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (k + s1 + ((e & f) ^ (~e & g)) + K256[i]! + w[i]!) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      k = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = (h[0]! + a) | 0;
    h[1] = (h[1]! + b) | 0;
    h[2] = (h[2]! + c) | 0;
    h[3] = (h[3]! + d) | 0;
    h[4] = (h[4]! + e) | 0;
    h[5] = (h[5]! + f) | 0;
    h[6] = (h[6]! + g) | 0;
    h[7] = (h[7]! + k) | 0;
  }
  return Array.from(h, (x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

/** A record as one line of text: the player, then the record as live.ts parseActs shaped it. */
export const recLine = (uid: string, r: unknown): string => JSON.stringify([uid, r]);

/** The running hash before any record. */
export const RH0 = "";

/**
 * The running hash of the records a world has applied, moved on by one game day: the hash before the day and the day's
 * lines (recLine), in the order the world applied them (minute, player, number). Two worlds with the same running hash at a
 * day boundary had applied the same records up to it, a refused order included.
 */
export const rollHash = (prev: string, lines: readonly string[]): string => hashNow(`${prev}\n${lines.join("\n")}`);

/** `world/checkpoint`, one body: where the cut of a day is, and what its text must hash to. */
export interface BodyRef {
  day: number;
  t: number;
  hash: string;
  /** The running hash of the records the cut had applied (its line's). */
  rh: string;
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
    if (!b || !isInt(b.day) || !isInt(b.t) || b.t !== b.day * 1440 || !isHash(b.hash) || !isHash(b.rh) || !isText(b.world) || !isText(b.build)) continue;
    if (typeof b.asset !== "string" || !ASSET_ID.test(b.asset)) continue;
    out.bodies.push({ day: b.day, t: b.t, hash: b.hash, rh: b.rh, world: b.world, build: b.build, asset: b.asset, bytes: Number(b.bytes) || 0, at: Number(b.at) || 0 });
  }
  out.bodies.sort((x, y) => y.t - x.t);
  for (const id of Array.isArray(p.gone) ? (p.gone as unknown[]) : []) if (typeof id === "string" && ASSET_ID.test(id)) out.gone.push(id);
  return out;
}

// --- The archive: the records applied before a kept cut, in the store for good ---

/**
 * Where the archive's documents are: one level below the world's own, so a read of the `world` collection (every page reads
 * it whole, at its load and on each change) doesn't bring them. The store's rule for `world` covers the path.
 */
export const ARC_PATH = "world/arc/d";
/** An archive's documents: the head at its first minute, and the further parts of one too large for a single document. */
export const arcDocPath = (from: number, part = 0): string => `${ARC_PATH}/${from}${part ? `p${part}` : ""}`;
/** The most characters of a packed archive in one document (the store takes 256 KiB a document). */
export const ARC_PART_CHARS = 240_000;
/** The most parts a trust document may name, and an archive's most bytes once unpacked (checked while it unpacks). */
export const ARC_MAX_PARTS = 2048;
export const ARC_MAX_BYTES = 256 * 1024 * 1024;

/** An archive as its trust document names it. */
export interface ArcRef {
  /** The game minutes it covers: from `from` up to, not including, `to`. `from` is where the archive before it ended. */
  from: number;
  to: number;
  /** The SHA-256 of its text: one line a record (recLine), in the order the world applied them. */
  hash: string;
  /** How many documents carry it, how many records it holds, and its size packed (characters). */
  parts: number;
  n: number;
  bytes: number;
}
function parseArc(raw: unknown, t: number): ArcRef | null {
  const a = raw as Partial<ArcRef> | undefined;
  if (!a || typeof a !== "object" || !isInt(a.from) || a.from < 0 || a.from % 1440 !== 0 || a.from >= t || a.to !== t || !isHash(a.hash)) return null;
  if (!isInt(a.parts) || a.parts < 1 || a.parts > ARC_MAX_PARTS || !isInt(a.n) || a.n < 0) return null;
  return { from: a.from, to: t, hash: a.hash, parts: a.parts, n: a.n, bytes: Number(a.bytes) || 0 };
}

/**
 * An archive's text as the documents that carry it, in the order they are written: the further parts, then the head. The
 * text is packed as a body is (gzip, then base64) and cut into pieces of at most `partChars`; the head holds the first
 * piece, so an archive that fits one document is one document, and one read.
 */
export async function arcDocs(world: string, from: number, to: number, text: string, n: number, partChars = ARC_PART_CHARS): Promise<{ ref: ArcRef; docs: [string, Record<string, unknown>][] }> {
  const z = await gzip64(text);
  const pieces: string[] = [];
  for (let i = 0; i === 0 || i < z.length; i += partChars) pieces.push(z.slice(i, i + partChars));
  const ref: ArcRef = { from, to, hash: await sha256(text), parts: pieces.length, n, bytes: z.length };
  const docs: [string, Record<string, unknown>][] = [];
  for (let i = pieces.length - 1; i >= 1; i--) docs.push([arcDocPath(from, i), { v: 1, world, from, i, z: pieces[i]! }]);
  docs.push([arcDocPath(from), { v: 1, world, from, to, n, hash: ref.hash, parts: ref.parts, bytes: ref.bytes, z: pieces[0]! }]);
  return { ref, docs };
}

/** The part of the store an archive is read through. */
export interface ArcReader {
  doc(path: string): { get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined; metadata?: { fromCache?: boolean } }> };
}

/**
 * An archive's text from the store, six documents at a time, checked against `ref` before it is returned: it unpacks within
 * its size cap and hashes to the trust document's hash, whole. Null: the store doesn't hold that text (a document missing,
 * or another text's). It throws when the store's answer was a saved copy: that says nothing either way.
 */
export async function readArc(db: ArcReader, ref: ArcRef): Promise<string | null> {
  let z = "";
  for (let i = 0; i < ref.parts; i += 6) {
    const got = await Promise.all(Array.from({ length: Math.min(6, ref.parts - i) }, (_, j) => db.doc(arcDocPath(ref.from, i + j)).get()));
    for (const snap of got) {
      if (snap.metadata?.fromCache === true) throw new Error(`the store's answer for the archive at minute ${ref.from} was a saved copy`);
      const piece = snap.exists ? snap.data()?.z : undefined;
      if (typeof piece !== "string") return null;
      z += piece;
    }
  }
  const text = await gunzip64(z, ARC_MAX_BYTES);
  return text !== null && (await sha256(text)) === ref.hash ? text : null;
}

/**
 * `world/cpm-<day>`: the owner's page writes one when a day's cut has its confirmations, and it stays for good. It is two
 * things. The trust in the cut: a page starts from a body only with this beside it, and compares its own hash of the day
 * with this one. And the records' freeze: it names the archive of the records applied since the trust document before it,
 * and from then on those minutes' records are the archive's on every page. A cut can be withdrawn (the alarm's `barred`);
 * the archive its trust document names never is.
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
  /** The running hash of every record applied before `t` (the cut's line carries the same). */
  rh: string;
  arc: ArcRef;
}
export function parseTrust(raw: unknown): TrustDoc | null {
  const d = raw as (Partial<TrustDoc> & { v?: unknown }) | undefined;
  if (!d || d.v !== 2 || !isText(d.world) || !isText(d.build) || !isInt(d.day) || d.day < 1 || !isInt(d.t) || d.t !== d.day * 1440 || !isHash(d.hash) || !isHash(d.rh)) return null;
  const arc = parseArc(d.arc, d.t);
  if (!arc) return null;
  const by = Array.isArray(d.by) ? (d.by as unknown[]).filter((u): u is string => isText(u)) : [];
  return { world: d.world, build: d.build, day: d.day, t: d.t, hash: d.hash, by, at: Number(d.at) || 0, rh: d.rh, arc };
}

/**
 * A world's trust documents in order, oldest first, as far as their archives join: the first from minute 0, each next from
 * the minute the one before ended. So every minute before the last one's is covered by exactly one archive, a day whose own
 * cut was never kept included (the next kept cut's archive begins where the last one ended, however many days back). A
 * document that doesn't join, and any after it, is left out.
 */
export function trustChain(trust: readonly TrustDoc[], world: string): TrustDoc[] {
  const out: TrustDoc[] = [];
  let at = 0;
  for (const d of trust.filter((x) => x.world === world).sort((x, y) => x.t - y.t)) {
    if (d.arc.from !== at) break;
    out.push(d);
    at = d.t;
  }
  return out;
}

/**
 * `world/alarm`: the owner's page writes it, never world/meta (the red team's finding 8).
 *  - open: a player whose own hash for a body's day differs from the body's. While one stands, no page starts from that
 *    body (pages take the one before, or their own cut, or the seed).
 *  - stood: the owner's page computed that day again from the cut before and got its own hash again. From then on a
 *    kept body may be started from again, though the report stays open.
 *  - barred: a cut withdrawn for good, by day and hash: its body is never started from and its hash never compared
 *    again. A cut is withdrawn together with every cut kept after it. The records its trust document froze stay frozen.
 *  - ignored: a player's reports that no longer count, for one day or, with no day, for good (the owner's decision).
 */
export interface Alarm {
  open: { day: number; hash: string; uid: string; theirs: string; at: number }[];
  stood: { day: number; hash: string }[];
  barred: { day: number; hash: string }[];
  ignored: { uid: string; day?: number }[];
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
  for (const o of list(a.ignored)) {
    if (isText(o.uid) && isInt(o.day)) out.ignored.push({ uid: o.uid, day: o.day });
    else if (isText(o.uid) && o.day === undefined) out.ignored.push({ uid: o.uid });
  }
  return out;
}

/** Where the pages' day reports are: one collection, a document a player, which the owner's page takes in one read. */
export const DAYS_PATH = "days";
/** The most days of a report that are read. */
const REPORT_DAYS_READ = 16;

/**
 * `days/<uid>`: a page's own hashes of the last few day boundaries it computed itself, written by the tab that holds the
 * player's lease (the red team's finding 9: never the player's orders document, which a write replaces whole). Each day
 * comes with the running hash of the records that page had applied, so the owner's page can tell a page that computed
 * the day over other records (it will compute it again: neither a confirmation nor a report against the cut) from one
 * that computed another world over the same records. `from` says where that page's replay started ("seed",
 * "local:<minute>" or "cp:<day>"), for reading a split afterwards.
 */
export interface DayReport {
  world: string;
  build: string;
  days: { day: number; hash: string; rh: string; from: string }[];
}
export function parseDays(raw: unknown): DayReport | null {
  const d = raw as { v?: unknown; world?: unknown; build?: unknown; days?: unknown } | undefined;
  if (!d || d.v !== 1 || !isText(d.world) || !isText(d.build) || !Array.isArray(d.days)) return null;
  const days: DayReport["days"] = [];
  for (const x of (d.days as { day?: unknown; hash?: unknown; rh?: unknown; from?: unknown }[]).slice(0, REPORT_DAYS_READ)) {
    if (x && isInt(x.day) && isHash(x.hash) && isHash(x.rh)) days.push({ day: x.day, hash: x.hash, rh: x.rh, from: typeof x.from === "string" ? x.from.slice(0, 40) : "" });
  }
  return { world: d.world, build: d.build, days };
}

/** A cut pages keep to: a trust document's whose cut stands. */
export interface KeptCut {
  day: number;
  t: number;
  hash: string;
  build: string;
  by: string[];
  /** The running hash of the records applied before it. */
  rh: string;
}
/** The cuts that stand, oldest first: those of a world's trust documents (trustChain) that the alarm doesn't bar. */
export function keptCuts(chain: readonly TrustDoc[], alarm: Alarm): KeptCut[] {
  return chain.filter((d) => !alarm.barred.some((b) => b.day === d.day && b.hash === d.hash)).map((d) => ({ day: d.day, t: d.t, hash: d.hash, build: d.build, by: d.by, rh: d.rh }));
}

/**
 * The kept cut a page may start from for this body, or null: the body is this world's and this replay build's, a trust
 * document names the same day and hash, and no report against it is open that the owner's page hasn't answered. Once the
 * owner's page has computed the day again, over the archive's records, and stood by its cut (`stood`), the body may be
 * started from again: the same records computed twice gave the same world.
 */
export function adoptable(b: BodyRef, kept: readonly KeptCut[], alarm: Alarm, world: string, build: string): KeptCut | null {
  if (b.world !== world || b.build !== build) return null;
  const cut = kept.find((k) => k.day === b.day && k.hash === b.hash && k.build === build);
  if (!cut) return null;
  const same = (x: { day: number; hash: string }): boolean => x.day === b.day && x.hash === b.hash;
  return alarm.open.some(same) && !alarm.stood.some(same) ? null : cut;
}

/** A body's most bytes once unpacked: checked while it unpacks, before anything is parsed. */
export const BODY_MAX_BYTES = 128 * 1024 * 1024;

const B64 = 0x8000;
/** A text gzipped (about 6:1), then base64: what a store's text field or a text file can carry. */
async function gzip64(text: string): Promise<string> {
  const bytes = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += B64) s += String.fromCharCode(...bytes.subarray(i, i + B64));
  return btoa(s);
}
/** The text back, or null: not gzip in base64, or over `maxBytes` unpacked (it stops there, never holding more). */
async function gunzip64(packed: string, maxBytes: number): Promise<string | null> {
  try {
    const bin = atob(packed);
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
 * A cut's text packed for the body store: gzipped, then base64 inside JSON, since the artifact's assets take no gzip type
 * and a text type must be valid UTF-8 (the red team's finding 11).
 */
export async function packBody(text: string): Promise<string> {
  return JSON.stringify({ v: 1, gz: await gzip64(text) });
}
/** The text back, or null: not a packed body, or over `maxBytes` unpacked. */
export async function unpackBody(packed: string, maxBytes = BODY_MAX_BYTES): Promise<string | null> {
  try {
    const doc = JSON.parse(packed) as { v?: unknown; gz?: unknown };
    if (!doc || doc.v !== 1 || typeof doc.gz !== "string") return null;
    return await gunzip64(doc.gz, maxBytes);
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
