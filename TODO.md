# LANES to-do (kept current; last edit 2026-10-31)

Order is the working order. Design records live in TOKENOMICS.md (economy) and README.md (what shipped).

## Shipping 0.17.0 — the real market (committed on main, not yet live)
1. ✅ Ten-seed release run (runs/v24-c). Partial runs without the AI cap (v24-a, 4 seeds) and with
   freight at 300 (v24-b, 8 seeds) survived an interrupted batch.
2. ✅ Compared against 0.16.0 (runs/compare-v24.md, README "A real market"): the launch and the free
   path survive; beta FD balloons, brokers bleed on fall-offs, the FD price ends lower — the
   post-launch economy is reworked in 0.18.0.
3. ✅ Pushed (main 69c7570), live artifact version 23, world/meta version 14 on
   `lanes-live-1/0.17.0-phase0.23`, graphics session told to republish its client work on top.

## Building 0.18.0 — the circular economy (all behind config switches until sized)
4. ✅ Reserve ledger: cap minted at genesis, faucets draw on the reserve, sinks refill it, rates follow it.
5. ✅ Staking: tiers for trucks and facilities, broker licence stake, slashing, exit queue, instant haircut;
   the whale rules on the exchange (impact-scaled sell fee, daily sell limit).
6. ✅ Insurance pool (pools.ts): pool-written policies at a capital-ratio markup, premiums to the pool,
   crash and cargo claims paid from it, exit queue, depositor bots.
7. ✅ Payment terms and factoring (receivables.ts): net-30 for NPC shippers, brokers and player shippers;
   quick pay at 10% (an emergency tool); factoring as a one-year contract with a stake behind it (two
   weeks of invoices by the fleet, 50k for a broker), 4% on NPC paper and 6% on a player's × the pool's
   markup, forfeited on an early exit; the NPC lessor pays leased trucks on delivery so the free path
   needs no working capital; bots sign when short and able. ✅ Surety line: the pool carries broker
   bonds while capitalised and covers a wound-up broker's carrier up to the bond per broker.
   ✅ Insurance: a pool-written policy locks the deductible per truck and pays it from the stake on a
   claim; the pool aims at a 75% loss ratio. Contract stakes go to the pool first on liquidation.
   Later: recourse on fraud-voided invoices, equipment finance, fuel hedge.
8. ✅ Airdrop seasons (6 / 4 / 3M after the 10M launch pot, scaled down when the season's price ran below
   launch). Still to do: the unlock boosts (achievements, FD-burning shop items) once the client has a shop.
9. Ten-seed runs with circular + staking + pools + payment on (runs/v25-*): size the cap, reserve share,
   payout fraction, tier stakes, exit limit, sell-fee slope, pool capital ratios; kill criteria in
   TOKENOMICS.md §5.
10. One restart while the world has no players.

## Next layers (Jeff, 2026-10-29) — sinks, realism, management
11. **Maintenance as a market.** Truck shops, trailer shops, tire shops and road service as places
    with regional prices and their own supply and demand (a busy shop quotes more and books later;
    a thin region has one shop and it knows it). Repairs at the home base cheaper than on the road;
    road service dearer still (tow + call-out). Tires as a wear item with regional prices. Parts lead
    times. Player-owned shops later, on the same pattern as fuel stations and truck stops (§1 of the
    circular plan). Every one of these is a sink that refills the reserve: add as many as the
    realism supports.
12. **Managers for fleets.** Two new staff kinds: an **operations manager** (automates dispatch
    policy, repositioning, home time, fuel stops) and a **maintenance manager** (schedules service by
    wear and location, chooses shops, keeps the truck at home for the big jobs). Skill = negotiating
    power: discounts at shops, dealers, tire and fuel vendors that grow with volume and the manager's
    level; salaries are a sink. Hiring them is a tier privilege for fleets.
13. **Terrain and weather risk.** Altitude, mountain grades and weather on the actual road route
    change fuel burn, speed, breakdown and crash odds, tire and brake wear; winter closures and chain
    laws on passes; heat on reefers. The road graph already carries route geometry and winter risk
    flags: extend with elevation per edge (public DEM) and per-route weather feeds.
14. **Authoritative server before real money**, then the settlement layer from audited standards on
    Solana (Jeff, 2026-10-31: not an EVM chain; 2026-11-01: "keep the token simple", "a clean token when
    it's out of the game"): a plain SPL token (the cap minted at genesis, the mint authority revoked, no
    freeze authority, no Token-2022 extensions, no custom pool, no transfer hook, no allow list), listed
    in a standard pool (Meteora DAMM v2 or Raydium CPMM) as protocol-owned liquidity; the opening auction
    (a Metaplex Genesis auction or a Meteora Alpha Vault: verified bidders, a per-person cap, the tranche
    at one clearing price, every dollar into the pool); the pool's own decaying launch fee as the only
    on-chain brake; standard time-locked vesting for the treasury; one small audited bridge with a
    bounty. The bridge is the one place the game enforces anything (TOKENOMICS.md "Settlement on
    Solana"): the farmed-FD tax, the daily limits, the logbook's locks, holds on open cases and slashing
    all apply when FD leaves the game; outside it FD is a plain token. No hard price band.

## Launch without capital (Jeff, 2026-10-29): no outside money, no presale, no bundle
15. **Protocol-owned one-sided liquidity.** At launch the treasury allocation posts FD-only liquidity
    (a range order above the launch price); the dollar side builds from buyers and stays as POL.
    Model it in the sim: `launch.seedUsd` 0 with the launch price as the floor for buys, the day-one
    airdrop claim at 10% (`airdrop.atLaunch`), the daily sell limit at 1% of the pool; same ten seeds.
16. **No dollar purchases, ever (Jeff, 2026-10-29).** Dollars enter only by buying FD from the pool;
    the 1% buy fee funds buybacks. Cosmetics, vanity MC numbers and named places are FD too. The
    developer's revenue is the treasury's FD, sold on a published vesting schedule (TOKENOMICS.md
    "FD only"). No flat per-company fee, ever.
17. **Never:** a dev-bundled launch or a pump-style curve (reads as a rug, is manipulation, does not
    fit the reserve design, puts the economy in one hot wallet). Allocations published and in
    audited vaults and vesting contracts; the dev allocation vests like anyone's.

## The launch price and the lean launch (Jeff, 2026-10-29; built, on main, behind the 0.18.0 switches)
- **Done:** the launch price is seed dollars ÷ pool depth (`launch.poolDepthShareOfFloat` of the float,
  from the pool allocation), buyers pay the pool's price two-sided; stakes, exit queues and contract
  stakes burn at the reset like wallets; the IFTA-style fuel tax (`costs.fuelTax`, monthly on gallons
  burned); `token.newCompanies.usdWalletMult` as the demand lever and the report's break-even line;
  the vest capped at what the pool absorbs above the launch price. TOKENOMICS.md "The launch price…".
- **Done (2026-10-29, "the big sinks"):** a national sales tax on every purchase (`costs.salesTax`);
  shops, truck stops and fuel stations as player businesses (`businesses`: FD price through the
  catalogue split + staked bond + weekly upkeep); the maintenance market through shops (11, first
  form: price against the NPC list, parts a sink); operations and maintenance managers as salaried
  posts (12, first form); the vest at 0.25%/week above the TGE price. TOKENOMICS.md "The big sinks".
- **Done (2026-10-30):** truck stops as interstate sites (`businesses.sites`, traffic-priced, fuel +
  shop + parking), the 400-mile fuel rule, rests at stops, road service for breakdowns on the road,
  operations managers required past four trucks with the crash / pull-in / morale / skill edge, the
  balance dial on NPC rates (`token.circular.rateStabilizer`). TOKENOMICS.md "Truck stops on the
  interstates".
- **Sizing (v33-a, 2026-10-30):** with 454 sites and 100 open, bots build ~22 truck stops a seed; they
  serve 15% of breakdowns (hub shops 8%, NPC road service 76%) and clear ~20k FD a year on a ~224k
  purchase. More stops need a shorter payback: a bigger call-out share, rests priced higher, or a
  cheaper site; and the open count should follow coverage, not only the fleet.
- **Parking (Jeff, 2026-10-30, built; ruleset 0.18.2-phase0.26):** sleep only at sites — every site a
  free public rest area with spaces by traffic, a player's truck stop the paid, powered option with a
  price the owner sets and spaces to buy; the shoulder illegal unless broken down (a patrol ticket,
  a sink); drivers plan the night at the last site with room the hours reach; full sites send them on.
- **Phase A (Jeff, 2026-10-30, built; ruleset 0.18.1-phase0.25):** truck stops sized to get built (150k +
  50k bond, 20 a night, call-out 400 + 6/mi) and the open-site count following coverage; managers as
  people from the labor pool (skill-scaled edge, weekly pay); terrain and weather on the route (13:
  ETOPO1 grid, climb in fuel and rates, mountain speed, breakdown and crash odds, winter pass closures). A per-state fuel tax was considered and dropped: as a sink it
  equals the flat tax, and the routing choice it would create has nowhere to be made until routes
  can be compared on cost; it may return with the border work. Later: the client panels and the
  sites on the map; a fuel tank model if the block rule proves too coarse.

## Items, upgrades and yards (Jeff, 2026-10-29)
18. **Yards.** More than 5 trucks needs a yard; a yard costs dollars and a staked FD bond, sized by
    capacity (small 6–10, large 11–30). Yard upgrades: fuel tank (cheaper diesel at home), shop bay
    (cheaper repairs at home; the maintenance market's home-base price), secure parking (theft risk
    down, no per diem at home), dispatch office (a manager's seat). Yard upkeep stays an FD sink.
19. **Truck and trailer upgrades.** APU (idle fuel down), aero kit (mpg up), premium tires (wear
    down), sleeper (per diem down), telematics (better dispatch information), reefer unit, lift
    gate. Each an item on the truck, with upkeep in FD.
20. **FD only, with bonds and the split.** Every item, upgrade, yard, shop, station and cosmetic is
    priced in FD against the launch reference, scaled by the freight rate index; assets carry a
    staked bond; purchase FD goes half burned, a quarter to the treasury, a quarter to the reserve.
    Staking discount tiers (5 / 10 / 15% off fuel, repairs, insurance, fees) sized on the runs.
    Treasury vesting (26-week cliff, ≤0.5%/week, never below the launch floor) modeled as sell
    pressure. Bots buy with FD; no dollar path exists.

## Switch-on (2026-10-30, Jeff: "get it done")
1. **Done:** the live levers in `packages/config/src/live.ts`; ruleset `lanes-live-1/0.18.0-phase0.24`;
   the client and the sim's default profile run them.
2. **Done (2026-10-30):** the live world restarted on the new ruleset (world/meta version 15, seed
   946038761) and the live page republished at version 31 from main fe4c0a6 with the painted assets.
3. **Done (2026-10-30):** Phase A (0.18.1: terrain, managers from the pool, truck stops resized) and
   parking (0.18.2: rest areas by traffic, the night at a site or a ticket on the shoulder); world/meta
   version 17, live page version 33.

## The sequence, learning from EVE Online (Jeff, 2026-10-30: "do it as you have laid out")
What EVE gets right and Lanes copies: destruction is a main sink, players make almost everything,
hauling and regional price differences are the money engine, risk scales with reward, faucets and
sinks are tracked and published every month, and real money meets game money only through a fair
market (PLEX; here, FD through the pool). The last batches before this plan: buying new trucks sank
29M FD in four years against 472M of fuel and 525M of wages, 15 cargo thefts in 775,000 deliveries,
and the NPC dealer sold every new truck.
1. **The trailer pass with risk corridors** (one restart): the reefer unit's fuel, flatbed securement,
   tarping and weather damage, weight in fuel and on grades, receiving hours (grocery and cold chain by
   appointment at any hour, dry van first come in weekday business hours, flatbed in daylight, waiting
   at the gate), driver pay by trailer; cargo theft by place (CargoNet's hotspots), by what is aboard
   and by where the truck sleeps (shoulder worst, rest area, a truck stop's security best); the risk in
   shippers' rates and in insurers' prices.
   - **Dock hours, revised (Jeff, 2026-10-31):** dock-aware dispatch barely moved the waits (14.1 → 13.0 hours on
     four seeds), because trucks arrive at all hours and dry-van docks were open 60 hours a week. Now the
     bigger dry-van docks ship and receive around the clock (the 137 biggest places, every major metro,
     which handle half of all dry-van stops) and the rest keep weekday business hours, 7am to 7pm
     (`docks.fcfsAroundTheClockShare` 0.5, `docks.hours.fcfs` 7–19). Ruleset 0.18.4-phase0.28.
     **Live since 2026-10-31** (world/meta version 19, live page version 35). In batch v41-a, against
     the 0.18.3 rules on the same four seeds, trucks spent about 30% fewer hours waiting (13.0 → 10.9
     hours a wait, 16% fewer waits). Liquidations rose from 760 to 884 and the year-one rate fell 2%.
     The end price rose 13% (`runs/compare-v41-a.md`).
2. **The degen and bear-case batches**, bots only: momentum traders, airdrop farmers at 30% of players,
   sybil clusters, a whale, a listing-day crowd, against the vesting, the sell limits and the thin pool;
   fixes that scale sinks with extraction if the gates fail.
   - **Run 2026-10-31 (v39-b farmers, v39-c every bad actor, v39-d with the fixes, v39-e farmers with the
     fixes; TOKENOMICS.md "The degen and bear-case batches"):** the gates fail under bad actors. Farmers
     alone take the end price from $0.00043 to $0.00027. Every bad actor together pumps the listing about
     600× in nine days and crashes it 99% by day 30, and speculators lose $263k a seed to sybils ($142k)
     and farmers ($105k). The fixes give +7% on price and −17% on net selling against farmers alone, and
     nothing against the pump. **Next:** switch the fixes on at the next ruleset change. Launch design
     (Jeff to decide): an opening auction, a daily price band in the first months, and the identity checks
     against sybils.
3. **Phase B, the client:** panels for staking, pools, pay terms, the catalogue, businesses (truck stops
   with parking prices and spaces), managers; the sites on the map; the notices; a market view in the
   style of DAT (lane rates, ratios by region and trailer, headhaul and backhaul); the owner's gauges;
   the first Monthly Economic Report, from the sim.
4. **Assets and destruction** (one restart): tractors and trailers as separate assets with their own
   wear, life, prices, listings and insurance; a yard's capacity in both; swaps at the yard; finite life
   (scrapped after about a million miles or two rebuilds); total losses on severe crashes; new supply
   as a monthly factory allocation instead of recycled units; player dealerships that buy the allocation
   and sell retail (the NPC dealer a dearer backstop); player lessors; NPC trailer leasing on the free
   path; trailer theft; every protocol-sold asset resellable player to player (businesses with their
   bonds, yards, upgrades with the truck). Target: replacement purchases 15–20% of all sinks.
   - **Built 2026-10-31 (config `assets`, off in the base, on for the restart):** the trailer entity
     (hooked, dropped in the yard, listed, gone), a yard counting tractors and trailers (none 5/5,
     small 10/15, large 30/45, +5 trailer spaces through the catalogue), swaps at the home hub, NPC
     trailer rental by the week at any hub (2 weeks minimum), trailer wear and one refurbishment, trailer
     life by type (van 1.2M, reefer 750k, flatbed 1.5M miles); tractors take two rebuilds or a million
     miles, then run until worn out and go for scrap (3% of list, a small faucet); a crash writes the
     rig off at 4% / 35% / 100% (property / injury / fatal) with physical-damage cover at its value less
     2,500 FD (1.2% of value a year in the premium); a trailer left in a yard can be stolen; nothing
     goes back into dealer supply. The factory allocation (2.5% of the tractors on the road a month,
     at least 40, by tier and type mix; the NPC dealer holds at most three months of it); player
     dealerships (150k + 50k bond; wholesale at 85% of list through the catalogue split; retail at a
     markup they set; seven-day delivery from stock; trade-ins at 80% of value onto a lot of ten);
     the NPC dealer as backstop at +10% and +21 days while a dealership is open; player lessors
     (tractor-only weekly leases with a minimum term; the title, rebuilds and scrap stay the owner's);
     resale of businesses with their bonds, facilities, and yards (to a carrier at the same hub).
     Bots swap, rent, refurbish, keep a spare per five tractors, buy tractors for spare trailers, buy
     from the cheapest source, run and price dealerships, trade in, lease out parked tractors and
     take cheap leases, sell businesses that lose money for a year. Client: trailer lines and asset
     actions on each truck, the yard card, the showroom (rigs, tractors, trailers by source, used
     trailers, tractors for lease), dealerships and resale in Business.
   - **The open question for Jeff:** at today's prices (Workhorse + van 18k FD against ~360k FD a
     year to run one) new equipment is ~2% of sinks with finite life on (the smoke run). The 15% bar
     needs equipment several times dearer, which pushes a newcomer's first new truck past the 84-day
     free path unless the first truck is used. The calibration batches put numbers on it.
   - **The calibration (v40-a/b/c, 2026-10-31, seeds 1, 5, 8 against v38-a; `runs/compare-v40.md`):**
     no price passes. New equipment is 2% / 4% / 5% of sinks at ×1 / ×3 / ×6, and all equipment
     (new, NPC lease share, trailer rent, rebuilds) is 9% / 13% / 16%. The end price is $0.00024 / $0.00033
     / $0.00036 against $0.00043 with assets off. Net FD paid into the economy over four years is 120M / 109M /
     88M against 89M off. At ×1 a new truck costs less than the rebuilds that finite life ends (the rebuild sink falls
     from 44M to 27M). At ×3 and ×6 the free path breaks (median first truck 83 and 132 days), owned
     trucks fall to 1,016 and 670 from 1,535 as carriers switch to NPC leases (15% of gross, whatever
     a truck costs), and wealth concentrates (top 10% share 35% → 46% / 55%). At ×6 fleets buy FD with
     dollars to pay for trucks; the price runs to 3.7× launch, the developer's vest sells 10M FD into it,
     and the drawdown is 85%. Why: Equipment Finance lends only against trucks a carrier already owns
     (35% of value, 26 weeks), so a first truck is cash only. **Proposed (Jeff to decide):** purchase
     loans on the truck being bought (real equipment finance: 10–20% down over years), extra NPC leases
     priced by the truck's value, then re-run at ×2 and ×3 with the bar on all equipment.
5. **Checkpoints and the authoritative server** before any real money (hosting: Jeff to choose the
   Mac mini or a cloud box); **the brief for counsel** (US first); **launch** with the lean reset, the
   window's dollars seeding a pool as deep as the float, the dial on from day one; the Monthly Economic
   Report published from the live world every month.
- **Bars every batch reports:** replacement purchases as a share of sinks; the player share of new
  trucks, fuel, repairs, insurance and freight; thefts and claims; the used-truck price index; the
  pool dollars farmers take against operators; plus the three gates (price from launch, liquidations
  against baseline, the free path).

## Complete supply control (Jeff, 2026-10-31)
"The name of the game here is complete supply control. With all faucets and sinks and metrics and
vesting schedules all completely transparent." His answers to the 18 questions, the same day:
1. **Build order:** the supply ceiling; the airdrop and taxes; the launch auction and price limit;
   trucks; then the highway robbers and the unlock ladder in the sim.
2. **The supply ceiling.** FD outstanding after launch grows at most along a published path, flat after
   a real year; test +25% and +10%. The rate dial cuts first; at its floor the airdrop's slices and the
   developer's vest wait (owed, never lost); fees rise only after that; the path never bends.
   **Built (9474460, off):** `token.supplyCeiling`, `ceiling.ts`; batches v42-a (+25%) and v42-b (+10%).
3. **The airdrop:** 1% at launch; the rest unlocks only through milestones (achievements, items) on
   the honest and the criminal path, with a 12-real-month deadline, after which what's left is never
   minted. Criminal milestones unlock only the person's existing slice, only with no open case, and a
   conviction forfeits it (counsel to confirm).
   **Built (off, 2026-10-31):** `token.airdrop.logbook` (logbook.ts): 1% when a book opens, then 23
   milestones checked weekly (freight handled, on time, profit, trucks and a business owned, a manager, a
   clean quarter, three tenure milestones at three, six and nine real months, a satisfactory review, a
   contract kept, a fully secured truck; crew hits, a chopped rig, FD fenced, a case gone cold), each
   unlocking its weight's share; the honest ones add up to all of it for every role, the criminal ones to
   at most 60%; no early claim; a conviction forfeits the rest; 1,460-day deadline; one book per company,
   later seasons joining it. TOKENOMICS.md "The logbook". Still to do: the shop items that bring a
   milestone forward, and the client's logbook page.
4. **Selling early:** a 75% sell tax at launch, falling to the normal 7% over six real months,
   everyone pays, all burned ("we want players to farm this, not farmers"). Transfers: no FD sends
   between players; burn the part of a player-to-player sale above the used-truck index.
5. **The launch:** an opening auction (verified people, a per-person cap, all its dollars into the
   pool) and a daily price limit of ±15% for the first three real months.
   **Built (off, 2026-10-31):** the daily limit, `token.exchange.priceBand` (±15% of the day's open for
   365 game days; orders fill to the edge and the rest waits).
   **Built (off, 2026-11-01):** the opening auction as a tranche, `token.launch.auction` (the treasury
   sells `trancheFd` at one clearing price, every dollar bid over it, at most `capUsd` a person, the
   dollars into the pool, which opens at that price), and a standard pool's own brakes,
   `token.exchange.launchFee` (a fee on both sides falling from 50% to the normal fees over 14 game days)
   and `sizeFee` (a buy pays more for its size). **Dropped (Jeff, 2026-11-01):** the price band on-chain:
   it needs our own pool program, and Jeff wants a plain token in a standard pool; the sim keeps the
   switch for comparison. The verified people and the caps are the auction tool's (Genesis or an Alpha
   Vault) and the server's.
6. **Trucks:** test both no free tier and spend-only free-path earnings until a truck is owned and
   identity is checked (counsel decides); a lease deposit of at least 25% of the truck's value; loans
   against the truck being bought (10–20% down, an FD stake of 10% and 25% tested, credit that grows
   with the record); prices on the real-world ratio, new $200k to used from $50k, scaled to FD (test
   the realistic level, about 250–300k FD for a new tractor, and the 4:1 ratio on today's prices);
   assets on: "we need to have assets".
   **Built (off, 2026-10-31):** the NPC used lot, `usedMarket.npcLot` (dealer.ts): worn rigs, four years and
   450k miles old, condition 0.4, at their used value (about a quarter of new: Jeff's $50k-to-$200k), 15 a
   week up to 30 on the lot, delivered like a new truck; the free path's way in at realistic prices
   (v43: a free starter needed about five real weeks to buy a new rig at 293k FD). With it, v45-a: a median
   of about 100 days, so `freeEntry.leases.byValue.depositToPurchase` (off): the lease deposit counts toward
   the first truck, released into the purchase, so a starter doesn't save the deposit and the price twice.
   **Built (ab956bf, off):** `freeEntry.leases.byValue` (rent floor 0.5% of value a week, 25% deposit,
   escrowed on the free path), `equipmentFinance.purchase` (purchaseLoans.ts: NPC lender, 10–20% down,
   10% stake, 104 weeks, default → the truck taken back at value), `freeEntry.freePath` ("lease" /
   "spendOnly" / "none"); bots finance when cash is short.
7. **Highway robbers:** hired crews; cargo, trailers and whole rigs (rigs to chop shops or the Back
   Lot); theft corridors at night only, never secured lots; newcomers protected for 30 real days; a
   cooldown per victim; the hirer's stake covers the take; 2–3 security slots per truck, every item an
   FD sink. Hires are public, and the answer is pure PvP: no inspections or insurance penalties for
   hirers, a gossip network (Channel 19) on the terminal and in the daily, weekly and monthly reports,
   with payback and bounties. **Open:** stealing a load you were hired to haul stays a crime; corridor
   robbery is open PvP (proposed; Jeff to confirm; the bad-actor spec's "theft is a crime" rule).
   **Built (off, 2026-10-31):** `robbery` and `security` (robbery.ts): `hire_crew` on another company's
   truck (fee 2% of its value, at least 2,000 FD, a sink; posted to the public feed with a warning to the
   owner); the crew strikes the next night the truck sleeps outside a truck stop where theft risk is 1.5+,
   within 7 days, odds 0.5 × risk ÷ 2 (at most 0.8), cut by fittings and a security manager; a hit takes the
   load and, at 30% odds, the rig (chopped, the victim's physical-damage cover pays); the hirer is paid 30%
   of the cargo and 20% of the rig, less a 25% wash, from the reserve; newcomers protected 120 game days, a
   28-day cooldown per victim, the hirer's equity must cover the take; `fit_security` (tracker, locks,
   camera; 3 slots); a truck with a crew on it heads for a truck stop; outlaw bots hire, threatened bots fit.
8. **The unlock ladder:** each layer opens at a published date and a hard-to-fake metric (verified
   players, pool dollars), gradually; hauling, then businesses, then player brokerage, then the Back
   Lot and robbers, then aliases and crews; it starts at launch, the beta fully open.
   **Built (off, 2026-10-31):** `unlockLadder` (ladder.ts): hauling from launch; businesses and facilities
   at 28 game days (a real week), re-brokering at 91 (three real weeks), crews at 182 (six and a half real
   weeks), each also waiting for its operating companies and pool dollars when those are set; a layer
   that opens stays open, and what the beta built keeps running. The Back Lot, aliases and crews join it
   when they're built; verified players replace operating companies once the server checks identity.
9. **Staff, sales and direct freight (Jeff, 2026-10-31: "make it difficult, expensive and risky to
   grow", and "incentivized to grow one large company and not many smaller ones"):**
   - A dispatcher from 3 trucks, at most 10 trucks each; a maintenance manager from 5, at most 15
     each; an operations manager from 8, at most 20 each. Each does worse the more trucks it carries.
   - Security, a CEO and sales: optional, expensive, extremely beneficial. No direct shipper freight
     without sales.
   - Direct freight only up to what the fleet can haul and what the staked bond can broker out; a
     performance stake behind it, slashed to make the shipper whole when a load isn't covered. A small
     company can't take on many times its own size.
   - Settled the same day: the owner runs 2 trucks alone and the dispatcher is required from the 3rd,
     but staff can be hired at any size for automation (or a dispatch service at 5–10% of gross); the
     performance stake is about two weeks of the contract's value, locked for its term; economies of
     scale (fleet fuel, fleet insurance rating, dealer fleet pricing), each on its own: 0% up to 5
     trucks, 0.2% a truck from 6 to 10 (1% at 10, as Jeff proposed), then linear to 10% at 50 (0.225% a
     truck), flat after; one 50-truck company gets 10% where two 25-truck companies get about 4.4% each
     and five 10-truck companies 1% each. The insurance discount needs a clean safety record, like real
     fleet rating. The build comes right after the trucks build.
   - **Built (off, 2026-10-31):** the ladder (`labor.ladder`: spans count the whole fleet, performance
     slides from half a span to 70% at a full one, skill cushions it; Jeff's spans go in as settings);
     the optional roles (`labor.managers.roles`: CEO lifts every manager up to 30%, security cuts theft
     odds up to 50% and the premium up to 10%, sales reps carry 3 contracts each at up to +5% rate);
     direct freight (`contracts.direct`: no offers without a rep, volume up to 2 loads a truck a week,
     a 2-week performance stake slashed on turned-down tenders); scale discounts (`scaleDiscounts`,
     scale.ts: fuel, the NPC dealer, a clean fleet's insurance); the early-sale tax
     (`token.exchange.launchTax`, 75% falling to the fee over 730 game days); `fraud.theft.byCarrier`.
   - **Contract theft goes** (Jeff: "What benefit is there for anyone to steal their own freight that
     they were contracted to haul? I don't see any"). Remove `steal_load` for players and AI outlaws
     in the next ruleset bundle; cargo theft comes from NPC thieves and hired robbers only. It can
     return later as fraud by aliases and shell authorities (fictitious pickups) after the server,
     where investigations can work. Corridor robbery is open PvP.
   - Proposed, not decided: a bigger staff pool with talent scarce at the top; managers who bring
     decisions with a recommendation, the answers becoming standing orders; armed drivers as a
     trade-off and armed escorts per load; every allowance and cap per person; real economies of scale
     (fleet fuel, fleet insurance rating, dealer fleet pricing). A "staff, sales and contracts" build
     after trucks, tested with the robbers.

### The combined test, done (2026-10-31; TOKENOMICS.md "The combined test", `runs/compare-v43.md`–`v49.md`)
Every sink, the robbers, the band, the logbook, the ladder, the used lot and the deposit credit, all built
and off. What the batches settled, and what waits on Jeff:
- **Truck prices:** today's work (the free path 8 days, the price holds); realistic prices break the free
  path (141 days) unless the NPC used lot and the deposit toward the first truck are on (56 days, but the
  top 10% hold 56% of the wealth); mid prices (a Workhorse 140k) with both were the most balanced (41 days,
  the strategy gate passed, the price held in every seed). **Jeff chose mid prices with the used lot and
  the deposit credit (2026-10-31):** tractors 140k / 177k / 214k FD (Workhorse, HighwayPro, Flagship),
  trailers 42k / 79k / 47k (van, reefer, flatbed), rebuilds 31.5k / 40k / 48k, refurbishments 4.8k / 9k /
  5.3k (the realistic list × 0.62, as in v47-b), with `usedMarket.npcLot` and `depositToPurchase` on. They
  ship with the rest of the package, on a ruleset bump.
- **The launch defense:** the band turns the listing spike into a climb at the limit; the 75% early-sale tax
  on every sale makes that climb five times bigger; a ±5% band with the tax on farmed FD only and the
  logbook was the best (a peak market cap of $2.6M against $33.5M unprotected, farmers taking 85% less,
  sybils 94% less). **Jeff decided (2026-11-01):** no band on-chain (a plain token in a standard pool), the
  auction tranche yes, the tax on farmed FD at the bridge; the tranche's size waits on the v50 smoke.
- **The supply path and the logbook:** at +10% the path holds the logbook's unlocks as owed for good in some
  seeds (one paid nothing past the 1% opening). **Jeff to choose: widen the path, or let the logbook's
  payments through.**
- **Robbery at realistic prices** chops about one owned truck in six; the unlock ladder (crews from day 182)
  cuts the hires by a fifth to a half.
- **Built 2026-11-01 (off):** the opening auction as a tranche, `token.launch.auction` (a literal auction,
  every bid as one buy against the opening pool, had lifted the open about 2,000× in a thin pool, so it was
  reverted). **Not built:** the shop items that bring a logbook milestone forward; spend-first unlocks; the
  client's pages for the logbook, the ladder, the lot, the auction and Channel 19.

## Later, agreed with Jeff on 2026-10-30 (not before the switch-on and the dashboard)
- **The world-economy story.** Scripted shocks on top of the cycle, seasons, weather and fuel feeds:
  recessions by sector for a season, hurricane relief freight into a region at premium rates, port
  strikes moving a coast's imports, tariffs shifting a sector's lanes, a cyber attack closing the load
  board for a day (book-now only), an ELD mandate tightening hours enforcement for a quarter, fuel
  shocks, border closures once Canada exists. Three rules: (1) shocks redistribute demand in time and
  space and never print FD (a stimulus is a faucet; the dial would fight it); (2) events come from a
  seeded generator or a logged, public input with lead time written in — nobody, the developer
  included, knows the schedule first; (3) semi-fictional, never mirrored from real news. Build: an
  event with type, region, sector, start, duration and magnitude, applied through the demand scale
  and the feeds, surfaced as in-world news. Tuned on the dashboard's gauges.
- **The admin dashboard.** Gauges first (sinks over faucets, the dial's position, pool dollars and
  FD, net selling, the reserve, liquidations against baseline, the free path, businesses open,
  breakdowns served). Then bounded policy levers as signed, logged world inputs with a published
  range and a month's lag (the dial's band, tax rates within a band, season pots, sites opening);
  never hot config edits, which fork history and read as a rug. Levers after the authoritative server.
- **Growth by crowding, not by map.** Open new territory when the hubs are crowded (loads per truck
  falling, rates compressed, expired loads near zero): Canada, then Mexico, each an additive migration
  of a running world under one token with its own balance; Europe as a separate theater if wanted;
  South America is a map, not a market (no road link).

## Open for Jeff to decide
- The auction tranche's size and the per-person cap (the sim's stand-ins: 20M FD, $1,000), and the
  launch fee's start and days (50%, 14 game days). The v50 smoke (TOKENOMICS.md "The launch smoke"): the
  auction takes the listing spike from 450× to about 20×, bigger tranches end higher (the clearing price
  lands nearer where the market settles), the fee is not a bubble tool, the bridge's rules carry the
  aftermath. Next: the full-size test at 20M / 40M / 80M with the sinks on, then Jeff's call.
- Spend-first unlocks (each logbook slice spend-only for 30 real days before it can leave through the
  bridge): proposed 2026-11-01, not built.
- Whether later seasons' pots still shrink when the price sits below launch (pot × min(1, avg ÷ launch)):
  it scales emission, it doesn't gate a sale; kept unless Jeff says otherwise.
- Miles-to-profit airdrop weighting after the runs (0.6 / 0.4 to start).
- The four season pot sizes (10 / 6 / 4 / 3M proposed).
- The achievement catalogue for unlock boosts (TOKENOMICS.md).
- Painterly vs isometric mix for the asset pass; merge of PR 2 (graphics session).
