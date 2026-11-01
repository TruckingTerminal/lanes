/**
 * The first ten minutes' words (studio/specs/copy-first-ten-minutes.md, draft 4), in one place so the writer's next
 * pass is one file. Numbers come in as arguments from the config or the world; none is typed here.
 */

export const LOGIN = {
  signIn: "Sign in",
  enter: "Enter the world",
  continueLive: (company: string) => `Continue · ${company}`,
  connecting: "Connecting…",
  unreachable: "Can't reach the world · Retry",
  continueTest: (company: string, day: number) => `Continue · ${company}, day ${day}`,
  newTest: "New test world",
  replaces: (company: string) => `This replaces ${company}.`,
  replace: "Replace it",
  keep: "Keep it",
  starting: "Starting the world…",
  report: "Report a bug or an idea",
  fullScreen: "Full screen",
};

export const FIRST_ENTRY = {
  nextRound: (hhmm: string) => `Next round ${hhmm}`,
  welcome: "Welcome. Iuliia, with two i's; my mother was thorough. This is the market, live, and nobody waits for us.",
  next: "Next",
  home: "Before a truck, you need a home. Three good ones are ringed. Tap one, or any city you like.",
  allHubs: "All hubs",
  allHubsHeader: "All hubs · busiest first",
};

export const HUB_CARD = {
  freightNow: "Freight now",
  posted: (n: number, rate: string) => `${n} loads posted last round · ${rate}/mi average`,
  perTruck: (x: string, word: string) => `${x} loads per truck · ${word}`,
  ships: (word: "more than" | "about what" | "less than") => `Ships ${word} it receives`,
  reload: (word: "easy" | "fair" | "hard") => `Reload: ${word}`,
  whosHere: "Who's here",
  carriers: (word: string) => `Carriers based here: ${word}`,
  locals: (pct: string) => `Shippers hold ${pct} of van loads for locals first`,
  costs: "What it costs to live here",
  insurance: (pct: string, side: "above" | "below" | null) => (side ? `Insurance: ${pct} ${side} the base rate` : "Insurance: at the base rate"),
  yard: (fd: string) => `Yard: ${fd} FD a week per truck past the first`,
  theft: (times: string) => `Cargo theft: ${times} a quiet road's`,
  outbound: "Outbound by trailer",
  seeBoard: "See the board",
  startHere: "Start here",
  boardFooter: "Start here to bid on these.",
  back: "Back",
};

/** The season line (the writer's words; the state is the economy designer's measure, see `seasonState`). */
export const SEASON = {
  thin: (month: string) => `Freight is thin here in ${month}. A new carrier waits.`,
  littleThin: (month: string) => `A little thin in ${month}; the good loads go early.`,
  fine: (month: string) => `Freight is good here in ${month}.`,
  busy: (hub: string, month: string) => `Busy season out of ${hub} in ${month}.`,
};

/** The starter hubs' character lines and default company names; any other hub: no line, "{hub} Freight". */
export const STARTERS: Record<string, { character: string; name: string }> = {
  DAL: { character: "The middle of the country. Freight leaves in every direction, and so will you.", name: "Trinity River Freight" },
  LAX: { character: "The ports, day and night. Plenty of van freight out, crowded, and dear to insure.", name: "Harbor Gate Transport" },
  PHX: { character: "More trucks come in than freight goes out, but locals get first call and living here is cheap.", name: "Saguaro Line Freight" },
  CHI: { character: "Where the rails and the interstates meet. Freight to anywhere, most of the year.", name: "Lakefront Hauling" },
};
export const defaultName = (id: string, hubName: string): string => STARTERS[id]?.name ?? `${hubName} Freight`;

export const NAMING = {
  line: (hub: string) => `${hub}. Good. Home is where this company stays. What do we call it?`,
  field: "Company name",
  howYouStart: "How you start",
  ownerOperator: "Owner-operator.",
  ownerOperatorNote: "The live world's start.",
  smallFleet: "Small fleet.",
  smallFleetNote: (fd: string) => `Two used trucks and ${fd} FD, to test the fleet game.`,
  start: (hub: string) => `Start at ${hub}`,
  back: "Back",
  opening: "Opening your authority…",
  /** Not in the copy spec yet: the engine lets only the starter hubs be a home (game.ts joinCompany). */
  notStarter: "Only the ringed and listed starter hubs can be a home for now.",
};

export const ARRIVAL = {
  line: (hub: string, share: string) => `This is ${hub}, your home. One leased Workhorse, a dry van, and you driving. The lessor keeps ${share} of every load. Let's find one.`,
  showBoard: "Show me the board",
  finding: (hub: string) => `Finding ${hub}…`,
  you: "You",
};
