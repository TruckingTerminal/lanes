// Season check: runs the live game's world for a year and prints the rates loads actually
// cleared at, by origin and month, plus Miami inbound vs outbound van.
//   npx tsx apps/sim/src/seasons.ts [seed]
import { ruleBotHook } from "@lanes/agents";
import { stepHour } from "@lanes/engine";
import { newWorld } from "../../web/src/game.js";

const w = newWorld(Number(process.argv[2] ?? 7));
const idx = (id: string) => w.net.hubs.findIndex((h) => h.id === id);
type Key = string;
const sum = new Map<Key, { rate: number; n: number }>();
const add = (k: Key, rate: number) => {
  const s = sum.get(k) ?? { rate: 0, n: 0 };
  s.rate += rate;
  s.n++;
  sum.set(k, s);
};
w.listener = (e) => {
  if (e.kind !== "won") return;
  const load = w.loads.get(e.loadId)!;
  const month = Math.min(11, Math.floor((w.t / 1440 % 365) / 30.42));
  add(`${w.net.hubs[e.origin]!.id}|${load.equipment}|${month}`, e.rate);
  add(`${w.net.hubs[e.origin]!.id}>${w.net.hubs[e.dest]!.id}|${load.equipment}|${month}`, e.rate);
  add(`ALL|${load.equipment}|${month}`, e.rate);
};
// Warm up a month so the markets settle, then record a full year.
for (let h = 0; h < 24 * 395; h++) stepHour(w, ruleBotHook);
const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const row = (label: string, key: (m: number) => Key) => {
  const vals = M.map((_, m) => {
    const s = sum.get(key(m));
    return s && s.n >= 3 ? (s.rate / s.n).toFixed(2) : "  -  ";
  });
  console.log(label.padEnd(22), vals.join(" "));
};
console.log("".padEnd(22), M.map((m) => m.padEnd(4)).join(" "));
for (const [hub, eq] of [["MIA", "reefer"], ["MCO", "reefer"], ["SAV", "reefer"], ["LRD", "reefer"], ["FAT", "reefer"], ["MIA", "van"], ["ATL", "van"], ["MIA", "flatbed"], ["ALL", "reefer"], ["ALL", "van"]] as const)
  row(`${hub} ${eq} out`, (m) => `${hub}|${eq}|${m}`);
let into = { r: 0, n: 0 };
let out = { r: 0, n: 0 };
for (const [k, s] of sum) {
  if (!k.includes(">") || !k.includes("|van|")) continue;
  if (k.startsWith("ATL>MIA") || k.startsWith("JAX>MIA") || k.startsWith("SAV>MIA")) { into.r += s.rate; into.n += s.n; }
  if (k.startsWith("MIA>ATL") || k.startsWith("MIA>JAX") || k.startsWith("MIA>SAV")) { out.r += s.rate; out.n += s.n; }
}
console.log(`van into MIA (from ATL/JAX/SAV): ${(into.r / into.n).toFixed(2)}/mi over ${into.n} loads; out of MIA to them: ${(out.r / out.n).toFixed(2)}/mi over ${out.n} loads`);
console.log("reload index MIA", w.reloadIndex[idx("MIA")]!.toFixed(2), "ATL", w.reloadIndex[idx("ATL")]!.toFixed(2));
