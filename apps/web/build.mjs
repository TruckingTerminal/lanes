// Builds the game into one self-contained HTML page (for publishing) plus a local
// preview page with the document skeleton around it.
//   node apps/web/build.mjs [entry]      (entry defaults to main)
//   node apps/web/build.mjs --site       the test build for GitHub Pages → dist/site/index.html, plus docs.html
import { build } from "esbuild";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const site = process.argv.includes("--site");
const entry = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "main";
const result = await build({
  entryPoints: [join(here, "src", existsSync(join(here, "src", `${entry}.tsx`)) ? `${entry}.tsx` : `${entry}.ts`)],
  jsx: "automatic",
  jsxImportSource: "preact",
  // Pixel-art assets (apps/web/assets, from PixelLab) ride inside the single page as data URIs.
  loader: { ".png": "dataurl" },
  bundle: true,
  format: "iife",
  minify: true,
  platform: "browser",
  target: "es2020",
  write: false,
  legalComments: "none",
  define: { __LANES_TEST__: site ? "true" : "false" },
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
// A replacer function, so `$&`, `$'` and `$$` in the bundle are kept as written.
const themes = readFileSync(join(here, "src", "themes.css"), "utf8");
const page = readFileSync(join(here, "src", "page.html"), "utf8")
  .replace("/*THEMES*/", () => themes)
  .replace("<!--APP-->", () => `<script>${js}</script>`);
// The big paintings and the city sprites ride next to the page, not inside it (mapart.ts loads
// them from assets/): dist/site/assets for the test site, dist/assets for the local page, and the
// artifact's published files on claude.ai.
const assetsOut = join(here, "dist", site ? "site" : ".", "assets");
rmSync(assetsOut, { recursive: true, force: true });
let copied = 0;
// The map layers and the sprites ride outside the page whole; the scenes, people and the loading
// strip keep their stills inside it and only their loops outside.
const RULES = { map: (f) => f !== "l0-summer.png", cities: () => true, towns: () => true, scenes: (f) => f.endsWith(".loop.png"), people: (f) => f.endsWith(".loop.png"), loading: (f) => f.endsWith(".loop.png"), title: (f) => f.endsWith(".loop.png") };
for (const [sub, keep] of Object.entries(RULES)) {
  const src = join(here, "assets", sub);
  if (!existsSync(src)) continue;
  mkdirSync(join(assetsOut, sub), { recursive: true });
  for (const f of readdirSync(src)) {
    if (!f.endsWith(".png") || !keep(f)) continue;
    copyFileSync(join(src, f), join(assetsOut, sub, f));
    copied++;
  }
}
// The manifest tells the page which files exist, so it never asks for a sprite that was not painted yet.
const manifest = {};
for (const sub of Object.keys(RULES)) manifest[sub] = existsSync(join(assetsOut, sub)) ? readdirSync(join(assetsOut, sub)).filter((f) => f.endsWith(".png")) : [];
mkdirSync(assetsOut, { recursive: true });
writeFileSync(join(assetsOut, "manifest.json"), JSON.stringify(manifest));
console.log(`${assetsOut.replace(here + "/", "")}: ${copied} files`);
const skeleton = `<!doctype html><html lang="en"><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${page}</body></html>`;
if (site) {
  mkdirSync(join(here, "dist", "site"), { recursive: true });
  writeFileSync(join(here, "dist", "site", "index.html"), skeleton);
  // The same test build without the document skeleton, for publishing as a preview artifact.
  writeFileSync(join(here, "dist", "site", "test-page.html"), page);
  console.log(`dist/site/index.html: ${(skeleton.length / 1024).toFixed(0)} KB`);
  // The docs page: the guide's pages rendered here, at build time, from the same source as the Guide tab.
  const docs = await build({ entryPoints: [join(here, "src", "docs.ts")], bundle: true, format: "esm", platform: "node", write: false, legalComments: "none" });
  const { renderDocs } = await import(`data:text/javascript;base64,${Buffer.from(docs.outputFiles[0].text).toString("base64")}`);
  const html = renderDocs();
  writeFileSync(join(here, "dist", "site", "docs.html"), html);
  console.log(`dist/site/docs.html: ${(html.length / 1024).toFixed(0)} KB`);
} else {
  const out = entry === "main" ? "lanes.html" : `${entry}.html`;
  writeFileSync(join(here, "dist", out), page);
  writeFileSync(join(here, "dist", `local-${out}`), skeleton);
  console.log(`dist/${out}: ${(page.length / 1024).toFixed(0)} KB`);
}
