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
  home: "Before a truck, you need a home. The three ringed cities can be one; tap any other to see its freight.",
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

/** The starter hubs' character lines and default company names; any other hub: no line and no default name. */
export const STARTERS: Record<string, { character: string; name: string }> = {
  DAL: { character: "The middle of the country. Freight leaves in every direction, and so will you.", name: "Trinity River Freight" },
  LAX: { character: "The ports, day and night. Plenty of van freight out, crowded, and dear to insure.", name: "Harbor Gate Transport" },
  PHX: { character: "More trucks come in than freight goes out, but locals get first call and living here is cheap.", name: "Saguaro Line Freight" },
  CHI: { character: "Where the rails and the interstates meet. Freight to anywhere, most of the year.", name: "Lakefront Hauling" },
};
export const defaultName = (id: string): string => STARTERS[id]?.name ?? "";

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
  /** A hub that can't be a home (the engine lets only the starter hubs be one, game.ts joinCompany). */
  notStarter: (hub: string) => `${hub} is a fine place to deliver to, not yet a place to live. The ringed cities are.`,
};

export const ARRIVAL = {
  line: (hub: string, share: string) => `This is ${hub}, your home. One leased Workhorse, a dry van, and you driving. The lessor keeps ${share} of every load. Let's find one.`,
  showBoard: "Show me the board",
  finding: (hub: string) => `Finding ${hub}…`,
  you: "You",
};

/** The board, the load and the round (copy-first-ten-minutes.md, S2–S5). */
export const BOARD = {
  header: (hub: string, n: number, next: string) => `Loads from ${hub} · ${n} · next round ${next}`,
  truck: (n: number, trailer: string) => `Truck ${n} · ${trailer}`,
  line1: (from: string, to: string, miles: string) => `${from} → ${to} · ${miles} mi`,
  line2: (total: string, rate: string, dh: number) => `${total} FD · ${rate}/mi · ${dh} mi empty`,
  chipBook: (profit: string, positive: boolean) => (positive ? `+${profit} FD at book-now` : `−${profit} FD at book-now`),
  chipSuggest: (profit: string, rate: string) => `+${profit} FD at ${rate}`,
  sorts: { nearest: "Nearest", pay: "Best pay", deliver: "Deliver by" },
  filter: "Filter",
  destination: "Destination",
  anywhere: "Anywhere",
  maxEmpty: "Empty miles, max",
  query: "Commodity or place",
  queryPlaceholder: "produce, Tulsa",
  ratesByHub: "Rates by hub",
  table: "Table",
  busy: (eta: string) => `Your truck is on the road · loads show when it's free · ETA ${eta}`,
  nothing: (trailer: string, maxDh: number, hub: string, next: string) => `Nothing for a ${trailer} within ${maxDh} mi of ${hub} this round · next round ${next}`,
  widen: "Widen the search",
};

export const LOAD = {
  back: "Loads",
  route: "Route",
  pickUp: "Pick up",
  deliverBy: "Deliver by",
  miles: "Miles",
  milesValue: (loaded: string, empty: number) => `${loaded} loaded · ${empty} empty`,
  driving: "Driving",
  reloadAt: (dest: string) => `Reload at ${dest}`,
  reloadValue: (word: string, mi: number) => `${word} · about ${mi} mi empty to the next`,
  money: "The money",
  bookNow: "Book now",
  breakEven: "Your break-even",
  profitBook: "Profit at book-now",
  clearsNear: "Usually clears near",
  ceiling: "Ceiling",
  shipper: "Shipper",
  onTime: "On time",
  vetting: "Vetting",
  more: "More about this load",
  commodity: "Commodity",
  cargoValue: "Cargo value",
  tolls: "Tolls",
  none: "none",
  twoLane: "Two-lane",
  season: "Season",
  loadNo: (id: number) => `Load #${id}`,
  bookButton: (rate: string, profit: string) => `Book now · ${rate}/mi · ${profit} FD`,
  bidButton: (profit: string) => `Bid · ${profit} FD`,
  range: (lo: string, hi: string) => `range ${lo}–${hi}`,
  changeBid: "Change bid",
  withdraw: "Withdraw",
  sent: (at: string) => `Sent · in effect ${at}`,
  blocked: (reason: string) => `Not yet: ${reason}.`,
};

export const ROUND = {
  pinned: (rate: string, clears: string, wait: string) => `Your bid · ${rate}/mi · clears ${clears} · in ${wait}`,
  booked: (from: string, to: string, total: string) => `Booked · ${from} → ${to} · ${total} FD`,
  won: (from: string, to: string, rate: string, total: string) => `Won ${from} → ${to} at ${rate}/mi · ${total} FD`,
  lost: (winning: string, rate: string, be: string) => `Lost to ${winning}/mi · your bid ${rate} · your break-even ${be}`,
  nobody: (rate: string) => `Nobody took it this round · your bid ${rate}`,
  ok: "OK",
  bidAgain: "Bid again",
  toastBid: (rate: string, clears: string) => `Bid in at ${rate}/mi. It clears at ${clears}.`,
  toastBooked: "Booked. The truck is on its way.",
  toastWithdrawn: "Bid withdrawn.",
};
