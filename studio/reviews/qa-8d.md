# QA: batch 8d replay on the test page (2026-11-13)

Build `{"build":"bda1380"}`, ruleset `lanes-live-1/0.24.1-phase0.42`. Browser pane, desktop width. No repo edits, nothing
staged.

**Worlds used** (saves in `qa-8d-2026-11-13/`):
- **"Scioto 8d":** World C cut back to Jan 12, with truck 2 listed, its driver let go and the truck taken off sale.
  That left it parked with no driver, 8b's fail-1 setup. The full World C is backed up as `worldC-before-8d.json`.
- **World A:** the 8b save where the lender took the truck. It was replayed in full (May 6) for the month bridge, then
  cut back to Jan 13, when the truck was running empty to St. Louis, for the turn list.
- **World D, "QA Eightdee Haul":** a fresh owner-operator in Newark, played from the title screen to about Apr 3 for the
  first hour. Saved as `worldD-newark-fresh.json`.

## Fails
**None.** Both 8b fails are fixed, and every smaller item passes.

## 1. The two 8b fails
| Item | Result | What I saw |
|---|---|---|
| **Hire for a parked truck, from What now?** | **PASS** | What now?: "Hire a driver for Truck 2. Truck 2 is parked at Columbus with no driver, so it earns nothing." HIRE A DRIVER opened Staff. The confirm read "Hire Tariq Hart? … Truck 2 goes back on the road with them." The save logged `unpark_truck`, then `offer_staff`, in that order. Truck 2 now reads "Idle at Columbus · next round 18:00 · Driver: Tariq Hart". |
| **Dispatcher Save leaves offers off** | **PASS** | Scioto 8d: the switch-on wrote contracts `acceptOffers: false`, and the box showed unticked. Save with nothing changed wrote the identical orders. Ticking the box and saving wrote `true`; unticking and saving wrote `false` again. World D repeated it with the same result. |

## 2. The smaller items
| Item | Result | What I saw |
|---|---|---|
| **Month bridge, the lender's surplus** | **PASS** (one nit) | World A's April bridge now reads "Trucks and items sold +10,113 FD" instead of "Loans taken", with "Taken by the lender: 1 truck, closing a loan that owed 29,490 FD." under it. **Nit:** "sold" for a truck the lender took. The line under it explains, but a lender's surplus row would read straighter. |
| **"Not yet": none under four weeks** | **PASS** | World D, which started Jan 11. Through about 3.6 weeks the card read only cash: "Not yet: buy once you have 69,500 FD in cash." The counts first appeared at 4.9 weeks (Feb 14): "about 36 loads away … around two months". |
| **"Not yet": steady** | **PASS** within a price; the verdict still swings with the market (new finding 1) | From day 67 to day 79, the per-load figure held at 770–780 FD and the loads count fell steadily (74, 66, 65, 63) as the cheapest sound truck eased from 56.5k to 48.5k. The jumps come from the price: 22 to 74 loads between days 54 and 57, when a cheaper truck left the market. |
| **The turn list skips the hub the truck runs to** | **PASS** | World A on Jan 13, "Running empty to St. Louis · 265 mi". The list has thirteen hubs (Louisville … Cleveland) and no St. Louis. |
| **Bid chip with an empty or non-rate field** | **PASS** | Empty field: the chip reads "Bid" and is disabled. "abc": "Bid", disabled; on leaving the field, "That isn't a rate: type the FD a mile you'd haul it for, like 2.45." The field's label is "Your bid, FD a mile". Typing 4.90 into an empty field and pressing the chip placed the bid in one press. The thin-lane line reads as specified (new finding 3). |
| **Confirm before letting a driver go** | **PASS** | "Let go Tariq Hart? It costs · 0 FD. Tariq Hart leaves your company today, and their truck stands empty. The one risk: Taking them back means hiring them again, at whatever they ask then." Choices: NOT NOW and LET TARIQ HART GO. NOT NOW kept him. |
| **Staff card's loads count** | **PASS** | "Dispatching ★★☆☆☆ · 0 loads dispatched by your rules · you can run 2 trucks". |
| **Intel's truck count** | **PASS** | "#554 · Scioto 8d … Columbus · 2 trucks". |

## 3. A first hour as a stranger (World D, Newark, owner-operator)
Nothing blocks a first player. The path runs cleanly:
1. **The opening:** the welcome, then the hub choice. The three starter cities each have a line and their January
   freight.
2. **Newark's page:** its freight, costs and security, with START HERE.
3. **Name and start:** the name and look, then Owner-operator.
4. **The walkthrough's three truck steps,** then SHOW ME THE BOARD.
5. **The board's five steps.** The fifth ends "take your time, but not all of it."
6. **Booking:** I booked New York City to Pittsburgh with Book now ("Booked. The truck is on its way.").
7. **The truck rolls,** then the dispatcher step.
8. **The dispatcher:** ticking "Bid for me while I'm away" saved bid, floor and home time, with contracts and no offers.
   Iuliia: "From now on your dispatcher bids when you don't. Check the rules before you go."
9. **Delivered and paid on delivery:** "Yours 678 FD · includes your 304 FD draw".

From there the dispatcher won loads on its own through March, and sent the driver home at its 21 days.

**What a stranger would trip on.** All four are old and still there:
- **Newark or New York City.** Iuliia says "This is Newark, and this is home", and the walkthrough says '"Waiting at
  Newark" means no load'. The truck card says "Waiting at New York City", and the board says "Loads from New York City".
  First noted in the 11-09 gamer playtest.
- **"You won one."** Iuliia says it after a Book now; the player won nothing. From the 11-09 cautious playtest.
- **What now? step 3 asks to check something that isn't so.** It says "Check the dispatcher is on in Standing orders on
  the Truck tab, then watch a round clear". The walkthrough had just said the dispatcher was "Off, for now", and it was
  off until I ticked it (walkthrough.ts l.115).
- **The clock changes speed by itself.** Booking the first load moved it from LIVE PACE to DAY A MINUTE without a tap.
  Fine on the test page if intended (11-09 playtest).

## 4. The director's rules C, H and I stay hidden
**PASS.**
- **H:** World D's owner, home on days off ("Home time at Southington: 5 days off left"), booked New York City to
  Kissimmee by hand.
  - The booking went straight through: no "You'll go back out…" confirm, and no "is home until" line.
  - The page text never held "go back out", "days at home", "is home until", "past due home" or "days-away count".
- **C:** no "past due home" line anywhere.
- **I:** Scioto 8d's parked truck stayed parked, untouched, until I hired for it.

## New findings, ranked
1. **The first-truck verdict swings with the listings.**
   - **What World D's card read, over about five game days with cash flat near 16–18k:**
     - day 79: "about 63 loads away … around four months";
     - day 86: "A sound first truck. Buy it now." Why: a used Highway Pro dry van in Los Angeles at 38,063 FD, "it takes
       0 FD in cash today";
     - day 92: "about 41 loads away … around three months".
   - **Why:** each change is the market, as engineering says: a cheaper truck listed, then left. But a player reads a
     plan, then "Buy it now", then a plan again.
   - **A thought for the director:** while a "Buy it now" listing stands, hold it on the card ("this one is gone if
     someone else buys it"). Or say when the verdict changed because a listing came or went.
2. **The bid sheet's thin-lane line still sits under a "Usually clears near" figure.**
   - **What it shows:** on New York City to Pittsburgh, "Usually clears near 3.85/mi", then, under the chip, "Too few
     loads like this have cleared on this lane to say where it clears; Book now is the sure price."
   - **Why it reads wrong:** engineering's note says that figure is the market's, not the lane's. Unlabeled, it reads as
     the lane's, so the line still looks like it denies the figure above it.
   - **A fix:** "Similar loads clear near …", or "(market)" after the figure.
3. **Stale lines after an action** (Scioto 8d).
   - **After the hire:** the "Today" feed kept "Truck 2 has no driver and earns nothing".
   - **After the dispatcher went on:** the bottom ticker still scrolled "The dispatcher is off, so nobody bids for this
     truck while you're away."
   - **Effect:** both are a day's feed, but they now contradict the cards above them.
4. **The bid chip shows the last figure entered, not what's being typed.** With 6.20 typed over 6.15, the chip still
   read "Bid · +623" (6.15's profit) until the field was left. Pressing the chip uses the typed figure, so this is
   display only.
5. **The company-name field.**
   - **What happens:** it comes pre-filled with a suggestion ("Meadowlands Transport"). A click puts the cursor at the
     end, so typing appends: I got "Meadowlands TransportQA Eightdee", cut at 32 characters.
   - **A fix:** select the suggestion when the field is focused, or show it as a placeholder.
6. **Home time began about 100 mi out, at Southington, not at Newark,** and the card showed "5 d out" during it.
   - **Likely fine:** it's probably the home radius ruling.
   - **Needs a line:** say so on the card ("near home") so it doesn't read as the wrong city.
7. **Money after the seizure** (World A). "Getting paid: On delivery, by the lessor ›" still shows for a company with no
   lease and no truck, above net-30 invoices.
8. **The turn list isn't sorted by distance.** World A: Louisville 223, Knoxville 239, Birmingham 246, then Memphis 205.
   It may be sorted by a score; if so, it doesn't say which.

## Not checked
- **Rule I with the switch on:** that's for tests; the page has no switch.
- **The 2-day dispatcher caption.**
- **Phone width.**

## State left
- **The slot:** World C ("Scioto Freight Lines", Columbus fleet, about Apr 5, as left after 8b) is restored to it.
- **The page:** on the title screen, not continued, so the clock isn't running.
- **The saves:** Scioto 8d is not kept; worlds A, C and D are in the folders.
