import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { hubs as HUBS } from "@lanes/data";
import { defaultName, FIRST_ENTRY, HUB_CARD, NAMING } from "../copy.js";
import { cls, fd } from "../format.js";
import { FIRST_HUBS, FLEET_START_EXTRA_FD, GAME_CONFIG, type StartKind } from "../game.js";
import { H } from "../handlers.js";
import { hubFacts } from "../hubcard.js";
import { bumpData, S, TEST_BUILD, useData, type EntryStage } from "../state.js";
import { Btn, Card } from "./bits.js";
import { Iuliia } from "./Walkthrough.js";

/**
 * The first entry (specs/first-ten-minutes.md, S1, draft 4): the world before a home. No company exists yet, so
 * everything here reads the world alone (hubcard.ts); the sheet walks from Iuliia's welcome to the three ringed
 * starters, a hub's card and its board (read-only), then the company's name, and the company joins on Start.
 */

/** Whether this page is choosing a hub: a test world before its company, or a live writer with no company and no join sent. */
export function choosing(): boolean {
  const g = S.game;
  if (!g || g.player) return false;
  if (g.kind === "test") return true;
  return g.writer && !!S.platform.uid && !g.pending().some((r) => r.a.type === "join");
}

const isStarter = (id: string): boolean => HUBS.some((h) => h.id === id && h.isStarter);
/** The three ringed hubs (game.ts FIRST_HUBS) as world hub indices. */
export const ringedHubs = (): number[] => {
  const w = S.game!.w;
  return FIRST_HUBS.map((id) => w.net.hubs.findIndex((h) => h.id === id)).filter((i) => i >= 0);
};

function go(stage: EntryStage, hub: number | null = S.entry.hub): void {
  S.entry = { stage, hub };
  if (hub !== null) S.selHub = hub;
  S.sheet = stage === "card" || stage === "board" || stage === "all" ? "full" : "half";
  bumpData();
}
/** A hub tapped on the map before there is a company opens its card (mapview.ts calls this). */
export function openHubCard(hub: number): void {
  go("card", hub);
}

export function ChooseHub(): JSX.Element {
  useData();
  const { stage, hub } = S.entry;
  if (stage === "welcome") {
    return (
      <Say line={FIRST_ENTRY.welcome}>
        <Btn primary onClick={() => go("home")}>
          {FIRST_ENTRY.next}
        </Btn>
      </Say>
    );
  }
  if (stage === "home") return <Home />;
  if (stage === "all") return <AllHubs />;
  if (hub === null) return <Home />;
  if (stage === "card") return <HubCard hub={hub} />;
  if (stage === "board") return <ReadOnlyBoard hub={hub} />;
  return <Naming hub={hub} />;
}

/** Iuliia at 96 px with one line, and what to do about it. */
function Say({ line, children }: { line: string; children?: JSX.Element | JSX.Element[] | null }): JSX.Element {
  return (
    <div class="stack">
      <div class="iuliiasay">
        <Iuliia mood="wave" size={96} />
        <p>{line}</p>
      </div>
      {children}
    </div>
  );
}

function HubRow({ hub }: { hub: number }): JSX.Element {
  const f = hubFacts(S.game!.w, hub);
  return (
    <button type="button" class="hubrow" onClick={() => go("card", hub)}>
      <b>{f.name}</b>
      {f.character ? <span class="small">{f.character}</span> : null}
      <span class="muted small">{f.season}</span>
    </button>
  );
}

function Home(): JSX.Element {
  return (
    <Say line={FIRST_ENTRY.home}>
      <div class="hubrows">
        {ringedHubs().map((i) => (
          <HubRow key={i} hub={i} />
        ))}
      </div>
      <div class="row">
        <Btn ghost onClick={() => go("all")}>
          {FIRST_ENTRY.allHubs}
        </Btn>
      </div>
    </Say>
  );
}

function AllHubs(): JSX.Element {
  const w = S.game!.w;
  const order = w.net.hubs.map((_, i) => ({ i, posted: hubFacts(w, i).posted })).sort((a, b) => b.posted - a.posted || a.i - b.i);
  return (
    <div class="stack">
      <div class="row">
        <Btn sm ghost onClick={() => go("home")}>
          ‹ {HUB_CARD.back}
        </Btn>
      </div>
      <h3 class="label">{FIRST_ENTRY.allHubsHeader}</h3>
      <div class="hubrows">
        {order.map(({ i }) => (
          <HubRow key={i} hub={i} />
        ))}
      </div>
    </div>
  );
}

function HubCard({ hub }: { hub: number }): JSX.Element {
  const w = S.game!.w;
  const f = hubFacts(w, hub);
  const starter = isStarter(w.net.hubs[hub]!.id);
  const group = (title: string, lines: string[]) => (
    <Card title={title}>
      {lines.map((l) => (
        <p class="small" key={l}>
          {l}
        </p>
      ))}
    </Card>
  );
  return (
    <div class="stack hubcard-full">
      <div class="row">
        <Btn sm ghost onClick={() => go("home")}>
          ‹ {HUB_CARD.back}
        </Btn>
      </div>
      <h2>{f.name}</h2>
      {f.character ? <p>{f.character}</p> : null}
      <p class="muted">{f.season}</p>
      {group(HUB_CARD.freightNow, f.freight)}
      {group(HUB_CARD.whosHere, f.whosHere)}
      {group(HUB_CARD.costs, f.costs)}
      {group(HUB_CARD.outbound, [f.outbound])}
      <div class="row pinned">
        <Btn onClick={() => go("board", hub)}>{HUB_CARD.seeBoard}</Btn>
        {starter ? (
          <Btn primary onClick={() => go("name", hub)}>
            {HUB_CARD.startHere}
          </Btn>
        ) : (
          <span class="muted small">{NAMING.notStarter(f.name)}</span>
        )}
      </div>
    </div>
  );
}

/** The hub's board as S2 will show it, read-only: no profit, no Book or Bid until there's a company to bid with. */
function ReadOnlyBoard({ hub }: { hub: number }): JSX.Element {
  const w = S.game!.w;
  const name = (i: number) => w.net.hubs[i]!.name;
  const loads = [...w.loads.values()].filter((l) => l.status === "open" && l.equipment === "van" && l.origin === hub).sort((a, b) => b.bookNow - a.bookNow);
  return (
    <div class="stack">
      <div class="row">
        <Btn sm ghost onClick={() => go("card", hub)}>
          ‹ {HUB_CARD.back}
        </Btn>
      </div>
      <h3>{name(hub)}</h3>
      {loads.map((l) => (
        <div class="loadcard ro" key={l.id}>
          <div>
            {name(l.origin)} → {name(l.dest)} · {Math.round(l.miles).toLocaleString("en-US")} mi
          </div>
          <div class="small">
            {fd(l.bookNow * l.miles)} FD · {l.bookNow.toFixed(2)}/mi · 0 mi empty · usually clears near {l.refRate.toFixed(2)}/mi
          </div>
        </div>
      ))}
      <p class="muted small">{HUB_CARD.boardFooter}</p>
      {isStarter(w.net.hubs[hub]!.id) ? (
        <div class="row pinned">
          <Btn primary onClick={() => go("name", hub)}>
            {HUB_CARD.startHere}
          </Btn>
        </div>
      ) : null}
    </div>
  );
}

function Naming({ hub }: { hub: number }): JSX.Element {
  const h = S.game!.w.net.hubs[hub]!;
  const [typed, setTyped] = useState<string | null>(null);
  const [start, setStart] = useState<StartKind>("oo");
  const name = typed ?? defaultName(h.id);
  const submit = (ev: Event) => {
    ev.preventDefault();
    H.choose((name.trim() || defaultName(h.id) || `${h.name} Freight`).slice(0, 32), h.id, TEST_BUILD ? start : "oo");
  };
  return (
    <form class="stack" onSubmit={submit}>
      <div class="iuliiasay">
        <Iuliia mood="point" size={96} />
        <p>{NAMING.line(h.name)}</p>
      </div>
      <div class="field">
        <label class="label" for="cname">
          {NAMING.field}
        </label>
        <input type="text" id="cname" maxLength={32} value={name} onInput={(e) => setTyped((e.target as HTMLInputElement).value)} required />
      </div>
      {TEST_BUILD ? (
        <div class="field">
          <span class="label">{NAMING.howYouStart}</span>
          <label class={cls("choice", start === "oo" && "on")}>
            <input type="radio" name="start" checked={start === "oo"} onChange={() => setStart("oo")} />
            <span>
              <b>{NAMING.ownerOperator}</b> {NAMING.ownerOperatorNote}
            </span>
          </label>
          <label class={cls("choice", start === "fleet" && "on")}>
            <input type="radio" name="start" checked={start === "fleet"} onChange={() => setStart("fleet")} />
            <span>
              <b>{NAMING.smallFleet}</b> {NAMING.smallFleetNote(fd(GAME_CONFIG.company.startingGrantFd + FLEET_START_EXTRA_FD))}
            </span>
          </label>
        </div>
      ) : null}
      <div class="row pinned">
        <Btn ghost onClick={() => go("card", hub)}>
          {NAMING.back}
        </Btn>
        <Btn primary type="submit">
          {NAMING.start(h.name)}
        </Btn>
      </div>
    </form>
  );
}
