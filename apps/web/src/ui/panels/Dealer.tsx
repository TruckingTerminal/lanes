import type { JSX } from "preact";
import type { Equipment, FacilityType, TractorTier } from "@lanes/config";
import { availableSupply, companyAccount, condition, dealerPrice, deliveryDays, facilityOutlook, lessorTrucksOf, newPrice, openListings, ordersOf, truckValue } from "@lanes/engine";
import { facilityUrl } from "../../art.js";
import { rig, SCENES } from "../../assets.js";
import { FAC_NAME, fd, pct, signedPct, TIER_NAME, TRAILER_NAME } from "../../format.js";
import { act, me, myTrucks, S, useData } from "../../state.js";
import { Btn, Card, Num, Panel, Pixel } from "../bits.js";
import { Scene } from "../Loop.js";

export function Dealer(): JSX.Element {
  useData();
  const w = S.game!.w;
  const c = me();
  const cash = w.ledger.balance(companyAccount(c.id));
  const fleet = myTrucks();
  const onLease = fleet.some((t) => t.lease === "npc");
  const firstTruck = !fleet.some((t) => t.lease === "owned") && ordersOf(w, c.id).length === 0;
  const lead = deliveryDays(w);
  const tiers: TractorTier[] = ["workhorse", "highwayPro", "flagship"];
  const trailers: Equipment[] = ["van", "reefer", "flatbed"];
  const today = Math.floor(w.t / 1440);
  const used = openListings(w)
    .filter((l) => l.formerOwnerId !== c.id && l.sellerId !== c.id)
    .map((l) => ({ l, t: w.trucks[l.truckId - 1]! }))
    .sort((a, b) => a.l.askFd / Math.max(1, truckValue(w, a.t)) - b.l.askFd / Math.max(1, truckValue(w, b.t)))
    .slice(0, 8);
  const canLease = fleet.some((t) => t.lease === "owned") && lessorTrucksOf(w, c.id).length < w.cfg.freeEntry.leases.maxPerCompany;
  const facTypes: FacilityType[] = ["warehouse", "coldStorage", "factory"];
  return (
    <Panel title="Dealer">
      <Scene name="dealer" still={SCENES.dealer} alt="The dealership lot" />
      <p class="muted small">New trucks are paid now and delivered in {lead} days; the wait grows when the whole market is ordering. Used trucks deliver today.</p>
      <h3>Used trucks</h3>
      {used.length ? (
        used.map(({ l, t }) => (
          <Card key={l.id}>
            <div class="truckhead">
              <Pixel src={rig(t.trailer)} alt="Used truck" class="rig" />
              <div>
                <h3>
                  {TIER_NAME[t.tier]} + {TRAILER_NAME[t.trailer]}
                </h3>
                <p>
                  {Math.round(t.odometer).toLocaleString("en-US")} mi · {pct(condition(w.cfg, t))} condition · at {w.net.hubs[t.hub]!.id}
                  {l.sellerId === 0 ? <span class="warn"> · repo</span> : null}
                </p>
                <p>
                  Asking <Num>{fd(l.askFd)}</Num> FD (value {fd(truckValue(w, t))})
                </p>
              </div>
            </div>
            <div class="row">
              <Btn primary disabled={cash < l.askFd} onClick={() => act({ type: "buy_listing", listingId: l.id }, "Bought. It's yours, idle where it stands")}>
                Buy today
              </Btn>
            </div>
          </Card>
        ))
      ) : (
        <p class="muted">Nothing listed right now.</p>
      )}
      <Card title="Lease another truck">
        <p class="muted small">No money down: the lessor takes 15% of each load, 250 FD a week minimum, 28-day minimum term. Needs one truck you own. Lessor has {w.lessor.fleet - w.lessor.out} free.</p>
        <div class="row">
          {trailers.map((tr) => (
            <Btn key={tr} disabled={!(canLease && w.lessor.out < w.lessor.fleet)} onClick={() => act({ type: "lease_truck", trailer: tr }, "Leased truck ready at your home hub")}>
              {TRAILER_NAME[tr]}
            </Btn>
          ))}
        </div>
      </Card>
      <h3>New from the dealer</h3>
      {tiers.map((tier) =>
        trailers.map((tr) => {
          const price = dealerPrice(w, { tier, trailer: tr });
          const vsList = price / newPrice(w.cfg, { tier, trailer: tr }) - 1;
          const left = availableSupply(w, tier, tr, firstTruck);
          return (
            <Card key={`${tier}-${tr}`}>
              <div class="truckhead">
                <Pixel src={rig(tr)} alt={`${TIER_NAME[tier]} with ${TRAILER_NAME[tr]}`} class="rig" />
                <div>
                  <h3>
                    {TIER_NAME[tier]} + {TRAILER_NAME[tr]}
                  </h3>
                  <p>
                    <Num>{fd(price)}</Num> FD ({Math.abs(vsList) < 0.01 ? "list price" : <span class={vsList > 0 ? "bad" : "good"}>{signedPct(vsList)} vs list</span>}) · {left} left · {lead} days to deliver
                  </p>
                </div>
              </div>
              <div class="row">
                <Btn primary disabled={!(cash >= price && left > 0)} onClick={() => act({ type: "buy_asset", tier, trailer: tr, replaceNpcLease: onLease }, `Ordered. Delivery in ${lead} days`)}>
                  Order{onLease ? " (replaces your lease)" : ""}
                </Btn>
              </div>
            </Card>
          );
        }),
      )}
      <h3>Facilities</h3>
      {facTypes.map((type) => {
        const spec = w.cfg.facilities.types[type];
        const best = w.net.hubs
          .map((h, i) => ({ h, o: facilityOutlook(w, type, i, today) }))
          .sort((a, b) => b.o.loadsPerRound - a.o.loadsPerRound)
          .slice(0, 3);
        return (
          <Card key={type}>
            <div class="truckhead">
              <Pixel src={facilityUrl(type, 2)} alt={FAC_NAME[type]} />
              <div>
                <h3>{FAC_NAME[type]}</h3>
                <p>
                  <Num>{fd(spec.priceFd)}</Num> FD · upkeep {fd(spec.upkeepPerWeekFd)}/wk · {w.facilitySupply[type]} left
                </p>
              </div>
            </div>
            <p class="muted small">Ships its own freight from its hub; you earn the goods margin and shipper Miles.</p>
            <div class="row">
              {best.map((b) => (
                <Btn key={b.h.id} disabled={!(cash >= spec.priceFd && w.facilitySupply[type] > 0)} onClick={() => act({ type: "buy_facility", facility: type, hubId: b.h.id }, `${FAC_NAME[type]} open at ${b.h.id}`)}>
                  {b.h.id} · {(b.o.loadsPerRound * 2).toFixed(1)} loads/day
                </Btn>
              ))}
            </div>
          </Card>
        );
      })}
    </Panel>
  );
}
