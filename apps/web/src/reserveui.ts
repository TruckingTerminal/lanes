import { closeKeepFd, companyAccount, dayOf, holdingCostApplies, inCloseWindow, reserveCapFd, reserveFd, reserveOn, shelteredFd, windUpFd, workingCapital, type Company, type World } from "@lanes/engine";
import { RESERVE } from "./copy-reserve.js";
import { debtCountdown, cashDipAhead } from "./figures.js";
import { loanRows } from "./finance.js";
import { dateLabel, fdFull, pct, shortDate, weekday } from "./format.js";
import { invoices, weekCosts } from "./ledger.js";

/**
 * The Reserve on Money (UX next-screens §3.8; the director's sprint §15), as figures: every one from the engine's own
 * rules (cashReserve.ts, solvency.ts, season.ts), never an estimate of the page's own. The card, its two sheets, its
 * Needs-you items and the debt line read these; ui/ReserveCard.tsx draws them.
 */

const cashOf = (w: World, c: Company): number => w.ledger.balance(companyAccount(c.id));

/**
 * Which charge the Reserve keeps FD from, as the config has it (the writer's finding, writer-sprint §11): the year-end
 * close in a world with seasons, before launch; otherwise the weekly holding cost where it applies (the live world has
 * no close); null when neither runs.
 */
export function reservePhase(w: World): "close" | "holding" | null {
  if (w.token.launchDay === null && w.cfg.seasonClose.enabled) return w.cfg.seasonClose.burn ? "close" : null;
  return holdingCostApplies(w) ? "holding" : null;
}

/** The close's day: the last day of this season (closeSeason runs at its end). */
const closeDay = (w: World): number => {
  const per = w.cfg.time.daysPerSeason;
  return (Math.floor(dayOf(w.t, w.cfg) / per) + 1) * per - 1;
};

/** Today's cash that the next charge would reach: over working capital (the holding cost), over the close's keep (the close). */
export function overFreeFd(w: World, c: Company): number {
  const cash = cashOf(w, c);
  const phase = reservePhase(w);
  if (phase === "holding") return Math.max(0, cash - workingCapital(w, c));
  if (phase === "close") return cash > 0 ? Math.max(0, cash - closeKeepFd(w, c, cash)) : 0;
  return 0;
}

/** What that charge would take at today's cash: the week's holding cost on it, or the close's burn. */
export function chargeAtTodayFd(w: World, c: Company): number {
  const over = overFreeFd(w, c);
  return reservePhase(w) === "holding" ? over * w.cfg.holdingCost.weeklyRate : over;
}

export interface ReserveCardFigures {
  /** Open on Money (it holds FD, something is settling, or today's cash is over the free line); otherwise the fold. */
  open: boolean;
  balance: number;
  sheltered: number;
  cap: number;
  /** What the charge reads as unsheltered: the balance over what's sheltered this week. */
  over: number;
  shelterLine: string;
  overLine: string | null;
  phaseLine: string | null;
  roomLine: string | null;
  settling: { fd: number; day: number; text: string }[];
  foot: string[];
}

/** §3.8, the card: null with the Reserve off. */
export function reserveCard(w: World, c: Company): ReserveCardFigures | null {
  if (!reserveOn(w)) return null;
  const balance = reserveFd(w, c.id);
  const sheltered = shelteredFd(w, c);
  const cap = reserveCapFd(w, c);
  const over = Math.max(0, balance - sheltered);
  const phase = reservePhase(w);
  const free = overFreeFd(w, c);
  const room = Math.max(0, cap - balance);
  const weeks = w.cfg.cashReserve.capWeeks;
  const settling = [...(c.reserveOut ?? [])].sort((a, b) => a.day - b.day).map((x) => ({ fd: x.fd, day: x.day, text: RESERVE.settling(fdFull(x.fd), weekday(x.day)) }));
  const charge = chargeAtTodayFd(w, c);
  return {
    open: balance >= 0.5 || settling.length > 0 || free >= 0.5,
    balance,
    sheltered,
    cap,
    over,
    shelterLine: cap >= 0.5 ? RESERVE.shelterIs(weeks) : RESERVE.shelterNone(weeks),
    overLine: over >= 0.5 ? RESERVE.overShelter(fdFull(over)) : null,
    phaseLine: phase === "holding" ? RESERVE.phaseHolding(pct(w.cfg.holdingCost.weeklyRate)) : phase === "close" ? RESERVE.phaseClose(shortDate(closeDay(w))) : null,
    roomLine: free >= 0.5 && room >= 0.5 && charge >= 0.5 ? (phase === "close" ? RESERVE.roomClose(fdFull(charge), fdFull(room)) : RESERVE.roomHolding(fdFull(charge), fdFull(room))) : null,
    settling,
    foot: [RESERVE.foot, ...(w.cfg.insolvency.countReserve === true ? [RESERVE.footCounts] : []), ...(w.token.launchDay === null ? [RESERVE.footLaunch] : [])],
  };
}

/** A week of the costs Money's card lists: lease minimums, insurance, the yard, per diem for the week and loan payments. */
export function weekCostsFd(w: World, c: Company): number {
  const k = weekCosts(w, c);
  return k.leaseMinimum + k.insurance + k.yard + 7 * k.perDiemPerDay + loanRows(w, c).reduce((s, l) => s + l.weeklyFd, 0);
}

export interface Chip {
  label: string;
  fd: number;
}

/** §3.8, the deposit sheet: the chips, the field's default (the smaller of the room and the cash over the free line), and why it's off. */
export function depositSheet(w: World, c: Company): { cash: number; chips: Chip[]; dflt: number | null; disabled: string | null } {
  const cash = cashOf(w, c);
  const room = Math.max(0, reserveCapFd(w, c) - reserveFd(w, c.id));
  const free = Math.min(overFreeFd(w, c), Math.max(0, cash));
  const chips = [...(room >= 0.5 ? [{ label: RESERVE.chipRoom(fdFull(room)), fd: room }] : []), ...(free >= 0.5 ? [{ label: RESERVE.chipOver(fdFull(free)), fd: free }] : [])];
  // The engine refuses these (actions.ts: a revoked authority; cashReserve.ts: winding up, no cash).
  const disabled = c.authority.status === "revoked" ? RESERVE.revoked : c.liquidatingSince !== null ? RESERVE.windingUp : cash < 0.5 ? RESERVE.noCash : null;
  return { cash, chips, dflt: room >= 0.5 && free >= 0.5 ? Math.floor(Math.min(room, free)) : null, disabled };
}

/** The deposit's outcome lines and its warnings (amber, never a block) for `fd` put in. */
export function depositLines(w: World, c: Company, fd: number): { lines: string[]; warns: string[] } {
  const cash = cashOf(w, c);
  const balance = reserveFd(w, c.id);
  const after = cash - fd;
  const warns: string[] = [];
  const costs = weekCostsFd(w, c);
  if (after < costs) warns.push(RESERVE.warnWeek(fdFull(after), fdFull(costs)));
  const dip = after >= 0 ? cashDipAhead(w, c, 30, after) : null;
  if (dip) {
    const lands = invoices(w, c).filter((i) => i.dueDay === dip.landsDay).reduce((s, i) => s + i.amountFd, 0);
    warns.push(RESERVE.warnDip(dateLabel(dip.day), fdFull(lands)));
  }
  const overCap = Math.max(0, balance + fd - reserveCapFd(w, c));
  if (overCap >= 0.5) warns.push(RESERVE.warnOver(fdFull(overCap)));
  return { lines: [RESERVE.depositAfter(fdFull(after), fdFull(balance + fd)), RESERVE.depositFrom], warns };
}

/** §3.8, the withdraw sheet: All, and what cash is short while it's under zero (the field's default then); the day it lands. */
export function withdrawSheet(w: World, c: Company): { balance: number; chips: Chip[]; dflt: number | null; when: string; settleDay: number } {
  const cash = cashOf(w, c);
  const balance = reserveFd(w, c.id);
  const short = cash < 0 ? Math.min(-cash, balance) : 0;
  const settleDay = dayOf(w.t, w.cfg) + w.cfg.cashReserve.settleDays;
  return {
    balance,
    chips: [...(balance >= 0.5 ? [{ label: RESERVE.chipAll(fdFull(balance)), fd: balance }] : []), ...(short >= 0.5 ? [{ label: RESERVE.chipShort(fdFull(short)), fd: short }] : [])],
    dflt: short >= 0.5 ? Math.min(balance, Math.ceil(short)) : null,
    when: RESERVE.withdrawWhen(weekday(settleDay)),
    settleDay,
  };
}

/** What stays sheltered after taking `fd` out: the week's low falls with the balance (cashReserve.ts withdrawReserve). Null with no shelter yet, as the card. */
export function withdrawAfterLine(w: World, c: Company, fd: number): string | null {
  const cap = reserveCapFd(w, c);
  return cap >= 0.5 ? RESERVE.withdrawAfter(fdFull(Math.max(0, Math.min(shelteredFd(w, c), reserveFd(w, c.id) - fd))), fdFull(cap)) : null;
}

/**
 * §3.8's first Needs-you item: cash under zero while the Reserve holds FD. With the weeks-in-debt count running (the
 * engine's own figure under the line, or a check already counted) it ranks with the countdown, as its action; otherwise
 * it's the director's tier-2 line (§15): the Reserve covers it, but bills and purchases need cash. Its button withdraws
 * what cash is short.
 */
export function reserveNeed(w: World, c: Company): { key: string; text: string; first: boolean; shortFd: number; button: string; after: string } | null {
  if (!reserveOn(w)) return null;
  const cash = cashOf(w, c);
  const balance = reserveFd(w, c.id);
  if (cash > -0.5 || balance < 0.5) return null;
  const shortFd = Math.min(-cash, balance);
  const running = windUpFd(w, c) < -w.cfg.insolvency.debtLimitFd || c.weeksInDebt > 0;
  const after = RESERVE.needAfter(fdFull(shortFd), weekday(dayOf(w.t, w.cfg) + w.cfg.cashReserve.settleDays));
  return running
    ? { key: "reserve:count", text: RESERVE.needCount(fdFull(cash), fdFull(balance)), first: true, shortFd, button: RESERVE.needWithdraw(fdFull(shortFd)), after }
    : { key: "reserve:covers", text: RESERVE.needCovers(fdFull(cash)), first: false, shortFd, button: RESERVE.needWithdraw(fdFull(shortFd)), after };
}

/** §3.8's second item: the close window (a world with seasons, before launch), while cash is over the free line and the Reserve has room. */
export function reserveCloseNeed(w: World, c: Company): { key: string; text: string } | null {
  if (!reserveOn(w) || reservePhase(w) !== "close" || !inCloseWindow(w)) return null;
  const burn = chargeAtTodayFd(w, c);
  const room = Math.max(0, reserveCapFd(w, c) - reserveFd(w, c.id));
  if (burn < 0.5 || room < 0.5) return null;
  return { key: `reserve:close:${Math.floor(dayOf(w.t, w.cfg) / w.cfg.time.daysPerSeason)}`, text: RESERVE.needClose(shortDate(closeDay(w)), fdFull(burn), fdFull(room)) };
}

/**
 * The director's §15: with the winding-up check counting the Reserve, the weeks-in-debt warning reads the same sum, in his
 * words; null with the switch off (the old line stands) or the count not running.
 */
export function reserveDebtLine(w: World, c: Company): string | null {
  if (w.cfg.insolvency.countReserve !== true || !reserveOn(w)) return null;
  const d = debtCountdown(w, c);
  if (!d.under && c.weeksInDebt === 0) return null;
  const windDay = d.nextDay + 7 * Math.max(0, d.of - d.n - 1);
  return RESERVE.debtTogether(fdFull(d.shortFd), fdFull(w.cfg.insolvency.debtLimitFd), d.n, d.of, dateLabel(windDay));
}
