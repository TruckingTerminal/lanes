import "./seed.js";
import { describe, expect, it } from "vitest";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { clearsWhen, createWorld, noteClear, stepHour, type Load, type World } from "@lanes/engine";
import { WINDOWS } from "../src/copy-windows.js";
import { GAME_CONFIG } from "../src/game.js";
import { clearsTiming } from "../src/windowsui.js";

/** When loads clear, beside "usually clears near" (economy-windows-clearsnear-2026-11-13.md, its tests 1 to 4). */
const WIN = { ...GAME_CONFIG, windows: { ...GAME_CONFIG.windows, enabled: true } };
function world(cfg = WIN): World {
  const w = createWorld({ cfg, net: buildNetwork(hubs, cfg), feeds: neutralFeeds, seed: 5 });
  populate(w, { freeOwnerOperators: 10, fleets: 2, brokers: 1 });
  for (let h = 0; h < 6; h++) stepHour(w, ruleBotHook);
  return w;
}
/** A clear on a lane, written at this minute (no decay between them): `quick` within a round of posting, `walk` in the urgency walk. */
function clear(w: World, l: Load, quick: boolean, walk: boolean): void {
  noteClear(w, { ...l, contractId: 0, postedRound: quick ? w.round : w.round - 4, urgentSteps: walk ? 1 : 0 } as Load, l.bookNow);
}
/** Two open loads from one origin on different lanes, and one from another hub, all of one trailer. */
function pick(w: World): { a: Load; b: Load; other: Load } {
  const open = [...w.loads.values()].filter((l) => l.status === "open" && l.equipment === "van");
  const a = open[0]!;
  const b = open.find((l) => l.origin === a.origin && l.laneId !== a.laneId)!;
  const other = open.find((l) => l.origin !== a.origin && !open.some((x) => x !== l && x.origin === l.origin && w.clearsWhen?.hub[`${l.origin}:van`]))!;
  return { a, b, other };
}

describe("when loads clear, under windows", () => {
  it("a lane with ten clears, six within a round of posting, reads the round clause", () => {
    const w = world();
    w.clearsWhen = undefined;
    const { a } = pick(w);
    for (let i = 0; i < 10; i++) clear(w, a, i < 6, false);
    expect(clearsWhen(w, a)).toMatchObject({ from: "lane" });
    expect(clearsWhen(w, a)!.quick).toBeCloseTo(0.6, 9);
    expect(clearsTiming(w, a)?.clause).toBe(WINDOWS.clearsQuick);
    expect(clearsTiming(w, a)?.share).toContain("60%");
  }, 60_000);

  it("six of ten in the urgency walk read the walk clause, which wins over the round clause", () => {
    const w = world();
    w.clearsWhen = undefined;
    const { a } = pick(w);
    for (let i = 0; i < 10; i++) clear(w, a, true, i < 6);
    expect(clearsTiming(w, a)?.clause).toBe(WINDOWS.clearsWalk);
  }, 60_000);

  it("a lane under five of weight reads its hub's shares; a hub under five shows no clause", () => {
    const w = world();
    w.clearsWhen = undefined;
    const { a, b } = pick(w);
    for (let i = 0; i < 6; i++) clear(w, b, true, false); // the hub's weight from another lane
    for (let i = 0; i < 3; i++) clear(w, a, false, false); // this lane: too few
    expect(clearsWhen(w, a)).toMatchObject({ from: "hub" });
    w.clearsWhen = undefined;
    for (let i = 0; i < 4; i++) clear(w, a, true, false); // lane and hub both under five
    expect(clearsWhen(w, a)).toBeNull();
    expect(clearsTiming(w, a)).toBeNull();
  }, 60_000);

  it("with windows off, no clause and nothing kept", () => {
    const w = world(GAME_CONFIG);
    const l = [...w.loads.values()].find((x) => x.status === "open")!;
    for (let i = 0; i < 10; i++) clear(w, l, true, true);
    expect(w.clearsWhen).toBeUndefined();
    expect(clearsWhen(w, l)).toBeNull();
    expect(clearsTiming(w, l)).toBeNull();
  }, 60_000);
});
