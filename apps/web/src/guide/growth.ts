import type { EconomyConfig } from "@lanes/config";
import { garagingFactor, hubs } from "@lanes/data";
import { type GuidePage, h, n, p, pct, see, table, ul } from "./util.js";

const S = "Growing the company";

export function growthPages(cfg: EconomyConfig): GuidePage[] {
  const L = cfg.freeEntry.leases;
  const d = cfg.dealerDelivery;
  const ef = cfg.equipmentFinance;
  const hb = cfg.homeBase;
  const starters = hubs.filter((x) => x.isStarter);
  return [
    {
      id: "home",
      section: S,
      title: "Choosing a home hub",
      html:
        p(`You pick a home hub when you start: one of the ${starters.length} starter hubs. Your trucks start there, new and leased trucks are delivered there, and it sets three costs and one edge.`) +
        ul([
          `<b>Local edge:</b> shippers favor carriers with a yard nearby. Loads from within ${cfg.map.nearbyRadiusMi} miles of your home score ${(hb.preference * 100).toFixed(0)} points higher (out of 100) when your hub has its fair share of carriers, up to ${(hb.preference * hb.preferenceClamp[1] * 100).toFixed(0)} when it's wide open and as little as ${(hb.preference * hb.preferenceClamp[0] * 100).toFixed(0)} when it's crowded.`,
          `<b>Crowding</b> is the carriers based at a hub against its fair share of all carriers by freight volume. Chicago has the most freight, and it can also have the most competition.`,
          `<b>Yard rent:</b> ${hb.yardPerTruckWeek} FD a week for each truck past your first × the metro factor (${hb.yardTier[0]} + ${hb.yardTier[1]} × the hub's freight size) × crowding (within ×${hb.yardCrowdClamp[0]}–${hb.yardCrowdClamp[1]}). Parked trucks pay it too.`,
          `<b>Insurance garaging:</b> premiums follow each state's lawsuit climate. See ${see("insurance", "Insurance")}.`,
        ]) +
        table(
          ["Hub", "Outbound van / reefer / flatbed", "Insurance"],
          starters.map((x) => [x.name, `${x.imbalance.van} / ${x.imbalance.reefer} / ${x.imbalance.flatbed}`, `×${(garagingFactor[x.id] ?? 1).toFixed(2)}`]),
        ) +
        p(`Outbound above 1 means a market ships more than it takes in: easy reloads. Below 1, trucks pile up and outbound pays little. The join screen shows each hub's crowding and yard rent live.`),
    },
    {
      id: "leasing",
      section: S,
      title: "Leasing",
      html: ul([
        `<b>Your first truck</b> is an NPC lease: a Workhorse with a dry van. The lessor takes ${pct(cfg.costs.npcLeaseShareOfGross)} of every load's pay and pays for major repairs.`,
        `<b>Extra leases</b>, once you own a truck: any trailer, no money down, the same ${pct(cfg.costs.npcLeaseShareOfGross)}, at least ${n(L.minWeeklyFd)} FD a week, a ${L.minTermDays}-day minimum term, up to ${L.maxPerCompany} at a time. You hire a driver for each.`,
        `The lessor's fleet grows when nearly all of it is out and freight is going uncovered, and shrinks when leases come back, so in a boom you may find none left.`,
      ]),
    },
    {
      id: "buying",
      section: S,
      title: "Buying trucks",
      html:
        table(
          ["", "List price", "mpg", "Breakdowns", "Maintenance FD/mi"],
          (["workhorse", "highwayPro", "flagship"] as const).map((t) => [
            t === "workhorse" ? "Workhorse" : t === "highwayPro" ? "Highway Pro" : "Flagship",
            `${n(cfg.dealerFd.tractor[t])} FD`,
            cfg.tractors[t].mpg,
            `×${cfg.tractors[t].breakdownMult}`,
            cfg.tractors[t].maintPerMile.toFixed(2),
          ]),
        ) +
        p(`Trailers: dry van ${n(cfg.dealerFd.trailer.van)} FD, reefer ${n(cfg.dealerFd.trailer.reefer)}, flatbed ${n(cfg.dealerFd.trailer.flatbed)}.`) +
        h("Prices move") +
        p(`Each tractor tier and trailer type has its own price index. Every month it moves a third of the way toward a target: up ${pct(cfg.dealerPrices.backlogWeight)} as the dealer's backlog doubles the wait, up as supply runs short (fewer than ${pct(cfg.dealerPrices.scarceBelow)} of the cap left) and down when there's plenty, within ×${cfg.dealerPrices.range[0]}–${cfg.dealerPrices.range[1]} of list. Used values move with new prices. Buying into a boom costs more.`) +
        h("Delivery and supply") +
        ul([
          `You pay when you order. The truck arrives ${d.baseDays} days later, plus a day for every ${n(1 / d.daysPerPendingOrder)} trucks already on order nationally (up to ${d.maxDays}). Orders placed in a boom often land as it turns.`,
          `Supply is capped: ${n(cfg.tractors.workhorse.pocCap)} Workhorses, ${n(cfg.tractors.highwayPro.pocCap)} Highway Pros and ${n(cfg.tractors.flagship.pocCap)} Flagships in the whole world. ${pct(cfg.starterReserveShare)} of Workhorses and dry vans are held for companies buying their first truck.`,
          `Ordering a first truck while on the NPC lease replaces the lease when it arrives. A company can run up to ${cfg.company.maxTrucks} trucks.`,
        ]),
    },
    {
      id: "used",
      section: S,
      title: "The used market",
      html:
        p(`List an idle owned truck at an asking price, a floor, and a weekly price cut; a buyer gets it today, where it stands. The seller gets ${pct(1 - cfg.usedMarket.feePct)} and ${pct(cfg.usedMarket.feePct)} is burned.`) +
        p(`A truck's value falls with mileage (to ${pct(cfg.depreciation.floorPct)} of new at ${n(cfg.depreciation.lifetimeMiles)} miles), ${pct(cfg.depreciation.perYear)} a year with age, and up to ${pct(cfg.depreciation.conditionWeight)} more for wear, all against what the same truck costs new today.`),
    },
    {
      id: "finance",
      section: S,
      title: "Equipment Finance",
      html: ul([
        `<b>Borrow</b> up to ${pct(ef.maxLoanToValue)} of an owned truck's value at ${pct(ef.weeklyRate)} a week, repaid over ${ef.termWeeks} weeks.`,
        `<b>Miss ${ef.missedPaymentsToRepossess} payments</b> and the truck is repossessed and sold; depositors absorb any shortfall.`,
        `<b>Deposit</b> spare FD to earn the interest borrowers pay. Idle cash in the pool pays the holding cost like any other.`,
      ]),
    },
    {
      id: "overhead",
      section: S,
      title: "Overhead and parking",
      html:
        p(`Running a fleet costs more than its trucks. Each week every truck past your third pays overhead by bracket:`) +
        table(
          ["Truck number", "FD a week each"],
          cfg.fleetOverhead.brackets.map((b, i, all) => [`${b.fromTruck}${all[i + 1] ? `–${all[i + 1]!.fromTruck - 1}` : "+"}`, n(b.weeklyFd)]),
        ) +
        p(`A <b>parked</b> truck is off the road: no overhead, no insurance, no driver needed, but it still pays yard rent, and an owned truck unused for ${cfg.costs.idleFeeAfterDays}+ days pays ${cfg.costs.idleFeePerDay} FD a day. Dispatcher pay and yard rent are on top (${see("dispatchers", "Dispatchers")}, ${see("home", "Choosing a home hub")}).`),
    },
    {
      id: "facilities",
      section: S,
      title: "Facilities: becoming a shipper",
      html:
        p(`Any company can buy a facility and post its own freight. The NPC market buys the goods on delivery; you pay the carrier and keep the margin, plus ${cfg.facilities.shipperMilesPerMile} Miles per mile shipped.`) +
        table(
          ["", "Price", "Upkeep/week", "Loads/round", "Freight"],
          (["warehouse", "coldStorage", "factory"] as const).map((t) => {
            const f = cfg.facilities.types[t];
            return [t === "coldStorage" ? "Cold storage" : t[0]!.toUpperCase() + t.slice(1), `${n(f.priceFd)} FD`, `${n(f.upkeepPerWeekFd)} FD`, f.loadsPerRound, f.equipment === "bySector" ? "by the hub's industry" : f.equipment];
          }),
        ) +
        p(`Your freight takes over part of the hub's NPC demand (NPCs always keep at least ${pct(1 - cfg.facilities.maxPlayerShareOfHub)}). A load nobody hauls rolls with its ceiling up ${pct(cfg.board.rolloverCeilingStep)} a round, at your cost; after ${cfg.board.giveUpAfterRounds} rounds the goods go unsold. Up to ${cfg.facilities.maxPerCompany} facilities per company.`),
    },
  ];
}
