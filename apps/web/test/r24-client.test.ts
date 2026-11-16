import "./seed.js";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FIXES } from "../src/copy-fixes.js";

/** The director's §26 (detention.fromOpening): the booking's dock warning says a wait at a shut dock is unpaid. */
describe("the dock warning's unpaid wait (§26)", () => {
  it("the line, and it shows under the warning only with detention and fromOpening on", () => {
    expect(FIXES.dockWaitUnpaid(2)).toBe("The wait is unpaid: detention counts only from when the dock opens, and its first two hours are free.");
    expect(FIXES.dockWaitUnpaid(1)).toBe("The wait is unpaid: detention counts only from when the dock opens, and its first hour is free.");
    const chip = readFileSync(join(__dirname, "..", "src", "ui", "ProfitChip.tsx"), "utf8");
    expect(chip).toContain("w.cfg.detention.enabled && w.cfg.detention.fromOpening === true ?");
    expect(chip).toContain("{FIXES.dockWaitUnpaid(w.cfg.detention.freeHours)}");
  });
});
