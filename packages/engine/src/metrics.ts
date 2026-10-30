import type { RoundResult } from "./board.js";
import { seasonOf } from "./clock.js";
import type { Company, Load } from "./types.js";
import { condition } from "./wear.js";
import type { World } from "./world.js";

/**
 * Burns outside operations — the season close and the real-money layer (buybacks,
 * exchange fees, the launch reset, forfeited airdrops). Kept out of the operating
 * sink ratio, so the stabilizer doesn't add freight to make up for them.
 */
export const BURN_TAGS = new Set(["sink:season_close", "sink:buyback", "sink:exchange_fee", "sink:launch_reset", "sink:airdrop_forfeit", "sink:unstake_haircut", "sink:profit_tax_burn", "sink:asset_burn"]);
/** One-time mints outside operations: starting grants, the airdrop, and launch liquidity. */
export const MINT_TAGS = new Set(["faucet:starting_grant", "faucet:airdrop", "faucet:launch_liquidity"]);

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
  facilityPosted: number;
  facilities: number;
  businesses: number;
  breakdowns: number;
  rebuilds: number;
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

  onRebuild(): void {
    this.acc.rebuilds++;
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
    for (const t of w.trucks) {
      if (t.status === "idle") idle++;
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
      facilityPosted: a.facilityPosted,
      facilities: w.facilities.length,
      businesses: w.businesses.filter((b) => b.ownerId > 0).length,
      breakdowns: a.breakdowns,
      rebuilds: a.rebuilds,
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
      lockedFd: w.companies.reduce((s, c) => s + c.lockedFd, 0),
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
    this.days.push(m);
    this.acc = emptyAcc();
    return m;
  }
}

function emptyAcc() {
  return {
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
    rebuilds: 0,
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
