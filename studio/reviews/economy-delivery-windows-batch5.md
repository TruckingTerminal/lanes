# Economy: delivery windows, batch 5 on the ten seeds (2026-11-10)

The third reading of item 4, on engineering's batch 5 (f666d04; engineering-windows-batch5-2026-11-10.md): the
memory's clamp at `windows.ratioClampTop` 6 while windows are on, and a facility's goods priced from the reference
without the lost-load memory. Windows on against off on the live profile, the gate's ten seeds (1–10, 1460 days), the
windows-on cap-off twin, the carriers' cash flows on two seeds, the trucker's month, the first board, and the
clears-near probe the director asked for; in a scratch worktree at f666d04, launched into clear vitest gaps between 08:48
and 09:18. The targets from the batch 4 review: the off arm's cleared loads, NPC freight pay and rate within its seed
range; the carriers' share of the cap's pay at 90% or better; their profit per truck-week, the fleets' truck count and
loan defaults within the off arm's range. No engine edit; nothing is staged.

**On the off arm.** The determinism fix of 0.24.0-phase0.41 (the road network built with dmath's dcos; a lane moves in
the last bit) replays a world differently from c915f72, so the ten-seed off run of the first sizing is no longer this
code's off world: on f666d04 seeds 1 and 2 read 432k and 444k cleared against 454k and 454k. The tables below keep the
c915f72 off arm as the baseline, labelled, with the two f666d04 seeds beside it; the other eight are queued behind the
capital-spending pair and the figures will be refreshed, but every delta here is many times that shift.

## The finding first

**The price is back and the carriers are not: batch 5 fails the gate on every seed, and the band falls further.** The
clamp's top does what the batch 4 review asked: the mean rate is 3.67 against 3.73 off, the cap's paid freight 1,335M
against 1,381M (−3%), cleared loads 410k against 447k (−8%), fill 0.47. But the carriers' freight income per truck-week
is still 12.6% under the off arm's (6,732 against 7,702; their share of the cap's pay about 85% against 94%), the
owner-operators' liquidated share rises to 0.303 (batch 4: 0.273; off: 0.187), companies bankrupt 259 (185), loan
defaults 424 and seizures 294 (175 and 85), owned trucks 460 (574), the fleets' profit per truck-week −28% and the
owner-operators' −11%. The gate: 0 of 8 (two twins died on an engine error, §1), the band at 0.79–0.83 on every seed
with the twins at 0.75–0.80, against batch 4's 0.82–0.86 and the off arm's 0.84–0.87: the economy under windows now
retains a fifth of what it is paid.

**The two leaks are bot rules under windows, not sizes.** The cash flows and the reports put the carriers' missing 9
points of the cap's pay in two places that the price could not reach:

1. **AI brokers accept tenders they cannot cover.** With the memory lifting the contract index and the same-day
   premium on their contracts, the brokers' bonds grow and they take twice the tenders: brokered pay is 867M of the
   cap's 1,335M (65%; off 363M of 1,381M, 26%), their lost loads at the close cost 97M of fall-off (7.3% of the cap's
   pay; off 26M, 1.9%), and 31 of the 60 go under (off 24). The fall-off is the biggest single leak and it is burned,
   not kept.
2. **The bots build facilities that lose money, and the cap buys their goods.** `ruleBots.ts chooseFacility` reads
   the chance a facility load is hauled as `1 − (1 − fillRate)^giveUpAfterRounds`: ten rounds of chances, which is
   today's slide and not a window's two to four rounds of life. Under windows that reads 99% covered at a fill of 0.47,
   so the bots build 69 facilities a run against none standing at the end off (47 of them the AI brokers', 8 fleets', 8
   owner-operators'), every type runs at a loss (a warehouse −4,700 a week, a cold store −6,800, a factory −8,000, their
   loads lost at the close like everyone's), facility freight is 18–23% of all loads, and the NPC market buys 90M of
   their goods inside the cap's budget (6.7% of its pay; the gate's 5% tripwire trips on every seed at 5.7–7.4%). Batch
   5's memory-free sale value is right and changed nothing here (69M → 90M), because the leak is the count of facilities,
   not the price of a load of goods.

Together the two take 14 points of the cap's pay off the carriers' hauls; the brokers' own margin is small (12M of
revenue a run). **What I want from engineering is batch 6, two bot rules behind the same switch (§3), the engine error
fixed (§1), and then the ten seeds again. Windows stay out of 0.24.1, which proceeds with its eight switches.**

## 1. The gate (batch 5 on, cap on, against its cap-off twin): 0 of 8

| Seed | Band, year 4 (trailing four, corrected) | Twin's own | Gap | Carriers Y3 · Y4, % of twin | Cleared/day Y3 · Y4, % of twin | Month 1 ÷ budget | Market purchases, % of pay (tripwire 5%) | Gate |
|---|---|---|---|---|---|---|---|---|
| 1 | .826 .811 .807 .815 | .771 .754 .765 .794 | +.044 | 93 · 94 | 104 · 103 | 91% | 7.4 | FAIL |
| 3 | .791 .795 .799 .804 | .775 .775 .772 .787 | +.020 | 109 · 111 | 100 · 99 | 71% | 7.1 | FAIL |
| 4 | .824 .813 .803 .818 | .770 .759 .762 .796 | +.043 | 93 · 94 | 111 · 105 | 90% | 6.5 | FAIL |
| 5 | .832 .810 .788 .802 | .765 .747 .749 .767 | +.051 | 85 · 85 | 115 · 101 | 92% | 5.7 | FAIL |
| 6 | .814 .817 .834 .821 | .784 .773 .773 .769 | +.047 | 100 · 100 | 110 · 102 | 63% | 7.4 | FAIL |
| 8 | .831 .823 .819 .808 | .797 .773 .781 .779 | +.037 | 93 · 94 | 119 · 93 | 72% | 6.5 | FAIL |
| 9 | .823 .806 .806 .809 | .792 .767 .776 .768 | +.035 | 97 · 96 | 108 · 86 | 73% | 6.1 | FAIL |
| 10 | .832 .834 .813 .798 | .785 .785 .770 .779 | +.040 | 94 · 93 | 116 · 103 | 63% | 7.2 | FAIL |

- **The twins of seeds 2 and 7 died** at `ledger.ts` 115, `Ledger entry to itself (co:460)`, called from
  `fraud.ts settleDoubleBroker`: under windows with the cap off a double-brokered load's settlement pays a company from
  itself. An engine error for engineering before the next run; the cap-on arm ran all ten.
- **The floors pass and mean nothing here:** the twin is more starved than the capped world (carriers 85–111% of the
  twin's), as in the first sizing. **The band fails everywhere,** 0.79–0.83, and for the first time the capped world
  reads above its twin by 2–5 points: the subsidy is now a larger part of a smaller economy, and the money that leaves
  the carriers sits where little of it is spent (the brokers' bonds and the facility owners' goods).
- **The identity of the off arm** holds at f666d04 for the switch (engineering's digest); the world differs from
  c915f72 by the determinism fix, as said above.

## 2. The market, on against off

| Ten-seed means | Windows off (c915f72; f666d04 seeds 1–2 beside) | Batch 5 on | Batch 4 on, for the record |
|---|---|---|---|
| Posted · cleared · fill | 809,680 · 447,469 · 0.553 (f666d04: 432k, 444k cleared) | 878,295 · 409,714 · 0.467 | 941,351 · 425,415 · 0.453 |
| Lost at the pickup's close, share of posted | — | 469,141, 53% | 55% |
| Mean cleared rate · direct idle · booked ahead, FD/mi | 3.73 · 3.73 · — | 3.67 · 3.34 · 3.79 | 3.46 · 3.31 · 3.51 |
| The cap's paid freight, M · spot · brokered · contract · market | 1,381 · 991 · 363 · 19 · 14 | 1,335 · 391 · 867 · 5 · 90 | 1,207 · 432 · 721 · 3 · 69 |
| Brokered loads · direct loads | 100,716 · 337,058 | 191,099 · 152,046 | 197,469 · 182,943 |
| Fall-off sink, M · AI brokers liquidated | 26 · 24 | 97 · 31 | 72 · 28 |
| Facilities standing at the end · facility share of loads | 0 · 0.4–2.5% | 69 · 18–23% | 55 · |
| Carriers' freight income per truck-week (two seeds, 730 d) · share of the cap's pay | 7,702 · 94% | 6,732 · ≈85% | 6,690 at clamp 6 · 81% |
| OO · fleet profit per truck-week | 2,063 · 2,099 | 1,836 · 1,519 | 1,606 · 1,309 |
| Owner-operators' liquidated share: greedy · random · conservative | 0.211 · 0.175 · 0.176 | 0.352 · 0.383 · 0.173 | |
| Companies bankrupt (oo · fleet · broker) | 185 (75 · 46 · 30) | 259 (124 · 71 · 31) | 243 (118 · 66 · 28) |
| Loan defaults · trucks seized · owned trucks at the end | 175 · 85 · 574 | 424 · 294 · 460 | 407 · 288 · 457 |
| Supply at the end, M FD | 119 | 135 | 106 |
| On time · booked ahead · releases · no-shows · late | 0.724 · — · — · — · — | 0.780 · 73% · 1,084 · 511 · 274 | 0.775 · 74% · 1,354 · 618 · 320 |
| Days at the cap's volume floor | 235 | 143 | 51 |

The prudent owner-operator is unharmed (0.173 liquidated against 0.176) and the greedy and random are destroyed (0.35
and 0.38 against 0.21 and 0.18): the same sorting the starters pair showed, three times harder, because a truck booked
two deep at the opening price on a thinner board is where an imprudent dispatcher fails fastest. The supply ends higher
(135M against 119M) with the carriers poorer: the money is retained by the brokers' bonds and the facility owners, which
is the band's dip read a second way.

**The trucker's month at Dallas** (the test page's world on f666d04, both arms): 14,552 → 10,524 FD net (−28%), 12.5 →
9.3 loads. Batch 4 read +15% against c915f72's world; on this world the newcomer's dispatcher finds fewer loads it can
make and win at Dallas, where the board is a third thinner (the first board: rounds with a paying load DAL 83% → 68%,
PHX 64% → 51%, MEM 54% → 55%, CHI 92% → 100%, LAX 94% → 99%; the median best margin at DAL 1,215 → 379, PHX 192 → −68).

## 3. What I want from engineering: batch 6, two bot rules, then the ten seeds

1. **An AI broker covers what it takes.** A broker accepts a tender only while its recent cover rate holds: per broker
   and hub, the share of its loads lost at the close over the trailing week (`brokerage.ai.maxLostShare`, 0.25); above
   it, the tender goes to the board direct (`tendersToBoard`), as a capped tender does today. That is what a broker does
   out there, since a broker that cannot cover loses the shipper; it returns the brokered share toward the shippers'
   own 50% tender share, the fall-off toward today's 2% of the cap's pay, and the brokers to solvency.
2. **The facility payback test reads the window, and a losing facility is sold.** `chooseFacility`'s `covered` reads
   the rounds a facility load has to live under windows (the lead and the pickup hours in rounds, two to four) instead
   of `giveUpAfterRounds`, and the hub's lost share for facility freight over the trailing week in place of the board's
   fill; and a bot sells a facility that has run at a loss for eight weeks (the bots never sell one today: 69 stand at
   the end losing 5–8k a week each). The NPC market's purchases then fall with the count; the tripwire is the check.
3. **The engine error** in `settleDoubleBroker` under windows with the cap off, before the twins can run.
4. **The sizes stay** as batch 5 built them (the top at 6 does its job: direct freight 3.34 idle and 3.79 booked ahead;
   the memory-free goods price is right in principle); the cargo values of NPC and brokered loads on the lifted
   reference are fine, since claims and insurance should scale with the haul's pay.
5. **Then the ten seeds again,** with the added targets as set, the carriers' share read from the flows, and the
   facilities and the fall-off read as lines of their own.

## 4. "Usually clears near" under windows (the director's question)

The clears-near probe (`_clears.ts`: the ratio rule on, which no bot reads; windows on against off on f666d04, seeds 1
and 2, 365 days; the hub table's ratio month by month and every win's rounds from posting, hours from ready and rate
against the reference, at five hubs):

| Hub, seeds 1–2 | Table's ratio, months 10–12: off → on | Wins' ratio, median [p10–p90]: off → on | Rounds from posting to the clear, median / p90: off → on | Hours from ready to the clear, median / p90, on | Booked ahead, on |
|---|---|---|---|---|---|
| DAL | 1.9–2.3 → 1.3–1.6 | 1.55–1.60 [1.1–2.3] → 1.16 [1.0–1.6] | 3 / 7 → 2 / 6 | 2 / 28 | 73–78% |
| PHX | 2.0–2.7 → 1.3–1.5 | 1.93–2.00 [1.2–2.8] → 1.20–1.27 [1.1–1.8] | 6 / 9 → 2 / 5–6 | 8 / 32 | 63–66% |
| MEM | 1.6–2.3 → 1.3–1.5 | 1.50–1.55 [1.2–2.3] → 1.16–1.20 [1.0–1.6] | 3 / 7–8 → 1 / 5 | 0 / 22–24 | 69–75% |
| CHI | 1.9–2.4 → 1.2–1.4 | 1.72–1.77 [1.1–2.6] → 1.16–1.20 [1.0–1.6] | 4–5 / 8–9 → 1–2 / 5–6 | 0–4 / 24–30 | 76–79% |
| LAX | 2.2–2.8 → 1.2–1.7 | 2.13–2.34 [1.2–2.8] → 1.28–1.34 [1.0–1.8] | 7–8 / 9 → 3 / 7 | 12–16 / 38 | 75% |

- **The figure under windows reads 1.1–1.3× the reference**, just under a fresh load's ceiling of 1.2×, at every hub,
  busy or thin, instead of today's 1.5–2.3× built from rolled loads; it goes stale the day windows go on, as the
  director said, and the ratio form reads the new market the same day (the half-life is one day).
- **Rounds to a clear are 1–3 from posting (p90 5–7), and from ready most loads clear within a day** (median 0–16
  hours, p90 22–38); three quarters of wins are booked ahead, before the load is ready.
- **The wait's limit is two rounds, and the switch earns nothing under windows.** A load lives 24–48 hours after it is
  ready and walks only in its last four rounds; what clears, clears near the opening price. A player who waits for a
  load "to reach its usual price" waits for a figure the load already sits under, and past two rounds the load is in
  its urgency walk or lost. So: `clearsNear.wait.maxRounds` 2, read as a day, never past the load's own close; the
  switch off by default, as the director ruled, and Iuliia offers it only on the rolled-load trigger, which under
  windows almost never fires (rolled loads are the walk's four rounds, 53% of which are then lost). The sheet's words
  ("from loads that rolled") become "from loads that cleared here this week" under windows, since nothing rolls.

## 5. Which ruleset

Windows wait for batch 6 and a passing gate; 0.24.1 proceeds with its eight switches. The early-delivery fee (its own
note, economy-early-delivery-2026-11-10.md) is a later ruleset of its own, not windows'.

## What ran, and where

Two arms of ten seeds at 1460 days (batch 5 on, cap on; its cap-off twin, eight of ten after two engine errors), the
gate (`gate-win5.json`), the off arm on f666d04 (seeds 1–2 now, 3–10 queued), the carriers' cash flows (`_flows.ts`,
seeds 1–2, 730 days, both arms), the trucker's month, the first board (both arms on f666d04) and the clears-near probe
(`_clears.ts`), in a scratch worktree at f666d04; kept at
the economy's session scratchpad.
Nothing in the shared checkout changed and nothing is staged; this note is the shared folder's first, for the producer
to place as studio/reviews/economy-delivery-windows-batch5.md.
