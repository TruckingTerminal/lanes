import type { JSX } from "preact";
import { activeContracts, crewed, localShare, MANUAL_BID_MAX_DEADHEAD_MI, offeredContracts, placeMiles, type Company, type Contract, type Load } from "@lanes/engine";
import { COMMODITIES } from "@lanes/data";
import { cls, dateLabel, fd, hhmm, pct } from "../../format.js";
import { act, clockMin, myTrucks, S, truckNo } from "../../state.js";
import { Btn, Card, Num } from "../bits.js";

/** Contract tenders waiting for the player's company. */
export const myTenders = (c: Company): Load[] => [...S.game!.w.loads.values()].filter((l) => l.status === "open" && l.tenderedTo === c.id);

/** Pending contract tenders: the load, the contract rate against spot, the clock, and a truck to put on it. */
export function TendersCard({ c }: { c: Company }): JSX.Element | null {
  const w = S.game!.w;
  const tenders = myTenders(c);
  if (!tenders.length) return null;
  return (
    <>
      {tenders.map((l) => {
        const k = w.contracts.find((x) => x.id === l.contractId);
        const rate = k?.ratePerMile ?? 0;
        const trucks = myTrucks().filter((t) => t.status === "idle" && crewed(t) && t.trailer === l.equipment && placeMiles(w, t.place, l.originPlace) <= MANUAL_BID_MAX_DEADHEAD_MI);
        const spot = l.bookNow;
        const id = `tender-${l.id}`;
        return (
          <Card key={l.id} alert need={`tender:${l.id}`} title={`Contract tender: ${w.net.places[l.originPlace]!.name} → ${w.net.places[l.destPlace]!.name}, ${l.miles} mi`}>
            <p>
              {COMMODITIES[l.commodity]!.name} at your contract rate <Num>{rate.toFixed(2)}</Num>/mi ({fd(rate * l.miles)} FD); spot is {spot.toFixed(2)} (
              <span class={spot > rate ? "warn" : "good"}>
                {spot > rate ? "+" : ""}
                {Math.round((spot / Math.max(0.01, rate) - 1) * 100)}%
              </span>
              ). Accept by {hhmm(l.tenderUntil)} or it goes to the board{k ? `; acceptance on this contract ${pct(k.acceptance)}` : ""}.
            </p>
            <div class="row">
              {trucks.length ? (
                <>
                  <select id={id} aria-label="Truck">
                    {trucks.map((t) => (
                      <option value={t.id} key={t.id}>
                        Truck {truckNo(t.id)} · {placeMiles(w, t.place, l.originPlace)} mi away
                      </option>
                    ))}
                  </select>
                  <Btn primary onClick={() => act({ type: "accept_tender", loadId: l.id, truckId: Number((document.getElementById(id) as HTMLSelectElement).value) }, "Tender accepted at your contract rate")}>
                    Accept
                  </Btn>
                </>
              ) : (
                <span class="muted">
                  No idle {l.equipment} truck within {MANUAL_BID_MAX_DEADHEAD_MI} mi.
                </span>
              )}
              <Btn onClick={() => act({ type: "decline_tender", loadId: l.id }, "Tender left for the board")}>Leave it for the board</Btn>
            </div>
          </Card>
        );
      })}
    </>
  );
}

/** Offers from local shippers, the contracts held, and tenders waiting. */
export function ContractsCard({ c }: { c: Company }): JSX.Element {
  const w = S.game!.w;
  const day = Math.floor(clockMin() / 1440);
  const offers = offeredContracts(w, c.id);
  const active = activeContracts(w, c.id);
  const lane = (k: Contract) => `${w.net.places[k.originPlace]!.name} → ${w.net.places[k.destPlace]!.name} · ${k.equipment}`;
  const share = localShare(w, c.homeHub, "van");
  return (
    <>
      <TendersCard c={c} />
      <Card title="Contracts">
        <p class="muted small">
          Local shippers at {w.net.hubs[c.homeHub]!.name} give carriers based nearby first call on {pct(share)} of their van loads right now (more when trucks pile up, less when they're scarce), and offer the reliable ones contract lanes: a weekly volume at a fixed rate for {w.cfg.contracts.termDays} days. Your tender acceptance: {pct(c.tenderAcceptance)}
          {c.localBanUntilDay > day ? <span class="bad"> · passed over by local shippers until {dateLabel(c.localBanUntilDay)}</span> : null}.
        </p>
        {offers.length ? (
          <>
            <h3>Offers</h3>
            {offers.map((k) => (
              <div class="row" key={k.id}>
                <span>
                  {lane(k)} · {k.loadsPerWeek}/wk at <Num>{k.ratePerMile.toFixed(2)}</Num>/mi · expires {dateLabel(k.offerExpiresDay)}
                </span>
                <Btn primary onClick={() => act({ type: "accept_contract", contractId: k.id }, "Contract signed. Tenders start this week")}>
                  Sign
                </Btn>
                <Btn onClick={() => act({ type: "decline_contract", contractId: k.id }, "Offer declined")}>Decline</Btn>
              </div>
            ))}
          </>
        ) : null}
        {active.length ? (
          <>
            <h3>Held</h3>
            <table>
              <thead>
                <tr>
                  <th>Lane</th>
                  <th>Rate</th>
                  <th>Loads/wk</th>
                  <th>Accepted</th>
                  <th>Ends</th>
                </tr>
              </thead>
              <tbody>
                {active.map((k) => (
                  <tr key={k.id}>
                    <td>{lane(k)}</td>
                    <td class="num">{k.ratePerMile.toFixed(2)}</td>
                    <td class="num">{k.loadsPerWeek}</td>
                    <td class={cls("num", k.acceptance < w.cfg.contracts.cutBelow ? "bad" : "good")}>
                      {k.accepted}/{k.tendered} · {pct(k.acceptance)}
                    </td>
                    <td>{dateLabel(k.endDay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p class="muted">No contracts held. Offers come to local carriers with a good record; the dispatcher takes them unless you turn that off.</p>
        )}
      </Card>
    </>
  );
}
