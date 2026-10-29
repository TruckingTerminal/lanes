import { dayOf } from "./clock.js";
import { clamp, finiteIn, fmtInt } from "./economics.js";
import { companyAccount } from "./ledger.js";
import type { Company, Staff, Truck, StandingOrder } from "./types.js";
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
  const skill = weighted / span;
  return {
    skill,
    span,
    coverage: operating <= 0 ? 1 : Math.min(1, span / operating),
    noise: lerp(labor.dispatcher.noise, skill),
    reloadWeight: board.reloadWeight * lerp(labor.dispatcher.reloadAware, skill),
    foresightDays: Math.round(lerp(labor.dispatcher.foresightDays, skill)),
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

const label = (s: Staff) => `${s.kind === "driver" ? "Driver" : "Dispatcher"} ${s.name} (${stars(s.skill)}★)`;

// --- The pool ---------------------------------------------------------------------

/** People already in the industry when the world starts: a spread of skill, most of it middling. */
export function seedPool(w: World): void {
  const { pool } = w.cfg.labor;
  const rng = w.rng.labor;
  for (const [kind, n] of [["driver", pool.startDrivers], ["dispatcher", pool.startDispatchers]] as const) {
    for (let i = 0; i < n; i++) {
      const u = rng.next();
      const skill = clamp(0.05 + 0.85 * u * u * (3 - 2 * u) * 0.95, 0, 0.95);
      const s = newStaff(w, kind, skill, skill + (1 - skill) * rng.range(0, 0.6));
      s.experience = Math.round(skill * (kind === "driver" ? 600_000 : 3_000));
    }
  }
}

function entrant(w: World, kind: Staff["kind"]): Staff {
  const { pool } = w.cfg.labor;
  const rng = w.rng.labor;
  const veteran = rng.next() < pool.veteranShare;
  const skill = veteran ? rng.range(pool.veteranSkill[0], pool.veteranSkill[1]) : rng.range(pool.rookieSkill[0], pool.rookieSkill[1]);
  const s = newStaff(w, kind, skill, rng.range(pool.potential[0], pool.potential[1]));
  s.experience = Math.round(skill * (kind === "driver" ? 600_000 : 3_000));
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
      w.ledger.post(w.t, companyAccount(c.id), "sink:per_diem", perDiem, `perdiem:${s.id}`);
      c.operating.costFd += perDiem;
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
        if (!s) break;
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
    if (pool[0]) hire(w, c, pool[0], askingPay(w, pool[0]), null);
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
    if (s.pending > 0) {
      const learn = s.kind === "driver" ? labor.driver.learnMiles : labor.dispatcher.learnLoads;
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
    if (pushesRules(c)) target -= morale.pushedPenalty * s.integrity;
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
  for (const kind of ["driver", "dispatcher"] as const) {
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
