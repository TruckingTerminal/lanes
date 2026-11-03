# Economy review: the player's second diary. A fleet's first month, the dealer's wait, and R8 (2026-11-02)

Economy designer, for the producer. This answers the three questions from the director's triage of the impatient fleet
owner's diary (`studio/reviews/director-player2.md`, R7 and R8; `studio/playtests/play-2026-11-02-impatient-fleet-owner.md`):
- Does a small-fleet start have a growth path in month one?
- Why did the new-truck wait go from 30 to 61 days?
- What does R8 do to the prudent persona's year?

Nothing is committed. Live levers, the ruleset and the config version are untouched. Every new key defaults to
today's behaviour. With them all at their defaults, a 120-day run (seed 3) is byte-identical to HEAD's.

## Summary

1. **Month one.** On day 28, with 78k and the yard full, today's rules offer the diary's fleet nothing that adds a
   truck. The 2 → 5 path exists, and he took it, but two of his three purchases were used-lot rigs that arrived 44 and
   60 days later. The sixth truck needs about 178k all in: the yard is 120k at the freight index of 2.0, plus 8k tax
   and a 30k bond, plus a 20k stake for the 10-truck tier.
   - **The smallest change is the lot's own wait for a growth truck.** A used-lot rig that adds to a fleet comes from
     the lot's stock in 7 days (`usedMarket.npcLot.deliveryDays` 7, new, null today).
   - A free starter's first truck, which replaces the lessor's, keeps today's queue.
   - On the diary's seed, his fleet runs five trucks from day 24 instead of three.
   - Cash is 120k on day 28 (+37k) and 163k on day 39 (+52k). The sixth truck is 58k away on day 28, not 95k.
   - **It doesn't move the supply path.** Bots buy lot rigs only to replace their lease. With the key set, a 120-day
     run is byte-identical to today's.
   - The version that also sped up the free path's first trucks failed its four-year check: owner-operator
     liquidations rose 16%.
2. **The 30 → 61 days is a rule, but it isn't dealer supply tightening.** The wait is 30 days plus a quarter day for
   every rig on order nationally, and 97–98% of those orders are used-lot rigs. The free path's owner-operators buy the
   lot out in its first two weeks, and every lot rig waits in, and lengthens, the new-truck queue. The wait passes 61
   days by day 11–14, peaks near 128 days around day 42, and drains by day 182.
   - The explain line is below.
   - A second switch (`usedMarket.npcLot.inBacklog` false) takes lot rigs out of the count, and the new-truck wait
     stays at 30–38 days. It changes the bots' world, though: their fleets stop being held off the dealer, and new
     trucks get cheaper. It needs its own four-year check, so it waits.
   - This is my miss. §1 of `economy-reserve.md` measured the day the first truck was bought, not the day it arrived.
3. **R8**, sized only. On the prudent persona the guard is neutral over a year.
   - It holds a first-weeks hire back for four fleets in five, costing about 4 empty seat-days a fleet in month one.
   - At day 365: 2.01 trucks against 2.06, net worth +8k on average (5 seeds of 10), and liquidations 3.8% against
     5.0%. That is noise.
   - On the greedy fleets it costs a ninth of the year's net worth (−59k, lower on 9 seeds of 10) and 5 points of
     liquidations. A cash-thin fleet's empty seat costs more than the wage it saves.
   - So I propose R8 for players only: the guard binds players' companies (`guard.hireCoverHumansOnly`, new, true),
     and the bots' world is unchanged.

Three things for engineering and R7 turned up on the way:
- **BORROW can never lend the figure it offers** (§1d).
- **The $900 dollar yard is over the $500 season cap**, so no one can buy it.
- **A yard alone doesn't lift the truck cap past 5**: the 10-truck tier also needs a 20k stake.

One rule hole too: **a truck on a purchase loan can be pledged again to Equipment Finance** (§1d).

## 1. A small fleet's first month

### 1a. The replay

A scratch diagnostic (`apps/sim/src/p2diag.ts`, in a worktree, not in the tree) builds the web's world, with
`GAME_CONFIG`'s rules, the 400 / 120 / 60 population, and the two-day warm start. It then joins a small fleet at Los
Angeles exactly as `joinCompany` does: two used workhorses (a van and a reefer), 25k FD, $100 play dollars, and the
default standing orders. It plays the diary's moves:
- Quick pay on Jan 5.
- The cheapest BUY TODAY listing (19–21k), on day 3–8.
- A used-lot rig on a purchase loan on Jan 15 and another on Jan 19.

It logs the dealer's wait every day and tries every growth door on day 28 (Jan 29). Three seeds were run.

Seed 3 reproduces the diary almost exactly, so its numbers are quoted below:

| | The diary | Seed 3 replay |
|---|---|---|
| Fleet on day 28 | 3 running + 2 on order | 3 running + 2 on order |
| Lot rigs ordered on → due on | Jan 15 → Feb 28, Jan 19 → Mar 20 (44 and 60 days) | day 13 → day 59, day 17 → day 85 (46 and 68 days) |
| Cash on day 28 | 78k (after a 23.5k APU) | 83.4k |
| Yard price shown | 109.7k + 30k bond | 119.8k + 8.4k tax + 30k bond |

On seeds 1 and 2, the lot was empty whenever the player looked after day 11 and day 18. Free-path bots buy each
weekly 60 on arrival. Those fleets had cap room on day 28, and the only truck on offer was a new rig on a loan: 54k
cash, arriving 106–108 days later.

### 1b. Every door on day 28, today (seed 3: 3 running, 2 on order, 83.4k)

| Door | Result | Why |
|---|---|---|
| Used-lot rig, cash or loan | refused | "company truck cap": fleet plus orders = 5, the no-yard allowance (`token.catalogue.trucksWithoutYard`) |
| New rig on a loan | refused | the same cap |
| The lessor's lease | refused | the same cap; its deposit is 45,500 FD (van) or 54,750 (reefer), 25% of the new rig's 182k / 219k |
| Small yard for FD | refused | 158,177 needed: 119,792 (60k × the freight index 2.00) + 8,385 tax + 30,000 bond |
| …and past 5 trucks | – | the staking tier: 10 trucks need 20,000 staked (`token.staking.truckTiers`), so the sixth truck needs 178k |
| Small yard for dollars | refused | $900 against the season cap of $500 (`token.catalogue.usdWindow.capUsdPerMc`); the test wallet holds $100 |
| More trailer space | refused | needs a yard |
| BORROW | refused | the offer race (1d) |
| Upgrades | open | APU 24.0k, aero 16.0k, tires 12.0k, sleeper 20.0k (all × the index); margin, not trucks |
| A warehouse | open | 45,000 + 3,150 tax; in the four-year runs a warehouse loses about 4.4k a week (v59-ph seed 3) |

**What a fleet owner with 78k on day 28 can do under today's rules:** nothing that adds a truck. He can fit
upgrades, which lift each truck's margin, or buy a warehouse, which loses money. The next real step is the yard and
the stake, about 178k, roughly twice his cash. The design ("difficult, expensive and risky to grow") makes that a
month-two step, and it is.

The trouble is the month one he paid for. Three purchases in two weeks, and on day 28 he still ran the three trucks he
ran on day 8.

### 1c. The four levers, sized

| Lever | What it would open on day 28 | Cost |
|---|---|---|
| **The lot's lead time** (a growth rig from the lot's stock in 7 days; the free path's first truck keeps the queue) | His two lot rigs arrive on days 20 and 24; five trucks running from day 24; cash 120.3k on day 28 (+36.9k) and 163.1k on day 39 (+51.9k); the 6th truck's 178k is 58k away, not 95k | one new key, null today; the bots' world byte-identical (120-day check) |
| The deposit (45.5k, 25% of value) | Nothing on day 28 (at the cap). In week one, at 11.5k cash, the lease opens only if the deposit falls to about 6% of value | rewrites the free path's lease terms; not the smallest |
| The LTV (35%) | Nothing: 35% isn't what refuses. Fixed (1d), BORROW lends 92k on his three trucks, and 83.4k + 92k = 175k nearly reaches the 178k for the yard and stake on day 28 | an engineering fix, no rule change |
| The yard | The sixth truck opens at 83k only if the yard all in falls by about 95k, more than the yard's whole price at a normal index, or if the no-yard allowance rises to 6 (three keys: `trucksWithoutYard`, the 0-stake tier, `assets.yard.none`), which grows every small company | a rule and supply change; not run |

**Recommendation: the lot's lead time, for growth rigs.** It is the only lever that makes month one's purchases pay in
month one:
- With it, the diary's fleet is five trucks by day 24.
- With R7's BORROW fix as well (5 trucks, 122k of capacity), the yard and the stake are within reach by about day 28.
- It changes no price, and the bots never use it.

```
usedMarket.npcLot.deliveryDays: 7      // a lot rig that adds to a fleet, from the lot's stock in a week, like a player dealership's (businesses.kinds.dealership.deliveryDays)
```

As a live lever, it's a replay change, for the ruleset bump that carries R1 and R8. On seeds 1 and 2 the lot was bare
whenever he looked, so the door is only as good as the lot's stock. The daily restock (`usedMarket.npcLot.daily`,
built, off) is the lever for that if Jeff wants it.

**Why not for every lot rig: the four-year check.** I first sized the wider version: every lot rig, the free path's
first trucks included, in 7 days and out of the queue (`deliveryDays` 7, `inBacklog` false). Seeds 1–5, 1,460 days,
the live profile, against today:

| Seeds 1–5 | Today | Every lot rig in 7 days, out of the queue |
|---|---|---|
| Orders on the dealer's books, day 28 / 42 / 91 / 182 | 308 / 374 / 236 / 16 | 234 / 124 / 9 / 14 |
| Owned trucks, day 91 / 182 / 365 | 635 / 816 / 770 | 858 / 816 / 762 |
| Dealer price index (tractor), day 91 / 182 | 1.18 / 1.08 | 0.92 / 0.89 |
| Trucks in service, day 365 / end | 793 / 675 | 785 / 691 |
| Board cleared rate | 3.946 | 3.971 |
| Rate dial (rateMult), day 182 / 365 / end | 0.80 / 0.62 / 0.51 | 0.76 / 0.58 / 0.51 |
| Population dial: entrants; days over / under the band | 40; 55 / 3 | 64; 89 / 18 |
| Sinks ÷ faucets: whole run; after the launch | 90.0%; 96.0% | 90.7%; 95.9% |
| Supply at day 365 / 730 / end (ceiling) | 29.60M / 56.11M / 55.81M (59.37M) | 28.31M / 56.03M / 55.92M (60.45M) |
| Supply at the end, seed by seed | 49.4, 60.2, 63.5, 50.5, 55.4 | 55.0, 58.3, 71.1, 51.9, 43.4 |
| Liquidations over four years | 403 | 420 (higher on 4 of 5 seeds) |
| …of which owner-operators | 100 | 116 |
| Net worth: fleet prudent / greedy | 117.0k / 350.5k | 109.2k / 303.4k |
| Net worth: owner-operator prudent / greedy | 41.7k / 30.9k | 33.9k / 25.5k |

- The mean supply path holds, but seed by seed it swings by up to 12M either way. The rush reorders.
- The clear signal is the owner-operators:
  - They own their worn lot rig 30–110 days sooner, during the starved first months.
  - They carry its loan and its repairs instead of the lessor's share, and 16% more of them fail, most in years 1
    and 2.
- Today's queue is an accidental cushion on the free path. Jeff's step-9 rule ("no easier first truck") points the
  same way.
- So the free path's first truck keeps the queue, and the recommendation touches only growth rigs, which no bot
  buys.

### 1d. Found on the way

- **BORROW offers the exact cap, and the cap falls by the mile.**
  - The Finance list offers `floor(borrowingCapacity)`. `borrow()` refuses anything over the cap + 0.01.
  - The cap is 35% of the truck's value, and value falls as the trailer runs. On a moving truck it drops a few FD an
    hour (−0.60, −0.93, −2.79, −6.81 FD over one game hour on the replays).
  - At Day a minute, an hour is 2.5 real seconds, so the confirm always lands over the cap: "Over the
    loan-to-value limit".
  - Fix (engineering, R7): offer a round figure under the cap (down to the 100, or 98% of it), or have the engine lend
    `min(asked, cap)` when the ask is within 2%. No rule change.
- **The dollar yard can't be bought.** `itemPriceUsd(yardSmall)` = 60,000 × $0.01 × 1.5 = $900, but the catalogue's
  season cap is $500 a company. Either hide the button or say what opens it. The cap is the rule.
- **The yard alone doesn't lift the cap.** With staking on and the lock discounts off,
  `truckCap = min(stake tier, yard)`. A yard bought with nothing staked still caps the fleet at 5. The yard's card has
  to say "10 trucks with 20,000 staked".
- **A double pledge (a rule hole).**
  - `borrowingCapacity` checks only Equipment Finance loans (`activeLoanOn`), not purchase loans.
  - So a lot rig bought on a purchase loan for 13.3k cash can be pledged at once for 35% of its 44.5k value, about
    15.6k. That is a truck and 2.2k of cash for nothing down, up to the cap, and the bots' `borrowFor` uses it too.
  - Suggested fix: the capacity is `max(0, 0.35 × value − purchase-loan principal)`, so a freshly financed rig lends
    nothing.
  - Not built. It changes the bots, so it needs its own batch. It matters once BORROW works.

## 2. The new-truck wait: 30 → 61 days

**The rule** (`dealer.ts deliveryDays`): `min(150, round(30 + 0.25 × orders on the dealer's books nationally))`. There
is no supply term. The wait moves only with the backlog. The NPC used lot's rigs are booked as dealer orders
("delivered like a new one"), so they count.

**What fills the backlog** (replays; wait in days / orders / of which used-lot rigs):

| Day | Seed 1 | Seed 2 | Seed 3 | Seed 3, the old lot (15 a week, 30) | Seed 3, lot rigs out of the count (`inBacklog` false) |
|---|---|---|---|---|---|
| 6 | 31 / 2 / 1 | 31 / 3 / 0 | 31 / 4 / 0 | 31 / 4 / 0 | 31 / 4 / 0 |
| 11 | **61** / 122 / 121 | 45 / 60 / 57 | 36 / 24 / 19 | 36 / 24 / 19 | 31 / 24 / 19 |
| 14 | 76 / 182 / 181 | **61** / 124 / 121 | 49 / 77 / 72 | 43 / 50 / 45 | 31 / 77 / 72 |
| 21 | 91 / 243 / 241 | 91 / 245 / 240 | 89 / 235 / 230 | 46 / 65 / 60 | 31 / 235 / 230 |
| 28 | 108 / 310 / 301 | 106 / 305 / 300 | 103 / 292 / 287 | 51 / 82 / 75 | 31 / 292 / 287 |
| 39 | 125 / 378 / 359 | 115 / 338 / 335 | 114 / 336 / 336 | 57 / 106 / 90 | 30 / 349 / 349 |

Over four years (v59-ph seed 1, today's live profile), the backlog peaks at 393 orders around day 42 (a 128-day wait).
It drains to 12 by day 182 (33 days) and stays near 30–42 days after that.

**So it is by rule, and the cause is the free path's first-truck rush on the used lot.**
- The lot opens with 120 rigs and takes in 60 a week. Four hundred free-path owner-operators can all afford one by
  about day 12.
- Every rig sold becomes a dealer order, and every order adds a quarter day to everyone's wait, including the new
  trucks the lot was never meant to touch.
- The old lot (15 a week, 30) had the same shape at half the height: 51 days by day 28, 57 by day 39. When it ran dry,
  the free path bought new rigs instead.
- The 60/120 lot of the 11-03 restart doubled the rush. My four-year check of it (economy-reserve.md §1) passed on
  liquidations, rates, the dial, sinks and supply. Its "first owned truck" measure was the purchase day, so it missed
  that delivery came a 60–128-day queue later in the first four months. I should have caught it.

**It costs more than the wait.**
- The bots' fleets order new trucks only while `deliveryDays ≤ maxLeadDays`, so fleet growth stalls for the first
  four months.
- The dealer's monthly price index reads the same backlog (`monthlyDealerPrices`, backlog = (wait − 30) ÷ 30), so
  new trucks get dearer.
- A lot rig bought on day 13 runs from day 59.

**The explain line** (the writer's to word; the engine now exposes `dealerBacklog(w)` = `{ orders, usedLot, counted }`):

- Today: "New trucks take **{days}** days: the dealer's 30, plus a day for every 4 rigs on order nationally
  ({orders} now, {usedLot} of them from the used lot). Used-lot rigs wait in the same queue."
  - Keys: `dealerDelivery.baseDays` 30, `dealerDelivery.daysPerPendingOrder` 0.25, `dealerDelivery.maxDays` 150.
- With the recommended key (`deliveryDays` 7), the used lot's line changes and the new-truck line stays as above:
  "Used lot: a rig for your fleet arrives in 7 days. A first truck replacing the lessor's waits in the dealer's
  queue."
- If Jeff later takes lot rigs out of the count (`inBacklog` false): "New trucks: {days} days, the dealer's 30 plus a
  day for every 4 new rigs on order nationally ({counted} now)." This needs its own four-year check first, because it
  lifts the wait that holds the bots' fleets off the dealer, and the dealer's index falls (1.18 → 0.92 at day 91 in
  the wider check above).

## 3. R8: auto-staff off by default, and never hiring what the company can't pay

**The rule as built** (`labor.ts autoStaff`; switches `guard.hireCoverWeeks`, 0 today, and `guard.autoStaffDefault`,
true today; R8 is 4 and false):
- **The guard.** Auto-staff doesn't hire while cash is under `hireCoverWeeks` × the new wages of the pass. The wages
  are summed across the pass's hires, so three drivers and a dispatcher need four weeks of all four.
  - A driver's week is their asking rate × `labor.hiring.milesPerWeek` (1,000 mi, the week the sign-on bonus and
    severance use). A 0.75/mi driver is 750 a week, so the hire needs 3,000.
  - A dispatcher's week is the quoted weekly pay (843 in the diary, 3,372 to hire), not the retainer that a small
    fleet is billed (`payDispatchers`: a quarter of the quote for a fleet of three). The quote is what the payroll
    shows, and the bill rises to it as the fleet grows.
  - Managers keep their own guard: eight weeks of pay (`autoManagers`).
- **The Needs-you line.** The first hire held back on a pass is left on the company as
  `hireBlock = { staffId, kind, weeklyFd, needFd, day }`, for the line "A seat is empty: hiring {name} at {weeklyFd}
  a week needs {needFd}". It clears on the next pass that holds nothing back.
- **The default.** A human company's `autoStaff` starts at `guard.autoStaffDefault`. Bots always auto-staff.
- **The scope.** `guard.hireCoverHumansOnly` (new, true) limits the guard to players' companies. The bots'
  auto-staff is how they run, and a player's is a service the engine runs for them. The guard limits the service.
  The batch below ran with it off (the guard on every company) to size the cost on the personas.
- `guard` is a new top-level block. Engineering's UI keys (`confirmShareOfCash`, `newsFd`) go in it.

**The diary under R8.** On Jan 5–6 he had 772 FD.
- The driver (about 750 a week) needs 3,000 of cover. Both hires (750 + 843 a week) need 6,372.
- So R8 holds both, and the Needs-you line names them.
- On the seed-3 replay with the guard on, the same pass hired the second driver at 5,015 FD of cash and held the
  dispatcher ("820 a week needs 6,780"). The dispatcher was hired 24 game hours later, once a delivery paid on
  Quick pay.
- The cost is a day of dispatch on the third truck, and the "772 against 415 a week" scare goes away.
- With `autoStaffDefault` false, the second truck's seat waits for his tap, as Iuliia offers it.

**The prudent persona's year** (`apps/sim/src/r8.ts`, scratch: the sim's population and live profile, seasons off as
in the live world, 365 days, seeds 1–10, R8's guard on against today):

Each fleet persona has 40 companies a seed. "Held back" means the guard held at least one hire. Seat-days and
under-dispatched days are cumulative from day 0.

**The prudent fleets (`fleet:conservative`):**

| | Today | Guard on (4 weeks, every company) |
|---|---|---|
| Fleets held back at least once | – | 79.5%, 2.6 passes each, all in the first weeks (the share doesn't rise after day 28) |
| Empty seat-days a fleet, days 1–28 | 0.0 | 4.4 |
| Days under-dispatched, days 1–28 | 0.1% | 6.1% |
| First dispatcher hired (median day) | 1 | 3 |
| Trucks: day 28 / 91 / 182 / 365 | 3.78 / 3.38 / 2.85 / 2.06 | 3.76 / 3.38 / 2.87 / 2.01 |
| Net worth at day 91 / 182 (mean) | 541.7k / 471.9k | 541.8k / 472.5k |
| Net worth at day 365, mean / median | 427.6k / 361.6k | 435.6k / 356.8k |
| Liquidated by day 182 / 365 (the wind-up) | 3.8% / 5.0% | 2.3% / 3.8% |
| Cash a fleet at day 365 | 168.1k | 174.1k |
| Net worth higher at day 365 | – | 5 of 10 seeds (+8.0k mean) |

**Day 365, the other personas** (guard on minus today):

| Persona | Net worth (mean) | Seeds higher | Liquidated | Trucks |
|---|---|---|---|---|
| Fleet, greedy | −59.2k (538.3k → 479.1k) | 1 of 10 | 24.0% → 29.0% | 2.53 → 2.29 |
| Fleet, random | −8.7k | 4 of 10 | 19.7% → 22.0% | 2.01 → 1.80 |
| Owner-operator, prudent | −1.2k | 5 of 10 | 5.4% → 6.2% | 1.24 → 1.26 |
| Owner-operator, greedy | +2.2k | 9 of 10 | 6.6% → 6.9% | 1.41 → 1.49 |
| World supply at day 365 | 53.32M → 51.76M (−2.9%) | | | |

**Reading it.**
- The guard binds at the start, when every fleet is cash-thin (11–12% of fleet-days under 5k in month one) and
  hiring its seats.
- The prudent fleet carries enough cover that the hold costs a few seat-days and nothing over the year.
- The greedy fleet runs at the edge all year. A seat held empty still carries its truck's payments and insurance,
  so the guard deepens the hole it was meant to protect.
- Owner-operators barely hire, so it barely touches them.
- For a player, the rule is about consent, not economics: auto-staff shouldn't spend what the player can't see
  coming. Scoped to players, it does that without moving the bots' world.

**Recommendation for Jeff's call (R1's bump):**
```
guard.autoStaffDefault: false      // R8: a player's auto-staff starts off; Iuliia offers it at the first empty seat
guard.hireCoverWeeks: 4            // R8: auto-staff holds a hire while cash covers under 4 weeks of the new wages
guard.hireCoverHumansOnly: true    // (the default) players only; the bots' world unchanged
```
- With these three values, the sim's world is byte-identical to today's (a 120-day check, seed 3). The sim has no
  players, so the guard and the default touch nothing in it.

## Files

Working tree only. `economy.config.ts` needed no merge, and its version line is untouched.

- `packages/config/src/economy.config.ts`:
  - `usedMarket.npcLot.deliveryDays` (null) and `usedMarket.npcLot.inBacklog` (true), new.
  - A new top-level `guard` block: `hireCoverWeeks` 0, `hireCoverHumansOnly` true, `autoStaffDefault` true.
- `packages/engine/src/dealer.ts`: `deliveryDays` counts through the new `dealerBacklog(w)` = `{ orders, usedLot, counted }`.
- `packages/engine/src/dealerships.ts`: `lotDeliveryDays(w, replacesLease)`.
- `packages/engine/src/actions.ts`: a used-lot order takes `lotDeliveryDays`.
- `packages/engine/src/labor.ts`: the hire guard in `autoStaff`, and `weeklyWage`.
- `packages/engine/src/types.ts`: `Company.hireBlock?` and `Company.hireBlockedDays?`.
- `packages/engine/src/world.ts`: a human company's `autoStaff` starts at `guard.autoStaffDefault`.
- `packages/engine/test/hire-guard.test.ts` (new): 5 tests.
- `packages/engine/test/lot-lead.test.ts` (new): 3 tests.

Typecheck is clean, and both new test files pass (8 tests). No full `npm test`, per the machine rule.

Scratch, not in the tree (in the worktree `p2b-wt`): `apps/sim/src/p2diag.ts` (the diary replay) and
`apps/sim/src/r8.ts` (the persona year).

Runs are in `runs/p2/`:
- `diag-*`: the replays; `f1` is lot rigs out of the count, `f2` is both keys, `f3` is the recommended key, and
  `lot15` is the old lot.
- `r8-0` and `r8-4`: the persona year, ten seeds.
- `lot4y-0` and `lot4y-7`: the four-year check, five seeds.
- `same-*`: the identity checks.
