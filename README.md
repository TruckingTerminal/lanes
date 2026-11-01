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
- **Freight and board:** NPC freight with the broker-only split; sealed-bid rounds with scoring and
  rollovers (no NPC carrier since 0.17.0: a load rolls until a carrier takes it or its shipper gives
  up); standing orders. A truck that sees freight but won't take any of
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
  nobody hauls rolls at a rising ceiling and goes unsold when the owner gives up (0.17.0).
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
  before the shipper gives up costs the broker a fall-off charge (0.17.0; it used to go to an NPC
  carrier). Broker bots halve the loads they take after a losing week.
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

## Towns on the road (config 0.16.0)
Jeff: too many blank spots on the map with no truck traffic; those places have people and trucks go in and
out of them. Three things were wrong, and the fix is in the data layer.
- **Too few towns.** Natural Earth's populated places stop at 679 towns for the whole lower 48, so the game had
  536 and whole states saw a load every few days (Montana 0.4 pickups and deliveries a day, Vermont two in two
  months; 70% of all load ends in the 126 places over 250,000). `places.ts` now comes from GeoNames cities500
  (CC BY 4.0; 21,785 US towns with population): **4,786 places**, every town over 10,000, every county seat and
  state capital, every hub, and the largest town of 1,000+ in every half-degree cell that had none. A suburb
  within 5 miles folds into its neighbour with its people counted (a county seat of about the same size keeps
  its name: Naples, not Golden Gate; Kansas City, Missouri, not the Kansas one). Montana has 62 places, every
  county seat among them. Manufactured freight now scales linearly with population (it was the square root,
  which would have handed most of a rural market's warehouse freight to its villages); farm, ranch, mine and
  forest output stays per place, which is what puts a reefer at a town of 1,200.
- **Towns weren't on the road.** The road graph only had nodes at junctions, and a town attached to the nearest
  node: Challis, Idaho attached 75 miles away at the far end of a 267-mile stretch of US-93; Elko, on I-80, 46
  miles off. Every place now splits the road at the spot nearest it (`RoadNetwork.addTerminal` projects onto the
  road's segments), so a route between two towns runs through the towns between them on the real highway, and
  a truck is drawn where it is. Towns sit a median 0.8 miles from the road they join.
- **The road graph had loose ends.** The builder's rounding cell gave two nodes at one spot wherever a vertex sat
  on a cell boundary (551 of them: I-94 met US-41 at the Wisconsin line twice, a foot apart, and never joined),
  and interstates stopped a fifth of a mile short of the highway they meet (Castle Rock's nearest road ran 209
  miles to Denver, 26 miles away). `build-roads.mjs` now merges nodes at one spot, ties any dead end to a road
  within two miles (dead ends 262 → 118, none within two miles of another road), runs a second junction pass,
  and carries a short curated list of roads Natural Earth leaves out (US-20/26 Carey–Arco–Blackfoot, which had
  Challis routing to Boise through Montana; it is 286 miles now). Each place's row also carries the road point it
  joins: the builder looks at the nearest spot on every road within 40 miles and takes the nearest one that
  isn't a real detour to a hub, so the game never routes this at startup (4,786 places attach in 0.35 s).
- **A routing bug** went with it: a town whose road point was a hub's own node (Clovis beside Fresno, suburbs of
  Phoenix, Las Vegas, Seattle and Boise) got no route to that hub at all, and so the wrong market. And a tendered
  load its own carrier booked through the ordinary board kept its tender flag; it now counts as the tender
  accepted.
- **Where freight lands now** (`npx tsx apps/sim/src/traffic.ts 60`, 60 AI days, 476 booked loads a day): towns
  under 10,000 originate 10% of loads and receive 4%; 10–50,000 take 15% and 15%; the 217 places over 250,000
  take 48% and 51% (from 70%). Montana sees 2.1 load ends a day across 32 towns, Idaho 4.5, Kansas 20. The
  blank spots that remain are the national volume: about 1,100 trucks move 476 loads a day for the whole country.
- **Known gaps:** three towns still reach their market the long way round (Sonora and Arnold, California, above
  the Central Valley; Port Angeles, Washington) where Natural Earth has no road within two miles to tie to;
  twelve towns have no road within 40 miles and attach to the nearest vertex; the 118 remaining dead ends are
  real ends or gaps over two miles.
- **Regenerate:** roads first (`node packages/data/tools/build-roads.mjs <na.shp> <na.dbf> . --tol 0.03`), then
  places (`npx tsx packages/data/tools/build-places.mjs <cities500.txt> .`, GeoNames
  `cities500.zip` downloaded outside the repo), since the places' road points reference the geometry.
- **10 seeds × 4 years, token on** (`runs/compare-v23-c.md` vs v22-c): liquidations 578 (621), owner-operator
  profit 551 FD per truck-week (534), fleet 687 (655), fleet wealth 110k (116k), FD price at end $0.012 ($0.012),
  free-path median 27 days (28), crashes 499 (486), Gini 0.64 (0.66). The economy barely moves: the market volumes
  are the hubs', and what changed is where inside each market the freight lands and which road the truck takes.
  A seed takes 190 s instead of 80 because every load now routes between two of 4,786 places.

## The circular economy, built behind switches (toward config 0.18.0)

**Launch pricing, the lean launch and the fuel tax (2026-10-29, behind the 0.18.0 switches).** The
launch price is what the dollars support: with any dollars on hand (the seed plus the farming season's
window) the pool opens two-sided, FD from the pool allocation as deep as the float that survived the
reset (`token.launch.poolDepthShareOfFloat`) against those dollars, and the price is the quotient;
buyers then pay the pool's price, no floor. The reset burns stakes, exit queues and contract stakes
along with wallets above working capital, so every position after launch is re-posted in real FD
(the grace period applies). An IFTA-style fuel tax (`costs.fuelTax`, sink `fuel_tax`) is filed at
each month's close on every gallon burned that month, on the road and idling. The report's
`demand.usdPerThousandCompaniesMonth` is the new buying that would hold the end price, with
`token.newCompanies.usdWalletMult` as the lever to sweep. See TOKENOMICS.md "The launch price is
what the dollars support".

**The big sinks (2026-10-29, behind switches).** `costs.salesTax` taxes every purchase of goods and
services (sink `sales_tax`). `businesses` opens shops, truck stops and fuel stations as player assets
at a hub, bought for FD through the catalogue split plus a bond, with weekly upkeep (`business_upkeep`):
a shop does the hub's maintenance, repairs and rebuilds at its own price (parts a sink, `parts`), a
truck stop halves idling for a nightly fee, a fuel station keeps a margin on its hub's fuel.
`labor.managers` adds salaried operations and maintenance managers (`management`): an operations
manager is a must past four trucks, one per 25 beyond (the extra trucks park after the grace period),
and brings a crash, pull-in, morale and skill edge. The vest is 0.25% a week at most, above the TGE
price only. Truck stops are sites on the interstates (`businesses.sites`, `w.sites` with lat/lon),
priced by traffic: fuel by the 400-mile block rule, rests at the nearest stop, and road service for
breakdowns on the road (`road_service` when no shop is in reach). `token.circular.rateStabilizer`
moves NPC rates toward the sink-to-faucet target each month.

**Phase A (2026-10-30, ruleset 0.18.1).** Terrain on the roads: `packages/data/src/elevation.ts` is a
0.1° grid of NOAA's ETOPO1 relief over the continental US (built by `packages/data/tools/build-elevation.mjs`),
and `terrain.ts` gives every edge and route its climb, its miles on grades over 3% and its miles above
2,000 m; lanes carry `climbM`, `mountainMi` and `passMi`. With `roads.terrain` on (the live profile):
the climb's gallons go into the fuel bill and into shippers' rates like tolls, grades slow a leg to
the mountain speed, the share of a leg on grades lifts breakdown and crash odds, and in winter a leg
over a pass can be held by a closure for a few hours (`passClosures` in the report). Managers are now
people from the labor pool (`StaffKind` `opsManager` / `maintManager`: skill, asking pay, poaching,
morale, a week's experience a week; the edge scales with the best one's skill; weekly pay a sink).
Truck stops cost 150k with a 50k bond and charge 20 a night, and more sites open as stops get built.

**Parking (2026-10-30, ruleset 0.18.2).** A truck sleeps at a site. Every site is a free public rest
area with spaces by its traffic (`businesses.parking.spaces`, 5 to 40: about 3,000 spaces for 2,300 trucks, so the busiest corridors fill); a player's truck stop on it
adds shore power at a quarter of the idling, fuel, the shop and a nightly price the owner sets
(`set_parking_price`, 10 to 40), and owners buy more spaces through the catalogue split
(`add_parking`). Shutting down on the shoulder is illegal unless the truck broke down: a patrol
ticket (`shoulderFineFd` at `patrolOdds`, sink `fines`) and the full idling. Each hour a driver plans
the night (`sites.ts planNight`): the last site with room the day's hours still reach, early if the
next is beyond them; a site found full sends them on. The report counts nights at sites, nights on
the shoulder, tickets and full sites.

**The trailer pass and the theft corridors (2026-10-30, ruleset 0.18.3).** What each trailer is like
from the cab (`equipmentOps`): a loaded mile burns more fuel than an empty one and climbs harder; a
loaded reefer's unit burns diesel by the hour on the road, through the night and at the gate (sink
`reefer_fuel`); a flatbed takes an hour or two to secure and tarp and risks a weather damage claim on
its open deck, more in a northern winter, less with a skilled driver; drivers earn 5% more a mile on
reefer and 12% more on flatbed. Docks keep hours (`docks`, `docks.ts`): cold chain, groceries,
beverages and parcels by appointment slot at any hour, set at booking from the arrival estimate; other
dry van first come in weekday business hours; flatbed in daylight, Monday to Saturday. Early for a
slot, at a closed dock or past a slot, a truck waits at the gate; the receiver's hours move the due
time, a missed slot does not. Cargo theft (`theft`, `risk.ts`): a loaded truck asleep is the target,
by where it sleeps (the shoulder three times a rest area, a truck stop's security a third of it), the
CargoNet hotspots it is near (Southern California, Texas, Georgia, Florida, Illinois, Tennessee, New
Jersey) and what is aboard; a theft loses the load, the carrier pays the cargo deductible, a
pool-written policy pays the rest (a sink), and the truck goes on empty after the police report.
Shippers pay for the risk in the lane rate and on high-value loads; insurers price a fleet by where
it sleeps. The report adds dock waits, missed slots, flatbed damage and cargo thefts.

**Dry-van dock hours (2026-10-31, ruleset 0.18.4).** Jeff's call. With dry-van docks open 60 hours a
week, trucks arriving at all hours waited 13 hours on average even after dispatch learned to plan
around the hours. Now the bigger dry-van docks ship and receive around the clock, and the rest keep
weekday business hours, 7am to 7pm (`docks.fcfsAroundTheClockShare` 0.5, `docks.hours.fcfs`).
`docks.aroundTheClock` ranks places by their first-come dry-van freight (production plus
consumption) and opens the biggest until they handle half of it: 137 places, every major metro. The
rule covers pickups and deliveries, and the dispatcher's wait estimate reads it. In batch v41-a,
compared with the 0.18.3 rules on the same four seeds, trucks spent about 30% fewer hours waiting
(656k waits of 13.0 hours became 550k of 10.9). Missed appointment slots fell 5%. The year-one rate
eased from 4.77 to 4.66 FD a mile and liquidations rose from 760 to 884: faster docks need fewer trucks
for the same freight. The end price rose from $0.00046 to $0.00052 (`runs/compare-v41-a.md`). The live
world restarted on it (world/meta version 19).

**The package (2026-11-01, ruleset 0.19.0).** Jeff's "Go". Every switch of the combined test and the overnight
build is on as live levers (`packages/config/src/live.ts`; TOKENOMICS.md "The package switched on"): the trucks
at mid prices with the NPC used lot and the deposit credit, the staff ladder with direct freight and the scale
discounts, the theft gaps with contract theft removed, the robbers and the Back Lot v1 on in the beta, the
supply path at +10%, the logbook paid locked at the TGE with its shop items, the bridge, the opening auction (a
40M FD tranche), the pool's decaying fee, the beta's dollar window for rigs, trailers, facilities and businesses,
and the team allocation (15% of the cap) on a real-time linear vest. The client gained the dollar buttons for
facilities and businesses and lost the steal button. Batch v52-a ran the exact profile first
(`runs/compare-v52.md`): no crashes in three seeds of four years; the price ended between 79% and 143% of launch
with the pool's dollars kept ($71k → $70k) and a worst drawdown of 59%; crews hired fell from 1,393 to 345 under
the real stake and the one-crew rule; the bridge cleared 57.2M of 57.8M FD requested at a mean wait of 17.5 days
and was capped on two days. The live world restarted on it (world/meta version 20, live page version 36).

Jeff's direction (2026-10-29, TOKENOMICS.md "The circular economy"): a capped FD supply, staking as
the bond behind every licence, player-funded pools for insurance, factoring and surety, payment
terms, and a season schedule for later airdrops. All of it is on main and off by default
(`token.circular`, `token.staking`, `token.pools`, `token.payment`), so the live world's rules are
unchanged until the ten-seed sizing runs (`runs/v25-*`) settle the numbers and a restart turns it on.

- **Reserve ledger** (`ledger.ts`): the cap (1B FD) is minted once at genesis into the reserve
  (60%), the launch pool, the airdrop seasons and the treasury. Faucets draw on the reserve or their
  allocation, sinks refill it; only buybacks, the sell fee, forfeited airdrop slices, the instant
  unstake haircut and the season-close burn destroy FD. Reference rates scale with reserve ÷ genesis
  reserve (clamped 0.5–2), and the freight-volume dial stands down.
- **Staking** (`staking.ts`): 5 trucks free, 10 at 20k staked, 30 at 100k; facilities 1 / 3 / 6 on
  the same stakes; the broker licence needs 75k. A revoked authority forfeits the stake, judgments to
  the victims first; liquidation releases it to creditors. Leaving takes a 28-day queue limited to 2%
  of all staked FD a day, or an instant exit at a 25% haircut, burned. Over a tier: 14 days' grace,
  then idle owned trucks park; an unstaked broker takes no loads. Bots stake for the next tier when
  they can spare it; established fleets and brokers start staked.
- **The whale rules** (`token.ts`): the sell fee rises with the sale's price impact (5% + 1 × impact,
  up to 25%, burned) and each company may sell 2% of the pool's FD a day.
- **Pools** (`pools.ts`): one mutual-pool primitive, units at net asset value, an exit queue paying
  at most 5% of a pool a day after 28 days. Insurance: a capitalised pool writes policies at a
  markup easing from 1.3 at the minimum capital ratio to 1 at twice it, earns the premiums, pays the
  insured share of crash verdicts and a player shipper's lost cargo as far as it goes; the NPC
  insurer charges a 25% backstop markup while a pool exists and is thin. Surety: the pool carries
  broker bonds while capitalised and covers a wound-up broker's carrier up to the bond. Factoring
  below.
- **Payment terms** (`receivables.ts`): freight is paid net-30 game days; a payee may take quick pay
  at 3% or factor the invoice, the pool advancing it at 2.5% × its markup (NPC factor at 1.4× as the
  backstop) and collecting at due. Bots factor when short of working capital. A broker wound up
  before paying leaves its carrier to the surety.
- **Airdrop seasons** (`token.ts`): after the 10M launch pot, 6M, 4M and 3M at the next three year
  ends, each split by that season's Miles 0.6 / operating profit 0.4, scaled down by how far the
  season's average price ran below the launch price, never up; unfinished vests roll into the new
  one. Still to build: the unlock boosts (TOKENOMICS.md), which need the client's shop.

## A real market: no NPC carriers, shippers and carriers that blink sooner (config 0.17.0)

Jeff's design (2026-10-29): freight is hauled only by AI and player carriers. An NPC carrier taking a
load off the board is not how the market works, it hid the fleet's real capacity, and once FD is sold
for dollars it was a faucet that fired without any work done (a broker collected the NPC shipper's
contract rate on a load no truck hauled, then paid an NPC carrier). Carriers do not sit either: a
truck idle past a day deadheads or takes a cheap backhaul, because sitting costs more.

- **No NPC carrier, no NPC expediter.** A load nobody takes rolls to the next round with its ceiling
  up 10% (was 5%), its book-now up 12% (was 8%), and its appointment moved back a round. It rolls
  until a carrier takes it or, after 10 rounds (five days), the shipper gives up and the freight is
  lost: status `expired`, nobody paid. A broker holding the contract pays the shipper a fall-off
  charge of 15% of the contract (`brokerRisk.fallOffShare`), and will pay carriers up to that much
  over the contract, or up to spot, to avoid it; a carrier that re-posted the load pays the broker the
  same on the rate it took it at. A facility's goods go unsold. Open loads pile up where trucks are
  scarce, which lifts that market's load-to-truck ratio and every new rate posted there: the market
  sets the price, not a fallback at 95% of reference.
- **Sitting costs money from the first day.** A crewed truck idle at day's end burns 8 gallons
  idling for the cab at the day's pump price (`costs.idleFuelGalPerDay`, sink `idle_fuel`); per diem
  covers the driver from the second day as before. A dispatcher is fully desperate after 24 idle
  hours (was 48). Bot fleets widen their repositioning search after four rounds instead of six, and
  the random bots after two to four rounds instead of three to eight.
- **Measured** with `npx tsx apps/sim/src/idle.ts` (every truck sorted by what it is doing each
  game hour, 30 days after a 20-day warm-up, the live population): idle spells over a day fell from
  7.5% to 2.7% of spells, trucks sitting past 36 hours at any moment from 15 to 3 of 1,100, and
  trucks moving at any moment rose from 417 to 447. Two thirds of the fleet still stands still at
  any instant: 34% are drivers out of hours mid-trip, 8% on home time, 7% at a dock, 6% waiting.
- **The AI fleet is capped during beta** (`token.betaAiFleetCap` 1: bots replace and sell trucks
  but add none until launch), so the market stays short of trucks until humans bring them. Jeff's
  call: the starved season is the first airdrop farming season, and early commitment is what it
  pays; saturation comes from entry, and after launch freight scales with the carrier base.
- **The airdrop splits by Miles and by profit** (`airdrop.weights` 0.6 / 0.4, to be tuned): beta
  operating profit at launch, losses scoring zero, so playing to win counts beside playing a lot. A
  company shut down or in liquidation at launch forfeits its share. The unlock-boost catalogue
  (achievements and FD-burning shop items that bring slices forward) is proposed in TOKENOMICS.md
  and not built yet.
- **What it exposed.** The national freight volume (`freight.baseLoadsPerRound` 420, a PoC
  assumption) was sized on NPC carriers absorbing half of it. Without them the 1,100 AI trucks are
  saturated: they haul about 560 loads a day whatever is posted, 45% of loads expire at the 2.7×
  ceiling cap (11% of them brokered), and when a load gives up there is a median of one idle truck
  with that trailer within 400 miles and 23 nationwide. Cleared rates averaged 7.6 FD/mi at 62%
  margins in that starved market. Jeff kept the volume: the starved market is the first airdrop
  farming season (TOKENOMICS.md), with the AI fleet capped so humans bring the trucks.
- **Ten seeds, four years** (`runs/compare-v24.md`, v24-c against 0.16.0's v23-c): with the AI fleet
  held at 1,100 trucks for the two beta years, rates ran 5.9–6.1 FD/mi (3.3 and 2.9 before) and
  owner-operators cleared about 3,000 FD a truck-week (551), so beta FD ballooned to 360M before
  year 2 (66M) and the launch reset burned 337M of it (32M). The sink criterion fails through beta
  (operating sinks 54–80% of faucets) and holds after launch (97%). After launch the uncapped
  fleet grows to the dealer caps, rates fall to 4.1 then 3.3, 257 loads a day still expire in
  booms, and the FD price ends at $0.0084 ($0.012 before). Liquidations 1,424 (578): 100
  owner-operators, 50 fleets and 60 brokers, the brokers bled by fall-off charges on contracts no
  truck would cover; the free path shortened to 20 days (27). Four uncapped seeds (v24-a) show the
  AI fleet alone closing the gap by year 2: 2,609 trucks running, rates 3.3 in year 2, half the
  liquidations and a third of the owner-operator profit. The post-launch economy is reworked in
  0.18.0 (TOKENOMICS.md "The circular economy"), which is where these numbers get fixed.

## Shipper leverage, local-first tendering and contracts (config 0.15.0)

Jeff's design (2026-10-28): the more leverage shippers have (trucks piled up, few loads per truck),
the more they work exclusively with local carriers; Miami's shippers almost exclusively, Chicago's
and Los Angeles's hardly at all. Local carriers hold contracts; when produce season sends spot past
the contract, the owner chooses between serving the contract and chasing spot.

- **Local-first** (`contracts.ts localShare`): each market holds a share of its loads for carriers
  based within 150 miles for the first round: 50% − 0.35·log₂(load-to-truck ratio), clamped
  10–90%, from the smoothed ratio the reload index already tracks (Miami's vans ≈ 85%, a tight
  market ≈ 15%). `mayTake` gates every path to a load: standing-order bids, auto-booking, hand
  counters and book-now. A local-first load gets a round more before its shipper gives up.
- **Contracts**: every week each market's shippers offer contract lanes to local carriers in good
  standing (reputation × tender acceptance), more where trucks pile up, only for trailers the
  carrier runs: 1–3 loads a week on a lane at the market's trailing contract rate (the brokers'
  level) for 91 days, two per company, offers standing a week. Tenders are loads created on the
  contract's lane and places, held 12 hours for the carrier at the contract rate (spot prices on
  paper, so a lapsed tender is an ordinary spot load, which the same carrier can counter for).
  Acceptance is a moving average; below 85% after four tenders the shipper cuts a load a week and
  the carrier is passed over by every local shipper for 30 days; at 90% or better the term renews.
- **Dispatcher and bots:** the `contracts` standing order takes offers and honours tenders onto an
  idle truck within reach, unless `spotAbovePct` says to let a tender lapse when spot runs that far
  above the contract. Conservative AI honours every tender; greedy chases spot at +15%; random in
  between. Players default to honouring.
- **Client:** a Contracts card on the Company tab (offers to sign or decline, contracts held with
  acceptance, the local-first share at home, any shipper ban); tender alerts with a truck picker
  and a "leave it for the board" button, a TENDERS badge; local-first and tender tags on the load
  board; a "Local first" column on the join table; a guide page.
- **Desperation, backhauls and the way out** (Jeff, 2026-10-29: a truck of his sat 20 days in
  Miami; dispatchers must get desperate in a day or two, deadhead or take a cheap backhaul to a
  better market, and price the exit into freight going in). Dispatchers are fully desperate after
  48 idle hours (was 72); a desperate truck takes a backhaul up to 12% below break-even when the
  destination's load-to-truck ratio beats where it sits by 10%; a truck with nothing bookable for
  two rounds runs empty to the market where the days saved waiting are worth more than the empty
  miles (`bestExitHub`: a carrier's expected wait at a market is 1 ÷ its effective load-to-truck
  ratio, and a visitor sees only the share of loads not held for locals, so a visitor in Miami
  waits ten days and leaves while a Miami carrier waits a day and stays; a day idle costs 400 FD of
  opportunity against 1.2 FD per empty mile). The old rule only moved to a hub with surplus freight
  within 400 miles, and every Florida hub was flooded. The default dispatcher moves after two idle
  rounds. The expected empty run after delivery is now the real exit from a dead market (clamp
  250 → 800 miles), and freight into such a market carries 60% of that deadhead per loaded mile
  (`rates.exitDeadheadShare`), so a short load into Miami pays a lot more per mile than one into
  Atlanta. Dispatch teams weigh a destination's market one to three loads ahead by skill
  (`board.lookaheadFdPerRatio`). A first cut (desperate at 36 h, 25% below break-even, any truck
  idle a day running up to 800 miles to the best ratio) sent fuel up 64% and doubled liquidations;
  the value rule fixed it. In a 240-day AI world after the fix, at most 17 trucks sit idle in Miami
  at once, none for five days, and the longest idle truck anywhere is a driver on home time.
- **10 seeds × 4 years vs 0.14.0** (`runs/compare-v22-c.md`): liquidations 621 vs 526 (ranges
  498–743 and 481–589 overlap), owner-operator profit 534 vs 647 FD per truck-week, fleet wealth
  116k vs 102k, FD $0.012 vs $0.011, free path 28 vs 39 days, on time 94.6% vs 97.0%. Fuel is 609M
  vs 426M a seed: trucks that used to sit now run, much of it empty out of dead markets, and crashes
  rise with the miles (486 vs 328). The dial is `bookNow.desperation.opportunityFdPerDay` (400): lower
  it and trucks wait longer before deadheading.
- **Needs attention** (Jeff, 2026-10-29): the moment a truck has no driver, the client toasts it and
  the Fleet tab opens with a "Needs attention" card and a Hire button (a delivered truck says so
  too); the same card warns of cash under two weeks of fixed costs, weeks in the red before the
  company is wound up, a dispatch team covering under 80% of the fleet, and a parked or idle truck
  carrying three or more defects, each with the button that fixes it; a TO DO badge counts them.

## Places, commodities and appointments (config 0.14.0)

Jeff's direction (2026-10-28): the whole country has people in it and they all need goods; every
place produces something, even if only in season; loads should carry a commodity because a
commodity brings its own urgency. Design in `DESIGN-PLACES.md`.

- **Places** (`packages/data/src/places.ts`, generated by `tools/build-places.mjs`): at 0.14.0, 536
  of them from Natural Earth's populated places (every lower-48 place over 50,000, state capitals,
  hubs, and the largest town in every one-degree cell that had none), attached to the road graph at
  the nearest junction. Since 0.16.0 (above): 4,786 from GeoNames, every town over 10,000 and every
  county seat, each splitting the road beside it. Each belongs to the market it reaches by road
  soonest among its nearest hubs.
- **Commodities** (`commodities.ts`): 25, each with trailer, cargo value, appointment window,
  spoilage and season. **Economy** (`economy.ts`): consumption per capita, a state production table,
  and overrides for the places that matter more than their size (ports, Permian and Bakken oilfield
  freight, Salinas and Yuma and Homestead produce, Garden City meat, Gary steel, Detroit parts,
  High Point furniture, Green Bay paper…). Produce follows regional calendars. `flows.ts` turns the
  tables into each market's mix by trailer and month and into shipper and receiver weights.
- **Engine:** a load draws its commodity from its market's mix, a shipper place and a receiver place
  by weight, and is routed place to place over the roads (A* for place legs; long hauls through the
  nearest hubs so a route costs a fraction of a full search; a quick great-circle estimate for
  scanning boards). Its market, board and rate per mile are unchanged; its miles, hours and tolls
  are the real ones. Trucks stand at and move between places; weigh stations, tolls, winter risk and
  crashes follow the place route. The **appointment** (window plus the legal drive) caps the due
  time; a perishable past its spoil time is rejected: no pay, a cargo claim of half its value.
- **Client:** towns drawn on the map; the board shows shipper and receiver towns, the commodity,
  the appointment and the spoil time; status lines name the town; a guide page on commodities.
- Performance: 120 days in 8.5 s (was 48 s before A* and the estimates; 5 s without places).
- **Remote pickups pay a premium** (`rates.remotePremiumPer100Mi` 8%, capped at 25%): a shipper far
  from its market covers the empty run to it. Without it, owner-operator profit fell a quarter, all of
  it empty miles to shipper towns.
- **10 seeds × 4 years vs 0.13.0** (`runs/compare-v21-b.md`): liquidations 526 vs 577, fleet wealth
  102k vs 95k, owner-operator profit 647 vs 764 FD per truck-week (the deadhead to towns that the
  premium only partly covers; still above 0.12.0's 645), FD $0.011, free path 39 days, on time 97.0%
  vs 98.4% (appointments), cargo claims from spoilage 20k FD a seed, fuel 426M vs 362M (loads run the
  real place-to-place miles and trucks run empty to the shipper), crashes 328 vs 270 with the miles.
  A first run died on a negative double-brokering fine (a counter can now clear above the rate a
  re-posted load was won at); the spread is floored at zero.

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
- **Hybrid client (2026-10-29):** the menus and panels are Preact components in Trucking
  Terminal's skin (`apps/web/src/ui/`, tokens and all 34 themes in `themes.css`, inlined at build;
  a theme picker on the title screen and top bar); the world stays pixel art. The load board is
  laid out like DAT One (`ui/panels/Loads.tsx`: search bar, sortable results, a row that opens into
  Trip, Rate and Company with Book now and Counter), and every panel and the map can expand to the
  whole window (Esc restores). State: `state.ts` (two change channels: `tick` each frame for the
  clock, `data` when panels should re-render); the map canvas stays imperative (`mapview.ts`).
- **PixelLab assets** (`apps/web/assets`, made with `apps/web/tools/pixellab.py` on the LANES
  palette; the API token lives in `.pixellab.token` at the repo root, never committed): the
  top-down truck sheet (eight headings in one PNG with its layout JSON; the trailer is recoloured
  by equipment and the cab by owner in `sprites.ts`), side-view rigs for the cards (a hollow
  white trailer from background removal is filled at load time), four scenes and six portraits.
  `tools/asset-pass.sh` regenerates everything but the truck sheet. Costs on the account: one
  generation per image, about ten per eight-direction object.
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
