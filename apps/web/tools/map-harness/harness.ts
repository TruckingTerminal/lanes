import { economyConfig } from "@lanes/config";
import { buildNetwork, hubs } from "@lanes/data";
import { buildMap } from "../../src/map.js";

/**
 * Renders the code-drawn base map at a chosen size so a region can be cut out and
 * repainted by PixelLab (the style samples, then the painted map). Served by
 * mapsrv/serve.py in the scratchpad, which saves anything POSTed to /save.
 */

const net = buildNetwork(hubs, economyConfig);
const q = new URLSearchParams(location.search);
const W = Number(q.get("w") ?? 1536);
const H = Number(q.get("h") ?? 1024);
const t0 = performance.now();
const art = buildMap(net.hubs, net.roads, W, H, net.places);
const ms = Math.round(performance.now() - t0);

const stage = document.getElementById("stage") as HTMLCanvasElement;
stage.width = W;
stage.height = H;
stage.getContext("2d")!.drawImage(art.base, 0, 0);

const marks: Record<string, [number, number]> = {};
for (const h of net.hubs) marks[h.id] = art.project(h.lon, h.lat).map(Math.round) as [number, number];
const info = document.getElementById("info")!;
info.textContent = `${W}×${H} in ${ms} ms; hubs: ` + Object.entries(marks).map(([k, [x, y]]) => `${k}@${x},${y}`).join(" ");

/** Crops (x, y, w, h) of the base and POSTs it as a PNG to the harness server. */
async function save(name: string, x: number, y: number, w: number, h: number): Promise<string> {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(art.base, x, y, w, h, 0, 0, w, h);
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
  const r = await fetch(`/save?name=${encodeURIComponent(name)}`, { method: "POST", body: blob });
  return `${name}: ${r.status} ${blob.size} bytes`;
}
(window as unknown as { save: typeof save; marks: typeof marks; art: typeof art }).save = save;
(window as unknown as { marks: typeof marks }).marks = marks;
(window as unknown as { art: typeof art }).art = art;
