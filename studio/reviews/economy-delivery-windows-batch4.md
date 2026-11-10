# Economy: delivery windows, batch 4 on the ten seeds (2026-11-10)

The second reading of item 4, on engineering's batch 4 (ad349e3; engineering-item4-batch4.md): NPC and AI-broker
freight lost at the pickup's close joins the hub's load-to-truck ratio at each posting (half-life 7 days, weight 1); the
window's life 24 / 48 hours and a four-step walk; a same-day premium of 1.10 on lead-0 NPC loads that are not hot;
release on a breakdown that breaks the plan. Windows on against off on the live profile, the gate's ten seeds (1–10,
1460 days), the windows-on cap-off twin beside, in a scratch worktree at ad349e3, launched into clear vitest gaps
overnight; the off arm is the ten-seed off run of the first sizing (c915f72; engineering's digests are identical off).
The target set in economy-delivery-windows-sizing.md: the off arm's cleared loads, NPC pay and rate within its seed
range, lost loads under a quarter of posted, the cap binding again. No engine edit; nothing is staged.

## The finding first

**Batch 4 brings the economy most of the way back and stops short on the one line that pays the carriers.** Against the
first sizing's collapse, cleared loads go from −22% to −5% of the off arm, NPC freight pay (the cap's paid total) from
−42% to −13%, the rate from −19% to −7%, bankruptcies from 488 to 243 a run (185 off), and the gate from none to six
seeds of ten. (The first sizing's NPC pay was the NPC faucets in all, advances on brokers' paper included; under
batch 4 those advances double with the brokered share, so this note reads the cap's paid total, which the gate reads.) The newcomer's month at
Dallas is 15% better than today's, and a cold world's first board at Dallas pays in two rounds of three. What stops
short is the price of direct NPC freight: it clears at 2.92 FD a mile against 3.57 off, because the slide is gone and
the memory's lift on the reference is capped by `rates.ratioClamp` at ×1.38; brokered freight, whose contracts carry
the same-day premium and the trailing index, clears at 3.78 and takes 59% of NPC pay against 26%. The carriers keep
hauling as many loads for 7% less a mile, which through their contribution is −22% on an owner-operator's profit per
truck-week and −38% on a fleet's; they buy fewer trucks (457 owned at the end against 574), default on loans twice as
often, and the band fails on four seeds for that reason, the capped world reading one to two points under its twin.
Half the posted loads are still lost against the off arm's own 44% given up after ten rounds, which is the board
carrying more freight than the trucks, under either rule. **The variants on today's keys say the clamp is the lever:**
`rates.ratioClamp`'s top at 6 instead of 2.5 (the memory's lift on the reference ×1.87 instead of ×1.38) brings NPC
freight pay to −1% of the off arm, the rate to −3%, cleared loads to −3% and the cap back to binding, over 730 days on
two seeds; and the carriers' profit per truck-week still sits −23% for owner-operators and −46% for fleets, with loan
defaults doubled. So windows wait once more, on one question the cash flows answer below: where the carriers' margin
goes when the market's pay is back.

## 1. The gate with windows on (cap on against the windows-on, cap-off twin)

| Seed | Band, year 4 (trailing four, corrected) | Twin's own | Gap | Carriers Y3 · Y4, % of twin | Cleared/day Y3 · Y4, % of twin | Debt, % of FD held | Month 1 ÷ budget | Supply (warm, yoy) | Gate |
|---|---|---|---|---|---|---|---|---|---|
| 1 | .852 **.836 .821 .832** | .863 .854 .846 .848 | −.018 | 105.5 · 104.7 | 100.9 · 105.7 | 0.5 · 0.4 | 82% | 1.25, 1.52 ✓ | FAIL (band) |
| 2 | .878 .855 .863 .861 | .861 .843 .846 .853 | +.013 | 98.0 · 100.0 | 104.0 · 106.3 | 0.6 · 0.4 | 70% | 1.23, 1.44 ✓ | PASS |
| 3 | .857 .851 .853 .853 | .869 .863 .866 .865 | −.012 | 112.4 · 111.7 | 97.2 · 91.4 | 0.4 · 0.5 | 67% | 1.37, 1.42 ✓ | PASS |
| 4 | .864 .852 **.839** .849 | .868 .864 .857 .864 | −.012 | 98.2 · 99.3 | 104.5 · 96.7 | 0.5 · 0.2 | 80% | 1.24, 1.47 ✓ | FAIL (band) |
| 5 | .867 .851 **.837** .851 | .875 .860 .857 .854 | −.010 | 107.1 · 107.2 | 108.4 · 95.2 | 0.4 · 0.3 | 82% | 1.29, 1.55 ✓ | FAIL (band) |
| 6 | .865 .850 .850 .846 | .878 .865 .860 .857 | −.012 | 97.6 · 97.2 | 104.3 · 104.2 | 0.4 · 0.4 | 59% | 1.28, 1.50 ✓ | PASS |
| 7 | .852 .842 .848 .857 | .857 .860 .862 .861 | −.010 | 100.9 · 103.6 | 95.1 · 96.2 | 0.2 · 0.3 | 76% | 1.28, 1.45 ✓ | PASS |
| 8 | .864 **.837 .839** .848 | .856 .831 .838 .841 | +.005 | 100.3 · 99.7 | 95.2 · 95.8 | 0.3 · 0.3 | 68% | 1.22, 1.53 ✓ | FAIL (band) |
| 9 | .862 .843 .849 .857 | .848 .829 .830 .832 | +.018 | 98.4 · 95.5 | 107.0 · 105.0 | 0.4 · 0.3 | 68% | 1.27, 1.47 ✓ | PASS |
| 10 | .860 .859 .860 .851 | .840 .842 .841 .845 | +.016 | 113.5 · 113.3 | 92.9 · 89.7 | 0.2 · 0.3 | 61% | 1.37, 1.54 ✓ | PASS |

- **Six of ten pass; the four fails are the band's floor** by 0.001–0.019, on seeds whose twins read 0.831–0.857. The
  floors pass everywhere (carriers 95–113% of the twin's, cleared 90–108%, debt 0.2–0.6%), supply passes everywhere
  (the first sizing failed it on every seed), the cold start commits 59–82% of its month-1 budget, and the NPC market's
  purchases read 4.7–6.8% against the 5% tripwire (reported). The baseline gate on this code passes ten of ten with its
  thinnest readings at 0.840–0.843.
- **What the band's dip says.** A corrected ratio under the twin's means the capped world retains more of what it is
  paid: here the carriers, paid 7% less a mile, buy fewer trucks (equipment sinks 145M against 189M over the four years)
  and repay fewer loans, so sinks fall against faucets. The dip is the carriers' squeeze read in the band, not noise, and
  it goes when the price does. The cap binds a little again (51 days at the volume floor against 235 off and 7 in the
  first sizing; the budget 1,316M, 1,207M paid).

## 2. The market, on against off (ten seeds, 1460 days; means with the seed range)

| | Windows off | Windows on, batch 4 | Batch 4, cap off | For the record: the first sizing (on, batches 1–3) |
|---|---|---|---|---|
| Posted | 809,680 | 941,351 [910,394–1,017,864] (+16%) | 934,668 | 1,242,044 |
| Cleared | 447,469 [437,736–458,844] | 425,415 [408,062–442,094] (−5%) | 417,720 | 348,212 |
| Lost at the pickup's close, share of posted | — | 516,840, 55% | 517,704, 55% | 895,034, 72% |
| … by year | — | 48% · 58% · 55% · 59% | | |
| Fill | 0.553 | 0.453 | 0.447 | 0.281 |
| Mean cleared rate, FD/mi | 3.73 [3.67–3.76] | 3.46 [3.44–3.49] (−7%) | 3.47 | 3.02 |
| … by year | 3.95 · 3.83 · 3.67 · 3.46 | 3.46 · 3.45 · 3.38 · 3.56 | | |
| Direct NPC freight · brokered, FD/mi | 3.57 · 3.68 | **2.92** · 3.78 | | |
| Brokered loads · share of NPC pay | 100,716 · 26% | 197,469 · 59% | 191,634 | 27,816 · 9% |
| On time | 0.724 | 0.775 | 0.773 | 0.808 |
| NPC freight pay, M FD (the cap's paid total) | 1,381 (budget 1,405) | 1,207 (budget 1,316) (−13%) | — | 801 |
| … by kind: spot direct · brokered · contract · market | 991 · 363 · 19 · 14 | 432 · 721 · 3 · 69 | | |
| NPC faucets in all, M FD (advances and the lessor included) | 1,737 [1,650–1,786] | 1,799 [1,718–1,861] | 1,762 | 1,027 |
| Days at the cap's volume floor | 235 | 51 | — | 7 |
| Fall-off sink, M FD | 26 | 72 [68–76] | 71 | 13 |
| Trucks in service (mean) · year 4 | 776 · 783 | 742 · 680 | 725 | 684 · 562 |
| Owned trucks at the end · by year | 574 (678 · 628 · 628 · 574) | 457 (691 · 573 · 495 · 457) | 500 | 327 |
| OO profit / truck-week | 2,063 [1,943–2,186] | 1,606 [1,531–1,656] (−22%) | 1,662 | 1,081 |
| Fleet profit / truck-week | 2,099 [1,853–2,397] | 1,309 [1,236–1,404] (−38%) | 1,542 | 667 |
| Companies bankrupt (oo · fleet · broker) | 185 (75 · 46 · 30) | 243 (118 · 66 · 28) | 226 | 488 |
| OO liquidated share | 0.187 | 0.273 | 0.257 | |
| Loan defaults · trucks seized | 175 · 85 | 407 · 288 | 370 · 266 | |
| Supply at the end, M FD | 119 | 106 | 100 | 49 |
| Free path: first truck median day · within 84 | 30 · 345 | 32 · 363 | 24 · 346 | 54 · 579 |
| Equipment sinks, M FD | 189 | 145 | 147 | |
| Population dial: retired · wound down | 34 · 86 | 0 · 0 | 1 · 2 | 0 · 0 |

**Where the loads go.** Lost by poster: NPC direct 329,277, AI brokers 105,240, player-style brokerages 3,600,
facilities 78,724. The brokers' loss is the fall-off sink's rise from 26M to 72M, which the refill reads (46M of budget
over four years). Posted is 16% above the off arm with the volume lever at the same 0.80, so the extra postings are the
ratio's: the memory lifts the hub's reading and the planner posts to it. Lost loads do not fall over the years (48% →
59%): the memory holds the ratio at the clamp where losses persist, and the clamp holds the price. The facilities' goods
sold to the NPC market go from 14M to 69M (the tripwire's 4.7–6.8%): their loads lost at the close are sold instead.

**Why direct freight pays 2.92.** The off arm's direct loads cleared after rollovers at +10% a round; a load taken in its
third round paid 21% over its opening. Under batch 4 the opening price is the reference lifted by the ratio, at most
×1.38, and the planners book ahead at that price, so what clears on direct freight clears near its opening; the four
steps come only in the last two days and most loads that will clear have cleared. Brokered freight is priced from the
trailing contract index with the same-day premium on the contract, and the brokers' bonds grow with their revenue, so
they accept twice the tenders (tenders to the board 235k → 101k) and the carriers haul their loads at 3.78. The
carriers' rate is the blend, 3.46.

**Booking ahead:** 74% of wins, the planners at 3.51 against the idle 3.31. **Claims:** late 320 a run (210k FD),
no-shows 618 (428k) against the first sizing's 2,017, releases 1,354 (358k, all the bots' and dispatchers', on
breakdowns); per truck-year 0.11 late, 0.21 no-shows, 0.46 releases, 335 FD in all; claims are 0.06% of NPC pay. The
release rule took two thirds of the no-shows away and cost the carriers less than the no-shows it replaced.

**The trucker's month at Dallas** (the test page's world, six seeds): 10,064 → 11,606 FD net (+15%), 10.2 → 11.0 loads;
against the first sizing's 8,196. A newcomer who plans two deep on a same-day board does better than today.

**The newcomer's first board** (a cold world's first 14 days, seeds 1, 4, 8): rounds with a load at +25% over break-even
CHI 92% → 100%, LAX 94% → 99%, DAL 83% → 68% (the first sizing: 45%), PHX 64% → 58% (35%), MEM 54% → 57% (30%); the
median best margin at DAL 1,215 → 475 FD (−78 in the first sizing), PHX 192 → −85, MEM 25 → −69. Most of the way back;
Dallas still thinner than today in a cold start.

## 3. The sizes and the next lever

- **The claims, the fall-off, plan-ahead 12, margin 60: keep**, as in the first sizing; they are invisible in the
  aggregate and right one load at a time.
- **The window's life (24 / 48) and the four-step walk: keep.** They brought the loads back; the walk's reach is not
  the problem, since what clears does so before it.
- **The memory and its weight: keep at 1.** Engineering showed the weight saturates at the clamp; the ten seeds show
  the clamp, not the weight, holding the price.
- **The same-day premium 1.10: keep**, and read it as a floor; the variants say whether a stronger lift belongs on the
  reference through the clamp rather than on same-day loads alone.
- **The lead-day weights: a knob,** in the variants.

**The variants on today's keys** (windows on, seeds 1–2, 730 days, against a 730-day off run on the same code; NPC
pay is the cap's paid total):

| Variant | Posted | Cleared | Lost, % of posted | NPC freight pay, M | Days at the volume floor | Rate, year 2 | Direct · brokered, FD/mi | Brokered loads | OO profit / truck-week | Fleet profit / truck-week | Companies bankrupt (oo) | Loan defaults | Owned trucks at 730 | Supply, M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Off | 397,272 | 219,971 | — | 688 | 220 | 3.86 | 3.83 · 3.66 | 26,132 | 2,503 | 2,404 | 112 (52) | 130 | 620 | 72 |
| Batch 4 as built | 468,349 | 224,430 | 52% | 636 (−8%) | 44 | 3.48 | 3.08 · 3.71 | 91,384 | 1,700 | 1,132 | 132 (71) | 228 | 579 | 55 |
| `ratioClamp` top 4 | 428,883 | 218,680 | 49% | 680 (−1%) | 112 | 3.62 | 3.26 · 3.84 | 95,487 | 1,870 | 1,340 | 138 (70) | 261 | 580 | 69 |
| **`ratioClamp` top 6** | 408,500 | 212,535 | 48% | 681 (−1%) | 184 | 3.73 | 3.38 · 3.95 | 88,216 | 1,935 | 1,288 | 122 (60) | 252 | 568 | 75 |
| Clamp 4 and memory weight 2 | 409,470 | 213,104 | 48% | 669 (−3%) | 164 | 3.64 | 3.29 · 3.85 | 93,728 | 1,875 | 1,124 | 128 (68) | 299 | 532 | 72 |
| leadDays 20 / 40 / 25 / 15 | 515,273 | 228,428 | 55% | 630 (−8%) | 34 | 3.42 | 3.06 · 3.74 | 79,150 | 1,766 | 1,194 | 137 (76) | 244 | 587 | 59 |

- **The clamp's top is the lever, as engineering said.** At 6 the memory can lift a hub's reference ×1.87 where freight
  goes unhauled: NPC freight pay comes back to −1%, the rate to −3%, cleared loads to −3%, supply to the off arm's, the
  cap binds again (184 days at the volume floor against 220), direct freight rises from 3.08 to 3.38 a mile, and the lost
  share eases to 48% against the off arm's 44% given up. Weight 2 adds nothing (the saturation engineering saw); the
  lead-day shift makes it worse (more freight on the board, the same trucks).
- **The carriers' margin does not come back with the pay.** At clamp 6 the owner-operators' profit per truck-week is
  −23% and the fleets' −46%, loan defaults are 1.9× the off arm's, and owner-operator bankruptcies 60 against 52. The
  market pays the same for the same loads and the carriers keep a quarter less of it. **Where the carriers' margin goes** (`_flows.ts`: every ledger posting from or to a carrier's account, per carrier
truck-week, seeds 1–2, 730 days):

| Per carrier truck-week, FD | Off | Batch 4 | Clamp 6 |
|---|---|---|---|
| Freight income in all (the factor's advances on NPC and brokers' paper, NPC shippers direct, brokers direct) | 7,756 | 6,631 (−14.5%) | 6,690 (−13.7%) |
| … the carriers' share of the cap's paid freight money | 94.2% | 84.0% | 80.9% |
| Fuel · driver wages · road service · maintenance · rebuilds | 1,726 · 934 · 472 · 401 · 448 | 1,773 · 772 · 671 · 492 · 392 | 1,672 · 818 · 531 · 447 · 391 |
| Loan principal · lease deposits · NPC lease | 410 · 290 · 351 | 358 · 375 · 326 | 395 · 448 · 377 |
| The dealer · the used lot · trucks sold to fleets | 302 · 152 · 347 | 188 · 188 · 398 | 256 · 158 · 472 |
| All in · all out · net | 10,117 · 9,888 · 228 | 9,278 · 9,100 · 177 | 9,688 · 9,513 · 175 |

The market pays the same money and the carriers receive 81–84% of it instead of 94%. The two leaks are in the cap's own
pay record: **the NPC market's purchases of facilities' goods** go from 14M to 69M over four years on the ten seeds (72M
at clamp 6 over two years' pace), 2% of the cap's pay to 6–10%, because a facility's sale value is `saleValueOfRef` ×
the reference, and the memory lifts the reference wherever freight is lost, so the facilities' goods inflate with it
and their owners (the bots' warehouses, cold stores and factories) take the budget the carriers' hauls would have taken;
and **the brokers' fall-off** on loads lost at the close, 26M → 72M, a sink the brokers pay out of a revenue that the
same-day premium on their contracts doubled. The carriers' own costs move little (road service +12–42% on an ageing
fleet, rebuilds and the dealer down as they stop reinvesting); the gap is income, and it is the cap's money going to
goods and to fall-off instead of to hauls.

**What I want from engineering, batch 5, behind the same switch:**

1. **`windows.ratioClampTop` 6:** the memory's lift on the reference reaches ×1.87 instead of ×1.38 while windows are
   on; `rates.ratioClamp` stays as it is for the rest. The variants put NPC freight pay, cleared loads and the rate
   within 3% of the off arm on it.
2. **The facilities' sale value reads the reference without the memory.** Whatever the memory adds to a hub's ratio must
   not reach `saleValueOfRef`: a facility's goods are worth what they were, it is the haul that got dearer. That closes
   the 6–10% leak to goods and should carry the carriers' share of the cap's pay back toward 94%; the gate's market
   tripwire (5%) is the check, and at clamp 6 without this fix it would read about 10%.
3. **Nothing on the brokers' fall-off for now:** a broker that cannot cover a load loses 15% of its contract today as
   under windows; what changed is how many loads it fails to cover, and that is the market's price to find. If after 1
   and 2 the fall-off still takes 5% of the cap's pay, the question is whether an AI broker should accept tenders it
   cannot cover, which is their dispatcher's call, not the claim's size.
4. **Then the ten seeds again** against the off arm: cleared loads, NPC freight pay and the rate within its seed range
   (clamp 6 does this), the carriers' share of the cap's pay at 90% or better, the carriers' profit per truck-week and
   the fleets' truck count within the seed range, loan defaults within a quarter of the off arm's, and the band's gate as
   it is.

## 4. Claims, releases, the residue

Release on a breakdown works as designed: 1,354 releases a run against 618 no-shows (the first sizing: 2,017 no-shows,
no releases), 358k FD of cancel claims at the early share, and the released loads back on the board. The no-shows that
remain are the breakdowns that land inside the urgency rounds or on a hand-booked load nobody answers (none here: the
bots have dispatchers). Nothing to change.

## 5. Which ruleset

- **Windows wait once more**, for batch 5 and a ten-seed gate that passes on the band with the carriers' income back;
  they do not ride in 0.24.1.
- **0.24.1 carries the five switches, the hand-bid hold and the collateral rule** (the loan gate review: ten of ten on
  the baseline, eight of ten with the two fails at the floor's thousandths, the market unchanged), as the one restart
  with no players those need.
- **The sizes for batch 5's run:** as batch 4 built them (24 / 48 hours, four steps, the premium 1.10, the memory at
  weight 1 and a 7-day half-life, release on a breakdown), with `windows.ratioClampTop` 6 and the facilities' sale value
  off the memory as the two changes; the lead-day weights stay where they are (the shift made it worse).

## What ran, and where

Two arms of ten seeds at 1460 days (batch 4 on, cap on and cap off; the off arm reused), the gate (`gate-win4.json`,
and `gate-base.json` for the baseline on this code), the trucker's month (`_month.ts`), the first-board probe, the
variants (`wv4-*`, seeds 1–2, 730 days) and the carriers' cash flows (`_flows.ts`, `fl-*`), in a scratch worktree at ad349e3; kept at
the economy's session scratchpad.
Nothing in the shared checkout changed and nothing is staged; this note is the shared folder's first, for the producer
to place as studio/reviews/economy-delivery-windows-batch4.md.
