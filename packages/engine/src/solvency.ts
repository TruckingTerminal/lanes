import { dayOf } from "./clock.js";
import { returnLease } from "./capacity.js";
import { ordersOf } from "./dealer.js";
import { facilitiesOf } from "./demand.js";
import { depositorValue, POOL_ACCOUNT, poolCash, withdraw } from "./finance.js";
import { companyAccount } from "./ledger.js";
import { signPolicy } from "./insurance.js";
import { releaseAll } from "./labor.js";
import { listTrailer, listTruck } from "./market.js";
import { trailersOf } from "./trailers.js";
import { endPlayerLease, leasedOut } from "./playerLeases.js";
import { withdrawSalesOf } from "./assetSales.js";
import type { Company } from "./types.js";
import { trailerValue, truckValue } from "./dealer.js";
import { forfeitAirdrop } from "./token.js";
import { releaseStake } from "./staking.js";
import { bondHeld, factoringLog, paperOpen, releaseContractStakes } from "./receivables.js";
import { holdsRestart, retireCompany } from "./population.js";
import { releaseYard } from "./items.js";
import { releaseBusinesses } from "./businesses.js";
import { createTruck, freshPaperwork, newSafetyRecord, type World } from "./world.js";

/**
 * Without seasons the holding cost replaces the year-end burn; with seasons it's
 * off unless configured. Once FD can be sold for dollars, the exit does its job.
 */
export function holdingCostApplies(w: World): boolean {
  if (w.token.launchDay !== null) return w.cfg.token.holdingCostAfterLaunch;
  return !w.cfg.seasonClose.enabled || w.cfg.holdingCost.withSeasons;
}

/** Cash a company can hold free: the larger of the floor and its last four weeks of spending. */
export function workingCapital(w: World, c: Company): number {
  return Math.max(w.cfg.holdingCost.minProtectedFd, c.weeklySpend.reduce((a, b) => a + b, 0));
}

/**
 * Weekly holding cost (a sink) on cash above working capital, and on the
 * Equipment Finance pool's idle cash — so parking a hoard in the pool doesn't
 * dodge it. Money lent out is working and pays nothing.
 */
export function chargeHoldingCost(w: World): void {
  const rate = w.cfg.holdingCost.weeklyRate;
  for (const c of w.companies) {
    if (c.liquidatingSince !== null || c.role === "holder") continue; // a wallet outside the game isn't charged
    const acct = companyAccount(c.id);
    const excess = w.ledger.balance(acct) - workingCapital(w, c);
    if (excess > 0) w.ledger.post(w.t, acct, "sink:holding_cost", excess * rate, `holding:${c.id}`);
  }
  const idle = poolCash(w);
  if (idle > 0) w.ledger.post(w.t, POOL_ACCOUNT, "sink:holding_cost", idle * rate, "holding:pool");
}

/** Weekly: a company too far in the red for too long goes into liquidation. */
export function checkSolvency(w: World): void {
  const { insolvency } = w.cfg;
  for (const c of w.companies) {
    if (c.liquidatingSince !== null || c.retiredDay !== undefined) continue; // a carrier the population dial retired has left the market
    c.weeksInDebt = w.ledger.balance(companyAccount(c.id)) < -insolvency.debtLimitFd ? c.weeksInDebt + 1 : 0;
    if (c.weeksInDebt >= insolvency.weeksInDebt) startLiquidation(w, c);
  }
}

/**
 * Liquidation: the company stops bidding and taking broker freight, pulls any
 * finance deposits, and its facilities close (their slots go back to supply).
 * Its trucks are fire-sold as they come off the road.
 */
export function startLiquidation(w: World, c: Company): void {
  // The factoring log (payment terms): who went under, and with how many owned trucks.
  if (w.cfg.token.payment.enabled) {
    let owned = 0;
    for (const t of w.trucksByCompany.get(c.id) ?? []) if (t.lease === "owned") owned++;
    factoringLog(w).liquidations.push({ companyId: c.id, day: dayOf(w.t, w.cfg), ownedTrucks: owned });
  }
  c.liquidatingSince = dayOf(w.t, w.cfg);
  c.suspendedOrders = c.orders;
  c.orders = [];
  releaseContractStakes(w, c); // contract stakes go first to the pool holding the company's paper
  releaseYard(w, c); // the yard is lost; its bond comes back for the creditors
  releaseBusinesses(w, c); // the businesses close; their bonds come back for the creditors
  // The licence stake pays creditors before anything else; under the factoring contract a broker's stays its bond
  // until the paper it backs is paid (processLiquidations releases it then).
  if (!bondHeld(w, c)) releaseStake(w, c);
  for (const o of w.leaseOffers) if (o.status === "open" && o.lessorId === c.id) o.status = "withdrawn"; // assets: no new leases
  withdrawSalesOf(w, c); // …and nothing it listed for sale sells now
  for (const t of w.trucksByCompany.get(c.id)!) w.manualBids.delete(t.id);
  const deposited = depositorValue(w, c.id);
  if (deposited > 0.01) withdraw(w, c.id, deposited);
  for (const f of facilitiesOf(w, c.id)) {
    f.ownerId = 0;
    w.facilitySupply[f.type]++;
  }
  c.bankruptcies++;
  // The staff are let go: nobody keeps paying a dispatcher for a fleet that's being sold.
  releaseAll(w, c);
  forfeitAirdrop(w, c);
  w.metrics.onBankruptcy();
  w.listener?.({ kind: "liquidated", companyId: c.id });
}

/**
 * Daily: list every owned truck of a liquidating company that's idle, at a fire
 * sale (70% of used value, cut 10 points a week, back to dealer supply below 25%),
 * and hand extra leases back.
 * Once nothing is left — no owned trucks, no orders, no broker freight in flight —
 * what it still owes is written off and the owner restarts on the free path.
 */
export function processLiquidations(w: World): void {
  const { insolvency } = w.cfg;
  const today = dayOf(w.t, w.cfg);
  for (const c of w.companies) {
    if (c.liquidatingSince === null || c.retiredDay !== undefined) continue;
    const fleet = w.trucksByCompany.get(c.id)!;
    for (const t of [...fleet]) {
      // Extra leases go back to the lessor as soon as they're idle; so does a player lessor's tractor.
      if (t.lease === "lessor" && t.status === "idle") {
        returnLease(w, c, t);
        continue;
      }
      if (leasedOut(t)) {
        if (t.status === "idle" || t.status === "parked") endPlayerLease(w, t, true);
        continue;
      }
      if (t.lease !== "owned" || (t.status !== "idle" && t.status !== "parked")) continue;
      const value = truckValue(w, t);
      listTruck(
        w,
        c.id,
        t,
        value * insolvency.fireSaleStartPctOfValue,
        value * insolvency.fireSaleFloorPctOfValue,
        value * insolvency.fireSaleStepPctOfValue,
      );
    }
    // Assets: the trailers in the yard are fire-sold too (unsold, they go for scrap), and its tractors out on
    // lease come back when they're next idle, to be sold with the rest.
    if (w.cfg.assets.enabled) {
      for (const t of w.trucks) if (t.lessorId === c.id && leasedOut(t) && (t.status === "idle" || t.status === "parked")) endPlayerLease(w, t, true);
      for (const tr of [...trailersOf(w, c.id)]) {
        if (tr.status !== "dropped" || tr.lease !== "owned" || tr.refurbUntilT !== null) continue;
        const value = trailerValue(w, tr);
        listTrailer(w, c.id, tr, value * insolvency.fireSaleStartPctOfValue, value * insolvency.fireSaleFloorPctOfValue, value * insolvency.fireSaleStepPctOfValue);
      }
    }
    // Once the fleet is gone, a bankrupt still sits out a few weeks before the restart: going broke isn't a free reset.
    const trailersLeft = w.cfg.assets.enabled && (trailersOf(w, c.id).some((tr) => tr.lease === "owned") || w.trucks.some((t) => t.lessorId === c.id && leasedOut(t) && t.status !== "retired"));
    const done =
      !fleet.some((t) => t.lease !== "npc") && !trailersLeft && ordersOf(w, c.id).length === 0 && c.openBrokerLoads === 0 && today - c.liquidatingSince >= insolvency.restartAfterDays;
    // A broker's bond stays behind its paper until the last invoice is paid (token.payment.factoring.contract).
    if (done && bondHeld(w, c) && paperOpen(w, c.id)) continue;
    if (done && bondHeld(w, c)) releaseStake(w, c);
    // The population dial (population.ts): under the floor a bot that went under leaves the market instead of restarting.
    if (done && holdsRestart(w, c)) {
      retireCompany(w, c, "held");
      continue;
    }
    // A revoked authority waits out its bar; new authority comes with the restart (dailySafety).
    if (done && c.authority.status !== "revoked") restart(w, c);
  }
}

/**
 * New authority after a revocation and its bar: a new MC with no age, an empty
 * safety record (the account's history stays on `authority`, where vetting sees
 * it), and whatever was still owed discharged.
 */
export function refile(w: World, c: Company): void {
  const day = dayOf(w.t, w.cfg);
  c.authority.status = "active";
  c.authority.since = day;
  c.authority.barredUntil = null;
  c.authority.record.push({ day, text: "Filed for new authority." });
  c.safety = newSafetyRecord();
  c.policy = { hos: "legal", speed: "legal", maintenance: "full" };
  c.judgmentFd = 0;
  c.claims = [];
  for (const t of w.trucksByCompany.get(c.id)!) freshPaperwork(t);
  signPolicy(w, c);
  if (c.liquidatingSince !== null) restart(w, c);
}

export function restart(w: World, c: Company): void {
  const acct = companyAccount(c.id);
  const owed = -w.ledger.balance(acct);
  // The spend-only FD it owes is discharged with the rest (before the write-off, which is free FD and would pay it).
  w.ledger.forgiveLockDebt(acct);
  // Unpaid debt is FD that was spent but never earned: writing it off is a faucet, tagged so it shows.
  if (owed > 0) w.ledger.post(w.t, "faucet:bankruptcy_writeoff", acct, owed, `writeoff:${c.id}`);
  c.liquidatingSince = null;
  c.weeksInDebt = 0;
  // Judgments are discharged in the bankruptcy, like any other debt.
  c.judgmentFd = 0;
  // What it still holds that was spend-only stays spend-only: a bankruptcy is no way to free locked FD (the red team,
  // 2026-11-03: unlocking it here let a stake of airdrop FD come back free through a liquidation).
  c.freePathLockedFd = Math.min(c.freePathLockedFd, w.ledger.locked(acct));
  c.weeklySpend = [];
  c.orders = c.suspendedOrders;
  c.suspendedOrders = [];
  // A fresh start: no record to trade on, and carriers go back to the NPC lease.
  c.reputation = w.cfg.reputation.start;
  c.delivered = 0;
  c.onTime = 0;
  c.late = 0;
  const fleet = w.trucksByCompany.get(c.id)!;
  if (c.role === "carrier" && !fleet.some((t) => t.lease === "npc")) createTruck(w, c, "npc", "workhorse", "van");
  c.suretyClaimedFd = 0;
  // A bankrupt broker's licence lapses with its stake (Jeff, 2026-10-29): it takes no loads until it posts the stake again, from what it earns or buys. No grant.
}
