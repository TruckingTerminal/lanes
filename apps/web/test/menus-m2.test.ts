import "./seed.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Batch M2, QA's replay on M1 (qa-0251-menus-2026-11-14.md): the motion rules §2.1 and §2.6 ask for. */
const page = readFileSync(join(__dirname, "..", "src", "page.html"), "utf8");

describe("batch M2", () => {
  it("Calm transitions opacity only, never 'all'; the sheet no longer animates its height", () => {
    const calm = page.split("\n").find((l) => l.startsWith('html[data-motion="calm"] *'))!;
    expect(calm).toContain("transition-property: opacity !important");
    const sheet = page.split("\n").find((l) => l.trim().startsWith(".sheet { position: fixed"))!;
    expect(sheet).not.toMatch(/transition/);
    expect(page).not.toMatch(/transition: height/);
  });
});

describe("batch M4: a delivery's settlement fee stays off the cost chip", () => {
  it("keeps a delivery's deductions and its fee off the chip, and lets a sale's or a lease's fee through", async () => {
    const { deliveryDeduction } = await import("../src/moneymotion.js");
    expect(deliveryDeduction("load:812")).toBe(true);
    expect(deliveryDeduction("fee:load:812")).toBe(true); // settlement.ts: `fee:${ref}`
    expect(deliveryDeduction("fee:lease:week:3")).toBe(false);
    expect(deliveryDeduction("fee:rebroker:812")).toBe(false);
    expect(deliveryDeduction("fee:sale:7")).toBe(false);
    expect(deliveryDeduction("perdiem:4")).toBe(false);
  });
});
