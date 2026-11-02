# Director's gate: sprint 1, the first ten minutes (2026-11-02)

Read against BIBLE.md draft 3, the spec's draft 4 and Jeff's decisions, on QA's replay (f65cc95), re-check 1
(0e1fca1) and re-check 2 (fcf46be), all in `playtests/2026-11-02-sprint1-replay.md`.

## Verdict: sprint 1 passes

**The first ten minutes meet the bible.** A stranger on a phone signs in to a title with one button. They meet a
world on its third day before they own anything, and choose a home from cards that read in words. Their truck
waits at home: "the first load is your call". They bid by hand, see the bid pinned with its ring and the hour it
clears, and read a result that names their bid, the winning rate and their break-even. On delivery they get a pay
line whose rows sum to what they keep. The clock opens at live pace, so nothing clears while they read. The
dispatcher, the token and the teasers are where the bible put them. The game waits for the player, which was
sprint 0's first complaint.

The republish is Jeff's call. Nothing in this gate blocks it.

## Passed (verified on the test page)

- Both blockers: Iuliia's portrait alive after the first bid, and the arrival sheet where Start lands you.
- The load's own place names everywhere, one ETA, the clock at live pace until the player speeds it.
- The red badge as a button that opens the waiting item, and the arrival line retiring after the first bid.
- City names only for the ringed hubs at Fit, with the whole country on a phone.
- Finance opening with the Dealer at step 9, without the pools.
- The owner-operator's pay row ("Your pay for driving"), and the cash sparkline.
- The Back Lot card with its action, and the player's truck as a tractor-trailer.

## Accepted as sprint 2 (carry-over; QA re-checks them in sprint 2's first replay)

Not verified since the first replay, or found after it:
- **Market truth (pillar 1), first in the carry-over:** "Usually clears near" printed above the ceiling, and a
  bid range past it (replay row 15). A dispatcher stops trusting a board that does this.
- **Getting paid has no section yet,** so Iuliia's step-9 talk of factoring and quick pay points at nothing.
  This is sprint 2's Finance item, and it closes that gap.
- The idle alert blames losing bids while the driver is on home time.
- The map's other carriers: trailer type reads only by colour at 3–4 px.
- No "Booked" line after Book now (row 4), the ticker's dispatcher line before a company exists (row 10), and the
  hub tap that zooms instead of opening its card (row 8).
- The dispatcher's first act is a late load (row 21), and the canvas guard for the zero-size draw.
- The rows marked L in the replay.

**One copy row for the writer:** the Back Lot card says "crews for hire" and "someone else's may tempt you". Jeff
wants player against player teased, and the studio keeps crime out of what a player reads before it is a layer.
Keep "player against player", the gate, the cameras and "lock the gate"; drop the hiring and the temptation.

## What sprint 1 proved about the studio

The review gate caught two specs before they were built, and the replay caught what the gate couldn't. The rule
to keep: no build reaches Jeff without a replay on a phone.
