# Replay of R4 and the two cheap-batch fixes (QA, 2026-11-03)

Engineering's commit is 7645a3f. Checked against the director's R4 (`director-player1.md`) and my `qa-replay-cheap-1.md` fails.

**Build:** "Deploy eb87d8b from lanes" (contains 7645a3f; Pages built, waited 60 s).

**Worlds played:**
- **Alum Creek Haul** (owner-operator, leased, Columbus): new from day 3 to Thu Jan 4 00:00, in a browser that had held about a dozen earlier worlds. That's the per-company walkthrough case.
- **Long Haul Test** (small fleet, Columbus): new from day 3, for the Dealer and Showroom. This is the world I'm keeping past day 30 for the R6 replay.

Phone 375×812, built-in browser. Console: no errors.

Severity: **R** blocks the republish · **S** this sprint · **L** later. Screenshots are in `qa-replay-r4/`.

## R4: no lit dollar button in the first month

| Row | Result | Evidence | Sev |
|---|---|---|---|
| No dollar button on Business, the Dealer or the Showroom | **Pass** | No button with a `$` and no `$` text on Business, the Dealer, Back Lot, Finance or Staff (owner-operator), or on the small fleet's Dealer and Showroom. Business is still the Jan 29 teaser, so its FD price on a lit button is not reached; I'll check it after it opens | – |
| FD is the button | **Pass** | Dealer and Showroom buttons are FD: "Buy today · 22.4k", "Workhorse + Dry van · 45.1k", "Order the rig · 182.0k", "Workhorse tractor alone · 140.0k" | – |
| The small yard's dollar purchase sits under Money's "The token (later)", closed by default | **Pass** | On the first visit to Money the section is a closed fold headed "The token (later)". Opened, it holds the FD exchange line, the explanation, Miles, the airdrop, "Opening auction…", **Small yard · $900** and **Bid in the opening auction** ([01](qa-replay-r4/01-token-fold-open.jpg)) | – |
| The dollar buttons inside the fold | **Note** | One tap on **Small yard · $900** did nothing: no card, no line, no navigation. R4's third point asks engineering whether these can take a card in this beta; if not, they are dead taps under Jeff's teaser rule. They're now out of the first month's sight, but still lit when the fold is open | L |

## The two cheap-batch fixes

| Row | Result | Evidence | Sev |
|---|---|---|---|
| "The truck rolls" plays as a full line when a booked load sends you to the Truck tab, in another world in the same browser | **Pass** | In Alum Creek Haul, Book now on Columbus → Brentwood switched to Truck. The panel opened with "The truck rolls", her portrait and both paragraphs ("You won one. Now the slow part…"), **Next** and **Skip this step**. The caption stood back to What now? ([02](qa-replay-r4/02-truck-rolls-after-book-now.jpg)) | – |
| The gap line when the gap is 0: "Nothing to close: you can afford your next truck now." | **Pass** | Before the first delivery: "your next truck, 782 FD away". After it (Thu 00:00, 5,343 FD, 715 held): "Next on the road: Nothing to close: you can afford your next truck now." | – |
| …with the explanation and its "Less what's held toward your truck" row | **Pass** | Tapping the line opens "Gap to the next truck": "Cash needed now, the cheapest route (a listing) 5,481 FD" · "Less what's held toward your truck −715 FD" · "Less your cash above 4 weeks of costs (0 FD kept for running costs) −5,343 FD" · **Gap to the next truck 0 FD** ([03](qa-replay-r4/03-gap-nothing-to-close-held-row.jpg)). With nothing held yet, before the delivery, the row isn't there | – |

## Business after it opens (Long Haul Test, Tue Feb 27, about day 58)

| Row | Result | Evidence | Sev |
|---|---|---|---|
| FD is the button on Business | **Pass** | "Small yard · 135.1k + 30.0k bond", "Large yard · 563.1k + 100.0k bond", "APU · 27.0k", "Aero kit · 18.0k", "Premium tires · 13.5k", "Sleeper upgrade · 22.5k" | – |
| Dollar buttons on Business | **Lit, past the first month** | 20 lit dollar buttons: "CHI · $2,703" … "ATL · $5,067" (dollar facilities by hub) and "Or $11,955 (to the launch pool; the bond in FD)" on each business row. The text says "Until launch, items can also be bought with dollars at 1.5× (up to $500)". This is day 58, so R4's first-month rule isn't broken here. But Business opens Jan 29, inside the first month (Jan 3 to Feb 2). I didn't see Business between Jan 29 and Feb 2, so I can't say whether these buttons are hidden then. "Up to $500" also sits beside buttons for $2,703 to $11,955 | S (to check) |

## Also seen

- The dispatcher's after-first caption now plays: "From now on your dispatcher bids when you don't. Check the rules before you go." **See the dispatcher**. My R2 replay couldn't find it.
- For an owner-operator, the Dealer is still a teaser: "Opens when Iuliia says so… I'll say when it's time to buy."
