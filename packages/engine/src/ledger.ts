/**
 * Double-entry FD ledger (§Circular economy — two ledgers; §Tech — engineering rules).
 *
 * Every FD movement is one entry: debit one account, credit another, same amount.
 * Accounts named `faucet:*` are where FD enters the economy (they go negative),
 * `sink:*` are where it leaves (they go positive), and `co:*` are company cash.
 * The sum of all balances is zero by construction; `assertBalanced` checks it.
 */
export type EntryKind = "faucet" | "sink" | "transfer";

export interface LedgerEntry {
  t: number;
  from: string;
  to: string;
  amount: number;
  kind: EntryKind;
  ref: string;
}

/**
 * Spending, for working capital, is what a company pays out to operate: outflows to
 * sinks, except burns of cash itself (season close, launch reset, holding cost,
 * exchange fees). Transfers to other companies (truck sales, loans, deposits) don't
 * count: two accounts trading a truck back and forth would otherwise manufacture
 * "spending" and shelter any amount from the season burn.
 */
const NOT_SPENDING = ["season:", "launch:", "holding:", "swap:", "buyback:"];
/**
 * And not spending either, though paid as ordinary spending (locked FD first): an NPC lease's deposit, refunded when the
 * truck goes back (the red team's E3-CAPINFLATE: counted, it inflated working capital and the Reserve's cap with FD that
 * comes back).
 */
const NOT_OUTFLOW = [...NOT_SPENDING, "deposit:"];
/**
 * ledger.capitalNotSpending: buying capital isn't operating spending. A truck, trailer or tractor from the dealer or the
 * used lot (`buy:`, its sales tax under the same ref), a facility (`facility:`), a business (`business:`), and a listing's
 * market fee and tax (`listing:`; its price is a transfer to the seller, so it never counted). Off, they count.
 */
const CAPITAL = ["buy:", "facility:", "business:", "listing:", "expedite:"];

/**
 * Spend-only FD (Jeff, 2026-11-01: the airdrop paid at the TGE "unlocked inside the game", the launch carryover,
 * a post-launch grant, the free path's earnings): a locked sub-balance of an account. Spending draws on it first;
 * a payment to another company or into an escrow carries it, still locked; it dies only in a true sink. So locked
 * FD can be used anywhere in the game and can never be laundered into FD that leaves through the bridge. The
 * exchange pool holds none: a withdrawal is free FD only.
 */
export type PostMode = "lockedFirst" | "freeFirst" | "freeOnly";
const LOCK_FREE = new Set(["co:pool:exchange"]);
const carriesLock = (acct: string) => acct.startsWith("co:") && !LOCK_FREE.has(acct);

/** Cents, so balances are exact integers and replays compare bit-for-bit. */
const toCents = (fd: number) => Math.round(fd * 100);

/**
 * The circular economy (TOKENOMICS.md, 0.18.0): a capped supply minted once at genesis into the
 * reserve (every NPC counterparty's wallet) and the allocations. Faucets then draw on the reserve
 * (or their allocation) and sinks refill it; only these sinks still destroy FD.
 */
export type CircularConfig = { enabled: boolean; capFd: number; shares: { reserve: number; pool: number; airdrop: number; dev?: number } };
export const RESERVE_ACCOUNT = "reserve";
const ALLOCATION_OF: Record<string, string> = { "faucet:airdrop": "alloc:airdrop", "faucet:launch_liquidity": "alloc:pool", "faucet:auction": "alloc:treasury" };
export const CIRCULAR_BURNS = new Set(["sink:season_close", "sink:buyback", "sink:exchange_fee", "sink:airdrop_forfeit", "sink:unstake_haircut", "sink:profit_tax_burn", "sink:asset_burn", "sink:lock_slash", "sink:expedite", "sink:trade_burn"]);

export class Ledger {
  private balances = new Map<string, number>();
  /** Per account: the spend-only part of its balance, in cents (PostMode). Never more than the balance (or 0 in the red). */
  private lockedCents = new Map<string, number>();
  /**
   * Per account: spend-only FD it owes, in cents. Locked FD that lands in an account already in the red fills a hole
   * that free FD dug (an overdraft that paid others free FD), so it can't sit as locked cash; the account owes it, and
   * the free FD it receives next becomes locked until the debt is paid. So the spend-only total (locked + owed) is
   * conserved through every posting, and the locked part never exceeds the account's balance.
   */
  private lockDebtCents = new Map<string, number>();
  readonly entries: LedgerEntry[] = [];
  /** Running totals by tag ("faucet:npc_shipper", "sink:fuel", …) in cents. */
  readonly totals = new Map<string, number>();
  faucetCents = 0;
  sinkCents = 0;
  /**
   * FD NPC shippers, the NPC factor and the NPC lessor paid companies for NPC freight, in cents: the emission cap's cash
   * column (emission.ts; the budget itself is drawn at the invoice). An NPC's advance on a company's paper
   * (receivables.ts NPC_ADVANCE) is not in it: that money is the payer's, repaid into sink:npc_factor.
   */
  npcPaidCents = 0;
  /** Per company account: FD paid out, except what NOT_OUTFLOW lists. */
  private outflows = new Map<string, number>();
  /** Circular mode: FD minted at genesis, in cents (0 in the open mode, where faucets mint). */
  private mintedCents = 0;
  private readonly circular: boolean;

  /** What a company's outflows leave out (NOT_OUTFLOW, and with ledger.capitalNotSpending the CAPITAL refs). */
  private readonly notOutflow: readonly string[];

  constructor(private readonly keepEntries: boolean, circular: CircularConfig | null = null, capitalNotSpending = false) {
    this.notOutflow = capitalNotSpending ? [...NOT_OUTFLOW, ...CAPITAL] : NOT_OUTFLOW;
    this.circular = circular?.enabled ?? false;
    if (!circular?.enabled) return;
    const cap = toCents(circular.capFd);
    const part = (share: number) => Math.round(cap * share);
    const reserve = part(circular.shares.reserve);
    const pool = part(circular.shares.pool);
    const airdrop = part(circular.shares.airdrop);
    const dev = part(circular.shares.dev ?? 0);
    this.balances.set("faucet:genesis", -cap);
    this.balances.set(RESERVE_ACCOUNT, reserve);
    this.balances.set("alloc:pool", pool);
    this.balances.set("alloc:airdrop", airdrop);
    if (dev > 0) this.balances.set("alloc:dev", dev); // the team's allocation (circular.shares.dev), vested by token.ts
    this.balances.set("alloc:treasury", cap - reserve - pool - airdrop - dev);
    this.mintedCents = cap;
  }

  /**
   * Posts an entry and returns the locked FD it carried. The mode says which part of the payer's balance goes
   * first: locked (the default: spending), free (the refs NOT_SPENDING lists: burns of cash itself, where the
   * lock should stay on what remains), or free only (a withdrawal; more than the free balance throws).
   */
  post(t: number, from: string, to: string, amountFd: number, ref: string, mode?: PostMode): number {
    const cents = toCents(amountFd);
    if (!Number.isFinite(cents)) throw new Error(`Bad ledger amount ${amountFd} (${from} → ${to})`);
    if (cents === 0) return 0;
    if (cents < 0) throw new Error(`Negative ledger amount ${amountFd} (${from} → ${to})`);
    if (from === to) throw new Error(`Ledger entry to itself (${from})`);
    const kind = classify(from, to);
    let moved = 0;
    if (carriesLock(from)) {
      const locked = this.lockedCents.get(from) ?? 0;
      const free = Math.max(0, (this.balances.get(from) ?? 0) - locked);
      const m = mode ?? (NOT_SPENDING.some((p) => ref.startsWith(p)) ? "freeFirst" : "lockedFirst");
      if (m === "freeOnly" && cents > free + 1) throw new Error(`${from} has ${free / 100} FD free, not ${cents / 100} (${ref})`); // a cent of rounding between a fee and its net is let through
      moved = m === "lockedFirst" ? Math.min(cents, locked) : m === "freeFirst" ? Math.min(locked, Math.max(0, cents - free)) : 0;
      if (moved > 0) this.lockedCents.set(from, locked - moved);
    }
    // Circular mode: a faucet draws on its allocation or the reserve, a sink refills the reserve
    // unless it burns. The tags still carry the flow totals, so sinks-over-faucets stays meaningful.
    const debit = this.circular && kind === "faucet" ? (ALLOCATION_OF[from] ?? RESERVE_ACCOUNT) : from;
    const credit = this.circular && kind === "sink" && !CIRCULAR_BURNS.has(to) ? RESERVE_ACCOUNT : to;
    this.balances.set(debit, (this.balances.get(debit) ?? 0) - cents);
    this.balances.set(credit, (this.balances.get(credit) ?? 0) + cents);
    if (kind === "faucet") {
      this.faucetCents += cents;
      this.totals.set(from, (this.totals.get(from) ?? 0) + cents);
      if ((from === "faucet:npc_shipper" || from === "faucet:npc_factor" || from === "faucet:npc_lessor" || from === "faucet:npc_market") && to.startsWith("co:")) this.npcPaidCents += cents;
    } else if (kind === "sink") {
      this.sinkCents += cents;
      this.totals.set(to, (this.totals.get(to) ?? 0) + cents);
    }
    if (from.startsWith("co:") && kind === "sink" && !this.notOutflow.some((p) => ref.startsWith(p))) this.outflows.set(from, (this.outflows.get(from) ?? 0) + cents);
    if (this.keepEntries) this.entries.push({ t, from, to, amount: cents / 100, kind, ref });
    // A freeOnly payment may overdraw the free part by its cent of rounding: that cent of locked FD was spent.
    if (carriesLock(from)) {
      const lockedFrom = this.lockedCents.get(from) ?? 0;
      const capFrom = Math.max(0, this.balances.get(from) ?? 0);
      if (lockedFrom > capFrom) this.lockedCents.set(from, capFrom);
    }
    if (carriesLock(to)) this.settleLocks(to, moved, cents - moved);
    return moved / 100;
  }

  /** Locked FD and free FD arrive at `to`: the free part first pays its lock debt, and the locked part is capped at the balance, the rest owed. */
  private settleLocks(to: string, movedCents: number, freeCents: number): void {
    let debt = this.lockDebtCents.get(to) ?? 0;
    if (movedCents <= 0 && debt <= 0) return;
    let locked = (this.lockedCents.get(to) ?? 0) + movedCents;
    if (debt > 0 && freeCents > 0) {
      const pay = Math.min(debt, freeCents);
      locked += pay;
      debt -= pay;
    }
    const cap = Math.max(0, this.balances.get(to) ?? 0);
    if (locked > cap) {
      debt += locked - cap;
      locked = cap;
    }
    this.lockedCents.set(to, locked);
    if (debt > 0) this.lockDebtCents.set(to, debt);
    else this.lockDebtCents.delete(to);
  }

  /**
   * Gives back FD the settlement fee burned (its refund on a player shipper's paper written off, settlement.ts): the
   * burn's account, its tag's total and the sink total fall by it, so the tag reads net, and the company's outflows with
   * it. Never more than the tag holds; `lockedFd` of it comes back spend-only, as it left. Returns what it gave back.
   */
  unburn(t: number, to: string, amountFd: number, lockedFd: number, ref: string): number {
    const sink = "sink:trade_burn";
    const held = Math.min(this.balances.get(sink) ?? 0, this.totals.get(sink) ?? 0);
    const cents = Math.min(toCents(amountFd), held);
    if (!(cents > 0)) return 0;
    if (!to.startsWith("co:")) throw new Error(`A burn goes back to a company, not ${to}`);
    const lockedBack = Math.min(cents, Math.max(0, toCents(lockedFd)));
    this.balances.set(sink, (this.balances.get(sink) ?? 0) - cents);
    this.balances.set(to, (this.balances.get(to) ?? 0) + cents);
    this.totals.set(sink, (this.totals.get(sink) ?? 0) - cents);
    this.sinkCents -= cents;
    const out = this.outflows.get(to);
    if (out !== undefined) this.outflows.set(to, Math.max(0, out - cents));
    // The entry as the fee's own, negative, so a sum over the entries nets it.
    if (this.keepEntries) this.entries.push({ t, from: to, to: sink, amount: -cents / 100, kind: "sink", ref });
    if (carriesLock(to)) this.settleLocks(to, lockedBack, cents - lockedBack);
    return cents / 100;
  }

  /** Spend-only FD an account owes (it landed in the red, see lockDebtCents). */
  lockDebt(account: string): number {
    return (this.lockDebtCents.get(account) ?? 0) / 100;
  }

  /** A bankruptcy discharges the lock debt with the rest of the debt (solvency.ts restart); returns what it forgave. */
  forgiveLockDebt(account: string): number {
    const d = this.lockDebtCents.get(account) ?? 0;
    this.lockDebtCents.delete(account);
    return d / 100;
  }

  /** Spend-only FD owed across every company account: with lockedSupply, the conserved total. */
  lockDebtSupply(): number {
    let c = 0;
    for (const [acct, v] of this.lockDebtCents) if (acct.startsWith("co:")) c += v;
    return c / 100;
  }

  outflowCents(account: string): number {
    return this.outflows.get(account) ?? 0;
  }

  balance(account: string): number {
    return (this.balances.get(account) ?? 0) / 100;
  }

  /** The spend-only part of an account's balance. */
  locked(account: string): number {
    return (this.lockedCents.get(account) ?? 0) / 100;
  }

  /** What an account may pay to another player freely, or withdraw: its balance less what's locked. */
  free(account: string): number {
    return Math.max(0, (this.balances.get(account) ?? 0) - (this.lockedCents.get(account) ?? 0)) / 100;
  }

  /** Makes up to `fd` of an account's free balance spend-only; returns what it locked. */
  lock(account: string, fd: number): number {
    const cents = Math.min(toCents(fd), toCents(this.free(account)));
    if (!(cents > 0) || !carriesLock(account)) return 0;
    this.lockedCents.set(account, (this.lockedCents.get(account) ?? 0) + cents);
    return cents / 100;
  }

  /** Frees up to `fd` of an account's locked balance; returns what it unlocked. */
  unlock(account: string, fd: number): number {
    const locked = this.lockedCents.get(account) ?? 0;
    const cents = Math.min(toCents(fd), locked);
    if (!(cents > 0)) return 0;
    this.lockedCents.set(account, locked - cents);
    return cents / 100;
  }

  /** Spend-only FD across every company account. */
  lockedSupply(): number {
    let c = 0;
    for (const [acct, v] of this.lockedCents) if (acct.startsWith("co:")) c += v;
    return c / 100;
  }

  /** FD held by companies (the money supply). */
  supply(): number {
    let c = 0;
    for (const [acct, v] of this.balances) if (acct.startsWith("co:")) c += v;
    return c / 100;
  }

  /** Circular mode: what the reserve holds (every NPC counterparty's wallet); 0 in the open mode. */
  npcPaidFd(): number {
    return this.npcPaidCents / 100;
  }

  reserve(): number {
    return (this.balances.get(RESERVE_ACCOUNT) ?? 0) / 100;
  }

  /** Circular mode: FD still held in the genesis allocations (pool, airdrop, treasury). */
  allocated(): number {
    let c = 0;
    for (const [acct, v] of this.balances) if (acct.startsWith("alloc:")) c += v;
    return c / 100;
  }

  /** FD destroyed for good: the burn sinks' balances. */
  burned(): number {
    let c = 0;
    for (const acct of CIRCULAR_BURNS) c += this.balances.get(acct) ?? 0;
    return c / 100;
  }

  /** Circular mode: the cap, minted once at genesis; supply + reserve + allocated + burned adds up to it. */
  minted(): number {
    return this.mintedCents / 100;
  }

  assertBalanced(): void {
    let sum = 0;
    for (const v of this.balances.values()) sum += v;
    if (sum !== 0) throw new Error(`Ledger out of balance by ${sum / 100} FD`);
  }

  accounts(): IterableIterator<[string, number]> {
    return this.balances.entries();
  }
}

function classify(from: string, to: string): EntryKind {
  const fromFaucet = from.startsWith("faucet:");
  const toSink = to.startsWith("sink:");
  if (fromFaucet && toSink) throw new Error(`Faucet → sink entry is meaningless (${from} → ${to})`);
  if (from.startsWith("sink:") || to.startsWith("faucet:")) throw new Error(`Reversed ledger entry (${from} → ${to})`);
  if (fromFaucet) return "faucet";
  if (toSink) return "sink";
  return "transfer";
}

export const companyAccount = (companyId: number) => `co:${companyId}`;
