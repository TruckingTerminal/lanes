import { crewed, dayOf, layerBlock, tokenLive, type Company, type World } from "@lanes/engine";
import { dayDate } from "./format.js";
import { GAME_CONFIG } from "./game.js";
import { walkProgress, walkSteps } from "./walkthrough.js";

/**
 * The tab registry: every panel the rack can show, with its label and icon. The nav, the More list, the teaser row,
 * the panel switch (ui/Rack.tsx PANELS, a Record over these ids so a tab can't be left without a panel) and the
 * walkthrough's "Go to" buttons all read it, so a tab is added, renamed, moved or opened here only.
 *
 * The first ten minutes (specs/first-ten-minutes.md, copy-first-ten-minutes.md): four in the nav, Truck · Loads ·
 * Money · More. More lists Iuliia, Help and Company, then the teasers: each a tab that opens on its trigger and
 * until then shows a card saying what it is and when it opens.
 */
export const TAB_IDS = ["fleet", "loads", "money", "more", "iuliia", "guide", "company", "staff", "market", "rates", "logbook", "finance", "economy", "business", "backlot"] as const;
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
}

export interface TabDef {
  id: Tab;
  label: string;
  /** The code-drawn icon's name (art.ts), used until assets/icons/<id>.png is painted. */
  icon: string;
  /** A tab that opens on a trigger; until then it is a card in More (and on the laptop's teaser row). */
  teaser?: Teaser;
}

const trucksOf = (w: World, c: Company) => (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired");
/** The day a layer opens, as a date: its published day of the beta, or after launch. */
const layerDay = (w: World, layer: "businesses"): string => dayDate((w.token.launchDay ?? 0) + w.cfg.unlockLadder.layers[layer].afterDays);
/** The walkthrough step the Dealer waits for ("when Iuliia says so": buying your first truck). */
const OWN_STEP = walkSteps(GAME_CONFIG).findIndex((s) => s.id === "own");

export const TABS: readonly TabDef[] = [
  { id: "fleet", label: "Truck", icon: "truck" },
  { id: "loads", label: "Loads", icon: "board" },
  { id: "money", label: "Money", icon: "money" },
  { id: "more", label: "More", icon: "star" },
  { id: "iuliia", label: "Iuliia", icon: "people" },
  { id: "guide", label: "Help", icon: "book" },
  { id: "company", label: "Company", icon: "building" },
  {
    id: "staff",
    label: "Staff",
    icon: "people",
    teaser: {
      what: "Drivers and dispatchers: who you hire, what you pay, who stays.",
      iuliia: "You'll need one at the second truck, or sooner if a seat is empty.",
      opens: () => "at your second truck, or a truck without a driver",
      open: (w, c) => !!c && (trucksOf(w, c).length >= 2 || trucksOf(w, c).some((t) => !crewed(t))),
    },
  },
  {
    id: "market",
    label: "Dealer",
    icon: "tag",
    teaser: {
      what: "New, used and leased rigs, and trailers of your own.",
      iuliia: "I'll say when it's time to buy. The first one is arithmetic.",
      opens: () => "when Iuliia says so",
      open: (w, c) => {
        if (!c) return false;
        if (trucksOf(w, c).length >= 2) return true;
        const { index } = walkProgress(GAME_CONFIG, w, c);
        return index < 0 || index >= OWN_STEP;
      },
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
      what: "Getting paid faster, and what that costs.",
      iuliia: "A second truck makes it worth reading.",
      opens: () => "at your second truck",
      open: (w, c) => !!c && trucksOf(w, c).length >= 2,
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
      what: "A later beta.",
      iuliia: "A later chapter. I don't give away the plot.",
      opens: () => "with a later beta",
      open: (w) => w.cfg.robbery.enabled && w.cfg.robbery.lot.enabled && !layerBlock(w, "robbery"),
    },
  },
];

const BY_ID = new Map(TABS.map((t) => [t.id, t]));
export const tabDef = (id: Tab): TabDef => BY_ID.get(id)!;

/** The nav's four, in order. */
export const NAV: readonly Tab[] = ["fleet", "loads", "money", "more"];
/** Under More, before the teasers. */
export const MORE: readonly Tab[] = ["iuliia", "guide", "company"];

/** A tab's label for this company: "Truck" reads "Trucks" from the second truck. */
export function tabLabel(id: Tab, w: World | null, c: Company | null): string {
  if (id === "fleet" && w && c && trucksOf(w, c).length >= 2) return "Trucks";
  return tabDef(id).label;
}
export const TAB_NAME = Object.fromEntries(TABS.map((t) => [t.id, t.label])) as Record<Tab, string>;

/** Whether a tab shows its panel (not its teaser card) for this company. */
export const tabOpen = (id: Tab, w: World, c: Company | null): boolean => {
  const t = tabDef(id).teaser;
  return !t || t.open(w, c);
};
/** The teaser tabs, open or not, in order. */
export const teaserTabs = (): TabDef[] => TABS.filter((t) => t.teaser);
/** Which nav item a tab sits under: its own, or More for everything else. */
export const navOf = (id: Tab): Tab => (NAV.includes(id) ? id : "more");
