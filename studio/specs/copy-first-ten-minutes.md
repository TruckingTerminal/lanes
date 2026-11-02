# Copy: the first ten minutes (writer, draft 4, 2026-11-02; against UX draft 4)

Every string on sprint 1's screens, keyed to `specs/first-ten-minutes.md`. `{key}` is read from `economy.config.ts`, never typed; `{x}` without a key is a value from the world. Sentence case; terms per `copy-audit.md`. A string not listed stays as it is. Tabs: Truck · Loads · Money · More; "the board" is the thing on Loads, never a label.

## S0 Login

Nothing to read: the title loop and one button. Connection states live on the button, never in a card.

| Where | String |
|---|---|
| Live, signed out | Sign in |
| Live, signed in, no company | Enter the world |
| Live, signed in, with a company | Continue · `{company}` |
| Button states | Connecting… · Can't reach the world · Retry |
| Test, saved world | Continue · `{company}`, day `{n}` |
| Test, new | New test world |
| Test, replacing a saved world | This replaces `{company}`. · Replace it · Keep it |
| Test, first two game days | Starting the world… |
| ≡ menu | Report a bug or an idea · Full screen |
| Gone | the taglines, the join and test cards, the hub table, "Start hauling", the beta line, the theme picker |

## Chrome

| Where | String |
|---|---|
| Strip | `{Tue 06:00}` · `{cash}` FD · alert dot, title "Needs you: `{n}`" · ≡ · test build: Paused · 1× · 10× · 30× |
| Nav | Truck · Loads · Money · More ("Trucks" from the second truck) |
| More | Iuliia · Help · Company · opened teasers, dot "New" · Coming soon |
| Teaser row / card | `{name}` · Opens `{trigger}` / what it is · Iuliia's line · Opens `{trigger}` · **Tell us what you'd want here** · The road ahead |

### The teasers

| Teaser | What it is | Iuliia | Opens |
|---|---|---|---|
| Staff | Drivers and dispatchers: who you hire, what you pay, who stays. | You'll need one at the second truck, or sooner if a seat is empty. | at your second truck, or a truck without a driver |
| Dealer | New, used and leased rigs, and trailers of your own. | I'll say when it's time to buy. The first one is arithmetic. | when Iuliia says so |
| Rates | What each hub pays, by trailer, and which way freight runs. | Useful once you've been paid and know what a rate is. | at your first delivery |
| Logbook | What your Miles become, and when. | It opens with the token, and not before. | at the token's launch |
| Finance | Getting paid faster, and what that costs. | A second truck makes it worth reading. | at your second truck |
| Economy | The market's own books: what comes in, what goes out. | A month in, you'll want it. | at the first monthly report |
| Business | Yards, shops, truck stops, warehouses. | Nobody needs a warehouse in week one. | on day `{unlockLadder.layers.businesses.afterDays}` |
| Back Lot | A later beta. | A later chapter. I don't give away the plot. | with a later beta |

## S1 First entry: choosing a home

| Where | String |
|---|---|
| Strip, before a company | `{Wed Jan 3}` · `{08:14}` · Next round `{hh:00}` · ≡ |
| Iuliia, 1 | I'm Iuliia, your guide. This is America's freight market, live: every truck you see is real and moving. First, pick a home city. · **Next** |
| Iuliia, 2 | Three ringed cities take new carriers. Tap one to start, or any other to see its freight. |
| Under her line | the three starter cards · **All hubs** (list header: All hubs · busiest first) |

### The hub card

| Where | String |
|---|---|
| The hub | `{hub name}` · the character line (below) · the season line (below) |
| Freight now | Freight now · `{n}` loads posted last round · `{rate}`/mi average · `{x}` loads per truck · `{hot / busy / even / slow}` · Ships `{more than / about what / less than}` it receives · Reload: `{easy / fair / hard}` |
| Who's here | Who's here · Carriers based here: `{few / a fair share / many}` (`crowdWord`) · Shippers hold `{pct}` of van loads for locals first |
| What it costs to live here | What it costs to live here · Insurance: `{pct}` `{above / below}` the base rate, or "at the base rate" · Yard: `{fd}` FD a week per truck past the first · Cargo theft: `{twice / three times / x times}` a quiet road's (only where above 1) |
| Outbound by trailer | Outbound by trailer · Van `{strong / even / thin}` · Reefer `{…}` · Flatbed `{…}` |
| Buttons | **See the board** · **Start here** |
| Not a starter hub (`NAMING.notStarter`, where Start here would be) | `{hub}` is a fine place to deliver to, not yet a place to live. The ringed cities are. |
| The board, read-only | the S2 card without chip or buttons · footer: Start here to bid on these. · Back |

No multipliers on the card ("×1.20", "1.1×", "2.0×"): the style sheet's rule; the words above carry the same figure.

### The season line

On every hub card, the three starters and the All hubs list alike. `{month}` is the game calendar's current month, spelled out ("May"), never the real one. The state is the economy designer's measure for that hub and month, thresholds as config keys they name; the writer owns only the words.

| State | String |
|---|---|
| Thin | Freight is thin here in `{month}`. A new carrier waits. |
| A little thin | A little thin in `{month}`; the good loads go early. |
| Fine | Freight is good here in `{month}`. |
| Fine, season running high | Busy season out of `{hub}` in `{month}`. |

### The starter hubs

Each character line is true to today's hub table; if the economy's figures move, the line moves with them. The default name fills the field and is generic on purpose.

| Hub | Character | Default company name |
|---|---|---|
| Dallas | The middle of the country. Freight leaves in every direction, and so will you. | Trinity River Freight |
| Los Angeles | The ports, day and night. Plenty of van freight out, crowded, and dear to insure. | Harbor Gate Transport |
| Phoenix | More trucks come in than freight goes out, but locals get first call and living here is cheap. | Saguaro Line Freight |
| Chicago (if Los Angeles fails its check) | Where the rails and the interstates meet. Freight to anywhere, most of the year. | Lakefront Hauling |
| Any other hub | no character line; the season line only | none: it can't be a home yet |

### Naming the company and arriving

| Where | String |
|---|---|
| Iuliia, naming | `{hub}`. Good. Home is where this company stays. What do we call it? |
| Field | Company name (default per hub, above; 32 characters) |
| Test build only | How you start · Owner-operator. The live world's start. / Small fleet. Two used trucks and `{startingGrantFd + 20_000}` FD, to test the fleet game. |
| Buttons | **Start at `{hub}`** · Back |
| Live, while the act lands | Opening your authority… |
| Map not drawn | Finding `{hub}`… |
| Your sprite | You |
| Iuliia, arrival | This is `{hub}`, your home. One leased Workhorse, a dry van, and you driving. The lessor keeps `{costs.npcLeaseShareOfGross}` of every load. Let's find one. · **Show me the board** |
| Ticker, before the first bid | The first load is your call. Bids clear at `{r1}` and `{r2}`. |

## S2 Loads

| Where | String |
|---|---|
| Header | Loads from `{hub}` · `{n}` · next round `{hh:00}` (in `{wait}`) |
| Truck selector | Truck `{n}` · `{trailer}` |
| Card line 1 / 2 | `{Dallas, TX}` → `{Charlotte, NC}` · `{miles}` mi / `{total}` FD · `{rate}`/mi · `{dh}` mi empty |
| Chips | +`{profit}` FD at book-now · −`{loss}` FD at book-now · +`{profit}` FD at `{suggest}` |
| Blocked chips | Needs `{vetting.standard.minAuthorityDays}`-day authority · day `{d}` · Needs `{vetting.strict.minAuthorityDays}`-day authority or `{strict.minDelivered}` loads · Local carriers first this round · A hot load needs a team |
| Sort | Nearest · Best pay · Deliver by |
| Filter | Filter · Destination · Anywhere · Empty miles, max · Commodity or place (placeholder "produce, Tulsa") · Rates by hub · Table (laptop) |
| Truck busy | Your truck is on the road · loads show when it's free · ETA `{date}` |
| Nothing in range | Nothing for a `{dry van}` within `{maxDh}` mi of `{hub}` this round · next round `{hh:00}` · **Widen the search** |

## S3 Load

| Where | String |
|---|---|
| Back | Loads |
| Route | Pick up: `{Dallas, TX}` · now · Deliver by: `{Jan 7 02:36}` · `{Charlotte, NC}` · Miles: `{loaded}` loaded · `{empty}` empty · Driving: `{h}` h · Reload at `{dest}`: `{good / fair / poor}` · about `{mi}` mi empty to the next |
| The money | Book now: `{total}` FD · `{rate}`/mi · Your break-even: `{be}`/mi · Profit at book-now: `{profit}` FD · Usually clears near: `{ref}`/mi · Ceiling: `{ceiling}`/mi |
| Shipper | `{name}` · On time: `{pct}` · Vetting: `{open / standard / strict}` |
| More about this load | Commodity · Cargo value · Tolls (none) · Two-lane `{pct}` · Season: normal / in season +`{pct}` / off season −`{pct}` · Load #`{id}` |
| Actions | **Book now · `{rate}`/mi · `{profit}` FD** · − `{bid}` + · range `{lo}`–`{hi}` · **Bid · `{profit}` FD** · Change bid · Withdraw |
| Sent (live) / Blocked | Sent · in effect `{hh:mm}` / Not yet: `{reason}`. |
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
| Won | Won `{origin}` → `{dest}` at `{rate}`/mi · `{total}` FD · OK |
| Lost / nobody took it | Lost to `{winning}`/mi · your bid `{rate}` · your break-even `{be}` / Nobody took it this round · your bid `{rate}` · **Bid again** |
| Feed | Won `{Dallas}` to `{Charlotte}`, `{miles}` mi at `{rate}`/mi, your bid / your dispatcher's bid. · Lost `{Dallas}` to `{Charlotte}` at `{rate}`/mi: it went for `{winning}`/mi / nobody took it this round. |

## S6 Rolling (Truck)

| Where | String |
|---|---|
| Truck card | Truck `{n}` · Workhorse · `{Dry van}` · leased: the lessor keeps `{npcLeaseShareOfGross}` of every load / owned · worth `{fd}` FD · `{origin}` → `{dest}` · `{miles}` mi · ETA `{Jan 7 02:36}` · chip On time / Late `{h}` h |
| Waiting (before the first bid) | Waiting at `{hub}` · the first load is your call · **Show me the board** · strip: Truck 1 · Waiting at `{hub}` · round `{hh:00}` |
| Idle (after it) | Idle at `{place}` · next round `{hh:00}` · other status lines unchanged |
| Map | Follow |
| Needs you | Needs you |
| Tired, Idle | The audit's rewrites (`copy-audit.md`, Tired alert and idle alert rows) · buttons **Send home · `{mi}` mi** · **Send empty to `{hub}` · `{mi}` mi** · Bid by hand |
| No driver | Truck `{n}` has no driver and earns nothing. · **Hire a driver** |
| Today | Today |

## S7 Delivered

| Where | String |
|---|---|
| Card | Delivered `{Dallas}` to `{Charlotte}` · chip On time / Late `{h}` h |
| Rows | The load `{fd}` · Fuel −`{fd}` · Tolls −`{fd}` · The lessor's `{npcLeaseShareOfGross}` −`{fd}` · Held toward your own truck −`{fd}` (when the deposit applies) · **Yours `{fd}` FD** · Paid `{date}` |
| Feed | Delivered `{Dallas}` to `{Charlotte}`: `{total}` FD, `{yours}` FD yours after fuel, tolls and the lessor's cut. Paid `{date}`. |

## S8 Money

| Where | String |
|---|---|
| Cash | Cash · `{fd}` FD · Cash, last `{n}` days |
| Owed to you | Owed to you · Load · FD · Due · empty: Nothing owed yet. Your first invoice lands here. |
| This week's costs | This week's costs · Lease minimum · Insurance · Yard · Per diem |
| Standing | Standing · `{n}` Miles · your standing in the beta |
| Loans (fold) | Loans · A loan on a truck you own: up to `{equipmentFinance.maxLoanToValue}` of its value, `{weeklyRate}` a week, over `{termWeeks}` weeks. Miss `{missedPaymentsToRepossess}` payments and the lender takes the truck. · Truck `{n}`: borrow up to `{fd}` FD · **Borrow** · Loan on truck `{n}`: `{fd}` FD owed · `{n}` missed · **Repay** |
| The token (fold, below Loans) | The token · today's cards and the launch counter, unchanged (Jeff, 2026-11-02) |
| In the red | You're in the red. `{insolvency.weeksInDebt}` weekly checks in a row more than `{insolvency.debtLimitFd}` FD under and the company is wound up. |
| Wound up (feed) | The company is wound up: the trucks are sold, and you start again on a lease. |

## S9 Before you go (Dispatcher)

| Where | String |
|---|---|
| Before the first bid (one-truck company) | switch Bid for me while I'm away, off and disabled · Iuliia: Your first load is your call. After that, your dispatcher can bid while you're away. |
| Iuliia, after the first bid | From now on your dispatcher bids when you don't. Check the rules before you go. · **See the dispatcher** |
| Card | Your dispatcher · switch: Bid for me while I'm away (on) · Bid at break-even plus `[ ]` % · Send the truck empty up to `[ ]` mi · Bring me home after `[ ]` days · **Save** · More rules |
| More rules | Never below break-even plus `[ ]` % · Book loads between rounds at break-even plus `[ ]` % · Move idle trucks to busier hubs after `[ ]` idle rounds · Contracts: today's row, unchanged |
| Toasts | Dispatcher saved. · Dispatcher back to defaults. |

## Iuliia

Say lines are 25 words or fewer; the sheet shows **Say**, the caption **Do**. The full paragraphs of `walkthrough.ts` stay on the Iuliia tab with these edits: "Davai" → "Go on"; "the Fleet tab" → "the Truck tab";  "the Company tab", "the Dealer tab", "the Staff tab", "the Business tab" → "Company / Dealer / Staff / Business, under More"; step 13's "the Logbook tab and at the top beside your cash" → "Money, under Standing". Step 1's full text keeps both old paragraphs, with "The Fleet tab is your truck; the map is everyone's trucks. Find your home hub on it." → "The map is everyone's trucks; the ringed cities are good homes." Step 1 ticks on **Start at `{hub}`**. The end card stays.

| Step | Say | Do |
|---|---|---|
| 1 Choose your home | Three ringed cities take new carriers. Tap one to start, or any other to see its freight. | Choose your home: tap a ringed hub, then Start here. |
| 2 Reading the board | Each line is a lane, the miles and a rate. Pick one near your truck, bid above break-even, and let the round clear. | Bid on a load leaving `{hub}`. |
| 3 The truck rolls | You won one. Now the slow part, most of trucking: `{hos.drivingHoursPerDay}` hours of driving a day, fuel, and docks with their own hours. | Watch the ETA. Note where it sleeps tonight. |
| 4 Getting paid | Delivered. The money lands on the due day, not today; Money shows what you're owed and when. Quick pay costs a fee. | Find your first invoice on Money. |
| 5 The reload | Empty trailer, far end of the country. Nearest load first: driving home empty turns a good load into a bad week. | Pick the next load from Find loads, nearest first. |
| 6 What it costs to exist | The page nobody enjoys: fuel, insurance, tolls, taxes, idling. Read it weekly, like an executive, with tea. Keep a cushion. | Compare revenue against costs on Money. |
| 7 Keeping it on the road | Condition falls with the miles, and a worn truck breaks down, usually in the rain. Repairs at home are cheaper than away. | Check the condition bar; plan the rebuild before it's urgent. |
| 8 The law | Weigh stations pull trucks in; inspections stay on your record two years. Tired drivers break rules; home time is cheaper than fines. | Find your safety rating on Company. |
| 9 Your first truck | The lessor's `{npcLeaseShareOfGross}` ends the day you buy. Buy the used one first; ambition is for the second truck. | Buy a rig from the used lot, with a purchase loan if the cash is short. |
| 10 Hiring a driver | A second truck needs a second driver. Pay decides who takes the job; home time decides who stays. | Hire a driver at a pay the market will take. |
| 11 Standing orders | Nobody bids every load by hand past two trucks. Your dispatcher's rules run the trucks you don't touch. | Set the bidding and home-time rules, then watch a round clear. |
| 12 The yard | Past `{token.catalogue.trucksWithoutYard}` trucks you need a yard: park, drop trailers, swap them. That's how one truck does two jobs. | Buy a small yard; add trailer space as the fleet grows. |
| 13 Miles | Every loaded mile earns Miles: your standing in the beta, on Money. The Report button reaches me, and I read every one. | Open Standing on Money, then the road ahead. |
