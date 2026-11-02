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
 *
 * The contract (token.payment.factoring.contract; Jeff, 2026-11-02) replaces the one-year contract: three game months
 * with the NPC factor over the whole fleet, no stake, no early exit, the discount set by the fleet at signing (a
 * broker's flat), every discount a sink. Under it a broker's accounts payable never pass its posted bond, and the
 * bond pays its paper when its cash can't, the NPC factor's first: so the factor's advance is always matched by a
 * payment, and paying on delivery is never a faucet.
 */
import { dayOf } from "./clock.js";
import { loadCreditPremium, recordPayment } from "./credit.js";
import { companyAccount } from "./ledger.js";
import { payClaim, poolAccount, poolLineCash, poolMarkup, poolsOn } from "./pools.js";
import { stakeAccount } from "./staking.js";
import type { Company, FactoringLog, Load, Receivable } from "./types.js";
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
  /** The truck that hauled it, for a contract that isn't whole-fleet. */
  truckId?: number;
}

/** The factoring contract (token.payment.factoring.contract) is the rule: payment terms on and the switch on. */
export const contractOn = (w: World) => w.cfg.token.payment.enabled && w.cfg.token.payment.factoring.contract.enabled;

/** The world's factoring log, made on first use. */
export function factoringLog(w: World): FactoringLog {
  return (w.factoringLog ??= {
    contracts: [],
    lapses: 0,
    tendersCapped: 0,
    tendersToBoard: 0,
    bookingsCapped: 0,
    bondPaidFd: 0,
    bondToNpcFd: 0,
    uncoveredFd: 0,
    overdraftFd: 0,
    brokered: { loads: 0, payFd: 0, miles: 0 },
    direct: { loads: 0, payFd: 0, miles: 0 },
    liquidations: [],
    firstInService: {},
    capNoticeDay: {},
  });
}

/** A carrier's discount per invoice for a fleet of this many trucks: straight lines between the schedule's points, flat past either end. */
export function factoringRate(w: World, trucks: number): number {
  const pts = w.cfg.token.payment.factoring.contract.rateByTrucks;
  const n = Math.max(1, trucks);
  if (n <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [n0, r0] = pts[i - 1]!;
    const [n1, r1] = pts[i]!;
    if (n <= n1) return r0 + ((r1 - r0) * (n - n0)) / (n1 - n0);
  }
  return pts.at(-1)![1];
}

/** What the company would pay per invoice if it signed today: a broker's flat rate, a carrier's by its fleet. */
export function factoringRateFor(w: World, c: Company): number {
  return c.role === "broker" ? w.cfg.token.payment.factoring.contract.brokerRate : factoringRate(w, operatingTrucks(w, c.id));
}

/** Opens a term of the contract (a signing or a renewal): the rate from the fleet now, fixed for the term. */
function openContract(w: World, c: Company, renewal: boolean): void {
  const k = w.cfg.token.payment.factoring.contract;
  const today = dayOf(w.t, w.cfg);
  const trucks = operatingTrucks(w, c.id);
  const rate = factoringRateFor(w, c);
  const log = factoringLog(w);
  log.contracts.push({ companyId: c.id, day: today, trucks, rate, renewal, broker: c.role === "broker", invoicesFd: 0, feesFd: 0 });
  const truckIds = k.wholeFleet ? undefined : (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "parked" && t.status !== "listed").map((t) => t.id);
  c.factoring = { until: today + k.months * w.cfg.time.daysPerMonth, stakeFd: 0, rate, trucks, renew: false, truckIds, log: log.contracts.length - 1 };
  c.payTerms = "factor";
}

/** Brokers' books for the AP cap, in one pass: what each owes carriers on loads booked and not yet paid, and what it has posted. */
export interface BrokerBook {
  /** Accounts payable: loads booked (in flight, at the cleared rate; a re-posted one at the rate its double broker took it at) and invoices delivered and unpaid. */
  apFd: number;
  /** Loads tendered to it and still open on the board, at their ceiling. */
  postedFd: number;
}

export function brokerBooks(w: World): Map<number, BrokerBook> {
  const books = new Map<number, BrokerBook>();
  const book = (id: number) => {
    let b = books.get(id);
    if (!b) books.set(id, (b = { apFd: 0, postedFd: 0 }));
    return b;
  };
  for (const load of w.loads.values()) {
    if (load.brokerId === null) continue;
    if (load.doubleBroker) book(load.brokerId).apFd += load.doubleBroker.upstreamRate * load.miles;
    else if (load.status === "open") book(load.brokerId).postedFd += load.ceiling * load.miles;
    else if (load.status === "assigned" || load.status === "inTransit") book(load.brokerId).apFd += load.clearedRate * load.miles;
  }
  for (const r of w.receivables) if (r.payer !== 0) book(r.payer).apFd += r.amountFd;
  return books;
}

/** A broker's accounts payable now (exact; the hot paths use brokerBooks once a pass). */
export const brokerApFd = (w: World, brokerId: number) => brokerBooks(w).get(brokerId)?.apFd ?? 0;

/** The broker's posted bond: its stake (the licence stake and anything posted over it). */
export const postedBondFd = (c: Company) => c.stakedFd;

/** The AP cap's check: null when the broker's payables stay within its bond with `addFd` more, else why not. */
export function apCapBlock(w: World, broker: Company, book: BrokerBook | undefined, addFd: number, posted = false): string | null {
  if (!contractOn(w) || broker.role !== "broker") return null;
  const owed = (book?.apFd ?? 0) + (posted ? (book?.postedFd ?? 0) : 0);
  const bond = postedBondFd(broker);
  if (owed + addFd <= bond + 0.005) return null;
  return `${broker.name} can't owe carriers more than its posted bond (${Math.round(owed)} FD ${posted ? "owed and posted" : "owed"}, ${Math.round(bond)} FD bond)`;
}

/** A booking on a broker's load (a sealed bid won, a book-now taken): refused when it would push the broker's payables over its bond. */
export function bookingCapBlock(w: World, load: Load, rate: number, books?: Map<number, BrokerBook>): string | null {
  if (load.brokerId === null || load.doubleBroker || !contractOn(w)) return null; // a re-posted load's broker already owes it at the rate it was taken at
  const broker = companyById(w, load.brokerId);
  const all = books ?? brokerBooks(w);
  const block = apCapBlock(w, broker, all.get(broker.id), rate * load.miles);
  if (block) {
    factoringLog(w).bookingsCapped++;
    return block;
  }
  let b = all.get(broker.id);
  if (!b) all.set(broker.id, (b = { apFd: 0, postedFd: 0 }));
  b.apFd += rate * load.miles;
  return null;
}

/** NPC-held paper (the factor's, the lessor's) a broker still owes, other than `exceptId`: the first call on its bond. */
function npcPaperOf(w: World, payerId: number, exceptId: number): number {
  let s = 0;
  for (const r of w.receivables) if (r.payer === payerId && r.holder === HOLDER_NPC_FACTOR && r.id !== exceptId) s += r.amountFd;
  return s;
}

/** Pays up to `amountFd` of a broker's paper out of its bond (its stake), to `to`. Returns what it paid. */
function drawBond(w: World, broker: Company, amountFd: number, to: string, ref: string, npcHolder: boolean): number {
  // In cents, within what the stake account holds, so the bond and its account agree.
  const pay = Math.min(Math.round(amountFd * 100), Math.round(broker.stakedFd * 100), Math.round(Math.max(0, w.ledger.balance(stakeAccount(broker.id))) * 100)) / 100;
  if (pay <= 0.005) return 0;
  w.ledger.post(w.t, stakeAccount(broker.id), to, pay, ref);
  broker.stakedFd -= pay;
  const log = factoringLog(w);
  log.bondPaidFd += pay;
  if (npcHolder) log.bondToNpcFd += pay;
  return pay;
}

const holderAccount = (r: Receivable) => (r.holder === HOLDER_POOL ? poolAccount("factoring") : r.holder === HOLDER_NPC_FACTOR ? "sink:npc_factor" : companyAccount(r.holder));

/**
 * A broker's paper falls due under the contract: paid from its cash as far as that goes, then from its bond (the NPC
 * factor's and lessor's paper first: a company's is paid from the bond only past what the NPC holders are still owed),
 * and only then, past the bond, from an overdraft, or, wound up, not at all.
 */
function settleBrokerPaper(w: World, payer: Company, r: Receivable): void {
  const to = holderAccount(r);
  const ref = `receivable:${r.id}`;
  const npcHolder = r.holder === HOLDER_NPC_FACTOR;
  const amount = r.amountFd;
  r.amountFd = 0; // settled today, whatever is paid: the rest of today's pass no longer counts it as owed
  const fromCash = Math.min(amount, Math.max(0, w.ledger.balance(companyAccount(payer.id))));
  if (fromCash > 0.005) w.ledger.post(w.t, companyAccount(payer.id), to, fromCash, ref);
  let rest = amount - fromCash;
  if (rest > 0.005) {
    const room = Math.max(0, payer.stakedFd - (npcHolder ? 0 : npcPaperOf(w, payer.id, r.id)));
    rest -= drawBond(w, payer, Math.min(rest, room), to, ref, npcHolder);
  }
  recordPayment(payer, amount, fromCash < amount - 0.005);
  if (rest <= 0.005) return;
  const log = factoringLog(w);
  if (payer.liquidatingSince !== null) {
    if (npcHolder) log.uncoveredFd += rest;
    w.metrics.onShipperDefault();
    return;
  }
  if (npcHolder) log.overdraftFd += rest;
  w.ledger.post(w.t, companyAccount(payer.id), to, rest, ref);
}

/**
 * Calls a broker's bond on all its paper at once (its stake is about to go: slashed on a revocation, or burned at the
 * launch reset): the NPC factor's and lessor's paper first, then its carriers', as far as the bond goes.
 */
export function callBond(w: World, c: Company): void {
  if (!contractOn(w) || c.role !== "broker") return;
  const mine = w.receivables.filter((r) => r.payer === c.id).sort((a, b) => Number(b.holder === HOLDER_NPC_FACTOR) - Number(a.holder === HOLDER_NPC_FACTOR) || a.dueDay - b.dueDay);
  for (const r of mine) {
    const paid = drawBond(w, c, r.amountFd, holderAccount(r), `receivable:${r.id}`, r.holder === HOLDER_NPC_FACTOR);
    if (paid > 0.005) recordPayment(c, paid, true);
    r.amountFd -= paid;
  }
  w.receivables = w.receivables.filter((r) => r.amountFd > 0.005);
}

/** Under the contract a broker's licence stake stays behind its paper through a liquidation, until the paper is paid. */
export const bondHeld = (w: World, c: Company) => contractOn(w) && c.role === "broker";
export const paperOpen = (w: World, companyId: number) => w.receivables.some((r) => r.payer === companyId);

function payNow(w: World, b: Bill, amountFd: number): void {
  if (amountFd <= 0) return;
  const from = b.payer === 0 ? b.faucet! : companyAccount(b.payer);
  w.ledger.post(w.t, from, companyAccount(b.payee.id), amountFd, b.ref);
}

/** The stake a factoring contract takes: two weeks of invoices, sized by the fleet, or a flat sum for a broker or shipper. None under the contract. */
export function factoringStake(w: World, c: Company): number {
  if (contractOn(w)) return 0;
  const f = w.cfg.token.payment.factoring;
  return c.role === "carrier" ? f.stakePerTruckFd * Math.max(1, operatingTrucks(w, c.id)) : f.stakeBrokerFd;
}

/** Signs a factoring contract for the term: the stake is locked and every invoice is factored until it ends. */
export function signFactoring(w: World, c: Company): string | null {
  if (!w.cfg.token.payment.enabled) return "payment terms aren't on";
  if (contractOn(w)) {
    // The contract: signing opens a term; signing again while one runs renews it at its end.
    if (c.liquidatingSince !== null) return "in liquidation";
    if (c.factoring) {
      c.factoring.renew = true;
      c.factoring.thenTerms = undefined;
      return null;
    }
    openContract(w, c, false);
    return null;
  }
  if (c.factoring) return null;
  if (c.liquidatingSince !== null) return "in liquidation";
  const stake = factoringStake(w, c);
  if (w.ledger.balance(companyAccount(c.id)) < stake) return "the contract stake needs more FD";
  w.ledger.post(w.t, companyAccount(c.id), contractAccount(c.id), stake, `contract:factoring:${c.id}`);
  c.factoring = { until: dayOf(w.t, w.cfg) + w.cfg.token.payment.factoring.termDays, stakeFd: stake };
  c.payTerms = "factor";
  // The report counts the old contract's signings too (it renews by itself while terms stay "factor").
  factoringLog(w).contracts.push({ companyId: c.id, day: dayOf(w.t, w.cfg), trucks: operatingTrucks(w, c.id), rate: 0, renewal: false, broker: c.role === "broker", invoicesFd: 0, feesFd: 0 });
  return null;
}

/** Under the contract there's no early exit: asking for net or quick pay lets the term lapse into them at its end. */
export function setContractTerms(c: Company, terms: "net" | "quick" | "factor"): void {
  if (!c.factoring) return;
  c.factoring.renew = terms === "factor";
  c.factoring.thenTerms = terms === "factor" ? undefined : terms;
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
  if (c.factoring && c.factoring.rate !== undefined) {
    // The contract ends with the company's liquidation; it has no stake, and the factor keeps the paper it bought.
    c.factoring = null;
    c.payTerms = "net";
  }
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
  const f = payee.factoring;
  if (contractOn(w) && f && f.rate !== undefined) {
    // The contract: the NPC factor buys NPC shippers' paper (always paid) and a bonded broker's, on delivery, at the
    // term's discount. A player shipper's paper has no bond behind it yet, and waits for its due day.
    const bought = b.payer === 0 || companyById(w, b.payer).role === "broker";
    const covered = !f.truckIds || b.truckId === undefined || f.truckIds.includes(b.truckId);
    if (bought && covered) {
      const fee = b.amountFd * f.rate;
      w.ledger.post(w.t, "faucet:npc_factor", companyAccount(payee.id), b.amountFd, b.ref);
      // The discount is a sink that refills the reserve, as the lessor's share does (never a burn).
      w.ledger.post(w.t, companyAccount(payee.id), "sink:factoring_fee", fee, b.ref);
      w.receivables.push({ id: w.nextReceivableId++, payer: b.payer, faucet: b.faucet, payeeId: payee.id, amountFd: b.amountFd, dueDay, holder: HOLDER_NPC_FACTOR });
      payee.operating.costFd += fee;
      const entry = f.log !== undefined ? factoringLog(w).contracts[f.log] : undefined;
      if (entry) {
        entry.invoicesFd += b.amountFd;
        entry.feesFd += fee;
      }
      return;
    }
    w.receivables.push({ id: w.nextReceivableId++, payer: b.payer, faucet: b.faucet, payeeId: payee.id, amountFd: b.amountFd, dueDay, holder: payee.id });
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
  // The factoring log: the day each carrier first runs an owned truck.
  const log = factoringLog(w);
  for (const c of w.companies) {
    if (c.role !== "carrier" || c.firstOwnedTruckDay === null || log.firstInService[c.id] !== undefined) continue;
    if ((w.trucksByCompany.get(c.id) ?? []).some((t) => t.lease === "owned")) log.firstInService[c.id] = today;
  }
  for (const c of w.companies) {
    const f = c.factoring;
    if (!f || f.until > today || c.liquidatingSince !== null) continue;
    if (f.rate !== undefined) {
      // The contract at its end: renewed for another term at the rate the fleet now sets, or lapsed into the terms asked for.
      if (f.renew && contractOn(w)) openContract(w, c, true);
      else {
        c.factoring = null;
        c.payTerms = f.thenTerms ?? "net";
        factoringLog(w).lapses++;
      }
      continue;
    }
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
    const toAcct = holderAccount(r);
    if (r.holder === HOLDER_POOL) w.pools.factoring.exposureFd = Math.max(0, w.pools.factoring.exposureFd - r.amountFd);
    if (r.payer === 0) {
      // An NPC paying an NPC moves nothing inside the game.
      if (r.holder !== HOLDER_NPC_FACTOR) w.ledger.post(w.t, r.faucet!, toAcct, r.amountFd, `receivable:${r.id}`);
      continue;
    }
    const payer = companyById(w, r.payer);
    if (contractOn(w) && payer.role === "broker") {
      // The contract: a broker's paper is paid from its cash, then its bond (the NPC factor's first).
      settleBrokerPaper(w, payer, r);
      continue;
    }
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
