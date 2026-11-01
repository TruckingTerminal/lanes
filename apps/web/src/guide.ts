import type { EconomyConfig } from "@lanes/config";
import { growthPages } from "./guide/growth.js";
import { marketPages } from "./guide/market.js";
import { moneyPages } from "./guide/money.js";
import { operationsPages } from "./guide/operations.js";
import { referencePages } from "./guide/reference.js";
import { roadmapPages } from "./guide/roadmap.js";
import { safetyPages } from "./guide/safety.js";
import { staffPages } from "./guide/staff.js";
import { startPages } from "./guide/start.js";
import type { GuidePage } from "./guide/util.js";

export type { GuidePage } from "./guide/util.js";

/**
 * The guide: every system in the game, how it works and what it costs, in the
 * order a new player meets them. Every number comes from the config the world
 * runs on, so the guide can't drift from the rules. The in-game Guide tab and the
 * test site's docs page (docs.ts) both render these pages.
 */
export function guidePages(cfg: EconomyConfig): GuidePage[] {
  return [...startPages(cfg), ...marketPages(cfg), ...operationsPages(cfg), ...staffPages(cfg), ...growthPages(cfg), ...moneyPages(cfg), ...safetyPages(cfg), ...roadmapPages(cfg), ...referencePages(cfg)];
}
