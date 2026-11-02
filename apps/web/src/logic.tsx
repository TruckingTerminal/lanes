import type { ComponentChildren } from "preact";
import type { Equipment } from "@lanes/config";
import {
  breakEvenPerMile,
  canMakeHot,
  companyAccount,
  crewed,
  dispatchProfile,
  fleetOverheadPerWeek,
  lessorTrucksOf,
  yardPerTruck,
  driverFatigue,
  expectedReloadDeadheadMi,
  fuelPrice,
  hubMiles,
  hubToll,
  marketPay,
  operatingTrucks,
  ordersWaitForHand,
  reloadOdds,
  resting,
  seasonality,
  stars,
  vettingBlock,
  type Load,
  type Staff,
  type StandingOrder,
  type Truck,
} from "@lanes/engine";
import { GAME_CONFIG } from "./game.js";
import { ARRIVAL, DISPATCHER, NEEDS, TRUCK } from "./copy.js";
import { act, bumpData, clockMin, isPhone, me, myTrucks, push, S, setTab, selectTruck, toast, truckNo } from "./state.js";
import { tabDef, tabOpen, teaserTabs, type Tab } from "./tabs.js";
import { myTenders } from "./ui/panels/Contracts.js";
import { fd, hoursLabel, pct, plural, realUntil, signedPct, TRAILER_NAME } from "./format.js";
import { Btn } from "./ui/bits.js";

/** Game reasoning the panels share: idle diagnoses, status lines, crew lines, reload and season reads. */

export function openLoadsAt(hub: number): Load[] {
  const out: Load[] = [];
  for (const l of S.game!.w.loads.values()) if (l.status === "open" && l.origin === hub) out.push(l);
  return out;
}

/** A truck counts as stuck after this many hours idle: the dispatcher has had two rounds at it. */
export const IDLE_ALERT_HOURS = 24;
export const idleHours = (t: Truck): number => Math.max(0, (clockMin() - t.idleSinceT) / 60);
export const idleDays = (t: Truck): number => Math.floor(idleHours(t) / 24);
export const idleLabel = (t: Truck): string => hoursLabel(idleHours(t));

/** The player's trucks idle a day or more. */
export const stuckTrucks = (): Truck[] => myTrucks().filter((t) => t.status === "idle" && idleHours(t) >= IDLE_ALERT_HOURS);

/** Shouts once per idle day per truck, in the ticker and as a toast. */
const idleAlerted = new Map<string, number>();
export function checkIdleAlerts(): void {
  const g = S.game;
  if (!g?.player) return;
  for (const t of myTrucks()) {
    const key = `${g.kind}:${t.id}`;
    if (t.status !== "idle") {
      idleAlerted.delete(key);
      continue;
    }
    const days = idleDays(t);
    if (idleHours(t) < IDLE_ALERT_HOURS || idleAlerted.get(key) === days) continue;
    idleAlerted.set(key, days);
    const text = `Truck ${truckNo(t.id)} has been idle ${idleLabel(t)} at ${g.w.net.hubs[t.hub]!.name}: ${idleWhy(t).why}`;
    push(g, text, "bad");
    toast(text, true);
    bumpData();
  }
}

/**
 * Things that cost money while nobody looks: a truck with no driver, cash running out, weeks in
 * the red, a stretched dispatcher, defects piling up (Jeff, 2026-10-29: alerts for whatever is
 * missing, so time doesn't just pass).
 */
export interface Attention {
  key: string;
  text: string;
  tone: "bad" | "warn";
  fix: ComponentChildren;
}

export function attentionItems(): Attention[] {
  const g = S.game;
  if (!g?.player) return [];
  const w = g.w;
  const c = g.player;
  const out: Attention[] = [];
  const trucks = myTrucks();
  for (const t of trucks) {
    if (crewed(t) || t.status === "listed") continue;
    out.push({ key: `driver:${t.id}`, text: `Truck ${truckNo(t.id)} has no driver and earns nothing.`, tone: "bad", fix: <Btn primary onClick={goStaff}>Hire a driver</Btn> });
  }
  const bal = w.ledger.balance(companyAccount(c.id));
  const running = trucks.filter((t) => t.status !== "parked" && t.status !== "listed");
  const weeklyFixed = running.length * (c.insurance.annualPerTruck / 52) + fleetOverheadPerWeek(w.cfg, running.length) + lessorTrucksOf(w, c.id).length * 250 + yardPerTruck(w, c) * Math.max(0, trucks.length - 1);
  const money = <Btn onClick={() => setTab("money")}>Money</Btn>;
  if (bal < -w.cfg.insolvency.debtLimitFd) {
    const left = w.cfg.insolvency.weeksInDebt - c.weeksInDebt;
    out.push({ key: "debt", text: `You're ${fd(-bal)} FD in the red. ${left <= 1 ? "The next weekly check winds the company up" : `${left} more weeks in debt and the company is wound up`}: get loads moving, sell or park a truck, or put money in.`, tone: "bad", fix: money });
  } else if (weeklyFixed > 0 && bal < 2 * weeklyFixed) {
    out.push({ key: "cash", text: `Cash is low: ${fd(bal)} FD against about ${fd(weeklyFixed)} FD a week of insurance, overhead, leases and yard before a wheel turns.`, tone: "warn", fix: money });
  }
  const prof = dispatchProfile(w, c, running.length);
  if (prof.coverage < 0.8) out.push({ key: "dispatch", text: `Your dispatch team covers ${prof.span} trucks and you run ${running.length}: about ${Math.round((1 - prof.coverage) * 100)}% of idle trucks sit out each round.`, tone: "warn", fix: <Btn primary onClick={goStaff}>Hire a dispatcher</Btn> });
  for (const t of trucks) {
    if (t.defects >= 3 && (t.status === "idle" || t.status === "parked"))
      out.push({ key: `defects:${t.id}`, text: `Truck ${truckNo(t.id)} is carrying ${t.defects} defects: an inspection finds them, and they raise crash odds.`, tone: "warn", fix: <Btn onClick={() => act({ type: "fix_defects", truckId: t.id }, "Defects fixed")}>Fix · {fd(t.defects * w.cfg.safety.maintenance.fixFdPerDefect)} FD</Btn> });
  }
  return out;
}

export function AttentionCard(): ComponentChildren {
  const items = attentionItems();
  if (!items.length) return null;
  return (
    <section class="card alert">
      <h3>{TRUCK.needsYou}</h3>
      {items.map((a) => (
        <div class="row" key={a.key} data-need={a.key}>
          <span class={a.tone}>{a.text}</span>
          {a.fix}
        </div>
      ))}
    </section>
  );
}

/**
 * Everything waiting on the player (the top strip's red count): where its card is, so a tap on the count opens that tab
 * and brings the card, with its fix, into view (Jeff, 2026-11-02). The money alarms open Money, a bid's result Loads,
 * a teaser that just opened More; the rest are cards on the Truck tab.
 */
export interface Need {
  key: string;
  text: string;
  tab: Tab;
  /** A CSS selector for the card to scroll to. */
  target: string;
}
export function needs(): Need[] {
  const g = S.game;
  const c = g?.player;
  if (!g || !c) return [];
  const w = g.w;
  const out: Need[] = [];
  for (const a of attentionItems()) {
    const money = a.key === "debt" || a.key === "cash";
    out.push({ key: a.key, text: a.text, tab: money ? "money" : "fleet", target: money ? ".cashcard" : `[data-need="${a.key}"]` });
  }
  for (const l of myTenders(c)) out.push({ key: `tender:${l.id}`, text: NEEDS.tender(w.net.places[l.originPlace]!.name, w.net.places[l.destPlace]!.name), tab: "fleet", target: `[data-need="tender:${l.id}"]` });
  for (const t of tiredTrucks()) {
    const d = w.staff[t.driverId - 1]!;
    out.push({ key: `tired:${t.id}`, text: NEEDS.tired(d.owner ? "You" : d.name), tab: "fleet", target: `[data-need="tired:${t.id}"]` });
  }
  for (const t of stuckTrucks()) out.push({ key: `idle:${t.id}`, text: NEEDS.idle(truckName(t), w.net.hubs[t.hub]!.name, idleLabel(t)), tab: "fleet", target: `[data-need="idle:${t.id}"]` });
  if (S.result && !S.result.seen) out.push({ key: "result", text: NEEDS.result(S.result.won), tab: "loads", target: ".resultcard" });
  for (const t of teaserTabs()) if (tabOpen(t.id, w, c) && !S.onboard.visited.includes(t.id)) out.push({ key: `opened:${t.id}`, text: NEEDS.opened(tabDef(t.id).label), tab: "more", target: `[data-need="opened:${t.id}"]` });
  return out;
}
/** Opens a waiting thing's tab (the sheet at half on a phone) and scrolls its card into view, flashing it once. */
export function openNeed(n: Need): void {
  if (isPhone() && S.sheet === "strip") S.sheet = "half";
  setTab(n.tab);
  // Two frames: the tab renders, then the sheet has its height.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(n.target);
      if (!el) return;
      el.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }),
  );
}

/** Says each new item once, as a toast, the moment it appears. */
const attentionSeen = new Set<string>();
export function checkAttention(): void {
  const g = S.game;
  if (!g?.player) return;
  const items = attentionItems();
  const keys = new Set(items.map((a) => `${g.kind}:${a.key}`));
  for (const k of [...attentionSeen]) if (!keys.has(k)) attentionSeen.delete(k);
  for (const a of items) {
    const k = `${g.kind}:${a.key}`;
    if (attentionSeen.has(k)) continue;
    attentionSeen.add(k);
    toast(a.text, a.tone === "bad");
    push(g, a.text, a.tone === "bad" ? "bad" : "warn");
  }
}
/** The player's trucks whose driver has been out past the fatigue line or is already tired. */
export const tiredTrucks = (): Truck[] => {
  const f = GAME_CONFIG.fatigue;
  const w = S.game!.w;
  return myTrucks().filter((t) => crewed(t) && !resting(w, t) && (driverFatigue(w, t) >= f.tiredAt || w.staff[t.driverId - 1]!.awayDays >= f.roadDays));
};

export interface IdleWhy {
  why: string;
  fixes: ComponentChildren[];
}

export const goStaff = (): void => setTab("staff");
export const goLoads = (truck: number): void => {
  selectTruck(truck);
  setTab("loads");
};

/** Why one of the player's idle trucks isn't moving, and what would move it. */
export function idleWhy(t: Truck): IdleWhy {
  const w = S.game!.w;
  const c = me();
  const hubName = w.net.hubs[t.hub]!.name;
  const trailer = TRAILER_NAME[t.trailer].toLowerCase();
  const board = <Btn onClick={() => goLoads(t.id)}>{TRUCK.bidByHand}</Btn>;
  if (!crewed(t)) return { why: "No driver is seated, so it can't run.", fixes: [<Btn primary onClick={goStaff}>Hire a driver</Btn>] };
  if (c.authority.status !== "active") return { why: c.authority.status === "revoked" ? "Your authority is revoked: nothing can haul." : "Your authority is suspended: nothing can haul until it's back.", fixes: [] };
  if (t.breakdownMin > 0) return { why: `Broken down: about ${Math.ceil(t.breakdownMin / 60)} h until the tow and repair are done.`, fixes: [] };
  const bid = w.manualBids.get(t.id);
  if (bid) return { why: `Your bid of ${bid.rate.toFixed(2)}/mi is in for the next round.`, fixes: [] };
  // The first bid by hand (S9): the dispatcher waits for the owner's first call, so the fix is the board, not the orders.
  if (ordersWaitForHand(w, c)) return { why: DISPATCHER.waitingCard(hubName), fixes: [<Btn primary onClick={() => goLoads(t.id)}>{ARRIVAL.showBoard}</Btn>] };
  const order = c.orders.find((o): o is Extract<StandingOrder, { kind: "bid" }> => o.kind === "bid");
  if (!order) return { why: "Your dispatcher has no bid order, so nobody bids for this truck.", fixes: [<Btn primary onClick={() => act({ type: "set_standing_orders", orders: DEFAULTS() }, "Dispatcher back to defaults")}>Restore the default dispatcher</Btn>, board] };
  const floor = c.orders.find((o): o is Extract<StandingOrder, { kind: "floor" }> => o.kind === "floor");
  const maxDh = order.maxDeadheadMi;
  const loads = [...w.loads.values()].filter((l) => l.status === "open" && l.equipment === t.trailer && l.brokerId !== c.id && hubMiles(w, t.hub, l.origin) <= maxDh);
  if (loads.length === 0) {
    const best = w.net.hubs
      .map((h, i) => ({ h, i, mi: hubMiles(w, t.hub, i), n: openLoadsAt(i).filter((l) => l.equipment === t.trailer).length }))
      .filter((x) => x.i !== t.hub && x.n > 0 && x.mi <= 800)
      .sort((a, b) => b.n - b.mi / 200 - (a.n - a.mi / 200))[0];
    return {
      why: `${TRUCK.noLoadsInRange(trailer, maxDh, hubName)}${best ? ` The nearest freight worth the run is ${plural(best.n, "load")} at ${best.h.name}, ${best.mi} mi away.` : ""}`,
      fixes: [
        ...(best ? [<Btn primary onClick={() => act({ type: "reposition_truck", truckId: t.id, hubId: best.h.id }, TRUCK.sentEmpty)}>{TRUCK.sendEmpty(best.h.name, best.mi)}</Btn>] : []),
        <Btn onClick={() => goLoads(t.id)}>{TRUCK.bidByHand}</Btn>,
      ],
    };
  }
  if (loads.every((l) => l.hot > 0) && !canMakeHot(c, t)) return { why: `The only ${trailer} loads in range are hot, and a solo driver can't make a hot window legally.`, fixes: [<Btn primary onClick={goStaff}>Seat a co-driver</Btn>] };
  const blocked = loads.map((l) => vettingBlock(w, c, l)).filter((x): x is string => x !== null);
  if (blocked.length === loads.length) return { why: `Every load in range requires vetting you don't pass: ${blocked[0]}.`, fixes: [] };
  const fuel = fuelPrice(w);
  const floorPct = floor?.breakEvenPlusPct ?? 0;
  const payable = loads.filter((l) => {
    const dh = hubMiles(w, t.hub, l.origin);
    const be = breakEvenPerMile(w.cfg, t, fuel, l.miles, dh + w.cfg.board.reloadWeight * expectedReloadDeadheadMi(w, l.dest, l.equipment), hubToll(w, t.hub, l.origin) + w.net.lanes[l.laneId]!.tollFd);
    return l.ceiling >= be * (1 + floorPct);
  });
  if (payable.length === 0) return { why: `${plural(loads.length, `${trailer} load`)} in range, but none pays your floor (break-even + ${Math.round(floorPct * 100)}%) even at its ceiling.`, fixes: [board] };
  const running = operatingTrucks(w, c.id);
  const prof = dispatchProfile(w, c, running);
  if (prof.coverage < 1) return { why: `Your dispatcher is stretched: ${prof.span} trucks' worth of attention for the ${running} you run, so this truck sits out about ${Math.round((1 - prof.coverage) * 100)}% of rounds.`, fixes: [<Btn primary onClick={goStaff}>Hire a dispatcher</Btn>, board] };
  return { why: `${plural(payable.length, `${trailer} load`)} in range pay enough, but the dispatcher's bids keep losing: other carriers bid lower or have the better record.`, fixes: [<Btn primary onClick={() => goLoads(t.id)}>Bid by hand</Btn>] };
}
/** Late import to avoid a cycle: the default orders live with the game config. */
function DEFAULTS(): StandingOrder[] {
  return DEFAULT_ORDERS_REF();
}
let DEFAULT_ORDERS_REF: () => StandingOrder[] = () => [];
export function setDefaultOrders(f: () => StandingOrder[]): void {
  DEFAULT_ORDERS_REF = f;
}

/** Plain-text status, for tooltips and the ticker. */
export function statusText(t: Truck): string {
  const w = S.game!.w;
  const name = (i: number) => w.net.places[i]!.name;
  switch (t.status) {
    case "idle":
      return resting(w, t) ? `Home time at ${name(t.place)}` : `Idle at ${name(t.place)} for ${idleLabel(t)}`;
    case "toPickup":
      return `Heading empty to ${name(t.targetPlace)} for a pickup · ${Math.round(t.remainingMi)} mi`;
    case "loading":
      return `Loading at ${name(t.place)}`;
    case "loaded":
      return `Loaded ${name(t.place)} → ${name(t.targetPlace)} · ${Math.round(t.remainingMi)} mi to go`;
    case "unloading":
      return `Unloading at ${name(t.targetPlace)}`;
    case "repositioning":
      return `Running empty to ${name(t.targetPlace)} · ${Math.round(t.remainingMi)} mi`;
    case "repair":
      return "In the shop";
    case "parked":
      return `Parked at ${name(t.place)}`;
    case "listed":
      return "Listed for sale";
    default:
      return t.status;
  }
}

/** The status line on a fleet card, with the idle clock coloured as it ages. */
export function StatusLine({ t }: { t: Truck }): ComponentChildren {
  const w = S.game!.w;
  const name = (i: number) => w.net.places[i]!.name;
  switch (t.status) {
    case "idle": {
      const bid = w.manualBids.get(t.id);
      if (!bid && ordersWaitForHand(w, me())) return <>{DISPATCHER.waitingCard(name(t.place))}</>;
      if (resting(w, t)) {
        const d = w.staff[t.driverId - 1]!;
        const left = d.homeUntilDay! - Math.floor(clockMin() / 1440) - (d.drivenMinToday > 0 ? 1 : 0);
        return (
          <>
            Home time at {name(t.place)}: {plural(Math.max(1, left), "day")} off{d.drivenMinToday > 0 ? ", starting tomorrow" : " left"}
          </>
        );
      }
      // The audit: not "sat out a round" thirty seconds in; the idle clock turns amber, then red, as it ages.
      const h = idleHours(t);
      return (
        <>
          <span class={h >= IDLE_ALERT_HOURS ? "bad" : h >= 12 ? "warn" : ""}>{TRUCK.idle(name(t.place), nextRoundHour())}</span>
          {bid ? <span class="good"> · your bid {bid.rate.toFixed(2)}/mi is in</span> : null}
        </>
      );
    }
    case "loaded": {
      const l = t.loadId !== null ? w.loads.get(t.loadId) : undefined;
      return (
        <>
          Loaded {name(t.place)} → {name(t.targetPlace)} · {Math.round(t.remainingMi)} mi to go{l ? ` · ${l.clearedRate.toFixed(2)}/mi` : ""}
          {t.breakdownMin > 0 ? <span class="bad"> · broken down</span> : null}
        </>
      );
    }
    case "parked":
      return <>Parked at {name(t.place)} (off the road; an owned truck unused {w.cfg.costs.idleFeeAfterDays}+ days pays {w.cfg.costs.idleFeePerDay} FD/day)</>;
    default:
      return <>{statusText(t)}</>;
  }
}

/** The next bidding round's hour of the day (6 or 18) and its game minute. */
function nextRound(): { hour: number; at: number } {
  const minute = clockMin();
  const hour = (minute / 60) % 24;
  const next = hour < 6 ? 6 : hour < 18 ? 18 : 30;
  return { hour: next % 24, at: minute + (next - hour) * 60 };
}
/** "18:00": the next round, for short lines. */
export const nextRoundHour = (): string => `${String(nextRound().hour).padStart(2, "0")}:00`;
/** How long until the next round: real time live, game hours in a test world. */
export function nextRoundWait(): string {
  const g = S.game!;
  const { at } = nextRound();
  return g.kind === "live" ? realUntil(g.msUntil(at)) : `${Math.ceil((at - clockMin()) / 60)}h`;
}
/** How far through the current round the clock is, 0 to 1: the pinned bid's ring (S4). */
export function roundProgress(): number {
  const { at } = nextRound();
  return Math.max(0, Math.min(1, 1 - (at - clockMin()) / (12 * 60)));
}
export function nextRoundLabel(): string {
  return `${nextRoundHour()} (in ${nextRoundWait()})`;
}

/**
 * The sheet's state line on a phone (copy-first-ten-minutes.md): the bids waiting on the round when there are any,
 * else the selected truck (or the first) in a few words.
 */
export function sheetLine(): string {
  const g = S.game!;
  const c = g.player;
  if (!c) return g.kind === "test" || g.writer ? "Choose your home hub" : "Watching the live world";
  const trucks = myTrucks();
  const bids = trucks.filter((t) => g.w.manualBids.has(t.id)).length;
  if (bids) return `${bids === 1 ? "1 bid in" : `${bids} bids in`} · clears ${nextRoundHour()}`;
  const t = trucks.find((x) => x.id === S.selTruck) ?? trucks[0];
  if (!t) return "No trucks on the road";
  const name = `Truck ${truckNo(t.id)}`;
  // Under the first-bid rule the dispatcher waits for your first bid, and the truck waits at home (copy spec, S6).
  if (t.status === "idle" && ordersWaitForHand(g.w, c)) return `${name} · Waiting at ${g.w.net.places[t.place]!.name} · round ${nextRoundHour()}`;
  if (t.status === "idle" && !resting(g.w, t)) return `${name} · Idle at ${g.w.net.places[t.place]!.name} · round ${nextRoundHour()}`;
  return `${name} · ${statusText(t)}`;
}

/** How easily a truck of this type reloads after delivering at a hub, against the national average. */
export function reloadLabel(hub: number, eq: Equipment): string {
  const r = reloadOdds(S.game!.w, hub, eq);
  return r >= 1.25 ? "good" : r >= 0.8 ? "fair" : "poor";
}
export function reloadClass(hub: number, eq: Equipment): string {
  const r = reloadOdds(S.game!.w, hub, eq);
  return r >= 1.25 ? "good" : r >= 0.8 ? "" : "bad";
}
/** The origin's season for this trailer, when it's moving rates noticeably. */
export function seasonSwing(hub: number, eq: Equipment): number {
  return seasonality(S.game!.w, hub, eq, Math.floor(clockMin() / 1440)).rate - 1;
}
export function SeasonNote({ hub, eq }: { hub: number; eq: Equipment }): ComponentChildren {
  const swing = seasonSwing(hub, eq);
  if (Math.abs(swing) < 0.05) return null;
  return (
    <span class={swing > 0 ? "good" : "bad"}>
      {swing > 0 ? "in season" : "off season"} {signedPct(swing)}
    </span>
  );
}

// --- People ------------------------------------------------------------------------

export function Stars({ skill }: { skill: number }): ComponentChildren {
  const n = stars(skill);
  return (
    <span class="stars" title={`${Math.round(skill * 100)}% skill`}>
      {"★".repeat(n)}
      {"☆".repeat(5 - n)}
    </span>
  );
}
export const moraleWord = (m: number): string => (m >= 0.65 ? "happy" : m >= 0.45 ? "settled" : m >= 0.3 ? "restless" : "unhappy");
export const moraleClass = (m: number): string => (m >= 0.45 ? "good" : m >= 0.3 ? "warn" : "bad");
export const staffPay = (s: Staff, x: number): string => (s.kind === "driver" ? `${x.toFixed(2)} FD/mi` : `${fd(x)} FD/wk`);
/** At a hub (or in the shop), where a crew can change. */
export const atHub = (t: Truck): boolean => t.status === "idle" || t.status === "parked" || t.status === "repair";

/** Days out and fatigue, for a driver. */
export function FatigueTag({ s }: { s: Staff }): ComponentChildren {
  const f = GAME_CONFIG.fatigue;
  const out = s.awayDays > 0 ? ` · ${s.awayDays} d out` : "";
  if (s.fatigue >= f.tiredAt)
    return (
      <>
        {out} · <span class="bad">tired {pct(s.fatigue)}</span>
      </>
    );
  if (s.fatigue >= f.tiredAt / 2)
    return (
      <>
        {out} · <span class="warn">wearing {pct(s.fatigue)}</span>
      </>
    );
  return <>{out}</>;
}

/** Who drives a truck, for its fleet card. */
export function CrewLine({ t }: { t: Truck }): ComponentChildren {
  const w = S.game!.w;
  if (!crewed(t)) return <span class="bad">No driver: the truck can't run.</span>;
  const d = w.staff[t.driverId - 1]!;
  const co = t.coDriverId ? w.staff[t.coDriverId - 1]! : null;
  const who = (s: Staff) => (
    <>
      {s.owner ? "You" : s.name} <Stars skill={s.skill} />
      <FatigueTag s={s} />
    </>
  );
  return (
    <>
      Driver: {who(d)}
      {co ? <> · team with {who(co)}</> : null} · {t.wagePerMile.toFixed(2)} FD/mi
      {t.defects > 0 ? <span class="warn"> · {plural(t.defects, "defect")}</span> : null}
    </>
  );
}

export const marketPayOf = (s: Staff): number => marketPay(S.game!.w, s.kind, s.skill);
export const truckName = (t: Truck): string => `Truck ${truckNo(t.id)}`;
