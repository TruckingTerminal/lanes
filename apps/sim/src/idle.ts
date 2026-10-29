// Why are trucks standing still? Runs the live world's rules at a population multiple and, every
// in-game hour, sorts every truck into driving / stopped on a trip (rest, breakdown) / at a dock /
// idle for a reason (no driver, driver off, hours used up, priced out, nothing in range) / off road.
//   npx tsx apps/sim/src/idle.ts [populationMultiple] [sampleDays] [warmUpDays] [baseLoadsPerRound]
import { populate, ruleBotHook } from "@lanes/agents";
import { economyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds, syntheticCassCycle } from "@lanes/data";
import { createWorld, runDays, stepHour, type World } from "@lanes/engine";

const mult = Number(process.argv[2] ?? 1);
const days = Number(process.argv[3] ?? 30);
const warm = Number(process.argv[4] ?? 20);
const baseLoads = Number(process.argv[5] ?? economyConfig.freight.baseLoadsPerRound);
const cfg = {
  ...economyConfig,
  seasonClose: { ...economyConfig.seasonClose, enabled: false },
  token: { ...economyConfig.token, enabled: true },
  freight: { ...economyConfig.freight, baseLoadsPerRound: baseLoads },
};
const net = buildNetwork(hubs, cfg);
const seed = 5;
const w: World = createWorld({ cfg, net, feeds: { ...neutralFeeds, cycle: syntheticCassCycle({ seed }) }, seed });
const pop = { freeOwnerOperators: Math.round(400 * mult), fleets: Math.round(120 * mult), brokers: Math.round(60 * mult) };
populate(w, pop);
runDays(w, warm, ruleBotHook);

const MIN = 60;
const tally = new Map<string, number>();
const add = (k: string) => tally.set(k, (tally.get(k) ?? 0) + 1);
let samples = 0;
const staffById = () => new Map(w.staff.map((s) => [s.id, s]));
const t0 = Date.now();
const hours = (days * cfg.time.gameMinutesPerDay) / MIN;
const day0 = w.metrics.days.length;
// Idle spells: hours a crewed truck (driver not on home time) sits in "idle" before it moves or loads.
const spellStart = new Map<number, number>();
const spells: number[] = [];
let longIdleNow = 0; // truck-hours spent in a spell already longer than 36 h
const seenLoads = new Set<number>();
let newLoads = 0;
let openSum = 0;
// What expires: snapshot the loads about to give up before each hour; the ones gone after a round boundary expired.
type Gone = { brokered: boolean; rebroker: boolean; eq: string; hub: string; ratio: number; local: boolean; idleSameEq: number; idleNear: number };
const gone: Gone[] = [];
for (let h = 0; h < hours; h++) {
  const before = new Map(w.trucks.map((t) => [t.id, t.remainingMi]));
  const roundBefore = w.round;
  const dueToExpire = [...w.loads.values()].filter((l) => l.status === "open" && l.roundsUnfilled >= cfg.board.giveUpAfterRounds - 1);
  stepHour(w, ruleBotHook);
  if (w.round !== roundBefore) {
    const idleByEq = new Map<string, number>();
    const idleTrucks = w.trucks.filter((t) => t.status === "idle" && t.driverId);
    for (const t of idleTrucks) idleByEq.set(t.trailer, (idleByEq.get(t.trailer) ?? 0) + 1);
    for (const l of dueToExpire) {
      if (w.loads.has(l.id)) continue;
      const o = net.places[l.originPlace]!;
      const near = idleTrucks.filter((t) => t.trailer === l.equipment && Math.hypot(net.places[t.place]!.lat - o.lat, (net.places[t.place]!.lon - o.lon) * 0.8) * 69 <= 400).length;
      gone.push({ brokered: l.brokerId !== null, rebroker: l.doubleBroker !== null, eq: l.equipment, hub: hubs[l.origin]!.id, ratio: l.ceiling / l.refRate, local: l.localUntilRound > 0, idleSameEq: idleByEq.get(l.equipment) ?? 0, idleNear: near });
    }
  }
  for (const l of w.loads.values()) {
    if (!seenLoads.has(l.id)) {
      seenLoads.add(l.id);
      newLoads++;
    }
    if (l.status === "open") openSum++;
  }
  const staff = staffById();
  for (const t of w.trucks) {
    const d = staff.get(t.driverId);
    const waiting = t.status === "idle" && !!d && d.status === "employed" && d.homeUntilDay === null;
    if (waiting) {
      if (!spellStart.has(t.id)) spellStart.set(t.id, h);
      else if (h - spellStart.get(t.id)! >= 36) longIdleNow++;
    } else if (spellStart.has(t.id)) {
      spells.push(h - spellStart.get(t.id)!);
      spellStart.delete(t.id);
    }
    samples++;
    switch (t.status) {
      case "retired":
      case "listed":
      case "parked":
      case "repair":
        add(`off road: ${t.status}`);
        continue;
      case "loading":
      case "unloading":
        add("at a dock");
        continue;
      case "toPickup":
      case "loaded":
      case "repositioning": {
        const moved = (before.get(t.id) ?? t.remainingMi) - t.remainingMi > 1e-6;
        if (moved) add(`driving: ${t.status}`);
        else if (t.breakdownMin > 0) add("stopped on trip: breakdown");
        else add("stopped on trip: rest / hours");
        continue;
      }
      case "idle": {
        if (!t.driverId) {
          add("idle: no driver");
          continue;
        }
        const d = staff.get(t.driverId);
        if (d && d.status !== "employed") {
          add(`idle: driver ${d.status}`);
          continue;
        }
        if (d && d.homeUntilDay !== null) {
          add("idle: driver on home time");
          continue;
        }
        const hoursUp = t.shiftStartT !== null && t.shiftDrivenMin >= cfg.hos.drivingHoursPerDay * MIN && w.t < t.shiftStartT + cfg.hos.dutyDayHours * MIN;
        if (hoursUp) add("idle: driving hours used up (rest)");
        else if (t.pricedOutRound === w.round) add("idle: loads in range, none worth taking");
        else add("idle: waiting, nothing in range");
        continue;
      }
    }
  }
}
const ms = Date.now() - t0;
const sampled = w.metrics.days.slice(day0);
const sum = (k: keyof (typeof sampled)[number]) => sampled.reduce((s, m) => s + (m[k] as number), 0) / sampled.length;
const carriers = w.companies.filter((c) => c.role === "carrier" && c.liquidatingSince === null).length;
console.log(`population x${mult}: ${JSON.stringify(pop)}; trucks ${w.trucks.length}, carriers ${carriers}, drivers employed ${sum("drivers").toFixed(0)}`);
console.log(`sim speed: ${(ms / hours).toFixed(1)} ms per game hour (${(ms / days / 1000).toFixed(2)} s per game day) in node`);
console.log(`per day: posted ${sum("posted").toFixed(0)}, cleared by carriers ${sum("cleared").toFixed(0)}, rolled to next round ${sum("rolled").toFixed(0)}, expired unhauled ${sum("expired").toFixed(0)}, delivered ${sum("delivered").toFixed(0)}, idle trucks at midnight ${sum("idleTrucks").toFixed(0)}`);
console.log(`freight (base ${baseLoads}/round): new loads ${(newLoads / days).toFixed(0)}/day, expired ${((100 * sum("expired")) / (newLoads / days)).toFixed(0)}% of them, open on the board at any moment ${(openSum / hours).toFixed(0)}, avg cleared rate ${sum("avgClearedRate").toFixed(2)} FD/mi, avg margin ${sum("avgMarginPct").toFixed(1)}%`);
const rows = [...tally.entries()].sort((a, b) => b[1] - a[1]);
for (const [k, v] of rows) console.log(`  ${((100 * v) / samples).toFixed(1).padStart(5)}%  ${k}`);
const driving = rows.filter(([k]) => k.startsWith("driving")).reduce((s, [, v]) => s + v, 0);
console.log(`moving at any moment: ${((100 * driving) / samples).toFixed(1)}% of trucks (${((driving / samples) * w.trucks.length).toFixed(0)} trucks)`);
spells.sort((a, b) => a - b);
const q = (p: number) => spells[Math.min(spells.length - 1, Math.floor(spells.length * p))] ?? 0;
const over = (hrs: number) => ((100 * spells.filter((s) => s > hrs).length) / Math.max(1, spells.length)).toFixed(1);
console.log(`idle spells (crewed, not home time): ${spells.length}; median ${q(0.5)} h, p90 ${q(0.9)} h, p99 ${q(0.99)} h; over 24 h ${over(24)}%, over 36 h ${over(36)}%, over 72 h ${over(72)}%`);
console.log(`trucks sitting in a spell already past 36 h, at any moment: ${(longIdleNow / hours).toFixed(0)} (${((100 * longIdleNow) / samples).toFixed(1)}%)`);
const unfinished = [...spellStart.values()].map((s) => hours - s).filter((s) => s > 72).length;
console.log(`still sitting at the end, past 72 h: ${unfinished}`);
if (gone.length) {
  const share = (f: (g: Gone) => boolean) => ((100 * gone.filter(f).length) / gone.length).toFixed(0);
  const ratios = gone.map((g) => g.ratio).sort((a, b) => a - b);
  console.log(`expired loads seen: ${gone.length}; brokered ${share((g) => g.brokered)}%, re-posted ${share((g) => g.rebroker)}%, local-first ${share((g) => g.local)}%; van ${share((g) => g.eq === "van")}%, reefer ${share((g) => g.eq === "reefer")}%, flatbed ${share((g) => g.eq === "flatbed")}%`);
  console.log(`  ceiling over reference at expiry: median ${ratios[Math.floor(ratios.length / 2)]!.toFixed(2)}, p10 ${ratios[Math.floor(ratios.length * 0.1)]!.toFixed(2)}, p90 ${ratios[Math.floor(ratios.length * 0.9)]!.toFixed(2)}`);
  console.log(`  idle crewed trucks with that trailer, nationwide, when it expired: median ${[...gone].sort((a, b) => a.idleSameEq - b.idleSameEq)[Math.floor(gone.length / 2)]!.idleSameEq}; within 400 mi: median ${[...gone].sort((a, b) => a.idleNear - b.idleNear)[Math.floor(gone.length / 2)]!.idleNear}, none nearby ${share((g) => g.idleNear === 0)}%`);
  const byHub = new Map<string, number>();
  for (const g of gone) byHub.set(g.hub, (byHub.get(g.hub) ?? 0) + 1);
  console.log(`  top origins: ${[...byHub.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([h, n]) => `${h} ${n}`).join(", ")}`);
}
