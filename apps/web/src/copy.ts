import type { EconomyConfig } from "@lanes/config";
/**
 * The first ten minutes' words (studio/specs/copy-first-ten-minutes.md, draft 4), in one place so the writer's next
 * pass is one file. Numbers come in as arguments from the config or the world; none is typed here.
 */

/**
 * The confirm card (the writer's copy-player2.md, R6): before anything that can't be undone, or that spends more than
 * guard.confirmShareOfCash of cash. Its frame, then what it does and its one risk by action.
 */
export const CONFIRM = {
  title: (verb: string, item: string) => `${verb} ${item}?`,
  cost: (fd: string) => `It costs · ${fd} FD`,
  after: (fd: string, n: string) => `Left after · ${fd} FD, ${n} weeks of cushion`,
  /** The writer's (QA's R6 replay): before the first week closes there's no cushion figure, and a spend cash can't cover. */
  afterNoWeeks: (fd: string) => `Left after · ${fd} FD · no cushion yet: your first week hasn't closed`,
  short: (cost: string, have: string) => `It costs ${cost} FD: you have ${have}.`,
  does: "What it does",
  risk: "The one risk",
  go: (verb: string, fd: string) => `${verb} · ${fd} FD`,
  cancel: "Not now",
  lowCushion: (n: number) => `Under ${n} weeks of cushion after this.`,
  usedFresh: (make: string, pct: string, n: number) => `A used ${make}: ${pct} condition, ${n === 1 ? "1 rebuild" : `${n} rebuilds`} left.`,
  usedFreshRisk: (fd: string) => `Worn trucks break down more, usually far from home. A rebuild costs ${fd} FD.`,
  usedLast: (make: string, pct: string) => `A used ${make}: ${pct} of its life left, no rebuilds.`,
  usedLastRisk: (fd: string) => `It runs until it's worn out, then goes for scrap, for about ${fd} FD.`,
  usedAway: (hub: string, mi: string) => `It's at ${hub}, ${mi} miles from home.`,
  usedAwayRisk: "Bringing it home takes a driver and empty miles.",
  newTruck: (make: string, date: string) => `A new ${make}, arriving ${date}.`,
  newRisk: "It loses value from the day it arrives, and costs money every week it sits.",
  lease: (make: string, deposit: string, min: string) => `Leases a ${make}: ${deposit} FD deposit, at least ${min} FD a week.`,
  leaseRisk: (days: number) => `It costs the weekly minimum, earning or not, for at least ${days} days.`,
  trailer: (type: string) => `A ${type} trailer of your own, kept in your yard.`,
  trailerRisk: "It takes yard space and upkeep whether it's hooked or not.",
  rebuild: "Two days in the shop; condition back to new.",
  rebuildRisk: (n: number, of: number) => `${n} of ${of} rebuilds left after this. Past the last, it runs to scrap.`,
  scrap: (n: number, fd: string) => `Ends truck ${n} for ${fd} FD from the scrapyard.`,
  scrapRisk: (fd: string) => `Sold, it would fetch about ${fd} FD. Scrapping can't be undone.`,
  /** Engineering's draft on the truck's line: the writer's table has no trailer scrap. */
  scrapTrailer: (type: string, fd: string) => `Ends this ${type} for ${fd} FD from the scrapyard.`,
  sell: (n: number, fd: string) => `Lists truck ${n} at ${fd} FD. The price drops each week until it sells.`,
  sellRisk: "It earns nothing while it's listed and parked.",
  /** UX's line 1 for a hire (player2-ux.md section 1): the wage, a week. */
  hireCost: (fd: string) => `${fd} FD a week`,
  hire: (name: string, fd: string) => `Hires ${name} at ${fd} FD a week.`,
  hireRisk: (fd: string) => `That's more than your company kept last week: ${fd} FD.`,
  /** UX's line 1 for a contract (player2-ux.md section 1). */
  contractCost: (n: number, rate: string, days: number) => `${n} loads a week at ${rate}/mi for ${days} days`,
  contract: (origin: string, dest: string, n: number, rate: string, weeks: number) => `${origin} to ${dest}, ${n} loads a week at ${rate}/mi, for ${weeks} weeks.`,
  contractRisk: "Turning down a tender costs your stake and the shipper's trust.",
  item: { apu: (n: number, cut: string) => `Cuts the fuel truck ${n} burns idling overnight by ${cut}.`, aero: (n: number, cut: string) => `Cuts truck ${n}'s fuel by ${cut}.`, tires: (n: number, cut: string) => `Cuts truck ${n}'s maintenance by ${cut}.`, sleeper: (cut: string) => `Cuts the per diem on nights away by ${cut}.` },
  itemRisk: { apu: (n: string) => `It pays back only on nights away: about ${n} weeks at this truck's pace.`, aero: (n: string) => `It pays back in about ${n} weeks at this truck's miles.`, tires: (n: string) => `It pays back in about ${n} weeks at this truck's miles.`, sleeper: (n: string) => `It pays back only if the truck sleeps away often: about ${n} weeks.` },
  paybackUnknown: "Payback unknown until it has run a few weeks.",
  /** Engineering's drafts for the writer: the yard, a business or a facility (the writer's table has none). */
  yard: (trucks: number, bond: string) => `A yard for ${trucks} trucks, with a ${bond} FD bond you get back when you sell it.`,
  space: (n: number) => `Room for ${n} more trailers of your own in your yard.`,
  business: (kind: string, hub: string, bond: string) => `A ${kind} at ${hub}, with a ${bond} FD bond you get back when you sell it.`,
  facility: (kind: string, hub: string) => `A ${kind} at ${hub}: it ships its own freight, and you earn the goods margin.`,
  upkeepRisk: (fd: string) => `It costs ${fd} FD a week in upkeep, earning or not.`,
};

/** Every button answers (the writer's copy-player4.md, R20): BID's result, and BOOK NOW's refusal on a vetted load. */
export const ANSWER = {
  bid: (rate: string, origin: string, dest: string, hh: string) => `Bid in: ${rate}/mi on ${origin} to ${dest}. It clears at ${hh}.`,
  bookVetting: (days: number, loads: number, d: number, l: number) => `Strict vetting: needs ${days} days of authority and ${loads} loads delivered. You have ${d} and ${l}.`,
  bookVettingStd: (days: number, d: number) => `Standard vetting: needs ${days} days of authority. You have ${d}.`,
  ceiling: (ceiling: string) => `Above the ceiling: this shipper pays at most ${ceiling}/mi.`,
  lease: (make: string, hub: string, deposit: string) => `Leased: a ${make} at ${hub}, ${deposit} FD deposit paid. It's on the Truck tab.`,
  leaseDeposit: (fd: string, have: string) => `Deposit ${fd} FD: you have ${have}.`,
  leaseYard: (n: number, m: number) => `Your yard holds ${n} trucks: this lease makes ${m}.`,
  leaseMax: (n: number) => `You may lease at most ${n} trucks.`,
  leaseRow: (fd: string, min: string) => `Lease another truck · ${fd} FD deposit · at least ${min} FD a week`,
  poach: (name: string, day: string) => `Offer sent to ${name}: they answer by ${day}.`,
  poachRow: (day: string) => `Offer pending · answer by ${day}`,
  /** UX's words (player2-ux.md section 7), for the writer: how an offer ended, on the row where it was made. */
  poachAccepted: (name: string, truck: number | null) => `${name} accepted${truck ? `: starts on Truck ${truck}` : ""}.`,
  poachStayed: (name: string, from: string) => `${name} declined: stays with ${from}.`,
  poachLow: (name: string, fd: string) => `${name} earns ${fd}/mi now: an offer must beat it.`,
  unstakeDone: (fd: string, date: string) => `Unstaking ${fd} FD: back in your cash on ${date}.`,
  unstakeNowDone: (back: string, burned: string) => `${back} FD back now. ${burned} FD burned.`,
  unstakeNone: "Nothing staked to unstake.",
};

/** One true reason, where the wall is (the writer's copy-player5.md, R22): the engine's first refusal, vetting before local-first. */
export const WALL = {
  vettingStandard: (days: number, date: string) => `Needs ${days}-day authority: yours reaches it ${date}.`,
  vettingStrict: (days: number, n: number, d: number, l: number) => `Strict vetting: ${days} days' authority and ${n} loads. You have ${d} days, ${l} loads.`,
  vettingStrictDate: (days: number, date: string) => `Strict vetting needs ${days} days' authority: yours reaches it on ${date}.`,
  localFirst: (hh: string) => `Local carriers first this round. Open to everyone from ${hh}.`,
  hot: "A hot load needs a team.",
};

/** The return card (the writer's copy-player5.md, R21): built from the world after a long absence. */
export const RETURN = {
  hello: "Welcome back.",
  whereIdle: (place: string, mi: string) => `Your truck is idle at ${place}, ${mi} miles from home.`,
  whereHome: (hub: string) => `Your truck is at home in ${hub}.`,
  whereMoving: (mi: string, dest: string, eta: string) => `Your truck is ${mi} miles from ${dest}, arriving ${eta}.`,
  whereFleet: (n: number, moving: number, idle: number, home: number) => `${n} trucks: ${moving} on the road, ${idle} idle, ${home} at home.`,
  whyIdle: (reason: string) => `Nothing here is yours to take: ${reason.replace(/\.$/, "")}.`,
  whyIdlePays: (n: number) => `${n} loads in reach pay over break-even.`,
  doingLoading: (place: string, hh: string) => `It's loading at ${place}, done around ${hh}.`,
  doingResting: (place: string, hh: string) => `It's resting near ${place} and rolls again at ${hh}.`,
  awayLive: (n: number, fdIn: string, fdOut: string) => `While you were away: ${n} loads delivered, ${fdIn} FD in, ${fdOut} FD out.`,
  awayTrouble: (list: string) => `Also ${list}.`,
  awayQuiet: "Nothing happened while you were away.",
  awayTest: "Nothing moved while you were away: the test world waits for you.",
  month: (month: string, fd: string) => `${month} closed while you were away: you kept ${fd} FD.`,
  ok: "OK",
  late: (n: number) => (n === 1 ? "a late load" : `${n} late loads`),
  ticket: (n: number) => (n === 1 ? "a ticket" : `${n} tickets`),
};

/** What limits the fleet, the binding cap first (the writer's copy-player4.md, R19). */
export const CAPS = {
  line: (n: number, binding: string, others: string) => `You may run ${n}: ${binding}.${others ? ` ${others}` : ""}`,
  binding: { yard: (n: number) => `your yard holds ${n}`, stake: (n: number) => `your stake allows ${n}`, managers: (n: number) => `your operations managers cover ${n}`, company: (n: number) => `the company limit is ${n}` },
  yardsOpen: (date: string) => `Yards open ${date}.`,
  stake: (n: number) => `Staking allows ${n}.`,
};

/** The staking page (R19). */
export const STAKE = {
  total: (fd: string) => `Staked · ${fd} FD in all`,
  discount: (pct: string) => `Discount · ${pct} on fuel, maintenance, rebuilds, insurance and board fees`,
  termFree: (days: number) => `Term · none: unstake any time, back in ${days} days`,
};

/** Doors that say what opens them (the writer's copy-player2.md, R7). */
export const DOOR = {
  yardFull: (n: number, m: number) => `Your yard holds ${n} trucks: this order makes ${m}.`,
  /** The other caps, in the same pattern (engineering's, on the writer's form). */
  capFull: (binding: string, m: number) => `${binding.charAt(0).toUpperCase()}${binding.slice(1)}: this order makes ${m}.`,
  yardTrailer: (n: number, m: number) => `Your yard holds ${n} trailers: this makes ${m}.`,
  yard: (date: string) => `Yards open ${date}. Until then, make room: park a truck, sell one, or lease one out.`,
  yardButtons: ["Park", "Sell", "Offer for lease"] as const,
  yardShort: (fd: string, bond: string, have: string) => `A small yard costs ${fd} FD plus a ${bond} FD bond: you have ${have}.`,
};

/** Every move shows its price before the tap (the writer's copy-player5.md, R24): fuel, the driver's pay and tolls over the empty miles. */
export const MOVE = {
  home: (mi: string, fd: string, time: string) => `Home · ${mi} mi empty · about ${fd} FD · ${time}`,
  empty: (hub: string, mi: string, fd: string, time: string) => `To ${hub} · ${mi} mi empty · about ${fd} FD · ${time}`,
  time: (days: number, hours: number) => (days < 1 ? `${hours} h` : days === 1 ? "1 day" : `${days} days`),
};

/** The load screen (the writer's copy-player5.md, R25): no "replaying", which a cautious player read as "could come out different". */
export const LOADING = { title: "Loading your world…" };

/**
 * R3: "Theft risk" becomes Security, banded from hubTheftRisk (a multiple of a quiet road). The cut-offs are the writer's
 * proposal, for the economy to confirm: under 1.2 quiet, 1.2 to 2 watch, 2 and over risky (the director: "high" read as well protected).
 */
/** The Economy page's lead (the writer's copy-player1.md, R3): no other game named. */
export const ECONOMY = {
  lead: (days: number) => `Every FD the game paid out and took back in the last ${days} days: the world's own books, published monthly. Everyone sees the same page.`,
};

export type SecurityBand = "quiet" | "watch" | "risky";
export const SECURITY = {
  band: (x: number): SecurityBand => (x < 1.2 ? "quiet" : x < 2 ? "watch" : "risky"),
  name: { quiet: "Quiet", watch: "Watch", risky: "Risky" } as Record<SecurityBand, string>,
  card: {
    quiet: "Security: quiet",
    watch: "Security: watch. Cargo goes missing here more than on quiet roads.",
    risky: "Security: risky. Cargo goes missing here often; insurers and some shippers notice.",
  } as Record<SecurityBand, string>,
  label: "Security",
  here: "Security here",
  atHub: "Security at the hub",
  tip: (band: SecurityBand) => `Security: ${band}`,
};

export const LOGIN = {
  signIn: "Sign in",
  enter: "Enter the world",
  continueLive: (company: string, date: string) => `Continue · ${company} · ${date}`,
  connecting: "Connecting…",
  unreachable: "Can't reach the world · Retry",
  continueTest: (company: string, date: string) => `Continue · ${company} · ${date}`,
  newTest: "New test world",
  replaces: (company: string) => `This replaces ${company}.`,
  replace: "Replace it",
  keep: "Keep it",
  starting: "Starting the world…",
  notOpen: "Not open yet",
  update: "Update in progress",
  updateHover: (theirs: string, ours: string) => `The live world runs rules ${theirs}; this page has ${ours}. Reload in a little while.`,
  openWorld: "Open the live world",
  testWorld: "Test world",
  report: "Report a bug or an idea",
  fullScreen: "Full screen",
};

export const FIRST_ENTRY = {
  nextRound: (hhmm: string) => `Next round ${hhmm}`,
  welcome: "I'm Iuliia, your guide. This is America's freight market, live: every truck you see is real and moving. First, pick a home city.",
  next: "Next",
  home: "The rings mark where a new carrier finds freight right now. You may start at any starter city; any city shows its freight.",
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
  /** R3 (the writer's copy-player1.md): Security, banded, on every card, quiet included. */
  security: (band: SecurityBand) => SECURITY.card[band],
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
  HOU: { character: "The port and the refineries. Flatbed freight goes out heavy, and the vans keep pace.", name: "Ship Channel Freight" },
  ATL: { character: "The Southeast's crossroads. Most of the region's freight passes through on its way somewhere.", name: "Peachtree Line Freight" },
  EWR: { character: "The ports of New York, next door. Plenty to haul, tight roads, and insurance that knows it.", name: "Meadowlands Transport" },
  MEM: { character: "The river, the rails and the air freight meet here. Vans leave full, and living here is cheap.", name: "Bluff City Freight" },
  CMH: { character: "A day's drive from half the country. Vans leave full, and the insurance is the gentlest on the list.", name: "Scioto Freight Lines" },
  MIA: { character: "The end of the road. Freight arrives by the boatload and leaves thin, so locals keep what there is.", name: "Biscayne Freight" },
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
  /** The owner's look, two portraits to tap (QA row 9; the writer may reword). */
  you: "You",
  lookM: "This one: a man",
  lookF: "This one: a woman",
  back: "Back",
  opening: "Opening your authority…",
  /** A hub that can't be a home (the engine lets only the starter hubs be one, game.ts joinCompany). */
  notStarter: (hub: string) => `${hub} is a fine place to deliver to, not yet a place to live. The ringed cities are.`,
};

export const ARRIVAL = {
  line: (hub: string, share: string) => `This is ${hub}, your home. One leased Workhorse, a dry van, and you driving. The lessor keeps ${share} of every load. Let's find one.`,
  /** A small fleet's arrival (test build): two used trucks of its own, no lessor (the writer, 2026-11-03). */
  lineFleet: (hub: string) => `This is ${hub}, your home. Two used trucks of your own, a van and a reefer, and no lessor's share. Let's find them loads.`,
  showBoard: "Show me the board",
  /** Under the arrival line (the writer's copy-player1.md, row 18). */
  fd: "FD is the game's money: you earn it hauling and spend it running trucks.",
  finding: (hub: string) => `Finding ${hub}…`,
  you: "You",
};

/** The board, the load and the round (copy-first-ten-minutes.md, S2–S5). */
export const BOARD = {
  /** The board filtered to one poster (Intel's "Their loads on the board"): the chip, its ✕'s accessible name, and none in reach (the writer's strings). */
  fromPoster: (name: string) => `Posted by ${name}`,
  showEvery: "Show every load",
  noneFromPoster: (name: string) => `Nothing from ${name} within reach of this truck. Clear the filter to see every load.`,
  header: (hub: string, n: number, next: string) => `Loads from ${hub} · ${n} · next round ${next}`,
  truck: (n: number, trailer: string) => `Truck ${n} · ${trailer}`,
  line1: (from: string, to: string, miles: string) => `${from} → ${to} · ${miles} mi`,
  line2: (total: string, rate: string, dh: number) => `${total} FD · ${rate}/mi · ${dh} mi empty`,
  chipBook: (profit: string, positive: boolean) => (positive ? `+${profit} FD at book-now` : `−${profit} FD at book-now`),
  chipSuggest: (profit: string, rate: string) => `+${profit} FD at ${rate}`,
  /** A leased truck (the writer's copy-player1.md, row 2): what lands and what the lease holds toward your truck. */
  chipHeld: (profit: string, lands: string, held: string) => `+${profit} · ${lands} to you · ${held} held toward your truck`,
  chipAllYours: (profit: string) => `+${profit} · all of it to you`,
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

/** A truck on the road and a delivery (copy-first-ten-minutes.md, S6–S7). */
export const ROLLING = {
  lane: (from: string, to: string, miles: string) => `${from} → ${to} · ${miles} mi`,
  eta: (when: string) => `ETA ${when}`,
  onTime: "On time",
  late: (h: number) => `Late ${h} h`,
  follow: "Follow",
  tonightSite: (truckStop: boolean, near: string) => `Tonight, as planned: ${truckStop ? "a truck stop" : "a rest area"} near ${near}`,
  tonightShoulder: "No legal stop in reach: the shoulder tonight.",
  /** A load the dispatcher booked, with no legal stop in today's reach (QA, carry-over row 4; the writer's line). */
  tonightDispatcher: "Tonight: your dispatcher picks the stop on the way.",
};

export const DELIVERED = {
  title: (from: string, to: string) => `Delivered ${from} to ${to}`,
  load: "The load",
  fuel: "Fuel",
  tolls: "Tolls",
  driverOwner: "Your pay for driving",
  driverHired: (name: string) => `Driver's pay · ${name}`,
  upkeep: "Truck upkeep",
  lessor: (share: string) => `The lessor's ${share}`,
  held: "Held toward your own truck (kept)",
  yours: "Yours",
  paid: "Paid",
  today: "today",
  /** How this load is paid, from the settlement's true terms (the writer's copy-player2.md, row 7). */
  paidToday: "Paid today.",
  paidQuick: (pct: string) => `Paid today, less ${pct}.`,
  paidFactor: (rate: string) => `Paid today by the factor, less ${rate}.`,
  due: (date: string) => `Due ${date}.`,
  ok: "OK",
};

/** Money as a ledger (copy-first-ten-minutes.md, S8). */
export const MONEY = {
  title: "Money",
  cash: "Cash",
  cashDays: (n: number) => `Cash, last ${n} days`,
  /** The hold toward your own truck (the writer's copy-player1.md, row 2): a line under Cash, and its note on the first visit. */
  held: "Held toward your truck",
  heldValue: (fd: string) => `Held toward your truck · ${fd} FD in all`,
  heldNote: (holdPct: string) => `${holdPct} of each leased load is kept for you until you buy. It counts in full then.`,
  owed: "Owed to you",
  colLoad: "Load",
  colFd: "FD",
  colDue: "Due",
  nothingOwed: "Nothing owed yet. Your first invoice lands here.",
  nothingOwedLease: "On a lease, the lessor pays on delivery. Invoices start with your own truck.",
  week: "This week's costs",
  leaseMin: "Lease minimum",
  insurance: "Insurance",
  yard: "Yard",
  perDiem: "Per diem",
  perDiemValue: (fd: string) => `${fd} FD a day`,
  standing: "Standing",
  miles: (n: string) => `${n} Miles · your standing in the beta`,
  loans: "Loans",
  loansLead: (ltv: string, rate: string, weeks: number, missed: number) => `A loan on a truck you own: up to ${ltv} of its value, ${rate} a week, over ${weeks} weeks. Miss ${missed} payments and the lender takes the truck.`,
  borrowUpTo: (n: number, fd: string) => `Truck ${n}: borrow up to ${fd} FD`,
  borrow: "Borrow",
  loanOwed: (n: number, fd: string) => `Loan on truck ${n}: ${fd} FD owed`,
  missed: (n: number) => `${n} missed`,
  repay: "Repay",
  /** R4 (the director, director-player1.md): the fold starts closed and says the token is later. */
  token: "The token (later)",
  red: (weeks: number, limit: string) => `You're in the red. ${weeks} weekly checks in a row more than ${limit} FD under and the company is wound up.`,
};

/** The dispatcher and its two states (copy-first-ten-minutes.md, S9). */
export const DISPATCHER = {
  title: "Your dispatcher",
  switchLabel: "Bid for me while I'm away",
  waiting: "Your first load is your call. After that, your dispatcher can bid while you're away.",
  afterFirst: "From now on your dispatcher bids when you don't. Check the rules before you go.",
  /** R1 (the director, director-player1.md and -player2.md): the choice is the player's; one button turns the dispatcher on. */
  letBid: "Let the dispatcher bid",
  offerFleet: "Two trucks: bid one yourself, or let the dispatcher run both.",
  /** Engineering's draft for the writer: the first time the player runs faster than Day a minute with the dispatcher off. */
  offerSpeed: "At this speed rounds pass while you look away. The dispatcher can bid for you.",
  /** The idle card's reason with no bid order (R1: the card is the prompt). */
  offIdle: "The dispatcher is off, so nobody bids for this truck while you're away.",
  seeDispatcher: "See the dispatcher",
  bidAt: "Bid at break-even plus",
  ceilingSuffix: "% of the ceiling",
  emptyUpTo: "Send the truck empty up to",
  homeAfter: "Bring me home after",
  save: "Save",
  moreRules: "More rules",
  floor: "Never below break-even plus",
  bookNow: "Book loads between rounds at break-even plus",
  moveIdle: "Move idle trucks to busier hubs after",
  idleRounds: "idle rounds",
  saved: "Dispatcher saved.",
  defaults: "Dispatcher back to defaults.",
  /** The Truck card and the idle reason while the dispatcher waits for the first bid by hand (S6). */
  waitingCard: (hub: string) => `Waiting at ${hub} · the first load is your call`,
};

/** Iuliia's caption (specs/first-ten-minutes.md, Layout): her line, then the step's Do. */
export const CAPTION = {
  next: "Next",
  hide: "Hide",
  more: "More",
  /** The director's R2: every step card's soft way out, and how a skipped step reads in the list ("skipped" is engineering's draft). */
  skip: "Skip this step",
  /** UX's (guidance-ux.md section 1): The law's moment on Truck opens the safety record on Company. */
  seeRecord: "See your record",
  skipped: "skipped",
  /** The Iuliia tab's switch: mutes her tab-and-card lines, not the walkthrough's (iuliia-lines.md; the writer's strings). */
  quiet: "Quiet",
  quietNote: "Mutes Iuliia's remarks on tabs and cards, in this browser. Her walkthrough steps and What now? stay.",
};

/** The Truck tab (copy-first-ten-minutes.md, S6; copy-audit.md's rewrites). */
export const TRUCK = {
  leased: (share: string) => `leased: the lessor keeps ${share} of every load`,
  secondLease: (share: string, min: string) => `second lease: the lessor keeps ${share} of every load, at least ${min} FD a week`,
  owned: (fd: string) => `owned · worth ${fd} FD`,
  idle: (place: string, next: string) => `Idle at ${place} · next round ${next}`,
  needsYou: "Needs you",
  homeTime: (who: string, until: string) => `On home time: ${who} off until ${until}. Nobody bids for this truck until then.`,
  tired: "A tired driver crashes more, drives slower and loses heart.",
  noLoadsInRange: (trailer: string, maxDh: number, hub: string) => `No ${trailer} loads within ${maxDh} mi of ${hub}, as far as your dispatcher sends a truck empty.`,
  sendEmpty: (hub: string, mi: number) => `Send empty to ${hub} · ${mi} mi`,
  bidByHand: "Bid by hand",
  noDriver: (n: number) => `Truck ${n} has no driver and earns nothing.`,
  hireDriver: "Hire a driver",
  sentEmpty: "The truck is heading out empty.",
  today: "Today",
};

/** The feed (the ticker on a laptop, "Today" on the Truck tab): copy-first-ten-minutes.md, S5, S7, S8. */
export const FEED = {
  /** A book-now, not a bid (the writer's copy-player3.md): "Won … your bid" read wrong for a load booked outright. */
  booked: (from: string, to: string, miles: number, rate: string) => `Booked at book-now: ${from} to ${to}, ${miles.toLocaleString("en-US")} mi at ${rate}/mi.`,
  won: (from: string, to: string, miles: number, rate: string, mine: boolean) => `Won ${from} to ${to}, ${miles.toLocaleString("en-US")} mi at ${rate}/mi, ${mine ? "your bid" : "your dispatcher's bid"}.`,
  lost: (from: string, to: string, rate: string, winning: string | null) => `Lost ${from} to ${to} at ${rate}/mi: ${winning !== null ? `it went for ${winning}/mi` : "nobody took it this round"}.`,
  /** QA's rows 2/4 replay: it named three of the five deductions; now it names them as a whole (engineering's words, for the writer). */
  delivered: (from: string, to: string, total: string, yours: string, paid: string, held: boolean) => `Delivered ${from} to ${to}: ${total} FD, ${yours} FD yours after costs${held ? " and the hold" : ""}. ${paid}`,
  woundUp: "The company is wound up: the trucks are sold, and you start again on a lease.",
  firstLoad: (r1: string, r2: string) => `The first load is your call. Bids clear at ${r1} and ${r2}.`,
  watching: (r1: string, r2: string) => `Your dispatcher is watching the board. Bids clear at ${r1} and ${r2}.`,
  off: (r1: string, r2: string) => `Your dispatcher is off. Bids clear at ${r1} and ${r2}.`,
};

/** The top strip's red count, a button (Jeff, 2026-11-02): one tap opens what's waiting, or a short list of it. */
export const NEEDS = {
  title: "Needs you",
  badge: (n: number) => `Needs you: ${n}. Open it`,
  idle: (truck: string, hub: string, idle: string) => `${truck} idle ${idle} at ${hub}`,
  tired: (who: string) => `${who} needs days off`,
  tender: (from: string, to: string) => `Contract tender: ${from} → ${to}`,
  result: (won: boolean) => (won ? "Your bid won: the result" : "Your bid's result is in"),
  opened: (tab: string) => `${tab} just opened`,
};

/** Step 9 when the used lot can't serve it (Jeff, 2026-11-02: the step reads the gap). The producer's draft; the writer will word it. */
export const STEP9 = {
  loanNow: (need: string) => `A new rig on a loan needs ${need} FD now, and you have it. Buy on a loan at the Dealer.`,
  /** A carrier's listing the company can buy now (QA's step-9 replay; the writer's string). */
  listing: (what: string, ask: string) => `Another carrier is selling a ${what} for ${ask} FD, and you have the cash. It's at the Dealer.`,
  gap: (need: string, have: string, dep: string, when: string) => `A new rig on a loan needs ${need} FD now; you have ${have} FD${dep}. The used lot restocks ${when}. A few more loads close it.`,
  withDeposit: ", counting your deposit",
  /** No new rig left this month and nothing used to buy (QA's step-9 replay). The producer's style; the writer will word it. */
  none: (when: string) => `The factory has no new rigs left this month, and the used lot restocks ${when}. Keep hauling until then.`,
};

/** Finance (specs/finance.md, the writer's specs/finance-strings.md): every string on the panel and Money's link rows. */
export const FINANCE = {
  title: "Finance",
  sent: (at: string) => `Sent · in effect ${at}`,
  // Money's two link rows.
  linkPaid: (state: string) => `Getting paid: ${state} ›`,
  linkLoans: (owed: string, weekly: string) => `Loans: ${owed} FD owed · ${weekly} FD a week ›`,
  /** The writer's (copy-player2.md R7, money.loansOnOrder). */
  linkLoansOnOrder: (owed: string, n: number, weekly: string) => `Loans: ${owed} FD owed, for ${n} truck${n === 1 ? "" : "s"} on order · ${weekly} FD a week ›`,
  linkNoLoans: "Loans: none ›",
  stateNet: (days: number) => `Net ${days}`,
  stateQuick: "Quick pay",
  /** On the lessor's truck, as the Finance card's header says (QA's Finance replay; the writer's string). */
  stateLessor: "On delivery, by the lessor",
  stateContract: (date: string) => `Factoring until ${date}`,
  // Card 1: before your first truck.
  firstTitle: "Before your first truck",
  firstLead: "On your own truck, shippers pay later and costs come now. Have a month of costs in cash.",
  firstMonth: "Running one truck, a month",
  firstMonthValue: (fd: string) => `about ${fd} FD`,
  firstPays: "Shippers pay you",
  firstPaysValue: (days: number) => `${days} days after delivery`,
  firstDeposit: "Your lease deposit",
  firstDepositValue: (fd: string) => `${fd} FD · counts toward the truck`,
  firstCash: "Your cash",
  firstEnough: "You have the month.",
  firstShort: (short: string) => `You're ${short} FD short of a month. Quick pay or factoring would close it; both cost.`,
  firstDealer: "Go to the Dealer",
  // Card 2: getting paid.
  paidTitle: "Getting paid",
  headNet: (days: number) => `Net ${days}: paid ${days} days after each delivery.`,
  headQuick: (pct: string) => `Quick pay: paid on delivery, ${pct} off each load.`,
  headContract: (rate: string, date: string) => `Factoring: paid on delivery, ${rate} off every load, until ${date}.`,
  headLeased: "On the lessor's truck you're paid the day you deliver.",
  leasedNote: "Opens with your first truck of your own.",
  rowNet: (days: number) => `Net ${days}`,
  rowNet2: (days: number) => `Paid ${days} days after delivery`,
  rowNet3: "Costs nothing",
  rowNet4: (fd: string, date: string) => `Your next payment: ${fd} FD on ${date}`,
  rowQuick: "Quick pay",
  rowQuick2: "Paid on delivery",
  rowQuick3: (pct: string) => `${pct} of each load · change back any time`,
  rowAvg: (fd: string) => `On your average load: ${fd} FD`,
  rowFactor: "Factoring",
  rowFactor2: "Paid on delivery, every load, every truck",
  rowFactor3: (rate: string, months: number) => `${rate} of each load · ${months} months · no early exit`,
  rowFactor4: (fd: string, month: string) => `On your average load: ${fd} FD · about ${month} FD a month`,
  whatQuick: (pct: string) => `Quick pay: each load is paid on delivery, less ${pct}. No contract; stop any time.`,
  whatFactor: (months: number) => `Factoring: an outside company pays every invoice on delivery and keeps a share. A contract, ${months} game months.`,
  risk: "Both cost on every load. On a thin load, the fee can be the whole profit.",
  sheetTitle: "Sign a factoring contract",
  sheetRate: "Rate",
  sheetRateValue: (rate: string, date: string) => `${rate} of every load, fixed until ${date}`,
  sheetSetBy: "Set by",
  sheetSetByValue: (n: number) => `your ${n} truck${n === 1 ? "" : "s"}`,
  sheetCovers: "Covers",
  sheetCoversValue: "every truck you run, new ones too",
  sheetRuns: "Runs",
  sheetRunsValue: (start: string, end: string, months: number) => `${start} to ${end} (${months} months)`,
  sheetLeaving: "Leaving early",
  sheetLeavingValue: "not possible",
  sheetQuick: "Quick pay",
  sheetQuickValue: "closed until it ends",
  sheetAvg: "On your average load",
  sheetSign: (months: number) => `Sign for ${months} months`,
  notNow: "Not now",
  daysLeft: (n: number) => `${n} days left`,
  soFar: (fees: string, loads: string) => `Paid so far under this contract: ${fees} FD in fees on ${loads} FD of loads`,
  whenEnds: "When it ends",
  segRenew: "Renew",
  segNet: (days: number) => `Net ${days}`,
  segQuick: "Quick pay",
  underRenew: (rate: string, n: number) => `It renews at the rate your fleet sets that day: ${rate} at ${n} truck${n === 1 ? "" : "s"}.`,
  underNet: (days: number, date: string) => `Then Net ${days} from ${date}.`,
  underQuick: (date: string) => `Then quick pay from ${date}.`,
  exLeased: "Leased trucks: the lessor still pays on delivery, no fee.",
  exPlayers: (days: number, n: number, fd: string) => `Loads for player shippers wait ${days} days even under contract: ${n} load${n === 1 ? "" : "s"}, ${fd} FD.`,
  foldRates: "Your rate by fleet size",
  foldRow: (n: number, rate: string) => `${n} truck${n === 1 ? "" : "s"} · ${rate}`,
  you: "you",
  brokerHead: (rate: string) => `Factoring: ${rate} of each load, flat.`,
  brokerBond: (owed: string, bond: string) => `Owed to carriers: ${owed} of your ${bond} FD bond`,
  brokerNote: "Factoring doesn't raise what you may owe carriers.",
  // Card 3: credit.
  creditTitle: "Credit",
  creditScore: (score: number, band: string) => `Credit ${score} of 100 · band ${band} (A is best, E worst)`,
  creditGets: (down: string, rate: string, n: number) => `Truck loans: ${down} down · ${rate} a week · up to ${n} loans at once`,
  creditMoves: "What moves it",
  creditOnTime: "Loads paid on time",
  creditAge: "Licence age",
  creditAgeValue: (days: number, years: number) => `${days} days of ${years} years`,
  creditClaims: "Claims on record",
  loanRow: (n: number, kind: string, owed: string, weekly: string, weeks: number) => `Truck ${n} · ${kind} · ${owed} FD owed · ${weekly} FD a week · ${weeks} weeks left`,
  /** Engineering's draft for the writer: a purchase loan on a truck not yet delivered. */
  loanRowOnOrder: (kind: string, owed: string, weekly: string, weeks: number) => `On order · ${kind} · ${owed} FD owed · ${weekly} FD a week · ${weeks} weeks left`,
  loanPurchase: "purchase loan",
  loanEquipment: "loan",
  missed: (n: number, all: number) => `${n} payment missed. ${all} in all and the lender takes the truck.`,
  payOff: (fd: string) => `Pay off · ${fd} FD`,
  youHave: (fd: string) => `You have ${fd} FD`,
  borrowRow: (n: number, fd: string, rate: string, weeks: number) => `Truck ${n} · up to ${fd} FD at ${rate} a week over ${weeks} weeks`,
  /** The writer's (copy-player2.md R7): a truck already pledged says so, with no button. */
  borrowNone: (n: number) => `Truck ${n} can't carry a loan: it's already borrowed against.`,
  borrow: "Borrow",
  borrowTitle: (n: number) => `Borrow against truck ${n}`,
  borrowGet: "You get",
  borrowWeekly: "Weekly payment",
  borrowWeeklyValue: (fd: string, weeks: number) => `${fd} FD for ${weeks} weeks`,
  borrowRepo: (n: number) => `Miss ${n} and the lender takes the truck`,
  borrowGo: (fd: string) => `Borrow ${fd} FD`,
  leaseRow: (n: number, share: string, min: string, deposit: string) => `Truck ${n} · leased · ${share} of every load, at least ${min} FD a week · ${deposit} FD deposit held`,
  leasesAt: "Leases are taken at the Dealer.",
  stateADeposit: (fd: string) => `Your lease deposit: ${fd} FD counts toward your first truck.`,
  noLoans: "No loans.",
  noLeases: "No leases.",
  // Card 4: staking (the tier rows go with the lever, when the lock discounts switch on).
  stakeTitle: "Staking",
  stakeBelow: (n: number, fd: string, to: number) => `Staking: needed past ${n} trucks (${fd} FD to run up to ${to}).`,
  stakeMay: (n: number, run: number) => `You may run ${n} trucks · you run ${run}`,
  stakeTo: (n: number, fd: string) => `To run ${n}: stake ${fd} FD`,
  stakeDiscount: (pct: string) => `Discount now: ${pct}`,
  stakeField: "FD to stake",
  stake: "Stake",
  unstake: (days: number) => `Unstake (back in ${days === 1 ? "1 day" : `${days} days`})`,
  unstakeNow: (pct: string) => `Unstake now (${pct} back now, the rest burned)`,
  unstakeTitle: "Unstake now?",
  unstakeBack: "You get back",
  unstakeBurned: "Burned",
  unstakeGo: "Unstake now",
  keepIt: "Keep it",
  later: "Later",
  laterLine: "Discounts for locking FD come with lock terms, later in the beta.",
  // Iuliia on Finance: one line, never over a card's figures; no joke in any.
  iuliiaA: "Before you buy, read the first card. On your own truck the money waits; the costs don't.",
  iuliiaB: "Your truck, your paper. Choose how you're paid before the month chooses for you.",
  iuliiaBroker: "You factor at a flat rate now. Your carriers still expect their money on time.",
  iuliiaSigned: (date: string) => `Signed. Every truck, every invoice, until ${date}. A bigger fleet renews cheaper.`,
  iuliiaEnding: (date: string) => `Your contract ends on ${date}. Renew, or choose how you're paid after it.`,
};

/** Intel (specs/intel-ux.md; UX's placeholder strings until the writer's land). Never a cash figure (specs/intel.md, row 1). */
export const INTEL = {
  title: "Intel",
  header: (n: number) => `Intel · ${n.toLocaleString("en-US")} companies`,
  howOthers: "How others see you",
  find: "Find a company",
  myHub: "My hub",
  hub: "Hub ▾",
  anyHub: "Any hub",
  players: "Players",
  brokers: "Brokers",
  sortBy: "Sort by",
  sortMiles: "Miles",
  sortTrucks: "Trucks",
  sortMonth: "Last month",
  player: "Player",
  broker: "Broker",
  carrier: "Carrier",
  ai: "AI",
  line2: (hub: string, trucks: number, miles: string) => `${hub} · ${trucks} truck${trucks === 1 ? "" : "s"} · ${miles} Miles`,
  line2Broker: (hub: string, credit: string) => `${hub} · broker · credit ${credit}`,
  more: (n: number) => `Show ${n} more`,
  noneAt: (who: "brokers" | "players" | "companies", hub: string) => `No ${who} at ${hub}.`,
  noneCalled: (q: string) => `Nobody called "${q}".`,
  none: "No companies.",
  clear: "Clear filters",
  back: "Back",
  home: (hub: string) => `Home: ${hub}`,
  authority: "Authority",
  authorityValue: (age: string, status: string) => `${age} · ${status}`,
  revokedBefore: (n: number) => (n > 1 ? `revoked ${n} times before` : "revoked once before"),
  ageDays: (n: number) => `${n} day${n === 1 ? "" : "s"}`,
  ageMonths: (n: number) => `${n} month${n === 1 ? "" : "s"}`,
  ageYears: (n: number) => `${n} year${n === 1 ? "" : "s"}`,
  running: "Running",
  runningValue: (trucks: number, trailers: number, byType: string, drivers: number) => `${trucks} truck${trucks === 1 ? "" : "s"} · ${trailers} trailer${trailers === 1 ? "" : "s"}${byType ? ` (${byType})` : ""} · ${drivers} driver${drivers === 1 ? "" : "s"}`,
  /** The Running row's facilities line: only the kinds it has, counts never values (fences and chop shops are the Back Lot's, never shown). */
  facilityKind: { yard: "yard", shop: "repair shop", truckStop: "truck stop", fuelStation: "fuel station", dealership: "dealership", warehouse: "warehouse", coldStorage: "cold storage", factory: "factory" } as Record<string, string>,
  facilityCount: (n: number, kind: string) => `${n} ${kind}`,
  theirLoads: "Their loads on the board ›",
  milesSeason: "Miles this season",
  milesValue: (miles: string, rank: number, of: number) => `${miles} · #${rank} of ${of.toLocaleString("en-US")}`,
  pastSeasons: "Past seasons",
  pastRow: (n: number, miles: string, rank: number) => `Season ${n} · ${miles} · #${rank}`,
  lastMonth: "Last month",
  lastMonthValue: (fd: string, loads: number, onTime: string) => `Revenue ${fd} FD · ${loads} load${loads === 1 ? "" : "s"}${loads ? ` · ${onTime} on time` : ""}`,
  firstMonth: "First month: no record yet",
  safety: "Safety",
  insurance: "Insurance",
  insClean: "Clean",
  insSurcharged: "Surcharged",
  insHeavy: "Heavily surcharged",
  credit: "Credit",
  creditValue: (band: string) => `${band} (A is best, E worst)`,
  brokerLine: (band: string, bonded: boolean, vetting: string) => `Credit ${band}${bonded ? " · Bonded" : ""} · ${vetting} vetting`,
  bondedVetting: (bonded: boolean, vetting: string) => `${bonded ? "Bonded · " : ""}${vetting} vetting`,
  ownCredit: (band: string, down: string, rate: string, n: number) => `At ${band}: truck loans ${down} down at ${rate} a week, up to ${n} at once`,
  ownSafety: (tier: string, reason: string) => `${tier}-vetting brokers won't load you yet: ${reason}.`,
  ownSafetyClear: "No broker's vetting turns you away.",
  ownInsurance: (pct: string) => `Your premium is ${pct} over a clean record's.`,
  ownInsuranceClean: "Your premium is a clean record's.",
  /** No safety rating yet (a new authority): what that costs, so it doesn't read against "Clean" above (the writer's line). */
  ownInsuranceUnrated: (pct: string) => `No safety rating yet: your premium is ${pct} over a rated, clean record's.`,
  fullBooks: "Your full books ›",
  everyCompany: "Every company, by Miles ›",
  whoHere: "See who's here ›",
  netWorth: "Net worth",
  privateWorth: "Private: only you see this.",
  lostTo: (name: string, rate: string) => `Lost to ${name} at ${rate}/mi ›`,
  /** Iuliia's one line on the first visit to Intel (iuliia-lines.md), in the caption strip. */
  iuliia: "Every company in the world, by size and record. Nobody's cash is here, yours included.",
};

/** The Dealer's buy controls (QA's Finance replay): a disabled button always says why; a loan shows its numbers first (the writer's strings). */
export const DEALER = {
  /** The writer's (copy-player2.md R7): each offer says when it delivers. newLead's cause is for the economy to confirm. */
  deliversToday: "Delivers today",
  arrives: (date: string) => `Ordered: arrives ${date}`,
  newLead: (n: number) => `New trucks arrive in ${n} days: the factory is behind on orders.`,
  onLoan: "Buy on a loan ›",
  loanTitle: (what: string) => `Buy ${what} on a purchase loan`,
  price: "Price",
  tax: "Sales tax",
  down: "Down payment",
  loan: "Amount borrowed",
  stake: "Loan stake",
  stakeValue: (fd: string) => `${fd} FD, locked until the loan is repaid`,
  weekly: "Weekly payment",
  weeklyValue: (fd: string, weeks: number, rate: string) => `${fd} FD for ${weeks} weeks · ${rate} a week on what's owed`,
  deposit: "Your lease deposit",
  depositValue: (fd: string) => `${fd} FD, counted toward the price`,
  now: "Cash needed now",
  buyLoan: (fd: string) => `Buy on a loan · ${fd} FD now`,
  missed: (n: number) => `Miss ${n} payments and the lender takes the truck.`,
  cancel: "Not now",
  whyCash: (have: string, need: string, dep = "") => `You have ${have} FD${dep}. It costs ${need} FD with tax.`,
  whyAsk: (have: string, ask: string) => `You have ${have} FD. The seller asks ${ask} FD.`,
  whyLoan: (need: string, have: string, dep = "") => `A loan needs ${need} FD now: down payment, stake and tax. You have ${have} FD${dep}.`,
  whyLoans: (n: number) => `The lender carries at most ${n} loans at your credit.`,
  whyLotEmpty: "The used lot is empty this week.",
  whySupply: "The factory has none left this month.",
  whyYard: "No room in your yard for another trailer.",
  withDeposit: ", counting your deposit",
};

/**
 * Iuliia by tab and card (the writer's iuliia-lines.md): one line per screen at a time, on a first visit in a sitting or
 * a named change there; variants rotate. Keys are `screen:trigger`. Finance's and Intel's own lines live with their blocks.
 */
export const IULIIA_SAY: Record<string, readonly string[]> = {
  // First entry: the hub screen.
  "hub:ringed": ["A good place to start this month. Read the costs before the character.", "Ringed for a reason: freight leaves here for a new carrier."],
  "hub:starter": ["You may start here. Whether you should is what the card is for.", "Every city has a character. Look at what it costs to live with it."],
  "hub:other": ["A fine place to deliver to. For a home, look at the rings."],
  "hub:board": ["Look, don't touch: these are someone else's loads until you live here.", "Read the ceilings. Those are what shippers pay a stranger."],
  "hub:all": ["Sorted by today's freight. Today's, not forever's."],
  "hub:thin": ["Thin this month. My grandmother planted in May anyway; she also had a pension."],
  // Truck.
  "fleet:first": ["Your truck. Look at it as an accountant would, then as a mechanic.", "Every truck has a story; the odometer writes it.", "Check where it sleeps tonight. My grandmother checked the doors twice."],
  "truck:waiting": ["It waits for you. The first load is your call."],
  "truck:rolling": ["There it goes. I still like watching them leave.", "The slow part begins, which is most of trucking."],
  "truck:worn": ["The condition bar is a calendar. Plan the rebuild before it plans you."],
  "truck:shoulder": ["No legal place in reach tonight. Next time, plan the stop before the drive."],
  "delivered:onTime": ["Delivered. Read the pay line, not only the top number.", "On time. The shipper noticed, even if they'd never say so."],
  "delivered:late": ["Late once is weather. Twice is a habit.", "Late. The receiver will remember; so will your record."],
  "needs:first": ["Something needs you. Not urgently, or I'd be louder."],
  "truck:sendEmpty": ["Empty miles: expensive, but sometimes the only honest road.", "Running empty toward better freight. A calculated retreat.", "I'll pretend I didn't see the fuel bill."],
  "truck:sendHome": ["Home time. Cheaper than a new driver, every time."],
  "truck:rebuild": ["Two days in the shop. A planned rebuild is the cheapest repair there is."],
  "truck:park": ["Parked. A truck that doesn't move still costs; the ledger will remind you."],
  "dispatcher:on": ["Good. It bids while you sleep; check what it did in the morning.", "Rules on. They behave on Tuesday; audit them on Friday."],
  "dispatcher:off": ["Off. Every load is yours to bid by hand, then.", "Off. Brave, or tired of its taste. Either way, I'm watching."],
  "dispatcher:rules": ["The fine print. Set it once, then read what it did."],
  // Loads.
  "loads:first": ["The board. Read the ceiling before you fall in love with a rate.", "Nearest first. An empty mile pays nothing.", "Every load here is somebody's emergency. Price it accordingly."],
  "board:empty": ["Nothing near you this round. Widen the search, or wait for the next."],
  "load:open": ["Book now if the profit is green. Bid if you're patient.", "The break-even is yours; the ceiling is theirs. Live between them."],
  "load:blocked": ["Not yours yet. Brokers want a record before they want you."],
  "load:book": ["Booked. Decisive. I approve, provisionally.", "Yours at the posted price. Now make the appointment.", "Booked. Sometimes the bird in the hand is the whole lunch."],
  "load:bid": ["Bid in. Now we wait, which is most of this business.", "A fair bid. The round will tell us whether the market agrees.", "Placed. Refreshing the page doesn't help; I've tried."],
  "load:withdraw": ["Withdrawn. Changing your mind before the round is allowed. After is called a lesson."],
  "result:won": ["Won. Good price, or good luck? Compare it with what it usually clears near.", "Won. Enjoy it for one minute, then plan the reload."],
  "result:lost": ["Lost. If they went under your break-even, let them have it.", "Lost by cents. Next round, read \"usually clears near\" first."],
  "result:nobody": ["Nobody bid. The shipper will raise the rate before you lower yours."],
  // Money.
  "money:first": ["The ledger never lies. It only waits for you to read it.", "Cash first, then what's owed, then what you wish were owed.", "Read this page weekly, like an executive, with tea."],
  "money:invoice": ["Your first invoice. It lands on its due day; plan as if it might not."],
  "money:red": ["You're below zero. Get loads moving, and read the warning above."],
  "money:token": ["The token, as it stands. Read it; nothing here is a promise of money."],
  // More and the panels under it.
  "more:first": ["The rest of the house. Some rooms are still being painted.", "Help is in here. So am I, which is better."],
  "iuliia:first": ["My clipboard. Every step on it, ticked or not.", "Read ahead if you like. I won't tell."],
  "guide:first": ["Every system, every number. I've read it twice; once was for pleasure.", "The handbook. Dry, complete, occasionally right before I am."],
  "company:first": ["Your record. Brokers read it before they read your rate.", "Reputation is slow to build and quick to spend."],
  "company:rating": ["Your rating moved. Read what's behind it before the insurer does."],
  "company:renewed": ["Renewed. The insurer read your record; so should you."],
  "teaser:closed": ["Not open yet. Patience is also a business skill.", "Coming. Tell us what you'd want; I pass it on."],
  "rates:first": ["Where freight pays, by trailer. A map of other people's mistakes.", "Strong hubs pay to leave; weak ones pay to arrive."],
  "economy:first": ["The market's own books. Tolstoy wrote shorter ones."],
  "logbook:first": ["What your Miles became. I kept the receipts."],
  "business:first": ["Yards, shops, truck stops. A business is a truck that never leaves."],
  "backlot:first": ["Someone will want your cargo one day. Lock the gate.", "Rivals have yards too. Mind yours."],
  // Dealer.
  "market:first": ["Window shopping is free. Signing is not.", "Every truck here is somebody's dream. Buy yours with arithmetic."],
  "dealer:buyFirst": ["Yours. The lessor's cut ends today; the wait for your money starts."],
  "dealer:buyLater": ["Another truck, another driver to find. Growth is a staffing problem."],
  // Staff.
  "staff:first": ["People are the dearest line in the ledger, and the only one that can quit.", "Hire slowly. Tolstoy took six years over one book."],
  "staff:hireDriver": ["Pay decides who comes; home time decides who stays.", "Learn their name. They'll be learning yours."],
  "staff:hireDispatcher": ["A dispatcher. Now someone else reads the board at three in the morning."],
  "staff:hireManager": ["A manager. Your fleet just grew a middle, which every fleet needs."],
  "staff:restless": ["Restless. Home time costs less than a replacement."],
};

/** What now? (the writer's guidance-strings.md, section 1): one action, one reason with this company's figures, one button. */
export const NOW = {
  chip: "What now?",
  notNow: "Not now",
  stale: "That's changed. Ask me again.",
  stepPrefix: (n: number, total: number) => `Step ${n} of ${total} · `,
  dangerReason: (n: number, of: number, day: string) => `${n} of ${of} weekly checks in debt. The next is ${day}.`,
  dangerWarn: (day: string, fd: string) => `The next weekly check is ${day}. You'd be ${fd} FD under the line.`,
  bookAction: (n: number) => `Book a load for Truck ${n} today.`,
  bookButton: "Show me its loads",
  leaseAction: (n: number) => `Return the lease on Truck ${n}.`,
  leaseReason2: (min: string) => `It costs at least ${min} FD a week, earning or not.`,
  leaseButton: "Return the lease",
  /** Rule 1's collect lever: quick pay doesn't advance invoices already open, so it waits for them. */
  collectAction: "Keep the trucks loaded until your invoices land.",
  collectReason2: (fd: string, day: string) => `${fd} FD is due to you by ${day}, in time for the check that counts.`,
  collectQuick: (pct: string) => `Quick pay would pay each new load on delivery, less ${pct}. Open invoices keep their dates.`,
  collectButton: "Getting paid",
  /** Back above the line with checks counted: the count resets at the next check if cash holds. */
  holdAction: (debtLine: string, day: string) => `Keep your cash above ${debtLine} FD through the ${day} check. That check resets the count.`,
  holdButton: "Money",
  // With cash now on: cashing offered first (the director's rule 1).
  cashAction: (day: string) => `Cash the invoices due by ${day}.`,
  cashReason2: (lands: string, fee: string) => `${lands} FD lands today, less ${fee} FD in fees: your contract rate plus aging.`,
  cashReason2Spot: (lands: string, fee: string) => `${lands} FD lands today, less ${fee} FD in fees: the spot rate plus aging.`,
  cashButton: "Cash them now",
  sellAction: (n: number) => `Sell Truck ${n}.`,
  sellReason2: (fd: string, short: string) => `It should fetch about ${fd} FD. You're ${short} FD under the line.`,
  sellButton: "Sell it",
  tenderAction: (shipper: string) => `Answer ${shipper}'s tender.`,
  tenderReason: (hhmm: string) => `It lapses at ${hhmm}. Accept it, or it goes to the open board.`,
  tenderButton: "Show the tender",
  lostAction: (origin: string, dest: string) => `Bid on ${origin} to ${dest} instead.`,
  lostReason: (rate: string, fd: string) => `You lost the last one. This load clears near ${rate}/mi and pays ${fd} FD over break-even.`,
  lostButton: "Show the load",
  driverAction: (n: number) => `Hire a driver for Truck ${n}.`,
  driverReason: (name: string) => `${name} has gone. A truck without a driver earns nothing.`,
  /** A truck nobody has driven for you (QA: a small fleet's second truck, day 3). */
  driverReasonNone: (n: number) => `Truck ${n} has no driver, so it earns nothing.`,
  driverButton: "Hire a driver",
  idleAction: (origin: string, dest: string) => `Bid on ${origin} to ${dest}.`,
  idleReason: (n: number, hub: string, fd: string) => `Truck ${n} is idle at ${hub}. This load pays about ${fd} FD over break-even.`,
  idleButton: "Show the load",
  stepButton: (tab: string) => `Go to ${tab}`,
  gapAction: "Keep hauling toward your own truck.",
  gapReason: (gap: string, weeks: number) => `You're ${gap} FD short, counting your deposit and ${weeks} weeks of costs held back.`,
  gapButton: "See the Dealer",
  cushionAction: "Build your cushion before you spend.",
  cushionReason: (n: string) => `Your cash covers ${n} weeks of your own spending.`,
  cushionButton: "Money",
  factoringEndsAction: (date: string) => `Choose how you're paid after ${date}.`,
  factoringEndsReason: (n: number) => `Your factoring contract ends in ${n} days.`,
  factoringEndsButton: "Getting paid",
  calmAction: "Nothing needs you right now.",
  calmReason: (event: string, time: string) => `The next thing that will: ${event}, in ${time}.`,
  calmButton: "OK",
  eventRound: "the next round",
  eventMonthClose: "the month's close",
  eventLayer: (layer: string) => `${layer} opening`,
  eventFactoring: "your factoring contract's end",
  liquidatingAction: "Your company is being wound up.",
  liquidatingReason: (day: string) => `Its trucks are being sold. You start again on a lease on ${day}.`,
  liquidatingButton: "What happens next",
  noneAction: "I don't have a sure answer for this one.",
  noneReason: "Help has every system and every number.",
  noneButton: "Open Help",
  /** The driver's name when the engine no longer has it. Draft for the writer. */
  yourDriver: "Your driver",
};

/**
 * The explain sheet (the writer's guidance-strings.md section 3): per figure key, what it is, how it's computed (the
 * writer's sentence; explain.ts adds this company's inputs under it) and what moves it. Plain throughout: no joke.
 * Functions take the config values the writer named as `{key}`.
 */
type Ex = { what: string; how: string; moves: string };
const pctOf = (x: number) => `${Math.round(x * 100)}%`;
const pct2 = (x: number) => `${(x * 100).toFixed(2)}%`;
/**
 * The explain sheet's foot (guidance-ux.md section 3, ruled 2026-11-03): the question (the writer's, per UX), the figure's
 * own answer, and the link to the company's What now?. The writer's (guidance-strings.md section 3); value keeps engineering's line, since condition enters a truck's value.
 */
export const FIGURE_ACT = {
  ask: "What can I do about it?",
  whole: "What now? for the whole company ›",
  showLoad: "Show me the load",
  fewerEmpty: (origin: string, mi: string) => `Fewer empty miles: the ${origin} load starts ${mi} mi from your truck.`,
  loadReason: (origin: string, dest: string, fd: string) => `${origin} to ${dest} pays about ${fd} FD over your break-even.`,
  haulForCushion: "Haul the best-paying load: each one adds to your cushion.",
  haulForTruck: "Keep hauling: each paying load closes the gap.",
  busy: "Every truck is on a load; this moves as they deliver.",
  nothingPays: (hh: string) => `Nothing in reach pays over break-even this round. New loads post at ${hh}.`,
  noSpending: "Nothing to fix yet: your first week hasn't closed, so there's no spending to measure.",
  healthy: (weeks: string) => `Nothing to fix: ${weeks} weeks of cushion is healthy.`,
  gapClosed: "Nothing to close: you can afford your next truck now.",
  value: "A truck loses value with miles and wear. Upkeep slows that; nothing stops it.",
  diesel: "Nobody sets the price of diesel; your truck's mpg decides how much it hurts.",
  held: "It's yours, held: it counts in full when you buy your own truck.",
  theirs: "That's theirs to change, not yours.",
};

export const EXPLAIN_HEAD = { what: "What it is", how: "How it's computed", moves: "What moves it", none: "I can't break this one down yet." };
export const EXPLAIN = (cfg: EconomyConfig): Record<string, Ex> => ({
  "money.cash": { what: "The FD in your company's account right now.", how: "Every payment in, less every cost out, as they land.", moves: "Loads paid; fuel, wages, leases and loans going out." },
  "money.trend": { what: "Your cash at each day's end, for the last weeks.", how: "One point a day from the ledger.", moves: "The same as cash, seen over time." },
  "money.owed": { what: "Invoices shippers owe you, and the day each is due.", how: `Each delivered load on an owned truck, paid ${cfg.token.payment.termsDays} days later.`, moves: "More deliveries; quick pay or factoring brings them in sooner." },
  "board.profitChip": { what: "What this load leaves you after your costs, at that price.", how: "Rate times miles, less break-even times all the miles you'd drive.", moves: "The rate, the empty miles, and your own costs per mile." },
  "truck.breakEven": { what: "The rate per mile that just covers this truck's costs on this load.", how: "Fuel, maintenance, insurance, tolls and pay per mile, empty miles included, plus the lessor's share.", moves: "Fewer empty miles, cheaper fuel, a better-kept truck, owning instead of leasing." },
  "board.ceiling": { what: "The most this shipper will pay per mile.", how: "Set by the shipper from the lane's market when the load is posted.", moves: "The lane, the season, and how long the load has waited." },
  "board.clearsNear": { what: "Where loads like this one usually go.", how: "The recent winning rates on this lane and trailer.", moves: "The market: more trucks push it down, more freight pushes it up." },
  "board.bookNow": { what: "The price that takes the load at once, with no round.", how: "The shipper's posted offer, below its ceiling.", moves: "It rises the longer the load sits unbooked." },
  "board.bid": { what: "Your offer per mile, decided at the next round.", how: "The best bid under the ceiling wins, weighing price, record and empty miles.", moves: "Your price, your on-time record, how near your truck is." },
  "board.deadhead": { what: "Miles your truck drives empty to reach the pickup.", how: "Road miles from where your truck is to the load's origin.", moves: "Where your truck waits; nearer loads." },
  "truck.eta": { what: "When the truck should arrive, waiting included.", how: "Driving hours left, rest stops, and the dock's opening hours.", moves: "Hours of service, the weather, the road and the dock." },
  "truck.hosLeft": { what: "Hours the driver may still drive today.", how: `${cfg.hos.drivingHoursPerDay} hours a day, less what's driven since the last rest.`, moves: "Rest resets it; a team drives longer." },
  "pay.lessorShare": { what: "The lessor's cut of every load on a leased truck.", how: `${pctOf(cfg.costs.npcLeaseShareOfGross)} of what the load pays.`, moves: "It ends when you own the truck." },
  "pay.fuel": { what: "Diesel burned on this load, empty miles included.", how: "Miles divided by the truck's mpg, times the day's pump price.", moves: "Fewer empty miles, the make's mpg, the price of diesel." },
  "pay.tolls": { what: "Road tolls on this route.", how: "The tolled roads the route uses, at their rates.", moves: "The route; some lanes have none." },
  "pay.fuelTax": { what: "Tax on every gallon you burn, billed at the month's close.", how: `${cfg.costs.fuelTax.perGal} FD a gallon, on the road and idling, added up over the month.`, moves: "Gallons: fewer empty miles, less idling, a make with better mpg." },
  "pay.maintenance": { what: "Wear on the truck from these miles.", how: "The tractor's cost per mile, times the miles.", moves: "The make, the truck's condition, a timely rebuild." },
  "pay.insurance": { what: "Your policy's cost for this period.", how: "Base premium, times your record, your home hub and the market.", moves: "A clean safety record; your home hub." },
  "pay.ownerPay": { what: "What you pay yourself for driving.", how: "Your driver's rate per mile, times the miles.", moves: "Your pay setting." },
  "standing.miles": { what: "Your standing in the beta: loaded miles hauled this season.", how: "Every loaded mile delivered. Empty miles don't count.", moves: "Hauling, and hauling loaded." },
  "standing.reputation": { what: "How shippers and brokers rate you.", how: `Your lifetime on-time share, smoothed by ${cfg.reputation.priorLoads} loads at the starting value so one load can't swing it.`, moves: "Delivering on time. Nothing else moves it." },
  "standing.onTime": { what: "The share of your loads delivered by the appointment.", how: "Loads on time, divided by loads delivered.", moves: "Plan for hours, docks and weather." },
  "intel.creditBand": { what: "Your credit, A best to E worst.", how: "Paying from cash in hand, authority age, open claims, bankruptcies, revocations, and cover for what you owe.", moves: "Pay from cash, not overdraft; time; no claims; keep cash and stake above what you owe." },
  "intel.safetyBand": { what: "Your safety rating from inspections and reviews.", how: "Violations at inspections and audits over two years, recent ones counting more, plus crashes per truck.", moves: "Rested drivers, maintained trucks, no speeding, no crashes." },
  "intel.insuranceBand": { what: "How much your record adds to your premium.", how: "Your at-fault surcharge: clean, surcharged or heavily surcharged.", moves: "Fewer crashes and claims; it eases with time." },
  "intel.creditBand.other": { what: "A company's credit, A best to E worst.", how: "", moves: "Paying from cash in hand, its authority's age, claims, and cover for what it owes." },
  "intel.safetyBand.other": { what: "A company's safety rating from inspections and reviews.", how: "", moves: "Violations found at inspections and audits, and crashes, recent ones counting most." },
  "intel.insuranceBand.other": { what: "How much a company's record adds to its premium.", how: "", moves: "Its crashes and claims; the surcharge eases with time." },
  "truck.leaseDeposit": { what: "Money held back from your lease loads, toward your own truck.", how: "A share of each leased load, counted in full when you buy.", moves: "Every leased load adds to it." },
  // Cash it now: the writer's what and moves; the how is the rate's parts.
  "invoice.cashNowFee": { what: "The fee to cash an open invoice today instead of on its due day.", how: "The invoice times the rate: your contract's rate or the spot rate, plus a little for each day since it was raised.", moves: "A contract's rate instead of spot; cashing an invoice while it's fresh." },
  "invoice.cashNowLands": { what: "What reaches your cash today if you cash this invoice now.", how: "The invoice, less the fee.", moves: "The fee: a contract's rate instead of spot, and the invoice's age." },
  // QA's guidance replay: the Dealer's rows carried no figure to tap.
  "dealer.price": { what: "What this rig costs here today, before tax.", how: "The make's list price, times the dealer's monthly index, which follows the order backlog and stock.", moves: "The month's backlog and stock; another seller; a used rig instead." },
  "truck.value": { what: "What your owned truck would fetch today.", how: "Its list price, less depreciation by age and miles.", moves: "Time, miles, condition and the make." },
  "loan.downPayment": { what: "The share of the price you pay yourself on a purchase loan.", how: `${pctOf(cfg.equipmentFinance.purchase.downShare[0])} to ${pctOf(cfg.equipmentFinance.purchase.downShare[1])} of the price: the better your credit score, the lower.`, moves: "A better credit score, before you sign." },
  "loan.cashNow": { what: "The cash a purchase loan needs at signing.", how: `Down payment, a ${pctOf(cfg.equipmentFinance.purchase.stakeShare)} loan stake and sales tax. Your lease deposit comes off when this truck replaces the lessor's.`, moves: "Your credit score, and the price you choose." },
  "loan.rate": { what: "What the loan costs each week on what's owed.", how: `${pct2(cfg.equipmentFinance.purchase.weeklyRate[0])} to ${pct2(cfg.equipmentFinance.purchase.weeklyRate[1])} a week: the better your credit score at signing, the lower.`, moves: "A better score lowers your next loan. A running loan's rate never changes." },
  "finance.factoringRate": { what: "The factor's share of every load under contract.", how: "From your fleet size on the day you sign; fixed for the term.", moves: "More trucks at renewal lower it." },
  "finance.quickPayFee": { what: "The cost of being paid on delivery, one load at a time.", how: `${pctOf(cfg.token.payment.quickPayPct)} of the load.`, moves: "Nothing: it's fixed. Use it for emergencies." },
  "guide.gapToTruck": { what: "How far you are from your next truck.", how: `The cheapest truck's cash needed now, less your deposit and cash above ${cfg.guide.gapCushionWeeks} weeks of costs.`, moves: "Hauling; the cheapest truck on offer, which changes; your spending, once your first week closes." },
  "guide.cushion": { what: "How many weeks your cash covers your own spending.", how: `Your cash, divided by your average weekly spending over the last ${cfg.guide.cushionAvgWeeks} weeks.`, moves: "Earning more, spending less, buying nothing in a slump." },
  "guide.debtCountdown": { what: "Weekly checks in a row with cash under the line.", how: `Checked weekly: under ${cfg.insolvency.debtLimitFd.toLocaleString("en-US")} FD counts one; ${cfg.insolvency.weeksInDebt} in a row winds you up.`, moves: "Cash back above the line resets it." },
});

/** Labels for Iuliia's figures where they show on Money (figures.ts). Drafts for the writer. */
export const GUIDE_LABEL = {
  cushion: "Cushion",
  cushionValue: (weeks: number | null) => (weeks === null ? "Cushion: no spending yet" : `Cushion: ${weeks.toFixed(1)} weeks of your own spending`),
  debt: "Weekly checks in debt",
  debtValue: (n: number, of: number) => `Weekly checks in debt: ${n} of ${of}`,
  gap: "Gap to the next truck",
  gapValue: (fd: string) => `Your next truck: ${fd} FD away`,
  /** What moved the gap since the player last looked (the writer's copy-player1.md, row 4). */
  gapWhyCheapest: "The cheapest truck changed: listings come and go, and the used lot sells out and restocks.",
  gapWhyCushion: (weeks: number) => `Your first week closed, so the gap now holds back ${weeks} weeks of your spending.`,
};

/**
 * Milestones to day 91 (the writer's guidance-strings.md section 2): a line before (only where the date is known) and a
 * line at, each once, with one sentence of reason. `name`, `button` and the timeline's strings are engineering's
 * drafts, flagged for the writer.
 */
export const MILESTONE = {
  ownTruck: {
    name: "Your own truck",
    at: "Your own truck. No lessor's share now, and no lessor to fix it.",
    reason: "Maintenance, insurance and value lost are yours, and a truck that sits still costs money.",
    button: "Find its next load",
  },
  hiredWeek: {
    name: "First week of wages",
    before: (name: string, day: string) => `${name} is paid by the mile, weekly from ${day}, plus a per diem for idle days away.`,
    at: (name: string, mi: string, fd: string) => `${name} has driven ${mi} miles for you this week: ${fd} FD in wages so far.`,
    reason: (perDiem: string) => `Your driver earns by the mile. An idle day away from home costs ${perDiem} FD in per diem.`,
    button: "Find its next load",
  },
  dispatcher: {
    name: "Your dispatcher",
    /** The director: reached by a third truck with no dispatcher hired, it's undated and named so. */
    nameTrucks: "Three trucks",
    at: "Your dispatcher starts today. It follows your rules exactly, including the foolish ones.",
    reason: "Check the rules against the lanes that actually paid.",
    button: "Check its rules",
  },
  monthClose: {
    name: "Your first month",
    before: (n: number) => `Your first month closes in ${n} days. Monthly bills land with it.`,
    at: (earned: string, spent: string, kept: string) => `Your first month: earned ${earned}, spent ${spent}, kept ${kept} FD.`,
    /** The director: until the engine's first month-close record exists. */
    atNoRecord: "Your first month has closed. Money has all of it.",
    /** "Read the month on Money" goes until the month report exists (R25); it returns with it. */
    reason: "The fuel tax and insurance land at the close.",
    beforeButton: "See the month so far",
    button: "Read the month",
  },
  day28: {
    name: "Businesses open",
    before: (businessDay: string) => `Businesses open ${businessDay}. Most first-month carriers should let them wait.`,
    at: "Businesses are open. Nobody needs a warehouse in week four; most need a second truck.",
    reason: (gap: string) => `A business pays over years. Your gap to the next truck is ${gap} FD.`,
    beforeButton: "See the Dealer",
    button: "See the Dealer",
  },
  slump: {
    name: "The first slump",
    at: "Rates are falling for everyone, not just you. Slumps end.",
    reason: (n: string) => `The carrier still here when it ends is the one who didn't buy in it. Your cushion: ${n} weeks.`,
    button: "See your cushion",
  },
  debt: {
    name: "In debt at a weekly check",
    before: (day: string) => `The weekly check is ${day}. At today's cash you'd be under the line.`,
    at: (weeksInDebt: number) => `You're in debt at a weekly check: 1 of ${weeksInDebt}. Here is the way out.`,
    reason: (weeksInDebt: number, debtLine: string) => `${weeksInDebt} checks in a row under ${debtLine} FD and the company is wound up.`,
    button: "What now?",
  },
  day91: {
    name: "Brokerages open",
    before: (brokerDay: string) => `Brokerages open ${brokerDay}. The bond is the hard part.`,
    at: "Brokerages are open. Here's what one takes, and how far you are.",
    // The director: the line stands without the gap until the economy sizes the brokerage's costs.
    reason: "What a brokerage takes is on its card.",
    /** The writer's, for when the gap can be shown: */
    reasonGap: (gap: string) => `Bond, licence and premium: you're ${gap} FD short.`,
    reasonReady: "You have what it takes.",
    beforeButton: "What it takes",
    button: "What it takes",
  },
  /** More › Iuliia (guidance-ux.md section 4): drafts. */
  timeline: "Your company so far",
  timelineNone: "Nothing yet. The company's firsts land here as they happen.",
  nextOnRoad: "Next on the road:",
  nextTruck: (fd: string) => `your next truck, ${fd} FD away`,
  nextLayer: (what: string, date: string) => `${what} open ${date}`,
  nextMonth: (n: number) => `your first month closes in ${n === 1 ? "1 day" : `${n} days`}`,
  noDate: "no date",
};

/**
 * A player's brokerage (the writer's brokerage-strings.md, draft 1): the company switch and the brokerage's bar. The
 * screens are shells until the brokerage build lands with the economy's sizes; only the strings they use are here.
 */
/** A name's possessive: Logistics', Ridgeline's. */
export const poss = (name: string): string => (name.endsWith("s") ? `${name}'` : `${name}'s`);

export const BROKERAGE = {
  chipLabel: (name: string) => `Company in view: ${name}`,
  chipLaptop: (name: string) => `${name} ▾`,
  sheetTitle: "Your companies",
  kindCarrier: "Carrier",
  kindBrokerage: "Brokerage",
  row: (name: string, kind: string, fd: string) => `${name} · ${kind} · ${fd} FD`,
  inView: "In view",
  stateLine: (name: string, n: number) => `${name} · ${n} loads posted`,
  bookHeader: (name: string, n: number, fd: string) => `${name} · ${n} loads · ${fd} FD margin this month`,
  groups: ["On the board", "Moving", "Waiting for pay"] as const,
  // Offered to you: the held tenders (the writer's card and actions; the deadline, the default line, the chip and the
  // order's switch are UX's, brokerage-ux.md draft 2, for the writer).
  offered: "Offered to you",
  shipperPays: (fd: string) => `Shipper pays ${fd} FD`,
  wouldPost: (fd: string, pct: string) => `You'd post at ${fd} (your ${pct} margin)`,
  boardFee: (fd: string) => `Board fee ${fd}`,
  postIt: "Post it",
  decline: "Decline",
  decideBy: (hh: string, h: number) => `Decide by ${hh} · ${h} h left`,
  ifNotPost: (pct: string) => `If you don't decide: your standing order posts it at a ${pct} margin.`,
  ifNotOwn: (carrier: string) => `If you don't decide: your standing order offers it to ${carrier} first.`,
  ifNotDecline: "If you don't decide: it goes to another broker or the open board.",
  fromChip: (carrier: string) => `Passed by ${carrier}`,
  ownFirst: (carrier: string) => `Offer to ${carrier} first`,
  posted: (rate: string, hh: string, wait: string) => `Posted at ${rate}/mi · clears ${hh} · in ${wait}`,
  bookEmpty: (hh: string) => `No loads yet. Shippers offer loads to brokers every round; yours start at ${hh}.`,
  whoMayHaul: "Who may haul your loads",
  haulers: "Carriers who've hauled for you",
  cash: (fd: string) => `Cash · ${fd} FD`,
  owedToYou: "Owed to you",
  owedByYou: "Owed by you",

  // Before day 91: the teaser.
  teaserWhat: "Your own brokerage: a second company that posts freight for other carriers to haul.",
  teaserTakes: (bond: string) => `You'll need an active carrier and ${bond} FD for the bond.`,
  teaserButton: "See what brokers earned last month",
  // From day 91: starting one.
  startCard: "Start a brokerage",
  notYetLead: "What it takes, and how far you are:",
  rowActive: (yours: boolean) => `An active carrier · ${yours ? "yours is" : "yours isn't"}`,
  rowBond: (bond: string, have: string) => `Bond: ${bond} FD · you have ${have} FD`,
  rowLicence: (licence: string) => `Licence: ${licence} FD`,
  shortBond: (fd: string) => `You're ${fd} FD short.`,
  earnedLink: "What brokers earned last month ›",
  moreRow: (name: string) => `${name} ›`,
  stepCounter: (n: number) => `Step ${n} of 3`,
  back: "Back",
  next: "Next",
  step1: "Name your brokerage",
  nameField: "Brokerage name",
  defaultName: (carrier: string) => `${carrier} Logistics`,
  homeHub: (hub: string) => `Home hub: ${hub}`,
  /** UX's line under the hub (the director: it doesn't follow the carrier). */
  homeFixed: "Fixed for the brokerage's life",
  step2: "What it costs, and how you fund it",
  rowLicenceCost: (licence: string) => `Licence · ${licence} FD a season · a cost`,
  rowBondHeld: (bond: string) => `Bond · ${bond} FD · held, not spent, while you broker`,
  rowSurety: (fd: string, band: string) => `Surety · about ${fd} FD a year at credit ${band} · a cost`,
  bondNote: "If you can't pay a carrier, the bond does. You can never owe carriers more than it.",
  graceNote: (days: number) => `Fall under your bond and new loads stop after ${days} days.`,
  betaNote: "Beta bond: it's burned at the token's launch, like every beta stake. To broker after launch, post it again.",
  moving: (carrier: string, fd: string) => `Moving from ${carrier} · ${fd} FD`,
  feeRow: (pct: string, fd: string) => `Fee ${pct} · ${fd} FD`,
  cashAfter: (name: string, fd: string) => `${poss(name)} cash after · ${fd} FD`,
  brokerCashAfter: (name: string, fd: string, bond: string) => `${poss(name)} cash after · ${fd} FD, ${bond} of it the bond`,
  capitalNote: "Your own capital, moved between your companies. It's not revenue or a cost for either.",
  noGrant: "There's no starting grant: the money comes from your carrier.",
  ownCredit: "Your brokerage starts with its own credit, not your carrier's.",
  wouldBeShort: (carrier: string, fd: string) => `${carrier} would be ${fd} FD short.`,
  nextDisabled: "Not enough for the bond yet.",
  step3: "Your terms",
  rowMargin: (pct: string) => `Your margin: ${pct} of each load`,
  rowOpenLoads: (n: number) => `Open loads, at most: ${n}`,
  whoMayHaulRow: "Who may haul your loads",
  vetting: ["Open", "Standard", "Strict"] as const,
  vettingLines: (std: number, strict: number, delivered: number) => ["Any carrier", `${std} days of authority`, `${strict} days and ${delivered} loads delivered`] as const,
  tighter: "Tighter is safer, and slower to fill.",
  confirmTitle: (name: string) => `Start ${name}`,
  sumName: (name: string, hub: string) => `Name · ${name}, home ${hub}`,
  sumFunding: (fd: string, carrier: string, fee: string) => `Costs and funding · ${fd} FD from ${carrier}, ${fee} FD fee`,
  sumTerms: (pct: string, n: number, vet: string) => `Terms · ${pct} margin, up to ${n} loads, ${vet}`,
  startButton: (name: string) => `Start ${name}`,
  switched: (name: string) => `You're in ${name} now. Your carrier is one tap away, top left.`,
  refuseActive: "Your carrier's authority must be active to start a brokerage.",
  refuseWinding: "Your carrier is being wound up.",
  refuseHasOne: "You already have a brokerage.",
  refuseBefore: (date: string) => `Brokerages open on ${date}.`,
  refuseAge: (n: number) => `Your carrier needs ${n} days of authority first.`,
  // Book.
  onBoard: (rate: string, hh: string, wait: string) => `Posted at ${rate}/mi · clears ${hh} · in ${wait}`,
  takenBy: (carrier: string, rate: string) => `Taken by ${carrier} at ${rate}/mi`,
  waitingPay: (date: string, carrier: string, date2: string) => `Shipper pays you ${date} · you pay ${carrier} ${date2}`,
  cardLine2: (shipper: string, carrier: string, fee: string, yours: string) => [`Shipper ${shipper} · carrier ${carrier} · fee ${fee} · `, `yours ${yours} FD`] as const,
  yoursChip: "Yours",
  // Carriers.
  haulerRow: (name: string, n: number) => `${name} · ${n} loads for you`,
  standingOrder: "Your standing order",
  marginField: "Margin",
  openLoadsField: "Open loads, at most",
  save: "Save",
  // Money.
  riskLine: (pct: string) => `About ${pct} of loads are never paid, more in a slump.`,
  bondMeter: (fd: string, bond: string) => `${fd} of your ${bond} FD bond in use`,
  atBond: "New loads pass you by until this falls.",
  ownPaper: (days: number) => `Paid at net ${days}, never factored: it's between your own companies.`,
  capitalFrom: (carrier: string, fd: string) => `Capital from ${carrier}: ${fd} FD`,
  capitalTo: (carrier: string, fd: string) => `Capital to ${carrier}: ${fd} FD`,
  transfersFold: "Transfers",
  moveLink: "Move money ›",
  // Move money.
  moveTitle: "Move money",
  moveDirection: (from: string, to: string) => `From ${from} to ${to}`,
  swap: "Swap",
  amount: "Amount",
  allYouCan: "All you can",
  moveFee: (pct: string, fd: string) => `Fee ${pct} · ${fd} FD (to the reserve)`,
  arrives: (fd: string) => `Arrives · ${fd} FD`,
  moveAfter: (name: string, fd: string) => `${poss(name)} cash after: ${fd} FD`,
  moveNote1: "It counts as equity, not revenue: no profit, no Miles, no Intel figure.",
  moveNote2: "Logged in both companies' Money. Nobody else sees it.",
  moveButton: (fd: string) => `Move ${fd} FD`,
  refuseMoveWinding: (name: string) => `${name} is being wound up, so nothing can leave it.`,
  refuseMoveStake: (name: string) => `${name} is under its stake. Nothing leaves until it's back above.`,
  refuseMoveOverdue: (name: string) => `${name} has overdue invoices. Pay them first.`,
  refuseMoveNegative: (name: string) => `That would leave ${name} below zero.`,
  refuseMoveBond: (fd: string) => `The bond stays while loads are open. You may move up to ${fd} FD.`,
  // Pass to the brokerage (the carrier's direct-contract tender).
  passButton: (b: string) => `Pass to ${b}`,
  passUnder: (b: string) => `${b} takes the load under its bond. The shipper pays it; you neither bill nor owe.`,
  passRows: (b: string, fd: string, used: string, bond: string) => [`Shipper pays ${b} · ${fd} FD`, `Bond in use after · ${used} of ${bond} FD`] as const,
  passThen: (b: string) => [`Then · ${b} posts it, or tenders it to another carrier`, "Your contract · counts it covered once delivered"] as const,
  notNow: "Not now",
  refusePassBoard: "Only a load from your direct contract can be passed.",
  refusePassBond: (b: string) => `${b} would pass its bond. Pay carriers first.`,
  refusePassClosed: (b: string, why: string) => `${b} isn't taking loads: ${why}.`,
  refusePassWindow: "The tender's window has closed.",
  // Tender to the carrier (the brokerage's Book).
  tenderButton: (carrier: string) => `Tender to ${carrier}`,
  tenderRows: (fd: string, carrier: string) => [`Shipper pays you · ${fd} FD`, `You pay ${carrier}`] as const,
  allowed: (lo: string, hi: string) => `Allowed on this lane · ${lo}–${hi}/mi`,
  yourMargin: (fd: string) => `Your margin · ${fd} FD`,
  /** UX's line on a posting tendered to the owner's carrier. */
  tendered: (carrier: string) => `Tendered to ${carrier}`,
  /** UX's line (brokerage-ux.md section 7): the own carrier let the tender lapse, and the load went to the board at the offered rate. */
  lapsed: (carrier: string, rate: string) => `${carrier} didn't take it · posted at ${rate}/mi`,
  refuseNoTruck: (carrier: string) => `${carrier} has no free truck in reach of the pickup.`,
  /** The writer's (brokerage-strings.md), after QA's hold replay; ownFirstSkips names what the order's rule checks, a truck at the pickup's hub. */
  ownFirstSkips: (carrier: string, trailer: string, hub: string) => `${carrier} has no free ${trailer} at ${hub}, so your standing order would post it.`,
  ownFirstRate: (carrier: string) => `It goes to ${carrier} at your posting rate, within the lane's band. ${carrier} may still decline.`,
  saved: "Standing order saved.",
  licenceFromIt: (licence: string) => `Licence · ${licence} FD · paid out of the amount you move`,
  tenderNote1: (days: number) => `Paid at net ${days}, never factored: it's between your own companies.`,
  tenderNote2: "The load counts once for you, not twice.",
  tenderAt: (rate: string) => `Tender at ${rate}/mi`,
  refuseBand: (lo: string, hi: string) => `That's outside this lane's range: ${lo}–${hi}/mi.`,
  refuseNotDirect: "Only freight a shipper sent you directly can go straight to your carrier.",
  refuseCarrierCant: (carrier: string, why: string) => `${carrier} can't take it: ${why}.`,
  refusePassedBack: (carrier: string) => `${carrier} passed you this load. It can't go back: post it, or tender it elsewhere.`,
  // Intel.
  sameOwner: (other: string) => `Same owner as ${other} ›`,
};

/**
 * Cash it now (the writer's finance-strings.md, [switch cashNow]; UX's finance.md draft 2): any open invoice sold to
 * the NPC factor today. `rowLine` is UX's (the row's second line); the rest are the writer's.
 */
export const CASHNOW = {
  rowButton: "Cash it now",
  rowLine: (lands: string, fee: string) => [`Cash now: ${lands} lands`, `· fee ${fee}`] as const,
  /** The two figures' names on their explain sheets. */
  landsLabel: "You get today",
  feeLabel: "Fee",
  several: (n: number, fd: string) => `Cash ${n} invoices · ${fd} FD today`,
  sheetTitle: "Cash this invoice now",
  invoiceRow: (o: string, d: string, fd: string, date: string) => `Invoice · ${o} to ${d} · ${fd} FD, due ${date}`,
  feeContract: (rate: string, aging: string, n: number, fd: string) => `Fee · ${rate} contract + ${aging} at ${n} days old · ${fd} FD`,
  feeSpot: (spot: string, aging: string, n: number, fd: string) => `Fee · ${spot} spot + ${aging} at ${n} days old · ${fd} FD`,
  youGet: (fd: string) => `You get today · ${fd} FD`,
  note: (date: string) => `The shipper pays the factor on ${date}. The fee goes to the reserve.`,
  /** A brokerage's sheet only (brokerage-strings.md). */
  brokerNote: "Cashing it doesn't change what you owe carriers, or when.",
  button: (fd: string) => `Cash it now · ${fd} FD`,
  notNow: "Not now",
  cashed: (date: string, fd: string) => `Cashed ${date} · ${fd} FD received`,
  refusePaid: "This invoice is already paid.",
  refuseOwn: "Paper between your own companies can't be cashed early.",
  refusePlayer: "Invoices from player shippers can't be cashed early yet.",
  refuseLiquidation: "Your company is being wound up, so nothing can be cashed early.",
  refuseDueToday: "It's due today. It lands without a fee.",
  /** Finance › Open invoices (UX). */
  openHeader: (n: number, fd: string) => `Open invoices: ${n} · ${fd} FD`,
};
