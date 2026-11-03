import {
  cashNowRate,
  companyAccount,
  condition,
  creditBand,
  dayOf,
  dealerPrice,
  creditScore,
  dispatchProfile,
  expectedReloadDeadheadMi,
  expectedRepairPerMile,
  fuelPrice,
  operatingTrucks,
  placeMiles,
  placeToll,
  tractorLifeUsed,
  trailerValue,
  tripCost,
  truckValue,
  type Company,
  type World,
} from "@lanes/engine";
import { EXPLAIN } from "./copy.js";
import { cushion, debtCountdown, gapToTruck } from "./figures.js";
import { buyPlan } from "./finance.js";

/**
 * Help on every figure (specs/guidance.md section 2): one table keyed like copy.ts. The writer's what / how / moves are
 * in copy.ts EXPLAIN; here, per key, the breakdown of this company's inputs from the world, ending in a total that is
 * the figure on screen. A key with no breakdown still explains (its what, its how sentence, its moves). Another
 * company's figures (`.other`) never get one: Intel's row 1.
 */

/** What a figure on screen was computed from: the load, the truck, an amount, as the component that shows it knows. */
export interface FigureCtx {
  loadId?: number;
  truckId?: number;
  /** An amount the figure is built on (a price for a loan, a gross for the lessor's share). */
  fd?: number;
  replacing?: boolean;
  /** The open invoice a cash-now figure is for. */
  invoiceId?: number;
}

export interface Row {
  label: string;
  value: string;
  /** The row's own explain key, when it has one: the sheet links it. */
  key?: string;
}
export interface Breakdown {
  rows: Row[];
  total: Row;
}

const fd = (x: number) => `${x < 0 ? "−" : ""}${Math.round(Math.abs(x)).toLocaleString("en-US")} FD`;
const perMi = (x: number) => `${x.toFixed(2)}/mi`;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const pct1 = (x: number) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;

type Fn = (w: World, c: Company, ctx: FigureCtx) => Breakdown | null;

/** The break-even's parts, per loaded mile, on exactly the inputs breakeven.ts trueBreakEven uses. */
function breakEvenParts(w: World, c: Company, ctx: FigureCtx): { parts: [string, number][]; total: number; loaded: number } | null {
  const l = ctx.loadId !== undefined ? w.loads.get(ctx.loadId) : undefined;
  const t = ctx.truckId !== undefined ? w.trucks[ctx.truckId - 1] : undefined;
  if (!l || !t) return null;
  const prof = dispatchProfile(w, c, operatingTrucks(w, c.id));
  const fuel = fuelPrice(w);
  const dh = placeMiles(w, t.place, l.originPlace);
  const reload = prof.reloadWeight * expectedReloadDeadheadMi(w, l.dest, l.equipment, prof.foresightDays);
  const tr = w.cfg.roads.terrain;
  const lane = w.net.lanes[l.laneId];
  const climb = tr.enabled && lane ? tr.fuelGalPerClimbM * lane.climbM * fuel : 0;
  const driven = l.miles + dh + reload;
  const cost = tripCost(w.cfg, t, fuel, driven, l.miles);
  const keep = t.lease !== "owned" ? 1 - w.cfg.costs.npcLeaseShareOfGross : 1;
  const per = (x: number) => x / (l.miles * keep);
  const tolls = placeToll(w, t.place, l.originPlace) + l.routeTollFd + climb;
  const parts: [string, number][] = [
    ["Fuel", per(cost.fuel)],
    ["Driver's pay", per(cost.wages)],
    ["Maintenance", per(cost.maintenance)],
    ["Insurance", per(cost.insurance)],
    ["Expected repairs", per(expectedRepairPerMile(w.cfg, t) * driven)],
    ["Tolls and climbs", per(tolls)],
  ];
  return { parts, total: parts.reduce((s, [, x]) => s + x, 0), loaded: l.miles };
}

function cashNowParts(w: World, c: Company, ctx: FigureCtx, total: "fee" | "lands"): Breakdown | null {
  const r = ctx.invoiceId !== undefined ? w.receivables.find((x) => x.id === ctx.invoiceId) : undefined;
  if (!r) return null;
  const rate = cashNowRate(w, c, r);
  if (typeof rate === "string") return null;
  const k = w.cfg.token.payment;
  const base = c.factoring && c.factoring.rate !== undefined ? c.factoring.rate : k.cashNow.spotPct;
  const age = Math.max(0, dayOf(w.t, w.cfg) - (r.dueDay - k.termsDays));
  const fee = r.amountFd * rate;
  const rows: Row[] = [
    { label: "The invoice", value: fd(r.amountFd) },
    { label: c.factoring ? "Your contract's rate" : "The spot rate", value: pct1(base) },
    { label: `Aging: ${age} days since it was raised`, value: pct1(rate - base) },
    { label: "The fee", value: fd(-fee) },
  ];
  return total === "fee" ? { rows: rows.slice(0, 3), total: { label: "Fee", value: fd(fee) } } : { rows, total: { label: "Lands today", value: fd(r.amountFd - fee) } };
}

const BREAKDOWNS: Record<string, Fn> = {
  "truck.breakEven": (w, c, ctx) => {
    const b = breakEvenParts(w, c, ctx);
    if (!b) return null;
    const t = w.trucks[ctx.truckId! - 1]!;
    const rows: Row[] = b.parts.map(([label, x]) => ({ label, value: perMi(x), key: label === "Fuel" ? "pay.fuel" : label === "Maintenance" ? "pay.maintenance" : label === "Insurance" ? "pay.insurance" : label === "Tolls and climbs" ? "pay.tolls" : undefined }));
    if (t.lease !== "owned") rows.push({ label: `÷ ${pct(1 - w.cfg.costs.npcLeaseShareOfGross)}, the lessor's ${pct(w.cfg.costs.npcLeaseShareOfGross)} off each load`, value: "included", key: "pay.lessorShare" });
    return { rows, total: { label: "Break-even", value: perMi(b.total) } };
  },
  "board.profitChip": (w, c, ctx) => {
    const b = breakEvenParts(w, c, ctx);
    const l = ctx.loadId !== undefined ? w.loads.get(ctx.loadId) : undefined;
    if (!b || !l) return null;
    const rate = ctx.fd ?? l.bookNow;
    return {
      rows: [
        { label: `${rate.toFixed(2)}/mi × ${Math.round(l.miles).toLocaleString("en-US")} mi`, value: fd(rate * l.miles) },
        { label: `Less break-even ${perMi(b.total)} × ${Math.round(l.miles).toLocaleString("en-US")} mi`, value: fd(-b.total * l.miles), key: "truck.breakEven" },
      ],
      total: { label: "Profit", value: fd((rate - b.total) * l.miles) },
    };
  },
  // The truck's worth, as dealer.ts truckValue: the price new today, less the share of its life its miles used, less
  // its age, held at its floor, less wear; with the assets on, its trailer is valued on its own and added.
  "truck.value": (w, _c, ctx) => {
    const t = ctx.truckId !== undefined ? w.trucks[ctx.truckId - 1] : undefined;
    if (!t || t.lease !== "owned") return null;
    const d = w.cfg.depreciation;
    const today = dayOf(w.t, w.cfg);
    const years = Math.max(0, today - t.builtDay) / w.cfg.time.daysPerSeason;
    const assets = w.cfg.assets.enabled;
    const P = assets ? w.cfg.dealerFd.tractor[t.tier] * w.dealerIndex.tractor[t.tier] : dealerPrice(w, t);
    const life = assets ? tractorLifeUsed(w.cfg, t) : t.odometer / d.lifetimeMiles;
    const floor = assets ? w.cfg.assets.tractor.scrapShare : d.floorPct;
    const raw = 1 - life - years * d.perYear;
    const left = Math.max(floor, raw);
    const wear = left * d.conditionWeight * (1 - condition(w.cfg, t));
    const rows: Row[] = [
      { label: assets ? "The tractor new today" : "Price new today", value: fd(P) },
      { label: `Less miles: ${Math.round(t.odometer).toLocaleString("en-US")} mi, ${pct(life)} of its life`, value: fd(-P * life) },
      { label: `Less age: ${years.toFixed(1)} years`, value: fd(-P * years * d.perYear) },
      ...(raw < floor ? [{ label: `Held at its floor, ${pct(floor)} of new`, value: fd(P * (floor - raw)) }] : []),
      { label: `Less wear: condition ${pct(condition(w.cfg, t))}`, value: fd(-P * wear) },
    ];
    const tr = assets && t.trailerId ? w.trailers[t.trailerId - 1] : undefined;
    if (tr) rows.push({ label: "Its trailer, valued the same way", value: fd(trailerValue(w, tr)) });
    return { rows, total: { label: "Worth", value: fd(truckValue(w, t)) } };
  },
  // Cash it now (receivables.ts cashNowRate): the invoice, the rate's parts with this invoice's days, the fee and what lands.
  "invoice.cashNowFee": (w, c, ctx) => cashNowParts(w, c, ctx, "fee"),
  "invoice.cashNowLands": (w, c, ctx) => cashNowParts(w, c, ctx, "lands"),
  "money.cash": (w, c) => ({ rows: [], total: { label: "Cash", value: fd(w.ledger.balance(companyAccount(c.id))) } }),
  // The hold toward the player's own truck (the director's row 2): what each leased truck has held, against what its lease asks.
  "truck.leaseDeposit": (w, c) => {
    const k = w.cfg.freeEntry.leases.byValue;
    const trucks = (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.lease === "npc" && t.depositDueFd > 0.005);
    if (!trucks.length) return null;
    const held = trucks.reduce((s, t) => s + t.depositFd, 0);
    return {
      rows: [
        { label: "Held from each leased load, until the deposit is whole", value: pct(k.escrowShareOfPay) },
        ...trucks.map((t) => ({ label: trucks.length === 1 ? `Held so far, of ${fd(t.depositDueFd)}` : `Truck #${t.id}, of ${fd(t.depositDueFd)}`, value: fd(t.depositFd) })),
      ],
      total: { label: "Held toward your truck", value: fd(held) },
    };
  },
  "guide.cushion": (w, c) => {
    const cu = cushion(w, c);
    return {
      rows: [
        { label: "Cash", value: fd(cu.cashFd), key: "money.cash" },
        { label: `Average weekly spending, last ${w.cfg.guide.cushionAvgWeeks} weeks`, value: fd(cu.avgWeeklyFd) },
      ],
      total: { label: "Cushion", value: cu.weeks === null ? "no spending yet" : `${cu.weeks.toFixed(1)} weeks` },
    };
  },
  "guide.debtCountdown": (w, c) => {
    const d = debtCountdown(w, c);
    return {
      rows: [
        { label: "Cash", value: fd(w.ledger.balance(companyAccount(c.id))), key: "money.cash" },
        { label: "The line", value: fd(-w.cfg.insolvency.debtLimitFd) },
        { label: "Next weekly check", value: `day ${d.nextDay + 1}` },
      ],
      total: { label: "Weekly checks in debt", value: `${d.n} of ${d.of}` },
    };
  },
  "guide.gapToTruck": (w, c) => {
    const g = gapToTruck(w, c);
    return {
      rows: [
        { label: `Cash needed now, the cheapest route (${g.route === "lot" ? "the used lot" : g.route === "listing" ? "a listing" : "new, on a loan"})`, value: fd(g.needNowFd), key: "loan.cashNow" },
        { label: `Less cash above ${w.cfg.guide.gapCushionWeeks} weeks of costs (${fd(g.holdFd)} held back)`, value: fd(-g.spareFd) },
      ],
      total: { label: "Gap to the next truck", value: fd(g.gapFd) },
    };
  },
  "loan.cashNow": (w, c, ctx) => {
    if (ctx.fd === undefined) return null;
    const p = buyPlan(w, c, ctx.fd, ctx.replacing ?? false);
    if (!p.loan) return null;
    return {
      rows: [
        { label: "Down payment", value: fd(p.loan.down), key: "loan.downPayment" },
        { label: "Loan stake", value: fd(p.loan.stake) },
        { label: "Sales tax", value: fd(p.tax) },
        ...(p.deposit > 0.5 ? [{ label: "Less your lease deposit", value: fd(-p.deposit), key: "truck.leaseDeposit" }] : []),
      ],
      total: { label: "Cash needed now", value: fd(p.loanNowFd ?? 0) },
    };
  },
  "pay.lessorShare": (w, _c, ctx) =>
    ctx.fd === undefined ? null : { rows: [{ label: "What the load paid", value: fd(ctx.fd) }, { label: "× the lessor's share", value: pct(w.cfg.costs.npcLeaseShareOfGross) }], total: { label: "The lessor's share", value: fd(ctx.fd * w.cfg.costs.npcLeaseShareOfGross) } },
  "standing.onTime": (_w, c) => ({ rows: [{ label: "Loads on time", value: String(c.onTime) }, { label: "Loads delivered", value: String(c.delivered) }], total: { label: "On time", value: c.delivered ? pct(c.onTime / c.delivered) : "—" } }),
  "standing.reputation": (w, c) => {
    const k = w.cfg.reputation;
    return {
      rows: [
        { label: "Loads on time", value: String(c.onTime) },
        { label: "Loads delivered", value: String(c.delivered) },
        { label: `Smoothed by ${k.priorLoads} loads at`, value: pct(k.start) },
      ],
      total: { label: "Reputation", value: pct(c.reputation) },
    };
  },
  "intel.creditBand": (w, c) => {
    const s = Math.round(creditScore(w, c));
    const band = creditBand(s);
    const cut: Record<string, string> = { A: "80 and up", B: "65–79", C: "50–64", D: "35–49", E: "under 35" };
    return { rows: [{ label: `${band} is ${cut[band]}. You're at`, value: String(s) }], total: { label: "Credit", value: band } };
  },
};

/** The first month's figure keys (the writer's table): what the coverage test holds the screens to. */
export const FIRST_MONTH_KEYS = (cfg: Parameters<typeof EXPLAIN>[0]): string[] => Object.keys(EXPLAIN(cfg)).filter((k) => !k.endsWith(".other"));

/** The breakdown for a figure, or null: another company's never has one; a key without a function has its sentences alone. */
export function breakdown(w: World, c: Company, key: string, ctx: FigureCtx): Breakdown | null {
  if (key.endsWith(".other")) return null;
  const f = BREAKDOWNS[key];
  return f ? f(w, c, ctx) : null;
}
