/**
 * The world checkpoint across JavaScript engines (engineering-checkpoint-design-2026-11-16.md §4; run by the determinism CI
 * beside determinism.ts): the ten-day live-profile world's checkpoint hash each day, then the world restored from its day-5
 * checkpoint and stepped on, its hash each day after. V8 (Node) and JavaScriptCore (Bun, Safari's engine) must print the
 * same lines, so a checkpoint one browser writes, another restores to the same world.
 *
 * Before those, the records' side of a cut (apps/web cuts.ts recLine, rollHash, hashNow; live.ts parseActs): a few orders
 * whose numbers and keys an engine could write its own way, shaped and put in order as the live page does, then their
 * text's hash, its running hash over two days, and the hash taken without a wait beside the engine's own.
 *
 *   npx tsx apps/sim/src/checkpoint-xengine.ts      bun apps/sim/src/checkpoint-xengine.ts
 */
import { withLiveLevers } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { botState, populate, restoreBotState, ruleBotHook, type BotState } from "@lanes/agents";
import { checkpointHash, createWorld, decodeWorld, encodeWorld, stepHour, type World } from "@lanes/engine";
import { hashNow, recLine, RH0, rollHash, sha256 } from "../../web/src/cuts.js";
import { parseActs, type ActRecord } from "../../web/src/live.js";

const orders = parseActs([
  { s: 0, at: 362, a: { type: "join", name: "\u00dcn\u00efcode Haul \ud83d\ude9a, with a name past the cap", hub: "CHI", look: "f" } },
  { s: 1, at: 400, a: { type: "place_bid", truckId: 3, loadId: 12345, rate: 0.1 + 0.2 } },
  { s: 2, at: 400, a: { rate: 1234.5 * 0.97, type: "place_bid", loadId: 9007199254740991, truckId: 1e21 } },
  { s: 3, at: 1439, a: { type: "set_standing_orders", orders: [{ kind: "bid", maxDeadheadMi: 250, price: { pct: 1 / 3, mode: "ceilingPct" } }, { kind: "floor", breakEvenPlusPct: 5e-7 }] } },
  { s: 4, at: 1440, a: { type: "x", "10": 1, "9": 2, b: -0, a: 1e-7, Z: 123456789.12345679, "\u00e9": null, nested: { z: [3, 2, { y: 1, x: 2 }], a: true } }, as: "brokerage" },
]);
const entries: { uid: string; r: ActRecord }[] = [];
for (const uid of ["bob", "alice", "Zed", "\u00e9lan", "alice2", "10", "9"]) for (const r of orders) entries.push({ uid, r });
// The order the live page applies records in: minute, player, number.
entries.sort((x, y) => x.r.at - y.r.at || (x.uid < y.uid ? -1 : x.uid > y.uid ? 1 : 0) || x.r.s - y.r.s);
const lines = entries.map((e) => recLine(e.uid, e.r));
const text = lines.join("\n");
console.log(`records ${lines.length} first ${lines[0]}`);
console.log(`records text ${await sha256(text)} without a wait ${hashNow(text)}`);
console.log(`records running ${rollHash(rollHash(RH0, lines.filter((_, i) => entries[i]!.r.at < 1440)), lines.filter((_, i) => entries[i]!.r.at >= 1440))}`);

const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const w = createWorld({ cfg: LIVE, net, feeds: neutralFeeds, seed: 20_261_109 });
populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 6 });
const enc = (x: World) => encodeWorld(x, botState(x));
const day = (x: World) => {
  for (let h = 0; h < 24; h++) stepHour(x, ruleBotHook);
};
let at5 = "";
for (let d = 1; d <= 10; d++) {
  day(w);
  const text = enc(w);
  if (d === 5) at5 = text;
  console.log(`day ${d} ${await checkpointHash(text)}`);
}
const { w: r, extras } = decodeWorld(at5, { cfg: LIVE, net, feeds: neutralFeeds });
restoreBotState(r, extras as BotState);
for (let d = 6; d <= 10; d++) {
  day(r);
  console.log(`restored day ${d} ${await checkpointHash(enc(r))}`);
}
