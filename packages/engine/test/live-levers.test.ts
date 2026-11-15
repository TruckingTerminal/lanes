import { describe, expect, it } from "vitest";
import { applyLevers, economyConfig, LIVE_LEVERS } from "@lanes/config";

/**
 * The live levers (live.ts) are set by path (applyLevers). A lever that names a switch's object, not its `enabled`,
 * replaces the object with the bare value: the switch then reads undefined, off, with nothing thrown. 0.25.3's
 * switch-on had two ("labor.busHome" and "labor.dueHomePlan"), and the bus and §5 stayed off.
 */
const isObject = (x: unknown): boolean => typeof x === "object" && x !== null && !Array.isArray(x);
const at = (root: unknown, path: string): unknown => path.split(".").reduce<unknown>((node, k) => (node as Record<string, unknown>)[k], root);

describe("the live levers", () => {
  it("each sets a value, never replacing an object with a bare one", () => {
    const replaced = Object.entries(LIVE_LEVERS).filter(([path, value]) => isObject(at(economyConfig, path)) && !isObject(value));
    expect(replaced.map(([path]) => path)).toEqual([]);
  });

  it("the check catches a switch named by its object", () => {
    const cfg = applyLevers(economyConfig, { "labor.busHome": true });
    expect((cfg.labor.busHome as unknown as { enabled?: boolean }).enabled).toBeUndefined();
    expect(applyLevers(economyConfig, { "labor.busHome.enabled": true }).labor.busHome?.enabled).toBe(true);
  });
});
