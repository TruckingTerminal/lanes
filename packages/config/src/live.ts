/**
 * The live levers (locked 2026-10-30 after the v27–v35 batches; TOKENOMICS.md "The big sinks" and
 * "The launch price is what the dollars support"): every 0.18.0 switch on, and the sizes the ten-seed
 * runs settled on. `economyConfig` stays the base the tests and the design notes are written against;
 * the live world and the sim's default profile run `withLiveLevers(economyConfig)`.
 *
 * Paths are config paths, as the sim's `--set` takes them, so a batch and the live world read alike.
 */
import { economyConfig, type EconomyConfig } from "./economy.config.js";

export const LIVE_LEVERS: Record<string, unknown> = {
  // The token and the circular economy (reserve, staking, pools, payment terms, the catalogue).
  "token.enabled": true,
  "token.circular.enabled": true,
  "token.circular.taxBurnShare": 1,
  "token.circular.reserveFactor.exponent": 2,
  "token.circular.volumeStabilizer": true,
  "token.staking.enabled": true,
  "token.pools.enabled": true,
  "token.payment.enabled": true,
  "token.catalogue.enabled": true,
  // Launch without capital: the window's dollars seed the pool, the pool as deep as the float.
  "token.launch.seedUsd": 0,
  "token.airdrop.atLaunch": 0.1,
  "token.exchange.dailySellShareOfPool": 0.01,
  "token.exchange.sellFeePct": 0.07,
  // The balance dial: NPC rates toward the sink-to-faucet target, read over a season's quarter.
  "token.circular.rateStabilizer.enabled": true,
  "token.circular.rateStabilizer.stepPerMonth": 0.05,
  "token.circular.rateStabilizer.windowDays": 90,
  // The sinks: fuel tax, sales tax, businesses on hubs and interstates, managers.
  "costs.fuelTax.enabled": true,
  "costs.salesTax.enabled": true,
  "costs.salesTax.pct": 0.07,
  "businesses.enabled": true,
  "labor.managers.enabled": true,
  // The skill edge: wider ranges for drivers and dispatchers, stronger managers.
  "labor.dispatcher.noise": [0.08, 0.005],
  "labor.driver.mpgRange": 0.3,
  "labor.driver.maintRange": 0.5,
  "labor.managers.ops.noiseWith": 0.7,
  "labor.managers.ops.skillBonus": 0.08,
};

/** A config with the levers applied by path; throws on a path the config doesn't have. */
export function applyLevers(base: EconomyConfig, levers: Record<string, unknown>): EconomyConfig {
  const out = structuredClone(base) as Record<string, unknown>;
  for (const [path, value] of Object.entries(levers)) {
    const keys = path.split(".");
    let node: Record<string, unknown> = out;
    for (const k of keys.slice(0, -1)) {
      if (typeof node[k] !== "object" || node[k] === null) throw new Error(`lever ${path}: no such config path`);
      node = node[k] as Record<string, unknown>;
    }
    const last = keys[keys.length - 1]!;
    if (!(last in node)) throw new Error(`lever ${path}: no such config value`);
    node[last] = value;
  }
  return out as unknown as EconomyConfig;
}

export const withLiveLevers = (base: EconomyConfig = economyConfig): EconomyConfig => applyLevers(base, LIVE_LEVERS);
