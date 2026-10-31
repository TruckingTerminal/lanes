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
type Valuation = NonNullable<NonNullable<Run["realMoney"]>["token"]>["valuation"];
// The burns that leave the circular economy's cap for good (ledger CIRCULAR_BURNS); a launch reset refills the reserve instead.
const CAP_BURNS = ["season_close", "buyback", "exchange_fee", "airdrop_forfeit", "unstake_haircut", "profit_tax_burn", "asset_burn"];
/** Market cap and FDV: the report's own, or for reports written before them, from the daily price, supply, locked FD and burns. */
const valuationOf = (r: Run): Valuation | null => {
  const tk = r.realMoney?.token;
  if (!tk) return null;
  if (tk.valuation) return tk.valuation;
  const cap = 1_000_000_000;
  let burned = 0;
  const pts = r.daily.map((d) => {
    for (const k of CAP_BURNS) burned += (d.burnByTag as Record<string, number> | undefined)?.[k] ?? 0;
    const circulating = Math.max(0, d.supplyFd - (d.lockedFd ?? 0));
    const total = cap - burned;
    return { day: d.day, price: d.priceUsd, circulating, total };
  });
  const live = pts.filter((p) => p.day >= tk.launchDay);
  const first = live[0] ?? pts.at(-1)!;
  const end = pts.at(-1)!;
  return {
    launch: { marketCapUsd: tk.price.launchUsd * first.circulating, fdvUsd: tk.price.launchUsd * first.total, circulatingFd: first.circulating, totalSupplyFd: first.total },
    end: { marketCapUsd: end.price * end.circulating, fdvUsd: end.price * end.total, circulatingFd: end.circulating, totalSupplyFd: end.total },
    peakMarketCapUsd: Math.max(0, ...live.map((p) => p.price * p.circulating)),
    peakFdvUsd: Math.max(0, ...live.map((p) => p.price * p.total)),
  };
};
/** The player share of markets: the report's own, or for reports written before it existed, what the daily data and the sinks give (no insurance). */
const share = (r: Run): { newTrucks: number; shopWork: number; freight: number } => {
  if (r.playerShare) return r.playerShare;
  const sumD = (k: keyof DayMetrics) => r.daily.reduce((s, d) => s + (((d as unknown as Record<string, number>)[k as string]) ?? 0), 0);
  const orders = sumD("ordersPlaced");
  const shopList = (r.sinksByTag.parts ?? 0) / 0.7;
  const npcShop = (r.sinksByTag.maintenance ?? 0) + (r.sinksByTag.repairs ?? 0) + (r.sinksByTag.rebuild ?? 0) + (r.sinksByTag.road_service ?? 0);
  const posted = sumD("posted");
  return { newTrucks: orders > 0 ? sumD("dealershipSales") / orders : 0, shopWork: shopList + npcShop > 0 ? shopList / (shopList + npcShop) : 0, freight: posted > 0 ? sumD("facilityPosted") / posted : 0 };
};
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
  ["Fuel tax paid, IFTA-style (sink)", (rs) => range(rs.map((r) => r.sinksByTag.fuel_tax ?? 0), fd)],
  ["Sales tax paid (sink)", (rs) => range(rs.map((r) => r.sinksByTag.sales_tax ?? 0), fd)],
  ["Managers' pay (sink)", (rs) => range(rs.map((r) => r.sinksByTag.management ?? 0), fd)],
  ["Businesses: upkeep / parts (sinks)", (rs) => `${fd(mean(rs.map((r) => r.sinksByTag.business_upkeep ?? 0)))} / ${fd(mean(rs.map((r) => r.sinksByTag.parts ?? 0)))}`],
  ["Businesses open at end: shops / truck stops / fuel stations (owners' FD per business-year, purchase included)", (rs) => {
    const k = (kind: string) => `${Math.round(mean(rs.map((r) => r.businesses?.[kind]?.open ?? 0)))} (${fd(mean(rs.map((r) => r.businesses?.[kind]?.netFdPerYear ?? 0)))})`;
    return `${k("shop")} / ${k("truckStop")} / ${k("fuelStation")}`;
  }],
  ["Businesses: the trade alone per business-year, shops / truck stops / fuel stations (average purchase)", (rs) => {
    const k = (kind: string) => `${fd(mean(rs.map((r) => r.businesses?.[kind]?.tradeFdPerYear ?? 0)))} (${fd(mean(rs.map((r) => r.businesses?.[kind]?.purchaseFd ?? 0)))})`;
    return `${k("shop")} / ${k("truckStop")} / ${k("fuelStation")}`;
  }],
  ["Legs held by a winter pass closure", (rs) => range(rs.map((r) => r.wear.passClosures ?? 0), n0)],
  ["Dock waits / hours per wait / missed appointment slots", (rs) => {
    const waits = mean(rs.map((r) => r.operations?.dockWaits ?? 0));
    const hours = mean(rs.map((r) => r.operations?.dockWaitHours ?? 0));
    return `${n0(waits)} / ${waits > 0 ? (hours / waits).toFixed(1) : "0"} / ${n0(mean(rs.map((r) => r.operations?.missedSlots ?? 0)))}`;
  }],
  ["Cargo thefts / cargo value stolen / flatbed damage claims", (rs) => `${n0(mean(rs.map((r) => r.operations?.cargoThefts ?? 0)))} / ${fd(mean(rs.map((r) => r.operations?.cargoTheftFd ?? 0)))} / ${n0(mean(rs.map((r) => r.operations?.flatbedDamage ?? 0)))}`],
  ["Reefer unit fuel (sink)", (rs) => range(rs.map((r) => r.sinksByTag.reefer_fuel ?? 0), fd)],
  // Assets and destruction (the EVE plan, step 4): the bar is new equipment at 15% or more of all sinks.
  ["Robbery: crews hired / hits / rigs chopped", (rs) => `${n0(mean(rs.map((r) => r.robbery?.hires ?? 0)))} / ${n0(mean(rs.map((r) => r.robbery?.hits ?? 0)))} / ${n0(mean(rs.map((r) => r.robbery?.rigsTaken ?? 0)))}`],
  ["Robbery: cargo taken / paid to hirers / crew fees / security fittings bought", (rs) => `${fd(mean(rs.map((r) => r.robbery?.cargoTakenFd ?? 0)))} / ${fd(mean(rs.map((r) => r.robbery?.takePaidFd ?? 0)))} / ${fd(mean(rs.map((r) => r.robbery?.feesFd ?? 0)))} / ${fd(mean(rs.map((r) => r.robbery?.fittingsFd ?? 0)))}`],
  ["Leases by value: NPC lease deposits held at end", (rs) => range(rs.map((r) => r.truckMoney?.leaseDepositsEndFd ?? 0), fd)],
  ["Purchase loans: made / still owed at end (open loans)", (rs) => `${fd(mean(rs.map((r) => r.truckMoney?.loansMadeFd ?? 0)))} / ${fd(mean(rs.map((r) => r.truckMoney?.loansOwedEndFd ?? 0)))} (${n0(mean(rs.map((r) => r.truckMoney?.loansOpenEnd ?? 0)))})`],
  ["Purchase loans: interest / defaults / trucks taken back / stakes slashed / written off", (rs) => `${fd(mean(rs.map((r) => r.truckMoney?.interestFd ?? 0)))} / ${n0(mean(rs.map((r) => r.truckMoney?.defaults ?? 0)))} / ${n0(mean(rs.map((r) => r.truckMoney?.seized ?? 0)))} / ${fd(mean(rs.map((r) => r.truckMoney?.stakeSlashedFd ?? 0)))} / ${fd(mean(rs.map((r) => r.truckMoney?.writtenOffFd ?? 0)))}`],
  ["Assets: new equipment bought / its share of all sinks (bar: 15%+)", (rs) => `${fd(mean(rs.map((r) => r.assets?.newEquipmentFd ?? 0)))} / ${pct(mean(rs.map((r) => r.assets?.newEquipmentShareOfSinks ?? 0)))} (${pct(Math.min(...rs.map((r) => r.assets?.newEquipmentShareOfSinks ?? 0)))}–${pct(Math.max(...rs.map((r) => r.assets?.newEquipmentShareOfSinks ?? 0)))})`],
  ["Assets: all equipment costs (new, NPC lease share, trailer rent, rebuilds) / share of sinks", (rs) => `${fd(mean(rs.map((r) => r.assets?.allEquipmentFd ?? 0)))} / ${pct(mean(rs.map((r) => r.assets?.allEquipmentShareOfSinks ?? 0)))}`],
  ["Player share: new trucks / shop work / insurance / freight (EVE bar: players make most of it)", (rs) => `${pct(mean(rs.map((r) => share(r).newTrucks)))} / ${pct(mean(rs.map((r) => share(r).shopWork)))} / ${rs.some((r) => r.playerShare) ? pct(mean(rs.map((r) => r.playerShare?.insurance ?? 0))) : "n/a"} / ${pct(mean(rs.map((r) => share(r).freight)))}`],
  ["Assets: tractors / trailers scrapped, rigs written off, trailers stolen from yards", (rs) => `${n0(mean(rs.map((r) => r.assets?.scrappedTractors ?? 0)))} / ${n0(mean(rs.map((r) => r.assets?.scrappedTrailers ?? 0)))} / ${n0(mean(rs.map((r) => r.assets?.totalLosses ?? 0)))} / ${n0(mean(rs.map((r) => r.assets?.yardThefts ?? 0)))}`],
  ["Assets: factory built tractors / trailers; sold by player dealerships (FD)", (rs) => `${n0(mean(rs.map((r) => r.assets?.factoryTractors ?? 0)))} / ${n0(mean(rs.map((r) => r.assets?.factoryTrailers ?? 0)))}; ${n0(mean(rs.map((r) => r.assets?.dealershipSales ?? 0)))} (${fd(mean(rs.map((r) => r.assets?.dealershipSalesFd ?? 0)))})`],
  ["Assets: trade-ins / player leases taken / businesses, facilities and yards resold", (rs) => `${n0(mean(rs.map((r) => r.assets?.tradeIns ?? 0)))} / ${n0(mean(rs.map((r) => r.assets?.playerLeases ?? 0)))} / ${n0(mean(rs.map((r) => r.assets?.assetSales ?? 0)))}`],
  ["Assets: owned trailers / rentals out / tractors on lease, at end; swaps and refurbishments", (rs) => `${n0(mean(rs.map((r) => r.assets?.ownedTrailersEnd ?? 0)))} / ${n0(mean(rs.map((r) => r.assets?.rentalsOutEnd ?? 0)))} / ${n0(mean(rs.map((r) => r.assets?.leasedOutEnd ?? 0)))}; ${n0(mean(rs.map((r) => r.assets?.trailerSwaps ?? 0)))} / ${n0(mean(rs.map((r) => r.assets?.refurbs ?? 0)))}`],
  ["Nights at a site / on the shoulder / shoulder tickets / sites found full", (rs) => `${n0(mean(rs.map((r) => r.parking?.siteNights ?? 0)))} / ${n0(mean(rs.map((r) => r.parking?.shoulderNights ?? 0)))} / ${n0(mean(rs.map((r) => r.parking?.tickets ?? 0)))} / ${n0(mean(rs.map((r) => r.parking?.sitesFull ?? 0)))}`],
  ["Breakdowns served by truck stops / hub shops / NPC road service", (rs) => `${Math.round(mean(rs.map((r) => r.wear.roadService?.stop ?? 0)))} / ${Math.round(mean(rs.map((r) => r.wear.roadService?.hub ?? 0)))} / ${Math.round(mean(rs.map((r) => r.wear.roadService?.npc ?? 0)))}`],
  ["Shops, NPC: maintenance / repairs / rebuilds (sinks)", (rs) => `${fd(mean(rs.map((r) => r.sinksByTag.maintenance ?? 0)))} / ${fd(mean(rs.map((r) => r.sinksByTag.repairs ?? 0)))} / ${fd(mean(rs.map((r) => r.sinksByTag.rebuild ?? 0)))}`],
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
  ["Token: price at launch → end ($/FD)", (rs) => {
    const t = rs.map((r) => r.realMoney?.token).filter((x) => x);
    return t.length ? `${usd4(mean(t.map((x) => x!.price.launchUsd)))} → ${range(t.map((x) => x!.price.endUsd), usd4)}` : "n/a";
  }],
  ["Token: seeds that hold the launch price / whose pool dollars grew", (rs) => {
    const t = rs.map((r) => r.realMoney?.token).filter((x) => x);
    return t.length ? `${t.filter((x) => x!.gates?.holdsLaunchPrice).length}/${t.length} / ${t.filter((x) => x!.gates?.poolDollarsGrew).length}/${t.length}` : "n/a";
  }],
  ["Token: new buying that holds the end price ($ per 1,000 companies a month)", (rs) => range(rs.map((r) => r.realMoney?.token?.demand?.usdPerThousandCompaniesMonth ?? NaN).filter(Number.isFinite), (x) => `$${fd(x)}`)],
  ["Token: FD sold into the pool net of buys, per month", (rs) => range(rs.map((r) => r.realMoney?.token?.demand?.netSoldFdPerMonth ?? NaN).filter(Number.isFinite), fd)],
  // Market cap = price × circulating FD; FDV = price × the cap less burns (Jeff, 2026-10-31).
  ["Token: market cap at launch → end (peak)", (rs) => {
    const v = rs.map(valuationOf).filter((x): x is Valuation => !!x);
    if (!v.length) return "n/a";
    return `$${fd(mean(v.map((x) => x.launch.marketCapUsd)))} → $${fd(mean(v.map((x) => x.end.marketCapUsd)))} (peak $${fd(mean(v.map((x) => x.peakMarketCapUsd)))})`;
  }],
  ["Token: FDV at launch → end (peak); circulating share of total at end", (rs) => {
    const v = rs.map(valuationOf).filter((x): x is Valuation => !!x);
    if (!v.length) return "n/a";
    return `$${fd(mean(v.map((x) => x.launch.fdvUsd)))} → $${fd(mean(v.map((x) => x.end.fdvUsd)))} (peak $${fd(mean(v.map((x) => x.peakFdvUsd)))}); ${pct(mean(v.map((x) => (x.end.totalSupplyFd > 0 ? x.end.circulatingFd / x.end.totalSupplyFd : 0))))}`;
  }],
  ["Token: lowest / highest price", (rs) => {
    const t = rs.map((r) => r.realMoney?.token).filter((x) => x);
    return t.length ? `${usd4(mean(t.map((x) => x!.price.minUsd)))} / ${usd4(mean(t.map((x) => x!.price.maxUsd)))}` : "n/a";
  }],
  ["Token: supply right after launch → end (pool included)", (rs) => {
    const t = rs.map((r) => r.realMoney?.token).filter((x) => x);
    return t.length ? `${fd(mean(t.map((x) => x!.supply.afterLaunchFd)))} → ${fd(mean(t.map((x) => x!.supply.endFd)))}` : "n/a";
  }],
  ["Token: growth of FD outstanding, launch → end", (rs) => range(rs.map((r) => {
    const s = r.realMoney?.token?.supply;
    return s && s.afterLaunchFd > 0 ? s.endFd / s.afterLaunchFd - 1 : NaN;
  }).filter(Number.isFinite), pct)],
  // The supply ceiling (Jeff, 2026-10-31: "complete supply control").
  ["Supply ceiling: growth allowed; outstanding at end vs the path", (rs) => {
    const c = rs.map((r) => r.realMoney?.token?.ceiling).filter((x) => x);
    return c.length ? `${pct(c[0]!.growth)} over ${c[0]!.overDays} days; ${fd(mean(c.map((x) => x!.endFd)))} vs ${fd(mean(c.map((x) => x!.endCeilingFd)))}` : "off";
  }],
  ["Supply ceiling: worst day over the path / days over", (rs) => {
    const c = rs.map((r) => r.realMoney?.token?.ceiling).filter((x) => x);
    return c.length ? `${(mean(c.map((x) => x!.maxOverShare)) * 100).toFixed(1)}% / ${n0(mean(c.map((x) => x!.daysOver)))}` : "off";
  }],
  ["Supply ceiling: weeks the payouts waited / weeks the dial sat at its floor / vest weeks held", (rs) => {
    const c = rs.map((r) => r.realMoney?.token?.ceiling).filter((x) => x);
    return c.length ? `${n0(mean(c.map((x) => x!.weeksHolding)))} / ${n0(mean(c.map((x) => x!.weeksAtFloor)))} / ${n0(mean(c.map((x) => x!.vestHeldWeeks)))}` : "off";
  }],
  ["Supply ceiling: airdrop queued (peak / at end) and paid back out", (rs) => {
    const c = rs.map((r) => r.realMoney?.token?.ceiling).filter((x) => x);
    return c.length ? `${fd(mean(c.map((x) => x!.queuedPeakFd)))} / ${fd(mean(c.map((x) => x!.queuedEndFd)))}; ${fd(mean(c.map((x) => x!.releasedFd)))}` : "off";
  }],
  ["Balance dial: NPC rate multiplier, lowest / at end", (rs) => {
    const c = rs.map((r) => r.realMoney?.token?.ceiling).filter((x) => x);
    if (c.length) return `${mean(c.map((x) => x!.rateMultMin)).toFixed(2)} / ${mean(c.map((x) => x!.rateMultEnd)).toFixed(2)}`;
    const m = rs.map((r) => r.daily.at(-1)?.rateMult).filter((x): x is number => typeof x === "number");
    return m.length ? `n/a / ${mean(m).toFixed(2)}` : "n/a";
  }],
  // The daily price band (Jeff, 2026-10-31: ±15% a day for the first three real months).
  ["Price band: width / trades clipped / biggest day's move in its days", (rs) => {
    const b = rs.map((r) => r.realMoney?.token?.band).filter((x) => x);
    return b.length ? `±${pct(b[0]!.pct)} / ${n0(mean(b.map((x) => x!.clips)))} / ${(mean(b.map((x) => x!.maxDayMove)) * 100).toFixed(1)}%` : "off";
  }],
  // The airdrop logbook (Jeff, 2026-10-31: 1% at launch, the rest only for milestones).
  ["Logbook: paid at launch / by honest milestones / by criminal / still locked at end", (rs) => {
    const b = rs.map((r) => r.realMoney?.token?.logbook).filter((x) => x);
    return b.length ? `${fd(mean(b.map((x) => x!.openFd)))} / ${fd(mean(b.map((x) => x!.honestFd)))} / ${fd(mean(b.map((x) => x!.criminalFd)))} / ${fd(mean(b.map((x) => x!.lockedEndFd)))}` : "off";
  }],
  ["Logbook: forfeited on conviction / median share of an allocation unlocked / books", (rs) => {
    const b = rs.map((r) => r.realMoney?.token?.logbook).filter((x) => x);
    return b.length ? `${fd(mean(b.map((x) => x!.convictedFd)))} / ${pct(mean(b.map((x) => x!.medianUnlockedShare)))} / ${n0(mean(b.map((x) => x!.books)))}` : "off";
  }],
  ["Logbook: companies reaching each milestone", (rs) => {
    const b = rs.map((r) => r.realMoney?.token?.logbook).filter((x) => x);
    if (!b.length) return "off";
    const ids = [...new Set(b.flatMap((x) => Object.keys(x!.reached)))];
    return ids.map((id) => `${id} ${n0(mean(b.map((x) => x!.reached[id] ?? 0)))}`).join(", ") || "none";
  }],
  // The unlock ladder (Jeff, 2026-10-31).
  ["Unlock ladder: days after launch businesses / re-brokering / crews opened", (rs) => {
    const l = rs.map((r) => r.realMoney?.token?.ladder).filter((x) => x);
    return l.length ? ["businesses", "brokerage", "robbery"].map((k) => { const d = l.map((x) => x![k]).filter((v): v is number => typeof v === "number"); return d.length ? n0(mean(d)) : "closed"; }).join(" / ") : "off";
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
  ["Token: worst drawdown from a peak / pool dollars at their peak", (rs) => {
    const t = rs.map((r) => r.realMoney?.token).filter((x) => x);
    return t.length ? `${Math.round(mean(t.map((x) => x!.price.maxDrawdown ?? 0)) * 100)}% / $${fd(mean(t.map((x) => x!.pool.peakUsd ?? 0)))}` : "n/a";
  }],
  ["Token: net $ taken out — farmers / sybils / speculators (momentum, crowd, whale)", (rs) => {
    const t = rs.map((r) => r.realMoney?.token).filter((x) => x);
    return t.length ? ["farm", "sybil", "spec"].map((s) => `$${fd(mean(t.map((x) => x!.usdBySegment[s]?.net ?? 0)))}`).join(" / ") : "n/a";
  }],
  ["Token: pool dollars at launch → end", (rs) => {
    const t = rs.map((r) => r.realMoney?.token).filter((x) => x);
    return t.length ? `$${fd(mean(t.map((x) => x!.treasury.seedUsd)))} → ${range(t.map((x) => x!.pool.endUsd), (x) => `$${fd(x)}`)}` : "n/a";
  }],
  ["Token: developer's vest — FD sold into the pool / dollars taken", (rs) => {
    const t = rs.map((r) => r.realMoney?.token).filter((x) => x);
    return t.length ? `${fd(mean(t.map((x) => x!.treasury.vestedFd ?? 0)))} / $${fd(mean(t.map((x) => x!.treasury.devUsd ?? 0)))}` : "n/a";
  }],
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
