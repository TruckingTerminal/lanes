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
    totalLosses: sum("fatalCrashes"),
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
