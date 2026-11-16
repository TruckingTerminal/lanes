/**
 * The world checkpoint's encoding (engineering-checkpoint-design-2026-11-16.md, step 1; the red team's persistence pass §3):
 * a World, and any state the caller adds beside it (the bots' outside state, agents ruleBots.ts botState), as one canonical
 * text a restored world steps on from exactly as the original does. Nothing calls it yet: no rule, no page.
 *
 * The encoding is a JSON graph, every node a tagged array, so no field name can collide with a tag:
 * - a finite number other than −0, a string, a boolean, null: as itself;
 * - ["n", "NaN" | "Infinity" | "-Infinity" | "-0"], ["u"] for undefined (kept, so a restored object has the same keys in the
 *   same order), ["h"] for an array's hole;
 * - ["o", id, [k, v, …]] a plain object, ["a", id, […]] an array, ["m", id, [k, v, …]] a Map, ["s", id, […]] a Set,
 *   ["t", id, "Float64Array", base64] a typed array as its bytes, ["c", id, "Ledger", [k, v, …]] an instance of a
 *   registered class;
 * - ["r", id] an object met before: identity is kept (trucksByCompany holds the same trucks as w.trucks), and order is the
 *   objects' own, construction order, so the same world always encodes to the same text.
 *
 * Left out of the World and re-attached by the caller: `cfg`, `net`, `feeds` (never shared with the world's own objects)
 * and `listener`. The page's ledger reader (apps/web books.ts watchBooks: `post` and `unburn` on the Ledger instance) is
 * left out; the page installs it again on the restored world.
 *
 * Exact or nothing (the red team's checkpoint review, item 2): anything it can't write exactly throws: any other function,
 * a symbol or bigint, an accessor or non-enumerable property, a symbol key, extra keys on an array, Map or Set, or an
 * object of an unregistered class.
 *
 * Carried beside the world (item 1): the engine's state that lives outside it, the credit scores of the round in force
 * (credit.ts), which the 00:00 dispatchers read before the night's settlements.
 */
import type { EconomyConfig } from "@lanes/config";
import type { Feeds, Network } from "@lanes/data";
import { creditCacheState, restoreCreditCache } from "./credit.js";
import { Ledger } from "./ledger.js";
import { MetricsRecorder } from "./metrics.js";
import { Rng } from "./rng.js";
import type { World } from "./world.js";

export const CHECKPOINT_VERSION = 1;

/** The classes a world holds instances of (Object.create on their prototype, then the own fields). */
const CLASSES: Record<string, { prototype: object }> = { Ledger, MetricsRecorder, Rng };
const TYPED: Record<string, new (n: number) => ArrayLike<number> & { [i: number]: number }> = { Float64Array, Float32Array, Int32Array, Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array };
/** World fields the caller re-attaches: the config, the network and the feeds it was made with, and the page's listener. */
const ATTACHED = new Set(["cfg", "net", "feeds", "listener"]);

type Node = unknown;

function encodeNumber(x: number): Node {
  if (Number.isNaN(x)) return ["n", "NaN"];
  if (x === Infinity) return ["n", "Infinity"];
  if (x === -Infinity) return ["n", "-Infinity"];
  if (x === 0 && 1 / x < 0) return ["n", "-0"];
  return x;
}

/** The page's ledger reader (books.ts watchBooks): the one function a world holds, left out and installed again. */
const LEDGER_READER = new Set(["post", "unburn"]);

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const fail = (path: string, what: string): never => {
  throw new Error(`checkpoint: can't write ${what} exactly, at ${path}`);
};

/** Throws on what the encoding can't carry exactly: symbol keys, accessors, non-enumerable properties. */
function plainProps(v: object, path: string): void {
  if (Object.getOwnPropertySymbols(v).length) fail(path, "a symbol key");
  const names = Object.getOwnPropertyNames(v);
  for (const k of names) {
    const d = Object.getOwnPropertyDescriptor(v, k)!;
    if (d.get || d.set) fail(`${path}.${k}`, "an accessor");
    if (!d.enumerable && !(Array.isArray(v) && k === "length")) fail(`${path}.${k}`, "a non-enumerable property");
  }
}

function encoder() {
  const ids = new Map<object, number>();
  const enc = (v: unknown, path: string, top = false): Node => {
    if (v === undefined) return ["u"];
    if (v === null || typeof v === "string" || typeof v === "boolean") return v;
    if (typeof v === "number") return encodeNumber(v);
    if (typeof v !== "object") return fail(path, `a ${typeof v}`);
    const seen = ids.get(v);
    if (seen !== undefined) return ["r", seen];
    const id = ids.size;
    ids.set(v, id);
    if (Array.isArray(v)) {
      plainProps(v, path);
      if (Object.keys(v).some((k) => !/^(0|[1-9]\d*)$/.test(k))) fail(path, "an array with extra keys");
      const out: Node[] = [];
      for (let i = 0; i < v.length; i++) out.push(i in v ? enc(v[i], `${path}[${i}]`) : ["h"]);
      return ["a", id, out];
    }
    if (v instanceof Map || v instanceof Set) {
      if (Object.getPrototypeOf(v) !== (v instanceof Map ? Map.prototype : Set.prototype)) fail(path, "a Map or Set subclass");
      if (Object.getOwnPropertyNames(v).length || Object.getOwnPropertySymbols(v).length) fail(path, "a Map or Set with keys of its own");
      if (v instanceof Set) return ["s", id, [...v].map((x, i) => enc(x, `${path}<${i}>`))];
      const out: Node[] = [];
      let i = 0;
      for (const [k, x] of v) {
        out.push(enc(k, `${path}<key ${i}>`), enc(x, `${path}<${String(k)}>`));
        i++;
      }
      return ["m", id, out];
    }
    if (ArrayBuffer.isView(v)) {
      const name = v.constructor.name;
      if (!TYPED[name] || Object.getPrototypeOf(v) !== (TYPED[name] as unknown as { prototype: object }).prototype) return fail(path, `a ${name}`);
      return ["t", id, name, toBase64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))];
    }
    const proto = Object.getPrototypeOf(v);
    const cls = proto === Object.prototype ? null : Object.keys(CLASSES).find((n) => CLASSES[n]!.prototype === proto);
    if (proto !== Object.prototype && !cls) return fail(path, `a ${(v as object).constructor?.name ?? "null-prototype object"}`);
    plainProps(v, path);
    const out: Node[] = [];
    for (const [k, x] of Object.entries(v)) {
      if (top && ATTACHED.has(k)) continue;
      if (typeof x === "function") {
        if (cls === "Ledger" && LEDGER_READER.has(k)) continue; // the page's reader (books.ts watchBooks)
        fail(`${path}.${k}`, "a function");
      }
      out.push(k, enc(x, `${path}.${k}`));
    }
    return cls ? ["c", id, cls, out] : ["o", id, out];
  };
  return enc;
}

function decoder() {
  const objs: unknown[] = [];
  const num = (x: Node): number => {
    if (typeof x === "number") return x;
    const s = (x as [string, string])[1];
    return s === "NaN" ? NaN : s === "Infinity" ? Infinity : s === "-Infinity" ? -Infinity : -0;
  };
  const dec = (n: Node): unknown => {
    if (n === null || typeof n !== "object") return n;
    const a = n as unknown[];
    switch (a[0]) {
      case "n":
        return num(a);
      case "u":
        return undefined;
      case "r":
        return objs[a[1] as number];
      case "a": {
        const out: unknown[] = [];
        objs[a[1] as number] = out;
        const items = a[2] as Node[];
        out.length = items.length;
        items.forEach((x, i) => {
          if (Array.isArray(x) && x[0] === "h") return;
          out[i] = dec(x);
        });
        return out;
      }
      case "m": {
        const out = new Map();
        objs[a[1] as number] = out;
        const items = a[2] as Node[];
        for (let i = 0; i < items.length; i += 2) out.set(dec(items[i]), dec(items[i + 1]));
        return out;
      }
      case "s": {
        const out = new Set();
        objs[a[1] as number] = out;
        for (const x of a[2] as Node[]) out.add(dec(x));
        return out;
      }
      case "t": {
        const Ctor = TYPED[a[2] as string] as unknown as (new (b: ArrayBuffer) => unknown) | undefined;
        if (!Ctor) throw new Error(`checkpoint: unknown typed array ${String(a[2])}`);
        const out = new Ctor(fromBase64(a[3] as string).buffer as ArrayBuffer);
        objs[a[1] as number] = out;
        return out;
      }
      case "o":
      case "c": {
        const cls = a[0] === "c" ? CLASSES[a[2] as string] : null;
        if (a[0] === "c" && !cls) throw new Error(`checkpoint: unknown class ${String(a[2])}`);
        const out: Record<string, unknown> = cls ? Object.create(cls.prototype) : {};
        objs[a[1] as number] = out;
        const items = (a[0] === "c" ? a[3] : a[2]) as Node[];
        for (let i = 0; i < items.length; i += 2) out[items[i] as string] = dec(items[i + 1]);
        return out;
      }
      default:
        throw new Error(`checkpoint: bad node ${JSON.stringify(a).slice(0, 80)}`);
    }
  };
  return dec;
}

/**
 * The world at this instant, and `extras` beside it (the bots' outside state), as one canonical text. Shared objects across
 * the two are kept shared. Reads the world and changes nothing in it.
 */
export function encodeWorld(w: World, extras: unknown = null): string {
  const enc = encoder();
  return JSON.stringify({ v: CHECKPOINT_VERSION, world: enc(w, "w", true), engine: enc({ credit: creditCacheState(w) }, "engine"), extras: enc(extras, "extras") });
}

/**
 * A world from its encoding, with the config, the network and the feeds re-attached (they must be the ones it was made
 * with) and no listener; `extras` as encoded, for the caller to re-register (agents ruleBots.ts restoreBotState).
 */
export function decodeWorld(text: string, attach: { cfg: EconomyConfig; net: Network; feeds: Feeds }): { w: World; extras: unknown } {
  const doc = JSON.parse(text) as { v: number; world: Node; engine: Node; extras: Node };
  if (doc.v !== CHECKPOINT_VERSION) throw new Error(`checkpoint: version ${doc.v}, this engine reads ${CHECKPOINT_VERSION}`);
  const dec = decoder();
  const w = dec(doc.world) as World & Record<string, unknown>;
  const engine = dec(doc.engine) as { credit: Parameters<typeof restoreCreditCache>[1] };
  const extras = dec(doc.extras);
  Object.assign(w, { cfg: attach.cfg, net: attach.net, feeds: attach.feeds });
  restoreCreditCache(w, engine.credit);
  return { w, extras };
}

/** SHA-256 of a checkpoint's text, as 16 hex: the hash pages report and compare (crypto.subtle, in the page and in node). */
export async function checkpointHash(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const d = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}
