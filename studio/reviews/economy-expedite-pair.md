# Economy: early delivery for a fee, the pair (2026-11-10)

The ten-seed reading of `assets.expedite` as engineering built it (6754516 and the re-ruled driver guard 9b3bc62;
engineering-expedite-2026-11-10.md): a fee of 1.5% of the order's price per week saved, floor 300 FD, cap 9%; slots a
week at half the NPC queue's deliveries over the trailing four weeks, never under 2; the floor seven days; the bots
expedite a wait over 21 days when the fee is under what the wait costs (the loan payments running, the lessor's share,
and with `countsKeptPerTruck` what the company's trucks have each kept a week, guarded as the director ruled) and the
cushion after the fee holds; the fee a burn outside the cap's refill. The live profile with 0.24.1's nine switches on in
every arm, seeds 1–10 at 1460 days: the fee off; on with the kept term (the default); on without it; each against its
cap-off twin for the gate; in a scratch worktree at 9b3bc62, launched into clear vitest gaps between 11:54 and 13:05.
No engine edit; nothing is staged.

## Verdict, for Jeff

The fee works as a choice and barely exists as a sink. With the director's kept-per-truck term the bots' fleets
expedite about one order a fortnight (107 a run over four years, 8,900 FD each) and burn 958k FD a run: 20k a month on
average, 14k in year one and 9k in year four, about 0.07% of the cap's monthly freight budget and a third of the 50–60k
a month I gave Jeff. Without the term, 4 a run and 1k a month, nothing. The economy does not notice either way:
cleared loads, the rate, the carriers' profit, the fleets' size and growth, the first truck and the dealer's wait for
those who do not pay are the off arm's to within the spread, and the gate reads 9 of 10 in all three arms with the same
seed (7) at the band's floor in each, the fee included or not. The slot pool of 2 a week is never emptied by the bots
over a year, only in two boom months a run; the director's fault line stays clear. It is worth having as what it is,
an honest choice at a true date with a small burn; it is not the sink Jeff asked for, and nothing in its sizes makes it
one, because a fee only burns what fleets pay to grow and the fleets order about 210 rigs a year.

## 1. The gate (each arm against its cap-off twin)

| Arm | Pass | Band, lowest reading per seed (1–10) | Carriers Y4, % of twin |
|---|---|---|---|
| Fee off | 9 of 10 | .848 .859 .852 .848 .843 .854 **.838** .853 .859 .853 | 82–94 |
| Fee on, kept term | 9 of 10 | .854 .862 .853 .851 .853 .862 **.838** .847 .858 .853 | 77–92 |
| Fee on, no kept term | 9 of 10 | .850 .859 .851 .848 .841 .855 **.836** .850 .858 .850 | 80–93 |

Seed 7 fails the band's floor by two to four thousandths in every arm, the fee off included: the floor's own seed on
this code, as in the loan, swap and capital pairs. Every floor, the cold start, supply and the spread pass everywhere.
The fee is a burn (`sink:expedite`, in the burns, not in the day's sinks the refill reads), and the band does not move
with it (the kept arm reads a thousandth or two higher on seven seeds, inside noise).

## 2. The fee's lines (ten-seed means)

| | Fee off | On, kept term | On, no kept term |
|---|---|---|---|
| Expedites a run · by year | 0 | 107 · 19 / 34 / 42 / 11 | 4.4 · 0 / 0 / 4 / 0 |
| … by segment: free-path companies grown past their first truck · fleets · players · brokers | — | 47 · 59 · 0 · 0 | 1 · 4 · 0 · 0 |
| Fee each, mean | — | 8,939 | 12,504 |
| FD burned a run · a month on average · year 1 · year 4 | 0 | 958k · 20k · 14k · 9k | 61k · 1.3k · 0 · 0.2k |
| … the busiest month, mean (max) | — | 200k (277k) | 48k (82k) |
| Slots a week, mean (year 1) | — | 2.2 (2.0) | 2.2 (2.0) |
| Months with eight or more expedites (the 2-slot pool full every week) | — | 2.2 of 48 | 0 |
| The dealer's wait for those who do not pay, year 1 · year 4, days | 33.5 · 33.1 | 33.1 · 33.0 | 33.5 · 33.3 |
| Orders a run | 841 | 846 | 840 |

- **Who expedites:** fleets, and the free-path companies that have grown to a second new rig (their first is a lot rig,
  from stock, never expeditable), on the kept term alone: the loan's payments and the lessor's share never clear the fee
  by themselves (4 a run without the term). With the term a company with four weeks of books and a driver for the
  truck reads what its trucks keep a week, 1,000–2,000 FD each, against a fee of 1.5% a week saved on a 60–120k rig
  (900–1,800), and says yes on the longer waits (21 days and over, the floor; the queue's wait is 33 days at steady
  state, so the saving is three to four weeks). Engineering's one-year, one-seed read (13 at 10.6k) is the same world.
- **The slots** at 2 a week (the NPC queue delivers 1.8 a week over the ten seeds, so the floor rules) take 107
  expedites over 208 weeks: a quarter of the pool. The pool runs dry only in a boom month or two a run (200k of fees
  in the busiest month, 8+ expedites), which is the reading the director wanted: no week of the year where a player
  finds the pool emptied by bots.
- **Nobody else's wait moves:** 33 days in every arm; the queue is short of the slots' reach.

## 3. The market (ten-seed means; the three arms)

| | Fee off | On, kept | On, no kept |
|---|---|---|---|
| Cleared · rate | 448,291 · 3.75 | 451,990 · 3.76 | 446,004 · 3.76 |
| NPC faucets in all, M | 1,755 | 1,746 | 1,747 |
| OO · fleet profit per truck-week | 2,134 · 2,032 | 2,081 · 2,013 | 2,133 · 2,023 |
| Fleets' trucks at the end · owned trucks · equipment sinks, M | 358 · 584 · 189 | 345 · 580 · 193 | 351 · 578 · 188 |
| Companies bankrupt · OO liquidated | 179 · 0.190 | 178 · 0.192 | 178 · 0.194 |
| First truck: free path median · greedy · random · conservative | 46 · 37 · 49 · 148 | 46 · 37 · 49 · 149 | 46 · 37 · 49 · 148 |
| Loan defaults | 200 | 212 | 204 |
| Supply at the end, M | 117.7 | 114.7 | 116.3 |

Every line sits inside the seeds' spread. The kept arm's owner-operators read 2.5% under on profit per truck-week with
the fleets 1% under: the fee is paid by the companies that grow, and it is their money; nothing points the other way.

## 4. The three things, for Jeff

1. **A sink worth having, or a choice that burns little?** A choice that burns little: 20k FD a month with the kept
   term, 1k without, against a season close that burns tens of millions and exchange fees in the hundreds of thousands.
   It is worth having for what the director built it for: the date is true, the trade-off is honest, Iuliia can price
   it, and a player who hauls can buy the weeks. He asked for a sink; this is not one.
2. **If it is to be bigger:** no size in the block makes it one. The fee's share cannot rise: at 1.5% the bots already
   take only the waits their books justify, and 2.5% halves the take and the burn with it. The slot floor is not binding
   (a quarter taken). The 21 days keeps bots off the short waits, where the fee is under the floor anyway; 14 would add
   a few hundred FD a run. What the bots count is the director's ruling and it is right as built (the kept term is the
   whole take-up). The burn is bounded by the fleets' orders: 210 rigs a year at a 9% cap on a 115k rig is 2.2M a year
   if every order expedited, and a fifth of them do. A real sink of that kind would have to sit on something every
   company pays, not on the growers' impatience. The producer's three calls are right: the cushion mirrors canCarry
   (the bots keep their two months), the slots count the NPC queue only (the floor of 2 carries it), the fee is an
   operating cost in the books and out of weekly spending under `capitalNotSpending`.
3. **The fleets' growth:** nothing I would not want. The fleets end the same size (345–358 trucks against 358), order
   the same (846 against 841), and the expedited rigs arrive three to four weeks sooner for the companies whose books
   say the truck pays; loan defaults 212 against 200 are inside the spread, and the band does not read it. The one
   thing to watch on the live world is players: a human fleet will expedite more freely than a bot reading its books,
   and the pool is theirs first-come with the bots, which at a quarter taken leaves room.

## What ran, and where

Six arms of ten seeds at 1460 days (the fee off, on with the kept term, on without; each with its cap-off twin),
`_wsim.ts` with a tap on every fee paid (day, segment, amount) and the slots a week, the gate over each pair
(`gate-off/kept/nokept.json`), in a scratch worktree at 9b3bc62; kept at
the economy's scratchpad
and the worktree removed. Nothing in the shared checkout changed and nothing is staged; for the producer to place as
studio/reviews/economy-expedite-pair.md.
