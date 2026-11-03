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
