# Red team: the seven rules of ruleset 0.24.1 (2026-11-10)

The seven rules on main behind switches, all off, that 0.24.1 would turn on in the live levers at the empty live world's
restart: `freight.clearsNear.ratio` (c1af286), `labor.sendHomeToWork`, `labor.turnWhileEmpty`, `board.bidReachFromTown`,
`businesses.parking.stopInTown` (c1af286), `leverage.localHoldHandBids` (c915f72), `equipmentFinance.purchase.collateral`
(ad349e3). Each attacked as a player would, from the code first and then in the simulator with every switch on, alone and
together. Read-only on the engine; the harnesses are `apps/sim/src/redteam/rules0241.ts` (the fast probes, small worlds driven
through `applyAction`) and `apps/sim/src/redteam/clears.ts` (the full population). The probes ran on the shared checkout at
HEAD (the engine, config and agents packages had no uncommitted edits; the engine is f429a7a's); the three population sims ran
in a worktree checked out at 26cad5e, in a clear vitest gap at no other sims, 364 days, seed 1. Runs: `runs/redteam-0241/`.

## Findings first

| rule | finding | FD | fix, or why no exploit |
|---|---|---|---|
| (3) turn + (5) town, together | **A legal night anywhere for an empty truck.** A turn starts a new leg at the nearest town; the town rule reads "a leg's start": turn an hour before the hours run out and the truck sleeps in that town, no ticket. | 250 a night dodged at the patrol's 33% (82.5 expected); the probe's two shoulder nights, 500 FD, became two town nights at 0 | the town check should ask that the truck began the leg idle at the town (or skip a truck that turned this duty day): `turnTruck` sets a mark the night check reads |
| (2) send home to work | **The days-out fatigue resets on a pass home with no day off.** A driver standing at home at a day's close after driving all day has `awayDays` zeroed (`labor.ts dailyDrivers`, `if (home) s.awayDays = 0`): fatigue stays 0 for 90 days with a pass every 20 days, where never home reads 1.0 by day 60 (54 of 90 days tired, crash odds ×2, pace −10%). The switch makes the pass one click mid-job; the reset itself is today's rule (a reposition order home does the same). | no FD moves; the dodge saves the 5 days off (the home-time rule) a fleet would otherwise give every 21 days | the economy's and director's call: reset `awayDays` only on a day off (`hours === 0` at home), or count a pass as a day of recovery, not a reset |
| (7) the lender reads the truck | **The wreck-first dodge is cheap.** The ten new-business points end the day any truck is owned (a listing bought for cash, or a dealer or lot order the day it is placed, before delivery). A 9.8-year, 690k-mile van is worth 9.6k (fire-sale floor 2.4k): bought for cash and resold, it costs about 1.2k (7% tax, 5% resale fee) and takes 18.2k off a new rig's cash at signing. | 18.2k of down payment financed for ~1.2k; the loan's rate on it ~51 FD a week | key the points to the company's age alone, or to a truck owned for 30 days or that delivered a load (`receivables.ts firstInService` already logs it) |
| (1) usually clears near, as a ratio | **No player moves the figure for others; the figure itself reads far above the reference at a thin hub.** Dallas's hub ratio ran 1.43–2.26 of the reference from month 2, the figure over open loads 1.32–1.93: the table records rollover-walked ceilings (1.2 × 1.1 a round) against the posting reference. A 5-truck fleet bidding by hand at the ceiling moved it +0.04–0.19 and lost 1.6k a day; a brokerage posting 538 held loads at a 30% margin did not move it. The victim's dispatcher (the client's default: bid at the figure) was unmoved: 1.653 → 1.656 → 1.685 of the reference, −129 → +111 → +135 FD a day. | none to the manipulator; the victim unharmed | for the economy: the figure's cap at the load's ceiling means the client's dispatcher bids the ceiling on every fresh Dallas load; measure clears against the reference as it stood when they cleared (the ceiling's steps in the base), or write only clears inside the posting ceiling |
| (6) the hand bidder's round | no exploit: one filed bid per truck (`manualBids` is keyed by truck; the last filed stands), checked again at the opening (`mayTake`), scored as any bid; the held load's ceiling steps 10% through the hold whether or not a bid is filed; a local who books first takes it | – | – |
| (4) one reach from the truck's town | no exploit: 474 of 3,326 hub pairs over 300 market to market have a town pair within 300 (the largest gap DAL–ELP, 686 market to market, 32 town to town), 162 pairs within 300 lose a far pickup; the miles are the miles driven and priced | – | – |
| (3) turning, alone | no exploit: the first turn pays the miles so far and adds the miles to the nearest town (9 on the probe); further turns from the town add nothing and cost nothing; a breakdown's minutes carry through a turn; the stations ahead are the new route's (3 → 4 on the probe), a route the player could have chosen from the start | – | – |
| (5) a night in town, alone | no exploit: no leg of 3,540 starts within 0.1 miles of a site (60 within 1.5, which planNight parks at); with three hours left the town truck is 83 miles behind at 24 hours and level at 48; the day closes at its full limit, the weekly clock unchanged; the fine dodge is the rule's purpose | – | – |

**For 0.24.1:** the turn-and-town night is the one finding the ruleset should close before it turns on (a one-line guard). The
fatigue reset and the wreck-first points are rules questions for the economy and the director, true today or cheap, not holes
the switches open. The clears-near figure's level is a sizing note for the economy (the dispatcher's default bid), not an
attack.

## 1. `freight.clearsNear.ratio` (`clears.ts`; `runs/redteam-0241/clears-*.json`)

The attack: every cleared spot load writes `rate ÷ (refRate × hot)` under its lane and its hub, read with a prior of five
clears decayed by the day; the client's dispatcher bids at the figure (game.ts `PLAYER_DISPATCHER_ORDERS`: `clearsNear`, 0 over,
break-even the floor). Two player fleets at Dallas from 06:00 of day 10, five used vans each: the victim on the client's
dispatcher orders; the manipulator on the greedy bot's (`control`), or bidding by hand at the ceiling only, every idle van on
the dearest open load within 300 miles every hour (`high`), or running its brokerage from day 91 (1% advertised, ownFirst,
a 250k bond) that holds every tender to the window's last hour and posts it at 30% (`low`, the thin-board re-brokering of the
emission review's Addendum 2).

| 364 days, seed 1, Dallas | control | high | low |
|---|---|---|---|
| hub ratio in the table, monthly medians (m1 → m13) | 1.11 / 1.43 / 1.42 / 1.54 / 1.53 / 1.43 / 1.46 / 1.57 / 1.67 / 2.04 / 2.26 / 2.17 / 1.96 | 1.15 / 1.44 / 1.48 / 1.59 / 1.53 / 1.46 / 1.45 / 1.63 / 1.85 / 2.14 / 2.32 / 2.22 / 1.86 | 1.11 / 1.43 / 1.42 / 1.53 / 1.49 / 1.48 / 1.50 / 1.61 / 1.68 / 2.14 / 2.28 / 2.13 / 1.89 |
| the figure ÷ reference over the open Dallas van loads, monthly medians | 1.08 / 1.32 / 1.33 / 1.40 / 1.36 / 1.32 / 1.34 / 1.40 / 1.48 / 1.75 / 1.93 / 1.81 / 1.60 | 1.11 / 1.33 / 1.33 / 1.45 / 1.38 / 1.33 / 1.33 / 1.45 / 1.60 / 1.84 / 1.94 / 1.87 / 1.60 | 1.08 / 1.32 / 1.33 / 1.39 / 1.34 / 1.36 / 1.33 / 1.45 / 1.49 / 1.82 / 1.93 / 1.80 / 1.61 |
| the table's weight at the hub (clears in the last day, decayed) | 14–18 | 14–18 | 13–18 |
| every carrier's wins out of Dallas: a day · at × reference · at the ceiling · by hand | 9.98 · 1.622 · 2.0k of 3.6k · 0 | 9.94 · 1.673 · 1.7k · 19 | 9.91 · 1.646 · 1.9k · 38 |
| victim: wealth a day · loads won · at × reference · FD a mile · win rate | −129 · 680 · 1.653 · 3.37 · 0.94 | +111 · 668 · 1.656 · 3.33 · 0.92 | +135 · 657 · 1.685 · 3.39 · 0.93 |
| manipulator: wealth a day · loads won (by hand, at the ceiling) · at × reference · trucks at the end | +51 · 667 (0, 451) · 1.72 · 4 | **−1.6k** · 54 (54, 54) · 1.76 · 1 | +447 · 658 (48, 436) · 1.76 · 4 |
| manipulator: hand bids placed · refused · held posts · own tenders · paid out to carriers | – | 116 · 793 · – | – · – · 538 · 48 · 399k |
| Dallas bots (92): failed · median cash · loads | 21 · 58k · 19.7k | 15 · 57k · 19.8k | 17 · 50k · 20.6k |

- **Nobody moved the figure.** The hub clears ten loads a day and holds 14–18 of weight against a prior of 5; five trucks
  bidding by hand at the ceiling won 54 loads in 273 days (a bid at the ceiling scores 0 on price and loses to nearly any dispatcher under it; `refuseOverCeiling`
  is live, so nothing goes above it) and lifted the hub's ratio 0.04–0.19 at a cost of 1.6k a day and four of five trucks; the
  brokerage's 538 posts at 30% left it where it was (its carriers book near the hub's going ratio, and its own tenders at the
  band's top write the same). The victim's winning rate against the reference and its wealth did not move with either. A thinner
  hub (two clears a day, weight ~3) would be movable by one fleet, but the figure is capped at the load's ceiling, so pushing it
  up reaches the ceiling and no further, and pushing it down needs a brokerage paying carriers less, which is finding 1b of the
  emission review, not this rule.
- **The figure's level is the finding, for the economy.** The table records what loads clear at against the reference they
  were posted at; at a thin hub most loads clear after rolling, at ceilings walked 1.2 × 1.1 a round, so Dallas's hub ratio is
  1.43–2.26 from month 2 and 2.0k of its 3.6k wins are at the ceiling. The figure for a fresh load, capped at its ceiling (1.2 ×
  reference), is therefore the ceiling: the client's default dispatcher bids the ceiling on every fresh Dallas load, wins 92–94%
  of its rounds, 211–223 of its ~670 wins at the ceiling, and still ends the year at −129 to +135 FD a day on five trucks against
  the greedy bot's +51. The economy's note meant the ratio to read "how far clears sit from the reference"; the rollover's steps
  are in the clears and not in the reference. Two forms: write the clear against the load's ceiling-stepped reference (the
  reference × the steps), or write only clears inside the posting ceiling. Not a red-team hole; the trucker's-month probe
  (economy's test 5) should be read on this before the switch turns.

## 2. `labor.sendHomeToWork` (`rules0241.ts home`)

`send_home { work: true }`: an idle truck runs home now; a truck at work runs home the moment its job ends (`Truck.homeAfter`);
no days off. What it can dodge: the daily driver pass (`labor.ts dailyDrivers`) zeroes `awayDays` for a driver whose truck stands
within 150 miles of home at the day's close (`standingAtHome`: idle, parked or in repair), whether or not the driver drove that
day; the days-out fatigue (`fatigue.roadDays` 21, `roadPerDay` 0.03 growing by the weeks out) accrues on `awayDays`, and the
home-time rule's trigger (`needsHome`, `awayDays >= afterDays`) reads it too. A driver out 90 days on eight-hour driving days:

| 90 days, eight-hour driving days | never home | standing at home at a day's close every 20 days, no day off | the client's home-time rule, 21 out and 5 off |
|---|---|---|---|
| fatigue at day 30 · 60 · 90 · max | 0.24 · 1.00 · 1.00 · 1.00 | 0 · 0 · 0 · 0 | 0 · 0 · 0 · 0 |
| days at or over "tired" (0.5: crash odds ×2, pace −10%) | 54 | 0 | 0 |
| days out at the end | 90 | 10 | 12 |

A pass home with no day off is as good as five days off for the days-out rule, and the home-time rule never fires. This is
today's rule, not the switch's: a reposition order to the home hub, a homeward load, or the dispatcher's own home-time run leave
the truck idle at home at a day's close and reset it the same way; the switch adds a one-click version for a truck mid-job and
saves the empty run's timing. No FD moves; the fleet keeps its trucks working the 5 days in 26 the rule would rest them. The
long-day fatigue (over 10 hours) and the morale cost stay. Fix, if the director wants days off to be the only reset: zero
`awayDays` only on a day off at home (`hours === 0`, the branch above it), or let a pass count as one day of recovery.

## 3. `labor.turnWhileEmpty` (`rules0241.ts turn`, `turntown`)

Alone, no exploit. The probe: a truck 157 miles into an 835-mile empty run, turned ten times in one hour between two hubs.

| turn | to | remaining mi · straight-line route · added for the town | paid at the turn (FD) | odometer |
|---|---|---|---|---|
| 1 | HOU | 265 · 256 · 9 | 500 (fuel, wages, maintenance, the tolls' share for 157 miles) | 157 |
| 2–10 | ATL / HOU alternating | 764 / 256 · the same · 0 | 0 | 157 |

The first turn pays the miles driven and stands the truck at the nearest town plus the miles to it (9); from the town every
further turn is a free re-targeting, as cancelling a run at a hub is, and no mile is gained: the leg to ATL from the town is 764
where 678 remained on the road (the town is off the route; in the `turntown` probe the other way, 26 miles fewer over 1,500 —
geometry, both ways). A breakdown's 360 minutes carried through a turn and the truck moved 0 miles in the next hour. The weigh
stations are the new route's (3 → 4 on the probe); turning cannot skip a station on the road it stays on, only change roads,
which a player chooses at departure today. An empty truck carries nothing a theft roll could take, and robbery is off in live.
Hours of service, the break and the fuel stop are untouched. The ledger balances.

## 4. `board.bidReachFromTown` (`rules0241.ts reach`)

No exploit. The network has 60 markets and 4,786 towns. Of 3,326 ordered hub pairs over 300 miles market to market, 474 (14%)
have a town pair within 300 (354,178 of 22.5M town pairs); the widest gap is DAL–ELP, 686 market to market and 32 town to town
(a west-Texas town of the Dallas market beside an El Paso town), then DAL–MSY 514 · 27, DAL–LIT 317 · 21, DAL–AMA 459 · 21.
Of the pairs within 300 market to market, 162 have pickups the hub's own town cannot reach within 300 and now refuses. In both
directions the bid's deadhead is the miles the truck drives and the dispatcher prices; the rule makes the hand bid read the same
miles as Book now and the card. Nothing to farm.

## 5. `businesses.parking.stopInTown` (`rules0241.ts town`)

Alone, no exploit; the fine dodge is the rule's purpose and costs the player a day's lag at most.

| three hours of driving left at a leg's start, every site in the first 200 miles full | the town | the shoulder |
|---|---|---|
| miles after 24 h · 48 h | 553 · 835 | 636 · 835 |
| shoulder fines · idling | 0 · 64 | 250 · 64 |
| with one hour left: miles after 24 h · 48 h · fines | 553 · 835 · 0 | 553 · 835 · 0 |

- **Truck-stop owners lose nothing they could have sold.** The night in town comes only when no site with room is in reach of
  the hours left; a site is skipped only within 0.1 miles of the leg's start, and no leg of 3,540 (hub to hub) starts within 0.1
  miles of a site (60 within 1.5, which `siteHere` parks at, paying).
- **Hours of service.** The day closes at its full limit without a mile driven and the weekly clock counts none of it (the rules
  test), as `planNight`'s early stop does today; the next day opens after the rest hours as any night's does. Per diem is for an
  idle layover and a truck on a leg pays none either way. A company on falsified logs spends its 15-hour day the same way with no
  `overMin` written, which is right: no driving, no violation.
- **The theft risk** of a town night is a rest area's; an empty truck has nothing to lose, a loaded one is better off than on the
  shoulder, as the director meant.

## The group: turn + town (`rules0241.ts turntown`)

The one finding for the ruleset. `turnTruck` ends the leg where the truck stands and starts a new one from the nearest town
(`legKey −1`, the leg's mile 0); the town rule fires "at a leg's start" for a truck that has driven today with hours left short
of the day and no site with room in reach (`trips.ts moveTrucks`, `legMile(truck) <= 1e-6`). So a company that chose the town
turns its empty truck an hour before its hours run out (toward any hub and back: two actions, nothing paid at the second) and
sleeps in the nearest town, legally. The probe, a 1,500-mile empty run with every site on the way full:

| 1,500 miles empty, every site full | straight | turning an hour before the hours run out |
|---|---|---|
| turns · nights on the shoulder · nights counted as a site (the town) | 0 · 2 · 0 | 4 · 0 · 2 |
| shoulder fines | **500** (both nights ticketed this seed) | **0** |
| arrived · odometer | yes · 1,528 | yes · 1,502 |

A town is always the nearest place, so this is a legal night anywhere for an empty truck, at the cost of the hour of driving the
turn takes off the day (made up the next day, as the town probe shows) and the turn's miles to the town. Expected saving 82.5 FD
a night (250 at the 33% patrol), more where theft rolls bite a loaded truck, which a turn cannot reach (turning is for empty
runs only). Fix: the town check should apply to a leg the truck began idle at that town, not to one a turn began — `turnTruck`
sets a mark (`truck.turnedT`, or a flag cleared at the day's close) and the night check skips a truck that turned this duty day;
or `turnTruck` leaves `legMile` at the turn's mile instead of restarting the leg at 0 (the stations' fractions then need the same
care). One line either way; the rules test's `lateStart` can carry it.

Other pairs: send home to work on a running empty truck turns it at once (fine: it pays the miles so far); the hand bid's reach
from the town with the hand bidder's round changes nothing about the clearing; the lender's rule meets no other.

## 6. `leverage.localHoldHandBids` (`rules0241.ts hold`)

No exploit. A visitor's hand bid in the hold's last round is filed in `manualBids`, a map keyed by truck: three bids from one
truck on three held loads left one standing, the last. At the opening the bid is checked
again (`mayTake`: a local who booked it is gone with it), scored as every bid is (price 0.55, reputation 0.25, deadhead 0.2) and
cleared in the same sort as the bots' and the locals' dispatchers'; nothing is front-run. The held load's ceiling steps 10% through
the hold round (2.23 → 2.46 on the probe) whether a bid is filed or not, and a filed bid at the posting ceiling then sits under the
opening's ceiling, as any bid would. Blocking is buying: a won load is hauled. The economy's four vectors (economy-locals-first.md
§4) stand.

## 7. `equipmentFinance.purchase.collateral` (`rules0241.ts loan`)

| the lender's terms for a newcomer (credit 14%) | down · term (weeks) · rate a week · financed |
|---|---|---|
| a new rig | 24% (14 + 10 new business) · 104 · 0.28% · yes |
| 6.5 years, 200k miles | 25% · 26 · 0.385% · yes |
| 9.99 years, 699k miles | 47% · 26 · 0.49% · yes |
| 10.01 years · 700,001 miles | – | declined, cash only |
| the same newcomer after owning any truck | 14% · 104 · 0.28% · yes |

- **The wreck-first dodge.** The ten new-business points end the day `firstOwnedTruckDay` is set: a listing bought for cash
  (`buy_listing`, verified), or a dealer, dealership or lot order the day it is placed, before the truck arrives (`buy_asset`,
  verified: the points gone with no truck yet owned). The cheapest truck that does it is a wreck: a 9.8-year, 690k-mile Workhorse
  van is worth 9.6k today (its fire-sale floor 2.4k); bought for cash with 7% tax and resold at the 5% fee it costs about 1.2k and
  takes 18.2k off a new rig's 182k at signing (the 10 points), financing them at 0.28% a week (~51 FD). Cheap, and in the rule's
  letter ("has never owned a truck"). The economy's §6 expected a bought truck to end the points; it did not price the wreck. Fix,
  if the points are meant for a company with no trucking behind it: key them to the company's age alone (the authority under a
  year), or to a truck owned 30 days or that delivered a load (`receivables.ts firstInService` logs the first service day).
- **The year's edge** is a step: authority 364 days old, 23% down; 366 days, 13% (the credit alone at that moment). A player
  waits two days; fine.
- **Sybil companies.** A broker may buy no truck (`buy_asset`: "only carriers run trucks in Phase 0"), and a player has one carrier;
  a second company would be newer, not older. Listings between one owner's companies have no second company to list to.
- **The caps' edges** hold: 9.99 years and 699k miles finances at 47% down over 26 weeks; 10.01 years or 700,001 miles is cash
  only; the odometer only rises and a rebuild does not touch it; `borrow` (a cash-out pledge of a truck bought for cash) is closed
  with the pools in live (`equipmentFinance.closedWithPools`).

## Lower priority (the windows ruleset, not 0.24.1)

- **A player posting loads to be lost cannot raise a hub's rate.** Confirmed in code: `windows.ts noteLost` counts a lost load
  only when `posterKind` is `npc` or `broker` (an AI broker); a player's brokerage and a facility are excluded. One path to test
  when windows return: a player who books NPC loads and no-shows them makes them lost at the close, and those count (the cost is
  the no-show claim at 25% and the record's mark); urgency farming at four rounds and the free option (book ahead, release at 10%)
  were not run, the switch being off everywhere.

## Files and commands

Files for the producer to stage: `studio/reviews/redteam-0241.md`, `apps/sim/src/redteam/rules0241.ts` (new),
`apps/sim/src/redteam/clears.ts` (new), `apps/sim/src/redteam/harness.ts` (the `RULES_0241` switch set added). Typecheck clean.
Nothing in packages/. Runs in `runs/redteam-0241/` (gitignored).

- Probes: `npx tsx apps/sim/src/redteam/rules0241.ts --probe reach,turn,home,town,hold,loan,turntown` (seconds; `probes.json`).
- Sims, in a worktree at the commit: `npx tsx apps/sim/src/redteam/clears.ts --scenario control,high,low --seeds 1 --out
  runs/redteam-0241` (≈ 70 s each at the full population; `--compare --seeds 1` prints the table).
