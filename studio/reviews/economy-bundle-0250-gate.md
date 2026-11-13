# Economy: the combined gate for ruleset 0.25.0, the decisive run (2026-11-13)

On engineering's fix commit 1919cc3 (engineering-bundle-fixes-2026-11-13.md). Every bundle key on together, against
0.24.1 as live today: ten seeds, 1,460 days, each arm with its cap-off twin.

## Verdict

**Ready as sized. Nothing to resize.**

- **The gate passes 10 of 10.** The carriers' floor holds widely. The worst seed reads 84% of its twin at year 3 and
  83% at year 4, against the 72% and 75% lines. The baseline run at 8d5bf77 read 80 and 79, and the fee alone 74 and 77.
- **The band reads 0.888 to 0.917.** It sits inside [0.84, 1.00] on every seed, with nothing near the bottom.
  0.24.1 itself fails one seed (seed 7, 0.838).
- **Engineering's fixes move nothing the gate measures.** Every line is within the seeds' spread of the baseline run.
  The cancel claims moved to the sink, the no-shows fell 600 → 567, and the cancels 1,355 → 1,311.
- **The two sizes engineering left:**
  - `businesses.parking.stopInTownMaxMi`: keep **30**.
  - The days-off off-by-one is **a bug: fix it**, behind a switch, with a two-seed pair because it moves the bots.
    Both are argued below.
- **What Jeff is weighing is not a gate line.** Carriers' profit per truck-week with the bundle is about **19% under
  today's**. Owner-operators earn 1,735 against 2,134 and fleets 1,654 against 2,032. Below, that 19% is split between
  the fee (about 4%) and windows (about 15%, nearly all of it batch 9's end of the facility hauls). Today's figure
  itself leans a little on those hauls (at most 79 FD a truck-week), so like for like the cut is 16 to 19%.
- **If Jeff wants a smaller cut without dropping windows, the fee is the cheap lever.** The bundle without the fee
  reads owner-operators 1,805 and fleets 1,729, so each half-point of the fee's share costs carriers about 2%. The pair
  for a 0.5% fee would be this run's arms with `token.settlementFee.share=0.005` against 0.01. I don't recommend it: at
  1% the floor already holds with room, and the fee is the bundle's only new sink that scales with the economy.

## The gate, per seed (the bundle at 1919cc3)

| Seed | Band, year 4's four readings | Carriers, % of twin (Y3 · Y4) | Cleared (Y3 · Y4) | Debt (% of FD held) | Cold start |
|---|---|---|---|---|---|
| 1 | 0.895 0.888 0.902 0.908 | 91 · 90 | 110 · 111 | 0.1 · 0.2 | 106 |
| 2 | 0.899 0.903 0.897 0.894 | 89 · 83 | 126 · 104 | 0.2 · 0.2 | 79 |
| 3 | 0.900 0.895 0.893 0.909 | 88 · 87 | 114 · 103 | 0.1 · 0.2 | 76 |
| 4 | 0.892 0.896 0.912 0.911 | 95 · 96 | 115 · 114 | 0.2 · 0.4 | 100 |
| 5 | 0.908 0.903 0.906 0.909 | 88 · 90 | 113 · 105 | 0.2 · 0.2 | 107 |
| 6 | 0.899 0.900 0.893 0.903 | 93 · 90 | 110 · 103 | 0.1 · 0.3 | 67 |
| 7 | 0.904 0.901 0.898 0.910 | **84 · 85** | 103 · 105 | 0.2 · 0.2 | 90 |
| 8 | 0.904 0.910 0.909 0.902 | 102 · 93 | 119 · 112 | 0.2 · 0.1 | 78 |
| 9 | 0.901 0.906 0.912 0.909 | 97 · 93 | 120 · 102 | 0.1 · 0.3 | 79 |
| 10 | 0.915 0.909 0.906 0.917 | 88 · 91 | 111 · 112 | 0.1 · 0.3 | 68 |

Lines: band [0.84, 1.00] from year 4; carriers 72% at year 3 and 75% at year 4; cleared 75%; debt at most 7.5%. Every
seed passes the cold start, supply, spread and free-path checks. The market's share of pay is 0.06–0.23%.

For comparison:
- **0.24.1:** 9 of 10. Seed 7's band is 0.838; the worst carriers read 80 · 82.
- **The fee alone:** 10 of 10, worst carriers 74 · 77.
- **The bundle without the fee:** 10 of 10, worst 83 · 83.
- **The baseline bundle at 8d5bf77:** 10 of 10, worst 80 · 79.

**The fee does not tighten the floor under windows, unlike its effect alone.** Windows shrink the twin's carriers too,
and the cap releases less, so the fee's knock-on through the refill has less to bite on.

## The lines (ten-seed means; the range across seeds in brackets)

| | 0.24.1 (live today) | Bundle without the fee, 8d5bf77 | Baseline bundle, 8d5bf77 | **Bundle, 1919cc3** |
|---|---|---|---|---|
| **Carriers** | | | | |
| Pay per truck-week (FD) | 8,017 | 7,287 | 7,262 | **7,256** [7,158–7,397] |
| Carriers' share of what is paid | 0.929 | 0.946 | 0.947 | **0.947** |
| Owner-operators' profit per truck-week | 2,134 | 1,805 | 1,736 | **1,735** [1,651–1,872] |
| Fleets' profit per truck-week | 2,032 | 1,729 | 1,632 | **1,654** [1,572–1,796] |
| **FD supply** | | | | |
| FD in circulation, years 1–4 (M) | 31.1 / 66.9 / 85.8 / 117.7 | 31.2 / 60.3 / 67.2 / 82.8 | 30.6 / 58.5 / 65.1 / 79.1 | **30.3 / 58.1 / 64.8 / 79.5** |
| Cap released, of the 276M schedule (M) | 227.6 | 157.2 | 157.8 | **157.7** [150.2–162.7] |
| Reserve drawdown (M) | 188.9 | 129.5 | 132.9 | **133.2** |
| **Freight** | | | | |
| Cleared loads | 448,291 | 417,992 | 415,524 | **416,514** |
| Rate (FD/mi) | 3.755 | 3.632 | 3.636 | **3.636** |
| Days on the volume floor · rate floor | 223 · 133 | 105 · 29 | 110 · 30 | **105 · 30** |
| **Failures** | | | | |
| Companies bankrupt (OO · fleet · broker) | 179 (77 · 43 · 27) | 145 (74 · 21 · 28) | 147 (76 · 21 · 29) | **151** (78 · 22 · 27) |
| OO liquidated: greedy · random · prudent | .197 · .198 · .175 | .205 · .206 · .142 | .213 · .220 · .133 | **.232 · .211 · .135** |
| Fleets liquidated: greedy · random · prudent | .535 · .325 · .223 | .198 · .158 · .180 | .202 · .168 · .163 | **.190 · .163 · .195** |
| Loan defaults · trucks seized | 200.5 · 111 | 196 · 141 | 206 · 150 | **215** [208–230] · **159** |
| **The fee and the expedites** | | | | |
| Settlement fee burned (M; loads + sales) | — | — | 11.9 | **11.9** (11.3 + 0.57) |
| … by year (M) | — | — | 3.58 / 3.01 / 2.87 / 2.45 | **3.57 / 3.00 / 2.85 / 2.47** |
| Expedites a run · FD burned (M) | — | 86 · 0.74 | 83 · 0.74 | **85 · 0.76** [49–107] |
| **Windows** | | | | |
| Claims a run: late · no-show · cancel | — | 329 · 604 · 1,329 | 327 · 600 · 1,355 | **327 · 567 · 1,311** |
| Booked ahead (share of clears) | — | 0.800 | 0.794 | **0.795** |
| Free path: median days to a first truck | 45.9 | 37.8 | 38.6 | **38.0** |
| Trucks in service · owned at the end | 812 · 584 | 709 · 616 | 688 · 616 | **693 · 601** |

Reading it:
- **The fix commit reads as the baseline bundle on every line.** No claim now takes a carrier below zero, and the
  cancel claims burn instead of paying another company. Together they move loan defaults up 9 and seizures up 10 (both
  inside the spread), and the greedy owner-operator's liquidations from .213 to .232. Nothing else moves.
- **The economy is smaller, as windows always made it.** Cleared loads are 7% lower, and the rate is 3.64 against 3.76.
  FD in circulation is 80M at year 4 against 118M. The cap released 158M of the 276M schedule (57%), against 228M (82%)
  today. That is the cap paying for less freight: 1,205M of NPC pay against 1,395M, from fewer clears at a lower
  rate. The reserve keeps the rest. Debt stays at 0.1–0.4% of FD held.
- **Failures are fewer.**
  - Bankruptcies are 151 against 179, and fleets' fall by half.
  - The prudent owner-operator is liquidated less (.135 against .175). The greedy one is liquidated a little more
    (.232 against .197): booking ahead and the claims punish over-reach, as the director wanted.
  - The free path is faster: 38 days to a first truck against 46.
- **The fee burns 11.9M over four years**, about 3M a year, falling as the economy settles. The expedites are a
  rounding error: 85 a run and 0.76M burned.

## The 19%, attributed

**The split:**

| Owner-operators' / fleets' profit per truck-week | Owner-operators | Fleets | Against today |
|---|---|---|---|
| 0.24.1 | 2,134 | 2,032 | — |
| The fee alone | 2,004 | 1,933 | −6% / −5% |
| Windows, batch 8 (51d0a1d; no batch 9) | 2,067 | 2,042 | −3% / 0% |
| Windows only, at 8d5bf77 (seeds 1–2) | 1,828 | 1,715 | about −15% |
| The bundle without the fee | 1,805 | 1,729 | −15% / −15% |
| **The bundle at 1919cc3** | **1,735** | **1,654** | **−19% / −19%** |

**What the steps show:**
- **The expedite and the rules are not the cause.** Windows alone at 8d5bf77, without the expedite, the rules or the
  fee, reads 1,764 and 1,892 for owner-operators on seeds 1 and 2, against 1,813 and 1,826 for the bundle without the
  fee. That run reproduces batch 9's two-seed check exactly: cleared 421,775 and 421,195. Rules C, H, I and the mid-leg
  night are proven not to move a bot (economy-rules-chi-2026-11-13.md).
- **Most of windows' cut is batch 9's facility pricing.**
  - Batch 8's windows read 2,067 because 4.5% of loads were facility hauls, paid to carriers at the lifted rate out of
    the fleets' capital. Batch 9 ended the churn (0.16% of loads now), and fleet bankruptcies fell from 51 to 22.
  - The cap pays carriers the same either way (1,148M against 1,147M). The profit that left was money moving from
    failing fleets to the carriers who hauled for them.
- **Today's 0.24.1 leans on the same thing, but less.**
  - Facility hauls are 1.3% of loads and pay 12.8M a run, 79 FD a truck-week against the bundle's 11.
  - Even if all of it were margin, today's like-for-like figure would be about 2,066, and the bundle's cut about 16%.
- **The fee's part under windows is about 4%** (1,805 → 1,735; 1,729 → 1,654).

## The newcomer's month

The trucker's month at Dallas (the test page's world, seeds 11, 23, 37, 41, 59, 73), every bundle key and the ratio
rule on, at 1919cc3:

| Six seeds, one month | Net FD (mean) | Loads | Settlement fee paid |
|---|---|---|---|
| 0.24.1 as live today | 7,685 | 9.7 | — |
| The bundle at 8d5bf77, ratio off | 7,603 | 7.5 | 174 |
| The bundle at 8d5bf77, ratio on | 7,814 | 8.8 | 182 |
| **The bundle at 1919cc3, ratio on** | **9,603** | **10.3** | **220** |

**The reading is "no worse".** The newcomer's month is no worse than today, and the anchor still pays. The seeds swing
far more than the arms differ: seed 23 reads 10,636, 2,735 and −4 across the three bundle runs, so the rise at
1919cc3 is not a finding. The 0.24.1 column is identical at both commits, so the probe's base is unchanged.

## Size 1: `businesses.parking.stopInTownMaxMi` = 30 (keep the placeholder)

**What the probe measured.** It ran the live profile, seeds 1–2, 120 days, at 1919cc3. On every shoulder night a
truck took mid-leg (6,431 nights, 4,883 of them loaded), it asked `nightInTown` with no cap how far the town would be.

| One way, road miles | Median | p25 | p75 | p90 | Max |
|---|---|---|---|---|---|
| To the town | 15 | 8 | 23 | 35 | 231 |

**How many nights each cap reaches:**

| Within | 15 mi | 20 | 25 | **30** | 40 | 50 | 60 | 80 | 100 |
|---|---|---|---|---|---|---|---|---|---|
| Share of nights | 52% | 69% | 80% | **87%** | 92% | 95% | 97% | 98% | 99% |

**What the town saves, and what the detour costs.**
- **The saving: about 92 FD on a loaded night, 82.5 empty.**
  - The shoulder's expected ticket is 82.5 FD (250 at a third).
  - Theft adds about 9 FD on a loaded night: 0.001 × (3 − 1) exposure × about 4,400 FD lost (the 2,500 deductible
    plus the unpaid load).
- **The cost: 2 × the one-way miles, at the running cost.**
  - A hired driver costs about 1.55 FD a mile: wage 0.75, fuel 0.62 and wear 0.18.
  - So the town pays for itself up to about **30 miles** one way (27 empty).
  - For an owner-operator, whose own driving is not paid by the mile, it pays up to about 58.
- **Time is the other cost.** Thirty miles there and back is about 1.2 hours off the next day, which under windows is
  lateness risk.

**30 is the cap where the town never costs a company more than the shoulder it avoids.** It still reaches 87% of
mid-leg nights. Raising it to 60 would give an owner-operator some rare nights worth taking (10% of nights), but would
send a hired crew 120 miles round trip to dodge an 82-FD expected ticket. No bot chooses the town, so the size moves no
gate line.

## Size 2: the days off end a day early — a bug; fix it

**The code:**
- `startHomeTime` (labor.ts:423) sets `homeUntilDay` to the first workday. The days off start tomorrow if the driver
  drove today.
- `resting()` (standingOrders.ts:26), the hold's release (trips.ts:255) and labor.ts:512 all read the days off as
  `homeUntilDay > today`.
- `dailyDrivers` (labor.ts:465) runs at the start of each new day and clears the mark when
  `today + 1 >= homeUntilDay`.

**What that does.** The mark clears at the start of the last day off. A driver sent home for 5 days is free on the
5th, so the truck sits 4. Their `restDays` reaches 4, under `fatigue.resetDays` 5, so their fatigue never resets on the
standard 5-day order: it only recovers 0.1 a day at home.

**Rule H.** Its hold follows the same mark (`homeBlock` reads `resting()`), so it releases a day early too.

**Who sees it:**
- The bots' clean personas (28 days out, 5 home) and the players' default (5 days).
- The cutter's 3-day order gets 2.
- The notice says "home for 5 days off", and under windows the screens print the clock time of the return.

**The fix:** clear at `today >= homeUntilDay` (drop the `+ 1`). Every reader then agrees: 5 days off are 5 days, and
the 5-day order resets fatigue as `resetDays` intends.

**It moves the bots**, so it is not a free fix:
- Each truck gets one more day home a cycle: about 3% fewer working days for the 28/5 personas and 2% for the cutter.
- Fatigue resets on the 5-day order.

**Recommendation:**
- Build it behind a switch (engineering's name, for example `labor.daysOffFull`).
- I pair it on two seeds with the bundle on both arms. If the floor or profit moves beyond the seeds' spread, I run
  ten.
- If engineering lands it before the switch-on commit and the pair reads within the spread, it rides 0.25.0.
  Otherwise it rides the ruleset after.

I am running the two-seed reading now, in a scratch worktree at 1919cc3 with the one line patched there only, so the
answer is in hand when engineering builds it.

## How it was run

- **The worktree:** a scratch worktree at 1919cc3 (lanes-g16), from one gated script.
  - Bundle wave: 05:07–05:16.
  - The vitest wait: an hour.
  - Twin wave: 06:19–06:28.
  - The month probe: 06:29–06:30.
- **The bundle arm:**
  - `windows.enabled`, with batch 8 and 9's sizes as committed;
  - `token.settlementFee.enabled` at 0.01;
  - `assets.expedite.enabled`;
  - `labor.homeTimeHolds`, `labor.pastDueRefuses`, `labor.seatPaidDrivers`;
  - `businesses.parking.stopInTownMidLeg`;
  - `freight.clearsNear.ratio`.
- **The twin:** the same with `token.emission.enabled=false`.
- **The identity:**
  - 0.24.1's seed 1 at 1919cc3 equals 0.24.1's seed 1 at 1a5a9f0 field for field. Every fix is behind a switch.
  - The month probe's 0.24.1 column is identical at both commits.

Nothing in the shared checkout changed. Nothing is staged. The 0.24.1, fee-alone, no-fee and baseline-bundle arms
are the runs of 11-12 and 11-13 (lanes-g14, lanes-g15).
