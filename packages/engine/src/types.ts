import type { Equipment, FacilityType, TractorTier } from "@lanes/config";

/** "holder": a wallet outside the game that only holds and trades FD (the sim's speculators; no trucks, no permits, no costs). */
export type Role = "carrier" | "broker" | "holder";

/**
 * Standing orders: the small rule language shared by humans and bots
 * (§Load board — standing orders). Bots never bid any other way.
 */
export type StandingOrder =
  | {
      kind: "bid";
      equipment?: Equipment[];
      originHubs?: string[];
      /** Only consider loads whose ceiling pays at least this per mile. */
      minCeilingPerMile?: number;
      maxDeadheadMi: number;
      // "clearsNear" (R1's bid anchor): bid at what the load usually clears near (freight.ts clearsNear: the lane's trailing clears) plus pct,
      // with break-even as the floor.
      price: { mode: "ceilingPct"; pct: number } | { mode: "breakEvenPlus"; pct: number } | { mode: "clearsNear"; pct: number };
    }
  | {
      /** Never bid below lane break-even × (1 + pct). */
      kind: "floor";
      breakEvenPlusPct: number;
    }
  | {
      kind: "reposition";
      afterIdleRounds: number;
      /** openLoadsWithinMi: the hub in range with the most freight still uncovered after clearing. */
      to: "nearestStarterHub" | { openLoadsWithinMi: number } | { hubId: string };
    }
  | {
      /** Book loads at their book-now price between rounds when it clears break-even × (1 + pct); desperation lowers the pct. */
      kind: "bookNow";
      breakEvenPlusPct: number;
      maxDeadheadMi: number;
    }
  | {
      /** Bring drivers home after this many days out, for this many days off. */
      kind: "homeTime";
      afterDays: number;
      restDays: number;
    }
  | {
      /**
       * Contracts: take the offers local shippers make, and take their tenders onto an idle truck
       * within reach — unless spot is more than spotAbovePct above the contract rate (null: always honor).
       */
      kind: "contracts";
      acceptOffers: boolean;
      spotAbovePct: number | null;
      maxDeadheadMi: number;
    }
  | {
      /** Broker: accept tendered NPC freight and repost it at this margin. */
      kind: "broker";
      marginPct: number;
      maxOpenLoads: number;
      /** A player's brokerage (brokerage.ts): at a held tender's end, tender it to the own carrier first, inside the band. */
      ownFirst?: boolean;
    }
  | {
      /**
       * Double brokering on autopilot (fraud.ts): re-post this share of loads the
       * dispatcher wins (before pickup), keeping `keepPct` of the rate, and pay the
       * hauler or not.
       */
      kind: "rebroker";
      share: number;
      keepPct: number;
      pays: boolean;
    };

/** How legal a company runs (safety.ts). "hot": only on hot loads that need it. */
export type RuleScope = "legal" | "hot" | "always";
export interface CompliancePolicy {
  /** Falsified logs: 15 driving hours a day instead of 11. */
  hos: RuleScope;
  /** 56 mph instead of 50. */
  speed: RuleScope;
  /** Deferred: preventive maintenance skipped, so defects build up. */
  maintenance: "full" | "deferred";
}

/** What a poster requires of carriers: 0 open, 1 standard, 2 strict (tracking required). */
export type VettingTier = 0 | 1 | 2;

export type SafetyRating = "none" | "satisfactory" | "conditional" | "unsatisfactory";
export type Basic = "hos" | "unsafe" | "maintenance" | "crash";

/** A violation on the company's record (an inspection, a stop, a crash, an audit). */
export interface Violation {
  day: number;
  basic: Basic;
  points: number;
  what: string;
}

/** Something illegal nobody has found yet: a falsified log day, a week on deferred maintenance. */
export interface HiddenViolation {
  day: number;
  kind: "falseLog" | "maintenance";
  truckId: number;
}

export interface SafetyRecord {
  rating: SafetyRating;
  ratingDay: number | null;
  /** Next scheduled review (new-entrant audit, or a follow-up), or null. */
  reviewDay: number | null;
  /** Unsatisfactory: authority is revoked on this day unless a follow-up review clears it. */
  revokeDay: number | null;
  /** A crash or a run of alerts asked for a review now. */
  reviewWanted: boolean;
  violations: Violation[];
  inspections: number[];
  hidden: HiddenViolation[];
  crashes: { day: number; severity: CrashSeverity; atFault: boolean }[];
  /** BASIC measures and which are over threshold, recomputed weekly. */
  measures: Record<Basic, number>;
  alerts: Basic[];
  /** Insurance premium multiplier added by at-fault crashes; decays monthly. */
  insuranceSurcharge: number;
  finesFd: number;
  outOfService: number;
}

export type AuthorityStatus = "active" | "suspended" | "revoked";
export interface Authority {
  /** Day the current authority was granted (the MC's age, for vetting). */
  since: number;
  status: AuthorityStatus;
  suspendedUntil: number | null;
  /** Revoked: no new authority until this day (null = never). */
  barredUntil: number | null;
  revocations: number;
  crimes: number;
  /** Double-brokering convictions. */
  frauds: number;
  /** Day of the last revocation, for vetting ("linked to a revoked authority"). */
  lastRevokedDay: number | null;
  /** Plain-language history, newest last. */
  record: { day: number; text: string }[];
}

export type CrashSeverity = "pdo" | "injury" | "fatal";

/** A month-close record (intel.ts): a month behind, for the screens. */
export interface MonthRecord {
  revenueFd: number;
  loads: number;
  onTime: number;
  spentFd: number;
  closedDay: number;
}

export interface Company {
  id: number;
  name: string;
  role: Role;
  homeHub: number;
  /** Agent strategy label, used only for reporting ("greedy", "conservative", …). */
  strategy: string;
  /** Run by a person (the bad-actor actions can be locked to AI: config `fraud.players`). */
  human: boolean;
  /** Started on the free NPC-lease path (§Roles — carrier free start). */
  freePath: boolean;
  orders: StandingOrder[];
  reputation: number; // 0–1, used in bid scoring
  delivered: number;
  onTime: number;
  late: number;
  /** Miles earned this season. */
  milesTotal: number;
  /** Miles snapshotted at each completed season close (§Circular economy — points are snapshotted). */
  milesHistory: number[];
  milesByDay: { day: number; amount: number };
  lanePairToday: Map<number, number>; // laneId → loads counted today
  firstOwnedTruckDay: number | null;
  /** First day cash covered a Workhorse + dry van (free-path companies). */
  firstAffordDay: number | null;
  /** Day of the first bid or booking the owner placed by hand; freeEntry.firstBidByHand holds a one-truck company's standing orders until then. */
  firstHandBidDay: number | null;
  createdDay: number;
  /** Broker-only loads currently held. */
  openBrokerLoads: number;
  /** Cumulative: idle truck-rounds that bid, and how many of them won a load. Agents read these to tune prices. */
  bidStats: { truckRounds: number; wins: number };
  /**
   * Cumulative operating result. Carriers: freight revenue, and the costs of
   * earning it (trip costs, lease share, repairs, rebuilds), excluding fleet
   * overhead so agents can weigh one against the other. Brokers: what shippers
   * paid, against carrier pay and board fees.
   */
  operating: { revenueFd: number; costFd: number };
  /** Intel's month close (intel.ts): the counters at the start of this game month, and last month's record. Screens only. */
  monthMark?: { revenueFd: number; delivered: number; onTime: number; costFd: number; overheadFd: number };
  /** `spentFd`: operating costs and fleet overhead over the month. */
  lastMonth?: MonthRecord;
  /** The company's first month-close record, kept (Iuliia's first-month milestone). Screens only. */
  firstMonth?: MonthRecord;
  overheadPaidFd: number;
  /** Operating (unparked) truck-weeks, counted at each weekly overhead charge. */
  truckWeeks: number;
  /** Spending over the last few weeks (FD per week), for the season-close working-capital carryover. */
  weeklySpend: number[];
  lastOutflowCents: number;
  repossessions: number;
  usedBought: number;
  usedSold: number;
  /** Consecutive weekly checks more than the debt limit in the red. */
  weeksInDebt: number;
  /** Day liquidation began, or null when solvent. */
  liquidatingSince: number | null;
  /** Standing orders set aside while liquidating, restored on restart. */
  suspendedOrders: StandingOrder[];
  bankruptcies: number;
  /** Real money (buyback or token phase): outside dollars the owner will put in, and dollars put in and taken out so far. */
  usd: { wallet: number; in: number; out: number };
  /**
   * Spend-only FD lives in the ledger (ledger.locked): the launch carryover, a post-launch grant, the free path's
   * earnings, the airdrop paid locked, and locked FD received from other players. This is the part of it the free
   * path earned (freeEntry.freePath "spendOnly"), unlocked with the first owned truck.
   */
  freePathLockedFd: number;
  /** Staking (staking.ts): FD locked as the bond behind the licence, and FD in the exit queue with the day each slice clears. */
  stakedFd: number;
  unstaking: { fd: number; day: number }[];
  /** Day the grace period for being over a tier (or under the broker stake) runs out, null while within it. */
  tierGraceDay: number | null;
  /** FD bought on the exchange and not yet sold back (exchange.launchTax.boughtExempt): sold, it pays the normal fee, not the early-sale tax. */
  boughtFdOpen?: number;
  /** FD sold on the exchange today (the daily sell limit). */
  soldFd: { day: number; fd: number };
  /** Days with a sale on the exchange, within the frequency fee's window (token.exchange.frequency). */
  sellDays: number[];
  /** The bridge (token.bridge): withdrawals waiting out the timer, the FD frozen in the company's bridge account. */
  withdrawals: { fd: number; day: number }[];
  /** Spend-only FD the yard was bought with: its resale returns proceeds locked up to it. */
  yardLockedBasisFd?: number;
  /** A wallet outside the game (adversaries.onChain): trades meet the pool alone, never the bridge. */
  onChain?: boolean;
  /** Payment terms (receivables.ts): wait for the due day, take quick pay, or factor the invoice. */
  payTerms: "net" | "quick" | "factor";
  /** The factoring contract in force: its term and the stake locked behind it (receivables.ts). */
  factoring: {
    until: number;
    stakeFd: number;
    /**
     * The contract (token.payment.factoring.contract): the discount per invoice, fixed for the term; the fleet it was set
     * by; whether it renews at term (else it lapses into `thenTerms`, net by default); the trucks it covers when it isn't
     * whole-fleet; and its line in the world's factoring log.
     */
    rate?: number;
    trucks?: number;
    renew?: boolean;
    thenTerms?: "net" | "quick";
    truckIds?: number[];
    log?: number;
  } | null;
  /** The deductible stake behind a pool-written insurance policy (insurance.ts). */
  insuranceStakeFd: number;
  /** Staking locks (token.staking.lockDiscounts; staking.ts): FD locked for a term at its discount, with the discounts it has given. */
  locks?: StakeLock[];
  /** The population dial (population.ts): the day a simulated carrier began to wind down, and the day it left the market. */
  windingDownDay?: number;
  retiredDay?: number;
  /** The payment record behind the credit score (credit.ts): invoices paid with cash in hand, and from an overdraft or never. */
  credit: { onTimeFd: number; lateFd: number };
  /** Carriers: the lowest broker credit this company hauls for. */
  minBrokerCredit: number;
  /** Gallons burned this month, on the road and idling, for the monthly fuel tax (fuelTax.ts). */
  fuelGalMonth: number;
  /** Where the fleet sleeps, as theft exposure: the running average of its nights' risk × parking (risk.ts), for its insurance. */
  nightRisk: number;
  /** The catalogue (items.ts): the yard, its bond, and dollars spent in the farming season's window. */
  yard: "none" | "small" | "large";
  /** Extra trailer space bought for the yard (assets.yard.spacePerPurchase each). */
  trailerSpaces: number;
  /** Yard security installed (robbery.lot.yard). */
  yardSecurity?: Partial<Record<YardItem, boolean>>;
  /** Heat (robbery.lot.heat): the law's interest in this company, 0–100, private to it. */
  heat?: number;
  yardBondFd: number;
  usdSpentBeta: number;
  /** Dollars spent on rigs and trailers in the farming season (catalogue.usdWindow.assets). */
  usdSpentBetaAssets: number;
  /** Brokers: who carries the bond this term, the surety pool or the NPC surety, and what the bond has paid out on this company so far. */
  suretyWriter: "pool" | "npc";
  suretyClaimedFd: number;
  /** Miles and operating result at the start of the current airdrop season (token.ts seasons). */
  seasonBase: { miles: number; profit: number };
  airdrop: Airdrop | null;
  /** Loads delivered, brokered or shipped this week (airdrop unlocks). */
  loadsThisWeek: number;
  /** Operating result (freight and facilities) at the last profit-tax week. */
  taxBaseFd: number;
  /** Player brokerages (brokerage.ts): the owner's other company, the carrier's brokerage or the brokerage's carrier. */
  partnerId?: number;
  /** The Reserve (cashReserve.ts): its lowest balance this week, and withdrawals on their way to cash. */
  reserveLowFd?: number;
  reserveOut?: { fd: number; day: number }[];
  /** Rule A, as a standing choice: a direct contract tender this carrier's trucks don't take is passed to its brokerage before it lapses. */
  passTenders?: boolean;
  /** A player brokerage across the launch reset (brokerage.ts): the part of its beta bond kept behind the paper open at the reset, what that paper has drawn from it since, and the paper. */
  launchBond?: { heldFd: number; drawnFd: number; paper: number[] };
  /** The owner dispatching their own trucks (labor.ts): skill grows with loads dispatched. */
  ownerDispatch: { skill: number; potential: number; experience: number; learned: number };
  policy: CompliancePolicy;
  safety: SafetyRecord;
  authority: Authority;
  /** Vetting this company requires on freight it posts (brokered loads, facility loads). */
  vetting: VettingTier;
  /** The engine keeps seats filled: hires drivers for empty trucks and dispatchers past the owner's span. */
  autoStaff: boolean;
  /** R8 (guard.hireCoverWeeks): the hire auto-staff held back on its last pass, for want of cash cover; null when none. */
  hireBlock?: { staffId: number; kind: Staff["kind"]; weeklyFd: number; needFd: number; day: number } | null;
  /** Passes on which auto-staff held a hire back (R8's sizing). */
  hireBlockedDays?: number;
  /** R16 (labor.underpayMemory): drivers ask more of this company until this day, after one left it unhappy. */
  underpaidUntilDay?: number;
  /** Local shippers pass this carrier over until this day (turned-down contract tenders). */
  localBanUntilDay: number;
  /** Moving average of contract tenders accepted, across contracts (offers go to the reliable). */
  tenderAcceptance: number;
  /** Open claims against this company (theft, unpaid carriers), by the day each expires. */
  claims: { day: number; until: number; kind: "theft" | "unpaid" }[];
  /** Owed on a judgment or seizure, paid out of whatever the company still has. */
  judgmentFd: number;
  /** The company's insurance policy (insurance.ts). */
  insurance: InsurancePolicy;
}

/** A one-game-year insurance policy: the price per truck is fixed for the term. */
/** The catalogue (items.ts): yards, and the upgrades a truck can carry. */
export type TruckMod = "apu" | "aero" | "tires" | "sleeper";
/** Yard security (robbery.lot.yard): a gate, cameras, lighting, a guard; each cuts a crew's odds at the yard. */
export type YardItem = "yardGate" | "yardCameras" | "yardLighting" | "yardGuard";
export type ItemKind = "yardSmall" | "yardLarge" | "trailerSpace" | TruckMod | YardItem;

/** A player-funded pool (pools.ts): units at net asset value, an exit queue, and the line's running income and losses. */
export type PoolLine = "insurance" | "factoring" | "surety";

/** Freight pay owed under payment terms (receivables.ts): who pays, who is owed, and who holds the paper. */
/**
 * The factoring log (receivables.ts), kept while payment terms are on: every contract signed or renewed (the old
 * one-year contract too) with what it factored and the discounts it paid, the brokers' bond at work, and each
 * liquidation with the owned trucks it took, for the report.
 */
export interface FactoringLog {
  contracts: { companyId: number; day: number; trucks: number; rate: number; renewal: boolean; broker: boolean; invoicesFd: number; feesFd: number }[];
  /** Cash now (token.payment.cashNow): invoices cashed, their face, the fees, and the cash-ins under a contract. */
  cashNow?: { invoices: number; fd: number; feeFd: number; underContract: number; companies: number[] };
  lapses: number;
  /** Broker tenders some broker had to pass up at its posted bond (the AP cap), those no broker could take (they went to the open board), and bids and bookings refused on brokers' loads. */
  tendersCapped: number;
  tendersToBoard: number;
  bookingsCapped: number;
  /** Brokers' paper paid from the bond because their cash couldn't, and the part of it that went to the NPC factor or lessor. */
  bondPaidFd: number;
  bondToNpcFd: number;
  /** NPC-held paper (the factor's, the lessor's) its broker never paid, and paid from an overdraft: the faucet the cap closes. */
  uncoveredFd: number;
  overdraftFd: number;
  /** Brokered and direct loads delivered, and their pay to the carrier (for the brokered-freight check). */
  brokered: { loads: number; payFd: number; miles: number };
  direct: { loads: number; payFd: number; miles: number };
  liquidations: { companyId: number; day: number; ownedTrucks: number }[];
  /** The day each company first ran an owned truck (an ordered one counts from its delivery). */
  firstInService: Record<number, number>;
  /** The last day a broker heard it was at its bond, so the notice comes once a day. */
  capNoticeDay: Record<number, number>;
}

/** A staking lock (staking.ts): `fd` locked from `startDay` to `endDay` at `rate` off, up to `budgetFd` of discounts over the term. */
export interface StakeLock {
  id: number;
  fd: number;
  months: number;
  startDay: number;
  endDay: number;
  rate: number;
  budgetFd: number;
  usedFd: number;
  roll: boolean;
}

/** The population dial's state (population.ts), kept while it is on. */
export interface PopulationState {
  /** The last `windowDays` days' loads posted per truck in service. */
  daily: number[];
  /** Their mean, and where it sits against the band. */
  mean: number;
  state: "within" | "under" | "over";
  /** Bot carriers held from a restart (retired), wound down, and entered; with the days the dial sat under and over the band. */
  retired: number;
  woundDown: number;
  entered: number;
  daysUnder: number;
  daysOver: number;
}

export interface Receivable {
  id: number;
  /** Company id, or 0 for an NPC payer drawing on `faucet`. */
  payer: number;
  faucet?: string;
  payeeId: number;
  amountFd: number;
  dueDay: number;
  /** The payee's id, or HOLDER_POOL (factored to the pool) or HOLDER_NPC_FACTOR. */
  holder: number;
  /** A player shipper's paper for its facility freight (receivables.ts Bill.shipperPaper): never treated as bonded. */
  shipperPaper?: boolean;
}
export interface Pool {
  shares: Map<number, number>;
  totalShares: number;
  exiting: { companyId: number; shares: number; day: number }[];
  premiumsFd: number;
  claimsFd: number;
  /** Losses the pool could not pay (the NPC backstop is deemed to carry them). */
  shortfallFd: number;
  /** The line's exposure: annual premiums of the policies the pool has written. */
  exposureFd: number;
}

export interface InsurancePolicy {
  annualPerTruck: number;
  signedDay: number;
  renewDay: number;
  /** Who wrote it (pools.ts): the player-funded pool, or the NPC insurer as the dearer backstop. */
  writer: "pool" | "npc";
  /** What went into the price when it was signed. */
  risk: number;
  garaging: number;
  market: number;
}

/** People from the labor pool; the CEO, security manager and sales rep are the optional roles (labor.managers.roles). */
export type StaffKind = "driver" | "dispatcher" | "opsManager" | "maintManager" | "ceo" | "securityManager" | "salesRep";
/** Every staff kind past the drivers and dispatchers: salaried by the week, learning by the week on the job. */
export type ManagerKind = "opsManager" | "maintManager" | "ceo" | "securityManager" | "salesRep";
export type StaffStatus = "pool" | "employed" | "jailed" | "gone";

/** A driver or dispatcher (labor.ts). */
export interface Staff {
  id: number;
  kind: StaffKind;
  name: string;
  /** The portrait's look, matching the first name (cosmetic: nothing in the rules reads it). */
  look: "m" | "f";
  /** 0–1, shown as 1–5 stars; grows with experience toward `potential`. */
  skill: number;
  potential: number;
  /** Drivers: miles driven; dispatchers: loads dispatched. Counted since the last skill update in `pending`. */
  experience: number;
  pending: number;
  /** Over market pay, what this person asks. */
  personal: number;
  /** 0–1: how much they mind being pushed to break the rules (and how likely to refuse). */
  integrity: number;
  morale: number;
  status: StaffStatus;
  /** Employer, 0 in the pool. */
  companyId: number;
  /** Drivers: their truck, 0 for none. */
  truckId: number;
  /** Drivers: FD per mile; dispatchers: FD per week. */
  pay: number;
  hiredDay: number;
  /** The company's owner: never quits, can't be poached, fired or hired. */
  owner: boolean;
  /** Jailed until this day. */
  releaseDay: number | null;
  /** Weeks without a truck (drivers); they walk after a while. */
  unseatedWeeks: number;
  /** An offer from another company, waiting on the current employer to match it. */
  offer: { companyId: number; pay: number; truckId: number; day: number } | null;
  /** Pay the employer matched to keep them, and when: a cut below it soon after is a broken promise. */
  matchedPay: number;
  matchedDay: number;
  /** The most they've been paid lately: a raise only lifts morale above it, so a cut-and-restore isn't a raise. */
  peakPay: number;
  /** R16: on notice for being unhappy (labor.unhappyNoticeDays); a raise to their ask withdraws it. */
  unhappyNotice?: boolean;
  /** Career record any employer can see. */
  violations: number;
  crashes: number;
  /** Drivers: consecutive days away from the home hub, and consecutive days off at home. */
  awayDays: number;
  restDays: number;
  /** 0–1 (labor.ts dailyDrivers): weeks on the road and long days build it; days off at home reset it. */
  fatigue: number;
  /** Fatigue absorbed before it counts, banked by days off past the reset. */
  buffer: number;
  /** Consecutive days over the long-day limit before today. */
  longDays: number;
  /** Minutes at the wheel today (a team splits the truck's). */
  drivenMinToday: number;
  /** On home time until this day: the dispatcher leaves the truck alone. */
  homeUntilDay: number | null;
  /** Heading home for days off (a home-time order or send_home). */
  wantsHome: boolean;
}

/** An open fraud investigation (fraud.ts). */
export interface FraudCase {
  id: number;
  kind: "theft" | "doubleBroker";
  companyId: number;
  /** Who lost money: a broker, a shipper, or the carrier left unpaid (0: an NPC). */
  victimId: number;
  loadId: number;
  resolveDay: number;
  caught: boolean;
  /** Theft: the fence's payout if the case goes cold. Double brokering: the spread kept. */
  amountFd: number;
  /** What the victim lost, for restitution. */
  lossFd: number;
  /** A broker's cargo claim, held until the case resolves. */
  escrowFd: number;
  /** Theft: the truck that carried it, and who was driving (they go to jail with the owner). */
  truckId: number;
  driverId: number;
  /** Double brokering: the carrier who hauled and wasn't paid, if any. */
  unpaidCarrierId: number;
}

export interface Airdrop {
  totalFd: number;
  unlockedFd: number;
  /** logbook.paidLocked: the allocation's spend-only part not yet unlocked for withdrawal (bookkeeping; the ledger holds the lock). */
  lockedFd?: number;
  forfeitedFd: number;
  /** Unlocked but waiting for room under the supply ceiling (ceiling.ts): owed, paid as room comes back. */
  queuedFd: number;
  weeksLeft: number;
  claimedEarly: boolean;
  /** The logbook (token.airdrop.logbook): milestones in place of the weekly vest. */
  logbook?: Logbook;
}

/** The logbook (logbook.ts): an allocation paid out for milestones, opened at launch or a later season. */
export interface Logbook {
  startDay: number;
  /** After this day what's still locked is never minted. */
  deadlineDay: number;
  /** The allocation it opened with: each milestone unlocks its share of what the opening payment left. */
  allocationFd: number;
  /** Milestones reached, in order. */
  done: string[];
  /** Where the company stood when it opened: progress counts from here. */
  base: { onTime: number; delivered: number; profitFd: number; ownedTrucks: number };
  /** Counted since it opened: loads handled (delivered, brokered or shipped), contract terms kept, crew hits and rigs, the criminal take, cases gone cold. */
  handled: number;
  contractsKept: number;
  hits: number;
  rigs: number;
  takeFd: number;
  coldCases: number;
  closed: boolean;
  /** Milestones bought forward (logbook.boost). */
  boosts?: string[];
}

/**
 * "parked": owned but not registered to operate — can't haul, pays no fleet overhead, pays the idle fee.
 * "listed": for sale on the used market (off the road). "retired": out of the game — a returned NPC
 * lease, or a repossessed truck that went back to dealer supply unsold.
 */
export type TruckStatus =
  | "idle"
  | "toPickup"
  | "loading"
  | "loaded"
  | "unloading"
  | "repositioning"
  | "repair"
  | "parked"
  | "listed"
  | "retired";

/**
 * "npc": the free path's one NPC-leased Workhorse + dry van. "lessor": an extra
 * truck leased from the NPC lessor by a carrier that already owns one (free
 * entry), on the same terms. "owned": bought from the dealer or the used market.
 */
export type LeaseKind = "npc" | "lessor" | "owned";

export interface Truck {
  id: number;
  companyId: number;
  /** Spend-only FD this truck was bought with (ledger.ts locks): a sale, a write-off or scrap returns proceeds locked up to it. */
  lockedBasisFd?: number;
  /** The part of its lease deposit that was paid with spend-only FD, refunded locked. */
  depositLockedFd?: number;
  lease: LeaseKind;
  tier: TractorTier;
  trailer: Equipment;
  status: TruckStatus;
  hub: number; // current market when idle; the leg's origin market otherwise
  targetHub: number;
  /** The place the truck stands at (or left), and the place it's heading for. */
  place: number;
  targetPlace: number;
  remainingMi: number;
  loadId: number | null;
  /** Start of the current 24-hour duty day, or null before the first one. */
  shiftStartT: number | null;
  shiftDrivenMin: number;
  /**
   * R12, set only while its keys are on (a run at the defaults leaves them unset): when the truck last stopped driving
   * (the 11 hours reset after hos.restHours off), the shift whose break it took, minutes left of a break or a fuel stop,
   * and miles since its last fuel stop.
   */
  offDutySinceT?: number;
  breakShiftT?: number;
  /** R12's weekly clock (hos.cycleHours), set only while it's on: driving minutes since the last restart, and when it last drove. */
  cycleMin?: number;
  cycleLastT?: number;
  pauseMin?: number;
  fuelMi?: number;
  /** Minutes left loading or unloading. */
  dwellMin: number;
  /** Minutes left stopped after a breakdown (tow and repair). */
  breakdownMin: number;
  /** When a rebuild in the shop finishes. */
  repairUntilT: number | null;
  /** Lifetime miles (drives the million-mile level) and miles since the last rebuild (drives wear). */
  odometer: number;
  milesSinceRebuild: number;
  /** Rebuilds so far (assets: a tractor takes assets.tractor.maxRebuilds, then runs out its life). */
  rebuilds: number;
  /**
   * Assets (tractors and trailers apart): the trailer it pulls (0 with assets off, where `trailer` alone
   * says what it pulls), and that trailer's wear 0 (fresh) → 1 (worn), cached for running costs.
   * `trailer` stays the type of the trailer it pulls, so freight matching reads it as before.
   */
  trailerId: number;
  trailerWear: number;
  /**
   * Assets, player lessors: the company that owns the tractor when it runs under another's authority
   * (0 when the operator owns it), its weekly rent, and the day its minimum term ends.
   */
  lessorId: number;
  leaseWeekFd: number;
  leaseMinUntilDay: number;
  /** In-game day the truck was built (negative for trucks older than the world). Drives the "year" in its used value. */
  builtDay: number;
  idleRounds: number;
  idleSinceDay: number;
  /** Game minute the truck last went idle (for the client's idle clock; nothing decides on it). */
  idleSinceT: number;
  /** Last round in which this truck had loads in range but none it would take at their ceilings. */
  pricedOutRound: number;
  /** Miles driven since the last settlement, split for cost accounting. */
  emptyMi: number;
  loadedMi: number;
  /** Lessor trucks: the day the lease began, and the lease share paid this week (against the minimum rent). */
  leasedDay: number | null;
  leaseShareWeekFd: number;
  /** An NPC lease priced by value (freeEntry.leases.byValue): the deposit the lessor holds, and what it's owed in all. */
  depositFd: number;
  depositDueFd: number;
  /** Security fittings against hired robbers (robbery.ts). */
  security?: Partial<Record<"tracker" | "locks" | "camera", boolean>>;
  /** Drivers (labor.ts): the driver, and a co-driver for a team (0 = none). */
  driverId: number;
  coDriverId: number;
  /** Upgrades fitted (items.ts): an APU halves idle fuel, an aero kit saves fuel, premium tires maintenance, a sleeper per diem. */
  mods: Record<TruckMod, boolean>;
  /** Cached from the crew and the company's policy (labor.syncTruck): pay per mile, the driver's skill, cost multipliers. */
  wagePerMile: number;
  driverSkill: number;
  maintPolicyMult: number;
  insuranceMult: number;
  /** Brake, tire and light defects from deferred maintenance (safety.ts). */
  defects: number;
  /** Minutes driven past the legal limit in the current duty day. */
  overMin: number;
  /** Days with falsified logs, recent first window (roadside inspections look back 8 days). */
  logDays: number[];
  /** The current leg (origin, target, loaded) and the next weigh station on it. */
  legKey: number;
  legMiles: number;
  nextStation: number;
  /** Tolls still to be paid on this leg (charged as the miles are settled), and the share of it on two-lane highway. */
  legTollFd: number;
  legHighwayShare: number;
  /** The leg's terrain (data/terrain.ts): meters climbed, miles on mountain grades, miles above the pass elevation. */
  legClimbM: number;
  legMountainMi: number;
  legPassMi: number;
  /** The shift whose night on the road has been charged (sites.ts parkForTheNight), so a night is charged once; and the site the truck sleeps at, 0 on the shoulder or none. */
  restShiftT: number | null;
  restSite: number;
}

/**
 * A trailer (assets): its own asset, with its own wear and life. "hooked": behind a tractor;
 * "dropped": waiting in its owner's yard at the home hub; "listed": for sale on the used market;
 * "gone": scrapped, stolen, written off, or a rental or NPC trailer handed back.
 * "owned": the company's; "rental": rented by the week from the NPC lessor; "npc": part of an
 * NPC lease (the free path's rig, an extra lease).
 */
export type TrailerStatus = "hooked" | "dropped" | "listed" | "gone";
export interface Trailer {
  id: number;
  /** The company that has it (owns or rents it); 0 once gone. */
  companyId: number;
  /** Spend-only FD it was bought with: a sale, a write-off or scrap returns proceeds locked up to it. */
  lockedBasisFd?: number;
  type: Equipment;
  lease: "owned" | "rental" | "npc";
  status: TrailerStatus;
  /** The tractor pulling it, 0 when it isn't hooked. */
  truckId: number;
  /** Where it was dropped. */
  hub: number;
  odometer: number;
  milesSinceRefurb: number;
  refurbs: number;
  builtDay: number;
  /** Rentals: the day the rental began, and the rent paid so far (the minimum term is owed on return). */
  rentedDay: number;
  rentPaidFd: number;
  /** In the shop for a refurbishment until then (it can't be hooked). */
  refurbUntilT: number | null;
}

/** "expired": nobody hauled it before the shipper gave up (board.giveUpAfterRounds); the freight is lost. */
export type LoadStatus = "open" | "assigned" | "inTransit" | "delivered" | "expired";

/** Player brokerages (brokerage.ts): what the rule did in this world, for the reports. */
export interface BrokerageLog {
  /** Each pair formed: when, the capital it started with, the capital moved each way since and the fees on it. */
  formed: { day: number; carrierId: number; brokerId: number; capitalFd: number; toBrokerFd: number; toCarrierFd: number; feeFd: number; marks?: { days: number; operatingFd: number; gainFd: number }[] }[];
  /** Batch scenario (ruleBots.ts): carriers not chosen to form one that could have, and the day they first could (the control group). */
  controls: { carrierId: number; day: number }[];
  transfers: number;
  transferFd: number;
  feeFd: number;
  /** Transfers into a company with negative cash or weeks in debt. */
  rescues: number;
  rescueFd: number;
  refused: Record<string, number>;
  passes: number;
  passesBooked: number;
  passesFellOff: number;
  ownTenders: number;
  ownTendersBooked: number;
  ownTenderFd: number;
  /** Booked own tenders: the pay over the lane's trailing clearing rate (brokerage.ts laneRate), summed (the rate flag), and at the band's edges. */
  ownRateOverRef: number;
  ownAtEdge: number;
  /** A brokerage's board loads won by its own carrier, and their rate over the lane's trailing clearing rate. */
  ownBoardWins: number;
  ownBoardRateOverRef: number;
  /** Every board booking (sealed bid, book-now, tender) within 0.2–5× the lane's trailing clearing rate: count and rate over it, for the comparison. */
  clears: number;
  clearsRateOverRef: number;
  /** Loads not counted twice for one person (logbook loads, broker Miles). */
  countedOnce: number;
  /** The lane's band (brokerage.ts laneRate): trailing cleared rate per mile by lane id, and by origin hub and trailer, each [level, clears]. */
  laneRates: Record<string, [number, number]>;
  hubRates: Record<string, [number, number]>;
  /** The launch reset (brokerage.ts launchHold): beta bond kept behind open paper, what that paper drew from it, what burned once it was paid, and the days it took. */
  /** Tenders held for player brokerages: how many, and how each hold ended. */
  holds: { held: number; postedByOrder: number; postedByHand: number; declined: number; toOwn: number; passedPosted: number };
  launchHeldFd: number;
  launchDrawnFd: number;
  launchLateBurnFd: number;
  launchHoldDays: number[];
}

export interface Load {
  id: number;
  laneId: number;
  origin: number;
  dest: number;
  miles: number;
  equipment: Equipment;
  brokerId: number | null;
  /** Player shipper (a facility owner) who posted this load, or null for NPC freight. */
  shipperId: number | null;
  facilityId: number | null;
  /** What the NPC market pays the player shipper on delivery (FD, whole load). */
  saleValue: number;
  /** What the NPC shipper pays per mile (to the broker, or to the carrier if direct). For brokered loads, the broker's contract rate. */
  shipperRate: number;
  /** What an NPC shipper would pay per mile on the spot market when this was posted. */
  spotShipperRate: number;
  refRate: number;
  /** Current board ceiling per mile. */
  ceiling: number;
  /** Take-it-now price per mile the poster set (board.ts bookLoad); a sealed bid never pays more. */
  bookNow: number;
  /** R11 (bookNow.towardCeilingRounds): the book-now it opened at, kept at its first rollover. */
  bookNowOpen?: number;
  postedRound: number;
  roundsUnfilled: number;
  status: LoadStatus;
  carrierId: number | null;
  truckId: number | null;
  clearedRate: number;
  dueT: number;
  /** A hot load's premium over the reference rate (0 if not hot): it pays for a window a solo driver can only make by breaking the rules. */
  hot: number;
  /** What the poster requires of carriers. Strict (2) requires tracking. */
  vet: VettingTier;
  /** What the goods are worth (FD), for theft and claims. */
  cargoValue: number;
  /** Re-posted by the carrier that won it (double brokering): who, at what rate it was won, and whether they'll pay. */
  doubleBroker: { companyId: number; upstreamRate: number; pays: boolean } | null;
  /** What's in the trailer (packages/data commodities.ts), and the places it ships between (origin/dest are their markets). */
  commodity: number;
  originPlace: number;
  destPlace: number;
  /** The delivery appointment, set when posted: due is never later than this. Perishables spoil past it. */
  appointmentT: number;
  /** An appointment load's delivery slot, set at booking (docks.ts); 0 for first come, first served. */
  slotT: number;
  /** The road route between the places: driving hours and tolls. */
  routeHours: number;
  routeTollFd: number;
  /** Local-first: held for carriers based near the origin through this round (0: open to all). */
  localUntilRound: number;
  /** A contract tender: the carrier it's held for until `tenderUntil`, and the contract. */
  contractId: number;
  tenderedTo: number;
  tenderUntil: number;
  /** Rule A (brokerage.ts): the carrier that passed this direct contract tender to its brokerage; it is never tendered back to it. */
  passedBy?: number;
  /** Rule B: a tender from the broker to its own carrier at this pay per mile, inside the lane's band. */
  ownTenderRate?: number;
  /** A shipper's tender held off the board for a player's brokerage until `until` (brokerage.ts): it posts, tenders to its own carrier or (unless passed) declines. */
  hold?: { brokerId: number; until: number; declinable: boolean };
}

/** A contract lane a local shipper gives a carrier: a weekly volume at a fixed rate for a term (contracts.ts). */
export interface Contract {
  id: number;
  carrierId: number;
  origin: number;
  dest: number;
  laneId: number;
  equipment: Equipment;
  originPlace: number;
  destPlace: number;
  ratePerMile: number;
  loadsPerWeek: number;
  startDay: number;
  endDay: number;
  offerExpiresDay: number;
  tendered: number;
  accepted: number;
  /** Moving average of tenders accepted. */
  acceptance: number;
  /** Already cut for rejections this term. */
  cut: boolean;
  status: "offered" | "active" | "ended";
  /** Direct freight (contracts.direct): the performance stake locked against it while it's active. */
  stakeFd: number;
}

export interface Bid {
  loadId: number;
  truckId: number;
  companyId: number;
  rate: number;
  deadheadMi: number;
  score: number;
  tiebreak: number;
}

export interface Facility {
  id: number;
  type: FacilityType;
  /** 0 once its owner was liquidated: the facility is closed and its slot is back in supply. */
  ownerId: number;
  /** Spend-only FD it was bought with: a resale returns proceeds locked up to it. */
  lockedBasisFd?: number;
  hub: number;
  equipment: Equipment;
  boughtDay: number;
  /** Running FD result for the owner: sale value − freight − fees − expediting − upkeep. */
  netFd: number;
}

export type BusinessKind = "shop" | "truckStop" | "fuelStation" | "dealership" | "fence" | "chopShop";

/** A truck-stop site on an interstate (sites.ts): where a truck stop can be built. */
export interface TruckStopSite {
  id: number;
  /** The road edge it sits on and how far along it (0–1 from the edge's a end). */
  edge: number;
  frac: number;
  lat: number;
  lon: number;
  /** Freight passing, relative to the busiest site (1). */
  traffic: number;
  /** For sale (the busiest sites open first; more open as the fleet grows). */
  open: boolean;
  /** The truck stop built here, 0 for none. */
  businessId: number;
  /** Parking spaces (every site is a public rest area), and trucks sleeping here tonight. */
  spaces: number;
  parked: number;
  /** Cargo-theft risk here (risk.ts): 1 away from the hotspots. */
  theftRisk: number;
}

/** A player business (businesses.ts): a shop or a fuel station at a hub, or a truck stop at a site. */
export interface Business {
  id: number;
  kind: BusinessKind;
  /** 0 once closed (its owner liquidated): the slot is back in supply. */
  ownerId: number;
  /** Spend-only FD it was bought with (a resale returns proceeds locked up to it), the same for the stock on its lot, and the locked part of its last sale's payment (for the order it fills). */
  lockedBasisFd?: number;
  stockLockedFd?: number;
  lastSaleLockedFd?: number;
  /** Hub businesses: the hub; a truck stop: −1, and its site below. */
  hub: number;
  site: number;
  boughtDay: number;
  /** The staked bond behind it, returned when it closes. */
  bondFd: number;
  /** Shops: the price of their work against the NPC shop's list (1 = list). */
  markup: number;
  /** Truck stops: the nightly parking price. */
  parkingFd: number;
  /** Running FD result for the owner: margins − purchase − upkeep; and the purchase alone (price and tax), so the trade can be read apart from it. */
  netFd: number;
  purchaseFd: number;
  /** Dealerships (assets): new units in stock, bought wholesale from the factory allocation; units sold this month and last. */
  stock: { tractor: Record<TractorTier, number>; trailer: Record<Equipment, number> };
  soldMonth: number;
  soldLastMonth: number;
}

/** Assets: a tractor its owner offers to lease to another carrier by the week. */
export interface LeaseOffer {
  id: number;
  truckId: number;
  lessorId: number;
  weeklyFd: number;
  minWeeks: number;
  listedDay: number;
  status: "open" | "taken" | "withdrawn";
}

/** A dealer order: paid at order, delivered after the lead time. */
export interface TruckOrder {
  id: number;
  companyId: number;
  /** Assets: a tractor with a new trailer ("rig"), a tractor alone, or a trailer alone. Always "rig" with assets off. */
  kind: "rig" | "tractor" | "trailer";
  tier: TractorTier;
  trailer: Equipment;
  /** Free-path order: the new truck replaces the NPC lease on delivery. */
  replaceNpcLease: boolean;
  orderedDay: number;
  dueDay: number;
  /** Spend-only FD the order was paid with: the delivered asset's locked basis (ledger.ts). */
  lockedPaidFd?: number;
  /** From the NPC used lot (usedMarket.npcLot): the worn rig it delivers, as priced. */
  used?: { odometer: number; milesSinceRebuild: number; rebuilds: number; builtDay: number; trailerMilesSinceRefurb: number };
}

/** An Equipment Finance loan against one owned truck (§DeFi buildings). */
export interface Loan {
  id: number;
  borrowerId: number;
  truckId: number;
  originalFd: number;
  /** Still owed, including any interest capitalized after a missed payment. */
  principalFd: number;
  missed: number;
  status: "active" | "repaid" | "defaulted" | "repossessed" | "closed";
}

/**
 * A purchase loan from the NPC lender (purchaseLoans.ts): a truck bought on credit, secured by the truck
 * itself and an FD stake. `orderId` is the dealer order it paid for (0 for a used truck); `truckId` is
 * bound when the truck arrives.
 */
export interface PurchaseLoan {
  id: number;
  borrowerId: number;
  orderId: number;
  truckId: number;
  originalFd: number;
  principalFd: number;
  weeklyRate: number;
  termWeeks: number;
  stakeFd: number;
  missed: number;
  status: "active" | "repaid" | "defaulted" | "closed";
}

/** A truck for sale on the used market. sellerId 0 = Equipment Finance selling a repossession. */
export interface Listing {
  id: number;
  /** The truck (a rig: the tractor and the trailer it pulls, if its own), or 0 for a trailer sold alone. */
  truckId: number;
  /** A trailer sold alone (assets), else 0. */
  trailerId: number;
  sellerId: number;
  /** For a repossession, the loan the sale settles; for an owner's sale, any loan on the truck. */
  loanId: number | null;
  /** Who owned the truck before (the borrower, for a repossession). */
  formerOwnerId: number;
  listedDay: number;
  askFd: number;
  floorFd: number;
  /** Weekly price cut while unsold. */
  stepFd: number;
  status: "open" | "sold" | "withdrawn" | "returned";
}

/** The Equipment Finance pool: depositors' shares against cash plus what borrowers owe. */
export interface FinancePool {
  shares: Map<number, number>;
  totalShares: number;
  outstandingFd: number;
  loans: Loan[];
  interestPaidFd: number;
  writtenOffFd: number;
  peakOutstandingFd: number;
  loansMade: number;
}

export interface SeasonCloseRecord {
  season: number;
  day: number;
  supplyBeforeFd: number;
  burnedFd: number;
  supplyAfterFd: number;
  companiesAtCap: number;
}

/** Actions are the only way players and agents change the world (§Tech — same action API). */
export type Action =
  | { type: "set_standing_orders"; orders: StandingOrder[] }
  /** A dealer order. Assets: `tractorOnly` orders the tractor without a trailer (it hooks a spare from the yard, or a rental). */
  /** `finance`: on a purchase loan (purchaseLoans.ts) instead of cash. */
  | { type: "buy_asset"; tier: TractorTier; trailer: Equipment; replaceNpcLease: boolean; tractorOnly?: boolean; dealershipId?: number; finance?: boolean; used?: boolean; pay?: "usd" }
  /** Assets: a trailer alone, delivered to the yard (or straight behind a tractor pulling a rental there). From a player dealership's stock, or the NPC dealer. */
  | { type: "buy_trailer"; trailer: Equipment; dealershipId?: number; pay?: "usd" }
  /** Assets: sell an idle owned truck to a dealership's used lot at its trade-in share of value. */
  | { type: "trade_in"; truckId: number; dealershipId: number }
  /** Assets, player lessors: offer an idle tractor for lease by the week, withdraw the offer, or take one. A lessee hands it back with return_lease. */
  | { type: "offer_lease"; truckId: number; weeklyFd: number; minWeeks: number }
  | { type: "withdraw_lease_offer"; offerId: number }
  | { type: "take_lease"; offerId: number }
  /** Assets, resale: put a business, a shipper facility or the yard up for sale to another player, take it down, or buy one. */
  | { type: "list_asset_sale"; kind: "business" | "facility" | "yard"; refId: number; askFd: number }
  | { type: "withdraw_asset_sale"; saleId: number }
  | { type: "buy_asset_sale"; saleId: number }
  /** Assets: at the home hub, hook a trailer waiting in the yard; the one it pulls is dropped there (or handed back, a rental). */
  | { type: "swap_trailer"; truckId: number; trailerId: number }
  /** Assets: rent a trailer from the NPC lessor for this tractor; its own is dropped in the yard (home hub only), a rental handed back. */
  | { type: "rent_trailer"; truckId: number; trailer: Equipment }
  | { type: "refurbish_trailer"; trailerId: number }
  /** Assets: scrap a tractor (its own trailer is dropped in the yard), or a trailer in the yard. */
  | { type: "scrap_truck"; truckId: number }
  | { type: "scrap_trailer"; trailerId: number }
  | { type: "list_trailer"; trailerId: number; askFd: number; floorFd: number; stepFd: number }
  | { type: "rebuild_truck"; truckId: number }
  | { type: "park_truck"; truckId: number }
  | { type: "unpark_truck"; truckId: number }
  | { type: "list_truck"; truckId: number; askFd: number; floorFd: number; stepFd: number }
  | { type: "withdraw_listing"; listingId: number }
  | { type: "buy_listing"; listingId: number; finance?: boolean }
  /** Hired robbers (robbery.ts): a crew against another company's truck, and a security fitting on your own. */
  | { type: "hire_crew"; truckId: number; crewId?: number }
  /** A bounty on a company (robbery.bounty): FD held in escrow, paid to whoever's crew hits it. */
  | { type: "post_bounty"; targetId: number; fd: number }
  /** The logbook's shop item (token.airdrop.logbook.boost): brings a milestone forward, once. */
  | { type: "buy_logbook_boost"; milestone: string }
  | { type: "fit_security"; truckId: number; item: "tracker" | "locks" | "camera" }
  | { type: "deposit_finance"; amountFd: number }
  | { type: "withdraw_finance"; amountFd: number }
  | { type: "borrow"; truckId: number; amountFd: number }
  | { type: "repay_loan"; loanId: number }
  | { type: "buy_facility"; facility: FacilityType; hubId: string; pay?: "usd" }
  | { type: "lease_truck"; trailer: Equipment }
  /** A sealed bid by hand for the next board round (§Load board: sealed bids, plus standing orders). It replaces this truck's standing-order bids that round. */
  | { type: "place_bid"; truckId: number; loadId: number; rate: number }
  | { type: "cancel_bid"; truckId: number }
  /** Take an open load at its book-now price, now, for an idle truck within reach. */
  | { type: "book_load"; truckId: number; loadId: number }
  /** Send an idle truck home for its driver's days off (home time). */
  | { type: "send_home"; truckId: number }
  /** Contracts: take or decline a local shipper's offer; take a tender onto an idle truck, or leave it for the board. */
  | { type: "accept_contract"; contractId: number }
  | { type: "decline_contract"; contractId: number }
  | { type: "accept_tender"; loadId: number; truckId: number }
  | { type: "decline_tender"; loadId: number }
  /** Cash now (receivables.ts cashInvoice): an open invoice the company holds, sold to the NPC factor today. */
  | { type: "cash_invoice"; receivableId: number }
  /** The Reserve (cashReserve.ts): cash in at once; out, free, in cash after the settle. */
  | { type: "reserve_deposit"; fd: number }
  | { type: "reserve_withdraw"; fd: number }
  /** Player brokerages (brokerage.ts): a carrier forms its brokerage with this much capital (the bond and the licence come out of it). */
  | { type: "form_brokerage"; name: string; capitalFd: number }
  /** The owner's capital moved to its other company (equity, never revenue), less the transfer fee. */
  | { type: "transfer_capital"; fd: number }
  /** A player's brokerage posts a held shipper tender to the board, at this margin (its standing order's when left out). */
  | { type: "post_tender"; loadId: number; marginPct?: number }
  /** Rule A: a carrier passes a direct contract tender to its brokerage. */
  | { type: "pass_tender"; loadId: number }
  /** Rule B: a brokerage tenders one of its shipper loads to its own carrier at this pay per mile. */
  | { type: "tender_own"; loadId: number; rate: number }
  /** Send an idle truck empty to another hub. */
  | { type: "reposition_truck"; truckId: number; hubId: string }
  | { type: "buy_fd"; usd: number }
  /** The opening auction (token.launch.auction): dollars bid before launch, cleared at one price when it opens. */
  | { type: "bid_auction"; usd: number }
  /** The bridge (token.bridge): takes back the withdrawals still waiting, for the cancel burn. */
  | { type: "cancel_withdrawal" }
  | { type: "sell_fd"; fd: number }
  | { type: "stake_fd"; fd: number; months?: number; roll?: boolean }
  | { type: "unstake_fd"; fd: number; instant: boolean; breakLocks?: boolean }
  | { type: "deposit_pool"; line: PoolLine; amountFd: number }
  | { type: "withdraw_pool"; line: PoolLine; amountFd: number }
  | { type: "set_pay_terms"; terms: "net" | "quick" | "factor" }
  | { type: "buy_item"; item: ItemKind; pay: "fd" | "usd"; truckId?: number }
  | { type: "buy_business"; kind: "shop" | "fuelStation" | "dealership" | "fence" | "chopShop"; hubId: string; pay?: "usd" }
  | { type: "buy_business"; kind: "truckStop"; siteId: number; pay?: "usd" }
  | { type: "set_shop_markup"; businessId: number; markup: number }
  | { type: "set_parking_price"; businessId: number; fd: number }
  | { type: "add_parking"; businessId: number }
  | { type: "claim_airdrop_now" }
  /** Standing offer in the weekly buyback auction; amount 0 withdraws it. */
  | { type: "offer_fd"; amountFd: number; minPriceUsd: number }
  | { type: "return_lease"; truckId: number }
  /** Hire from the pool, or poach from another company (they get the chance to match). Drivers: FD/mi and the truck; dispatchers: FD/week. */
  | { type: "offer_staff"; staffId: number; pay: number; truckId?: number }
  | { type: "release_staff"; staffId: number }
  | { type: "set_staff_pay"; staffId: number; pay: number }
  /** Seat a driver: as the driver, or as co-driver to make a team. truckId 0 takes them off their truck. */
  | { type: "assign_driver"; staffId: number; truckId: number; team?: boolean }
  | { type: "set_auto_staff"; on: boolean }
  | { type: "set_compliance"; policy: CompliancePolicy }
  | { type: "fix_defects"; truckId: number }
  | { type: "set_vetting"; tier: VettingTier }
  /** After a revocation and its bar: file for new authority and start over on the free path. */
  | { type: "refile_authority" }
  /** Double brokering: re-post a load you won (before pickup) at a lower rate, and pay the hauler or not. */
  | { type: "rebroker_load"; loadId: number; rate: number; pay: boolean }
  /** Freight theft: the load on this truck never arrives. */
  | { type: "steal_load"; truckId: number }
  | { type: "wait" };

/** One week's buyback auction. */
export interface BuybackWeek {
  day: number;
  offeredFd: number;
  boughtFd: number;
  /** Uniform clearing price, $ per FD (null when nothing was bought). */
  priceUsd: number | null;
  spentUsd: number;
}

/** The token's launch, as it happened. */
export interface LaunchRecord {
  supplyBeforeFd: number;
  resetBurnedFd: number;
  lockedFd: number;
  airdropAllocatedFd: number;
  unallocatedByCapFd: number;
  liquidityFd: number;
  /** FD in circulation after the reset (what the pool's dollars have to support) and the price they set. */
  floatFd: number;
  priceUsd: number;
}

export interface TokenState {
  launchDay: number | null;
  /** The profit-tax rate in force (set at launch, then moved by the tax stabilizer). */
  profitTaxRate: number;
  /** Dollar side of the exchange pool (its FD side is the ledger account co:pool:exchange). */
  poolUsd: number;
  treasury: {
    usd: number;
    seedUsd: number;
    productUsd: number;
    feeUsd: number;
    buybackUsd: number;
    buybackFd: number;
    opsUsd: number;
    buybackQueueUsd: number;
    dailyBuybackUsd: number;
    weekRevenueUsd: number;
    /** Farming-season dollars held for the launch pool (items.ts), and the developer's vested FD sold and the dollars it brought (token.ts weeklyVest). */
    seedEscrowUsd: number;
    vestedFd: number;
    devUsd: number;
    /** The vest's allocation at launch (vest.linear: the week's share is of this). */
    vestBaseFd?: number;
  };
  /** Daily pool price after launch. */
  priceHistory: number[];
  launch: LaunchRecord | null;
  /** The price the launch set (seed dollars over the pool's FD), and the floor buyers pay while a one-sided range stands (0 two-sided). */
  launchPriceUsd: number;
  floorUsd: number;
  /** FD sold into and bought out of the pool since launch (net of fees), for the demand break-even. */
  exchange: { soldFd: number; boughtFd: number };
  /** The daily price band (exchange.priceBand): the day's open, fixed at its first trade, and the trades it clipped. */
  dayOpen: { day: number; price: number };
  bandClips: number;
  /** The opening auction (token.launch.auction): the bids held until launch, and how it cleared. */
  auctionBids: { companyId: number; usd: number }[];
  auction: { usd: number; fd: number; bidders: number; priceUsd: number; poolUsd: number; poolFd: number; treasuryUsd: number } | null;
  /** The pool's launch fees (exchange.launchFee, sizeFee): dollars taken on buys and FD burned on sales above the normal fees. */
  launchFee: { buyUsd: number; sellFd: number };
  /** The bridge (token.bridge): today's outflow against the cap, and the tallies: requested, cleared, days a request waited, and FD held back by the cap. */
  bridge: { dayOut: { day: number; fd: number }; requestedFd: number; clearedFd: number; waitDays: number; cleared: number; cappedFd: number; cappedDays: number; cancelledFd: number };
  airdrop: {
    mintedFd: number;
    forfeitedFd: number;
    haircutFd: number;
    seasonsPaid: number;
    /** The logbook's tallies (logbook.ts), once it runs: paid when a book opens, by honest and by criminal milestones, lost at the deadline, forfeited on conviction, and companies reaching each milestone. */
    logbook?: { openFd: number; honestFd: number; criminalFd: number; lostFd: number; convictedFd: number; reached: Record<string, number> };
  };
  /**
   * The supply ceiling (ceiling.ts): FD outstanding right after launch (null before, or when it's off)
   * and the rate multiplier then, the dial's top; whether the scheduled payouts wait this week and the
   * room queued slices may be paid from; and the tallies the reports publish.
   */
  ceiling: {
    baseFd: number | null;
    launchMult: number;
    holding: boolean;
    roomFd: number;
    weeksHolding: number;
    weeksAtFloor: number;
    vestHeldWeeks: number;
    releasedFd: number;
  };
  baseCarriers: number;
  newCompanies: number;
}

/** What happened, for a player's screen (the engine emits these for every company; a UI filters to its own). */
export type GameEvent =
  | { kind: "won"; companyId: number; truckId: number; loadId: number; origin: number; dest: number; miles: number; rate: number; manual: boolean }
  | { kind: "delivered"; companyId: number; truckId: number; loadId: number; origin: number; dest: number; grossFd: number; costFd: number; onTime: boolean }
  | { kind: "lostBid"; companyId: number; truckId: number; loadId: number; origin: number; dest: number; rate: number; winningRate: number | null }
  | { kind: "breakdown"; companyId: number; truckId: number; repairFd: number }
  | { kind: "truckDelivered"; companyId: number; truckId: number }
  | { kind: "liquidated"; companyId: number }
  | { kind: "launched" }
  /** Staff, safety and fraud news for a company's feed. */
  | { kind: "notice"; companyId: number; topic: "staff" | "safety" | "crash" | "fraud" | "authority" | "contracts" | "board" | "fleet" | "airdrop"; text: string; tone: "good" | "bad" | "info"; truckId?: number };
