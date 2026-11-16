import "./seed.js";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FIXES } from "../src/copy-fixes.js";

/** The director's §26 and §29 (detention.fromOpening): the booking's dock warning says a wait at a shut dock is the carrier's own time. */
describe("the dock warning's unpaid wait (§26, §29)", () => {
  it("the line, and it shows under the warning only with detention and fromOpening on", () => {
    expect(FIXES.dockWaitUnpaid).toBe("Waiting until a dock opens is your own time.");
    const chip = readFileSync(join(__dirname, "..", "src", "ui", "ProfitChip.tsx"), "utf8");
    expect(chip).toContain("w.cfg.detention.enabled && w.cfg.detention.fromOpening === true ?");
    expect(chip).toContain("{FIXES.dockWaitUnpaid}");
  });
});
