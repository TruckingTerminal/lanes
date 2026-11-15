# Economy: a replacement entrant for the AI brokers, sized (2026-11-15)

This is information for the director and Jeff, not a build.

**The question.** With the wind-up rule (economy-broker-windup-2026-11-15.md), a dormant AI broker leaves the market.
Without entry, the layer only shrinks. What would a rule that replaces them do?

**The setup:**
- 0.25.1's live profile (b8e3799), with a scratch build of both rules in a scratch worktree (lanes-g22).
- Two seeds, four years.
- An entrant comes in like one of the opening's brokers:
  - the company starting grant and a 75,000 FD licence stake, both from `faucet:starting_grant`;
  - a USD wallet drawn as the opening's;
  - a persona drawn from the three;
  - the opening's vetting draw;
  - new authority.
- **The rule:** one enters a set delay after each wind-up, until 60 trade again.

## What it shows

| Two seeds, four years | Today (no wind-up) | Wind-up alone | **Wind-up + entrant at 60 days** | **Wind-up + entrant at 180 days** |
|---|---|---|---|---|
| AI brokers trading at each year's end | about 27, then 25 (dormant ones restart through liquidation) | 39.5 / 21.5 / 21 / 21 | **52 / 59 / 60 / 60** | **40.5 / 59.5 / 60 / 60** |
| Wound up (prudent · random · greedy), all in years 1–2 | — | 20 · 14.5 · 4.5 | 21.5 · 14.5 · 7.5 | 21 · 13 · 3.5 |
| Entrants (prudent · random · greedy) | — | — | 15.5 · 13 · 15.5 | 15 · 12 · 10.5 |
| Entrants that fail again | — | — | **5 of 44** (prudent 1.5, random 0.5, greedy 3) | **1 of 37.5** |
| Liquidation repeats, years 3–4 | 10 · 13.5 | 0 · 0 | 0 · 0 | 0 · 0 |
| AI brokers' margin, years 2–4 | +6.6 / +5.7 / +7.7% | +6.8 / +5.7 / +6.9% | +6.5 / +5.9 / +8.4% | +7.4 / +6.8 / +8.6% |
| Their revenue, years 1–4 (M) | 38 / 40 / 69 / 70 | 38 / 42 / 62 / 64 | 39 / 58 / 68 / 68 | 38 / 52 / 74 / 67 |
| Brokered share of loads | 21.5% | 20.3% | 21.7% | 22.2% |
| Owner-operators' · fleets' profit per truck-week | 1,719 · 1,606 | 1,719 · 1,566 | 1,748 · 1,551 | 1,731 · 1,555 |
| Starting grants over four years (M) | 9.71 | 9.69 | **13.21 (+3.5)** | **12.66 (+3.0)** |
| FD in circulation at the end (M) | 86.4 | 83.8 | 89.1 | 87.3 |

## Reading it

- **The opening year is the shake-out, and entry after it mostly holds.**
  - The opening's prudent brokers (7% margin) and half the random ones go dormant in year 1, in the opening boom.
  - An entrant comes into the calmer market after it, and most survive: 5 of 44 fail again at 60 days, 1 of 37.5 at
    180.
  - A careless entrant still can fail; the greedy ones that entered in the opening year did, at 60 days.
- **The wind-up rule alone shrinks the broker layer** to about 21 trading from year 2. Brokered revenue in years 3–4
  runs about 9% under today's. Today a dormant broker comes back through a liquidation's restart; wound up, it doesn't.
  The wind-up pair will show this cost, and entry is what offsets it.
- **The market barely feels entry.**
  - The brokered share of loads is 21.7–22.2% against 21.5%.
  - The brokers' margins are as today's.
  - Carriers' profit is within two seeds' noise: owner-operators +1–2%, fleets −3% against today, the same as the
    wind-up alone.
- **The FD it costs is the entrants' grants:** about 80,000 FD each, 3.0–3.5M over four years, about 2% of what the cap
  releases. Two seeds read the end's FD in circulation within 1–3M of today.
- **The delay is a design choice:**
  - **At 60 days** the layer is back to 52 by the end of the opening year.
  - **At 180 days** the opening's shake-out shows for a season, at 40 trading, and the layer is full by year 2.
  - A real brokerage takes months to set up (authority, bond, shippers), so 90–180 days reads truer than 60.
- **A suggested shape, if wanted:**
  - one AI broker enters 120 days after each wind-up, until 60 trade;
  - the opening's kit: grant, licence stake, wallet, a persona from the three;
  - new authority, so shippers' credit preference starts it small.

  It needs its own ten-seed pair, since it moves FD supply and brokered volume, and it rides with or after the
  wind-up.

## Caveats

- Two seeds only. The figures are directions, not sizes for a gate.
- The scratch wind-up is my condition (economy-broker-windup-2026-11-15.md), not engineering's build. The pair on the
  real build will settle the wind-up's own figures.
