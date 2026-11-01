import type { JSX } from "preact";
import { cls } from "../format.js";
import { feed, S, useData } from "../state.js";
import { MapView } from "./MapRegion.js";
import { SideRack } from "./Rack.js";
import { TopBar } from "./TopBar.js";

/**
 * The game screen, as regions (the top bar, the map, the rack, the ticker, the toast) that a layout places.
 * One layout today, the split board that S.layout narrows to the map or the panel; a phone layout is another
 * function over the same regions, so no panel is forked to move it.
 */
export function GameScreen(): JSX.Element {
  useData();
  return <SplitLayout top={<TopBar />} map={<MapView />} rack={<SideRack />} ticker={<Ticker />} toast={<Toast />} />;
}

interface Regions {
  top: JSX.Element;
  map: JSX.Element;
  rack: JSX.Element;
  ticker: JSX.Element;
  toast: JSX.Element;
}

function SplitLayout({ top, map, rack, ticker, toast }: Regions): JSX.Element {
  const layout = S.layout;
  return (
    <>
      {top}
      <main class={cls("board", layout)}>
        <div hidden={layout === "panel"} style={{ minWidth: 0 }}>
          {map}
        </div>
        <div hidden={layout === "map"} style={{ minWidth: 0 }}>
          {rack}
        </div>
      </main>
      {ticker}
      {toast}
    </>
  );
}

function Ticker(): JSX.Element {
  useData();
  const f = feed();
  const items = f.ticker.slice(0, 8);
  return (
    <footer class="ticker" aria-live="polite">
      {items.length ? items.map((t, i) => <span class={t.cls} key={i}>{t.text}</span>) : <span class="muted">Your dispatcher is watching the board. Bids clear at 06:00 and 18:00.</span>}
    </footer>
  );
}

function Toast(): JSX.Element | null {
  useData();
  const t = S.toast;
  if (!t) return null;
  return <div class={cls("toast", t.err && "err")}>{t.text}</div>;
}
