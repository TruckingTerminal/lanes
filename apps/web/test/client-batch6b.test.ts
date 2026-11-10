import "./seed.js";
import { describe, expect, it } from "vitest";
import { companyAccount, type Company, type World } from "@lanes/engine";
import { firstTruckLine, gapToTruck, waitCostFd, weeklyGross } from "../src/figures.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { nextAction } from "../src/nextstep.js";

/** Client batch 6b (2026-11-10): the director's ruling on a truck that doesn't deliver today (DECISIONS.md 2026-11-10). */

const today = (w: World) => Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
/** A starter with the cash for any truck, the used lot priced: every listing asks ten times its price (still for sale). */
async function lotPriced(): Promise<{ g: TestGame; w: World; c: Company } | null> {
  const g = await TestGame.create();
  const c = g.join("Batch Six B Freight", "oo", "LAX")!;
  const w = g.w;
  if (!(w.cfg.usedMarket.npcLot.enabled && w.cfg.assets.enabled && w.usedLot.stock > 0)) return null;
  for (const l of w.listings) if (l.status === "open") l.askFd *= 10;
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), 5_000_000, "test");
  return { g, w, c };
}

describe("client batch 6b: order today, delivered later", () => {
  it("says 'You can order today · delivered {date}' for a queued truck, names a sooner one, and prices the wait", async () => {
    const s = await lotPriced();
    if (!s) return;
    const { w, c } = s;
    const gap = gapToTruck(w, c);
    expect(gap.truck!.route).toBe("lot");
    expect(gap.truck!.arrivesDay!).toBeGreaterThan(today(w));
    const f = firstTruckLine(w, c)!;
    expect(f.met).toBe(true);
    expect(f.figure).toMatch(/^You can order today · delivered /);
    expect(f.figure).not.toContain("You can buy today");
    // A listing delivers today: the second line names it, with its cash today.
    if (w.listings.some((l) => l.status === "open" && l.truckId > 0)) expect(f.sooner).toMatch(/^Or a .+ FD today, delivered today\.$/);
    // The wait in the lessor's share: none with no gross yet; with a week's gross, share × gross × days / 7.
    c.operating.revenueFd = 0;
    expect(firstTruckLine(w, c)!.wait).toBeNull();
    c.operating.revenueFd = 7_000;
    const days = gap.truck!.arrivesDay! - today(w);
    const cost = waitCostFd(w, c, days);
    expect(cost).toBeCloseTo(w.cfg.costs.npcLeaseShareOfGross * weeklyGross(w, c) * (days / 7), 6);
    const wait = firstTruckLine(w, c)!.wait!;
    expect(wait).toContain(`for ${days} days`);
    expect(wait).toContain(`${Math.round(w.cfg.costs.npcLeaseShareOfGross * 100)}%`);
  }, 120_000);

  it("says the company's freight when the priced truck pulls another trailer", async () => {
    const s = await lotPriced();
    if (!s) return;
    const { w, c } = s;
    expect(gapToTruck(w, c).truck!.spec.trailer).toBe("van");
    expect(firstTruckLine(w, c)!.what).not.toContain("your company hauls");
    w.trucksByCompany.get(c.id)![0]!.trailer = "reefer";
    expect(firstTruckLine(w, c)!.what).toMatch(/; your company hauls reefer\.$/);
  }, 120_000);

  it("once ordered, the figure and What now? count the wait", async () => {
    const s = await lotPriced();
    if (!s) return;
    const { g, w, c } = s;
    const r = g.act({ type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: true, used: true });
    expect(r.ok).toBe(true);
    const o = w.orders.find((x) => x.companyId === c.id)!;
    const f = firstTruckLine(w, c)!;
    expect(f.ordered).toBe(true);
    expect(f.figure).toMatch(new RegExp(`^Your truck arrives .+, in ${o.dueDay - today(w)} days; until then the leased one runs$`));
    const a = nextAction(GAME_CONFIG, w, c);
    // What now?'s rule 5 says the wait, unless something needs the player first (rules 1–4).
    if (a.rule === 5) expect(a).toEqual({ rule: 5, kind: "ordered", days: o.dueDay - today(w) });
  }, 120_000);
});
