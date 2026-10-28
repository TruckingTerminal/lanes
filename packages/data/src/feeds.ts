import { dsin } from "./dmath.js";
/**
 * Real-world data feeds, reduced to what the engine consumes. Adapters for EIA
 * diesel, NWS alerts, FRED, sector ETFs and Cass come later; each will record
 * fixtures so sims replay real history offline. Until then, sims use these
 * neutral feeds.
 */
export interface Feeds {
  /** Real diesel ÷ its 52-week average for an in-game day (1 = average). */
  dieselRatio(day: number): number;
  /** Sector multiplier for a hub (before clamping), 1 = neutral. */
  sector(hubId: string, day: number): number;
  /** Slow macro dial from the Cass Freight Index, 1 = neutral. */
  cycle(day: number): number;
  /** Weather multiplier on volume for a hub, 1 = clear. */
  weather(hubId: string, day: number): number;
}

export interface CycleOptions {
  seed: number;
  /** Length of one boom-and-bust, in in-game days. */
  periodDays?: number;
  /** Swing of the wave around 1 (0.25 = ±25% freight volume). */
  amplitude?: number;
  /** Daily shock size and how long shocks persist (AR(1)). */
  noise?: number;
  persistence?: number;
}

/**
 * Synthetic stand-in for the Cass Freight Index dial until the real feed and its
 * fixtures exist: a slow wave plus persistent noise, seeded so runs replay. It
 * moves freight volume; rates follow through the load-to-truck ratio.
 */
export function syntheticCassCycle(o: CycleOptions): (day: number) => number {
  const period = o.periodDays ?? 300;
  const amp = o.amplitude ?? 0.25;
  const sigma = o.noise ?? 0.01;
  const rho = o.persistence ?? 0.97;
  let s = (o.seed ^ 0x9e3779b9) >>> 0;
  const rand = () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const phase = rand() * 2 * Math.PI;
  const shocks: number[] = [0];
  return (day) => {
    // Filled in day order, so the series doesn't depend on who asks first.
    while (shocks.length <= day) shocks.push(rho * shocks.at(-1)! + sigma * 2 * (rand() + rand() + rand() - 1.5));
    const v = 1 + amp * dsin((2 * Math.PI * day) / period + phase) + shocks[day]!;
    return Math.max(1 - 2 * amp, Math.min(1 + 2 * amp, v));
  };
}

export const neutralFeeds: Feeds = {
  dieselRatio: () => 1,
  sector: () => 1,
  cycle: () => 1,
  weather: () => 1,
};
