import {
  activeLoanOn,
  borrowingCapacity,
  contractOn,
  depositCredit,
  factoringLog,
  factoringRate,
  factoringRateFor,
  fuelPrice,
  newPrice,
  openPurchaseLoans,
  purchaseTerms,
  tripCost,
  type Company,
  type Loan,
  type PurchaseLoan,
  type Truck,
  type TruckSpec,
  type World,
} from "@lanes/engine";

/**
 * Finance's figures (specs/finance.md), read from the rules without touching the world. The month of running one truck
 * is the client's arithmetic on the engine's own cost rules until the economy's helper lands (the spec's question 1).
 */

/** UX's proposed `ui.finance.milesPerMonth`: a month's driving for one truck. A client constant until the economy signs it off. */
export const MILES_PER_MONTH = 12_000;
/** The share of those miles driven loaded (the rest empty to the next pickup), for the same arithmetic. */
const LOADED_SHARE = 0.85;

/** Does the company own a truck yet (state B), or is it still on the lessor's (state A)? */
export const ownsATruck = (w: World, c: Company): boolean => (w.trucksByCompany.get(c.id) ?? []).some((t) => t.lease === "owned" && t.status !== "retired");

/**
 * About a month of running one owned Workhorse with a dry van: fuel, the driver's pay, maintenance, insurance and the
 * expected repairs over MILES_PER_MONTH, plus a month of a purchase loan's payments on a new one at this company's terms.
 */
export function monthOfCosts(w: World, c: Company): number {
  const truck: TruckSpec = { tier: "workhorse", trailer: "van", lease: "owned", odometer: 0, milesSinceRebuild: 0 };
  const loaded = MILES_PER_MONTH * LOADED_SHARE;
  const run = tripCost(w.cfg, truck, fuelPrice(w), MILES_PER_MONTH, loaded);
  const running = run.fuel + run.wages + run.maintenance + run.insurance;
  const k = w.cfg.equipmentFinance.purchase;
  const terms = purchaseTerms(w, c);
  const borrowed = newPrice(w.cfg, { tier: "workhorse", trailer: "van" }) * (1 - terms.downShare);
  const weeks = w.cfg.time.daysPerMonth / 7;
  const loan = k.enabled ? (borrowed / k.termWeeks + borrowed * terms.weeklyRate) * weeks : 0;
  return running + loan;
}

/** The lease deposit that counts toward the first truck. */
export const leaseDeposit = (w: World, c: Company): number => depositCredit(w, c);

/** The factoring rate this company would sign at today. */
export const rateToday = (w: World, c: Company): number => (c.role === "broker" ? w.cfg.token.payment.factoring.contract.brokerRate : factoringRateFor(w, c));

/** The contract's log line: what it has factored and what it has kept, so far. */
export function contractSoFar(w: World, c: Company): { invoicesFd: number; feesFd: number } | null {
  const f = c.factoring;
  if (!f || f.log === undefined) return null;
  const e = factoringLog(w).contracts[f.log];
  return e ? { invoicesFd: e.invoicesFd, feesFd: e.feesFd } : null;
}

/** The fold's rows: the rate at 1, 5, 10, 20, 30 … trucks, stopping at the company cap, the company's own size marked. */
export function rateLadder(w: World, trucks: number): { n: number; rate: number; you: boolean }[] {
  const max = w.cfg.company.maxTrucks;
  const ns = [1, 5, 10, 20, 30, 40, 50].filter((n) => n <= max);
  if (!ns.includes(trucks) && trucks >= 1 && trucks <= max) ns.push(trucks);
  return ns.sort((a, b) => a - b).map((n) => ({ n, rate: factoringRate(w, n), you: n === trucks }));
}

/** Loads for player shippers wait net even under contract: how many, and how much. */
export function playerPaperWaiting(w: World, c: Company): { n: number; fd: number } {
  let n = 0;
  let fd = 0;
  for (const r of w.receivables) if (r.holder === c.id && r.payer !== 0) (n++, (fd += r.amountFd));
  return { n, fd };
}

/** The company runs a truck the lessor pays on delivery. */
export const hasLeasedTrucks = (w: World, c: Company): boolean => (w.trucksByCompany.get(c.id) ?? []).some((t) => t.lease !== "owned" && t.status !== "retired");

/** A loan as Finance lists it: the truck, what's owed, the weekly payment, the weeks left, misses. */
export interface LoanRow {
  kind: "purchase" | "equipment";
  id: number;
  truckId: number;
  owedFd: number;
  weeklyFd: number;
  weeksLeft: number;
  missed: number;
}
export function loanRows(w: World, c: Company): LoanRow[] {
  const ef = w.cfg.equipmentFinance;
  const eq = w.finance.loans.filter((l: Loan) => l.borrowerId === c.id && l.status === "active");
  const pu = openPurchaseLoans(w, c.id).filter((l: PurchaseLoan) => l.status === "active");
  const row = (kind: LoanRow["kind"], id: number, truckId: number, owed: number, original: number, termWeeks: number, rate: number, missed: number): LoanRow => {
    const step = original / termWeeks;
    return { kind, id, truckId, owedFd: owed, weeklyFd: Math.min(owed, step) + owed * rate, weeksLeft: Math.ceil(owed / Math.max(1e-9, step)), missed };
  };
  return [
    ...pu.map((l) => row("purchase", l.id, l.truckId, l.principalFd, l.originalFd, l.termWeeks, l.weeklyRate, l.missed)),
    ...eq.map((l) => row("equipment", l.id, l.truckId, l.principalFd, l.originalFd, ef.termWeeks, ef.weeklyRate, l.missed)),
  ];
}

/** Owned trucks with room to borrow against, and how much. */
export function borrowable(w: World, trucks: Truck[]): { t: Truck; cap: number }[] {
  return trucks.filter((t) => t.lease === "owned" && !activeLoanOn(w, t.id)).map((t) => ({ t, cap: Math.floor(borrowingCapacity(w, t)) })).filter((x) => x.cap >= 100);
}

/** The weekly payment on an equipment loan of this size, at its first week. */
export const equipmentWeekly = (w: World, fd: number): number => fd / w.cfg.equipmentFinance.termWeeks + fd * w.cfg.equipmentFinance.weeklyRate;

export { contractOn };
