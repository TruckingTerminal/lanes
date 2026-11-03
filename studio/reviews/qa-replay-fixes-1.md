# Replay of engineering's fixes for my two reports (QA, 2026-11-03)

The commit under test is d9a92c1, "Engineering: QA's hold-batch fixes…", checked against my `qa-replay-player1-row1.md` and `qa-replay-brokerage-hold.md`.

Phone 375×812, built-in browser. Console: no errors in either part.

Severity: **R** blocks the republish · **S** this sprint · **L** later. Screenshots are in `qa-replay-fixes-1/`.

## Part 1: the test page

**Build:** "Deploy c2a134f from lanes" (contains d9a92c1).

**World played:** Buckeye Haul (owner-operator, leased, Columbus), new from day 3, at Sun Jan 7 00:00. It's the same world as the rows 2 and 4 replay.

| Row | Result | Evidence | Sev |
|---|---|---|---|
| The Explain sheet capped at 60% | **Pass** | 483 px (59%) on "Held toward your truck"; 487 px (60%) with What now?'s answer showing. Bottom edge on the nav at 756 ([01](qa-replay-fixes-1/01-sheet-60pct-x-on-label-line.jpg)) | – |
| What now? answers inside the foot; the sheet stays open | **Pass** | The answer sits just above the pinned foot: "Bid on Blacksburg to Doral. Truck 1 is idle at Raleigh. This load pays about 5,853 FD over break-even." **Show the load**. The sheet stays open ([02](qa-replay-fixes-1/02-what-now-in-foot.jpg)). It answers about the company, not the tapped figure. UX's later 349f02c asks for the figure first, and that isn't in this build | – |
| The header doesn't wrap; the × stays on the label's line | **Pass** | Two long labels ("Held toward your truck · 2,381 FD in all", "your next truck, 5,103 FD away"). The label wraps inside its column (x 86–309), and the × stays at the top right (x 315, y 288–337) ([03](qa-replay-fixes-1/03-gap-sheet-header.jpg)) | – |
| A mouse drag on the header closes it | **Pass** | Both a drag on the header and a drag on the grab bar close it. The page stays in the game, on the same URL and clock, and `history.state` returns to null | – |
| The gap shows its reason when the cheapest truck changes | **Pass** | It jumped from 1,424 to 5,103 FD. Underneath: "The cheapest truck changed: listings come and go, and the used lot sells out and restocks." ([04](qa-replay-fixes-1/04-gap-reason-under-figure.jpg)) | – |
| …and clears once the explanation is opened | **Pass** | After the sheet was opened and closed, only the figure remained. The sheet itself repeats the reason | – |
| …when the first week closes | **Not seen** | The run ended at Sun 00:00, and the only reason shown was the truck change | – |

## Part 2: a flagged build of d9a92c1

**Build:** by `roles/qa-flagged-build.md`, from `git archive d9a92c1` in my scratchpad, with `@lanes/*` linked to that copy's own packages. Brokerage switch on, 150,000 FD granted, served on 5199, now stopped. No shared file written.

**Worlds played:**
- Ridgeline Freight (small fleet, Columbus), new from day 3 to Sat Jan 6 06:00.
- Bayou Line (small fleet, Houston, dispatcher off), new from day 3 to Wed 18:00. I started this one because Columbus' trucks were never in reach of the Texas tenders.

| Row | Result | Evidence | Sev |
|---|---|---|---|
| **S1** The header and state line count tendered, posted and moving loads, not offers | **Pass** | With 20 offers and nothing posted: "0 loads posted", "0 loads · 0 FD margin". Later "13 loads posted" against "20 loads", and "11 loads posted" against "19 loads · 47 FD margin". With one tendered: "0 loads posted" and "1 loads". "1 loads" should be singular | L |
| **S2** Tender to {carrier} greyed, with the reason | **Pass** | All 20 disabled, each with "Ridgeline Freight has no free truck in reach of the pickup." ([08](qa-replay-fixes-1/08-tender-greyed-reason.jpg)) Right in each case I checked: Columbus → Oklahoma City was a flatbed with only a van and a reefer at Columbus; St. Louis → Boston was 414 mi off; later both trucks were loaded. In Houston, exactly one of 20 was enabled (League City → Asheville, van). The reason doesn't say when the trailer type is the cause | L |
| **S3** A load tendered to your own carrier gets its own card and never shows under On the board | **Pass** | A "Tendered to Bayou Line" group: "League City → Asheville · Tendered to Bayou Line · 2.42/mi · 06:00". On the board, Moving and Waiting for pay are empty ([11](qa-replay-fixes-1/11-tendered-card.jpg)) | – |
| The offered card says when the order would skip your carrier | **Pass** | With Offer first on: "If you don't decide: your standing order offers it to Ridgeline Freight first." Then "Ridgeline Freight has no free truck at the pickup now, so the order would post it." ([10](qa-replay-fixes-1/10-offered-skip-line.jpg)) | – |
| The if-you-don't line, the writer's wording | **Pass** | "…posts it at a 5% margin." with the full stop | – |
| The switch on one line, with its rate line under it | **Pass** | "Offer to Ridgeline Freight first" with the checkbox on the same row. Under it: "It tenders at your posting rate, held inside the lane's band; Ridgeline Freight still accepts or declines." ([09](qa-replay-fixes-1/09-offer-first-switch.jpg)) | – |
| "Standing order saved" after Save | **Fail** | Tried three times, in two worlds: changing the cap (20 → 60, 60 → 59) and flipping the switch. I watched the page's text for 2.5–3 s after each Save, and no "saved" text appeared. The values did stick. The string is in this build's bundle | S |
| The start sheet full on a phone | **Pass** | The sheet runs from 44 to 756 px (the strip to the nav), and the map is hidden. Her caption stays at the top of it ([05](qa-replay-fixes-1/05-start-sheet-full.jpg)) | – |
| The amount "90,300" | **Pass** | Reads "90,300" (numeric keypad) ([06](qa-replay-fixes-1/06-start-amount-licence.jpg)) | – |
| A licence row | **Pass** | "Licence · 300 FD · paid from this", between the fee and the cash-after rows. The possessive reads "Ridgeline Freight Logistics' cash after" | – |
| The empty chip icon (one more try) | **Not reproduced** | The chip showed its icon the moment the brokerage started, before any round ([07](qa-replay-fixes-1/07-chip-icon.png)). Last time it was an empty amber ring until the 18:00 round. That was on a cold local server, and the icon is an image file (`assets/icons/switch16.png`), so it was probably still loading. The icon is two arrows (a switch); spec §1 asks for the company's kind, a handshake for the brokerage | L |

Not re-tested, as asked: S4's engine half, the on-time ring, the tender's earnings and board-fee rows, the carrier side of the offer-first line, and the lower panel going full under a sheet.

## Also seen

- **L:** on Ridgeline's Truck tab, "Today" kept "Truck 2 has no driver and earns nothing." after Truck 2 had a driver (Sharon Hart) and a load.
- On a small fleet the dispatcher is on from the start and booked both trucks before the first round. That's why Columbus' tenders were all greyed.
