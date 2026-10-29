/**
 * Player-funded pools (0.18.0, TOKENOMICS.md "The circular economy" §4): one mutual-pool primitive,
 * several lines. A pool holds FD, issues units to depositors at net asset value, earns the line's
 * fees and pays the line's losses, prices by how well it is capitalised (thin → dearer), and pays
 * depositors out through an exit queue. No pool pays yield from emissions: every unit of income is
 * another player's fee. The NPC provider of each line stays as the dearer backstop, so a thin pool
 * never blocks play.
 *
 * Lines today: insurance (auto liability and cargo). Factoring and surety follow.
 */
import { dayOf } from "./clock.js";
import { clamp } from "./economics.js";
import { companyAccount } from "./ledger.js";
import type { Pool, PoolLine } from "./types.js";
import type { World } from "./world.js";

export const poolAccount = (line: PoolLine) => `co:pool:${line}`;

export function newPool(): Pool {
  return { shares: new Map(), totalShares: 0, exiting: [], premiumsFd: 0, claimsFd: 0, shortfallFd: 0, exposureFd: 0 };
}

export const poolsOn = (w: World) => w.cfg.token.pools.enabled;

export function poolLineCash(w: World, line: PoolLine): number {
  return w.ledger.balance(poolAccount(line));
}

function sharePrice(w: World, line: PoolLine): number {
  const p = w.pools[line];
  return p.totalShares > 0 ? poolLineCash(w, line) / p.totalShares : 1;
}

export function poolDepositorValue(w: World, line: PoolLine, companyId: number): number {
  return (w.pools[line].shares.get(companyId) ?? 0) * sharePrice(w, line);
}

/** Capital against the line's exposure (the annual premiums it has written): the pricing signal. */
export function capitalRatio(w: World, line: PoolLine): number {
  const p = w.pools[line];
  const cash = poolLineCash(w, line);
  if (cash <= 0) return 0; // an empty pool is thin whatever it has written: that is what draws the first capital
  return p.exposureFd > 0 ? cash / p.exposureFd : Infinity;
}

/**
 * What the pool charges against the NPC price: 1 when capital is twice the minimum ratio or more,
 * rising toward thinMarkup as it thins. Below the minimum the pool writes nothing and the NPC
 * backstop writes at its own markup.
 */
export function poolMarkup(w: World, line: PoolLine): number | null {
  const k = w.cfg.token.pools[line];
  if (poolLineCash(w, line) <= 0) return null;
  const ratio = capitalRatio(w, line);
  if (ratio < k.minCapitalRatio) return null;
  const t = clamp((ratio - k.minCapitalRatio) / k.minCapitalRatio, 0, 1);
  return k.thinMarkup - (k.thinMarkup - 1) * t;
}

export function depositPool(w: World, line: PoolLine, companyId: number, amountFd: number): string | null {
  if (!poolsOn(w)) return "pools aren't open";
  if (!(amountFd > 0) || w.ledger.balance(companyAccount(companyId)) < amountFd - 0.01) return "insufficient FD";
  const p = w.pools[line];
  // A pool wiped out by claims starts over: the old units are worth nothing.
  if (p.totalShares > 0 && poolLineCash(w, line) <= 0.01) {
    p.shares.clear();
    p.totalShares = 0;
    p.exiting = [];
  }
  const shares = amountFd / sharePrice(w, line);
  w.ledger.post(w.t, companyAccount(companyId), poolAccount(line), amountFd, `pool:${line}:deposit:${companyId}`);
  p.shares.set(companyId, (p.shares.get(companyId) ?? 0) + shares);
  p.totalShares += shares;
  return null;
}

/** Into the exit queue: the units leave the pool's capital count at once and pay out, at the value then, after the wait. */
export function withdrawPool(w: World, line: PoolLine, companyId: number, amountFd: number): string | null {
  if (!poolsOn(w)) return "pools aren't open";
  const p = w.pools[line];
  const held = p.shares.get(companyId) ?? 0;
  const value = held * sharePrice(w, line);
  if (!(amountFd > 0) || held <= 0) return "nothing to withdraw";
  const shares = Math.min(held, (Math.min(amountFd, value) / value) * held);
  p.shares.set(companyId, held - shares);
  p.exiting.push({ companyId, shares, day: dayOf(w.t, w.cfg) + w.cfg.token.pools.exitDays });
  return null;
}

/** Daily: the exit queue pays out oldest first, at most exitLimitPerDay of the pool a day, as far as cash allows. */
export function dailyPools(w: World): void {
  if (!poolsOn(w)) return;
  const today = dayOf(w.t, w.cfg);
  for (const line of Object.keys(w.pools) as PoolLine[]) {
    const p = w.pools[line];
    if (p.exiting.length === 0) continue;
    let room = poolLineCash(w, line) * w.cfg.token.pools.exitLimitPerDay;
    p.exiting.sort((a, b) => a.day - b.day || a.companyId - b.companyId);
    for (const e of p.exiting) {
      if (e.day > today || room <= 0.01) continue;
      const price = sharePrice(w, line);
      const want = e.shares * price;
      const pay = Math.min(want, room, poolLineCash(w, line));
      if (pay <= 0.01) break;
      const shares = pay / price;
      w.ledger.post(w.t, poolAccount(line), companyAccount(e.companyId), pay, `pool:${line}:withdraw:${e.companyId}`);
      p.totalShares -= shares;
      e.shares -= shares;
      room -= pay;
    }
    p.exiting = p.exiting.filter((e) => e.shares * sharePrice(w, line) > 0.01);
  }
}

/**
 * The pool pays a loss on a policy it wrote, as far as its cash goes; the shortfall is recorded and
 * the NPC backstop is deemed to carry it. `to` is who is owed: a sink for an NPC victim, a company
 * account for a player (a shipper's cargo, a carrier's judgment).
 */
export function payClaim(w: World, line: PoolLine, to: string, amountFd: number, ref: string): number {
  const p = w.pools[line];
  const paid = Math.min(amountFd, Math.max(0, poolLineCash(w, line)));
  if (paid > 0.01) w.ledger.post(w.t, poolAccount(line), to, paid, ref);
  p.claimsFd += paid;
  p.shortfallFd += amountFd - paid;
  return paid;
}
