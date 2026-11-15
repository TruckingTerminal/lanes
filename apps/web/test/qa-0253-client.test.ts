import "./seed.js";
import { describe, expect, it, vi } from "vitest";
import { companyAccount, hubMiles, placeOfHub, roadService, standingDelivered, standingHit, unseatDriver, type Load, type World } from "@lanes/engine";
import { bidRange, blockReason } from "../src/board.js";
import { onCost } from "../src/books.js";
import { hire as hireLines, sell as sellLines, usedTruck } from "../src/confirmspecs.js";
import { FIXES } from "../src/copy-fixes.js";
import { PENDING } from "../src/copy-pending.js";
import { STANDING_UX } from "../src/copy-standing.js";
import { fdFull } from "../src/format.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { freeDriverFor } from "../src/nextstep.js";
import { S, toast, toastHeld } from "../src/state.js";
import { cardUx, wonLine } from "../src/standingui.js";
import { myTenders } from "../src/ui/panels/Contracts.js";

/** QA's 0.25.3 replay (qa-0253-2026-11-15.md): the page's words and offers, fix soon 2 to 6 and the lower items. */
async function player() {
  const g = await TestGame.create(undefined, undefined, 41, GAME_CONFIG);
  const c = g.join("Replay Freight", "oo", "CMH")!;
  const t = g.w.trucksByCompany.get(c.id)![0]!;
  return { g, w: g.w, c, t };
}
const anyOpen = (w: World): Load => [...w.loads.values()].find((l) => l.status === "open" && l.bookNow < l.ceiling - 0.05)!;

describe("QA's 0.25.3 replay on the page", () => {
  it("2: off sale puts back only a driver who can reach the truck: never one the bus took home", async () => {
    const { w, c, t } = await player();
    const s = w.staff[t.driverId - 1]!;
    unseatDriver(w, s);
    expect(freeDriverFor(w, c, t, [s.id])?.id).toBe(s.id); // beside it
    const home = w.net.hubs.findIndex((_h, i) => hubMiles(w, i, t.hub) > 400);
    Object.assign(s, { lastHub: home, lastPlace: placeOfHub(home) }); // the bus took them home
    expect(freeDriverFor(w, c, t, [s.id])).toBeNull(); // so off sale says "parked where it stands"
  }, 120_000);

  it("2: the sell Confirm, with the bus on and the truck away from home, doesn't promise the crew back", async () => {
    const { w, t } = await player();
    const far = w.net.hubs.findIndex((_h, i) => hubMiles(w, i, t.hub) > 400);
    Object.assign(t, { hub: far, targetHub: far, place: placeOfHub(far), targetPlace: placeOfHub(far) });
    const lines = sellLines(w, t, 1, 50_000);
    expect(lines.does).toContain(FIXES.sellOwnerAway(false));
    expect(lines.does).not.toContain(PENDING.sellOwnerOff);
  }, 120_000);

  it("4 and 5: a first call isn't a tender, and its bid range stops at Book now while it's open", async () => {
    const { g, w, c } = await player();
    const l = anyOpen(w);
    const be = l.bookNow * 0.8;
    expect(bidRange(w, l, be, c)[1]).toBeCloseTo(Math.floor(l.ceiling * 100 + 1e-6) / 100, 6);
    Object.assign(l, { firstCall: { companyId: c.id, round: w.round + 1, localUntil: 0, state: "open" }, tenderedTo: c.id, tenderUntil: w.t + 600 });
    expect(bidRange(w, l, be, c)[1]).toBeCloseTo(Math.floor(l.bookNow * 100 + 1e-6) / 100, 6);
    S.game = g as never;
    try {
      expect(myTenders(c).map((x) => x.id)).not.toContain(l.id);
    } finally {
      S.game = null;
    }
  }, 120_000);

  it("3: a first call's toast isn't pushed out by a toast in the same frame; that one shows after", () => {
    vi.useFakeTimers();
    const g = globalThis as { window?: unknown };
    const had = g.window;
    g.window = globalThis;
    try {
      toastHeld(STANDING_UX.callToast("Chicago"));
      toast("Delivered Chicago to Columbia");
      expect(S.toast?.text).toBe("First call from Chicago shippers");
      toast("Truck 2 was refused", true); // an error shows at once
      expect(S.toast?.text).toBe("Truck 2 was refused");
      toastHeld(STANDING_UX.callToast("Chicago"));
      toast("Delivered Chicago to Columbia");
      vi.advanceTimersByTime(4300);
      expect(S.toast?.text).toBe("Delivered Chicago to Columbia");
    } finally {
      vi.useRealTimers();
      g.window = had;
      S.toast = null;
    }
  });

  it("6: a load this company released says so on its card and sheet", async () => {
    const { w, c, t } = await player();
    const l = anyOpen(w);
    l.releasedBy = [c.id];
    expect(blockReason(w, c, t, l)).toBe(FIXES.releasedByYou);
  }, 120_000);

  it("lower: no negative count, the record names the release, and WON past the floor says past", async () => {
    const { w, c } = await player();
    const hub = c.homeHub;
    c.standingNoticed = true;
    c.standing = { [hub]: { tier: 2, days: [], lastLoadT: w.t, trend: [], log: [] } };
    const lane = w.net.lanesFrom[hub]![0]!;
    const fake = (id: number): Load => ({ ...anyOpen(w), id, brokerId: null, shipperId: null, facilityId: null, origin: hub, dest: lane.dest, laneId: lane.id, contractId: 0, miles: 500 }) as Load;
    standingDelivered(w, c, fake(900_001), true, false);
    standingHit(w, c, fake(900_002), "release");
    const x = cardUx(w, c, hub)!;
    expect(x.have).toBe(STANDING_UX.have("0", "100%"));
    expect(x.record).toMatch(/· 1 released$/);
    c.standing[hub]!.tier = 7;
    for (let i = 0; i < 16; i++) standingDelivered(w, c, fake(900_100 + i), true, false);
    expect(wonLine(w, c, fake(900_200))).toMatch(/counted loads, past the \d+ tier 8 needs\.$/);
  }, 120_000);

  it("lower: a dispatcher's hire says a weekly wage; a used truck elsewhere names its town in its market", async () => {
    const { w, c } = await player();
    expect(hireLines("Wayne Vance", 725, 9_000, false).does).toBe(FIXES.hireWeekly("Wayne Vance", "725"));
    expect(hireLines("Ana Ruiz", 725, 9_000).does).not.toBe(FIXES.hireWeekly("Ana Ruiz", "725"));
    const p = w.net.places.findIndex((x) => x.market !== c.homeHub && w.net.places[placeOfHub(x.market)]!.name !== x.name);
    const hub = w.net.places[p]!.market;
    const spec = { tier: "workhorse", trailer: "van", lease: "owned", odometer: 100_000, milesSinceRebuild: 100_000, rebuilds: 0 } as const;
    expect(usedTruck(w, c, spec, hub, p).does).toContain(PENDING.townInMarket(w.net.places[p]!.name, w.net.hubs[hub]!.name));
  }, 120_000);

  it("lower: a breakdown's bill reaches the cost chip", async () => {
    const { w, c, t } = await player();
    const seen: { line: string; ref: string; fd: number }[] = [];
    onCost((_w, co, fd, line, ref) => {
      if (co.id === c.id) seen.push({ line, ref, fd });
    });
    w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 50_000, "test");
    const paid = roadService(w, t, c, 1_000).paid;
    expect(paid).toBeGreaterThan(0);
    expect(seen.filter((x) => x.ref === `breakdown:${t.id}`).reduce((s, x) => s + x.fd, 0)).toBeCloseTo(paid, 0);
    expect(fdFull(paid)).not.toBe("0");
  }, 120_000);
});
