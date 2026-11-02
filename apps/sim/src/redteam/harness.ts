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
