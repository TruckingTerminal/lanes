import { dayOf, dayOfSeason } from "./clock.js";
import { returnPoolCashToDepositors } from "./finance.js";
import { companyAccount } from "./ledger.js";
import type { SeasonCloseRecord } from "./types.js";
import { payPermits, type World } from "./world.js";

/** The last 30 in-game days of a season: permanent purchases are locked (§Circular economy — season close). */
export function inCloseWindow(w: World, day = dayOf(w.t, w.cfg)): boolean {
  if (!w.cfg.seasonClose.enabled) return false;
  return dayOfSeason(day, w.cfg) >= w.cfg.time.daysPerSeason - w.cfg.seasonClose.lockDays;
}

/** In-game days until the close window opens (0 once inside it). */
export function daysUntilLock(w: World, day = dayOf(w.t, w.cfg)): number {
  if (!w.cfg.seasonClose.enabled) return Infinity;
  return Math.max(0, w.cfg.time.daysPerSeason - w.cfg.seasonClose.lockDays - dayOfSeason(day, w.cfg));
}

/**
 * Year-end close (§Circular economy — season close). FD becomes "retained
 * earnings after taxes": each company keeps 10%, capped at 25,000 FD — or, if
 * more, its last four weeks of spending, so a working-capital buffer survives —
 * and the rest is burned. Equipment Finance pays its cash out to depositors first.
 * Assets and loans carry over; the reputation record decays 30%; Miles are
 * snapshotted and the next season's count starts at zero. Then authority and
 * licenses renew for the new season.
 */
export function closeSeason(w: World, season: number, day: number): SeasonCloseRecord {
  const { seasonClose } = w.cfg;
  returnPoolCashToDepositors(w);
  const supplyBeforeFd = w.ledger.supply();
  let burnedFd = 0;
  let companiesAtCap = 0;
  for (const c of w.companies) {
    const acct = companyAccount(c.id);
    const balance = w.ledger.balance(acct);
    if (balance > 0) {
      const workingCapital = c.weeklySpend.reduce((a, b) => a + b, 0);
      const keep = Math.min(balance, Math.max(Math.min(balance * seasonClose.carryoverPct, seasonClose.carryoverCapFd), workingCapital));
      if (keep >= seasonClose.carryoverCapFd) companiesAtCap++;
      // Round the burn up to the cent so no one keeps more than the cap.
      const burn = Math.ceil((balance - keep) * 100) / 100;
      w.ledger.post(w.t, acct, "sink:season_close", burn, `season:${season}`);
      burnedFd += burn;
    }

    // The record shrinks, so reputation drifts back toward the newcomer prior and level falls.
    const keepRecord = 1 - seasonClose.reputationDecay;
    c.delivered *= keepRecord;
    c.onTime *= keepRecord;
    c.late *= keepRecord;
    const prior = w.cfg.reputation.priorLoads;
    c.reputation = c.delivered > 0 ? (c.onTime + prior * w.cfg.reputation.start) / (c.delivered + prior) : w.cfg.reputation.start;

    c.milesHistory.push(c.milesTotal);
    c.milesTotal = 0;
    c.milesByDay = { day: day + 1, amount: 0 };
    c.lanePairToday.clear();
  }
  const record: SeasonCloseRecord = { season, day, supplyBeforeFd, burnedFd, supplyAfterFd: w.ledger.supply(), companiesAtCap };
  w.seasonCloses.push(record);
  for (const c of w.companies) payPermits(w, c);
  return record;
}
