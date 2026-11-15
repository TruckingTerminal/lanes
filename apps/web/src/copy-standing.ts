/**
 * Standing with a market's shippers, the ten tiers (studio/reviews/director-standing-final.md and director-standing-10.md;
 * the economy's sizes, economy-standing.md). Engineering's placeholders for the writer, who words them in one pass; the
 * director's own lines are kept where the notes give them. Every figure comes from the engine (standing.ts standingCard)
 * or the page; these are the frames around them.
 */
export const STANDING = {
  // The card (the director's words): its head, the next step, the figures.
  title: (market: string) => `Standing with ${market} shippers`,
  band: { approved: "Approved", preferred: "Preferred", core: "Core" } as const,
  trend: { rising: "rising", steady: "steady", slipping: "slipping" } as const,
  head: (market: string, band: string, tier: number, trend: string) => `Standing with ${market} shippers · ${band}, tier ${tier} of 10 · ${trend}`,
  /** "Next: tier 6 at 7 loads in 180 days, 75% on time; you have 6. First call at tier 7." */
  next: (tier: number, loads: number, onTime: string | null, have: string, days: number) => `Next: tier ${tier} at ${loads} counted ${loads === 1 ? "load" : "loads"} in ${days} days${onTime ? ` and ${onTime} on time` : ""}; you have ${have}.`,
  nextPerk: (perk: string, tier: number) => `${perk} at tier ${tier}.`,
  top: "The top tier: Core. Keep its floors to hold it.",
  /** "86% on time over 180 days · 6 loads (2 on contract) · 0 claims" */
  detail: (onTime: string, days: number, loads: number, contract: number, claims: number) => `${onTime} on time over ${days} days · ${loads} ${loads === 1 ? "load" : "loads"}${contract ? ` (${contract} on contract)` : ""} · ${claims} ${claims === 1 ? "claim" : "claims"}`,
  /** The other marks against it, only when there are any. */
  marks: (noShows: number, releases: number, late: number, declined: number) =>
    [noShows ? `${noShows} ${noShows === 1 ? "no-show" : "no-shows"}` : "", releases ? `${releases} released` : "", late ? `${late} late` : "", declined ? `${declined} first ${declined === 1 ? "call" : "calls"} passed` : ""].filter(Boolean).join(" · "),
  noOnTime: "–",
  // What each milestone opens, by name.
  perk: { dock: "Dock priority", net: "Net-15", firstCall: "First call", contracts: "Contract offers", dedicated: "A dedicated lane" } as const,
  /** Where a perk applies, the tier that holds it. */
  perkHere: (perk: string, tier: number, market: string) => `${perk} · tier ${tier} with ${market} shippers`,
  dockHere: (market: string, tier: number) => `Dock priority at ${market} docks · tier ${tier}: your trucks load and unload ahead of the queue.`,
  netHere: (market: string, tier: number, days: number) => `Net-${days} · tier ${tier} with ${market} shippers: their invoices pay in ${days} days.`,
  // The company card's list of markets.
  companyTitle: "Standing with shippers",
  companyNone: "No standing yet. Deliver a market's own loads on time (direct or on contract, not a broker's), and its shippers start a scorecard on you.",
  companyMore: (n: number) => `${n} more ${n === 1 ? "market" : "markets"}`,
  // The load sheet: the scorecard the load builds, or why it builds none.
  sheetBuilds: (market: string) => `This load counts toward your standing with ${market} shippers.`,
  sheetNone: "A broker's load: it builds no standing with the shipper.",
  // First call (tier 7): the board's chip, the sheet's line, the feed, and turning it down.
  firstCallChip: (until: string) => `First call · until ${until}`,
  firstCallLine: (market: string, until: string) => `${market} shippers call you first on this load. Book it or bid it before the ${until} round, or it goes to the board. Passing, or letting it lapse, counts against you.`,
  firstCallFeed: (market: string, from: string, to: string, until: string) => `First call: ${market} shippers offer you ${from} → ${to} before the board, until ${until}.`,
  firstCallDecline: "Pass",
  firstCallDeclined: (market: string) => `You passed on a first call. It counts against your standing with ${market} shippers.`,
  firstCallLapsed: (market: string, from: string, to: string) => `The first call on ${from} → ${to} lapsed and went to the board. It counts against your standing with ${market} shippers.`,
  // Contract offers (tier 9) and the dedicated lane (tier 10), on the offer's card.
  offeredFirst: (market: string, tier: number) => `Offered first · tier ${tier} with ${market} shippers`,
  dedicatedOffer: (market: string) => `A dedicated lane · Core with ${market} shippers`,
  // A tier's change, for the feed and the month report, with its cause.
  cause: {
    rise: "loads delivered on time",
    decay: "eight weeks without a load from the market",
    aged: "older loads falling out of the last 180 days",
    onTime: "on time falling below the tier's floor",
    claim: "a claim",
    noShow: "a no-show",
    release: "a release",
    late: "a late delivery",
    declined: "a first call passed",
  } as const,
  feedUp: (market: string, tier: number) => `Your standing with ${market} shippers rose to tier ${tier}.`,
  feedDown: (market: string, tier: number, cause: string) => `Your standing with ${market} shippers fell to tier ${tier} after ${cause}.`,
  reportTitle: "Standing with shippers",
  reportMove: (market: string, from: number, to: number, cause: string) => `${market} shippers: tier ${from} → ${to} (${cause})`,
  reportNone: "No tier changed this month.",
  // Iuliia (the director's lines; the writer polishes).
  iuliiaMilestone: (market: string, tier: number): string | null =>
    tier === 3
      ? `${market} docks take you ahead of the queue now. Less waiting at their doors, more time driving.`
      : tier === 5
        ? `${market} shippers pay you in 15 days now, not 30. Your money, two weeks sooner.`
        : tier === 7
          ? `${market} shippers call you first now, before the board and before the locals. Pass on one, or let it lapse, and it counts against you.`
          : tier === 9
            ? `${market} shippers plan around you now. Their contract offers come to you first, in Money.`
            : tier === 10
              ? `You're a core carrier in ${market} now. A lane of your own is on offer: steady freight at a fixed rate.`
              : null,
  iuliiaFell: (market: string, tier: number, cause: string, perk: string, perkTier: number) => `Your ${market} standing fell to tier ${tier} after ${cause}. ${perk} is gone until you're back at ${perkTier}.`,
  iuliiaDecayAhead: (market: string) => `No ${market} load in seven weeks. Another week without one and your standing there drops a tier.`,
  iuliiaNoticed: (market: string) => `${market} shippers noticed. Keep delivering on time and they'll start calling you first.`,
  // The hero at a milestone (the kit's hero component).
  heroTitle: (market: string, tier: number, band: string) =>
    tier === 3 ? `${market} docks wave you ahead` : tier === 5 ? `Preferred with ${market} shippers` : tier === 7 ? `${market} calls you first` : tier === 9 ? `Core with ${market} shippers` : tier === 10 ? `A lane of your own out of ${market}` : `${band}: tier ${tier} with ${market} shippers`,
  // The writer's keys for engineering to wire (UX §1.6: the perk in one line, with its figure from the player's own books;
  // the stamp for a later market or a climb back). A figure the engine doesn't count is passed as null and its clause drops.
  heroPerk: (market: string, tier: number, fig: { dockHours?: number | null; netDays?: number; termsDays?: number; soonerFd?: string | null; loads?: number | null; onTime?: string | null; lane?: string | null }): string | null =>
    tier === 3
      ? `Your trucks go to the front of the line at ${market} docks.${fig.dockHours ? ` Last month ${market} docks kept you ${fig.dockHours} h.` : ""}`
      : tier === 5
        ? `Your ${market} invoices now pay in ${fig.netDays ?? 15} days, not ${fig.termsDays ?? 30}.${fig.soonerFd ? ` On last month's loads that's ${fig.soonerFd} FD two weeks sooner.` : ""}`
        : tier === 7
          ? `${market} shippers will call you first, a round before the board.${fig.loads ? ` You hauled ${fig.loads} of their loads to get here.` : ""}`
          : tier === 9
            ? `${market} shippers will offer you their contracts first.${fig.loads && fig.onTime ? ` ${fig.loads} loads, ${fig.onTime} on time, brought you here.` : ""}`
            : tier === 10
              ? `A lane of your own out of ${market}${fig.lane ? `: ${fig.lane}` : ""}.`
              : null,
  stamp: (market: string, band: string, tier: number, back: boolean) => (back ? `Back to ${band}, tier ${tier} of 10, in ${market}.` : `${market} standing: ${band}, tier ${tier} of 10.`),
};

/**
 * UX's standing screens (ux-next-screens-2026-11-15.md part 1, §1.8's strings): engineering's placeholders in UX's words
 * for the writer's pass.
 */
export const STANDING_UX = {
  // §1.3 More → Standing.
  tab: "Standing",
  header: (n: number) => `Your standing with shippers in ${n} ${n === 1 ? "market" : "markets"}.`,
  allMarkets: "All markets",
  // §1.1 the card.
  line2: (tier: number, trend: string) => `tier ${tier} of 10 · ${trend}`,
  next: (tier: number, loads: number, onTime: string | null) => `Next: tier ${tier} at ${loads} counted ${loads === 1 ? "load" : "loads"}${onTime ? ` and ${onTime} on time` : ""}.`,
  have: (loads: string, onTime: string | null) => `You have ${loads} counted ${loads === "1" ? "load" : "loads"}${onTime ? `, ${onTime} on time` : ""}.`,
  topTier: (loads: number, onTime: string) => `The top tier. To hold it: ${loads} counted loads and ${onTime} on time.`,
  unlocks: (perk: string, tier: number) => `${perk} at tier ${tier}.`,
  decayChip: (market: string, weeks: number, day: string) => `No ${market} load in ${weeks} weeks · a tier off ${day}`,
  // §1.2 the ladder.
  ladderBand: { core: "CORE", preferred: "PREFERRED", approved: "APPROVED" } as const,
  ladderFloors: (loads: number, onTime: string | null) => (loads === 0 ? "—" : `${loads} ${loads === 1 ? "load" : "loads"}${onTime ? ` · ${onTime}` : ""}`),
  ladderNext: "next",
  ladderYou: "you",
  ladderFoot: (day: string, hour: string, late: number, hit: number, weeks: number) =>
    `How it moves: reviewed every ${day} at ${hour}, one tier at most. A load counts in full from 500 miles and by its miles below that; a contract load counts double. A late delivery takes off ${late === 1 ? "one load" : `${late} loads`}; a claim, a no-show or a release ${hit === 2 ? "two" : hit}. ${weeks === 8 ? "Eight" : weeks} weeks without a load from the market costs a tier.`,
  ladderClose: "Close",
  // §1.4 the load sheet.
  countsToward: (market: string, band: string, tier: number) => `Counts toward your ${market} standing: ${band}, tier ${tier} of 10.`,
  countsNew: (market: string) => `Counts toward your standing with ${market} shippers.`,
  brokered: "Brokered: it builds no standing with a shipper.",
  claimCost: (n: number, market: string) => `, and ${n === 1 ? "one load" : n === 2 ? "two loads" : `${n} loads`} off your ${market} standing`,
  dockChip: "Dock priority",
  netChip: (days: number) => `Paid in ${days} days (net-${days})`,
  won: (market: string, have: string, need: number, tier: number) => `Delivered on time, it counts toward your ${market} standing: ${have} of the ${need} counted loads tier ${tier} needs.`,
  // §1.5 first call.
  callHead: (market: string, until: string) => `FIRST CALL · ${market} shippers · answer by ${until}`,
  callLane: (from: string, to: string, miles: string, fd: string, pickupBy: string | null) => `${from} → ${to} · ${miles} mi · ${fd} FD${pickupBy ? ` · pick up by ${pickupBy}` : ""}`,
  callOpen: "Open",
  callPass: "Pass",
  callFoot: (until: string) => `No answer by ${until} counts as a pass.`,
  passConfirm: (market: string, cost: number) => `Pass on this first call? It takes ${cost === 1 ? "one load" : `${cost} loads`} off your ${market} standing, and the load goes to the board.`,
  passKeep: "Keep it",
  passItem: "this first call",
  passCost: (market: string, cost: number) => `${cost === 1 ? "one load" : `${cost} loads`} off your ${market} standing`,
  needCall: (market: string, until: string) => `First call from ${market} shippers · answer by ${until}`,
  needDecay: (market: string, day: string) => `No ${market} load in seven weeks: your standing there drops a tier ${day} unless you haul one.`,
  callToast: (market: string) => `First call from ${market} shippers`,
  // §1.6 the moments.
  heroPaper: (market: string, band: string, tier: number) => `Standing with ${market} shippers · ${band} · tier ${tier} of 10`,
  heroLadder: "See the ladder",
  stepUp: (market: string, tier: number) => `${market} standing: tier ${tier} of 10.`,
  stepDown: (market: string, tier: number, cause: string) => `${market} standing: tier ${tier} of 10, after ${cause}.`,
  moved: (n: number) => `Standing moved in ${n} markets`,
  // §1.3 the city pane, the month report, the return card.
  cityLine: (band: string, tier: number) => `Your standing here: ${band}, tier ${tier} of 10.`,
  reportMove: (market: string, from: number, to: number, cause: string, day: string) => `${market}: ${from} → ${to}${to > from ? "" : ` after ${cause}`}, ${day}`,
  returnLine: (market: string, from: number, to: number) => `${market} standing: tier ${from} → ${to}.`,
};

/** The card's explain sheet (ui/Explain.tsx): what the figure is, how it's built, what moves it. */
export const STANDING_EXPLAIN: Record<string, { what: string; how: string; moves: string }> = {
  "shipper.standing": {
    what: "How a market's shippers rate you: one scorecard from their own direct and contract loads (a broker's loads don't count), over the last 180 days.",
    how: "Loads delivered, each counted in full from 500 miles and by its miles below that (a 250-mile run counts half), a contract load double, less fixed hits: a claim, a no-show or a release two loads, a late delivery one, and from tier 7 a first call turned down one. Each tier needs its loads and its on-time share.",
    moves: "Reviewed once a week, one tier at most. Eight weeks without a load from the market costs a tier, and loads older than 180 days fall away.",
  },
};
