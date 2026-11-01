import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { fitMap, maxZoom, mountMap, setZoom, zoomIndex, zoomLabel } from "../mapview.js";
import { S, useData } from "../state.js";
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
      <CityPane />
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
