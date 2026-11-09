# Economy: delivery windows, the sizing batch (2026-11-09)

The reading of item 4 (engineering's batches 1–3 on main: a644f14 windows and loss, 584f920 booking ahead, ea48c67 the
dispatcher two deep with the bots) before any ruleset turns `windows.enabled` on. Windows on against off on the live
profile, the gate's ten seeds (1–10, 1460 days), the cap-off twin of the windows-on world beside: thirty sims on main
at c915f72 in a scratch worktree, launched into clear vitest gaps from 17:33 to 18:13. No engine edit; nothing is staged.
The runner is `apps/sim/src/run.ts`'s world and report with a ledger tap on the claims and a count of loads booked ahead
(`_wsim.ts`, kept with the results); the gate is `apps/sim/src/gate.ts` as it reads. Beside them: the trucker's month at
Dallas on the test page's world, the locals probe of economy-locals-first-2026-11-09.md, the first-board probe at the
starter hubs, and four cheap variants on today's keys (§3).

The sizes under test, `economy.config.ts windows`: leadDays 0 / 45%, 1 / 30%, 2 / 15%, 3–5 / 10%; pickupHours appointment
12, first-come 24; urgencyRounds 2; lateClaimShare 0.20, noShowClaimShare 0.25, cancelClaimShare early 0.10 / urgent
0.25; the lost shipment at `brokerRisk.fallOffShare` 0.15; planAheadHours 12; planMarginMinutes 60.

## The finding first

**Windows on, as built and sized, halves the economy, and the gate fails ten of ten.** Seven loads in ten are lost at
their pickup's close; cleared loads fall 22%, the mean cleared rate 19%, NPC pay 41%; carriers' profit per truck-week
falls by half for owner-operators and by two thirds for fleets; companies bankrupt go from 185 to 488 a run, the
owner-operators from 75 to 327. The cap-off twin shows the same collapse, so it is windows, not the cap. The claims,
the booking ahead and the hand-off work as designed and cost almost nothing; what breaks is the market's price
discovery. Today a load nobody takes piles up on the board and walks: the hub's load-to-truck ratio rises with the pile
and every new posting there prices higher, and the load itself steps 10% a round for ten rounds until a truck takes it.
Under windows a load that does not pay at its posting holds its price, steps twice in its last day, and is lost; it never
joins a pile, so the ratio never rises and the next posting prices the same. The market has lost both of the ways it
learned that freight was going unhauled. Nothing in the sizes repairs that; §3 says what the knobs recover and what the
engine needs instead. **Windows cannot ride in 0.24.1 or in any ruleset until that is built and the ten seeds pass.**

## 1. The gate with windows on (cap on against the windows-on, cap-off twin, ten seeds)

| Seed | Band, year 4 (trailing four, corrected) | Twin's own | Carriers Y3 · Y4, % of twin | Cleared/day Y3 · Y4, % of twin | Debt, % of FD held | Month 1 ÷ budget | Supply (warm, yoy) | Gate |
|---|---|---|---|---|---|---|---|---|
| 1 | .976 .973 .998 .984 | .948 .933 .945 .943 | 119 · 119 | 85 · 87 | 0.4 · 0.8 | 61% | 1.37, 2.26 ✗ | FAIL |
| 2 | .959 .974 .968 .943 | .955 .962 .972 .948 | 125 · 129 | 96 · 91 | 0.7 · 0.9 | 48% | 1.29, 2.46 ✗ | FAIL |
| 3 | .985 .987 .988 .998 | .964 .955 .943 .955 | 133 · 133 | 97 · 86 | 0.5 · 0.7 | 46% | 1.42, 2.35 ✗ | FAIL |
| 4 | .976 .978 **1.001** .988 | .951 .945 .958 .954 | 119 · 124 | 90 · 81 | 0.8 · 0.7 | 60% | 1.29, 2.16 ✗ | FAIL |
| 5 | .973 .972 .987 .972 | .943 .934 .942 .934 | 125 · 124 | 86 · 89 | 0.8 · 0.8 | 62% | 1.29, 2.39 ✗ | FAIL |
| 6 | .976 .991 .987 .986 | .947 .954 .929 .926 | 115 · 118 | 91 · 84 | 0.5 · 1.2 | 39% | 1.23, 2.34 ✗ | FAIL |
| 7 | .978 .967 .974 .997 | .957 .945 .947 .958 | 134 · 135 | 101 · 98 | 0.7 · 0.7 | 56% | 1.38, 2.20 ✗ | FAIL |
| 8 | .967 .983 .984 .975 | .931 .940 .936 .921 | 130 · 134 | 90 · 81 | 0.7 · 0.7 | 48% | 1.25, 2.34 ✗ | FAIL |
| 9 | .958 .975 .982 .957 | .942 .950 .952 .932 | 110 · 110 | 85 · 87 | 0.9 · 1.2 | 47% | 1.26, 2.46 ✗ | FAIL |
| 10 | .981 .983 .980 .992 | .936 .943 .921 .931 | 138 · 144 | 101 · 81 | 0.5 · 1.0 | 40% | 1.34, 2.29 ✗ | FAIL |

- **(a) The band passes on nine** (seed 4 touches 1.001 once), but read what it says: the corrected ratio sits at
  0.94–1.00 against today's 0.84–0.87, three to five points over its own twin. The economy retains almost nothing of
  what it is paid because it is paid so little; a ratio near 1.00 in a world paying 41% less is the band read on a
  starved economy, which §16.4 of economy-emission.md warned the band would pass.
- **(b) The floors pass everywhere, and that too is the wrong kind of pass.** The capped world keeps 110–144% of the
  twin's carriers: the cap-off twin loses carriers faster than the capped world does, because under windows both
  worlds starve and the cap's subsidy (5M a month) is now the larger part of what carriers are paid. Cleared loads a
  day are 81–101% of the twin's. Debt 0.4–1.2% of FD held, inside the line.
- **(c) The cold start passes trivially:** month 1 commits 39–62% of its budget. The cap never binds: 7 days at the
  volume floor against today's 235, the volume lever at 1.07 after year 1 against today's 0.81, the four-year budget
  underspent by 22% (1,036M budgeted, 805M paid). The levers that hold the economy inside its budget have nothing to
  hold; the economy cannot haul what the budget would pay for.
- **(d) Supply fails on all ten:** year-over-year growth 2.2–2.5× against the criterion, because year one's supply is
  18M (today 30M) and the second year's 50M; the world then flattens at 49M against today's 119M. The NPC market's
  purchases trip the 5% tripwire on every seed (5.2–8.8% of NPC pay committed) because NPC pay collapsed under them,
  not because facilities sold more.

**Does the cap's calibration hold or need a step?** Neither question applies to this world. The gate was calibrated on
a healthy capped economy that the cap holds back a little (carriers at 74–90% of the twin's, the ratio a point or two
under); windows on produces a starved economy that the cap never restrains, where every floor passes because the twin
is starved too and the band passes because nothing is retained. Recalibrating the gate to pass it would be calibrating
away the finding. The gate stands as it is; the engine under windows has to change (§3), and the ten seeds run again on
the built change.

## 2. What windows do to the market (ten seeds, 1460 days; means with the seed range)

| | Windows off | Windows on | Windows on, cap off |
|---|---|---|---|
| Posted | 809,680 [784,671–836,974] | 1,242,044 [1,149,336–1,317,012] | 1,110,430 |
| Cleared | 447,469 [437,736–458,844] | 348,212 [331,891–363,064] (−22%) | 369,410 |
| Lost at the pickup's close | — | 895,034 [818,621–971,036], 72% of posted | 742,370 |
| Expired (lost, or given up) | 360,069 | 894,898 | 742,221 |
| Fill | 0.553 [0.527–0.577] | 0.281 [0.264–0.295] | 0.333 |
| Mean cleared rate, FD/mi | 3.73 [3.67–3.76] | 3.02 [2.99–3.06] (−19%) | 3.23 |
| … by year | 3.95 · 3.83 · 3.67 · 3.46 | 2.98 · 3.09 · 3.03 · 2.90 | 3.10 · 3.38 · 3.22 · 3.16 |
| On time | 0.724 | 0.808 | 0.809 |
| Rollovers / urgency steps | 5,749,213 | 1,307,582 | 1,054,861 |
| NPC pay, M FD | 1,737 [1,650–1,786] | 1,027 [983–1,092] (−41%) | 1,131 |
| … by year | 415 · 374 · 461 · 486 | 284 · 268 · 290 · 185 | 302 · 300 · 304 · 224 |
| Trucks in service (mean) | 776 | 684 | 701 |
| … year 4 | 783 | 562 | 587 |
| Owned trucks at the end | 574 | 327 | 363 |
| OO profit / truck-week | 2,063 [1,943–2,186] | 1,081 [1,034–1,155] (−48%) | 1,421 |
| Fleet profit / truck-week | 2,099 [1,853–2,397] | 667 [596–704] (−68%) | 948 |
| Companies bankrupt (oo · fleet · broker) | 185 (75 · 46 · 30) | 488 (327 · 81 · 46) | 378 (221 · 80 · 48) |
| In debt at the end | 238 | 383 | 284 |
| Supply at the end, M FD | 119 | 49 | 58 |
| Free path: first truck, median day · within 84 d | 30 · 345 of ≈366 | 54 · 579 of ≈888 | 36 · 497 |
| Population dial: retired · wound down · days under | 34 · 86 · 123 | 0 · 0 · 0 | 0 · 0 · 0 |
| Brokered loads · share of NPC pay | 100,716 · 26% | 27,816 · 9% (−72%) | 24,272 |
| Fall-off sink, M FD | 26 [22–31] | 13 [11–15] | 12 |

**Lost loads and fall-off by poster (windows on):** NPC direct 814,200 [735,041–875,850]; AI brokers 27,580
[23,562–31,282], the fall-off on them 13M against today's 26M on fewer, dearer losses; player-style brokerages 2,024;
facilities 51,229 (their goods unsold, which is the tripwire's trip). The shippers' value lost is 2,258M FD a run,
more than twice what was paid. Lost loads by year: 190,623 · 289,621 · 243,444 · 171,347; the market does not learn,
and year four is smaller because the carriers are gone.

**Claims (windows on):** late 450 [413–493] a run, 285,824 FD; no-show 2,017 [1,898–2,128], 1,268,608 FD; cancel 0 (no
bot releases). Per truck-year (684 trucks × 4): 0.16 late claims and 104 FD; 0.74 no-shows and 464 FD. All claims are
0.15% of NPC pay; 1.32M goes to `sink:service_failure` (NPC paper) and 0.23M company to company. The mean no-show claim
is 629 FD, the mean late claim 635 FD: the sizes bite one load at a time as designed and are invisible in the aggregate.

**Booking ahead:** 70.5% [69.5–71.4] of all wins are booked ahead; the loads booked ahead clear at 3.10 FD/mi against
2.84 for loads taken idle, so the planners are paid 9% more than the waiters.

**The trucker's month at Dallas** (the test page's world, an owner-operator joining after the warm start on the players'
dispatcher, thirty days, six seeds; `_month.ts` from apps/web/test/trucker-month.test.ts): 10,064 → 8,196 FD net (−19%),
10.2 → 9.2 loads; seeds 8,724 → 11,828, 6,941 → 6,239, 7,425 → 5,883, 6,629 → 7,937, 12,035 → 10,396, 18,630 → 6,893;
no claim on the probe company in any seed.

**Locals' share of wins** (the probe of economy-locals-first-2026-11-09.md, 120 days, seeds 1–2): 10.6% → 11.5% and
12.5% → 12.3%; the local round holds under windows (locals take 632 and 922 loads inside their round against 179 and
943). What changes is the fate of the rest: locals-first loads lost 1,371 → 15,015 and 1,083 → 15,637.

**The newcomer's first board** (apps/sim/src/firstBoard.ts, seeds 1,4,8, the first 14 days of a cold world, a probe
company at each hub reading the board between rounds; "+25% loads" clear break-even by the dispatcher's margin):

| Hub | Open loads a round, off → on | Loads at +25% a round | Rounds with one at +25% | Median best margin, FD |
|---|---|---|---|---|
| CHI | 43.4 → 31.4 | 8.1 → 8.4 | 92% → 100% | 1,411 → 657 |
| LAX | 73.6 → 35.8 | 27.5 → 11.5 | 94% → 99% | 2,492 → 927 |
| DAL | 33.1 → 23.8 | 4.7 → 1.1 | 83% → 45% | 1,215 → −78 |
| PHX | 15.7 → 10.3 | 2.1 → 0.5 | 64% → 35% | 192 → −178 |
| MEM | 19.5 → 16.1 | 3.1 → 0.5 | 54% → 30% | 25 → −132 |

Chicago and Los Angeles keep a paying board; at Dallas, Phoenix and Memphis the best load a newcomer may take in the
first two weeks usually loses money, where today it pays. Dallas is the rings' first fallback (`FIRST_HUBS` DAL, LAX,
PHX until the season readings are in). The reason is the same as the market's: no slide lifts a thin hub's loads to a
visitor's break-even.

## 3. The sizes, read in the world they change

**The claims (lateClaimShare 0.20, noShowClaimShare 0.25, cancelClaimShare 0.10 / 0.25, the lost shipment at 0.15):
keep.** They do what economy-delivery-windows.md sized them to do: a no-show costs a quarter of a load (629 FD on the
mean), a late delivery a fifth, both inside what a one-truck company survives (the §2 one-truck table stands at the
lower pay too: −620 against a −2,000 line), and in the aggregate 0.15% of NPC pay. No claim shows in the liquidations:
the owner-operators that go under go under for want of freight, not for a claim. The order (cancel early < late <
no-show = cancel urgent) is right and the release rule of §4 leans on it. The fall-off share at 15% stays; the brokers
lose fewer loads to the close than to today's ten rounds and pay half the fall-off, and what sinks them under windows
is volume (−72% of brokered loads), not the charge.

**The walk (urgencyRounds 2) and the window's life (pickupHours 12 / 24): these are where the market died; the knobs
bring back the loads and not the price.** Four cheap variants on today's keys, seeds 1–2, 730 days, windows on, against
the first 730 days of the ten-seed arms:

| Variant (windows on unless said; seeds 1–2, 730 days) | Posted | Cleared | Lost, % of posted | Fill | Rate, year 2 | NPC pay, M | OO profit / truck-week | Fleet profit / truck-week | Companies bankrupt (oo) | Owned trucks at day 730 | Brokered loads |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Windows off (the ten seeds' first 730 days; the income lines from the two 730-day off runs of the loan note) | 389,400 | 218,254 | — | 0.561 | 3.83 | 789 | 2,503 | 2,404 | 112 (52) | 620 | 26,132 |
| On, as sized | 681,333 | 190,720 | 72% | 0.280 | 3.11 | 572 | 1,364 | 568 | 230 (150) | 516 | 13,528 |
| urgencyRounds 6 | 629,238 | 192,750 | 69% | 0.307 | 3.24 | 574 | 1,469 | 725 | 228 (136) | 487 | 9,739 |
| pickupHours 24 / 48, urgencyRounds 4 | 571,036 | 221,140 | 61% | 0.388 | 3.22 | 720 | 1,516 | 808 | 153 (117) | 554 | 36,662 |
| that, and leadDays 0 / 20%, 1 / 40%, 2 / 25%, 3–5 / 15% | 522,124 | 219,854 | 58% | 0.421 | 3.25 | 741 | 1,516 | 852 | 137 (104) | 576 | 44,944 |

- **A longer walk alone does almost nothing** (lost 72% → 69%, the rate 3.11 → 3.24): a lead-0 load has one or two
  rounds of life, so a six-step walk is a two-step walk on most of what is lost.
- **A longer life recovers the loads, not the price.** With a first-come dock open 48 hours and an appointment 24,
  cleared loads come back to today's (221,140 against 218,254), trucks in service to today's (777 against 762) and NPC
  pay to 91% of today's; shifting the lead days toward tomorrow adds three points. But the cleared rate stays at
  3.22–3.26 against 3.83 (−16%), and through the carriers' contribution of about half of gross that is a 40% cut in an
  owner-operator's profit per truck-week and 65% in a fleet's, with owner-operator bankruptcies doubled (104–117
  against 52). The slide was a sixth of the rate and a third of the carriers' profit. The posted figure is a fifth to a
  half higher in every variant because the cap, underspent, releases volume; lost loads are fewer in count where the life
  is longer and still 58–61% of what is posted.
- **What I take from it for the sizes:** pickupHours 24 / 48 and urgencyRounds 4 are my changed sizes for the next
  run (the director's two steps were set against a 12 / 24-hour window; with a 48-hour first-come life, four steps is
  the same walk over the load's last two days, the director's reason for the walk unchanged), and the lead-day shift is
  a knob to keep in hand. They are necessary and not sufficient: the price needs the engine.

**The lead-day weights (0 / 45%, 1 / 30%, 2 / 15%, 3–5 / 10%):** 45% of loads live 12–24 hours from posting at a flat
price. In life same-day freight is the minority and it pays a premium for being same-day; here it pays the reference and
dies. The variant with the weights shifted toward tomorrow (0 / 20%, 1 / 40%, 2 / 25%, 3–5 / 15%) is in the table; it
helps only as far as the walk and the planners can use the extra day.

**planAheadHours 12 and planMarginMinutes 60: keep.** 70% of wins are booked ahead, the planners are paid 9% more than
the idle, and the projection is within an hour at p97 (batch 3); the no-shows that remain are the breakdowns (§4), which
no margin under six hours would catch. Widening the plan-ahead window would let trucks book further out, which only
matters once the loads out there pay.

**What the engine needs instead: unserved demand prices the next posting.** Today's price discovery is the pile: the
hub's load-to-truck ratio (`reloadIndex`, counting open loads ready today against idle trucks) and the rollover's step.
Under windows a lost load leaves no trace in either. The rule I want, for engineering's batch 4 behind the same switch:

- **The ratio remembers its losses.** Per hub and trailer, a decayed count of loads lost at their pickup's close over
  the trailing days (`windows.lostMemoryDays`, 7; the same half-life shape as the clears table) joins the open loads in
  the ratio's numerator. A hub where freight goes unhauled reads as a hub short of trucks, and `refRate` at that hub
  rises through the ratio for every new posting until the loads pay and are taken. This is the market pricing unserved
  demand, which is what the pile did, without a load lingering past its window and without a slide. It reaches the
  reference, so `clearsNear`, the bots' break-even tests and the brokers' tenders all see it, and it decays as soon as the
  loads move.
- **A posting prices its own urgency.** A lead-0 load is same-day freight; it opens at the reference times
  `windows.sameDayPremium` (1.10), as same-day freight does out there, so the loads with the shortest life start where
  the walk would have taken them.
- **The walk is four steps at +10% over a 24 / 48-hour life** (the variant that brought the loads back), and with the
  ratio carrying the memory the walk does not have to carry the price.
- **Measured by the ten seeds again,** with the band and the floors as they are; the target is today's off arm:
  cleared loads and NPC pay within the seed range of the off arm, lost loads under a quarter of posted, the cap
  binding again (days at the volume floor), the newcomer's first board paying at Dallas and Phoenix.

If the sameDayPremium is judged a fallback rather than the market (Jeff, 2026-10-29: the market sets the price), the
memory alone is the rule and the premium goes; the variants in the table are the lower bound of what the memory has to
do.

## 4. The residue: no-shows after a breakdown on a truck booked ahead

**What the engine does.** A breakdown (`trips.ts breakDown`) stops the truck 6–18 hours, drawn. A truck with a load
booked ahead (`Truck.nextLoadId`) keeps its plan through the stop; `canMake` saw no breakdown when it planned, and
nothing re-reads the plan afterwards. If the stop carries the truck past the next load's pickup close, the round's check
makes it a no-show (`windows.ts noShow`): the 25% claim to the poster (the sink on NPC paper), the mark on the record,
and the load lost through `giveUp`, so an AI broker's load also costs its fall-off. No bot ever calls `release_load`;
the 10% early cancel exists for players only.

**What it costs in the ten seeds:** 2,017 no-shows a run (0.74 per truck-year) and 1.27M FD (464 FD per truck-year),
0.12% of NPC pay, against 22,896 breakdowns a run: about one breakdown in eleven lands on a truck booked ahead and
breaks its plan. The claims go 1.1M to the sink and 0.2M to AI brokers and brokerages.

**The rule I want: release on a breakdown that breaks the plan, for everyone.** When a truck with a load booked ahead
breaks down, the engine re-runs `canMake` for that load with the stop added to the truck's free time; if it no longer
makes the pickup, the dispatcher releases the load then and there (`releaseLoad`: the cancel claim at the early 10% or
the urgent 25% by where the pickup stands, the mark, the load back on the board as it stands). It applies to the bots
and to the players' dispatcher alike; a player running by hand gets a Needs-you item with the two figures ("release now:
N FD; miss the pickup: M FD and the load is lost") and the same default if they do nothing by the pickup's close, which
is the no-show they would get anyway. Why release rather than a fault margin:

- **It is what happens out there.** A carrier that breaks down calls the broker and the load is re-covered; a silent
  no-show is the mark on a carrier's record that brokers remember. The claim ladder already prices it (cancel early 10%
  < late 20% < no-show 25% = cancel urgent 25%).
- **It saves the load, not mainly the claim.** A load booked ahead is for a pickup inside a day or so (planAheadHours
  12, the ready-day keys), so most breakdowns land inside the two urgency rounds and the cancel costs the same 25% as the
  no-show. What the release buys is the load back on the board with its slack left, for a truck that can make it: no
  lost load, no fall-off for the broker, and for an NPC shipper the freight moves.
- **A fault margin costs every booking to spare a few.** `planMarginMinutes` would need six to eighteen hours of
  margin to cover a drawn breakdown, which removes a large share of the feasible loads from every plan, and the
  breakdown still comes on the truck that drew it. Keep 60 minutes as the knife-edge margin it was built to be.
- **Leaving it** keeps a claim nobody would accept in life (a carrier paying 25% and losing the load for a breakdown it
  reported) and leaves 2,000 loads a run dead; at 0.12% of NPC pay it is not a sizing problem, it is a truth problem.

**Cost either way:** released, the carriers pay 10–25% on the same 2,000 loads (0.5–1.3M a run against 1.27M) and the
loads live; left, 1.27M and the loads die. The rule needs engine code (a hook in `breakDown` on a truck with
`nextLoadId`, the bots' and dispatcher's call to `releaseLoad`), so it is engineering's batch 4 behind the same switch;
the sizes here stand with or without it.

## 5. The broker's bond cap and loads booked ahead

**The call under test:** `receivables.ts brokerBooks` counts a load booked ahead as payable from the moment it is booked
(`status === "assigned"`, the ahead flag notwithstanding), at its cleared rate, against the broker's posted bond; a load
tendered to a broker and open on the board counts at its ceiling in `postedFd`.

| | Windows off | Windows on |
|---|---|---|
| Bookings refused by the cap | 1,746 [835–2,982] | 202 [61–422] |
| Tenders refused by the cap (to the board direct) | 389,445 | 404,704 |
| Tenders to the board | 235,222 | 352,886 |
| Brokered loads hauled | 100,716 | 27,816 |
| Brokers' bond at the end (seed 1) | 21.3M | 1.4M |

**My reading: keep the call; the cap is not the brokers' problem under windows, and loosening it would not help them.**
Bookings refused fall by nine tenths because the brokers have a tenth of the business: their loads die at the pickup's
close like everyone's, the fall-off takes 13M of a shrunken revenue, their bonds run down from 21M to 1.4M and 46 of 60
go under against today's 30. The commitment the cap counts is real: a broker that has booked a carrier owes it the rate
whether the truck has loaded or not, and a bond that did not count it would let a broker book past what it can pay.
When the market's price discovery is restored (§3), re-read the bookings-refused line: if it returns to today's 1,700 or
above, the room to give is on the posted side (an open tender at its ceiling is a hope, not a debt), never the
booked-ahead loads.

## 6. Which ruleset

- **Not 0.24.1.** Windows as built fail their gate on every seed and halve the bots' economy; nothing about them is
  ready for a ruleset. 0.24.1 carries the five switches of c1af286 and the hand-bid hold alone: player-facing rules whose
  digests are identical with the switch on or off, which need no gate and no restart for the economy's sake.
- **Windows get their own ruleset, later,** after engineering's batch 4 (the ratio's memory of lost loads, the same-day
  posting, release on a breakdown) and a ten-seed gate that passes on the band and the floors as they are, with the
  cap binding again. That is a restart with no players, as a market rule is; it should not be bundled with anything
  the studio would want to keep if windows had to come out again.
- **The sizes for that run:** the claims, the fall-off, plan-ahead 12 and margin 60 as proposed; pickupHours 24 / 48
  and urgencyRounds 4 as changed here (§3); the lead-day weights and the same-day premium as the two knobs engineering
  and I can turn without a second design pass if the memory alone falls short.

## 7. What a red team would try that batch 1 and the earlier notes did not cover

1. **The free option on freight.** A carrier books a load two or three days ahead and releases it at 10% if a better one
   appears: the cheapest way to hold freight anyone has. The 10% is of the pay as booked (about 300 FD on the mean load),
   the mark lands on the record, and the released load goes back as it stands, so the option is priced; the question is
   whether a fleet can farm it to corner a hub's best lanes. The bots release nothing (0 cancels in thirty runs), so the
   sims say nothing about a player who does; watch releases per company a week on the live world, and a cap of releases
   a week before the credit record takes a second mark is the rule if it shows.
2. **The claim as a discount.** A player shipper or brokerage posts loads with the tightest windows the draw allows and
   collects 20% late claims from carriers hit by docks and breakdowns. canMake refuses a booking that cannot make the
   window, so late claims come only from events after booking: 0.16 per truck-year, 635 FD each. Too thin to farm, and
   player posters' pay never walks, so there is no urgency premium to collect on top.
3. **Booking ahead to block.** A carrier books a rival's likely load ahead and lets it go to a no-show: it pays 25% and
   the mark, the load is lost and the broker eats the fall-off. Expensive for the blocker and the broker; nobody gains.
   The release-on-breakdown rule releases only on a breakdown, so it opens nothing here.
4. **Two deep as a second truck.** A truck with a load in hand and one ahead is committed for two or three days; the
   bots' projection is honest and a player's by-hand booking passes the same check, so there is no free capacity in it;
   the two-deep limit holds by construction (batch 2's tests).
5. **The urgency walk, farmed by waiting.** A carrier parks at a hub and bids only on loads in their last two rounds at
   the stepped ceiling. The walk is at most two steps (+21%) and the load is lost after them; the planners booked ahead
   are paid 9% more than the idle (3.10 against 2.84), so waiting is the worse game under windows. Under the ratio's
   memory (§3) the wait would be worse still, since the next postings reprice instead of the load.
6. **Lost loads as a lever on the cap.** Under the cap the NPC budget pays only what is hauled, so a lost load is not
   spent; a broker's fall-off is a sink the refill reads, so lost brokered loads raise later budgets a little (13M over
   four years). Nobody can cause a lost load but by not hauling it, which costs the one who could have; and in the
   world as it stands the budget is underspent by 22%, so the lever moves nothing.
7. **Future-ready loads in the newcomer check and the broker's posted figure** (batch 1's flag): `emission.ts
   recordHubs` counts open NPC loads per hub for the newcomer check, future-ready ones included, so the starter-hub
   reading in the report overstates what a newcomer can take today (the first-board probe above is the true read); the
   bond's posted side carries the same overcount, which argues for giving room there, not on the booked loads (§5).

## What ran, and where

Three arms of ten seeds at 1460 days (`_wsim.ts`: run.ts's world and report, a ledger tap on `claim:*` and
`sink:broker_falloff`, a count of wins booked ahead), the gate over them (`gate-win.json`), the trucker's month
(`_month.ts`), the locals probe (`_locals.ts`, windows on and off), the first-board probe (`_firstboard.log`) and the
four variants (`wv-*`, seeds 1–2, 730 days), all in a scratch worktree detached at c915f72 with node_modules symlinked by
the before-rule recipe; launched in clear vitest gaps between 17:33 and 18:13, ten at a time. The reports, logs and
scripts are kept at
`/private/tmp/claude-501/-Users-jeff-Desktop-lanes-studio-lanes/d4111337-1fa7-4212-b119-16bd13637b23/scratchpad/windows-sizing-results/`
and the worktree is removed. Nothing in the shared checkout changed and nothing is staged; this note is the shared
folder's first, for the producer to place as studio/reviews/economy-delivery-windows-sizing.md.
