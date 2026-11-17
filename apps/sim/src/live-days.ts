/**
 * The live world's day hashes from a copy of its store, in node (liveDays.ts): the judge of a report against a checkpoint.
 *
 *   npx tsx apps/sim/src/live-days.ts <store.json> [--at <real ms>]
 *
 * <store.json>: the store's documents, as { "<path>": <body>, … } or as [["<path>", <body>], …]: world/meta, every
 * players/<uid> and players/<uid>/log/<chunk>; and, to replay as the pages do and to compare, world/cpm-<day>,
 * world/alarm, world/checkpoint and players/<uid>/x/days. `--at`: the real time of the copy (default: now).
 *
 * Run it at the commit the live page was built from: it names its replay build as that page's build does
 * (apps/web/replay-build.mjs), and a hash is only comparable with a page's of the same build (lanesOwner.checkpoints().build).
 * Each line: the day, this replay's hash, then what the store says: the kept cut's hash, the body's, and each player's.
 */
import { readFileSync } from "node:fs";
import { replayBuild } from "../../web/replay-build.mjs";

(globalThis as { __LANES_REPLAY__?: string }).__LANES_REPLAY__ = replayBuild();
const { liveDays } = await import("./liveDays.js");

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const atArg = args.indexOf("--at");
if (!file) {
  console.error("usage: npx tsx apps/sim/src/live-days.ts <store.json> [--at <real ms>]");
  process.exit(2);
}
const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, Record<string, unknown>> | [string, Record<string, unknown>][];
const docs = Array.isArray(raw) ? raw : Object.entries(raw);
const out = await liveDays(docs, atArg >= 0 ? Number(args[atArg + 1]) : Date.now());
console.log(`world ${out.world}  replay build ${out.build}  replayed to minute ${out.minute}`);
const mark = (mine: string, theirs: string): string => (theirs === mine ? "same" : `DIFFERS ${theirs}`);
for (const d of out.days) {
  const parts = [`day ${d.day}`, d.hash];
  if (d.kept) parts.push(`kept: ${mark(d.hash, d.kept)}`);
  if (d.body && d.body !== d.kept) parts.push(`body: ${mark(d.hash, d.body)}`);
  for (const r of d.reports) parts.push(`${r.uid}${r.build === out.build ? "" : ` (build ${r.build})`}: ${mark(d.hash, r.hash)}`);
  console.log(parts.join("  "));
}
