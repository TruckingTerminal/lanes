import "./seed.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { motion, MOTIONS, setMotion, storedMotion, systemMotion } from "../src/motion.js";

/** The menu system (studio/specs/menu-system.md), engineering's steps in its §7 order. */
const src = (f: string) => readFileSync(join(__dirname, "..", "src", f), "utf8");
const themes = src("themes.css");
const page = src("page.html");

/** WCAG contrast of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

describe("step 1: the Sunset theme and the type (§1.1)", () => {
  const block = themes.split("\n").find((l) => l.startsWith(':root, [data-theme="sunset"]'))!;
  const tok = (k: string) => new RegExp(`${k}:([^;]+);`).exec(block)?.[1]?.trim();

  it("is the page's :root theme, with the spec's tokens", () => {
    expect(block).toBeTruthy();
    expect(themes.match(/:root/g)?.length).toBe(1);
    const want: Record<string, string> = { "--bg-primary": "#1a1220", "--bg-secondary": "#241a2c", "--bg-panel": "#2c2036", "--bg-input": "#140e1a", "--border": "#4d3a5c", "--text-primary": "#f7ebde", "--text-secondary": "#cdb6c4", "--text-dim": "#a68fa8", "--accent": "#3fd9c4", "--text-on-accent": "#1a1220", "--accent-warn": "#ffb454", "--accent-danger": "#ff6b6b", "--accent-success": "#86e09a", "--sun": "#f89868", "--paper": "#f3e6d2", "--ink": "#2a1d2e" };
    for (const [k, v] of Object.entries(want)) expect(tok(k), k).toBe(v);
    // The map's route and status colours are carried over, so no component changes for colour.
    expect(tok("--wp-1")).toBeTruthy();
    expect(tok("--status-paid")).toBeTruthy();
  });

  it("passes 4.5:1 for every text pairing the spec lists", () => {
    const panel = tok("--bg-panel")!;
    for (const k of ["--text-primary", "--text-secondary", "--text-dim", "--accent", "--accent-warn", "--accent-danger", "--accent-success", "--sun"]) expect(contrast(tok(k)!, panel), k).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tok("--text-on-accent")!, tok("--accent")!)).toBeGreaterThanOrEqual(4.5);
    for (const k of ["--ink", "--ink-red", "--ink-green"]) expect(contrast(tok(k)!, tok("--paper")!), k).toBeGreaterThanOrEqual(4.5);
  });

  it("body in Inter, figures mono, headings in Pixelify Sans", () => {
    expect(tok("--font-body")).toMatch(/Inter/);
    expect(tok("--font-display")).toMatch(/Pixelify Sans/);
    expect(page).toMatch(/family=Pixelify\+Sans/);
    expect(page).toMatch(/h2, h3 \{ font-family: var\(--font-display/);
    expect(page).toMatch(/\.num \{ font-family: var\(--font-mono\); font-variant-numeric: tabular-nums;/);
  });
});

describe("step 2: data-motion and the Motion setting (§2.6)", () => {
  const store = new Map<string, string>();
  let reduce = false;
  const g = globalThis as unknown as Record<string, unknown>;
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  g.matchMedia = () => ({ matches: reduce, addEventListener: () => undefined });
  afterEach(() => {
    store.clear();
    reduce = false;
  });

  it("follows the system until the player chooses, and keeps the choice", () => {
    expect(systemMotion()).toBe("full");
    reduce = true;
    expect(motion()).toBe("calm");
    setMotion("still");
    expect(storedMotion()).toBe("still");
    expect(motion()).toBe("still");
    setMotion(null);
    expect(motion()).toBe("calm");
    store.set("lanes.motion", "bouncy");
    expect(motion()).toBe("calm");
    expect(MOTIONS).toEqual(["full", "calm", "still"]);
  });

  it("no rule animates forever outside Full, and the old loops are cut", () => {
    for (const gone of ["tab-breathe", "icon-bob", "star-twinkle", "prefers-reduced-motion"]) expect(page).not.toContain(gone);
    // Every infinite animation left is a Full-only rule, or an ambient one the not-Full rule stops: the stepped backdrop
    // loop (its first frame) and the city pane's slow drift.
    for (const line of page.split("\n").filter((l) => /infinite/.test(l))) expect(line.startsWith('html[data-motion="full"]') || line.startsWith(".loop {") || line.startsWith(".citypic img, .citypic canvas.pic"), line).toBe(true);
    expect(page).toMatch(/html:not\(\[data-motion="full"\]\) :is\(\.loop/);
    expect(page).toMatch(/html\[data-motion="still"\] \*[^{]*\{ transition: none !important; animation: none !important; \}/);
  });
});
