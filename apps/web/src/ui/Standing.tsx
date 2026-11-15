import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { crewed, hubMiles, tierAt, type Company, type Load } from "@lanes/engine";
import { STANDING, STANDING_UX } from "../copy-standing.js";
import { fdFull, hhmm, pct } from "../format.js";
import { kitData } from "../menuart.js";
import { cardsUx, cardUx, firstCallFor, firstCallsFor, ladderFoot, ladderRows, sheetLine, standingShown, type CardUx } from "../standingui.js";
import { whenAt } from "../windowsui.js";
import { bumpData, me, order, S, setTab, toast, useData } from "../state.js";
import { openLoadOf } from "./WhatNow.js";
import { confirmAct } from "./Confirm.js";
import { Fig } from "./Explain.js";
import { Bar, Btn, Card, Muted, Panel } from "./bits.js";
import { cellStyle } from "./KitIcon.js";
import { Window } from "./Window.js";
import { checkMissedMoments } from "./HeroMoment.js";

/**
 * Standing with a market's shippers on the page (standing.ts), to UX's spec (ux-next-screens-2026-11-15.md part 1):
 * the Standing screen under More (§1.3), the card (§1.1), the ladder sheet (§1.2), the load sheet's line (§1.4) and the
 * first-call cards (§1.5). Nothing shows before the first on-time direct delivery (§1.0).
 */

const BAND_TONE = { approved: "var(--text-secondary)", preferred: "var(--accent)", core: "var(--sun, #e0a83a)" } as const;

/**
 * The tier's badge (§1.7): the kit's `tier-N` piece (the art role's ten, no digit painted on them); before it lands, the
 * band's master at the size with a code row of dots counting the tier within its band; with no kit at all, a pill.
 */
export function TierBadge({ tier, band, size = 48 }: { tier: number; band: "approved" | "preferred" | "core"; size?: number }): JSX.Element {
  const k = kitData();
  const own = k?.badges?.pieces?.[`tier-${tier}`];
  const label = `${STANDING.band[band]}, tier ${tier}`;
  if (k && own) {
    return (
      <span class="tierbadge" data-band={band} role="img" aria-label={label}>
        <span class="kicon" style={cellStyle(k.badges, own, size)} aria-hidden="true" />
      </span>
    );
  }
  const master = k?.badges?.pieces?.[band];
  if (k && master) {
    const within = band === "core" ? tier - 8 : band === "preferred" ? tier - 4 : tier;
    const slots = band === "core" ? 2 : 4;
    return (
      <span class="tierbadge stack" data-band={band} role="img" aria-label={label}>
        <span class="kicon" style={cellStyle(k.badges, master, size)} aria-hidden="true" />
        <span class="tierdots" aria-hidden="true">
          {Array.from({ length: slots }, (_, i) => (
            <i key={i} class={i < within ? "lit" : ""} />
          ))}
        </span>
      </span>
    );
  }
  return (
    <span class="tierbadge pill" data-band={band} role="img" aria-label={label}>
      {tier}
    </span>
  );
}

/** §1.1: one market's card; a tap opens its ladder. */
export function StandingCardView({ x, size = 64 }: { x: CardUx; size?: number }): JSX.Element {
  const open = () => openLadder(x.hub);
  return (
    <Card class="standingcard" onClick={open}>
      <div class="standing row" data-tier={x.tier}>
        <TierBadge tier={x.tier} band={x.band} size={size} />
        <div class="stack grow">
          <strong>{x.title}</strong>
          <span>
            <span style={{ color: BAND_TONE[x.band] }}>{x.bandWord}</span> · {x.line2}
          </span>
        </div>
      </div>
      <div class="standingnext stack">
        {x.next ? <span class="small">{x.next}</span> : <span class="small">{x.top}</span>}
        <span class="small">{x.have}</span>
        <span class="row small">
          <Fig k="shipper.standing" ctx={{ hub: x.hub }} label={x.title}>
            <span class="num">{`${Math.round(x.bars.loads[0] * 10) / 10}/${x.bars.loads[1]}`}</span>
          </Fig>
          <Bar share={x.bars.loads[1] > 0 ? x.bars.loads[0] / x.bars.loads[1] : 1} />
          {x.bars.onTime ? (
            <>
              <Fig k="shipper.standing" ctx={{ hub: x.hub }} label={x.title}>
                <span class="num">{`${pct(x.bars.onTime[0])}/${pct(x.bars.onTime[1])}`}</span>
              </Fig>
              <Bar share={x.bars.onTime[1] > 0 ? x.bars.onTime[0] / x.bars.onTime[1] : 1} />
            </>
          ) : null}
        </span>
        {x.unlocks ? <span class="small">{x.unlocks}</span> : null}
      </div>
      <p class="muted small standingrecord">{x.record}</p>
      {x.decay ? <span class="chip warn">{x.decay}</span> : null}
    </Card>
  );
}

/** Opens a market's ladder sheet (§1.2). */
export function openLadder(hub: number): void {
  S.ladder = hub;
  bumpData();
}

/** §1.3: More → Standing, the cards highest first, under the shipper's office. */
export function StandingScreen(): JSX.Element {
  useData();
  const g = S.game!;
  const c = me();
  // §1.6: a moment missed while away plays once, here, at the first free moment while the screen is open.
  useEffect(() => checkMissedMoments());
  const cards = standingShown(g.w, c) ? cardsUx(g.w, c) : [];
  return (
    <Panel title={STANDING_UX.tab} win={<Window name="shp-office" fallback="office" />}>
      <p class="small">{STANDING_UX.header(cards.length)}</p>
      {cards.map((x) => (
        <StandingCardView key={x.hub} x={x} />
      ))}
    </Panel>
  );
}

/** §1.3, Company: the highest-tier card alone, with All markets. */
export function CompanyStandingCard({ c }: { c: Company }): JSX.Element | null {
  useData();
  const w = S.game!.w;
  const top = cardsUx(w, c)[0];
  // §1.6: or here, on the Company card.
  useEffect(() => checkMissedMoments());
  if (!top) return null;
  return (
    <>
      <StandingCardView x={top} />
      <button type="button" class="linkish small standinglink" onClick={() => setTab("standing")}>
        {STANDING_UX.allMarkets} ›
      </button>
    </>
  );
}

/** §1.2: the ladder sheet, 10 at the top, scrolled so the player's row sits mid-sheet. No motion. */
export function LadderSheet(): JSX.Element | null {
  useData();
  const g = S.game;
  const hub = S.ladder;
  const you = useRef<HTMLDivElement>(null);
  useEffect(() => you.current?.scrollIntoView({ block: "center" }), [hub]);
  if (!g?.player || hub === null) return null;
  const c = me();
  const w = g.w;
  const rows = ladderRows(w, c, hub);
  const tier = tierAt(w, c, hub);
  const close = () => {
    S.ladder = null;
    bumpData();
  };
  return (
    <div class="heroscrim ladderscrim" role="dialog" aria-label={STANDING.title(w.net.hubs[hub]!.name)} onClick={close}>
      <div class="herocard laddersheet" onClick={(ev) => ev.stopPropagation()}>
        <div class="row">
          <strong class="grow">{STANDING.title(w.net.hubs[hub]!.name)}</strong>
          <Btn sm ghost label={STANDING_UX.ladderClose} onClick={close}>
            ×
          </Btn>
        </div>
        <Window name="shp-office" fallback="office" class="ladderwin" />
        {rows.map((r) => (
          <div key={r.tier}>
            {r.heading ? <p class="label">{r.heading}</p> : null}
            <div ref={r.state === "you" ? you : undefined} class={`ladderrow ${r.state}`} data-band={r.band}>
              <span class="num tiernum">{r.tier}</span>
              <span class="grow small">{r.floors}</span>
              {r.perk ? <span class="small">{r.perk}</span> : null}
              {r.state === "next" ? <span class="small muted">{STANDING_UX.ladderNext}</span> : null}
              {r.state === "you" ? (
                <>
                  <TierBadge tier={tier} band={r.band} size={48} />
                  <span class="sr">{STANDING_UX.ladderYou}</span>
                </>
              ) : null}
            </div>
          </div>
        ))}
        <p class="small muted">{ladderFoot(w)}</p>
      </div>
    </div>
  );
}

/** §1.4 line 1: under the poster, what the load builds (the badge at 24), or that a broker's builds none. */
export function SheetStandingLine({ c, l }: { c: Company; l: Load }): JSX.Element | null {
  const line = sheetLine(S.game!.w, c, l);
  if (!line) return null;
  return (
    <p class="small row standingline">
      {line.tier !== null ? <TierBadge tier={line.tier} band={line.band} size={24} /> : null}
      <span>{line.text}</span>
    </p>
  );
}

/** §1.5: Pass, after its Confirm: the engine's decline, a hit with the market, the load to the board. */
export function passFirstCall(c: Company, l: Load, ev?: MouseEvent): void {
  const w = S.game!.w;
  const m = w.net.hubs[l.origin]!.name;
  confirmAct(
    {
      verb: STANDING_UX.callPass,
      item: STANDING_UX.passItem,
      costFd: null,
      costLine: STANDING_UX.passCost(m, w.cfg.standing.hits.declinedFirstCall),
      does: STANDING_UX.passConfirm(m, w.cfg.standing.hits.declinedFirstCall),
      risk: null,
      go: STANDING_UX.callPass,
      destructive: true,
      run: () => {
        S.declinedCalls.add(l.id);
        void order({ type: "decline_tender", loadId: l.id }, STANDING.firstCallDeclined(m)).then((r) => {
          if (!r.ok) S.declinedCalls.delete(l.id);
          else toast(STANDING.firstCallDeclined(m));
          bumpData();
        });
      },
    },
    ev,
  );
}

/** Opens a first call on the board's sheet, for the player's idle truck of its trailer nearest the market. */
function openCall(c: Company, l: Load): void {
  const w = S.game!.w;
  const fleet = (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.trailer === l.equipment && crewed(t));
  const idle = fleet.filter((t) => t.status === "idle").sort((a, b) => hubMiles(w, a.hub, l.origin) - hubMiles(w, b.hub, l.origin) || a.id - b.id)[0];
  const t = idle ?? fleet[0];
  if (t) openLoadOf(t.id, l.id);
}

/** §1.5: the first-call cards pinned above the board, soonest deadline first, each with Open and Pass. */
export function FirstCallCards({ c }: { c: Company }): JSX.Element | null {
  const w = S.game!.w;
  if (!standingShown(w, c)) return null;
  const calls = firstCallsFor(w, c);
  if (!calls.length) return null;
  return (
    <>
      {calls.map((l) => {
        const m = w.net.hubs[l.origin]!.name;
        const until = hhmm(l.tenderUntil);
        const tier = tierAt(w, c, l.origin);
        return (
          <div class="loadcard firstcallcard stack" key={l.id} data-firstcall={l.id}>
            <div class="row">
              <TierBadge tier={tier} band={tier >= 9 ? "core" : tier >= 5 ? "preferred" : "approved"} size={32} />
              <strong class="small grow">{STANDING_UX.callHead(m, until)}</strong>
            </div>
            <span class="small">{STANDING_UX.callLane(w.net.places[l.originPlace]!.name, w.net.places[l.destPlace]!.name, Math.round(l.miles).toLocaleString("en-US"), fdFull(l.bookNow * l.miles), l.latestPickupT !== undefined ? whenAt(w, l.latestPickupT, true) : null)}</span>
            <div class="row">
              <Btn primary sm onClick={() => openCall(c, l)}>
                {STANDING_UX.callOpen}
              </Btn>
              <Btn sm danger onClick={(ev) => passFirstCall(c, l, ev)}>
                {STANDING_UX.callPass}
              </Btn>
            </div>
            <span class="muted small">{STANDING_UX.callFoot(until)}</span>
          </div>
        );
      })}
    </>
  );
}

/** The load sheet's first-call line (§1.5: the sheet carries the call's terms; Book or bid is the answer, Pass is here). */
export function FirstCallLine({ c, l }: { c: Company; l: Load }): JSX.Element | null {
  const call = firstCallFor(S.game!.w, c, l);
  if (!call) return null;
  return (
    <div class="firstcall row">
      <p class="small grow">{STANDING.firstCallLine(call.market, call.until)}</p>
      <Btn sm ghost onClick={(ev) => passFirstCall(c, l, ev)}>
        {STANDING_UX.callPass}
      </Btn>
    </div>
  );
}

/** §1.3, the city pane's Market tab: one line for a market where the player has a scorecard; a tap opens its ladder. */
export function CityStandingLine({ hub }: { hub: number }): JSX.Element | null {
  const g = S.game;
  const c = g?.player;
  if (!g || !c || !standingShown(g.w, c) || !c.standing?.[hub]) return null;
  const x = cardUx(g.w, c, hub);
  if (!x) return null;
  return (
    <button type="button" class="linkish small row standingline" onClick={() => openLadder(hub)}>
      <TierBadge tier={x.tier} band={x.band} size={24} />
      <span>{STANDING_UX.cityLine(x.bandWord, x.tier)}</span>
    </button>
  );
}

/** For Money's offers (§1.3): the badge beside a tier-9 or dedicated-lane offer. */
export function OfferBadge({ hub }: { hub: number }): JSX.Element | null {
  const g = S.game;
  const c = g?.player;
  if (!g || !c || !standingShown(g.w, c)) return null;
  const tier = tierAt(g.w, c, hub);
  return <TierBadge tier={tier} band={tier >= 9 ? "core" : tier >= 5 ? "preferred" : "approved"} size={32} />;
}

/** Unused by any screen until UX's empty state needs it: a market's card with nothing to show yet. */
export const standingNone = (): JSX.Element => <Muted small>{STANDING.companyNone}</Muted>;
