# Economy: the settlement fee, the pair on the build (2026-11-13)

On engineering's build (engineering-settlement-fee-2026-11-13.md): step 1, the balance readers (36641c5), and step 2,
the fee behind `token.settlementFee` (1a5a9f0). The fee off against on at 1%, on the same commit, 0.24.1's nine rules on
in both arms, the gate's ten seeds at 1460 days, each arm against its own cap-off twin; in a scratch worktree at 1a5a9f0,
from a gated script. Against my prototype in economy-eve-sinks-2026-11-12.md §1 (9b3bc62).

## Verdict

**Ready for a ruleset at 1%.** The build is the spec, and on the market it reads like the prototype:
- 13.3M burned over four years (the prototype 13.1M), 96% of it on loads;
- FD in circulation 4% under the off arm at year 4 (the prototype 3%);
- cleared loads, the rate and bankruptcies within the seed spread;
- loan defaults +11% (the prototype +9%).

The gate now reads the burn and passes **10 of 10**: the off arm passes 9, and the prototype passed 6 before the gate
change. Two things read harder than the prototype, and Jeff should take them knowing:
- **Carriers' profit per truck-week is 5–6% lower, not 3%.** The fee alone is 79 FD a truck-week, 3.7% of an
  owner-operator's profit. It is lower on all ten seeds. The prototype's 3% was a low draw.
- **The carriers' floor is now the closest line.** Under the cap the fee costs about 30 carriers at year 3 (6%), and
  the twin loses none. The worst seed reads 74% of its twin against the 72% line, where the off arm's worst is 80%.
  The cause is built into "outside the refill": the carriers spend 16M less on operating sinks, the refill reads those,
  so the cap pays 10M less on top of the 13M burned.

1% is the rate. I would not go higher without a fresh pair: at 2% the prototype's defaults rose 18%, and the carriers'
floor would be the line to break.

## 1. The build against the spec

| Spec | The build | Checked how |
|---|---|---|
| The burn on its own tag, a burn, not an operating sink | `sink:trade_burn` in `BURN_TAGS` and `CIRCULAR_BURNS` | Code. In the runs `trade_burn` is in the burns and never in the operating sinks, on all ten seeds |
| The band, the quarters, the gate's proxy and the stabilizers count it | `balanceSinksFd` in `ratioOf`, the report's quarters, `gate.ts quarterReadings` and `monthlyStabilizers` (the month's ratio and the balance dial's window) | Code. The band reads +0.008 with the fee on, which is the burn over faucets (13.3 ÷ 1,736); the balance dial sits a touch higher in years 1–2 (0.781 against 0.773, 0.516 against 0.510) |
| The refill does not count it | `emission.ts trailingSinksPerMonthFd` reads `d.sinkFd` alone | Code. The budget falls only by what the operating sinks fell (§3) |
| Charged where the spec lists and nowhere else | Each of these charges once, from the seller: a delivery (on `paid`), a double-broker's spread, a truck or trailer listing (on the net), a trade-in to a player dealership, a dealership's new stock, an asset sale, a player lease's weekly rent. None on NPC sales, `samePerson`, or own freight | Code. In the runs every FD on the tag came through one of those charges: the fee asked by kind equals the tag's total to the cent on all ten seeds |

Two small things, neither blocking (the producer has sent both to engineering):
- The report's per-season ratio and cycle quarters, and the gate's reported `netEmittedFd`, still read operating
  sinks alone. They are display only.
- The load fee is booked at delivery on gross, like the lessor's share. So a carrier on a player shipper's load that
  then defaults has paid 1% of money it never got.

## 2. The lines

| Ten-seed means (range) | Fee off | Fee on, 1% | Prototype, 1% |
|---|---|---|---|
| **FD burned, four years** · on loads · on sales and leases | — | **13.3M** (13.1–13.6) · 12.8 · 0.5 | 13.1M · 12.7 · 0.4 |
| … by year, M | — | 3.8 · 3.3 · 3.3 · 2.9 | 3.8 · 3.3 · 3.2 · 2.8 |
| **FD in circulation at the end of years 1–4, M** | 31.1 · 66.9 · 85.8 · 117.7 | 30.2 · 66.5 · 83.5 · **112.5 (−4.4%)** | 30.6 · 66.5 · 84.1 · 113.9 (−3%) |
| The schedule (planned) · the reserve's drawdown, M | 276 · 188.9 | 276 · 190.1 | — · 191.6 |
| The cap's budget · paid freight, M | 1,424 · 1,395 | 1,419 · 1,385 | 1,415 · 1,383 |
| Operating sinks, four years, M | 1,528 | 1,512 | 1,511 |
| **OO · fleet profit per truck-week** | 2,134 · 2,032 | **2,004 (−6.1%) · 1,933 (−4.9%)** | 2,066 (−3%) · 1,962 (−3%) |
| The fee on loads, per truck-week | — | 79 FD | — |
| **Cleared · mean rate** | 448,291 · 3.755 | 446,717 (−0.4%) · 3.766 | 444,849 · 3.75 |
| **Companies bankrupt** (oo · fleet · broker) | 179 (77 · 43 · 27) | 181 (80 · 43 · 29) | 171 |
| **OO liquidated:** greedy · random · conservative | .197 · .198 · .175 | .212 · .193 · .193 | .186 (mean) |
| **Fleets liquidated:** greedy · random · conservative | .535 · .325 · .223 | .527 · .345 · .210 | — |
| **Loan defaults · trucks seized** | 200 · 111 | **223 (+11%) · 123** | 218 (+9%) |
| Trucks in service · owned at the end | 812 · 584 | 801 · 583 | — · 560 |
| Days at the cap's volume floor · rate floor | 223 · 133 | 230 · 138 | 223 · — |
| Free path: median first truck, days · within 84 days | 46 · 343 | 47 · 338 | 48 · 345 |

**Read:**
- **The burn and the schedule.** The fee burns 13.3M, falling from 3.8M in year 1 to 2.9M in year 4 as the freight
  cools. The schedule (276M planned) is the same in both arms. Circulation sits 5.2M under the off arm at year 4,
  less than the 13.3M burned. The carriers, 1% poorer, put 16M less into operating sinks, which return to the reserve,
  so that money stays in circulation. That is the prototype's finding, a little stronger.
- **Profit.** The fee alone is 79 FD a truck-week (3.7% of an owner-operator's 2,134). The cap pays 10M less (§3) and
  the carriers' inflow per truck-week is flat, so the direct cost is about 4%. The rest of the −5% to −6% is which
  carriers survive. Every seed is lower (owner-operators −2.6% to −10%, fleets −1.2% to −10.5%).
- **Cleared, the rate, bankruptcies and liquidations** move inside the seed spread. The prudent owner-operators fail a
  little more (.175 → .193, two seeds of ten past the off arm's range). Defaults rise with thinner cash, as in the
  prototype.

## 3. The gate: 10 of 10 with the fee on, 9 of 10 off

| Seed | Fee off: band, year 4 · gap to twin · carriers Y3 · Y4 | Fee on: band, year 4 · gap · carriers Y3 · Y4 |
|---|---|---|
| 1 | .850 .848 .851 .850 · −.013 · 80 · 82 | .857 .854 .857 .856 · −.018 · 77 · 82 |
| 2 | .859 .862 .860 .860 · −.006 · 84 · 87 | .861 .864 .863 .868 · −.019 · 79 · 83 |
| 3 | .855 .852 .860 .860 · −.018 · 83 · 84 | .863 .860 .869 .867 · −.014 · **74 · 77** |
| 4 | .849 .848 .858 .861 · −.010 · 81 · 86 | .855 .855 .868 .863 · −.018 · 80 · 83 |
| 5 | .850 .843 .849 .846 · −.014 · 90 · 94 | .851 .853 .856 .863 · −.016 · 86 · 90 |
| 6 | .855 .854 .855 .861 · −.031 · 87 · 89 | .868 .866 .867 .877 · −.013 · 85 · 87 |
| 7 | **.841 .838** .846 .849 · −.023 · 85 · 86 (band fails) | .848 .849 .866 .873 · −.013 · 83 · 85 |
| 8 | .855 .854 .853 .854 · −.019 · 80 · 82 | .864 .862 .862 .866 · −.007 · 75 · 78 |
| 9 | .860 .859 .860 .867 · −.010 · 88 · 89 | .864 .861 .860 .865 · −.012 · 77 · 80 |
| 10 | .859 .853 .857 .858 · −.016 · 91 · 91 | .868 .860 .866 .868 · −.014 · 79 · 82 |

- **The band** reads 0.848–0.877 with the fee on, against 0.838–0.867 off. Counting the burn lifts it by the burn's
  share of faucets, and seed 7 clears the floor it sat on. Without the gate change the prototype read four seeds a few
  thousandths under 0.84; with it, none.
- **The carriers' floor** (72% of the twin's at year 3, 75% at year 4) is the line that moved. The cap arm keeps 484
  carriers at year 3 against the off arm's 515, and its twin keeps 609 against 607.
  - Under the cap, the fee displaces 16M of operating sinks. The refill reads those, so next month's budget is
    smaller: the cap pays 10M less over four years, and the volume floor is hit 7 more days.
  - The twin has no budget, so it has no such knock-on.
  - This is the price of keeping the fee out of the refill, which is what makes it a sink. At 1% it costs about six
    points of the floor's margin; the worst seed still clears by two.
- Cleared, debt (0.1–0.4% of FD held), the cold start (71–106%), supply, the spread and the free path pass on every seed
  in both arms. The market tripwire reads 0.1–1.6%.

## What ran, and where

Four arms of ten seeds at 1460 days (fee off and on, each with its cap-off twin) and both gates
(`gate-fee-off.json`, `gate-fee-on.json`), with the windows runner plus a tap on the fee by kind, in a scratch worktree
at 1a5a9f0, from a gated script file (waves of ten, nothing beside a vitest run). The runner's smoke run (10 days, fee
on) burned 75,386 FD on 2,948 loads and 6 listings before the waves. Nothing in the shared checkout changed and nothing
is staged; for the producer to place as studio/reviews/economy-settlement-fee-pair.md.
