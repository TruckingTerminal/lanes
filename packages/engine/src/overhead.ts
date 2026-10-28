import type { EconomyConfig } from "@lanes/config";

/** Weekly overhead for a company's k-th truck (1-based): the rate of the highest bracket reached. */
export function overheadForTruck(cfg: EconomyConfig, k: number): number {
  let fd = 0;
  for (const b of cfg.fleetOverhead.brackets) if (k >= b.fromTruck) fd = b.weeklyFd;
  return fd;
}

/** A company's weekly fleet overhead with `trucks` trucks. */
export function fleetOverheadPerWeek(cfg: EconomyConfig, trucks: number): number {
  let total = 0;
  for (let k = 1; k <= trucks; k++) total += overheadForTruck(cfg, k);
  return total;
}

/** What one more truck would add to the weekly bill. */
export function marginalOverhead(cfg: EconomyConfig, trucks: number): number {
  return overheadForTruck(cfg, trucks + 1);
}
