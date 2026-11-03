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
