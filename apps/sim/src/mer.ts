/**
 * The Monthly Economic Report from a sim run (TODO.md: "the first Monthly Economic Report, from the
 * sim"), in the spirit of EVE Online's: one month of a seed's daily metrics summed into what the game
 * paid out and took back, the supply, the exchange, the market, destruction and services.
 *
 *   npx tsx apps/sim/src/mer.ts runs/<batch>/report-seed1.json <months after launch, 0 = the first> [out.json | out.html]
 */
import { readFileSync, writeFileSync } from "node:fs";

interface Day {
  day: number;
  [k: string]: unknown;
}
const [path, monthArg, out] = process.argv.slice(2);
if (!path) throw new Error("usage: mer.ts <report.json> <month after launch> [out.json]");
const run = JSON.parse(readFileSync(path, "utf8")) as { days: Day[]; report: Record<string, any> };
const days = run.days;
const token = run.report.realMoney?.token;
const launch: number = token?.launchDay ?? 730;
const month = Number(monthArg ?? 0);
const from = launch + month * 30;
const span = days.filter((d) => d.day >= from && d.day < from + 30);
if (span.length === 0) throw new Error(`no days from ${from}`);
const n = (d: Day, k: string) => (typeof d[k] === "number" ? (d[k] as number) : 0);
const sum = (k: string) => span.reduce((s, d) => s + n(d, k), 0);
const tags = (k: string) => {
  const m = new Map<string, number>();
  for (const d of span) for (const [t, v] of Object.entries((d[k] as Record<string, number>) ?? {})) m.set(t, (m.get(t) ?? 0) + v);
  return [...m].filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]).map(([t, v]) => [t, Math.round(v)] as [string, number]);
};
const first = span[0]!;
const last = span.at(-1)!;
const prices = span.map((d) => n(d, "priceUsd")).filter((p) => p > 0);
const faucets = sum("faucetFd");
const sinks = sum("sinkFd");
const burns = tags("burnByTag");
const served = sum("roadServiceStop") + sum("roadServiceHub") + sum("roadServiceNpc");
const nights = sum("siteNights") + sum("shoulderNights");
const yearOf = (day: number) => Math.floor(day / 365) + 1;
// The token's size (Jeff, 2026-10-31): circulating FD (outside the reserve, the protocol's allocations and the burns,
// less spend-only locked FD) and the total (the cap less burns). Read off the day's metrics, or for runs from before
// they were recorded, worked out from the day's supply, locked FD and the burns to date.
const CAP_BURNS = ["season_close", "buyback", "exchange_fee", "airdrop_forfeit", "unstake_haircut", "profit_tax_burn", "asset_burn"];
const burnedBy = new Map<number, number>();
{
  let b = 0;
  for (const d of days) {
    for (const k of CAP_BURNS) b += ((d["burnByTag"] as Record<string, number> | undefined) ?? {})[k] ?? 0;
    burnedBy.set(d.day, b);
  }
}
const circulating = (d: Day) => (typeof d["circulatingFd"] === "number" ? (d["circulatingFd"] as number) : Math.max(0, n(d, "supplyFd") - n(d, "lockedFd")));
const totalSupply = (d: Day) => (typeof d["totalSupplyFd"] === "number" ? (d["totalSupplyFd"] as number) : 1_000_000_000 - (burnedBy.get(d.day) ?? 0));
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const data = {
  title: "Monthly Economic Report",
  period: `Year ${yearOf(from)}, ${MONTHS[Math.min(11, Math.floor((from % 365) / 30))]} (month ${month + 1} after launch)`,
  source: { file: path, ruleset: run.report.configVersion, seed: run.report.seed, fromDay: from, toDay: last.day },
  money: {
    paidOut: Math.round(faucets),
    takenBack: Math.round(sinks),
    ratio: faucets > 0 ? sinks / faucets : 0,
    burned: burns.reduce((s, [, v]) => s + v, 0),
    faucets: tags("faucetByTag"),
    sinks: tags("sinkByTag"),
    burns,
  },
  supply: {
    companiesStart: Math.round(n(first, "supplyFd")),
    companiesEnd: Math.round(n(last, "supplyFd")),
    circulatingStart: Math.round(circulating(first)),
    circulatingEnd: Math.round(circulating(last)),
    totalEnd: Math.round(totalSupply(last)),
    reserveStart: Math.round(n(first, "reserveFd")),
    reserveEnd: Math.round(n(last, "reserveFd")),
    lockedEnd: Math.round(n(last, "lockedFd")),
  },
  exchange: {
    launchPrice: token?.price?.launchUsd ?? 0,
    priceStart: prices[0] ?? 0,
    priceEnd: prices.at(-1) ?? 0,
    priceLow: prices.length ? Math.min(...prices) : 0,
    priceHigh: prices.length ? Math.max(...prices) : 0,
    poolUsdStart: Math.round(n(first, "poolUsd")),
    poolUsdEnd: Math.round(n(last, "poolUsd")),
    poolFdEnd: Math.round(n(last, "exchangeFd")),
    profitTaxRate: n(last, "profitTaxRate"),
    marketCapStart: Math.round((prices[0] ?? 0) * circulating(first)),
    marketCapEnd: Math.round((prices.at(-1) ?? 0) * circulating(last)),
    fdvEnd: Math.round((prices.at(-1) ?? 0) * totalSupply(last)),
  },
  market: {
    posted: sum("posted"),
    cleared: sum("cleared"),
    delivered: sum("delivered"),
    expired: sum("expired"),
    avgRate: span.reduce((s, d) => s + n(d, "avgClearedRate") * n(d, "cleared"), 0) / Math.max(1, sum("cleared")),
    onTime: span.reduce((s, d) => s + n(d, "onTimeShare") * n(d, "delivered"), 0) / Math.max(1, sum("delivered")),
    ownedTrucks: n(last, "ownedTrucks"),
    leasedTrucks: n(last, "leasedTrucks"),
    idleTrucks: Math.round(sum("idleTrucks") / span.length),
    companies: n(last, "companies"),
    newTrucksOrdered: sum("ordersPlaced"),
    usedSales: sum("usedSales"),
    fuelPrice: n(last, "fuelPrice"),
    wageIndex: n(last, "wageIndex"),
  },
  destruction: {
    crashes: sum("crashes"),
    // Assets on, rigs are written off at each severity's odds (metrics totalLosses); before that only fatal crashes totaled a truck.
    totalLosses: span.some((d) => typeof d["totalLosses"] === "number") ? sum("totalLosses") : sum("fatalCrashes"),
    // Assets and destruction (config assets): null when the run had them off.
    assets: span.some((d) => n(d, "factoryTractors") > 0 || n(d, "scrappedTractors") > 0 || n(d, "ownedTrailers") > 0)
      ? {
          scrappedTractors: sum("scrappedTractors"),
          scrappedTrailers: sum("scrappedTrailers"),
          yardThefts: sum("yardThefts"),
          factoryTractors: sum("factoryTractors"),
          factoryTrailers: sum("factoryTrailers"),
          dealershipSales: sum("dealershipSales"),
          tradeIns: sum("tradeIns"),
          playerLeases: sum("playerLeases"),
          assetSales: sum("assetSales"),
          wholesaleFd: Math.round(sum("wholesaleFd")),
          rentalsOut: n(last, "rentalsOut"),
          ownedTrailers: n(last, "ownedTrailers"),
        }
      : null,
    cargoThefts: sum("cargoThefts"),
    cargoStolenFd: Math.round(sum("cargoTheftFd")),
    flatbedDamage: sum("flatbedDamage"),
    rebuilds: sum("rebuilds"),
    repossessions: sum("repossessions"),
    bankruptcies: sum("bankruptcies"),
  },
  services: {
    breakdowns: sum("breakdowns"),
    servedByTruckStops: served ? sum("roadServiceStop") / served : 0,
    servedByHubShops: served ? sum("roadServiceHub") / served : 0,
    servedByNpc: served ? sum("roadServiceNpc") / served : 0,
    nightsAtSites: nights ? sum("siteNights") / nights : 0,
    shoulderTickets: sum("tickets"),
    sitesFull: sum("sitesFull"),
    dockWaits: sum("dockWaits"),
    dockWaitHours: sum("dockWaitMin") / 60 / Math.max(1, sum("dockWaits")),
    missedSlots: sum("missedSlots"),
    passClosures: sum("passClosures"),
    businesses: n(last, "businesses"),
  },
  daily: span.map((d) => ({ day: d.day, price: n(d, "priceUsd"), poolUsd: Math.round(n(d, "poolUsd")), paidOut: Math.round(n(d, "faucetFd")), takenBack: Math.round(n(d, "sinkFd")), rate: n(d, "avgClearedRate") })),
};
const text = JSON.stringify(data, null, 1);
// An .html output is the report page: the template (apps/sim/mer/template.html) with the month's numbers in it.
if (out && out.endsWith(".html")) {
  const batch = path.match(/runs\/([^/]+)\//)?.[1] ?? null;
  const page = readFileSync(new URL("../mer/template.html", import.meta.url), "utf8");
  const json = JSON.stringify({ ...data, number: month + 1, source: { ...data.source, batch } }).replace(/</g, "\\u003c");
  writeFileSync(out, page.replace("/*MER_DATA*/null", () => json));
} else if (out) writeFileSync(out, text);
else console.log(text);
