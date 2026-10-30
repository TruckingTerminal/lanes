import type { EconomyConfig } from "@lanes/config";
import { type GuidePage, h, n, p, pct, see, table, ul } from "./util.js";

const S = "Money";

export function moneyPages(cfg: EconomyConfig): GuidePage[] {
  const ins = cfg.insurance;
  const t = cfg.token;
  const m = cfg.miles;
  return [
    {
      id: "fd",
      section: S,
      title: "Where FD comes from and goes",
      html:
        p(`Freight Dollars (FD) are the game's money. Every FD movement is double-entry: it comes from somewhere and goes somewhere.`) +
        ul([
          `<b>In:</b> NPC shippers paying for freight, the NPC market buying facility goods, starting grants, and (after launch) FD bought with dollars.`,
          `<b>Out (burned):</b> fuel, wages, maintenance and repairs, insurance, yard rent, overhead, dispatcher pay, lease shares, the dealer, fines and judgments, board fees, the holding cost, the profit tax after launch.`,
          `<b>Between companies:</b> brokers and shippers paying carriers, used-truck sales, loans and deposits.`,
        ]) +
        p(`The Company tab's market report shows the freight cycle and rates; stabilizers keep what's burned close to what's created (${see("cycle", "Booms, busts and stabilizers")}).`),
    },
    {
      id: "insurance",
      section: S,
      title: "Insurance",
      html:
        p(`Every company holds a one-game-year policy, priced when it's signed and fixed for the term, billed weekly for each truck on the road. It renews at the then-current price.`) +
        p(`<b>Price per truck per year</b> = ${n(ins.baseAnnualPerTruck)} FD × your record × your home hub's garaging factor × the insurance market.`) +
        table(
          ["Your record", "Factor"],
          [
            ["New authority (not yet rated)", `×${ins.rating.none}`],
            ["Satisfactory", `×${ins.rating.satisfactory}`],
            ["Conditional", `×${ins.rating.conditional}`],
            ["Unsatisfactory", `×${ins.rating.unsatisfactory}`],
            ["Each safety alert", `+${pct(ins.perAlert)}`],
            ["At-fault crashes", `+${pct(cfg.safety.crash.surcharge.pdo)} (property), +${pct(cfg.safety.crash.surcharge.injury)} (injury), +${pct(cfg.safety.crash.surcharge.fatal)} (fatal), wearing off ${pct(cfg.safety.crash.surchargeDecayPerMonth)} a month`],
            [`Satisfactory, no crashes or alerts, ${ins.cleanYears}+ years`, `×${ins.cleanDiscount}`],
          ],
        ) +
        ul([
          `The record factor stays within ×${ins.clamp[0]}–${ins.clamp[1]}.`,
          `<b>Garaging:</b> where you're based. Florida, Louisiana, New Jersey, Texas, Georgia and California cost more; the upper Midwest and Mountain West less (${see("home", "Choosing a home hub")}).`,
          `<b>The market:</b> when insurers pay out more than ${pct(ins.market.targetLossRatio)} of what they take in over a year, the market hardens ${pct(ins.market.stepPerMonth)} a month, and softens when they pay out less, within ×${ins.market.range[0]}–${ins.market.range[1]}. Everyone's crashes move everyone's rates.`,
          `<b>Mid-term:</b> after an at-fault crash with injuries or deaths, or a review that changes your rating (including a new authority's first clean audit), your insurer re-writes the policy at the new price for a new year.`,
          `Dispatchers spread the premium over a typical truck's ${n(ins.loadedMilesPerYear)} loaded miles a year when they price loads.`,
        ]),
    },
    {
      id: "holding",
      section: S,
      title: "The holding cost",
      html: p(
        `Cash isn't free to sit on. Each week ${pct(cfg.holdingCost.weeklyRate)} of any cash above your working capital is burned. Working capital is the larger of ${n(cfg.holdingCost.minProtectedFd)} FD and what you spent in the last four weeks, so a buffer for a bust is free and a hoard isn't. Put spare FD to work: trucks, facilities, or Equipment Finance loans to others.`,
      ),
    },
    {
      id: "broke",
      section: S,
      title: "Going broke",
      html: ul([
        `More than ${n(cfg.insolvency.debtLimitFd)} FD in the red at ${cfg.insolvency.weeksInDebt} weekly checks in a row and the company is liquidated: bidding stops, staff are let go, owned trucks are fire-sold (from ${pct(cfg.insolvency.fireSaleStartPctOfValue)} of value, down ${pct(cfg.insolvency.fireSaleStepPctOfValue)} a week), facilities close, and extra leases go back.`,
        `A judgment bigger than the company can pay winds it up the same way.`,
        `Then you start over on the NPC lease with whatever is left, no grant. Debts are written off, your reputation starts fresh, and any airdrop not yet unlocked is forfeited.`,
      ]),
    },
    {
      id: "miles",
      section: S,
      title: "Miles",
      html:
        p(`Miles are points for hauling well, and they become the airdrop at launch. Each delivered load earns its loaded miles ×:`) +
        ul([
          `<b>On time:</b> early (${cfg.freight.earlyThresholdMinutes / 60}+ hours) ×${m.onTime.early}, on time ×${m.onTime.onTime}, late ×${m.onTime.late};`,
          `<b>Margin:</b> your margin ÷ ${pct(m.marginTarget)}, within ×${m.marginClamp[0]}–${m.marginClamp[1]};`,
          `<b>Reputation level:</b> ×${m.reputationRange[0]}–${m.reputationRange[1]};`,
          `<b>Every truck counts the same:</b> Miles are flat per loaded mile, however many trucks you run.`,
        ]) +
        p(`No Miles for a load that cleared more than ${pct(m.rateOutlierPct)} off its reference rate (a hot load's premium counts as its reference). At most ${n(m.dailyCapPerCompany)} Miles a day per company, and only the first ${m.maxLoadsPerLanePairPerDay} loads a day on the same lane count. Brokers earn ${m.brokerPerMile} per mile brokered.`),
    },
    {
      id: "token",
      section: S,
      title: "The token",
      html:
        h("Beta") +
        p(`The first ${t.betaYears} game years are the beta: FD is play money and Miles pile up.`) +
        h("Launch") +
        ul([
          `FD above each company's working capital is burned; what's kept is locked: it can be spent in the game, not sold.`,
          `An FD/USDC pool opens at $${t.launch.priceUsd} per FD with ${n(t.launch.seedUsd)} dollars of protocol-owned liquidity.`,
          `<b>Airdrop:</b> ${n(t.airdrop.fd)} FD shared by Miles, at most ${pct(t.airdrop.capShare)} to any one company. ${pct(t.airdrop.atLaunch)} unlocks at launch; the rest over ${t.airdrop.unlockWeeks} weeks, a slice each week you handle at least ${t.airdrop.loadsPerWeek} loads (a missed week's slice is forfeited). Or claim the rest at once for ${pct(1 - t.airdrop.instantClaimHaircut)} of it.`,
        ]) +
        h("After launch") +
        ul([
          `Buy FD with dollars (${pct(t.exchange.buyFeePct)} fee) or sell unlocked FD (${pct(t.exchange.sellFeePct)} fee, burned) on the Money tab.`,
          `<b>Profit tax:</b> ${pct(t.profitTaxRate)} of each week's operating profit above ${n(t.profitTaxAllowanceFd)} FD is burned. The rate moves ${pct(t.taxStabilizer.stepPerMonth)} a month within ${pct(t.taxStabilizer.range[0])}–${pct(t.taxStabilizer.range[1])} to keep the money supply steady.`,
          `Half of the game's revenue buys FD back from the pool and burns it.`,
        ]),
    },
  ];
}
