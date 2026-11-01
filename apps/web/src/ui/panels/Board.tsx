import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { MANUAL_BID_MAX_DEADHEAD_MI, VETTING_NAMES, type Truck } from "@lanes/engine";
import { COMMODITIES } from "@lanes/data";
import { bidRange, boardRows, sortRows, type BoardRow, type BoardSort } from "../../board.js";
import { BOARD, LOAD, ROUND } from "../../copy.js";
import { cls, fdFull, hhmm, pct, shortDate, TRAILER_NAME } from "../../format.js";
import { nextRoundHour, nextRoundLabel, nextRoundWait, reloadLabel, roundProgress, seasonSwing } from "../../logic.js";
import { bumpData, isPhone, me, myTrucks, order, S, selectTruck, setOnboard, setTab, toast, truckNo, useData } from "../../state.js";
import { tabOpen } from "../../tabs.js";
import { Btn, Card, Kv } from "../bits.js";
import { LoadsTable } from "./Loads.js";

/**
 * The board (specs/first-ten-minutes.md, S2–S5): load cards with the profit chip, three sorts and a filter, blocked
 * loads last with their reason; a card opens the load's sheet with Book now and a stepped bid; a bid in stays pinned
 * at the top with a ring to the round, and the round's result takes its place until OK. The numbers come from
 * board.ts, on the one break-even (breakeven.ts). The laptop keeps the DAT table behind "Table".
 */
export function Loads(): JSX.Element {
  useData();
  const [table, setTable] = useState(false);
  const [sort, setSort] = useState<BoardSort>("nearest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [dest, setDest] = useState("any");
  const [maxDh, setMaxDh] = useState(Math.min(300, MANUAL_BID_MAX_DEADHEAD_MI));
  const [query, setQuery] = useState("");
  // The first visit sorts loads that pay at book-now first; leaving the board ends the first visit.
  const firstVisit = !S.onboard.boardVisited;
  useEffect(() => () => {
    if (!S.onboard.boardVisited) setOnboard({ boardVisited: true });
  }, []);
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
      </div>
    );
  }
  const rows = boardRows(w, c, truck, { dest, maxDh, query });
  const open = S.openLoad !== null ? rows.find((r) => r.l.id === S.openLoad) : undefined;
  if (open) return <LoadSheet r={open} truck={truck} />;
  const pending = w.manualBids.get(truck.id);
  const pinned = pending ? rows.find((r) => r.l.id === pending.loadId) : undefined;
  const sorted = sortRows(rows, sort, firstVisit).filter((r) => r !== pinned);
  const takeable = rows.filter((r) => !r.block).length;
  const hub = w.net.places[truck.place]!.name;
  return (
    <div class="stack">
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
      <div class="row">
        <div class="seg" role="group" aria-label="Sort">
          {(["nearest", "pay", "deliver"] as const).map((k) => (
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
            <select id="bdest" value={dest} onChange={(ev) => setDest((ev.currentTarget as HTMLSelectElement).value)}>
              <option value="any">{BOARD.anywhere}</option>
              {w.net.hubs.map((h) => (
                <option value={h.id} key={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
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
      {sorted.length ? (
        <div class="loadcards">
          {sorted.slice(0, 60).map((r) => (
            <LoadCard key={r.l.id} r={r} name={name} />
          ))}
        </div>
      ) : (
        <div class="stack">
          <p class="muted">{BOARD.nothing(TRAILER_NAME[truck.trailer].toLowerCase(), maxDh, hub, nextRoundHour())}</p>
          <div class="row">
            <Btn
              onClick={() => {
                setDest("any");
                setQuery("");
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
function etaOf(t: Truck): string | null {
  const l = t.loadId !== null ? S.game!.w.loads.get(t.loadId) : undefined;
  return l ? `${shortDate(Math.floor(l.appointmentT / 1440))} ${hhmm(l.appointmentT)}` : null;
}
/** Opens a load's sheet: full on a phone (S3). */
function openLoad(id: number | null): void {
  S.openLoad = id;
  if (id !== null && isPhone()) S.sheet = "full";
  bumpData();
}

function Chips({ r }: { r: BoardRow }): JSX.Element {
  if (r.block) return <span class="chip muted">{r.block}</span>;
  const up = r.profitBook >= 0;
  return (
    <>
      <span class={cls("chip", up ? "good" : "bad")}>{BOARD.chipBook(money(r.profitBook), up)}</span>
      {!up && r.profitSuggest > 0 ? <span class="chip muted">{BOARD.chipSuggest(money(r.profitSuggest), r.suggest.toFixed(2))}</span> : null}
    </>
  );
}

function LoadCard({ r, name }: { r: BoardRow; name: (i: number) => string }): JSX.Element {
  const { l } = r;
  return (
    <button type="button" class={cls("loadcard", r.block && "blocked")} onClick={() => openLoad(l.id)} title={`${name(l.origin)} → ${name(l.dest)}`}>
      <span class="l1">{BOARD.line1(place(l.originPlace), place(l.destPlace), Math.round(l.miles).toLocaleString("en-US"))}</span>
      <span class="l2 small">{BOARD.line2(fdFull(r.total), l.bookNow.toFixed(2), Math.round(r.dh))}</span>
      <span class="chips">
        <Chips r={r} />
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
  if (r.ok) toast(ROUND.toastWithdrawn);
  else toast(r.reason, true);
}

/** The round's result for a hand bid, until OK or the next bid (S5). */
function ResultCard({ onBidAgain }: { onBidAgain?: () => void }): JSX.Element | null {
  const res = S.result;
  if (!res) return null;
  const w = S.game!.w;
  const name = (i: number) => w.net.hubs[i]!.name;
  const close = () => {
    S.result = null;
    bumpData();
  };
  return (
    <Card class={cls("resultcard", res.won ? "won" : "lost")}>
      <p>
        {res.won
          ? ROUND.won(name(res.origin), name(res.dest), res.rate.toFixed(2), fdFull(res.total))
          : res.winning !== null
            ? ROUND.lost(res.winning.toFixed(2), res.rate.toFixed(2), res.be.toFixed(2))
            : ROUND.nobody(res.rate.toFixed(2))}
      </p>
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
  const [bid, setBid] = useState(Math.min(hi, Math.max(lo, bidHere ? mine!.rate : r.suggest)));
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const k = COMMODITIES[l.commodity]!;
  const poster = l.brokerId !== null ? w.companies[l.brokerId - 1] : l.shipperId !== null ? w.companies[l.shipperId - 1] : null;
  const bidProfit = (bid - r.be) * l.miles;
  const bookUp = r.profitBook >= 0;
  const signed = (x: number) => `${x >= 0 ? "+" : "−"}${money(x)}`;
  const step = (d: number) => setBid(Math.round(Math.min(hi, Math.max(lo, bid + d)) * 100) / 100);
  const sent = (at: number | null) => (at !== null ? setNote({ text: LOAD.sent(hhmm(at)), bad: false }) : undefined);
  const book = async () => {
    const res = await order({ type: "book_load", truckId: truck.id, loadId: l.id }, ROUND.toastBooked);
    if (!res.ok) return setNote({ text: res.reason, bad: true });
    sent(res.at);
    toast(res.at === null ? ROUND.toastBooked : ROUND.booked(w.net.hubs[l.origin]!.name, w.net.hubs[l.dest]!.name, fdFull(r.total)));
    S.openLoad = null;
    S.sheet = "half";
    setTab("fleet");
  };
  const placeBid = async () => {
    const res = await order({ type: "place_bid", truckId: truck.id, loadId: l.id, rate: bid }, ROUND.toastBid(bid.toFixed(2), nextRoundHour()));
    if (!res.ok) return setNote({ text: res.reason, bad: true });
    S.handBids.set(l.id, { rate: bid, be: r.be });
    S.result = null;
    toast(ROUND.toastBid(bid.toFixed(2), nextRoundHour()));
    S.openLoad = null;
    S.sheet = "half";
    bumpData();
  };
  const op = w.net.places[l.originPlace]!;
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
            [LOAD.pickUp, `${op.name}, ${op.state} · now`],
            [LOAD.deliverBy, `${shortDate(Math.floor(l.appointmentT / 1440))} ${hhmm(l.appointmentT)} · ${place(l.destPlace)}`],
            [LOAD.miles, LOAD.milesValue(Math.round(l.miles).toLocaleString("en-US"), Math.round(r.dh))],
            [LOAD.driving, `${l.routeHours.toFixed(1)} h`],
            [LOAD.reloadAt(w.net.hubs[l.dest]!.name), LOAD.reloadValue(reloadLabel(l.dest, l.equipment), Math.round(r.reloadMi))],
          ]}
        />
      </Card>
      <Card title={LOAD.money}>
        <Kv
          rows={[
            [LOAD.bookNow, `${fdFull(r.total)} FD · ${l.bookNow.toFixed(2)}/mi`],
            [LOAD.breakEven, `${r.be.toFixed(2)}/mi`],
            [LOAD.profitBook, <span class={bookUp ? "good" : "bad"}>{signed(r.profitBook)} FD</span>],
            [LOAD.clearsNear, `${l.refRate.toFixed(2)}/mi`],
            [LOAD.ceiling, `${l.ceiling.toFixed(2)}/mi`],
          ]}
        />
      </Card>
      <Card title={LOAD.shipper}>
        {poster ? <p class="small">{poster.name}</p> : null}
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
        {r.block ? <p class="bad small">{LOAD.blocked(r.block)}</p> : null}
        <Btn primary={bookUp} disabled={!!r.block} onClick={() => void book()}>
          {LOAD.bookButton(l.bookNow.toFixed(2), signed(r.profitBook))}
        </Btn>
        <div class="row stepper">
          <Btn sm disabled={!!r.block || bid <= lo} onClick={() => step(-0.05)} title="Bid 0.05 lower">
            −
          </Btn>
          <span class="num bidval">{bid.toFixed(2)}</span>
          <Btn sm disabled={!!r.block || bid >= hi} onClick={() => step(0.05)} title="Bid 0.05 higher">
            +
          </Btn>
          <span class="muted small">{LOAD.range(lo.toFixed(2), hi.toFixed(2))}</span>
        </div>
        <div class="row">
          <Btn primary={!bookUp} disabled={!!r.block} onClick={() => void placeBid()}>
            {bidHere ? LOAD.changeBid : LOAD.bidButton(signed(bidProfit))}
          </Btn>
          {bidHere ? (
            <Btn ghost onClick={() => void withdraw(truck)}>
              {LOAD.withdraw}
            </Btn>
          ) : null}
        </div>
        {note ? <p class={cls("small", note.bad && "bad")}>{note.text}</p> : null}
      </div>
    </div>
  );
}
