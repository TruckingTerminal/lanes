# Economy review: diaries 3 and 4, sized as one package for the next restart (2026-11-03)

Economy designer, for the producer and Jeff. This sizes the director's rulings from the working trucker's diary
(`studio/reviews/director-player3.md`, R11–R15) and the gamer's diary (`director-player4.md`, R16–R20), plus R1's bid
anchor, as one ruleset bump for the next restart. It is written in stages, in Jeff's order (DECISIONS.md, 2026-11-02):
1. R17 and R16;
2. R11 with R1's bid anchor, and R12's clocks;
3. R18 and what the "always" options cost;
4. the R1, R8 and contracts group;
5. Borrow and the purchase-loan double pledge, R15, and the owner's driving pay.

Every rule is built behind a key whose default is today's value. With every key at its default, the code reproduces
today's world to the byte: a four-year run, seed 1, is identical to player2's baseline.

**The two ends.** The director named two months: the gamer's 271,665 FD and the honest trucker's 30,503.
`apps/sim/src/p34diag.ts` (scratch) replays both on the web world's rules, with six seeds each:
- **The gamer:** a small fleet at Chicago, then the diary's moves. A five-star driver into truck 2, policy all the way
  up (15 h always, 56 mph always, deferred), the cheapest truck on a loan, the dispatcher at break-even + 300%, pay cut
  to the least allowed every day, quick pay on day 9, and two more cheap trucks as soon as there are any.
- **The trucker:** an owner-operator on the lessor's truck at Memphis, legal, on the default orders.
- **The gamer's three levers, taken off one at a time:** pay at the driver's ask ("pay at market"), the margin at 25%,
  or the legal policy. "Honest" takes all three off.

"Kept" is the engine's first month-close record (`Company.firstMonth`: earned less spent), the figure on the month
card.

## Stage 1: R17 (a ceiling is a ceiling) and R16 (the pay floor)

### 1a. R17, as built

- **`board.refuseOverCeiling`** (new, false today): the engine refuses a bid above the load's ceiling, with the reason
  "above the ceiling, {rate}/mi" (`place_bid`, so R20's answer is the engine's). A dispatcher whose floor sits above
  the ceiling doesn't bid at all (`standingOrders.ts priceLoad`).
- **`board.overCeilingMax`** (today 1.5): the R17 value is 1. The hard cap becomes the ceiling, so a dispatcher whose
  margin would take its bid over the ceiling bids at the ceiling.
- **Contract tenders are untouched.** They pay the contract's rate, signed ahead of time, and that rate can sit above
  the spot load's ceiling. They are about 1% of loads and counted apart below.
- A load nobody takes at its ceiling keeps today's path: the ceiling rises 10% and the book-now 12% each round it
  waits.

**Today, a fifth to a third of the spot board clears above its ceiling.** `apps/sim/src/p34.ts` is run.ts's world
and report, with every win tallied against the load's ceiling at the moment it cleared. These are today's rules, seeds
3–5:

| Year | Spot wins above the ceiling | FD paid above ceilings, a seed | Share of board revenue | Contract tenders over the spot ceiling |
|---|---|---|---|---|
| 1 | 24.5% | 18.1M | 3.5% | 47% of 1,965 (0.57M above) |
| 2 | 30.7% | 23.3M | 7.1% | 42% of 892 |
| 3 | 29.7% | 23.4M | 7.2% | 43% of 873 |
| 4 | 32.7% | 25.7M | 8.6% | 41% of 573 |

- These are loads nobody bid under, won at up to 1.5 times the ceiling. Most land at the cap.
- The owner-operators lean on them most: 29–33% of their wins and 6–8% of their revenue, against 4–5% for the
  fleets.
- The diary's wins at 12.46–18.24/mi came from this rule, or from loads whose ceilings had climbed by rollover. Under
  R17 no bid passes the load's own ceiling.
- With R17 on, none are left.

### 1b. R16, as built

- **`labor.payFloorShareOfMarket`** (new, 0 today): no driver's pay may be set or offered below this share of their
  market rate. `set_staff_pay` and offers refuse it with "below the pay floor: {fd}/mi, {share} of their market rate".
- **`labor.unhappyNoticeDays`** (new, 0 today): an unhappy driver (morale under `labor.morale.unhappyBelow`, 0.3, the
  Staff page's "unhappy") gives notice. They leave that many days later unless their pay goes back to what they'd ask
  elsewhere.
  - The notice is a line with the days and the figure: "{driver} has given notice: unhappy with pay or how they're
    treated. They leave in 7 days unless their pay goes to {ask}." Engineering can make it the Needs-you item from
    `Staff.unhappyNotice`.
  - A raise to their ask in time withdraws it: "{driver} is staying: you raised their pay in time."
- **Rivals hire unhappy drivers first.** A driver on an unhappy notice moves to a rival for their plain ask, with no
  loyalty premium. The bots' poaching takes them before anyone else.
- **`labor.underpayMemory`** (new, `{ days: 0, askPremium: 0 }` today): once a driver leaves a company unhappy, every
  driver asks that company `askPremium` more for `days`.
- **An offer settles at the truck's next stop** (QA's poach row, which failed three times; engineering found the
  cause). `labor.hiring.settleAtStop` is new and false today.
  - Today an offer past its notice settles only at the day's close, and only if the driver's truck is stopped then.
    An NPC fleet's driver is nearly always rolling, loading or resting at midnight. The offer waited forever, no
    notice fired, and the seat stayed empty.
  - With the key on, the offer settles the hour the truck next stops at a hub, which is soon after its deadline.
  - **I chose the next stop** over "leave at the deadline, wherever the truck is". A driver doesn't walk off a loaded
    truck mid-route, and the stop comes within hours.
  - It changes the bots' labor market (poaching that today never completes will), so the key is at today's value. It
    isn't four-year sized. I'd turn it on with the bump, because the poach is a button a player can press today and
    it never pays off.
- **Pay the market leaves under the floor** (the red team's pass 3, added behind `payFloorShareOfMarket`). The floor
  binds when pay is set. A driver's market rate moves, though, and pay set at the floor can end up under it.
  - **The rule I chose:** the floor is re-checked at the daily labor pass, and a drift under it counts as underpay.
    R16's notice runs: "{driver} has given notice: the market has moved and their pay is under the floor. They leave
    in 7 days unless their pay goes to {floor}."
    - A raise to the floor in time withdraws it. The company did nothing wrong, so the floor is enough and the ask
      isn't needed.
    - Ignored, the driver leaves at the end of the notice, and the underpay memory is written.
  - **Why this one and not a separate Needs-you item.**
    - The notice already carries both halves of the other option. It is the Needs-you line engineering reads from
      `Staff.unhappyNotice`, and it gives the company the notice days and the figure to raise to.
    - It runs through the same withdrawal, memory and rival-first rules as every other R16 notice, so there is one
      rule to explain, not two.
    - A warning with no consequence would leave the floor binding only at the moment pay is set.
  - It reaches the bots too, for drivers whose pay the greedy ones never raise as the wage index climbs. It isn't
    four-year sized.

**The values.** At a pay of x times market, a driver's morale drifts to 0.6 + 2(x − 1), less the penalty for being
pushed to break rules. At x = 0.85 that is 0.3, exactly the "unhappy" line, so a driver held at the floor of a legal
company ends up unhappy and gives notice. I propose:
- `payFloorShareOfMarket` 0.85;
- `unhappyNoticeDays` 7;
- `underpayMemory` { days 56, askPremium 0.1 }.

**What underpaying is worth.** These are the pay books of the gamer's month: the replay counts, day by day, each hired
driver's ask less their pay, times the miles they drove. Six seeds; R17 is on in the three R16 rows.

| R16 floor (notice 7 days, +10% for 56 days) | Wage saved in the month | Saved per hired mile | Notices / quits | Seat-days empty |
|---|---|---|---|---|
| None (today): a penny a mile | 29.0k | 0.82 | 0 / 0.2 | 1.0 |
| 0.80 | 7.1k | 0.18 | 3.8 / 2.2 | 1.0 |
| **0.85** | **5.6k** | **0.14** | 4.3 / 1.8 | 1.0 |
| 0.90 | 4.3k | 0.11 | 2.3 / 1.2 | 1.0 |

At 0.85 the penny-driver lever is worth about 1.4k per hired driver a month, against 7k today, and the drivers turn
over every few weeks.
- Going to 0.90 saves 1.3k more and takes away a real decision (a 10% cut that keeps a driver restless). I'd keep 0.85.
- Shorter notices and a bigger memory premium hardly moved the books. Auto-staff refills a seat the next day. The
  memory premium only stops the cheapest rehire.

**On the bots.** No bot pays under its drivers' ask. R16 reaches them through the unhappy notice:
- Today 9.5–15% of the bots' driver-days are spent unhappy (rules pushed, pay overtaken by the market). Those drivers
  sit and drive.
- Under stage 1 it is 3–4.5%, with 3.3–5.8% of driver-days on notice. They are raised in time or replaced.
- The persona results are in 1d.

### 1c. The two ends after stage 1

Six seeds. "Stage 1" is R17 plus R16 at the values above.

| The month | Today: earned / spent / **kept** | Stage 1: earned / spent / **kept** |
|---|---|---|
| The gamer, every lever | 299.4k / 93.0k / **206.4k** | 326.5k / 128.2k / **198.3k** |
| …pay at market | 298.3k / 126.0k / **172.3k** | 321.1k / 129.3k / **191.7k** |
| …margin at 25% | 307.3k / 100.6k / **206.8k** | 331.3k / 136.4k / **194.9k** |
| …legal policy | 268.0k / 89.1k / **178.9k** | 282.4k / 112.0k / **170.4k** |
| …honest (all three off) | 274.0k / 125.4k / **148.6k** | 257.3k / 114.5k / **142.8k** |
| The trucker | 70.4k / 34.5k / **35.9k** | 58.3k / 31.2k / **27.1k** |

**What stage 1 closes and what it leaves.** A world diverges from the first changed decision, so a single month swings
±15k between seeds. The lever-by-lever reading is the one to trust.
- **The penny drivers are closed.** The books fall from 29k a month to 5.6k. Under stage 1, the "pay at market"
  variant keeps 6.6k less than the full exploit, in line with the books.
- **The 300% margin.** In these replays it was never the money printer. It won only 3 loads a month above a ceiling
  (2.5k above the ceilings).
  - Its trick was the interaction with penny pay: four times a near-zero break-even comes in under most ceilings.
  - With the floor that is gone. Under R17 a bid can't pass the ceiling at all.
  - Stage 1 leaves the margin worth 3.4k a month, in noise.
- **What's left is not a pay or a bid problem.**
  - **The rule-breaking policy is still worth 28k a month** (full against legal) after its fines. That is stage 3's
    job (R18).
  - **The fleet start's honest month is 143–149k against the trucker's 27–36k.** It is four or five trucks in a hot
    first month against one leased truck, and the first month clears at 6.57/mi with a 54% margin over break-even
    (the four-year runs, month 1). That is stage 2's job (R11's levels).
- **The trucker's month is a little lower under R17** (27.1k against 35.9k, lower on 5 of 6 seeds) with a spread of
  8.6k–47k a seed. I read it as the board re-sorting in month one. R11 re-prices the same month anyway.

### 1d. Stage 1 over four years

`apps/sim/src/p34.ts`, seeds 1–5, 1,460 days, the live profile, against today:

| Seeds 1–5 | Today | Stage 1 (R17 + R16) |
|---|---|---|
| Board cleared rate | 3.946 | 3.907 |
| Rate dial (rateMult), day 182 / 365 / end | 0.80 / 0.62 / 0.51 | 0.81 / 0.64 / 0.54 |
| Sinks ÷ faucets: whole run; after the launch | 90.0%; 96.0% | 90.4%; 95.8% |
| Supply at day 365 / 730 / end (ceiling at the end) | 29.60M / 56.11M / 55.81M (59.37M) | 29.63M / 55.66M / 60.30M (59.23M) |
| Liquidations over four years | 403 | 478 (higher on 5 of 5 seeds) |
| …owner-operators / fleets / brokers / newcomers | 100 / 46 / 59 / 57 | 136 / 39 / 59 / 61 |
| …year 1 / 2 / 3 / 4 | 79 / 79 / 93 / 153 | 81 / 116 / 108 / 173 |
| Net worth: fleet prudent / greedy | 117.0k / 350.5k | 129.7k / 323.0k |
| Net worth: owner-operator prudent / greedy | 41.7k / 30.9k | 46.9k / 27.7k |
| Trucks in service, day 365 / end | 793 / 675 | 791 / 668 |
| Population dial entrants | 40 | 36 |

**Reading it.**
- **The prudent persona gains and the greedy one loses, in both segments** (+11–12% against −8–10% of net worth).
  That's the pillar Jeff named: prudence wins over time.
- **The cost is the owner-operators.**
  - Liquidations are 19% higher. The extra ones are owner-operators (+36%), in years 2–4.
  - They lived on the above-ceiling wins: up to 8% of their revenue, in markets nobody else would cover.
  - Under R17 those loads roll up to a ceiling that fits instead. The owner-operator wins them later and cheaper, or
    not at all.
- **Supply ends 8% higher, just over the published path** (60.3M against a 59.2M ceiling). At day 730 it is
  unchanged.
  - The dial sits a little higher (0.54 against 0.51 at the end). It is giving back some of the revenue R17 took.
  - Liquidations release bonds and stakes.
- **The fix belongs in stage 2, not in a softer R17.**
  - Today's ceiling isn't the shipper's real limit: a third of the board clears above it, mostly at 1.5 times.
  - R11 re-prices the ceiling and book-now together. The ceiling markup (`rates.npcCeilingMarkup`, 1.15 today) can go
    to where loads truly clear in a thin market.
  - The rollover steps decide how fast a waiting load climbs.
  - I'll size the markup in stage 2 against these owner-operator liquidations and the path.
- R17 alone, without R16, is still running (seeds 1–3 of 5 in). Stage 2's report will split the two.

### 1e. Stage 1's recommendation

```
board.refuseOverCeiling: true           // R17 (new key)
board.overCeilingMax: 1                 // R17 (today 1.5)
labor.payFloorShareOfMarket: 0.85       // R16 (new key)
labor.unhappyNoticeDays: 7              // R16 (new key)
labor.underpayMemory: { days: 56, askPremium: 0.1 }   // R16 (new key)
```
With the ceiling markup re-sized in stage 2 against the owner-operator liquidations above.

## Files (stage 1)

Stage 1 is applied to the working tree only, ported onto main at `cec0692`. The version line is untouched; the
version is proposed with the whole bump.

- `packages/config/src/economy.config.ts`:
  - `board.refuseOverCeiling`;
  - `labor.morale.unhappyBelow`, `labor.payFloorShareOfMarket`, `labor.unhappyNoticeDays`, `labor.underpayMemory`;
  - `ui.iuliia.captionMinutes` 5 (the producer's ask for engineering: the caption's retire time, no rule reads it).
- `packages/engine/src/actions.ts`: `place_bid` refuses above the ceiling; `set_staff_pay` refuses below the floor.
- `packages/engine/src/standingOrders.ts`: no dispatcher bid above the ceiling under R17.
- `packages/engine/src/labor.ts`: `payFloor`, `askOf`, the unhappy notice and its withdrawal, the underpay memory,
  and auto-staff hiring at `askOf`.
- `packages/engine/src/types.ts`: `Staff.unhappyNotice?` and `Company.underpaidUntilDay?`.
- `packages/agents/src/ruleBots.ts`: the bots' poach takes drivers on an unhappy notice first, for their ask.
- `packages/engine/test/pay-floor.test.ts` (new): 4 tests.

Typecheck is clean, and the new test file passes. No full npm test.

Scratch, not in the tree (worktree `p34-wt`): `apps/sim/src/p34.ts`, `p34diag.ts` and `policy.ts`. Runs are in
`runs/p34/`: `ends/`, `books/`, `grid/`, `y4-today`, `y4-r1617`, `y4-r17`.

## Stage 2: R11 (the board) with R1's bid anchor, and R12's clocks

### 2a. The market's anatomy today

`apps/sim/src/anatomy.ts` (scratch) uses the live profile with seasons off, as in the live world, for 240 days. It
tallies every spot win: taken at book-now or by bid, and its rate against the load's posted reference, its book-now and
its ceiling. The reference is what the board labels "usually clears near" (`apps/web/src/board.ts clearsNear`). Seed 1,
today's rules:

| Months | Spot rate | × the reference | Bids won at | Book-now | Ceiling | Taken at book-now | Trip margin | Rate dial |
|---|---|---|---|---|---|---|---|---|
| 1 | 6.98/mi | 1.62 | 0.76 × ref | 1.78 × ref | 1.80 × ref | 81% | 56% | 1.00 |
| 2–3 | 6.12 | 1.91 | 1.25 | 1.98 | 2.01 | 78% | 57% | 0.93 |
| 4–6 | 4.22 | 1.80 | 1.67 | 1.58 | 1.69 | 56% | 48% | 0.82 |
| 7–8 | 4.36 | 1.71 | 1.60 | 1.57 | 1.66 | 62% | 51% | 0.83 |

**What sets the price is how long a load waits, not what it's posted at.**
- Freight piles up where trucks are few. Every unfilled round lifts the ceiling 10% and the book-now 12%.
- A load is taken, at book-now, three to six rounds later, at 1.6–1.9 times the reference.
- The board's "usually clears near" is the reference, so it reads about half of what loads actually pay. That is the
  trucker's "book-now at two to three times what a lane clears", and his "book the top".
- A bid at break-even + 25% (the default rule) wins only the loads nobody else wanted: 2.7/mi against 7.2/mi at
  book-now in his month.
- The same wait makes the start a surge. The 10-day average cleared rate rises 120–146% in the first ten days (seeds 1
  and 2): "rates tripled in ten days".

### 2b. The levels: why I don't cut them in this bump

The trip margin is 56% of gross in month one and 42–51% after it (fuel, wages, maintenance, tolls and the lessor's
share against the load's pay). A real carrier's is nearer 25–35%. The two levers that bring it there, both with the
stage-1 rules:

| Six seeds, month one | Today | Rate dial opens at 0.6 (`token.circular.rateStabilizer.start`, new) and slower rollover steps | Dial at 0.6 and the ceiling markup 1.3 |
|---|---|---|---|
| Month-one trip margin | 56% | 38.5% (33–36% in months 4–8) | 45% |
| The trucker's month kept | 35.9k | **7.1k** | 18.4k |
| The honest fleet's month kept | 148.6k | 35.2k | 83.0k |

- Costs are about half of gross, so a third off the rate takes four fifths of the trucker's month.
- Today's dial opens at 1.0 and walks down 5% a month to its floor (0.5) by about month 18. The first months are a
  launch boom by construction.
- "Costs up" does the same to his month.
- **So the levels stay in this bump.** Your target (the trucker's month not below today) and R11's band can't both be
  met by rates or costs alone.
- What closes the distance honestly is the shape below (bidding that pays, a true "clears near") and stage 5's
  owner's draw. The draw is 0.75/mi charged to the owner-operator and paid to no one: about 6–7k of his month.
- If Jeff wants the band anyway, the dial's start is the one key, and the table is its price.

### 2c. The shape: a true "clears near", bids anchored to it, and a ceiling the market fits

**Built, every key at today's value:**
- `noteClear` / `clearsNear(w, load)` (new, freight.ts): what a lane really clears at.
  - It trails every spot clear (not contract tenders) by lane and trailer, falls back to the origin market's, then to
    the reference, and never sits above the ceiling.
  - The board's "usually clears near" should read it (engineering, `apps/web/src/board.ts`). Today that label shows the
    reference, half of what loads pay.
- `{ mode: "clearsNear", pct }` (new bid price mode): R1's anchor. The bid is what loads usually clear near, plus pct,
  with break-even as the floor.
- `bookNow.towardCeilingRounds` (new, 0): book-now walks from where it opened to the ceiling over that many rounds.
- `rates.npcCeilingMarkup` (1.15) is the ceiling over the reference. R17 makes the ceiling binding, so it has to sit
  where a thin market really clears.

**What I tried first and set aside: posting the reference where loads clear.**
- The reference at 3.7/mi (against 2.45), the dial's room scaled to [0.33, 1.2], slower steps (+5% / +6% a round), and
  the walk.
- On the board it did everything R11 asks. Loads cleared at 1.17–1.32 times the reference, not 1.54–1.71. Book-now
  sat 30% over it. The surge fell from 120–146% to 74–92%. The level stayed today's. Owner-operator liquidations went
  back to today's.
- Over four years it wrecked the supply path: 153M at the end against an 82M ceiling, and 76M at day 730 against
  today's 54M.
- The dial walks down 5% a month from a higher start, so the beta overpays for 20 months. The launch then locks the
  rate in, and nothing post-launch can take it back.
- That needs a faster or lower-starting dial, which is a beta-economy decision, not a board one. It is not in this bump.
- The walk alone changes nothing, because waited loads book once the ceiling has climbed. It stays built at 0.

**In the bump:**
- The true "clears near". Today's 1.6–1.9 times the reference is what loads clear at, so book-now reads 5–10% over
  "clears near", not two to three times.
- R1's anchor at it.
- The ceiling markup at 1.3 (§2f), for the thin markets R17 closed.

**Bidding at the true "clears near" pays** (the trucker's month, six seeds, with markup 1.3, R12 and the rest of §2f):

| | Default rule (break-even + 25%) | R1's anchor (clears near, break-even the floor) |
|---|---|---|
| Month kept | 25.7k | 28.9k |
| Bids win at / book-now pays | 2.91 / 7.37 per mile | **4.79** / 6.93 |
| Loads won by bid | 26% | 25% |

- **R1's anchor is the default rule I propose** for a player's dispatcher (engineering's `joinCompany` order set):
  `{ kind: "bid", price: { mode: "clearsNear", pct: 0 } }`, with the floor at break-even + 5%.
- A bid at the market's own rate wins at 70% of book-now, not 40%. Bidding is a real choice: a little less for the
  load, against waiting for book-now.
- Bots keep their persona rules, so the anchor doesn't move the bots' world.
- A single replayed month swings 17–47k between seeds. The bots' prudent owner-operators measure the month better:
  37.4k operating today, 37.1k under stage 1 and 36.3k under the package. That is −3%, R12's hours.

### 2d. Short loads, the season table, booms and slumps

- **Short loads.** A short load is already a minimum charge (`rates.shortHaulBonus`, 120 FD a load) plus a mile rate.
  Loads under 150 miles pay 0.9–1.4 times the board's average mile rate, about a real short haul's premium.
  - The 92 miles for 1,013 FD was month one's level, plus the empty-run-out charge counted per loaded mile.
  - `rates.exitDeadheadMaxShareOfMiles` (new, null) caps that charge at half the loaded miles. It takes 3–4% off short
    loads.
- **The season table, checked against the calendar.** It is beagl.ai's seasonal rate per mile by origin, and it's
  right as a rate curve: the north's January capacity squeeze.
  - The engine also reads it as freight volume (`rates.seasons.volumeGain` 3). That posts up to 1.57 times the freight
    out of Fargo in January, and makes 54 of the 60 hubs busier than average in the first weeks of the year, when real
    volume is at its low.
  - At `volumeGain` 1, no hub posts 20% more freight in January. Fargo is +19%, against +57%.
  - The rate swing stays.
- **Booms and slumps, announced.** `marketMood(w)` (new, freight.ts; keys `rates.news`: 7 days against the 28 before,
  ±15%) reads the market as booming, slumping or steady. It is for the ticker line, the first-boom milestone and the
  hub cards' word; no rule reads it.
  - Under the package (seeds 1–2, 240 days) it reads booming on 23–28 days and slumping on 18–23.
  - The launch surge (2a) stays: the biggest 10-day rise is 108–133%, against 120–146% today. It is the first boom,
    and now the player is told about it.
  - Pacing it further means the slower steps, which cut month one's revenue (§2b), or the higher posted reference,
    which broke the supply path (§2c).

### 2e. R12: the 70-hour clock and the 34-hour restart

- **`hos.cycleHours`** (new, 0) and **`hos.restartHours`** (new, 34): a driver may drive cycleHours since their last
  restartHours off duty in a row. A team truck gets twice that.
  - It is counted in driving hours. Loading time is left out, so the clock is a little looser than the real one.
  - A falsified log drives through it, and each day past it goes on the hidden log for R18's auditor.
- **The bump's R12 values, with engineering's keys:** `hos.restHours` 10, `hos.breakMinutes` 30 after 8 hours,
  `fuel.stopEveryMi` 400 for `fuel.stopMinutes` 15, and `hos.cycleHours` 70.
- **R12 alone on stage 1** (four replay seeds): the trucker keeps 31.2k against stage 1's 27.1k, and the honest fleet
  145.5k against 142.8k. That is within the replays' spread.
  - The bots' prudent owner-operators measure it better. Their month-one operating result is 3% lower under the
    package, and their year one 4% higher than today (§2f).
  - My reading is that the 10-hour reset gives back about the hours the weekly clock takes. The runs can't separate the
    two.
  - Fines rise for legal companies (2.8k a month on the honest fleet, against 35 under stage 1). I haven't confirmed the
    cause. The likeliest is shoulder tickets, now counted in the fines row: the 10-hour rests stop trucks at night where
    there's no site. Stage 3 checks it.

### 2f. The package over four years, and the ceiling markup sized against your targets

`apps/sim/src/p34.ts`, seeds 1–4, 1,460 days. Every arm is stage 1 plus:
- "R12" is the bump's hours and the 70-hour clock.
- "the rest" is the short-load cap (0.5) and the season volume (`volumeGain` 1).
- The post-launch dial floor is `token.supplyCeiling.rateFloor`, today 1: Jeff's "the dial never under the launch
  rates".

| Seeds 1–4 | Liquidations (owner-operators) | Supply at the end / ceiling (seeds over) | Month-one operating, prudent owner-operator | Year one, same | Net worth, prudent fleet (end) |
|---|---|---|---|---|---|
| Today | 389 (101) | 55.9M / 59.6M (1 of 4) | 37.4k | 162.7k | 115k |
| Stage 1 | 470 (134) | 60.7M / 59.4M (3 of 4) | 37.1k | 150.9k | 131k |
| Markup 1.3, no R12 | 394 (105) | 82.8M / 63.6M (4 of 4) | 41.3k | 160.1k | 138k |
| Markup 1.3 + R12 + the rest | 358 (85) | 64.2M / 59.9M (3 of 4) | 36.3k | 169.7k | 123k |
| …and the dial floor 0.8 | 387 (95) | 61.2M / 59.9M (2 of 4) | 36.3k | 169.7k | 99k |
| Markup 1.25 + R12 + the rest, dial floor 0.9 | 386 (89) | 57.3M / 58.7M (2 of 4) | 34.6k | 160.5k | 115k |
| **Markup 1.2 + R12 + the rest** | **411 (100)** | **55.3M / 58.1M (1 of 4)** | 32.9k | 156.4k | 107k |

- **The ceiling markup is the owner-operators' lever.** A third of today's spot loads cleared above a ceiling that
  wasn't the shipper's real limit. With R17 the ceiling has to sit where a thin market clears.
  - At 1.3 the extra owner-operator liquidations of stage 1 are gone: 85–105 against today's 101.
  - Without R12, though, supply runs away (82.8M against 63.6M).
- **R12 is the supply path's friend and the busy owner-operator's cost.**
  - The 70-hour clock takes about 12% off a busy truck's month: 41.3k against 36.3k at markup 1.3.
  - It takes a quarter off the four-year supply: 64.2M against 82.8M.
- **At markup 1.2, with R12, every target holds but one:**
  - Owner-operator liquidations at today's figure (100 against 101): the extra 36 are closed.
  - Supply under the path as today's is (1 seed of 4 over at the end, as today; 2.8M under on average). No change to
    the post-launch dial.
  - The prudent persona still beats the greedy one in both segments. Fleets: 107k against 287k, today 115k against
    359k. Owner-operators: 41.9k against 26.1k, today 39.5k against 30.7k.
  - The one that misses: month one for a busy owner-operator is 12% lower, and that is R12's clock.
- **Markup 1.3 with a post-launch dial floor of 0.9 to 0.8** keeps month one (−3%). It still ends over the path on 2 of
  4 seeds, and it reopens Jeff's "never under the launch rates". So it isn't my pick.

**The two ends** (six seeds each, markup 1.3, R12 and the rest):
- The honest fleet keeps 148.8k, against 148.6k today.
- The trucker keeps 28.9k on R1's anchor, against 35.9k today.
- They aren't closer. Per truck they were never far apart: the honest fleet runs four or five trucks for about 32–37k
  each, the trucker one for 36k. The rest of the gap is the fleet start's capital, and that is the start's design, not
  the board's.
- What stage 2 changes is how the trucker earns: bids at the market's own rate, a "clears near" that's true, and a
  ceiling that's real.

**Stage 2's recommendation for the bump:**
```
rates.npcCeilingMarkup: 1.2              // today 1.15: the ceiling where a thin market clears, for R17
rates.exitDeadheadMaxShareOfMiles: 0.5   // new key; short loads' empty-run charge
rates.seasons.volumeGain: 1              // today 3: the season table moves rates, and freight only a little
hos.restHours: 10, hos.breakMinutes: 30, hos.breakAfterHours: 8   // engineering's R12 keys
fuel.stopEveryMi: 400, fuel.stopMinutes: 15                       // engineering's R12 keys
hos.cycleHours: 70, hos.restartHours: 34                          // new keys: the weekly clock
```
For players' default orders (engineering's order set):
- the bid at `{ mode: "clearsNear", pct: 0 }`;
- the board's "usually clears near" reading `clearsNear(w, load)`;
- the market line from `marketMood(w)`.

Held at today's values, with the reasons above:
- `token.circular.rateStabilizer.start`, `board.rolloverCeilingStep` and `bookNow.stepPerRound`: the levels (§2b);
- `rates.baseRatePerMile`: the supply path (§2c);
- `bookNow.towardCeilingRounds`: it does nothing yet;
- `usedMarket.npcLot.inBacklog` (§2g).

### 2g. The player2 follow-up: `usedMarket.npcLot.inBacklog` over four years

You asked for this check (economy-player2.md §2). It takes lot rigs out of the count that sets the new-truck wait. It
ran alone on today's rules, seeds 1–4:

| Seeds 1–4 | Today | Lot rigs out of the count |
|---|---|---|
| Orders on the dealer's books, day 42 / 91 | 371 / 237 | 362 / 19 |
| Owned trucks, day 91 | 632 | 844 |
| Dealer price index (tractor), day 91 / 182 | 1.18 / 1.08 | 0.92 / 0.90 |
| Liquidations (owner-operators) | 389 (101) | 394 (113) |
| Supply at the end (ceiling) | 55.9M (59.6M) | 57.6M (61.5M), over on 1 seed of 4 as today |
| Net worth: owner-operator prudent / greedy | 39.5k / 30.7k | 35.0k / 27.1k |
| Net worth: fleet prudent / greedy | 115.3k / 359.0k | 124.7k / 352.3k |
| Population dial entrants | 43 | 64 |

- The new-truck wait falls back to about 30 days by day 91, and new trucks are 22% cheaper then.
- The lot's rigs also come sooner, since they wait the new-truck wait. The free path owns its worn rig earlier, so this
  is player2's lesson again in a milder form: 12 more owner-operators fail, and the prudent ones end 11% poorer.
- **I'd leave it at today's value (true) in this bump.** The Dealer's explain line answers the player's question. The
  shorter wait isn't worth the owner-operators.

### 2h. Two asks from the producer

- **Security bands (engineering: Watch from 1.2, Risky from 2 times a quiet road's loss rate).**
  - The 60 hubs read 48 quiet (most at exactly 1.0), 3 watch (EWR 1.8, JAX 1.6, MKE 1.34) and 9 risky (LAX and ONT
    3.0, MIA 2.5, ATL 2.2, DAL, HOU, CHI, MEM and LRD 2.0).
  - For beta one, with the crews off, I confirm 1.2 and 2: a risky hub loses twice a quiet road's cargo.
  - When the Back Lot's crews switch on, Risky should start at `robbery.minPlaceRisk` (1.5), where a hired crew can
    strike. EWR and JAX then read Risky. I'd have the band read that key rather than a constant.
- **`ui.iuliia.captionMinutes` 5** landed with stage 1.

### Files (stage 2)

Ported to the working tree on main at `70f7700`, every key at today's value. A 120-day run (seed 3) of this code with
the defaults is byte-identical to main's.
- `packages/config/src/economy.config.ts`:
  - `token.circular.rateStabilizer.start` (1);
  - `bookNow.towardCeilingRounds` (0);
  - `rates.exitDeadheadMaxShareOfMiles` (null);
  - `rates.news` (the market line's windows);
  - `hos.cycleHours` (0) and `hos.restartHours` (34).
- `packages/engine/src/freight.ts`: `noteClear`, `clearsNear`, `marketMood`, the short-load cap.
- `packages/engine/src/board.ts`: `noteClear` on every clear; `rollover` exported, with the book-now walk.
- `packages/engine/src/standingOrders.ts`: the `clearsNear` bid mode.
- `packages/engine/src/trips.ts`: the weekly clock (`cycleLimitMin`).
- `packages/engine/src/types.ts`: the bid mode, `Load.bookNowOpen?`, `Truck.cycleMin?`, `Truck.cycleLastT?`.
- `packages/engine/src/world.ts`: `World.clears?`, the dial's start, and the order validator.
- `packages/engine/test/r11.test.ts` (new): 9 tests.

Typecheck is clean. `r11.test.ts`, `pay-floor.test.ts` and `hire-guard.test.ts` pass, and so does
`engine.test.ts` (162). No full npm test.

Runs are in `runs/p34/`:
- the anatomy: `r11/anat-*`;
- the ends: `ends2/`;
- four years: `y4-K2`, `y4-P2`, `y4-D`, `y4-Q`, `y4-Q12`, `y4-Qf`, `y4-Qf8`, `y4-Q25f`, `y4-inb`, `y4-r17`.

Scratch, not in the tree: `apps/sim/src/anatomy.ts`, `p34.ts`, `p34diag.ts`.

## Stage 3: R18 (compliance with teeth), and what the "always" options cost

### 3a. A bug in stage 2's clock, found while checking the legal fleet's fines

You asked whether the legal companies' fines under R12 (2.8k a month on the honest fleet) are shoulder tickets. They
are, all of them. Most of the rise, though, was a bug in my 70-hour clock, not R12's rests.

- **The bug.** During a 34-hour restart the truck can't drive, so a new duty day opens and closes every 10 hours
  without a mile driven. Each of those duty days was charged as another night (`sites.ts parkForTheNight`):
  - another space taken at the same site, and never given back (the space leaks);
  - another night's idling;
  - another patrol roll on the shoulder.
- **What it did.** A 120-day run on the bump's hours (`apps/sim/src/parkdiag.ts`, scratch, seed 1) had 849 spaces
  taken by 267 trucks on day 120. Over four years the leaked spaces fill the rest areas:

| Seeds 1–4, four years (the bump without R18) | Today | The bump, with the bug | The bump, fixed |
|---|---|---|---|
| Times a truck found its site full | 130 | 1,061,000 | 44 |
| Nights on the shoulder | 57k (9% of nights) | 400k (48%) | 133k (23%) |
| Shoulder tickets | 19k | 132k | 44k |
| All fines, four years | 14.2M | 46.5M | 23.1M |

- **The fix** (stage 2's code, so in this bump): a duty day that opens and closes with no mile driven is the same stop,
  not a new night. The truck keeps its one space and pays one night. It applies only with `hos.cycleHours` on, so
  today's rules are untouched (byte-identical; see the files).
- **The honest fleet's month after the fix** (the gamer persona with all three levers off, four seeds), fines by kind:
  - stage 1: 0.6k, of which 0.56k shoulder tickets;
  - the bump, with the bug: 3.7k, all shoulder;
  - the bump, fixed: 1.6k, all shoulder; with R18 as well, 1.1k.
- **What's left is R12's.** The 10-hour rest comes wherever the 11 hours run out, and the weekly clock can run out
  between sites. A legal truck still sleeps on the shoulder 23% of nights against 9% today: 25k more tickets over four
  years, 6M FD. On the honest fleet that is 1.1–1.6k a month, about half a percent of revenue. Two cheap cures for
  later:
  - a driver with under an hour or two on the weekly clock takes the restart where he stands, at the site;
  - the night planner (`planNight`) plans the restart's site as it plans the night's.
- **The four-year sizing of stage 2 had the bug in it.** Its fines were a sink that won't be there. So I reran the
  bump's four years with the fix (§3d). The markup at 1.2 still holds.

### 3b. Today's teeth: the gamer's month and the season

**The gamer's month.** Six seeds; net worth on day 36, the full exploit against the same start run legally.

| Rules | Cheating's month (net worth, full against legal) | Fines, share of revenue | Rated by day 36 |
|---|---|---|---|
| Today | +6.6k | 3% | 0 of 6 ("Not yet rated", as in the diary) |
| Stage 1 | +37.4k | 4% | 0 of 6 |
| The bump without R18 (stages 1–2, fixed) | +70.6k | 3% | 1 of 6 (Conditional) |

- **The month card overstates a cheater's month.** The card's "kept" is the month record's earned less spent
  (`Company.firstMonth`). Spent counts operating costs and overhead, but not safety fines, which go straight to the
  ledger. The diary's 271,665 kept didn't count his fines. The fix is in §3e.
- **R12 makes cheating pay much more.** A legal log stops at the 70-hour clock, and a falsified one drives through it.
  Without R18 the bump would hand the gamer 70k for cheating in his first month, against 6.6k today. So R18 isn't
  optional once R12's clock is in.

**Over a season** (`apps/sim/src/policy.ts`, scratch).
- Every third clean-conduct carrier (by id) runs the policy from day 0. The other clean carriers of the same personas
  are the controls.
- 365 days; seeds 1–2 today, 1–3 on the bump.
- Net worth at the end, treated against controls, owner-operators / fleets:

| Policy | Today | The bump without R18 (fixed) |
|---|---|---|
| 15-hour days, always | −23% / −34%; 24% / 10% revoked; fines 6.9% of revenue | −41% / −33%; 26% / 7% revoked; fines 9.0% of revenue |
| 56 mph, always | −14% / −26%; none revoked; fines 0.8% of revenue | −19% / −37%; none revoked; fines 1.1% of revenue |
| Deferred maintenance | −17% / −36% | −18% / −28% |
| All three | −21% / −33%; 36% / 31% revoked | −49% / −41%; 39% / 24% revoked |

- **Over a season the options already lose on average, even today.** The record catches up: the 90-day audit and the
  two-alert audit, crashes and their settlements, revocations.
- **What fails is the first month.** A cheater who stays out of the audits is ahead. His rating reads "Not yet rated"
  with an alert on the books, and a few percent of revenue in fines buys about a third more miles. That is the gamer's
  month, and R18's job.

### 3c. R18, as built (every key at today's value)

- **`safety.enforcement.fineEarnedMult`** (new, 0): a fine is at least this multiple of what the breach earned.
  - A falsified log day earned its over-hours miles at the load's rate. That figure goes on the hidden log when the
    day closes, so a roadside find or an audit fines from it.
  - A week of deferred maintenance earned the maintenance it skipped: 45% of `tractors[tier].maintPerMile` over 1,000
    miles.
  - A speeding day earned the time 56 mph saved over 50.
- **`safety.review.auditDays`** (new, null): any alert books an audit within this many days. A company never rated
  gets one whatever the cooldown, so a company with alerts is always rated.
- **`safety.enforcement.oosHours`** (`{ hos: 10, defect: [4, 12] }` today): an out-of-service order's hours.
- **`safety.review.hiddenDetect`** (0.35 today): the share of the hidden log an auditor finds.
- **`contracts.closedToBadRating`** (new, false): a carrier rated Conditional or Unsatisfactory gets no contract
  offer and no renewal, and can't take an offer it holds: "shippers don't sign contracts with a conditional safety
  rating". A contract already running runs out its term.
- **The follow-up judges the window since the rating** (with `auditDays` on; the director's requirement). Today a
  follow-up audit reads the whole record. It still finds the falsified days the first audit missed, and the first
  audit's own findings keep the alerts on for months. So a company that ran clean after an Unsatisfactory rating could
  still be revoked at its follow-up; `r18.test.ts` shows it on today's rules. With R18:
  - an audit after a rating looks only at hidden days after that rating;
  - the rating counts alerts from the inspections and violations since it (`measures(w, c, sinceDay)`);
  - the public record, which brokers and patrols read, keeps its two years.
  - So a company clean since its rating passes the follow-up, and one still cheating is revoked.
  - **The window opens a loop, and the conduct re-run found it** (§3d). A bot that is rated Conditional or
    Unsatisfactory runs straight until the follow-up (`ruleBots.ts setConduct`). It passes on the clean window, then
    goes back to cheating, and the 180-day cooldown keeps the next audit away. A player can do the same.
- **`safety.review.probationDays`** (new, null): R18's probation, which closes the loop. For this many days after an
  Unsatisfactory rating:
  - an alert since the last rating brings an audit within `auditDays`, whatever the cooldown;
  - another Unsatisfactory rating revokes at once.
  - A company that stays clean is never touched by it. The bump's value is 365.
- **After a Conditional rating too** (the red team's re-read). A Conditional company that passed its follow-up still had
  the 180-day cooldown, so it could run the cheat-again loop once more before probation bit. **My call: a Conditional
  rating starts the same probation, with the alert-brings-an-audit half only.**
  - A later Unsatisfactory takes its 45 days to clean up as usual. It doesn't revoke at once, because Conditional is
    the lesser finding.
  - I chose it over a follow-up that skips the cooldown once. The loop isn't a single pass: each clean-up and relapse
    is another, and only a probation covers them all for the year.
  - A probation already running after an Unsatisfactory isn't eased by a Conditional within it.
- **Doors a bad rating already closes in the engine:**
  - strict-vetting loads: Conditional, or any alert;
  - standard loads: Unsatisfactory;
  - the insurance rating;
  - and Unsatisfactory has 45 days to clean up before revocation.

### 3d. Sized

**The R18 values:** `fineEarnedMult` 3, `auditDays` 14, out of service 34 hours for hours (a restart) and 24–48 hours
for a defect, `hiddenDetect` 0.6, and contracts closed to a bad rating.

**The gamer's month, six seeds, all fixed:**

| | The bump without R18 | **The bump with R18** |
|---|---|---|
| Cheating's month (net worth, full against legal) | +70.6k | **−31.5k** |
| Fines, share of revenue | 3% | 18% |
| Rated by day 36 | 1 of 6 (Conditional) | 5 of 6 (4 Unsatisfactory, 1 Conditional) |

- The gamer's three levers no longer pay in month one. Pay and the margin stopped paying in stage 1, and the policy
  stops here.
- Stronger values (×5, audits in 7 days, 0.8 found; then alerts pulled in at 0.6) took the month to −69k and −149k
  before the fix. They aren't needed.

**Over a season, with R18** (seeds 1–3, fixed), owner-operators / fleets:

| Policy | Net worth against clean twins | Revoked within the season | Fines, share of revenue (controls) |
|---|---|---|---|
| 15-hour days, always | −135% / −73% | 96% / 100% | 20.4% / 12.2% (0.7% / 0.6%) |
| 56 mph, always | −13% / −31% | none | 1.4% / 1.3% |
| Deferred maintenance | −19% / −22% | 0 / 2% | 0.8% / 0.6% |
| All three | −132% / −72% | 98% / 100% | 22.0% / 11.0% |

**Jeff's figure: the "always" options over a season, for a typical company:**
- **15-hour days, always.** Today a company ends the season 23–34% poorer than its honest twin, and one owner-operator
  in four is revoked. With R18 revocation is all but certain within the year. The first alert brings an audit within
  14 days, the audit finds the falsified days, the rating goes Unsatisfactory, and the follow-up revokes.
- **56 mph, always.** With R18, 13% poorer for an owner-operator and 31% for a fleet, about what it costs today (14%
  and 26%). That cost is crashes and their settlements. The speeding tickets add under 1% of revenue to the controls'
  own fines.
- **Deferred maintenance, always.** 19–22% poorer, from breakdowns and out-of-service days.
- **The "hot loads only" settings** (the cutter bots') stay a gamble, but a dearer one. The four years below show
  what it costs them.
- **My reading for Jeff's call: with R18 the options can stay on screen.** "Always" now reads as what it is. The
  writer's line on why 56 mph is the reckless setting still needs writing.

**Over four years** (`apps/sim/src/p34.ts`, seeds 1–4, 1,460 days, the live profile, all fixed):

| Seeds 1–4 | Liquidations (owner-operators) | Supply at the end / ceiling (seeds over) | Fines, four years | Prudent owner-operator: month one / year one (operating) | Net worth at the end, owner-operators: prudent / greedy | Fleets: prudent / greedy |
|---|---|---|---|---|---|---|
| Today | 389 (101) | 55.9M / 59.6M (1 of 4) | 14.2M | 37.4k / 162.7k | 39.5k / 30.7k | 115k / 359k |
| The bump without R18, with the bug (§2f's pick) | 411 (100) | 55.3M / 58.1M (1 of 4) | 46.5M | 32.9k / 156.4k | 41.9k / 26.1k | 107k / 287k |
| The bump without R18, fixed | 405 (96) | 57.5M / 57.7M (2 of 4) | 23.1M | 34.5k / 163.8k | 37.5k / 27.7k | 105k / 318k |
| **The bump with R18 (and the pledge key)** | **434 (104)** | **57.1M / 59.4M (1 of 4)** | 30.3M | 34.4k / 168.5k | 38.5k / 27.7k | 119k / 285k |
| …and R15's hold at 15% | 439 (111) | 59.1M / 57.7M (2 of 4) | 31.0M | 34.1k / 165.5k | 44.0k / 29.4k | 116k / 297k |

- **The fix gives back most of stage 2's accidental sink.** Fines fall from 46.5M to 23.1M, and supply ends 2.2M higher,
  at the path (57.5M against 57.7M). The markup at 1.2 still holds, with R18 below it.
- **The busy owner-operator's month one costs 8% now, not 12%** (34.5k against today's 37.4k). His year is today's or
  better: 163.8k, and 168.5k with R18.
- **R18 adds 29 liquidations, and they are the cheaters'.** A scratch split by the bots' conduct (`conductdiag.ts`,
  seeds 1–2, the same worlds), failures over four years:

| Seeds 1–2, failures | Clean | Cutters (corners on hot loads) | Outlaws (corners always) |
|---|---|---|---|
| Owner-operators, without R18 | 59.5 | 40 (5 revoked) | 113.5 (57 revoked) |
| Owner-operators, with R18 | **46.5** | **61.5 (29.5 revoked)** | 110.5 (68.5 revoked) |
| Fleets, without R18 | 20.5 | 15 (3.5 revoked) | 13 (9 revoked) |
| Fleets, with R18 | 20.5 | 23.5 (17.5 revoked) | 18.5 (16 revoked) |

  - Clean owner-operators fail 22% less: the cheaters' trucks leave the board to them.
  - Outlaws were failing already. R18 revokes more of them, sooner.
  - **The cutters take the weight.** A cutter runs corners on hot loads only, and R18's audit within 14 days of an alert
    finds those days at 0.6. Two cutter owner-operators in five are revoked within four years, against one in
    fifteen without R18. That is the "calculated risk" getting dearer, which is R18's purpose. If Jeff wants
    hot-loads-only to stay a gamble a careful company can win, `auditDays` 28 or `hiddenDetect` 0.45 would soften it.
    I haven't sized either.
  - With the cheaters gone sooner, the prudent fleets end richer (119k against 105k) and the greedy ones poorer (285k
    against 318k). Supply ends under the path on 3 seeds of 4, as today.
- **Against your targets:**
  - liquidations: 434 against 403 (owner-operators 104 against 101), and the extra failures are cheaters;
  - supply under the ceiling, as today;
  - the prudent owner-operator beats the greedy one at four years (38.5k against 27.7k);
  - the busy owner-operator's month one is 8% under today's. That is R12's clock, as §2f said.

**The conduct split again, on the follow-up's window and then with probation** (`conductdiag.ts`, seeds 1–2, four
years, the bump with R18). Failures, with revocations in brackets:

| Seeds 1–2 | Clean OO | Cutter OO | Outlaw OO | Clean fleets | Cutter fleets | Outlaw fleets | All |
|---|---|---|---|---|---|---|---|
| Without R18 | 59.5 | 40 (5) | 113.5 (57) | 20.5 | 15 (3.5) | 13 (9) | 261.5 |
| R18, the follow-up reads the whole record (the runs above) | 46.5 | 61.5 (29.5) | 110.5 (68.5) | 20.5 | 23.5 (17.5) | 18.5 (16) | 281 |
| R18, the follow-up's window alone | 51.5 | 49.5 (0) | **267 (21)** | 24 | 13.5 (0) | 24 (4.5) | **429.5** |
| **R18, the window and probation 365** | **39** | 59 (21) | 128 (66.5) | 22 | 20.5 (9.5) | 21 (15) | **289.5** |

- **The window alone breaks R18.** No cutter is revoked, and outlaws go round the loop until they fail on fines and
  crashes instead. That is 267 owner-operator bankruptcies, more than twice the runs above, and the world's
  liquidations would rise by about 150.
- **With probation, R18 is back where it was sized.** All failures 289.5 against 281, and revocations as before. Clean
  owner-operators fail least of any arm, 39 against 59.5 without R18. Two cutter owner-operators in seven are revoked,
  against two in five before. That is a little softer, and it is what the director's window gives a company that
  cleans up for good.
- The four-year table above stands within the seeds' spread. I'd put `probationDays` 365 in the bump with the window,
  never the window alone.

### 3e. The month card counts the fines

Fines post to the ledger but not to `operating.costFd`. The bots read that counter, so the fines stay out of it.
- The month record (`intel.ts`, screens only) now adds the fines outside operating costs to `spentFd`, through a
  counter of its own, `Company.finesOffCostsFd?`. That covers `safety.ts fine` and the double-brokering fine.
- Shoulder tickets are an operating cost already, so they aren't counted twice.
- No rule reads it. The four-year run is unchanged, and the month card's "kept" falls by the month's fines.

### 3f. Stage 3's recommendation for the bump

```
safety.enforcement.fineEarnedMult: 3                          // new key
safety.review.auditDays: 14                                   // new key
safety.enforcement.oosHours: { hos: 34, defect: [24, 48] }    // today { hos: 10, defect: [4, 12] }
safety.review.hiddenDetect: 0.6                               // today 0.35
contracts.closedToBadRating: true                             // new key
```
The parking fix needs no key: it is part of `hos.cycleHours`.

## Stage 4: R1, R8 and contract signing

Nothing here moves the bots' world. Every rule in it binds players' companies only, and the sims have none.
- **R1.**
  - The bid anchor is stage 2's `clearsNear` bid mode, with break-even as its floor.
  - The join half is engineering's `guard.dispatcherDefaultOn`, false in the bump. With it off, `joinCompany` leaves
    every dispatcher order out, for an owner-operator and a fleet start alike, so the fleet-start extension is covered.
- **Contract signing by rule only.**
  - The engine signs an offer in two ways only. One is the contracts order's `acceptOffers` (`weeklyContracts`). The
    other is the player's own accept.
  - With `dispatcherDefaultOn` off, a new company has no contracts order at all. The order comes back when he turns
    the dispatcher on. So its default must be off too, or the dispatcher signs a 91-day contract the day he turns it
    on, which is the diary's complaint.
- **For engineering (`apps/web/src/game.ts`).** Engineering's working tree has `PLAYER_DISPATCHER_ORDERS`, the rules a
  player turns on. It already carries the `clearsNear` bid at 0 and the floor at break-even. Its contracts order still
  comes from `DEFAULT_ORDERS` with `acceptOffers: true`. It should be false there, or turning the dispatcher on signs
  the next offer.
- **R8, as economy-player2.md §3 sized it:** `guard.autoStaffDefault` false, `guard.hireCoverWeeks` 4,
  `guard.hireCoverHumansOnly` true (its default).
  - On the prudent persona the guard was neutral over a year.
  - It holds a first-weeks hire back for four fleets in five, about 4 empty seat-days a fleet in month one.

## Stage 5: Borrow and the double pledge, R15, the owner's pay, and the brokerage's launch

### 5a. Borrow, and a truck pledged twice

- **Borrow should stay hidden** (UX's 6dd93a7) rather than the NPC lender writing cash-out loans.
  - A cash-out loan from the NPC lender is FD printed against a truck the borrower already owns (`faucet:npc_finance`),
    with no purchase behind it. That is a pure faucet.
  - Equipment Finance's pool is the honest lender, and in the bots' world it is all but idle: 34 loans a seed in four
    years today, 9 on the bump.
  - When the pools open, Borrow can show again with what the pool can lend.
- **Two pure reads for the screen** (`finance.ts`; engineering wires them). They answer QA's and both diaries' wall,
  "up to 55,661 FD" and then "The pool doesn't have the cash":
  - `borrowLender(w)`: "pool" while the lending pools are open, "off" while they are stood down (`poolsOn`). Off,
    Borrow isn't shown. There is no NPC state, because the NPC lender doesn't write cash-out loans.
  - `lendNowFd(w, companyId, truck)`: what the lender will lend now. It is the truck's cap at 98%
    (`BORROW_CAP_SHARE`, for the value the truck loses before a confirm lands), no more than the pool's cash,
    rounded down to the 100. It is 0 while the pools are off, for a truck that isn't the company's to pledge, or with
    nothing to lend. `borrow` takes any amount up to it.
  - `apps/web/src/finance.ts borrowable` does the same arithmetic today, without the pool state. It can call
    `lendNowFd` and filter on it.
- **Pools off covers Equipment Finance too** (ruled, DECISIONS.md 2026-11-03): `equipmentFinance.closedWithPools`
  (new, false today, true in the bump).
  - With it on, while the pools are stood down Equipment Finance takes no deposit and writes no loan, for players and
    bots alike: "the lending pools are closed". Withdrawals and repayments go on.
  - Today the bots still deposit and borrow with the pools off: 9 loans a seed in four years on the bump, with the
    pool's cash near 0 most days. The key ends that small corner of the bots' world. It is the one bump key not run
    over four years, and the effect it can have is that small.
- **The double pledge** (`equipmentFinance.netOfPurchaseLoans`, new, false today):
  - Today a rig bought on a purchase loan can be pledged to Equipment Finance at once for another 35% of its value.
    Player2's case: a lot rig bought for 13.3k of cash pledged for 15.6k, a truck and 2.2k of cash for nothing down.
    The bots' `borrowFor` uses it too.
  - With the key on, a truck pledges only `0.35 × value − the purchase loan's principal`. A freshly financed rig
    (10–20% down) pledges nothing until the loan is paid down under 35% of its value.
  - It matters once the pool can lend. I'd turn it on now, so it is closed before then. It is in the four-year arm
    below.

### 5b. R15: hold less per load for longer

The free path's deposit is `freeEntry.leases.byValue.depositShare` (25%) of the truck's value, held back from each
settlement at `escrowShareOfPay` (30%) until it's whole. The last hold tops up only what's owed
(`trips.ts`: `hold = min(owed, paid × share)`), so it is never more than the share.

The trucker (six seeds, the bump without R18, 60 days):

| | 30% a load (today) | **15% a load** |
|---|---|---|
| Deposit due | 15.9k | 15.9k |
| Deposit whole by | day 21–42 | day 49, or past day 60 on 3 seeds of 6 |
| Deposit held by day 14 / day 28, mean | 6.6k / 14.8k | 3.1k / 7.5k |
| Cash on day 7 / day 14, mean | 5.0k / 8.7k | 6.0k / 10.2k |
| Loads delivered by day 60 / net worth on day 60, mean | 22 / 42.1k | 25 / 44.8k |

- **No easier first truck.** On the one-year world (seeds 1–2), the free path buys its first truck on day 21 at the
  median either way, and every company in it buys one.
- The total held is the same. The deposit counts toward the first truck as before (`depositToPurchase`).
- **Over four years it costs owner-operators** (the bump with R18, seeds 1–4, §3d's table):
  - owner-operator liquidations 111 against 104;
  - supply over the path on 2 seeds of 4 against 1.
  - The one-year check pointed the same way: 6 more owner-operator failures a year, on 2 seeds.
- **My recommendation: keep 30% in this restart.** The diary's complaint was the hold vanishing without a word. That is
  R15's explanation (engineering and the writer), and it needs no rule change. 15% can come back with more seeds
  before a second restart.

### 5c. The owner's pay for driving (diary 1, row 5)

- `labor.owner.driverPayPerMile` (0.75) is charged on every mile the owner drives, to `sink:driver_wages`. It is paid
  to no one.
- On the trucker it is about 4.4k a month (8.8k over 60 days, on 11.7k of his own miles).
- **My recommendation: keep the charge, and name it as what it is: the owner's draw.** It is the living he takes out
  of the business, which leaves the game.
  - It is a cost the bots' world is sized on.
  - In the bots' world owners drive about 520 trucks (seed 1, the bump's hours), and their draw in the first month
    was 5.1M FD. Removing it would add that to supply every month, against a four-year path that ends near 55M.
- For the writer and engineering, the line on the month card and Money: "Your draw, 0.75 a mile: what you take home to
  live on". It should never read as pay that will arrive.

### 5d. The brokerage's launch with both premiums halved

Jeff halved both premiums: the surety at 1–6% a year by credit, the credit premium's ceiling at 10%. This is the
launch batch of economy-brokerage.md §5b, run again on the bump.
- `brk-bump`: seeds 1–3, the live profile, the bump with R18, the brokerage on, both premiums halved, and the hold
  on as built.
- A quarter of the carrier bots form a brokerage once they can, from a month after the launch (`brokerage.bots.fromDay`
  760), at the 5% default margin.

| Seeds 1–3, brokerages formed after the launch | Today's rules, the hold on (`v59-ph`) | Today's rules, premiums halved (`v59-p2`) | **The bump, premiums halved, the hold on** |
|---|---|---|---|
| Pairs formed | 19 | 19 | 16 |
| Year 1: operating result, median (positive) | +24.4k (85%) | +19.9k (82%) | **+23.4k (100%)** |
| Year 1: owner's gain, median (paid back) | +10.4k (85%) | +5.5k (64%) | **+10.7k (88%)** |
| Gain at the run's end, median (positive) | +10.0k (79%) | +4.4k (63%) | +16.1k (75%) |
| AI brokers: operating over four years, mean | +26.6k | +44.4k | +111.8k |

- **A post-launch brokerage still pays back inside its first year, on 88% of pairs.** That's the §5b test, and the
  bump doesn't hurt it.
- The AI brokers do much better on the bump (112k against 27–44k). The ceiling at 1.2 leaves a broker more room
  between what the shipper pays and what the carrier clears.
- **The world around it is the bump's** (`run.ts`, seeds 1–3, against `y4-FIX`'s seeds 1–3 from `p34.ts`):
  - liquidations 427 against 431, and AI brokers 56 against 59;
  - supply 58.5M against a 59.6M ceiling, over on 1 seed of 3 as without it.
  - Owner-operator liquidations read 120 against 108. The two drivers aren't the same run, so this is a hint and not
    a finding. The restart's own check should watch it.
- **My word for the switch-on:** if QA finds the flagged build clean, the economy has no objection to the brokerage
  riding this restart with both premiums halved.
- **QA's S4, the engine half** (the package brief's item 10; built after this batch, behind `brokerage.enabled`):
  - **When the own carrier lets the tender lapse** (or leaves it), the load goes to the board at the rate it was
    offered. Its ceiling is that rate, its book-now no higher, and it counts as posted this round.
    `Load.ownTenderLapsed` keeps the rate for the card's "{carrier} didn't take it · posted at {rate}/mi"; the web
    already reads it.
  - **The round never re-prices a player's brokerage load over what the shipper pays it** (QA's Perry → Glenview,
    moved at −273 FD). The AI brokers still eat the raise as before.
    - A player's load the board won't take at that pay falls off. That is the owner's call to re-price, which the
      spec leaves open (item 2).
    - The bots' brokerages in the batches above are player brokerages too, so `brk-bump` predates this.

### 5e. `usedMarket.npcLot.deliveryDays` 7 (ruled into the bump)

The producer ruled it in (DECISIONS.md, 2026-11-03). The numbers (economy-player2.md §1):
- A used-lot rig that adds to a fleet comes from the lot's stock in 7 days. A free starter's first truck keeps
  today's queue.
- On the diary's seed the small fleet runs five trucks from day 24 instead of three. Its cash is 120k on day 28
  (+37k), and the sixth truck is 58k away, not 95k.
- It doesn't move the supply path: bots buy lot rigs only to replace their lease, and a 120-day run is byte-identical.
- The wider version, which also sped up the free path's first trucks, failed its four-year check: owner-operator
  liquidations rose 16%.

## The bump

### Every key it flips

These are config paths as `LIVE_LEVERS` (`packages/config/src/live.ts`) and the sim's `--set` take them, so the
restart commit can add them there and leave the base config, and the tests written against it, on today's rules.

| # | Path | Today | The bump | Why |
|---|---|---|---|---|
| 1 | `board.overCeilingMax` | 1.5 | **1** | R17: no bid above the ceiling (§1a) |
| 2 | `board.refuseOverCeiling` | false | **true** | R17 (§1a) |
| 3 | `labor.payFloorShareOfMarket` | 0 | **0.85** | R16: the pay floor (§1b) |
| 4 | `labor.unhappyNoticeDays` | 0 | **7** | R16: unhappy drivers give notice (§1b) |
| 5 | `labor.underpayMemory.days` | 0 | **56** | R16: drivers remember (§1b) |
| 6 | `labor.underpayMemory.askPremium` | 0 | **0.1** | R16 (§1b) |
| 7 | `rates.npcCeilingMarkup` | 1.15 | **1.2** | R11/R17: the ceiling where a thin market clears (§2f) |
| 8 | `rates.exitDeadheadMaxShareOfMiles` | null | **0.5** | R11: short loads' empty-run charge (§2d) |
| 9 | `rates.seasons.volumeGain` | 3 | **1** | R11: the season table moves rates (§2d) |
| 10 | `hos.restHours` | 0 | **10** | R12, engineering's key |
| 11 | `hos.breakMinutes` | 0 | **30** | R12, engineering's key |
| 12 | `fuel.stopEveryMi` | 0 | **400** | R12, engineering's key |
| 13 | `fuel.stopMinutes` | 0 | **15** | R12, engineering's key |
| 14 | `hos.cycleHours` | 0 | **70** | R12's weekly clock (§2e), with its parking fix (§3a) |
| 15 | `safety.enforcement.fineEarnedMult` | 0 | **3** | R18: fines scale with the gain (§3d) |
| 16 | `safety.review.auditDays` | null | **14** | R18: an alert brings an audit (§3d) |
| 17 | `safety.enforcement.oosHours.hos` | 10 | **34** | R18: out of service costs days (§3d) |
| 18 | `safety.enforcement.oosHours.defect` | [4, 12] | **[24, 48]** | R18 (§3d) |
| 19 | `safety.review.hiddenDetect` | 0.35 | **0.6** | R18 (§3d) |
| 20 | `contracts.closedToBadRating` | false | **true** | R18: a bad rating closes contract offers (§3c) |
| 21 | `guard.dispatcherDefaultOn` | true | **false** | R1's join half, engineering's key (§4) |
| 22 | `guard.autoStaffDefault` | true | **false** | R8 (§4) |
| 23 | `guard.hireCoverWeeks` | 0 | **4** | R8 (§4) |
| 24 | `equipmentFinance.netOfPurchaseLoans` | false | **true** | the double pledge (§5a) |
| 25 | `equipmentFinance.closedWithPools` | false | **true** | pools off covers Equipment Finance (§5a) |
| 26 | `usedMarket.npcLot.deliveryDays` | null | **7** | a fleet's lot rig from stock in a week (§5e) |
| 27 | `safety.review.probationDays` | null | **365** | R18's probation, which the follow-up's window needs (§3c, §3d) |
| 28 | `labor.hiring.settleAtStop` | false | **true** | an offer settles at the truck's next stop (§1b) |

**Only if the brokerage switches on in this restart** (QA-clean on a flagged build):

| # | Path | Today | The bump | Why |
|---|---|---|---|---|
| 29 | `brokerage.enabled` | false | **true** | the switch, which also turns on QA's S4 fixes (§5d) |
| 30 | `permits.suretyPctPerYear` | [0.02, 0.12] | **[0.01, 0.06]** | Jeff: the surety premium halves |
| 31 | `token.credit.premiumMax` | 0.2 | **0.1** | Jeff: the credit premium's ceiling halves |

**Not config: engineering's `PLAYER_DISPATCHER_ORDERS`** (`apps/web/src/game.ts`, in their working tree), the rules a
player turns on:
- the bid: `price: { mode: "clearsNear", pct: 0 }` (there already);
- contracts: `acceptOffers: false` (still true, from `DEFAULT_ORDERS`).

### Held at today's values

- **The levels, until Jeff rules** (the producer's pick, today's levels for the beta):
  - `token.circular.rateStabilizer.start` (1);
  - `board.rolloverCeilingStep` and `bookNow.stepPerRound`;
  - `rates.baseRatePerMile`.
- `bookNow.towardCeilingRounds` (0): it does nothing yet.
- `usedMarket.npcLot.inBacklog` (true): §2g.
- `freeEntry.leases.byValue.escrowShareOfPay` (0.3): ruled, the hold stays at 30% (§5b).
- `labor.owner.driverPayPerMile` (0.75): ruled, the owner's draw stays as "Your draw" (§5c).
- Already at the values the package wants, so not in the table: `hos.breakAfterHours` 8, `hos.restartHours` 34,
  `guard.hireCoverHumansOnly` true, `labor.morale.unhappyBelow` 0.3, `rates.news`, `ui.iuliia.captionMinutes` 5.

### The ruleset version

**0.21.0-phase0.36.** It is a minor version because the rules change (the board, the hours, compliance), and the next
phase. The version line, in its own form:

```
version: "0.21.0-phase0.36", // Restart (2026-11-0x): the diary 3/4 bump (studio/reviews/economy-player34.md, live.ts): a ceiling is a ceiling (R17), the pay floor and drivers who quit (R16), the board at a 1.2 ceiling with a short-load cap and the season table on rates (R11), R12's hours with the 70-hour clock and the 34-hour restart, compliance with teeth and a year's probation (R18), the dispatcher and auto-staff off until the player chooses (R1, R8), the double pledge closed and Equipment Finance shut with the pools, a fleet's lot rig in a week; levels as 0.20.2
```

If the brokerage rides the same restart, the note ends "…a fleet's lot rig in a week; the brokerage on, both premiums
halved; levels as 0.20.2".

### What the bump does, in one table

| | Today (0.20.2) | The bump |
|---|---|---|
| The gamer's month: cheating against legal | +6.6k | **−31.5k** (rated by day 36 on 5 seeds of 6) |
| The trucker's month (six seeds; the bump on R1's anchor) | 35.9k | 28.8k. That is the levels question, which is Jeff's (§2b) |
| The honest fleet's month: kept / fines | 148.6k / 0 | 146.2k / 1.1k, all shoulder tickets (§3a) |
| The prudent owner-operator: month one / year one, operating | 37.4k / 162.7k | 34.4k / 168.5k |
| Owner-operators at four years: prudent / greedy | 39.5k / 30.7k | 38.5k / 27.7k |
| Fleets at four years: prudent / greedy | 115k / 359k | 119k / 285k |
| Liquidations in four years (owner-operators) | 389 (101) | 434 (104): the extra failures are cutters and outlaws (§3d) |
| Supply at four years / ceiling | 55.9M / 59.6M, over on 1 seed of 4 | 57.1M / 59.4M, over on 1 seed of 4 |
| Fines in four years | 14.2M | 30.3M |

## Files (stages 3–5)

Ported to the working tree on main at `7102f94`, every key at today's value. A 365-day run (seed 3) of this code with
the defaults is byte-identical to main's.
- `packages/config/src/economy.config.ts`, seven new keys:
  - `safety.enforcement.fineEarnedMult` (0);
  - `safety.review.auditDays` (null);
  - `contracts.closedToBadRating` (false);
  - `equipmentFinance.netOfPurchaseLoans` (false);
  - `equipmentFinance.closedWithPools` (false), added after the producer's ruling;
  - `safety.review.probationDays` (null), added after the conduct re-run;
  - `labor.hiring.settleAtStop` (false), for QA's poach row.
- `packages/engine/src/safety.ts`: fines scaled to what the breach earned (`drivingEarnedFd`, `scaledFine`), the
  earned figure on the hidden log, the alert's audit, the follow-up's window (`measures` takes a `sinceDay`), the
  probation (`SafetyRecord.probationUntil?`), and the out-of-service notice reading its hours.
- `packages/engine/src/contracts.ts`: `contractRatingBlock`, read by new offers, renewals and `acceptOffer`.
- `packages/engine/src/finance.ts`: `borrowingCapacity` net of the purchase loan's principal, Borrow's two reads
  (`borrowLender` and `lendNowFd`, with `BORROW_CAP_SHARE`), and `deposit` and `borrow` closed with the pools.
- `packages/engine/src/sites.ts` and `trips.ts`: the restart is one stop (§3a).
- `packages/engine/src/intel.ts`, `fraud.ts` and `safety.ts fine`: the month record's fines (§3e).
- `packages/engine/src/types.ts`: `HiddenViolation.earnedFd?`, `Company.finesOffCostsFd?`, `monthMark.finesFd?`.
- `packages/engine/test/r18.test.ts` (new, 14 tests), and one more test in `r11.test.ts` (the restart's stop).
- **The red team's pass 3** (redteam-2026-11-03b.md), each behind the key that governs it. `redteam3.test.ts` is new,
  with 20 tests: the red team's, the probation's, the floor drift's, S4's and the poach row's.
  - R16 (`labor.underpayMemory`, `labor.ts`): firing a driver on an unhappy notice writes the memory.
    - A withdrawn notice keeps its raise (`Staff.unhappyHeld?`).
    - A cut below that raise within the memory's days re-opens the notice at once: "you cut the raise that kept
      them".
  - R12 (`hos.restHours` or `hos.cycleHours` on; `world.ts`, `actions.ts`): the day's and the week's clocks follow
    the driver.
    - `Staff.clock?` holds them while the driver is off a truck (`DriverClock`).
    - `assign_driver` refuses a move between trucks at different hubs.
  - R17 (`board.refuseOverCeiling`, `brokerage.ts ownBand`): the own-carrier tender's band is capped at the load's
    ceiling.
  - R16's floor drift (`labor.payFloorShareOfMarket`, `labor.ts dailyLabor`, `Staff.underFloor?`): §1b.
- **The red team's re-read**, folded into the floor-drift commit:
  - firing on notice writes the memory whatever offer stands (`labor.ts releaseStaff`);
  - a driver off a truck stands at its hub (`Staff.lastHub?`, `world.ts unseatDriver`, `actions.ts assign_driver`);
  - a Conditional rating starts the alert half of probation (`SafetyRecord.probationRevokes?`, `safety.ts`): §3c.
- **QA's S4** (`brokerage.enabled`; `contracts.ts rejectTender`, `board.ts rollover`, `Load.ownTenderLapsed?`): §5d.
- **QA's poach row** (`labor.hiring.settleAtStop`; `labor.ts settleOffer` and `hourlyLabor`, `step.ts`): §1b.

Typecheck is clean. These pass: `r18.test.ts` (14), `redteam3.test.ts` (20), `r11.test.ts` (10), `audit.test.ts` (13),
`brokerage.test.ts` (15), `pay-floor.test.ts`, `hire-guard.test.ts`, `engine.test.ts` (162), and the web's
`intel.test.ts` and `finance.test.ts`. No full npm test. With every key at its default, a 365-day run is byte-identical
to main's after each addition.

Runs are in `runs/p34/`:
- the gamer's month: `s3/` (before the parking fix), `s3f/` (after); the trucker on the bump: `ends2/FIN-anchor-*`;
- the season: `pol3/` (before), `pol4/` (after);
- four years: `y4-FINAL` (before), `y4-Q12F`, `y4-FIX`, `y4-FIXe` (after); the split by conduct: `conduct/`;
- R15: `s5/`;
- the brokerage: `brk-bump/`.

Scratch, not in the tree: `apps/sim/src/policy.ts`, `parkdiag.ts`, `ownerdiag.ts` and `conductdiag.ts`, beside stage
2's.
