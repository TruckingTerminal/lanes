import type { EconomyConfig } from "@lanes/config";
import { type GuidePage, h, n, p, pct, see, table, ul } from "./util.js";

const S = "Running trucks";

export function operationsPages(cfg: EconomyConfig): GuidePage[] {
  const lab = cfg.labor;
  const hos = cfg.hos;
  const hl = cfg.safety.hotLoads;
  const wear = cfg.wear;
  const bd = cfg.breakdowns;
  return [
    {
      id: "dispatch",
      section: S,
      title: "You against your dispatcher",
      html:
        p(`Standing orders are your dispatcher's rules. Whoever dispatches (you as owner, plus any dispatchers you hire) runs them every round for every idle truck you didn't bid on by hand. Their skill decides how well:`) +
        ul([
          `<b>Pricing:</b> they misjudge their own costs by about ${pct(lab.dispatcher.noise[0])} when green and ${pct(lab.dispatcher.noise[1])} at their best. The loads they win are disproportionately the ones they underpriced.`,
          `<b>Reload awareness:</b> they price in ${lab.dispatcher.reloadAware[0]}× to ${lab.dispatcher.reloadAware[1]}× of the empty run out of a destination.`,
          `<b>Foresight:</b> they look 0 to ${lab.dispatcher.foresightDays[1]} days ahead on each market's season when pricing loads and moving idle trucks.`,
          `<b>Span:</b> you can run ${lab.owner.span} trucks; a hired dispatcher ${lab.dispatcher.span[0]}–${lab.dispatcher.span[1]}. Past the team's span, some idle trucks sit out each round.`,
        ]) +
        p(`<b>You can always beat the best of them by hand.</b> You see everything they see: exact ceilings, reload odds, every market's season a year out, and where the AI is crowding. You aren't held to their rule set or their mistakes. The Staff tab shows your team's numbers.`),
    },
    {
      id: "orders",
      section: S,
      title: "Standing orders",
      html:
        p(`Set them at the bottom of the Fleet tab. They're the same rules the AI companies use.`) +
        table(
          ["Rule", "What it does"],
          [
            ["Bid at break-even plus %", "Asks your break-even on the load plus a margin, capped at the ceiling"],
            ["Bid at % of the ceiling", "Asks a share of the posted ceiling, whatever it costs you"],
            ["Never below break-even +", "A floor: skips any load that wouldn't clear it"],
            ["Max empty miles", "How far a truck will run empty to a pickup (up to 150)"],
            ["Move idle trucks", "After a number of idle rounds, sends the truck empty to the hub nearby with the most uncovered freight for its trailer"],
            ["Book loads between rounds", "Takes a load at its book-now price when it clears break-even plus your margin; the margin shrinks the longer the truck sits and the farther its driver is from home"],
            ["Bring drivers home", "After so many days out, the truck heads for your home hub and its driver takes days off; the dispatcher leaves it alone until they're over"],
          ],
        ) +
        p(`Each truck bids on up to ${cfg.board.maxBidsPerTruckPerRound} loads a round, most profitable first; it wins at most one. You get ${cfg.board.freeStandingOrders} standing orders plus a floor.`),
    },
    {
      id: "hours",
      section: S,
      title: "Hours, dock time and delivery windows",
      html:
        ul([
          `A driver gets ${hos.drivingHoursPerDay} driving hours in a 24-hour duty day that opens when the truck first rolls: about ${hos.drivingHoursPerDay * hos.avgMph} miles at ${hos.avgMph} mph (your driver's skill moves speed ±${pct(lab.driver.mphRange / 2)}). A team of two drivers gets ${cfg.safety.hos.teamHours}.`,
          `Loading and unloading take ${cfg.dwell.loadMinutes[0] / 60}–${cfg.dwell.loadMinutes[1] / 60} hours each, on duty but not driving.`,
          `A load is due after the drive at the legal pace, the worst-case dock time and ${cfg.freight.deliverySlackMinutes / 60} hours of slack. ${cfg.freight.earlyThresholdMinutes / 60} hours early or more counts as early; past due is late.`,
          `A breakdown stops the truck ${bd.delayHours[0]}–${bd.delayHours[1]} hours and can make it late.`,
        ]) +
        h("Hot loads") +
        p(`About ${pct(hl.share)} of long-haul freight (${hl.minMiles} miles or more) is hot: it pays ${hl.premium[0]}–${hl.premium[1]}× for a window that assumes ${hl.hoursPerDay} driving hours a day with only ${hl.slackMinutes / 60} hours of slack. A solo driver can't make it legally; a team can. Delivered late, a hot load pays only ${pct(hl.lateKeepsPremium)} of its premium. Hot loads are at least standard-vetted.`),
    },
    {
      id: "roads",
      section: S,
      title: "Roads, tolls and weather",
      html:
        p(`Every lane runs on the real road network: the interstates and the US highways, drawn on the map, with each route the fastest way between its two hubs at interstate speed (${cfg.roads.routing.mph[0]} mph) or two-lane highway speed (${cfg.roads.routing.mph[1]} mph). Trucks move along the road on the map, and weigh stations sit on the roads a route actually takes.`) +
        ul([
          `<b>Tolls.</b> Toll roads (the Pennsylvania Turnpike, the Ohio and Indiana toll roads, the New Jersey Turnpike, Florida's Turnpike, the Kansas and Oklahoma turnpikes, the New York Thruway and others) charge a truck by the mile at their real rates. Routing weighs a toll against the time it saves, so a free road wins when it's nearly as quick. Tolls are paid as the miles are driven, the load board shows them on every load, and your break-even counts them. Shippers pay toll routes a little more, the way they pay a fuel surcharge.`,
          `<b>Two-lane highway.</b> A stretch of US highway is slower and ${cfg.roads.crashHighwayMult}× as likely to see a crash as an interstate. The load board flags loads whose route runs on it.`,
          `<b>Winter.</b> From December to February, crash odds climb with latitude north of ${cfg.roads.winter.fromLat}°: up to +${pct(cfg.roads.winter.gain.interstate)} on interstates and +${pct(cfg.roads.winter.gain.highway)} on highways at the Canadian border. A Minneapolis run in January is not a Houston run in June.`,
          `<b>Hours.</b> A load's delivery window comes from its route's own driving time, not a flat speed, so a two-lane lane allows more time than an interstate lane of the same length.`,
        ]),
    },
    {
      id: "reputation",
      section: S,
      title: "Reputation and on-time",
      html:
        p(`Your reputation is your smoothed on-time rate: a new company counts as ${cfg.reputation.priorLoads} loads at ${pct(cfg.reputation.start)}, then every delivery moves it. It's ${pct(cfg.board.scoreWeights.reputation)} of every bid's score, so a good record wins loads at higher rates.`) +
        p(`Your level is the square root of loads delivered ÷ ${cfg.reputation.loadsPerLevelSq}, up to ${cfg.reputation.maxLevel}, and it multiplies the Miles you earn (×${cfg.miles.reputationRange[0]}–${cfg.miles.reputationRange[1]}). Going broke resets both.`),
    },
    {
      id: "wear",
      section: S,
      title: "Wear, breakdowns and rebuilds",
      html:
        ul([
          `An owned truck's condition falls from 100% to 0 over ${n(wear.lifeMiles)} miles since its last rebuild. Fully worn, it burns ${pct(1 / (1 - wear.mpgLossWorn) - 1)} more fuel and doubles maintenance.`,
          `Breakdowns: a new Workhorse about once every ${n(1000 / bd.per1000MiNew)} miles, ×(1 + ${bd.wornMultiplier}·wear²) as it wears and more as it ages; a Highway Pro breaks down ${pct(1 - cfg.tractors.highwayPro.breakdownMult)} less, a Flagship ${pct(1 - cfg.tractors.flagship.breakdownMult)} less. Each costs ${n(bd.repairFd[0])}–${n(bd.repairFd[1])} FD on an owned truck; the lessor pays on a leased one. A skilled driver means fewer.`,
          `<b>Rebuild</b> an idle owned truck at ${pct(wear.rebuildMaxCondition)} condition or worse: ${wear.rebuildDays} days in the shop, back to 100%. It costs ${n(wear.rebuildFd.workhorse)} FD for a Workhorse (${n(wear.rebuildFd.highwayPro)} Highway Pro, ${n(wear.rebuildFd.flagship)} Flagship), more the higher the odometer: double at ${n(wear.rebuildAgeMi)} miles.`,
          `A worn truck's break-even is higher, so it loses bids to fresher trucks. That, not a rule, is the reason to rebuild.`,
          `<b>Million-mile trucks:</b> a level every ${n(wear.milesPerLevel)} miles, up to ${wear.maxLevel}; every five levels adds ${pct(wear.fuelBonusPerFiveLevels)} fuel economy, up to ${pct(wear.maxFuelBonus)}.`,
          `Defects (worn brakes, tires, lights) build up slowly on any truck, faster if maintenance is skipped. They raise breakdown and crash odds and get trucks put out of service at inspections. Fix them from the Fleet tab for ${n(cfg.safety.maintenance.fixFdPerDefect)} FD each.`,
        ]),
    },
  ];
}
