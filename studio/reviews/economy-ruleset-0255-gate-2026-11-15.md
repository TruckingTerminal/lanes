# Economy: ruleset 0.25.5, the checks and the combined gate (2026-11-15)

All three checks ran on engineering's build at 8605fe1, against today's live 0.25.4 profile (live.ts at 8605fe1:
0.25.3's seven switches, reputation in three parts, the logbook's service milestones). They ran ten seeds, 1,460 days,
each arm with its cap-off twin, plus the newcomer's month on 24 seeds.

**The 0.25.5 set:**
- `insolvency.countReserve`;
- `windows.windowScale` 0.25;
- `labor.busToTruck.enabled` (maxDays 2, poolWeeks 4).

## Verdict

**0.25.5 passes as one ruleset. All three checks are in.**

1. **`windows.windowScale` at 0.25 is the in-memory quarter exactly.** On seeds 1–2, the switch's run and the run with
   the runner's in-memory scaling are identical, report and days alike. §18's ten-seed results carry over to the
   switch as they stand.
2. **The bus to a truck is within the spread on every line,** with the bus against the same set without it:
   - **What it does:**
     - about 1,270 more bus rides a run (4,480 against 3,208, with the bus home's rides in both);
     - fares 0.30M against 0.23M;
     - per diem with fares 1.27M against 1.24M.
   - **What it leaves alone:**
     - truckless drivers at year 4 hold where they were (220 clean against 225), with their days away under half a day
       in both;
     - bankruptcies 143.5 against 144.3;
     - owner-operators' profit per truck-week 1,703 against 1,672, fleets' 1,640 against 1,618;
     - trucks seized 151 against 161, defaults 210 against 216.
   - **How it reads:** it moves drivers to empty seats cheaply and moves no money that matters. Nothing on the gate
     depends on it.
3. **The combined gate passes 10 of 10.**
   - **The gate:** the worst carriers read 83·85 (seed 1), against 83·85 (seed 1) and 84·83 (seed 7) live. The band is
     0.881–0.918, against 0.878–0.912.
   - **The carriers:**
     - owner-operators' profit per truck-week 1,703 against 1,704, fleets' 1,640 against 1,636;
     - cleared loads −0.5%, the rate +0.4%.
   - **The newcomer's month holds, and is better than live:**
     - mean 9,712 FD on 8.9 loads against 7,526 on 7.4 (paired t +1.6);
     - median 10,074 against 7,789;
     - higher on 18 of 24 seeds.

**Bankruptcies are still the nearest line, and the bus and the Reserve don't measurably pull them back.**

| Bankruptcies, ten seeds | Rise · paired t · seeds higher | Of which owner-operators |
|---|---|---|
| §18 alone, on 0.25.3 (yesterday's gate) | +8.7 (147.1 against 138.4) · 1.95 · 9 of 10 | +6.7 |
| 0.25.5 without the bus, on 0.25.4 | +6.9 (144.3 against 137.4) · 1.33 · 7 of 10 | +5.3 |
| **0.25.5, on 0.25.4** | **+6.1 (143.5 against 137.4) · 1.36 · 6 of 10** | **+6.7** |
| The bus alone (0.25.5 against no bus) | −0.8 · −0.17 · 7 of 10 | +1.4 |

- **It is inside the spread.** 143.5 sits in live's range of 119–163, and live's 137.4 sits in the set's range of 125–157.
  That is about half a standard deviation across seeds (11).
- **The total rise is smaller than §18's alone,** and less sure. The difference is about the Reserve's 2–3, as §15
  found (−3.2). It sits in fleets and brokers.
- **The owner-operators' rise is the same +6.7** with or without the Reserve and the bus.
- **The bus does nothing for bankruptcies,** as expected. Most likely the drivers it moves belong to companies with a
  truck to fill, and those aren't the ones going under.
- **The owner-operators' rise is the deadline's late claims:**
  - 3,645 a run against 358;
  - 2.64M FD against 0.27M;
  - the service-failure sink 2.87M against 0.87M.
  
  If the director ever wants that line pulled back, the late claim's size is the lever, not the bus or the Reserve. It
  is not needed: the line is inside the spread.

## The lines (ten-seed means; the range across seeds in brackets)

| 0.25.4's live profile | Live | 0.25.5 without the bus | **0.25.5** |
|---|---|---|---|
| **The gate** | | | |
| Seeds passing · worst carriers · band | 10 of 10 · 83·85 / 84·83 · 0.878–0.912 | 10 of 10 · 81·83 · 0.882–0.915 | **10 of 10 · 83·85 · 0.881–0.918** |
| **Carriers** | | | |
| Owner-operators' · fleets' profit per truck-week | 1,704 · 1,636 | 1,672 · 1,618 | **1,703 · 1,640** |
| Pay per truck-week | 7,159 | 7,116 | **7,120** |
| Posted · cleared loads · rate | 877,439 · 411,680 · 3.630 | 882,477 · 409,561 · 3.640 | **880,613 · 409,715 · 3.644** |
| **Failures** | | | |
| Companies bankrupt (OO · fleet · broker) | 137.4 (72.9 · 20.9 · 21.4) [119–163] | 144.3 (78.2 · 21.6 · 22.1) [134–161] | **143.5 (79.6 · 20.4 · 21.9) [125–157]** |
| OO liquidated: greedy · random · prudent | .201 · .199 · .139 | .217 · .219 · .150 | **.245 · .215 · .126** |
| Fleets liquidated: greedy · random · prudent | .205 · .155 · .163 | .175 · .163 · .203 | **.168 · .152 · .190** |
| Loan defaults · trucks seized | 199 · 144 | 216 · 161 | **210 · 151** |
| In debt at the end · FD owed (M) | 156 · 0.15 | 160 · 0.19 | **160 · 0.18** |
| **The deadline** | | | |
| Delivered late · within 6 h or late · within 24 h or late | 0.09% · 0.4% · 2.8% | 0.89% · 4.6% · 27.9% | **0.90% (0.83–0.95) · 4.7% · 28.1%** |
| Mean hours to spare at the receiver | 99 | 38 | **38** |
| Claims a run: late · no-show · cancel | 358 · 168 · 1,710 | 3,591 · 129 · 1,660 | **3,645 · 125 · 1,658** |
| Claims' FD (M): late · no-show · cancel | 0.27 · 0.13 · 0.52 | 2.61 · 0.10 · 0.49 | **2.64 · 0.09 · 0.50** |
| Spoiled loads a run | 1.5 | 10.6 | **13.4** |
| **Drivers and the bus** | | | |
| Bus rides a run (home and to a truck) · fares (M) | 3,113 · 0.22 | 3,208 · 0.23 | **4,480 · 0.30** |
| Per diem with fares (M) | 1.20 | 1.24 | **1.27** |
| Truckless drivers at year 4: clean · corner-cutter · outlaw | 223 · 63 · 68 | 225 · 63 · 61 | **220 · 62 · 59** |
| Clean drivers tired at year 4 · days away | 0.3% · 9.6 | 0.3% · 9.6 | **0.3% · 9.7** |
| **Standing** | | | |
| First calls offered · taken · dedicated lanes | 5,538 · 291 · 81 | 5,559 · 317 · 74 | **5,304 · 295 · 83** |
| **FD and the free path** | | | |
| FD in circulation, year 4 (M) · cap released (M) | 84.4 · 165.1 | 81.8 · 157.9 | **81.3 · 158.9** |
| Median days to a first truck · first truck within a year | 36.4 · 357 | 37.9 · 350 | **37.6 · 354** |

**The newcomer's month** (the test page's world at Dallas, 24 seeds; the live 0.25.4 profile in both arms, and the
0.25.5 set on one):

| 24 seeds | Live | **0.25.5** |
|---|---|---|
| Mean FD · loads | 7,526 · 7.4 | **9,712 · 8.9** |
| Median FD | 7,789 | **10,074** |
| Higher on | | **18 of 24 (paired t +1.6)** |
| Newcomer's reputation · the pack's, at the month's end | 0.955 · 0.991 | **0.952 · 0.989** |

## How it ran

- **The worktrees:** scratch worktrees at 8605fe1, from the gated pair script with pauses between waves, 14:38–17:59.
  They ran behind the wind-up pair.
  - **Check 1:** lanes-ws1 (`--set windows.windowScale=0.25`) against lanes-ws2 (`WINDOW_SCALE=0.25` in the runner's
    memory), seeds 1–2, no twins. It was compared field by field.
  - **The gate:** lanes-g255, 0.25.5 against live, with twins.
  - **The bus check:** lanes-g255nb, the set without `labor.busToTruck.enabled`, with its twin.
  - **The newcomer's month:** in lanes-g255.
- **The bus rides:** read from the `bus:` fare posts (`sink:per_diem`). The bus home and the bus to a truck share that
  ref, so the bus to a truck's count is the difference between the arms. There is no separate tap for hires the ride
  replaced.
- **The live arm matches the reputation pair's on arm** (economy-reputation-pair-2026-11-15.md) to the digit on the
  gate lines' means: bankruptcies, profit, cleared loads, defaults and liquidations. The runs aren't field for field
  identical, because the logbook's service milestones are on here and change some airdrop fields, and seed 7's carriers
  read 84·83 against 83·83. The code since 111ac43 moves nothing that matters at its defaults.

Nothing in the shared checkout changed and nothing is staged.
