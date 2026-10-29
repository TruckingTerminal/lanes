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
