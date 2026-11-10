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
 *
 * Risk pricing (equipmentFinance.purchase.risk, off by default): the rate also follows the borrower's leverage, and
 * a bust covenant brings a thin borrower's default forward (riskPremium below).
 */
import { dayOf } from "./clock.js";
import { clamp } from "./economics.js";
import { creditScore } from "./credit.js";
import { orderPrice, ordersOf, trailerValue, truckValue } from "./dealer.js";
import { companyAccount } from "./ledger.js";
import { salesTaxOn } from "./salesTax.js";
import type { Company, PurchaseLoan } from "./types.js";
import { closePurchaseLoan, detachTruck, loanStakeAccount, truckById, type World } from "./world.js";

const lerp = (a: number, b: number, s: number) => a + (b - a) * s;

/** The truck as the lender reads it (equipmentFinance.purchase.collateral): its age in years and its odometer. */
export interface Collateral {
  ageYears: number;
  odometer: number;
}
/** A new rig or tractor from a dealer: no age, no miles. */
export const NEW_TRUCK: Collateral = { ageYears: 0, odometer: 0 };
/** A truck's (or a used lot rig's) age and miles, a year being the calendar's season (dealer.ts lotSpec counts so). */
export const collateralOf = (w: World, t: { builtDay: number; odometer: number }): Collateral => ({ ageYears: Math.max(0, (dayOf(w.t, w.cfg) - t.builtDay) / w.cfg.time.daysPerSeason), odometer: t.odometer });

/** The terms of a purchase loan; `declined` when the lender won't write one on this truck, and the down payment's parts. */
export interface PurchaseTerms {
  downShare: number;
  weeklyRate: number;
  maxLoans: number;
  termWeeks: number;
  /** collateral on: why the lender won't finance this truck (cash only), else null. */
  declined: string | null;
  /** collateral on: the down payment's shares, for the sheet to say why (credit, the truck's age and miles, a new business). */
  parts?: { credit: number; age: number; miles: number; newBusiness: number };
}

/**
 * What the lender offers this company, from its credit: strong (100) gets the first of each range. With
 * equipmentFinance.purchase.collateral on and the truck given, it reads the truck too (age and miles, never condition), and
 * a company under a year old that has never owned a truck puts more down; off, or with no truck, the credit alone.
 */
export function purchaseTerms(w: World, c: Company, truck?: Collateral): PurchaseTerms {
  const k = w.cfg.equipmentFinance.purchase;
  const weak = 1 - clamp(creditScore(w, c) / 100, 0, 1);
  const base: PurchaseTerms = {
    downShare: lerp(k.downShare[0], k.downShare[1], weak),
    weeklyRate: lerp(k.weeklyRate[0], k.weeklyRate[1], weak),
    maxLoans: Math.round(lerp(k.maxLoans[0], k.maxLoans[1], weak)),
    termWeeks: k.termWeeks,
    declined: null,
  };
  const col = k.collateral;
  if (col?.enabled !== true) return base;
  const daysPerYear = w.cfg.time.daysPerSeason;
  const fresh = c.firstOwnedTruckDay === null && dayOf(w.t, w.cfg) - c.authority.since < col.newBusiness.years * daysPerYear;
  const newBusiness = fresh ? col.newBusiness.downAdd : 0;
  const age = truck ? Math.max(0, truck.ageYears - col.freeYears) * col.downPerYear : 0;
  const miles = truck ? (Math.max(0, truck.odometer - col.freeMiles) / 100_000) * col.downPer100kMi : 0;
  const parts = { credit: base.downShare, age, miles, newBusiness };
  const terms: PurchaseTerms = { ...base, downShare: Math.min(col.maxDownShare, base.downShare + age + miles + newBusiness), parts };
  if (!truck) return terms;
  if (truck.ageYears > col.declineOverYears) return { ...terms, declined: `the lender won't finance a truck over ${col.declineOverYears} years old: cash only` };
  if (truck.odometer > col.declineOverMiles) return { ...terms, declined: `the lender won't finance a truck past ${col.declineOverMiles.toLocaleString("en-US")} miles: cash only` };
  const weeksPerYear = daysPerYear / 7;
  terms.termWeeks = Math.max(col.minTermWeeks, Math.min(k.termWeeks, Math.floor((col.payoffYears - truck.ageYears) * weeksPerYear)));
  terms.weeklyRate = base.weeklyRate + Math.max(0, truck.ageYears - col.freeYears) * col.weeklyRatePerYear;
  return terms;
}

export function openPurchaseLoans(w: World, companyId: number): PurchaseLoan[] {
  return w.purchaseLoans.filter((l) => l.borrowerId === companyId && (l.status === "active" || l.status === "defaulted"));
}

/** The cash a financed purchase at this price needs: the down payment, the stake and the sales tax (on this truck, collateral on). */
export function financedCashNeed(w: World, c: Company, priceFd: number, truck?: Collateral): number {
  const { downShare } = purchaseTerms(w, c, truck);
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
export function financeBlock(w: World, c: Company, priceFd: number, extraFd = 0, truck?: Collateral): string | null {
  const k = w.cfg.equipmentFinance.purchase;
  if (!k.enabled) return "no purchase loans";
  if (priceFd <= 0.01) return "nothing to finance";
  const terms = purchaseTerms(w, c, truck);
  if (terms.declined) return terms.declined;
  if (openPurchaseLoans(w, c.id).length >= terms.maxLoans) return `the lender carries at most ${terms.maxLoans} loans at your credit`;
  if (w.ledger.balance(companyAccount(c.id)) + extraFd < financedCashNeed(w, c, priceFd, truck)) return "not enough FD for the down payment and the loan's stake";
  return null;
}

export function financePurchase(w: World, c: Company, priceFd: number, truck?: Collateral): PurchaseLoan | string {
  const why = financeBlock(w, c, priceFd, 0, truck);
  if (why) return why;
  const k = w.cfg.equipmentFinance.purchase;
  const terms = purchaseTerms(w, c, truck);
  const loanFd = priceFd * (1 - terms.downShare);
  const loan: PurchaseLoan = {
    id: w.purchaseLoans.length + 1,
    borrowerId: c.id,
    orderId: 0,
    truckId: 0,
    originalFd: loanFd,
    principalFd: loanFd,
    weeklyRate: terms.weeklyRate,
    termWeeks: terms.termWeeks,
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

/** What a company owes: its open purchase loans and its Equipment Finance loans. */
export function debtFd(w: World, companyId: number): number {
  let debt = 0;
  for (const l of openPurchaseLoans(w, companyId)) debt += l.principalFd;
  for (const l of w.finance.loans) if (l.borrowerId === companyId && (l.status === "active" || l.status === "defaulted")) debt += l.principalFd;
  return debt;
}

/**
 * Debt over equity, as the lender reads the books: cash, the trucks and spare trailers it owns or has on order and
 * its loan stakes, less what it owes. No debt is 0; equity at or under nothing is Infinity.
 */
export function debtToEquity(w: World, c: Company): number {
  const debt = debtFd(w, c.id);
  if (debt <= 0.01) return 0;
  let assets = Math.max(0, w.ledger.balance(companyAccount(c.id)));
  for (const t of w.trucksByCompany.get(c.id) ?? []) if (t.status !== "retired" && (!t.lessorId || t.lessorId === c.id)) assets += truckValue(w, t);
  for (const tr of w.trailersByCompany.get(c.id) ?? []) if (tr.lease === "owned" && tr.status !== "hooked") assets += trailerValue(w, tr);
  for (const o of ordersOf(w, c.id)) assets += orderPrice(w, o); // a truck on order counts at its price
  for (const l of openPurchaseLoans(w, c.id)) assets += w.ledger.balance(loanStakeAccount(l.id));
  const equity = assets - debt;
  return equity > 0.01 ? debt / equity : Infinity;
}

/** A week of the payments on a company's active purchase loans, at their credit rates. */
export function weeklyLoanPayments(w: World, companyId: number): number {
  let s = 0;
  for (const l of openPurchaseLoans(w, companyId)) if (l.status === "active") s += Math.min(l.principalFd, l.originalFd / l.termWeeks) + l.principalFd * l.weeklyRate;
  return s;
}

/**
 * Risk pricing (equipmentFinance.purchase.risk): the weekly rate a borrower pays over each loan's credit rate, and
 * whether it is in breach of the bust covenant. Nothing when the switch is off or the company owes nothing.
 */
export function riskPremium(w: World, c: Company): { rate: number; breach: boolean } {
  const k = w.cfg.equipmentFinance.purchase.risk;
  if (!k.enabled) return { rate: 0, breach: false };
  const de = debtToEquity(w, c);
  if (de === 0) return { rate: 0, breach: false };
  let rate = Math.min(k.maxPremium, k.perDebtToEquity * Math.max(0, de - k.freeDebtToEquity));
  let breach = false;
  const cv = k.covenant;
  if (cv.enabled && w.feeds.cycle(dayOf(w.t, w.cfg)) < cv.bustBelow && w.ledger.balance(companyAccount(c.id)) < cv.coverWeeks * weeklyLoanPayments(w, c.id)) {
    breach = true;
    rate += cv.premium;
  }
  return { rate, breach };
}

/** What risk pricing has done in this world (reports only): premiums paid, borrower-weeks in breach, covenant defaults. */
const riskTally = new WeakMap<World, { premiumFd: number; payingWeeks: number; breachWeeks: number; covenantDefaults: number }>();
export const riskStats = (w: World) => riskTally.get(w) ?? { premiumFd: 0, payingWeeks: 0, breachWeeks: 0, covenantDefaults: 0 };

/**
 * Weekly: each open loan pays its interest and an even share of what it borrowed. A borrower who can't
 * pay misses (the interest is added to what's owed); after `missedToDefault` misses in a row the loan
 * defaults, and the lender takes the truck the next time it's idle at a hub. With risk pricing on, the
 * interest includes the borrower's premium (a sink of its own, `loan_risk`), and a borrower in breach of
 * the bust covenant defaults on its first miss.
 */
export function weeklyPurchaseLoans(w: World): void {
  const k = w.cfg.equipmentFinance.purchase;
  const risks = new Map<number, { rate: number; breach: boolean }>();
  const riskOf = (id: number) => {
    let r = risks.get(id);
    if (!r) {
      risks.set(id, (r = riskPremium(w, w.companies[id - 1]!)));
      if (k.risk.enabled && (r.rate > 0 || r.breach)) {
        let t = riskTally.get(w);
        if (!t) riskTally.set(w, (t = { premiumFd: 0, payingWeeks: 0, breachWeeks: 0, covenantDefaults: 0 }));
        if (r.rate > 0) t.payingWeeks++;
        if (r.breach) t.breachWeeks++;
      }
    }
    return r;
  };
  for (const loan of w.purchaseLoans) {
    if (loan.status === "active") {
      const acct = companyAccount(loan.borrowerId);
      const risk = k.risk.enabled ? riskOf(loan.borrowerId) : { rate: 0, breach: false };
      const premium = loan.principalFd * risk.rate;
      const interest = loan.principalFd * loan.weeklyRate + premium;
      const principal = Math.min(loan.principalFd, loan.originalFd / loan.termWeeks);
      if (w.ledger.balance(acct) >= interest + principal) {
        if (premium > 0.005) {
          w.ledger.post(w.t, acct, "sink:loan_risk", premium, `loan:${loan.id}`);
          riskTally.get(w)!.premiumFd += premium;
        }
        if (interest - premium > 0.005) w.ledger.post(w.t, acct, "sink:loan_interest", interest - premium, `loan:${loan.id}`);
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
        if (loan.missed >= (risk.breach ? k.risk.covenant.missedToDefault : k.missedToDefault)) {
          loan.status = "defaulted";
          w.purchaseLending.defaults++;
          if (risk.breach && loan.missed < k.missedToDefault) riskTally.get(w)!.covenantDefaults++;
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
