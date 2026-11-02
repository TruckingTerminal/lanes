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

---

# Part two: player brokers after day 91 (Jeff's question)

New test world, small fleet, Chicago (ringed), laptop 1366×800. I hired a driver for truck 2 and ran the clock at Day in 2 s to about day 98 (early April), then at Day in 6 s and Day a minute while I walked the path. Cash ran down to −35.5k around day 35, back to 38k by day 49 as the net-30 invoices came in, then 215.8k at day 98 and 250k at the end.

## Answer for Jeff

**Partly.** After day 91 a player can re-post a load they have won to other carriers: the dispatcher rule appears and a per-load button appears. Nothing else in the broker path exists in the client:
- no brokerage tab or teaser
- no licence
- no 75,000 FD stake
- no surety premium
- no way to take NPC shipper loads as a broker
- no sign of a carrier winning your post
- no carrier payment
- no margin line

The process today is: win a load as a carrier → before pickup, press **Re-post the load (won at X)** on the truck card → "Load re-posted. The truck is free where it stands." After that, the trail is one unlabelled "#38263" row in Owed to you. I couldn't find what the carrier was paid or what the margin was.

## Findings

| # | Screen | Did | Saw | Expected (the Help page, a stranger) | Sev |
|---|---|---|---|---|---|
| B1 | More / Soon row, days 0–98 | Looked for a brokerage tab or teaser | None. The teasers are Staff, Dealer, Rates, Logbook, Finance, Economy, Business, Back Lot. The word "broker" appears in no tab's UI, only in Help and Finance's pool text | Help: "Re-brokering opens on day 91 (3 real weeks): a licence, a bond, and the right to post loads". A layer this size needs its teaser like Business | B |
| B2 | Finance, after day 91 | Looked for a licence, its 75,000 FD stake and a surety premium | Only the carrier's truck stake ("Staked FD is the bond behind your licence… 10 trucks at 20.0k"). The surety pool is a deposit to earn premiums, not a bond to buy | A licence step with its stake and premium before you may post | B |
| B3 | Truck, dispatcher More rules | Day 98: ticked "Re-post some won loads to other carriers before pickup", set 100 % keeping 15 %, Save → "Dispatcher saved." Saved in the act log as `rebroker share 1 keepPct 0.15` | The next four won loads were hauled by my own trucks; per-load re-post buttons kept appearing. Four "#…" rows later turned up in Owed to you, so some may have been re-posted silently. Not provable from the screen | Each re-post says so in the feed | S |
| B4 | Truck card | Pressed **Re-post the load (won at 6.94)** | Toast "Load re-posted. The truck is free where it stands". Nothing in Today or the feed names the load, the carrier who took it, the rate paid, or the margin | "Re-posted {lane} at {rate}; {carrier} took it at {rate}; your margin {fd}" | S |
| B5 | Money › Owed to you | Read after re-posting | Rows "#35852 2,536 · May 13", "#36035 809", "#37877 2,859", "#38263 5,049". Load numbers where every other row has a lane; no mark that these are brokered | Lane names; a "brokered" tag; an "Owed by you" line for the carrier | S |
| B6 | Card label "Pay the hauler" | Read | A ticked checkbox beside the re-post button and in the rules. Its meaning is never explained (pay the carrier when the shipper doesn't?) | A sentence | L |
| B7 | Default / double-brokering | Looked for a way to post a load twice or post one I didn't hold | The button vanishes after one press; there's no posting form, so double-brokering can't be attempted from the client. A shipper default (Help: "about 2% of loads") never showed in my feed, so I can't say what a broker sees | – | not testable |
| B8 | Money › Getting paid (now shown) | Read | "Quick pay pays today for 10% off. Factoring is a 1-year contract with a 30.0k FD stake…" | Jeff, 2026-11-02: a factoring contract of three game months, 6 % at one truck down to 2.5 % at fifty, no pools. The client still shows the old rule | S |
| B9 | Feed, owned trucks | Deliveries | "…FD yours after fuel, tolls and the lessor's cut" on every delivery of an owned truck; the delivered card correctly has no lessor row | No lessor on owned trucks | S |
| B10 | Arrival, small fleet | Started | "This is Chicago, your home. One leased Workhorse, a dry van, and you driving. The lessor keeps 15%…" to a two-truck owned fleet | The small fleet's own line | S |
| B11 | Idle alert | Truck 1 idle 3 days at Chicago | "1 dry van load in range pay enough, but the dispatcher's bids keep losing" ("pay" for one load), repeated every few hours in the ticker | Grammar; fewer repeats | L |
| B12 | Strip date | Running the clock | The strip shows only "Sat 07:00"; you can't tell day 91 from day 21 without opening Money's "Cash, last N days" or reading due dates | The date somewhere one tap away | L |
| B13 | Week one cash | No action of mine | −35.5k by day 35, past "4 weekly checks in a row" territory, recovered only because invoices came due. Owed to you now lists each load with its due day, so this is legible. Good | – | – |

Console in this world: no errors (hooked `error` and `unhandledrejection`, and `read_console_messages` for the page).

---

# Re-check: 0e1fca1 on the test page (phone, 375×812)

Deployed with run 41374982184 (3cea47a, after 0e1fca1). New test world, owner-operator, Chicago (ringed). One hand bid on Chicago, IL → Greenwood, IN, 199 mi; the round run at Day a minute; then the delivery. Console: no errors.

| Row | Check | Result |
|---|---|---|
| 1 (blocker) | Iuliia's portrait after the first bid | **Pass.** Now a canvas, fully drawn. It changed frame within 3 s (two distinct frames in six samples) and shows on screen beside "From now on your dispatcher bids…" |
| 2 (blocker) | Arrival sheet where Start lands you | **Pass.** Start at Chicago lands on the sheet with "This is Chicago, your home. One leased Workhorse… Let's find one." and **Show me the board**, above the Truck card ("Waiting at Chicago · the first load is your call") |
| 3 | Place names | **Fail.** The strip and Truck card now use the load's places ("Loaded Chicago → Greenwood", "Unloading at Greenwood"). But the result card says "Won Chicago → Indianapolis at 3.86/mi · 768 FD", and the feed and delivered card say "Won / Delivered Chicago to Indianapolis". The next load reads "Greenwood → White Oak" on the card but "Won Indianapolis to Cincinnati" in the feed |
| 5 | Clock until the first bid | **Fail.** A new world still starts at Day a minute: 08:00 → 11:00 in 6 s with no company action. With a load open on the board, the 18:00 round cleared and closed the panel (Wed 15:00 → 19:00, panel gone) |
| 18 | One ETA | **Fail.** The board's busy line said "ETA Jan 7 21:37" for the 199-mi load won Thu Jan 4 06:00; the truck was unloading at Greenwood by Thu 12:00. The board shows the deliver-by, not the ETA. (Also: the next card read "ETA Jan 4 21:26 · On time" at Thu 22:00, an ETA already past) |
| 20 | Owner-operator's pay row | **Pass.** "Your pay for driving −152" on the phone. Rows sum: 768 −147 −0 −152 −46 −115 −230 = 78 = "Yours 78 FD" |
| 22 | Cash sparkline | **Pass.** A line under "Cash · 4,746 FD · Cash, last 2 days" |

Tester's note: with the browser pane hidden the page's timers stall (it sat on "Starting the world…" until a screenshot woke it). That's the test harness, not the build.

---

# Re-check 2: fcf46be on the test page (phone, 375×812)

New test world, owner-operator, Chicago (ringed). A hand bid on Chicago, IL → Macomb, IL, which was lost. The dispatcher then ran the truck. Day in 2 s to the first-truck step. Console: no errors.

| Item | Result |
|---|---|
| Row 3, place names | **Pass.** The board and the lost card read "Lost Chicago to Macomb at 5.29/mi: it went for 3.29/mi" / "Lost to 3.29/mi · your bid 5.29 · your break-even 2.36". The strip says "Loaded Chicago → St. Petersburg", the feed "Won Chicago to St. Petersburg", the Truck card "Chicago → St. Petersburg · 1,220 mi". Later: "Delivered Pittsburgh to Indianapolis", "Delivered Indianapolis to Chicago". No hub swaps seen. (I didn't win by hand this time, so the Won result card was checked through the feed only) |
| Row 5, clock until the first bid | **Pass.** After Start at Chicago the clock opens at **Live pace** (a game day every 6 real hours) and stood at Wed 06:00 for 5 s. It runs only if the player picks a faster speed (Day a minute: 06:00 → 08:00 in 5 s) |
| Row 18, one ETA | **Pass.** Loads "Your truck is on the road · loads show when it's free · ETA Jan 5 06:29"; Truck card "ETA Jan 5 06:29" |
| Red badge in the strip | **Pass.** A button "Needs you: 1. Open it". Tapped from Money, it opened Loads with the item on screen: the lost-bid card and **Bid again** |
| Iuliia's arrival line retires | **Pass.** It was shown on landing and gone from Truck right after the first bid (the brief said "once you've booked"; it retires on the first bid as well) |
| City names at Fit | **Pass.** At Fit only the three ringed hubs are named (Chicago, Columbus, Newark), small, under bold cyan rings; the whole country fits the phone now |
| Finance without the pools | **Pass.** It opened with Dealer when step 9 became current (Read ahead to step 9 doesn't open it; reaching it for real does). Shows Stake and Credit only; no insurance, factoring or surety pool. Note: there's no Getting paid section either, so Iuliia's step-9 talk of quick pay and factoring has nowhere to point yet |
| Back Lot card | **Pass.** "A later beta: player against player. Crews for hire, a gate and cameras for your yard, and a meter for how much attention you draw. / Someone will want your cargo one day; someone else's may tempt you. Lock the gate either way." with **Tell us what you'd want here** |
| Your truck as a semi | **Pass.** At 4× the "You" sprite is a white tractor-trailer in its ring |
| Reefer / flatbed vs van on the map | **Fail (partly).** Other carriers are still small squares at 4× and 8× (white, blue, orange), so trailer type reads only by colour, at 3–4 px. My own truck was a van all session, so I couldn't see a reefer or flatbed semi sprite |

Still open, not on this list: the idle alert again blamed losing bids ("156 dry van loads in range pay enough, but the dispatcher's bids keep losing") while the strip said "Home time at Chicago" and the feed "You're home for 5 days off". **S**.
