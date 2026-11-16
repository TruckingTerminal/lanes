import "./seed.js";
import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { aroundTheClock, createWorld, dockRule, isRoundBoundary, openWindow, stepHour, type Load, type World } from "@lanes/engine";
import { FIXES } from "../src/copy-fixes.js";
import { dockShutLine } from "../src/windowsui.js";

/** The director's ruling 21 on the sheet (windows.fullOpenDay): one line when the pickup window spans days the dock is shut. */
const LIVE = withLiveLevers();
const net = buildNetwork(hubs, LIVE);
const D = LIVE.time.gameMinutesPerDay;
const at = (day: number, hour: number) => day * D + hour * 60; // day 0 is a Monday

function vanAt(cfg: EconomyConfig, t: number): { w: World; l: Load } {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 18 });
  populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
  const van = [...w.loads.values()].find((l) => l.status === "open" && l.hot === 0 && dockRule(w, l) === "fcfs" && !aroundTheClock(w, l.originPlace))!;
  const l = { ...van };
  const was = w.t;
  w.t = t;
  openWindow(w, l, 0);
  w.t = was;
  return { w, l };
}

describe("the sheet's dock line (ruling 21)", () => {
  it("ready Fri 18:00: shut Sat–Sun, loading Mon 07:00–19:00; none for a window inside the week, or with the rule off", () => {
    const ON: EconomyConfig = { ...LIVE, windows: { ...LIVE.windows, fullOpenDay: true } };
    const fri = vanAt(ON, at(4, 18));
    const town = fri.w.net.places[fri.l.originPlace]!.name;
    expect(dockShutLine(fri.w, fri.l)).toBe(FIXES.dockShut(town, "Sat–Sun", "Mon", "07:00", "19:00"));
    expect(FIXES.dockShut("Xenia", "Sat–Sun", "Mon", "07:00", "19:00")).toBe("Xenia's dock is shut Sat–Sun: loading Mon 07:00–19:00.");
    expect(dockShutLine(vanAt(ON, at(2, 8)).w, vanAt(ON, at(2, 8)).l)).toBeNull();
    // Ready Fri 08:00, Friday's hours still load it (the red team's 0.25.6 fix): that's the loading day named.
    const morning = vanAt(ON, at(4, 8));
    expect(dockShutLine(morning.w, morning.l)).toBe(FIXES.dockShut(town, "Sat–Sun", "Fri", "07:00", "19:00"));
    const off = vanAt(LIVE, at(4, 18));
    expect(dockShutLine(off.w, off.l)).toBeNull();
  }, 120_000);
});
