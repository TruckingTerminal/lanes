/**
 * The diaries batch's strings (engineering's placeholders of 2026-11-09, worded by the writer the same day). Keys are
 * engineering's; each comment names where the string shows. They fold into copy.ts the next time engineering touches
 * these call sites; until then this file is copy like copy.ts, the writer's to word.
 */
export const PENDING = {
  // tabs.ts: the Dealer's and Finance's teaser card, after "Opens " (the director, 2026-11-09: they open the moment the
  // first truck is affordable, whatever the walkthrough's step; firstTruckOpen also opens them at Iuliia's first-truck
  // step and with the businesses layer).
  dealerOpens: "the moment you can afford your first truck, or when Iuliia brings it up",
  financeOpens: "with the Dealer",
  // ui/More.tsx TeaserCard (the Dealer, before it opens): the price of the goal, never a dead tap. figures.ts gapToTruck:
  // the cheapest route's cash at signing on a purchase loan, and the gap after a cushion of the company's own spending.
  dealerPrice: (needFd: string, gapFd: string) => `Your first truck takes about ${needFd} FD in cash today, with a loan for the rest. You're ${gapFd} FD short, keeping a few weeks' running money back.`,
  dealerPriceNone: "No truck is for sale anywhere right now.",

  // What now? and the ways-out sheet (the director, 2026-11-09: "stranded" is its own state; the cheapest exit first).
  strandedAction: (truck: number, place: string) => `Truck ${truck} is stranded at ${place}: nothing it may take from here pays.`,
  // `exit` is exitHome or exitTo. exitTo already counts its loads; exits.ts lists a hub only when a load pays there, so
  // a 0 is always home, said plainly rather than left out.
  strandedReason: (exit: string, pays: number) => `Cheapest way out: ${exit}${pays === 0 ? ". Nothing pays from home yet either" : ""}.`,
  strandedNext: (exit: string) => `Next cheapest: ${exit}.`,
  // No exit at all: home is where the truck stands, and no hub within an empty run's reach has a load that pays it.
  strandedNone: "No hub within an empty run has a load that pays this truck right now. Look again after the next round.",
  waysOutTitle: "Ways out",
  waysOutBoard: "The board from here",
  exitHome: (mi: string, fd: string, time: string) => `Home · ${mi} mi empty · about ${fd} FD · ${time}`,
  exitTo: (hub: string, mi: string, fd: string, time: string, pays: number) => `${hub} · ${mi} mi empty · about ${fd} FD · ${time} · ${pays} ${pays === 1 ? "load pays" : "loads pay"} there`,
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
} as const;
