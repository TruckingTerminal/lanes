import type { Company } from "@lanes/engine";
import { GAME_CONFIG } from "./game.js";
import { bumpData, S, setTab, type Session } from "./state.js";
import { BROKER_NAV, NAV, type Tab } from "./tabs.js";

/**
 * Two companies under one login (specs/brokerage-rule.md section 2, brokerage-ux.md section 1): a carrier and, once
 * started, a brokerage. One is in view at a time; the session's `player` is that one, so every screen and order belongs
 * to it. Behind `brokerage.enabled`: while it's off, the player has one company and nothing here shows.
 */
export type CompanyKind = "carrier" | "brokerage";

/** Whether the player has both companies (the switch shows only then). */
export const hasTwo = (g: Session | null): boolean => !!g && GAME_CONFIG.brokerage.enabled && !!g.carrier && !!g.brokerage;

/** The kind of company in view. */
export const kindInView = (g: Session): CompanyKind => (hasTwo(g) && g.inView === "brokerage" ? "brokerage" : "carrier");

/** The other company, when there are two. */
export const otherCompany = (g: Session): Company | null => (!hasTwo(g) ? null : kindInView(g) === "brokerage" ? g.carrier : g.brokerage);

/** The bar for the company in view: Truck · Loads · Money · More, or Book · Carriers · Money · More. */
export const navFor = (g: Session | null): readonly Tab[] => (g && kindInView(g) === "brokerage" ? BROKER_NAV : NAV);

/** Brings a company into view: changes nothing in the world, so no confirm. Asked answers and open sheets belong to the other. */
export function switchCompany(kind: CompanyKind): void {
  const g = S.game;
  if (!g || (kind === "brokerage" && !hasTwo(g)) || kindInView(g) === kind) return;
  g.inView = kind;
  S.whatNow = null;
  S.explain = null;
  S.milestone = null;
  S.openLoad = null;
  setTab(kind === "brokerage" ? "book" : "fleet");
  bumpData();
}
