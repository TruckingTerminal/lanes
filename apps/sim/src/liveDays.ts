/**
 * The live world's day hashes from a copy of its store (the checkpoint's step 3; the red team's checkpoint review, finding
 * 3: when the owner's page and a player's page disagree about a day, "engineering's node replay of the exported store
 * decides"). The store's documents go into a store in memory, a page with no player replays them from the seed, taking
 * the records before the newest trust document from the archives as every page does, and hashes every day boundary on the
 * way. live-days.ts is its command line.
 */
import { memoryBodies, parseDays, parsePointer, parseTrust, REPLAY_BUILD } from "../../web/src/cuts.js";
import { LiveWorld, readMeta } from "../../web/src/live.js";
import { MemoryDb } from "../../web/src/memdb.js";

export interface DayLine {
  day: number;
  /** This replay's hash of the day's cut. */
  hash: string;
  /** The kept cut's hash of that day (world/cpm-<day>), the hash the store's body is said to have (world/checkpoint), and each player's reported hash. */
  kept: string | null;
  body: string | null;
  reports: { uid: string; hash: string; build: string }[];
}
export interface LiveDays {
  world: string;
  build: string;
  /** The game minute replayed to. */
  minute: number;
  days: DayLine[];
}

/** `docs`: the store's documents, path and body. `atMs`: the real time to replay to (the time of the copy). */
export async function liveDays(docs: [string, Record<string, unknown>][], atMs: number): Promise<LiveDays> {
  const db = new MemoryDb(() => atMs);
  for (const [path, body] of docs) await db.doc(path).set(body);
  const meta = await readMeta(db);
  if (!meta) throw new Error("the copy holds no world/meta");
  // No body can be read here, so the replay starts from the seed; every boundary is hashed.
  const lw = await LiveWorld.open(db, meta, null, { now: () => atMs, shared: { bodies: memoryBodies(false), everyDay: true } });
  await lw.rebuild();
  if (lw.broken) throw new Error(`the world stopped at minute ${lw.broken.at}: ${lw.broken.reason}`);
  // The hashes land a moment after their boundaries.
  const lastDay = Math.floor(lw.w.t / 1440);
  for (let i = 0; i < 2000 && lw.ownDays().length < lastDay; i++) await new Promise((r) => setTimeout(r, 5));
  const world = lw.worldKey();
  const pointer = parsePointer(docs.find(([p]) => p === "world/checkpoint")?.[1]);
  const trust = docs.filter(([p]) => /^world\/cpm-\d+$/.test(p)).map(([, b]) => parseTrust(b));
  const reports = docs.filter(([p]) => /^days\/[^/]+$/.test(p)).map(([p, b]) => ({ uid: p.split("/")[1]!, r: parseDays(b) }));
  const days = lw
    .ownDays()
    .sort((a, b) => a.day - b.day)
    .map((c): DayLine => ({
      day: c.day,
      hash: c.hash!,
      kept: trust.find((t) => t && t.world === world && t.day === c.day)?.hash ?? null,
      body: pointer.bodies.find((b) => b.world === world && b.day === c.day)?.hash ?? null,
      reports: reports.flatMap(({ uid, r }) => (r && r.world === world ? r.days.filter((d) => d.day === c.day).map((d) => ({ uid, hash: d.hash, build: r.build })) : [])),
    }));
  lw.close();
  return { world, build: REPLAY_BUILD, minute: lw.w.t, days };
}
