# The first ten minutes (UX spec, draft 4, 2026-11-02; owner: UX; S0, S1 and S9 amended by the director)

Draft 3 applied Jeff's answers (`DECISIONS.md`, 2026-11-02). Draft 4 applies his ruling on the first two screens
("the title screen is only a login screen with nice animations"; the hub is chosen inside the world, with the
map, the date and the freight in view, Iuliia guiding), the director's gate corrections and hub ruling, and the
economy's two approved proposals. Quoted strings are the writer's placeholders
(`specs/copy-audit.md` wins); `{}` numbers come from config; other figures are one example load.

## Part one: the screens as they stand

| Tab (`Tab` key) | Holds | Fate |
|---|---|---|
| Fleet (`fleet`) | alerts, tenders, truck cards, the yard, the dispatcher | **Truck** |
| Loads (`loads`) | six-field search, ten-column table, load detail | **Board** |
| Money (`money`) | cash, exchange, airdrop, auction, loans, deposits | **Money**, ledger first |
| Company (`company`) | stats, safety, contracts, insurance, players | More, open |
| Guide (`guide`) | fifty pages | More, open, as "Help" |
| Staff (`staff`) | four hiring tables | teaser |
| Dealer (`market`) | used lot, showroom, facilities | teaser |
| Rates (`rates`) | market table, 61 rows | teaser |
| Finance (`finance`) | stake, getting paid, pools, credit | teaser |
| Logbook (`logbook`) | Miles milestones, ladder, Channel 19 | teaser |
| Economy (`economy`) | faucets, sinks, supply | teaser |
| Business (`business`) | yard mods, shops, truck stops | teaser, layer day 28 |
| Back Lot (`backlot`) | a locked teaser | teaser, its layer |

What two strangers met there: `reviews/ux-first-look.md` and `playtests/2026-11-02-slop-audit.md`.

## Part two: the proposal

Principles: the tabs that matter first, the rest visible and saying when they open; every order leaves a mark
where it was given; the walkthrough ticks only on the player's own orders (it reads the act log, not the world).

### The rule this spec assumes
Approved by Jeff, sized by the economy designer: a one-truck company's standing orders are off until the player
places a bid by hand. Until then the truck waits at home, and its card says "Waiting at Dallas · the first load
is your call". After that bid, `DEFAULT_ORDERS` apply (S9).

### Layout

**Phone (< 900 px).**
- **Top strip, one row, 44 px, fixed:** clock ("Tue 06:00"), cash ("4,700 FD"), an alert dot with a count (taps
  to Truck's "Needs you"), "≡". Test build adds **the speed control: two buttons, never one that cycles** (the
  player's diary, 2026-11-02: a cycle reaches Paused only through the fastest speed, and three game days went by
  while they tried to stop):
  - **Pause/Play**, 44 × 44 px, an icon (❚❚ while running, ▶ while paused). One tap always stops or starts.
    Play resumes at the last speed chosen.
  - **The speed**, a button showing the current speed in short form ("Live", "1 d/min", "1 d/6 s", "1 d/2 s";
    the writer's words, at most 72 px). A tap opens a small menu of the four speeds, one 44 px row each, the
    current one marked; picking one sets the speed and closes the menu. While paused, picking a speed sets it and
    stays paused; Play starts it. No overshoot is possible: any speed is one pick away.
  - The welcome-back line on a phone says "Tap ▶ to run the clock", not "press 1–4".
- **"≡" menu:** "Title screen", "Full screen", "Report a bug or an idea".
- **Bottom nav, 56 px, fixed, four items, icon over label:** **Truck · Board · Money · More**. "Truck" reads
  "Trucks" from the second truck. A dot when something waits: Board, a bid result; Money, an invoice; Truck, an
  alert; More, a tab just opened or a new Iuliia step.
- **Sheet** over a full-screen map: strip (88 px: Iuliia's line or one state line, e.g. "Truck 1 · Waiting at
  Dallas · round 18:00"), half (50 %), full (to the top strip). Drag handle; a nav tap opens half, Board opens
  full; tapping the map drops it to strip.

**Laptop (≥ 900 px).** One 44 px top row (the strip's items; the test build's four speed buttons plus a
Pause/Play button, with Space for Pause/Play and 1–4 for the speeds). Map left; a 440 px
panel right. Its tab row: Truck, Board, Money, More (100 px each, never truncated); under it a 36 px "Soon" row
of the teaser tabs as 28 px icons with their name on hover and on focus. The footer ticker stays, laptop only.

**The teasers (Jeff, 2026-11-02).** Listed in More under "Coming soon" on both layouts (a phone's bar holds four
targets, not thirteen); the laptop also has the "Soon" row. Each row: icon, name, a lock, "Opens {trigger}".
A tap opens its card (today's `TeaserPanel`): two lines on what it is, "Opens {trigger}", **Tell us what you'd
want here**, "The road ahead". When the trigger fires, or a walkthrough step targeting it becomes current, the
row moves to More's open list with a "New" dot and the panel works.

| Teaser | Opens |
|---|---|
| Staff | at the second truck, or a truck without a driver |
| Dealer | when walkthrough step 9 (`own`) is current |
| Rates | at the first delivery |
| Logbook | at the token's launch |
| Finance | at the second truck |
| Economy | at the first Monthly Economic Report |
| Business | its layer's day (`layerBlock`, day 28) |
| Back Lot | its layer (`layerBlock`); text unchanged |

**More, top to bottom:** Iuliia (the thirteen steps, her full text), Help (the Guide), Company, the opened
teasers, then "Coming soon".

**Cut from the chrome:** the theme picker (one theme, `cyber-ops`), the legend, both Expand buttons, the rack's
Report. Miles and "Beta · launch in 730d" move to Money's token group (S8).

**Iuliia** (both layouts): portrait 96 px (the `iuliia` loop at 0.75), one or two sentences at a time (the
writer cuts lines to 25 words), "Next", then the step's Do, "Hide". Top of the sheet on a phone; at strip height
her line is the strip. Never between a list's header and its first row. **The first in-game screen opens with
the sheet's content scrolled to the top**, so her first line after **Start here** is the first thing the player
sees; the yard painting comes after her and the truck card. Her walkthrough opens from the caption's
"Step n of 13 ›" link, not from More (`specs/guidance-ux.md`, section 1).

### S0 Login (0:00–0:15)
The title loop and its two shots, full screen, and nothing a stranger has to read. Under the logo, one action:
- **Live build:** **Sign in**. Signed in with a company: **Continue · Red Dirt Freight**. Signed in without one:
  **Enter the world**. Connecting and failure show on the button itself ("Connecting…", "Can't reach the world ·
  Retry"), never as cards.
- **Test build:** **Continue · Brazos Hauling, day 18** when a saved world exists, and **New test world** (if it
  replaces a saved one, the button asks once: "This replaces Brazos Hauling"). A new test world shows "Starting
  the world…" over the loop while it runs its first two game days (below), then enters.
Nothing else: no company name, no hub, no "How you start", no table, no theme, no beta line. A small "≡" in the
corner holds "Report a bug or an idea" and "Full screen".

### S1 First entry: the world, before a home (0:15–2:00)
**The world opens on its third day.** Every new world runs two game days (four rounds) before anyone enters:
the live world by its epoch at the restart, a test world behind "Starting the world…". The first board is
then the day-3 board (economy review, `economy-first-board.md`). The date the player sees is the world's.

**What the player sees.** The whole country map, every truck moving at full opacity (the world is alive and
none of it is theirs yet). The top strip: the date and clock ("Wed Jan 3 · 08:14"), "Next round 18:00", "≡";
no cash, no alerts, no speed control until the company exists. No bottom nav yet. Three hubs on the map carry
a cyan ring and their label: Dallas, Los Angeles, Phoenix (Los Angeles pending the economy designer's check at
every age and its theft; if it fails, Chicago takes the place, its card carrying its season). Every other hub is
labelled and tappable.

**Iuliia guides it.** The sheet opens at half (laptop: the panel), her portrait at 96 px:
1. "Welcome. This is the market, live; nobody waits for us." **Next**
2. "Before you have a truck, you need a home. Three good ones are ringed. Tap one, or any city you like." The
   three starter cards sit under her line; **All hubs** opens the full list, sorted by the day's freight.

**The hub card** (sheet at full; tapping a hub on the map opens the same card). Every figure is one the engine
already reports, read for a dry van:
- **The hub:** name, one line of character (writer), and the season line (writer, from the "Seasons now" read
  for that origin: "Busy season out of Dallas" / "Freight is thin here this month").
- **Freight now** (the Rates table's row): "38 loads posted last round · 4.46/mi average"; "2.5 loads per
  truck · hot"; "Ships 1.1× what it receives"; "Reload: easy / fair / hard".
- **Who's here** (the home-market read): "Carriers based here: a fair share" (`crowdWord`); "Shippers hold 45%
  of van loads for locals first".
- **What it costs to live here** (the hub table): "Insurance ×1.20"; "Yard: 27 FD a week per truck past the
  first"; "Theft: 2.0× a quiet road" (only where above 1).
- **Outbound by trailer:** "Van even · Reefer even · Flatbed even".
- **See the board** opens S2's cards for that hub, read-only: rate, rate per mile, empty miles from the hub,
  "usually clears near"; no profit chip and no Book or Bid ("Start here to bid on these"). Back returns to the
  card.
- **Start here**, pinned at the bottom.

**Naming the company** (after **Start here**, same sheet): Iuliia, "Dallas. Good. Home is where this company
stays. What do we call it?"; a field "Company name" (default from the hub, the writer's list; 32 characters);
test build only, "How you start": owner-operator (the live world's start) or a small fleet; **Start at Dallas**.
Back returns to the hub card. Live: the button writes the company to the store and shows "Opening your
authority…" until the act is in effect (`LEAD_MIN`).

**The fly-to-home** runs once, on the company's creation, never on a later session (later sessions open on the
player's truck). The map flies from where the player left it to the home hub in 1.5 s (cut under reduced
motion), to a zoom where the hub label, its roads and the cyan sprite labelled "You" read. AI carriers drop to
35 % opacity; players full. The bottom nav and the cash appear. Sheet at half: Iuliia, "This is Dallas, your
home. One leased truck, a dry van, and you driving it. Let's find a load." and **Show me the board**.
States: map not drawn yet → the hub's painting with "Finding Dallas…" until the first frame.

### S2 Board (2:00–4:00)
Header: "Loads from Dallas · 14 · next round 18:00 (in 5 h)". A truck selector only from two trucks.
**Card** (88 px, the whole card a target):
- line 1: "Dallas, TX → Charlotte, NC · 1,085 mi"
- line 2: "2,010 FD · 1.85/mi · 0 mi empty"
- chip: green "+180 FD at book-now", or red "−245 FD at book-now" followed by grey "+338 FD at 2.39"
  (profit at the suggested bid, `suggest` in `Loads.tsx`).

Sort control, three segments: "Nearest" (default) · "Best pay" · "Hot markets" (the destination market's loads per truck, hottest first; "Deliver by" was cut 2026-11-04). First visit only: loads with
profit at book-now ≥ 0 first (the economy designer makes sure one exists most rounds). Loads the company can't
take go last, dimmed, one chip with the reason from `vettingBlock` ("Needs `{vetting.strict.minAuthorityDays}`-day
authority · day 1").
**Filter** opens: Destination (hub list, "Anywhere"), "Empty miles, max" (slider 0–`{MANUAL_BID_MAX_DEADHEAD_MI}`,
default 300), "Commodity or place". Footer link: "Rates by hub" (shown once Rates is open).
Laptop: the same cards, and a "Table" toggle for today's table.
States: truck busy → "Your truck is on the road · loads show when it's free · ETA Jan 7 02:36". Nothing within
range → "Nothing for a dry van within 300 mi of Dallas this round · next round 18:00" and **Widen the search**
(clears Destination and the query). A bid in → that card pinned first in its bid state (S4).

### S3 Load (4:00–5:30)
Full sheet (laptop: the panel), back arrow "Board". The map draws the empty leg dotted and the lane solid.
Three groups, label/value rows:
- **Route:** "Pick up" (Dallas, TX · now), "Deliver by" (Jan 7 02:36 · Charlotte, NC), "Miles" (1,085 loaded ·
  0 empty), "Driving" (19.6 h), "Reload at Charlotte" (fair · about 57 mi empty to the next load).
- **The money:** "Book now" (2,010 FD · 1.85/mi), "Your break-even" (2.08/mi), "Profit at book-now" (−245 FD),
  "Usually clears near" (2.10/mi), "Ceiling" (2.42/mi).
- **Shipper:** name, "On time" (—).

"More about this load" folds: commodity, cargo value, tolls, two-lane share, season, load number.
**Actions, pinned to the bottom:** **Book now · 1.85/mi · −245 FD**, and a bid control: "−" [2.39] "+" (0.05 a
tap, inside the bid range, shown "2.18–3.63") with **Bid · +338 FD**. Primary style: Book now when its profit is
≥ 0, else Bid; negative figures red.
States: blocked → both disabled, the reason in red above. Bid in → "Change bid" and **Withdraw**. Live, sent
→ "Sent · in effect 06:02" (`LEAD_MIN`, ~30 real seconds). Refused → the reason in red under it; no toast.

### S4 Booked or bid in (5:30)
**Book now:** the sheet drops to half with "Booked · Dallas → Charlotte · 2,010 FD" and goes to S6.
**Bid:** the sheet drops to half; the load card pinned at its top: "Your bid · 2.39/mi · clears 06:00 · in
10 h", a ring that fills to the round, **Withdraw**. The map draws the lane dashed; the strip reads "1 bid in ·
clears 06:00". Step 2 ticks here, and the dispatcher's rule switches on (S9).

### S5 The round (at the round, or on return)
The pinned card becomes the result until "OK" or the next bid; Board gets a dot.
- Won: "Won Dallas → Charlotte at 2.39/mi · 2,593 FD" → the sprite leaves the hub → S6.
- Lost: "Lost to 2.24/mi · your bid 2.39 · your break-even 2.08" and **Bid again** (the board sorted by profit
  at "Usually clears near").
Live, a round is up to three real hours away: the ten minutes' win is a profitable Book now; a bid's result
opens the next sitting.

### S6 Rolling (6:00–8:00)
Truck, one card: the rig, "Dallas → Charlotte · 1,085 mi", a progress bar, "ETA Jan 7 02:36", a chip "On time"
or "Late 3 h". The map follows the truck until the player pans, then shows "Follow". Overnight stop: question 1.

### S7 Delivered (on return)
Result card on Truck; Money gets a dot. "Delivered Dallas to Charlotte", then the pay line, one row each: "The
load" 2,593 · "Fuel" −612 · "Tolls" −0 · "The lessor's `{npcLeaseShareOfGross}`" −389 · "Held toward your own
truck" −150 (when the deposit applies) · **"Yours" 1,442 FD** · "Paid" (due day).

### S8 Money (8:00–9:00)
A ledger, top to bottom: "Cash" with the sparkline; "Owed to you" (load, amount, due day; empty: "Nothing owed
yet · your first invoice lands here"); "This week's costs" (lease minimum, insurance, yard, per diem);
"Standing" (Miles: "272 Miles · your standing in the beta"). Then two folds, closed by default: "Loans" (today's Equipment Finance card) and
"The token" (today's exchange, airdrop and auction cards, "Beta · launch in 730d", unchanged).

### S9 Before you go (9:00–10:00)
**Before the first bid by hand** (a one-truck company only; a small fleet's dispatcher runs from the start):
Truck › Dispatcher shows the switch "Bid for me while I'm away", off and disabled, with one line from Iuliia
under it, "Your first load is your call. After that, your dispatcher can bid while you're away.", and nothing
else: the rows stay hidden. The truck card reads "Waiting at Dallas · the first load is your call"; the strip
"Truck 1 · Waiting at Dallas · round 18:00".

**After it:** Iuliia: "From now on your dispatcher bids when you don't. Check the rules before
you go." and **See the dispatcher** → Truck › Dispatcher: a switch "Bid for me while I'm away" (on), then three
rows: "Bid at break-even plus" [25] %, "Send the truck empty up to" [150] mi, "Bring me home after" [21] days,
**Save**. "More rules" folds the rest (floor, book-now, move idle trucks, contracts). The re-post row is hidden
until brokerage opens.

### The first load's lock (Jeff, 2026-11-04)
A real tutorial: before a company the sheet is the hub choice whatever is tapped (the hub card no longer opens
Intel), and from the company's creation until its first bid or booking by hand (or a load on a truck) only Truck
and Loads open. Money, More and the teaser row dim; a tap says "First, a load…". Iuliia's beats play in cards
over the screen they describe: three on Truck (home, the truck card, the dispatcher; "Show me the board"), five on
Loads (the cards, the chip, Book now and Bid, the sorts, a first load; "Got it"), then the board step's Do line.
Once the lock lifts she says what opened (`TUTORIAL.unlocked`). The rule is `apps/web/src/tutorial.ts`.

### Map, Truck, walkthrough
- **Map:** a hub tap opens a hub card in the sheet or panel (its loads, then its market), never a modal or a tab
  switch; a truck tap opens its Truck card.
- **Truck:** truck cards, "Needs you" (alerts, tenders, tired, idle), the yard, Dispatcher, "Today" (the last
  eight feed lines).
- **Walkthrough, first steps:** still thirteen. Step 1 becomes "Choose your home" (the Do: "Pick a home hub
  and name your company"); it ticks on the company's creation, the player's own act. The old step 1's lines
  (the leased truck, the lessor's share) move to the arrival line above. "Show me the board" is a button, not a
  step. Step 2 ticks on the first bid or booking, as before; the rest are unchanged.
- **Walkthrough targets:** `miles` → Money's Standing; `law` → More › Company; `own`, `driver`, `yard` → the
  teasers they open; the rest unchanged. `TAB_NAME` takes the new labels.

## Questions (the producer routes them)
1. **Engineering:** can the client read a moving truck's overnight stop? If not, S6 ships without it.
2. **Director:** on a phone the teasers live in More, not the bottom bar. Putting them in the bar makes it a
   scrolling strip and the four stop being always in reach; I recommend against.
3. **Engineering:** the company does not exist during S1, so the client needs a world view with no company (the
   map, the clock, the Rates and hub reads, a read-only board). Say if any read needs a company.

## For the writer: strings that change in draft 4
- **S0, new:** "Sign in", "Enter the world", "Continue · {company}", "Connecting…", "Can't reach the world ·
  Retry", "New test world", "This replaces {company}", "Starting the world…".
- **S0, gone:** "Company name" and its default, the hub cards and table, the beta line, "Start hauling",
  "How you start" (moves to S1, test build only).
- **S1, new:** Iuliia's two welcome lines; "All hubs"; the hub card's labels ("Freight now", "Who's here",
  "What it costs to live here", "Outbound by trailer", "See the board", "Start here to bid on these", "Start
  here"); the season lines per hub; one line of character per hub; the naming line ("Home is where this company
  stays. What do we call it?"); a default company name per hub; "Start at {hub}"; "Opening your authority…";
  the arrival line (now carrying the leased truck and the lessor).
- **Walkthrough:** step 1's title and Do ("Choose your home"); the old step 1's text cut into the arrival line.
- **S9, new:** "Your first load is your call. After that, your dispatcher can bid while you're away."; "Waiting
  at {hub} · the first load is your call".
- **Money:** "272 Miles · your standing in the beta" in Standing.
- **Hubs:** Dallas, Los Angeles, Phoenix (Chicago if Los Angeles fails its check). Iuliia names Russian things,
  never Russian words.

