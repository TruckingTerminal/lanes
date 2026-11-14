import "./seed.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Batch M3 (the producer: Iuliia's two new faces never loaded). Every path ui/kit.json names must be a file the build
 * copies next to the page and lists in its manifest, or the page reads it as absent and falls back without a word.
 * build.mjs copies only the files directly inside each assets folder its RULES name, each kept by that folder's rule,
 * and mapart.ts reads a path as "folder/file": a nested path can never ship. This reads build.mjs's own RULES line, so
 * a change to the build's rules is checked too.
 */
const web = join(__dirname, "..");
const kit = JSON.parse(readFileSync(join(web, "assets", "ui", "kit.json"), "utf8")) as {
  kit: { image: string };
  fx: { image: string };
  icons: { image: string };
  badges: { image: string };
  windows: Record<string, { image: string }>;
  loops: Record<string, { image: string }>;
  iuliia?: { breathe: { image: string }; faces: Record<string, string> };
};
const build = readFileSync(join(web, "build.mjs"), "utf8");
const rulesLine = build.split("\n").find((l) => l.startsWith("const RULES = "))!;
const RULES = new Function(`${rulesLine.replace("const RULES = ", "return ")}`)() as Record<string, (f: string) => boolean>;
const withJson = /const WITH_JSON = new Set\(\[([^\]]*)\]\)/.exec(build)?.[1]?.match(/"([a-z]+)"/g)?.map((x) => x.slice(1, -1)) ?? [];

/** Every image path the kit names, with where it's named. */
function paths(): [string, string][] {
  const out: [string, string][] = [];
  for (const a of ["kit", "fx", "icons", "badges"] as const) out.push([a, kit[a].image]);
  for (const [f, v] of Object.entries(kit.windows)) out.push([`windows.${f}`, v.image]);
  for (const [id, v] of Object.entries(kit.loops)) out.push([`loops.${id}`, v.image]);
  if (kit.iuliia) {
    out.push(["iuliia.breathe", kit.iuliia.breathe.image]);
    for (const [m, p] of Object.entries(kit.iuliia.faces)) out.push([`iuliia.faces.${m}`, p]);
  }
  return out;
}

describe("every file ui/kit.json names ships with the page", () => {
  it("reads the build's rules", () => {
    expect(Object.keys(RULES)).toEqual(expect.arrayContaining(["ui", "windows", "people", "scenes"]));
    expect(withJson).toContain("ui");
  });

  it("each is folder/file (no nesting), on disk, in a folder the build copies, and kept by that folder's rule", () => {
    const bad: string[] = [];
    for (const [where, p] of paths()) {
      const parts = p.split("/");
      const [sub, file] = parts;
      if (parts.length !== 2) bad.push(`${where}: ${p} is nested; the build copies only a folder's own files`);
      else if (!existsSync(join(web, "assets", p))) bad.push(`${where}: ${p} isn't in apps/web/assets`);
      else if (!RULES[sub!]) bad.push(`${where}: ${p}: the build copies no "${sub}" folder`);
      else if (!(file!.endsWith(".png") || (withJson.includes(sub!) && file!.endsWith(".json"))) || !RULES[sub!]!(file!)) bad.push(`${where}: ${p}: the "${sub}" rule doesn't keep it`);
    }
    expect(bad).toEqual([]);
  });

  it("the kit's own JSON ships too", () => {
    expect(RULES.ui!("kit.json")).toBe(true);
    expect(withJson).toContain("ui");
  });
});
