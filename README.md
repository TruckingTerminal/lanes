# LANES — freight MMO (Phase 0 engine + playable client)

## Play
- **Test build:** https://truckingterminal.github.io/lanes-play/ (the full game with you and the
  AI companies, plus pause and speed controls; your world stays in your browser). On every push to
  `main`, `.github/workflows/pages.yml` runs the typecheck and tests, then publishes the built page
  to the public `TruckingTerminal/lanes-play` repo (deploy key in the `LANES_PLAY_DEPLOY_KEY`
  secret), which GitHub Pages serves. This repo stays private.
- **Live world:** the shared, always-on MMO world runs as a claude.ai artifact (see "The live world").
- **Locally:** `npm ci`, then `npm run build:site` and serve `apps/web/dist/site`, or `npm run build`
  and open `apps/web/dist/local-lanes.html` from a static server.

## Docs
- **For players:** https://truckingterminal.github.io/lanes-play/docs.html, and the Guide tab in the
  game. Both render the same pages (`apps/web/src/guide/*.ts`, one file per section: getting started,
  the market, running trucks, staff, growing the company, money, safety, reference), and every number
  in them is read from the config the world runs on, so the docs can't drift from the rules. The
  docs page is built at `npm run build:site` (`apps/web/src/docs.ts`) and deployed with the game.
- Fraud (double brokering, cargo theft) is deliberately left out of the player docs.
- **Players can be bad actors too** (config 0.11.0, Jeff's call): the same policy, re-posting and
  theft actions the AI uses are open to player companies, with the same investigations, claims,
  fines and shutdowns. `fraud.players: false` locks them back to AI (`badActor` in actions.ts).
- **For developers:** this README (design notes and sim results by config version), `TOKENOMICS.md`
  (the token), and the comments in `packages/config/src/economy.config.ts` (every tunable number).


Pure, seeded simulation engine for the LANES proof of concept (spec v0.2, "Phase 0 build brief").

```
npm install
npm test                                               # engine tests
npm run sim -- --seeds 1,2,3,4,5,6,7,8,9,10 --quiet    # 10 seeds × 2 seasons, one line per seed + summary
npm run sim -- --seeds 1                               # one seed in detail, monthly progress lines
npx tsx apps/sim/src/inspect.ts --checkpoints 30,84,365  # per-strategy economics (tuning aid)
npm run sim -- --seeds 1,2,3,4,5,6,7,8,9,10 --days 1095 --seasons off --quiet --out runs/cycle-seasons-off
npx tsx apps/sim/src/compare.ts runs/v9-seasons-on runs/v9-seasons-off-target100  # side-by-side table
npm run sim -- --seasons off --holding-rate 0.04 ...   # holding-cost sensitivity
npm run sim -- --seasons off --days 1095 --set buyback.enabled=true            # the weekly buyback auction
npm run sim -- --seasons off --days 1460 --set token.enabled=true              # FD as a token: 2-year beta, then live
npm run sim -- ... --set freeEntry.leases.enabled=false --set stabilizers.volumeRange=[0.5,1.5]  # any config value
```

**The game:** `node apps/web/build.mjs` builds `apps/web/dist/lanes.html`, a single self-contained
page (published as an artifact) plus `local-lanes.html` for local play; serve `apps/web/dist` with
any static server. See "The live world" below.

`--set path=value` overrides any config value (numbers, booleans, JSON arrays) and can repeat.
The token design and its results are in [TOKENOMICS.md](TOKENOMICS.md).

`--seasons on|off` switches the season close (lock, burn, Miles reset) and `--cycle on|off` the
demand cycle.

The runner defaults to 730 days (two seasons) so every run includes a season close and a
season-over-season supply comparison. Reports land in `runs/` (gitignored).

| Package | What it holds |
|---|---|
| `packages/config` | `economy.config.ts`: every tunable, tagged with its spec section |
| `packages/data` | 60 hubs (10 starters first), lane network, real-data feed interface |
| `packages/engine` | clock, seeded RNG, ledger, demand + freight, board, standing orders, trips, wear, facilities, season close, Miles, stabilizers, report |
| `packages/agents` | Tier A rule bots (greedy / conservative / random) |
| `apps/sim` | sim-mode CLI runner |

Engine rules: no wall clock and no `Math.random` in the engine; every FD move is a ledger entry
tagged faucet / sink / transfer; the ledger is checked after every tick; bots act only through
standing orders and `applyAction`.

## Built so far
- **Freight and board:** NPC freight with the broker-only split; sealed-bid rounds with scoring,
  rollovers and the NPC fallback; standing orders. A truck that sees freight but won't take any of
  it at the posted ceilings isn't counted as capacity in the load-to-truck ratio.
- **Trips:** HOS (11 driving hours per 24-hour duty day, ≈550 mi/day), 1–2 h loading and 1–2 h
  unloading, due times that follow that schedule.
- **Costs:** fuel + FSC, wages, maintenance, insurance, NPC lease share, idle fees.
- **Wear and rebuilds:** condition falls with miles. Worn trucks burn more fuel, cost more to
  maintain and break down more (6–18 h delay plus a tow and repair bill; the NPC lessor pays on
  leased trucks). Rebuilds cost FD and take two days in the shop. Million-mile levels give a fuel bonus.
- **Facilities** (warehouse, cold storage, factory), at the spec's PoC caps and weekly upkeep. Each
  originates freight at its hub, taken out of that hub's NPC demand (players get at most 60% of it).
  The NPC market buys the goods from the owner, who pays the carrier and earns shipper Miles. Freight
  nobody hauls goes to an NPC expediter at the owner's cost.
- **Season close:** the last 30 days lock trucks and facilities; at year end each company keeps 10%
  of its FD (max 25,000) and the rest burns; the reputation record decays 30%; Miles are snapshotted;
  authority and licenses renew.
- **Broker costs:** surety premium on the 75k bond, license renewal, board fee on posted freight.
- **Fleet overhead:** weekly per-truck cost in brackets (trucks 1–3 free, then 350 / 550 / 700 /
  800 FD per truck-week). Owned trucks can be **parked**: they stop running, drop off the overhead
  bill and pay the idle fee, so fleets can shrink instead of sinking into debt.
- **Freight cycle:** a synthetic Cass-style demand dial (seeded wave + persistent shocks, ±25%,
  ~300-day period) moves freight volume; rates follow through the load-to-truck ratio.
- **Dealer lead time:** new trucks are paid at order and arrive 30 days later, plus a quarter day for
  every truck already on order nationally (up to 150 days), so boom orders land in the bust.
- **Depreciation and used trucks:** used value falls with mileage and age, then wear; rebuilds cost
  more on old trucks (×2 at 500k miles) and old trucks break down more. Any owner can list a truck;
  sales pay the seller 95% and a 5% fee (sink). Owner-operators can start on a used truck.
- **Equipment Finance:** depositors fund a pool; loans up to 35% of a truck's used value at 1% a week
  over 26 weeks; two missed payments → repossession (when the truck is next idle) → listed at 85% of
  value, cut weekly, back to dealer supply below 40% with the loss on depositors.
- **Season close carryover:** keep the larger of 10% (max 25k) and your last 4 weeks of spending;
  the finance pool pays its cash out to depositors first.
- **Holding cost (seasons off):** 2% a week on cash above working capital (the larger of 25k and
  four weeks of spending), and on the finance pool's idle cash; money lent out is exempt.
- **Insolvency:** four weekly checks more than 2,000 FD in the red → liquidation: no bidding,
  trucks fire-sold (back to dealer supply if unsold), facilities closed, remaining debt written off
  (its own faucet tag), restart on an NPC lease with no grant.
- **Broker risk:** NPC shippers default on 2% of brokered loads (more in downturns) and the broker
  still pays the carrier; brokers sell on contract rates that trail spot by ~30 days (signed at the
  market on day one), so a boom squeezes them and a bust pads them. A brokered load nobody hauls
  goes to an NPC carrier at the broker's rolled-up ceiling, or 95% of spot if higher. Broker bots
  halve the loads they take after a losing week.
- **Free entry:** a carrier that owns a truck can lease more from the NPC lessor (Workhorse, any
  trailer, 15% of gross, 250 FD/week minimum rent, 28-day minimum term, up to 10). The lessor's
  fleet grows when it's nearly all out and freight goes uncovered, and shrinks when leases come
  back. Optional, off by default: dealer caps that grow 5% a month when nearly sold out.
- **Buyback auction (optional):** a fixed weekly dollar budget buys the cheapest FD offered at one
  clearing price and burns it; the only way FD becomes dollars in that mode.
- **FD as a token (optional):** beta, launch reset and lock, airdrop by Miles, FD/USDC pool,
  treasury revenue and buybacks, profit tax. See [TOKENOMICS.md](TOKENOMICS.md).
- **Stabilizer without seasons:** targets 97–103% sinks/faucets instead of 90–100%, since nothing
  else resets the money supply.
- **Bots:** adaptive pricing by win rate, rebuilds at a strategy threshold, fleet growth toward the
  scarcest equipment and only while a truck out-earns its overhead bracket, weekly parking of
  trucks that don't, facility purchases by fill-aware payback (stopping if owned facilities lose
  money), looser hurdles as the burn nears; used trucks before new, selling worn trucks past an age
  limit, leverage (greedy, some random), deposits and early repayment (conservative, brokers), and
  refusing to order into a long dealer backlog (conservative).
- **Report:** operating sinks/faucets per quarter (burn reported separately), sinks incl. burn per
  season, three supply measures, free path, strategy balance, wear and facility summaries; by year
  and by cycle phase; wealth and failures by segment; buyback and token results, and dollars in and
  out by segment.
- **Ledger tags:** operating faucets and sinks drive the stabilizer. One-time mints (grants, the
  airdrop, launch liquidity) and burns outside operations (season close, buybacks, the exchange
  fee, the launch reset) are reported apart. Working capital counts spending only: deposits, sales
  of FD and burns of cash don't count.

## Latest campaign (config 0.3.1-phase0.7, 10 seeds × 2 seasons)
| Measure | Without fleet overhead | With fleet overhead |
|---|---|---|
| Operating sinks/faucets, Season 1 Q1→Q4 | 78 → 83 → 84 → 90% | 79 → 84 → 86 → 92% |
| Operating sinks/faucets, Season 2 Q1→Q4 | 84 → 84 → 85 → 87% | 84 → 84 → 85 → 88% |
| Fleet overhead, share of FD created | — | 3.2% (fleets 22.4M, grown OOs 0.4M) |
| Sinks incl. the season-close burn, per season | 100–101% | 100–101% |
| FD supply season over season | 1.02× | 1.09× |
| Supply after the Season 2 close | −0.7M (debt) | +1.2M |
| Owner-operators: profit per truck-week · trucks | 382 · 474 | 537 · 564 |
| Fleets: profit per truck-week · trucks | 531 · 1,162 | 962 (695 after overhead) · 1,064 |
| Free path: bought within 84 days (of 400) | 42–66 | 42–79 (fails) |
| Strategy balance (within segment) | 1.8–2.8× | 1.9–2.9× (passes) |

Why overhead barely moves the ratio: fleets respond by parking marginal trucks and growing less,
about 100 trucks of capacity shift to owner-operators, the remaining fleet trucks earn more, and
FD created rises by about what the overhead takes. With bots told to ignore overhead the ratio
reaches 88–92% but fleets end Season 2 about 8.8M in debt (3-seed check). With freight volume fixed,
total profit is set by capacity against freight; a per-truck cost changes who holds the capacity.

## Freight cycle: seasons on vs. off (config 0.4.0-phase0.8, 10 seeds × 3 years)
Full table: `runs/compare-seasons.md`. Highlights (mean, range across seeds):

| Measure | Seasons on | Seasons off |
|---|---|---|
| FD supply before close, years 1 / 2 / 3 | 55M / 66M / 68M | 57M / 98M / 140M |
| Supply growth, year 2 / year 3 | 1.21× / 1.03× | 1.72× / 1.42× |
| Avg rate, years 1 / 2 / 3 (FD/mi) | 2.54 / 2.27 / 2.28 | 2.54 / 2.25 / 2.25 |
| Sinks (incl. burn) / faucets, whole run | 98% | 86% |
| Wealth Gini · top 10% share | 0.70 · 52% | 0.77 · 63% |
| Avg wealth: OO / fleet / broker | 31k / 237k / 103k | 44k / 517k / 1.4M |
| Repossessions · carriers wiped out | 64 · 0 | 30 · 0 |
| Companies in debt at end | 190 (−3.5M) | 141 (−2.8M) |
| Free path: bought within 84 days | 123 of 400 (7–328) | same (year 1 is identical) |

The cycle overshoots as intended: orders pile up in booms, land as demand falls, rates drop, and
leveraged fleets get repossessed. Without seasons, FD still accumulates, mostly as idle deposits
in the finance pool (≈103M of 143M by year 3) held by brokers and prudent fleets; freight rates fall,
so it's hoarding rather than price inflation. Nobody is wiped out because negative balances carry
no consequence yet.

## Seasons off with holding cost, insolvency and broker risk (config 0.5.0-phase0.9)
Full table: `runs/compare-v9.md` (10 seeds × 3 years, cycle on). Mean across seeds:

| Measure | Seasons on | Seasons off, 90–100% target | Seasons off, 97–103% target |
|---|---|---|---|
| FD supply before close, years 1 / 2 / 3 | 50M / 67M / 72M | 42M / 71M / 104M | 41M / 59M / 71M |
| Supply growth, year 2 / year 3 | 1.36× / 1.08× | 1.69× / 1.49× | 1.43× / 1.21× |
| Sinks / faucets, whole run | 98% (incl. burn) | 94% | 95% |
| Wealth Gini · top 10% share | 0.69 · 50% | 0.66 · 52% | 0.71 · 56% |
| Avg wealth: OO / fleet / broker | 38k / 236k / 190k | 83k / 573k / 544k | 48k / 437k / 443k |
| Liquidations (companies) · of them OOs | 349 (236) · 197 | 158 (113) · 90 | 241 (166) · 138 |
| Companies in debt at end | 124 (−175k) | 20 (−45k) | 50 (−88k) |
| Holding cost paid | — | 94M | 76M |

Over five years (3 seeds) the 97–103% target brings growth down to ≈1.1× a year (supply 41M → 86M);
the 90–100% target keeps it near 1.3–1.4× (→188M), because the stabilizer adds freight whenever the
holding cost pushes sinks above 95%, and the truck cap means more freight only raises rates.

## Free entry (config 0.6.0, 10 seeds × 3 years, seasons off)
Full table: `runs/compare-free-entry.md`. Compared with the PoC caps alone:

| Measure | Caps only | Extra leases | Dealer caps grow | Both |
|---|---|---|---|---|
| Player trucks running in booms / busts | 1,229 / 1,239 | 1,331 / 1,219 | 1,301 / 1,298 | 1,353 / 1,250 |
| Loads handed to NPC carriers per day in booms | 206 | 168 | 204 | 169 |
| Fleet profit per truck-week after overhead | 600 | 480 | 586 | 465 |
| Supply before year 3 close | 70.7M | 64.8M | 71.3M | 65.1M |
| Companies liquidated (of them owner-operators) | 166 (138) | 192 (169) | 173 (143) | 198 (173) |

Leases come and go with the cycle (about 290 out in booms, 30 in busts), so capacity grows into a
boom and leaves in the bust. Cap growth adds trucks that stay through every bust. Leases are the
default. The cost: owner-operators face more competition.

## Buyback auction (config 0.7.0, 10 seeds × 3 years, seasons off, $5,000 a week)
Full table: `runs/compare-final-buyback.md`.

| Measure | No buyback | Buyback |
|---|---|---|
| Supply before year 1 / 2 / 3 close | 42M / 60M / 69M | 22M / 27M / 28M |
| FD bought and burned | — | 101M for $780k |
| Implied price, $/FD | — | $0.0078 average; $0.007–0.008 each quarter after the first |
| Holding cost paid | 80M | 21M |
| Wealth Gini · avg fleet / broker wealth | 0.71 · 354k / 519k | 0.65 · 151k / 164k |
| Dollars out per company-week: OO / fleet / broker | — | $1.12 / $17.45 / $40.73 |

Companies sell what they'd otherwise pay the holding cost on, so the auction replaces most of
that sink, and supply stops growing. The price is set by the budget against the FD offered.
In the first quarter little is offered, so it clears high (about $0.03).

## FD as a token (config 0.7.0, 10 seeds × 4 years: 2 beta + 2 live, seasons off)
Design, levers and the full results are in [TOKENOMICS.md](TOKENOMICS.md); table in
`runs/compare-final-token.md`. Headlines:
- **Supply:** shrinks about 9% a year after launch (62M → 50M); the no-token baseline grows to 75M.
- **Price:** falls from $0.01 to about $0.005 in the first live year, then holds. In the stress
  case (no newcomers, $2 per company-week) it slides to $0.0026.
- **Dollars out:** what players take out equals buybacks plus seed drawn from the pool. Brokers
  take about three quarters of it.
- **Cost:** about 55% more companies are liquidated than without the token (newcomers crowd the
  same freight), and newcomers who pay to skip the free path reach about 3× their segment's median
  Miles per hour.

## Open design decisions
- The quarterly 90–100% band and the free path pull against each other: squeezing rates raises
  the sink ratio but prices out leased owner-operators first. The volume floor sweep (`runs/`) shows
  the trade-off.
- The "supply never doubles" reading: measured on an established base (after warm-up, and season
  over season); against 5,000-FD starting grants it can't pass by arithmetic.
- How many free owner-operators share the dry-van market decides whether the free path works.
  (The 200-OO and volume-floor variants in `runs/` predate fleet overhead and the last two fixes.)
- A sink that captures profit without changing capacity would be a tax on profit or on cash held
  (the season burn is one, yearly); per-truck costs mostly redistribute capacity.

- Seasons can be removed on money-supply grounds with the holding cost, insolvency, broker risk
  and a 100% stabilizer target, but the tighter market liquidates more owner-operators; small
  operators carry most of the failures in every mode.
- Free entry through NPC leases lets capacity follow the cycle; the PoC caps no longer bind.
- The free path now depends on where in the cycle a player starts (7–328 of 400 across seeds).

## Seasons and lanes (config 0.8.0)
- **Regional seasons:** every hub follows its own weekly curve (`packages/data/src/seasons.ts`),
  derived from beagl.ai's public seasonality map (seasonal RPM delta by origin, dry van and
  reefer): each hub takes the nearest market's curve. Flatbed follows the van curve. The swing
  moves both freight volume (×3) and the posted rate (×2.5), and more freight tightens the market.
  Miami reefer builds slowly from winter, peaks in late spring and goes dead from August to
  November; Georgia and the Carolinas peak a month or two later.
- **Tightness per trailer type:** the load-to-truck ratio is computed per trailer, so Miami can be
  swamped with idle vans while its reefer market is tight in season.
- **Headhaul and backhaul:** each lane's rate includes a destination reload factor, from the
  destination's production/consumption balance for that trailer (`imbalance` in hubs.ts) times its
  live smoothed load-to-truck ratio against the national average. Freight into poor-reload markets
  pays more; freight out of them stays cheap.
- **Reload-aware dispatcher:** standing orders add the expected empty run out of the destination to
  break-even (60 mi ÷ reload odds, 20–250 mi), so bots and players stop chasing cheap freight into
  dead markets. The Load board shows each load's reload odds and the origin's season.
- **Check it:** `npx tsx apps/sim/src/seasons.ts [seed]` runs the game world for a year and prints
  realized rates by origin and month, and Miami inbound vs outbound van.
- **10 seeds × 4 years, token on** (`runs/compare-v13-tuning3.md`, column f vs the 0.7.0 baseline):
  liquidations 548 vs 561, companies in debt 107 vs 130, owner-operator profit 620 vs 344 FD per
  truck-week, free-path median 116 vs 131 days, top strategy 2.29× vs 2.30×. The FD price ends
  lower ($0.0061 vs $0.0073) and fleets end poorer (139k vs 183k). Without the reload-aware
  dispatcher, the destination premium pulled trucks into dead markets and liquidations nearly
  doubled.
- **Not modeled yet:** an explicit commodity flow matrix (production and consumption by commodity
  group, e.g. calibrated to FAF5) and shipper orders for player facilities.

## Staff, safety and fraud (config 0.9.0)
- **Staff** (`packages/engine/src/labor.ts`): every truck needs a driver; the owner drives one and
  dispatches up to three, hired dispatchers run the rest. Skill (1–5 stars) moves fuel, maintenance,
  breakdowns, speed and crash odds for drivers, and pricing noise, reload awareness, season foresight
  and span for dispatchers. It comes from hiring (market pay rises with skill, times a wage index
  that follows the pool) and grows with experience. Morale follows pay against market; unhappy staff
  quit, and other companies can poach anyone (the employer gets two days to match). Dispatchers are
  billed per truck they run, with a 25% retainer. Fleet overhead brackets dropped ~100 FD/truck-week
  to make room.
- **Safety** (`safety.ts`): companies set a policy on hours, speed and maintenance. Defects,
  weigh stations on real corridors (`packages/data/src/weighStations.ts`, approximate locations),
  police stops and roadside inspections feed a CSA-style score; alerts, new-entrant audits and
  serious crashes bring compliance reviews (satisfactory / conditional / unsatisfactory, then
  revocation). Crash costs scale with the cause; tiered shutdowns bar the account for 30 days to a
  year, permanently after repeat crimes. Hot loads pay a premium for windows only a team makes legally.
- **Fraud** (`fraud.ts`): double brokering and cargo theft, run by the outlaw AI persona, with
  investigations, claims on carriers' records, and poster vetting tiers (open / standard / strict).
  Players face it as victims and defend with vetting; the guide leaves it out.
- **AI personas:** clean 72%, corner-cutter 20% (over hours on hot loads, deferred maintenance when
  short of cash), outlaw 8%. Cheaters straighten up after a bad rating.
- **Check it:** `npx tsx apps/sim/src/safety.ts --seed 1 --days 1460` prints results by persona.
- **10 seeds × 4 years, token on** (`runs/compare-v14-c.md` vs v13-f): liquidations 817 vs 548,
  mostly cheaters (outlaws fail and get shut down repeatedly; corner-cutters end slightly richer than
  clean carriers but fail ~4× as often); clean carriers still fail ~20% more than before. FD price
  at end $0.0072 vs $0.0061, owner-operator profit 614 vs 620 FD per truck-week, fleet wealth 145k
  vs 139k, free-path median 85 vs 116 days. ~250 crashes (10 fatal), ~130 shutdowns, ~14M FD fines.
- **In the client:** a Staff tab (hire, pay, seat, team, poach, match offers) and a Guide tab. The
  Company tab shows the safety record and authority and sets the policy (0.11.0). A revoked
  authority files again automatically when its bar ends.

## Insurance, dealer prices and home markets (config 0.9.0)
- **Insurance** (`insurance.ts`) is a one-game-year policy per company, priced at signing and each
  renewal per truck on the road and billed weekly: 4,200 FD × record (rating, alerts, at-fault crash
  surcharges, a new authority ×1.25, a long clean record ×0.9) × the home hub's garaging factor
  (`garagingFactor` in hubs.ts: FL, LA, NJ, TX, GA, CA high; upper Midwest and Mountain West low) ×
  the insurance market index, which moves 3% a month toward a 60% loss ratio (claims insurers paid ÷
  premiums, trailing year). A serious at-fault crash or a review that changes the rating re-writes the policy at once.
  Dispatchers spread the premium over 52,500 loaded miles in break-even.
- **Dealer prices** (`dealer.ts`) move monthly per tractor tier and trailer type with the order
  backlog and scarcity (under 25% of the cap left), within ×0.85–1.3 of list; used values follow.
- **Home markets** (`home.ts`): a starter hub's crowding is the carriers based there ÷ its fair share
  by freight volume. Loads from within 150 miles of home get a bid-score edge (0.04 at a fair share,
  ×0.25–2 by 1 ÷ crowding), and a home base pays yard rent of 20 FD a week for each truck past the first × a metro factor ×
  crowding. Fleet overhead brackets dropped another 40 FD to make room. The join screen shows each
  starter hub's freight balance, insurance factor, yard rent and crowding.
- **10 seeds × 4 years, token on** (`runs/compare-v15-d.md` vs v14-c and v13-f): liquidations 1,059
  (817 with staff and safety alone, 548 before either), companies in debt at end 194 (153, 107),
  owner-operator profit 590 FD per truck-week (614, 620), fleet wealth 154k (145k, 139k), free-path
  median 93 days (85, 116), FD price at end $0.0070. Insurance takes less in total than before
  (33.2M vs 39.4M) but as a fixed cost per truck it bites in slumps, which is most of the extra
  failures; toggling yard rent, the home edge, dealer prices or the insurance market one at a time
  moved liquidations by under ±40 on 3 seeds. The insurance market ranged ×0.83–1.39 and the
  Workhorse + van price ×0.99–1.30.

## Roads, tolls and weather (config 0.10.0)
- **The road network** (`packages/data/src/roads.ts`, generated from Natural Earth's public-domain North America
  roads at 1:10m): every US interstate and US highway, all toll roads and CA-99, as a graph of 13k junction nodes
  and 23.6k edges with miles, class, toll per mile and simplified geometry (varint-packed, ~590 KB). Crossings
  and road ends that meet another road are joined; each hub attaches to the nearest road (an interstate within
  8 mi if there is one). `packages/data/src/roadNetwork.ts` decodes it and routes every hub pair with a
  deterministic Dijkstra: cost = hours at 58 mph (interstate) / 42 mph (US highway) + 3 minutes per highway
  stretch + tolls at 90 FD an hour. Lanes get road miles, hours, tolls and their two-lane share; `map.circuity`
  is only a fallback.
- **Tolls** are real per-mile truck rates by state and route (PA Turnpike 0.80, Illinois 0.45, Indiana 0.45,
  NJ Turnpike 0.55, Florida 0.40, Ohio 0.35, NY Thruway 0.35, Kansas 0.20, …), charged as the miles are driven
  (`sink:tolls`), counted in break-even by dispatchers and the load board, and passed to shippers in the
  reference rate (`roads.tollsInRates`). Chicago→Newark costs ~109 FD in tolls; routing avoids a toll road when a
  free one is nearly as quick.
- **Speed and windows:** trucks move at each route's miles ÷ hours; delivery windows use route hours.
- **Risk:** crash odds ×1.6 on the two-lane share of a leg, and in Dec–Feb rising with latitude north of 36°
  (+35% interstate, +90% highway at 49°). Weigh stations are matched to their roads at build time and found
  along the route a truck actually drives, so the "40% of lanes see no scale" problem is gone.
- **Map:** the network is drawn under the hubs (interstates with the dashed centre line); trucks follow the road.
- **10 seeds × 4 years, token on** (`runs/compare-v17-c.md` vs v16-a): liquidations 507 (451 before the roads,
  548 in the old straight-line world), owner-operator profit 641 FD per truck-week (631), fleet 707 (669), FD price
  at end $0.0084 ($0.0078), free-path median 61 days (66), top strategy 1.94× (1.81×). Tolls take 6.7M FD a seed,
  about 2% of fuel.
- **Regenerate:** `node packages/data/tools/build-roads.mjs <na.shp> <na.dbf> . --tol 0.03` (data:
  `ne_10m_roads_north_america.{shp,dbf}` from the Natural Earth vector repo, downloaded outside the repo); it
  reads this repo's hub and weigh-station tables, prints routing stats, and rewrites `roads.ts`. Rerun it
  whenever a hub or weigh station is added or moved.

## Players as bad actors (config 0.11.0)

- Jeff's decision (2026-10-28), reversing 0.9.1: player companies may do everything the outlaw AI
  does. `fraud.players: true` opens the gate in `applyAction`; nothing else in the engine changes,
  so the AI-only economy is identical to 0.10.0 (seed 1 reports differ only in the version string).
- **In the client:** the Company tab has a "Safety and authority" card (authority status and bar,
  rating and next review, the four score areas against their alert thresholds, fines, open claims
  and cases, the record's last entries) with the policy selects (hours, speed, maintenance). The
  dispatcher card can carry a rebroker standing order (share of won loads, rate kept, pay the
  hauler or not). A truck heading to a pickup can re-post its load by hand; a loaded truck can
  steal the cargo (after a confirm). The guide still says nothing about any of it.
- Tests: players can take the actions; with the flag off they get "that isn't available to players".

## Realistic tolls and a dearer hour (config 0.12.0)

- Natural Earth's tollway tag already covers the turnpike systems (Pennsylvania, Ohio, Indiana,
  Illinois, New Jersey, New York, Massachusetts, Maine, Kansas, Oklahoma, Florida, West Virginia),
  with their free urban stretches left free; the 0.10.0 note that the Pennsylvania Turnpike was
  mostly untagged was wrong. A curated list in `packages/data/tools/build-roads.mjs` fills the real
  gaps: Maryland's JFK Highway and the Fort McHenry and Harbor tunnels, the Delaware Turnpike, New
  Hampshire's I-95, the Chicago Skyway (3 FD/mi, so trucks go round it), the I-70 overlap on the
  Pennsylvania Turnpike and the West Virginia Turnpike south of Charleston. Entries match by state,
  route and a lon/lat box on the edge's midpoint; blanket per-route rules over-tag free stretches.
- Rates are 5-axle transponder rates from the agencies' 2024–25 schedules (every fleet has a
  transponder): PA 0.75, IN 0.55, NJ Turnpike 0.55, FL 0.45, IL 0.35, OH and NY 0.30, MA 0.25,
  OK 0.25, KS 0.20, DE 1.10, E-470 1.00 FD a mile.
- Routing valued an hour at 90 FD, which sent trucks off the turnpikes onto two-lane roads:
  Pittsburgh–Philadelphia ran 28% on US-30, US-220 and US-522. At 120 FD an hour
  (`roads.routing.timeValueFdPerHour`) it runs the Turnpike end to end: 300 mi, 6.9 h, 178 FD in
  tolls, 5% two-lane. Boston–Chicago takes the Mass Pike and the Thruway (984 mi, 148 FD);
  Chicago–Newark is 771 mi and 133 FD. Tagged toll miles: 4,631.
- 10 seeds × 4 years vs 0.10.0 (`runs/compare-v19-a.md`): tolls 8.7M FD a seed (was 6.8M; 2.6%
  of fuel spend); liquidations 529 vs 507 (ranges overlap), owner-operator profit 645 vs 641 FD
  per truck-week, FD price $0.0082 vs $0.0084, free path 65 vs 61 days.
- Client: the test world's speed buttons were rebuilt with every clock tick, so at the fast
  speeds a tap landed on an element that had just been replaced and never registered. The clock
  text now updates in place and the chosen speed is a class toggle on buttons that stay put.
- Idle trucks: every truck card shows how long it has sat ("Idle at Phoenix for 18 h · sat out 1
  round", from a new `idleSinceT` on the truck that nothing decides on). After 24 hours the Fleet
  tab opens with a red alert card per truck saying why (no driver, authority out, broken down, no
  loads of its trailer within the dispatcher's empty-mile limit and where the nearest freight is,
  only hot loads for a solo driver, vetting, nothing pays the floor, a stretched dispatcher, or bids
  that keep losing) with the button that fixes it; a red "N IDLE" badge sits in the top bar, and the
  ticker and a toast shout once per idle day.

## Counters above the posted price, and above the max (config 0.13.1)

- Jeff's correction (2026-10-28): the sealed round is for **counters**, offers above the book-now
  (anyone who'd take the posted price just books). The 0.13.0 cut capped every bid at the book-now,
  which made counters pointless; a counter now goes up to the ceiling, and past it up to 1.5× the
  ceiling (`board.overCeilingMax`), taken only when nobody offers within the ceiling, cheapest
  first (`scoreBid` ranks over-ceiling counters below every offer within it). So a hot market still
  gets its loads covered, at a price. Board buttons read "Book now" and "Counter".

## Book-now, per diem and driver fatigue (config 0.13.0)

Jeff's design (2026-10-28), the first of three steps toward a market where where you base matters
(next: shipper leverage and contracts, then places and freight flows).

- **Book-now prices** (`freight.ts openBookNow`, `board.ts bookLoad/autoBook`): every load carries a
  take-it-now price next to the sealed-bid round. Take it and the load is yours at once; bid under
  it and wait for the round; nobody pays more than it (bids are capped at the book-now). The poster
  opens it from the origin's load-to-truck ratio (88% of reference where trucks pile up, 98% at a
  balanced market, 110% where trucks are scarce; never above the ceiling) and raises it 8% every
  round the load sits. The dispatcher's "Book loads between rounds" order takes a load when its
  book-now clears break-even plus a margin that shrinks with **desperation**: a truck idle 72 hours
  or a driver more than two weeks from home takes anything that covers costs; a truck sitting at home
  is half as pressed. Dispatchers look every two hours. Bots: greedy hold out for +30%, conservative
  take +12%.
- **Per diem** (`sink:per_diem`): 30 FD for each full day a truck sits idle away from the home hub
  (a layover; the first night is in the cab, and on the road wages cover it). A visiting truck idle
  in Miami is spending money; a local one isn't. Charging 60 FD for every road day cost 100M FD a
  seed and doubled liquidations; 60 FD per idle day was still 39M.
- **Fatigue and home time** (`labor.ts dailyDrivers`): past 21 consecutive days away, fatigue builds
  daily and faster by the week; a day over 10 driving hours builds it too, more for each consecutive
  long day (a legal 11-hour day barely registers; a 15-hour day on falsified logs does). Five days off
  at home reset it; extra days off bank a buffer. Fatigue doubles crash odds at full, slows the truck
  up to 10%, and wears a hire's morale. The "Bring drivers home" order sends a truck home after N days
  out for M days off, during which the dispatcher leaves it alone. A truck due home keeps hauling,
  but only loads that deliver near home or at least 100 miles closer, and runs empty only within
  400 miles or after two days without a homeward load (running straight home from anywhere, the
  first cut, was the other half of the doubled liquidations). Any idle truck can be sent straight
  home from its card. Clean AI carriers bring drivers home every four weeks (a week of mild fatigue
  at the end), corner-cutters every six, outlaws never.
- **In the client:** book-now price, profit at that price and a Book now button on every load
  (loads the company can't take say why and are greyed out); the two new dispatcher rows; days out
  and fatigue on every driver; a red TIRED badge and alert card with Send home; the status line
  shows home time. Guide pages: "Book-now prices" and "Fatigue, home time and per diem".
- Tests: a load's book-now is at or under its ceiling and rises while it sits; a player can book;
  a driver is sent home after the set days, rests, and costs per diem meanwhile; fatigue builds on
  weeks out and long days and resets with days off.
- **10 seeds × 4 years vs 0.12.0** (`runs/compare-v20-e.md`): liquidations 577 vs 529 (ranges
  overlap), owner-operator profit 764 vs 645 FD per truck-week, fleet profit 739 vs 694, FD price
  $0.010 vs $0.0082, free path 37 vs 65 days. Rates run ~12% higher (2.89 vs 2.58 in year 2) because
  about a seventh of the AI fleet is resting at any time, and loads to NPC carriers rose 292 vs 217 a
  day. To watch: fleet wealth 95k vs 147k (fleets take the home-time and per-diem hit across many
  trucks), and crashes 270 vs 190 with 43 willful (the outlaw and corner-cutter personas run drivers
  tired, as designed). Earlier cuts, for the record: 60 FD per diem on every road day plus trucks
  running straight home from anywhere gave 1,224 liquidations; per diem on idle days only, 845.

## Audit (2026-10-28, config 0.9.2)
Six audits of the whole project (engine, the new systems, bots and sim tools, client and shared world, data,
and a simulation campaign); every finding verified, the fixes in `AUDIT.md` with the before/after numbers.
Headline: the action boundary now validates everything a browser sends (one bad value used to freeze the
shared world for everyone), home-hub crowding is engine state (it could split the world), staff pay and
poaching exploits are closed, used trucks arrive with clean paperwork, and the bots stop cheating after a bad
rating and keep working capital. 10 seeds × 4 years: liquidations 451 (548 before the staff/safety layer,
1,059 last night), owner-operator profit 631 vs 620, FD price $0.0078, free path 66 days.
Regression tests: `packages/engine/test/audit.test.ts`.

## The live world (`apps/web`)
One shared, permanent world. There is no game server: the world is a seed plus every player's
actions, kept in the artifact's shared store, and the deterministic engine turns that log into the
same world on every player's page (`apps/web/src/live.ts`).
- **Clock:** the real one, one in-game day per 6 real hours (spec). It never pauses; there are no
  saves, restarts or undo. Every page computes the world up to the current minute.
- **Actions:** each order is written to the player's log in the store and takes effect 2 game
  minutes (30 real seconds) later, at a minute stamped on it. Every page applies actions in the
  same order (minute, player, sequence) before stepping the hour. An action that reaches a page
  after its minute has been computed makes that page replay the log so it agrees with everyone.
- **Joining:** one company per claude.ai account, starting as an owner-operator on an NPC lease.
  Liquidation restarts you on a lease, as for bots.
- **Store layout:** `world/meta` (seed, epoch, clock rate, ruleset; owner only),
  `players/<uid>` (that player's log, written only by them), `players/<uid>/log/<n>` (older
  entries), `players/<uid>/x/tab` (a lease so one tab per player writes; it also gives the page
  the store's clock).
- **Same answer in every browser:** the sim uses `dmath` (`packages/data/src/dmath.ts`) instead
  of `Math.sin/exp/log/**`, whose last bit may differ between browsers.
- **Rules changes:** the world records the ruleset it runs (`RULESET` in `game.ts`). A page with
  different rules refuses to replay it rather than rewrite history. Changing the engine for a
  running world needs a checkpoint of the world at the switch, which isn't built yet.
- **Trust:** pages trust each other's logs. A player could backdate an order by editing their own
  log; an authoritative server (the spec's Postgres + workers) is the fix for that.
- **Test world:** the owner can open a private copy of the rules with pause and speed controls.
  It is never stored and doesn't touch the live world.
- **Screens:** pixel map with every truck (yours cyan, other players lime), load board with hand
  bids, dispatcher (standing orders), fleet, dealer, money (Equipment Finance, the FD exchange
  after launch with play dollars), company and players tables.
- **Art:** every sprite is drawn in code (`apps/web/src/art.ts`) on one palette, with auto-outlined
  shapes. An artist's sprite sheet can replace those functions.
- **Pixel-art client (2026-10-28):** one hue-shifted palette ("Interstate Dusk") shared by the CSS
  and the sprites; nine-slice pixel frames for every panel, card, button, input, ticker and toast,
  drawn at boot and worn through `border-image` (`installTheme`); pixel fonts only at their native
  sizes (Press Start 2P 8/16 px, VT323 20 px) so nothing blurs; 12 × 12 icons on the top bar and
  tabs; a detailed side-view rig (`truckSprite`, wheels that roll) and a chromed pixel logo. The
  map (`apps/web/src/map.ts`, geography in `geo.ts`) is painted at one art pixel per screen pixel
  of the map window (repainted on resize, ~250 ms): biomes with fields, forests, desert and marsh
  textures, coasts with shallows and foam, the Great Lakes and bays, rivers, dotted state lines,
  shaded peaks with snow, two road classes, and skylines sized by freight weight whose windows
  light at night under an amber-to-blue tint. Trucks are top-down sprites in eight headings along
  the real road (yours cyan, other players lime, AI grey), with headlights at night, a marching
  route for the selected truck, and hub labels in a 5 × 7 bitmap font (`font.ts`) that appear as
  you zoom. The title is a 320 × 180 road scene (sky bands, mesas, a billboard, poles, the rig)
  and loading is a rig driving a road.
- **Run locally:** serve `apps/web/dist` and open `local-lanes.html`. Without claude.ai it keeps the
  store in browser storage, and each tab plays as its own company.

## Kill criteria today
No mode passes every criterion on any seed. In the seasons-off baseline (10 seeds × 3 years):
- **Quarterly 90–100% band:** fails in the first quarter (86–89% while companies ramp up from
  their grants) and in some boom quarters (100–107%).
- **Supply never doubles in a year:** fails as measured. With seasons off, the year-over-year test
  compares against day 30 of a cold start, so the ramp from 5,000-FD grants reads as about 5×.
  Year-end supply grows 1.43× in year 2 and 1.16× in year 3.
- **Strategy balance (≤3× within segment):** passes, at 1.6–2.0×. In token mode, newcomers who pay
  to skip the free path reach about 3×.
- **Free path (median within 84 days):** fails on 7 of 10 seeds; the median is 69–288 days,
  depending on where the cycle starts.

## Not yet
Postgres/PostGIS + Redis persistence, OSRM polylines (miles are great-circle × 1.2), real feed
adapters + fixtures, fuel stations, contracts, direct-shipper gate + non-solicit, weather and other
events, DeFi buildings (the surety premium goes to an NPC surety until the Surety Desk exists),
admin dashboard.
