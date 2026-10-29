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

/** Cents, so balances are exact integers and replays compare bit-for-bit. */
const toCents = (fd: number) => Math.round(fd * 100);

/**
 * The circular economy (TOKENOMICS.md, 0.18.0): a capped supply minted once at genesis into the
 * reserve (every NPC counterparty's wallet) and the allocations. Faucets then draw on the reserve
 * (or their allocation) and sinks refill it; only these sinks still destroy FD.
 */
export type CircularConfig = { enabled: boolean; capFd: number; shares: { reserve: number; pool: number; airdrop: number } };
export const RESERVE_ACCOUNT = "reserve";
const ALLOCATION_OF: Record<string, string> = { "faucet:airdrop": "alloc:airdrop", "faucet:launch_liquidity": "alloc:pool" };
export const CIRCULAR_BURNS = new Set(["sink:season_close", "sink:buyback", "sink:exchange_fee", "sink:airdrop_forfeit", "sink:unstake_haircut", "sink:profit_tax_burn"]);

export class Ledger {
  private balances = new Map<string, number>();
  readonly entries: LedgerEntry[] = [];
  /** Running totals by tag ("faucet:npc_shipper", "sink:fuel", …) in cents. */
  readonly totals = new Map<string, number>();
  faucetCents = 0;
  sinkCents = 0;
  /** Per company account: FD paid out, except what NOT_SPENDING lists. */
  private outflows = new Map<string, number>();
  /** Circular mode: FD minted at genesis, in cents (0 in the open mode, where faucets mint). */
  private mintedCents = 0;
  private readonly circular: boolean;

  constructor(private readonly keepEntries: boolean, circular: CircularConfig | null = null) {
    this.circular = circular?.enabled ?? false;
    if (!circular?.enabled) return;
    const cap = toCents(circular.capFd);
    const part = (share: number) => Math.round(cap * share);
    const reserve = part(circular.shares.reserve);
    const pool = part(circular.shares.pool);
    const airdrop = part(circular.shares.airdrop);
    this.balances.set("faucet:genesis", -cap);
    this.balances.set(RESERVE_ACCOUNT, reserve);
    this.balances.set("alloc:pool", pool);
    this.balances.set("alloc:airdrop", airdrop);
    this.balances.set("alloc:treasury", cap - reserve - pool - airdrop);
    this.mintedCents = cap;
  }

  post(t: number, from: string, to: string, amountFd: number, ref: string): void {
    const cents = toCents(amountFd);
    if (!Number.isFinite(cents)) throw new Error(`Bad ledger amount ${amountFd} (${from} → ${to})`);
    if (cents === 0) return;
    if (cents < 0) throw new Error(`Negative ledger amount ${amountFd} (${from} → ${to})`);
    if (from === to) throw new Error(`Ledger entry to itself (${from})`);
    const kind = classify(from, to);
    // Circular mode: a faucet draws on its allocation or the reserve, a sink refills the reserve
    // unless it burns. The tags still carry the flow totals, so sinks-over-faucets stays meaningful.
    const debit = this.circular && kind === "faucet" ? (ALLOCATION_OF[from] ?? RESERVE_ACCOUNT) : from;
    const credit = this.circular && kind === "sink" && !CIRCULAR_BURNS.has(to) ? RESERVE_ACCOUNT : to;
    this.balances.set(debit, (this.balances.get(debit) ?? 0) - cents);
    this.balances.set(credit, (this.balances.get(credit) ?? 0) + cents);
    if (kind === "faucet") {
      this.faucetCents += cents;
      this.totals.set(from, (this.totals.get(from) ?? 0) + cents);
    } else if (kind === "sink") {
      this.sinkCents += cents;
      this.totals.set(to, (this.totals.get(to) ?? 0) + cents);
    }
    if (from.startsWith("co:") && kind === "sink" && !NOT_SPENDING.some((p) => ref.startsWith(p))) this.outflows.set(from, (this.outflows.get(from) ?? 0) + cents);
    if (this.keepEntries) this.entries.push({ t, from, to, amount: cents / 100, kind, ref });
  }

  outflowCents(account: string): number {
    return this.outflows.get(account) ?? 0;
  }

  balance(account: string): number {
    return (this.balances.get(account) ?? 0) / 100;
  }

  /** FD held by companies (the money supply). */
  supply(): number {
    let c = 0;
    for (const [acct, v] of this.balances) if (acct.startsWith("co:")) c += v;
    return c / 100;
  }

  /** Circular mode: what the reserve holds (every NPC counterparty's wallet); 0 in the open mode. */
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
