# Economy review: the first bid by hand, and the first board (sprint 1, 2026-11-02)

Economy designer, for the producer. Nothing is committed; the economy stays frozen except the one rule Jeff
approved. Live profile (0.19.1-phase0.30), seeds 1, 4, 8.

## 1. The rule: standing orders wait for the owner's first bid

**Switch:** `freeEntry.firstBidByHand` (default off). On, a carrier with one truck runs no standing order until
its owner has placed a bid or booked a load by hand: no sealed bids, no book-now, no repositioning; the truck
waits at home. The first accepted `place_bid` or `book_load` sets `company.firstHandBidDay`; from then on the
orders run, win or lose, through a restart too. A fleet of two or more never waits; changing the dispatcher is
not a bid. Nothing under `apps/web` changed: the default dispatcher now sits quietly until the first counter, and
the Truck tab's "why isn't my truck bidding" card needs a line for it.

**Code:** `ordersWaitForHand()` in `packages/engine/src/standingOrders.ts`, checked in sealed bidding, book-now
and repositioning (`board.ts`); the day recorded in `actions.ts`. Test "the first bid by hand (sprint 1)" in
`engine.test.ts`: inert through two rounds with a rich load at home and a loaded board next door; the switch
off, or a second truck, bids from round one; bots bid by hand. Typecheck clean, the suite 208/208.

**Bots:** `firstBidByHand()` in `ruleBots.ts`: while its orders wait, a bot reads its home board once a day and
counters, through `place_bid`, on the load it may take that pays best over its break-even, at its bid order's
ask. The report gains `freePath.handBid` (starters that bid, days the truck waited).

## 2. What the rule costs (batch v55-a)

Three seeds, 400 days, the switch on, beside the same profile with it off for 400 days (v55-0) and beta one's
four-year batch (v54-a; its first 400 days where the daily metrics allow). Full table: `runs/compare-v55.md`.

| Measure (mean, min–max over seeds) | v54-a (off, 4 years) | v55-0 (off, 400 d) | v55-a (on, 400 d) |
|---|---|---|---|
| Free path: median days to the first owned truck | 45 (42–52) | 56 (49–69) | 52 (45–63) |
| Free path: bought within 84 days, of starters old enough | 402 (370–430) | 275 (244–295) of 358 | 289 (270–305) of 358 |
| Liquidations in the first 400 days | 147 (138–166) | 147 (138–166) | 157 (131–186) |
| Loads cleared in the first 400 days | 142.1k | 142.1k | 142.4k |
| Owned trucks at day 400 | 710 (684–735) | 710 (684–735) | 717 (681–738) |
| Starters that bid by hand / days the truck waited (median, mean) | off | off | 400 of 400 / 1, 1.0 |

The rule costs the free path nothing the batch can see. A starter's truck sits two rounds while its owner reads
the board (the bots bid at the first midnight; a player bids in their first sitting), then the median starter
buys its truck no later than without the rule (52 days against 56, inside seed noise: 45/49/63 against
49/49/69), 14 more buy within 84 days, liquidations (+10, seeds moving both ways), cleared loads and owned trucks
sit within half a percent.

## 3. The first board

**Method** (`apps/sim/src/firstBoard.ts`): a fresh world at the live profile, one probe company per hub (a free
starter with a dry van and no standing orders, so it never bids) reads its home board after every round, as a
player does. A load is *open to it* when the vetting gate, the hot-load rule, local-first and the broker-credit
floor let it bid; *profitable* when the ceiling clears the dispatcher's own break-even for that truck (fuel,
wages, the lessor's 15%, tolls, climb, the expected empty run after delivery) by the default dispatcher's 25%. A
hub passes when most rounds offer one such load. Fourteen days, 84 rounds a hub.

**By the world's age.** Share of rounds with a profitable open load at the hub:

| Hub | days 0–13 (the restart) | day 0, rounds 1–2 | day 1 | days 60–73 | days 120–133 | days 240–253 | days 400–413 |
|---|---|---|---|---|---|---|---|
| Chicago | 100% | 100% | 100% | 100% | 0% | 93% | 100% |
| Dallas | 94% | 17% | 100% | 100% | 100% | 95% | 95% |
| Phoenix | 93% | 17% | 83% | 70% | 75% | 94% | 100% |
| Memphis | 88% | 0% | 33% | 83% | 15% | 93% | 81% |

The restart's board is the richest the world ever has: unfilled loads roll with their ceilings up 10% a round,
and by day 2 every hub shows dozens of open loads at +100% and more. The first morning is the exception: two
rounds in, Dallas shows a handful of loads at +10 to +20% over a leased truck's break-even and a book-now under
it, the board the playtest described.

**Who may take what.** On the restart's board the vetting gate locks half the van loads at every hub (80% of AI
brokers vet at 30 or 90 days). Opening the 30-day tier (`fraud.vetting.standard.minAuthorityDays` 30 → 0) raises
what a newcomer may take by 48% (Chicago 54 → 80 loads a round, Dallas 24 → 35, Phoenix 9.5 → 13.8, Memphis
17.5 → 25.3) and moves the first morning a little (Phoenix 17% → 33%, Memphis's day 1 33% → 67%); the 14-day
shares stay (94 / 94 / 90 / 100%). More direct shippers (`freight.npcBrokerOnlyShare` 0.5 → 0.35) adds takeable
loads and no profitable rounds. From day 60 the gate locks 0–2 loads a round: vetted carriers take the brokered
freight first. After the first week no gate holds what a newcomer lacks.

**What it lacks is price, by season.** At days 120–133 (May) Chicago posts reference rates of 1.2–1.8 FD/mi
against the starter truck's 2.0 break-even before any empty run (seed 1: eight loads at −14 to −38%); Memphis
1.8–2.6. The same window at all ten starter hubs: Los Angeles 100%, Dallas 94%, Phoenix 79%, Houston 65%, Miami
44%, Memphis 12%, Newark 10%, Atlanta 7%, Chicago 1%, Columbus 0%. The Midwest and the East run truck-heavy in
spring; by late August (day 240) all four pass again and in February Chicago is the best board of the four.
That is the market, not a gate.

## 4. Proposal

**Smallest change, no planted loads: none to the economy; two to the restart and the page.**

1. **Let the world run two game days before the page opens** (4 rounds, 12 real hours at the live clock). The
   first players meet the day-3 board, 100% at all four hubs, instead of the first morning's 17%. Cost: nothing
   in FD, twelve hours of calendar, no rule, no ruleset bump.
2. **The card's number is the dispatcher's.** The profit chip carries the break-even above, lessor's share and
   empty run included, or Chicago in May shows "profit" on loads no dispatcher would bid. A locked card names
   its gate: the 30- and 90-day tiers are the only locks a newcomer meets.

**If a rule must move**, the only gate with an effect is the 30-day vetting tier → 0 (+48% takeable loads on day
one, +16 points on Phoenix's first morning). Its cost is the exposure it limits: brokers would load authorities a
day old, and a newcomer's reach into brokered freight rises from 20% to 60% (v54-a: 336 double-brokered loads in
four years). Not worth it for the first ten minutes; a candidate for the next batch if Jeff wants it.

**Hubs.** Phoenix passes at every age measured (93% at the restart, 70–79% warmed, 100% at day 400; in May two
seeds of three: 100 / 43 / 82%): it stays; Memphis would not improve on it (88 / 83 / 15 / 81%; May 25 / 4 / 18%). Dallas passes at every age (94–100%). Chicago passes at the
restart and in winter and fails in spring (0–1% at days 120–133). For the director: either a starter hub is
allowed a season (Iuliia: "freight is thin here in May; Dallas pays today"), or the three are chosen on the
warmed board, where only Dallas, Los Angeles and Phoenix clear 75%.

## 5. For the producer

- The switch is built, tested and sized; it waits for the ruleset bump and the restart with no players.
- Engineering: the waiting dispatcher's line on the Truck tab; the profit chip on the dispatcher's break-even.
  Director: Chicago's season; the two-day run before the page opens.
