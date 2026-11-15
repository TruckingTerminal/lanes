import { describe, expect, it } from "vitest";
import { withLiveLevers, type EconomyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate } from "@lanes/agents";
import { applyAction, createWorld, formCompany, homePlan, isRoundBoundary, mayTake, placeMiles, stepHour, vettingBlock, type Load, type Truck, type World } from "@lanes/engine";

/**
 * The director's sprint §5 (labor.dueHomePlan, off by default): the dispatcher doesn't work a due driver through home.
 * From five days before due only loads toward home; at or past due at home, nothing; the days off start at the first
 * empty moment inside the home radius, a load booked ahead held for them.
 */
const LIVE = withLiveLevers();
const ON: EconomyConfig = { ...LIVE, labor: { ...LIVE.labor, dueHomePlan: { enabled: true, leadDays: 5 } } };
const OFF: EconomyConfig = { ...LIVE, labor: { ...LIVE.labor, dueHomePlan: { enabled: false, leadDays: 5 } } };
const net = buildNetwork(hubs, LIVE);
const DAY = LIVE.time.gameMinutesPerDay;

function toNextRound(w: World): void {
  do stepHour(w);
  while (!isRoundBoundary(w.t, w.cfg));
}
/** A company at Dallas with a 21-day home rule, its truck and driver `away` days out. */
function company(cfg: EconomyConfig, seed: number, away: number) {
  const w = createWorld({ cfg, net, feeds: neutralFeeds, seed });
  populate(w, { freeOwnerOperators: 0, fleets: 0, brokers: 4 });
  const c = formCompany(w, { name: "Home Freight", role: "carrier", homeHubId: "DAL", strategy: "test", orders: [{ kind: "homeTime", afterDays: 21, restDays: 3 }], freePath: true });
  c.authority.status = "active";
  const t = w.trucksByCompany.get(c.id)![0]!;
  const d = w.staff[t.driverId - 1]!;
  d.awayDays = away;
  return { w, c, t, d };
}
const plan = (t: Truck, startT: number) => ({ at: t, startT });

describe("the dispatcher and a due driver (labor.dueHomePlan)", () => {
  it("off: loads toward home only once due, as before", () => {
    const { w, c, t } = company(OFF, 81, 18);
    expect(homePlan(w, c, t, plan(t, w.t))).toEqual({ homewardOnly: false, none: false });
    w.staff[t.driverId - 1]!.awayDays = 21;
    expect(homePlan(w, c, t, plan(t, w.t))).toEqual({ homewardOnly: true, none: false });
  });

  it("on: from five days before due, only loads toward home, read at the plan's start; at or past due at home, nothing", () => {
    const { w, c, t, d } = company(ON, 82, 15);
    const far = w.net.hubs.findIndex((h, i) => i !== c.homeHub && w.net.hubs[i] !== undefined && w.net.nearby[c.homeHub]!.indexOf(i) > 40);
    const away = { ...t, hub: far } as Truck;
    expect(homePlan(w, c, away, plan(away, w.t))).toEqual({ homewardOnly: false, none: false });
    d.awayDays = 16;
    expect(homePlan(w, c, away, plan(away, w.t))).toEqual({ homewardOnly: true, none: false });
    // A plan three days out (a load booked ahead) reads the days then.
    d.awayDays = 13;
    expect(homePlan(w, c, away, plan(away, w.t + 3 * DAY)).homewardOnly).toBe(true);
    // Due: away from home, toward home only; at home, nothing leaves.
    d.awayDays = 21;
    expect(homePlan(w, c, away, plan(away, w.t))).toEqual({ homewardOnly: true, none: false });
    expect(homePlan(w, c, t, plan(t, w.t))).toEqual({ homewardOnly: true, none: true });
    // A Send home counts as due.
    d.awayDays = 2;
    d.wantsHome = true;
    expect(homePlan(w, c, t, plan(t, w.t)).none).toBe(true);
  });

  it("arriving home empty with a load booked ahead, a due driver hauls it first, told on, and the days off wait (ruling 17); off, the same, untold", () => {
    const run = (cfg: EconomyConfig) => {
      const { w, c, t, d } = company(cfg, 83, 0);
      toNextRound(w);
      d.awayDays = 25; // due (after the first night, read at home)
      const ok = (l: Load) => l.status === "open" && l.equipment === t.trailer && l.hot === 0 && l.contractId === 0 && !l.hold && l.doubleBroker === null && vettingBlock(w, c, l) === null && mayTake(w, c, l);
      // The truck runs home empty from a town 40 to 120 miles out.
      const from = w.net.places.findIndex((p, i) => i !== t.place && placeMiles(w, i, t.place) > 40 && placeMiles(w, i, t.place) < 120);
      Object.assign(t, { status: "repositioning", place: from, hub: w.net.places[from]!.market, targetPlace: t.place, targetHub: c.homeHub, remainingMi: 8, legMiles: placeMiles(w, from, t.place), emptyMi: 0, loadedMi: 0 });
      const b = [...w.loads.values()].filter(ok).sort((x, y) => placeMiles(w, t.targetPlace, x.originPlace) - placeMiles(w, t.targetPlace, y.originPlace))[0]!;
      Object.assign(b, { readyT: w.t + DAY, latestPickupT: w.t + 6 * DAY, latestDeliveryT: w.t + 12 * DAY });
      expect(applyAction(w, c.id, { type: "book_load", truckId: t.id, loadId: b.id })).toEqual({ ok: true });
      expect(t.nextLoadId).toBe(b.id);
      const notes: string[] = [];
      w.listener = (e) => void (e.kind === "notice" && notes.push(e.text));
      for (let h = 0; h < 6 && t.status === "repositioning"; h++) stepHour(w);
      return { t, d, b, notes };
    };
    // The director's ruling 17 (amending §5): a load booked ahead is freight on, so it goes first; the days off wait until
    // the driver is home with nothing on and nothing booked.
    const on = run(ON);
    expect(on.d.homeUntilDay).toBeNull();
    expect(on.t.loadId).toBe(on.b.id);
    expect(on.notes.some((x) => /due for days off, but .+ is booked for \w+day\. It goes first/.test(x))).toBe(true);
    const off = run(OFF);
    expect(off.t.loadId).toBe(off.b.id);
    expect(off.notes.some((x) => /due for days off, but/.test(x))).toBe(false);
  }, 60_000);
});
