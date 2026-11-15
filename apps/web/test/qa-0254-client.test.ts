import "./seed.js";
import { describe, expect, it } from "vitest";
import { applyAction, companyAccount, dayOf, placeMiles, placeOfHub, standingLoad, threePartsOn, weekdayName, type Company, type World } from "@lanes/engine";
import { blockLine } from "../src/board.js";
import { LOAD } from "../src/copy.js";
import { FIXES } from "../src/copy-fixes.js";
import { RESERVE } from "../src/copy-reserve.js";
import { WINDOWS } from "../src/copy-windows.js";
import { pct } from "../src/format.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { S } from "../src/state.js";
import { reputationExplain, reputationRows, wholePoints } from "../src/reputationui.js";
import { depositSheet, reserveCard } from "../src/reserveui.js";
import { nextReviewDay, reviewWhen } from "../src/standingui.js";
import { releaseCard, releaseCurrentCard } from "../src/windowsui.js";
import { handOverAt } from "../src/ui/panels/Showroom.js";

/** QA's 0.25.4 replay (qa-0254-2026-11-15.md): the reputation sheet under three parts, and the lower items. */
const DAY = GAME_CONFIG.time.gameMinutesPerDay;
const toCash = (w: World, c: Company, fd: number) => {
  const have = w.ledger.balance(companyAccount(c.id));
  if (have < fd) w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), fd - have, "test");
  else w.ledger.post(w.t, companyAccount(c.id), "sink:test", have - fd, "test");
};

async function fresh() {
  const g = await TestGame.create(undefined, undefined, 41, GAME_CONFIG);
  const c = g.join("Replay Freight", "oo", "CMH")!;
  return { g, w: g.w, c };
}

describe("QA's 0.25.4 replay: the reputation sheet", () => {
  it("with three parts on, how it's computed and what moves it follow the parts; off, the sheet keeps today's words", async () => {
    const { w } = await fresh();
    expect(threePartsOn(w)).toBe(true); // on in the live levers since 0.25.4
    const k = w.cfg.reputation.threeParts;
    const x = reputationExplain(w)!;
    expect(x).toEqual(FIXES.repExplain(pct(k.safety), pct(k.service), pct(k.experience), k.experienceCap));
    expect(x.how).not.toContain("smoothed");
    for (const part of ["safety record", "Service", "Experience"]) expect(x.moves).toContain(part);
    const off = { ...w, cfg: { ...w.cfg, reputation: { ...w.cfg.reputation, threeParts: { ...k, enabled: false } } } } as World;
    expect(reputationExplain(off)).toBeUndefined();
  }, 120_000);

  it("the parts add up to the figure shown: a new company's 0.945 reads Experience −5% under 95%", async () => {
    expect(wholePoints([0, 0, 0.055], 100 - Math.round(0.945 * 100))).toEqual([0, 0, 5]);
    expect(wholePoints([0.021, 0.013, 0.03], 6).reduce((a, b) => a + b, 0)).toBe(6);
    expect(wholePoints([0, 0, 0], 0)).toEqual([0, 0, 0]);
    const { w, c } = await fresh();
    const points = reputationRows(w, c).map((r) => (r.value === "0" ? 0 : Number(r.value.replace("−", "").replace("%", ""))));
    expect(points.reduce((a, b) => a + b, 0)).toBe(100 - Math.round(c.reputation * 100));
  }, 120_000);
});

describe("QA's 0.25.4 replay: the lower items", () => {
  it("the deposit's room chip stops at the cash, and an amount over the cash says why DEPOSIT is grey", async () => {
    const { w, c } = await fresh();
    toCash(w, c, 9_440);
    c.weeklySpend = [10_000, 10_000, 10_000, 10_000]; // a 130,000 shelter, far over the cash
    const s = depositSheet(w, c);
    expect(s.chips[0]).toEqual({ label: FIXES.chipAllCash("9,440"), fd: 9_440 });
    expect(s.chips.some((x) => x.label === RESERVE.chipRoom("130,000"))).toBe(false);
    expect(FIXES.depositOverCash("9,440")).toBe("That's more than your cash, 9,440 FD.");
    // With the cash over the room, the room chip as before.
    toCash(w, c, 300_000);
    expect(depositSheet(w, c).chips[0]).toEqual({ label: RESERVE.chipRoom("130,000"), fd: 130_000 });
  }, 120_000);

  it("a released load's sheet line is the sentence alone; any other block keeps \"Not yet\"", () => {
    expect(blockLine(FIXES.releasedByYou)).toBe(FIXES.releasedByYou);
    expect(blockLine("no driver for this truck.")).toBe(LOAD.blocked("no driver for this truck"));
  });

  it("both release Confirms name the standing a release costs, for a load that builds it", async () => {
    const { w, c } = await fresh();
    c.standingNoticed = true;
    const l = [...w.loads.values()].find((x) => x.status === "open" && standingLoad(x))!;
    const line = FIXES.releaseStanding(w.cfg.standing.hits.release, w.net.hubs[l.origin]!.name);
    expect(line).toMatch(/^It also takes two loads off your .+ standing\.$/);
    expect(releaseCard(w, c, l, 100, 1).risk).toBe(`${WINDOWS.releaseRisk} ${line}`);
    expect(releaseCurrentCard(w, c, { load: l, priceFd: 100, town: "Columbus", sunkMi: 0, ask: null }, 100, 1).risk).toBe(`${FIXES.releaseCurrentRisk} ${line}`);
    delete c.standingNoticed; // standing not yet shown: as before
    expect(releaseCard(w, c, l, 100, 1).risk).toBe(WINDOWS.releaseRisk);
  }, 120_000);

  it("on the weekly day itself, after its check, the day named is the next one", async () => {
    const { w, c } = await fresh();
    const monday = reviewWhen(w).day;
    w.t = 14 * DAY + 30; // the review's weekday, just after it ran
    expect(nextReviewDay(w)).toBe(FIXES.nextDay(monday));
    w.t = 13 * DAY + 30; // the day before
    expect(nextReviewDay(w)).toBe(monday);
    // The Reserve's first week: put in on the check's weekday, it pays next Monday's holding cost.
    toCash(w, c, 300_000);
    c.weeklySpend = [10_000, 10_000, 10_000, 10_000];
    w.t = 14 * DAY + 30;
    expect(applyAction(w, c.id, { type: "reserve_deposit", fd: 100_000 })).toEqual({ ok: true });
    const name = weekdayName(14 * DAY, w.cfg);
    expect(reserveCard(w, c)!.waitingLine).toBe(RESERVE.firstWeekHolding("100,000", FIXES.nextDay(name)));
    w.t = 13 * DAY + 30;
    expect(dayOf(w.t, w.cfg) % 7).toBe(6);
    expect(reserveCard(w, c)!.waitingLine).toBe(RESERVE.firstWeekHolding("100,000", name));
  }, 120_000);

  it("the buy Confirm's hand-over names the town it waits in, and the miles from the truck's own town", async () => {
    const { g, w, c } = await fresh();
    S.game = g as never;
    try {
      const mine = w.trucksByCompany.get(c.id)![0]!;
      const other = w.trucks.find((t) => t.companyId !== c.id && t.status !== "retired")!;
      const town = w.net.places.findIndex((p, i) => i !== placeOfHub(p.market) && p.market !== c.homeHub);
      const hub = w.net.places[town]!.market;
      Object.assign(other, { hub, targetHub: hub, place: town, targetPlace: town });
      w.listings.push({ id: 9_999, truckId: other.id } as never);
      const line = handOverAt(w, c, { type: "buy_listing", listingId: 9_999 })!;
      expect(line).toBe(FIXES.handOverAt(w.net.places[town]!.name, Math.round(placeMiles(w, mine.place, town)), 1));
      expect(line).not.toContain(`At ${w.net.hubs[hub]!.name},`);
    } finally {
      S.game = null;
    }
  }, 120_000);
});
