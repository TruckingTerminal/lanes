/**
 * PLACEHOLDERS for the writer (engineering's diaries batch, 2026-11-09): the strings this batch needed, worded by
 * engineering to say what the screen must say. The writer words each and moves it into copy.ts (then this file goes).
 * Each key's comment names where it shows.
 */
export const PENDING = {
  // tabs.ts: the Dealer's and Finance's teaser card, "Opens …" (the director, 2026-11-09: they open the moment the first
  // truck is affordable, whatever the walkthrough's step).
  dealerOpens: "when you can afford your first truck, or when Iuliia says so",
  financeOpens: "with the Dealer, when you can afford your first truck",
  // ui/More.tsx TeaserCard (the Dealer, before it opens): the price of the goal, never a dead tap.
  dealerPrice: (needFd: string, gapFd: string) => `Your first truck takes about ${needFd} FD now on the Dealer's loan. You're ${gapFd} FD away.`,
  dealerPriceNone: "No truck is for sale anywhere right now.",

  // What now? and the ways-out sheet (the director, 2026-11-09: "stranded" is its own state; the cheapest exit first).
  strandedAction: (truck: number, place: string) => `Truck ${truck} is stranded at ${place}: nothing it may take in reach pays.`,
  strandedReason: (exit: string, pays: number) => `The cheapest way out: ${exit}${pays > 0 ? `, where ${pays} ${pays === 1 ? "load pays" : "loads pay"} from` : ""}.`,
  strandedNext: (exit: string) => `Next: ${exit}.`,
  strandedNone: "No way out pays more than it costs this round. New loads post at the next round.",
  waysOutTitle: "Ways out",
  waysOutBoard: "The board from here",
  exitHome: (mi: string, fd: string, time: string) => `Home · ${mi} mi · about ${fd} FD · ${time}`,
  exitTo: (hub: string, mi: string, fd: string, time: string, pays: number) => `${hub} · ${mi} mi · about ${fd} FD · ${time} · ${pays} ${pays === 1 ? "load pays" : "loads pay"} there`,
  // logic.tsx idleWhy, a truck the board strands (replaces "N loads in range pay enough" when none the truck may take do).
  idleStranded: (trailer: string) => `Nothing in reach that this truck may take pays: the ${trailer} loads here are held for locals, closed to you, or under your break-even.`,

  // Send home (the director, 2026-11-09). An owner-operator's two buttons:
  sendHomeWork: "Send home · back to work",
  homeTimeDays: (days: number) => `Home time · ${days} days off`,
  sendHomeWorkToast: "Heading home, back to work when it's there",
  sendHomeWorkDoes: "Runs empty to your home hub. No days off: it takes loads from home.",
  homeTimeDoes: (days: number) => `Runs empty to your home hub, then ${days} days off.`,
  // On the road, queued after the delivery (labor.sendHomeWhileMoving): home time, with its days, until the engine can
  // queue "back to work" and turn a truck that's running empty now (the batch's report).
  sendHomeAfter: "Send home after this delivery",
  sendHomeAfterQueued: "Going home after this delivery",
  sendHomeAfterToast: "It goes home after this delivery",

  // The net-30 warning (Needs you and Money): cash below zero before the invoices due land.
  net30Warn: (date: string, lowFd: string, landsDate: string) => `Cash runs below zero around ${date} (about −${lowFd} FD) before your invoices land on ${landsDate}.`,
  net30WarnButton: "See the invoices",
  net30Explain: "Your owned trucks bill on net 30: the pay lands 30 days after delivery, while fuel, wages and insurance go out every week.",

  // The ticket at the shoulder: the plan says so ahead, with the choice (Truck card).
  shoulderAhead: (fd: string) => `No legal stop in reach tonight: the shoulder risks a ${fd} FD ticket.`,
  // The load page's dock lines when the dock is shut (the diaries: "Pick up · now" against a dock opening in 53 h).
  pickupWhenOpens: (when: string) => `when the dock opens, ${when}`,
  deliverByOpens: (when: string) => `${when}, when the receiver opens`,

  // The load page, under Bid, when the engine's bid reach (market to market) rules a bid out that Book now allows.
  bidReach: (mi: number) => `A bid by hand reaches pickups within ${mi} miles market to market, and this one is past it: Book now takes it.`,
} as const;
