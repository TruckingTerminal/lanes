import { buildNetwork, hubs } from "@lanes/data";
import { economyConfig } from "@lanes/config";
import { drawTitleScene, facilitySprite, truckSprite, PAL } from "./art.js";
import { buildMap, MAP_W, MAP_H } from "./map.js";

// Art check page: title scene, the map, every truck and facility sprite.
const net = buildNetwork(hubs, economyConfig);
const root = document.getElementById("app")!;
root.style.cssText = `background:${PAL.ink1};padding:16px;display:flex;flex-direction:column;gap:16px`;
const title = document.createElement("canvas");
title.width = 256 * 3;
title.height = 144 * 3;
root.append(title);
const tctx = title.getContext("2d")!;
const loop = (t: number) => { drawTitleScene(tctx, 3, t); requestAnimationFrame(loop); };
requestAnimationFrame(loop);
const map = buildMap(hubs, (a, b) => net.miles[a * hubs.length + b]!);
const m = document.createElement("canvas");
m.width = MAP_W * 2;
m.height = MAP_H * 2;
const mctx = m.getContext("2d")!;
mctx.imageSmoothingEnabled = false;
mctx.drawImage(map.base, 0, 0, MAP_W * 2, MAP_H * 2);
root.append(m);
const row = document.createElement("div");
row.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;align-items:end";
for (const tier of ["workhorse", "highwayPro", "flagship"] as const)
  for (const tr of ["van", "reefer", "flatbed"] as const) row.append(truckSprite(tier, tr, false, PAL.amber, 3));
row.append(truckSprite("workhorse", "van", true, PAL.blue, 3));
for (const f of ["warehouse", "coldStorage", "factory"] as const) row.append(facilitySprite(f, 3));
root.append(row);
