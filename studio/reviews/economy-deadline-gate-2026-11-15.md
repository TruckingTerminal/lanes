# Economy: the director's §18 gate, "Deliver by" at a quarter of today's windowHours (2026-11-15)

**The gate:**
- 0.25.3's live profile at e93449c, with every commodity's `windowHours` at a quarter of today's, every commodity
  alike (in memory, `WINDOW_SCALE=0.25`), against the live profile as it is;
- ten seeds, 1,460 days, each arm with its cap-off twin;
- the newcomer's month on the 24 seeds.

This follows the study (economy-deadline-study-2026-11-15.md).

## Verdict

**It passes. A quarter of today's `windowHours` can become a ruleset change.** The half fallback isn't needed.

- **The carriers' floor holds.** The gate passes 10 of 10. The worst carriers read 80·83 (seed 7), against 83·86 off;
  the band is 0.887–0.915.
- **Bankruptcies stay inside the spread:** 147.1 against 138.4, every seed's range overlapping (137–170 against
  127–159). It is the one line near the spread's edge, about one standard deviation up, mostly owner-operators (84
  against 77).
- **Cleared loads stay inside the spread:** 410,421 against 415,946 (−1.3%), ranges overlapping. The rate is 3.643
  against 3.632.
- **The newcomer's month holds,** on 24 seeds: mean 8,597 FD on 9.2 loads against 7,999 on 7.7 (t +0.44), median
  6,944 against 7,320, higher on 14 of 24.
- **The deadline binds as the study said:**

| Ten seeds | Today | **A quarter** | The study's figure |
|---|---|---|---|
| Delivered late (past "Deliver by") | 0.09% | **0.90%** (0.83–0.94) | about 1 in 100 |
| … within 6 h of it, or late | 0.42% | **4.6%** | about 5 in 100 |
| … within 24 h, or late | 2.8% | 28% | |
| Mean hours to spare at the receiver | 99 | 38 | |
| Late claims a run | 370 | **3,631** | |
| Spoiled loads a run | 1.2 | 11 | |
| On-time share · reputation p10 / p50 (today's formula) | 0.999 · 0.955 / 0.980 | **0.991 · 0.939 / 0.971** | |

- **The teeth come back where the director wanted them:**
  - a careful carrier is late on about 1 load in 100, and nearly 1 in 20 arrives inside six hours of the deadline;
  - the late claim is a real fine again;
  - reputation's service part (once three parts is on) and the logbook milestone read real lateness.
- **What it costs carriers:** owner-operators' profit per truck-week 1,671 against 1,691 (−1.2%), fleets' 1,645
  against 1,650. That is milder than the two-seed study's 2–3%.

## The lines (ten-seed means; the range across seeds in brackets)

| 0.25.3's live profile | windowHours as today | **A quarter** |
|---|---|---|
| **The gate** | | |
| Seeds passing · worst carriers · band | 10 of 10 · 81·84 · 0.881–0.922 | **10 of 10 · 80·83 · 0.887–0.915** |
| **Carriers** | | |
| Owner-operators' · fleets' profit per truck-week | 1,691 · 1,650 | **1,671 · 1,645** |
| Pay per truck-week | 7,163 | **7,128** |
| Posted · cleared loads · rate | 876,818 · 415,946 · 3.632 | **882,410 · 410,421 · 3.643** |
| **Failures** | | |
| Companies bankrupt (OO · fleet · broker) | 138.4 (77.4 · 19.8 · 21.4) | **147.1 (84.1 · 18.7 · 22.1)** |
| OO liquidated: greedy · random · prudent | .213 · .227 · .139 | **.227 · .245 · .147** |
| Fleets liquidated: greedy · random · prudent | .170 · .147 · .177 | **.168 · .133 · .168** |
| Loan defaults · trucks seized | 204 · 154 | **207 · 153** |
| Claims a run: late · no-show · cancel | 370 · 173 · 1,735 | **3,631 · 128 · 1,678** |
| **FD and the free path** | | |
| FD in circulation, year 4 (M) · cap released (M) | 83.2 · 162.9 | **81.9 · 158.7** |
| Median days to a first truck | 38.0 | **38.2** |

## For the ruleset

- **The change:** every commodity's `windowHours` at a quarter of today's, rounded to the hour.
  - produce 9, frozen 18, dairy 12, meat 12;
  - beverages 24, grocery 24, retail 30, parcels 6, paper 30, auto parts 9, electronics 18;
  - and the rest likewise.
  
  It is data (packages/data commodities.ts), so it needs a switch or a ruleset version for the restart. Engineering's
  choice: a `windows.windowScale` multiplier (1 off, 0.25 on) keeps the table as it is.
- **The words:** the cards' "Deliver by" times move earlier. The writer's guide lines on the delivery window read the
  table.
- **If the director wants it confirmed after the build,** a two-seed check on the switch matches this in-memory scaling.

## How it ran

- **The worktree:** a scratch worktree at e93449c (lanes-d18), from the gated pair script with pauses between waves,
  10:27–11:41.
- **The arms:** `WINDOW_SCALE=0.25` set in the runner's memory for the on arms (every commodity's `windowHours` ×
  0.25, rounded).
- **The newcomer's month:** the same scaling for its on arm, 11:41–11:47.

Nothing in the shared checkout changed and nothing is staged.
