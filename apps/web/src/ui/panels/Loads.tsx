import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { crewed, dispatchProfile, expectedReloadDeadheadMi, isLocal, operatingTrucks, localOnly, MANUAL_BID_MAX_DEADHEAD_MI, ownerDrawFd, placeMiles, placeToll, VETTING_NAMES, type Load, type Truck } from "@lanes/engine";
import { COMMODITIES } from "@lanes/data";
import { allInRate, bidCeiling, bidFiles, bidRange, blockReason, chipPair, clampToCeiling, clearsNear, overCeiling, rateShown, suggestBid } from "../../board.js";
import { ANSWER } from "../../copy.js";
import { BOARD } from "../../copy.js";
import { DockWarning, ProfitChip } from "../ProfitChip.js";
import { trueBreakEven } from "../../breakeven.js";
import { cls, fd, fdFull, hhmm, pct, shortDate, TRAILER_CODE, TRAILER_NAME } from "../../format.js";
import { nextRoundLabel, openLoadsAt, reloadClass, reloadLabel, SeasonNote, seasonSwing, statusText } from "../../logic.js";
import { act, bumpData, me, myTrucks, S, selectTruck, toast, useData } from "../../state.js";
import { PENDING } from "../../copy-pending.js";
import { Btn, Card, Kv, Num, Panel } from "../bits.js";
import { SCENES } from "../../assets.js";
import { Portrait, Scene } from "../Loop.js";

/**
 * The load board as a table, laid out like DAT One (the laptop's "Table" toggle on the board, ui/panels/Board.tsx):
 * a search bar, a dense sortable results table, and a row that opens into the load's Trip, Rate and Company detail.
 */

type SortKey = "rate" | "permi" | "age" | "trip" | "dh" | "pickup";

interface Row {
  l: Load;
  dh: number;
  be: number;
  suggest: number | null;
  /** Profit at the suggested bid; null with no suggestion. */
  profit: number | null;
  profitBook: number;
  reloadMi: number;
  tolls: number;
  highway: number;
  hours: number;
  total: number;
  ageH: number;
  block: string | null;
  /** A bid by hand is filed for the locals-first hold's opening round (board.ts bidFiles). */
  files: boolean;
}

export function LoadsTable(): JSX.Element {
  useData();
  const g = S.game!;
  const w = g.w;
  const trucks = myTrucks();
  const idle = trucks.filter((t) => t.status === "idle");
  const truck = trucks.find((t) => t.id === S.selTruck && t.status === "idle") ?? idle[0];
  const [sort, setSort] = useState<SortKey>("rate");
  const [desc, setDesc] = useState(true);
  const [dest, setDest] = useState("any");
  const [maxDh, setMaxDh] = useState(MANUAL_BID_MAX_DEADHEAD_MI);
  const [query, setQuery] = useState("");
  const sortBy = (k: SortKey) => {
    if (k === sort) setDesc(!desc);
    else {
      setSort(k);
      setDesc(k === "rate" || k === "permi");
    }
  };
  const th = (k: SortKey, label: string) => (
    <th class={cls("sortable", sort === k && "sorted")} onClick={() => sortBy(k)}>
      {label}
      {sort === k ? (desc ? " ↓" : " ↑") : ""}
    </th>
  );

  const search = (
    <Card>
      <div class="searchbar">
        <div class="field">
          <span class="label">Truck</span>
          <select value={truck?.id ?? ""} onChange={(ev) => selectTruck(Number((ev.currentTarget as HTMLSelectElement).value))}>
            {trucks.map((t, i) => (
              <option value={t.id} key={t.id} disabled={t.status !== "idle"}>
                Truck {i + 1} · {TRAILER_NAME[t.trailer]}
                {t.status === "idle" ? "" : ` · ${statusText(t)}`}
              </option>
            ))}
          </select>
        </div>
        <div class="field">
          <span class="label">Origin</span>
          <input type="text" readOnly value={truck ? `${w.net.places[truck.place]!.name}, ${w.net.places[truck.place]!.state}` : "—"} />
        </div>
        <div class="field">
          <span class="label">Empty miles, max</span>
          <input type="number" min="0" max={MANUAL_BID_MAX_DEADHEAD_MI} value={maxDh} onInput={(ev) => setMaxDh(Math.max(0, Math.min(MANUAL_BID_MAX_DEADHEAD_MI, Number((ev.currentTarget as HTMLInputElement).value) || 0)))} />
        </div>
        <div class="field">
          <span class="label">Destination</span>
          <select value={dest} onChange={(ev) => setDest((ev.currentTarget as HTMLSelectElement).value)}>
            <option value="any">Anywhere</option>
            {w.net.hubs.map((h) => (
              <option value={h.id} key={h.id}>
                {h.name} ({h.id}) market
              </option>
            ))}
          </select>
        </div>
        <div class="field">
          <span class="label">Equipment</span>
          <input type="text" readOnly value={truck ? TRAILER_NAME[truck.trailer] : "—"} />
        </div>
        <div class="field">
          <span class="label">Commodity or place</span>
          <input type="text" placeholder="e.g. produce, Tulsa" value={query} onInput={(ev) => setQuery((ev.currentTarget as HTMLInputElement).value)} />
        </div>
      </div>
    </Card>
  );

  if (!truck) {
    return (
      <Panel title="Load board">
      <Scene name="truckstop" still={SCENES.truckstop} alt="The truck stop" />
        {search}
        <p class="muted">No idle trucks right now. Loads show here when a truck is free at a hub.</p>
        {S.selHub !== null ? <HubLoadsTable hub={S.selHub} /> : null}
      </Panel>
    );
  }

  // The board's arithmetic (breakeven.ts, board.ts), so this table and the cards never disagree (market truth).
  const prof = dispatchProfile(w, me(), operatingTrucks(w, me().id));
  const pending = w.manualBids.get(truck.id);
  const sent = g.kind === "live" ? g.pending().find((r) => r.a.type === "place_bid" && r.a.truckId === truck.id) : undefined;
  const q = query.trim().toLowerCase();
  const rows: Row[] = [];
  for (const l of w.loads.values()) {
    if (l.status !== "open" || l.equipment !== truck.trailer || l.brokerId === me().id) continue;
    if (l.tenderedTo !== 0 && l.tenderedTo !== me().id) continue; // someone else's contract tender
    const dh = placeMiles(w, truck.place, l.originPlace);
    if (dh > maxDh) continue;
    if (dest !== "any" && w.net.hubs[l.dest]!.id !== dest) continue;
    const op = w.net.places[l.originPlace]!;
    const dp = w.net.places[l.destPlace]!;
    const k = COMMODITIES[l.commodity]!;
    if (q && ![k.name, op.name, op.state, dp.name, dp.state].some((s) => s.toLowerCase().includes(q))) continue;
    const reloadMi = expectedReloadDeadheadMi(w, l.dest, l.equipment, prof.foresightDays); // as the sheet's (board.ts): one figure
    const lane = w.net.lanes[l.laneId]!;
    const tolls = placeToll(w, truck.place, l.originPlace) + l.routeTollFd;
    const be = trueBreakEven(w, truck, l, dh, placeToll(w, truck.place, l.originPlace), prof.foresightDays, prof.reloadWeight);
    const suggest = suggestBid(w, l, be);
    const block = blockReason(w, me(), truck, l); // the board's one reason (R22), the same words as the cards
    rows.push({ l, dh, be, suggest, profit: suggest === null ? null : (suggest - be) * l.miles, profitBook: (l.bookNow - be) * l.miles, reloadMi, tolls, highway: lane.highwayShare, hours: l.routeHours, total: l.bookNow * l.miles, ageH: l.roundsUnfilled * 12, block, files: bidFiles(w, me(), truck, l) });
  }
  const key = (r: Row): number => (sort === "rate" ? r.total : sort === "permi" ? r.l.bookNow : sort === "age" ? r.ageH : sort === "trip" ? r.l.miles : sort === "dh" ? r.dh : r.l.appointmentT);
  rows.sort((a, b) => (desc ? key(b) - key(a) : key(a) - key(b)));
  const shown = rows.slice(0, 60);

  return (
    <Panel title="Load board" right={pending ? <Btn sm onClick={() => act({ type: "cancel_bid", truckId: truck.id }, "Bid withdrawn")}>Withdraw bid {pending.rate.toFixed(2)}/mi</Btn> : null}>
      <Scene name="truckstop" still={SCENES.truckstop} alt="The truck stop" />
      {search}
      <div class="results-head">
        <b>{rows.length} results</b>
        <span class="muted">
          {TRAILER_NAME[truck.trailer]} loads within {maxDh} mi of {w.net.places[truck.place]!.name} · bids clear at {nextRoundLabel()}
        </span>
        {sent && sent.a.type === "place_bid" ? (
          <span class="warn">
            Bid on its way: {sent.a.rate.toFixed(2)}/mi, in at {hhmm(sent.at)}.
          </span>
        ) : null}
        {pending ? <span class="good">Bid in: {pending.rate.toFixed(2)}/mi</span> : null}
      </div>
      {shown.length ? (
        <table class="loads-table">
          <thead>
            <tr>
              {th("age", "Age")}
              {th("rate", "Rate")}
              {th("trip", "Trip")}
              <th>Lane</th>
              {th("dh", "Empty")}
              {th("pickup", "Deliver by")}
              <th>Eq</th>
              <th>Load</th>
              <th>Profit</th>
              <th>Company</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <LoadRow key={r.l.id} r={r} truck={truck} mine={pending?.loadId === r.l.id} pendingRate={pending?.rate} />
            ))}
          </tbody>
        </table>
      ) : (
        <p class="muted">
          No {TRAILER_NAME[truck.trailer].toLowerCase()} loads match within {maxDh} miles right now. Widen the search, send the truck to a busier hub, or wait for the next round.
        </p>
      )}
      {/* board.refuseOverCeiling (live): a bid over the ceiling is refused, so the line follows the switch (client batch 4). */}
      <p class="muted small">{w.cfg.board.refuseOverCeiling ? PENDING.tableHowRefused : "Book now and the load is yours at once. Or bid and wait for the round: the poster takes the best bid under its ceiling, weighing price, on-time record and empty miles; a bid above the ceiling wins only if nobody bid under it. One bid per truck per round; yours replaces your dispatcher's."}</p>
    </Panel>
  );
}

function poster(l: Load): { name: string; kind: string; rep: number | null; onTime: string } {
  const w = S.game!.w;
  const c = l.brokerId !== null ? w.companies[l.brokerId - 1] : l.shipperId !== null ? w.companies[l.shipperId - 1] : null;
  if (!c) return { name: "Shipper", kind: "Shipper", rep: null, onTime: "—" };
  return { name: c.name, kind: l.brokerId !== null ? "Broker" : "Player shipper", rep: c.reputation, onTime: c.delivered ? pct(c.onTime / c.delivered) : "—" };
}

function LoadRow({ r, truck, mine, pendingRate }: { r: Row; truck: Truck; mine: boolean; pendingRate: number | undefined }): JSX.Element {
  const w = S.game!.w;
  const { l } = r;
  const op = w.net.places[l.originPlace]!;
  const dp = w.net.places[l.destPlace]!;
  const k = COMMODITIES[l.commodity]!;
  const p = poster(l);
  const open = S.openLoad === l.id;
  const toggle = () => {
    S.openLoad = open ? null : l.id;
    bumpData();
  };
  return (
    <>
      <tr class={cls("clickable", open && "open", mine && "you")} onClick={toggle}>
        <td class="num">{r.ageH === 0 ? "new" : `${r.ageH}h`}</td>
        <td>
          <div class="rate-big">{fdFull(r.total)} FD</div>
          {/* Client batch 7: each rate holds together, so the cell wraps at most once, between them. */}
          <div class="num muted">
            {BOARD.rpms(rateShown(l, l.bookNow), allInRate(r.total, l.miles, r.dh))
              .split(" · ")
              .map((part, i) => (
                <span key={i} class="nobreak">
                  {i ? " · " : ""}
                  {part}
                </span>
              ))}
          </div>
        </td>
        <td class="num">{l.miles}</td>
        <td>
          <div class="lane">
            ● {op.name}, {op.state}
          </div>
          <div class="lane">
            ○ {dp.name}, {dp.state}
          </div>
        </td>
        <td class="num">{r.dh}</td>
        <td class="num">
          {shortDate(Math.floor(l.appointmentT / 1440))} {hhmm(l.appointmentT)}
        </td>
        <td class="num">{TRAILER_CODE[l.equipment]}</td>
        <td>
          <div>{k.name}</div>
          <div class="muted small">{fd(l.cargoValue)} FD cargo{l.hot > 0 ? " · hot" : ""}</div>
          {localOnly(w, l) ? <div class={cls("small", isLocal(w, me(), l.origin) ? "good" : "warn")}>local shippers first this round</div> : null}
          {l.tenderedTo === me().id ? <div class="small good">your contract tender · {(w.contracts.find((x) => x.id === l.contractId)?.ratePerMile ?? 0).toFixed(2)}/mi · accept by {hhmm(l.tenderUntil)}</div> : null}
        </td>
        <td>{r.block ? <span class="chip muted">{r.block}</span> : <ProfitChip p={chipPair(w, truck, r.profitBook, r.total, ownerDrawFd(w, truck, r.l.miles + r.dh))} />}</td>
        <td>
          <div class="row" style={{ flexWrap: "nowrap" }}>
            <Portrait who={l.brokerId !== null ? "broker" : "dockworker"} sm />
            <div>
              <div class="accent">{p.name}</div>
              <div class="muted small">
                {p.kind} · {VETTING_NAMES[l.vet].toLowerCase()} vetting
              </div>
            </div>
          </div>
        </td>
        <td>
          <div class="num">{p.rep !== null ? pct(p.rep) : "—"}</div>
          <div class="muted small">{p.onTime} on time</div>
        </td>
      </tr>
      {open ? (
        <tr class="open">
          <td colSpan={11}>
            <LoadDetail r={r} truck={truck} mine={mine} pendingRate={pendingRate} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function LoadDetail({ r, truck, mine, pendingRate }: { r: Row; truck: Truck; mine: boolean; pendingRate: number | undefined }): JSX.Element {
  const w = S.game!.w;
  const { l } = r;
  const op = w.net.places[l.originPlace]!;
  const dp = w.net.places[l.destPlace]!;
  const o = w.net.hubs[l.origin]!;
  const d = w.net.hubs[l.dest]!;
  const k = COMMODITIES[l.commodity]!;
  const p = poster(l);
  // Client batch 8a item 46: a truck with no driver can't book (said under the button, never refused after the tap).
  const noDriver = !crewed(truck);
  const off = Boolean(r.block) || noDriver;
  // leverage.localHoldHandBids: Book now stays shut through the hold; a bid is filed for its opening round.
  const bidOff = off && !r.files;
  const bidId = `bid-${l.id}`;
  const placeBid = () => {
    // Client batch 7: a typed bid within a cent above the shown ceiling is the shown ceiling (board.ts clampToCeiling).
    const rate = clampToCeiling(l, Number((document.getElementById(bidId) as HTMLInputElement).value));
    if (!Number.isFinite(rate) || rate <= 0) return toast(PENDING.bidEmpty, true); // an empty field places nothing (pass 2b)
    // Client batch 8a item 4: more than a cent over the shown ceiling is refused in words, and nothing is placed.
    if (overCeiling(l, rate)) return toast(ANSWER.ceiling(bidCeiling(l).toFixed(2)), true);
    // Client batch 8a item 61: a bid under break-even goes in, with the loss said.
    const loss = rate < r.be - 0.005 ? ` ${PENDING.bidUnderBreakEven(fdFull((r.be - rate) * l.miles))}` : "";
    act({ type: "place_bid", truckId: truck.id, loadId: l.id, rate }, `Bid in at ${rate.toFixed(2)}/mi. It clears at ${nextRoundLabel()}.${loss}`);
    // A hand bid from the table is a hand bid too: the round's result card (main.tsx, the lostBid and won events and the
    // load leaving the board) reads this record (the trucker's laptop bid lost with no word).
    S.handBids.set(l.id, { rate, be: r.be, truckId: truck.id, from: op.name, to: dp.name, ...(r.files ? { filed: true } : {}) });
  };
  // Client batch 6 (QA, laptop at 1024×768): the actions sat at the foot of the third column, the bid field about 164 px
  // below the window. They lead now, one row under the heading, and the opened row brings them into view if it must.
  const acts = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = acts.current;
    if (el && typeof el.scrollIntoView === "function") requestAnimationFrame(() => el.scrollIntoView({ block: "nearest" }));
  }, [l.id]);
  return (
    <div class="stack">
      {off ? null : <DockWarning w={w} t={truck} l={l} dh={r.dh} />}
      <div class="results-head">
        <b>
          {op.name}, {op.state} <span class="accent">→</span> {dp.name}, {dp.state}
        </b>
        <span class="muted">{l.miles} mi</span>
        {r.block ? <span class="bad">Not for you yet: {r.block}.</span> : noDriver ? <span class="bad">{PENDING.bookNeedsDriver}</span> : null}
      </div>
      <div class="row loadacts" ref={acts}>
        <Btn primary disabled={off} onClick={() => act({ type: "book_load", truckId: truck.id, loadId: l.id }, "Booked. The truck is on its way")}>
          Book now · {rateShown(l, l.bookNow)}
        </Btn>
        <input type="number" id={bidId} step="0.01" min="0.5" max={bidCeiling(l).toFixed(2)} defaultValue={mine && pendingRate !== undefined ? pendingRate.toFixed(2) : r.suggest !== null ? r.suggest.toFixed(2) : ""} aria-label="Your bid per mile" disabled={bidOff} />
        <Btn on={mine} disabled={bidOff} onClick={placeBid}>
          {mine ? "Change bid" : "Bid"}
        </Btn>
      </div>
      <div class="detail">
        <div>
          <h4>Trip</h4>
          <div class="timeline">
            <div>
              <b>
                {op.name}, {op.state}
              </b>{" "}
              <span class="muted">({r.dh} mi empty first)</span>
            </div>
            <div class="muted small">pick up now · {o.id} market</div>
            <div>
              <b>
                {dp.name}, {dp.state}
              </b>
            </div>
            <div class="muted small">
              deliver by {shortDate(Math.floor(l.appointmentT / 1440))} {hhmm(l.appointmentT)} · {d.id} market
            </div>
          </div>
          <Kv
            rows={[
              ["Equipment", TRAILER_NAME[l.equipment]],
              ["Commodity", <>{k.name}{k.spoilHours !== null ? <span class="warn"> · spoils {k.spoilHours} h after</span> : null}</>],
              ["Cargo value", <Num>{fd(l.cargoValue)} FD</Num>],
              ["Driving", <>{r.hours.toFixed(1)} h{r.highway >= 0.05 ? <span class="warn"> · {pct(r.highway)} two-lane</span> : " · interstate"}</>],
              ["Tolls", r.tolls > 0 ? <span class="warn">{fd(r.tolls)} FD</span> : "none"],
              ["Reload at " + d.id, <><span class={reloadClass(l.dest, l.equipment)}>{reloadLabel(l.dest, l.equipment)}</span> · about {Math.round(r.reloadMi)} mi empty to the next load</>],
              ["Season", Math.abs(seasonSwing(l.origin, l.equipment)) < 0.05 ? "normal" : <SeasonNote hub={l.origin} eq={l.equipment} />],
            ]}
          />
        </div>
        <div>
          <h4>Rate</h4>
          <Kv
            rows={[
              ["Book now", <span class="rate-big">{fdFull(r.total)} FD</span>],
              ["Rate / mile", <Num>{rateShown(l, l.bookNow)}</Num>],
              ["Your break-even", <Num>{r.be.toFixed(2)}/mi</Num>],
              ["Profit at book-now", <Num class={r.profitBook > 0 ? "good" : "bad"}>{fd(r.profitBook)} FD</Num>],
              ["Raised", l.roundsUnfilled > 0 ? <span class="warn">{l.roundsUnfilled} round{l.roundsUnfilled > 1 ? "s" : ""} running</span> : "not yet"],
            ]}
          />
          <h4 style={{ marginTop: "10px" }}>Market rates</h4>
          <Kv
            rows={[
              ["Usually clears near", <Num>{rateShown(l, clearsNear(w, l))}/mi</Num>],
              ["Ceiling", <Num>{bidCeiling(l).toFixed(2)}/mi</Num>],
              ["Bid range", <Num>{bidRange(w, l, r.be).map((x) => x.toFixed(2)).join(" – ")}</Num>],
              ["Profit at your bid", r.profit === null ? PENDING.bidBookBetter : <Num class={r.profit > 0 ? "good" : "bad"}>{fd(r.profit)} FD</Num>],
            ]}
          />
          <p class="muted small">{w.cfg.board.refuseOverCeiling ? PENDING.ceilingRefused : "A bid above the ceiling wins only if nobody bids under it."}</p>
        </div>
        <div>
          <h4>Company</h4>
          <Kv
            rows={[
              ["Poster", <span class="accent">{p.name}</span>],
              ["Type", p.kind],
              ["Reputation", p.rep !== null ? <Num>{pct(p.rep)}</Num> : "—"],
              ["On time", p.onTime],
              ["Requires", `${VETTING_NAMES[l.vet]} vetting`],
              ["Load", `#${l.id}${l.brokerId !== null ? " · brokered" : ""}${l.shipperId !== null ? " · player shipper" : ""}`],
              ...(localOnly(w, l) ? ([["Local first", <span class={isLocal(w, me(), l.origin) ? "good" : "warn"}>{isLocal(w, me(), l.origin) ? "you count as local" : "held for local carriers this round"}</span>]] as [string, JSX.Element][]) : []),
              ...(l.tenderedTo === me().id ? ([["Your tender", <span class="good">{(w.contracts.find((x) => x.id === l.contractId)?.ratePerMile ?? 0).toFixed(2)}/mi · accept by {hhmm(l.tenderUntil)}</span>]] as [string, JSX.Element][]) : []),
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export function HubLoadsTable({ hub }: { hub: number }): JSX.Element {
  const w = S.game!.w;
  const h = w.net.hubs[hub]!;
  const all = openLoadsAt(hub);
  const loads = [...all].sort((a, b) => b.ceiling - a.ceiling).slice(0, 12);
  return (
    <Card title={`${h.name} (${h.id})`}>
      <p class="muted">
        Load-to-truck ratio {w.lastRatio[hub]!.toFixed(2)} · {all.length} open loads
      </p>
      <table>
        <thead>
          <tr>
            <th>To</th>
            <th>Equip</th>
            <th>Miles</th>
            <th>Book now</th>
            <th>Max</th>
          </tr>
        </thead>
        <tbody>
          {loads.map((l) => (
            <tr key={l.id}>
              <td>{w.net.hubs[l.dest]!.id}</td>
              <td>{TRAILER_NAME[l.equipment]}</td>
              <td class="num">{l.miles}</td>
              <td class="num">{rateShown(l, l.bookNow)}</td>
              <td class="num">{bidCeiling(l).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
