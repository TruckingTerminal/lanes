import type { JSX } from "preact";
import type { Equipment, TractorTier } from "@lanes/config";
import {
  assetPriceUsd,
  bestSource,
  companyAccount,
  purchaseTerms,
  collateralOf,
  NEW_TRUCK,
  type Collateral,
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
  lotDeliveryDays,
} from "@lanes/engine";
import { fd, fdFull, pct, shortDate, TIER_NAME, TRAILER_NAME, plural } from "../../format.js";
import { act, me, myTrucks, order, S, toast } from "../../state.js";
import { iuliiaSay } from "../../iuliia.js";
import { DEALER } from "../../copy.js";
import { PENDING_RULES } from "../../copy-pending-rules.js";
import { buyPlan } from "../../finance.js";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Action } from "@lanes/engine";
import { Btn, Card, Kv, Num } from "../bits.js";
import { Rig } from "../Loop.js";
import { Fig } from "../Explain.js";
import { confirmAct } from "../Confirm.js";
import { newTruck, trailer as trailerLines, usedTruck, type Lines } from "../../confirmspecs.js";
import { inFirstMonth, leasedNo, nextWeeklyCheckDay, truckPlace } from "../../figures.js";
import { PENDING } from "../../copy-pending.js";
import { fleetCaps } from "../../figures.js";
import { CAPS, DOOR } from "../../copy.js";
import { expediteOn } from "@lanes/engine";
import { partsBeforeOrder, expediteLines, waitSentence } from "../../expediteui.js";

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
  const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  // R7: every truck order counts the fleet's caps first; a cap that binds disables it with its words (orders included).
  const caps = fleetCaps(w, c);
  const capWhy = caps.running + (onLease ? 0 : 1) > caps.cap ? (caps.binding.kind === "yard" ? DOOR.yardFull(caps.cap, caps.running + 1) : DOOR.capFull(CAPS.binding[caps.binding.kind](caps.cap), caps.running + 1)) : null;
  const roomWhy = rigRoom <= 0 ? DOOR.yardTrailer(trailerCap(w, c), ownTrailers + 1) : null;
  const lifeMi = w.cfg.assets.tractor.lifeMi;
  const life = lifeMi % 1_000_000 === 0 ? `${lifeMi === 1_000_000 ? "a million" : `${lifeMi / 1_000_000} million`} miles` : `${Math.round(lifeMi / 1000)}k miles`;
  const usedTrailers = openListings(w).filter((l) => l.trailerId > 0 && l.sellerId !== c.id).slice(0, 8);
  const offers = openLeaseOffers(w).filter((o) => o.lessorId !== c.id).sort((a, b) => a.weeklyFd - b.weeklyFd).slice(0, 8);
  const open = dealershipsOpen(w);
  const uw = w.cfg.token.catalogue.usdWindow;
  const dollarWindow = !tokenLive(w) && w.cfg.token.enabled && uw.enabled && uw.assets.enabled && !inFirstMonth(w, c);
  return (
    <>
      <p class="muted small">
        New equipment comes from the factory each month. {open.length ? `${open.length} player dealership${open.length > 1 ? "s" : ""} sell it from stock in ${w.cfg.businesses.kinds.dealership.deliveryDays} days; the NPC dealer is the backstop at ${Math.round((w.cfg.assets.factory.npcPremium - 1) * 100)}% over list and a longer wait.` : "The NPC dealer sells it at list until a player opens a dealership."} Tractors take {w.cfg.assets.tractor.maxRebuilds} rebuilds or {life}, then run until they're worn out and go for scrap.
      </p>
      {w.cfg.usedMarket.npcLot.enabled ? (
        <>
          <h3>The used lot</h3>
          <p class="muted small">
            Worn rigs at their used value: a Workhorse about {lotSpec(w, "van").odometer.toLocaleString("en-US")} miles and {Math.round((w.t / w.cfg.time.gameMinutesPerDay - lotSpec(w, "van").builtDay) / 365)} years old. {PENDING.lotCondition(pct(condition(w.cfg, { lease: "owned", milesSinceRebuild: lotSpec(w, "van").milesSinceRebuild })))}. {w.usedLot.stock} on the lot this week; {PENDING.lotReadyNote}.
          </p>
          {TYPES.map((tr) => (
            <div id={`lot-${tr}`} key={tr}>
            <Buy
              what={`Workhorse + ${TRAILER_NAME[tr]}`}
              // Client batch 7 (QA): an order, said as one, with "(replaces your lease)" as the new rigs' buttons carry it.
              verb={PENDING.orderVerb}
              label={PENDING.lotButton(onLease)}
              price={lotPrice(w, "workhorse", tr) * npcDealerMult(w)}
              replacing={onLease}
              block={w.usedLot.stock < 1 ? DEALER.whyLotEmpty : capWhy ?? roomWhy}
              action={{ type: "buy_asset", tier: "workhorse", trailer: tr, replaceNpcLease: onLease, used: true }}
              // Client batch 6 (QA): the engine's own lot wait for this buyer (dealerships.ts lotDeliveryDays): the NPC
              // dealer's queue for a starter replacing its lease, the lot's own days for a rig that adds to a fleet.
              when={DEALER.arrives(shortDate(today + lotDeliveryDays(w, onLease)))}
              ordered={lotDeliveryDays(w, onLease) > 0}
              lines={orderLines(usedTruck(w, c, { ...lotSpec(w, tr), tier: "workhorse", trailer: tr, lease: "owned" }), shortDate(today + lotDeliveryDays(w, onLease)), onLease, w.cfg.assets.swapAtNextIdle, onLease ? leasedNo(w, c) : null)}
              truck={collateralOf(w, lotSpec(w, tr))}
              ok={PENDING.lotOrdered(lotDeliveryDays(w, onLease))}
            />
            </div>
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
            <div id={`new-${tier}-${tr}`} key={`${tier}-${tr}`}>
            <Card>
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
                block={!rigLeft ? DEALER.whySupply : capWhy ?? roomWhy}
                action={{ type: "buy_asset", tier, trailer: tr, replaceNpcLease: onLease, dealershipId: rig.dealershipId || undefined }}
                when={DEALER.arrives(shortDate(today + rig.days))}
                ordered={rig.days > 0}
                lines={newTruck(w, tier, tr, rig.days)}
                truck={NEW_TRUCK}
                ok={PENDING.orderedReady(plural(rig.days, "day"))}
              />
              {/* Client batch 8b section D: the second button, an order delivered early, beside the NPC dealer's order. */}
              {(() => {
                if (!expediteOn(w) || rig.dealershipId || rig.days <= 0) return null;
                const parts = partsBeforeOrder(w, c, { kind: "rig", tier, trailer: tr, priceFd: rig.price, dueDay: today + rig.days, replaceNpcLease: onLease });
                if (!parts) return null;
                const q = { readyDay: parts.readyDay, daysSaved: parts.daysSaved, feeFd: parts.feeFd, priceFd: rig.price };
                return (
                  <Btn
                    sm
                    disabled={!rigLeft || capWhy !== null || roomWhy !== null}
                    onClick={(ev) =>
                      confirmAct(
                        {
                          verb: PENDING.orderVerb,
                          item: `${TIER_NAME[tier]} + ${TRAILER_NAME[tr]}`,
                          costFd: rig.price + parts.feeFd,
                          does: expediteLines(q, today + rig.days).join(" "),
                          risk: waitSentence(w, c, parts),
                          go: PENDING.expediteButton(shortDate(parts.readyDay), fdFull(parts.feeFd)),
                          run: () => act({ type: "buy_asset", tier, trailer: tr, replaceNpcLease: onLease, expedite: true }, PENDING.expediteDone(shortDate(parts.readyDay))),
                        },
                        ev,
                      )
                    }
                  >
                    {PENDING.expediteButton(shortDate(parts.readyDay), fdFull(parts.feeFd))}
                  </Btn>
                );
              })()}
              <div class="row">
                {/* Client batch 8b items 26 and 64 (the director's J): on a first-truck screen the dollar price is plain
                    text under the FD button, never a button; elsewhere a button. "To the launch pool" goes. */}
                {dollarWindow && !rig.dealershipId ? (
                  !myTrucks().some((t) => t.lease === "owned") ? (
                    <span class="muted small">{PENDING.orUsd(`$${assetPriceUsd(w, rig.price).toLocaleString("en-US", { maximumFractionDigits: 0 })}`)}</span>
                  ) : (
                    <Btn disabled={!(c.usd.wallet >= assetPriceUsd(w, rig.price) && rigLeft && trailerRoom > 0)} onClick={() => act({ type: "buy_asset", tier, trailer: tr, replaceNpcLease: onLease, pay: "usd" }, PENDING.orderedReadyUsd(plural(rig.days, "day")))}>
                      {PENDING.orUsd(`$${assetPriceUsd(w, rig.price).toLocaleString("en-US", { maximumFractionDigits: 0 })}`)}
                    </Btn>
                  )
                ) : null}
              </div>
              {tr === "van" ? (
                <Buy
                  what={`${TIER_NAME[tier]} tractor alone${spares ? ` (${spares} spare${spares > 1 ? "s" : ""} in the yard)` : ""}`}
                  price={tractor.price}
                  replacing={onLease}
                  block={tractor.dealershipId || w.supply.tractor[tier] > 0 ? capWhy : DEALER.whySupply}
                  action={{ type: "buy_asset", tier, trailer: tr, replaceNpcLease: onLease, tractorOnly: true, dealershipId: tractor.dealershipId || undefined }}
                  when={DEALER.arrives(shortDate(today + tractor.days))}
                  ordered={tractor.days > 0}
                  lines={newTruck(w, tier, tr, tractor.days)}
                  truck={NEW_TRUCK}
                  ok="Tractor ordered. It hooks a spare from your yard, or a rental"
                />
              ) : null}
            </Card>
            </div>
          );
        }),
      )}
      <h3 id="dealer-trailers">Trailers alone</h3>
      <p class="muted small">
        Room for {Math.max(0, trailerRoom)} more of your own. {c.yard === "none" ? "Without a yard, only as many trailers as tractors." : "Spares wait in the yard; swap at your home hub."}
      </p>
      <div class="row">
        {TYPES.map((tr) => {
          const src = bestSource(w, c.id, "trailer", "workhorse", tr);
          const left = src.dealershipId ? true : w.supply.trailer[tr] > 0;
          return (
            <Btn key={tr} disabled={!(cash >= src.price && left && trailerRoom > 0)} onClick={(ev) => confirmAct({ verb: "Buy", item: `a ${TRAILER_NAME[tr].toLowerCase()} trailer`, costFd: src.price, ...trailerLines(tr), run: () => act({ type: "buy_trailer", trailer: tr, dealershipId: src.dealershipId || undefined }, PENDING.trailerOrderedReady(src.days)) }, ev)}>
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
                {TRAILER_NAME[tr.type]} · {PENDING.conditionSince(pct(trailerCondition(w, tr)))} · {Math.round(tr.odometer / 1000)}k mi · asking <Num>{fd(l.askFd)}</Num> (value {fd(trailerValue(w, tr))})
              </span>
              <Btn sm disabled={cash < l.askFd || trailerRoom <= 0} onClick={(ev) => confirmAct({ verb: "Buy", item: `this ${TRAILER_NAME[tr.type].toLowerCase()}`, costFd: l.askFd, ...trailerLines(tr.type), run: () => act({ type: "buy_listing", listingId: l.id }, "Bought: it's in your yard") }, ev)}>
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
                {TIER_NAME[t.tier]} · {PENDING.conditionSince(pct(condition(w.cfg, t)))} · {Math.round(t.odometer / 1000)}k mi · {PENDING.truckIn(truckPlace(w, t.place))} · <Num>{fd(o.weeklyFd)}</Num> FD a week, {o.minWeeks} weeks minimum · from {owner?.name ?? "?"} (value {fd(truckValue(w, t))})
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
/** The used lot's confirm lines with the order's day and, for a starter, the lease's end at the hand-over (client batch 7). */
const orderLines = (base: Lines, date: string, replacing: boolean, swap = false, n: number | null = null): Lines => ({ ...base, does: `${base.does} ${PENDING.lotOrderNote(date, replacing, swap, n)}` });

/** `ordered`: the truck comes on a later day (the dealer's queue or the lot's wait), so it's an order, not a truck owned today. */
export function Buy({ what, label, verb = "Buy", price, replacing, block, action, ok, lines, when, truck, ordered = false }: { what: string; label?: string; verb?: string; price: number; replacing: boolean; block: string | null; action: Extract<Action, { type: "buy_asset" }> | Extract<Action, { type: "buy_listing" }>; ok: string; lines: Lines; when?: string; truck?: Collateral; ordered?: boolean }): JSX.Element {
  const w = S.game!.w;
  const c = me();
  const [open, setOpen] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  // The loan sheet opens below the row: on a phone that's below the fold, so bring it into view (QA's R6 replay).
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) sheet.current?.scrollIntoView({ block: "nearest" });
  }, [open]);
  // equipmentFinance.purchase.collateral: the lender reads this truck (age and miles); past its caps, cash only.
  const p = buyPlan(w, c, price, replacing, truck);
  // The reasons use the sheet's net figures (QA's Dealer re-check): what's needed after the lease deposit, against cash alone.
  const cash = p.have - p.deposit;
  // Client batch 8b item 5: with the lease's hold counted, the figure is the cash after it, said so.
  const cashWhy = block ?? (p.cashOk ? null : p.deposit > 0.5 ? PENDING.whyCashAfterHold(fd(cash), fd(p.cashNowFd), fd(p.deposit)) : DEALER.whyCash(fd(cash), fd(p.cashNowFd)));
  const loanWhy = !p.loan ? null : block ?? (p.loan.why === "full" ? DEALER.whyLoans(purchaseTerms(w, c, truck).maxLoans) : p.loan.why === "short" ? DEALER.whyLoan(fd(p.loanNowFd ?? 0), fd(cash)) : null);
  const ef = w.cfg.equipmentFinance.purchase;
  // Iuliia's line for the purchase: the first truck of its own, or one more (iuliia-lines.md, Dealer). Client batch 8a
  // item 2 (QA): buyFirst ("Yours. The lessor's cut ends today…") is for a truck owned that day; an order gets the
  // "Truck ordered" caption alone.
  const first = !(myTrucks().some((t) => t.lease === "owned") || ordersOf(w, c.id).length);
  const said = ordered ? (first ? null : "dealer:buyLater") : first ? "dealer:buyFirst" : "dealer:buyLater";
  // R6: every truck bought asks first, on the card: what leaves cash now, what's left, what it is and its one risk.
  const ask = (a: typeof action, ev: MouseEvent) =>
    confirmAct({ verb, item: what, costFd: a.finance ? p.loanNowFd ?? 0 : p.cashNowFd, ...lines, run: () => void go(a) }, ev);
  const go = async (a: typeof action) => {
    const r = await order(a, ok);
    if (!r.ok) return setRefused(r.reason);
    setRefused(null);
    setOpen(false);
    toast(ok);
    if (said) iuliiaSay(said);
  };
  return (
    <div class="stack buy">
      <div class="row">
        <Btn primary disabled={cashWhy !== null} onClick={(ev) => ask(action, ev)}>
          {label ?? what} · {fd(price)}
        </Btn>
        {p.loan && !block ? (
          <Btn onClick={() => setOpen(!open)} on={open}>
            {ordered ? PENDING.orderOnLoan : DEALER.onLoan}
          </Btn>
        ) : null}
      </div>
      {when ? <p class="small">{when}</p> : null}
      {/* The row's figures, tappable without opening the loan sheet (QA's guidance replay). */}
      <p class="small">
        {DEALER.price} <Fig k="dealer.price" label={DEALER.price}>{`${fd(price)} FD`}</Fig>
        {p.loan ? (
          <>
            {" · "}
            {DEALER.now} <Fig k="loan.cashNow" label={DEALER.now} ctx={{ fd: price, replacing, truck }}>{`${fd(p.loanNowFd ?? 0)} FD`}</Fig>
            {" · "}
            {DEALER.down} <Fig k="loan.downPayment" label={DEALER.down}>{`${fd(p.loan.down)} FD`}</Fig>
          </>
        ) : null}
      </p>
      {cashWhy ? <p class="muted small">{cashWhy}</p> : null}
      {p.cashOnly && !block ? <p class="muted small">{PENDING_RULES.cashOnly(p.cashOnly, fd(p.cashNowFd))}</p> : null}
      {refused ? <p class="bad small">{refused}</p> : null}
      {open && p.loan ? (
        <div ref={sheet}>
        <Card title={ordered ? PENDING.orderLoanTitle(what) : DEALER.loanTitle(what)}>
          <Kv
            rows={[
              [DEALER.price, <Fig k="dealer.price" label={DEALER.price}>{`${fd(price)} FD`}</Fig>],
              [DEALER.tax, `${fd(p.tax)} FD`],
              [DEALER.down, <Fig k="loan.downPayment" label={DEALER.down}>{`${fd(p.loan.down)} FD`}</Fig>],
              [DEALER.loan, `${fd(p.loan.loanFd)} FD`],
              [DEALER.stake, DEALER.stakeValue(fd(p.loan.stake))],
              [DEALER.weekly, <Fig k="loan.rate" label={DEALER.weekly}>{DEALER.weeklyValue(fd(p.loan.weekly), p.loan.termWeeks, `${(p.loan.weeklyRate * 100).toFixed(2)}%`)}</Fig>],
              // Client batch 8a item 22: the first payment's day, and that payments run while an ordered truck waits.
              [PENDING.loanFirstLabel, PENDING.loanFirstValue(shortDate(nextWeeklyCheckDay(w)), ordered)],
              ...(p.deposit > 0.5 ? ([[DEALER.deposit, DEALER.depositValue(fd(p.deposit))]] as [string, string][]) : []),
              [DEALER.now, <Fig k="loan.cashNow" label={DEALER.now} ctx={{ fd: price, replacing, truck }}>{`${fd(p.loanNowFd ?? 0)} FD`}</Fig>],
            ]}
          />
          <p class="warn small">{DEALER.missed(ef.missedToDefault)}</p>
          <div class="row">
            <Btn primary disabled={loanWhy !== null} onClick={(ev) => ask({ ...action, finance: true }, ev)}>
              {ordered ? PENDING.orderLoanButton(fd(p.loanNowFd ?? 0)) : DEALER.buyLoan(fd(p.loanNowFd ?? 0))}
            </Btn>
            <Btn ghost onClick={() => setOpen(false)}>
              {DEALER.cancel}
            </Btn>
          </div>
          {loanWhy ? <p class="muted small">{loanWhy}</p> : null}
        </Card>
        </div>
      ) : null}
    </div>
  );
}
