/**
 * The diaries batch's strings (engineering's placeholders of 2026-11-09, worded by the writer the same day). Keys are
 * engineering's; each comment names where the string shows. They fold into copy.ts the next time engineering touches
 * these call sites; until then this file is copy like copy.ts, the writer's to word.
 */
const paysThere = (n: number): string => (n === 0 ? "nothing pays there now" :`${n} ${n === 1 ? "load pays" : "loads pay"} there`);

export const PENDING = {
  // tabs.ts: the Dealer's and Finance's teaser card, after "Opens " (the director, 2026-11-09: they open the moment the
  // first truck is affordable, whatever the walkthrough's step; firstTruckOpen also opens them at Iuliia's first-truck
  // step and with the businesses layer).
  dealerOpens: "the moment you can afford your first truck, or when Iuliia brings it up",
  financeOpens: "with the Dealer",
  // ui/More.tsx TeaserCard (the Dealer, before it opens): the price of the goal, never a dead tap. figures.ts gapToTruck:
  // the cheapest route's cash on the day on a purchase loan (down payment, stake, tax, less the lease deposit). The
  // teaser then shows firstTruckToGo under it. (Client pass 2: the cushion left the figure; it is firstTruckCushion now.)
  dealerPrice: (needFd: string) => `Your first truck takes about ${needFd} FD in cash when you sign, with a loan for the rest.`,
  dealerPriceNone: "No truck is for sale anywhere right now.",
  // The one first-truck figure (the director, 2026-11-09; figures.ts firstTruckLine): on the Dealer's teaser, Iuliia's
  // page ("Next on the road") and the Dealer's own card. The cheapest truck's cash on the day, less the player's cash.
  firstTruckToGo: (fd: string) => `To your first truck: ${fd} FD`,
  // Once met; the Dealer opens on the same figure. Client batch 6b (the director): only for a truck that delivers today.
  firstTruckMet: "You can buy today",
  // Met, for a truck from the queue (the used lot or new from the NPC dealer, or a player dealership's stock): the day it
  // is delivered. The Dealer opens on this too. Same places as firstTruckMet.
  firstTruckOrderToday: (date: string) => `You can order today · delivered ${date}`,
  // The Dealer's card, a second line when another truck delivers sooner than the priced one (figures.ts firstTruckLine
  // `sooner`): the soonest, and of those the least cash today. `trailer` is its trailer ("dry van"; the engine keeps no
  // model year, so none is said); `fd` its cash today; `date` null when it delivers today.
  // The writer: "a truck with a" (the trailer isn't the truck), and the figure is cash at signing, not a gap ("0": the hold covers it).
  // Client batch 7: `hauls` names the company's freight when the sooner truck's trailer isn't it (as pricesLeastCash does),
  // and `date` can be whenIdle for a listing while the leased truck is on a run.
  soonerTruck: (trailer: string, fd: string, date: string | null, hauls: string | null = null) => `Or a truck with a ${trailer}${hauls ? ` (your company hauls ${hauls})` : ""}, delivered ${date ?? "today"}: ${fd === "0" ? "your hold already covers it" : `${fd} FD in cash${date ? " today" : ""}`}.`,
  // Iuliia's page, under the figure, while the priced truck comes from the queue: what waiting keeps paying the lessor.
  // figures.ts waitCostFd: the lease's share of gross × the company's weekly gross lately (last month's revenue over its
  // weeks, else revenue so far over the weeks since it started) × the share of its fleet on the lease × days / 7, to 10 FD.
  // Client batch 7 (QA: "lately" read a month the truck sat idle): `basis` is figures.ts weeklyGross's, the basis that covers
  // more weeks: "start" (the company's gross since it started; nearly always) or "month" (last month's).
  waitCost: (date: string, share: string, days: number, fd: string, basis: "month" | "start" = "start") => `Waiting to ${date} keeps you paying the lessor ${share} of gross for ${days} ${days === 1 ? "day" : "days"}: about ${fd} FD at what you've grossed ${basis === "month" ? "last month" : "since you started"}.`,
  // Once a truck is ordered to replace the lease (figures.ts orderedFirstTruck): the Dealer's card, the teaser and
  // Iuliia's page say the wait in place of the figure; What now? says it too (whatNowOrdered).
  // The writer: "ready", not "arrives": the date is the earliest, and the hand-over waits for a day's close with the
  // leased truck idle (deliverOrders at endOfDay), so no line promises the day itself.
  truckOrdered: (date: string, days: number) => `Your truck is ready ${date}, in ${days} ${days === 1 ? "day" : "days"}; until then the leased one runs`,
  // Its day has come: it takes over when the leased truck is next idle at a day's close (dealer.ts deliverOrders).
  truckOrderedDue: "Your truck is ready: it takes over at the first day's end that finds the leased one idle",
  // What now?, rule 5, while a truck ordered to replace the lease is at the dealer (nextstep.ts "ordered").
  whatNowOrderedAction: (days: number) => (days > 0 ? `Your truck is ready in ${days} ${days === 1 ? "day" : "days"}; until then the leased one runs.` : "Your truck is ready: it takes over at the first day's end that finds the leased one idle."),
  whatNowOrderedReason: "The leased truck earns until it goes back, so keep it booked. The swap comes at a day's end when it's idle.",
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
  idleReasonHeldDraw: (profit: string, cash: string, out: boolean, draw: string, held: string) => `${profit} over break-even, plus your ${draw} draw as the driver: ${cash} ${out ? "out of" : "to"} cash now, ${held} toward your truck.`,
  // Home time, said where it was hard-coded (Fleet.tsx's crew-going-home line and the tired card, the home-time toast
  // there and in logic.tsx sendHomePriced): only after "Home time" was chosen, so "for days off" is true.
  homeTimeHeading: "Heading home for days off.",
  homeTimeToast: "Heading home for days off",
  // logic.tsx idleWhy's last two lines, moved here from the code (QA: "1 dry van load in range pay enough"). `n` loads of
  // the trailer within the dispatcher's reach; `pct` the floor over break-even.
  idleUnderFloor: (n: number, trailer: string, pct: number) => {
    const floor = pct > 0 ? `your floor, break-even + ${pct}%,` : "your break-even";
    return n === 1 ? `1 ${trailer} load in range, and it doesn't cover ${floor} even at its ceiling.` : `${n} ${trailer} loads in range, and none this truck may take covers ${floor} even at its ceiling.`;
  },
  idleBidsLosing: (n: number, trailer: string) =>
    n === 1
      ? `1 ${trailer} load in range pays enough, but the dispatcher's bid on it hasn't won: another carrier bid lower, stood nearer or has the better record.`
      : `${n} ${trailer} loads in range pay enough, but the dispatcher's bids haven't won: other carriers bid lower, stood nearer or have the better record.`,
  // Pass 2b, the bid (the director, 2026-11-09). Under a bid above Book now on the load sheet (Board.tsx LoadSheet):
  // `fd` the bid's gross less Book now's, `hh` the round it clears at, `rate` Book now's per mile. Keep "A gamble" and the
  // order: what it pays, then what beats it. No odds: the engine computes none from real clears.
  bidGamble: (fd: string, hh: string, rate: string) => `A gamble: pays ${fd} FD more than Book now if it wins at ${hh}. Until then anyone can book it at ${rate}/mi, and at ${hh} a lower bid, a nearer truck or a better record can beat yours.`,
  // Iuliia's line when nothing above Book now is worth betting on (the usual-clears figure at or under Book now, or under
  // break-even): no suggested bid, an empty field. Also the laptop table's "Profit at your bid" then.
  bidBookBetter: "I wouldn't bid on this one: loads like it usually clear at or under Book now, or under your break-even.",
  // The laptop table's Bid pressed with the field empty.
  bidEmpty: "Type a rate to bid, or book it now.",
  gapReason: (gap: string) => `You're ${gap} FD short of the cash the cheapest truck takes when you sign, counting what's held toward it.`,

  // --- Client batch 4 (engineering's placeholders, 2026-11-09, for the writer) ---
  // What now? rule 3 when the load sheet has no suggested bid (board.ts suggestBid null): the sheet's own call.
  idleBookAction: (origin: string, dest: string) => `Book ${origin} to ${dest}.`,
  // What now? rule 5 after the first truck (NOW.gapAction says "your own truck").
  gapActionNext: "Keep hauling toward your next truck.",
  // The figure's one name before the first truck: the label of its explanation and of Iuliia's figure (GUIDE_LABEL.gap
  // and the explanation's total, "Gap to the next truck", stay for a company that owns one).
  firstTruckName: "To your first truck",
  // gapNotes' change note, with its reference point: since the player last opened the figure's explanation.
  gapWhyCheapestSince: "The cheapest truck is a different one from when you last opened this figure: listings come and go, and the used lot sells out and restocks.",
  // The Dealer's card names the truck the first-truck figure prices (figures.ts gapToTruck's pick). `kmi` "480k".
  // Client batch 5 (QA: "the cheapest" was untrue when the hold covered several trucks): the pick is the truck that takes
  // the least cash today, and among several the hold already covers (0 FD each), the cheapest. The words follow the rule;
  // `arrives` is the used lot's (or a dealer's) delivery date, when it has one.
  truckNew: (tier: string, trailer: string) => `a new ${tier} with a ${trailer}`,
  truckUsed: (tier: string, trailer: string, kmi: string, cond: string, at: string | null) => `a used ${tier} with a ${trailer}, ${kmi} miles, ${cond} condition${at ? `, in ${at}` : ""}`,
  // Client batch 6 (QA: "in Colorado Springs" on the card was "at Denver" in the list). Where a truck stands, the same
  // words on the Dealer's card (truckUsed's `at`), its used list and the Showroom's lease rows (figures.ts truckPlace):
  // the town, and its market where the town isn't the hub itself.
  townInMarket: (town: string, market: string) => `${town} (${market} market)`,
  // The used list's and the lease rows' place, after the condition: "… · 34% condition · in Colorado Springs (Denver market)".
  truckIn: (place: string) => `in ${place}`,
  // What now? rule 2 after a lost bid, when the better load's sheet suggests no bid (NOW.lostAction says "Bid on … instead").
  lostBookAction: (origin: string, dest: string) => `Book ${origin} to ${dest} instead.`,
  // Client batch 6 (QA): its reason quotes the booking it recommends, Book now's rate and profit (the sheet's "Profit at
  // book-now"); copy.ts NOW.lostReason's clears-near figures stay with "Bid on … instead.".
  lostBookReason: (rate: string, fd: string) => `You lost the last one. This load books now at ${rate}/mi and pays ${fd} FD over break-even.`,
  // The guide's Book-now prices page (guide/market.ts) where board.refuseOverCeiling is on: no bid over the ceiling wins.
  // `board` is the link to the load board page. And its dispatcher paragraph, eased as the dispatcher's floor line says it.
  guideBookNowIntro: (board: string) => `Every load shows a <b>book-now</b> price: what the poster is offering right now. Take it and the load is yours at once, no round to wait for. Want more? Bid above it and wait for the round: the poster takes the best bid at or under its ceiling, weighing price, on-time record and empty miles, and refuses one over it (${board}). Anyone who'd take the posted price just books.`,
  guideBookNowEases: (idleH: number, awayFrom: number, awayTo: number, below: number, everyH: number) => `The standing order "Book loads between rounds" takes a load whenever its book-now clears your break-even plus a margin. The margin eases as the truck needs to move: down to nothing by ${idleH} hours idle, or as its driver's days from home run from ${awayFrom} to ${awayTo}. At home it eases only halfway. It never books under break-even, nor under your dispatcher's floor as that eases. Dispatchers look every ${everyH} hours.`,
  // Client batch 6b: `hauls` (the director) names the company's freight when the priced truck's trailer isn't it: "…a
  // reefer, 480k miles, 48% condition; your company hauls dry van." Null when it matches.
  pricesLeastCash: (truck: string, arrives: string | null, hauls: string | null = null) => `That's for the truck that takes the least cash today: ${truck}${arrives ? `, delivered ${arrives}` : ""}${hauls ? `; your company hauls ${hauls}` : ""}.`,
  pricesCovered: (truck: string, arrives: string | null, hauls: string | null = null) => `That's for the cheapest truck your hold already covers: ${truck}${arrives ? `, delivered ${arrives}` : ""}${hauls ? `; your company hauls ${hauls}` : ""}.`,
  // Iuliia's catch on a used truck under 60% condition (figures.ts WORN_BELOW): its repairs by the engine's own wear figures
  // (wear.ts: breakdowns at the average repair bill, and maintenance per mile, worn as it is). Per `per` miles, not a month:
  // the engine keeps no month's miles (the economy's figure, if wanted).
  // Client batch 6 (QA: it restated the miles and condition the Dealer's card had just given): it names the figure's truck
  // and says it's worn; `kmi` and `cond` are kept for the signature and unused.
  wornCatch: (kmi: string, cond: string, fd: string, per: string) => `The truck behind that figure is worn: expect about ${fd} FD in breakdowns and upkeep every ${per} miles, and more as it wears. I'd wait for a sounder one.`,
  // Home time queued (Fleet.tsx): the engine sends a home-due truck home on a load headed that way, or empty once it's
  // within `mi` of home or has sat `days` days idle (board.ts maybeReposition, fatigue.homeward). "Heading home" only when
  // it is (homeTimeHeading: running empty toward home).
  homeTimeQueued: (mi: string, days: number) => `Home for days off after this run: on a load headed that way, or empty once it's within ${mi} mi of home or has waited ${days} ${days === 1 ? "day" : "days"} for one.`,
  homeTimeWaiting: (days: number) => `Waiting for a load headed home, for days off there. With none in ${days} ${days === 1 ? "day" : "days"} idle, it runs home empty.`,
  homeTimeNextRound: "Sets off for home and days off at the next round.",
  homeTimeQueuedToast: (days: number) => `Home for days off after this run: on a load headed that way, or empty within ${days} ${days === 1 ? "day" : "days"} idle`,
  // Rolling.tsx under businesses.parking.stopInTown, "town" chosen: tonight's stop in the town it stands in.
  tonightTown: (place: string) => `Tonight, as you chose: a night in town at ${place}, no ticket`,
  // The laptop table and the guide where board.refuseOverCeiling is on (live): a bid over the ceiling is refused.
  tableHowRefused: "Book now and the load is yours at once. Or bid and wait for the round: the poster takes the best bid at or under its ceiling, weighing price, on-time record and empty miles. A bid over the ceiling is refused. One bid per truck per round; yours replaces your dispatcher's.",
  ceilingRefused: "A bid over the ceiling is refused.",
  guideCeilingRefused: "A bid over the ceiling is refused: the poster never pays more than it.",
  // The dispatcher's floor (Dispatcher.tsx, the guide): it relaxes as the truck needs to move (standingOrders.ts floorRate,
  // desperation): to break-even after `idleH` hours idle (halfway at home), or from `awayFrom` to `awayTo` days from home;
  // and for a load into a busier market down to `below`% under break-even.
  floorLabel: "Ask at least break-even plus",
  floorRelaxes: (idleH: number, awayFrom: number, awayTo: number, below: number) => `It eases as the truck needs to move: down to break-even by ${idleH} hours idle, or as its driver's days from home run from ${awayFrom} to ${awayTo}. At home it eases only halfway. For a load into a market with more freight per truck, the eased floor can go as far as ${below}% under break-even.`,
  floorGuide: "The dispatcher's floor: it takes no load under it, and it eases as a truck sits idle or its driver is long from home",
  // The month report's claims row and its news lines, now with the delivery windows' claims (books.ts).
  claimsRow: "Claims: cargo, late, no-show, released and unfilled loads",
  // Client batch 6. The title (test build), above Continue and New test world, standing until a new world starts: why
  // the saved world was set aside. Stale: a version bump changed the rules (RULESET), so its log can't be replayed.
  titleStale: "The rules have changed since you last played, so your saved test world can't be continued. Start a new one.",
  // Unreadable: the saved log failed its check or its replay.
  titleUnreadable: "Your saved test world couldn't be opened. Start a new one.",
  // Client batch 6 (QA: "Freight is booming across the country" over hub rows that say "A little thin in January").
  // The country's reading, from freight.ts marketMood: the last week's cleared rate across the country against the four
  // weeks before (booming from +rates.news.boomAt, slumping from slumpAt). It reads rates, not how much freight there
  // is, so it says rates and says it's the country's. Once under the hub list (ChooseHub), and on its own line under a
  // hub's own season line on its page. copy.ts MARKET.card is no longer read; MARKET.feed (the news line on the day the
  // mood crosses) says rates too (the writer's pass).
  countryRatesUp: (pct: string) => `Across the country, rates over the last week are up ${pct} on the four weeks before.`,
  countryRatesDown: (pct: string) => `Across the country, rates over the last week are down ${pct} on the four weeks before.`,
  // Client batch 6 (QA: "most need a second truck… Your gap to the next truck is 0 FD" to a company that owns none, beside
  // the card's "You can buy today"). Iuliia's day-28 line, before any truck is owned (ui/Milestones.tsx); copy.ts
  // MILESTONE.day28.at and .reason stay for a company that owns one.
  day28AtFirst: "Businesses are open. Nobody needs a warehouse in week four, and you need a truck of your own first.",
  // `figure` is firstTruckLine's: "To your first truck: N FD" or "You can buy today"; null with no truck for sale anywhere.
  day28ReasonFirst: (figure: string | null) => (figure ? `A business pays over years. ${figure}.` : "A business pays over years."),
  // Client batch 7 (QA: "You can buy today" and "NPC-leased truck is on a trip" while the leased truck was on a run). A
  // listing changes hands only while the lessor's truck is idle (market.ts listingBlock). The first-truck figure when the
  // priced truck is a listing and the leased truck is on a run (figures.ts firstTruckLine):
  firstTruckWhenIdle: (truck: number, to: string) => `You can buy when truck ${truck} is next idle; it's on a run to ${to}`,
  // A used listing's row on the Dealer, under its button, in place of the engine's "NPC-leased truck is on a trip".
  listingWhenIdle: (truck: number, to: string) => `You can buy this when truck ${truck} is next idle; it's on a run to ${to}.`,
  // That row's button while it waits (otherwise "Buy today").
  buyWhenIdleLabel: "Buy",
  // soonerTruck's `date` for a listing while the leased truck runs.
  whenIdle: (truck: number) => `when truck ${truck} is next idle`,
  // The used lot's rows (Showroom): the button, and the confirm sheet's verb and line (QA: "Buy Workhorse + Dry van?").
  lotButton: (replacing: boolean) => `Order this rig${replacing ? " (replaces your lease)" : ""}`,
  orderVerb: "Order",
  lotOrderNote: (date: string, replacing: boolean) => `It's an order: ready ${date}.${replacing ? " Your lease ends when it's handed over." : ""}`,
  // The yard line on the Truck tab (QA: "1 trailers of your own").
  trailersOwn: (n: number) => `${n} ${n === 1 ? "trailer" : "trailers"} of your own`,
  // The walkthrough's "Getting paid" step (QA: "Delivered, and paid today." stood for weeks until the second delivery).
  walkPaidBrief: (share: string) => `Paid on delivery. Money shows the lessor's share and the ${share} held toward your own truck.`,
  // Client batch 7 (QA: "Your own truck" was logged when the truck was ordered, three months before it ran). The milestone
  // log's entry for the order (milestones.ts "truckOrdered"), on its day; "Your own truck" now dates the hand-over.
  msOrderedName: "Truck ordered",
  // Its line while the truck waits at the dealer (Iuliia's caption on the order day, and the log), and once it's run.
  msOrderedAt: (date: string) => `You ordered your first truck. It's ready ${date}; the leased one runs until the hand-over.`,
  msOrderedDone: "You ordered your first truck; it was handed over later, when the leased one was free.",
  msOrderedReason: "An order isn't a truck yet: the lessor's share runs until the day it's handed over.",
  newsServiceClaim: (kind: string, load: string, fd: string) => `${kind === "late" ? `Late delivery, load #${load}` : kind === "noshow" ? `No-show, load #${load}` : `Released load #${load}`}: −${fd} FD claim to the poster.`,
} as const;

/** Explanations that replace copy.ts EXPLAIN's (ui/Explain.tsx reads these first); fold in with the rest. */
export const PENDING_EXPLAIN: Record<string, { what: string; how: string; moves: string }> = {
  // The gap left its cushion (client pass 2): the rows are the cheapest truck's cash on the day, the hold, your cash.
  // Client batch 4: the claims row carries the delivery windows' claims too.
  "month.claims": { what: "What you paid in claims: receivers for spoiled or damaged freight, a broker's charge when a posted load found no carrier, and a poster's claim on a load delivered late, never picked up, or released.", how: "Each claim or charge as it was paid; one paid to you counts back here.", moves: "Perishables on time; fewer crashes; an open deck in the weather; booking only what the truck can make; releasing a load early, not at the last minute." },
  "guide.gapToTruck": { what: "How far you are from your next truck.", how: "The cash the cheapest truck takes when you sign (down payment, loan stake and sales tax), less what's held toward your truck, less your cash.", moves: "Hauling; the cheapest truck on offer, which changes; what you spend." },
};
