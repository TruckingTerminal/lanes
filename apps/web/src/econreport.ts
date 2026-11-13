import type { Equipment } from "@lanes/config";
import type { DayMetrics, EconMonth, World } from "@lanes/engine";
import { REPORT } from "./copy-report.js";
import { fdFull, monthName, pct, TRAILER_NAME } from "./format.js";

/**
 * "The freight economy" (Intel's public monthly report; studio/reviews/economy-eve-sinks.md §2 for the figures and their
 * privacy, studio/reviews/director-eve.md §2 for the order and voice): one closed month beside the month before and the
 * same month a year earlier. Built from what the engine froze at the month's close (w.econ, econMonth.ts) and its day
 * metrics, never from anything live, so it never changes after it's out. Aggregates only: no company named or ranked, and
 * no cell from fewer than ten companies (the engine stores such a cell as null; this shows it as nothing).
 *
 * The order: freight people first, the token last (the director): Freight, Trucks, Companies, then Work (the economy's,
 * placed with the companies), Money, Wealth in bands (the economy's, after the money), and next month's announced changes.
 */
export interface ReportRow {
  label: string;
  now: string;
  prior: string | null;
  year: string | null;
}
export interface ReportSection {
  title: string;
  rows: ReportRow[];
}
export interface EconReport {
  title: string;
  /** Iuliia's one line above it, on this player's freight (null with no figure to read). */
  iuliia: string | null;
  sections: ReportSection[];
}

const TRAILERS: readonly Equipment[] = ["van", "reefer", "flatbed"];

/** A closed month with its days. */
interface MonthView {
  rec: EconMonth;
  days: DayMetrics[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const last = (m: MonthView) => m.days.at(-1);
const n = (x: number) => Math.round(x).toLocaleString("en-US");
const share = (x: number) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
const tagLabel = (tag: string) => tag.replace(/[:_]/g, " ");

/** The latest closed month's report (`index` for an earlier one), or null before the first month closes. */
export function econReport(w: World, trailer: Equipment | null, index?: number): EconReport | null {
  const months = w.econ?.months ?? [];
  if (!months.length) return null;
  const at = index === undefined ? months.length - 1 : months.findIndex((m) => m.index === index);
  if (at < 0) return null;
  const view = (rec: EconMonth | undefined): MonthView | null => (rec ? { rec, days: w.metrics.days.filter((d) => d.day >= rec.fromDay && d.day <= rec.toDay) } : null);
  const now = view(months[at])!;
  const prior = view(months.find((m) => m.index === now.rec.index - 1));
  const yearAgo = view(months.find((m) => m.index === now.rec.index - Math.round(w.cfg.time.daysPerSeason / w.cfg.time.daysPerMonth)));
  const row = (label: string, of: (m: MonthView) => number | null, fmt: (x: number) => string): ReportRow | null => {
    const v = of(now);
    if (v === null) return null; // fewer than ten companies behind it, or nothing to say: left out
    const o = (m: MonthView | null) => {
      const x = m ? of(m) : null;
      return x === null ? null : fmt(x);
    };
    return { label, now: fmt(v), prior: o(prior), year: o(yearAgo) };
  };
  const rows = (...rs: (ReportRow | null)[]) => rs.filter((r): r is ReportRow => r !== null);
  // The rate index's base: each trailer's first month with a figure.
  const base = (eq: Equipment) => months.find((m) => m.rateByTrailer[eq].perMi !== null)?.rateByTrailer[eq].perMi ?? null;

  const freight: ReportSection = {
    title: REPORT.secFreight,
    rows: rows(
      row(REPORT.posted, (m) => sum(m.days.map((d) => d.posted)), n),
      row(REPORT.cleared, (m) => sum(m.days.map((d) => d.cleared)), n),
      row(REPORT.lost, (m) => sum(m.days.map((d) => d.expired)), n),
      ...TRAILERS.map((eq) =>
        row(
          REPORT.rateIndex(TRAILER_NAME[eq]),
          (m) => m.rec.rateByTrailer[eq].perMi,
          (x) => {
            const b = base(eq);
            return b ? `${x.toFixed(2)} (${Math.round((x / b) * 100)})` : x.toFixed(2);
          },
        ),
      ),
      row(
        REPORT.onTime,
        (m) => {
          const delivered = sum(m.days.map((d) => d.delivered));
          return delivered > 0 ? sum(m.days.map((d) => d.onTimeShare * d.delivered)) / delivered : null;
        },
        pct,
      ),
      row(REPORT.volumeLever, (m) => (m.days.length ? sum(m.days.map((d) => d.volumeMult)) / m.days.length : null), (x) => x.toFixed(2)),
    ),
  };
  const trucks: ReportSection = {
    title: REPORT.secTrucks,
    rows: rows(
      ...(["workhorse", "highwayPro", "flagship"] as const).map((tier) => row(REPORT.newIndex(tier === "workhorse" ? "Workhorse" : tier === "highwayPro" ? "Highway Pro" : "Flagship"), (m) => m.rec.dealerIndex.tractor[tier] ?? null, (x) => x.toFixed(3))),
      row(REPORT.usedSold, (m) => m.rec.used.n, n),
      row(REPORT.usedOverBook, (m) => m.rec.used.priceOverBook, pct),
      row(REPORT.scrapped, (m) => sum(m.days.map((d) => d.scrappedTractors)), n),
      row(REPORT.writtenOff, (m) => sum(m.days.map((d) => d.totalLosses)), n),
      row(REPORT.destroyed, (m) => m.rec.destroyed.fd, fdFull),
      row(REPORT.repossessed, (m) => sum(m.days.map((d) => d.repossessions)), n),
    ),
  };
  const companies: ReportSection = {
    title: REPORT.secCompanies,
    rows: rows(
      row(REPORT.carriers, (m) => last(m)?.activeCarriers ?? null, n),
      row(REPORT.inService, (m) => last(m)?.trucksInService ?? null, n),
      row(REPORT.started, (m) => m.rec.newCompanies, n),
      row(REPORT.bankruptcies, (m) => sum(m.days.map((d) => d.bankruptcies)), n),
      row(REPORT.liquidating, (m) => last(m)?.liquidating ?? null, n),
      row(REPORT.inDebt, (m) => last(m)?.inDebt ?? null, n),
      // What they owe in all: a total over the companies in debt, so only where ten or more stand behind it.
      row(REPORT.owed, (m) => ((last(m)?.inDebt ?? 0) >= 10 ? last(m)!.debtFd : null), fdFull),
    ),
  };
  const work: ReportSection = {
    title: REPORT.secWork,
    rows: rows(row(REPORT.drivers, (m) => m.rec.work.driversEmployed, n), row(REPORT.pool, (m) => m.rec.work.driversPool, n), row(REPORT.wageIndex, (m) => m.rec.work.wageIndex, (x) => x.toFixed(3))),
  };
  // Money: what came in and went out by kind, the largest first (this month's), then the totals and the net.
  const tags = (m: MonthView, key: "faucetByTag" | "sinkByTag") => {
    const out: Record<string, number> = {};
    for (const d of m.days) for (const [k, v] of Object.entries(d[key])) out[k] = (out[k] ?? 0) + v;
    return out;
  };
  const inNow = tags(now, "faucetByTag");
  const outNow = tags(now, "sinkByTag");
  const top = (t: Record<string, number>) =>
    Object.entries(t)
      .filter(([, v]) => v >= 0.5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k]) => k);
  const inTotal = (m: MonthView) => sum(m.days.map((d) => d.faucetFd));
  const outTotal = (m: MonthView) => sum(m.days.map((d) => d.sinkFd));
  const emission = (m: MonthView) => {
    const e = w.emission?.months.find((x) => x.month === m.rec.index);
    return e && e.budgetFd > 0 ? e.paidFd / e.budgetFd : null;
  };
  const money: ReportSection = {
    title: REPORT.secMoney,
    rows: rows(
      row(REPORT.circulation, (m) => last(m)?.supplyFd ?? null, fdFull),
      row(REPORT.reserve, (m) => last(m)?.reserveFd ?? null, fdFull),
      row(REPORT.inTotal, inTotal, fdFull),
      ...top(inNow).map((k) => row(REPORT.inKind(tagLabel(k)), (m) => tags(m, "faucetByTag")[k] ?? 0, (x) => `${fdFull(x)} (${share(x / Math.max(1, inTotal(now)))})`)),
      row(REPORT.outTotal, outTotal, fdFull),
      ...top(outNow).map((k) => row(REPORT.outKind(tagLabel(k)), (m) => tags(m, "sinkByTag")[k] ?? 0, (x) => `${fdFull(x)} (${share(x / Math.max(1, outTotal(now)))})`)),
      row(REPORT.net, (m) => inTotal(m) - outTotal(m), fdFull),
      row(REPORT.burned, (m) => sum(m.days.map((d) => d.burnFd + sum(Object.values(d.burnByTag)))), fdFull),
      // token.settlementFee: what it took, said as the total gone from the economy (the director, director-eve.md §1).
      row(REPORT.settlement, (m) => (w.cfg.token.settlementFee?.enabled ? sum(m.days.map((d) => d.burnByTag.trade_burn ?? 0)) : null), fdFull),
      row(REPORT.emission, emission, pct),
    ),
  };
  const wealth: ReportSection = {
    title: REPORT.secWealth,
    rows: rows(
      row(REPORT.gini, (m) => m.rec.wealth.gini, (x) => x.toFixed(2)),
      row(REPORT.top1, (m) => m.rec.wealth.top1Share, share),
      row(REPORT.top10, (m) => m.rec.wealth.top10Share, share),
      ...(["ownerOperator", "fleet", "broker"] as const).map((seg) => row(REPORT.median(REPORT.segment[seg]!), (m) => m.rec.wealth.medianBySegment[seg], fdFull)),
    ),
  };
  const announced: ReportSection = { title: REPORT.secAnnounced, rows: [{ label: REPORT.noneAnnounced, now: "", prior: null, year: null }] };

  // Iuliia's line: this player's trailer, this month against the last.
  let iuliia: string | null = null;
  if (trailer && prior) {
    const a = now.rec.rateByTrailer[trailer].perMi;
    const b = prior.rec.rateByTrailer[trailer].perMi;
    if (a !== null && b !== null && b > 0) {
      const ch = a / b - 1;
      iuliia = REPORT.iuliia(TRAILER_NAME[trailer], Math.abs(ch) < 0.005 ? "flat" : ch > 0 ? "up" : "down", `${Math.round(Math.abs(ch) * 100)}%`);
    }
  }
  const mid = Math.floor((now.rec.fromDay + now.rec.toDay) / 2);
  return {
    title: REPORT.title(monthName(mid), Math.floor(mid / w.cfg.time.daysPerSeason) + 1),
    iuliia,
    sections: [freight, trucks, companies, work, money, wealth, announced].filter((s) => s.rows.length > 0),
  };
}
