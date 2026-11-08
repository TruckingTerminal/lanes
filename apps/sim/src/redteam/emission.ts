/**
 * Red team, pass 2026-11-08: the emission cap (token.emission, economy-emission.md "Retune"; the report is
 * studio/reviews/redteam-emission.md). A many-truck player in the gate's world (the sim's full population, the cap on
 * with the provisional flat subsidy) tries to take NPC money out faster than the cap's levers can cut, and the same
 * player running honestly is the control. Read-only on the engine: the attacker is driven through applyAction, the
 * trucks and the stake are granted the way `populate` grants an established fleet's, and the ledger is read through a tap.
 *
 * Scenarios (--scenario, comma list or "all"):
 *   control   a 30-truck fleet (the greedy bot's orders) hauling NPC freight like everyone else;
 *   facility  the same fleet buys six warehouses at its hub on day 28 and books its own freight onto its own trucks
 *             every hour, so the NPC market pays it for the goods (faucet:npc_market) outside the budget;
 *   timing    the same fleet reads the lever product daily and grabs volume (bids and book-now near break-even) while
 *             rates are whole, going picky (the greedy pricing) once the rate lever is cutting;
 *   brokerage the same fleet forms a brokerage on day 91 (brokerage.enabled is live) posting a 1% margin, so NPC shippers
 *             tender it ~64× a bot's share, and tenders every load it gets to its own carrier at the band's high end: the
 *             contract index the rate lever never reaches, kept in the family.
 * Detention is measured in every run from the ledger tap (the world's and the attacker's).
 *
 * Run:  npx tsx apps/sim/src/redteam/emission.ts --scenario all --seeds 1,2 --days 365 [--trucks 30] [--cap off]
 *       [--set path=value ...] [--out runs/redteam-emission]
 * Each run writes <out>/<scenario>-seed<N>.json and prints one line; `--compare` prints the scenarios side by side
 * from the JSON already written (no sim).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { buildNetwork, hubs, neutralFeeds, syntheticCassCycle } from "@lanes/data";
import {
  addTruck,
  applyAction,
  autoStaff,
  buildReport,
  companyAccount,
  contractAccount,
  createWorld,
  dayOf,
  formCompany,
  ownBand,
  partnerOf,
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
import { liveConfig, tapLedger } from "./harness.js";

/** The cap as the producer holds it for this pass: R net, the balance dial one-way, the flat 4M-a-month subsidy (provisional). */
export const CAP_LEVERS: Record<string, unknown> = {
  "token.emission.enabled": true,
  "token.emission.refill": 1,
  "token.emission.refillNet": true,
  "token.emission.dialOneWay": true,
  "token.emission.subsidy.firstMonthFd": 4_000_000,
  "token.emission.subsidy.totalFd": 2_000_000_000,
};

const money = (n: number) => `${n < 0 ? "-" : ""}${Math.abs(n) >= 1e6 ? `${(Math.abs(n) / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `${(Math.abs(n) / 1e3).toFixed(1)}k` : Math.abs(n).toFixed(0)}`;

type Scenario = "control" | "facility" | "facilityhome" | "timing" | "brokerage";
const SCENARIOS: Scenario[] = ["control", "facility", "facilityhome", "timing", "brokerage"];
const isRing = (s: Scenario) => s === "facility" || s === "facilityhome";

/** The greedy bot's adaptive pricing (agents ruleBots.ts adaptPricing): the bid's margin over break-even moves 3 points a day to keep the win rate in [0.35, 0.6]. */
const PRICING = { start: 0.3, step: 0.03, min: 0.06, max: 0.9, band: [0.35, 0.6] as const };

/** The greedy fleet bot's orders (agents ruleBots.ts carrierProfileFor "greedy"), so the control is a bot-grade fleet. */
function greedyOrders(pricePct = 0.3, bookPct = 0.3): StandingOrder[] {
  return [
    { kind: "bid", maxDeadheadMi: 150, price: { mode: "breakEvenPlus", pct: pricePct } },
    { kind: "floor", breakEvenPlusPct: 0.05 },
    { kind: "reposition", afterIdleRounds: 1, to: { openLoadsWithinMi: 400 } },
    { kind: "reposition", afterIdleRounds: 3, to: { openLoadsWithinMi: 1000 } },
    { kind: "bookNow", breakEvenPlusPct: bookPct, maxDeadheadMi: 150 },
    { kind: "contracts", acceptOffers: true, spotAbovePct: 0.15, maxDeadheadMi: 150 },
    { kind: "homeTime", afterDays: 28, restDays: 5 },
  ];
}

/** The home-bound ring's standing orders: bid anywhere, but an idle truck comes straight home, where the facilities' freight is booked onto it. */
function homeOrders(home: string, pricePct: number, bookPct = 0.3): StandingOrder[] {
  return [
    { kind: "bid", maxDeadheadMi: 150, price: { mode: "breakEvenPlus", pct: pricePct } },
    { kind: "floor", breakEvenPlusPct: 0.05 },
    { kind: "reposition", afterIdleRounds: 1, to: { hubId: home } },
    { kind: "bookNow", breakEvenPlusPct: bookPct, maxDeadheadMi: 150 },
    { kind: "contracts", acceptOffers: true, spotAbovePct: 0.15, maxDeadheadMi: 150 },
    { kind: "homeTime", afterDays: 28, restDays: 5 },
  ];
}

interface Opts {
  seed: number;
  days: number;
  trucks: number;
  cap: boolean;
  sets: string[];
  scenario: Scenario;
  grantFd: number;
  /** brokerage: the margin held tenders are posted to the board at when no own truck is there (0: the hold runs out at the advertised margin). */
  postMargin: number;
}

/** The gate's world: the sim's full population on the live profile, the cap on (or off), the attacker formed on day 0. */
function buildWorld(o: Opts): { w: World; attacker: Company; home: string } {
  const overrides: Record<string, unknown> = o.cap ? { ...CAP_LEVERS } : {};
  for (const s of o.sets) {
    const eq = s.indexOf("=");
    const raw = s.slice(eq + 1);
    overrides[s.slice(0, eq)] = raw === "true" ? true : raw === "false" ? false : raw.startsWith("[") ? JSON.parse(raw) : Number.isNaN(Number(raw)) ? raw : Number(raw);
  }
  const cfg = liveConfig(overrides);
  const net = buildNetwork(hubs, cfg);
  const feeds = { ...neutralFeeds, cycle: syntheticCassCycle({ seed: o.seed }) };
  const w = createWorld({ cfg, net, feeds, seed: o.seed });
  populate(w, { freeOwnerOperators: 400, fleets: 120, brokers: 60 });
  // The attacker's home: the biggest starter hub.
  const home = w.net.hubs[w.net.starterIdx.reduce((a, b) => (w.net.hubs[a]!.weight >= w.net.hubs[b]!.weight ? a : b))]!.id;
  const attacker = formCompany(w, {
    name: "Red Team Freight",
    role: "carrier",
    homeHubId: home,
    strategy: "player:redteam", // a player: the population dial and the beta's AI fleet cap leave it alone
    orders: greedyOrders(),
    freePath: false,
    human: true,
    authorityAgeDays: 1500,
  });
  const acct = companyAccount(attacker.id);
  // An established fleet's footing, as populate grants it: the stake for 30 trucks and 6 facilities, a large yard's bond, working capital.
  const stake = 100_000;
  w.ledger.post(w.t, "faucet:starting_grant", acct, stake, `grant:stake:${attacker.id}`);
  stakeFd(w, attacker, stake);
  const yardBond = w.cfg.token.catalogue.items.yardLarge.bondFd;
  w.ledger.post(w.t, "faucet:starting_grant", acct, yardBond, `grant:yard:${attacker.id}`);
  w.ledger.post(w.t, acct, contractAccount(attacker.id), yardBond, `bond:yard:${attacker.id}`);
  attacker.yard = "large";
  attacker.yardBondFd = yardBond;
  w.ledger.post(w.t, "faucet:starting_grant", acct, o.grantFd, `grant:cash:${attacker.id}`);
  for (let k = 0; k < o.trucks; k++) {
    const years = k % 5;
    addTruck(w, attacker, "owned", k % 4 === 3 ? "highwayPro" : "workhorse", "van", false, { milesSinceRebuild: 20_000 * (k % 6), odometer: Math.max(20_000 * (k % 6), years * 100_000), builtDay: -years * 365 - 100 });
  }
  autoStaff(w, attacker);
  applyAction(w, attacker.id, { type: "set_auto_staff", on: true });
  applyAction(w, attacker.id, { type: "set_pay_terms", terms: "factor" }); // the contract every bot signs: paid on delivery through the NPC factor
  return { w, attacker, home };
}

interface RunOut {
  scenario: Scenario;
  seed: number;
  days: number;
  cap: boolean;
  trucks: number;
  home: string;
  attacker: Record<string, number | string>;
  world: Record<string, unknown>;
}

function runScenario(o: Opts): RunOut {
  const { w, attacker, home } = buildWorld(o);
  const acct = companyAccount(attacker.id);
  const startWealth = wealthOf(w, attacker);
  // The attacker's accounts: the carrier's, and its brokerage's once formed (one person, as the rules count it).
  const accts = new Set<string>([acct]);
  let broker: Company | null = null;
  // The tap: what reaches the attacker, by source; and the world's detention and NPC market pay. A facility's sale is known by
  // its load's shipper, not by its tag: under the factoring contract the NPC factor advances it as faucet:npc_factor (the same
  // tag as freight pay), and faucet:npc_market shows only for payees on net terms.
  const saleOf = (ref: string) => {
    const m = /^load:(\d+)$/.exec(ref);
    const l = m ? w.loads.get(Number(m[1])) : undefined;
    return l && l.shipperId !== null ? l : null;
  };
  const taps = tapLedger(w, (from, to, ref) => {
    if (from.startsWith("faucet:")) {
      // The sale reaches the shipper; an NPC lessor's advance to the carrier on the same load (faucet:npc_advance) is not a sale.
      const l = saleOf(ref);
      if (l && to === companyAccount(l.shipperId!)) return accts.has(to) ? "in:npc_market_sale" : "world:npc_market_sale";
    }
    if (accts.has(to) && !accts.has(from)) {
      if (from.startsWith("faucet:")) return `in:${from.slice(7)}${ref.startsWith("detention:") ? ":detention" : ""}`;
      if (/^co:\d+$/.test(from)) return ref.startsWith("receivable:") || ref.startsWith("load:") || ref.startsWith("rebroker:") || ref.startsWith("detention:") ? "in:broker" : "in:company";
      return null;
    }
    if (accts.has(from) && to.startsWith("sink:")) return `out:${to.slice(5)}`;
    if (accts.has(from) && /^co:\d+$/.test(to) && !accts.has(to)) return "out:carriers"; // the ring's or the brokerage's hauling paid to others
    if (from === "faucet:npc_shipper" && ref.startsWith("detention:")) return "world:detention";
    if (from === "faucet:npc_market") return "world:npc_market";
    return null;
  });
  let facilities = 0;
  let ownBooked = 0;
  let ownBookRefused = 0;
  let timingSwitches = 0;
  let grabDays = 0;
  let ownTenders = 0;
  let ownTenderRefused = 0;
  let brokerDay = 0;
  let baitPosts = 0;
  // Pricing, the bot's way: the bid margin adapts daily to the win rate; the orders are rebuilt from it when it moves.
  let pct = PRICING.start;
  let lastStats = { ...attacker.bidStats };
  let pctMoves = 0;
  const ordersFor = (p: number, bookPct = 0.3): StandingOrder[] => (o.scenario === "facilityhome" && facilities > 0 ? homeOrders(home, p, bookPct) : greedyOrders(p, bookPct));
  const setOrders = (p: number, bookPct = 0.3) => applyAction(w, attacker.id, { type: "set_standing_orders", orders: ordersFor(p, bookPct) });
  let lastMode: "grab" | "picky" | null = null;
  const hours = (o.days * w.cfg.time.gameMinutesPerDay) / 60;
  let seenDays = w.metrics.days.length;
  for (let h = 0; h < hours; h++) {
    stepHour(w, ruleBotHook);
    const day = dayOf(w.t, w.cfg);
    if (attacker.liquidatingSince !== null) continue;
    // Hourly: the facility ring books its own open freight onto its own idle trucks at the facility's hub.
    if (isRing(o.scenario) && facilities > 0) {
      const fleet = w.trucksByCompany.get(attacker.id) ?? [];
      for (const load of w.loads.values()) {
        if (load.shipperId !== attacker.id || load.status !== "open") continue;
        const truck = fleet.find((t) => t.status === "idle" && t.hub === load.origin && t.trailer === load.equipment && t.driverId);
        if (!truck) continue;
        const r = applyAction(w, attacker.id, { type: "book_load", truckId: truck.id, loadId: load.id });
        if (r.ok) ownBooked++;
        else ownBookRefused++;
      }
    }
    // Hourly: the brokerage tenders every shipper load it holds to its own carrier at the band's high end, and the carrier takes it.
    if (broker && broker.liquidatingSince === null) {
      const fleet = w.trucksByCompany.get(attacker.id) ?? [];
      for (const load of [...w.loads.values()]) {
        if (load.brokerId !== broker.id || load.status !== "open" || load.tenderedTo !== 0 || load.passedBy === attacker.id) continue;
        const truck = fleet.find((t) => t.status === "idle" && t.hub === load.origin && t.trailer === load.equipment && t.driverId);
        if (!truck) {
          // No truck of its own there: with --postMargin the brokerage posts the held tender to the board at that margin (the
          // shippers picked it by the 1% its standing order advertises; post_tender takes any margin), else it goes at the hold's end.
          if (o.postMargin > 0 && load.hold && load.hold.brokerId === broker.id && applyAction(w, broker.id, { type: "post_tender", loadId: load.id, marginPct: o.postMargin }).ok) baitPosts++;
          continue;
        }
        const [, hi] = ownBand(w, load);
        if (!applyAction(w, broker.id, { type: "tender_own", loadId: load.id, rate: hi }).ok) {
          ownTenderRefused++;
          continue;
        }
        if (applyAction(w, attacker.id, { type: "accept_tender", truckId: truck.id, loadId: load.id }).ok) ownTenders++;
        else ownTenderRefused++;
      }
    }
    if (w.metrics.days.length === seenDays) continue;
    seenDays = w.metrics.days.length;
    // Daily, after the day closed.
    if (o.scenario === "brokerage" && !broker && day >= 91) {
      const r = applyAction(w, attacker.id, { type: "form_brokerage", name: "Red Team Logistics", capitalFd: 1_300_000 });
      if (r.ok) {
        broker = partnerOf(w, attacker);
        if (broker) {
          brokerDay = day;
          accts.add(companyAccount(broker.id));
          // A thin margin wins the shippers' tenders (weights ∝ 1 ÷ margin²); a whale's bond lifts the AP cap on what it may owe and post.
          applyAction(w, broker.id, { type: "set_standing_orders", orders: [{ kind: "broker", marginPct: 0.01, maxOpenLoads: 200 }] });
          applyAction(w, broker.id, { type: "stake_fd", fd: 1_000_000 });
        }
      }
    }
    // The bot's pricing step: the bid margin follows the day's win rate (not while the timing fleet is in its grab mode).
    {
      const rounds = attacker.bidStats.truckRounds - lastStats.truckRounds;
      if (rounds >= 2) {
        const winRate = (attacker.bidStats.wins - lastStats.wins) / rounds;
        lastStats = { ...attacker.bidStats };
        const before = pct;
        if (winRate < PRICING.band[0]) pct = Math.max(PRICING.min, pct - PRICING.step);
        else if (winRate > PRICING.band[1]) pct = Math.min(PRICING.max, pct + PRICING.step);
        if (pct !== before && lastMode !== "grab") {
          pctMoves++;
          setOrders(pct);
        }
      }
    }
    if (isRing(o.scenario) && facilities < 6 && day >= 28) {
      const had = facilities;
      for (let k = facilities; k < 6; k++) {
        const r = applyAction(w, attacker.id, { type: "buy_facility", facility: "warehouse", hubId: home });
        if (!r.ok) break;
        facilities++;
      }
      if (had === 0 && facilities > 0 && o.scenario === "facilityhome") setOrders(pct); // the orders now bring idle trucks home
    }
    if (o.scenario === "timing") {
      // Rates whole (the rate lever not cutting): grab volume near break-even; the rate lever cutting: the adaptive margin.
      const mode: "grab" | "picky" = w.emission.rateMult >= 0.99 ? "grab" : "picky";
      if (mode === "grab") grabDays++;
      if (mode !== lastMode) {
        timingSwitches++;
        lastMode = mode;
        if (mode === "grab") setOrders(0.05, 0.03);
        else setOrders(pct);
      }
    }
  }
  const report = buildReport(w);
  const get = (k: string) => taps.get(k) ?? 0;
  const inNpc = get("in:npc_shipper") + get("in:npc_factor") + get("in:npc_lessor");
  const npcPaid = w.ledger.npcPaidFd();
  const fleet = w.trucksByCompany.get(attacker.id) ?? [];
  const endWealth = wealthOf(w, attacker) + (broker ? wealthOf(w, broker) + broker.stakedFd : 0); // the pair is one person; the brokerage's bond is its capital too
  const em = report.emission!; // the cap's count runs with the cap off too (emission.ts), so the section is always there
  const months = em.months.map((m) => ({ m: m.month, budget: Math.round(m.budgetFd), committed: Math.round(m.committedFd), vol: +m.volMult.toFixed(3), rate: +m.rateMult.toFixed(3), carry: Math.round(m.carryFd) }));
  const inTags = [...taps.keys()].filter((k) => k.startsWith("in:")).sort();
  const outTags = [...taps.keys()].filter((k) => k.startsWith("out:")).sort();
  const brokeredLog = w.factoringLog?.brokered ?? { loads: 0, payFd: 0, miles: 0 };
  const directLog = w.factoringLog?.direct ?? { loads: 0, payFd: 0, miles: 0 };
  const strat = report.byStrategy as Record<string, Record<string, { medianCashFd?: number; companies?: number }>>;
  const medians: Record<string, number> = {};
  for (const [seg, by] of Object.entries(strat ?? {})) for (const [s, v] of Object.entries(by)) if (v && typeof v.medianCashFd === "number") medians[`${seg}:${s}`] = Math.round(v.medianCashFd);
  const out: RunOut = {
    scenario: o.scenario,
    seed: o.seed,
    days: o.days,
    cap: o.cap,
    trucks: o.trucks,
    home,
    attacker: {
      name: attacker.name,
      liquidated: attacker.liquidatingSince !== null ? 1 : 0,
      bankruptcies: attacker.bankruptcies, // an insolvency sale during the run leaves the company trading with what was left (the ring's case)
      trucks: fleet.filter((t) => t.status !== "retired").length,
      facilities,
      ownBooked,
      ownBookRefused,
      timingSwitches,
      grabDays,
      brokerDay,
      ownTenders,
      ownTenderRefused,
      baitPosts,
      postMargin: o.postMargin,
      bidPctEnd: +pct.toFixed(2),
      pctMoves,
      operatingFd: Math.round(attacker.operating.revenueFd - attacker.operating.costFd + (broker ? broker.operating.revenueFd - broker.operating.costFd : 0)),
      brokerCashFd: broker ? Math.round(w.ledger.balance(companyAccount(broker.id))) : 0,
      brokerStakedFd: broker ? Math.round(broker.stakedFd) : 0,
      brokerLiquidated: broker && broker.liquidatingSince !== null ? 1 : 0,
      cashFd: Math.round(w.ledger.balance(acct)),
      startWealthFd: Math.round(startWealth),
      endWealthFd: Math.round(endWealth),
      gainPerDayFd: Math.round((endWealth - startWealth) / o.days),
      revenueFd: Math.round(attacker.operating.revenueFd),
      costFd: Math.round(attacker.operating.costFd),
      inNpcFreightFd: Math.round(inNpc),
      inBrokerFd: Math.round(get("in:broker")),
      inNpcMarketFd: Math.round(get("in:npc_market_sale") + get("in:npc_market")),
      inDetentionFd: Math.round(get("in:npc_shipper:detention")),
      outToCarriersFd: Math.round(get("out:carriers")),
      shareOfNpcPaid: +(inNpc / Math.max(1, npcPaid)).toFixed(4),
      ...Object.fromEntries(inTags.map((k) => [k, Math.round(get(k))])),
      ...Object.fromEntries(outTags.map((k) => [k, Math.round(get(k))])),
    },
    world: {
      npcPaidFd: Math.round(npcPaid),
      detentionFd: Math.round(get("world:detention")),
      npcMarketFd: Math.round(get("world:npc_market_sale") + get("in:npc_market_sale") + get("world:npc_market") + get("in:npc_market")),
      emissionTotals: em.totals,
      months,
      pay: em.pay,
      companies: report.companies,
      trucks: report.trucks,
      carriersBySegment: Object.fromEntries(Object.entries(report.carriersBySegment).map(([k, v]) => [k, { companies: v.companies, trucks: v.trucks }])),
      failures: { bankruptcies: report.failures.bankruptcies, inDebtAtEnd: report.failures.inDebtAtEnd, debtFd: Math.round(report.failures.debtFd), bankruptBySegment: report.failures.bankruptBySegment },
      board: report.board,
      quarters: report.quarters.map((q) => ({ label: q.label, ratio: +q.sinkFaucetRatio.toFixed(3), faucetFd: Math.round(q.faucetFd), sinkFd: Math.round(q.sinkFd) })),
      ratios: report.ratios?.quarters?.map((q) => ({ label: q.label, raw: +q.raw.toFixed(3), corrected: +q.corrected.toFixed(3) })),
      medians,
      supplyFd: Math.round(w.ledger.supply()),
      reserveFd: Math.round(w.ledger.reserve()),
      brokered: { loads: brokeredLog.loads, payFd: Math.round(brokeredLog.payFd), miles: Math.round(brokeredLog.miles), perMile: +(brokeredLog.payFd / Math.max(1, brokeredLog.miles)).toFixed(3) },
      direct: { loads: directLog.loads, payFd: Math.round(directLog.payFd), miles: Math.round(directLog.miles), perMile: +(directLog.payFd / Math.max(1, directLog.miles)).toFixed(3) },
      facilities: report.facilities,
      population: report.population,
    },
  };
  return out;
}

/** Cash plus the Reserve plus open receivables plus the owned trucks' value (report.ts's wealth, less the depositor value this fleet never has). */
function wealthOf(w: World, c: Company): number {
  let s = w.ledger.balance(companyAccount(c.id)) + (w.cfg.cashReserve.enabled ? reserveHeldFd(w, c.id) : 0) + receivablesOf(w, c.id);
  for (const t of w.trucksByCompany.get(c.id) ?? []) if (t.status !== "retired" && t.lease === "owned" && (!t.lessorId || t.lessorId === c.id)) s += truckValue(w, t);
  return s;
}

function line(r: RunOut): string {
  const a = r.attacker;
  const w = r.world as { emissionTotals: { budgetedFd: number; committedFd: number; daysAtVolFloor: number; daysAtRateFloor: number }; npcPaidFd: number; companies: number; failures: { bankruptcies: number; inDebtAtEnd: number }; board: { cleared: number }; brokered: { perMile: number }; direct: { perMile: number } };
  return (
    `${r.scenario.padEnd(8)} s${r.seed} ${r.days}d cap ${r.cap ? "on " : "off"} · attacker gain ${money(a.gainPerDayFd as number)}/day (wealth ${money(a.startWealthFd as number)} → ${money(a.endWealthFd as number)}, cash ${money(a.cashFd as number)})` +
    ` · NPC freight to it ${money(a.inNpcFreightFd as number)} (${((a.shareOfNpcPaid as number) * 100).toFixed(2)}% of ${money(w.npcPaidFd)}) · via brokers ${money(a.inBrokerFd as number)} · NPC market ${money(a.inNpcMarketFd as number)} · detention ${money(a.inDetentionFd as number)}` +
    ` · operating ${money(a.operatingFd as number)} bid% ${a.bidPctEnd} · facilities ${a.facilities} ownBooked ${a.ownBooked} · timing grab ${a.grabDays}d · brokerage d${a.brokerDay} ownTenders ${a.ownTenders} (refused ${a.ownTenderRefused}) bait ${a.baitPosts}` +
    ` · world: committed ${money(w.emissionTotals.committedFd)} of ${money(w.emissionTotals.budgetedFd)} (${((100 * w.emissionTotals.committedFd) / Math.max(1, w.emissionTotals.budgetedFd)).toFixed(0)}%), floor days vol ${w.emissionTotals.daysAtVolFloor} rate ${w.emissionTotals.daysAtRateFloor}` +
    ` · companies ${w.companies}, liquidations ${w.failures.bankruptcies}, in debt ${w.failures.inDebtAtEnd} · cleared ${w.board.cleared} · brokered ${w.brokered.perMile.toFixed(2)} vs direct ${w.direct.perMile.toFixed(2)} FD/mi`
  );
}

function compare(outDir: string, seeds: number[]): void {
  for (const seed of seeds) {
    const rows = SCENARIOS.map((s) => {
      const f = `${outDir}/${s}-seed${seed}.json`;
      return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as RunOut) : null;
    }).filter((x): x is RunOut => x !== null);
    if (rows.length === 0) continue;
    console.log(`\nseed ${seed}`);
    const keys: (keyof RunOut["attacker"])[] = ["gainPerDayFd", "endWealthFd", "operatingFd", "cashFd", "brokerCashFd", "brokerStakedFd", "revenueFd", "costFd", "bidPctEnd", "inNpcFreightFd", "inBrokerFd", "inNpcMarketFd", "inDetentionFd", "outToCarriersFd", "shareOfNpcPaid", "facilities", "ownBooked", "grabDays", "ownTenders", "ownTenderRefused", "trucks", "liquidated", "brokerLiquidated"];
    console.log(["attacker".padEnd(18), ...rows.map((r) => r.scenario.padStart(12))].join(" "));
    for (const k of keys) console.log([String(k).padEnd(18), ...rows.map((r) => String(typeof r.attacker[k] === "number" && Math.abs(r.attacker[k] as number) >= 1000 ? money(r.attacker[k] as number) : r.attacker[k]).padStart(12))].join(" "));
    const wk = (r: RunOut, path: string) => path.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], r.world);
    const wkeys = ["npcPaidFd", "npcMarketFd", "detentionFd", "emissionTotals.budgetedFd", "emissionTotals.committedFd", "emissionTotals.carryFd", "emissionTotals.daysAtVolFloor", "emissionTotals.daysAtRateFloor", "companies", "trucks", "failures.bankruptcies", "failures.inDebtAtEnd", "failures.debtFd", "board.cleared", "board.avgClearedRate", "brokered.perMile", "direct.perMile", "supplyFd"];
    console.log(["world".padEnd(18), ...rows.map((r) => r.scenario.padStart(12))].join(" "));
    for (const k of wkeys) console.log([k.slice(-18).padEnd(18), ...rows.map((r) => { const v = wk(r, k); return String(typeof v === "number" && Math.abs(v) >= 1000 ? money(v) : typeof v === "number" ? +v.toFixed(3) : v).padStart(12); })].join(" "));
    const med = rows[0]!.world.medians as Record<string, number>;
    for (const k of Object.keys(med ?? {})) console.log([`med ${k}`.slice(0, 18).padEnd(18), ...rows.map((r) => money((r.world.medians as Record<string, number>)[k] ?? 0).padStart(12))].join(" "));
  }
}

function main(): void {
  const { values } = parseArgs({
    options: {
      scenario: { type: "string", default: "control" },
      seeds: { type: "string", default: "1" },
      days: { type: "string", default: "364" }, // the season close burns cash above the carryover at the end of day 364: stay inside it
      trucks: { type: "string", default: "30" },
      cap: { type: "string", default: "on" },
      grant: { type: "string", default: "2500000" }, // a whale's cash (FD bought is what gets a truck faster, Jeff 2026-11-08)
      postMargin: { type: "string", default: "0" },
      set: { type: "string", multiple: true, default: [] },
      out: { type: "string", default: "runs/redteam-emission" },
      compare: { type: "boolean", default: false },
    },
  });
  const seeds = values.seeds!.split(",").map(Number);
  const outDir = values.out!;
  mkdirSync(outDir, { recursive: true });
  if (values.compare) {
    compare(outDir, seeds);
    return;
  }
  const scenarios = (values.scenario === "all" ? SCENARIOS : (values.scenario!.split(",") as Scenario[])).filter((s) => SCENARIOS.includes(s));
  const cap = values.cap !== "off";
  console.log(`REDTEAM · emission cap · scenarios ${scenarios.join(",")} · seeds ${seeds.join(",")} · ${values.days} days · cap ${cap ? "on (R net, dial one-way, flat 4M)" : "off"} · ${values.trucks} trucks${values.set!.length ? ` · ${values.set!.join(" ")}` : ""}`);
  for (const scenario of scenarios) {
    for (const seed of seeds) {
      const t0 = performance.now();
      const postMargin = Number(values.postMargin);
      const r = runScenario({ seed, days: Number(values.days), trucks: Number(values.trucks), cap, sets: values.set ?? [], scenario, grantFd: Number(values.grant), postMargin });
      writeFileSync(`${outDir}/${scenario}${postMargin > 0 ? `-bait${postMargin}` : ""}-seed${seed}${cap ? "" : "-capoff"}.json`, JSON.stringify(r, null, 1));
      console.log(`${line(r)} · ${((performance.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
}

main();
