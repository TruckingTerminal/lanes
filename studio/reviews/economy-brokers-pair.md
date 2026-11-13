# Economy: the AI brokers' fix, the pair (2026-11-13)

On engineering's build at 1919cc3 (engineering-brokers-2026-11-13.md), behind `brokerRisk.fallOffLine`. The pair is
the one in economy-ai-brokers-2026-11-13.md §5: ten seeds, 1,460 days, windows off with 0.24.1's set, the switch on
against off, each with its cap-off twin.

## Verdict

**With windows off, the fix does what it was built for, and it passes the gate as 0.24.1 does (9 of 10). But it
narrows the carriers' floor by about 4 points.**

- **The AI brokers stop failing.** Liquidations fall from 27 to 10 of 60 a run. Their margin after costs, as a
  share of revenue, improves in every year, and their revenue no longer collapses in year 2. Fall-off charges fall 14%.
- **The gate holds where it held:**
  - Seed 7's band fails both ways: 0.838 off, 0.834 on. That is 0.24.1's own failure, not a new one.
  - The worst carriers' reading is 74·78 (seed 8) against the 72 and 75 lines. Off, the worst was 80·82.
- **The carriers pay a little for it:**
  - Owner-operators' profit per truck-week is 2,077 against 2,134 (−2.7%), and fleets' 2,001 against 2,032 (−1.5%).
  - Loan defaults rise 10%.
- **Under windows, which 0.25.0 brings, only one of the fix's three parts is new.** Windows already run the cover rule
  and count a lost load. Only the reach cap at the fall-off line acts, through windows' own urgency walk. So this pair
  answers only for a world without windows. The pair that matters for the ruleset after 0.25.0 is the bundle with the
  switch on against off. It is queued behind the days-off pair, and the off arm is the gate's own bundle run.
- **If Jeff holds windows back,** the bundle without windows would carry the fee and this fix together. On their worst
  seeds each reads 74 at year 3, against the 72 line. That pair would need its own gate before it rides.

## The lines (ten-seed means; the range across seeds in brackets)

| | Off (0.24.1) | **On** |
|---|---|---|
| **The AI brokers** | | |
| Liquidated, of 60 | 27.1 [13–40] | **10.1** [1–17] |
| Margin after costs, years 1–4 (share of their revenue) | −8.6% / 4.9% / 7.4% / 9.6% | **−5.1% / 5.9% / 9.0% / 10.7%** |
| Their revenue, years 1–4 (M) | 32.1 / 13.4 / 104.0 / 147.9 | **47.6 / 49.6 / 105.1 / 109.2** |
| Mean operating result a broker, four years (M) | 0.337 | **0.366** |
| Fall-off charges, four years (M) | 26.6 [22.8–33.4] | **23.0** [20.4–27.2] |
| … by year (M) | 2.7 / 3.4 / 7.3 / 13.2 | **2.8 / 5.5 / 6.1 / 8.6** |
| **Tenders, four years (thousands)** | | |
| Held back by the cover rule | — | **189** [169–205] |
| Sent to the board | 234 [183–271] | **237** [209–266] |
| Capped by the bond and payables | 390 | **379** |
| **Freight** | | |
| Brokered share of loads · of the cap's pay | 23.1% · 26.2% | **24.8% · 27.4%** |
| Carriers' pay per mile: brokered · direct | 3.696 · 3.599 | **3.679 · 3.605** |
| Cleared loads · rate | 448,291 · 3.755 | **447,587 · 3.758** |
| **The carriers** | | |
| Pay per truck-week | 8,017 | **8,009** |
| Owner-operators' profit per truck-week | 2,134 [2,080–2,234] | **2,077** [1,885–2,245] |
| Fleets' profit per truck-week | 2,032 [1,869–2,200] | **2,001** [1,762–2,305] |
| Companies bankrupt (OO · fleet · broker) | 179 (77 · 43 · 27) | **158** (75 · 45 · 10) |
| Owner-operators liquidated: greedy · random · prudent | .197 · .198 · .175 | **.194 · .186 · .175** |
| Fleets liquidated: greedy · random · prudent | .535 · .325 · .223 | **.555 · .320 · .237** |
| Loan defaults · trucks seized | 200.5 · 111 | **220.1 · 120** |
| **FD supply** | | |
| Cap released of 276M (M) · reserve drawdown (M) | 227.6 · 188.9 | **222.6 · 183.8** |
| FD in circulation, years 1–4 (M) | 31.1 / 66.9 / 85.8 / 117.7 | **32.0 / 68.1 / 86.5 / 113.7** |

**Reading it:**
- **The brokers.**
  - Off, the AI brokers collapse in year 2: revenue falls to 13M, and 19 of the 27 liquidations fall in that year
    (by year: 3.8 / 19.3 / 0.7 / 3.9). On, 7.7 fall in year 2 (1.0 / 7.7 / 0.7 / 1.0). Their revenue holds through
    year 2, and their margin is better in every year.
  - Year 4's revenue is lower on (109M against 148M). Off, the replacements of the failed brokers rebuild into the
    late market.
  - The cover rule holds 189,000 tenders over four years, but only 3,000 more reach the board than off. Most of what
    it holds the bond and payables caps would have held anyway, as engineering's 60-day smoke found. Off windows,
    their caps set the brokers' volume, not the cover.
- **The reach cap.** Over four years it barely touches brokered pay per mile (3.70 against 3.68). Engineering's −5.5%
  in 60 days was the opening boom, when the walk climbs furthest.
- **The carriers' floor.**
  - The cap arm ends with about 20 fewer carriers (3–4%) at years 3 and 4. The twin's count is unchanged (607 and
    691 both ways).
  - The likeliest route: surviving brokers keep a larger share of the cap's fixed pay (27.4% against 26.2%), and under
    the cap that share comes from the carriers. Without the cap, shippers pay it on top.
  - The floor still holds on every seed, but the worst seed's room at year 3 is 2 points.

## The gate, per seed (on)

| Seed | Band, year 4's four readings | Carriers, % of twin (Y3 · Y4) | Off, for comparison | Cleared (Y3 · Y4) | Debt |
|---|---|---|---|---|---|
| 1 | 0.844 0.849 0.856 0.864 | 84 · 87 | 80 · 82 | 97 · 96 | 0.0 · 0.2 |
| 2 | 0.842 0.848 0.849 0.856 | 76 · 79 | 84 · 87 | 102 · 93 | 0.1 · 0.1 |
| 3 | 0.857 0.860 0.864 0.873 | 82 · 86 | 83 · 84 | 96 · 96 | 0.2 · 0.1 |
| 4 | 0.844 0.850 0.856 0.862 | 84 · 88 | 81 · 86 | 97 · 94 | 0.1 · 0.1 |
| 5 | 0.850 0.848 0.853 0.860 | 88 · 88 | 90 · 94 | 105 · 99 | 0.2 · 0.1 |
| 6 | 0.857 0.862 0.862 0.869 | 79 · 84 | 87 · 89 | 96 · 103 | 0.4 · 0.2 |
| 7 | **0.834** 0.834 0.849 0.859 (fails, as off: 0.838) | 86 · 88 | 85 · 86 | 96 · 99 | 0.2 · 0.2 |
| 8 | 0.853 0.857 0.857 0.859 | **74 · 78** | 80 · 82 | 114 · 109 | 0.3 · 0.1 |
| 9 | 0.851 0.855 0.858 0.865 | 80 · 84 | 88 · 89 | 95 · 94 | 0.0 · 0.1 |
| 10 | 0.850 0.851 0.859 0.869 | 77 · 80 | 91 · 91 | 102 · 104 | 0.1 · 0.2 |

Every seed passes the cold start, supply, spread and free-path checks.

## Under windows: only the reach cap is new

From the code at 1919cc3:
- `brokerCoverOn` is `windowsOn(w) || fallOffLineOn(w)`, so windows already run the cover rule.
- `giveUp` counts a fall-off as lost only `!windowsOn(w) && fallOffLineOn(w)`. Windows count a load lost at its
  pickup's close instead.
- The `booked` flag is set by either.
- The reach cap in `raiseCeiling` acts under windows too, through the urgency walk (windows.ts:140). It is the only
  part that is new with windows on.

So with 0.25.0 live, the switch changes one thing: an AI broker's walk stops at contract × 1.15 instead of reaching
for the spot rate. The bundle's own pair (the switch on against the gate's bundle run, ten seeds with twins) is
queued at 1919cc3 behind the days-off pair.

## The pair on the 0.25.0 bundle (added 08:20): inert

The bundle at 1919cc3 with `brokerRisk.fallOffLine` on, against the gate's bundle run (off): ten seeds, 1,460 days,
cap-off twins.

**The switch changes nothing measurable under windows. It is harmless to ride, and it buys nothing.**

| The 0.25.0 bundle | Off (the gate's run) | **On** |
|---|---|---|
| Gate | 10 of 10; worst carriers 84·85 | **10 of 10; worst 82·80** (seed 7) |
| AI brokers liquidated, of 60 | 26.5 [24–29] | **28.1** [25–30] |
| Mean operating result a broker, four years (M) | 0.013 | **0.018** |
| Fall-off charges (M) | 18.0 | **18.4** |
| Tenders held by the cover rule · sent to the board (thousands) | (not tapped) · 329 | **203 · 331** |
| Brokered share of loads · of the cap's pay | 15.0% · 15.8% | **15.2% · 16.1%** |
| Carriers' pay per mile: brokered · direct | 3.451 · 3.543 | **3.449 · 3.541** |
| Owner-operators' · fleets' profit per truck-week | 1,735 · 1,654 | **1,726 · 1,647** |
| Cleared loads | 416,514 | **414,061** |

Every other gate line is within the spread too. The reach cap does nothing here: under windows the urgency walk never
reaches past contract × 1.15 for a brokered load (brokered pay per mile is the same to the third decimal).

**A finding the pair turns up, for the producer to place.** Under windows the AI brokers fail as often as they do
without windows:
- 26.5 of 60 are liquidated over four years, against 27.1 in 0.24.1. They fail steadily, not in one collapse:
  1.4 / 9.8 / 10.8 / 13.4 failures a year, still rising in year 4.
- Their mean operating result over four years is about zero (0.013M a broker).
- Fall-off charges take about 11% of what they bill (18M of 165M), against a 6–12% margin.
- The cover rule does fire under windows: it holds about 200,000 tenders a run. But it doesn't bring the fall-offs
  down enough.

My 11-13 brokers note said the cover rule "never fires" under windows, because the pricing keeps the brokers small.
That held for batch 7's windows; under the full bundle it is wrong. The fix this pair tests addresses the windows-off
case only. If the AI brokers should be viable under windows, that is a new question: the cover rule's sizes under
windows (`brokerMaxLostShare` 0.25, `coverMinLoads` 4), or the fall-off share under windows. It is not a gate problem.
The gate passes, and the market feels the brokers' failures only as tenders going to the board as direct freight.

## How it ran

- **The worktree:** a scratch worktree at 1919cc3 (lanes-g16), from one gated script, 06:45 to 07:36. The vitest wait
  was 26 minutes.
- **The off arm** equals 0.24.1 at 1a5a9f0 field for field on seeds 1, 5 and 10. It reruns only so the new
  year-by-year taps record it: the AI brokers' revenue and costs, the tenders, and brokered and direct pay per mile at
  each year's end. Its gate is the 0.24.1 gate.

Nothing in the shared checkout changed and nothing is staged.
