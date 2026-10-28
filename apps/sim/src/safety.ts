import { parseArgs } from "node:util";
import { economyConfig, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds, syntheticCassCycle } from "@lanes/data";
import { companyAccount, createWorld, runDays, type Company, type World } from "@lanes/engine";
import { botConduct, populate, ruleBotHook } from "@lanes/agents";

// Staff, safety and fraud by bot persona: who crashes, who gets caught, who gets rich.
//   npx tsx apps/sim/src/safety.ts --seed 7 --days 730
const { values } = parseArgs({ options: { seed: { type: "string", default: "7" }, days: { type: "string", default: "365" } } });
const cfg: EconomyConfig = { ...economyConfig, seasonClose: { ...economyConfig.seasonClose, enabled: false }, token: { ...economyConfig.token, enabled: true } };
const net = buildNetwork(hubs, cfg);
const seed = Number(values.seed);
const w: World = createWorld({ cfg, net, feeds: { ...neutralFeeds, cycle: syntheticCassCycle({ seed }) }, seed });
populate(w, { freeOwnerOperators: 400, fleets: 120, brokers: 60 });

const crashesBy = new Map<string, number>();
const fatalBy = new Map<string, number>();
w.listener = (e) => {
  if (e.kind !== "notice" || e.topic !== "crash") return;
  const k = botConduct(w.companies[e.companyId - 1]!) ?? "human";
  crashesBy.set(k, (crashesBy.get(k) ?? 0) + 1);
  if (e.text.includes("fatal")) fatalBy.set(k, (fatalBy.get(k) ?? 0) + 1);
};
// Where each persona's money goes: company outflows by destination tag.
const flows = new Map<string, Map<string, number>>();
const post = w.ledger.post.bind(w.ledger);
w.ledger.post = (t, from, to, amount, ref) => {
  if (from.startsWith("co:") && /^co:\d+$/.test(from)) {
    const c = w.companies[Number(from.slice(3)) - 1];
    if (c && c.role === "carrier") {
      const k = botConduct(c) ?? "human";
      const m = flows.get(k) ?? new Map<string, number>();
      const tag = to.startsWith("co:") ? "transfer" : to;
      m.set(tag, (m.get(tag) ?? 0) + amount);
      flows.set(k, m);
    }
  }
  post(t, from, to, amount, ref);
};
runDays(w, Number(values.days), ruleBotHook);

const carriers = w.companies.filter((c) => c.role === "carrier");
const groups = new Map<string, Company[]>();
for (const c of carriers) {
  const k = botConduct(c) ?? "human";
  groups.set(k, [...(groups.get(k) ?? []), c]);
}
const wealth = (c: Company) => w.ledger.balance(companyAccount(c.id));
console.log(`seed ${seed}, ${values.days} days`);
console.log("conduct   n    revoked  liquid.  crashes fatal  fines/co  wealth avg  rating none/sat/cond/unsat");
for (const [k, cs] of groups) {
  const r = (x: Company["safety"]["rating"]) => cs.filter((c) => c.safety.rating === x).length;
  console.log(
    `${k.padEnd(8)} ${String(cs.length).padStart(4)}  ${String(cs.reduce((s, c) => s + c.authority.revocations, 0)).padStart(7)}  ${String(cs.reduce((s, c) => s + c.bankruptcies, 0)).padStart(7)}` +
      `  ${String(crashesBy.get(k) ?? 0).padStart(7)} ${String(fatalBy.get(k) ?? 0).padStart(5)}  ${Math.round(cs.reduce((s, c) => s + c.safety.finesFd, 0) / cs.length).toString().padStart(8)}` +
      `  ${Math.round(cs.reduce((s, c) => s + wealth(c), 0) / cs.length).toString().padStart(10)}  ${r("none")}/${r("satisfactory")}/${r("conditional")}/${r("unsatisfactory")}`,
  );
}
const TAGS = ["sink:fuel", "sink:driver_wages", "sink:maintenance", "sink:repairs", "sink:insurance", "sink:fines", "sink:liability", "sink:seized", "sink:cargo_claim", "sink:dispatch", "sink:npc_lease"];
console.log("per company:  " + TAGS.map((t) => t.slice(5).padStart(9)).join(""));
for (const [k, cs] of groups) {
  const m = flows.get(k) ?? new Map();
  console.log(`${k.padEnd(12)} ${TAGS.map((t) => String(Math.round((m.get(t) ?? 0) / cs.length)).padStart(9)).join("")}`);
}
// Trucks without a driver, by why.
const crewless = w.trucks.filter((t) => t.companyId !== 0 && t.driverId === 0 && !["parked", "listed", "retired"].includes(t.status));
const why = new Map<string, number>();
for (const t of crewless) {
  const c = w.companies[t.companyId - 1]!;
  const k = c.authority.status === "revoked" ? "revoked" : c.liquidatingSince !== null ? "liquidating" : `${t.status}/${t.lease}`;
  why.set(k, (why.get(k) ?? 0) + 1);
}
console.log("trucks without a driver:", crewless.length, Object.fromEntries(why));
const pool = w.staff.filter((s) => s.status === "pool" && s.kind === "driver");
console.log(`driver pool ${pool.length} (skill ≥0.15: ${pool.filter((s) => s.skill >= 0.15).length}), wage index ${w.labor.wageIndex.toFixed(3)}, dispatchers employed ${w.staff.filter((s) => s.kind === "dispatcher" && s.status === "employed").length}, in pool ${w.staff.filter((s) => s.kind === "dispatcher" && s.status === "pool").length}`);
const cases = w.cases;
console.log(`fraud cases: theft ${cases.filter((k) => k.kind === "theft").length} (caught ${cases.filter((k) => k.kind === "theft" && k.caught).length}), double brokering ${cases.filter((k) => k.kind === "doubleBroker").length} (caught ${cases.filter((k) => k.kind === "doubleBroker" && k.caught).length})`);
