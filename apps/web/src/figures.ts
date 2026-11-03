import { companyAccount, crewed, layerOpen, lotPrice, npcDealerMult, resting, type Company, type Truck, type World } from "@lanes/engine";
import { boardRows, type BoardRow } from "./board.js";
import { buyPlan, cheapestNewRig } from "./finance.js";
import { invoices } from "./ledger.js";

/**
 * The figures Iuliia computes (specs/guidance.md, section 4): read from the world and the company, saving nothing, with
 * no browser state, so What now? is right after every reload and the economy can run it as a bot. Each is also an
 * explain key (the writer's guidance-strings.md), and its parts are the breakdown that key's "how" describes.
 */

const day = (w: World): number => Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
const cash = (w: World, c: Company): number => w.ledger.balance(companyAccount(c.id));

/** The day whose close runs the weekly checks (solvency, overhead, the used lot): step.ts closes a week when (day + 1) % 7 is 0. */
export function nextWeeklyCheckDay(w: World): number {
  let d = day(w);
  while ((d + 1) % 7 !== 0) d++;
  return d;
}

/** guide.cushion: weeks of the company's own spending its cash covers, from its average over guide.cushionAvgWeeks. */
export function cushion(w: World, c: Company): { weeks: number | null; avgWeeklyFd: number; cashFd: number } {
  const n = w.cfg.guide.cushionAvgWeeks;
  const recent = c.weeklySpend.slice(-n);
  const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const fd = cash(w, c);
  return { weeks: avg > 0.5 ? Math.max(0, fd) / avg : null, avgWeeklyFd: avg, cashFd: fd };
}

/** guide.debtCountdown: weekly checks in a row under the line, the next check's day, and how far under the line cash is now. */
export function debtCountdown(w: World, c: Company): { n: number; of: number; nextDay: number; under: boolean; shortFd: number } {
  const k = w.cfg.insolvency;
  const fd = cash(w, c);
  return { n: c.weeksInDebt, of: k.weeksInDebt, nextDay: nextWeeklyCheckDay(w), under: fd < -k.debtLimitFd, shortFd: Math.max(0, -k.debtLimitFd - fd) };
}

/**
 * guide.gapToTruck: the cheapest open route to the next truck (the used lot, a listing, or new at the cheapest source),
 * as the cash it needs now on a purchase loan (the Dealer's own figure: down payment, stake and tax, less the lease
 * deposit when it replaces the lessor's truck), less the cash above guide.gapCushionWeeks weeks of the company's spending.
 */
export function gapToTruck(w: World, c: Company): { gapFd: number; route: "lot" | "listing" | "new"; needNowFd: number; grossNeedFd: number; depositFd: number; spareFd: number; holdFd: number } {
  const replacing = (w.trucksByCompany.get(c.id) ?? []).some((t) => t.lease === "npc");
  const routes: { route: "lot" | "listing" | "new"; price: number }[] = [];
  if (w.cfg.usedMarket.npcLot.enabled && w.cfg.assets.enabled && w.usedLot.stock > 0) routes.push({ route: "lot", price: lotPrice(w, "workhorse", "van") * npcDealerMult(w) });
  for (const l of w.listings) if (l.status === "open" && l.truckId > 0 && l.sellerId !== c.id && l.formerOwnerId !== c.id) routes.push({ route: "listing", price: l.askFd });
  const rig = cheapestNewRig(w, c);
  if (rig) routes.push({ route: "new", price: rig.price });
  let best = { route: "new" as "lot" | "listing" | "new", need: Infinity, gross: Infinity, deposit: 0 };
  for (const r of routes) {
    const p = buyPlan(w, c, r.price, replacing);
    const need = p.loanNowFd ?? p.cashNowFd;
    // What the route asks before the hold toward the truck is released into it (the explanation's two rows).
    if (need < best.need) best = { route: r.route, need, gross: p.loan ? p.loan.cashNeed : p.cashNeed, deposit: Math.min(p.deposit, p.loan ? p.loan.cashNeed : p.cashNeed) };
  }
  const hold = w.cfg.guide.gapCushionWeeks * cushion(w, c).avgWeeklyFd;
  const spare = Math.max(0, cash(w, c) - hold);
  return { gapFd: Math.max(0, best.need - spare), route: best.route, needNowFd: best.need, grossNeedFd: best.gross, depositFd: best.deposit, spareFd: spare, holdFd: hold };
}

/** The best load for an idle truck by the profit chip's one arithmetic (ruling 5): the most profit at book-now, if any pays. */
export function bestLoad(w: World, c: Company, truck: Truck): BoardRow | null {
  let best: BoardRow | null = null;
  for (const r of boardRows(w, c, truck, { dest: "any", maxDh: 300, query: "" })) {
    if (r.block || r.profitBook <= 0) continue;
    if (!best || r.profitBook > best.profitBook || (r.profitBook === best.profitBook && r.l.appointmentT < best.l.appointmentT)) best = r;
  }
  return best;
}

/** The trucks free to take a load now: idle, crewed, not on home time, no bid of the player's own in. */
export const freeTrucks = (w: World, c: Company): Truck[] =>
  (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status === "idle" && crewed(t) && !resting(w, t) && !w.manualBids.has(t.id));

/** Days to the next events What now? can name when nothing needs the player: the next round, the month's close, a layer, the factoring contract's end. */
export type NextEvent = { kind: "round"; atMin: number } | { kind: "monthClose"; atMin: number } | { kind: "layer"; layer: "businesses" | "brokerage"; atMin: number } | { kind: "factoring"; atMin: number };
export function nextEvent(w: World, c: Company): NextEvent {
  const perDay = w.cfg.time.gameMinutesPerDay;
  const today = day(w);
  const hour = (w.t % perDay) / 60;
  const rounds = w.cfg.time.boardRoundHours;
  const nextRound = rounds.find((h) => h > hour);
  const events: NextEvent[] = [{ kind: "round", atMin: (nextRound !== undefined ? today : today + 1) * perDay + (nextRound ?? rounds[0]!) * 60 }];
  let m = today;
  while ((m + 1) % w.cfg.time.daysPerMonth !== 0) m++;
  events.push({ kind: "monthClose", atMin: (m + 1) * perDay });
  for (const layer of ["businesses", "brokerage"] as const) {
    if (w.cfg.unlockLadder.enabled || w.cfg.unlockLadder.beta.enabled) {
      const at = w.cfg.unlockLadder.layers[layer].afterDays;
      if (!layerOpen(w, layer) && at > today) events.push({ kind: "layer", layer, atMin: at * perDay });
    }
  }
  if (c.factoring) events.push({ kind: "factoring", atMin: c.factoring.until * perDay });
  return events.filter((e) => e.atMin > w.t).sort((a, b) => a.atMin - b.atMin)[0] ?? events[0]!;
}

/** What the company is owed on open invoices (Getting paid), and whether quick pay could bring it in now. */
export function owed(w: World, c: Company): { fd: number; quickPayOpen: boolean } {
  const fd = invoices(w, c).reduce((s, r) => s + r.amountFd, 0);
  return { fd, quickPayOpen: w.cfg.token.payment.enabled && !c.factoring && c.payTerms !== "quick" };
}
