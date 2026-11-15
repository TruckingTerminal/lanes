/**
 * Engineering's placeholders for the producer's fix batches of 2026-11-15 (the trade-in's Confirm, QA's M4, the player's
 * long runs): the writer words them in one pass. Every figure comes from the engine or the page; these are the frames.
 */
export const FIXES = {
  // The trade-in's Confirm (UX next-screens §3.1): what the truck goes for, where, and that it can't be undone.
  tradeInVerb: "Trade in",
  tradeInDoes: (truck: number, dealer: string, town: string, offer: string, trailer: string | null) => `Trade truck ${truck} in to ${dealer} at ${town} for ${offer} FD.${trailer ? ` ${trailer}` : ""}`,
  tradeInTrailerGoes: (name: string) => `Its ${name} goes with it.`,
  tradeInTrailerBack: (name: string) => `Its ${name} goes back to the lessor.`,
  tradeInRisk: (value: string, share: string, loan: boolean, crew: string | null) => `It can't be undone. The truck is worth ${value} FD; the dealership pays ${share} of that.${loan ? " Its loan is paid off from the price first." : ""}${crew ? ` ${crew}` : ""}`,
  tradeInCrew: (names: string[]) => `${names.join(" and ")} ${names.length === 1 ? "stays" : "stay"} with you, without a truck.`,
  tradeInGo: (offer: string) => `Trade in · ${offer} FD`,
  tradeInDone: (truck: number, offer: string, dealer: string) => `Traded in: Truck ${truck} · +${offer} FD · ${dealer}`,
  // QA's sprint pass (M4.4): on terms that leave the pay waiting, the toast says what's invoiced and when it's due, and
  // the delivery's own costs, which leave now, are chipped.
  paidToastDue: (from: string, to: string, fd: string, due: string) => `Delivered · ${from} → ${to} · ${fd} FD yours, due ${due}`,
  deliveryCosts: "this delivery's costs",
  // QA's sprint pass (M4.5): no bid range when the break-even is at or over the ceiling.
  noBidPays: (be: string, ceiling: string) => `No bid pays: your break-even ${be}/mi is at or over the ceiling ${ceiling}/mi.`,
  // The player's long runs, item 1: the loans on Money, their arrears, and the lender taking a truck.
  loanPayments: "Loan payments",
  loanArrears: (truck: number, missed: number, left: number) => `Truck ${truck}'s loan: ${missed} missed ${missed === 1 ? "payment" : "payments"}. ${left <= 1 ? "One more" : `${left} more`} and the lender takes the truck.`,
  loanArrearsOnOrder: (missed: number, left: number) => `A loan on a truck on order: ${missed} missed ${missed === 1 ? "payment" : "payments"}. ${left <= 1 ? "One more" : `${left} more`} and the lender takes it.`,
  repoTitle: (truck: number) => `The lender took Truck ${truck}`,
  repoSeized: (truck: number, missed: number) => `After ${missed} missed ${missed === 1 ? "payment" : "payments"}, the lender took Truck ${truck}. What it was worth went against the loan; anything over came back to you, with the loan's stake.`,
  repoListed: (truck: number, missed: number) => `After ${missed} missed ${missed === 1 ? "payment" : "payments"}, Equipment Finance repossessed Truck ${truck}. It goes to the used lot; what it sells for pays the loan, and anything over comes to you.`,
  repoSeeLoans: "See the loans",
  // The player's long runs, item 6: a hire the player didn't make.
  autoHired: (name: string, kind: string, wage: string) => `Auto-staff hired ${name}, ${kind}, at ${wage} FD a week.`,
  // The player's long runs, item 8: every fine names its cause; the company-wide ones name no truck.
  fine: {
    tracking: (n: number, fd: string) => `Hours fine, truck ${n}: −${fd} FD; the shipper's tracking showed over 11 hours driving.`,
    defect: (n: number, fd: string) => `Defect fine, truck ${n}: −${fd} FD for a defect found at inspection.`,
    review: (_n: number, fd: string) => `Compliance review fine: −${fd} FD for what the auditor found in the company's records.`,
    doublebroker: (_n: number, fd: string) => `Fine: −${fd} FD for re-posting a load you'd booked (double brokering).`,
  } as Record<string, (n: number, fd: string) => string>,
  monthClaims: "Claims this month",
  monthSoFar: "This month so far",
  // The player's long runs, item 2: why a brokerage gets no new loads, by how much, and what restarts it.
  underStake: (short: string, need: string, have: string, when: string, over: boolean) =>
    `${over ? `No new loads since ${when}` : `No new loads from ${when}`}: the broker licence needs ${need} FD staked and this brokerage has ${have} FD, ${short} FD short. Cash moved in doesn't count; staking the difference does, from the next day.`,
  underStakeGo: (short: string) => `Stake ${short} FD`,
  underStakeDone: "Staked: new loads start again tomorrow",
  refuseMoveStakeBy: (name: string, short: string) => `${name} is ${short} FD under its licence stake. Nothing leaves until it's back above.`,
  // The player's long runs, item 9: the authority pill says why, from the authority's own record.
  authorityWhy: (last: string | null) => (last ? `${last} Tap for the record on Company.` : "Tap for the record on Company."),
  staffKind: { driver: "driver", dispatcher: "dispatcher", opsManager: "operations manager", maintManager: "maintenance manager", ceo: "chief executive", securityManager: "security manager", salesRep: "sales rep" } as Record<string, string>,
};
