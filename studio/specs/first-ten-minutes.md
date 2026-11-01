# The first ten minutes (UX spec, draft 1, 2026-11-02)

Played the public test page fifteen minutes as a stranger ("Kartli Freight", Dallas) at 375 px and 1366 px. No economy rule moves here; the one default that would is flagged at the end.

## Part one: the screens as they stand

**Shell, both layouts.** Top bar: logo, Menu, clock, Live/Test badge, four speed buttons, FD, Miles, "Beta · launch in 730d", alert badges, Theme picker (34 themes), Full screen. Map with −/+/Fit/Expand and a legend. Thirteen tabs, Report, Expand. The walkthrough card above every panel. A footer ticker; a toast, bottom right, 4.2 s.

| Tab (`TABS` key) | What it is | Who needs it: owner-operator / five / twenty | Noise in week one | At 375 px |
|---|---|---|---|---|
| Fleet (`fleet`) | Needs attention; tenders; tired and idle alerts; Orders on the way; a card per truck (status, crew, condition, odometer, trailer, twelve buttons from Find loads to Steal the load); The yard; Dispatcher (seven rules) | the truck card / alerts, orders / same | the yard, the dispatcher form, Send empty, Steal | card fits; form overflows |
| Loads (`loads`) | DAT-style search (six fields, a 61-market Destination among them); a ten-column table; a row opens Trip / Rate / Company with Book now and Counter | every session / every session / the dispatcher's | Age, Eq, Score, Company, cargo value, vetting, tolls, highway share, Season, "DH-O" | table scrolls sideways; detail stacks into 25 rows |
| Staff (`staff`) | You; Dispatch; Auto-staff; payroll; four hiring tables (drivers, dispatchers, managers, poaching) | nothing ("no open seat" on every row) / drivers, a dispatcher / all | all four tables | four sideways tables |
| Dealer (`market`) | Used listings; Lease another truck; the Showroom (used lot, nine new rigs, tractors and trailers alone, lease offers); three facilities | the used lot, about day 35 / trailers / facilities | 182k rigs beside 4,700 FD cash; "$ to the launch pool" | long, readable |
| Money (`money`) | Cash with sparkline; exchange, airdrop, auction; Equipment Finance | cash, what's owed / loans / all | auction, airdrop, deposits; the receivable the walkthrough points to is on Finance | fits |
| Finance (`finance`) | Stake; Getting paid (three terms); three pools; Credit | Getting paid / Stake, which caps trucks / all | pools, credit | fits |
| Business (`business`) | Yard and mods; shops, fuel stations, dealerships; truck-stop sites; resale | nothing / the yard / all | everything; ladder-locked live | fits |
| Logbook (`logbook`) | Airdrop milestones; the ladder; Channel 19 | nothing / nothing / crews | all; crime in the player's face | fits |
| Back Lot (`backlot`) | A locked teaser | nothing | the tab itself | – |
| Rates (`rates`) | Market table per equipment (seven columns, 61 rows); best lanes | day 3 on / the dispatcher lives here / same | Out/in, Reload, Theft | sideways |
| Economy (`economy`) | Faucets, sinks, supply, the market | the economy designer | all | fits |
| Company (`company`) | Stats; safety record and policy; contracts; home market; insurance; players; seasons; market report; biggest companies | day 35, the law step / insurance, contracts / all | policy, seasons, market report | fits |
| Guide (`guide`) | A fifty-page manual | when stuck | – | fits |

**Walkthrough** (`Walkthrough.tsx`, `walkthrough.ts`): thirteen steps, two paragraphs plus Do and Why each, done-ness read from the world. Steps 1 to 3 tick themselves: the default standing orders act before the player does.

**Styles** (`page.html`): 13 px body, a dense console; the phone sheet (≤760 px) stacks map over panel, wraps the top bar into five rows (about 300 of 812 px), shows three tabs in a sideways rack, and scrolls tables sideways.

**What I saw.**
1. A game day a minute and reposition after two idle rounds: within ninety seconds my only truck left Dallas empty, Loads said "No idle trucks right now", Iuliia said "pick a load leaving your hub". On day 2 the dispatcher booked SAT→AMA itself and the walkthrough ticked "You won one." Live, that order fires twelve real hours after joining.
2. Phone: the map is a 359 × 269 thumbnail under five hundred AI dots, my truck invisible. A hub tap zoomed the map; the city pane never opened in three tries on either layout.
3. Desktop, paused: the first load from home read "Not for you yet: authority under 30 days old", the second showed −286 FD at book-now. My counter at the suggested 2.37 lost to 2.03; the only notice was the ticker ("Lost DAL→BWI at 2.37/mi: it went for 2.03/mi") and the truck card's "sat out 2 rounds".
4. At 1366 px the tab labels truncate and the loads table overflows the panel sideways.
5. Every action gives a toast, sometimes a relabelled button; nothing acted on changes: no state on the row, the map or the tab.

## Part two: the proposal

Principles: one truck, one job, one screen at a time; the map is the board and the panel one card; no tab before it's useful; every order leaves a mark where it was given; the walkthrough ticks only on the player's own acts.

### Layout

**Phone (≤1100 px).** The map fills the screen behind a bottom sheet with three heights: strip (88 px, one line of state), half, full. Bottom nav, four items: **Truck · Board · Money · More**. Top strip, 44 px: clock, cash, one alert dot. Menu, Miles, the beta countdown, Theme, Full screen and Report go under More; speed buttons stay in the strip, test build only.

**Laptop (>1100 px).** Map left, a fixed 420 px panel right with the same four sections as a segmented control; More is a list, never a rack; anything wider than the panel stacks.

### Screen by screen

**S0 Title (0:00–0:40).** The art, the tagline, Company name, "Home: Dallas · Change", **Start hauling**. Change opens the hub list: Hub, Freight out, Carriers.

**S1 Arrival (0:40–1:30).** The map flies from the country to Dallas in 1.5 s, to a zoom where the hub, its roads and one cyan sprite labelled "You · Workhorse + dry van" read; AI dots dim, players bright. The sheet opens at half: Iuliia's caption (32 px portrait, three lines, the writer's words) and one button, **Show me the board**.

**S2 Board (1:30–4:00).** Sheet full. Header: "Loads from Dallas · 14 · next round 18:00 (in 5h)". A card per load, nearest first: "Dallas → Manassas, VA · 1,300 mi"; "2,386 FD · 1.84/mi"; a profit chip, red "−286 FD at this rate" or green "+403 FD at 2.37". Loads the company can't take sit dimmed at the end with one chip, "Needs 30-day authority". **Filter** holds destination, max empty miles and commodity; equipment is the truck's. Cut from the first view: every item in the table's noise column.

**S3 Load (4:00–5:30).** Full sheet; the map behind draws the lane and the empty leg to the pickup. Three groups: Route (pick up, deliver by, miles, driving hours), The money (book-now, your break-even, profit at book-now, "usually clears near"), Shipper (name, on-time). Two actions pinned at the bottom: **Counter [2.37] /mi · +403 FD** (a stepper, 0.05 a tap) and **Book now · 1.84 · −286 FD**.

**S4 Bid in (5:30).** No toast. The sheet drops to half; the load card stays pinned at its top in a new state, "Your bid · 2.37/mi · clears 18:00 · 5h", a ring that fills to the round, and **Withdraw**. The map draws the lane dashed. Board gets a nav dot; the strip reads "1 bid in".

**S5 The round (at 18:00 or on return).** The pinned card becomes a result. Won: "You won Dallas → Manassas at 2.37/mi · 3,081 FD"; the sprite rolls out of the hub; the strip says "1 truck rolling". Lost: "Lost to 2.03/mi. Three of fourteen cleared under your break-even today." with **Bid again**, which reopens the board with the likeliest wins first (usual clearing rate above break-even).

**S6 Rolling (6:00–8:00).** Truck tab, one card: sprite, "Dallas → Manassas · 1,300 mi · ETA Jan 7 07:24", a progress bar along the lane with fuel and rest stops as dots, "Tonight: truck stop near Little Rock". The map follows the truck.

**S7 Money (8:00–9:00).** Three lines: Cash, Owed to you (due day), This week's costs; a sparkline. Exchange, auction, finance and pools move to More › Finance.

**S8 What's next (9:00–10:00).** Iuliia: "Next: reload at Manassas. I'll show you when it lands." Board while the truck is busy: "Your truck is on the road · loads appear when it's free · ETA Jan 7". The dispatcher stays idle for a one-truck company until the player turns a rule on under More › Dispatcher.

### Map and panel

Phone: the map stays behind the sheet, a third of it visible at strip height, and every sheet state (a bid, a rolling truck) is drawn on it too. A hub tap opens the hub as a card in the sheet (board first, market second), never a modal. Laptop: the same card in the panel; the map never switches tabs by itself.

### Iuliia

A caption bar at the top of the sheet or panel: portrait, three lines, an arrow for the rest; never above the content, never ticked by the dispatcher's work. The thirteen steps keep their order; the writer cuts each to forty words and one Do.

### Feedback

| Action | Mark it leaves |
|---|---|
| Counter / Book now | the load card's pinned state; dashed lane on the map; nav dot; strip "1 bid in" |
| Round clears | result card; sprite moves; strip; log entry |
| Delivery | result card with the invoice and due day; Money gets a dot |
| Any live-world order | the card shows "sent · in effect at 18:00 (2h)" until the world confirms |
| A refusal | the reason in red on the control that refused, not a toast |

The toast stays only for the live connection ("Reconnecting…", "Back").

### Empty, loading, first time

Loading: the road strip with the percentage, plus "Finding Dallas…". Board with no loads: "Nothing from Dallas for a dry van this round · next round 18:00" and **Widen the search**. Driverless truck: "Needs a driver" and **Hire**. Money before the first delivery: "Nothing owed yet · your first invoice lands here". First time only: S1's flight, "Show me the board", and a footnote under S2's chips: "Break-even: what this truck must earn a mile to cover fuel, the lessor and wear."

### Keep, move, cut

Keep, renamed: Fleet → **Truck** (**Trucks** from the second), Loads → **Board**, Money. Under More: Company, Guide (as Help), Rates (as Markets, also from a hub card), Finance (into Money), Dealer (surfaces on Truck as "Buy your own truck" at step 9), Staff (surfaces at a driverless or second truck), Dispatcher (its own screen). Cut: Economy (a docs page), Logbook until the TGE, the Back Lot teaser (a roadmap page), the theme picker (one default; the rest under Settings), the legend, "Beta · launch in 730d", both Expand buttons, Steal the load, Send empty's hub select (becomes "Move the truck" on a hub card). Strings kept: every walkthrough Do, "Book now", "Counter", "Withdraw", the hub names. For the writer: "DH-O max", "sat out 2 rounds", "No idle trucks right now", "Not for you yet", "Your dispatcher is watching the board."

### The decision I need from the director

Whether a one-truck company starts with the dispatcher's standing orders off (`DEFAULT_ORDERS` applied from the second truck, or once the player has bid by hand). Without it the first bid, win and loss are the dispatcher's, and no first ten minutes can be the player's.
