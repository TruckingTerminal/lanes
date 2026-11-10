# Decisions (the producer's log for Jeff; newest first)

- 2026-11-10 — the director, on two questions from the writer's pass on client batch 7
  (studio/reviews/director-listing-idle.md). One: "ready" stands as the one word for the day an ordered truck can be
  handed over (the lot rows said "arrives", the card "delivered", the ordered line "ready"); it is the honest word,
  the date being the earliest day and not a promise. Past its date the line is to say since when and why ("ready
  since Mar 8 · handed over when truck 1 next stands idle"); the writer has written the lines and engineering wires
  them in client batch 8. Two, a rule for a later ruleset: a used listing can be bought while the leased truck runs
  and is handed over at that truck's next idle moment, as an order is under assets.swapAtNextIdle, because a window
  that is minutes long with a dispatcher on is a rule the player cannot use. The guards: the sale at once and a player
  seller paid at the sale; no cancelling; the truck stands where it was listed and runs no loads; the lessor's cut
  runs until the hand-over; the dispatcher books no new load for the leased truck once a hand-over is pending; others
  see "Sold". Behind its own switch, the economy sizing any carrying cost. On engineering's list after the
  early-delivery fee and the days-away rule.
- 2026-11-10 — windows batch 6 is on main behind the switch (31dffac; the off digest unchanged, the 60-day sim
  figure-identical): an AI broker at or over a quarter lost at a hub over the trailing week takes no tender there, the
  bots' facility test reads the window's rounds and the hub's facility lost share, and a bot closes a facility still
  at a loss after eight weeks. Engineering's 60-day smoke on ten seeds: the carriers' share of the cap's pay level
  with off, no facility built at all under windows, the brokers' fall-off about double off's. The economy runs the
  ten seeds at four years for the gate. Client batch 7b (e19698e) and the writer's lines (e14a746, c8c67db) are on
  the test page with batch 7, build c8c67db, and QA replays them; pushes are held until QA reports. Engineering is on
  the early-delivery fee's engine part.
- 2026-11-10 — engineering's triage of the "Ledger entry to itself" that stopped two of the economy's windows-on twins
  (a7c1ad4): it cannot be reached with delivery windows off, so nothing in 0.24.1 is exposed. The cause: after a round
  the board re-posts some of what a dispatcher won; with windows on a win can be booked ahead for a truck still heading
  for another pickup, and the re-post abandoned that leg and started the truck on the very load being re-posted, which
  then reached its re-poster as its own hauler. Fixed: a load booked ahead leaves the truck's plan as a release does,
  and a company is never paid from itself. The off digest is unchanged (79e553e47d838330) and the 60-day live-profile
  sim figure-identical. Client batch 7 is on main too (897247a), from QA's replay of batches 6 and 6b: an ordered truck
  meets the walkthrough's own-truck step; a listing that cannot change hands while the leased truck runs says when it
  can; the shown ceiling is a ceiling a bid can be placed at; "Your own truck" dates the hand-over and the order has a
  milestone of its own; the lot rig's sheet says it is an order; the wait's figure names its basis. With the writer for
  its new lines and three standing slips (one word for the day an ordered truck is ready, Iuliia's worn-truck line,
  a ringed hub above "A little thin"), then QA's replay. Engineering is on windows batch 6. Still open for Jeff:
  0.24.1's approval, with its nine rules, and max effort for the producer.
- 2026-11-10 — the economy's pair on capital as spending (ledger.capitalNotSpending, 5a38fc1;
  studio/reviews/economy-capital-spending.md; 0.24.1's set on in both arms, seeds 1–2, 1460 days, the twin beside): it
  does what was asked and moves nothing else. The gate two of two, the band 0.848–0.862 against 0.841–0.853 with it off
  (seven thousandths up: less cash sheltered); cleared loads 445k → 446k, the rate 3.77 both, bankruptcies 181 → 173,
  owner-operator profit per truck-week 2,153 → 2,150, the holding cost's sink 2.33M → 2.05M, owned trucks 535 → 606 as
  the prudent bots put unsheltered cash into equipment. The week after an owner-operator buys its lot rig on a loan the
  cushion reads 0.8–1.9 weeks instead of 0.1–0.5, and the Reserve's cap 44–77k instead of 196–228k. The economy's call,
  and the producer's: it rides in 0.24.1 as the ninth switch; with Jeff, whose approval of the ruleset is open.
- 2026-11-10 — the economy's third reading of delivery windows, on batch 5 (studio/reviews/economy-delivery-windows-
  batch5.md; ten seeds, 1460 days): the price is back and the carriers are not. The rate reads 3.67 against 3.73 off and
  the cap's paid freight −3%, cleared −8%; but the carriers' freight income per truck-week is still −12.6% (their share
  of the cap's pay about 85% against 94%), owner-operator liquidations 0.303 against 0.187, and the gate fails every
  seed (the band 0.79–0.83). Two bot rules under windows take the difference: the AI brokers accept tenders they cannot
  cover (brokered pay 65% of the cap's against 26%, fall-off 7.3% of it burned, 31 of 60 brokers liquidated), and the
  bots build 69 facilities a run where none stand today, because their payback test counts ten rounds of chances to be
  hauled where a window gives two to four (the memory-free goods price of batch 5 is right and the leak is the count).
  Also an engine error on two twins, "Ledger entry to itself" from fraud.ts settleDoubleBroker with windows on. The
  producer's call on the economy's sizing: windows batch 6: an AI broker accepts a tender only while its trailing-week
  lost share at the hub is under a quarter; the facility test reads the window's rounds of life and the hub's facility
  lost share, and a bot sells a facility that has lost money for eight weeks; the crash fixed; then the ten seeds with
  the carriers' share, the facilities and the fall-off as lines of their own. Windows stay out of 0.24.1. The
  director's question answered: under windows "usually clears near" reads 1.1–1.3 times the reference at every hub
  (1.5–2.3 today, from rolled loads), loads clear one to three rounds from posting, and the waiting switch earns
  nothing, so it is off by default there, with the sheet saying "loads that cleared here this week". A note on the
  baseline: the cross-engine fix replays a world differently, so the off arm is being rerun on today's code; every
  difference above is many times that shift.
- 2026-11-10 — the economy's size for Jeff's sink, early delivery for a fee (studio/reviews/economy-early-delivery.md, on
  the director's design, studio/reviews/director-early-delivery.md): 1.5% of the truck's price per week saved, read to
  the day, a floor of 300 FD and a cap of 9% (six weeks); expedite slots at half the trailing four weeks' deliveries a
  week, never under two; the bots expedite only past a 21-day wait and with two months of payments kept, else the
  fleets empty the pool; the fee a burn outside the cap's refill. It sinks about 50–60k FD a month at years 1 and 4,
  0.2% of the cap's budget: its worth is the choice and the honest date more than the FD. Engineering builds it behind a
  switch on these sizes; it comes to Jeff with its ruleset.
- 2026-11-10 — the economy's pair on the on-time hand-over (assets.swapAtNextIdle, 6fa465f;
  studio/reviews/economy-swap-at-idle.md; the loan rule and the starter's lot rig from stock on in both arms, ten seeds,
  1460 days): a hand-over rule the economy does not notice. Late hand-overs of a starter's replacement truck 58% → 36%,
  the days late a median of 5.5 → 1 (the worst 194 → 4), trucks still waiting past their day at day 60 13.5 → 0.3 a run;
  cleared loads 447k → 450k, the rate 3.76 both, the cap's paid freight 1,392M → 1,399M, bankruptcies 178 → 180,
  owner-operator liquidations 0.196 both. The gate reads nine of ten: seed 7's band at 0.837, three thousandths under
  the floor, on the seed that sits at the floor on every run of this code (0.843 the baseline, 0.840 the loan rule), the
  ten seeds' ratios within four thousandths of the off arm's: a different realization, not a mechanism. The economy's
  call, and the producer's: it rides in 0.24.1 as the eighth switch, as the fix to a date the game gives and did not
  keep; put to Jeff with the ruleset's contents, since his approval of 0.24.1 is still open.
- 2026-11-10 — the director's design for Jeff's sink, early delivery for a fee (director-early-delivery-2026-11-10.md in
  the shared folder; read, as the producer read it, as an ordered truck delivered sooner; a load delivered early would
  pay a carrier and is no sink). What can be expedited: a new tractor or trailer from the NPC dealer's queue, each its
  own fee; not a used-lot rig (from stock in a week under 0.24.1, and that week is the floor), not a player
  dealership's order (its own price, a transfer), nothing not on order. Offered on the Dealer's order sheet and then on
  the ordered truck's card, with the date without it, the date with it, the fee ("paid now, not refunded") and what
  waiting costs where the game computes it (the lessor's share, payments already due), never invented lost earnings. A
  fixed number of expedite slots a week nationally, apart from the ordinary queue, so nobody else's ordered date moves;
  paying takes the earliest open slot; the fee scales with the days saved, capped; never sooner than seven days from
  payment; payable after ordering; no refund. Iuliia prices both sides and recommends it only when the figures and the
  cushion say so, and never suggests buying FD to pay it. Bots use it under the same rule. The economy sizes the slots,
  the fee and the floor and reads the gate (a new sink refills the cap's budget); engineering builds it behind a switch
  after that; a later ruleset than 0.24.1.
- 2026-11-10 — Jeff: "Agreed, and let's add another sink: early delivery for a fee." (1) AGREED: a starter's used-lot
  truck comes from the lot's stock (usedMarket.npcLot.startersFromStock), on the economy's pair (the OPEN FOR JEFF entry
  below); it rides in 0.24.1, which is then seven switches: Send home back to work, turning an empty truck (with the
  red team's guard), one reach for bids, a night in town, the hand bidder's round, the worn-truck loan rule (the points
  on the company's age) and the starter's lot rig from stock, with the cross-engine fix. (2) NEW, Jeff's: a sink, early
  delivery for a fee, read by the producer as paying to have an ordered truck delivered sooner than the dealer's queue
  gives it (to be confirmed with Jeff). To the director for the design (where it is offered, what the player is told,
  whether paying moves others back) and to the economy for the size, the bots' use of it (the same rule for everyone)
  and the gate, since under the cap the NPC freight budget refills from sinks; behind a switch, a later ruleset. Jeff
  asked for 0.24.1 itself to be explained before he answers it; that approval is still open.
- 2026-11-10 — QA's replay of client batches 6 and 6b (qa-client6-2026-11-10.md, build 9f46d1f): every item passes,
  the director's order-today lines among them; QA's ordered truck was handed over two days after its date, as
  engineering's probe predicted. Its new findings are client batch 7 (the walkthrough's step 9 contradicting an order,
  "You can buy today" while a purchase is blocked by the leased truck's trip, a bid at the shown ceiling refused because
  the display rounds up, and smaller ones). One went to the economy and came back confirmed
  (studio/reviews/economy-weekly-spend.md): the ledger counts a truck bought from the dealer or the lot as that week's
  spending, in full, while a listing bought from another company is a transfer and is not, so the cushion read 0.4 weeks
  after a purchase and differs by route for the same truck; the same list feeds the holding cost's working capital, the
  season's carryover, the Reserve's cap, the prudent bots' floor and the guide's cushion, all sized as operating burn,
  and counting capital there shelters cash (the Reserve's cap 160k higher for four weeks after a 50k rig). The
  economy's fix, the producer's call to build: the ledger's not-an-outflow list gains the capital refs (a truck's or a
  facility's or a business's purchase and its tax, a listing's market fee), behind ledger.capitalNotSpending (off); a
  two-seed pair against the twin before it turns on; it rides 0.24.1 if it is built and reads clean before the cut,
  else the next ruleset.
- 2026-11-10 — OPEN FOR JEFF, with 0.24.1: a starter's used-lot truck from the lot's stock (usedMarket.npcLot.
  startersFromStock, 1633cc7; the economy's pair, studio/reviews/economy-starters-from-stock.md: the loan rule on in both
  arms, ten seeds, 1460 days). On: a starter's lot rig arrives in 7 days instead of 36–72 in the first quarter (33–37
  after), and the dealer's wait for everyone falls from ten weeks at the peak to five, since the rush was the starters'
  rigs in the queue; on the test page's world a newcomer is delivered 30–65 days sooner and no date slides. The cost:
  owner-operator liquidations 72 → 79 a run over four years (0.181 → 0.196 of the free path), loan defaults 158 → 206,
  seizures 71 → 110, the finding of 2026-11-03 back at its size, all of it on the greedy and random starters (median
  wealth 17k → 10k, 36k → 22k) and none on the conservative (liquidated 0.178 both, median wealth 22k → 31k): a truck
  five weeks sooner is five weeks sooner to be imprudent with. The economy is unchanged (cleared 448k → 447k, the rate
  3.73 → 3.76, carriers 77–89% of the twin's, the band 0.842–0.871) and the gate passes ten of ten. The economy's call:
  ride in 0.24.1; if Jeff keeps the queue as the brake on the imprudent, the economy's lines are the same either way.
  The spot check: the loan rule's gate stands on the age-keyed points (two of two seeds, the band 0.851–0.857).
- 2026-11-10 — the producer, on engineering's flag from the director's check (client batch 6b, 74ebc41): an ordered
  truck's due day never changes, but a truck that replaces the lessor's is handed over only at a day's close with the
  leased truck idle (dealer.ts deliverOrders), and a dispatcher rebooks the moment a truck goes idle: in a 60-day probe 7
  of 13 such trucks came late (median two days, at most sixteen) and 15 were still at the dealer past their day. The
  director's line: the date a player is given is the date the truck arrives, and a slip is a bug or a rule question.
  Treated as a bug in the hand-over's timing: engineering builds the hand-over at the leased truck's next idle once the
  order is due, behind a switch (off), and the economy reads it before a ruleset, since the bots' own trucks arrive on
  time under it and the sims move. Until then the client says the truth ("it takes over when the leased one is next
  idle").
- 2026-11-10 — the director, on the days-away count (the red team's 0.24.1 pass §2; for a later ruleset, since it moves
  the bots): a night at home is one day of recovery, not a reset. A night at home is the duty day closing with the truck
  at home (the economy's definition); passing through counts for nothing. The days-away count steps back one day for a
  night at home instead of adding one, and zeroes only on a full day off at home (24 hours off duty there); fatigue
  recovers one day's worth for a night at home and clears only with days off; hired drivers, an owner-operator and bots
  alike. A regional driver home three nights a week nets about one day out a week and never reaches the home-time
  threshold; a truck that touches home once in twenty days nets eighteen, tires, and owes its five days. Until that
  ruleset the "Back to work" button says nothing new (today's code still resets the count); then the writer adds "Back
  to work · no days off · your driver's fatigue carries on" and Iuliia names the trade on the truck card. The economy
  runs the pair when engineering builds it behind a switch, after windows batch 5.
- 2026-11-10 — the director, on a dispatcher that waits for the roll (the economy's rule for the clears-near ratio):
  the default bids now; waiting is a switch the player turns on ("Wait for loads to reach their usual price", off for
  everyone at first, offered by Iuliia once the player has seen a rolled load clear high), with a limit the economy
  sizes so a truck never waits forever. While it waits every surface says why, with figures: the idle reason ("Waiting
  on purpose: Dallas loads usually clear near 4.10/mi after about three rounds; your dispatcher bids at 18:00"), What
  now? as one action ("Bid now on Dallas → Tulsa at 3.10/mi (+X FD today), or let it wait until 18:00"), and Iuliia
  naming the trade ("Waiting usually pays about 4% more here, and the truck sits until then. Your call."). The sheet
  reads rates and clock times, never ratios and rounds ("Loads here usually clear near 4.10/mi by Wed 18:00 · this
  one's ceiling today is 3.10"), and says the figure comes from loads that rolled. And for the economy: under delivery
  windows loads no longer roll ten rounds, so a figure built from rolled loads goes stale the day windows go on; the
  waiting rule and its figure are sized on the windows build. The producer's consequence: freight.clearsNear.ratio and
  the waiting switch ride the windows ruleset, not 0.24.1 and not one between.
- 2026-11-10 — the economy's calls on the red team's 0.24.1 findings (studio/reviews/economy-redteam-0241-calls.md), and
  the producer's on the ruleset's contents. (1) The loan rule's ten new-business points are keyed to the company's age
  alone, the authority under a year, whatever it owns: what a lender means by time in business; the wreck-first dodge
  closes; the gate pair stands (a first truck is identical under both forms, only a second financed truck inside a
  company's first year changes). Engineering makes it. (2) "Usually clears near" as a ratio is true as built and stays
  (Dallas loads really clear at 1.4–1.9 times their reference after rolling; neither of the red team's forms helps);
  what is wrong is the default bid, min(figure, ceiling), which takes every fresh load at its ceiling while the patient
  bot is paid more for the rolled ones. The economy's rule: under the clears-near mode the dispatcher places no bid this
  round on a load whose figure sits more than freight.clearsNear.waitOverCeiling (5%) over its ceiling, and the table
  carries the mean rounds to a clear so the sheet can say "near 1.6× after about three rounds". A dispatcher that
  declines to bid changes what a player sees their truck do, so it goes to the director first, then engineering, then
  the economy's trucker's-month probe. THE PRODUCER'S CALL: freight.clearsNear.ratio stays off in 0.24.1 and rides a
  later ruleset with that rule; 0.24.1 is six switches (Send home back to work, turning an empty truck with the red
  team's guard, one reach for bids, a night in town, the hand bidder's round, the loan rule keyed to the company's age)
  and the cross-engine fix. (3) The fatigue reset: the economy would reset the days-away count on a night at home (the
  duty day closed with the truck at home), not on a pass through and not only on a day off; with the director, for a
  later ruleset.
- 2026-11-10 — the red team's pass over the 0.24.1 set (studio/reviews/redteam-0241.md; seven rules behind switches):
  one hole the ruleset closes before it turns on, and three notes. THE HOLE: turning an empty truck starts a new leg at
  the nearest town and the night-in-town rule reads "a leg's start", so a company that chose the town turns its truck an
  hour before its hours run out and sleeps there with no ticket (two shoulder nights and 500 FD of fines became none on
  the probe); engineering guards it (the town night only for a leg the truck began idle at that town). THE LOAN RULE'S
  DODGE: the ten new-business points end the day any truck is owned or ordered, so a 9.6k wreck bought and resold costs
  about 1.2k and takes 18.2k off a new rig's cash at signing; the economy chooses the key (the company's age alone, or a
  truck owned thirty days or in service) and engineering makes it. THE CLEARS-NEAR LEVEL: nobody can move the figure
  for others, but at a thin hub it reads 1.3–1.9 times the reference all year, because loads that clear after rolling
  clear at walked ceilings and are written against the posting reference, so the client's default dispatcher bids the
  ceiling on every fresh Dallas load; the economy calls the form of the fix and whether the switch rides in 0.24.1.
  FATIGUE: a pass home with no day off zeroes the days-away count, today's rule, which Send home back to work makes one
  click; a rules question for the director and the economy, for a later ruleset since it moves the bots. No exploit in
  the one reach for bids, the hand bidder's round, turning alone or a night in town alone. The producer's consequence:
  0.24.1 waits for the guard, the loan rule's key and the economy's word on clears-near, then QA's replay on the test
  page, then Jeff's word for the live restart.
- 2026-11-10 — the economy's second reading of delivery windows, on batch 4 (studio/reviews/economy-delivery-windows-
  batch4.md; ten seeds, 1460 days): most of the way back and not there. Against the off arm: cleared loads −5% (the
  first sizing −22%), NPC freight pay −13% (−42%), the rate −7% (−19%), bankruptcies 243 a run (488; 185 off), the gate
  six of ten (none), the four fails on the band's floor with every other line passing; a newcomer's month at Dallas +15%
  on today's; release on a breakdown works (1,354 releases against 618 no-shows; 2,017 no-shows before). What stops
  short is the carriers' income: direct NPC freight clears at 2.92 a mile against 3.57, owner-operators' profit per
  truck-week −22% and fleets' −38%, loan defaults doubled. Two causes, measured: the memory's lift on a hub's reference
  is capped by rates.ratioClamp at ×1.38 (at a top of 6, ×1.87, pay, rate and cleared loads come back within 3%); and
  the carriers then receive 81–84% of the cap's freight money against 94%, because a facility's sale value reads the
  same reference the memory lifts, so the bots' facilities' goods inflate with it and take the budget (2% of the cap's
  pay to 6–10%), and the brokers' fall-off on loads lost at the close goes 26M to 72M. The producer's call, on the
  economy's sizing: windows batch 5 behind the same switch, windows.ratioClampTop 6 and the facilities' sale value
  reading the reference without the memory; nothing on the fall-off yet; then the ten seeds again with the carriers'
  share of the cap's pay at 90% or better and their profit and the fleets' truck count within the off arm's range as
  added targets. Windows stay out of 0.24.1. A correction the economy made to its first sizing: its "NPC pay" was the
  NPC faucets in all; the gate reads the cap's paid total, and the direction was the same.
- 2026-11-10 — the economy's gate pair on the worn-truck loan rule (studio/reviews/economy-worn-truck-loans-gate.md; the
  rule as built in ad349e3, ten seeds, 1460 days, each against its cap-off twin): the market with the rule on is the
  market with it off (cleared loads 448k against 447k, the mean rate 3.72 against 3.73, NPC freight pay (the cap's paid total) 1,379M against 1,381M,
  companies bankrupt 178 against 185); the equipment-sink coupling feared from the bound arms does not appear (the bots
  buy the same trucks a few weeks later); loans written −7%, defaults −9%, FD written off −17%; the free path's median
  first truck 30 → 49 days, and on the test page's world a route to "You can buy today" opens on day 25 instead of 16.
  The gate reads eight of ten: seeds 7 and 8 fail the band's floor by 0.002–0.005, and the baseline on the same code
  passes ten of ten with those two seeds at 0.843 and 0.840, so the fails are the floor's margin, not the rule (it moves
  them by 0.002–0.003). The economy recommends the rule ride in 0.24.1 with the five switches of c1af286 and the hand
  bid, at the one restart; windows stay out. OPEN FOR JEFF with the 0.24.1 decision: a gate that reads eight of ten on
  the calibration he approved. Also found: the dealer's queue, which a starter's used-lot rig still waits in (the call
  of 2026-11-03), peaks at ten weeks in the first quarter's order rush and settles at five; with the loan rule the brake
  at its cause, the economy recommends a starter's lot rig come from stock in the lot's own days, to be read on a pair
  once engineering gives it a key (usedMarket.npcLot.startersFromStock, default off); switching it on is a rule change
  for Jeff.
- 2026-11-10 — the director, on QA's replay of client batch 5 (qa-client5-2026-11-09.md; items 1–4 passed): "You can
  buy today" only for a truck that delivers today; a truck from the queue reads "You can order today · delivered Apr
  19" on the card and in Iuliia's line, and What now? counts the wait ("Your truck arrives in 68 days; until then the
  leased one runs"); before the order the date may move with the queue, after it the date given is the date the truck
  arrives (if the engine can slip an ordered truck's date, engineering flags it: a bug or a rule question for Jeff). The
  wait is said, not counted: the one figure stays the least cash needed today; a second line names a truck that
  delivers sooner ("Or a dry van, 7.2k today, delivered today"), and Iuliia prices the wait in figures ("Waiting to Apr
  19 keeps the lessor's 15% for 68 days, about X FD"). The trailer type is said when it does not match the company's
  freight ("…a reefer, 480k miles, 48%; your company hauls dry van"). QA's seven smaller findings are client batch 6.
- 2026-11-09 — Jeff: "Yes, build it", the economy's worn-truck loan rule (studio/reviews/economy-worn-truck-loans.md; the
  OPEN FOR JEFF entry below), behind equipmentFinance.purchase.collateral, default off: the purchase loan reads the truck
  as well as the borrower (down by age over three years and mileage over 300k, capped at 50%, ten points more for a
  company under a year old that has never owned a truck; declined past ten years or 700k miles, "cash only" with the
  figure; the term ending by the truck's seventh birthday, never under 26 weeks; the rate rising with age). Engineering
  builds it after windows batch 4; the economy runs the ten-seed gate pair on the built rule against its twin (the
  coupling to watch: fewer and later truck purchases are fewer equipment sinks for the cap's budget); then it rides in a
  ruleset at a restart with no players. The harder pacing option (no purchase loan in a company's first three months) was
  not taken.
- 2026-11-09 — Jeff: "Yes, allow it", the same-day premium of 1.10 on loads posted for pickup the same day, as a market
  rule (a shipper pays more for a truck today than for one next week), for windows batch 4. The director the same day
  confirmed the economy's batch 4 with amendments: (1) the hub's ratio remembers loads lost at the close, but only NPC
  postings count toward the memory, since a player brokerage or shipper could otherwise post cheap loads to be lost and
  raise a hub's rate at will (the red team adds that attack to its windows list); (2) pickupHours 24/48 and urgencyRounds
  4, amending the two-round call (four steps reach about +46%, true of a load nobody will cover at its deadline), the
  guards standing (never over the walked ceiling, player posters' pay never walks; the red team retests urgency farming
  at these sizes); (3) release on a breakdown that breaks canMake for the load booked ahead, under the rule that nothing
  happens to a company the player did not set up: with the dispatcher on it releases at once at the early share and
  Needs you reports it with the claim and why; with the dispatcher off, or a hand-booked load, Needs you asks first with
  the figures ("Truck 2's breakdown means it can't reach Tulsa by 14:00. Release it now (−X FD) or keep it."), and an
  unanswered ask becomes a no-show at its share; the bots release. For the guidance spec when batch 4 is scheduled: a
  hub's rising price as Iuliia's reason to move, the release decision under the Needs-you item, and a load lost at the
  close that the player bid on ("No carrier took it by its pickup; it's gone, not reposted").
- 2026-11-09 — the economy's item 4 sizing batch (studio/reviews/economy-delivery-windows-sizing.md): delivery windows as
  built in batches 1–3 (a644f14, 584f920, ea48c67) and sized fail the gate on all ten seeds and halve the bot economy
  (72% of posted loads lost at the pickup's close, cleared loads −22%, rates −19%, NPC pay −41%, bankruptcies 185 → 488;
  the cap-off twin collapses the same way), because today's price discovery is the pile-up and the slide and a windowed
  load that does not pay at posting holds flat, steps twice and is lost, so nothing learns the freight went unhauled.
  What works: 70% of wins booked ahead, on-time 0.72 → 0.81, claims 0.15% of pay, locals' share unchanged. Consequence,
  the producer's: windows.enabled rides in no ruleset until the engine prices unserved demand and the ten seeds pass;
  0.24.1 carries the five switches of c1af286 and the hand bid alone. The economy's fix for a windows batch 4 (the
  director's design word asked): the hub's load-to-truck ratio remembers loads lost at the close over the trailing week,
  decayed, so refRate rises where freight goes unhauled; pickupHours 24/48 and urgencyRounds 4 as the changed sizes;
  the dispatcher and the bots release a load booked ahead when a breakdown breaks canMake for it (the cancel claim),
  instead of a fault margin or 2,000 dead loads a run. OPEN FOR JEFF: a same-day premium of 1.10 on loads posted for
  pickup the same day, as a market rule (a shipper pays more for a truck today than for one next week) rather than a
  fallback; the economy asks for it alongside the ratio fix. The bond cap's call stands. Then the ten seeds again, the
  target the off arm's cleared loads, NPC pay and rate within seed range, lost under a quarter of posted, the cap binding.
- 2026-11-09 — OPEN FOR JEFF: the economy's worn-truck loan rule (studio/reviews/economy-worn-truck-loans.md), on the
  director's suspicion from the day-2 Dealer. Today the purchase loan reads the borrower's credit only (down 10–20%, 0.2–
  0.4% a week, 104 weeks) and never the truck: a 500k-mile reefer and a new Workhorse get the same down, rate and term, and
  no age or odometer refuses a loan; a day-2 company's 14% down puts QA's 17.8k listing at 4,620 FD cash on the day. Real
  lending (eleven sources in the note): 25–35% down on a worn truck or a thin-credit startup, a premium or a decline past 7
  years or 500k miles, many lenders stopping at 700k, terms shortening with age. Proposed, behind a switch
  (equipmentFinance.purchase.collateral): down = the credit share + 3 points a year of age over 3 + 3 points per 100k miles
  over 300k (cap 50%) + 10 points for a company under a year old that has never owned a truck; declined past 10 years or
  700k miles ("cash only", with the figure); the term ends by the truck's 7th birthday, never under 26 weeks; the rate
  +0.03% a week per year of age over 3. QA's listing then takes 33% down, about 7,670 cash on day 2; a new rig 24%. At the
  diary's pace the listing route moves from day 2 to about day 5 and the new-rig route from about day 12 to 18: the rule
  makes the loan true, it does not by itself make the first truck hard (the harder version, no purchase loan under three
  months of authority, is in the note as Jeff's pacing option, not the economy's recommendation). Bots, bounds on today's
  keys (730 days, seeds 1–2): the free path's median first truck 28/51 days → 44/82, loans written halve, defaults −19–38%,
  write-offs −45–64%, liquidations flat, profit per truck-week within ±4%; one coupling for the gate: NPC pay −3.4–5.0%
  (fewer equipment sinks refill the cap's budget), to be read on the built rule's ten-seed pair against its twin before any
  ruleset. Order: Jeff's yes, engineering builds it behind the switch, the economy runs the gate pair, then a ruleset at a
  restart with no players; independent of windows. The first-truck figure itself stays true.
- 2026-11-09 — the director, on QA's replay of client pass 2 (qa-client2-2026-11-09.md): the Dealer opened on day 2 in
  both worlds with "You can buy today", because a worn listing (462k–502k miles, 47–52% condition) needs under 5k FD cash
  on the day. Ruling: the figure stays true and so does "You can buy today" (it answers "can I buy?", and a beater as a
  first truck is a real and risky choice); the Dealer card names what it prices ("the cheapest truck for sale: a 2014
  reefer, 480k miles, 48%") and Iuliia's advice line names the catch with figures, not taste ("That one's 480k miles at
  48%; expect about X FD a month in repairs. I'd wait for a sounder one.", X the engine's wear figure); never a floor on
  condition behind the figure, which would make it false. For the economy, not the batch: buying on day 2 sits badly
  with Jeff's ruling that the first truck is hard to get; the falsehood is likely in the loan (real lenders want far more
  down on a 480k-mile truck, or will not finance it), so the economy checks the down payment and terms on worn trucks
  against real lending; if they are off, the fix is a rule change for Jeff and a ruleset. QA's replay otherwise passed
  all nine items; its three smaller fails go into client batch 4.
- 2026-11-09 — the economy's look at the locals-first change (studio/reviews/economy-locals-first.md): the rule Jeff approved
  is what the engine already does. A locals-first load is held for local carriers for one clearing only
  (leverage.localRounds 1) and opens to every dispatcher and bot at the next; the ten-seed cap runs are runs of this rule,
  so it moves no sim and needs no ruleset. The gap behind the Palm Coast diary is the hand bidder's round: place_bid
  refuses a bid on a locals-first load in the interval before it opens ("first call this round"), so a player's first
  clearing comes a round after the bots', and the opened loads had cleared to the visiting bots' dispatchers before the
  player could file. The build is therefore small: accept a hand bid on a locals-first load in the round before it opens,
  held for the opening clearing (the bots' filter unchanged, so the digest is identical), behind its own switch, default
  off, riding with the five switches of c1af286 in 0.24.1. One round stays the hold (two rounds give locals two points of
  their hub's locals-first loads and nothing of all wins). Under delivery windows the one round after posting stays as
  batch 1 has it; anchoring the opening to the urgency rounds would hold a lead-three-day load for locals through about
  seven rounds and leave visitors the walked leftovers, so that part of the recommendation is not built; the director confirmed the economy's version the same day
  ("holding it longer would make the rule the trap I asked to remove"; the urgency walk stays its own rule) and gave
  Iuliia's line for a filed bid, for the guidance spec when the switch is scheduled on. Red team: letting loads lapse buys nothing cheaper; a one-truck company based at any of the fifty hubs
  without bot carriers has an uncontested first call on 38–53% of its loads, the intended play.
- 2026-11-09 — Jeff: "agreed", on the director's recommendation from the diaries (the cautious owner-operator stranded at
  Palm Coast, seeing loads it could not bid on): a load a shipper offers to local carriers first, which no local carrier
  took in its first round, opens to everyone from its next round; under delivery windows, once it is in its urgency
  rounds. A market rule, so it goes to the economy for its look (the bots take the opened loads too, so the sims move)
  and lands in a ruleset at a restart with no players; engineering builds it behind a switch after windows batch 2.
- 2026-11-09 — the director, on the board's suggested bid (client pass 2, QA's replay finding 4; engineering's objection
  upheld): the brief's "a suggested bid never exceeds Book now" was wrong, since a bid pays the bidder's own rate and a
  booking at Book now takes the load first, so a bid capped there is Book now that also waits for the round. The default
  bid sits at what the load usually clears near, never over the ceiling and never under break-even; when the usual-clears
  figure is at or under Book now, or under break-even, the sheet shows no suggested bid, only Book now and an empty bid
  field, and Iuliia's line says booking is the better call. Under a suggested bid the line reads "A gamble: pays N FD
  more than Book now if it wins at HH:MM. Anyone who books first at R takes it." (the bid's gross less Book now's, the
  round's time, Book now's rate); no odds unless the engine computes them from real clears. A default bid is never placed
  for the player. Engineering applies it as client pass 2b; the capped version is in f10a59e until then. The same day:
  engineering's rules batch (c1af286) put five player-facing rules behind switches, all off, each waiting for a ruleset
  and Jeff's word before it turns on: "usually clears near" as a ratio to the load's reference (the economy's rule), Send
  home back to work, turning a truck running empty, one reach for a bid and Book now, a legal night in town.
- 2026-11-09 — the director, on QA's replay of the diaries' batch and the writer's pass: (1) the one figure for the first
  truck is the cash the cheapest truck takes from the player on the day (down payment, fees, anything due at signing; the
  loan covers the rest) against what the player can put toward it, named "To your first truck: N FD" and "You can buy
  today" once met; the Dealer opens on that same figure; the cushion is Iuliia's advice under it, never part of the
  figure; one function feeds the teaser, her page and the Dealer's card. (2) "Send home after this run" (the writer's
  wording, true of a loaded and an empty truck); the queued line and the toast say what was chosen: "for days off" only
  after "Home time", "home after this run, then back to work" after "Send home · back to work". The browser's seen and
  visited marks are the same leak as the inherited cards: a new world starts with none.
- 2026-11-09 — the director's calls on the five player diaries of 0.24.0 (play-2026-11-09-*.md in the shared folder), for
  engineering's client batch, which the producer put ahead of delivery windows batch 2 because the diaries found first-hour
  and first-truck blockers on the live ruleset. (1) The Dealer opens the moment the first truck is affordable (or the deposit
  gap closes), whatever the walkthrough's step; a skipped step never keeps a tab closed and no tab ever vanishes from More;
  before then the Dealer is a teaser with the price; and Iuliia never names an action whose screen the player can't open.
  (2a) "Stranded" is a What now? state of its own, naming the cheapest exit with its figures, then the next; the ways-out
  sheet carries the exits first and the board below, never an empty board alone; "pick the next load" with nothing to pick
  and "5 loads pay enough" against an empty board are false and go with it. (2b) Send home never gives time off nobody asked
  for: an owner-operator gets "Send home · back to work" (repositions only) and "Home time · 5 days off" (the days on the
  button); a hired driver's home-time rule stands. (2c) The director's recommendation, not his to switch on: a locals-first
  load that rolled over once opens to everyone from its next round (with delivery windows, once it enters its urgency
  rounds), because a broker whose locals pass widens the net and the rule as built makes a thin town a trap; a market rule,
  so it needs Jeff's yes, the economy's look in its next batch and a ruleset. (3) Send home on the road: on any truck,
  whenever the player asks; empty or repositioning, "Send home now" with the miles, the FD and the days; loaded, "Send
  home after this delivery", queued; with a load booked ahead (windows batch 2) a warning of that load's cancel claim; the
  24 days out stays the rule for a driver's own demand; a visible button stays pressable (the Day-in-2-s re-render is a
  bug). One cash figure everywhere, and a warning before net-30 takes a fleet below zero, need no call.
- 2026-11-09 — Jeff: "Let's make the repo public", then "Public now" after the producer's facts: GitHub had refused
  the day's CI run over the account's Actions billing (about 200 runs and 1,800 minutes since November 1 on a 2,000-minute
  free plan; a private repo's minutes are paid, a public repo's are free). The 511-commit history was scanned first:
  no keys, tokens, env or credential files, no personal strings; the CI deploy key lives in GitHub's secrets. Accepted
  with it: the studio folder is public (the bible, the decisions, the handoff, the 68 reviews with the red team's
  attack analyses and their figures, the economy's cap sizing and gate), with Trucking Terminal's themes and logo and
  the NPC name lists before the trademark search. The alternative offered, a self-hosted runner on the Mac Studio,
  was declined. TruckingTerminal/lanes is public from 2026-11-09 15:10Z; the refused run was re-run and started.
- 2026-11-09 — Jeff: "Approved on all 3. Go", on the three decisions put to him in depth (the gate's calibration
  from the first ten seeds, band floor 0.84 from year 4 and the carriers' line 72% at year 3 and 75% at year 4; the
  fixed 5M-a-month subsidy as the supply curve, 36M to open, 271M by year 4, the 600M spent in month 114; the word
  for 0.24.0). Done the same day by the producer: ruleset 0.24.0-phase0.40 (6f1a397): the emission cap on in the
  live levers with the economy's block (economy-emission.md §16.7), a driver sent home while the truck is moving
  (labor.sendHomeWhileMoving) and the board's "usually clears near" weighted by time
  (freight.clearsNear.halfLifeDays 1); the test page deployed from it; the live page rebuilt from it and
  republished (artifact version 50 (1794234575-7a38)); the live world restarted with no players (world/meta v29: seed
  477630989, epochMs 1794013175000, ruleset lanes-live-1/0.24.0-phase0.40). The economy and the red team drop to high: the
  design work is done, what remains is running and reading. Found on the way, by the two web tests that failed on
  the new levers: under the cap's warm start (half NPC volume for the world's first seven days, which lands month 1
  on budget) a new test world's opening board at day 2.25 had 0 to 13 paying loads within 300 miles of LAX (cap off
  20 to 59), while from day 10 it reads 37 to 137 (cap off 128 to 332): a week-one effect of a board still filling,
  not the cap's steady state. The rules stand. The director amended ruling 5 of 2026-11-02 the same day: a new test
  world opens at 06:00 of day 10 (246 hours) instead of day 2, the company still joining as a round clears, nothing of it shown
  to the player as a warm week (engineering, 75d61df); the live world's epoch was set 246 game hours before the
  publish, so it too opened at 06:00 of day 10, past its warm week, with no players in it. Next: the red team's pass over 0.24.0 on main, the player diaries (item 9), the economy's claim
  sizes for item 4, then engineering's item 4 batch 1.
- 2026-11-08 — the producer, on Jeff's "I trust you", after the first ten seeds of the gate (economy-emission.md §16.7;
  reversible before the restart): the gate's calibration moves one step. The band's floor is 0.84 (read from the fourth
  year, never lower) and the carriers' line reads 72% of the twin's at the end of year 3, while the cap is still
  releasing, and 75% at the end of year 4; cleared loads and the debt line stand. Why: on the fixed 5M curve the ten
  seeds describe a healthy capped world (carriers 74–90% of the twin's hauling 93–106% of its loads, debt at the twin's
  level, the cold start inside its budget, no band reading under 0.84), and the gate as first set failed seven of them by
  one or two points, because the band and the floor pull against each other by construction (more subsidy, more
  carriers, a lower ratio) with a window a point wide, inside seed noise. The freed cap reads a point or two under its
  twin on every seed: fewer carriers haul the same freight and each keeps a little more. Starvation still fails by
  twenty points. The step is recorded as the calibration from the first ten seeds, with the twin-relative reading
  reported beside the band for the next one. Jeff to confirm before 0.24.0.
- 2026-11-08 — the director's calls on item 4, delivery windows (engineering's proposal; the note
  director-item4-calls-2026-11-08.md in the shared folder), on Jeff's standing word that the director decides design:
  (1) past the latest delivery time, a late claim plus the reputation hit, never a refusal (refusal stays where it is:
  perishables that spoil); the claim's size is the economy's, as one flat share a player can read in advance. (3) The
  urgency walk is today's +10% step, applied only in the last two rounds and never over the walked ceiling. (4) Hot
  loads keep their draw for this item; deriving hotness from the window comes later as its own proposal. (5) Bots book
  ahead under the same canMake, the same two-deep limit and the same claims. Question (2), the claim sizes, waits for
  the economy after the gate. Three new What-now states for the guidance spec when batch 4 is scheduled.
- 2026-11-08 — Jeff, on the economy's item 1 (the emission cap retune, studio/reviews/economy-emission.md "Retune"):
  (1) The first truck is hard to get, as in the real world, and the economy is never tuned to it ("the days to acquire
  it should not really have an effect on the economy… Make the first truck hard to acquire just like in the real
  world"); buying FD is what gets a truck faster. The bible's week-one line no longer promises an owned truck inside
  the first game month (edited by the producer on Jeff's word; the writer polishes it in item 7), and the first-truck
  pacing guard leaves the gate, reported only. (2) The gate's band is the corrected ratio (the NPC advance and its
  repayment out of both sides), read over the trailing four quarters, in [0.85, 1.00] from the third year, as the
  check on the rules; the check on the cap is a set of floors read at the ends of years 3 and 4 against a cap-off twin
  of the same seed on the same code (carriers in service and cleared loads a day at or above 75% of the twin's;
  companies' debt in FD within a multiple the economy sets from the twins), plus a cold-start line (month 1 commits
  at most 110% of its budget); supply, spread and free path as before; ten seeds, cap and twin, twenty sims in two
  waves. (3) The schedule is the refill design: the budget re-emits the trailing sinks net of the other faucets plus a
  published subsidy (3M a month decaying 5% a month, 60M in all, after a 36M opening month); a fixed decay is not a
  mechanism, since at the lever floors it starves the world; the 1B cap is structural; the reserve's remainder is a
  cushion that only a future decision touches. Jeff: "I approve of all 3 of your calls. Think about them one more time
  before committing and if you still feel it's the best way to go, do it. I trust you." The producer re-thought them
  and confirmed all three. Open before the gate runs: the economy's two-seed re-run of the recommended levers on the
  corrected refill base, which prices the 60M subsidy in liveness.
- 2026-11-02 — Jeff's answers to the bible's questions: (1) the pitch and the feeling stand for now, the feeling
  stated as "real accomplishment from your decisions and grinding"; (2) the token surfaces may stay on the beta
  screens for now, since nobody plays until the Mac mini server; (3) YES to the dispatcher idle for a one-truck
  company until the first hand-booked load (a rule change: the economy designer sizes it, then a ruleset bump and
  a restart with no players); (4) the tabs that matter come first and the rest stay visible as teasers, "coming
  soon" (this overrules the bible's position against locked teasers); (5) beta one's people come from Jeff's
  freight list, with crypto people if he can; (6) the theme picker goes for now; (7) the Back Lot teaser tab stays;
  (8) the end-of-session feeling: yes. Still open: the title cycle push.
- 2026-11-02 — Sprint 1: the first ten minutes, built on the test page (the server gates real players, so it runs
  in parallel as engineering's next design); the economy designer sizes the dispatcher rule and the first board.

- 2026-11-01 — The live world restarted on beta one: page version 37 (Iuliia, the parallax title, the Report
  button's store rule), world/meta version 21, seed 614203851, ruleset 0.19.1-phase0.30, no players.
- 2026-11-01 — The roles got their own sessions (director, UX, QA, writer, engineering; art already had one);
  models: Fable for the director and the writer, Opus for UX and engineering, Sonnet for QA; the plan is Pro, so
  roles run a few at a time.

- 2026-11-01 — Studio formed: eight roles, one point of contact (the producer), a weekly loop with a review
  gate; sprint 0 is the slop audit and the bible.
- 2026-11-01 — Beta one: the trucking sim opened in layers (businesses day 28, re-brokering day 91), crews off
  until the Back Lot leaves the simulator; ruleset 0.19.1; on the test page, not yet on the live world.
- 2026-11-01 — The team allocation 15% of the cap, six real months then four years linear; the tranche 40M.
- 2026-11-01 — Iuliia: Russian, classy, an executive, long flowing hair, brown eyes; drawn and on main.
- 2026-11-02 — The first bid by hand is on: a one-truck company's dispatcher waits until its owner bids or books
  once by hand (Jeff's yes; economy's v55-a found no cost the batch can see). Ruleset 0.19.2-phase0.31; the live
  world restarts with it on the next republish. Chicago's May board is the director's call (economy-first-board.md).
- 2026-11-02 — Jeff: the title screen is only a login screen with nice animations. The starting hub is chosen
  inside the world on first entry, where the player sees the map, the date, the freight and the hubs' numbers
  before starting; Iuliia guides everything once inside. S0 and S1 of the first-ten-minutes spec go to draft 4
  (director); engineering's step 3 reshaped to it.
- 2026-11-02 — Jeff, on the map: the clouds take too much of the screen and the other trucks are too faint and
  small to read; the weather becomes a hint, the AI trucks go to 80% and get a minimum dot size zoomed out so
  the interstates look busy, and the player's trucks stand out above both. Overrides draft 4's "AI carriers at
  35%". Engineering, with step 5.
- 2026-11-02 — Jeff: the recommended starter hubs are not a fixed best-on-average three; the first entry rings
  the hubs with the best freight for a new carrier at that moment of the game year, read live from the boards
  (the season measure), so Chicago is ringed in September and not in May. Replaces the director's fixed Dallas,
  Los Angeles, Phoenix (ruling 4), which stays as the tie-break and the fallback when the reading is not ready.
- 2026-11-02 — Jeff, factoring and quick pay: Iuliia explains both to an owner-operator about to buy a truck;
  the risk is real and they must be well capitalized. A factoring contract lasts three full game months and
  covers every truck in the fleet; the rate is a straight line by fleet size, 6% at one truck down to 1.5% at fifty,
  set at signing and re-read at each renewal.
  No pools for now: factoring and insurance are NPC, and their fees are sinks. Economy sizes it behind a
  switch; the writer words the step; engineering wires the contract into Getting paid after.
- 2026-11-02 — Director: Finance opens on the same trigger as the Dealer, when walkthrough step 9 ("Your first
  truck") becomes current, so Iuliia's explanation of factoring and quick pay never points at a locked tab.
  Engineering takes it into the step that wires Getting paid.
- 2026-11-02 — Jeff, factoring, amended: the carriers' rate floors at 2.5% at fifty trucks (linear from 6% at
  one). Brokers can factor their receivables too, at a flat 5% whatever the volume: a broker is a capital
  depot and does not scale with factoring. Both under the economy's switch; both fees refill the reserve.
- 2026-11-02 — Jeff: a public Intel tab, every company visible to everyone: trucks, drivers, authority age,
  home hub, Miles, the safety, insurance and credit bands, last month's revenue and hauls. Live cash stays
  private. The director writes the page for sprint 2.
- 2026-11-02 — Jeff: the title's head-on shot keeps the painting's lane (the truck comes on the right). The
  traffic pass goes a third round: vehicles must pass the camera at full size with wheels, bounce and lamps
  that read, headway kept in time so nothing overlaps at any depth, tumbleweeds off the road.
- 2026-11-02 — Jeff: a population dial. The loads-per-truck ratio stays within a band so the game always
  welcomes new players; the dial acts on the simulated carriers, never on freight, so it adds no faucet; the
  band is wide and the dial slow, so boom and bust cycles persist and prudent players win in the long run.
  Economy builds it behind a switch and sizes it with a join wave (v57) after factoring.
- 2026-11-02 — Jeff: a red team role (studio/roles/redteam.md) that tries to exploit, break and game the
  rules; it runs once a day while rules are changing, not on every push, and as the last step before any
  republish. First pass once factoring and the population dial are in, so one pass covers both.
- 2026-11-02 — Jeff: the pools come off the Finance tab for a long time; Finance holds Getting paid, credit and
  the staking discounts. Staking reworked: no stake gate on fleet or facility size (truck prices are the entry
  fee); a stake is a lock with a term, the discount set by the term and held for the term on purchases and the
  running costs it covers; leaving early forfeits a slash, a multiple of the discounts taken plus a base,
  burned. Economy builds it behind a switch.
- 2026-11-02 — Jeff: four tractor makes modelled on Freightliner, Volvo, Peterbilt and Kenworth under fictional
  names, with their own prices, economy, upkeep, breakdowns, driver appeal and depreciation; trailers unbranded,
  by type. A teaser for PvP on the Back Lot's coming-soon card. Iuliia speaks differently by tab and by button
  or card, humor allowed. All sprint 2; the director plans it after the gate.
- 2026-11-02 — Jeff: three truck makes, not four, one per tier: Keystone the workhorse, Meridian the economical
  highway truck, Ironwood the premium driver's favourite (the Peterbilt and Kenworth of it in one make).
  Westmark dropped. Names pending counsel's trademark search.
- 2026-11-02 — Jeff: the title's head-on shot keeps the painting's rig fixed in frame and moves the world
  past it in perspective, as the side view does; oncoming traffic sparse or none, nothing drawn as a still in
  motion. The approaching-vehicle work stops. Both shots 30 seconds.
- 2026-11-02 — Jeff: traffic drives in the correct lane in both title shots, on the right as in the USA; this
  supersedes "keep the painting as is": the head-on shot is mirrored, with the diner's sign redrawn to read
  forward.
- 2026-11-02 — Correction (the producer misread Jeff): the head-on shot is NOT mirrored; the painting's
  orientation and lane were right. The side view's rig faces right in the bottom lane, oncoming traffic in the
  top lane moving left, as it was. The fix the head-on shot needed was the roadside moving with the road.
- 2026-11-02 — Jeff ("go with your recommendation for all 3"): (1) the live world is republished now from main
  with the factoring contract and the population dial switched on (ruleset 0.20.0-phase0.33, live.ts; demand no
  longer scales with the carrier count) and the lock discounts off until a four-year batch has run; no players,
  so the restart costs nothing. (2) Prudent-versus-greedy: option A first, the conservative bot made a prudent
  businessman rather than a timid one, then B (loan rates by leverage and a bust covenant, behind a switch) only
  if the pair still shows the greedy bot ahead. (3) The Back Lot card takes the director's softer line: player
  against player, the gate and the cameras stay; the hiring and the temptation go.
- 2026-11-02 — Jeff (a Staff screenshot: two driver faces for the whole roster, "Tanya Mills" on the man's,
  "Earl Kowalski" on the woman's): new driver portraits, a set of them, and men must have men's names and women
  women's names, the portrait matching. Art paints eight of each look; engineering splits the name list by look
  and stores the look on the person, no replay change.
- 2026-11-02 — Jeff, on the broker path: "Brokerages and carriers should be different companies. Each player can
  have 1 of each at most." So a player's brokerage is a second company formed as a broker, not a desk inside the
  carrier; one carrier and one brokerage per player. The director writes the rule brief (forming it, the bond and
  licence at day 91, the two companies under one login, self-dealing between a player's own two companies, Intel
  and the ladder), the economy sizes it after the prudence pair, then UX, the writer and engineering; a ruleset
  bump and a restart while the world has no players.
- 2026-11-02 — Jeff, two rules for the brokerage: (1) a carrier with a brokerage arm may broker the loads a
  shipper tenders DIRECTLY to it (never a load it took off the board), with every brokerage requirement standing,
  the bond first; (2) a player's brokerage that receives direct shipper freight may tender it straight to the
  player's own carrier without posting it on the board. This replaces the brief's "own carrier only through the
  board". Producer's guard, to the economy: the hauler's pay on such a tender stays inside the lane's band, so the
  tender channel can't move money untaxed; a load counts once per person. Jeff asks whether the two companies may
  transfer FD to each other and whether to tax it: the producer recommends yes, both ways, as the owner's capital
  (equity, never revenue), guarded, with a 1% fee to the reserve; Jeff to confirm the fee.
- 2026-11-02 — Jeff: FD transfers between a player's own carrier and brokerage are allowed both ways, as the
  owner's capital (equity, never revenue), guarded, with a fee of 3% to the reserve ("higher than 1%; let's do
  3%"): `brokerage.transferFeePct` 0.03.
- 2026-11-02 — Jeff ("go with your recommendation for both"): (1) the hoarding tax stays, but on hoards, not
  cushions: the Reserve, a sheltered account up to thirteen weeks of the company's own spending, no fee, no
  yield, counted toward credit, withdrawable any time with a one-day settle; above the cap the season burn and
  the holding cost apply as today; the economy builds it behind a switch, sizes it, and measures running the
  weekly holding cost in both phases in place of the year-end burn (conditional on the sink-to-faucet target
  holding). (2) Step 9 keeps the rule: no easier first truck; the step reads the exact gap from the Dealer and
  advances when either route opens; the economy checks the used lot's restock cadence so a lessor rarely waits
  more than a game week.
- 2026-11-02 — Jeff: "I need to make sure that Iuliia is guiding people every step of the way. As this is a true
  sim and very complex." A standing rule for every screen and every stage: the player is never without Iuliia's
  next step and an explanation one tap away. The director writes the guidance spec (the path through the first
  month, the first truck, the first hire, day 28, day 91, the first bust; help on every figure; a "What now?"
  prompt), UX the surface, the writer the lines, engineering the wiring.
- 2026-11-03 — Jeff: (1) the live world restarts once, later, carrying ruleset 0.20.1 (the deposit fix) and the
  used lot's levers (usedMarket.npcLot.perWeek 60, stock 120) once the lot's four-year check passes; (2) the
  prudent persona (option A) stays and option B (loan rates by leverage, the bust covenant) stays off, per the
  economy's pair: the greedy fleets' lead is outside money, not debt; (3) double brokering closes to player
  carriers in the rules with the brokerage bump, not only in the chrome; (4) the Mac mini as the studio's batch box
  and the beta's hosting are for later.
- 2026-11-02 — Jeff: "Add cashing open invoices definitely. If a carrier needs it now, he needs it NOW. Waiting
  would cause them to go bust regardless of the contract." So an open invoice can be cashed now: under a
  factoring contract at the contract rate plus an aging surcharge; without one at a spot rate, the economy to
  size both behind a switch; the fee to the reserve. Iuliia's collect advice offers it first when it exists. The
  economy sizes it, the red team probes it, UX puts "Cash it now" on the invoice rows, the writer rewrites the
  collect lines, engineering builds it with the brokerage bump.
- 2026-11-02 — Jeff ("Let's do which you think is best", after the players' market finding): (1) the market fix
  goes ahead of the brokerage: the next restart carries the market rules (R17 a ceiling is a ceiling; R11
  book-now between the clearing rate and the ceiling, rate levels in a band a trucker recognises, booms and
  slumps paced and announced, a minimum charge on short loads; R16 the pay floor; R12's hours values) and the
  before-restart chrome; the brokerage switches on in the same restart only if its build is QA-clean by then,
  otherwise in the next free restart before live day 91. (2) Both premiums halve: the surety premium for brokers
  to 1–6%, the credit premium's ceiling to 10%. (3) R1 and its fleet-start extension: the dispatcher stays off
  after the first hand-booked load until the player switches it on, a fleet start meets the same first decision,
  and the default bid anchors to "usually clears near" with break-even as the floor. (4) R4: no lit dollar button
  on the first month's screens; FD is the button and the dollar price is text; the $900 yard moves under the
  token fold. (5) R8 for players only, as the economy sized it: auto-staff starts off, and on it never hires
  without four weeks of the wage in cash. (6) The compliance page's 15-hour day and 56 mph "always" options stay
  only if the same bump gives them R18's teeth (fines that scale with the gain, out-of-service days, audits and
  a rating); otherwise they come off the screen until it does. The producer decided all six on Jeff's word; any
  can be reversed before the restart.
- 2026-11-03 — the producer, on Jeff's "do which you think is best", from the economy's package
  (studio/reviews/economy-player34.md): (1) the hold stays at 30% of each leased load in this restart (15% for
  longer costs seven more owner-operator liquidations over four years and runs supply over the path); the
  diary's complaint is answered by the hold's explanation text. (2) The owner-driver's 0.75 FD a mile stays and is
  labelled "Your draw"; removing it would add about 5.1M FD a month of bot supply. (3) A lot rig bought to grow a
  fleet arrives from stock in seven days (usedMarket.npcLot.deliveryDays 7); a starter's first truck keeps the
  queue; the bots are byte-identical. (4) "Pools off" covers Equipment Finance too, behind a key flipped in the
  bump, so nothing lends while the pools are off. (5) The NPC lender never writes cash-out loans. (6) R18 goes in
  at the economy's values; whether to soften the cutters' revocation rate is the director's design call. All
  reversible before the restart. Open for Jeff: the levels (today's hot rates or a true band).
