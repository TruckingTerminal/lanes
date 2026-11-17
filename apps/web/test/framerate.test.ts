import "./seed.js";
import { describe, expect, it } from "vitest";
import { chipFd } from "../src/board.js";
import { fd, fdFull, grouped, usd } from "../src/format.js";
import { clockAfter, FRAME, panelsMayRedraw } from "../src/frame.js";
import { GAME_CONFIG } from "../src/game.js";
import { LoopKeep } from "../src/loopkeep.js";
import { SPEEDS } from "../src/state.js";
import { walkSteps } from "../src/walkthrough.js";

/** The frame-rate pass (producer-framerate-2026-11-15.md; frame.ts), and QA's 0.25.6 item 3 (loopkeep.ts). */
describe("the frame-rate pass", () => {
  const rate = (label: string) => SPEEDS.find((s) => s.label === label)!.hoursPerSec;
  /** The page's loop (main.tsx): frames of `frameMs` for `ms` at a speed; each whole hour waiting steps, as many as `perFrame` a frame. */
  const run = (acc: number, label: string, ms: number, frameMs = 10, perFrame = 99): { acc: number; steps: number; firstStepAt: number | null } => {
    let steps = 0;
    let firstStepAt: number | null = null;
    for (let at = frameMs; at <= ms; at += frameMs) {
      acc = clockAfter(acc, frameMs, rate(label));
      for (let n = 0; acc >= 1 && n < perFrame; n++) {
        acc -= 1;
        steps++;
        firstStepAt ??= at;
      }
    }
    return { acc, steps, firstStepAt };
  };

  it("the test clock: no more than a real second's whole hours wait at any speed, and Paused none (FRAME.clockHolds)", () => {
    expect(FRAME.clockHolds).toBe(true);
    // A device that can't keep up (a 250 ms frame, one step a frame): the whole hours waiting stay within the speed's cap.
    for (const [label, cap] of [["Live pace", 1], ["Day a minute", 1], ["Day in 6 s", 4], ["Day in 2 s", 12]] as const) {
      const slow = run(0, label, 60_000, 250, 1);
      expect(Math.floor(slow.acc), label).toBeLessThanOrEqual(cap);
      // A device that keeps up loses nothing: an hour steps every 1 / rate seconds (the last may be a frame away).
      if (label !== "Live pace") {
        const hours = Math.round(60 * rate(label));
        const kept = run(0, label, 60_000).steps;
        expect(kept === hours || kept === hours - 1, `${label}: ${kept} of ${hours}`).toBe(true);
      }
    }
    // After Day in 2 s on that slow device, with hours still waiting, Paused steps nothing more from its first frame on.
    const behind = run(0, "Day in 2 s", 10_000, 250, 1);
    expect(behind.acc).toBeGreaterThanOrEqual(11);
    expect(run(behind.acc, "Paused", 5_000, 250, 1).steps).toBe(0);
    // Off, the hours waited as they did (the loop's own 48 caps them after its steps).
    FRAME.clockHolds = false;
    try {
      expect(clockAfter(40, 250, rate("Day in 2 s"))).toBe(43);
      expect(clockAfter(40, 250, rate("Paused"))).toBe(40);
    } finally {
      FRAME.clockHolds = true;
    }
  });

  it("Paused keeps the part-hour already run: the hour picks up where it stopped (QA, 2026-11-17)", () => {
    // Day a minute: an hour every 2.5 s. Two seconds in, Paused for a minute, and on: the hour steps 0.5 s later.
    const twoIn = run(0, "Day a minute", 2_000);
    expect(twoIn.steps).toBe(0);
    expect(twoIn.acc).toBeCloseTo(0.8, 9);
    const paused = run(twoIn.acc, "Paused", 60_000);
    expect(paused.steps).toBe(0);
    expect(paused.acc).toBe(twoIn.acc);
    // (Half a second, give or take the frame the sum's last bit falls in.)
    const half = (ms: number | null): boolean => ms !== null && ms >= 490 && ms <= 510;
    expect(half(run(paused.acc, "Day a minute", 5_000).firstStepAt)).toBe(true);
    // Without the pause it's the same half second.
    expect(half(run(twoIn.acc, "Day a minute", 5_000).firstStepAt)).toBe(true);
    // Live pace: 14 of an hour's 15 real minutes run, Paused, and on: the hour steps a minute later, not fifteen.
    const late = run(0, "Live pace", 14 * 60_000, 1_000);
    expect(late.steps).toBe(0);
    const on = run(run(late.acc, "Paused", 30_000, 1_000).acc, "Live pace", 2 * 60_000, 1_000);
    expect(on.firstStepAt).toBeGreaterThanOrEqual(59_000);
    expect(on.firstStepAt).toBeLessThanOrEqual(61_000);
    // The phone's speed button passes through Paused on its way round: Day in 2 s, Paused, Live pace keeps the part-hour too.
    const fast = run(0, "Day in 2 s", 1_040); // 12.48 hours: 12 stepped, 0.48 running
    expect(fast.steps).toBe(12);
    const round = run(run(fast.acc, "Paused", 300).acc, "Live pace", 10);
    expect(round.acc).toBeCloseTo(0.48, 4);
    // Whole hours waiting when Paused comes are dropped, the part-hour kept.
    expect(clockAfter(7.25, 16, rate("Paused"))).toBeCloseTo(0.25, 9);
    // A slower speed keeps a second's worth and the part-hour: Day in 2 s with 7.25 waiting, to Live pace.
    expect(clockAfter(7.25, 0, rate("Live pace"))).toBeCloseTo(1.25, 9);
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
