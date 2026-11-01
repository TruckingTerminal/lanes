# Copy: the first ten minutes (writer, draft 2, 2026-11-02; against UX draft 3)

Every string on sprint 1's screens, keyed to `specs/first-ten-minutes.md`. `{key}` is read from `economy.config.ts`, never typed; `{x}` without a key is a value from the world. Sentence case; terms per `copy-audit.md`. A string not listed stays as it is. Draft 2 applies UX draft 3: Truck · Board · Money · More, the teasers in More, the token folded, the waiting state.

## S0 Title and forms

| Where | String |
|---|---|
| Tagline, live | One shared world, on the real clock. You start with one leased truck. |
| Tagline, test build | Test build: the whole game against the AI, with pause and speed. |
| Join card title / lead | Join the live world / One world, shared by every player, on the real clock: a game day every `{time.realHoursPerGameDayLive}` real hours. It never pauses, nothing resets, and every order stands. |
| Fields | Company name (default "Lone Star Freight") · Home hub |
| Hub card, line 2 | `{hub}` · freight `{strong / even / thin}` · `{few / a fair share of / many}` carriers (outbound balance; `homeCrowding`) |
| Start line | Everyone starts the same way: one leased Workhorse with a dry van, `{company.startingGrantFd}` FD, and you driving. The lessor keeps `{costs.npcLeaseShareOfGross}` of every load. Go broke and you start again on a lease. |
| Buttons | Start hauling · Test world: private, pausable |
| Test form lead | A private copy of the rules with only you and the AI in it. Pause it, run it fast. It stays in this browser, and a new one replaces it. |
| How you start | Owner-operator. The live world's start. / Small fleet. Two used trucks and `{startingGrantFd + 20_000}` FD, to test the fleet game. |
| Connection cards | Couldn't reach the world: The live world didn't answer. Try again in a moment. · Sign in to play: The live world lives on claude.ai. Sign in there and open this page again. · others unchanged |
| Menu | Title screen · Full screen · Report a bug or an idea · lead lines unchanged |

## Chrome

| Where | String |
|---|---|
| Strip | `{Tue 06:00}` · `{cash}` FD · alert dot, title "Needs you: `{n}`" · ≡ · test build: Paused · 1× · 10× · 30× |
| Nav | Truck · Board · Money · More (Truck reads "Trucks" from the second truck) |
| Strip line, before the first bid | Truck 1 · Waiting at `{hub}` · round `{hh:00}` |
| More, top to bottom | Iuliia · Help · Company · the opened teasers (dot "New") · Coming soon |
| Teaser row | `{name}` · lock · Opens `{trigger}` |
| Teaser card | two lines on what it is · Iuliia's line · Opens `{trigger}` · **Tell us what you'd want here** · The road ahead |
| Report card, Watching cards | Unchanged. |

### The teasers

| Teaser | What it is | Iuliia | Opens |
|---|---|---|---|
| Staff | Drivers and dispatchers: who you hire, what you pay, who stays. | You'll need one when the second truck arrives, or sooner if a seat is empty. | at your second truck, or a truck without a driver |
| Dealer | New, used and leased rigs, and trailers of your own. | I'll say when it's time to buy. The first one is arithmetic. | when Iuliia says so |
| Rates | What each hub pays, by trailer, and which way the freight runs. | Useful once you've been paid and know what a rate is. | at your first delivery |
| Logbook | The record of what you've hauled. | Your first delivery opens it. | at your first delivery |
| Finance | Getting paid faster, and what that costs. | A second truck makes it worth reading. | at your second truck |
| Economy | The market's own books: what comes in, what goes out. | A week in, you'll want it. | on day 7 |
| Business | Yards, shops, truck stops, warehouses. | Nobody needs a warehouse in week one. | on day `{unlockLadder.layers.businesses.afterDays}` |
| Back Lot | Unchanged. | A later chapter. I don't give away the plot. | with its layer |

## S1 Arrival

| Where | String |
|---|---|
| Map not drawn | Finding `{hub}`… |
| Your sprite | You |
| Sheet | Iuliia, step 1 (below) · button **Show me the board** |
| Ticker, before the first bid | The first load is your call. Bids clear at `{r1}` and `{r2}`. |

## S2 Board

| Where | String |
|---|---|
| Header | Loads from `{hub}` · `{n}` · next round `{hh:00}` (in `{wait}`) |
| Truck selector | Truck `{n}` · `{trailer}` |
| Card line 1 / 2 | `{Dallas, TX}` → `{Charlotte, NC}` · `{miles}` mi / `{total}` FD · `{rate}`/mi · `{dh}` mi empty |
| Chips | +`{profit}` FD at book-now · −`{loss}` FD at book-now · +`{profit}` FD at `{suggest}` |
| Blocked chips | Needs `{vetting.standard.minAuthorityDays}`-day authority · day `{d}` · Needs `{vetting.strict.minAuthorityDays}`-day authority or `{strict.minDelivered}` loads · Local carriers first this round · A hot load needs a team |
| Sort | Nearest · Best pay · Deliver by |
| Filter | Filter · Destination · Anywhere · Empty miles, max · Commodity or place (placeholder "produce, Tulsa") · Rates by hub · Table (laptop) |
| Truck busy | Your truck is on the road · loads show when it's free · ETA `{Jan 7 02:36}` |
| Nothing in range | Nothing for a `{dry van}` within `{maxDh}` mi of `{hub}` this round · next round `{hh:00}` · **Widen the search** |

## S3 Load

| Where | String |
|---|---|
| Back | Board |
| Route | Pick up: `{Dallas, TX}` · now · Deliver by: `{Jan 7 02:36}` · `{Charlotte, NC}` · Miles: `{loaded}` loaded · `{empty}` empty · Driving: `{h}` h · Reload at `{dest}`: `{good / fair / poor}` · about `{mi}` mi empty to the next |
| The money | Book now: `{total}` FD · `{rate}`/mi · Your break-even: `{be}`/mi · Profit at book-now: `{profit}` FD · Usually clears near: `{ref}`/mi · Ceiling: `{ceiling}`/mi |
| Shipper | `{name}` · On time: `{pct / —}` · Vetting: `{open / standard / strict}` |
| More about this load | Commodity · Cargo value · Tolls (none) · Two-lane `{pct}` · Season: normal / in season +`{pct}` / off season −`{pct}` · Load #`{id}` |
| Actions | **Book now · `{rate}`/mi · `{profit}` FD** · − `{bid}` + · range `{lo}`–`{hi}` · **Bid · `{profit}` FD** · Change bid · Withdraw |
| Sent (live) | Sent · in effect `{hh:mm}` |
| Blocked | Not yet: `{reason}`. |
| Refused | The engine's reason, sentence case, under the button. No toast. |

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

## S6 Rolling (Truck)

| Where | String |
|---|---|
| Truck card | Truck `{n}` · Workhorse · `{Dry van}` · leased: the lessor keeps `{npcLeaseShareOfGross}` of every load / owned · worth `{fd}` FD · `{origin}` → `{dest}` · `{miles}` mi · ETA `{Jan 7 02:36}` · chip On time / Late `{h}` h |
| Waiting (before the first bid) | Waiting at `{hub}` · the first load is your call · **Show me the board** |
| Idle (after it) | Idle at `{place}` · next round `{hh:00}` (replaces "sat out n rounds"); the other status lines unchanged. |
| Map | Follow |
| Needs you | Needs you |
| Tired, Idle | The audit's rewrites (`copy-audit.md`, Tired alert and idle alert rows) · buttons **Send home · `{mi}` mi** · **Send empty to `{hub}` · `{mi}` mi** · Bid by hand |
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
| Standing | Standing · Loaded miles `{n}` of `{total}` |
| Loans (fold) | Loans · A loan on a truck you own: up to `{equipmentFinance.maxLoanToValue}` of its value, `{weeklyRate}` a week, over `{termWeeks}` weeks. Miss `{missedPaymentsToRepossess}` payments and the lender takes the truck. · Truck `{n}`: borrow up to `{fd}` FD · **Borrow** · Loan on truck `{n}`: `{fd}` FD owed · `{n}` missed · **Repay** |
| The token (fold) | The token · today's cards, Miles and the launch counter, unchanged (Jeff, 2026-11-02) |
| In the red | You're in the red. `{insolvency.weeksInDebt}` weekly checks in a row more than `{insolvency.debtLimitFd}` FD under and the company is wound up. |
| Wound up (feed) | The company is wound up: the trucks are sold, and you start again on a lease. |

## S9 Before you go (Dispatcher)

| Where | String |
|---|---|
| Iuliia, after the first bid | From now on your dispatcher bids when you don't. Check the rules before you go. · **See the dispatcher** |
| Card | Your dispatcher · switch: Bid for me while I'm away (on) · Bid at break-even plus `[ ]` % · Send the truck empty up to `[ ]` mi · Bring me home after `[ ]` days · **Save** · More rules |
| More rules | Never below break-even plus `[ ]` % · Book loads between rounds at break-even plus `[ ]` % · Move idle trucks to busier hubs after `[ ]` idle rounds · Contracts: take offers from local shippers and `{honor every tender / let one lapse when spot is {pct} above the contract}` |
| Toasts | Dispatcher saved. · Dispatcher back to defaults. |

## Iuliia

Say lines are 25 words or fewer; the sheet shows **Say**, the caption **Do**. The full paragraphs of `walkthrough.ts` stay on the Iuliia tab with these edits: "Davai" → "Go on"; "the Fleet tab" → "the Truck tab" (steps 1, 3, 11); "the Loads tab" → "the Board" (step 2); "the Company tab" → "Company, under More" (step 8); "the Dealer tab", "the Staff tab", "the Business tab" → "Dealer / Staff / Business, under More" (steps 9, 10, 12); "the Logbook tab and at the top beside your cash" → "Money, under Standing" (step 13). The end card stays.

| Step | Say | Do |
|---|---|---|
| 1 Welcome aboard | Good morning. Iuliia, with two i's; my mother was thorough. This is `{hub}`, your home. Let's find a load. | Show me the board. |
| 2 Reading the board | Each line is a lane, the miles and a rate. Pick one near your truck, bid above your break-even, and let the round clear. | Bid on a load leaving `{hub}`. |
| 3 The truck rolls | You won one. Now the slow part, which is most of trucking. `{hos.drivingHoursPerDay}` driving hours a day, fuel every 400 miles, docks with their own hours. | Watch the ETA. Note where it sleeps tonight. |
| 4 Getting paid | Delivered. The money lands on the due day, not today; Money shows what you're owed and when. Quick pay brings it forward, for a fee. | Find your first invoice on Money. |
| 5 The reload | Empty trailer, far end of the country. Nearest load first: driving home empty is how a good load becomes a bad week. | Pick the next load from Find loads, nearest first. |
| 6 What it costs to exist | The page nobody enjoys: fuel, insurance, tolls, taxes, idling. Read it weekly, like an executive, with tea. Keep a cushion; it's cheaper than a restart. | Compare revenue against costs on Money. |
| 7 Keeping it on the road | Condition falls with the miles, and a worn truck breaks down, usually in the rain. Repairs at home are cheaper than repairs away. | Check the condition bar; plan the rebuild before it's urgent. |
| 8 The law | Weigh stations pull trucks in; inspections stay on your record two years. Tired drivers break rules, and home time is cheaper than fines. | Find your safety rating on Company. |
| 9 Your first truck | The lessor's `{npcLeaseShareOfGross}` ends the day you buy. Buy the used one first; ambition is for the second truck. | Buy a rig from the used lot, with a purchase loan if the cash is short. |
| 10 Hiring a driver | A second truck needs a second driver. Pay decides who takes the job; home time decides who stays. | Hire a driver for the second truck at a pay the market will take. |
| 11 Standing orders | Nobody bids every load by hand past two trucks. Your dispatcher's rules run the trucks you don't touch. | Set the bidding rule and the home-time rule, then watch a round clear. |
| 12 The yard | Past `{token.catalogue.trucksWithoutYard}` trucks you need a yard: park, drop trailers, swap them. That's how one truck does two jobs. | Buy a small yard; add trailer space as the fleet grows. |
| 13 Miles | Every loaded mile counts: your standing, on Money. The Report button reaches me, and I read every one. | Open Standing on Money, then the road ahead. |
