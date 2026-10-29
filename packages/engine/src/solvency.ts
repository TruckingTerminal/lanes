import { dayOf } from "./clock.js";
import { returnLease } from "./capacity.js";
import { ordersOf } from "./dealer.js";
import { facilitiesOf } from "./demand.js";
import { depositorValue, POOL_ACCOUNT, poolCash, withdraw } from "./finance.js";
import { companyAccount } from "./ledger.js";
import { signPolicy } from "./insurance.js";
import { releaseAll } from "./labor.js";
import { listTruck } from "./market.js";
import type { Company } from "./types.js";
import { truckValue } from "./dealer.js";
import { forfeitAirdrop } from "./token.js";
import { releaseStake } from "./staking.js";
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
    if (c.liquidatingSince !== null) continue;
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
    if (c.liquidatingSince !== null) continue;
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
  c.liquidatingSince = dayOf(w.t, w.cfg);
  c.suspendedOrders = c.orders;
  c.orders = [];
  releaseStake(w, c); // the stake pays creditors before anything else
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
    if (c.liquidatingSince === null) continue;
    const fleet = w.trucksByCompany.get(c.id)!;
    for (const t of [...fleet]) {
      // Extra leases go back to the lessor as soon as they're idle.
      if (t.lease === "lessor" && t.status === "idle") {
        returnLease(w, c, t);
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
    // Once the fleet is gone, a bankrupt still sits out a few weeks before the restart: going broke isn't a free reset.
    const done =
      !fleet.some((t) => t.lease !== "npc") && ordersOf(w, c.id).length === 0 && c.openBrokerLoads === 0 && today - c.liquidatingSince >= insolvency.restartAfterDays;
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
  // Unpaid debt is FD that was spent but never earned: writing it off is a faucet, tagged so it shows.
  if (owed > 0) w.ledger.post(w.t, "faucet:bankruptcy_writeoff", acct, owed, `writeoff:${c.id}`);
  c.liquidatingSince = null;
  c.weeksInDebt = 0;
  // Judgments are discharged in the bankruptcy, like any other debt.
  c.judgmentFd = 0;
  c.lockedFd = 0;
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
}
