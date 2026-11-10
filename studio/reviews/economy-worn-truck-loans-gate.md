# Economy: the worn-truck loan rule, the gate pair (2026-11-10)

The ten-seed reading of `equipmentFinance.purchase.collateral` as engineering built it (ad349e3, with windows batch 4;
DECISIONS.md 2026-11-09, Jeff: "Yes, build it"), before its ruleset. The rule on against off on the live profile, the
gate's ten seeds (1–10, 1460 days), each against its cap-off twin on the same code, in a scratch worktree at ad349e3,
launched into clear vitest gaps overnight. The off arm is the ten-seed off run of the windows sizing (c915f72;
engineering's digests are identical off at ad349e3), and the off twin was run fresh on ad349e3 for the baseline gate.
No engine edit; nothing is staged.

**The rule as built:** the down payment is the credit share plus 3 points a year of age over three, 3 points per 100k
miles over 300k, 10 points for a company under a year old that has never owned a truck, capped at 50%; declined past ten
years or 700k miles ("cash only", with the figure); the term ends by the truck's seventh birthday and never under 26
weeks; the rate rises 0.03% a week per year of age over three.

## The finding first

**The rule costs the economy nothing and does what it was sized to do.** On the ten seeds the market with the rule on
is the market with it off: cleared loads 448k against 447k, the mean rate 3.72 against 3.73, NPC freight pay (the
cap's paid total) 1,379M against 1,381M, carriers' profit per truck-week 2,082 / 2,085 against 2,063 / 2,099, companies bankrupt 178 against 185. The
coupling I flagged from the bound arms (fewer and later truck purchases as fewer equipment sinks for the cap's budget,
NPC pay −3.4–5.0%) does not appear: equipment sinks are 190M against 189M over four years, because the bots buy the
same trucks a few weeks later. What moves is the lender's book and the first truck's day: loans written −7%, defaults
−9%, trucks seized −19%, FD written off −17%; the free path's median first truck 30 → 49 days. The gate passes eight of
ten, the two fails on the band's floor by 0.002–0.005, and the baseline gate on the same code (off against its off twin, run fresh) passes ten of ten with seed 8 at 0.840 exactly, so the two fails are the floor's margin and not the rule.

## 1. The gate (the rule on, cap on, against the rule on, cap off)

| Seed | Band, year 4 (trailing four, corrected) | Twin's own | Gap | Carriers Y3 · Y4, % of twin | Cleared/day Y3 · Y4, % of twin | Debt, % of FD held | Month 1 ÷ budget | Prudent OO first truck (twin) | Gate |
|---|---|---|---|---|---|---|---|---|---|
| 1 | .849 .855 .856 .855 | .870 .863 .864 .858 | −.010 | 77.7 · 80.2 | 96.9 · 100.1 | 0.3 · 0.2 | 104% | d128 (d53) | PASS |
| 2 | .844 .854 .850 .854 | .885 .876 .865 .857 | −.020 | 80.4 · 82.8 | 102.1 · 103.3 | 0.1 · 0.2 | 84% | d183 (d86) | PASS |
| 3 | .852 .851 .848 .853 | .873 .867 .872 .870 | −.020 | 83.6 · 80.6 | 93.4 · 98.0 | 0.2 · 0.2 | 81% | d142 (d67) | PASS |
| 4 | .852 .853 .855 .857 | .863 .851 .857 .854 | −.002 | 81.4 · 83.8 | 102.3 · 99.2 | 0.1 · 0.2 | 101% | d130 (d55) | PASS |
| 5 | .847 .845 .852 .855 | .875 .864 .861 .852 | −.014 | 85.7 · 90.4 | 99.6 · 103.9 | 0.1 · 0.2 | 104% | d127 (d54) | PASS |
| 6 | .849 .847 .848 .856 | .893 .890 .872 .871 | −.032 | 80.3 · 82.1 | 105.2 · 109.3 | 0.3 · 0.2 | 71% | d190 (d100) | PASS |
| 7 | **.840** .842 .843 .845 | .876 .864 .865 .866 | −.025 | 91.8 · 92.6 | 91.8 · 97.5 | 0.1 · 0.2 | 99% | d119 (d59) | FAIL (band) |
| 8 | .844 .842 **.838** .840 | .877 .874 .868 .856 | −.028 | 81.2 · 79.4 | 95.3 · 91.5 | 0.1 · 0.2 | 83% | d192 (d87) | FAIL (band) |
| 9 | .845 .846 .853 .859 | .870 .867 .858 .857 | −.013 | 82.8 · 83.8 | 100.7 · 94.2 | 0.2 · 0.2 | 82% | d183 (d78) | PASS |
| 10 | .854 .852 .857 .856 | .870 .864 .863 .870 | −.012 | 82.9 · 80.7 | 104.5 · 97.9 | 0.2 · 0.2 | 72% | d157 (d85) | PASS |

- **The floors pass everywhere:** carriers 78–93% of the twin's (lines 72% and 75%), cleared loads 91–109%, debt
  0.1–0.3% of FD held, the cold start 71–104% of the month-1 budget, supply and the spread as before.
- **The band fails on seeds 7 and 8** by readings of 0.838–0.840 against the 0.84 floor, the capped world 2.5–2.8
  points under its own twin on those seeds. The baseline gate on the same code (off against a fresh off twin at
  ad349e3, `gate-base.json`) passes ten of ten, with its lowest readings on the same two seeds: 0.843 on seed 7 and
  0.840 on seed 8, at the floor. Seed by seed the rule's lowest reading against the baseline's: +0.005, −0.013,
  +0.005, +0.005, +0.004, 0.000, −0.003, −0.002, −0.006, +0.008; mixed in sign and inside the thousandths the gate's
  calibration note called noise. The rule does not move the band; the floor sits where this code's healthy capped
  world reads on its thinnest seeds, which is the calibration's own margin and the next calibration's figure.
- **The prudent owner-operator's first truck** (reported, never gated) comes on day 119–192 against the twins' 53–100;
  the previous gate on the old code read 114–189 against 49–87, so the rule moves the prudent persona little (its own
  buffer and its two months of payments in hand were already the slower brake).

## 2. The equipment-sink coupling and the carriers' line

| Ten-seed means | Off | The rule on |
|---|---|---|
| NPC freight pay, M FD (the cap's paid total) | 1,381 | 1,379 |
| NPC faucets in all, M FD (advances and the lessor included; the first notes' measure) | 1,737 [1,650–1,786] | 1,740 [1,688–1,788] |
| Equipment sinks, M FD (all equipment, four years) | 189 | 190 |
| Days at the cap's volume floor · rate floor | 235 · 141 | 241 · 142 |
| Volume lever after year 1 | 0.805 | 0.828 |
| Cleared loads · mean rate | 447,469 · 3.73 | 448,474 · 3.72 |
| OO · fleet profit per truck-week | 2,063 · 2,099 | 2,082 · 2,085 |
| Owned trucks at the end | 574 | 581 |
| Trucks in service (mean) | 776 | 778 |

The bound arms of economy-worn-truck-loans-2026-11-09.md priced every loan as a worn-truck loan and took 3.4–5.0% off
NPC pay through the refill; the rule as built prices worn trucks and new businesses only, and the bots respond by buying
the same trucks later, not fewer: the four-year equipment spend is unchanged, the cap binds as before, and the carriers'
line against the twin reads 78–93% (the old gate's 74–90%). The coupling was a property of the bound, not of the rule.

## 3. The newcomer's day to the first truck under the cap

| | Off | The rule on |
|---|---|---|
| Free path: median day of the first owned truck | 30 [22–45] | 49 [37–71] |
| … bought within 84 days | 345 of ≈366 | 329 of ≈366 |
| Owner-operators' median day: greedy · random · conservative | 23 · 33 · 150 | 37 · 50 · 155 |
| Lot rigs sold · used-market sales (four years) | 346 · 743 | 323 · 758 |

**The test page's world** (`_firsttruck.ts`: an owner-operator joining at Dallas after the warm start on the players'
dispatcher, six seeds, the Dealer's own route read every day): the first day a route opens ("You can buy today")

| Seed | Off: day, route | The rule on: day, route |
|---|---|---|
| 11 | 13, a listing | 10, a listing |
| 23 | 16, a listing | 18, the lot |
| 37 | 17, a listing | 28, a listing |
| 41 | 25, a listing | 29, a listing |
| 59 | 15, the lot | 23, a listing |
| 73 | 11, the lot | 44, the lot |
| **Mean** | **16** | **25** |

So a newcomer who hauls every day sees a route open about nine days later than today, a listing or the lot; the day-2
beater of QA's replay (4,620 FD at signing) needs about 7,670 under the rule, as the first note computed, and a new rig
17,300 instead of 13,100. Nine days is the rule's whole effect on pacing; the first truck stays a matter of weeks, as
Jeff ruled, and the brake is the cash down, at its cause.

## 4. Liquidations, the lender's book, the used market

| Ten-seed means | Off | The rule on |
|---|---|---|
| Purchase loans written, M FD | 67.9 | 63.4 (−7%) |
| Loan defaults · trucks seized | 175 · 85 | 160 · 69 |
| FD written off on loans, M | 1.11 | 0.92 (−17%) |
| Loan interest paid, M | 6.4 | 6.1 |
| Companies bankrupt (oo · fleet · broker) | 185 (75 · 46 · 30) | 178 |
| Owner-operators' liquidated share | 0.187 | 0.177 |
| In debt at the end | 238 | 237 |

Fewer worn trucks are financed and the ones that are carry more equity, so the lender's losses fall by a sixth and
seizures by a fifth; the liquidations do not rise. Nothing in the used market moves beyond the noise (lot rigs −7%,
listings +2%).

## 5. The used lot's queue for a starter's first truck (the producer's question)

**The dealer's wait over the ten seeds** (`dealerDelivery`: 30 days + 0.25 a pending order, to 150; the lot's rigs in
the backlog on live), read daily from `ordersPending`:

| | Month 1 | 2 | 3 | 4 | 5 | 6 | 7–12 | Year 2 | Year 3 | Year 4 | Worst day |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Off | 45 | 79 | 70 | 51 | 41 | 38 | 33–36 | 35 | 36 | 35 | 92 |
| The rule on | 36 | 64 | 69 | 58 | 45 | 39 | 33–36 | 35 | 36 | 35 | 90 |

**Ten weeks is the first quarter's rush, not the steady state and not a runaway.** The free path's starters all order
in the first months (244 orders pending at the end of month 1 on seed 1, 13 by month 6), the wait peaks at 70–80 days in
months 2–3 and settles at 33–36 days from month 7 for the rest of the four years; no day of forty reaches the 150-day
cap. QA's test world starts on day ten, in the rush, so "delivered Apr 19" by early February is that peak: the day-ten
world's order rush, which the live world after a restart will show in the same weeks and then lose. The rule on does not
change the shape (the rush is a little lower, since fewer starters can finance in month 1, and a little later).

**What share of first trucks come by the lot, a listing and new:** of the free-path starters' first owned trucks (a
ledger tally, `rt-off` and `rt-coll`, seeds 1–2, 730 days: 396 starters a seed), the lot takes 62–70% and a listing
30–38% with the rule off, 57–68% and 32–43% with it on, and none is bought new. So two first trucks in three go through
the dealer's queue today, and a few more go to listings under the rule (a listing is delivered at once; a lot rig that
replaces the lessor's waits).

**Is the queue still doing the work it was kept for?** It was kept (economy-player2 §1c, 2026-11-03) as a brake:
delivering a starter's lot rig from stock in the lot's own days raised owner-operator liquidations by seven over four
years, with loans at 10–20% down. The collateral rule is the brake at the cause: a starter puts a third down on a worn
rig and its first truck comes two to three weeks later for the bots and nine days later for a player, and the lender's
losses fall. With the rule on the queue adds its five weeks on top at steady state and ten in the rush, by waiting, which
is the part a player reads as a date that slides. My recommendation is to let a starter's lot rig come from the lot's
stock in the lot's own days (`usedMarket.npcLot.deliveryDays`, 7 on live) once the collateral rule is on, and to read the
liquidations on the pair. **That pair needs a key from engineering:** `dealerships.ts lotDeliveryDays` sends a rig that
replaces the lessor's to the NPC dealer's queue by code (`replacesLease`), and no key reaches it; a switch
(`usedMarket.npcLot.startersFromStock`, default off) would let the pair run on the ten seeds in an hour. My expectation
from these runs: the liquidations move inside the noise (the rule's seeds read 0.177 liquidated against 0.187 with the
queue in both), because the §1c finding was made under loans that put 14% down on a beater, and that loan no longer
exists; but it is a reading, not a guess, and the pair is cheap.

## 6. Which ruleset

**Ride in 0.24.1 with the five switches and the hand bid, as the restart those need anyway.** The rule changes what the
bots buy and when (the digests move), so it is a market rule and lands at a restart with no players; the five switches
and the hand-bid hold need no restart of their own, so one restart carries all of them. The gate passes eight of ten with
the two fails the baseline's own thinnest two seeds read 0.840–0.843 on this code (ten of ten pass, seed 8 at the floor), and the rule moves them by two and three thousandths; the carriers' line, the cleared loads, the debt line and the cold start pass
everywhere; the economy's lines are the off arm's to within the seed spread. Windows stay out of it (the batch 4 review).
If the starters-from-stock key is built before the restart, it goes behind its own switch and the pair decides; if not,
the queue stays as it is and the rule rides alone.

## What ran, and where

Three arms of ten seeds at 1460 days (the rule on cap on, the rule on cap off, the off twin; the off arm reused from the
windows sizing), `_wsim.ts` (run.ts's world and report, a ledger tap), the gate (`gate-coll.json`, `gate-base.json`),
the first-truck probe (`_firsttruck.ts`, the test page's world) and two 730-day pairs with a purchase-route tally
(`rt-off`, `rt-coll`), in a scratch worktree at ad349e3; kept at
the economy's session scratchpad.
Nothing in the shared checkout changed and nothing is staged; this note is the shared folder's first, for the producer
to place as studio/reviews/economy-worn-truck-loans-gate.md.
