# Economy: ruleset 0.25.3, the pair (2026-11-15)

**The final check on the committed code (09:14): nothing moved out of the spread, so 0.25.3 can switch on.**

The final check ran 111ac43, which has the red team's fixes (4625eae), ruling 17, standing's polish and team trucks
(L5). It set the seven switches on: the six below, by their `.enabled` paths where they are objects, plus
`labor.coDriversCount`. It ran seeds 1–2 with twins, against this pair's on arm on the same seeds.

| Seeds 1–2 | The pair's on arm (7ba1c6d) | **Final, seven on (111ac43)** |
|---|---|---|
| Gate | 2 of 2; carriers 82·85, 93·88 | **2 of 2; 81·84, 95·92** |
| Companies bankrupt (OO · fleet · broker) | 135 (78 · 18.5 · 19.5) | **136 (76 · 20 · 18)** |
| Owner-operators' · fleets' profit per truck-week | 1,730 · 1,596 | **1,719 · 1,650** |
| Cleared loads · rate | 414,400 · 3.632 | **416,572 · 3.638** |
| Claims a run: late · no-show · cancel | 335 · 562 · 1,653 | **370 · 184 · 1,662** |
| Loan defaults · trucks seized | 189 · 130 | **201 · 148** (inside the ten-seed ranges) |

The one large move is the one ruling 17 intends: no-shows fall by two thirds. The dispatcher no longer books a load
that coming days off would turn into a no-show, and a load the truck waits for at the dock can be released before it's
ready.

The pair is on engineering's builds b625c11–7ba1c6d (engineering-bus-home-2026-11-15.md), on 0.25.2's live profile.
All six switches are on against off:
- `labor.busHome` with `labor.truckLessHomeByHub`;
- `windows.releaseCurrent`;
- `labor.dueHomePlan`;
- `assets.handOverAtTruck`;
- `standing.enabled`, with §13 and §14.

It ran ten seeds, 1,460 days, each arm with its cap-off twin.

## Verdict

**Within the spread on every line. 0.25.3 can ride as one ruleset.** No split was needed.

- **The gate passes 10 of 10.** The worst carriers read 81·80 (seed 7), against 84·83 off; the band is 0.882–0.914.
- **The bus home does its whole job:**
  - bankruptcies 138.1 against 138.7, owner-operators 76 against 75;
  - per diem 1.20M against 0.94M, the difference about the fares (0.23M);
  - truckless drivers are home within a day or two;
  - L2 stays closed.
- **The drivers are better off:**
  - 3.4% of clean drivers are tired at year 4, against 4.3%;
  - clean drivers' days away are 21.1 against 22.9.
  
  The due-home plan brings them home instead of working them through.
- **Releasing the current load shows as releases:**
  - cancel claims rise from 1,356 to 1,745 a run (FD 0.41 → 0.53M);
  - no-show claims' FD halves (0.45 → 0.21M), as a carrier now releases a load it can't make instead of failing to show;
  - claims fall overall: 1.00M against 1.14M.
- **Standing works as built:**
  - first calls offered rise to 5,264 a run (from 2,390 at d6a4afa), since a pass is now free and takers are called
    first; 5% are taken;
  - dedicated lanes offered 74;
  - tiers as before: owner-operators at 4–5, fleets at 6–8.
- **One observation for the director: §13 trims the flicker only a little.**
  - Steps down fall 5% (213,000 → 202,000 a run); steps up 226,000, and the 8-week decays 142,000, are unchanged.
  - The rest of the motion is most likely scorecards in markets a carrier visits rarely (tiers 1–4), where one load
    entering or leaving the 180-day window crosses a floor.
  - If the player's Standing page should show only the markets that matter, it could list the scorecards above tier 3,
    or the ones with a load in the last 8 weeks. That is a screen choice, not a rule, and it moves no money.

## The lines (ten-seed means; the range across seeds in brackets)

| 0.25.2's live profile | 0.25.3's six off | **0.25.3's six on** |
|---|---|---|
| **The gate** | | |
| Seeds passing · worst carriers · band | 10 of 10 · 84·83 · 0.881–0.913 | **10 of 10 · 81·80 · 0.882–0.914** |
| **Carriers** | | |
| Owner-operators' · fleets' profit per truck-week | 1,694 · 1,615 | **1,707 · 1,634** |
| Pay per truck-week | 7,131 | **7,149** |
| Cleared loads · rate | 411,366 · 3.628 | **417,032 · 3.622** |
| **Failures** | | |
| Companies bankrupt (OO · fleet · broker) | 138.7 (75.2 · 19.7 · 22.2) | **138.1 (76.1 · 20.7 · 21.4)** |
| OO liquidated: greedy · random · prudent | .217 · .205 · .138 | **.225 · .200 · .140** |
| Fleets liquidated: greedy · random · prudent | .185 · .145 · .163 | **.168 · .165 · .185** |
| Loan defaults · trucks seized | 210 · 153 | **200 · 141** |
| In debt at the end · FD owed (M) | 155 · 0.15 | **154 · 0.16** |
| **Drivers and the bus** | | |
| Per diem and fares (M) · bus trips · fares (M) | 0.94 · — · — | **1.20 · 3,235 · 0.23** |
| Clean drivers tired, years 1–4 | 1.2 / 2.0 / 2.7 / 4.3% | **0.5 / 0.9 / 2.0 / 3.4%** |
| Corner-cutters tired, years 1–4 | 49 / 55 / 45 / 45% | **45 / 54 / 44 / 43%** |
| Clean drivers' mean days away, year 4 | 22.9 | **21.1** |
| Truckless clean drivers' days away, year 4 | 0.2 | **0.4** |
| **Claims and booking** | | |
| Claims a run: late · no-show · cancel | 369 · 581 · 1,356 | **359 · 571 · 1,745** |
| Claims' FD (M): late · no-show · cancel | 0.28 · 0.45 · 0.41 | **0.27 · 0.21 · 0.53** |
| Booked ahead (share of wins) | 0.795 | **0.776** |
| **Standing** | | |
| First calls offered · taken | — | **5,264 · 264** |
| Tier steps up · down · decays | — | **226,146 · 202,076 · 142,427** |
| Dedicated lanes offered | — | **74** |
| **FD and the free path** | | |
| FD in circulation, year 4 (M) | 82.8 | **83.9** |
| Median days to a first truck | 38.5 | **38.4** |

**Where carriers stand** (ten-seed means, each company's best tier, tiers 1–10):

| Day | One-truck carriers | Fleets |
|---|---|---|
| 364 | 1 · 3 · 11 · 122 · 100 · 35 · 6 · 2 · 0 · 0 | 0 · 0 · 0 · 4 · 18 · 28 · 31 · 32 · 24 · 12 |
| 1,365 | 4 · 13 · 34 · 74 · 35 · 13 · 4 · 2 · 1 · 0 | 0 · 0 · 0 · 4 · 10 · 31 · 41 · 45 · 18 · 2 |

## How it ran

- **The worktree:** a scratch worktree at 7ba1c6d (lanes-r0253), from the gated pair script, with a 3-minute pause
  between waves for engineering's runs. It ran 06:46–07:41.
- **The arms:** on is the live profile with the six switches set (`labor.busHome.enabled`,
  `labor.truckLessHomeByHub`, `windows.releaseCurrent`, `labor.dueHomePlan.enabled`, `assets.handOverAtTruck`,
  `standing.enabled`); off is the live profile as it is.
- **New tap:** the bus fares (`sink:per_diem`, ref `bus:`).

Nothing in the shared checkout changed and nothing is staged.
