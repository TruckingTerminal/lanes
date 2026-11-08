import type { EconomyConfig } from "@lanes/config";
import { clamp } from "./economics.js";
import type { EmissionState, Load } from "./types.js";
import type { World } from "./world.js";

/**
 * The emission cap (token.emission; studio/reviews/economy-emission.md, retuned 2026-11-07): NPC freight pays carriers out of
 * a monthly budget instead of an elastic faucet.
 *
 * Accounting. Every FD an NPC shipper commits to a company for freight draws on the budget at the invoice (receivables.ts
 * bill, and NPC detention in trips.ts), whichever route pays it: net 30, the factor on delivery, the lessor on delivery. So
 * the lessor's pay is in, and the payment terms' timing drops out of the pacing; what remains is the delivery lag. The
 * ledger's cash counter (npcPaidFd, npc_lessor included) is the "paid" column. The count runs with the cap off too, so a
 * baseline reports what it would have capped; only the levers wait for the switch.
 *
 * Schedule (budgetFd). G (refill 0): first × r^month with r = 1 − first ÷ (cap − genesis), summing to the cap less genesis.
 * R (refill > 0): month 0 is `firstMonthFd`; each month after re-emits `refill` of what the sinks returned (the trailing
 * window scaled to a month) plus a published subsidy summing to subsidy.totalFd, so faucets ≈ sinks + the subsidy by
 * construction. What a month leaves unspent carries forward; what it overspends comes out of the months after.
 *
 * Pacing, daily (dailyEmission, after the day's metrics close). The horizon's budget (this month's remainder plus the next
 * month's share of a rolling `horizonDays`) against the spend a unit of lever has been producing (the last `windowDays`
 * days' commitments over the lever in force `lagDays` before each) gives the lever product that lands the horizon on
 * budget; the product moves at most `stepPerDay` a day. There is no month-end cliff: a month boundary only adds the next
 * month's budget to the horizon.
 *
 * The lever (leverSplit). NPC posted volume first (demand.ts planFreight, w.stab.emissionVolMult, down to volRange[0]),
 * then the NPC reference rate (freight.ts, w.stab.emissionMult, floored at multRange[0], about break-even for a leased
 * owner-operator); the product never goes under volRange[0] × multRange[0]. While the cap is on it is the balance control:
 * the balance dial (step.ts monthlyStabilizers, ceiling.ts weeklyCeiling) holds both ways or, with dialOneWay, may lower
 * NPC rates and never raise them (dialMayMoveTo); the published volume dial follows the rules' dial while the cap is slack
 * and holds where it stands while it binds (emissionSlack, volumeDialMayMoveTo; the clause of 2026-11-08, review §16).
 */
export type EmissionConfig = EconomyConfig["token"]["emission"];

export const emissionOn = (w: World): boolean => w.cfg.token.emission.enabled;

/**
 * Where the balance dial (w.stab.rateMult; step.ts monthlyStabilizers, ceiling.ts weeklyCeiling) may go from `from` when
 * it wants `to`: anywhere with the cap off; nowhere with the cap on and dialOneWay off (the cap's ρ is the live control on
 * NPC rates); down but never up with dialOneWay on, so the economy keeps walking toward balance when the cap is not
 * binding while nothing can push NPC rates up against it.
 */
export function dialMayMoveTo(w: World, from: number, to: number, oneWay: boolean = w.cfg.token.emission.dialOneWay): number {
  if (!emissionOn(w)) return to;
  return oneWay ? Math.min(from, to) : from;
}

/**
 * The cap is slack once the lever product has sat at 1 for pacing.lagDays + holdAfterLagDays closed days, and binding
 * from the day the product drops under 1 (the count restarts), so the reading cannot flap day to day. Off, it is neither.
 */
export function emissionSlack(w: World): boolean {
  const k = w.cfg.token.emission;
  return emissionOn(w) && w.emission.daysAtOne >= k.pacing.lagDays + k.pacing.holdAfterLagDays;
}

/**
 * Where the published volume dial (w.stab.volumeMult; step.ts monthlyStabilizers) may go from `from` when the rules want
 * `to` (the clause of 2026-11-08, review §16): anywhere with the cap off; while the cap is slack it follows the rules'
 * dial both ways — or, with volumeDialOneWay, down only — and while the cap binds it holds where it stands and keeps that
 * position across a re-bind. It never cuts on the cap's behalf: a dial that only cut under a budget that re-emits what
 * comes back was §14's ratchet, and a dial held while the cap binds cannot form one.
 */
export function volumeDialMayMoveTo(w: World, from: number, to: number): number {
  if (!emissionOn(w)) return to;
  if (!emissionSlack(w)) return from;
  return w.cfg.token.emission.volumeDialOneWay ? Math.min(from, to) : to;
}

/** G's ratio: 1 − first ÷ (cap − genesis), so the geometric schedule sums to the cap less genesis. */
export function emissionRatio(k: EmissionConfig): number {
  return 1 - k.firstMonthFd / (k.capFd - k.genesisFd);
}

/** R's subsidy ratio: 1 − first ÷ total, so the subsidy sums to its total; 1 when the subsidy is flat (the same every month until the reserve is spent). */
export function subsidyRatio(k: EmissionConfig): number {
  return k.subsidy.flat ? 1 : 1 - k.subsidy.firstMonthFd / k.subsidy.totalFd;
}

/** R's subsidy for month m (m from 0). */
export function subsidyFd(k: EmissionConfig, month: number): number {
  return k.subsidy.firstMonthFd * subsidyRatio(k) ** month;
}

/**
 * Month m's budget (m from 0). R's base is the trailing window's sinks scaled to a month, less (refillNet) the trailing
 * faucets other than NPC freight pay — loans, deposits, payouts: what the freight faucet need not balance — times `refill`.
 */
export function budgetFd(k: EmissionConfig, month: number, trailingSinksPerMonthFd = 0, trailingOtherFaucetsPerMonthFd = 0): number {
  if (!(k.refill > 0)) return k.firstMonthFd * emissionRatio(k) ** month;
  if (month === 0) return k.firstMonthFd;
  const base = Math.max(0, trailingSinksPerMonthFd - (k.refillNet ? trailingOtherFaucetsPerMonthFd : 0));
  return k.refill * base + subsidyFd(k, month);
}

/** G's cumulative budget through month m (inclusive). */
export function cumulativeBudgetFd(k: EmissionConfig, month: number): number {
  const r = emissionRatio(k);
  return (k.firstMonthFd * (1 - r ** (month + 1))) / (1 - r);
}

/** The lever product's floor: volume at its floor and rates at theirs. */
export const leverFloor = (k: EmissionConfig): number => k.volRange[0] * k.multRange[0];

/** Volume carries the cut down to its floor; rates move only after that, floored; the product never goes under the floor. */
export function leverSplit(k: EmissionConfig, product: number): { volMult: number; rateMult: number } {
  const p = clamp(product, leverFloor(k), 1);
  const volMult = clamp(p, k.volRange[0], 1);
  const rateMult = clamp(p / volMult, k.multRange[0], 1);
  return { volMult, rateMult };
}

/** The horizon's budget: this month's remainder (the carry included) plus the next month's share of the horizon's days past this month. */
export function availableFd(carryFd: number, monthBudgetFd: number, committedMonthFd: number, nextBudgetFd: number, daysLeft: number, daysPerMonth: number, horizonDays: number): number {
  const beyond = Math.max(0, Math.min(horizonDays, daysPerMonth) - daysLeft);
  return carryFd + monthBudgetFd - committedMonthFd + (nextBudgetFd * beyond) / daysPerMonth;
}

/** What a unit of lever has been spending a day: the window's commitments over the lever in force `lagDays` before each day (the delivery lag). */
export function spendPerLever(daily: readonly number[], levers: readonly number[], windowDays: number, lagDays: number): number {
  const n = daily.length;
  let spend = 0;
  let lever = 0;
  let count = 0;
  for (let i = Math.max(0, n - windowDays); i < n; i++) {
    spend += daily[i]!;
    const j = i - lagDays;
    lever += j >= 0 ? levers[j]! : (levers[0] ?? 1);
    count++;
  }
  if (count === 0) return 0;
  return lever > 0 ? spend / lever : spend / count;
}

/** The lever product that lands the horizon on budget: nothing spent yet → 1 (nothing to pace); nothing left → 0. */
export function paceTarget(availableFd: number, horizonDays: number, spendPerLeverFd: number): number {
  if (!(spendPerLeverFd > 0)) return 1;
  if (availableFd <= 0) return 0;
  return availableFd / (horizonDays * spendPerLeverFd);
}

/** One day's step of the lever product toward its target: at most `step`, inside [floor, 1]; rounded to a billionth, so steps of five points land on the floors exactly. */
export function stepLever(prev: number, target: number, step: number, floor: number): number {
  return clamp(Math.round((prev + clamp(target - prev, -step, step)) * 1e9) / 1e9, floor, 1);
}

/** Who posted an NPC-paid load: a contract tender, a load tendered to a broker, or the spot board; or the NPC market buying a facility's goods. */
export type NpcPayKind = "spot" | "brokered" | "contract" | "market";
export const npcPayKind = (load: Load): NpcPayKind => (load.contractId ? "contract" : load.brokerId !== null ? "brokered" : "spot");

/** The state a world starts with: month 0's budget, and the levers the cap opens at (pacing.warmStart; 1 with the cap off). */
export function newEmissionState(cfg: EconomyConfig, hubs: number): EmissionState {
  const k = cfg.token.emission;
  const product = k.enabled ? clamp(k.pacing.warmStart, leverFloor(k), 1) : 1;
  const split = k.enabled ? leverSplit(k, product) : { volMult: 1, rateMult: 1 };
  const budget = budgetFd(k, 0);
  return {
    month: 0,
    monthBudgetFd: budget,
    carryFd: 0,
    committedFd: 0,
    committedMonthFd: 0,
    todayFd: 0,
    daily: [],
    levers: [],
    product,
    volMult: split.volMult,
    rateMult: split.rateMult,
    daysAtVolFloor: 0,
    daysAtRateFloor: 0,
    daysAtOne: 0,
    budgetedFd: budget,
    subsidyFd: 0,
    paidAtMonthStartFd: 0,
    months: [],
    lastDay: { committedFd: 0, availableFd: budget, spendPerLeverFd: 0, target: 1 },
    pay: { spot: { loads: 0, fd: 0 }, brokered: { loads: 0, fd: 0 }, contract: { loads: 0, fd: 0 }, market: { loads: 0, fd: 0 } },
    hubExpectedToday: new Float64Array(hubs),
    hubDays: [],
  };
}

/** An NPC shipper's invoice to a company (receivables.ts bill), or its detention (trips.ts): the budget's draw, at the commitment. */
export function noteEmissionCommitment(w: World, fd: number, kind: NpcPayKind): void {
  if (!(fd > 0)) return;
  const s = w.emission;
  s.committedFd += fd;
  s.committedMonthFd += fd;
  s.todayFd += fd;
  s.pay[kind].loads++;
  s.pay[kind].fd += fd;
}

/** The sinks of the trailing window, scaled to a month (R's refill base); 0 before the first closed day. */
export function trailingSinksPerMonthFd(w: World, windowDays: number): number {
  const days = w.metrics.days.slice(-windowDays);
  if (days.length === 0) return 0;
  let s = 0;
  for (const d of days) s += d.sinkFd;
  return (s * w.cfg.time.daysPerMonth) / days.length;
}

/** The faucet tags that are NPC freight pay (the budget's own draw, the NPC market's purchases included); every other faucet is what the freight faucet need not balance. */
export const FREIGHT_FAUCETS = ["npc_shipper", "npc_factor", "npc_lessor", "npc_market"];

/** The trailing window's faucets other than NPC freight pay (loans, deposits, payouts…), scaled to a month; 0 before the first closed day. */
export function trailingOtherFaucetsPerMonthFd(w: World, windowDays: number): number {
  const days = w.metrics.days.slice(-windowDays);
  if (days.length === 0) return 0;
  let s = 0;
  for (const d of days) {
    let freight = 0;
    for (const tag of FREIGHT_FAUCETS) freight += d.faucetByTag?.[tag] ?? 0;
    s += Math.max(0, d.faucetFd - freight);
  }
  return (s * w.cfg.time.daysPerMonth) / days.length;
}

/**
 * Day end, after the day's metrics close: the day's commitments close against the lever that priced them, the month
 * rolls when the day was its last, and the levers for the day to come are set (only with the cap on).
 */
export function dailyEmission(w: World, day: number): void {
  const k = w.cfg.token.emission;
  const s = w.emission;
  const D = w.cfg.time.daysPerMonth;
  s.daily.push(s.todayFd);
  s.levers.push(s.product);
  const keep = k.pacing.windowDays + k.pacing.lagDays + 1;
  while (s.daily.length > keep) {
    s.daily.shift();
    s.levers.shift();
  }
  recordHubs(w, s);
  s.lastDay.committedFd = s.todayFd;
  s.todayFd = 0;
  const next = day + 1;
  const month = Math.floor(next / D);
  const trailing = trailingSinksPerMonthFd(w, k.refillWindowDays);
  const other = trailingOtherFaucetsPerMonthFd(w, k.refillWindowDays);
  while (s.month < month) rollMonth(w, s, trailing, other);
  if (!k.enabled) return;
  const daysLeft = D - (next % D);
  const horizon = Math.min(k.pacing.horizonDays, D);
  const available = availableFd(s.carryFd, s.monthBudgetFd, s.committedMonthFd, budgetFd(k, s.month + 1, trailing, other), daysLeft, D, horizon);
  const perLever = spendPerLever(s.daily, s.levers, k.pacing.windowDays, k.pacing.lagDays);
  let target = paceTarget(available, horizon, perLever);
  // The warm start holds until the window holds the delivery lag plus a few closed days: before that nothing priced by the
  // opening has been delivered, so the spend per lever reads near zero and would walk the cut back up before the bills
  // land. The product may still fall.
  if (s.daily.length < k.pacing.lagDays + k.pacing.holdAfterLagDays) target = Math.min(target, k.pacing.warmStart);
  s.product = stepLever(s.product, target, k.pacing.stepPerDay, leverFloor(k));
  // Slack and binding (emissionSlack): closed days in a row with the product at 1; any day under it restarts the count.
  s.daysAtOne = s.product >= 1 - 1e-9 ? s.daysAtOne + 1 : 0;
  const split = leverSplit(k, s.product);
  s.volMult = w.stab.emissionVolMult = split.volMult;
  s.rateMult = w.stab.emissionMult = split.rateMult;
  if (split.volMult <= k.volRange[0] + 1e-9) s.daysAtVolFloor++;
  if (split.rateMult <= k.multRange[0] + 1e-9) s.daysAtRateFloor++;
  s.lastDay.availableFd = available;
  s.lastDay.spendPerLeverFd = perLever;
  s.lastDay.target = target;
}

/** The month closes: its budget, what was committed and paid against it, the carry; the next month's budget opens. */
function rollMonth(w: World, s: EmissionState, trailingSinksPerMonth: number, trailingOtherFaucetsPerMonth: number): void {
  const k = w.cfg.token.emission;
  const paid = w.ledger.npcPaidFd();
  s.carryFd += s.monthBudgetFd - s.committedMonthFd;
  s.months.push({ month: s.month, budgetFd: s.monthBudgetFd, committedFd: s.committedMonthFd, paidFd: paid - s.paidAtMonthStartFd, subsidyFd: k.refill > 0 && s.month > 0 ? subsidyFd(k, s.month) : 0, carryFd: s.carryFd });
  s.month++;
  s.monthBudgetFd = budgetFd(k, s.month, trailingSinksPerMonth, trailingOtherFaucetsPerMonth);
  s.budgetedFd += s.monthBudgetFd;
  if (k.refill > 0) s.subsidyFd += subsidyFd(k, s.month);
  s.committedMonthFd = 0;
  s.paidAtMonthStartFd = paid;
}

/** The newcomer check: per hub, the NPC loads planFreight asked for today, and at day end the open NPC loads and idle trucks there. */
function recordHubs(w: World, s: EmissionState): void {
  const n = w.net.hubs.length;
  const open = new Array<number>(n).fill(0);
  const idle = new Array<number>(n).fill(0);
  let openSpot = 0;
  let openContract = 0;
  for (const load of w.loads.values()) {
    if (load.status !== "open" || load.shipperId !== null) continue;
    open[load.origin]!++;
    if (load.contractId) openContract++;
    else openSpot++;
  }
  for (const t of w.trucks) if (t.status === "idle" && t.companyId !== 0) idle[t.hub]!++;
  s.hubDays.push({ expected: Array.from(s.hubExpectedToday), open, idle, openSpot, openContract });
  s.hubExpectedToday.fill(0);
}
