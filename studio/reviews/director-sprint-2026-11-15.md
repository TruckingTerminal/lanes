# Sprint rulings (director, 2026-11-15)

Filed without §7, §11 and §12: the Back Lot's and the bad-actor rulings stay with the bad-actor design, outside the
repo, until they ship.

## 1. Releasing the current load before pickup: yes (rule; behind a switch)
**The ruling:** the load a truck is heading to may be released until it's picked up, at the same shares as a load
booked ahead:
- the early share outside the urgency rounds, the urgent share inside them;
- the early share when a breakdown forced it (and within a round of the ask), as batch 4 has it;
- past the pickup's close it's a no-show, as today.
It marks the record (a release, in reputation and in standing at two loads). The load goes back on the board with
its slack, and `releasedBy` keeps the releasing company from booking it again. The breakdown ask of my 11-09 and
11-13 rulings extends to the current load too: release-or-keep, in figures, with no answer counting as keep.

**What happens to the truck:**
- It stands idle at the next town on its route, or where it is if it's at a stop. The empty miles so far are sunk
  and said.
- If it has a load booked ahead, that load moves up to become the current one and canMake is checked again. If it
  now fails, the player gets the same ask for it.

**Once loaded, never.** The freight is in the trailer; the only ways out are delivering or the claims for late.

**Where (words):** on the truck card's "Now" line before pickup: "Heading to Tulsa · pick up by 20:00 · [Release ·
460 FD]". The confirm says the claim, the mark, where the truck stops, and "you can't book it again".

**Why:** out there a carrier can drop a load before pickup. Brokers hate it and it costs the carrier, but it happens,
and it's better for everyone than a truck that doesn't show. Today the player's only way out is a no-show, which
costs more and loses the load for the market, where a release puts it back on the board with time to cover it. A
player who can't find a priced way out of a commitment is trapped, and that breaks the rule that the player always
has a way back. The guard against farming the urgency walk is already in the engine (no rebooking by the releasing
company), and the shares are the economy's, as for loads booked ahead. Bots follow the same rule.

## 2. The tier-reached moments for ten tiers (words; the writer drafts)
**The ruling:** the size of the moment matches what changes for the player, and a hero moment is earned once.

| Tier | Moment | What it marks |
|---|---|---|
| 1, 2, 4, 6, 8 | Quiet | A notch: a line in the weekly review, the card's bar moves |
| 3 | Stamp | Dock priority |
| 5 | **Hero, the first time a company reaches Preferred anywhere**; a stamp in later markets | Preferred, and net-15 |
| 7 | Stamp | First call |
| 9 | **Hero, the first time a company reaches Core anywhere**; a stamp later | Core, and contract offers |
| 10 | **Hero, the first time**; a stamp later | A dedicated lane |

**The guards:**
- **Earned once:** climbing back to a tier after a fall is a stamp at most ("Back to Preferred in Dallas"), never a
  second hero for the same thing.
- **Never over trouble:** a hero moment shows at the start of the next sitting, after "While you were away". If a
  tier-1 item is open (a payment about to miss, a repossession), it becomes a stamp. A celebration beside a lender's
  clock reads as mockery.
- **Falls are never moments.** A fall through a milestone is a plain notice with its cause (as ruled 11-13); a fall
  between milestones is quiet, in the weekly review.
- **Every moment says what changed, in figures, from the player's own books.** For example, at 5: "Your Dallas
  invoices now pay in 15 days, not 30. On last month's loads that's 6,200 FD two weeks sooner."

**How the names feel:** the voice is the market's, through Iuliia, never the game's. No "level up", "unlocked" or
"achievement"; a stamp is the mark on a scorecard, not a trophy.
- **Approved (1–4):** you're on the list. Plain, matter-of-fact; a door open, nothing more.
- **Preferred (5–8):** they know your name. Warmer: the first sign of a relationship.
- **Core (9):** they plan around you. Weight and trust; you're part of how they ship.
- **Core · dedicated (10):** a lane that's yours. A partnership, said quietly, as a serious business would.
- **Within a band,** a step is a notch, "tier 6 of 10", with no name of its own.

**Why:** with one scorecard per market, a company can cross the same tier in many markets. A hero each time would
make the moment cheap by the third market. The economy's sizing says half of carriers reach tier 3, a one-truck
carrier its home market's tier 5, and the top tenth of fleets tier 9. So Preferred is the peak most players feel,
which makes it the first hero, and Core and the dedicated lane are rare enough to carry one. Dock priority and first
call change how the day goes, not who you are, so they're stamps.

## 3. Broker entry: yes, the market renews itself, by conditions, not by replacement (a proposal for Jeff)
**The proposal:**
- **Entry follows opportunity.** New AI brokerages enter where brokered freight per trading broker is high and the
  survivors' trailing margins are healthy, after a setup lag (authority and bond: a few game months). Where margins
  are thin or the market is crowded, few or none enter. The economy sizes the rate and the lag; a stable market should
  hold roughly its size.
- **Players count.** Player brokerages fill the same gap. An NPC entrant never arrives where players already
  supply it, so entry never crowds out a player who just started a brokerage.
- **An entrant starts as a newcomer does:**
  - small, with its own capital, counted as money entering the industry (a faucet the economy sizes inside the cap's
    budget);
  - a new name from the name lists (no national brokers, by the standing rule);
  - its persona drawn as the opening brokers' were;
  - no payment history. Carriers see "New broker · since Mar 3" on its loads and its card, and vetting treats it as
    new.
- **Exit as the economy found:** a broker that stops trading is wound up when it stops, counted once. With entry,
  failures read as what they are, and the layer's size tells the truth about the market.
- **Visible:** brokerages started and closed in the monthly report.

**Why:** a market that only shrinks is false (pillar 1). Out there, brokerage has a low barrier, so new brokers start
every month and many fail. It also breaks pillar 2 over the years: the world gets thinner for every player, with no
cause anyone can see. A fixed replacement after each failure would not be a market. Jeff ruled the same on the
emission schedule: a fixed rule is not a mechanism. Entry by margin and freight corrects itself: a hollowed-out
region draws entrants, and an overcrowded one starves them.

**One question for the economy beside it:** check whether any other NPC population, carriers or shippers, only
shrinks the same way. If so, the same principle applies.

## 4. UX's next screens: not landed yet
ux-next-screens-2026-11-15.md isn't in the folder yet. Send me a line when it lands and I'll review it then.

**What I'll hold it to, so UX can check against it first:**
- **Crime stays out of the chrome.** The Back Lot remains a teaser that says "a later beta" and nothing about crime
  (the bible's rule). No crime art on any live screen, in any tab, icon or background.
- **The teaser rule:** never a dead tap. One line on what the layer is, the date it opens, Iuliia's line, and one
  thing that works.
- **Repo, the scrapyard, clearing and the trade-in show money moving, in figures.** A repossession is never silent and
  leads to Back on the road (11-13). The trade-in shows every way out together (11-10).
- **Broker and shipper interiors read as places, not dashboards.** Figures stay on the cards that carry them;
  interiors never invent a rating or a figure the engine doesn't have.
- **The standing ladder follows director-standing-final:** the market's name, the three bands, the next milestone in
  loads and on-time, the trend; the moments as in §2 above.
- **The report spots** keep the monthly report's order and its trade-paper voice.

---

## 5. The dispatcher working a due driver through home: wrong (rule; it clarifies ruling C and 0.25.1 ruling 2, and it moves the bots, so the economy pairs it)
**The ruling:**
- **From five days before the due day,** the dispatcher books only loads that end nearer home, booked-ahead loads
  included. The Montevideo → Wichita booking at 21 days out was against ruling C.
- **At or past due, nothing leaves home.** The dispatcher books no load out of the home market for that driver.
  Picking up at Newark on day 26 was wrong.
- **The days off start at the first moment the driver is inside the home radius with no load on:** after a delivery
  there, or arriving empty. This is 0.25.1 ruling 2 ("home time starts at once"), now reached through the
  dispatcher too.
- **A loaded truck passing through home doesn't stop.** Freight in the trailer is delivered first; the days off
  start after it.
- The same applies to an owner-operator with the dispatcher on, and to bots.

**Why:** 29 days out on a 21-day rule, with home driven through twice, is the dispatcher ignoring a rule the player
can see, and the player set the dispatcher up to keep it. Out there a dispatcher plans a due driver's last loads
toward home, and a driver at home with no load goes home. QA's case is a bug against rulings already made, plus the
one clarification above: a pass-through with freight on doesn't count, an empty arrival does.

## 6. The driver moved 143 miles with no run: a bug. The driver goes to the truck (rule; the economy pairs it, since bots buy trucks too)
**The ruling:**
- **Every bought truck has a place:** the lot it sits on, the listing's town, or, for a new rig, the dealer at the
  company's home hub.
- **The hand-over happens there.** The driver brings the leased truck to it, the leased truck is turned in there, and
  the lessor's cut ends at the hand-over.
- **The run to it is a real run,** with its empty miles, fuel and hours.
- **With the dispatcher on,** it plans the last load to end near the truck, or sends the truck empty when it's idle.
  **With it off,** the game never moves the truck (0.25.1 ruling 3). What now? offers the run: "Your new truck is
  ready at Columbus, 143 mi. [Go to the hand-over · about 185 FD · 3 h]"
- **Before buying,** the confirm says where the truck is and how far it is from yours: "At Columbus, 143 mi from
  Truck 1."
- The same for hired drivers, an owner who drives, and bots.

**Why:** a driver appearing 143 miles away is false, and it hands the buyer free miles that a rival paid for. Out
there you go and get the truck; dealers deliver for a fee. A delivery for a fee could come later as an option (and a
sink beside the expedite), but it isn't needed for this fix.

## 8. The tier moments: UX's five heroes, with my guards (words; this amends §2 above)
UX's proposal is better than mine where it differs. Dock priority is most players' first standing milestone, and
first call changes the game more than any other tier, so both earn a hero. My guards keep heroes rare:
- **Heroes at 3, 5, 7, 9 and 10, each only the first time the company reaches that tier anywhere.** In later markets,
  and on climbing back after a fall, it's a stamp: the toast with the badge at 32, the perk in one line, and Iuliia's
  line in her strip. At most five heroes in a company's life.
- **Tiers 2, 4, 6 and 8:** UX's toast. One per review, as UX has it ("Standing moved in 3 markets").
- **Missed while away:** UX's rule (it plays when Standing or the card next opens), plus one line in "While you were
  away" with "See it". Never queued into the title or the first screen.
- **Never over trouble:** with a tier-1 item open, the hero waits until it's closed.
- **A step down:** as UX specifies. No hero, the cause always in words, Iuliia's falling line at a lost milestone.
- **The paintings:** as UX proposes, with `bank` at 5 and the live city view at 10.
- **The badges (1.7): approved.** No digit on any badge, marks lit in order, the tier always in words beside it.
  The art may enter the repo.

---

## 9. A driver with no truck, away from home: he takes the bus home (rule; amended the same day after the red team's and the economy's shapes; L2's switch goes on only with it)
**The ride home happens by itself, close to the shape the red team and the economy each proposed.** My first version
made it the player's button when the dispatcher is off. That was a prompt with one right answer, and in a world that
never pauses, its bleed ran on while the player was away. The economy's second option stays out: it counts a driver
1,380 miles away as home, which is the 143-mile jump again (§6), and it reopens L2 the moment a relief driver takes
the truck away. Figures are examples; the economy sizes them.
- **When:** a driver with no truck outside the home radius takes the bus home after a day without a truck, unless
  he's seated by then. The day keeps a seat swap and a same-day relay at that hub. Bots, and the dispatcher when on,
  send him at once, unless a truck at that hub needs a driver.
- **The trip:** at a bus's pace, about 800 mi a day, since a bus doesn't stop for hours of service. Miami to Dallas
  takes about 40 h. The cost is in the bleed's own unit, as the economy asks: a fare of about a day's per diem, plus
  the per diem for each day on the bus. Miami to Dallas comes to about 80 FD.
- **On the way:** days away with no rest, as the rule intends. On arrival he's home, his last hub is the home hub, and
  his days off start if he's due (§5).
- **Owners and hired drivers alike.** A hired driver still quits after the weeks without a truck, as now.
- **Words:** a notice as he leaves: "No truck for Ana at Miami, so she's taking the bus home: about 40 h, 80 FD. Home
  Thu 06:00." It goes in "While you were away" if it happened then. No Send home button: it would save a day at most.
- **Later, the same bus to a truck.** A driver needed at a truck at another hub rides it too: to a bought truck's
  hand-over (§6), or to an empty seat. That replaces today's seat-anywhere moves when §6 is built: autoStaff seats a
  spare driver on an empty truck at any hub, and an owner takes over a hire's truck at any hub. 0.25.3 needs only the
  trip home.

**Why:** a driver whose truck is gone, with nothing to wait for, goes home; out there, on a bus. That's the driver's
move, not the company's: the home rule is the driver's (0.25.1 ruling 3), and the game still never moves a truck. The
way back comes by itself because a stranded driver with no exit is a trap, not a hard game. Rest still counts only at
home, so L2 stays closed: stepping out of a truck to rest costs the bus both ways, the days off, and a week of the
truck earning nothing at the far hub. In a fleet, with a relief driver in the seat, that's slip-seating, which
carriers do. The pair's check is per diem and owner-operator bankruptcies back toward the switch-off arm.

## 10. Spoilage under one deadline: near zero is right for now; perishables' teeth come from the cold chain, later (the fix ships as built; the later part is a rule)
**Ship `spoilAfterDeadline` as built, with the spoil hours unchanged; it needs nothing more from me.** Nothing spoils
before the card says. A perishable a day or two past "Deliver by" is lost: 24 h for produce and dairy, 36 for meat,
48 for frozen. Don't move the clock to "Deliver by" itself, and don't shorten the hours:
- An hour late isn't spoiled. Out there a receiver works in a late reefer load with a fine, and refuses it when the
  product is gone. The late claim is the fine; the spoil hours are the product gone.
- With 99.9% of loads on time under one deadline, spoiling at the deadline would hit only the rare late load, and turn
  an hour's dock wait into a 20,000-FD loss.

**The teeth: the reefer unit (rule; a later ruleset, its place in the queue Jeff's; the economy sizes it).**
- **The unit can fail, as a truck breaks down.** The odds come from the trailer's condition; a sound one rarely fails.
- **The spoil clock starts at the failure.** The load spoils unless the unit runs again within hours the commodity
  sets: a few for fresh, more for frozen. A repair stops the clock.
- **It's met as a breakdown is.** Needs you shows the clock and the choice: "Truck 2's reefer quit at Amarillo. The
  produce spoils at 18:00 unless it's fixed: shop at Amarillo, 3 h, 240 FD. [Go to the shop] [Keep going]". With the
  dispatcher on, it goes to the shop.
- **The card says so before booking:** "Spoils 24 h after Deliver by, or if its reefer is off 6 h."
- The commodity table's own note already expects it ("or after a reefer failure").

**Why:** what spoils freight out there is temperature, not the calendar. A unit that quits is the reefer carrier's
real risk, and upkeep is how a good one keeps it rare. The risk is visible, as a breakdown is, and a choice can save
the load. It gives the trailer's upkeep a reason and the reefer's premium a cost, and it brings back the cargo-claim
sink (1.19M a run) on loads the carrier could have saved. Until then, near zero costs little: a late perishable still
pays the late claim, and the economy can say whether the reefer premium needs a look.

**Words now (the writer's):**
- **The sheet,** in "What you're agreeing to", one more line for a perishable: "Past Fri 14:00 it's spoiled: no pay,
  and a 20,000 FD cargo claim."
- **The commodity row** reads "spoils 24 h after Deliver by"; the red team found it stops at "after".
- **The spoil notice** reads from "Deliver by", not the appointment: "Load #4417 (fresh produce) arrived 26 h past its
  Deliver by (Thu 14:00) and was refused as spoiled: no pay, and a 20,000 FD cargo claim."

**For the economy, a question, not for 0.25.3:** at 99.9% on time, "Deliver by" almost never binds once a load is
booked. Reputation (11-14), the logbook milestone (L3) and now spoilage each lost their teeth to it. A deadline should
be met by planning, not by default: a normal carrier is late on a few loads in a hundred, from breakdowns, docks and
tight bookings. What would the commodities' delivery hours (`windowHours`) need to be to get there, and what would it
cost the gate? Nobody moves them before that answer.

---

## 13. Standing's flicker: a step down only after two reviews below the floor, with "on notice" between (rule; moves no money; 0.25.3)
**Yes to the economy's shape, and the first review below the floor puts the scorecard on notice.** A step up still
comes at the first review that meets the next floor. The same holds whatever pushed the count under: a load aging
out of the window, or a hit (the cause line still names the no-show). The eight-week decay keeps its own rule and its
own warning.
- **The card, on notice:** "On notice: 6 loads against tier 6's 7. Still under at next Monday's review, and Dallas
  drops to tier 5."
- **Needs you,** as the decay warning is, only when the drop would lose a perk (tiers 3, 5, 7, 9, 10). Iuliia: "Your
  Dallas standing is on notice. A Dallas load before Monday keeps net-15."
- No toast for going on notice or coming off it: the card's line is enough.

**Why:** out there a shipper doesn't drop a carrier from its routing guide for one thin week. It puts the carrier on
notice and drops it if nothing changes. A tier that bounces weekly is noise. It would spend the toasts and Iuliia's
falling lines (§8) on nothing, and make a perk feel lent, not earned. "On notice" turns the bounce into a week's
warning with a step the player can take, which is the cutthroat-but-visible rule.

## 14. A passed first call costs nothing; shippers call first the carriers who answer (rule; amends my standing-final Iuliia line; the economy's probe has it as its 0 arm)
**A pass or a lapse is not a hit: `standing.hits.declinedFirstCall` is 0.** In its place, a ranking: among holders of
the same tier, the one that took the larger share of its first calls in the window is called first, then the hash.
No history counts as answering. After a pass the load goes to the hold or the board, where the carrier can still bid
like anyone.
- **The card at tier 7+:** "First calls: you took 3 of 7 in 180 days. Dallas shippers call first the carriers who
  take them."
- **Pass needs no Confirm.** It costs nothing, and the load stays bookable on the board.
- **Iuliia's tier-7 line, amended:** "Dallas shippers call you first now, before the board and before the locals.
  Take the ones that pay: they call first the carriers who say yes."
- Contract tenders keep their own acceptance rule (`tenderAcceptance`, the local ban), untouched.

**Why:** a first call is a spot offer at a fresh posting's price, not a contract tender. Out there, a carrier that
turns down a shipper's first look isn't marked down. The shipper calls whoever says yes next time. At a hit of 1, the
perk costs a tier-7 company about six loads a year against a floor of 10: the reward becomes a tax, and an owner is
punished for being away while the calls come. A quarter-load hit softens that, but it puts a fraction on a card that
counts loads, and it still taxes the perk. Standing measures how a carrier serves the loads it takes; first call goes
to whoever answers. My standing-final line "Turning one down counts against you" was wrong for that reason. If the
probe's 0 arm moves a line out of the spread, the economy says so and I'll look again.

---

## 15. The winding-up check counts the Reserve and what's settling out of it (rule; the economy pairs it; a switch, as any live rule)
**The weekly check reads cash, plus the Reserve, plus withdrawals settling: the claims cap's own figure.** A company is
wound up only when that sum is under −2,000 FD at four weekly checks in a row. Nothing else changes:
- bills still post to cash and may take it below zero;
- purchases and hires still need cash;
- the Reserve still can't be pledged, staked or posted as a bond;
- receivables and pool deposits don't count.

The line is: what turns into cash within a day, for free, is cash in another drawer. What costs a factor's fee or
waits on its own terms is not.

**Words (UX's card and the warnings):**
- **The Reserve card's foot:** "Bills are paid from cash only. A withdrawal lands in cash the next day. If cash runs
  short, the Reserve still counts as yours: the winding-up line reads cash and the Reserve together."
- **The weeks-in-debt warning (tier 1) reads the same sum:** "Cash and the Reserve together are 3,400 FD under the
  −2,000 line: week 2 of 4. The company is wound up after Monday the 30th unless they're back over it."
- **Cash under zero, with the Reserve covering it,** is a tier-2 line, not a tier-1 warning: "Cash is −3,400 FD. The
  Reserve covers it, but bills and purchases need cash. [Withdraw 3,400]". UX's one tap stays, for what cash does.

**Why:** the Reserve is the company's own FD a day from cash, free to move. Winding up a company that holds the money
to cover its debt is false. No creditor forces a sale on a company with the funds in its other account. In a
liquidation the Reserve joins cash anyway, so today's rule would fire-sell a solvent company's trucks and then find
the money, which is the worst outcome for nothing. With claims posting in full, one large claim while the player is
away could do it. Every other reader already counts the Reserve: credit counts it as capital, the month report counts
it as wealth, and the claims cap counts it with what's settling. One figure, one name. The skill the Reserve asks for
stays: keep enough in cash for bills and buying, or wait a day and lose a purchase. I see no gain in a company running
cash below zero with the Reserve covering it, since its net is the same as an honest one's. If the pair finds one, the
economy says so.

---

## 16. Fleets: no fleet rule and no share goal; the wind-up joins the brokers' proposal (amended the same day after the economy's study, economy-fleet-entry-2026-11-15.md; a proposal for Jeff, with §3)
**No share goal for the fleets.** I value the fleets' share of trucks at no owner-operators' trucks at all. I won't
buy it with 6–10% of newcomers' earnings, since the newcomer's path is the player's own first month. The top of the
standing ladder is set by floors, open to whoever earns it. A player's fleet climbing into a thinner top is the game
working.
- **Growth and entry rules for fleets: not now.** The study shows the carrier side sizes itself to the freight, at
  840–920 trucks in every version. The fleets' fall from 54% to 37% of trucks is owner-operators taking share, not a
  hollowing out. Entrants on the lessor's trucks add churn, not capacity.
- **The hype bust is answered.** The carrier side recovers by itself, since the bots buy trucks when trucks pay. My
  worry that a bust leaves no way back was wrong.
- **One fleet change goes with the brokers' proposal: a failed NPC fleet is wound up and counted once,** not
  restarted. It's the same choice as the brokers' wind-up, at no cost to capacity in the study (403 trucks against
  390), and the reports then tell the truth about failure. A player's restart on the free path is untouched; that's
  the way back.

**Jeff's question becomes one:** "Should the market renew itself by conditions? New AI brokers would enter where the
freight and margins call for them, and a failed NPC broker or fleet would be wound up and counted once instead of
restarting." The fleet study goes with it as its note.

**Why:** pillar 1 is a market that sizes itself to the freight, and the study shows it already does on the carrier
side. A fleet rule would make the world no bigger and the newcomers poorer, to hold a share that the market is
giving, truthfully, to owner-operators. A fixed restart that holds the company count is the same falsehood §3 named for
brokers, so it ends the same way.

---

## 17. A load booked ahead when a due driver reaches home: it goes first, and the days off wait (rule; amends §5 and 0.25.1 ruling 2; 0.25.3)
**Shape (b), and one guard.** A load booked ahead is freight on, as the trailer's freight is in §5's pass-through. The
days off start when the driver is inside the home radius with nothing on and nothing booked ahead. So the probe's
owner delivers Phoenix → Los Angeles, hauls Los Angeles → Las Vegas as booked, and his days off come the next time
he's home with nothing booked. Getting him home from Las Vegas is the dispatcher's under §5, or the player's with the
dispatcher off; ruling 3's warnings and fatigue apply as before.
- **The guard: canMake counts days off as time the truck isn't free.** A load booked during days off whose pickup
  closes before they end is refused at booking: "Truck 1 is on days off until Sat 08:00, after the 18:00 pickup." So
  no hold ever turns a booking into a no-show.
- **A past-due hired driver** still refuses at booking a load that leads away from home (ruling 3). A load booked
  before he came due is honoured.
- **Words, when it happens:** "You're due for days off, but Los Angeles → Las Vegas is booked for Monday. It goes
  first; your days off start when you're home with nothing booked."
- **Words, on the booking sheet,** in "What you're agreeing to", when the driver comes due before the pickup: "Ana is
  due home Tuesday. This load comes first; her days off wait until she's home with nothing booked."

**Why:** the game must never turn a player's own booking into a no-show by a rule of its own. A claim and a failed
mark for that would be the hidden deadline again. Out there, a driver who gets home with a load already dispatched
hauls it and goes home after, as the pass-through does. Shape (a) asks the player to pay a claim and take a mark for a
conflict the rules made. Its "keep" option is a certain no-show, so it's a prompt with one right answer. Keeping a
load always booked to put off the days off is the policy the red team already accepted: an owner's fatigue builds, and
a past-due hired driver can only be booked home.

---

## 18. "Deliver by": windowHours goes to a quarter, after its gate; "a few in a hundred" is withdrawn (rule; the economy gates it on ten seeds with twins first; a ruleset, as any live rule)
**A quarter of today's `windowHours`, every commodity alike, with "Deliver by" counted as now.** About one load in a
hundred late is enough. My §10 target of a few in a hundred is withdrawn: the study prices it at 6–8% of carriers'
profit on top of the 19% that windows already cost, plus 38% more owner-operator bankruptcies. Counting from the
ready time is out too: it takes loads off the board instead of making anyone late. Don't wait for the reefer unit. It
is perishables only, and the deadline is flat for all freight now.

**The gate passes when:**
- the ten-seed carriers' floor holds;
- bankruptcies and cleared loads stay inside the spread;
- the newcomer's month holds on the 24 seeds. A newcomer's worn rig breaks down most, so lateness lands there first.
  If the month falls, the scale goes to a half before the deadline gets any other change.

**Words:** none new. The card and sheet already show the clock times, the "Tight: 3 h to spare" line and the claims
in FD. The guide's commodity table reads the config. At a quarter those lines start to matter, which is the point.

**Why:** at a quarter the deadline starts to bind after booking. That's where a careful carrier's lateness comes from
out there: a breakdown, a long dock wait, a tired driver. One load in a hundred is late, and about five in a hundred
arrive within six hours of the deadline. So the "Tight" line, the at-risk states and the breakdown's release-or-keep
ask finally fire. Reputation, standing's hits and the logbook milestone get their teeth back with no change of their
own. The order of the commodities stays true: parcels, auto parts and produce, the time-critical freight, stay the
tightest. The price is 2–3% of carriers' profit, with bankruptcies in the noise. That's the cost of a deadline that
means something, and the cheapest one the study found. The reefer unit stays perishables' own risk, for later.

---

## 19. The bus to a truck: next, not later (rule; mirrors §9's bus home; the economy pairs it)
**Build it next.** With the bus home live and auto-staff's seat-anywhere move closed, a company can now strand its own
truck: Jake paid at home in Chicago, Truck 2 empty at Columbia, and no way to put them together but a second hire.
That's a dead end, the opposite of always a way back, and it reached QA's first replay.
- **Who rides:** a driver with no truck, hired or the owner, unless he's on days off or past due. "Jake is due for
  days off first": the home rule is the driver's.
- **Where to:** an empty seat on a company truck at another hub, idle, parked or in the shop, or a bought truck's
  hand-over (§6).
- **The fare and days, as the bus home:** a fare of about a day's per diem, plus the per diem for each day on the bus,
  at about 800 mi a day. The days are days away with no rest. The seat is held for him while he rides, and he's seated
  when he arrives.
- **Who sends him:**
  - the player, from the empty truck's card: "No driver at Columbia. [Send Jake from Chicago · about a day · 60 FD]
    [Hire at Columbia]". Also from his row in Staff.
  - auto-staff (bots, the dispatcher, a company the engine staffs): it sends a driver with no truck before it hires
    one, counting the fare and the days. That's the honest version of the move the red team closed.
- **R7:** where DRIVE IT and CO-DRIVE would reach a truck at another hub, the offer becomes "Send by bus · fare ·
  time", shown only when it's allowed.

**Why:** the trip already exists; this is its other direction. Out there a carrier puts a driver on a bus to a truck
as often as it sends one home.

## 20. A driver let go keeps the place they left, for four weeks: not by design (rule; with §19)
**For four weeks in the pool, a driver let go keeps the hub where they were let go.** Any company that hires them in
that time for a truck at another hub sends them by §19's bus, at the hirer's cost, before they're seated. After four
weeks they've moved on, and a hire starts at the truck, as any pool hire does. Auto-staff counts the fare and the days
when it picks. No cooling-off: re-hiring someone you let go is fair; the trip is what was missing.

**Why:** the pool is the labor market at large, so an ordinary hire is a local hire at the truck. But a named driver
let go at Chicago an hour ago isn't local to Columbia, and players see the names. Letting a driver go and re-hiring
them already costs more than the bus: a week's severance and a week's sign-on. So this is about the truth on the page,
not about stopping a dodge, and it closes the last free ride with the bus everything else uses.
