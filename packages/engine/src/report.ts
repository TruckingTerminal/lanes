import { dealerPrice, orderPrice, ordersOf, trailerValue, truckValue } from "./dealer.js";
import { facilitiesOf } from "./demand.js";
import { depositorValue } from "./finance.js";
import { companyAccount } from "./ledger.js";
import type { DayMetrics } from "./metrics.js";
import type { BrokerageLog, LaunchRecord } from "./types.js";
import { creditScore } from "./credit.js";
import { riskStats } from "./purchaseLoans.js";
import { reserveCapFd, reserveFd, reserveHeldFd } from "./cashReserve.js";
import { subsidyFd } from "./emission.js";
import { contractAccount } from "./receivables.js";
import { exitAccount, stakeAccount } from "./staking.js";
import { loanStakeAccount, operatingTrucks, type World } from "./world.js";

export interface QuarterReport {
  season: number;
  quarter: number;
  label: string;
  faucetFd: number;
  /** Operating sinks; the season-close burn is reported per season instead. */
  sinkFd: number;
  sinkFaucetRatio: number;
  pass: boolean;
}

export interface SeasonReport {
  season: number;
  faucetFd: number;
  sinkFd: number;
  sinkFaucetRatio: number;
  /** (Operating sinks + the season-close burn) ÷ faucets, for completed seasons. */
  ratioWithBurn: number | null;
  burnedFd: number | null;
  supplyBeforeCloseFd: number | null;
  supplyAfterCloseFd: number | null;
  companiesAtCarryoverCap: number | null;
}

/** Sinks over faucets for a run of days, raw (the gate's) and with the NPC advance-and-repayment wash taken out of both sides. */
export interface RatioReading {
  raw: number;
  corrected: number;
  faucetFd: number;
  sinkFd: number;
  /** The NPC factor's and lessor's advances on companies' paper (faucet:npc_advance) and their repayments (sink:npc_factor). */
  advanceFd: number;
  repaidFd: number;
}

export function ratioOf(slice: readonly DayMetrics[]): RatioReading {
  let faucetFd = 0;
  let sinkFd = 0;
  let advanceFd = 0;
  let repaidFd = 0;
  for (const d of slice) {
    faucetFd += d.faucetFd;
    sinkFd += d.sinkFd;
    advanceFd += d.faucetByTag?.npc_advance ?? 0;
    repaidFd += d.sinkByTag?.npc_factor ?? 0;
  }
  const raw = faucetFd > 0 ? sinkFd / faucetFd : 0;
  const corrected = faucetFd - advanceFd > 0 ? (sinkFd - repaidFd) / (faucetFd - advanceFd) : 0;
  return { raw, corrected, faucetFd, sinkFd, advanceFd, repaidFd };
}

/** The faucet tags that are NPC freight pay (the emission cap's draw; emission.ts FREIGHT_FAUCETS), by their metrics key. */
const FREIGHT_TAGS = new Set(["npc_shipper", "npc_factor", "npc_lessor", "npc_market"]);

/**
 * Three readings of "FD supply never doubles in a year". From a 5,000-FD-per-
 * company cold start any sink ratio under ~99.5% doubles supply, so the literal
 * reading can't pass by arithmetic; the established-base readings decide.
 */
export interface SupplyReport {
  startFd: number;
  endFd: number;
  /** Max supply ÷ Season 1 starting grants (literal reading, informational). */
  fromGrants: number;
  /** Max growth within a season over the supply at the end of its first in-game month. */
  afterWarmup: number;
  /** Max supply(d) ÷ supply(d − 1 season), for days past each season's first month. Null with one season. */
  yearOverYear: number | null;
  pass: boolean;
}

export interface RunReport {
  configVersion: string;
  seed: number;
  days: number;
  companies: number;
  trucks: number;
  quarters: QuarterReport[];
  seasons: SeasonReport[];
  supply: SupplyReport;
  /** Strategy mean Miles/hour vs. the median company that started in the same segment. */
  strategies: { segment: string; strategy: string; companies: number; milesPerHour: number; vsMedian: number }[];
  /** Informational: best strategy vs. the median across all carriers, any segment. */
  crossSegmentTop: number;
  strategyPass: boolean;
  freePath: {
    companies: number;
    bought: number;
    withinLimit: number;
    medianDays: number | null;
    /** Could afford a Workhorse + dry van within the limit (earnings, ignoring supply). */
    affordWithinLimit: number;
    medianAffordDays: number | null;
    /** The first bid by hand (freeEntry.firstBidByHand): free starters that bid by hand, and the days their truck waited for it. */
    handBid: { companies: number; bid: number; medianDays: number | null; meanDays: number | null };
    pass: boolean;
  };
  board: { posted: number; cleared: number; expired: number; fillRate: number; avgClearedRate: number; onTimeShare: number };
  wear: { rebuilds: number; breakdowns: number; avgOwnedCondition: number; roadService: { stop: number; hub: number; npc: number }; passClosures: number };
  /** Nights on the road: at a site, on the shoulder, tickets written, and sites found full. */
  parking: { siteNights: number; shoulderNights: number; tickets: number; sitesFull: number };
  /** The trailer pass and the risk corridors: waits at docks, missed appointment slots, flatbed damage claims, cargo thefts. */
  operations: { dockWaits: number; dockWaitHours: number; missedSlots: number; flatbedDamage: number; cargoThefts: number; cargoTheftFd: number };
  /**
   * The money behind trucks (2026-10-31): NPC lease deposits held at the end; purchase loans made, still
   * owed and open at the end, interest paid, defaults, trucks taken back, stakes slashed and written off.
   */
  /** Hired robbers (robbery.ts): crews hired and their fees, hits, rigs chopped, cargo taken, what the hirers were paid, and the security fittings bought. */
  robbery?: { hires: number; hits: number; rigsTaken: number; cargoTakenFd: number; takePaidFd: number; feesFd: number; fittingsFd: number; fencePaidFd: number; chopPaidFd: number; resaleFd: number; bountiesPostedFd: number; bountiesPaidFd: number; victimsPaidFd: number; stakesLockedFd: number; caught: number; talked: number; gaveUp: number; investigations: number; convictions: number; finesFd: number; suspensions: number; yardSecurityFd: number; lessorWaivedFd: number; heatOver: number; heatMax: number; yardsSecured: number };
  /**
   * Factoring while payment terms are on (receivables.ts; the contract when token.payment.factoring.contract is on):
   * who signed and at what fleet, what was factored and the discounts paid (a sink), the starters who signed within
   * 30 days of their first truck, liquidations of one-truck owners that signed against those that never did, the
   * brokers' AP cap and bond at work, and brokered against direct NPC freight.
   */
  factoring?: {
    contract: boolean;
    signers: { carriers: number; brokers: number };
    contracts: { signed: number; renewals: number; lapses: number };
    /** Carriers' first signings by operating trucks then. */
    firstSignByFleet: Record<string, number>;
    invoicesFd: { carriers: number; brokers: number };
    feesFd: { carriers: number; brokers: number };
    /** Carriers' terms by fleet at signing: contracts, invoices factored, discounts paid. */
    byTrucks: Record<string, { contracts: number; invoicesFd: number; feesFd: number }>;
    /** Free starters that bought a first truck, had it running, and signed within 30 days of its first day on the road. */
    starters: { bought: number; inService: number; signedWithin30: number };
    oneTruck: { signers: number; signersLiquidated: number; others: number; othersLiquidated: number };
    brokerCap: { tendersCapped: number; tendersToBoard: number; bookingsCapped: number; bondPaidFd: number; bondToNpcFd: number; uncoveredFd: number; overdraftFd: number; bondEndFd: number };
    brokered: { loads: number; payPerMile: number };
    direct: { loads: number; payPerMile: number };
  };
  /** The population dial (population.ts): its band, what it did, and the days it sat outside the band. */
  population?: { dial: boolean; band: readonly [number, number]; retired: number; woundDown: number; entered: number; daysUnder: number; daysOver: number };
  /**
   * Carriers by starting segment and strategy at the end: companies, mean wealth, the share liquidated at least once,
   * mean operating result; and (from v59) liquidations per company, median wealth, mean and median net worth (wealth
   * with locked FD and businesses, less debt), trucks running, and the dollars put in and cashed out per company.
   */
  byStrategy?: Record<string, Record<string, { companies: number; wealthFd: number; liquidatedShare: number; operatingFd: number; bankruptcies?: number; medianWealthFd?: number; netWorthFd?: number; medianNetWorthFd?: number; trucks?: number; usdIn?: number; usdOut?: number; /** Liquid FD (cash and the Reserve), median; and the first owned truck: how many bought one, the median day from the company's start. */ medianCashFd?: number; firstTruck?: { bought: number; medianDay: number | null } }>>;
  /**
   * The emission cap (emission.ts), on or off (off: what it would have capped). By month: the budget, NPC freight pay
   * committed at the invoice and paid in cash against it, R's subsidy, the carry after the month; the levers' means and
   * the days each sat at its floor (from the daily metrics; the open month included when it has days). Totals; NPC pay
   * by kind (spot, brokered, contract) and the open NPC board by kind (mean a day); the three starter hubs by week (the NPC
   * loads planFreight asked them to post a day, open NPC loads and idle trucks there at day end); the reserve against its
   * genesis level and the supply at the end, for the net emission.
   */
  emission?: {
    enabled: boolean;
    refill: number;
    firstMonthFd: number;
    months: { month: number; days: number; budgetFd: number; committedFd: number; paidFd: number; subsidyFd: number; carryFd: number; volMult: number; rateMult: number; product: number; daysAtVolFloor: number; daysAtRateFloor: number }[];
    totals: { budgetedFd: number; committedFd: number; paidFd: number; subsidyFd: number; carryFd: number; daysAtVolFloor: number; daysAtRateFloor: number };
    pay: Record<"spot" | "brokered" | "contract" | "market", { loads: number; fd: number }>;
    openByKind: { spot: number; contract: number };
    starterHubs: Record<string, { week: number; expectedPerDay: number; openPerDay: number; idlePerDay: number }[]>;
    reserve: { genesisReserveFd: number; endFd: number; netEmittedFd: number; supplyEndFd: number; capFd: number; genesisFd: number };
  };
  /**
   * The ratio's accounting, measured beside the gate's raw ratio (the gate's definition is unchanged; economy-emission.md
   * §14). An NPC's advance on a company's paper (receivables.ts NPC_ADVANCE) is a faucet and its repayment (sink:npc_factor)
   * a sink of the same FD, so `corrected` takes both out. By year, the operating faucets other than NPC freight pay and the
   * advance, by tag, and the corrected ratio with each of them taken out of the faucets alone: where the ratio lives with
   * and without each.
   */
  ratios?: {
    quarters: ({ label: string } & RatioReading)[];
    years: ({ year: number; freightFd: number; otherFaucetsByTag: Record<string, number>; withoutByTag: Record<string, number> } & RatioReading)[];
  };
  /**
   * Player brokerages (brokerage.ts), when on: each pair (its carrier's and brokerage's net worth at the end, what the
   * brokerage made for its owner, the capital each way and its fees), the control carriers that could have formed one,
   * and the rule's flows (transfers, Rule A passes, Rule B own tenders and their rate against the board's clears).
   */
  brokerage?: Omit<BrokerageLog, "formed" | "controls" | "laneRates" | "hubRates"> & {
    pairs: { segment: string; persona: string; day: number; carrierNetWorthFd: number; brokerNetWorthFd: number; brokerGainFd: number; brokerOperatingFd: number; brokerRevenueFd: number; capitalFd: number; toBrokerFd: number; toCarrierFd: number; feeFd: number; carrierLiquidations: number; brokerLiquidations: number; brokerStakeEndFd: number; brokerCredit: number; carrierTrucks: number; marks: { days: number; operatingFd: number; gainFd: number }[] }[];
    controls: { segment: string; persona: string; day: number; carrierNetWorthFd: number; carrierLiquidations: number; carrierTrucks: number }[];
    aiBrokers: { companies: number; operatingFd: number; revenueFd: number; liquidated: number; liquidationDays: number[] };
    factoringBondPaidFd: number;
    uncoveredFd: number;
  };
  /** The Reserve (cashReserve.ts), when on: held at the end in all, what it paid in holding cost and season burns, deposits and withdrawals, and by segment and strategy the mean held, its cap and how many hold any. */
  cashReserve?: { heldEndFd: number; holdingFd: number; burnedFd: number; depositFd: number; withdrawFd: number; byStrategy: Record<string, { companies: number; heldFd: number; capFd: number; holders: number }> };
  /** Staking locks (token.staking.lockDiscounts): locks made by term, what became of them, the discounts given and the slashes burned. */
  locks?: { made: Record<string, { locks: number; fd: number }>; rolled: number; matured: number; broken: number; discountsFd: number; slashedFd: number; brokenDiscountsFd: number; lockedEndFd: number };
  /** Fleet sizes at the end: carriers running more than 5, 10 and 20 trucks, and the largest fleet. */
  fleets?: { over5: number; over10: number; over20: number; largest: number };
  /** The join wave's newcomers (population.wave): how many, how many bought a first truck and in how many days (median), and how many went under. */
  wave?: { companies: number; bought: number; medianDays: number | null; within84: number; liquidated: number };
  truckMoney?: {
    leaseDepositsEndFd: number;
    loansMadeFd: number;
    loansOwedEndFd: number;
    loansOpenEnd: number;
    interestFd: number;
    defaults: number;
    seized: number;
    stakeSlashedFd: number;
    writtenOffFd: number;
    /** Risk pricing (equipmentFinance.purchase.risk), when on: premiums paid, borrower-weeks paying one and in breach of the bust covenant, defaults the covenant brought forward. */
    risk?: { premiumFd: number; payingWeeks: number; breachWeeks: number; covenantDefaults: number };
  };
  /**
   * Assets and destruction (assets.enabled): what was scrapped, written off and stolen; the factory's
   * output and how it was sold; trailers, rentals, swaps and leases; and the equipment sinks against all
   * sinks: new equipment bought (the NPC dealer's sales and the dealerships' wholesale), and every cost of
   * equipment (new, the NPC lessor's share, trailer rent, rebuilds and refurbishments).
   */
  assets: {
    scrappedTractors: number;
    scrappedTrailers: number;
    totalLosses: number;
    yardThefts: number;
    factoryTractors: number;
    factoryTrailers: number;
    dealershipSales: number;
    dealershipSalesFd: number;
    tradeIns: number;
    trailerRentals: number;
    trailerSwaps: number;
    refurbs: number;
    playerLeases: number;
    assetSales: number;
    ownedTrailersEnd: number;
    rentalsOutEnd: number;
    leasedOutEnd: number;
    newEquipmentFd: number;
    newEquipmentShareOfSinks: number;
    allEquipmentFd: number;
    allEquipmentShareOfSinks: number;
  };
  /**
   * How much of each market players run (the EVE plan's bar: players make almost everything): new trucks
   * sold from player dealerships' stock, shop work done at player shops (estimated from the parts share),
   * insurance written by the player pool, and freight posted by player facilities.
   */
  playerShare: { newTrucks: number; shopWork: number; insurance: number; freight: number };
  facilities: {
    owned: Record<string, number>;
    ownersBySegment: Record<string, number>;
    /** Share of posted loads that came from player facilities. */
    loadShare: number;
    /** Owners' average FD result per facility-week, by type (after upkeep). */
    weeklyNetByType: Record<string, number>;
  };
  /** Player businesses (businesses.ts) by kind: open at the end, ever opened, the owners' FD result per business-year (purchase and upkeep included), the trade alone (margins − upkeep) per business-year, and the average purchase. */
  businesses: Record<string, { open: number; everOpened: number; netFdPerYear: number; tradeFdPerYear: number; purchaseFd: number }>;
  /**
   * Carrier economics by starting segment ("oo", "fleet"): fleet overhead paid,
   * and operating profit per operating truck-week before and after overhead.
   */
  carriersBySegment: Record<
    string,
    { companies: number; trucks: number; overheadFd: number; payingOverhead: number; profitPerTruckWeek: number; afterOverheadPerTruckWeek: number }
  >;
  /** Money supply per in-game year: the day before the close day, the year's last day, and growth year to year. */
  inflation: { years: { year: number; preCloseFd: number; yearEndFd: number; avgRate: number; growthVsPriorYear: number | null }[] };
  /** Cash + finance deposits + trucks at used value + trucks on order + facilities, across all companies. */
  wealth: { gini: number; top1Share: number; top10Share: number; milesGini: number; avgBySegment: Record<string, number> };
  failures: {
    repossessions: number;
    companiesRepossessed: number;
    /** Carriers that lost a truck to the repo man and have no truck left. */
    wipedOut: number;
    inDebtAtEnd: number;
    /** Every company's negative cash, summed (negative); and the part of it on companies the population dial retired (positive), which the gate's debt line leaves out. */
    debtFd: number;
    debtRetiredFd: number;
    writtenOffFd: number;
    /** Liquidations, companies that went through one, and debt written off at restart (a faucet). */
    bankruptcies: number;
    companiesBankrupt: number;
    bankruptBySegment: Record<string, number>;
    debtWrittenOffFd: number;
    shipperDefaults: number;
  };
  finance: { loansMade: number; interestPaidFd: number; peakOutstandingFd: number; outstandingEndFd: number; depositors: number };
  usedMarket: { sales: number; repoReturnedToDealer: number; npcLotSold?: number };
  /** The cycle quarter by quarter, across years: demand dial, rates, orders, deliveries, failures. */
  cycleQuarters: {
    label: string;
    cycle: number;
    avgRate: number;
    ordersPlaced: number;
    trucksDelivered: number;
    repossessions: number;
    usedSales: number;
    sinkFaucetRatio: number;
  }[];
  faucetsByTag: Record<string, number>;
  sinksByTag: Record<string, number>;
  /** Burns and mints outside operations (buybacks, exchange fees, launch, airdrop). */
  burnsByTag: Record<string, number>;
  mintsByTag: Record<string, number>;
  realMoney: RealMoneyReport;
  pass: boolean;
}

export interface RealMoneyReport {
  /** The weekly buyback auction, when it ran: totals and the clearing price quarter by quarter. */
  buyback: {
    weeks: number;
    boughtFd: number;
    spentUsd: number;
    avgPriceUsd: number | null;
    byQuarter: { label: string; priceUsd: number | null; boughtFd: number; offeredFd: number }[];
  } | null;
  /** Dollars taken out of and put into the game, by starting segment, and taken out per company-week. */
  usdOutBySegment: Record<string, number>;
  usdInBySegment: Record<string, number>;
  usdOutPerCompanyWeek: Record<string, number>;
  /** FD as a real-money token, when it launched. */
  token: TokenReport | null;
}

export interface TokenReport {
  launchDay: number;
  launch: LaunchRecord;
  price: { launchUsd: number; minUsd: number; maxUsd: number; endUsd: number; byQuarter: { label: string; priceUsd: number }[]; maxDrawdown: number };
  /** FD supply (all accounts, pool included): before launch, right after it, at the end; and held by companies at the end. */
  supply: { beforeLaunchFd: number; afterLaunchFd: number; endFd: number; companiesEndFd: number; poolEndFd: number; byYearEnd: number[] };
  /** Since launch: FD created by operations, minted by the token layer, burned by operations and by the token layer. */
  sinceLaunch: { operatingFaucetFd: number; operatingSinkFd: number; mintedByTag: Record<string, number>; burnedByTag: Record<string, number> };
  treasury: { seedUsd: number; productUsd: number; feeUsd: number; buybackUsd: number; buybackFd: number; opsUsd: number; devUsd: number; vestedFd: number };
  pool: { endUsd: number; endFd: number; peakUsd: number };
  /**
   * The token's size (Jeff, 2026-10-31): market cap (price × circulating FD) and FDV (price × the cap less
   * burns), at the launch price on launch day, at the end, and at their peaks; and the circulating and
   * total FD behind them.
   */
  valuation: {
    launch: { marketCapUsd: number; fdvUsd: number; circulatingFd: number; totalSupplyFd: number };
    end: { marketCapUsd: number; fdvUsd: number; circulatingFd: number; totalSupplyFd: number };
    peakMarketCapUsd: number;
    peakFdvUsd: number;
  };
  airdrop: { allocatedFd: number; mintedFd: number; forfeitedFd: number; haircutFd: number; recipients: number; claimedEarly: number };
  newCompanies: number;
  /** Dollars after launch, by starting segment: put in, taken out, and net taken out. */
  usdBySegment: Record<string, { in: number; out: number; net: number; companies: number }>;
  /** The demand the design needs: FD sold into the pool net of buys, per month, and the new buying per 1,000 active companies a month that would hold the end price. */
  demand: { monthsSinceLaunch: number; activeCompanies: number; netSoldFdPerMonth: number; usdPerThousandCompaniesMonth: number };
  /** The launch gates (Jeff, 2026-10-29): the price held from launch, and the pool's dollars grew. */
  gates: { holdsLaunchPrice: boolean; poolDollarsGrew: boolean };
  /**
   * The supply ceiling (ceiling.ts), when it's on: FD outstanding right after launch and at the end
   * against the path; the worst day over it and how many days were; the weeks the scheduled payouts
   * waited and the weeks the dial sat at its floor; the airdrop queued (peak, end) and paid back out;
   * and the dial's rate multiplier (lowest, end).
   */
  ceiling?: {
    growth: number;
    overDays: number;
    baseFd: number;
    endFd: number;
    endCeilingFd: number;
    maxOverShare: number;
    daysOver: number;
    weeksHolding: number;
    weeksAtFloor: number;
    vestHeldWeeks: number;
    queuedPeakFd: number;
    queuedEndFd: number;
    releasedFd: number;
    rateMultMin: number;
    rateMultEnd: number;
  };
  /** The daily price band (exchange.priceBand), when it's on: its width, the trades it clipped, and the biggest day-to-day move in its days. */
  band?: { pct: number; clips: number; maxDayMove: number };
  /**
   * The logbook (token.airdrop.logbook), when it's on: FD paid as books opened, by honest and by criminal
   * milestones, lost at a deadline and to convictions, and still locked at the end; the books, the median
   * share of an allocation unlocked, and the companies that reached each milestone.
   */
  logbook?: { openFd: number; honestFd: number; criminalFd: number; lostFd: number; convictedFd: number; lockedEndFd: number; books: number; medianUnlockedShare: number; reached: Record<string, number> };
  /** The unlock ladder (unlockLadder), when it's on: the days after launch each layer opened (null: still closed). */
  ladder?: Record<string, number | null>;
  /** The opening auction (token.launch.auction), when it cleared: dollars bid, FD sold, bidders, the clearing price, the pool's dollars and FD at open, the treasury's dollars, and the tranche and cap it ran with. */
  auction?: { usd: number; fd: number; bidders: number; priceUsd: number; poolUsd: number; poolFd: number; treasuryUsd: number; trancheFd: number; capUsd: number };
  /** The pool's launch fees (exchange.launchFee, sizeFee), when either is on: the start and days of the decay, and the dollars taken on buys and FD burned on sales above the normal fees. */
  launchFee?: { startPct: number; days: number; buyUsd: number; sellFd: number };
  /** The bridge (token.bridge), when it's on: the timer's start and end, FD requested and cleared, the mean wait, days the cap held something back and the FD it held, and what still waits at the end. */
  bridge?: { delayStart: number; delayEnd: number; requestedFd: number; clearedFd: number; meanWaitDays: number; cappedDays: number; cappedFd: number; queuedEndFd: number };
  /** logbook.paidLocked: spend-only FD across every company at the end. */
  lockedEndSupplyFd?: number;
}

/** Scores a run against the PoC kill criteria (§Proof of concept scope and kill criteria). */
/** Companies younger than this don't enter the strategy table. */
const STRATEGY_MIN_DAYS = 180;

function factoringReport(w: World): RunReport["factoring"] {
  const fl = w.factoringLog;
  if (!fl) return undefined;
  const firstSign = new Map<number, (typeof fl.contracts)[number]>();
  for (const k of fl.contracts) if (!k.renewal && !firstSign.has(k.companyId)) firstSign.set(k.companyId, k);
  const carriersSigned = [...firstSign.values()].filter((k) => !k.broker);
  const band = (n: number) => (n <= 1 ? "1" : n === 2 ? "2" : n <= 5 ? "3-5" : n <= 10 ? "6-10" : n <= 20 ? "11-20" : "21+");
  const firstSignByFleet: Record<string, number> = {};
  for (const k of carriersSigned) firstSignByFleet[band(k.trucks)] = (firstSignByFleet[band(k.trucks)] ?? 0) + 1;
  const byTrucks: Record<string, { contracts: number; invoicesFd: number; feesFd: number }> = {};
  const invoicesFd = { carriers: 0, brokers: 0 };
  const feesFd = { carriers: 0, brokers: 0 };
  for (const k of fl.contracts) {
    const side = k.broker ? "brokers" : "carriers";
    invoicesFd[side] += k.invoicesFd;
    feesFd[side] += k.feesFd;
    if (k.broker) continue;
    const b = (byTrucks[String(k.trucks)] ??= { contracts: 0, invoicesFd: 0, feesFd: 0 });
    b.contracts++;
    b.invoicesFd += k.invoicesFd;
    b.feesFd += k.feesFd;
  }
  const liquidatedAfter = (id: number, day: number) => fl.liquidations.some((l) => l.companyId === id && l.day >= day);
  const owners = w.companies.filter((c) => c.role === "carrier" && c.firstOwnedTruckDay !== null);
  const starters = owners.filter((c) => c.freePath);
  const running = starters.filter((c) => fl.firstInService[c.id] !== undefined);
  const signedWithin30 = running.filter((c) => {
    const k = firstSign.get(c.id);
    const from = fl.firstInService[c.id]!;
    return k !== undefined && k.day >= from && k.day <= from + 30;
  }).length;
  const atOne = owners.filter((c) => firstSign.get(c.id)?.trucks === 1);
  const never = owners.filter((c) => !firstSign.has(c.id));
  const perMile = (s: { payFd: number; miles: number }) => (s.miles > 0 ? s.payFd / s.miles : 0);
  return {
    contract: w.cfg.token.payment.factoring.contract.enabled,
    signers: { carriers: carriersSigned.length, brokers: [...firstSign.values()].filter((k) => k.broker).length },
    contracts: { signed: fl.contracts.filter((k) => !k.renewal).length, renewals: fl.contracts.filter((k) => k.renewal).length, lapses: fl.lapses },
    firstSignByFleet,
    invoicesFd,
    feesFd,
    byTrucks,
    starters: { bought: starters.length, inService: running.length, signedWithin30 },
    oneTruck: {
      signers: atOne.length,
      signersLiquidated: atOne.filter((c) => liquidatedAfter(c.id, c.firstOwnedTruckDay!)).length,
      others: never.length,
      othersLiquidated: never.filter((c) => liquidatedAfter(c.id, c.firstOwnedTruckDay!)).length,
    },
    brokerCap: {
      tendersCapped: fl.tendersCapped,
      tendersToBoard: fl.tendersToBoard,
      bookingsCapped: fl.bookingsCapped,
      bondPaidFd: fl.bondPaidFd,
      bondToNpcFd: fl.bondToNpcFd,
      uncoveredFd: fl.uncoveredFd,
      overdraftFd: fl.overdraftFd,
      bondEndFd: w.companies.filter((c) => c.role === "broker").reduce((s, c) => s + c.stakedFd, 0),
    },
    brokered: { loads: fl.brokered.loads, payPerMile: perMile(fl.brokered) },
    direct: { loads: fl.direct.loads, payPerMile: perMile(fl.direct) },
  };
}

export function buildReport(w: World): RunReport {
  const { cfg } = w;
  const k = cfg.killCriteria;
  const days = w.metrics.days;
  const perSeason = cfg.time.daysPerSeason;
  const quarterLen = perSeason / 4;
  // Supply growth is measured after the cold start: the first six months are grants becoming a fleet.
  const warmup = 6 * cfg.time.daysPerMonth;
  const seasonCount = Math.ceil(days.length / perSeason);
  // The quarterly sink/faucet band: the spec's with seasons on; without them, what the stabilizers steer to
  // (beta 97–103%, live 100–104%), with two points of slack either side.
  const band: readonly [number, number] = cfg.seasonClose.enabled
    ? k.sinkFaucetPerQuarter
    : [Math.min(cfg.stabilizers.sinkFaucetTargetWithoutSeasons[0], cfg.token.sinkFaucetTargetLive[0]) - 0.02, Math.max(cfg.stabilizers.sinkFaucetTargetWithoutSeasons[1], cfg.token.sinkFaucetTargetLive[1]) + 0.02];

  const quarters: QuarterReport[] = [];
  const seasons: SeasonReport[] = [];
  for (let s = 0; s < seasonCount; s++) {
    const seasonDays = days.filter((d) => d.season === s);
    for (let q = 0; q < 4; q++) {
      const slice = seasonDays.filter((d) => d.day - s * perSeason >= q * quarterLen && d.day - s * perSeason < (q + 1) * quarterLen);
      if (slice.length < quarterLen - 1) continue; // only score complete quarters
      const faucetFd = sum(slice.map((d) => d.faucetFd));
      const sinkFd = sum(slice.map((d) => d.sinkFd));
      const ratio = faucetFd > 0 ? sinkFd / faucetFd : 0;
      quarters.push({
        season: s + 1,
        quarter: q + 1,
        label: `S${s + 1}Q${q + 1}`,
        faucetFd,
        sinkFd,
        sinkFaucetRatio: ratio,
        pass: ratio >= band[0] && ratio <= band[1],
      });
    }
    const close = w.seasonCloses.find((c) => c.season === s);
    const faucetFd = sum(seasonDays.map((d) => d.faucetFd));
    const sinkFd = sum(seasonDays.map((d) => d.sinkFd));
    seasons.push({
      season: s + 1,
      faucetFd,
      sinkFd,
      sinkFaucetRatio: faucetFd > 0 ? sinkFd / faucetFd : 0,
      ratioWithBurn: close && faucetFd > 0 ? (sinkFd + close.burnedFd) / faucetFd : null,
      burnedFd: close?.burnedFd ?? null,
      supplyBeforeCloseFd: close?.supplyBeforeFd ?? null,
      supplyAfterCloseFd: close?.supplyAfterFd ?? null,
      companiesAtCarryoverCap: close?.companiesAtCap ?? null,
    });
  }

  // The ratio's accounting beside the gate's (ratios): the same complete quarters, and the years, raw and corrected.
  const ratioQuarters: NonNullable<RunReport["ratios"]>["quarters"] = [];
  for (let s = 0; s < seasonCount; s++) {
    for (let q = 0; q < 4; q++) {
      const slice = days.filter((d) => d.season === s && d.day - s * perSeason >= q * quarterLen && d.day - s * perSeason < (q + 1) * quarterLen);
      if (slice.length < quarterLen - 1) continue;
      ratioQuarters.push({ label: `S${s + 1}Q${q + 1}`, ...ratioOf(slice) });
    }
  }
  const ratioYears: NonNullable<RunReport["ratios"]>["years"] = [];
  for (let y = 0; y * perSeason < days.length; y++) {
    const slice = days.filter((d) => Math.floor(d.day / perSeason) === y);
    if (slice.length < perSeason) break;
    const reading = ratioOf(slice);
    let freightFd = 0;
    const otherFaucetsByTag: Record<string, number> = {};
    for (const d of slice) {
      for (const [tag, v] of Object.entries(d.faucetByTag ?? {})) {
        if (FREIGHT_TAGS.has(tag)) freightFd += v;
        else if (tag !== "npc_advance") otherFaucetsByTag[tag] = (otherFaucetsByTag[tag] ?? 0) + v;
      }
    }
    const withoutByTag: Record<string, number> = {};
    for (const [tag, v] of Object.entries(otherFaucetsByTag)) {
      const f = reading.faucetFd - reading.advanceFd - v;
      withoutByTag[tag] = f > 0 ? (reading.sinkFd - reading.repaidFd) / f : 0;
    }
    ratioYears.push({ year: y + 1, freightFd, otherFaucetsByTag, withoutByTag, ...reading });
  }
  const ratios: RunReport["ratios"] = { quarters: ratioQuarters, years: ratioYears };

  const supply = supplyReport(days, perSeason, warmup, k.maxSupplyGrowthPerYear);

  // Miles per in-game hour across all seasons, grouped by strategy within the
  // segment a company started in ("oo" vs. "fleet"): a 6-truck fleet out-earning
  // a 1-truck owner-operator is the truck ladder working, not a broken strategy.
  const hoursNow = w.t / 60;
  const dayNow = w.t / w.cfg.time.gameMinutesPerDay;
  const carriers = w.companies.filter((c) => c.role === "carrier");
  const mph = (c: (typeof carriers)[number]) => (sum(c.milesHistory) + c.milesTotal) / Math.max(1, hoursNow - c.createdDay * 24);
  const bySegment = new Map<string, Map<string, number[]>>();
  // Companies younger than half a year have too little history for a rate, and each human is a "strategy" of one.
  for (const c of carriers) {
    if (dayNow - c.createdDay < STRATEGY_MIN_DAYS || c.strategy.startsWith("player:")) continue;
    const [segment, strategy] = c.strategy.includes(":") ? c.strategy.split(":") : ["all", c.strategy];
    const seg = bySegment.get(segment!) ?? new Map<string, number[]>();
    seg.set(strategy!, [...(seg.get(strategy!) ?? []), mph(c)]);
    bySegment.set(segment!, seg);
  }
  const strategies = [...bySegment].flatMap(([segment, seg]) => {
    const segMedian = median([...seg.values()].flat()) || 1;
    return [...seg].map(([strategy, v]) => ({
      segment,
      strategy,
      companies: v.length,
      milesPerHour: sum(v) / v.length,
      vsMedian: sum(v) / v.length / segMedian,
    }));
  });
  strategies.sort((a, b) => b.vsMedian - a.vsMedian);
  const overallMedian = median(carriers.map(mph)) || 1;
  const crossSegmentTop = Math.max(0, ...strategies.map((s) => s.milesPerHour / overallMedian));
  const strategyPass = strategies.every((s) => s.vsMedian <= k.maxStrategyVsMedian);

  // Median over every free owner-operator old enough to have had the chance, counting those who
  // never bought as never: it passes only if at least half buy within the limit. Buying the FD with
  // dollars isn't the free path.
  const free = carriers.filter((c) => c.freePath && dayNow - c.createdDay >= k.freePathMaxDays && c.usd.in === 0);
  const daysOrNever = (d: number | null, c: (typeof free)[number]) => (d === null ? Infinity : d - c.createdDay);
  const boughtDays = free.map((c) => daysOrNever(c.firstOwnedTruckDay, c));
  const withinLimit = boughtDays.filter((d) => d <= k.freePathMaxDays).length;
  const medianOrNull = (xs: number[]) => {
    const m = xs.length ? median(xs) : Infinity;
    return Number.isFinite(m) ? m : null;
  };
  const medianDays = medianOrNull(boughtDays);
  const affordDays = free.map((c) => daysOrNever(c.firstAffordDay, c));
  const affordWithinLimit = affordDays.filter((d) => d <= k.freePathMaxDays).length;
  const medianAffordDays = medianOrNull(affordDays);
  // The first bid by hand (freeEntry.firstBidByHand): how long a free starter's truck sat before its owner's first bid.
  const starters = carriers.filter((c) => c.freePath);
  const handBidDays = starters.filter((c) => c.firstHandBidDay !== null).map((c) => c.firstHandBidDay! - c.createdDay);
  const handBid = {
    companies: starters.length,
    bid: handBidDays.length,
    medianDays: handBidDays.length ? median(handBidDays) : null,
    meanDays: handBidDays.length ? sum(handBidDays) / handBidDays.length : null,
  };

  const posted = sum(days.map((d) => d.posted));
  const cleared = sum(days.map((d) => d.cleared));
  const delivered = sum(days.map((d) => d.delivered));
  const faucetsByTag = sumTags(days.map((d) => d.faucetByTag));
  const sinksByTag = sumTags(days.map((d) => d.sinkByTag));
  const burnsByTag = sumTags(days.map((d) => d.burnByTag ?? {}));
  const mintsByTag = sumTags(days.map((d) => d.mintByTag ?? {}));

  const owned: Record<string, number> = {};
  const ownersBySegment: Record<string, number> = {};
  const netByType: Record<string, { net: number; weeks: number }> = {};
  const today = days.length;
  for (const f of w.facilities) {
    if (f.ownerId === 0) continue;
    owned[f.type] = (owned[f.type] ?? 0) + 1;
    const acc = (netByType[f.type] ??= { net: 0, weeks: 0 });
    acc.net += f.netFd;
    acc.weeks += (today - f.boughtDay) / 7;
    const segment = w.companies[f.ownerId - 1]!.strategy.split(":")[0]!;
    ownersBySegment[segment] = (ownersBySegment[segment] ?? 0) + 1;
  }

  const carriersBySegment: RunReport["carriersBySegment"] = {};
  for (const c of carriers) {
    const segment = c.strategy.split(":")[0]!;
    const trucks = w.trucksByCompany.get(c.id)!.length;
    const truckWeeks = c.truckWeeks;
    const s = (carriersBySegment[segment] ??= { companies: 0, trucks: 0, overheadFd: 0, payingOverhead: 0, profitPerTruckWeek: 0, afterOverheadPerTruckWeek: 0 });
    s.companies++;
    s.trucks += trucks;
    s.overheadFd += c.overheadPaidFd;
    if (c.overheadPaidFd > 0) s.payingOverhead++;
    // Accumulate sums here; turned into per-truck-week rates below.
    s.profitPerTruckWeek += c.operating.revenueFd - c.operating.costFd;
    s.afterOverheadPerTruckWeek += truckWeeks;
  }
  for (const s of Object.values(carriersBySegment)) {
    const truckWeeks = s.afterOverheadPerTruckWeek;
    const profit = s.profitPerTruckWeek;
    s.profitPerTruckWeek = truckWeeks > 0 ? profit / truckWeeks : 0;
    s.afterOverheadPerTruckWeek = truckWeeks > 0 ? (profit - s.overheadFd) / truckWeeks : 0;
  }

  // Inflation by year.
  const years: RunReport["inflation"]["years"] = [];
  for (let y = 0; y * perSeason < days.length; y++) {
    const yearDays = days.filter((d) => Math.floor(d.day / perSeason) === y);
    if (yearDays.length < perSeason) break;
    const preCloseFd = days[y * perSeason + perSeason - 2]!.supplyFd;
    const cleared = sum(yearDays.map((d) => d.cleared));
    const prior = years.at(-1);
    years.push({
      year: y + 1,
      preCloseFd,
      yearEndFd: yearDays.at(-1)!.supplyFd,
      avgRate: cleared ? sum(yearDays.map((d) => d.avgClearedRate * d.cleared)) / cleared : 0,
      growthVsPriorYear: prior && prior.preCloseFd > 0 ? preCloseFd / prior.preCloseFd : null,
    });
  }

  // Wealth concentration.
  const wealthOf = (companyId: number) => {
    let wealth = w.ledger.balance(companyAccount(companyId)) + depositorValue(w, companyId) + (cfg.cashReserve.enabled ? reserveHeldFd(w, companyId) : 0);
    // Assets: a leased tractor is its owner's wealth, not the lessee's; trailers in the yard count too.
    for (const t of w.trucksByCompany.get(companyId)!) if (!t.lessorId || t.lessorId === companyId) wealth += truckValue(w, t);
    for (const t of w.trucks) if (t.lessorId === companyId && t.companyId !== companyId && t.status !== "retired") wealth += truckValue(w, t);
    for (const tr of w.trailersByCompany.get(companyId) ?? []) if (tr.lease === "owned" && tr.status !== "hooked") wealth += trailerValue(w, tr);
    for (const o of ordersOf(w, companyId)) wealth += orderPrice(w, o);
    for (const f of facilitiesOf(w, companyId)) wealth += cfg.facilities.types[f.type].priceFd;
    return wealth;
  };
  // Wallets outside the game (role "holder") aren't companies: wealth and Miles figures leave them out.
  const counted = w.companies.filter((c) => c.role !== "holder");
  const wealthAll = counted.map((c) => wealthOf(c.id));
  const avgBySegment: Record<string, number> = {};
  const segCounts: Record<string, number> = {};
  counted.forEach((c, i) => {
    const seg = c.strategy.split(":")[0]!;
    avgBySegment[seg] = (avgBySegment[seg] ?? 0) + wealthAll[i]!;
    segCounts[seg] = (segCounts[seg] ?? 0) + 1;
  });
  for (const seg of Object.keys(avgBySegment)) avgBySegment[seg]! /= segCounts[seg]!;
  // Prudence (Jeff, 2026-11-02: "players who are prudent businessmen win in the long run"): by segment and strategy.
  // Wealth above counts what a company holds, not what it owes, so a borrower's truck counts in full. Net worth adds
  // the FD it has locked up (stakes, the exit queue, contract and business bonds, loan stakes) and its businesses at
  // cost, and takes off its purchase loans and Equipment Finance debt. Dollars in and out are real money a paying bot
  // put in (to grow, or to stay out of liquidation) and cashed out, which FD figures leave out.
  const netWorthOf = (c: (typeof counted)[number], wealth: number) => {
    let nw = wealth;
    for (const acct of [stakeAccount(c.id), exitAccount(c.id), contractAccount(c.id)]) nw += Math.max(0, w.ledger.balance(acct));
    for (const l of w.purchaseLoans) if (l.borrowerId === c.id && (l.status === "active" || l.status === "defaulted")) nw += w.ledger.balance(loanStakeAccount(l.id)) - l.principalFd;
    for (const l of w.finance.loans) if (l.borrowerId === c.id && (l.status === "active" || l.status === "defaulted")) nw -= l.principalFd;
    for (const b of w.businesses) if (b.ownerId === c.id) nw += b.purchaseFd;
    return nw;
  };
  type Prudence = Required<NonNullable<RunReport["byStrategy"]>[string][string]>;
  const acc: Record<string, Record<string, Prudence>> = {};
  const spreads: Record<string, { wealth: number[]; netWorth: number[]; cash: number[]; firstTruck: number[] }> = {};
  counted.forEach((c, i) => {
    if (c.role !== "carrier") return;
    const [seg, strat] = c.strategy.split(":") as [string, string | undefined];
    if (!strat || (seg !== "oo" && seg !== "fleet" && seg !== "wave")) return;
    const b = ((acc[seg] ??= {})[strat] ??= { companies: 0, wealthFd: 0, liquidatedShare: 0, operatingFd: 0, bankruptcies: 0, medianWealthFd: 0, netWorthFd: 0, medianNetWorthFd: 0, trucks: 0, usdIn: 0, usdOut: 0, medianCashFd: 0, firstTruck: { bought: 0, medianDay: null } });
    const nw = netWorthOf(c, wealthAll[i]!);
    b.companies++;
    b.wealthFd += wealthAll[i]!;
    b.netWorthFd += nw;
    b.liquidatedShare += c.bankruptcies > 0 ? 1 : 0;
    b.operatingFd += c.operating.revenueFd - c.operating.costFd;
    b.bankruptcies += c.bankruptcies;
    b.trucks += operatingTrucks(w, c.id);
    b.usdIn += c.usd.in;
    b.usdOut += c.usd.out;
    const sp = (spreads[`${seg}:${strat}`] ??= { wealth: [], netWorth: [], cash: [], firstTruck: [] });
    sp.wealth.push(wealthAll[i]!);
    sp.netWorth.push(nw);
    // Liquid FD: cash in hand and the Reserve (cashReserve.ts), the emission retune's guard figure (economy-emission.md).
    sp.cash.push(w.ledger.balance(companyAccount(c.id)) + (cfg.cashReserve.enabled ? reserveHeldFd(w, c.id) : 0));
    if (c.firstOwnedTruckDay !== null) sp.firstTruck.push(c.firstOwnedTruckDay - c.createdDay);
  });
  for (const [seg, bySeg] of Object.entries(acc)) for (const [strat, b] of Object.entries(bySeg)) {
    for (const k of ["wealthFd", "netWorthFd", "liquidatedShare", "operatingFd", "bankruptcies", "trucks", "usdIn", "usdOut"] as const) b[k] /= b.companies;
    const sp = spreads[`${seg}:${strat}`]!;
    b.medianWealthFd = median(sp.wealth);
    b.medianNetWorthFd = median(sp.netWorth);
    b.medianCashFd = median(sp.cash);
    b.firstTruck = { bought: sp.firstTruck.length, medianDay: sp.firstTruck.length ? median(sp.firstTruck) : null };
  }
  const byStrategy: NonNullable<RunReport["byStrategy"]> = acc;
  // The emission cap (emission.ts): by month, by kind, the starter hubs, the reserve.
  const emission: RunReport["emission"] = (() => {
    const k = cfg.token.emission;
    const s = w.emission;
    const D = cfg.time.daysPerMonth;
    const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
    const monthRow = (m: { month: number; budgetFd: number; committedFd: number; paidFd: number; subsidyFd: number; carryFd: number }) => {
      const ds = days.filter((d) => Math.floor(d.day / D) === m.month);
      return {
        ...m,
        days: ds.length,
        volMult: mean(ds.map((d) => d.emissionVolMult)),
        rateMult: mean(ds.map((d) => d.emissionMult)),
        product: mean(ds.map((d) => d.emissionVolMult * d.emissionMult)),
        daysAtVolFloor: ds.filter((d) => d.emissionVolMult <= k.volRange[0] + 1e-9).length,
        daysAtRateFloor: ds.filter((d) => d.emissionMult <= k.multRange[0] + 1e-9).length,
      };
    };
    const open = monthRow({ month: s.month, budgetFd: s.monthBudgetFd, committedFd: s.committedMonthFd, paidFd: w.ledger.npcPaidFd() - s.paidAtMonthStartFd, subsidyFd: k.refill > 0 && s.month > 0 ? subsidyFd(k, s.month) : 0, carryFd: s.carryFd + s.monthBudgetFd - s.committedMonthFd });
    const months = [...s.months.map(monthRow), ...(open.days > 0 ? [open] : [])];
    const totals = {
      budgetedFd: sum(months.map((m) => m.budgetFd)),
      committedFd: s.committedFd,
      paidFd: w.ledger.npcPaidFd(),
      subsidyFd: sum(months.map((m) => m.subsidyFd)),
      carryFd: months.at(-1)?.carryFd ?? 0,
      daysAtVolFloor: sum(months.map((m) => m.daysAtVolFloor)),
      daysAtRateFloor: sum(months.map((m) => m.daysAtRateFloor)),
    };
    const starterHubs: NonNullable<RunReport["emission"]>["starterHubs"] = {};
    // The director's fallback starter hubs (DECISIONS.md 2026-11-02): where a newcomer's first board must never be empty.
    for (const id of ["DAL", "LAX", "PHX"]) {
      const h = w.net.hubs.findIndex((x) => x.id === id);
      if (h < 0) continue;
      const rows: { week: number; expectedPerDay: number; openPerDay: number; idlePerDay: number }[] = [];
      for (let wk = 0; wk * 7 < s.hubDays.length; wk++) {
        const slice = s.hubDays.slice(wk * 7, wk * 7 + 7);
        rows.push({ week: wk + 1, expectedPerDay: mean(slice.map((d) => d.expected[h]!)), openPerDay: mean(slice.map((d) => d.open[h]!)), idlePerDay: mean(slice.map((d) => d.idle[h]!)) });
      }
      starterHubs[id] = rows;
    }
    const genesisReserveFd = cfg.token.circular.enabled ? cfg.token.circular.capFd * cfg.token.circular.shares.reserve : 0;
    return {
      enabled: k.enabled,
      refill: k.refill,
      firstMonthFd: k.firstMonthFd,
      months,
      totals,
      pay: { spot: { ...s.pay.spot }, brokered: { ...s.pay.brokered }, contract: { ...s.pay.contract }, market: { ...s.pay.market } },
      openByKind: { spot: mean(s.hubDays.map((d) => d.openSpot)), contract: mean(s.hubDays.map((d) => d.openContract)) },
      starterHubs,
      reserve: { genesisReserveFd, endFd: w.ledger.reserve(), netEmittedFd: genesisReserveFd - w.ledger.reserve(), supplyEndFd: w.ledger.supply(), capFd: k.capFd, genesisFd: k.genesisFd },
    };
  })();
  // The Reserve (cashReserve.ts), when on: what is held at the end by persona, what it shelters, and what it paid.
  const cashReserve: RunReport["cashReserve"] = (() => {
    if (!cfg.cashReserve.enabled) return undefined;
    const by: Record<string, { companies: number; heldFd: number; capFd: number; holders: number }> = {};
    let held = 0;
    for (const c of counted) {
      const h = reserveHeldFd(w, c.id);
      held += h;
      const b = (by[c.strategy.split(":").slice(0, 2).join(":")] ??= { companies: 0, heldFd: 0, capFd: 0, holders: 0 });
      b.companies++;
      b.heldFd += h;
      b.capFd += reserveCapFd(w, c);
      if (reserveFd(w, c.id) > 1) b.holders++;
    }
    for (const b of Object.values(by)) {
      b.heldFd /= b.companies;
      b.capFd /= b.companies;
    }
    return { heldEndFd: held, ...(w.reserveStats ?? { holdingFd: 0, burnedFd: 0, depositFd: 0, withdrawFd: 0 }), byStrategy: by };
  })();
  // Player brokerages (brokerage.ts): each pair against the carriers that could have formed one and didn't.
  const brokerage: RunReport["brokerage"] = (() => {
    const log = w.brokerageLog;
    if (!cfg.brokerage.enabled || !log) return undefined;
    const nwOf = (id: number) => {
      const c = w.companies[id - 1]!;
      return netWorthOf(c, wealthOf(id));
    };
    const pairs = log.formed.map((f) => {
      const carrier = w.companies[f.carrierId - 1]!;
      const broker = w.companies[f.brokerId - 1]!;
      return {
        segment: carrier.strategy.split(":")[0]!,
        persona: carrier.strategy.split(":")[1] ?? "",
        day: f.day,
        carrierNetWorthFd: nwOf(carrier.id),
        brokerNetWorthFd: nwOf(broker.id),
        // What the brokerage made for its owner: its net worth now and what it sent back, less what went in (the capital, the fees on it).
        brokerGainFd: nwOf(broker.id) + f.toCarrierFd - f.capitalFd - f.toBrokerFd,
        brokerOperatingFd: broker.operating.revenueFd - broker.operating.costFd,
        brokerRevenueFd: broker.operating.revenueFd,
        capitalFd: f.capitalFd,
        toBrokerFd: f.toBrokerFd,
        toCarrierFd: f.toCarrierFd,
        feeFd: f.feeFd,
        carrierLiquidations: carrier.bankruptcies,
        brokerLiquidations: broker.bankruptcies,
        brokerStakeEndFd: broker.stakedFd,
        brokerCredit: Math.round(creditScore(w, broker)),
        carrierTrucks: operatingTrucks(w, carrier.id),
        marks: f.marks ?? [],
      };
    });
    const controls = log.controls.map((x) => {
      const c = w.companies[x.carrierId - 1]!;
      return { segment: c.strategy.split(":")[0]!, persona: c.strategy.split(":")[1] ?? "", day: x.day, carrierNetWorthFd: nwOf(c.id), carrierLiquidations: c.bankruptcies, carrierTrucks: operatingTrucks(w, c.id) };
    });
    const { formed: _f, controls: _c, laneRates: _l, hubRates: _h, ...flows } = log;
    // The AI brokers beside them, for scale: their mean operating result and revenue over the run, and how many went under.
    const ai = w.companies.filter((c) => c.role === "broker" && c.strategy.startsWith("broker:"));
    const aiIds = new Set(ai.map((c) => c.id));
    const aiBrokers = {
      companies: ai.length,
      operatingFd: ai.reduce((x, c) => x + c.operating.revenueFd - c.operating.costFd, 0) / Math.max(1, ai.length),
      revenueFd: ai.reduce((x, c) => x + c.operating.revenueFd, 0) / Math.max(1, ai.length),
      liquidated: ai.filter((c) => c.bankruptcies > 0).length,
      liquidationDays: (w.factoringLog?.liquidations ?? []).filter((x) => aiIds.has(x.companyId)).map((x) => x.day),
    };
    return { pairs, controls, ...flows, aiBrokers, factoringBondPaidFd: w.factoringLog?.bondPaidFd ?? 0, uncoveredFd: w.factoringLog?.uncoveredFd ?? 0 };
  })();
  const waveCos = w.companies.filter((c) => c.strategy.startsWith("wave:"));
  const waveDays = waveCos.filter((c) => c.firstOwnedTruckDay !== null).map((c) => c.firstOwnedTruckDay! - c.createdDay).sort((a, b) => a - b);
  const wave: RunReport["wave"] = waveCos.length
    ? { companies: waveCos.length, bought: waveDays.length, medianDays: waveDays.length * 2 >= waveCos.length ? waveDays[Math.floor(waveCos.length / 2)] ?? null : null, within84: waveDays.filter((d) => d <= 84).length, liquidated: waveCos.filter((c) => c.bankruptcies > 0).length }
    : undefined;
  const ps = w.population;
  const population: RunReport["population"] = cfg.population.dial.enabled
    ? { dial: true, band: cfg.population.dial.band, retired: ps?.retired ?? 0, woundDown: ps?.woundDown ?? 0, entered: ps?.entered ?? 0, daysUnder: ps?.daysUnder ?? 0, daysOver: ps?.daysOver ?? 0 }
    : undefined;
  const sortedWealth = wealthAll.map((x) => Math.max(0, x)).sort((a, b) => b - a);
  const totalWealth = sum(sortedWealth) || 1;
  const topShare = (frac: number) => sum(sortedWealth.slice(0, Math.max(1, Math.round(sortedWealth.length * frac)))) / totalWealth;
  const lifetimeMiles = counted.map((c) => sum(c.milesHistory) + c.milesTotal);

  // Failures.
  const repossessed = w.companies.filter((c) => c.repossessions > 0);
  const wipedOut = repossessed.filter((c) => c.role === "carrier" && w.trucksByCompany.get(c.id)!.length === 0 && ordersOf(w, c.id).length === 0).length;
  const balances = w.companies.map((c) => w.ledger.balance(companyAccount(c.id)));
  const debts = balances.filter((b) => b < 0);
  // What the companies the population dial retired still owe (inside `debts`): reported apart, as the daily metrics do.
  const retiredDebtFd = -sum(w.companies.filter((c) => c.retiredDay !== undefined).map((c) => Math.min(0, w.ledger.balance(companyAccount(c.id)))));

  // The cycle, quarter by quarter.
  const cycleQuarters: RunReport["cycleQuarters"] = [];
  for (let q = 0; (q + 1) * quarterLen <= days.length; q++) {
    const slice = days.filter((d) => d.day >= q * quarterLen && d.day < (q + 1) * quarterLen);
    const cleared = sum(slice.map((d) => d.cleared));
    const faucet = sum(slice.map((d) => d.faucetFd));
    cycleQuarters.push({
      label: `Y${Math.floor(q / 4) + 1}Q${(q % 4) + 1}`,
      cycle: sum(slice.map((d) => d.cycle)) / slice.length,
      avgRate: cleared ? sum(slice.map((d) => d.avgClearedRate * d.cleared)) / cleared : 0,
      ordersPlaced: sum(slice.map((d) => d.ordersPlaced)),
      trucksDelivered: sum(slice.map((d) => d.trucksDelivered)),
      repossessions: sum(slice.map((d) => d.repossessions)),
      usedSales: sum(slice.map((d) => d.usedSales)),
      sinkFaucetRatio: faucet > 0 ? sum(slice.map((d) => d.sinkFd)) / faucet : 0,
    });
  }

  const freePass = medianDays !== null && medianDays <= k.freePathMaxDays;
  const quartersPass = quarters.length > 0 && quarters.every((q) => q.pass);
  return {
    configVersion: cfg.version,
    seed: w.seed,
    days: days.length,
    companies: w.companies.length,
    trucks: w.trucks.length,
    quarters,
    seasons,
    supply,
    strategies,
    crossSegmentTop,
    strategyPass,
    freePath: {
      companies: free.length,
      bought: boughtDays.filter(Number.isFinite).length,
      withinLimit,
      medianDays,
      affordWithinLimit,
      medianAffordDays,
      handBid,
      pass: freePass,
    },
    board: {
      posted,
      cleared,
      expired: sum(days.map((d) => d.expired)),
      fillRate: posted ? cleared / posted : 0,
      avgClearedRate: cleared ? sum(days.map((d) => d.avgClearedRate * d.cleared)) / cleared : 0,
      onTimeShare: delivered ? sum(days.map((d) => d.onTimeShare * d.delivered)) / delivered : 0,
    },
    wear: {
      rebuilds: sum(days.map((d) => d.rebuilds)),
      breakdowns: sum(days.map((d) => d.breakdowns)),
      avgOwnedCondition: days.at(-1)?.avgOwnedCondition ?? 1,
      roadService: { stop: sum(days.map((d) => d.roadServiceStop ?? 0)), hub: sum(days.map((d) => d.roadServiceHub ?? 0)), npc: sum(days.map((d) => d.roadServiceNpc ?? 0)) },
      passClosures: sum(days.map((d) => d.passClosures ?? 0)),
    },
    parking: {
      siteNights: sum(days.map((d) => d.siteNights ?? 0)),
      shoulderNights: sum(days.map((d) => d.shoulderNights ?? 0)),
      tickets: sum(days.map((d) => d.tickets ?? 0)),
      sitesFull: sum(days.map((d) => d.sitesFull ?? 0)),
    },
    operations: {
      dockWaits: sum(days.map((d) => d.dockWaits ?? 0)),
      dockWaitHours: sum(days.map((d) => d.dockWaitMin ?? 0)) / 60,
      missedSlots: sum(days.map((d) => d.missedSlots ?? 0)),
      flatbedDamage: sum(days.map((d) => d.flatbedDamage ?? 0)),
      cargoThefts: sum(days.map((d) => d.cargoThefts ?? 0)),
      cargoTheftFd: sum(days.map((d) => d.cargoTheftFd ?? 0)),
    },
    robbery: {
      ...w.robbery.stats,
      // The lot (robbery.lot): heat at the end, and yards with any security.
      heatOver: w.companies.filter((c) => (c.heat ?? 0) >= w.cfg.robbery.lot.heat.investigateAt).length,
      heatMax: Math.max(0, ...w.companies.map((c) => c.heat ?? 0)),
      yardsSecured: w.companies.filter((c) => c.yardSecurity && Object.values(c.yardSecurity).some(Boolean)).length,
    },
    factoring: factoringReport(w),
    population,
    byStrategy,
    emission,
    ratios,
    brokerage,
    cashReserve,
    wave,
    locks: w.lockStats ? { ...w.lockStats, lockedEndFd: w.companies.reduce((s, c) => s + (c.locks ?? []).filter((l) => l.endDay > (days.at(-1)?.day ?? 0)).reduce((a, l) => a + l.fd, 0), 0) } : undefined,
    fleets: (() => {
      const sizes = w.companies.filter((c) => c.role === "carrier").map((c) => operatingTrucks(w, c.id));
      return { over5: sizes.filter((n) => n > 5).length, over10: sizes.filter((n) => n > 10).length, over20: sizes.filter((n) => n > 20).length, largest: Math.max(0, ...sizes) };
    })(),
    truckMoney: {
      leaseDepositsEndFd: days.at(-1)?.leaseDepositsFd ?? 0,
      loansMadeFd: w.purchaseLending.madeFd,
      loansOwedEndFd: days.at(-1)?.purchaseLoansFd ?? 0,
      loansOpenEnd: days.at(-1)?.purchaseLoansOpen ?? 0,
      interestFd: w.purchaseLending.interestFd,
      defaults: w.purchaseLending.defaults,
      seized: w.purchaseLending.seized,
      stakeSlashedFd: w.purchaseLending.stakeSlashedFd,
      writtenOffFd: w.purchaseLending.writtenOffFd,
      risk: cfg.equipmentFinance.purchase.risk.enabled ? riskStats(w) : undefined,
    },
    assets: (() => {
      const total = sum(Object.values(sinksByTag)) + sum(days.map((d) => d.burnFd));
      const wholesale = sum(days.map((d) => d.wholesaleFd ?? 0));
      const newFd = (sinksByTag["equipment_dealer"] ?? 0) + wholesale;
      const allFd = newFd + (sinksByTag["npc_lease"] ?? 0) + (sinksByTag["trailer_rent"] ?? 0) + (sinksByTag["rebuild"] ?? 0);
      const last = days.at(-1);
      return {
        scrappedTractors: sum(days.map((d) => d.scrappedTractors ?? 0)),
        scrappedTrailers: sum(days.map((d) => d.scrappedTrailers ?? 0)),
        totalLosses: sum(days.map((d) => d.totalLosses ?? 0)),
        yardThefts: sum(days.map((d) => d.yardThefts ?? 0)),
        factoryTractors: sum(days.map((d) => d.factoryTractors ?? 0)),
        factoryTrailers: sum(days.map((d) => d.factoryTrailers ?? 0)),
        dealershipSales: sum(days.map((d) => d.dealershipSales ?? 0)),
        dealershipSalesFd: sum(days.map((d) => d.dealershipSalesFd ?? 0)),
        tradeIns: sum(days.map((d) => d.tradeIns ?? 0)),
        trailerRentals: sum(days.map((d) => d.trailerRentals ?? 0)),
        trailerSwaps: sum(days.map((d) => d.trailerSwaps ?? 0)),
        refurbs: sum(days.map((d) => d.refurbs ?? 0)),
        playerLeases: sum(days.map((d) => d.playerLeases ?? 0)),
        assetSales: sum(days.map((d) => d.assetSales ?? 0)),
        ownedTrailersEnd: last?.ownedTrailers ?? 0,
        rentalsOutEnd: last?.rentalsOut ?? 0,
        leasedOutEnd: last?.leasedOut ?? 0,
        newEquipmentFd: newFd,
        newEquipmentShareOfSinks: total > 0 ? newFd / total : 0,
        allEquipmentFd: allFd,
        allEquipmentShareOfSinks: total > 0 ? allFd / total : 0,
      };
    })(),
    playerShare: (() => {
      const orders = sum(days.map((d) => d.ordersPlaced));
      const dealerships = sum(days.map((d) => d.dealershipSales ?? 0));
      const shopList = (sinksByTag["parts"] ?? 0) / Math.max(0.01, cfg.businesses.kinds.shop.partsShare);
      const npcShop = (sinksByTag["maintenance"] ?? 0) + (sinksByTag["repairs"] ?? 0) + (sinksByTag["rebuild"] ?? 0) + (sinksByTag["road_service"] ?? 0);
      const poolPremiums = w.pools.insurance.premiumsFd;
      const npcPremiums = sinksByTag["insurance"] ?? 0;
      return {
        newTrucks: orders > 0 ? dealerships / orders : 0,
        shopWork: shopList + npcShop > 0 ? shopList / (shopList + npcShop) : 0,
        insurance: poolPremiums + npcPremiums > 0 ? poolPremiums / (poolPremiums + npcPremiums) : 0,
        freight: posted ? sum(days.map((d) => d.facilityPosted)) / posted : 0,
      };
    })(),
    facilities: {
      owned,
      ownersBySegment,
      loadShare: posted ? sum(days.map((d) => d.facilityPosted)) / posted : 0,
      weeklyNetByType: Object.fromEntries(Object.entries(netByType).map(([t, a]) => [t, a.weeks > 0 ? a.net / a.weeks : 0])),
    },
    businesses: (() => {
      const out: Record<string, { open: number; everOpened: number; netFdPerYear: number; tradeFdPerYear: number; purchaseFd: number }> = {};
      const acc: Record<string, { net: number; trade: number; purchase: number; years: number }> = {};
      const lastDay = days.at(-1)?.day ?? 0;
      for (const b of w.businesses) {
        const o = (out[b.kind] ??= { open: 0, everOpened: 0, netFdPerYear: 0, tradeFdPerYear: 0, purchaseFd: 0 });
        const a = (acc[b.kind] ??= { net: 0, trade: 0, purchase: 0, years: 0 });
        o.everOpened++;
        if (b.ownerId === 0) continue;
        o.open++;
        a.net += b.netFd;
        a.trade += b.netFd + b.purchaseFd;
        a.purchase += b.purchaseFd;
        a.years += Math.max(1 / 52, (lastDay - b.boughtDay) / cfg.time.daysPerSeason);
      }
      for (const [k, a] of Object.entries(acc)) {
        out[k]!.netFdPerYear = a.years > 0 ? a.net / a.years : 0;
        out[k]!.tradeFdPerYear = a.years > 0 ? a.trade / a.years : 0;
        out[k]!.purchaseFd = out[k]!.open > 0 ? a.purchase / out[k]!.open : 0;
      }
      return out;
    })(),
    carriersBySegment,
    inflation: { years },
    wealth: { gini: gini(wealthAll), top1Share: topShare(0.01), top10Share: topShare(0.1), milesGini: gini(lifetimeMiles), avgBySegment },
    failures: {
      repossessions: sum(days.map((d) => d.repossessions)),
      companiesRepossessed: repossessed.length,
      wipedOut,
      inDebtAtEnd: debts.length,
      debtFd: sum(debts),
      debtRetiredFd: retiredDebtFd,
      writtenOffFd: w.finance.writtenOffFd,
      bankruptcies: sum(days.map((d) => d.bankruptcies)),
      companiesBankrupt: w.companies.filter((c) => c.bankruptcies > 0).length,
      bankruptBySegment: w.companies
        .filter((c) => c.bankruptcies > 0)
        .reduce<Record<string, number>>((acc, c) => {
          const seg = c.strategy.split(":")[0]!;
          acc[seg] = (acc[seg] ?? 0) + 1;
          return acc;
        }, {}),
      debtWrittenOffFd: faucetsByTag.bankruptcy_writeoff ?? 0,
      shipperDefaults: sum(days.map((d) => d.shipperDefaults)),
    },
    finance: {
      loansMade: w.finance.loansMade,
      interestPaidFd: w.finance.interestPaidFd,
      peakOutstandingFd: w.finance.peakOutstandingFd,
      outstandingEndFd: w.finance.outstandingFd,
      depositors: [...w.finance.shares.values()].filter((s) => s > 1e-9).length,
    },
    usedMarket: { sales: sum(days.map((d) => d.usedSales)), repoReturnedToDealer: sum(days.map((d) => d.repoReturned)), npcLotSold: w.usedLot.sold },
    cycleQuarters,
    faucetsByTag,
    sinksByTag,
    burnsByTag,
    mintsByTag,
    realMoney: realMoneyReport(w, quarterLen),
    pass: quartersPass && supply.pass && strategyPass && freePass,
  };
}

const segmentOf = (c: { strategy: string }) => c.strategy.split(":")[0]!;

function realMoneyReport(w: World, quarterLen: number): RealMoneyReport {
  const days = w.metrics.days.length;
  const usdOutBySegment: Record<string, number> = {};
  const usdInBySegment: Record<string, number> = {};
  const weeksBySegment: Record<string, number> = {};
  for (const c of w.companies) {
    const seg = segmentOf(c);
    usdOutBySegment[seg] = (usdOutBySegment[seg] ?? 0) + c.usd.out;
    usdInBySegment[seg] = (usdInBySegment[seg] ?? 0) + c.usd.in;
    weeksBySegment[seg] = (weeksBySegment[seg] ?? 0) + Math.max(0, days - c.createdDay) / 7;
  }
  const usdOutPerCompanyWeek = Object.fromEntries(Object.entries(usdOutBySegment).map(([k, v]) => [k, weeksBySegment[k]! > 0 ? v / weeksBySegment[k]! : 0]));
  const bw = w.buyback.weeks;
  let buyback: RealMoneyReport["buyback"] = null;
  if (bw.length > 0) {
    const byQuarter: NonNullable<RealMoneyReport["buyback"]>["byQuarter"] = [];
    for (let q = 0; (q + 1) * quarterLen <= days; q++) {
      const slice = bw.filter((b) => b.day >= q * quarterLen && b.day < (q + 1) * quarterLen);
      const bought = sum(slice.map((b) => b.boughtFd));
      byQuarter.push({
        label: `Y${Math.floor(q / 4) + 1}Q${(q % 4) + 1}`,
        priceUsd: bought > 0 ? sum(slice.map((b) => b.spentUsd)) / bought : null,
        boughtFd: bought,
        offeredFd: sum(slice.map((b) => b.offeredFd)),
      });
    }
    const boughtFd = sum(bw.map((b) => b.boughtFd));
    const spentUsd = sum(bw.map((b) => b.spentUsd));
    buyback = { weeks: bw.length, boughtFd, spentUsd, avgPriceUsd: boughtFd > 0 ? spentUsd / boughtFd : null, byQuarter };
  }
  return { buyback, usdOutBySegment, usdInBySegment, usdOutPerCompanyWeek, token: tokenReport(w, quarterLen) };
}

function tokenReport(w: World, quarterLen: number): TokenReport | null {
  const tk = w.token;
  if (tk.launchDay === null || tk.launch === null) return null;
  const days = w.metrics.days;
  // The launch day's own row already carries a price (metrics close the day the launch ran).
  const live = days.filter((d) => d.day >= tk.launchDay! - 1 && d.priceUsd > 0);
  const prices = live.length ? live.map((d) => d.priceUsd) : [tk.launchPriceUsd];
  const byQuarter: TokenReport["price"]["byQuarter"] = [];
  for (let q = 0; (q + 1) * quarterLen <= days.length; q++) {
    const slice = live.filter((d) => d.day >= q * quarterLen && d.day < (q + 1) * quarterLen);
    if (slice.length) byQuarter.push({ label: `Y${Math.floor(q / 4) + 1}Q${(q % 4) + 1}`, priceUsd: sum(slice.map((d) => d.priceUsd)) / slice.length });
  }
  const usdBySegment: TokenReport["usdBySegment"] = {};
  for (const c of w.companies) {
    const seg = segmentOf(c);
    const e = (usdBySegment[seg] ??= { in: 0, out: 0, net: 0, companies: 0 });
    e.in += c.usd.in;
    e.out += c.usd.out;
    e.net += c.usd.out - c.usd.in;
    e.companies++;
  }
  const perYear = w.cfg.time.daysPerSeason;
  const byYearEnd: number[] = [];
  for (let d = perYear - 1; d < days.length; d += perYear) byYearEnd.push(days[d]!.supplyFd);
  const end = days.at(-1)!;
  const t = tk.treasury;
  return {
    launchDay: tk.launchDay,
    launch: tk.launch,
    price: {
      launchUsd: tk.launchPriceUsd,
      minUsd: Math.min(...prices),
      maxUsd: Math.max(...prices),
      endUsd: end.priceUsd,
      byQuarter,
      // The worst fall from a running peak (the degen batches' first measure).
      maxDrawdown: (() => {
        let peak = 0;
        let dd = 0;
        for (const p of prices) {
          peak = Math.max(peak, p);
          if (peak > 0) dd = Math.max(dd, (peak - p) / peak);
        }
        return dd;
      })(),
    },
    supply: {
      beforeLaunchFd: tk.launch.supplyBeforeFd,
      afterLaunchFd: live[0]?.supplyFd ?? end.supplyFd,
      endFd: end.supplyFd,
      companiesEndFd: sum(w.companies.map((c) => w.ledger.balance(companyAccount(c.id)))),
      poolEndFd: end.exchangeFd,
      byYearEnd,
    },
    sinceLaunch: {
      operatingFaucetFd: sum(live.map((d) => d.faucetFd)),
      operatingSinkFd: sum(live.map((d) => d.sinkFd)),
      mintedByTag: sumTags(live.map((d) => d.mintByTag ?? {})),
      burnedByTag: sumTags(live.map((d) => d.burnByTag ?? {})),
    },
    treasury: { seedUsd: t.seedUsd, productUsd: t.productUsd, feeUsd: t.feeUsd, buybackUsd: t.buybackUsd, buybackFd: t.buybackFd, opsUsd: t.opsUsd, devUsd: t.devUsd, vestedFd: t.vestedFd },
    pool: { endUsd: tk.poolUsd, endFd: end.exchangeFd, peakUsd: Math.max(tk.poolUsd, ...live.map((d) => d.poolUsd ?? 0)) },
    valuation: (() => {
      const first = live[0] ?? end;
      const circ0 = first.circulatingFd ?? 0;
      const total0 = first.totalSupplyFd ?? 0;
      return {
        launch: { marketCapUsd: tk.launchPriceUsd * circ0, fdvUsd: tk.launchPriceUsd * total0, circulatingFd: circ0, totalSupplyFd: total0 },
        end: { marketCapUsd: end.marketCapUsd ?? 0, fdvUsd: end.fdvUsd ?? 0, circulatingFd: end.circulatingFd ?? 0, totalSupplyFd: end.totalSupplyFd ?? 0 },
        peakMarketCapUsd: Math.max(0, ...live.map((d) => d.marketCapUsd ?? 0)),
        peakFdvUsd: Math.max(0, ...live.map((d) => d.fdvUsd ?? 0)),
      };
    })(),
    airdrop: {
      allocatedFd: tk.launch.airdropAllocatedFd,
      mintedFd: tk.airdrop.mintedFd,
      forfeitedFd: tk.airdrop.forfeitedFd,
      haircutFd: tk.airdrop.haircutFd,
      recipients: w.companies.filter((c) => c.airdrop !== null).length,
      claimedEarly: w.companies.filter((c) => c.airdrop?.claimedEarly).length,
    },
    newCompanies: tk.newCompanies,
    usdBySegment,
    demand: (() => {
      const months = Math.max(1, (end.day - tk.launchDay! + 1) / w.cfg.time.daysPerMonth);
      const active = w.companies.filter((c) => c.liquidatingSince === null).length;
      const netSoldFdPerMonth = (tk.exchange.soldFd - tk.exchange.boughtFd) / months;
      return { monthsSinceLaunch: months, activeCompanies: active, netSoldFdPerMonth, usdPerThousandCompaniesMonth: active > 0 ? (Math.max(0, netSoldFdPerMonth) * end.priceUsd) / (active / 1000) : 0 };
    })(),
    gates: { holdsLaunchPrice: end.priceUsd >= tk.launchPriceUsd, poolDollarsGrew: tk.poolUsd >= t.seedUsd },
    ceiling: (() => {
      const st = tk.ceiling;
      if (st.baseFd === null) return undefined;
      const under = live.filter((d) => (d.ceilingFd ?? 0) > 0);
      return {
        growth: w.cfg.token.supplyCeiling.growth,
        overDays: w.cfg.token.supplyCeiling.overDays,
        baseFd: st.baseFd,
        endFd: end.outstandingFd ?? 0,
        endCeilingFd: end.ceilingFd ?? 0,
        maxOverShare: Math.max(0, ...under.map((d) => d.outstandingFd / d.ceilingFd - 1)),
        daysOver: under.filter((d) => d.outstandingFd > d.ceilingFd).length,
        weeksHolding: st.weeksHolding,
        weeksAtFloor: st.weeksAtFloor,
        vestHeldWeeks: st.vestHeldWeeks,
        queuedPeakFd: Math.max(0, ...live.map((d) => d.queuedAirdropFd ?? 0)),
        queuedEndFd: end.queuedAirdropFd ?? 0,
        releasedFd: st.releasedFd,
        rateMultMin: Math.min(...under.map((d) => d.rateMult), end.rateMult ?? 1),
        rateMultEnd: end.rateMult ?? 1,
      };
    })(),
    band: (() => {
      const b = w.cfg.token.exchange.priceBand;
      if (!b.enabled) return undefined;
      const inBand = live.filter((d) => d.day < tk.launchDay! + b.days);
      const moves = inBand.slice(1).map((d, i) => Math.abs(d.priceUsd / inBand[i]!.priceUsd - 1));
      return { pct: b.pct, clips: tk.bandClips, maxDayMove: Math.max(0, ...moves) };
    })(),
    ladder: w.cfg.unlockLadder.enabled ? Object.fromEntries(Object.entries(w.ladder).map(([k, d]) => [k, d === null ? null : d - tk.launchDay!])) : undefined,
    auction: tk.auction ? { ...tk.auction, trancheFd: w.cfg.token.launch.auction.trancheFd, capUsd: w.cfg.token.launch.auction.capUsd } : undefined,
    bridge: w.cfg.token.bridge.enabled ? { delayStart: w.cfg.token.bridge.delayDays.start, delayEnd: w.cfg.token.bridge.delayDays.end, requestedFd: tk.bridge.requestedFd, clearedFd: tk.bridge.clearedFd, meanWaitDays: tk.bridge.cleared > 0 ? tk.bridge.waitDays / tk.bridge.cleared : 0, cappedDays: tk.bridge.cappedDays, cappedFd: tk.bridge.cappedFd, queuedEndFd: w.companies.reduce((s, c) => s + c.withdrawals.reduce((x, r) => x + r.fd, 0), 0) } : undefined,
    lockedEndSupplyFd: w.ledger.lockedSupply(),
    launchFee: w.cfg.token.exchange.launchFee.enabled || w.cfg.token.exchange.sizeFee.enabled ? { startPct: w.cfg.token.exchange.launchFee.enabled ? w.cfg.token.exchange.launchFee.startPct : 0, days: w.cfg.token.exchange.launchFee.enabled ? w.cfg.token.exchange.launchFee.days : 0, ...tk.launchFee } : undefined,
    logbook: (() => {
      const st = tk.airdrop.logbook;
      if (!w.cfg.token.airdrop.logbook.enabled || !st) return undefined;
      const books = w.companies.filter((c) => c.airdrop?.logbook);
      const shares = books.map((c) => c.airdrop!.unlockedFd / Math.max(1e-9, c.airdrop!.totalFd)).sort((a, b) => a - b);
      const lockedEndFd = books.reduce((s, c) => s + (c.airdrop!.logbook!.closed ? 0 : Math.max(0, c.airdrop!.totalFd - c.airdrop!.unlockedFd - c.airdrop!.forfeitedFd)), 0);
      return { ...st, reached: { ...st.reached }, lockedEndFd, books: books.length, medianUnlockedShare: shares.length ? shares[Math.floor(shares.length / 2)]! : 0 };
    })(),
  };
}

function supplyReport(days: DayMetrics[], perSeason: number, warmup: number, limit: number): SupplyReport {
  const startFd = sum(days.filter((d) => d.season === 0).map((d) => d.grantFd));
  const endFd = days.at(-1)?.supplyFd ?? startFd;
  const inSeason = (d: DayMetrics) => d.day % perSeason;
  // The close day's supply is post-burn; growth checks look at the season before it.
  const isCloseDay = (d: DayMetrics) => inSeason(d) === perSeason - 1;

  let fromGrants = 0;
  for (const d of days) if (d.season === 0 && startFd > 0) fromGrants = Math.max(fromGrants, d.supplyFd / startFd);

  let afterWarmup = 0;
  for (const d of days) {
    if (inSeason(d) <= warmup - 1 || isCloseDay(d)) continue;
    const base = days[d.season * perSeason + warmup - 1];
    if (base && base.supplyFd > 0) afterWarmup = Math.max(afterWarmup, d.supplyFd / base.supplyFd);
  }

  // Year over year from the third year on: year 2 against year 1 only measures the cold start.
  let yearOverYear: number | null = null;
  for (const d of days) {
    if (d.day < 2 * perSeason || inSeason(d) < warmup || isCloseDay(d)) continue;
    const prev = days[d.day - perSeason];
    if (prev && prev.supplyFd > 0) yearOverYear = Math.max(yearOverYear ?? 0, d.supplyFd / prev.supplyFd);
  }

  const pass = afterWarmup < limit && (yearOverYear === null || yearOverYear < limit);
  return { startFd, endFd, fromGrants, afterWarmup, yearOverYear, pass };
}

function sumTags(rows: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) for (const [tag, v] of Object.entries(row)) out[tag] = (out[tag] ?? 0) + v;
  return out;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Gini coefficient of non-negative holdings (negative balances count as zero). */
function gini(values: number[]): number {
  const xs = values.map((x) => Math.max(0, x)).sort((a, b) => a - b);
  const n = xs.length;
  const total = sum(xs);
  if (n === 0 || total === 0) return 0;
  let weighted = 0;
  xs.forEach((x, i) => (weighted += (i + 1) * x));
  return (2 * weighted) / (n * total) - (n + 1) / n;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
