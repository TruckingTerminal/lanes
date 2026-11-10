import type { EconomyConfig } from "@lanes/config";
import { cashNowRate, companyAccount, crewed, MANUAL_BID_MAX_DEADHEAD_MI, truckValue, type Company, type Truck, type World } from "@lanes/engine";
import { boardRows, clearsNear } from "./board.js";
import { bestLoad, cushion, debtCountdown, freeTrucks, gapToTruck, nextEvent, orderedFirstTruck, owed, type NextEvent } from "./figures.js";
import { exitsFor, type Exit } from "./exits.js";
import { invoices } from "./ledger.js";
import { walkProgress } from "./walkthrough.js";
import { firstLoadLocked } from "./tutorial.js";

/**
 * What now? (specs/guidance.md, section 1): an ordered list of rules over the world and the company, first match wins,
 * always one action. It returns what to do and the figures behind it, never words: the client turns it into the writer's
 * strings (guidance-strings.md), and the economy can run it as a bot. It reads and saves nothing, so it's right after
 * every reload. It never recommends an FD trade, a stake as an investment, or anything from the Back Lot.
 */
export type NextAction =
  | { rule: 0; kind: "liquidating"; restartDay: number }
  | { rule: 1; kind: "danger"; debt: ReturnType<typeof debtCountdown>; lever: Lever | null }
  | { rule: 2; kind: "tender"; loadId: number; untilMin: number; shipperId: number | null }
  | { rule: 2; kind: "driver"; truckId: number }
  /** `suggest`: the board's suggested bid on it (board.ts suggestBid), null when booking is the call (client batch 5). */
  | { rule: 2; kind: "lost"; loadId: number; truckId: number; profitFd: number; clearsNear: number; suggest: number | null; bookNow: number; profitBookFd: number }
  /** `suggest`: the board's suggested bid on it (board.ts suggestBid), null when booking is the call (client batch 4). */
  | { rule: 3; kind: "idle"; truckId: number; loadId: number; profitFd: number; suggest: number | null }
  | { rule: 3; kind: "stranded"; truckId: number; exits: Exit[] }
  | { rule: 4; kind: "step"; index: number; total: number }
  | { rule: 5; kind: "factoringEnds"; untilDay: number; days: number }
  | { rule: 5; kind: "cushion"; weeks: number }
  | { rule: 5; kind: "gap"; gapFd: number }
  /** Client batch 6b (the director): a truck ordered to replace the lease is at the dealer; `days` to its due day. */
  | { rule: 5; kind: "ordered"; days: number }
  | { rule: 6; kind: "calm"; event: NextEvent }
  | { rule: -1; kind: "none" };

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

/** A hand bid that lost, for rule 2's "a better load beside it" (the client knows it from the round's result). */
export interface LostBid {
  loadId: number;
  truckId: number;
  /** What the lost load would have left at the rate that actually won. */
  profitAtWinningFd: number;
}

export function nextAction(cfg: EconomyConfig, w: World, c: Company, lost?: LostBid | null, skipped: readonly string[] = []): NextAction {
  const perDay = w.cfg.time.gameMinutesPerDay;
  const today = Math.floor(w.t / perDay);
  // Being wound up: what's happening and when the restart comes (W3). Silence unasked; asked, this.
  if (c.liquidatingSince !== null) return { rule: 0, kind: "liquidating", restartDay: c.liquidatingSince + w.cfg.insolvency.restartAfterDays };

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
    return { rule: 1, kind: "danger", debt, lever };
  }

  // 2. Something waiting on the player, by deadline: a tender lapsing, a truck without a driver, a lost bid with a better load beside it.
  const tenders = [...w.loads.values()].filter((l) => l.status === "open" && l.tenderedTo === c.id).sort((a, b) => a.tenderUntil - b.tenderUntil);
  if (tenders[0]) return { rule: 2, kind: "tender", loadId: tenders[0].id, untilMin: tenders[0].tenderUntil, shipperId: tenders[0].brokerId ?? tenders[0].shipperId };
  // Before the first load Staff is locked (tutorial.ts): the empty seat waits, and the first load is the step (QA item 8).
  const driverless = firstLoadLocked(w, c) ? undefined : (w.trucksByCompany.get(c.id) ?? []).find((t) => !crewed(t) && t.status !== "listed" && t.status !== "parked" && t.status !== "retired");
  if (driverless) return { rule: 2, kind: "driver", truckId: driverless.id };
  if (lost) {
    // The director's definition: an open load the same truck may take now, within the reach the bid used, whose profit at
    // its "usually clears near" rate is positive and at least what the lost load would have left at the winning rate.
    const truck = w.trucks[lost.truckId - 1];
    if (truck && freeTrucks(w, c).includes(truck)) {
      let best: { loadId: number; profit: number; rate: number; due: number; suggest: number | null; bookNow: number; profitBook: number } | null = null;
      for (const r of bestRows(w, c, truck)) {
        const rate = clearsNear(w, r.l);
        const profit = (rate - r.be) * r.l.miles;
        if (profit <= 0 || profit < lost.profitAtWinningFd || r.l.id === lost.loadId) continue;
        if (!best || profit > best.profit || (profit === best.profit && r.l.appointmentT < best.due)) best = { loadId: r.l.id, profit, rate, due: r.l.appointmentT, suggest: r.suggest, bookNow: r.l.bookNow, profitBook: r.profitBook };
      }
      // Client batch 6 (QA): the reason quotes the rate the action names, Book now's when it says Book (the sheet's "Profit at book-now").
      if (best) return { rule: 2, kind: "lost", loadId: best.loadId, truckId: truck.id, profitFd: best.profit, clearsNear: best.rate, suggest: best.suggest, bookNow: best.bookNow, profitBookFd: best.profitBook };
    }
  }

  // 3. A truck idle with loads in reach that pay: the best by the profit chip.
  let idle: { truckId: number; loadId: number; profitFd: number; suggest: number | null } | null = null;
  for (const t of freeTrucks(w, c)) {
    const r = bestLoad(w, c, t);
    if (r && (!idle || r.profitBook > idle.profitFd)) idle = { truckId: t.id, loadId: r.l.id, profitFd: r.profitBook, suggest: r.suggest };
  }
  if (idle) return { rule: 3, kind: "idle", ...idle };
  // 3b. Stranded (the director, 2026-11-09): an idle truck with nothing in reach it may take that pays. Its ways out,
  // cheapest first, never "pick the next load" with nothing to pick (the cautious diary at Palm Coast).
  const stranded = freeTrucks(w, c)[0];
  if (stranded) return { rule: 3, kind: "stranded", truckId: stranded.id, exits: exitsFor(w, c, stranded).slice(0, 2) };

  // 4. A walkthrough step is current.
  const p = walkProgress(cfg, w, c, skipped);
  // Client batch 7 (QA): while a truck ordered to replace the lease waits, the walkthrough waits too (the next step is the
  // second truck), so the order's wait (rule 5) isn't hidden behind a step.
  if (p.index >= 0 && !p.skipped && !orderedFirstTruck(w, c)) return { rule: 4, kind: "step", index: p.index, total: p.total };

  // 5. A milestone near: the factoring contract's last week, a thin cushion, the gap to the next truck.
  if (c.factoring && !c.factoring.renew && c.factoring.until - today <= 7) return { rule: 5, kind: "factoringEnds", untilDay: c.factoring.until, days: Math.max(0, c.factoring.until - today) };
  const cu = cushion(w, c);
  if (cu.weeks !== null && cu.weeks < w.cfg.guide.gapCushionWeeks) return { rule: 5, kind: "cushion", weeks: cu.weeks };
  // Ordered: the wait, counted (the gap would price a truck already bought).
  const ordered = orderedFirstTruck(w, c);
  if (ordered) return { rule: 5, kind: "ordered", days: ordered.days };
  const gap = gapToTruck(w, c);
  if (gap.gapFd > 0) return { rule: 5, kind: "gap", gapFd: gap.gapFd };

  // 6. Nothing needs the player: the next thing that will, honestly.
  return { rule: 6, kind: "calm", event: nextEvent(w, c) };
}

/** Every load the truck may take now, within the hand-bid reach (rule 2's comparison). */
function bestRows(w: World, c: Company, truck: Truck) {
  return boardRows(w, c, truck, { dest: "any", maxDh: Math.min(300, MANUAL_BID_MAX_DEADHEAD_MI), query: "" }).filter((r) => !r.block);
}
