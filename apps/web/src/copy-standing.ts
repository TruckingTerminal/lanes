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
  next: (tier: number, loads: number, onTime: string | null, have: string, days: number) => `Next: tier ${tier} at ${loads} loads in ${days} days${onTime ? `, ${onTime} on time` : ""}; you have ${have}.`,
  nextPerk: (perk: string, tier: number) => `${perk} at tier ${tier}.`,
  top: "The top tier: core carrier.",
  /** "86% on time over 180 days · 6 loads (2 on contract) · 0 claims" */
  detail: (onTime: string, days: number, loads: number, contract: number, claims: number) => `${onTime} on time over ${days} days · ${loads} ${loads === 1 ? "load" : "loads"} (${contract} on contract) · ${claims} ${claims === 1 ? "claim" : "claims"}`,
  /** The other marks against it, only when there are any. */
  marks: (noShows: number, releases: number, late: number, declined: number) =>
    [noShows ? `${noShows} ${noShows === 1 ? "no-show" : "no-shows"}` : "", releases ? `${releases} released` : "", late ? `${late} late` : "", declined ? `${declined} first ${declined === 1 ? "call" : "calls"} turned down` : ""].filter(Boolean).join(" · "),
  noOnTime: "–",
  // What each milestone opens, by name.
  perk: { dock: "Dock priority", net: "Net-15", firstCall: "First call", contracts: "Contract offers", dedicated: "A dedicated lane" } as const,
  /** Where a perk applies, the tier that holds it. */
  perkHere: (perk: string, tier: number, market: string) => `${perk} · tier ${tier} with ${market} shippers`,
  dockHere: (market: string, tier: number) => `Dock priority at ${market} docks · tier ${tier}: you load and unload ahead of the queue.`,
  netHere: (market: string, tier: number, days: number) => `Net-${days} · tier ${tier} with ${market} shippers: paid in ${days} days, not 30.`,
  // The company card's list of markets.
  companyTitle: "Standing with shippers",
  companyNone: "No standing yet. Deliver a market's own loads (not a broker's) on time, and its shippers keep a scorecard on you.",
  companyMore: (n: number) => `${n} more ${n === 1 ? "market" : "markets"}`,
  // The load sheet: the scorecard the load builds, or why it builds none.
  sheetBuilds: (market: string) => `This load counts toward your standing with ${market} shippers.`,
  sheetNone: "A broker's load: it builds no standing with the shipper.",
  // First call (tier 7): the board's chip, the sheet's line, the feed, and turning it down.
  firstCallChip: (until: string) => `First call · until ${until}`,
  firstCallLine: (market: string, until: string) => `${market} shippers call you first on this load. Book it or bid it before the ${until} round, or it goes to the board. Turning it down counts against you.`,
  firstCallFeed: (market: string, from: string, to: string, until: string) => `First call: ${market} shippers offer you ${from} → ${to} before the board, until ${until}.`,
  firstCallDecline: "Turn it down",
  firstCallDeclined: (market: string) => `You turned down a first call. It counts against your standing with ${market} shippers.`,
  firstCallLapsed: (market: string, from: string, to: string) => `The first call on ${from} → ${to} lapsed and went to the board. It counts against your standing with ${market} shippers.`,
  // Contract offers (tier 9) and the dedicated lane (tier 10), on the offer's card.
  offeredFirst: (market: string, tier: number) => `Offered first · tier ${tier} with ${market} shippers`,
  dedicatedOffer: (market: string) => `A dedicated lane · core carrier with ${market} shippers`,
  // A tier's change, for the feed and the month report, with its cause.
  cause: {
    rise: "on its record",
    decay: "eight weeks without a load",
    aged: "fewer loads in the last 180 days",
    onTime: "on-time below the tier's floor",
    claim: "a claim",
    noShow: "a no-show",
    release: "a release",
    late: "a late delivery",
    declined: "a first call turned down",
  } as const,
  feedUp: (market: string, tier: number) => `Your standing with ${market} shippers rose to tier ${tier}.`,
  feedDown: (market: string, tier: number, cause: string) => `Your standing with ${market} shippers fell to tier ${tier} after ${cause}.`,
  reportTitle: "Standing with shippers",
  reportMove: (market: string, from: number, to: number, cause: string) => `${market} shippers: tier ${from} → ${to} (${cause})`,
  reportNone: "No tier changed this month.",
  // Iuliia (the director's lines; the writer polishes).
  iuliiaMilestone: (market: string, tier: number): string | null =>
    tier === 3
      ? `${market} docks take you ahead of the queue now. Less waiting at their doors.`
      : tier === 5
        ? `${market} shippers pay you in 15 days now, not 30.`
        : tier === 7
          ? `${market} shippers call you first now, before the board and before the locals. Turning one down counts against you.`
          : tier === 9
            ? `${market} shippers want you on contract. The offer is in Money.`
            : tier === 10
              ? `You're a core carrier in ${market}. A dedicated lane is on offer.`
              : null,
  iuliiaFell: (market: string, tier: number, cause: string, perk: string, perkTier: number) => `Your ${market} standing fell to tier ${tier} after ${cause}. ${perk} is gone until you're back at ${perkTier}.`,
  iuliiaDecayAhead: (market: string) => `No ${market} load in seven weeks. One more and your standing there drops a tier.`,
  iuliiaNoticed: (market: string) => `${market} shippers noticed. Keep delivering on time and they'll call you first.`,
  // The hero at a milestone (the kit's hero component).
  heroTitle: (market: string, tier: number, band: string) => `${band}: tier ${tier} with ${market} shippers`,
};

/**
 * UX's standing screens (ux-next-screens-2026-11-15.md part 1, §1.8's strings): engineering's placeholders in UX's words
 * for the writer's pass.
 */
export const STANDING_UX = {
  // §1.3 More → Standing.
  tab: "Standing",
  header: (n: number) => `Standing with shippers in ${n} ${n === 1 ? "market" : "markets"}.`,
  allMarkets: "All markets",
  // §1.1 the card.
  line2: (tier: number, trend: string) => `tier ${tier} of 10 · ${trend}`,
  next: (tier: number, loads: number, onTime: string | null) => `Next: tier ${tier} at ${loads} ${loads === 1 ? "load" : "loads"}${onTime ? `, ${onTime} on time` : ""}.`,
  have: (loads: string, onTime: string | null) => `You have ${loads} ${loads === "1" ? "load" : "loads"}${onTime ? `, ${onTime}` : ""}.`,
  topTier: (loads: number, onTime: string) => `Top tier. Keep the floors: ${loads} loads, ${onTime} on time.`,
  unlocks: (perk: string, tier: number) => `${perk} at tier ${tier}.`,
  decayChip: (market: string, weeks: number, day: string) => `No ${market} load in ${weeks} weeks · drops a tier ${day}`,
  // §1.2 the ladder.
  ladderBand: { core: "CORE", preferred: "PREFERRED", approved: "APPROVED" } as const,
  ladderFloors: (loads: number, onTime: string | null) => (loads === 0 ? "—" : `${loads} ${loads === 1 ? "load" : "loads"}${onTime ? ` · ${onTime}` : ""}`),
  ladderNext: "next",
  ladderYou: "you",
  ladderFoot: (day: string, hour: string, late: number, hit: number, weeks: number) =>
    `How it moves: reviewed every ${day} ${hour}, one tier at most. A late delivery costs ${late === 1 ? "one load" : `${late} loads`}, a claim, no-show or release ${hit === 2 ? "two" : hit}. ${weeks === 8 ? "Eight" : weeks} weeks without a load costs a tier.`,
  ladderClose: "Close",
  // §1.4 the load sheet.
  countsToward: (market: string, band: string, tier: number) => `Counts toward your ${market} standing: ${band}, tier ${tier} of 10.`,
  countsNew: (market: string) => `Counts toward your standing with ${market} shippers.`,
  brokered: "Brokered: it builds no standing with a shipper.",
  claimCost: (n: number, market: string) => `, and ${n === 1 ? "one load" : n === 2 ? "two loads" : `${n} loads`} off your ${market} standing`,
  dockChip: "Dock priority",
  netChip: (days: number) => `Paid in ${days} days (net-${days})`,
  won: (market: string, have: string, need: number, tier: number) => `Delivered on time, it counts toward ${market}: ${have} of ${need} loads for tier ${tier}.`,
  // §1.5 first call.
  callHead: (market: string, until: string) => `FIRST CALL · ${market} shippers · answer by ${until}`,
  callLane: (from: string, to: string, miles: string, fd: string, pickupBy: string | null) => `${from} → ${to} · ${miles} mi · ${fd} FD${pickupBy ? ` · pick up by ${pickupBy}` : ""}`,
  callOpen: "Open",
  callPass: "Pass",
  callFoot: (until: string) => `No answer by ${until} counts as a pass.`,
  passConfirm: (market: string, cost: number) => `Passing counts against your ${market} standing (${cost === 1 ? "one load" : `${cost} loads`}). Pass on this load?`,
  passKeep: "Keep it",
  passItem: "this first call",
  passCost: (market: string, cost: number) => `${cost === 1 ? "one load" : `${cost} loads`} off your ${market} standing`,
  needCall: (market: string, until: string) => `First call from ${market} shippers · answer by ${until}`,
  needDecay: (market: string, day: string) => `No ${market} load in seven weeks: your standing there drops a tier ${day}.`,
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
    how: "Loads delivered, a contract load counting double and a run under 250 miles half, less fixed hits: a claim, a no-show or a release two loads, a late delivery one, and from tier 7 a first call turned down one. Each tier needs its loads and its on-time share.",
    moves: "Reviewed once a week, one tier at most. Eight weeks without a load from the market costs a tier, and loads older than 180 days fall away.",
  },
};
