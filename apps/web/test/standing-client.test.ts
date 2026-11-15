import "./seed.js";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { companyAccount, standingDelivered, standingHit, weeklyStanding, type Company, type GameEvent, type Load, type World } from "@lanes/engine";
import { S } from "../src/state.js";
import { checkMissedMoments, closeHero, heroNow } from "../src/ui/HeroMoment.js";
import { STANDING, STANDING_UX } from "../src/copy-standing.js";
import { weekdayDate } from "../src/format.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { cardsUx, ladderFoot, standingListed, standingScreen, stepShown } from "../src/standingui.js";
import { shortDate } from "../src/format.js";
import { awayStanding, momentPerk, reviewWhen, stampLine, troubleOpen, cardUx, claimCosts, firstCallFor, firstCallsFor, ladderRows, milestoneAt, milestoneLost, offerTierLine, perkChips, perksOnLoad, sheetLine, standingLines, standingList, standingMoves, standingShown, standingWords, wonLine } from "../src/standingui.js";

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
    reviews(w, 2); // on notice at the first (the director's §13), 3 after the no-show at the second
    const moves = standingMoves(w, c, t0, w.t + 1);
    const D = w.cfg.time.gameMinutesPerDay;
    const on = (k: number) => weekdayDate(Math.floor((t0 + k * WEEK) / D));
    expect(moves).toEqual([
      STANDING_UX.reportMove(m, 1, 2, STANDING.cause.rise, on(1)),
      STANDING_UX.reportMove(m, 2, 3, STANDING.cause.rise, on(2)),
      STANDING_UX.reportMove(m, 3, 4, STANDING.cause.rise, on(3)),
      STANDING_UX.reportMove(m, 4, 3, STANDING.cause.noShow, on(5)),
    ]);
    expect(moves[3]).toBe(`${m}: 4 → 3 after a no-show, ${on(5)}`);
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

describe("the tier-reached moments (UX next-screens §1.6)", () => {
  const atTier = (w: World, c: Company, hub: number, tier: number, log: { t: number; from: number; to: number; cause: "rise" | "late" }[] = []) => {
    c.standingNoticed = true;
    c.standing = { ...(c.standing ?? {}), [hub]: { tier, days: [], lastLoadT: w.t, trend: [], log } };
  };

  it("the perk line's figure is from the player's own books: net-15 from what the market's loads paid, first call and contracts from the scorecard", async () => {
    const { w, c } = await started();
    const hub = c.homeHub;
    const m = w.net.hubs[hub]!.name;
    for (let i = 0; i < 3; i++) standingDelivered(w, c, fake(w, hub), true, false, 2_100);
    expect(momentPerk(w, c, hub, 5)).toBe(`Your ${m} invoices now pay in 15 days, not 30. On last month's loads that's 6,300 FD two weeks sooner.`);
    expect(momentPerk(w, c, hub, 7)).toBe(`${m} shippers will call you first, a round before the board. You hauled 3 of their loads to get here.`);
    expect(momentPerk(w, c, hub, 9)).toBe(`${m} shippers will offer you their contracts first. 3 loads, 100% on time, brought you here.`);
    // No dock time by market in the engine, and no lane before it's offered: the perk alone, never an estimate.
    expect(momentPerk(w, c, hub, 3)).toBe(`Your trucks go to the front of the line at ${m} docks.`);
    expect(momentPerk(w, c, hub, 10)).toBe(`A lane of your own out of ${m}.`);
    w.t += 31 * GAME_CONFIG.time.gameMinutesPerDay;
    expect(momentPerk(w, c, hub, 5)).toBe(`Your ${m} invoices now pay in 15 days, not 30.`);
  }, 120_000);

  it("a stamp names the tier, and says back after a fall in that market", async () => {
    const { w, c } = await started();
    const hub = c.homeHub;
    const m = w.net.hubs[hub]!.name;
    atTier(w, c, hub, 5, [{ t: 1, from: 4, to: 5, cause: "rise" }]);
    expect(stampLine(w, c, hub, 5)).toBe(`${m} standing: Preferred, tier 5 of 10.`);
    atTier(w, c, hub, 5, [{ t: 1, from: 5, to: 4, cause: "late" }, { t: 2, from: 4, to: 5, cause: "rise" }]);
    expect(stampLine(w, c, hub, 5)).toBe(`Back to Preferred, tier 5 of 10, in ${m}.`);
  }, 120_000);

  it("a hero missed while away plays once when Standing or the Company card opens, waits over a tier-1 item, and the engine clears it", async () => {
    const { g, w, c } = await started();
    const hub = c.homeHub;
    const m = w.net.hubs[hub]!.name;
    S.game = g as never;
    try {
      atTier(w, c, hub, 5);
      c.standingOwed = [{ tier: 5, hub, t: w.t }];
      // In the red past the debt line: it waits.
      const acct = companyAccount(c.id);
      const cash = w.ledger.balance(acct);
      w.ledger.post(w.t, acct, "sink:test", cash + w.cfg.insolvency.debtLimitFd + 100, "test");
      expect(troubleOpen(w, c)).toBe(true);
      checkMissedMoments();
      expect(heroNow()).toBeNull();
      expect(c.standingOwed?.length).toBe(1);
      w.ledger.post(w.t, "faucet:starting_grant", acct, cash + w.cfg.insolvency.debtLimitFd + 100, "test");
      expect(troubleOpen(w, c)).toBe(false);
      // Over an open load sheet: it waits too.
      S.openLoad = 1;
      checkMissedMoments();
      expect(heroNow()).toBeNull();
      S.openLoad = null;
      checkMissedMoments();
      const h = heroNow()!;
      expect(h.name).toBe("bank");
      expect(h.title).toBe(STANDING.heroTitle(m, 5, "Preferred"));
      expect(h.paper).toEqual([STANDING_UX.heroPaper(m, "Preferred", 5), `Your ${m} invoices now pay in 15 days, not 30.`]);
      expect(h.badge).toEqual({ tier: 5, band: "preferred" });
      expect(h.glint).toBe(true);
      // Seen: the test world applies standing_seen at once, so a reload or another device has nothing to play.
      expect(c.standingOwed).toBeUndefined();
      closeHero();
      checkMissedMoments();
      expect(heroNow()).toBeNull();
    } finally {
      closeHero();
      S.openLoad = null;
      S.game = null;
    }
  }, 120_000);

  it("the return card: a line for each market that moved while away, with its badge, and See it for an owed hero, never over trouble", async () => {
    const { w, c } = await started();
    const hub = c.homeHub;
    const m = w.net.hubs[hub]!.name;
    atTier(w, c, hub, 5, [{ t: 100, from: 4, to: 5, cause: "rise" }]);
    c.standingOwed = [{ tier: 5, hub, t: 100 }];
    expect(awayStanding(w, c, 50, 200)).toEqual([{ text: STANDING_UX.returnLine(m, 4, 5), badge: { tier: 5, band: "preferred" }, seeIt: true }]);
    // Nothing moved in the span: the owed hero still gets its line.
    expect(awayStanding(w, c, 150, 200)).toEqual([{ text: STANDING_UX.returnOwed(m, "Preferred", 5), badge: { tier: 5, band: "preferred" }, seeIt: true }]);
    const acct = companyAccount(c.id);
    w.ledger.post(w.t, acct, "sink:test", w.ledger.balance(acct) + w.cfg.insolvency.debtLimitFd + 100, "test");
    expect(awayStanding(w, c, 50, 200)[0]!.seeIt).toBe(false);
    c.standingOwed = undefined;
    expect(awayStanding(w, c, 150, 200)).toEqual([]);
  }, 120_000);

  it("the hero is the engine's to owe: no browser memory of tiers, and seeing it sends standing_seen", () => {
    const src = readFileSync(join(__dirname, "..", "src", "ui", "HeroMoment.tsx"), "utf8");
    expect(src).not.toContain("lanes.standing.seen");
    expect(src).not.toContain("localStorage");
    expect(src).toContain('order({ type: "standing_seen", tier: o.tier }, "")');
  });
});

describe("the director's sprint §13 and §14 on the page", () => {
  it("§13: on notice, the card says the figure under the floor and the review that steps it down; a Need only when a perk would go", async () => {
    const { w, c } = await started();
    const hub = c.homeHub;
    const m = w.net.hubs[hub]!.name;
    c.standingNoticed = true;
    c.standing = { [hub]: { tier: 6, days: [], lastLoadT: w.t, trend: [], log: [], notice: 1 } };
    deliver(w, c, hub, 6);
    const x = cardUx(w, c, hub)!;
    expect(x.notice).toBe(STANDING_UX.onNoticeLoads("6", 6, 7, reviewWhen(w).day, m));
    expect(x.notice).toBe(`On notice: 6 loads against tier 6's 7. Still under at next ${reviewWhen(w).day}'s review, and ${m} drops to tier 5.`);
    expect(x.noticeNeed).toBe(false); // 6 → 5 keeps every perk
    c.standing[hub]!.tier = 5;
    expect(cardUx(w, c, hub)!.noticeNeed).toBe(true); // 5 → 4 loses net-15
    // Iuliia: only when a perk would go, and the engine's event carries no toast.
    const ev = (from: number, to: number) => ({ kind: "standing", companyId: c.id, hub, what: "onNotice", from, to }) as Extract<GameEvent, { kind: "standing" }>;
    expect(standingWords(w, ev(5, 4))).toEqual({ feed: null, iuliia: STANDING.iuliiaOnNotice(m, reviewWhen(w).day, STANDING.perk.net), tone: "" });
    expect(standingWords(w, ev(6, 5)).iuliia).toBeNull();
    c.standing[hub]!.notice = undefined;
    expect(cardUx(w, c, hub)!.notice).toBeNull();
  }, 120_000);

  it("§14: a pass costs nothing (no Confirm, no mark), the card counts the calls taken from tier 7, and Iuliia's tier-7 line says so", async () => {
    const { w, c } = await started();
    const hub = c.homeHub;
    const m = w.net.hubs[hub]!.name;
    c.standingNoticed = true;
    c.standing = { [hub]: { tier: 7, days: [], lastLoadT: w.t, trend: [], log: [] } };
    deliver(w, c, hub, 10);
    const row = c.standing[hub]!.days.at(-1)!;
    row[10] = 4; // declined first calls
    row[12] = 3; // first calls taken
    const x = cardUx(w, c, hub)!;
    expect(x.calls).toBe(STANDING_UX.callsLine(3, 7, w.cfg.standing.windowDays, m));
    expect(x.calls).toBe(`First calls: you took 3 of 7 in 180 days. ${m} shippers call first the carriers who take them.`);
    expect(standingLines(w, c, hub)!.marks).toBeNull();
    expect(STANDING.iuliiaMilestone(m, 7)).toBe(`${m} shippers call you first now, before the board and before the locals. Take the ones that pay: they call first the carriers who say yes.`);
    expect(STANDING.firstCallDeclined(m)).not.toMatch(/counts against/);
    const src = readFileSync(join(__dirname, "..", "src", "ui", "Standing.tsx"), "utf8");
    const pass = src.slice(src.indexOf("export function passFirstCall"), src.indexOf("/** Opens a first call on the board's sheet"));
    expect(pass).not.toContain("confirmAct(");
    expect(pass).toContain('order({ type: "decline_tender", loadId: l.id }');
    expect(w.cfg.standing.hits.declinedFirstCall).toBe(0);
  }, 120_000);
});

describe("0.25.3's client polish for standing (UX next-screens §1.3a, §13, §14)", () => {
  /** A scorecard as the review leaves it: its tier, loads in its window, the last load so many weeks back (null: never). */
  const card = (w: World, c: Company, hub: number, tier: number, loads: number, weeksAgo: number | null) => {
    c.standing = { ...(c.standing ?? {}), [hub]: { tier, days: [], lastLoadT: -1, trend: [], log: [] } };
    deliver(w, c, hub, loads);
    c.standing[hub]!.lastLoadT = weeksAgo === null ? -1 : w.t - weeksAgo * WEEK;
  };

  it("§1.3a: listed with a perk (tier 3 up) or a load in the decay window; the rest fold as compact rows; the header counts both", async () => {
    const { w, c } = await started();
    w.t += 30 * WEEK;
    c.standingNoticed = true;
    const [a, b, f, cc, d, e] = [1, 2, 3, 4, 5, 6].map((i) => (c.homeHub + i) % w.net.hubs.length) as [number, number, number, number, number, number];
    card(w, c, a, 5, 5, 12); // a perk, no recent load: listed
    card(w, c, f, 3, 2, 20); // dock priority, no recent load: listed
    card(w, c, b, 2, 1, 1); // no perk, a load a week ago: listed
    card(w, c, cc, 2, 1, 10); // no perk, the last load ten weeks back: folded
    card(w, c, d, 1, 1, 9); // tier 1 with a load in its window, nine weeks back: folded
    card(w, c, e, 1, 0, null); // tier 1, nothing in the window: no card anywhere
    expect([a, f, b].map((h) => standingListed(w, c, h))).toEqual([true, true, true]);
    expect([cc, d, e].map((h) => standingListed(w, c, h))).toEqual([false, false, false]);
    const scr = standingScreen(w, c);
    expect(scr.cards.map((x) => x.hub)).toEqual([a, f, b]);
    expect(cardsUx(w, c)).toEqual(scr.cards);
    expect(scr.fold.map((x) => x.hub)).toEqual([cc, d]);
    const day = (weeks: number) => shortDate(Math.floor((w.t - weeks * WEEK) / w.cfg.time.gameMinutesPerDay));
    expect(scr.fold[0]!.text).toBe(STANDING_UX.foldRow(w.net.hubs[cc]!.name, 2, day(10)));
    expect(scr.fold[0]!.text).toBe(`${w.net.hubs[cc]!.name} · tier 2 of 10 · last load ${day(10)}`);
    expect(scr.markets).toBe(5);
    expect(STANDING_UX.header(scr.markets)).toBe("Your standing with shippers in 5 markets.");
    expect(STANDING_UX.foldHead(2)).toBe("Other markets · 2");
    expect(STANDING_UX.foldLine(w.cfg.standing.decayWeeks)).toBe("No perk, and no load in the last 8 weeks.");
    // A load hauled there lists it again; nothing listed: the screen's empty line, the fold under it.
    c.standing![cc]!.lastLoadT = w.t;
    expect(standingListed(w, c, cc)).toBe(true);
    c.standing = { [cc]: { ...c.standing![cc]!, lastLoadT: w.t - 10 * WEEK } };
    expect(standingScreen(w, c)).toMatchObject({ cards: [], markets: 1 });
    expect(STANDING_UX.listEmpty(8)).toBe("No market where you hold a perk or hauled in the last 8 weeks.");
  }, 120_000);

  it("§1.3a: moments follow the list: a folded market's step is untold, but a step up to a perk and a lost milestone are told", async () => {
    const { w, c } = await started();
    w.t += 30 * WEEK;
    c.standingNoticed = true;
    const [b, cc, g] = [1, 2, 3].map((i) => (c.homeHub + i) % w.net.hubs.length) as [number, number, number];
    card(w, c, b, 2, 1, 1);
    card(w, c, cc, 1, 1, 10);
    card(w, c, g, 3, 2, 12);
    expect(stepShown(w, c, b, 1, 2)).toBe(true); // listed by its recent load
    expect(stepShown(w, c, cc, 2, 1)).toBe(false); // folded, and tier 2 to 1 loses nothing
    expect(stepShown(w, c, g, 2, 3)).toBe(true); // tier 3 holds dock priority: listed by it
    c.standing![cc]!.tier = 2;
    expect(stepShown(w, c, cc, 3, 2)).toBe(true); // folded now, but dock priority lost: still the plain notice
    const src = readFileSync(join(__dirname, "..", "src", "ui", "HeroMoment.tsx"), "utf8");
    expect(src).toContain(".filter((x) => stepShown(w, g.player!, x.hub, before.get(x.hub) ?? 1, x.tier))");
  }, 120_000);

  it("§13: on notice takes the decay chip's place; the ladder's foot says a step down comes after two reviews under the floor", async () => {
    const { w, c } = await started();
    w.t += 30 * WEEK;
    c.standingNoticed = true;
    const hub = c.homeHub;
    card(w, c, hub, 4, 2, 7.5);
    const near = cardUx(w, c, hub)!;
    expect(near.decay).not.toBeNull();
    expect(near.notice).toBeNull();
    c.standing![hub]!.notice = 1;
    const both = cardUx(w, c, hub)!;
    expect(both.notice).not.toBeNull();
    expect(both.decay).toBeNull();
    expect(ladderFoot(w)).toContain(" one tier at most. A step down comes after two reviews under the floor. A load counts");
    const none = await started({ ...ON, standing: { ...ON.standing, noticeReviews: 0 } });
    expect(ladderFoot(none.w)).not.toContain("A step down comes after");
  }, 120_000);

  it("§14: Pass is a plain button with no Confirm, and the first call's foot says a pass costs nothing", () => {
    expect(STANDING_UX.callFoot("18:00", "Dallas")).toBe("Passing costs nothing, and no answer by 18:00 is a pass. Dallas shippers call first the carriers who take their calls.");
    const src = readFileSync(join(__dirname, "..", "src", "ui", "Standing.tsx"), "utf8");
    const cards = src.slice(src.indexOf("export function FirstCallCards"), src.indexOf("/** The load sheet's first-call line"));
    expect(cards).not.toContain("danger");
    expect(cards).toContain("STANDING_UX.callFoot(until, m)");
    expect(src).not.toContain("confirmAct(");
    expect(Object.keys(STANDING_UX)).not.toContain("passConfirm");
  });
});
