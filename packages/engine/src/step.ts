import { noteBooks } from "./expedite.js";
import { dailyAssets } from "./assets.js";
import { monthlyIntel } from "./intel.js";
import { monthlyEconomy } from "./econMonth.js";
import { monthlyFactory } from "./dealerships.js";
import { billPlayerLeases } from "./playerLeases.js";
import { billRentals } from "./trailers.js";
import { weeklyContracts } from "./contracts.js";
import { runBoardRound, autoBook } from "./board.js";
import { clearBuyback } from "./buyback.js";
import { chargeMinimumRent, monthlyCapacity } from "./capacity.js";
import { ceilingOn, weeklyCeiling } from "./ceiling.js";
import { dailyEmission, dialMayMoveTo, volumeDialMayMoveTo } from "./emission.js";
import { dayOf, isRoundBoundary, MINUTES_PER_HOUR, seasonOf } from "./clock.js";
import { clamp, fuelPrice } from "./economics.js";
import { companyAccount } from "./ledger.js";
import type { DayMetrics } from "./metrics.js";
import { dealerPrice, deliverOrders, restockUsedLot, restockUsedLotDaily } from "./dealer.js";
import { serviceLoans } from "./finance.js";
import { weeklyPurchaseLoans } from "./purchaseLoans.js";
import { dailyRobbery } from "./robbery.js";
import { dailyLadder } from "./ladder.js";
import { dailyFraud } from "./fraud.js";
import { billInsurance, dailyInsurance, monthlyInsurance } from "./insurance.js";
import { chargeYards } from "./home.js";
import { monthlyDealerPrices } from "./dealer.js";
import { monthlyFuelTax } from "./fuelTax.js";
import { weeklyBusinesses } from "./businesses.js";
import { monthlySites } from "./sites.js";
import { dailyLabor, hourlyLabor, monthlyLabor, payDispatchers, weeklyLabor } from "./labor.js";
import { dailyStaking, lockCost, stakeDiscount } from "./staking.js";
import { dailyPools, poolAccount, poolMarkup, poolsOn } from "./pools.js";
import { dailyReceivables } from "./receivables.js";
import { dailyPopulationDial } from "./population.js";
import { creditScore } from "./credit.js";
import { dailySafety, monthlySafety, weeklySafety } from "./safety.js";
import { repossessDefaults, stepListings } from "./market.js";
import { fleetOverheadPerWeek } from "./overhead.js";
import { closeSeason } from "./season.js";
import { dailyReserve, weeklyReserve } from "./cashReserve.js";
import { lapsedBrokerage, releaseLaunchHolds } from "./brokerage.js";
import { chargeHoldingCost, checkSolvency, holdingCostApplies, processLiquidations } from "./solvency.js";
import { dailyBridge, dailyBuyback, launchToken, scaleDemand, seasonAirdrop, tokenLive, weeklyToken, weeklyVest } from "./token.js";
import { moveTrucks } from "./trips.js";
import { companyById, operatingTrucks, payPermits, type World } from "./world.js";

/** Agents get one hook per in-game day; they act only through applyAction. */
export type DailyAgentHook = (w: World, day: number) => void;

/**
 * Advances the world one in-game hour. Order within the hour: trucks move, then
 * a board round runs if this is a round boundary, then day-end jobs run at
 * midnight. The ledger is checked at the end of every tick.
 */
export function stepHour(w: World, agents?: DailyAgentHook): void {
  moveTrucks(w);
  hourlyLabor(w); // offers settle at the truck's next stop (labor.hiring.settleAtStop)
  w.t += MINUTES_PER_HOUR;
  if (isRoundBoundary(w.t, w.cfg)) runBoardRound(w);
  // Between rounds, dispatchers take book-now loads (board.ts autoBook).
  if ((w.t / MINUTES_PER_HOUR) % w.cfg.bookNow.autoEveryHours === 0) autoBook(w);
  if (w.t % w.cfg.time.gameMinutesPerDay === 0) endOfDay(w, dayOf(w.t, w.cfg) - 1, agents);
  w.ledger.assertBalanced();
}

export function runDays(w: World, days: number, agents?: DailyAgentHook, onDay?: (m: DayMetrics) => void): void {
  const hours = (days * w.cfg.time.gameMinutesPerDay) / MINUTES_PER_HOUR;
  let seen = w.metrics.days.length;
  for (let h = 0; h < hours; h++) {
    stepHour(w, agents);
    if (w.metrics.days.length > seen) {
      seen = w.metrics.days.length;
      onDay?.(w.metrics.days.at(-1)!);
    }
  }
}

function endOfDay(w: World, day: number, agents?: DailyAgentHook): void {
  const { cfg } = w;
  deliverOrders(w);
  dailyAssets(w); // assets: refurbishments finish, the end of life, yard thefts
  repossessDefaults(w);
  processLiquidations(w);
  dailyFraud(w);
  dailyRobbery(w); // hired crews whose window ran out give up (robbery.ts)
  dailyLadder(w); // layers of the unlock ladder open (ladder.ts)
  dailySafety(w);
  dailyInsurance(w);
  dailyLabor(w);
  dailyStaking(w);
  dailyPools(w);
  dailyReceivables(w);
  releaseLaunchHolds(w); // a player brokerage's beta bond behind paper open at the launch burns once that paper is paid (brokerage.ts)
  dailyReserve(w); // the Reserve's withdrawals land in cash (cashReserve.ts)

  // Idle fee on owned assets unused for 7+ in-game days, parked and listed ones included (§Owned vs. leased).
  // And a sitting truck burns diesel from its first day: a crewed truck idle at day's end idles for the
  // cab (Jeff, 2026-10-29: a truck that sits costs money, so nobody lets one sit).
  const idleFuel = cfg.costs.idleFuelGalPerDay * fuelPrice(w);
  for (const truck of w.trucks) {
    const unused = truck.status === "idle" || truck.status === "parked" || truck.status === "listed";
    if (truck.lease === "owned" && unused && day - truck.idleSinceDay >= cfg.costs.idleFeeAfterDays) {
      w.ledger.post(w.t, companyAccount(truck.companyId), "sink:idle_fee", cfg.costs.idleFeePerDay, `idle:${truck.id}`);
    }
    if (truck.status === "idle" && truck.companyId && truck.driverId && idleFuel > 0) {
      const c = companyById(w, truck.companyId);
      const burned = lockCost(w, c, idleFuel * (truck.mods.apu ? 0.5 : 1), () => idleFuel * (truck.mods.apu ? 0.5 : 1) * (1 - stakeDiscount(w, c))); // an APU halves it; locked FD earns its discount
      c.fuelGalMonth += cfg.costs.idleFuelGalPerDay * (truck.mods.apu ? 0.5 : 1);
      w.ledger.post(w.t, companyAccount(truck.companyId), "sink:idle_fuel", burned, `idle:${truck.id}`);
      c.operating.costFd += burned;
    }
  }

  restockUsedLotDaily(w); // the NPC used lot, when its rigs come daily (dealer.ts)
  // Facility upkeep, weekly (§Assets and supply caps).
  if ((day + 1) % 7 === 0) {
    restockUsedLot(w); // the NPC used lot (dealer.ts)
    weeklyBusinesses(w);
    for (const f of w.facilities) {
      if (f.ownerId === 0) continue;
      const upkeep = cfg.facilities.types[f.type].upkeepPerWeekFd;
      w.ledger.post(w.t, companyAccount(f.ownerId), "sink:facility_upkeep", upkeep, `upkeep:${f.id}`);
      f.netFd -= upkeep;
    }
    // Fleet overhead, weekly, by operating fleet size (first three trucks free; parked trucks don't count).
    for (const c of w.companies) {
      const trucks = operatingTrucks(w, c.id);
      c.truckWeeks += trucks;
      noteBooks(w, c); // assets.expedite: the week's books, for what the trucks have each kept
      const overhead = fleetOverheadPerWeek(cfg, trucks);
      if (overhead <= 0) continue;
      w.ledger.post(w.t, companyAccount(c.id), "sink:fleet_overhead", overhead, `overhead:${c.id}`);
      c.overheadPaidFd += overhead;
    }
    if (cfg.freeEntry.leases.enabled) chargeMinimumRent(w);
    billRentals(w); // assets: trailer rentals pay their week
    billPlayerLeases(w); // assets: lessees pay their lessors
    serviceLoans(w);
    weeklyPurchaseLoans(w);
    stepListings(w);
    payDispatchers(w); // dispatchers' and managers' weekly pay
    billInsurance(w);
    chargeYards(w);
    weeklyLabor(w);
    weeklySafety(w);
    weeklyContracts(w);
    // Each company's spending this week, for the season-close working-capital carryover.
    for (const c of w.companies) {
      const out = w.ledger.outflowCents(companyAccount(c.id));
      c.weeklySpend.push((out - c.lastOutflowCents) / 100);
      c.lastOutflowCents = out;
      if (c.weeklySpend.length > cfg.seasonClose.workingCapitalWeeks) c.weeklySpend.shift();
    }
    // The buyback clears before the holding cost, so FD sold this week isn't charged for.
    if (cfg.buyback.enabled && !cfg.token.enabled) clearBuyback(w);
    if (holdingCostApplies(w)) chargeHoldingCost(w);
    weeklyReserve(w); // the Reserve's week starts again from its balance now (cashReserve.ts)
    checkSolvency(w);
    if (tokenLive(w)) {
      weeklyCeiling(w); // the dial's step, and whether the airdrop's slices and the vest wait this week
      weeklyToken(w);
      weeklyVest(w);
    }
  }

  // The token launches at the end of beta; after that the treasury buys back daily.
  let launchedToday = false;
  if (cfg.token.enabled && !tokenLive(w) && day + 1 >= Math.round(cfg.token.betaYears * cfg.time.daysPerSeason)) {
    launchToken(w);
    launchedToday = true;
  }
  if (tokenLive(w)) {
    dailyBridge(w);
    dailyBuyback(w);
  }

  // Broker bond via the Surety Desk: 2–12% of 75,000 FD a year by credit, charged daily (§Roles —
  // broker license and bond). The surety pool carries the bond while it is capitalised (pools.ts),
  // at its markup, and then covers the broker's carriers if it is wound up unpaid; otherwise the
  // NPC surety takes the premium and covers nothing.
  const [bestPct, worstPct] = cfg.permits.suretyPctPerYear;
  const suretyMarkup = poolsOn(w) ? poolMarkup(w, "surety") : null;
  let bonds = 0;
  for (const c of w.companies) {
    if (c.role !== "broker") continue;
    if (lapsedBrokerage(w, c)) continue; // a player's brokerage wound down: its licence lapsed with its stake (brokerage.ts)
    const pct = worstPct - (worstPct - bestPct) * (creditScore(w, c) / 100); // the bond priced by credit (credit.ts)
    const premium = (cfg.permits.brokerBondFd * pct) / cfg.time.daysPerSeason;
    if (suretyMarkup !== null) {
      w.ledger.post(w.t, companyAccount(c.id), poolAccount("surety"), premium * suretyMarkup, `surety:${c.id}`);
      w.pools.surety.premiumsFd += premium * suretyMarkup;
      c.suretyWriter = "pool";
      bonds += cfg.permits.brokerBondFd;
    } else {
      w.ledger.post(w.t, companyAccount(c.id), "sink:surety", premium * (poolsOn(w) ? cfg.token.pools.surety.backstopMarkup : 1), `surety:${c.id}`);
      c.suretyWriter = "npc";
    }
  }
  w.pools.surety.exposureFd = bonds;

  // Free-path affordability is tracked apart from purchases, so a run can tell
  // "couldn't earn it" from "nothing left to buy".
  const starterPrice = dealerPrice(w, { tier: "workhorse", trailer: "van" });
  for (const c of w.companies) {
    if (c.freePath && c.firstAffordDay === null && w.ledger.balance(companyAccount(c.id)) >= starterPrice) c.firstAffordDay = day;
  }

  agents?.(w, day);
  if ((day + 1) % cfg.time.daysPerSeason === 0) {
    // The launch has already reset FD: a season close the same day would burn the airdrop and the locked carryover.
    if (cfg.seasonClose.enabled && !launchedToday) closeSeason(w, seasonOf(day, cfg), day);
    // Without seasons, authority and licenses still renew once a year (§Roles: "renew each season").
    else for (const c of w.companies) payPermits(w, c);
    // A later airdrop season closes with the year (token.ts).
    if (tokenLive(w) && !launchedToday) seasonAirdrop(w);
  }
  w.metrics.closeDay(w, day, fuelPrice(w));
  dailyEmission(w, day); // the emission cap: the day's commitments close against today's levers, and the levers for the day to come (emission.ts)
  dailyPopulationDial(w, day); // the population dial reads the day just closed (population.ts)
  if ((day + 1) % cfg.time.daysPerMonth === 0) {
    monthlyStabilizers(w);
    monthlyCapacity(w);
    monthlyLabor(w);
    monthlySafety(w);
    monthlyInsurance(w);
    monthlyFactory(w); // assets: the factory allocation stocks the dealerships and the NPC dealer
    monthlyDealerPrices(w);
    monthlyFuelTax(w);
    monthlySites(w);
    monthlyIntel(w); // last month's record for Intel, last of the close: it reads the month's counters, writes only its own
    monthlyEconomy(w, day); // the public monthly report's record (econMonth.ts): reads the world, writes only w.econ
    if (tokenLive(w)) scaleDemand(w);
  }
}

/**
 * Published stabilizers (§Circular economy): NPC volume moves up to ±10% per
 * month, and the rack spread within ±5%, both toward the sink/faucet target.
 * While the emission cap is on (emission.ts) it is the balance control: the volume dial (volumeMult) follows the rules
 * while the cap is slack and holds where it stands while it binds (emission.ts volumeDialMayMoveTo; the clause of
 * 2026-11-08), and the balance dial (rateMult) holds both ways or, with token.emission.dialOneWay, may still lower NPC
 * rates and never raise them (emission.ts dialMayMoveTo), so nothing can push NPC freight up against a binding cap. The
 * rack spread and the profit-tax stabilizer still move.
 */
export function monthlyStabilizers(w: World): void {
  const { stabilizers } = w.cfg;
  const month = w.metrics.days.slice(-w.cfg.time.daysPerMonth);
  const faucets = month.reduce((s, d) => s + d.faucetFd, 0);
  const sinks = month.reduce((s, d) => s + d.sinkFd, 0);
  if (faucets <= 0) return;
  const ratio = sinks / faucets;
  const [lo, hi] = tokenLive(w)
    ? w.cfg.token.sinkFaucetTargetLive
    : w.cfg.seasonClose.enabled
      ? stabilizers.sinkFaucetTarget
      : stabilizers.sinkFaucetTargetWithoutSeasons;
  const mid = (lo + hi) / 2;
  // Too little sunk → less NPC money in and dearer fuel; too much → the reverse.
  const pressure = clamp((ratio - mid) / ((hi - lo) / 2), -1, 1);
  // The circular economy's balance dial: NPC rates move toward the target every month (freight.ts). Under
  // the supply ceiling the dial answers to the published path instead, weekly (ceiling.ts).
  const rs = w.cfg.token.circular.rateStabilizer;
  if (w.cfg.token.circular.enabled && rs.enabled && !ceilingOn(w)) {
    const window = w.metrics.days.slice(-rs.windowDays);
    const f = window.reduce((s, d) => s + d.faucetFd, 0);
    const r = f > 0 ? window.reduce((s, d) => s + d.sinkFd, 0) / f : ratio;
    const p = clamp((r - mid) / ((hi - lo) / 2), -1, 1);
    w.stab.rateMult = dialMayMoveTo(w, w.stab.rateMult, clamp(w.stab.rateMult * (1 + p * rs.stepPerMonth), rs.range[0], rs.range[1]));
  }
  // After launch the profit-tax rate moves first; freight volume only once the rate is at a limit.
  const ts = w.cfg.token.taxStabilizer;
  if (tokenLive(w) && ts.enabled) {
    const wanted = w.token.profitTaxRate - pressure * ts.stepPerMonth;
    w.token.profitTaxRate = clamp(wanted, ts.range[0], ts.range[1]);
    if (wanted >= ts.range[0] && wanted <= ts.range[1]) return;
  }
  const [vMin, vMax] = tokenLive(w) ? w.cfg.token.volumeRangeLive : stabilizers.volumeRange;
  // The circular economy prices freight off the reserve instead (freight.ts reserveFactor); the volume dial stays at 1.
  // Under the cap the volume dial follows the rules while the cap is slack and holds while it binds (emission.ts volumeDialMayMoveTo).
  if (!w.cfg.token.circular.enabled || w.cfg.token.circular.volumeStabilizer) w.stab.volumeMult = volumeDialMayMoveTo(w, w.stab.volumeMult, clamp(w.stab.volumeMult * (1 + pressure * stabilizers.volumeStepPerMonth), vMin, vMax));
  w.stab.rackSpread = clamp(w.stab.rackSpread - pressure * stabilizers.rackStepPerMonth, 1 - stabilizers.rackSpreadBand, 1 + stabilizers.rackSpreadBand);
}
