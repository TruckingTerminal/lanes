import { economyConfig } from "@lanes/config";
import { GAME_CONFIG } from "./game.js";
import { guidePages } from "./guide.js";

/**
 * The docs page for the test site: every guide page on one screen, with a table
 * of contents. Rendered at build time (build.mjs --site), from the same pages
 * as the in-game Guide tab.
 */
export function renderDocs(): string {
  const pages = guidePages(GAME_CONFIG);
  const sections = [...new Set(pages.map((p) => p.section))];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const toc = sections
    .map((s) => `<li><span>${esc(s)}</span><ul>${pages.filter((p) => p.section === s).map((p) => `<li><a href="#${p.id}">${esc(p.title)}</a></li>`).join("")}</ul></li>`)
    .join("");
  const body = sections
    .map(
      (s) =>
        `<h2>${esc(s)}</h2>${pages
          .filter((p) => p.section === s)
          .map((p) => `<section id="${p.id}"><h3>${esc(p.title)}</h3>${p.html.replace(/ data-act="guide" data-page="[^"]*"/g, "")}</section>`)
          .join("")}`,
    )
    .join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LANES docs</title>
<meta name="description" content="How LANES works: the freight market, running trucks, staff, growth, money, and safety.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600&family=Press+Start+2P&display=swap">
<style>
:root { --ink0: #090c17; --ink1: #10172a; --ink2: #1a2340; --ink3: #283659; --fog: #7b8db0; --paper: #ece4cf; --amber: #f4a83c; --gold: #ffd96a; --cyan: #7fdcea; --lime: #a9dc62; --red: #d84a3a; }
* { box-sizing: border-box; }
html { scroll-padding-top: 16px; }
body { margin: 0; background: var(--ink1); color: var(--paper); font-family: "Pixelify Sans", "Trebuchet MS", system-ui, sans-serif; font-size: 17px; line-height: 1.5; }
a { color: var(--cyan); }
.wrap { max-width: 1080px; margin: 0 auto; padding: 24px 16px 64px; display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 32px; }
header { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px 24px; border-bottom: 2px solid var(--ink3); padding-bottom: 16px; }
h1, h2, h3 { font-family: "Press Start 2P", ui-monospace, monospace; font-weight: 400; line-height: 1.4; }
h1 { font-size: 24px; color: var(--amber); margin: 0; text-shadow: 3px 3px 0 var(--ink0); }
h2 { font-size: 16px; color: var(--amber); margin: 40px 0 8px; text-transform: uppercase; letter-spacing: 0.06em; text-shadow: 2px 2px 0 var(--ink0); }
h3 { font-family: "Pixelify Sans", "Trebuchet MS", system-ui, sans-serif; font-weight: 600; font-size: 20px; margin: 0 0 10px; color: var(--paper); }
h4 { font-family: "Press Start 2P", ui-monospace, monospace; font-weight: 400; font-size: 8px; color: var(--amber); margin: 14px 0 6px; }
nav { position: sticky; top: 16px; align-self: start; max-height: calc(100vh - 32px); overflow: auto; font-size: 15px; }
nav ul { list-style: none; margin: 0; padding: 0; }
nav > ul > li { margin-bottom: 12px; }
nav > ul > li > span { font-family: "Press Start 2P", monospace; font-size: 8px; color: var(--fog); text-transform: uppercase; letter-spacing: 0.08em; }
nav ul ul li { margin: 3px 0; }
section { background: var(--ink2); border: 2px solid var(--ink0); box-shadow: inset 2px 2px 0 var(--ink3), inset -2px -2px 0 var(--ink1); padding: 16px; margin: 12px 0; }
section p { margin: 0 0 10px; }
section ul { margin: 0 0 10px; padding-left: 22px; }
section li { margin: 4px 0; }
table { border-collapse: collapse; width: 100%; font-size: 15px; margin: 4px 0 10px; display: block; overflow-x: auto; }
td, th { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--ink3); vertical-align: top; }
th { font-family: "Press Start 2P", monospace; font-size: 8px; color: var(--fog); font-weight: 400; }
.good { color: var(--lime); } .bad { color: var(--red); }
.muted { color: var(--fog); }
@media (max-width: 760px) { .wrap { grid-template-columns: 1fr; } nav { position: static; max-height: none; } }
</style></head>
<body><div class="wrap">
<header><h1>LANES docs</h1><span class="muted">Rules as of config ${esc(economyConfig.version)}</span><a href="./">Play the test build</a></header>
<nav aria-label="Contents"><ul>${toc}</ul></nav>
<main>${body}</main>
</div></body></html>`;
}
