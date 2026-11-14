import type { EconomyConfig } from "@lanes/config";
import { type GuidePage, h, n, p, pct, see, table, ul } from "./util.js";
import { PENDING } from "../copy-pending.js";

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
        p(`Set them under Dispatcher, on the Truck tab. They're the same rules the AI companies use.`) +
        table(
          ["Rule", "What it does"],
          [
            ["Bid at break-even plus %", "Asks your break-even on the load plus a margin, capped at the ceiling"],
            ["Bid at % of the ceiling", "Asks a share of the posted ceiling, whatever it costs you"],
            [`${PENDING.floorLabel} %`, PENDING.floorGuide],
            ["Max empty miles", "How far a truck will run empty to a pickup (up to 150)"],
            ["Move idle trucks", "After a number of idle rounds, sends the truck empty to the hub nearby with the most uncovered freight for its trailer"],
            ["Book loads between rounds", "Takes a load at its book-now price when it clears break-even plus your margin; the margin shrinks the longer the truck sits and the farther its driver is from home"],
            ["Bring drivers home", cfg.labor.homeAtOnce ? `After so many days out, the truck heads home and its driver takes days off, at once if it stops within ${cfg.map.nearbyRadiusMi} miles of your home hub; the dispatcher leaves it alone until they're over` : "After so many days out, the truck heads for your home hub and its driver takes days off; the dispatcher leaves it alone until they're over"],
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
          cfg.windows.enabled && cfg.windows.oneDeadline
            ? `On time means at the receiver by the load's delivery deadline (below), for your record, your Miles and the claim alike; after it is late.`
            : cfg.windows.enabled
            ? `Your on-time record counts from its own due time: the drive at the legal pace from when the truck starts the job (or the load is ready), the worst-case dock time and ${cfg.freight.deliverySlackMinutes / 60} hours of slack, and never later than the delivery deadline (below). ${cfg.freight.earlyThresholdMinutes / 60} hours early or more counts as early; past that due time is late on your record, but the poster claims only past the delivery deadline.`
            : `A load is due after the drive at the legal pace, the worst-case dock time and ${cfg.freight.deliverySlackMinutes / 60} hours of slack. ${cfg.freight.earlyThresholdMinutes / 60} hours early or more counts as early; past due is late.`,
          `A breakdown stops the truck ${bd.delayHours[0]}–${bd.delayHours[1]} hours and can make it late.`,
          ...(cfg.businesses.parking.stopInTown
            ? [`<b>Nights.</b> When a driver's hours run out, the truck stops at a truck stop with room; with none in reach it sleeps on the shoulder, where a patrol can ticket it ${n(cfg.businesses.parking.shoulderFineFd)} FD. On your dispatcher's card you can choose towns instead: a truck that has already driven today won't leave a town on a leg it can't finish without a shoulder night${cfg.businesses.parking.stopInTownMidLeg ? `, and a day that runs out mid-leg ends in the nearest town within ${cfg.businesses.parking.stopInTownMaxMi} miles, the miles there and back counted as driven` : ""}.`]
            : []),
        ]) +
        (cfg.windows.enabled
          ? h("Delivery windows") +
            ul([
              `<b>Ready.</b> About ${pct(cfg.windows.leadDays[0]![2])} of loads are ready the day they're posted; the rest are posted a day or more ahead, up to ${cfg.windows.leadDays[cfg.windows.leadDays.length - 1]![1]} days. A load ready the same day pays ${pct(cfg.windows.sameDayPremium - 1)} more.`,
              `<b>Pick up by.</b> The pickup closes ${cfg.windows.pickupHours.appointment} hours after the load is ready at a shipper with appointments, ${cfg.windows.pickupHours.firstCome} at a first-come dock. Waiting at the shipper before the load is ready pays no detention.`,
              `<b>Deliver by.</b> The deadline is the pickup's close, plus the drive at the legal hours, plus the commodity's own hours (${see("commodities", "Places, commodities and appointments")}). A hot load's is counted from when it's ready, at the hot pace.`,
              `<b>The pay in the last days.</b> A load's price holds until the last ${cfg.windows.urgencyRounds / cfg.time.boardRoundHours.length} days before its pickup closes, then climbs each round (not on a player's posted load). Wait too long and someone else books it, or nobody does.`,
              `<b>Claims.</b> Whoever posted the load claims a share of its pay as booked: ${pct(cfg.windows.lateClaimShare)} for a late delivery, ${pct(cfg.windows.noShowClaimShare)} for a no-show (your truck not at the shipper when the pickup closes). Each is a mark on your record too.`,
              `<b>Booking ahead.</b> A truck on a job can book its next load: one ahead, never two. Releasing it costs ${pct(cfg.windows.cancelClaimShare.early)} of its pay, or ${pct(cfg.windows.cancelClaimShare.urgent)} in the last ${cfg.windows.urgencyRounds / cfg.time.boardRoundHours.length} days before its pickup closes, and marks your record. When a breakdown puts it out of reach, your dispatcher releases a load it booked itself at ${pct(cfg.windows.cancelClaimShare.early)}; one you booked by hand waits for you: release it at ${pct(cfg.windows.cancelClaimShare.early)} within a round, or keep it and let the pickup's close decide.`,
              `<b>Lost loads.</b> A load nobody books by its pickup's close is lost. A broker whose load is lost pays a fall-off charge of ${pct(cfg.brokerRisk.fallOffShare)} of what the shipper agreed to pay; a shipper's goods go unsold.`,
            ])
          : "") +
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
          `An owned truck's condition falls from 100% to 0 over ${n(wear.lifeMiles)} miles since its last rebuild. Fully worn, it uses ${pct(1 / (1 - wear.mpgLossWorn) - 1)} more fuel and doubles maintenance.`,
          `Breakdowns: a new Workhorse about once every ${n(1000 / bd.per1000MiNew)} miles, ×(1 + ${bd.wornMultiplier}·wear²) as it wears and more as it ages; a Highway Pro breaks down ${pct(1 - cfg.tractors.highwayPro.breakdownMult)} less, a Flagship ${pct(1 - cfg.tractors.flagship.breakdownMult)} less. Each costs ${n(bd.repairFd[0])}–${n(bd.repairFd[1])} FD on an owned truck; the lessor pays on a leased one. A skilled driver means fewer.`,
          `<b>Rebuild</b> an idle owned truck at ${pct(wear.rebuildMaxCondition)} condition or worse: ${wear.rebuildDays} days in the shop, back to 100%. It costs ${n(wear.rebuildFd.workhorse)} FD for a Workhorse (${n(wear.rebuildFd.highwayPro)} Highway Pro, ${n(wear.rebuildFd.flagship)} Flagship), more the higher the odometer: double at ${n(wear.rebuildAgeMi)} miles.`,
          `A worn truck's break-even is higher, so it loses bids to fresher trucks. That, not a rule, is the reason to rebuild.`,
          `<b>Million-mile trucks:</b> a level every ${n(wear.milesPerLevel)} miles, up to ${wear.maxLevel}; every five levels adds ${pct(wear.fuelBonusPerFiveLevels)} fuel economy, up to ${pct(wear.maxFuelBonus)}.`,
          `Defects (worn brakes, tires, lights) build up slowly on any truck, faster if maintenance is skipped. They raise breakdown and crash odds and get trucks put out of service at inspections. Fix them from the Truck tab for ${n(cfg.safety.maintenance.fixFdPerDefect)} FD each.`,
        ]),
    },
  ];
}
