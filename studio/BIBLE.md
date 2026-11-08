# LANES design bible (draft 3, 2026-11-02, after Jeff's answers; owner: the game director)

From the design records and four strangers on the test page.

## The pitch, in one breath
You start with one leased truck and a load board in an America that never pauses, and you build it into the big
company everyone else is trying to build. The market is the game. The token is how the game settles with
the world outside; a player who never hears of it should still have a company worth keeping.

The feeling at the end of a good session, in Jeff's words: real accomplishment from your decisions and grinding.
In the player's: I made a call, it paid, and I'm one load closer to my own truck.

## Who it's for
Freight people first: dispatchers and brokers who read a load board for a living, owner-operators, Trucking
Terminal's users. Trucking-sim players second. Crypto last, as a reward for a game people already play.
Beta one is twenty to fifty people; every screen gets one test: a dispatcher in Tbilisi, on a phone, without
the guide.

## Pillars (three, no more)
1. **The market is real.** Rates, hubs, docks, hours, seasons and roads behave the way they do out there. Test: a
   dispatcher finds something true on every screen and nothing false.
2. **One world, permanent.** The clock never stops, every order stands, everyone sees the same thing. Test: nothing
   a player does can be undone, and nothing the game does happens to one player only.
3. **Growth is earned and risky.** Every truck, driver and business is a bet with a downside; scale pays, splitting
   doesn't. Test: the second truck is harder than the first, and one company of fifty beats five of ten.

What serves none of these is cut.

## The core loop (what a session of play is)
- **A sitting: five minutes, a few times a day.** See what happened since: what delivered, what it paid, where
  the truck sleeps tonight. One decision: book or counter a load, send the truck somewhere better, or set
  the dispatcher for the hours you'll be away. Bids clear every three real hours; worth a glance that often.
- **A day: four game days.** One or two deliveries. Pay lands. A pull-in, a breakdown or a
  dead market says no. The number is always loaded miles against total miles.
- **A week: a game month.** Run the leased truck well: loaded miles, paid on time, the hold building toward a
  truck of your own. That truck is hard to get, as it is in the real world: the first month doesn't promise it,
  and the economy is never tuned to hand it over. It comes when you've earned it, or sooner if you buy FD; the
  day it's yours, the lessor's cut ends. Then the second truck, a driver, the dispatcher at the third: each step
  costs more than the last, and a lost contract, a season or a review can take it back.

Today the dispatcher plays the sitting from minute one and the walkthrough ticks its own boxes: four strangers,
no load won by hand. A game that plays itself is slop.

## The first ten minutes
Target: a stranger on a phone has a bid in inside five minutes, knows when it clears, and understands
what it paid. The UX spec owns the screens; the bible owns the order:

A name; a home hub as three choices. The map at your hub, your truck on it. The board: loads nearest
your truck first, the profit on every card, the loads a newcomer can't take dimmed and saying why. One bid,
and a mark where it was made. The truck rolling. The pay line in the open: rate × miles, less fuel, less the
lessor's 15%, less the deposit, equals yours. Then "the next round is at 18:00; set your dispatcher before you
go". Four tabs in a phone's bar: the truck, the board, Money, More (Iuliia, Help, Company inside); Iuliia's
line always in view.
The walkthrough ticks only on the player's own acts and says one Do at a time. The token is not on the
first hour's path: Money opens on cash, what's owed and when, costs, and Miles as "your standing"; the exchange,
auction and airdrop sit under a fold below, where they stay until the server (Jeff: nobody plays before it).

## What the game is not
Not a dashboard. Not a wallet with a game attached. Not a crime sim with trucks in it. Not a wiki. Not an idle
game: nothing happens to your company that you didn't set up.

## The cut list
**Beta one: serves a pillar now.** Everything a one-truck carrier meets on the road and at the bank: the board
with counters and book-now; standing orders after the first hand-booked load; HOS, docks, roads, tolls, weather,
parking; costs, wear, breakdowns, insurance, yard rent; seasons and the cycle, felt and never explained;
local-first shippers and contracts at the first offer; the used lot, the deposit toward the first truck, loans;
drivers, fatigue, home time; the staff ladder where it bites; the safety record; liquidation with no free
restart; NPC theft; Miles as standing; the Report button.

**Waits for a layer: built, hidden until its day.** Facilities, businesses, truck stops, dealerships (day 28).
Brokerage and re-posting (day 91). Managers, sales, security,
direct freight, scale discounts. The token's Logbook and bridge; the dollar prices
(after counsel and the server). The Economy tab as a published
monthly report. Rates folded into the board. Crews, the Back Lot, Channel 19, bounties and heat (a later beta).

**Goes.** The 34-theme picker: one look. The eight-rule dispatcher form on a one-truck
company's screen. Equipment Finance's deposit side: yield on idle FD is a wallet feature.

## Two rules Jeff set (2026-11-02)
**Teasers stay.** The tabs that matter come first; the rest stay visible as "coming soon" teasers, the Back Lot
among them. The bible argued against them; Jeff overruled it, so the mitigation: a teaser is never a
dead tap. Its card says what the layer is in one line, the day it opens as a
date, one line from Iuliia, and one thing that works (the road ahead, or "tell us what you'd want here"). It
sits after the live tabs, never among the first five on a phone, and on its day it becomes the real tab in the
same place. The Back Lot's card says "a later beta" and nothing about crime, by the studio's own rule.

**The dispatcher waits.** For a one-truck company the standing orders are off until the player has placed a
bid by hand; the truck waits at home. The economy designer sizes it in the simulator (the bots must start the
same way), then a ruleset bump and a restart with no players.

## Jeff's answers (2026-11-02)
1. The pitch and the feeling stand, for now.
2. The first ten minutes is sprint 1, on the test page; the server runs beside it.
3. The token surfaces may stay on the beta screens until the server. Off the first hour's path.
4. The tabs that matter first; the rest as teasers, in More on a phone.
5. The teaser tabs stay, the Back Lot among them (the rule above).
6. Yes: the dispatcher waits for the first hand-booked bid (the rule above).
7. The theme picker goes.
8. Beta one's people come from Jeff's freight list.
