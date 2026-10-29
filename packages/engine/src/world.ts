import type { EconomyConfig, Equipment, FacilityType, TractorTier } from "@lanes/config";
import { PLACE_OF_HUB, placeMiles as netPlaceMiles, placeMilesFast as netPlaceMilesFast, placeRoute as netPlaceRoute, type Feeds, type Network, type Route } from "@lanes/data";
import { Ledger, companyAccount } from "./ledger.js";
import { truckCap } from "./staking.js";
import { newPool } from "./pools.js";
import { Rng } from "./rng.js";
import type { BuybackWeek, GameEvent, TokenState, Company, Facility, FinancePool, FraudCase, LeaseKind, Listing, Load, Pool, PoolLine, Role, SeasonCloseRecord, Staff, StandingOrder, Truck, TruckOrder, Contract } from "./types.js";
import { signPolicy } from "./insurance.js";
import { seedPool } from "./labor.js";
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
  rng: { freight: Rng; board: Rng; agents: Rng; ops: Rng; labor: Rng; safety: Rng; fraud: Rng; dispatch: Rng; contracts: Rng };
  t: number;
  round: number;
  /** Loads booked at their book-now price since the last round, folded into that round's clearing stats. */
  booked: { n: number; rateSum: number };
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
  /** Trucks the AI companies started with (set by populate): the beta cap on their growth is a multiple of it. */
  aiFleetStart: number;
  /** Bids placed by hand for the next board round, by truck. */
  manualBids: Map<number, { loadId: number; rate: number }>;
  /** Every driver and dispatcher, in the pool or employed (labor.ts). Ids are index + 1. */
  staff: Staff[];
  staffByCompany: Map<number, Staff[]>;
  /** The labor market: the wage index (market pay × this). */
  labor: { wageIndex: number };
  /** Open and closed fraud investigations (fraud.ts). */
  cases: FraudCase[];
  /** Contract lanes offered and held (contracts.ts). */
  contracts: Contract[];
  nextContractId: number;
  /** The insurance market (insurance.ts): its price index and the last 12 months of premiums and claims. */
  insuranceMarket: { index: number; premiums: number[]; claims: number[] };
  /** Player-funded pools by line (pools.ts). */
  pools: Record<PoolLine, Pool>;
  /** Dealer price index by tractor tier and trailer type (dealer.ts). */
  dealerIndex: { tractor: Record<TractorTier, number>; trailer: Record<Equipment, number> };
  /** Home-hub crowding per hub (home.ts), recomputed by the engine at fixed points. */
  homeCrowding: Float64Array;
  /** Optional listener for game events (a player's UI); never affects the simulation. */
  listener: ((e: GameEvent) => void) | null;
  metrics: MetricsRecorder;
}

export function createWorld(o: WorldOptions): World {
  const root = new Rng(o.seed);
  const { cfg } = o;
  const w: World = {
    cfg,
    net: o.net,
    feeds: o.feeds,
    seed: o.seed,
    rng: {
      freight: root.fork("freight"),
      board: root.fork("board"),
      agents: root.fork("agents"),
      ops: root.fork("ops"),
      labor: root.fork("labor"),
      safety: root.fork("safety"),
      fraud: root.fork("fraud"),
      dispatch: root.fork("dispatch"),
      contracts: root.fork("contracts"),
    },
    t: 0,
    round: 0,
    booked: { n: 0, rateSum: 0 },
    ledger: new Ledger(o.keepLedgerEntries ?? false, o.cfg.token.circular),
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
    aiFleetStart: 0,
    manualBids: new Map(),
    staff: [],
    staffByCompany: new Map(),
    labor: { wageIndex: 1 },
    cases: [],
    contracts: [],
    nextContractId: 1,
    insuranceMarket: { index: 1, premiums: [0], claims: [0] },
    pools: { insurance: newPool() },
    dealerIndex: { tractor: { workhorse: 1, highwayPro: 1, flagship: 1 }, trailer: { van: 1, reefer: 1, flatbed: 1 } },
    homeCrowding: new Float64Array(o.net.hubs.length).fill(1),
    listener: null,
    metrics: new MetricsRecorder(),
  };
  seedPool(w);
  return w;
}

export interface NewCompany {
  name: string;
  role: Role;
  homeHubId: string;
  strategy: string;
  orders: StandingOrder[];
  /** Carrier free start: one NPC-leased Workhorse + dry van (§Roles). */
  freePath: boolean;
  /** The owner's skill as a driver and dispatcher (default: a new human owner's). */
  ownerSkill?: number;
  /** An established company: its authority is this many days old. */
  authorityAgeDays?: number;
  /** Run by a person, not an agent. */
  human?: boolean;
}

export function newSafetyRecord(): Company["safety"] {
  return {
    rating: "none",
    ratingDay: null,
    reviewDay: null,
    revokeDay: null,
    reviewWanted: false,
    violations: [],
    inspections: [],
    hidden: [],
    crashes: [],
    measures: { hos: 0, unsafe: 0, maintenance: 0, crash: 0 },
    alerts: [],
    insuranceSurcharge: 0,
    finesFd: 0,
    outOfService: 0,
  };
}

const FIRST = ["Alex", "Sam", "Jordan", "Casey", "Riley", "Morgan", "Taylor", "Jamie", "Avery", "Quinn", "Devon", "Rosa", "Luis", "Marcus", "Tanya", "Ray", "Dee", "Andre", "Kim", "Omar", "Lena", "Hector", "Bo", "Nia", "Vic", "Earl", "June", "Pat", "Cruz", "Ivy"];
const LAST = ["Reyes", "Walker", "Nguyen", "Brooks", "Patel", "Hayes", "Moreno", "Kowalski", "Price", "Okafor", "Bell", "Duarte", "Fischer", "Lam", "Carter", "Ruiz", "Mills", "Haddad", "Stone", "Ortiz", "Grant", "Silva", "Boone", "Ward", "Lowe", "Vance", "Cole", "Diaz", "Ford", "Hart"];

/** A person for the labor pool (or an owner). Names come from the labor stream, so they replay. */
export function newStaff(w: World, kind: Staff["kind"], skill: number, potential: number): Staff {
  const rng = w.rng.labor;
  const [lo, hi] = w.cfg.labor.pool.personal;
  const person: Staff = {
    id: w.staff.length + 1,
    kind,
    name: `${FIRST[rng.int(0, FIRST.length - 1)]!} ${LAST[rng.int(0, LAST.length - 1)]!}`,
    skill,
    potential: Math.max(skill, potential),
    experience: 0,
    pending: 0,
    personal: rng.range(lo, hi),
    // The better people tend to be the ones who won't run illegal.
    integrity: Math.min(1, Math.max(0, 0.35 + 0.5 * skill + rng.range(-0.3, 0.3))),
    morale: w.cfg.labor.morale.start,
    status: "pool",
    companyId: 0,
    truckId: 0,
    pay: 0,
    hiredDay: 0,
    owner: false,
    releaseDay: null,
    unseatedWeeks: 0,
    offer: null,
    matchedPay: 0,
    matchedDay: -1,
    peakPay: 0,
    violations: 0,
    crashes: 0,
    awayDays: 0,
    restDays: 0,
    fatigue: 0,
    buffer: 0,
    longDays: 0,
    drivenMinToday: 0,
    homeUntilDay: null,
    wantsHome: false,
  };
  w.staff.push(person);
  return person;
}

function addOwner(w: World, c: Company, skill: number): Staff {
  const owner = newStaff(w, "driver", skill, w.cfg.labor.owner.potential);
  owner.name = "You (owner)";
  owner.owner = true;
  owner.integrity = 0;
  owner.status = "employed";
  owner.companyId = c.id;
  owner.pay = w.cfg.labor.owner.driverPayPerMile;
  owner.hiredDay = c.createdDay;
  w.staffByCompany.get(c.id)!.push(owner);
  return owner;
}

export const staffById = (w: World, id: number): Staff => w.staff[id - 1]!;

const finite = (x: unknown, lo: number, hi: number): x is number => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;

/**
 * Why a set of standing orders can't be taken, or null. Orders come from players'
 * browsers, so every field is checked: a bad number here would reach bid scores
 * and the ledger and stop the shared world for everyone.
 */
export function invalidOrders(cfg: EconomyConfig, orders: unknown): string | null {
  if (!Array.isArray(orders)) return "standing orders must be a list";
  if (orders.length > 20) return "too many standing orders";
  let counted = 0;
  for (const o of orders as StandingOrder[]) {
    if (!o || typeof o !== "object") return "bad standing order";
    switch (o.kind) {
      case "bid":
        if (!finite(o.maxDeadheadMi, 0, 2_000)) return "bad max empty miles";
        if (o.minCeilingPerMile !== undefined && !finite(o.minCeilingPerMile, 0, 100)) return "bad minimum ceiling";
        if (!o.price || (o.price.mode !== "ceilingPct" && o.price.mode !== "breakEvenPlus") || !finite(o.price.pct, 0, 5)) return "bad bid price";
        if (o.equipment !== undefined && (!Array.isArray(o.equipment) || !o.equipment.every((e) => e === "van" || e === "reefer" || e === "flatbed"))) return "bad equipment list";
        if (o.originHubs !== undefined && (!Array.isArray(o.originHubs) || !o.originHubs.every((h) => typeof h === "string"))) return "bad origin list";
        break;
      case "floor":
        if (!finite(o.breakEvenPlusPct, 0, 5)) return "bad floor";
        continue;
      case "reposition":
        if (!finite(o.afterIdleRounds, 1, 1_000)) return "bad idle rounds";
        if (o.to !== "nearestStarterHub" && !(o.to && typeof o.to === "object" && (("openLoadsWithinMi" in o.to && finite(o.to.openLoadsWithinMi, 0, 5_000)) || ("hubId" in o.to && typeof o.to.hubId === "string")))) return "bad destination";
        break;
      case "broker":
        if (!finite(o.marginPct, 0, 0.9) || !finite(o.maxOpenLoads, 0, 10_000)) return "bad broker order";
        break;
      case "rebroker":
        if (!finite(o.share, 0, 1) || !finite(o.keepPct, 0, 0.9) || typeof o.pays !== "boolean") return "bad rebroker order";
        break;
      case "bookNow":
        if (!finite(o.breakEvenPlusPct, 0, 5) || !finite(o.maxDeadheadMi, 0, 2_000)) return "bad book-now order";
        break;
      case "homeTime":
        if (!finite(o.afterDays, 1, 365) || !finite(o.restDays, 1, 60)) return "bad home-time order";
        continue;
      case "contracts":
        if (typeof o.acceptOffers !== "boolean" || (o.spotAbovePct !== null && !finite(o.spotAbovePct, 0, 5)) || !finite(o.maxDeadheadMi, 0, 2_000)) return "bad contracts order";
        continue;
      default:
        return "unknown standing order";
    }
    counted++;
  }
  return counted > cfg.board.freeStandingOrders ? "too many standing orders" : null;
}

export function ownerOf(w: World, companyId: number): Staff | undefined {
  return w.staffByCompany.get(companyId)?.find((s) => s.owner);
}

/** Market pay for a skill level today: drivers FD/mi, dispatchers FD/week. */
export function marketPay(w: World, kind: Staff["kind"], skill: number): number {
  const [lo, hi] = kind === "driver" ? w.cfg.labor.driver.payPerMile : w.cfg.labor.dispatcher.payPerWeek;
  return (lo + (hi - lo) * skill) * w.labor.wageIndex;
}

/** What someone asks to take a job (or to move). */
export const askingPay = (w: World, s: Staff) => marketPay(w, s.kind, s.skill) * s.personal;


/** Recomputes a truck's cached crew and policy numbers. Call after any seat, pay, skill or policy change. */
export function syncTruck(w: World, truck: Truck): void {
  const { cfg } = w;
  const d = truck.driverId ? staffById(w, truck.driverId) : null;
  const co = truck.coDriverId ? staffById(w, truck.coDriverId) : null;
  if (d && co) {
    truck.wagePerMile = (d.pay + co.pay) * cfg.labor.driver.teamPayShare;
    truck.driverSkill = (d.skill + co.skill) / 2;
  } else if (d) {
    truck.wagePerMile = d.pay;
    truck.driverSkill = d.skill;
  } else {
    truck.wagePerMile = cfg.costs.driverWagePerMile;
    truck.driverSkill = 0.5;
  }
  const c = truck.companyId ? companyById(w, truck.companyId) : null;
  truck.maintPolicyMult = c?.policy.maintenance === "deferred" ? cfg.safety.maintenance.deferredCostMult : 1;
  // Break-even spreads the policy's price over a typical truck's loaded miles; the NPC lessor carries its own trucks' policy.
  truck.insuranceMult = truck.lease === "npc" ? 0 : c && c.insurance.annualPerTruck > 0 ? c.insurance.annualPerTruck / cfg.insurance.baseAnnualPerTruck : 1;
}

export function syncFleet(w: World, companyId: number): void {
  for (const t of w.trucksByCompany.get(companyId) ?? []) syncTruck(w, t);
}

/** Puts a driver on a truck (as co-driver if `team`). The caller checks the rules. */
export function seatDriver(w: World, s: Staff, truck: Truck, team = false): void {
  // Already in that seat: nothing to do (re-seating would knock the other driver out).
  if ((team && truck.coDriverId === s.id) || (!team && truck.driverId === s.id)) return;
  if (team && truck.driverId === s.id) return;
  if (s.truckId) unseatDriver(w, s);
  if (team) truck.coDriverId = s.id;
  else {
    if (truck.driverId) unseatDriver(w, staffById(w, truck.driverId));
    truck.driverId = s.id;
  }
  s.truckId = truck.id;
  s.unseatedWeeks = 0;
  syncTruck(w, truck);
}

export function unseatDriver(w: World, s: Staff): void {
  if (!s.truckId) return;
  const truck = truckById(w, s.truckId);
  if (truck.driverId === s.id) {
    truck.driverId = truck.coDriverId;
    truck.coDriverId = 0;
  } else if (truck.coDriverId === s.id) truck.coDriverId = 0;
  s.truckId = 0;
  syncTruck(w, truck);
}

/** The previous owner's logs, hours, unsettled miles and leg don't follow a truck to its next owner (or its next authority). */
export function freshPaperwork(truck: Truck): void {
  truck.logDays = [];
  truck.overMin = 0;
  truck.shiftStartT = null;
  truck.shiftDrivenMin = 0;
  truck.emptyMi = 0;
  truck.loadedMi = 0;
  truck.breakdownMin = 0;
  truck.legKey = -1;
  truck.legTollFd = 0;
}

/** A truck with a driver can run; one without sits until someone is hired. */
export const crewed = (t: Truck) => t.driverId !== 0;

/** The owner takes the wheel of a new truck if they aren't driving one. */
function seatOwnerIfFree(w: World, truck: Truck): void {
  const owner = ownerOf(w, truck.companyId);
  if (owner && owner.truckId === 0 && owner.status === "employed") seatDriver(w, owner, truck);
}

/**
 * Company formation (§Roles — company formation). Pays the one-time starting
 * grant, then the carrier authority filing or broker license fee.
 */
export function formCompany(w: World, c: NewCompany): Company {
  const homeHub = w.net.hubs.findIndex((h) => h.id === c.homeHubId);
  if (homeHub < 0) throw new Error(`Unknown hub ${c.homeHubId}`);
  const bad = invalidOrders(w.cfg, c.orders);
  if (bad) throw new Error(bad);
  const day = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  const company: Company = {
    id: w.companies.length + 1,
    name: c.name,
    role: c.role,
    homeHub,
    strategy: c.strategy,
    human: c.human ?? false,
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
    stakedFd: 0,
    unstaking: [],
    tierGraceDay: null,
    soldFd: { day: -1, fd: 0 },
    airdrop: null,
    loadsThisWeek: 0,
    taxBaseFd: 0,
    ownerDispatch: { skill: c.ownerSkill ?? w.cfg.labor.owner.humanSkill, potential: w.cfg.labor.owner.potential, experience: 0, learned: 0 },
    policy: { hos: "legal", speed: "legal", maintenance: "full" },
    safety: newSafetyRecord(),
    authority: {
      since: day - (c.authorityAgeDays ?? 0),
      status: "active",
      suspendedUntil: null,
      barredUntil: null,
      revocations: 0,
      crimes: 0,
      frauds: 0,
      lastRevokedDay: null,
      record: [],
    },
    vetting: 0,
    autoStaff: true,
    claims: [],
    localBanUntilDay: 0,
    tenderAcceptance: 1,
    judgmentFd: 0,
    insurance: { annualPerTruck: 0, signedDay: day, renewDay: day, risk: 1, garaging: 1, market: 1, writer: "npc" },
  };
  // An established company has passed its new-entrant audit long ago.
  if ((c.authorityAgeDays ?? 0) >= w.cfg.safety.review.newEntrantDay) {
    company.safety.rating = "satisfactory";
    company.safety.ratingDay = company.authority.since;
  }
  w.companies.push(company);
  w.trucksByCompany.set(company.id, []);
  w.staffByCompany.set(company.id, []);
  signPolicy(w, company);
  // A carrier's owner drives and dispatches for it (labor.ts).
  if (c.role === "carrier") addOwner(w, company, c.ownerSkill ?? w.cfg.labor.owner.humanSkill);
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
  if (fleet.length >= truckCap(w, company)) throw new Error(`Company ${company.id} at truck cap`);
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
    place: PLACE_OF_HUB[hub]!,
    targetPlace: PLACE_OF_HUB[hub]!,
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
    idleSinceT: w.t,
    pricedOutRound: -1,
    emptyMi: 0,
    loadedMi: 0,
    leasedDay: lease === "lessor" ? day : null,
    leaseShareWeekFd: 0,
    driverId: 0,
    coDriverId: 0,
    wagePerMile: w.cfg.costs.driverWagePerMile,
    driverSkill: 0.5,
    maintPolicyMult: 1,
    insuranceMult: 1,
    defects: 0,
    overMin: 0,
    logDays: [],
    legKey: -1,
    legMiles: 0,
    nextStation: 0,
    legTollFd: 0,
    legHighwayShare: 0,
  };
  w.trucks.push(truck);
  fleet.push(truck);
  seatOwnerIfFree(w, truck);
  syncTruck(w, truck);
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
  // The crew stays with the company, without a truck.
  if (truck.coDriverId) unseatDriver(w, staffById(w, truck.coDriverId));
  if (truck.driverId) unseatDriver(w, staffById(w, truck.driverId));
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
  truck.idleSinceT = w.t;
  truck.targetHub = truck.hub;
  truck.place = PLACE_OF_HUB[truck.hub]!;
  truck.targetPlace = truck.place;
  freshPaperwork(truck);
  w.trucksByCompany.get(companyId)!.push(truck);
  seatOwnerIfFree(w, truck);
  syncTruck(w, truck);
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

/** The road route from hub a to hub b (null between a hub and itself). */
export function hubRoute(w: World, a: number, b: number): Route | null {
  return w.net.routes[a * w.net.hubs.length + b] ?? null;
}

/** Tolls a truck pays from hub a to hub b. */
export function hubToll(w: World, a: number, b: number): number {
  return hubRoute(w, a, b)?.tollFd ?? 0;
}

/** Driving hours from hub a to hub b at each road's speed. */
export function hubHours(w: World, a: number, b: number): number {
  const r = hubRoute(w, a, b);
  return r ? r.hours : hubMiles(w, a, b) / w.cfg.hos.avgMph;
}

/** A hub's own place. */
export const placeOfHub = (hub: number): number => PLACE_OF_HUB[hub]!;

/** The road route between two places (null between a place and itself). */
export function placeRoute(w: World, a: number, b: number): Route | null {
  return netPlaceRoute(w.net, a, b);
}

/** A quick estimate of the miles between two places, for scanning boards (great circle × circuity). */
export function placeMiles(w: World, a: number, b: number): number {
  return netPlaceMilesFast(w.net, a, b);
}

/** Road miles between two places, for a leg a truck is about to drive. */
export function placeLegMiles(w: World, a: number, b: number): number {
  return netPlaceMiles(w.net, a, b);
}

/** Tolls between two places. */
export function placeToll(w: World, a: number, b: number): number {
  return placeRoute(w, a, b)?.tollFd ?? 0;
}

/** Driving hours between two places at each road's speed. */
export function placeHours(w: World, a: number, b: number): number {
  const r = placeRoute(w, a, b);
  return r ? r.hours : placeMiles(w, a, b) / w.cfg.hos.avgMph;
}

export function companyById(w: World, id: number): Company {
  return w.companies[id - 1]!;
}

export function truckById(w: World, id: number): Truck {
  return w.trucks[id - 1]!;
}
