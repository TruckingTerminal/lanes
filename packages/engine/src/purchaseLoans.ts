/**
 * Purchase loans (equipmentFinance.purchase; Jeff, 2026-10-31): a truck bought on credit from the NPC
 * lender, secured by the truck itself and an FD stake.
 *
 * The buyer puts down a share of the price and locks a stake against the loan; the lender pays the rest
 * (a faucet, which the purchase sinks straight back) and is repaid weekly with interest (sinks). The
 * stronger the buyer's credit (credit.ts), the less it puts down, the lower its rate and the more loans
 * it may carry. Two missed payments default the loan: the lender takes the truck the next time it's idle
 * at a hub, at its market value, the stake covers what that doesn't, and the rest is written off. A truck
 * that leaves its owner while its loan is open settles it at once (world.ts detachTruck).
 */
import { clamp } from "./economics.js";
import { creditScore } from "./credit.js";
import { truckValue } from "./dealer.js";
import { companyAccount } from "./ledger.js";
import { salesTaxOn } from "./salesTax.js";
import type { Company, PurchaseLoan } from "./types.js";
import { closePurchaseLoan, detachTruck, loanStakeAccount, truckById, type World } from "./world.js";

const lerp = (a: number, b: number, s: number) => a + (b - a) * s;

/** What the lender offers this company, from its credit: strong (100) gets the first of each range. */
export function purchaseTerms(w: World, c: Company): { downShare: number; weeklyRate: number; maxLoans: number } {
  const k = w.cfg.equipmentFinance.purchase;
  const weak = 1 - clamp(creditScore(w, c) / 100, 0, 1);
  return {
    downShare: lerp(k.downShare[0], k.downShare[1], weak),
    weeklyRate: lerp(k.weeklyRate[0], k.weeklyRate[1], weak),
    maxLoans: Math.round(lerp(k.maxLoans[0], k.maxLoans[1], weak)),
  };
}

export function openPurchaseLoans(w: World, companyId: number): PurchaseLoan[] {
  return w.purchaseLoans.filter((l) => l.borrowerId === companyId && (l.status === "active" || l.status === "defaulted"));
}

/** The cash a financed purchase at this price needs: the down payment, the stake and the sales tax. */
export function financedCashNeed(w: World, c: Company, priceFd: number): number {
  const { downShare } = purchaseTerms(w, c);
  return priceFd * downShare + priceFd * (1 - downShare) * w.cfg.equipmentFinance.purchase.stakeShare + salesTaxOn(w, priceFd);
}

/**
 * Opens a loan for a purchase at this price, before the purchase itself: the lender's share lands in the
 * buyer's account and the stake is locked, so the purchase then pays the full price as for cash. Returns
 * the loan, or why not.
 */
/**
 * Why a purchase loan at this price would be refused, without opening one: the same checks financePurchase makes, with
 * `extraFd` counted as cash (a lease deposit about to be released toward the truck). Null when it would go through.
 */
export function financeBlock(w: World, c: Company, priceFd: number, extraFd = 0): string | null {
  const k = w.cfg.equipmentFinance.purchase;
  if (!k.enabled) return "no purchase loans";
  if (priceFd <= 0.01) return "nothing to finance";
  const terms = purchaseTerms(w, c);
  if (openPurchaseLoans(w, c.id).length >= terms.maxLoans) return `the lender carries at most ${terms.maxLoans} loans at your credit`;
  if (w.ledger.balance(companyAccount(c.id)) + extraFd < financedCashNeed(w, c, priceFd)) return "not enough FD for the down payment and the loan's stake";
  return null;
}

export function financePurchase(w: World, c: Company, priceFd: number): PurchaseLoan | string {
  const k = w.cfg.equipmentFinance.purchase;
  const why = financeBlock(w, c, priceFd);
  if (why) return why;
  const terms = purchaseTerms(w, c);
  const loanFd = priceFd * (1 - terms.downShare);
  const loan: PurchaseLoan = {
    id: w.purchaseLoans.length + 1,
    borrowerId: c.id,
    orderId: 0,
    truckId: 0,
    originalFd: loanFd,
    principalFd: loanFd,
    weeklyRate: terms.weeklyRate,
    termWeeks: k.termWeeks,
    stakeFd: loanFd * k.stakeShare,
    missed: 0,
    status: "active",
  };
  w.purchaseLoans.push(loan);
  w.ledger.post(w.t, "faucet:npc_finance", companyAccount(c.id), loanFd, `loan:${loan.id}`);
  if (loan.stakeFd > 0.005) w.ledger.post(w.t, companyAccount(c.id), loanStakeAccount(loan.id), loan.stakeFd, `loan:${loan.id}`);
  w.purchaseLending.madeFd += loanFd;
  return loan;
}

/** Undoes a loan whose purchase then fell through: the lender's share goes back and the stake is released. */
export function cancelPurchaseLoan(w: World, loan: PurchaseLoan): void {
  const acct = companyAccount(loan.borrowerId);
  const stake = w.ledger.balance(loanStakeAccount(loan.id));
  if (stake > 0.005) w.ledger.post(w.t, loanStakeAccount(loan.id), acct, stake, `loan:${loan.id}`);
  w.ledger.post(w.t, acct, "sink:npc_finance", loan.originalFd, `loan:${loan.id}`);
  w.purchaseLending.madeFd -= loan.originalFd;
  loan.principalFd = 0;
  loan.status = "closed";
}

/** A dealer order's loan takes the truck it paid for as security when the truck arrives. */
export function bindOrderLoan(w: World, orderId: number, truckId: number): void {
  const loan = w.purchaseLoans.find((l) => l.orderId === orderId && l.truckId === 0);
  if (loan) loan.truckId = truckId;
}

/**
 * Weekly: each open loan pays its interest and an even share of what it borrowed. A borrower who can't
 * pay misses (the interest is added to what's owed); after `missedToDefault` misses in a row the loan
 * defaults, and the lender takes the truck the next time it's idle at a hub.
 */
export function weeklyPurchaseLoans(w: World): void {
  const k = w.cfg.equipmentFinance.purchase;
  for (const loan of w.purchaseLoans) {
    if (loan.status === "active") {
      const acct = companyAccount(loan.borrowerId);
      const interest = loan.principalFd * loan.weeklyRate;
      const principal = Math.min(loan.principalFd, loan.originalFd / loan.termWeeks);
      if (w.ledger.balance(acct) >= interest + principal) {
        if (interest > 0.005) w.ledger.post(w.t, acct, "sink:loan_interest", interest, `loan:${loan.id}`);
        if (principal > 0.005) w.ledger.post(w.t, acct, "sink:loan_principal", principal, `loan:${loan.id}`);
        w.purchaseLending.interestFd += interest;
        loan.principalFd -= principal;
        loan.missed = 0;
        if (loan.principalFd <= 0.01) {
          loan.principalFd = 0;
          const stake = w.ledger.balance(loanStakeAccount(loan.id));
          if (stake > 0.005) w.ledger.post(w.t, loanStakeAccount(loan.id), acct, stake, `loan:${loan.id}`);
          loan.status = "repaid";
        }
      } else {
        loan.missed++;
        loan.principalFd += interest;
        if (loan.missed >= k.missedToDefault) {
          loan.status = "defaulted";
          w.purchaseLending.defaults++;
        }
      }
    }
    if (loan.status === "defaulted") seize(w, loan);
  }
}

/**
 * The lender takes a defaulted loan's truck at its market value once it's idle at a hub (a truck still on
 * order, or gone, leaves only the stake). The stake covers what the truck doesn't; the rest is written
 * off, and any value over what's owed goes back to the borrower.
 */
function seize(w: World, loan: PurchaseLoan): void {
  if (loan.truckId === 0) {
    if (w.orders.some((o) => o.id === loan.orderId)) return; // still at the dealer: wait for it
    closePurchaseLoan(w, loan, true);
    return;
  }
  const truck = truckById(w, loan.truckId);
  if (truck.companyId !== loan.borrowerId) {
    closePurchaseLoan(w, loan, true);
    return;
  }
  if (truck.status !== "idle" && truck.status !== "parked") return;
  const value = truckValue(w, truck);
  const covered = Math.min(value, loan.principalFd);
  loan.principalFd -= covered;
  if (value - covered > 0.01) w.ledger.post(w.t, "faucet:npc_finance", companyAccount(loan.borrowerId), value - covered, `seized:${loan.id}`);
  closePurchaseLoan(w, loan, true);
  // Off the borrower's books; the lender sells it on away from this market.
  detachTruck(w, truck);
  truck.status = "retired";
  w.purchaseLending.seized++;
}
