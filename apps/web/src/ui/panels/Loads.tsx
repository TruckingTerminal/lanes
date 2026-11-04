import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { dispatchProfile, expectedReloadDeadheadMi, isLocal, operatingTrucks, localOnly, MANUAL_BID_MAX_DEADHEAD_MI, placeMiles, placeToll, VETTING_NAMES, type Load, type Truck } from "@lanes/engine";
import { COMMODITIES } from "@lanes/data";
import { allInRate, bidRange, blockReason, chipPair, clearsNear, suggestBid } from "../../board.js";
import { BOARD } from "../../copy.js";
import { ProfitChip } from "../ProfitChip.js";
import { trueBreakEven } from "../../breakeven.js";
import { cls, fd, fdFull, hhmm, pct, shortDate, TRAILER_CODE, TRAILER_NAME } from "../../format.js";
import { nextRoundLabel, openLoadsAt, reloadClass, reloadLabel, SeasonNote, seasonSwing, statusText } from "../../logic.js";
import { act, bumpData, me, myTrucks, S, selectTruck, useData } from "../../state.js";
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
  suggest: number;
  profit: number;
  profitBook: number;
  reloadMi: number;
  tolls: number;
  highway: number;
  hours: number;
  total: number;
  ageH: number;
  block: string | null;
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
    const reloadMi = expectedReloadDeadheadMi(w, l.dest, l.equipment);
    const lane = w.net.lanes[l.laneId]!;
    const tolls = placeToll(w, truck.place, l.originPlace) + l.routeTollFd;
    const be = trueBreakEven(w, truck, l, dh, placeToll(w, truck.place, l.originPlace), prof.foresightDays, prof.reloadWeight);
    const suggest = suggestBid(w, l, be);
    const block = blockReason(w, me(), truck, l); // the board's one reason (R22), the same words as the cards
    rows.push({ l, dh, be, suggest, profit: (suggest - be) * l.miles, profitBook: (l.bookNow - be) * l.miles, reloadMi, tolls, highway: lane.highwayShare, hours: l.routeHours, total: l.bookNow * l.miles, ageH: l.roundsUnfilled * 12, block });
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
      <p class="muted small">Book now and the load is yours at once. Or bid and wait for the round: the poster takes the best bid under its ceiling, weighing price, on-time record and empty miles; a bid above the ceiling wins only if nobody bid under it. One bid per truck per round; yours replaces your dispatcher's.</p>
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
          <div class="num muted">{BOARD.rpms(l.bookNow.toFixed(2), allInRate(r.total, l.miles, r.dh))}</div>
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
        <td>{r.block ? <span class="chip muted">{r.block}</span> : <ProfitChip p={chipPair(w, truck, r.profitBook, r.total)} />}</td>
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
  const off = Boolean(r.block);
  const bidId = `bid-${l.id}`;
  const placeBid = () => {
    const rate = Number((document.getElementById(bidId) as HTMLInputElement).value);
    act({ type: "place_bid", truckId: truck.id, loadId: l.id, rate }, `Bid in at ${rate.toFixed(2)}/mi. It clears at ${nextRoundLabel()}`);
  };
  return (
    <div class="stack">
      <div class="results-head">
        <b>
          {op.name}, {op.state} <span class="accent">→</span> {dp.name}, {dp.state}
        </b>
        <span class="muted">{l.miles} mi</span>
        {r.block ? <span class="bad">Not for you yet: {r.block}.</span> : null}
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
              ["Rate / mile", <Num>{l.bookNow.toFixed(2)}</Num>],
              ["Your break-even", <Num>{r.be.toFixed(2)}/mi</Num>],
              ["Profit at book-now", <Num class={r.profitBook > 0 ? "good" : "bad"}>{fd(r.profitBook)} FD</Num>],
              ["Raised", l.roundsUnfilled > 0 ? <span class="warn">{l.roundsUnfilled} round{l.roundsUnfilled > 1 ? "s" : ""} running</span> : "not yet"],
            ]}
          />
          <h4 style={{ marginTop: "10px" }}>Market rates</h4>
          <Kv
            rows={[
              ["Usually clears near", <Num>{clearsNear(w, l).toFixed(2)}/mi</Num>],
              ["Ceiling", <Num>{l.ceiling.toFixed(2)}/mi</Num>],
              ["Bid range", <Num>{bidRange(w, l, r.be).map((x) => x.toFixed(2)).join(" – ")}</Num>],
              ["Profit at your bid", <Num class={r.profit > 0 ? "good" : "bad"}>{fd(r.profit)} FD</Num>],
            ]}
          />
          <p class="muted small">A bid above the ceiling wins only if nobody bids under it.</p>
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
          <div class="row" style={{ marginTop: "10px" }}>
            <Btn primary disabled={off} onClick={() => act({ type: "book_load", truckId: truck.id, loadId: l.id }, "Booked. The truck is on its way")}>
              Book now · {l.bookNow.toFixed(2)}
            </Btn>
          </div>
          <div class="row" style={{ marginTop: "8px" }}>
            <input type="number" id={bidId} step="0.01" min="0.5" max={l.ceiling.toFixed(2)} defaultValue={(mine && pendingRate !== undefined ? pendingRate : r.suggest).toFixed(2)} aria-label="Your bid per mile" disabled={off} />
            <Btn on={mine} disabled={off} onClick={placeBid}>
              {mine ? "Change bid" : "Bid"}
            </Btn>
          </div>
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
              <td class="num">{l.bookNow.toFixed(2)}</td>
              <td class="num">{l.ceiling.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
