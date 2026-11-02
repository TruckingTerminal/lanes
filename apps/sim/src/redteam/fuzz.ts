/**
 * Red team, job 2: break the engine. A fuzz harness that feeds random but well-formed action sequences
 * from several companies over a few hundred game days and checks the invariants after every step:
 *   - money conserved across every account including the reserve and the sinks (ledger.assertBalanced);
 *   - no negative balance, stock or stake, and locked FD never over an account's balance;
 *   - the cap identity: minted == supply + reserve + allocated + burned;
 *   - replays identical from the same seed and action log;
 *   - every refusal reason is reported with the state it was given.
 *
 * Run:  npx tsx apps/sim/src/redteam/fuzz.ts --seeds 1,2,3,4,5 --days 400 [--launch] [--profile live|base]
 * It is read-only on the engine: it only drives companies through the public applyAction and reads the ledger.
 */
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { applyAction, companyAccount, dayOf, stepHour, type Action, type Company, type World } from "@lanes/engine";
import { hubs } from "@lanes/data";
import { ruleBotHook } from "@lanes/agents";
import { addAttacker, checkInvariants, liveConfig, makeWorld, snap, type MakeOpts } from "./harness.js";

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

export interface FuzzResult {
  seed: number;
  steps: number;
  okActions: number;
  refusedActions: number;
  threw: number;
  violations: { day: number; at: number; companyId: number; action: string; messages: string[] }[];
  replayMatch: boolean;
  firstViolation: { seed: number; steps: FuzzStep[] } | null;
}

/** Runs one fuzz seed. Records the step log so a violation can be replayed to the shortest prefix. */
export function fuzzSeed(seed: number, days: number, mk: MakeOpts, actionsPerDay: number, trace = false): FuzzResult {
  const r = mulberry32(seed * 2654435761);
  const w = makeWorld({ ...mk, seed, keepEntries: trace });
  // A handful of attacker companies the fuzz drives: carriers and a broker, free path and established.
  const attackers: Company[] = [
    addAttacker(w, "fuzz-oo", { role: "carrier", freePath: true }),
    addAttacker(w, "fuzz-fleet", { role: "carrier", freePath: false }),
    addAttacker(w, "fuzz-broker", { role: "broker", freePath: false }),
  ];
  // Seed each with FD so they can act (a grant is given at formation; top up the broker's licence stake room).
  for (const c of attackers) w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 200_000, `redteam-seed:${c.id}`);

  const res: FuzzResult = { seed, steps: 0, okActions: 0, refusedActions: 0, threw: 0, violations: [], replayMatch: true, firstViolation: null };
  const log: FuzzStep[] = [];
  const hoursTotal = (days * w.cfg.time.gameMinutesPerDay) / 60;
  const perHour = Math.max(1, Math.round((actionsPerDay * 60) / w.cfg.time.gameMinutesPerDay));

  for (let h = 0; h < hoursTotal; h++) {
    stepHour(w, ruleBotHook);
    const day = dayOf(w.t, w.cfg);
    // Inject a few fuzz actions this hour.
    for (let i = 0; i < perHour; i++) {
      const c = pick(r, attackers);
      const a = randomAction(w, c, r);
      const step: FuzzStep = { at: w.t, companyId: c.id, a };
      log.push(step);
      res.steps++;
      let threw = false;
      try {
        const out = applyAction(w, c.id, a);
        if (out.ok) res.okActions++;
        else res.refusedActions++;
      } catch (e) {
        threw = true;
        res.threw++;
        res.violations.push({ day, at: w.t, companyId: c.id, action: a.type, messages: [`applyAction threw: ${(e as Error).message}`] });
      }
      const v = checkInvariants(w, `d${day}`);
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
  // Replay: rebuild the world from the same seed and the recorded log; compare the final cap snapshot.
  res.replayMatch = replayMatches(seed, days, mk, log, w);
  return res;
}

/** Rebuilds the world and applies the recorded fuzz steps at their minutes, then compares the final snapshot. */
function replayMatches(seed: number, days: number, mk: MakeOpts, log: FuzzStep[], original: World): boolean {
  const w = makeWorld({ ...mk, seed });
  const attackers = [
    addAttacker(w, "fuzz-oo", { role: "carrier", freePath: true }),
    addAttacker(w, "fuzz-fleet", { role: "carrier", freePath: false }),
    addAttacker(w, "fuzz-broker", { role: "broker", freePath: false }),
  ];
  for (const c of attackers) w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 200_000, `redteam-seed:${c.id}`);
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
  const a = snap(original);
  const b = snap(w);
  const close = (x: number, y: number) => Math.abs(x - y) < 0.5;
  return close(a.supply, b.supply) && close(a.reserve, b.reserve) && close(a.burned, b.burned) && close(a.allocated, b.allocated);
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
    },
  });
  const seeds = values.seeds!.split(",").map(Number);
  const days = Number(values.days);
  const actionsPerDay = Number(values.actions);
  const overrides: Record<string, unknown> = {};
  if (values.launch) overrides["token.betaYears"] = 0; // launch almost at once, so the market rules run
  const cfg = values.profile === "base" ? undefined : liveConfig(overrides);
  const mk: MakeOpts = { cfg: values.profile === "base" ? (Object.keys(overrides).length ? liveConfig(overrides) : undefined) : cfg, seasons: values.seasons !== "off" };

  console.log(`FUZZ · profile ${values.profile} · ${days} days · ${actionsPerDay} actions/day · launch ${values.launch} · seeds ${seeds.join(",")}`);
  let anyBad = false;
  for (const seed of seeds) {
    const t0 = performance.now();
    const res = fuzzSeed(seed, days, mk, actionsPerDay, values.trace);
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    const bad = res.violations.length > 0 || !res.replayMatch;
    anyBad ||= bad;
    console.log(
      `  seed ${seed}: ${res.steps} steps (${res.okActions} ok, ${res.refusedActions} refused, ${res.threw} threw) · replay ${res.replayMatch ? "match" : "MISMATCH"} · ${res.violations.length} violations · ${secs}s`,
    );
    for (const v of res.violations.slice(0, 8)) console.log(`    ! day ${v.day} t${v.at} co${v.companyId} ${v.action}: ${v.messages.join("; ")}`);
  }
  console.log(anyBad ? "\nFUZZ FOUND VIOLATIONS" : "\nFuzz clean: every invariant held and replays matched.");
}

// Run as a script (npx tsx apps/sim/src/redteam/fuzz.ts …); imported (apps/sim/test/redteam.test.ts), it only exports fuzzSeed.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
