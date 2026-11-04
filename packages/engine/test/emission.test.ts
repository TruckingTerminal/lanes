import { describe, expect, it } from "vitest";
import { economyConfig as cfg } from "@lanes/config";
import { budgetFd, cumulativeBudgetFd, emissionMultiplier, emissionRatio } from "@lanes/engine";

// The emission cap (studio/reviews/economy-emission.md, emission.ts).
const k = cfg.token.emission;

describe("emission cap", () => {
  it("the schedule declines geometrically and sums to the cap less genesis", () => {
    const r = emissionRatio(k);
    expect(r).toBeCloseTo(0.95, 10); // 1 − 30M ÷ 600M
    expect(budgetFd(k, 0)).toBe(30_000_000);
    expect(budgetFd(k, 1)).toBeCloseTo(28_500_000, 4);
    expect(cumulativeBudgetFd(k, 1)).toBeCloseTo(58_500_000, 4);
    let s = 0;
    for (let m = 0; m < 2000; m++) s += budgetFd(k, m);
    expect(s).toBeCloseTo(k.capFd - k.genesisFd, -1);
    expect(cumulativeBudgetFd(k, 5000)).toBeLessThanOrEqual(k.capFd - k.genesisFd + 1);
  });

  it("the multiplier is remaining ÷ expected remaining spend, clamped to [0.5, 1]", () => {
    expect(emissionMultiplier(k, 30e6, 30e6, 30, 30)).toBe(1); // on schedule at the month's start
    expect(emissionMultiplier(k, 8e6, 30e6, 10, 30)).toBeCloseTo(0.8, 10); // 8M left against 10M expected
    expect(emissionMultiplier(k, 2e6, 30e6, 10, 30)).toBe(0.5); // run down: the floor, not a cliff
    expect(emissionMultiplier(k, -5e6, 30e6, 10, 30)).toBe(0.5); // overspent
    expect(emissionMultiplier(k, 20e6, 30e6, 10, 30)).toBe(1); // underspent: never above base
    expect(emissionMultiplier(k, 1, 30e6, 0, 30)).toBe(1);
  });
});
