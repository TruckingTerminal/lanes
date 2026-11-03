# Replay of engineering's cheap batch (QA, 2026-11-03)

Engineering's commit is c2046ec. Checked against my five fails, the R1 override, and the cheap list in `sprint3-order.md`. The strings come from `copy-player4.md`, `copy-player5.md` and `copy-player1.md`.

**Build:** "Deploy c2046ec from lanes" (Pages built, waited 60 s). One row used a flagged build of c2046ec by `roles/qa-flagged-build.md` (commit archive, brokerage on, port 5199, now stopped).

Phone 375×812, built-in browser. Console: no errors.

**Worlds played:**
- **Scioto Freight** (owner-operator, Columbus): continued at Thu Jan 4 19:00, for the title, the loading screen, the yard card and Money.
- **Harbor Run** (owner-operator, leased, Los Angeles): new from day 3 to Fri Jan 5 09:00, with the dispatcher switched off before the first load. Two loads: a hand bid that lost and a book-now delivered.
- **Olentangy Freight** (small fleet, Columbus, owned trucks): new from day 3 to Thu Jan 4 16:00, first delivery.
- **Ridgeline Freight / Logistics** (flagged, Columbus): day 3, the Carriers page.

Severity: **R** blocks the republish · **S** this sprint · **L** later. Screenshots are in `qa-replay-cheap-1/`.

## My five fails

| Row | Result | Evidence | Sev |
|---|---|---|---|
| The gap's explanation has "Less what's held toward your truck" | **Not reached** | In every world I played, the Iuliia page's "Next on the road" read "Businesses open Jan 29" instead of the next-truck gap. That includes Scioto (1,562 FD held) and Harbor Run (688 held). No other screen carried the gap figure, so I couldn't open its explanation. If the gap is meant to show for a leased owner-operator, it no longer does | S |
| The delivered feed line ends "yours after costs and the hold" / "after costs" | **Pass** | Leased: "Delivered Buena Park to San Leandro: 2,293 FD, 439 FD yours after costs and the hold. Paid today." Owned: "Delivered Lima to Overland Park: 3,659 FD, 2,190 FD yours after costs. Due Feb 4." | – |
| "Standing order saved." on the brokerage's Carriers page (flagged build) | **Pass** | It appeared within 2.5 s of Save after flipping Offer first. It's a toast and gone before a screenshot, so I watched the page's text for it | – |
| "The truck rolls" plays when you follow its Go to Truck | **Fail** | Step 3 current ("3 of 13: The truck rolls", **Go to Truck**). I followed Go to Truck twice: once while the truck was heading empty to its pickup, once while it was loaded and rolling (Wed 22:00). Both times Truck opened with only the caption's face and What now?, the fleet card, and no "The truck rolls" line, Next or Skip ([05](qa-replay-cheap-1/05-go-to-truck-no-moment.jpg)). The step was later marked done anyway, and step 4 became current with nothing played | S |
| "The law" plays on Company, or on Truck after the first inspection | **Not reached** | Step 4 was the furthest any world got. It correctly didn't play on Company while it wasn't current | – |

## R1: the dispatcher off before the first load

| Row | Result | Evidence | Sev |
|---|---|---|---|
| Switched off before the first load, it stays off | **Pass** | Off at Wed 06:00 ("Dispatcher saved."). Still off after the first delivery on Fri 09:00, and nothing was booked for me in between ([04](qa-replay-cheap-1/04-dispatcher-off-before-first-load.jpg)) | – |
| Switching it back on restores the bidding rules | **Pass** | I set 33% and 222 mi, saved, switched off and saved, then on and saved. Both values were still there (the rest: 21 days, 5, 20, 2) | – |

## The cheap list

| Row | Result | Evidence | Sev |
|---|---|---|---|
| Pay lines from the true terms: "Paid today." | **Pass** | On the leased truck's settlement card and in the feed | – |
| …"Due {date}." on an owned truck | **Pass** | "Due Feb 4." on Olentangy's card and in the feed ([08](qa-replay-cheap-1/08-owned-truck-due-date.jpg)) | – |
| …"Paid today, less x%." on quick pay | **Not reached** | No quick-pay invoice in these worlds | – |
| No lessor on an owned truck | **Pass** | Olentangy's card: load, fuel, tolls, pay, upkeep, **Yours 2,190 FD**, with no lessor row and no held row | – |
| "Fines and tickets paid" counting shoulder tickets | **Pass on the label; the count is not reached** | Company: "Fines and tickets paid · 0 FD". No ticket was issued in any world, so the count is unchecked | – |
| BID answers "Bid in: …" | **Pass** | "Bid in: 5.78/mi on Los Angeles to Madera. It clears at 18:00." The losing bid left no line saying it lost; that wasn't in this batch | – |
| BOOK NOW answers | **Pass** | "Booked. The truck is on its way." | – |
| The wall's reason on a load card, in the engine's order, one reason | **Pass** | One chip per walled card: "Strict vetting: 90 days' authority and 25 loads. You have 0 days, 0 loads.", "Needs 30-day authority: yours reaches it Feb 3.", "Local carriers first this round. Open to everyone from 18:00." ([03](qa-replay-cheap-1/03-load-card-wall-reason.jpg)) | – |
| Miles, cost and time on Send home | **Pass** | "Home · 377 mi empty · about 486 FD · 8 h" ([06](qa-replay-cheap-1/06-send-home-priced.jpg)) | – |
| …and on each Send empty destination | **Pass** | "To Las Vegas · 234 mi empty · about 302 FD · 5 h · 3 loads", "To Denver · 982 mi empty · about 1,267 FD · 2 days · 14 loads" | – |
| Send empty sends straight away | **Note** | The destinations are a picker with a SEND EMPTY button beside it. On Harbor Run's first screen, one tap on SEND EMPTY sent the truck to the preselected nearest place (Pomona, 40 mi) at once. The price shows only inside the picker | L |
| Security bands on the hub card | **Pass** | Los Angeles: "Security: high. Cargo goes missing here often; insurers and some shippers notice." Columbus: "Security: quiet" ([02](qa-replay-cheap-1/02-hub-card-security-high.jpg)) | – |
| No crime words on Rates, Business, Economy and the map | **Pass** | Rates has a Security column (Quiet · Watch · High) ([07](qa-replay-cheap-1/07-rates-security-column.jpg)). No stolen, theft, hijack, fraud or Channel 19 on Rates, Business, Economy or Company. Economy and Business are still teasers; the map labels show none | – |
| "Loading your world…" | **Pass** | It read "Loading your world…" with no detail line under it | – |
| The game date on Continue | **Pass** | "Continue · Scioto Freight · Thu Jan 4" and "Continue · Harbor Run · Fri Jan 5" ([01](qa-replay-cheap-1/01-continue-with-date.jpg)) | – |
| "Running · 1 leased, 0 owned" | **Pass** | Yard card: "Running · 1 leased, 0 owned · 0 trailers of your own" | – |
| Owed to you on a lease | **Pass** | "On a lease, the lessor pays on delivery. Invoices start with your own truck." | – |
| No "Read the month" | **Pass** | Not anywhere in the page's HTML | – |
| No NEW TEST WORLD on Company | **Pass** | Absent | – |
| "1 day", not "1 days" | **Pass** | "1 days" is nowhere in the page; the move rows say "1 h", "8 h", "2 days" | – |
| Commas in mile figures | **Pass** | "1,147 mi", "1,329 mi", "982 mi empty · about 1,267 FD" | – |
| A paused truck drawn as paused on the map | **Not judged** | I parked Olentangy's Truck 1 ("Parked at Overland Park"). The map stayed centred on Truck 2 near Atlanta, so I couldn't find Truck 1's marker at phone size | – |

## Also seen

- **L:** Olentangy's "Today" again showed "Truck 2 has no driver and earns nothing." after Truck 2 was hauling (Rising Sun → Clearwater).
- **L:** Harbor Run's first hand load was late 3 h after a breakdown ("Breakdown on truck 1 (lessor pays)"). The card says "Late 3 h" with no cause; that's row 12, not this batch.
- The hand bid that lost at 18:00 left no line about losing.
