import { buildNetwork, hubs } from "@lanes/data";
import { economyConfig } from "@lanes/config";
import { drawTitleScene, facilitySprite, frameUrl, icon, installTheme, logo, truckSprite, PAL, TITLE_H, TITLE_W } from "./art.js";
import { buildMap, truckMarkers } from "./map.js";

// Art check page: title scene and logo, the map, every sprite, icon, marker and frame.
installTheme();
const net = buildNetwork(hubs, economyConfig);
const root = document.getElementById("app")!;
root.style.cssText = `background:${PAL.ink1};padding:16px;display:flex;flex-direction:column;gap:16px;image-rendering:pixelated`;
const title = document.createElement("canvas");
title.width = TITLE_W * 3;
title.height = TITLE_H * 3;
root.append(title);
const tctx = title.getContext("2d")!;
const loop = (t: number) => {
  drawTitleScene(tctx, 3, t);
  const lg = logo(6);
  tctx.drawImage(lg, Math.round((title.width - lg.width) / 2), 36);
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
const t0 = performance.now();
const map = buildMap(hubs, net.roads, 1000, 620);
console.info(`map painted in ${Math.round(performance.now() - t0)} ms`);
const m = document.createElement("canvas");
m.width = map.W;
m.height = map.H;
m.style.width = `${map.W}px`;
m.getContext("2d")!.drawImage(map.base, 0, 0);
root.append(m);
const row = document.createElement("div");
row.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;align-items:end";
for (const tier of ["workhorse", "highwayPro", "flagship"] as const)
  for (const tr of ["van", "reefer", "flatbed"] as const) row.append(truckSprite(tier, tr, false, PAL.amber, 3));
row.append(truckSprite("workhorse", "van", true, PAL.blue, 3));
for (const f of ["warehouse", "coldStorage", "factory"] as const) row.append(facilitySprite(f, 3));
root.append(row);
const icons = document.createElement("div");
icons.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;align-items:end";
for (const n of ["fd", "miles", "usd", "clock", "truck", "board", "people", "tag", "money", "building", "book", "alert", "home", "pin", "moon", "sun", "fuel", "wrench", "pause", "play", "ff", "fff", "plus", "minus", "fit", "star", "full", "x"]) icons.append(icon(n, 4));
root.append(icons);
const markers = document.createElement("div");
markers.style.cssText = "display:flex;flex-wrap:wrap;gap:16px;align-items:center";
for (const kind of ["mine", "other", "ai"] as const) for (const tr of ["van", "reefer", "flatbed"] as const) for (const c of truckMarkers(kind, tr, 4)) markers.append(c);
root.append(markers);
const frames = document.createElement("div");
frames.style.cssText = "display:flex;flex-wrap:wrap;gap:16px;align-items:center";
for (const [k, slice] of [["panel", 12], ["hud", 8], ["map", 12], ["card", 8], ["cardSel", 8], ["cardAlert", 8], ["btn", 6], ["btnPrimary", 6], ["input", 6], ["ticker", 8], ["toast", 8], ["tip", 6]] as const) {
  const d = document.createElement("div");
  d.textContent = k;
  d.style.cssText = `color:${PAL.paper};font:16px "Pixelify Sans",sans-serif;padding:8px 14px;border:${slice}px solid transparent;border-image:url("${frameUrl(k)}") ${slice} fill / ${slice}px;image-rendering:pixelated`;
  frames.append(d);
}
root.append(frames);
