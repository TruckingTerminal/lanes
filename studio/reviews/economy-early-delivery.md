# Economy: early delivery for a fee, the sizes (2026-11-10)

On Jeff's new sink as the director designed it (director-early-delivery-2026-11-10.md: a fee to have an ordered new
tractor or trailer delivered sooner, from a fixed number of expedite slots a week, nobody else's date moving, a floor of
seven days, no refund, the bots on the same rule). The sizes, the bots, the queue, the FD, and the refill; for a later
ruleset than 0.24.1, behind a switch. No engine edit; the figures are read from the ten seeds of the starters pair
(0.24.1's set) and the one-truck economics of economy-delivery-windows.md.

## What waiting costs, in the game's own figures

The director shows only what the game computes: the lessor's share and the loan payments already running. On the live
levers those are:

| While an ordered truck waits | A free starter's new rig | A fleet's new rig |
|---|---|---|
| The price (the dealer's index over four years; a Workhorse and van opens near 46k and the index carries it to 115k) | 46k–115k | 115k, more for a HighwayPro |
| The lease rent on the truck it replaces (`byValue`: 0.5% of the leased truck's value a week, at least 250) | ≈ 250 a week | — |
| The purchase loan's weekly payment, which runs from the order (principal over 104 weeks plus 0.28–0.31% a week) | ≈ 430 a week on 46k at 24% down; ≈ 1,100 on 115k | ≈ 1,100 a week on 115k at 14% down |
| **What the game can show as the cost of a week's wait** | **≈ 700 a week** | **≈ 1,100 a week** |
| Not shown, by the director's rule: a truck-week's profit (2,000–2,500 in the ten seeds) | | |

The dealer's wait on the ten seeds is 34–36 days at steady state (years 1–4, the rush of months 2–3 gone with the
starters' rigs from stock), so an expedite to the seven-day floor saves about four weeks at steady state and up to eight
in a cold world's first quarter.

## The fee: one figure a player can read

**`dealer.expedite.feePerWeekSaved` 1.5% of the truck's price per week saved, read to the day; a floor of 300 FD
(`minFeeFd`), a cap of 9% of the price (`maxFeeShare`, six weeks); paid at once, never refunded.**

- On a 46k starter rig, four weeks saved cost 2,760 against about 2,800 of rent and loan payments the game can show:
  a real choice, where Iuliia says "about even; the truck earns from day 7 instead of day 35", and the player decides.
  On a 115k fleet rig the same four weeks cost 6,900 against 4,400 of payments shown and a truck-week's profit four
  times over unshown: a fleet with freight to haul takes it, which is what expedites are for out there.
- Read to the day so a short expedite is cheap (two days saved on a 46k rig: 200, the floor 300), and capped so the
  cold start's eight-week saving on a 115k rig is 10,350, not 13,800.
- The floor stays the director's seven days; nothing in the economy wants it higher.

## The slots

**`dealer.expedite.slotsPerWeek`: half the trailing four weeks' deliveries a week, never under 2, rounded up.** The ten
seeds deliver about 7 trucks a week in year 1 and 2–3 a week in years 2–4 (orders 374 · 224 · 123 · 125 a year, 86 in
month 1), so the pool is 4 a week in year 1 and 2 after. Half the week's deliveries is what a build slot or a transport
can absorb without making the queue a fiction; with the pool tied to deliveries it scales with the world (a fleet
economy twice the size has twice the slots) and never with the orders waiting, so a rush cannot buy itself out.

**The bots will fill it.** On Iuliia's rule (expedite when the fee is under what the wait costs and the cushion holds)
a fleet with a 115k rig on order says yes every time (6,900 against payments of 4,400 and a truck-week's profit a
week), and a starter on a 46k rig says no or about even. So the fleets take the slots first-come, and at 2 a week in
years 2–4 the pool empties most weeks. That is the fault the director wants to see, and the fix is in the rule, not the
count: **a bot expedites only when its wait is longer than `dealer.expedite.botMinWaitDays` (21) and its cushion after
the fee holds two months of the loan's payments**, the prudence rule the bots already use for the loan itself. At a
five-week steady wait that is most fleet orders still; so the pair should read how many of the slots the bots take by
week, and if it is over half, the slot count rises to the whole week's deliveries, which keeps a player's earliest date
inside two weeks. Players compete for the same slots first-come, as the director ruled; a player who finds the week
taken sees the next week's date, still three weeks sooner than the queue.

## What it does to the queue for those who do not pay

Nothing, by construction: the expedite slots sit beside the ordinary queue and nobody's given date moves. The wait that
others read (30 days plus a quarter-day an order pending) counts expedited orders while they wait, so an expedite that
takes an order out of the queue in a week instead of five shortens the wait others see by a quarter-day each: the queue
gets slightly shorter for those who do not pay, never longer.

## How much FD it sinks

At the bots' order volume the sink is small, and it should be said so:

| | Year 1 | Year 4 |
|---|---|---|
| Orders a month (the ten seeds) | ≈ 31 (86 in month 1) | ≈ 10 |
| Expedited, on the bots' rule with the slots as sized | 4 a week, ≈ 17 a month | 2 a week, ≈ 9 a month |
| Fee each (four weeks saved at 1.5% a week; year-1 prices lower) | ≈ 3,000 | ≈ 6,900 |
| **FD sunk a month** | **≈ 50k** | **≈ 60k** |
| Against the cap's monthly freight budget (≈ 29M) | 0.2% | 0.2% |

With players ordering (a fleet of ten growing by a truck a month), each expedite is 3–10k more; the sink is tens of
thousands of FD a month either way. Its worth is the choice it gives a player and the honesty of the date, not the FD it
burns; as a token sink it is a rounding error beside the season close and the exchange fees.

## The refill: outside it

Under the cap the NPC freight budget refills from the trailing operating sinks net of the other faucets, so a fee
tagged as an operating sink would raise next months' freight pay by the fees paid. That is not wanted: a player's
impatience should not buy the whole economy more freight, and a sink Jeff asked for as a sink should leave the game.
**Tag it a burn (`sink:expedite` in `BURN_TAGS`)**, beside the season close and the exchange fees: outside the refill,
outside the operating ratio the band reads, counted in the reports' burns. At 0.2% of the budget the choice changes no
reading either way; the principle does.

## The gate, and what the pair reads when it is built

With the rule on the bots' fleets get their new rigs four weeks sooner, so capacity arrives a little earlier in a boom
and the fleets carry their loans a few weeks less idle; the starters' lot rigs are untouched (from stock, no expedite).
Expect the ten seeds inside the spread on every line and the band unmoved (a burn is outside it). The pair reads: the
slots taken by bots by week and by segment (the director's fault line), the fees paid a month at years 1 and 4 against
the table above, the dealer's wait for those who do not pay, the fleets' truck count and profit per truck-week, the
carriers' line and the band. A later ruleset than 0.24.1, with the windows set or alone, as the gate says.
