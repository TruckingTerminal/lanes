import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { fitMap, followed, mapPainted, maxZoom, mountMap, setZoom, zoomIndex, zoomLabel } from "../mapview.js";
import { ROLLING } from "../copy.js";
import { ASSETS, hasAsset } from "../mapart.js";
import { bumpData, S, useData } from "../state.js";
import { Btn } from "./bits.js";
import { CityPane } from "./CityPane.js";

/** The map region: the canvas mapview.ts draws on every frame, its zoom controls and the city pane over it. */
export function MapView(): JSX.Element {
  useData();
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  useEffect(() => mountMap(canvas.current!, wrap.current!, tip.current!), []);
  useEffect(() => {
    fitMap();
  }, [S.layout]);
  return (
    <div class="mapwrap" ref={wrap}>
      <canvas id="map" ref={canvas} width={960} height={600} aria-label="Map of hubs and trucks" />
      <div id="tip" ref={tip} hidden />
      <Finding />
      <CityPane />
      {!S.following && S.game?.player && followed() ? (
        <div class="mapfollow">
          <Btn
            sm
            onClick={() => {
              S.following = true;
              bumpData();
            }}
          >
            {ROLLING.follow}
          </Btn>
        </div>
      ) : null}
      <div class="mapzoom" role="group" aria-label="Map zoom">
        <Btn sm title="Zoom out (-)" disabled={zoomIndex() === 0} onClick={() => setZoom(zoomIndex() - 1)}>
          −
        </Btn>
        <span class="label" aria-live="polite">
          {zoomLabel()}
        </span>
        <Btn sm title="Zoom in (+, wheel or double-click)" disabled={maxZoom()} onClick={() => setZoom(zoomIndex() + 1)}>
          +
        </Btn>
        <Btn sm title="Whole map (0)" disabled={zoomIndex() === 0} onClick={() => setZoom(0)}>
          Fit
        </Btn>
      </div>
    </div>
  );
}

/** Until the map's painting is up (S1): the home hub's own picture and "Finding Dallas…", not an empty box. */
function Finding(): JSX.Element | null {
  const c = S.game?.player;
  if (!c || mapPainted()) return null;
  const hub = S.game!.w.net.hubs[c.homeHub]!;
  return (
    <div class="finding">
      {hasAsset(`cityviews/${hub.id}.png`) ? <img class="px" src={`${ASSETS}cityviews/${hub.id}.png`} alt="" /> : null}
      <p class="small">Finding {hub.name}…</p>
    </div>
  );
}
