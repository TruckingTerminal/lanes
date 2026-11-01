# LANES design bible (draft 2, 2026-11-02; owner: the game director; Jeff decides through the producer)

From the design records and four strangers on the test page (ruleset 0.19.1).

## The pitch, in one breath
You start with one leased truck and a load board in an America that never pauses, and you build it into the big
company everyone else is trying to build. The market is the game. The token is how the game settles with
the world outside; a player who never hears of it should still have a company worth keeping.

The feeling at the end of a good session: I made a call, it paid, and I'm one load closer to my own truck.

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
  the truck sleeps tonight. Make one decision: book or counter a load, send the truck somewhere better, or set
  the dispatcher for the hours you'll be away. Bids clear every three real hours; worth a glance that often.
- **A day: four game days.** One or two deliveries. Pay lands. A pull-in, a breakdown or a
  dead market says no. The number is always loaded miles against total miles.
- **A week: a game month.** Own the first truck and end the lessor's cut. Buy the second, hire a driver, take on
  the dispatcher at the third. Each step costs more than the last and a lost contract, a season or a review can
  take it back.

Today the dispatcher plays the sitting from minute one and the walkthrough ticks its own boxes: four strangers,
no load won by hand. A game that plays itself is slop.

## The first ten minutes
Target: a stranger on a phone wins a load inside five minutes, understands why it paid what it paid. The UX spec owns the screens; the bible owns the order:

A name; a home hub as three choices. The map at your hub, your truck on it. The board: loads out of your hub
only, nearest first, the profit on every card, the loads a newcomer can't take dimmed and saying why. One bid,
and a mark where it was made. The truck rolling. The pay line in the open: rate × miles, less fuel, less the
lessor's 15%, less the deposit, equals yours. Then "the next round is at 18:00; set your dispatcher before you
go". Five tabs in the first hour: Fleet, Loads, Money, Company, Iuliia; the rest appear the day they matter.
The walkthrough ticks only on the player's own acts and says one Do at a time. The token is nowhere in the
first hour: Money shows cash, what's owed and when, costs, and Miles as "your standing".

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
direct freight, scale discounts. The token: the exchange card, the auction, the bridge, the Logbook, the dollar
prices, the airdrop estimate, the launch counter (after counsel and the server). The Economy tab as a published
monthly report. Rates folded into the board. Crews, the Back Lot, Channel 19, bounties and heat (a later beta).

**Goes.** The 34-theme picker: one look. Both locked teaser tabs (below). The eight-rule dispatcher form on a
one-truck company's screen. Equipment Finance's deposit side: yield on idle FD is a wallet feature.

## Two positions the bible takes
**Locked teasers.** Jeff asked for locked tabs as teasers of the vision; the art director's guide says none. The
bible sides with the art director, for a game reason: a tab that does nothing when tapped is the feeling Jeff
called slop. The vision lives on the roadmap page, in one line from Iuliia the week before a layer opens,
and in the layer arriving on its day. The Back Lot stays out of the
chrome either way: crime is out of the player guide by studio rule.

**The dispatcher.** For a one-truck company the standing orders start empty: the truck waits at home until the
player books the first load by hand. The cost: an idle truck while a new player is away, on a lease charging
250 FD a week either way. A rule change (a config default the bots also read): if Jeff says yes,
the economy designer sizes it first.

## Open questions for Jeff (yes or no, in the order that unblocks the most)
1. Is the pitch above the game, and "one load closer to my own truck" the feeling you want?
2. Is the first ten minutes, built, the next sprint, before the server and the live restart?
3. Does the token leave the beta's screens until counsel and the server, Miles shown as standing?
4. Beta one with five tabs, the rest appearing the day they matter?
5. Do the locked teaser tabs go, the roadmap page and Iuliia carrying the vision instead?
6. For a one-truck company, does the dispatcher stay idle until the first hand-booked load? (A rule change.)
7. One look: does the theme picker go?
8. Are beta one's twenty to fifty people freight people from Trucking Terminal's list, not crypto?
