# LANES to-do (kept current; last edit 2026-10-29)

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
14. **Authoritative server before real money**, then the settlement layer from audited standards
    (fixed-supply ERC-20, ERC-4626 vaults, an existing DEX pool, OpenZeppelin vesting and
    timelocks, one small audited bridge with a bounty).

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
- **Next:** draw the sites on the client map (lat/lon in `w.sites`; the graphics session); managers as
  people from the labor pool; per-state fuel tax rates once routes carry states (13); terrain and
  weather (13); a fuel tank model if the block rule proves too coarse; the switch-on decision.

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

## Open for Jeff to decide
- Miles-to-profit airdrop weighting after the runs (0.6 / 0.4 to start).
- The four season pot sizes (10 / 6 / 4 / 3M proposed).
- The achievement catalogue for unlock boosts (TOKENOMICS.md).
- Painterly vs isometric mix for the asset pass; merge of PR 2 (graphics session).
