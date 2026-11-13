// The launch gate, read over a cap run and its cap-off twin (same seed, same code). Approved by Jeff on 2026-11-08
// (studio/DECISIONS.md; studio/reviews/economy-emission.md, the gate's section):
//   (a) the band — the rules' check: the corrected sinks ÷ faucets (the NPC advance-and-repayment wash out of both sides)
//       over the trailing four quarters, in [0.84, 1.00] at every quarter end from the fourth year (the third year's
//       readings lean on the launch quarter, S3Q1, whose reset no capped world shows; the floor's step from 0.85 is the
//       subsidy's share — a freed cap reads a point or two under its twin, review §16.7 — and the twin's own readings are
//       reported beside the cap's for the next calibration; the band read from one year later is reported too);
//   (b) the floors — the cap's check, against the twin at the ends of years 3 and 4: carriers in service at or above 72%
//       of the twin's at the end of year 3, while the cap is still releasing, and 75% at the end of year 4; cleared loads
//       a day at or above 75% at both; the companies' debt in FD at or under 7.5% of the FD held (scale-free: a multiple
//       of the twin's fails a healthy run when the twin's debt is near zero, a bare figure ignores the world's size;
//       healthy runs read under 6%, starved ones from 9.7%); the absolute figure, the twin-relative figure and the
//       in-debt count are reported, not gated;
//   (c) the cold start's own line: month 1 committed at or under 110% of its budget; Q1 corrected reported;
//   (d) supply growth, strategy spread and the free path as report.pass defines them.
//   Reported, never gated: the prudent owner-operator's first truck (hard by design), the NPC market's purchases as a share
//   of NPC pay committed against the 5% tripwire (emission.pay.market, whatever route paid the sale; the npc_market faucet
//   tag understates it under the cap, where the factor advances most facility sales — kept beside for the record), net
//   emitted against the planned curve (the opening month plus the subsidy), the headroom under the first sizing's curve
//   for the record.
//
//   npm run gate -- --twin runs/<cap-off dir> --cap runs/<cap dir> [--twin … --cap …] [--json]
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { economyConfig } from "@lanes/config";
import { balanceSinksFd, type DayMetrics, type RatioReading, type RunReport } from "@lanes/engine";

export interface GateDefinition {
  band: { lo: number; hi: number; trailingQuarters: number; fromYear: number };
  floors: {
    /** The year-ends read (1-based), each with its lines: carriers in service and cleared loads a day as shares of the twin's. */
    years: readonly { year: number; carriers: number; cleared: number }[];
    /** Cleared loads a day are the mean over this many days to the year's last day. */
    windowDays: number;
    /** The companies' debt in FD, as a share of the FD held, at most this. */
    debtShareOfHeld: number;
  };
  coldStart: { maxCommittedShare: number };
  marketTripwire: number;
}

/** The approved definition lives in the config (killCriteria.gate); this is it. */
export const GATE: GateDefinition = economyConfig.killCriteria.gate;

/** The slice of a day's metrics the gate reads; `inDebt` / `debtFd` are the daily debt figures, absent in older reports. */
export interface GateDay {
  day: number;
  season: number;
  faucetFd: number;
  sinkFd: number;
  reserveFd: number;
  supplyFd: number;
  cleared: number;
  activeCarriers: number;
  trucksInService: number;
  faucetByTag: Record<string, number>;
  sinkByTag: Record<string, number>;
  inDebt?: number;
  debtFd?: number;
  retiredDebtFd?: number;
}

/** The slice of the report the gate reads (a RunReport is one). */
export interface GateReport {
  seed: number;
  quarters: { label: string; sinkFaucetRatio: number; pass: boolean }[];
  ratios?: { quarters: ({ label: string } & RatioReading)[] } | null;
  supply: { pass: boolean; afterWarmup: number; yearOverYear?: number | null };
  strategyPass: boolean;
  crossSegmentTop: number;
  freePath: { pass: boolean; withinLimit: number; companies: number; medianDays: number | null };
  failures: { inDebtAtEnd: number; debtFd: number; debtRetiredFd?: number };
  byStrategy?: Record<string, Record<string, { firstTruck?: { bought: number; medianDay: number | null } }>> | null;
  emission?: {
    enabled: boolean;
    firstMonthFd: number;
    months: { budgetFd: number; committedFd: number; subsidyFd: number }[];
    reserve: { genesisReserveFd: number; endFd: number; netEmittedFd: number };
    /** NPC pay committed by kind, the NPC market's purchases among them (whatever route paid the sale). */
    pay?: Record<string, { loads: number; fd: number }>;
  } | null;
}

export interface GateRun {
  report: GateReport;
  days: GateDay[];
}

export interface GateResult {
  seed: number;
  days: number;
  pass: boolean;
  band: {
    pass: boolean;
    proxy: boolean;
    readings: { label: string; value: number; pass: boolean }[];
    /** The twin's own readings at the same quarter-ends, and the cap's mean gap to them (reported): the next calibration's figure. */
    twinReadings: { label: string; value: number }[];
    gapToTwin: number | null;
    /** The same band read one year later (reported, not gated): no window then holds the launch quarter, S3Q1, whose reset the baseline's year-3 readings lean on. */
    laterStart: { fromYear: number; pass: boolean; readings: { label: string; value: number; pass: boolean }[] };
  };
  floors: {
    pass: boolean;
    years: { year: number; run: boolean; carriersLine: number; clearedLine: number; carriers: number; twinCarriers: number; carriersPass: boolean; cleared: number; twinCleared: number; clearedPass: boolean; trucks: number; twinTrucks: number }[];
    debt: { readAt: string; shareOfHeld: number; twinShareOfHeld: number; pass: boolean; fd: number; twinFd: number; twinMultiple: number | null; inDebt: number; twinInDebt: number; retiredFd: number; twinRetiredFd: number }[];
  };
  coldStart: { pass: boolean; capOff: boolean; committedFd: number; budgetFd: number; share: number; q1Corrected: number | null };
  standing: { pass: boolean; supply: boolean; spread: boolean; freePath: boolean; afterWarmup: number; yearOverYear: number | null; crossSegmentTop: number; freeWithin: number; freeCompanies: number; freeMedianDays: number | null };
  reported: {
    firstTruckDay: number | null;
    twinFirstTruckDay: number | null;
    /** The NPC market's purchases as a share of NPC pay committed (emission.pay.market), which the tripwire reads; null on a report without the pay record. */
    marketShareOfPay: number | null;
    /** The npc_market faucet's share of the last year's faucets, for the record: under the cap most facility sales are advanced by the factor and post under its tag. */
    marketFaucetShareLastYear: number;
    marketTripped: boolean;
    netEmittedFd: number;
    plannedFd: number;
    overshootFd: number;
    reserveDrawdownFd: number;
    curveHeadroomFd: number | null;
    rawQuartersInOldBand: number;
    quarters: number;
  };
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const mean = (xs: readonly number[]): number => (xs.length ? sum(xs) / xs.length : 0);
const DAYS_PER_YEAR = 365;
const DAYS_PER_MONTH = 30;

/** The quarters' ratio readings: the report's own (exact), or the proxy for reports before the advance tag (repayments stand in for advances). */
export function quarterReadings(run: GateRun): { quarters: ({ label: string } & RatioReading)[]; proxy: boolean } {
  if (run.report.ratios?.quarters?.length) return { quarters: run.report.ratios.quarters, proxy: false };
  const quarterLen = DAYS_PER_YEAR / 4;
  const quarters: ({ label: string } & RatioReading)[] = [];
  const seasons = Math.ceil(run.days.length / DAYS_PER_YEAR);
  for (let s = 0; s < seasons; s++) {
    for (let q = 0; q < 4; q++) {
      const slice = run.days.filter((d) => d.season === s && d.day - s * DAYS_PER_YEAR >= q * quarterLen && d.day - s * DAYS_PER_YEAR < (q + 1) * quarterLen);
      if (slice.length < quarterLen - 1) continue;
      const faucetFd = sum(slice.map((d) => d.faucetFd));
      const sinkFd = sum(slice.map((d) => balanceSinksFd(d))); // the settlement fee's burn counts (0 on reports before its tag)
      const repaidFd = sum(slice.map((d) => d.sinkByTag?.npc_factor ?? 0));
      quarters.push({ label: `S${s + 1}Q${q + 1}`, raw: faucetFd > 0 ? sinkFd / faucetFd : 0, corrected: faucetFd - repaidFd > 0 ? (sinkFd - repaidFd) / (faucetFd - repaidFd) : 0, faucetFd, sinkFd, advanceFd: repaidFd, repaidFd });
    }
  }
  return { quarters, proxy: true };
}

/** The corrected ratio over the `n` quarters ending at index `i`: the flows summed, the wash out of both sides. */
export function trailingCorrected(quarters: readonly RatioReading[], i: number, n: number): number {
  const w = quarters.slice(i - n + 1, i + 1);
  const F = sum(w.map((x) => x.faucetFd)) - sum(w.map((x) => x.advanceFd));
  const S = sum(w.map((x) => x.sinkFd)) - sum(w.map((x) => x.repaidFd));
  return F > 0 ? S / F : 0;
}

type DebtFigures = { fd: number; inDebt: number; held: number; retiredFd: number };

/** The debt line: the debt of the companies in the market as a share of the FD held, against the definition; the twin's figures and the retired companies' residue beside it. */
function debtReading(readAt: string, a: DebtFigures, b: DebtFigures, def: GateDefinition): GateResult["floors"]["debt"][number] {
  const shareOfHeld = a.held > 0 ? a.fd / a.held : 0;
  return {
    readAt, shareOfHeld, twinShareOfHeld: b.held > 0 ? b.fd / b.held : 0, pass: shareOfHeld <= def.floors.debtShareOfHeld,
    fd: a.fd, twinFd: b.fd, twinMultiple: b.fd > 0 ? a.fd / b.fd : null, inDebt: a.inDebt, twinInDebt: b.inDebt,
    retiredFd: a.retiredFd, twinRetiredFd: b.retiredFd,
  };
}

function yearEnd(days: readonly GateDay[], year: number, windowDays: number) {
  const ds = days.slice((year - 1) * DAYS_PER_YEAR, year * DAYS_PER_YEAR);
  const last = ds[ds.length - 1]!;
  return { last, carriers: last.activeCarriers, cleared: mean(ds.slice(-windowDays).map((d) => d.cleared)), trucks: last.trucksInService };
}

export function evaluateGate(cap: GateRun, twin: GateRun, def: GateDefinition = GATE): GateResult {
  const r = cap.report;
  const years = Math.floor(cap.days.length / DAYS_PER_YEAR);

  // (a) the band, as defined, and read from one year later (reported)
  const { quarters, proxy } = quarterReadings(cap);
  const bandFrom = (fromYear: number) => {
    const readings: GateResult["band"]["readings"] = [];
    for (let i = (fromYear - 1) * 4; i < quarters.length; i++) {
      if (i - def.band.trailingQuarters + 1 < 0) continue;
      const value = trailingCorrected(quarters, i, def.band.trailingQuarters);
      readings.push({ label: quarters[i]!.label, value, pass: value >= def.band.lo && value <= def.band.hi });
    }
    return { pass: readings.length > 0 && readings.every((x) => x.pass), readings };
  };
  const asDefined = bandFrom(def.band.fromYear);
  const later = bandFrom(def.band.fromYear + 1);
  // The twin's readings at the same quarter-ends, for the gap the cap itself makes (16.7: a point or two under).
  const twinQuarters = quarterReadings(twin).quarters;
  const twinReadings = asDefined.readings
    .map((x) => ({ label: x.label, i: twinQuarters.findIndex((q) => q.label === x.label) }))
    .filter((x) => x.i >= def.band.trailingQuarters - 1)
    .map((x) => ({ label: x.label, value: trailingCorrected(twinQuarters, x.i, def.band.trailingQuarters) }));
  const gaps = asDefined.readings.map((x) => { const t = twinReadings.find((y) => y.label === x.label); return t ? x.value - t.value : null; }).filter((g): g is number => g !== null);
  const band = { ...asDefined, proxy, twinReadings, gapToTwin: gaps.length ? mean(gaps) : null, laterStart: { fromYear: def.band.fromYear + 1, ...later } };

  // (b) the floors
  const floorYears: GateResult["floors"]["years"] = [];
  const debt: GateResult["floors"]["debt"] = [];
  // The debt of the companies in the market; what retired companies still owe is carried apart (reports from before the
  // split carry it inside the total, which the fallback takes out when the report says how much).
  const debtOf = (run: GateRun, day: GateDay | null): DebtFigures => {
    if (day && day.debtFd !== undefined) return { fd: Math.abs(day.debtFd), inDebt: day.inDebt ?? 0, held: day.supplyFd, retiredFd: day.retiredDebtFd ?? 0 };
    const f = run.report.failures;
    const retiredFd = f.debtRetiredFd ?? 0;
    return { fd: Math.max(0, Math.abs(f.debtFd) - retiredFd), inDebt: f.inDebtAtEnd, held: run.days[run.days.length - 1]!.supplyFd, retiredFd };
  };
  const dailyDebt = cap.days.some((d) => d.debtFd !== undefined) && twin.days.some((d) => d.debtFd !== undefined);
  for (const line of def.floors.years) {
    const { year } = line;
    const run = year <= years && year * DAYS_PER_YEAR <= twin.days.length;
    if (!run) {
      floorYears.push({ year, run: false, carriersLine: line.carriers, clearedLine: line.cleared, carriers: 0, twinCarriers: 0, carriersPass: false, cleared: 0, twinCleared: 0, clearedPass: false, trucks: 0, twinTrucks: 0 });
      continue;
    }
    const a = yearEnd(cap.days, year, def.floors.windowDays);
    const b = yearEnd(twin.days, year, def.floors.windowDays);
    floorYears.push({
      year, run: true, carriersLine: line.carriers, clearedLine: line.cleared,
      carriers: a.carriers, twinCarriers: b.carriers, carriersPass: a.carriers >= line.carriers * b.carriers,
      cleared: a.cleared, twinCleared: b.cleared, clearedPass: a.cleared >= line.cleared * b.cleared,
      trucks: a.trucks, twinTrucks: b.trucks,
    });
    if (dailyDebt) debt.push(debtReading(`day ${a.last.day}`, debtOf(cap, a.last), debtOf(twin, b.last), def));
  }
  if (!dailyDebt) debt.push(debtReading("end of run", debtOf(cap, null), debtOf(twin, null), def));
  const floors = { pass: floorYears.every((y) => y.run && y.carriersPass && y.clearedPass) && debt.every((d) => d.pass), years: floorYears, debt };

  // (c) the cold start
  const m0 = r.emission?.enabled ? r.emission.months[0] : undefined;
  const share = m0 && m0.budgetFd > 0 ? m0.committedFd / m0.budgetFd : NaN;
  const coldStart = { pass: m0 !== undefined && share <= def.coldStart.maxCommittedShare, capOff: m0 === undefined, committedFd: m0?.committedFd ?? 0, budgetFd: m0?.budgetFd ?? 0, share, q1Corrected: quarters[0]?.corrected ?? null };

  // (d) as they stand
  const standing = {
    pass: r.supply.pass && r.strategyPass && r.freePath.pass,
    supply: r.supply.pass, spread: r.strategyPass, freePath: r.freePath.pass,
    afterWarmup: r.supply.afterWarmup, yearOverYear: r.supply.yearOverYear ?? null, crossSegmentTop: r.crossSegmentTop,
    freeWithin: r.freePath.withinLimit, freeCompanies: r.freePath.companies, freeMedianDays: r.freePath.medianDays,
  };

  // reported, never gated
  const lastYear = cap.days.slice(-DAYS_PER_YEAR);
  const marketFaucetShareLastYear = sum(lastYear.map((d) => d.faucetByTag?.npc_market ?? 0)) / Math.max(1, sum(lastYear.map((d) => d.faucetFd)));
  const pay = r.emission?.pay;
  const payTotal = pay ? sum(Object.values(pay).map((k) => k.fd)) : 0;
  const marketShareOfPay = pay && payTotal > 0 ? (pay.market?.fd ?? 0) / payTotal : null;
  const months = r.emission?.months ?? [];
  const plannedFd = months.length ? months[0]!.budgetFd + sum(months.slice(1).map((m) => m.subsidyFd)) : 0;
  const netEmittedFd = sum(cap.days.map((d) => d.faucetFd - d.sinkFd));
  const last = cap.days[cap.days.length - 1]!;
  const genesisReserve = r.emission?.reserve.genesisReserveFd ?? 0;
  const reserveDrawdownFd = genesisReserve > 0 ? genesisReserve - last.reserveFd : 0;
  // The first sizing's curve (the opening month × (1 − opening ÷ reserve)^m, summing to the reserve), for the record only.
  let curveHeadroomFd: number | null = null;
  if (r.emission && genesisReserve > 0 && r.emission.firstMonthFd > 0) {
    const ratio = 1 - r.emission.firstMonthFd / genesisReserve;
    const closedMonths = Math.floor(cap.days.length / DAYS_PER_MONTH);
    curveHeadroomFd = genesisReserve * (1 - ratio ** closedMonths) - reserveDrawdownFd;
  }
  const reported = {
    firstTruckDay: r.byStrategy?.oo?.conservative?.firstTruck?.medianDay ?? null,
    twinFirstTruckDay: twin.report.byStrategy?.oo?.conservative?.firstTruck?.medianDay ?? null,
    marketShareOfPay, marketFaucetShareLastYear, marketTripped: (marketShareOfPay ?? marketFaucetShareLastYear) > def.marketTripwire,
    netEmittedFd, plannedFd, overshootFd: netEmittedFd - plannedFd, reserveDrawdownFd, curveHeadroomFd,
    rawQuartersInOldBand: r.quarters.filter((q) => q.pass).length, quarters: r.quarters.length,
  };

  return { seed: r.seed, days: cap.days.length, pass: band.pass && floors.pass && coldStart.pass && standing.pass, band, floors, coldStart, standing, reported };
}

const M = (x: number): string => `${(x / 1e6).toFixed(1)}M`;
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const mark = (ok: boolean): string => (ok ? "✓" : "✗");

export function formatGate(g: GateResult, label = ""): string {
  const lines: string[] = [];
  lines.push(`=== seed ${g.seed}${label ? ` · ${label}` : ""} · ${g.days} days · ${g.pass ? "PASS" : "FAIL"} ===`);
  lines.push(`(a) band ${mark(g.band.pass)}: corrected, trailing four, as defined: ${g.band.readings.map((x) => `${x.value.toFixed(3)}${x.pass ? "" : "!"}`).join(" ") || "no complete quarter"}${g.band.proxy ? " (proxy: repayments stand in for the advances)" : ""}`);
  if (g.band.twinReadings.length) lines.push(`    the twin's own: ${g.band.twinReadings.map((x) => x.value.toFixed(3)).join(" ")} · the cap's gap to it ${g.band.gapToTwin !== null ? `${g.band.gapToTwin >= 0 ? "+" : ""}${(g.band.gapToTwin * 100).toFixed(1)} points` : "–"} (reported)`);
  if (g.band.laterStart.readings.length) lines.push(`    read from year ${g.band.laterStart.fromYear} only (reported): ${mark(g.band.laterStart.pass)} ${g.band.laterStart.readings.map((x) => `${x.value.toFixed(3)}${x.pass ? "" : "!"}`).join(" ")}`);
  lines.push(`(b) floors ${mark(g.floors.pass)}:`);
  for (const y of g.floors.years) {
    if (!y.run) { lines.push(`    Y${y.year}: not run`); continue; }
    lines.push(`    Y${y.year}: carriers ${y.carriers} vs twin ${y.twinCarriers} (${pct(y.carriers / Math.max(1, y.twinCarriers))}, line ${pct(y.carriersLine)}${y.carriersPass ? "" : " ✗"}) · cleared/day ${y.cleared.toFixed(0)} vs ${y.twinCleared.toFixed(0)} (${pct(y.cleared / Math.max(1, y.twinCleared))}, line ${pct(y.clearedLine)}${y.clearedPass ? "" : " ✗"}) · trucks ${y.trucks} vs ${y.twinTrucks}`);
  }
  for (const d of g.floors.debt) lines.push(`    debt at ${d.readAt}: ${pct(d.shareOfHeld)} of FD held${d.pass ? "" : " ✗"} (twin ${pct(d.twinShareOfHeld)}) · ${M(d.fd)} vs twin ${M(d.twinFd)}${d.twinMultiple !== null ? ` (${d.twinMultiple.toFixed(1)}× the twin's)` : ""} · in debt ${d.inDebt} vs ${d.twinInDebt} (reported) · retired companies' residue ${M(d.retiredFd)} vs ${M(d.twinRetiredFd)} (reported)`);
  lines.push(`(c) cold start ${mark(g.coldStart.pass)}: ${g.coldStart.capOff ? "cap off" : `month 1 committed ${M(g.coldStart.committedFd)} of budget ${M(g.coldStart.budgetFd)} (${pct(g.coldStart.share)})`} · Q1 corrected ${g.coldStart.q1Corrected?.toFixed(3) ?? "–"}`);
  const s = g.standing;
  lines.push(`(d) supply ${mark(s.supply)} (warm ${s.afterWarmup.toFixed(2)}×, yoy ${s.yearOverYear?.toFixed(2) ?? "–"}×) · spread ${mark(s.spread)} (${s.crossSegmentTop.toFixed(2)}×) · free path ${mark(s.freePath)} (${s.freeWithin}/${s.freeCompanies} within the limit, median ${s.freeMedianDays ?? "–"} d)`);
  const p = g.reported;
  lines.push(`    reported: prudent OO first truck d${p.firstTruckDay ?? "–"} (twin d${p.twinFirstTruckDay ?? "–"}) · NPC market purchases ${p.marketShareOfPay !== null ? `${pct(p.marketShareOfPay)} of NPC pay committed` : "not in this report"}${p.marketTripped ? " TRIPPED" : ""} (by faucet tag, last year ${pct(p.marketFaucetShareLastYear)}, record only) · net emitted ${M(p.netEmittedFd)} vs planned ${M(p.plannedFd)} (${p.overshootFd >= 0 ? "+" : ""}${M(p.overshootFd)}) · reserve drawdown ${M(p.reserveDrawdownFd)}${p.curveHeadroomFd !== null ? ` · headroom under the first sizing's curve ${M(p.curveHeadroomFd)} (record only)` : ""} · raw quarters in the old band ${p.rawQuartersInOldBand}/${p.quarters}`);
  return lines.join("\n");
}

/** Reads a run directory's report-seed<N>.json files by seed. */
export function loadRuns(dir: string): Map<number, GateRun> {
  const out = new Map<number, GateRun>();
  for (const f of readdirSync(dir).filter((f) => /^report-seed\d+\.json$/.test(f)).sort()) {
    const j = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as { report: RunReport; days: DayMetrics[] };
    out.set(j.report.seed, j);
  }
  return out;
}

function main(argv: string[]): void {
  const pairs: { twin: string; cap: string }[] = [];
  let twin: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--twin") twin = argv[++i] ?? null;
    else if (argv[i] === "--cap") {
      if (!twin) throw new Error("--cap needs a --twin before it");
      pairs.push({ twin, cap: argv[++i]! });
    }
  }
  if (pairs.length === 0) {
    console.log("usage: npm run gate -- --twin runs/<cap-off dir> --cap runs/<cap dir> [--twin … --cap …] [--json]");
    return;
  }
  const json = argv.includes("--json");
  const results: (GateResult & { cap: string; twin: string })[] = [];
  for (const p of pairs) {
    const twins = loadRuns(p.twin);
    for (const [seed, run] of loadRuns(p.cap)) {
      const t = twins.get(seed);
      if (!t) { console.error(`seed ${seed}: no twin in ${p.twin}`); continue; }
      results.push({ ...evaluateGate(run, t), cap: p.cap, twin: p.twin });
    }
  }
  if (json) { console.log(JSON.stringify(results, null, 2)); return; }
  for (const g of results) console.log(`\n${formatGate(g, `${g.cap} vs ${g.twin}`)}`);
  console.log(`\n${results.filter((g) => g.pass).length}/${results.length} seeds pass the gate.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
