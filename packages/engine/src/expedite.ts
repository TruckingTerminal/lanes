/**
 * Early delivery for a fee (assets.expedite; Jeff's sink, the director's design in studio/reviews/director-early-delivery.md,
 * the economy's sizes in economy-early-delivery.md). A new rig, tractor or trailer on order in the NPC dealer's queue may
 * have its ready day brought forward, at the order or later, to the earliest open expedite slot:
 *
 * - **The slots** are apart from the ordinary queue, so nobody else's ready day moves: a week (day ÷ 7) holds
 *   slotsShareOfDeliveries of the trailing four weeks' deliveries a week (trucks and trailers), rounded up, never under
 *   minSlotsPerWeek. An expedited order takes a slot in the week it is ready in; the earliest open slot is the first day
 *   from floorDays after the payment whose week has one left.
 * - **The fee** is feePerWeekSaved of the price paid per week saved, read to the day, at least minFeeFd and at most
 *   maxFeeShare of the price. Paid at once from cash, never refunded (a cancelled order keeps it gone), a burn
 *   (sink:expedite, in BURN_TAGS: outside the emission cap's refill).
 * - **Not expeditable:** the used lot's rigs (from stock in its own days), a player dealership's order (its own stock and
 *   week), anything not on order.
 */
import { dayOf } from "./clock.js";
import { listPrice, npcDealerMult } from "./dealerships.js";
import { companyAccount } from "./ledger.js";
import type { Company, TruckOrder } from "./types.js";
import type { World } from "./world.js";

const DAYS_PER_WEEK = 7;
const weekOf = (day: number): number => Math.floor(day / DAYS_PER_WEEK);

/** The switch: assets.expedite.enabled, with the assets rules on (orders are theirs). */
export const expediteOn = (w: World): boolean => w.cfg.assets.enabled && w.cfg.assets.expedite?.enabled === true;

/** An order the NPC dealer's queue holds: a new rig, tractor or trailer, not the used lot's and not a player dealership's. */
export const expeditable = (o: TruckOrder): boolean => o.used === undefined && o.dealershipId === undefined;

const TRAILING_DAYS = 4 * DAYS_PER_WEEK;

/**
 * Counts a delivery from the NPC dealer's queue (dealer.ts deliverOrders): one order, one delivery (a rig counts once),
 * never the used lot's from-stock rigs nor a player dealership's sales. The slots are sized from these.
 */
export function noteQueueDelivery(w: World, o: TruckOrder): void {
  if (!expediteOn(w) || !expeditable(o)) return;
  const day = dayOf(w.t, w.cfg);
  const s = (w.expedite ??= { byWeek: {} });
  const d = (s.deliveredByDay ??= {});
  d[day] = (d[day] ?? 0) + 1;
  for (const k of Object.keys(d)) if (Number(k) <= day - TRAILING_DAYS) delete d[Number(k)];
}

/**
 * Expedite slots a week: slotsShareOfDeliveries of the NPC queue's deliveries a week over the trailing four weeks (or the
 * days the world has had, while it's younger), rounded up, never under minSlotsPerWeek.
 */
export function expediteSlotsPerWeek(w: World): number {
  const k = w.cfg.assets.expedite;
  const today = dayOf(w.t, w.cfg);
  let delivered = 0;
  for (const [day, n] of Object.entries(w.expedite?.deliveredByDay ?? {})) if (Number(day) > today - TRAILING_DAYS) delivered += n;
  const weeks = Math.max(1, Math.min(TRAILING_DAYS, today + 1)) / DAYS_PER_WEEK;
  return Math.max(k.minSlotsPerWeek, Math.ceil((k.slotsShareOfDeliveries * delivered) / weeks - 1e-9));
}

/** Slots taken in a week (the weeks before this one are dropped as they pass). */
const takenIn = (w: World, week: number): number => w.expedite?.byWeek[week] ?? 0;

/** The price the fee reads: what was paid at the order, else today's list for the order (an order from before the switch). */
function priceOf(w: World, o: Pick<TruckOrder, "kind" | "tier" | "trailer" | "priceFd">): number {
  return o.priceFd ?? listPrice(w, o.kind, o.tier, o.trailer) * npcDealerMult(w);
}

/** The fee for `daysSaved` on a truck of `priceFd`: feePerWeekSaved a week, to the day, at least minFeeFd, at most maxFeeShare. */
export function expediteFee(w: World, priceFd: number, daysSaved: number): number {
  const k = w.cfg.assets.expedite;
  const raw = (priceFd * k.feePerWeekSaved * daysSaved) / DAYS_PER_WEEK;
  return Math.round(Math.min(k.maxFeeShare * priceFd, Math.max(k.minFeeFd, raw)) * 100) / 100;
}

export type ExpediteQuote = { readyDay: number; daysSaved: number; feeFd: number; priceFd: number };

/**
 * What expediting an order would do now: its ready day at the earliest open slot (never inside floorDays of today), the
 * days that saves against the day it has, and the fee. A refusal's reason when there's nothing to quote. Reads only.
 */
export function quoteFor(w: World, o: Pick<TruckOrder, "kind" | "tier" | "trailer" | "priceFd" | "dueDay" | "used" | "dealershipId">): ExpediteQuote | { why: string } {
  if (!expediteOn(w)) return { why: "early delivery isn't offered" };
  if (!expeditable(o as TruckOrder)) return { why: "only an order in the dealer's queue can be delivered early" };
  const k = w.cfg.assets.expedite;
  const today = dayOf(w.t, w.cfg);
  const slots = expediteSlotsPerWeek(w);
  let day = today + k.floorDays;
  // A week with its slots taken offers the next week's first day; the card always shows the real earliest date.
  while (takenIn(w, weekOf(day)) >= slots) day = (weekOf(day) + 1) * DAYS_PER_WEEK;
  if (day >= o.dueDay) return { why: "no early slot comes before its ready day" };
  const daysSaved = o.dueDay - day;
  const priceFd = priceOf(w, o);
  return { readyDay: day, daysSaved, feeFd: expediteFee(w, priceFd, daysSaved), priceFd };
}

/** The quote for one of a company's orders, or why there isn't one. */
export function expediteQuote(w: World, c: Company, orderId: number): ExpediteQuote | { why: string } {
  const o = w.orders.find((x) => x.id === orderId);
  if (!o || o.companyId !== c.id) return { why: "no such order of yours" };
  return quoteFor(w, o);
}

/**
 * Pays to bring an order's ready day forward to the earliest open slot. The fee leaves cash at once (a burn), the order's
 * slot is taken in its new week (a re-expedited order gives back the slot it held), and its due day is the new day. No
 * refund, ever. Null on success, else why not.
 */
export function expediteOrder(w: World, c: Company, orderId: number): string | null {
  const o = w.orders.find((x) => x.id === orderId);
  if (!o || o.companyId !== c.id) return "no such order of yours";
  const q = quoteFor(w, o);
  if ("why" in q) return q.why;
  const acct = companyAccount(c.id);
  if (w.ledger.balance(acct) < q.feeFd) return "not enough FD for the fee";
  w.ledger.post(w.t, acct, "sink:expedite", q.feeFd, `expedite:${o.id}`);
  c.operating.costFd += q.feeFd;
  const s = (w.expedite ??= { byWeek: {} });
  const thisWeek = weekOf(dayOf(w.t, w.cfg));
  for (const wk of Object.keys(s.byWeek)) if (Number(wk) < thisWeek) delete s.byWeek[Number(wk)];
  // An order expedited before gives its slot back: it holds one slot, in the week it is ready in.
  if (o.expediteFeesFd !== undefined && s.byWeek[weekOf(o.dueDay)]) s.byWeek[weekOf(o.dueDay)]!--;
  s.byWeek[weekOf(q.readyDay)] = (s.byWeek[weekOf(q.readyDay)] ?? 0) + 1;
  o.dueDay = q.readyDay;
  o.expediteFeesFd = (o.expediteFeesFd ?? 0) + q.feeFd;
  return null;
}

// --- What the wait costs (the bots' rule; the client's and Iuliia's figure to share) ---------------------------------

const MONTH_WEEKS = (w: World): number => w.cfg.time.daysPerMonth / DAYS_PER_WEEK;
const weeksSinceStart = (w: World, c: Company): number => Math.max(1, (dayOf(w.t, w.cfg) - c.createdDay) / DAYS_PER_WEEK);

/**
 * The company's weekly gross on the better-founded basis (the client's figures.ts weeklyGross, the director's "more
 * weeks"): last month's revenue over its weeks, or the revenue since it started over its weeks, whichever covers more.
 */
export function weeklyGrossFd(w: World, c: Company): number {
  if (c.lastMonth && MONTH_WEEKS(w) > weeksSinceStart(w, c)) return c.lastMonth.revenueFd / MONTH_WEEKS(w);
  return c.operating.revenueFd / weeksSinceStart(w, c);
}

/** The week's books at the weekly close (step.ts), the last keptSpanWeeks + 1 kept: what keptPerTruck reads. */
export function noteBooks(w: World, c: Company): void {
  if (!expediteOn(w)) return;
  const books = (c.expediteBooks ??= []);
  books.push({ revenueFd: c.operating.revenueFd, costFd: c.operating.costFd, truckWeeks: c.truckWeeks });
  while (books.length > w.cfg.assets.expedite.keptSpanWeeks + 1) books.shift();
}

/**
 * What the company's trucks have each kept a week from its books, over the last keptSpanWeeks (or the weeks it has, the
 * span at most): revenue less operating costs (the driver's pay and the truck's costs) over the truck-weeks run, floored
 * at zero. `weeks` is the history it read; under keptMinHistoryWeeks it reads nothing (0).
 */
export function keptPerTruck(w: World, c: Company): { perWeekFd: number; weeks: number } {
  const k = w.cfg.assets.expedite;
  const books = c.expediteBooks ?? [];
  const weeks = Math.max(0, books.length - 1);
  if (weeks < k.keptMinHistoryWeeks) return { perWeekFd: 0, weeks };
  const a = books[0]!;
  const b = books[books.length - 1]!;
  const kept = b.revenueFd - a.revenueFd - (b.costFd - a.costFd);
  return { perWeekFd: Math.max(0, kept / Math.max(1, b.truckWeeks - a.truckWeeks)), weeks };
}

/**
 * The director's re-ruled driver guard (rule 1, director-expedite-wait-cost-2026-11-10.md): the company staffs what it
 * owns, so a truck it adds will be driven (the hire comes the day the truck does). Today none of its trucks on the road
 * stands without a driver, and at least one is seated. A parked or listed truck is off the road and needs no driver (the
 * day's staffing seats it last, labor.ts autoStaff). An owner who drives a truck doesn't count for a second. `emptyTruckNo`
 * is the first empty truck as the player numbers it (its place among the company's trucks not retired, as the client's
 * truckNo), for Iuliia's "Truck 3 has no driver today".
 */
export function staffsWhatItOwns(w: World, c: Company): { staffed: boolean; seated: number; emptyTruckNo: number | null } {
  const fleet = (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired");
  const onRoad = fleet.filter((t) => t.status !== "parked" && t.status !== "listed");
  const empty = onRoad.find((t) => t.driverId === 0);
  const seated = fleet.filter((t) => t.driverId !== 0).length;
  return { staffed: !empty && seated > 0, seated, emptyTruckNo: empty ? fleet.indexOf(empty) + 1 : null };
}

/** What waiting costs over the days an expedite saves, in parts (the client and Iuliia say each for what it is). */
export type ExpediteWaitParts = {
  readyDay: number;
  daysSaved: number;
  feeFd: number;
  /** The loan payments running on the order over the days saved. */
  paymentsFd: number;
  /** For an order replacing the lease: the lessor's share at the company's weekly gross over the days saved; else 0. */
  lessorFd: number;
  /** countsKeptPerTruck: whether the earnings term applies (an order adding a truck, not a trailer, not a lease replacement). */
  addsTruck: boolean;
  /** The company staffs what it owns (staffsWhatItOwns): the truck it adds will be driven. */
  driver: boolean;
  /**
   * Which of Iuliia's sentences (the director's re-ruling): "counts" (the term counts), "emptyTruck" (a truck on the road
   * stands without a driver today: emptyTruckNo), "noTruckSeated" (none of its trucks is seated), "books" (under
   * keptMinHistoryWeeks of books), or "notApplicable" (the key off, a lease replacement or a trailer).
   */
  keptCase: "counts" | "emptyTruck" | "noTruckSeated" | "books" | "notApplicable";
  /** The empty truck as the player numbers it, for "emptyTruck"; else null. */
  emptyTruckNo: number | null;
  /** What the trucks have each kept a week, and over how many weeks of books (keptPerTruck). */
  keptPerTruckWeekFd: number;
  keptWeeks: number;
  /** The earnings term as counted: kept a week × the weeks saved, when it applies, a driver is there and the books suffice. */
  keptFd: number;
};

/**
 * The wait's parts for one of a company's orders (the director's ruling, director-expedite-wait-cost-2026-11-10.md):
 * the payments, the lessor's share where it applies, and with countsKeptPerTruck the trucks' kept per week and its
 * span, whether a driver is there, and the fee. Never summed into a promise for the player; the bots compare the fee
 * with the sum (expediteWaitCostFd).
 */
export function expediteWaitParts(w: World, c: Company, orderId: number): ExpediteWaitParts | { why: string } {
  const o = w.orders.find((x) => x.id === orderId);
  if (!o || o.companyId !== c.id) return { why: "no such order of yours" };
  const q = quoteFor(w, o);
  if ("why" in q) return q;
  const k = w.cfg.assets.expedite;
  const weeks = q.daysSaved / DAYS_PER_WEEK;
  let payments = 0;
  for (const l of w.purchaseLoans) if (l.orderId === o.id && l.status === "active") payments += Math.min(l.principalFd, l.originalFd / l.termWeeks) + l.principalFd * l.weeklyRate;
  let lessor = 0;
  if (o.replaceNpcLease) {
    const fleet = w.trucksByCompany.get(c.id) ?? [];
    const leased = fleet.filter((t) => t.lease === "npc").length;
    if (leased > 0) lessor = w.cfg.costs.npcLeaseShareOfGross * weeklyGrossFd(w, c) * (leased / fleet.length);
  }
  const addsTruck = k.countsKeptPerTruck && !o.replaceNpcLease && o.kind !== "trailer";
  const staff = staffsWhatItOwns(w, c);
  const kept = keptPerTruck(w, c);
  // An empty truck first (the player can seat it today), then no truck seated, then the books.
  const keptCase = !addsTruck ? "notApplicable" : staff.emptyTruckNo !== null ? "emptyTruck" : !staff.staffed ? "noTruckSeated" : kept.weeks < k.keptMinHistoryWeeks ? "books" : "counts";
  const keptFd = keptCase === "counts" ? kept.perWeekFd * weeks : 0;
  return { readyDay: q.readyDay, daysSaved: q.daysSaved, feeFd: q.feeFd, paymentsFd: payments * weeks, lessorFd: lessor * weeks, addsTruck, driver: staff.staffed, keptCase, emptyTruckNo: keptCase === "emptyTruck" ? staff.emptyTruckNo : null, keptPerTruckWeekFd: kept.perWeekFd, keptWeeks: kept.weeks, keptFd };
}

/** What the wait costs in all, for the bots' rule: the payments, the lessor's share, and the earnings term as counted. */
export function expediteWaitCostFd(w: World, c: Company, orderId: number): number {
  const p = expediteWaitParts(w, c, orderId);
  return "why" in p ? 0 : p.paymentsFd + p.lessorFd + p.keptFd;
}

