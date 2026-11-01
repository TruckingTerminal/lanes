# The first ten minutes (UX spec, draft 3, 2026-11-02; owner: UX)

Draft 3 applies Jeff's answers (`DECISIONS.md`, 2026-11-02). Quoted strings are the writer's placeholders
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
  to Truck's "Needs you"), "≡". Test build adds one speed button cycling "Paused · 1× · 10× · 30×".
- **"≡" menu:** "Title screen", "Full screen", "Report a bug or an idea".
- **Bottom nav, 56 px, fixed, four items, icon over label:** **Truck · Board · Money · More**. "Truck" reads
  "Trucks" from the second truck. A dot when something waits: Board, a bid result; Money, an invoice; Truck, an
  alert; More, a tab just opened or a new Iuliia step.
- **Sheet** over a full-screen map: strip (88 px: Iuliia's line or one state line, e.g. "Truck 1 · Waiting at
  Dallas · round 18:00"), half (50 %), full (to the top strip). Drag handle; a nav tap opens half, Board opens
  full; tapping the map drops it to strip.

**Laptop (≥ 900 px).** One 44 px top row (the strip's items, the four test-speed buttons). Map left; a 440 px
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
| Logbook | at the first delivery |
| Finance | at the second truck |
| Economy | on game day 7 |
| Business | its layer's day (`layerBlock`, day 28) |
| Back Lot | its layer (`layerBlock`); text unchanged |

**More, top to bottom:** Iuliia (the thirteen steps, her full text), Help (the Guide), Company, the opened
teasers, then "Coming soon".

**Cut from the chrome:** the theme picker (one theme, `cyber-ops`), the legend, both Expand buttons, the rack's
Report. Miles and "Beta · launch in 730d" move to Money's token group (S8).

**Iuliia** (both layouts): portrait 96 px (the `iuliia` loop at 0.75), one or two sentences at a time (the
writer cuts lines to 25 words), "Next", then the step's Do, "Hide". Top of the sheet on a phone; at strip height
her line is the strip. Never between a list's header and its first row.

### S0 Title (0:00–0:40)
The title loop; "Company name" (default "Lone Star Freight", 32 chars); three hub cards, Chicago, Dallas,
Phoenix (Memphis replaces one the economy designer finds fails the first board); **Start hauling**. Each card:
hub name, one freight line, one carriers line ("Dallas · freight even · a fair share of carriers"). The table,
its caption and the beta line go; "How you start" stays, test build only. The five connection cards stay,
reworded.

### S1 Arrival (0:40–1:30)
The map flies from the country to the home hub in 1.5 s (none under reduced motion), to a zoom where the hub
label, its roads and the cyan sprite labelled "You" read. AI carriers at 35 % opacity; players full. Sheet at
half: Iuliia, "This is Dallas, your home. Let's find a load.", **Show me the board** (ticks step 1).
States: map not drawn yet → the hub's painting with "Finding Dallas…" until the first frame.

### S2 Board (1:30–4:00)
Header: "Loads from Dallas · 14 · next round 18:00 (in 5 h)". A truck selector only from two trucks.
**Card** (88 px, the whole card a target):
- line 1: "Dallas, TX → Charlotte, NC · 1,085 mi"
- line 2: "2,010 FD · 1.85/mi · 0 mi empty"
- chip: green "+180 FD at book-now", or red "−245 FD at book-now" followed by grey "+338 FD at 2.39"
  (profit at the suggested bid, `suggest` in `Loads.tsx`).

Sort control, three segments: "Nearest" (default) · "Best pay" · "Deliver by". First visit only: loads with
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
"Standing" (loaded miles). Then two folds, closed by default: "Loans" (today's Equipment Finance card) and
"The token" (today's exchange, airdrop and auction cards, Miles, "Beta · launch in 730d", unchanged).

### S9 Before you go (9:00–10:00)
After the first bid by hand, Iuliia: "From now on your dispatcher bids when you don't. Check the rules before
you go." and **See the dispatcher** → Truck › Dispatcher: a switch "Bid for me while I'm away" (on), then three
rows: "Bid at break-even plus" [25] %, "Send the truck empty up to" [150] mi, "Bring me home after" [21] days,
**Save**. "More rules" folds the rest (floor, book-now, move idle trucks, contracts). The re-post row is hidden
until brokerage opens.

### Map, Truck, walkthrough
- **Map:** a hub tap opens a hub card in the sheet or panel (its loads, then its market), never a modal or a tab
  switch; a truck tap opens its Truck card.
- **Truck:** truck cards, "Needs you" (alerts, tenders, tired, idle), the yard, Dispatcher, "Today" (the last
  eight feed lines).
- **Walkthrough targets:** `miles` → Money's Standing; `law` → More › Company; `own`, `driver`, `yard` → the
  teasers they open; the rest unchanged. `TAB_NAME` takes the new labels.

## Questions (the producer routes them)
1. **Engineering:** can the client read a moving truck's overnight stop? If not, S6 ships without it.
2. **Director:** on a phone the teasers live in More, not the bottom bar. Putting them in the bar makes it a
   scrolling strip and the four stop being always in reach; I recommend against.
