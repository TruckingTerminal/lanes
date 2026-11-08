/**
 * The supply ceiling (token.supplyCeiling; Jeff, 2026-10-31: "complete supply control", every faucet,
 * sink, metric and schedule public).
 *
 * After launch the FD outstanding — everything outside the reserve, the genesis allocations and the
 * burns, which is the ledger's supply — may grow at most `growth` over `overDays` game days, then not at
 * all. The path is published at launch and never looks at the price.
 *
 * Weekly, the balance dial trims NPC freight rates (w.stab.rateMult, freight.ts) toward `headroom` under
 * the path, and relaxes them back to where they stood at launch, never above, when there's room. It stops
 * at `rateFloor` of that launch level: below it, honest carriers can't cover fuel and wages. (Measured from
 * launch because the beta's own dial has usually cut rates a long way by then; a floor measured from the
 * base rates would raise them.) When the dial is at its floor and the path is
 * still crowded, or whenever the path itself is reached, the scheduled payouts wait: the airdrop's slices
 * queue on their companies (token.ts unlockAirdrop), owed and never lost, and the developer's vest holds
 * (token.ts weeklyVest). Queued slices are paid as room comes back. It's a ceiling, not a target: sinks
 * that outrun the faucets shrink the supply, and nothing pushes it back up.
 */
import { dayOf } from "./clock.js";
import { clamp } from "./economics.js";
import { dialMayMoveTo } from "./emission.js";
import type { World } from "./world.js";

/** On once the token has launched with the ceiling switched on (circular economy only). */
export function ceilingOn(w: World): boolean {
  return w.cfg.token.supplyCeiling.enabled && w.cfg.token.circular.enabled && w.token.ceiling.baseFd !== null;
}

/** The FD outstanding: everything outside the reserve, the genesis allocations and the burns. */
export function outstandingFd(w: World): number {
  return w.ledger.supply();
}

/** The published path today: 0 when the ceiling is off or before launch. */
export function ceilingFd(w: World): number {
  const base = w.token.ceiling.baseFd;
  if (!ceilingOn(w) || base === null || w.token.launchDay === null) return 0;
  const k = w.cfg.token.supplyCeiling;
  const days = Math.max(0, dayOf(w.t, w.cfg) - w.token.launchDay);
  return base * (1 + k.growth * Math.min(1, days / k.overDays));
}

/** At launch, once it has settled: the path starts from what's outstanding, the dial from where rates stand. */
export function startCeiling(w: World): void {
  if (!w.cfg.token.supplyCeiling.enabled || !w.cfg.token.circular.enabled) return;
  w.token.ceiling.baseFd = outstandingFd(w);
  w.token.ceiling.launchMult = w.stab.rateMult;
}

/** Airdrop owed but queued under the ceiling, across companies. */
export function queuedAirdropFd(w: World): number {
  let s = 0;
  for (const c of w.companies) s += c.airdrop?.queuedFd ?? 0;
  return s;
}

/**
 * Weekly, before the airdrop's slices and the vest: the dial's step, whether the scheduled payouts wait
 * this week, and the room under the target that queued slices may be paid from.
 */
export function weeklyCeiling(w: World): void {
  const st = w.token.ceiling;
  st.holding = false;
  st.roomFd = 0;
  if (!ceilingOn(w)) return;
  const k = w.cfg.token.supplyCeiling;
  const path = ceilingFd(w);
  const target = path * (1 - k.headroom);
  const out = outstandingFd(w);
  // A full step when the supply sits a whole headroom past the target; less the closer it is.
  const gap = clamp((out - target) / Math.max(1, path * k.headroom), -1, 1);
  const floor = st.launchMult * k.rateFloor;
  // The emission cap (emission.ts) is the rate control while it is on: the ceiling's dial holds (or may only lower rates, dialOneWay) and the path's holding rule stands.
  w.stab.rateMult = dialMayMoveTo(w, w.stab.rateMult, clamp(w.stab.rateMult * (1 - gap * k.stepPerWeek), floor, st.launchMult));
  const atFloor = w.stab.rateMult <= floor + 1e-9;
  if (atFloor) st.weeksAtFloor++;
  st.holding = out >= path || (atFloor && out >= target);
  if (st.holding) st.weeksHolding++;
  else st.roomFd = Math.max(0, target - out);
}
