/**
 * Payment terms and factoring (0.18.0, TOKENOMICS.md §4). With `token.payment` on, freight is paid
 * net-N days instead of on delivery: the payee holds a receivable until its due day. A payee may
 * take quick pay (the payer pays now, less a fee) or sign a factoring contract for a term, with a
 * stake behind it: the factoring pool, or the NPC factor as the dearer backstop, advances each
 * invoice now at a discount priced by the payer (NPC shipper paper is safer than a player's) and
 * collects it at due. Leaving the contract early forfeits the stake to the pool. The NPC lessor
 * pays its leased trucks on delivery and takes the paper itself, so the free path runs on no
 * working capital. The surety pool covers a broker's receivable when the broker is wound up before
 * paying, up to the bond, if the pool wrote that broker's bond. Off, every payment posts at once.
 */
import { dayOf } from "./clock.js";
import { loadCreditPremium, recordPayment } from "./credit.js";
import { companyAccount } from "./ledger.js";
import { payClaim, poolAccount, poolLineCash, poolMarkup, poolsOn } from "./pools.js";
import type { Company, Receivable } from "./types.js";
import { companyById, operatingTrucks, type World } from "./world.js";

/** Who holds the receivable: the payee, the factoring pool, or an NPC (the factor or the lessor: nothing moves in the game when it collects). */
export const HOLDER_POOL = -1;
export const HOLDER_NPC_FACTOR = -2;

/** Stakes behind a company's contracts (factoring, the insurance deductible): returned at term, the pool's recourse before that. */
export const contractAccount = (companyId: number) => `co:contract:${companyId}`;

export interface Bill {
  /** Company id, or 0 for an NPC payer (then `faucet` names the money's source). */
  payer: number;
  faucet?: string;
  payee: Company;
  amountFd: number;
  ref: string;
  /** The haul was on an NPC-leased truck: the lessor pays on delivery and takes the paper. */
  leased?: boolean;
}

function payNow(w: World, b: Bill, amountFd: number): void {
  if (amountFd <= 0) return;
  const from = b.payer === 0 ? b.faucet! : companyAccount(b.payer);
  w.ledger.post(w.t, from, companyAccount(b.payee.id), amountFd, b.ref);
}

/** The stake a factoring contract takes: two weeks of invoices, sized by the fleet, or a flat sum for a broker or shipper. */
export function factoringStake(w: World, c: Company): number {
  const f = w.cfg.token.payment.factoring;
  return c.role === "carrier" ? f.stakePerTruckFd * Math.max(1, operatingTrucks(w, c.id)) : f.stakeBrokerFd;
}

/** Signs a factoring contract for the term: the stake is locked and every invoice is factored until it ends. */
export function signFactoring(w: World, c: Company): string | null {
  if (!w.cfg.token.payment.enabled) return "payment terms aren't on";
  if (c.factoring) return null;
  if (c.liquidatingSince !== null) return "in liquidation";
  const stake = factoringStake(w, c);
  if (w.ledger.balance(companyAccount(c.id)) < stake) return "the contract stake needs more FD";
  w.ledger.post(w.t, companyAccount(c.id), contractAccount(c.id), stake, `contract:factoring:${c.id}`);
  c.factoring = { until: dayOf(w.t, w.cfg) + w.cfg.token.payment.factoring.termDays, stakeFd: stake };
  c.payTerms = "factor";
  return null;
}

/** Ends the contract: at term the stake comes back; early, it is forfeited to the pool. */
export function endFactoring(w: World, c: Company, early: boolean): void {
  const k = c.factoring;
  if (!k) return;
  const ref = `contract:factoring:${c.id}`;
  if (early && w.cfg.token.payment.factoring.earlyExitForfeits) {
    w.ledger.post(w.t, contractAccount(c.id), poolAccount("factoring"), k.stakeFd, ref);
    w.pools.factoring.premiumsFd += k.stakeFd;
  } else {
    w.ledger.post(w.t, contractAccount(c.id), companyAccount(c.id), k.stakeFd, ref);
  }
  c.factoring = null;
  if (c.payTerms === "factor") c.payTerms = "net";
}

/** Liquidation: contract stakes go first to the pool that holds the company's paper, the rest back to cash for the creditors. */
export function releaseContractStakes(w: World, c: Company): void {
  if (c.factoring) {
    const exposed = w.receivables.some((r) => r.payeeId === c.id && r.holder === HOLDER_POOL);
    const to = exposed ? poolAccount("factoring") : companyAccount(c.id);
    w.ledger.post(w.t, contractAccount(c.id), to, c.factoring.stakeFd, `contract:factoring:${c.id}`);
    if (exposed) w.pools.factoring.premiumsFd += c.factoring.stakeFd;
    c.factoring = null;
    c.payTerms = "net";
  }
  if (c.insuranceStakeFd > 0) {
    w.ledger.post(w.t, contractAccount(c.id), companyAccount(c.id), c.insuranceStakeFd, `contract:insurance:${c.id}`);
    c.insuranceStakeFd = 0;
  }
}

/** Pays, or bills: the payee's terms decide what it gets today and what it waits for. */
export function bill(w: World, b: Bill): void {
  const k = w.cfg.token.payment;
  if (b.amountFd <= 0) return;
  if (!k.enabled) {
    payNow(w, b, b.amountFd);
    return;
  }
  const payee = b.payee;
  const dueDay = dayOf(w.t, w.cfg) + k.termsDays;
  if (k.lessorPaysOnDelivery && b.leased) {
    // The lessor's share already covers same-day pay: it pays now and collects the paper itself.
    w.ledger.post(w.t, "faucet:npc_lessor", companyAccount(payee.id), b.amountFd, b.ref);
    w.receivables.push({ id: w.nextReceivableId++, payer: b.payer, faucet: b.faucet, payeeId: payee.id, amountFd: b.amountFd, dueDay, holder: HOLDER_NPC_FACTOR });
    return;
  }
  const terms = payee.factoring ? "factor" : payee.payTerms === "factor" ? "net" : payee.payTerms;
  if (terms === "quick") {
    // The payer pays now and keeps the fee: a company payer books it as revenue, an NPC just never mints it.
    const fee = b.amountFd * k.quickPayPct;
    payNow(w, b, b.amountFd - fee);
    payee.operating.costFd += fee;
    if (b.payer !== 0) companyById(w, b.payer).operating.costFd -= fee;
    return;
  }
  if (terms === "factor") {
    // Under contract: the pool advances the invoice at the discount for this payer's paper when capitalised; the NPC factor backstops it, dearer.
    const f = k.factoring;
    const markup = poolsOn(w) ? poolMarkup(w, "factoring") : null;
    // A player's paper is priced by its credit: strong paper at the base, weak paper up to premiumMax over it.
    const rate = b.payer === 0 ? f.discountNpc : f.discountPlayer * (1 + loadCreditPremium(w, b.payer));
    const discount = b.amountFd * rate * (markup ?? w.cfg.token.pools.factoring.backstopMarkup);
    const advance = b.amountFd - discount;
    if (markup !== null && poolLineCash(w, "factoring") >= advance) {
      w.ledger.post(w.t, poolAccount("factoring"), companyAccount(payee.id), advance, b.ref);
      w.pools.factoring.premiumsFd += discount;
      w.pools.factoring.exposureFd += b.amountFd;
      w.receivables.push({ id: w.nextReceivableId++, payer: b.payer, faucet: b.faucet, payeeId: payee.id, amountFd: b.amountFd, dueDay, holder: HOLDER_POOL });
    } else {
      w.ledger.post(w.t, "faucet:npc_factor", companyAccount(payee.id), advance, b.ref);
      w.receivables.push({ id: w.nextReceivableId++, payer: b.payer, faucet: b.faucet, payeeId: payee.id, amountFd: b.amountFd, dueDay, holder: HOLDER_NPC_FACTOR });
    }
    payee.operating.costFd += discount;
    return;
  }
  w.receivables.push({ id: w.nextReceivableId++, payer: b.payer, faucet: b.faucet, payeeId: payee.id, amountFd: b.amountFd, dueDay, holder: payee.id });
}

/** What a company is owed and has not yet collected (its own receivables, not the factored ones). */
export function receivablesOf(w: World, companyId: number): number {
  let s = 0;
  for (const r of w.receivables) if (r.holder === companyId) s += r.amountFd;
  return s;
}

/** Daily: contracts at term renew or end; receivables due today are collected; a broker wound up before paying leaves its holder to the surety. */
export function dailyReceivables(w: World): void {
  const k = w.cfg.token.payment;
  if (!k.enabled) return;
  const today = dayOf(w.t, w.cfg);
  for (const c of w.companies) {
    const f = c.factoring;
    if (!f || f.until > today || c.liquidatingSince !== null) continue;
    if (c.payTerms !== "factor") {
      endFactoring(w, c, false);
      continue;
    }
    // Renewed for another term, the stake brought up to the fleet it now covers.
    const stake = factoringStake(w, c);
    const delta = stake - f.stakeFd;
    if (delta > 0 && w.ledger.balance(companyAccount(c.id)) >= delta) {
      w.ledger.post(w.t, companyAccount(c.id), contractAccount(c.id), delta, `contract:factoring:${c.id}`);
      f.stakeFd = stake;
    } else if (delta < 0) {
      w.ledger.post(w.t, contractAccount(c.id), companyAccount(c.id), -delta, `contract:factoring:${c.id}`);
      f.stakeFd = stake;
    }
    f.until = today + k.factoring.termDays;
  }
  if (w.receivables.length === 0) return;
  const keep: Receivable[] = [];
  for (const r of w.receivables) {
    if (r.dueDay > today) {
      keep.push(r);
      continue;
    }
    const toAcct = r.holder === HOLDER_POOL ? poolAccount("factoring") : r.holder === HOLDER_NPC_FACTOR ? "sink:npc_factor" : companyAccount(r.holder);
    if (r.holder === HOLDER_POOL) w.pools.factoring.exposureFd = Math.max(0, w.pools.factoring.exposureFd - r.amountFd);
    if (r.payer === 0) {
      // An NPC paying an NPC moves nothing inside the game.
      if (r.holder !== HOLDER_NPC_FACTOR) w.ledger.post(w.t, r.faucet!, toAcct, r.amountFd, `receivable:${r.id}`);
      continue;
    }
    const payer = companyById(w, r.payer);
    if (payer.liquidatingSince !== null) {
      recordPayment(payer, r.amountFd, true);
      // The payer is being wound up: a broker's bond covers its carrier, as far as the surety pool goes; otherwise the holder loses.
      const bondLeft = Math.max(0, w.cfg.token.staking.roles.broker - payer.suretyClaimedFd);
      if (payer.role === "broker" && payer.suretyWriter === "pool" && r.holder !== HOLDER_NPC_FACTOR && bondLeft > 0.01) {
        payer.suretyClaimedFd += payClaim(w, "surety", toAcct, Math.min(r.amountFd, bondLeft), `surety:${r.id}`);
      } else if (r.holder === HOLDER_POOL) {
        w.pools.factoring.claimsFd += r.amountFd;
      }
      w.metrics.onShipperDefault();
      continue;
    }
    // Paid with cash in hand, or from an overdraft: the difference is the credit record.
    recordPayment(payer, r.amountFd, w.ledger.balance(companyAccount(payer.id)) < r.amountFd);
    w.ledger.post(w.t, companyAccount(payer.id), toAcct, r.amountFd, `receivable:${r.id}`);
  }
  w.receivables = keep;
}
