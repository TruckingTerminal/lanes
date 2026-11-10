# Economy: who buys a listing, and what "would fetch today" is worth (2026-11-10)

On the exploit hunter's diary (play-2026-11-10-exploit-hunter.md: a driverless reefer listed at 158,799 on day 2, "worth
171,526" on day 20, unsold at day 61; a 45k lot rig listed at 44,980 and gone in eight days at 42,731). Read from the
code at main and the ten off seeds; nothing run.

## 1. Who buys a player's listing

Three buyers, all bots, one rule (`ruleBots.ts bestListing`), and no NPC:

- **A free starter buying its first truck** (`bestListing(w, cash − firstTruckBuffer, …, runOut)`, or on a loan with a
  budget of its spare cash ÷ the cash a financed purchase needs, about 3.4× the spare with the collateral rule off):
  the cheapest listing by ask ÷ book value within that budget, run-out trucks allowed. Hundreds of them in year one, with
  spare cash in the thousands to a few tens of thousands: the 45k rig's buyer.
- **A fleet growing** (`bestListing(w, cash − reserve)`, or the same on a loan, prudent ones only with two months of
  payments kept): the cheapest listing by ratio within its budget, rebuildable trucks only. A few growth events a day
  nationally; the fleets' median cash is 6–38k by persona (the ten seeds), so a financed budget of 20–130k.
- **A dealership's trade-in** (`tradeInOffer`): 80% of book value, only from a dealership whose owner has that cash
  and lot room, after dealerships exist (day 28 on the test page); the bots take it before listing when one is open.

The rule itself: a listing is skipped when its ask is over 1.05 × book value or over 85% of a new rig's price, and
among the rest the lowest ask ÷ value wins, whatever the trailer (no buyer looks at van against reefer). The used
market clears about 753 trucks a run over four years on the ten seeds, 3–4 a week nationally against the bots' own
listings (every worn truck a fleet sells, at book value stepping 5% a week to a 60% floor; fire sales at 85%).

**Why the reefer found nobody.** Not the trailer and not the test page's population; the price band. At 158.8k the
listing passed both price tests (0.93 of book; under 85% of a new reefer rig) and no buyer had the budget: a starter's
spare cash buys up to about 60k, and a growing fleet needs 47k of spare cash to finance 159k, which the median fleet
does not hold; the few that do grow a few times a run, and on the day they do the cheapest ratio in their budget wins.
The ask fell 8.6k a week (5% of the listing-day value), reaching the band where a growing fleet could take it in weeks
four to six at about 0.75–0.8 of book, and no fleet grew that week. The 45k rig sat inside hundreds of starters'
budgets at a ratio of 0.95 after one step: sold in eight days. What the diary could not see: **at the 60% floor, week
eight, the listing is withdrawn and the truck parked** (`market.ts stepListings`), not left for sale for ever; the
reefer was one week from that. And the "Idle fees 600 FD" are the idle fee on any truck idle more than seven days (20
FD a day), listed ones included: a holding cost, said nowhere on the sheet.

## 2. Is "would fetch today" a price anyone pays

**No. It is book value**: the tractor's list price today less miles, age and wear, plus the trailer, and it rises with
new-truck prices (the index) while the truck sits, which is why it climbed 13,000 in seven weeks. It is the figure the
lender prices a loan on and the lot prices its rigs from, and the ceiling of what any bot will pay (1.05×). What trucks
sell for: the bots' listings go when their ratio is the lowest in a buyer's budget, which for a cheap rig is near book
within a week or two and for a dear one is 0.6–0.8 of book after weeks of steps, or nothing. The dealer's own used rows
ask 85% of book and sell at that. There is no price today at which a 150k reefer sells with certainty: the floor
withdraws it, the NPC dealer takes no trade-in, and a dealership's 80% needs an owner with 137k in hand.

## 3. What the game should say and offer

1. **Words, no pair:** the card's "worth" becomes **"book value"** ("what the lender and the lot price it at: its list
   price today less miles, age and wear"), and beside it **"would sell for about N"**, the realistic figure: for a truck
   whose ask sits inside the starters' band (under about 60k), 0.9 of book inside two weeks; above it, the trade-in
   figure of 3 below, and until that exists "0.6–0.8 of book, if a fleet is buying". The sell sheet says the three
   things it does not say now: the price drops 5% a week to 60% of today's book, at the floor the truck comes off sale
   and is parked, and a listed truck pays the idle fee (20 FD a day) while it waits. "Take it off sale" is the client fix
   the producer has in hand.
2. **The weekly drop:** keep 5% a week and the 60% floor. A deeper or faster drop does not make a buyer with 150k
   appear; it only gives the one that does a cheaper truck.
3. **The certain exit, a pair and a ruleset: the NPC dealer's trade-in.** `usedMarket.npcTradeIn: { enabled: false,
   share: 0.65 }`: the NPC dealer takes any owned truck at 65% of book value, at once, the loan on it repaid from the
   price first (refused when 65% does not clear it, as a listing's floor is today), the truck into the used lot's stock
   to be sold on at the lot's own price. 65% is wholesale against the lot's 85% retail, under the dealership's 80% so a
   player dealer keeps its trade; and it closes the only arbitrage, since a listing bought at the 60–65% floor and
   traded in at 65% loses the 5% market fee and the 7% sales tax on the way. The FD is the NPC dealer's (a faucet,
   `faucet:npc_tradein`), returned when the rig sells from the lot (`sink:used_lot`), so over a season it is a wash and
   under the cap it sits inside the budget like the lot's sales. It moves money and the bots would use it (a fleet
   selling a worn truck today lists it and waits, or takes a dealership's 80%; with this it trades in at 65% at once
   when no dealership offers), so it changes the used market's listings, the lot's stock and the fleets' cash: a
   ten-seed pair with the lot's and the listings' lines, the starters' first truck (the lot would carry more stock) and
   the gate, before its ruleset. It is the figure "would sell for about N" can promise for every truck: 65% today,
   more from a dealership or a buyer if the player waits.
