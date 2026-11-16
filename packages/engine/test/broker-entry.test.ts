import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import {
  brokerEntrySignal,
  brokerLicensed,
  companyAccount,
  createWorld,
  dayOf,
  dueEntrants,
  formCompany,
  newEntrant,
  noteBrokerTender,
  openEntrant,
  processLiquidations,
  renewalReport,
  startLiquidation,
  stakeFd,
  stepHour,
  trailingOtherFaucetsPerMonthFd,
  weeklyBrokerEntry,
  yieldEntrant,
  type Company,
  type World,
} from "@lanes/engine";

/**
 * The market's renewal (Jeff, 2026-11-15: "for now"; the director's §3 and §16): AI broker entry by conditions
 * (brokerRisk.entry; the economy's sizes, economy-broker-entry-2026-11-15.md) and a failed NPC fleet wound up instead of
 * restarted (insolvency.windUpNpcFleets). Both off by default and not in the live levers.
 */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const DAY = LIVE.time.gameMinutesPerDay;
/** Entry on, with short windows for the tests: the reference over the rule's weeks 1–2, flow over 1 week, margin over 2. */
const ENTRY: EconomyConfig = {
  ...LIVE,
  brokerRisk: { ...LIVE.brokerRisk, windUpDormant: true, entry: { ...LIVE.brokerRisk.entry, enabled: true, refFromWeek: 1, refToWeek: 2, flowWeeks: 1, marginWeeks: 2, lagDays: 14 } },
};
const FLEETS = (on: boolean): EconomyConfig => ({ ...LIVE, insolvency: { ...LIVE.insolvency, windUpNpcFleets: on } });

/** Four AI brokers and nothing else: the trading layer is four, and nothing moves unless a test moves it. */
function brokers(cfg: EconomyConfig = ENTRY): { w: World; ai: Company[] } {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 7, keepLedgerEntries: true });
  populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
  const ai = w.companies.filter((c) => c.role === "broker");
  expect(ai.every((c) => brokerLicensed(w, c))).toBe(true);
  return { w, ai };
}
/** A week: `tenders` NPC tenders offered, the AI brokers' revenue and costs moved, then the weekly check. */
function week(w: World, ai: Company[], tenders: number, revenueFd = 1_000, costFd = 900): void {
  for (let i = 0; i < tenders; i++) noteBrokerTender(w);
  ai[0]!.operating.revenueFd += revenueFd;
  ai[0]!.operating.costFd += costFd;
  weeklyBrokerEntry(w);
}
/** A player's brokerage, staked and trading. */
function playerBrokerage(w: World): Company {
  const c = formCompany(w, { name: "Player Brokerage", role: "broker", homeHubId: "DAL", strategy: "player:broker", orders: [], freePath: false, human: true });
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 80_000, "test");
  expect(stakeFd(w, c, w.cfg.token.staking.roles.broker)).toBeNull();
  return c;
}
const spec = (name: string) => ({ name, homeHubId: "DAL", strategy: "broker:greedy", orders: [{ kind: "broker" as const, marginPct: 0.12, maxOpenLoads: 40 }], vetting: 1 as const });

describe("AI broker entry by conditions (brokerRisk.entry)", () => {
  it("is off by default and in the live levers, and the fleets' wind-up too", () => {
    expect(LIVE.brokerRisk.entry.enabled).toBe(false);
    expect(LIVE.insolvency.windUpNpcFleets).toBe(false);
    expect([LIVE.brokerRisk.entry.flowRatio, LIVE.brokerRisk.entry.marginMin, LIVE.brokerRisk.entry.lagDays, LIVE.brokerRisk.entry.maxPerWeek]).toEqual([1.5, 0.05, 120, 1]);
  });

  it("founds one when the flow per trading broker runs over 1.5× the reference and the margin over 5%; the founded-but-not-open count as trading", () => {
    const { w, ai } = brokers();
    week(w, ai, 40);
    week(w, ai, 40);
    // The reference: 80 tenders over the rule's weeks 1–2, per week, per trading broker (four).
    expect(w.brokerEntry!.ref).toBeCloseTo(10, 9);
    expect(w.brokerEntry!.entrants).toEqual([]);
    // Week 3: 70 tenders over four brokers is 17.5 a broker, 1.75× the reference; the margin 10%: one founded.
    week(w, ai, 70);
    expect(w.brokerEntry!.last).toMatchObject({ trading: 4, pending: 0, margin: 0.1 });
    expect(w.brokerEntry!.last!.flowRatio).toBeCloseTo(1.75, 9);
    const today = dayOf(w.t, w.cfg);
    expect(w.brokerEntry!.entrants).toEqual([{ founded: today, opens: today + 14 }]);
    // Week 4: the same 70 over four brokers and the one waiting to open is 14 a broker, 1.4×: none.
    week(w, ai, 70);
    expect(w.brokerEntry!.last).toMatchObject({ trading: 4, pending: 1 });
    expect(w.brokerEntry!.last!.flowRatio).toBeCloseTo(1.4, 9);
    expect(w.brokerEntry!.entrants).toHaveLength(1);
    // Week 5: 800 over five is 16×: one more, and only one (maxPerWeek), however far over.
    week(w, ai, 800);
    expect(w.brokerEntry!.entrants).toHaveLength(2);
    expect(brokerEntrySignal(w)).toMatchObject({ ref: w.brokerEntry!.ref, flowLine: 1.5, marginLine: 0.05, pending: 1 });
  });

  it("founds none with the margin at 5% or under, or where a player's brokerage brings the flow per broker under the line", () => {
    // 1.75× the flow, the margin over weeks 2–3 at 5% exactly (not over it), then at a loss: none.
    const thin = brokers();
    week(thin.w, thin.ai, 40, 1_000, 950);
    week(thin.w, thin.ai, 40, 1_000, 950);
    week(thin.w, thin.ai, 70, 1_000, 950);
    expect(thin.w.brokerEntry!.last!.flowRatio).toBeCloseTo(1.75, 9);
    expect(thin.w.brokerEntry!.last!.margin).toBe(0.05);
    week(thin.w, thin.ai, 70, 1_000, 1_200);
    expect(thin.w.brokerEntry!.last!.margin).toBeCloseTo(-0.075, 9);
    expect(thin.w.brokerEntry!.entrants).toEqual([]);

    const players = brokers();
    week(players.w, players.ai, 40);
    week(players.w, players.ai, 40);
    playerBrokerage(players.w);
    week(players.w, players.ai, 70); // 70 over five trading brokers, the player's among them: 1.4×
    expect(players.w.brokerEntry!.last).toMatchObject({ trading: 5, pending: 0 });
    expect(players.w.brokerEntry!.entrants).toEqual([]);
  });

  it("an entrant opens with the opening's kit, its capital drawn on the cap's budget under faucet:broker_entry", () => {
    const { w } = brokers();
    noteBrokerTender(w); // the rule's state begins
    w.brokerEntry!.entrants.push({ founded: 0, opens: 0 });
    const grants = w.ledger.totals.get("faucet:starting_grant") ?? 0;
    const committed = w.emission.committedMonthFd;
    const today = dayOf(w.t, w.cfg);
    const c = openEntrant(w, w.brokerEntry!.entrants[0]!, spec("Entrant Freight Brokers"));
    const capital = w.cfg.company.startingGrantFd + w.cfg.token.staking.roles.broker; // 5,000 + 75,000
    expect(capital).toBe(80_000);
    expect(w.ledger.totals.get("faucet:broker_entry")).toBe(capital * 100); // cents
    expect(w.ledger.totals.get("faucet:starting_grant") ?? 0).toBe(grants); // the schedule's grants untouched
    expect(w.emission.committedMonthFd - committed).toBeCloseTo(capital, 6);
    expect(w.emission.brokerEntryFd).toBeCloseTo(capital, 6);
    expect(w.brokerEntry!.capitalFd).toBeCloseTo(capital, 6);
    // New authority, no payment history, licensed, its vetting as drawn; the entry log has it.
    expect(c.authority.since).toBe(today);
    expect(c.credit).toEqual({ onTimeFd: 0, lateFd: 0 });
    expect(c.stakedFd).toBe(75_000);
    expect(brokerLicensed(w, c)).toBe(true);
    expect(c.vetting).toBe(1);
    expect(c.entrant).toEqual({ foundedDay: 0 });
    expect(w.brokerEntry!.entrants[0]).toMatchObject({ companyId: c.id, opened: today });
    // New, for newLabelDays.
    expect(newEntrant(w, c)).toBe(true);
    w.t += w.cfg.brokerRisk.entry.newLabelDays * DAY;
    expect(newEntrant(w, c)).toBe(false);
    expect(newEntrant(w, w.companies[0]!)).toBe(false); // an opening broker never is
    w.ledger.assertBalanced();
  });

  it("the refill's other faucets leave the entry draw out: it's on the budget already", () => {
    const day = { faucetFd: 100, faucetByTag: { npc_shipper: 60, broker_entry: 30, loan: 10 } };
    const fake = { metrics: { days: [day] }, cfg: { time: { daysPerMonth: 30 } } } as unknown as World;
    expect(trailingOtherFaucetsPerMonthFd(fake, 90)).toBeCloseTo(10 * 30, 9);
  });

  it("the bots open a founded brokerage when it's due, a persona and a new name drawn as the opening's", () => {
    const { w } = brokers();
    noteBrokerTender(w);
    w.brokerEntry!.entrants.push({ founded: 0, opens: 2 });
    const names = new Set(w.companies.map((c) => c.name));
    while (dayOf(w.t, w.cfg) < 2) stepHour(w, ruleBotHook);
    for (let h = 0; h < 24 && w.brokerEntry!.entrants[0]!.companyId === undefined; h++) stepHour(w, ruleBotHook);
    const e = w.brokerEntry!.entrants[0]!;
    expect(e.companyId).toBeDefined();
    const c = w.companies[e.companyId! - 1]!;
    expect(c.role).toBe("broker");
    expect(c.strategy).toMatch(/^broker:(greedy|conservative|random)$/);
    expect(c.orders.find((o) => o.kind === "broker")).toBeDefined();
    expect(names.has(c.name)).toBe(false);
    expect(c.authority.since).toBe(e.opened);
    expect(dueEntrants(w)).toEqual([]);
    w.ledger.assertBalanced();
  }, 120_000);

  it("the director's seam: yieldEntrant withdraws the newest brokerage not yet open, and it never opens", () => {
    const { w } = brokers();
    noteBrokerTender(w);
    w.brokerEntry!.entrants.push({ founded: 0, opens: 0 }, { founded: 7, opens: 0 });
    expect(yieldEntrant(w)).toBe(true);
    expect(w.brokerEntry!.entrants[1]!.withdrawn).toBe(dayOf(w.t, w.cfg));
    expect(dueEntrants(w)).toEqual([w.brokerEntry!.entrants[0]]);
    expect(yieldEntrant(w)).toBe(true);
    expect(yieldEntrant(w)).toBe(false);
    expect(renewalReport(w)!.entrants).toEqual({ founded: 2, opened: 0, withdrawn: 2, yielded: 0, failedAgain: 0 });
  });

  it("off: no state, no tender counted, nothing opens, and a three-week world is byte-identical with the keys false and absent", () => {
    const run = (cfg: EconomyConfig) => {
      const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 20_261_115 });
      populate(w, { freeOwnerOperators: 12, fleets: 3, brokers: 3 });
      for (let h = 0; h < 21 * 24; h++) stepHour(w, ruleBotHook);
      expect(w.brokerEntry).toBeUndefined();
      expect(w.fleetsWoundUp).toBeUndefined();
      expect(w.ledger.totals.get("faucet:broker_entry")).toBeUndefined();
      expect(w.emission.brokerEntryFd).toBeUndefined();
      expect(renewalReport(w)).toBeUndefined();
      const s = JSON.stringify({ t: w.t, next: w.nextLoadId, supply: w.ledger.supply(), books: w.companies.map((c) => [c.id, w.ledger.balance(companyAccount(c.id)), c.delivered, c.onTime, c.operating]), days: w.metrics.days, loads: [...w.loads.values()], trucks: w.trucks, emission: { ...w.emission, hubExpectedToday: [...w.emission.hubExpectedToday] } });
      return createHash("sha256").update(s).digest("hex");
    };
    const { entry: _e, ...brokerRisk } = LIVE.brokerRisk;
    const { windUpNpcFleets: _f, ...insolvency } = LIVE.insolvency;
    const absent = { ...LIVE, brokerRisk, insolvency } as unknown as EconomyConfig;
    expect(run(absent)).toBe(run(LIVE));
  }, 240_000);
});

describe("a failed NPC fleet is wound up, not restarted (insolvency.windUpNpcFleets, the director's §16)", () => {
  /** A company whose liquidation is done: its only truck the free path's NPC lease, the sit-out passed. */
  function failed(cfg: EconomyConfig, strategy: string, human = false): { w: World; c: Company } {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 9, keepLedgerEntries: true });
    const c = formCompany(w, { name: `Failed ${strategy}`, role: "carrier", homeHubId: "DAL", strategy, orders: [], freePath: true, human });
    startLiquidation(w, c);
    expect(c.bankruptcies).toBe(1);
    w.t += (cfg.insolvency.restartAfterDays + 1) * DAY;
    return { w, c };
  }

  it("on: wound up once its liquidation is done, counted once, never restarted", () => {
    const { w, c } = failed(FLEETS(true), "fleet:greedy");
    processLiquidations(w);
    expect(c.retiredDay).toBe(dayOf(w.t, w.cfg));
    expect(w.fleetsWoundUp).toEqual([{ day: c.retiredDay, companyId: c.id }]);
    expect(c.bankruptcies).toBe(1); // the bankruptcy was counted when the liquidation began
    expect(w.population?.retired ?? 0).toBe(0); // not the dial's count
    for (let i = 0; i < 3; i++) processLiquidations(w);
    expect(w.fleetsWoundUp).toHaveLength(1);
    expect(c.liquidatingSince).not.toBeNull(); // held, as the dial's retired bots are: no restart
    expect(renewalReport(w)!.byYear[0]!.fleetsWoundUp).toBe(1);
    w.ledger.assertBalanced();
  });

  it("on: an owner-operator bot and a player's company restart on the free path as before; off, the fleet does too", () => {
    for (const [cfg, strategy, human] of [
      [FLEETS(true), "greedy", false],
      [FLEETS(true), "fleet:greedy", true],
      [FLEETS(false), "fleet:greedy", false],
    ] as const) {
      const { w, c } = failed(cfg, strategy, human);
      processLiquidations(w);
      expect(c.retiredDay).toBeUndefined();
      expect(c.liquidatingSince).toBeNull();
      expect(w.fleetsWoundUp).toBeUndefined();
    }
  });
});
