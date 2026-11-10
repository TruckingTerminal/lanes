import type { JSX } from "preact";
import { firstLoadLocked } from "../tutorial.js";
import { iconUrl } from "../art.js";
import { ASSETS, hasAsset } from "../mapart.js";
import { bumpData, openIntel, S, setTab, useData, visited } from "../state.js";
import { MORE, tabDef, tabOpen, teaserTabs, type Tab } from "../tabs.js";
import { Btn, Panel } from "./bits.js";
import { BROKERAGE } from "../copy.js";
import { PENDING } from "../copy-pending.js";
import { firstTruckLine } from "../figures.js";
import { FirstTruckVerdictBlock } from "./FirstTruckCard.js";
import { fdFull } from "../format.js";
import { Iuliia } from "./Walkthrough.js";

/** A tab's icon: the painted one when it exists (assets/icons/<id>.png), else the code-drawn one. */
export function TabIcon({ id, size }: { id: Tab; size: 24 | 48 }): JSX.Element {
  const painted = hasAsset(`icons/${id}.png`);
  return <img class="px tabpic" width={size} height={size} src={painted ? `${ASSETS}icons/${id}.png` : iconUrl(tabDef(id).icon, size === 48 ? 4 : 2)} alt="" />;
}

/** An opened teaser this browser hasn't visited yet: "New" under More. */
export const isNew = (id: Tab): boolean => !visited(id);

/** More (copy-first-ten-minutes.md, Chrome): Iuliia, Help and Company, the teasers that have opened, then the ones coming. */
export function More(): JSX.Element {
  useData();
  const g = S.game!;
  const opened = teaserTabs().filter((t) => tabOpen(t.id, g.w, g.player));
  const coming = teaserTabs().filter((t) => !tabOpen(t.id, g.w, g.player));
  const row = (id: Tab, fresh = false) => (
    <button key={id} type="button" class="morerow" onClick={() => (id === "intel" ? openIntel({}) : setTab(id))} data-need={fresh ? `opened:${id}` : undefined}>
      <TabIcon id={id} size={24} />
      <span>{tabDef(id).label}</span>
      {fresh ? <span class="newdot">New</span> : null}
      <span class="chev" aria-hidden="true">›</span>
    </button>
  );
  return (
    <Panel title="More">
      <nav class="morelist" aria-label="More">
        {MORE.map((id) => row(id))}
        {opened.map((t) => row(t.id, isNew(t.id)))}
      </nav>
      {coming.length ? (
        <>
          <h3 class="label">Coming soon</h3>
          <div class="teaserrow">
            {coming.map((t) => (
              <TeaserCard key={t.id} id={t.id} />
            ))}
          </div>
        </>
      ) : null}
    </Panel>
  );
}

/**
 * A teaser's card (specs/first-ten-minutes.md, "The teasers"): what it is, when it opens, one line from Iuliia and one
 * thing that works. Never a dead tap: the Back Lot asks what you'd want there, the others open the road ahead.
 */
export function TeaserCard({ id }: { id: Tab }): JSX.Element {
  const g = S.game!;
  const def = tabDef(id);
  const t = def.teaser!;
  const ask = id === "backlot";
  return (
    <section class="card teaser">
      <header class="teaserhead">
        <TabIcon id={id} size={48} />
        <div>
          <h3>{def.label}</h3>
          <p class="muted small">Opens {t.opens(g.w)}</p>
        </div>
      </header>
      <p class="small">{t.what}</p>
      {id === "market" && g.player ? <DealerPrice /> : null}
      <div class="caption">
        <Iuliia mood="idle" size={64} />
        <span class="small">{t.iuliia}</span>
      </div>
      <div class="row">
        {ask ? (
          <Btn sm primary onClick={() => { S.reportKind = "idea"; S.reporting = true; bumpData(); }}>
            Tell us what you'd want here
          </Btn>
        ) : id === "brokerage" ? (
          // The brokerage's working action before its day: what brokers earned (brokerage-rule.md section 7).
          <Btn sm ghost onClick={() => openIntel({ brokers: true, sort: "month" })}>
            {BROKERAGE.teaserButton}
          </Btn>
        ) : (
          <Btn sm ghost onClick={() => { S.guidePage = "roadmap"; setTab("guide"); }}>
            The road ahead
          </Btn>
        )}
      </div>
    </section>
  );
}

/** The Dealer's teaser carries the goal's price (the director, 2026-11-09): what the first truck takes now, and how far. */
function DealerPrice(): JSX.Element {
  const g = S.game!;
  const f = firstTruckLine(g.w, g.player!);
  if (!f) return <p class="small">{PENDING.dealerPriceNone}</p>;
  // Client batch 8a item 57: the Dealer's teaser carries the same verdict as the Dealer's card.
  return <FirstTruckVerdictBlock f={f} />;
}

/** The laptop's teaser row under the nav: the teasers not yet open, dimmed; a click shows the card in the panel. */
export function TeaserRow(): JSX.Element | null {
  useData();
  const g = S.game!;
  if (!g.player || firstLoadLocked(g.w, g.player)) return null;
  const coming = teaserTabs().filter((t) => !tabOpen(t.id, g.w, g.player));
  if (!coming.length) return null;
  return (
    <div class="teaserbar" role="group" aria-label="Coming soon">
      {coming.map((t) => (
        <button key={t.id} type="button" class={S.tab === t.id ? "teaserseg on" : "teaserseg"} title={`${t.label}: opens ${t.teaser!.opens(g.w)}`} onClick={() => setTab(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
