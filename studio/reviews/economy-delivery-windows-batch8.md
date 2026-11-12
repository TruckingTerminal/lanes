# Economy: delivery windows, batch 8 on the ten seeds (2026-11-13)

The sixth reading of item 4, on engineering's batch 8 (51d0a1d, with client batch 8b, which changes no engine
behaviour): `windows.ratioExponent` 0.5 in place of `rates.ratioExponent` in the board's reference, the contract index
and the memory-free contract index while windows are on; `windows.facilityBlockWeeks` 26 for bots after a facility closes
at a loss. Windows on against a fresh off arm on the same commit (it reproduces batch 7's off arm figure for figure), with
0.24.1's nine rules on in both, the gate's ten seeds (1–10, 1460 days), the windows-on cap-off twin and the newcomer's
month; in a scratch worktree at 51d0a1d, launched into clear vitest gaps between 17:47 and 18:40. No engine edit; nothing
is staged.

## Verdict

Windows can go into a ruleset after one small bot fix, and Jeff should take them knowing what they cost. The gate passes
on all ten seeds; the rate is back within 2% of the off arm (3.69 against 3.75); the carriers keep 94.5% of the cap's
pay and their profit per truck-week is the off arm's (owner-operators 2,067 against 2,134, fleets 2,042 against 2,032); the
prudent owner-operators fail no more than without windows (0.185 against 0.175 liquidated); a newcomer at Dallas earns
what it does today. What windows cost is volume, which is their design ("lost means lost"): 54% of posted loads are lost
at their close against the off world's 44% given up after ten rounds, so cleared loads are 7.5% fewer, the cap pays 13%
less for freight (its budget underspent by 111M over four years), FD in circulation ends a third lower (80M against
118M), and the imprudent bots fail more (greedy and random owner-operators 0.27–0.29 liquidated against 0.20, loan
defaults +62%). That is the "prudent businessmen win" the game asks for, at the price of a smaller economy. The one thing
still wrong is a bot rule: the bots buy 326 facilities a run and close all but three, because their payback test prices
the haul at the reference while under windows a facility pays its carriers the memory-lifted rate against a memory-free
sale value, so it loses on every load (§4). Fix that, confirm it on two seeds, and windows are ready for a ruleset.

## 1. The gate (batch 8 on, cap on, against its cap-off twin): 10 of 10

| Seed | Band, year 4 (trailing four, corrected) | Twin's own | Gap | Carriers Y3 · Y4, % of twin | Cleared/day Y3 · Y4, % of twin | Debt, % of FD held | Month 1 ÷ budget | Market purchases, % of pay |
|---|---|---|---|---|---|---|---|---|
| 1 | .892 .887 .898 .901 | .901 .909 .922 .923 | −.019 | 88 · 88 | 104 · 100 | 0.4 | 105% | 3.2 |
| 2 | .898 .900 .898 .904 | .896 .905 .905 .907 | −.004 | 95 · 92 | 108 · 106 | 0.4 | 79% | 2.5 |
| 3 | .891 .901 .903 .920 | .891 .897 .901 .919 | +.002 | 96 · 98 | 104 · 108 | 0.2 | 77% | 3.4 |
| 4 | .893 .892 .906 .916 | .899 .894 .908 .918 | −.003 | 100 · 99 | 103 · 101 | 0.2 | 102% | 3.1 |
| 5 | .885 .887 .896 .898 | .893 .893 .911 .919 | −.013 | 100 · 100 | 103 · 100 | 0.3 | 105% | 3.1 |
| 6 | .904 .913 .902 .900 | .888 .894 .901 .913 | +.006 | 83 · 84 | 115 · 102 | 0.4 | 67% | 3.0 |
| 7 | .889 .887 .893 .907 | .889 .897 .902 .914 | −.007 | 93 · 93 | 88 · 97 | 0.3 | 91% | 3.5 |
| 8 | .901 .902 .905 .909 | .886 .898 .909 .913 | +.002 | 89 · 89 | 110 · 102 | 0.3 | 77% | 2.7 |
| 9 | .895 .899 .911 .909 | .903 .908 .911 .907 | −.003 | 95 · 96 | 110 · 108 | 0.3 | 78% | 2.6 |
| 10 | .901 .912 .906 .923 | .885 .901 .900 .929 | +.007 | 90 · 91 | 94 · 99 | 0.3 | 68% | 3.5 |

Every line passes on every seed: the band 0.885–0.923 (the off arm reads 0.84–0.88: the companies keep less of a smaller
pay), carriers 83–100% of the twin's, cleared 88–115%, debt 0.2–0.4%, the cold start 67–105%, supply, the spread and the
free path; the market tripwire is quiet at 2.5–3.5%.

## 2. The market, on against off (ten seeds, 1460 days; means with the seed range)

| | Windows off (51d0a1d, nine rules on) | Batch 8 on | Batch 7 on (for the record) |
|---|---|---|---|
| Posted · cleared · lost (or given up off) | 813,676 · 448,291 · 44% given up | 906,780 · 414,684 (−7.5%) · 54% lost | 932,689 · 421,015 · 55% |
| Mean cleared rate · by year | 3.75 · 4.02 / 3.85 / 3.67 / 3.48 | **3.69** · 4.20 / 3.60 / 3.55 / 3.36 | 3.49 |
| The cap's paid freight · budget · days at the volume floor, M | 1,395 · 1,424 · 223 | 1,214 (−13%) · 1,325 · 89 | 1,144 · 1,300 · 42 |
| … spot · brokered · market purchases | 997 · 367 · 13 | 981 · 191 · 37 | 929 · 167 · 45 |
| **The carriers' share of the cap's pay** | 93% | **94.5%** | 94% |
| **Brokered share** | 26% | **16%** | 15% |
| **The fall-off, M · share of the cap's pay** | 26.6 · 1.9% | **20.5 · 1.7%** | 16.7 · 1.5% |
| **Facilities bought · standing at the end** | 24 · 0.2 | **326 · 2.6** | 385 · 2.6 |
| **Tenders passed up by the cover rule · to the board** | 0 · 234,127 | **0** · 329,089 | 0 · 348,273 |
| OO · fleet profit per truck-week | 2,134 · 2,032 | **2,067 · 2,042** | 1,747 · 1,646 |
| Owner-operators liquidated: greedy · random · conservative | 0.197 · 0.198 · 0.175 | 0.265 · 0.294 · **0.185** | 0.322 (mean) |
| Companies bankrupt (oo · fleet · broker) | 179 (77 · 43 · 27) | 210 (102 · 51 · 35) | 244 |
| Loan defaults · trucks seized | 200 · 111 | 323 · 208 | 425 · 268 |
| Trucks in service · owned at the end | 775 · 584 | 744 · 555 | 741 · 492 |
| FD in circulation at the end, M | 118 | 80 (−32%) | 72 |
| Booked ahead · on time · releases · no-shows · late | — · 0.721 | 81% · 0.760 · 1,260 · 582 · 305 | 80% · 0.758 |
| Free path, median first truck, days | 46 | 38 | 41 |

**The newcomer's month** (the test page's world, Dallas, six seeds; client batch 8b's world, so its level differs from
batch 7's run): 7,685 → 7,927 FD net (+3%) on 9.7 → 9.2 loads.

## 3. The lines, read

- **The rate:** back to the off arm's within 2%, the first year 4% over and the later years 3–6% under, as the two-seed
  check said; a steeper exponent would sharpen the first year more than it would lift the later ones.
- **The carriers' share (94.5%), the brokered share (16%), the fall-off (1.7%):** as batch 7: the brokers' leak is
  closed and the brokers are a small trade under windows.
- **The cover rule** still never fires and need not: the pricing does its work.
- **Volume is the cost of windows**, not a sizing miss: a load that cannot be made by its close is lost, so fewer clear
  (−7.5%), the cap pays for fewer (−13%), and the budget is underspent; the trucks that plan two deep earn as much as
  before, and the imprudent dispatchers that book thin fail more. FD in circulation falls by a third because fewer FD
  are paid out and the same sinks run; the report (EVE note §2) is where players would read it.
- **Facilities churn on (326 bought, 2.6 standing)**: the 26-week block slows the rebuilding at a hub but there are sixty
  hubs, and every facility built under windows loses money (a factory −12,945 a week, a warehouse −7,659), so each is
  closed at eight weeks and the next hub takes its turn.

## 4. The one fix before a ruleset: the bots' facility test reads the lifted haul

`ruleBots.ts chooseFacility` prices a facility's margin as `saleValueOfRef × (1 − posterFeePct) − ASSUMED_CLEARED_OF_REF
(1.0)` of a fixed reference: the goods sell at 1.18–1.2× the reference and the haul costs 1.0×. Under windows the goods are
priced on the memory-free reference (batch 5) and the haul pays the board's memory-lifted rate, ×1.2–1.7 at most hubs, so
the real margin is negative wherever the memory is above nothing, and the bots cannot see it. **The rule:** with windows
on, the haul's share reads the hub's lift, `ASSUMED_CLEARED_OF_REF × (the hub's reference with the memory ÷ the
memory-free reference)` for the facility's trailer, so a facility is bought only where the memory is quiet and the goods'
margin is real. The facilities' block stays as the backstop. A two-seed check after it (facilities bought and standing,
the market purchases, the band), then the ruleset; nothing else needs a rerun.

## What ran, and where

Three arms of ten seeds at 1460 days (batch 8 on, cap on; its cap-off twin; windows off), the gate (`gate-win8.json`),
and the newcomer's month, with batch 7's runner, in a scratch worktree at 51d0a1d. Nothing in the shared checkout changed
and nothing is staged; for the producer to place as studio/reviews/economy-delivery-windows-batch8.md.
