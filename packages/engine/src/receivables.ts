/**
 * Payment terms and factoring (0.18.0, TOKENOMICS.md §4). With `token.payment` on, freight is paid
 * net-N days instead of on delivery: the payee holds a receivable until its due day. A payee may
 * take quick pay (the payer pays now, less a fee) or factor (the factoring pool, or the NPC factor
 * as the dearer backstop, advances the invoice now at a discount and collects it at due). The
 * surety pool covers a broker's receivable when the broker is wound up before paying, up to the
 * bond, if the pool wrote that broker's bond. Off, every payment posts at once as before.
 */
import { dayOf } from "./clock.js";
import { companyAccount } from "./ledger.js";
import { payClaim, poolAccount, poolLineCash, poolMarkup, poolsOn } from "./pools.js";
import type { Company, Receivable } from "./types.js";
import { companyById, type World } from "./world.js";

/** Who holds the receivable: the payee, the factoring pool, or the NPC factor (nothing moves in the game when it collects). */
export const HOLDER_POOL = -1;
export const HOLDER_NPC_FACTOR = -2;

export interface Bill {
  /** Company id, or 0 for an NPC payer (then `faucet` names the money's source). */
  payer: number;
  faucet?: string;
  payee: Company;
  amountFd: number;
  ref: string;
}

function payNow(w: World, b: Bill, amountFd: number): void {
  if (amountFd <= 0) return;
  const from = b.payer === 0 ? b.faucet! : companyAccount(b.payer);
  w.ledger.post(w.t, from, companyAccount(b.payee.id), amountFd, b.ref);
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
  const terms = payee.payTerms;
  if (terms === "quick") {
    // The payer pays now and keeps the fee: a company payer books it as revenue, an NPC just never mints it.
    const fee = b.amountFd * k.quickPayPct;
    payNow(w, b, b.amountFd - fee);
    payee.operating.costFd += fee;
    if (b.payer !== 0) {
      const payer = companyById(w, b.payer);
      payer.operating.costFd -= fee;
    }
    return;
  }
  const dueDay = dayOf(w.t, w.cfg) + k.termsDays;
  if (terms === "factor") {
    // The factoring pool advances the invoice at its discount when capitalised; the NPC factor backstops it, dearer.
    const f = k.factoring;
    const markup = poolsOn(w) ? poolMarkup(w, "factoring") : null;
    const discount = b.amountFd * f.discountPct * (markup ?? w.cfg.token.pools.factoring.backstopMarkup);
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

/** Daily: receivables due today are collected; a broker wound up before paying leaves its holder to the surety. */
export function dailyReceivables(w: World): void {
  if (!w.cfg.token.payment.enabled || w.receivables.length === 0) return;
  const today = dayOf(w.t, w.cfg);
  const keep: Receivable[] = [];
  for (const r of w.receivables) {
    if (r.dueDay > today) {
      keep.push(r);
      continue;
    }
    const toAcct = r.holder === HOLDER_POOL ? poolAccount("factoring") : r.holder === HOLDER_NPC_FACTOR ? "sink:npc_factor" : companyAccount(r.holder);
    if (r.holder === HOLDER_POOL) w.pools.factoring.exposureFd = Math.max(0, w.pools.factoring.exposureFd - r.amountFd);
    if (r.payer === 0) {
      // An NPC paying the NPC factor moves nothing inside the game.
      if (r.holder !== HOLDER_NPC_FACTOR) w.ledger.post(w.t, r.faucet!, toAcct, r.amountFd, `receivable:${r.id}`);
      continue;
    }
    const payer = companyById(w, r.payer);
    if (payer.liquidatingSince !== null) {
      // The payer is being wound up: a broker's bond covers its carrier, as far as the surety pool goes; otherwise the holder loses.
      if (payer.role === "broker" && payer.suretyWriter === "pool" && r.holder !== HOLDER_NPC_FACTOR) {
        payClaim(w, "surety", toAcct, Math.min(r.amountFd, w.cfg.token.staking.roles.broker), `surety:${r.id}`);
      } else if (r.holder === HOLDER_POOL) {
        w.pools.factoring.claimsFd += r.amountFd;
      }
      w.metrics.onShipperDefault();
      continue;
    }
    if (r.holder !== HOLDER_NPC_FACTOR) w.ledger.post(w.t, companyAccount(payer.id), toAcct, r.amountFd, `receivable:${r.id}`);
    else w.ledger.post(w.t, companyAccount(payer.id), "sink:npc_factor", r.amountFd, `receivable:${r.id}`);
  }
  w.receivables = keep;
}
