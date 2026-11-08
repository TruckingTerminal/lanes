import { describe, expect, it } from "vitest";
import { economyConfig as cfg, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import {
  availableFd,
  bill,
  budgetFd,
  companyAccount,
  createWorld,
  cumulativeBudgetFd,
  dailyEmission,
  dailyReceivables,
  emissionRatio,
  EQUIPMENT,
  formCompany,
  leverFloor,
  leverSplit,
  monthlyStabilizers,
  noteEmissionCommitment,
  paceTarget,
  planFreight,
  planIndex,
  ratioOf,
  spendPerLever,
  stepLever,
  subsidyFd,
  subsidyRatio,
  type DayMetrics,
  type World,
} from "@lanes/engine";

// The emission cap, retuned (studio/reviews/economy-emission.md "Retune (2026-11-07)", emission.ts).
const k = cfg.token.emission;
const net = buildNetwork(hubs, cfg);
type Emission = EconomyConfig["token"]["emission"];
const withEmission = (over: Partial<Emission>, more: (c: EconomyConfig) => EconomyConfig = (c) => c): EconomyConfig =>
  more({ ...cfg, token: { ...cfg.token, emission: { ...cfg.token.emission, ...over } } });
const carrier = (w: World, name: string) => formCompany(w, { name, role: "carrier", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
const fakeDay = (day: number, faucetFd: number, sinkFd: number) => ({ day, season: 0, faucetFd, sinkFd } as unknown as DayMetrics);

describe("the emission cap: schedules", () => {
  it("G: the geometric schedule declines by 1 − first ÷ (cap − genesis) and sums to the cap less genesis", () => {
    expect(k.refill).toBe(0);
    expect(emissionRatio(k)).toBeCloseTo(0.94, 10); // 1 − 36M ÷ 600M
    expect(budgetFd(k, 0)).toBe(36_000_000);
    expect(budgetFd(k, 1)).toBeCloseTo(33_840_000, 4);
    expect(cumulativeBudgetFd(k, 1)).toBeCloseTo(69_840_000, 4);
    let s = 0;
    for (let m = 0; m < 3000; m++) s += budgetFd(k, m);
    expect(s).toBeCloseTo(k.capFd - k.genesisFd, -1);
    expect(cumulativeBudgetFd(k, 5000)).toBeLessThanOrEqual(k.capFd - k.genesisFd + 1);
  });

  it("R: month 0 is the opening budget; after that the trailing sinks re-emitted plus a subsidy that sums to its total", () => {
    const r: Emission = { ...k, refill: 1 };
    expect(budgetFd(r, 0, 50e6)).toBe(36_000_000); // nothing has come back yet
    expect(subsidyRatio(r)).toBeCloseTo(0.95, 10); // 1 − 3M ÷ 60M
    expect(subsidyFd(r, 1)).toBeCloseTo(2_850_000, 4);
    expect(budgetFd(r, 1, 40e6)).toBeCloseTo(42_850_000, 4); // last month's sinks + the subsidy
    expect(budgetFd({ ...r, refill: 0.5 }, 2, 40e6)).toBeCloseTo(20e6 + 3e6 * 0.95 ** 2, 4);
    let s = 0;
    for (let m = 0; m < 3000; m++) s += subsidyFd(r, m);
    expect(s).toBeCloseTo(r.subsidy.totalFd, -1);
    // refillNet: the base is the sinks less the faucets other than NPC freight pay (loans, deposits, payouts), never below 0.
    const net: Emission = { ...r, refillNet: true };
    expect(budgetFd(net, 1, 40e6, 5e6)).toBeCloseTo(35e6 + 2_850_000, 4);
    expect(budgetFd(net, 1, 40e6, 50e6)).toBeCloseTo(2_850_000, 4);
    expect(budgetFd(net, 0, 40e6, 5e6)).toBe(36_000_000);
  });
});

describe("the emission cap: the lever and the pacing", () => {
  it("volume takes the cut down to its floor before rates move; rates floor at 0.8; the product never goes under 0.4", () => {
    expect(leverFloor(k)).toBeCloseTo(0.4, 10);
    expect(leverSplit(k, 1)).toEqual({ volMult: 1, rateMult: 1 });
    expect(leverSplit(k, 0.7)).toEqual({ volMult: 0.7, rateMult: 1 });
    expect(leverSplit(k, 0.5)).toEqual({ volMult: 0.5, rateMult: 1 });
    const half = leverSplit(k, 0.45);
    expect(half.volMult).toBe(0.5);
    expect(half.rateMult).toBeCloseTo(0.9, 10);
    expect(leverSplit(k, 0.4)).toEqual({ volMult: 0.5, rateMult: 0.8 });
    expect(leverSplit(k, 0.2)).toEqual({ volMult: 0.5, rateMult: 0.8 }); // the floor, not a cliff
  });

  it("the horizon has no month-end cliff: this month's remainder plus the next month's share of the days past it", () => {
    // 3 days left, 6M of the month unspent: the 30-day horizon carries 27 days of next month's 33.84M.
    expect(availableFd(0, 36e6, 30e6, 33.84e6, 3, 30, 30)).toBeCloseTo(6e6 + (33.84e6 * 27) / 30, 4);
    // The first day of a month after an overspent one: the carry comes off, nothing of the month after is reached yet.
    expect(availableFd(-2e6, 36e6, 0, 33.84e6, 30, 30, 30)).toBeCloseTo(34e6, 4);
    // A horizon longer than a month is read as a month.
    expect(availableFd(0, 36e6, 0, 33.84e6, 30, 30, 45)).toBeCloseTo(36e6, 4);
  });

  it("the spend per unit of lever reads each day against the lever in force the delivery lag earlier", () => {
    const flat = Array.from({ length: 10 }, () => 2e6);
    expect(spendPerLever(flat, Array.from({ length: 10 }, () => 1), 7, 3)).toBeCloseTo(2e6, 4);
    // The lever went to 0.5 on day 3; the last 7 days' loads were priced by days 0–6's levers: 3 at 1, 4 at 0.5.
    const levers = [1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const daily = [3e6, 3e6, 3e6, 1e6, 1e6, 1e6, 1e6, 1e6, 1e6, 1e6];
    expect(spendPerLever(daily, levers, 7, 3)).toBeCloseTo(7e6 / 5, 4);
    expect(spendPerLever([], [], 7, 3)).toBe(0);
    expect(spendPerLever([2e6], [1], 7, 3)).toBeCloseTo(2e6, 4); // before day 3 the opening lever stands in
  });

  it("the target lands the horizon on budget, and the product moves at most five points a day inside its floor", () => {
    expect(paceTarget(36e6, 30, 2e6)).toBeCloseTo(0.6, 10);
    expect(paceTarget(36e6, 30, 0)).toBe(1); // nothing spent yet: nothing to pace
    expect(paceTarget(-1, 30, 2e6)).toBe(0); // nothing left
    expect(stepLever(1, 0.4, 0.05, 0.4)).toBeCloseTo(0.95, 10);
    expect(stepLever(0.5, 1, 0.05, 0.4)).toBeCloseTo(0.55, 10);
    expect(stepLever(0.42, 0, 0.05, 0.4)).toBeCloseTo(0.4, 10);
    expect(stepLever(0.98, 1.5, 0.05, 0.4)).toBe(1);
  });
});

describe("the emission cap in the world", () => {
  const payCfg = (over: Partial<Emission>) => withEmission(over, (c) => ({ ...c, token: { ...c.token, payment: { ...c.token.payment, enabled: true } } }));

  it("draws the budget at the invoice on every route (the lessor, net paper) and counts the cash as it lands; a player payer and the NPC market draw nothing", () => {
    const w = createWorld({ cfg: payCfg({}), net, feeds: neutralFeeds, seed: 3 });
    const a = carrier(w, "Leased");
    const b = carrier(w, "Net terms");
    const broker = formCompany(w, { name: "Broker", role: "broker", homeHubId: "DAL", strategy: "test", orders: [], freePath: false });
    // The lessor's route: paid on delivery out of faucet:npc_lessor, committed and paid at once.
    const before = w.ledger.balance(companyAccount(a.id)); // the starting grant, less what forming the company cost
    bill(w, { payer: 0, faucet: "faucet:npc_shipper", payee: a, amountFd: 1000, ref: "t:1", leased: true });
    expect(w.emission.committedFd).toBe(1000);
    expect(w.ledger.npcPaidFd()).toBe(1000);
    expect(w.ledger.balance(companyAccount(a.id)) - before).toBe(1000);
    // Net paper: committed now, cash at the due day.
    bill(w, { payer: 0, faucet: "faucet:npc_shipper", payee: b, amountFd: 500, ref: "t:2", npcKind: "contract" });
    expect(w.emission.committedFd).toBe(1500);
    expect(w.emission.pay.contract).toEqual({ loads: 1, fd: 500 });
    expect(w.emission.pay.spot).toEqual({ loads: 1, fd: 1000 });
    expect(w.ledger.npcPaidFd()).toBe(1000);
    w.t += w.cfg.token.payment.termsDays * w.cfg.time.gameMinutesPerDay;
    dailyReceivables(w);
    expect(w.ledger.npcPaidFd()).toBe(1500);
    expect(w.emission.committedFd).toBe(1500); // the cash landing draws nothing again
    // A broker paying its carrier is a transfer; the NPC market buying a facility's goods is outside the budget (for now).
    bill(w, { payer: broker.id, payee: a, amountFd: 700, ref: "t:3" });
    bill(w, { payer: 0, faucet: "faucet:npc_market", payee: a, amountFd: 900, ref: "t:4" });
    expect(w.emission.committedFd).toBe(1500);
    expect(w.ledger.npcPaidFd()).toBe(1500);
    // The lessor advancing a broker's paper to a leased truck: an NPC advance (faucet:npc_advance), not NPC freight pay —
    // the budget and the cash column leave it out — and the broker repays it into sink:npc_factor at the due day.
    bill(w, { payer: broker.id, payee: a, amountFd: 600, ref: "t:5", leased: true });
    expect(w.ledger.totals.get("faucet:npc_advance")).toBe(60_000);
    expect(w.ledger.totals.get("faucet:npc_lessor")).toBe(100_000);
    expect(w.emission.committedFd).toBe(1500);
    expect(w.ledger.npcPaidFd()).toBe(1500);
    w.t += w.cfg.token.payment.termsDays * w.cfg.time.gameMinutesPerDay;
    dailyReceivables(w);
    expect(w.ledger.totals.get("sink:npc_factor")).toBe(60_000);
    expect(w.ledger.npcPaidFd()).toBe(1500);
    // With the cap off the count runs but the levers don't move.
    expect(w.stab.emissionVolMult).toBe(1);
    expect(w.stab.emissionMult).toBe(1);
  });

  it("the volume lever scales what NPC shippers are asked to post, per hub, and the hubs' record follows", () => {
    const w = createWorld({ cfg: withEmission({ enabled: true }), net, feeds: neutralFeeds, seed: 2 });
    w.stab.emissionVolMult = 1; // the cap opens at pacing.warmStart; this test reads the lever alone
    const full = planFreight(w, 0).npcExpected;
    w.stab.emissionVolMult = 0.5;
    const cut = planFreight(w, 0).npcExpected;
    expect(full.length).toBe(net.hubs.length * EQUIPMENT.length);
    let total = 0;
    for (let i = 0; i < full.length; i++) {
      expect(cut[i]).toBeCloseTo(full[i]! * 0.5, 9);
      total += full[i]!;
    }
    expect(total).toBeGreaterThan(0);
    let hub0 = 0;
    for (let e = 0; e < EQUIPMENT.length; e++) hub0 += full[planIndex(0, e)]!;
    expect(w.emission.hubExpectedToday[0]).toBeCloseTo(hub0 * 1.5, 9); // both rounds' plans, summed for the day
  });

  it("opens where pacing.warmStart says, with the cap on only, and holds for the delivery lag plus a few days, not the window", () => {
    const warm = { ...k.pacing, warmStart: 0.6 };
    expect(warm.lagDays + warm.holdAfterLagDays).toBe(7);
    expect(warm.windowDays).toBe(14); // a hold tied to the window would last twice as long
    const on = createWorld({ cfg: withEmission({ enabled: true, pacing: warm }), net, feeds: neutralFeeds, seed: 1 });
    expect(on.emission.product).toBe(0.6);
    expect(on.stab.emissionVolMult).toBe(0.6);
    expect(on.stab.emissionMult).toBe(1);
    // Nothing delivered yet: the opening holds until the window holds lag + 2 = 7 closed days, then the product may rise by a step.
    for (let day = 0; day < 6; day++) {
      dailyEmission(on, day);
      expect(on.emission.product).toBe(0.6);
    }
    dailyEmission(on, 6);
    expect(on.emission.product).toBeCloseTo(0.6 + warm.stepPerDay, 10);
    const off = createWorld({ cfg: withEmission({ enabled: false, pacing: warm }), net, feeds: neutralFeeds, seed: 1 });
    expect(off.stab.emissionVolMult).toBe(1);
    expect(off.emission.product).toBe(1);
  });

  it("day by day: over pace the product walks down five points a day to the floor and the month closes overspent; under pace it stays at 1", () => {
    // The first pacing (7 / 0.05 / 3, opening at 1), so the arithmetic below reads in whole steps.
    const first = { horizonDays: 30, windowDays: 7, lagDays: 3, stepPerDay: 0.05, warmStart: 1, holdAfterLagDays: 2 };
    const w = createWorld({ cfg: withEmission({ enabled: true, pacing: first }), net, feeds: neutralFeeds, seed: 1 });
    // 3M a day committed against a 36M month (1.2M a day).
    for (let day = 0; day < 30; day++) {
      noteEmissionCommitment(w, 3e6, "spot");
      dailyEmission(w, day);
      if (day === 0) {
        expect(w.emission.product).toBeCloseTo(0.95, 10);
        expect(w.stab.emissionVolMult).toBeCloseTo(0.95, 10);
        expect(w.stab.emissionMult).toBe(1);
      }
      if (day === 9) expect(w.emission.product).toBeCloseTo(0.5, 10); // volume at its floor, rates still whole
      if (day === 9) expect(w.stab.emissionMult).toBe(1);
      if (day === 11) {
        expect(w.emission.product).toBeCloseTo(0.4, 10);
        expect(w.stab.emissionVolMult).toBe(0.5);
        expect(w.stab.emissionMult).toBeCloseTo(0.8, 10);
      }
    }
    expect(w.emission.months).toHaveLength(1);
    expect(w.emission.months[0]).toMatchObject({ month: 0, budgetFd: 36e6, committedFd: 90e6, paidFd: 0, subsidyFd: 0 });
    expect(w.emission.months[0]!.carryFd).toBeCloseTo(-54e6, 4);
    expect(w.emission.month).toBe(1);
    expect(w.emission.monthBudgetFd).toBeCloseTo(33.84e6, 4);
    expect(w.emission.committedMonthFd).toBe(0);
    expect(w.emission.daysAtRateFloor).toBeGreaterThan(0);

    const easy = createWorld({ cfg: withEmission({ enabled: true, pacing: first }), net, feeds: neutralFeeds, seed: 1 });
    for (let day = 0; day < 10; day++) {
      noteEmissionCommitment(easy, 1e6, "spot");
      dailyEmission(easy, day);
    }
    expect(easy.emission.product).toBe(1);
    expect(easy.stab.emissionVolMult).toBe(1);

    // Off: the count and the months still close, the levers never move.
    const off = createWorld({ cfg: withEmission({ enabled: false, pacing: first }), net, feeds: neutralFeeds, seed: 1 });
    for (let day = 0; day < 30; day++) {
      noteEmissionCommitment(off, 3e6, "spot");
      dailyEmission(off, day);
    }
    expect(off.emission.months[0]).toMatchObject({ month: 0, committedFd: 90e6 });
    expect(off.stab.emissionVolMult).toBe(1);
    expect(off.stab.emissionMult).toBe(1);
  });

  it("R in the world: the second month's budget is the first month's sinks re-emitted plus the subsidy", () => {
    const w = createWorld({ cfg: withEmission({ enabled: true, refill: 1 }), net, feeds: neutralFeeds, seed: 1 });
    for (let day = 0; day < 30; day++) {
      w.metrics.days.push(fakeDay(day, 2e6, 1.5e6)); // 45M of sinks over the month
      noteEmissionCommitment(w, 1.2e6, "spot");
      dailyEmission(w, day);
    }
    expect(w.emission.month).toBe(1);
    expect(w.emission.monthBudgetFd).toBeCloseTo(45e6 + 2.85e6, 4);
    expect(w.emission.months[0]!.budgetFd).toBe(36e6);
    expect(w.emission.subsidyFd).toBeCloseTo(2.85e6, 4);
  });

  it("the cap wins: while it is on the volume dial holds and the balance dial holds (or, one-way, may only lower rates); off, both move", () => {
    const dials = (enabled: boolean, dialOneWay = false, volumeDialOneWay = false) =>
      withEmission({ enabled, dialOneWay, volumeDialOneWay }, (c) => ({
        ...c,
        token: { ...c.token, circular: { ...c.token.circular, enabled: true, volumeStabilizer: true, rateStabilizer: { ...c.token.circular.rateStabilizer, enabled: true } } },
      }));
    const month = (w: World, sinkFd: number) => {
      for (let day = 0; day < 30; day++) w.metrics.days.push(fakeDay(day, 100, sinkFd)); // 50: far under any target; 150: far over
      monthlyStabilizers(w);
    };
    const on = createWorld({ cfg: dials(true), net, feeds: neutralFeeds, seed: 1 });
    month(on, 50);
    expect(on.stab.rateMult).toBe(1);
    expect(on.stab.volumeMult).toBe(1);
    const off = createWorld({ cfg: dials(false), net, feeds: neutralFeeds, seed: 1 });
    month(off, 50);
    expect(off.stab.rateMult).toBeLessThan(1);
    expect(off.stab.volumeMult).toBeLessThan(1);
    const offOver = createWorld({ cfg: dials(false), net, feeds: neutralFeeds, seed: 1 });
    month(offOver, 150);
    expect(offOver.stab.rateMult).toBeGreaterThan(1); // off, the dial raises rates when sinks outrun faucets
    // One-way under the cap: the balance dial may still lower rates when sinks fall short and never raise them when they run over; the volume dial holds unless its own switch is on.
    const oneWayUnder = createWorld({ cfg: dials(true, true), net, feeds: neutralFeeds, seed: 1 });
    month(oneWayUnder, 50);
    expect(oneWayUnder.stab.rateMult).toBeLessThan(1);
    expect(oneWayUnder.stab.volumeMult).toBe(1);
    const oneWayOver = createWorld({ cfg: dials(true, true), net, feeds: neutralFeeds, seed: 1 });
    month(oneWayOver, 150);
    expect(oneWayOver.stab.rateMult).toBe(1);
    expect(oneWayOver.stab.volumeMult).toBe(1);
    expect(offOver.stab.volumeMult).toBeGreaterThan(1); // off, the volume dial adds freight when sinks outrun faucets
    // The volume dial's own switch (tried and rejected, §14): it may cut when sinks fall short, never add when they run over.
    const volUnder = createWorld({ cfg: dials(true, true, true), net, feeds: neutralFeeds, seed: 1 });
    month(volUnder, 50);
    expect(volUnder.stab.volumeMult).toBeLessThan(1);
    const volOver = createWorld({ cfg: dials(true, true, true), net, feeds: neutralFeeds, seed: 1 });
    month(volOver, 150);
    expect(volOver.stab.volumeMult).toBe(1);
  });

  it("the ratio's accounting: the NPC advance-and-repayment wash comes out of both sides of the corrected ratio, the raw one keeps it", () => {
    const d = (faucetFd: number, sinkFd: number, advance: number, repaid: number) => ({ faucetFd, sinkFd, faucetByTag: { npc_shipper: faucetFd - advance, npc_advance: advance }, sinkByTag: { fuel: sinkFd - repaid, npc_factor: repaid } }) as unknown as DayMetrics;
    const r = ratioOf([d(100, 90, 20, 20), d(100, 90, 20, 20)]);
    expect(r.raw).toBeCloseTo(0.9, 10);
    expect(r.corrected).toBeCloseTo(70 / 80, 10);
    expect(r.advanceFd).toBe(40);
    expect(r.repaidFd).toBe(40);
    expect(ratioOf([]).raw).toBe(0);
  });
});
