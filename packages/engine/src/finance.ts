import { dayOf } from "./clock.js";
import { companyAccount } from "./ledger.js";
import type { Loan, Truck } from "./types.js";
import { truckValue } from "./dealer.js";
import { poolsOn } from "./pools.js";
import type { World } from "./world.js";

/**
 * Equipment Finance (§DeFi buildings), in FD. Depositors buy shares in a pool
 * worth its cash plus what borrowers owe; borrowers pay 1% a week. Every yield is
 * paid by borrowers — nothing is printed — so deposits, loans and interest are
 * all transfers between players. Losses on repossessions fall on depositors.
 */
export const POOL_ACCOUNT = "co:pool:equipment_finance";

export function poolCash(w: World): number {
  return w.ledger.balance(POOL_ACCOUNT);
}

export function poolValue(w: World): number {
  return poolCash(w) + w.finance.outstandingFd;
}

function sharePrice(w: World): number {
  return w.finance.totalShares > 0 ? poolValue(w) / w.finance.totalShares : 1;
}

export function depositorValue(w: World, companyId: number): number {
  return (w.finance.shares.get(companyId) ?? 0) * sharePrice(w);
}

/** `equipmentFinance.closedWithPools`: Equipment Finance stands down with the lending pools (deposits and new loans). */
const closed = (w: World): boolean => w.cfg.equipmentFinance.closedWithPools && !poolsOn(w);

export function deposit(w: World, companyId: number, amountFd: number): string | null {
  if (closed(w)) return "the lending pools are closed";
  if (!(amountFd > 0) || w.ledger.balance(companyAccount(companyId)) < amountFd) return "insufficient FD";
  // A pool wiped out by write-offs starts over: the old shares are worth nothing.
  if (w.finance.totalShares > 0 && poolValue(w) <= 0.01) {
    w.finance.shares.clear();
    w.finance.totalShares = 0;
  }
  const shares = amountFd / sharePrice(w);
  w.ledger.post(w.t, companyAccount(companyId), POOL_ACCOUNT, amountFd, `deposit:${companyId}`);
  w.finance.shares.set(companyId, (w.finance.shares.get(companyId) ?? 0) + shares);
  w.finance.totalShares += shares;
  return null;
}

/** Withdraws up to the depositor's value, as far as the pool's cash allows (lent-out FD stays lent). */
export function withdraw(w: World, companyId: number, amountFd: number): string | null {
  const amount = Math.min(amountFd, depositorValue(w, companyId), poolCash(w));
  if (!(amount > 0.01)) return "nothing to withdraw";
  const shares = amount / sharePrice(w);
  w.ledger.post(w.t, POOL_ACCOUNT, companyAccount(companyId), amount, `withdraw:${companyId}`);
  w.finance.shares.set(companyId, (w.finance.shares.get(companyId) ?? 0) - shares);
  w.finance.totalShares -= shares;
  return null;
}

export function activeLoanOn(w: World, truckId: number): Loan | undefined {
  return w.finance.loans.find((l) => l.truckId === truckId && (l.status === "active" || l.status === "defaulted"));
}

/** Most a truck can secure: 35% of its market value, if it isn't already pledged. */
export function borrowingCapacity(w: World, truck: Truck): number {
  if (truck.lease !== "owned" || activeLoanOn(w, truck.id)) return 0;
  const k = w.cfg.equipmentFinance;
  const cap = k.maxLoanToValue * truckValue(w, truck);
  if (!k.netOfPurchaseLoans) return cap;
  // A truck still on a purchase loan pledges only what isn't owed on it already.
  let owed = 0;
  for (const l of w.purchaseLoans) if (l.truckId === truck.id && (l.status === "active" || l.status === "defaulted")) owed += l.principalFd;
  return Math.max(0, cap - owed);
}

/**
 * Who writes a Borrow loan, for the screen (R7 and R19; economy-player34.md §5a): "pool" while the lending pools are
 * open, when Equipment Finance's depositors lend; "off" while they are stood down (`pools.ts poolsOn`: Jeff's "for now,
 * let's not use the pools"), and Borrow isn't shown; with `equipmentFinance.closedWithPools` on, `borrow` refuses then
 * too. The NPC lender writes purchase loans only, never a cash-out loan against a truck already owned (that would print
 * FD with no purchase behind it; DECISIONS.md, 2026-11-03), so there is no third state.
 */
export const borrowLender = (w: World): "pool" | "off" => (poolsOn(w) ? "pool" : "off");

/** What Borrow offers below the cap, because the truck loses value by the mile before a confirm lands. */
export const BORROW_CAP_SHARE = 0.98;

/**
 * What the lender will lend on this truck now, for the screen's offer (R7: only what the lender gives): the truck's cap
 * at 98%, no more than the pool's cash, rounded down to the 100. 0 while the pools are off, for a truck that isn't the
 * company's to pledge, or with nothing to lend. Pure: `borrow` accepts any amount up to it.
 */
export function lendNowFd(w: World, companyId: number, truck: Truck): number {
  if (borrowLender(w) === "off" || truck.companyId !== companyId || (truck.lessorId !== 0 && truck.lessorId !== companyId)) return 0;
  const fd = Math.floor(Math.min(borrowingCapacity(w, truck) * BORROW_CAP_SHARE, poolCash(w)) / 100) * 100;
  return fd >= 100 ? fd : 0;
}

export function borrow(w: World, companyId: number, truck: Truck, amountFd: number): string | null {
  if (closed(w)) return "the lending pools are closed";
  if (truck.companyId !== companyId) return "not your truck";
  if (truck.lessorId !== 0 && truck.lessorId !== companyId) return "a leased truck is its owner's to pledge";
  if (amountFd <= 0 || amountFd > borrowingCapacity(w, truck) + 0.01) return "over the loan-to-value limit";
  if (amountFd > poolCash(w)) return "the pool doesn't have the cash";
  const f = w.finance;
  f.loans.push({ id: f.loans.length + 1, borrowerId: companyId, truckId: truck.id, originalFd: amountFd, principalFd: amountFd, missed: 0, status: "active" });
  f.loansMade++;
  f.outstandingFd += amountFd;
  f.peakOutstandingFd = Math.max(f.peakOutstandingFd, f.outstandingFd);
  w.ledger.post(w.t, POOL_ACCOUNT, companyAccount(companyId), amountFd, `loan:${f.loans.length}`);
  return null;
}

export function repayLoan(w: World, companyId: number, loanId: number): string | null {
  const loan = w.finance.loans[loanId - 1];
  if (!loan || loan.borrowerId !== companyId || loan.status !== "active") return "no such active loan";
  if (w.ledger.balance(companyAccount(companyId)) < loan.principalFd) return "insufficient FD";
  w.ledger.post(w.t, companyAccount(companyId), POOL_ACCOUNT, loan.principalFd, `repay:${loan.id}`);
  w.finance.outstandingFd -= loan.principalFd;
  loan.principalFd = 0;
  loan.status = "repaid";
  return null;
}

/**
 * Weekly service: 1% interest plus an even share of the original principal. A
 * borrower who can't pay misses the payment (the interest is added to what's
 * owed); the second miss in a row defaults the loan, and the repo man comes for
 * the truck.
 */
export function serviceLoans(w: World): void {
  const { equipmentFinance: ef } = w.cfg;
  const f = w.finance;
  for (const loan of f.loans) {
    if (loan.status !== "active") continue;
    const interest = loan.principalFd * ef.weeklyRate;
    const principal = Math.min(loan.principalFd, loan.originalFd / ef.termWeeks);
    const acct = companyAccount(loan.borrowerId);
    if (w.ledger.balance(acct) >= interest + principal) {
      w.ledger.post(w.t, acct, POOL_ACCOUNT, interest + principal, `payment:${loan.id}`);
      f.interestPaidFd += interest;
      f.outstandingFd -= principal;
      loan.principalFd -= principal;
      loan.missed = 0;
      if (loan.principalFd <= 0.01) {
        f.outstandingFd -= loan.principalFd;
        loan.principalFd = 0;
        loan.status = "repaid";
      }
      if (f.outstandingFd < 0.005) f.outstandingFd = 0;
    } else {
      loan.missed++;
      loan.principalFd += interest;
      f.outstandingFd += interest;
      if (loan.missed >= ef.missedPaymentsToRepossess) loan.status = "defaulted";
    }
  }
}

/**
 * Settles a loan from a sale of its truck: the pool takes what it's owed (as
 * far as the proceeds go) and writes off the rest. Returns what's left over.
 */
export function settleLoanFromSale(w: World, loan: Loan, fromAccount: string, proceedsFd: number): number {
  const f = w.finance;
  const paid = Math.min(proceedsFd, loan.principalFd);
  if (paid > 0) w.ledger.post(w.t, fromAccount, POOL_ACCOUNT, paid, `settle:${loan.id}`);
  f.outstandingFd -= loan.principalFd;
  f.writtenOffFd += loan.principalFd - paid;
  loan.principalFd = 0;
  loan.status = "closed";
  return proceedsFd - paid;
}

/** Closes a repossessed truck's loan from sale proceeds already in the pool. Returns the surplus over what was owed. */
export function closeLoanFromPoolProceeds(w: World, loan: Loan, proceedsFd: number): number {
  const covered = Math.min(proceedsFd, loan.principalFd);
  w.finance.outstandingFd -= loan.principalFd;
  w.finance.writtenOffFd += loan.principalFd - covered;
  loan.principalFd = 0;
  loan.status = "closed";
  return proceedsFd - covered;
}

/** Writes off a loan whose truck went back to dealer supply unsold. */
export function writeOffLoan(w: World, loan: Loan): void {
  w.finance.outstandingFd -= loan.principalFd;
  w.finance.writtenOffFd += loan.principalFd;
  loan.principalFd = 0;
  loan.status = "closed";
}

/**
 * Season close: the pool pays its cash out to depositors pro rata before the
 * burn ("pool deposits reset with the season close"). What borrowers still owe
 * stays as depositors' claims into the next season.
 */
export function returnPoolCashToDepositors(w: World): void {
  const f = w.finance;
  const cash = poolCash(w);
  const value = poolValue(w);
  if (cash <= 0.01 || f.totalShares <= 0 || value <= 0) return;
  const keepShare = 1 - cash / value;
  for (const [companyId, shares] of [...f.shares]) {
    const payout = (cash * shares) / f.totalShares;
    if (payout > 0.01) w.ledger.post(w.t, POOL_ACCOUNT, companyAccount(companyId), Math.floor(payout * 100) / 100, `withdraw:${companyId}`);
    f.shares.set(companyId, shares * keepShare);
  }
  f.totalShares *= keepShare;
}
