import {
  cashNowRate,
  ownerDrawFd,
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
import { clearsNear, clearsNearSource } from "./board.js";
import { PENDING_RULES } from "./copy-pending-rules.js";
import { EXPLAIN, NEWS } from "./copy.js";
import { moneyEvents, type MoneyEvent } from "./books.js";
import { emptyRun } from "./rolling.js";
import { cushion, debtCountdown, gapToTruck } from "./figures.js";
import { buyPlan } from "./finance.js";
import { TRAILER_NAME } from "./format.js";

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
  /** Lines on what moved the figure since the player last looked (the gap's reasons, row 4). */
  notes?: string[];
  /** R9: the money event a news figure is (books.ts: its ref and minute). */
  news?: { ref: string; t: number };
  /** R24: where an empty run goes (a hub's index). */
  toHub?: number;
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
  notes?: string[];
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
    [ownerDrawFd(w, t, driven) > 0 ? "Your draw as the driver (stays with you)" : "Driver's pay", per(cost.wages)],
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

/** The money event a news figure names, as books.ts kept it. */
const eventOf = (w: World, c: Company, ctx: FigureCtx): MoneyEvent | undefined => (ctx.news ? moneyEvents(w, c, ctx.news.t, 0).find((x) => x.ref === ctx.news!.ref && x.t === ctx.news!.t) : undefined);

const BREAKDOWNS: Record<string, Fn> = {
  // R9's money events. A breakdown: the terms of its odds as they stood when it was paid (wear.ts breakdownsPer1000Mi,
  // the grades of trips.ts), and the one that weighed most; under 1.25× all round, it was the base rate: bad luck.
  "news.breakdown": (w, c, ctx) => {
    const e = eventOf(w, c, ctx);
    if (!e?.why) return null;
    const k = e.why;
    const cfg = w.cfg;
    const wear = 1 - k.condition;
    const terms: { key: "worn" | "age" | "defects" | "grades"; label: string; mult: number }[] = [
      { key: "worn", label: `${NEWS.factors.condition}: ${pct(k.condition)}`, mult: 1 + cfg.breakdowns.wornMultiplier * wear * wear },
      { key: "age", label: `${NEWS.factors.age}: ${Math.round(k.odometer).toLocaleString("en-US")}`, mult: 1 + k.odometer / k.ageMi },
      { key: "defects", label: `${NEWS.factors.defects}: ${k.defects}`, mult: 1 + cfg.safety.maintenance.breakdownPerDefect * k.defects },
      ...(cfg.roads.terrain.enabled ? [{ key: "grades" as const, label: `${NEWS.factors.grades}: ${pct(k.mountainShare)}`, mult: 1 + cfg.roads.terrain.breakdownPerMountainShare * k.mountainShare }] : []),
    ];
    const top = [...terms].sort((a, b) => b.mult - a.mult)[0]!;
    const why =
      top.mult < 1.25
        ? NEWS.why.luck
        : top.key === "worn"
          ? k.canRebuild
            ? NEWS.why.worn(pct(k.condition))
            : NEWS.why.pastRebuild
          : top.key === "age"
            ? NEWS.why.age(Math.round(k.odometer).toLocaleString("en-US"))
            : top.key === "defects"
              ? NEWS.why.defects(k.defects)
              : NEWS.why.grades(pct(k.mountainShare));
    return { rows: terms.map((x) => ({ label: x.label, value: `×${x.mult.toFixed(2)}` })), total: { label: NEWS.factors.paid, value: fd(-e.fd) }, notes: [why] };
  },
  // R24: an empty run's price, by the per-mile parts of break-even (rolling.ts emptyRun): fuel, the driver's pay, tolls.
  "move.cost": (w, _c, ctx) => {
    const t = ctx.truckId !== undefined ? w.trucks.find((x) => x.id === ctx.truckId) : undefined;
    if (!t || ctx.toHub === undefined) return null;
    const r = emptyRun(w, t, t.hub, ctx.toHub);
    return {
      rows: [
        { label: `Fuel, ${r.mi} mi empty`, value: fd(r.parts.fuel) },
        { label: "The driver's pay", value: fd(r.parts.wages) },
        { label: "Tolls", value: fd(r.parts.tolls) },
      ],
      total: { label: `About, ${r.time}`, value: fd(r.costFd) },
    };
  },
  "news.fine": (w, c, ctx) => {
    const e = eventOf(w, c, ctx);
    if (!e) return null;
    const why = e.sub === "shoulder" ? NEWS.why.shoulder : e.sub === "hos" || e.sub === "falselog" ? NEWS.why.hos : e.sub === "speeding" ? NEWS.why.speeding : undefined;
    return { rows: [], total: { label: NEWS.factors.paid, value: fd(-e.fd) }, notes: why ? [why] : undefined };
  },
  "news.crash": (w, c, ctx) => {
    const e = eventOf(w, c, ctx);
    return e ? { rows: [], total: { label: NEWS.factors.paid, value: fd(-e.fd) } } : null;
  },
  "news.claim": (w, c, ctx) => {
    const e = eventOf(w, c, ctx);
    return e ? { rows: [], total: { label: NEWS.factors.paid, value: fd(-e.fd) } } : null;
  },
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
  // freight.ts clearsNear: the lane's trailing clears for this trailer, else the origin market's, else the load's own
  // reference rate; held at the load's ceiling.
  "board.clearsNear": (w, _c, ctx) => {
    const l = ctx.loadId !== undefined ? w.loads.get(ctx.loadId) : undefined;
    if (!l) return null;
    const src = clearsNearSource(w, l);
    const trailer = TRAILER_NAME[l.equipment].toLowerCase();
    const label =
      src.from === "lane"
        ? `This lane, ${trailer}: ${src.n.toLocaleString("en-US")} loads cleared, the recent ones weighing most`
        : src.from === "market"
          ? `Too few clears on this lane yet; ${w.net.hubs[l.origin]!.name}'s ${trailer} loads: ${src.n.toLocaleString("en-US")} cleared`
          : "Too few clears yet; this load's reference rate";
    const sh = src.shares;
    const rows: Row[] = sh
      ? [
          { label: PENDING_RULES.clearsShareLane(trailer), value: `${Math.round(sh.lane * 100)}%` },
          { label: PENDING_RULES.clearsShareMarket(w.net.hubs[l.origin]!.name, trailer), value: `${Math.round(sh.market * 100)}%` },
          { label: PENDING_RULES.clearsShareRef, value: `${Math.round(sh.load * 100)}%` },
          { label: PENDING_RULES.clearsBlend, value: perMi(src.rate) },
        ]
      : [{ label, value: perMi(src.rate) }];
    if (src.capped) rows.push({ label: "Held at this load's ceiling", value: perMi(l.ceiling), key: "board.ceiling" });
    return { rows, total: { label: "Usually clears near", value: perMi(clearsNear(w, l)) } };
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
  "guide.gapToTruck": (w, c, ctx) => {
    const g = gapToTruck(w, c);
    return {
      rows: [
        { label: `Cash needed now, the cheapest route (${g.route === "lot" ? "the used lot" : g.route === "listing" ? "a listing" : "new, on a loan"})`, value: fd(g.grossNeedFd), key: "loan.cashNow" },
        // The hold toward the truck counts in full when you buy (QA's rows 2/4 replay: the row was missing).
        ...(g.depositFd > 0.5 ? [{ label: "Less what's held toward your truck", value: fd(-g.depositFd), key: "truck.leaseDeposit" }] : []),
        { label: `Less your cash above ${w.cfg.guide.gapCushionWeeks} weeks of costs (${fd(g.holdFd)} kept for running costs)`, value: fd(-g.spareFd) },
      ],
      total: { label: "Gap to the next truck", value: fd(g.gapFd) },
      notes: ctx.notes,
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
