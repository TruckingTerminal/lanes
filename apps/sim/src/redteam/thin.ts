/**
 * Red team, pass 2026-11-09: ruleset 0.24.0 (the emission cap live on the flat 5M-a-month schedule; a bot the dial retires
 * leaves the market for good, solvency.ts settleRetired). The report is studio/reviews/redteam-emission.md (the second
 * addendum). Two player fleets stand in the gate's world (the sim's full population on the live levers):
 *   the big fleet   30 vans at the biggest starter hub from day 0, the greedy bot's orders (the first pass's attacker);
 *   the small fleet 5 vans at a thin starter hub (--hub, DAL), formed at 06:00 of day 10 like a newcomer on the test page.
 * Scenarios (--scenario, comma list or "all"):
 *   control   both fleets haul honestly;
 *   corner    the small fleet books every open van load within 300 miles of its hub at its book-now price every hour, profit
 *             or not, and its idle trucks come straight back: the thin board cornered;
 *   rebroker  the small fleet forms a brokerage on day 91 advertising a 1% margin (so the shippers tender it), tenders a
 *             held load to its own truck at the band's top when one stands at the pickup, otherwise holds the load to the
 *             window's end and posts it at --margin (0.3) in the last hour: re-brokered near the carriers' floor;
 *   pair      the big fleet runs the first pass's brokerage pair (1%, own tenders at the band's high end); the small honest.
 * Every run also reads the retirement rule: the bots the dial retired, the write-off faucet, what a company spent while
 * overdrawn and to whom, the cash retired bots keep; the thin hub's board at 06:00 each day; the hub's bot newcomers.
 * Read-only on the engine: both fleets are driven through applyAction and the ledger is read through a tap.
 *
 * Run:  npx tsx apps/sim/src/redteam/thin.ts --scenario control --seeds 1 [--days 364] [--hub DAL] [--margin 0.3]
 *       [--set path=value ...] [--out runs/redteam-thin]; `--compare --seeds 1` prints the scenarios side by side.
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
import { liveConfig, tapLedger } from "./harness.js";

const money = (n: number) => `${n < 0 ? "-" : ""}${Math.abs(n) >= 1e6 ? `${(Math.abs(n) / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `${(Math.abs(n) / 1e3).toFixed(1)}k` : Math.abs(n).toFixed(0)}`;

type Scenario = "control" | "corner" | "rebroker" | "pair";
const SCENARIOS: Scenario[] = ["control", "corner", "rebroker", "pair"];
const REACH_MI = 300; // the thin board as the producer's probe read it: paying loads within 300 miles (and the manual booking's deadhead limit)

/** The greedy bot's adaptive pricing (agents ruleBots.ts adaptPricing): the bid's margin over break-even moves 3 points a day to keep the win rate in [0.35, 0.6]. */
const PRICING = { start: 0.3, step: 0.03, min: 0.06, max: 0.9, band: [0.35, 0.6] as const };

/** The greedy fleet bot's orders (agents ruleBots.ts carrierProfileFor "greedy"); `home` set: an idle truck comes straight back to the hub (the corner). */
function orders(pricePct: number, dh: number, home?: string): StandingOrder[] {
  return [
    { kind: "bid", maxDeadheadMi: dh, price: { mode: "breakEvenPlus", pct: pricePct } },
    { kind: "floor", breakEvenPlusPct: 0.05 },
    ...(home
      ? [{ kind: "reposition", afterIdleRounds: 1, to: { hubId: home } } as StandingOrder]
      : [
          { kind: "reposition", afterIdleRounds: 1, to: { openLoadsWithinMi: 400 } } as StandingOrder,
          { kind: "reposition", afterIdleRounds: 3, to: { openLoadsWithinMi: 1000 } } as StandingOrder,
        ]),
    { kind: "bookNow", breakEvenPlusPct: 0.3, maxDeadheadMi: dh },
    { kind: "contracts", acceptOffers: true, spotAbovePct: 0.15, maxDeadheadMi: dh },
    { kind: "homeTime", afterDays: 28, restDays: 5 },
  ];
}

/** One fleet's pricing, the bot's way: the bid margin follows the day's win rate. */
class Pricer {
  pct = PRICING.start;
  moves = 0;
  private last: { truckRounds: number; wins: number };
  constructor(private c: Company) {
    this.last = { ...c.bidStats };
  }
  /** After a day: true when the margin moved (the orders are rebuilt from it). */
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

interface Opts {
  seed: number;
  days: number;
  scenario: Scenario;
  hub: string;
  margin: number;
  sets: string[];
}

/** A player fleet granted as populate grants an established one: the stake, a yard's bond, cash, used vans, staff, the factoring contract. */
function grantFleet(w: World, c: Company, trucks: number, cashFd: number, yard: "large" | "small"): void {
  const acct = companyAccount(c.id);
  const stake = 100_000;
  w.ledger.post(w.t, "faucet:starting_grant", acct, stake, `grant:stake:${c.id}`);
  stakeFd(w, c, stake);
  const yardBond = w.cfg.token.catalogue.items[yard === "large" ? "yardLarge" : "yardSmall"].bondFd;
  w.ledger.post(w.t, "faucet:starting_grant", acct, yardBond, `grant:yard:${c.id}`);
  w.ledger.post(w.t, acct, contractAccount(c.id), yardBond, `bond:yard:${c.id}`);
  c.yard = yard;
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

/** Cash plus the Reserve plus open receivables plus the owned trucks' value (report.ts's wealth, less the depositor value these fleets never have). */
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

interface Spent {
  toBig: number;
  toSmall: number;
  toCompanies: number;
  toSinks: number;
  toOther: number;
}
const spentZero = (): Spent => ({ toBig: 0, toSmall: 0, toCompanies: 0, toSinks: 0, toOther: 0 });

interface RunOut {
  scenario: Scenario;
  seed: number;
  days: number;
  hub: string;
  margin: number;
  big: Record<string, number | string>;
  small: Record<string, number | string>;
  retirement: Record<string, unknown>;
  board: Record<string, unknown>;
  hubBots: Record<string, unknown>;
  world: Record<string, unknown>;
}

function runScenario(o: Opts): RunOut {
  const overrides: Record<string, unknown> = {};
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
  const bigHome = w.net.hubs[w.net.starterIdx.reduce((a, b) => (w.net.hubs[a]!.weight >= w.net.hubs[b]!.weight ? a : b))]!.id;
  const thinIdx = w.net.hubs.findIndex((h) => h.id === o.hub);
  if (thinIdx < 0) throw new Error(`no hub ${o.hub}`);
  const big = formCompany(w, { name: "Red Team Freight", role: "carrier", homeHubId: bigHome, strategy: "player:redteam", orders: orders(PRICING.start, 150), freePath: false, human: true, authorityAgeDays: 1500 });
  grantFleet(w, big, 30, 2_500_000, "large");
  const bigAcct = companyAccount(big.id);
  const bigAccts = new Set<string>([bigAcct]);
  const smallAccts = new Set<string>();
  let small: Company | null = null;
  let smallBroker: Company | null = null;
  let bigBroker: Company | null = null;
  // Within the reach of the thin hub: the hubs, for the board and the newcomers.
  const nearIdx = new Set<number>();
  for (let i = 0; i < w.net.hubs.length; i++) if (hubMiles(w, thinIdx, i) <= REACH_MI) nearIdx.add(i);

  // The tap: what reaches each fleet by source, what leaves it; the world's write-offs, detention and market pay; and what any
  // company spends while overdrawn, by whom it pays (the retirement rule's question: who the written-off FD went to).
  const spentNeg = new Map<number, Spent>();
  const writeoffs = new Map<number, number>(); // faucet:bankruptcy_writeoff by company: a liquidation's restart writes off through the same faucet as a retirement
  const classify = (to: string): keyof Spent => (bigAccts.has(to) ? "toBig" : smallAccts.has(to) ? "toSmall" : /^co:\d+$/.test(to) ? "toCompanies" : to.startsWith("sink:") ? "toSinks" : "toOther");
  const taps = tapLedger(w, (from, to, ref) => tapKey(from, to, ref));
  // tapLedger hands its key function no amount, so the overdraft spend is summed through a second wrap of the (tapped) post.
  const writeoffAmt = new Map<number, number>();
  {
    const ledger = w.ledger;
    const post = ledger.post.bind(ledger);
    ledger.post = ((t: number, from: string, to: string, amount: number, ref: string, mode?: Parameters<typeof post>[5]) => {
      const co = /^co:(\d+)$/.exec(from);
      const negBefore = co ? ledger.balance(from) < 0 : false;
      const moved = post(t, from, to, amount, ref, mode);
      if (from === "faucet:bankruptcy_writeoff") {
        const id = Number(/^co:(\d+)$/.exec(to)?.[1] ?? 0);
        if (id) writeoffAmt.set(id, (writeoffAmt.get(id) ?? 0) + amount);
      }
      if (co && negBefore && !bigAccts.has(from) && !smallAccts.has(from)) {
        const id = Number(co[1]);
        let s = spentNeg.get(id);
        if (!s) spentNeg.set(id, (s = spentZero()));
        s[classify(to)] += amount;
      }
      return moved;
    }) as typeof ledger.post;
  }
  function tapKey(from: string, to: string, ref: string): string | null {
    const side = bigAccts.has(to) && !bigAccts.has(from) ? "big" : smallAccts.has(to) && !smallAccts.has(from) ? "small" : null;
    if (side) {
      if (from.startsWith("faucet:")) return `${side}:in:${from.slice(7)}${ref.startsWith("detention:") ? ":detention" : ""}`;
      if (/^co:\d+$/.test(from)) return ref.startsWith("receivable:") || ref.startsWith("load:") || ref.startsWith("rebroker:") || ref.startsWith("detention:") ? `${side}:in:broker` : `${side}:in:company`;
      return null;
    }
    const outSide = bigAccts.has(from) ? "big" : smallAccts.has(from) ? "small" : null;
    if (outSide && to.startsWith("sink:")) return `${outSide}:out:${to.slice(5)}`;
    if (outSide && /^co:\d+$/.test(to) && !bigAccts.has(to) && !smallAccts.has(to)) return `${outSide}:out:carriers`;
    if (from === "faucet:bankruptcy_writeoff") {
      const id = Number(/^co:(\d+)$/.exec(to)?.[1] ?? 0);
      if (id) writeoffs.set(id, (writeoffs.get(id) ?? 0) + 1); // counted; the amounts are summed by the second wrap below
      return "world:writeoff";
    }
    if (from === "faucet:npc_shipper" && ref.startsWith("detention:")) return "world:detention";
    if (from === "faucet:npc_market") return "world:npc_market";
    return null;
  }

  const bigPricer = new Pricer(big);
  let smallPricer: Pricer | null = null;
  const smallDh = REACH_MI;
  const smallOrders = (p: number) => orders(p, smallDh, o.scenario === "corner" ? o.hub : undefined);
  let smallStart = 0;
  let smallDay = 0;
  let bigStart = wealthOf(w, big);
  let cornerBooked = 0;
  let cornerRefused = 0;
  let cornerBelowBe = 0;
  let ownTenders = 0;
  let ownTenderRefused = 0;
  let heldPosts = 0;
  let brokerDay = 0;
  let bigOwnTenders = 0;
  let bigOwnRefused = 0;
  let bigBrokerDay = 0;
  // The thin hub's board at 06:00 each day: open van loads with their pickup within reach, and those at or above 80% of the
  // day's mean clearing rate (the "paying" ones, a stand-in for a leased van's break-even), with the median book-now per mile.
  const board: [number, number, number, number][] = [];
  const minutesPerDay = w.cfg.time.gameMinutesPerDay;
  const hours = (o.days * minutesPerDay) / 60;
  let seenDays = w.metrics.days.length;
  for (let h = 0; h < hours; h++) {
    stepHour(w, ruleBotHook);
    const day = dayOf(w.t, w.cfg);
    const minute = w.t % minutesPerDay;
    if (minute === 6 * 60) {
      let n = 0;
      let paying = 0;
      const rates: number[] = [];
      const clearing = w.metrics.days.at(-1)?.avgClearedRate ?? 0;
      for (const l of w.loads.values()) {
        if (l.status !== "open" || l.equipment !== "van" || !nearIdx.has(l.origin)) continue;
        n++;
        rates.push(l.bookNow);
        if (clearing > 0 && l.bookNow >= 0.8 * clearing) paying++;
      }
      board.push([day, n, paying, +median(rates).toFixed(2)]);
      // The newcomer arrives at 06:00 of day 10, as on the test page (game.ts WARM_HOURS).
      if (!small && day >= 10) {
        small = formCompany(w, { name: "Red Team Dallas", role: "carrier", homeHubId: o.hub, strategy: "player:redteam2", orders: smallOrders(PRICING.start), freePath: false, human: true, authorityAgeDays: 1500 });
        grantFleet(w, small, 5, 1_000_000, "small"); // the same cash in every scenario: the brokerage's capital and bond come out of it
        smallAccts.add(companyAccount(small.id));
        smallPricer = new Pricer(small);
        smallStart = wealthOf(w, small);
        smallDay = day;
      }
    }
    // Hourly, the corner: every open van load within reach goes onto the nearest idle van of the small fleet at its book-now price.
    if (small && o.scenario === "corner" && small.liquidatingSince === null) {
      const fleet = w.trucksByCompany.get(small.id) ?? [];
      for (const load of [...w.loads.values()]) {
        if (load.status !== "open" || load.equipment !== "van" || !nearIdx.has(load.origin) || !(load.bookNow > 0)) continue;
        let best: { t: (typeof fleet)[number]; dh: number } | null = null;
        for (const t of fleet) {
          if (t.status !== "idle" || t.trailer !== "van" || !t.driverId) continue;
          const dh = placeMiles(w, t.place, load.originPlace);
          if (dh <= REACH_MI && (!best || dh < best.dh)) best = { t, dh };
        }
        if (!best) continue;
        const r = applyAction(w, small.id, { type: "book_load", truckId: best.t.id, loadId: load.id });
        if (r.ok) {
          cornerBooked++;
          if (load.bookNow < 0.8 * (w.metrics.days.at(-1)?.avgClearedRate ?? 0)) cornerBelowBe++;
        } else cornerRefused++;
      }
    }
    // Hourly, the re-brokering: a held load goes to the own truck at the band's top when one stands at the pickup; otherwise it
    // is held to the window's last hour and then posted at the attack's margin (the standing order advertises 1%).
    if (smallBroker && small && smallBroker.liquidatingSince === null) {
      const fleet = w.trucksByCompany.get(small.id) ?? [];
      for (const load of [...w.loads.values()]) {
        if (load.brokerId !== smallBroker.id || load.status !== "open" || load.tenderedTo !== 0 || load.passedBy === small.id) continue;
        if (!load.hold || load.hold.brokerId !== smallBroker.id) continue;
        const truck = fleet.find((t) => t.status === "idle" && t.hub === load.origin && t.trailer === load.equipment && t.driverId);
        if (truck) {
          const [, hi] = ownBand(w, load);
          if (!applyAction(w, smallBroker.id, { type: "tender_own", loadId: load.id, rate: hi }).ok) {
            ownTenderRefused++;
            continue;
          }
          if (applyAction(w, small.id, { type: "accept_tender", truckId: truck.id, loadId: load.id }).ok) ownTenders++;
          else ownTenderRefused++;
          continue;
        }
        if (load.hold.until - w.t <= 60 && applyAction(w, smallBroker.id, { type: "post_tender", loadId: load.id, marginPct: o.margin }).ok) heldPosts++;
      }
    }
    // Hourly, the pair: the big fleet's brokerage tenders every load it holds to its own carrier at the band's high end.
    if (bigBroker && bigBroker.liquidatingSince === null) {
      const fleet = w.trucksByCompany.get(big.id) ?? [];
      for (const load of [...w.loads.values()]) {
        if (load.brokerId !== bigBroker.id || load.status !== "open" || load.tenderedTo !== 0 || load.passedBy === big.id) continue;
        const truck = fleet.find((t) => t.status === "idle" && t.hub === load.origin && t.trailer === load.equipment && t.driverId);
        if (!truck) continue;
        const [, hi] = ownBand(w, load);
        if (!applyAction(w, bigBroker.id, { type: "tender_own", loadId: load.id, rate: hi }).ok) {
          bigOwnRefused++;
          continue;
        }
        if (applyAction(w, big.id, { type: "accept_tender", truckId: truck.id, loadId: load.id }).ok) bigOwnTenders++;
        else bigOwnRefused++;
      }
    }
    if (w.metrics.days.length === seenDays) continue;
    seenDays = w.metrics.days.length;
    // Daily, after the day closed: the brokerages form on day 91; the pricing steps.
    if (o.scenario === "pair" && !bigBroker && day >= 91 && big.liquidatingSince === null) {
      const r = applyAction(w, big.id, { type: "form_brokerage", name: "Red Team Logistics", capitalFd: 1_300_000 });
      if (r.ok && (bigBroker = partnerOf(w, big))) {
        bigBrokerDay = day;
        bigAccts.add(companyAccount(bigBroker.id));
        applyAction(w, bigBroker.id, { type: "set_standing_orders", orders: [{ kind: "broker", marginPct: 0.01, maxOpenLoads: 200 }] });
        applyAction(w, bigBroker.id, { type: "stake_fd", fd: 1_000_000 });
      }
    }
    if (o.scenario === "rebroker" && small && !smallBroker && day >= 91 && small.liquidatingSince === null) {
      const r = applyAction(w, small.id, { type: "form_brokerage", name: "Red Team Dallas Logistics", capitalFd: 300_000 });
      if (r.ok && (smallBroker = partnerOf(w, small))) {
        brokerDay = day;
        smallAccts.add(companyAccount(smallBroker.id));
        // The thin margin wins the tenders (weights ∝ 1 ÷ margin²); the bond is the AP cap on what it may owe and post.
        applyAction(w, smallBroker.id, { type: "set_standing_orders", orders: [{ kind: "broker", marginPct: 0.01, maxOpenLoads: 100, ownFirst: true }] });
        applyAction(w, smallBroker.id, { type: "stake_fd", fd: 250_000 });
      }
    }
    if (big.liquidatingSince === null && bigPricer.step()) applyAction(w, big.id, { type: "set_standing_orders", orders: orders(bigPricer.pct, 150) });
    if (small && smallPricer && small.liquidatingSince === null && smallPricer.step()) applyAction(w, small.id, { type: "set_standing_orders", orders: smallOrders(smallPricer.pct) });
  }

  const report = buildReport(w);
  const get = (k: string) => taps.get(k) ?? 0;
  const npcPaid = w.ledger.npcPaidFd();
  const em = report.emission!;
  const months = em.months.map((m) => ({ m: m.month, budget: Math.round(m.budgetFd), committed: Math.round(m.committedFd), vol: +m.volMult.toFixed(3), rate: +m.rateMult.toFixed(3), carry: Math.round(m.carryFd) }));
  const fleetOut = (side: "big" | "small", c: Company | null, broker: Company | null, start: number, days: number, pricer: Pricer | null): Record<string, number | string> => {
    if (!c) return { formed: 0 };
    const inNpc = get(`${side}:in:npc_shipper`) + get(`${side}:in:npc_factor`) + get(`${side}:in:npc_lessor`);
    const endWealth = wealthOf(w, c) + (broker ? wealthOf(w, broker) + broker.stakedFd : 0);
    const fleet = w.trucksByCompany.get(c.id) ?? [];
    const tags = [...taps.keys()].filter((k) => k.startsWith(`${side}:`)).sort();
    return {
      formed: 1,
      liquidated: c.liquidatingSince !== null ? 1 : 0,
      bankruptcies: c.bankruptcies,
      trucks: fleet.filter((t) => t.status !== "retired").length,
      days,
      bidPctEnd: pricer ? +pricer.pct.toFixed(2) : 0,
      pctMoves: pricer ? pricer.moves : 0,
      loadsWon: c.bidStats.wins,
      operatingFd: Math.round(c.operating.revenueFd - c.operating.costFd + (broker ? broker.operating.revenueFd - broker.operating.costFd : 0)),
      cashFd: Math.round(w.ledger.balance(companyAccount(c.id))),
      brokerCashFd: broker ? Math.round(w.ledger.balance(companyAccount(broker.id))) : 0,
      brokerStakedFd: broker ? Math.round(broker.stakedFd) : 0,
      brokerLiquidated: broker && broker.liquidatingSince !== null ? 1 : 0,
      startWealthFd: Math.round(start),
      endWealthFd: Math.round(endWealth),
      gainPerDayFd: Math.round((endWealth - start) / Math.max(1, days)),
      revenueFd: Math.round(c.operating.revenueFd),
      costFd: Math.round(c.operating.costFd),
      inNpcFreightFd: Math.round(inNpc),
      inBrokerFd: Math.round(get(`${side}:in:broker`)),
      inDetentionFd: Math.round(get(`${side}:in:npc_shipper:detention`)),
      outToCarriersFd: Math.round(get(`${side}:out:carriers`)),
      shareOfNpcPaid: +(inNpc / Math.max(1, npcPaid)).toFixed(4),
      ...Object.fromEntries(tags.map((k) => [k.slice(side.length + 1), Math.round(get(k))])),
    };
  };
  // The retirement rule: the bots the dial retired, what they keep or still owe, the write-off faucet, and what every company
  // spent while overdrawn (and to whom), split by how it ended.
  const retired = w.companies.filter((c) => c.retiredDay !== undefined);
  const sumSpent = (ids: number[]) => {
    const s = spentZero();
    for (const id of ids) {
      const x = spentNeg.get(id);
      if (!x) continue;
      for (const k of Object.keys(s) as (keyof Spent)[]) s[k] += x[k];
    }
    return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Math.round(v)]));
  };
  const written = retired.filter((c) => spentNeg.has(c.id));
  const liquidatedIds = w.companies.filter((c) => c.liquidatingSince !== null && c.retiredDay === undefined).map((c) => c.id);
  const retirement = {
    population: report.population,
    retiredCompanies: retired.length,
    retiredWithOverdraftSpend: written.length,
    retiredCashKeptFd: Math.round(retired.reduce((s, c) => s + Math.max(0, w.ledger.balance(companyAccount(c.id))), 0)),
    retiredResidueOwedFd: Math.round(retired.reduce((s, c) => s + Math.max(0, -w.ledger.balance(companyAccount(c.id))), 0)),
    retiredStakedFd: Math.round(retired.reduce((s, c) => s + c.stakedFd, 0)),
    retiredFacilities: w.facilities.filter((f) => retired.some((c) => c.id === f.ownerId)).length,
    retiredTrucksNotRetired: retired.reduce((s, c) => s + (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired").length, 0),
    writeoffFd: Math.round(get("world:writeoff")),
    writeoffRetiredFd: Math.round([...writeoffAmt].filter(([id]) => w.companies[id - 1]?.retiredDay !== undefined).reduce((s, [, v]) => s + v, 0)),
    writeoffRestartsFd: Math.round([...writeoffAmt].filter(([id]) => w.companies[id - 1]?.retiredDay === undefined).reduce((s, [, v]) => s + v, 0)),
    writeoffCompanies: writeoffAmt.size,
    writeoffPosts: [...writeoffs.values()].reduce((s, v) => s + v, 0),
    airdropForfeitedFd: Math.round(w.token.airdrop.forfeitedFd),
    spentOverdrawn: { retired: sumSpent(retired.map((c) => c.id)), liquidating: sumSpent(liquidatedIds), all: sumSpent([...spentNeg.keys()]) },
    companiesOverdrawnEver: spentNeg.size,
  };
  // The thin hub's bot newcomers: bot carriers whose home is within reach of the hub.
  const hubBotsAll = w.companies.filter((c) => c.role === "carrier" && !c.human && !c.strategy.startsWith("player:") && nearIdx.has(c.homeHub));
  const hubBots = {
    hub: o.hub,
    hubsWithinReach: nearIdx.size,
    companies: hubBotsAll.length,
    liquidatedOrRetired: hubBotsAll.filter((c) => c.liquidatingSince !== null || c.retiredDay !== undefined).length,
    medianCashFd: Math.round(median(hubBotsAll.map((c) => w.ledger.balance(companyAccount(c.id))))),
    medianLoadsWon: median(hubBotsAll.map((c) => c.bidStats.wins)),
    loadsWon: hubBotsAll.reduce((s, c) => s + c.bidStats.wins, 0),
    trucks: hubBotsAll.reduce((s, c) => s + (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired").length, 0),
    byStrategy: Object.fromEntries([...new Set(hubBotsAll.map((c) => c.strategy.split(":")[0]!))].map((k) => {
      const xs = hubBotsAll.filter((c) => c.strategy.startsWith(k));
      return [k, { companies: xs.length, failed: xs.filter((c) => c.liquidatingSince !== null || c.retiredDay !== undefined).length, medianCashFd: Math.round(median(xs.map((c) => w.ledger.balance(companyAccount(c.id))))), medianLoadsWon: median(xs.map((c) => c.bidStats.wins)) }];
    })),
  };
  const weekly = (from: number, to: number, k: 1 | 2 | 3) => {
    const xs = board.filter((b) => b[0] >= from && b[0] < to).map((b) => b[k]);
    return xs.length ? +median(xs).toFixed(k === 3 ? 2 : 0) : null;
  };
  const boardOut = {
    reachMi: REACH_MI,
    day10: board.find((b) => b[0] === 10) ?? null,
    medianOpenByMonth: Array.from({ length: Math.ceil(o.days / 30) }, (_, m) => weekly(m * 30, (m + 1) * 30, 1)),
    medianPayingByMonth: Array.from({ length: Math.ceil(o.days / 30) }, (_, m) => weekly(m * 30, (m + 1) * 30, 2)),
    medianRateByMonth: Array.from({ length: Math.ceil(o.days / 30) }, (_, m) => weekly(m * 30, (m + 1) * 30, 3)),
    days: board,
  };
  const strat = report.byStrategy as Record<string, Record<string, { medianCashFd?: number }>>;
  const medians: Record<string, number> = {};
  for (const [seg, by] of Object.entries(strat ?? {})) for (const [s, v] of Object.entries(by)) if (v && typeof v.medianCashFd === "number") medians[`${seg}:${s}`] = Math.round(v.medianCashFd);
  const smallDays = small ? o.days - smallDay : 0;
  return {
    scenario: o.scenario,
    seed: o.seed,
    days: o.days,
    hub: o.hub,
    margin: o.margin,
    big: { home: bigHome, brokerDay: bigBrokerDay, ownTenders: bigOwnTenders, ownTenderRefused: bigOwnRefused, ...fleetOut("big", big, bigBroker, bigStart, o.days, bigPricer) },
    small: { home: o.hub, formedDay: smallDay, cornerBooked, cornerRefused, cornerBelowClearing: cornerBelowBe, brokerDay, ownTenders, ownTenderRefused, heldPosts, ...fleetOut("small", small, smallBroker, smallStart, smallDays, smallPricer) },
    retirement,
    board: boardOut,
    hubBots,
    world: {
      npcPaidFd: Math.round(npcPaid),
      detentionFd: Math.round(get("world:detention")),
      npcMarketFd: Math.round(get("world:npc_market")),
      emissionTotals: em.totals,
      months,
      pay: em.pay,
      companies: report.companies,
      trucks: report.trucks,
      failures: { bankruptcies: report.failures.bankruptcies, inDebtAtEnd: report.failures.inDebtAtEnd, debtFd: Math.round(report.failures.debtFd) },
      board: report.board,
      quarters: report.quarters.map((q) => ({ label: q.label, ratio: +q.sinkFaucetRatio.toFixed(3), faucetFd: Math.round(q.faucetFd), sinkFd: Math.round(q.sinkFd) })),
      ratios: report.ratios?.quarters?.map((q) => ({ label: q.label, raw: +q.raw.toFixed(3), corrected: +q.corrected.toFixed(3) })),
      medians,
      supplyFd: Math.round(w.ledger.supply()),
      reserveFd: Math.round(w.ledger.reserve()),
      brokered: w.factoringLog?.brokered ? { loads: w.factoringLog.brokered.loads, payFd: Math.round(w.factoringLog.brokered.payFd), perMile: +(w.factoringLog.brokered.payFd / Math.max(1, w.factoringLog.brokered.miles)).toFixed(3) } : null,
      direct: w.factoringLog?.direct ? { loads: w.factoringLog.direct.loads, payFd: Math.round(w.factoringLog.direct.payFd), perMile: +(w.factoringLog.direct.payFd / Math.max(1, w.factoringLog.direct.miles)).toFixed(3) } : null,
    },
  };
}

function line(r: RunOut): string {
  const b = r.big;
  const s = r.small;
  const w = r.world as { emissionTotals: { budgetedFd: number; committedFd: number; daysAtVolFloor: number; daysAtRateFloor: number }; npcPaidFd: number; companies: number; failures: { bankruptcies: number; inDebtAtEnd: number } };
  const ret = r.retirement as { retiredCompanies: number; writeoffFd: number; retiredResidueOwedFd: number; retiredCashKeptFd: number };
  const bd = r.board as { day10: [number, number, number, number] | null; medianOpenByMonth: (number | null)[]; medianPayingByMonth: (number | null)[] };
  const hb = r.hubBots as { companies: number; liquidatedOrRetired: number; medianCashFd: number; loadsWon: number };
  return (
    `${r.scenario.padEnd(8)} s${r.seed} ${r.days}d ${r.hub} · big ${money(b.gainPerDayFd as number)}/day (NPC ${money(b.inNpcFreightFd as number)}, ${((b.shareOfNpcPaid as number) * 100).toFixed(2)}%; ownTenders ${b.ownTenders})` +
    ` · small ${money(s.gainPerDayFd as number)}/day from d${s.formedDay} (NPC ${money(s.inNpcFreightFd as number)}, via brokers ${money(s.inBrokerFd as number)}, out to carriers ${money(s.outToCarriersFd as number)}, won ${s.loadsWon}, corner ${s.cornerBooked}, ownTenders ${s.ownTenders}, heldPosts ${s.heldPosts}, trucks ${s.trucks}, liq ${s.liquidated})` +
    ` · board d10 ${bd.day10 ? `${bd.day10[1]} open / ${bd.day10[2]} paying` : "-"}, monthly medians open ${bd.medianOpenByMonth.join("/")} paying ${bd.medianPayingByMonth.join("/")}` +
    ` · hub bots ${hb.companies} (failed ${hb.liquidatedOrRetired}, median cash ${money(hb.medianCashFd)}, loads ${hb.loadsWon})` +
    ` · retired ${ret.retiredCompanies}, write-off ${money(ret.writeoffFd)}, residue ${money(ret.retiredResidueOwedFd)}, kept ${money(ret.retiredCashKeptFd)}` +
    ` · world committed ${money(w.emissionTotals.committedFd)} of ${money(w.emissionTotals.budgetedFd)}, floor days vol ${w.emissionTotals.daysAtVolFloor} rate ${w.emissionTotals.daysAtRateFloor}, companies ${w.companies}, liquidations ${w.failures.bankruptcies}, in debt ${w.failures.inDebtAtEnd}`
  );
}

function compare(outDir: string, seeds: number[]): void {
  for (const seed of seeds) {
    const rows = SCENARIOS.map((s) => {
      const f = `${outDir}/${s}-seed${seed}.json`;
      return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as RunOut) : null;
    }).filter((x): x is RunOut => x !== null);
    if (rows.length === 0) continue;
    const fmt = (v: unknown) => String(typeof v === "number" && Math.abs(v) >= 1000 ? money(v) : typeof v === "number" ? +v.toFixed(3) : v).padStart(12);
    const section = (title: string, pick: (r: RunOut) => Record<string, unknown>, keys: string[]) => {
      console.log([`${title}`.padEnd(26), ...rows.map((r) => r.scenario.padStart(12))].join(" "));
      for (const k of keys) console.log([k.slice(-26).padEnd(26), ...rows.map((r) => fmt(k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], pick(r))))].join(" "));
    };
    console.log(`\nseed ${seed}`);
    const fleetKeys = ["gainPerDayFd", "endWealthFd", "operatingFd", "cashFd", "brokerCashFd", "brokerStakedFd", "loadsWon", "bidPctEnd", "inNpcFreightFd", "inBrokerFd", "inDetentionFd", "outToCarriersFd", "shareOfNpcPaid", "trucks", "liquidated", "brokerLiquidated"];
    section("big fleet", (r) => r.big, ["brokerDay", "ownTenders", ...fleetKeys]);
    section("small fleet", (r) => r.small, ["formedDay", "cornerBooked", "cornerBelowClearing", "brokerDay", "ownTenders", "heldPosts", ...fleetKeys]);
    section("retirement", (r) => r.retirement, ["retiredCompanies", "retiredWithOverdraftSpend", "retiredCashKeptFd", "retiredResidueOwedFd", "retiredStakedFd", "retiredFacilities", "retiredTrucksNotRetired", "writeoffFd", "writeoffRetiredFd", "writeoffRestartsFd", "writeoffCompanies", "airdropForfeitedFd", "companiesOverdrawnEver", "spentOverdrawn.retired.toBig", "spentOverdrawn.retired.toSmall", "spentOverdrawn.retired.toCompanies", "spentOverdrawn.retired.toSinks", "spentOverdrawn.retired.toOther", "spentOverdrawn.all.toBig", "spentOverdrawn.all.toSmall", "spentOverdrawn.all.toCompanies", "spentOverdrawn.all.toSinks", "spentOverdrawn.all.toOther", "population.retired", "population.woundDown", "population.entered"]);
    section("hub bots", (r) => r.hubBots, ["companies", "liquidatedOrRetired", "medianCashFd", "medianLoadsWon", "loadsWon", "trucks"]);
    section("world", (r) => r.world, ["npcPaidFd", "npcMarketFd", "detentionFd", "emissionTotals.budgetedFd", "emissionTotals.committedFd", "emissionTotals.carryFd", "emissionTotals.daysAtVolFloor", "emissionTotals.daysAtRateFloor", "companies", "trucks", "failures.bankruptcies", "failures.inDebtAtEnd", "failures.debtFd", "board.cleared", "board.avgClearedRate", "brokered.perMile", "direct.perMile", "supplyFd"]);
    console.log("board (monthly medians: open / paying / FD per mile)");
    for (const r of rows) {
      const bd = r.board as { medianOpenByMonth: (number | null)[]; medianPayingByMonth: (number | null)[]; medianRateByMonth: (number | null)[]; day10: unknown };
      console.log(`  ${r.scenario.padEnd(8)} d10 ${JSON.stringify(bd.day10)} · ${bd.medianOpenByMonth.map((v, i) => `${v}/${bd.medianPayingByMonth[i]}/${bd.medianRateByMonth[i]}`).join("  ")}`);
    }
    const med = rows[0]!.world.medians as Record<string, number>;
    for (const k of Object.keys(med ?? {})) console.log([`med ${k}`.slice(0, 26).padEnd(26), ...rows.map((r) => money((r.world.medians as Record<string, number>)[k] ?? 0).padStart(12))].join(" "));
  }
}

function main(): void {
  const { values } = parseArgs({
    options: {
      scenario: { type: "string", default: "control" },
      seeds: { type: "string", default: "1" },
      days: { type: "string", default: "364" }, // the season close burns cash above the carryover at the end of day 364: stay inside it
      hub: { type: "string", default: "DAL" },
      margin: { type: "string", default: "0.3" },
      set: { type: "string", multiple: true, default: [] },
      out: { type: "string", default: "runs/redteam-thin" },
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
  console.log(`REDTEAM · 0.24.0 thin board and retirement · scenarios ${scenarios.join(",")} · seeds ${seeds.join(",")} · ${values.days} days · hub ${values.hub} · margin ${values.margin}${values.set!.length ? ` · ${values.set!.join(" ")}` : ""}`);
  for (const scenario of scenarios) {
    for (const seed of seeds) {
      const t0 = performance.now();
      const r = runScenario({ seed, days: Number(values.days), scenario, hub: values.hub!, margin: Number(values.margin), sets: values.set ?? [] });
      writeFileSync(`${outDir}/${scenario}-seed${seed}.json`, JSON.stringify(r, null, 1));
      console.log(`${line(r)} · ${((performance.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
}

main();
