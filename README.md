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
- **In the client:** a Staff tab (hire, pay, seat, team, poach, match offers) and a Guide tab. No
  Safety screen yet: player companies run legal by default. A revoked authority files again
  automatically when its bar ends.

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
