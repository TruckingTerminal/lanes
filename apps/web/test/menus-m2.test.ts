import "./seed.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Batch M2, QA's replay on M1 (qa-0251-menus-2026-11-14.md): the motion rules §2.1 and §2.6 ask for. */
const page = readFileSync(join(__dirname, "..", "src", "page.html"), "utf8");

describe("batch M2", () => {
  it("Calm transitions opacity only, never 'all'; the sheet no longer animates its height", () => {
    const calm = page.split("\n").find((l) => l.startsWith('html[data-motion="calm"] *'))!;
    expect(calm).toContain("transition-property: opacity !important");
    const sheet = page.split("\n").find((l) => l.trim().startsWith(".sheet { position: fixed"))!;
    expect(sheet).not.toMatch(/transition/);
    expect(page).not.toMatch(/transition: height/);
  });
});
