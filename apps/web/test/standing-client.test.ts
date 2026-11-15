import "./seed.js";
import { describe, expect, it } from "vitest";
import { standingDelivered, standingHit, weeklyStanding, type Company, type GameEvent, type Load, type World } from "@lanes/engine";
import { STANDING, STANDING_UX } from "../src/copy-standing.js";
import { weekdayDate } from "../src/format.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { cardUx, claimCosts, firstCallFor, firstCallsFor, ladderRows, milestoneAt, milestoneLost, offerTierLine, perkChips, perksOnLoad, sheetLine, standingLines, standingList, standingMoves, standingShown, standingWords, wonLine } from "../src/standingui.js";

/**
 * Standing with a market's shippers on the page (standingui.ts, copy-standing.ts; the director's card in
 * director-standing-final.md): the card's lines, the perks where they apply, the words for the engine's events, and the
 * month report's tier changes. Switch on and off.
 */
const ON = { ...GAME_CONFIG, standing: { ...GAME_CONFIG.standing, enabled: true } };
const WEEK = 7 * GAME_CONFIG.time.gameMinutesPerDay;

async function started(cfg: typeof ON = ON) {
  const g = await TestGame.create(undefined, undefined, 41, cfg);
  const c = g.join("Home Freight", "oo", "CMH")!;
  return { g, w: g.w, c };
}
let nextId = 800_000;
/** A load from `hub` of its shippers' own, as the engine's scorecard reads it. */
function fake(w: World, hub: number, o: { contract?: boolean; miles?: number; broker?: number } = {}): Load {
  const lane = w.net.lanesFrom[hub]![0]!;
  return { id: nextId++, brokerId: o.broker ?? null, shipperId: null, facilityId: null, doubleBroker: undefined, origin: hub, dest: lane.dest, laneId: lane.id, contractId: o.contract ? 1 : 0, miles: o.miles ?? 500, equipment: "van", originPlace: 0, destPlace: 0, status: "open", tenderUntil: 0 } as unknown as Load;
}
function reviews(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.t += WEEK;
    weeklyStanding(w);
  }
}
const deliver = (w: World, c: Company, hub: number, n: number, onTime = true) => {
  for (let i = 0; i < n; i++) standingDelivered(w, c, fake(w, hub), onTime, false);
};

describe("standing on the page", () => {
  it("the card reads in the director's three lines", async () => {
    const { w, c } = await started();
    const hub = c.homeHub;
    const m = w.net.hubs[hub]!.name;
    deliver(w, c, hub, 4);
    standingDelivered(w, c, fake(w, hub, { contract: true }), true, false);
    standingDelivered(w, c, fake(w, hub), false, false); // late: 5 of 6 on time, score 4 + 2 + 1 - 1 = 6
    reviews(w, 5);
    const lines = standingLines(w, c, hub)!;
    expect(lines.tier).toBe(5);
    expect(lines.head).toBe(`Standing with ${m} shippers · Preferred, tier 5 of 10 · rising`);
    expect(lines.next).toBe("Next: tier 6 at 7 counted loads in 180 days and 75% on time; you have 6. First call at tier 7.");
    expect(lines.detail).toBe("83% on time over 180 days · 6 loads (1 on contract) · 0 claims");
    expect(lines.marks).toBe("1 late");
    standingDelivered(w, c, fake(w, hub, { miles: 200 }), true, false); // 200 miles of 500: 6.4, still tier 5, and not away
    reviews(w, 4);
    expect(standingLines(w, c, hub)!.head).toContain("· steady");
    expect(standingLines(w, c, hub)!.next).toContain("you have 6.4.");
    expect(standingList(w, c).map((x) => x.hub)).toEqual([hub]);
  }, 120_000);

  it("names the tier where a perk applies: the docks at either end and the pay terms; the tier on a contract offer", async () => {
    const { w, c } = await started();
    const hub = c.homeHub;
    const m = w.net.hubs[hub]!.name;
    const l = fake(w, hub);
    c.standing = { [hub]: { tier: 3, days: [], lastLoadT: w.t, trend: [], log: [] } };
    expect(perksOnLoad(w, c, l)).toEqual([STANDING.dockHere(m, 3)]);
    c.standing[hub]!.tier = 5;
    expect(perksOnLoad(w, c, l)).toEqual([STANDING.dockHere(m, 5), STANDING.netHere(m, 5, 15)]);
    expect(perksOnLoad(w, c, fake(w, hub, { broker: 1 }))).toEqual([STANDING.dockHere(m, 5)]); // a broker's: the dock, never the pay
    expect(offerTierLine(w, c, { origin: hub })).toBeNull();
    c.standing[hub]!.tier = 9;
    expect(offerTierLine(w, c, { origin: hub })).toBe(STANDING.offeredFirst(m, 9));
    expect(offerTierLine(w, c, { origin: hub, dedicated: true })).toBe(STANDING.dedicatedOffer(m));
  }, 120_000);

  it("a first call held for the player says until when", async () => {
    const { w, c } = await started();
    const l = fake(w, c.homeHub);
    expect(firstCallFor(w, c, l)).toBeNull();
    l.firstCall = { companyId: c.id, round: w.round + 1, localUntil: 0, state: "open" };
    l.tenderUntil = 18 * 60;
    expect(firstCallFor(w, c, l)).toEqual({ until: "18:00", market: w.net.hubs[c.homeHub]!.name });
    l.firstCall.state = "declined";
    expect(firstCallFor(w, c, l)).toBeNull();
  }, 120_000);

  it("gives each engine event its words: a milestone's line, a fall through one, a first call, a lapse, a decay ahead, the first notice", async () => {
    const { w, c } = await started();
    const hub = c.homeHub;
    const m = w.net.hubs[hub]!.name;
    const ev = (x: Partial<Extract<GameEvent, { kind: "standing" }>>) => ({ kind: "standing" as const, companyId: c.id, hub, what: "tier" as const, ...x });
    expect(milestoneAt(w, 7)).toBe("firstCall");
    expect(milestoneAt(w, 6)).toBeNull();
    expect(milestoneLost(w, 7, 6)).toBe("firstCall");
    expect(milestoneLost(w, 6, 5)).toBeNull();
    expect(standingWords(w, ev({ from: 6, to: 7, cause: "rise" })).iuliia).toBe(STANDING.iuliiaMilestone(m, 7));
    expect(standingWords(w, ev({ from: 5, to: 6, cause: "rise" })).iuliia).toBeNull();
    const fell = standingWords(w, ev({ from: 7, to: 6, cause: "noShow" }));
    expect(fell.iuliia).toBe(`Your ${m} standing fell to tier 6 after a no-show. First call is gone until you're back at 7.`);
    expect(fell.tone).toBe("bad");
    expect(standingWords(w, ev({ what: "decayAhead" })).iuliia).toBe(`No ${m} load in seven weeks. Another week without one and your standing there drops a tier.`);
    expect(standingWords(w, ev({ what: "noticed" })).iuliia).toBe(`${m} shippers noticed. Keep delivering on time and they'll start calling you first.`);
    expect(standingWords(w, ev({ what: "declined", loadId: -1 }), true).feed).toBe(STANDING.firstCallDeclined(m));
    expect(standingWords(w, ev({ what: "declined", loadId: -1 })).feed).toContain("lapsed");
  }, 120_000);

  it("lists the month's tier changes with their cause", async () => {
    const { w, c } = await started();
    const hub = c.homeHub;
    const m = w.net.hubs[hub]!.name;
    const t0 = w.t;
    deliver(w, c, hub, 3);
    reviews(w, 3); // tiers 2, 3, 4
    standingHit(w, c, fake(w, hub), "noShow");
    reviews(w, 1); // 3 after the no-show
    const moves = standingMoves(w, c, t0, w.t + 1);
    const D = w.cfg.time.gameMinutesPerDay;
    const on = (k: number) => weekdayDate(Math.floor((t0 + k * WEEK) / D));
    expect(moves).toEqual([
      STANDING_UX.reportMove(m, 1, 2, STANDING.cause.rise, on(1)),
      STANDING_UX.reportMove(m, 2, 3, STANDING.cause.rise, on(2)),
      STANDING_UX.reportMove(m, 3, 4, STANDING.cause.rise, on(3)),
      STANDING_UX.reportMove(m, 4, 3, STANDING.cause.noShow, on(4)),
    ]);
    expect(moves[3]).toBe(`${m}: 4 → 3 after a no-show, ${on(4)}`);
    expect(standingMoves(w, c, t0 + 2 * WEEK + 1, w.t + 1)).toHaveLength(2);
  }, 120_000);

  it("shows nothing with the switch off", async () => {
    const { w, c } = await started({ ...GAME_CONFIG, standing: { ...GAME_CONFIG.standing, enabled: false } });
    const l = fake(w, c.homeHub);
    c.standing = { [c.homeHub]: { tier: 10, days: [], lastLoadT: w.t, trend: [], log: [] } };
    expect(standingLines(w, c, c.homeHub)).toBeNull();
    expect(standingList(w, c)).toEqual([]);
    expect(perksOnLoad(w, c, l)).toEqual([]);
    expect(offerTierLine(w, c, { origin: c.homeHub, dedicated: true })).toBeNull();
    expect(standingMoves(w, c, 0, w.t + WEEK)).toEqual([]);
  }, 120_000);
});

describe("standing to UX's spec (ux-next-screens part 1)", () => {
  it("§1.0: nothing shows before the first on-time direct delivery", async () => {
    const { w, c } = await started();
    const hub = c.homeHub;
    standingDelivered(w, c, fake(w, hub), false, false); // late: no notice yet
    expect(standingShown(w, c)).toBe(false);
    expect(cardUx(w, c, hub)).toBeNull();
    expect(sheetLine(w, c, fake(w, hub))).toBeNull();
    standingDelivered(w, c, fake(w, hub), true, false);
    expect(standingShown(w, c)).toBe(true);
    expect(sheetLine(w, c, fake(w, hub))!.text).toBe(STANDING_UX.countsToward(w.net.hubs[hub]!.name, "Approved", 1));
    expect(sheetLine(w, c, fake(w, hub, { broker: 1 }))!.text).toBe(STANDING_UX.brokered);
    const other = w.net.lanesFrom[hub]![0]!.dest;
    expect(sheetLine(w, c, fake(w, other))!.text).toBe(STANDING_UX.countsNew(w.net.hubs[other]!.name));
  }, 120_000);

  it("§1.1: the card's next floors, the figures against them, what's next unlocked, and the top tier's floors", async () => {
    const { w, c } = await started();
    const hub = c.homeHub;
    deliver(w, c, hub, 6);
    reviews(w, 6); // score 6 at 100%: tier 5
    const x = cardUx(w, c, hub)!;
    expect([x.tier, x.band, x.bandWord]).toEqual([5, "preferred", "Preferred"]);
    expect(x.next).toBe("Next: tier 6 at 7 counted loads and 75% on time.");
    expect(x.have).toBe("You have 6 counted loads, 100% on time.");
    expect(x.bars).toEqual({ loads: [6, 7], onTime: [1, 0.75] });
    expect(x.unlocks).toBe("First call at tier 7.");
    expect(x.top).toBeNull();
    c.standing![hub]!.tier = 10;
    const top = cardUx(w, c, hub)!;
    expect(top.next).toBeNull();
    expect(top.top).toBe("The top tier. To hold it: 30 counted loads and 90% on time.");
    expect(top.unlocks).toBeNull();
  }, 120_000);

  it("§1.1: the decay chip shows from a week before a decay", async () => {
    const { w, c } = await started();
    const hub = c.homeHub;
    deliver(w, c, hub, 3);
    reviews(w, 4); // tier 4
    expect(cardUx(w, c, hub)!.decay).toBeNull();
    reviews(w, 3); // seven weeks since the last load
    expect(cardUx(w, c, hub)!.decay).toContain(`No ${w.net.hubs[hub]!.name} load in 7 weeks · a tier off`);
  }, 120_000);

  it("§1.2: the ladder runs 10 to 1 with its bands, the player's row and the next", async () => {
    const { w, c } = await started();
    const hub = c.homeHub;
    deliver(w, c, hub, 3);
    reviews(w, 4);
    const rows = ladderRows(w, c, hub);
    expect(rows.map((r) => r.tier)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(rows.filter((r) => r.heading).map((r) => [r.tier, r.heading])).toEqual([
      [10, "CORE"],
      [8, "PREFERRED"],
      [4, "APPROVED"],
    ]);
    expect(rows.find((r) => r.state === "you")!.tier).toBe(4);
    expect(rows.find((r) => r.state === "next")!.tier).toBe(5);
    expect(rows.find((r) => r.tier === 7)!.perk).toBe(STANDING.perk.firstCall);
    expect(rows.find((r) => r.tier === 7)!.floors).toBe("10 loads · 80%");
    expect(rows.find((r) => r.tier === 1)!.floors).toBe("—");
  }, 120_000);

  it("§1.4: the claim lines' standing cost, the perks in force, and WON's count toward the next tier", async () => {
    const { w, c } = await started();
    const hub = c.homeHub;
    const m = w.net.hubs[hub]!.name;
    deliver(w, c, hub, 6);
    reviews(w, 6); // tier 5
    expect(claimCosts(w, c, fake(w, hub))).toEqual({ late: `, and one load off your ${m} standing`, noShow: `, and two loads off your ${m} standing`, release: `, and two loads off your ${m} standing` });
    expect(claimCosts(w, c, fake(w, hub, { broker: 1 }))).toBeNull();
    expect(perkChips(w, c, fake(w, hub))).toEqual({ dock: true, net: 15 });
    expect(perkChips(w, c, fake(w, hub, { broker: 1 }))).toEqual({ dock: true, net: null });
    expect(wonLine(w, c, fake(w, hub))).toBe(STANDING_UX.won(m, "7", 7, 6));
  }, 120_000);

  it("§1.5: first calls held for the player, soonest deadline first", async () => {
    const { w, c } = await started();
    const a = fake(w, c.homeHub);
    const b = fake(w, c.homeHub);
    for (const [l, until] of [[a, 18 * 60], [b, 6 * 60]] as const) {
      l.firstCall = { companyId: c.id, round: w.round + 1, localUntil: 0, state: "open" };
      l.tenderUntil = until;
      w.loads.set(l.id, l);
    }
    expect(firstCallsFor(w, c).map((l) => l.id)).toEqual([b.id, a.id]);
  }, 120_000);
});
