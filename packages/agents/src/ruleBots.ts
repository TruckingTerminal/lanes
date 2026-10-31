import type { Equipment, FacilityType, TractorTier } from "@lanes/config";
import { dcos, dexp, dlog, dpow } from "@lanes/data";
import {
  addTruck,
  applyAction,
  availableSupply,
  companyAccount,
  condition,
  dayOf,
  daysUntilLock,
  facilitiesOf,
  facilityOutlook,
  formCompany,
  inCloseWindow,
  lastBuybackPrice,
  averagePriceUsd,
  fdPriceUsd,
  EXCHANGE_ACCOUNT,
  quoteUsdForFd,
  sellableFd,
  sellRoomFd,
  tokenLive,
  brokerLicensed,
  capitalRatio,
  contractAccount,
  factoringStake,
  itemPriceFd,
  itemPriceUsd,
  yardTrucks,
  nextTruckTier,
  stakeFd,
  truckCap,
  activeLoanOn,
  askingPay,
  autoStaff,
  borrowingCapacity,
  crewed,
  dealerPrice,
  truckValue,
  lerpLoyalty,
  staffById,
  depositorValue,
  deliveryDays,
  holdingCostApplies,
  marginalOverhead,
  openListings,
  operatingTrucks,
  ordersOf,
  overheadForTruck,
  poolCash,
  rebuildCost,
  rebuildable,
  hookedTrailer,
  yardTrailers,
  ownedTrailers,
  trailerOrdersOf,
  trailerPrice,
  trailerValue,
  trailerCondition,
  trailerRefurbishable,
  trailerCap,
  planIndex,
  EQUIPMENT,
  bestSource,
  dealershipsOpen,
  hasStock,
  tradeInOffer,
  npcBackstop,
  leasedOut,
  openLeaseOffers,
  openAssetSales,
  type Company,
  type CompliancePolicy,
  type Listing,
  type DailyAgentHook,
  type Rng,
  type StandingOrder,
  type World,
} from "@lanes/engine";
import { businessesOf, businessPriceFd, sitePriceFd, type BusinessKind } from "@lanes/engine";

/**
 * Tier A rule bots (§AI-agent simulation): scripted greedy, conservative and
 * random strategies. They bid only through standing orders and change the world
 * only through applyAction, exactly like a human player.
 */
export type Strategy = "greedy" | "conservative" | "random";
const STRATEGIES: Strategy[] = ["greedy", "conservative", "random"];
const FACILITY_TYPES: FacilityType[] = ["warehouse", "coldStorage", "factory"];

export interface PopulationOptions {
  /** Free owner-operators on the NPC lease path. */
  freeOwnerOperators: number;
  /** Small fleets seeded with owned PoC equipment. */
  fleets: number;
  brokers: number;
}

/** How a carrier bot prices bids; `value` moves with its win rate. */
interface Pricing {
  mode: "ceilingPct" | "breakEvenPlus";
  value: number;
  step: number;
  min: number;
  max: number;
}

interface BotProfile {
  pricing: Pricing | null;
  /** Standing orders other than the bid order, which is rebuilt from `pricing`. */
  maxDeadheadMi: number;
  otherOrders: StandingOrder[];
  lastStats: { truckRounds: number; wins: number };
  /** Weekly snapshots of the company's cumulative operating result, for a trailing profit estimate. */
  opSnapshots: { day: number; net: number }[];
  targetFleet: number;
  /** FD kept after buying the first owned truck. */
  firstTruckBuffer: number;
  /** Working capital kept before growing the fleet or buying facilities. */
  reserveBase: number;
  reservePerTruck: number;
  /** Rebuild owned trucks at or below this condition. */
  rebuildAt: number;
  /** Longest facility payback, in in-game weeks, the bot will accept. */
  maxPaybackWeeks: number;
  /** Borrows from Equipment Finance against its trucks to grow. */
  leverage: boolean;
  /** Parks spare cash in Equipment Finance, and pays loans off early. */
  depositor: boolean;
  /** Sells a worn truck past this odometer instead of rebuilding it. */
  replaceAtMi: number;
  /** Won't order new trucks into a dealer backlog longer than this (days). */
  maxLeadDays: number;
  /**
   * Cashing out (real-money modes): each week sell this share of the FD above
   * reserve × keepMult; `askMult` is the bot's minimum price as a multiple of the
   * last clearing price, raised after a full fill and cut after a miss.
   */
  cashOut: { share: number; keepMult: number; askMult: number };
  /** Token mode: puts outside dollars in to grow, to start on an owned truck, or to stay out of liquidation. */
  payToWin: boolean;
  /** Token mode: trades the price — buys well under its 8-week average, sells what it bought well over it. */
  trader: boolean;
  traderFd: number;
  /** Token mode: takes the airdrop's rest at launch, haircut and all. */
  claimsEarly: boolean;
  /**
   * Adversaries (config adversaries): a farmer hauls to keep its airdrop, sells everything it can every
   * week whatever the price, and quits on `quitDay`; a sybil is a farmer wallet of a cluster that sells
   * at its daily limit every day.
   */
  farmer: boolean;
  sybil: boolean;
  quitDay: number;
  quit: boolean;
  /**
   * How legal it runs (safety.ts): clean; a corner-cutter that fakes logs for hot
   * loads and skips maintenance when cash is short; or an outlaw that runs illegal
   * hours on everything, double brokers, and steals when it's going under. Cutters
   * and outlaws straighten up once a review rates them badly.
   */
  conduct: "clean" | "cutter" | "outlaw";
  /** Gives unhappy staff a raise to market (greedy bots don't, and lose them). */
  paysMarket: boolean;
  /** An outlaw's double-brokering order, on the board only while it's cheating (setConduct). */
  rebroker: StandingOrder | null;
  cheating: boolean;
  /** Trucks put up for sale: not unparked again before this day if they come back unsold. */
  noUnpark: Map<number, number>;
}

const profiles = new WeakMap<Company, BotProfile>();

/** A bot's persona, for reports (undefined for humans). */
export const botConduct = (c: Company) => profiles.get(c)?.conduct;

/** Win-rate band for adaptive pricing: below it the bot cuts its price, above it the bot raises it. */
const WIN_RATE_BAND = [0.35, 0.6] as const;
/**
 * What a leased truck gives up against an owned one each week: the lessor's 15%
 * of gross, less the maintenance and wear the lessor carries. Bots lease only when
 * their trucks clear this plus the overhead the next truck adds.
 */
const LEASE_HURDLE_FD = 400;
/** Bots' rough facility model: carriers clear near the reference rate on a typical ~650-mile lane. */
const ASSUMED_CLEARED_OF_REF = 1.0;
const TYPICAL_LANE_MI = 650;

/** The persona mix (design proposal): most carriers run legal; a minority cut corners; a few are crooks. */
const CONDUCT_MIX = { clean: 0.72, cutter: 0.2, outlaw: 0.08 };
function conductOf(rng: Rng): BotProfile["conduct"] {
  const r = rng.next();
  return r < CONDUCT_MIX.clean ? "clean" : r < CONDUCT_MIX.clean + CONDUCT_MIX.cutter ? "cutter" : "outlaw";
}

function carrierProfile(strategy: Strategy, rng: Rng): BotProfile {
  const p = carrierProfileFor(strategy, rng);
  // Outlaws double broker some of what they win; most still pay the hauler. The order goes on only while they're cheating.
  if (p.conduct === "outlaw") p.rebroker = { kind: "rebroker", share: 0.1, keepPct: 0.15, pays: rng.next() < 0.8 };
  // Book-now between rounds: the greedy hold out for a margin, the careful take a sure thing.
  const margin = strategy === "greedy" ? 0.3 : strategy === "conservative" ? 0.12 : rng.range(0.1, 0.4);
  p.otherOrders.push({ kind: "bookNow", breakEvenPlusPct: margin, maxDeadheadMi: p.maxDeadheadMi });
  // Contracts: the careful honour every tender; the greedy chase spot when it runs 15% over the contract; the rest are in between.
  p.otherOrders.push({ kind: "contracts", acceptOffers: true, spotAbovePct: strategy === "conservative" ? null : strategy === "greedy" ? 0.15 : rng.range(0.1, 0.4), maxDeadheadMi: p.maxDeadheadMi });
  // Home time: clean carriers bring drivers home every four weeks (a week of mild fatigue), corner-cutters run them six; outlaws don't bother.
  if (p.conduct === "clean") p.otherOrders.push({ kind: "homeTime", afterDays: 28, restDays: 5 });
  else if (p.conduct === "cutter") p.otherOrders.push({ kind: "homeTime", afterDays: 42, restDays: 3 });
  return p;
}

function carrierProfileFor(strategy: Strategy, rng: Rng): BotProfile {
  const base = { lastStats: { truckRounds: 0, wins: 0 }, opSnapshots: [], conduct: conductOf(rng), paysMarket: strategy !== "greedy", rebroker: null, cheating: false, noUnpark: new Map<number, number>(), farmer: false, sybil: false, quitDay: Infinity, quit: false };
  switch (strategy) {
    case "greedy":
      return {
        ...base,
        pricing: { mode: "breakEvenPlus", value: 0.3, step: 0.03, min: 0.06, max: 0.9 },
        maxDeadheadMi: 150,
        otherOrders: [
          { kind: "floor", breakEvenPlusPct: 0.05 },
          { kind: "reposition", afterIdleRounds: 1, to: { openLoadsWithinMi: 400 } },
          { kind: "reposition", afterIdleRounds: 3, to: { openLoadsWithinMi: 1000 } },
        ],
        targetFleet: 30,
        firstTruckBuffer: 1_000,
        reserveBase: 10_000,
        reservePerTruck: 4_000,
        rebuildAt: 0.35,
        maxPaybackWeeks: 40,
        leverage: true,
        depositor: false,
        replaceAtMi: 800_000,
        maxLeadDays: Infinity,
        cashOut: { share: 1, keepMult: 1, askMult: 1 },
        payToWin: true,
        trader: false,
        traderFd: 0,
        claimsEarly: true,
      };
    case "conservative":
      return {
        ...base,
        pricing: { mode: "ceilingPct", value: 0.97, step: 0.01, min: 0.88, max: 1.0 },
        maxDeadheadMi: 120,
        otherOrders: [
          { kind: "floor", breakEvenPlusPct: 0.15 },
          { kind: "reposition", afterIdleRounds: 2, to: { openLoadsWithinMi: 250 } },
          { kind: "reposition", afterIdleRounds: 4, to: { openLoadsWithinMi: 800 } },
        ],
        targetFleet: 8,
        firstTruckBuffer: 4_000,
        reserveBase: 30_000,
        reservePerTruck: 8_000,
        rebuildAt: 0.6,
        maxPaybackWeeks: 26,
        leverage: false,
        depositor: true,
        replaceAtMi: 500_000,
        maxLeadDays: 60,
        cashOut: { share: 0.3, keepMult: 1.5, askMult: 1.2 },
        payToWin: false,
        trader: false,
        traderFd: 0,
        claimsEarly: false,
      };
    case "random": {
      const min = rng.range(0.04, 0.12);
      return {
        ...base,
        pricing: { mode: "breakEvenPlus", value: rng.range(0.15, 0.45), step: rng.range(0.01, 0.05), min, max: 0.9 },
        maxDeadheadMi: rng.int(50, 150),
        otherOrders: [
          { kind: "floor", breakEvenPlusPct: Math.max(0, min - 0.02) },
          { kind: "reposition", afterIdleRounds: rng.int(1, 2), to: rng.next() < 0.3 ? "nearestStarterHub" : { openLoadsWithinMi: rng.int(150, 500) } },
          { kind: "reposition", afterIdleRounds: rng.int(2, 4), to: { openLoadsWithinMi: rng.int(600, 1200) } },
        ],
        targetFleet: rng.int(2, 20),
        firstTruckBuffer: rng.int(1_000, 5_000),
        reserveBase: rng.int(10_000, 30_000),
        reservePerTruck: rng.int(4_000, 8_000),
        rebuildAt: rng.range(0.35, 0.65),
        maxPaybackWeeks: rng.int(26, 52),
        leverage: rng.next() < 0.5,
        depositor: rng.next() < 0.5,
        replaceAtMi: rng.int(500_000, 800_000),
        maxLeadDays: rng.next() < 0.5 ? 75 : Infinity,
        cashOut: { share: rng.range(0.2, 1), keepMult: rng.range(1, 1.5), askMult: rng.range(0.8, 1.2) },
        payToWin: rng.next() < 0.5,
        trader: rng.next() < 0.3,
        traderFd: 0,
        claimsEarly: rng.next() < 0.3,
      };
    }
  }
}

function brokerProfile(strategy: Strategy, rng: Rng): BotProfile {
  return {
    conduct: "clean",
    paysMarket: true,
    rebroker: null,
    cheating: false,
    noUnpark: new Map<number, number>(),
    pricing: null,
    maxDeadheadMi: 0,
    otherOrders: [],
    lastStats: { truckRounds: 0, wins: 0 },
    opSnapshots: [],
    targetFleet: 0,
    firstTruckBuffer: 0,
    reserveBase: strategy === "greedy" ? 20_000 : strategy === "conservative" ? 50_000 : rng.int(20_000, 50_000),
    reservePerTruck: 0,
    rebuildAt: 0,
    maxPaybackWeeks: strategy === "greedy" ? 40 : strategy === "conservative" ? 26 : rng.int(26, 52),
    leverage: false,
    depositor: true,
    replaceAtMi: Infinity,
    maxLeadDays: Infinity,
    cashOut:
      strategy === "greedy"
        ? { share: 1, keepMult: 1, askMult: 1 }
        : strategy === "conservative"
          ? { share: 0.3, keepMult: 1.5, askMult: 1.2 }
          : { share: rng.range(0.2, 1), keepMult: rng.range(1, 1.5), askMult: rng.range(0.8, 1.2) },
    payToWin: strategy !== "conservative",
    trader: strategy === "random" && rng.next() < 0.3,
    traderFd: 0,
    claimsEarly: strategy === "greedy",
    farmer: false,
    sybil: false,
    quitDay: Infinity,
    quit: false,
  };
}

/** Makes a carrier profile a farmer's (config adversaries): no growth, corners cut, everything sold. */
function makeFarmer(p: BotProfile, sybil: boolean): BotProfile {
  p.farmer = true;
  p.sybil = sybil;
  p.conduct = "cutter";
  p.targetFleet = 1;
  p.leverage = false;
  p.depositor = false;
  p.payToWin = false;
  p.trader = false;
  p.claimsEarly = true;
  p.rebuildAt = 0.2;
  p.cashOut = { share: 1, keepMult: 0.25, askMult: 1 };
  return p;
}

function bidOrder(p: BotProfile): StandingOrder {
  const pricing = p.pricing!;
  return { kind: "bid", maxDeadheadMi: p.maxDeadheadMi, price: { mode: pricing.mode, pct: pricing.value } };
}

const carrierOrders = (p: BotProfile): StandingOrder[] => [bidOrder(p), ...p.otherOrders, ...(p.cheating && p.rebroker ? [p.rebroker] : [])];

function brokerOrders(strategy: Strategy, rng: Rng): StandingOrder[] {
  const marginPct = strategy === "greedy" ? 0.12 : strategy === "conservative" ? 0.07 : rng.range(0.06, 0.12);
  return [{ kind: "broker", marginPct, maxOpenLoads: 40 }];
}

/** New companies start at the 10 starter hubs, weighted by hub size. */
function starterHub(w: World, rng: Rng): string {
  const starters = w.net.starterIdx;
  return w.net.hubs[starters[rng.weighted(starters.map((i) => w.net.hubs[i]!.weight))]!]!.id;
}

const TRAILERS: Equipment[] = ["van", "reefer", "flatbed"];

/**
 * Picks a tractor + trailer this buyer can actually get, or null if supply is
 * gone. With `followMarket`, the trailer is drawn toward equipment whose freight
 * most often goes uncovered (the board's public fill rate), so new capital goes
 * where it's short instead of crowding the van market.
 */
function pickEquipment(w: World, rng: Rng, firstTruck: boolean, followMarket = false): { tier: TractorTier; trailer: Equipment } | null {
  const tiers: TractorTier[] = rng.next() < 0.8 ? ["workhorse", "highwayPro"] : ["highwayPro", "workhorse"];
  let trailers: Equipment[];
  if (followMarket) {
    const first = TRAILERS[rng.weighted(TRAILERS.map((e) => dpow(1 - w.fillRate[e], 2) + 0.01))]!;
    trailers = [first, ...TRAILERS.filter((e) => e !== first)];
  } else {
    trailers = [rng.next() < 0.6 ? "van" : rng.next() < 0.6 ? "reefer" : "flatbed", ...TRAILERS];
  }
  for (const trailer of trailers) {
    for (const tier of tiers) if (availableSupply(w, tier, trailer, firstTruck) > 0 || (w.cfg.assets.enabled && dealershipsOpen(w).some((b) => hasStock(b, "rig", tier, trailer)))) return { tier, trailer };
  }
  return null;
}

/**
 * Outside dollars a player is willing to put in (token mode only). PoC assumption:
 * most free owner-operators bring nothing; the rest, and fleets and brokers,
 * bring a lognormal amount around a median.
 */
function lognormal(rng: Rng, median: number, sigma = 1): number {
  const z = Math.sqrt(-2 * dlog(1 - rng.next())) * dcos(2 * Math.PI * rng.next());
  return median * dexp(sigma * z);
}

const WALLETS = {
  oo: (rng: Rng) => (rng.next() < 0.6 ? 0 : lognormal(rng, 100)),
  fleet: (rng: Rng) => lognormal(rng, 2_000),
  broker: (rng: Rng) => lognormal(rng, 1_000),
  newcomer: (rng: Rng) => (rng.next() < 0.5 ? 0 : lognormal(rng, 150)),
};

const ownerSkill = (w: World, rng: Rng) => rng.range(w.cfg.labor.owner.botSkill[0], w.cfg.labor.owner.botSkill[1]);

export function populate(w: World, o: PopulationOptions): void {
  const rng = w.rng.agents.fork("populate");
  let n = 0;
  const strategyOf = () => STRATEGIES[n++ % STRATEGIES.length]!;

  const adv = w.cfg.adversaries;
  for (let i = 0; i < o.freeOwnerOperators; i++) {
    const strategy = strategyOf();
    const profile = carrierProfile(strategy, rng);
    // A farmer (config adversaries): drawn only when the adversaries are on, so the base world is unchanged.
    const farmer = adv.enabled && adv.farmerShare > 0 && rng.next() < adv.farmerShare;
    if (farmer) makeFarmer(profile, false);
    const c = formCompany(w, {
      name: `OO-${i + 1}`,
      role: "carrier",
      homeHubId: starterHub(w, rng),
      strategy: farmer ? `farm:oo-${strategy}` : `oo:${strategy}`,
      orders: carrierOrders(profile),
      freePath: true,
      ownerSkill: ownerSkill(w, rng),
      authorityAgeDays: rng.int(0, 400),
    });
    profiles.set(c, profile);
    c.usd.wallet = WALLETS.oo(rng);
    setConduct(w, c, profile);
  }

  for (let i = 0; i < o.fleets; i++) {
    const strategy = strategyOf();
    const profile = carrierProfile(strategy, rng);
    const c = formCompany(w, {
      name: `Fleet-${i + 1}`,
      role: "carrier",
      homeHubId: starterHub(w, rng),
      strategy: `fleet:${strategy}`,
      orders: carrierOrders(profile),
      freePath: false,
      ownerSkill: ownerSkill(w, rng),
      authorityAgeDays: rng.int(365, 3000),
    });
    profiles.set(c, profile);
    c.usd.wallet = WALLETS.fleet(rng);
    setConduct(w, c, profile);
    // Initial PoC allocation: these companies already hold used equipment, 0–4 years old.
    const size = rng.int(2, 6);
    // Staking (0.18.0): an established fleet starts with the stake its size needs.
    if (w.cfg.token.staking.enabled) {
      const tier = w.cfg.token.staking.truckTiers.find(([trucks]) => trucks >= size);
      if (tier && tier[1] > 0) {
        w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), tier[1], `grant:stake:${c.id}`);
        stakeFd(w, c, tier[1]);
      }
    }
    // The catalogue (0.18.0): an established fleet larger than the no-yard allowance starts with a yard, its bond posted.
    if (w.cfg.token.catalogue.enabled && size > w.cfg.token.catalogue.trucksWithoutYard) {
      const bond = w.cfg.token.catalogue.items.yardSmall.bondFd;
      w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), bond, `grant:yard:${c.id}`);
      w.ledger.post(w.t, companyAccount(c.id), contractAccount(c.id), bond, `bond:yard:${c.id}`);
      c.yard = "small";
      c.yardBondFd = bond;
    }
    for (let k = 0; k < size; k++) {
      const pick = pickEquipment(w, rng, false);
      if (!pick) break;
      const years = rng.int(0, 4);
      const milesSinceRebuild = rng.int(0, 120_000);
      const odometer = Math.max(milesSinceRebuild, years * rng.int(80_000, 130_000));
      addTruck(w, c, "owned", pick.tier, pick.trailer, false, { milesSinceRebuild, odometer, builtDay: -years * 365 - rng.int(0, 364) });
    }
    // Drivers for the trucks the owner doesn't drive, and a dispatcher past the owner's three.
    autoStaff(w, c);
  }

  for (let i = 0; i < o.brokers; i++) {
    const strategy = strategyOf();
    const c = formCompany(w, {
      name: `Broker-${i + 1}`,
      role: "broker",
      homeHubId: starterHub(w, rng),
      strategy: `broker:${strategy}`,
      orders: brokerOrders(strategy, rng),
      freePath: false,
      authorityAgeDays: rng.int(365, 3000),
    });
    profiles.set(c, brokerProfile(strategy, rng));
    c.usd.wallet = WALLETS.broker(rng);
    // Staking (0.18.0): an established broker starts with its licence stake posted.
    if (w.cfg.token.staking.enabled) {
      const stake = w.cfg.token.staking.roles.broker;
      w.ledger.post(w.t, "faucet:starting_grant", companyAccount(c.id), stake, `grant:stake:${c.id}`);
      stakeFd(w, c, stake);
    }
    // How carefully it picks carriers (fraud.ts): open, standard or strict.
    c.vetting = rng.weighted(w.cfg.fraud.botBrokerVetting) as 0 | 1 | 2;
  }
  // Sybil clusters (config adversaries): one actor across many free-path wallets, every one a farmer.
  if (adv.enabled) {
    for (let k = 0; k < adv.sybil.clusters; k++) {
      const home = starterHub(w, rng);
      for (let j = 0; j < adv.sybil.wallets; j++) {
        const strategy = strategyOf();
        const profile = makeFarmer(carrierProfile(strategy, rng), true);
        const c = formCompany(w, { name: `Sybil-${k + 1}-${j + 1}`, role: "carrier", homeHubId: home, strategy: `sybil:c${k + 1}-${strategy}`, orders: carrierOrders(profile), freePath: true, ownerSkill: ownerSkill(w, rng), authorityAgeDays: rng.int(0, 400) });
        profiles.set(c, profile);
        c.usd.wallet = 0;
        setConduct(w, c, profile);
      }
    }
  }
  w.aiFleetStart = aiFleet(w);
}

/** Trucks run by AI companies (every company but the humans, whose strategy is "player:…"). */
function aiFleet(w: World): number {
  const bots = new Set(w.companies.filter((c) => !c.strategy.startsWith("player:")).map((c) => c.id));
  return w.trucks.filter((t) => t.companyId !== 0 && t.status !== "retired" && bots.has(t.companyId)).length;
}

/**
 * Token mode: new owner-operators join each week after launch — a base rate
 * that rises after the price has risen and falls after it has fallen.
 */
function admitNewcomers(w: World): void {
  const nc = w.cfg.token.newCompanies;
  const rng = w.rng.agents;
  const h = w.token.priceHistory;
  const then = h[h.length - 1 - nc.lookbackDays];
  const trend = then && then > 0 ? h.at(-1)! / then - 1 : 0;
  const hype = Math.min(nc.hypeRange[1], Math.max(nc.hypeRange[0], 1 + nc.hypeSensitivity * trend));
  const expected = nc.perWeek * hype;
  const n = Math.floor(expected) + (rng.next() < expected % 1 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const strategy = STRATEGIES[rng.int(0, STRATEGIES.length - 1)]!;
    const profile = carrierProfile(strategy, rng);
    const adv = w.cfg.adversaries;
    const farmer = adv.enabled && adv.farmerShare > 0 && rng.next() < adv.farmerShare;
    if (farmer) {
      makeFarmer(profile, false);
      profile.quitDay = dayOf(w.t, w.cfg) + rng.int(adv.farmerQuitDays[0], adv.farmerQuitDays[1]);
    }
    w.token.newCompanies++;
    const c = formCompany(w, {
      name: `New-${w.token.newCompanies}`,
      role: "carrier",
      homeHubId: starterHub(w, rng),
      strategy: farmer ? `farm:new-${strategy}` : `new:${strategy}`,
      orders: carrierOrders(profile),
      freePath: true,
      ownerSkill: ownerSkill(w, rng),
    });
    profiles.set(c, profile);
    c.usd.wallet = WALLETS.newcomer(rng) * w.cfg.token.newCompanies.usdWalletMult; // the demand lever
    setConduct(w, c, profile);
  }
}

/** The compliance policy this bot runs today, for its persona, cash and rating. */
function setConduct(w: World, c: Company, p: BotProfile): void {
  // A bad rating, or a revocation in the last year, keeps a cheater straight for a while.
  const today = dayOf(w.t, w.cfg);
  const recentlyRevoked = c.authority.lastRevokedDay !== null && today - c.authority.lastRevokedDay < w.cfg.time.daysPerSeason;
  const scared = c.safety.rating === "conditional" || c.safety.rating === "unsatisfactory" || recentlyRevoked;
  const cheating = !scared && p.conduct !== "clean";
  if (cheating !== p.cheating) {
    p.cheating = cheating;
    // The double-brokering order comes and goes with it.
    if (p.rebroker && c.liquidatingSince === null) applyAction(w, c.id, { type: "set_standing_orders", orders: carrierOrders(p) });
  }
  let policy: CompliancePolicy = { hos: "legal", speed: "legal", maintenance: "full" };
  if (!scared && p.conduct === "cutter") {
    const short = w.ledger.balance(companyAccount(c.id)) < reserve(w, c, p);
    policy = { hos: "hot", speed: "legal", maintenance: short ? "deferred" : "full" };
  } else if (!scared && p.conduct === "outlaw") policy = { hos: "always", speed: "hot", maintenance: "deferred" };
  const cur = c.policy;
  if (cur.hos !== policy.hos || cur.speed !== policy.speed || cur.maintenance !== policy.maintenance) applyAction(w, c.id, { type: "set_compliance", policy });
}

/**
 * Staff, beyond the seat-filling the engine does: raises for unhappy people whose
 * market pay has passed theirs (greedy bots skip it), defects fixed on full
 * maintenance, and a poach when a truck sits empty and the pool is dry.
 */
function manageStaff(w: World, c: Company, p: BotProfile, rng: Rng, today: number): void {
  if ((today + c.id) % 7 === 0 && p.paysMarket) {
    for (const s of w.staffByCompany.get(c.id)!) {
      if (s.owner || s.morale >= 0.45) continue;
      const ask = askingPay(w, s);
      if (ask > s.pay) applyAction(w, c.id, { type: "set_staff_pay", staffId: s.id, pay: ask });
    }
  }
  // An offer on one of ours: match it if we would pay that.
  for (const s of w.staffByCompany.get(c.id)!) {
    if (s.offer && s.offer.companyId !== 0 && p.paysMarket && s.offer.pay <= askingPay(w, s) * 1.15) applyAction(w, c.id, { type: "set_staff_pay", staffId: s.id, pay: s.offer.pay });
  }
  const fleet = w.trucksByCompany.get(c.id)!;
  if (c.policy.maintenance === "full") {
    for (const t of fleet) if (t.defects > 0 && (t.status === "idle" || t.status === "parked")) applyAction(w, c.id, { type: "fix_defects", truckId: t.id });
  }
  const empty = fleet.find((t) => !crewed(t) && t.status === "idle");
  if (!empty || rng.next() > 0.3) return;
  // Poach the least happy driver elsewhere, for just over what it would take.
  let best: { id: number; pay: number } | null = null;
  for (const s of w.staff) {
    if (s.kind !== "driver" || s.status !== "employed" || s.owner || s.companyId === c.id || s.offer) continue;
    const pay = Math.max(askingPay(w, s), s.pay * (1 + lerpLoyalty(w, s.morale))) + 0.005;
    if (!best || pay < best.pay) best = { id: s.id, pay };
  }
  if (best && best.pay <= askingPay(w, staffById(w, best.id)) * 1.25) applyAction(w, c.id, { type: "offer_staff", staffId: best.id, pay: best.pay, truckId: empty.id });
}

/** Outlaws going under steal a valuable load that isn't tracked (their rebroker standing order does the double brokering). */
function crookery(w: World, c: Company, rng: Rng): void {
  if (c.authority.status !== "active") return;
  const fleet = w.trucksByCompany.get(c.id)!;
  const desperate = c.weeksInDebt >= 1 || w.ledger.balance(companyAccount(c.id)) < 0;
  if (desperate && rng.next() < 0.15) {
    const t = fleet.find((x) => x.status === "loaded" && x.loadId !== null && (w.loads.get(x.loadId)?.vet ?? 2) < 2 && (w.loads.get(x.loadId)?.cargoValue ?? 0) >= 15_000);
    if (t) applyAction(w, c.id, { type: "steal_load", truckId: t.id });
  }
}

/**
 * Cuts the price when idle trucks keep losing, raises it when they keep winning.
 * In crowded hubs this pushes rates toward cost, so less FD is created per load.
 */
function adaptPricing(w: World, c: Company, p: BotProfile): void {
  const pricing = p.pricing;
  if (!pricing) return;
  const rounds = c.bidStats.truckRounds - p.lastStats.truckRounds;
  if (rounds < 2) return;
  const winRate = (c.bidStats.wins - p.lastStats.wins) / rounds;
  p.lastStats = { ...c.bidStats };
  const before = pricing.value;
  if (winRate < WIN_RATE_BAND[0]) pricing.value = Math.max(pricing.min, pricing.value - pricing.step);
  else if (winRate > WIN_RATE_BAND[1]) pricing.value = Math.min(pricing.max, pricing.value + pricing.step);
  if (pricing.value !== before) applyAction(w, c.id, { type: "set_standing_orders", orders: carrierOrders(p) });
}

/**
 * Weekly: a broker that lost money on its freight last week halves the loads it
 * will hold; one that made money takes on four more, up to its usual 40. Contract
 * rates lag spot, so in a sudden boom brokers pull back instead of brokering at a loss.
 */
function throttleBrokering(w: World, c: Company, p: BotProfile, today: number): void {
  if (today % 7 !== 0) return;
  recordOperating(c, p, today);
  const prev = p.opSnapshots.at(-2);
  const now = p.opSnapshots.at(-1);
  const order = c.orders.find((o) => o.kind === "broker");
  if (!prev || !now || !order || order.kind !== "broker") return;
  const max = now.net < prev.net ? Math.max(4, Math.floor(order.maxOpenLoads / 2)) : Math.min(40, order.maxOpenLoads + 4);
  if (max !== order.maxOpenLoads) applyAction(w, c.id, { type: "set_standing_orders", orders: [{ ...order, maxOpenLoads: max }] });
}

/** Keeps four weeks of weekly operating snapshots. */
function recordOperating(c: Company, p: BotProfile, today: number): void {
  if (today % 7 !== 0) return;
  p.opSnapshots.push({ day: today, net: c.operating.revenueFd - c.operating.costFd });
  if (p.opSnapshots.length > 5) p.opSnapshots.shift();
}

/** Trailing operating profit per truck per week, before fleet overhead; null until there's a few weeks of data. */
function profitPerTruckWeek(c: Company, p: BotProfile, today: number, trucks: number): number | null {
  const oldest = p.opSnapshots[0];
  if (!oldest || today - oldest.day < 14 || trucks === 0) return null;
  const weeks = (today - oldest.day) / 7;
  return (c.operating.revenueFd - c.operating.costFd - oldest.net) / weeks / trucks;
}

/**
 * Another truck is worth it only if a typical truck in this fleet earns well
 * clear of what the next truck would add in overhead. Fleets stop growing where
 * scale stops paying, and leave that freight to smaller carriers.
 */
function worthAnotherTruck(w: World, c: Company, p: BotProfile, today: number, trucks: number): boolean {
  const marginal = marginalOverhead(w.cfg, trucks);
  if (marginal <= 0) return true;
  const profit = profitPerTruckWeek(c, p, today, trucks);
  return profit === null || profit >= marginal * 1.25;
}

function leaseIfWorth(w: World, c: Company, p: BotProfile, rng: Rng, today: number, active: number): void {
  const profit = profitPerTruckWeek(c, p, today, active);
  if (profit === null || profit < marginalOverhead(w.cfg, active) * 1.25 + LEASE_HURDLE_FD) return;
  const trailer = TRAILERS[rng.weighted(TRAILERS.map((e) => dpow(1 - w.fillRate[e], 2) + 0.01))]!;
  if (w.fillRate[trailer] >= 0.9) return;
  applyAction(w, c.id, { type: "lease_truck", trailer });
}

/** Puts a truck up for sale at its used value, cutting 5% of value a week down to 60%; in a hurry, cheaper and faster. */
function sell(w: World, c: Company, p: BotProfile, truckId: number, hurry = false): void {
  const truck = w.trucks[truckId - 1]!;
  // Assets: a dealership takes it in trade today, at its share of value, if one can.
  if (w.cfg.assets.enabled && w.cfg.businesses.enabled) {
    const best = dealershipsOpen(w)
      .map((b) => ({ b, offer: tradeInOffer(w, b, truck) }))
      .filter((x) => x.offer > 0)
      .sort((a, b) => b.offer - a.offer || a.b.id - b.b.id)[0];
    if (best && applyAction(w, c.id, { type: "trade_in", truckId, dealershipId: best.b.id }).ok) return;
  }
  const value = truckValue(w, truck);
  const ask = hurry ? value * 0.85 : value;
  const r = applyAction(w, c.id, { type: "list_truck", truckId, askFd: ask, floorFd: value * 0.6, stepFd: value * (hurry ? 0.1 : 0.05) });
  // If it comes back unsold it stays parked a while, instead of being put straight back on the road and relisted.
  if (r.ok) p.noUnpark.set(truckId, dayOf(w.t, w.cfg) + 56);
}

/**
 * Weekly right-sizing: sell the most worn idle truck when a typical truck no
 * longer covers its overhead bracket (less the idle fee a parked truck pays), or
 * when the company is in debt. A truck that doesn't sell comes back parked.
 */
function rightSize(w: World, c: Company, p: BotProfile, today: number, active: number): void {
  const { cfg } = w;
  if (active <= 1) return;
  const slotOverhead = overheadForTruck(cfg, active);
  const profit = profitPerTruckWeek(c, p, today, active);
  const inDebt = w.ledger.balance(companyAccount(c.id)) < 0;
  // A truck that doesn't earn its overhead bracket, or (with no bracket) loses money, goes.
  const unprofitable = profit !== null && profit < (slotOverhead > 0 ? slotOverhead - cfg.costs.idleFeePerDay * 7 : 0);
  // Extra leases go back first: nothing to sell, and a leased truck earns less than an owned one.
  const leases = w.trucksByCompany.get(c.id)!.filter((t) => t.lease === "lessor" && t.status === "idle");
  const sitting = leases.find((t) => today - t.idleSinceDay >= 7);
  const weak = profit !== null && profit < LEASE_HURDLE_FD;
  if (leases.length > 0 && (inDebt || unprofitable || weak || sitting)) {
    if (applyAction(w, c.id, { type: "return_lease", truckId: (sitting ?? leases[0]!).id }).ok) return;
  }
  if (!inDebt && !unprofitable) return;
  const idle = w.trucksByCompany
    .get(c.id)!
    .filter((t) => t.status === "idle" && t.lease === "owned")
    .sort((a, b) => condition(cfg, a) - condition(cfg, b) || a.id - b.id);
  if (idle[0]) sell(w, c, p, idle[0].id, inDebt);
}

/** Assets: the cheapest open lease offer whose rent is at most half what a truck here earns a week, or null. */
function bestLeaseOffer(w: World, c: Company, p: BotProfile, today: number, active: number): number | null {
  const profit = profitPerTruckWeek(c, p, today, active);
  if (profit === null || profit <= 0) return null;
  let best: { id: number; fd: number } | null = null;
  for (const o of openLeaseOffers(w)) {
    if (o.lessorId === c.id || o.weeklyFd > profit / 2 || o.minWeeks > 12) continue;
    if (!best || o.weeklyFd < best.fd) best = { id: o.id, fd: o.weeklyFd };
  }
  return best?.id ?? null;
}

/**
 * Assets, player lessors: weekly, a parked truck that came back unsold goes on offer for lease at about
 * 2% of its value a week; an offer nobody took in eight weeks comes off; a leased tractor goes back to its
 * owner once it's worn (the owner rebuilds) or when this fleet is losing money, past its minimum term.
 */
function manageLeases(w: World, c: Company, p: BotProfile, today: number): void {
  if (today % 7 !== 1) return;
  const fleet = w.trucksByCompany.get(c.id)!;
  const offered = new Set(openLeaseOffers(w).map((o) => o.truckId));
  for (const o of openLeaseOffers(w)) if (o.lessorId === c.id && today - o.listedDay >= 56) applyAction(w, c.id, { type: "withdraw_lease_offer", offerId: o.id });
  for (const t of fleet) {
    if (t.status !== "parked" || t.lease !== "owned" || leasedOut(t) || offered.has(t.id) || condition(w.cfg, t) < 0.3) continue;
    const [lo, hi] = w.cfg.assets.playerLeases.weeklyFdRange;
    const weeklyFd = Math.round(Math.max(lo, Math.min(hi, 0.02 * truckValue(w, t))));
    applyAction(w, c.id, { type: "offer_lease", truckId: t.id, weeklyFd, minWeeks: 4 });
  }
  const losing = (profitPerTruckWeek(c, p, today, Math.max(1, fleet.length)) ?? 1) < 0;
  for (const t of [...fleet]) {
    if (!leasedOut(t) || t.status !== "idle" || today < t.leaseMinUntilDay) continue;
    if (losing || condition(w.cfg, t) <= p.rebuildAt) applyAction(w, c.id, { type: "return_lease", truckId: t.id });
  }
}

/** Assets: working spares a yard keeps, about one per five tractors. */
const sparesWanted = (tractors: number) => Math.floor(tractors / 5);

/** Assets: a trailer in the yard beyond the working spares (its tractor was scrapped or sold), or null. */
function spareBeyondNeed(w: World, c: Company, tractors: number): ReturnType<typeof yardTrailers>[number] | null {
  const spares = yardTrailers(w, c);
  return spares.length > sparesWanted(tractors) ? spares[spares.length - 1]! : null;
}

const tractorPriceOf = (w: World, tier: TractorTier) => w.cfg.dealerFd.tractor[tier] * w.dealerIndex.tractor[tier];

/**
 * Assets: the yard. An idle truck at home hooks the trailer type that reloads best there (a rental goes
 * back as soon as an own trailer waits); each rental gets an own trailer bought to replace it (renting
 * costs more than owning within weeks); worn trailers are refurbished while they can be; a fleet with a
 * yard keeps a working spare per five tractors, of the type freight is going uncovered for; and spares
 * beyond that, with no tractor coming for them, are sold.
 */
function manageTrailers(w: World, c: Company, p: BotProfile, rng: Rng, today: number): void {
  const { cfg } = w;
  const acct = companyAccount(c.id);
  const fleet = w.trucksByCompany.get(c.id)!;
  const home = c.homeHub;
  const score = (eq: Equipment) => w.reloadIndex[planIndex(home, EQUIPMENT.indexOf(eq))] ?? 1;
  for (const t of fleet) {
    if (t.lease !== "owned" || t.status !== "idle" || t.hub !== home) continue;
    const spares = yardTrailers(w, c);
    if (spares.length === 0) break;
    const cur = hookedTrailer(w, t);
    if (cur?.lease === "rental") {
      const own = spares.find((s) => s.type === cur.type) ?? spares[0]!;
      applyAction(w, c.id, { type: "swap_trailer", truckId: t.id, trailerId: own.id });
      continue;
    }
    const best = spares.reduce((a, b) => (score(b.type) > score(a.type) ? b : a));
    if (cur && best.type !== cur.type && score(best.type) > 1.25 * score(cur.type)) applyAction(w, c.id, { type: "swap_trailer", truckId: t.id, trailerId: best.id });
  }
  const spare = () => w.ledger.balance(acct) - reserve(w, c, p);
  // Every rental out gets an own trailer on order to replace it.
  const rentals = fleet.map((t) => hookedTrailer(w, t)).filter((tr) => tr?.lease === "rental");
  const coming = trailerOrdersOf(w, c.id).filter((o) => o.kind === "trailer").length;
  const buyTrailer = (type: Equipment, cushion: number) => {
    const src = bestSource(w, c.id, "trailer", "workhorse", type);
    if (spare() >= cushion * src.price) applyAction(w, c.id, { type: "buy_trailer", trailer: type, dealershipId: src.dealershipId || undefined });
  };
  if (rentals.length > coming) buyTrailer(rentals[coming]!.type, 1);
  // Refurbish worn trailers in the yard or behind an idle truck.
  for (const tr of ownedTrailers(w, c)) {
    if (trailerCondition(w, tr) > p.rebuildAt || !trailerRefurbishable(w, tr)) continue;
    const truck = tr.truckId ? w.trucks[tr.truckId - 1]! : null;
    if (tr.status !== "dropped" && !(truck && truck.status === "idle")) continue;
    if (spare() < cfg.assets.trailer.refurbFd[tr.type]) break;
    applyAction(w, c.id, { type: "refurbish_trailer", trailerId: tr.id });
  }
  if (today % 7 !== 0 || c.yard === "none") return;
  const tractors = fleet.filter((t) => t.lease === "owned").length;
  const spares = yardTrailers(w, c);
  const want = sparesWanted(tractors);
  // A working spare per five tractors, of the type the board is short of.
  if (spares.length + coming < want && ownedTrailers(w, c).length + trailerOrdersOf(w, c.id).length < trailerCap(w, c)) {
    buyTrailer(TRAILERS[rng.weighted(TRAILERS.map((e) => dpow(1 - w.fillRate[e], 2) + 0.01))]!, 3);
  }
  // Spares well beyond that, with no tractor ordered for them, are sold.
  if (spares.length > want + 2) {
    const tr = spares[0]!;
    const value = trailerValue(w, tr);
    applyAction(w, c.id, { type: "list_trailer", trailerId: tr.id, askFd: value, floorFd: value * 0.6, stepFd: value * 0.05 });
  }
}

/**
 * The best-value used truck this buyer can afford: priced at or under its used
 * value and well under new, not worn out. Used trucks deliver today; new ones wait
 * for the dealer.
 */
function bestListing(w: World, budget: number, buyerId: number, runOut = false): Listing | null {
  const today = dayOf(w.t, w.cfg);
  let best: { l: Listing; score: number } | null = null;
  for (const l of openListings(w)) {
    if (l.trailerId || l.askFd > budget || l.formerOwnerId === buyerId || l.sellerId === buyerId) continue; // trucks only: a trailer alone is no truck
    const t = w.trucks[l.truckId - 1]!;
    if (condition(w.cfg, t) < 0.3) continue;
    // Assets: a tractor past its last rebuild is one to run out, not to grow on: only a first-truck buyer takes it (a fleet would sell it straight back).
    if (!runOut && !rebuildable(w.cfg, t)) continue;
    const value = truckValue(w, t);
    const score = l.askFd / Math.max(1, value);
    if (score > 1.05 || l.askFd > 0.85 * dealerPrice(w, t)) continue;
    if (!best || score < best.score) best = { l, score };
  }
  return best?.l ?? null;
}

/** Borrows against unpledged trucks until `needFd` is raised, if the pool and the trucks can cover it. */
function borrowFor(w: World, c: Company, needFd: number): boolean {
  const trucks = w.trucksByCompany.get(c.id)!.filter((t) => t.lease === "owned" && !activeLoanOn(w, t.id));
  const capacity = trucks.reduce((s, t) => s + borrowingCapacity(w, t), 0);
  if (capacity < needFd || poolCash(w) < needFd) return false;
  let left = needFd;
  for (const t of trucks) {
    if (left <= 0) break;
    const amount = Math.min(left, borrowingCapacity(w, t));
    if (amount > 1 && applyAction(w, c.id, { type: "borrow", truckId: t.id, amountFd: amount }).ok) left -= amount;
  }
  return left <= 1;
}

/** Deposit spare cash, pull it back when short, and (if prudent) pay loans off early. */
function manageCash(w: World, c: Company, p: BotProfile): void {
  const acct = companyAccount(c.id);
  const cash = w.ledger.balance(acct);
  const need = reserve(w, c, p);
  const deposited = depositorValue(w, c.id);
  // Payment terms (0.18.0): short of working capital, factor the invoices; otherwise wait for the due day.
  // A contract runs its term; short of working capital a bot signs one if it can post the stake, takes quick pay only when it is half short, and waits otherwise.
  if (w.cfg.token.payment.enabled && !c.factoring) {
    const want = cash < need ? (cash >= factoringStake(w, c) ? "factor" : cash < need * 0.5 ? "quick" : "net") : "net";
    if (c.payTerms !== want) applyAction(w, c.id, { type: "set_pay_terms", terms: want });
  }
  if (cash < need * 0.5 && deposited > 1_000) {
    applyAction(w, c.id, { type: "withdraw_finance", amountFd: need - cash });
    return;
  }
  if (!p.depositor) return;
  for (const loan of w.finance.loans) {
    if (loan.borrowerId === c.id && loan.status === "active" && w.ledger.balance(acct) > need * 2 + loan.principalFd) {
      applyAction(w, c.id, { type: "repay_loan", loanId: loan.id });
    }
  }
  const spare = w.ledger.balance(acct) - need * 2;
  if (spare <= 20_000) return;
  // Pools (0.18.0): a depositor spreads spare FD over equipment finance and every pool still thin enough to pay for capital.
  if (w.cfg.token.pools.enabled) {
    const thin = (["insurance", "factoring", "surety"] as const).filter((line) => capitalRatio(w, line) < 2 * w.cfg.token.pools[line].minCapitalRatio);
    if (thin.length > 0) {
      const each = spare / (thin.length + 1);
      for (const line of thin) applyAction(w, c.id, { type: "deposit_pool", line, amountFd: each });
      applyAction(w, c.id, { type: "deposit_finance", amountFd: each });
      return;
    }
  }
  applyAction(w, c.id, { type: "deposit_finance", amountFd: spare });
}

/** FD this bot would turn into dollars this week: a share of what's above its reserve. Free-path drivers save for a truck instead. */
function cashOutFd(w: World, c: Company, p: BotProfile): number {
  if (w.trucksByCompany.get(c.id)!.some((t) => t.lease === "npc")) return 0;
  const spare = w.ledger.balance(companyAccount(c.id)) - reserve(w, c, p) * p.cashOut.keepMult;
  return spare > 1_000 ? spare * p.cashOut.share : 0;
}

/**
 * The day before each weekly buyback: offer this week's cash-out at a minimum
 * price near the last clearing price, adapting like bid pricing — a full fill
 * means it could have asked more, a miss means it asked too much.
 */
function offerToBuyback(w: World, c: Company, p: BotProfile, today: number): void {
  if ((today + 2) % 7 !== 0) return;
  const fill = w.buyback.lastFill.get(c.id);
  if (fill !== undefined) p.cashOut.askMult = Math.min(2, Math.max(0.5, p.cashOut.askMult * (fill >= 0.999 ? 1.05 : 0.9)));
  const amountFd = cashOutFd(w, c, p);
  const ref = lastBuybackPrice(w) ?? 0;
  applyAction(w, c.id, { type: "offer_fd", amountFd, minPriceUsd: ref * p.cashOut.askMult });
}

/** Token mode: buys `fd` FD with outside dollars if the wallet covers it. */
function buyFdFor(w: World, c: Company, fd: number): boolean {
  if (fd <= 0) return true;
  const usd = quoteUsdForFd(w, fd) * 1.001;
  if (!(usd <= c.usd.wallet)) return false;
  return applyAction(w, c.id, { type: "buy_fd", usd }).ok;
}

/**
 * Token mode, once a week (each company on its own weekday): sell this week's
 * cash-out to the pool. Bots that won't pay to win won't sell into a slump either
 * (price under 80% of its 8-week average). Traders also buy dips and sell rips
 * with outside dollars; FD they bought that the company has since spent just
 * isn't there to sell (the sale is capped at what's sellable).
 */
function tradeToken(w: World, c: Company, p: BotProfile, today: number): void {
  if ((today + c.id) % 7 !== 0) return;
  // A farmer sells everything it can, whatever the price, keeping a little for fuel.
  if (p.farmer) {
    sellMax(w, c, sellableFd(w, c) - (p.quit ? 0 : 2_000));
    return;
  }
  const price = fdPriceUsd(w);
  const avg = averagePriceUsd(w, 56);
  if (p.trader) {
    if (price < 0.75 * avg && c.usd.wallet > 1) {
      const before = w.ledger.balance(companyAccount(c.id));
      if (applyAction(w, c.id, { type: "buy_fd", usd: c.usd.wallet * 0.25 }).ok) p.traderFd += w.ledger.balance(companyAccount(c.id)) - before;
    } else if (price > 1.3 * avg && p.traderFd > 1) {
      const fd = Math.min(p.traderFd, sellableFd(w, c));
      if (fd > 1 && applyAction(w, c.id, { type: "sell_fd", fd }).ok) p.traderFd -= fd;
    }
  }
  if (!p.payToWin && price < 0.8 * avg) return;
  const fd = Math.min(cashOutFd(w, c, p) - p.traderFd, sellableFd(w, c));
  if (fd > 100) applyAction(w, c.id, { type: "sell_fd", fd });
}

/** Sells up to `want` FD now, within what is sellable and today's sell limit (token.exchange.dailySellShareOfPool). */
function sellMax(w: World, c: Company, want: number): void {
  const room = sellRoomFd(w, c);
  const fd = Math.min(want, sellableFd(w, c), room - 0.05);
  if (fd > 1) applyAction(w, c.id, { type: "sell_fd", fd });
}

// --- Speculators (config adversaries): wallets outside the game -------------------------------------

interface Holder {
  kind: "momentum" | "crowd" | "whale";
  buyDay: number;
  sellDay: number;
  /** What it paid per FD, on average. */
  entry: number;
  bought: boolean;
  selling: boolean;
}
const holdersOf = new WeakMap<World, Map<number, Holder>>();

/** At launch: the momentum traders', the listing-day crowd's and the whale's wallets. */
function spawnHolders(w: World, rng: Rng): void {
  const a = w.cfg.adversaries;
  const day = dayOf(w.t, w.cfg);
  const m = new Map<number, Holder>();
  holdersOf.set(w, m);
  const make = (kind: Holder["kind"], name: string, usd: number, h: Omit<Holder, "kind" | "entry" | "bought" | "selling">) => {
    const c = formCompany(w, { name, role: "holder", homeHubId: w.net.hubs[0]!.id, strategy: `spec:${kind}`, orders: [], freePath: false });
    c.usd.wallet = usd;
    m.set(c.id, { kind, entry: 0, bought: false, selling: false, ...h });
  };
  for (let i = 0; i < a.momentum.wallets; i++) make("momentum", `Momentum-${i + 1}`, lognormal(rng, a.momentum.usdMedian), { buyDay: day, sellDay: Infinity });
  for (let i = 0; i < a.crowd.wallets; i++) {
    const buyDay = day + rng.int(0, 6);
    make("crowd", `Crowd-${i + 1}`, lognormal(rng, a.crowd.usdMedian), { buyDay, sellDay: buyDay + rng.int(a.crowd.holdDays[0], a.crowd.holdDays[1]) });
  }
  if (a.whale.usd > 0) make("whale", "Whale", a.whale.usd, { buyDay: day + 1, sellDay: day + 1 + a.whale.sellAfterDays });
}

/** Daily: momentum buys a week's rise and sells a week's fall; the crowd and the whale buy once and sell on their rule, at the daily limit. */
function runHolders(w: World): void {
  const m = holdersOf.get(w);
  if (!m) return;
  const a = w.cfg.adversaries;
  const price = fdPriceUsd(w);
  const today = dayOf(w.t, w.cfg);
  const hist = w.token.priceHistory;
  for (const [id, s] of m) {
    const c = w.companies[id - 1]!;
    const held = w.ledger.balance(companyAccount(id));
    const buyAll = (usd: number) => {
      if (!(usd > 1) || usd > c.usd.wallet + 1e-9) return;
      const before = w.ledger.balance(companyAccount(id));
      if (applyAction(w, id, { type: "buy_fd", usd }).ok) {
        const got = w.ledger.balance(companyAccount(id)) - before;
        if (got > 0) s.entry = s.entry > 0 && held > 0 ? (s.entry * held + usd) / (held + got) : usd / got;
        s.bought = true;
      }
    };
    if (s.kind === "momentum") {
      const then = hist[hist.length - 1 - a.momentum.lookbackDays];
      if (!then || then <= 0 || !(price > 0)) continue;
      const move = price / then - 1;
      if (move >= a.momentum.buyAfterRise && c.usd.wallet > 5) buyAll(c.usd.wallet * a.momentum.buyShare);
      else if (move <= -a.momentum.sellAfterFall && held > 1) sellMax(w, c, held);
      continue;
    }
    if (!s.bought) {
      if (today >= s.buyDay) buyAll(c.usd.wallet);
      continue;
    }
    if (!s.selling) {
      const stop = s.kind === "crowd" && price <= s.entry * (1 - a.crowd.stopLoss);
      const target = s.kind === "whale" && price >= s.entry * (1 + a.whale.sellAfterGain);
      if (today >= s.sellDay || stop || target) s.selling = true;
    }
    if (s.selling && held > 1) sellMax(w, c, held);
  }
}

function reserve(w: World, c: Company, p: BotProfile): number {
  const trucks = operatingTrucks(w, c.id);
  // FD left at the season close is mostly burned, so bots hold less back as it nears. Otherwise never
  // below the working capital the economy lets a company hold free: stripping it is how greedy bots went broke.
  const nearClose = daysUntilLock(w) <= 45 ? 0.5 : 1;
  return Math.max(p.reserveBase + p.reservePerTruck * trucks, w.cfg.holdingCost.minProtectedFd) * nearClose;
}

/** Per-day cache of what a new facility of each type would ship at each hub. */
type Outlooks = Map<string, { equipment: Equipment; loadsPerRound: number }>;

function outlookFor(w: World, cache: Outlooks, type: FacilityType, hub: number) {
  const key = `${type}|${hub}`;
  let o = cache.get(key);
  if (!o) cache.set(key, (o = facilityOutlook(w, type, hub, dayOf(w.t, w.cfg))));
  return o;
}

/**
 * Best facility the bot can afford whose payback clears its hurdle, or null.
 * Expected margin is weighted by how often that equipment's freight actually
 * gets covered before the owner would give up (public board fill rate over
 * giveUpAfterRounds); the rest goes unsold.
 */
function chooseFacility(w: World, budget: number, maxPaybackWeeks: number, cache: Outlooks): { type: FacilityType; hub: number } | null {
  const { cfg } = w;
  let best: { type: FacilityType; hub: number; payback: number } | null = null;
  for (const type of FACILITY_TYPES) {
    const spec = cfg.facilities.types[type];
    if (w.facilitySupply[type] <= 0 || spec.priceFd > budget) continue;
    for (let hub = 0; hub < w.net.hubs.length; hub++) {
      const o = outlookFor(w, cache, type, hub);
      const ref = (cfg.rates.baseRatePerMile + cfg.rates.shortHaulBonus / TYPICAL_LANE_MI) * cfg.rates.equipmentPremium[o.equipment];
      const covered = 1 - dpow(1 - w.fillRate[o.equipment], cfg.board.giveUpAfterRounds);
      const hauled = spec.saleValueOfRef * (1 - cfg.board.posterFeePct) - ASSUMED_CLEARED_OF_REF;
      const margin = covered * hauled * ref * TYPICAL_LANE_MI;
      const weeklyNet = o.loadsPerRound * 14 * margin - spec.upkeepPerWeekFd;
      if (weeklyNet <= 0) continue;
      const payback = spec.priceFd / weeklyNet;
      if (payback <= maxPaybackWeeks && (!best || payback < best.payback)) best = { type, hub, payback };
    }
  }
  return best;
}

/** Once per in-game day: tune prices, rebuild worn trucks, then invest spare FD. */
export const ruleBotHook: DailyAgentHook = (w) => {
  const rng = w.rng.agents;
  const { cfg } = w;
  const locked = inCloseWindow(w);
  // Cash about to burn, or paying a holding cost, should be put to work: looser investment hurdles.
  const burnPressure = daysUntilLock(w) <= 45 ? 3 : holdingCostApplies(w) ? 2 : 1;
  const outlooks: Outlooks = new Map();
  const live = tokenLive(w);
  if (live && dayOf(w.t, cfg) % 7 === 0) admitNewcomers(w);
  // Adversaries (config adversaries): the speculators' wallets come with the launch, then trade daily.
  if (live && cfg.adversaries.enabled) {
    if (!holdersOf.has(w)) spawnHolders(w, rng);
    runHolders(w);
  }
  // Beta (Jeff, 2026-10-29): the AI fleet may not grow past its starting size × token.betaAiFleetCap,
  // so the starved market of the airdrop season rewards the humans who commit early. Bots still
  // replace and sell trucks; after launch, or with the token off, they grow as they judge.
  // Checked per company, trucks on order included, so a day when liquidations retire trucks doesn't let every bot order one.
  const capped = !live && cfg.token.enabled && cfg.token.betaAiFleetCap !== null;
  const botIds = capped ? w.companies.filter((c) => !c.strategy.startsWith("player:")).map((c) => c.id) : [];
  const grow = () => !capped || aiFleet(w) + botIds.reduce((s, id) => s + ordersOf(w, id).length, 0) < w.aiFleetStart * cfg.token.betaAiFleetCap!;

  for (const c of w.companies) {
    const p = profiles.get(c);
    // Shut down: wait out the bar (new authority comes by itself when it ends).
    if (p && c.authority.status === "revoked") continue;
    if (!p || c.liquidatingSince !== null) continue; // not a bot, or being wound up
    const acct = companyAccount(c.id);
    const fleet = w.trucksByCompany.get(c.id)!;
    // A farmer quits some months after launch (selling the trucks and the FD); a sybil wallet sells at its limit every day.
    if (live && p.farmer) {
      const today = dayOf(w.t, cfg);
      if (p.quitDay === Infinity) p.quitDay = today + rng.int(cfg.adversaries.farmerQuitDays[0], cfg.adversaries.farmerQuitDays[1]);
      if (!p.quit && today >= p.quitDay) {
        p.quit = true;
        c.orders = [];
      }
      if (p.quit) {
        for (const t of [...fleet]) if (t.lease === "owned" && t.status === "idle") sell(w, c, p, t.id, true);
        sellMax(w, c, sellableFd(w, c));
        continue;
      }
      if (p.sybil) sellMax(w, c, sellableFd(w, c) - 2_000);
    }
    if (live) {
      if (p.claimsEarly && c.airdrop && !c.airdrop.claimedEarly && c.airdrop.weeksLeft > 0) applyAction(w, c.id, { type: "claim_airdrop_now" });
      // In the red and heading for liquidation: a paying player buys its way back to zero and a little over.
      if (p.payToWin && c.weeksInDebt >= 1) buyFdFor(w, c, -w.ledger.balance(acct) + 2_000);
    }

    if (cfg.businesses.enabled) maybeBuyBusiness(w, c, p, rng, dayOf(w.t, cfg));
    if (cfg.assets.enabled && cfg.businesses.enabled && dayOf(w.t, cfg) % cfg.time.daysPerMonth === 2) {
      priceDealerships(w, c);
      sellWeakBusinesses(w, c);
    }

    if (c.role === "carrier") {
      adaptPricing(w, c, p);
      recordOperating(c, p, dayOf(w.t, cfg));
      setConduct(w, c, p);
      manageStaff(w, c, p, rng, dayOf(w.t, cfg));
      if (p.conduct === "outlaw") crookery(w, c, rng);

      // Worn trucks: rebuild, or past this bot's age limit sell and replace. A worn
      // truck's higher break-even loses bids; an old one costs more to rebuild.
      for (const t of [...fleet]) {
        if (t.lease !== "owned" || t.status !== "idle" || condition(cfg, t) > p.rebuildAt) continue;
        // Assets: a tractor past its last rebuild is sold on (to run out its life elsewhere), or run out by a one-truck carrier.
        if ((t.odometer >= p.replaceAtMi || !rebuildable(cfg, t)) && fleet.length > 1) {
          sell(w, c, p, t.id);
          continue;
        }
        if (!rebuildable(cfg, t)) continue;
        if (w.ledger.balance(acct) < rebuildCost(cfg, t) + p.firstTruckBuffer) break;
        applyAction(w, c.id, { type: "rebuild_truck", truckId: t.id });
      }
      if (cfg.assets.enabled) {
        manageTrailers(w, c, p, rng, dayOf(w.t, cfg));
        manageLeases(w, c, p, dayOf(w.t, cfg));
      }

      if (!locked) {
        const npcTruck = fleet.find((t) => t.lease === "npc");
        if (npcTruck) {
          // The free path: a decent used truck if one's affordable today, else a new
          // Workhorse + dry van from the dealer (which keeps the NPC lease until it arrives).
          if (ordersOf(w, c.id).length > 0) continue;
          const cash = w.ledger.balance(acct);
          const used = npcTruck.status === "idle" ? bestListing(w, cash - p.firstTruckBuffer, c.id, true) : null;
          // Assets: the cheapest new Workhorse and van, a dealership's in stock or the NPC dealer's.
          const src = cfg.assets.enabled ? bestSource(w, c.id, "rig", "workhorse", "van") : null;
          if (used) applyAction(w, c.id, { type: "buy_listing", listingId: used.id });
          else if (src?.dealershipId || availableSupply(w, "workhorse", "van", true) > 0) {
            const need = (src ? src.price : dealerPrice(w, { tier: "workhorse", trailer: "van" })) + p.firstTruckBuffer;
            // Token mode: a paying player can buy the FD it's short instead of saving it up.
            const funded = cash >= need || (live && p.payToWin && buyFdFor(w, c, need - cash));
            if (funded) applyAction(w, c.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: true, dealershipId: src?.dealershipId || undefined });
          }
          continue; // no other investment until the first truck is owned
        }
        const today = dayOf(w.t, cfg);
        let active = operatingTrucks(w, c.id);
        if (today % 7 === 0) {
          rightSize(w, c, p, today, active);
          active = operatingTrucks(w, c.id);
        }
        const idle = fleet.filter((t) => t.status === "idle").length;
        const pending = ordersOf(w, c.id).length;
        // Staking (0.18.0): the next truck tier needs a stake; a bot that wants more trucks and can spare the FD stakes it first.
        // The catalogue (0.18.0): more trucks than the yard holds needs a yard; in the farming season a paying bot buys it with dollars.
        if (cfg.token.catalogue.enabled && grow() && active + pending >= yardTrucks(w, c) && active + pending < p.targetFleet) {
          const yard = c.yard === "none" ? "yardSmall" : c.yard === "small" ? "yardLarge" : null;
          if (yard) {
            const usd = itemPriceUsd(w, yard);
            if (!live && p.payToWin && c.usd.wallet >= usd && c.usdSpentBeta + usd <= cfg.token.catalogue.usdWindow.capUsdPerMc) applyAction(w, c.id, { type: "buy_item", item: yard, pay: "usd" });
            else if (w.ledger.balance(acct) - reserve(w, c, p) >= itemPriceFd(w, yard) + cfg.token.catalogue.items[yard].bondFd) applyAction(w, c.id, { type: "buy_item", item: yard, pay: "fd" });
          }
        }
        // Upgrades pay for themselves over a year: one a day, cheapest first, when the cash is well clear of the reserve.
        if (cfg.token.catalogue.enabled) {
          let bought = false;
          for (const t of fleet) {
            if (bought || t.lease === "npc" || t.status === "retired") continue;
            for (const m of ["tires", "aero", "sleeper", "apu"] as const) {
              if (t.mods[m]) continue;
              const usd = itemPriceUsd(w, m);
              if (!live && p.payToWin && c.usd.wallet >= usd && c.usdSpentBeta + usd <= cfg.token.catalogue.usdWindow.capUsdPerMc) bought = applyAction(w, c.id, { type: "buy_item", item: m, pay: "usd", truckId: t.id }).ok;
              else if (w.ledger.balance(acct) - reserve(w, c, p) * 2 >= 4 * itemPriceFd(w, m)) bought = applyAction(w, c.id, { type: "buy_item", item: m, pay: "fd", truckId: t.id }).ok;
              break;
            }
          }
        }
        const tier = nextTruckTier(w, c);
        if (tier && grow() && active + pending >= truckCap(w, c) && active + pending < p.targetFleet) {
          // The stake bought with dollars when the bot pays to win: the design's demand engine (TOKENOMICS.md §2).
          const short = tier.stake - c.stakedFd - (w.ledger.balance(acct) - reserve(w, c, p));
          if (short > 0 && live && p.payToWin) buyFdFor(w, c, short);
          if (w.ledger.balance(acct) - reserve(w, c, p) >= tier.stake - c.stakedFd) applyAction(w, c.id, { type: "stake_fd", fd: tier.stake - c.stakedFd });
        }
        if (active > 0 && grow() && active + pending < p.targetFleet && fleet.length + pending < truckCap(w, c) && idle / active <= 0.3 && worthAnotherTruck(w, c, p, today, active)) {
          // Cheapest capacity first: a parked truck, then a used one (today), then
          // a new one (after the dealer's lead time), borrowing if this bot does.
          const parked = fleet.find((t) => t.status === "parked" && (p.noUnpark.get(t.id) ?? 0) <= today && !openLeaseOffers(w).some((o) => o.truckId === t.id));
          const cash = w.ledger.balance(acct);
          const need = reserve(w, c, p);
          // Assets: a tractor on lease from another carrier, if its rent is well inside what a truck here earns.
          const lease = parked || !cfg.assets.enabled ? null : bestLeaseOffer(w, c, p, today, active);
          const used = parked || lease ? null : bestListing(w, cash - need, c.id);
          if (parked) applyAction(w, c.id, { type: "unpark_truck", truckId: parked.id });
          else if (lease) applyAction(w, c.id, { type: "take_lease", offerId: lease });
          else if (used) applyAction(w, c.id, { type: "buy_listing", listingId: used.id });
          else {
            let ordered = false;
            if (deliveryDays(w) <= p.maxLeadDays) {
              const pick = pickEquipment(w, rng, false, true);
              // Assets: a spare trailer beyond the yard's working spares gets a tractor of its own.
              const spare = cfg.assets.enabled ? spareBeyondNeed(w, c, active) : null;
              if (pick) {
                const kind = spare ? "tractor" : "rig";
                const src = cfg.assets.enabled ? bestSource(w, c.id, kind, pick.tier, spare?.type ?? pick.trailer) : null;
                const price = src ? src.price : dealerPrice(w, pick);
                const short = price + need - cash;
                if (short <= 0 || (p.leverage && borrowFor(w, c, short)) || (live && p.payToWin && buyFdFor(w, c, short))) {
                  ordered = applyAction(w, c.id, { type: "buy_asset", tier: pick.tier, trailer: spare?.type ?? pick.trailer, replaceNpcLease: false, tractorOnly: spare !== null, dealershipId: src?.dealershipId || undefined }).ok;
                }
              }
            }
            // No truck to buy, too long a wait, or no capital: lease one if the
            // board shows freight going uncovered and this fleet's trucks clear the lease's cost.
            if (!ordered && cfg.freeEntry.leases.enabled && grow()) leaseIfWorth(w, c, p, rng, today, active);
          }
        }
      }
    }

    if (c.role === "broker" && cfg.token.staking.enabled && !brokerLicensed(w, c)) {
      // No licence stake, no loads: the broker stakes what it has, buying the rest with dollars if it pays to win.
      const need = cfg.token.staking.roles.broker - c.stakedFd;
      const cash = w.ledger.balance(companyAccount(c.id));
      if (cash < need && live && (p as { payToWin?: boolean }).payToWin === true) buyFdFor(w, c, need - cash);
      if (w.ledger.balance(companyAccount(c.id)) >= need) applyAction(w, c.id, { type: "stake_fd", fd: need });
    }
    if (c.role === "broker") throttleBrokering(w, c, p, dayOf(w.t, cfg));

    // Facilities: any company with spare FD can add the shipper role, unless the
    // ones it already owns are losing money.
    const owned = facilitiesOf(w, c.id);
    if (locked || owned.length >= cfg.facilities.maxPerCompany) continue;
    const today = dayOf(w.t, cfg);
    const ownedWeeks = owned.reduce((s, f) => s + (today - f.boughtDay) / 7, 0);
    if (ownedWeeks >= 4 && owned.reduce((s, f) => s + f.netFd, 0) < 0) continue;
    const budget = w.ledger.balance(acct) - reserve(w, c, p);
    if (budget < cfg.facilities.types.warehouse.priceFd) continue;
    const choice = chooseFacility(w, budget, p.maxPaybackWeeks * burnPressure, outlooks);
    if (!choice) continue;
    const r = applyAction(w, c.id, { type: "buy_facility", facility: choice.type, hubId: w.net.hubs[choice.hub]!.id });
    // The hub's outlook changed; drop its cached entries.
    if (r.ok) for (const type of FACILITY_TYPES) outlooks.delete(`${type}|${choice.hub}`);
  }

  // Cash management last, after any investment; then whatever's still spare can be cashed out.
  const today = dayOf(w.t, cfg);
  for (const c of w.companies) {
    const p = profiles.get(c);
    if (!p || c.liquidatingSince !== null) continue;
    manageCash(w, c, p);
    if (live) tradeToken(w, c, p, today);
    else if (cfg.buyback.enabled && !cfg.token.enabled) offerToBuyback(w, c, p, today);
  }
};

/**
 * Businesses (0.18.0): once a week, a bot with cash well clear of its reserve buys one at its home
 * hub — carriers a shop first, brokers a station or a truck stop — and a new shop prices its work
 * somewhere under the NPC shop's list.
 */
/**
 * Assets: a dealership follows its sales each month: nothing sold with stock on the lot, it cuts its markup;
 * sold out, it raises it; never to the NPC backstop's premium, where it would sell nothing.
 */
function priceDealerships(w: World, c: Company): void {
  const k = w.cfg.businesses.kinds.dealership;
  for (const b of businessesOf(w, c.id)) {
    if (b.kind !== "dealership") continue;
    const stock = Object.values(b.stock.tractor).reduce((s, n) => s + n, 0) + Object.values(b.stock.trailer).reduce((s, n) => s + n, 0);
    let m = b.markup;
    if (b.soldLastMonth === 0 && stock > 0) m -= 0.02;
    else if (stock === 0) m += 0.02;
    const cap = npcBackstop(w) ? Math.min(k.markupRange[1], w.cfg.assets.factory.npcPremium - 0.01) : k.markupRange[1];
    m = Math.max(k.markupRange[0], Math.min(cap, m));
    if (Math.abs(m - b.markup) > 1e-9) applyAction(w, c.id, { type: "set_shop_markup", businessId: b.id, markup: m });
  }
}

/** Assets, resale: a business a year old or more whose trade alone loses money goes up for sale at 70% of what it cost. */
function sellWeakBusinesses(w: World, c: Company): void {
  const today = dayOf(w.t, w.cfg);
  const listed = new Set(openAssetSales(w).filter((s) => s.kind === "business").map((s) => s.refId));
  for (const b of businessesOf(w, c.id)) {
    if (listed.has(b.id) || today - b.boughtDay < 365 || b.netFd + b.purchaseFd >= 0) continue;
    applyAction(w, c.id, { type: "list_asset_sale", kind: "business", refId: b.id, askFd: Math.max(1, 0.7 * b.purchaseFd) });
  }
}

function maybeBuyBusiness(w: World, c: Company, p: BotProfile, rng: Rng, today: number): void {
  const k = w.cfg.businesses;
  if ((today + c.id) % 7 !== 3 || businessesOf(w, c.id).length >= k.maxPerCompany) return;
  if (rng.next() > 0.25) return;
  const kinds: BusinessKind[] = c.role === "broker" ? ["fuelStation", "truckStop"] : w.cfg.assets.enabled ? ["shop", "dealership", "truckStop", "fuelStation"] : ["shop", "truckStop", "fuelStation"];
  const cash = w.ledger.balance(companyAccount(c.id)) - reserve(w, c, p);
  const hubId = w.net.hubs[c.homeHub]!.id;
  for (const kind of kinds) {
    const spec = k.kinds[kind];
    // Assets: a business another player is selling, if it's cheaper than building one new.
    if (w.cfg.assets.enabled) {
      const sale = openAssetSales(w).find((s) => {
        const b = s.kind === "business" ? w.businesses[s.refId - 1] : undefined;
        if (!b || b.kind !== kind || b.ownerId === c.id) return false;
        const fresh = kind === "truckStop" ? sitePriceFd(w, w.sites[b.site - 1]!) : businessPriceFd(w, kind);
        return s.askFd <= fresh && cash >= (s.askFd + b.bondFd) * 1.5;
      });
      if (sale && applyAction(w, c.id, { type: "buy_asset_sale", saleId: sale.id }).ok) return;
    }
    if (kind === "truckStop") {
      // The busiest site for sale the bot can afford, with the cash well clear of it.
      const site = w.sites
        .filter((s) => s.open && s.businessId === 0 && cash >= (sitePriceFd(w, s) + spec.bondFd) * 1.5)
        .sort((a, b) => b.traffic - a.traffic || a.id - b.id)[0];
      if (!site) continue;
      if (!applyAction(w, c.id, { type: "buy_business", kind, siteId: site.id }).ok) continue;
    } else {
      if (cash < (businessPriceFd(w, kind) + spec.bondFd) * 1.5) continue;
      if (!applyAction(w, c.id, { type: "buy_business", kind, hubId }).ok) continue;
    }
    if (kind === "dealership") {
      // A new dealership prices a little under the NPC backstop's premium; monthly it follows its sales (priceDealerships).
      const b = businessesOf(w, c.id).at(-1)!;
      applyAction(w, c.id, { type: "set_shop_markup", businessId: b.id, markup: Math.min(k.kinds.dealership.markupRange[1], w.cfg.assets.factory.npcPremium - 0.03) });
    } else if (kind !== "fuelStation") {
      const b = businessesOf(w, c.id).at(-1)!;
      const [lo, hi] = k.kinds[kind].markupRange;
      applyAction(w, c.id, { type: "set_shop_markup", businessId: b.id, markup: rng.range(lo, hi) });
      if (kind === "truckStop") {
        const [plo, phi] = k.parking.priceRange;
        applyAction(w, c.id, { type: "set_parking_price", businessId: b.id, fd: rng.range(plo + (phi - plo) * 0.2, plo + (phi - plo) * 0.6) });
      }
    }
    return;
  }
}
