/**
 * Red team harness (studio/roles/redteam.md). Builders and measurements shared by the economy
 * exploits and the fuzzer. Reads everything, changes nothing on main; this folder is the red team's.
 *
 * The live world and the sim's default profile both run `withLiveLevers(economyConfig)`. These helpers
 * build that world, let an attacker drive a company it owns through `applyAction` the way a modified
 * client would, and read the ledger's own invariants so a run can say whether FD left the world that
 * the rules did not mean to give.
 */
import { applyLevers, economyConfig, LIVE_LEVERS, withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds, syntheticCassCycle } from "@lanes/data";
import {
  applyAction,
  companyAccount,
  createWorld,
  dayOf,
  formCompany,
  reserveOutAccount,
  stepHour,
  CIRCULAR_BURNS,
  type Action,
  type Company,
  type World,
} from "@lanes/engine";
import { populate, ruleBotHook } from "@lanes/agents";

export { LIVE_LEVERS };

export const EPS = 0.02; // two cents, matching the ledger's rounding tolerance

/** The live profile, optionally with `--set`-style overrides on top (same path syntax as run.ts). */
export function liveConfig(overrides: Record<string, unknown> = {}): EconomyConfig {
  const base = withLiveLevers(economyConfig);
  return Object.keys(overrides).length ? applyLevers(base, overrides) : base;
}

/** The bare base config with a set of levers (so a scenario can turn exactly one switch on). */
export function baseConfig(overrides: Record<string, unknown> = {}): EconomyConfig {
  return Object.keys(overrides).length ? applyLevers(economyConfig, overrides) : structuredClone(economyConfig) as unknown as EconomyConfig;
}

export interface MakeOpts {
  seed?: number;
  cfg?: EconomyConfig;
  seasons?: boolean;
  cycle?: boolean;
  oo?: number;
  fleets?: number;
  brokers?: number;
  keepEntries?: boolean;
}

export function makeWorld(o: MakeOpts = {}): World {
  const seed = o.seed ?? 1;
  const cfg0 = o.cfg ?? liveConfig();
  const cfg: EconomyConfig = o.seasons === false ? ({ ...cfg0, seasonClose: { ...cfg0.seasonClose, enabled: false } } as EconomyConfig) : cfg0;
  const net = buildNetwork(hubs, cfg);
  const feeds = o.cycle === false ? neutralFeeds : { ...neutralFeeds, cycle: syntheticCassCycle({ seed }) };
  const w = createWorld({ cfg, net, feeds, seed, keepLedgerEntries: o.keepEntries ?? false });
  populate(w, { freeOwnerOperators: o.oo ?? 60, fleets: o.fleets ?? 20, brokers: o.brokers ?? 10 });
  return w;
}

const STARTER_HUBS = hubs.filter((h) => h.isStarter).map((h) => h.id);

/** Adds a red-team company (a non-player bot, so bad-actor actions aren't locked to it) and returns it. */
export function addAttacker(w: World, name: string, opts: { role?: "carrier" | "broker"; freePath?: boolean; hub?: string } = {}): Company {
  return formCompany(w, {
    name,
    role: opts.role ?? "carrier",
    homeHubId: opts.hub ?? STARTER_HUBS[0]!,
    strategy: `redteam:${name}`,
    orders: [],
    freePath: opts.freePath ?? true,
    human: false,
  });
}

export const bal = (w: World, c: Company | number) => w.ledger.balance(companyAccount(typeof c === "number" ? c : c.id));
export const free = (w: World, c: Company | number) => w.ledger.free(companyAccount(typeof c === "number" ? c : c.id));
export const locked = (w: World, c: Company | number) => w.ledger.locked(companyAccount(typeof c === "number" ? c : c.id));
export const act = (w: World, c: Company | number, a: Action) => applyAction(w, typeof c === "number" ? c : c.id, a);

/** Steps the world `days` in-game days with the rule bots driving the market. `onDay` runs after each day closes. */
export function run(w: World, days: number, onDay?: (day: number) => void): void {
  const hours = (days * w.cfg.time.gameMinutesPerDay) / 60;
  let seen = w.metrics.days.length;
  for (let h = 0; h < hours; h++) {
    stepHour(w, ruleBotHook);
    if (w.metrics.days.length > seen) {
      seen = w.metrics.days.length;
      onDay?.(seen - 1);
    }
  }
}

/** A snapshot of the circular-economy identity and the places FD can hide. */
export interface Snap {
  minted: number;
  supply: number;
  reserve: number;
  allocated: number;
  burned: number;
  identity: number; // minted − (supply + reserve + allocated + burned); should be ~0 under the cap
}

export function snap(w: World): Snap {
  const minted = w.ledger.minted();
  const supply = w.ledger.supply();
  const reserve = w.ledger.reserve();
  const allocated = w.ledger.allocated();
  const burned = w.ledger.burned();
  return { minted, supply, reserve, allocated, burned, identity: minted - (supply + reserve + allocated + burned) };
}

/**
 * The invariants a well-formed world must keep at all times. Returns the list of violations (empty when sound).
 * `label` is folded into each message. In the open mode (circular off) the identity check is skipped.
 */
export function checkInvariants(w: World, label = ""): string[] {
  const out: string[] = [];
  const pre = label ? `${label}: ` : "";
  // 1. Double-entry: every balance sums to zero (the ledger throws on its own, but we also surface it).
  try {
    w.ledger.assertBalanced();
  } catch (e) {
    out.push(`${pre}ledger out of balance (${(e as Error).message})`);
  }
  // 2. Escrow and allocation accounts must never go negative; a plain company cash account may (an
  //    overdraft is the intended credit mechanic, bounded by insolvency.debtLimitFd). Locked FD must
  //    never exceed a solvent account's balance, and never be negative.
  const plainCo = /^co:\d+$/; // co:<id> is spendable cash; co:stake:…, co:bridge:… etc. are escrow
  for (const [acct, cents] of w.ledger.accounts()) {
    const v = cents / 100;
    const isCo = acct.startsWith("co:");
    const escrow = isCo && !plainCo.test(acct);
    if (escrow || acct.startsWith("alloc:") || acct === "reserve") {
      if (v < -EPS) out.push(`${pre}${acct} is negative (${v.toFixed(2)} FD)`);
    }
    if (isCo) {
      const lk = w.ledger.locked(acct);
      if (lk < -EPS) out.push(`${pre}${acct} locked is negative (${lk.toFixed(2)})`);
      // Only a quirk worth flagging when the account is solvent: locked over a positive balance.
      if (v > EPS && lk > v + EPS) out.push(`${pre}${acct} locked ${lk.toFixed(2)} > balance ${v.toFixed(2)}`);
    }
  }
  // 3. The cap identity under the circular economy: nothing minted or destroyed outside the rules.
  if (w.cfg.token.circular.enabled) {
    const s = snap(w);
    if (Math.abs(s.identity) > EPS) out.push(`${pre}cap identity off by ${s.identity.toFixed(2)} FD (minted ${s.minted} ≠ supply ${s.supply.toFixed(2)} + reserve ${s.reserve.toFixed(2)} + alloc ${s.allocated.toFixed(2)} + burned ${s.burned.toFixed(2)})`);
    if (s.supply < -EPS) out.push(`${pre}total company supply negative (${s.supply.toFixed(2)})`);
    if (s.burned < -EPS) out.push(`${pre}burned is negative (${s.burned.toFixed(2)})`);
  }
  // 4. Per-company bookkeeping that the engine assumes.
  for (const c of w.companies) {
    if (c.stakedFd < -EPS) out.push(`${pre}${c.name} stakedFd negative (${c.stakedFd.toFixed(2)})`);
  }
  return out;
}

export const burnTags = [...CIRCULAR_BURNS];


// ---- Pass 2026-11-03b: the three rules of the next restart (studio/reviews/redteam-2026-11-03b.md) ----------------

/** The three switches that go live together at the next restart: the player brokerage, the Reserve, cash now. */
export const THREE_SWITCHES: Record<string, unknown> = {
  "brokerage.enabled": true,
  "cashReserve.enabled": true,
  "token.payment.cashNow.enabled": true,
};

/** The live profile with the three switches on, and any overrides on top. */
export const threeConfig = (overrides: Record<string, unknown> = {}): EconomyConfig => liveConfig({ ...THREE_SWITCHES, ...overrides });

/** Every account's balance and spend-only part, hashed with the clock: two worlds that replay bit for bit hash alike. */
export function ledgerHash(w: World): string {
  const rows = [...w.ledger.accounts()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  let h = 0x811c9dc5;
  const mix = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  for (const [acct, cents] of rows) mix(`${acct}=${cents}/${Math.round(w.ledger.locked(acct) * 100)};`);
  mix(`t=${w.t};n=${w.companies.length};r=${w.receivables.length};l=${w.loads.size}`);
  return `${h.toString(16).padStart(8, "0")}:${rows.length}`;
}

/** A read-only tap on a world's ledger: every posting `key` names is summed under that key (the probes' accounting). */
export type TapKey = (from: string, to: string, ref: string) => string | null;
export function tapLedger(w: World, key: TapKey): Map<string, number> {
  const sums = new Map<string, number>();
  const ledger = w.ledger;
  const post = ledger.post.bind(ledger);
  ledger.post = ((t: number, from: string, to: string, amount: number, ref: string, mode?: Parameters<typeof post>[5]) => {
    const moved = post(t, from, to, amount, ref, mode);
    const k = key(from, to, ref);
    if (k !== null) sums.set(k, (sums.get(k) ?? 0) + Math.round(amount * 100) / 100);
    return moved;
  }) as typeof ledger.post;
  return sums;
}

/** The company a `co:` account belongs to (`co:<id>`, `co:stake:<id>`, `co:cashreserve:<id>`...), or null (pools, loan stakes). */
export function companyOfAccount(acct: string): number | null {
  if (acct.startsWith("co:loanstake:") || acct.startsWith("co:pool:")) return null;
  const m = /^co:(?:[a-z-]+:)?(\d+)$/.exec(acct);
  return m ? Number(m[1]) : null;
}

/** What the NPC factor is still owed and hasn't recovered, and the overdraft paper has pushed through (the FD a bond cap must stop). */
export function factorLeak(w: World): { uncovered: number; overdraft: number } {
  const log = w.factoringLog;
  return { uncovered: log?.uncoveredFd ?? 0, overdraft: log?.overdraftFd ?? 0 };
}

/**
 * The invariants the three rules add, beyond `checkInvariants`: the pair link is two-way and one of each role, a stake
 * never stands above the FD its account holds, a launch hold never pays out more than it kept, the Reserve's settling
 * entries agree with its account, and no receivable is negative. (Money conservation and the cap identity are
 * `checkInvariants`; a broker's bond cover is measured by the factor-leak probe, since the engine counts a broker's
 * own shipper paper in its AP too.)
 */
export function checkThree(w: World, label = ""): string[] {
  const out: string[] = [];
  const pre = label ? `${label}: ` : "";
  for (const c of w.companies) {
    if (w.cfg.brokerage.enabled && c.partnerId !== undefined) {
      const p = w.companies[c.partnerId - 1];
      if (!p || p.partnerId !== c.id) out.push(`${pre}${c.name}: the pair link isn't two-way (${c.id} -> ${c.partnerId})`);
      else if (p.role === c.role) out.push(`${pre}${c.name}: a pair of two ${c.role}s`);
    }
    const stake = w.ledger.balance(`co:stake:${c.id}`);
    if (c.stakedFd > stake + EPS) out.push(`${pre}${c.name}: stakedFd ${c.stakedFd.toFixed(2)} over its stake account ${stake.toFixed(2)}`);
    const h = c.launchBond;
    if (h && h.drawnFd > h.heldFd + EPS) out.push(`${pre}${c.name}: the launch hold paid ${h.drawnFd.toFixed(2)} of ${h.heldFd.toFixed(2)} kept`);
    if (w.cfg.cashReserve.enabled) {
      if ((c.reserveLowFd ?? 0) < -EPS) out.push(`${pre}${c.name}: the Reserve's week low is negative`);
      const settling = (c.reserveOut ?? []).reduce((acc, x) => acc + x.fd, 0);
      const acctFd = w.ledger.balance(reserveOutAccount(c.id));
      if (Math.abs(settling - acctFd) > 1) out.push(`${pre}${c.name}: the Reserve's settling entries ${settling.toFixed(2)} != its account ${acctFd.toFixed(2)}`);
    }
  }
  for (const r of w.receivables) if (r.amountFd < -EPS) out.push(`${pre}receivable ${r.id} is negative (${r.amountFd.toFixed(2)})`);
  return out;
}

// ---- Pass 3 (2026-11-03): the economy's bump (studio/reviews/economy-player34.md, "The bump") ----------------------

/**
 * The bump's values, as the restart would set them in LIVE_LEVERS: the table's 29 rows (economy-player34.md "The bump",
 * as of 26a8b8e), the three brokerage rows included. Applied to a copy of the live profile here; the shared config is never edited.
 */
export const BUMP_LEVERS: Record<string, unknown> = {
  "board.overCeilingMax": 1,
  "board.refuseOverCeiling": true,
  "labor.payFloorShareOfMarket": 0.85,
  "labor.unhappyNoticeDays": 7,
  "labor.underpayMemory.days": 56,
  "labor.underpayMemory.askPremium": 0.1,
  "rates.npcCeilingMarkup": 1.2,
  "rates.exitDeadheadMaxShareOfMiles": 0.5,
  "rates.seasons.volumeGain": 1,
  "hos.restHours": 10,
  "hos.breakMinutes": 30,
  "fuel.stopEveryMi": 400,
  "fuel.stopMinutes": 15,
  "hos.cycleHours": 70,
  "safety.enforcement.fineEarnedMult": 3,
  "safety.review.auditDays": 14,
  "safety.enforcement.oosHours.hos": 34,
  "safety.enforcement.oosHours.defect": [24, 48],
  "safety.review.hiddenDetect": 0.6,
  "contracts.closedToBadRating": true,
  "guard.dispatcherDefaultOn": false,
  "guard.autoStaffDefault": false,
  "guard.hireCoverWeeks": 4,
  "equipmentFinance.netOfPurchaseLoans": true,
  "brokerage.enabled": true,
  "permits.suretyPctPerYear": [0.01, 0.06],
  "token.credit.premiumMax": 0.1,
  "equipmentFinance.closedWithPools": true,
  "usedMarket.npcLot.deliveryDays": 7,
};

/** The live profile with the three switches and the bump on, and any overrides on top. */
export const bumpConfig = (overrides: Record<string, unknown> = {}): EconomyConfig => liveConfig({ ...THREE_SWITCHES, ...BUMP_LEVERS, ...overrides });
