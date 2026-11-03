import { dayOf } from "./clock.js";
import { managersOf, managerSkill } from "./world.js";
import { clamp, finiteIn, fmtInt } from "./economics.js";
import { companyAccount } from "./ledger.js";
import type { Company, ManagerKind, Staff, Truck, StandingOrder } from "./types.js";
import { condition } from "./wear.js";
import { askingPay, companyById, crewed, marketPay, newStaff, seatDriver, staffById, syncTruck, truckById, unseatDriver, type World, hubMiles } from "./world.js";

/**
 * Staff (design proposal, Jeff 2026-10-28). Every truck needs a driver; the owner
 * drives one and dispatches up to three, and hired dispatchers run the rest.
 * Drivers' skill moves fuel, maintenance, breakdowns, speed and crash odds;
 * dispatchers' skill moves how well standing orders price and position trucks.
 * Skill comes from hiring (market pay rises with it) and grows with experience,
 * so a rookie who learns asks for a raise — and gets poached if they don't get it.
 */

export const stars = (skill: number) => 1 + Math.min(4, Math.floor(skill * 5));

export const companyStaff = (w: World, companyId: number): Staff[] => w.staffByCompany.get(companyId) ?? [];
export const dispatchersOf = (w: World, companyId: number) => companyStaff(w, companyId).filter((s) => s.kind === "dispatcher");
export const driversOf = (w: World, companyId: number) => companyStaff(w, companyId).filter((s) => s.kind === "driver");
export const poolOf = (w: World, kind: Staff["kind"]) => w.staff.filter((s) => s.status === "pool" && s.kind === kind);

const lerp = (range: readonly [number, number], x: number) => range[0] + (range[1] - range[0]) * x;

/** The raise it takes to poach someone this happy. */
export const lerpLoyalty = (w: World, morale: number) => lerp(w.cfg.labor.morale.loyalty, morale);

export function spanOf(w: World, s: Staff): number {
  return Math.round(lerp(w.cfg.labor.dispatcher.span, s.skill));
}

export interface DispatchProfile {
  /** Span-weighted skill of the owner and the hired dispatchers. */
  skill: number;
  span: number;
  /** Share of operating trucks the team can keep working (1 when the span covers the fleet). */
  coverage: number;
  noise: number;
  reloadWeight: number;
  foresightDays: number;
  /** How many loads ahead the team weighs a destination's market (1–3 by skill). */
  lookaheadLoads: number;
}

/** How well a company's standing orders run: the owner plus whoever it hired. */
export function dispatchProfile(w: World, c: Company, operating: number): DispatchProfile {
  const { labor, board } = w.cfg;
  let span = labor.owner.span;
  let weighted = span * c.ownerDispatch.skill;
  for (const d of dispatchersOf(w, c.id)) {
    const s = spanOf(w, d);
    span += s;
    weighted += s * d.skill;
  }
  // Managers (config labor.managers): past the threshold a fleet without an operations manager prices
  // worse and looks less far ahead; with one it prices tighter and the team works a little above its skill.
  const m = labor.managers;
  const hasOps = m.enabled && managersOf(w, c.id, "opsManager").length > 0;
  const ops = hasOps ? managerEffect(w, c, "opsManager") : 0; // the best operations manager's skill (and load, and the CEO's lift, on the ladder)
  const opsNeeded = m.enabled && operating > m.ops.requiredAbove && !hasOps;
  // The staff ladder: the team works worse the fuller its span; a CEO sharpens it.
  const team = weighted / span;
  const ladder = labor.ladder.enabled ? loadFactor(w, operating / span, team) : 1;
  const ceo = m.roles ? m.ceo.dispatchBonus * managerSkill(w, c.id, "ceo") : 0;
  const skill = Math.min(1, team * ladder + m.ops.skillBonus * ops + ceo);
  const noiseMult = opsNeeded ? m.ops.noiseWithout : hasOps ? 1 - (1 - m.ops.noiseWith) * ops : 1;
  return {
    skill,
    span,
    coverage: operating <= 0 ? 1 : Math.min(1, span / operating),
    noise: lerp(labor.dispatcher.noise, skill) * noiseMult,
    reloadWeight: board.reloadWeight * lerp(labor.dispatcher.reloadAware, skill),
    foresightDays: Math.round(lerp(labor.dispatcher.foresightDays, skill)),
    lookaheadLoads: Math.max(1, Math.round(lerp(labor.dispatcher.lookaheadLoads, skill)) - (opsNeeded ? 1 : 0)),
  };
}

/** Credits a load dispatched by standing orders to the team, by span. */
export function creditDispatch(w: World, c: Company): void {
  const team = dispatchersOf(w, c.id);
  const ownerSpan = w.cfg.labor.owner.span;
  const total = ownerSpan + team.reduce((s, d) => s + spanOf(w, d), 0);
  c.ownerDispatch.experience += ownerSpan / total;
  for (const d of team) d.pending += spanOf(w, d) / total;
}

function notice(w: World, companyId: number, text: string, tone: "good" | "bad" | "info", truckId?: number): void {
  w.listener?.({ kind: "notice", companyId, topic: "staff", text, tone, truckId });
}

const KIND_LABEL: Record<Staff["kind"], string> = { driver: "Driver", dispatcher: "Dispatcher", opsManager: "Operations manager", maintManager: "Maintenance manager", ceo: "CEO", securityManager: "Security manager", salesRep: "Sales rep" };
/** Salaried by the week and learning by the week on the job: every kind past drivers and dispatchers. */
export const isManager = (kind: Staff["kind"]): kind is ManagerKind => kind !== "driver" && kind !== "dispatcher";
/** The pool's kinds: the optional roles only when they're on (so a world without them draws as before). */
const poolKinds = (w: World): Staff["kind"][] =>
  w.cfg.labor.managers.roles ? ["driver", "dispatcher", "opsManager", "maintManager", "ceo", "securityManager", "salesRep"] : ["driver", "dispatcher", "opsManager", "maintManager"];
const learnWeeks = (w: World, kind: ManagerKind): number => {
  const m = w.cfg.labor.managers;
  return kind === "opsManager" ? m.ops.learnWeeks : kind === "maintManager" ? m.maint.learnWeeks : kind === "ceo" ? m.ceo.learnWeeks : kind === "securityManager" ? m.security.learnWeeks : m.sales.learnWeeks;
};
const label = (s: Staff) => `${KIND_LABEL[s.kind]} ${s.name} (${stars(s.skill)}★)`;
/** Experience behind a skill level: miles for drivers, loads for dispatchers, weeks on the job for managers. */
const experienceScale = (kind: Staff["kind"]) => (kind === "driver" ? 600_000 : kind === "dispatcher" ? 3_000 : 150);

// --- The pool ---------------------------------------------------------------------

/** People already in the industry when the world starts: a spread of skill, most of it middling. */
export function seedPool(w: World): void {
  const { pool } = w.cfg.labor;
  const rng = w.rng.labor;
  const start: Record<Staff["kind"], number> = { driver: pool.startDrivers, dispatcher: pool.startDispatchers, opsManager: pool.startOpsManagers, maintManager: pool.startMaintManagers, ceo: pool.startCeos, securityManager: pool.startSecurity, salesRep: pool.startSales };
  for (const [kind, n] of poolKinds(w).map((k) => [k, start[k]] as const)) {
    for (let i = 0; i < n; i++) {
      const u = rng.next();
      const skill = clamp(0.05 + 0.85 * u * u * (3 - 2 * u) * 0.95, 0, 0.95);
      const s = newStaff(w, kind, skill, skill + (1 - skill) * rng.range(0, 0.6));
      s.experience = Math.round(skill * experienceScale(kind));
    }
  }
}

function entrant(w: World, kind: Staff["kind"]): Staff {
  const { pool } = w.cfg.labor;
  const rng = w.rng.labor;
  const veteran = rng.next() < pool.veteranShare;
  const skill = veteran ? rng.range(pool.veteranSkill[0], pool.veteranSkill[1]) : rng.range(pool.rookieSkill[0], pool.rookieSkill[1]);
  const s = newStaff(w, kind, skill, rng.range(pool.potential[0], pool.potential[1]));
  s.experience = Math.round(skill * experienceScale(kind));
  return s;
}

// --- Hiring, poaching, firing ---------------------------------------------------------

/**
 * An offer to someone in the pool (hired on the spot if it meets their ask) or
 * working for someone else (a poach: they take it if it beats their pay by enough
 * for how happy they are, and their employer gets the notice period to match).
 * Returns an error, or null.
 */
export function offerStaff(w: World, c: Company, s: Staff, pay: number, truckId: number): string | null {
  const { morale } = w.cfg.labor;
  if (c.role !== "carrier") return "only carriers hire drivers and dispatchers";
  if (c.authority.status === "revoked" || c.liquidatingSince !== null) return "your authority isn't active";
  if (s.owner) return "owners aren't for hire";
  if (s.status === "jailed") return `${s.name} is in jail`;
  if (s.status === "gone") return `${s.name} has left the industry`;
  if (s.companyId === c.id) return `${s.name} already works for you`;
  if (!finiteIn(pay, 0.01, s.kind === "driver" ? 20 : 50_000)) return "offer a wage above zero";
  let truck: Truck | null = null;
  if (s.kind === "driver") {
    if (!truckId) return "pick the truck they'll drive";
    truck = truckById(w, truckId);
    if (!truck || truck.companyId !== c.id) return "not your truck";
    if (crewed(truck)) return "that truck already has a driver";
    if (truck.status === "retired" || truck.status === "listed" || truck.status === "parked") return "that truck isn't on the road";
  }
  const ask = askingPay(w, s);
  if (pay < ask) return `${s.name} asks at least ${fmtPay(s, ask)}`;
  if (s.status === "pool") {
    hire(w, c, s, pay, truck);
    return null;
  }
  // A poach: it has to beat what they make by their loyalty premium, and it costs a sign-on bonus up front.
  if (s.offer && s.offer.companyId === 0) return `${s.name} has already given notice`;
  const bonus = signOnBonus(w, s, pay);
  if (w.ledger.balance(companyAccount(c.id)) < bonus) return `a sign-on bonus of ${fmtInt(bonus)} FD is due up front`;
  const needed = s.pay * (1 + lerp(morale.loyalty, s.morale));
  if (pay < needed) return `${s.name} would move for ${fmtPay(s, needed)} or more`;
  if (s.offer && s.offer.companyId !== 0 && s.offer.pay >= pay) return `${s.name} already has a better offer`;
  s.offer = { companyId: c.id, pay, truckId: truck?.id ?? 0, day: dayOf(w.t, w.cfg) };
  notice(w, s.companyId, `${label(s)} has an offer from ${c.name} at ${fmtPay(s, pay)}. Match it within ${morale.noticeDays} days or lose them.`, "bad", s.truckId || undefined);
  notice(w, c.id, `${s.name} accepted your offer; their employer has ${morale.noticeDays} days to match it.`, "info");
  return null;
}

const fmtPay = (s: Staff, x: number) => (s.kind === "driver" ? `${x.toFixed(2)} FD/mi` : `${fmtInt(x)} FD/wk`);

/** What it costs to hire someone away: two weeks of their new pay, paid to them on signing (and gone from the economy). */
export function signOnBonus(w: World, s: Staff, pay: number): number {
  const h = w.cfg.labor.hiring;
  return s.kind === "driver" ? pay * h.milesPerWeek * h.signOnWeeks : pay * h.signOnWeeks;
}

/** Letting someone go soon after hiring them costs severance: two weeks of pay. */
export function severance(w: World, s: Staff): number {
  const h = w.cfg.labor.hiring;
  if (dayOf(w.t, w.cfg) - s.hiredDay >= h.severanceWithinDays) return 0;
  return s.kind === "driver" ? s.pay * h.milesPerWeek * h.severanceWeeks : s.pay * h.severanceWeeks;
}

function hire(w: World, c: Company, s: Staff, pay: number, truck: Truck | null, poached = false): void {
  if (poached) {
    const bonus = signOnBonus(w, s, pay);
    w.ledger.post(w.t, companyAccount(c.id), "sink:signing_bonus", bonus, `signon:${s.id}`);
    c.operating.costFd += bonus;
  }
  s.status = "employed";
  s.companyId = c.id;
  s.pay = pay;
  s.hiredDay = dayOf(w.t, w.cfg);
  s.offer = null;
  s.matchedPay = 0;
  s.matchedDay = -1;
  s.peakPay = pay;
  s.unseatedWeeks = 0;
  // Starting happy if paid well over market, less so if barely.
  s.morale = clamp(0.6 + w.cfg.labor.morale.payWeight * (pay / marketPay(w, s.kind, s.skill) - 1), 0.3, 0.95);
  w.staffByCompany.get(c.id)!.push(s);
  if (truck) seatDriver(w, s, truck);
  if (s.kind === "opsManager") for (const t of w.trucksByCompany.get(c.id) ?? []) syncTruck(w, t); // the drivers' bonus
}

/** Back to the pool (fired, quit, or the company folded). */
export function releaseStaff(w: World, s: Staff): void {
  if (s.owner || s.status !== "employed") return;
  unseatDriver(w, s);
  const list = w.staffByCompany.get(s.companyId);
  const at = list ? list.indexOf(s) : -1;
  if (list && at >= 0) list.splice(at, 1);
  s.status = "pool";
  s.companyId = 0;
  s.pay = 0;
  s.offer = null;
  s.morale = w.cfg.labor.morale.start;
}

export function setPay(w: World, s: Staff, pay: number): void {
  const before = s.pay;
  const today = dayOf(w.t, w.cfg);
  s.pay = pay;
  // A cut stings at once; a raise lifts them at once, but only above the most they've made lately and only
  // so far: the weekly drift does the rest. So cutting pay and restoring it is a loss, never a free reset.
  const ref = Math.max(before, s.peakPay);
  const change = clamp(pay / ref - 1, -0.5, 0.25);
  s.morale = clamp(s.morale + change * w.cfg.labor.morale.payWeight * 0.5, 0, 1);
  s.peakPay = Math.max(s.peakPay, pay);
  if (s.offer && s.offer.companyId !== 0 && pay >= s.offer.pay) {
    const other = companyById(w, s.offer.companyId);
    notice(w, other.id, `${s.name} stayed: their employer matched your offer.`, "bad");
    notice(w, s.companyId, `You kept ${s.name}.`, "good", s.truckId || undefined);
    s.offer = null;
    s.matchedPay = pay;
    s.matchedDay = today;
  } else if (s.matchedPay > 0 && pay < s.matchedPay && today - s.matchedDay < w.cfg.labor.hiring.matchedPayHoldDays && !s.offer) {
    // A match cut back soon after is a broken promise: they walk as soon as their truck is at a hub.
    s.morale = 0;
    s.offer = { companyId: 0, pay: 0, truckId: 0, day: today - w.cfg.labor.morale.noticeDays };
    notice(w, s.companyId, `${label(s)} is leaving: you cut the pay you matched to keep them.`, "bad", s.truckId || undefined);
  }
  if (s.truckId) syncTruck(w, truckById(w, s.truckId));
}

/** Jail (a criminal case): off the market until released. */
export function jail(w: World, s: Staff, days: number): void {
  if (s.owner) return;
  if (s.status === "employed") releaseStaff(w, s);
  s.status = "jailed";
  s.releaseDay = dayOf(w.t, w.cfg) + days;
}

/** Leaves the industry for good (retired, or killed in a crash). */
export function removeStaff(w: World, s: Staff): void {
  if (s.owner) return;
  if (s.status === "employed") releaseStaff(w, s);
  s.status = "gone";
}

/** A driver can move only when their truck is parked at a hub. */
const free = (w: World, s: Staff) => {
  if (!s.truckId) return true;
  const st = truckById(w, s.truckId).status;
  return st === "idle" || st === "parked" || st === "listed" || st === "retired";
};

// --- Daily, weekly, monthly ---------------------------------------------------------------

/** Daily: offers whose notice ran out move people; quitters leave once their truck is parked. */
export function dailyLabor(w: World): void {
  const today = dayOf(w.t, w.cfg);
  for (const s of w.staff) {
    if (s.status === "jailed" && s.releaseDay !== null && today >= s.releaseDay) {
      s.status = "pool";
      s.releaseDay = null;
      s.companyId = 0;
      continue;
    }
    if (s.status !== "employed" || !s.offer || today - s.offer.day < w.cfg.labor.morale.noticeDays || !free(w, s)) continue;
    const { companyId, pay, truckId } = s.offer;
    const from = companyById(w, s.companyId);
    if (companyId === 0) {
      notice(w, from.id, `${label(s)} quit.`, "bad", s.truckId || undefined);
      releaseStaff(w, s);
      continue;
    }
    const to = companyById(w, companyId);
    const truck = truckId ? truckById(w, truckId) : null;
    // The new seat has to still be open and the new employer still running.
    if ((truck && (truck.companyId !== to.id || crewed(truck))) || to.authority.status === "revoked" || to.liquidatingSince !== null) {
      s.offer = null;
      continue;
    }
    notice(w, from.id, `${label(s)} left for ${to.name}.`, "bad", s.truckId || undefined);
    releaseStaff(w, s);
    hire(w, to, s, pay, truck, true);
    notice(w, to.id, `${label(s)} joined you from ${from.name}.`, "good", truck?.id);
  }
  for (const c of w.companies) if (c.autoStaff && c.role === "carrier") autoStaff(w, c);
  dailyDrivers(w);
}

// --- Fatigue, home time and per diem (design decision, Jeff 2026-10-28) -----------------------

/** Minutes at the wheel today, per seated driver: a team splits the truck's. */
export function creditDriving(w: World, t: Truck, minutes: number): void {
  const d = t.driverId ? w.staff[t.driverId - 1] : undefined;
  const co = t.coDriverId ? w.staff[t.coDriverId - 1] : undefined;
  if (d && co) {
    d.drivenMinToday += minutes / 2;
    co.drivenMinToday += minutes / 2;
  } else if (d) d.drivenMinToday += minutes;
}

/** A truck standing still within the home radius: its drivers are home. */
const standingAtHome = (w: World, c: Company, t: Truck) =>
  (t.status === "idle" || t.status === "parked" || t.status === "repair") && hubMiles(w, c.homeHub, t.hub) <= w.cfg.map.nearbyRadiusMi;

const seatedDrivers = (w: World, t: Truck): Staff[] => [t.driverId, t.coDriverId].filter((id) => id > 0).map((id) => w.staff[id - 1]!);

/** The truck's drivers start their days off: the dispatcher leaves the truck alone until they're over. */
export function startHomeTime(w: World, c: Company, t: Truck): void {
  const hm = c.orders.find((o): o is Extract<StandingOrder, { kind: "homeTime" }> => o.kind === "homeTime");
  const days = hm?.restDays ?? w.cfg.fatigue.resetDays;
  const today = dayOf(w.t, w.cfg);
  for (const d of seatedDrivers(w, t)) {
    d.wantsHome = false;
    // A day they drove home on isn't a day off: the days off start tomorrow.
    d.homeUntilDay = (d.drivenMinToday > 0 ? today + 1 : today) + days;
    notice(w, c.id, `${d.owner ? "You're" : `${label(d)} is`} home for ${days} days off${d.fatigue >= w.cfg.fatigue.tiredAt ? " (and need them)" : ""}.`, "info", t.id);
  }
}

/** A truck just went idle: if it's home and a driver was heading there for days off, they start now. */
export function homeArrival(w: World, t: Truck): void {
  if (!t.companyId) return;
  const c = companyById(w, t.companyId);
  if (standingAtHome(w, c, t) && seatedDrivers(w, t).some((d) => d.wantsHome)) startHomeTime(w, c, t);
}

/** The driver fatigue a truck runs with: the average of its seated drivers'. */
export function driverFatigue(w: World, t: Truck): number {
  const ds = seatedDrivers(w, t);
  return ds.length ? ds.reduce((s, d) => s + d.fatigue, 0) / ds.length : 0;
}

/**
 * Daily, every employed driver: days out and days off, fatigue from weeks on the
 * road and long days (a buffer banked by extra days off absorbs it first), per
 * diem for every day away, and the morale cost of running tired.
 */
export function dailyDrivers(w: World): void {
  const f = w.cfg.fatigue;
  const perDiem = w.cfg.labor.driver.perDiemFd;
  const today = dayOf(w.t, w.cfg);
  for (const s of w.staff) {
    if (s.status !== "employed" || s.kind !== "driver") continue;
    const c = companyById(w, s.companyId);
    const t = s.truckId ? truckById(w, s.truckId) : null;
    const home = !t || standingAtHome(w, c, t);
    const hours = s.drivenMinToday / 60;
    s.drivenMinToday = 0;
    if (home && hours === 0) {
      // A day off at home.
      s.awayDays = 0;
      s.restDays++;
      if (s.restDays >= f.resetDays) {
        s.fatigue = 0;
        if (s.restDays > f.resetDays) s.buffer = Math.min(f.bufferMax, s.buffer + f.bufferPerExtraDay);
      } else s.fatigue = Math.max(0, s.fatigue - f.recoverAtHome);
      if (s.homeUntilDay !== null && today + 1 >= s.homeUntilDay) s.homeUntilDay = null;
      continue;
    }
    s.restDays = 0;
    if (home) s.awayDays = 0;
    else {
      s.awayDays++;
      // A layover: a truck that has sat idle away from home for a day or more costs the company per diem.
      if (hours === 0 && t && t.status === "idle" && w.t - t.idleSinceT >= w.cfg.time.gameMinutesPerDay) {
        const due = perDiem * (t.mods.sleeper ? 0.5 : 1); // a sleeper halves the layover (items.ts)
        w.ledger.post(w.t, companyAccount(c.id), "sink:per_diem", due, `perdiem:${s.id}`);
        c.operating.costFd += due;
      }
    }
    let accrual = 0;
    if (hours > f.longDayHours) {
      accrual += f.perHourOver * (hours - f.longDayHours) * (1 + f.consecutiveMult * Math.min(s.longDays, f.consecutiveCap));
      s.longDays++;
    } else s.longDays = 0;
    if (s.awayDays > f.roadDays) accrual += f.roadPerDay * (1 + (s.awayDays - f.roadDays) / f.roadDays);
    // A banked buffer absorbs the build-up first; every day recovers a little (more for a day off on the road).
    const fromBuffer = Math.min(s.buffer, accrual);
    s.buffer -= fromBuffer;
    const before = s.fatigue;
    s.fatigue = clamp(s.fatigue + accrual - fromBuffer - (hours === 0 ? f.restDayOnRoad : f.recoverPerDay), 0, 1);
    if (before < f.tiredAt && s.fatigue >= f.tiredAt) notice(w, c.id, `${label(s)} is running tired: ${s.awayDays} days out${s.longDays > 1 ? `, ${s.longDays} long days in a row` : ""}. Crash odds are up and they're slowing down.`, "bad", t?.id);
    if (!s.owner && s.fatigue > 0.5) s.morale = clamp(s.morale - f.moralePerDay * (s.fatigue - 0.5) * 2, 0, 1);
  }
}

/**
 * Keeps seats filled for a company that lets the engine do it (every bot; humans
 * by default): idle drivers onto empty trucks, then the cheapest decent hire from
 * the pool, and a dispatcher once the fleet outgrows the owner's span.
 */
export function autoStaff(w: World, c: Company, minDriverSkill = 0, minDispatcherSkill = 0): void {
  if (c.authority.status === "revoked" || c.liquidatingSince !== null) return;
  autoManagers(w, c);
  // R8 (guard.hireCoverWeeks; 0 is no guard): no hire while cash covers less than that many weeks of the new wages
  // of this pass. The first hire held back is left on the company for the Needs-you line.
  const g = w.cfg.guard;
  const cover = c.human || !g.hireCoverHumansOnly ? g.hireCoverWeeks : 0;
  let added = 0;
  if (c.hireBlock) c.hireBlock = null; // only touched once the guard has held something, so a world without it is unchanged
  const affordable = (s: Staff): boolean => {
    if (cover <= 0) return true;
    const weekly = weeklyWage(w, s, askingPay(w, s));
    const needFd = cover * (added + weekly);
    if (w.ledger.balance(companyAccount(c.id)) + 1e-9 >= needFd) {
      added += weekly;
      return true;
    }
    // The pass's first hold is the one the player sees (a seat before the dispatcher).
    if (!c.hireBlock) {
      c.hireBlockedDays = (c.hireBlockedDays ?? 0) + 1;
      c.hireBlock = { staffId: s.id, kind: s.kind, weeklyFd: weekly, needFd, day: dayOf(w.t, w.cfg) };
    }
    return false;
  };
  const fleet = w.trucksByCompany.get(c.id)!;
  // The owner drives for free: if they have no truck, they take over from a hire at a hub.
  const owner = fleet.length ? w.staffByCompany.get(c.id)!.find((s) => s.owner && s.status === "employed" && s.truckId === 0) : undefined;
  if (owner) {
    const seat = fleet.find((t) => (t.status === "idle" || t.status === "parked" || t.status === "repair") && crewed(t) && t.coDriverId === 0 && !staffById(w, t.driverId).owner);
    if (seat) seatDriver(w, owner, seat);
  }
  // Seats to fill: trucks on the road first, parked ones last; a seat promised to someone we're hiring away is kept for them.
  const promised = new Set<number>();
  for (const s of w.staff) if (s.offer && s.offer.companyId === c.id && s.offer.truckId) promised.add(s.offer.truckId);
  const empty = fleet
    .filter((t) => !crewed(t) && (t.status === "idle" || t.status === "parked" || t.status === "repair") && !promised.has(t.id))
    .sort((a, b) => Number(a.status === "parked") - Number(b.status === "parked") || a.id - b.id);
  if (empty.length > 0) {
    const spare = driversOf(w, c.id).filter((s) => s.truckId === 0 && !s.offer);
    while (empty.length > 0 && spare.length > 0) seatDriver(w, spare.shift()!, empty.shift()!);
    // Parked trucks don't need a driver until they're back on the road.
    const needed = empty.filter((t) => t.status !== "parked");
    if (needed.length > 0) {
      // Best value: what they ask, less roughly what their skill saves in fuel and repairs.
      const value = (s: Staff) => askingPay(w, s) - 0.35 * s.skill;
      const pool = poolOf(w, "driver")
        .filter((s) => s.skill >= minDriverSkill)
        .sort((a, b) => value(a) - value(b) || a.id - b.id);
      for (const t of needed) {
        const s = pool.shift();
        if (!s || !affordable(s)) break;
        hire(w, c, s, askingPay(w, s), t);
      }
    }
  }
  const operating = operatingCount(w, c.id);
  const profile = dispatchProfile(w, c, operating);
  if (profile.coverage < 1) {
    const pool = poolOf(w, "dispatcher")
      .filter((s) => s.skill >= minDispatcherSkill)
      .sort((a, b) => askingPay(w, a) / spanOf(w, a) - askingPay(w, b) / spanOf(w, b) || a.id - b.id);
    if (pool[0] && affordable(pool[0])) hire(w, c, pool[0], askingPay(w, pool[0]), null);
    return;
  }
  // A dispatcher the fleet no longer needs (it shrank) is let go: the least skilled one whose span isn't needed.
  const team = dispatchersOf(w, c.id).sort((a, b) => a.skill - b.skill || a.id - b.id);
  for (const d of team) {
    if (profile.span - spanOf(w, d) >= operating) {
      releaseStaff(w, d);
      return;
    }
  }
}

/** A week of a hire's wage at this pay: a driver's at labor.hiring.milesPerWeek (the sign-on and severance week), anyone else's the quoted weekly pay. */
export const weeklyWage = (w: World, s: Staff, pay: number): number => (s.kind === "driver" ? pay * w.cfg.labor.hiring.milesPerWeek : pay);

/** Fraction of a year someone has worked here. */
const tenureYears = (w: World, s: Staff) => (dayOf(w.t, w.cfg) - s.hiredDay) / w.cfg.time.daysPerSeason;

/** Pushed to break the rules: the company runs illegal hours or speed. */
export const pushesRules = (c: Company) => c.policy.hos !== "legal" || c.policy.speed !== "legal";

/**
 * Weekly: experience turns into skill, dispatchers draw their salaries, morale
 * drifts toward what the job deserves, unhappy people quit, and the pool takes in
 * new people and loses retirees.
 */
export function weeklyLabor(w: World): void {
  const { labor } = w.cfg;
  const { morale } = labor;
  const rng = w.rng.labor;
  for (const c of w.companies) {
    const od = c.ownerDispatch;
    const learned = od.experience - od.learned;
    if (learned > 0) {
      od.skill = clamp(od.skill + (od.potential - od.skill) * (learned / labor.dispatcher.learnLoads), 0, 1);
      od.learned = od.experience;
    }
  }
  for (const s of w.staff) {
    if (s.status !== "employed") continue;
    if (isManager(s.kind)) s.pending += 1; // a week on the job
    if (s.pending > 0) {
      const learn = s.kind === "driver" ? labor.driver.learnMiles : s.kind === "dispatcher" ? labor.dispatcher.learnLoads : learnWeeks(w, s.kind);
      s.skill = clamp(s.skill + (s.potential - s.skill) * (s.pending / learn), 0, 1);
      s.experience += s.pending;
      s.pending = 0;
      if (s.truckId) syncTruck(w, truckById(w, s.truckId));
    }
    if (s.owner) continue;
    const c = companyById(w, s.companyId);
    // What counts as "lately" fades over a couple of months.
    s.peakPay = Math.max(s.pay, s.peakPay * 0.97);

    // Morale: pay against what they could get elsewhere, how they're treated, how long they've stayed.
    const truck = s.truckId ? truckById(w, s.truckId) : null;
    let target = 0.6 + morale.payWeight * (s.pay / marketPay(w, s.kind, s.skill) - 1);
    if (pushesRules(c)) target -= morale.pushedPenalty * s.integrity * opsPushedMult(w, c); // an operations manager makes it bearable
    if (truck && truck.lease === "owned" && condition(w.cfg, truck) < 0.35) target -= morale.wornTruckPenalty;
    if (c.safety.rating === "conditional" || c.safety.rating === "unsatisfactory") target -= morale.badRatingPenalty;
    target += Math.min(morale.tenureCap, morale.tenurePerYear * tenureYears(w, s));
    s.morale = clamp(s.morale + morale.adjust * (clamp(target, 0, 1) - s.morale), 0, 1);

    // A driver without a truck, or on one that's parked or for sale, isn't working.
    if (s.kind === "driver" && (s.truckId === 0 || truck?.status === "parked" || truck?.status === "listed")) s.unseatedWeeks++;
    else if (s.kind === "driver") s.unseatedWeeks = 0;
    if (s.offer) continue;
    const quits = rng.next() < morale.quitBase + morale.quitSlope * Math.max(0, 0.5 - s.morale) || s.unseatedWeeks >= morale.unseatedWeeks;
    const retires = rng.next() < labor.pool.retireWeekly;
    if (retires) {
      notice(w, c.id, `${label(s)} is retiring.`, "info", s.truckId || undefined);
      if (free(w, s)) removeStaff(w, s);
      else s.offer = { companyId: 0, pay: 0, truckId: 0, day: dayOf(w.t, w.cfg) - morale.noticeDays };
    } else if (quits) {
      if (free(w, s)) {
        notice(w, c.id, `${label(s)} quit${s.unseatedWeeks >= morale.unseatedWeeks ? ": no truck to drive" : s.morale < 0.3 ? " — unhappy with pay or how they're treated" : ""}.`, "bad", s.truckId || undefined);
        releaseStaff(w, s);
      } else s.offer = { companyId: 0, pay: 0, truckId: 0, day: dayOf(w.t, w.cfg) - morale.noticeDays };
    }
  }

  // The pool: retirements, then new entrants sized to the gap and the open seats.
  // The pool: people leave faster when work is scarce, and newcomers only come while wages are worth it.
  const drivers = w.staff.filter((s) => s.kind === "driver" && s.status === "employed" && !s.owner).length;
  const slack = drivers > 0 && poolOf(w, "driver").length / drivers > labor.wageIndex.slackPool;
  const leave = labor.pool.retireWeekly * (slack ? labor.pool.slackAttrition : 2);
  for (const s of w.staff) if (s.status === "pool" && rng.next() < leave) s.status = "gone";
  const wagesDraw = w.labor.wageIndex > labor.wageIndex.range[0] + 1e-9;
  for (const kind of poolKinds(w)) {
    const employed = w.staff.filter((s) => s.kind === kind && s.status === "employed" && !s.owner).length;
    const inPool = poolOf(w, kind).length;
    const target = Math.max(labor.pool.minTarget[kind], employed * labor.pool.targetShare[kind]);
    const open = kind === "driver" ? openSeats(w) : 0;
    const n = Math.round((wagesDraw ? labor.pool.baseEntrants[kind] : 0) + labor.pool.fillShare * Math.max(0, target + open - inPool));
    for (let i = 0; i < n; i++) entrant(w, kind);
  }
}

/**
 * Weekly dispatch bills: a dispatcher's pay is quoted for a full span of trucks
 * and billed for the trucks they actually run (past the owner's own), with a
 * quarter of it as a retainer, so a fleet of four pays for one truck's worth.
 */
export function payDispatchers(w: World): void {
  const ownerSpan = w.cfg.labor.owner.span;
  for (const c of w.companies) {
    const team = dispatchersOf(w, c.id).sort((a, b) => b.skill - a.skill || a.id - b.id);
    if (team.length === 0) continue;
    let left = Math.max(0, operatingCount(w, c.id) - ownerSpan);
    for (const d of team) {
      const span = spanOf(w, d);
      const run = Math.min(span, left);
      left -= run;
      w.ledger.post(w.t, companyAccount(c.id), "sink:dispatch", d.pay * Math.max(DISPATCH_RETAINER, run / span), `dispatch:${d.id}`);
    }
  }
  // Managers draw a full week's pay (labor.managers), a sink.
  for (const s of w.staff) {
    if (s.status !== "employed" || !isManager(s.kind)) continue;
    const c = companyById(w, s.companyId);
    w.ledger.post(w.t, companyAccount(c.id), "sink:management", s.pay, `manager:${s.id}`);
    c.operating.costFd += s.pay;
  }
}

const DISPATCH_RETAINER = 0.25;

export function operatingCount(w: World, companyId: number): number {
  let n = 0;
  for (const t of w.trucksByCompany.get(companyId) ?? []) if (t.status !== "parked" && t.status !== "listed" && t.status !== "retired") n++;
  return n;
}

/** Operating trucks without a driver, across the world. */
function openSeats(w: World): number {
  let n = 0;
  for (const t of w.trucks) {
    if (t.companyId === 0 || crewed(t) || t.status === "parked" || t.status === "listed" || t.status === "retired") continue;
    const c = companyById(w, t.companyId);
    if (c.authority.status === "revoked" || c.liquidatingSince !== null) continue;
    n++;
  }
  return n;
}

/** Monthly: a thin driver pool pushes the market wage up, a deep one lets it ease. */
export function monthlyLabor(w: World): void {
  const wi = w.cfg.labor.wageIndex;
  const employed = w.staff.filter((s) => s.kind === "driver" && s.status === "employed" && !s.owner).length;
  if (employed === 0) return;
  const share = poolOf(w, "driver").length / employed;
  const step = share < wi.tightPool ? wi.stepPerMonth : share > wi.slackPool ? -wi.stepPerMonth : 0;
  w.labor.wageIndex = clamp(w.labor.wageIndex + step, wi.range[0], wi.range[1]);
}

/** The company folded: everyone but the owner goes back to the pool. */
export function releaseAll(w: World, c: Company): void {
  for (const s of [...companyStaff(w, c.id)]) if (!s.owner) releaseStaff(w, s);
}

/** Miles driven this hour count toward the crew's experience. */
export function creditMiles(w: World, truck: Truck, miles: number): void {
  if (truck.driverId) staffById(w, truck.driverId).pending += miles;
  if (truck.coDriverId) staffById(w, truck.coDriverId).pending += miles;
}

// --- Managers (Jeff, 2026-10-29/30; TODO.md 12): people from the labor pool -----------------------
// Operations managers (a must past `requiredAbove` operating trucks, one for every `span` beyond; the
// trucks over that park after the grace period, staking.ts) and maintenance managers, hired like
// dispatchers: skill, asking pay, poaching, morale, a week's experience a week. The edge they give
// scales with the best one's skill. Pay is weekly (payDispatchers), a sink.

export type ManagerRole = "ops" | "maint";
const kindOf = (role: ManagerRole): "opsManager" | "maintManager" => (role === "ops" ? "opsManager" : "maintManager");

/** Operating trucks the operations managers on staff cover (the threshold plus a span each; on the ladder, a span each, the threshold at least); no limit when managers are off. */
export function opsCap(w: World, c: Company): number {
  const k = w.cfg.labor.managers;
  if (!k.enabled) return Infinity;
  const n = managersOf(w, c.id, "opsManager").length;
  return w.cfg.labor.ladder.enabled ? Math.max(k.ops.requiredAbove, k.ops.span * n) : k.ops.requiredAbove + k.ops.span * n;
}

/** Managers of a role a fleet of this size needs (on the ladder the whole fleet counts against the span). */
export function managersNeeded(w: World, role: ManagerRole, operating: number): number {
  const k = w.cfg.labor.managers[role];
  if (operating <= k.requiredAbove) return 0;
  return Math.ceil((w.cfg.labor.ladder.enabled ? operating : operating - k.requiredAbove) / k.span);
}

/**
 * The staff ladder (labor.ladder): how well someone works with this share of their span in use. Full
 * strength up to `fullUpTo`, sliding to `atFull` at the span; their skill takes back part of the slide.
 */
export function loadFactor(w: World, load: number, skill: number): number {
  const k = w.cfg.labor.ladder;
  if (!k.enabled || load <= k.fullUpTo) return 1;
  const over = Math.min(1, (load - k.fullUpTo) / (1 - k.fullUpTo));
  return 1 - (1 - k.atFull) * over * (1 - k.skillCushion * skill);
}

/** The span of a manager kind on the ladder (none for a CEO or sales). */
const spanFor = (w: World, kind: ManagerKind): number => {
  const m = w.cfg.labor.managers;
  return kind === "opsManager" ? m.ops.span : kind === "maintManager" ? m.maint.span : kind === "securityManager" ? m.security.span : Infinity;
};

/**
 * The edge a role gives a company, 0 to 1: the best one's skill, and on the ladder how full their spans
 * are and how much a CEO lifts them. Off the ladder and without a CEO, just the best one's skill.
 */
export function managerEffect(w: World, c: Company, kind: ManagerKind): number {
  const skill = managerSkill(w, c.id, kind);
  if (skill <= 0) return 0;
  let effect = skill;
  if (w.cfg.labor.ladder.enabled) {
    const n = managersOf(w, c.id, kind).length;
    effect *= loadFactor(w, operatingCount(w, c.id) / (spanFor(w, kind) * n), skill);
  }
  const m = w.cfg.labor.managers;
  if (m.roles && kind !== "ceo") effect *= 1 + m.ceo.boost * managerSkill(w, c.id, "ceo");
  return Math.min(1, effect);
}

/** Breakdown odds: more without a maintenance manager past the threshold, fewer with one, by their skill (on the ladder, the trucks past their spans count as without). */
export function managerBreakdownMult(w: World, c: Company): number {
  const k = w.cfg.labor.managers;
  if (!k.enabled) return 1;
  const operating = operatingCount(w, c.id);
  const n = managersOf(w, c.id, "maintManager").length;
  if (n > 0) {
    const withMult = 1 - (1 - k.maint.breakdownWith) * managerEffect(w, c, "maintManager");
    if (!w.cfg.labor.ladder.enabled) return withMult;
    const covered = Math.min(1, (k.maint.span * n) / Math.max(1, operating));
    return covered * withMult + (1 - covered) * k.maint.breakdownWithout;
  }
  return operating > k.maint.requiredAbove ? k.maint.breakdownWithout : 1;
}

/** Maintenance per mile: leaner with a maintenance manager, by their skill. */
export function managerMaintenanceMult(w: World, c: Company): number {
  const k = w.cfg.labor.managers;
  return k.enabled ? 1 - (1 - k.maint.maintenanceWith) * managerEffect(w, c, "maintManager") : 1;
}

/** With an operations manager, by their skill: fewer crashes, fewer pull-ins, and drivers pushed past the rules mind it less. */
export const opsCrashMult = (w: World, c: Company): number => (w.cfg.labor.managers.enabled ? 1 - (1 - w.cfg.labor.managers.ops.crashMult) * managerEffect(w, c, "opsManager") : 1);
export const opsPullInMult = (w: World, c: Company): number => (w.cfg.labor.managers.enabled ? 1 - (1 - w.cfg.labor.managers.ops.pullInMult) * managerEffect(w, c, "opsManager") : 1);
export const opsPushedMult = (w: World, c: Company): number => (w.cfg.labor.managers.enabled ? 1 - (1 - w.cfg.labor.managers.ops.pushedPenaltyMult) * managerEffect(w, c, "opsManager") : 1);

/** A security manager's cut to cargo and yard theft odds (1 without one, or with the roles off). */
export function securityTheftMult(w: World, c: Company): number {
  const m = w.cfg.labor.managers;
  return m.roles ? 1 - m.security.theftCut * managerEffect(w, c, "securityManager") : 1;
}

/** A security manager's cut to the insurance premium. */
export function securityPremiumMult(w: World, c: Company): number {
  const m = w.cfg.labor.managers;
  return m.roles ? 1 - m.security.premiumCut * managerEffect(w, c, "securityManager") : 1;
}

/** Sales reps (contracts.direct): how many direct contracts a company can carry, and the rate premium they win. */
export function salesContracts(w: World, c: Company): number {
  return managersOf(w, c.id, "salesRep").length * w.cfg.labor.managers.sales.contractsEach;
}
export function salesRatePremium(w: World, c: Company): number {
  return w.cfg.labor.managers.sales.ratePremium * managerEffect(w, c, "salesRep");
}

/** Bots (and the auto-staff order): hire the managers the fleet needs from the pool, best value first, when the cash is there; let the weakest go when the fleet has shrunk well below. */
export function autoManagers(w: World, c: Company): void {
  const k = w.cfg.labor.managers;
  if (!k.enabled || c.liquidatingSince !== null) return;
  const operating = operatingCount(w, c.id);
  for (const role of ["ops", "maint"] as const) {
    const kind = kindOf(role);
    const have = managersOf(w, c.id, kind).length;
    const need = managersNeeded(w, role, operating);
    if (have < need) {
      // Value: what they ask, discounted by what their skill is worth.
      const value = (s: Staff) => askingPay(w, s) * (1 - 0.4 * s.skill);
      const pool = poolOf(w, kind).sort((a, b) => value(a) - value(b) || a.id - b.id);
      let hired = 0;
      for (const s of pool) {
        if (have + hired >= need) break;
        const ask = askingPay(w, s);
        if (w.ledger.balance(companyAccount(c.id)) < ask * 8) break;
        hire(w, c, s, ask, null);
        hired++;
      }
    } else if (have > need && (need > 0 || operating <= k[role].requiredAbove - 2)) {
      const go = managersOf(w, c.id, kind).sort((a, b) => a.skill - b.skill || a.id - b.id)[0]!;
      releaseStaff(w, go);
    }
  }
  // The optional roles (labor.managers.roles): a sales rep once there's direct freight to win, a security
  // manager past fifteen trucks, a CEO past twenty-five, each when the cash covers two months of pay.
  if (!k.roles) return;
  const want: [ManagerKind, number][] = [
    ["salesRep", w.cfg.contracts.direct.enabled && operating >= 5 ? Math.ceil(Math.floor(operating / 5) / k.sales.contractsEach) : 0],
    ["securityManager", operating >= 15 ? Math.ceil(operating / k.security.span) : 0],
    ["ceo", operating >= 25 ? 1 : 0],
  ];
  for (const [kind, need] of want) {
    const have = managersOf(w, c.id, kind).length;
    if (have < need) {
      const value = (s: Staff) => askingPay(w, s) * (1 - 0.4 * s.skill);
      const s = poolOf(w, kind).sort((a, b) => value(a) - value(b) || a.id - b.id)[0];
      if (s && w.ledger.balance(companyAccount(c.id)) >= askingPay(w, s) * 8) hire(w, c, s, askingPay(w, s), null);
    } else if (have > need) releaseStaff(w, managersOf(w, c.id, kind).sort((a, b) => a.skill - b.skill || a.id - b.id)[0]!);
  }
}
