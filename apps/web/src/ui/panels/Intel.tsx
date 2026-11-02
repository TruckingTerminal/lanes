import type { JSX } from "preact";
import { BROKERAGE } from "../../copy.js";
import { hasTwo } from "../../companies.js";
import { partnerOf, VETTING_NAMES, type Company } from "@lanes/engine";
import { INTEL } from "../../copy.js";
import { cls, fdFull, pct } from "../../format.js";
import { posterOf } from "../../board.js";
import { insuranceBand, intelRows, ownCosts, pastSeasons, ranked, safetyBand, type IntelRow } from "../../intel.js";
import { bumpData, openIntel, S, setTab, useData } from "../../state.js";
import { Btn, Card, Kv, Panel } from "../bits.js";
import { Fig } from "../Explain.js";

/**
 * Intel (specs/intel.md, specs/intel-ux.md): every company, players and AI, carriers and brokers, by Miles; a card per
 * company in counts and bands; the player's own pinned as "How others see you". Never a figure from which live cash can
 * be derived (the director's row 1): no cash, worth, balance, stake amount, loan or debt.
 */
export function Intel(): JSX.Element {
  useData();
  const g = S.game!;
  const w = g.w;
  const me = g.player;
  const f = S.intel;
  const rows = intelRows(w);
  if (f.card !== null) {
    const row = rows.find((r) => r.c.id === f.card);
    if (row) return <Panel title={INTEL.title}>{<CompanyCard row={row} own={row.c === g.carrier || (!!g.brokerage && row.c === g.brokerage)} rows={rows} />}</Panel>;
  }
  const set = (p: Partial<typeof f>) => {
    S.intel = { ...S.intel, ...p, shown: 50 };
    bumpData();
  };
  const q = f.q.trim().toLowerCase();
  const myHub = me ? me.homeHub : -1;
  const hubIdx = f.hub !== null ? w.net.hubs.findIndex((h) => h.id === f.hub) : -1;
  const shown = ranked(rows, f.sort).filter(
    ({ r }) =>
      (!q || r.c.name.toLowerCase().includes(q)) && (!f.myHub || r.c.homeHub === myHub) && (hubIdx < 0 || r.c.homeHub === hubIdx) && (!f.players || r.player) && (!f.brokers || r.broker),
  );
  const mine = me ? ranked(rows, f.sort).find((x) => x.r.c === me) : undefined;
  // With two companies, "How others see you" pins both, the one in view first (brokerage-ux.md section 4).
  const other = hasTwo(g) ? ranked(rows, f.sort).find((x) => x.r.c === (me === g.brokerage ? g.carrier : g.brokerage)) : undefined;
  const chip = (on: boolean, label: string, flip: () => void) => (
    <Btn sm on={on} onClick={flip}>
      {label}
    </Btn>
  );
  // No match, the filters in words (the writer's strings): a name first, else who and where.
  const where = hubIdx >= 0 ? w.net.hubs[hubIdx]!.name : f.myHub && me ? w.net.hubs[myHub]!.name : null;
  const noneText = q ? INTEL.noneCalled(f.q.trim()) : where ? INTEL.noneAt(f.brokers ? "brokers" : f.players ? "players" : "companies", where) : INTEL.none;
  return (
    <Panel title={INTEL.header(shown.length)}>
      {mine && (g.kind === "test" || (g.kind === "live" && g.writer)) ? (
        <div class="stack">
          <p class="label">{INTEL.howOthers}</p>
          <Row x={mine} own />
          {other ? <Row x={other} own /> : null}
        </div>
      ) : null}
      <input type="search" class="intelfind" placeholder={INTEL.find} aria-label={INTEL.find} value={f.q} onInput={(e) => set({ q: (e.target as HTMLInputElement).value })} />
      <div class="row chips">
        {me ? chip(f.myHub, INTEL.myHub, () => set({ myHub: !f.myHub, hub: null })) : null}
        <select aria-label={INTEL.hub} value={f.hub ?? ""} onChange={(e) => set({ hub: (e.target as HTMLSelectElement).value || null, myHub: false })}>
          <option value="">{INTEL.anyHub}</option>
          {[...w.net.hubs].sort((a, b) => a.name.localeCompare(b.name)).map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        {chip(f.players, INTEL.players, () => set({ players: !f.players }))}
        {chip(f.brokers, INTEL.brokers, () => set({ brokers: !f.brokers }))}
      </div>
      <div class="row">
        <span class="label">{INTEL.sortBy}</span>
        {(["miles", "trucks", "month"] as const).map((s) => (
          <Btn sm key={s} on={f.sort === s} onClick={() => set({ sort: s })}>
            {s === "miles" ? INTEL.sortMiles : s === "trucks" ? INTEL.sortTrucks : INTEL.sortMonth}
          </Btn>
        ))}
      </div>
      {shown.length ? (
        <div class="intelrows">
          {shown.slice(0, f.shown).map((x) => (
            <Row key={x.r.c.id} x={x} own={x.r.c === me} />
          ))}
        </div>
      ) : (
        <>
          <p class="muted">{noneText}</p>
          <Btn onClick={() => set({ q: "", myHub: false, hub: null, players: false, brokers: false })}>{INTEL.clear}</Btn>
        </>
      )}
      {shown.length > f.shown ? (
        <Btn
          onClick={() => {
            S.intel = { ...S.intel, shown: S.intel.shown + PAGE };
            bumpData();
          }}
        >
          {INTEL.more(PAGE)}
        </Btn>
      ) : null}
    </Panel>
  );
}

/** A row: rank, name and marks; then the home city, trucks and Miles (a broker: its credit, which a carrier reads first). */
function Row({ x, own }: { x: { r: IntelRow; rank: number }; own?: boolean }): JSX.Element {
  const w = S.game!.w;
  const { r, rank } = x;
  const hub = w.net.hubs[r.c.homeHub]?.name ?? "";
  return (
    <button type="button" class={cls("intelrow", own && "you")} onClick={() => openCard(r.c.id)}>
      <span>
        #{rank} · <b>{r.c.name}</b>
        {r.player ? <span class="chip good">{INTEL.player}</span> : null}
        {r.broker ? <span class="chip">{INTEL.broker}</span> : null}
        {own ? (
          <>
            <span class="chip muted">{safetyBand(r.c).rating}</span>
            <span class="chip muted">
              {INTEL.credit} {r.credit}
            </span>
          </>
        ) : null}
      </span>
      <span class="muted small">{r.broker ? INTEL.line2Broker(hub, r.credit) : INTEL.line2(hub, r.trucks, fdFull(r.miles))}</span>
    </button>
  );
}

function openCard(id: number): void {
  S.intel = { ...S.intel, card: id, back: S.intel.card === null ? null : S.intel.back };
  if (window.matchMedia("(max-width: 899px)").matches) S.sheet = "full";
  bumpData();
}

/** The list's page size. */
const PAGE = 50;

/** How long the authority has stood: days under a month, then months, then years (a game year is a season's days). */
function authorityAge(days: number, perMonth: number, perYear: number): string {
  if (days < perMonth) return INTEL.ageDays(days);
  if (days < perYear) return INTEL.ageMonths(Math.floor(days / perMonth));
  return INTEL.ageYears(Math.floor(days / perYear));
}

/** The card: the director's fields in order, label left, value right. Own card: the band costs under each band. */
function CompanyCard({ row, own, rows }: { row: IntelRow; own: boolean; rows: IntelRow[] }): JSX.Element {
  const w = S.game!.w;
  const c: Company = row.c;
  const today = Math.floor(w.t / 1440);
  const a = c.authority;
  const status = a.status === "active" ? "active" : a.status;
  const byType = (["van", "reefer", "flatbed"] as const).filter((t) => row.trailers[t] > 0).map((t) => `${row.trailers[t]} ${t}`).join(", ");
  const trailers = row.trailers.van + row.trailers.reefer + row.trailers.flatbed;
  // Only kinds with a public name: a fence or a chop shop is the Back Lot's and never shows (the director's page).
  const fac: [string, number][] = [...(c.yard !== "none" ? ([["yard", 1]] as [string, number][]) : []), ...Object.entries(row.facilities)];
  const facilities = fac.filter(([k]) => INTEL.facilityKind[k]).map(([k, n]) => INTEL.facilityCount(n, INTEL.facilityKind[k]!)).join(" · ");
  const rank = ranked(rows, "miles").find((x) => x.r.c === c)!.rank;
  const lm = c.lastMonth;
  const safety = safetyBand(c);
  const ins = insuranceBand(c);
  const insLabel = ins === "clean" ? INTEL.insClean : ins === "surcharged" ? INTEL.insSurcharged : INTEL.insHeavy;
  const bonded = row.broker && c.stakedFd + 1e-9 >= w.cfg.token.staking.roles.broker;
  const vetting = VETTING_NAMES[c.vetting];
  const costs = own ? ownCosts(w, c) : null;
  const back = () => {
    const to = S.intel.back;
    S.intel = { ...S.intel, card: null, back: null };
    if (to) setTab(to);
    else bumpData();
  };
  const past = pastSeasons(w, c);
  // A broker's or a player shipper's loads open on the board (the writer's "Their loads on the board").
  let theirLoads = 0;
  for (const l of w.loads.values()) if (l.status === "open" && posterOf(l) === c.id) theirLoads++;
  return (
    <div class="stack">
      <div class="row">
        <Btn sm ghost onClick={back}>
          ‹ {INTEL.back}
        </Btn>
      </div>
      {own ? <p class="label">{INTEL.howOthers}</p> : null}
      <Card title={c.name}>
        <p class="small">
          {row.player ? INTEL.player : INTEL.ai} · {row.broker ? INTEL.broker : INTEL.carrier} · {INTEL.home(w.net.hubs[c.homeHub]?.name ?? "")}
        </p>
        {row.broker ? <p class="bighead">{INTEL.brokerLine(row.credit, bonded, vetting)}</p> : null}
        {/* A player's carrier and brokerage: common ownership is public (brokerage-rule.md section 5). */}
        {partnerOf(w, c) ? (
          <button type="button" class="linkish small" onClick={() => openIntel({ card: partnerOf(w, c)!.id })}>
            {BROKERAGE.sameOwner(partnerOf(w, c)!.name)}
          </button>
        ) : null}
        <Kv
          rows={[
            [INTEL.authority, <span class={a.status !== "active" ? "bad" : ""}>{INTEL.authorityValue(authorityAge(today - a.since, w.cfg.time.daysPerMonth, w.cfg.time.daysPerSeason), status)}{a.revocations > 0 ? ` · ${INTEL.revokedBefore(a.revocations)}` : ""}</span>],
            [INTEL.running, facilities ? <span>{INTEL.runningValue(row.trucks, trailers, byType, row.drivers)}<br />{facilities}</span> : INTEL.runningValue(row.trucks, trailers, byType, row.drivers)],
            [INTEL.milesSeason, INTEL.milesValue(fdFull(row.miles), rank, rows.length)],
            [INTEL.lastMonth, lm ? INTEL.lastMonthValue(fdFull(lm.revenueFd), lm.loads, pct(lm.loads ? lm.onTime / lm.loads : 0)) : INTEL.firstMonth],
            // Bands explain on tap; another company's in general terms only, never its inputs (Intel's row 1).
            [INTEL.safety, <Fig k={own ? "intel.safetyBand" : "intel.safetyBand.other"} label={INTEL.safety}>{[safety.rating, ...safety.alerts.map(alertName)].join(" · ")}</Fig>],
            [INTEL.insurance, <Fig k={own ? "intel.insuranceBand" : "intel.insuranceBand.other"} label={INTEL.insurance}>{insLabel}</Fig>],
            ...(row.broker ? [] : ([[INTEL.credit, <Fig k={own ? "intel.creditBand" : "intel.creditBand.other"} label={INTEL.credit}>{INTEL.creditValue(row.credit)}</Fig>]] as [string, JSX.Element][])),
          ]}
        />
        {past.length ? (
          <details class="fold">
            <summary>{INTEL.pastSeasons}</summary>
            {past.map((p) => (
              <p key={p.season} class="small">
                {INTEL.pastRow(p.season, fdFull(p.miles), p.rank)}
              </p>
            ))}
          </details>
        ) : null}
        {!own && theirLoads > 0 ? (
          <button
            type="button"
            class="linkrow"
            onClick={() => {
              S.boardPoster = c.id;
              S.intel = { ...S.intel, card: null, back: null };
              setTab("loads");
            }}
          >
            {INTEL.theirLoads}
          </button>
        ) : null}
        {costs ? (
          <>
            <p class="muted small">{INTEL.ownCredit(row.credit, pct(costs.credit.down), `${(costs.credit.weeklyRate * 100).toFixed(2)}%`, costs.credit.maxLoans)}</p>
            <p class="muted small">{costs.vetting ? INTEL.ownSafety(costs.vetting.tier === "strict" ? "Strict" : "Standard", costs.vetting.reason) : INTEL.ownSafetyClear}</p>
            <p class="muted small">{costs.premiumOver <= 0.005 ? INTEL.ownInsuranceClean : c.safety.rating === "none" ? INTEL.ownInsuranceUnrated(pct(costs.premiumOver)) : INTEL.ownInsurance(pct(costs.premiumOver))}</p>
            <Btn sm ghost onClick={() => setTab("company")}>
              {INTEL.fullBooks}
            </Btn>
          </>
        ) : null}
      </Card>
    </div>
  );
}

const ALERT_NAMES: Record<string, string> = { hos: "hours of service", unsafe: "unsafe driving", maintenance: "vehicle maintenance", crash: "crashes" };
const alertName = (b: string): string => ALERT_NAMES[b] ?? b;
