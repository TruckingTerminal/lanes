// The first board (sprint 1, 2026-11-02; studio/reviews/economy-first-board.md): what a new authority sees at a
// starter hub, and how often it may take a profitable open load, measured over the first days of a fresh world at
// the live profile, per hub and round. A probe company per hub (a free starter with no standing orders, so its truck
// sits at home and never bids) reads the board right after every round, the way a player does between rounds: the
// open loads out of its hub, which of them it may take (the vetting gate, hot loads, local-first, broker credit),
// and whether the ceiling clears its true break-even by the usual margin (the default dispatcher's +25%).
//   npx tsx apps/sim/src/firstBoard.ts --seeds 1,4,8 --days 14 --warm 0 --hubs CHI,DAL,PHX,MEM [--set path=value ...]
import { parseArgs } from "node:util";
import { economyConfig, withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds, syntheticCassCycle } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import {
  breakEvenPerMile,
  canMakeHot,
  companyById,
  createWorld,
  creditScore,
  dispatchProfile,
  expectedReloadDeadheadMi,
  formCompany,
  fuelPrice,
  hubMiles,
  isRoundBoundary,
  mayTake,
  placeMiles,
  placeToll,
  runDays,
  stepHour,
  vettingBlock,
  type Company,
  type Load,
  type Truck,
  type World,
} from "@lanes/engine";

const { values } = parseArgs({
  options: {
    seeds: { type: "string", default: "1,4,8" },
    days: { type: "string", default: "14" },
    // Days run before the probes join, for a board that isn't the world's first morning.
    warm: { type: "string", default: "0" },
    hubs: { type: "string", default: "CHI,DAL,PHX,MEM" },
    // The usual margin over break-even a load must clear at its ceiling to count as profitable.
    margin: { type: "string", default: "0.25" },
    // Print this many of the loads a probe may take at its first reading, with the numbers behind the margin.
    sample: { type: "string", default: "0" },
    set: { type: "string", multiple: true, default: [] },
  },
});

/** Copies the config and sets each `a.b.c=value` (numbers, booleans, or JSON arrays), as run.ts does. */
function applyOverrides(base: EconomyConfig, sets: string[]): EconomyConfig {
  if (sets.length === 0) return base;
  const out = structuredClone(base) as Record<string, unknown>;
  for (const s of sets) {
    const eq = s.indexOf("=");
    if (eq < 0) throw new Error(`--set ${s}: expected path=value`);
    const path = s.slice(0, eq);
    const raw = s.slice(eq + 1);
    const keys = path.split(".");
    let node = out;
    for (const k of keys.slice(0, -1)) {
      if (typeof node[k] !== "object" || node[k] === null) throw new Error(`--set ${path}: no such config path`);
      node = node[k] as Record<string, unknown>;
    }
    const last = keys.at(-1)!;
    if (!(last in node)) throw new Error(`--set ${path}: no such config value`);
    node[last] = raw === "true" ? true : raw === "false" ? false : raw.startsWith("[") ? JSON.parse(raw) : Number.isNaN(Number(raw)) ? raw : Number(raw);
  }
  return out as unknown as EconomyConfig;
}

const cfg = applyOverrides(withLiveLevers(economyConfig), values.set ?? []);
const net = buildNetwork(hubs, cfg);
const seeds = values.seeds!.split(",").map(Number);
const days = Number(values.days);
const warm = Number(values.warm);
const margin = Number(values.margin);
const hubIds = values.hubs!.split(",");
const sampleN = Number(values.sample);
const samples = new Map<string, string[]>(hubIds.map((h) => [h, []]));

/** One reading of a hub's board by a new authority with a dry van. */
interface Reading {
  /** Open loads out of the hub, every trailer; the van ones; the van ones it may take. */
  open: number;
  vans: number;
  mine: number;
  /** Van loads it may not take, by reason. */
  vetting: number;
  hot: number;
  held: number;
  credit: number;
  /** Loads it may take whose ceiling clears break-even by the margin / by 5%. */
  good: number;
  fair: number;
  bestMargin: number;
  /** The best book-now profit on offer (FD), null with nothing it may take. */
  bestBookNow: number | null;
  /** Loads clearing the margin at other hubs within the nearby radius. */
  nearGood: number;
}

/** The true break-even a card would show: estimateBreakEven (standingOrders.ts) without the dispatcher's noise. */
function trueBreakEven(w: World, truck: Truck, load: Load, dh: number, fuel: number, foresightDays: number, reloadWeight: number): number {
  const reloadMi = expectedReloadDeadheadMi(w, load.dest, load.equipment, foresightDays);
  const tolls = placeToll(w, truck.place, load.originPlace) + load.routeTollFd;
  const tr = w.cfg.roads.terrain;
  const lane = w.net.lanes[load.laneId];
  const climbFd = tr.enabled && lane ? tr.fuelGalPerClimbM * lane.climbM * fuel : 0;
  return breakEvenPerMile(w.cfg, truck, fuel, load.miles, dh + reloadWeight * reloadMi, tolls + climbFd);
}

function readBoard(w: World, c: Company): Reading {
  const truck = w.trucksByCompany.get(c.id)![0]!;
  const fuel = fuelPrice(w);
  const team = dispatchProfile(w, c, 1);
  const r: Reading = { open: 0, vans: 0, mine: 0, vetting: 0, hot: 0, held: 0, credit: 0, good: 0, fair: 0, bestMargin: -Infinity, bestBookNow: null, nearGood: 0 };
  for (const load of w.loads.values()) {
    if (load.status !== "open") continue;
    const home = load.origin === c.homeHub;
    if (!home && hubMiles(w, c.homeHub, load.origin) > w.cfg.map.nearbyRadiusMi) continue;
    if (home) r.open++;
    if (load.equipment !== truck.trailer) continue;
    if (home) r.vans++;
    if (vettingBlock(w, c, load) !== null) {
      if (home) r.vetting++;
      continue;
    }
    if (load.hot > 0 && !canMakeHot(c, truck)) {
      if (home) r.hot++;
      continue;
    }
    if (!mayTake(w, c, load)) {
      if (home) r.held++;
      continue;
    }
    if (load.brokerId !== null && creditScore(w, companyById(w, load.brokerId)) < c.minBrokerCredit) {
      if (home) r.credit++;
      continue;
    }
    const dh = placeMiles(w, truck.place, load.originPlace);
    const be = trueBreakEven(w, truck, load, dh, fuel, team.foresightDays, team.reloadWeight);
    const m = load.ceiling / be - 1;
    if (!home) {
      if (m >= margin) r.nearGood++;
      continue;
    }
    r.mine++;
    const sample = samples.get(w.net.hubs[c.homeHub]!.id)!;
    if (sample.length < sampleN) {
      const bare = breakEvenPerMile(w.cfg, truck, fuel, load.miles, dh, placeToll(w, truck.place, load.originPlace) + load.routeTollFd);
      sample.push(`#${load.id} ${w.net.hubs[load.dest]!.id} ${load.miles.toFixed(0)} mi ${load.brokerId !== null ? "broker" : "direct"} vet ${load.vet} rolled ${load.roundsUnfilled} ceiling ${load.ceiling.toFixed(2)} book-now ${load.bookNow.toFixed(2)} ref ${load.refRate.toFixed(2)} break-even ${be.toFixed(2)} (dh ${dh.toFixed(0)}; without the reload run ${bare.toFixed(2)}) margin ${(100 * m).toFixed(0)}%`);
    }
    if (m >= margin) r.good++;
    if (m >= 0.05) r.fair++;
    if (m > r.bestMargin) r.bestMargin = m;
    const bn = (load.bookNow - be) * load.miles;
    if (r.bestBookNow === null || bn > r.bestBookNow) r.bestBookNow = bn;
  }
  return r;
}

const readings = new Map<string, Reading[]>(hubIds.map((h) => [h, []]));
const t0 = Date.now();
for (const seed of seeds) {
  const w = createWorld({ cfg, net, feeds: { ...neutralFeeds, cycle: syntheticCassCycle({ seed }) }, seed });
  populate(w, { freeOwnerOperators: 400, fleets: 120, brokers: 60 });
  if (warm > 0) runDays(w, warm, ruleBotHook);
  // The probes join after the warm-up, so their authority is as new as a player's.
  const probes = hubIds.map((id) => formCompany(w, { name: `Probe-${id}`, role: "carrier", homeHubId: id, strategy: "player:probe", human: true, orders: [], freePath: true }));
  const hours = (days * cfg.time.gameMinutesPerDay) / 60;
  for (let h = 0; h < hours; h++) {
    stepHour(w, ruleBotHook);
    if (!isRoundBoundary(w.t, cfg)) continue;
    probes.forEach((c, k) => readings.get(hubIds[k]!)!.push(readBoard(w, c)));
  }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : NaN;
};
const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
const n1 = (x: number) => x.toFixed(1);
console.log(`LANES first board · config ${economyConfig.version} · live profile${values.set!.length ? ` · ${values.set!.join(" ")}` : ""} · seeds ${seeds.join(",")} · ${days} days after ${warm} warm · margin +${pct(margin)} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log("");
console.log(`| Hub | rounds | open loads at hub | van | may take | locked: vetting / hot / held / credit | +${pct(margin)} loads a round | rounds with one at +${pct(margin)} (by seed) | at +5% | median best margin | rounds book-now > 0 | median best book-now (FD) | rounds with one at +${pct(margin)} within 150 mi |`);
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
const perSeed = days * cfg.time.boardRoundHours.length;
for (const id of hubIds) {
  const rs = readings.get(id)!;
  const share = (f: (r: Reading) => boolean) => pct(rs.filter(f).length / rs.length);
  const bn = rs.map((r) => r.bestBookNow).filter((x): x is number => x !== null);
  console.log(
    `| ${id} | ${rs.length} | ${n1(mean(rs.map((r) => r.open)))} | ${n1(mean(rs.map((r) => r.vans)))} | ${n1(mean(rs.map((r) => r.mine)))}` +
      ` | ${n1(mean(rs.map((r) => r.vetting)))} / ${n1(mean(rs.map((r) => r.hot)))} / ${n1(mean(rs.map((r) => r.held)))} / ${n1(mean(rs.map((r) => r.credit)))}` +
      ` | ${n1(mean(rs.map((r) => r.good)))} | ${share((r) => r.good > 0)} (${seeds.map((_, k) => pct(rs.slice(k * perSeed, (k + 1) * perSeed).filter((r) => r.good > 0).length / perSeed)).join(" ")}) | ${share((r) => r.fair > 0)}` +
      ` | ${pct(median(rs.map((r) => r.bestMargin).filter(Number.isFinite)))} | ${share((r) => r.bestBookNow !== null && r.bestBookNow > 0)} | ${bn.length ? median(bn).toFixed(0) : "n/a"}` +
      ` | ${share((r) => r.good + r.nearGood > 0)} |`,
  );
}
// The same by day of the window: the first morning is thinner than the fourteen-day picture, since unfilled loads roll with their ceilings rising.
const perDay = cfg.time.boardRoundHours.length;
const buckets: [string, (day: number) => boolean][] = [["day 1", (d) => d === 0], ["day 2", (d) => d === 1], ["day 3", (d) => d === 2], ["days 4–7", (d) => d >= 3 && d <= 6], ["days 8+", (d) => d >= 7]];
console.log("");
console.log(`| Hub | ${buckets.map(([b]) => `${b}: rounds with a +${pct(margin)} load (mean such loads; book-now > 0)`).join(" | ")} |`);
console.log(`|---|${buckets.map(() => "---").join("|")}|`);
for (const id of hubIds) {
  const rs = readings.get(id)!;
  const rows = buckets.map(([, f]) => {
    const xs = rs.filter((_, i) => f(Math.floor((i % (days * perDay)) / perDay)));
    if (!xs.length) return "n/a";
    return `${pct(xs.filter((r) => r.good > 0).length / xs.length)} (${n1(mean(xs.map((r) => r.good)))}; ${pct(xs.filter((r) => r.bestBookNow !== null && r.bestBookNow > 0).length / xs.length)})`;
  });
  console.log(`| ${id} | ${rows.join(" | ")} |`);
}
for (const id of hubIds) for (const line of samples.get(id)!) console.log(`${id}: ${line}`);
