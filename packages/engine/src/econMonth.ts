import type { Equipment } from "@lanes/config";
import { reserveHeldFd } from "./cashReserve.js";
import { dayOf } from "./clock.js";
import { orderPrice, ordersOf, trailerValue, truckValue } from "./dealer.js";
import { facilitiesOf } from "./demand.js";
import { depositorValue } from "./finance.js";
import { companyAccount } from "./ledger.js";
import type { Company, Load } from "./types.js";
import type { World } from "./world.js";

/**
 * The public monthly report's own tallies ("The freight economy" on Intel; studio/reviews/economy-eve-sinks.md §2, the
 * director's order in studio/reviews/director-eve.md §2; Jeff's yes, the producer 2026-11-13). Everything else the report
 * shows the engine already keeps (the day metrics, the ledger's tags, the dealer index, the emission months); these four
 * it doesn't: the month's cleared rate by trailer, the book value destroyed (scrapped and written off), the used market's
 * sale price over book value, and wealth at each month's close.
 *
 * State for the screens only: no rule reads it, it draws no randomness, and it lives in its own world field (w.econ),
 * outside every field the ten-day digest hashes (apps/sim/src/determinism.ts), so it moves no world.
 *
 * Privacy (Jeff: a company's cash is its own): no figure for one company and no ranking, and no cell computed from fewer
 * than REPORT_MIN_COMPANIES companies; such a cell is stored as null, so no screen can show it by mistake.
 */
export const REPORT_MIN_COMPANIES = 10;

const TRAILERS: readonly Equipment[] = ["van", "reefer", "flatbed"];

export interface EconTally {
  /** Every load cleared this month, by trailer: FD paid (rate × loaded miles), loaded miles, and the carriers behind them. */
  rate: Record<Equipment, { fd: number; mi: number; carriers: Set<number> }>;
  /** Tractors scrapped or written off this month, and the book value gone with them (their own trailers included). */
  destroyed: { n: number; fd: number };
  /** Used trucks sold off a listing this month: the price, the book value at the sale, and the companies on either side. */
  used: { n: number; priceFd: number; bookFd: number; companies: Set<number> };
}

/** One closed month, as the report reads it. Cells from fewer than REPORT_MIN_COMPANIES companies are null. */
export interface EconMonth {
  /** The month's count from the world's first (0 for days 0 to 29). */
  index: number;
  fromDay: number;
  toDay: number;
  /** Mean cleared FD per loaded mile, national, by trailer, and the loaded miles behind it (0 when it's private). */
  rateByTrailer: Record<Equipment, { perMi: number | null; mi: number }>;
  destroyed: { n: number; fd: number };
  /** Used trucks sold, and their mean price over book value (sum of prices ÷ sum of book values). */
  used: { n: number; priceOverBook: number | null };
  /** Wealth at the close (companyWealthFd), national: the Gini, the top 1% and 10% shares, the median by segment. */
  wealth: { companies: number; gini: number | null; top1Share: number | null; top10Share: number | null; medianBySegment: Record<Segment, number | null> };
  /** Work at the close: drivers employed (owners driving left out) and in the pool, and the wage index. */
  work: { driversEmployed: number; driversPool: number; wageIndex: number };
  /** Companies started this month. */
  newCompanies: number;
  /** The new-truck price index at the close (w.dealerIndex), by tier and by trailer. */
  dealerIndex: { tractor: Record<string, number>; trailer: Record<string, number> };
}

export type Segment = "ownerOperator" | "fleet" | "broker";

export interface EconBook {
  tally: EconTally;
  months: EconMonth[];
}

const emptyTally = (): EconTally => ({
  rate: { van: { fd: 0, mi: 0, carriers: new Set() }, reefer: { fd: 0, mi: 0, carriers: new Set() }, flatbed: { fd: 0, mi: 0, carriers: new Set() } },
  destroyed: { n: 0, fd: 0 },
  used: { n: 0, priceFd: 0, bookFd: 0, companies: new Set() },
});
const book = (w: World): EconBook => (w.econ ??= { tally: emptyTally(), months: [] });

/** A load cleared at `rate` for `carrierId` (board.ts assign: the round and every outright booking). */
export function econCleared(w: World, load: Load, rate: number, carrierId: number): void {
  const r = book(w).tally.rate[load.equipment];
  r.fd += rate * load.miles;
  r.mi += load.miles;
  r.carriers.add(carrierId);
}

/** Book value leaving the game: a tractor scrapped or written off (`tractor`), or a trailer scrapped alone. */
export function econDestroyed(w: World, valueFd: number, tractor: boolean): void {
  const d = book(w).tally.destroyed;
  if (tractor) d.n++;
  d.fd += Math.max(0, valueFd);
}

/** A used truck sold off a listing (market.ts buyListing): its price and its book value at the sale. */
export function econUsedSale(w: World, priceFd: number, bookFd: number, sellerId: number, buyerId: number): void {
  const u = book(w).tally.used;
  u.n++;
  u.priceFd += priceFd;
  u.bookFd += bookFd;
  if (sellerId) u.companies.add(sellerId);
  u.companies.add(buyerId);
}

/**
 * What a company holds, in FD: its cash, pool deposits and Reserve, the trucks it owns (a leased-out tractor is its
 * owner's), its yard's owned trailers, its trucks on order and its facilities at cost. What it owes isn't taken off.
 * The one measure the run report's wealth figures and the monthly report share.
 */
export function companyWealthFd(w: World, companyId: number): number {
  const cfg = w.cfg;
  let wealth = w.ledger.balance(companyAccount(companyId)) + depositorValue(w, companyId) + (cfg.cashReserve.enabled ? reserveHeldFd(w, companyId) : 0);
  // Assets: a leased tractor is its owner's wealth, not the lessee's; trailers in the yard count too.
  for (const t of w.trucksByCompany.get(companyId)!) if (!t.lessorId || t.lessorId === companyId) wealth += truckValue(w, t);
  for (const t of w.trucks) if (t.lessorId === companyId && t.companyId !== companyId && t.status !== "retired") wealth += truckValue(w, t);
  for (const tr of w.trailersByCompany.get(companyId) ?? []) if (tr.lease === "owned" && tr.status !== "hooked") wealth += trailerValue(w, tr);
  for (const o of ordersOf(w, companyId)) wealth += orderPrice(w, o);
  for (const f of facilitiesOf(w, companyId)) wealth += cfg.facilities.types[f.type].priceFd;
  return wealth;
}

/** Gini coefficient of non-negative holdings (negative balances count as zero). */
export function gini(values: number[]): number {
  const xs = values.map((x) => Math.max(0, x)).sort((a, b) => a - b);
  const n = xs.length;
  const total = xs.reduce((a, b) => a + b, 0);
  if (n === 0 || total === 0) return 0;
  let weighted = 0;
  xs.forEach((x, i) => (weighted += (i + 1) * x));
  return (2 * weighted) / (n * total) - (n + 1) / n;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** A company's segment for the report: a broker; a carrier running one truck or none (an owner-operator); a fleet. */
export function segmentOf(w: World, c: Company): Segment | null {
  if (c.role === "broker") return "broker";
  if (c.role !== "carrier") return null;
  const trucks = (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired").length;
  return trucks <= 1 ? "ownerOperator" : "fleet";
}

/**
 * The month close (step.ts, after monthlyIntel): the month's record from its tallies and the world as it stands, then
 * fresh tallies. `day` is the month's last day, the one the daily step just closed (the clock already reads the next
 * day there). Companies in the market only: the population dial's retired bots and wallets outside the game are out.
 */
export function monthlyEconomy(w: World, day = dayOf(w.t, w.cfg)): void {
  const b = book(w);
  const min = REPORT_MIN_COMPANIES;
  const t = b.tally;
  const rateByTrailer = {} as EconMonth["rateByTrailer"];
  for (const eq of TRAILERS) {
    const r = t.rate[eq];
    rateByTrailer[eq] = { perMi: r.carriers.size >= min && r.mi > 0 ? r.fd / r.mi : null, mi: r.carriers.size >= min ? Math.round(r.mi) : 0 };
  }
  // Wealth, national, and the median by segment where ten or more companies stand behind it.
  const counted = w.companies.filter((c) => c.role !== "holder" && c.retiredDay === undefined);
  const held = counted.map((c) => companyWealthFd(w, c.id));
  const enough = counted.length >= min;
  const sorted = held.map((x) => Math.max(0, x)).sort((a, b) => b - a);
  const total = sorted.reduce((a, x) => a + x, 0) || 1;
  const topShare = (frac: number) => sorted.slice(0, Math.max(1, Math.round(sorted.length * frac))).reduce((a, x) => a + x, 0) / total;
  const bySeg: Record<Segment, number[]> = { ownerOperator: [], fleet: [], broker: [] };
  counted.forEach((c, i) => {
    const seg = segmentOf(w, c);
    if (seg) bySeg[seg].push(held[i]!);
  });
  const medianBySegment = {} as Record<Segment, number | null>;
  for (const seg of Object.keys(bySeg) as Segment[]) medianBySegment[seg] = bySeg[seg].length >= min ? median(bySeg[seg]) : null;
  const drivers = w.staff.filter((s) => s.kind === "driver" && !s.owner);
  b.months.push({
    index: Math.floor(day / w.cfg.time.daysPerMonth),
    fromDay: day + 1 - w.cfg.time.daysPerMonth,
    toDay: day,
    rateByTrailer,
    destroyed: { ...t.destroyed },
    used: { n: t.used.n, priceOverBook: t.used.companies.size >= min && t.used.bookFd > 0 ? t.used.priceFd / t.used.bookFd : null },
    wealth: { companies: counted.length, gini: enough ? gini(held) : null, top1Share: enough ? topShare(0.01) : null, top10Share: enough ? topShare(0.1) : null, medianBySegment },
    work: { driversEmployed: drivers.filter((s) => s.status === "employed").length, driversPool: drivers.filter((s) => s.status === "pool").length, wageIndex: w.labor.wageIndex },
    newCompanies: w.companies.filter((c) => c.role !== "holder" && c.createdDay > day - w.cfg.time.daysPerMonth && c.createdDay <= day).length,
    dealerIndex: { tractor: { ...w.dealerIndex.tractor }, trailer: { ...w.dealerIndex.trailer } },
  });
  b.tally = emptyTally();
}
