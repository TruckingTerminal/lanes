/**
 * The unlock ladder (config `unlockLadder`; Jeff, 2026-10-31): after launch the game opens in layers, so the
 * features that move the most money arrive once the economy is deep enough to carry them, on a schedule
 * everyone can see. The beta stays fully open unless `beta.enabled` (beta one, Jeff 2026-11-01): then the
 * same schedule runs from the world's first day, so a new player meets hauling first and the deeper layers on
 * published days, and a layer opened in the beta stays open through the launch. Otherwise, at launch hauling
 * stays open and each later layer opens on the first day that both its published day (`afterDays` from launch)
 * and its metrics are reached: operating
 * companies (`minActive`, a stand-in for verified players until the server checks identity) and dollars in
 * the exchange pool (`minPoolUsd`), both hard to fake. Once open, a layer stays
 * open; what was built in the beta keeps running. Layers: businesses (buying businesses and facilities),
 * brokerage (re-brokering loads), robbery (hiring crews). The Back Lot, aliases and crews join when built.
 */
import { dayOf } from "./clock.js";
import type { World } from "./world.js";

export type Layer = "businesses" | "brokerage" | "robbery";
export const LAYERS: Layer[] = ["businesses", "brokerage", "robbery"];

/** The day the ladder counts from: launch, or the world's first day in a staged beta; null while it doesn't run. */
function ladderFrom(w: World): number | null {
  if (!w.cfg.unlockLadder.enabled) return null;
  if (w.token.launchDay !== null) return w.token.launchDay;
  return w.cfg.unlockLadder.beta.enabled ? 0 : null;
}

/** Whether a layer is open now (always, when the ladder is off, or before launch in an open beta). */
export function layerOpen(w: World, layer: Layer): boolean {
  if (ladderFrom(w) === null) return true;
  return w.ladder[layer] !== null;
}

/** Why an action of a closed layer is refused, or null when it may go ahead. */
export function layerBlock(w: World, layer: Layer): string | null {
  if (layerOpen(w, layer)) return null;
  const k = w.cfg.unlockLadder.layers[layer];
  const name = layer === "businesses" ? "Businesses" : layer === "brokerage" ? "Re-brokering" : "Crews";
  const beta = w.token.launchDay === null;
  const when = beta ? `open on day ${k.afterDays} of the beta` : `open ${k.afterDays} days after launch (day ${w.token.launchDay! + k.afterDays})`;
  return `${name} ${when}${k.minActive > 0 ? `, with ${k.minActive} active companies` : ""}${k.minPoolUsd > 0 && !beta ? `, and $${k.minPoolUsd.toLocaleString("en-US")} in the pool` : ""}`;
}

/** Daily: a layer opens on the first day its published day and its metrics are both reached (the pool's dollars only after launch). */
export function dailyLadder(w: World): void {
  const from = ladderFrom(w);
  if (from === null) return;
  const day = dayOf(w.t, w.cfg);
  const beta = w.token.launchDay === null;
  let active: number | null = null;
  for (const layer of LAYERS) {
    if (w.ladder[layer] !== null) continue;
    const k = w.cfg.unlockLadder.layers[layer];
    if (day - from < k.afterDays || (!beta && w.token.poolUsd < k.minPoolUsd)) continue;
    active ??= w.companies.filter((c) => c.role !== "holder" && c.liquidatingSince === null && c.authority.status === "active").length;
    if (active < k.minActive) continue;
    w.ladder[layer] = day;
  }
}
