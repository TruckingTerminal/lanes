# Replay of R7 and R19, part one (QA, 2026-11-03)

Engineering's commit is 30ba000. Checked against `player2-ux.md` §2 (R7) and §7 (R19) and `copy-player4.md`'s R19 table.

**Builds:**
- "Deploy 30ba000 from lanes" on the test page (Pages built, waited 60 s).
- An unflagged local build of 30ba000 (`git archive`, port 5199, now stopped) for the fresh world, so the parked world stays.

**Worlds played:**
- **Long Haul Test**: small fleet, Columbus, the parked world, at Thu 14:00, three days after Tue Feb 28 (about day 60). Three trucks (two owned, one leased), 40,663 FD before the loan below, clock paused.
- **Doors Check**: small fleet, Columbus, new from day 3, 24,700 FD, clock paused.

Phone 375×812, built-in browser. Console: no errors.

Severity: **R** blocks the republish · **S** this sprint · **L** later. Screenshots are in `qa-replay-r7-r19/`.

## R19: the caps line

| Row | Result | Evidence | Sev |
|---|---|---|---|
| "You may run {n}: {binding}. {others}" on Truck, Company and the Dealer | **Pass, binding only** | Fresh: "You may run 5: your yard holds 5. Yards open Jan 29, Year 1." on Truck and at the top of the Dealer. Long Haul: "You may run 5: your yard holds 5." on Truck, Company and the Dealer | – |
| The other caps after the binding one | **Missing** | Neither world names a second cap: no "Staking allows 10.", no managers, no company limit. With the stake tiers off, staking shouldn't appear (§7). But the operations-manager rule exists in the game (Staff: "Past 7 trucks you need an operations manager") and isn't named, and neither is the company limit | L |

## R7: the doors

| Row | Result | Evidence | Sev |
|---|---|---|---|
| The yard door before yards open: when, and what can be done now | **Pass** | Fresh, day 3, More yard space: "Yards open Jan 29, Year 1. Until then, make room: park a truck, sell one, or lease one out." with **Park**, **Sell**, **Offer for lease** under it ([03](qa-replay-r7-r19/03-yard-door-before-open.jpg)). It no longer opens the Business teaser. It doesn't say how many days away | – |
| The yard door after yards open, when you can't afford one | **Pass, one link missing** | Long Haul: "A small yard costs 133,054 FD plus a 30,000 FD bond: you have 72,570." under the buttons ([02](qa-replay-r7-r19/02-yard-door-after-open.jpg)). There is no **See what it holds ›** link | L |
| The lease's deposit before the button | **Pass** | "Lease another truck · 45,500 FD deposit · at least 910 FD a week. Needs one truck you own. Lessor has 150 free." Fresh: the three buttons disabled with "Deposit 45,500 FD: you have 24,700." | – |
| Borrow offers only what the lender will lend | **Fail** | Fresh, Finance › Credit: "Truck 2 · up to 55,661 FD at 1% a week over 26 weeks" **Borrow**. The sheet says "You get 55,661 FD · 2,697 FD for 26 weeks". Pressing **Borrow 55,661 FD** answers in red "The pool doesn't have the cash." ([04](qa-replay-r7-r19/04-borrow-pool-refusal-fresh.jpg)). That's the gamer's diary case exactly, same figure. The offer isn't capped at what can be funded | S |
| …about 98% of the cap | **Not seen** | Long Haul, Truck 1: "up to 31,907 FD", exactly 35% of its 91,164 FD value, so the full cap, not 98% of it. That one did lend: cash 40,663 → 72,570, and the row became "Truck 1 · loan · 31,907 FD owed · 1,546 FD a week · 26 weeks left" with **Pay off** ([01](qa-replay-r7-r19/01-borrow-sheet-day58.jpg)). I didn't pay it back | – |
| Borrow not shown while the pools are off | **Can't tell** | Borrow rows show in both worlds. The refusal names "the pool", which suggests the pools are off and the row shouldn't show; if they're on, the refusal is the bug above. Engineering should say which | – |
| The Dealer's per-listing "Delivers today" / "Ordered: arrives {date}" | **Not built** | Both worlds still open with "New trucks are paid now and delivered in 30 days [120 days at day 60]… Used trucks deliver today." Listings have no per-row line, and the buttons are still "Buy today · 20.9k" and "Order the rig · 197.2k" without "arrives {date}" | S |

## R19: the staking card

| Row | Result | Evidence | Sev |
|---|---|---|---|
| Total, discount and term | **Not shown** | Both worlds: "Staking: needed past 5 trucks (20,000 FD to run up to 10)." and "Later: Discounts for locking FD come with lock terms, later in the beta." There's no Staked · {fd} FD in all, no discount row and no term row, and no control to stake, so there's no stake to show. Same as my R20 replay | – |

## The upgrade's payback

| Row | Result | Evidence | Sev |
|---|---|---|---|
| Payback in weeks from the effect (the 5555-week case) | **Not shown** | Long Haul, Truck 1, about day 60: APU, Aero kit, Premium tires and Sleeper all say "Payback unknown until it has run a few weeks." The truck has run since Jan 3 (about 8 weeks, 23.6k miles driven). The 5555 is gone, but no weeks are given for a truck with a long record | S |
| "Payback not yet known" when the inputs aren't there | **Pass, the wording differs** | The line says "Payback unknown until it has run a few weeks." Right on a new truck; wrong at 8 weeks (above) | – |

## Also seen

- **The game's calendar has a Feb 30.** In the parked world the Continue screen said Tue Feb 28. Two days later the clock is Thu, and Truck 1's ETA reads "Feb 30 16:20". So my R20 note ("answer by Feb 30" should be Mar 2) was right about the date, but the cause is the calendar, not the offer's arithmetic. Finance also still shows "Your next payment: 586 FD on Mar 1", a date that hasn't come | S |
- **Machine note:** another session was running vitest (8 processes) while I built the local copy, and free memory was down to about 3,600 pages. The build had already finished when I saw it. I ran nothing else heavy, and memory was back to about 47,000 pages free at the end.
