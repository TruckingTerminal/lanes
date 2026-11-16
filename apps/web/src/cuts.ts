/**
 * The world checkpoint, step 2a: each page's own local cuts (engineering-checkpoint-design-2026-11-16.md; the red team's
 * checkpoint review, "the writer: owner only, with a local cache for liveness"). A cut is this browser's own computation of
 * the live world at a day boundary (engine checkpoint.ts encodeWorld, with cutExtras and the credit cache), kept with
 * a digest of exactly the records it had applied. A page starts from the newest cut whose digest still matches the records
 * the store holds before it; anything else (a late, rewritten or erased record, another replay build, another world) makes
 * it fall back to an older cut or the seed. So a cut never drops an order and needs no trust: it only saves replaying
 * what this browser already computed.
 *
 * Off unless the page passes a store (LiveOptions.cuts; main.tsx with LOCAL_CUTS). The shared, trusted checkpoint (one
 * cut the owner's page writes for everyone, the late-order rule, the two-uid confirmation) is step 3.
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
    list: async (world) => [...cuts.values()].filter((c) => c.world === world).map(({ key, world: wd, build, t, digest }) => ({ key, world: wd, build, t, digest })),
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
