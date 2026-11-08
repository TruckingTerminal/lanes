import { describe, expect, it } from "vitest";
import { evaluateGate, formatGate, GATE, quarterReadings, trailingCorrected, type GateRun } from "../src/gate.js";

// A synthetic four-year run: 1,000 FD of faucets a day, sinks at the quarter's ratio, the wash (an NPC advance repaid the
// same day) on both sides when asked, constant carriers and cleared loads per year, the reserve drawn down by the net.
function makeRun(o: {
  seed?: number;
  days?: number;
  ratio?: (quarter: number) => number;
  advance?: number;
  oldTags?: boolean;
  carriers?: (year: number) => number;
  cleared?: (year: number) => number;
  debtFd?: number;
  inDebt?: number;
  dailyDebt?: boolean;
  budget0?: number;
  committed0?: number;
  subsidy?: number;
  capOff?: boolean;
  market?: number;
} = {}): GateRun {
  const n = o.days ?? 1460;
  const advance = o.advance ?? 0;
  const days: GateRun["days"] = [];
  let reserve = 600e6;
  for (let day = 0; day < n; day++) {
    const season = Math.floor(day / 365);
    const q = season * 4 + Math.floor((day - season * 365) / 91.25);
    const ratio = o.ratio?.(q) ?? 0.9;
    const market = o.market ?? 0;
    const faucetFd = 1000 + advance + market;
    const sinkFd = ratio * (1000 + market) + advance;
    reserve -= faucetFd - sinkFd;
    days.push({
      day, season, faucetFd, sinkFd, reserveFd: reserve, supplyFd: 50e6,
      cleared: o.cleared?.(season + 1) ?? 300, activeCarriers: o.carriers?.(season + 1) ?? 600, trucksInService: 700,
      faucetByTag: { npc_shipper: 1000, ...(advance && !o.oldTags ? { npc_advance: advance } : {}), ...(advance && o.oldTags ? { npc_factor: advance } : {}), ...(market ? { npc_market: market } : {}) },
      sinkByTag: advance ? { npc_factor: advance } : {},
      ...(o.dailyDebt ? { debtFd: o.debtFd ?? 300e3, inDebt: o.inDebt ?? 100 } : {}),
    });
  }
  const run: GateRun = {
    days,
    report: {
      seed: o.seed ?? 1,
      quarters: [],
      ratios: null,
      supply: { pass: true, afterWarmup: 1.2, yearOverYear: 1.1 },
      strategyPass: true,
      crossSegmentTop: 1.5,
      freePath: { pass: true, withinLimit: 400, companies: 500, medianDays: 20 },
      failures: { inDebtAtEnd: o.inDebt ?? 100, debtFd: -(o.debtFd ?? 300e3) },
      byStrategy: { oo: { conservative: { firstTruck: { bought: 10, medianDay: 50 } } } },
      emission: o.capOff
        ? null
        : {
            enabled: true,
            firstMonthFd: o.budget0 ?? 36e6,
            months: Array.from({ length: Math.floor(n / 30) }, (_, m) => ({ budgetFd: m === 0 ? (o.budget0 ?? 36e6) : 1e6, committedFd: m === 0 ? (o.committed0 ?? 36e6) : 1e6, subsidyFd: m === 0 ? 0 : (o.subsidy ?? 2.85e6) })),
            reserve: { genesisReserveFd: 600e6, endFd: reserve, netEmittedFd: 600e6 - reserve },
          },
    },
  };
  // The report's own quarters, as report.ts scores them (the old band) and reads them (the exact ratios), unless the run
  // predates the advance tag.
  const exact = quarterReadings({ ...run, report: { ...run.report, ratios: null } }).quarters.map((q) => ({ ...q, advanceFd: 0, repaidFd: 0 }));
  for (const q of exact) {
    const F = sum(days.filter((d) => inQuarter(d, q.label)).map((d) => d.faucetByTag.npc_advance ?? 0));
    q.advanceFd = F;
    q.repaidFd = F;
    q.corrected = (q.sinkFd - F) / (q.faucetFd - F);
  }
  run.report.quarters = exact.map((q) => ({ label: q.label, sinkFaucetRatio: q.raw, pass: q.raw >= 0.9 && q.raw <= 1.0 }));
  run.report.ratios = o.oldTags ? null : { quarters: exact };
  return run;
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
function inQuarter(d: { day: number; season: number }, label: string): boolean {
  const s = Number(label[1]) - 1, q = Number(label[3]) - 1;
  return d.season === s && d.day - s * 365 >= q * 91.25 && d.day - s * 365 < (q + 1) * 91.25;
}

// The band as first approved read from the third year; it moved to the fourth on the evidence of the re-runs (the review's
// 16.4). The window tests below read it from the third year so that the launch quarter's place in the window is exercised.
const FROM_YEAR_3 = { ...GATE, band: { ...GATE.band, fromYear: 3 } };

describe("the launch gate over a cap run and its twin (Jeff, 2026-11-08)", () => {
  it("a cap run no different from its twin passes every line; the band reads from the fourth year, four quarter-ends", () => {
    const run = makeRun();
    const g = evaluateGate(run, run);
    expect(GATE.band.fromYear).toBe(4);
    expect(g.pass).toBe(true);
    expect(g.band.readings.map((x) => x.label)).toEqual(["S4Q1", "S4Q2", "S4Q3", "S4Q4"]);
    expect(evaluateGate(run, run, FROM_YEAR_3).band.readings).toHaveLength(8);
    expect(g.band.readings.every((x) => Math.abs(x.value - 0.9) < 1e-9)).toBe(true);
    expect(g.floors.years.map((y) => y.year)).toEqual([3, 4]);
    expect(g.floors.debt[0]!.readAt).toBe("end of run");
    expect(g.floors.debt[0]!.shareOfHeld).toBeCloseTo(300e3 / 50e6, 9);
    expect(g.floors.debt[0]!.twinMultiple).toBeCloseTo(1, 9);
    expect(g.coldStart.share).toBeCloseTo(1, 9);
    expect(g.reported.firstTruckDay).toBe(50);
    expect(formatGate(g)).toContain("PASS");
  });

  it("the band reads the corrected ratio: the wash lifts the raw ratio and leaves the trailing four at the rules' own", () => {
    const run = makeRun({ advance: 500 });
    const { quarters } = quarterReadings(run);
    expect(quarters[8]!.raw).toBeCloseTo(1400 / 1500, 6);
    expect(trailingCorrected(quarters, 8, 4)).toBeCloseTo(0.9, 9);
    expect(evaluateGate(run, run).band.pass).toBe(true);
  });

  it("the band's four-quarter window: read from the third year a bad quarter in year 1 is forgotten and one in year 3 is not; from the fourth year the launch quarter is out of every window", () => {
    const early = makeRun({ ratio: (q) => (q === 3 ? 0.6 : 0.9) });
    expect(evaluateGate(early, early, FROM_YEAR_3).band.pass).toBe(true);
    const late = makeRun({ ratio: (q) => (q === 10 ? 0.6 : 0.9) });
    const g = evaluateGate(late, late, FROM_YEAR_3);
    expect(g.band.pass).toBe(false);
    // The four readings whose window holds S3Q3 fail; the other four hold.
    expect(g.band.readings.filter((x) => !x.pass).map((x) => x.label)).toEqual(["S3Q3", "S3Q4", "S4Q1", "S4Q2"]);
    expect(g.band.readings[2]!.value).toBeCloseTo((0.9 * 3 + 0.6) / 4, 2); // quarters weigh 91 or 92 days
    // Too much sunk fails too: above 1.00.
    const over = makeRun({ ratio: (q) => (q >= 8 ? 1.02 : 0.9) });
    expect(evaluateGate(over, over).band.pass).toBe(false);
    // The launch quarter (S3Q1): a bad one fails the band read from the third year and passes it from the fourth — the
    // reading the gate makes now — while a bad S4Q1 fails both; the later start is reported beside either.
    const launchQuarter = makeRun({ ratio: (q) => (q === 8 ? 0.6 : 0.9) });
    const h3 = evaluateGate(launchQuarter, launchQuarter, FROM_YEAR_3);
    expect(h3.band.pass).toBe(false);
    expect(h3.band.laterStart.fromYear).toBe(4);
    expect(h3.band.laterStart.pass).toBe(true);
    expect(h3.band.laterStart.readings.map((x) => x.label)).toEqual(["S4Q1", "S4Q2", "S4Q3", "S4Q4"]);
    expect(formatGate(h3)).toContain("read from year 4 only");
    const h4 = evaluateGate(launchQuarter, launchQuarter);
    expect(h4.band.pass).toBe(true);
    expect(h4.band.laterStart.fromYear).toBe(5);
    expect(h4.band.laterStart.readings).toHaveLength(0); // a four-year run has no fifth year to read
    const y4 = makeRun({ ratio: (q) => (q === 12 ? 0.6 : 0.9) });
    expect(evaluateGate(y4, y4).band.pass).toBe(false);
    expect(evaluateGate(y4, y4, FROM_YEAR_3).band.laterStart.pass).toBe(false);
  });

  it("the floors read carriers in service and cleared loads a day at the ends of years 3 and 4 against the twin, at 75%", () => {
    const twin = makeRun({ carriers: () => 600, cleared: () => 300 });
    const thin = makeRun({ carriers: (y) => (y === 4 ? 440 : 600), cleared: () => 300 });
    const g = evaluateGate(thin, twin);
    expect(g.floors.pass).toBe(false);
    expect(g.floors.years[0]!.carriersPass).toBe(true);
    expect(g.floors.years[1]!.carriersPass).toBe(false);
    expect(evaluateGate(makeRun({ carriers: () => 460 }), twin).floors.pass).toBe(true);
    const quiet = makeRun({ cleared: (y) => (y === 3 ? 220 : 300) });
    expect(evaluateGate(quiet, twin).floors.years[0]!.clearedPass).toBe(false);
    expect(evaluateGate(makeRun({ cleared: () => 226 }), twin).floors.pass).toBe(true);
  });

  it("the debt line is 7.5% of the FD held, scale-free, read at the end of the run until the days carry it; the twin's figure is reported", () => {
    expect(GATE.floors.debtShareOfHeld).toBe(0.075);
    const twin = makeRun({ debtFd: 300e3 }); // 50M held
    expect(evaluateGate(makeRun({ debtFd: 3.7e6 }), twin).floors.pass).toBe(true); // 7.4%
    const over = evaluateGate(makeRun({ debtFd: 3.8e6 }), twin); // 7.6%
    expect(over.floors.pass).toBe(false);
    expect(over.floors.debt[0]!.shareOfHeld).toBeCloseTo(0.076, 9);
    expect(over.floors.debt[0]!.twinMultiple).toBeCloseTo(3.8e6 / 300e3, 9); // reported, not gated
    // A twin deep in debt does not loosen the line, and a twin with none does not tighten it.
    expect(evaluateGate(makeRun({ debtFd: 3.8e6 }), makeRun({ debtFd: 5e6 })).floors.pass).toBe(false);
    const clean = evaluateGate(makeRun({ debtFd: 3.7e6 }), makeRun({ debtFd: 0 }));
    expect(clean.floors.pass).toBe(true);
    expect(clean.floors.debt[0]!.twinMultiple).toBeNull();
    // With the daily figure on both runs, the line reads the ends of years 3 and 4 and ignores the end-of-run total.
    const dailyTwin = makeRun({ dailyDebt: true, debtFd: 300e3 });
    const g = evaluateGate(makeRun({ dailyDebt: true, debtFd: 6e6, inDebt: 350 }), dailyTwin);
    expect(g.floors.debt.map((d) => d.readAt)).toEqual(["day 1094", "day 1459"]);
    expect(g.floors.debt.every((d) => !d.pass)).toBe(true);
    expect(g.floors.debt[0]!.inDebt).toBe(350);
    expect(g.floors.debt[0]!.shareOfHeld).toBeCloseTo(6e6 / 50e6, 9);
  });

  it("the cold start's line: month 1 committed at or under 110% of its budget", () => {
    const twin = makeRun();
    expect(evaluateGate(makeRun({ committed0: 39.5e6 }), twin).coldStart.pass).toBe(true);
    const g = evaluateGate(makeRun({ committed0: 39.7e6 }), twin);
    expect(g.coldStart.pass).toBe(false);
    expect(g.coldStart.share).toBeCloseTo(39.7 / 36, 6);
    expect(g.pass).toBe(false);
    const off = evaluateGate(makeRun({ capOff: true }), twin);
    expect(off.coldStart.capOff).toBe(true);
    expect(off.coldStart.pass).toBe(false);
  });

  it("supply, spread and the free path stand as report.pass has them", () => {
    const run = makeRun();
    const failing: GateRun = { ...run, report: { ...run.report, freePath: { ...run.report.freePath, pass: false } } };
    const g = evaluateGate(failing, run);
    expect(g.standing.pass).toBe(false);
    expect(g.standing.freePath).toBe(false);
    expect(g.pass).toBe(false);
  });

  it("runs before the advance tag get the proxy: the repayments stand in for the advances on both sides", () => {
    const old = makeRun({ advance: 500, oldTags: true });
    const { quarters, proxy } = quarterReadings(old);
    expect(proxy).toBe(true);
    expect(quarters[8]!.corrected).toBeCloseTo(0.9, 9);
    const g = evaluateGate(old, old);
    expect(g.band.proxy).toBe(true);
    expect(g.band.pass).toBe(true);
  });

  it("the figures reported, never gated: the first truck, the market's tripwire, the planned curve and the overshoot", () => {
    const twin = makeRun();
    const run = makeRun({ market: 80, subsidy: 2.85e6, budget0: 36e6 });
    const g = evaluateGate(run, twin);
    expect(g.reported.marketShareLastYear).toBeCloseTo(80 / 1080, 6);
    expect(g.reported.marketTripped).toBe(true);
    expect(g.pass).toBe(true); // tripped is reported, not gated
    expect(g.reported.plannedFd).toBeCloseTo(36e6 + 47 * 2.85e6, 3);
    expect(g.reported.netEmittedFd).toBeCloseTo(sum(run.days.map((d) => d.faucetFd - d.sinkFd)), 3);
    expect(g.reported.overshootFd).toBeCloseTo(g.reported.netEmittedFd - g.reported.plannedFd, 3);
    expect(g.reported.reserveDrawdownFd).toBeCloseTo(600e6 - run.days[run.days.length - 1]!.reserveFd, 3);
    expect(g.reported.curveHeadroomFd).toBeCloseTo(600e6 * (1 - 0.94 ** 48) - g.reported.reserveDrawdownFd, 0);
    expect(GATE.floors.share).toBe(0.75);
  });

  it("a run shorter than the floors' years fails the floors and says so", () => {
    const twin = makeRun();
    const short = makeRun({ days: 730 });
    const g = evaluateGate(short, twin);
    expect(g.floors.pass).toBe(false);
    expect(g.floors.years.every((y) => !y.run)).toBe(true);
    expect(g.band.readings).toHaveLength(0);
    expect(g.band.pass).toBe(false);
    expect(formatGate(g)).toContain("not run");
  });
});
