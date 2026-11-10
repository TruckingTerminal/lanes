import type { JSX } from "preact";
import { useState } from "preact/hooks";
import type { Equipment, FacilityType, TractorTier } from "@lanes/config";
import { assetPriceUsd, availableSupply, collateralOf, listingBlock, companyAccount, condition, dealerPrice, deliveryDays, dealerBacklog, facilityOutlook, lessorTrucksOf, newPrice, openListings, ordersOf, tokenLive, truckCap, truckValue } from "@lanes/engine";
import { facilityUrl } from "../../art.js";
import { SCENES } from "../../assets.js";
import { FAC_NAME, fd, hhmm, pct, signedPct, TIER_NAME, TRAILER_NAME, usd, plural, fdFull } from "../../format.js";
import { act, me, myTrucks, order, S, useData } from "../../state.js";
import { Btn, Card, Num, Panel, Pixel } from "../bits.js";
import { Rig, Scene } from "../Loop.js";
import { Buy, Showroom } from "./Showroom.js";
import { confirmAct } from "../Confirm.js";
import { leaseDepositNow, leaseTruck, leaseWeeklyMin, newTruck, usedTruck } from "../../confirmspecs.js";
import { ANSWER, CONFIRM, DEALER } from "../../copy.js";
import { firstTruckLine, inFirstMonth, leaseOnRun, listingWhy, truckPlace } from "../../figures.js";
import { PENDING } from "../../copy-pending.js";
import { CapsLine } from "../Caps.js";

export function Dealer(): JSX.Element {
  useData();
  const w = S.game!.w;
  const c = me();
  const cash = w.ledger.balance(companyAccount(c.id));
  // The farming season's dollar window for facilities (Jeff, 2026-11-01): every dollar held for the launch pool.
  const uw = w.cfg.token.catalogue.usdWindow;
  const dollarWindow = !tokenLive(w) && w.cfg.token.enabled && uw.enabled && uw.assets.enabled && !inFirstMonth(w, c);
  const fleet = myTrucks();
  const onLease = fleet.some((t) => t.lease === "npc");
  const firstTruck = !fleet.some((t) => t.lease === "owned") && ordersOf(w, c.id).length === 0;
  const lead = deliveryDays(w);
  const tiers: TractorTier[] = ["workhorse", "highwayPro", "flagship"];
  const trailers: Equipment[] = ["van", "reefer", "flatbed"];
  const today = Math.floor(w.t / 1440);
  const used = openListings(w)
    .filter((l) => l.truckId > 0 && l.formerOwnerId !== c.id && l.sellerId !== c.id)
    .map((l) => ({ l, t: w.trucks[l.truckId - 1]! }))
    .sort((a, b) => a.l.askFd / Math.max(1, truckValue(w, a.t)) - b.l.askFd / Math.max(1, truckValue(w, b.t)))
    .slice(0, 8);
  const canLease = fleet.some((t) => t.lease === "owned") && lessorTrucksOf(w, c.id).length < w.cfg.freeEntry.leases.maxPerCompany;
  // R7: what stops a lease, in the writer's words, before the press (the binding one first).
  const leaseWhy = (tr: Equipment): string | null => {
    const cap = truckCap(w, c);
    const running = fleet.length + ordersOf(w, c.id).length;
    if (lessorTrucksOf(w, c.id).length >= w.cfg.freeEntry.leases.maxPerCompany) return ANSWER.leaseMax(w.cfg.freeEntry.leases.maxPerCompany);
    if (running >= cap) return ANSWER.leaseYard(cap, running + 1);
    const deposit = leaseDepositNow(w, tr);
    return deposit > cash + 0.005 ? ANSWER.leaseDeposit(fdFull(deposit), fdFull(cash)) : null;
  };
  const [leaseAnswer, setLeaseAnswer] = useState<{ text: string; bad: boolean } | null>(null);
  const lease = async (tr: Equipment) => {
    const r = await order({ type: "lease_truck", trailer: tr }, "Leased truck ready at your home hub");
    setLeaseAnswer(r.ok ? { text: r.at === null ? ANSWER.lease(`Workhorse with a ${TRAILER_NAME[tr].toLowerCase()}`, w.net.hubs[c.homeHub]!.name, fdFull(leaseDepositNow(w, tr))) : `Sent · in effect ${hhmm(r.at)}`, bad: false } : { text: r.reason, bad: true });
  };
  const facTypes: FacilityType[] = ["warehouse", "coldStorage", "factory"];
  // The first truck's one figure (figures.ts firstTruckLine): the same number as the teaser and Iuliia's page.
  const first = fleet.some((t) => t.lease === "owned") ? null : firstTruckLine(w, c);
  return (
    <Panel title="Dealer">
      <Scene name="dealer" still={SCENES.dealer} alt="The dealership lot" />
      {first ? (
        <Card>
          <p>
            <b>{first.ordered ? `${first.figure}.` : first.figure}</b>
          </p>
          {first.what ? <p class="small">{first.what}</p> : null}
          {/* Client batch 6b: a truck that delivers sooner than the one the figure prices, with its cash today. */}
          {first.sooner ? <p class="small">{first.sooner}</p> : null}
          {first.cashOnly ? <p class="muted small">{first.cashOnly}</p> : null}
          {first.worn ? <p class="muted small">{first.worn}</p> : null}
          {first.advice ? <p class="muted small">{first.advice}</p> : null}
        </Card>
      ) : null}
      <CapsLine />
      {/* R7: the page's one line goes; each offer says when it delivers, and the wait says its cause when there's one. */}
      {dealerBacklog(w).counted > 0 ? <p class="muted small">{DEALER.newLead(lead)}</p> : null}
      <h3>Used trucks</h3>
      {used.length ? (
        used.map(({ l, t }) => (
          <Card key={l.id}>
            <div class="truckhead">
              <Rig eq={t.trailer} paint="grey" alt="Used truck" />
              <div>
                <h3>
                  {TIER_NAME[t.tier]} + {TRAILER_NAME[t.trailer]}
                </h3>
                <p>
                  {Math.round(t.odometer).toLocaleString("en-US")} mi · {pct(condition(w.cfg, t))} condition · {PENDING.truckIn(truckPlace(w, t.place))}
                  {l.sellerId === 0 ? <span class="warn"> · repo</span> : null}
                </p>
                <p>
                  Asking <Num>{fd(l.askFd)}</Num> FD (value {fd(truckValue(w, t))})
                </p>
              </div>
            </div>
            {/* The same loan and deposit rules as the lot (QA's Dealer replay); the engine's own checks, cash aside, name any block. */}
            <Buy
              what={`${TIER_NAME[t.tier]} + ${TRAILER_NAME[t.trailer]}`}
              label={leaseOnRun(w, c) ? PENDING.buyWhenIdleLabel : "Buy today"}
              price={l.askFd}
              replacing={onLease}
              block={listingWhy(w, c, listingBlock(w, c.id, l.id, Infinity))}
              action={{ type: "buy_listing", listingId: l.id }}
              // Client batch 7b: while the leased truck isn't idle, the listing isn't ready today either.
              when={leaseOnRun(w, c) ? PENDING.readyWhenIdle(leaseOnRun(w, c)!.truckId) : DEALER.deliversToday}
              lines={usedTruck(w, c, t, t.hub)}
              truck={collateralOf(w, t)}
              ok="Bought. It's yours, idle where it stands"
            />
          </Card>
        ))
      ) : (
        <p class="muted">Nothing listed right now.</p>
      )}
      <Card title="Lease another truck">
        {/* R7 and R20: the row says what a lease takes; a lease the rules won't give is off, with the binding reason; the
            answer lands under the row. */}
        <p class="muted small">{ANSWER.leaseRow(fdFull(leaseDepositNow(w, "van")), fdFull(leaseWeeklyMin(w, "van")))}. Needs one truck you own. Lessor has {w.lessor.fleet - w.lessor.out} free.</p>
        <div class="row">
          {trailers.map((tr) => (
            <Btn key={tr} disabled={!(canLease && w.lessor.out < w.lessor.fleet) || leaseWhy(tr) !== null} onClick={(ev) => confirmAct({ verb: "Lease", item: `a ${TRAILER_NAME[tr].toLowerCase()} truck`, costFd: leaseDepositNow(w, tr), ...leaseTruck(w, tr, leaseDepositNow(w, tr), leaseWeeklyMin(w, tr)), go: `Lease · ${fdFull(leaseDepositNow(w, tr))} FD`, run: () => void lease(tr) }, ev)}>
              {TRAILER_NAME[tr]}
            </Btn>
          ))}
        </div>
        {leaseWhy("van") ? <p class="muted small">{leaseWhy("van")}</p> : null}
        {leaseAnswer ? <p class={leaseAnswer.bad ? "bad small" : "small"}>{leaseAnswer.text}</p> : null}
      
      </Card>
      {w.cfg.assets.enabled ? <Showroom /> : null}
      {w.cfg.assets.enabled ? null : <h3>New from the dealer</h3>}
      {w.cfg.assets.enabled ? null : tiers.map((tier) =>
        trailers.map((tr) => {
          const price = dealerPrice(w, { tier, trailer: tr });
          const vsList = price / newPrice(w.cfg, { tier, trailer: tr }) - 1;
          const left = availableSupply(w, tier, tr, firstTruck);
          return (
            <Card key={`${tier}-${tr}`}>
              <div class="truckhead">
                <Rig eq={tr} alt={`${TIER_NAME[tier]} with ${TRAILER_NAME[tr]}`} />
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
                <Btn primary disabled={!(cash >= price && left > 0)} onClick={(ev) => confirmAct({ verb: "Buy", item: `a ${TIER_NAME[tier]}`, costFd: price, ...newTruck(w, tier, tr, lead), run: () => act({ type: "buy_asset", tier, trailer: tr, replaceNpcLease: onLease }, `Ordered. Delivery in ${plural(lead, "day")}`) }, ev)}>
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
                <Btn key={b.h.id} disabled={!(cash >= spec.priceFd && w.facilitySupply[type] > 0)} onClick={(ev) => confirmAct({ verb: "Open", item: `a ${FAC_NAME[type].toLowerCase()} at ${b.h.name}`, costFd: spec.priceFd, does: CONFIRM.facility(FAC_NAME[type].toLowerCase(), b.h.name), risk: CONFIRM.upkeepRisk(fd(spec.upkeepPerWeekFd)), run: () => act({ type: "buy_facility", facility: type, hubId: b.h.id }, `${FAC_NAME[type]} open at ${b.h.name}`) }, ev)}>
                  {b.h.name} · {(b.o.loadsPerRound * 2).toFixed(1)} loads/day
                </Btn>
              ))}
            </div>
            {dollarWindow ? (
              <div class="row">
                <span class="muted small">Or {usd(assetPriceUsd(w, spec.priceFd))} to the launch pool:</span>
                {best.map((b) => (
                  <Btn key={`usd-${b.h.id}`} disabled={!(c.usd.wallet >= assetPriceUsd(w, spec.priceFd) && w.facilitySupply[type] > 0)} onClick={() => act({ type: "buy_facility", facility: type, hubId: b.h.id, pay: "usd" }, `${FAC_NAME[type]} open at ${b.h.name}, paid in dollars`)}>
                    {b.h.name} · {usd(assetPriceUsd(w, spec.priceFd))}
                  </Btn>
                ))}
              </div>
            ) : null}
          </Card>
        );
      })}
    </Panel>
  );
}
