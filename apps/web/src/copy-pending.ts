/**
 * The diaries batch's strings (engineering's placeholders of 2026-11-09, worded by the writer the same day). Keys are
 * engineering's; each comment names where the string shows. They fold into copy.ts the next time engineering touches
 * these call sites; until then this file is copy like copy.ts, the writer's to word.
 */
const paysThere = (n: number): string => (n === 0 ? "nothing pays there now" :`${n} ${n === 1 ? "load pays" : "loads pay"} there`);

/** whenIdle's words, shared with readyWhenIdle (client batch 7b), so the two can't drift apart. */
const PENDING_WHEN_IDLE = (truck: number): string => `once truck ${truck} is idle`;

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
  // Client batch 7 (the writer, QA's one word for one event): "ready" everywhere an order's day is said.
  firstTruckOrderToday: (date: string) => `You can order today · ready ${date}`,
  // The Dealer's card, a second line when another truck delivers sooner than the priced one (figures.ts firstTruckLine
  // `sooner`): the soonest, and of those the least cash today. `trailer` is its trailer ("dry van"; the engine keeps no
  // model year, so none is said); `fd` its cash today; `date` null when it delivers today.
  // The writer: "a truck with a" (the trailer isn't the truck), and the figure is cash at signing, not a gap ("0": the hold covers it).
  // Client batch 7: `hauls` names the company's freight when the sooner truck's trailer isn't it (as pricesLeastCash does),
  // and `date` can be whenIdle for a listing while the leased truck is on a run.
  soonerTruck: (trailer: string, fd: string, date: string | null, hauls: string | null = null) => `Or a truck with a ${trailer}${hauls ? ` (your company hauls ${hauls})` : ""}, ready ${date ?? "today"}: ${fd === "0" ? "your hold already covers it" : `${fd} FD in cash`}.`,
  // Iuliia's page, under the figure, while the priced truck comes from the queue: what waiting keeps paying the lessor.
  // figures.ts waitCostFd: the lease's share of gross × the company's weekly gross lately (last month's revenue over its
  // weeks, else revenue so far over the weeks since it started) × the share of its fleet on the lease × days / 7, to 10 FD.
  // Client batch 7 (QA: "lately" read a month the truck sat idle): `basis` is figures.ts weeklyGross's, the basis that covers
  // more weeks: "start" (the company's gross since it started; nearly always) or "month" (last month's).
  waitCost: (date: string, share: string, days: number, fd: string, basis: "month" | "start" = "start") => `Waiting to ${date} keeps you paying the lessor ${share} of gross for ${days} ${days === 1 ? "day" : "days"}: about ${fd} FD at your average week ${basis === "month" ? "last month" : "since you started"}.`,
  // Once a truck is ordered to replace the lease (figures.ts orderedFirstTruck): the Dealer's card, the teaser and
  // Iuliia's page say the wait in place of the figure; What now? says it too (whatNowOrdered).
  // The writer: "ready", not "arrives": the date is the earliest, and the hand-over waits for a day's close with the
  // leased truck idle (deliverOrders at endOfDay), so no line promises the day itself.
  truckOrdered: (date: string, days: number) => `Your truck is ready ${date}, in ${days} ${days === 1 ? "day" : "days"}; until then the leased one runs`,
  // Its day has come: it takes over when the leased truck is next idle at a day's close (dealer.ts deliverOrders).
  // Client batch 8b item 17 (the writer's 7b item 6, the director's shape): "ready since" an ordered truck past its ready
  // day; `date` null on the ready day itself ("ready today"); `n` the leased truck's number, which the new one keeps;
  // `swap` assets.swapAtNextIdle, which hands it over the moment the leased one next stands idle.
  truckOrderedDue: (date: string | null, n: number, swap: boolean) => `${date === null ? "Your truck is ready today" : `Your truck has been ready since ${date}`} · ${(swap ? `handed over when leased truck ${n} next stands idle` : `handed over at the first day's end with leased truck ${n} idle`)}`,
  // What now?, rule 5, while a truck ordered to replace the lease is at the dealer (nextstep.ts "ordered").
  whatNowOrderedAction: (days: number, date: string | null = null, n = 1, swap = false) =>
    days > 0 ? `Your truck is ready in ${days} ${days === 1 ? "day" : "days"}; until then the leased one runs.` : `${date === null ? "Your truck is ready today" : `Your truck has been ready since ${date}`}; it's ${(swap ? `handed over when leased truck ${n} next stands idle` : `handed over at the first day's end with leased truck ${n} idle`)}.`,
  whatNowOrderedReason: (swap = false) => `The leased truck earns until it goes back, so keep it booked. ${swap ? "The swap comes the moment it's next idle." : "The swap comes at a day's end when it's idle."}`,
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
  // Client batch 8b item 10 (the exploit hunter: the bid field took −5 and "abc" in silence): under the bid field (the
  // sheet) or as the table's toast, when what's typed isn't a rate a mile; nothing is placed.
  bidNotARate: "That isn't a rate: type the FD a mile you'd haul it for, like 2.45.",
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
  pricesLeastCash: (truck: string, arrives: string | null, hauls: string | null = null) => `That's for the truck that takes the least cash today: ${truck}${arrives ? `, ready ${arrives}` : ""}${hauls ? `; your company hauls ${hauls}` : ""}.`,
  pricesCovered: (truck: string, arrives: string | null, hauls: string | null = null) => `That's for the cheapest truck your hold already covers: ${truck}${arrives ? `, ready ${arrives}` : ""}${hauls ? `; your company hauls ${hauls}` : ""}.`,
  // Iuliia's catch on a used truck under 60% condition (figures.ts WORN_BELOW): its repairs by the engine's own wear figures
  // (wear.ts: breakdowns at the average repair bill, and maintenance per mile, worn as it is). Per `per` miles, not a month:
  // the engine keeps no month's miles (the economy's figure, if wanted).
  // Client batch 6 (QA: it restated the miles and condition the Dealer's card had just given). Client batch 7 (QA: on
  // Iuliia's page it follows "You can buy today", with no truck named): it stands alone, naming the truck and its
  // condition only; `kmi` is kept for the signature and unused.
  wornCatch: (kmi: string, cond: string, fd: string, per: string) => `The truck I've priced for your first is worn, at ${cond} condition: expect about ${fd} FD in breakdowns and upkeep every ${per} miles, and more as it wears. I'd wait for a sounder one.`,
  // Home time queued (Fleet.tsx): the engine sends a home-due truck home on a load headed that way, or empty once it's
  // within `mi` of home or has sat `days` days idle (board.ts maybeReposition, fatigue.homeward). "Heading home" only when
  // it is (homeTimeHeading: running empty toward home).
  homeTimeQueued: (mi: string, days: number) => `Home for days off after this run: on a load headed that way, or empty once it's within ${mi} mi of home or has waited ${days} ${days === 1 ? "day" : "days"} for one.`,
  homeTimeWaiting: (days: number) => `Waiting for a load headed home, for days off there. With none in ${days} ${days === 1 ? "day" : "days"} idle, it runs home empty.`,
  homeTimeNextRound: "Sets off for home and days off at the next round.",
  // Client batch 8b item 49 (the stubborn specialist: the card said its rule in two wordings): the toast says the card's.
  homeTimeQueuedToast: (mi: string, days: number) => `Home for days off after this run: on a load headed that way, or empty once it's within ${mi} mi of home or has waited ${days} ${days === 1 ? "day" : "days"} for one`,
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
  // Client batch 7b: `to` is null when the leased truck isn't idle but isn't on a run either (in the shop, parked).
  firstTruckWhenIdle: (truck: number, to: string | null) => (to !== null ? `You can buy once truck ${truck} is idle; it's on a run to ${to} now` : `You can buy once truck ${truck} is idle`),
  // A used listing's row on the Dealer, under its button, in place of the engine's "NPC-leased truck is on a trip".
  listingWhenIdle: (truck: number, to: string | null) => (to !== null ? `A truck changes hands only while your leased one stands idle, and truck ${truck} is on a run to ${to} now.` : `A truck changes hands only while your leased one stands idle, and truck ${truck} isn't idle now.`),
  // That row's button while it waits (otherwise "Buy today").
  buyWhenIdleLabel: "Buy",
  // soonerTruck's `date` for a listing while the leased truck runs.
  whenIdle: (truck: number) => PENDING_WHEN_IDLE(truck),
  // Client batch 7b: a used listing's "when" line while the leased truck isn't idle, in place of "Ready today" (Dealer.tsx).
  readyWhenIdle: (truck: number) => `Ready ${PENDING_WHEN_IDLE(truck)}`,
  // The Showroom's inline strings, moved here for the writer (the one word "ready"): the used lot's lead line, its end…
  // The writer (7b): live, a lot rig that adds to a fleet is ready in the lot's own days (usedMarket.npcLot.deliveryDays,
  // 7) and one that replaces the lease waits the NPC dealer's queue (lotDeliveryDays), so "when a new one would be" held
  // for one buyer only. Each row says its own date.
  lotReadyNote: "each row says when it's ready",
  // …and the new rig's order toasts, for FD and for dollars.
  orderedReady: (days: string) => `Ordered. Ready in ${days}`,
  orderedReadyUsd: (days: string) => `Ordered for dollars. Ready in ${days}`,
  // The used lot's rows (Showroom): the button, and the confirm sheet's verb and line (QA: "Buy Workhorse + Dry van?").
  lotButton: (replacing: boolean) => `Order this rig${replacing ? " (replaces your lease)" : ""}`,
  orderVerb: "Order",
  // QA's 0.24.1 replay, fail 2: with assets.swapAtNextIdle on, the hand-over is at the leased truck's next idle moment
  // (the writer's 7b item 6 tail, "handed over when leased truck {n} next stands idle").
  lotOrderNote: (date: string, replacing: boolean, swap = false, n: number | null = null) =>
    `It's an order: ready ${date}${replacing ? (swap ? `, and handed over when ${n !== null ? `leased truck ${n}` : "your leased truck"} next stands idle. Your lease ends then.` : ", and handed over at the first day's end after that with your leased truck idle. Your lease ends then.") : "."}`,
  // The yard line on the Truck tab (QA: "1 trailers of your own").
  trailersOwn: (n: number) => `${n} ${n === 1 ? "trailer" : "trailers"} of your own`,
  // The walkthrough's "Getting paid" step (QA: "Delivered, and paid today." stood for weeks until the second delivery).
  walkPaidBrief: (share: string) => `Each load pays on delivery. Money shows the lessor's share and the ${share} held toward your own truck.`,
  // Client batch 7 (QA: "Your own truck" was logged when the truck was ordered, three months before it ran). The milestone
  // log's entry for the order (milestones.ts "truckOrdered"), on its day; "Your own truck" now dates the hand-over.
  msOrderedName: "Truck ordered",
  // Its line while the truck waits at the dealer (Iuliia's caption on the order day, and the log), and once it's run.
  msOrderedAt: (date: string, n = 1, past = false, swap = false) =>
    past ? `Your first truck has been ready since ${date}. It's ${(swap ? `handed over when leased truck ${n} next stands idle` : `handed over at the first day's end with leased truck ${n} idle`)}; until then that one keeps running.` : `Your first truck is ordered, ready ${date}. Until it's handed over, the leased one keeps running.`,
  msOrderedDone: (swap = false) => (swap ? "Your first truck, ordered this day. It was handed over later, the moment the leased one stood idle." : "Your first truck, ordered this day. It was handed over later, at a day's end with the leased one idle."),
  msOrderedReason: "An order isn't a truck yet: until the hand-over, the lessor still takes its share of every load.",
  // The red team's persistence fixes (studio/reviews/redteam-persistence.md). The test page with this browser's world open
  // in another tab (§4, a Web Lock): this tab shows it but never saves it and takes no orders.
  testWatching: "Your world is open in another tab; this one only watches.",
  // Client batch 8a item 22 (the borrower paid 505 FD a week for twelve weeks on a truck still on the lot): the loan
  // sheet's row under the weekly payment, saying when the first one falls and, for a truck that comes later, that the
  // payments run from the order while it waits (engine: the weekly step charges every open purchase loan).
  loanFirstLabel: "First payment",
  loanFirstValue: (date: string, waits: boolean) => (waits ? `${date}, and every week after, even while the truck waits at the dealer` : date),
  // Client batch 8a item 46 (the stubborn specialist: Book now was live on a truck with no driver and refused after the
  // tap): under the board's head when the chosen truck has no driver, and as the reason under a shut Book now.
  boardNeedsDriver: (n: number) => `Truck ${n} has no driver: hire one on Staff before it can book a load.`,
  bookNeedsDriver: "No driver in this truck, so it can't book. Hire one on Staff.",
  // Client batch 8a item 30 (the middleman: the funding field took -50000 as 0 and then no typing at all): under the
  // brokerage's funding field (step 2) when the typed amount isn't one the carrier can move; the field keeps what was typed.
  fundRange: (min: string, max: string) => `Fund it with ${min} to ${max} FD: at least the bond and the licence, at most what your carrier can spare with the fee.`,
  fundNotANumber: "Type an amount in FD, digits only.",
  // Client batch 8a item 61 (the director's G; items 44 and 53): the bid's floor is break-even itself, and a bid under it
  // is allowed with the loss said, under the bid field (and in the laptop table's toast); a lane whose loads clear under
  // the player's break-even says so in the sheet in place of the gamble line.
  bidUnderBreakEven: (fd: string) => `Under break-even: you'd lose ${fd} FD.`,
  laneUnderBreakEven: (clears: string, be: string) => `Loads like this clear near ${clears} here, under your break-even of ${be}. This lane pays less than it costs you; book another or pass.`,
  // Client batch 8b items 26 and 64 (the director's J): the dollar price under the FD button, plain text on a first-truck
  // screen (a company that owns no truck yet), a button elsewhere; "to the launch pool" goes.
  orUsd: (usd: string) => `Or ${usd}`,
  // Client batch 8b item 18 (the director's listing-worth ruling §1–2): the truck card names its figure for what it is
  // (book value: what the lender and the lot price it at) and beside it what such trucks really sell for, by how sure
  // that is: inside the starters' band, near book within two weeks; above it, few buyers and a range. The sell sheet, in
  // her order: the price's path, the cost of waiting, the end, and the buyer line above the band. Item 8: the sheet says
  // before listing that the sale repays the truck's loan first, with a purchase loan's stake back.
  ownedBook: (fd: string) => `owned · book value ${fd} FD`,
  bookValueLabel: "Book value",
  sellsUsually: (fd: string) => `Usually sells for about ${fd} within two weeks.`,
  sellsFew: (lo: string, hi: string) => `Few buyers at this price. Fleets pay about ${lo}–${hi} for trucks like this, when one is buying; it can take weeks, or not sell.`,
  sellPath: (pct: string, floorPct: string, floor: string, weeks: number) => `The price drops ${pct} a week, to ${floorPct} of today's book value (${floor} FD) in week ${weeks}.`,
  sellWaiting: (fd: string) => `A listed truck pays the idle fee, ${fd} FD a day, while it waits.`,
  sellEnd: (floor: string) => `At ${floor} FD, if no one has bought, it comes off sale and is parked.`,
  sellFewBuyers: "Only carriers with the cash buy trucks this dear; there are few.",
  sellLoan: (owed: string, stake: boolean) => `The sale repays the truck's loan first (${owed} FD owed)${stake ? ", and the loan's stake comes back to you" : ""}.`,
  // Client batch 8b item 32 (the middleman: "Shipper 1,964 · carrier 1,964 · fee 59 · yours -59"): under a moving load's
  // money line when the carrier's pay walked up to (or near) what the shipper pays: no carrier took it at the brokerage's
  // price, so each round raised the pay toward the shipper's (board.ts raiseCeiling, never past it), and the margin went.
  marginWalked: "The margin went to get it hauled: no carrier took it at your price, so each round raised the pay toward what the shipper pays.",
  // Client batch 8b item 25 (the borrower: a driver hired seconds ago read "14 d out · fatigue 57%"): on the hire list, a
  // candidate's days out and fatigue from their last job, carried into the next (the pool doesn't rest them).
  candidateTired: (days: number, fatigue: string) => `${days} d out · fatigue ${fatigue}`,
  // Client batch 8b item 36 (the middleman: a brokerage's cash it now ran about 10%, where he expected the brokers' rate):
  // under a brokerage's invoice rows when it holds no factoring contract. Cash now for any company is the spot rate plus
  // aging; the brokers' decided rate is the contract's, flat (token.payment.factoring.contract.brokerRate).
  brokerSpotRate: (spot: string, perDay: string, cap: string, contract: string) => `Cash now is ${spot} plus ${perDay} a day of an invoice's age, at most ${cap} more. Under a factoring contract a brokerage's paper goes at ${contract} flat.`,
  // Client batch 8b item 41 (the absentee: contracts on for six months, none came): under "No contracts held", where the
  // carrier stands for an offer at its home market for its trailer, as the engine picks (contracts.ts weeklyContracts):
  // about `expected` offers a week go to the `fit` local carriers with room, the best standing first (reputation × tender
  // record, a carrier without a contract ranked up).
  contractStanding: (hub: string, expected: string, fit: number, rank: number) => `At ${hub} about ${expected} offers a week go to ${fit} local ${fit === 1 ? "carrier" : "carriers"} with room, the best record first. You stand ${rank} of ${fit}.`,
  contractNotLocal: "No offers come while local shippers are passing you over for turned-down tenders.",
  // Client batch 8b item 27 (the borrower: the owner's card went once drivers were hired, and a hired driver sat on the
  // payroll with no truck): on Staff's "You" card, what the game does with the owner's seat today (labor.ts: an owner
  // without a truck takes a hired driver's at the next hub, and that driver waits for the next empty seat); and on a
  // driver's card, plainly, a wage paid with no truck.
  ownerSeat: "Hiring doesn't take your seat. If your truck goes, you take a hired driver's at the next hub, and that driver waits for the next empty seat.",
  ownerOffRoad: "You're off the road: no truck of yours has a free seat at a hub yet.",
  paidNoTruck: (fd: string) => `Paid with no truck: about ${fd} FD a week until a seat frees up.`,
  // Client batch 8b items 31 and 62 (the director's K; the middleman's 90% margin): under the margin field (step 3 and
  // the standing order), before it's saved, the margin in figures and against the market, from the world's own loads at
  // the brokerage's hub. `marginUnder` when the pay it posts at sits under what loads like them clear at there.
  marginFacts: (margin: string, carrier: string, perLoad: string, lo: string, hi: string, feeLo: string, feeHi: string) =>
    `At ${margin}, carriers see ${carrier} of the shipper's rate, about ${perLoad} FD a load. Brokers here take ${lo}–${hi}. Loads no carrier takes fall off, and each costs you its fall-off fee (${feeLo}–${feeHi} FD on recent loads).`,
  marginUnder: (post: string, clears: string) => `At this margin your loads post near ${post}/mi, under the ${clears}/mi loads like them clear at here: few carriers will take them.`,
  // Client batch 8b item 33 (the middleman: "See what brokers earned last month" listed every broker as "#1" with no
  // figure): on each row when the list is sorted by the month, what the company kept in its last closed month; and over
  // the list before any month has closed.
  monthKept: (fd: string) => `kept ${fd} FD last month`,
  noMonthYet: "No month has closed yet: the ranking by month starts at the first close.",
  // Client batch 8b item 37 (the middleman: "{carrier} has no free truck in reach of the pickup" under every card): once,
  // over the brokerage's loads on the board, when the carrier has no idle truck with a driver at all.
  carrierNoFreeTruck: (carrier: string) => `${carrier} has no free truck right now, so these can't go to it yet.`,
  // Client batch 8b item 40 (the absentee: the hold sat at 15,925 FD for months and nothing said it was full): on Money's
  // held row once the deposit is whole (trips.ts holds back only until depositDueFd), what's held and what happens to it.
  heldFull: (fd: string) => `Full: ${fd} FD is all the lease holds. Your loads pay in whole from here, and the ${fd} FD goes toward your own truck when you buy one.`,
  // Client batch 8b item 60 (the director's E): "while you were away", after a game day or more, in her order: the time
  // away; what went wrong (claims, late deliveries, empty miles, breakdowns, trucks the lender took, a missed payment,
  // fines); the money (delivered, paid, kept, cash then and now); on time; one next step (What now?, as before). Iuliia's
  // line is drawn from the interval's worst item, else its best, never the same line twice running (awayLines).
  awayFor: (days: number, hours: number) => `You were away ${days > 0 ? `${days} ${days === 1 ? "day" : "days"}` : ""}${days > 0 && hours > 0 ? " and " : ""}${hours > 0 || days === 0 ? `${hours} ${hours === 1 ? "hour" : "hours"}` : ""} of game time.`,
  awayWrong: (items: string) => `What went wrong: ${items}.`,
  awayClaims: (n: number, fd: string) => `${n} ${n === 1 ? "claim" : "claims"} (${fd} FD)`,
  awayLate: (n: number) => `${n} late ${n === 1 ? "delivery" : "deliveries"}`,
  awayEmpty: (mi: string) => `${mi} empty miles`,
  awayBreakdowns: (n: number) => `${n} ${n === 1 ? "breakdown" : "breakdowns"}`,
  awayTaken: (n: number) => `${n} ${n === 1 ? "truck" : "trucks"} taken by the lender`,
  awayMissed: (n: number) => `${n} loan ${n === 1 ? "payment" : "payments"} missed`,
  awayFines: (fd: string) => `${fd} FD in fines`,
  awayNothingWrong: "Nothing went wrong.",
  awayMoney: (n: number, paid: string, kept: string, then: string, now: string) => `${n} ${n === 1 ? "load" : "loads"} delivered, ${paid} FD paid, ${kept} FD kept. Cash ${then} FD then, ${now} FD now.`,
  awayOnTime: (pct: string) => `On time: ${pct}.`,
  awayLines: {
    taken: ["A truck gone to the lender is a lesson with a price. Let's not take the course twice."],
    missed: ["A missed payment is a clock, not a mood. The next one decides the truck."],
    claims: ["Claims are the shipper's way of saying the clock matters. It does."],
    breakdowns: ["The road keeps its own books. Repairs are in them."],
    late: ["Late is a habit if it's allowed to be one."],
    empty: ["Empty miles are fuel spent on the view."],
    fines: ["The patrol was busy. So, it seems, were we."],
    kept: ["Money kept while you slept. My favorite kind."],
    delivered: ["The trucks worked; the invoices are the proof."],
    quiet: ["Quiet. Quiet is fine. Quiet pays nothing, though."],
  } as Record<string, string[]>,
  // Client batch 8b item 63 (the director's M): Iuliia offers each further standing order once, at its moment, on the
  // Truck tab: after a second stranding, at the first contract offer, after a load lost between rounds.
  offerReposition: "Twice now a truck has stood where nothing pays. I can have the dispatcher move an idle truck toward freight after two rounds. Want that?",
  offerContracts: "A shipper has offered you a contract. I can have the dispatcher take offers like it as they come. Want that?",
  offerBookNow: "That load went between rounds, to someone who booked it. I can have the dispatcher book a paying load between rounds. Want that?",
  offerYes: "Turn it on",
  offerNo: "Not now",
  offerDone: "Done: it's in your standing orders on the Truck tab.",
  // Client batch 8b section D, the early-delivery fee's screens (behind assets.expedite.enabled): the Dealer's second
  // button beside a new rig's order, the ordered truck's "Expedite" on Truck's order rows until the floor, and the confirm's
  // lines in the director's fixed order: the dates and days sooner; the fee, paid now, not refunded; what waiting costs
  // (Iuliia's sentence from expediteWaitParts, its figures each named and never summed; the order and the "if" are the
  // director's, the words the writer's). Item 65 (the director's L): the sentence when no truck is seated at all.
  expediteButton: (date: string, fee: string) => `Order early · ready ${date} · ${fee} FD`,
  expediteCardButton: (date: string, fee: string) => `Expedite · ready ${date} · ${fee} FD`,
  expediteVerb: "Expedite",
  expediteDates: (date: string, was: string, days: number) => `Ready ${date} instead of ${was}: ${days} ${days === 1 ? "day" : "days"} sooner.`,
  expediteFee: (fee: string) => `The fee is ${fee} FD, paid now and not refunded.`,
  expediteDone: (date: string) => `Expedited: ready ${date}.`,
  orderOnRow: (what: string, date: string) => `On order: ${what}, ready ${date}`,
  waitPayments: (span: string, fd: string) => `Waiting ${span} costs about ${fd} FD in payments`,
  waitLessor: (span: string, fd: string) => `Waiting ${span} costs about ${fd} FD to the lessor`,
  waitBoth: (span: string, pay: string, lessor: string) => `Waiting ${span} costs about ${pay} FD in payments and ${lessor} FD to the lessor`,
  waitNothing: (span: string) => `Waiting ${span} costs nothing I can count in payments`,
  waitCounts: (perWeek: string, weeks: number, fd: string, fee: string) =>
    `Your trucks have each kept about ${perWeek} a week over the last ${weeks} weeks; if this one does the same, with a driver hired the day it arrives, that's about ${fd}. The fee is ${fee}.`,
  waitAllICount: "that's all I can count.",
  waitEmptyTruck: (n: number) => `Truck ${n} has no driver today; seat it before you count on another.`,
  waitNoneSeated: "None of your trucks has a driver today; hire one before you count on another.",
  waitBooks: (weeks: number) => `Your company needs ${weeks} weeks of loads before I can say what a truck keeps.`,
  waitFeeOnly: (fee: string) => `The fee is ${fee}.`,
  waitPays: "It pays if the freight holds.",
  waitDoesNot: "It doesn't pay at your recent weeks; I'd wait.",
  // Client batch 8b item 35 (the middleman: More still offered "Start a brokerage" above the one he owned): the panel's
  // title under More once the player has a brokerage, above its row.
  brokerageOwnedTitle: "Your brokerage",
  // Client batch 8b item 16 (the writer): a trailer's order toast, with its wait.
  trailerOrderedReady: (days: number) => `Trailer ordered. Ready in ${days} ${days === 1 ? "day" : "days"}`,
  // Client batch 8b item 5 (QA): an order said as one on the loan's controls (the lot's rig and new rigs, which come on a
  // later day): the button, the sheet's title and its confirm button; the lot order's toast with its wait; and the cash
  // line under a buy when the lease's hold counts toward it (the lower figure is the cash after the hold, not the price).
  orderOnLoan: "Order on a loan ›",
  orderLoanTitle: (what: string) => `Order ${what} on a purchase loan`,
  orderLoanButton: (fd: string) => `Order on a loan · ${fd} FD now`,
  lotOrdered: (days: number) => `Ordered from the used lot. Ready in ${days} ${days === 1 ? "day" : "days"}`,
  whyCashAfterHold: (have: string, need: string, held: string) => `You have ${have} FD. It takes ${need} FD in cash with tax, after the ${held} FD your lease holds toward it.`,
  // Client batch 8b item 28 (the borrower: "100% condition" beside "33% of its life left, no rebuilds", two measures read
  // as one): each named. Condition is the wear since its last rebuild (what a rebuild resets); life is the share of its
  // miles left before it goes for scrap. `conditionSince` on the Dealer's used rows, the lot's line, the used trailers'
  // and the lease rows; `usedLastNamed` in a used truck's confirm when it has no rebuild left.
  conditionSince: (pct: string) => `${pct} condition`,
  usedLastNamed: (make: string, cond: string, life: string) => `A used ${make}: ${cond} condition since its last rebuild, and ${life} of its working life left, with no rebuild to come.`,
  // Client batch 8b item 12 (the exploit hunter: the lot rig's condition was only in the confirm): on the used lot's line.
  lotCondition: (pct: string) => `They come at ${pct} condition`,
  // Client batch 8b item 9 (the exploit hunter: a name of only spaces became the default without a word): under the
  // company name field when what's typed is only spaces; the company isn't started.
  nameBlank: "Give your company a name: spaces alone aren't one.",
  // Client batch 8b item 34 (the middleman: the brokerage's name was prefilled cut mid-word and is fixed for life): under
  // the brokerage's name field, the limit and that it stays.
  nameLimit: (n: number) => `Up to ${n} characters. The name stays for the life of the brokerage.`,
  // Client batch 8a item 57 (the director's ruling A): the first-truck card's one verdict, on the Dealer's card (the Dealer
  // opens on it), its teaser under More, Iuliia's page and What now?. The name says what it prices; the verdict is one of
  // three; the figures sit under "Why" (whyLabel), never beside the verdict; "See it" brings the truck's row into view.
  soundTitle: "A sound first truck",
  soundName: (fd: string) => `To a sound first truck: ${fd} FD`,
  soundBuy: "Buy it now.",
  soundOrder: (date: string) => `Order it now · ready ${date}`,
  // Client batch 8b item 52: the profit chip's sheet, on a leased truck, the row between break-even and the profit.
  lessorOfMargin: (share: string) => `Less the lessor's ${share} of what's over break-even`,
  // Writer 8a: "buy at N FD" read as a price; N is the cash to hold (the price's cash plus the cushion), so "once you have".
  // The director's sound-lot ruling (2026-11-12): how far off, in loads and weeks at the recent average. Since client batch
  // 8c it says this only before the first delivery (no average yet); after, soundNotYetPlan.
  soundNotYet: (fd: string, loads: number | null, weeks: number | null = null) =>
    loads === null ? `Not yet: buy once you have ${fd} FD in cash.` : `Not yet: buy once you have ${fd} FD in cash, about ${loads} ${loads === 1 ? "load" : "loads"}${weeks !== null ? ` and ${weeks} ${weeks === 1 ? "week" : "weeks"}` : ""} from here.`,
  // "For sale", not "on the lot": the card reads the lot's rigs, the used listings and the new rig, and "the lot" names
  // only the first (lotReadyNote, lotButton).
  soundNone: (trailer: string) => `No sound ${trailer} truck for sale today; I'll tell you when one lists.`,
  // Client batch 8c item 70 (the director, director-qa-0241-2026-11-12.md §3): "Not yet" ties each load to the goal and says
  // where the player stands; a bar shows it on the card and Iuliia's page; she marks the quarter points; the listing watch
  // stays. Never a word about buying FD to close the gap.
  soundNotYetPlan: (loads: number, span: string | null, perLoadFd: string, pct: string) =>
    `Not yet: a sound truck is about ${loads} ${loads === 1 ? "load" : "loads"} away at your recent average${span ? `, around ${span}` : ""}. Each load adds about ${perLoadFd} FD toward it. You're ${pct} of the way.`,
  soundProgress: (pct: string) => `${pct} of the way to a sound truck`,
  soundWatch: "I'll tell you when a sound used truck lists for less.",
  // The director's rules H and C (director-playtest-rulings-2026-11-10.md), the load's one wall (board.ts blockReason), in
  // her words; and her warning before an owner-operator cuts their own days off.
  homeUntil: (name: string, back: string, pickup: string) => `${name} is home until ${back}; this pickup is ${pickup}.`,
  pastDueHome: (name: string) => `${name} is past due home: loads toward home only, until you send them home.`,
  cutDaysOff: (days: number) => `You'll go back out with ${days} ${days === 1 ? "day" : "days"} at home; your days-away count won't clear.`,
  cutDaysOffGo: "Go back out",
  cutDaysOffItem: "this load on your days off",
  // Client batch 8d (QA's 8b replay, qa-8b-2026-11-13.md): placeholders for the writer.
  hireUnparks: (n: number) => `Truck ${n} goes back on the road with them.`,
  letGoDoes: (name: string, seated: boolean) => `${name} leaves your company today${seated ? ", and their truck stands empty" : ""}.`,
  letGoRisk: "Taking them back means hiring them again, at whatever they ask then.",
  letGoGo: (name: string) => `Let ${name} go`,
  bidThinLane: "Too few loads like this have cleared on this lane to say where it clears; Book now is the sure price.",
  bidFieldLabel: "Your bid, FD a mile",
  bidChipEmpty: "Bid",
  dispatchedByRules: (n: number) => `${n} ${n === 1 ? "load" : "loads"} dispatched by your rules`,
  soundQuarter: (n: 1 | 2 | 3) => (n === 1 ? "A quarter of the way to your truck." : n === 2 ? "Halfway to your truck." : "Three quarters of the way to your truck."),
  soundListed: (truck: string, fd: string) => `A sound used truck just listed for less: ${truck}, ${fd} FD. It's on your first-truck card.`,
  // Client batch 8c item 69 (the director): a lost bid names what beat it, from the clearing's own terms (board.ts lostWhy).
  lostWhy: (kind: "record" | "nearer" | "home" | "local" | "outright") =>
    kind === "record"
      ? "The shipper chose a carrier with a longer safety record."
      : kind === "nearer"
        ? "The shipper chose a carrier whose truck was nearer the pickup, so it could load sooner."
        : kind === "home"
          ? "The shipper chose a carrier based near the pickup."
          : kind === "local"
            ? "A local carrier took it outright during the locals' first call."
            : "Another carrier took it outright before the round.",
  whyLabel: "Why",
  whyTruck: (truck: string) => `The truck: ${truck}.`,
  whyPrice: (price: string, need: string) => `Price ${price} FD; it takes ${need} FD in cash today.`,
  whyCushion: (after: string, hold: string) => `${after} FD left after it, against the ${hold} FD I'd keep in hand for running costs.`,
  // The writer's flag 2c: which it is, worn, for other freight, or both.
  whyWorn: (truck: string, price: string, kind: "worn" | "freight" | "both" = "worn") => `Cheaper, but ${kind === "worn" ? "worn" : kind === "freight" ? "for other freight" : "worn and for other freight"}: ${truck} at ${price} FD.`,
  // The director's sound-lot ruling (2026-11-12): the lot's rig is the first line under "Why" whenever the lot has one in
  // the company's freight, a fact with its figures; What now? never points at it.
  whyLot: (cond: string, ready: string, cash: string, times: string, month: string) =>
    `A worn rig from the lot: ${cond} condition, ${ready}, about ${cash} FD in cash on a loan. Expect repairs near ${times} a fresh truck's, about ${month} FD a month.`,
  seeIt: "See it",
  // Client batch 8a item 59 (the director's F and C; items 21, 45 and 55): What now?'s new answers. The debt line names
  // the nearest clock: a purchase loan with a payment missed, the truck the lender takes and when, the payment and its
  // day. The home rule with the dispatcher off, from five days ahead and on the day. A breakdown's ask on a load booked
  // ahead. A lost bid's follow-up now names its truck (lostForTruck wraps NOW.lostAction / lostBookAction).
  loanDefaultAction: (missed: number, truck: number | null, date: string) => `${missed} ${missed === 1 ? "payment" : "payments"} missed: the lender takes ${truck === null ? "the truck on order" : `truck ${truck}`} on ${date} if the next one misses.`,
  loanDefaultReason: (fd: string, date: string) => `The next payment is ${fd} FD, on ${date}. Keep that much in cash by then.`,
  loanDefaultButton: "Money",
  // Writer 8a: What now? shows these after "Truck N: " (lostForTruck), so the day's line takes a full stop, not a second colon.
  homeDueAction: (date: string, days: number) => (days === 0 ? "Due home today. Take a load toward home, or Send home." : `Due home ${date} (${days} ${days === 1 ? "day" : "days"}).`),
  // With no load toward home: the engine (board.ts maybeReposition) turns an idle truck due home for home, empty when it's
  // near or has waited a couple of rounds; with the dispatcher off, no one but the player books it a homeward load.
  homeDueReason: (home: string, load: string | null) => (load ? `A load toward ${home} keeps the truck paid: ${load}.` : `With your dispatcher off, only you can book it a load toward ${home}. Once it's due and idle, it heads home empty.`),
  homeDueButton: (load: boolean) => (load ? "Show the load" : "Send home"),
  atRiskAction: (truck: number) => `Truck ${truck} broke down and can't make its next pickup.`,
  // The ask's claim is the early share (windows.ts afterBreakdown); a no-show at the pickup's close is the larger one.
  atRiskReason: (fd: string, by: string) => `Release the load now for a ${fd} FD claim, or keep it: if the truck misses the pickup by ${by}, it's a no-show and a bigger claim.`,
  atRiskButton: "Show the truck",
  lostForTruck: (truck: number, action: string) => `Truck ${truck}: ${action}`,
  // Client batch 8a item 19 (the borrower): the month report's line under its loads line, when the lender took trucks
  // in the month: how many, and what their loans owed when it did (they leave the books with the trucks).
  monthTaken: (n: number, fd: string) => `Taken by the lender: ${n === 1 ? "1 truck" : `${n} trucks`}, closing ${n === 1 ? "a loan" : "loans"} that owed ${fd} FD.`,
  // Client batch 8a item 6: a listed truck or trailer's control to take it off sale (engine withdraw_listing); on the truck's
  // card (its ⋯ on a phone) and the trailer's yard row, beside "for sale at {ask} FD". A truck taken off is parked where
  // it stands; a trailer goes back to the yard.
  forSaleAt: (ask: string) => `For sale at ${ask} FD`,
  takeOffSale: "Take it off sale",
  offSaleTruck: "Off sale: the truck is parked where it stands",
  offSaleTrailer: "Off sale: the trailer is back in your yard",
  // QA's 0.24.1 replay, fail 3: listing a truck takes its crew off it (engine market.ts listTruck), and a driver with no
  // truck to drive for labor.morale.unseatedWeeks weeks quits. The sell confirm says so; off sale puts a free driver
  // standing by it back in and the truck back on the road; What now? sees a parked truck with no driver, or a paid
  // driver sitting in a parked one.
  // The producer (2026-11-12): said plainly, before listing, that the driver leaves the truck, and quits after the weeks
  // with no truck unless seated on another.
  sellCrew: (names: string[], weeks: number) => {
    const who = names.join(" and ");
    return `Listing it takes ${who} off the truck. ${names.length === 1 ? `${who} stays` : "They stay"} on your payroll, and quit${names.length === 1 ? "s" : ""} after ${weeks} weeks with no truck unless you seat ${names.length === 1 ? "them" : "them"} on another. Taking it off sale puts ${names.length === 1 ? who : "them"} back in it.`;
  },
  sellOwnerOff: "Listing it takes you off the truck, free to drive another. Taking it off sale puts you back in it.",
  offSaleBack: (n: number, name: string) => `Off sale: Truck ${n} is back on the road, with ${name} driving`,
  parkedNoDriver: (n: number, place: string) => `Truck ${n} is parked at ${place} with no driver, so it earns nothing.`,
  seatBackAction: (name: string, n: number) => `Put ${name} back in Truck ${n}.`,
  seatBackReason: (name: string, n: number, place: string, weeks: number) =>
    `${name} is on the payroll with no truck, and Truck ${n} stands parked at ${place}. A driver with no truck to drive for ${weeks} weeks quits.`,
  seatBackOwnerReason: (n: number, place: string) => `You have no truck to drive, and Truck ${n} stands parked at ${place}.`,
  seatBackButton: "Back on the road",
  parkedCrewAction: (n: number) => `Put Truck ${n} back on the road.`,
  parkedCrewReason: (name: string, weeks: number) => `${name} is paid to sit in a parked truck, and a driver parked for ${weeks} weeks quits.`,
  // QA's 0.24.1 replay, item 9: home time taken within the home radius (map.nearbyRadiusMi) but not at the home hub.
  homeTimeNear: (home: string, place: string) => `Home time near ${home}, at ${place}`,
  // QA's 0.24.1 replay, fail 2: the walkthrough's first-truck step, as the rules now run (placeholders for the writer's
  // pass after 8b). The lot's rig is worn and ready in its days; the first-truck card names the sound truck; with
  // equipmentFinance.purchase.collateral on, the lender reads the truck's age and miles.
  walkOwnBrief: (share: string) => `The lessor's ${share} ends the day you own a truck. The first-truck card names the sound one and when you can buy it.`,
  walkOwnLot: (share: string, rig: string, lotDays: number | null, cond: string) =>
    `The lessor's ${share} is the most expensive thing you pay and the only one that ends when you own a truck. A new Workhorse with a van is about ${rig} FD. The used lot on Dealer, under More, sells a worn one at about a quarter of that${lotDays !== null ? `, ready ${lotDays} days after you order it` : ""}, at ${cond} condition, so its repairs run well over a fresh truck's. The first-truck card prices the cheapest sound truck you can buy, and says when.`,
  walkOwnLoanCollateral: (down: string, freeYears: number, freeMiles: string, perYear: string, per100k: string, newBiz: string, maxDown: string, declineYears: number, declineMiles: string) =>
    `Your lease deposit counts toward it, and the Dealer's purchase loan covers the rest. The lender reads the truck: ${down} down on one under ${freeYears} years and ${freeMiles} miles, ${perYear} more for each year past that and ${per100k} for each 100,000 miles, ${newBiz} more while your authority is under a year old, never over ${maxDown}. Past ${declineYears} years or ${declineMiles} miles it lends nothing: cash only. Owned trucks pay their own maintenance and insurance, cost you when they sit, and lose value every year. They also keep every dollar they earn.`,
  walkOwnLoanPlain: (down: string) =>
    `Your lease deposit counts toward it, and the Dealer's purchase loan covers the rest with ${down} down. Owned trucks pay their own maintenance and insurance, cost you when they sit, and lose value every year. They also keep every dollar they earn.`,
  walkOwnDo: "Buy the truck the first-truck card names, with a purchase loan if the cash is short.",
  // The live page's refusals (§1, §2). A tab that isn't this player's writer (another tab or device holds the lease, or this
  // one lost it and another holds it now): an order is refused; shown in the order's error toast ("Couldn't send that
  // order: …") and where a tap on a live screen is refused (state.ts act and order).
  // Writer 8a: the reason, both ways it happens (live.ts takeLease: "busy", another tab or device holds the lease; "denied",
  // the store couldn't be reached).
  liveWatching: "This tab is only watching (your company is open in another tab or on another device, or this one lost its connection).",
  // An order whose time would land more than a lead past the shared clock (an earlier order was stamped on a wrong clock):
  // refused, shown in the order's error toast.
  liveClockOff: "This order's time is off the shared clock: reload the page and try again.",
  // The test page's clock stopped on an engine error in an hour (§6): the save stands at the hour before.
  testBroken: "The world hit an error and stopped here. It takes no more orders; your save holds everything up to the hour before.",
  // A restored world whose replay refused some of the saved orders (§6): they're kept in the save, not lost silently.
  testRefusedOnRestore: (n: number) => `When your world reopened, ${n} of your saved ${n === 1 ? "order" : "orders"} couldn't be carried out again; ${n === 1 ? "it's" : "they're"} kept in your save.`,
  newsServiceClaim: (kind: string, load: string, fd: string) => `${kind === "late" ? `Late delivery, load #${load}` : kind === "noshow" ? `No-show, load #${load}` : `Released load #${load}`}: −${fd} FD claim to the poster.`,
} as const;

/** Explanations that replace copy.ts EXPLAIN's (ui/Explain.tsx reads these first); fold in with the rest. */
export const PENDING_EXPLAIN: Record<string, { what: string; how: string; moves: string }> = {
  // The gap left its cushion (client pass 2): the rows are the cheapest truck's cash on the day, the hold, your cash.
  // Client batch 4: the claims row carries the delivery windows' claims too.
  "month.claims": { what: "What you paid in claims: receivers for spoiled or damaged freight, a broker's charge when a posted load found no carrier, and a poster's claim on a load delivered late, never picked up, or released.", how: "Each claim or charge as it was paid; one paid to you counts back here.", moves: "Perishables on time; fewer crashes; an open deck in the weather; booking only what the truck can make; releasing a load early, not at the last minute." },
  "guide.gapToTruck": { what: "How far you are from your next truck.", how: "The cash the cheapest truck takes when you sign (down payment, loan stake and sales tax), less what's held toward your truck, less your cash.", moves: "Hauling; the cheapest truck on offer, which changes; what you spend." },
};
