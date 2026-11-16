/**
 * The world checkpoint across JavaScript engines (engineering-checkpoint-design-2026-11-16.md §4; run by the determinism CI
 * beside determinism.ts): the ten-day live-profile world's checkpoint hash each day, then the world restored from its day-5
 * checkpoint and stepped on, its hash each day after. V8 (Node) and JavaScriptCore (Bun, Safari's engine) must print the
 * same lines, so a checkpoint one browser writes, another restores to the same world.
 *
 *   npx tsx apps/sim/src/checkpoint-xengine.ts      bun apps/sim/src/checkpoint-xengine.ts
 */
import { withLiveLevers } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { botState, populate, restoreBotState, ruleBotHook, type BotState } from "@lanes/agents";
import { checkpointHash, createWorld, decodeWorld, encodeWorld, stepHour, type World } from "@lanes/engine";

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
