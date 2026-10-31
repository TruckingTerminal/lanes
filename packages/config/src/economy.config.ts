// Every tunable number in LANES lives here. Each value cites the spec section it
// comes from ("§Section"). Values marked "PoC assumption" are not in the spec and
// were chosen to make Phase 0 runnable; tune them in simulation.
//
// Bump `version` whenever any value changes; every sim run records it.

export type Equipment = "van" | "reefer" | "flatbed";
export type TractorTier = "workhorse" | "highwayPro" | "flagship";
export type FacilityType = "warehouse" | "coldStorage" | "factory";

export const economyConfig = {
  version: "0.18.3-phase0.27", // The trailer pass and the theft corridors (2026-10-30); live levers in live.ts

  // §World, map and time
  time: {
    gameMinutesPerDay: 1440,
    weekdayOfDay0: 0, // the calendar's day 0 is a Monday (docks' business hours)
    realHoursPerGameDayLive: 6,
    daysPerSeason: 365,
    daysPerMonth: 30,
    boardRoundHours: [6, 18] as const, // two rounds per in-game day
    simRealMsPerGameDay: 60_000, // sim mode pacing: 1 in-game day per real minute
  },

  // §Summary — hours of service
  hos: {
    drivingHoursPerDay: 11,
    avgMph: 50, // the nominal pace; on the road each route's own speed applies (roads.routing.mph), ≈ 550–630 miles a day
    // "Automatic reset": the duty day opens when a truck first rolls and resets
    // 24 in-game hours later. No 14-hour window or 70-hour rule (spec: no other rules).
    dutyDayHours: 24,
  },

  // PoC assumption (from Jeff): dock time at each end, on duty but not driving
  dwell: {
    loadMinutes: [60, 120] as const,
    unloadMinutes: [60, 120] as const,
  },

  // The trailer pass (Jeff, 2026-10-30): what pulling each trailer is like from the cab.
  equipmentOps: {
    enabled: false,
    // A reefer's unit burns diesel while it is loaded: on the road (its gallons an hour at this pace, per
    // loaded mile), through the night, and while it waits at a dock.
    reeferUnitGalPerHour: 0.8,
    reeferUnitMph: 50,
    nightHours: 10,
    // Flatbed: chains, straps and tarps at the shipper, untarping at the receiver, and an open deck in the
    // weather: a damage claim at these odds, more in a northern winter, less with a skilled driver.
    flatbedSecureMinutes: [60, 120] as const,
    flatbedUntarpMinutes: [30, 60] as const,
    flatbedDamageOdds: 0.03,
    flatbedDamageWinterGain: 2,
    flatbedDamageShare: 0.1,
    // Weight: a loaded trailer burns more per mile than an empty one, and climbs harder.
    loadedFuelMult: 1.05,
    emptyFuelMult: 0.8,
    loadedClimbMult: 1.3,
    emptyClimbMult: 0.6,
    // Drivers earn more per mile on the harder freight.
    driverPayMult: { van: 1, reefer: 1.05, flatbed: 1.12 } satisfies Record<Equipment, number>,
  },

  // Receiving and shipping hours (Jeff, 2026-10-30): cold chain, and the dry food that goes to the same
  // distribution centers, by appointment at any hour; other dry van first come, first served in weekday
  // business hours; flatbed in daylight. A truck early for its slot, at a closed dock, or past its slot
  // (the next one comes hours later) waits at the gate, on the clock. The receiver's hours move the due
  // time; a missed slot does not. Weekdays count from time.weekdayOfDay0.
  docks: {
    enabled: false,
    appointmentCommodities: ["grocery", "beverages", "parcels"] as string[],
    byEquipment: { reefer: "appointment", van: "fcfs", flatbed: "daylight" } satisfies Record<Equipment, string>,
    appointment: { leadMinutes: 180, earlyMinutes: 120, graceMinutes: 120, nextSlotHours: [4, 10] as const },
    hours: {
      fcfs: { open: 6, close: 18, days: [0, 1, 2, 3, 4] as number[] },
      daylight: { open: 6, close: 18, days: [0, 1, 2, 3, 4, 5] as number[] },
    },
  },

  // Cargo theft (Jeff, 2026-10-30; the EVE plan's risk for reward). A loaded truck asleep is the target:
  // the night's odds, times where it sleeps (`parking`: the shoulder worst, a public rest area, a truck
  // stop's security best), times the hotspot it is near (CargoNet's: Southern California, Texas,
  // Georgia, Florida, Illinois, Tennessee, New Jersey; `mult` at the hub, fading to 1 at `radiusMi`),
  // times what is aboard (the commodity's value over `attractBaseFd`, within `attractRange`). A theft
  // loses the load: the carrier pays the cargo deductible and is not paid; a pool-written policy pays the
  // rest of the cargo's value, a sink; the truck goes on empty after the police report. Shippers pay for
  // the risk in the rate (a lane premium per point of risk, a premium on high-value loads), and insurers
  // price a fleet by where it sleeps (the average exposure of its nights against `insuranceRefExposure`).
  theft: {
    enabled: false,
    oddsPerLoadedNight: 0.001,
    parking: { shoulder: 3, restArea: 1, truckStop: 0.35 },
    hotspots: [
      { hub: "ONT", mult: 3, radiusMi: 120 },
      { hub: "LAX", mult: 3, radiusMi: 80 },
      { hub: "DAL", mult: 2, radiusMi: 100 },
      { hub: "HOU", mult: 2, radiusMi: 90 },
      { hub: "LRD", mult: 2, radiusMi: 60 },
      { hub: "ATL", mult: 2.2, radiusMi: 100 },
      { hub: "MIA", mult: 2.5, radiusMi: 90 },
      { hub: "JAX", mult: 1.6, radiusMi: 60 },
      { hub: "CHI", mult: 2, radiusMi: 100 },
      { hub: "MEM", mult: 2, radiusMi: 80 },
      { hub: "EWR", mult: 1.8, radiusMi: 80 },
    ],
    attractBaseFd: 60_000,
    attractRange: [0.4, 4] as const,
    reportHours: 6,
    ratePremiumPerRisk: 0.03,
    highValuePremium: 0.02,
    exposurePerNight: 0.02,
    insuranceWeight: 0.3,
    insuranceRefExposure: 1.3,
    insuranceClamp: [0.85, 1.5] as const,
  },

  // Adversaries (sim only; TODO.md step 2, the degen and bear-case batches): the crowd the rational bots
  // never were. Farmers are this share of the bot owner-operators and newcomers: they haul to keep their
  // airdrop slices, cut corners, claim early, sell everything they can every week whatever the price,
  // never grow, and quit some months after launch (selling their trucks and their FD). Sybil clusters
  // are one actor across many free-path wallets, farming like the rest and then selling every wallet at
  // its daily limit every day. Speculators are wallets outside the game (role "holder": no trucks, no
  // costs): momentum traders buy a week's rise and sell a week's fall; a listing-day crowd buys in the
  // launch week and sells on a stop-loss or after a few weeks; a whale buys big the day after launch and
  // sells at its daily limit once it has doubled, or after a while.
  adversaries: {
    enabled: false,
    farmerShare: 0,
    farmerQuitDays: [180, 360] as const,
    sybil: { clusters: 0, wallets: 8 },
    momentum: { wallets: 0, usdMedian: 2_000, lookbackDays: 7, buyAfterRise: 0.15, sellAfterFall: 0.1, buyShare: 0.5 },
    crowd: { wallets: 0, usdMedian: 200, holdDays: [14, 60] as const, stopLoss: 0.25 },
    whale: { usd: 0, sellAfterGain: 1, sellAfterDays: 90 },
  },

  // Design proposal (Jeff, 2026-10-28): the real road network (packages/data/src/roads.ts, from
  // Natural Earth). Lanes are routed along interstates and US highways; tolls are charged where
  // the road is a toll road (priced by state at real per-mile truck rates); two-lane highways are
  // slower and riskier, more so in winter up north.
  roads: {
    routing: { mph: [58, 42] as const, highwayStopHours: 0.05, timeValueFdPerHour: 120 },
    crashHighwayMult: 1.6, // crash odds on a two-lane highway vs an interstate
    // Winter weather: from December to February, risk rises with latitude north of 36° (×1 at 36°, up to the gain at 49°).
    winter: { months: [11, 0, 1] as const, fromLat: 36, toLat: 49, gain: { interstate: 0.35, highway: 0.9 } },
    tollsInRates: true, // shippers pay tolls in the reference rate, like a fuel surcharge
    // Terrain (Jeff, 2026-10-29/30, Phase A): elevation along the road (data/elevation.ts, a 0.1° grid) gives
    // every route its climb, its miles on grades over `mountainGrade`, and its miles above `passElevM`.
    // Climbing burns `fuelGalPerClimbM` gallons a meter (~7 per thousand meters; shippers pay it in the
    // rate like tolls when `inRates`), grades slow trucks to `mountainMph`, the share of a leg on grades
    // raises breakdowns and crashes, and in winter a pass can close for a few hours (a chain law).
    terrain: { enabled: false, fuelGalPerClimbM: 0.007, mountainGrade: 0.03, mountainMph: 30, breakdownPerMountainShare: 0.5, crashPerMountainShare: 0.3, passElevM: 2000, closureOddsPerPassMi: 0.001, closureHours: [4, 12] as const, inRates: true },
  },

  // §World, map and time — lanes
  map: {
    maxLaneMiles: 1500,
    minLaneMiles: 60, // PoC assumption: skip trivial same-metro pairs
    circuity: 1.2, // only for a hub pair the road network doesn't connect (none today); lanes run on real road miles
    nearbyRadiusMi: 150, // §Rates — load-to-truck ratio radius
  },

  // §Load board
  board: {
    scoreWeights: { price: 0.55, reputation: 0.25, deadhead: 0.2 },
    deadheadScaleMi: 150,
    // Standing orders price in the empty miles expected after delivery: reloadDeadheadMi ÷ the
    // destination's reload odds, clamped, at this weight.
    reloadDeadheadMi: 60,
    // When a market can't reload a truck, the expected empty run is the way out of it: up to the
    // distance to the best market in reach (Miami → Atlanta ≈ 690 mi), not a token 250 (Jeff, 2026-10-29).
    reloadDeadheadClamp: [20, 800] as const,
    // Dispatchers look a few loads ahead: a destination whose load-to-truck ratio beats the national
    // average is worth this much per load of ratio, discounted per load out.
    lookaheadFdPerRatio: 300,
    lookaheadDiscount: 0.6,
    reloadWeight: 1, // the whole expected empty run (0.35–0.5 led to more failures in the 10-seed runs)
    // Design decision (Jeff, 2026-10-29): freight is hauled only by AI and player carriers; no NPC
    // carrier ever takes a load off the board. A load nobody takes rolls with its ceiling up this
    // much a round (was 5%: shippers get desperate sooner), its appointment moved back a round,
    // until a carrier takes it or the shipper gives up after giveUpAfterRounds (five days) and the
    // freight is lost: no haul, no pay. Open loads pile up where trucks are scarce, which lifts the
    // load-to-truck ratio and so every new posting there: the market, not a fallback, sets the price.
    rolloverCeilingStep: 0.1,
    giveUpAfterRounds: 10,
    // Design decision (Jeff, 2026-10-28): a counter above the poster's ceiling is still taken, up to
    // ceiling × this, but only when nobody offers within the ceiling — so a hot market still covers.
    overCeilingMax: 1.5,
    maxBidsPerTruckPerRound: 12, // PoC assumption: performance bound
    freeStandingOrders: 5,
    // PoC assumption: board fee paid by players who post freight (brokers and player
    // shippers), on what the freight pays them (§Circular economy — sinks)
    posterFeePct: 0.03,
  },

  // Design decision (Jeff, 2026-10-28): every load carries a book-now price the poster sets
  // next to the sealed-bid round. Take it and the load is yours at once; bid below it and wait
  // for the round (a bid never pays more than the book-now). Brokers fish: in a truck-heavy
  // market the price opens low and steps up each round the load sits; in a tight one it opens
  // near the ceiling. Who blinks is desperation: idle time and a driver's days from home.
  bookNow: {
    // Opening price as a share of the reference rate, by the origin's load-to-truck ratio
    // (piecewise linear between the points; never above the ceiling).
    openAtRatio: [
      [0.5, 0.88],
      [1, 0.98],
      [2, 1.1],
    ] as const,
    stepPerRound: 0.12, // unfilled: the poster raises it 12% a round (the ceiling moves 10%)
    autoEveryHours: 2, // dispatchers look for book-now loads this often
    desperation: {
      idleHours: 24, // idle this long and a dispatcher takes anything that covers costs (Jeff, 2026-10-29: never let a truck sit past a day)
      awayAfterDays: 14, // a driver this long from home starts to count…
      awayDays: 14, // …and is fully desperate this many days later
      atHomeMult: 0.5, // sitting at home is half as pressing: no per diem, the driver is home
      // A desperate truck takes a backhaul below break-even to reach a better market: up to this share
      // below, when the destination's load-to-truck ratio beats where it sits by betterBy.
      belowBreakEven: 0.12,
      betterBy: 1.1,
      // Nothing bookable for this many rounds: run empty to the market where the days saved waiting are
      // worth more than the empty miles. A carrier's wait at a market is 1 ÷ its effective load-to-truck
      // ratio (a visitor sees only the share not held for locals), days; sitting costs opportunityFdPerDay.
      repositionAfterRounds: 2,
      repositionWithinMi: 800,
      opportunityFdPerDay: 400,
      maxWaitDays: 10,
    },
  },

  // Design decision (Jeff, 2026-10-28): shipper leverage. The more trucks a market has per load,
  // the more its shippers work exclusively with carriers based nearby: a share of each market's
  // loads is tendered to local carriers only for their first round. Carriers that turn down
  // contract tenders lose that access for a while.
  leverage: {
    localShareAtBalance: 0.5, // share of loads tendered local-first when loads and trucks balance…
    localShareSlope: 0.35, // …minus this × log2(load-to-truck ratio): Miami (0.5) ≈ 85%, a tight market (2) ≈ 15%
    localShareClamp: [0.1, 0.9] as const,
    localRounds: 1, // rounds a local-first load is held for local carriers
    unreliableDays: 30, // a carrier that turns down tenders is passed over by local shippers this long
  },
  // Contracts: local shippers offer local carriers a weekly volume on a lane at a fixed rate for a term.
  contracts: {
    termDays: 91,
    offerDays: 7, // an offer stands this long
    tenderHours: 12, // a tender waits for the carrier until the next round
    maxPerCompany: 2,
    offerShareOfLocals: 0.3, // at a balanced market this share of local carriers gets an offer a week (× 2 × local share)
    loadsPerWeek: [1, 3] as const,
    rateVsIndex: 1.0, // contract rate against the market's trailing contract level (what brokers get)
    acceptanceAdjust: 0.2, // acceptance is a moving average with this weight on each tender
    afterTenders: 4, // no judgment before this many tenders
    cutBelow: 0.85, // below this acceptance the shipper cuts a load a week and talks to the other shippers
    renewAbove: 0.9, // at least this to be offered a new term
    newcomerBoost: 1.3, // a local carrier holding no contract ranks this much higher for the next offer
  },

  // Places and commodities (DESIGN-PLACES.md): every load is a commodity between two places,
  // with a delivery appointment; perishables delivered past their spoil time are a total loss.
  commodities: {
    spoilClaimShare: 0.5, // the carrier's cargo claim on a spoiled load, as a share of cargo value
    placeSlackMi: 150, // markets this far beyond a dispatcher's empty-mile limit are still scanned (a place can be nearer than its hub)
  },

  // Design decision (Jeff, 2026-10-28): driver fatigue. More than three weeks on the road
  // builds fatigue that touches everything; five days off at home resets it, and extra days
  // off bank a small buffer. A day over ten driving hours builds it too, more for every
  // consecutive long day. Fatigue raises crash odds, slows the truck, and wears morale.
  fatigue: {
    roadDays: 21,
    roadPerDay: 0.03, // per day past roadDays, growing by the weeks out
    longDayHours: 10,
    perHourOver: 0.01, // per driving hour past longDayHours: a legal 11-hour day barely registers, a 15-hour one does…
    consecutiveMult: 0.25, // …×(1 + this × consecutive long days before today, up to consecutiveCap)
    consecutiveCap: 6,
    recoverPerDay: 0.01, // every day, before the day's build-up: steady legal driving holds near zero
    restDayOnRoad: 0.05, // a day off away from home
    recoverAtHome: 0.1, // a day off at home short of a full reset
    resetDays: 5, // off at home this long: fatigue 0
    bufferPerExtraDay: 0.5, // each day off past the reset banks this much fatigue absorbed later
    bufferMax: 3,
    crashMult: 2, // crash odds × (1 + this × fatigue)
    paceLoss: 0.1, // speed × (1 − this × fatigue)
    moralePerDay: 0.02, // morale lost per day at fatigue 1 (scaled from 0.5 up)
    tiredAt: 0.5, // the client and the notices call a driver tired from here
    // Home time routing: a driver due home takes loads that get the truck closer, and runs empty only when near.
    homeward: { closerByMi: 100, deadheadWithinMi: 400, deadheadAfterRounds: 4 },
  },

  // §Load board — freight sources
  freight: {
    npcBrokerOnlyShare: 0.5,
    // PoC assumption: national freight demand per round, sized so the default sim
    // population (~1,500 trucks at ~0.5 loads/day after HOS and dock time) can haul
    // most of it, with NPC carriers covering thin hubs.
    baseLoadsPerRound: 420,
    equipmentShare: { van: 0.6, reefer: 0.22, flatbed: 0.18 } satisfies Record<Equipment, number>,
    destDistanceDecayMi: 900, // PoC assumption: destination weight ∝ exp(-miles/decay)
    inboundPull: 0.5, // PoC assumption: how strongly weak-outbound hubs attract inbound freight
    deliverySlackMinutes: 720, // PoC assumption: due = HOS transit + dock time + 12h
    earlyThresholdMinutes: 720, // §Points — early by half a day or more
  },

  // §Rates, demand and the scaled fuel engine
  rates: {
    baseRatePerMile: 2.45, // PoC assumption, dry van linehaul
    shortHaulBonus: 120, // PoC assumption: + bonus/miles per mile
    ratioExponent: 0.35,
    ratioClamp: [0.5, 2.5] as const, // PoC assumption: keeps ratio^0.35 within ≈0.78–1.38
    equipmentPremium: { van: 1.0, reefer: 1.18, flatbed: 1.12 } satisfies Record<Equipment, number>,
    npcCeilingMarkup: 1.15, // PoC assumption: NPC ceiling = ref × markup
    // Places (0.14.0): a shipper far from its market pays more per mile, since the truck runs empty to get there.
    remotePremiumPer100Mi: 0.08,
    remotePremiumCap: 0.25,
    // Freight into a market trucks can't reload in pays part of the empty run out of it, per loaded mile
    // (Jeff, 2026-10-29: loads into Florida must pay much more, the exit deadhead included).
    exitDeadheadShare: 0.6,
    deadheadFdPerMile: 1.2,
    // Regional seasons (packages/data/src/seasons.ts): each hub's weekly $/mi swing ÷ a typical
    // rate is its relative swing, which moves both freight volume and the posted rate. More
    // freight also tightens the market, so the realized rate swing is larger than rateGain alone.
    seasons: {
      refRpm: { van: 2.3, reefer: 2.6 },
      flatbedFromVan: 0.8, // no flatbed series: flatbed follows the van curve
      volumeGain: 3,
      rateGain: 2.5,
      volumeClamp: [0.5, 2.5] as const,
      rateClamp: [0.7, 1.6] as const,
      lateDecVolume: 0.8, // holiday shutdowns
    },
    // Destination reload odds = the hub's production/consumption balance for that trailer
    // (hubs.ts imbalance; Miami van 0.55) × its live load-to-truck ratio against the national
    // average. Freight into poor-reload markets pays more (the carrier prices in the empty miles
    // out); freight into strong outbound markets pays less. Price factor = odds^-exponent.
    reloadExponent: 0.2,
    reloadClamp: [0.8, 1.3] as const,
    reloadSmoothingRounds: 14,
    sectorClamp: [0.85, 1.15] as const,
  },

  // §Rates — scaled fuel
  fuel: {
    baseFd: 4.0,
    realStrength: 0.5,
    clamp: [0.75, 1.25] as const,
    surchargePassThrough: 0.8,
    surchargeMpg: 6.5,
  },

  // §Rates — worked example
  costs: {
    driverWagePerMile: 0.75,
    npcLeaseShareOfGross: 0.15,
    idleFeeAfterDays: 7,
    idleFeePerDay: 20, // was 50: on 10 seeds × 4 years it was the single biggest cause of honest single-truck owners failing
    // Design decision (Jeff, 2026-10-29): a truck that sits costs money from the first day. A crewed
    // truck idle at day's end burns this much diesel idling for the cab (heat, air, the driver's rest),
    // at the day's pump price; per diem (labor.perDiemFd) covers the driver from the second day.
    idleFuelGalPerDay: 8,
    // An IFTA-style fuel tax (Jeff, 2026-10-29): filed monthly on every gallon burned that month, on
    // the road and idling, at a flat rate per gallon (no per-state rates until routes carry states).
    // A sink in the player's own month: the bill lands with the month's close.
    fuelTax: { enabled: false, perGal: 0.5 },
    // A national sales tax (Jeff, 2026-10-29) on every purchase of goods and services: trucks and
    // trailers, used trucks, facilities, businesses, catalogue items, repairs, rebuilds, maintenance,
    // a night at a truck stop. Not on fuel (the fuel tax), freight, wages, premiums or stakes. A sink.
    salesTax: { enabled: false, pct: 0.05 },
  },

  // §Assets and supply caps
  tractors: {
    workhorse: { mpg: 6.5, maintPerMile: 0.15, breakdownMult: 1.0, pocCap: 1200 },
    highwayPro: { mpg: 7.2, maintPerMile: 0.14, breakdownMult: 0.7, pocCap: 500 },
    flagship: { mpg: 7.8, maintPerMile: 0.13, breakdownMult: 0.5, pocCap: 100 },
  } satisfies Record<TractorTier, { mpg: number; maintPerMile: number; breakdownMult: number; pocCap: number }>,
  trailers: {
    van: { maintPerMile: 0.03, pocCap: 1000 },
    reefer: { maintPerMile: 0.06, pocCap: 400 },
    flatbed: { maintPerMile: 0.03, pocCap: 300 },
  } satisfies Record<Equipment, { maintPerMile: number; pocCap: number }>,

  // PoC assumption: an NPC equipment dealer sells PoC supply for FD (a sink), so the
  // free-path kill criterion ("buys a first owned truck") has something to buy.
  // The spec only prices assets in USDC; these FD prices are open for tuning. On
  // the NPC lease a free owner-operator nets ≈200–250 FD/day (the worked example's
  // 24% margin at ~0.5 loads/day), so an 18k Workhorse + dry van takes ≈50–70
  // in-game days to save for, inside the 84-day kill criterion.
  dealerFd: {
    tractor: { workhorse: 14_000, highwayPro: 32_000, flagship: 70_000 } satisfies Record<TractorTier, number>,
    trailer: { van: 4_000, reefer: 10_000, flatbed: 7_000 } satisfies Record<Equipment, number>,
  },

  // PoC assumption: dealer lead time. New trucks are paid for at order and arrive
  // 30 in-game days later in a quiet market (≈7.5 real days); every truck already
  // on order nationally adds to the wait, like an OEM backlog. Orders placed into
  // a boom land as it turns, which is what lets capacity overshoot.
  dealerDelivery: {
    baseDays: 30,
    daysPerPendingOrder: 0.25,
    maxDays: 150,
  },

  // PoC assumption: what a truck is worth used — by mileage and age ("year"), then
  // condition. A new Workhorse + van is 18k; at 500k miles and 3 years old it's
  // worth about 37% of that before condition.
  depreciation: {
    lifetimeMiles: 1_000_000, // value falls linearly with odometer to the floor at 1M miles…
    perYear: 0.05, // …and 5 points a season with age
    floorPct: 0.12,
    conditionWeight: 0.4, // a fully worn truck is worth 40% less than a fresh one of the same age
  },

  // §Circular economy — two ledgers: secondary sales pay the seller 95% and the
  // protocol 5%. In FD the 5% is a sink.
  usedMarket: {
    feePct: 0.05,
  },

  // §DeFi buildings — Equipment Finance, in FD for Season 1. Depositors fund the
  // pool; borrowers pay 1% a week on loans of up to 35% of a truck's market value;
  // two missed payments mean repossession and sale (the repo man).
  equipmentFinance: {
    weeklyRate: 0.01,
    maxLoanToValue: 0.35,
    termWeeks: 26, // PoC assumption: loans amortize over half a season
    missedPaymentsToRepossess: 2,
    // PoC assumption: repossessed trucks list at 85% of market value, drop 10
    // points of value a week, and go back to dealer supply unsold below 40%; the
    // pool's depositors absorb whatever the sale doesn't cover.
    repoStartPctOfValue: 0.85,
    repoWeeklyStepPctOfValue: 0.1,
    repoFloorPctOfValue: 0.4,
  },

  // §Assets — wear and rebuild; million-mile trucks. Wear is what owners pay for
  // instead of a depreciation reserve (§Rates — worked example: ≈0.20 FD/mi).
  wear: {
    lifeMiles: 200_000, // PoC assumption: condition falls 1 → 0 over this many miles since the last rebuild
    mpgLossWorn: 0.2, // PoC assumption: fully worn, mpg × 0.8 (25% more fuel)
    maintRiseWorn: 1.0, // PoC assumption: fully worn, maintenance × 2
    npcLeaseCondition: 0.85, // the NPC lessor services leased trucks ("Lessor pays" major repairs)
    // PoC assumption: rebuild cost, below a new truck's price. With the curves
    // above the cheapest point to rebuild is near condition 0.6 (~80k miles),
    // ≈0.19 FD/mi all-in: about the worked example's depreciation reserve.
    rebuildFd: { workhorse: 10_000, highwayPro: 14_000, flagship: 19_000 } satisfies Record<TractorTier, number>,
    // …and a rebuild costs more the older the truck: ×2 at 500k miles, ×3 at 1M.
    // Restoring an old truck stays possible (assets are never destroyed) but gets
    // expensive, so replacing it eventually pays.
    rebuildAgeMi: 500_000,
    rebuildDays: 2,
    rebuildMaxCondition: 0.85, // a rebuild must restore real wear, so FD can't be parked in fresh condition
    milesPerLevel: 50_000,
    maxLevel: 20,
    fuelBonusPerFiveLevels: 0.01,
    maxFuelBonus: 0.04,
  },

  // §Events and drama — breakdown: mileage and maintenance weighted; delay, tow, repair bill
  breakdowns: {
    per1000MiNew: 0.015, // PoC assumption: a new Workhorse breaks down about every 67,000 miles
    wornMultiplier: 8, // rate × (1 + 8·wear²): fully worn, about every 7,400 miles
    ageMi: 800_000, // …and × (1 + odometer / 800k): old trucks break down more even when freshly rebuilt
    delayHours: [6, 18] as const,
    repairFd: [1_500, 4_500] as const, // tow + repair; on NPC-leased trucks the lessor pays
  },

  // §Assets and supply caps — facilities. Caps and weekly upkeep are the spec's;
  // prices, output and sale value are PoC assumptions. A facility originates freight
  // at its hub, taking over part of the hub's NPC demand rather than adding to it,
  // and earns its owner the goods margin (sale value − freight) plus shipper Miles.
  facilities: {
    types: {
      warehouse: { pocCap: 80, priceFd: 45_000, upkeepPerWeekFd: 2_000, loadsPerRound: 1.0, equipment: "van", saleValueOfRef: 1.18 },
      coldStorage: { pocCap: 30, priceFd: 90_000, upkeepPerWeekFd: 4_000, loadsPerRound: 1.5, equipment: "reefer", saleValueOfRef: 1.2 },
      factory: { pocCap: 50, priceFd: 120_000, upkeepPerWeekFd: 3_500, loadsPerRound: 2.0, equipment: "bySector", saleValueOfRef: 1.2 },
    } satisfies Record<
      FacilityType,
      { pocCap: number; priceFd: number; upkeepPerWeekFd: number; loadsPerRound: number; equipment: Equipment | "bySector"; saleValueOfRef: number }
    >,
    maxPerCompany: 6, // §Owned vs. leased — company caps
    maxPlayerShareOfHub: 0.6, // NPC shippers keep ≥40% of each hub's freight (§Load board — freight sources)
    shipperMilesPerMile: 0.15, // §Points — shippers
    // A facility's freight rolls like any other (board.rolloverCeilingStep, the owner paying the
    // rising ceiling) and is lost unsold when the owner gives up (board.giveUpAfterRounds): no NPC
    // expediter since 0.17.0.
  },

  // Player businesses (Jeff, 2026-10-29; TODO.md "the big sinks"): a shop, a truck stop or a fuel
  // station at a hub, bought for FD through the catalogue split (burn / treasury / reserve) plus a
  // staked bond, with weekly upkeep. A shop does the hub's maintenance, repairs and rebuilds at its
  // own price against the NPC shop's list (parts are a sink; the rest is the owner's); a truck stop
  // halves the idle fuel of trucks resting at the hub for a nightly fee; a fuel station keeps a margin
  // on the fuel bought at its hub. Owners use their own at cost. Prices scale with the catalogue index.
  businesses: {
    enabled: false,
    maxPerCompany: 3,
    kinds: {
      // Sized on the v29-a batch (2026-10-30): a shop at an average hub does ~1.1M FD of work a year and
      // a fuel station sees ~4.8M FD of fuel; each pays back in one to two years on its own, and an
      // owner's own fleet makes it better (parts at cost, wholesale fuel).
      shop: { priceFd: 80_000, bondFd: 40_000, upkeepPerWeekFd: 2_000, perHub: 2, partsShare: 0.7, markupRange: [0.85, 1.0] as const },
      fuelStation: { priceFd: 200_000, bondFd: 80_000, upkeepPerWeekFd: 1_200, perHub: 1, marginPct: 0.04 },
      // A truck stop (Jeff, 2026-10-30) is a site on an interstate (sites below), not a hub business: fuel
      // at a wider margin, a shop that charges over list (road service comes from here), and parking
      // that cuts a resting truck's idling to a quarter for a nightly fee. Its price scales with the
      // site's traffic (0.5× to 3× this), its bond doesn't.
      // Sized on v32–v35 (2026-10-30, Phase A): at 250k + 100k and 15 a night a stop cleared ~20k a year, a
      // ten-year payback, so bots stopped at ~25 and three quarters of breakdowns found nobody. A parked
      // truck saves 24 FD of idling, so 20 a night still leaves the driver better off.
      truckStop: { priceFd: 150_000, bondFd: 50_000, upkeepPerWeekFd: 1_500, fuelMarginPct: 0.06, partsShare: 0.7, markupRange: [1.1, 1.4] as const, idleFuelMult: 0.25 },
    },
    // Parking (Jeff, 2026-10-30): a truck sleeps at a site. Every site is a free public rest area with spaces
    // by its traffic (`spaces` at the quietest and the busiest); a player's truck stop on it adds shore
    // power (idling at a quarter), fuel, the shop and a nightly price the owner sets within `priceRange`
    // (new stops ask `defaultPriceFd`). Shutting down on the shoulder is illegal unless the truck broke
    // down: a patrol ticket of `shoulderFineFd` at `patrolOdds`, and the full idling. A driver stops at the
    // last site with room the day's hours still reach, early if the next is beyond them (trips.ts
    // planNight); a site found full sends them on. Owners add `spacesPerPurchase` spaces for
    // `spacePriceFd` each, through the catalogue split.
    parking: { spaces: [5, 40] as const, shoulderFineFd: 250, patrolOdds: 0.33, defaultPriceFd: 20, priceRange: [10, 40] as const, spacesPerPurchase: 25, spacePriceFd: 1_000 },
    // Truck-stop sites: one every so many interstate miles, ranked by the freight that passes (a gravity
    // model over the lanes), the busiest open for sale at the start, more opening as the fleet grows.
    // openPerBuilt: the open count follows coverage too — this many sites for sale per truck stop built.
    sites: { everyMi: 100, openAtStart: 100, openPerBuilt: 2, priceRange: [0.5, 3] as const },
    // Fuel on the road, without a tank model: a leg buys its first block of miles at the origin (its hub
    // station or the NPC pump) and each further block at the nearest truck stop to that mile, within reach.
    fuelRule: { blockMi: 400, stopRangeMi: 100 },
    // A breakdown happens where the truck is: the cheapest provider within reach comes out (a truck
    // stop's shop at its markup, a hub shop at its own), for a call-out fee plus the drive; with none in
    // reach, NPC road service at its markup and its wait. The drive out sets the delay.
    roadService: { rangeMi: 100, callOutFd: 400, callOutPerMi: 6, mph: 50, npcMarkup: 1.5, npcHours: 8 },
  },

  // §Circular economy — season close (the last 30 in-game days)
  seasonClose: {
    enabled: true, // the sim can run without seasons to compare
    lockDays: 30, // no permanent purchases (trucks, facilities) in the close window
    carryoverPct: 0.1, // "retained earnings after taxes": keep 10%…
    carryoverCapFd: 25_000, // …capped at 25,000 FD; the rest is burned…
    // …except that a company always keeps up to this many weeks of its own recent
    // spending (PoC assumption, design proposal), so a working-capital buffer —
    // the cash that carries a fleet through a bust — survives the reset.
    workingCapitalWeeks: 4,
    reputationDecay: 0.3, // the reputation record (and level) shrinks 30%
  },

  // PoC assumption (design proposal, for running without seasons): a weekly
  // holding cost on cash above working capital — the season burn spread across the
  // year. Working capital is the larger of 25,000 FD and the company's own last
  // four weeks of spending, so a bust buffer is free to hold; hoards aren't.
  // Idle cash in the Equipment Finance pool pays it too; money lent out doesn't.
  holdingCost: {
    weeklyRate: 0.02, // ≈65% a year on excess cash
    minProtectedFd: 25_000,
    withSeasons: false, // with seasons on, the year-end burn does this job
  },

  // PoC assumption: insolvency. A company more than 2,000 FD in the red at four
  // weekly checks in a row is liquidated: it stops bidding, its trucks go to the
  // used market at fire-sale prices (back to dealer supply if nobody buys), its
  // facilities go back to supply, whatever it still owes is written off — shown as
  // its own faucet — and the owner restarts on the free path: an NPC lease, no grant.
  insolvency: {
    debtLimitFd: 2_000,
    weeksInDebt: 4,
    restartAfterDays: 14, // a bankrupt sits out this long after its fleet is gone before the free-path restart
    fireSaleStartPctOfValue: 0.7,
    fireSaleStepPctOfValue: 0.1,
    fireSaleFloorPctOfValue: 0.25,
  },

  // PoC assumption: broker risk. NPC shippers sometimes don't pay — more often in
  // a downturn — and the broker still owes its carrier. And brokers sell to
  // shippers on contract rates that trail the spot market by about a month: when
  // spot spikes in a boom the broker pays carriers more than the contract brings
  // in, and when spot falls in a bust the contract pads the margin.
  brokerRisk: {
    defaultRate: 0.02, // share of brokered loads the shipper doesn't pay, at a neutral cycle…
    downturnSensitivity: 3, // …× (1 + 3 × how far the demand dial is below 1)
    contractLagDays: 30,
    // A brokered load nobody hauled before the shipper gave up: the broker pays the shipper this share
    // of the contract as a fall-off charge, and will pay carriers up to that much over the contract
    // to avoid it (0.17.0: no NPC carrier covers it any more).
    fallOffShare: 0.15,
  },

  // §Roles — carrier authority; broker license and bond. Renew each season.
  permits: {
    carrierAuthorityFd: 300, // MC filing fee
    brokerLicenseRenewalFd: 300,
    brokerBondFd: 75_000,
    suretyPctPerYear: [0.02, 0.12] as const, // Surety Desk premium by credit: best reputation 2%, worst 12%
  },

  // PoC assumption (design proposal): fleet overhead — dispatch, compliance,
  // terminals — charged weekly per truck in brackets, like a tax schedule: truck
  // number k pays the rate of the highest bracket it has reached. The first three
  // trucks are free, so owner-operators and small fleets never pay. It's a fixed
  // weekly cost, not a per-mile one, so it doesn't move anyone's break-even or
  // bids: it takes fleet rents (§Owned vs. leased: ownership buys scale, plus
  // risk) without pushing rates down onto leased owner-operators.
  //
  // Brackets sit below what a typical fleet truck earns (≈900–1,000 FD/week
  // before overhead), so most fleets pay rather than park. Fleets that respond by
  // parking or growing less hand capacity to smaller carriers, and the trucks
  // left earn more, so this shifts who owns capacity more than it raises the sink
  // ratio (see README).
  fleetOverhead: {
    brackets: [
      // Dispatch moved out to hired dispatchers' salaries (labor), so ~100 FD/truck-week less than before.
      // …and ~40 less again for yard rent, now charged by home hub (homeBase).
      { fromTruck: 4, weeklyFd: 210 },
      { fromTruck: 6, weeklyFd: 410 },
      { fromTruck: 11, weeklyFd: 560 },
      { fromTruck: 21, weeklyFd: 660 },
    ],
  },

  // PoC assumption (design proposal): free entry, so capacity can grow into a boom
  // instead of the PoC caps turning every boom into fleet rents.
  freeEntry: {
    // Extra NPC leases (§Assets: "the NPC lease fleet is separate, unlimited"):
    // a carrier that owns a truck can lease more Workhorses, any trailer, on the
    // free path's terms — 15% of gross, the lessor maintains them — with no
    // capital down. Leased trucks count toward fleet overhead and the company cap.
    // The lessor's fleet grows when nearly all of it is out and freight is going
    // uncovered, and shrinks as leases come back in a slack market, so there's a
    // lag both ways.
    leases: {
      enabled: true,
      startFleet: 150,
      maxFleet: 2_000,
      growthPerMonth: 0.15,
      shrinkPerMonth: 0.1,
      tightUtilization: 0.9,
      slackUtilization: 0.6,
      maxPerCompany: 10,
      minTermDays: 28,
      minWeeklyFd: 250, // minimum rent: a leased truck pays at least this a week, share or not
    },
    // OEM build slots: when the dealer's remaining supply of a tractor tier or
    // trailer type (outside the starter reserve) is under 10% of its cap while
    // freight goes uncovered, the dealer adds 5% of the cap that month. A change
    // from the spec's "caps never raised within a season". Off by default: on 10
    // seeds it added ~700 trucks that stayed through every bust, while leases
    // came and went with the cycle (README — free entry).
    dealerGrowth: {
      enabled: false,
      lowSupplyShare: 0.1,
      uncoveredFillRate: 0.8, // board fill rate (smoothed share of open loads clearing per round) below this
      growthPerMonth: 0.05,
    },
  },

  // PoC assumption (design proposal): a revenue-funded FD buyback before FD has a
  // market. Each in-game week the treasury spends a fixed dollar budget — a stand-in
  // for a share of real revenue — in a sealed reverse auction: companies offer FD
  // with a minimum price, the cheapest offers fill first, everyone filled is paid
  // the same clearing price, and the FD bought is burned. Unspent budget rolls over.
  // The only way FD becomes dollars in this mode; off unless a run turns it on.
  buyback: {
    enabled: false,
    usdPerWeek: 5_000,
  },

  // Design proposal (Jeff's direction, replacing the spec's separate Season 2
  // token): FD itself becomes buyable and sellable for dollars after a beta. Every
  // number here is an assumption to tune; see TOKENOMICS.md.
  token: {
    enabled: false,
    betaYears: 2, // launch at the end of in-game year 2 (≈6 real months at the live clock)
    // Design decision (Jeff, 2026-10-29): during beta the AI fleet may not grow past this multiple
    // of its starting size (null: no cap). The market stays short of trucks until humans bring
    // them, so the airdrop season rewards early commitment; bots still replace and sell trucks.
    betaAiFleetCap: 1 as number | null,
    // Design decision (Jeff, 2026-10-29; TOKENOMICS.md "The circular economy"): a capped supply.
    // Nothing is minted after genesis. NPC shippers pay carriers out of a reserve that every sink
    // refills (fuel, wages, fees, the profit tax, the launch reset…); only dollars and forfeits burn
    // (buybacks, the sell fee, forfeited airdrop slices, the season-close burn when seasons run).
    // Reference rates follow the reserve against its genesis level: hoarding drains it and lowers
    // rates, spending refills it and raises them. Off by default so the sims can compare both.
    circular: {
      enabled: false,
      capFd: 1_000_000_000,
      // Genesis: the reserve, the launch pool (25M FD at $0.01) and four airdrop seasons (23M);
      // the rest is held by the treasury, unissued.
      shares: { reserve: 0.6, pool: 0.025, airdrop: 0.023 },
      reserveFactor: { exponent: 1, clamp: [0.5, 2] as const }, // rates × (reserve ÷ genesis reserve)^exponent, clamped
      // How much of the profit tax still burns under the cap; the rest refills the reserve. With none
      // burning (runs/v25-a) the price ended $0.0044 against $0.0084 open: the dial Jeff weighs
      // against "deflation only from dollars".
      taxBurnShare: 0.5,
      // Whether the monthly sinks-over-faucets stabilizer may still cut NPC freight volume under the
      // cap (fewer loads in a slump) beside the reserve pricing them lower. runs/v25-d: with rates alone
      // (floor 0.5×) the reserve kept draining ~100M a year after launch.
      volumeStabilizer: false,
      // The balance dial (Jeff, 2026-10-30): what NPC shippers pay per mile moves each month toward the
      // sink-to-faucet target (token.sinkFaucetTargetLive after launch) — down while players as a
      // group take out more FD than the game takes back, up when the game takes too much. A balanced
      // economy pays out what it takes in; what a player earns then comes from other players and
      // from running a better company, not from the reserve.
      // windowDays: the dial reads the ratio over this many days, so a noisy month doesn't flip it.
      rateStabilizer: { enabled: false, stepPerMonth: 0.03, range: [0.5, 1.2] as const, windowDays: 30 },
    },
    launch: {
      // Beta FD is play money: above working capital it's burned at launch, and the
      // working capital kept is locked — it can be spent in the game, not sold.
      keepWorkingCapital: true,
      // The treasury opens an FD/USDC pool (protocol-owned liquidity, never withdrawn)
      // with its own dollars and FD minted at the opening price.
      seedUsd: 250_000, // the spec's placeholder; TODO.md "launch without capital": 0 with the one-sided range below
      // The launch price is what the dollars support (Jeff, 2026-10-29): with dollars on hand (the seed
      // plus the farming season's window), the pool opens two-sided with FD from the pool allocation
      // sized to the float that survives the reset — this share of it, never more than the allocation —
      // and the price is the quotient. A round number launched against thin dollars reads as a crash;
      // the gate is the price holding from launch, and pool dollars growing.
      poolDepthShareOfFloat: 1,
      // A reference price only: the one-sided range's floor when there are no dollars at all, and the
      // farming-season window's dollar pricing (catalogue.usdWindow.referencePriceUsd).
      priceUsd: 0.01,
      // With no dollars at all the treasury posts this much FD alone, and buys never go below the
      // reference price until buyers' dollars have lifted the pool above it (one-sided liquidity).
      liquidityFd: 25_000_000,
    },
    // §Points and airdrop: beta Miles convert pro rata; beta FD never does.
    airdrop: {
      fd: 10_000_000, // minted only as it unlocks
      capShare: 0.01, // no company gets more than 1%; the excess is never minted
      // Design decision (Jeff, 2026-10-29): the pot is split by two pro-rata shares, Miles (play as
      // much as possible) and beta operating profit (play to win: research, pricing, risk), at these
      // weights. Losses score zero. A company shut down (authority revoked) or in liquidation at
      // launch gets nothing: the risk a bad actor runs. The weighting is still to be tuned.
      weights: { miles: 0.6, profit: 0.4 },
      // Design proposal (2026-10-29, TOKENOMICS.md "Airdrop size and a season schedule"): later
      // seasons, one per in-game year after launch, each split by that season's Miles and profit,
      // scaled down by how far the season's average price ran below the launch price, never up.
      laterSeasons: [6_000_000, 4_000_000, 3_000_000],
      atLaunch: 0.25, // §Airdrop unlock: 25% claimable at launch…
      unlockWeeks: 26, // …75% unlocks over 6 months by playing: a 26th each week the company handles…
      loadsPerWeek: 3, // …at least this many loads; a missed week's slice is forfeited, never minted
      instantClaimHaircut: 0.5, // or claim the rest at once for half (the haircut is never minted)
    },
    // Buying pays 1% in dollars to the treasury; selling pays 5% in FD, burned (the
    // spec's 5% protocol cut on secondary sales, §Two ledgers).
    // The whale rules (Jeff, 2026-10-29; TOKENOMICS.md §3): the sell fee rises with the single
    // sale's price impact (fee = base + perImpact × impact, capped), and each company may sell at
    // most this share of the pool's FD a day.
    exchange: { buyFeePct: 0.01, sellFeePct: 0.05, sellFeePerImpact: 1, sellFeeMax: 0.25, dailySellShareOfPool: 0.02 },
    // Design decision (Jeff, 2026-10-29; TOKENOMICS.md §2): staking, the bond behind every licence.
    // Tiers gate company size and roles, never performance; the stake is slashed on revocation;
    // leaving takes the exit queue or an instant haircut, burned. Off until 0.18.0 ships.
    staking: {
      enabled: false,
      truckTiers: [
        [5, 0],
        [10, 20_000],
        [30, 100_000],
      ] as const, // [trucks allowed, stake FD]
      facilityTiers: [
        [1, 0],
        [3, 20_000],
        [6, 100_000],
      ] as const,
      roles: { broker: 75_000 }, // the broker licence stake (the surety premium is still paid on it)
      exitDays: 28, // an unstake waits this long in the queue (one real week at the live clock)…
      exitLimitPerDay: 0.02, // …and at most this share of all staked and exiting FD clears per day
      instantHaircut: 0.25, // or out at once for this much, burned
      graceDays: 14, // over a tier, or a broker under its stake: this long before trucks park and loads stop
      // Staking discounts (Jeff, 2026-10-29): locked FD earns this much off fuel, maintenance, rebuilds,
      // insurance premiums and board fees; [staked FD, discount], the highest tier reached applies.
      discounts: [
        [20_000, 0.05],
        [100_000, 0.1],
        [500_000, 0.15],
      ] as const,
    },
    // The catalogue (Jeff, 2026-10-29; TOKENOMICS.md "FD only"): yards and truck upgrades priced in
    // FD at the launch reference and scaled by the freight rate index; purchase FD half burned, a
    // quarter to the treasury, a quarter to the reserve; yards post a bond. In the farming season
    // only, the same items sell for dollars at a premium, capped per MC, every dollar held for the
    // launch pool. Off until sized.
    catalogue: {
      enabled: false,
      trucksWithoutYard: 5,
      items: {
        yardSmall: { priceFd: 60_000, bondFd: 30_000, trucks: 10 },
        yardLarge: { priceFd: 250_000, bondFd: 100_000, trucks: 30 },
        apu: { priceFd: 12_000 }, // idle fuel halved
        aero: { priceFd: 8_000 }, // 5% less fuel
        tires: { priceFd: 6_000 }, // 20% less maintenance
        sleeper: { priceFd: 10_000 }, // per diem halved
      },
      split: { burn: 0.5, treasury: 0.25, reserve: 0.25 },
      indexBaseRate: 3.0, // a normal market's cleared rate, FD/mi: the index is 1 there
      indexClamp: [0.5, 3] as const,
      usdWindow: { enabled: true, premium: 1.5, capUsdPerMc: 500, referencePriceUsd: 0.01 },
    },
    // Design decision (Jeff, 2026-10-29; TOKENOMICS.md §4): player-funded pools, insurance first.
    // A capitalised pool writes policies cheaper than the NPC insurer and earns the premiums; it
    // pays the insured share of crash verdicts and a player shipper's lost cargo; a thin pool
    // charges more, and below the minimum capital the NPC backstop writes at its own markup.
    pools: {
      enabled: false,
      exitDays: 28,
      exitLimitPerDay: 0.05, // at most this share of a pool pays out a day
      insurance: {
        minCapitalRatio: 0.5, // capital ÷ annual premiums written: below this the pool writes nothing new
        thinMarkup: 1.3, // the pool's price against the NPC base at the minimum ratio, easing to 1 at twice it
        backstopMarkup: 1.25, // what the NPC insurer charges while a pool exists and is too thin
        priceOfBase: 0.8, // the pool aims at a 75% loss ratio where the NPC market aims at 60%: its base price is this much of the NPC's
        deductibleStake: true, // a pool-written policy locks the deductible per truck for the term; it pays the deductible on a claim
      },
      // Factoring: capital ÷ invoices outstanding; the discount is payment.factoring.discountPct × the markup.
      factoring: { minCapitalRatio: 0.2, thinMarkup: 1.5, backstopMarkup: 1.4 },
      // Surety: capital ÷ bonds written; the bond premium (permits.suretyPctPerYear) × the markup goes to the pool.
      surety: { minCapitalRatio: 0.1, thinMarkup: 1.3, backstopMarkup: 1.25 },
    },
    // Design decision (Jeff, 2026-10-29; TOKENOMICS.md §4): payment terms. Freight is paid net-30
    // game days; a payee may take quick pay for a fee or factor the invoice (the pool, or the NPC
    // factor as the dearer backstop). Carriers run on working capital, as real ones do. Off until
    // 0.18.0 ships: with it off every payment posts on delivery as before.
    // Jeff's numbers (2026-10-29): quick pay is an emergency tool at 10%; factoring is a one-year
    // contract with a stake behind it (two weeks of invoices by the fleet), priced by whose paper it
    // is, forfeited on an early exit; the NPC lessor pays its leased trucks on delivery so the free
    // path runs on no working capital; everyone else is capitalised or signs.
    payment: {
      enabled: false,
      termsDays: 30,
      quickPayPct: 0.1,
      factoring: {
        discountNpc: 0.04, // an NPC shipper's paper, per 30-day invoice (× the pool's markup, or × pools.factoring.backstopMarkup at the NPC factor)
        discountPlayer: 0.06, // a player broker's or shipper's paper
        termDays: 365,
        earlyExitForfeits: true,
        stakePerTruckFd: 15_000, // about two weeks of a truck's invoices
        stakeBrokerFd: 50_000,
      },
      lessorPaysOnDelivery: true,
    },
    // Credit ratings (Jeff, 2026-10-29; credit.ts): a 0–100 score the game computes from the ledger.
    // base + recordPoints × the share of invoices paid with cash in hand (a new licence is assumed
    // middling), + agePoints over ageYears of licence, − claimPoints per unpaid claim on record,
    // − bankruptcyPoints and − revocationPoints each, − coveragePoints when stake and cash cover
    // less than coverageMin of the invoices owed. Bands: A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 35, E below.
    credit: {
      base: 40,
      recordPoints: 40,
      newRecord: 0.5,
      agePoints: 20,
      ageYears: 3,
      claimPoints: 10,
      bankruptcyPoints: 15,
      revocationPoints: 20,
      coverageMin: 0.5,
      coveragePoints: 10,
      strongScore: 80, // no premium at or above this…
      premiumMax: 0.2, // …rising to this at zero: on a carrier's ask, on the factoring discount, on the surety premium
      minForCarriers: 35, // a carrier's default floor: no E paper
    },
    treasury: {
      // Stand-in for real revenue other than exchange fees: cosmetics, premium,
      // asset sales (§Two ledgers — primary sales go to the developer), per active company per week.
      productUsdPerCompanyWeek: 0, // Jeff (2026-10-29): no flat fee, no dollar sales at all after launch; the developer's revenue is the treasury's FD, vested below
      // The developer's FD, vested (TOKENOMICS.md "FD only"): after the cliff, at most this share of the
      // treasury's holdings sold into the pool a week, never in a week the price averaged below the launch
      // price, and never more than leaves the pool at or above it after the sale.
      // Jeff (2026-10-29): a quarter of a percent at most, only above the TGE price — as little sell
      // pressure as the game can carry, for as long as it can.
      vest: { cliffWeeks: 26, perWeekShare: 0.0025 },
      buybackShare: 0.5, // §Burn and buyback: half of revenue buys FD back (all of it burned here); half runs the company
    },
    lockGrants: true, // after launch, starting grants are spend-only (sybils can't cash them out)
    // Keep the holding cost after launch: it's the sink that falls on hoards rather
    // than on operators' margins. Without it, operations sank only ~93% of faucets
    // and the surplus was sold into the pool (TOKENOMICS.md — what the runs showed).
    holdingCostAfterLaunch: true,
    sinkFaucetTargetLive: [1.0, 1.04] as const, // operations net-deflationary after launch
    // How far the stabilizer may cut NPC freight after launch (beta keeps stabilizers.volumeRange).
    volumeRangeLive: [0.75, 1.5] as const,
    // The main deflation lever after launch: 40% of each company's positive weekly
    // operating result (freight and facilities) is burned; loss-making weeks pay
    // nothing. On test seeds it shrank supply as much as squeezing freight volume
    // did, with fewer liquidations (TOKENOMICS.md).
    // Jeff (2026-10-29): "those taxes are insane" — a corporate-tax band instead. 20% to start,
    // moved by the stabilizer only within 10–30%; the first 5,000 FD of a week's profit is exempt.
    // Deflation is to come from the capped economy's locks, stakes and sinks, not from the tax.
    profitTaxRate: 0.2,
    profitTaxAllowanceFd: 5_000,
    // After launch the profit-tax rate is the first stabilizer: each month it moves
    // 5 points toward the sink target, within 20–70%. NPC freight volume moves only
    // once the rate is pinned at a limit — so the sink grows with the economy (more
    // players, more freight, more profit taxed) instead of starving operators of loads.
    taxStabilizer: { enabled: true, stepPerMonth: 0.05, range: [0.1, 0.3] as const }, // was 20–80%, pinned at 70–80% in every 4-year run
    // New players after launch: a base rate that rises when the price has been
    // rising and falls when it's been falling (a stand-in for hype).
    // usdWalletMult scales the dollars newcomers arrive with: the demand lever the runs sweep, since the
    // sim can't know how much real buying shows up (the report prints the buying that holds the price).
    newCompanies: { perWeek: 2, hypeSensitivity: 2, hypeRange: [0.25, 3] as const, lookbackDays: 28, usdWalletMult: 1 },
    // NPC freight grows with the carrier base, so newcomers don't just crowd the same
    // loads. On its own it sank the price (more freight, more FD profit sold); with
    // the tax stabilizer below, the sink grows with it.
    demandScalesWithCarriers: true,
  },

  // PoC assumption (design proposal): a share of Workhorse tractors and dry vans is
  // held back for companies buying their first owned truck, so large fleets can't
  // absorb the whole capped supply and close the free path.
  starterReserveShare: 0.35,

  // §Owned vs. leased — company caps and truck ladder
  company: {
    maxTrucks: 30,
    maxTrailers: 36,
    startingGrantFd: 5_000, // §Circular economy — faucets
    // The Miles truck ladder (100/90/80/70/60%, then 50%) is gone (Jeff, 2026-10-29): every wallet is an
    // MC, and a ladder paid splitting a fleet across wallets. Miles are flat per loaded mile.
  },

  // §Points and airdrop
  miles: {
    onTime: { late: 0.5, onTime: 1.0, early: 1.2 },
    marginTarget: 0.25,
    marginClamp: [0.5, 1.2] as const,
    reputationRange: [1.0, 1.5] as const,
    brokerPerMile: 0.15,
    dailyCapPerCompany: 3_000, // PoC assumption: spec says "daily cap" without a number; ≈10 ladder-weighted trucks
    maxLoadsPerLanePairPerDay: 3,
    rateOutlierPct: 0.4,
  },

  // PoC assumption: reputation model. Bid-scoring reputation is a smoothed
  // on-time rate; the Miles factor rises with level (§Points).
  reputation: {
    start: 0.85, // new companies start near the pack so the first bids are winnable
    priorLoads: 10, // a new company counts as 10 loads at `start`
    maxLevel: 20,
    loadsPerLevelSq: 5, // level = floor(sqrt(delivered / 5))
  },

  // §Circular economy — targets and stabilizers
  stabilizers: {
    sinkFaucetTarget: [0.9, 1.0] as const,
    // PoC assumption (design proposal): without seasons nothing resets the money
    // supply, so a target below 100% means it grows every year by whatever share
    // isn't sunk. Aim at 100%.
    sinkFaucetTargetWithoutSeasons: [0.97, 1.03] as const,
    volumeStepPerMonth: 0.1,
    // PoC assumption: bounds on the volume dial. Less freight works as a stabilizer
    // because carriers then compete on price, so less FD is created per load.
    volumeRange: [0.75, 1.5] as const,
    rackSpreadBand: 0.05,
    rackStepPerMonth: 0.01,
  },

  // §Proof of concept scope and kill criteria
  killCriteria: {
    sinkFaucetPerQuarter: [0.9, 1.0] as const,
    maxSupplyGrowthPerYear: 2.0,
    maxStrategyVsMedian: 3.0,
    freePathMaxDays: 84,
  },

  // NPC capacity that keeps thin hubs trading (§World — NPC freight and trucks)
  npc: {
    trucksPerHubWeight: 6, // PoC assumption
  },

  // Design proposal (Jeff, 2026-10-28): staff. Every truck needs a driver, and the
  // owner drives one truck and dispatches up to three; hired dispatchers take the
  // rest. Skill runs 0–1 (shown as 1–5 stars) and moves costs and risk around 0.5;
  // it comes from hiring (market pay rises with skill) and from experience. Staff
  // quit when underpaid or pushed to break the rules, and other companies can poach
  // them. Every number is an assumption to tune in simulation.
  labor: {
    driver: {
      payPerMile: [0.62, 0.92] as const, // market pay at skill 0 and 1; ≈0.75 (the old flat wage) at the pool's typical 0.43
      mpgRange: 0.2, // mpg × (1 + 0.2·(skill − 0.5)): ±10%
      maintRange: 0.4, // maintenance and breakdowns × (1 − 0.4·(skill − 0.5)): ±20%
      mphRange: 0.1, // speed ±5%
      crash: [1.6, 0.4] as const, // crash odds multiplier at skill 0 and 1
      learnMiles: 300_000, // skill closes (gap to potential) × miles / this
      teamPayShare: 0.6, // each driver of a team earns 60% of their rate on every mile the truck runs
      perDiemFd: 30, // a layover: what a driver costs the company for each full day a truck sits idle away from the home hub (the first day is a night in the cab; on the road, wages cover it)
    },
    dispatcher: {
      payPerWeek: [500, 1_900] as const, // quoted for a full span; billed for the trucks they actually run (labor.payDispatchers)
      span: [5, 18] as const, // trucks one dispatcher can run
      noise: [0.06, 0.01] as const, // σ of pricing mistakes: an inexperienced dispatcher misreads costs by ~6%
      reloadAware: [0.7, 1.2] as const, // × board.reloadWeight: how much of the empty run out of the destination they price in
      foresightDays: [0, 42] as const, // how far ahead on the season curves they position trucks
      lookaheadLoads: [1, 3] as const, // how many loads ahead they weigh a destination's market
      learnLoads: 1_500,
    },
    owner: {
      span: 3, // the first three trucks: the same three that pay no fleet overhead
      driverPayPerMile: 0.75, // the owner's draw when driving their own truck: fixed, never quits or gets poached
      botSkill: [0.3, 0.7] as const, // AI owners average a typical driver
      humanSkill: 0.3,
      potential: 0.9,
    },
    // Managers (Jeff, 2026-10-29; TODO.md 12, first form: a salaried post, not yet a person from the
    // pool). Past `requiredAbove` operating trucks a fleet needs them: without an operations manager
    // its dispatch prices worse (noise up, less lookahead); without a maintenance manager it breaks down
    // more. With them: tighter pricing, fewer breakdowns, leaner maintenance. Pay is weekly, a sink.
    // Jeff (2026-10-30, Phase A): managers are people from the labor pool, hired like dispatchers (skill,
    // asking pay, poaching, morale, learning by the week). An operations manager is a must past four
    // trucks — one runs up to `span` trucks beyond that, and trucks over the cap park after the grace
    // period (staking.ts), like a stake tier. The edge scales with the best manager's skill: at skill 1
    // the full `noiseWith` / `crashMult` / `pullInMult` / `pushedPenaltyMult` / `skillBonus`, at 0 none.
    // Hire one at any size. Pay is quoted per week at skill 0 and 1, like a dispatcher's.
    managers: {
      enabled: false,
      ops: { payPerWeek: [1_000, 2_500] as const, requiredAbove: 4, span: 25, learnWeeks: 150, noiseWithout: 1.5, noiseWith: 0.7, crashMult: 0.9, pullInMult: 0.9, pushedPenaltyMult: 0.5, skillBonus: 0.08 },
      maint: { payPerWeek: [800, 2_000] as const, requiredAbove: 10, span: 25, learnWeeks: 150, breakdownWithout: 1.3, breakdownWith: 0.8, maintenanceWith: 0.9 },
    },
    pool: {
      startDrivers: 450,
      startDispatchers: 120,
      startOpsManagers: 30,
      startMaintManagers: 30,
      targetShare: { driver: 0.1, dispatcher: 0.25, opsManager: 0.25, maintManager: 0.25 }, // the pool aims at this share of employed staff…
      minTarget: { driver: 40, dispatcher: 10, opsManager: 5, maintManager: 5 },
      fillShare: 0.5, // …closing this much of the gap (plus open seats) each week with new entrants
      baseEntrants: { driver: 3, dispatcher: 1, opsManager: 0.3, maintManager: 0.3 },
      rookieSkill: [0.02, 0.3] as const,
      veteranShare: 0.3, // entrants coming back to the industry with experience
      veteranSkill: [0.3, 0.85] as const,
      potential: [0.35, 1.0] as const,
      retireWeekly: 0.0015,
      slackAttrition: 8, // × retireWeekly for people in the pool while it's slack: they leave the industry
      personal: [0.95, 1.08] as const, // what each person asks over market pay
    },
    // The market wage moves with the pool: a thin pool (a driver shortage) pushes pay up.
    wageIndex: { range: [0.92, 1.15] as const, stepPerMonth: 0.015, tightPool: 0.05, slackPool: 0.15 },
    morale: {
      start: 0.65,
      payWeight: 2.0, // target morale = 0.6 + 2 × (pay ÷ market − 1) …
      pushedPenalty: 0.35, // … − this when the company runs illegal hours or speed, × integrity
      wornTruckPenalty: 0.1,
      badRatingPenalty: 0.1,
      tenurePerYear: 0.05,
      tenureCap: 0.15,
      adjust: 0.35, // weekly step toward the target
      quitBase: 0.003, // weekly quit odds = base + slope × max(0, 0.5 − morale)
      quitSlope: 0.09,
      loyalty: [0.04, 0.2] as const, // the raise it takes to poach, from morale 0 to 1
      noticeDays: 2, // the employer has this long to match an offer
      unseatedWeeks: 2, // a driver left without a truck this long walks
    },
    // Hiring away costs a sign-on bonus up front; letting someone go soon after hiring costs severance;
    // a matched offer that's cut back within the hold period sends the person packing.
    hiring: { signOnWeeks: 2, severanceWeeks: 2, severanceWithinDays: 28, matchedPayHoldDays: 56, milesPerWeek: 1_000 },
  },

  // Design proposal (Jeff, 2026-10-28): safety and compliance. Owners choose how
  // legal to run; enforcement, crashes and audits make cutting corners pay now and
  // cost later. Modeled on FMCSA's CSA BASICs, roadside inspections and ratings.
  safety: {
    hos: { overHours: 4, teamHours: 22 }, // illegal: 15 driving hours a day on falsified logs; a team runs 22 legally
    speed: { fastMph: 56 },
    maintenance: {
      deferredCostMult: 0.55, // skipping preventive maintenance saves ~45% of it…
      defectPer1000Mi: { full: 0.01, deferred: 0.12 }, // …and brakes, tires and lights go bad (one every ~8,000 miles)
      fixFdPerDefect: 350,
      breakdownPerDefect: 0.15,
      crashPerDefect: 0.12,
      knowinglyUnsafeDefects: 3, // running this many known defects counts as willful
    },
    crash: {
      per1MMi: 0.3, // a typical legal truck: with the risk factors, ≈0.4 crashes per million miles overall (US large trucks ≈0.3–0.5)
      fatiguePerOverHour: 0.3,
      fastMult: 1.5,
      injuryShare: 0.25,
      fatalShare: 0.03, // ≈0.015 fatal per million miles overall
      fatalWorseMult: 1.6, // fatigue or speed makes a crash deadlier
      atFault: 0.45,
      atFaultWithViolation: 0.9,
      truckRepairFd: { pdo: [2_000, 8_000] as const, injury: [8_000, 20_000] as const },
      downDays: { pdo: [1, 3] as const, injury: [3, 7] as const }, // a fatal crash totals the truck
      settlementFd: { pdo: [5_000, 25_000] as const, injury: [60_000, 400_000] as const, fatal: [1_000_000, 5_000_000] as const },
      negligenceMult: [2, 4] as const, // juries punish crashes with violations behind them
      insuranceLimitFd: 1_000_000,
      deductibleFd: 5_000,
      cargoDeductibleFd: 2_500,
      leasedTotalLossFd: 6_000, // owed to the lessor for a leased truck written off
      surcharge: { pdo: 0.25, injury: 0.6, fatal: 1.5 }, // insurance premium multiplier added per at-fault crash…
      surchargeDecayPerMonth: 0.05, // …shrinking 5% a month
      driverKilled: 0.15,
    },
    enforcement: {
      stationRadiusMi: 25, // a weigh station within this of the route is on it
      stationOpen: 0.6,
      pullIn: { clean: 0.05, alert: 0.35, conditional: 0.5, unsatisfactory: 0.7, newEntrant: 0.2 },
      inspectShare: 0.25, // pulled in: weighed, then inspected this often
      levels: [0.3, 0.3, 0.4] as const, // level 1 (full), 2 (walk-around), 3 (driver and logs)
      policePer1000Mi: 0.025,
      fastStopMult: 3.5,
      speedingTicket: 0.85,
      stopInspect: 0.4,
      logDetect: 0.5, // an inspection finds a falsified log day this often…
      recentLogDays: 8, // …within this window
      defectDetect: 0.7,
      defectOos: 0.5,
      fines: {
        speeding: [150, 500] as const,
        falseLog: [500, 2_500] as const,
        hosOos: [500, 1_500] as const,
        defect: [100, 500] as const,
        tracked: 1_000, // a shipper's tracking shows illegal hours
      },
      oosRepairFd: [400, 1_500] as const,
      oosHours: { hos: 10, defect: [4, 12] as const },
      points: { falseLog: 10, hos: 7, speeding: 5, defect: 4, crash: { pdo: 1, injury: 2, fatal: 3 } },
    },
    score: {
      // BASIC measure = time-weighted points ÷ (time-weighted inspections + prior); weights 3/2/1 for ≤180/≤365/≤730 days
      inspectionPrior: 2,
      thresholds: { hos: 5, unsafe: 4, maintenance: 6, crash: 1.5 }, // crash: time-weighted severity per truck
    },
    review: {
      newEntrantDay: 90, // the new-entrant safety audit
      alertsToReview: 2,
      alertCooldownDays: 180,
      rereviewDays: { conditional: 90, unsatisfactory: 45 },
      hiddenDetect: 0.35, // an audit finds each falsified log day or deferred-maintenance week this often
      fines: { falseLogDay: 1_000, maintenanceWeek: 300 },
      finesCap: 60_000,
      conditionalAt: 3,
      unsatisfactoryAt: 10,
      surchargePerFinding: 0.03, // each falsified log day or deferred-maintenance week found adds this to the insurance surcharge…
      surchargeCap: 1.5, // …up to this
    },
    // Shutdowns. Authority revoked, the fleet wound down, then a bar on the account
    // before it may file again: longer the worse the cause, permanent after repeat crimes.
    bars: { unsatisfactory: 30, imminentHazard: 180, fraud: 90, criminal: 365, jail: 365 },
    permanentAfterCrimes: 2,
    hotLoads: {
      share: 0.04,
      minMiles: 700, // long enough that one legal driving day (550 mi) can't make the window
      premium: [1.6, 2.2] as const,
      hoursPerDay: 15, // the window assumes 15 driving hours a day: illegal solo, easy for a team
      slackMinutes: 120,
      lateKeepsPremium: 0.5, // late, the shipper pays half the premium
      equipmentShare: { van: 0.3, reefer: 0.5, flatbed: 0.2 } satisfies Record<Equipment, number>,
    },
  },

  // Design proposal (Jeff, 2026-10-28): insurance on one-game-year contracts (insurance.ts).
  // A policy is priced at signing and at each renewal per truck on the road, billed
  // weekly: a base rate × the company's risk (safety rating, alerts, crash history,
  // a new authority, a long clean record) × its home hub's garaging factor × the
  // insurance market, which hardens after a year of heavy claims and softens after
  // a light one. A serious at-fault crash or a bad rating makes the insurer
  // re-write the policy on the spot.
  insurance: {
    baseAnnualPerTruck: 4_200, // ≈ the old 0.08 FD per loaded mile on a typical truck, after the starter hubs' ~1.15 average garaging
    loadedMilesPerYear: 52_500, // dispatchers spread the premium over this many loaded miles in break-even
    termDays: 365,
    rating: { none: 1.25, satisfactory: 1, conditional: 1.5, unsatisfactory: 2.5 },
    perAlert: 0.15,
    cleanDiscount: 0.9, // no crashes or alerts and authority at least this old:
    cleanYears: 3,
    clamp: [0.7, 4] as const,
    // The insurers' loss ratio (claims they paid ÷ premiums, trailing 12 months) against a target
    // moves the market index a few points a month.
    market: { targetLossRatio: 0.6, gain: 0.15, stepPerMonth: 0.03, range: [0.85, 1.4] as const }, // step = gain × the loss-ratio gap, capped
  },

  // Design proposal (Jeff, 2026-10-28): home markets (home.ts). A starter hub's crowding is the
  // carriers based there ÷ its fair share of all carriers by freight volume. Loads from within the
  // nearby radius of home get a bid-score edge, larger where fewer carriers share the hub; and a
  // home base pays yard rent per truck, dearer in big metros and in crowded ones.
  homeBase: {
    preference: 0.04, // bid-score edge at a fair share (≈ bidding 7% higher and still tying)
    preferenceClamp: [0.25, 2] as const, // × 1 ÷ crowding
    yardPerTruckWeek: 20, // each truck past the first: an owner-operator parks free
    yardTier: [0.6, 0.3] as const, // metro factor = 0.6 + 0.3 × hub weight (Chicago 1.5, Miami 1.08)
    yardCrowdClamp: [0.6, 2] as const, // × crowding
  },

  // Design proposal (Jeff, 2026-10-28): dealer prices follow supply and demand. Each month
  // every tractor tier and trailer type moves a third of the way toward a target set by the
  // dealer's order backlog and how much of its supply is left. Used values move with them.
  dealerPrices: {
    backlogWeight: 0.4, // + this × (lead time over base ÷ base, up to 1)
    scarcityWeight: 0.35, // + this × (scarceBelow − share of supply left), within −0.15…+0.35
    scarceBelow: 0.15, // with 1,800 tractors mostly owned, 0.25 was never cleared and prices only rose
    stepShare: 1 / 3,
    range: [0.85, 1.3] as const,
  },

  // Design proposal (Jeff, 2026-10-28): fraud — double brokering and freight theft,
  // against players and AI alike — and the vetting brokers and shippers do to avoid it.
  fraud: {
    // Players may take the same bad-actor actions as the AI (Jeff, 2026-10-28). False locks
    // an illegal policy, re-brokering and theft to AI companies (actions.ts refuses them from a player).
    players: true,
    cargoMultiple: { npcDirect: 1.5, van: 6, reefer: 7, flatbed: 4, hot: 1.5 }, // cargo value ÷ the freight bill
    // Vetting tiers a poster can require: 0 open (anyone), 1 standard, 2 strict (tracking required).
    vetting: {
      standard: { minAuthorityDays: 30 },
      strict: { minAuthorityDays: 90, minDelivered: 25, orAuthorityDays: 365, revokedLookbackDays: 365 },
    },
    botBrokerVetting: [0.2, 0.4, 0.4] as const, // share of AI brokers posting open / standard / strict
    theft: {
      fenceShare: 0.3, // a fence pays 30% of cargo value — only once the case goes cold
      fenceCut: 0.2, // paid out of a broker's escrowed claim, the fence keeps this share (burned)
      brokerClaimShare: 0.1, // the broker on a stolen load pays this share of its value (negligent selection); at 0.3 a theft paid more than the haul
      caught: { base: 0.55, tracked: 0.3, established: 0.15, establishedDays: 180 },
      investigationDays: [5, 20] as const,
      claimDays: 365, // an open theft claim follows the carrier this long
    },
    doubleBroker: {
      detect: { paid: 0.15, unpaid: 0.9 },
      investigationDays: { paid: [5, 30] as const, unpaid: [3, 10] as const },
      fineFd: 5_000,
      spreadMult: 2,
      suspensionDays: 30,
    },
  },
} as const;

/** Numbers widened so tests and the planner can build variant configs. */
type Widen<T> = T extends number
  ? number
  : T extends boolean
    ? boolean
    : T extends string
    ? T
    : T extends object
      ? { readonly [K in keyof T]: Widen<T[K]> }
      : T;

export type EconomyConfig = Widen<typeof economyConfig>;
