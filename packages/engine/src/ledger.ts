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

export class Ledger {
  private balances = new Map<string, number>();
  readonly entries: LedgerEntry[] = [];
  /** Running totals by tag ("faucet:npc_shipper", "sink:fuel", …) in cents. */
  readonly totals = new Map<string, number>();
  faucetCents = 0;
  sinkCents = 0;
  /** Per company account: FD paid out, except what NOT_SPENDING lists. */
  private outflows = new Map<string, number>();

  constructor(private readonly keepEntries: boolean) {}

  post(t: number, from: string, to: string, amountFd: number, ref: string): void {
    const cents = toCents(amountFd);
    if (!Number.isFinite(cents)) throw new Error(`Bad ledger amount ${amountFd} (${from} → ${to})`);
    if (cents === 0) return;
    if (cents < 0) throw new Error(`Negative ledger amount ${amountFd} (${from} → ${to})`);
    if (from === to) throw new Error(`Ledger entry to itself (${from})`);
    const kind = classify(from, to);
    this.balances.set(from, (this.balances.get(from) ?? 0) - cents);
    this.balances.set(to, (this.balances.get(to) ?? 0) + cents);
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
