/**
 * The unlock ladder (config `unlockLadder`; Jeff, 2026-10-31): after launch the game opens in layers, so the
 * features that move the most money arrive once the economy is deep enough to carry them, on a schedule
 * everyone can see. The beta stays fully open; at launch hauling stays open and each later layer opens on the
 * first day that both its published day (`afterDays` from launch) and its metrics are reached: operating
 * companies (`minActive`, a stand-in for verified players until the server checks identity) and dollars in
 * the exchange pool (`minPoolUsd`), both hard to fake. Once open, a layer stays
 * open; what was built in the beta keeps running. Layers: businesses (buying businesses and facilities),
 * brokerage (re-brokering loads), robbery (hiring crews). The Back Lot, aliases and crews join when built.
 */
import { dayOf } from "./clock.js";
import type { World } from "./world.js";

export type Layer = "businesses" | "brokerage" | "robbery";
export const LAYERS: Layer[] = ["businesses", "brokerage", "robbery"];

/** Whether a layer is open now (always, when the ladder is off or before launch). */
export function layerOpen(w: World, layer: Layer): boolean {
  if (!w.cfg.unlockLadder.enabled || w.token.launchDay === null) return true;
  return w.ladder[layer] !== null;
}

/** Why an action of a closed layer is refused, or null when it may go ahead. */
export function layerBlock(w: World, layer: Layer): string | null {
  if (layerOpen(w, layer)) return null;
  const k = w.cfg.unlockLadder.layers[layer];
  return `${layer === "businesses" ? "Businesses" : layer === "brokerage" ? "Re-brokering" : "Crews"} open ${k.afterDays} days after launch (day ${w.token.launchDay! + k.afterDays})${k.minActive > 0 ? `, with ${k.minActive} active companies` : ""}${k.minPoolUsd > 0 ? `, and $${k.minPoolUsd.toLocaleString("en-US")} in the pool` : ""}`;
}

/** Daily, after launch: a layer opens on the first day its published day and its metrics are both reached. */
export function dailyLadder(w: World): void {
  if (!w.cfg.unlockLadder.enabled || w.token.launchDay === null) return;
  const day = dayOf(w.t, w.cfg);
  let active: number | null = null;
  for (const layer of LAYERS) {
    if (w.ladder[layer] !== null) continue;
    const k = w.cfg.unlockLadder.layers[layer];
    if (day - w.token.launchDay < k.afterDays || w.token.poolUsd < k.minPoolUsd) continue;
    active ??= w.companies.filter((c) => c.role !== "holder" && c.liquidatingSince === null && c.authority.status === "active").length;
    if (active < k.minActive) continue;
    w.ladder[layer] = day;
  }
}
