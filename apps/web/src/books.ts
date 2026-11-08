import { companyAccount, condition, rebuildable, type Company, type Truck, type World } from "@lanes/engine";

/**
 * The month's books (R10, player2-ux.md section 4): what each player's company earned and spent by kind, and why its
 * cash moved differently, read from the ledger as the world runs. Every world on the page is rebuilt by replaying its
 * seed and its log (game.ts TestGame.restore, live.ts), so an observer on the ledger sees every posting a company ever
 * made; it only reads, so the replay is untouched. A month closes when the engine writes its month record (intel.ts
 * monthlyIntel, the last job of the close), so the books and Intel cut the month at the same posting.
 *
 * It adds up by construction: every posting to the company's cash lands in exactly one line, and the invoices the
 * company holds (or owes, for a brokerage) at each close turn the cash in from loads into what the month's deliveries
 * earned. The coverage test (books.test.ts) pins it.
 *
 * It also keeps R9's money events: a breakdown, a fine or ticket, a cargo claim of guard.newsFd or more, with what
 * made it likely, read at the moment it was paid.
 */

/** Earned: what the month's work brought in. */
export const EARNED = ["loads", "detention", "fees", "otherIn"] as const;
/** Spent: what the month's work cost. */
export const SPENT = ["fuel", "fuelTax", "wages", "lessor", "maintenance", "insurance", "tolls", "yard", "fines", "claims", "interest", "overhead", "idle", "carrierPay", "taxes", "otherOut"] as const;
/** Cash that moved for other reasons: why cash moved differently from what was kept. */
export const MOVED = ["bought", "sold", "loansIn", "principal", "held", "setAside", "between", "capital", "token"] as const;
export type BookLine = (typeof EARNED)[number] | (typeof SPENT)[number] | (typeof MOVED)[number];

export interface MoneyEvent {
  t: number;
  kind: "breakdown" | "crash" | "fine" | "claim";
  /** FD paid, positive. */
  fd: number;
  truckId: number | null;
  /** The fine's kind (the ref's: shoulder, speeding, hos, falselog, tracking), when a fine. */
  sub?: string;
  /** What made a breakdown likely, read at the moment it was paid. */
  why?: { condition: number; odometer: number; ageMi: number; defects: number; mountainShare: number; canRebuild: boolean };
  ref: string;
}

interface Open {
  fromDay: number;
  cashStart: number;
  owedStart: number;
  payStart: number;
  /** Signed FD by line: + into the company's cash, − out of it. */
  flows: Partial<Record<BookLine, number>>;
  loadedMi: number;
  emptyMi: number;
  /** The owner's draw kept by the company so far (Company.ownerDrawFd, labor.owner.drawStays) as the month began. */
  drawStart: number;
}
export interface MonthBooks extends Open {
  closedDay: number;
  cashEnd: number;
  owedEnd: number;
  payEnd: number;
  loads: number;
  onTime: number;
  drawEnd: number;
}

interface CompanyBooks {
  open: Open;
  closed: MonthBooks[];
  mark: number | null;
  events: MoneyEvent[];
  odo: Map<number, { odo: number; loaded: boolean }>;
}
interface WorldBooks {
  byCompany: Map<number, CompanyBooks>;
}
const BOOKS = new WeakMap<World, WorldBooks>();

/** Invoices the company holds, not yet paid: what it is owed. */
export const owedTo = (w: World, c: Company): number => w.receivables.reduce((s, r) => (r.payeeId === c.id && r.holder === c.id ? s + r.amountFd : s), 0);
/** Paper the company owes others (a brokerage's carrier pay, a shipper's freight bills). */
export const owedBy = (w: World, c: Company): number => w.receivables.reduce((s, r) => (r.payer === c.id ? s + r.amountFd : s), 0);

const tagOf = (acct: string) => acct.slice(acct.indexOf(":") + 1);

/** The line a posting to or from a company's cash belongs to, from the account on the other side and the ref. */
export function lineOf(w: World, c: Company, other: string, ref: string, inflow: boolean): BookLine {
  if (other.startsWith("sink:") || other.startsWith("faucet:")) {
    switch (tagOf(other)) {
      case "npc_shipper":
        return ref.startsWith("detention:") ? "detention" : "loads";
      case "npc_factor":
        // In, the factor's pay for a load; out (sink:npc_factor), the payer settling freight it owed on paper the NPC factor
        // or lessor holds (receivables.ts holderAccount): a broker repaying the advance to its carrier, a shipper the same.
        return inflow ? "loads" : "carrierPay";
      case "npc_lessor":
      // An NPC's advance on a company's paper (engine receivables.ts NPC_ADVANCE): a carrier's pay for a load, paid early.
      case "npc_advance":
        return "loads";
      case "factoring_fee":
      case "board_fee":
        return "fees";
      case "fuel":
      case "idle_fuel":
      case "reefer_fuel":
        return "fuel";
      case "fuel_tax":
        return "fuelTax";
      case "driver_wages":
      case "dispatch":
      case "per_diem":
      case "management":
      case "signing_bonus":
      case "severance":
        return "wages";
      case "npc_lease":
      case "trailer_rent":
        return "lessor";
      case "parts":
      case "repairs":
      case "road_service":
      case "rebuild":
      case "maintenance":
        return "maintenance";
      case "insurance":
      case "liability":
        return "insurance";
      case "tolls":
        return "tolls";
      case "yard":
      case "yard_security":
        return "yard";
      case "fines":
        return "fines";
      case "cargo_claims":
      case "cargo_claim":
      case "broker_falloff":
        return "claims";
      case "loan_interest":
      case "loan_risk":
        return "interest";
      case "fleet_overhead":
      case "permits":
      case "surety":
      case "business_upkeep":
      case "facility_upkeep":
        return "overhead";
      case "idle_fee":
        return "idle";
      case "holding_cost":
      case "profit_tax":
      case "profit_tax_burn":
      case "sales_tax":
        return "taxes";
      case "loan_principal":
        return "principal";
      case "npc_finance":
        return inflow ? "loansIn" : "principal";
      case "lease_deposit":
        return "held";
      case "used_lot":
      case "equipment_dealer":
      case "business_dealer":
      case "facility_dealer":
      case "asset_burn":
      case "asset_reserve":
      case "security":
      case "logbook_boost":
      case "market_fee":
        return "bought";
      case "scrap":
      case "dealer_buyback":
        return "sold";
      case "starting_grant":
      case "bankruptcy_writeoff":
        return "capital";
      case "airdrop":
      case "auction":
      case "airdrop_forfeit":
      case "season_close":
      case "launch_reset":
      case "exchange_fee":
        return "token";
      case "insurance_pd":
        return "otherIn";
      default:
        return inflow ? "otherIn" : "otherOut";
    }
  }
  if (other.startsWith("alloc:") || other === "reserve") return inflow ? "token" : "bought";
  const id = /^co:(\d+)$/.exec(other)?.[1];
  if (id === undefined) {
    // Escrows, stakes, the Reserve, bonds, the pools, the bridge: cash set aside (and back), not earned or spent.
    if (other.startsWith("co:pool:") && ref.startsWith("loan:")) return "loansIn";
    if (other.startsWith("co:pool:") && (ref.startsWith("payment:") || ref.startsWith("repay:"))) return "principal";
    if (other === "co:pool:exchange") return "token";
    return "setAside";
  }
  const them = Number(id);
  if (c.partnerId === them || w.companies[them - 1]?.partnerId === c.id) return "between";
  // Another company: freight pay between a carrier and its broker, a shop's or a stop's bill, or a trade.
  if (ref.startsWith("load:") || ref.startsWith("rebroker:") || ref.startsWith("detention:")) {
    if (inflow) return ref.startsWith("detention:") ? "detention" : "loads";
    // A carrier pays another company on a trip's ref only for fuel at its station; a broker pays its haulers.
    return c.role === "broker" ? "carrierPay" : "fuel";
  }
  if (/^(breakdown|fix|rebuild|refurb|crash|oos):/.test(ref)) return "maintenance";
  if (ref.startsWith("rest:")) return "yard";
  if (ref.startsWith("reposition:") || ref.startsWith("abandon:")) return "fuel";
  return inflow ? "sold" : "bought";
}

/** Postings to watch: a person's company's own cash account (never an NPC's, never a stake or escrow). */
function watched(w: World, acct: string): Company | null {
  if (acct.charCodeAt(0) !== 99 || !acct.startsWith("co:")) return null;
  const id = Number(acct.slice(3));
  if (!Number.isInteger(id) || id < 1) return null;
  const c = w.companies[id - 1];
  return c?.human ? c : null;
}

const dayOfT = (w: World, t: number) => Math.floor(t / w.cfg.time.gameMinutesPerDay);

function booksOf(w: World, c: Company, cashBefore: number): CompanyBooks {
  const wb = BOOKS.get(w)!;
  let b = wb.byCompany.get(c.id);
  if (!b) {
    b = { open: { fromDay: dayOfT(w, w.t), cashStart: cashBefore, owedStart: owedTo(w, c), payStart: owedBy(w, c), flows: {}, loadedMi: 0, emptyMi: 0, drawStart: c.ownerDrawFd }, closed: [], mark: c.lastMonth?.closedDay ?? null, events: [], odo: new Map() };
    wb.byCompany.set(c.id, b);
  }
  return b;
}

const truckOfRef = (w: World, ref: string): number | null => {
  const m = /^[a-z]+:(?:[a-z]+:)?(\d+)$/.exec(ref);
  if (!m) return null;
  const id = Number(m[1]);
  return w.trucks[id - 1]?.id === id ? id : (w.trucks.find((t) => t.id === id)?.id ?? null);
};

function moneyEvent(w: World, b: CompanyBooks, other: string, ref: string, fd: number): void {
  const kind: MoneyEvent["kind"] | null = ref.startsWith("breakdown:") ? "breakdown" : ref.startsWith("crash:") && other === "sink:repairs" ? "crash" : ref.startsWith("fine:") ? "fine" : other.startsWith("sink:cargo_claim") ? "claim" : null;
  if (!kind) return;
  // One event per ref and minute: a bill split between a shop and the pump, or a tax on it, is one breakdown.
  const last = b.events[b.events.length - 1];
  if (last && last.ref === ref && last.t === w.t) {
    last.fd += fd;
    return;
  }
  const truckId = kind === "claim" ? null : truckOfRef(w, ref.startsWith("fine:") ? ref.slice(5) : ref);
  const e: MoneyEvent = { t: w.t, kind, fd, truckId, ref };
  if (kind === "fine") e.sub = ref.split(":")[1];
  if (kind === "breakdown" && truckId) {
    const t = w.trucks.find((x) => x.id === truckId)!;
    e.why = { condition: condition(w.cfg, t), odometer: t.odometer, ageMi: w.cfg.breakdowns.ageMi, defects: t.defects, mountainShare: t.legMiles > 0 ? t.legMountainMi / t.legMiles : 0, canRebuild: rebuildable(w.cfg, t) };
  }
  b.events.push(e);
  if (b.events.length > 200) b.events.splice(0, b.events.length - 200);
}

function note(w: World, acct: string, other: string, fd: number, ref: string, inflow: boolean): void {
  const c = watched(w, acct);
  if (!c) return;
  const before = w.ledger.balance(acct) + (inflow ? -fd : fd);
  const b = booksOf(w, c, before);
  const line = lineOf(w, c, other, ref, inflow);
  b.open.flows[line] = (b.open.flows[line] ?? 0) + (inflow ? fd : -fd);
  if (!inflow) moneyEvent(w, b, other, ref, fd);
}

/**
 * Starts the books on a new world (game.ts newWorld): wraps the ledger's post with a reader. It never throws into the
 * engine: a fault in the books is the page's, never the world's.
 */
export function watchBooks(w: World): void {
  if (BOOKS.has(w)) return;
  BOOKS.set(w, { byCompany: new Map() });
  const ledger = w.ledger;
  const post = ledger.post.bind(ledger);
  ledger.post = (t, from, to, amountFd, ref, mode) => {
    const r = post(t, from, to, amountFd, ref, mode);
    if (amountFd > 0)
      try {
        const fd = Math.round(amountFd * 100) / 100;
        if (from.startsWith("co:")) note(w, from, to, fd, ref, false);
        if (to.startsWith("co:")) note(w, to, from, fd, ref, true);
      } catch (e) {
        console.error(e);
      }
    return r;
  };
}

/** After each game hour (TestGame.stepHour, LiveWorld.advance): the miles, and the month close once the engine has written it. */
export function booksAfterHour(w: World): void {
  const wb = BOOKS.get(w);
  if (!wb) return;
  try {
    for (const [id, b] of wb.byCompany) {
      const c = w.companies[id - 1]!;
      for (const t of w.trucksByCompany.get(c.id) ?? []) milesOf(b, t);
      const closed = c.lastMonth?.closedDay ?? null;
      if (closed === null || closed === b.mark) continue;
      b.mark = closed;
      const cashEnd = w.ledger.balance(companyAccount(c.id));
      const owedEnd = owedTo(w, c);
      const payEnd = owedBy(w, c);
      b.closed.push({ ...b.open, closedDay: closed, cashEnd, owedEnd, payEnd, loads: c.lastMonth!.loads, onTime: c.lastMonth!.onTime, drawEnd: c.ownerDrawFd });
      if (b.closed.length > 24) b.closed.shift();
      b.open = { fromDay: closed, cashStart: cashEnd, owedStart: owedEnd, payStart: payEnd, flows: {}, loadedMi: 0, emptyMi: 0, drawStart: c.ownerDrawFd };
    }
  } catch (e) {
    console.error(e);
  }
}

/** The hour's miles, loaded or empty by what the truck was doing as the hour began. */
function milesOf(b: CompanyBooks, t: Truck): void {
  const was = b.odo.get(t.id);
  const loaded = t.status === "loaded";
  if (was) {
    const d = t.odometer - was.odo;
    if (d > 0) {
      if (was.loaded) b.open.loadedMi += d;
      else b.open.emptyMi += d;
    }
  }
  b.odo.set(t.id, { odo: t.odometer, loaded });
}

/** The company's closed months, newest first. */
export function closedMonths(w: World, c: Company): MonthBooks[] {
  return [...(BOOKS.get(w)?.byCompany.get(c.id)?.closed ?? [])].reverse();
}
/** The month so far (what "This week" and the chip may read), or null before the company's first posting. */
export function openMonth(w: World, c: Company): Open | null {
  return BOOKS.get(w)?.byCompany.get(c.id)?.open ?? null;
}
/** R9's money events at or over guard.newsFd, newest first, since a game minute. */
export function moneyEvents(w: World, c: Company, sinceT: number, minFd = w.cfg.guard.newsFd): MoneyEvent[] {
  return (BOOKS.get(w)?.byCompany.get(c.id)?.events ?? []).filter((e) => e.t >= sinceT && e.fd >= minFd).reverse();
}

export interface MonthReport {
  closedDay: number;
  fromDay: number;
  earned: { line: (typeof EARNED)[number]; fd: number }[];
  spent: { line: (typeof SPENT)[number]; fd: number }[];
  earnedFd: number;
  spentFd: number;
  keptFd: number;
  /** Why cash moved differently, in order: the start, kept, then each other movement, to the close. */
  cashStart: number;
  /** Invoices raised this month still owed at the close, less those of earlier months paid in it (− in the sum). */
  owedChange: number;
  /** Bills the company owes at the close not yet paid, less earlier ones paid (+ in the sum). */
  payChange: number;
  moved: { line: (typeof MOVED)[number]; fd: number }[];
  cashEnd: number;
  loads: number;
  onTimePct: number | null;
  loadedMi: number;
  allMi: number;
  /** labor.owner.drawStays: the owner's draw as the driver this month, priced in break-even but kept in cash (so in kept). */
  drawFd: number;
}

/**
 * A month as its report reads it. Earned's loads are the cash in for loads plus the change in what's owed (so a load
 * delivered on the 30th and paid on the 5th counts in the month it was delivered); a brokerage's carrier pay likewise
 * with what it owes. Kept = earned − spent; cash at the start + kept − the owed change + the payable change + every
 * other movement = cash at the close, to the cent.
 */
export function monthReport(m: MonthBooks): MonthReport {
  const f = (k: BookLine) => m.flows[k] ?? 0;
  const owedChange = m.owedEnd - m.owedStart;
  const payChange = m.payEnd - m.payStart;
  const earned = EARNED.map((line) => ({ line, fd: line === "loads" ? f(line) + owedChange : f(line) }));
  const spent = SPENT.map((line) => ({ line, fd: line === "carrierPay" ? -f(line) + payChange : -f(line) }));
  const earnedFd = earned.reduce((s, r) => s + r.fd, 0);
  const spentFd = spent.reduce((s, r) => s + r.fd, 0);
  const moved = MOVED.map((line) => ({ line, fd: f(line) }));
  return {
    closedDay: m.closedDay,
    fromDay: m.fromDay,
    earned: earned.filter((r) => Math.abs(r.fd) >= 0.5),
    spent: spent.filter((r) => Math.abs(r.fd) >= 0.5),
    earnedFd,
    spentFd,
    keptFd: earnedFd - spentFd,
    cashStart: m.cashStart,
    owedChange,
    payChange,
    moved: moved.filter((r) => Math.abs(r.fd) >= 0.5),
    cashEnd: m.cashEnd,
    loads: m.loads,
    onTimePct: m.loads > 0 ? m.onTime / m.loads : null,
    loadedMi: m.loadedMi,
    allMi: m.loadedMi + m.emptyMi,
    drawFd: Math.max(0, m.drawEnd - m.drawStart),
  };
}
