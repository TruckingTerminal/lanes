import type { EconomyConfig } from "@lanes/config";
import { cashNowRate, companyAccount, crewed, hubMiles, MANUAL_BID_MAX_DEADHEAD_MI, resting, truckValue, type Company, type Staff, type StandingOrder, type Truck, type World } from "@lanes/engine";
import { boardRows, clearsNear, profitOver, type BoardRow } from "./board.js";
import { bestLoad, cushion, debtCountdown, freeTrucks, gapToTruck, nextEvent, nextWeeklyCheckDay, orderedFirstTruck, owed, type NextEvent } from "./figures.js";
import { truckDayCostFd } from "./logic.js";
import { exitsFor, type Exit } from "./exits.js";
import { invoices } from "./ledger.js";
import { walkProgress } from "./walkthrough.js";
import type { Tab } from "./tabs.js";

/**
 * What now? (specs/guidance.md, section 1): an ordered list of rules over the world and the company, first match wins,
 * always one action. It returns what to do and the figures behind it, never words: the client turns it into the writer's
 * strings (guidance-strings.md), and the economy can run it as a bot. It reads and saves nothing, so it's right after
 * every reload. It never recommends an FD trade, a stake as an investment, or anything from the Back Lot.
 */
/**
 * Client batch 8a item 59 (the director's ruling F, with items 21, 45 and 55): `rule` is her tier, across all trucks;
 * the highest tier wins and, within a tier, the nearest deadline (tier 2 by the cost a day, the dearest first):
 * 1 losing an asset or going under (the debt countdown, a purchase loan a payment from default); 2 money bleeding now
 * (an idle or stranded truck, a truck with no driver); 3 a load at risk (a breakdown's release ask); 4 due home (the
 * home rule with the dispatcher off); 5 a load to book (a tender); 6 a walkthrough step; 7 follow-ups (a lost bid's
 * better load, the factoring contract's end, a thin cushion, a truck ordered, the gap to the next truck); 8 calm.
 */
export type NextAction =
  | { rule: 0; kind: "liquidating"; restartDay: number }
  | { rule: 1; kind: "danger"; debt: ReturnType<typeof debtCountdown>; lever: Lever | null }
  /** A purchase loan with payments missed: the lender takes `truckId` (0 for a truck still on order) on `day` if the next one misses. */
  | { rule: 1; kind: "loanDefault"; loanId: number; truckId: number; day: number; missed: number; of: number; paymentFd: number }
  /**
   * A truck with no driver. `parked`: it stands parked (QA's 0.24.1 replay, fail 3: a listed truck taken off sale);
   * `freeId`: a driver of the company with no truck, standing by it, who can go back in.
   */
  | { rule: 2; kind: "driver"; truckId: number; costPerDayFd: number; parked?: boolean; freeId?: number | null }
  /** A paid driver sitting in a parked truck: no pay comes in, and a driver parked labor.morale.unseatedWeeks quits. */
  | { rule: 2; kind: "parkedCrew"; truckId: number; staffId: number; costPerDayFd: number }
  /** `suggest`: the board's suggested bid on it (board.ts suggestBid), null when booking is the call (client batch 4). */
  | { rule: 2; kind: "idle"; truckId: number; loadId: number; profitFd: number; suggest: number | null }
  | { rule: 2; kind: "stranded"; truckId: number; exits: Exit[] }
  /** A breakdown's ask on a load booked ahead (windows.ts afterBreakdown): release it or keep it, by the pickup. */
  | { rule: 3; kind: "atRisk"; loadId: number; truckId: number; claimFd: number; byMin: number }
  /** The home rule (the company's homeTime order) with the dispatcher off: from five days ahead, and on the day. `loadId`: a load toward home. */
  | { rule: 2 | 4; kind: "homeDue"; truckId: number; day: number; days: number; loadId: number | null; profitFd: number }
  | { rule: 5; kind: "tender"; loadId: number; untilMin: number; shipperId: number | null }
  | { rule: 6; kind: "step"; index: number; total: number }
  /**
   * A lost hand bid's follow-up: a better load beside it for the same truck, which stands in for that truck's own answer
   * in tier 2 (the truck is free, so it bleeds), and expires at the next round's clear. `suggest`: as for idle.
   */
  | { rule: 2; kind: "lost"; loadId: number; truckId: number; profitFd: number; clearsNear: number; suggest: number | null; bookNow: number; profitBookFd: number }
  | { rule: 7; kind: "factoringEnds"; untilDay: number; days: number }
  | { rule: 7; kind: "cushion"; weeks: number }
  | { rule: 7; kind: "gap"; gapFd: number }
  /** Client batch 6b (the director): a truck ordered to replace the lease is at the dealer; `days` to its due day. */
  | { rule: 7; kind: "ordered"; days: number }
  | { rule: 8; kind: "calm"; event: NextEvent }
  | { rule: -1; kind: "none" };

/** How far ahead the home rule's warning starts (the director's C: "from 5 days ahead"). */
export const HOME_WARN_DAYS = 5;

/**
 * Rule 1's levers, each a real, possible action: book an idle truck's paying load; collect what's owed, when invoices
 * due before the deciding check cover the shortfall; return a second lease; sell an owned truck, the last lever.
 */
export type Lever =
  | { kind: "book"; truckId: number; loadId: number; profitFd: number }
  | { kind: "cash"; invoiceIds: number[]; landsFd: number; feeFd: number; byDay: number; contract: boolean }
  | { kind: "collect"; owedFd: number; byDay: number; quickPayOpen: boolean }
  | { kind: "hold"; day: number }
  | { kind: "lease"; truckId: number }
  | { kind: "sell"; truckId: number; valueFd: number };

/** A hand bid that lost, for the follow-up's "a better load beside it" (the client knows it from the round's result). */
export interface LostBid {
  loadId: number;
  truckId: number;
  /** What the lost load would have left at the rate that actually won. */
  profitAtWinningFd: number;
  /** The board round it lost at (item 59: the follow-up expires at the next round's clear); absent, it stands. */
  round?: number;
}

/** `pageOpen`: the client's tabOpen, so a walkthrough step waits while its page is shut (walkthrough.ts walkProgress). */
export function nextAction(cfg: EconomyConfig, w: World, c: Company, lost?: LostBid | null, skipped: readonly string[] = [], pageOpen?: (tab: Tab) => boolean): NextAction {
  const perDay = w.cfg.time.gameMinutesPerDay;
  const today = Math.floor(w.t / perDay);
  // Being wound up: what's happening and when the restart comes (W3). Silence unasked; asked, this.
  if (c.liquidatingSince !== null) return { rule: 0, kind: "liquidating", restartDay: c.liquidatingSince + w.cfg.insolvency.restartAfterDays };

  const cands: Cand[] = [];
  // 1. Danger: in debt at a weekly check, or the next check would make it so. The best single lever that's possible now.
  const debt = debtCountdown(w, c);
  if (debt.n > 0 || debt.under) {
    let lever: Lever | null = null;
    for (const t of freeTrucks(w, c)) {
      const r = bestLoad(w, c, t);
      if (r && (!lever || (lever.kind === "book" && r.profitBook > lever.profitFd))) lever = { kind: "book", truckId: t.id, loadId: r.l.id, profitFd: r.profitBook };
    }
    const fleet = w.trucksByCompany.get(c.id) ?? [];
    // Invoices already dated: what lands before the check that would wind the company up (QA's guidance replay: it
    // advised selling a 153k truck over a 14k dip with 25k due within two weeks). Quick pay and factoring don't advance
    // invoices already open, so the lever is to wait for them, keeping the trucks loaded; quick pay speeds the next ones.
    // With cash now on (the director's rule 1), collect offers cashing first: under a factoring contract the freshest
    // invoices that clear the line (the aging surcharge makes them the cheapest), at the spot rate the fewest.
    if (!lever && w.cfg.token.payment.enabled && w.cfg.token.payment.cashNow.enabled) {
      const line = -w.cfg.insolvency.debtLimitFd;
      let cash = w.ledger.balance(companyAccount(c.id));
      const open = invoices(w, c)
        .map((i) => ({ i, rate: cashNowRate(w, c, w.receivables.find((r) => r.id === i.id)!) }))
        .filter((x): x is { i: (typeof x)["i"]; rate: number } => typeof x.rate === "number");
      open.sort((a, b) => (c.factoring ? b.i.dueDay - a.i.dueDay : b.i.amountFd - a.i.amountFd) || a.i.id - b.i.id);
      const picked: typeof open = [];
      for (const x of open) {
        if (cash >= line) break;
        picked.push(x);
        cash += x.i.amountFd * (1 - x.rate);
      }
      if (picked.length && cash >= line) {
        const fee = picked.reduce((s, x) => s + x.i.amountFd * x.rate, 0);
        const face = picked.reduce((s, x) => s + x.i.amountFd, 0);
        lever = { kind: "cash", invoiceIds: picked.map((x) => x.i.id), landsFd: face - fee, feeFd: fee, byDay: Math.max(...picked.map((x) => x.i.dueDay)), contract: !!c.factoring };
      }
    }
    if (!lever) {
      const deciding = debt.nextDay + 7 * Math.max(0, debt.of - debt.n - 1);
      const line = -w.cfg.insolvency.debtLimitFd;
      let cash = w.ledger.balance(companyAccount(c.id));
      let owedFd = 0;
      for (const i of invoices(w, c)) {
        if (cash >= line || i.dueDay > deciding) break;
        cash += i.amountFd;
        owedFd += i.amountFd;
        if (cash >= line) lever = { kind: "collect", owedFd, byDay: i.dueDay, quickPayOpen: owed(w, c).quickPayOpen };
      }
    }
    // Back above the line with checks still counted: the count resets at the next check if cash holds (solvency.ts), so
    // nothing needs selling; hold it there (QA: it advised selling a truck at +10,684 FD, "0 FD under the line").
    if (!lever && !debt.under) lever = { kind: "hold", day: debt.nextDay };
    if (!lever) {
      const lease = fleet.find((t) => t.lease === "lessor" && t.status === "idle");
      if (lease) lever = { kind: "lease", truckId: lease.id };
    }
    if (!lever) {
      const owned = fleet.filter((t) => t.lease === "owned" && t.status !== "listed" && t.status !== "retired" && t.lessorId === 0).sort((a, b) => truckValue(w, b) - truckValue(w, a))[0];
      if (owned) lever = { kind: "sell", truckId: owned.id, valueFd: truckValue(w, owned) };
    }
    cands.push({ a: { rule: 1, kind: "danger", debt, lever }, key: (debt.nextDay + 7 * Math.max(0, debt.of - debt.n - 1)) * perDay });
  }

  // 1b. A purchase loan with payments missed: the nearest clock is named (the director's F: "1 payment missed: the lender
  // takes Truck 2 on Jul 28 if the next one misses"), against the debt countdown by date.
  const k = w.cfg.equipmentFinance.purchase;
  const payDay = nextWeeklyCheckDay(w);
  for (const loan of w.purchaseLoans) {
    if (loan.borrowerId !== c.id || loan.status !== "active" || loan.missed <= 0) continue;
    const of = k.missedToDefault;
    const paymentFd = loan.originalFd / Math.max(1, loan.termWeeks) + loan.principalFd * loan.weeklyRate;
    const day = payDay + 7 * Math.max(0, of - loan.missed - 1);
    cands.push({ a: { rule: 1, kind: "loanDefault", loanId: loan.id, truckId: loan.truckId, day, missed: loan.missed, of, paymentFd }, key: day * perDay });
  }

  // 2. Money bleeding now, across all trucks, the dearest a day first: an idle truck with a paying load, a stranded one,
  // a truck with no driver (before the first load Staff opens for it, tutorial.ts tabLocked).
  // The home rule's warning (4 below), computed here: an idle truck due home gets it at its idle answer's rank (QA's 0.24.1
  // replay, item 5: tier 2 always outranked it, so an idle truck's warning never showed).
  const homeRule = c.orders.find((o): o is Extract<StandingOrder, { kind: "homeTime" }> => o.kind === "homeTime");
  const homeWarns = !!homeRule && !c.orders.some((o) => o.kind === "bid");
  const homeDueOf = (t: Truck): Extract<NextAction, { kind: "homeDue" }> | null => {
    if (!homeWarns || !t.driverId || t.status === "listed" || t.status === "parked" || t.status === "retired" || resting(w, t)) return null;
    const d = w.staff[t.driverId - 1]!;
    const days = homeRule!.afterDays - d.awayDays;
    if (days > HOME_WARN_DAYS || days < 0 || t.hub === c.homeHub) return null;
    const toward = t.status === "idle" && crewed(t) ? homewardLoad(w, c, t) : null;
    return { rule: 4, kind: "homeDue", truckId: t.id, day: today + days, days, loadId: toward?.l.id ?? null, profitFd: toward?.profitBook ?? 0 };
  };
  const dueAtIdle = new Set<number>();
  for (const t of freeTrucks(w, c)) {
    const cost = truckDayCostFd(w, c, t);
    const hd = homeDueOf(t);
    if (hd) {
      dueAtIdle.add(t.id);
      cands.push({ a: { ...hd, rule: 2 }, key: -cost - hd.profitFd / 1e6 });
      continue;
    }
    const r = bestLoad(w, c, t);
    if (r) cands.push({ a: { rule: 2, kind: "idle", truckId: t.id, loadId: r.l.id, profitFd: r.profitBook, suggest: r.suggest }, key: -cost - r.profitBook / 1e6 });
    // Stranded (the director, 2026-11-09): nothing in reach it may take that pays; its ways out, cheapest first.
    else cands.push({ a: { rule: 2, kind: "stranded", truckId: t.id, exits: exitsFor(w, c, t).slice(0, 2) }, key: -cost });
  }
  for (const t of w.trucksByCompany.get(c.id) ?? []) {
    if (t.status === "listed" || t.status === "retired") continue;
    const cost = truckDayCostFd(w, c, t);
    if (!crewed(t)) {
      // QA's 0.24.1 replay, fail 3: a parked truck with no driver bleeds too; a free driver standing by it is named.
      const parked = t.status === "parked";
      cands.push({ a: { rule: 2, kind: "driver", truckId: t.id, costPerDayFd: cost, parked, freeId: parked ? (freeDriverFor(w, c, t)?.id ?? null) : null }, key: -cost });
    } else if (t.status === "parked" && !w.staff[t.driverId - 1]!.owner) {
      cands.push({ a: { rule: 2, kind: "parkedCrew", truckId: t.id, staffId: t.driverId, costPerDayFd: cost }, key: -cost });
    }
  }

  // 3. A load at risk: a breakdown's ask on a load booked ahead, by its pickup.
  for (const l of w.loads.values()) {
    if (l.carrierId !== c.id || !l.releaseAsk) continue;
    const by = l.latestPickupT ?? l.releaseAsk.t;
    cands.push({ a: { rule: 3, kind: "atRisk", loadId: l.id, truckId: l.releaseAsk.truckId, claimFd: l.releaseAsk.fd, byMin: by }, key: by });
  }

  // 4. Due home (the director's C): the home rule turns a truck for home at its driver's days out; with the dispatcher off
  // nothing plans the homeward loads, so What now? warns from HOME_WARN_DAYS ahead with a load toward home, and on the day.
  for (const t of w.trucksByCompany.get(c.id) ?? []) {
    if (dueAtIdle.has(t.id)) continue; // said at tier 2
    const hd = homeDueOf(t);
    if (hd) cands.push({ a: hd, key: hd.day * perDay });
  }

  // 5. A load to book: a tender lapsing, the nearest first.
  for (const l of w.loads.values()) if (l.status === "open" && l.tenderedTo === c.id) cands.push({ a: { rule: 5, kind: "tender", loadId: l.id, untilMin: l.tenderUntil, shipperId: l.brokerId ?? l.shipperId }, key: l.tenderUntil });

  // 6. A walkthrough step is current. Client batch 7 (QA): while a truck ordered to replace the lease waits, the
  // walkthrough waits too (the next step is the second truck), so the order's wait isn't hidden behind a step.
  const p = walkProgress(cfg, w, c, skipped, pageOpen);
  if (p.index >= 0 && !p.skipped && !orderedFirstTruck(w, c)) cands.push({ a: { rule: 6, kind: "step", index: p.index, total: p.total }, key: 0 });

  // 7. Follow-ups. A lost hand bid's better load: the director's definition (an open load the same truck may take now,
  // within the bid's reach, whose profit at its "usually clears near" rate is positive and at least what the lost load
  // would have left at the winning rate); it names its truck and expires at the next round's clear or with the load.
  if (lost && (lost.round === undefined || w.round <= lost.round)) {
    const truck = w.trucks[lost.truckId - 1];
    if (truck && freeTrucks(w, c).includes(truck)) {
      let best: { loadId: number; profit: number; rate: number; due: number; suggest: number | null; bookNow: number; profitBook: number } | null = null;
      for (const r of bestRows(w, c, truck)) {
        const rate = clearsNear(w, r.l);
        const profit = profitOver(w, truck, rate, r.be, r.l.miles);
        if (profit <= 0 || profit < lost.profitAtWinningFd || r.l.id === lost.loadId) continue;
        if (!best || profit > best.profit || (profit === best.profit && r.l.appointmentT < best.due)) best = { loadId: r.l.id, profit, rate, due: r.l.appointmentT, suggest: r.suggest, bookNow: r.l.bookNow, profitBook: r.profitBook };
      }
      // Client batch 6 (QA): the reason quotes the rate the action names, Book now's when it says Book. It takes the place
      // of the truck's own tier-2 answer, at that answer's rank.
      if (best) {
        const i = cands.findIndex((x) => (x.a.kind === "idle" || x.a.kind === "stranded") && x.a.truckId === truck.id);
        const key = i >= 0 ? cands[i]!.key : -truckDayCostFd(w, c, truck);
        if (i >= 0) cands.splice(i, 1);
        cands.push({ a: { rule: 2, kind: "lost", loadId: best.loadId, truckId: truck.id, profitFd: best.profit, clearsNear: best.rate, suggest: best.suggest, bookNow: best.bookNow, profitBookFd: best.profitBook }, key });
      }
    }
  }
  if (c.factoring && !c.factoring.renew && c.factoring.until - today <= 7) cands.push({ a: { rule: 7, kind: "factoringEnds", untilDay: c.factoring.until, days: Math.max(0, c.factoring.until - today) }, key: c.factoring.until * perDay });
  const cu = cushion(w, c);
  if (cu.weeks !== null && cu.weeks < w.cfg.guide.gapCushionWeeks) cands.push({ a: { rule: 7, kind: "cushion", weeks: cu.weeks }, key: w.t + cu.weeks * 7 * perDay });
  // Ordered: the wait, counted (the gap would price a truck already bought).
  const ordered = orderedFirstTruck(w, c);
  if (ordered) cands.push({ a: { rule: 7, kind: "ordered", days: ordered.days }, key: ordered.dueDay * perDay });
  else {
    const gap = gapToTruck(w, c);
    if (gap.gapFd > 0 && Number.isFinite(gap.gapFd)) cands.push({ a: { rule: 7, kind: "gap", gapFd: gap.gapFd }, key: Infinity });
  }

  // The highest tier, then the nearest deadline (the key); ties keep the order found.
  const top = cands.reduce<Cand | null>((b, x) => (!b || x.a.rule < b.a.rule || (x.a.rule === b.a.rule && x.key < b.key) ? x : b), null);
  if (top) return top.a;
  // 8. Nothing needs the player: the next thing that will, honestly.
  return { rule: 8, kind: "calm", event: nextEvent(w, c) };
}

type Cand = { a: NextAction; key: number };

/** The best paying load whose destination is nearer home than where the truck stands (the home rule's warning). */
/** A driver of the company with no truck, not leaving: free to take a truck. */
export const isFreeDriver = (c: Company, s: Staff): boolean => s.companyId === c.id && s.kind === "driver" && s.status === "employed" && s.truckId === 0 && !s.offer;

/**
 * QA's 0.24.1 replay, fail 3 (the producer, 2026-11-12): who goes back in a parked truck. Its own driver, if still free
 * (`own`: the crew it had when listed, the page's record; `name`: the driver the page last saw in it); only when they
 * are gone or seated elsewhere, another free driver standing by it (engine assign_driver: off a truck a driver stands
 * where they left it).
 */
export function freeDriverFor(w: World, c: Company, t: Truck, own: readonly number[] = [], name?: string): Staff | null {
  for (const id of own) {
    const s = w.staff[id - 1];
    if (s && isFreeDriver(c, s)) return s;
  }
  const free = w.staff.filter((s) => isFreeDriver(c, s) && (s.lastHub === undefined || s.lastHub === t.hub));
  return free.find((s) => s.name === name) ?? free[0] ?? null;
}

function homewardLoad(w: World, c: Company, t: Truck): BoardRow | null {
  const here = hubMiles(w, t.hub, c.homeHub);
  let best: BoardRow | null = null;
  for (const r of boardRows(w, c, t, { dest: "any", maxDh: 300, query: "" })) {
    if (r.block || r.profitBook <= 0 || hubMiles(w, r.l.dest, c.homeHub) >= here) continue;
    if (!best || r.profitBook > best.profitBook) best = r;
  }
  return best;
}

/** Every load the truck may take now, within the hand-bid reach (rule 2's comparison). */
function bestRows(w: World, c: Company, truck: Truck) {
  return boardRows(w, c, truck, { dest: "any", maxDh: Math.min(300, MANUAL_BID_MAX_DEADHEAD_MI), query: "" }).filter((r) => !r.block);
}
