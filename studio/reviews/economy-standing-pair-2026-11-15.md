# Economy: standing with a shipper, the pair (2026-11-15)

The pair is on engineering's build at d6a4afa (engineering-standing-2026-11-15.md): `standing.enabled` on against off,
on 0.25.1's live profile. It ran ten seeds, 1,460 days, each arm with its cap-off twin, plus the newcomer's month at
Dallas on the 24 seeds used for 0.25.1.

## Verdict

**Within the spread on every line. Standing can ride.** The red team's S3 doesn't materialize: the newcomer's month
doesn't fall, so `firstCallMaxShare` stays 1.

One size is still open: the hit for a passed first call. A small probe is queued, and the answer follows here.

- **The gate passes 10 of 10.** The worst carriers read 84·79 (seed 7), against 85·84 off; the band is 0.886–0.914.
- **Every line is inside the spread:**
  - bankruptcies 142.6 against 138.2;
  - owner-operators' profit per truck-week 1,694 against 1,707, fleets' 1,621 against 1,598;
  - cleared loads +0.9%, the rate −0.3%;
  - liquidations by persona and the free path unchanged.
- **S3: the newcomer's month is 9,273 FD on 9.3 loads, against 8,538 on 9.4** (median 9,280 against 7,027), over 24
  seeds. First call ranks above the locals-first hold, but it reaches only tier-7+ carriers within 150 miles with a
  truck that can make the load, and those are mostly fleets. The newcomer at Dallas keeps its loads.
- **The perks are used as sized:**
  - dock priority on about 400,000 stops a run;
  - about 69,000 net-15 bills;
  - about 2,390 first calls offered;
  - 52 dedicated lanes offered over four years, about one active at the end.

## The open size: a passed first call's hit (engineering's reading 2)

**Bots pass 94% of first calls:** 2,239 of 2,388 offered a run, 148 taken.
- A first call reaches a carrier as the load is posted. The bot's dispatcher answers it with its ordinary pricing (the
  economy's rule, "accept when the dispatcher would have bid"), and at a fresh posting's price it rarely would.
- Each pass costs the holder a hit of 1 load (`standing.hits.declinedFirstCall`).
- A tier-7+ company sees about six first calls a year, so the passes cost it about six loads a year against floors of
  10–30.

**My lean is 0.25:**
- A first call is an offer. Passing one that doesn't pay is a carrier's right, and four passes then cost what one late
  delivery does.
- The hit's purpose stands: a carrier that holds the privilege and never serves it still slips.

The probe compares 0.25 and 0 on two seeds: tiers reached, first calls taken and the market's lines. If neither moves
the tiers, the size is the director's call on feel.

## The other readings, from the economy's side

1. **"Claim" is a cargo claim; a late delivery is −1.** Fine. Under windows the hits carry the score, since on time
   runs near 100%.
3. **Dock priority at every stop in the market.** Fine: 30 minutes off a dwell, on about 400,000 stops a run, moves no
   line.
4. **Net-15 halves the factor's discount.** Fine: about 69,000 bills a run, and the carriers' finance lines don't move.
5. **The on-time floors** are inert under windows, as engineering says. Keep the economy's table; it binds only if
   windows go off.
6. **The dedicated lane's 3 a week, 182 days, 28 days.** Keep them. Tier 10 is rare: about 1–8 fleets at once, none of
   them one-truck. 52 offers in four years and about one lane active at the end make it a capstone, as the director
   meant.
7. **First call's reach of 150 miles, and the share cap at 1.** Keep both: S3 is answered.

**One observation, not a size.** The weekly review moves scorecards a lot: about 236,000 steps up, 213,000 down and
141,000 decays a run, across the companies' market scorecards. They bounce at their floors as loads enter and leave the
180-day window. A player's trend line will flicker by a tier. If the director wants it steadier, a step down only after
two reviews below the floor would do it, and it moves no money.

## Where carriers stand (ten-seed means, each company's best tier)

| Day | One-truck carriers, tiers 1–10 | Fleets, tiers 1–10 |
|---|---|---|
| 364 | 1 · 3 · 15 · 149 · 80 · 27 · 4 · 1 · 0 · 0 | 0 · 0 · 0 · 5 · 19 · 33 · 34 · 32 · 20 · 8 |
| 728 | 1 · 4 · 22 · 106 · 56 · 17 · 4 · 1 · 0 · 0 | 0 · 0 · 0 · 8 · 21 · 41 · 42 · 27 · 6 · 1 |
| 1,365 | 3 · 12 · 34 · 87 · 34 · 9 · 2 · 1 · 0 · 0 | 0 · 0 · 0 · 3 · 15 · 38 · 48 · 37 · 9 · 1 |

**Reading it:**
- An owner-operator lives at tiers 4–5: dock priority and net-15. A few reach first call (tier 7).
- A fleet lives at tiers 6–8, and a handful at 9–10.
- The ladder's top is a fleet's.

## The lines (ten-seed means; the range across seeds in brackets)

| 0.25.1's live profile | Standing off | **Standing on** |
|---|---|---|
| Gate | 10 of 10; worst 85·84 | **10 of 10; worst 84·79 (seed 7)** |
| Band, year 4 | 0.886–0.912 | **0.886–0.914** |
| Pay per truck-week | 7,125 | **7,136** |
| Owner-operators' profit per truck-week | 1,707 [1,635–1,783] | **1,694** [1,650–1,752] |
| Fleets' profit per truck-week | 1,598 [1,483–1,670] | **1,621** [1,458–1,729] |
| Cleared loads · rate | 412,210 · 3.631 | **415,769 · 3.621** |
| Companies bankrupt (OO · fleet · broker) | 138.2 (73.6 · 20.6 · 21.6) | **142.6 (76.7 · 20.9 · 21.2)** |
| OO liquidated: greedy · random · prudent | .205 · .208 · .136 | **.215 · .215 · .138** |
| Fleets liquidated: greedy · random · prudent | .198 · .175 · .143 | **.185 · .182 · .155** |
| Loan defaults · trucks seized | 211 · 155 | **212 · 156** |
| Claims: late · no-show · cancel | 312 · 568 · 1,296 | **309 · 573 · 1,281** |
| FD in circulation, year 4 (M) | 84.2 | **83.9** |
| Median days to a first truck · first truck within a year | 38.0 · 354 | **38.0 · 357** |
| Newcomer's month, 24 seeds (mean · median) | 8,538 · 7,027 FD on 9.4 loads | **9,273 · 9,280 FD on 9.3 loads** |

## How it ran

- **The worktree:** a scratch worktree at d6a4afa (lanes-standing), from the gated pair script, 04:59–05:47.
- **The newcomer's month:** the test page's world (`GAME_CONFIG` at d6a4afa), with standing on or off in memory, at
  05:52.
- **The off arm** is the live profile as it is. Engineering's digest with the switch off is 995612c74cb2a3b7.

Nothing in the shared checkout changed and nothing is staged.
