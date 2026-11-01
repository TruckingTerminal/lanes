import type { EconomyConfig } from "@lanes/config";
import { type GuidePage, p, ul } from "./util.js";

const S = "The road ahead";

/** The vision in one place: what's live, what each locked tab will be, and how to tell us what you think. */
export function roadmapPages(cfg: EconomyConfig): GuidePage[] {
  const L = cfg.unlockLadder.layers;
  const weeks = (d: number) => `${Math.round((d * cfg.time.realHoursPerGameDayLive) / 24 / 7)} real week${Math.round((d * cfg.time.realHoursPerGameDayLive) / 24 / 7) === 1 ? "" : "s"}`;
  return [
    {
      id: "roadmap",
      section: S,
      title: "What's live, what's next",
      html:
        p(`LANES is built in layers, each one tested in the simulator against bots before it reaches players. The beta you're in runs the hauling game end to end, and the layers below are open in it; the locked tabs are the ones still on the drawing board, shown so you can see where this goes. From the token's launch the ladder opens each layer again on a published day, so the market settles before the deeper games begin.`) +
        ul([
          `<b>Live now:</b> the freight market, your trucks and trailers, docks, weather and terrain, parking, theft in the corridors, the used lot, loans, staff, the businesses and the yard, Miles.`,
          `<b>Businesses and facilities</b> reopen ${L.businesses.afterDays} game days after the token's launch (${weeks(L.businesses.afterDays)}): shops, fuel stations, truck stops, dealerships, warehouses that ship their own freight.`,
          `<b>Re-brokering</b> reopens at ${L.brokerage.afterDays} game days (${weeks(L.brokerage.afterDays)}): a licence, a bond, and the right to post loads for other carriers.`,
          `<b>The Back Lot</b> comes at ${L.robbery.afterDays} game days after the launch (${weeks(L.robbery.afterDays)}), once it leaves the simulator: crews for hire off a board, a fence and a chop shop with a demand list, bounties, heat. Player against player, in the open, and the law watching.`,
          `<b>The token's launch</b> ends the farming season: Miles become the airdrop, paid into the game and unlocked by the Logbook's milestones; FD leaves the game only through the bridge, with its timer and its tax.`,
          `<b>Later:</b> the authoritative server and accounts by email, the Monthly Economic Report, new territory when the hubs are crowded.`,
        ]) +
        p(`Nothing here is a promise of money. Miles are your standing in the beta; what they become is announced when the token is.`),
    },
    {
      id: "feedback",
      section: S,
      title: "Tell us what you think",
      html:
        p(`The Report button at the top of the screen sends a bug or an idea straight to us, with the day, your company, the tab you were on and your last few orders attached, so you only need to say what happened and what you expected.`) +
        ul([
          `<b>A bug:</b> what you did, what you saw, what you expected. If a truck is involved, its number.`,
          `<b>An idea:</b> what you'd want from a locked layer, what feels wrong in the market, what a dispatcher or a broker would do differently.`,
          `<b>Balance:</b> if rates, costs or waits feel off against the real thing, say so with numbers. The economy is tuned on what players do, not on what the simulator guessed.`,
        ]),
    },
  ];
}
