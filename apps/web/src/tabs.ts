import { crewed, dayOf, layerBlock, tokenLive, type Company, type World } from "@lanes/engine";
import { dayDate } from "./format.js";
import { GAME_CONFIG } from "./game.js";
import { PENDING } from "./copy-pending.js";
import { gapToTruck } from "./figures.js";
import { S, setOnboard } from "./state.js";
import { skippedSteps, stepScope, walkSteps } from "./walkthrough.js";

/**
 * The tab registry: every panel the rack can show, with its label and icon. The nav, the More list, the teaser row,
 * the panel switch (ui/Rack.tsx PANELS, a Record over these ids so a tab can't be left without a panel) and the
 * walkthrough's "Go to" buttons all read it, so a tab is added, renamed, moved or opened here only.
 *
 * The first ten minutes (specs/first-ten-minutes.md, copy-first-ten-minutes.md): four in the nav, Truck · Loads ·
 * Money · More. More lists Iuliia, Help and Company, then the teasers: each a tab that opens on its trigger and
 * until then shows a card saying what it is and when it opens.
 */
export const TAB_IDS = ["fleet", "loads", "money", "more", "iuliia", "guide", "company", "intel", "staff", "market", "rates", "logbook", "finance", "economy", "business", "backlot", "brokerage", "book", "carriers"] as const;
export type Tab = (typeof TAB_IDS)[number];

export interface Teaser {
  /** What it is, in one line. */
  what: string;
  /** Iuliia's line about it. */
  iuliia: string;
  /** When it opens, as the card says it: "at your second truck", "on Jan 29, Year 1". */
  opens: (w: World) => string;
  /** Whether it has opened for this company. */
  open: (w: World, c: Company | null) => boolean;
  /** Not offered at all (its rule's switch is off): no card, no row. */
  hidden?: () => boolean;
  /**
   * Opens on the company's progress, which can fall back (cash, a truck sold, a seat filled), so once open for a company
   * it stays open (the director, 2026-11-09: no tab ever vanishes from More). Kept in the browser's onboarding record.
   */
  sticky?: boolean;
}

export interface TabDef {
  id: Tab;
  label: string;
  /** The code-drawn icon's name (art.ts), used until the menu atlases (ui/kit.png, ui/icons.png) are in. */
  icon: string;
  /** A tab that opens on a trigger; until then it is a card in More (and on the laptop's teaser row). */
  teaser?: Teaser;
}

const trucksOf = (w: World, c: Company) => (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired");
/** The day a layer opens, as a date: its published day of the beta, or after launch. */
export const layerDay = (w: World, layer: "businesses" | "brokerage"): string => dayDate((w.token.launchDay ?? 0) + w.cfg.unlockLadder.layers[layer].afterDays);
/** The walkthrough step the Dealer and Finance wait for ("when Iuliia says so": buying your first truck). */
const OWN_STEP = walkSteps(GAME_CONFIG).findIndex((s) => s.id === "own");
/**
 * The first truck within reach (the director, 2026-11-09, ruled again after QA's replay): the one first-truck figure met
 * (figures.ts gapToTruck: the cheapest truck's cash on the day, less the player's cash), the same figure the teaser,
 * Iuliia's page and the Dealer's card show, so the opening and the number never disagree. The hold toward the lessor's
 * truck counts inside it, not as a rule of its own. Kept for the game minute, since the nav and More read it every draw.
 */
let affordMemo: { w: World | null; t: number; c: number; v: boolean } = { w: null, t: -1, c: -1, v: false };
export function firstTruckAffordable(w: World, c: Company): boolean {
  if (affordMemo.w === w && affordMemo.t === w.t && affordMemo.c === c.id) return affordMemo.v;
  const gap = gapToTruck(w, c);
  const v = gap.gapFd <= 0 && Number.isFinite(gap.needNowFd);
  affordMemo = { w, t: w.t, c: c.id, v };
  return v;
}

/**
 * When the Dealer and Finance open (the director, 2026-11-02, QA item 8 and 2026-11-09), whichever comes first:
 * - the first truck is within reach (firstTruckAffordable), whatever the walkthrough's step, so Iuliia's "you can afford
 *   your next truck now" never points at a closed tab;
 * - the walkthrough reaches the first-truck step, a skipped step counting as passed (a skipped step never keeps a tab
 *   closed: the gamer's diary skipped "The law" and the Dealer stayed shut);
 * - day 28, when her line ("most need a second truck · See the Dealer") reaches this company; a company that began after
 *   the line's window (milestones.ts) never hears it. The line before day 28 carries its button only once the Dealer is
 *   open (ui/Milestones.tsx).
 * Once open, tabOpen keeps them open (sticky).
 */
export function firstTruckOpen(w: World, c: Company, skipped: readonly string[] = skippedSteps(S.onboard.seen, w, c)): boolean {
  if (trucksOf(w, c).length >= 2) return true;
  const index = walkSteps(GAME_CONFIG).findIndex((s) => !s.done(w, c) && !skipped.includes(s.id));
  if (index < 0 || index >= OWN_STEP) return true;
  if (firstTruckAffordable(w, c)) return true;
  const ladder = w.cfg.unlockLadder;
  if (!ladder.enabled && !ladder.beta.enabled) return false;
  const d28 = ladder.layers.businesses.afterDays;
  const win = w.cfg.guide.milestoneWindowDays;
  return c.createdDay <= d28 + win && Math.floor(w.t / w.cfg.time.gameMinutesPerDay) >= d28;
}

export const TABS: readonly TabDef[] = [
  { id: "fleet", label: "Truck", icon: "truck" },
  { id: "loads", label: "Loads", icon: "board" },
  { id: "money", label: "Money", icon: "money" },
  { id: "more", label: "More", icon: "star" },
  { id: "iuliia", label: "Iuliia", icon: "people" },
  { id: "guide", label: "Help", icon: "book" },
  { id: "company", label: "Company", icon: "building" },
  { id: "intel", label: "Intel", icon: "people" },
  {
    id: "staff",
    label: "Staff",
    icon: "people",
    teaser: {
      what: "Drivers and dispatchers: who you hire, what you pay, who stays.",
      iuliia: "You'll need one at the second truck, or sooner if a seat is empty.",
      opens: () => "at your second truck, or a truck without a driver",
      open: (w, c) => !!c && (trucksOf(w, c).length >= 2 || trucksOf(w, c).some((t) => !crewed(t))),
      sticky: true,
    },
  },
  {
    id: "market",
    label: "Dealer",
    icon: "tag",
    teaser: {
      what: "New, used and leased rigs, and trailers of your own.",
      iuliia: "I'll say when it's time to buy. The first one is arithmetic.",
      opens: () => PENDING.dealerOpens,
      open: (w, c) => !!c && firstTruckOpen(w, c),
      sticky: true,
    },
  },
  {
    id: "rates",
    label: "Rates",
    icon: "pin",
    teaser: {
      what: "What each hub pays, by trailer, and which way freight runs.",
      iuliia: "Useful once you've been paid and know what a rate is.",
      opens: () => "at your first delivery",
      open: (_w, c) => !c || c.delivered > 0,
    },
  },
  {
    id: "logbook",
    label: "Logbook",
    icon: "star",
    teaser: {
      what: "What your Miles become, and when.",
      iuliia: "It opens with the token, and not before.",
      opens: (w) => `at the token's launch, ${dayDate(w.cfg.token.betaYears * 365)}`,
      open: (w) => tokenLive(w),
    },
  },
  {
    id: "finance",
    label: "Finance",
    icon: "fd",
    teaser: {
      what: "Getting paid on your own truck: quick pay, load by load, and the factoring contract.",
      iuliia: "Read it before you buy, not after. The wait for your money starts with your first load.",
      // The director, 2026-11-02 (2b32a9d): Finance opens with the first-truck step, beside the Dealer, so Iuliia never
      // points at a locked tab.
      opens: () => PENDING.financeOpens,
      open: (w, c) => !!c && firstTruckOpen(w, c),
      sticky: true,
    },
  },
  {
    id: "economy",
    label: "Economy",
    icon: "star",
    teaser: {
      what: "The market's own books: what comes in, what goes out.",
      iuliia: "A month in, you'll want it.",
      // The first monthly report: the end of the world's first 30-day month.
      opens: () => `at the first monthly report, ${dayDate(30)}`,
      open: (w) => dayOf(w.t, w.cfg) >= 30,
    },
  },
  {
    id: "business",
    label: "Business",
    icon: "wrench",
    teaser: {
      what: "Yards, shops, truck stops, warehouses.",
      iuliia: "Nobody needs a warehouse in week one.",
      opens: (w) => `on ${layerDay(w, "businesses")}`,
      open: (w) => !layerBlock(w, "businesses"),
    },
  },
  {
    id: "backlot",
    label: "Back Lot",
    icon: "wrench",
    teaser: {
      what: "A later beta: player against player. A gate and cameras for your yard, and a meter for how much attention you draw.",
      iuliia: "Someone will want your cargo one day. Lock the gate.",
      opens: () => "with a later beta",
      open: (w) => w.cfg.robbery.enabled && w.cfg.robbery.lot.enabled && !layerBlock(w, "robbery"),
    },
  },
  {
    // A player's brokerage (brokerage-rule.md section 7): the teaser before its layer opens, then "Start a brokerage".
    id: "brokerage",
    label: "Brokerage",
    icon: "book",
    teaser: {
      what: "Your own brokerage: a second company that posts freight for other carriers to haul.",
      iuliia: `You'll need an active carrier and ${GAME_CONFIG.token.staking.roles.broker.toLocaleString("en-US")} FD for the bond.`,
      opens: (w) => `on ${layerDay(w, "brokerage")}`,
      open: (w) => w.cfg.brokerage.enabled && !layerBlock(w, "brokerage"),
      hidden: () => !GAME_CONFIG.brokerage.enabled,
    },
  },
  // A player's brokerage (specs/brokerage-ux.md section 2): its own bar's two places past Money and More.
  { id: "book", label: "Book", icon: "book" },
  { id: "carriers", label: "Carriers", icon: "people" },
];

const BY_ID = new Map(TABS.map((t) => [t.id, t]));
export const tabDef = (id: Tab): TabDef => BY_ID.get(id)!;

/** The nav's four, in order. */
export const NAV: readonly Tab[] = ["fleet", "loads", "money", "more"];
/** The brokerage's four (specs/brokerage-ux.md section 2): the same places as the carrier's, so the thumb learns one bar. */
export const BROKER_NAV: readonly Tab[] = ["book", "carriers", "money", "more"];
/** Under More, before the teasers. */
export const MORE: readonly Tab[] = ["iuliia", "guide", "company", "intel"];

/** A tab's label for this company: "Truck" reads "Trucks" from the second truck. */
export function tabLabel(id: Tab, w: World | null, c: Company | null): string {
  if (id === "fleet" && w && c && trucksOf(w, c).length >= 2) return "Trucks";
  return tabDef(id).label;
}
export const TAB_NAME = Object.fromEntries(TABS.map((t) => [t.id, t.label])) as Record<Tab, string>;

/** The onboarding record's mark for a sticky tab that has opened for this company. */
const openKey = (id: Tab, w: World, c: Company): string => `${stepScope(w, c)}|open:${id}`;
/** Whether a tab shows its panel (not its teaser card) for this company; a sticky one, once open, stays open. */
export const tabOpen = (id: Tab, w: World, c: Company | null): boolean => {
  const t = tabDef(id).teaser;
  if (!t) return true;
  if (!t.sticky || !c) return t.open(w, c);
  const key = openKey(id, w, c);
  if (S.onboard.seen.includes(key)) return true;
  if (!t.open(w, c)) return false;
  // Marked after the draw that found it open, never during it.
  queueMicrotask(() => {
    if (!S.onboard.seen.includes(key)) setOnboard({ seen: [...S.onboard.seen, key] });
  });
  return true;
};
/** The teaser tabs, open or not, in order. */
export const teaserTabs = (): TabDef[] => TABS.filter((t) => t.teaser && !t.teaser.hidden?.());
/** Which nav item a tab sits under: its own, or More for everything else. */
export const navOf = (id: Tab): Tab => (NAV.includes(id) || BROKER_NAV.includes(id) ? id : "more");
