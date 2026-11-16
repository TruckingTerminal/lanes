import { describe, expect, it } from "vitest";
import { withLiveLevers } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { botState, populate, restoreBotState, ruleBotHook, type BotState } from "@lanes/agents";
import { applyAction, checkpointHash, companyAccount, createWorld, creditCacheState, dayOf, decodeWorld, encodeWorld, formCompany, stepHour, type World } from "@lanes/engine";

/**
 * The world checkpoint, step 1 (engineering-checkpoint-design-2026-11-16.md §4): the encoding round-trips, and a world
 * restored at a day boundary steps on exactly as the original does, its whole state equal at every day boundary after.
 * The live profile, the digest's population.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);

function world(seed: number): World {
  const w = createWorld({ cfg: LIVE, net, feeds: neutralFeeds, seed });
  populate(w, { freeOwnerOperators: 40, fleets: 8, brokers: 6 });
  return w;
}
const enc = (w: World) => encodeWorld(w, botState(w));
function restore(w: World): World {
  const { w: r, extras } = decodeWorld(enc(w), { cfg: w.cfg, net: w.net, feeds: w.feeds });
  restoreBotState(r, extras as BotState);
  return r;
}
const hours = (w: World, n: number) => {
  for (let h = 0; h < n; h++) stepHour(w, ruleBotHook);
};

describe("the world checkpoint's encoding (step 1)", () => {
  it("round-trips byte for byte, and encoding reads the world without changing it", () => {
    const w = world(3);
    hours(w, 4 * 24);
    const a = enc(w);
    expect(enc(w)).toBe(a);
    expect(enc(restore(w))).toBe(a);
    // The engine's own figures survive: the books, the clock, the Rng streams.
    const r = restore(w);
    expect(r.t).toBe(w.t);
    expect(r.ledger.supply()).toBe(w.ledger.supply());
    for (const c of w.companies) expect(r.ledger.balance(companyAccount(c.id))).toBe(w.ledger.balance(companyAccount(c.id)));
    expect(r.rng.agents.next()).toBe(w.rng.agents.next());
    expect(r.trucksByCompany.get(1)![0]).toBe(r.trucks[r.trucksByCompany.get(1)![0]!.id - 1]); // shared, not copied
  });

  for (const seed of [3, 11]) {
    for (const day of [2, 12]) {
      it(`seed ${seed}, restored at day ${day}: steps on as the original, equal at every day boundary for 4 days`, () => {
        const w = world(seed);
        hours(w, day * 24);
        expect(dayOf(w.t, w.cfg)).toBe(day);
        const r = restore(w);
        for (let d = 1; d <= 4; d++) {
          hours(w, 24);
          hours(r, 24);
          expect(enc(r)).toBe(enc(w));
        }
      }, 240_000);
    }
  }

  it("a player's orders, applied to both after the restore, keep them equal", () => {
    const w = world(11);
    const me = formCompany(w, { name: "Checkpoint Freight", role: "carrier", homeHubId: "DAL", strategy: "player:test", orders: [], freePath: true, human: true });
    hours(w, 3 * 24);
    const r = restore(w);
    const truck = w.trucksByCompany.get(me.id)![0]!;
    const play = (x: World) => {
      const load = [...x.loads.values()].find((l) => l.status === "open" && l.origin === truck.hub && l.equipment === truck.trailer);
      return [applyAction(x, me.id, { type: "set_standing_orders", orders: [] }), load ? applyAction(x, me.id, { type: "book_load", truckId: truck.id, loadId: load.id }) : null];
    };
    expect(play(r)).toEqual(play(w));
    for (let d = 1; d <= 3; d++) {
      hours(w, 24);
      hours(r, 24);
      expect(enc(r)).toBe(enc(w));
    }
  }, 240_000);

  // The red team's checkpoint review, item 1: a world restored at every day boundary (every module cache it doesn't carry
  // emptied each time) against the continuous one, so any cache with state of its own shows up.
  for (const seed of [3, 11]) {
    it(`seed ${seed}: restored at every day boundary for 8 days, equal to the continuous world each day`, () => {
      const w = world(seed);
      hours(w, 2 * 24);
      let r = restore(w);
      for (let d = 1; d <= 8; d++) {
        hours(w, 24);
        hours(r, 24);
        expect(enc(r)).toBe(enc(w));
        r = restore(r);
      }
    }, 240_000);
  }

  it("carries the round's credit scores, read at 00:00 before the night's settlements", () => {
    const w = world(11);
    hours(w, 5 * 24);
    const kept = creditCacheState(w);
    expect(kept).not.toBeNull();
    expect(kept!.scores.size).toBeGreaterThan(0);
    expect(creditCacheState(restore(w))).toEqual(kept);
  });

  it("writes NaN, Infinity, −0 and undefined exactly (the red team's item 2)", () => {
    const w = world(3); // fresh: contractIndex is filled with NaN at creation (world.ts)
    const r = restore(w);
    expect(Number.isNaN(w.contractIndex[0]!)).toBe(true);
    expect([...r.contractIndex].every((x) => Number.isNaN(x))).toBe(true);
    const profiles = (botState(r) as BotState).profiles.map(([, p]) => p);
    expect(profiles.some((p) => p.replaceAtMi === Infinity)).toBe(true);
    expect((botState(w) as BotState).profiles.map(([, p]) => p.replaceAtMi)).toEqual(profiles.map((p) => p.replaceAtMi));
    const odd = { a: -0, b: undefined, c: -Infinity };
    const back = decodeWorld(encodeWorld(w, odd), { cfg: w.cfg, net: w.net, feeds: w.feeds }).extras as typeof odd;
    expect(Object.is(back.a, -0)).toBe(true);
    expect(Object.keys(back)).toEqual(["a", "b", "c"]);
    expect(back.c).toBe(-Infinity);
  });

  it("throws on anything it can't write exactly", () => {
    const w = world(3);
    const bad: unknown[] = [
      { f: () => 1 },
      Object.defineProperty({}, "x", { get: () => 1, enumerable: true }),
      Object.defineProperty({}, "x", { value: 1, enumerable: false }),
      { [Symbol("s")]: 1 },
      Object.assign([1, 2], { extra: 3 }),
      new (class Odd {})(),
      { n: 10n },
    ];
    for (const b of bad) expect(() => encodeWorld(w, b)).toThrow(/checkpoint: can't write/);
  });

  it("the hash: equal worlds hash alike; an hour apart, they don't", async () => {
    const w = world(3);
    hours(w, 24);
    const h = await checkpointHash(enc(w));
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(await checkpointHash(enc(restore(w)))).toBe(h);
    hours(w, 1);
    expect(await checkpointHash(enc(w))).not.toBe(h);
  });
});
