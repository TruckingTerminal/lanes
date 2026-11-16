import "./seed.js";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { companyAccount, dayOf, formationCostFd, noteBrokerTender, type EconMonth, type World } from "@lanes/engine";
import { brokerageCostFd, brokeragePathLine, brokerMarketIuliia, brokerMarketLine, brokerOpening, reportBrokersLine } from "../src/brokersignal.js";
import { FIXES } from "../src/copy-fixes.js";
import { fdFull, shortDate } from "../src/format.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";

/**
 * The director's players-first ruling on the page (director-broker-players-2026-11-15.md; brokerRisk.entry.playersFirst):
 * §2, the brokers' market on the brokerage screen and in the monthly report, and What now?'s opportunity; §3, the path.
 */
const on = (p: Partial<{ yields: boolean; signal: boolean; hint: boolean; path: boolean }>) => ({
  ...GAME_CONFIG,
  brokerRisk: { ...GAME_CONFIG.brokerRisk, entry: { ...GAME_CONFIG.brokerRisk.entry, enabled: true, playersFirst: { ...GAME_CONFIG.brokerRisk.entry.playersFirst, ...p } } },
});
const toCash = (w: World, id: number, fd: number) => {
  const have = w.ledger.balance(companyAccount(id));
  if (have < fd) w.ledger.post(w.t, "faucet:starting_grant", companyAccount(id), fd - have, "test");
  else if (have > fd) w.ledger.post(w.t, companyAccount(id), "sink:test", have - fd, "test");
};
/** Entry's reading set by hand: the flow over the reference and the margin, with `pending` brokerages founded. */
function reading(w: World, flowRatio: number, margin: number, pending: number[]) {
  noteBrokerTender(w);
  const day = dayOf(w.t, w.cfg);
  w.brokerEntry!.ref = 10;
  w.brokerEntry!.last = { day, flowRatio, margin, trading: 40, pending: pending.length };
  w.brokerEntry!.entrants = pending.map((opens) => ({ founded: day, opens }));
}

describe("players first on the page", () => {
  it("§2: the brokerage screen's line over the lines and under them, Iuliia's under it; off, none", async () => {
    const g = await TestGame.create(undefined, undefined, 41, on({ signal: true }));
    const w = g.w;
    expect(brokerMarketLine(w)).toBeNull(); // no reading yet
    const day = dayOf(w.t, w.cfg);
    reading(w, 1.7, 0.07, [day + 100, day + 120]);
    expect(brokerMarketLine(w)).toBe(FIXES.brokersMarketOpen("1.7×", "7%", 2, shortDate(day + 120)));
    expect(brokerMarketLine(w)).toBe(`Brokers' market: freight per broker 1.7× the opening's, margins 7%. Two new brokerages are being set up, opening by ${shortDate(day + 120)}.`);
    expect(brokerMarketIuliia(w)).toBe(FIXES.iuliiaNewBrokerage);
    reading(w, 1.1, 0.03, []);
    expect(brokerMarketLine(w)).toBe("Brokers' market: freight per broker 1.1× the opening's, margins 3%: crowded.");
    const off = await TestGame.create(undefined, undefined, 41, on({ signal: false }));
    reading(off.w, 1.7, 0.07, []);
    expect(brokerMarketLine(off.w)).toBeNull();
    expect(brokerMarketIuliia(off.w)).toBeNull();
  }, 120_000);

  it("§3: the path while the carrier can't afford a brokerage, with the engine's cost; none once it can, or off", async () => {
    const g = await TestGame.create(undefined, undefined, 41, on({ path: true }));
    const c = g.join("Path Freight", "oo", "CMH")!;
    const w = g.w;
    const cost = brokerageCostFd(w);
    expect(cost).toBeCloseTo(formationCostFd(w), 6);
    toCash(w, c.id, 41_000);
    expect(brokeragePathLine(w, c)).toBe(FIXES.brokeragePath(fdFull(cost), fdFull(w.cfg.token.staking.roles.broker), "3%", fdFull(41_000)));
    toCash(w, c.id, cost + 1);
    expect(brokeragePathLine(w, c)).toBeNull();
    const off = await TestGame.create(undefined, undefined, 41, on({ path: false }));
    const c2 = off.join("Path Freight", "oo", "CMH")!;
    toCash(off.w, c2.id, 41_000);
    expect(brokeragePathLine(off.w, c2)).toBeNull();
  }, 120_000);

  it("§2's hint: offered with the signal over, the layer open, the carrier able to form and keep its working cash; else not", async () => {
    const g = await TestGame.create(undefined, undefined, 41, on({ hint: true }));
    const c = g.join("Hint Freight", "oo", "CMH")!;
    const w = g.w;
    if (w.ladder) w.ladder.brokerage = dayOf(w.t, w.cfg);
    reading(w, 1.7, 0.07, []);
    toCash(w, c.id, 300_000);
    expect(brokerOpening(w, c)).toEqual({ costFd: brokerageCostFd(w) });
    toCash(w, c.id, brokerageCostFd(w) + 100); // it would leave the carrier under its working cash
    expect(brokerOpening(w, c)).toBeNull();
    toCash(w, c.id, 300_000);
    reading(w, 1.4, 0.07, []); // under the flow's line
    expect(brokerOpening(w, c)).toBeNull();
    reading(w, 1.7, 0.07, []);
    if (w.ladder) w.ladder.brokerage = null; // the layer closed
    expect(brokerOpening(w, c)).toBeNull();
    const off = await TestGame.create(undefined, undefined, 41, on({ hint: false, signal: true }));
    const c2 = off.join("Hint Freight", "oo", "CMH")!;
    if (off.w.ledger) toCash(off.w, c2.id, 300_000);
    reading(off.w, 1.7, 0.07, []);
    expect(brokerOpening(off.w, c2)).toBeNull();
    // What now? takes it at the lowest tier, once: See how marks it seen.
    const src = readFileSync(join(__dirname, "..", "src", "nextstep.ts"), "utf8");
    expect(src).toContain('const opening = hintsSeen.has("brokerOpening") ? null : brokerOpening(w, c);');
    const words = readFileSync(join(__dirname, "..", "src", "ui", "WhatNow.tsx"), "utf8");
    expect(words).toContain('S.hintsSeen.add("brokerOpening");');
  }, 120_000);

  it("§2: the monthly report's line in the trade paper's voice, players' brokerages counted apart", async () => {
    const g = await TestGame.create(undefined, undefined, 41, on({ signal: true }));
    const rec = { renewal: { founded: 0, opened: 1, brokersWoundUp: 0, fleetsWoundUp: 0, carrierOwnedOpened: 3, carrierOwnedStopped: 0, reading: { flowRatio: 1.7, margin: 0.07, over: true, pending: 1 } } } as unknown as EconMonth;
    expect(reportBrokersLine(g.w, rec)).toBe("Shippers have more freight than brokers to move it: freight per broker is up 70% on the opening, and margins hold at 7%. Four brokerages opened this month, three of them players'.");
    const crowded = { renewal: { ...rec.renewal!, opened: 0, carrierOwnedOpened: 0, reading: { flowRatio: 1.1, margin: 0.03, over: false, pending: 0 } } } as EconMonth;
    expect(reportBrokersLine(g.w, crowded)).toBe(`${FIXES.reportBrokersCrowded("1.1×", "3%")} No brokerage opened this month.`);
    const off = await TestGame.create(undefined, undefined, 41, on({ signal: false }));
    expect(reportBrokersLine(off.w, rec)).toBeNull();
  }, 120_000);
});
