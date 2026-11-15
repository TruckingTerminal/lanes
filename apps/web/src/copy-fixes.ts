/**
 * Engineering's placeholders for the producer's fix batches of 2026-11-15 (the trade-in's Confirm, QA's M4, the player's
 * long runs): the writer words them in one pass. Every figure comes from the engine or the page; these are the frames.
 */
export const FIXES = {
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
  releaseCurrentDoes: (from: string, to: string, truck: number, town: string, sunkMi: string | null) =>
    `${from} → ${to} goes back on the board, and Truck ${truck} stops at ${town}${sunkMi ? `: its ${sunkMi} empty miles so far are sunk` : ""}.`,
  releaseCurrentRisk: "It's also a mark on your record, and you can't book this load again.",
  // Engineering's placeholders for the writer: the bus home (ruleset 0.25.3, labor.busHome; the director's sprint §9).
  onBus: (day: string) => `on the bus home · home ${day}`,
  awayBus: (who: string, from: string, hours: number, fd: string, day: string) => `No truck for ${who} at ${from}: the bus home, about ${hours} h and ${fd} FD, home ${day}.`,
};
