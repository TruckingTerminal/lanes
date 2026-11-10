import { COMMODITIES, hubs as HUBS, PLACE_ROWS } from "@lanes/data";
const PLACE_COUNT = PLACE_ROWS.length;
const HUB_COUNT = HUBS.length;
import type { EconomyConfig } from "@lanes/config";
import { MANUAL_BID_MAX_DEADHEAD_MI } from "@lanes/engine";
import { type GuidePage, h, n, p, pct, see, table, ul } from "./util.js";
import { PENDING } from "../copy-pending.js";

const S = "The market";

export function marketPages(cfg: EconomyConfig): GuidePage[] {
  const b = cfg.board;
  const r = cfg.rates;
  const [r1, r2] = cfg.time.boardRoundHours;
  return [
    {
      id: "board",
      section: S,
      title: "The load board",
      html:
        p(`Every load shows a <b>book-now</b> price: take it and it's yours at once (${see("booknow", "Book-now prices")}). Or <b>bid</b> more than the posted price and wait: bids clear in rounds at ${String(r1).padStart(2, "0")}:00 and ${String(r2).padStart(2, "0")}:00. Each load has a <b>ceiling</b>, the most its poster will pay per mile; nobody sees anyone else's bid.`) +
        h("How a round clears") +
        ul([
          `Every bid gets a score: ${pct(b.scoreWeights.price)} for price (how far under the ceiling), ${pct(b.scoreWeights.reputation)} for reputation (your on-time record), ${pct(b.scoreWeights.deadhead)} for empty miles to the pickup (none is best; at ${b.deadheadScaleMi} it scores zero and past that it counts against you).`,
          `Bids clear best score first. A truck wins at most one load a round, and a load goes to one truck.`,
          cfg.board.refuseOverCeiling ? PENDING.guideCeilingRefused : `A bid above the ceiling, up to ${cfg.board.overCeilingMax} times it, wins only if nobody bids within the ceiling, cheapest first: in a hot market the poster pays over its ceiling rather than leave the load.`,
          `A load nobody takes rolls to the next round with its ceiling up ${pct(b.rolloverCeilingStep)} and its appointment moved back a round. Nobody but a carrier ever hauls it: it rolls until a truck takes it or, after ${b.giveUpAfterRounds} rounds, the shipper gives up and the freight is lost. Open loads piling up where trucks are scarce lift that market's load-to-truck ratio, and so every new rate posted there.`,
        ]) +
        h("Bidding by hand") +
        ul([
          `Pick an idle truck and a load up to ${MANUAL_BID_MAX_DEADHEAD_MI} miles away with the right trailer. One bid per truck per round; you can rebid or withdraw until it clears.`,
          `A hand bid replaces your dispatcher's bids for that truck that round.`,
          `The board shows your break-even for each load: fuel, wages, maintenance, insurance, expected repairs, the lessor's cut, the empty miles to the pickup, and the empty miles you'll likely run after delivering (${see("reload", "reload odds")}).`,
        ]) +
        p(`Posters pay a ${pct(b.posterFeePct)} board fee on what the freight pays them. Carriers pay nothing to bid.`),
    },
    {
      id: "booknow",
      section: S,
      title: "Book-now prices",
      html:
        p(
          cfg.board.refuseOverCeiling
            ? PENDING.guideBookNowIntro(see("board", "The load board"))
            : `Every load shows a <b>book-now</b> price: what the poster is offering right now. Take it and the load is yours at once, no round to wait for. Want more? Bid above it and wait for the round: the poster takes the best bid within its ceiling or, if none is within it, the cheapest above (${see("board", "The load board")}). Anyone who'd take the posted price just books.`,
        ) +
        h("How posters set it") +
        ul([
          `It opens as a share of the reference rate set by the load-to-truck ratio at the origin: about ${pct(cfg.bookNow.openAtRatio[0][1])} where trucks pile up (ratio ${cfg.bookNow.openAtRatio[0][0]}), ${pct(cfg.bookNow.openAtRatio[1][1])} at a balanced ${cfg.bookNow.openAtRatio[1][0]}, ${pct(cfg.bookNow.openAtRatio[2][1])} when trucks are scarce (ratio ${cfg.bookNow.openAtRatio[2][0]}), never above the ceiling.`,
          `Each round a load sits unfilled the poster raises it ${pct(cfg.bookNow.stepPerRound)}, up to the ceiling (which rises ${pct(cfg.board.rolloverCeilingStep)} a round). Brokers fish: they open low where they can and pay up when nobody bites.`,
          `So a carrier that can wait makes the poster come up, and a carrier that has to move takes what's posted. In a truck-heavy market the book-now is cheap and rising; in a tight one it opens near the ceiling.`,
        ]) +
        h("Your dispatcher and book-now") +
        // Client batch 5: the easing as the engine applies it (standingOrders.ts desperation, floorRate), as the dispatcher's floor line says it.
        p(PENDING.guideBookNowEases(cfg.bookNow.desperation.idleHours, cfg.bookNow.desperation.awayAfterDays, cfg.bookNow.desperation.awayAfterDays + cfg.bookNow.desperation.awayDays, Math.round(cfg.bookNow.desperation.belowBreakEven * 100), cfg.bookNow.autoEveryHours)),
    },
    {
      id: "commodities",
      section: S,
      title: "Places, commodities and appointments",
      html:
        p(`Freight ships between <b>places</b>: ${PLACE_COUNT} towns and metros under the ${HUB_COUNT} markets, each with what it makes and what it buys. A load shows its shipper's town and its receiver's town; its market (the board it trades on, the rate it's priced from) is the shipper's. Trucks drive the real roads between the two, so a load out of Homestead or Miles City takes you there.`) +
        p(`Every load is a <b>commodity</b>, and the commodity sets the trailer, what the load is worth, how long the shipper gives before the <b>delivery appointment</b>, and whether it spoils:`) +
        table(
          ["Commodity", "Trailer", "Appointment", "Spoils"],
          COMMODITIES.map((c) => [c.name, c.equipment, `${c.windowHours} h after posting, plus the drive`, c.spoilHours === null ? "no" : `${c.spoilHours} h after the appointment`]),
        ) +
        p(`A load is due by the usual hours-of-service schedule or the appointment, whichever comes first. A perishable delivered past its spoil time is rejected: no pay, and a cargo claim of ${pct(cfg.commodities.spoilClaimShare)} of its value on the carrier. Produce follows its region's calendar (South Florida, the Rio Grande Valley and Yuma in winter; the Central Valley spring to fall; the Southeast, Michigan and the Northwest in summer), so where the reefer loads are moves with the months.`),
    },
    {
      id: "leverage",
      section: S,
      title: "Shipper leverage and contracts",
      html:
        p(`Where trucks pile up, shippers hold the cards and work with carriers based nearby; where trucks are scarce, they take anyone. Each market holds a share of its loads for <b>local carriers only</b> (based within ${cfg.map.nearbyRadiusMi} miles) for the first round: ${pct(cfg.leverage.localShareAtBalance)} when loads and trucks balance, about ${pct(cfg.leverage.localShareClamp[1])} where trucks pile up (Miami most of the year), about ${pct(cfg.leverage.localShareClamp[0])} where they're scarce. A local-first load nobody local takes opens to everyone the next round. The join screen shows each hub's share.`) +
        h("Contracts") +
        ul([
          `Every week local shippers offer contract lanes to the carriers based nearby with the best record: a weekly volume (${cfg.contracts.loadsPerWeek[0]}–${cfg.contracts.loadsPerWeek[1]} loads) on a lane at a fixed rate for ${cfg.contracts.termDays} days. The rate is the market's trailing contract level, the same brokers get: below spot in a tight season, above it in a slump. You can hold ${cfg.contracts.maxPerCompany} at a time; offers stand ${cfg.contracts.offerDays} days.`,
          `A <b>tender</b> is a load on that lane held for you for ${cfg.contracts.tenderHours} hours at the contract rate. Accept it onto an idle truck within reach, or leave it: it goes to the spot board, where you can still bid for it at spot.`,
          `<b>Acceptance</b> is what the shipper watches. Below ${pct(cfg.contracts.cutBelow)} after ${cfg.contracts.afterTenders} tenders they cut a load a week, and local shippers pass you over for ${cfg.leverage.unreliableDays} days. At ${pct(cfg.contracts.renewAbove)} or better the term renews at the then-current rate.`,
          `The dispatcher takes offers and honors tenders unless you tell it to let a tender lapse when spot runs a set share above the contract. That's the produce-season choice: keep your customers, or chase the spike.`,
        ]),
    },
    {
      id: "rates",
      section: S,
      title: "How shippers price freight",
      html:
        p(`NPC shippers post at a reference rate. It starts from the lane's base rate: ${r.baseRatePerMile.toFixed(2)} FD/mi for a dry van, plus ${r.shortHaulBonus} FD ÷ miles on short hauls. Then it's multiplied by:`) +
        ul([
          `<b>Tightness:</b> the load-to-truck ratio within ${cfg.map.nearbyRadiusMi} miles of the origin for that trailer type, to the power ${r.ratioExponent} (kept within ${r.ratioClamp[0]}–${r.ratioClamp[1]}). Idle trucks that wouldn't take today's rates don't count as supply.`,
          `<b>Weather</b> at the origin.`,
          `<b>Trailer:</b> reefer ×${r.equipmentPremium.reefer}, flatbed ×${r.equipmentPremium.flatbed}.`,
          `<b>Season</b> at the origin (${see("seasons", "Seasons")}).`,
          `<b>Destination:</b> freight into a market where trucks pile up pays more (${see("reload", "reload odds")}).`,
        ]) +
        p(`A fuel surcharge passes on ${pct(cfg.fuel.surchargePassThrough)} of diesel's move above ${cfg.fuel.baseFd.toFixed(2)} FD/gal (at ${cfg.fuel.surchargeMpg} mpg). The ceiling is the reference rate plus ${pct(r.npcCeilingMarkup - 1)}. Most loads clear somewhere between the two.`),
    },
    {
      id: "reload",
      section: S,
      title: "Headhaul, backhaul and reload odds",
      html:
        p(`Some markets consume far more than they ship. Miami takes in plenty and sends little out, so trucks pile up there and wait. Freight <i>into</i> Miami is the headhaul and pays well; freight <i>out</i> is the backhaul and barely pays. Producing markets work the other way.`) +
        p(`<b>Reload odds</b> combine a market's balance for each trailer type with how tight it has been lately against the national average, smoothed over about a week. Every load shows its destination's odds:`) +
        table(
          ["Label", "Odds", "Means"],
          [
            ["Good", "≥ 1.25", "Easy to reload; freight in pays a bit less"],
            ["Fair", "0.8–1.25", "About average"],
            ["Poor", "< 0.8", "Expect empty miles; freight in pays more"],
          ],
        ) +
        p(`Expected empty miles after delivery are ${b.reloadDeadheadMi} ÷ the odds, between ${b.reloadDeadheadClamp[0]} and ${b.reloadDeadheadClamp[1]}. The destination's price factor is odds<sup>−${r.reloadExponent}</sup>, within ×${r.reloadClamp[0]}–${r.reloadClamp[1]}. A cheap load into a good market can beat a rich one into a dead end.`),
    },
    {
      id: "seasons",
      section: S,
      title: "Seasons",
      html:
        p(`Every market has its own freight season, from the regional curves on beagl.ai's seasonality map: a slow build, a peak, a steep fall, then a dead zone. Each hub follows the nearest market's curve for dry van and reefer; flatbed follows the van curve at ${pct(r.seasons.flatbedFromVan)} strength.`) +
        ul([
          `South Florida produce builds slowly from winter, runs hot from late April through May, falls steeply in June and stays dead into autumn.`,
          `Georgia and the Carolinas pick up in June as Florida fades; the West and North run later in summer and fall.`,
          `Dry van and flatbed rise with produce season too, and northern markets tighten in winter.`,
          `Late December volume drops to ${pct(r.seasons.lateDecVolume)} for the holidays.`,
        ]) +
        p(`A season moves freight volume (×${r.seasons.volumeClamp[0]}–${r.seasons.volumeClamp[1]}) and the posted rate (×${r.seasons.rateClamp[0]}–${r.seasons.rateClamp[1]}), and more freight tightens the market on top. The edge is timing: be where the season is going before the rates show it. The Company tab's <i>Seasons now</i> card shows the hottest and coldest markets; each load shows its origin's season.`),
    },
    {
      id: "cycle",
      section: S,
      title: "Booms, busts and stabilizers",
      html:
        p(`National freight demand runs in cycles, as it does in the real freight market. The Company tab shows the demand dial: above 1.1 is a boom (more freight, higher rates), below 0.9 a slump. Booms invite everyone to buy trucks; the trucks arrive after the dealer's lead time, often as the market turns.`) +
        p(`Published stabilizers keep the money supply in check. Each month NPC freight volume moves up to ${pct(cfg.stabilizers.volumeStepPerMonth)} (within ×${cfg.stabilizers.volumeRange[0]}–${cfg.stabilizers.volumeRange[1]}) and the diesel rack spread up to ${pct(cfg.stabilizers.rackStepPerMonth)} (within ±${pct(cfg.stabilizers.rackSpreadBand)}), toward FD sinks matching faucets. After the token launches the profit tax moves first (${see("token", "The token")}).`),
    },
    {
      id: "fuel",
      section: S,
      title: "Fuel",
      html: p(
        `Diesel starts at ${cfg.fuel.baseFd.toFixed(2)} FD a gallon and follows real diesel prices at half strength, within ±${pct(cfg.fuel.clamp[1] - 1)}, times the rack spread. Your fuel bill is miles ÷ mpg × price: a Workhorse gets ${cfg.tractors.workhorse.mpg} mpg, a Highway Pro ${cfg.tractors.highwayPro.mpg}, a Flagship ${cfg.tractors.flagship.mpg}. Wear costs up to ${pct(cfg.wear.mpgLossWorn)} of that, million-mile trucks gain up to ${pct(cfg.wear.maxFuelBonus)}, and your driver moves it ±${pct(cfg.labor.driver.mpgRange / 2)}. The fuel surcharge on every load passes most of a price spike to shippers.`,
      ),
    },
    {
      id: "brokers",
      section: S,
      title: "Brokers and contracts",
      html:
        p(`About ${pct(cfg.freight.npcBrokerOnlyShare)} of NPC freight is tendered to AI brokers at contract rates, which trail the spot market by about ${cfg.brokerRisk.contractLagDays} days. A broker reposts the load at its margin (typically 6–12%) and pays the carrier whatever the shipper does. In a spike, brokers pay carriers more than their contracts bring in; in a slide, the contracts pad their margin.`) +
        p(`Some shippers don't pay their brokers (about ${pct(cfg.brokerRisk.defaultRate)} of loads, more in a slump). The broker still pays its carrier. Brokers choose which carriers they'll load: see ${see("vetting", "Vetting")}.`),
    },
  ];
}
