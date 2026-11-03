/**
 * Red team, job 2: break the engine. A fuzz harness that feeds random but well-formed action sequences
 * from several companies over a few hundred game days and checks the invariants after every step:
 *   - money conserved across every account including the reserve and the sinks (ledger.assertBalanced);
 *   - no negative balance, stock or stake, and locked FD never over an account's balance;
 *   - the cap identity: minted == supply + reserve + allocated + burned;
 *   - replays identical from the same seed and action log;
 *   - every refusal reason is reported with the state it was given.
 *
 * Run:  npx tsx apps/sim/src/redteam/fuzz.ts --seeds 1,2,3,4,5 --days 400 [--launch] [--profile live|base] [--three]
 * It is read-only on the engine: it only drives companies through the public applyAction and reads the ledger.
 *
 * `--three` (pass 2026-11-03b): the three rules of the next restart on (the player brokerage, the Reserve, cash now);
 * the attackers form brokerages and drive them, the menu adds the new actions, every new action's answer is checked
 * against the state it was given (an ok the state forbade, or a refusal whose reason the state contradicts), the
 * stricter invariants run (`checkThree`), and the replay is compared account by account (`ledgerHash`).
 */
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import {
  applyAction,
  canFormBrokerage,
  companyAccount,
  dayOf,
  ownBand,
  partnerOf,
  reserveAccount,
  samePerson,
  stepHour,
  HOLDER_NPC_FACTOR,
  type Action,
  type ActionResult,
  type Company,
  type World,
} from "@lanes/engine";
import { hubs } from "@lanes/data";
import { ruleBotHook } from "@lanes/agents";
import { addAttacker, checkInvariants, checkThree, ledgerHash, liveConfig, makeWorld, snap, THREE_SWITCHES, type MakeOpts } from "./harness.js";

// A small deterministic RNG, independent of the engine's, so the fuzz stream replays from its own seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TIERS = ["workhorse", "highwayPro", "flagship"] as const;
const TRAILERS = ["van", "reefer", "flatbed"] as const;
const STARTER_HUBS = hubs.filter((h) => h.isStarter).map((h) => h.id);

type Rand = () => number;
const pick = <T,>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const chance = (r: Rand, p: number) => r() < p;

/** One recorded fuzz action: the game minute, the company and the action, so a run replays bit-for-bit. */
interface FuzzStep {
  at: number;
  companyId: number;
  a: Action;
}

/** Builds a well-formed random action for `c` from the world's real ids, so it passes badInput and exercises state. */
function randomAction(w: World, c: Company, r: Rand): Action {
  const fleet = w.trucksByCompany.get(c.id) ?? [];
  const myTruck = fleet.length ? pick(r, fleet) : null;
  const openLoads = [...w.loads.values()].filter((l) => l.status === "open");
  const load = openLoads.length ? pick(r, openLoads) : null;
  const roll = r();
  // A broad, weighted menu. Ids are real; values are in range so badInput accepts them and the handler runs.
  if (roll < 0.14 && myTruck && load) return { type: "place_bid", truckId: myTruck.id, loadId: load.id, rate: 0.5 + r() * 6 };
  if (roll < 0.22 && myTruck && load) return { type: "book_load", truckId: myTruck.id, loadId: load.id };
  if (roll < 0.28) return { type: "buy_asset", tier: pick(r, TIERS), trailer: pick(r, TRAILERS), replaceNpcLease: chance(r, 0.6), finance: chance(r, 0.5), used: chance(r, 0.4) };
  if (roll < 0.33) return { type: "lease_truck", trailer: pick(r, TRAILERS) };
  if (roll < 0.4 && myTruck) return { type: "reposition_truck", truckId: myTruck.id, hubId: pick(r, STARTER_HUBS) };
  if (roll < 0.46) return { type: "set_pay_terms", terms: pick(r, ["net", "quick", "factor"] as const) };
  if (roll < 0.52) return { type: "stake_fd", fd: 1 + r() * 200_000, months: chance(r, 0.6) ? pick(r, [1, 3, 6, 12]) : undefined, roll: chance(r, 0.5) };
  if (roll < 0.58) return { type: "unstake_fd", fd: 1 + r() * 200_000, instant: chance(r, 0.5), breakLocks: chance(r, 0.7) };
  if (roll < 0.63 && myTruck) return { type: "rebuild_truck", truckId: myTruck.id };
  if (roll < 0.68 && myTruck) return { type: "park_truck", truckId: myTruck.id };
  if (roll < 0.72 && myTruck) return { type: "unpark_truck", truckId: myTruck.id };
  if (roll < 0.78 && myTruck) return { type: "list_truck", truckId: myTruck.id, askFd: r() * 200_000, floorFd: r() * 50_000, stepFd: r() * 5_000 };
  if (roll < 0.82) return { type: "buy_item", item: pick(r, ["yardSmall", "yardLarge", "apu", "aero", "tires", "sleeper"] as const), pay: "fd", truckId: myTruck ? myTruck.id : undefined };
  if (roll < 0.86) return { type: "buy_business", kind: "shop", hubId: pick(r, STARTER_HUBS) } as Action;
  if (roll < 0.9) return { type: "buy_facility", facility: pick(r, ["warehouse", "coldStorage", "factory"] as const), hubId: pick(r, STARTER_HUBS) };
  if (roll < 0.93 && myTruck && load) return { type: "rebroker_load", loadId: load.id, rate: 0.3 + r() * 3, pay: chance(r, 0.5) };
  if (roll < 0.96) return { type: "buy_fd", usd: r() * 50 };
  if (roll < 0.98) return { type: "sell_fd", fd: 1 + r() * 20_000 };
  return { type: "borrow", truckId: myTruck ? myTruck.id : 1, amountFd: 1 + r() * 50_000 };
}

/**
 * The three rules' actions (pass 2026-11-03b), built from real ids: forming, the owner's capital both ways, Rule A
 * passes and the tenders behind them, Rule B own tenders inside and outside the band, cash now on own and others'
 * paper, the Reserve in and out, and a brokerage's broker order so it has loads to tender. Null when nothing fits.
 */
function threeAction(w: World, c: Company, r: Rand): Action | null {
  const partner = partnerOf(w, c);
  const cash = w.ledger.balance(companyAccount(c.id));
  const roll = r();
  if (c.role === "carrier" && !partner && roll < 0.12) return { type: "form_brokerage", name: `fuzz brokerage ${c.id}`, capitalFd: 90_000 + r() * 300_000 };
  if (partner && roll < 0.2) return { type: "transfer_capital", fd: 1 + r() * Math.max(2_000, cash * 1.2) };
  if (roll < 0.34) {
    const mine = w.receivables.filter((x) => x.holder === c.id);
    const pool = chance(r, 0.75) && mine.length ? mine : w.receivables;
    return pool.length ? { type: "cash_invoice", receivableId: pick(r, pool).id } : null;
  }
  if (roll < 0.46) return { type: "reserve_deposit", fd: 1 + r() * Math.max(2_000, cash * 1.2) };
  if (roll < 0.56) return { type: "reserve_withdraw", fd: 1 + r() * Math.max(2_000, w.ledger.balance(reserveAccount(c.id)) * 1.2) };
  if (c.role === "carrier") {
    const tendered = [...w.loads.values()].filter((l) => l.status === "open" && l.tenderedTo === c.id);
    const fleet = w.trucksByCompany.get(c.id) ?? [];
    if (roll < 0.7 && tendered.length) return { type: "pass_tender", loadId: pick(r, tendered).id };
    if (roll < 0.84 && tendered.length && fleet.length) return { type: "accept_tender", truckId: pick(r, fleet).id, loadId: pick(r, tendered).id };
    const open = [...w.loads.values()].filter((l) => l.status === "open");
    if (roll < 0.9 && open.length) return { type: "pass_tender", loadId: pick(r, open).id };
    return null;
  }
  if (c.role === "broker") {
    if (roll < 0.62 || !c.orders.some((o) => o.kind === "broker")) return { type: "set_standing_orders", orders: [{ kind: "broker", marginPct: r() * 0.2, maxOpenLoads: 5 + Math.floor(r() * 30) }] };
    const mine = [...w.loads.values()].filter((l) => l.brokerId === c.id && l.status === "open");
    const pool = mine.length && chance(r, 0.85) ? mine : [...w.loads.values()].filter((l) => l.status === "open");
    if (!pool.length) return null;
    const load = pick(r, pool);
    const [lo, hi] = ownBand(w, load);
    return { type: "tender_own", loadId: load.id, rate: Math.min(99, Math.max(0.01, ((lo + hi) / 2) * (0.7 + r() * 0.6))) };
  }
  return null;
}

/** What the state said before a new-rule action, for checking its answer. */
interface Pre {
  cash: number;
  reserve: number;
  band?: [number, number];
  inv?: { holder: number; payee: number; payer: number; payerBroker: boolean; own: boolean; dueDay: number; today: number };
  liquidating: boolean;
  weeksInDebt: number;
}

function preState(w: World, c: Company, a: Action): Pre {
  const pre: Pre = { cash: w.ledger.balance(companyAccount(c.id)), reserve: w.ledger.balance(reserveAccount(c.id)), liquidating: c.liquidatingSince !== null, weeksInDebt: c.weeksInDebt };
  if (a.type === "tender_own") {
    const load = w.loads.get(a.loadId);
    if (load) pre.band = ownBand(w, load);
  }
  if (a.type === "cash_invoice") {
    const r = w.receivables.find((x) => x.id === a.receivableId);
    if (r) pre.inv = { holder: r.holder, payee: r.payeeId, payer: r.payer, payerBroker: r.payer !== 0 && w.companies[r.payer - 1]!.role === "broker", own: r.payer !== 0 && samePerson(w, r.payer, c.id), dueDay: r.dueDay, today: dayOf(w.t, w.cfg) };
  }
  return pre;
}

/** An answer the state contradicts: an ok the rule forbids, or a refusal whose stated reason isn't true. Null when true. */
function refusalTruth(w: World, c: Company, a: Action, res: ActionResult, pre: Pre): string | null {
  const fee = 1 + w.cfg.brokerage.transferFeePct;
  switch (a.type) {
    case "tender_own":
      if (!pre.band) return null;
      if (res.ok && !(a.rate >= pre.band[0] - 1e-9 && a.rate <= pre.band[1] + 1e-9)) return `tender_own ok at ${a.rate.toFixed(3)} outside the band [${pre.band[0].toFixed(3)}, ${pre.band[1].toFixed(3)}]`;
      if (!res.ok && res.reason === "the pay is outside the lane's band" && a.rate >= pre.band[0] && a.rate <= pre.band[1]) return `tender_own refused as outside the band at ${a.rate.toFixed(3)} inside [${pre.band[0].toFixed(3)}, ${pre.band[1].toFixed(3)}]`;
      return null;
    case "cash_invoice": {
      const i = pre.inv;
      if (!res.ok || !i) return null;
      if (i.holder !== c.id || i.payee !== c.id) return "cash_invoice ok on paper the company didn't hold";
      if (i.own) return "cash_invoice ok on paper between one owner's two companies";
      if (i.payer !== 0 && !i.payerBroker) return "cash_invoice ok on a player shipper's paper";
      if (i.dueDay <= i.today) return "cash_invoice ok on paper due today";
      const r = w.receivables.find((x) => x.id === a.receivableId);
      if (r && r.holder !== HOLDER_NPC_FACTOR) return "cash_invoice ok but the factor doesn't hold the paper";
      return null;
    }
    case "reserve_deposit":
      if (res.ok && pre.cash < a.fd - 0.01) return `reserve_deposit ok of ${a.fd.toFixed(2)} from ${pre.cash.toFixed(2)} cash`;
      if (!res.ok && res.reason === "insufficient FD" && pre.cash >= a.fd) return `reserve_deposit refused as insufficient with ${pre.cash.toFixed(2)} cash for ${a.fd.toFixed(2)}`;
      return null;
    case "reserve_withdraw":
      if (res.ok && pre.reserve < a.fd - 0.01) return `reserve_withdraw ok of ${a.fd.toFixed(2)} from ${pre.reserve.toFixed(2)} held`;
      if (!res.ok && res.reason === "the Reserve hasn't that much" && pre.reserve >= a.fd) return `reserve_withdraw refused with ${pre.reserve.toFixed(2)} held for ${a.fd.toFixed(2)}`;
      return null;
    case "transfer_capital":
      if (res.ok && (pre.liquidating || pre.weeksInDebt > 0)) return "transfer_capital ok out of a company wound up or in debt";
      if (res.ok && pre.cash < a.fd * fee - 0.01) return `transfer_capital ok of ${a.fd.toFixed(2)} and its fee from ${pre.cash.toFixed(2)}`;
      if (!res.ok && res.reason === "that would leave the company negative" && pre.cash >= a.fd * fee + 0.01) return `transfer_capital refused as negative with ${pre.cash.toFixed(2)} for ${(a.fd * fee).toFixed(2)}`;
      return null;
    case "form_brokerage":
      if (res.ok && pre.cash < a.capitalFd * fee - 0.01) return `form_brokerage ok with ${pre.cash.toFixed(2)} for ${(a.capitalFd * fee).toFixed(2)}`;
      return null;
    default:
      return null;
  }
}

/** Options for a fuzz seed: `three` turns the three rules on and adds their actions (pass 2026-11-03b). */
export interface FuzzOpts {
  three?: boolean;
}

export interface FuzzResult {
  seed: number;
  steps: number;
  okActions: number;
  refusedActions: number;
  threw: number;
  violations: { day: number; at: number; companyId: number; action: string; messages: string[] }[];
  replayMatch: boolean;
  firstViolation: { seed: number; steps: FuzzStep[] } | null;
  /** Three mode: the new actions tried and accepted, by type, and the final ledger hash (and the replay's). */
  three?: { tried: Record<string, number>; ok: Record<string, number>; reasons: Record<string, number>; hash: string; replayHash: string };
}

/** The attacker companies a fuzz world starts with (the same in the run and its replay). */
function fuzzAttackers(w: World, three: boolean): Company[] {
  const attackers: Company[] = [
    addAttacker(w, "fuzz-oo", { role: "carrier", freePath: true }),
    addAttacker(w, "fuzz-fleet", { role: "carrier", freePath: false }),
    addAttacker(w, "fuzz-broker", { role: "broker", freePath: false }),
  ];
  // Three mode: the free owner is a human player, so the rules that bind players (double brokering closed) bind it,
  // and the attackers are funded enough to form a brokerage even after random spending (so pass/tender get exercised).
  if (three) attackers[0]!.human = true;
  const grant = three ? 2_000_000 : 200_000;
  for (const c of attackers) w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), grant, `redteam-seed:${c.id}`);
  return attackers;
}

const threeMk = (mk: MakeOpts, three: boolean): MakeOpts => (three && mk.cfg ? { ...mk, cfg: (() => {
  const cfg = structuredClone(mk.cfg);
  for (const [path, v] of Object.entries(THREE_SWITCHES)) {
    const keys = path.split(".");
    let node = cfg as unknown as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) node = node[k] as Record<string, unknown>;
    node[keys.at(-1)!] = v;
  }
  return cfg;
})() } : mk);

/** Runs one fuzz seed. Records the step log so a violation can be replayed to the shortest prefix. */
export function fuzzSeed(seed: number, days: number, mk0: MakeOpts, actionsPerDay: number, trace = false, opts: FuzzOpts = {}): FuzzResult {
  const three = opts.three === true;
  const mk = threeMk(mk0, three);
  const r = mulberry32(seed * 2654435761);
  const w = makeWorld({ ...mk, seed, keepEntries: trace });
  // A handful of attacker companies the fuzz drives: carriers and a broker, free path and established, each seeded
  // with FD so it can act; in three mode a brokerage a carrier forms joins them.
  const attackers = fuzzAttackers(w, three);

  const res: FuzzResult = { seed, steps: 0, okActions: 0, refusedActions: 0, threw: 0, violations: [], replayMatch: true, firstViolation: null };
  const tally = { tried: {} as Record<string, number>, ok: {} as Record<string, number>, reasons: {} as Record<string, number> };
  const log: FuzzStep[] = [];
  const hoursTotal = (days * w.cfg.time.gameMinutesPerDay) / 60;
  const perHour = Math.max(1, Math.round((actionsPerDay * 60) / w.cfg.time.gameMinutesPerDay));

  for (let h = 0; h < hoursTotal; h++) {
    stepHour(w, ruleBotHook);
    const day = dayOf(w.t, w.cfg);
    // Three mode: a carrier attacker forms its brokerage the first hour it can (the layer open, the carrier trading,
    // the capital in hand), before random play drains it, so the pair's actions get exercised. Logged like any step.
    if (three) {
      for (const c of [...attackers]) {
        if (c.role !== "carrier" || c.partnerId !== undefined || canFormBrokerage(w, c) !== null) continue;
        if (w.ledger.balance(companyAccount(c.id)) < 200_000) continue;
        const a: Action = { type: "form_brokerage", name: `fuzz brokerage ${c.id}`, capitalFd: 150_000 };
        log.push({ at: w.t, companyId: c.id, a });
        res.steps++;
        tally.tried[a.type] = (tally.tried[a.type] ?? 0) + 1;
        const guard = `weeksInDebt ${c.weeksInDebt}, tierGraceDay ${c.tierGraceDay}, cash ${w.ledger.balance(companyAccount(c.id)).toFixed(0)}`;
        let out: ActionResult;
        try {
          out = applyAction(w, c.id, a);
        } catch (e) {
          // The action threw on well-formed input: record it with the state it left (a broker company formed and linked?).
          res.threw++;
          const b = c.partnerId !== undefined ? w.companies[c.partnerId - 1] : undefined;
          const left = b ? `left a half-formed brokerage co:${b.id} linked to co:${c.id} (cash ${w.ledger.balance(companyAccount(b.id)).toFixed(0)}, staked ${b.stakedFd.toFixed(0)})` : "left no brokerage";
          res.violations.push({ day, at: w.t, companyId: c.id, action: a.type, messages: [`form_brokerage threw: ${(e as Error).message} (${guard}); ${left}`] });
          if (b && !attackers.includes(b)) attackers.push(b);
          continue;
        }
        if (out.ok) {
          res.okActions++;
          tally.ok[a.type] = (tally.ok[a.type] ?? 0) + 1;
          const b = partnerOf(w, c);
          if (b && !attackers.includes(b)) attackers.push(b);
        } else res.refusedActions++;
      }
    }
    // Inject a few fuzz actions this hour.
    for (let i = 0; i < perHour; i++) {
      const c = pick(r, attackers);
      const a = (three && chance(r, 0.45) ? threeAction(w, c, r) : null) ?? randomAction(w, c, r);
      const pre = three ? preState(w, c, a) : null;
      const step: FuzzStep = { at: w.t, companyId: c.id, a };
      log.push(step);
      res.steps++;
      let threw = false;
      const lies: string[] = [];
      try {
        const out = applyAction(w, c.id, a);
        if (out.ok) res.okActions++;
        else res.refusedActions++;
        if (three) {
          tally.tried[a.type] = (tally.tried[a.type] ?? 0) + 1;
          if (out.ok) tally.ok[a.type] = (tally.ok[a.type] ?? 0) + 1;
          else if (["form_brokerage", "transfer_capital", "pass_tender", "tender_own", "cash_invoice", "reserve_deposit", "reserve_withdraw", "rebroker_load"].includes(a.type)) tally.reasons[`${a.type}: ${out.reason}`] = (tally.reasons[`${a.type}: ${out.reason}`] ?? 0) + 1;
          if (out.ok && a.type === "form_brokerage") {
            const b = partnerOf(w, c);
            if (b && !attackers.includes(b)) attackers.push(b);
          }
          const lie = pre ? refusalTruth(w, c, a, out, pre) : null;
          if (lie) lies.push(`untrue answer: ${lie}`);
          // Double brokering, closed to player carriers (brokerage.closeDoubleBrokering): a human carrier or one with a brokerage.
          if (out.ok && a.type === "rebroker_load" && c.role === "carrier" && (c.human || c.partnerId !== undefined)) lies.push("rebroker_load ok for a player carrier");
        }
      } catch (e) {
        threw = true;
        res.threw++;
        res.violations.push({ day, at: w.t, companyId: c.id, action: a.type, messages: [`applyAction threw: ${(e as Error).message}`] });
      }
      const v = [...checkInvariants(w, `d${day}`), ...(three ? checkThree(w, `d${day}`) : []), ...lies];
      if (v.length || threw) {
        if (v.length) res.violations.push({ day, at: w.t, companyId: c.id, action: a.type, messages: v });
        if (!res.firstViolation) {
          res.firstViolation = { seed, steps: [...log] };
          if (trace) dumpTrace(w, day, step);
        }
        if (res.violations.length > 40) return res; // stop early; we have the seed and a log
      }
    }
  }
  // Replay: rebuild the world from the same seed and the recorded log; compare the final cap snapshot (and, in three
  // mode, every account's balance and spend-only part).
  const replay = replayWorld(seed, days, mk, log, three);
  res.replayMatch = snapMatches(w, replay);
  if (three) {
    const hash = ledgerHash(w);
    const replayHash = ledgerHash(replay);
    res.three = { ...tally, hash, replayHash };
    res.replayMatch &&= hash === replayHash;
  }
  return res;
}

function snapMatches(original: World, w: World): boolean {
  const a = snap(original);
  const b = snap(w);
  const close = (x: number, y: number) => Math.abs(x - y) < 0.5;
  return close(a.supply, b.supply) && close(a.reserve, b.reserve) && close(a.burned, b.burned) && close(a.allocated, b.allocated);
}

/** Rebuilds the world and applies the recorded fuzz steps at their minutes. */
function replayWorld(seed: number, days: number, mk: MakeOpts, log: FuzzStep[], three: boolean): World {
  const w = makeWorld({ ...mk, seed });
  fuzzAttackers(w, three);
  const hoursTotal = (days * w.cfg.time.gameMinutesPerDay) / 60;
  let li = 0;
  for (let h = 0; h < hoursTotal; h++) {
    stepHour(w, ruleBotHook);
    while (li < log.length && log[li]!.at === w.t) {
      try {
        applyAction(w, log[li]!.companyId, log[li]!.a);
      } catch {
        /* a throw in the original is reproduced; the snapshot comparison is what we check */
      }
      li++;
    }
  }
  return w;
}

/** On the first violation, dump the offending co: accounts and their recent ledger entries. */
function dumpTrace(w: World, day: number, step: FuzzStep): void {
  console.log(`\n--- TRACE: first violation at day ${day} t${w.t}, injected step co${step.companyId} ${JSON.stringify(step.a)} ---`);
  for (const [acct, cents] of w.ledger.accounts()) {
    if (!acct.startsWith("co:") || !/^co:\d+$/.test(acct)) continue;
    const b = cents / 100;
    const lk = w.ledger.locked(acct);
    if (b > 0.02 && lk > b + 0.02) {
      console.log(`  ${acct}: balance ${b.toFixed(2)} locked ${lk.toFixed(2)} (over by ${(lk - b).toFixed(2)})`);
      const mine = w.ledger.entries.filter((e) => e.from === acct || e.to === acct).slice(-18);
      for (const e of mine) console.log(`    t${e.t} ${e.from} -> ${e.to} ${e.amount.toFixed(2)} (${e.ref})`);
    }
  }
  console.log(`--- end trace ---\n`);
}

function main(): void {
  const { values } = parseArgs({
    options: {
      seeds: { type: "string", default: "1,2,3,4,5" },
      days: { type: "string", default: "400" },
      actions: { type: "string", default: "40" }, // fuzz actions a game day
      profile: { type: "string", default: "live" },
      launch: { type: "boolean", default: false }, // bring the token launch forward so the exchange/bridge are exercised
      seasons: { type: "string", default: "on" },
      trace: { type: "boolean", default: false }, // keep ledger entries and dump the first violation's accounts
      three: { type: "boolean", default: false }, // pass 2026-11-03b: the brokerage, the Reserve and cash now on, with their actions
    },
  });
  const seeds = values.seeds!.split(",").map(Number);
  const days = Number(values.days);
  const actionsPerDay = Number(values.actions);
  const overrides: Record<string, unknown> = {};
  if (values.launch) overrides["token.betaYears"] = 0; // launch almost at once, so the market rules run
  const cfg = values.profile === "base" ? undefined : liveConfig(overrides);
  const mk: MakeOpts = { cfg: values.profile === "base" ? (Object.keys(overrides).length ? liveConfig(overrides) : undefined) : cfg, seasons: values.seasons !== "off" };

  console.log(`FUZZ · profile ${values.profile} · ${days} days · ${actionsPerDay} actions/day · launch ${values.launch} · three ${values.three} · seeds ${seeds.join(",")}`);
  let anyBad = false;
  for (const seed of seeds) {
    const t0 = performance.now();
    const res = fuzzSeed(seed, days, mk, actionsPerDay, values.trace, { three: values.three });
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    const bad = res.violations.length > 0 || !res.replayMatch;
    anyBad ||= bad;
    console.log(
      `  seed ${seed}: ${res.steps} steps (${res.okActions} ok, ${res.refusedActions} refused, ${res.threw} threw) · replay ${res.replayMatch ? "match" : "MISMATCH"} · ${res.violations.length} violations · ${secs}s`,
    );
    for (const v of res.violations.slice(0, 8)) console.log(`    ! day ${v.day} t${v.at} co${v.companyId} ${v.action}: ${v.messages.join("; ")}`);
    if (res.three) {
      const t = res.three;
      console.log(`    hash ${t.hash} · replay ${t.replayHash}`);
      console.log(`    new actions ok/tried: ${Object.keys(t.tried).filter((k) => ["form_brokerage", "transfer_capital", "pass_tender", "accept_tender", "tender_own", "cash_invoice", "reserve_deposit", "reserve_withdraw", "rebroker_load"].includes(k)).map((k) => `${k} ${t.ok[k] ?? 0}/${t.tried[k]}`).join(", ")}`);
      const top = Object.entries(t.reasons).sort((a, b) => b[1] - a[1]).slice(0, 14);
      for (const [k, n] of top) console.log(`      refused ${n}× ${k}`);
    }
  }
  console.log(anyBad ? "\nFUZZ FOUND VIOLATIONS" : "\nFuzz clean: every invariant held and replays matched.");
}

// Run as a script (npx tsx apps/sim/src/redteam/fuzz.ts …); imported (apps/sim/test/redteam.test.ts), it only exports fuzzSeed.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
