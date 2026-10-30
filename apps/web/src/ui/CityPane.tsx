import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Equipment } from "@lanes/config";
import type { Sector } from "@lanes/data";
import { EQUIPMENT, planIndex, seasonality } from "@lanes/engine";
import { ASSETS, hasAsset, LOOP_FPS, townKindAt, type TownKind } from "../mapart.js";
import { bumpData, clockMin, S, setTab, useData } from "../state.js";
import { cls, hhmm, pct, signedPct, TRAILER_NAME } from "../format.js";
import { isHuman } from "../game.js";
import { openLoadsAt, reloadLabel } from "../logic.js";
import { weatherAt, weatherLabel } from "../weather.js";
import { Bar, Btn, Card } from "./bits.js";
import { seasonNow, Sky } from "./Loop.js";
import { BAND_LABEL, bandOf, CityPicture } from "./CityPicture.js";
import { HubLoadsTable } from "./panels/Loads.js";

/**
 * The pane that opens when a city or town is clicked on the map: the hub's big painted view
 * (688 × 384, tools/paint-cityviews.py, its real landmarks under the summer golden hour the whole
 * set shares) with the hub's own weather drawn live over it and a tint for the season until the
 * painted seasons come, then everything about that market in three tabs: what it ships and how
 * its freight balances, the trucks in and out and the market right now; the year's seasonal highs
 * and lulls per trailer; and the loads on its board. A town opens on the market it trades on.
 */

const SECTOR_NAME: Record<Sector, string> = { retail: "Retail goods", food: "Food and produce", industrial: "Industrial", energy: "Energy", auto: "Automotive", import: "Imports (port)" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
type Tab = "market" | "seasons" | "loads";

export function closeCity(): void {
  S.cityView = null;
  S.townView = null;
  bumpData();
}

export function CityPane(): JSX.Element | null {
  useData();
  const g = S.game;
  const i = S.cityView;
  const [tab, setPaneTab] = useState<Tab>("market");
  if (!g || i === null) return null;
  const w = g.w;
  const hub = w.net.hubs[i]!;
  const town = S.townView !== null ? w.net.places[S.townView] : null;
  const season = seasonNow();
  const minute = clockMin();
  const day = Math.floor(minute / 1440);
  const wx = weatherAt(hub.lon, hub.lat, day, (minute / 60) % 24, w.seed);
  const painted = hasAsset(`cityviews/${hub.id}.png`);
  return (
    // A fresh press on the backdrop closes the pane (the press that opened it ends as a click on the
    // backdrop, since the pane renders between its pointerup and its click, so clicks don't count).
    <div class="cityview" onPointerDown={closeCity}>
      <div class={cls("citybox", `season-${season}`, town ? "town" : "")} role="dialog" aria-label={town ? town.name : hub.name} onPointerDown={(ev) => ev.stopPropagation()}>
        {town ? (
          <div class="townhead">
            <TownLoop kind={townKindAt(town.lon, town.lat, false)} scale={2} />
            <div class="towntitle">
              <h2>
                {town.name}, {town.state}
              </h2>
              <div class="muted">
                Population {town.pop.toLocaleString()} · {weatherLabel(wx)}
              </div>
              <div>
                Its freight trades on the <b>{hub.name}</b> board: everything below is that market.
              </div>
              <Btn
                sm
                onClick={() => {
                  S.townView = null;
                  bumpData();
                }}
              >
                Open {hub.name}
              </Btn>
            </div>
          </div>
        ) : (
          <div class="citypic">
            {painted ? <CityPicture hub={i} /> : <div class="citypending">{hub.name}</div>}
            <Sky hub={i} w={688} h={384} />
            <div class="citycap">
              <b>{hub.name}</b>
              <span class="muted">
                {" "}
                · {hhmm(minute)}, {BAND_LABEL[bandOf((minute / 60) % 24)]} · {weatherLabel(wx)}
              </span>
            </div>
          </div>
        )}
        <div class="citytabs" role="tablist">
          {(["market", "seasons", "loads"] as Tab[]).map((t) => (
            <Btn sm on={tab === t} onClick={() => setPaneTab(t)}>
              {t === "market" ? "Market" : t === "seasons" ? "Seasons" : `Loads (${openLoadsAt(i).length})`}
            </Btn>
          ))}
          <span class="grow" />
          <Btn
            sm
            primary
            onClick={() => {
              setTab("loads");
              closeCity();
            }}
          >
            Book here
          </Btn>
          <Btn sm title="Close (Esc)" onClick={closeCity}>
            Close
          </Btn>
        </div>
        <div class="citybody">{tab === "market" ? <MarketTab hub={i} /> : tab === "seasons" ? <SeasonsTab hub={i} /> : <HubLoadsTable hub={i} />}</div>
      </div>
    </div>
  );
}

/** What the market ships, how its freight balances, the trucks in and out of it and the board right now. */
function MarketTab({ hub: i }: { hub: number }): JSX.Element {
  const w = S.game!.w;
  const hub = w.net.hubs[i]!;
  const day = Math.floor(clockMin() / 1440);
  const sectors = (Object.entries(hub.sectorWeights) as [Sector, number][]).sort((a, b) => b[1] - a[1]);
  const open = openLoadsAt(i);
  const humans = new Set(w.companies.filter(isHuman).map((c) => c.id));
  const mine = S.game!.player?.id ?? -1;
  const count = { here: 0, in: 0, out: 0, hereMine: 0, inMine: 0, outMine: 0, hereAi: 0, inAi: 0, outAi: 0 };
  for (const t of w.trucks) {
    if (t.status === "retired") continue;
    const k = t.status === "idle" ? (t.hub === i ? "here" : null) : t.targetHub === i && t.hub !== i ? "in" : t.hub === i ? "out" : null;
    if (!k) continue;
    count[k]++;
    if (t.companyId === mine) count[`${k}Mine`]++;
    else if (!humans.has(t.companyId)) count[`${k}Ai`]++;
  }
  const share = (w.net.hubs.reduce((s, h) => s + h.weight, 0) && hub.weight / w.net.hubs.reduce((s, h) => s + h.weight, 0)) || 0;
  return (
    <div class="citygrid">
      <Card title="What it ships">
        <div class="muted small">{pct(share)} of the country's freight starts here{hub.isStarter ? " · a starter hub" : ""}.</div>
        {sectors.map(([s, v]) => (
          <div class="sectorrow">
            <span>{SECTOR_NAME[s]}</span>
            <Bar share={v} />
            <span class="num">{pct(v)}</span>
          </div>
        ))}
      </Card>
      <Card title="Out against in">
        <div class="muted small">Freight shipped out for every load that comes in, by trailer. Above 1 the market produces more than it consumes: trucks reload easily here.</div>
        {EQUIPMENT.map((eq) => {
          const r = hub.imbalance[eq];
          return (
            <div class="sectorrow">
              <span>{TRAILER_NAME[eq]}</span>
              <Bar share={r / 2} tone={r >= 1.1 ? "var(--accent-success)" : r <= 0.9 ? "var(--accent-danger)" : undefined} />
              <span class="num">
                {r.toFixed(2)} : 1 <span class="muted">{r >= 1.1 ? "produces" : r <= 0.9 ? "consumes" : "balanced"}</span>
              </span>
            </div>
          );
        })}
      </Card>
      <Card title="Trucks">
        <table class="mini">
          <thead>
            <tr>
              <th />
              <th>All</th>
              <th>Mine</th>
              <th>AI</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sitting here</td>
              <td>{count.here}</td>
              <td>{count.hereMine}</td>
              <td>{count.hereAi}</td>
            </tr>
            <tr>
              <td>Inbound</td>
              <td>{count.in}</td>
              <td>{count.inMine}</td>
              <td>{count.inAi}</td>
            </tr>
            <tr>
              <td>Outbound</td>
              <td>{count.out}</td>
              <td>{count.outMine}</td>
              <td>{count.outAi}</td>
            </tr>
          </tbody>
        </table>
        <div class="muted small">
          {count.in > count.out ? "More trucks are heading in than out: expect a crowded board." : count.out > count.in ? "More trucks leaving than arriving: the board thins out." : "Trucks in and out are even."}
        </div>
      </Card>
      <Card title="The board right now">
        <table class="mini">
          <thead>
            <tr>
              <th>Trailer</th>
              <th>Open</th>
              <th>Loads per truck</th>
              <th>Reload</th>
              <th>Season</th>
            </tr>
          </thead>
          <tbody>
            {EQUIPMENT.map((eq, e) => {
              const ratio = w.lastRatioEq[planIndex(i, e)] ?? 1;
              const swing = seasonality(w, i, eq, day).rate - 1;
              const label = reloadLabel(i, eq);
              return (
                <tr>
                  <td>{TRAILER_NAME[eq]}</td>
                  <td>{open.filter((l) => l.equipment === eq).length}</td>
                  <td>{ratio.toFixed(2)}</td>
                  <td class={label === "good" ? "good" : label === "poor" ? "bad" : ""}>{label}</td>
                  <td class={swing > 0.03 ? "good" : swing < -0.03 ? "bad" : ""}>{Math.abs(swing) < 0.01 ? "normal" : signedPct(swing)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/** The market's year: each trailer's rate swing month by month, its strongest stretch and its lull. */
function SeasonsTab({ hub: i }: { hub: number }): JSX.Element {
  const w = S.game!.w;
  const D = w.cfg.time.daysPerSeason;
  const day = Math.floor(clockMin() / 1440);
  const year0 = day - (day % D);
  const monthNow = Math.min(11, Math.floor((day % D) / (D / 12)));
  return (
    <div class="seasons">
      <div class="muted small">Posted rates against the market's yearly average, month by month. Volume moves with them: a strong month also has more loads on the board.</div>
      {EQUIPMENT.map((eq) => {
        const swings = MONTHS.map((_, m) => seasonality(w, i, eq, Math.round(year0 + (m + 0.5) * (D / 12))).rate - 1);
        const hi = swings.indexOf(Math.max(...swings));
        const lo = swings.indexOf(Math.min(...swings));
        const peak = Math.max(0.01, ...swings.map(Math.abs));
        return (
          <div class="seasonrow">
            <div class="seasonname">
              <b>{TRAILER_NAME[eq]}</b>
              <div class="muted small">
                Strongest {MONTHS[hi]} ({signedPct(swings[hi]!)}), lull {MONTHS[lo]} ({signedPct(swings[lo]!)})
              </div>
            </div>
            <div class="seasonbars">
              {swings.map((s, m) => (
                <div class={cls("sbar", m === monthNow ? "now" : "")} title={`${MONTHS[m]}: ${signedPct(s)}`}>
                  <div class="sbarbox">
                    <i class={s >= 0 ? "up" : "down"} style={{ height: `${Math.round((Math.abs(s) / peak) * 48)}%` }} />
                  </div>
                  <span>{MONTHS[m]![0]}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A town's sprite with its loop, the way the map draws it. */
function TownLoop({ kind, scale }: { kind: TownKind; scale: number }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  const sheet = hasAsset(`towns/${kind}.loop.png`);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const img = new Image();
    img.src = `${ASSETS}towns/${kind}${sheet ? ".loop" : ""}.png`;
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!img.complete || !img.naturalWidth) return;
      const fw = sheet ? img.width / 4 : img.width;
      const fh = sheet ? img.height / 4 : img.height;
      const f = sheet ? Math.floor((now / 1000) * LOOP_FPS) % 16 : 0;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, (f % 4) * fw, Math.floor(f / 4) * fh, fw, fh, 0, 0, cv.width, cv.height);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [kind, sheet]);
  return <canvas ref={ref} class="townpic" width={128 * scale} height={128 * scale} aria-hidden="true" />;
}

export type { Equipment };
