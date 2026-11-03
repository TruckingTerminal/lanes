import { writeOffRig } from "./assets.js";
import { heatPullInAdd, heatReviewOdds, investigate } from "./backlot.js";
import { stationsOnRoute, weighStations, type Network } from "@lanes/data";
import { opsCrashMult, opsPullInMult } from "./labor.js";
import { dayOf, MINUTES_PER_HOUR } from "./clock.js";
import { fmtInt } from "./economics.js";
import { slashStake } from "./staking.js";
import { payClaim } from "./pools.js";
import { contractAccount } from "./receivables.js";
import { activeLoanOn, settleLoanFromSale } from "./finance.js";
import { recordClaim, signPolicy } from "./insurance.js";
import { dispatchersOf, jail, pushesRules, releaseAll, removeStaff, driverFatigue } from "./labor.js";
import { companyAccount } from "./ledger.js";
import { refile, startLiquidation } from "./solvency.js";
import type { Basic, Company, CrashSeverity, Load, Truck } from "./types.js";
import { condition } from "./wear.js";
import { payTripCosts } from "./trips.js";
import { companyById, detachTruck, hubRoute, staffById, syncFleet, type World, placeRoute } from "./world.js";

/**
 * Safety and compliance (design proposal, Jeff 2026-10-28). Owners pick how legal
 * to run (CompliancePolicy): falsified logs buy 15 driving hours a day, speed buys
 * a little time, deferred maintenance saves money. Each raises crash odds, and
 * roadside enforcement — weigh stations on the real corridors, police stops, a
 * shipper's tracking — finds some of it. Violations build a CSA-style score that
 * pulls the company into more inspections, dearer insurance and, past a point, a
 * compliance review: conditional, unsatisfactory, then authority revoked. Crashes
 * are the tail: their cost, and what follows, depend on why they happened.
 */

export const PERMANENT_BAR = 1e9;
/** "Everything it has": a seizure no company can pay off. */
const SEIZE_ALL = 1e15;

const today = (w: World) => dayOf(w.t, w.cfg);

export function notice(w: World, companyId: number, topic: "safety" | "crash" | "fraud" | "authority" | "fleet", text: string, tone: "good" | "bad" | "info", truckId?: number): void {
  w.listener?.({ kind: "notice", companyId, topic, text, tone, truckId });
}

export function record(w: World, c: Company, text: string): void {
  c.authority.record.push({ day: today(w), text });
  if (c.authority.record.length > 60) c.authority.record.shift();
}

// --- Driving rules ------------------------------------------------------------------

const isTeam = (t: Truck) => t.coDriverId !== 0;

/** The load a truck is working (on its way to pick up, or hauling), if any. */
export function currentLoad(w: World, t: Truck): Load | undefined {
  return t.loadId !== null && (t.status === "toPickup" || t.status === "loaded" || t.status === "loading") ? w.loads.get(t.loadId) : undefined;
}

const applies = (scope: Company["policy"]["hos"], load: Load | undefined) => scope === "always" || (scope === "hot" && !!load && load.hot > 0);

/** Legal driving minutes per duty day: 11 hours solo, 22 for a team. */
export function legalDrivingMin(w: World, t: Truck): number {
  return (isTeam(t) ? w.cfg.safety.hos.teamHours : w.cfg.hos.drivingHoursPerDay) * MINUTES_PER_HOUR;
}

/** Minutes the truck will actually drive: legal, plus 4 hours on falsified logs if the company runs that way (teams never need to). */
export function drivingLimitMin(w: World, t: Truck, c: Company): number {
  const legal = legalDrivingMin(w, t);
  return !isTeam(t) && applies(c.policy.hos, currentLoad(w, t)) ? legal + w.cfg.safety.hos.overHours * MINUTES_PER_HOUR : legal;
}

export const speeding = (w: World, t: Truck, c: Company) => applies(c.policy.speed, currentLoad(w, t));

export function mphFor(w: World, t: Truck, c: Company, roadMph = w.cfg.hos.avgMph): number {
  const { hos, labor, safety } = w.cfg;
  const skill = 1 + labor.driver.mphRange * (t.driverSkill - 0.5);
  const tired = 1 - w.cfg.fatigue.paceLoss * driverFatigue(w, t);
  return roadMph * skill * tired * (speeding(w, t, c) ? safety.speed.fastMph / hos.avgMph : 1);
}

/** R18: what a stretch of driving earned, at the load's rate (or the board's average with none): its miles at the nominal pace. */
function drivingEarnedFd(w: World, t: Truck, minutes: number): number {
  const load = currentLoad(w, t);
  const rate = load?.clearedRate ?? w.metrics.days.at(-1)?.avgClearedRate ?? 0;
  return (minutes / MINUTES_PER_HOUR) * w.cfg.hos.avgMph * rate;
}

/** R18: a fine of at least fineEarnedMult × what the breach earned (the flat draw when the key is 0). */
const scaledFine = (w: World, flat: number, earnedFd: number | undefined): number => Math.max(flat, w.cfg.safety.enforcement.fineEarnedMult * (earnedFd ?? 0));

/**
 * A duty day closes: hours driven past the legal limit go on a falsified log —
 * hidden until someone looks. On a load with tracking (strict vetting), the
 * shipper's tracking shows it at once.
 */
export function closeDutyDay(w: World, t: Truck): void {
  if (t.overMin <= 0 || t.companyId === 0) {
    t.overMin = 0;
    return;
  }
  const c = companyById(w, t.companyId);
  const day = today(w);
  const load = currentLoad(w, t);
  const over = t.overMin;
  t.overMin = 0;
  if (load && load.vet === 2) {
    const { fines, points } = w.cfg.safety.enforcement;
    violate(w, c, "hos", points.hos, "tracking showed illegal hours");
    fine(w, c, fines.tracked, `tracking:${t.id}`);
    notice(w, c.id, "safety", `Truck ${t.id}: the shipper's tracking showed over 11 hours driving. ${fines.tracked} FD fine and an HOS violation.`, "bad", t.id);
    return;
  }
  t.logDays.push(day);
  while (t.logDays.length > 0 && t.logDays[0]! < day - w.cfg.safety.enforcement.recentLogDays) t.logDays.shift();
  const earned = w.cfg.safety.enforcement.fineEarnedMult > 0 ? drivingEarnedFd(w, t, over) : undefined;
  c.safety.hidden.push(earned === undefined ? { day, kind: "falseLog", truckId: t.id } : { day, kind: "falseLog", truckId: t.id, earnedFd: earned });
}

// --- Records, fines, money owed --------------------------------------------------------

export function violate(w: World, c: Company, basic: Basic, points: number, what: string): void {
  c.safety.violations.push({ day: today(w), basic, points, what });
}

export function fine(w: World, c: Company, amount: number, ref: string): void {
  w.ledger.post(w.t, companyAccount(c.id), "sink:fines", amount, `fine:${ref}`);
  c.safety.finesFd += amount;
  c.finesOffCostsFd = (c.finesOffCostsFd ?? 0) + amount; // the month record's spent (intel.ts); no rule reads it
}

/**
 * A judgment or seizure: paid now from whatever cash there is, the rest owed and
 * taken from what comes in later (liquidation sales). Never pushes the balance
 * below zero, so a verdict bigger than the company creates no debt to write off.
 */
export function owe(w: World, c: Company, amount: number, tag: "sink:liability" | "sink:seized"): void {
  c.judgmentFd += amount;
  collect(w, c, tag);
}

/**
 * A crash bill: small ones are paid like any cost (into the red if need be); one
 * bigger than the company can pay becomes a judgment, and the company is wound up
 * to pay it — the way a nuclear verdict ends a small carrier.
 */
const SMALL_BILL_FD = 25_000;
function payOrBankrupt(w: World, c: Company, amount: number): void {
  if (amount <= SMALL_BILL_FD) {
    w.ledger.post(w.t, companyAccount(c.id), "sink:liability", amount, `liability:${c.id}`);
    return;
  }
  owe(w, c, amount, "sink:liability");
  if (c.judgmentFd > 0 && c.liquidatingSince === null) {
    record(w, c, `A ${fmt(amount)} FD judgment the company can't pay: liquidation.`);
    notice(w, c.id, "authority", `The company can't pay a ${fmt(amount)} FD judgment. Its trucks are being sold to pay it; then it starts over on the free path.`, "bad");
    startLiquidation(w, c);
  }
}

export function collect(w: World, c: Company, tag: "sink:liability" | "sink:seized" = "sink:liability"): void {
  if (c.judgmentFd <= 0) return;
  const pay = Math.min(c.judgmentFd, Math.max(0, w.ledger.balance(companyAccount(c.id))));
  if (pay > 0) w.ledger.post(w.t, companyAccount(c.id), tag, pay, `judgment:${c.id}`);
  c.judgmentFd -= pay;
}

// --- On the road --------------------------------------------------------------------------

const stationCache = new WeakMap<Network, Map<number, { station: number; frac: number }[]>>();

/** Weigh stations on the roads from hub a to hub b, as fractions of the route. */
export function stationsOnLeg(w: World, a: number, b: number): { station: number; frac: number }[] {
  let cache = stationCache.get(w.net);
  if (!cache) stationCache.set(w.net, (cache = new Map()));
  const key = a * w.net.places.length + b;
  let list = cache.get(key);
  if (!list) {
    const route = placeRoute(w, a, b);
    list = route ? w.net.roads.stationsAlong(route) : stationsOnRoute(w.net.places[a]!, w.net.places[b]!, w.cfg.safety.enforcement.stationRadiusMi);
    cache.set(key, list);
  }
  return list;
}

/**
 * The road's own risk on this leg: two-lane highway over interstate, and winter
 * weather up north (from the fraction of the leg on highway and where it runs).
 */
/** Whether it is winter on the roads (config roads.winter.months). */
export function winterNow(w: World): boolean {
  const month = Math.floor(((today(w) % w.cfg.time.daysPerSeason) / w.cfg.time.daysPerSeason) * 12);
  return w.cfg.roads.winter.months.includes(month as 0 | 1 | 11);
}

export function roadRisk(w: World, t: Truck): number {
  const { crashHighwayMult, winter, terrain } = w.cfg.roads;
  const hs = t.legHighwayShare;
  // Mountain grades (roads.terrain): the share of the leg on them lifts the odds.
  const mountain = terrain.enabled && t.legMiles > 0 ? 1 + terrain.crashPerMountainShare * (t.legMountainMi / t.legMiles) : 1;
  const road = (1 + (crashHighwayMult - 1) * hs) * mountain;
  if (!winterNow(w)) return road;
  const lat = (w.net.places[t.place]!.lat + w.net.places[t.targetPlace]!.lat) / 2;
  const north = Math.min(1, Math.max(0, (lat - winter.fromLat) / (winter.toLat - winter.fromLat)));
  return road * (1 + north * (winter.gain.interstate * (1 - hs) + winter.gain.highway * hs));
}

/** Crash odds multiplier right now: fatigue, speed, defects, wear, the driver, and the road and the weather. */
export function crashMultiplier(w: World, t: Truck, c: Company): number {
  const { crash, maintenance } = w.cfg.safety;
  const [atZero, atOne] = w.cfg.labor.driver.crash;
  const fatigue = 1 + crash.fatiguePerOverHour * (t.overMin / MINUTES_PER_HOUR);
  const fast = speeding(w, t, c) ? crash.fastMult : 1;
  const defects = 1 + maintenance.crashPerDefect * t.defects;
  const wear = 1 + 0.5 * (1 - condition(w.cfg, t));
  const tired = 1 + w.cfg.fatigue.crashMult * driverFatigue(w, t);
  return fatigue * tired * fast * defects * wear * (atZero + (atOne - atZero) * t.driverSkill) * roadRisk(w, t) * opsCrashMult(w, c); // an operations manager (labor.ts)
}

/**
 * Everything that can happen to a truck over `miles` it just drove, from fraction
 * `from` to `to` of its leg: defects from skipped maintenance, a crash, a police
 * stop, and each weigh station it passes. "crash" ends the truck's hour; "stop"
 * means it was put out of service and has stopped minutes to sit out.
 */
export function safetyTick(w: World, t: Truck, miles: number, to: number): "crash" | "stop" | null {
  if (t.companyId === 0) return null;
  const c = companyById(w, t.companyId);
  const { safety } = w.cfg;
  const rng = w.rng.safety;
  const rate = safety.maintenance.defectPer1000Mi[c.policy.maintenance] * (2 - condition(w.cfg, t));
  if (rng.next() < (rate * miles) / 1000) t.defects++;
  if (rng.next() < (safety.crash.per1MMi * miles * crashMultiplier(w, t, c)) / 1e6) {
    crash(w, t, c);
    return "crash";
  }
  let stopped = false;
  const fast = speeding(w, t, c);
  if (rng.next() < (safety.enforcement.policePer1000Mi * miles * (fast ? safety.enforcement.fastStopMult : 1)) / 1000) {
    stopped = policeStop(w, t, c, fast) || stopped;
  }
  const stations = stationsOnLeg(w, t.place, t.targetPlace);
  while (t.nextStation < stations.length && stations[t.nextStation]!.frac <= to) {
    const s = stations[t.nextStation++]!;
    stopped = weighStation(w, t, c, s.station) || stopped;
  }
  return stopped ? "stop" : null;
}

function pullInOdds(w: World, c: Company): number {
  const p = w.cfg.safety.enforcement.pullIn;
  // Clean carriers mostly get the bypass; a bad score lights up the screen.
  let odds = c.safety.rating === "unsatisfactory" ? p.unsatisfactory : c.safety.rating === "conditional" ? p.conditional : c.safety.alerts.length > 0 ? p.alert : p.clean;
  if (today(w) - c.authority.since < w.cfg.safety.review.newEntrantDay) odds = Math.max(odds, p.newEntrant);
  // Heat (robbery.lot): a company the law has its eye on gets pulled in more.
  return (odds + heatPullInAdd(w, c)) * opsPullInMult(w, c); // an operations manager keeps the paperwork straight (labor.ts)
}

function weighStation(w: World, t: Truck, c: Company, station: number): boolean {
  const e = w.cfg.safety.enforcement;
  const rng = w.rng.safety;
  if (rng.next() >= e.stationOpen || rng.next() >= pullInOdds(w, c) || rng.next() >= e.inspectShare) return false;
  const level = 1 + rng.weighted(e.levels);
  const s = weighStations[station]!;
  return inspect(w, t, c, level, `the ${s.name} scale (${s.route})`);
}

function policeStop(w: World, t: Truck, c: Company, fast: boolean): boolean {
  const e = w.cfg.safety.enforcement;
  const rng = w.rng.safety;
  let ticketed = false;
  if (fast && rng.next() < e.speedingTicket) {
    // R18: the day's time saved at 56 mph against 50, at the load's rate.
    const saved = e.fineEarnedMult > 0 ? drivingEarnedFd(w, t, t.shiftDrivenMin * (1 - w.cfg.hos.avgMph / w.cfg.safety.speed.fastMph)) : undefined;
    const amount = Math.round(scaledFine(w, rng.int(e.fines.speeding[0], e.fines.speeding[1]), saved));
    fine(w, c, amount, `speeding:${t.id}`);
    violate(w, c, "unsafe", e.points.speeding, "speeding");
    if (t.driverId) staffById(w, t.driverId).violations++;
    ticketed = true;
    notice(w, c.id, "safety", `Truck ${t.id} pulled over for speeding: ${amount} FD ticket.`, "bad", t.id);
  }
  if (rng.next() < e.stopInspect) return inspect(w, t, c, 3, "a police stop");
  if (ticketed) c.safety.inspections.push(today(w));
  return false;
}

/**
 * A roadside inspection. Level 1 checks driver and truck, 2 a walk-around of the
 * truck, 3 the driver and logs. Falsified logs from the last 8 days and defects
 * can turn up; serious ones put the driver or truck out of service on the spot.
 * Returns whether the truck was put out of service.
 */
export function inspect(w: World, t: Truck, c: Company, level: number, where: string): boolean {
  const e = w.cfg.safety.enforcement;
  const rng = w.rng.safety;
  const day = today(w);
  c.safety.inspections.push(day);
  const found: string[] = [];
  let oosMin = 0;
  if (level === 1 || level === 3) {
    // Over hours right now: the ELD shows it.
    if (t.overMin > 0 && rng.next() < Math.min(0.95, e.logDetect + 0.3)) {
      violate(w, c, "hos", e.points.hos, "driving past the hours limit");
      violate(w, c, "hos", e.points.falseLog, "false log");
      fine(w, c, Math.round(scaledFine(w, rng.int(e.fines.hosOos[0], e.fines.hosOos[1]), e.fineEarnedMult > 0 ? drivingEarnedFd(w, t, t.overMin) : undefined)), `hos:${t.id}`);
      oosMin = Math.max(oosMin, e.oosHours.hos * MINUTES_PER_HOUR);
      found.push(`over hours today (driver out of service ${e.oosHours.hos} h)`);
      // The 10-hour break starts a new duty day once it's served.
      t.overMin = 0;
      t.shiftStartT = w.t + e.oosHours.hos * MINUTES_PER_HOUR;
      t.shiftDrivenMin = 0;
    }
    // Only the last week or so of logs is on the truck.
    t.logDays = t.logDays.filter((d) => d >= day - e.recentLogDays);
    const kept: number[] = [];
    for (const d of t.logDays) {
      if (rng.next() < e.logDetect) {
        violate(w, c, "hos", e.points.falseLog, "false log");
        const i = c.safety.hidden.findIndex((h) => h.kind === "falseLog" && h.truckId === t.id && h.day === d);
        fine(w, c, Math.round(scaledFine(w, rng.int(e.fines.falseLog[0], e.fines.falseLog[1]), i >= 0 ? c.safety.hidden[i]!.earnedFd : undefined)), `falselog:${t.id}`);
        found.push(`a falsified log (day ${d})`);
        if (i >= 0) c.safety.hidden.splice(i, 1);
      } else kept.push(d);
    }
    t.logDays = kept;
  }
  if (level === 1 || level === 2) {
    let bad = 0;
    for (let i = 0; i < t.defects; i++) if (rng.next() < e.defectDetect) bad++;
    if (bad > 0) {
      let oos = false;
      for (let i = 0; i < bad; i++) {
        violate(w, c, "maintenance", e.points.defect, "vehicle defect");
        fine(w, c, rng.int(e.fines.defect[0], e.fines.defect[1]), `defect:${t.id}`);
        if (rng.next() < e.defectOos) oos = true;
      }
      found.push(`${bad} vehicle defect${bad > 1 ? "s" : ""}`);
      if (oos) {
        // Fixed on the spot by a mobile mechanic, at roadside prices.
        w.ledger.post(w.t, companyAccount(c.id), "sink:repairs", rng.int(e.oosRepairFd[0], e.oosRepairFd[1]) * bad, `oos:${t.id}`);
        t.defects -= bad;
        oosMin = Math.max(oosMin, rng.int(e.oosHours.defect[0], e.oosHours.defect[1]) * MINUTES_PER_HOUR);
        found[found.length - 1] += " (truck out of service until repaired)";
      }
    }
  }
  if (t.driverId) staffById(w, t.driverId).violations += found.length;
  if (oosMin > 0) {
    c.safety.outOfService++;
    t.breakdownMin += oosMin;
  }
  notice(
    w,
    c.id,
    "safety",
    found.length === 0 ? `Truck ${t.id}: clean level ${level} inspection at ${where}.` : `Truck ${t.id}, level ${level} inspection at ${where}: ${found.join("; ")}.`,
    found.length === 0 ? "good" : "bad",
    t.id,
  );
  return oosMin > 0;
}

// --- Crashes ---------------------------------------------------------------------------------

/**
 * A crash. What it costs depends on why it happened: not at fault, the other
 * side's insurer pays; at fault, ours pays up to the policy limit and the company
 * pays the deductible and anything over; with violations behind it a jury
 * multiplies the verdict; and a fatal crash caused by falsified logs or known
 * defects is a crime — the authority is revoked, everything is seized, and the
 * owner and the people who ran it that way are barred or jailed.
 */
export function crash(w: World, t: Truck, c: Company): void {
  const { crash: k, maintenance } = w.cfg.safety;
  const rng = w.rng.safety;
  const day = today(w);
  const acct = companyAccount(c.id);
  const fatigued = t.overMin > 0;
  const fast = speeding(w, t, c);
  const contributing = fatigued || fast || t.defects > 0;
  const worse = fatigued || fast ? k.fatalWorseMult : 1;
  const roll = rng.next();
  const severity: CrashSeverity = roll < k.fatalShare * worse ? "fatal" : roll < k.fatalShare * worse + k.injuryShare ? "injury" : "pdo";
  const atFault = rng.next() < (contributing ? k.atFaultWithViolation : k.atFault);
  const willful = atFault && (fatigued || t.defects >= maintenance.knowinglyUnsafeDefects);
  const driver = t.driverId ? staffById(w, t.driverId) : null;
  if (driver) driver.crashes++;
  c.safety.crashes.push({ day, severity, atFault });
  w.metrics.onCrash(severity, atFault, willful);

  const causes = [fatigued && "falsified hours", fast && "speeding", t.defects > 0 && `${t.defects} known defect${t.defects > 1 ? "s" : ""}`].filter(Boolean).join(", ");
  const what = severity === "fatal" ? "a fatal crash" : severity === "injury" ? "a crash with injuries" : "a property-damage crash";
  const lines: string[] = [`Truck ${t.id} was in ${what}${atFault ? ", at fault" : ", not at fault"}${causes ? ` (${causes})` : ""}.`];

  // The miles driven so far are paid for now, not left for the next trip (or the next owner).
  c.operating.costFd += payTripCosts(w, t, `crash:${t.id}`);

  // The load. Cargo aboard is lost: the carrier pays the cargo deductible and isn't paid for it.
  // A load not yet picked up goes back on the board for someone else.
  const load = currentLoad(w, t);
  if (load && t.status === "toPickup") {
    reopenLoad(w, load);
    lines.push("The load it was heading for goes back on the board.");
  } else if (load) {
    loseLoad(w, load, "crash");
    w.ledger.post(w.t, acct, "sink:cargo_claim", severity === "pdo" ? k.cargoDeductibleFd / 2 : k.cargoDeductibleFd, `cargo:${load.id}`);
    lines.push("The load was lost.");
  }
  t.loadId = null;
  // Where it stops: the end of the leg it had mostly covered.
  if (t.legMiles > 0 && t.remainingMi < t.legMiles / 2) {
    t.hub = t.targetHub;
    t.place = t.targetPlace;
  }

  // The truck. A fatal crash totals it; assets on, any crash may, at its severity's odds, and
  // physical-damage cover pays an owned rig's value less the deductible.
  const [lo, hi] = severity === "injury" ? k.downDays.injury : k.downDays.pdo;
  const totalOdds = w.cfg.assets.enabled ? w.cfg.assets.totalLoss[severity] : severity === "fatal" ? 1 : 0;
  const totaled = t.lease !== "npc" && (totalOdds >= 1 || (totalOdds > 0 && rng.next() < totalOdds));
  if (totaled && t.lease === "owned" && w.cfg.assets.enabled) {
    const paid = writeOffRig(w, c, t);
    lines.push(`The truck is a total loss; the insurer paid ${fmtInt(paid)} FD for it.`);
  } else if (totaled) {
    if (t.lease === "lessor") {
      w.ledger.post(w.t, acct, "sink:npc_lease", k.leasedTotalLossFd, `totalloss:${t.id}`);
      w.lessor.out--;
    }
    // A loan on a totaled truck has nothing left to repossess: the pool writes it off.
    const loan = activeLoanOn(w, t.id);
    if (loan) settleLoanFromSale(w, loan, acct, 0);
    detachTruck(w, t);
    t.status = "retired";
    t.remainingMi = 0;
    t.legKey = -1;
    w.metrics.onTotalLoss();
    lines.push("The truck is a total loss.");
  } else {
    const days = severity === "fatal" ? 14 : rng.int(lo, hi);
    const bill = t.lease === "owned" ? rng.int(...(severity === "pdo" ? k.truckRepairFd.pdo : k.truckRepairFd.injury)) : k.deductibleFd;
    w.ledger.post(w.t, acct, "sink:repairs", bill, `crash:${t.id}`);
    c.operating.costFd += bill;
    t.status = "repair";
    t.repairUntilT = w.t + days * w.cfg.time.gameMinutesPerDay;
    t.remainingMi = 0;
    t.targetHub = t.hub;
    t.targetPlace = t.place;
    t.breakdownMin = 0;
    t.defects = 0;
    t.legKey = -1;
  }

  // Liability.
  if (atFault) {
    const [sLo, sHi] = k.settlementFd[severity];
    const verdict = rng.range(sLo, sHi) * (contributing ? rng.range(k.negligenceMult[0], k.negligenceMult[1]) : 1);
    let ours = k.deductibleFd + Math.max(0, verdict - k.insuranceLimitFd);
    // A pool-written policy's deductible comes out of the stake locked behind it (insurance.ts), not out of cash the company may not have.
    if (c.insurance.writer === "pool" && c.insuranceStakeFd >= k.deductibleFd) {
      w.ledger.post(w.t, contractAccount(c.id), "sink:liability", k.deductibleFd, `claim:crash:${c.id}`);
      c.insuranceStakeFd -= k.deductibleFd;
      ours -= k.deductibleFd;
    }
    payOrBankrupt(w, c, ours);
    // The insurer's share, for the market's loss ratio; a serious crash gets the policy re-written.
    const insured = Math.max(0, Math.min(verdict, k.insuranceLimitFd) - k.deductibleFd);
    recordClaim(w, insured);
    // A pool-written policy: the pool pays the insured share to the victim (pools.ts).
    if (c.insurance.writer === "pool" && insured > 0) payClaim(w, "insurance", "sink:liability", insured, `claim:crash:${c.id}`);
    c.safety.insuranceSurcharge += k.surcharge[severity];
    if (severity !== "pdo") signPolicy(w, c, "rewrite");
    violate(w, c, "crash", w.cfg.safety.enforcement.points.crash[severity], what);
    if (severity !== "pdo") c.safety.reviewWanted = true;
    lines.push(
      verdict > k.insuranceLimitFd
        ? `Settled at ${fmt(verdict)} FD; insurance covers ${fmt(k.insuranceLimitFd)} and the company owes ${fmt(ours)} FD.`
        : `Insurance settles it; the company pays the ${fmt(k.deductibleFd)} FD deductible and its premiums go up.`,
    );
  } else lines.push("The other driver's insurer pays.");

  // The people.
  if (driver && severity === "fatal" && rng.next() < k.driverKilled) {
    lines.push(driver.owner ? "The owner survived with serious injuries." : `${driver.name} was killed.`);
    removeStaff(w, driver);
  }
  syncFleet(w, c.id);
  notice(w, c.id, "crash", lines.join(" "), "bad", t.id);
  record(w, c, lines[0]!);

  if (severity === "fatal" && willful) {
    criminal(w, c, `Fatal crash caused by ${causes}: the owner and anyone who ran the truck that way face criminal charges.`, driver);
  }
}

const fmt = fmtInt;

/** A load its carrier can't pick up after all goes back on the board, open to all. */
export function reopenLoad(w: World, load: Load): void {
  load.status = "open";
  load.carrierId = null;
  load.truckId = null;
  load.clearedRate = 0;
  load.postedRound = w.round;
  load.roundsUnfilled = 0;
}

/**
 * A load that will never arrive: the broker loses its margin, a player shipper's
 * cargo insurance pays the sale value, and a double broker gets nothing.
 */
export function loseLoad(w: World, load: Load, _why: "crash" | "theft" | "burglary"): void {
  if (load.brokerId !== null) companyById(w, load.brokerId).openBrokerLoads--;
  // A crash or a burglary (risk.ts) is the player shipper's cargo insurance's to pay; a fraudster's theft is settled in fraud.ts.
  if (load.shipperId !== null && _why !== "theft") {
    const shipper = companyById(w, load.shipperId);
    // A pool-written policy pays the cargo as far as the pool goes; the NPC backstop covers the rest.
    const fromPool = shipper.insurance.writer === "pool" ? payClaim(w, "insurance", companyAccount(shipper.id), load.saleValue, `cargo:${load.id}`) : 0;
    if (load.saleValue - fromPool > 0.01) w.ledger.post(w.t, "faucet:cargo_insurance", companyAccount(shipper.id), load.saleValue - fromPool, `cargo:${load.id}`);
    const facility = w.facilities[load.facilityId! - 1];
    if (facility) facility.netFd += load.saleValue;
  }
  load.status = "delivered";
  w.loads.delete(load.id);
}

// --- Shutdowns ---------------------------------------------------------------------------------

/**
 * Authority revoked: the fleet is wound down like a liquidation, the staff go
 * back to the pool, Miles are forfeited, and the account can't file again until
 * the bar runs out. A second revocation is an imminent-hazard bar, longer.
 */
export function revoke(w: World, c: Company, why: string, barDays: number): void {
  if (c.authority.status === "revoked") return;
  const day = today(w);
  const a = c.authority;
  a.status = "revoked";
  a.revocations++;
  a.lastRevokedDay = day;
  a.suspendedUntil = null;
  a.barredUntil = barDays >= PERMANENT_BAR ? PERMANENT_BAR : day + barDays;
  c.milesTotal = 0;
  // The stake behind the licence is forfeited: judgments to the victims first, the rest seized (staking.ts).
  slashStake(w, c);
  record(w, c, `Authority revoked: ${why}`);
  notice(
    w,
    c.id,
    "authority",
    `Authority revoked. ${why} ${a.barredUntil >= PERMANENT_BAR ? "This account may never file for authority again." : `No new authority for ${barDays} days (until day ${a.barredUntil}).`}`,
    "bad",
  );
  w.metrics.onShutdown();
  if (c.liquidatingSince === null) startLiquidation(w, c);
  releaseAll(w, c);
}

/**
 * A crime: authority revoked, everything the company has is seized, the bar is a
 * year (forever after repeat crimes), and the driver and any dispatcher who ran
 * the trucks illegally go to jail.
 */
export function criminal(w: World, c: Company, why: string, driver: ReturnType<typeof staffById> | null, victimId = 0, restitutionFd = 0): void {
  const { bars, permanentAfterCrimes } = w.cfg.safety;
  c.authority.crimes++;
  if (driver && !driver.owner && driver.status !== "gone") jail(w, driver, bars.jail);
  if (pushesRules(c)) for (const d of dispatchersOf(w, c.id)) jail(w, d, bars.jail);
  // Victims are paid back first, then the rest is seized.
  if (victimId > 0 && restitutionFd > 0) restitute(w, c, victimId, restitutionFd);
  owe(w, c, SEIZE_ALL, "sink:seized");
  revoke(w, c, why, c.authority.crimes >= permanentAfterCrimes ? PERMANENT_BAR : bars.criminal);
}

/** Pays a victim back out of the offender's cash, as far as it goes. A transfer, not new FD. */
export function restitute(w: World, from: Company, victimId: number, amount: number): number {
  const pay = Math.min(amount, Math.max(0, w.ledger.balance(companyAccount(from.id))));
  if (pay > 0) w.ledger.post(w.t, companyAccount(from.id), companyAccount(victimId), pay, `restitution:${from.id}`);
  return pay;
}

/** File for new authority once the bar is over: a fresh start on the free path. */
export function canRefile(w: World, c: Company): string | null {
  const a = c.authority;
  if (a.status !== "revoked") return "your authority isn't revoked";
  if (a.barredUntil !== null && today(w) < a.barredUntil) return a.barredUntil >= PERMANENT_BAR ? "this account is barred for good" : `barred until day ${a.barredUntil}`;
  if (c.liquidatingSince !== null && w.trucksByCompany.get(c.id)!.some((t) => t.lease !== "npc")) return "the old fleet is still being sold off";
  return null;
}

// --- Weekly score and reviews ----------------------------------------------------------------

const timeWeight = (age: number) => (age <= 180 ? 3 : age <= 365 ? 2 : age <= 730 ? 1 : 0);

/** CSA-style measures: time-weighted violation points per time-weighted inspection; crashes per truck. */
export function measures(w: World, c: Company): Record<Basic, number> {
  const day = today(w);
  const s = c.safety;
  let inspW = w.cfg.safety.score.inspectionPrior;
  for (const d of s.inspections) inspW += timeWeight(day - d);
  const sum: Record<Basic, number> = { hos: 0, unsafe: 0, maintenance: 0, crash: 0 };
  for (const v of s.violations) sum[v.basic] += v.points * timeWeight(day - v.day);
  // Crashes per truck, with a prior of two trucks so one fender-bender doesn't flag an owner-operator.
  const trucks = w.trucksByCompany.get(c.id)!.length + 2;
  return { hos: sum.hos / inspW, unsafe: sum.unsafe / inspW, maintenance: sum.maintenance / inspW, crash: sum.crash / trucks };
}

/** Daily: suspensions run out, what's owed on judgments is taken from whatever came in, and a served bar ends in new authority. */
export function dailySafety(w: World): void {
  const day = today(w);
  for (const c of w.companies) {
    if (c.authority.status === "revoked" && canRefile(w, c) === null) {
      refile(w, c);
      notice(w, c.id, "authority", "Your bar is over: new authority granted, and you start over on a lease. Brokers can see the old revocation.", "info");
      continue;
    }
    if (c.judgmentFd > 0) collect(w, c, c.authority.status === "revoked" ? "sink:seized" : "sink:liability");
    if (c.authority.status === "suspended" && c.authority.suspendedUntil !== null && day >= c.authority.suspendedUntil) {
      c.authority.status = "active";
      c.authority.suspendedUntil = null;
      notice(w, c.id, "authority", "Your suspension is over: you can bid again.", "good");
    }
  }
}

export function weeklySafety(w: World): void {
  const day = today(w);
  const { review, score } = w.cfg.safety;
  for (const c of w.companies) {
    if (c.role !== "carrier") continue;
    const s = c.safety;
    if (c.authority.status === "revoked") continue;
    // A week on deferred maintenance with defects on the truck is on the maintenance records, for an auditor to find.
    if (c.policy.maintenance === "deferred") {
      const mult = w.cfg.safety.enforcement.fineEarnedMult;
      for (const t of w.trucksByCompany.get(c.id)!) {
        if (t.defects <= 0) continue;
        // R18: the week's skipped maintenance, at a typical week's miles.
        const earned = mult > 0 ? w.cfg.tractors[t.tier].maintPerMile * (1 - w.cfg.safety.maintenance.deferredCostMult) * w.cfg.labor.hiring.milesPerWeek : undefined;
        s.hidden.push(earned === undefined ? { day, kind: "maintenance", truckId: t.id } : { day, kind: "maintenance", truckId: t.id, earnedFd: earned });
      }
    }
    const cut = day - 730;
    s.violations = s.violations.filter((v) => v.day > cut);
    s.inspections = s.inspections.filter((d) => d > cut);
    s.crashes = s.crashes.filter((x) => x.day > cut);
    s.hidden = s.hidden.filter((h) => h.day > day - 365);
    s.measures = measures(w, c);
    s.alerts = (Object.keys(s.measures) as Basic[]).filter((b) => s.measures[b] >= score.thresholds[b]);

    const age = day - c.authority.since;
    // Alerts call in an auditor at most twice a year.
    const sinceReview = s.ratingDay === null ? Infinity : day - s.ratingDay;
    // R18 (safety.review.auditDays): any alert books an audit within the days; never rated, whatever the cooldown.
    if (review.auditDays !== null && s.alerts.length > 0 && s.reviewDay === null && (s.rating === "none" || sinceReview >= review.alertCooldownDays)) s.reviewDay = day + review.auditDays;
    const due =
      s.reviewWanted ||
      (s.alerts.length >= review.alertsToReview && sinceReview >= review.alertCooldownDays) ||
      (s.rating === "none" && age >= review.newEntrantDay) ||
      (s.reviewDay !== null && day >= s.reviewDay) ||
      // Heat (robbery.lot): the law's interest brings the auditor in.
      (heatReviewOdds(w, c) > 0 && w.rng.safety.next() < heatReviewOdds(w, c));
    if (due) complianceReview(w, c);
    syncFleet(w, c.id);
  }
}

/** Monthly: crash surcharges on insurance wear off. */
export function monthlySafety(w: World): void {
  const decay = 1 - w.cfg.safety.crash.surchargeDecayPerMonth;
  for (const c of w.companies) c.safety.insuranceSurcharge *= decay;
}

/**
 * A compliance review: an auditor goes through the records and finds some of what
 * was hidden. Fines per finding; the rating follows from findings and alerts.
 * Unsatisfactory gives 45 days to clean up before the authority is revoked.
 */
export function complianceReview(w: World, c: Company): void {
  const { review, bars } = w.cfg.safety;
  const rng = w.rng.safety;
  const day = today(w);
  const s = c.safety;
  const wasUnsat = s.rating === "unsatisfactory";
  const before = s.rating;
  let falseLogs = 0;
  let maintWeeks = 0;
  let scaled = 0;
  const kept: typeof s.hidden = [];
  for (const h of s.hidden) {
    if (rng.next() < review.hiddenDetect) {
      if (h.kind === "falseLog") falseLogs++;
      else maintWeeks++;
      scaled += scaledFine(w, h.kind === "falseLog" ? review.fines.falseLogDay : review.fines.maintenanceWeek, h.earnedFd);
    } else kept.push(h);
  }
  s.hidden = kept;
  // R18 scales each finding with what it earned (fineEarnedMult); off, the flat fines as today. The cap holds either way.
  const fines = Math.min(review.finesCap, w.cfg.safety.enforcement.fineEarnedMult > 0 ? scaled : falseLogs * review.fines.falseLogDay + maintWeeks * review.fines.maintenanceWeek);
  if (fines > 0) fine(w, c, fines, `review:${c.id}`);
  // What the auditor found follows the company to its insurer.
  s.insuranceSurcharge = Math.min(s.insuranceSurcharge + review.surchargePerFinding * (falseLogs + maintWeeks), review.surchargeCap);
  const pts = w.cfg.safety.enforcement.points;
  for (let i = 0; i < falseLogs; i++) violate(w, c, "hos", pts.falseLog, "false log (audit)");
  for (let i = 0; i < maintWeeks; i++) violate(w, c, "maintenance", pts.defect, "deferred maintenance (audit)");
  s.measures = measures(w, c);
  s.alerts = (Object.keys(s.measures) as Basic[]).filter((b) => s.measures[b] >= w.cfg.safety.score.thresholds[b]);
  const count = falseLogs + maintWeeks + 2 * s.alerts.length;
  const rating = count >= review.unsatisfactoryAt ? "unsatisfactory" : count >= review.conditionalAt ? "conditional" : "satisfactory";
  s.rating = rating;
  s.ratingDay = day;
  s.reviewWanted = false;
  w.metrics.onReview(rating);
  // A hot company's review becomes an investigation (backlot.ts): the lot's books, if found, convict.
  const found = (falseLogs + maintWeeks > 0 ? ` Found ${falseLogs} falsified log day${falseLogs === 1 ? "" : "s"} and ${maintWeeks} week${maintWeeks === 1 ? "" : "s"} of skipped maintenance; ${fmt(fines)} FD in fines.` : " Records clean.") + investigate(w, c);
  if (rating === "unsatisfactory") {
    if (wasUnsat) {
      revoke(w, c, "Still unsatisfactory at the follow-up review.", c.authority.revocations > 0 ? bars.imminentHazard : bars.unsatisfactory);
      return;
    }
    s.revokeDay = day + review.rereviewDays.unsatisfactory;
    s.reviewDay = s.revokeDay;
  } else {
    s.revokeDay = null;
    s.reviewDay = rating === "conditional" ? day + review.rereviewDays.conditional : null;
  }
  record(w, c, `Compliance review: ${rating}.${found}`);
  // A new rating re-prices the policy: down after a new authority's first clean audit, up after a bad one.
  if (rating !== before) signPolicy(w, c, "rewrite");
  notice(
    w,
    c.id,
    "safety",
    `Compliance review: rated ${rating.toUpperCase()}.${found}${rating === "unsatisfactory" ? ` Fix it by day ${s.revokeDay} or the authority is revoked.` : rating === "conditional" ? " Higher insurance, more inspections, and strict brokers won't load you until a clean follow-up." : ""}`,
    rating === "satisfactory" ? "good" : "bad",
  );
}

export function ratingLabel(c: Company): string {
  return c.safety.rating === "none" ? "Not yet rated" : c.safety.rating[0]!.toUpperCase() + c.safety.rating.slice(1);
}
