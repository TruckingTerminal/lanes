import { parseArgs } from "node:util";
import { economyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { companyAccount, createWorld, runDays } from "@lanes/engine";
import { populate, ruleBotHook } from "@lanes/agents";

// Tuning aid: per-strategy economics at checkpoints.
//   npx tsx apps/sim/src/inspect.ts --seed 1 --checkpoints 30,84,180,365
const { values } = parseArgs({
  options: {
    seed: { type: "string", default: "1" },
    checkpoints: { type: "string", default: "30,84,365" },
    oo: { type: "string", default: "400" },
    fleets: { type: "string", default: "120" },
    brokers: { type: "string", default: "60" },
  },
});

const net = buildNetwork(hubs, economyConfig);
const w = createWorld({ cfg: economyConfig, net, feeds: neutralFeeds, seed: Number(values.seed) });
populate(w, { freeOwnerOperators: Number(values.oo), fleets: Number(values.fleets), brokers: Number(values.brokers) });

let done = 0;
for (const cp of values.checkpoints!.split(",").map(Number)) {
  runDays(w, cp - done, ruleBotHook);
  done = cp;
  const last30 = w.metrics.days.slice(-30);
  const avg = (f: (d: (typeof last30)[number]) => number) => last30.reduce((s, d) => s + f(d), 0) / last30.length;
  console.log(`\n-- day ${cp} · last 30d: posted ${avg((d) => d.posted).toFixed(0)}/d, cleared ${avg((d) => d.cleared).toFixed(0)}/d, sinks/faucets ${((100 * avg((d) => d.sinkFd)) / avg((d) => d.faucetFd)).toFixed(0)}%, owned trucks ${w.trucks.filter((t) => t.lease === "owned").length}, tractors left ${w.supply.tractor.workhorse + w.supply.tractor.highwayPro}`);
  const rows = new Map<string, { n: number; trucks: number; delivered: number; cash: number[]; miles: number; bought: number; idle: number; repo: number }>();
  for (const c of w.companies) {
    const r = rows.get(c.strategy) ?? { n: 0, trucks: 0, delivered: 0, cash: [], miles: 0, bought: 0, idle: 0, repo: 0 };
    const fleet = w.trucksByCompany.get(c.id)!;
    r.n++;
    r.trucks += fleet.length;
    r.delivered += c.delivered;
    r.cash.push(w.ledger.balance(companyAccount(c.id)));
    r.miles += c.milesTotal;
    if (c.firstOwnedTruckDay !== null) r.bought++;
    r.idle += fleet.filter((t) => t.status === "idle").length;
    r.repo += fleet.filter((t) => t.status === "repositioning").length;
    rows.set(c.strategy, r);
  }
  for (const [k, r] of [...rows].sort()) {
    const cash = [...r.cash].sort((a, b) => a - b);
    console.log(
      `${k.padEnd(20)} n ${String(r.n).padStart(3)} · trucks/co ${(r.trucks / r.n).toFixed(1).padStart(4)} · loads/truck ${(r.delivered / Math.max(1, r.trucks)).toFixed(1).padStart(5)}` +
        ` · cash p10/p50/p90 ${cash[Math.floor(cash.length * 0.1)]!.toFixed(0)}/${cash[Math.floor(cash.length / 2)]!.toFixed(0)}/${cash[Math.floor(cash.length * 0.9)]!.toFixed(0)}` +
        ` · miles/co ${(r.miles / r.n).toFixed(0)} · bought ${r.bought} · idle ${r.idle} repo ${r.repo}`,
    );
  }
}
