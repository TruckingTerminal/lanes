# QA: client batch 8b on the test page (build fd68880, 2026-11-12/13)

## Setup
- **Build:** version.json read {"build":"fd68880"} at 18:05. Ruleset `lanes-live-1/0.24.1-phase0.42`. Built-in browser,
  1024×768.
- **World B** (the LA small fleet that held the slot) is backed up in `qa-8b-2026-11-13/worldB-before-8b.json`.
- **World A:** "QA Eightbee Haul", Columbus, owner-operator, seed 676681773.
  - Played Jan 11 to about May 6, in hand and with the dispatcher.
  - It was replaced in the slot, but its save is in `qa-8b-2026-11-13/worldA-lender-took-truck.json`. It ends with the
    lender taking the truck (new finding 1).
- **World C:** "Scioto Freight Lines", Columbus, small fleet. Played Jan 11 to about Apr 5. **It holds the slot now,**
  paused, with the dispatcher on.

## Fails, ranked

1. **Hiring for a parked truck is refused, and that is the path What now? sends the player down** (new; follows fail 3's
   fix).
   - **Setup** (World C, Jan 13): truck 2 listed; its driver let go; truck 2 taken off sale. It stands parked with no
     driver.
   - **What now?:** "Hire a driver for Truck 2. Truck 2 is parked at Columbus with no driver, so it earns nothing."
     with HIRE A DRIVER.
   - **Staff:** the hire list offers each candidate "Truck 2 · Reefer". The confirm says "Hire Tariq Hart?". The toast
     says "That truck isn't on the road", and no order is saved.
   - **The workaround:** press "Back on the road" on the truck card first (the truck goes idle, still driverless), then
     hire. That worked: unpark_truck, then offer_staff.
   - **Fix:** either the hire unparks a parked truck it seats someone in, or the list doesn't offer a parked truck's
     seat. In both cases What now?'s button should lead somewhere that works.

2. **The dispatcher panel's Save turns contract offers on without asking** (new; the switch-on of item 63 is right).
   - **Turning the dispatcher on** saved bid, floor, `contracts {acceptOffers: false}` and homeTime. Reposition and
     book-now are off, so item 63 passes.
   - **But the panel shows "Contracts: take offers from local shippers" ticked** (Dispatcher.tsx l.126:
     `defaultChecked={Boolean(ct)}`, true for any contracts order, accepted or not).
   - **Pressing SAVE with nothing changed** saved `contracts {acceptOffers: true}` (l.50–52). So any later edit to a bid
     % or home days quietly signs the player up for contract offers.
   - The tick should read `ct?.acceptOffers`.

## The three fails from 0.24.1: all fixed

1. **The brokerage funding field: PASS.**
   - Step 2 renders `<input type="text" inputmode="numeric" maxlength="16">`.
   - I typed in the real DOM:
     - "80,500" set the move to 80,500 FD, with the fee 2,415 and the carrier's cash after 36,341;
     - "abc" showed "Type an amount in FD, digits only." and shut Next;
     - "80000" opened Next again.
   - Step 1 says "Up to 32 characters. The name stays for the life of the brokerage" (item 34).
2. **Wording follows 0.24.1: PASS.**
   - **The lot rig's confirm** (World A, Mar 21): "It's an order: ready Mar 28, and handed over when leased truck 1 next
     stands idle. Your lease ends then."
   - **What now?, after the order:** "The leased truck earns until it goes back, so keep it booked. The swap comes the
     moment it's next idle."
   - **The walkthrough's step 10, "Your first truck":**
     - the lot rig is "ready 7 days after you order it, at 40% condition, so its repairs run well over a fresh truck's";
     - the loan line explains the lender's steps: 10% to 20% down under 3 years and 300,000 miles, 3% a year and 3% per
       100,000 miles past that, 10% more under a year's authority, never over 50%, and cash only past 10 years or
       700,000 miles;
     - "like new" and "Buy the used one first" are gone.
   - **The loan controls and toast** (QA smalls): "Order on a loan ›", "Order Workhorse + Dry van on a purchase loan",
     "Order on a loan · 6,843 FD now", and the toast "Ordered from the used lot. Ready in 7 days".
   - **The lot's line:** "They come at 40% condition" (item 12).
3. **Listing a truck and its driver: PASS** (World C, Jan 11).
   - **The sell sheet:** "Listing it takes Tariq Hart off the truck. Tariq Hart stays on your payroll, and quits after 2
     weeks with no truck unless you seat them on another. Taking it off sale puts Tariq Hart back in it."
   - **Off sale:** the toast "Off sale: Truck 2 is back on the road, with Tariq Hart driving". The saved orders are
     withdraw_listing, assign_driver, unpark_truck. The card shows him driving, idle at Columbus.
   - **What now? sees a parked truck with no driver:** "Truck 2 is parked at Columbus with no driver, so it earns
     nothing." But its button leads to fail 1 above.
   - **Not tried:** the seat-back button (a free driver beside the truck), the parked-crew line, and the reload case.
   - **Seen in passing:** with truck 2 listed and the driver free, the card offers "HIRE A DRIVER" under "Truck 2 has no
     driver and earns nothing". A hire can't seat in a listed truck. The Staff "You" card, item 27's "Paid with no
     truck: about 710 FD a week until a seat frees up", and the owner line all show.

## The smaller items

| Item | Result | What I saw |
|---|---|---|
| 4, the watching tab | **PASS** | A second tab's Continue gave a standing `.watchbar` under the top bar, "Your world is open in another tab; this one only watches.", for as long as it was open. Cash and clock matched the writer. |
| 5, home warning for an idle truck | **PASS** | World A, dispatcher off, idle at Atlantic Beach, 16 d out: "Truck 1: Due home Feb 1 (5 days). With your dispatcher off, only you can book it a load toward Columbus. Once it's due and idle, it heads home empty." It outranked the stranded line. |
| 8, the first empty turn priced from the truck | **PASS** | Running empty St. Louis → Chicago, the list quoted Indianapolis at 193 mi. After the turn the card read "Running empty to Indianapolis · 193 mi". |
| 9, home time near home | **not reached** | Both home times came at Columbus itself ("Home time at Columbus: 5 days off left"). |
| 10, days out after a visit home | **PASS** (as ruled) | Sent home back to work from Atlantic Beach, dispatcher off. The truck stood a day at Columbus, and the card dropped "d out". I didn't see the queued line `homeAfterWorkQueued` on screen; the Send-home-after-this-run press only toasted "Already heading home". |
| 12, the stale refusal line | **PASS** | 99999 gave "Above the ceiling: this shipper pays at most 3.56/mi". Typing 2.90 and Tab cleared it: "BID · +115, CASH 88" and the gamble line. "abc" gives "That isn't a rate: type the FD a mile you'd haul it for, like 2.45." (item 10). |
| 12, ETA running empty | **PASS** | Loads: "Your truck is on the road · loads show when it's free · ETA Jan 14 19:39". |
| 12, the dispatcher caption | **PASS** | "your dispatcher bids when you don't" was gone in World C after weeks of bidding. I didn't time the 2-day retirement. |

## The playtest round's fixes

| Item | Result | What I saw |
|---|---|---|
| Truck card's book value and what trucks like it sell for | **PASS** | Starter band (World A's lot rig): "owned · book value 43,847 FD Usually sells for about 39,500 within two weeks." Above it (World C): "owned · book value 94,752 FD Few buyers at this price. Fleets pay about 57k–76k for trucks like this, when one is buying; it can take weeks, or not sell." The book-value sheet itemizes new price, miles, age and wear. Nit: no separator between the two sentences. |
| Sell sheet: price path, idle fee, floor | **PASS** | "The price drops 5% a week, to 60% of today's book value (95,308 FD) in week 8. At 95,308 FD, if no one has bought, it comes off sale and is parked." Under the one risk: "A listed truck pays the idle fee, 20 FD a day, while it waits. Only carriers with the cash buy trucks this dear; there are few." The confirm names "truck 2". No loan line (no loan). |
| Take-off-sale control | **PASS** | On the listed card, twice. |
| Notice when a listing sells | **PASS** (no-loan case) | World C, about week 8: "Truck 2 sold on the used market for 95,294 FD; after the 4,765 FD market fee, 90,529 FD came to you." It sold at its floor. The loan-repaid case wasn't reached. |
| Month report bridge with unpaid invoices | **PASS** | World A, April: "Invoices not yet paid −18,139", "Earlier invoices paid this month +2,139", summing to "Cash at the close 8,662". But see new finding 3. |
| Broker's margin against the market before saving | **PASS**, with a doubt | Step 3 at 5%: "At 5%, carriers see 95% of the shipper's rate, about 2,000 FD a load. Brokers here take 6%–12%. … fall-off fee (79–879 FD on recent loads)." The warning: "At this margin your loads post near 4.11/mi, under the 4.20/mi loads like them clear at here: few carriers will take them." It is gone at 1% and 3%. See doubt 2. |
| Every broker's earnings on Intel | **PASS**, with a doubt | Before a close: "No month has closed yet: the ranking by month starts at the first close." After closes, each broker row reads "kept N FD last month". All 48 brokers with a figure were negative (see new finding 2). Nit: before any close every row reads "#1". |
| What now?'s cash forecast on a leased truck | **PASS** (under, not over) | World A, Worthington → Saginaw by hand: "77 over break-even, plus your 230 draw as the driver: 63 to cash now, 244 toward your truck." Paid: 511 yours, which is 151 without a 360 FD detention bonus. Forecast 307 against 395 paid (cash + held). The 88 FD gap is about the empty run out of Saginaw (Detroit, ~74 mi), as engineering describes. It never ran over the pay. |
| First-truck card names the lot's worn rig under "Why" | **PASS** | First line under Why: "A worn rig from the lot: 40% condition, ready in a week, about 20,200 FD in cash on a loan. Expect repairs near 2.4× a fresh truck's, about 6,500 FD a month." |

## The early-delivery fee: nothing shows: PASS
- No "Order early", "Expedite" or "early slot" text anywhere on the Dealer, in either world, with new rigs listed.
- Nothing showed on the card or in What now? while World A's lot rig was on order.

## Other 8b items seen in passing
- **13, the speed in force:** PASS. A steady "● LIVE PACE"; its title ends "(now)"; no animation.
- **9, a name of only spaces:** PASS. "Give your company a name: spaces alone aren't one."
- **63, Iuliia's offers:** PASS. After a second stranding: "Twice now a truck has stood where nothing pays. I can have
  the dispatcher move an idle truck toward freight after two rounds. Want that?" with TURN IT ON / NOT NOW.
- **The lender's notice (writer §1, the over case):** PASS. "The lender took Truck 1 after 2 missed payments. Its loan
  owed 29,490 FD and is closed. The truck was worth 10,113 FD more than the loan: that came back to you, and so did the
  loan's stake." This is 8a's B6, reached at last.

## New findings, ranked

1. **The first owned truck was taken by the lender about three weeks after the hand-over, in a company that was making
   money** (World A; save in the folder).
   - **What happened:**
     - The lot rig was ordered Mar 21 on a loan (6,843 FD now, 3,906 FD left, "1.4 weeks of cushion") and handed over
       about Mar 28.
     - From then on, pay came as net-30 invoices. April's 18,139 FD of deliveries were all still unpaid at the close.
     - Cash went 2,056 FD into the red. Two weekly payments of 383 FD were missed, and the lender took the truck about
       May 5.
     - Meanwhile the month "kept 7,708 FD", and four invoices of 1.5–1.9k each could have been cashed early.
   - **After it:**
     - The company has 13,016 FD and no truck: "0 leased, 0 owned".
     - What now? and the Dealer still say "To a sound first truck: 62,306 FD. Not yet: buy once you have 75,300 FD in
       cash, about 81 loads and 34 weeks from here". There are no loads to haul.
     - The Dealer, reached through GO TO DEALER (More no longer lists it), sells a 19.6k used rig today on a loan for
       9,185 FD now. Nothing points the player to it.
   - **For the director:**
     - the switch from paid-on-delivery to net-30 at the hand-over is a cash cliff the confirm's cushion line doesn't
       show;
     - What now? had no missed-payment warning that I saw (I ran at 2 s a day);
     - a truckless company needs a way-back answer.
2. **Every AI broker shows a loss on Intel.**
   - Sorted by last month, all 48 brokers with a closed month "kept" between −1,684 and −10,543 FD. None was positive,
     and the best ranked #495 of all companies.
   - Either the brokers do lose money each month, which is an economy question, or `monthKept` misreads a broker's
     books, perhaps without its margin income. Engineering or economy should look.
   - The Brokerage panel's "SEE WHAT BROKERS EARNED LAST MONTH" leads straight here.
3. **The month bridge labels the lender's surplus "Loans taken +10,113 FD".** That was the truck's value over the loan,
   paid back to the company when the lender took it, not a loan.
4. **What now? and the walkthrough's "Not yet" counts look off.** World A, Jan 13: "about 72 loads and 72 weeks from
   here", one load a week on a week's history. Later: "33 loads and 12 weeks", then "82 loads and 29 weeks". The sound
   truck's price also jumped from 21,855 to 55,793 FD in one step (Mar 21) while the target rose.
5. **The turn list includes the hub the truck is already heading for, at a different distance.** Running empty to
   Chicago with 181 mi left, the list offered "Chicago · 196 mi empty". The other rows kept their St. Louis order.
6. **The bid sheet's chip reads "BID · +0" while the field holds "abc" or is empty.** Its aria-label is "Bid ·  FD",
   with an empty figure. The advice also contradicts the figures on the first load: "I wouldn't bid on this one: loads
   like it usually clear at or under Book now" beside "Book now 2.41/mi … Usually clears near 2.65/mi".
7. **Letting a driver go has no confirm** (Staff, LET GO). It's immediate.
8. **The Staff card counts "0 loads booked"** after a hand booking. Intel lists the company as "1 truck" while it owns
   2 (one parked).
9. **The fleet start's clock ran at "Day a minute" by itself** after the first hire and sell in World C. I had left the
   previous world paused. Not reproduced.

## Not reached
- Item 9: home time away from the home hub.
- The sale notice with a loan repaid.
- Off sale after a reload.
- The seat-back button.
- Items 35–37 (I didn't found the brokerage, so as to keep the carrier's cash).
- The fee's screens with the switch on (off build only).

## State left
- **The slot:** World C, about Apr 5, paused. One truck, the owner driving, 119k FD, the dispatcher on (bid, floor,
  contracts off, home time).
- The second tab is closed and the viewport is unchanged. No repo edits; nothing staged.
