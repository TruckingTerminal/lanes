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

## Los Angeles (director's condition, 2026-11-02)

Economy designer, for the producer: ruling 4's two conditions on Los Angeles. Main at bb1ef8d, ruleset
0.19.2-phase0.31 (the live profile is now v55-a's: the first bid by hand is a live lever), seeds 1, 4, 8. Nothing
under `apps/web` or `packages` changed; outputs in `runs/` (gitignored).

### The first board at every age

The same tool, window and margin as section 3 (`firstBoard.ts`, 14 days, +25% over the dispatcher's break-even),
LAX with DAL and PHX as controls in the same runs. Share of rounds with a profitable open load at the hub:

| Hub | days 0–13 (the restart) | day 0, rounds 1–2 | day 1 | days 60–73 | days 120–133 (by seed) | days 240–253 | days 400–413 |
|---|---|---|---|---|---|---|---|
| Los Angeles | 98% | 83% | 83% | 100% | 100% (100 / 100 / 100) | 100% | 100% |
| Dallas | 94% | 17% | 100% | 93% | 74% (86 / 46 / 89) | 100% | 93% |
| Phoenix | 92% | 33% | 67% | 93% | 56% (86 / 14 / 68) | 99% | 100% |

Los Angeles's lowest seed at any warmed age is 100%; at the restart, 93% (seed 8). Its board is deep: 211 open
loads a round at the restart (Chicago's was 186 in section 3), 7.2 profitable ones a round on the first morning
against Dallas's 0.3, and in May 38.8 a round against Dallas's 2.7 and Phoenix's 2.0, at a median best margin of
+152%. In May it is the deepest of the ten (section 3's ten-hub run: 95 open loads a round, the next 51). The
theft premium in its rates is small: 0.03 × (lane risk − 1) × the van's 1.01 attraction, about 0.03 FD/mi on a
van out of LAX, under 2% of a 2.0 FD/mi break-even, so the pass doesn't rest on it.

**The controls moved in May.** At the live ruleset Dallas reads 74% and Phoenix 56% in May, against section 3's
100% and 75% (CHI, DAL, PHX, MEM probes, ruleset 0.30). The same three probes with the first bid by hand off
(`--set freeEntry.firstBidByHand=false`, 0.30's profile) give Los Angeles 100%, Dallas 92% (100 / 100 / 75),
Phoenix 74% (100 / 39 / 82): the drop comes from the world's path into May under the live rule, or from seed
noise (three seeds can't tell them apart), and not from the probe set. Phoenix's seed 4 is the weak one in every
run (43%, 39%, 14%). This doesn't touch Los Angeles's condition, but at the live ruleset Los Angeles is the only
hub of the three that clears 75% in May on all three seeds. Dallas and Phoenix still pass "most rounds".

**Verdict, condition 1: pass.** Los Angeles clears the test at every age, 98% at the restart and 100% on the
warmed board, and in May (days 120–133) 100% on every seed, where Chicago read 0–1%.

### A starter's first weeks at the 3.0× theft risk

**No option fixes a starter's home hub.** `starterHub()` in `packages/agents/src/ruleBots.ts` draws every new
company's hub from the ten starter hubs, weighted by hub size (`packages/data/src/hubs.ts`; LAX's 3.0 of 22.5,
13%), and `--set` reaches only the config. The report (`packages/engine/src/report.ts`) has no per-hub figures.
So nothing was added to the engine. A scratch runner outside the repo (`la-starters.ts`) runs `run.ts`'s world
unchanged (live profile, 400 / 120 / 60, `ruleBotHook`, 400 days) with an observer on `w.listener`, which the
engine documents as never affecting the simulation. The observer records each "stolen overnight" notice with
the load aboard, each liquidation, and at the end every free starter's home hub and first owned truck. It
reproduces v55-a exactly: free-path medians 45 / 49 / 63 days, liquidations 186 / 155 / 131, thefts
273 / 255 / 264, and `compare.ts` gives identical rows for `runs/v55-a` and `runs/la-v55h`. The baseline is
therefore v55-a's own starters, and the LAX rows are the 167 of them the world homes there. A second set runs the
same worlds with `theft.oddsPerLoadedNight=0`: no thefts, and the rates, insurance and night-risk exposure as
before.

Pooled over the three seeds. Days count from the starter's creation (day 0 for all of them). Theft loss is the
2,500 FD cargo deductible plus the pay forfeited at the won rate:

| Starters homed at | starters | thefts days 0–27 / 0–83 (starters hit) | per 100 starters, 0–83 | theft loss FD 0–27 / 0–83 | liquidations 0–27 / 0–83 / 0–399 | first owned truck: median days, pooled (by seed) | bought within 84 days | theft odds at 0: median days (by seed) / within 84 / liquidations 0–399 |
|---|---|---|---|---|---|---|---|---|
| Los Angeles | 167 | 3 (3) / 9 (9) | 5.4 | 29.9k / 91.2k | 0 / 0 / 9 | 44 (42 / 45 / 56) | 121 of 143 (85%) | 49 (43 / 44 / 57) / 79% / 12 |
| Dallas | 117 | 4 (3) / 10 (9) | 8.5 | 30.3k / 77.7k | 0 / 0 / 10 | 61 (56 / 45 / 78) | 81 of 108 (75%) | 61 (61 / 49 / 77) / 73% / 8 |
| Phoenix | 84 | 3 (3) / 4 (4) | 4.8 | 24.0k / 30.2k | 0 / 0 / 6 | 39 (39 / 38 / 35) | 66 of 80 (83%) | 41 (40 / 42 / 38) / 80% / 5 |
| Chicago | 154 | 2 (2) / 9 (8) | 5.8 | 20.4k / 63.4k | 0 / 0 / 14 | 49 (42 / 49 / 57) | 116 of 135 (86%) | 56 (49 / 49 / 63) / 85% / 13 |
| Every starter (v55-a) | 1200 | 29 (28) / 85 (78) | 7.1 | 227k / 674k | 0 / 2 / 89 | 56 (45 / 49 / 63) | 867 of 1074 (81%) | 56 (49 / 49 / 69) / 78% / 91 |

The 3.0× barely reaches a starter in its first weeks. It applies to a loaded night within 80 mi of LAX (120 of
Ontario), and a truck that loads in Los Angeles usually sleeps its first night beyond that. Of the nine LAX starters'
thefts in their first 84 days, two were on Los Angeles lanes (ONT→SAT, LAX→OKC); the others were on SLC→DAL,
DAL→JAX, MIA→HOU, CLT→ATL, OMA→ATL, PHX→LIT and PDX→DEN, wherever the board took them. Their night-risk exposure
at day 400 is 1.21, the same as every hub's. Over the full 400 days the hotspot shows a little, as routes bring
starters home: 68 thefts on 167 LAX starters (41 per 100) against 35 per 100 for every starter, 1.2×, not 3×. A
theft is real money for the starter it hits, about 10k FD on a Los Angeles load (the 2,500 deductible and some
7.6k of pay on long hauls out), but it is 5% of LAX starters in 84 days and 546 FD a starter on average. With the
odds at zero, LAX starters buy no sooner (49 days against 44) and no more often (79% against 85% within 84 days):
the batch can't see what theft costs a Los Angeles starter.

**Verdict, condition 2: pass.** In its first 28 and 84 days a Los Angeles starter is robbed no more often than the
average starter (3 and 9 thefts, 5.4 per 100 against 7.1), none is liquidated (every starter: 0 and 2 of 1200),
and the median buys its first truck at 44 days pooled (seeds 42 / 45 / 56) against every starter's 56 (v55-a's
own 45 / 49 / 63), inside the 84-day limit, 85% of them in time.

**The hubs: Dallas, Los Angeles, Phoenix**, as ruled; the fallback isn't triggered.

**What I could not measure.** (1) A world in which starters are homed at LAX by rule: no option fixes the hub,
so the LAX rows are the bots the standard world puts there, 51 to 60 a seed. With 9 thefts in 84 days the count
is small (a Poisson range of roughly 4 to 17). (2) A starter joining a warmed world: every bot starter is
created on day 0, so "the first weeks" here are the restart's weeks, and their authority ages are drawn from
0–400 days, older than a player's. (3) A player's own nights: these are rule bots on the default dispatcher,
whose trucks sleep at a site nine nights in ten (v55-a: 174k site nights, 18k on the shoulder). A player who parks loaded on a Los Angeles shoulder meets 3 × 3, nine times the base
odds, and nothing here measures how often that happens. (4) Losses beyond the deductible and the forfeited pay
(fuel and hours on the stolen leg, the six-hour police report), and premiums, which move with night-risk
exposure, 1.21–1.22 at every hub.

### Commands

```sh
# 1. The first board at five ages (runs/fb-la-warm{0,60,120,240,400}.md), and May with the first bid by hand off
for w in 0 60 120 240 400; do
  npx tsx apps/sim/src/firstBoard.ts --seeds 1,4,8 --days 14 --warm $w --hubs LAX,DAL,PHX > runs/fb-la-warm$w.md
done
npx tsx apps/sim/src/firstBoard.ts --seeds 1,4,8 --days 14 --warm 120 --hubs LAX,DAL,PHX --set freeEntry.firstBidByHand=false > runs/fb-la-warm120-hand-off.md

# 2. The v55-a profile observed per starter hub, and the same with the theft odds at zero (scratch runner, not in the repo)
LA=/private/tmp/claude-501/-Users-jeffreyaranguren-Library-Application-Support-Claude-scratch-workspaces-a1cccdc7-6602-4940-9616-8560a2fd5b81-169558f1-a38b-42b8-8e12-6bffd7b12dd8-scratch-2026-10-27-16711a/526f296d-690d-46c9-aad3-7168e4b19246/scratchpad/la-check
for g in 1 4 8; do
  npx tsx "$LA/la-starters.ts" --seed $g --days 400 --out runs/la-v55h > runs/la-v55h-$g.log
  npx tsx "$LA/la-starters.ts" --seed $g --days 400 --out runs/la-v55h-notheft --set theft.oddsPerLoadedNight=0 > runs/la-v55h-notheft-$g.log
done
node "$LA/la-table.mjs" runs/la-v55h runs/la-v55h-notheft > runs/la-starters-table.md
npx tsx apps/sim/src/compare.ts runs/v55-a runs/la-v55h runs/la-v55h-notheft > runs/compare-la-v55h.md
```

### May on ten seeds: the first bid by hand on and off

This settles the controls' May drop. The same test (days 120–133, LAX, DAL, PHX probes) over seeds 1–10, one seed a
process, at the live ruleset (rule on) and with `freeEntry.firstBidByHand=false` (rule off). Seeds 1, 4 and 8
reproduce the three-seed runs exactly. Each seed has 28 rounds, so the ten-seed share is the mean of the seeds:

| Hub | first bid by hand | May share, 10 seeds | median seed | lowest – highest | seeds under 75% | clears 75% |
|---|---|---|---|---|---|---|
| Los Angeles | on | 100% | 100% | 100% – 100% | 0 | yes |
| Los Angeles | off | 100% | 100% | 100% – 100% | 0 | yes |
| Dallas | on | 81% | 91% | 29% – 100% | 3 (seeds 4, 5, 9) | yes |
| Dallas | off | 96% | 100% | 75% – 100% | 0 | yes |
| Phoenix | on | 84% | 100% | 14% – 100% | 3 (seeds 4, 8, 9) | yes |
| Phoenix | off | 92% | 100% | 39% – 100% | 1 (seed 4) | yes |

Both, and more of it seed noise. Three seeds drew bad Mays: seed 4 is the worst at Phoenix under both settings,
and 4 and 8 pulled the three-seed shares down to 74% and 56%. On ten seeds Dallas (81%) and Phoenix (84%) clear
the bar with the rule on. The rule's effect is real but smaller: −15 points at Dallas, −8 at Phoenix, none at Los
Angeles. Where a seed differs between the settings it is lower with the rule on in 9 cases of 10 (Dallas 5 of 6,
Phoenix 4 of 4), a sign test at p ≈ 0.02. The batch doesn't show the mechanism: the rule only holds a starter's
truck for its first round or two, so the effect on May comes from the world's path, not a gate in May. What it
costs: with the rule on, three Mays in ten fall under 75% at Dallas and at Phoenix, and none at Los Angeles.
Ruling 4's seasonal line on a hub card covers those Mays. The hubs stand: Dallas, Los Angeles, Phoenix.

```sh
# runs/fb-may10/hand-{on,off}-seed{1..10}.md, then the table (runs/fb-may10-table.md)
for g in 1 2 3 4 5 6 7 8 9 10; do
  npx tsx apps/sim/src/firstBoard.ts --seeds $g --days 14 --warm 120 --hubs LAX,DAL,PHX > runs/fb-may10/hand-on-seed$g.md &
  npx tsx apps/sim/src/firstBoard.ts --seeds $g --days 14 --warm 120 --hubs LAX,DAL,PHX --set freeEntry.firstBidByHand=false > runs/fb-may10/hand-off-seed$g.md &
done; wait
node "$LA/may10-table.mjs" runs/fb-may10 > runs/fb-may10-table.md   # $LA as in the commands above
```

## The hub card's season line: the measure (2026-11-02)

Economy designer, for engineering and the writer. This is a spec only; no code changed.

**The seasonal multiplier can't be the measure.** The "Seasons now" card and the provisional `seasonLine()` in
`apps/web/src/hubcard.ts` read the engine's calendar, `seasonality(w, hub, "van", day)` (`demand.ts`). Its May van
volume is Chicago 0.58, Los Angeles 0.72, Dallas 0.94, Phoenix 0.95, and Los Angeles reads 0.66–0.74 from
February to May. No cut points on that number make Los Angeles in May read better than Dallas and Phoenix, yet its
board is the only one of the three that passes on every seed. Today's provisional cuts (0.85 / 0.95 / 1.1) would
print "Freight is thin here in May" on Los Angeles. Its freight is deep for reasons the calendar doesn't hold: the
load-to-truck ratio, the reload run and rolled ceilings. The Rates table's loads per truck (`w.lastRatioEq`) is
closer, but no run records it, so I can't calibrate it.

**The measure: the hub's first board, read live.** Two steps, at the moment the card is drawn:

1. In the loop `hubFacts()` already runs over the hub's open dry-van loads, count those whose ceiling clears a
   starter's break-even by `ui.season.margin`. The starter is the free path's leased Workhorse with a dry van,
   at the hub. Its break-even uses the same arithmetic as ruling 5's chip (`trueBreakEven` in
   `apps/sim/src/firstBoard.ts`): `breakEvenPerMile` with the lessor's share, `fuelPrice(w)`, tolls and climb,
   and the expected reload run (`expectedReloadDeadheadMi`) at the default dispatcher's foresight and reload
   weight for a new owner.
2. Divide by the hub's base van freight a round: `freight.baseLoadsPerRound × hub.weight ÷ Σ hub weights ×
   freight.equipmentShare.van × hub.imbalance.van`, the season-free factors of `hubDemandPerRound`. That is
   Chicago 12.1, Dallas 9.6, Phoenix 3.75, Los Angeles 15.1.

The result is one number per hub: profitable open loads now, per round of the hub's normal freight. It is
section 3's test (the "+25% loads a round" column) without the probe's gates, which lock 0–2 loads a round after
the first week.

**The keys:** a `ui.season` block in `packages/config/src/economy.config.ts`. There is no client config. The copy
spec reads every `{key}` from that file. `tiredAt` sets a precedent for a threshold only the client reads. And
these cut points are calibrated on the economy, so they should move and be versioned with the ruleset. Adding
the block bumps the version, with no effect on the sim.

| Key | Value | Reads |
|---|---|---|
| `ui.season.margin` | 0.25 | a load counts when its ceiling clears the break-even by this (the default dispatcher's bar) |
| `ui.season.thinUnder` | 0.15 | below: thin (under about 2 profitable loads at Chicago or Los Angeles, under 1 at Phoenix) |
| `ui.season.fineFrom` | 1.5 | below, and not thin: a little thin |
| `ui.season.busyFrom` | 4.5 | from here: busy; between fine and busy: fine |

**The four hubs by month, from the runs above** (the measure, its state, and in brackets the profitable loads a
round). Dallas, Phoenix and Los Angeles come from this section's runs at 0.31; Chicago from section 3's at 0.30.
Each cell is a 14-day mean:

| Hub | Jan (days 0–13, the restart) | Mar (60–73) | May (120–133) | Sep (240–253) | Feb, year 2 (400–413) |
|---|---|---|---|---|---|
| Chicago | 4.45 fine (53.7) | 6.00 busy (72.3) | 0.00 thin (0.0) | 3.29 fine (39.7) | 2.78 fine (33.5) |
| Dallas | 2.33 fine (22.3) | 3.22 fine (30.8) | 0.28 a little thin (2.7) | 4.71 busy (45.1) | 1.02 a little thin (9.8) |
| Phoenix | 2.27 fine (8.5) | 3.17 fine (11.9) | 0.53 a little thin (2.0) | 3.57 fine (13.4) | 1.09 a little thin (4.1) |
| Los Angeles | 5.82 busy (87.7) | 4.22 fine (63.7) | 2.57 fine (38.8) | 6.85 busy (103.3) | 1.68 fine (25.4) |

May over the ten seeds:

- **Los Angeles:** 2.28–4.64, fine on 9 seeds and busy on 1.
- **Dallas:** thin on its three failing seeds (0.04–0.11; 29–68% of rounds), a little thin on its three weak ones
  (0.30–0.43; 86–93%), fine or busy on the four strong ones.
- **Phoenix:** thin on seed 4 (0.03; 14%), a little thin on 1, 8 and 9 (0.43–1.17; 68–86%), fine or busy on the
  rest.

So the state follows the board each world actually has. Section 3's ten-hub May agrees: Memphis, Atlanta, Newark
and Columbus read thin (0.00–0.06), Houston and Miami a little thin (0.80, 0.85).

**What I could not check.**

1. **Rounds.** The runs keep 14-day means, so a card reading one round will cross a cut point where those means
   sit near it. Dallas's weak Mays have rounds with no profitable load at all.
2. **Months.** June and July, Dallas's and Phoenix's calendar peak, and five other months are in no run. Phoenix
   never reads busy in the windows above.
3. **Chicago at the live ruleset.**
4. **The break-even.** The card's starter break-even, at the default skill and with no gates, is not the probe's
   own, so a reading may differ from the probe's by a load or two.
