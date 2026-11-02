# Sprint 1 replay: the first ten minutes (2026-11-02)

Build f65cc95, deployed (run 41371056404, success). Built-in browser, two new test worlds, owner-operator both times:
- **Phone, 375×812:** Dallas (a ringed hub). One hand bid, the round run at Day a minute, then the delivery.
- **Laptop, 1366×800:** Chicago (ringed in this world). Book now, then the delivery.

Checked against `specs/first-ten-minutes.md` draft 4, `specs/copy-first-ten-minutes.md` and `DECISIONS.md`. I clicked by script and by mouse and did not read the code.

Severity: **B** blocks the republish · **S** fix this sprint · **L** later.

## Verdict

Mostly yes: up to the first bid, the game now waits for the player. The title is one button. The world opens on day 3 with no company. Every starter card reads in words, not multipliers. Before the first bid, the truck sits at home and says "the first load is your call", and the dispatcher's switch is off and greyed. The board's cards, the load sheet, the pinned bid with its ring, the result line, the delivered card (whose rows sum to Yours) and the Money ledger all exist and mostly read well.

The gaps that still feel like slop:
- **Iuliia blank on the phone.** Her portrait goes blank at the moment that matters, because one pose file 404s.
- **Arrival line skipped.** It sits on the Truck tab, but Start drops the player on Loads.
- **The world runs from the start.** A new world starts at Day a minute, so the first round can clear while a stranger is still reading the load.
- **Places change names.** The load says Carrollton → El Dorado; the result says Dallas → Wichita.
- **The rings don't mean "best freight".** In both worlds every ringed city was "a little thin".
- **The dispatcher takes over at once.** It wins the next load before the delivered card is dismissed.

Fix the first two and the place names, and it's a game that waits.

## Mismatches and bugs

| # | Screen | Did | Saw | Spec says | Sev |
|---|---|---|---|---|---|
| 1 | Iuliia (phone, Loads after the first bid) | Placed a hand bid | Portrait box empty. `assets/people/iuliia-point.loop.png` → **404** (also `iuliia.loop.png`, `-talk`, `-idle` 404; `-wave` 200) | Portrait 96 px, alive | B |
| 2 | S1 → arrival | Start at Dallas / Chicago | Lands on Loads with step 2 text ("Bid on a load leaving Dallas"). The arrival line and Show me the board appear only on the Truck tab | Sheet at half with "This is {hub}, your home… Let's find one." · **Show me the board** | B |
| 3 | S5 result, S7, feed (both) | Won Carrollton, TX → El Dorado, KS. Booked Chicago, IL → Frankfort, IN | "Won Dallas → Wichita", "Delivered Dallas to Wichita", "Delivered Chicago to Indianapolis", "Idle at Frankfort". Hub names replace the load's cities | "Won {origin} → {dest}", the load's places | S |
| 4 | S4 Book now (laptop) | Book now · 5.23/mi | Panel jumps to Truck. Feed: "Won Chicago to Indianapolis, … your bid." No "Booked · … · 806 FD" line | "Booked · {origin} → {dest} · {total} FD", feed "Booked" | S |
| 5 | Clock (both) | New test world | Starts at 1× / Day a minute, running. On the phone the 18:00 round cleared while I read a load; the panel closed and the load vanished (repeats audit bug #11) | A game that waits; nothing says a new world starts running | S |
| 6 | S1 rings (both) | Read the starter cards | Phone: Dallas, LA, Phoenix; Dallas and Phoenix "A little thin", Dallas 23rd in All hubs (9 loads, 1.0 per truck). Laptop: Columbus, Chicago, LA, all three "A little thin". Unringed hubs read "Freight is good" | Rings = the best freight for a new carrier right now (Jeff, 2026-11-02) | S |
| 7 | S1 Iuliia 2 (phone world) | Next | "Three ringed cities take new carriers. Tap one to start, or any other to see its freight." The laptop world showed the copy's line. Two strings for one beat | "The rings mark where a new carrier finds freight right now…" | L |
| 8 | Map hub tap (laptop) | Tapped the Chicago ring at whole-map zoom | It zoomed to 3×, no card. A second tap at 3× opened the card. Phone: a Dallas tap at load-zoom opened the card first time | A hub tap opens its card | S |
| 9 | S1 laptop | Whole map at 1366 | Hub labels and cyan rings too small to read in the screenshot; grey bands above and below the map | Rings and labels read | S |
| 10 | S1 laptop footer | Before a company exists | Ticker: "Your dispatcher is watching the board. Bids clear at 06:00 and 18:00." | No company yet; before the first bid: "The first load is your call…" | S |
| 11 | S0 phone | ≡ on the title | Labelled "Full screen" and does full screen. No Report | ≡ holds Report and Full screen | L |
| 12 | S0 phone | Opened with an old-ruleset save in storage | No Continue, no "This replaces", and New test world overwrote it silently. On the laptop the prompt worked ("This replaces Trinity River Freight · Replace it · Keep it") | Ask once when replacing | L |
| 13 | S0 | Continue button | "Continue · Trinity River Freight, day 4"; the company's own vetting chip said "day 2" | One day count | L |
| 14 | S2 board (phone, Dallas) | First board | 11 of 18 cards blocked (authority, locals first). Header "Loads from Dallas · 9" over 18 cards | Blocked last, dimmed: works. The count reads wrong | L |
| 15 | S3 load | Read the money group | "Usually clears near 3.17" above "Ceiling 2.45" (Bolingbrook). Bid range runs past the ceiling (2.26–4.58 vs 3.05) | — | S |
| 16 | S3 load | Shipper group | Name blank on direct-shipper loads; only "On time —" | Shipper: name | L |
| 17 | S3 blocked load | Pressed + | Bid stayed 2.50; all buttons disabled. The reason line is there ("Not yet: Needs 30-day authority · day 2"). Fine | Both disabled, reason above | – |
| 18 | S2 truck busy (phone) | Board after the win | "ETA Jan 8 00:48"; the Truck card said "ETA Jan 4 14:58" for the same 375-mi load | One ETA | S |
| 19 | S7 delivered (both) | Read the rows | Phone: 1,340 −291 −10 −299 −91 −201 −402 = 46, shown "Yours 47" (rounding). Laptop: 806 … = 177, exact | Rows sum to Yours | L |
| 20 | S7 phone | Same card | Row "The driver's pay −299" for an owner-operator; the laptop card said "Your pay for driving". "Your pay" is then subtracted from "Yours", which reads oddly | `DELIVERED.driver`: "Your pay for driving (owner-operator)" | S |
| 21 | S9 after | Dismissed the delivered card | The dispatcher had already won Wichita → Lawton, "Late 5 h" on pickup | — (the rule works, but its first act is a late load) | S |
| 22 | S8 Money | Read | Ledger order right; "Owed to you" empty on a lease, correct string. **No cash sparkline** | "Cash" with the sparkline | S |
| 23 | More, teasers (phone) | Read Coming soon | Only Back Lot has **Tell us what you'd want here**; the other seven have only The road ahead | Every card has both | L |
| 24 | Finance teaser | Read | "Opens at your second truck" | Decision: Finance opens with Dealer at step 9 (and commit f65cc95 says "Finance opens with the first truck") | S |
| 25 | Map | After start | Hub labels carry bare numbers ("DALLAS 22", "CHICAGO 29", "HOUSTON 19"), unexplained. The zoom control shows "8×" where Fit was; "FIT" reads twice | — | L |
| 26 | Truck card | Owner-op | "The yard: Holds 5 tractors · 5 trailers · Now 0 tractors", **Buy a trailer**, **More yard space** on a leased one-truck company | Truck: cards, Needs you, yard, Dispatcher, Today | L |
| 27 | Find loads list | Truck card | "Pittsburgh · 358 mi · 1 loads" | — | L |
| 28 | Map phone | S1 | The map is cut at Kansas City; the east (Chicago, Atlanta, Newark, Miami) is off-screen until panned | The whole country | S |
| 29 | Speeds (phone) | Cycled | "Paused · 1× · 10× · 30×"; the meaning is in the tooltip only ("One game day every 6 seconds"), which a phone can't show | Labels as spec | L |

Working as spec:
- **S0:** one button, then "Starting the world…".
- **S1:** day 3 (Wed Jan 3) with no cash and no nav before the company; All hubs list; a non-starter card says "Seattle is a fine place to deliver to, not yet a place to live" and its read-only board works. Naming shows the default name (Trinity River Freight / Lakefront Hauling), "How you start" and **Start at {hub}**.
- **Fly-to:** to the hub with the "You" sprite.
- **S2 board:** sort (Nearest / Best pay / Deliver by), Filter and the laptop's Table toggle.
- **S3:** the load sheet's groups.
- **S4:** the pinned bid "Your bid · 3.57/mi · clears 06:00 · in 5h" with its ring and **Withdraw**; the strip "1 bid in · clears 06:00".
- **S6:** Follow after a pan; the night stop ("Tonight: a rest area near Oklahoma City (planned)").
- **S9 before the first bid:** the switch is off and disabled with Iuliia's line, and the card reads "Waiting at Chicago · the first load is your call". After the bid: the switch is on with 25 % / 150 mi / 21 days.
- **Speeds:** the laptop's labels (Paused · Live pace · Day a minute · Day in 6 s · Day in 2 s), and the teasers' "Opens …" dates.

## Console

- **Laptop world:** none.
- **Phone world:** the 404s above, plus `InvalidStateError: Failed to execute 'drawImage' on 'CanvasRenderingContext2D': The image argument is a canvas element with a width or height of 0.` about 300 times (at `hI` / `Y8`). Possibly set off by my viewport resize, during which the canvas briefly had zero size; it repeats, so worth a guard. **S**.

## Not covered

- Live build (Sign in), reduced motion.
- A lost bid.
- The small-fleet start in the new flow.
- The loads panel's sideways scroll at 1366 (the board had rows; I saw no horizontal scroll).
