# Replay of R2 and R5: captions that retire, Skip this step, and step moments (QA, 2026-11-03)

Checked against the director's R2 and R5 (`director-player1.md`), `specs/guidance.md`, `guidance-ux.md` (the step moments) and `guidance-strings.md` (`CAPTION.skip`). Engineering's commit is 0260aa7.

**Build:** "Deploy 0260aa7 from lanes" (Pages built; I checked that "Skip this step" is in the page).

**World played:** Scioto Freight, owner-operator on a leased dry van, Columbus.
- New from day 3 (Wed Jan 3 06:00) to Thu Jan 4 19:00.
- The clock was paused for the timing checks, then ran at Day a minute and Day in 6 s.
- Loads:
  - Columbus → Chicago, booked by hand.
  - Madison → Memphis, the dispatcher's.
  - Memphis → Little Rock, a hand bid, placed and not yet cleared.

Phone 375×812, built-in browser. The caption (`.iuliiasay`, `.sheetbody > .caption`) was polled every 100 ms; times are real seconds. Console: no errors.

Severity: **R** blocks the republish · **S** this sprint · **L** later. Screenshots are in `qa-replay-r2-r5/`.

## R2: lines that retire, and Skip

| Row | Result | Evidence | Sev |
|---|---|---|---|
| A Do line retires after five real minutes | **Pass** | Step 3's "Watch the ETA. Note where it sleeps tonight." came up at 356.1 s and left at 656.5 s, 300.4 s later. A visit to More › Iuliia and back in between didn't retire it ([03](qa-replay-r2-r5/03-do-line-retired-after-5-min.jpg)) | – |
| …or once you act on another screen | **Pass** | The arrival line left the moment I opened More (15 s). Step 4's Do line ("On Money, find the lessor's share and the hold…") came back on Truck at 787.9 s and left 0.6 s later, when I saved the dispatcher setting. That was an action on the same screen; it still counted | – |
| A line with a button holds until answered | **Pass** | What now?'s answer ("Bid on Sidney to Kendale Lakes… **Show the load** · **Not now**") came up at 20.7 s and was still there at 340 s, 319 s later, with the clock paused. It left only on **Not now** | – |
| The dispatcher's after-first caption retires for good once the dispatcher is off | **Not seen** | That line never reached the caption in this run, either after the first load or after the dispatcher booked Madison → Memphis. After the first delivery, "Bid for me while I'm away" was **on**, though I never turned it on; the feed says "your dispatcher's bid." I switched it off at Wed 20:00, and no dispatcher line appeared before or after | S |
| The Standing orders step completes when you bid by hand with the dispatcher off | **Pass** | After a hand bid from Memphis with the dispatcher off: "11 of 13: Standing orders ✓", while step 5 was still current | – |
| More › Iuliia has "Skip this step" | **Pass** | Under Go to / Back / Read ahead on the step card ([01](qa-replay-r2-r5/01-skipped-step-card.jpg)) | – |
| A skipped step reads "· skipped" | **Pass, then changes** | After Skip: "2 of 13: Reading the board · skipped". Once the world completed it (my first booking), it read "Reading the board ✓". R2 says "a skipped step stays in the list as skipped, not done". Whether doing it afterwards should count as done is the director's call | L |
| …never returns to the caption queue | **Pass** | After Not now, the caption fell back to the What now? chip alone, not step 2's Do line | – |
| …and is never What now?'s answer | **Pass** | What now? answered with a load to bid on, not "Bid on a load leaving Columbus" | – |
| The skipped step stays current until the world completes it | **Pass** | After the skip the Iuliia page still showed step 2 as current, with "1 of 13 done". Step 3 began only with the booking ("2 of 13 done") | – |
| The next step doesn't start early | **Pass** | With step 5 current, a first visit to More › Company didn't play The law (step 8) | – |

## R5: step moments on their event's screen

| Row | Result | Evidence | Sev |
|---|---|---|---|
| **The truck rolls** plays as a full line when the truck rolls | **Fail** | The truck went from "Loading at Columbus" to "Loaded Columbus → Chicago · 313 mi to go" at Wed 08:00 with me on the Truck tab. The panel's top was the fleet card, and the caption kept step 3's Do line with Hide / More. There was no full line ("You won one. Now the slow part…") and no Next or Skip ([02](qa-replay-r2-r5/02-truck-rolled-no-moment.jpg)). The step was marked ✓ later anyway | S |
| **Getting paid** on the first settlement card | **Pass** | At the Chicago delivery the settlement card carried "Getting paid" and both paragraphs ("Delivered, and paid the same day…"), with **Next** and **Skip this step**. The caption stood back to her face and **What now?** ([04](qa-replay-r2-r5/04-getting-paid-on-settlement-card.jpg), [05](qa-replay-r2-r5/05-getting-paid-next-skip.jpg)). It sits inside the settlement card, under the pay rows, not above them at the top of the panel | – |
| **The reload** at the top of the Truck tab's panel | **Pass** | When the truck went idle at Memphis, the panel opened with "The reload", her portrait, both paragraphs, **Next** and **Skip this step**. The caption showed only her face and the What now? chip ([06](qa-replay-r2-r5/06-reload-moment-top-of-truck.jpg)). The moment card repeats her portrait under the caption's, so two faces are stacked | L |
| **The law** | **Not reached** | Step 5 was current at the end. Her line correctly didn't play early on a first Company visit (above) | – |

## Also seen

- **L:** a fresh owner-operator's Iuliia page says "Next on the road: your next truck, 129 FD away" with 4,700 FD in cash, at Wed 06:00 day 3.
- After Next on Getting paid, the caption showed a card line, "Delivered. Read the pay line, not only the top number.", for 6 s before step 4's Do line.
