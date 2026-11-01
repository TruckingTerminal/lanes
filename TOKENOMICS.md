# LANES tokenomics: FD as a real-money token

Design proposal, modeled in the sim (config `token`, `buyback`, `freeEntry`; engine
`token.ts`, `buyback.ts`, `capacity.ts`). Every number is an assumption to tune.

**This changes the spec.** Spec v0.2 keeps FD off-chain and never convertible, and launches a
separate fixed-supply token ($LANES) in Season 2 that converts to FD one way only. Here, at Jeff's
direction, FD itself becomes buyable and sellable for dollars after a beta. The spec's own risk
table names "selling FD for real money" and "token death spiral" as risks and relies on FD staying
a soft currency to contain them; this design gives that protection up, so the sink design has to
carry the load instead.

## The one equation

The pool holds every dollar players can take out, so by accounting:

> dollars players take out − dollars players put in = treasury buybacks + the drop in the pool's
> dollars − buy fees

The final runs match it to the dollar. Players as a group can only take out what the treasury
spends on buybacks, plus whatever seed liquidity sellers drain from the pool. Dollars that one
player puts in go to the players who sell.

Deflation doesn't add dollars. Burns and sinks decide how many FD those dollars are spread across,
which is the price. They don't decide how many dollars there are. If the goal is for players to
earn about $X a week in total, the treasury needs about 2X a week in real revenue at a 50% buyback
share.

## Lifecycle

| Phase | When | What happens |
|---|---|---|
| Beta | In-game years 1–2 (about 6 real months at the live clock) | Today's seasons-off economy. FD is play money and can't be bought or sold. Miles accrue under the anti-farming caps. |
| Launch | End of in-game year 2 | Beta FD resets (below), the airdrop starts unlocking, and the treasury opens the FD/USDC pool. |
| Live | After launch | Anyone can buy FD, and anyone can sell FD that isn't locked. Half the treasury's revenue buys FD back and burns it. |

## Launch

1. **Equipment Finance pays out** its cash to depositors, as at a season close.
2. **Beta FD resets:** each company keeps its working capital (the larger of 25,000 FD and four
   weeks of its own spending), and the rest is burned. What it keeps is **locked**: it can be spent
   in the game but not sold. Spending uses up locked FD first, so only FD earned after launch can be
   cashed out. Trucks, facilities and loans carry over.
3. **Airdrop:** 10M FD split pro rata by lifetime beta Miles (spec §Points: "Miles convert; FD
   never does"), capped at 1% per company. FD past the cap is never minted.
   - 25% unlocks at launch.
   - The other 75% unlocks a 26th at a time over 26 weeks, in each week the company delivers,
     brokers or ships at least 3 loads. A week below that forfeits its slice.
   - A company can claim the remainder at once for half. The haircut is never minted.
   - Liquidation forfeits whatever is still locked.
4. **Liquidity:** the treasury pairs $250k of its own money with FD minted at the launch price
   ($0.01), so 25M FD, in a constant-product pool. This is protocol-owned and never withdrawn.

## Live market

- **Pool:** constant product, x·y = k. Buying pays 1% in dollars to the treasury, and selling pays
  5% in FD, which is burned (the spec's 5% protocol cut on secondary sales).
- **Locked FD:** launch carryover and every post-launch starting grant are spend-only, so a fresh
  account can't cash out its 5,000 FD.
- **Treasury revenue:** pool buy fees plus a stand-in for other real revenue (cosmetics, premium,
  asset sales: $5 per active company per week). Half buys FD from the pool, spread a seventh a day,
  and burns it. The other half runs the company.
- **Holding cost stays on** (2% a week on cash above working capital). It falls on hoards, not on
  operators' margins.
- **Profit tax:** each company's weekly operating profit (freight and facilities) above 1,000 FD
  is taxed and the tax burned. Losing weeks and small operators pay nothing. This is the main
  deflation lever. It starts at 40%.
- **Stabilizer:** after launch the profit-tax rate is the first stabilizer. Each month it moves 5
  points toward 100–104% operating sinks/faucets, within 20–70%. NPC freight volume moves only once
  the rate is at a limit, down to 0.75×.
- **Freight grows with players:** NPC freight scales with the number of carriers, so newcomers find
  loads instead of crowding the same ones. The tax stabilizer grows the sink alongside it.
- **Dealer prices stay in FD**, and every truck, rebuild, facility and fee burns. Pricing assets in
  dollars (the spec's oracle pricing) would make sinks pro-cyclical with the price: a falling FD
  means more FD per truck, fewer purchases, a bigger surplus and a lower price again. Fixed FD
  prices let a cheap FD draw buyers in.

## Deflation levers, ranked by what the runs showed

| Lever | Effect | Cost to players |
|---|---|---|
| Operating sinks ≥ faucets after launch | Decides the price: each point of operating surplus is FD sold into the pool | Lower operating margins |
| Profit tax (40% above 1,000 FD a week, burned) | About two-thirds of all FD burned after launch | Falls on fleets and brokers; without the allowance it also kept free-path drivers from building a cushion |
| Squeezing NPC freight (volume floor 0.5) | About as much deflation as the profit tax | About a third more liquidations; owner-operator wealth halves |
| Treasury buyback (50% of revenue) | Burns what it buys; sets the price floor | None directly |
| Sell fee (5%, burned) | Small: 3% → 5% added about 3% to the end price | Exits cost more |
| Fuel rack spread | None: 80% of fuel moves pass to shippers as surcharge, so faucets rise too | — |
| NPC freight growing with new players | On its own, harmful (price −39% in a test). With the tax stabilizer it's better than fixed freight on price, failures and balance | The tax rate climbs to its 70% ceiling |

## Anti-sybil and anti-farming

- Post-launch starting grants are locked.
- The beta airdrop is capped per company and unlocks only with continued play.
- The spec's Miles anti-farming rules all apply in beta: a daily cap, lane-pair limits, and
  rate-outlier loads earning zero.
- Not built yet: same-owner detection and the spec's verified login and device checks. Without
  them, the locked grant is the main barrier.

## What the runs show

**Current default (freight grows with players, tax stabilizer), 10 seeds × 4 years** — table in
`runs/compare-v12-token.md`, against the version below:

| Measure | Fixed freight, 40% tax | Freight grows, tax stabilizer | Stress (no newcomers, $2) |
|---|---|---|---|
| Price at end (launch $0.01) | $0.0054 | **$0.0073** | $0.0039 |
| Supply after launch → end | 62.5M → 49.7M | 62.5M → 45.7M | 62.5M → 52.3M |
| Companies liquidated · in debt at end | 364 · 181 | 335 · 130 | 265 · 119 |
| Owner-operator profit per truck-week | 283 | 344 | 313 |
| Top strategy vs segment median | 2.94× | 2.30× | 1.92× |
| Profit-tax rate at end · NPC freight at end | 40% · 1.00× | 70% · 1.36× | 70% · 1.00× |

The tax ends at its ceiling in both live cases, so sinks are only just keeping up; the next lever
would be broker margins, where most of the extracted dollars come from.

**Previous version (fixed freight, fixed 40% tax).** Config 0.7.0, 10 seeds × 4 in-game years (2 beta + 2 live), seasons off, demand cycle on. Full
table: `runs/compare-final-token.md`. Means across seeds, with ranges where they matter.

| Measure | No token | Token | Stress: no newcomers, $2/company-week |
|---|---|---|---|
| Supply before year 3 / year 4 close | 69M / 75M | 55M / 50M | 63M / 65M |
| Supply growth, year 3 / year 4 | 1.16× / 1.10× | 0.92× / 0.91× | 1.06× / 1.04× |
| Launch: burned / kept, locked | — | 26M / 34M | same |
| Price by live quarter ($/FD, launch $0.01) | — | 0.0067 · 0.0060 · 0.0052 · 0.0049 · 0.0049 · 0.0049 · 0.0051 · 0.0053 | 0.0064 · 0.0052 · 0.0040 · 0.0034 · 0.0031 · 0.0029 · 0.0027 · 0.0026 |
| Operating sinks/faucets after launch | — | 98% | 98% |
| Burned after launch: profit tax / buyback / sell fee | — | 53M / 33M / 3M | 54M / 17M / 3M |
| Treasury revenue / spent on buybacks | — | $348k / $173k | $119k / $60k |
| Pool dollars at end (seeded $250k) | — | $184k | $127k |
| Net dollars out: OO / fleet / broker / newcomers | — | $12k / $52k / $180k / −$6k | $10k / $42k / $130k / — |
| Per company-week: OO / fleet / broker | — | $0.27 / $5.70 / $14.38 | $0.25 / $4.74 / $10.36 |
| Airdrop minted / forfeited / lost to early-claim haircut | — | 7.5M / 0.6M / 1.8M | same |
| Newcomers after launch | — | 204 | 0 |
| Companies liquidated at least once (of them OOs) | 234 (222) | 364 (250) | 255 (236) |
| Companies in debt at end | 77 | 181 | 111 |
| Avg wealth: OO / fleet / broker (FD) | 50k / 364k / 548k | 23k / 171k / 97k | 28k / 179k / 97k |
| Free path: median days | 173 | 132 | 173 |
| Top strategy vs segment median | 1.99× | 2.94× (up to 3.9×) | 1.91× |

What it shows:
- **With revenue at $5 per company-week and steady newcomers, the token deflates and the price
  holds.** Supply shrinks about 9% a year after launch. The price falls about half in the first
  live year, until buybacks absorb the surplus, then steadies and edges back up.
- **When revenue drops and newcomers stop, the price slides all the way down** (−74% by the end)
  and supply grows again. The buyback is a third the size, so sellers drain twice as much of the
  pool's seed.
- **The identity holds:** $238k taken out = $173k of buybacks + $66k of pool drawdown − $1k of
  fees. Brokers take three quarters of it.
- **Paying newcomers lift the free path** (median 132 days) but break strategy balance in their own
  segment, and more companies fail because the newcomers crowd the same freight.

## Risks and open decisions

- **Money buys Miles.** A newcomer who buys FD to skip the free path earns 3–4× the median
  newcomer's Miles per hour, which breaks the strategy-balance criterion inside the newcomer
  segment. The spec's mitigation ("buying assets never adds Miles directly") doesn't survive
  buyable FD. Miles matter after launch only if there's a later airdrop.
- **Growth crowds the market.** NPC freight doesn't grow with the player count (growing it sank the
  price), so about 200 newcomers in two years compete for the same freight. Liquidations rise
  with them; without newcomers, far fewer companies fail. More players need either more NPC
  freight with sinks that scale alongside it, or new kinds of freight such as player shippers.
- **Price depends on revenue.** In the stress case (no newcomers, $2 per company-week)
  the price falls steadily. Nothing in the sinks can replace revenue.
- **Brokers extract the most dollars.** They have the largest FD margins and few assets to
  reinvest in.
- **Small operators carry the failures.** In every mode, most liquidations are owner-operators.
- **Launch-day stress:** about 40% of airdrop recipients (the bots set to claim early: 246 of
  577) take the instant claim at half value, and sell pressure is highest in the first live year.
- **Parameters to tune:**
  - The launch price (anything works if the pool is deep enough; the price finds the level where
    buybacks absorb the surplus).
  - Seed size, the profit-tax rate, the airdrop size and unlock terms, and the revenue assumption.
- **Legal:** set aside at Jeff's request. The spec's legal section still applies to any real
  launch.

## Airdrop by Miles and by profit, with unlock boosts (Jeff, 2026-10-29)

Decided: the airdrop pot splits by two pro-rata shares, **Miles** (play as much as possible) and
**beta operating profit** (play to win: research, pricing, positioning, risk), at `airdrop.weights`
(0.6 / 0.4 to start; the weighting is still to be tuned on the runs). Profit is the company's running
operating result at launch, freight plus facilities, so profit spent on trucks still counts; losses
score zero. Fines, liability, cargo claims, crash bills and the broker fall-off are costs, so a bad
actor who gets away with it scores on what it kept, and one that is shut down (authority revoked) or
in liquidation at launch forfeits its share. The 1% per-company cap stays.

Decided: during beta the AI fleet may not grow past its starting size (`token.betaAiFleetCap`), so
the market stays short of trucks until humans bring them: early commitment is what the starved
season pays, as in a first farming season, and saturation comes from entry.

Proposed, not built: the 75% that vests over 26 weeks stays gated on play (three loads a week, a
missed slice forfeited), and the weekly slice grows with what the company achieves:

| Boost | Effect on the weekly slice |
|---|---|
| 50 / 100 loads delivered on time in a row | +10% / +20% |
| A million-mile truck in the fleet | +10% |
| A clean compliance review | +10% |
| A contract term completed in full | +10% |
| A fifth truck, owned | +10% |
| A season with no at-fault crash | +10% |
| Brokers: 500 loads covered without a fall-off | +10% |
| Shop item, paid in FD and burned: "Expedite" | the next four slices doubled |
| Shop item, paid in FD and burned: "Make-up week" | one missed week's slice restored |

Boosts stack to at most +100% and only bring forward what would unlock: the total never exceeds
the allocation, and the last slice closes the vest. The shop items are FD sinks, so the faster
unlock is paid for in deflation. Needs the shop and the achievement ledger in the client; the
engine side is a per-company unlock multiplier read by the weekly unlock.

## Airdrop size and a season schedule (proposal, 2026-10-29)

What the first pot is measured against: at launch about 60M FD is in play, 32M of it burned as play
money and 34M locked as working capital (spendable, never sellable), and the protocol mints 25M FD
into the pool against its $250k. The only sellable FD in players' hands on launch day is the airdrop.
So the pot is sized against the pool: 10M is 40% of it, and the 25% claimable on day one (2.5M) is 10%
of the pool, a worst-case dump of about 17% on the price. 12.5M (half the pool) would make that 25%.
Keep season one at 10M.

Scarcity comes from the burn, not the pot: after launch the profit tax burned 100–140M FD in the
four-year runs, supply fell from 63M to 36M, and the price ended at $0.012–0.019 from $0.01. The pot
decides who is paid and the launch-day price path. Players' net dollars out = buybacks + pool
drawdown − buy fees, whatever the pot: a smaller airdrop moves the same dollars to fewer hands.

Proposed schedule (to confirm with Jeff, then `token.airdrop.seasons` in config):

| Season (in-game year) | Pot | Split |
|---|---|---|
| 1 (beta, paid at launch) | 10M | beta Miles 0.6 / beta profit 0.4 |
| 2 | 6M | that season's Miles / profit |
| 3 | 4M | that season's Miles / profit |
| 4 | 3M | that season's Miles / profit |

Total 23M, about one pool's worth, published up front. Each season's pot is scaled down by how far
the season's average price ran below the launch price (pot × min(1, avgPrice ÷ launchPrice)), never
up: price falls, emission falls. Forfeited, haircut and unclaimed slices are never minted. The
unlock boosts (above) and shop items burn FD on the way in. Seasons after the fourth: none unless
decided; the game's faucet is then only NPC shippers paying for work done.

## The circular economy: capped supply, staking, pools (decided 2026-10-29, config 0.18.0)

Jeff's direction: FD supply is capped and the economy is circular; players will also be shippers and
own truck stops and fuel stations; staking gates company size and roles and is bought with dollars;
an unstaking period prevents cascades; player-funded pools underwrite insurance and factoring.
"Let's do it." This section is the build plan.

### 1. One token, one reserve, nothing minted

- **Cap.** A fixed genesis supply (order of 1B FD; the runs size it). Allocation at genesis: the
  reserve (~60%), the FD/USDC pool, four airdrop seasons (23M), the treasury. No mint after genesis.
- **The reserve** is one ledger account standing for every NPC counterparty: NPC shippers pay
  carriers out of it; fuel, wages, maintenance, insurance, lease share, per diem, idle fuel, fines,
  board fees, holding cost and the profit tax flow back into it. `faucet:*` draws from the reserve and
  `sink:*` posts to it; the ledger's supply check becomes "supply equals the cap minus burns".
- **Burns** only by dollars and forfeits: treasury buybacks, the sell fee, airdrop slices forfeited
  or haircut, the instant-unstake haircut, season-close burn if kept. The profit tax refills the
  reserve instead of burning (the cap and the tax must not drain the economy together).
- **Demand priced from the reserve.** NPC shippers' FD budget per day = `reserve × payoutFraction`;
  the reference rate per mile scales with budget ÷ miles demanded (clamped), replacing the
  freight-volume stabilizer. Hoarding drains the reserve and lowers rates; spending refills it and
  raises them. The holding cost is the pump. Weather, seasons, the cycle and the load-to-truck ratio
  still move rates on top.
- **Player counterparties** take flows off the reserve: a fuel station buys diesel from the reserve
  at rack and sells at its own pump price; a truck stop collects parking, per diem and rest fees; a
  shipper's facility sells goods to the NPC market (the reserve) and pays carriers. Velocity rises,
  supply does not.

### 2. Staking: the bond behind every licence

- `c.stakedFd` per company, out of circulation and out of the pool; a stake is **at risk**: fraud
  conviction, revoked authority or an unpaid cargo claim slashes it, victims' restitution first, the
  rest to the reserve.
- **Tiers gate capacity and roles, never performance.** Trucks: 5 free, 10 and 30 need a stake; the
  facility cap scales the same way. Roles: broker licence (replaces the 75k bond), shipper
  (facilities), fuel station, truck stop, later dealership, each bonded to a few weeks of the asset's
  flow. Falling below a tier starts a grace period, then the extra trucks park and the licence lapses.
- **Privileges that mint nothing:** higher rank for local-first tenders and contract offers, a lower
  surety premium, first pick of the capped dealer supply, faster airdrop vesting (an unlock boost).
- **Buying the stake with dollars** is the demand engine: USD → FD from the pool (price up, 1% fee to
  buybacks) → locked (float down).
- **Unstaking:** a queue, 28 in-game days (one real week at the live clock), with a global exit limit
  of ~2% of all staked FD per day; or instant at a 25% haircut, burned.

### 3. The pool and the whale

- Constant product, protocol-owned liquidity never withdrawn. Against 25M FD / $250k: 500k FD sold at
  once gets $4.9k and moves the price −4%; 2M gets $18.5k, −14%; 5M gets $41.7k, −31%.
- **Progressive sell fee:** 5% base, rising with the single sale's price impact (e.g. +1 point per
  point of impact, capped), all burned. **Daily sell limit** per company ≈ 2% of the pool's FD.
- The treasury's daily buyback buys more per dollar in a dump and burns it; newcomers and stakers
  buy in cheaper while rates and prices stay in FD: a transfer from the impatient to the patient.

### 4. Player-funded pools: one primitive, several lines

One module (`pools.ts`): a mutual pool holds FD, issues **units** to depositors, earns the line's
fees, pays the line's losses, prices by utilization (thin pool → dearer cover → more depositors), and
withdraws through the same exit queue as staking. Losses are shared pro rata; a pool that cannot pay
haircuts claims and the NPC backstop pays the rest at a penalty premium. No pool pays yield from
emissions: every unit of income is another player's fee. The NPC provider of each line stays as the
expensive backstop so a thin pool never blocks play.

| Line | Income to the pool | Losses | Pricing signal |
|---|---|---|---|
| **Insurance** (auto liability, cargo) | premiums (45–50M FD a run today, burned) | crash liability, cargo claims, spoilage | capital ÷ exposure (insured truck-weeks × expected loss) |
| **Factoring** | the discount on invoices advanced | shipper and broker defaults (2%+, more in downturns) | advance rate and discount by debtor rating (broker reputation, NPC shipper grade) |
| **Surety** | broker bond premiums (2–12% by credit) | broker defaults on carriers | bonded volume ÷ capital |
| **Equipment finance** (later) | loan interest | repossession shortfalls | loan book ÷ capital |
| **Fuel hedge** (later) | the spread on fixed-price diesel contracts | rack price moves | open contracts ÷ capital |

Factoring needs **payment terms**: NPC shippers and brokers pay net-30 game days (a quick-pay option
at a fee), so carriers run on working capital and the pool advances cash on delivery at a discount
(2–4%) and collects the receivable; recourse to the carrier on a fraud-voided invoice. This adds the
cash-flow game real carriers play and gives the stake and the holding cost something to do.

### 5. Build order and what the runs must size

1. ✅ Reserve account and the supply check; every faucet and sink rerouted; profit tax to the reserve.
2. ✅ Payout rule in demand pricing; retire the volume stabilizer; keep the rack-spread one.
3. ✅ Staking: account, tiers, slashing hooks in fraud/safety, exit queue, instant haircut; the broker
   bond becomes a stake.
4. ✅ Progressive sell fee and the daily sell limit in the exchange.
5. ✅ Pools module; insurance first (the biggest flow), then factoring with payment terms, then surety.
6. ✅ Airdrop seasons and the price-scaled pot (built: airdrop.laterSeasons; the broker bond stays a premium on top of the 75k stake); still open: the unlock boosts once the client has the shop.
7. Ten-seed runs to set: the cap, the reserve share, the payout fraction, tier stakes, the exit
   limit, the sell-fee slope, pool capital ratios. Kill criteria: no reserve drain below one month of
   freight, no tier that the free path cannot reach in a year, pools solvent through a downturn.

Every step is a rules change: bundle them into one restart while the world has no players.

## Sizing runs (2026-10-29, everything on, ten seeds, four years)

Against the 0.17.0 release run (runs/v24-c; runs/compare-v25-a.md, compare-v25-b.md):

| Run | What changed | Liquidations | Broker wealth | Price at end | Sinks/faucets after launch |
|---|---|---|---|---|---|
| v24-c | 0.17.0, open mode | 1,424 | 53k | $0.0084 | 97% |
| v25-a | circular + staking + pools + payment, tax all to the reserve | 501 | 10k | $0.0044 | 95% |
| v25-b | pools draw capital, brokers restart bonded, half the tax burns | 610 | 72k | $0.0054 | 89% |
| v25-c | the whole tax burns | 632 | 75k | $0.0063 | 83% |
| v25-d | …and rates follow the reserve squared | 603 | 75k | $0.0070 | 84% |

v25-d's reserve: 592M → ~395M at year one → 560M after the launch reset → 208–270M at year four. The
rate factor sits on its 0.5 floor by year three, so the reserve still drains ~100M a year after
launch: the next runs try the monthly volume stabilizer kept on under the cap (fewer loads in a
slump, `circular.volumeStabilizer`) and a lower floor on the rate factor.

What the runs settled so far:
- **The reserve holds.** Genesis 592M; the starved beta pays it down to ~340M by year one; the
  launch reset returns the play money (~255M) to it; it then drains about 110M a year to ~320M at
  year four, never near one month of freight (~70M). Rates follow it down: 5.5 → 4.5 → 4.1 → 3.2
  FD/mi, the economy finding the level at which sinks match payouts.
- **The price is the open question.** With the tax refilling the reserve and only dollars burning,
  the price halves against the open mode; burning half the tax recovers a fifth of that. The dial is
  `circular.taxBurnShare`; a run with the whole tax burning is the next data point. Jeff's call
  between "deflation only from dollars" and "as deflationary as possible".
- **Working capital bites brokers first.** Net-30 means a broker wound up unpaid stiffs its
  carriers for a month of invoices; the surety pool covers up to the bond per broker (a bug let it
  pay the bond per invoice in v25-b), and the receivables lost show in the shipper-default count
  (10.6k against 3.2k).
- **Liquidations fell by more than half** against 0.17.0 (610 against 1,424): staking tiers hold the
  fleets back, factoring keeps the short ones afloat, and brokers restart bonded.

### Contract terms (Jeff, 2026-10-29; built as commit 991498a)

Quick pay 10%, an emergency tool. Factoring is a one-year contract with a stake behind it (two weeks
of invoices by the fleet, 50k for a broker or shipper): 4% per 30-day invoice on an NPC shipper's
paper, 6% on a player's, times the pool's markup; leaving early forfeits the stake to the pool, at
term it renews or comes home. A pool-written insurance policy locks the deductible per covered
truck and pays it from the stake on a claim; the pool prices at 80% of the NPC base to aim at a 75%
loss ratio. The broker licence stake is the surety bond. On liquidation the contract stakes go first
to the pool holding the company's paper, then the licence stake to the creditors. The NPC lessor
pays its leased trucks on delivery and takes the paper, so the free path runs on no working
capital. Expected: 60–80M FD locked against a sellable float of 70–90M after launch (runs/v26-*).

### Credit ratings, and no free restarts (Jeff, 2026-10-29)

Brokers (any company, in fact) carry a credit score the game computes from the ledger and nobody
sets, 0–100 in bands A–E (`token.credit`): the share of invoices paid with cash in hand against
those paid from an overdraft or never, unpaid claims on record, bankruptcies, revocations, the
licence's age, and stake plus cash against the invoices owed. Carriers refuse paper below their
floor (35 by default, no E paper) and ask up to 20% more on weak paper; the surety prices the bond
by it; the factoring pool prices a player's paper by it; NPC shippers tender to brokers in credit
order. A bankrupt broker's licence lapses with its stake: no grant, no loads until it posts the
75k again, earned or bought. Even the AI brokers post their stake at founding from their starting
capital. Bots buy FD with dollars to reach a tier or a licence when they pay to win: the design's
demand engine, now in the runs.

The profit tax is a corporate band now: 20% of weekly operating profit above a 5,000 FD exemption,
moved by the stabilizer only within 10–30% ("those taxes are insane"). Deflation comes from the
capped economy's locks, stakes and sinks.

## FD only: nothing bypasses the pool (decided 2026-10-29)

Jeff's decision: no dollar purchases of anything, ever. The only way dollars enter is buying FD from
the pool (every dollar lands on the bid side as protocol-owned liquidity, less the 1% fee that funds
buybacks), and the only way to do anything in the game is to hold and lock FD. This replaces the
dollar split for items above and the dollar cosmetics plan.

- **Every price in FD, indexed.** Catalogue prices (items, upgrades, yards, shops, stations,
  cosmetics) are set in FD against the launch reference and scaled by the freight rate index (the
  trailing average cleared rate over the base rate), so play money's abundance in the starved
  season is priced in and prices settle to par as the market normalises. Stakes and bonds are fixed.
- **A bond behind every asset.** Yards, shops, truck stops, fuel stations, dealerships and shipper
  facilities: a set price plus a staked bond sized to the asset's weekly flow, returned on sale,
  slashed on fraud; capped supply per region, FD auctions when contested. More than five trucks
  needs a yard.
- **Where purchase FD goes:** half burned, a quarter to the treasury, a quarter to the reserve.
- **Staking discounts.** Tiers of locked FD earn 5 / 10 / 15% off fuel, repairs, insurance and board
  fees. A discount is a smaller sink, so each tier's threshold is sized on the runs to lock more
  than it forgives.
- **The developer's revenue is FD:** the treasury's genesis allocation and its quarter of every
  asset sale, sold into the pool on a published vesting schedule (proposal: nothing for the first
  26 weeks after launch, then at most 0.5% of the treasury's holdings a week, and never in a week
  the price averaged below the launch floor). Published, vested, never deviated from.
- **Known costs of the model.** No fiat revenue until the token has a market; the securities
  question is sharper (a token that is the developer's income, with staking that pays discounts):
  get a legal opinion before launch; the sell schedule is the trust.

## The launch price is what the dollars support, the lean launch, and the fuel tax (Jeff, 2026-10-29)

What the batches taught (runs/compare-v27-*.md): the runs that held above a cent were held up by the
$250k seed, the $5-a-week fee's $170k of buybacks and the 40% tax burn. Remove those, as decided, and
the price settles where players' selling in dollars equals new players' buying: $0.0005–0.001 against
a launch pegged at a cent. The flywheels move FD between players, the reserve and burns; none of them
brings dollars. Price is pool dollars over pool FD. So:

1. **The launch price is a quotient, not a round number.** With dollars on hand (the farming season's
   window, every dollar of it), the pool opens two-sided: FD from the pool allocation as deep as the
   float that survived the reset (`launch.poolDepthShareOfFloat`, never more than the allocation) on
   one side, the dollars on the other. The price is seed ÷ depth. `launch.priceUsd` is a reference
   only: the one-sided floor when there are no dollars at all, and the window's dollar pricing.
   Two-sided, buyers pay the pool's price (no floor), so there is no 50× spread between what a
   buyer pays and a seller gets. The gates are: the price holds from launch, and pool dollars grow.
2. **The lean launch.** The reset burns wallets above working capital; it now burns stakes, exit
   queues and contract stakes too (factoring, insurance deductibles, yard bonds), so nobody carries
   beta FD through by parking it in a stake, and every position after launch is re-posted in FD
   bought with dollars (the grace period applies; the yard stays, its bond gone). In the v27 batches
   48M of the ~70M float was beta stakes.
3. **The fuel tax (IFTA-style).** Every gallon burned in a month, on the road and idling, is taxed at
   the month's close at `costs.fuelTax.perGal` (0.5 FD/gal, about 12% of fuel spend), a sink that
   scales with miles. Per-state rates wait for routes that carry their states.
4. **Demand is an input.** `token.newCompanies.usdWalletMult` scales the dollars newcomers arrive
   with, and the report prints the new buying per 1,000 active companies a month that would hold the
   end price (`demand.usdPerThousandCompaniesMonth`): the number real growth has to beat.
5. **The vest sells only above the launch price**, and only as much as leaves the pool at or above it
   after the sale (the v27-b batch, before this, vested 117M FD into a $30k pool because the price
   history recorded the floor-held ask; it records the pool's price now).

## The big sinks (Jeff, 2026-10-29; built, behind the 0.18.0 switches)

Jeff's direction: as little sell pressure as possible, as much longevity as possible. The sinks that
replace the 40% tax, each a config switch, each a reason to hold or buy FD:

1. **A national sales tax** (`costs.salesTax`, 5%) on every purchase of goods and services: trucks and
   trailers, used trucks, facilities, businesses, catalogue items, repairs, rebuilds, maintenance, a
   night at a truck stop. Not on fuel (the fuel tax), freight, wages, premiums or stakes.
2. **Player businesses** (`businesses`): a shop, a truck stop or a fuel station at a hub, bought for FD
   through the catalogue split (half burned, a quarter to the treasury, a quarter to the reserve) plus
   a staked bond, with weekly upkeep (a sink), at most three per company and a few per hub.
   - A **shop** is the maintenance market: it does the hub's maintenance, repairs and rebuilds at its
     own price against the NPC shop's list. Parts (60% of list) are a sink; the rest is the owner's.
     Carriers use the cheapest shop at the hub that beats the NPC shop; the owner's own trucks pay parts.
   - A **truck stop** halves the idle fuel of trucks resting at its hub (shore power) for a nightly fee.
   - A **fuel station** keeps a 4% margin on the fuel bought at its hub; its owner fuels at wholesale.
3. **Managers** (`labor.managers`): an operations manager and a maintenance manager, salaried weekly
   (a sink). Past ten operating trucks a fleet needs them: without, dispatch prices worse and looks
   less far ahead, and breakdowns rise 30%; with, pricing tightens, breakdowns fall 20% and maintenance
   runs 10% leaner. First form: a post the company fills, not yet a person from the labor pool.
4. **The fuel tax** (above), monthly on gallons burned.
5. **The vest** at a quarter of a percent of the treasury a week at most, only above the TGE price,
   and only as much as leaves the pool at or above it.

## Truck stops on the interstates, road service, managers at five trucks (Jeff, 2026-10-30; built)

- **Sites.** Truck stops are sites on the interstates (`businesses.sites`: one every 100 interstate
  miles, ranked by the freight that passes — a gravity model over the lanes), not hub businesses. The
  busiest 60 open for sale at the start; more open as the fleet grows. A site's price is the list price
  scaled by its traffic (0.5× to 3×), the bond fixed (250k + 100k, 3,000 a week upkeep).
- **One asset, three trades.** Fuel at a 6% margin for the blocks of a leg that pass it (the 400-mile
  rule: a leg buys its first block at the origin, each further block at the nearest truck stop within
  100 miles of that mile, else the pump); a shop that charges 1.1–1.4× list and comes out to
  breakdowns; parking that cuts a resting truck's idling to a quarter for 15 a night (a rest with no
  stop within 50 miles idles on the shoulder at the full rate; rests on the road now burn fuel, as
  idling at a hub does).
- **Road service.** A breakdown happens at the truck's mile. The cheapest provider within 100 miles
  comes out — a truck stop's shop at its markup, a hub shop at either end of the leg at its own — for a
  call-out fee (300 + 5 a mile) plus the drive at 50 mph, which adds to the delay. With none in reach,
  NPC road service at 1.5× list (sink `road_service`) and an eight-hour wait.
- **Operations managers** are a must past four operating trucks, one for every 25 beyond: trucks over
  the cap park after the grace period, like a stake tier. With one: pricing noise ×0.8, crash odds
  ×0.9, pull-ins ×0.9, the morale hit for pushing drivers past the rules halved, and every driver and
  dispatcher works 0.05 above their skill. Maintenance managers as before (past ten trucks).
- **The balance dial** (`token.circular.rateStabilizer`): what NPC shippers pay per mile moves 3% a
  month toward the sink-to-faucet target after launch. The runs to date paid players 10–12% more FD
  than the game took back, and that surplus is what they sold; a balanced economy pays out what it
  takes in, so a player's gain is another player's loss or a better-run company, not the reserve's.

## The locked levers (2026-10-30, config/live.ts; ruleset 0.18.0-phase0.24)

What the v27–v35 batches settled on, applied to the base config as `withLiveLevers` for the live
world and as the sim's default profile (`--profile base` runs the bare config):

- **On:** the token, the reserve ledger (tax burn 100%, reserve factor exponent 2, the volume dial),
  staking, the pools, payment terms, the catalogue, the fuel tax, the sales tax at 7%, businesses on
  hubs and interstate sites, managers, the balance dial (5% a month over a 90-day window toward the
  1.00–1.04 band).
- **Launch:** no seed capital; the farming season's window seeds the pool; the pool opens as deep as
  the float (the treasury allocation covers what the pool allocation lacks); 10% of the airdrop on
  day one; the daily sell limit 1% of the pool; the sell fee 7%, burned.
- **The skill edge:** dispatcher noise 8% → 0.5% across skill, drivers' mpg ±15% and maintenance
  ±25%, an operations manager at noise ×0.7 and +0.08 skill.
- **What the batches say about it:** sinks 95% of faucets (97–99% in the best seeds), net selling
  ~0.3–0.6M FD a month against 1.8M before the sinks, liquidations within 10% of the no-dial run,
  the free path a 32-day median, pool dollars draining ~$5k a year across 600 bot companies — the
  residual a few percent of real growth covers. The three gates (price from launch, liquidations
  against baseline, the free path) are dashboards on the live world from here, not batch tests.

## Assets and destruction (the EVE plan, step 4; built 2026-10-31, config `assets`, not yet live)
EVE's economy turns because ships are destroyed and rebuilt from what players make. Lanes now does the
same with trucks and trailers, which used to last forever and go back into dealer supply.

- **Two assets.** A tractor pulls a trailer; each wears on its own miles. A yard holds a set number of
  each (no yard: five and five, no spares; small 10 and 15; large 30 and 45), and spares swap at the
  home hub. The NPC lessor rents trailers by the week at any hub.
- **Finite life.** A tractor takes two rebuilds or a million miles, then runs until it is worn out and
  goes for scrap at 3% of list. A trailer runs its type's miles (reefer 750k, van 1.2M, flatbed 1.5M).
  Scrap is a small faucet; the replacement is a sink.
- **Total losses.** A crash writes the rig off at 4% (property damage), 35% (injury) or always (fatal).
  Physical-damage cover, 1.2% of value a year, pays its value less 2,500 FD: a pool-written policy from
  the pool, the NPC insurer's from the reserve.
- **No recycling, a factory allocation.** New supply is a monthly allocation (2.5% of the tractors on
  the road, at least 40) by tier and type. Player dealerships take their share wholesale at 85% of list
  through the catalogue split (half burned) and sell from stock at their own markup; while one is open
  the NPC dealer is the backstop at +10% and three more weeks. Dealerships take trade-ins at 80% of value.
- **Players make the rest.** Player lessors lease tractors by the week; businesses (with their bonds),
  facilities and yards resell player to player, so anything can be had for FD earned from other players.
- **The open number.** The first smoke run put new equipment at about 2% of all sinks: a Workhorse and van
  costs 18k FD against ~360k FD a year to run one. EVE-like destruction (the plan's 15% bar) needs
  equipment several times dearer, which slows a newcomer's first new truck. The calibration batches
  (prices ×1, ×3, ×6) put numbers on that trade before Jeff picks the level and the world restarts.
- **What the calibration found (v40-a/b/c, seeds 1, 5, 8, against assets off; `runs/compare-v40.md`).** No
  price passes. New equipment is 2% / 4% / 5% of sinks at ×1 / ×3 / ×6; all equipment (new, the NPC lease
  share, trailer rent, rebuilds) is 9% / 13% / 16%. The end price is $0.00024 / $0.00033 / $0.00036 against
  $0.00043 with assets off. At ×1 a new truck costs less than the late rebuilds that finite life ends, so
  trucking gets cheaper and more FD stays out. At ×3 and ×6 a newcomer's first truck takes a median 83 and
  132 days, past the 84-day free path, because Equipment Finance lends only against trucks a carrier already owns.
  Carriers lease from the NPC instead, at 15% of gross whatever a truck costs: owned trucks fall from 1,535
  to 1,016 and 670, and the top tenth's share of wealth rises from 35% to 46% and 55%. At ×6 fleets buy FD
  with dollars to pay for trucks: the price runs to 3.7× launch, the developer's vest sells 10M FD into
  it, and the drawdown is 85%. Destruction can't carry the economy as in EVE, where ships die in minutes;
  trucks wear out over years. Proposed before any price is picked: purchase loans on the truck being bought,
  and NPC leases beyond the free path priced by the truck's value. Then re-run at ×2 and ×3, judged on all equipment.

## Market cap and fully diluted value (tracked from 2026-10-31, Jeff)
- **Circulating FD** is what players hold and trade: everything outside the reserve, the protocol's genesis
  allocations and the burns, less spend-only locked FD. Company balances, stakes, bonds, pool deposits
  and the exchange pool's own FD all count.
- **Total FD** is the cap less everything burned: all the FD there is, since the reserve pays it back out.
- **Market cap** is price × circulating; **fully diluted value (FDV)** is price × total. Both are 0 before
  launch. Every day's metrics carry them; the run report has them at launch, at the end and at their peaks;
  the batch comparison, the Monthly Economic Report and the client's Economy tab show them.
- **What the last batches say** (v37-a parking, v38-a trailer pass, ten seeds each): market cap $52k at launch,
  ending at $74k and $60k (peaks ~$105k); FDV ~$710k at launch, ending at $478k and $384k (peaks ~$1.1M).
  Market cap grows while the price falls because the reserve keeps paying FD into circulation; circulation
  ends near 16% of the total. FDV follows the price.

## The degen and bear-case batches (the EVE plan, step 2; 2026-10-31)
Bots only, against the 0.18.3 rules: airdrop farmers at 30% of players, ten sybil clusters of eight
wallets, 200 momentum traders (about $2,000 each, buying after a 15% weekly rise), a 500-wallet
listing-day crowd (about $200 each) and a $50k whale.
- **Farmers alone (v39-b, three seeds):** the end price fell from $0.00043 to $0.00027, the worst
  drawdown went from 0% to 70% and liquidations doubled. The extra liquidations are the farmers' own
  companies (167 of 175 liquidated at least once); owner-operators liquidated fell from 104 to 62.
- **Every bad actor (v39-c, six seeds; `runs/compare-v39-cd.md`):** a listing pump. The crowd lifts the
  price 15× on launch day and the pool from $32k to $131k; momentum traders chase it to about $0.45 by day 9
  with $800k in the pool; it is down 99% by day 30 and ends at $0.00034 against $0.00041 without them.
  Speculators put in $903k and take out $640k, a net loss of $263k a seed. Sybils take out $142k and farmers $105k;
  operators come out about even. Liquidations nearly triple, mostly the bad actors' own companies
  (159 farmers and 74 sybils liquidated at least once). Owner-operators liquidated fall from 105 to 68 and
  newcomers from 104 to 62; fleets rise from 28 to 43.
- **The fixes (v39-d: the frequency sell fee, the falling sell limit, the airdrop at 20% miles and 80%
  profit) change almost nothing:** end price $0.00035, the same pump, farmers $113k and sybils $154k.
  They act on selling; the damage comes from buying into a thin pool, and from multi-accounting.
- **Farmers alone with the fixes (v39-e, three seeds; `runs/compare-v39-e.md`):** a modest help, at no cost
  to operators. The end price is $0.00029 against $0.00027 without the fixes ($0.00043 with no farmers). Net FD
  sold falls from 1.2M to 1.0M a month and the drawdown from 70% to 67%, and the sell fee burns 0.7M more.
  Farmers take out only about $5k of dollars here: their harm is the FD they sell, which drags the price
  down for everyone.
- **Recommendation:** switch the three fixes on with the next ruleset change (they help against a slow bleed
  and cost operators nothing measurable), and treat the listing pump and sybils as launch design.
- **What would work** (proposals, not built): an opening auction that sets one listing price for all
  bidders and puts its dollars in the pool, so the pool starts deep; a daily price band (limit up and limit
  down) for the first months, so a pump can't compound; and the identity checks the spec calls for (verified
  login, device and same-owner detection), since sybils take out the most and no fee or limit separates
  one owner's eight wallets from eight players.

## The supply path (Jeff, 2026-10-31: "complete supply control"; built, config `token.supplyCeiling`, off)

- **The rule.** After launch, the FD outstanding (everything outside the reserve, the genesis allocations
  and the burns: companies, stakes, deposits and the exchange pool) may grow at most along a path published
  at launch: a straight line to +X% a real year (1,460 game days) after launch, then flat. It never looks
  at the price. Checked weekly, as a snapshot, against the line that day.
- **The levers, in order.** The balance dial trims NPC freight rates (from where they stood at launch,
  down to 80% of it, never above it); at the dial's floor, or whenever the path itself is reached, the
  scheduled payouts wait: airdrop slices queue on their companies (owed, paid out as room returns, lost
  only to liquidation) and the developer's vest holds.
- **What the batches found** (seeds 1, 4, 7 against the live rules, v41-a; runs/compare-v42-*.md):
  - v42-a/b measured the dial's floor from base rates; the beta's own dial had already cut rates to
    half, so the ceiling *raised* them at launch and supply ran 45–54% over the path. Fixed (2cae745).
  - v42-c/d (+25% / +10%, with rate cuts): the end price rose ($0.00059 → $0.00066 / $0.00076) and the pool
    kept its dollars, but supply still grew 34–35% against 5–12.5% allowed by the run's end. A 20% lower
    rate multiplier moved cleared rates only ~2%: loads clear at carriers' asks, not the NPC ceiling, and
    supply grows from the profit carriers keep. The cuts hit the marginal carriers: liquidations +12%,
    newcomers' Miles per hour down 70–80% (which trips the strategy-vs-median gate).
  - v42-e (+10%, payouts only, no rate cuts): the same supply growth (34%), end price $0.00067, fewer
    liquidations than with no path at all (895 vs 917), and no newcomer harm (strategy gate 2.15×).
- **Conclusion.** Payouts wait, rates don't move: the path's own levers can slow the airdrop and the vest,
  but holding the path needs sinks, which is where Jeff wants deflation to come from (2026-10-29: "from the
  capped economy's locks, stakes and sinks, not from the tax"). The next test runs the path with the sinks
  being built: trucks at realistic prices, leases by value with deposits, purchase loans, the staff ladder,
  sales and stake-backed contracts, scale discounts, the early-sale tax, and the robbers.

## The sinks (Jeff, 2026-10-31: "add the sinks also and then test"; built, all behind switches)

What each one takes out of circulation, and from whom:

- **Trucks priced like trucks.** Realistic list prices at about 1.5 FD to the real dollar (a Workhorse
  225k, a HighwayPro 285k, a Flagship 345k; a dry van 68k, a reefer 128k, a flatbed 75k), rebuilds and
  refurbishments scaled with them. With the asset rules on, a truck loses value with the life it uses, so
  the cheapest running trucks sit near a quarter of new: Jeff's $200k-to-$50k ratio.
- **The NPC used lot** (`usedMarket.npcLot`): the NPC dealer also sells worn rigs (four years, 450k miles,
  condition 0.4) at their used value, about a quarter of new at the asset rules' depreciation, so the real
  ratio of a $50k used truck to a $200k new one holds with prices at the realistic level. A sale is a sink
  like the dealer's; the rig costs more to run (fuel, maintenance, breakdowns) and needs its rebuild sooner.
  Priced at its own value, so it can't be bought cheap and resold.
- **The deposit toward the first truck** (`freeEntry.leases.byValue.depositToPurchase`): a free starter's
  lease deposit is released into the purchase of the truck that replaces the lease, rent-to-own style; the
  deposit stays at 25% of the leased truck's value, but it's savings, not a second pot to fill.
- **Leases by value** (`freeEntry.leases.byValue`): a lease pays at least 0.5% of the truck's value a week,
  and the lessor holds a refundable deposit of 25% of it (paid up front on an extra lease, held back from
  the free path's settlements until whole). Rent is a sink; the deposit is FD out of circulation while held.
- **Purchase loans** (`equipmentFinance.purchase`): the NPC lender pays what the buyer doesn't put down
  (10–20% by credit); the buyer locks a 10% stake and repays weekly with interest. The purchase sinks the
  whole price at once; the loan's principal comes back in, and the interest is a sink.
- **The staff ladder and the optional roles** (`labor.ladder`, `labor.managers.roles`): more dispatchers and
  managers per truck (Jeff's spans), each working worse as its span fills; CEO, security and sales salaries.
  All pay is a sink, and it grows faster than the fleet.
- **Direct freight on a stake** (`contracts.direct`): a two-week performance stake per contract, out of
  circulation for the term and slashed to the reserve when a tender is turned down.
- **Scale discounts** (`scaleDiscounts`): the one change that *lowers* sinks, for big fleets only (fuel,
  dealer, insurance, to 10% at 50 trucks); the price of making one big company pay.
- **The early-sale tax** (`token.exchange.launchTax`): 75% falling to the normal fee over six real months
  after launch, burned.
- **Hired robbers and security** (`robbery`, `security`): crew fees and security fittings are sinks; a hit
  destroys cargo (the insurers pay, from pools or the reserve) and, at 30% odds, a rig (chopped); the hirer
  is paid the fence's share less a 25% wash, from the reserve.

## The daily price band (Jeff, 2026-10-31; built, config `token.exchange.priceBand`, off)

For the first 365 game days after launch (three real months), no trade moves the pool's price more than
15% from the day's open (fixed at the day's first trade). An order that would goes through up to the edge
of the band and the rest waits: a buy fills until the price reaches today's high, a sale until it reaches
today's low, net of the sale's fee (which grows with the sale, so the most a sale can be is solved from
below and never overshoots). At the edge, orders are turned away with "the price is at today's limit up"
or "limit down". Protocol trades (the buyback, the developer's vest) are not limited; they have their own
rules. A one-sided launch's floor rules until buyers lift the pool over it, so the band starts then. A pump
or a dump can't compound faster than 15% a day; the reports count the trades clipped and the biggest
day-to-day move in the band's days.

## The logbook (Jeff, 2026-10-31; built, config `token.airdrop.logbook`, off)

The airdrop is paid only for what a company does. 1% of each allocation is paid when it's made; the rest
unlocks through milestones, checked weekly, within twelve real months (1,460 game days), after which what's
still locked is never minted. There is no early claim and no weekly vest.

| Path | Milestone | Weight | Roles |
|---|---|---|---|
| Honest | 25 / 100 / 250 / 1,000 loads handled (delivered, brokered or shipped) | 4 / 6 / 8 / 10 | carriers, brokers |
| Honest | 100 loads delivered at 95% on time | 6 | carriers |
| Honest | 100,000 / 1,000,000 FD of operating profit | 6 / 10 | carriers, brokers |
| Honest | One / five trucks more, owned | 5 / 8 | carriers |
| Honest | A business owned | 6 | carriers, brokers |
| Honest | A manager on staff | 4 | carriers |
| Honest | A quarter with no at-fault crash and no claim, 25 loads handled | 8 | carriers, brokers |
| Honest | A game year on the road (three real months) and 100 loads / two years and 200 / three years and 300 | 8 / 10 / 12 | carriers, brokers |
| Honest | A satisfactory compliance review | 5 | carriers |
| Honest | A contract term kept in full | 6 | carriers |
| Honest | A truck with every security slot fitted (robbers on) | 3 | carriers |
| Criminal | A crew of yours hit / five hits / a rig taken and chopped (robbers on) | 8 / 10 / 6 | carriers, brokers |
| Criminal | 100,000 FD fenced (crew takes, cold cases) | 10 | carriers, brokers |
| Criminal | A case gone cold | 8 | carriers, brokers |

Each milestone unlocks its weight's share of the 99%: the honest weights open to a role add up to all of
it, so an honest operator can unlock everything; the criminal ones add up to at most 60% of it
(`criminalShare`), so crime alone never finishes the book. A criminal milestone counts only while the
company has no open case (one reached with a case open waits for it to close), only from the company's own
allocation (crime never earns a new one), and a conviction forfeits whatever is still locked. The tenure
milestones keep about a quarter of every allocation for the companies still hauling at three, six and nine
real months. A milestone reached while the supply path holds is owed, like any slice, and paid as room
returns. A company keeps one book: a later season's share joins it, the milestones already reached paying
their shares of it at once, and the deadline moves to twelve real months from that season. Counsel to
confirm the criminal path.

**A first look** (82 companies, a short beta, live levers, robbers on): 52 real days after launch the median
company had unlocked 38% of its allocation (the 90th percentile 50%); after 102 days, 44% (60%). Almost all
reach the volume, profit and clean-quarter milestones; few reach 95% on time, a satisfactory review or a
contract kept in full; the first tenure milestone opens at three real months. Under the old vest the whole
allocation was out within six and a half real weeks.

## The unlock ladder (Jeff, 2026-10-31; built, config `unlockLadder`, off)

After launch the game opens in layers, so the features that move the most money arrive once the economy
is deep enough to carry them, on a schedule everyone can read. The beta stays fully open. At launch,
hauling is open; businesses and facilities open 28 game days later (a real week), re-brokering at 91
(three real weeks), hired crews at 182 (six and a half real weeks). A layer can also wait for a metric
that's hard to fake: operating companies (a stand-in for verified players until the server checks
identity) and dollars in the exchange pool; it opens on the first day both its date and its metrics are
reached, and never closes again. What was built in the beta keeps running. The reports publish the day
each layer opened.

## The combined test (2026-10-31: v43–v49, every sink on)

Bots only, four years, three seeds a variant (1, 4, 7; 1, 4, 8 for the bad actors), against v41-a (the
live 0.18.4 rules). The comparisons: `runs/compare-v43.md` to `compare-v49.md`.

**At today's truck prices, the sinks work** (v43-a; v44-a and v45-c with the robbers, the band, the logbook,
the theft gaps, the ladder and the used lot). The price ends 30–75% above launch in every seed (live rules:
one seed in three), the worst drawdown is 20–27% (47%), and FD outstanding grows 20–29% after launch (41%).
The early-sale tax burns about 25M FD, and buyers outnumber sellers. Free starters own a truck in a median 8
game days. The costs: liquidations up about 10% (fleets liquidated nearly double: the staff ladder makes
growth costly), and newcomers spread wider (the top strategy 2.8× the newcomers' median, against 2.0×).

**Truck prices and the free path.**
- At realistic prices (293k FD for a Workhorse and van, v43-b, v44-b) a free starter needs a median of about
  141 game days (five real weeks) to own one, and only a quarter do it in 84. Lease deposits hold 25–30M
  FD. Fleets buy FD with dollars to afford trucks, so the price climbs 5–9× in the first two real months
  and falls about 83% from that peak. Wealth concentrates (the top 10% hold 52%, against 36%). Spend-only
  free-path earnings change nothing (bots rarely sell FD); no free tier keeps the strategy gate but
  newcomers are no faster.
- Mid prices alone (a Workhorse at 140k, ten times today's; v44-d): 107 days.
- The NPC used lot (worn rigs at their used value, about a quarter of new; v45): mid prices 58 days (a pass),
  realistic about 100. The lot wasn't short of rigs; the starters were short of cash, saving a 26k lease
  deposit and then the down payment.
- The deposit toward the first truck (v47): realistic 56 days, mid 41 (nine starters in ten within 84).
  **Mid prices with the used lot and the deposit credit were the most balanced run of the day:** the price
  holds in every seed (ending 17% above launch), the strategy gate passes (1.6×, the top strategy an
  established owner-operator's), the top 10% hold 48% of the wealth. At realistic prices, wealth
  concentrates further (the top 10% 56%) and newcomers spread wide (3.5×).

**The supply path and the logbook.** Sinks alone don't hold +10%: FD outstanding grows 20–39% after launch.
With the logbook on, the path holds most of what the milestones unlock as owed: in one seed nothing past the
1% opening payment was ever paid, with 6.9M owed at the end. The logbook itself releases slowly (the median
company has 22–33% of its allocation after six real months; nearly all reach the volume milestones and a
clean quarter, few reach 95% on time, a satisfactory review or a contract kept), so the airdrop minted falls
from about 11M to 3–4M. An airdrop unlocked but never paid is a problem of its own for honest players.

**Robbers and theft.** The robbers are net deflationary and grow with truck prices: at today's prices about
390 crews a seed, 160 hits and 55 rigs chopped, with fees (0.8M FD) and fittings (1.4M) above the take paid
to hirers (0.6M); at realistic prices a rig is worth stealing (1,584 crews, 597 hits, 187 rigs chopped,
about one owned truck in six; 6.5M paid to hirers against 10M in fees and fittings). The unlock ladder
(crews from day 182) cuts the hires by 18–53%. The theft gaps matter: with loaded trucks exposed at closed
docks, cargo thefts rise from about 775 to 1,070 a seed. The insurance index sits at its 1.40 cap in every
variant, so claims moving the market change nothing there yet.

**The launch defense, against every bad actor** (v46, v48, v49; airdrop farmers at 30% of players, ten
sybil clusters, 200 momentum traders, a 500-wallet listing crowd, a $50k whale; `runs/compare-v46.md`,
`compare-v49.md`). Means of three seeds:

| | Peak market cap | Peak (× launch), day | Farmers take | Sybils take | Speculators' net | Fleets' net |
|---|---|---|---|---|---|---|
| No protections (v46-c) | $33.5M | 505–656×, day 10 | $89k | $148k | −$228k | −$31k |
| The band, ±15% (v46-d) | $4.2M | 59–68×, day 35 | $61k | $37k | −$29k | −$77k |
| ±15%, the 75% early-sale tax, the logbook (v46-a) | $20.6M | 305–373×, day 45 | $48k | $30k | −$39k | −$125k |
| ±15%, the tax on farmed FD only, the logbook (v48-a) | $5.6M | 70–95×, day 33 | $18k | $10k | +$113k | −$129k |
| **±5%, the tax on farmed FD only, the logbook (v49-a)** | **$2.6M** | **25–64×, day 68–101** | **$14k** | **$9k** | **+$33k** | **−$75k** |

- The band does the work: it turns the day-ten spike into a climb at the limit and clips the orders that
  would have poured in at the top.
- The 75% early-sale tax on every sale makes the bubble five times bigger: with the sellers taken out, the
  climb runs higher and longer, and operators who keep buying FD to run their companies (the fleets) pay
  more for it. Taxing only farmed FD (FD a company bought, up to what it bought, pays the normal fee) keeps
  the bubble at the band's size and leaves farmers and sybils the least of any variant, but lets early
  speculators profit at the operators' expense.
- A ±5% band with the tax on farmed FD only and the logbook was the best defense: the smallest bubble,
  farmers taking 85% less and sybils 94% less than with no protections, and the smallest transfers
  between speculators and operators. The ±5% band alone was erratic (one seed built a late bubble of 241×).
- The sinks don't touch a launch bubble (everything on, v46-b and v48-b, look like their twins); the
  speculators' dollars drive it.
- What sets the height: the pool opens with what the dollars support (about $35k: a $50k market cap) and
  the bad actors bring about $900k. The band sets how fast that lifts the price, an opening auction would
  set how fairly (one price for every bidder, nothing to chase in the first week), and only FD to meet the
  demand would lower how high: an auction tranche the treasury sells at the clearing price, published
  before launch, every dollar into the pool. A literal auction (every bid cleared as one buy against the
  opening pool) moved the opening price about 2,000× in a small world, so it was not kept.

**What I'd decide next** (Jeff's calls):
1. Truck prices: mid (a Workhorse 140k FD) with the NPC used lot and the deposit toward the first truck
   (v47-b), or realistic with the same (v47-a: the free path passes, wealth concentrates).
2. The launch defense (settled in part on 2026-11-01, "Settlement on Solana" below: no band on-chain, the
   auction tranche yes): the tranche's size, and whether the pool's decaying fee does any of the band's
   work (the v50 smoke, when it runs).
3. The supply path: at +10% it holds the logbook's unlocks for good in some seeds; widen it, or let the
   logbook's payments through.
4. The newcomer spread (the top strategy 2.5–5× the newcomers' median with the sinks on, against a 3× gate).

## Settlement on Solana (Jeff, 2026-11-01): a clean token, a standard pool, the bridge

Jeff's calls (2026-11-01): keep the token simple, no custom AMM fork and no Token-2022 extensions ("a clean
token when it's out of the game"); the opening auction for the TGE; and no rule under which the treasury or
the airdrop's recipients may sell only above the TGE price. What that fixes:

**The token.** A plain SPL mint: the cap minted at genesis, the mint authority revoked, no freeze authority,
no extensions, Metaplex metadata carrying the name and the published schedules. Supply control is a matter
of where the cap sits, every part of it readable on-chain: the game vault (the bridge's reserve: every FD
inside the game, the NPC reserve and the airdrop escrow included), the auction tranche (sold to bidders at
the TGE), the pool's FD (protocol-owned liquidity, never withdrawn), and the treasury's vest escrow (a
standard time-locked vesting contract: a cliff, then a weekly cap, nothing else). "Never minted" becomes
"burned from the vault at the deadline". Outstanding FD on-chain is the cap less the vault and the
escrows; FD inside the game is the ledger's supply. Both are published.

**The pool.** A standard pool (Meteora DAMM v2 or Raydium CPMM), seeded at the auction's clearing price
with the auction's dollars and the treasury's FD, the LP owned by the treasury for good. The pool's own fee
scheduler (a fee on both sides, falling from its start to the base fee over the first days) is the only
on-chain brake: no price band, no transfer hook, no allow list. FD out of the game trades anywhere, and an
aggregator can route it from day one.

**The launch.** A Metaplex Genesis auction or a Meteora Alpha Vault: verified bidders, a per-person cap, the
tranche sold at one clearing price, every dollar into the pool. The sim's stand-in is `token.launch.auction`
(the tranche, the cap, a reserve price, the pool's share of the dollars); the pool's fee scheduler is
`token.exchange.launchFee`, its rate limiter `token.exchange.sizeFee`. All three are off until the v50 smoke
has sized them.

**The bridge: the one place the game enforces anything.** The game runs on its own ledger (the lockstep
world; every FD inside it is a claim on the vault), and the bridge moves FD between the ledger and the chain.
- *Deposit:* on-chain FD goes into the vault and the ledger credits the company. Deposited FD counts as
  bought for the early-sale tax (up to what was deposited and not withdrawn), as FD bought on the in-game
  exchange does today (`launchTax.boughtExempt`).
- *Withdraw:* the ledger debits the company and the vault releases on-chain FD to its wallet. Every rule the
  server knows applies here, and only here: the early-sale tax on farmed FD (75% at launch, falling to the
  normal fee over six real months, burned), the daily limit (a share of the pool a day per company), the
  frequency fee, the logbook (a locked slice can't leave; a spend-only slice can't leave until its lock
  ends), a hold while a case is open, slashing (a stake lives in the ledger, so a revocation takes it before
  it can leave), and whatever per-person checks the auction's verification gives the server.
- *What it can't do:* anything once the FD is out. Outside the game FD is a plain token; the bridge's tax is
  paid once, on the way out, and a holder who withdraws and dumps meets the pool's own fee and depth and
  nothing else. That is why the auction's depth and the pool's fee scheduler carry the launch, not a band.
The sim's in-game exchange (`buyFd`, `sellFd`) is the bridge and the pool in one step: a sale is a
withdrawal and a swap, a buy a swap and a deposit. The server charges the bridge's rules before the swap,
which is where the sim applies them.

**The vest (changed 2026-11-01).** Jeff dropped the price condition: the treasury's vest is a cliff and a
weekly cap, published, with no floor at the TGE price (`token.treasury.vest.priceFloor`, on until the
package ships, off then). The airdrop's logbook has no price condition either; its clock is the milestones
and the deadline. The supply path still holds payouts while FD outstanding runs over it, and never reads
the price. Later seasons' pots still shrink when the season's average price sat below launch
(pot × min(1, avg ÷ launch)): that scales emission; it gates no sale.

**Changing it later.** The in-game rules move by a ruleset bump, announced. The on-chain parameters (the
vest escrow, the bridge's limits and tax, the pool's fee settings) sit in a Squads multisig with a time
lock, so every change is a visible proposal before it executes. The cap never changes: the mint authority
is gone.

**What the sim still has to show (v50, the launch smoke):** the auction tranche and the decaying fee
against every bad actor, beside the ±5% band of v49-a that is no longer on the table on-chain: what the
tranche's size does to the peak and to who takes what, and whether the fee does any of the band's work.

## The launch smoke (v50, 2026-11-01): the auction tranche against the bad actors

A small world (a quarter of the full one: 100 owner-operators, 30 fleets, 15 brokers), every bad actor at a
quarter (farmers at 30% of players, three sybil clusters, 50 momentum traders, a 125-wallet crowd, a $12.5k
whale), the token launching at half a year, 400 days, bare rules (no sinks), seeds 1, 4, 8 (`runs/compare-v50.md`).
The sim lets the crowd and the whale bid in the auction, at most $1,000 each; the momentum traders buy after
it. In every variant the pool opens with the same $42k (the crowd's $34k and the escrow). Means of three seeds:

| | Launch price | Peak (× launch) | Peak market cap | End price | Pool $ at end | Farmers / sybils take | Speculators' net | Fleets' net |
|---|---|---|---|---|---|---|---|---|
| No protections (n) | $0.00062 | 450× | $6.5M | $0.000074 | $3k | $32k / $67k | −$82k | −$19k |
| ±5% band, farmed tax, logbook (b, v49-a's package) | $0.00066 | 12× | $268k | $0.00039 | $6k | $6k / $4k | −$3k | −$11k |
| The auction alone, 5M tranche (a) | $0.0068 | 19× | $3.0M | $0.00017 | $7k | $29k / $44k | −$75k | −$6k |
| The launch fee alone (f) | $0.00062 | 340× | $4.7M | $0.000079 | $3k | $26k / $54k | −$79k | −$14k |
| Option A: the auction and the fee (af) | $0.0068 | 19× | $2.8M | $0.00018 | $7k | $25k / $40k | −$75k | −$7k |
| A with the size fee (afs) | $0.0068 | 16× | $2.5M | $0.00018 | $7k | $27k / $40k | −$90k | −$2k |
| A with the bridge's rules: the farmed tax, the logbook (aft) | $0.0068 | 22× | $3.2M | $0.00068 | $13k | $14k / $18k | −$38k | −$10k |
| aft with the ±5% band (aftb) | $0.0068 | 2.2× | $377k | $0.00077 | $14k | $8k / $7k | −$14k | −$12k |
| A with a 2.5M tranche (af2) | $0.014 | 16× | $3.7M | $0.00013 | $4k | $37k / $66k | −$95k | −$19k |
| A with a 10M tranche (af10) | $0.0034 | 20× | $2.3M | $0.00023 | $11k | $17k / $24k | −$61k | −$0.1k |

- **The auction takes an order of magnitude off the bubble.** Without it the listing spikes 450× (the
  dollars-supported open is $0.00062 against an $8k pool); with the tranche the pool opens five times
  deeper and the spike is 16–22×, in absolute terms a peak price of $0.07–0.13 against $0.28. What is left
  of it is the momentum traders' dollars (they don't bid in the sim) against the pool.
- **The clearing price is set by the bidders' dollars over the tranche, and in this world it was ten times
  what the economy supports:** $34k over 5M FD is $0.0068, and the price then fell 97% in the 218 days
  after launch, as the bare world printed FD (supply +200%) that farmers sold. The tranche's size decides
  how far: at 2.5M the launch read $151k of market cap and ended at $9k; at 10M it read $95k and ended at
  $21k, with three times the pool dollars of the 2.5M case, half the farmers' and sybils' take, and the
  fleets net even. Bigger is better: the clearing price lands nearer where the market settles. (The world
  has no sinks, so nothing holds the launch price here; in v47-b, full size with the sinks on, the price
  ended 17% above launch. The full-size test decides the size.)
- **The decaying fee is not a bubble tool.** Alone it leaves the spike at 340×; on top of the auction it
  changes nothing in the peak or the end. What it does is fund the buyback ($13k of dollars against $1k)
  and burn 0.4–0.8M FD of early sales. The size fee is worth a little (the whale pays: the fleets' net goes
  from −$7k to −$2k). Keep both as the pool's settings, not as the defense.
- **The bridge's rules do the most for what comes after.** The farmed-FD tax and the logbook on top of the
  auction quadruple the end price ($0.00068 against $0.00018), double the pool's dollars, halve what farmers
  and sybils take and what speculators lose, bring 39 newcomers instead of 25, and burn 22.5M FD of early
  sales (supply +155% instead of +220%). They don't touch the peak.
- **The band's job is the one thing left on the table on-chain:** on top of everything (aftb) it caps the
  peak at 2.2× and otherwise matches aft (the end price $0.00077 against $0.00068). Jeff chose no band
  on-chain, so the launch defense is the tranche's depth and the bridge's rules, and a 20× spike-and-fall
  in the first weeks is the cost, unless more of the speculative money arrives through the auction (a
  bigger reach, a higher per-person cap) or the auction's FD vests to its bidders over the first weeks
  (an Alpha Vault setting; not modelled yet).

**Next:** the full-size test with the sinks on (the package of v47-b plus the bad actors of v46): the auction
and the fee with the farmed-FD tax and the logbook, at tranches of 20M, 40M and 80M FD, beside v49-a; then
Jeff sizes the tranche and the cap.

## The airdrop inside the game, the bridge and the Back Lot (built 2026-11-01, overnight; all behind switches, off)

Jeff's calls of the evening of 2026-11-01, in order: no selling inside the game, FD is its only currency, and every
withdrawal through the bridge is treated as a sale and pays the taxes and limits there; the whole airdrop paid at
the TGE, spend-only inside the game, unlocked for withdrawal by the achievements; a withdrawal timer, cancellable;
the farming season's dollar window for rigs, trailers, facilities and businesses, every dollar to the pool at the
TGE, no cap; robbers and the Back Lot on in the beta; the vest in real time. What was built:

**Sticky locks (ledger.ts).** Spend-only FD is a locked sub-balance of an account, not a number on the company.
Spending draws on it first; a payment to another company or into any escrow (a stake, a deposit, a bond, a pool)
carries it, still locked; it dies only in a true sink (fuel, wages, fees, burns, the house's goods). A withdrawal
takes free FD only. Assets remember their locked basis: a truck, trailer, business, facility, yard or dealership's
stock bought with locked FD returns its proceeds locked up to that basis when sold, traded in, written off or
scrapped, and a lease deposit paid with it comes back locked. So locked FD can be used anywhere in the game and
can never be laundered into FD that leaves. One bounded exception stays: a company that spends its own locked
airdrop and then receives another's locked FD can unlock up to its own allocation of what it received through
its milestones (the ledger doesn't tell one lock from another). It takes a second allocation to exploit, which
the identity check prevents; it is recorded here, not hidden.

**The airdrop paid at the TGE (`token.airdrop.logbook.paidLocked`).** The whole allocation lands in the account
when the book opens, `atLaunch` (1%) free and the rest locked. A milestone unlocks its share for withdrawal
instead of minting it, as far as the FD is still there (what was spent is gone, and nothing is minted in its
place). The supply path has nothing to queue: the airdrop is minted once. At the deadline, what is still locked
and unspent burns; a conviction or a liquidation burns it the same way. The shop items (`logbook.boost`,
`buy_logbook_boost`): a milestone that counts something (loads, profit, trucks, hits, the take) can be bought
forward once for 3% of the allocation (at least 1,000 FD, a sink); it then asks 75% of what it did.

**The bridge (`token.bridge`).** A sale is a withdrawal request: the FD is frozen in the company's bridge
account for the timer (28 game days at launch, seven real days, falling to 8 by six real months), then leaves
through the exchange's rules on the day it clears (the early-sale tax on farmed FD, the per-company daily limit,
the frequency and impact fees), and the whole game may withdraw at most 2% of the pool's FD a day (a share s of
a constant-product pool moves the price 1/(1+s)² − 1: about −4%); what doesn't fit waits for the next day. A
request can be taken back while it waits, for a 2% burn (Jeff: "in case people change their mind"; the burn
keeps a standing request from being a free option). The sim treats every withdrawal as sold into the pool the
day it clears. Deposited FD counts as bought (the early-sale tax never falls on it). The speculators of the
batches now hold FD in wallets (`adversaries.onChain`): their buys and sales meet the pool alone, which is what a
clean token faces; the batches before v51 had them trading as game accounts, under limits a chain can't apply.

**The dollar window for assets (`token.catalogue.usdWindow.assets`).** In the farming season new rigs and
trailers from the NPC dealer, facilities and businesses sell for dollars at the catalogue's reference price and
premium, every dollar held for the launch pool, no cap (Jeff: "why would we cap it?"; the 1% cap on any one
company's airdrop share bounds what dollars can buy from the pot, as long as one person is one company).
Trades between players stay in FD: dollars reach only the house, so none bypasses the pool.

**The team allocation and the vest.** `circular.shares.dev` splits a team allocation from the protocol treasury
(the auction tranche, later seasons, liquidity, bounties); the vest then sells from it. `vest.realTime` counts
the cliff and the weekly share in real weeks (28 game days at the live clock); `vest.linear` makes the week's
share a share of the allocation at launch, so the vest ends. Proposed to Jeff, numbers pending: 12% of the cap,
a six-real-month cliff, linear over four years. The price floor at the TGE price is gone (`vest.priceFloor`,
Jeff, 2026-11-01).

**The Back Lot, v1 (`robbery.*`, the bad-actor spec §8).** The fence's share of stolen cargo by commodity
(`fenceByCommodityOn`: electronics 30%, groceries and merchandise 35%, beverages 40%, pharmaceuticals 15%,
machinery 10%, steel and lumber 20%...). A real stake behind the hire (`realStake`): `stakeCover` × the most the
crew could take, locked in its own account for the crew's window, counting every open crew; on a hit it pays the
victim's cargo and physical-damage deductibles first and the rest comes back; the equity check is gone with it.
One open crew on a company at a time (`oneCrewPerVictim`). Only operating companies hire or post bounties; a
hirer's crews end with its authority. Fences and chop shops as player businesses (`backLot.enabled`,
`businesses.kinds.fence` 90k + 30k bond, `chopShop` 120k + 40k, behind the crews' layer of the ladder): a fence
buys what a crew took, at the truck's hub first, pays the hirer the share less the wash fee (which goes to the
reserve) and resells it a week later for the share plus 15% of the cargo's value (half that for perishables); a
chop shop buys a chopped rig at 20% of its value and sells the parts for 45% of it. With no player to buy, the
reserve's fence pays `npcFenceShare` of the take (1 until the package sets it lower). The take can be made
spend-only (`takeLocked`: "dirty FD is never directly cashable"). Bounties (`bounty`): FD put on a company,
held in escrow for 90 days, paid to whoever's crew hits it (never the poster's own), on Channel 19 like the
hires and the hits. Notoriety: the crews a company hired in the last 56 days, on its scorecard, with no penalty
from the game. The logbook counts a hit on a company of at least `logbookMinVictimTrucks` trucks (0: any; the
package sets 3), so two wallets can't rob each other to unlock their airdrops. Bots: outlaws open a fence and a
chop shop before other businesses; a company hit puts a bounty on the hirer; outlaws need the stake in hand.

**Not built (the Back Lot v2, after the server):** the dirty wallet and washing through fronts, the contraband
board, off-book handoffs, corruption and services, aliases and shells, the aged-authority market, crew
integrity, contract theft's return as alias fraud (spec §8.4–8.6, §9). The "free FD only" flag on listings
and lease offers, so a seller can refuse locked FD and the market prices the lock (Jeff: keep it on the list).

**The client:** a Logbook tab (the airdrop and its milestones with the shop items, the unlock ladder, Channel
19 with bounties and notoriety); the opening auction and the bridge's queue on the Money tab; the used lot and
the dollar window in the showroom; fences and chop shops in Business.

**What the sim showed (v51, 2026-11-01, `runs/compare-v51.md`):** full size, four years, seeds 1, 4, 8; the
package of v47-b (mid truck prices, the used lot, the deposit credit, every sink, the ladder, the robbers) with
the bad actors of v46, now holding FD in wallets, and every new rule except the Back Lot's (built after the
batch was designed). Means of three seeds:

| | v47-b (no bad actors) | v48-b (band ±15%, bad actors) | 20M tranche, no bridge | **20M tranche** | 40M | 80M |
|---|---|---|---|---|---|---|
| Pool at open | $36k | $33k | $267k | $267k | $267k | $267k |
| Launch price | $0.00082 | $0.00075 | $0.0077 | $0.0077 | $0.0039 | $0.0019 |
| Peak price (× launch) | 4× | 87× | 9× | 9× | 9× | 9× |
| Peak market cap | $260k | $5.7M | $5.9M | $6.2M | $4.9M | $4.2M |
| End price (× launch) | 1.17× | 0.93× | 0.25× | 0.25× | 0.33× | 0.45× |
| End market cap | $113k | $79k | $261k | $261k | $245k | $239k |
| Pool $ at end | $39k | $31k | $134k | $134k | $156k | $177k |
| Farmers / sybils take | $0 / $0 | $18k / $12k | $18k / $5k | $11k / $3k | $6k / $1k | $3k / $757 |
| Speculators' net | $0 | +$85k | −$81k | −$59k | −$60k | −$65k |
| Owner-operators / fleets net | $26k / −$61k | $7k / −$113k | $46k / −$140k | $44k / −$149k | $22k / −$159k | $11k / −$160k |
| FD outstanding, growth | +39% | +33% | +36% | +37% | +23% | +8% |
| Airdrop queued under the path | 4.7M | 4.2M | 0 | 0 | 0 | 0 |

- **The auction does what it was built for.** 501 bidders put in $155k; with the farming season's dollar window
  the pool opened with $267k instead of $36k (rigs bought for dollars in the beta brought $112k of escrow).
  The listing spike is 9× instead of 87× with the band, the speculators lose $60–80k instead of taking $85k
  (they buy the top from each other and sell into a pool that holds), farmers take 40% less and sybils 75%
  less than under the band, and the dollars left in the pool at the end are three to four times the band's.
- **The clearing price sits above where the economy settles, and the tranche's size decides who carries the
  gap.** The end market cap is the same at every tranche, about $250k: that is what an economy of this size
  supports after four years, whatever the number of FD. A small tranche prices each FD higher (the airdrop is
  worth 2.2× as much at 20M as at 80M) and lets the bidders fall further (−75% from their price); a big
  tranche spreads the same dollars over more FD, the bidders fall less (−55%) and the pool keeps more ($177k
  against $134k), but every holder's FD is worth less. The launch-price gate fails at every size because the
  bad actors' money leaves; v47-b, without them, held 1.17×. 40M is the middle: bidders −67%, the airdrop at
  1.5× the 80M price, $156k in the pool, farmers at $6k.
- **The bridge** (20M with and without it): farmers' take $11k against $18k, sybils' $3k against $5k, the end
  price and the pool the same, honest operators unchanged. A withdrawal waited 18 days on average (the timer
  and the cap's queue); the cap held something back on about 900 company-days; 0.7M FD was still waiting at the
  end. Requests were 53M FD over two years, cleared 52M.
- **The airdrop inside the game.** 16M FD minted once (the launch pot and one later season), 6.4M unlocked by
  honest milestones, 8.4M still locked at the end (the deadline lies past the run), and 9M of spend-only FD
  sitting in accounts: the bots keep it as cash. Nothing is queued under the supply path any more; the path is
  still run over by the economy's own growth (28% over, 521 days, at 20M; 1.8% at 80M, where the tranche
  raises the base), so the vest held 74 of 104 weeks and the dial sat at its floor throughout, as in v47-b.
- **What it cost the operators:** fleets put in $150–160k a seed buying FD to run their companies in a market
  priced ten times higher at launch (v47-b: $61k), and newcomers were 178–192 against 201.
- **Caveats:** the strategy gate reads 3–9× because single newcomers top a small segment (v47-b's 1.6× was an
  established owner-operator; the bad actors' strategies need their own segment); the Back Lot's switches,
  the real-time vest and the team allocation weren't on; the treasury's vest still sold from the whole
  treasury allocation (3.6M FD for $16k, held by the path most weeks).

## The package switched on (2026-11-01, config/live.ts; ruleset 0.19.0-phase0.29)

Jeff's "Go" on the morning of 2026-11-01, after the night's build and v51. The live world restarted on it with
no players (world/meta version 20, live page version 36). Every switch of the combined test and of the overnight
build is on, as levers in `packages/config/src/live.ts`, so the sim's default profile and the live world read the
same config; the base config stays what the tests and the design notes are written against.

- **The trucks:** tractors and trailers as assets with wear, life and write-offs (`assets`); mid prices, the
  realistic list × 0.62 (Workhorse 140k, HighwayPro 177k, Flagship 214k; van 42k, reefer 79k, flatbed 47k;
  rebuilds 31.5k / 40k / 48k; refurbishments 4.8k / 9k / 5.3k); the NPC used lot as the free path's way in;
  the lease deposit counting toward the first truck; purchase loans; leases priced by the truck's value.
- **Staff, sales and direct freight:** the ladder (the owner runs two trucks, a dispatcher ten; a maintenance
  manager from the fifth truck at fifteen each, an operations manager from the eighth at twenty), the optional
  roles, direct contracts behind a sales rep and a performance stake, the scale discounts; a labor pool of 300
  dispatchers, 60 operations and 90 maintenance managers to start.
- **Theft and the Back Lot:** the theft gaps (claims move the insurance market, a theft costs dock time);
  contract theft removed (`fraud.theft.byCarrier` false: cargo theft is NPC thieves and hired crews only, and
  the Fleet tab no longer offers it); the robbers and the Back Lot v1 on in the beta (the fence's share by
  commodity, a real stake behind every hire, one crew on a company at a time, the take spend-only, the reserve
  paying 60% of a take when no player's fence buys it, fences and chop shops as businesses, bounties, a hit
  counting toward the criminal milestones only against a victim of three trucks or more); the unlock ladder from
  launch (businesses at 28 game days, re-brokering at 91, crews at 182).
- **The supply path:** +10% over four years, the dial never under the launch rates; the whale rules on sales
  (the frequency and falling-price limits).
- **The airdrop inside the game:** the logbook, the whole allocation paid at the TGE, 1% free and the rest
  spend-only until the milestones, with the shop items; the farmed-FD tax at the bridge (bought FD exempt); the
  bridge, where every withdrawal is a sale with a timer (28 game days at launch, 8 by six real months) and a
  daily cap (2% of the pool's FD for the whole game), cancellable for a 2% burn.
- **The launch:** the opening auction, a 40M FD tranche (4% of the cap) at one clearing price, $1,000 a person,
  every dollar into the pool; the pool's own decaying fee (50% falling to the normal fees over 14 game days);
  the beta's dollar window for rigs, trailers, facilities and businesses at 1.5× the reference price, every
  dollar to the pool at the TGE, no cap. Off, as decided: the price band and the size fee (neither exists in a
  standard pool).
- **The team allocation:** 15% of the cap (150M FD) in `alloc:dev`; the protocol treasury keeps 20.2% (the
  tranche, the pool's top-up to the float, later seasons, bounties). Nothing for six real months after the TGE,
  then 1/208 of the allocation a real week for four years, sold into the pool on the clock whatever the price
  (the vest's price condition dropped, as Jeff decided). The sim books every vested FD as sold, the worst case;
  a team that holds sells less. Why 15%: comparable launches give the team 15–25% of the supply with a cliff
  and a three-to-four-year vest, and here the players' side is 62% (the reserve, earned through play, and the
  airdrop); v51 carried more sell pressure than this (0.25% of the whole treasury a week, 0.88M FD, against
  0.72M a week here). The share and the years are Jeff's to change: one more restart while there are no players.

**What v52-a showed (the exact profile, seeds 1, 4, 8, seasons on; `runs/compare-v52.md`):** no crash in three
seeds of four years. The price ended at 79–143% of launch ($0.0013 → $0.0012; one seed held), the pool's dollars
kept ($71k → $70k; the window's dollars for assets opened it twice as deep as v47-b's $36k), the worst drawdown
59% (v47-b 70%, v51-b 96%); market cap $113k → $148k. Net selling 98k FD a month (v47-b net buying of 397k;
v51-b with the bad actors 1.7M sold). Supply 111M → 125M (+13%; 6.8% over the path on its worst day, the
payouts held 28 weeks, nothing queued since the airdrop is paid once). The bridge cleared 57.2M of 57.8M FD
requested at a mean wait of 17.5 days, capped on two days, 608k waiting at the end. The logbook paid 183k at
launch and 7.3M by honest milestones (8k criminal), 9.3M still locked at the end; 5.2M spend-only FD in the
economy at the end. Crews hired fell from 1,393 (v47-b) to 345 under the real stake, the one-crew rule and
operating-only hirers: 140 hits, 38 rigs chopped; fences took 139k and chop shops 205k and resold 841k; victims
were paid 408k from stakes; 447k of bounties posted, 40k paid. The free path's median 45 days (v47-b 41), 201
newcomers, liquidations 640 (v47-b 561; 0.18.4 with seasons on 884), the strategy gate 1.51×. Two differences
from the 0.18.4 live rules to watch on the dashboard: wealth concentrates more (Gini 0.73 against 0.56, the top
10% holding 52%: the trucks and the ladder) and more companies sit a few hundred FD in the red at the end (261
against about 100) while fewer are liquidated. Caveats: nobody bid in the auction (the honest bots don't; v51-b's
501 bidders were the crowd), so the pool opened on the window's dollars alone, as the live world will if no
player bids; the team's vest had not started (its cliff, six real months, is 728 game days, and the run ends 730
after launch): once it runs it sells about 180k FD a game week, 0.8M a game month, against the 0.1–0.4M net the
pool absorbed here, the sim's worst case of a team that sells every token on the clock; seasons on makes v47-b an
imperfect baseline (its holding-cost sink of 41M becomes 2.5M when the season close takes the hoards).

## The Back Lot v2 (Jeff, 2026-11-01, the morning after the switch-on; built, config `robbery.lot`, off)

What v52 showed of v1 (hirers losing half of what they put in, the money going to whoever owned the fence) led
Jeff to redraw the crime layer the same morning. His rules, and what was built behind `robbery.lot`:

- **Channel 19 is a forum.** It hears of hits and of crews that got caught, after the fact; a hire is never
  posted and the owner is never warned. The law treats it as hearsay: nothing said there opens a case.
- **Crews are hired in the Back Lot, on its own board:** six NPC crews at a time, refreshed weekly from the
  seed, each with a skill (its odds), a discretion (whether it talks when caught) and a price. A cheap crew is
  more likely to get caught and to talk.
- **The fee is prepaid and burned,** and keyed to what the boards would pay for the truck as it stands: half of
  the fence board's price for the load aboard plus the chop board's price for the rig at its odds, never under
  4,000 FD, times the crew's price. A load of paper never pays; a load of electronics pays when the truck is bare.
- **The victim is a victim.** The claim less its deductible, the rig at its cover less its deductible, the
  broker's penalty, the lost Miles. Nothing comes from the hirer. The stake, the restitution, the cooldown, the
  one-crew rule and the newcomer shield of v1 are gone.
- **A bare truck is an easy mark.** Outside a truck stop or a secured yard a crew hits a bare truck at 88%; a
  tracker takes 45 points off, locks 30, a camera 25, a security manager up to half of what's left, and a weaker
  crew less still. The hirer sees the truck, its trailer, what it hauls and who owns it, never the fittings.
- **Yards get security of their own:** a gate, cameras, lighting and a guard on weekly pay, through the catalogue;
  together they put everything standing at home out of reach, and they keep NPC thieves off the trailers.
- **A caught crew may talk.** On a miss the crew is caught at 25% (a skilled crew half as often), on a hit at 5%;
  a caught crew talks unless its discretion holds, and Channel 19 then names the hirer.
- **Heat replaces the cooldown.** The law's interest in a company, private to it: 4 a hire, 30 a crew that talks,
  cooling 0.4 a day and twice as fast after a month without a hire. At 100 it adds 40 points to the weigh-station
  pull-in odds and 50 points to the weekly odds of a compliance review; a review of a company at 40 or more
  becomes an investigation that finds the lot's books at odds rising with heat. A conviction forfeits the
  criminal unlocks, fines three times the last quarter's fees, suspends the authority 28 game days and halves
  the heat; a clean file cools it a third. A career criminal still runs a real company, because the audit reads
  everything.
- **The NPC fence and chop shop are the only buyers,** at a public demand board: the fence pays the commodity's
  share of a load's value and the chop shop the tier's share of a rig's (15 / 20 / 25%), each sagging as stolen
  supply of that kind comes in and recovering over eight weeks, with four commodities, and sometimes a tier, at
  1.5× each week. The wash still comes off the hirer's end. Player fences and chop shops close under the lot.
- **No shield for newcomers:** the free path's rigs carry the lessor's tracker and the lessor's policy carries
  the cargo deductible, so a robbed starter loses the load and a day while the griefer loses the fee and gains
  heat.

What the bots do with it: an outlaw lays low above heat 35, picks a discreet crew when warm and the best skill
for the price when cool, bets on the loaded trucks the boards pay most for assuming a bare truck (it knows the
lessor's rigs carry a tracker), and avoids companies that got a crew pinched lately; a company hit, or with a
crew pinched near its truck, fits a tracker, then locks, then a camera; fleets of eight or more fit trackers as a
policy; a yard with ten or more trucks gets a gate, cameras and lighting, twenty a guard. The page's forms for
hiring a crew, fitting security and the yard's items are not built yet: only the bots use them.

**What v53 showed (the live profile with the lot on, seeds 1, 4, 8, four years; `runs/compare-v53.md`; v52-a is the
live world's v1):** crime tripled and the economy didn't notice. 1,155 crews hired against 345, 645 hits against 140,
197 rigs chopped against 38; the hit rate 56% against 41%, which is what fittings and the lessor's tracker leave of a
bare truck's 88% on average. Hirers still lose, and that is the hidden fittings at work: the boards paid 3.8M FD against
4.4M of fees burned, a net −0.67M (v1 −0.21M), 15% of what they put in (v1 23%); cheaper hires at 35% of the board lose
the same share (−0.61M); with heat off the outlaws hire 15% more and lose 1.0M. The lot is a sink: 4.4M of fees and 2.2M
of fittings burned against 3.8M paid from the reserve. Heat as set barely bites: 83 crews caught and 30 talked a seed,
the hottest company 8 to 37 at the end, three investigations and one conviction per three seeds across some 45 outlaws
in four years, because the outlaws lay low above 35 and stay under the investigation line at 40; heat off costs the law
nothing it was collecting, and cuts hires by 15% when on, so it is a brake, not a trap. No starter was robbed by a crew:
the lessor's tracker priced the free path's rigs out of every hire (no deductible was ever waived). The bots bought
almost no yard security (one seed, 73k): at the sim's fleet sizes few yards hold ten trucks, so the items wait for
players. The economy sat still: the price $0.0012 → $0.0012, the pool $67k → $64k, liquidations 648 (640), the free
path 46 days (45); owned trucks ended at 511 against 539 from the chopping, the insurance sink rose from 8.6M to 10.5M,
and more companies reached the criminal milestones (17 a crew hit against 5, 8 a rig chopped against 1) while fenced
and cold-case stay at one. Bounties: 3.2M posted, 418k paid; the bots knew the hirer from the sim's own records, a
leak fixed after the batch (a victim now bounties only a hirer a pinched crew named), so v53 overstates what players
could do with bounties.

**Knobs for the tuning Jeff expects:** heat's step and line (`perHire` 4, `perTalk` 30, `investigateAt` 40 leave a
career criminal untouched if it paces itself; 6 / 40 / 30 would put a crew a week inside the law's reach), the fee's
share and floor (they set the sink's size more than the hirers' loss, which the hidden fittings set), the catch odds
(25% on a miss, 5% on a hit), the fittings' cuts against the base 88%, and the boards' sag and hot multipliers.

## Beta one (Jeff, 2026-11-01: "configure beta one"; ruleset 0.19.1-phase0.30)

The first beta is the trucking sim, opened in layers, with the crime layer held back until it leaves the simulator.
Two rule changes on top of the 0.19.0 package, both live levers:

- **The ladder runs in the beta** (`unlockLadder.beta.enabled`): the same schedule counted from the world's first
  day, so a new player meets hauling first, businesses and facilities on day 28, re-brokering on day 91; a layer
  opened in the beta stays open through the launch. The locked tabs say what each layer is and the day it opens.
- **No crews** (`robbery.enabled` false): neither the v1 crews the package switched on nor the v2 lot, so no player
  is robbed by a hired crew under rules that only bots have played. NPC theft in the corridors stays. The Back Lot
  comes with a later beta, tuned on what real players do (v53's knobs).

Everything else of 0.19.0 stands: the sinks and the dial, the trucks at mid prices with the used lot, loans and
the deposit credit, the staff ladder, docks, weather, parking, the supply path, the logbook paid locked at the
TGE, the bridge, the auction and the team vest for the day the token launches. The page carries Iuliia's
walkthrough, the roadmap, the Report button and the teaser tabs. The public test site runs it as a private,
pausable world; the live world restarts on it when Jeff says.

**What v54-a showed (the exact beta-one profile, seeds 1, 4, 8, four years; `runs/compare-v54.md`):** the ladder
opened businesses on day 28, re-brokering on day 91 and the crews' layer on day 182 of the beta, with nothing to
open on the last since crews are off; no crew was hired anywhere; cargo thefts fell from 967 to 805 (NPC thieves
only). The economy sat where 0.19.0 left it: the price $0.0013 → $0.0013 (85 to 137% of launch by seed), the pool
$72k → $72k, liquidations 652 (640), the free path 45 days, owned trucks 537 (539), 14 shops and 57 truck stops open
at the end (15 and 55), the strategy gate 1.40×. No crash.

## Sprint 1 (2026-11-02): the first bid by hand

Sprint 0's playtests found the game played itself: the default dispatcher bid for a new player before they had read
the board. Jeff approved one rule and the economy is otherwise frozen. **`freeEntry.firstBidByHand`** (default off;
on for beta one with the ruleset bump and a restart with no players): a carrier with one truck runs no standing
order until its owner has placed a bid or booked a load by hand; its truck waits at home. The first accepted bid
lifts it for good, win or lose. Fleets of two or more never wait. Bots place their first bid by hand too, reading
their home board once a day the way a player would (`ruleBots.ts firstBidByHand`), so the batches still run.

**What v55-a showed (the live profile with the switch on, seeds 1, 4, 8, 400 days; `runs/compare-v55.md`, beside
v55-0, the same profile with it off):** every starter bid by hand and its truck waited one day (the first midnight's
read of the board). The free path did not slow: the median starter bought its truck in 52 days against 56 with the switch off (45–63
against 49–69 by seed), 289 against 275 bought within 84 days, liquidations 157 against 147 (131–186 against
138–166, seeds moving both ways), cleared loads and owned trucks within half a percent. The one-day wait is the
rule's whole cost in the simulator; what a player does with the wait is the sprint's question, not the economy's.

**The first board** (`apps/sim/src/firstBoard.ts`; `studio/reviews/economy-first-board.md`): at the restart every
starter hub offers a new authority a profitable open load nearly every round from day 2 (Chicago 100%, Dallas 94%,
Phoenix 93%, Memphis 88% of rounds over fourteen days); only the first morning is thin (two rounds, Dallas 17%). The
vetting gate locks half the van loads on the restart's board and almost none after the first week, when the brokered
freight goes to vetted carriers first; what a newcomer lacks later is price by season (Chicago in May posts 1.2–1.8
FD/mi against a leased truck's 2.0 break-even; in February it is the best board of the four). No lever moves without
moving the market; the proposal is to run the world two game days before the page opens, and to keep Phoenix.

**Switched on (2026-11-02, ruleset 0.19.2-phase0.31).** Jeff's yes to the rule (the bible's third question) and
v55-a's numbers above put `freeEntry.firstBidByHand` among the live levers. Nothing else in the profile moved; the
live world restarts on the next republish (no players).
