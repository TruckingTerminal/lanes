import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { condition, crewed, dutyResetAt, hubMiles, ordersOf, rebuildable, rebuildCost, resting, truckValue, type Company, type Staff, type StandingOrder, type Truck, type World } from "@lanes/engine";
import { SCENES } from "../../assets.js";
import { cls, dateLabel, fd, fdFull, pct, plural, shortDate, TIER_NAME, TRAILER_NAME, hhmm, realUntil } from "../../format.js";
import { HOURS, MOVE, NEEDS, TRUCK } from "../../copy.js";
import { GAME_CONFIG } from "../../game.js";
import { AttentionCard, CrewLine, goLoads, goStaff, idleLabel, idleWhy, seatBack, StatusLine, stuckTrucks, tiredTrucks, truckName, truckWhere, wallLine, wallTrucks, waysOut } from "../../logic.js";
import { freeDriverFor, isFreeDriver } from "../../nextstep.js";
import { focusTruck } from "../../mapview.js";
import { act, describe, isPhone, me, myTrucks, ownerOf, S, selectTruck, truckNo, useData, tickerInView } from "../../state.js";
import { Bar, Btn, Card, Num, Panel, Pixel } from "../bits.js";
import { Rig, Scene } from "../Loop.js";
import { Fig } from "../Explain.js";
import { TendersCard } from "./Contracts.js";
import { MoneyEventRows } from "../MonthReport.js";
import { DispatcherCard } from "./Dispatcher.js";
import { DeliveredCard, RollingCards } from "./Rolling.js";
import { emptyRun } from "../../rolling.js";
import { TrailerLines, TruckAssetActions, YardCard } from "./Yard.js";
import { WaysOutRows } from "../WaysOut.js";
import { PENDING } from "../../copy-pending.js";
import { PENDING_RULES } from "../../copy-pending-rules.js";
import { paysFrom } from "../../exits.js";
import { confirmAct, confirmSpend } from "../Confirm.js";
import { rebuild as rebuildLines, sell as sellLines, sellsFor } from "../../confirmspecs.js";
import { CapsLine } from "../Caps.js";
import { leaseMinFor } from "../../ledger.js";
import { OrderOffers } from "../OrderOffers.js";
import { expediteOn, expediteQuote, expediteWaitParts } from "@lanes/engine";
import { expediteLines, waitSentence } from "../../expediteui.js";



/** Send home's price before the tap (R24). */
/** A send-empty destination with its price (R24). */
function emptyLine(t: Truck, hub: number): string {
  const w = S.game!.w;
  const r = emptyRun(w, t, t.hub, hub);
  return MOVE.empty(w.net.hubs[hub]!.name, r.mi, r.fd, r.time);
}

/**
 * R24 (player5-ux.md section 3): a move's button with its price before the tap. On a phone the label sits on the
 * button and the price on one line under it, an explain key (move.cost); on a laptop the whole line is the button.
 * Above guard.confirmShareOfCash of cash, R6's card follows the press; below it, the price is the guardrail.
 */
function MoveBtn({ t, toHub, label, full, does, primary, run }: { t: Truck; toHub: number; label: string; full: string; does: string; primary?: boolean; run: () => void }): JSX.Element {
  const w = S.game!.w;
  const r = emptyRun(w, t, t.hub, toHub);
  const press = (ev: MouseEvent) => confirmSpend({ verb: label, item: `truck ${truckNo(t.id)}`, costFd: r.costFd, does, risk: MOVE.confirmRisk, run }, ev);
  if (!isPhone())
    return (
      <Btn primary={primary} onClick={press}>
        {full}
      </Btn>
    );
  return (
    <span class="movebtn">
      <Btn primary={primary} onClick={press}>
        {label}
      </Btn>
      <Fig k="move.cost" label={label} ctx={{ truckId: t.id, toHub }}>
        <span class="price">{fitPrice(MOVE.price(r.mi, r.fd, r.time))}</span>
      </Fig>
    </span>
  );
}

/** The phone's price line, one line at a 343 px button's width: "empty" goes first, then "about"; the FD and the days stay. */
const PRICE_CHARS = 40;
function fitPrice(line: string): string {
  let out = line;
  if (out.length > PRICE_CHARS) out = out.replace(" mi empty", " mi");
  if (out.length > PRICE_CHARS) out = out.replace("about ", "");
  return out;
}

/** The days off a driver's home time gives (labor.ts startHomeTime: the home-time order's, else fatigue.resetDays). */
function homeDays(c: Company): number {
  const hm = c.orders.find((o): o is Extract<StandingOrder, { kind: "homeTime" }> => o.kind === "homeTime");
  return hm?.restDays ?? GAME_CONFIG.fatigue.resetDays;
}

/** The days a home-due truck waits for a homeward load before it runs home empty (fatigue.homeward, in board rounds). */
const homeWaitDays = (w: World): number => w.cfg.fatigue.homeward.deadheadAfterRounds / w.cfg.time.boardRoundHours.length;

/**
 * A crew due home, said as the engine does it (client batch 4; QA's truck sat at Albuquerque Saturday to Monday): heading
 * home only while running empty toward home; idle, home at the next round when near (fatigue.homeward.deadheadWithinMi),
 * else waiting for a homeward load or the idle rounds; on a run, home after it the same way (board.ts maybeReposition).
 */
function homeTimeLine(w: World, c: Company, t: Truck): string {
  const hw = w.cfg.fatigue.homeward;
  if (t.status === "repositioning" && t.targetHub === c.homeHub) return PENDING.homeTimeHeading;
  if (t.status === "idle") return hubMiles(w, t.hub, c.homeHub) <= hw.deadheadWithinMi ? PENDING.homeTimeNextRound : PENDING.homeTimeWaiting(homeWaitDays(w));
  return PENDING.homeTimeQueued(hw.deadheadWithinMi.toLocaleString("en-US"), homeWaitDays(w));
}

/**
 * Send home (the director, 2026-11-09), on any truck, whenever the player asks; the home-time rule's 24 days stays the
 * rule for a driver's own demand (TiredAlerts). Never time off nobody asked for, and the days on the button:
 * - idle away from home, an owner-operator gets two: "Send home · back to work" (an empty run home, no days off) and
 *   "Home time · n days off" (send_home); a hired driver's Send home is home time, as its rule stands;
 * - working (loaded, heading to a pickup, loading or unloading, or running empty elsewhere), it's queued: home time after
 *   this delivery, so the load is never abandoned (labor.sendHomeWhileMoving). Once asked it says so, and the button goes.
 * An owner-operator's "back to work" after a delivery, and turning a truck that's running empty now, need the engine (the
 * batch's report); until then the queued one is home time, said so on the button.
 */
function SendHomeActions({ t, primary }: { t: Truck; primary?: boolean }): JSX.Element | null {
  const w = S.game!.w;
  // Client batch 8a item 29: the truck's own company, whichever company is in view.
  const c = ownerOf(t);
  if (!crewed(t) || resting(w, t) || t.status === "parked" || t.status === "listed" || t.status === "retired") return null;
  const crew = [t.driverId, t.coDriverId].filter((id) => id > 0).map((id) => w.staff[id - 1]!);
  const owner = crew.some((d) => d.owner);
  const days = homeDays(c);
  if (crew.every((d) => d.wantsHome)) return <p class="muted small">{homeTimeLine(w, c, t)}</p>;
  if (t.homeAfter === "work") return <p class="muted small">{PENDING_RULES.homeAfterWorkQueued}</p>;
  // labor.turnWhileEmpty: a truck running empty turns for home now, from where it is. An owner-operator gets the two the
  // director ruled, as on a truck at work: back to work (labor.sendHomeToWork) and home time; a hired driver, home time.
  if (t.status === "repositioning" && w.cfg.labor.turnWhileEmpty && t.targetHub !== c.homeHub) {
    const toWork = owner && w.cfg.labor.sendHomeToWork;
    return (
      <>
        {toWork ? (
          <Btn primary={primary} onClick={() => act({ type: "send_home", truckId: t.id, work: true }, PENDING_RULES.turnedWorkToast, "truck:sendHome")}>
            {PENDING_RULES.sendHomeNowWork}
          </Btn>
        ) : null}
        <Btn primary={primary && !toWork} onClick={() => act({ type: "send_home", truckId: t.id }, PENDING_RULES.turnedDaysToast, "truck:sendHome")}>
          {PENDING_RULES.sendHomeNowDays(days)}
        </Btn>
      </>
    );
  }
  if (t.status === "idle") {
    if (t.hub === c.homeHub) return null;
    const r = emptyRun(w, t, t.hub, c.homeHub);
    const price = MOVE.price(r.mi, r.fd, r.time);
    const home = () => act({ type: "send_home", truckId: t.id }, PENDING.homeTimeToast, "truck:sendHome");
    return (
      <>
        {owner ? <MoveBtn t={t} toHub={c.homeHub} label={PENDING.sendHomeWork} full={`${PENDING.sendHomeWork} · ${price}`} does={PENDING.sendHomeWorkDoes} primary={primary} run={() => act({ type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[c.homeHub]!.id }, PENDING.sendHomeWorkToast, "truck:sendEmpty")} /> : null}
        <MoveBtn t={t} toHub={c.homeHub} label={PENDING.homeTimeDays(days)} full={`${PENDING.homeTimeDays(days)} · ${price}`} does={PENDING.homeTimeDoes(days)} primary={primary && !owner} run={home} />
      </>
    );
  }
  // labor.sendHomeToWork: an owner-operator's home to work after the job in hand, no days off.
  const work = owner && w.cfg.labor.sendHomeToWork ? (
    <Btn primary={primary} onClick={() => act({ type: "send_home", truckId: t.id, work: true }, PENDING_RULES.homeAfterWorkToast, "truck:sendHome")}>
      {PENDING_RULES.homeAfterWork}
    </Btn>
  ) : null;
  if (!w.cfg.labor.sendHomeWhileMoving) return work;
  return (
    <>
      {work}
      <Btn primary={primary && !work} onClick={() => act({ type: "send_home", truckId: t.id }, PENDING.homeTimeQueuedToast(w.cfg.fatigue.homeward.deadheadWithinMi.toLocaleString("en-US"), homeWaitDays(w)), "truck:sendHome")}>
        {PENDING.sendHomeAfter} · {PENDING.homeTimeDays(days)}
      </Btn>
    </>
  );
}

/**
 * Send empty: the hub list with each run's price and the loads that pay there (exits.ts paysFrom, the ways-out sheet's
 * count), and the button priced for the hub picked, before the press (R24). It opens on the cheapest run to a hub where a
 * load pays (QA, client pass 2: it opened on Tampa, where nothing paid), else the nearest.
 */
/**
 * QA's 0.24.1 replay, fail 3: off sale undoes the listing when it can. Listing took the crew off the truck (market.ts
 * listTruck); a driver of the company with no truck, standing by it (the one who drove it first), goes back in, and the
 * truck back on the road (withdraw_listing leaves it parked). With none, it stays parked and What now? asks for a driver.
 */
function offSale(w: World, t: Truck, listingId: number): void {
  const c = ownerOf(t);
  const own = S.listedCrew.get(t.id) ?? [];
  const s = freeDriverFor(w, c, t, own, S.lastDriver.get(t.id));
  if (!s) return act({ type: "withdraw_listing", listingId }, PENDING.offSaleTruck);
  // Its own co-driver too, when the driver going back is its own and the co-driver is still free.
  const co = own[0] === s.id && own[1] ? w.staff[own[1] - 1] : undefined;
  const ok = PENDING.offSaleBack(truckNo(t.id), s.owner ? "you" : s.name);
  act({ type: "withdraw_listing", listingId }, ok);
  seatBack(t.id, s.id, ok, co && isFreeDriver(c, co) ? co.id : undefined);
  S.listedCrew.delete(t.id);
}

function SendEmpty({ t, nearby }: { t: Truck; nearby: { i: number }[] }): JSX.Element | null {
  const w = S.game!.w;
  // Client batch 8a item 29: the truck's own company, whichever company is in view.
  const c = ownerOf(t);
  const [pick, setPick] = useState<number | null>(null);
  if (!nearby.length) return null;
  // Client batch 8d item 6: running empty, the hub it already runs to isn't a turn.
  const runs = nearby.filter((x) => !(t.status === "repositioning" && x.i === t.targetHub)).map((x) => ({ i: x.i, run: emptyRun(w, t, t.hub, x.i), pays: paysFrom(w, c, t, x.i) }));
  if (!runs.length) return null;
  const paying = runs.filter((x) => x.pays > 0).sort((a, b) => a.run.costFd - b.run.costFd || a.i - b.i)[0];
  const hub = pick !== null && nearby.some((x) => x.i === pick) ? pick : (paying ?? runs[0]!).i;
  const name = w.net.hubs[hub]!.name;
  const r = emptyRun(w, t, t.hub, hub);
  return (
    <>
      <select id={`send-${t.id}`} aria-label="Destination hub" value={String(hub)} onChange={(ev) => setPick(Number((ev.currentTarget as HTMLSelectElement).value))}>
        {runs.map((x) => (
          <option value={String(x.i)} key={x.i}>
            {PENDING.exitTo(w.net.hubs[x.i]!.name, x.run.mi, x.run.fd, x.run.time, x.pays)}
          </option>
        ))}
      </select>
      <MoveBtn t={t} toHub={hub} label={MOVE.sendTo(name)} full={`${MOVE.sendTo(name)} · ${MOVE.price(r.mi, r.fd, r.time)}`} does={MOVE.confirmEmpty(name)} run={() => act({ type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[hub]!.id }, TRUCK.sentEmpty, "truck:sendEmpty")} />
    </>
  );
}

export function Fleet(): JSX.Element {
  useData();
  const w = S.game!.w;
  const trucks = myTrucks();
  const pending = ordersOf(w, me().id);
  return (
    <Panel title="Your fleet">
      <DeliveredCard />
      <RollingCards />
      {/* Client batch 8b item 63: a further standing order, offered once at its moment. */}
      <OrderOffers />
      <TodayCard />
      <Scene name="yard" still={SCENES.yard} alt="Your yard at dusk" />
      <AttentionCard />
      <TendersCard c={me()} />
      <TiredAlerts />
      <IdleAlerts />
      <PendingCard />
      {/* Client batch 8b section D: an order row each, with "Expedite" while an early slot comes before its ready day. */}
      {pending.map((o) => {
        const what = o.kind === "trailer" ? `${TRAILER_NAME[o.trailer]} trailer` : o.kind === "tractor" ? `${TIER_NAME[o.tier]} tractor` : `${TIER_NAME[o.tier]} + ${TRAILER_NAME[o.trailer]}`;
        const q = expediteOn(w) ? expediteQuote(w, me(), o.id) : null;
        const parts = q && !("why" in q) ? expediteWaitParts(w, me(), o.id) : null;
        return (
          <div class="row" key={o.id}>
            <span class="muted small">{PENDING.orderOnRow(what, dateLabel(o.dueDay))}</span>
            {q && !("why" in q) ? (
              <Btn
                sm
                onClick={(ev) =>
                  confirmAct(
                    {
                      verb: PENDING.expediteVerb,
                      item: what,
                      costFd: q.feeFd,
                      does: expediteLines(q, o.dueDay).join(" "),
                      risk: parts && !("why" in parts) ? waitSentence(w, me(), parts) : null,
                      go: PENDING.expediteCardButton(shortDate(q.readyDay), fdFull(q.feeFd)),
                      run: () => act({ type: "expedite_order", orderId: o.id }, PENDING.expediteDone(shortDate(q.readyDay))),
                    },
                    ev,
                  )
                }
              >
                {PENDING.expediteCardButton(shortDate(q.readyDay), fdFull(q.feeFd))}
              </Btn>
            ) : null}
          </div>
        );
      })}
      {trucks.map((t, idx) => (
        <TruckCard key={t.id} t={t} idx={idx} />
      ))}
      <CapsLine />
      <YardCard />
      <DispatcherCard />
    </Panel>
  );
}

/** Today (S6): the last eight lines of the feed, which a phone has no ticker for. */
function TodayCard(): JSX.Element | null {
  // R9: the day's breakdowns, fines and claims over guard.newsFd come first, in the money style; their ticker lines give way.
  const w = S.game!.w;
  const money = <MoneyEventRows sinceT={w.t - w.cfg.time.gameMinutesPerDay} />;
  // Client batch 8b item 37: the company in view's lines.
  const lines = tickerInView()
    .filter((l) => !l.cls.split(" ").includes("money"))
    .slice(0, 8);
  if (!lines.length && !MoneyEventRows({ sinceT: w.t - w.cfg.time.gameMinutesPerDay })) return null;
  return (
    <Card class="todaycard" title={TRUCK.today}>
      {money}
      {lines.map((l, i) => (
        <p key={i} class={cls("small", l.cls)}>
          {l.text}
        </p>
      ))}
    </Card>
  );
}

/** Live orders on their way, with when each takes effect. */
export function PendingCard(): JSX.Element | null {
  const g = S.game;
  if (g?.kind !== "live") return null;
  const p = g.pending();
  if (!p.length) return null;
  return (
    <Card title="Orders on the way">
      {p.map((r) => (
        <p key={r.s}>
          {describe(r.a)} · <span class="muted">at {hhmm(r.at)}, in {realUntil(g.msUntil(r.at))}</span>
        </p>
      ))}
    </Card>
  );
}

function TiredAlerts(): JSX.Element {
  const w = S.game!.w;
  const f = GAME_CONFIG.fatigue;
  return (
    <>
      {tiredTrucks().map((t) => {
        const d = w.staff[t.driverId - 1]!;
        return (
          <Card key={t.id} alert need={`tired:${t.id}`} title={`${d.owner ? "You have" : `${d.name} has`} been out ${plural(d.awayDays, "day")}${d.fatigue >= f.tiredAt ? ` and ${d.owner ? "are" : "is"} tired (${pct(d.fatigue)})` : ""}`}>
            <p>
              {TRUCK.tired} {f.resetDays} days off at home reset it; every day sitting idle away from home costs {GAME_CONFIG.labor.driver.perDiemFd} FD per diem.
            </p>
            {d.wantsHome ? (
              <p class="muted">{homeTimeLine(w, ownerOf(t), t)}</p>
            ) : t.status === "idle" || w.cfg.labor.sendHomeWhileMoving ? (
              <div class="row">
                <SendHomeActions t={t} primary />
              </div>
            ) : (
              <p class="muted">{homeRuleLine(ownerOf(t), d)}</p>
            )}
          </Card>
        );
      })}
    </>
  );
}

/**
 * PLACEHOLDER copy (QA item 8): engineering's facts, for the writer to word as TRUCK.homeRuleSoon, TRUCK.homeRuleOn and
 * TRUCK.homeRuleNone in copy.ts, which then replace these. The home-time rule doesn't bring a driver home at n days: from
 * then the truck takes only loads that head home, and runs home empty once it's near or none come (standingOrders.ts
 * needsHome, board.ts maybeReposition).
 */
const HOME_RULE = {
  soon: (days: number) => `Send it home when it's next idle. At ${days} days out the home-time rule turns it for home: homeward loads only, then empty once it's close or none come.`,
  on: (days: number) => `It's past the home-time rule's ${days} days, so it's working its way home: homeward loads only, then empty once it's close or none come.`,
  none: "No home-time rule is set: send it home when it's next idle.",
};

/** What the home-time rule does for a driver out on a moving truck (QA item 8: the card promised it brought them home at n days). */
function homeRuleLine(c: Company, d: Staff): string {
  const hm = c.orders.find((o): o is Extract<StandingOrder, { kind: "homeTime" }> => o.kind === "homeTime");
  if (!hm) return HOME_RULE.none;
  return d.awayDays >= hm.afterDays ? HOME_RULE.on(hm.afterDays) : HOME_RULE.soon(hm.afterDays);
}

function IdleAlerts(): JSX.Element {
  const w = S.game!.w;
  return (
    <>
      {/* R22: a truck at a wall, from the moment it's idle: the one reason, and its ways out. */}
      {wallTrucks().map((t) => (
        <Card key={`wall-${t.id}`} alert need={`wall:${t.id}`} title={wallLine(t)}>
          {/* The ways out first, labelled, cheapest first (the director, 2026-11-09); the board after them. */}
          <WaysOutRows t={t} label />
          <div class="row">
            <Btn onClick={() => waysOut(t)}>{PENDING.waysOutBoard}</Btn>
          </div>
        </Card>
      ))}
      {stuckTrucks().map((t) => {
        const d = idleWhy(t);
        return (
          <Card key={t.id} alert need={`idle:${t.id}`} title={`${truckName(t)} has been idle ${idleLabel(t)} at ${truckWhere(t)}`}>
            <p>
              {d.why} It has sat out {plural(t.idleRounds, "bidding round")}
              {t.lease === "owned" ? ` and pays ${w.cfg.costs.idleFeePerDay} FD a day idle after ${w.cfg.costs.idleFeeAfterDays}` : ""}.
            </p>
            {d.fixes.length ? <div class="row">{d.fixes}</div> : null}
          </Card>
        );
      })}
    </>
  );
}

/**
 * R12's clocks on a truck on the road (the trucker: fuel stops, breaks and the 70-hour week happened unseen): today's
 * driving against the day's hours and the week's against the cycle, then what it's doing now: resting until its hours
 * return, on a break or at a fuel stop with the minutes left, or the miles to the next fuel stop. All from the engine's
 * own fields (trips.ts); nothing shows for a clock whose key is off.
 */
function HoursLines({ t }: { t: Truck }): JSX.Element | null {
  const w = S.game!.w;
  const k = w.cfg;
  if (t.status === "idle" || t.status === "parked" || t.status === "listed" || t.status === "retired" || !crewed(t)) return null;
  const h = (min: number) => (Math.round((min / 60) * 10) / 10).toFixed(1);
  const day = HOURS.day(h(t.shiftDrivenMin), k.hos.drivingHoursPerDay);
  const week = k.hos.cycleHours > 0 && t.cycleMin !== undefined ? ` · ${HOURS.week(h(t.cycleMin), k.hos.cycleHours)}` : "";
  // Off duty for the night: the day's hours spent, or parked at a rest site, until the hours come back (trips.ts dutyResetAt).
  const resetAt = dutyResetAt(w, t);
  const reset = resetAt !== null && resetAt > w.t && (t.restSite ? true : t.shiftDrivenMin >= k.hos.drivingHoursPerDay * 60 - 1e-6) ? resetAt : null;
  const pause = t.pauseMin ?? 0;
  const now =
    reset !== null
      ? HOURS.resting(hhmm(reset))
      : pause > 0.5
        ? k.fuel.stopEveryMi > 0 && (t.fuelMi ?? 0) < 1 && pause <= k.fuel.stopMinutes + 1e-6
          ? HOURS.fueling(Math.ceil(pause))
          : HOURS.onBreak(k.hos.breakMinutes, Math.ceil(pause))
        : k.fuel.stopEveryMi > 0
          ? HOURS.fuelIn(Math.max(0, Math.round((k.fuel.stopEveryMi - (t.fuelMi ?? 0)) / 10) * 10))
          : null;
  return (
    <p class="muted small">
      {day}
      {week}
      {now ? (
        <>
          <br />
          {now}
        </>
      ) : null}
    </p>
  );
}

function TruckCard({ t, idx }: { t: Truck; idx: number }): JSX.Element {
  const w = S.game!.w;
  // Client batch 8a item 29: the truck's own company, whichever company is in view.
  const c = ownerOf(t);
  const leased = t.lease !== "owned";
  // Assets: a tractor leased from another carrier runs here, but its owner sells, rebuilds and parks it.
  const leasedIn = t.lessorId !== 0 && t.lessorId !== c.id;
  const mine = t.lease === "owned" && !leasedIn;
  const cond = condition(w.cfg, t);
  const share = pct(w.cfg.costs.npcLeaseShareOfGross);
  const kind = t.lease === "npc" ? TRUCK.leased(share) : t.lease === "lessor" ? TRUCK.secondLease(share, fdFull(leaseMinFor(w, t))) : leasedIn ? `Leased from another carrier` : (
        // Client batch 8b item 18 (the director): book value, named, and what trucks like it really sell for.
        <>
          <Fig k="truck.value" label={PENDING.bookValueLabel} ctx={{ truckId: t.id }}>{PENDING.ownedBook(fdFull(truckValue(w, t)))}</Fig>
          <span class="muted small"> {sellsFor(truckValue(w, t))}</span>
        </>
      );
  const nearby = w.net.hubs
    .map((h, i) => ({ h, i, mi: hubMiles(w, t.hub, i) }))
    .filter((x) => x.i !== t.hub)
    .sort((a, b) => a.mi - b.mi)
    .slice(0, 14);
  const stop = (ev: MouseEvent) => ev.stopPropagation();
  // Everything past the two main actions: inline on a laptop, under ⋯ on a phone.
  const more = (
    <>
          {/* Home time is the drivers' days off: no move is offered until they're over (QA item 8: Send to did nothing). */}
          {/* labor.turnWhileEmpty: Send to also turns a truck running empty, from where it is. */}
          {(t.status === "idle" && !resting(w, t)) || (t.status === "repositioning" && w.cfg.labor.turnWhileEmpty) ? <SendEmpty t={t} nearby={nearby} /> : null}
          {mine && t.status === "idle" && cond <= w.cfg.wear.rebuildMaxCondition && rebuildable(w.cfg, t) ? (
            <Btn onClick={(ev) => confirmAct({ verb: "Rebuild", item: `truck ${idx + 1}`, costFd: rebuildCost(w.cfg, t), ...rebuildLines(w, t), run: () => act({ type: "rebuild_truck", truckId: t.id }, "Truck is in the shop for two days", "truck:rebuild") }, ev)}>Rebuild · {fd(rebuildCost(w.cfg, t))} FD</Btn>
          ) : null}
          {mine && t.status === "idle" ? <Btn onClick={() => act({ type: "park_truck", truckId: t.id }, "Truck parked", "truck:park")}>Park</Btn> : null}
          {t.status === "parked" ? <Btn onClick={() => act({ type: "unpark_truck", truckId: t.id }, "Truck back on the road")}>Back on the road</Btn> : null}
          {mine && (t.status === "idle" || t.status === "parked") && myTrucks().length > 1 ? (
            <Btn
              onClick={(ev) => {
                const value = truckValue(w, t);
                confirmAct({ verb: "Sell", item: `truck ${truckNo(t.id)}`, costFd: null, costLine: "", ...sellLines(w, t, truckNo(t.id), value), go: `Sell · ${fdFull(value)} FD`, run: () => {
                    // The crew it had, for off sale to seat back (QA fail 3).
                    S.listedCrew.set(t.id, [t.driverId, t.coDriverId].filter((id) => id > 0));
                    act({ type: "list_truck", truckId: t.id, askFd: value, floorFd: value * 0.6, stepFd: value * 0.05 }, `Listed at ${fd(value)} FD; the price drops 5% a week until it sells`);
                  } }, ev);
              }}
            >
              Sell
            </Btn>
          ) : null}
          {t.lease === "lessor" && t.status === "idle" ? <Btn onClick={() => act({ type: "return_lease", truckId: t.id }, "Lease returned")}>Return lease</Btn> : null}
          {/* Client batch 8a item 6: a listed truck can come off sale (engine withdraw_listing). */}
          {(() => {
            const sale = mine ? w.listings.find((x) => x.status === "open" && x.truckId === t.id && x.sellerId === t.companyId) : undefined;
            return sale ? (
              <>
                <span class="small">{PENDING.forSaleAt(fd(sale.askFd))}</span>
                <Btn onClick={() => offSale(w, t, sale.id)}>{PENDING.takeOffSale}</Btn>
              </>
            ) : null;
          })()}
          <TruckAssetActions t={t} />
          {t.defects > 0 && (t.status === "idle" || t.status === "parked") ? (
            <Btn onClick={() => act({ type: "fix_defects", truckId: t.id }, "Defects fixed")}>
              Fix {plural(t.defects, "defect")} · {fd(t.defects * w.cfg.safety.maintenance.fixFdPerDefect)} FD
            </Btn>
          ) : null}
  </>
  );
  return (
    <Card
      sel={t.id === S.selTruck}
      need={`truck:${t.id}`}
      onClick={() => {
        selectTruck(t.id);
        focusTruck(t);
      }}
    >
      <div class="truckhead">
        <Rig eq={t.trailer} alt={`${TIER_NAME[t.tier]} with ${TRAILER_NAME[t.trailer]}`} />
        <div>
          <h3>
            Truck {idx + 1} · {TIER_NAME[t.tier]} · {TRAILER_NAME[t.trailer]}
          </h3>
          <p class="muted">{kind}</p>
        </div>
      </div>
      <p>
        <StatusLine t={t} />
        {t.breakdownMin > 0 && t.status !== "loaded" ? <span class="bad"> · stopped</span> : null}
      </p>
      <HoursLines t={t} />
      <p>
        <CrewLine t={t} />
      </p>
      <div class="row">
        <span class="label">Condition</span>
        <Bar share={cond} tone={cond > 0.6 ? "var(--accent-success)" : cond > 0.35 ? "var(--accent-warn)" : "var(--accent-danger)"} />
        <Num>{pct(cond)}</Num>
        <span class="label">Odometer</span>
        <Num>{Math.round(t.odometer).toLocaleString("en-US")} mi</Num>
      </div>
      <TrailerLines t={t} />
      {/* R6: on a phone the row keeps at most its two main actions; the rest, scrap last, go under ⋯ (player2-ux.md section 1). */}
      <div class="row" onClick={stop}>
        {t.status === "idle" ? <Btn onClick={() => goLoads(t.id)}>{TRUCK.bidByHand}</Btn> : null}
        {!crewed(t) ? (
          <>
            <span class="bad small">{TRUCK.noDriver(idx + 1)}</span>
            <Btn primary onClick={goStaff}>
              {TRUCK.hireDriver}
            </Btn>
          </>
        ) : null}
        {/* Send home on any truck, whenever the player asks (the director, 2026-11-09); the tired card has its own. */}
        {tiredTrucks().includes(t) ? null : <SendHomeActions t={t} />}
        {isPhone() ? (t.status === "idle" || t.status === "parked" || t.defects > 0 || (t.status === "repositioning" && w.cfg.labor.turnWhileEmpty) ? (
          <details class="overflow">
            <summary aria-label="More actions">⋯</summary>
            <div class="row">{more}</div>
          </details>
        ) : null) : (
          more
        )}
      </div>
    </Card>
  );
}

void truckNo;
