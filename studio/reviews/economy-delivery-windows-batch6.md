# Economy: delivery windows, batch 6 on the ten seeds (2026-11-10)

The fourth reading of item 4, on engineering's batch 6 (31dffac; engineering-windows-batch6-2026-11-10.md): an AI
broker at or over a quarter lost at a hub over the trailing week takes no tender there (`windows.coverDays` 7,
`coverMinLoads` 4, `brokerMaxLostShare` 0.25); the bots' facility test reads the hub's facility lost share, or with too
little data the board's fill over the window's own rounds; a bot closes a facility still at a loss eight weeks after
buying it (`facilityCloseWeeks` 8); the re-post crash fixed (a7c1ad4). Windows on against off on the live profile, the
gate's ten seeds (1–10, 1460 days), the windows-on cap-off twin (all ten ran to the end, the two that died before
included), the carriers' cash flows on two seeds, the trucker's month and the first board; in a scratch worktree at
31dffac, launched into clear vitest gaps between 10:30 and 10:57. The off arm is the ten-seed off run refreshed on
f666d04, figure-identical with windows off on this code (engineering's digest). No engine edit; nothing is staged.

## Verdict

Batch 6 fails the gate on every seed and reads worse than batch 5, and the four lines say why. The facility leak is
closed: the cap's purchases of goods fall to 0.6% of its pay, though the bots still buy 128 facilities a run and close
every one at a loss eight weeks later. The brokers' cover rule never fires: tenders passed up are zero on every seed,
because its tally is kept per broker and hub and four loads a week per broker-hub is almost never reached at this
population. With no brake on them and their contracts priced on the memory-lifted index, the AI brokers now take 73% of
the cap's freight pay (26% off), lose a quarter of it at the pickup's close (fall-off 6.7% of the cap's pay, burned),
and keep a spread the carriers never see; the carriers' share of the cap's pay falls to 75–76% (94% off), their freight
income per truck-week to −19%, the fleets' profit per truck-week to −53%, the owner-operators' to −29%; the carriers
spend less, the cap's budget refills less, its volume lever sits at the floor 586 days of 1,460 against 245, and
cleared loads end 18% under the off arm. The band reads 0.75–0.80 on every seed. Three changes carry the next run: the
AI brokers' contracts priced on the memory-free reference, as the facilities' goods now are; the cover tally kept per
hub across the AI brokers so it can read; and the facility test's fallback on the hub's lost share rather than the
board's fill. Windows stay out of 0.24.1.

## 1. The gate with windows on (cap on against the windows-on, cap-off twin): 0 of 10

| Seed | Band, year 4 (trailing four, corrected) | Twin's own | Gap | Carriers Y3 · Y4, % of twin | Cleared/day Y3 · Y4, % of twin | Month 1 ÷ budget | Market purchases, % of pay | Gate |
|---|---|---|---|---|---|---|---|---|
| 1 | .789 .790 .774 .768 | .764 .749 .745 .756 | +.027 | 73 · 78 | 107 · 72 | 90% | 0.3 | FAIL |
| 2 | .797 .786 .772 .780 | .755 .737 .751 .741 | +.038 | 87 · 85 | 98 · 72 | 74% | 0.7 | FAIL |
| 3 | .786 .771 .761 .757 | .761 .753 .746 .747 | +.017 | 77 · 81 | 80 · 73 | 72% | 0.6 | FAIL |
| 4 | .788 .780 .764 .760 | .745 .734 .724 .735 | +.039 | 73 · 76 | 102 · 70 | 89% | 0.4 | FAIL |
| 5 | .787 .773 .764 .759 | .744 .731 .736 .760 | +.028 | 77 · 81 | 106 · 70 | 93% | 0.5 | FAIL |
| 6 | .779 .775 .769 .757 | .753 .755 .761 .749 | +.015 | 82 · 86 | 87 · 62 | 62% | 0.7 | FAIL |
| 7 | .779 .773 .759 .749 | .747 .740 .722 .731 | +.030 | 76 · 80 | 88 · 78 | 81% | 0.8 | FAIL |
| 8 | .789 .774 .762 .767 | .760 .742 .751 .748 | +.023 | 83 · 83 | 95 · 70 | 73% | 0.7 | FAIL |
| 9 | .784 .771 .759 .769 | .749 .735 .754 .752 | +.023 | 87 · 90 | 82 · 65 | 73% | 0.7 | FAIL |
| 10 | .784 .773 .774 .765 | .752 .748 .738 .746 | +.028 | 83 · 86 | 81 · 70 | 63% | 1.1 | FAIL |

- **The twins of seeds 2 and 7 ran to the end;** the crash fix holds.
- **The band fails everywhere at 0.75–0.80,** under batch 5's 0.79–0.83 and batch 4's 0.82–0.86, the twins at
  0.72–0.76. **Cleared loads a day fall under the floor at year 4 on nine seeds** (62–78% of the twin's against the 75%
  line), the first time a floor has failed under windows: the capped world now hauls less than its starved twin, because
  the cap's budget has shrunk with the carriers' spending (§3). Carriers in service hold at 73–90%. The market
  tripwire is quiet (0.3–1.1%).

## 2. The market, on against off (ten seeds, 1460 days; means with the seed range)

| | Windows off (f666d04) | Batch 6 on | Batch 5 on | Batch 4 on |
|---|---|---|---|---|
| Posted · cleared · fill | 811,946 · 445,404 · 0.549 | 701,233 · 366,833 (−18%) · 0.523 | 878,295 · 409,714 · 0.467 | 941,351 · 425,415 · 0.453 |
| Lost at the pickup's close, share of posted | — | 335,030, 48% | 53% | 55% |
| Mean cleared rate · idle · booked ahead, FD/mi | 3.74 | 3.68 · 3.39 · 3.82 | 3.67 · 3.34 · 3.79 | 3.46 |
| Direct · brokered pay to carriers, FD/mi | 3.58 · 3.70 | 3.02 · 3.88 | 2.92 · 3.78 | |
| The cap's paid freight, M · spot · brokered · market | 1,377 · 999 · 350 · 15 | 1,256 (−9%) · 338 · 917 · 8 | 1,335 · 391 · 867 · 90 | 1,207 |
| … its budget · days at the volume floor | 1,402 · 245 | 1,276 · **586** | 1,372 · 143 | 1,316 · 51 |
| Brokered loads · direct loads | 97,039 · 337,839 | 215,769 · 143,416 | 191,099 · 152,046 | |
| Tenders capped by the bond · to the board · passed up by the cover rule | 389,718 · 240,892 · — | 243,260 · 21,185 · **0** | | |
| Fall-off sink, M · share of the cap's pay · AI brokers liquidated | 25 · 1.8% · 27 | 84 · 6.7% · 3 | 97 · 7.3% · 31 | 72 · 28 |
| Facilities bought · standing at the end · facility share of loads · goods bought, M | 0.2 standing · 1.6% · 15 | 128.5 · 1.7 · 2.0% · 8 | 69 standing · 18–23% · 90 | 55 standing · 69 |
| Carriers' freight inflow, M · share of the cap's pay (ten seeds) | — · 94% (two-seed flows) | 950 · 75.6% [75.0–76.4] | ≈85% | 81% |
| Carriers' freight income per truck-week (two seeds, 730 d) | 7,702 | 6,242 (−19%) | 6,732 | 6,690 |
| Trucks in service (mean) · owned at the end | 774 · 577 | 709 · 534 | 745 · 460 | 742 · 457 |
| OO · fleet profit per truck-week | 2,090 · 2,117 | 1,489 (−29%) · 991 (−53%) | 1,836 · 1,519 | 1,606 · 1,309 |
| Companies bankrupt (oo · fleet · broker · new) | 182 (76 · 48 · 27 · 17) | 133 (73 · 20 · 3 · 35) | 259 | 243 |
| Owner-operators liquidated: greedy · random · conservative | 0.188 · 0.178 · 0.203 | 0.187 · 0.222 · 0.140 | 0.352 · 0.383 · 0.173 | |
| Loan defaults · trucks seized | 178 · 89 | 312 · 222 | 424 · 294 | 407 · 288 |
| Supply at the end, M · AI brokers' wealth (mean) | 118 · 20k | 147 · 53k | 135 | 106 |
| On time · booked ahead · releases · no-shows · late | 0.722 | 0.795 · 68% · 838 · 442 · 223 | 0.780 · 73% · 1,084 · 511 · 274 | |

**The newcomer** (the test page's world on f666d04, six seeds): the trucker's month at Dallas 14,552 → 11,604 FD net
(−20%; batch 5 −28%), 12.5 → 9.0 loads; the first board's rounds with a paying load DAL 83% → 67%, PHX 64% → 51%, MEM
54% → 55%, CHI 92% → 100%, LAX 94% → 99%, the median best margin at Dallas 1,215 → 643.

## 3. The four lines of their own, and what each says

1. **The carriers' share of the cap's pay: 75–76% on every seed** (94% off; batch 4 81%, batch 5 about 85%). Of the
   1,256M the cap paid, 950M reached a carrier. The cash flows per truck-week: the factor's advances on NPC paper 5,534
   → 2,320, NPC shippers direct 1,367 → 416, the factor's advances on brokers' paper 699 → 3,213, brokers direct 101 →
   293: the freight has moved from direct to brokered, and the brokered loads pay the carrier the board's cleared rate
   (3.88 a mile) while the shipper pays the broker a contract priced on the contract index, which under windows carries
   the lost-load memory at the clamp's top (engineering's batch 5 note: the contract index sees the higher top). The
   gap between the two is the brokers' to keep or lose, and they lose most of it: 84M of fall-off, an operating result of
   2.5M a run, a mean wealth of 53k against 20k off, and only 3 of 60 under against 27. Under the off world the slide
   carried a load's walked price to the carrier who waited for it; under windows the memory carries the lift to the
   broker's contract, and the carrier who books ahead at the board's price never sees it.
2. **Facilities: 128.5 bought a run, 1.7 standing at the end, goods bought 8M (0.6% of pay).** The leak is closed and
   the churn is not: the test's fallback (the board's fill over the window's two to four rounds) reads a first-come hub
   at a fill of 0.52 as 95% covered, so a bot buys, loses for eight weeks, closes, and the next bot buys: 7.7M a run to
   the facility dealer against 1.3M off, nothing paid back. Engineering's "no facility at 60 days" is the fallback
   waiting for data; over four years it builds 128. **No facility ever built would not be acceptable for the ruleset**
   (the facilities are a player feature the bots should use where freight moves), and the test is not too hard; its
   fallback is wrong-way: it should read the hub's lost share for NPC freight, which the lost-load memory already
   holds for every hub, so a facility is bought only where loads are being hauled.
3. **The brokers' fall-off: 84M, 6.7% of the cap's pay** (25M, 1.8% off; batch 5 97M, 7.3%), burned by the brokers
   out of the spread in 1. Lost brokered loads sit near 170,000 a run against 216,000 hauled.
4. **Tenders passed up by the cover rule: 0 on every seed, beside 21,185 to the board (240,892 off) and 243,260 capped
   by the bond (389,718 off).** The tally is kept per broker and hub, with the share counted only once four loads were
   taken in the week; at 60 brokers and 60 hubs with about 100 brokered tenders a day nationally, a broker-hub sees
   one or two a week, and the share never counts. The rule as written cannot fire at this population, and meanwhile
   the bond cap, the only brake on the brokers, binds half as often because their contracts are richer.

## 4. What carries the miss, and the next size

The miss is the brokers', and it is priced in, not sized: no value of `brokerMaxLostShare`, `coverMinLoads` or
`facilityCloseWeeks` reaches it. Batch 7, behind the same switch:

1. **The AI brokers' contracts read the memory-free reference**, as the facilities' goods now do (`facilityRef`): the
   contract index that prices a broker's tender is built from the memory-free ratio under `rates.ratioClamp`, so the
   memory lifts what the board pays a carrier for the load and not what the shipper pays the broker for it. A broker's
   spread is then its margin again; a lost load costs it its own fall-off; and the bond cap binds as it did. This is the
   whole of the carriers' missing share, since the brokers keep almost nothing of it: it is burned as fall-off on loads
   the brokers should not have taken.
2. **The cover tally per hub, across the AI brokers** (`b:{hub}` in place of `b:{broker}:{hub}`), with
   `coverMinLoads` 4 and `brokerMaxLostShare` 0.25 unchanged: a hub whose brokered loads lost a quarter last week sends
   its tenders to the board direct, where the carriers see them at the memory's price. Per broker nationally would also
   read; per hub is the truth (the freight nobody can haul is the hub's), and it is one key.
3. **The facility test's fallback reads the hub's NPC lost share** from the lost-load memory over `coverDays`, in place
   of the board's fill over the window's rounds, and the facility lost share once it has data as now; `facilityCloseWeeks`
   8 stays as the backstop. Expect tens of facilities a run standing where freight moves, and single digits closed.
4. **Then the ten seeds again**, the off arm as it is, with the same lines: the carriers' share at 90% or better, the
   brokered share near the shippers' own tender share (half the loads), fall-off under 3% of the cap's pay, facilities
   standing in the tens, the cap's volume lever off the floor, cleared loads and the carriers' profit per truck-week
   within the off arm's range, and the band.

## 5. Which ruleset

Windows stay out of 0.24.1 whatever this reads (the producer's word), and after this reading they wait for batch 7 and a
passing gate.

## What ran, and where

Two arms of ten seeds at 1460 days (batch 6 on, cap on; its cap-off twin, all ten), the gate (`gate-win6.json`), the
carriers' cash flows (`_flows.ts`, seeds 1–2, 730 days), the trucker's month, the first board, with the runner's new
tallies (facilities bought, the carriers' freight inflow against the cap's paid freight), in a scratch worktree at
31dffac; the off arm reused from f666d04; the results kept in the economy's scratchpad (gate7-results) and the
worktree removed. Nothing in the shared checkout changed and nothing was staged.
