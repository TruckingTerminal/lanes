import "./seed.js";
import { describe, expect, it } from "vitest";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { createWorld, dayOf, stepHour, weekdayName, type Reach, type World } from "@lanes/engine";
import { FIXES } from "../src/copy-fixes.js";
import { GAME_CONFIG } from "../src/game.js";
import { dueFirstLine, reachChip } from "../src/windowsui.js";

/** The director's ruling 17 on the page (labor.dueHomePlan): the board's days-off chip and the booking sheet's due line. */
const ON = { ...GAME_CONFIG, windows: { ...GAME_CONFIG.windows, enabled: true }, labor: { ...GAME_CONFIG.labor, dueHomePlan: { ...GAME_CONFIG.labor.dueHomePlan, enabled: true } } };
function world(cfg = ON): World {
  const w = createWorld({ cfg, net: buildNetwork(hubs, cfg), feeds: neutralFeeds, seed: 5 });
  populate(w, { freeOwnerOperators: 4, fleets: 2, brokers: 1 });
  for (let h = 0; h < 6; h++) stepHour(w, ruleBotHook);
  return w;
}

describe("ruling 17 on the page", () => {
  it("a held booking's days off ending after the pickup closes: the chip says so, by the player's truck number", () => {
    const w = world();
    const l = [...w.loads.values()].find((x) => x.latestPickupT !== undefined)!;
    const r: Reach = { ok: false, why: "daysOff", freeT: l.latestPickupT! + 6 * 60, freePlace: l.originPlace, pickupT: l.latestPickupT! + 6 * 60, deliverT: l.latestPickupT! + 6 * 60 };
    const chip = reachChip(w, l, r, 3)!;
    expect(chip).toMatch(/^Truck 3 is on days off until .+, after the .+ pickup\.$/);
  });

  it("the sheet's line when the driver comes due by the pickup's day; none with the switch off or on days off", () => {
    const w = world();
    const t = w.trucks.find((x) => x.driverId > 0 && w.companies[x.companyId - 1]!.orders.some((o) => o.kind === "homeTime"))!;
    const c = w.companies[t.companyId - 1]!;
    const hm = c.orders.find((o) => o.kind === "homeTime")!;
    if (hm.kind !== "homeTime") throw new Error("no home rule");
    const d = w.staff[t.driverId - 1]!;
    const D = w.cfg.time.gameMinutesPerDay;
    const today = dayOf(w.t, w.cfg);
    d.homeUntilDay = null;
    d.awayDays = hm.afterDays - 1; // due tomorrow
    const line = dueFirstLine(w, t, (today + 2) * D + 9 * 60)!;
    expect(line).toBe(FIXES.dueFirst(d.owner ? null : d.name, weekdayName((today + 1) * D, w.cfg)));
    expect(line).toMatch(/due home \w+day\. This load comes first; (your|their) days off wait until (you're|they're) home with nothing booked\.$/);
    expect(dueFirstLine(w, t, today * D + 9 * 60)).toBeNull(); // the pickup comes before they're due
    d.awayDays = hm.afterDays + 3;
    expect(dueFirstLine(w, t, today * D + 9 * 60)).toBe(FIXES.dueFirst(d.owner ? null : d.name, FIXES.dueToday));
    d.homeUntilDay = today + 2; // on days off now: rule H's business, not this line's
    expect(dueFirstLine(w, t, (today + 3) * D)).toBeNull();
    d.homeUntilDay = null;
    const off = world({ ...ON, labor: { ...ON.labor, dueHomePlan: { ...ON.labor.dueHomePlan, enabled: false } } });
    const t0 = off.trucks.find((x) => x.driverId > 0)!;
    expect(dueFirstLine(off, t0, off.t + 3 * D)).toBeNull();
  });
});
