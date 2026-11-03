# Play diary: the working trucker, on the bump preview

- **Who I was:** the same working trucker as sitting 3. I've had years behind the wheel and I'm on a laptop with a
  mouse. I judge every rate by gut.
  - Dry-van spot is about $2.00–3.00 a mile, and an owner-op's all-in cost is about $2 a mile.
  - Hours of service: 11 h driving, then 10 off, and 70 h in 8 days.
  - Docks keep hours, and detention starts after 2 free hours.
- **Build:** the bump preview, commit `01fe39d`: the next ruleset's 33 values, with the brokerage, the Reserve and cash
  switched on. It's served at `localhost:5190/site/index.html`. I played it at `trucker.localhost:5190`, my own browser
  origin, so my world never touched QA's or my next sitting's. Laptop size, 1440 × 900.
- **How I played:** owner-operator out of Memphis, the same start as sitting 3. Every load chosen by hand, dispatcher
  off all month. Six bids (four won) and eight book-nows. Day a minute throughout, except Day in 6 s through two long dock waits and
  the last days at home.
- **How long:** 37 real minutes, Wed Jan 3 to Sat Feb 3, Year 1. Minutes below are real minutes from the title screen.
- **Where I ended:**
  - Bluff City Dry Van, Memphis, home for five days off.
  - 12 loads, 83% on time, 7,393 miles on the odometer.
  - Cash 4,700 → 8,537 FD, with about 9,700 more held toward my own truck.
  - Month card: "earned 32,201, spent 18,205, kept 13,996 FD". Sitting 3: earned 56,217, kept 30,503.
- **Screenshots:** in [play-2026-11-03-trucker-bump/](play-2026-11-03-trucker-bump/).

## Against sitting 3

| Question | Sitting 3 (`adfb916`) | Bump preview (`01fe39d`) | Changed? |
|---|---|---|---|
| Is "usually clears near" a figure a trucker can judge by? | No. Book-now ran 2–3× it, and every market read "2.50 Hot". | **In week one, yes.** Memphis averaged 2.92/mi and Memphis → Kalamazoo cleared near 2.21. From day 6 a "boom" pushed even the clearing figure to 3.4–6.4/mi. Book-now still ran 1.3–2.1× it. | Better for a week, then the same |
| Does bidding under book-now win often enough to be a choice? | Never worth trying: book-now was always the move. | **Yes.** 4 of 6 bids won, all 10–16% under book-now. Once, book-now was *below* the clearing rate. Lost bids are never reported. | Changed: it's a real choice now |
| Do the hours and the road add up? | 538 mi in 9.3 h with no stop; 9,125 mi in 25 days; no 70-hour or 34-hour clock | **Partly.** ETAs show an 11-hour shift and then a rest. Docks keep hours: four weekend waits at docks. A real scale inspection (Robertson County, I-65), and five days off at home at the month's end. Still missing: fuel stops and breaks, a visible 70-hour clock, and detention. | Partly fixed |
| Is the month's money nearer a real one? | Earned 56,217, kept 30,503, on 9,125 mi | **Earned 32,201, kept 13,996, on 7,393 mi** (5,769 loaded). That's 5.58 FD per loaded mile, still about twice a real January dry-van rate. | Nearer, about halfway |
| Can I see the lease hold? | 30% held, with the balance shown nowhere | Every load card splits it ("+439 · −103 to you · 542 held toward your truck"). Money shows "Held toward your truck · 7,932 FD in all", and Iuliia gives "your gap to the next truck". | Fixed |
| Does the dispatcher stay off? | It switched itself back on after load 1 | It stayed off all month. The idle card says why and offers "Let the dispatcher bid". | Fixed |
| Does an empty run show its cost? | No | "Home · 212 mi empty · about 274 FD · 5 h", before you choose | Fixed |
| Does a locked load say why? | Partly | "Strict vetting: 90 days' authority and 25 loads. You have 2 days, 1 loads." "Needs 30-day authority: yours reaches it Feb 3." "Open to everyone from 18:00." | Fixed (list view) |

**What changed, most important first:**
1. Bidding is a decision now.
2. The hold is visible.
3. The first week's rates are believable.
4. Docks keep hours, and there's home time.
5. Every lock and every empty mile shows its price.

**What didn't change, worst first:**
1. Rates still boom to fantasy by week two.
2. "Your pay for driving" is still a cost to the man who *is* the driver.
3. Dock delays carry no detention, and the late lands on me.
4. Lost bids say nothing.
5. Iuliia still calls 200 miles out, and home itself, "the far end of the country".

## The diary

**Min 0 · title.** The same desert road. NEW TEST WORLD, a three-second pause, then the map.

**Min 1 · Jan 3 · home.** The starter cities are now Columbus, Los Angeles and Newark; Chicago's gone. Through ALL HUBS
("Sorted by today's freight. Today's, not forever's."), Memphis reads "**5 loads posted last round · 2.92/mi average ·
1.0 loads per truck · even**". Sitting 3 said 18 loads, 3.53/mi and "Hot". That's January.

**Min 2 · the board.** Every lock now gives its reason, like "Strict vetting: 90 days' authority and 25 loads. You have
0 days, 0 loads" and "Open to everyone from 18:00". Every load shows what's held: Memphis → Kalamazoo is "+439 · −103 to
you · 542 held toward your truck". The empty runs are priced too: "To Little Rock · 137 mi empty · about 177 FD · 3 h"
([01](play-2026-11-03-trucker-bump/01-start-memphis.jpg)). Everything I asked for in sitting 3 is on one screen.

**Min 2 · the first bid.** Kalamazoo's detail: book-now 2.83, **usually clears near 2.21**, ceiling 3.47, my
break-even 2.15. A real January rate at last. I bid 2.55 under book-now: "Bid in at 2.55/mi. It clears at 18:00"
([02](play-2026-11-03-trucker-bump/02-first-bid-under-book-now.jpg)). The status bar says "Your dispatcher is off". It
won at the round.

**Min 3–4 · Jan 3–4 · the run.** Iuliia: "A driver may drive 11 hours in a day, then must rest, and the game counts…
the shoulder is illegal… Docks keep their own hours." 584 miles, then the ETA slid back for a rest. Delivered on time.
The settlement: load 1,624, fuel −466, lessor's 15% −244, "Held toward your own truck (kept)" −487. And "**Your pay
for driving −485**". **Yours −207 FD**
([03](play-2026-11-03-trucker-bump/03-first-settlement-minus-207.jpg)). A profitable load, and I'm 207 poorer, because
I'm billed for my own wages and never paid them.

**Min 4 · Jan 5.** The dispatcher stayed off ([04](play-2026-11-03-trucker-bump/04-dispatcher-stays-off.jpg)). The
idle card is fair, not a nag: "The dispatcher is off, so nobody bids for this truck while you're away. It has sat out 1
bidding round."

**Min 5 · Jan 5 · Kalamazoo.** The Chicago-market board runs 4–6/mi, with Suamico → Arlington Heights at 9.65 and
Escanaba → Fall River at 8.00 for 1,298 miles. Portage → Nashville: book-now 6.75 against clears 3.51
([05](play-2026-11-03-trucker-bump/05-chicago-board-book-now-double.jpg)). I bid 4.25. It lost, and nothing said so.
The card just counted it as "sat out 2 bidding rounds" ([06](play-2026-11-03-trucker-bump/06-lost-bid-no-word.jpg)).

**Min 6–9 · Jan 5–9 · a weekend at a dock.** Friday night I booked Monticello, IN → Portland, TN: book-now 4.36, clears
4.24, almost equal. The load said "Pick up · now". The truck sat "Loading at Monticello" all weekend and rolled Monday
morning ([07](play-2026-11-03-trucker-bump/07-loading-all-weekend.jpg)). That's real for a small shipper, but it told
me nothing when I booked. The settlement: 24 FD mine.

**Min 10–11 · Jan 9–10 · home on a bid.** The ticker said "Freight is booming across the country". Every load out of
Nashville was 5–9/mi. Louisville → Memphis: book-now 6.43, clears 3.81
([08](play-2026-11-03-trucker-bump/08-louisville-memphis-detail.jpg)). In the list view the bid is a ±0.05 stepper,
fifteen taps to get from 6.48 to 5.73. Tapping the figure opens an explainer, not a keyboard. I bid 5.73 and won
([09](play-2026-11-03-trucker-bump/09-won-under-book-now.jpg)). Iuliia, at home in Memphis: "Empty trailer, far end of
the country."

**Min 12–15 · Jan 10–13.** Book-nows: Collierville → Columbus, GA at 5.43 (648 FD mine), then Chattanooga → Cincinnati
at 6.55 (312 FD mine, [10](play-2026-11-03-trucker-bump/10-settlement-312-yours.jpg)). On Friday the destination filter
found seven loads to Memphis. On Trotwood → Holly Springs, book-now was **4.88 against a clearing rate of 4.96**: below
the market ([11](play-2026-11-03-trucker-bump/11-book-now-under-the-market.jpg)). Booked it. Now you have to read the
numbers.

**Min 16–18 · Jan 13–15.** "Truck 1: clean level 1 inspection at the Robertson County scale (I-65)", a real scale on
the right road. Then a Sunday at the Holly Springs dock. Monday I bid 4.60 on Booneville → Peoria against book-now 5.49
and clears 3.77. The idle line said "**Your bid of 4.60/mi is in for the next round**", and it won
([12](play-2026-11-03-trucker-bump/12-bid-acknowledged-and-won.jpg)). The Memphis panel showed reefer at 15.05 a mile.

**Min 20–21 · Jan 16 · the boom.** Peoria's board had Decorah → Indianapolis at 13.83/mi. Decatur → Memphis had
book-now 9.70, clears 6.38, "raised 6 rounds running" ([13](play-2026-11-03-trucker-bump/13-clears-near-6-38-raised-6-rounds.jpg)).
Now even the clearing figure is two to three times a real rate. My 8.70 bid lost, silently. Iuliia: "Your gap to the
next truck is 8,446 FD" ([14](play-2026-11-03-trucker-bump/14-gap-to-next-truck.jpg)).

**Min 22–27 · Jan 17–22 · the dock week.** I pressed "Book now · 4.60" on Franklin, WI → Lakeland, TN. The ticker said
"Booked at book-now… at **5.15**/mi": the round re-priced it while I clicked
([15](play-2026-11-03-trucker-bump/15-booked-at-a-different-rate.jpg)). Then "Loading at Franklin" from Wednesday to
Friday, two weekdays, no reason given. The ETA showed "Late 19 h" against a deadline that hadn't come yet
([16](play-2026-11-03-trucker-bump/16-loading-two-days-then-late.jpg)). Then a weekend "Unloading at Lakeland". The
delivery: **Late 28 h**, 351 FD mine, and no detention line
([17](play-2026-11-03-trucker-bump/17-late-28h-dock-delays.jpg)). The shipper and receiver held me four days, and the
late goes on my record.

**Min 27–31 · Jan 22–25.** Iuliia: "Your first month closes in 11 days. Monthly bills land with it." Memphis →
Opelika: book-now 9.47 against clears 5.34, 1,428 FD mine. Then a 5.10 bid on Meridian → St. Louis, against book-now
5.69: won, 274 FD mine. The Memphis panel: reefer to Baltimore **19.51/mi**, dry van to Dallas 11.32
([18](play-2026-11-03-trucker-bump/18-memphis-reefer-19-a-mile.jpg)).

**Min 32 · Jan 26 · Money.** "Held toward your truck · 7,932 FD in all · 30% of each leased load is kept for you until
you buy." Owed-to-you: "On a lease, the lessor pays on delivery. Invoices start with your own truck"
([19](play-2026-11-03-trucker-bump/19-money-held-shown.jpg)). Both sitting-3 complaints are answered.

**Min 33–35 · Jan 27–30.** Greenwood, IN → Memphis sat at the shipper over another weekend and arrived two days past
the board's deliver-by. The card says **On time** ([20](play-2026-11-03-trucker-bump/20-on-time-two-days-after-due.png)).
Then Memphis → Nashville at 8.94, 676 FD mine. "Home · 212 mi empty · about 274 FD · 5 h", priced before I chose.
"Heading home for days off."

**Min 36–37 · Feb 1–3 · the close.** "Home time at Memphis: 5 days off left"
([21](play-2026-11-03-trucker-bump/21-five-days-off.jpg)). The run home and the month's bills took cash from 9,685 to 8,601. Then: "**Your first
month: earned 32,201, spent 18,205, kept 13,996 FD.**" ([22](play-2026-11-03-trucker-bump/22-first-month-kept-13996.jpg)).
Company: 12 loads, 83% on time, #469 of 521. The policy box now says it plainly: "Every setting except Legal breaks
the law."

## The five things that most got in the way

What a trucker finds false or missing ranks above what a gamer finds annoying.

1. **The rates still run away by week two.** Memphis averaged 2.92 on Jan 3, and week one read like real January. From
   Jan 8 ("The first boom") dry van ran 9–11/mi out of Memphis and reefer 14–19.5/mi. Even "usually clears near" climbed
   to 5–6/mi. The month still came to 5.58 FD per loaded mile, about twice a real one. The fix is half there: the board
   is honest about the market, but the market isn't real for long.
2. **Docks hold you for free, and the late lands on me.**
   - Monticello loaded Friday night to Monday.
   - Franklin took two weekdays to load and Lakeland held me a weekend to unload, so: **Late 28 h**, no detention.
   - Greenwood was two days past the board's deliver-by, and was marked On time.
   - The board says "Pick up · now" and never shows the dock's hours before I book.
3. **"Your pay for driving" is a cost to the owner-operator who drives.**
   - The first load showed "Yours −207" on a run that cleared about 770 after fuel, lease and upkeep. The 485 for my own
     driving went nowhere.
   - With the 30% hold on top, cheap loads take cash out of the driver's pocket. That's not how settling an owner-op
     works.
4. **Bidding works but talks too little.**
   - Lost bids are never reported.
   - The list view's bid is a ±0.05 stepper (fifteen taps), and its default sits above book-now.
   - A book-now button kept a stale price across a round: I pressed 4.60 and booked at 5.15.
   - In the table view, a strict-vetting load just greys its button, with no reason.
5. **Iuliia's geography (gamer-side).** "Empty trailer, far end of the country" in Portland, TN, 200 miles out, and
   again parked at home in Memphis. "Truck 1 has been idle 16 h at Chicago" while the truck card says Kalamazoo.

## The three best moments

1. **Week one's board.** Memphis at 2.92, Kalamazoo clearing near 2.21, a bid at 2.55 that won. For a week this was a
   load board a trucker can read, and bidding under the posted price was a real decision.
2. **Everything I asked for is on screen.** The hold on every load and its total on Money, the gap to my own truck,
   the price of every empty run, and why each locked load is locked ("You have 2 days, 1 loads"). The dispatcher stays
   off when I turn it off.
3. **The road is starting to feel like a week.** Shifts end and the truck rests. Small docks close for the weekend.
   There's a clean inspection at the Robertson County scale on I-65, and five days off at home after a month out.

## What I did not understand

- What drives "the first boom", and why the clearing rate itself doubles in two weeks.
- Why one dock-delayed load counted as late and another, later still, as on time.
- Who is paid "your pay for driving" when I'm the driver.
- Why a bid lost: price, record or empty miles?
- Why net worth (8,537) leaves out the roughly 9,700 held toward my truck.
- Why "Miles" (4,829) and the odometer (7,393) are different numbers.
- Why the list-view bid stepper starts above book-now.

## What looked ugly or broken

- A book-now button that books at a different price than it shows
  ([15](play-2026-11-03-trucker-bump/15-booked-at-a-different-rate.jpg)).
- Lost bids get no message ([06](play-2026-11-03-trucker-bump/06-lost-bid-no-word.jpg)).
- "Late 19 h" against a deadline still a day away ([16](play-2026-11-03-trucker-bump/16-loading-two-days-then-late.jpg)).
- "Late 28 h" for dock delays ([17](play-2026-11-03-trucker-bump/17-late-28h-dock-delays.jpg)), while a later load
  says "On time" ([20](play-2026-11-03-trucker-bump/20-on-time-two-days-after-due.png)).
- "Profit at your bid" doesn't recompute as you type.
- Twice my Pause click didn't take, and a round passed while I read.

## Would I come back tomorrow?

Yes, and sooner than after sitting 3. Week one was the best trucking LANES has shown me: a January board, bids that
win under the posted price, and every hidden number out in the open. I'd come back to see whether the boom settles.
But a trucker quits a broker who holds him four days at docks and writes him up late. A trucker also laughs at 19 a
mile for a reefer out of Memphis. Fix the boom and the dock time, and I'd play this every evening.

## What the game is about, as I understood it

You're a leased owner-operator in a live freight market. Every twelve hours the board clears: you book a load outright
or bid under the poster's price and wait for the round. The lessor takes 15% and holds 30% toward a truck of your own,
and the game now shows you both, and how far you are from that truck. Docks keep hours, shifts end, and the month ends
with bills and days at home. It's starting to be the job. What isn't the job yet: rates that double in a week, docks
that hold you for free, and a driver billed for his own wages.
