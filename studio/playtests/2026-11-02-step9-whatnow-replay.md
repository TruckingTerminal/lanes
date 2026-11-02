# Step 9 and What now? replay (2026-11-02)

Build: "Deploy bb8e161" (Pages built). Phone 375×812, built-in browser. One new owner-operator world, Chicago. Hand bids, then the dispatcher at Day in 2 s to step 9 (Thu 15:00, about day 36), then a week on at Day in 6 s. Console: no errors.

Severity: **R** blocks the next republish · **S** this sprint · **L** later.

## 1. Step 9 with a lessor company

| Check | Result | Evidence | Sev |
|---|---|---|---|
| Do line, caption, More › Iuliia and What now? read one line from the Dealer's figures | **Pass** | All four read: "A new rig on a loan needs 42,077 FD now; you have 18,223 FD. The used lot restocks Feb 13. A few more loads close it." The Dealer agreed: used lot empty; the new Workhorse + Dry van's sheet "Cash needed now 42.1k FD" | – |
| A blocked listing never counts | **Pass** | A carrier's Workhorse + Dry van at 24.2k, "NPC-leased truck is on a trip", was not named. (It was also more than my cash) | – |
| The line follows the Dealer as figures move | **Pass** | Every cash change rewrote it (18,223 → 18,190 → 18,158 → 18,622 → 25,497). When the factory ran out of Workhorses ("The factory has none left this month" on every Workhorse row), it moved to the cheapest rig still available: "needs 53,858 FD now … The used lot restocks Feb 20". That matched the Highway Pro + Dry van sheet's "Cash needed now 53.8k FD" | – |
| The line changes when a route opens | **Not reached** | Over seven game days, cash never caught up (best 25.5k against 42.1k, then 53.8k), and the only listing was blocked by the trip | – |
| "A few more loads close it" | **Fail, wording** | Said against a 23.9k gap, and later 28.4k, with the truck clearing about 3–7k a delivery when it cleared anything. That's several weeks of loads, not a few. The restock date also slid from Feb 13 to Feb 20 without the lot restocking, so a player who waits for Feb 13 is let down | L |

## 2. What now?

| Check | Result | Evidence | Sev |
|---|---|---|---|
| The chip under the caption on every screen | **Pass** | Present on Truck, Loads, Money and More from the arrival onward; not before a company exists (no caption then) | – |
| One action, one reason with this company's figures, one button, Not now | **Pass** | At the start: "Bid on Cedar Rapids to El Paso." / "Truck 1 is idle at Chicago. This load pays about 5,135 FD over break-even." / **Show the load** / **Not now** | – |
| The button does what it says | **Pass, but the load can't be taken** | **Show the load** opened that load's sheet, with "Profit at book-now +5,135 FD", matching the reason. But **Book now** and **Bid** both refused: "More than 300 miles empty to the pickup". The sheet said "1,502 loaded · 247 empty". The guide's first suggestion is a load the player can't take, and the refusal contradicts the sheet's own empty miles | **R** (the first tap a new player makes) |
| The amber dot when something outranks the step | **Pass** | Dot on at the arrival (a paying load outranked step 2); off at step 9, when the step was the top action | – |
| "That's changed. Ask me again." | **Pass** | With the What now? panel open, I bid on Chicago → Mansfield; the panel became "That's changed. Ask me again." **What now?** Asking again gave "Step 3 of 13 · Watch the ETA. Note where it sleeps tonight." with **Go to Truck**. That came before the round cleared, though: there was no truck rolling and no ETA yet (**L**) | – |

## 3. The Dealer's reason lines

**Pass.** Under the loan sheet: "A loan needs 42.1k FD now: down payment, stake and tax. You have 18.2k FD." Cash alone, matching "Cash needed now 42.1k FD". Under each new rig: "You have 18.2k FD. It costs 194.2k FD with tax."

**L, wording:** "It costs … with tax" has the deposit netted in silently. "Workhorse tractor alone · 151.0K" then reads "It costs 145.7k FD with tax", below its own price.

**World played:** Lakefront Hauling (owner-operator, Chicago). New from day 3 (Wed Jan 3) through about day 42, in one page load with no reload. The page held the world in memory, so a save swapped by another tab wouldn't have reached this run. If UX's Harbor Gate save overwrote `lanes.testworld.v1` meanwhile, only a later "Continue" would load the wrong world.
