import "./seed.js";
import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../src/game.js";
import { marketPages } from "../src/guide/market.js";

/** windows.windowScale in the guide (the director's §18): the commodity table reads the scaled hours, with no new words. */
const page = (windowScale: number, enabled: boolean) => marketPages({ ...GAME_CONFIG, windows: { ...GAME_CONFIG.windows, enabled, windowScale } }).find((p) => p.id === "commodities")!.html;

describe("the guide's commodity table under windows.windowScale", () => {
  it("windows on: produce's 36 h at 1, 9 h at a quarter", () => {
    expect(page(1, true)).toContain("36 h after the pickup closes");
    expect(page(0.25, true)).toContain("9 h after the pickup closes");
    expect(page(0.25, true)).not.toContain("36 h after the pickup closes");
    expect(page(0.25, true)).not.toContain("120 h after");
  });

  it("windows off: the same hours after posting", () => {
    expect(page(1, false)).toContain("36 h after posting");
    expect(page(0.25, false)).toContain("9 h after posting");
    expect(page(0.25, false)).not.toContain("120 h after posting");
  });
});
