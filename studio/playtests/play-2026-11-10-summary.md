# Six playstyles on c8c67db: summary

Build: lanes-play `87864b2` (Deploy c8c67db), version.json `{"build":"c8c67db"}`, ruleset 0.24.0-phase0.41, played on my
own localhost copy (no newer build appeared between sessions). Diaries: play-2026-11-10-exploit-hunter,
-borrower, -middleman, -absentee, -stubborn-specialist (day 56, short of its 60-day floor),
-cautious-owner-operator. Load times quoted in the diaries are upper bounds: my browser pane was hidden and probably
throttled.

Last round's blockers are gone: no carry-over between replaced worlds, Send home on a moving truck (with "back to
work" or "5 days off"), the stranded state with a priced way out, one cash figure that names the draw, the dock time
on the pickup line, and the bid ceiling equal to book-now.

## The ten worst, ranked by how a stranger would feel them

1. **Trucks repossessed silently** (borrower). Miss a second loan payment and the lender takes the trucks with no
   log line and no month-report line; the survivor is renumbered "Truck 1". Steps: buy three used trucks on loans
   (~day 121), let cash run below −14,000, read Money → "1 payment missed. 2 in all and the lender takes the truck",
   run a week. Two trucks are gone, loans drop from 99,764 to 31,605, and cash jumps −14,898 → +10,794, unexplained.
2. **Following Iuliia loses money** (cautious owner-operator). With the dispatcher off, the 21-day home rule drags the
   truck home empty, about 1,700 mi and 3,000 FD each time. It happened 3 times by day 80 while What now? talked about
   "Step 5 · pick the next load" or "Step 7 · check the condition bar". Cash sat at 3–6k for 80 days. Turning the
   dispatcher on (no step says to) took it to 25k in two months.
3. **The guide's first-truck pick doesn't exist or contradicts itself** (borrower, absentee, cautious). "Ready today:
   6,548 FD in cash" matches no listing. "A used Workhorse … in Wichita" is not on the list. "A used Workhorse with a
   reefer … 28% condition … your company hauls dry van" comes in the same card as "I'd wait for a sounder one".
   Repeated in three worlds.
4. **Step 10 dead-ends** (cautious). One owned truck, owner driving: "Step 10 of 13 · Hire a driver … GO TO STAFF"
   opens the locked teaser "Opens at your second truck". Iuliia adds "A second truck needs a second driver."
5. **Two tabs, last writer wins** (exploit hunter). Hire in tab A, let an older tab B run, reload A: the hire is gone and
   the clock jumps. No warning. It works as a free undo.
6. **The brokerage transfer field jams** (middleman). On step 2 of Start a brokerage, type −50000: the field sticks at
   "0" and accepts nothing more, and Back/Next don't reset it. After a reload it ignores typing entirely, so only the
   default 90,300 (leaving the carrier 3,189 FD) can be moved.
7. **The real purchase confirm opens off-screen** (exploit hunter, laptop). BUY ON A LOAN · 13.4K FD NOW appears to do
   nothing; the actual "Order Workhorse + Dry van? … ORDER · 13,357 FD" opens below or beside the view. I missed it
   three times.
8. **Running the brokerage may stall the carrier** (middleman, seen once). Six days in the brokerage view gave "Truck 1 has
   been idle 4 d 13 h … The dispatcher is off" with the box ticked. It booked within the hour of switching back.
9. **A listed truck never sells and can't be unlisted** (exploit hunter). Reefer listed Jan 13 at 158.8k, −5% a week,
   unsold seven weeks while "worth … what your owned truck would fetch today: 171,501". There's no unlist button.
10. **What now? watches the wrong thing** (specialist, borrower). A reefer stuck 9 days in Nebraska gets "Bid on
    Pembroke Pines to Dyersburg instead. You lost the last one" (the other truck, day 1). At −14,898 with one missed
    payment on every loan, it mentions only the four-week debt clock, not the repossession one week away.

Close behind: month reports count bought trucks' odometers as loaded-mile denominators ("8,497 of 421,169 miles
loaded (2%)", twice); February's bridge has no "invoices not yet paid" line; a bid floor (2.32) above the winning
price (2.28); loan payments for months on a truck still on order; one-tap hires that hire twice; a 90% broker margin
accepted without a word; "every broker is #1"; "Feb 29" in Year 1; the clock and cash differing after a reload;
"truck 888/906" for Truck 1.

## The three things that worked best

1. **The money screens.** Every cost named; "Kept isn't cash"; the loan sheet with its stake and "Miss 2 payments and
   the lender takes the truck"; the brokerage's step 2 with bond, surety, fee and both companies' cash after; and the
   cash forecast "below zero around Wed Jul 19 … before your next invoice lands on Fri Jul 21".
2. **The fixes from last round.** Clean replaced worlds, Send home on a moving truck with a real choice, and the
   stranded state with the cheapest way out priced and one tap away.
3. **The dispatcher.** Left alone for six months, it ran a leased truck at 76–92% loaded miles, profitably, every month.
