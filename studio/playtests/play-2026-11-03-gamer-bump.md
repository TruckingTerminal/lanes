# Play diary: the gamer, on the bump preview

- **Who I was:** the same tycoon and management gamer as sitting 4, on a laptop with a mouse. I've never driven a truck.
  I read every tooltip once, pull every lever in the first hour, and look for the exploit and the number that
  compounds.
- **Build:** the bump preview, commit `01fe39d`: the next ruleset's 33 values, with the brokerage, the Reserve and cash
  switched on. Played at `gamer.localhost:5190`, its own browser origin, separate from my trucker world and from QA.
  Laptop size, 1440 × 900.
- **How I played:** small fleet start at Chicago (Chicago isn't a starter city any more, but ALL HUBS has it), named
  MinMax Logistics. I pulled every lever in the first six minutes, then ran Day in 2 s, pausing only to deal with what
  the game threw at me.
- **How long:** about 13 real minutes, Wed Jan 3 to Sat Feb 3, Year 1. Minutes below are real minutes from the title
  screen.
- **Where I ended:**
  - Three trucks, two of them parked for ten days with no driver.
  - 33 loads by Jan 29, 97% on time.
  - Cash −55,216 FD, with 2 of 4 weekly debt checks used.
  - Rating "Unsatisfactory" after a Jan 29 audit and 60,000 FD in fines.
  - The month card: "earned 280,349, spent 157,138, kept 123,211 FD". Sitting 4 kept 271,665.
- **Screenshots:** in [play-2026-11-03-gamer-bump/](play-2026-11-03-gamer-bump/).

## Against sitting 4

| Question | Sitting 4 (`3ccaee9`) | Bump preview (`01fe39d`) | Changed? |
|---|---|---|---|
| Does penny pay still pay by the close? | 0.01 FD/mi accepted; drivers grumbled and never quit; most of the 271k | **No.** "Below the pay floor: 0.74 FD/mi, 85% of their market rate." At the floor, both 5★ drivers quit within three weeks, with no message. Afterwards every driver "asks at least" about 10% over the listed pay, and HIRE has no way to offer it. Two trucks sat ten days. | Fixed, with teeth, maybe too sharp |
| Does the 300% margin still pay? | The dispatcher won loads above every ceiling, at 12–18/mi | **Not as an exploit.** The rule is now "usually clear near, plus %", and at 300% the dispatcher just books at book-now. But book-now ran 8–9.7/mi in week one, so it still takes the top of a boom board every round on its own. | Exploit closed; the boom remains |
| Does rule-breaking pay by the close? | 23.2k in fines (about 6% of revenue), never rated | **No.** The audit date is posted in advance ("review Mon Jan 29"). On Jan 29: "Compliance review: unsatisfactory. Found 22 falsified log days and 3 weeks of skipped maintenance; 60,000 FD in fines." 66.6k in fines all told, and one more unsatisfactory revokes the authority. | Fixed |
| What do the compliance options cost on screen? | Nothing: "Policy set." | A confirm card with a season's cost: "an owner-operator running this loses more than an honest twin earns; a fleet, three quarters. Nearly every one loses its authority." Plus a line under each option, like "Falsified logs on every trip. Fines, out-of-service orders, an audit". | Fixed |
| Is there a decision after minute 15? | No. Pay and margin set, then 20 game days ran themselves. | **Yes.** Net 30 and weekly debt checks made me choose which invoices to cash, twice. Then the drivers quit, the audit landed, and rehiring hit a wall. | Changed |
| Loans, lease, cheapest truck, staking | An empty loan pool, an unnamed lease deposit, a hidden 0-rebuild truck, 40k of staking for nothing | Cash-out loans are gone. The lease names "45,500 FD deposit · at least 910 FD a week". The cheapest truck's buy card says "19% of its life left, no rebuilds". But Finance still says staking 20,000 unlocks ten trucks, while the yard is the real cap. | Mostly fixed |
| Dollar buttons | On every rig, facility and the yard | Gone from the Dealer and the yard; still on Business (shop $3,135, fuel station $7,838, dealership $5,878). | Partly |
| The month | Earned 396,561, kept 271,665 | Earned 280,349, kept 123,211, cash −55,216 | Down 55%, still large |

**What changed, most important first:**
1. Rule-breaking now meets a dated audit and real fines.
2. Pay has a floor, and paying the floor costs you drivers.
3. Cash can run out, and the weekly debt check makes Net 30 a decision.
4. Every risky button explains its downside before you press it.
5. The cheapest truck, the lease and the loans tell the truth.

**What didn't change, worst first:**
1. The boom: book-now is 8–9.7/mi in week one, and three trucks billed 280,349 in the month.
2. Staking text still promises trucks.
3. Poach offers vanish silently.
4. Dollar prices are still on Business.

## The diary

**Min 0–1 · Jan 3 · start.** The title, ALL HUBS, Chicago, small fleet. My first typing in the company name landed
before the field was ready, and the second time it doubled to "MinMax LogisticsMinMax Logistics". The world started
without auto-booking anything this time. Iuliia: "Two trucks: bid one yourself, or let the dispatcher run both." The
truck card says plainly: "You may run 5: your yard holds 5. Yards open Jan 29."

**Min 1 · hiring.** Auto-staff is now off by default. HIRE on a 5★ driver opens a confirm card: "Hire Sanjay Kowalski?
2,609 FD a week… The one risk: That's more than your company kept last week: 0 FD"
([01](play-2026-11-03-gamer-bump/01-hire-asks-first.jpg)).

**Min 1:30 · the first lever: pay.** SET PAY 0.01 got a red toast: "**Below the pay floor: 0.74 FD/mi, 85% of their
market rate**" ([02](play-2026-11-03-gamer-bump/02-pay-floor.jpg)). So I set exactly 0.74. He went from "happy" to
"settled". A 5★ at 0.74 still costs about what a 2★ asks, so the floor shaves the exploit to 15% rather than killing it.

**Min 2:30 · the second lever: the dispatcher.** The rule now reads "Bid at what loads usually clear near, plus %". A
late Iuliia card shoved the layout, and my "300" landed in truck 2's weekly lease-price box. I set it again directly:
"Dispatcher saved" ([03](play-2026-11-03-gamer-bump/03-dispatcher-300-over-clearing.jpg)).

**Min 3:20 · the third lever: policy.** 15 h every day, 56 mph always, deferred maintenance. SET POLICY now asks:
"Set this policy? … Over a season, an owner-operator running this loses more than an honest twin earns; a fleet, three
quarters. Nearly every one loses its authority"
([04](play-2026-11-03-gamer-bump/04-policy-confirm-with-cost.jpg)). A gamer tests the claim, so I set it anyway.

**Min 4 · Finance and the Dealer.** No cash-out loans at all now. There are no dollar prices on rigs. The lease names its
deposit: "45,500 FD deposit · at least 910 FD a week… you have 24,700". The only used truck was a Highway Pro + Flatbed
in Memphis at 27.5k, and its buy-on-a-loan card tells the truth: "**19% of its life left, no rebuilds**… It runs until
it's worn out, then goes for scrap, for about 5,310 FD"
([05](play-2026-11-03-gamer-bump/05-cheapest-truck-tells-the-truth.jpg)). I bought it, hired a second 5★ for it and set
her to the floor. Finance still says "Staking: needed past 5 trucks (20,000 FD to run up to 10)".

**Min 6 · Jan 3–8 · Day in 2 s.** The dispatcher booked at book-now every round: Centerville → Detroit at 9.65/mi,
Sherwood → Frankfort at 9.69. Chicago → Houston billed 8,153, and Canton → Memphis 7,951 with "Driver's pay · Sanjay
Kowalski −597". So no more above-the-ceiling wins; it's the posted price, every time. That's still a boom board in week
one. Clean inspections at the West Memphis scale (I-40).

**Min 6:30 · Jan 13 · the first real decision.** **Cash −18,589.** Iuliia: "The weekly check is Jan 14. At today's cash
you'd be under the line. 4 checks in a row under −2,000 FD and the company is wound up"
([06](play-2026-11-03-gamer-bump/06-cash-minus-18589-weekly-check.jpg)). Everything I'd earned was Net 30, and three
trucks of fuel and two drivers' wages had burned through the 25k. Money lists every invoice with "Cash now: X lands ·
fee Y · CASH IT NOW". I cashed Windsor → LaGrange: "Fee 8.0% spot + 0.3% at 3 days old · 1,276 FD… The fee goes to the
reserve" ([07](play-2026-11-03-gamer-bump/07-cash-this-invoice-now.jpg)). Then Centerville → Detroit, and I was at +7,111
for the check. This was the first time in four sittings I had to think about money.

**Min 7:50 · Jan 17 · the record.** Cash was back to −15,699. One line said "You're 5,009 FD in the red", while Money
showed −15,699. Company had 22 loads, #85 of 521, and **"Not yet rated · review Mon Jan 29"**: the audit date in
advance. Hours of service 5.8 of 5, 6,614 in fines. The policy lines now spell it out: "Falsified logs on every trip."
I kept the policy on to test the audit, and let the Jan 21 check pass in the red to test the debt rule. Next day I was
at −28,861 and Money still said "Weekly checks in debt: **0 of 4**".

**Min 8:50 · Jan 27 · both drivers gone.** Cash −44,244, "Weekly checks in debt: 1 of 4"
([08](play-2026-11-03-gamer-bump/08-debt-check-1-of-4-driver-gone.jpg)). Then the idle warnings: "Truck 2 has been idle 3
d 1 h at Knoxville: No driver is seated" and "Truck 3 has been idle 2 d 11 h at Denver"
([09](play-2026-11-03-gamer-bump/09-both-drivers-quit.jpg)). The floor-paid drivers had quit. Nothing told me when or
why; Staff just said "Nobody on the payroll yet". Thirty-one invoices were owed, about 252k. I cashed four (Bakersfield →
Bozeman alone landed 16,393) and got back to +8,197.

**Min 10:45 · rehiring.** Priya Reyes, listed at 0.85: "**Priya Reyes asks at least 0.93 FD/mi**". Marcus Lowe, listed
0.85: "asks at least 0.94". Even Omar Duarte, listed 0.68: "asks at least 0.75"
([10](play-2026-11-03-gamer-bump/10-drivers-ask-more-than-listed.jpg)). HIRE has no pay field, so I couldn't meet any of
them. I sent a poach OFFER at 0.95, and the row vanished with no confirmation. Nobody came.

**Min 11:45 · Jan 29 · the audit.** "**Mon Jan 29, Year 1: Compliance review: unsatisfactory. Found 22 falsified log
days and 3 weeks of skipped maintenance; 60,000 FD in fines.**" The rating: Unsatisfactory, next review Mar 14. Hours of
service 52.9 of 5 ([11](play-2026-11-03-gamer-bump/11-audit-unsatisfactory-60k.jpg)). Cash −52,569, and "2 more weeks in
debt and the company is wound up". I set the policy back to legal; there's no confirm card on the way back.

**Min 12:30–13 · Feb 3 · the close.** Cash −55,216, with two trucks idle for ten days. "**Your first month: earned
280,349, spent 157,138, kept 123,211 FD**." Iuliia's timeline: "Next on the road: your next truck, 6,892 FD away…
Jan 21 In debt at a weekly check… no date Three trucks"
([12](play-2026-11-03-gamer-bump/12-first-month-kept-123211.jpg)). Business still sells shops and fuel stations for
dollars.

## The five things that most got in the way

Ranked by what breaks LANES as a game, with anything I could exploit first.

1. **The boom still makes the dispatcher a money machine.** The exploit moved from my settings to the market. Book-now
   ran 8–9.7/mi in week one, and at any margin above book-now the dispatcher simply books it every round. Three trucks,
   two of them parked for the last ten days, billed 280,349 in the month from a 25k start. The audit, the pay floor and
   the cash checks all bite, and the month still "kept" 123,211.
2. **The weekly debt check doesn't match the cash on screen.** At −15,699 a line said "You're 5,009 FD in the red".
   After the Jan 21 check at about −28,000, Money still said "0 of 4". The count only moved on the 27th. "Kept 123,211"
   sits beside cash of −55,216. A gamer can't tell how close to being wound up he is, so it reads either as a free float
   to exploit or as a trap.
3. **Rehiring is a dead end.** The floor-paid drivers quit with no message. Afterwards every driver "asks at least" about
   10% over the listed pay, HIRE can't offer it, and the poach offer vanished silently. Two trucks sat ten days. That's a
   consequence with no way back, and nothing explains it.
4. **The signposts still disagree.**
   - Finance: "Staking: needed past 5 trucks (20,000 FD to run up to 10)". Every other screen: "your yard holds 5".
   - "Your next truck, 6,892 FD away" for a fleet with three trucks and −55k cash.
   - "no date Three trucks" on the timeline.
   - "Houston → Houston · 11,641 FD" on Money.
   - Dollar prices still on Business.
5. **The layout jumps under the mouse.** Late Iuliia cards push the panel down, so typing lands in the wrong box: my
   dispatcher margin went into the lease price, and one driver's pay into another driver's row. The company name field
   doubled. Wins get toasts; quits and lost poach offers don't.

## The three best moments

1. **Jan 29: the audit.** The game told me the date two weeks ahead, then did exactly what it said: "22 falsified log
   days… 60,000 FD in fines". That's the first consequence in LANES a gamer respects.
2. **Jan 13: −18,589 and the invoice list.** Every invoice priced to cash now, a fee per day of age, and a check on
   Sunday. A real cash-flow puzzle, the first decision in four sittings that took thought.
3. **The confirm cards.** "The one risk…" on hiring, buying and policy. The game tells you the downside before you
   click, in numbers and in plain words.

## What I did not understand

- How the weekly debt check is measured, and why it said "0 of 4" after a check I spent deep in the red.
- Why drivers "ask at least" more than their listed pay, and how I'm meant to pay it.
- Whether my poach offer was ever sent.
- What the Reserve is, beyond "the fee goes to the reserve".
- Why Finance still says staking unlocks trucks.
- Whether "kept 123,211" counts invoices nobody has paid yet.
- What "no date Three trucks" means.

## What looked ugly or broken

- Late Iuliia cards shift the layout and send typing to the wrong field
  ([03](play-2026-11-03-gamer-bump/03-dispatcher-300-over-clearing.jpg)).
- No message when a driver quits; I learned from idle warnings
  ([09](play-2026-11-03-gamer-bump/09-both-drivers-quit.jpg)).
- "Asks at least 0.93" against a listed 0.85, with no way to offer it
  ([10](play-2026-11-03-gamer-bump/10-drivers-ask-more-than-listed.jpg)).
- A poach row vanishes without confirmation.
- "no date" on the timeline ([12](play-2026-11-03-gamer-bump/12-first-month-kept-123211.jpg)).
- The company name field doubles typed text.
- The ticker said "Truck 2 has no driver" after I'd hired one.

## Would I come back tomorrow?

Yes, and that's new. In sitting 4 I solved LANES by minute 15. This month it fought back: cash ran out, the audit came on
the day it promised, and my cheap drivers walked. There were decisions to make all month. I'd come back to see if I
can run a clean fleet through February with my record in tatters. But the boom still pays absurd money, the debt check
is opaque, and the rehire wall is a soft lock, so tomorrow might be the day the game winds me up for reasons I can't
read.

## What the game is about, as I understood it

You run a trucking company in a shared freight market. You post trucks to a board that clears twice a day, pay drivers
who have opinions about their pay, and live on Net 30 invoices you can sell early for a fee. Break the rules and an
auditor comes on a date you can see; run out of cash for four weeks and they wind you up. As a gamer I found the loop
again (cheap labor, aggressive dispatch, rule-breaking), and this time each piece of it had a price. The month ended
with me in debt, under audit and short two drivers, which is the first time LANES has felt like a management game.
