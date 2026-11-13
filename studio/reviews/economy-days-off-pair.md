# Economy: the days-off fix, the pair (2026-11-13)

On engineering's build at a38aaa4 (engineering-days-off-2026-11-13.md), behind `labor.daysOffFull`, with both lines.
The 0.25.0 bundle with the switch on against off: ten seeds, 1,460 days, each with its cap-off twin.

## Verdict

**Every line is within the seeds' spread. It can ride the next ruleset.**

- **The gate passes 10 of 10.**
  - The worst carriers' reading is 84·84 (seed 7), against 84·85 off.
  - The band reads 0.888–0.920.
- **The owner-operators' liquidations the one-line patch pushed up do not move with the full fix.**
  - The greedy owner-operator is liquidated at .221 against .232. The prudent one at .131 against .135.
  - The random one is at .235 against .211, inside its range off (.165–.271).
  - Owner-operator bankruptcies are 78.4 against 78.0.
  - The patch's rise was the incomplete rule: drivers taking a fifth day home without the fatigue reset it should buy.
- **Fatigue now resets, and the truck crashes fall with it.**
  - Crashes fall from 182 to 171 a run, and at-fault crashes from 99 to 92.
  - Fatal crashes fall from 7.4 to 5.4.
  - Late claims fall from 327 to 315.
- **The cost is small.**
  - Cleared loads fall 0.5%, and pay per truck-week 1.4%.
  - Owner-operators' profit per truck-week is 1,702 against 1,735 (−1.9%), and fleets' 1,643 against 1,654
    (−0.7%). Both are inside the seeds' spread.

## The lines (ten-seed means; the range across seeds in brackets)

| The 0.25.0 bundle | `labor.daysOffFull` off (the gate's run) | **On** |
|---|---|---|
| **The gate** | | |
| Seeds passing | 10 of 10 | **10 of 10** |
| Worst carriers, % of twin (Y3 · Y4) | 84 · 85 (seed 7) | **84 · 84** (seed 7) |
| Band, year 4 | 0.888–0.917 | **0.888–0.920** |
| **Carriers** | | |
| Pay per truck-week | 7,256 [7,158–7,397] | **7,157** [7,120–7,236] |
| Owner-operators' profit per truck-week | 1,735 [1,651–1,872] | **1,702** [1,649–1,789] |
| Fleets' profit per truck-week | 1,654 [1,572–1,796] | **1,643** [1,511–1,758] |
| **Freight** | | |
| Cleared loads · rate | 416,514 · 3.636 | **414,462 · 3.628** |
| **Failures** | | |
| Companies bankrupt (OO · fleet · broker) | 151 (78.0 · 21.9 · 26.5) | **150** (78.4 · 20.3 · 28.7) |
| OO liquidated: greedy · random · prudent | .232 · .211 · .135 | **.221 · .235 · .131** |
| Fleets liquidated: greedy · random · prudent | .190 · .163 · .195 | **.188 · .135 · .185** |
| Loan defaults · trucks seized | 215 · 159 | **216 · 156** |
| **Safety** | | |
| Crashes · at fault · fatal, a run | 182 · 99 · 7.4 | **171 · 92 · 5.4** |
| Claims: late · no-show · cancel | 327 · 567 · 1,311 | **315 · 573 · 1,339** |
| **FD and the fee** | | |
| FD in circulation, year 4 (M) | 79.5 | **78.6** |
| Cap released (M, of 276) | 157.7 | **157.1** |
| Settlement fee burned (M) | 11.9 | **11.8** |
| **The free path** | | |
| Median days to a first truck | 38.0 | **38.8** |

## The gate, per seed (on)

| Seed | Band, year 4's four readings | Carriers, % of twin (Y3 · Y4) | Off | Cleared (Y3 · Y4) |
|---|---|---|---|---|
| 1 | 0.896 0.891 0.908 0.912 | 87 · 87 | 91 · 90 | 109 · 109 |
| 2 | 0.900 0.907 0.900 0.894 | 93 · 87 | 89 · 83 | 119 · 101 |
| 3 | 0.904 0.905 0.911 0.920 | 89 · 86 | 88 · 87 | 118 · 105 |
| 4 | 0.893 0.888 0.900 0.905 | 86 · 88 | 95 · 96 | 113 · 104 |
| 5 | 0.891 0.897 0.910 0.912 | 92 · 92 | 88 · 90 | 124 · 105 |
| 6 | 0.906 0.911 0.900 0.906 | 97 · 94 | 93 · 90 | 118 · 108 |
| 7 | 0.890 0.889 0.897 0.907 | **84 · 84** | 84 · 85 | 112 · 110 |
| 8 | 0.902 0.907 0.905 0.912 | 95 · 92 | 102 · 93 | 114 · 103 |
| 9 | 0.903 0.908 0.915 0.913 | 91 · 89 | 97 · 93 | 113 · 111 |
| 10 | 0.913 0.909 0.903 0.916 | 90 · 91 | 88 · 91 | 117 · 112 |

Debt reads 0.1–0.3% on every seed. Every seed passes the cold start, supply, spread and free-path checks.

## How it ran

- **The worktree:** a scratch worktree at a38aaa4 (lanes-g18), from one gated script queued behind the brokers' pair:
  07:37 to 07:55.
- **The arms:**
  - On: the bundle's keys plus `labor.daysOffFull=true`, with its twin (`token.emission.enabled=false`).
  - Off: the gate's bundle run at 1919cc3 (lanes-g16). Seed 1 of the bundle at a38aaa4, switch off, equals it field
    for field, so the clears-near commits between move nothing.
- **The one-line patch's two-seed reading** (in economy-bundle-0250-gate-2026-11-13.md) is superseded by this.

Nothing in the shared checkout changed and nothing is staged.
