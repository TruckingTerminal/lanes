import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { hubs as HUBS } from "@lanes/data";
import { defaultName, FIRST_ENTRY, HUB_CARD, NAMING } from "../copy.js";
import { cls, fd } from "../format.js";
import { FLEET_START_EXTRA_FD, GAME_CONFIG, type StartKind } from "../game.js";
import { H } from "../handlers.js";
import { clearsNear, rateShown } from "../board.js";
import { hubFacts, moodLine, rankStarters, seasonReading } from "../hubcard.js";
import { iuliiaFirst } from "../iuliia.js";
import { bumpData, S, TEST_BUILD, useData, type EntryStage } from "../state.js";
import { Btn, Card } from "./bits.js";
import { Iuliia, IuliiaLine } from "./Walkthrough.js";
import { Portrait } from "./Loop.js";
import type { PortraitMood } from "../portrait.js";

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
/**
 * The three ringed hubs: the starters with the best freight right now (hubcard.ts rankStarters), ranked once when the
 * choice opens and kept for it, so the rings don't move under the player's thumb.
 */
export const ringedHubs = (): number[] => {
  S.entry.rings ??= rankStarters(S.game!.w).slice(0, 3);
  return S.entry.rings;
};

function go(stage: EntryStage, hub: number | null = S.entry.hub): void {
  S.entry = { ...S.entry, stage, hub };
  if (hub !== null) S.selHub = hub;
  S.sheet = stage === "card" || stage === "board" || stage === "all" ? "full" : "half";
  bumpData();
}
/** A hub tapped on the map before there is a company opens its card (mapview.ts calls this). */
export function openHubCard(hub: number): void {
  go("card", hub);
}

/** Her look through the intro's beats: a wave hello, a hand at the map, a plain word on the work, a hand at the rings. */
const INTRO_MOODS: PortraitMood[] = ["wave", "point", "idle", "point"];

/** The next beat of the intro, or the hub pick after the last. */
function nextBeat(): void {
  const beat = S.entry.beat + 1;
  if (beat >= FIRST_ENTRY.intro.length) return go("home");
  S.entry = { ...S.entry, beat };
  bumpData();
}

export function ChooseHub(): JSX.Element {
  useData();
  const { stage, hub } = S.entry;
  if (stage === "welcome") {
    const beat = Math.min(S.entry.beat, FIRST_ENTRY.intro.length - 1);
    return (
      <Say line={FIRST_ENTRY.intro[beat]!} mood={INTRO_MOODS[beat] ?? "idle"}>
        <Btn primary onClick={nextBeat}>
          {FIRST_ENTRY.next}
        </Btn>
      </Say>
    );
  }
  if (stage === "home") return <Home />;
  // Her line for these screens sits above them: the caption strip has nothing to say before a company exists.
  if (stage === "all") return <><IuliiaLine /><AllHubs /></>;
  if (hub === null) return <Home />;
  if (stage === "card") return <><IuliiaLine /><HubCard hub={hub} /></>;
  if (stage === "board") return <><IuliiaLine /><ReadOnlyBoard hub={hub} /></>;
  return <Naming hub={hub} />;
}

/** Iuliia at 96 px with one line, and what to do about it. */
function Say({ line, mood = "wave", children }: { line: string; mood?: PortraitMood; children?: JSX.Element | JSX.Element[] | null }): JSX.Element {
  return (
    <div class="stack">
      <div class="iuliiasay">
        <Iuliia mood={mood} size={96} />
        <p>{line}</p>
      </div>
      {children}
    </div>
  );
}

/** The country's reading, once under a list of hubs (hubcard.ts moodLine), while it's booming or slumping: the hubs' own lines lead. */
function MoodLine(): JSX.Element | null {
  const line = moodLine(S.game!.w);
  return line ? <p class="muted small">{line}</p> : null;
}

function HubRow({ hub }: { hub: number }): JSX.Element {
  const f = hubFacts(S.game!.w, hub);
  return (
    <button type="button" class="hubrow" onClick={() => go("card", hub)}>
      <b>{f.name}</b>
      {f.character ? <span class="small">{f.character}</span> : null}
      {/* The hub's own line; the country's is said once, under the list (the diaries: it printed on all 60). */}
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
      <MoodLine />
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
  useEffect(() => iuliiaFirst("hub:all"), []);
  // The starters first, in the rings' order, then every other city busiest first.
  const rings = ringedHubs();
  const starters = [...rings, ...rankStarters(w).filter((i) => !rings.includes(i))];
  const rest = w.net.hubs.map((_, i) => ({ i, posted: hubFacts(w, i).posted })).filter((x) => !starters.includes(x.i)).sort((a, b) => b.posted - a.posted || a.i - b.i);
  const order = [...starters.map((i) => ({ i })), ...rest];
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
      <MoodLine />
    </div>
  );
}

function HubCard({ hub }: { hub: number }): JSX.Element {
  const w = S.game!.w;
  const f = hubFacts(w, hub);
  const starter = isStarter(w.net.hubs[hub]!.id);
  // Iuliia on a card's first opening (iuliia-lines.md, first entry): a thin month first, else ringed, starter or neither.
  useEffect(() => {
    const thin = seasonReading(w, hub) < w.cfg.ui.season.thinUnder;
    iuliiaFirst(thin ? "hub:thin" : ringedHubs().includes(hub) ? "hub:ringed" : starter ? "hub:starter" : "hub:other", `hub:${hub}`);
  }, [hub]);
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
      {/* The country's reading on its own line, after the hub's own (client batch 6). */}
      {f.country ? <p class="muted small">{f.country}</p> : null}
      {group(HUB_CARD.freightNow, f.freight)}
      {/* No Intel link here (Jeff, 2026-11-04): before a company the sheet is the hub choice and nothing leaves it. */}
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
  useEffect(() => iuliiaFirst("hub:board", `hubBoard:${hub}`), [hub]);
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
            {S.game!.w.net.places[l.originPlace]!.name} → {S.game!.w.net.places[l.destPlace]!.name} · {Math.round(l.miles).toLocaleString("en-US")} mi
          </div>
          <div class="small">
            {fd(l.bookNow * l.miles)} FD · {rateShown(l, l.bookNow)}/mi · 0 mi empty · usually clears near {rateShown(l, clearsNear(S.game!.w, l))}/mi
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
  // The owner's look: none picked until the player taps one; without a pick the owner keeps the man's portrait.
  const [look, setLook] = useState<"m" | "f" | null>(null);
  // The writer's name for the hub, or "{city} Freight" for a starter the writer hasn't named yet.
  const name = typed ?? (defaultName(h.id) || `${h.name} Freight`);
  const submit = (ev: Event) => {
    ev.preventDefault();
    H.choose((name.trim() || defaultName(h.id) || `${h.name} Freight`).slice(0, 32), h.id, TEST_BUILD ? start : "oo", look ?? "m");
  };
  return (
    <form class="stack namingform" onSubmit={submit}>
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
      <div class="field">
        <span class="label">{NAMING.you}</span>
        {/* The owner keeps face 1 of the look picked here (assets.ts driverFace). */}
        <div class="row lookpick" role="radiogroup" aria-label={NAMING.you}>
          {(["m", "f"] as const).map((l) => (
            <button type="button" key={l} role="radio" aria-checked={look === l} aria-label={l === "m" ? NAMING.lookM : NAMING.lookF} class={cls("lookbtn", look === l && "on")} onClick={() => setLook(l)}>
              <Portrait file={`driver-${l}1`} />
            </button>
          ))}
        </div>
      </div>
      {TEST_BUILD ? (
        // QA item 8: the radios were announced by their value, "on"; each carries its name, and the pair its group's.
        <div class="field" role="radiogroup" aria-label={NAMING.howYouStart}>
          <span class="label">{NAMING.howYouStart}</span>
          <label class={cls("choice", start === "oo" && "on")}>
            <input type="radio" name="start" value="oo" aria-label={NAMING.ownerOperator} checked={start === "oo"} onChange={() => setStart("oo")} />
            <span>
              <b>{NAMING.ownerOperator}</b> {NAMING.ownerOperatorNote}
            </span>
          </label>
          <label class={cls("choice", start === "fleet" && "on")}>
            <input type="radio" name="start" value="fleet" aria-label={NAMING.smallFleet} checked={start === "fleet"} onChange={() => setStart("fleet")} />
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
