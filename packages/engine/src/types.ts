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
    };

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
  | { kind: "launched" };
