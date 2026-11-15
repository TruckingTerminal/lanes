import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import {
  acceptOffer,
  applyAction,
  bill,
  buildReport,
  callOrder,
  declineFirstCall,
  firstCallTaken,
  companyAccount,
  createWorld,
  dayOf,
  dockPriority,
  hubMiles,
  mayTake,
  nextRoundT,
  rejectTender,
  scorecard,
  standingCard,
  standingDelivered,
  standingHit,
  standingOwed,
  standingPaid,
  standingTerms,
  startLiquidation,
  refile,
  passTender,
  contractRate,
  stepHour,
  tallyOf,
  takeShare,
  tierFor,
  weeklyContracts,
  weeklyStanding,
  type Company,
  type GameEvent,
  type Load,
  type Scorecard,
  type World,
} from "@lanes/engine";

/**
 * Standing with a market's shippers, ten tiers (standing.ts; the director's director-standing-10.md and
 * director-standing-final.md, the economy's economy-standing.md), behind standing.enabled.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const ON = { ...LIVE, standing: { ...LIVE.standing, enabled: true } } as EconomyConfig;
/** The step down at once, as before the director's sprint §13 (noticeReviews 0): the tests of the floors' arithmetic. */
const AT_ONCE = { ...ON, standing: { ...ON.standing, noticeReviews: 0 } } as EconomyConfig;
const DAY = LIVE.time.gameMinutesPerDay;
const WEEK = 7 * DAY;

function bare(cfg: EconomyConfig = ON, seed = 13): World {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed });
  populate(w, { freeOwnerOperators: 8, fleets: 3, brokers: 1 });
  return w;
}
const carriers = (w: World) => w.companies.filter((c) => c.role === "carrier");
/** A load from `hub` of its shippers' own, as standingDelivered reads it. */
let fakeId = 900_000;
function fake(w: World, hub: number, o: { contract?: boolean; miles?: number; broker?: number; shipper?: number } = {}): Load {
  const lane = w.net.lanesFrom[hub]![0]!;
  return { id: fakeId++, brokerId: o.broker ?? null, shipperId: o.shipper ?? null, facilityId: null, origin: hub, dest: lane.dest, laneId: lane.id, contractId: o.contract ? 1 : 0, miles: o.miles ?? 500, equipment: "van" } as unknown as Load;
}
const deliverN = (w: World, c: Company, hub: number, n: number, onTime = true) => {
  for (let i = 0; i < n; i++) standingDelivered(w, c, fake(w, hub), onTime, false);
};
/** The reviews, a week apart, from now. */
function reviews(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.t += WEEK;
    weeklyStanding(w);
  }
}
const setTier = (c: Company, hub: number, tier: number, w: World, lanes?: number[]): Scorecard => {
  c.standing ??= {};
  return (c.standing[hub] = { tier, days: [], lastLoadT: w.t, trend: [], log: [], ...(lanes ? { lanes } : {}) });
};

describe("standing, off", () => {
  it("makes no state, and a three-day world is byte-identical with the switch off and with the section absent", () => {
    const { standing: _s, ...absentCfg } = LIVE as EconomyConfig & { standing?: unknown };
    const run = (cfg: EconomyConfig) => {
      const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 13 });
      populate(w, { freeOwnerOperators: 20, fleets: 6, brokers: 2 });
      for (let h = 0; h < 72; h++) stepHour(w, ruleBotHook);
      return w;
    };
    const off = run(LIVE);
    const absent = run(absentCfg as EconomyConfig);
    expect(off.companies.some((c) => c.standing !== undefined)).toBe(false);
    expect([...off.loads.values()].some((l) => l.firstCall !== undefined)).toBe(false);
    expect(off.standingStats).toBeUndefined();
    expect(buildReport(off).standing).toBeUndefined();
    const snap = (w: World) => JSON.stringify({ t: w.t, trucks: w.trucks, loads: [...w.loads.values()], books: w.companies.map((c) => [c.id, w.ledger.balance(companyAccount(c.id)), c.delivered, c.onTime, c.operating]), contracts: w.contracts, rng: w.rng });
    expect(snap(off)).toBe(snap(absent));
  }, 240_000);
});

describe("the score", () => {
  it("counts a load by its miles (a 500-mile run whole), a contract load double, nets the hits, and reads the on-time share", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    const hub = c.homeHub;
    deliverN(w, c, hub, 3);
    let t = tallyOf(w, scorecard(w, c, hub)!);
    expect(t.score).toBe(3);
    expect(tierFor(w, t)).toBe(4); // 3 loads at 100%: tier 4's floor
    standingDelivered(w, c, fake(w, hub, { contract: true }), true, false);
    standingDelivered(w, c, fake(w, hub, { miles: 200 }), true, false);
    standingDelivered(w, c, fake(w, hub, { contract: true, miles: 200 }), true, false);
    t = tallyOf(w, scorecard(w, c, hub)!);
    expect(t.score).toBeCloseTo(3 + 2 + 0.4 + 0.8, 9); // 200 miles of 500: 0.4, on contract 0.8
    expect(t.loads).toBe(6);
    expect(t.contractLoads).toBe(2);
    standingDelivered(w, c, fake(w, hub), false, false); // late: +1 and -1, and off the share
    standingDelivered(w, c, fake(w, hub), true, true); // a cargo claim: +1 and -2
    standingHit(w, c, fake(w, hub), "noShow");
    standingHit(w, c, fake(w, hub), "release");
    t = tallyOf(w, scorecard(w, c, hub)!);
    expect(t.score).toBeCloseTo(6.2 + 0 - 1 - 2 - 2, 9);
    expect(t.onTimeShare).toBeCloseTo(7 / 8, 12);
    expect([t.late, t.claims, t.noShows, t.releases]).toEqual([1, 1, 1, 1]);
  });

  it("builds nothing from a broker's load, nor from a player shipper's (its own facility's: the red team's S1)", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    standingDelivered(w, c, fake(w, c.homeHub, { broker: w.companies.find((x) => x.role === "broker")!.id }), true, false);
    standingDelivered(w, c, fake(w, c.homeHub, { shipper: c.id }), true, false);
    expect(scorecard(w, c, c.homeHub)).toBeUndefined();
  });

  it("weighs a short hop by its miles (the red team's S2): a 52-mile hop counts about a tenth", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    standingDelivered(w, c, fake(w, c.homeHub, { miles: 52 }), true, false);
    expect(tallyOf(w, scorecard(w, c, c.homeHub)!).score).toBeCloseTo(52 / 500, 9);
  });

  it("holds a tier below its on-time floor, whatever the loads", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    deliverN(w, c, c.homeHub, 14, true);
    deliverN(w, c, c.homeHub, 6, false); // 70% on time, 20 loads, score 14
    const t = tallyOf(w, scorecard(w, c, c.homeHub)!);
    expect(t.score).toBe(14);
    expect(t.onTimeShare).toBeCloseTo(0.7, 12);
    expect(tierFor(w, t)).toBe(4); // tier 5 wants 75%
  });

  it("forgets what's older than the window", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    deliverN(w, c, c.homeHub, 5);
    w.t += (LIVE.standing.windowDays + 1) * DAY;
    deliverN(w, c, c.homeHub, 1);
    expect(tallyOf(w, scorecard(w, c, c.homeHub)!).score).toBe(1);
  });
});

describe("the weekly review", () => {
  it("moves a tier a week at most, up to the floors and down after a heavy hit, naming the cause (a step down at once: noticeReviews 0)", () => {
    const w = bare(AT_ONCE);
    const c = carriers(w)[0]!;
    const hub = c.homeHub;
    const seen: GameEvent[] = [];
    w.listener = (e) => {
      if (e.kind === "standing" && e.what === "tier") seen.push(e);
    };
    deliverN(w, c, hub, 10); // score 10 at 100%: tier 7's floor
    const s = scorecard(w, c, hub)!;
    const path: number[] = [];
    for (let i = 0; i < 7; i++) {
      reviews(w, 1);
      path.push(s.tier);
    }
    expect(path).toEqual([2, 3, 4, 5, 6, 7, 7]);
    expect(standingCard(w, c, hub)!.trend).toBe("rising");
    deliverN(w, c, hub, 1);
    for (let i = 0; i < 3; i++) standingHit(w, c, fake(w, hub), "noShow"); // score 11 - 6 = 5: tier 5
    reviews(w, 1);
    expect(s.tier).toBe(6);
    reviews(w, 1);
    expect(s.tier).toBe(5);
    reviews(w, 1);
    expect(s.tier).toBe(5);
    expect(s.log.slice(-2).map((x) => [x.from, x.to, x.cause])).toEqual([
      [7, 6, "noShow"],
      [6, 5, "noShow"],
    ]);
    expect(seen.length).toBe(8);
    expect(standingCard(w, c, hub)!.trend).toBe("slipping");
  });

  it("decays a tier after eight weeks without a load, warns a week before, and lets it climb back once a load comes", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    const hub = c.homeHub;
    const ahead: number[] = [];
    w.listener = (e) => {
      if (e.kind === "standing" && e.what === "decayAhead") ahead.push(dayOf(w.t, w.cfg));
    };
    const t0 = w.t;
    deliverN(w, c, hub, 10);
    const s = scorecard(w, c, hub)!;
    reviews(w, 6); // week 6: tier 7, the last load at week 0
    expect(s.tier).toBe(7);
    reviews(w, 1); // week 7: the warning
    expect(ahead.length).toBe(1);
    expect(s.tier).toBe(7);
    reviews(w, 1); // week 8: the decay
    expect(s.tier).toBe(6);
    expect(s.log.at(-1)!.cause).toBe("decay");
    reviews(w, 6); // weeks 9 to 14: away, so no climb back and no second decay
    expect(s.tier).toBe(6);
    reviews(w, 1); // week 15: a warning again
    expect(ahead.length).toBe(2);
    reviews(w, 1); // week 16: the second decay
    expect(s.tier).toBe(5);
    w.t += DAY;
    deliverN(w, c, hub, 1); // back: the window still holds the old loads
    reviews(w, 1);
    expect(s.tier).toBe(6);
    expect(w.t - t0).toBeLessThan(LIVE.standing.windowDays * DAY);
  });

  it("drops a scorecard that's back at tier 1 with nothing in its window", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    deliverN(w, c, c.homeHub, 1);
    reviews(w, 1);
    expect(scorecard(w, c, c.homeHub)!.tier).toBe(2);
    reviews(w, 34); // the decay takes it back to 1, the load leaves the window, and so do the tier changes
    expect(scorecard(w, c, c.homeHub)).toBeUndefined();
  });

  it("enforces the floors downward (the red team's S6): one load every seven weeks stops the decay, not the slide as loads age out (noticeReviews 0)", () => {
    const w = bare(AT_ONCE);
    const c = carriers(w)[0]!;
    const hub = c.homeHub;
    deliverN(w, c, hub, 10);
    const s = scorecard(w, c, hub)!;
    reviews(w, 6);
    expect(s.tier).toBe(7);
    for (let week = 7; week <= 31; week++) {
      if (week % 7 === 0) deliverN(w, c, hub, 1);
      reviews(w, 1);
    }
    // The ten old loads left the window at day 180: three loads remain, so the tier stepped down a week at a time.
    expect(s.tier).toBe(4);
    expect(s.log.filter((x) => x.cause === "decay")).toEqual([]);
    expect(s.log.filter((x) => x.cause === "aged").map((x) => x.to)).toEqual([6, 5, 4]);
  });

  it("starts over at a refile, as at a liquidation (the red team's S7)", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    deliverN(w, c, c.homeHub, 3);
    refile(w, c);
    expect(c.standing).toBeUndefined();
  });

  it("goes with a liquidation", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    deliverN(w, c, c.homeHub, 3);
    startLiquidation(w, c);
    expect(c.standing).toBeUndefined();
    deliverN(w, c, c.homeHub, 1);
    expect(c.standing).toBeUndefined();
  });
});

describe("the tier-reached moments (UX next-screens §1.6)", () => {
  const two = (w: World, c: Company): [number, number] => {
    const other = w.net.hubs.find((h) => h.id !== w.net.hubs[c.homeHub]!.id)!;
    return [c.homeHub, w.net.hubs.indexOf(other)];
  };

  it("owes a hero only the first time a milestone is reached in any market, one a review, until it's seen", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    const [h1, h2] = two(w, c);
    setTier(c, h1, 2, w);
    setTier(c, h2, 2, w);
    deliverN(w, c, h1, 2); // tier 3's floor, in both markets
    deliverN(w, c, h2, 2);
    reviews(w, 1);
    expect([c.standing![h1]!.tier, c.standing![h2]!.tier]).toEqual([3, 3]);
    // One hero for the review, though two markets reached it; the best tier ever is 3.
    expect(standingOwed(w, c)).toEqual([{ tier: 3, hub: Math.min(h1, h2), t: w.t }]);
    expect(c.standingBest).toBe(3);
    expect(applyAction(w, c.id, { type: "standing_seen", tier: 3 }).ok).toBe(true);
    expect(c.standingOwed).toBeUndefined();
    // A third market at tier 3 later is a stamp: nothing owed. Tier 4 is no milestone; 5, the next first, is owed.
    const h3 = w.net.hubs.findIndex((_h, i) => i !== h1 && i !== h2);
    setTier(c, h3, 2, w);
    deliverN(w, c, h3, 2);
    deliverN(w, c, h1, 3);
    reviews(w, 1);
    expect([c.standing![h3]!.tier, c.standing![h1]!.tier]).toEqual([3, 4]);
    expect(c.standingOwed).toBeUndefined();
    reviews(w, 1);
    expect(c.standing![h1]!.tier).toBe(5);
    expect(standingOwed(w, c).map((o) => [o.tier, o.hub])).toEqual([[5, h1]]);
    expect(c.standingBest).toBe(5);
  });

  it("drops an owed hero whose market falls below it before it's seen; the best tier stays, so the climb back owes none", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    const hub = c.homeHub;
    setTier(c, hub, 4, w);
    deliverN(w, c, hub, 5);
    reviews(w, 1);
    expect(standingOwed(w, c).map((o) => o.tier)).toEqual([5]);
    for (let i = 0; i < 2; i++) standingHit(w, c, fake(w, hub), "noShow"); // 5 - 4: under tier 5's floor
    reviews(w, 1); // on notice (§13): the hero still owed
    expect(c.standing![hub]!.tier).toBe(5);
    expect(standingOwed(w, c).map((o) => o.tier)).toEqual([5]);
    reviews(w, 1);
    expect(c.standing![hub]!.tier).toBe(4);
    expect(c.standingOwed).toBeUndefined();
    expect(c.standingBest).toBe(5);
    deliverN(w, c, hub, 6);
    reviews(w, 1);
    expect(c.standing![hub]!.tier).toBe(5);
    expect(c.standingOwed).toBeUndefined();
  });

  it("a company from before the best tier was kept starts from the tiers it holds: no hero for what it already has", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    setTier(c, c.homeHub, 7, w);
    deliverN(w, c, c.homeHub, 10);
    reviews(w, 1);
    expect(c.standingBest).toBe(7);
    expect(c.standingOwed).toBeUndefined();
  });

  it("an owed hero goes with a liquidation and a refile; the best tier ever stays", () => {
    for (const end of ["liquidation", "refile"] as const) {
      const w = bare();
      const c = carriers(w)[0]!;
      setTier(c, c.homeHub, 2, w);
      deliverN(w, c, c.homeHub, 2);
      reviews(w, 1);
      expect(standingOwed(w, c).length).toBe(1);
      if (end === "liquidation") startLiquidation(w, c);
      else refile(w, c);
      expect(c.standingOwed).toBeUndefined();
      expect(c.standingBest).toBe(3);
    }
  });

  it("keeps what the market's loads paid, for the net-15 moment's figure; a row from before reads none", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    const hub = c.homeHub;
    standingDelivered(w, c, fake(w, hub), true, false, 1_200);
    standingDelivered(w, c, fake(w, hub), false, false, 800);
    expect(standingPaid(w, c, hub, 30)).toBe(2_000);
    w.t += 31 * DAY;
    expect(standingPaid(w, c, hub, 30)).toBe(0);
    c.standing![hub]!.days.push([dayOf(w.t, w.cfg), 1, 1, 0, 1, 1, 0, 0, 0, 0, 0]);
    expect(standingPaid(w, c, hub, 30)).toBe(0);
    expect(tallyOf(w, c.standing![hub]!).loads).toBe(3);
  });

  it("standing_seen takes a tier from 1 to 10; with standing off nothing is owed", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    expect(applyAction(w, c.id, { type: "standing_seen", tier: 11 }).ok).toBe(false);
    expect(applyAction(w, c.id, { type: "standing_seen", tier: 2.5 }).ok).toBe(false);
    expect(applyAction(w, c.id, { type: "standing_seen", tier: 5 }).ok).toBe(true);
    const off = bare(LIVE);
    const d = carriers(off)[0]!;
    d.standingOwed = [{ tier: 3, hub: d.homeHub, t: 0 }];
    expect(standingOwed(off, d)).toEqual([]);
  });
});

describe("on notice before a step down (the director's sprint §13)", () => {
  /** A market at tier 6 with its floor's 7 loads, and the events about it. */
  function atSix() {
    const w = bare();
    const c = carriers(w)[0]!;
    const hub = c.homeHub;
    setTier(c, hub, 6, w);
    deliverN(w, c, hub, 7);
    const seen: Extract<GameEvent, { kind: "standing" }>[] = [];
    w.listener = (e) => {
      if (e.kind === "standing" && e.companyId === c.id && e.hub === hub) seen.push(e);
    };
    return { w, c, hub, s: c.standing![hub]!, seen };
  }

  it("the first review under the floors puts it on notice, said once; the next one still under steps it down, naming the hit", () => {
    const { w, c, hub, s, seen } = atSix();
    standingHit(w, c, fake(w, hub), "noShow"); // 7 - 2: under tier 6's floor of 7
    reviews(w, 1);
    expect(s.tier).toBe(6);
    expect(s.notice).toBe(1);
    expect(standingCard(w, c, hub)!.notice).toBe(true);
    expect(seen.map((e) => [e.what, e.from, e.to])).toEqual([["onNotice", 6, 5]]);
    reviews(w, 1);
    expect(s.tier).toBe(5);
    expect(s.notice).toBeUndefined();
    expect(s.log.at(-1)).toMatchObject({ from: 6, to: 5, cause: "noShow" });
    expect(seen.map((e) => e.what)).toEqual(["onNotice", "tier"]);
  });

  it("back at the floors by the next review, it comes off notice with no step and no word", () => {
    const { w, c, hub, s, seen } = atSix();
    standingHit(w, c, fake(w, hub), "noShow");
    reviews(w, 1);
    expect(s.notice).toBe(1);
    deliverN(w, c, hub, 2); // 9 - 2: back at 7
    reviews(w, 1);
    expect(s.tier).toBe(6);
    expect(s.notice).toBeUndefined();
    expect(standingCard(w, c, hub)!.notice).toBe(false);
    expect(seen.map((e) => e.what)).toEqual(["onNotice"]);
  });

  it("a step up still comes at the first review that meets the next floor; and with noticeReviews 0, a step down at once", () => {
    const { w, c, hub, s } = atSix();
    deliverN(w, c, hub, 3); // 10: tier 7's floor
    reviews(w, 1);
    expect(s.tier).toBe(7);
    const o = bare(AT_ONCE);
    const d = carriers(o)[0]!;
    setTier(d, d.homeHub, 6, o);
    deliverN(o, d, d.homeHub, 7);
    standingHit(o, d, fake(o, d.homeHub), "noShow");
    reviews(o, 1);
    expect(d.standing![d.homeHub]!.tier).toBe(5);
    expect(d.standing![d.homeHub]!.notice).toBeUndefined();
  });
});

describe("first calls after the director's sprint §14", () => {
  /** A first call open for `c` on a load of its market's. */
  function called(w: World, c: Company, hub: number): Load {
    const l = fake(w, hub);
    Object.assign(l, { firstCall: { companyId: c.id, round: w.round + 1, localUntil: 0, state: "open" }, tenderedTo: c.id, tenderUntil: w.t + DAY, localUntilRound: 0 });
    return l;
  }

  it("a pass or a lapse is no hit: the score stands and no fall will name it, but it counts against the share of calls taken", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    const hub = c.homeHub;
    setTier(c, hub, 7, w);
    deliverN(w, c, hub, 10);
    const s = c.standing![hub]!;
    const score = tallyOf(w, s).score;
    declineFirstCall(w, called(w, c, hub));
    expect(tallyOf(w, s).score).toBe(score);
    expect(tallyOf(w, s).declined).toBe(1);
    expect(s.lastHit).toBeUndefined();
    const taken = called(w, c, hub);
    firstCallTaken(w, taken, c.id);
    expect(tallyOf(w, s).callsTaken).toBe(1);
    expect(takeShare(tallyOf(w, s))).toBe(0.5);
    expect(takeShare({ callsTaken: 0, declined: 0 })).toBe(1); // none yet counts as answering
  });

  it("among holders of a tier, the one that took the larger share of its calls is tried first; a higher tier before both", () => {
    const w = bare();
    const [a, b, d] = carriers(w);
    const hub = a!.homeHub;
    for (const c of [a!, b!]) setTier(c, hub, 7, w);
    setTier(d!, hub, 8, w);
    declineFirstCall(w, called(w, a!, hub)); // a: 0 of 1
    const list = [a!, b!, d!].map((c) => ({ c, tier: c.standing![hub]!.tier }));
    for (let i = 0; i < 5; i++) {
      const order = callOrder(w, list, fake(w, hub)).map((x) => x.c.id);
      expect(order).toEqual([d!.id, b!.id, a!.id]);
    }
  });
});

describe("the card", () => {
  it("reads the band, the next tier's floors, the next milestone and what the tier holds", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    const hub = c.homeHub;
    deliverN(w, c, hub, 6);
    standingDelivered(w, c, fake(w, hub, { contract: true }), true, false); // score 8: tier 6's floor is 7
    reviews(w, 5);
    const card = standingCard(w, c, hub)!;
    expect(card.tier).toBe(6);
    expect(card.band).toBe("preferred");
    expect(card.next).toEqual({ tier: 7, loads: 10, onTime: 0.8 });
    expect(card.nextPerk).toEqual({ tier: 7, perk: "firstCall" });
    expect(card.perks).toEqual(["dock", "net"]);
    expect([card.loads, card.contractLoads, card.score]).toEqual([7, 1, 8]);
    expect(standingCard(bare(LIVE), c, hub)).toBeNull();
  });
});

describe("the perks", () => {
  it("dock priority at the dock tier: half an hour off the dwell at the market's docks", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    setTier(c, c.homeHub, 2, w);
    expect(dockPriority(w, c.id, c.homeHub)).toBe(0);
    setTier(c, c.homeHub, 3, w);
    expect(dockPriority(w, c.id, c.homeHub)).toBe(30);
    expect(dockPriority(w, c.id, (c.homeHub + 1) % w.net.hubs.length)).toBe(0);
    const off = bare(LIVE);
    const oc = carriers(off)[0]!;
    setTier(oc, oc.homeHub, 10, off);
    expect(dockPriority(off, oc.id, oc.homeHub)).toBe(0);
  });

  it("net-15 at the net tier: the market's paper falls due in 15 days, and a factor's discount halves", () => {
    const w = bare();
    const c = carriers(w)[0]!;
    setTier(c, c.homeHub, 4, w);
    expect(standingTerms(w, c, fake(w, c.homeHub))).toBeUndefined();
    setTier(c, c.homeHub, 5, w);
    expect(standingTerms(w, c, fake(w, c.homeHub))).toBe(15);
    expect(standingTerms(w, c, fake(w, c.homeHub, { broker: 1 }))).toBeUndefined();
    const day = dayOf(w.t, w.cfg);
    // Net: the due day.
    c.factoring = null as unknown as Company["factoring"];
    c.payTerms = "net";
    bill(w, { payer: 0, faucet: "faucet:npc_shipper", payee: c, amountFd: 3000, ref: "load:1", termsDays: 15 });
    expect(w.receivables.at(-1)!.dueDay).toBe(day + 15);
    bill(w, { payer: 0, faucet: "faucet:npc_shipper", payee: c, amountFd: 3000, ref: "load:2" });
    expect(w.receivables.at(-1)!.dueDay).toBe(day + w.cfg.token.payment.termsDays);
    // The factoring contract: the discount at half.
    c.factoring = { until: day + 90, stakeFd: 0, rate: 0.04 };
    // The circular ledger credits a sink's FD to the reserve; its tag keeps the running total, in cents.
    const fees = () => (w.ledger.totals.get("sink:factoring_fee") ?? 0) / 100;
    const a = fees();
    bill(w, { payer: 0, faucet: "faucet:npc_shipper", payee: c, amountFd: 3000, ref: "load:3", termsDays: 15 });
    const b = fees();
    bill(w, { payer: 0, faucet: "faucet:npc_shipper", payee: c, amountFd: 3000, ref: "load:4" });
    const d = fees();
    expect(b - a).toBeCloseTo(60, 6);
    expect(d - b).toBeCloseTo(120, 6);
  });

  it("first call at the first-call tier: the market's direct loads held for one carrier with a truck that can make them, through the next clearing", () => {
    const w = bare(ON, 21);
    for (let h = 0; h < 30; h++) stepHour(w, ruleBotHook);
    // Every carrier with an idle crewed truck holds tier 7 where that truck stands.
    for (const t of w.trucks) if (t.status === "idle" && t.driverId && t.companyId) setTier(w.companies[t.companyId - 1]!, t.hub, 7, w);
    const offered: Extract<GameEvent, { kind: "standing" }>[] = [];
    w.listener = (e) => {
      if (e.kind === "standing" && e.what === "firstCall") offered.push(e);
    };
    const r0 = w.round;
    while (w.round === r0) stepHour(w, ruleBotHook); // the round, then the hour's book-now
    const clearT = nextRoundT(w);
    const all = offered.map((e) => w.loads.get(e.loadId!)!);
    for (const l of all) {
      expect(l.firstCall!.round).toBe(w.round + 1);
      expect(l.firstCall!.state === "open" || l.firstCall!.state === "taken").toBe(true);
      expect(l.latestPickupT! - clearT).toBeGreaterThanOrEqual(24 * 60);
      expect(l.brokerId === null && l.shipperId === null && l.contractId === 0 && l.hot === 0).toBe(true);
    }
    const calls = all.filter((l) => l.firstCall!.state === "open");
    expect(calls.length).toBeGreaterThan(0);
    for (const l of calls) {
      const fc = l.firstCall!;
      expect(l.tenderedTo).toBe(fc.companyId);
      expect(l.tenderUntil).toBe(clearT);
      expect(l.localUntilRound).toBe(0);
      const holder = w.companies[fc.companyId - 1]!;
      const other = carriers(w).find((c) => c.id !== holder.id)!;
      expect(mayTake(w, holder, l)).toBe(true);
      expect(mayTake(w, other, l)).toBe(false);
    }
    // One call a truck: no truck stands behind two.
    const trucks = offered.map((e) => e.truckId);
    expect(new Set(trucks).size).toBe(trucks.length);

    // A first call turned down: no hit since the director's §14, counted against the take share, and the load to the
    // board (or its locals-first hold).
    const turned = calls[0]!;
    const holder = w.companies[turned.firstCall!.companyId - 1]!;
    const had = turned.firstCall!.localUntil;
    const score = tallyOf(w, scorecard(w, holder, turned.origin)!).score;
    rejectTender(w, turned);
    expect(turned.firstCall!.state).toBe("declined");
    expect(turned.tenderedTo).toBe(0);
    expect(turned.localUntilRound).toBe(had);
    expect(tallyOf(w, scorecard(w, holder, turned.origin)!).declined).toBe(1);
    expect(tallyOf(w, scorecard(w, holder, turned.origin)!).score).toBe(score);

    // The rest, through the next round: each one taken by its carrier, or lapsed with a hit and the hold back a round later.
    const rest = calls.slice(1).map((l) => ({ l, had: l.firstCall!.localUntil }));
    while (w.round < turned.firstCall!.round) stepHour(w, ruleBotHook);
    for (const { l, had } of rest) {
      const fc = l.firstCall!;
      expect(fc.state === "taken" || fc.state === "declined").toBe(true);
      if (fc.state === "taken") expect(l.carrierId ?? fc.companyId).toBe(fc.companyId);
      else {
        expect(l.tenderedTo).toBe(0);
        expect(l.localUntilRound).toBe(had > 0 ? had + 1 : 0);
      }
    }
    const stats = w.standingStats!.firstCalls;
    expect(stats.offered).toBeGreaterThanOrEqual(all.length);
    expect(stats.taken + stats.declined).toBeGreaterThanOrEqual(all.length);
  }, 240_000);

  it("a world switched off mid-call settles its open first calls at the round's end, counting nothing", () => {
    const w = bare(ON, 21);
    for (let h = 0; h < 30; h++) stepHour(w, ruleBotHook);
    for (const t of w.trucks) if (t.status === "idle" && t.driverId && t.companyId) setTier(w.companies[t.companyId - 1]!, t.hub, 7, w);
    const r0 = w.round;
    while (w.round === r0) stepHour(w, ruleBotHook);
    const open = [...w.loads.values()].filter((l) => l.firstCall?.state === "open");
    expect(open.length).toBeGreaterThan(0);
    const declined = w.standingStats!.firstCalls.declined;
    w.cfg = { ...w.cfg, standing: { ...w.cfg.standing, enabled: false } };
    const r1 = w.round;
    while (w.round === r1) stepHour(w, ruleBotHook);
    for (const l of open) {
      expect(l.firstCall!.state === "declined" || l.firstCall!.state === "taken").toBe(true);
      if (l.firstCall!.state === "declined") expect(l.tenderedTo).toBe(0);
    }
    expect(w.standingStats!.firstCalls.declined).toBe(declined);
    expect([...w.loads.values()].some((l) => l.firstCall?.state === "open")).toBe(false);
  }, 240_000);

  it("first call takes at most firstCallMaxShare of a market's eligible loads a round (the red team's S3)", () => {
    const run = (share: number) => {
      const cfg = { ...ON, standing: { ...ON.standing, perks: { ...ON.standing.perks, firstCallMaxShare: share } } } as EconomyConfig;
      const w = bare(cfg, 21);
      for (let h = 0; h < 30; h++) stepHour(w, ruleBotHook);
      for (const t of w.trucks) if (t.status === "idle" && t.driverId && t.companyId) setTier(w.companies[t.companyId - 1]!, t.hub, 7, w);
      let n = 0;
      w.listener = (e) => {
        if (e.kind === "standing" && e.what === "firstCall") n++;
      };
      const r0 = w.round;
      while (w.round === r0) stepHour(w, ruleBotHook);
      return n;
    };
    expect(run(1)).toBeGreaterThan(0);
    expect(run(0)).toBe(0);
  }, 240_000);

  it("a first call taken through accept_tender books it at the board's book-now", () => {
    const w = bare(ON, 21);
    for (let h = 0; h < 30; h++) stepHour(w, ruleBotHook);
    for (const t of w.trucks) if (t.status === "idle" && t.driverId && t.companyId) setTier(w.companies[t.companyId - 1]!, t.hub, 7, w);
    const truckOf = new Map<number, number>();
    w.listener = (e) => {
      if (e.kind === "standing" && e.what === "firstCall") truckOf.set(e.loadId!, e.truckId!);
    };
    const r0 = w.round;
    while (w.round === r0) stepHour(w, ruleBotHook);
    const open = [...w.loads.values()].filter((x) => x.firstCall?.state === "open" && truckOf.has(x.id) && w.trucks[truckOf.get(x.id)! - 1]!.status === "idle");
    expect(open.length).toBeGreaterThan(0);
    let done: { l: Load; price: number } | null = null;
    for (const l of open) {
      const price = l.bookNow;
      if (applyAction(w, l.firstCall!.companyId, { type: "accept_tender", loadId: l.id, truckId: truckOf.get(l.id)! }).ok) {
        done = { l, price };
        break;
      }
    }
    expect(done).not.toBeNull();
    expect(done!.l.status).not.toBe("open");
    expect(done!.l.firstCall!.state).toBe("taken");
    expect(done!.l.clearedRate).toBe(done!.price);
    expect(done!.l.carrierId).toBe(done!.l.firstCall!.companyId);
  }, 240_000);

  it("contract offers at the contract tier: a carrier there is offered first, local or not", () => {
    const cfg = { ...ON, contracts: { ...ON.contracts, maxPerCompany: 10, direct: { ...ON.contracts.direct, enabled: false } } } as EconomyConfig;
    const w = bare(cfg, 5);
    for (let h = 0; h < 24; h++) stepHour(w, ruleBotHook);
    // A carrier running vans, and a market outside its home radius: off, it never gets that market's offers.
    const far = carriers(w).find((c) => w.trucksByCompany.get(c.id)!.some((t) => t.trailer === "van"))!;
    const m = [...w.net.hubs.keys()].find((h) => hubMiles(w, far.homeHub, h) > w.cfg.map.nearbyRadiusMi && w.net.lanesFrom[h]!.length > 0)!;
    setTier(far, m, 9, w);
    let got = 0;
    for (let k = 0; k < 20 && got === 0; k++) {
      weeklyContracts(w);
      got = w.contracts.filter((x) => x.carrierId === far.id && x.origin === m).length;
    }
    expect(got).toBeGreaterThan(0);
  }, 240_000);

  it("a dedicated lane at the top tier: offered on the lane its loads ran, with the direct freight's stake and standing's term, direct freight off", () => {
    const cfg = { ...ON, contracts: { ...ON.contracts, maxPerCompany: 10, direct: { ...ON.contracts.direct, enabled: false } } } as EconomyConfig;
    const w = bare(cfg);
    const c = carriers(w).find((x) => w.trucksByCompany.get(x.id)!.some((t) => t.trailer === "van"))!;
    const hub = c.homeHub;
    const lane = w.net.lanesFrom[hub]![1] ?? w.net.lanesFrom[hub]![0]!;
    setTier(c, hub, 10, w, [lane.id * 4, lane.id * 4, w.net.lanesFrom[hub]![0]!.id * 4]);
    weeklyContracts(w);
    const k = w.contracts.find((x) => x.carrierId === c.id && x.dedicated === true)!;
    expect(k).toBeDefined();
    expect([k.origin, k.laneId, k.equipment, k.status]).toEqual([hub, lane.id, "van", "offered"]);
    expect(k.loadsPerWeek).toBe(LIVE.standing.perks.dedicated.loadsPerWeek);
    expect(w.standingStats!.dedicatedOffered).toBe(1);
    // Not again while one is open, nor before reofferDays.
    weeklyContracts(w);
    expect(w.contracts.filter((x) => x.carrierId === c.id && x.dedicated === true).length).toBe(1);
    w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 1_000_000, "test");
    expect(acceptOffer(w, c, k)).toBeNull();
    expect(k.stakeFd).toBeGreaterThan(0);
    expect(k.endDay - k.startDay).toBe(LIVE.standing.perks.dedicated.termDays);
  });

  it("a dedicated lane's tender is never passed to the carrier's brokerage, and its rate reads the memory-free index (the red team's S5)", () => {
    const cfg = { ...ON, contracts: { ...ON.contracts, maxPerCompany: 10, direct: { ...ON.contracts.direct, enabled: false } } } as EconomyConfig;
    const w = bare(cfg);
    const c = carriers(w).find((x) => w.trucksByCompany.get(x.id)!.some((t) => t.trailer === "van"))!;
    const hub = c.homeHub;
    const lane = w.net.lanesFrom[hub]![0]!;
    setTier(c, hub, 10, w, [lane.id * 4]);
    weeklyContracts(w);
    const k = w.contracts.find((x) => x.carrierId === c.id && x.dedicated === true)!;
    w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 1_000_000, "test");
    expect(acceptOffer(w, c, k)).toBeNull();
    // A tender under the lane, as passTender reads it.
    const l = { id: 990_777, status: "open", brokerId: null, shipperId: null, contractId: k.id, tenderedTo: c.id, tenderUntil: w.t + 60 } as unknown as Load;
    // The carrier's own brokerage (the test's shortcut: an AI broker set as its partner), so Rule A would apply.
    c.partnerId = w.companies.find((x) => x.role === "broker")!.id;
    expect(passTender(w, c, l)).toContain("dedicated lane");
    // The index without the lost-load memory, where it's kept: a lane priced off it ignores the live index's lift.
    w.contractIndexBase = new Float64Array(w.contractIndex.length).fill(1);
    const free = contractRate(w, hub, lane.dest, "van", true);
    w.contractIndex = new Float64Array(w.contractIndex.length).fill(2); // the live index, lifted
    expect(contractRate(w, hub, lane.dest, "van", true)).toBeCloseTo(free, 9);
    expect(contractRate(w, hub, lane.dest, "van")).toBeGreaterThan(free);
  });
});

describe("standing on, the bots", () => {
  it("build scorecards and climb over five weeks, with the report's section", () => {
    const w = createWorld({ cfg: ON, net, feeds: neutralFeeds, seed: 7 });
    populate(w, { freeOwnerOperators: 20, fleets: 6, brokers: 2 });
    for (let h = 0; h < 35 * 24; h++) stepHour(w, ruleBotHook);
    const cards = w.companies.flatMap((c) => Object.values(c.standing ?? {}));
    expect(cards.length).toBeGreaterThan(10);
    expect(Math.max(...cards.map((s) => s.tier))).toBeGreaterThanOrEqual(3);
    const r = buildReport(w).standing!;
    expect(r).toBeDefined();
    expect(r.bestTier.oneTruck.reduce((a, b) => a + b, 0) + r.bestTier.fleet.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(r.quarters.length).toBeGreaterThan(0);
    expect(r.dockStops).toBeGreaterThan(0);
  }, 300_000);
});
