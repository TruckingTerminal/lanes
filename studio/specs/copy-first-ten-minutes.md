# Copy: the first ten minutes (writer, draft 1, 2026-11-02; against UX draft 2)

Every string on sprint 1's screens, keyed to `specs/first-ten-minutes.md`. `{key}` is read from `economy.config.ts`, never typed; `{x}` without a key is a value from the world. Sentence case throughout; terms per `copy-audit.md`. A string not listed here stays as it is. Token surfaces stay unchanged this sprint (Jeff, 2026-11-02).

## S0 Title and forms

| Where | String |
|---|---|
| Tagline, live | One shared world, on the real clock. You start with one leased truck. |
| Tagline, test build | Test build: the whole game against the AI, with pause and speed. |
| Join card title / lead | Join the live world / One world, shared by every player, on the real clock: a game day every `{time.realHoursPerGameDayLive}` real hours. It never pauses, nothing resets, and every order stands. |
| Fields | Company name (default "Lone Star Freight") · Home hub |
| Hub card, line 2 | `{hub}` · freight `{strong / even / thin}` · `{few / a fair share of / many}` carriers (from the hub's outbound balance and `homeCrowding`) |
| Start line | Everyone starts the same way: one leased Workhorse with a dry van, `{company.startingGrantFd}` FD, and you driving. The lessor keeps `{costs.npcLeaseShareOfGross}` of every load. Go broke and you start again on a lease. |
| Buttons | Start hauling · Test world: private, pausable |
| Test form lead | A private copy of the rules with only you and the AI in it. Pause it, run it fast. It stays in this browser, and a new one replaces it. |
| How you start | Owner-operator. The live world's start. / Small fleet. Two used trucks and `{startingGrantFd + 20_000}` FD, to test the fleet game. |
| Connection cards | Couldn't reach the world: The live world didn't answer. Try again in a moment. · Sign in to play: The live world lives on claude.ai. Sign in there and open this page again. · The other three unchanged. |
| Menu | Title screen · Full screen · Report a bug or an idea · lead lines unchanged |

## Chrome

| Where | String |
|---|---|
| Strip | `{Tue 06:00}` · `{cash}` FD · alert dot, title "Needs you: `{n}`" · ≡ · test build: Paused · 1× · 10× · 30× |
| Nav | Fleet · Loads · Money · Company · Iuliia |
| Teaser label / buttons | Coming soon / Tell us what you'd want here · The road ahead |
| Staff teaser | Drivers and dispatchers. Opens when a truck needs a driver. |
| Dealer teaser | New and used trucks, trailers and leases. Opens when you're ready to buy; Iuliia will say when. |
| Business teaser | Yards, shops, truck stops, warehouses. Opens on day `{unlockLadder.layers.businesses.afterDays}`. |
| Logbook teaser | Your standing, and what it becomes. Opens with the token. |
| Back Lot teaser | A later beta. We'll say what it is when it's ready. |
| Report card, Watching cards | Unchanged. |

## S1 Arrival

| Where | String |
|---|---|
| Map not drawn | Finding `{hub}`… |
| Your sprite | You |
| Sheet | Iuliia, step 1 (below) · button **Show me the board** |

## S2 Loads

| Where | String |
|---|---|
| Header | Loads from `{hub}` · `{n}` · next round `{hh:00}` (in `{wait}`) |
| Truck selector | Truck `{n}` · `{trailer}` |
| Card line 1 / 2 | `{Dallas, TX}` → `{Charlotte, NC}` · `{miles}` mi / `{total}` FD · `{rate}`/mi · `{dh}` mi empty |
| Chips | +`{profit}` FD at book-now · −`{loss}` FD at book-now · +`{profit}` FD at `{suggest}` |
| Blocked chips | Needs `{vetting.standard.minAuthorityDays}`-day authority · day `{d}` · Strict vetting: `{strict.minDelivered}` loads or a year's authority · Local carriers first this round · A hot load needs a team |
| Sort | Nearest · Best pay · Deliver by |
| Filter | Filter · Destination · Anywhere · Empty miles, max · Commodity or place (placeholder "produce, Tulsa") · Rates by hub · Table (laptop) |
| Truck busy | Your truck is on the road · loads show when it's free · ETA `{Jan 7 02:36}` |
| Nothing in range | Nothing for a `{dry van}` within `{maxDh}` mi of `{hub}` this round · next round `{hh:00}` · button **Widen the search** |

## S3 Load

| Where | String |
|---|---|
| Back | Loads |
| Route | Pick up: `{Dallas, TX}` · now · Deliver by: `{Jan 7 02:36}` · `{Charlotte, NC}` · Miles: `{loaded}` loaded · `{empty}` empty · Driving: `{h}` h · Reload at `{dest}`: `{good / fair / poor}` · about `{mi}` mi empty to the next load |
| The money | Book now: `{total}` FD · `{rate}`/mi · Your break-even: `{be}`/mi · Profit at book-now: `{profit}` FD · Usually clears near: `{ref}`/mi · Ceiling: `{ceiling}`/mi |
| Shipper | `{name}` · On time: `{pct / —}` · Vetting: `{open / standard / strict}` |
| More about this load | Commodity · Cargo value · Tolls (none) · Two-lane `{pct}` · Season: normal / in season +`{pct}` / off season −`{pct}` · Load #`{id}` |
| Actions | **Book now · `{rate}`/mi · `{profit}` FD** · − `{bid}` + · range `{lo}`–`{hi}` · **Bid · `{profit}` FD** · Change bid · Withdraw |
| Sent (live) | Sent · in effect `{hh:mm}` |
| Blocked | Not yet: `{reason}`. |
| Refused | The engine's reason, sentence case, full stop, under the button. No toast. |

## S4 Booked or bid in

| Where | String |
|---|---|
| Booked | Booked · `{origin}` → `{dest}` · `{total}` FD |
| Pinned bid card | Your bid · `{rate}`/mi · clears `{hh:00}` · in `{wait}` · **Withdraw** |
| Strip line | 1 bid in · clears `{hh:00}` / `{n}` bids in · clears `{hh:00}` |
| Toasts | Bid in at `{rate}`/mi. It clears at `{hh:00}`. · Booked. The truck is on its way. · Bid withdrawn. |

## S5 The round

| Where | String |
|---|---|
| Won | Won `{origin}` → `{dest}` at `{rate}`/mi · `{total}` FD · **OK** |
| Lost | Lost to `{winning}`/mi · your bid `{rate}` · your break-even `{be}` · **Bid again** |
| Nobody took it | Nobody took it this round · your bid `{rate}` · **Bid again** |
| Feed | Won `{Dallas}` to `{Charlotte}`, `{miles}` mi at `{rate}`/mi, your bid. / …, your dispatcher's bid. · Lost `{Dallas}` to `{Charlotte}` at `{rate}`/mi: it went for `{winning}`/mi. / …: nobody took it this round. |

## S6 Rolling (Fleet)

| Where | String |
|---|---|
| Truck card | Truck `{n}` · Workhorse · `{Dry van}` · leased: the lessor keeps `{npcLeaseShareOfGross}` of every load / owned · worth `{fd}` FD · `{origin}` → `{dest}` · `{miles}` mi · ETA `{Jan 7 02:36}` · chip On time / Late `{h}` h |
| Status lines | Idle at `{place}` · next round `{hh:00}` (replaces "sat out n rounds"); the others unchanged. |
| Map | Follow |
| Needs you | Needs you |
| Tired | `{You have / Name has}` been out `{n}` days and `{are / is}` tired. A tired driver crashes more, drives slower and loses heart. `{fatigue.resetDays}` days at home reset it; every idle day away from home costs `{labor.driver.perDiemFd}` FD. · **Send home · `{mi}` mi** |
| Idle | Truck `{n}` has been idle `{time}` at `{hub}`. No `{dry-van}` loads within `{mi}` mi of `{hub}`, as far as your dispatcher sends a truck empty. Nearest freight worth the run: `{n}` loads at `{hub}`, `{mi}` mi. · **Send empty to `{hub}` · `{mi}` mi** · Bid by hand |
| No driver | Truck `{n}` has no driver and earns nothing. · **Hire a driver** |
| Today | Today (the last eight feed lines) |

## S7 Delivered

| Where | String |
|---|---|
| Card | Delivered `{Dallas}` to `{Charlotte}` · chip On time / Late `{h}` h |
| Rows | The load `{fd}` · Fuel −`{fd}` · Tolls −`{fd}` · The lessor's `{npcLeaseShareOfGross}` −`{fd}` · Held toward your own truck −`{fd}` (when the deposit applies) · **Yours `{fd}` FD** · Paid `{date}` |
| Feed | Delivered `{Dallas}` to `{Charlotte}`: `{total}` FD, `{yours}` FD yours after fuel, tolls and the lessor's `{pct}`. Paid `{date}`. |

## S8 Money

| Where | String |
|---|---|
| Cash | Cash · `{fd}` FD · Cash, last `{n}` days |
| Owed to you | Owed to you · columns Load · FD · Due · empty: Nothing owed yet. Your first invoice lands here. |
| This week's costs | This week's costs · Lease minimum · Insurance · Yard · Per diem |
| Standing | Standing · Loaded miles `{Miles}` · Miles: your standing in the beta. |
| Loans (folded) | Loans · A loan on a truck you own: up to `{equipmentFinance.maxLoanToValue}` of its value, `{weeklyRate}` a week, over `{termWeeks}` weeks. Miss `{missedPaymentsToRepossess}` payments and the lender takes the truck. · Truck `{n}`: borrow up to `{fd}` FD · **Borrow** · Loan on truck `{n}`: `{fd}` FD owed · `{n}` missed · **Repay** |
| In the red | You're in the red. `{insolvency.weeksInDebt}` weekly checks in a row more than `{insolvency.debtLimitFd}` FD under and the company is wound up. |
| Wound up (feed) | The company is wound up: the trucks are sold, and you start again on a lease. |

## S9 Before you go (Dispatcher)

| Where | String |
|---|---|
| Caption | Next round `{hh:00}`. Set your dispatcher before you go. · **Set the dispatcher** |
| Card | Your dispatcher · switch: Bid for me while I'm away · Bid at break-even plus `[ ]` % · Send the truck empty up to `[ ]` mi · Bring me home after `[ ]` days · **Save** · More rules |
| Off (before the first hand bid) | Your dispatcher waits until you've placed a bid yourself. |
| More rules | Never below break-even plus `[ ]` % · Book loads between rounds at break-even plus `[ ]` % · Move idle trucks to busier hubs after `[ ]` idle rounds · Contracts: take offers from local shippers and `{honor every tender / let one lapse when spot is {pct} above the contract}` |
| Toasts | Dispatcher saved. · Dispatcher back to defaults. |

## Iuliia

The sheet shows **Say**; the caption under her portrait shows **Do**; **More** opens the Iuliia tab, where the full paragraphs of `walkthrough.ts` stay, with these edits: "Davai" → "Go on"; step 9 "the Dealer tab" → "Buy your own truck, on Fleet"; step 10 "the Staff tab" → "Staff, on Fleet"; step 12 "the Business tab" → "the yard, on Fleet"; step 13 "the Logbook tab and at the top beside your cash" → "Money, under Standing". The end card ("Every step on my clipboard is ticked, in ink…") stays.

| Step | Say (the sheet) | Do (the caption) |
|---|---|---|
| 1 Welcome aboard | Good morning. Iuliia, with two i's; my mother was thorough. This is `{hub}`, your home. Let's find a load. | Show me the board. |
| 2 Reading the board | Each line is a lane, the miles and a rate. Pick one near your truck, bid above your break-even, and let the round clear. | Bid on a load leaving `{hub}`. |
| 3 The truck rolls | You won one. Now the slow part, which is most of trucking. `{hos.drivingHoursPerDay}` driving hours a day, fuel every 400 miles, docks with their own hours. | Watch the ETA. Note where it sleeps tonight. |
| 4 Getting paid | Delivered. The money lands on the due day, not today. Money shows what you're owed and when; quick pay brings it forward for `{quickPayPct}`, an instrument for emergencies, not a policy. | Find your first invoice on Money. |
| 5 The reload | Empty trailer, far end of the country. Nearest load first: driving home empty is how a good load becomes a bad week. | Pick the next load from Find loads, nearest first. |
| 6 What it costs to exist | The page nobody enjoys: fuel, insurance, tolls, taxes, idling. Read it weekly, like an executive, with tea. `{insolvency.weeksInDebt}` checks in a row more than `{debtLimitFd}` FD under and the company is wound up. | Compare revenue against costs on Money. |
| 7 Keeping it on the road | Condition falls with the miles, and a worn truck breaks down, usually in the rain. Repairs at home are cheaper than repairs away. | Check the condition bar; plan the rebuild before it's urgent. |
| 8 The law | Weigh stations pull trucks in; inspections stay on your record two years. Tired drivers break rules, and home time is cheaper than fines. | Find your safety rating on Company. |
| 9 Your first truck | The lessor's `{npcLeaseShareOfGross}` ends the day you buy. Buy the used one first; ambition is for the second truck. | Buy a rig from the used lot, with a purchase loan if the cash is short. |
| 10 Hiring a driver | A second truck needs a second driver. Pay decides who takes the job; home time decides who stays. | Hire a driver for the second truck at a pay the market will take. |
| 11 Standing orders | Nobody bids every load by hand past two trucks. Your dispatcher's rules run the trucks you don't touch. | Set the bidding rule and the home-time rule, then watch a round clear. |
| 12 The yard | Past `{token.catalogue.trucksWithoutYard}` trucks you need a yard: park, drop trailers, swap them. That's how one truck does two jobs. | Buy a small yard; add trailer space as the fleet grows. |
| 13 Miles | Every loaded mile earns Miles: your standing in the beta, on Money. The Report button reaches me, and I read every one. | Open Standing on Money, then the road ahead. |
