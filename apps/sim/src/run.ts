import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { economyConfig, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds, syntheticCassCycle } from "@lanes/data";
import { buildReport, createWorld, runDays, type RunReport } from "@lanes/engine";
import { populate, ruleBotHook } from "@lanes/agents";

// Sim mode runner: rule-bot world, as fast as the machine allows.
//   npm run sim -- --seeds 1,2,3,4,5,6,7,8,9,10 --quiet     (--seeds is a comma list: "--seeds 10" runs seed 10 only)
//   npm run sim -- --seasons off --cycle on --days 1095 --out runs/no-seasons
// Two seasons by default, so every run includes a season close and a
// season-over-season supply comparison. Default population: free owner-operators
// are one carrier persona among several (§AI-agent simulation — persona mix).
const { values } = parseArgs({
  options: {
    days: { type: "string", default: "730" },
    seeds: { type: "string", default: "1" },
    oo: { type: "string", default: "400" },
    fleets: { type: "string", default: "120" },
    brokers: { type: "string", default: "60" },
    out: { type: "string", default: "runs" },
    quiet: { type: "boolean", default: false },
    seasons: { type: "string", default: "on" },
    cycle: { type: "string", default: "on" },
    "holding-rate": { type: "string" },
    // Any config value by path, repeatable: --set freeEntry.leases.enabled=false
    set: { type: "string", multiple: true, default: [] },
  },
});

// Seasons off: no lock, no burn, no Miles reset — the economy runs continuously.
const seasonsCfg: EconomyConfig =
  values.seasons === "off" ? { ...economyConfig, seasonClose: { ...economyConfig.seasonClose, enabled: false } } : economyConfig;
// --holding-rate overrides the weekly holding cost on excess cash (sensitivity runs).
const holdingCfg: EconomyConfig = values["holding-rate"]
  ? { ...seasonsCfg, holdingCost: { ...seasonsCfg.holdingCost, weeklyRate: Number(values["holding-rate"]) } }
  : seasonsCfg;
const cfg = applyOverrides(holdingCfg, values.set ?? []);

/** Copies the config and sets each `a.b.c=value` (numbers, booleans, or JSON arrays). */
function applyOverrides(base: EconomyConfig, sets: string[]): EconomyConfig {
  if (sets.length === 0) return base;
  const out = structuredClone(base) as Record<string, unknown>;
  for (const s of sets) {
    const eq = s.indexOf("=");
    if (eq < 0) throw new Error(`--set ${s}: expected path=value`);
    const path = s.slice(0, eq);
    const raw = s.slice(eq + 1);
    const keys = path.split(".");
    let node = out;
    for (const k of keys.slice(0, -1)) {
      if (typeof node[k] !== "object" || node[k] === null) throw new Error(`--set ${path}: no such config path`);
      node = node[k] as Record<string, unknown>;
    }
    const last = keys.at(-1)!;
    if (!(last in node)) throw new Error(`--set ${path}: no such config value`);
    node[last] = raw === "true" ? true : raw === "false" ? false : raw.startsWith("[") ? JSON.parse(raw) : Number.isNaN(Number(raw)) ? raw : Number(raw);
  }
  return out as unknown as EconomyConfig;
}

const days = Number(values.days);
const seeds = values.seeds!.split(",").map(Number);
// The network bakes in map and base-rate settings, so it's built from the overridden config too.
const net = buildNetwork(hubs, cfg);
mkdirSync(values.out!, { recursive: true });

console.log(
  `LANES sim · config ${economyConfig.version} · ${hubs.length} hubs · ${net.lanes.length} lanes · ${days} days` +
    ` · seasons ${values.seasons} · cycle ${values.cycle}` +
    (values.set!.length ? ` · ${values.set!.join(" ")}` : ""),
);
const reports: RunReport[] = [];
for (const seed of seeds) {
  const started = performance.now();
  const feeds = values.cycle === "off" ? neutralFeeds : { ...neutralFeeds, cycle: syntheticCassCycle({ seed }) };
  const w = createWorld({ cfg, net, feeds, seed });
  populate(w, { freeOwnerOperators: Number(values.oo), fleets: Number(values.fleets), brokers: Number(values.brokers) });
  runDays(w, days, ruleBotHook, (m) => {
    if (values.quiet || (m.day + 1) % 30 !== 0) return;
    console.log(
      `  seed ${seed} day ${String(m.day + 1).padStart(3)} · supply ${fd(m.supplyFd)} · in ${fd(m.faucetFd)}/d out ${fd(m.sinkFd)}/d` +
        ` · cleared ${m.cleared}/${m.posted} (fac ${m.facilityPosted}) · ${m.avgClearedRate.toFixed(2)}/mi · margin ${m.avgMarginPct.toFixed(1)}%` +
        ` · owned ${m.ownedTrucks} cond ${m.avgOwnedCondition.toFixed(2)} · cycle ${m.cycle.toFixed(2)} · on order ${m.ordersPending}` +
        ` · loans ${fd(m.loansOutstandingFd)} · vol×${m.volumeMult.toFixed(2)} · leased ${m.leasedTrucks}/${m.lessorFleet} · cap ${m.tractorCap}`,
    );
  });
  const report = buildReport(w);
  reports.push(report);
  const secs = ((performance.now() - started) / 1000).toFixed(1);
  writeFileSync(`${values.out}/report-seed${seed}.json`, JSON.stringify({ report, days: w.metrics.days }, null, 2));
  if (values.quiet) printSummaryLine(report, secs);
  else printReport(report, secs);
}
if (reports.length > 1) printAcrossSeeds(reports);
const passed = reports.filter((r) => r.pass).length;
console.log(`\n${passed}/${reports.length} seeds pass every kill criterion.`);


function printReport(r: RunReport, secs: string): void {
  const mark = (ok: boolean) => (ok ? "PASS" : "FAIL");
  console.log(`\n== Seed ${r.seed} · ${r.days} days · ${r.companies} companies · ${r.trucks} trucks · ${secs}s ==`);
  for (const q of r.quarters) {
    console.log(`  ${q.label} operating sinks/faucets ${(q.sinkFaucetRatio * 100).toFixed(1)}%  (in ${fd(q.faucetFd)}, out ${fd(q.sinkFd)})  ${mark(q.pass)}`);
  }
  for (const s of r.seasons) {
    if (s.burnedFd !== null) {
      console.log(`  Season ${s.season} close: burned ${fd(s.burnedFd)} (supply ${fd(s.supplyBeforeCloseFd!)} → ${fd(s.supplyAfterCloseFd!)}), ${s.companiesAtCarryoverCap} companies at the 25k carryover cap; season sinks incl. burn ${pct(s.ratioWithBurn ?? 0)} of faucets`);
    }
  }
  const sp = r.supply;
  console.log(
    `  FD supply: after warm-up ${sp.afterWarmup.toFixed(2)}×, season over season ${sp.yearOverYear?.toFixed(2) ?? "n/a"}×  ${mark(sp.pass)}` +
      `  (vs. grants ${sp.fromGrants.toFixed(1)}×, informational)`,
  );
  for (const s of r.strategies) console.log(`  Strategy ${s.segment}:${s.strategy} (${s.companies}): ${s.vsMedian.toFixed(2)}× segment median Miles/hour`);
  console.log(`  Strategy balance (≤3× within segment): ${mark(r.strategyPass)}; best vs. all carriers ${r.crossSegmentTop.toFixed(1)}×`);
  const f = r.freePath;
  console.log(`  Free path: ${f.bought}/${f.companies} bought a truck, ${f.withinLimit} within 84 days, median ${f.medianDays ?? "n/a"} days  ${mark(f.pass)}`);
  console.log(`    could afford one: ${f.affordWithinLimit}/${f.companies} within 84 days, median ${f.medianAffordDays ?? "n/a"} days`);
  console.log(`  Board: fill ${pct(r.board.fillRate)}, expired unhauled ${r.board.expired}, avg ${r.board.avgClearedRate.toFixed(2)}/mi, on-time ${pct(r.board.onTimeShare)}`);
  console.log(`  Wear: ${r.wear.rebuilds} rebuilds, ${r.wear.breakdowns} breakdowns, owned fleet condition ${r.wear.avgOwnedCondition.toFixed(2)}`);
  console.log(`  Facilities: ${JSON.stringify(r.facilities.owned)} owned by ${JSON.stringify(r.facilities.ownersBySegment)}, ${pct(r.facilities.loadShare)} of loads`);
  const nets = Object.entries(r.facilities.weeklyNetByType).map(([t, v]) => `${t} ${fd(v)}`).join(", ");
  console.log(`    owners' net per facility-week after upkeep: ${nets || "n/a"}`);
  for (const [seg, c] of Object.entries(r.carriersBySegment)) {
    console.log(
      `  ${seg}: ${c.companies} companies, ${c.trucks} trucks · overhead ${fd(c.overheadFd)} paid by ${c.payingOverhead}` +
        ` · profit/truck-week ${fd(c.profitPerTruckWeek)} → ${fd(c.afterOverheadPerTruckWeek)} after overhead`,
    );
  }
  for (const y of r.inflation.years) {
    console.log(`  Year ${y.year}: supply before close ${fd(y.preCloseFd)}${y.growthVsPriorYear ? ` (${y.growthVsPriorYear.toFixed(2)}× prior year)` : ""}, year end ${fd(y.yearEndFd)}, avg rate ${y.avgRate.toFixed(2)}/mi`);
  }
  const wl = r.wealth;
  console.log(`  Wealth: Gini ${wl.gini.toFixed(2)}, top 1% ${pct(wl.top1Share)}, top 10% ${pct(wl.top10Share)}, Miles Gini ${wl.milesGini.toFixed(2)} · avg ${Object.entries(wl.avgBySegment).map(([k, v]) => `${k} ${fd(v)}`).join(", ")}`);
  const fl = r.failures;
  console.log(`  Failures: ${fl.repossessions} repossessions at ${fl.companiesRepossessed} companies, ${fl.wipedOut} wiped out, ${fl.inDebtAtEnd} in debt (${fd(fl.debtFd)}), pool wrote off ${fd(fl.writtenOffFd)}`);
  console.log(`    ${fl.bankruptcies} liquidations at ${fl.companiesBankrupt} companies ${JSON.stringify(fl.bankruptBySegment)}, debt written off ${fd(fl.debtWrittenOffFd)}, ${fl.shipperDefaults} shipper defaults`);
  const fi = r.finance;
  console.log(`  Equipment Finance: ${fi.loansMade} loans, interest ${fd(fi.interestPaidFd)}, peak owed ${fd(fi.peakOutstandingFd)}, ${fi.depositors} depositors · used sales ${r.usedMarket.sales}, repos back to dealer ${r.usedMarket.repoReturnedToDealer}`);
  for (const q of r.cycleQuarters) {
    console.log(`    ${q.label} cycle ${q.cycle.toFixed(2)} · rate ${q.avgRate.toFixed(2)} · ordered ${q.ordersPlaced} delivered ${q.trucksDelivered} · repos ${q.repossessions} · used sales ${q.usedSales} · sinks ${pct(q.sinkFaucetRatio)}`);
  }
  console.log(`  Overall: ${mark(r.pass)}`);
}

function printSummaryLine(r: RunReport, secs: string): void {
  const q = r.quarters.map((x) => `${(x.sinkFaucetRatio * 100).toFixed(0)}${x.pass ? "" : "!"}`).join(" ");
  const top = r.strategies[0];
  const f = r.freePath;
  const burn = r.seasons.find((s) => s.burnedFd !== null)?.burnedFd;
  console.log(
    `seed ${String(r.seed).padStart(2)} · ops sinks % ${q} · burn ${burn == null ? "n/a" : fd(burn)}` +
      ` · supply warm ${r.supply.afterWarmup.toFixed(1)}× yoy ${r.supply.yearOverYear?.toFixed(1) ?? "n/a"}×${r.supply.pass ? "" : "!"}` +
      ` · top ${top?.segment}:${top?.strategy} ${top?.vsMedian.toFixed(2)}×${r.strategyPass ? "" : "!"}` +
      ` · free median ${f.medianDays ?? "n/a"}d${f.pass ? "" : "!"} (${f.withinLimit}/${f.companies})` +
      ` · fac ${r.facilities.owned ? Object.values(r.facilities.owned).reduce((a, b) => a + b, 0) : 0} · ${secs}s`,
  );
  const t = r.realMoney.token;
  if (t) {
    const net = Object.entries(t.usdBySegment).map(([k, v]) => `${k} ${usd(v.net)}`).join(" ");
    console.log(
      `        token: price $${t.price.launchUsd} → $${t.price.endUsd.toPrecision(2)} (low $${t.price.minUsd.toPrecision(2)}, high $${t.price.maxUsd.toPrecision(2)})` +
        ` · supply ${fd(t.supply.afterLaunchFd)} → ${fd(t.supply.endFd)} (companies ${fd(t.supply.companiesEndFd)}, pool ${fd(t.supply.poolEndFd)})` +
        ` · ops sinks ${pct(t.sinceLaunch.operatingSinkFd / t.sinceLaunch.operatingFaucetFd)} since launch · buyback ${usd(t.treasury.buybackUsd)} → ${fd(t.treasury.buybackFd)} FD` +
        ` · pool ${usd(t.pool.endUsd)} · net $ out: ${net} · newcomers ${t.newCompanies}`,
    );
  }
}

function usd(x: number): string {
  return `${x < 0 ? "-" : ""}$${fd(Math.abs(x))}`;
}

function printAcrossSeeds(rs: RunReport[]): void {
  const stat = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return { min: s[0]!, mean: xs.reduce((a, b) => a + b, 0) / xs.length, max: s.at(-1)! };
  };
  const fmt = (x: { min: number; mean: number; max: number }, f: (n: number) => string) => `${f(x.mean)} (${f(x.min)}–${f(x.max)})`;
  console.log(`\n== Across ${rs.length} seeds: mean (min–max) ==`);
  for (const label of rs[0]!.quarters.map((q) => q.label)) {
    const vals = rs.map((r) => r.quarters.find((q) => q.label === label)?.sinkFaucetRatio ?? NaN).filter((x) => !Number.isNaN(x));
    const faucets = rs.map((r) => r.quarters.find((q) => q.label === label)?.faucetFd ?? 0);
    console.log(`  ${label} operating sinks/faucets ${fmt(stat(vals), pct)} · faucets ${fd(stat(faucets).mean)}`);
  }
  for (const s of rs[0]!.seasons.filter((x) => x.burnedFd !== null)) {
    const burns = rs.map((r) => r.seasons[s.season - 1]!.burnedFd ?? 0);
    const before = rs.map((r) => r.seasons[s.season - 1]!.supplyBeforeCloseFd ?? 0);
    const after = rs.map((r) => r.seasons[s.season - 1]!.supplyAfterCloseFd ?? 0);
    const withBurn = rs.map((r) => r.seasons[s.season - 1]!.ratioWithBurn ?? 0);
    console.log(`  Season ${s.season} close: supply ${fmt(stat(before), fd)} → ${fmt(stat(after), fd)}, burned ${fmt(stat(burns), fd)}`);
    console.log(`  Season ${s.season} sinks incl. burn / faucets ${fmt(stat(withBurn), pct)}`);
  }
  console.log(`  Supply vs. grants (literal) ${fmt(stat(rs.map((r) => r.supply.fromGrants)), (x) => `${x.toFixed(1)}×`)}`);
  console.log(`  Supply growth after warm-up ${fmt(stat(rs.map((r) => r.supply.afterWarmup)), (x) => `${x.toFixed(2)}×`)}`);
  const yoy = rs.map((r) => r.supply.yearOverYear).filter((x): x is number => x !== null);
  if (yoy.length) console.log(`  Supply season over season ${fmt(stat(yoy), (x) => `${x.toFixed(2)}×`)}`);
  for (const seg of Object.keys(rs[0]!.carriersBySegment)) {
    const get = (r: RunReport) => r.carriersBySegment[seg]!;
    console.log(
      `  ${seg}: overhead paid ${fmt(stat(rs.map((r) => get(r).overheadFd)), fd)} by ${fmt(stat(rs.map((r) => get(r).payingOverhead)), (x) => x.toFixed(0))} companies` +
        ` · profit/truck-week ${fmt(stat(rs.map((r) => get(r).profitPerTruckWeek)), fd)} → ${fmt(stat(rs.map((r) => get(r).afterOverheadPerTruckWeek)), fd)} after overhead` +
        ` · trucks ${fmt(stat(rs.map((r) => get(r).trucks)), (x) => x.toFixed(0))}`,
    );
  }
  for (let y = 0; y < rs[0]!.inflation.years.length; y++) {
    const get = (r: RunReport) => r.inflation.years[y]!;
    const growth = rs.map((r) => get(r).growthVsPriorYear).filter((x): x is number => x !== null);
    console.log(
      `  Year ${y + 1}: supply before close ${fmt(stat(rs.map((r) => get(r).preCloseFd)), fd)}` +
        (growth.length ? ` · ${fmt(stat(growth), (x) => `${x.toFixed(2)}×`)} prior year` : "") +
        ` · avg rate ${fmt(stat(rs.map((r) => get(r).avgRate)), (x) => x.toFixed(2))}`,
    );
  }
  console.log(
    `  Wealth: Gini ${fmt(stat(rs.map((r) => r.wealth.gini)), (x) => x.toFixed(2))} · top 1% ${fmt(stat(rs.map((r) => r.wealth.top1Share)), pct)}` +
      ` · top 10% ${fmt(stat(rs.map((r) => r.wealth.top10Share)), pct)} · Miles Gini ${fmt(stat(rs.map((r) => r.wealth.milesGini)), (x) => x.toFixed(2))}`,
  );
  console.log(
    `  Failures: repossessions ${fmt(stat(rs.map((r) => r.failures.repossessions)), (x) => x.toFixed(0))} · wiped out ${fmt(stat(rs.map((r) => r.failures.wipedOut)), (x) => x.toFixed(0))}` +
      ` · in debt ${fmt(stat(rs.map((r) => r.failures.inDebtAtEnd)), (x) => x.toFixed(0))} (${fmt(stat(rs.map((r) => r.failures.debtFd)), fd)}) · written off ${fmt(stat(rs.map((r) => r.failures.writtenOffFd)), fd)}`,
  );
  console.log(
    `  Liquidations ${fmt(stat(rs.map((r) => r.failures.bankruptcies)), (x) => x.toFixed(0))} at ${fmt(stat(rs.map((r) => r.failures.companiesBankrupt)), (x) => x.toFixed(0))} companies` +
      ` · debt written off ${fmt(stat(rs.map((r) => r.failures.debtWrittenOffFd)), fd)} · shipper defaults ${fmt(stat(rs.map((r) => r.failures.shipperDefaults)), (x) => x.toFixed(0))}`,
  );
  console.log(
    `  Equipment Finance: loans ${fmt(stat(rs.map((r) => r.finance.loansMade)), (x) => x.toFixed(0))} · peak owed ${fmt(stat(rs.map((r) => r.finance.peakOutstandingFd)), fd)}` +
      ` · used sales ${fmt(stat(rs.map((r) => r.usedMarket.sales)), (x) => x.toFixed(0))}`,
  );
  console.log("  Cycle by quarter (mean across seeds):");
  for (let q = 0; q < rs[0]!.cycleQuarters.length; q++) {
    const avg = (f: (r: RunReport) => number) => rs.reduce((s, r) => s + f(r), 0) / rs.length;
    const cq = (r: RunReport) => r.cycleQuarters[q]!;
    console.log(
      `    ${cq(rs[0]!).label} cycle ${avg((r) => cq(r).cycle).toFixed(2)} · rate ${avg((r) => cq(r).avgRate).toFixed(2)}` +
        ` · ordered ${avg((r) => cq(r).ordersPlaced).toFixed(0)} delivered ${avg((r) => cq(r).trucksDelivered).toFixed(0)}` +
        ` · repos ${avg((r) => cq(r).repossessions).toFixed(0)} · used sales ${avg((r) => cq(r).usedSales).toFixed(0)} · sinks ${pct(avg((r) => cq(r).sinkFaucetRatio))}`,
    );
  }
  const free = rs.map((r) => r.freePath.medianDays ?? 999);
  console.log(`  Free path median days ${fmt(stat(free), (x) => x.toFixed(0))} · strategy top ${fmt(stat(rs.map((r) => r.strategies[0]?.vsMedian ?? 0)), (x) => `${x.toFixed(2)}×`)}`);
  const tags = new Map<string, number>();
  let faucetTotal = 0;
  for (const r of rs) {
    for (const [t, v] of Object.entries(r.sinksByTag)) tags.set(t, (tags.get(t) ?? 0) + v);
    faucetTotal += Object.values(r.faucetsByTag).reduce((a, b) => a + b, 0);
  }
  const parts = [...tags].sort((a, b) => b[1] - a[1]).map(([t, v]) => `${t} ${((100 * v) / faucetTotal).toFixed(1)}%`);
  console.log(`  Operating sinks as % of faucets: ${parts.join(", ")}`);
  const fTags = new Map<string, number>();
  for (const r of rs) for (const [t, v] of Object.entries(r.faucetsByTag)) fTags.set(t, (fTags.get(t) ?? 0) + v);
  console.log(`  Faucets: ${[...fTags].map(([t, v]) => `${t} ${((100 * v) / faucetTotal).toFixed(1)}%`).join(", ")}`);
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

function fd(x: number): string {
  return Math.abs(x) >= 1e6 ? `${(x / 1e6).toFixed(2)}M` : Math.abs(x) >= 1e3 ? `${(x / 1e3).toFixed(1)}k` : x.toFixed(0);
}
