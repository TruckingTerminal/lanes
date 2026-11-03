import type { JSX } from "preact";
import { layerOpen } from "@lanes/engine";
import { CAPS } from "../copy.js";
import { fleetCaps } from "../figures.js";
import { layerDay } from "../tabs.js";
import { me, S, useData } from "../state.js";

/**
 * What limits the fleet, in one line (the director's R19; the writer's caps.line): the cap that binds first, then what
 * would change it ("Yards open Jan 29.", "Staking allows 10."). Amber when the fleet is at it. On the Truck tab, the
 * Dealer, Company and Staking.
 */
export function CapsLine(): JSX.Element | null {
  useData();
  const g = S.game;
  if (!g?.player) return null;
  const w = g.w;
  const c = me();
  const k = fleetCaps(w, c);
  const others = [
    ...(k.binding.kind === "yard" && w.cfg.unlockLadder.enabled && !layerOpen(w, "businesses") ? [CAPS.yardsOpen(layerDay(w, "businesses"))] : []),
    ...k.others.filter((o) => o.kind === "stake" && o.n > k.cap).map((o) => CAPS.stake(o.n)),
  ].join(" ");
  return <p class={k.running >= k.cap ? "small warn" : "muted small"}>{CAPS.line(k.cap, CAPS.binding[k.binding.kind](k.binding.n), others)}</p>;
}
