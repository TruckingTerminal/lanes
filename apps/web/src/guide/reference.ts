import type { EconomyConfig } from "@lanes/config";
import { type GuidePage, n, p, pct, see, table } from "./util.js";

const S = "Reference";

export function referencePages(cfg: EconomyConfig): GuidePage[] {
  const [r1, r2] = cfg.time.boardRoundHours;
  return [
    {
      id: "numbers",
      section: S,
      title: "Numbers at a glance",
      html: table(
        ["", ""],
        [
          ["A game day (live)", `${cfg.time.realHoursPerGameDayLive} real hours`],
          ["Board rounds", `${String(r1).padStart(2, "0")}:00 and ${String(r2).padStart(2, "0")}:00`],
          // What the player sees: the grant less the authority filing fee taken at the start (diary 1, row 28).
          ["Starting cash", `${n(cfg.company.startingGrantFd - cfg.permits.carrierAuthorityFd)} FD (a ${n(cfg.company.startingGrantFd)} FD grant, less the ${n(cfg.permits.carrierAuthorityFd)} FD authority filing)`],
          ["NPC lease", `${pct(cfg.costs.npcLeaseShareOfGross)} of each load's pay`],
          ["Workhorse + dry van, list", `${n(cfg.dealerFd.tractor.workhorse + cfg.dealerFd.trailer.van)} FD`],
          ["Dealer lead time", `${cfg.dealerDelivery.baseDays}+ days`],
          ["Driving per duty day", `${cfg.hos.drivingHoursPerDay} h solo, ${cfg.safety.hos.teamHours} h team`],
          ["Average speed", `${cfg.hos.avgMph} mph`],
          ["Diesel base", `${cfg.fuel.baseFd.toFixed(2)} FD/gal`],
          ["Driver market pay", `${cfg.labor.driver.payPerMile[0].toFixed(2)}–${cfg.labor.driver.payPerMile[1].toFixed(2)} FD/mi`],
          ["Dispatcher pay (full span)", `${n(cfg.labor.dispatcher.payPerWeek[0])}–${n(cfg.labor.dispatcher.payPerWeek[1])} FD/wk`],
          ["Insurance base", `${n(cfg.insurance.baseAnnualPerTruck)} FD per truck per year`],
          ["Yard rent base", `${cfg.homeBase.yardPerTruckWeek} FD per truck per week`],
          ["Trucks you dispatch yourself", cfg.labor.owner.span],
          ["Truck cap per company", cfg.company.maxTrucks],
          ["Insolvency", `${n(cfg.insolvency.debtLimitFd)} FD in the red, ${cfg.insolvency.weeksInDebt} weeks running`],
          ["Token launch", `end of year ${cfg.token.betaYears}`],
        ],
      ),
    },
    {
      id: "glossary",
      section: S,
      title: "Glossary",
      html: table(
        ["Term", "Meaning"],
        [
          ["Backhaul", "The return trip out of a market that takes in more than it ships: cheap freight"],
          ["Break-even", "The rate per mile that just covers a load's costs, including the empty miles before and after"],
          ["Ceiling", "The most a poster will pay per mile for a load"],
          ["Deadhead", "Miles driven empty"],
          ["Duty day", "The 24 hours from when a truck first rolls; driving hours reset after it"],
          ["FD", "Freight Dollars, the game's money"],
          ["FSC", "Fuel surcharge, paid on top of the linehaul rate"],
          ["Garaging", "Where a carrier is based, for insurance"],
          ["Headhaul", "Freight into a market that takes in more than it ships: well paid"],
          ["Hot load", "Freight with a tight window, at a premium"],
          ["Load-to-truck ratio", "Loads posted against trucks available nearby; higher means tighter, better-paying"],
          ["Miles", "Points earned for hauling well, converted to the airdrop at launch"],
          ["Out of service", "Ordered off the road at an inspection until a problem is fixed"],
          ["Reload odds", "How easily a truck finds its next load after delivering at a hub"],
          ["Span", "How many trucks a dispatcher can run"],
          ["Standing orders", "Your dispatcher's rules for bidding and moving trucks"],
          ["Vetting", "A poster's requirements for who may haul its freight"],
        ],
      ),
    },
    {
      id: "faq",
      section: S,
      title: "Questions",
      html:
        p(`<b>Why did I lose a bid at a lower rate than the winner?</b> Price is ${pct(cfg.board.scoreWeights.price)} of the score; reputation, empty miles and the home-market edge make up the rest.`) +
        p(`<b>Why are my trucks sitting idle?</b> No freight in range that clears your floor, no driver, or your fleet is past your dispatch team's span (the Staff tab says which).`) +
        p(`<b>Why did my insurance go up?</b> A renewal re-prices it: check the Company tab for your record, garaging and the market. A serious crash or a bad rating re-writes it at once.`) +
        p(`<b>Can I pause the live world?</b> No. Only test worlds pause. See ${see("worlds", "The live world and test worlds")}.`) +
        p(`<b>Is a hired dispatcher better than me?</b> Never better than your own bids by hand. See ${see("dispatch", "You against your dispatcher")}.`),
    },
  ];
}
