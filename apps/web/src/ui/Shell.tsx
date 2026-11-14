import type { JSX } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { motion } from "../motion.js";
import { ordersWaitForHand } from "@lanes/engine";
import { FEED } from "../copy.js";
import { cls } from "../format.js";
import { sheetLine } from "../logic.js";
import { setMapInset } from "../mapview.js";
import { PHONE_QUERY, S, setSheet, useData, type SheetStop, todaysTicker } from "../state.js";
import { MapView } from "./MapRegion.js";
import { Nav, RackBody, SideRack } from "./Rack.js";
import { TopBar } from "./TopBar.js";

/**
 * The game screen, as regions (the top bar, the map, the rack, the ticker, the toast) that a layout places.
 * The laptop's is the split board (S.layout narrows it to the map or the panel); the phone's is the map full
 * screen with the panel in a sheet over it and the nav at the bottom. No panel is forked to move between them.
 */
export function GameScreen(): JSX.Element {
  useData();
  const phone = usePhone();
  return phone ? <PhoneLayout /> : <SplitLayout top={<TopBar />} map={<MapView />} rack={<SideRack />} ticker={<Ticker />} toast={<Toast />} />;
}

/** Whether the phone layout applies, following the window across the breakpoint. */
function usePhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const f = () => setPhone(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return phone;
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
      {/* Before a company exists there is nothing to tick (S10). */}
      {S.game?.player ? ticker : null}
      {toast}
    </>
  );
}

/**
 * The phone (specs/first-ten-minutes.md, Layout): the 44 px strip, the map behind everything at its full size, a
 * sheet over it, the nav at the bottom. The map never resizes as the sheet moves, so it never repaints for it.
 */
function PhoneLayout(): JSX.Element {
  return (
    <div class="phone">
      <TopBar />
      <div class="phonemap">
        <MapView />
      </div>
      <Sheet />
      <Nav />
      <Toast />
    </div>
  );
}

const STOPS: SheetStop[] = ["strip", "half", "full"];
/** The sheet's height in px at a stop, given the room between the top strip and the nav. */
function stopPx(stop: SheetStop, room: number): number {
  return stop === "strip" ? Math.min(88, room) : stop === "half" ? Math.round(room / 2) : room;
}

/**
 * The sheet: a drag handle and the state line (all the strip shows), then Iuliia's caption and the panel. Drag the
 * handle to any height and it settles on the nearest stop; a tap on the handle toggles the strip and half.
 */
function Sheet(): JSX.Element {
  useData();
  const el = useRef<HTMLElement>(null);
  // The drag in progress: where it started, the sheet's height then, and its height now (null until it moves).
  const drag = useRef<{ y: number; h: number; now: number | null } | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const room = () => (el.current?.parentElement ? roomPx(el.current.parentElement) : window.innerHeight - 100);
  // The map keeps what it centres on above the sheet once the sheet settles (and nothing hidden when it goes).
  useEffect(() => {
    setMapInset(stopPx(S.sheet, room()));
    // At strip height the sheet shows its top, Iuliia's caption, wherever the panel was scrolled to.
    if (S.sheet === "strip") el.current?.querySelector(".sheetbody")?.scrollTo({ top: 0 });
  }, [S.sheet]);
  useEffect(() => () => setMapInset(0), []);
  // Batch M2 (QA: the sheet animated its height; the menu system §2.1 and §5.4: motion is transform and opacity only).
  // A snap changes the sheet's height once, and the move is a translate: growing, it takes its new height at once and
  // slides up from where it stood; shrinking, it keeps its old height while it slides down, then takes the new one. The
  // part below the slide passes under the tab bar (z 15 over the sheet's 12). Full: 280 ms with the snap's overshoot;
  // Calm: 120 ms without; Still: at once. A drag moves it by hand, as before.
  const lastH = useRef<number | null>(null);
  useLayoutEffect(() => {
    const node = el.current;
    const to = stopPx(S.sheet, room());
    const from = lastH.current;
    lastH.current = to;
    const m = motion();
    if (!node || from === null || Math.abs(from - to) < 1 || m === "still" || live !== null) return;
    const ms = m === "full" ? 280 : 120;
    const ease = m === "full" ? "var(--ease-snap, cubic-bezier(.3,1.25,.5,1))" : "ease-out";
    node.style.transition = "none";
    if (to > from) {
      node.style.transform = `translateY(${to - from}px)`;
      void node.offsetHeight;
      node.style.transition = `transform ${ms}ms ${ease}`;
      node.style.transform = "";
    } else {
      node.style.height = `${from}px`;
      node.style.transform = "translateY(0)";
      void node.offsetHeight;
      node.style.transition = `transform ${ms}ms ${m === "full" ? "var(--ease-in, ease-in)" : "ease-out"}`;
      node.style.transform = `translateY(${from - to}px)`;
    }
    // The end, or its timer: the transition is cut first, so the sheet lands at once even where frames don't run (a
    // hidden tab freezes a transition mid-flight), and never stays offset.
    const done = () => {
      node.removeEventListener("transitionend", done);
      node.style.transition = "none";
      node.style.transform = "";
      node.style.height = "";
      void node.offsetHeight;
      node.style.transition = "";
    };
    node.addEventListener("transitionend", done);
    const t = setTimeout(done, ms + 80);
    return () => clearTimeout(t);
  }, [S.sheet]);
  const down = (ev: PointerEvent) => {
    try {
      (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    } catch {
      /* no capture for this pointer: the drag still follows it over the handle */
    }
    drag.current = { y: ev.clientY, h: el.current?.getBoundingClientRect().height ?? stopPx(S.sheet, room()), now: null };
  };
  const move = (ev: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - ev.clientY;
    if (d.now === null && Math.abs(dy) <= 4) return;
    d.now = Math.max(stopPx("strip", room()), Math.min(room(), d.h + dy));
    setLive(d.now);
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    setLive(null);
    if (d.now === null) {
      setSheet(S.sheet === "strip" ? "half" : "strip");
      return;
    }
    const h = d.now;
    const r = room();
    setSheet(STOPS.reduce((best, s) => (Math.abs(stopPx(s, r) - h) < Math.abs(stopPx(best, r) - h) ? s : best), "half" as SheetStop));
  };
  return (
    <section ref={el} class={cls("sheet", S.sheet, live !== null && "dragging")} style={live !== null ? { height: `${live}px` } : undefined} aria-label="Panel">
      <div class="sheethandle" role="button" aria-label="Drag to resize; tap to open or close" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <span class="grip" aria-hidden="true" />
        <span class="sheetline">{sheetLine()}</span>
      </div>
      <div
        class="sheetbody"
        onClick={(ev) => {
          // At strip height her caption is face · text · What now? (guidance-ux.md section 1): a tap on the face or
          // the text raises the sheet to half, where her own button is.
          const t = ev.target as HTMLElement;
          if (S.sheet === "strip" && t.closest(".caption") && !t.closest("button")) setSheet("half");
        }}
      >
        <RackBody />
      </div>
    </section>
  );
}
/** The room for the sheet: the phone's height between the top strip and the nav. */
function roomPx(phone: HTMLElement): number {
  const top = phone.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 44;
  const nav = phone.querySelector(".tabs")?.getBoundingClientRect().top ?? window.innerHeight - 56;
  return Math.max(120, nav - top);
}

/** The ticker with nothing in it: before the first bid by hand, the first load is the player's call (S1). */
function quiet(): string {
  const g = S.game!;
  const [r1, r2] = g.w.cfg.time.boardRoundHours.map((h) => `${String(h).padStart(2, "0")}:00`);
  if (g.player && ordersWaitForHand(g.w, g.player)) return FEED.firstLoad(r1!, r2!);
  // The switch off (S9): no bid rule, so nobody bids for the idle trucks.
  if (g.player && !g.player.orders.some((o) => o.kind === "bid")) return FEED.off(r1!, r2!);
  return FEED.watching(r1!, r2!);
}

function Ticker(): JSX.Element {
  useData();
  // Client batch 8b item 37: the company in view's lines. Client batch X2: today's, from midnight, as Today's are.
  const items = todaysTicker().slice(0, 8);
  return (
    <footer class="ticker" aria-live="polite">
      {items.length ? items.map((t, i) => <span class={t.cls} key={i}>{t.text}</span>) : <span class="muted">{quiet()}</span>}
    </footer>
  );
}

function Toast(): JSX.Element | null {
  useData();
  const t = S.toast;
  if (!t) return null;
  return <div class={cls("toast", t.err && "err")}>{t.text}</div>;
}
