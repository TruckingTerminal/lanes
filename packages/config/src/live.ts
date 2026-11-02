/**
 * The live levers: what the batches settled on, applied to the base config for the live world and for the
 * sim's default profile (`--profile base` runs the bare config, as the tests do). `economyConfig` stays the
 * base the tests and the design notes are written against.
 *
 * Locked 2026-10-30 after the v27–v35 batches (TOKENOMICS.md "The locked levers"): every 0.18.0 switch on and
 * the sizes the ten-seed runs settled on. Switched on 2026-11-01 (Jeff: "Go"; ruleset 0.19.0-phase0.29;
 * TOKENOMICS.md "The package switched on"): the trucks at mid prices with the used lot and the deposit credit,
 * every sink, the staff ladder, the robbers and the Back Lot, the supply path, the airdrop paid locked at the
 * TGE, the bridge, the opening auction, the pool's decaying fee, the beta's dollar window, the team allocation
 * and its real-time vest. Tested as v47-b (the sinks and the trucks), v51-b (the launch rules against the bad
 * actors) and v52-a (that exact profile). Beta one (2026-11-01, ruleset 0.19.1-phase0.30; Jeff: "configure beta
 * one"): the ladder runs from the world's first day, so new players meet hauling first and businesses, then
 * re-brokering, on published days; the crews are off until the Back Lot v2 leaves the simulator (v53).
 * Sprint 1 (2026-11-02, ruleset 0.19.2-phase0.31; Jeff: yes to the dispatcher idle until the first hand-booked
 * load): a one-truck company's dispatcher waits for its owner's first bid or booking by hand, sized as v55-a
 * (studio/reviews/economy-first-board.md).
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
  // Terrain and weather on the route.
  "roads.terrain.enabled": true,
  // The trailer pass and the risk corridors.
  "equipmentOps.enabled": true,
  "docks.enabled": true,
  "theft.enabled": true,
  // The skill edge: wider ranges for drivers and dispatchers, stronger managers.
  "labor.dispatcher.noise": [0.08, 0.005],
  "labor.driver.mpgRange": 0.3,
  "labor.driver.maintRange": 0.5,

  // ---- The package, switched on 2026-11-01 (ruleset 0.19.0-phase0.29). ----
  // The trucks (the EVE plan's step 4; Jeff, 2026-10-31: mid prices, the realistic list × 0.62): tractors and
  // trailers as assets with wear, life and write-offs; the NPC used lot as the free path's way in; the lease
  // deposit counting toward the first truck; purchase loans; leases priced by the truck's value.
  "assets.enabled": true,
  "usedMarket.npcLot.enabled": true,
  "freeEntry.leases.byValue.enabled": true,
  "freeEntry.leases.byValue.depositToPurchase": true,
  "equipmentFinance.purchase.enabled": true,
  "dealerFd.tractor.workhorse": 140_000,
  "dealerFd.tractor.highwayPro": 177_000,
  "dealerFd.tractor.flagship": 214_000,
  "dealerFd.trailer.van": 42_000,
  "dealerFd.trailer.reefer": 79_000,
  "dealerFd.trailer.flatbed": 47_000,
  "wear.rebuildFd.workhorse": 31_500,
  "wear.rebuildFd.highwayPro": 40_000,
  "wear.rebuildFd.flagship": 48_000,
  "assets.trailer.refurbFd.van": 4_800,
  "assets.trailer.refurbFd.reefer": 9_000,
  "assets.trailer.refurbFd.flatbed": 5_300,
  // Staff, sales and direct freight (Jeff, 2026-10-31: "make it difficult, expensive and risky to grow"): the
  // owner runs two trucks, a dispatcher ten; a maintenance manager from the fifth truck at fifteen each, an
  // operations manager from the eighth at twenty; the optional roles; direct contracts behind a sales rep and a
  // performance stake; the scale discounts; a labor pool sized for them.
  "labor.ladder.enabled": true,
  "labor.owner.span": 2,
  "labor.dispatcher.span": [10, 10],
  "labor.managers.roles": true,
  "labor.managers.ops.requiredAbove": 7,
  "labor.managers.ops.span": 20,
  "labor.managers.maint.requiredAbove": 4,
  "labor.managers.maint.span": 15,
  "labor.pool.startDispatchers": 300,
  "labor.pool.startOpsManagers": 60,
  "labor.pool.startMaintManagers": 90,
  "contracts.direct.enabled": true,
  "scaleDiscounts.enabled": true,
  // The theft gaps; contract theft removed (cargo theft is NPC thieves and hired crews only); the robbers and
  // the Back Lot v1, on in the beta (Jeff, 2026-11-01); the unlock ladder from launch.
  "theft.claimsMoveMarket": true,
  "theft.dockWaits": true,
  "fraud.theft.byCarrier": false,
  // Beta one: no crews of any kind until the Back Lot v2 (robbery.lot) is tuned on real players; the v1 switches below stay
  // for the batches that compare against them.
  "robbery.enabled": false,
  "robbery.logbookMinVictimTrucks": 3,
  "robbery.npcFenceShare": 0.6,
  "robbery.realStake": true,
  "robbery.oneCrewPerVictim": true,
  "robbery.takeLocked": true,
  "robbery.fenceByCommodityOn": true,
  "robbery.backLot.enabled": true,
  "robbery.bounty.enabled": true,
  "unlockLadder.enabled": true,
  "unlockLadder.beta.enabled": true,
  // Sprint 1: the first bid by hand (the dispatcher idle until the owner has bid or booked once; v55-a).
  "freeEntry.firstBidByHand": true,
  // Republish (2026-11-02, ruleset 0.20.0-phase0.33; Jeff: "go with your recommendation"): the factoring contract
  // (three game months, the whole fleet, 6% → 2.5% by fleet size, brokers flat 5%, the fee to the reserve, the pools
  // standing down) and the population dial (loads posted per truck in service held inside its band from day 112, the
  // cycles kept) switched on, sized as v56 and v57 (studio/reviews/economy-factoring.md, economy-population-dial.md);
  // demand no longer scales with the carrier count (the dial moves carriers instead). The lock discounts wait for a
  // four-year batch.
  "token.payment.factoring.contract.enabled": true,
  "population.dial.enabled": true,
  "token.demandScalesWithCarriers": false,
  // The supply path (+10% over four years, the dial never under the launch rates) and the whale rules on sales.
  "token.supplyCeiling.enabled": true,
  "token.supplyCeiling.growth": 0.1,
  "token.supplyCeiling.rateFloor": 1,
  "token.exchange.frequency.enabled": true,
  "token.exchange.fallingLimit.enabled": true,
  // The airdrop inside the game: the logbook, the whole allocation paid at the TGE, 1% free and the rest
  // spend-only until the milestones, with the shop items; the farmed-FD tax and the bridge, where every
  // withdrawal is a sale with a timer and a daily cap.
  "token.airdrop.logbook.enabled": true,
  "token.airdrop.logbook.paidLocked": true,
  "token.airdrop.logbook.boost.enabled": true,
  "token.exchange.launchTax.enabled": true,
  "token.exchange.launchTax.boughtExempt": true,
  "token.bridge.enabled": true,
  // The launch: the opening auction (a 40M tranche at one clearing price, $1,000 a person, every dollar into the
  // pool), the pool's own decaying fee, and the beta's dollar window for rigs, trailers, facilities and
  // businesses (every dollar to the pool at the TGE, no cap: Jeff, 2026-11-01).
  "token.launch.auction.enabled": true,
  "token.launch.auction.trancheFd": 40_000_000,
  "token.exchange.launchFee.enabled": true,
  "token.catalogue.usdWindow.assets.enabled": true,
  // The team allocation and its vest: 15% of the cap, nothing for six real months after the TGE, then 1/208 of
  // it a real week for four years, sold into the pool on the clock whatever the price (Jeff, 2026-11-01: no
  // price condition; the share and the years are his to change, one restart while there are no players).
  "token.circular.shares.dev": 0.15,
  "token.treasury.vest.priceFloor": false,
  "token.treasury.vest.realTime": true,
  "token.treasury.vest.linear": true,
  "token.treasury.vest.cliffWeeks": 26,
  "token.treasury.vest.perWeekShare": 1 / 208,
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
