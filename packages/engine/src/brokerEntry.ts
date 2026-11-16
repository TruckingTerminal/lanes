/**
 * AI broker entry by conditions (config brokerRisk.entry; the director's §3, director-sprint-2026-11-15.md; Jeff,
 * 2026-11-15: "Let's do it for now, but ideally we want players to open brokerages"; the economy's sizes,
 * studio/reviews/economy-broker-entry-2026-11-15.md). The market renews itself where brokered freight and margins call for
 * it: a broker that stops trading is wound up (population.ts windUpDormantBrokers, brokerRisk.windUpDormant, which entry
 * runs with), and a new one enters where the freight per trading broker is high and the survivors' margins are healthy.
 *
 * Weekly and national (tenders go to any AI broker, so the market is national):
 * - the flow signal: NPC tenders offered to brokers over the last flowWeeks (freight.ts tenderToBroker, counted at the
 *   offer), per trading broker. A trading broker is licensed, not wound up and not liquidating; a player's brokerage counts,
 *   so an entrant never arrives where players supply the brokered freight, and so does one founded and not open yet, so a
 *   wave of entry can't overshoot while it waits. It is read against the same measure over the rule's own weeks
 *   refFromWeek to refToWeek, taken once (a world started with the rule: the opening's weeks 5 to 12);
 * - the margin signal: the AI brokers' margin after costs over the last marginWeeks (their running operating figures).
 *
 * With the flow over flowRatio × the reference and the margin over marginMin, one brokerage (at most maxPerWeek) is founded;
 * it opens lagDays later (authority and bond). The engine founds it; the bots open it with the opening's kit (agents
 * ruleBots.ts openBrokerEntrants: a persona and its vetting drawn as the opening's, a new name, new authority, no payment
 * history), through openEntrant here: the starting grant and the licence stake, drawn on the emission cap's budget under
 * faucet:broker_entry (emission.ts noteBudgetDraw), so the schedule's total stands.
 *
 * Off, nothing here runs: no signal is kept, no tender is counted, nothing enters, and no world field is written.
 *
 * The director's players-first ruling (director-broker-players-2026-11-15.md; brokerRisk.entry.playersFirst): the AI
 * entrant is the backstop, so it yields to a player. With `yields` on, a brokerage a carrier forms (brokerage.ts
 * formBrokerage) withdraws the newest one founded and not yet open (yieldEntrant), one for one; its capital is drawn only
 * at the opening, so a withdrawn one costs the cap nothing. A carrier's brokerage that stops trading (dormant, lapsed)
 * stops counting, as tradingBroker reads it. brokerEntrySignal is the reading shown to players (`signal`).
 */
import { dayOf } from "./clock.js";
import { noteBudgetDraw } from "./emission.js";
import { companyAccount } from "./ledger.js";
import { brokerLicensed, stakeFd } from "./staking.js";
import type { BrokerEntryReading, BrokerEntryState, Company, StandingOrder } from "./types.js";
import { formCompany, type World } from "./world.js";

export const brokerEntryOn = (w: World): boolean => w.cfg.brokerRisk.entry?.enabled === true;

/** An AI broker: a broker no person runs and no player's carrier owns (windows.ts byPlayer's complement). */
export const aiBrokerCo = (c: Company): boolean => c.role === "broker" && !c.human && c.partnerId === undefined;

/**
 * A trading broker, AI or a player's: licensed, not wound up, not liquidating. A brokerage a carrier owns must also be at
 * work (the red team's 0.25.6 low item: "a dormant player brokerage stops counting"): loads open now, or a tender posted,
 * tendered to its own carrier or taken from it in the last flowWeeks, its formation counting as its first day at work.
 */
export const tradingBroker = (w: World, c: Company): boolean =>
  c.role === "broker" && c.retiredDay === undefined && c.liquidatingSince === null && brokerLicensed(w, c) && (c.partnerId === undefined || brokerAtWork(w, c));

/** A brokerage a carrier owns at work: loads open, or active (or formed) within entry's flowWeeks. */
export function brokerAtWork(w: World, c: Company): boolean {
  if (c.openBrokerLoads > 0) return true;
  const since = dayOf(w.t, w.cfg) - (c.brokerActiveDay ?? c.createdDay);
  return since < w.cfg.brokerRisk.entry.flowWeeks * 7;
}

/** brokerage.ts: a carrier's brokerage did a tender's work today (posted, to its own carrier, or taken from it), with entry on. */
export function noteBrokerAtWork(w: World, c: Company): void {
  if (brokerEntryOn(w)) c.brokerActiveDay = dayOf(w.t, w.cfg);
}

/** The brokerages founded and not yet open (nor withdrawn). */
export const pendingEntrants = (s: BrokerEntryState): number => s.entrants.filter((e) => e.companyId === undefined && e.withdrawn === undefined).length;

/** A brokerage a carrier owns: a player's, or a bot carrier's pair (brokerage.ts formBrokerage). */
export const carrierOwnedBroker = (c: Company): boolean => c.role === "broker" && c.partnerId !== undefined;

/** The director's players-first switches, each needing entry on (`path` is read on its own, brokerage screen only). */
export const playersFirst = (w: World): { yields: boolean; signal: boolean; hint: boolean } => {
  const p = w.cfg.brokerRisk.entry?.playersFirst;
  const on = brokerEntryOn(w);
  return { yields: on && p?.yields === true, signal: on && p?.signal === true, hint: on && p?.hint === true };
};

/** A reading over both lines: the flow over flowRatio × the reference and the margin over marginMin (what founds one). */
export const readingOver = (w: World, r: BrokerEntryReading | null | undefined): boolean => {
  const k = w.cfg.brokerRisk.entry;
  return !!r && r.flowRatio !== null && r.flowRatio > k.flowRatio && r.margin !== null && r.margin > k.marginMin;
};

function sample(w: World, check: number, tenders: number): BrokerEntryState["weeks"][number] {
  let revenueFd = 0;
  let costFd = 0;
  let trading = 0;
  for (const c of w.companies) {
    if (c.role !== "broker") continue;
    if (aiBrokerCo(c)) {
      revenueFd += c.operating.revenueFd;
      costFd += c.operating.costFd;
    }
    if (tradingBroker(w, c)) trading++;
  }
  return { check, day: dayOf(w.t, w.cfg), tenders, revenueFd, costFd, trading };
}

/** The rule's state, begun on first use with its check 0: tenders from now, the AI brokers' figures as they stand. */
function state(w: World): BrokerEntryState {
  return (w.brokerEntry ??= { tenders: 0, weeks: [sample(w, 0, 0)], checks: 0, ref: null, last: null, readings: [], entrants: [], capitalFd: 0 });
}

/** An NPC shipper's load offered to the brokers (freight.ts tenderToBroker), with the rule on. */
export function noteBrokerTender(w: World): void {
  if (!brokerEntryOn(w)) return;
  state(w).tenders++;
}

const at = (s: BrokerEntryState, check: number) => s.weeks.find((x) => x.check === check);

/**
 * Weekly (step.ts, with the other weekly checks): the week's sample, the reference once its weeks are in, the reading, and
 * a brokerage founded when both signals call for it.
 */
export function weeklyBrokerEntry(w: World): void {
  if (!brokerEntryOn(w)) return;
  const k = w.cfg.brokerRisk.entry;
  const s = state(w);
  const day = dayOf(w.t, w.cfg);
  s.checks++;
  const now = sample(w, s.checks, s.tenders);
  s.weeks.push(now);
  // Players-first §2 (the monthly report): a carrier's brokerage trading at the last check and not now has stopped.
  const owned = w.companies.filter((c) => carrierOwnedBroker(c) && tradingBroker(w, c)).map((c) => c.id);
  for (const id of s.carrierOwned ?? []) if (!owned.includes(id)) (s.carrierOwnedStops ??= []).push({ day, companyId: id });
  s.carrierOwned = owned;
  // The reference, once: tenders a week per trading broker over the rule's weeks refFromWeek to refToWeek.
  if (s.ref === null && s.checks >= k.refToWeek) {
    const from = at(s, k.refFromWeek - 1);
    const to = at(s, k.refToWeek);
    const weeks = s.weeks.filter((x) => x.check >= k.refFromWeek && x.check <= k.refToWeek);
    const trading = weeks.reduce((a, x) => a + x.trading, 0) / Math.max(1, weeks.length);
    s.ref = from && to ? (to.tenders - from.tenders) / (k.refToWeek - k.refFromWeek + 1) / Math.max(1, trading) : 0;
  }
  // The flow: tenders a week per trading broker over flowWeeks, the founded-but-not-open counted as trading.
  const pending = pendingEntrants(s);
  const f0 = at(s, s.checks - k.flowWeeks);
  const flow = f0 ? (now.tenders - f0.tenders) / k.flowWeeks / Math.max(1, now.trading + pending) : null;
  // The margin: the AI brokers' revenue less costs over marginWeeks, over the revenue (from check 0 while the window is short).
  const m0 = at(s, Math.max(0, s.checks - k.marginWeeks)) ?? s.weeks[0]!;
  const revenue = now.revenueFd - m0.revenueFd;
  const margin = revenue > 0 ? (revenue - (now.costFd - m0.costFd)) / revenue : null;
  const reading: BrokerEntryReading = { day, flowRatio: flow !== null && s.ref !== null && s.ref > 0 ? flow / s.ref : null, margin, trading: now.trading, pending };
  s.last = reading;
  if (s.checks % 4 === 0) s.readings.push(reading);
  // Keep the samples to the reference while it's being taken, then to the longest window.
  const keep = Math.max(k.flowWeeks, k.marginWeeks);
  if (s.ref !== null) while (s.weeks.length > keep + 1) s.weeks.shift();
  // Founding: both signals over their lines, the reference taken.
  if (readingOver(w, reading)) {
    for (let i = 0; i < k.maxPerWeek; i++) s.entrants.push({ founded: day, opens: day + k.lagDays });
  }
}

/** The brokerages due to open today (the bots open them: agents ruleBots.ts openBrokerEntrants). */
export function dueEntrants(w: World): BrokerEntryState["entrants"] {
  if (!brokerEntryOn(w) || !w.brokerEntry) return [];
  const today = dayOf(w.t, w.cfg);
  return w.brokerEntry.entrants.filter((e) => e.companyId === undefined && e.withdrawn === undefined && e.opens <= today);
}

/** What the bots draw for an entrant, as the opening draws its brokers (agents ruleBots.ts populate). */
export interface EntrantSpec {
  name: string;
  homeHubId: string;
  strategy: string;
  orders: StandingOrder[];
  vetting: 0 | 1 | 2;
}

/**
 * A founded brokerage opens: new authority (no age, so vetting and the credit score treat it as new) and no payment
 * history, the opening's starting grant and licence stake drawn on the cap's budget (faucet:broker_entry), its vetting
 * as drawn. Returns the company.
 */
export function openEntrant(w: World, e: BrokerEntryState["entrants"][number], spec: EntrantSpec): Company {
  const s = state(w);
  const c = formCompany(w, { name: spec.name, role: "broker", homeHubId: spec.homeHubId, strategy: spec.strategy, orders: spec.orders, freePath: false, authorityAgeDays: 0, grantFrom: "faucet:broker_entry" });
  let capital = w.cfg.company.startingGrantFd;
  if (w.cfg.token.staking.enabled) {
    const stake = w.cfg.token.staking.roles.broker;
    w.ledger.post(w.t, "faucet:broker_entry", companyAccount(c.id), stake, `grant:stake:${c.id}`);
    stakeFd(w, c, stake);
    capital += stake;
  }
  noteBudgetDraw(w, capital);
  s.capitalFd += capital;
  c.vetting = spec.vetting;
  c.entrant = { foundedDay: e.founded };
  e.companyId = c.id;
  e.opened = dayOf(w.t, w.cfg);
  return c;
}

/** The director's seam: the rule's last reading (null while it's off or before its first check). Nothing reads it yet. */
export function brokerEntrySignal(w: World): (BrokerEntryReading & { ref: number | null; flowLine: number; marginLine: number }) | null {
  if (!brokerEntryOn(w) || !w.brokerEntry?.last) return null;
  const k = w.cfg.brokerRisk.entry;
  return { ...w.brokerEntry.last, ref: w.brokerEntry.ref, flowLine: k.flowRatio, marginLine: k.marginMin };
}

/**
 * Withdraws the brokerage founded most recently and not yet open; `forId`, the brokerage it yields to (players-first §1:
 * brokerage.ts formBrokerage calls it with `yields` on). True when one was withdrawn.
 */
export function yieldEntrant(w: World, forId?: number): boolean {
  if (!brokerEntryOn(w) || !w.brokerEntry) return false;
  const e = [...w.brokerEntry.entrants].reverse().find((x) => x.companyId === undefined && x.withdrawn === undefined);
  if (!e) return false;
  e.withdrawn = dayOf(w.t, w.cfg);
  if (forId !== undefined) e.withdrawnFor = forId;
  return true;
}

/** brokerRisk.entry's new-broker label: an entrant whose authority is younger than newLabelDays (the page's "New broker · since"). */
export function newEntrant(w: World, c: Company): boolean {
  return c.entrant !== undefined && dayOf(w.t, w.cfg) - c.authority.since < w.cfg.brokerRisk.entry.newLabelDays;
}

/** Any of the market's renewal rules on: entry, the brokers' wind-up, the NPC fleets' wind-up (the monthly report's counts). */
export const renewalOn = (w: World): boolean => brokerEntryOn(w) || w.cfg.brokerRisk.windUpDormant || w.cfg.insolvency.windUpNpcFleets === true;

/**
 * The renewal's counts for days [from, to]: AI brokerages founded, opened and wound up, and NPC fleets wound up; with entry
 * on, the brokerages a carrier owns opened and stopped (players-first §2), and entry's last reading.
 */
export function renewalCounts(w: World, from: number, to: number): { founded: number; opened: number; brokersWoundUp: number; fleetsWoundUp: number; carrierOwnedOpened?: number; carrierOwnedStopped?: number; reading?: { flowRatio: number | null; margin: number | null; over: boolean; pending: number } | null } {
  const inside = (d: number | undefined) => d !== undefined && d >= from && d <= to;
  const entrants = w.brokerEntry?.entrants ?? [];
  const counts = {
    founded: entrants.filter((e) => inside(e.founded)).length,
    opened: entrants.filter((e) => inside(e.opened)).length,
    brokersWoundUp: (w.brokersWoundUp ?? []).filter((x) => inside(x.day)).length,
    fleetsWoundUp: (w.fleetsWoundUp ?? []).filter((x) => inside(x.day)).length,
  };
  if (!brokerEntryOn(w)) return counts;
  const last = w.brokerEntry?.last ?? null;
  return {
    ...counts,
    carrierOwnedOpened: (w.brokerageLog?.formed ?? []).filter((f) => inside(f.day)).length,
    carrierOwnedStopped: (w.brokerEntry?.carrierOwnedStops ?? []).filter((x) => inside(x.day)).length,
    reading: last ? { flowRatio: last.flowRatio, margin: last.margin, over: readingOver(w, last), pending: last.pending } : null,
  };
}

/** The run report's renewal section (report.ts), for the economy's gate. */
export interface RenewalReport {
  /**
   * By year of the run: AI brokerages founded and opened, AI brokers wound up, NPC fleets wound up; with entry on, the
   * brokerages a carrier owns opened and stopped trading (players-first §2).
   */
  byYear: { year: number; founded: number; opened: number; brokersWoundUp: number; fleetsWoundUp: number; carrierOwnedOpened?: number; carrierOwnedStopped?: number }[];
  /**
   * The entrants: founded, opened, withdrawn before opening (`yielded`: of them, to a carrier's new brokerage, players-first
   * §1), and those opened that failed again (liquidated or wound up).
   */
  entrants: { founded: number; opened: number; withdrawn: number; yielded: number; failedAgain: number };
  /** The entrants' capital drawn on the cap's budget (faucet:broker_entry). */
  capitalFd: number;
  /** Brokers trading at the end: AI brokers, and brokerages a carrier owns (a player's, or a bot carrier's pair, brokerage.ts). */
  tradingEnd: { ai: number; carrierOwned: number };
  /** Entry's reference, and its readings every four weeks. */
  ref: number | null;
  readings: BrokerEntryReading[];
}

export function renewalReport(w: World): RenewalReport | undefined {
  if (!renewalOn(w)) return undefined;
  const year = w.cfg.time.daysPerSeason;
  const last = dayOf(w.t, w.cfg);
  const byYear: RenewalReport["byYear"] = [];
  for (let y = 0; y * year <= last; y++) {
    const { reading: _r, ...counts } = renewalCounts(w, y * year, (y + 1) * year - 1);
    byYear.push({ year: y + 1, ...counts });
  }
  const s = w.brokerEntry;
  const opened = (s?.entrants ?? []).filter((e) => e.companyId !== undefined);
  const failedAgain = opened.filter((e) => {
    const c = w.companies[e.companyId! - 1]!;
    return c.retiredDay !== undefined || c.bankruptcies > 0;
  }).length;
  let ai = 0;
  let carrierOwned = 0;
  for (const c of w.companies) if (tradingBroker(w, c)) aiBrokerCo(c) ? ai++ : carrierOwned++;
  return {
    byYear,
    entrants: { founded: s?.entrants.length ?? 0, opened: opened.length, withdrawn: (s?.entrants ?? []).filter((e) => e.withdrawn !== undefined).length, yielded: (s?.entrants ?? []).filter((e) => e.withdrawnFor !== undefined).length, failedAgain },
    capitalFd: s?.capitalFd ?? 0,
    tradingEnd: { ai, carrierOwned },
    ref: s?.ref ?? null,
    readings: s?.readings ?? [],
  };
}
