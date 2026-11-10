import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { crewed, hubMiles, MANUAL_BID_MAX_DEADHEAD_MI, VETTING_NAMES, type Truck } from "@lanes/engine";
import { COMMODITIES } from "@lanes/data";
import { allInRate, bidCeiling, bidRange, boardRows, clampToCeiling, chipCash, chipPair, clearsNear, dockWaits, overCeiling, posterOf, rateShown, sortRows, type BoardRow, type BoardSort, type ChipPair } from "../../board.js";
import { DockWarning, ProfitChip } from "../ProfitChip.js";
import { ANSWER, BOARD, CHIP, DELIVERED, INTEL, LOAD, ROUND, WALL } from "../../copy.js";
import { cls, fdFull, hhmm, pct, shortDate, TRAILER_NAME, weekdayDate } from "../../format.js";
import { nextRoundHour, nextRoundLabel, nextRoundWait, reloadLabel, roundProgress, seasonSwing } from "../../logic.js";
import { bumpData, isPhone, markVisited, me, myTrucks, openIntel, order, S, selectTruck, setTab, toast, truckNo, useData, visited } from "../../state.js";
import { deliveryEtaMin } from "../../rolling.js";
import { tabOpen } from "../../tabs.js";
import { iuliiaFirst, iuliiaOnChange, iuliiaSay, iuliiaSayText } from "../../iuliia.js";
import { PENDING_RULES } from "../../copy-pending-rules.js";
import { Btn, Card, Kv } from "../bits.js";
import { LoadsTable } from "./Loads.js";
import { Fig } from "../Explain.js";
import { PENDING } from "../../copy-pending.js";
import { WaysOutCard } from "../WaysOut.js";

/**
 * The board (specs/first-ten-minutes.md, S2–S5): load cards with the profit chip, three sorts and a filter, blocked
 * loads last with their reason; a card opens the load's sheet with Book now and a stepped bid; a bid in stays pinned
 * at the top with a ring to the round, and the round's result takes its place until OK. The numbers come from
 * board.ts, on the one break-even (breakeven.ts). The laptop keeps the DAT table behind "Table".
 */
/** R22: the board's one line when every load in view is closed to the truck for the same reason. */
function wallLineOf(rows: BoardRow[]): JSX.Element | null {
  if (!rows.length || !rows.every((r) => r.block)) return null;
  const reason = rows[0]!.block!;
  return rows.every((r) => r.block === reason) ? <p class="small warn wallline">{WALL.everyLoad(reason)}</p> : null;
}

export function Loads(): JSX.Element {
  useData();
  const [table, setTable] = useState(false);
  // R22's "See the ways out" (until R23) opens the board once on its sort.
  const [sort, setSort] = useState<BoardSort>(() => {
    const once = S.boardSortOnce;
    S.boardSortOnce = null;
    return once ?? "nearest";
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [dest, setDest] = useState("");
  const [minRpm, setMinRpm] = useState(0);
  const [maxMiles, setMaxMiles] = useState(0);
  const [maxDh, setMaxDh] = useState(Math.min(300, MANUAL_BID_MAX_DEADHEAD_MI));
  const [query, setQuery] = useState("");
  // The first visit sorts loads that pay at book-now first; leaving the board ends the first visit.
  const firstVisit = !visited("board");
  useEffect(() => () => markVisited("board"), []);
  if (table && !isPhone()) {
    return (
      <div class="stack">
        <div class="row">
          <Btn sm on onClick={() => setTable(false)}>
            {BOARD.table}
          </Btn>
        </div>
        <LoadsTable />
      </div>
    );
  }
  const g = S.game!;
  const w = g.w;
  const c = me();
  const trucks = myTrucks();
  const idle = trucks.filter((t) => t.status === "idle");
  const truck = trucks.find((t) => t.id === S.selTruck && t.status === "idle") ?? idle[0];
  const name = (i: number) => w.net.hubs[i]!.name;
  if (S.result) S.result.seen = true;

  if (!truck) {
    const t = trucks[0];
    const eta = t ? etaOf(t) : null;
    return (
      <div class="stack">
        <ResultCard />
        <p class="muted">{BOARD.busy(eta ?? "—")}</p>
        {S.boardPoster ? <PosterLoads poster={S.boardPoster} /> : null}
      </div>
    );
  }
  const rows = boardRows(w, c, truck, { dest, maxDh, query, minRpm, maxMiles, poster: S.boardPoster });
  // After the render, not in it: her line bumps the data, and the board has early returns before any hook could go here.
  const empty = rows.length === 0;
  queueMicrotask(() => iuliiaOnChange(`board:${truck.id}`, empty, empty ? "board:empty" : null));
  const posterName = S.boardPoster ? w.companies[S.boardPoster - 1]?.name ?? "" : null;
  const open = S.openLoad !== null ? rows.find((r) => r.l.id === S.openLoad) : undefined;
  if (open) return <LoadSheet r={open} truck={truck} />;
  const pending = w.manualBids.get(truck.id);
  const pinned = pending ? rows.find((r) => r.l.id === pending.loadId) : undefined;
  const sorted = sortRows(rows, sort, firstVisit).filter((r) => r !== pinned);
  const takeable = rows.filter((r) => !r.block).length;
  const hub = w.net.places[truck.place]!.name;
  // The ways-out sheet: the exits head the board while the truck it was opened for stands idle here.
  const out = S.waysOut === truck.id;
  if (S.waysOut !== null && !out) S.waysOut = null;
  return (
    <div class="stack">
      {out ? <WaysOutCard t={truck} /> : null}
      {out ? <h3 class="label">{PENDING.waysOutBoard}</h3> : null}
      {/* Client batch 8a item 46: a truck with no driver can't book; its board says so first. */}
      {!crewed(truck) ? <p class="bad small">{PENDING.boardNeedsDriver(truckNo(truck.id))}</p> : null}
      <ResultCard onBidAgain={() => setSort("clears")} />
      {pinned && pending ? <PinnedBid r={pinned} rate={pending.rate} truck={truck} /> : null}
      <div class="boardhead">
        <b>{BOARD.header(hub, takeable, nextRoundLabel())}</b>
        {trucks.length >= 2 ? (
          <select value={truck.id} onChange={(ev) => selectTruck(Number((ev.currentTarget as HTMLSelectElement).value))} aria-label="Truck">
            {trucks.map((t) => (
              <option value={t.id} key={t.id} disabled={t.status !== "idle"}>
                {BOARD.truck(truckNo(t.id), TRAILER_NAME[t.trailer])}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {/* R22: when every load in reach fails the same wall, one line says it above the cards. */}
      {wallLineOf(rows)}
      {posterName !== null ? <PosterChip name={posterName} /> : null}
      {posterName !== null && !rows.length ? <p class="muted small">{BOARD.noneFromPoster(posterName)}</p> : null}
      <div class="row">
        <div class="seg" role="group" aria-label="Sort">
          {(["nearest", "pay", "hot"] as const).map((k) => (
            <Btn key={k} sm on={sort === k} onClick={() => setSort(k)}>
              {BOARD.sorts[k]}
            </Btn>
          ))}
        </div>
        <Btn sm on={filterOpen} onClick={() => setFilterOpen(!filterOpen)}>
          {BOARD.filter}
        </Btn>
        <Btn sm class="laptop-only" onClick={() => setTable(true)}>
          {BOARD.table}
        </Btn>
      </div>
      {filterOpen ? (
        <Card>
          <div class="field">
            <label class="label" for="bdest">
              {BOARD.destination}
            </label>
            <input id="bdest" type="text" placeholder={BOARD.destPlaceholder} value={dest} onInput={(ev) => setDest((ev.currentTarget as HTMLInputElement).value)} />
          </div>
          <div class="row">
            <div class="field grow">
              <label class="label" for="brpm">
                {BOARD.minRpm}
              </label>
              <input id="brpm" type="number" min="0" step="0.05" placeholder="any" value={minRpm || ""} onInput={(ev) => setMinRpm(Number((ev.currentTarget as HTMLInputElement).value) || 0)} />
            </div>
            <div class="field grow">
              <label class="label" for="bmiles">
                {BOARD.maxMiles}
              </label>
              <input id="bmiles" type="number" min="0" step="50" placeholder="any" value={maxMiles || ""} onInput={(ev) => setMaxMiles(Number((ev.currentTarget as HTMLInputElement).value) || 0)} />
            </div>
          </div>
          <div class="field">
            <label class="label" for="bdh">
              {BOARD.maxEmpty} · {maxDh}
            </label>
            <input id="bdh" type="range" min="0" max={MANUAL_BID_MAX_DEADHEAD_MI} step="10" value={maxDh} onInput={(ev) => setMaxDh(Number((ev.currentTarget as HTMLInputElement).value))} />
          </div>
          <div class="field">
            <label class="label" for="bq">
              {BOARD.query}
            </label>
            <input id="bq" type="text" placeholder={BOARD.queryPlaceholder} value={query} onInput={(ev) => setQuery((ev.currentTarget as HTMLInputElement).value)} />
          </div>
          {tabOpen("rates", w, c) ? (
            <div class="row">
              <Btn sm ghost onClick={() => setTab("rates")}>
                {BOARD.ratesByHub}
              </Btn>
            </div>
          ) : null}
        </Card>
      ) : null}
      {sort === "hot" && sorted.length && !sorted.some((r) => r.heat >= 1.5) ? <p class="muted small">{BOARD.noHot}</p> : null}
      {sorted.length ? (
        <div class="loadcards">
          {sorted.slice(0, 60).map((r) => (
            <LoadCard key={r.l.id} r={r} truck={truck} name={name} />
          ))}
        </div>
      ) : (
        <div class="stack">
          <p class="muted">{BOARD.nothing(TRAILER_NAME[truck.trailer].toLowerCase(), maxDh, hub, nextRoundHour())}</p>
          <div class="row">
            <Btn
              onClick={() => {
                setDest("");
                setQuery("");
                setMinRpm(0);
                setMaxMiles(0);
              }}
            >
              {BOARD.widen}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

const place = (i: number): string => {
  const p = S.game!.w.net.places[i]!;
  return `${p.name}, ${p.state}`;
};
const money = (x: number): string => fdFull(Math.abs(x));
/** The busy line's ETA: the delivery's, as the Truck card reads it (rolling.ts), never the deliver-by (QA row 18). */
function etaOf(t: Truck): string | null {
  const w = S.game!.w;
  const l = t.loadId !== null ? w.loads.get(t.loadId) : undefined;
  if (!l) return null;
  const at = deliveryEtaMin(w, t, me(), l);
  return `${shortDate(Math.floor(at / 1440))} ${hhmm(at)}`;
}
/** Opens a load's sheet: full on a phone (S3). */
function openLoad(id: number | null): void {
  S.openLoad = id;
  if (id !== null && isPhone()) S.sheet = "full";
  bumpData();
}

/** The pair at book-now for a board row (the row's own profit and hold). */
export const bookPair = (r: BoardRow): ChipPair => ({ profit: r.profitBook, cash: r.profitBook - r.heldBook + r.draw, held: r.heldBook, draw: r.draw });

function Chips({ r }: { r: BoardRow; truck: Truck }): JSX.Element {
  if (r.block) return <span class="chip muted">{r.block}</span>;
  const up = r.profitBook >= 0;
  return (
    <>
      <ProfitChip p={bookPair(r)} />
      {!up && r.suggest !== null && r.profitSuggest !== null && r.profitSuggest > 0 ? <span class="chip muted">{BOARD.chipSuggest(money(r.profitSuggest), r.suggest.toFixed(2))}</span> : null}
    </>
  );
}

function LoadCard({ r, truck, name }: { r: BoardRow; truck: Truck; name: (i: number) => string }): JSX.Element {
  const { l } = r;
  return (
    <button type="button" class={cls("loadcard", r.block && "blocked")} onClick={() => openLoad(l.id)} title={`${name(l.origin)} → ${name(l.dest)}`}>
      <span class="l1">{BOARD.line1(place(l.originPlace), place(l.destPlace), Math.round(l.miles).toLocaleString("en-US"))}</span>
      <span class="l2 small">{BOARD.line2(fdFull(r.total), rateShown(l, l.bookNow), allInRate(r.total, l.miles, r.dh), Math.round(r.dh))}</span>
      <span class="chips">
        <Chips r={r} truck={truck} />
        {r.heat >= 1.5 ? <span class="chip good">{BOARD.hotTo(name(l.dest))}</span> : r.heat >= 1.1 ? <span class="chip">{BOARD.tightTo(name(l.dest))}</span> : null}
      </span>
    </button>
  );
}

/** A bid in, pinned at the top of the board with a ring that fills to the round (S4). */
function PinnedBid({ r, rate, truck }: { r: BoardRow; rate: number; truck: Truck }): JSX.Element {
  const p = roundProgress();
  return (
    <Card class="pinned-bid">
      <div class="row">
        <span class="ring" style={{ background: `conic-gradient(var(--accent) ${Math.round(p * 360)}deg, var(--border) 0deg)` }} aria-hidden="true" />
        <span class="small">{ROUND.pinned(rate.toFixed(2), nextRoundHour(), nextRoundWait())}</span>
      </div>
      <button type="button" class="loadcard" onClick={() => openLoad(r.l.id)}>
        <span class="l1">{BOARD.line1(place(r.l.originPlace), place(r.l.destPlace), Math.round(r.l.miles).toLocaleString("en-US"))}</span>
      </button>
      <div class="row">
        <Btn sm onClick={() => void withdraw(truck)}>
          {LOAD.withdraw}
        </Btn>
      </div>
    </Card>
  );
}

async function withdraw(truck: Truck): Promise<void> {
  const r = await order({ type: "cancel_bid", truckId: truck.id }, ROUND.toastWithdrawn);
  if (r.ok) {
    toast(ROUND.toastWithdrawn);
    iuliiaSay("load:withdraw");
  }
  else toast(r.reason, true);
}

/** The round's result for a hand bid, until OK or the next bid (S5). */
function ResultCard({ onBidAgain }: { onBidAgain?: () => void }): JSX.Element | null {
  const res = S.result;
  if (!res) return null;
  const close = () => {
    S.result = null;
    bumpData();
  };
  return (
    <Card class={cls("resultcard", res.won ? "won" : "lost")}>
      <p>
        {res.won
          ? ROUND.won(res.from, res.to, res.rate.toFixed(2), fdFull(res.total))
          : res.winning !== null
            ? ROUND.lost(res.winning.toFixed(2), res.rate.toFixed(2), res.be.toFixed(2))
            : ROUND.nobody(res.rate.toFixed(2))}
      </p>
      {!res.won && res.winnerId ? (
        <button type="button" class="linkrow" onClick={() => openIntel({ card: res.winnerId })}>
          {INTEL.lostTo(S.game!.w.companies[res.winnerId - 1]?.name ?? "", (res.winning ?? 0).toFixed(2))}
        </button>
      ) : null}
      <div class="row">
        {res.won ? (
          <Btn primary onClick={close}>
            {ROUND.ok}
          </Btn>
        ) : (
          <Btn
            primary
            onClick={() => {
              close();
              onBidAgain?.();
            }}
          >
            {ROUND.bidAgain}
          </Btn>
        )}
      </div>
    </Card>
  );
}

/** The load's sheet (S3): route, money, shipper, the fold, and Book now and the bid pinned at the bottom. */
function LoadSheet({ r, truck }: { r: BoardRow; truck: Truck }): JSX.Element {
  useData();
  const g = S.game!;
  const w = g.w;
  const { l } = r;
  const [lo, hi] = bidRange(w, l, r.be);
  const mine = w.manualBids.get(truck.id);
  const bidHere = mine?.loadId === l.id;
  // The field holds the player's bid in, else the suggestion, else nothing (pass 2b): never a bid placed for them.
  const start = bidHere ? mine!.rate : r.suggest;
  const [bid, setBid] = useState<number | null>(start === null ? null : Math.min(hi, Math.max(lo, start)));
  const bidState = bid;
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  // Iuliia on the sheet's first opening in a sitting: a blocked load has its own line (iuliia-lines.md, Loads).
  useEffect(() => iuliiaFirst(r.block ? "load:blocked" : "load:open", r.block ? "screen:loadBlocked" : "screen:load"), []);
  const k = COMMODITIES[l.commodity]!;
  const poster = l.brokerId !== null ? w.companies[l.brokerId - 1] : l.shipperId !== null ? w.companies[l.shipperId - 1] : null;
  const bidProfit = bid === null ? 0 : (bid - r.be) * l.miles;
  // The bid's controls: shut with the load's wall, open through a locals-first hold's last round (filed for the opening).
  const bidShut = !!r.block && !r.files;
  // The engine's reach for a bid by hand is market to market (actions.ts place_bid, hubMiles), where Book now's is the
  // truck's own town to the pickup: said before the press, not refused after it (the gamer: 243 mi empty, "more than 300").
  // One rule for both is the engine's (the batch's report).
  const bidOut = !w.cfg.board.bidReachFromTown && hubMiles(w, truck.hub, l.origin) > MANUAL_BID_MAX_DEADHEAD_MI;
  // The bid's own pair (R14): the sheet's money rows are at book-now, so the button carries its cash itself.
  const bidHeld = bid === null ? 0 : chipPair(w, truck, bidProfit, bid * l.miles, r.draw).held;
  const bookUp = r.profitBook >= 0;
  const signed = (x: number) => `${x >= 0 ? "+" : "−"}${money(x)}`;
  // From an empty field the first step starts at the first rate above Book now in the range.
  const step = (d: number) => setBid(Math.round(Math.min(hi, Math.max(lo, bid === null ? Math.max(lo, l.bookNow + 0.05) : bid + d)) * 100) / 100);
  // Under a bid above Book now: what it pays over Book now if it wins at the round, and what beats it. With no suggestion
  // and no such bid typed: Iuliia's word that booking is the better call here. No odds: the engine computes none.
  // Client batch 8a item 61: under break-even the loss is said; where loads like this clear under the player's break-even,
  // that in place of the gamble line.
  const clears = clearsNear(w, l);
  const betLine = bid !== null && bid < r.be - 0.005 ? PENDING.bidUnderBreakEven(fdFull((r.be - bid) * l.miles)) : clears < r.be ? PENDING.laneUnderBreakEven(rateShown(l, clears), r.be.toFixed(2)) : bid !== null && bid > l.bookNow + 0.005 ? PENDING.bidGamble(fdFull((bid - l.bookNow) * l.miles), nextRoundHour(), rateShown(l, l.bookNow)) : r.suggest === null ? PENDING.bidBookBetter : null;
  // The bid figure while it's being typed; null when it shows the bid.
  const [bidText, setBidText] = useState<string | null>(null);
  // R20: a refusal in the writer's words where the engine's reason is a vetting block; otherwise the engine's own.
  const refusal = (reason: string): string => {
    // board.refuseOverCeiling: the engine's "above the ceiling, {rate}/mi", in the writer's words (R20).
    if (/above the ceiling/i.test(reason)) return ANSWER.ceiling(bidCeiling(l).toFixed(2));
    if (!/vetting rules you out|won't load a carrier with/.test(reason) || !/authority|loads delivered/.test(reason)) return reason;
    const k = w.cfg.fraud.vetting;
    const age = Math.floor(w.t / w.cfg.time.gameMinutesPerDay) - me().authority.since;
    return l.vet === 1 ? ANSWER.bookVettingStd(k.standard.minAuthorityDays, age) : ANSWER.bookVetting(k.strict.minAuthorityDays, k.strict.minDelivered, age, me().delivered);
  };
  const sent = (at: number | null) => (at !== null ? setNote({ text: LOAD.sent(hhmm(at)), bad: false }) : undefined);
  const book = async () => {
    S.bookedLoads.add(l.id);
    S.handLoads.add(l.id);
    const res = await order({ type: "book_load", truckId: truck.id, loadId: l.id }, ROUND.toastBooked);
    if (!res.ok) return setNote({ text: refusal(res.reason), bad: true });
    iuliiaSay("load:book");
    sent(res.at);
    toast(res.at === null ? ROUND.toastBooked : ROUND.booked(w.net.places[l.originPlace]!.name, w.net.places[l.destPlace]!.name, fdFull(r.total)));
    S.openLoad = null;
    S.sheet = "half";
    setTab("fleet");
  };
  const placeBid = async () => {
    // A figure still being typed counts as typed (the press can come before the field's blur), held to the range.
    const typed = bidText !== null ? Number(bidText.replace(",", ".")) : NaN;
    // Client batch 8a item 4 (QA): as the laptop table does, more than a cent over the shown ceiling is refused in words
    // and nothing is placed; within a cent it's held to the ceiling. Never lowered without a word.
    if (Number.isFinite(typed) && typed > 0 && overCeiling(l, typed)) return setNote({ text: ANSWER.ceiling(bidCeiling(l).toFixed(2)), bad: true });
    // Under break-even is allowed (item 61), with the loss said under the field; only the ceiling holds it.
    const bid = Number.isFinite(typed) && typed > 0 ? Math.round(Math.min(hi, clampToCeiling(l, typed)) * 100) / 100 : bidState;
    if (bid === null) return;
    const answer = ANSWER.bid(bid.toFixed(2), w.net.places[l.originPlace]!.name, w.net.places[l.destPlace]!.name, nextRoundHour());
    const res = await order({ type: "place_bid", truckId: truck.id, loadId: l.id, rate: bid }, answer);
    if (!res.ok) return setNote({ text: refusal(res.reason), bad: true });
    // Filed for a locals-first load's opening round: the director's line, with its hub and hour.
    if (r.files) iuliiaSayText(PENDING_RULES.bidFiled(w.net.hubs[l.origin]!.name, nextRoundHour()));
    else iuliiaSay("load:bid");
    S.handBids.set(l.id, { rate: bid, be: r.be, truckId: truck.id, from: w.net.places[l.originPlace]!.name, to: w.net.places[l.destPlace]!.name, ...(r.files ? { filed: true } : {}) });
    S.handLoads.add(l.id);
    S.result = null;
    toast(answer);
    S.openLoad = null;
    S.sheet = "half";
    bumpData();
  };
  const op = w.net.places[l.originPlace]!;
  // The docks' own hours (board.ts dockWaits, which draws nothing): a shut pickup dock is when it loads, and a receiver
  // that opens after the appointment is when it's due (the receiver's hours move the due time; the diaries had
  // "Pick up · now" against a dock opening in 53 h, and "Deliver by Jan 14" against a receiver opening Jan 15).
  const docks = dockWaits(w, truck, l, r.dh);
  const at = (t: number) => `${weekdayDate(Math.floor(t / 1440))} ${hhmm(t)}`;
  const pickupWhen = docks.pickup ? PENDING.pickupWhenOpens(at(docks.pickup.openT)) : "now";
  const deliverBy = docks.delivery && docks.delivery.openT > l.appointmentT ? PENDING.deliverByOpens(at(docks.delivery.openT)) : `${shortDate(Math.floor(l.appointmentT / 1440))} ${hhmm(l.appointmentT)}`;
  // What this sheet's figures were computed from, for their explain sheets (explain.ts).
  const fx = { loadId: l.id, truckId: truck.id };
  const swing = seasonSwing(l.origin, l.equipment);
  return (
    <div class="stack loadsheet">
      <div class="row">
        <Btn sm ghost onClick={() => openLoad(null)}>
          ‹ {LOAD.back}
        </Btn>
      </div>
      <h3>{BOARD.line1(place(l.originPlace), place(l.destPlace), Math.round(l.miles).toLocaleString("en-US"))}</h3>
      <Card title={LOAD.route}>
        <Kv
          rows={[
            [LOAD.pickUp, `${op.name}, ${op.state} · ${pickupWhen}`],
            [LOAD.deliverBy, `${deliverBy} · ${place(l.destPlace)}`],
            [LOAD.miles, <Fig k="board.deadhead" label={LOAD.miles} ctx={fx}>{LOAD.milesValue(Math.round(l.miles).toLocaleString("en-US"), Math.round(r.dh))}</Fig>],
            [LOAD.driving, `${l.routeHours.toFixed(1)} h`],
            [LOAD.reloadAt(w.net.hubs[l.dest]!.name), LOAD.reloadValue(reloadLabel(l.dest, l.equipment), Math.round(r.reloadMi))],
          ]}
        />
      </Card>
      <Card title={LOAD.money}>
        <Kv
          rows={[
            [LOAD.bookNow, <Fig k="board.bookNow" label={LOAD.bookNow} ctx={fx}>{`${fdFull(r.total)} FD · ${BOARD.rpms(rateShown(l, l.bookNow), allInRate(r.total, l.miles, r.dh))}`}</Fig>],
            [LOAD.breakEven, <Fig k="truck.breakEven" label={LOAD.breakEven} ctx={fx}>{`${r.be.toFixed(2)}/mi`}</Fig>],
            [LOAD.profitBook, <Fig k="board.profitChip" label={LOAD.profitBook} ctx={fx}><span class={bookUp ? "good" : "bad"}>{`${signed(r.profitBook)} FD`}</span></Fig>],
            // R14: the pair, on the sheet, when the lease holds: cash now (amber when negative) and what's held.
            ...(r.heldBook >= 0.5
              ? ([
                  // R14's one arithmetic: the chip's cash, the owner's draw in it and said so in the pay card's words (the
                  // diaries: the chip counted the draw and this row didn't).
                  [CHIP.cashRow, <span class={bookPair(r).cash < -0.5 ? "warn" : undefined}>{`${chipCash(bookPair(r).cash)} FD`}{r.draw >= 0.5 ? <span class="muted small">{` · ${DELIVERED.drawNote(fdFull(r.draw))}`}</span> : null}</span>],
                  [CHIP.heldRow, <Fig k="money.held" label={CHIP.heldRow} ctx={fx}>{`${fdFull(r.heldBook)} FD`}</Fig>],
                ] as [string, JSX.Element][])
              : []),
            [LOAD.clearsNear, <Fig k="board.clearsNear" label={LOAD.clearsNear} ctx={fx}>{`${rateShown(l, clearsNear(w, l))}/mi`}</Fig>],
            [LOAD.ceiling, <Fig k="board.ceiling" label={LOAD.ceiling} ctx={fx}>{`${bidCeiling(l).toFixed(2)}/mi`}</Fig>],
          ]}
        />
      </Card>
      <Card title={LOAD.shipper}>
        {poster ? (
          <button type="button" class="linkrow" onClick={() => openIntel({ card: poster.id })}>
            {poster.name} ›
          </button>
        ) : null}
        <Kv
          rows={[
            [LOAD.onTime, poster && poster.delivered ? pct(poster.onTime / poster.delivered) : "—"],
            [LOAD.vetting, VETTING_NAMES[l.vet].toLowerCase()],
          ]}
        />
      </Card>
      <details class="fold">
        <summary>{LOAD.more}</summary>
        <Kv
          rows={[
            [LOAD.commodity, k.name],
            [LOAD.cargoValue, `${fdFull(l.cargoValue)} FD`],
            [LOAD.tolls, r.tolls > 0 ? `${fdFull(r.tolls)} FD` : LOAD.none],
            [LOAD.twoLane, pct(w.net.lanes[l.laneId]?.highwayShare ?? 0)],
            [LOAD.season, Math.abs(swing) < 0.05 ? "normal" : swing > 0 ? `in season +${pct(swing)}` : `off season −${pct(-swing)}`],
            ["", LOAD.loadNo(l.id)],
          ]}
        />
      </details>
      <div class="actions pinned">
        {/* leverage.localHoldHandBids: the hold's last round files a bid for the opening instead of the first-call wall. */}
        {r.files ? <p class="small">{PENDING_RULES.bidFilesFor(nextRoundHour())}</p> : r.block ? <p class="bad small">{LOAD.blocked(r.block.replace(/\.\s*$/, ""))}</p> : <DockWarning w={w} t={truck} l={l} dh={r.dh} />}
        {/* Client batch 8a item 46: shut with its reason when the truck has no driver, never refused after the tap. */}
        {!crewed(truck) ? <p class="bad small">{PENDING.bookNeedsDriver}</p> : null}
        <Btn primary={bookUp} disabled={!!r.block || !crewed(truck)} onClick={() => void book()}>
          {CHIP.book(rateShown(l, l.bookNow), signed(r.profitBook))}
        </Btn>
        <div class="row stepper">
          <Btn sm disabled={bidShut || (bid !== null && bid <= lo)} onClick={() => step(-0.05)} title="Bid 0.05 lower">
            −
          </Btn>
          {/* The figure is typed (the gamer: fifteen taps of ±); held to the range when it's left. */}
          <input
            type="text"
            inputMode="decimal"
            class="num bidval bidinput"
            aria-label={LOAD.bidButton("")}
            disabled={bidShut}
            value={bidText ?? (bid === null ? "" : bid.toFixed(2))}
            onInput={(e) => setBidText((e.currentTarget as HTMLInputElement).value)}
            onBlur={() => {
              const v = Number((bidText ?? "").replace(",", "."));
              // Client batch 8a items 4 and 61: over the ceiling is said and the field keeps the bid it had; under break-even
              // is kept, its loss said under the field.
              if (bidText !== null && Number.isFinite(v) && v > 0) {
                if (overCeiling(l, v)) setNote({ text: ANSWER.ceiling(bidCeiling(l).toFixed(2)), bad: true });
                else setBid(Math.round(Math.min(hi, clampToCeiling(l, v)) * 100) / 100);
              }
              setBidText(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            }}
          />
          <Btn sm disabled={bidShut || (bid !== null && bid >= hi)} onClick={() => step(0.05)} title="Bid 0.05 higher">
            +
          </Btn>
          <Fig k="board.bid" label={LOAD.bidButton("")} ctx={{ ...fx, fd: bid ?? undefined }}><span class="muted small">{LOAD.range(lo.toFixed(2), hi.toFixed(2))}</span></Fig>
        </div>
        <div class="row">
          <Btn primary={!bookUp && bid !== null} disabled={bidShut || bidOut || bid === null} onClick={() => void placeBid()}>
            {bidHere ? LOAD.changeBid : bidHeld >= 0.5 ? CHIP.bidAlone(signed(bidProfit), chipCash(bidProfit - bidHeld + r.draw)) : CHIP.bid(signed(bidProfit))}
          </Btn>
          {bidHere ? (
            <Btn ghost onClick={() => void withdraw(truck)}>
              {LOAD.withdraw}
            </Btn>
          ) : null}
        </div>
        {betLine && !bidShut ? <p class="small muted">{betLine}</p> : null}
        {bidOut && !bidShut ? <p class="small muted">{PENDING.bidReach(MANUAL_BID_MAX_DEADHEAD_MI)}</p> : null}
        {note ? <p class={cls("small", note.bad && "bad")}>{note.text}</p> : null}
      </div>
    </div>
  );
}

/** One poster's open loads, read-only, while no truck is free to take them (Intel's "Their loads on the board"). */
function PosterLoads({ poster }: { poster: number }): JSX.Element {
  const w = S.game!.w;
  const name = w.companies[poster - 1]?.name ?? "";
  const loads = [...w.loads.values()].filter((l) => l.status === "open" && posterOf(l) === poster).sort((a, b) => a.id - b.id);
  const place = (i: number) => w.net.places[i]!.name;
  return (
    <div class="stack">
      <PosterChip name={name} />
      {loads.map((l) => (
        <p key={l.id} class="small">
          {BOARD.line1(place(l.originPlace), place(l.destPlace), Math.round(l.miles).toLocaleString("en-US"))} · {rateShown(l, l.bookNow)}/mi
        </p>
      ))}
    </div>
  );
}

/** The board's filter to one poster: "Posted by {name}" and a ✕ that shows every load again. */
function PosterChip({ name }: { name: string }): JSX.Element {
  return (
    <div class="row">
      <span class="chip">{BOARD.fromPoster(name)}</span>
      <Btn
        sm
        label={BOARD.showEvery}
        onClick={() => {
          S.boardPoster = null;
          bumpData();
        }}
      >
        ✕
      </Btn>
    </div>
  );
}
