/**
 * Cross-engine determinism (BACKLOG item 11): the live world is replayed in every player's browser, so every JavaScript
 * engine must compute the same world from the same seed and log. This prints the ten-day live-profile world's digest (the
 * same world and fields as packages/engine/test/windows.test.ts test 1), then one digest a day, so two engines that part
 * show the first day they do. CI runs it on several Node versions and on Bun (JavaScriptCore, Safari's engine) and fails
 * when any output differs (.github/workflows/determinism.yml).
 *
 *   npx tsx apps/sim/src/determinism.ts [days]      bun apps/sim/src/determinism.ts [days]
 *
 * A divergence comes from an engine-dependent call in the simulation: Math.sin, cos, exp, log or ** (each engine's own
 * libm); use packages/data/src/dmath.ts instead (dsin, dcos, dexp, dlog, dpow), which use only + − × ÷ and sqrt.
 */
import { createHash } from "node:crypto";
import { withLiveLevers } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { companyAccount, createWorld, stepHour } from "@lanes/engine";

const days = Number(process.argv[2] ?? 10);
const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
console.log(`network ${sha(JSON.stringify([net.lanes, net.nearby]))}`);
const w = createWorld({ cfg: LIVE, net, feeds: neutralFeeds, seed: 20_261_109 });
populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 6 });
const books = () => w.companies.map((c) => [c.id, w.ledger.balance(companyAccount(c.id)), c.delivered, c.onTime, c.operating]);
for (let d = 1; d <= days; d++) {
  for (let h = 0; h < 24; h++) stepHour(w, ruleBotHook);
  console.log(`day ${d} ${sha(JSON.stringify({ trucks: w.trucks, loads: [...w.loads.values()], books: books(), day: w.metrics.days.at(-1) ?? null, rng: w.rng }))}`);
}
const digest = sha(JSON.stringify({ t: w.t, next: w.nextLoadId, supply: w.ledger.supply(), books: books(), days: w.metrics.days, loads: [...w.loads.values()], trucks: w.trucks }));
console.log(`digest ${digest}`);
