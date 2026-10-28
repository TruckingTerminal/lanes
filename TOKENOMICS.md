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
