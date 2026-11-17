/**
 * Engineering's placeholders for the producer's fix batches of 2026-11-15 (the trade-in's Confirm, QA's M4, the player's
 * long runs): the writer words them in one pass. Every figure comes from the engine or the page; these are the frames.
 */
export const FIXES = {
  // The shared checkpoint (keeper.ts; the red team's checkpoint review, finding 5): one of the player's own orders reached
  // the store only after the day's cut had been kept without it, so no page ever carries it out.
  orderTooLate: (order: string) => `Your order (${order}) reached the world too late and wasn't carried out. Give it again if you still want it.`,
  // The trade-in's Confirm (UX next-screens §3.1): what the truck goes for, where, and that it can't be undone.
  tradeInVerb: "Trade in",
  tradeInDoes: (truck: number, dealer: string, town: string, offer: string, trailer: string | null) => `Trade Truck ${truck} in to ${dealer} at ${town} for ${offer} FD.${trailer ? ` ${trailer}` : ""}`,
  tradeInTrailerGoes: (name: string) => `Its ${name} goes with it.`,
  tradeInTrailerBack: (name: string) => `Its ${name} goes back to the lessor.`,
  tradeInRisk: (value: string, share: string, loan: boolean, crew: string | null) => `This can't be undone. The truck is worth ${value} FD, and the dealership pays ${share} of that.${loan ? " Its loan is paid off from the price first, and you get the rest." : ""}${crew ? ` ${crew}` : ""}`,
  tradeInCrew: (names: string[]) => `${names.join(" and ")} ${names.length === 1 ? "stays" : "stay"} with you, without a truck.`,
  tradeInGo: (offer: string) => `Trade in · ${offer} FD`,
  tradeInDone: (truck: number, offer: string, dealer: string) => `Truck ${truck} traded in to ${dealer} for ${offer} FD.`,
  // QA's sprint pass (M4.4): on terms that leave the pay waiting, the toast says what's invoiced and when it's due, and
  // the delivery's own costs, which leave now, are chipped.
  paidToastDue: (from: string, to: string, fd: string, due: string) => `Delivered · ${from} → ${to} · ${fd} FD yours, due ${due}`,
  deliveryCosts: "this delivery's costs",
  // QA's sprint pass (M4.5): no bid range when the break-even is at or over the ceiling.
  noBidPays: (be: string, ceiling: string) => `No bid pays here: your break-even, ${be}/mi, is at or over the ceiling, ${ceiling}/mi.`,
  // The player's long runs, item 1: the loans on Money, their arrears, and the lender taking a truck.
  loanPayments: "Loan payments",
  loanArrears: (truck: number, missed: number, left: number) => `Truck ${truck}'s loan: ${missed} missed ${missed === 1 ? "payment" : "payments"}. ${left <= 1 ? "One more" : `${left} more`} and the lender takes the truck.`,
  loanArrearsOnOrder: (missed: number, left: number) => `A loan on a truck on order: ${missed} missed ${missed === 1 ? "payment" : "payments"}. ${left <= 1 ? "One more" : `${left} more`} and the lender takes it.`,
  repoTitle: (truck: number) => `The lender took Truck ${truck}`,
  repoSeized: (truck: number, missed: number) => `After ${missed} missed ${missed === 1 ? "payment" : "payments"}, the lender took Truck ${truck} and closed its loan. What the truck was worth went against what was owed. Today's news has the figures: anything that came back to you, and what became of the loan's stake.`,
  repoListed: (truck: number, missed: number) => `After ${missed} missed ${missed === 1 ? "payment" : "payments"}, Equipment Finance took Truck ${truck} back. It's for sale on the used lot now: what it sells for pays off the loan, and anything over comes to you.`,
  repoSeeLoans: "See your loans",
  // The player's long runs, item 6: a hire the player didn't make.
  autoHired: (name: string, kind: string, wage: string) => `Auto-staff hired ${name}, ${kind}, at ${wage} FD a week.`,
  // The player's long runs, item 8: every fine names its cause; the company-wide ones name no truck.
  fine: {
    tracking: (n: number, fd: string) => `Hours fine, Truck ${n}: −${fd} FD. The shipper's tracking showed it driving past the legal hours.`,
    defect: (n: number, fd: string) => `Defect fine, Truck ${n}: −${fd} FD for a defect an inspector found.`,
    review: (_n: number, fd: string) => `Compliance review fine: −${fd} FD for what the auditor found in your records.`,
    doublebroker: (_n: number, fd: string) => `Double-brokering fine: −${fd} FD for passing a load you'd booked to another carrier.`,
  } as Record<string, (n: number, fd: string) => string>,
  monthClaims: "Claims this month",
  monthSoFar: "This month so far",
  // Engineering's placeholders for the writer (QA's 0.25.2 replay): a release past the cash under claims in full, and a
  // release's claim in the month card, which goes to no one (the load is back on the board).
  releaseIntoDebt: (fd: string) => `This puts the company ${fd} FD into debt: the claim is paid in full, like any bill.`,
  newsReleaseClaim: (load: string, fd: string) => `Released load #${load}: −${fd} FD claim.`,
  autoHiredPerMile: (name: string, kind: string, rate: string) => `Auto-staff hired ${name}, ${kind}, at ${rate} FD a mile.`,
  // The player's long runs, item 2: why a brokerage gets no new loads, by how much, and what restarts it.
  underStake: (short: string, need: string, have: string, when: string, over: boolean) =>
    `No new loads while this brokerage is under its licence stake: the licence needs ${need} FD staked and it has ${have} FD, ${short} FD short. Cash moved in doesn't count; staking the difference does. ${over ? `Its grace ended ${when}, so new loads start again the day after you stake.` : `Stake it by ${when} and new loads start again at once; after that, the day after you stake.`}`,
  underStakeGo: (short: string) => `Stake ${short} FD`,
  underStakeDone: "Staked: the brokerage is back at its licence stake.",
  refuseMoveStakeBy: (name: string, short: string) => `${name} is ${short} FD under its licence stake. Nothing leaves it until it's back at its stake.`,
  // The player's long runs, item 9: the authority pill says why, from the authority's own record.
  authorityWhy: (last: string | null) => (last ? `${last} Tap to see the record on the Company page.` : "Tap to see the record on the Company page."),
  staffKind: { driver: "driver", dispatcher: "dispatcher", opsManager: "operations manager", maintManager: "maintenance manager", ceo: "chief executive", securityManager: "security manager", salesRep: "sales rep" } as Record<string, string>,
  // Engineering's placeholders for the writer: releasing the current load before pickup (windows.releaseCurrent; the
  // director's sprint §1), on the truck card's Now line and its Confirm.
  headingTo: (town: string, by: string) => `Heading to ${town} · pick up by ${by}`,
  // Engineering's placeholders for the writer: the bus to a truck (labor.busToTruck; the director's sprint §19 and §20).
  sendByBus: "Send by bus",
  sendSelect: "Truck to send them to",
  sendOption: (truck: number, town: string, time: string, fd: string) => `Truck ${truck} at ${town} · ${time} · ${fd} FD`,
  sendButton: (name: string | null, from: string, time: string, fd: string) => `Send ${name ?? "yourself"} from ${from} · ${time} · ${fd} FD`,
  rideDays: (n: number) => (n <= 1 ? "about a day" : `about ${n} days`),
  sentToast: (name: string | null, town: string) => `${name === null ? "You're" : `${name} is`} on the bus to ${town}`,
  riderOnWay: (name: string | null, day: string) => `${name === null ? "You're" : `${name} is`} on the bus here, arriving ${day}.`,
  // Engineering's placeholder for the writer (QA's 0.25.5 replay, item 3): the Staff row of a driver riding the bus to a
  // truck (labor.busToTruck): the town the truck waits in, and the day they arrive.
  onBusTo: (town: string, day: string) => `on the bus to ${town} · arriving ${day}`,
  // …and its status chip, in place of "home" (the rider is on the road to the truck, not home).
  busChip: "on the bus",
  // Engineering's drafts for the writer: the director's ruling 22, a young market says so, by the world's age only (under
  // 42 days from its day 0). Under the country line, on the hub list and a hub's page; and Julia's line, once on each
  // loan and lease sheet, under "Weekly payment". No figure for how far rates will fall.
  youngMarket: (days: number) => `This market opened ${days === 0 ? "today" : days === 1 ? "a day ago" : `${days} days ago`}. Opening rates run high while trucks catch up with the freight, and they fall back over the first six weeks.`,
  iuliiaYoungRates: "Rates are still in the market's opening weeks, and they run high. Check this payment against lower ones.",
  hireAt: (town: string) => `Hire at ${town}`,
  hireRides: (name: string, from: string, time: string, fd: string) => `${name} is at ${from}, so the bus here comes first: ${time} and ${fd} FD, which you pay.`,
  // Engineering's placeholders for the writer: QA's 0.25.3 replay (qa-0253-2026-11-15.md, fix soon and lower).
  // A load this company released, back on the board: the card's chip and the sheet's reason.
  releasedByYou: "You released this load, so you can't book it again.",
  // The sell Confirm with the bus home on, the truck away from home: the crew takes the bus home (at once with auto-staff,
  // else after a day), so off sale puts them back in it only before then.
  sellCrewAway: (names: string[], weeks: number, atOnce: boolean, bus = false) => {
    const who = names.join(" and ");
    const one = names.length === 1;
    return `Listing it takes ${who} off the truck, away from home, so ${one ? `${who} takes` : "they take"} the bus home${atOnce ? "" : " after a day"}. ${one ? `${who} stays` : "They stay"} on your payroll and quit${one ? "s" : ""} after ${weeks} weeks with no truck unless you seat them on another${bus ? " or send them by bus to one" : ""}.${atOnce ? "" : ` Taking it off sale before then puts ${one ? who : "them"} back in it.`}`;
  },
  sellOwnerAway: (atOnce: boolean) => `Listing it takes you off the truck, away from home, so you take the bus home${atOnce ? "" : " after a day"}.${atOnce ? "" : " Taking it off sale before then puts you back in it."}`,
  // The hire Confirm for a dispatcher or a manager: a weekly wage, not per mile.
  hireWeekly: (name: string, fd: string) => `Hires ${name}: a weekly wage, ${fd} FD a week.`,
  // The let-go Confirm within the hiring month: the engine's severance (labor.hiring).
  letGoSeverance: (fd: string, weeks: number, days: number) => `${fd} FD of severance: ${weeks} weeks' pay, let go within ${days} days of hiring.`,
  // Engineering's placeholders for the writer: the director's ruling 17 (labor.dueHomePlan), a load booked ahead goes before
  // a due driver's days off. The board's chip when a booking would be held for days off that end after the pickup closes,
  // and the booking sheet's line, in "What you're agreeing to", when the driver comes due by the pickup's day.
  cantDaysOff: (truck: number, until: string, pickup: string) => `Truck ${truck}'s days off run to ${until}, past this load's ${pickup} pickup.`,
  dueFirst: (name: string | null, day: string) =>
    name === null
      ? `You're due home ${day}. This load comes first; your days off start once you're home with nothing booked.`
      : `${name} is due home ${day}. This load comes first; the days off start once the truck is home with nothing booked.`,
  dueToday: "today",
  // The red team's 0.25.3 pass, finding 3: waiting at the shipper's dock before the load is ready, still releasable.
  waitingAtDock: (town: string, ready: string) => `At the dock in ${town} · the load is ready ${ready}`,
  // QA's 0.25.6 pass: at a receiver that was shut when the truck arrived, the card said "Unloading at Provo" for the whole
  // 11 h wait. It waits for the opening first (windowsui.ts shutDockOpens).
  waitingForDock: (town: string, opens: string) => `Waiting at ${town} for the dock to open ${opens}`,
  releaseCurrentDoes: (from: string, to: string, truck: number, town: string, sunkMi: string | null) =>
    `${from} → ${to} goes back on the board, and Truck ${truck} stops at ${town}, the nearest town${sunkMi ? `; its ${sunkMi} empty miles so far earn nothing` : ""}.`,
  releaseCurrentRisk: "It's also a mark on your record, and you can't book this load again.",
  // Engineering's placeholders for the writer: the bought truck's hand-over (assets.handOverAtTruck; the director's sprint §6).
  handOverAt: (town: string, mi: number, truck: number) => (mi < 1 ? `At ${town}, where Truck ${truck} is.` : `At ${town}, ${mi.toLocaleString("en-US")} mi from Truck ${truck}.`),
  handOverReady: (town: string, mi: string) => `Your new truck is ready at ${town}, ${mi} mi away.`,
  handOverWhy: (truck: number) => `Bring Truck ${truck} to the hand-over: the lease and the lessor's cut run until it's turned in there.`,
  handOverGo: (fd: string, time: string) => `Go to the hand-over · about ${fd} FD · ${time}`,
  handOverSent: "On the way to the hand-over",
  // Engineering's placeholders for the writer: reputation in three parts (reputation.threeParts; the writer's drafts in
  // writer-sprint-2026-11-15.md §1, the director's display). The order of failures is fixed; only the non-zero are named.
  repLine: (rep: string, safety: string, service: string, experience: string) => `Reputation ${rep}: ${safety} · ${service} · ${experience}`,
  repSafetyClean: "safety record clean",
  repRated: (rating: string) => `rated ${rating}`,
  repAlert: (basic: string) => `an alert in ${basic}`,
  repRecord: (violations: number, crashes: number) =>
    [violations ? `${violations === 1 ? "1 violation" : `${violations} violations`}` : "", crashes ? (crashes === 1 ? "a crash" : `${crashes} crashes`) : ""].filter(Boolean).join(" and ") + " in two years",
  repService: (late: number, releases: number, noShows: number, claims: number, days: number) => {
    const parts = [late ? (late === 1 ? "1 late delivery" : `${late} late deliveries`) : "", releases ? (releases === 1 ? "1 release" : `${releases} releases`) : "", noShows ? (noShows === 1 ? "a no-show" : `${noShows} no-shows`) : "", claims ? (claims === 1 ? "a claim" : `${claims} claims`) : ""].filter(Boolean);
    const said = parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
    return parts.length ? `${said} in ${days} days` : `no failures in ${days} days`;
  },
  repExperience: (loads: number, cap: number) => (loads >= cap ? `full experience, ${cap}+ recent loads` : `${loads} of ${cap} recent loads`),
  repPartSafety: (words: string) => `Safety record: ${words}`,
  repPartService: (words: string) => `Service: ${words}`,
  repPartExperience: (words: string) => `Experience: ${words}`,
  // Engineering's placeholders for the writer: QA's 0.25.4 replay. The reputation sheet with three parts on, after the
  // guide's Reputation page: what it is, how it's computed, what moves it.
  repExplain: (safety: string, service: string, experience: string, cap: number) => ({
    what: "How brokers and shippers rate you when they choose a carrier.",
    how: `It starts from 100% and loses up to three parts: the safety record, up to ${safety}; service failures, up to ${service}; and experience, up to ${experience}, until ${cap} recent loads give full experience.`,
    moves: "A clean safety record: violations per inspection and at-fault crashes per truck. Service: no-shows, releases, deliveries past Deliver by and cargo claims, fading over weeks. Experience: loads paid by NPC shippers and brokers (never your own freight), fading over months.",
  }),
  // The Deposit sheet: the room chip stops at the cash; an amount over the cash says why DEPOSIT is grey.
  chipAllCash: (fd: string) => `All your cash · ${fd}`,
  depositOverCash: (fd: string) => `That's more than your cash: you have ${fd} FD.`,
  // Engineering's placeholders for the writer (its §15 item 4): the debt countdown's explain rows with countReserve on.
  explainReserveRow: "The Reserve, and what's settling out of it",
  explainTogetherRow: "Cash and the Reserve together",
  // A release Confirm, booked ahead or current: the standing it costs, as the booking sheet's line says it.
  releaseStanding: (n: number, market: string) => `It also takes ${n === 1 ? "one load" : n === 2 ? "two loads" : `${n} loads`} off your ${market} standing.`,
  // A weekly day named on that day itself means the next one ("next Monday's review").
  nextDay: (day: string) => `next ${day}`,
  // Engineering's placeholder for the writer: the director's ruling 21 (windows.fullOpenDay). The load sheet's one line when
  // the pickup window spans days the shipper's dock is shut: the town, the shut days, and the loading day and hours.
  dockShut: (town: string, days: string, day: string, open: string, close: string) => `${town}'s dock is shut ${days}: loading ${day} ${open}–${close}.`,
  // …and §24's other case: the window clipped where the dock shuts inside it.
  dockShuts: (town: string, shuts: string, opens: string) => `${town}'s dock shuts ${shuts} until ${opens}.`,
  // Engineering's draft for the writer, the director's §28 (windows.fullOpenDay "move"): a load made ready at the dock's
  // next opening.
  dockShutsReady: (town: string, shuts: string, opens: string) => `${town}'s dock shuts ${shuts} until ${opens}: ready ${opens}.`,
  // The director's §26 and §29 (detention.fromOpening): under the booking's dock warning, a wait at a shut dock, at the
  // shipper or the receiver, is the carrier's own time. No pay is promised: every wait the engine sees ends at the opening.
  dockWaitUnpaid: "Waiting until a dock opens is your own time.",
  // Engineering's placeholders for the writer: the bus home (ruleset 0.25.3, labor.busHome; the director's sprint §9).
  onBus: (day: string) => `on the bus home · home ${day}`,
  awayBus: (who: string, from: string, hours: number, fd: string, day: string) => `${who} had no truck at ${from} and took the bus home: about ${hours} h and ${fd} FD, home ${day}.`,
  // Engineering's placeholders for the writer: the market's renewal (brokerRisk.entry and the wind-ups; the director's §3
  // and §16). An AI brokerage that entered by conditions, on its loads and its card while it's new; and the monthly
  // report's counts, in its Companies section.
  newBroker: (since: string) => `New broker · since ${since}`,
  // The writer: "independent", since a bot carrier's own brokerage is AI too (Intel marks it so) and counts with the
  // carriers' own rows below, not these.
  reportFounded: "Independent brokerages founded",
  reportOpened: "Independent brokerages opened",
  reportBrokersWoundUp: "Independent brokerages wound up",
  reportFleetsWoundUp: "AI fleets wound up",
  // Engineering's drafts for the writer: the director's players-first ruling (director-broker-players-2026-11-15.md). §2,
  // the brokerage screen before forming: the readings that found an AI brokerage, over the lines and under them.
  brokersMarketOpen: (ratio: string, margin: string, pending: number, by: string | null) =>
    `Brokers' market: freight per broker ${ratio} the opening's, margins ${margin}.${pending > 0 && by ? ` ${pending === 1 ? "One new brokerage is" : `${cap(numberWord(pending))} new brokerages are`} being set up, opening by ${by}.` : ""}`,
  brokersMarketCrowded: (ratio: string, margin: string) => `Brokers' market: freight per broker ${ratio} the opening's, margins ${margin}: no room for a new brokerage.`,
  // …and Julia's line under it (for her lines when the writer wires it).
  iuliiaNewBrokerage: "A new brokerage starts small. Shippers send it more as it pays carriers on time.",
  // §3: before the carrier can afford a brokerage.
  brokeragePath: (cost: string, bond: string, start: string, feePct: string, cash: string) => `Opening a brokerage takes about ${cost} FD: the ${bond} bond, the licence, ${start} to start trading and the ${feePct} fee. Your carrier has ${cash} FD.`,
  // §2's hint in What now? (the opportunity, the lowest tier).
  hintBrokerAction: (cost: string, start: string) => `You could open a brokerage: about ${cost} FD from your carrier, ${start} of it to start trading.`,
  hintBrokerReason: "Shippers have more freight than brokers to move it.",
  hintBrokerButton: "See how",
  // §2, the monthly report, in the trade paper's voice: the reading at the close, then the brokerages opened, a carrier's
  // (a player's) counted apart; and its rows.
  reportBrokersOpen: (up: string, margin: string) => `Shippers have more freight than brokers to move it: freight per broker is up ${up} on the opening, and margins hold at ${margin}.`,
  reportBrokersCrowded: (ratio: string, margin: string) => `There's no room for another brokerage: freight per broker is ${ratio} the opening's, and margins are ${margin}.`,
  reportBrokersOpened: (n: number, players: number) =>
    n === 0 ? "No brokerage opened this month." : `${cap(numberWord(n))} ${n === 1 ? "brokerage" : "brokerages"} opened this month${players === 0 ? "" : players === n ? (n === 1 ? ", a carrier's own" : ", all of them carriers' own") : `, ${numberWord(players)} of them carriers' own`}.`,
  // The writer: the engine counts every carrier's brokerage here, bots' pairs included (§25), so "carriers' own", not
  // "players'".
  reportPlayersOpened: "Carriers' own brokerages opened",
  reportPlayersStopped: "Carriers' own brokerages stopped trading",
};

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
