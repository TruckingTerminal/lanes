import type { Equipment, FacilityType, TractorTier } from "@lanes/config";

export type Role = "carrier" | "broker";

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
      price: { mode: "ceilingPct"; pct: number } | { mode: "breakEvenPlus"; pct: number };
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
      /** Broker: accept tendered NPC freight and repost it at this margin. */
      kind: "broker";
      marginPct: number;
      maxOpenLoads: number;
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

export interface Company {
  id: number;
  name: string;
  role: Role;
  homeHub: number;
  /** Agent strategy label, used only for reporting ("greedy", "conservative", …). */
  strategy: string;
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
  /** FD that can be spent in the game but not sold: launch carryover and post-launch starting grants. Spending uses it first. */
  lockedFd: number;
  airdrop: Airdrop | null;
  /** Loads delivered, brokered or shipped this week (airdrop unlocks). */
  loadsThisWeek: number;
  /** Operating result (freight and facilities) at the last profit-tax week. */
  taxBaseFd: number;
  /** The owner dispatching their own trucks (labor.ts): skill grows with loads dispatched. */
  ownerDispatch: { skill: number; potential: number; experience: number; learned: number };
  policy: CompliancePolicy;
  safety: SafetyRecord;
  authority: Authority;
  /** Vetting this company requires on freight it posts (brokered loads, facility loads). */
  vetting: VettingTier;
  /** The engine keeps seats filled: hires drivers for empty trucks and dispatchers past the owner's span. */
  autoStaff: boolean;
  /** Open claims against this company (theft, unpaid carriers), by the day each expires. */
  claims: { day: number; until: number; kind: "theft" | "unpaid" }[];
  /** Owed on a judgment or seizure, paid out of whatever the company still has. */
  judgmentFd: number;
  /** The company's insurance policy (insurance.ts). */
  insurance: InsurancePolicy;
}

/** A one-game-year insurance policy: the price per truck is fixed for the term. */
export interface InsurancePolicy {
  annualPerTruck: number;
  signedDay: number;
  renewDay: number;
  /** What went into the price when it was signed. */
  risk: number;
  garaging: number;
  market: number;
}

export type StaffKind = "driver" | "dispatcher";
export type StaffStatus = "pool" | "employed" | "jailed" | "gone";

/** A driver or dispatcher (labor.ts). */
export interface Staff {
  id: number;
  kind: StaffKind;
  name: string;
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
  /** Career record any employer can see. */
  violations: number;
  crashes: number;
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
  /** Theft: the truck that carried it (its driver goes to jail with the owner). */
  truckId: number;
  /** Double brokering: the carrier who hauled and wasn't paid, if any. */
  unpaidCarrierId: number;
}

export interface Airdrop {
  totalFd: number;
  unlockedFd: number;
  forfeitedFd: number;
  weeksLeft: number;
  claimedEarly: boolean;
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
  lease: LeaseKind;
  tier: TractorTier;
  trailer: Equipment;
  status: TruckStatus;
  hub: number; // current hub when idle; origin of current leg otherwise
  targetHub: number;
  remainingMi: number;
  loadId: number | null;
  /** Start of the current 24-hour duty day, or null before the first one. */
  shiftStartT: number | null;
  shiftDrivenMin: number;
  /** Minutes left loading or unloading. */
  dwellMin: number;
  /** Minutes left stopped after a breakdown (tow and repair). */
  breakdownMin: number;
  /** When a rebuild in the shop finishes. */
  repairUntilT: number | null;
  /** Lifetime miles (drives the million-mile level) and miles since the last rebuild (drives wear). */
  odometer: number;
  milesSinceRebuild: number;
  /** In-game day the truck was built (negative for trucks older than the world). Drives the "year" in its used value. */
  builtDay: number;
  idleRounds: number;
  idleSinceDay: number;
  /** Last round in which this truck had loads in range but none it would take at their ceilings. */
  pricedOutRound: number;
  /** Miles driven since the last settlement, split for cost accounting. */
  emptyMi: number;
  loadedMi: number;
  /** Lessor trucks: the day the lease began, and the lease share paid this week (against the minimum rent). */
  leasedDay: number | null;
  leaseShareWeekFd: number;
  /** Drivers (labor.ts): the driver, and a co-driver for a team (0 = none). */
  driverId: number;
  coDriverId: number;
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
}

export type LoadStatus = "open" | "assigned" | "inTransit" | "delivered" | "npcCovered";

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
  hub: number;
  equipment: Equipment;
  boughtDay: number;
  /** Running FD result for the owner: sale value − freight − fees − expediting − upkeep. */
  netFd: number;
}

/** A dealer order: paid at order, delivered after the lead time. */
export interface TruckOrder {
  id: number;
  companyId: number;
  tier: TractorTier;
  trailer: Equipment;
  /** Free-path order: the new truck replaces the NPC lease on delivery. */
  replaceNpcLease: boolean;
  orderedDay: number;
  dueDay: number;
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

/** A truck for sale on the used market. sellerId 0 = Equipment Finance selling a repossession. */
export interface Listing {
  id: number;
  truckId: number;
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
  | { type: "buy_asset"; tier: TractorTier; trailer: Equipment; replaceNpcLease: boolean }
  | { type: "rebuild_truck"; truckId: number }
  | { type: "park_truck"; truckId: number }
  | { type: "unpark_truck"; truckId: number }
  | { type: "list_truck"; truckId: number; askFd: number; floorFd: number; stepFd: number }
  | { type: "withdraw_listing"; listingId: number }
  | { type: "buy_listing"; listingId: number }
  | { type: "deposit_finance"; amountFd: number }
  | { type: "withdraw_finance"; amountFd: number }
  | { type: "borrow"; truckId: number; amountFd: number }
  | { type: "repay_loan"; loanId: number }
  | { type: "buy_facility"; facility: FacilityType; hubId: string }
  | { type: "lease_truck"; trailer: Equipment }
  /** A sealed bid by hand for the next board round (§Load board: sealed bids, plus standing orders). It replaces this truck's standing-order bids that round. */
  | { type: "place_bid"; truckId: number; loadId: number; rate: number }
  | { type: "cancel_bid"; truckId: number }
  /** Send an idle truck empty to another hub. */
  | { type: "reposition_truck"; truckId: number; hubId: string }
  | { type: "buy_fd"; usd: number }
  | { type: "sell_fd"; fd: number }
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
  };
  /** Daily pool price after launch. */
  priceHistory: number[];
  launch: LaunchRecord | null;
  airdrop: { mintedFd: number; forfeitedFd: number; haircutFd: number };
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
  | { kind: "notice"; companyId: number; topic: "staff" | "safety" | "crash" | "fraud" | "authority"; text: string; tone: "good" | "bad" | "info"; truckId?: number };
