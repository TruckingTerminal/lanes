import { brokerEntrySignal, canFormBrokerage, companyAccount, formationCostFd, layerBlock, playersFirst, readingOver, workingCapital, type Company, type EconMonth, type World } from "@lanes/engine";
import { FIXES } from "./copy-fixes.js";
import { fdFull, shortDate } from "./format.js";

/**
 * The director's players-first ruling on the page (director-broker-players-2026-11-15.md; brokerRisk.entry.playersFirst):
 * the reading that founds an AI brokerage, shown to players as an opening, in the same figures (§2); the path to a
 * brokerage before the carrier can afford one (§3); and What now?'s opportunity (§2's hint). Aggregates only.
 */

const times = (x: number) => `${x.toFixed(1)}×`;
const pctOf = (x: number) => `${Math.round(x * 100)}%`;

/** §2: the brokerage screen's line before forming; null with `signal` off or before entry has a reading. */
export function brokerMarketLine(w: World): string | null {
  if (!playersFirst(w).signal) return null;
  const r = brokerEntrySignal(w);
  if (!r || r.flowRatio === null || r.margin === null) return null;
  if (!readingOver(w, r)) return FIXES.brokersMarketCrowded(times(r.flowRatio), pctOf(r.margin));
  const pending = (w.brokerEntry?.entrants ?? []).filter((e) => e.companyId === undefined && e.withdrawn === undefined);
  const by = pending.length ? Math.max(...pending.map((e) => e.opens)) : null;
  return FIXES.brokersMarketOpen(times(r.flowRatio), pctOf(r.margin), pending.length, by === null ? null : shortDate(by));
}

/** §2: Iuliia's line under it, while the line shows. */
export const brokerMarketIuliia = (w: World): string | null => (brokerMarketLine(w) ? FIXES.iuliiaNewBrokerage : null);

/** What forming a brokerage takes from the carrier: its bond, its licence and the transfer's fee (brokerage.ts formationCostFd). */
export const brokerageCostFd = (w: World): number => formationCostFd(w);

/** §3: before the carrier can afford a brokerage, what it takes and what the carrier has; null with `path` off or once it can. */
export function brokeragePathLine(w: World, carrier: Company): string | null {
  if (w.cfg.brokerRisk.entry?.playersFirst?.path !== true) return null;
  const cost = brokerageCostFd(w);
  const cash = w.ledger.balance(companyAccount(carrier.id));
  if (cash >= cost) return null;
  return FIXES.brokeragePath(fdFull(cost), fdFull(w.cfg.token.staking.roles.broker), pctOf(w.cfg.brokerage.transferFeePct), fdFull(Math.max(0, cash)));
}

/**
 * §2's hint, for What now? (nextstep.ts): the cost, when all hold: the signal over its lines, the layer open, the carrier
 * able to form a brokerage today, and its cash after the cost still over its working capital (solvency.ts). Null otherwise.
 */
export function brokerOpening(w: World, c: Company): { costFd: number } | null {
  if (!playersFirst(w).hint || c.role !== "carrier") return null;
  if (!readingOver(w, brokerEntrySignal(w))) return null;
  if (layerBlock(w, "brokerage") !== null || canFormBrokerage(w, c) !== null) return null;
  const cost = brokerageCostFd(w);
  if (w.ledger.balance(companyAccount(c.id)) - cost < workingCapital(w, c)) return null;
  return { costFd: cost };
}

/**
 * §2, the monthly report in the trade paper's voice: the month's reading at the close and the brokerages opened, a
 * carrier's counted apart. Null with `signal` off or no reading.
 */
export function reportBrokersLine(w: World, rec: EconMonth): string | null {
  const r = rec.renewal;
  if (!playersFirst(w).signal || !r?.reading || r.reading.flowRatio === null || r.reading.margin === null) return null;
  const opened = r.opened + (r.carrierOwnedOpened ?? 0);
  const market = r.reading.over ? FIXES.reportBrokersOpen(pctOf(r.reading.flowRatio - 1), pctOf(r.reading.margin)) : FIXES.reportBrokersCrowded(times(r.reading.flowRatio), pctOf(r.reading.margin));
  return `${market} ${FIXES.reportBrokersOpened(opened, r.carrierOwnedOpened ?? 0)}`;
}
