# LANES design bible (draft 1, 2026-11-02; the director proposes, Jeff decides through the producer)

Grounded in the README, TOKENOMICS, TODO, the decisions log, and ten minutes on the test page as a stranger
(Red Dirt Freight, Dallas, ruleset 0.19.1).

## The pitch, in one breath
You start with one leased truck and a load board in an America that never pauses, and you build it into the one
big company everyone else is trying to build too. The market is the game; the token keeps score. Jeff's words:
"complete supply control"; "difficult, expensive and risky to grow"; "one large company, not many smaller ones".

The feeling at the end of a good session: I made a call, it paid, and I'm one load closer to my own truck.

## Who it's for
Freight people first: dispatchers and brokers who read a load board for a living, owner-operators, Trucking
Terminal's own users. The trucking-sim crowd second. Crypto last, as a reward for a game people already play.
Beta one is twenty to fifty people, so every screen gets one test: does a dispatcher in Tbilisi, on a phone,
understand it without the guide.

## Pillars (three, no more)
1. **The market is real.** Rates, hubs, docks, hours, seasons and roads behave the way they do out there. Test: a
   dispatcher finds something true on every screen and nothing false.
2. **One world, permanent.** The clock never stops, every order stands, everyone sees the same thing. Test: nothing
   a player does can be undone, and nothing the game does happens to one player only.
3. **Growth is earned and risky.** Every truck, driver and business is a bet with a downside; scale pays, splitting
   doesn't. Test: the second truck is harder than the first, and one company of fifty beats five of ten.

What serves none of these is cut.

## The core loop (what a session of play is)
- **A sitting: five minutes, a few times a day.** Open the page. See what happened since: what delivered, what it
  paid, where the truck sleeps tonight. Make one decision: book or counter the next load, send the truck somewhere
  better, or set the dispatcher for the hours you'll be away. Close. Bids clear every three real hours; the game
  must be worth a glance that often and never demand more.
- **A day: four game days.** One or two deliveries. Pay lands. The on-time record moves. A pull-in, a breakdown
  or a dead market says no. The number is always loaded miles against total miles.
- **A week: a game month.** Own the first truck and end the lessor's cut. Buy the second and hire a driver. Take
  on the dispatcher at the third. Each step costs more than the last, and a lost contract, a season or a review
  can take it back. Then the ladder: a business at day 28, a licence at day 91.

What the test page does today: the dispatcher plays the sitting for you from minute one. My truck left Dallas
empty before I had read the board, and the walkthrough marked four of thirteen steps done that I never did. A
game that plays itself is slop.

## The first ten minutes
Target: a stranger on a phone wins a load inside five minutes, understands why it paid what it paid,
and knows what to do next.

Proposal, screens in order: a name; a home hub as three choices with one line each (the ten-row table waits for
the Company tab); the map with your truck at your hub; the board with loads out of your hub only, nearest first,
"Book now" on each; the truck rolling on the map; the pay line in the open: rate × miles, less fuel, less the
lessor's 15%, less the deposit held back, equals yours (today revenue says 6,691, cash falls 91, nothing says
why); then "the next round is at 18:00; set your dispatcher before you go". Five tabs in the first hour: Fleet,
Loads, Money, Company, Iuliia. Everything else appears the day it matters. The token is nowhere in the first
hour: Money shows cash, costs and Miles as "your standing".

## What the game is not
Not a dashboard. Not a wallet with a game attached. Not a crime sim with trucks in it. Not a wiki (a tab of
forty-eight guide pages is one). Not an idle game: nothing happens to your company that you didn't set up.

## The cut list
**Beta one: serves a pillar now, player-facing.** The board with counters and book-now. Standing orders, but only
after the first load is booked by hand. HOS, docks, appointments, commodities and towns. Roads, tolls, terrain,
weather, parking and where the truck sleeps. Costs, wear, breakdowns, rebuilds, insurance, yard rent. Seasons,
headhaul and reload odds, the freight cycle (felt, never explained). Local-first shippers and contracts, shown at
the first offer. The used lot, the lease deposit toward the first truck, purchase loans. Drivers, fatigue, home
time. The staff ladder where it bites. The safety record, inspections, reviews, crashes, shutdowns. Liquidation
with no free restart. NPC theft in the corridors. Miles as standing. The Report button and the walkthrough.

**Waits for a layer: built, hidden until its day.** Facilities, businesses, truck stops, dealerships (day 28).
Brokerage: licence, bond, surety, re-posting (day 91). Managers, the CEO, sales and security roles, direct
freight, scale discounts. The token: the exchange card, the opening auction, the bridge and its
queue, the Logbook and its shop, the dollar window, the airdrop estimate, the "launch in 7,260" counter (after
counsel and the server: a page with no accounts can't keep a promise or take a dollar). The Economy page as the
Monthly Economic Report, published, not a tab. The Rates view folded into the board. Crews, the Back Lot,
Channel 19, bounties and heat (a later beta).

**Goes.** The 34-theme picker: the game has one look. The Back Lot teaser tab: crime stays out of the player's
face until it is a layer. Equipment Finance's deposit side: yield on idle FD is a wallet feature; loans come from
the NPC lender. The dispatcher's re-post row on a day-one owner-operator's screen. The buyback-auction and
dealer-cap-growth modes (dead config).

## Open questions for Jeff (yes or no, in the order that unblocks the most)
1. Is the pitch above the game, in your words or close enough to edit?
2. Does the token leave the beta's screens entirely until counsel and the server, Miles shown only as standing?
3. May the dispatcher stay off until a player books the first load by hand, and the first truck wait at home
   instead of leaving empty? (A rule change.)
4. Beta one with five tabs, the rest appearing the day they matter?
5. Are beta one's twenty to fifty people freight people from Trucking Terminal's list, not crypto?
6. One look: does the theme picker go?
7. Does the Back Lot teaser tab leave the beta, the layer staying on the roadmap page?
8. Is "I made a call, it paid, and I'm one load closer to my own truck" the feeling you want at the end of a
   session?
