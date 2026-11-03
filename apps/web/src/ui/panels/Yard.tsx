import type { JSX } from "preact";
import { useState } from "preact/hooks";
import type { Equipment } from "@lanes/config";
import {
  dealershipsOpen,
  hookedTrailer,
  ownedTrailers,
  rebuildable,
  tractorLifeUsed,
  tractorScrapFd,
  tradeInOffer,
  trailerCap,
  trailerCondition,
  trailerRefurbishable,
  trailerScrapFd,
  trailersOf,
  trailerValue,
  truckValue,
  yardTrailers,
  yardTrucks,
  type Truck,
} from "@lanes/engine";
import { dateLabel, fd, pct, TRAILER_NAME, fdFull } from "../../format.js";
import { act, me, myTrucks, S, setTab, truckNo, useData } from "../../state.js";
import { Btn, Card, Kv, Num } from "../bits.js";
import { confirmAct } from "../Confirm.js";
import { scrap as scrapLines } from "../../confirmspecs.js";
import { CONFIRM } from "../../copy.js";

const TYPES: Equipment[] = ["van", "reefer", "flatbed"];
const name = (e: Equipment) => TRAILER_NAME[e].toLowerCase();
const num = (id: string): number => Number((document.getElementById(id) as HTMLInputElement | null)?.value);

/** Assets: what a truck pulls, the tractor's life left, and a lease it runs under. */
export function TrailerLines({ t }: { t: Truck }): JSX.Element | null {
  const w = S.game!.w;
  const a = w.cfg.assets;
  if (!a.enabled) return null;
  const tr = hookedTrailer(w, t);
  const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  const lessor = t.lessorId && t.lessorId !== t.companyId ? w.companies[t.lessorId - 1] : null;
  const trailer = !tr
    ? "none"
    : tr.lease === "owned"
      ? `your ${name(tr.type)} · ${pct(trailerCondition(w, tr))} condition · ${Math.round(tr.odometer / 1000)}k of ${Math.round(a.trailer.lifeMi[tr.type] / 1000)}k miles`
      : tr.lease === "rental"
        ? `a rented ${name(tr.type)} · ${fd(a.rental.weeklyFd[tr.type])} FD a week`
        : `the lessor's ${name(tr.type)}`;
  return (
    <>
      <p class="small">Trailer: {trailer}</p>
      {t.lease === "owned" ? (
        <p class="small">
          Tractor: {Math.max(0, a.tractor.maxRebuilds - t.rebuilds)} of {a.tractor.maxRebuilds} rebuilds left · {pct(1 - tractorLifeUsed(w.cfg, t))} of its life left
          {!rebuildable(w.cfg, t) ? <span class="warn"> · past its last rebuild: it runs until it's worn out, then goes for scrap</span> : null}
        </p>
      ) : null}
      {lessor ? (
        <p class="small">
          Leased from {lessor.name} at {fd(t.leaseWeekFd)} FD a week{today < t.leaseMinUntilDay ? `, minimum term to ${dateLabel(t.leaseMinUntilDay)}` : ""}
        </p>
      ) : null}
    </>
  );
}

/** Assets: a truck's trailer swaps and rentals, and what its owner can do with the tractor. */
export function TruckAssetActions({ t }: { t: Truck }): JSX.Element | null {
  const w = S.game!.w;
  const c = me();
  if (!w.cfg.assets.enabled || t.lease !== "owned") return null;
  const leasedIn = t.lessorId !== 0 && t.lessorId !== c.id;
  const standing = t.status === "idle" || t.status === "parked";
  const atYard = t.status === "idle" && t.hub === c.homeHub;
  const cur = hookedTrailer(w, t);
  const spares = atYard ? yardTrailers(w, c) : [];
  const canRent = t.status === "idle" && (cur?.lease !== "owned" || (atYard && c.yard !== "none"));
  const trade = standing && !leasedIn ? dealershipsOpen(w).map((b) => ({ b, offer: tradeInOffer(w, b, t) })).filter((x) => x.offer > 0).sort((a, b) => b.offer - a.offer)[0] : undefined;
  const leaseFd = Math.round(Math.max(w.cfg.assets.playerLeases.weeklyFdRange[0], 0.02 * truckValue(w, t)));
  return (
    <>
      {spares.map((sp) => (
        <Btn key={sp.id} onClick={() => act({ type: "swap_trailer", truckId: t.id, trailerId: sp.id }, `It pulls the ${name(sp.type)} now`)}>
          Hook the {name(sp.type)} · {pct(trailerCondition(w, sp))}
        </Btn>
      ))}
      {canRent ? (
        <>
          <select id={`rent-${t.id}`} aria-label="Trailer to rent">
            {TYPES.map((e) => (
              <option key={e} value={e}>
                {TRAILER_NAME[e]} · {fd(w.cfg.assets.rental.weeklyFd[e])}/wk
              </option>
            ))}
          </select>
          <Btn
            onClick={() => {
              const e = (document.getElementById(`rent-${t.id}`) as HTMLSelectElement).value as Equipment;
              act({ type: "rent_trailer", truckId: t.id, trailer: e }, `Rented a ${name(e)}, ${w.cfg.assets.rental.minWeeks} weeks minimum`);
            }}
          >
            Rent
          </Btn>
        </>
      ) : null}
      {trade ? (
        <Btn onClick={() => act({ type: "trade_in", truckId: t.id, dealershipId: trade.b.id }, `Traded in for ${fd(trade.offer)} FD`)}>Trade in · {fd(trade.offer)} FD</Btn>
      ) : null}
      {standing && !leasedIn && myTrucks().length > 1 ? (
        <>
          <input type="number" id={`lease-${t.id}`} step="10" min={String(w.cfg.assets.playerLeases.weeklyFdRange[0])} defaultValue={String(leaseFd)} aria-label="Weekly lease price" />
          <Btn onClick={() => act({ type: "offer_lease", truckId: t.id, weeklyFd: num(`lease-${t.id}`), minWeeks: 4 }, "Offered for lease: 4 weeks minimum")}>Offer for lease /wk</Btn>
        </>
      ) : null}
      {standing && !leasedIn ? (
        <Btn danger onClick={(ev) => confirmAct({ verb: "Scrap", item: `truck ${truckNo(t.id)}`, costFd: null, costLine: "", ...scrapLines(w, t, truckNo(t.id)), go: `Scrap · ${fdFull(tractorScrapFd(w, t))} FD`, destructive: true, run: () => act({ type: "scrap_truck", truckId: t.id }, "Tractor scrapped; its trailer waits in the yard") }, ev)}>
          Scrap · {fd(tractorScrapFd(w, t))} FD (worth {fd(truckValue(w, t))})
        </Btn>
      ) : null}
      {leasedIn && t.status === "idle" ? <Btn onClick={() => act({ type: "return_lease", truckId: t.id }, "Back to its owner")}>Return to its owner</Btn> : null}
    </>
  );
}

/** Assets: the yard, its room for tractors and trailers, and the spares waiting in it. */
export function YardCard(): JSX.Element | null {
  useData();
  const w = S.game!.w;
  const c = me();
  const a = w.cfg.assets;
  if (!a.enabled) return null;
  const spares = trailersOf(w, c.id).filter((tr) => tr.lease === "owned" && tr.status !== "hooked");
  const tractors = myTrucks().filter((t) => t.lease === "owned").length;
  const leased = myTrucks().filter((t) => t.lease !== "owned" && t.status !== "retired").length;
  return (
    <Card title="The yard">
      <Kv
        rows={[
          ["Holds", <Num>{yardTrucks(w, c)} tractors · {trailerCap(w, c)} trailers</Num>],
          // What it runs, leased trucks included (copy-player5.md R25: "Now 0 tractors" read wrong with a leased truck running).
          ["Running", <Num>{leased} leased, {tractors} owned · {ownedTrailers(w, c).length} trailers of your own</Num>],
        ]}
      />
      <p class="muted small">
        Spare trailers wait at {w.net.hubs[c.homeHub]!.name}; a truck idle there can hook one. {c.yard === "none" ? "Without a yard there's no room for a spare." : ""}
      </p>
      {spares.length === 0 ? <p class="muted">No spare trailers.</p> : null}
      {spares.map((tr) => {
        const cond = trailerCondition(w, tr);
        const value = trailerValue(w, tr);
        const refurb = tr.status === "dropped" && tr.refurbUntilT === null && trailerRefurbishable(w, tr) && cond <= a.trailer.refurbMaxCondition;
        return (
          <div class="row" key={tr.id}>
            <span>
              {TRAILER_NAME[tr.type]} · {pct(cond)} · {Math.round(tr.odometer / 1000)}k of {Math.round(a.trailer.lifeMi[tr.type] / 1000)}k mi
              {tr.status === "listed" ? <span class="muted"> · for sale</span> : tr.refurbUntilT !== null ? <span class="muted"> · in the shop</span> : null}
            </span>
            {refurb ? (
              <Btn sm onClick={() => act({ type: "refurbish_trailer", trailerId: tr.id }, "In the shop for a day")}>
                Refurbish · {fd(a.trailer.refurbFd[tr.type])}
              </Btn>
            ) : null}
            {tr.status === "dropped" && tr.refurbUntilT === null ? (
              <Btn sm onClick={() => act({ type: "list_trailer", trailerId: tr.id, askFd: value, floorFd: value * 0.6, stepFd: value * 0.05 }, `Listed at ${fd(value)} FD`)}>
                Sell · {fd(value)}
              </Btn>
            ) : null}
            {tr.status === "dropped" ? (
              <Btn sm danger onClick={(ev) => confirmAct({ verb: "Scrap", item: `this ${name(tr.type)}`, costFd: null, costLine: "", does: CONFIRM.scrapTrailer(name(tr.type), fd(trailerScrapFd(w, tr))), risk: CONFIRM.scrapRisk(fd(trailerValue(w, tr))), go: `Scrap · ${fdFull(trailerScrapFd(w, tr))} FD`, destructive: true, run: () => act({ type: "scrap_trailer", trailerId: tr.id }, "Trailer scrapped") }, ev)}>
                Scrap · {fd(trailerScrapFd(w, tr))}
              </Btn>
            ) : null}
          </div>
        );
      })}
      <div class="row">
        {/* Lands on the Dealer's trailers, not its used trucks at the top (QA's R6 replay). */}
        <Btn onClick={() => (setTab("market"), setTimeout(() => document.getElementById("dealer-trailers")?.scrollIntoView({ block: "start" }), 50))}>Buy a trailer</Btn>
        <Btn ghost onClick={() => setTab("business")}>
          More yard space
        </Btn>
      </div>
    </Card>
  );
}
