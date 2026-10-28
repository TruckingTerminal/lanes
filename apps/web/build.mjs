// Builds the game into one self-contained HTML page (for publishing) plus a local
// preview page with the document skeleton around it.
//   node apps/web/build.mjs [entry]      (entry defaults to main)
//   node apps/web/build.mjs --site       the test build for GitHub Pages → dist/site/index.html, plus docs.html
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const site = process.argv.includes("--site");
const entry = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "main";
const result = await build({
  entryPoints: [join(here, "src", `${entry}.ts`)],
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
const page = readFileSync(join(here, "src", "page.html"), "utf8").replace("<!--APP-->", () => `<script>${js}</script>`);
const skeleton = `<!doctype html><html lang="en"><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${page}</body></html>`;
if (site) {
  mkdirSync(join(here, "dist", "site"), { recursive: true });
  writeFileSync(join(here, "dist", "site", "index.html"), skeleton);
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
