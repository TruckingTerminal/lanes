# Economy: capital purchases out of a week's spending, the pair (2026-11-10)

The two-seed reading of `ledger.capitalNotSpending` (5a38fc1, off by default: on, the outflows that feed
`Company.weeklySpend` leave out `buy:`, `facility:`, `business:` and `listing:` refs; the five readers unchanged). On
against off with 0.24.1's set on in both arms (the collateral rule on the authority's age, the starter's lot rig from
stock, the swap at the next idle), seeds 1–2 at 1460 days, the on arm's cap-off twin for the gate; and the guide's
cushion for a company the week after it buys a truck, on the test page's world; in a scratch worktree at 5a38fc1,
launched in a clear vitest gap at 09:19. No engine edit; nothing is staged.

## The finding first

**It does what the weekly-spend note asked, moves nothing else, and lifts the band a hair.** The week after an
owner-operator buys its first truck on a loan, the cushion reads 0.8–1.9 weeks instead of 0.1–0.5, because the week's
spending the guide averages reads 3.4–5.1k instead of 15–17k (the truck's price out of it), and the Reserve's cap for
that company reads 44–77k instead of 196–228k (engineering's 215k → 46k). The economy on the two seeds is the off
arm's: cleared 445k → 446k, the rate 3.77 → 3.77, the cap's paid freight 1,392M → 1,404M, bankruptcies 181 → 173,
owner-operator profit per truck-week 2,153 → 2,150, liquidations 0.206 → 0.205. The gate passes two of two, with the band
0.848–0.862 against the same seeds' 0.841–0.853 with the switch off: seven thousandths up, as the note predicted (less
cash sheltered, more of it spent or met by the holding cost). **Ride in 0.24.1 as the ninth switch.** It changes a figure
players read, so if Jeff wants it by name: the cushion the week after a truck purchase reads one to two weeks instead of
nought, true to that week's bills; the economy unchanged, two of two on the gate.

## 1. The gate (on, cap on, against on, cap off): two of two

| Seed | Band, year 4 (trailing four) | Twin's own | Gap | The same seed with the switch off (the swap pair) | Carriers Y3 · Y4, % of twin | Cleared Y3 · Y4, % of twin |
|---|---|---|---|---|---|---|
| 1 | .850 .848 .851 .850 | .863 .862 .868 .858 | −.013 | .844 .845 .841 .847 (gap −.024) | 80 · 82 | 94 · 95 |
| 2 | .859 .862 .860 .860 | .876 .870 .864 .856 | −.006 | .851 .853 .849 .853 (gap −.017) | 84 · 87 | 102 · 101 |

## 2. The readers

| Seeds 1–2, means | Off | On |
|---|---|---|
| The holding cost sink (after launch), M FD | 2.33 | 2.05 |
| The season's burn | 0 (seasons off on live) | 0 |
| The Reserve: held at the end · deposited · withdrawn · its holding cost · burned, M | 3.81 · 35.2 · 24.9 · 0.33 · 0.35 | 4.04 · 37.4 · 26.6 · 0.36 · 0.43 |
| Who holds it: conservative owner-operators · conservative fleets · conservative newcomers (holders, mean held) | 44 (14.5k) · 20.5 (27.6k) · 31 (11.4k) | 51 (17.0k) · 19.5 (24.6k) · 29 (12.1k) |
| The Reserve's cap at the end, conservative owner-operators · fleets (a mean over companies) | 82k · 200k | 88k · 185k |
| Owned trucks at the end | 535 | 606 |
| Loan defaults | 198 | 188 |
| Free path, median first truck | 44.5 | 42.5 |

The Reserve at the end of four years holds the same money with the same holders (only the conservative personas use
it); what the switch removes is the month-long spike in a company's cap after a purchase, which nobody was holding
against anyway. The one line that moves on two seeds is owned trucks, 535 → 606: with less cash sheltered from the
holding cost, the prudent bots put it into equipment sooner, and the band reads the sinks. The bots' locks are not in
the report; the prudent floor reads two weeks of the same list, so it stops jumping after a purchase as the cushion
does.

## 3. The cushion the week after a truck (the test page's world, 0.24.1's set on, six seeds)

An owner-operator joins at Dallas after the warm start on the players' dispatcher and buys the lot's rig on a loan the
day the Dealer's route opens (days 28–74, 6.6–10.3k out at signing); then each week:

| Seed | Bought on day | Cushion, weeks 1–4 after: off | On | The guide's weekly spending, week 1: off → on | The Reserve's cap, week 1: off → on |
|---|---|---|---|---|---|
| 11 | 47 | 0.2 / 0 / 0 / 0 | 0.8 / 0 / 0 / 0 | 16,348 → 3,806 | 212,519 → 49,472 |
| 23 | 28 | 0.3 / 0.1 / 0 / 0 | 1.1 / 0.7 / 0.1 / 0 | 17,195 → 5,122 | 223,530 → 66,585 |
| 37 | 48 | 0.1 / 0 / 0 / 0 | 1.5 / 0.9 / 0.4 / 0 | 15,948 → 3,434 | 207,324 → 44,638 |
| 41 | 46 | 0.5 / 0.4 / 0 / 0 | 1.9 / 1.4 / 0 / 0 | 16,398 → 4,393 | 213,179 → 57,107 |
| 59 | 60 | 0.3 / 0.2 / 0 / 0 | 1.4 / 0.8 / 0.2 / 0 | 15,079 → 3,427 | 196,022 → 44,546 |
| 73 | 74 | 0.3 / 0.6 / 0.2 / 0 | 1.9 / 1.5 / 0.2 / 0 | 15,849 → 3,952 | 206,034 → 51,375 |

The zeros in weeks 2–4 are the company's cash at nought while its first loan payments and the new truck's costs run,
in both arms; what the switch changes is the figure's denominator, which now reads the company's bills. By week 8 the
cushions read 2–21 weeks on, 0–42 off, the off figures swinging with the purchase leaving the four-week window.

## What ran, and where

Three arms of two seeds at 1460 days (on cap on, on cap off, off), the gate (`gate-cns.json`), and the cushion probe
(`_cushion.ts`), in a scratch worktree at 5a38fc1; kept at
the economy's session scratchpad
and the worktree removed. Nothing in the shared checkout changed and nothing is staged; for the producer to place as
studio/reviews/economy-capital-spending.md.
