/**
 * Red team, pass 2026-11-10 (ruleset 0.24.1): can a player move "usually clears near" for others? Under freight.clearsNear.ratio
 * every cleared spot load writes its rate ÷ reference under its lane and its hub, and the figure is read with a prior of five
 * clears, decayed by the day. The client's dispatcher bids at the figure (game.ts PLAYER_DISPATCHER_ORDERS: clearsNear, 0
 * over, break-even the floor), so every player's dispatcher at a hub is the victim of whoever writes that hub's clears.
 *
 * The gate's world (the sim's full population on the live levers, the seven switches of 0.24.1 on), seed 1, 364 days; two
 * player fleets at Dallas, both formed at 06:00 of day 10 with five used vans:
 *   the victim      the client's dispatcher orders (bid at the figure, floor at break-even, Book now at 20% over, reposition);
 *   the manipulator the greedy bot's orders, and by scenario:
 *     control   nothing else;
 *     high      every hour, each idle van within 300 miles of a pickup files a hand bid at the load's ceiling (the dispatcher
 *               stands down on a truck bid by hand): where nobody bids under, it wins at the ceiling and writes 1.2+ of the
 *               reference; the victim then bids higher and loses to the bots;
 *     low       its brokerage (day 91; 1% advertised, ownFirst, a 250k bond) holds every tender to the window's last hour and
 *               posts it at a 30% margin: carriers book it under the reference and write 0.7–0.85; the victim then bids
 *               lower everywhere at Dallas, the brokerage's posts included.
 * Read daily at 06:00: the Dallas hub's ratio and weight in the table, the figure ÷ reference over the open Dallas van loads,
 * and from the board's "won" events each fleet's winning rate against the reference. Read-only on the engine.
 *
 * Run: npx tsx apps/sim/src/redteam/clears.ts --scenario control,high,low --seeds 1 [--days 364] [--hub DAL] [--out runs/redteam-0241]
 *      `--compare --seeds 1` prints the table.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { buildNetwork, hubs, neutralFeeds, syntheticCassCycle } from "@lanes/data";
import {
  addTruck,
  applyAction,
  autoStaff,
  buildReport,
  clearsNear,
  companyAccount,
  contractAccount,
  createWorld,
  dayOf,
  formCompany,
  hubMiles,
  ownBand,
  partnerOf,
  placeMiles,
  receivablesOf,
  reserveHeldFd,
  stakeFd,
  stepHour,
  truckValue,
  type Company,
  type StandingOrder,
  type World,
} from "@lanes/engine";
import { populate, ruleBotHook } from "@lanes/agents";
import { liveConfig, RULES_0241, tapLedger } from "./harness.js";

const money = (n: number) => `${n < 0 ? "-" : ""}${Math.abs(n) >= 1e6 ? `${(Math.abs(n) / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `${(Math.abs(n) / 1e3).toFixed(1)}k` : Math.abs(n).toFixed(0)}`;
type Scenario = "control" | "high" | "low";
const SCENARIOS: Scenario[] = ["control", "high", "low"];
const REACH_MI = 300;
const PRICING = { start: 0.3, step: 0.03, min: 0.06, max: 0.9, band: [0.35, 0.6] as const };

/** The client's dispatcher as it bids for a player (apps/web game.ts PLAYER_DISPATCHER_ORDERS, plus its home-time rule). */
const VICTIM_ORDERS: StandingOrder[] = [
  { kind: "bid", maxDeadheadMi: 150, price: { mode: "clearsNear", pct: 0 } },
  { kind: "floor", breakEvenPlusPct: 0 },
  { kind: "reposition", afterIdleRounds: 2, to: { openLoadsWithinMi: 400 } },
  { kind: "bookNow", breakEvenPlusPct: 0.2, maxDeadheadMi: 150 },
  { kind: "homeTime", afterDays: 21, restDays: 5 },
];
/** The greedy fleet bot's orders (agents ruleBots.ts carrierProfileFor "greedy"). */
function greedyOrders(pricePct: number): StandingOrder[] {
  return [
    { kind: "bid", maxDeadheadMi: 150, price: { mode: "breakEvenPlus", pct: pricePct } },
    { kind: "floor", breakEvenPlusPct: 0.05 },
    { kind: "reposition", afterIdleRounds: 1, to: { openLoadsWithinMi: 400 } },
    { kind: "reposition", afterIdleRounds: 3, to: { openLoadsWithinMi: 1000 } },
    { kind: "bookNow", breakEvenPlusPct: 0.3, maxDeadheadMi: 150 },
    { kind: "contracts", acceptOffers: true, spotAbovePct: 0.15, maxDeadheadMi: 150 },
    { kind: "homeTime", afterDays: 28, restDays: 5 },
  ];
}
/** The high manipulator's orders: no bidding of its own, so its trucks win only by its hand bids at the ceiling. */
const handOnlyOrders = (): StandingOrder[] => greedyOrders(PRICING.start).filter((x) => x.kind !== "bid" && x.kind !== "bookNow" && x.kind !== "contracts");
class Pricer {
  pct = PRICING.start;
  moves = 0;
  private last: { truckRounds: number; wins: number };
  constructor(private c: Company) {
    this.last = { ...c.bidStats };
  }
  step(): boolean {
    const rounds = this.c.bidStats.truckRounds - this.last.truckRounds;
    if (rounds < 2) return false;
    const winRate = (this.c.bidStats.wins - this.last.wins) / rounds;
    this.last = { ...this.c.bidStats };
    const before = this.pct;
    if (winRate < PRICING.band[0]) this.pct = Math.max(PRICING.min, this.pct - PRICING.step);
    else if (winRate > PRICING.band[1]) this.pct = Math.min(PRICING.max, this.pct + PRICING.step);
    if (this.pct === before) return false;
    this.moves++;
    return true;
  }
}

function grantFleet(w: World, c: Company, trucks: number, cashFd: number): void {
  const acct = companyAccount(c.id);
  w.ledger.post(w.t, "faucet:starting_grant", acct, 100_000, `grant:stake:${c.id}`);
  stakeFd(w, c, 100_000);
  const yardBond = w.cfg.token.catalogue.items.yardSmall.bondFd;
  w.ledger.post(w.t, "faucet:starting_grant", acct, yardBond, `grant:yard:${c.id}`);
  w.ledger.post(w.t, acct, contractAccount(c.id), yardBond, `bond:yard:${c.id}`);
  c.yard = "small";
  c.yardBondFd = yardBond;
  w.ledger.post(w.t, "faucet:starting_grant", acct, cashFd, `grant:cash:${c.id}`);
  for (let k = 0; k < trucks; k++) {
    const years = k % 5;
    addTruck(w, c, "owned", k % 4 === 3 ? "highwayPro" : "workhorse", "van", false, { milesSinceRebuild: 20_000 * (k % 6), odometer: Math.max(20_000 * (k % 6), years * 100_000), builtDay: -years * 365 - 100 });
  }
  autoStaff(w, c);
  applyAction(w, c.id, { type: "set_auto_staff", on: true });
  applyAction(w, c.id, { type: "set_pay_terms", terms: "factor" });
}
function wealthOf(w: World, c: Company): number {
  let s = w.ledger.balance(companyAccount(c.id)) + (w.cfg.cashReserve.enabled ? reserveHeldFd(w, c.id) : 0) + receivablesOf(w, c.id);
  for (const t of w.trucksByCompany.get(c.id) ?? []) if (t.status !== "retired" && t.lease === "owned" && (!t.lessorId || t.lessorId === c.id)) s += truckValue(w, t);
  return s;
}
const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

interface Wins {
  n: number;
  miles: number;
  payFd: number;
  ratioSum: number; // rate ÷ reference, summed
  atCeiling: number; // wins within 0.5% of the ceiling
  byHand: number;
}
const winsZero = (): Wins => ({ n: 0, miles: 0, payFd: 0, ratioSum: 0, atCeiling: 0, byHand: 0 });

interface Opts {
  seed: number;
  days: number;
  scenario: Scenario;
  hub: string;
  margin: number;
}
interface RunOut {
  scenario: Scenario;
  seed: number;
  days: number;
  hub: string;
  victim: Record<string, unknown>;
  manipulator: Record<string, unknown>;
  figure: Record<string, unknown>;
  hubBots: Record<string, unknown>;
  world: Record<string, unknown>;
}

function runScenario(o: Opts): RunOut {
  const cfg = liveConfig(RULES_0241);
  const net = buildNetwork(hubs, cfg);
  const feeds = { ...neutralFeeds, cycle: syntheticCassCycle({ seed: o.seed }) };
  const w = createWorld({ cfg, net, feeds, seed: o.seed });
  populate(w, { freeOwnerOperators: 400, fleets: 120, brokers: 60 });
  const hubIdx = w.net.hubs.findIndex((h) => h.id === o.hub);
  if (hubIdx < 0) throw new Error(`no hub ${o.hub}`);
  const nearIdx = new Set<number>();
  for (let i = 0; i < w.net.hubs.length; i++) if (hubMiles(w, hubIdx, i) <= REACH_MI) nearIdx.add(i);
  let victim: Company | null = null;
  let manip: Company | null = null;
  let broker: Company | null = null;
  const vAccts = new Set<string>();
  const mAccts = new Set<string>();
  const taps = tapLedger(w, (from, to) => {
    const side = vAccts.has(to) && !vAccts.has(from) ? "v" : mAccts.has(to) && !mAccts.has(from) ? "m" : null;
    if (side && from.startsWith("faucet:")) return `${side}:in:${from.slice(7)}`;
    if (side && /^co:\d+$/.test(from)) return `${side}:in:company`;
    if (mAccts.has(from) && /^co:\d+$/.test(to) && !mAccts.has(to)) return "m:out:carriers";
    return null;
  });
  // The board's "won" events: every fleet's winning rate against the load's reference (the ratio the table writes).
  const wins = new Map<number, Wins>();
  const hubWins = winsZero(); // every carrier's wins on loads out of the hub (what the table at the hub sees)
  w.listener = (ev) => {
    if (ev.kind !== "won") return;
    const load = w.loads.get(ev.loadId);
    if (!load) return;
    const base = load.refRate * (load.hot || 1);
    const add = (x: Wins) => {
      x.n++;
      x.miles += load.miles;
      x.payFd += ev.rate * load.miles;
      x.ratioSum += ev.rate / base;
      if (ev.rate >= load.ceiling * 0.995) x.atCeiling++;
      if (ev.manual) x.byHand++;
    };
    let x = wins.get(ev.companyId);
    if (!x) wins.set(ev.companyId, (x = winsZero()));
    add(x);
    if (load.origin === hubIdx && load.equipment === "van") add(hubWins);
  };
  let mPricer: Pricer | null = null;
  let vStart = 0;
  let mStart = 0;
  let formedDay = 0;
  let handBids = 0;
  let handRefused = 0;
  let heldPosts = 0;
  let ownTenders = 0;
  let brokerDay = 0;
  // The figure at 06:00: the hub's table entry (ratio, weight), and the figure ÷ reference over the open van loads out of the hub.
  const figure: [number, number, number, number, number][] = []; // day, hubRatio, hubWeight, median figure÷ref, open loads
  const minutesPerDay = w.cfg.time.gameMinutesPerDay;
  const hours = (o.days * minutesPerDay) / 60;
  let seenDays = w.metrics.days.length;
  for (let h = 0; h < hours; h++) {
    stepHour(w, ruleBotHook);
    const day = dayOf(w.t, w.cfg);
    if (w.t % minutesPerDay === 6 * 60) {
      const key = `${hubIdx}:van`;
      const e = w.clears?.ratio ? w.clears.hub[key] : undefined;
      const d = w.clears?.ratio ? w.clears.hub[`${key}|decay`] : undefined;
      const ratios: number[] = [];
      let open = 0;
      for (const l of w.loads.values()) {
        if (l.status !== "open" || l.equipment !== "van" || l.origin !== hubIdx) continue;
        open++;
        ratios.push(clearsNear(w, l) / (l.refRate * (l.hot || 1)));
      }
      figure.push([day, e ? +e[0].toFixed(3) : 1, d ? +d[0].toFixed(2) : e ? e[1] : 0, +median(ratios).toFixed(3), open]);
      if (!victim && day >= 10) {
        victim = formCompany(w, { name: "Victim Freight", role: "carrier", homeHubId: o.hub, strategy: "player:victim", orders: VICTIM_ORDERS, freePath: false, human: true, authorityAgeDays: 1500 });
        grantFleet(w, victim, 5, 400_000);
        vAccts.add(companyAccount(victim.id));
        vStart = wealthOf(w, victim);
        // The high manipulator bids by hand only (no bid, Book now or contract order), so every win it writes is a ceiling bid.
        manip = formCompany(w, { name: "Red Team Dallas", role: "carrier", homeHubId: o.hub, strategy: "player:redteam2", orders: o.scenario === "high" ? handOnlyOrders() : greedyOrders(PRICING.start), freePath: false, human: true, authorityAgeDays: 1500 });
        grantFleet(w, manip, 5, o.scenario === "low" ? 1_000_000 : 400_000);
        mAccts.add(companyAccount(manip.id));
        mPricer = new Pricer(manip);
        mStart = wealthOf(w, manip);
        formedDay = day;
      }
    }
    // Hourly, the high manipulator: a hand bid at the ceiling from every idle van on the dearest open load within reach.
    if (manip && o.scenario === "high" && manip.liquidatingSince === null) {
      for (const t of w.trucksByCompany.get(manip.id) ?? []) {
        if (t.status !== "idle" || !t.driverId || t.trailer !== "van" || w.manualBids.has(t.id)) continue;
        let best: { id: number; v: number } | null = null;
        for (const l of w.loads.values()) {
          if (l.status !== "open" || l.equipment !== "van" || !nearIdx.has(l.origin) || l.brokerId === manip.id) continue;
          if (placeMiles(w, t.place, l.originPlace) > REACH_MI) continue;
          const v = l.ceiling * l.miles;
          if (!best || v > best.v) best = { id: l.id, v };
        }
        if (!best) continue;
        const l = w.loads.get(best.id)!;
        if (applyAction(w, manip.id, { type: "place_bid", truckId: t.id, loadId: l.id, rate: l.ceiling }).ok) handBids++;
        else handRefused++;
      }
    }
    // Hourly, the low manipulator's brokerage: own truck at the pickup takes the hold at the band's top; else the hold runs to its
    // last hour and is posted at the margin.
    if (broker && manip && broker.liquidatingSince === null) {
      const fleet = w.trucksByCompany.get(manip.id) ?? [];
      for (const load of [...w.loads.values()]) {
        if (load.brokerId !== broker.id || load.status !== "open" || load.tenderedTo !== 0 || load.passedBy === manip.id || !load.hold || load.hold.brokerId !== broker.id) continue;
        const truck = fleet.find((t) => t.status === "idle" && t.hub === load.origin && t.trailer === load.equipment && t.driverId);
        if (truck) {
          const [, hi] = ownBand(w, load);
          if (applyAction(w, broker.id, { type: "tender_own", loadId: load.id, rate: hi }).ok && applyAction(w, manip.id, { type: "accept_tender", truckId: truck.id, loadId: load.id }).ok) ownTenders++;
          continue;
        }
        if (load.hold.until - w.t <= 60 && applyAction(w, broker.id, { type: "post_tender", loadId: load.id, marginPct: o.margin }).ok) heldPosts++;
      }
    }
    if (w.metrics.days.length === seenDays) continue;
    seenDays = w.metrics.days.length;
    if (o.scenario === "low" && manip && !broker && day >= 91 && manip.liquidatingSince === null) {
      const r = applyAction(w, manip.id, { type: "form_brokerage", name: "Red Team Dallas Logistics", capitalFd: 300_000 });
      if (r.ok && (broker = partnerOf(w, manip))) {
        brokerDay = day;
        mAccts.add(companyAccount(broker.id));
        applyAction(w, broker.id, { type: "set_standing_orders", orders: [{ kind: "broker", marginPct: 0.01, maxOpenLoads: 100, ownFirst: true }] });
        applyAction(w, broker.id, { type: "stake_fd", fd: 250_000 });
      }
    }
    if (manip && mPricer && o.scenario !== "high" && manip.liquidatingSince === null && mPricer.step()) applyAction(w, manip.id, { type: "set_standing_orders", orders: greedyOrders(mPricer.pct) });
  }
  const report = buildReport(w);
  const get = (k: string) => taps.get(k) ?? 0;
  const fleetOut = (c: Company | null, side: "v" | "m", start: number, b: Company | null): Record<string, unknown> => {
    if (!c) return {};
    const x = wins.get(c.id) ?? winsZero();
    const end = wealthOf(w, c) + (b ? wealthOf(w, b) + b.stakedFd : 0);
    const days = o.days - formedDay;
    return {
      liquidated: c.liquidatingSince !== null ? 1 : 0,
      trucks: (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired").length,
      gainPerDayFd: Math.round((end - start) / Math.max(1, days)),
      endWealthFd: Math.round(end),
      cashFd: Math.round(w.ledger.balance(companyAccount(c.id))),
      operatingFd: Math.round(c.operating.revenueFd - c.operating.costFd + (b ? b.operating.revenueFd - b.operating.costFd : 0)),
      loadsWon: x.n,
      wonByHand: x.byHand,
      wonAtCeiling: x.atCeiling,
      wonRatioMean: x.n ? +(x.ratioSum / x.n).toFixed(3) : null,
      wonPayPerMile: x.miles ? +(x.payFd / x.miles).toFixed(3) : null,
      wonPayFd: Math.round(x.payFd),
      truckRounds: c.bidStats.truckRounds,
      winRate: c.bidStats.truckRounds ? +(c.bidStats.wins / c.bidStats.truckRounds).toFixed(3) : null,
      inNpcFreightFd: Math.round(get(`${side}:in:npc_shipper`) + get(`${side}:in:npc_factor`) + get(`${side}:in:npc_lessor`)),
      inBrokerFd: Math.round(get(`${side}:in:company`)),
      brokerCashFd: b ? Math.round(w.ledger.balance(companyAccount(b.id))) : 0,
      brokerStakedFd: b ? Math.round(b.stakedFd) : 0,
      outToCarriersFd: Math.round(get("m:out:carriers")),
    };
  };
  const monthly = (k: 1 | 2 | 3 | 4) => Array.from({ length: Math.ceil(o.days / 30) }, (_, m) => {
    const xs = figure.filter((f) => f[0] >= m * 30 && f[0] < (m + 1) * 30).map((f) => f[k]);
    return xs.length ? +median(xs).toFixed(k === 4 ? 0 : 3) : null;
  });
  const hubBotsAll = w.companies.filter((c) => c.role === "carrier" && !c.human && !c.strategy.startsWith("player:") && nearIdx.has(c.homeHub));
  return {
    scenario: o.scenario,
    seed: o.seed,
    days: o.days,
    hub: o.hub,
    victim: { formedDay, ...fleetOut(victim, "v", vStart, null) },
    manipulator: { formedDay, handBids, handRefused, brokerDay, ownTenders, heldPosts, margin: o.margin, bidPctEnd: mPricer ? +mPricer.pct.toFixed(2) : null, ...fleetOut(manip, "m", mStart, broker) },
    figure: {
      hubRatioByMonth: monthly(1),
      hubWeightByMonth: monthly(2),
      figureOverRefByMonth: monthly(3),
      openByMonth: monthly(4),
      hubWins: { n: hubWins.n, ratioMean: hubWins.n ? +(hubWins.ratioSum / hubWins.n).toFixed(3) : null, atCeiling: hubWins.atCeiling, byHand: hubWins.byHand, perDay: +(hubWins.n / o.days).toFixed(2) },
      days: figure,
    },
    hubBots: { companies: hubBotsAll.length, failed: hubBotsAll.filter((c) => c.liquidatingSince !== null || c.retiredDay !== undefined).length, medianCashFd: Math.round(median(hubBotsAll.map((c) => w.ledger.balance(companyAccount(c.id))))), loadsWon: hubBotsAll.reduce((s, c) => s + c.bidStats.wins, 0) },
    world: {
      npcPaidFd: Math.round(w.ledger.npcPaidFd()),
      companies: report.companies,
      failures: { bankruptcies: report.failures.bankruptcies, inDebtAtEnd: report.failures.inDebtAtEnd },
      board: report.board,
      emissionTotals: report.emission?.totals ?? null,
    },
  };
}

function line(r: RunOut): string {
  const v = r.victim as Record<string, number>;
  const m = r.manipulator as Record<string, number>;
  const f = r.figure as { hubRatioByMonth: (number | null)[]; figureOverRefByMonth: (number | null)[]; hubWins: { n: number; ratioMean: number; perDay: number } };
  return (
    `${r.scenario.padEnd(7)} s${r.seed} ${r.days}d ${r.hub} · victim ${money(v.gainPerDayFd!)}/day, won ${v.loadsWon} at ${v.wonRatioMean}× ref (${v.wonPayPerMile} FD/mi), win rate ${v.winRate}` +
    ` · manipulator ${money(m.gainPerDayFd!)}/day, won ${m.loadsWon} (${m.wonByHand} by hand, ${m.wonAtCeiling} at the ceiling) at ${m.wonRatioMean}× ref; hand bids ${m.handBids}, held posts ${m.heldPosts}, own tenders ${m.ownTenders}` +
    ` · hub ratio by month ${f.hubRatioByMonth.join("/")} · figure÷ref ${f.figureOverRefByMonth.join("/")} · hub clears ${f.hubWins.perDay}/day at ${f.hubWins.ratioMean}× ref`
  );
}

function compare(outDir: string, seeds: number[]): void {
  for (const seed of seeds) {
    const rows = SCENARIOS.map((s) => {
      const f = `${outDir}/clears-${s}-seed${seed}.json`;
      return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as RunOut) : null;
    }).filter((x): x is RunOut => x !== null);
    if (rows.length === 0) continue;
    const fmt = (v: unknown) => String(typeof v === "number" && Math.abs(v) >= 1000 ? money(v) : typeof v === "number" ? +v.toFixed(3) : Array.isArray(v) ? v.join("/") : v).padStart(14);
    const section = (title: string, pick: (r: RunOut) => Record<string, unknown>, keys: string[]) => {
      console.log([title.padEnd(22), ...rows.map((r) => r.scenario.padStart(14))].join(" "));
      for (const k of keys) console.log([k.slice(-22).padEnd(22), ...rows.map((r) => fmt(k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], pick(r))))].join(" "));
    };
    console.log(`\nseed ${seed}`);
    const fk = ["gainPerDayFd", "endWealthFd", "operatingFd", "cashFd", "loadsWon", "wonByHand", "wonAtCeiling", "wonRatioMean", "wonPayPerMile", "wonPayFd", "winRate", "truckRounds", "inNpcFreightFd", "inBrokerFd", "trucks", "liquidated"];
    section("victim", (r) => r.victim, fk);
    section("manipulator", (r) => r.manipulator, ["handBids", "handRefused", "brokerDay", "ownTenders", "heldPosts", "brokerCashFd", "brokerStakedFd", "outToCarriersFd", "bidPctEnd", ...fk]);
    section("figure at the hub", (r) => r.figure, ["hubRatioByMonth", "hubWeightByMonth", "figureOverRefByMonth", "openByMonth", "hubWins.n", "hubWins.perDay", "hubWins.ratioMean", "hubWins.atCeiling", "hubWins.byHand"]);
    section("hub bots", (r) => r.hubBots, ["companies", "failed", "medianCashFd", "loadsWon"]);
    section("world", (r) => r.world, ["npcPaidFd", "companies", "failures.bankruptcies", "failures.inDebtAtEnd", "board.cleared", "board.avgClearedRate"]);
  }
}

function main(): void {
  const { values } = parseArgs({
    options: {
      scenario: { type: "string", default: "control" },
      seeds: { type: "string", default: "1" },
      days: { type: "string", default: "364" },
      hub: { type: "string", default: "DAL" },
      margin: { type: "string", default: "0.3" },
      out: { type: "string", default: "runs/redteam-0241" },
      compare: { type: "boolean", default: false },
    },
  });
  const seeds = values.seeds!.split(",").map(Number);
  mkdirSync(values.out!, { recursive: true });
  if (values.compare) {
    compare(values.out!, seeds);
    return;
  }
  const scenarios = (values.scenario === "all" ? SCENARIOS : (values.scenario!.split(",") as Scenario[])).filter((s) => SCENARIOS.includes(s));
  console.log(`REDTEAM · 0.24.1 clears-near manipulation · ${scenarios.join(",")} · seeds ${seeds.join(",")} · ${values.days} days · hub ${values.hub}`);
  for (const scenario of scenarios) {
    for (const seed of seeds) {
      const t0 = performance.now();
      const r = runScenario({ seed, days: Number(values.days), scenario, hub: values.hub!, margin: Number(values.margin) });
      writeFileSync(`${values.out}/clears-${scenario}-seed${seed}.json`, JSON.stringify(r, null, 1));
      console.log(`${line(r)} · ${((performance.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
}

main();
