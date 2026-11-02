import type { JSX } from "preact";
import type { Equipment, TractorTier } from "@lanes/config";
import {
  assetPriceUsd,
  bestSource,
  companyAccount,
  purchaseTerms,
  lotPrice,
  lotSpec,
  npcDealerMult,
  tokenLive,
  condition,
  dealershipsOpen,
  hasStock,
  npcBackstop,
  openLeaseOffers,
  openListings,
  ordersOf,
  ownedTrailers,
  trailerCap,
  trailerCondition,
  trailerOrdersOf,
  trailerValue,
  truckValue,
  yardTrailers,
  type Source,
} from "@lanes/engine";
import { fd, pct, TIER_NAME, TRAILER_NAME } from "../../format.js";
import { act, me, myTrucks, order, S, toast } from "../../state.js";
import { iuliiaSay } from "../../iuliia.js";
import { DEALER } from "../../copy.js";
import { buyPlan } from "../../finance.js";
import { useState } from "preact/hooks";
import type { Action } from "@lanes/engine";
import { Btn, Card, Kv, Num } from "../bits.js";
import { Rig } from "../Loop.js";

const TIERS: TractorTier[] = ["workhorse", "highwayPro", "flagship"];
const TYPES: Equipment[] = ["van", "reefer", "flatbed"];

function sourceLabel(src: Source): string {
  const w = S.game!.w;
  if (!src.dealershipId) return `the NPC dealer${npcBackstop(w) ? " (backstop: dearer and slower)" : ""}`;
  const b = w.businesses[src.dealershipId - 1]!;
  const owner = w.companies[b.ownerId - 1];
  return `${owner?.name ?? "a player"}'s dealership in ${w.net.hubs[b.hub]?.name ?? "?"}`;
}

/**
 * Assets (tractors and trailers apart): new rigs, tractors alone and trailers alone, each from the
 * cheapest place that has one (a player dealership's stock, or the NPC dealer); used trailers; and
 * tractors other carriers offer for lease by the week.
 */
export function Showroom(): JSX.Element {
  const w = S.game!.w;
  const c = me();
  const cash = w.ledger.balance(companyAccount(c.id));
  const fleet = myTrucks();
  const onLease = fleet.some((t) => t.lease === "npc");
  const spares = yardTrailers(w, c).length;
  const ownTrailers = ownedTrailers(w, c).length + trailerOrdersOf(w, c.id).length;
  // Without a yard there's nowhere to keep a spare: only as many trailers as tractors.
  const tractors = fleet.filter((t) => t.lease !== "npc").length + ordersOf(w, c.id).filter((o) => o.kind !== "trailer").length;
  const trailerRoom = c.yard === "none" ? Math.min(trailerCap(w, c), tractors) - ownTrailers : trailerCap(w, c) - ownTrailers;
  // A rig brings its own tractor, so only the company's trailer cap limits it (actions.ts buy_asset); the "no more
  // trailers than tractors" rule without a yard is for a trailer bought alone (QA's Finance replay: the first rig was blocked).
  const rigRoom = trailerCap(w, c) - ownTrailers;
  const lifeMi = w.cfg.assets.tractor.lifeMi;
  const life = lifeMi % 1_000_000 === 0 ? `${lifeMi === 1_000_000 ? "a million" : `${lifeMi / 1_000_000} million`} miles` : `${Math.round(lifeMi / 1000)}k miles`;
  const usedTrailers = openListings(w).filter((l) => l.trailerId > 0 && l.sellerId !== c.id).slice(0, 8);
  const offers = openLeaseOffers(w).filter((o) => o.lessorId !== c.id).sort((a, b) => a.weeklyFd - b.weeklyFd).slice(0, 8);
  const open = dealershipsOpen(w);
  const uw = w.cfg.token.catalogue.usdWindow;
  const dollarWindow = !tokenLive(w) && w.cfg.token.enabled && uw.enabled && uw.assets.enabled;
  return (
    <>
      <p class="muted small">
        New equipment comes from the factory each month. {open.length ? `${open.length} player dealership${open.length > 1 ? "s" : ""} sell it from stock in ${w.cfg.businesses.kinds.dealership.deliveryDays} days; the NPC dealer is the backstop at ${Math.round((w.cfg.assets.factory.npcPremium - 1) * 100)}% over list and a longer wait.` : "The NPC dealer sells it at list until a player opens a dealership."} Tractors take {w.cfg.assets.tractor.maxRebuilds} rebuilds or {life}, then run until they're worn out and go for scrap.
      </p>
      {w.cfg.usedMarket.npcLot.enabled ? (
        <>
          <h3>The used lot</h3>
          <p class="muted small">
            Worn rigs at their used value: a Workhorse about {lotSpec(w, "van").odometer.toLocaleString("en-US")} miles and {Math.round((w.t / w.cfg.time.gameMinutesPerDay - lotSpec(w, "van").builtDay) / 365)} years old. {w.usedLot.stock} on the lot this week; delivered like a new one.
          </p>
          {TYPES.map((tr) => (
            <Buy
              key={tr}
              what={`Workhorse + ${TRAILER_NAME[tr]}`}
              price={lotPrice(w, "workhorse", tr) * npcDealerMult(w)}
              replacing={onLease}
              block={w.usedLot.stock < 1 ? DEALER.whyLotEmpty : rigRoom <= 0 ? DEALER.whyYard : null}
              action={{ type: "buy_asset", tier: "workhorse", trailer: tr, replaceNpcLease: onLease, used: true }}
              ok="Ordered from the used lot"
            />
          ))}
        </>
      ) : null}
      <h3>New rigs and tractors</h3>
      {TIERS.map((tier) =>
        TYPES.map((tr) => {
          const rig = bestSource(w, c.id, "rig", tier, tr);
          const tractor = bestSource(w, c.id, "tractor", tier, tr);
          const rigLeft = rig.dealershipId ? true : w.supply.tractor[tier] > 0 && w.supply.trailer[tr] > 0;
          return (
            <Card key={`${tier}-${tr}`}>
              <div class="truckhead">
                <Rig eq={tr} alt={`${TIER_NAME[tier]} with ${TRAILER_NAME[tr]}`} />
                <div>
                  <h3>
                    {TIER_NAME[tier]} + {TRAILER_NAME[tr]}
                  </h3>
                  <p>
                    <Num>{fd(rig.price)}</Num> FD from {sourceLabel(rig)}, {rig.days} days
                  </p>
                </div>
              </div>
              <Buy
                what={`${TIER_NAME[tier]} + ${TRAILER_NAME[tr]}`}
                label={`Order the rig${onLease ? " (replaces your lease)" : ""}`}
                price={rig.price}
                replacing={onLease}
                block={!rigLeft ? DEALER.whySupply : rigRoom <= 0 ? DEALER.whyYard : null}
                action={{ type: "buy_asset", tier, trailer: tr, replaceNpcLease: onLease, dealershipId: rig.dealershipId || undefined }}
                ok={`Ordered. Delivery in ${rig.days} days`}
              />
              <div class="row">
                {dollarWindow && !rig.dealershipId ? (
                  <Btn disabled={!(c.usd.wallet >= assetPriceUsd(w, rig.price) && rigLeft && trailerRoom > 0)} onClick={() => act({ type: "buy_asset", tier, trailer: tr, replaceNpcLease: onLease, pay: "usd" }, `Ordered for dollars. Delivery in ${rig.days} days`)}>
                    Or ${assetPriceUsd(w, rig.price).toLocaleString("en-US", { maximumFractionDigits: 0 })} (to the launch pool)
                  </Btn>
                ) : null}
              </div>
              {tr === "van" ? (
                <Buy
                  what={`${TIER_NAME[tier]} tractor alone${spares ? ` (${spares} spare${spares > 1 ? "s" : ""} in the yard)` : ""}`}
                  price={tractor.price}
                  replacing={onLease}
                  block={tractor.dealershipId || w.supply.tractor[tier] > 0 ? null : DEALER.whySupply}
                  action={{ type: "buy_asset", tier, trailer: tr, replaceNpcLease: onLease, tractorOnly: true, dealershipId: tractor.dealershipId || undefined }}
                  ok="Tractor ordered. It hooks a spare from your yard, or a rental"
                />
              ) : null}
            </Card>
          );
        }),
      )}
      <h3>Trailers alone</h3>
      <p class="muted small">
        Room for {Math.max(0, trailerRoom)} more of your own. {c.yard === "none" ? "Without a yard, only as many trailers as tractors." : "Spares wait in the yard; swap at your home hub."}
      </p>
      <div class="row">
        {TYPES.map((tr) => {
          const src = bestSource(w, c.id, "trailer", "workhorse", tr);
          const left = src.dealershipId ? true : w.supply.trailer[tr] > 0;
          return (
            <Btn key={tr} disabled={!(cash >= src.price && left && trailerRoom > 0)} onClick={() => act({ type: "buy_trailer", trailer: tr, dealershipId: src.dealershipId || undefined }, `Trailer ordered. Delivery in ${src.days} days`)}>
              {TRAILER_NAME[tr]} · {fd(src.price)} · {src.days} d
            </Btn>
          );
        })}
      </div>
      {open.length ? (
        <p class="muted small">
          In stock: {open.map((b) => `${w.net.hubs[b.hub]?.name ?? "?"}: ${TIERS.filter((t) => hasStock(b, "tractor", t, "van")).length ? TIERS.map((t) => b.stock.tractor[t]).join("/") : "no tractors"} tractors, ${TYPES.map((t) => b.stock.trailer[t]).join("/")} trailers`).join(" · ")}
        </p>
      ) : null}
      <h3>Used trailers</h3>
      {usedTrailers.length ? (
        usedTrailers.map((l) => {
          const tr = w.trailers[l.trailerId - 1]!;
          return (
            <div class="row" key={l.id}>
              <span>
                {TRAILER_NAME[tr.type]} · {pct(trailerCondition(w, tr))} · {Math.round(tr.odometer / 1000)}k mi · asking <Num>{fd(l.askFd)}</Num> (value {fd(trailerValue(w, tr))})
              </span>
              <Btn sm disabled={cash < l.askFd || trailerRoom <= 0} onClick={() => act({ type: "buy_listing", listingId: l.id }, "Bought: it's in your yard")}>
                Buy
              </Btn>
            </div>
          );
        })
      ) : (
        <p class="muted">None listed.</p>
      )}
      <h3>Tractors for lease from other carriers</h3>
      {offers.length ? (
        offers.map((o) => {
          const t = w.trucks[o.truckId - 1]!;
          const owner = w.companies[o.lessorId - 1];
          return (
            <div class="row" key={o.id}>
              <span>
                {TIER_NAME[t.tier]} · {pct(condition(w.cfg, t))} · {Math.round(t.odometer / 1000)}k mi · at {w.net.hubs[t.hub]?.name} · <Num>{fd(o.weeklyFd)}</Num> FD a week, {o.minWeeks} weeks minimum · from {owner?.name ?? "?"} (value {fd(truckValue(w, t))})
              </span>
              <Btn sm onClick={() => act({ type: "take_lease", offerId: o.id }, "Leased: it joins your fleet where it stands, with your trailer")}>
                Lease it
              </Btn>
            </div>
          );
        })
      ) : (
        <p class="muted">No tractors offered for lease right now.</p>
      )}
    </>
  );
}

/**
 * A buy control (QA's Finance and Dealer replays): for cash, and on a purchase loan when the rule offers one, its numbers
 * shown on a sheet before it acts; the lot, a new rig, a tractor alone or another carrier's listing. A disabled button
 * always says why, under it; a refusal from the rules shows there too, never as a toast.
 */
export function Buy({ what, label, price, replacing, block, action, ok }: { what: string; label?: string; price: number; replacing: boolean; block: string | null; action: Extract<Action, { type: "buy_asset" }> | Extract<Action, { type: "buy_listing" }>; ok: string }): JSX.Element {
  const w = S.game!.w;
  const c = me();
  const [open, setOpen] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const p = buyPlan(w, c, price, replacing);
  // The reasons use the sheet's net figures (QA's Dealer re-check): what's needed after the lease deposit, against cash alone.
  const cash = p.have - p.deposit;
  const cashWhy = block ?? (p.cashOk ? null : DEALER.whyCash(fd(cash), fd(p.cashNowFd)));
  const loanWhy = !p.loan ? null : block ?? (p.loan.why === "full" ? DEALER.whyLoans(purchaseTerms(w, c).maxLoans) : p.loan.why === "short" ? DEALER.whyLoan(fd(p.loanNowFd ?? 0), fd(cash)) : null);
  const ef = w.cfg.equipmentFinance.purchase;
  // Iuliia's line for the purchase: the first truck of its own, or one more (iuliia-lines.md, Dealer).
  const said = myTrucks().some((t) => t.lease === "owned") || ordersOf(w, c.id).length ? "dealer:buyLater" : "dealer:buyFirst";
  const go = async (a: typeof action) => {
    const r = await order(a, ok);
    if (!r.ok) return setRefused(r.reason);
    setRefused(null);
    setOpen(false);
    toast(ok);
    iuliiaSay(said);
  };
  return (
    <div class="stack buy">
      <div class="row">
        <Btn primary disabled={cashWhy !== null} onClick={() => void go(action)}>
          {label ?? what} · {fd(price)}
        </Btn>
        {p.loan && !block ? (
          <Btn onClick={() => setOpen(!open)} on={open}>
            {DEALER.onLoan}
          </Btn>
        ) : null}
      </div>
      {cashWhy ? <p class="muted small">{cashWhy}</p> : null}
      {refused ? <p class="bad small">{refused}</p> : null}
      {open && p.loan ? (
        <Card title={DEALER.loanTitle(what)}>
          <Kv
            rows={[
              [DEALER.price, `${fd(price)} FD`],
              [DEALER.tax, `${fd(p.tax)} FD`],
              [DEALER.down, `${fd(p.loan.down)} FD`],
              [DEALER.loan, `${fd(p.loan.loanFd)} FD`],
              [DEALER.stake, DEALER.stakeValue(fd(p.loan.stake))],
              [DEALER.weekly, DEALER.weeklyValue(fd(p.loan.weekly), p.loan.termWeeks, `${(p.loan.weeklyRate * 100).toFixed(2)}%`)],
              ...(p.deposit > 0.5 ? ([[DEALER.deposit, DEALER.depositValue(fd(p.deposit))]] as [string, string][]) : []),
              [DEALER.now, `${fd(p.loanNowFd ?? 0)} FD`],
            ]}
          />
          <p class="warn small">{DEALER.missed(ef.missedToDefault)}</p>
          <div class="row">
            <Btn primary disabled={loanWhy !== null} onClick={() => void go({ ...action, finance: true })}>
              {DEALER.buyLoan(fd(p.loanNowFd ?? 0))}
            </Btn>
            <Btn ghost onClick={() => setOpen(false)}>
              {DEALER.cancel}
            </Btn>
          </div>
          {loanWhy ? <p class="muted small">{loanWhy}</p> : null}
        </Card>
      ) : null}
    </div>
  );
}
