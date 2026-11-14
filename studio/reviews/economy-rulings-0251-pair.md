# Economy: the director's three 0.25.1 rulings, the pair (2026-11-14)

On engineering's build at 8209f88 (engineering-rulings-0251-2026-11-13.md):
- `windows.oneDeadline`
- `labor.homeAtOnce`
- `labor.homeNeedsDispatcher`

The pair is the live 0.25.0 profile with all three on, against it with all three off. It ran ten seeds, 1,460 days,
each arm with its cap-off twin. The live profile at 8209f88 already carries the whole bundle, days off kept whole and
the brokers' 10% fall-off share, so both arms are fresh runs; the gate's earlier bundle runs don't match it.

## Verdict

**Every gate line is within the spread. The three ride 0.25.1.** One watched line moves by design, and the director
should see it.

- **The gate passes 10 of 10 both ways.**
  - With the rulings on, the worst carriers' reading is 85·84; off, 79·78.
  - The band reads 0.886–0.912 on, against 0.886–0.917 off.
- **Carriers.** Owner-operators' profit per truck-week is 1,707 against 1,683. Fleets' is 1,598 against 1,600.
- **Freight.** Cleared loads are 412,210 against 413,988 (−0.4%), at the same rate.
- **Failures.** Bankruptcies are 138 against 139, and liquidations by persona are inside their ranges.
- **Who wins loads doesn't move.** The four-year shares of delivered loads by segment and conduct match to the third
  decimal. Clean owner-operators take 0.454 against 0.456, and corner-cutting owner-operators 0.122 against 0.118.
- **Miles rise 4.9%:** 308M against 294M over four years. The loads that turn from late to on time (0.5 → 1.0) earn
  more than the dropped early tier (1.2 → 1.0) takes away.
- **Rule 2 gives clean drivers their rest without costing loads.**
  - Clean drivers spend 0.109–0.117 of their crewed days on days off, against 0.104–0.110. That is 3–7% more rest.
  - Corner-cutters go from 0.046 to 0.049.
  - The loaded share of days is unchanged (0.482 against 0.486 for clean owner-operators).
- **Rule 3 moves no bot,** as engineering said.
- **The newcomer's month doesn't move.** Over 24 seeds it is 8,538 FD on, against 8,629 off, higher on 13 of 24.

**The line that moves: reputation stops separating carriers.**
- Under one deadline, 99.9% of loads are on time, against 74–80% before.
- Reputation's 10th, 50th and 90th percentiles go from 0.69 / 0.76 / 0.83 to 0.96 / 0.98 / 0.996.
- Reputation enters the bid score raw, at a quarter weight. Its spread across carriers was worth about 6% of a load's
  price ceiling in a bid; now it is worth under 2%.
- The edge clean carriers held over corner-cutters (median 0.77 against 0.73) is gone (0.99 against 0.98).
- **What still moves reputation:** a no-show or release (`failed`, counted as late) and a delivery past "Deliver by".
- **Whether reputation should keep a spread is the director's call.** For example, it could be read against the share
  of the deadline's slack used, or rescaled to the field. It isn't an economy failure: the gate's lines and the market
  shares don't move.

## The lines (ten-seed means; the range across seeds in brackets)

| The live 0.25.0 profile | Rulings off | **Rulings on** |
|---|---|---|
| **The gate** | | |
| Seeds passing | 10 of 10 | **10 of 10** |
| Worst carriers, % of twin (Y3 · Y4) | 79 · 78 (seed 7) | **85 · 87** (seed 7); 88 · 84 (seed 3) |
| Band, year 4 | 0.886–0.917 | **0.886–0.912** |
| **Carriers** | | |
| Pay per truck-week | 7,149 [7,069–7,235] | **7,125** [7,032–7,225] |
| Owner-operators' profit per truck-week | 1,683 [1,627–1,718] | **1,707** [1,635–1,783] |
| Fleets' profit per truck-week | 1,600 [1,451–1,763] | **1,598** [1,483–1,670] |
| **Freight** | | |
| Cleared loads · rate | 413,988 · 3.631 | **412,210 · 3.631** |
| **Failures** | | |
| Companies bankrupt (OO · fleet · broker) | 139 (75.7 · 19.5 · 21.3) | **138** (73.6 · 20.6 · 21.6) |
| OO liquidated: greedy · random · prudent | .221 · .207 · .136 | **.205 · .208 · .136** |
| Fleets liquidated: greedy · random · prudent | .177 · .140 · .170 | **.198 · .175 · .143** |
| Loan defaults · trucks seized | 212 · 156 | **211 · 155** |
| Claims: late · no-show · cancel | 310 · 596 · 1,303 | **312 · 568 · 1,299** |
| **Reputation and Miles** | | |
| On-time share, years 1–3 | 0.779 / 0.743 / 0.801 | **0.999 / 0.999 / 0.999** |
| Reputation p10 / p50 / p90, end of year 4 | 0.686 / 0.764 / 0.830 | **0.955 / 0.980 / 0.996** |
| Miles, years 1–4 (M) | 84.9 / 74.9 / 74.8 / 59.0 (293.6) | **88.0 / 80.6 / 78.3 / 61.0 (308.0)** |
| **FD and the fee** | | |
| FD in circulation, year 4 (M) · cap released (M) | 82.9 · 161.5 | **84.2 · 163.1** |
| Settlement fee burned (M) · expedites | 11.8 · 78 | **11.8 · 81** |
| **The free path** | | |
| Median days to a first truck | 37.7 | **38.0** |

Year 4's on-time share is left out: the season close scales each company's record (season.ts `keepRecord`), which
breaks a year's difference. The four-year shares by group below are read at the end.

## Who wins loads, and reputation, by segment and conduct (four years)

| Segment · conduct | Share of loads delivered (off → on) | On-time (off → on) | Median reputation (off → on) |
|---|---|---|---|
| Owner-operator · clean | 0.456 → 0.454 | 0.778 → 0.999 | 0.771 → 0.986 |
| Owner-operator · corner-cutter | 0.118 → 0.122 | 0.739 → 0.999 | 0.731 → 0.984 |
| Owner-operator · outlaw | 0.012 → 0.011 | 0.739 → 0.998 | 0.742 → 0.963 |
| Fleet · clean | 0.280 → 0.276 | 0.770 → 0.999 | 0.771 → 0.995 |
| Fleet · corner-cutter | 0.079 → 0.079 | 0.726 → 0.999 | 0.730 → 0.994 |
| Fleet · outlaw | 0.011 → 0.012 | 0.775 → 0.999 | 0.802 → 0.975 |
| New companies (all conduct) | 0.044 → 0.045 | 0.70–0.75 → 0.997–0.999 | 0.73–0.77 → 0.96–0.97 |

Conduct is read from each bot's home order: clean 28/5, corner-cutter 42/3, outlaw none.

## Rule 2: the bots' days off

The share of crewed truck-days with the driver on days off, years 1–4:

| | Off | **On** |
|---|---|---|
| Owner-operator · clean | 0.108 / 0.108 / 0.108 / 0.110 | **0.112 / 0.114 / 0.114 / 0.117** |
| Fleet · clean | 0.106 / 0.109 / 0.104 / 0.108 | **0.109 / 0.116 / 0.110 / 0.115** |
| Owner-operator · corner-cutter | 0.046 / 0.046 / 0.046 / 0.047 | **0.048 / 0.049 / 0.049 / 0.050** |
| Fleet · corner-cutter | 0.044 / 0.047 / 0.043 / 0.046 | **0.046 / 0.050 / 0.046 / 0.049** |

The loaded share is unchanged within a point. A due truck that goes idle near home now rests instead of being booked
out again first, and the loads it would have taken go to others.

## The newcomer's month (the test page's world at Dallas)

**Six seeds first:**
- Off, 10,298 FD on 8.3 loads; on, 7,379 on 8.5.
- One seed fell from 27,637 to 8,786 and another rose from 4,887 to 10,128.
- Raising `reputation.start` to 0.96 didn't help (6,962). The start also seeds every bot company's record, so the pack
  rose with it, to 0.992.

**So it was read again on 24 seeds:**

| 24 seeds, one month | Net FD, mean (median) | Loads | Net a load | Rulings on above off |
|---|---|---|---|---|
| Off | 8,629 (8,241) | 8.5 | 1,015 | — |
| **All three on** | **8,538** (7,027) | **9.4** | 907 | 13 of 24 (t −0.06) |
| Rule 1 alone | 8,896 (8,489) | 9.5 | 932 | 13 of 24 (t +0.17) |
| Rule 2 alone | 8,401 (8,130) | 8.6 | 979 | 9 of 24 (t −1.3) |

**What the 24 seeds show:**
- The six-seed drop was noise.
- **Under rule 1** the newcomer ends its month at 0.919 against a pack at 0.973. Off, it ends at 0.870 against 0.813,
  above the pack. Its lower reputation shows in price, not in the month: it wins more loads (9.4 against 8.5) at less
  a load (907 against 1,015).
- **Rule 2 costs the newcomer about 2.6%,** a day of rest near home, inside its noise.
- **No change to `reputation.start` is needed.**

## How it ran

- **The worktree:** a scratch worktree at 8209f88 (lanes-g20), from one gated script, 02:19 to 03:19. Four waves:
  on, off and the two twins.
- **The arms:** on is the live profile with `--set windows.oneDeadline=true --set labor.homeAtOnce=true --set
  labor.homeNeedsDispatcher=true`; off is the live profile as it is.
- **New taps:**
  - carriers by segment and by conduct (from the home order);
  - reputation's percentiles at each year's end;
  - on-time, deliveries and Miles at each year's end;
  - each day, the share of crewed trucks whose driver is on days off, loaded or idle.
- **The newcomer's month:** the test page's world (`GAME_CONFIG` at 8209f88) with the three keys set on or off in
  memory, all three together and then one at a time.

Nothing in the shared checkout changed and nothing is staged.
