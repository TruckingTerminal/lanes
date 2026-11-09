import "./seed.js";
import { afterAll, describe, expect, it } from "vitest";
import { ruleBotHook } from "@lanes/agents";
import { dayOf, stepHour } from "@lanes/engine";
import { DISPATCHER_ORDERS, GAME_CONFIG, joinCompany, newWorld, PLAYER_DISPATCHER_ORDERS, WARM_HOURS } from "../src/game.js";

/**
 * The economy's test 5 for "usually clears near" as a ratio (freight.clearsNear.ratio; economy-clears-near-2026-11-09.md):
 * the trucker's month of economy-player34.md §2c on the new figure. An owner-operator joins the test page's world at
 * Dallas after its warm start, bids on R1's anchor (the players' dispatcher: what the load usually clears near, break-even
 * the floor) and books at break-even plus 20%, for thirty days, six seeds, under the old figure and the new. R1's anchor
 * must earn at least what it did. The world is the test page's own (game.ts newWorld, POPULATION, the live levers).
 *
 * A probe, run by hand: skipped unless LANES_PROBES=1 (`LANES_PROBES=1 npx vitest run apps/web/test/trucker-month.test.ts`).
 * Off by default because it takes about five minutes, and because CI's Node digests the same world differently from the
 * Mac's (646482b): with the seeds swinging ±50% the summed "on ≥ off" could flip there. The economy reads its figures from
 * engineering-rules-2026-11-09.md.
 */
const PROBES = process.env.LANES_PROBES === "1";
const SEEDS = [11, 23, 37, 41, 59, 73];
const kept: { seed: number; off: number; on: number }[] = [];

function month(seed: number, ratio: boolean): number {
  const k = GAME_CONFIG.freight.clearsNear as { ratio: boolean };
  const was = k.ratio;
  k.ratio = ratio;
  try {
    const w = newWorld(seed);
    while (w.t < WARM_HOURS * 60) stepHour(w, ruleBotHook);
    const c = joinCompany(w, "probe", "Probe Freight", "DAL", "oo")!;
    c.orders = [...PLAYER_DISPATCHER_ORDERS, ...c.orders.filter((o) => !DISPATCHER_ORDERS.has(o.kind))];
    c.firstHandBidDay = dayOf(w.t, w.cfg); // the owner's first call made: the dispatcher bids from now
    const start = c.operating.revenueFd - c.operating.costFd;
    for (let h = 0; h < 30 * 24; h++) stepHour(w, ruleBotHook);
    return c.operating.revenueFd - c.operating.costFd - start;
  } finally {
    k.ratio = was;
  }
}

describe.skipIf(!PROBES)("the trucker's month on R1's anchor (the economy's test 5; a probe: skipped unless LANES_PROBES=1)", () => {
  afterAll(() => {
    (GAME_CONFIG.freight.clearsNear as { ratio: boolean }).ratio = false;
  });

  for (const seed of SEEDS) {
    it(`seed ${seed}: a month under the old figure and the new`, () => {
      kept.push({ seed, off: month(seed, false), on: month(seed, true) });
    }, 300_000);
  }

  it("earns at least what it did over the six seeds", () => {
    expect(kept.length).toBe(SEEDS.length);
    const off = kept.reduce((s, x) => s + x.off, 0);
    const on = kept.reduce((s, x) => s + x.on, 0);
    console.log(`[trucker's month] ${kept.map((x) => `seed ${x.seed}: ${Math.round(x.off)} → ${Math.round(x.on)}`).join("; ")}; mean ${Math.round(off / kept.length)} → ${Math.round(on / kept.length)}`);
    expect(on).toBeGreaterThanOrEqual(off);
  });
});
