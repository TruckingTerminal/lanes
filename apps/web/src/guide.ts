import type { EconomyConfig } from "@lanes/config";
import { MANUAL_BID_MAX_DEADHEAD_MI } from "@lanes/engine";

/**
 * The in-game guide: how the market works, how to read it, and what the rules
 * cost when they're broken. Numbers come from the config the world runs on, so
 * the guide can't drift from the rules.
 */
export interface GuidePage {
  id: string;
  title: string;
  html: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const n = (x: number) => Math.round(x).toLocaleString("en-US");
const p = (s: string) => `<p>${s}</p>`;
const ul = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

export function guidePages(cfg: EconomyConfig): GuidePage[] {
  const [r1, r2] = cfg.time.boardRoundHours;
  const lab = cfg.labor;
  const sf = cfg.safety;
  const fr = cfg.fraud;
  return [
    {
      id: "start",
      title: "Your first week",
      html:
        p(`You start as an owner-operator: one leased Workhorse with a dry van, ${n(cfg.company.startingGrantFd)} FD, and you behind the wheel. The lessor takes ${pct(cfg.costs.npcLeaseShareOfGross)} of every load's pay. In the live world a game day passes every ${cfg.time.realHoursPerGameDayLive} real hours, and nothing rewinds.`) +
        ul([
          `<b>Bid on freight.</b> Open the Load board, pick a load, bid a rate per mile. Bids are sealed and clear at ${String(r1).padStart(2, "0")}:00 and ${r2}:00.`,
          `<b>Or let your dispatcher bid.</b> Standing orders bid for any idle truck you don't bid on by hand. At first the dispatcher is you.`,
          `<b>Save for your own truck.</b> A new Workhorse and dry van cost ${n(cfg.dealerFd.tractor.workhorse + cfg.dealerFd.trailer.van)} FD. Owning ends the lessor's cut.`,
          `<b>Grow.</b> Every truck needs a driver, and past ${lab.owner.span} trucks you need a dispatcher (Staff tab).`,
        ]) +
        p(`A new authority is on probation: some brokers won't load you until it's ${fr.vetting.standard.minAuthorityDays} days old, the strictest not before ${fr.vetting.strict.minAuthorityDays} days and a record. See <i>Vetting</i>.`),
    },
    {
      id: "board",
      title: "The load board",
      html:
        p(`Every load has a <b>ceiling</b>, the most the poster pays per mile. Bids go at or under it. The board scores each bid ${pct(cfg.board.scoreWeights.price)} on price, ${pct(cfg.board.scoreWeights.reputation)} on your on-time record and ${pct(cfg.board.scoreWeights.deadhead)} on empty miles to the pickup. The best score wins, one load per truck per round.`) +
        ul([
          `A load nobody takes rolls over with its ceiling up ${pct(cfg.board.rolloverCeilingStep)}. After ${cfg.board.npcFallbackAfterRounds} rounds an NPC carrier takes it.`,
          `By hand you can bid on loads up to ${MANUAL_BID_MAX_DEADHEAD_MI} miles away. A hand bid replaces your dispatcher's bids for that truck that round.`,
          `Your break-even counts fuel, wages, maintenance, insurance, expected repairs, the lessor's cut, the empty miles to the pickup, and the empty miles you'll likely run after delivering.`,
        ]),
    },
    {
      id: "rates",
      title: "How shippers price freight",
      html:
        p(`NPC shippers post at a reference rate: the lane's base rate (about ${cfg.rates.baseRatePerMile.toFixed(2)} FD/mi for a dry van, more on short hauls) times:`) +
        ul([
          `the <b>load-to-truck ratio</b> near the origin for that trailer, to the power ${cfg.rates.ratioExponent};`,
          `weather at the origin, and the trailer's premium (reefer ×${cfg.rates.equipmentPremium.reefer}, flatbed ×${cfg.rates.equipmentPremium.flatbed});`,
          `the origin's <b>season</b> for that trailer;`,
          `the destination's <b>reload odds</b>: freight into a dead market pays more, freight into a hot one less.`,
        ]) +
        p(`On top of that comes a fuel surcharge that passes on ${pct(cfg.fuel.surchargePassThrough)} of diesel above ${cfg.fuel.baseFd} FD/gal. The ceiling sits ${pct(cfg.rates.npcCeilingMarkup - 1)} over the reference rate. Half of NPC freight goes through brokers, whose contract rates trail the spot market by about ${cfg.brokerRisk.contractLagDays} days.`),
    },
    {
      id: "reload",
      title: "Headhaul, backhaul and reload odds",
      html:
        p(`Some markets consume far more than they ship. Miami takes in plenty and sends little out, so trucks pile up there. A carrier hauling into Miami knows it will run empty to reload, so freight into Miami pays more and freight out of it pays less.`) +
        p(`Every load shows the <b>reload odds</b> at its destination (good, fair or poor) and the empty miles you'd expect before the next load, and your break-even includes them. A cheap load into a strong market can beat a rich load into a dead end.`),
    },
    {
      id: "seasons",
      title: "Seasons",
      html:
        p(`Every market has its own freight season, taken from the regional curves on beagl.ai's seasonality map: a slow build, a peak, a steep fall, then a dead zone. South Florida produce builds through spring and peaks in May, Georgia and the Carolinas take over in June, and the West and North run later. Dry vans and flatbeds rise with produce season too.`) +
        p(`Seasons move volume (up to ×${cfg.rates.seasons.volumeClamp[1]}) and rates. The edge is timing: be where the season is going before the rates show it. The Company tab's <i>Seasons now</i> card lists the hottest and coldest markets.`),
    },
    {
      id: "dispatch",
      title: "Dispatching: you against your dispatcher",
      html:
        p(`Standing orders are your dispatcher's rules. Whoever dispatches (you as owner, or hired dispatchers) runs them, and their skill decides how well:`) +
        ul([
          `<b>Pricing:</b> they misjudge their own costs by about ${pct(lab.dispatcher.noise[0])} when green and ${pct(lab.dispatcher.noise[1])} at their best.`,
          `<b>Reload awareness:</b> they price in ${lab.dispatcher.reloadAware[0]}× to ${lab.dispatcher.reloadAware[1]}× of the empty run out of a destination.`,
          `<b>Foresight:</b> how far ahead on the season curves they look, from not at all to ${lab.dispatcher.foresightDays[1]} days.`,
          `<b>Span:</b> how many trucks they can run. You can run ${lab.owner.span}, and a hired dispatcher ${lab.dispatcher.span[0]}–${lab.dispatcher.span[1]}. Past the team's span, some trucks sit out each round.`,
        ]) +
        p(`<b>You can always beat the best of them by hand.</b> You see everything they see, including exact ceilings, reload odds and every market's season a year out, and you aren't held to their rules or their mistakes. Learn the market and you'll out-earn any hire.`),
    },
    {
      id: "drivers",
      title: "Drivers",
      html:
        p(`Every truck needs a driver. You drive your first one, and you hire the rest. Skill runs from 1 to 5 stars and moves real money:`) +
        ul([
          `fuel economy ±${pct(lab.driver.mpgRange / 2)}, maintenance and breakdowns ±${pct(lab.driver.maintRange / 2)}, speed ±${pct(lab.driver.mphRange / 2)};`,
          `crash odds from ×${lab.driver.crash[0]} for a green driver down to ×${lab.driver.crash[1]} for a veteran.`,
        ]) +
        p(`Market pay runs ${lab.driver.payPerMile[0].toFixed(2)}–${lab.driver.payPerMile[1].toFixed(2)} FD/mi by skill, times a wage index that rises when the driver pool runs thin. Drivers get better with every mile, up to their own potential, and as they do the market pays them more. Give them the raise, or someone else will.`) +
        p(`<b>Teams:</b> with a co-driver a truck can legally run ${sf.hos.teamHours} hours a day. Each driver earns ${pct(lab.driver.teamPayShare)} of their rate on every mile.`),
    },
    {
      id: "staff",
      title: "Hiring, poaching and keeping people",
      html: ul([
        `<b>Hire</b> from the pool at their asking pay or more. Auto-staff (on by default) fills empty seats with the best value it can find, and hires a dispatcher once you outgrow your span.`,
        `<b>Morale</b> follows pay against the market most of all, then tenure, a worn-out truck, a bad safety rating, and being made to run outside the rules, which good drivers hate most.`,
        `<b>Quitting:</b> unhappy people quit. A driver left without a truck walks after ${lab.morale.unseatedWeeks} weeks.`,
        `<b>Poaching:</b> anyone working elsewhere will move for a raise of ${pct(lab.morale.loyalty[0])} (miserable) to ${pct(lab.morale.loyalty[1])} (happy) over their pay. Their employer has ${lab.morale.noticeDays} days to match. Offers on your people show up on the Staff tab.`,
        `Dispatchers draw a weekly salary (${n(lab.dispatcher.payPerWeek[0])}–${n(lab.dispatcher.payPerWeek[1])} FD by skill) and learn with every load they book.`,
      ]),
    },
    {
      id: "safety",
      title: "Safety, inspections and ratings",
      html:
        p(`Your company has a safety record like a real carrier's, scored in four areas: hours of service, unsafe driving, vehicle maintenance and crashes. Violations count most for six months and drop off after two years. A score over its threshold is an <b>alert</b>.`) +
        ul([
          `Trucks pass weigh stations on the main corridors, and police make traffic stops. A clean record gets waved through most of the time; alerts, a poor rating or a brand-new authority get pulled in far more.`,
          `Inspections can put a driver or a truck <b>out of service</b> on the spot, with fines and roadside repairs.`,
          `A <b>compliance review</b> follows the new-entrant audit at ${sf.review.newEntrantDay} days, a run of alerts, or a serious crash. It rates you <i>satisfactory</i>, <i>conditional</i> or <i>unsatisfactory</i>. Conditional raises insurance ×${sf.insurance.conditional} and shuts you out of strict brokers. Unsatisfactory raises it ×${sf.insurance.unsatisfactory} and gives you ${sf.review.rereviewDays.unsatisfactory} days to clean up before your authority is revoked.`,
        ]),
    },
    {
      id: "crashes",
      title: "Crashes",
      html:
        p(`A crash costs according to why it happened.`) +
        ul([
          `<b>Not at fault:</b> the other side's insurer pays. You lose the load and time in the shop.`,
          `<b>At fault:</b> your insurer pays up to ${n(sf.crash.insuranceLimitFd)} FD. You pay the ${n(sf.crash.deductibleFd)} FD deductible, anything over the limit, and higher premiums afterwards. A verdict the company can't pay winds it up.`,
          `<b>With violations behind it</b> (fatigue, speeding, bad equipment), juries multiply the verdict ${sf.crash.negligenceMult[0]}–${sf.crash.negligenceMult[1]}×.`,
          `<b>A fatal crash caused by falsified hours or known defects is a crime.</b> The authority is revoked, everything the company has is seized, the owner is barred for a year, and the people who ran the truck that way go to jail.`,
        ]),
    },
    {
      id: "shutdowns",
      title: "Shutdowns",
      html:
        p(`A revoked authority means the fleet is sold off, the staff are let go, Miles are forfeited, and the account can't file for new authority until its bar runs out:`) +
        ul([
          `Unsatisfactory rating: ${sf.bars.unsatisfactory} days; a second revocation: ${sf.bars.imminentHazard} days.`,
          `A fatal crash from willful violations is a crime: everything seized and a ${sf.bars.criminal}-day bar. After ${sf.permanentAfterCrimes} crimes the account is barred for good.`,
        ]) +
        p(`After the bar you file again and start over on a lease. Brokers can see the old revocation.`),
    },
    {
      id: "vetting",
      title: "Vetting",
      html:
        p(`Brokers and shippers choose who may haul their freight, and so can you, for freight you post:`) +
        ul([
          `<b>Open:</b> anyone. More bidders and lower rates, more risk.`,
          `<b>Standard:</b> authority at least ${fr.vetting.standard.minAuthorityDays} days old, no open claims, not rated unsatisfactory.`,
          `<b>Strict:</b> at least ${fr.vetting.strict.minAuthorityDays} days and ${fr.vetting.strict.minDelivered} loads delivered (or a year old), no conditional rating or alerts, no revocation in the past year, and tracking on the load.`,
        ]) +
        p(`Hot loads are at least standard. A new carrier starts on open freight and earns its way up.`),
    },
    {
      id: "money",
      title: "Money: FD, Miles and the token",
      html:
        p(`Freight Dollars (FD) are the game's money. Fines, judgments, insurance, wages and repairs take FD out of the economy; freight brings it in. Miles are points earned by delivering, worth more for on-time loads, good margins and a long record.`) +
        p(`The first ${cfg.token.betaYears} game years are the beta. Then FD launches on the exchange and Miles turn into an airdrop. A revoked company forfeits its Miles and its airdrop.`),
    },
  ];
}
