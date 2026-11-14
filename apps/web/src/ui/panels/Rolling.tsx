import { Stamp } from "../Stamp.js";
import { MENUS } from "../../copy-menus.js";
import type { JSX } from "preact";
import type { Truck } from "@lanes/engine";
import { DELIVERED, ROLLING } from "../../copy.js";
import { PENDING } from "../../copy-pending.js";
import { cls, fdFull, hhmm, pct, shortDate } from "../../format.js";
import { GAME_CONFIG } from "../../game.js";
import { etaMin, nearestPlace, nightStop } from "../../rolling.js";
import { bumpData, me, myTrucks, ownerOf, S, truckNo, useData } from "../../state.js";
import { Bar, Btn, Card, Kv } from "../bits.js";
import { Fig } from "../Explain.js";
import { StepMoment } from "../Walkthrough.js";
import { onTimeBy, settlementShare } from "@lanes/engine";

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
  // Client batch 8a item 29: the truck's own company, whichever company is in view.
  const c = ownerOf(t);
  const l = w.loads.get(t.loadId!);
  if (!l) return null;
  const place = (i: number) => w.net.places[i]!.name;
  const eta = etaMin(w, t, c);
  // windows.oneDeadline (the director's ruling 1): late by the "Deliver by" the engine marks it on (onTimeBy).
  const lateH = Math.ceil((eta - onTimeBy(w, l)) / 60);
  const done = t.legMiles > 0 ? 1 - t.remainingMi / t.legMiles : 0;
  const stop = nightStop(w, t, c);
  return (
    <Card class="rolling" title={`Truck ${truckNo(t.id)}`}>
      <p>{ROLLING.lane(place(l.originPlace), place(l.destPlace), Math.round(l.miles).toLocaleString("en-US"))}</p>
      <Bar share={done} />
      <div class="row">
        <Fig k="truck.eta" label={ROLLING.eta("")} ctx={{ truckId: t.id, loadId: l.id }}>{ROLLING.eta(when(eta))}</Fig>
        <span class={cls("chip", lateH > 0 ? "bad" : "good")}>{lateH > 0 ? ROLLING.late(lateH) : ROLLING.onTime}</span>
      </div>
      {/* The shoulder names its ticket ahead (the diaries: a 250 FD ticket nobody was told of); the choice of a stop is the engine's (the batch's report). */}
      {stop ? <p class="muted small">{stop.kind === "site" ? ROLLING.tonightSite(w.sites[stop.siteId - 1]!.businessId !== 0, nearestPlace(w, stop.lat, stop.lon)) : stop.kind === "town" ? PENDING.tonightTown(place(stop.place)) : stop.kind === "townNear" ? PENDING.tonightTownNear(stop.maxMi) : S.handLoads.has(l.id) ? PENDING.shoulderAhead(fdFull(w.cfg.businesses.parking.shoulderFineFd)) : ROLLING.tonightDispatcher}</p> : null}
    </Card>
  );
}

/** The last delivery's pay line (S7), on the Truck tab until OK. */
export function DeliveredCard(): JSX.Element | null {
  useData();
  const d = S.delivered;
  if (!d) return null;
  const minus = (x: number) => `−${fdFull(x)}`;
  // Each pay row explains itself (explain.ts); the lessor's share from what the load paid.
  const f = (k: string, label: string, v: string, fdIn?: number): [string, JSX.Element] => [label, <Fig k={k} label={label} ctx={{ fd: fdIn }}>{v}</Fig>];
  const det = d.line.detentionAt;
  const rows: [string, string | JSX.Element][] = [
    [DELIVERED.load, fdFull(d.line.load)],
    ...(d.line.detention >= 0.5 ? ([[DELIVERED.detention(det.pickupH + det.deliveryH, det.pickupH && det.deliveryH ? "both" : det.pickupH ? "pickup" : "receiver"), `+${fdFull(d.line.detention)}`]] as [string, string][]) : []),
    f("pay.fuel", DELIVERED.fuel, minus(d.line.fuel)),
    f("pay.tolls", DELIVERED.tolls, minus(d.line.tolls)),
    ...(d.line.driver >= 0.5 ? [d.hiredDriver ? ([DELIVERED.driverHired(d.hiredDriver), minus(d.line.driver)] as [string, string]) : f("pay.ownerDraw", DELIVERED.driverOwner, minus(d.line.driver))] : []),
    ...(d.line.upkeep >= 0.5 ? [f("pay.maintenance", DELIVERED.upkeep, minus(d.line.upkeep))] : []),
    ...(d.line.lessor >= 0.5 ? [f("pay.lessorShare", DELIVERED.lessor(pct(GAME_CONFIG.costs.npcLeaseShareOfGross)), minus(d.line.lessor), d.line.load)] : []),
    ...(d.line.settlement >= 0.5 ? [f("pay.settlement", DELIVERED.settlement(pct(settlementShare(GAME_CONFIG))), minus(d.line.settlement), d.line.load)] : []),
    ...(d.line.held >= 0.5 ? [f("truck.leaseDeposit", DELIVERED.held, minus(d.line.held))] : []),
  ];
  return (
    <Card
      class="delivered"
      title={DELIVERED.title(d.from, d.to)}
      right={
        <>
          {/* The menu system §2.4: PAID, in the head beside the chip, where it covers no word (batch M1). */}
          <Stamp word={MENUS.stampPaid} id={`paid:${d.from}:${d.to}:${Math.round(d.line.yours)}`} size={40} inline />
          <span class={cls("chip", d.lateH > 0 ? "bad" : "good")}>{d.lateH > 0 ? ROLLING.late(d.lateH) : ROLLING.onTime}</span>
        </>
      }
    >
      <Kv rows={rows} />
      <p class="payyours">
        <b>
          {DELIVERED.yours} {fdFull(d.line.yours)} FD{d.line.draw >= 0.5 ? <span class="muted small"> · {DELIVERED.drawNote(fdFull(d.line.draw))}</span> : null}
        </b>
      </p>
      <p class="muted small">{d.paid}</p>
      {/* R5: "Getting paid" plays on the first settlement card. */}
      <StepMoment only="paid" />
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
