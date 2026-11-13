import "./seed.js";
import { describe, expect, it } from "vitest";
import { TestGame } from "../src/game.js";
import { payLine } from "../src/rolling.js";

describe("the settlement fee on the pay card (token.settlementFee)", () => {
  it("its own row, and the rows still add up to what reached the company", async () => {
    const g = await TestGame.create();
    const c = g.join("Fee Freight", "oo", "LAX")!;
    const w = g.w;
    (w as unknown as { cfg: typeof w.cfg }).cfg = { ...w.cfg, token: { ...w.cfg.token, settlementFee: { enabled: true, share: 0.01 } } };
    const t = w.trucksByCompany.get(c.id)![0]!;
    const load = [...w.loads.values()][0]!;
    const gross = 4_000;
    const cost = 1_500 + gross * w.cfg.costs.npcLeaseShareOfGross + gross * 0.01; // the trip, the lessor's share, the fee
    const line = payLine(w, t, load, gross, cost, { emptyMi: 0, depositFd: t.depositFd ?? 0 });
    expect(line.settlement).toBeCloseTo(40, 6);
    const sum = line.load + line.detention - line.fuel - line.tolls - line.driver - line.upkeep - line.lessor - line.settlement - line.held;
    expect(sum).toBeCloseTo(line.yours, 6);
  }, 60_000);
});
