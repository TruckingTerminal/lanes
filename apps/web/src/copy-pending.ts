/**
 * The diaries batch's strings (engineering's placeholders of 2026-11-09, worded by the writer the same day). Keys are
 * engineering's; each comment names where the string shows. They fold into copy.ts the next time engineering touches
 * these call sites; until then this file is copy like copy.ts, the writer's to word.
 */
const paysThere = (n: number): string => (n === 0 ? "nothing pays there yet" : `${n} ${n === 1 ? "load pays" : "loads pay"} there`);

export const PENDING = {
  // tabs.ts: the Dealer's and Finance's teaser card, after "Opens " (the director, 2026-11-09: they open the moment the
  // first truck is affordable, whatever the walkthrough's step; firstTruckOpen also opens them at Iuliia's first-truck
  // step and with the businesses layer).
  dealerOpens: "the moment you can afford your first truck, or when Iuliia brings it up",
  financeOpens: "with the Dealer",
  // ui/More.tsx TeaserCard (the Dealer, before it opens): the price of the goal, never a dead tap. figures.ts gapToTruck:
  // the cheapest route's cash on the day on a purchase loan (down payment, stake, tax, less the lease deposit). The
  // teaser then shows firstTruckToGo under it. (Client pass 2: the cushion left the figure; it is firstTruckCushion now.)
  dealerPrice: (needFd: string) => `Your first truck takes about ${needFd} FD in cash on the day, with the Dealer's loan for the rest.`,
  dealerPriceNone: "No truck is for sale anywhere right now.",
  // The one first-truck figure (the director, 2026-11-09; figures.ts firstTruckLine): on the Dealer's teaser, Iuliia's
  // page ("Next on the road") and the Dealer's own card. The cheapest truck's cash on the day, less the player's cash.
  firstTruckToGo: (fd: string) => `To your first truck: ${fd} FD`,
  // Once met; the Dealer opens on the same figure.
  firstTruckMet: "You can buy today",
  // Iuliia's advice under it, never part of it: guide.gapCushionWeeks of the company's own spending, rounded. Shown once a
  // week of spending is known.
  firstTruckCushion: (fd: string) => `I'd keep about ${fd} FD back for fuel and repairs before you sign.`,

  // What now? and the ways-out sheet (the director, 2026-11-09: "stranded" is its own state; the cheapest exit first).
  strandedAction: (truck: number, place: string) => `Truck ${truck} is stranded at ${place}: nothing it may take from here pays.`,
  // `exit` is exitHome or exitTo. exitTo already counts its loads; exits.ts lists a hub only when a load pays there, so
  // a 0 is always home, said plainly rather than left out.
  strandedReason: (exit: string) => `Cheapest way out: ${exit}.`,
  strandedNext: (exit: string) => `Next cheapest: ${exit}.`,
  // No exit at all: home is where the truck stands, and no hub within an empty run's reach has a load that pays it.
  strandedNone: "No hub within an empty run has a load that pays this truck right now. Look again after the next round.",
  waysOutTitle: "Ways out",
  waysOutBoard: "The board from here",
  // Client pass 2 (the writer's note 1): home says its loads too, and a 0 reads "nothing pays there yet". Send empty's
  // list (Fleet.tsx) uses exitTo for every hub, so its count is the ways-out sheet's (exits.ts paysFrom).
  exitHome: (mi: string, fd: string, time: string, pays: number) => `Home · ${mi} mi empty · about ${fd} FD · ${time} · ${paysThere(pays)}`,
  exitTo: (hub: string, mi: string, fd: string, time: string, pays: number) => `${hub} · ${mi} mi empty · about ${fd} FD · ${time} · ${paysThere(pays)}`,
  // logic.tsx idleWhy, a truck the board strands: loads in range, none this truck may take now (the board's block:
  // locals first, a tender, vetting, the authority's age). Break-even is the next branch's line, not this one.
  idleStranded: (trailer: string) => `There are ${trailer} loads in range, but none this truck may take now: they're held for local carriers or closed to you.`,

  // Send home (the director, 2026-11-09). An owner-operator's two buttons:
  sendHomeWork: "Send home · back to work",
  homeTimeDays: (days: number) => `Home time · ${days} ${days === 1 ? "day" : "days"} off`,
  sendHomeWorkToast: "Heading home empty, to work from there",
  sendHomeWorkDoes: "Runs the truck empty to your home hub. No days off: it takes loads from there.",
  homeTimeDoes: (days: number) => `Runs the truck empty to your home hub, then ${days} ${days === 1 ? "day" : "days"} off.`,
  // On the road, queued after the delivery (labor.sendHomeWhileMoving): home time, with its days (Fleet.tsx sets the
  // button as "{sendHomeAfter} · {homeTimeDays}"), until the engine can queue "back to work". "Run", not "delivery":
  // Fleet.tsx shows it on any moving truck, a loaded one or one running empty.
  sendHomeAfter: "Send home after this run",
  sendHomeAfterQueued: "Going home for days off when this run ends.",
  sendHomeAfterToast: "Home for days off when this run ends",

  // The net-30 warning (Needs you and Money): figures.ts cashDipAhead, cash today less the daily spend plus each invoice
  // on its due day; the first day under zero, the lowest point, and the next invoice due after that day.
  net30Warn: (date: string, lowFd: string, landsDate: string) => `At this rate your cash goes below zero around ${date}, as low as −${lowFd} FD, before your next invoice lands on ${landsDate}.`,
  net30WarnButton: "See the invoices",
  net30Explain: "An owned truck bills on net 30: a load's pay lands 30 days after delivery, while fuel, pay and insurance go out as you run.",

  // The ticket at the shoulder, said ahead (Rolling.tsx, a hand-booked load): parking.shoulderFineFd at patrolOdds.
  shoulderAhead: (fd: string) => `No legal stop is in reach tonight, so it sleeps on the shoulder: a ${fd} FD ticket if a patrol comes by.`,
  // The load page's dock lines when the dock is shut (the diaries: "Pick up · now" against a dock opening in 53 h).
  pickupWhenOpens: (when: string) => `${when}, when the dock opens`,
  deliverByOpens: (when: string) => `${when}, when the receiver opens`,

  // The load page, under Bid: the engine's bid reach is market to market (actions.ts place_bid, hubMiles); Book now's is
  // the truck's own town to the pickup, so a load can be out of a bid's reach and still in Book now's.
  bidReach: (mi: number) => `A bid by hand reaches loads within ${mi} miles, market to market, and this one is farther. Book now can still take it.`,

  // --- Client pass 2 (engineering's placeholders, 2026-11-09, for the writer) ---
  // What now?'s gap reason (ui/WhatNow.tsx, rule 5): the one first-truck figure, which no longer holds back weeks of
  // costs (NOW.gapReason in copy.ts said so; it no longer reads).
  // What now?'s rule 3 for an owner-operator on a lease (ui/WhatNow.tsx idleReason): NOW.idleReasonHeld(Plus) with the
  // owner's draw, which the cash includes (board.ts chipPair: cash = profit − held + draw). `out` when cash is negative.
  idleReasonHeldDraw: (profit: string, cash: string, out: boolean, draw: string, held: string) => `${profit} over break-even: ${cash} ${out ? "out of" : "to"} cash now, with your ${draw} FD draw as the driver; ${held} toward your truck.`,
  // Home time, said where it was hard-coded (Fleet.tsx's crew-going-home line and the tired card, the home-time toast
  // there and in logic.tsx sendHomePriced): only after "Home time" was chosen, so "for days off" is true.
  homeTimeHeading: "Heading home for days off.",
  homeTimeToast: "Heading home for days off",
  // logic.tsx idleWhy's last two lines, moved here from the code (QA: "1 dry van load in range pay enough"). `n` loads of
  // the trailer within the dispatcher's reach; `pct` the floor over break-even.
  idleUnderFloor: (n: number, trailer: string, pct: number) => `${n} ${trailer} ${n === 1 ? "load" : "loads"} in range, but none pays your floor (break-even + ${pct}%) even at its ceiling.`,
  idleBidsLosing: (n: number, trailer: string) => `${n} ${trailer} ${n === 1 ? "load" : "loads"} in range ${n === 1 ? "pays" : "pay"} enough, but the dispatcher's bids keep losing: other carriers bid lower or have the better record.`,
  gapReason: (gap: string) => `You're ${gap} FD short of the cheapest truck's cash on the day, counting what's held toward it.`,
} as const;

/** Explanations that replace copy.ts EXPLAIN's (ui/Explain.tsx reads these first); fold in with the rest. */
export const PENDING_EXPLAIN: Record<string, { what: string; how: string; moves: string }> = {
  // The gap left its cushion (client pass 2): the rows are the cheapest truck's cash on the day, the hold, your cash.
  "guide.gapToTruck": { what: "How far you are from your next truck.", how: "The cheapest truck's cash needed on the day (down payment, loan stake and tax), less what's held toward your truck and your cash.", moves: "Hauling; the cheapest truck on offer, which changes; what you spend." },
};
