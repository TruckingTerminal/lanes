import { readdirSync, readFileSync } from "node:fs";
import type { DayMetrics, RunReport } from "@lanes/engine";

// Side-by-side means across seeds for two or more run folders.
//   npx tsx apps/sim/src/compare.ts runs/cycle-seasons-on runs/cycle-seasons-off
const dirs = process.argv.slice(2);
type Run = RunReport & { daily: DayMetrics[] };
const runs: Run[][] = dirs.map((dir) =>
  readdirSync(dir)
    .filter((f) => f.startsWith("report-seed") && f.endsWith(".json"))
    .map((f) => {
      const { report, days } = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as { report: RunReport; days: DayMetrics[] };
      return { ...report, daily: days };
    }),
);
/** Mean of f over the days where the demand dial is in a boom (> 1.1) or a bust (< 0.9). */
const phase = (r: Run, boom: boolean, f: (d: DayMetrics) => number) => {
  const ds = r.daily.filter((d) => (boom ? d.cycle > 1.1 : d.cycle < 0.9));
  return ds.length ? ds.reduce((s, d) => s + f(d), 0) / ds.length : NaN;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const range = (xs: number[], f: (x: number) => string) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? `${f(mean(xs))} (${f(s[0]!)}–${f(s.at(-1)!)})` : "n/a";
};
const fd = (x: number) => (Math.abs(x) >= 1e6 ? `${(x / 1e6).toFixed(1)}M` : Math.abs(x) >= 1e3 ? `${(x / 1e3).toFixed(0)}k` : x.toFixed(0));
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const x2 = (x: number) => `${x.toFixed(2)}×`;
const n0 = (x: number) => x.toFixed(0);
const usd4 = (x: number) => `$${x.toPrecision(2)}`;

type Row = [string, (rs: Run[]) => string];
const years = Math.max(...runs.map((rs) => rs[0]?.inflation.years.length ?? 0));
const rows: Row[] = [];
for (let y = 0; y < years; y++) {
  rows.push([`Supply before year ${y + 1} close`, (rs) => range(rs.map((r) => r.inflation.years[y]?.preCloseFd ?? NaN).filter(Number.isFinite), fd)]);
}
for (let y = 1; y < years; y++) {
  rows.push([`Supply growth, year ${y + 1} vs ${y}`, (rs) => range(rs.map((r) => r.inflation.years[y]?.growthVsPriorYear ?? NaN).filter(Number.isFinite), x2)]);
}
for (let y = 0; y < years; y++) {
  rows.push([`Avg rate, year ${y + 1} (FD/mi)`, (rs) => range(rs.map((r) => r.inflation.years[y]?.avgRate ?? NaN).filter(Number.isFinite), (x) => x.toFixed(2))]);
}
rows.push(
  ["Operating sinks/faucets, all quarters", (rs) => range(rs.flatMap((r) => r.cycleQuarters.map((q) => q.sinkFaucetRatio)), pct)],
  ["Sinks incl. burn / faucets, whole run", (rs) => range(rs.map((r) => {
    const f = r.seasons.reduce((s, x) => s + x.faucetFd, 0);
    const k = r.seasons.reduce((s, x) => s + x.sinkFd + (x.burnedFd ?? 0), 0);
    return f > 0 ? k / f : NaN;
  }), pct)],
  ["Wealth Gini", (rs) => range(rs.map((r) => r.wealth.gini), (x) => x.toFixed(2))],
  ["Top 1% share of wealth", (rs) => range(rs.map((r) => r.wealth.top1Share), pct)],
  ["Top 10% share of wealth", (rs) => range(rs.map((r) => r.wealth.top10Share), pct)],
  ["Miles Gini", (rs) => range(rs.map((r) => r.wealth.milesGini), (x) => x.toFixed(2))],
  ["Avg wealth: owner-operator", (rs) => range(rs.map((r) => r.wealth.avgBySegment.oo ?? 0), fd)],
  ["Avg wealth: fleet", (rs) => range(rs.map((r) => r.wealth.avgBySegment.fleet ?? 0), fd)],
  ["Avg wealth: broker", (rs) => range(rs.map((r) => r.wealth.avgBySegment.broker ?? 0), fd)],
  ["Repossessions", (rs) => range(rs.map((r) => r.failures.repossessions), n0)],
  ["Companies repossessed", (rs) => range(rs.map((r) => r.failures.companiesRepossessed), n0)],
  ["Carriers wiped out", (rs) => range(rs.map((r) => r.failures.wipedOut), n0)],
  ["Companies in debt at end", (rs) => range(rs.map((r) => r.failures.inDebtAtEnd), n0)],
  ["Debt in red balances at end", (rs) => range(rs.map((r) => r.failures.debtFd), fd)],
  ["Liquidations", (rs) => range(rs.map((r) => r.failures.bankruptcies ?? 0), n0)],
  ["Companies liquidated at least once", (rs) => range(rs.map((r) => r.failures.companiesBankrupt ?? 0), n0)],
  ["…of them owner-operators / fleets / brokers", (rs) => ["oo", "fleet", "broker"].map((s) => n0(mean(rs.map((r) => r.failures.bankruptBySegment?.[s] ?? 0)))).join(" / ")],
  ["Debt written off at restart (faucet)", (rs) => range(rs.map((r) => r.failures.debtWrittenOffFd ?? 0), fd)],
  ["Holding cost paid (sink)", (rs) => range(rs.map((r) => r.sinksByTag.holding_cost ?? 0), fd)],
  ["Shipper defaults on brokered loads", (rs) => range(rs.map((r) => r.failures.shipperDefaults ?? 0), n0)],
  ["Equipment Finance written off", (rs) => range(rs.map((r) => r.failures.writtenOffFd), fd)],
  ["Used-truck sales", (rs) => range(rs.map((r) => r.usedMarket.sales), n0)],
  ["Owned trucks at end", (rs) => range(rs.map((r) => r.daily.at(-1)!.ownedTrucks), n0)],
  ["Extra leases out, average", (rs) => range(rs.map((r) => r.daily.reduce((s, d) => s + (d.leasedTrucks ?? 0), 0) / r.daily.length), n0)],
  ["Tractor cap at end", (rs) => range(rs.map((r) => r.daily.at(-1)!.tractorCap ?? NaN).filter(Number.isFinite), n0)],
  ["Player trucks running in booms / busts", (rs) =>
    `${n0(mean(rs.map((r) => phase(r, true, (d) => d.ownedTrucks + (d.leasedTrucks ?? 0)))))} / ${n0(mean(rs.map((r) => phase(r, false, (d) => d.ownedTrucks + (d.leasedTrucks ?? 0)))))}`],
  ["Avg rate in booms / busts (FD/mi)", (rs) =>
    `${mean(rs.map((r) => phase(r, true, (d) => d.avgClearedRate))).toFixed(2)} / ${mean(rs.map((r) => phase(r, false, (d) => d.avgClearedRate))).toFixed(2)}`],
  ["Loads expired unhauled per day, booms", (rs) => range(rs.map((r) => phase(r, true, (d) => d.expired)), n0)],
  ["Fleet profit per truck-week after overhead", (rs) => range(rs.map((r) => r.carriersBySegment.fleet?.afterOverheadPerTruckWeek ?? 0), fd)],
  ["Owner-operator profit per truck-week", (rs) => range(rs.map((r) => r.carriersBySegment.oo?.afterOverheadPerTruckWeek ?? 0), fd)],
  ["FD burned outside operations (buyback, launch, fees)", (rs) => range(rs.map((r) => Object.values(r.burnsByTag ?? {}).reduce((a, b) => a + b, 0)), fd)],
  ["Buyback: FD bought and burned", (rs) => range(rs.map((r) => r.realMoney?.buyback?.boughtFd ?? 0), fd)],
  ["Buyback: average clearing price ($/FD)", (rs) => range(rs.map((r) => r.realMoney?.buyback?.avgPriceUsd ?? NaN).filter(Number.isFinite), usd4)],
  ["Buyback: price, lowest / highest quarter ($/FD)", (rs) => {
    const qs = rs.flatMap((r) => (r.realMoney?.buyback?.byQuarter ?? []).map((q) => q.priceUsd ?? NaN)).filter(Number.isFinite);
    return qs.length ? `${usd4(Math.min(...qs))} / ${usd4(Math.max(...qs))}` : "n/a";
  }],
  ["Buyback: share of FD offered that was bought", (rs) => range(rs.map((r) => {
    const qs = r.realMoney?.buyback?.byQuarter ?? [];
    const off = qs.reduce((s, q) => s + q.offeredFd, 0);
    return off > 0 ? qs.reduce((s, q) => s + q.boughtFd, 0) / off : NaN;
  }).filter(Number.isFinite), pct)],
  ["$ taken out per company-week: owner-operator / fleet / broker", (rs) =>
    ["oo", "fleet", "broker"].map((s) => `$${mean(rs.map((r) => r.realMoney?.usdOutPerCompanyWeek?.[s] ?? 0)).toFixed(2)}`).join(" / ")],
  ["Token: price at end ($/FD, launch $0.01)", (rs) => range(rs.map((r) => r.realMoney?.token?.price.endUsd ?? NaN).filter(Number.isFinite), usd4)],
  ["Token: lowest / highest price", (rs) => {
    const t = rs.map((r) => r.realMoney?.token).filter((x) => x);
    return t.length ? `${usd4(mean(t.map((x) => x!.price.minUsd)))} / ${usd4(mean(t.map((x) => x!.price.maxUsd)))}` : "n/a";
  }],
  ["Token: supply right after launch → end (pool included)", (rs) => {
    const t = rs.map((r) => r.realMoney?.token).filter((x) => x);
    return t.length ? `${fd(mean(t.map((x) => x!.supply.afterLaunchFd)))} → ${fd(mean(t.map((x) => x!.supply.endFd)))}` : "n/a";
  }],
  ["Token: FD held by companies at end", (rs) => range(rs.map((r) => r.realMoney?.token?.supply.companiesEndFd ?? NaN).filter(Number.isFinite), fd)],
  ["Token: launch burned / locked", (rs) => {
    const t = rs.map((r) => r.realMoney?.token).filter((x) => x);
    return t.length ? `${fd(mean(t.map((x) => x!.launch.resetBurnedFd)))} / ${fd(mean(t.map((x) => x!.launch.lockedFd)))}` : "n/a";
  }],
  ["Token: operating sinks / faucets since launch", (rs) => range(rs.map((r) => {
    const t = r.realMoney?.token;
    return t ? t.sinceLaunch.operatingSinkFd / t.sinceLaunch.operatingFaucetFd : NaN;
  }).filter(Number.isFinite), pct)],
  ["Token: burned since launch (profit tax / buyback / sell fee)", (rs) => {
    const t = rs.filter((r) => r.realMoney?.token);
    if (!t.length) return "n/a";
    // Under the cap part of the tax refills the reserve (a sink) and part burns (a burn tag): count both.
    const tax = mean(t.map((r) => (r.sinksByTag.profit_tax ?? 0) + (r.realMoney.token!.sinceLaunch.burnedByTag.profit_tax_burn ?? 0)));
    const b = mean(t.map((r) => r.realMoney.token!.sinceLaunch.burnedByTag.buyback ?? 0));
    const f = mean(t.map((r) => r.realMoney.token!.sinceLaunch.burnedByTag.exchange_fee ?? 0));
    return `${fd(tax)} / ${fd(b)} / ${fd(f)}`;
  }],
  ["Token: treasury revenue (product + fees) / to buybacks", (rs) => {
    const t = rs.map((r) => r.realMoney?.token).filter((x) => x);
    return t.length ? `$${fd(mean(t.map((x) => x!.treasury.productUsd + x!.treasury.feeUsd)))} / $${fd(mean(t.map((x) => x!.treasury.buybackUsd)))}` : "n/a";
  }],
  ["Token: pool dollars at end (seeded $250k)", (rs) => range(rs.map((r) => r.realMoney?.token?.pool.endUsd ?? NaN).filter(Number.isFinite), (x) => `$${fd(x)}`)],
  ["Token: net $ taken out — owner-operators / fleets / brokers / newcomers", (rs) => {
    const t = rs.map((r) => r.realMoney?.token).filter((x) => x);
    return t.length ? ["oo", "fleet", "broker", "new"].map((s) => `$${fd(mean(t.map((x) => x!.usdBySegment[s]?.net ?? 0)))}`).join(" / ") : "n/a";
  }],
  ["Token: airdrop minted / forfeited / haircut (of 10M)", (rs) => {
    const t = rs.map((r) => r.realMoney?.token).filter((x) => x);
    return t.length ? `${fd(mean(t.map((x) => x!.airdrop.mintedFd)))} / ${fd(mean(t.map((x) => x!.airdrop.forfeitedFd)))} / ${fd(mean(t.map((x) => x!.airdrop.haircutFd)))}` : "n/a";
  }],
  ["Token: newcomers after launch", (rs) => range(rs.map((r) => r.realMoney?.token?.newCompanies ?? NaN).filter(Number.isFinite), n0)],
  ["Free path: bought within 84 days (of all free starters)", (rs) => range(rs.map((r) => r.freePath.withinLimit), n0)],
  ["Free path median days (seeds where half bought)", (rs) => range(rs.map((r) => r.freePath.medianDays ?? NaN).filter(Number.isFinite), n0)],
  ["Top strategy vs segment median", (rs) => range(rs.map((r) => r.strategies[0]?.vsMedian ?? 0), x2)],
  // Staff, safety and fraud (config 0.9.0). Older runs have none of these fields.
  ["Crashes (fatal / at fault / willful)", (rs) => {
    const sum = (r: Run, f: (d: DayMetrics) => number | undefined) => r.daily.reduce((s, d) => s + (f(d) ?? 0), 0);
    return `${n0(mean(rs.map((r) => sum(r, (d) => d.crashes))))} (${n0(mean(rs.map((r) => sum(r, (d) => d.fatalCrashes))))} / ${n0(mean(rs.map((r) => sum(r, (d) => d.atFaultCrashes))))} / ${n0(mean(rs.map((r) => sum(r, (d) => d.willfulCrashes))))})`;
  }],
  ["Compliance reviews / unsatisfactory / shutdowns", (rs) => {
    const sum = (r: Run, f: (d: DayMetrics) => number | undefined) => r.daily.reduce((s, d) => s + (f(d) ?? 0), 0);
    return [(d: DayMetrics) => d.reviews, (d: DayMetrics) => d.unsatisfactory, (d: DayMetrics) => d.shutdowns].map((f) => n0(mean(rs.map((r) => sum(r, f))))).join(" / ");
  }],
  ["Thefts / double-brokered loads / convictions", (rs) => {
    const sum = (r: Run, f: (d: DayMetrics) => number | undefined) => r.daily.reduce((s, d) => s + (f(d) ?? 0), 0);
    return [(d: DayMetrics) => d.thefts, (d: DayMetrics) => d.doubleBrokers, (d: DayMetrics) => d.convictions].map((f) => n0(mean(rs.map((r) => sum(r, f))))).join(" / ");
  }],
  ["Carriers at end: conditional / unsat / revoked / cutting corners", (rs) =>
    [(d: DayMetrics) => d.conditionalCarriers, (d: DayMetrics) => d.unsatCarriers, (d: DayMetrics) => d.revokedCarriers, (d: DayMetrics) => d.cheatingCarriers].map((f) => n0(mean(rs.map((r) => f(r.daily.at(-1)!) ?? 0)))).join(" / ")],
  ["Fines / liability / seized / cargo claims (sinks)", (rs) => ["fines", "liability", "seized", "cargo_claim"].map((t) => fd(mean(rs.map((r) => r.sinksByTag[t] ?? 0)))).join(" / ")],
  ["Driver wages / dispatcher salaries (sinks)", (rs) => ["driver_wages", "dispatch"].map((t) => fd(mean(rs.map((r) => r.sinksByTag[t] ?? 0)))).join(" / ")],
  ["Fence payouts / cargo insurance (faucets)", (rs) => ["fence", "cargo_insurance"].map((t) => fd(mean(rs.map((r) => r.faucetsByTag?.[t] ?? 0)))).join(" / ")],
  ["Drivers employed / in pool / trucks without one, at end", (rs) =>
    [(d: DayMetrics) => d.drivers, (d: DayMetrics) => d.poolDrivers, (d: DayMetrics) => d.crewlessTrucks].map((f) => n0(mean(rs.map((r) => f(r.daily.at(-1)!) ?? 0)))).join(" / ")],
  ["Trucks without a driver, average", (rs) => range(rs.map((r) => r.daily.reduce((s, d) => s + (d.crewlessTrucks ?? 0), 0) / r.daily.length), n0)],
  ["Insurance (sink) / yard rent (sink)", (rs) => ["insurance", "yard"].map((t) => fd(mean(rs.map((r) => r.sinksByTag[t] ?? 0)))).join(" / ")],
  ["Insurance market index: low / high / end", (rs) => {
    const xs = rs.filter((r) => r.daily[0]?.insuranceIndex !== undefined).map((r) => r.daily.map((d) => d.insuranceIndex));
    if (!xs.length) return "n/a";
    return `${mean(xs.map((x) => Math.min(...x))).toFixed(2)} / ${mean(xs.map((x) => Math.max(...x))).toFixed(2)} / ${mean(xs.map((x) => x.at(-1)!)).toFixed(2)}`;
  }],
  ["Dealer price index (Workhorse + van): low / high / end", (rs) => {
    const xs = rs.filter((r) => r.daily[0]?.dealerIndex !== undefined).map((r) => r.daily.map((d) => d.dealerIndex));
    if (!xs.length) return "n/a";
    return `${mean(xs.map((x) => Math.min(...x))).toFixed(2)} / ${mean(xs.map((x) => Math.max(...x))).toFixed(2)} / ${mean(xs.map((x) => x.at(-1)!)).toFixed(2)}`;
  }],
  ["Wage index / mean employed driver skill, at end", (rs) => {
    const xs = rs.filter((r) => r.daily.at(-1)!.wageIndex !== undefined);
    return xs.length ? `${mean(xs.map((r) => r.daily.at(-1)!.wageIndex)).toFixed(2)} / ${mean(xs.map((r) => r.daily.at(-1)!.avgDriverSkill)).toFixed(2)}` : "n/a";
  }],
);

console.log(`| Measure | ${dirs.join(" | ")} |`);
console.log(`|---|${dirs.map(() => "---").join("|")}|`);
for (const [label, f] of rows) console.log(`| ${label} | ${runs.map((rs) => f(rs)).join(" | ")} |`);
