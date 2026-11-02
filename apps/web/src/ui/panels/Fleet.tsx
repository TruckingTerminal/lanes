import type { JSX } from "preact";
import { condition, crewed, hubMiles, ordersOf, rebuildable, rebuildCost, resting, truckValue, type Truck } from "@lanes/engine";
import { SCENES } from "../../assets.js";
import { cls, dateLabel, fd, fdFull, pct, plural, TIER_NAME, TRAILER_NAME, hhmm, realUntil } from "../../format.js";
import { TRUCK } from "../../copy.js";
import { GAME_CONFIG } from "../../game.js";
import { AttentionCard, CrewLine, goLoads, goStaff, idleLabel, idleWhy, openLoadsAt, StatusLine, stuckTrucks, tiredTrucks, truckName } from "../../logic.js";
import { focusTruck } from "../../mapview.js";
import { act, describe, feed, me, myTrucks, S, selectTruck, truckNo, useData } from "../../state.js";
import { Bar, Btn, Card, Num, Panel, Pixel } from "../bits.js";
import { Rig, Scene } from "../Loop.js";
import { TendersCard } from "./Contracts.js";
import { DispatcherCard } from "./Dispatcher.js";
import { DeliveredCard, RollingCards } from "./Rolling.js";
import { TrailerLines, TruckAssetActions, YardCard } from "./Yard.js";


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
        const home = hubMiles(w, me().homeHub, t.hub);
        return (
          <Card key={t.id} alert need={`tired:${t.id}`} title={`${d.owner ? "You have" : `${d.name} has`} been out ${plural(d.awayDays, "day")}${d.fatigue >= f.tiredAt ? ` and ${d.owner ? "are" : "is"} tired (${pct(d.fatigue)})` : ""}`}>
            <p>
              {TRUCK.tired} {f.resetDays} days off at home reset it; every day sitting idle away from home costs {GAME_CONFIG.labor.driver.perDiemFd} FD per diem.
            </p>
            {d.wantsHome ? (
              <p class="muted">Heading home for days off.</p>
            ) : t.status === "idle" ? (
              <div class="row">
                <Btn primary onClick={() => act({ type: "send_home", truckId: t.id }, "Heading home for days off")}>
                  {TRUCK.sendHome(home)}
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

function TruckCard({ t, idx }: { t: Truck; idx: number }): JSX.Element {
  const w = S.game!.w;
  const c = me();
  const leased = t.lease !== "owned";
  // Assets: a tractor leased from another carrier runs here, but its owner sells, rebuilds and parks it.
  const leasedIn = t.lessorId !== 0 && t.lessorId !== c.id;
  const mine = t.lease === "owned" && !leasedIn;
  const cond = condition(w.cfg, t);
  const share = pct(w.cfg.costs.npcLeaseShareOfGross);
  const kind = t.lease === "npc" ? TRUCK.leased(share) : t.lease === "lessor" ? TRUCK.secondLease(share, fdFull(w.cfg.freeEntry.leases.minWeeklyFd)) : leasedIn ? `Leased from another carrier` : TRUCK.owned(fdFull(truckValue(w, t)));
  const nearby = w.net.hubs
    .map((h, i) => ({ h, i, mi: hubMiles(w, t.hub, i) }))
    .filter((x) => x.i !== t.hub)
    .sort((a, b) => a.mi - b.mi)
    .slice(0, 14);
  const stop = (ev: MouseEvent) => ev.stopPropagation();
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
      <div class="row" onClick={stop}>
        {t.status === "idle" ? (
          <>
            <Btn onClick={() => goLoads(t.id)}>{TRUCK.bidByHand}</Btn>
            <select id={`send-${t.id}`} aria-label="Destination hub">
              {nearby.map((x) => (
                <option value={x.h.id} key={x.h.id}>
                  {x.h.name} · {x.mi} mi · {openLoadsAt(x.i).filter((l) => l.equipment === t.trailer).length} loads
                </option>
              ))}
            </select>
            <Btn
              onClick={() => {
                const hubId = (document.getElementById(`send-${t.id}`) as HTMLSelectElement).value;
                act({ type: "reposition_truck", truckId: t.id, hubId }, TRUCK.sentEmpty);
              }}
            >
              Send empty
            </Btn>
          </>
        ) : null}
        {mine && t.status === "idle" && cond <= w.cfg.wear.rebuildMaxCondition && rebuildable(w.cfg, t) ? (
          <Btn onClick={() => act({ type: "rebuild_truck", truckId: t.id }, "Truck is in the shop for two days")}>Rebuild · {fd(rebuildCost(w.cfg, t))} FD</Btn>
        ) : null}
        {mine && t.status === "idle" ? <Btn onClick={() => act({ type: "park_truck", truckId: t.id }, "Truck parked")}>Park</Btn> : null}
        {t.status === "parked" ? <Btn onClick={() => act({ type: "unpark_truck", truckId: t.id }, "Truck back on the road")}>Back on the road</Btn> : null}
        {mine && (t.status === "idle" || t.status === "parked") && myTrucks().length > 1 ? (
          <Btn
            onClick={() => {
              const value = truckValue(w, t);
              act({ type: "list_truck", truckId: t.id, askFd: value, floorFd: value * 0.6, stepFd: value * 0.05 }, `Listed at ${fd(value)} FD; the price drops 5% a week until it sells`);
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
        {!crewed(t) ? (
          <>
            <span class="bad small">{TRUCK.noDriver(idx + 1)}</span>
            <Btn primary onClick={goStaff}>
              {TRUCK.hireDriver}
            </Btn>
          </>
        ) : null}
        {t.status === "idle" && crewed(t) && !resting(w, t) && hubMiles(w, c.homeHub, t.hub) > w.cfg.map.nearbyRadiusMi ? (
          <Btn onClick={() => act({ type: "send_home", truckId: t.id }, "Heading home for days off")}>{TRUCK.sendHome(hubMiles(w, c.homeHub, t.hub))}</Btn>
        ) : null}
      </div>
    </Card>
  );
}

void truckNo;
