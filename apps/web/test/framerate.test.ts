import "./seed.js";
import { describe, expect, it } from "vitest";
import { chipFd } from "../src/board.js";
import { fd, fdFull, grouped, usd } from "../src/format.js";
import { backlogCap, FRAME, panelsMayRedraw } from "../src/frame.js";
import { GAME_CONFIG } from "../src/game.js";
import { LoopKeep } from "../src/loopkeep.js";
import { SPEEDS } from "../src/state.js";
import { walkSteps } from "../src/walkthrough.js";

/** The frame-rate pass (producer-framerate-2026-11-15.md; frame.ts), and QA's 0.25.6 item 3 (loopkeep.ts). */
describe("the frame-rate pass", () => {
  it("the test clock: Paused holds at once, and no more than a real second's hours wait at any speed (FRAME.clockHolds)", () => {
    const cap = (label: string) => backlogCap(SPEEDS.find((s) => s.label === label)!.hoursPerSec);
    expect(cap("Paused")).toBe(0);
    expect(cap("Live pace")).toBe(1);
    expect(cap("Day a minute")).toBe(1);
    expect(cap("Day in 6 s")).toBe(4);
    expect(cap("Day in 2 s")).toBe(12);
    expect(FRAME.clockHolds).toBe(true);
  });

  it("the panels' budget: a moved minute redraws after three times the last redraw's cost; off, at once (FRAME.panelBudget)", () => {
    expect(panelsMayRedraw(1000, 900, 40)).toBe(false);
    expect(panelsMayRedraw(1020, 900, 40)).toBe(true);
    expect(panelsMayRedraw(1000, 990, 3)).toBe(true); // a fast device redraws every frame
    FRAME.panelBudget = false;
    try {
      expect(panelsMayRedraw(1000, 900, 40)).toBe(true);
    } finally {
      FRAME.panelBudget = true;
    }
  });

  it("grouped() is toLocaleString('en-US') exactly, and the money formats read as they did", () => {
    const xs = [0, -0, 1, 7, 999, 1000, 1234.5, 9_999.4, 9_999.5, 12_345, -12_345, 1e6, 2.5e9, 0.4, -0.4, 1234.5678, Number.MAX_SAFE_INTEGER, -7.25];
    for (const x of xs) {
      expect(grouped(x)).toBe(x.toLocaleString("en-US"));
      expect(grouped(Math.round(x))).toBe(Math.round(x).toLocaleString("en-US"));
    }
    // The four call sites, against their old bodies.
    for (const x of xs) {
      const a = Math.abs(x);
      expect(chipFd(x)).toBe(a < 9_999.5 ? Math.round(a).toLocaleString("en-US") : `${(Math.round(a / 100) / 10).toFixed(1)}k`);
      expect(fdFull(x)).toBe(`${x < 0 ? "−" : ""}${Math.round(Math.abs(x)).toLocaleString("en-US")}`);
      expect(usd(x)).toBe(`$${x < 10 ? x.toFixed(2) : Math.round(x).toLocaleString("en-US")}`);
      const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `${(a / 1e3).toFixed(1)}k` : Math.round(a).toLocaleString("en-US");
      expect(fd(x)).toBe(`${x < 0 ? "−" : ""}${s}`);
    }
  });

  it("the walkthrough's steps are built once per config and hub, and read as a fresh build does", () => {
    const a = walkSteps(GAME_CONFIG);
    expect(walkSteps(GAME_CONFIG)).toBe(a);
    expect(walkSteps(GAME_CONFIG, "your home hub")).toBe(a);
    const savannah = walkSteps(GAME_CONFIG, "Savannah");
    expect(savannah).not.toBe(a);
    expect(walkSteps(GAME_CONFIG, "Savannah")).toBe(savannah);
    expect(savannah.find((s) => s.id === "board")!.do).toContain("Savannah");
    // A copy of the config builds afresh: the same words.
    const words = (steps: typeof a) => JSON.stringify(steps);
    expect(words(walkSteps({ ...GAME_CONFIG }))).toBe(words(a));
    expect(walkSteps({ ...GAME_CONFIG })).not.toBe(a);
  });
});

describe("the windows' loops (QA's 0.25.6 item 3: blob: ERR_FILE_NOT_FOUND)", () => {
  const setup = () => {
    const revoked: string[] = [];
    return { keep: new LoopKeep(2, (u) => revoked.push(u)), revoked };
  };

  it("a loop a window draws is never revoked while it's held, however many are made after it", () => {
    const { keep, revoked } = setup();
    keep.add("a", "blob:a");
    const relA = keep.hold("a");
    for (const k of ["b", "c", "d", "e"]) {
      keep.add(k, `blob:${k}`);
      keep.hold(k)(); // drawn once and let go
    }
    expect(revoked).toEqual(["blob:b", "blob:c", "blob:d"]);
    expect(keep.get("a")).toBe("blob:a");
    expect(keep.kept()).toEqual(["a", "e"]);
    // Let go, it's an ordinary kept loop: the oldest, revoked when the next is made.
    relA();
    expect(keep.kept()).toEqual(["a", "e"]);
    keep.add("f", "blob:f");
    expect(revoked).toEqual(["blob:b", "blob:c", "blob:d", "blob:a"]);
    expect(keep.kept()).toEqual(["e", "f"]);
  });

  it("the old rule still holds for loops nobody draws: two kept, the oldest revoked first", () => {
    const { keep, revoked } = setup();
    for (const k of ["a", "b", "c"]) keep.add(k, `blob:${k}`);
    expect(revoked).toEqual(["blob:a"]);
    expect(keep.kept()).toEqual(["b", "c"]);
  });

  it("the newest loop is never revoked as it's made, even with every other one held", () => {
    const { keep, revoked } = setup();
    keep.add("a", "blob:a");
    keep.hold("a");
    keep.add("b", "blob:b");
    keep.hold("b");
    keep.add("c", "blob:c");
    expect(revoked).toEqual([]);
    const relC = keep.hold("c");
    keep.add("d", "blob:d");
    expect(revoked).toEqual([]);
    relC();
    expect(revoked).toEqual(["blob:c"]);
  });

  it("two windows on one loop: it stays until both let go; a release twice counts once", () => {
    const { keep, revoked } = setup();
    keep.add("a", "blob:a");
    const r1 = keep.hold("a");
    const r2 = keep.hold("a");
    for (const k of ["b", "c", "d"]) keep.add(k, `blob:${k}`);
    r1();
    r1();
    keep.add("e", "blob:e");
    expect(revoked).toEqual(["blob:b", "blob:c", "blob:d"]);
    expect(keep.get("a")).toBe("blob:a");
    r2();
    keep.add("f", "blob:f");
    expect(revoked).toEqual(["blob:b", "blob:c", "blob:d", "blob:a"]);
  });

  it("a second URL made for a kept key is revoked, and the first kept", () => {
    const { keep, revoked } = setup();
    keep.add("a", "blob:a1");
    keep.add("a", "blob:a2");
    expect(keep.get("a")).toBe("blob:a1");
    expect(revoked).toEqual(["blob:a2"]);
  });
});
