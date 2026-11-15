# Economy: the AI broker wind-up, the pair (2026-11-15)

The pair is on engineering's build at 111ac43 (cbfe305; engineering-bus-home-2026-11-15.md §10):
`brokerRisk.windUpDormant` on against off, on 0.25.3's profile (the seven 0.25.3 switches on under both arms). It ran
ten seeds, 1,460 days, each arm with its cap-off twin. It is for Jeff with the broker-entry proposal
(economy-broker-entry-2026-11-15.md).

## Verdict

**It does what it was built to do, and the carriers don't feel it. It is ready for Jeff's decision on entry.**

- **The gate passes 10 of 10.** The worst carriers read 80·82 (seed 7), against 83·86 off; the band is 0.882–0.912.
- **The carriers are untouched:**
  - owner-operators' profit per truck-week 1,694 against 1,691, fleets' 1,645 against 1,650;
  - cleared loads −0.4%, the rate the same;
  - owner-operators' and fleets' bankruptcies the same (77.4 against 77.4, 21.0 against 19.8).
- **The repeated liquidations are gone.** AI broker liquidation events fall from 27 a run (rising: 0.1 / 3.2 / 9.6 /
  14.1 a year) to 0.1. Dormant brokers no longer drain into one liquidation after another.
- **Bankruptcies rise from 138 to 163, all of it brokers** (44 against 21), and that is by construction.
  - A dormant broker that never formally went under (it sat on a little cash, paying the surety) is now wound up and
    counted once.
  - The count now tells the truth: about 44 of the 60 AI brokers end dormant in four years, as the wind-up study found
    (economy-broker-windup-2026-11-15.md).
  - On the gate's bankruptcy line it reads as a rise, but it is the brokers' line made honest, not more failures.
- **The surety premium halves** (0.29M → 0.14M): a wound-up broker no longer pays it.
- **The brokered share of loads falls** from 19.7% to 18.4%, and brokered pay per mile is 3.444 against 3.462. Without
  entry, a dormant broker no longer comes back through a liquidation's restart. The layer stays thin, which is the cost
  the entry proposal answers.
- **The brokers' margin is unchanged:** −8.3 / +5.9 / +5.5 / +6.7% by year, against −8.3 / +5.7 / +5.1 / +7.0%.

**For Jeff, the two go together.** The wind-up makes the broker layer's count true, and entry by conditions refills it.
Wound up without entry, the layer settles at about 16–20 trading brokers. With entry at 1.5× flow and 5% margin, it
holds near 60 (two seeds, the entry study).

## The lines (ten-seed means; the range across seeds in brackets)

| 0.25.3's profile | Off | **On** |
|---|---|---|
| Gate · worst carriers · band | 10 of 10 · 83·86 · 0.881–0.922 | **10 of 10 · 80·82 · 0.882–0.912** |
| Companies bankrupt (OO · fleet · broker) | 138.4 (77.4 · 19.8 · 21.4) | **162.6 (77.4 · 21.0 · 44.1)** |
| AI broker liquidation events (by year) | 27.0 (0.1 / 3.2 / 9.6 / 14.1) | **0.1** |
| Surety premium · bankruptcy write-offs (M) | 0.29 · 1.24 | **0.14 · 1.20** |
| AI brokers' margin, years 1–4 | −8.3 / +5.7 / +5.1 / +7.0% | **−8.3 / +5.9 / +5.5 / +6.7%** |
| Brokered share of loads · pay per mile | 19.7% · 3.462 | **18.4% · 3.444** |
| Fall-off charges (M) | 17.6 | **16.3** |
| Owner-operators' · fleets' profit per truck-week | 1,691 · 1,650 | **1,694 · 1,645** |
| Cleared loads · rate | 415,946 · 3.632 | **414,405 · 3.633** |
| Loan defaults · trucks seized | 204 · 154 | **210 · 153** |
| FD in circulation, year 4 (M) | 83.2 | **82.9** |

## How it ran

- **The worktree:** a scratch worktree at 111ac43 (lanes-windup), from the gated pair script with pauses between
  waves, 13:12–14:38 (held behind §18 and §15).
- **The base:** the seven 0.25.3 switches. **On:** `brokerRisk.windUpDormant`.

Nothing in the shared checkout changed and nothing is staged.
