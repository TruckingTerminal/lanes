# Iuliia by tab and card, and the truck makes (writer, sprint 2 draft 2, 2026-11-03)

Sprint 2, item 5. Engineering wires it in sprint 3. Draft 2 covers every screen a player reaches in the first month: the first-entry hub screen, the four tabs and everything under More, the Dealer, Finance, Staff, Intel and the brokerage screens. The Intel and brokerage rows are drafted ahead of the director's page and brief, which land this week; they are marked **draft** and will be checked against both.

## The rules

**Jeff's words, 2026-11-02.** "Iuliia should have a different dialogue depending on which tab you are on and which button or card you're pressing. Some humor is allowed." And: "Make sure that Iuliia explains factoring and quickpay to owner operators who want to buy their own truck. The risk is real and they need to be well capitalized to make it work."

**The director's placement rule (sprint 2 plan).** "Iuliia says at most one line on a screen, on its first visit or when something on it changes, never over a number the player is reading; humor in her lines, never in the figures."

**What that means for engineering:**
- **One line per screen at a time.** A screen is a tab, a sheet or a card opened full. A new line replaces the old one; two never stack.
- **Triggers are only two kinds:** the first visit to a screen in a sitting, or a named change on it (the table's Trigger column). Pressing a button counts as a change on its screen.
- **Where she speaks:** the caption strip under her portrait, for six seconds, then the walkthrough's Do line returns. Never in a tooltip, never over a figure, never inside a table or a pay line.
- **The walkthrough comes first.** While a step's own line is showing, these wait.
- **Rotation.** Variants are separated by " · ". She uses each once before any repeats.
- **Quiet time.** Never two lines within `{iuliia.quietSeconds}` real seconds (proposed 60).
- **Silence on bad news she can't help with:** no line on an error, a refused order, a crash, a theft, a revocation or a liquidation. Those get the plain string alone.
- **"Quiet"** on the Iuliia tab mutes these lines; the walkthrough's lines stay. The setting is per browser.

**Her register.** An executive who ran a fleet of four hundred trucks in Moscow: poised, dry, warm underneath, sass by understatement. She names Russian things (her grandmother, the samovar, the Volga, Tolstoy, Chekhov) and never says a Russian word. Every line is under 20 words.

**No joke** in the first line a player sees in the world, in any line that explains money (factoring, quick pay, loans, the stake, the surety), or in any line on a screen where something has gone wrong.

**The Back Lot rule holds everywhere:** player against player is rivalry. The gate, the cameras, the attention you draw. No hiring, no temptation, no crime words.

Numbers in her lines are config keys, like every other string.

## First entry: the hub screen

The sheet's two opening lines and the naming and arrival lines are in `copy-first-ten-minutes.md` and stay there. These are the lines for what the player touches in between.

| Screen or card | Trigger | Lines |
|---|---|---|
| A ringed hub's card | first opened | A good place to start this month. Read the costs before the character. · Ringed for a reason: freight leaves here for a new carrier. |
| Any starter hub's card | first opened | You may start here. Whether you should is what the card is for. · Every city has a character. Look at what it costs to live with it. |
| A non-starter hub's card | first opened | A fine place to deliver to. For a home, look at the rings. |
| See the board (read-only) | first opened | Look, don't touch: these are someone else's loads until you live here. · Read the ceilings. Those are what shippers pay a stranger. |
| All hubs | first opened | Sorted by today's freight. Today's, not forever's. |
| The season line reads "thin" | card opened | Thin this month. My grandmother planted in May anyway; she also had a pension. |

## Truck

| Screen or card | Trigger | Lines |
|---|---|---|
| Truck tab | first visit | Your truck. Look at it as an accountant would, then as a mechanic. · Every truck has a story; the odometer writes it. · Check where it sleeps tonight. My grandmother checked the doors twice. |
| Truck card | turns "Waiting at {hub}" | It waits for you. The first load is your call. |
| Truck card | starts rolling | There it goes. I still like watching them leave. · The slow part begins, which is most of trucking. |
| Truck card | condition falls below `{wear.rebuildMaxCondition}` | The condition bar is a calendar. Plan the rebuild before it plans you. |
| Tonight's stop | reads "the shoulder" | No legal place in reach tonight. Next time, plan the stop before the drive. |
| Delivered card | appears, on time | Delivered. Read the pay line, not only the top number. · On time. The shipper noticed, even if they'd never say so. |
| Delivered card | appears, late | Late once is weather. Twice is a habit. · Late. The receiver will remember; so will your record. |
| Needs you | first item appears | Something needs you. Not urgently, or I'd be louder. |
| Today | first visit | Today, in order. Read it the way my grandmother read letters: twice. |
| Send empty | pressed | Empty miles: expensive, but sometimes the only honest road. · Running empty toward better freight. A calculated retreat. · I'll pretend I didn't see the fuel bill. |
| Send home | pressed | Home time. Cheaper than a new driver, every time. |
| Rebuild | pressed | Two days in the shop. A planned rebuild is the cheapest repair there is. |
| Park | pressed | Parked. A truck that doesn't move still costs; the ledger will remind you. |
| Dispatcher | first visit, before the first bid | Your first load is yours. After that, the dispatcher can help. |
| Dispatcher switch | turned on | Good. It bids while you sleep; check what it did in the morning. · Rules on. They behave on Tuesday; audit them on Friday. |
| Dispatcher switch | turned off | Off. Every load is yours to bid by hand, then. · Off. Brave, or tired of its taste. Either way, I'm watching. |
| More rules | first opened | The fine print. Set it once, then read what it did. |

## Loads

| Screen or card | Trigger | Lines |
|---|---|---|
| Loads tab | first visit | The board. Read the ceiling before you fall in love with a rate. · Nearest first. An empty mile pays nothing. · Every load here is somebody's emergency. Price it accordingly. |
| The board | goes empty in range | Nothing near you this round. Widen the search, or wait for the next. |
| A load's sheet | first opened | Book now if the profit is green. Bid if you're patient. · The break-even is yours; the ceiling is theirs. Live between them. |
| A blocked load | first opened | Not yours yet. Brokers want a record before they want you. |
| Book now | pressed | Booked. Decisive. I approve, provisionally. · Yours at the posted price. Now make the appointment. · Booked. Sometimes the bird in the hand is the whole lunch. |
| Bid | pressed | Bid in. Now we wait, which is most of this business. · A fair bid. The round will tell us whether the market agrees. · Placed. Refreshing the page doesn't help; I've tried. |
| Withdraw | pressed | Withdrawn. Changing your mind before the round is allowed. After is called a lesson. |
| Result card | won | Won. Good price, or good luck? Compare it with what it usually clears near. · Won. Enjoy it for one minute, then plan the reload. |
| Result card | lost | Lost. If they went under your break-even, let them have it. · Lost by cents. Next round, read "usually clears near" first. |
| Result card | nobody took it | Nobody bid. The shipper will raise the rate before you lower yours. |

## Money

| Screen or card | Trigger | Lines |
|---|---|---|
| Money tab | first visit | The ledger never lies. It only waits for you to read it. · Cash first, then what's owed, then what you wish were owed. · Read this page weekly, like an executive, with tea. |
| Owed to you | first invoice appears (an owned truck) | Your first invoice. It lands on its due day; plan as if it might not. |
| This week's costs | a new kind of cost appears | A new line in the costs. Every line here started as a good idea. |
| Cash | goes into the red | You're below zero. Get loads moving, and read the warning above. |
| Standing | first visit | Miles: your standing in the beta. The score, not the salary. |
| Loans | first opened | The lender's terms, plainly. A loan is a promise the truck has to keep. |
| The token | first opened | The token, as it stands. Read it; nothing here is a promise of money. |

## More, and the panels under it

| Screen or card | Trigger | Lines |
|---|---|---|
| More | first visit | The rest of the house. Some rooms are still being painted. · Help is in here. So am I, which is better. |
| Iuliia | first visit | My clipboard. Every step on it, ticked or not. · Read ahead if you like. I won't tell. |
| Help | first visit | Every system, every number. I've read it twice; once was for pleasure. · The handbook. Dry, complete, occasionally right before I am. |
| Company | first visit | Your record. Brokers read it before they read your rate. · Reputation is slow to build and quick to spend. |
| Company › Safety and authority | the rating changes | Your rating moved. Read what's behind it before the insurer does. |
| Company › Insurance | the policy renews | Renewed. The insurer read your record; so should you. |
| Company › Biggest companies | first visit | The leaders. Everyone on this list started with one leased truck. |
| A closed teaser card | first opened | Not open yet. Patience is also a business skill. · Coming. Tell us what you'd want; I pass it on. |
| Rates | first visit, once open | Where freight pays, by trailer. A map of other people's mistakes. · Strong hubs pay to leave; weak ones pay to arrive. |
| Economy | first visit, once open | The market's own books. Tolstoy wrote shorter ones. |
| Logbook | first visit, once open | What your Miles became. I kept the receipts. |
| Business | first visit, once open | Yards, shops, truck stops. A business is a truck that never leaves. |
| Back Lot card | first opened | Someone will want your cargo one day. Lock the gate. (the card's line, on main) · Rivals have yards too. Mind yours. |

## Dealer

| Screen or card | Trigger | Lines |
|---|---|---|
| Dealer | first visit | Window shopping is free. Signing is not. · Every truck here is somebody's dream. Buy yours with arithmetic. |
| Used lot | first opened | Four years, many miles, honest paint. The first truck should be this one. · My grandfather's Volga ran thirty years on pride. This one needs oil. |
| New | first opened | Beautiful. Also a loan you'll feel every week. · New trucks lose value leaving the lot. So do promises. |
| Lease another truck | first opened | A lease is renting confidence. Read the weekly minimum first. |
| A Keystone | first selected | The commonest truck on the road. Nobody admires it; everybody hires it. |
| A Meridian | first selected | The cheapest mile on the highway. Accountants weep, gently. |
| An Ironwood | first selected | Drivers stay for this one. So does its value. You pay for both. |
| Trailers | first opened | The cheap half of a rig, and the half that waits at docks. |
| Buy | pressed, first truck | Yours. The lessor's cut ends today; the wait for your money starts. |
| Buy | pressed, later | Another truck, another driver to find. Growth is a staffing problem. |

## Finance

Moved to `finance-strings.md` (its last section), so engineering reads Finance in one place. The triggers follow UX's Finance spec: the first visit in each state, a contract signed, seven days before it ends.

## Staff

| Screen or card | Trigger | Lines |
|---|---|---|
| Staff | first visit | People are the dearest line in the ledger, and the only one that can quit. · Hire slowly. Tolstoy took six years over one book. |
| Hire a driver | pressed | Pay decides who comes; home time decides who stays. · Learn their name. They'll be learning yours. |
| Hire a dispatcher | pressed | A dispatcher. Now someone else reads the board at three in the morning. |
| Hire a manager | pressed | A manager. Your fleet just grew a middle, which every fleet needs. |
| Hire away from other companies | first opened | Their people, your offer. They'll match it, or they won't. Rivalry is polite here. |
| A driver's morale | falls to "restless" | Restless. Home time costs less than a replacement. |

## Intel (draft: the director's page lands this week)

| Screen or card | Trigger | Lines |
|---|---|---|
| Intel teaser | first opened | Every company in the world, sized and ranked. Their cash stays their own. |
| Intel | first visit | Who's big, who's growing, who's on time. Their cash stays private. So does yours. |
| A rival's row | first opened | Know your rivals. Then go back to your own numbers. · A good record is public. So is a bad one. |
| Your own row | first opened | That's you, as everyone else sees you. Worth a look. |

## Brokerage (draft 2: against `brokerage-rule.md` and UX's `brokerage-ux.md`; strings in `brokerage-strings.md`)

A brokerage is the player's second company (Jeff, 2026-11-02). Rivalry's words only. No joke in any line about the bond, the surety, cash or capital. None on a fall-off, a shipper who didn't pay, a refusal or a wind-up.

| Screen or card | Trigger | Lines |
|---|---|---|
| Brokerage teaser | first opened, before day 91 | A brokerage sells the haul instead of driving it. A second company, and a second set of books. |
| Truck tab, the seven-day card | first shown | Brokerages open next week. The bond is the hard part; look at your cash first. |
| Brokerage card | the layer opens, once | Brokerages are open. With the bond to spare, you may start one beside your carrier. |
| Starting sheet | first opened | Read the costs slowly. The bond is held, not spent, and it isn't yours to use. |
| Starting sheet | short of the bond | Not yet. Haul a while longer; the bond will still be there. |
| The brokerage | started | Your second company. Two sets of books now: keep them apart, and keep both honest. |
| The company switch | first used | Same login, different company. The colour at the top tells you which one you're in. |
| Book | first visit | Your loads, by stage. A broker's day is spent waiting on other people's trucks. |
| Carriers | first visit | Choose who hauls for you. A strict list fills slowly; an open one fills with surprises. |
| Money (brokerage) | first visit | Two lists now: owed to you, and owed by you. The bond stands behind the second. |
| Bond meter | passes 80% | Your bond is nearly full. New loads will pass you by until carriers are paid. |
| Book, a load | first taken by a carrier | A carrier took your load. Now someone else's truck carries your promise. |
| Book, a load | first margin paid | Your first margin. Brokers live on thin slices, and a great many of them. |
| Move capital | first opened | Your money between your companies, less a small fee. It's equity, not profit. |
| Broker it | first shown on a direct tender | A shipper chose you directly. You may haul it, or broker it under your bond. |
| Broker it | first pressed | Brokered. Your brokerage carries the promise now, and its bond stands behind it. |
| Tender to my carrier | sheet first opened | Your own carrier, at a fair rate for the lane. The range is the market's. |
| Intel, "same owner" | first seen | Everyone can see both are yours. Carriers like a broker with trucks behind it. |

## The truck makes

Three fictional makes, one per tractor tier (Jeff, 2026-11-02), each modelled loosely on real ones by role and reputation, never by name, badge or shape. Counsel reviews the names against existing trucking and automotive trademarks before anything ships; I haven't run that search. The economy note (`reviews/economy-truck-brands.md`) holds their figures.

| Make | Tier | Modelled on | Dealer line |
|---|---|---|---|
| Keystone | Workhorse | Freightliner | Half the interstate drives one. Cheap to buy, cheap to fix, never pretty. |
| Meridian | Highway Pro | Volvo | Built by people who measure fuel to the drop. Quiet, safe, kind to the books. |
| Ironwood | Flagship | Peterbilt and Kenworth | Long hood, plenty of chrome, best at resale, and drivers who stay for it. Priced to match. |
