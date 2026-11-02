import type { JSX } from "preact";
import type { Truck } from "@lanes/engine";
import { DELIVERED, ROLLING } from "../../copy.js";
import { cls, fdFull, hhmm, pct, shortDate } from "../../format.js";
import { GAME_CONFIG } from "../../game.js";
import { etaMin, nearestPlace, nightStop } from "../../rolling.js";
import { bumpData, me, myTrucks, S, truckNo, useData } from "../../state.js";
import { Bar, Btn, Card, Kv } from "../bits.js";

const when = (min: number): string => `${shortDate(Math.floor(min / 1440))} ${hhmm(min)}`;

/** The truck rolling (S6): its lane, a progress bar, the ETA with an on-time chip, and tonight's planned stop. */
export function RollingCards(): JSX.Element | null {
  useData();
  const moving = myTrucks().filter((t) => t.status === "loaded" && t.loadId !== null);
  if (!moving.length) return null;
  return (
    <>
      {moving.map((t) => (
        <RollingCard key={t.id} t={t} />
      ))}
    </>
  );
}

function RollingCard({ t }: { t: Truck }): JSX.Element | null {
  const w = S.game!.w;
  const c = me();
  const l = w.loads.get(t.loadId!);
  if (!l) return null;
  const place = (i: number) => w.net.places[i]!.name;
  const eta = etaMin(w, t, c);
  const lateH = Math.ceil((eta - l.dueT) / 60);
  const done = t.legMiles > 0 ? 1 - t.remainingMi / t.legMiles : 0;
  const stop = nightStop(w, t, c);
  return (
    <Card class="rolling" title={`Truck ${truckNo(t.id)}`}>
      <p>{ROLLING.lane(place(l.originPlace), place(l.destPlace), Math.round(l.miles).toLocaleString("en-US"))}</p>
      <Bar share={done} />
      <div class="row">
        <span>{ROLLING.eta(when(eta))}</span>
        <span class={cls("chip", lateH > 0 ? "bad" : "good")}>{lateH > 0 ? ROLLING.late(lateH) : ROLLING.onTime}</span>
      </div>
      {stop ? <p class="muted small">{stop.kind === "site" ? ROLLING.tonightSite(w.sites[stop.siteId - 1]!.businessId !== 0, nearestPlace(w, stop.lat, stop.lon)) : S.handLoads.has(l.id) ? ROLLING.tonightShoulder : ROLLING.tonightDispatcher}</p> : null}
    </Card>
  );
}

/** The last delivery's pay line (S7), on the Truck tab until OK. */
export function DeliveredCard(): JSX.Element | null {
  useData();
  const d = S.delivered;
  if (!d) return null;
  const minus = (x: number) => `−${fdFull(x)}`;
  const rows: [string, string][] = [
    [DELIVERED.load, fdFull(d.line.load)],
    [DELIVERED.fuel, minus(d.line.fuel)],
    [DELIVERED.tolls, minus(d.line.tolls)],
    ...(d.line.driver >= 0.5 ? ([[d.hiredDriver ? DELIVERED.driverHired(d.hiredDriver) : DELIVERED.driverOwner, minus(d.line.driver)]] as [string, string][]) : []),
    ...(d.line.upkeep >= 0.5 ? ([[DELIVERED.upkeep, minus(d.line.upkeep)]] as [string, string][]) : []),
    ...(d.line.lessor >= 0.5 ? ([[DELIVERED.lessor(pct(GAME_CONFIG.costs.npcLeaseShareOfGross)), minus(d.line.lessor)]] as [string, string][]) : []),
    ...(d.line.held >= 0.5 ? ([[DELIVERED.held, minus(d.line.held)]] as [string, string][]) : []),
  ];
  return (
    <Card class="delivered" title={DELIVERED.title(d.from, d.to)} right={<span class={cls("chip", d.lateH > 0 ? "bad" : "good")}>{d.lateH > 0 ? ROLLING.late(d.lateH) : ROLLING.onTime}</span>}>
      <Kv rows={rows} />
      <p class="payyours">
        <b>
          {DELIVERED.yours} {fdFull(d.line.yours)} FD
        </b>
      </p>
      <p class="muted small">
        {DELIVERED.paid} {d.dueDay !== null ? shortDate(d.dueDay) : DELIVERED.today}
      </p>
      <div class="row">
        <Btn
          primary
          onClick={() => {
            S.delivered = null;
            bumpData();
          }}
        >
          {DELIVERED.ok}
        </Btn>
      </div>
    </Card>
  );
}
