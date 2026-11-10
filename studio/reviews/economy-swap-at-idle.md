# Economy: the lease-replacing truck handed over at the next idle, the pair (2026-11-10)

The ten-seed reading of `assets.swapAtNextIdle` (6fa465f, off by default: on, a truck ordered to replace the lessor's
is handed over the moment the leased truck next goes idle once its day has come, instead of only at a day's close that
finds it idle). The on arm against off, with the collateral rule on in both (the points on the authority's age) and
`usedMarket.npcLot.startersFromStock` on, as 0.24.1 carries them (Jeff's yes, 2026-11-10); the on arm's cap-off twin for
the gate; a two-seed identity check of the off arm against the starters pair's stock-on run; and a two-seed read with the
lot's queue instead of stock, for the record. The gate's ten seeds, 1460 days, in a scratch worktree at 6fa465f, launched
into clear vitest gaps between 05:22 and 09:00 on a slow Mac. No engine edit; nothing is staged.

## The finding first

**The rule does what the client promises and the economy does not notice.** Late hand-overs of a starter's replacement
truck fall from 58% to 36% of hand-overs, from a median of 5.5 days late (mean 11, the worst 194) to a median of 1
(mean 1.5, the worst 4), and the trucks still waiting past their day at day 60 from 13.5 a run to 0.3. "Takes over when
the leased one is next idle" is now true within one job. The ten seeds' market is the off arm's to within a percent on
every line; the gate passes nine of ten, the one fail on seed 7's band at 0.837, three thousandths under the floor on
the seed that reads at the floor on every run of this code (0.843 baseline, 0.840 the loan rule, 0.850 the starters
pair), with the ten seeds' corrected ratios within four thousandths of the off arm's quarter by quarter and the sinks
and faucets within 0.2%. **My call: ride in 0.24.1 as the eighth switch**; it needs no yes of Jeff's beyond the set's,
since it changes no figure a player reads and no line of the economy, but the two figures are in §5 if he wants them.

## 1. The gate (swap on, cap on, against swap on, cap off): nine of ten

| Seed | Band, lowest of the four | Twin's gap | Carriers Y3 · Y4, % of twin | Cleared/day Y3 · Y4, % of twin | Prudent OO first truck (twin) | Gate |
|---|---|---|---|---|---|---|
| 1 | .841 | −.024 | 81 · 89 | 92 · 95 | d123 (d52) | PASS |
| 2 | .849 | −.017 | 79 · 83 | 94 · 90 | d182 (d85) | PASS |
| 3 | .847 | −.027 | 86 · 86 | 94 · 97 | d134 (d64) | PASS |
| 4 | .850 | −.014 | 86 · 88 | 108 · 105 | d129 (d51) | PASS |
| 5 | .854 | −.007 | 88 · 92 | 99 · 99 | d122 (d54) | PASS |
| 6 | .847 | −.028 | 83 · 85 | 113 · 113 | d180 (d98) | PASS |
| 7 | **.837** | −.020 | 90 · 89 | 99 · 103 | d114 (d59) | FAIL (band) |
| 8 | .846 | −.031 | 84 · 87 | 112 · 108 | d187 (d80) | PASS |
| 9 | .858 | −.016 | 85 · 86 | 104 · 100 | d174 (d70) | PASS |
| 10 | .843 | −.024 | 78 · 82 | 101 · 101 | d151 (d83) | PASS |

The floors pass everywhere (carriers 78–92% of the twin's, cleared 90–113%, debt under the line, the cold start inside
its budget, supply and the spread). The band's mean over the ten seeds sits four thousandths under the off arm's in the
last four quarters (0.839 / 0.870 / 0.863 / 0.849 against 0.843 / 0.875 / 0.872 / 0.847), the twins' two thousandths
over theirs; the sinks total 1,525M against 1,527M and the faucets 1,753M against 1,751M, with no tag moving more than
2.6M (the dealer −2.6, road service +2.1, loan principal −2.0). That is a different realization of the same world, not
a mechanism: a truck a week sooner is a week of lease rent fewer (about 250 FD a starter, 0.01% of the sinks) and a week
of earning sooner, and neither reaches the band. Seed 7 is the floor's seed.

## 2. Hand-overs (every lease-replacing order, a ledger-side tally; ten-seed means, the off arm two seeds)

| | Off (the day's close) | On (the next idle) |
|---|---|---|
| Lease-replacing trucks handed over, a run | 335 | 340 |
| Handed over after their day | 194 (58%) | 124 (36%) |
| Days late: median · mean · worst | 5.5 · 11.0 · 194 | 1.0 · 1.5 · 4 |
| Still waiting past their day at day 60 · day 365 · the end | 13.5 · 0 · 1.5 | 0.3 · 0 · 0 |
| Other orders (fleets' rigs) handed over · late | 493 · 12 | 474 · 14 |

With stock on, a starter's rig is due seven days after the order; "late" is the leased truck not idle at a day's close
after that. On, the remaining lateness is the job in hand when the day comes (a day, rarely two), and the long tails
(a truck that was never idle at a day's close for weeks, 194 days at the worst) are gone. With the lot's queue instead of stock (two seeds, for the record, in case Jeff's yes is withdrawn): the same
shape, 34–39% late with a median of a day and the worst at 4, one truck waiting past its day at day 60 against the
queue's 13.5; the dealer's first-quarter rush stays (67 / 64 / 51 days in months 2–4), since that is the queue's, not the
hand-over's; liquidations 0.230 and 0.175 against 0.210 and 0.198 on the same seeds without the switch, two-seed noise.

## 3. The first truck's day, liquidations, loans, owned trucks

| Ten-seed means | Off | On |
|---|---|---|
| Free path: median day of the first owned truck (the order's day) · within 84 | 47 · 339 | 47 · 340 |
| Owner-operators: greedy · random · conservative median day | 37 · 50 · 149 | 37 · 49 · 149 |
| Owner-operators' liquidated share · bankrupt a run | 0.196 · 79.2 | 0.196 · 79.5 |
| Loan defaults · trucks seized | 206 · 110 | 213 · 120 |
| Owned trucks at the end | 585 | 562 |
| Lot rigs sold · used-market sales | 338 · 790 | 340 · 798 |
| Cleared · mean rate · the cap's paid freight, M | 447,086 · 3.76 · 1,392 | 449,665 · 3.76 · 1,399 |
| OO · fleet profit per truck-week | 2,088 · 2,020 | 2,130 · 2,048 |
| Companies bankrupt (oo · fleet · broker) | 178 (79 · 41 · 26) | 180 (80 · 44 · 27) |

The order's day is the first truck's day in every report and it does not move; the delivery moves by the days above.
Liquidations, defaults and seizures are inside the seed spread (the starters pair moved them; a day's hand-over does
not). Owned trucks at the end, 562 against 585, is inside the spread too (521–613 against 546–631). On the test page's
world the route-open day is the order's day and is unchanged by the rule; what a player sees change is the toast's
day: the new truck on the day the leased one next idles after its seventh day, not the first idle day's close after it.

## 4. The identity check

The off arm at 6fa465f (the collateral rule on, stock on, the switch off) reproduces the starters pair's stock-on run at
1633cc7 day for day on seeds 1 and 2 (every daily metric identical), so the starters pair's ten seeds and its gate (ten
of ten) are this pair's off arm.

## 5. Which ruleset, and the figures

**Ride in 0.24.1 as the eighth switch.** It is a hand-over rule, not a market rule: no bot buys differently, no price
or claim changes, and the ten seeds' economy is unchanged to within the spread, with the gate's one fail on the floor's
own seed by three thousandths. If Jeff wants it by name, the two figures: late hand-overs of a starter's replacement
truck from 58% to 36%, a median of 5.5 days late to 1; and the economy unchanged (cleared 447k → 450k, rate 3.76 → 3.76,
the carriers 78–92% of the twin's, nine of ten on the gate with the tenth at 0.837 on the seed that reads at the floor
on this code).

## What ran, and where

Two arms of ten seeds (swap on with its cap-off twin; the off arm reused from the starters pair after a two-seed
identity check) and a two-seed read with the lot's queue, `_wsim.ts` with a hand-over tally added (every order tracked
from posting to delivery against its due day), the gate (`gate-swap.json`), in a scratch worktree at 6fa465f; kept at
the economy's session scratchpad
and the worktree removed. Nothing in the shared checkout changed and nothing is staged; this note is the shared folder's
first, for the producer to place as studio/reviews/economy-swap-at-idle.md.
