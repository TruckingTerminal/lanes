import "./seed.js";
import { describe, expect, it } from "vitest";
import { cropOf, focalFraction, pickWindow, sliceOf, type KitJson } from "../src/menuart.js";
import { DROP_AFTER_MS, Stage, type AccentKind, type Clock } from "../src/stage.js";

/** The menu system, step 4 (studio/specs/menu-system.md §1.3 and §4): the window's crop and the accent stage. */

describe("the window's crop (§1.3, the pixel-art rule)", () => {
  it("scales by whole numbers in device pixels and keeps the box inside the scene, around the focal point", () => {
    // A 390 px phone at DPR 3, a 72 px window: 1170 × 216 device px; ceil(1170 / 256) = 5.
    const c = cropOf(256, 144, 1170, 216, 0.5, 0.5);
    expect(c.scale).toBe(5);
    expect(c.sw).toBeCloseTo(234, 6);
    expect(c.sh).toBeCloseTo(43.2, 6);
    expect(c.sx).toBe(Math.round(128 - 117));
    expect(Number.isInteger(c.sx) && Number.isInteger(c.sy)).toBe(true);
    // A focal point at an edge never crops past the scene.
    const left = cropOf(256, 144, 1170, 216, 0, 1);
    expect(left.sx).toBe(0);
    expect(left.sy + left.sh).toBeLessThanOrEqual(144 + 1e-9);
    // A laptop rack, 360 × 96 CSS at DPR 2: 720 × 192 device px; scale 3.
    expect(cropOf(256, 144, 720, 192, 0.5, 0.5).scale).toBe(3);
  });

  it("reads a focal point given as a fraction or in scene pixels", () => {
    expect(focalFraction(0.25, 256)).toBe(0.25);
    expect(focalFraction(64, 256)).toBe(0.25);
    expect(focalFraction(-3, 256)).toBe(0);
  });
});

describe("the accent stage (§4, rule 3)", () => {
  /** A hand-driven clock: `later` timers fire only when advanced past. */
  function fakeClock() {
    let t = 0;
    const timers: { at: number; f: () => void }[] = [];
    const clock: Clock = { now: () => t, later: (f, ms) => timers.push({ at: t + ms, f }) };
    const advance = (ms: number) => {
      t += ms;
      for (const x of timers.filter((y) => y.at <= t)) {
        timers.splice(timers.indexOf(x), 1);
        x.f();
      }
    };
    return { clock, advance };
  }
  const played: AccentKind[] = [];
  const held: (() => void)[] = [];
  const accent = (kind: AccentKind) => ({ kind, play: (done: () => void) => (played.push(kind), held.push(done)), maxMs: 5000 });

  it("plays one at a time, the highest priority next, and drops one waiting over 3 s (never a pay landing)", () => {
    played.length = 0;
    held.length = 0;
    const { clock, advance } = fakeClock();
    const s = new Stage(clock);
    s.add(accent("own"));
    s.add(accent("gleam"));
    s.add(accent("result"));
    s.add(accent("pay"));
    expect(played).toEqual(["own"]);
    held.shift()!();
    expect(played).toEqual(["own", "pay"]);
    held.shift()!();
    expect(played).toEqual(["own", "pay", "result"]);
    // The gleam waits past 3 s behind the result: dropped.
    advance(DROP_AFTER_MS + 1);
    s.add(accent("pay")); // queued behind the result, older than nothing
    advance(DROP_AFTER_MS + 1);
    held.shift()!();
    expect(played).toEqual(["own", "pay", "result", "pay"]);
    held.shift()!();
    expect(s.current).toBeNull();
    expect(s.waiting).toBe(0);
  });

  it("never stalls on an accent that forgets to finish", () => {
    played.length = 0;
    held.length = 0;
    const { clock, advance } = fakeClock();
    const s = new Stage(clock);
    s.add({ kind: "iuliia", play: () => played.push("iuliia"), maxMs: 2000 });
    s.add(accent("own"));
    expect(played).toEqual(["iuliia"]);
    advance(2000);
    expect(played).toEqual(["iuliia", "own"]);
  });
});

describe("which painting a window shows (UX's picks §3)", () => {
  const cell = (avg: string) => ({ x: 0, y: 0, w: 256, h: 144, focalX: 0.5, focalY: 0.6, avg });
  const k = {
    windows: {
      truck: { image: "windows/truck.png", w: 1024, h: 432, cells: { "road-golden": cell("#834e50"), "road-golden-night": cell("#181a31") } },
      shp: { image: "windows/shp.png", w: 1024, h: 432, cells: { "shp-docks": cell("#1") } },
      dusk: { image: "windows/dusk.png", w: 1024, h: 1008, cells: { "shp-docks": cell("#2") } },
      night: { image: "windows/night.png", w: 1024, h: 1008, cells: { "shp-docks": cell("#3") } },
      autumn: { image: "windows/autumn.png", w: 1024, h: 864, cells: { "shp-docks": cell("#4"), office: cell("#5") } },
    },
    scenes: { office: { focalX: 0.4, focalY: 0.5, avg: "#6" } },
    loops: { "shp-docks": { image: "windows/shp-docks.loop.png", w: 256, h: 144, frames: 16, cols: 4, fps: 8 } },
  } as unknown as KitJson;
  const all = () => true;

  it("night, then dusk, then the season, else the base with its loop; painted hours aren't graded", () => {
    expect(pickWindow(k, "shp-docks", "night", "summer", undefined, all)).toMatchObject({ key: "night:shp-docks", grade: false, loop: null });
    expect(pickWindow(k, "shp-docks", "dusk", "winter", undefined, all)).toMatchObject({ key: "dusk:shp-docks", grade: false });
    expect(pickWindow(k, "shp-docks", "morning", "autumn", undefined, all)).toMatchObject({ key: "autumn:shp-docks", grade: true, loop: null });
    expect(pickWindow(k, "shp-docks", "midday", "summer", undefined, all)).toMatchObject({ key: "shp:shp-docks", grade: true, loop: { frames: 16, cols: 4 } });
    // A night still kept in its base family under "-night".
    expect(pickWindow(k, "road-golden", "night", "summer", undefined, all)).toMatchObject({ key: "truck:road-golden-night", grade: false });
    // No dusk variant: the base, graded.
    expect(pickWindow(k, "road-golden", "dusk", "summer", undefined, all)).toMatchObject({ key: "truck:road-golden", grade: true });
  });

  it("an unpacked name is its old scene, its season from the season atlas; a loop not shipped isn't played", () => {
    expect(pickWindow(k, "office", "midday", "summer", "data:office", all)).toMatchObject({ url: "data:office", key: "scene:office", focalX: 0.4, avg: "#6", loop: { image: "scenes/office.loop.png", cols: 16 } });
    expect(pickWindow(k, "office", "midday", "autumn", "data:office", all)).toMatchObject({ key: "autumn:office" });
    const noLoop = (p: string) => !p.endsWith(".loop.png");
    expect(pickWindow(k, "shp-docks", "midday", "summer", undefined, noLoop)?.loop).toBeNull();
    expect(pickWindow(null, "office", "midday", "summer", "data:office", all)).toMatchObject({ key: "scene:office", focalX: 0.5 });
    expect(pickWindow(k, "nowhere", "midday", "summer", undefined, all)).toBeNull();
  });

  it("reads a nine-slice as one inset or four", () => {
    expect(sliceOf({ x: 0, y: 0, w: 48, h: 48, slice: 12 })).toEqual([12, 12, 12, 12]);
    expect(sliceOf({ x: 0, y: 0, w: 48, h: 24, slice: [12, 12, 0, 12] })).toEqual([12, 12, 0, 12]);
  });
});

describe("costs leaving merge into one chip (§2.4)", () => {
  it("one cost names itself; costs within one tick merge into a count", async () => {
    const { mergeCost, MERGE_MS } = await import("../src/moneymotion.js");
    const one = mergeCost(null, 41, "settlement fee", 1000);
    expect(one).toEqual({ fd: 41, n: 1, label: "settlement fee", at: 1000 });
    const two = mergeCost(one, 120, "fuel", 1000 + MERGE_MS);
    const three = mergeCost(two, 51, "tolls", 1000 + MERGE_MS + 10);
    expect(three).toMatchObject({ fd: 212, n: 3, label: "" });
    expect(mergeCost(three, 5, "fee", 1000 + 4 * MERGE_MS)).toMatchObject({ fd: 5, n: 1, label: "fee" });
  });
});

describe("step 3: the painted frames and the atlas icons", () => {
  it("gives CSS each frame's image and its slice, one inset or four", async () => {
    const { pieceVars } = await import("../src/kitcss.js");
    expect(pieceVars("frame-card", { x: 0, y: 0, w: 48, h: 48, slice: 12 }, "data:x")).toEqual({ "--frame-card": 'url("data:x")', "--frame-card-slice": "12 12 12 12", "--frame-card-width": "12px 12px 12px 12px" });
    expect(pieceVars("frame-sheet", { x: 0, y: 0, w: 48, h: 24, slice: [12, 12, 0, 12] }, "data:y")["--frame-sheet-width"]).toBe("12px 12px 0px 12px");
  });

  it("draws the four phone tabs from the kit with their lit loop, the rest from the icon atlas, and nothing before the kit", async () => {
    const { setKitData } = await import("../src/menuart.js");
    const { iconPiece } = await import("../src/ui/KitIcon.js");
    setKitData(null);
    expect(iconPiece("fleet")).toBeNull();
    const atlas = (pieces: Record<string, object>) => ({ image: "ui/x.png", w: 1024, h: 512, pieces });
    setKitData({ kit: atlas({ "tab-fleet": { x: 390, y: 0, w: 96, h: 96 }, "tab-fleet-lit": { x: 488, y: 0, w: 96, h: 96, frames: 5, step: 98, fps: 8 } }), icons: atlas({ staff: { x: 96, y: 192, w: 96, h: 96 }, "switch-32": { x: 480, y: 192, w: 32, h: 32 } }) } as unknown as KitJson);
    expect(iconPiece("fleet", true)?.lit).toMatchObject({ frames: 5 });
    expect(iconPiece("truck")?.piece).toMatchObject({ x: 390 }); // the Needs-you rows' "truck" is the fleet tab
    expect(iconPiece("staff")?.piece).toMatchObject({ x: 96, y: 192 });
    expect(iconPiece("switch16")?.piece).toMatchObject({ w: 32 });
    expect(iconPiece("nowhere")).toBeNull();
    setKitData(null);
  });
});
