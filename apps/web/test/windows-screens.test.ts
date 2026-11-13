import "./seed.js";
import { describe, expect, it } from "vitest";
import { canMake, npcKey, tally, whenLabel, type Load, type World } from "@lanes/engine";
import { boardRows } from "../src/board.js";
import { WINDOWS } from "../src/copy-windows.js";
import { hhmm } from "../src/format.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { settleHandBids } from "../src/logic.js";
import { nextAction } from "../src/nextstep.js";
import { S } from "../src/state.js";
import { aheadable, agreement, askFigures, askLines, brokerageClosing, claimCause, claimsAt, hubLosses, nowNext, spanLabel, windowLine, windowStates } from "../src/windowsui.js";

/** Client batch W: the delivery windows' screens (director-windows-screens-2026-11-13.md), on a world with windows on. */
const WIN = { ...GAME_CONFIG, windows: { ...GAME_CONFIG.windows, enabled: true } };
const any = { dest: "any", maxDh: 300, query: "" };
const windowed = (w: World) => [...w.loads.values()].filter((l): l is Load & { latestPickupT: number; latestDeliveryT: number } => l.status === "open" && l.latestPickupT !== undefined && l.latestDeliveryT !== undefined);

async function started(seed = 41) {
  const g = await TestGame.create(undefined, undefined, seed, WIN);
  const c = g.join("Window Freight", "oo", "LAX")!;
  return { g, w: g.w, c, truck: g.w.trucksByCompany.get(c.id)![0]! };
}

describe("client batch W: delivery windows on the page", () => {
  it("shows nothing new with windows off", async () => {
    const g = await TestGame.create(undefined, undefined, 41);
    const c = g.join("Plain Freight", "oo", "LAX")!;
    const w = g.w;
    const t = w.trucksByCompany.get(c.id)![0]!;
    const l = [...w.loads.values()].find((x) => x.status === "open")!;
    expect(windowLine(w, l)).toBeNull();
    expect(agreement(w, t, l, l.bookNow, 1)).toBeNull();
    expect(windowStates(w, c)).toEqual([]);
    expect(boardRows(w, c, t, any).every((r) => r.reach === null)).toBe(true);
  }, 120_000);

  it("the card's line and the sheet's claims read the engine's windows and shares", async () => {
    const { w, truck } = await started();
    const l = windowed(w)[0]!;
    const line = windowLine(w, l)!;
    expect(line.ready).toBe(whenLabel(w, l.readyT ?? w.t));
    expect([line.pickupBy, line.deliverBy]).toEqual([whenLabel(w, l.latestPickupT), whenLabel(w, l.latestDeliveryT)]);
    // The sheet, at Book now's rate: the no-show and late claims, in the economy's shares of the pay.
    const rows = boardRows(w, w.companies.find((x) => x.human)!, truck, any).filter((r) => !r.block && r.reach?.ok);
    const r = rows[0]!;
    const a = agreement(w, truck, r.l, r.l.bookNow, 1)!;
    const cl = claimsAt(w, r.l, r.l.bookNow);
    expect(cl.noShowFd).toBeCloseTo(WIN.windows.noShowClaimShare * r.l.bookNow * r.l.miles, 6);
    expect(a.lines[0]).toContain(Math.round(cl.noShowFd).toLocaleString("en-US"));
    expect(a.lines[1]).toContain(Math.round(cl.lateFd).toLocaleString("en-US"));
    // An idle truck's booking isn't ahead: no release line; the projection's slack is canMake's.
    expect(a.lines).toHaveLength(3);
    const reach = canMake(w, truck, r.l);
    expect(a.spareMin).toBeCloseTo(r.l.latestDeliveryT! - reach.deliverT, 6);
    expect(a.tight !== null).toBe(a.spareMin! < 240);
  }, 120_000);

  it("closes a load the truck can't make with canMake's reason, and sorts by the pickup's close", async () => {
    const { w, c, truck } = await started();
    const row = boardRows(w, c, truck, any).find((x) => !x.block && x.dh > 20)!;
    row.l.latestPickupT = w.t + 5; // closes before the truck could get there
    const again = boardRows(w, c, truck, any).find((x) => x.l.id === row.l.id)!;
    expect(again.reach?.ok).toBe(false);
    expect(again.block).toMatch(/^Truck 1 reaches .+, after the \d\d:\d\d pickup\.$/);
  }, 120_000);

  it("books ahead from where the truck will be free, one deep and never two, and the card shows now and next", async () => {
    const { g, w, c, truck } = await started();
    const first = boardRows(w, c, truck, any).find((x) => !x.block && x.reach?.ok)!;
    expect(g.act({ type: "book_load", truckId: truck.id, loadId: first.l.id }).ok).toBe(true);
    expect(aheadable(w, truck)).toBe(true);
    const ahead = boardRows(w, c, truck, any).filter((x) => !x.block && x.reach?.ok && x.l.id !== first.l.id);
    expect(ahead.length).toBeGreaterThan(0);
    const next = ahead[0]!;
    expect(next.reach!.freePlace).toBe(first.l.destPlace); // from this job's receiver
    expect(g.act({ type: "book_load", truckId: truck.id, loadId: next.l.id }).ok).toBe(true);
    expect(truck.nextLoadId).toBe(next.l.id);
    expect(aheadable(w, truck)).toBe(false);
    // A third: the engine refuses it, in the words the sheet turns into the director's.
    const third = ahead.find((x) => x.l.id !== next.l.id && x.l.status === "open")!;
    const res = g.act({ type: "book_load", truckId: truck.id, loadId: third.l.id });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.reason).toMatch(/already has its next load booked/);
    expect(WINDOWS.twoDeep(1)).toBe("Truck 1 already has a next load. Release it, or book this for another truck.");
    const nn = nowNext(w, c, truck);
    expect(nn.next).toContain("(booked ahead)");
    expect(nn.now).toMatch(/^Now: /);
    expect(windowStates(w, c).some((s) => s.kind === "next" && s.loadId === next.l.id)).toBe(true);
  }, 120_000);

  it("asks release or keep after a breakdown, with both prices, and What now? ranks a load at risk by its claim", async () => {
    const { g, w, c, truck } = await started();
    const first = boardRows(w, c, truck, any).find((x) => !x.block && x.reach?.ok)!;
    g.act({ type: "book_load", truckId: truck.id, loadId: first.l.id });
    const next = boardRows(w, c, truck, any).find((x) => !x.block && x.reach?.ok)!;
    expect(g.act({ type: "book_load", truckId: truck.id, loadId: next.l.id }).ok).toBe(true);
    const l = next.l;
    // The engine's ask (windows.ts afterBreakdown), as it stands after a breakdown the truck can't recover from.
    l.releaseAsk = { truckId: truck.id, fd: WIN.windows.cancelClaimShare.early * l.clearedRate * l.miles, t: w.t };
    const a = askFigures(w, l)!;
    const lines = askLines(w, a, 1);
    expect(lines[0]).toMatch(/^Truck 1's breakdown puts .+ at risk\.$/);
    expect(lines.some((x) => x.includes(Math.round(a.releaseFd).toLocaleString("en-US")))).toBe(true);
    expect(lines.at(-1)).toBe(WINDOWS.askNoAnswer(whenLabel(w, l.latestPickupT!)));
    expect(nextAction(WIN, w, c)).toMatchObject({ rule: 3, kind: "atRisk", loadId: l.id });
    // Keep: the ask goes; release: the claim, and the load back on the board.
    expect(g.act({ type: "keep_load", loadId: l.id }).ok).toBe(true);
    expect(l.releaseAsk).toBeUndefined();
    // A pickup the truck can no longer make, with no ask: What now?'s tier 3, its claim the no-show's.
    l.latestPickupT = w.t + 5;
    const risk = nextAction(WIN, w, c);
    expect(risk).toMatchObject({ rule: 3, kind: "loadRisk", end: "pickup", loadId: l.id });
    expect((risk as { claimFd: number }).claimFd).toBeCloseTo(claimsAt(w, l, l.clearedRate).noShowFd, 6);
    expect(g.act({ type: "release_load", loadId: l.id }).ok).toBe(true);
    expect(truck.nextLoadId).toBeUndefined();
  }, 120_000);

  it("says a lost load as gone, a brokerage's closing load with its fall-off, the hubs' losses and a claim's cause", async () => {
    const { w, c } = await started();
    // A hand bid whose load nobody took by its close: the engine deletes it; the card says it's gone, no follow-up.
    S.game = { w, player: c, kind: "test" } as never;
    try {
      S.handBids.clear();
      S.handBids.set(99_999, { rate: 3, be: 2, truckId: 1, from: "Dallas", to: "Tulsa", closes: w.t - 1 });
      settleHandBids(S.game as never);
      expect(S.result?.gone).toBe(WINDOWS.lostBid("Dallas", "Tulsa", hhmm(w.t - 1)));
      expect(S.result?.lost).toBeUndefined();
    } finally {
      S.result = null;
      S.handBids.clear();
      S.game = null;
    }
    // A brokerage's posted load closing within the day.
    const l = windowed(w).find((x) => x.latestPickupT - w.t < 1440 && x.latestPickupT > w.t)!;
    const was = l.brokerId;
    l.brokerId = c.id;
    const closing = brokerageClosing(w, c);
    expect(closing.map((x) => x.load.id)).toContain(l.id);
    expect(closing.find((x) => x.load.id === l.id)!.fallOffFd).toBeCloseTo(WIN.brokerRisk.fallOffShare * l.shipperRate * l.miles, 6);
    l.brokerId = was;
    // The hubs' lost loads this week (the engine's tally).
    for (let i = 0; i < 3; i++) tally(w, npcKey(7), "lost");
    expect(hubLosses(w).find((x) => x.hub === 7)?.lost).toBeGreaterThanOrEqual(3);
    // The first claim's cause, in figures.
    l.arrivedT = l.latestDeliveryT + 180;
    expect(claimCause(w, `claim:late:${l.id}`, 690)).toBe(WINDOWS.claimCauseLate(w.net.places[l.destPlace]!.name, spanLabel(180), "690"));
    expect(spanLabel(180)).toBe("3 h");
  }, 120_000);
});
