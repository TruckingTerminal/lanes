import type { RoundResult } from "./board.js";
import { ceilingFd, outstandingFd, queuedAirdropFd } from "./ceiling.js";
import { seasonOf } from "./clock.js";
import { companyAccount } from "./ledger.js";
import type { Company, Load } from "./types.js";
import { condition } from "./wear.js";
import { windowsOn, type PosterKind } from "./windows.js";
import type { World } from "./world.js";

/**
 * Burns outside operations — the season close and the real-money layer (buybacks,
 * exchange fees, the launch reset, forfeited airdrops). Kept out of the operating
 * sink ratio, so the stabilizer doesn't add freight to make up for them.
 */
export const BURN_TAGS = new Set(["sink:season_close", "sink:buyback", "sink:exchange_fee", "sink:launch_reset", "sink:airdrop_forfeit", "sink:unstake_haircut", "sink:profit_tax_burn", "sink:asset_burn", "sink:lock_slash"]);
/** One-time mints outside operations: starting grants, the airdrop, launch liquidity and the opening auction's tranche. */
export const MINT_TAGS = new Set(["faucet:starting_grant", "faucet:airdrop", "faucet:launch_liquidity", "faucet:auction"]);

export interface DayMetrics {
  day: number;
  season: number;
  supplyFd: number;
  /** Circular mode: what the reserve holds (0 in the open mode). */
  reserveFd: number;
  /** FD created today by NPC demand (excludes one-time starting grants). */
  faucetFd: number;
  faucetByTag: Record<string, number>;
  grantFd: number;
  /** Operating sinks: everything but the season-close burn. */
  sinkFd: number;
  sinkByTag: Record<string, number>;
  /** The season-close burn, kept apart so it doesn't swamp the quarterly ratio. */
  burnFd: number;
  /** Burns and mints outside operations, by tag (BURN_TAGS, MINT_TAGS other than starting grants). */
  burnByTag: Record<string, number>;
  mintByTag: Record<string, number>;
  posted: number;
  cleared: number;
  rolled: number;
  /** Loads whose shipper gave up unhauled (no NPC carrier ever covers one since 0.17.0). */
  expired: number;
  delivered: number;
  onTimeShare: number;
  avgClearedRate: number;
  avgMarginPct: number;
  fuelPrice: number;
  volumeMult: number;
  rackSpread: number;
  idleTrucks: number;
  ownedTrucks: number;
  /** Every company's trucks on the road (not parked, listed or retired), free-path leases included: the population dial's denominator. */
  trucksInService: number;
  /** Carriers trading (not being wound up, not retired by the population dial). */
  activeCarriers: number;
  /**
   * Companies in the market (trading or liquidating; not retired by the population dial) whose cash stands below zero at
   * the day's end, and what they owe in all (positive FD): the launch gate's debt line reads these at the ends of years 3
   * and 4 (apps/sim/src/gate.ts; killCriteria.gate). What retired companies still owe is reported apart: they have left
   * the market, and their residue is not the living world's debt.
   */
  inDebt: number;
  debtFd: number;
  retiredDebtFd: number;
  facilityPosted: number;
  facilities: number;
  businesses: number;
  breakdowns: number;
  /** Breakdowns served by a truck stop's shop, a hub shop, or NPC road service (businesses.ts roadService). */
  roadServiceStop: number;
  roadServiceHub: number;
  roadServiceNpc: number;
  /** Legs held by a winter pass closure (trips.ts beginLeg). */
  passClosures: number;
  /** Nights at a site, nights on the shoulder, shoulder tickets, and sites found full (sites.ts parkForTheNight). */
  siteNights: number;
  shoulderNights: number;
  tickets: number;
  sitesFull: number;
  /** The trailer pass and the risk corridors: waits at a dock and their minutes, missed appointment slots, flatbed damage claims, cargo thefts and the cargo value stolen. */
  dockWaits: number;
  dockWaitMin: number;
  missedSlots: number;
  flatbedDamage: number;
  cargoThefts: number;
  cargoTheftFd: number;
  rebuilds: number;
  /** Assets (tractors and trailers apart): trailers delivered alone, rentals taken, swaps at the yard, refurbishments, tractors and trailers scrapped, rigs written off in crashes, trailers stolen from yards, and owned trailers and rentals out at day's end. */
  trailersDelivered: number;
  trailerRentals: number;
  trailerSwaps: number;
  refurbs: number;
  scrappedTractors: number;
  scrappedTrailers: number;
  totalLosses: number;
  yardThefts: number;
  /** The factory allocation: tractors and trailers built this month (on its day); new units sold out of player dealerships' stock; trade-ins taken. */
  factoryTractors: number;
  factoryTrailers: number;
  /** FD dealerships paid the factory, wholesale (burn, treasury and reserve), and new units' retail at dealerships. */
  wholesaleFd: number;
  dealershipSalesFd: number;
  dealershipSales: number;
  tradeIns: number;
  /** Player lessors: leases taken today, and tractors out on lease at day's end. */
  playerLeases: number;
  leasedOut: number;
  /** Resale: businesses, facilities and yards sold player to player today. */
  assetSales: number;
  ownedTrailers: number;
  rentalsOut: number;
  /** Mean condition of owned trucks (1 = fresh). */
  avgOwnedCondition: number;
  /** The Cass-style demand dial today (1 = neutral). */
  cycle: number;
  ordersPlaced: number;
  trucksDelivered: number;
  ordersPending: number;
  repossessions: number;
  usedSales: number;
  repoReturned: number;
  listingsOpen: number;
  loansOutstandingFd: number;
  poolValueFd: number;
  bankruptcies: number;
  liquidating: number;
  shipperDefaults: number;
  /** Free entry: extra trucks out on lease, the lessor's fleet, and owned trucks the caps still allow. */
  leasedTrucks: number;
  lessorFleet: number;
  tractorCap: number;
  /** Token mode (0 before launch): pool price $/FD, FD and dollars in the pool, locked FD, companies. */
  priceUsd: number;
  exchangeFd: number;
  poolUsd: number;
  lockedFd: number;
  /**
   * The token's size (Jeff, 2026-10-31: "track market cap and FDV"). Circulating: FD outside the reserve,
   * the protocol's allocations and the burns, less spend-only locked FD (companies' balances, stakes,
   * bonds, pool deposits and the exchange pool all count). Total: the cap less everything burned.
   * Market cap = price × circulating; FDV (fully diluted value) = price × total. Both 0 before launch.
   */
  circulatingFd: number;
  totalSupplyFd: number;
  marketCapUsd: number;
  fdvUsd: number;
  /**
   * The supply ceiling (ceiling.ts): FD outstanding (outside the reserve, the allocations and the burns,
   * locked FD included), the published path (0 when off or before launch), the balance dial's rate
   * multiplier, and the airdrop queued under the ceiling.
   */
  outstandingFd: number;
  ceilingFd: number;
  rateMult: number;
  /** The emission cap's levers in force today (emission.ts): the NPC rate and the NPC posted volume; what NPC shippers committed today at the invoice; the horizon's budget that set today's levers. */
  emissionMult: number;
  emissionVolMult: number;
  emissionCommittedFd: number;
  emissionAvailableFd: number;
  queuedAirdropFd: number;
  /** NPC leases priced by value (freeEntry.leases.byValue): the deposits the lessor holds. */
  leaseDepositsFd: number;
  /** Purchase loans (purchaseLoans.ts): what borrowers still owe the NPC lender, and how many loans are open. */
  purchaseLoansFd: number;
  purchaseLoansOpen: number;
  companies: number;
  profitTaxRate: number;
  demandScale: number;
  /** Staff (labor.ts): employed drivers, drivers in the pool, operating trucks without a driver, the wage index, mean employed driver skill. */
  drivers: number;
  poolDrivers: number;
  crewlessTrucks: number;
  wageIndex: number;
  avgDriverSkill: number;
  dispatchers: number;
  /** Safety and fraud (safety.ts, fraud.ts), today. */
  crashes: number;
  fatalCrashes: number;
  atFaultCrashes: number;
  willfulCrashes: number;
  shutdowns: number;
  reviews: number;
  unsatisfactory: number;
  thefts: number;
  doubleBrokers: number;
  convictions: number;
  /** Carriers rated conditional / unsatisfactory, revoked, and running illegal hours or deferred maintenance. */
  conditionalCarriers: number;
  unsatCarriers: number;
  revokedCarriers: number;
  cheatingCarriers: number;
  /** The insurance market index and the dealer's Workhorse + dry van price index. */
  insuranceIndex: number;
  dealerIndex: number;
  /**
   * Delivery windows (windows.ts; present only while windows.enabled): loads lost when their pickup closed, by who posted
   * them, and what their shippers would have paid for the hauls (shipperRate × miles). They count in `expired` too.
   */
  lostLoads?: Record<PosterKind, number>;
  lostFd?: Record<PosterKind, number>;
}

/** Collects the dashboard metrics every tick writes (§Tech — engineering rules). */
export class MetricsRecorder {
  readonly days: DayMetrics[] = [];
  private acc = emptyAcc();
  private lastTotals = new Map<string, number>();

  onRound(r: RoundResult): void {
    this.acc.posted += r.posted;
    this.acc.cleared += r.cleared;
    this.acc.rolled += r.rolled;
    this.acc.expired += r.expired;
    this.acc.rateSum += r.clearedRateSum;
    this.acc.facilityPosted += r.facilityPosted;
  }

  onBreakdown(): void {
    this.acc.breakdowns++;
  }

  /** A load lost when its pickup closed (board.ts giveUp under windows). */
  onLost(kind: PosterKind, fd: number): void {
    this.acc.lostLoads[kind]++;
    this.acc.lostFd[kind] += fd;
  }

  onPassClosure(): void {
    this.acc.passClosures++;
  }

  onNight(where: "site" | "shoulder"): void {
    if (where === "site") this.acc.siteNights++;
    else this.acc.shoulderNights++;
  }

  onTicket(): void {
    this.acc.tickets++;
  }

  onDockWait(minutes: number): void {
    this.acc.dockWaits++;
    this.acc.dockWaitMin += minutes;
  }

  onMissedSlot(): void {
    this.acc.missedSlots++;
  }

  onFlatbedDamage(): void {
    this.acc.flatbedDamage++;
  }

  onCargoTheft(fd: number): void {
    this.acc.cargoThefts++;
    this.acc.cargoTheftFd += fd;
  }

  onFull(): void {
    this.acc.sitesFull++;
  }

  onRoadService(by: "stop" | "hub" | "npc"): void {
    if (by === "stop") this.acc.roadServiceStop++;
    else if (by === "hub") this.acc.roadServiceHub++;
    else this.acc.roadServiceNpc++;
  }

  onRebuild(): void {
    this.acc.rebuilds++;
  }

  onTrailerDelivered(): void {
    this.acc.trailersDelivered++;
  }

  onTrailerRental(): void {
    this.acc.trailerRentals++;
  }

  onTrailerSwap(): void {
    this.acc.trailerSwaps++;
  }

  onRefurb(): void {
    this.acc.refurbs++;
  }

  onScrap(what: "tractor" | "trailer"): void {
    if (what === "tractor") this.acc.scrappedTractors++;
    else this.acc.scrappedTrailers++;
  }

  onTotalLoss(): void {
    this.acc.totalLosses++;
  }

  onYardTheft(): void {
    this.acc.yardThefts++;
  }

  onFactory(tractors: number, trailers: number): void {
    this.acc.factoryTractors += tractors;
    this.acc.factoryTrailers += trailers;
  }

  onDealershipSale(fd = 0): void {
    this.acc.dealershipSales++;
    this.acc.dealershipSalesFd += fd;
  }

  onWholesale(fd: number): void {
    this.acc.wholesaleFd += fd;
  }

  onTradeIn(): void {
    this.acc.tradeIns++;
  }

  onPlayerLease(): void {
    this.acc.playerLeases++;
  }

  onAssetSale(): void {
    this.acc.assetSales++;
  }

  onOrder(): void {
    this.acc.ordersPlaced++;
  }

  onTruckDelivered(): void {
    this.acc.trucksDelivered++;
  }

  onRepossession(): void {
    this.acc.repossessions++;
  }

  onUsedSale(_repo: boolean): void {
    this.acc.usedSales++;
  }

  onListingReturned(): void {
    this.acc.repoReturned++;
  }

  onBankruptcy(): void {
    this.acc.bankruptcies++;
  }

  onShipperDefault(): void {
    this.acc.shipperDefaults++;
  }

  onCrash(severity: "pdo" | "injury" | "fatal", atFault: boolean, willful: boolean): void {
    this.acc.crashes++;
    if (severity === "fatal") this.acc.fatalCrashes++;
    if (atFault) this.acc.atFaultCrashes++;
    if (willful) this.acc.willfulCrashes++;
  }

  onShutdown(): void {
    this.acc.shutdowns++;
  }

  onReview(rating: string): void {
    this.acc.reviews++;
    if (rating === "unsatisfactory") this.acc.unsatisfactory++;
  }

  onFraud(kind: "theft" | "doubleBroker"): void {
    if (kind === "theft") this.acc.thefts++;
    else this.acc.doubleBrokers++;
  }

  onConviction(): void {
    this.acc.convictions++;
  }

  onDelivery(_w: World, _c: Company, _load: Load, gross: number, costs: number, onTime: number): void {
    this.acc.delivered++;
    if (onTime >= 1) this.acc.onTime++;
    this.acc.marginSum += gross > 0 ? (gross - costs) / gross : -1;
  }

  closeDay(w: World, day: number, fuelPrice: number): DayMetrics {
    const delta = (tag: string) => {
      const now = w.ledger.totals.get(tag) ?? 0;
      const d = now - (this.lastTotals.get(tag) ?? 0);
      this.lastTotals.set(tag, now);
      return d / 100;
    };
    let faucetFd = 0;
    let grantFd = 0;
    let sinkFd = 0;
    let burnFd = 0;
    const faucetByTag: Record<string, number> = {};
    const sinkByTag: Record<string, number> = {};
    const burnByTag: Record<string, number> = {};
    const mintByTag: Record<string, number> = {};
    for (const tag of [...w.ledger.totals.keys()].sort()) {
      const d = delta(tag);
      if (tag === "faucet:starting_grant") grantFd += d;
      else if (MINT_TAGS.has(tag)) mintByTag[tag.slice(7)] = d;
      else if (tag.startsWith("faucet:")) {
        faucetFd += d;
        faucetByTag[tag.slice(7)] = d;
      } else if (tag === "sink:season_close") burnFd += d;
      else if (BURN_TAGS.has(tag)) burnByTag[tag.slice(5)] = d;
      else {
        sinkFd += d;
        sinkByTag[tag.slice(5)] = d;
      }
    }
    let idle = 0;
    let owned = 0;
    let conditionSum = 0;
    let inService = 0;
    for (const t of w.trucks) {
      if (t.status === "idle") idle++;
      if (t.companyId !== 0 && t.status !== "retired" && t.status !== "parked" && t.status !== "listed") inService++;
      if (t.lease === "owned" && t.companyId !== 0 && t.status !== "retired") {
        owned++;
        conditionSum += condition(w.cfg, t);
      }
    }
    let drivers = 0;
    let poolDrivers = 0;
    let dispatchers = 0;
    let skillSum = 0;
    for (const s of w.staff) {
      if (s.kind === "dispatcher") {
        if (s.status === "employed") dispatchers++;
      } else if (s.status === "employed" && !s.owner) {
        drivers++;
        skillSum += s.skill;
      } else if (s.status === "pool") poolDrivers++;
    }
    let crewless = 0;
    for (const t of w.trucks) if (t.companyId !== 0 && t.driverId === 0 && t.status !== "parked" && t.status !== "listed" && t.status !== "retired") crewless++;
    const carriers = w.companies.filter((c) => c.role === "carrier");
    let inDebt = 0;
    let debtFd = 0;
    let retiredDebtFd = 0;
    for (const c of w.companies) {
      const balance = w.ledger.balance(companyAccount(c.id));
      if (balance >= 0) continue;
      if (c.retiredDay !== undefined) retiredDebtFd -= balance;
      else {
        inDebt++;
        debtFd -= balance;
      }
    }
    const a = this.acc;
    const m: DayMetrics = {
      day,
      season: seasonOf(day, w.cfg),
      supplyFd: w.ledger.supply(),
      reserveFd: w.ledger.reserve(),
      faucetFd,
      faucetByTag,
      grantFd,
      sinkFd,
      sinkByTag,
      burnFd,
      burnByTag,
      mintByTag,
      posted: a.posted,
      cleared: a.cleared,
      rolled: a.rolled,
      expired: a.expired,
      delivered: a.delivered,
      onTimeShare: a.delivered ? a.onTime / a.delivered : 0,
      avgClearedRate: a.cleared ? a.rateSum / a.cleared : 0,
      avgMarginPct: a.delivered ? (100 * a.marginSum) / a.delivered : 0,
      fuelPrice,
      volumeMult: w.stab.volumeMult,
      rackSpread: w.stab.rackSpread,
      idleTrucks: idle,
      ownedTrucks: owned,
      trucksInService: inService,
      activeCarriers: w.companies.filter((c) => c.role === "carrier" && c.liquidatingSince === null && c.retiredDay === undefined).length,
      inDebt,
      debtFd,
      retiredDebtFd,
      facilityPosted: a.facilityPosted,
      facilities: w.facilities.length,
      businesses: w.businesses.filter((b) => b.ownerId > 0).length,
      breakdowns: a.breakdowns,
      roadServiceStop: a.roadServiceStop,
      roadServiceHub: a.roadServiceHub,
      roadServiceNpc: a.roadServiceNpc,
      passClosures: a.passClosures,
      siteNights: a.siteNights,
      shoulderNights: a.shoulderNights,
      tickets: a.tickets,
      sitesFull: a.sitesFull,
      dockWaits: a.dockWaits,
      dockWaitMin: a.dockWaitMin,
      missedSlots: a.missedSlots,
      flatbedDamage: a.flatbedDamage,
      cargoThefts: a.cargoThefts,
      cargoTheftFd: a.cargoTheftFd,
      rebuilds: a.rebuilds,
      trailersDelivered: a.trailersDelivered,
      trailerRentals: a.trailerRentals,
      trailerSwaps: a.trailerSwaps,
      refurbs: a.refurbs,
      scrappedTractors: a.scrappedTractors,
      scrappedTrailers: a.scrappedTrailers,
      totalLosses: a.totalLosses,
      yardThefts: a.yardThefts,
      factoryTractors: a.factoryTractors,
      factoryTrailers: a.factoryTrailers,
      wholesaleFd: a.wholesaleFd,
      dealershipSalesFd: a.dealershipSalesFd,
      dealershipSales: a.dealershipSales,
      tradeIns: a.tradeIns,
      playerLeases: a.playerLeases,
      assetSales: a.assetSales,
      leasedOut: w.trucks.reduce((n, t) => n + (t.lessorId !== 0 && t.lessorId !== t.companyId && t.status !== "retired" ? 1 : 0), 0),
      ownedTrailers: trailerCount(w, "owned"),
      rentalsOut: trailerCount(w, "rental"),
      avgOwnedCondition: owned ? conditionSum / owned : 1,
      cycle: w.feeds.cycle(day),
      ordersPlaced: a.ordersPlaced,
      trucksDelivered: a.trucksDelivered,
      ordersPending: w.orders.length,
      repossessions: a.repossessions,
      usedSales: a.usedSales,
      repoReturned: a.repoReturned,
      listingsOpen: w.listings.filter((l) => l.status === "open").length,
      loansOutstandingFd: w.finance.outstandingFd,
      poolValueFd: w.ledger.balance("co:pool:equipment_finance") + w.finance.outstandingFd,
      bankruptcies: a.bankruptcies,
      liquidating: w.companies.filter((c) => c.liquidatingSince !== null).length,
      shipperDefaults: a.shipperDefaults,
      leasedTrucks: w.lessor.out,
      lessorFleet: w.lessor.fleet,
      tractorCap: w.supplyCap.tractor.workhorse + w.supplyCap.tractor.highwayPro + w.supplyCap.tractor.flagship,
      priceUsd: w.token.launchDay !== null ? w.token.poolUsd / Math.max(1e-9, w.ledger.balance("co:pool:exchange")) : 0,
      exchangeFd: w.ledger.balance("co:pool:exchange"),
      poolUsd: w.token.poolUsd,
      lockedFd: w.ledger.lockedSupply(),
      ...valuation(w),
      outstandingFd: outstandingFd(w),
      ceilingFd: ceilingFd(w),
      rateMult: w.stab.rateMult,
      emissionMult: w.stab.emissionMult,
      emissionVolMult: w.stab.emissionVolMult,
      emissionCommittedFd: w.emission.todayFd,
      emissionAvailableFd: w.emission.lastDay.availableFd,
      queuedAirdropFd: queuedAirdropFd(w),
      leaseDepositsFd: w.trucks.reduce((s, t) => s + (t.companyId !== 0 ? t.depositFd : 0), 0),
      purchaseLoansFd: w.purchaseLoans.reduce((s, l) => s + (l.status === "active" || l.status === "defaulted" ? l.principalFd : 0), 0),
      purchaseLoansOpen: w.purchaseLoans.filter((l) => l.status === "active" || l.status === "defaulted").length,
      companies: w.companies.length,
      profitTaxRate: w.token.launchDay !== null ? w.token.profitTaxRate : 0,
      demandScale: w.demandScale,
      drivers,
      poolDrivers,
      crewlessTrucks: crewless,
      wageIndex: w.labor.wageIndex,
      avgDriverSkill: drivers ? skillSum / drivers : 0,
      dispatchers,
      crashes: a.crashes,
      fatalCrashes: a.fatalCrashes,
      atFaultCrashes: a.atFaultCrashes,
      willfulCrashes: a.willfulCrashes,
      shutdowns: a.shutdowns,
      reviews: a.reviews,
      unsatisfactory: a.unsatisfactory,
      thefts: a.thefts,
      doubleBrokers: a.doubleBrokers,
      convictions: a.convictions,
      conditionalCarriers: carriers.filter((c) => c.safety.rating === "conditional").length,
      unsatCarriers: carriers.filter((c) => c.safety.rating === "unsatisfactory").length,
      revokedCarriers: carriers.filter((c) => c.authority.status === "revoked").length,
      cheatingCarriers: carriers.filter((c) => c.policy.hos !== "legal" || c.policy.maintenance === "deferred").length,
      insuranceIndex: w.insuranceMarket.index,
      dealerIndex:
        (w.cfg.dealerFd.tractor.workhorse * w.dealerIndex.tractor.workhorse + w.cfg.dealerFd.trailer.van * w.dealerIndex.trailer.van) /
        (w.cfg.dealerFd.tractor.workhorse + w.cfg.dealerFd.trailer.van),
    };
    if (windowsOn(w)) {
      m.lostLoads = { ...a.lostLoads };
      m.lostFd = { ...a.lostFd };
    }
    this.days.push(m);
    this.acc = emptyAcc();
    return m;
  }
}

function emptyAcc() {
  return {
    lostLoads: { npc: 0, broker: 0, brokerage: 0, shipper: 0 } as Record<PosterKind, number>,
    lostFd: { npc: 0, broker: 0, brokerage: 0, shipper: 0 } as Record<PosterKind, number>,
    posted: 0,
    cleared: 0,
    rolled: 0,
    expired: 0,
    rateSum: 0,
    delivered: 0,
    onTime: 0,
    marginSum: 0,
    facilityPosted: 0,
    breakdowns: 0,
    roadServiceStop: 0,
    roadServiceHub: 0,
    roadServiceNpc: 0,
    passClosures: 0,
    siteNights: 0,
    shoulderNights: 0,
    tickets: 0,
    sitesFull: 0,
    dockWaits: 0,
    dockWaitMin: 0,
    missedSlots: 0,
    flatbedDamage: 0,
    cargoThefts: 0,
    cargoTheftFd: 0,
    rebuilds: 0,
    trailersDelivered: 0,
    trailerRentals: 0,
    trailerSwaps: 0,
    refurbs: 0,
    scrappedTractors: 0,
    scrappedTrailers: 0,
    totalLosses: 0,
    yardThefts: 0,
    factoryTractors: 0,
    factoryTrailers: 0,
    wholesaleFd: 0,
    dealershipSalesFd: 0,
    dealershipSales: 0,
    tradeIns: 0,
    playerLeases: 0,
    assetSales: 0,
    ordersPlaced: 0,
    trucksDelivered: 0,
    repossessions: 0,
    usedSales: 0,
    repoReturned: 0,
    bankruptcies: 0,
    shipperDefaults: 0,
    crashes: 0,
    fatalCrashes: 0,
    atFaultCrashes: 0,
    willfulCrashes: 0,
    shutdowns: 0,
    reviews: 0,
    unsatisfactory: 0,
    thefts: 0,
    doubleBrokers: 0,
    convictions: 0,
  };
}

/** Trailers on companies' books by lease (assets): owned ones, or rentals out. */
function trailerCount(w: World, lease: "owned" | "rental"): number {
  let n = 0;
  for (const list of w.trailersByCompany.values()) for (const tr of list) if (tr.lease === lease) n++;
  return n;
}

/** The token's circulating and total supply, and what they're worth at the pool's price (0 before launch). */
export function valuation(w: World): { circulatingFd: number; totalSupplyFd: number; marketCapUsd: number; fdvUsd: number } {
  const locked = w.ledger.lockedSupply();
  const circulatingFd = Math.max(0, w.ledger.supply() - locked);
  const minted = w.ledger.minted();
  const totalSupplyFd = minted > 0 ? minted - w.ledger.burned() : w.ledger.supply();
  const pool = w.ledger.balance("co:pool:exchange");
  const price = w.token.launchDay !== null && pool > 0 ? w.token.poolUsd / pool : 0;
  return { circulatingFd, totalSupplyFd, marketCapUsd: price * circulatingFd, fdvUsd: price * totalSupplyFd };
}
