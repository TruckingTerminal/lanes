import { HeroMoment } from "./HeroMoment.js";
import { ScreenWindow } from "./Window.js";
import type { JSX } from "preact";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";
import { iuliiaFirst } from "../iuliia.js";
import { ExplainSheet } from "./Explain.js";
import { hhmm, realUntil } from "../format.js";
import { H } from "../handlers.js";
import { isPhone, S, setTab, useData } from "../state.js";
import { navOf, tabLabel, tabOpen, teaserTabs, type Tab } from "../tabs.js";
import { kindInView, navFor, switchWhenFormed } from "../companies.js";
import { Book, BrokerageTab, BrokerMoney, Carriers } from "./panels/Brokerage.js";
import { Btn, Card } from "./bits.js";
import { ChooseHub, choosing } from "./ChooseHub.js";
import { isNew, More, TabIcon, TeaserCard, TeaserRow } from "./More.js";
import { Caption, IuliiaPanel, ReportCard, StepMoment } from "./Walkthrough.js";
import { Business } from "./panels/Business.js";
import { Company } from "./panels/Company.js";
import { Dealer } from "./panels/Dealer.js";
import { Economy } from "./panels/Economy.js";
import { Finance } from "./panels/Finance.js";
import { Fleet } from "./panels/Fleet.js";
import { Guide } from "./panels/Guide.js";
import { Intel } from "./panels/Intel.js";
import { Loads } from "./panels/Board.js";
import { Logbook } from "./panels/Logbook.js";
import { Money } from "./panels/Money.js";
import { Rates } from "./panels/Rates.js";
import { Staff } from "./panels/Staff.js";
import { ConfirmSheet } from "./Confirm.js";
import { tabLocked } from "../tutorial.js";
import { TUTORIAL } from "../copy.js";
import { FirstLoad } from "./Walkthrough.js";

/** Each tab's panel (tabs.ts holds the order, labels, icons and teasers). A Record, so a tab can't be added without one. */
const PANELS: Record<Tab, () => JSX.Element> = {
  fleet: () => <Fleet />,
  loads: () => <Loads />,
  // The brokerage in view has its own Money (brokerage-ux.md section 2).
  money: () => (kindInView(S.game!) === "brokerage" ? <BrokerMoney /> : <Money />),
  more: () => <More />,
  iuliia: () => <IuliiaPanel />,
  guide: () => <Guide />,
  company: () => <Company />,
  intel: () => <Intel />,
  staff: () => <Staff />,
  market: () => <Dealer />,
  rates: () => <Rates />,
  logbook: () => <Logbook />,
  finance: () => <Finance />,
  economy: () => <Economy />,
  business: () => <Business />,
  // Opens with its layer's switch; the panel comes with the layer.
  backlot: () => <TeaserCard id="backlot" />,
  brokerage: () => <BrokerageTab />,
  book: () => <Book />,
  carriers: () => <Carriers />,
};

/** Tabs a page with no company can still read. */
const WATCHABLE: readonly Tab[] = ["more", "iuliia", "guide", "company", "intel", "rates", "economy"];

/**
 * The nav: Truck · Loads · Money · More, or the brokerage's Book · Carriers · Money · More when it's in view (a
 * segmented control on the laptop, the bottom bar on a phone; the
 * stylesheet places it). More lights for every tab under it; a dot when an opened teaser is new.
 */
export function Nav(): JSX.Element | null {
  useData();
  const g = S.game!;
  // No nav before a company (S1): the world is to look at, and the sheet is the hub choice.
  if (choosing()) return null;
  const on = navOf(S.tab);
  // The first load's lock (tutorial.ts): Money and More dim until it; a tap on one says why (setTab).
  const locked = (id: Tab) => !!g.player && tabLocked(g.w, g.player, id);
  const moreNew = !!g.player && teaserTabs().some((t) => tabOpen(t.id, g.w, g.player) && isNew(t.id));
  // On a phone a nav tap raises the sheet: half for most, full for Loads (specs/first-ten-minutes.md).
  const go = (id: Tab) => {
    if (isPhone()) S.sheet = id === "loads" ? "full" : "half";
    setTab(id);
  };
  return (
    <nav class="tabs" aria-label="Tabs">
      {navFor(g).map((id) => (
        <Btn key={id} on={id === on} class={locked(id) ? "locked" : undefined} title={locked(id) ? TUTORIAL.lockedTitle : tabLabel(id, g.w, g.player)} onClick={() => go(id)}>
          <TabIcon id={id} size={24} lit={id === on} />
          <span>{tabLabel(id, g.w, g.player)}</span>
          {id === "more" && moreNew ? <span class="navdot" aria-label="something new" /> : null}
          {id === "loads" && S.result && !S.result.seen ? <span class="navdot" aria-label="a bid result" /> : null}
          {id === "money" && S.moneyDot ? <span class="navdot" aria-label={S.moneyDot === "invoice" ? "a new invoice" : "pay landed"} /> : null}
        </Btn>
      ))}
    </nav>
  );
}

/** The laptop's rack: the nav over the panel. */
export function SideRack(): JSX.Element {
  return (
    <aside class="side">
      <div class="rackbar">
        <Nav />
      </div>
      <RackBody />
    </aside>
  );
}

/**
 * Client batch 6 (QA, laptop at 1024×768): the panel box's height was the window less a fixed 200 px, but what sits above
 * it (the bar, the nav, the teaser row, Iuliia's caption) runs taller, so its bottom, and the load sheet's pinned Book now
 * and Bid with it, sat about 164 px below the window until the page scrolled. Its top on the page, measured, sets
 * `--boxtop`, and page.html caps the box at the window less that: its bottom, and whatever is pinned to it, in view.
 */
function panelTop(el: HTMLDivElement | null): void {
  if (!el) return;
  const top = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY));
  const v = `${top}px`;
  if (el.style.getPropertyValue("--boxtop") !== v) el.style.setProperty("--boxtop", v);
}

/** What the nav opens: the teaser row (laptop), Iuliia's caption, and the tab's panel or its teaser card. On a phone the sheet holds this. */
export function RackBody(): JSX.Element {
  useData();
  switchWhenFormed();
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => panelTop(box.current));
  useEffect(() => {
    const f = () => panelTop(box.current);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  const g = S.game!;
  // Before a company the sheet is the hub choice whatever the tab (Jeff, 2026-11-04: a tap elsewhere lost it); locked, a tab outside the lock reads as Truck.
  const picking = choosing();
  const tab: Tab = g.player && tabLocked(g.w, g.player, S.tab) ? "fleet" : S.tab;
  const watching = !g.player && !WATCHABLE.includes(tab);
  const under = !picking && navOf(tab) === "more" && tab !== "more";
  const open = tabOpen(tab, g.w, g.player);
  // Iuliia on a screen's first visit in a sitting (iuliia-lines.md): its own line, or the closed-teaser line.
  useEffect(() => {
    if (watching || !g.player) return;
    if (open) iuliiaFirst(`${tab}:first`, `tab:${tab}`);
    else iuliiaFirst("teaser:closed", `teaser:${tab}`);
  }, [tab, open, watching]);
  return (
    <>
      <TeaserRow />
      <Caption />
      <ExplainSheet />
      <ConfirmSheet />
      <HeroMoment />
      <div class="panelbox" ref={box}>
        {/* The menu system §1.3: the screen's window, above everything in its panel. */}
        <ScreenWindow tab={tab} picking={picking} />
        <ReportCard key={S.reportKind} />
        {open && !watching ? <><StepMoment /><FirstLoad /></> : null}
        {under ? (
          <div class="row">
            <Btn sm ghost onClick={() => setTab("more")}>
              ‹ More
            </Btn>
          </div>
        ) : null}
        {picking ? <ChooseHub /> : watching ? <WatchPanel /> : open ? PANELS[tab]() : <TeaserCard id={tab} />}
      </div>
    </>
  );
}

/** For a page with no company on screen: joining, watching from another tab, or a viewer who can't play. */
function WatchPanel(): JSX.Element {
  const lw = S.live!;
  const joining = lw.pending().find((r) => r.a.type === "join");
  return (
    <div class="stack">
      <h2>The live world</h2>
      {joining ? (
        <Card title="Registering your company">
          <p>
            Your leased truck is ready at {hhmm(joining.at)}, in {realUntil(lw.msUntil(joining.at))}.
          </p>
        </Card>
      ) : lw.lease === "busy" ? (
        <Card title="Open in another tab">
          <p>Your company is being run from another tab or device. This one is watching.</p>
          <div class="row">
            <Btn primary onClick={H.takeover}>
              Play here instead
            </Btn>
          </div>
        </Card>
      ) : lw.lease === "denied" ? (
        <Card title="Watching">
          <p>You can watch the live world. To run a company in it, ask the owner to share this page with you as a Contributor.</p>
        </Card>
      ) : (
        <Card title="Watching">
          <p>Sign in to claude.ai to run a company.</p>
        </Card>
      )}
      <p class="muted">Click a hub on the map to see its open loads on the Loads tab.</p>
    </div>
  );
}
