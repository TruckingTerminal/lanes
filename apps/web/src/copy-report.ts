/**
 * The public monthly report's words ("The freight economy" on Intel; the director's order and voice, studio/reviews/
 * director-eve.md §2): placeholders for the writer, who words them in one pass. A plain trade-paper voice, figures first,
 * no jokes; it's a publication, not Iuliia. Her one line above it is hers.
 */
export const REPORT = {
  title: (month: string, year: number) => `The freight economy · ${month}, Year ${year}`,
  none: "The first report comes out when the first month closes.",
  read: "Read the report",
  colNow: "This month",
  colPrior: "Last month",
  colYear: "A year ago",
  secFreight: "Freight",
  secTrucks: "Trucks",
  secCompanies: "Companies",
  secWork: "Work",
  secMoney: "Money",
  secWealth: "Wealth, in bands",
  secAnnounced: "Next month's announced changes",
  noneAnnounced: "None announced.",
  // Freight
  posted: "Loads posted",
  cleared: "Loads cleared",
  lost: "Loads lost or given up",
  rateIndex: (trailer: string) => `${trailer} rate, FD a loaded mile (index, first month 100)`,
  onTime: "Delivered on time",
  volumeLever: "The cap's volume lever",
  // Trucks
  newIndex: (tier: string) => `New ${tier} price index`,
  usedSold: "Used trucks sold",
  usedOverBook: "Used price over book value",
  scrapped: "Tractors scrapped",
  writtenOff: "Tractors written off",
  destroyed: "Book value destroyed, FD",
  repossessed: "Trucks repossessed",
  // Companies
  carriers: "Carriers trading",
  inService: "Trucks in service",
  started: "Companies started",
  bankruptcies: "Bankruptcies",
  liquidating: "Being wound up",
  inDebt: "Companies in debt",
  owed: "What they owe, FD",
  // Work
  drivers: "Drivers employed",
  pool: "Drivers looking for work",
  wageIndex: "Wage index",
  // Money
  circulation: "FD in circulation",
  reserve: "The reserve",
  inTotal: "Came in, FD",
  outTotal: "Went out, FD",
  net: "Net, FD",
  burned: "Burned this month, FD",
  settlement: "Settlement fees, gone from the economy, FD",
  emission: "Freight pay against the published budget",
  inKind: (kind: string) => `In: ${kind}`,
  outKind: (kind: string) => `Out: ${kind}`,
  // Wealth
  gini: "Concentration (Gini)",
  top1: "Held by the top 1%",
  top10: "Held by the top 10%",
  median: (segment: string) => `The median ${segment}'s holdings, FD`,
  segment: { ownerOperator: "owner-operator", fleet: "fleet", broker: "broker" } as Record<string, string>,
  // Iuliia's line above it, for this player's freight.
  iuliia: (trailer: string, dir: "up" | "down" | "flat", pct: string) =>
    dir === "flat" ? `${trailer} rates held level on last month; that's your freight.` : `${trailer} rates are ${dir} ${pct} on last month; that's your freight.`,
};
