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
        p(`LANES opens in layers. The beta runs the hauling game end to end from day one; the deeper layers open on published days, and the locked tabs say what each will be.`) +
        ul([
          `<b>From day one:</b> the freight market, your trucks and trailers, the used lot and loans, docks, weather and terrain, parking, drivers, dispatchers and managers, the yard, inspections and insurance, Miles.`,
          `<b>Businesses and facilities</b> open on day ${L.businesses.afterDays} of the beta (${weeks(L.businesses.afterDays)}): shops, fuel stations, truck stops on the interstates, dealerships, warehouses that ship their own freight.`,
          `<b>Re-brokering</b> opens on day ${L.brokerage.afterDays} (${weeks(L.brokerage.afterDays)}): a licence, a bond, and the right to post loads for other carriers.`,
          `<b>The Back Lot</b> comes with a later beta. We'll say what it is when it's ready.`,
          `<b>At the token's launch,</b> Miles become the airdrop, paid into the game and unlocked by the Logbook's milestones; FD leaves the game only through the bridge, with its timer and its tax.`,
          `<b>Later:</b> the authoritative server and accounts by email, the Monthly Economic Report, new territory when the hubs are crowded.`,
        ]) +
        p(`Nothing here is a promise of money. Miles are your standing in the beta; what they become is announced when the token is.`),
    },
    {
      id: "feedback",
      section: S,
      title: "Tell us what you think",
      html:
        p(`"Report a bug or an idea", under ≡ at the top of the screen, sends it straight to us, with the day, your company, the tab you were on and your last few orders attached, so you only need to say what happened and what you expected.`) +
        ul([
          `<b>A bug:</b> what you did, what you saw, what you expected. If a truck is involved, its number.`,
          `<b>An idea:</b> what you'd want from a locked layer, what feels wrong in the market, what a dispatcher or a broker would do differently.`,
          `<b>Balance:</b> if rates, costs or waits feel off against the real thing, say so with numbers. The economy is tuned on what players do, not on what the simulator guessed.`,
        ]),
    },
  ];
}
