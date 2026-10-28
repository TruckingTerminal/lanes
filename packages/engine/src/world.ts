import type { EconomyConfig, Equipment, FacilityType, TractorTier } from "@lanes/config";
import type { Feeds, Network } from "@lanes/data";
import { Ledger, companyAccount } from "./ledger.js";
import { Rng } from "./rng.js";
import type { BuybackWeek, GameEvent, TokenState, Company, Facility, FinancePool, LeaseKind, Listing, Load, Role, SeasonCloseRecord, StandingOrder, Truck, TruckOrder } from "./types.js";
import { MetricsRecorder } from "./metrics.js";

export interface WorldOptions {
  cfg: EconomyConfig;
  net: Network;
  feeds: Feeds;
  seed: number;
  /** Keep every ledger entry (tests, inspection). Long sims keep totals only. */
  keepLedgerEntries?: boolean;
}

export interface World {
  cfg: EconomyConfig;
  net: Network;
  feeds: Feeds;
  seed: number;
  rng: { freight: Rng; board: Rng; agents: Rng; ops: Rng };
  t: number;
  round: number;
  ledger: Ledger;
  companies: Company[];
  trucks: Truck[];
  trucksByCompany: Map<number, Truck[]>;
  /** Loads still on the board or in progress; delivered/covered loads are dropped. */
  loads: Map<number, Load>;
  nextLoadId: number;
  /** Equipment remaining in the PoC supply (§Assets and supply caps). */
  supply: { tractor: Record<TractorTier, number>; trailer: Record<Equipment, number> };
  /** Each cap as it stands: the PoC cap plus anything the dealer has added (free entry). */
  supplyCap: { tractor: Record<TractorTier, number>; trailer: Record<Equipment, number> };
  /** Units the dealer added to its caps under free entry. */
  capAddedUnits: number;
  /** The NPC lessor's extra-lease fleet (free entry): its size and how many are out on lease. */
  lessor: { fleet: number; out: number; peakFleet: number };
  /** Part of the Workhorse and dry-van supply held for first-truck buyers. */
  starterReserve: { workhorse: number; van: number };
  facilities: Facility[];
  /** Facilities remaining in the PoC supply. */
  facilitySupply: Record<FacilityType, number>;
  seasonCloses: SeasonCloseRecord[];
  /** Dealer orders not yet delivered. */
  orders: TruckOrder[];
  nextOrderId: number;
  /** The used-truck market, open and closed listings. */
  listings: Listing[];
  finance: FinancePool;
  /** Published stabilizers (§Circular economy — targets and stabilizers). */
  stab: { volumeMult: number; rackSpread: number };
  /** Last round's load-to-truck ratio per hub, for repositioning. */
  lastRatio: Float64Array;
  /** Smoothed share of open loads that clear each round, by equipment (public board data). */
  fillRate: Record<Equipment, number>;
  /**
   * Per hub and equipment: the spot market's rate level (ratio^0.35 × weather ×
   * seasonal rate) smoothed over the contract lag. Broker contract rates use it.
   */
  contractIndex: Float64Array;
  /** Last round's load-to-truck ratio per hub and trailer type (planIndex order). */
  lastRatioEq: Float64Array;
  /** Smoothed load-to-truck ratio per hub and trailer type: how easily a truck reloads after delivering there. */
  reloadIndex: Float64Array;
  /** National average of reloadIndex per trailer type. */
  reloadMean: Float64Array;
  /** The weekly buyback auction: standing offers, rolled-over budget, results, and each company's last fill. */
  buyback: {
    offers: Map<number, { amountFd: number; minPriceUsd: number }>;
    carryUsd: number;
    weeks: BuybackWeek[];
    lastFill: Map<number, number>;
  };
  /** FD as a real-money token (token.ts). */
  token: TokenState;
  /** NPC freight multiplier for a grown player base (token mode). */
  demandScale: number;
  /** Bids placed by hand for the next board round, by truck. */
  manualBids: Map<number, { loadId: number; rate: number }>;
  /** Optional listener for game events (a player's UI); never affects the simulation. */
  listener: ((e: GameEvent) => void) | null;
  metrics: MetricsRecorder;
}

export function createWorld(o: WorldOptions): World {
  const root = new Rng(o.seed);
  const { cfg } = o;
  return {
    cfg,
    net: o.net,
    feeds: o.feeds,
    seed: o.seed,
    rng: { freight: root.fork("freight"), board: root.fork("board"), agents: root.fork("agents"), ops: root.fork("ops") },
    t: 0,
    round: 0,
    ledger: new Ledger(o.keepLedgerEntries ?? false),
    companies: [],
    trucks: [],
    trucksByCompany: new Map(),
    loads: new Map(),
    nextLoadId: 1,
    supply: {
      tractor: {
        workhorse: cfg.tractors.workhorse.pocCap,
        highwayPro: cfg.tractors.highwayPro.pocCap,
        flagship: cfg.tractors.flagship.pocCap,
      },
      trailer: { van: cfg.trailers.van.pocCap, reefer: cfg.trailers.reefer.pocCap, flatbed: cfg.trailers.flatbed.pocCap },
    },
    supplyCap: {
      tractor: {
        workhorse: cfg.tractors.workhorse.pocCap,
        highwayPro: cfg.tractors.highwayPro.pocCap,
        flagship: cfg.tractors.flagship.pocCap,
      },
      trailer: { van: cfg.trailers.van.pocCap, reefer: cfg.trailers.reefer.pocCap, flatbed: cfg.trailers.flatbed.pocCap },
    },
    capAddedUnits: 0,
    lessor: { fleet: cfg.freeEntry.leases.startFleet, out: 0, peakFleet: cfg.freeEntry.leases.startFleet },
    starterReserve: {
      workhorse: Math.round(cfg.tractors.workhorse.pocCap * cfg.starterReserveShare),
      van: Math.round(cfg.trailers.van.pocCap * cfg.starterReserveShare),
    },
    facilities: [],
    facilitySupply: {
      warehouse: cfg.facilities.types.warehouse.pocCap,
      coldStorage: cfg.facilities.types.coldStorage.pocCap,
      factory: cfg.facilities.types.factory.pocCap,
    },
    seasonCloses: [],
    orders: [],
    nextOrderId: 1,
    listings: [],
    finance: {
      shares: new Map(),
      totalShares: 0,
      outstandingFd: 0,
      loans: [],
      interestPaidFd: 0,
      writtenOffFd: 0,
      peakOutstandingFd: 0,
      loansMade: 0,
    },
    stab: { volumeMult: 1, rackSpread: 1 },
    lastRatio: new Float64Array(o.net.hubs.length).fill(1),
    fillRate: { van: 0.7, reefer: 0.7, flatbed: 0.7 },
    contractIndex: new Float64Array(o.net.hubs.length * 3).fill(NaN),
    lastRatioEq: new Float64Array(o.net.hubs.length * 3).fill(1),
    reloadIndex: new Float64Array(o.net.hubs.length * 3).fill(1),
    reloadMean: new Float64Array(3).fill(1),
    buyback: { offers: new Map(), carryUsd: 0, weeks: [], lastFill: new Map() },
    token: {
      launchDay: null,
      profitTaxRate: cfg.token.profitTaxRate,
      poolUsd: 0,
      treasury: { usd: 0, seedUsd: 0, productUsd: 0, feeUsd: 0, buybackUsd: 0, buybackFd: 0, opsUsd: 0, buybackQueueUsd: 0, dailyBuybackUsd: 0, weekRevenueUsd: 0 },
      priceHistory: [],
      launch: null,
      airdrop: { mintedFd: 0, forfeitedFd: 0, haircutFd: 0 },
      baseCarriers: 0,
      newCompanies: 0,
    },
    demandScale: 1,
    manualBids: new Map(),
    listener: null,
    metrics: new MetricsRecorder(),
  };
}

export interface NewCompany {
  name: string;
  role: Role;
  homeHubId: string;
  strategy: string;
  orders: StandingOrder[];
  /** Carrier free start: one NPC-leased Workhorse + dry van (§Roles). */
  freePath: boolean;
}

/**
 * Company formation (§Roles — company formation). Pays the one-time starting
 * grant, then the carrier authority filing or broker license fee.
 */
export function formCompany(w: World, c: NewCompany): Company {
  const homeHub = w.net.hubs.findIndex((h) => h.id === c.homeHubId);
  if (homeHub < 0) throw new Error(`Unknown hub ${c.homeHubId}`);
  if (c.orders.filter((o) => o.kind !== "floor").length > w.cfg.board.freeStandingOrders) {
    throw new Error(`More than ${w.cfg.board.freeStandingOrders} standing orders`);
  }
  const day = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  const company: Company = {
    id: w.companies.length + 1,
    name: c.name,
    role: c.role,
    homeHub,
    strategy: c.strategy,
    freePath: c.freePath,
    orders: c.orders,
    reputation: w.cfg.reputation.start,
    delivered: 0,
    onTime: 0,
    late: 0,
    milesTotal: 0,
    milesHistory: [],
    milesByDay: { day, amount: 0 },
    lanePairToday: new Map(),
    firstOwnedTruckDay: null,
    firstAffordDay: null,
    createdDay: day,
    openBrokerLoads: 0,
    bidStats: { truckRounds: 0, wins: 0 },
    operating: { revenueFd: 0, costFd: 0 },
    overheadPaidFd: 0,
    truckWeeks: 0,
    weeklySpend: [],
    lastOutflowCents: 0,
    repossessions: 0,
    usedBought: 0,
    usedSold: 0,
    weeksInDebt: 0,
    liquidatingSince: null,
    suspendedOrders: [],
    bankruptcies: 0,
    usd: { wallet: 0, in: 0, out: 0 },
    // After launch a new company's grant is spend-only, so a fresh account can't be cashed out.
    lockedFd: w.token.launchDay !== null && w.cfg.token.lockGrants ? w.cfg.company.startingGrantFd : 0,
    airdrop: null,
    loadsThisWeek: 0,
    taxBaseFd: 0,
  };
  w.companies.push(company);
  w.trucksByCompany.set(company.id, []);
  w.ledger.post(w.t, "faucet:starting_grant", companyAccount(company.id), w.cfg.company.startingGrantFd, `grant:${company.id}`);
  payPermits(w, company);
  if (c.role === "carrier" && c.freePath) addTruck(w, company, "npc", "workhorse", "van");
  return company;
}

/** Carrier authority or broker license; paid at formation and renewed each season. */
export function payPermits(w: World, company: Company): void {
  const { permits } = w.cfg;
  const fee = company.role === "carrier" ? permits.carrierAuthorityFd : permits.brokerLicenseRenewalFd;
  w.ledger.post(w.t, companyAccount(company.id), "sink:permits", fee, `permit:${company.id}`);
}

/** Wear and age for equipment that isn't new: the initial PoC allocation. */
export interface UsedEquipment {
  odometer: number;
  milesSinceRebuild: number;
  builtDay: number;
}

export function addTruck(
  w: World,
  company: Company,
  lease: "npc" | "owned",
  tier: TractorTier,
  trailer: Equipment,
  firstTruck = false,
  used?: UsedEquipment,
): Truck {
  const fleet = w.trucksByCompany.get(company.id)!;
  if (fleet.length >= w.cfg.company.maxTrucks) throw new Error(`Company ${company.id} at truck cap`);
  if (lease === "npc" && (tier !== "workhorse" || trailer !== "van" || fleet.some((t) => t.lease === "npc"))) {
    throw new Error("NPC lease is one Workhorse + dry van only");
  }
  if (lease === "owned" && !takeSupply(w, tier, trailer, firstTruck)) throw new Error("PoC supply exhausted");
  return createTruck(w, company, lease, tier, trailer, used);
}

/** Puts a truck into a company's fleet. Supply must already be accounted for. */
export function createTruck(
  w: World,
  company: Company,
  lease: LeaseKind,
  tier: TractorTier,
  trailer: Equipment,
  used?: UsedEquipment,
  hub = company.homeHub,
): Truck {
  const fleet = w.trucksByCompany.get(company.id)!;
  const day = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  const truck: Truck = {
    id: w.trucks.length + 1,
    companyId: company.id,
    lease,
    tier,
    trailer,
    status: "idle",
    hub,
    targetHub: hub,
    remainingMi: 0,
    loadId: null,
    shiftStartT: null,
    shiftDrivenMin: 0,
    dwellMin: 0,
    breakdownMin: 0,
    repairUntilT: null,
    odometer: used?.odometer ?? 0,
    milesSinceRebuild: used?.milesSinceRebuild ?? 0,
    builtDay: used?.builtDay ?? day,
    idleRounds: 0,
    idleSinceDay: day,
    pricedOutRound: -1,
    emptyMi: 0,
    loadedMi: 0,
    leasedDay: lease === "lessor" ? day : null,
    leaseShareWeekFd: 0,
  };
  w.trucks.push(truck);
  fleet.push(truck);
  return truck;
}

/** Units a buyer can take: first-truck buyers may draw on the starter reserve. */
export function availableSupply(w: World, tier: TractorTier, trailer: Equipment, firstTruck: boolean): number {
  const tractors = w.supply.tractor[tier] - (!firstTruck && tier === "workhorse" ? w.starterReserve.workhorse : 0);
  const trailers = w.supply.trailer[trailer] - (!firstTruck && trailer === "van" ? w.starterReserve.van : 0);
  return Math.max(0, Math.min(tractors, trailers));
}

export function takeSupply(w: World, tier: TractorTier, trailer: Equipment, firstTruck: boolean): boolean {
  if (availableSupply(w, tier, trailer, firstTruck) <= 0) return false;
  w.supply.tractor[tier]--;
  w.supply.trailer[trailer]--;
  if (firstTruck && tier === "workhorse" && w.starterReserve.workhorse > 0) w.starterReserve.workhorse--;
  if (firstTruck && trailer === "van" && w.starterReserve.van > 0) w.starterReserve.van--;
  return true;
}

/** Takes a truck out of its company's fleet (sale, repossession, retirement). */
export function detachTruck(w: World, truck: Truck): void {
  const fleet = w.trucksByCompany.get(truck.companyId);
  if (fleet) {
    const i = fleet.indexOf(truck);
    if (i >= 0) fleet.splice(i, 1);
  }
  truck.companyId = 0;
}

/** Hands a truck to a new owner, idle where it stands. */
export function attachTruck(w: World, truck: Truck, companyId: number): void {
  truck.companyId = companyId;
  truck.status = "idle";
  truck.idleRounds = 0;
  truck.idleSinceDay = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  truck.targetHub = truck.hub;
  w.trucksByCompany.get(companyId)!.push(truck);
}

/** Trucks registered to operate (§Owned vs. leased: unregistered assets can't run). */
export function operatingTrucks(w: World, companyId: number): number {
  let n = 0;
  for (const t of w.trucksByCompany.get(companyId)!) if (t.status !== "parked" && t.status !== "listed") n++;
  return n;
}

export function hubMiles(w: World, a: number, b: number): number {
  return w.net.miles[a * w.net.hubs.length + b]!;
}

export function companyById(w: World, id: number): Company {
  return w.companies[id - 1]!;
}

export function truckById(w: World, id: number): Truck {
  return w.trucks[id - 1]!;
}
