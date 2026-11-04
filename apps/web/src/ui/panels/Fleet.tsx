import type { JSX } from "preact";
import { condition, crewed, dutyResetAt, hubMiles, ordersOf, rebuildable, rebuildCost, resting, truckValue, type Truck } from "@lanes/engine";
import { SCENES } from "../../assets.js";
import { cls, dateLabel, fd, fdFull, pct, plural, TIER_NAME, TRAILER_NAME, hhmm, realUntil } from "../../format.js";
import { HOURS, MOVE, TRUCK } from "../../copy.js";
import { GAME_CONFIG } from "../../game.js";
import { AttentionCard, CrewLine, goLoads, goStaff, idleLabel, idleWhy, openLoadsAt, StatusLine, stuckTrucks, tiredTrucks, truckName } from "../../logic.js";
import { focusTruck } from "../../mapview.js";
import { act, describe, feed, isPhone, me, myTrucks, S, selectTruck, truckNo, useData } from "../../state.js";
import { Bar, Btn, Card, Num, Panel, Pixel } from "../bits.js";
import { Rig, Scene } from "../Loop.js";
import { Fig } from "../Explain.js";
import { TendersCard } from "./Contracts.js";
import { DispatcherCard } from "./Dispatcher.js";
import { DeliveredCard, RollingCards } from "./Rolling.js";
import { emptyRun } from "../../rolling.js";
import { TrailerLines, TruckAssetActions, YardCard } from "./Yard.js";
import { confirmAct } from "../Confirm.js";
import { rebuild as rebuildLines, sell as sellLines } from "../../confirmspecs.js";
import { CapsLine } from "../Caps.js";
import { leaseMinFor } from "../../ledger.js";



/** Send home's price before the tap (R24). */
function homeRun(t: Truck): string {
  const r = emptyRun(S.game!.w, t, t.hub, me().homeHub);
  return MOVE.home(r.mi, r.fd, r.time);
}
/** A send-empty destination with its price (R24). */
function emptyLine(t: Truck, hub: number): string {
  const w = S.game!.w;
  const r = emptyRun(w, t, t.hub, hub);
  return MOVE.empty(w.net.hubs[hub]!.name, r.mi, r.fd, r.time);
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
      <TodayCard />
      <Scene name="yard" still={SCENES.yard} alt="Your yard at dusk" />
      <AttentionCard />
      <TendersCard c={me()} />
      <TiredAlerts />
      <IdleAlerts />
      <PendingCard />
      {pending.length ? <p class="muted">On order: {pending.map((o) => `${o.kind === "trailer" ? `${TRAILER_NAME[o.trailer]} trailer` : o.kind === "tractor" ? `${TIER_NAME[o.tier]} tractor` : `${TIER_NAME[o.tier]} + ${TRAILER_NAME[o.trailer]}`}, arrives ${dateLabel(o.dueDay)}`).join("; ")}</p> : null}
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
  const lines = feed().ticker.slice(0, 8);
  if (!lines.length) return null;
  return (
    <Card title={TRUCK.today}>
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
              <p class="muted">Heading home for days off.</p>
            ) : t.status === "idle" ? (
              <div class="row">
                <Btn primary onClick={() => act({ type: "send_home", truckId: t.id }, "Heading home for days off", "truck:sendHome")}>
                  {homeRun(t)}
                </Btn>
              </div>
            ) : (
              <p class="muted">Send it home when it's next idle, or let the dispatcher's home-time rule do it.</p>
            )}
          </Card>
        );
      })}
    </>
  );
}

function IdleAlerts(): JSX.Element {
  const w = S.game!.w;
  return (
    <>
      {stuckTrucks().map((t) => {
        const d = idleWhy(t);
        return (
          <Card key={t.id} alert need={`idle:${t.id}`} title={`${truckName(t)} has been idle ${idleLabel(t)} at ${w.net.hubs[t.hub]!.name}`}>
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
  const c = me();
  const leased = t.lease !== "owned";
  // Assets: a tractor leased from another carrier runs here, but its owner sells, rebuilds and parks it.
  const leasedIn = t.lessorId !== 0 && t.lessorId !== c.id;
  const mine = t.lease === "owned" && !leasedIn;
  const cond = condition(w.cfg, t);
  const share = pct(w.cfg.costs.npcLeaseShareOfGross);
  const kind = t.lease === "npc" ? TRUCK.leased(share) : t.lease === "lessor" ? TRUCK.secondLease(share, fdFull(leaseMinFor(w, t))) : leasedIn ? `Leased from another carrier` : <Fig k="truck.value" label="Worth" ctx={{ truckId: t.id }}>{TRUCK.owned(fdFull(truckValue(w, t)))}</Fig>;
  const nearby = w.net.hubs
    .map((h, i) => ({ h, i, mi: hubMiles(w, t.hub, i) }))
    .filter((x) => x.i !== t.hub)
    .sort((a, b) => a.mi - b.mi)
    .slice(0, 14);
  const stop = (ev: MouseEvent) => ev.stopPropagation();
  // Everything past the two main actions: inline on a laptop, under ⋯ on a phone.
  const more = (
    <>
          {t.status === "idle" ? (
            <>
              <select id={`send-${t.id}`} aria-label="Destination hub">
                {nearby.map((x) => (
                  <option value={x.h.id} key={x.h.id}>
                    {emptyLine(t, x.i)} · {openLoadsAt(x.i).filter((l) => l.equipment === t.trailer).length} loads
                  </option>
                ))}
              </select>
              <Btn
                onClick={() => {
                  const hubId = (document.getElementById(`send-${t.id}`) as HTMLSelectElement).value;
                  act({ type: "reposition_truck", truckId: t.id, hubId }, TRUCK.sentEmpty, "truck:sendEmpty");
                }}
              >
                Send empty
              </Btn>
            </>
          ) : null}
          {mine && t.status === "idle" && cond <= w.cfg.wear.rebuildMaxCondition && rebuildable(w.cfg, t) ? (
            <Btn onClick={(ev) => confirmAct({ verb: "Rebuild", item: `truck ${idx + 1}`, costFd: rebuildCost(w.cfg, t), ...rebuildLines(w, t), run: () => act({ type: "rebuild_truck", truckId: t.id }, "Truck is in the shop for two days", "truck:rebuild") }, ev)}>Rebuild · {fd(rebuildCost(w.cfg, t))} FD</Btn>
          ) : null}
          {mine && t.status === "idle" ? <Btn onClick={() => act({ type: "park_truck", truckId: t.id }, "Truck parked", "truck:park")}>Park</Btn> : null}
          {t.status === "parked" ? <Btn onClick={() => act({ type: "unpark_truck", truckId: t.id }, "Truck back on the road")}>Back on the road</Btn> : null}
          {mine && (t.status === "idle" || t.status === "parked") && myTrucks().length > 1 ? (
            <Btn
              onClick={(ev) => {
                const value = truckValue(w, t);
                confirmAct({ verb: "Sell", item: `truck ${idx + 1}`, costFd: null, costLine: "", ...sellLines(idx + 1, value), go: `Sell · ${fdFull(value)} FD`, run: () => act({ type: "list_truck", truckId: t.id, askFd: value, floorFd: value * 0.6, stepFd: value * 0.05 }, `Listed at ${fd(value)} FD; the price drops 5% a week until it sells`) }, ev);
              }}
            >
              Sell
            </Btn>
          ) : null}
          {t.lease === "lessor" && t.status === "idle" ? <Btn onClick={() => act({ type: "return_lease", truckId: t.id }, "Lease returned")}>Return lease</Btn> : null}
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
        {t.status === "idle" && crewed(t) && !resting(w, t) && hubMiles(w, c.homeHub, t.hub) > w.cfg.map.nearbyRadiusMi ? (
          <Btn onClick={() => act({ type: "send_home", truckId: t.id }, "Heading home for days off", "truck:sendHome")}>{homeRun(t)}</Btn>
        ) : null}
        {isPhone() ? (t.status === "idle" || t.status === "parked" || t.defects > 0 ? (
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
