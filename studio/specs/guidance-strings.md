# Guidance strings (writer, draft 3, 2026-11-03; the director's gate W1–W5 applied)

Jeff, 2026-11-02: "I need to make sure that Iuliia is guiding people every step of the way. As this is a true sim and very complex."

Three tables: **What now?** (one per rule in the director's order), the **milestones** to day 91, and the **explain** table for the first month's figures. Keys are dotted like `copy.ts`, so engineering's `nextAction`, milestone and `explain.ts` coverage tests can read them. `{key}` is a config key; `{x}` without a key is a figure `guide.ts` computes for this company. No string over 20 words.

**The registers.** Every What now? reason, every explain entry and every milestone about money, debt or risk is plain, with no joke. Humor is allowed only in the milestone lines marked *light*. No line advises buying or selling FD, frames a stake as a return, or names the Back Lot.

Short config keys used below:

| Short | Config key |
|---|---|
| `{weeksInDebt}`, `{debtLine}` | `insolvency.weeksInDebt`, `insolvency.debtLimitFd` |
| `{quickPayPct}`, `{termsDays}` | `token.payment.quickPayPct`, `token.payment.termsDays` |
| `{leaseMin}` | `freeEntry.leases.minWeeklyFd` |
| `{tenderHours}` | `contracts.tenderHours` |
| `{carryCap}` | `seasonClose.carryoverCapFd` |
| `{businessDay}`, `{brokerDay}` | `unlockLadder.layers.businesses.afterDays`, `.brokerage.afterDays`, as game dates |
| `{lessorShare}` | `costs.npcLeaseShareOfGross` |
| `{fuelTaxPerGal}` | `costs.fuelTax.perGal` |
| `{gapCushionWeeks}` | `guide.gapCushionWeeks` (new; engineering's `guide.ts` reads the same key) |
| `{cushionAvgWeeks}` | `guide.cushionAvgWeeks` (new; the same) |
| `{restartAfterDays}` | `insolvency.restartAfterDays` |
| `{cashNow}` | the switch for cashing open invoices now (Jeff, 2026-11-02); the economy names it and sizes the aging surcharge and the spot rate **[size]** |
| `{priorLoads}` | `reputation.priorLoads` |
| `{downLow}`–`{downHigh}`, `{rateLow}`–`{rateHigh}`, `{loanStake}` | `equipmentFinance.purchase.downShare`, `.weeklyRate`, `.stakeShare` |

## 1. What now?

Three parts each: the action, the reason, the button. The first rule whose condition holds wins.

### Rule 1: the company is in danger

The reason line is shared; the action is the best single lever `nextAction` finds.

| Key | Part | String |
|---|---|---|
| `now.danger.reason` | reason | `{n}` of `{weeksInDebt}` weekly checks in debt. The next is `{day}`. |
| `now.danger.warn` | reason, before the first | The next weekly check is `{day}`. You'd be `{fd}` FD under the line. |
| `now.danger.book.action` | action | Book a load for Truck `{n}` today. |
| `now.danger.book.button` | button | Show me its loads |
| `now.danger.cash.action` [switch cashNow] | action, offered first | Cash the invoices due by `{day}`. |
| `now.danger.cash.reason2` [switch cashNow] | second line, under a contract | `{fd}` FD lands today, less `{fd}` FD in fees: your contract rate plus aging. |
| `now.danger.cash.reason2Spot` [switch cashNow] | second line, no contract | `{fd}` FD lands today, less `{fd}` FD in fees at the spot rate. |
| `now.danger.cash.button` [switch cashNow] | button | Cash them now |
| `now.danger.collect.action` [switch off, or nothing to cash] | action | Keep the trucks loaded until your invoices land. |
| `now.danger.collect.reason2` | second line | `{fd}` FD is due to you by `{day}`, in time for the check that counts. |
| `now.danger.collect.quick` | third line | Quick pay would pay each new load on delivery, less `{quickPayPct}`. Open invoices keep their dates. |
| `now.danger.collect.button` | button | Getting paid |
| `now.danger.lease.action` | action | Return the lease on Truck `{n}`. |
| `now.danger.lease.reason2` | second line | It costs at least `{leaseMin}` FD a week, earning or not. |
| `now.danger.lease.button` | button | Return the lease |
| `now.danger.sell.action` | action | Sell Truck `{n}`. |
| `now.danger.sell.reason2` | second line | It should fetch about `{fd}` FD. You're `{fd}` FD under the line. |
| `now.danger.sell.button` | button | Sell it |

### Rule 2: something is waiting on you

The most urgent item first, by deadline.

| Key | Part | String |
|---|---|---|
| `now.waiting.tender.action` | action | Answer `{shipper}`'s tender. |
| `now.waiting.tender.reason` | reason | It lapses at `{hh:mm}`. Accept it, or it goes to the open board. |
| `now.waiting.tender.button` | button | Show the tender |
| `now.waiting.offer.action` | action | Read `{shipper}`'s contract offer. |
| `now.waiting.offer.reason` | reason | `{origin}` to `{dest}` at `{rate}`/mi. The offer expires `{day}`. |
| `now.waiting.offer.button` | button | Show the offer |
| `now.waiting.lost.action` | action | Bid on `{origin}` to `{dest}` instead. |
| `now.waiting.lost.reason` | reason | You lost the last one. This load clears near `{rate}`/mi and pays `{fd}` FD over break-even. |
| `now.waiting.lost.button` | button | Show the load |
| `now.waiting.driver.action` | action | Hire a driver for Truck `{n}`. |
| `now.waiting.driver.reason` | reason | `{name}` has gone. A truck without a driver earns nothing. |
| `now.waiting.driver.button` | button | Hire a driver |
| `now.waiting.other` | action and button | the "Needs you" item's own text · Show me |

### Rule 3: a truck is idle, and loads in reach pay

| Key | Part | String |
|---|---|---|
| `now.idle.action` | action | Bid on `{origin}` to `{dest}`. |
| `now.idle.reason` | reason | Truck `{n}` is idle at `{hub}`. This load pays about `{fd}` FD over break-even. |
| `now.idle.reasonDispatcher` | reason, a dispatcher miss | Your dispatcher's rules skipped it: `{reason}`. It pays about `{fd}` FD over break-even. |
| `now.idle.button` | button | Show the load |

### Rule 4: a walkthrough step is current

| Key | Part | String |
|---|---|---|
| `now.step.action` | action | the step's Do line |
| `now.step.reason` | reason | the step's Why line |
| `now.step.button` | button | Go to `{tab}` |

### Rule 5: a milestone is near

| Key | Part | String |
|---|---|---|
| `now.gap.action` | action | Keep hauling toward your own truck. |
| `now.gap.reason` | reason | You're `{gap}` FD short, counting your deposit and `{gapCushionWeeks}` weeks of costs held back. |
| `now.gap.button` | button | See the Dealer |
| `now.cushion.action` | action | Build your cushion before you spend. |
| `now.cushion.reason` | reason | Your cash covers `{n}` weeks of your own spending. |
| `now.cushion.button` | button | Money |
| `now.factoringEnds.action` | action | Choose how you're paid after `{date}`. |
| `now.factoringEnds.reason` | reason | Your factoring contract ends in `{n}` days. |
| `now.factoringEnds.button` | button | Getting paid |
| `now.licence.action` | action | Keep hauling toward the brokerage. |
| `now.licence.reason` | reason | You're `{gap}` FD short of the bond, the licence and the first premium. |
| `now.licence.button` | button | What it takes |
| `now.seasonClose.action` | action | Spend on what earns before the season closes. |
| `now.seasonClose.reason` | reason | Cash above `{carryCap}` FD is burned at the close on `{day}`. You're `{fd}` FD over. |
| `now.seasonClose.button` | button | Money |

### Rule 6: nothing needs you

| Key | Part | String |
|---|---|---|
| `now.calm.action` | action | Nothing needs you right now. |
| `now.calm.reason` | reason | The next thing that will: `{event}`, in `{time}`. |
| `now.calm.button` | button | OK (UX's) |
| `now.event.round` · `.monthClose` · `.seasonClose` · `.layer` · `.licence` · `.factoring` | `{event}` | the next round · the month's close · the season's close · `{Businesses / Brokerage}` opening · your licence renewal · your factoring contract's end |

### While the company is being wound up, and after (W3)

The caption stays silent, unasked. Asked, What now? answers with these.

| Key | Part | String |
|---|---|---|
| `now.liquidating.action` | action | Your company is being wound up. |
| `now.liquidating.reason` | reason | Its trucks are being sold. You start again on a lease on `{day}`. |
| `now.liquidating.button` | button | What happens next (opens Help's "Going broke") |
| `now.restart.action` | action | Start again on a lease. |
| `now.restart.reason` | reason | The old company is closed. A new start: one leased truck, and no grant. |
| `now.restart.button` | button | Start again |

### No rule fits

| Key | Part | String |
|---|---|---|
| `now.none.action` | action | I don't have a sure answer for this one. |
| `now.none.reason` | reason | Help has every system and every number. |
| `now.none.button` | button | Open Help |

### UX's open strings (`guidance-ux.md`)

| Key | Where | String |
|---|---|---|
| `guide.discovery` | the caption, once, the first time a covered figure shows | Tap any number with a dotted line and I'll show you where it comes from. (UX's, kept) |
| `guide.nextPrefix` | the resting line after the walkthrough | Next: |
| `now.notNow` | beside every What now? button | Not now |
| `now.stepPrefix` | before rule 4's action | Step `{n}` of `{total}` · |
| `now.waitingMore` | after rule 2's reason | `{n}` of `{m}` waiting › |
| `now.stale` | the answer, when the world moved | That's changed. Ask me again. |
| `explain.heading.what` · `.how` · `.moves` | the sheet's three headings | What it is · How it's computed · What moves it |

## 2. Milestones to day 91

Each speaks once: a line **before** only where the date is known (the month close, day 28, day 91, the hired driver's payday, the next weekly check; UX's U2), and a line **at** the moment, plus one sentence of reason. Then What now? takes over. *Light* marks the only lines where humor is allowed.

| Key | Trigger | Before | At | Reason |
|---|---|---|---|---|
| `milestone.ownTruck` | step 9 done | (step 9 itself) | Your own truck. No lessor's share now, and no lessor to fix it. | Maintenance, insurance and value lost are yours, and a truck that sits still costs money. |
| `milestone.hiredWeek` | a hired driver's first payday | `{name}` is paid by the mile, weekly from `{day}`, plus a per diem for idle days away. | `{name}` has driven `{mi}` miles for you this week: `{fd}` FD in wages so far. | Your driver earns by the mile. An idle day away from home costs `{labor.driver.perDiemFd}` FD in per diem. |
| `milestone.dispatcher` *light* | a dispatcher hired, or the third truck | (none) | Your dispatcher starts today. It follows your rules exactly, including the foolish ones. | Check the rules against the lanes that actually paid. |
| `milestone.monthClose` | day 30 of the company | Your first month closes in `{n}` days. Monthly bills land with it. | Your first month: earned `{fd}`, spent `{fd}`, kept `{fd}` FD. | The fuel tax and insurance land at the close. Read the month on Money. |
| `milestone.day28` *light* | the businesses layer | Businesses open `{businessDay}`. Most first-month carriers should let them wait. | Businesses are open. Nobody needs a warehouse in week four; most need a second truck. | A business pays over years. Your gap to the next truck is `{gap}` FD. |
| `milestone.slump` | the demand dial under 0.9, the first time | (none: a slump gives no notice) | Rates are falling for everyone, not just you. Slumps end. | The carrier still here when it ends is the one who didn't buy in it. Your cushion: `{n}` weeks. |
| `milestone.debt` | the first weekly check in debt | The weekly check is `{day}`. At today's cash you'd be under the line. | You're in debt at a weekly check: 1 of `{weeksInDebt}`. Here is the way out. | `{weeksInDebt}` checks in a row under `{debtLine}` FD and the company is wound up. |
| `milestone.day91` | the brokerage layer | Brokerages open `{brokerDay}`. The bond is the hard part. | Brokerages are open. Here's what one takes, and how far you are. | Bond, licence and premium: you're `{gap}` FD short, or ready. |

## 3. Explain: the first month's figures

One entry per figure key. `what` and `moves` are the writer's; `how` is engineering's breakdown function, described here so the two match. Plain throughout.

### Cash

| Key | What it is | How it's computed | What moves it |
|---|---|---|---|
| `money.cash` | The FD in your company's account right now. | Every payment in, less every cost out, as they land. | Loads paid; fuel, wages, leases and loans going out. |
| `money.trend` | Your cash at each day's end, for the last weeks. | One point a day from the ledger. | The same as cash, seen over time. |
| `money.owed` | Invoices shippers owe you, and the day each is due. | Each delivered load on an owned truck, paid `{termsDays}` days later. | More deliveries. Quick pay or factoring pays new loads on delivery. [switch cashNow] Cash it now pays an open invoice today, for a fee. |

### On a load

| Key | What it is | How it's computed | What moves it |
|---|---|---|---|
| `board.profitChip` | What this load leaves you after your costs, at that price. | Rate times miles, less break-even times all the miles you'd drive. | The rate, the empty miles, and your own costs per mile. |
| `truck.breakEven` | The rate per mile that just covers this truck's costs on this load. | Fuel, maintenance, insurance, tolls and pay per mile, empty miles included, plus the lessor's share. | Fewer empty miles, cheaper fuel, a better-kept truck, owning instead of leasing. |
| `board.ceiling` | The most this shipper will pay per mile. | Set by the shipper from the lane's market when the load is posted. | The lane, the season, and how long the load has waited. |
| `board.clearsNear` | Where loads like this one usually go. | The recent winning rates on this lane and trailer. | The market: more trucks push it down, more freight pushes it up. |
| `board.bookNow` | The price that takes the load at once, with no round. | The shipper's posted offer, below its ceiling. | It rises the longer the load sits unbooked. |
| `board.bid` | Your offer per mile, decided at the next round. | The best bid under the ceiling wins, weighing price, record and empty miles. | Your price, your on-time record, how near your truck is. |
| `board.deadhead` | Miles your truck drives empty to reach the pickup. | Road miles from where your truck is to the load's origin. | Where your truck waits; nearer loads. |
| `truck.eta` | When the truck should arrive, waiting included. | Driving hours left, rest stops, and the dock's opening hours. | Hours of service, the weather, the road and the dock. |
| `truck.hosLeft` | Hours the driver may still drive today. | `{hos.drivingHoursPerDay}` hours a day, less what's driven since the last rest. | Rest resets it; a team drives longer. |

### The pay line

| Key | What it is | How it's computed | What moves it |
|---|---|---|---|
| `pay.lessorShare` | The lessor's cut of every load on a leased truck. | `{lessorShare}` of what the load pays. | It ends when you own the truck. |
| `pay.fuel` | Diesel burned on this load, empty miles included. | Miles divided by the truck's mpg, times the day's pump price. | Fewer empty miles, the make's mpg, the price of diesel. |
| `pay.tolls` | Road tolls on this route. | The tolled roads the route uses, at their rates. | The route; some lanes have none. |
| `pay.fuelTax` | Tax on every gallon you burn, billed at the month's close. | `{fuelTaxPerGal}` FD a gallon, on the road and idling, added up over the month. | Gallons: fewer empty miles, less idling, a make with better mpg. |
| `pay.maintenance` | Wear on the truck from these miles. | The tractor's cost per mile, times the miles. | The make, the truck's condition, a timely rebuild. |
| `pay.insurance` | Your policy's cost for this period. | Base premium, times your record, your home hub and the market. | A clean safety record; your home hub. |
| `pay.ownerPay` | What you pay yourself for driving. | Your driver's rate per mile, times the miles. | Your pay setting. |

### Standing

| Key | What it is | How it's computed | What moves it |
|---|---|---|---|
| `standing.miles` | Your standing in the beta: loaded miles hauled this season. | Every loaded mile delivered. Empty miles don't count. | Hauling, and hauling loaded. |
| `standing.reputation` | How shippers and brokers rate you. | Your lifetime on-time share, smoothed by `{priorLoads}` loads at the starting value so one load can't swing it. | Delivering on time. Nothing else moves it. |
| `standing.onTime` | The share of your loads delivered by the appointment. | Loads on time, divided by loads delivered. | Plan for hours, docks and weather. |
| `intel.creditBand` | Your credit, A best to E worst. | Paying from cash in hand, authority age, open claims, bankruptcies, revocations, and cover for what you owe. | Pay from cash, not overdraft; time; no claims; keep cash and stake above what you owe. |
| `intel.safetyBand` | Your safety rating from inspections and reviews. | Violations at inspections and audits over two years, recent ones counting more, plus crashes per truck. | Rested drivers, maintained trucks, no speeding, no crashes. |
| `intel.insuranceBand` | How much your record adds to your premium. | Your at-fault surcharge: clean, surcharged or heavily surcharged. | Fewer crashes and claims; it eases with time. |

**On another company's Intel card** (W2): third person, and no inputs, ever. The "how" row is left out; only what it is and what moves it.

| Key | What it is | What moves it |
|---|---|---|
| `intel.creditBand.other` | A company's credit, A best to E worst. | Paying from cash in hand, its authority's age, claims, and cover for what it owes. |
| `intel.safetyBand.other` | A company's safety rating from inspections and reviews. | Violations found at inspections and audits, and crashes, recent ones counting most. |
| `intel.insuranceBand.other` | How much a company's record adds to its premium. | Its crashes and claims; the surcharge eases with time. |

### Toward a truck

| Key | What it is | How it's computed | What moves it |
|---|---|---|---|
| `truck.leaseDeposit` | Money held back from your lease loads, toward your own truck. | A share of each leased load, counted in full when you buy. | Every leased load adds to it. |
| `truck.value` | What your owned truck would fetch today. | Its list price, less depreciation by age and miles. | Time, miles, condition and the make. |
| `loan.downPayment` | The share of the price you pay yourself on a purchase loan. | `{downLow}` to `{downHigh}` of the price: the better your credit score, the lower. | A better credit score, before you sign. |
| `loan.cashNow` | The cash a purchase loan needs at signing. | Down payment, a `{loanStake}` loan stake and sales tax. Your lease deposit comes off when this truck replaces the lessor's. | Your credit score, and the price you choose. |
| `loan.rate` | What the loan costs each week on what's owed. | `{rateLow}` to `{rateHigh}` a week: the better your credit score at signing, the lower. | A better score lowers your next loan. A running loan's rate never changes. |
| `finance.factoringRate` | The factor's share of every load under contract. | From your fleet size on the day you sign; fixed for the term. | More trucks at renewal lower it. |
| `finance.quickPayFee` | The cost of being paid on delivery, one load at a time. | `{quickPayPct}` of the load. | Nothing: it's fixed. Use it for emergencies. |
| `finance.cashNowFee` [switch cashNow] | The fee to cash an open invoice today instead of on its due day. | Under a contract: its rate plus a surcharge for each day early. Without: the spot rate. | Fewer days early; a contract, or a bigger fleet's contract rate. |
| `guide.gapToTruck` | How far you are from your next truck. | The cheapest truck's cash needed now, less your deposit and cash above `{gapCushionWeeks}` weeks of costs. | Hauling; cheaper trucks on the used lot. |

### Danger

| Key | What it is | How it's computed | What moves it |
|---|---|---|---|
| `guide.cushion` | How many weeks your cash covers your own spending. | Your cash, divided by your average weekly spending over the last `{cushionAvgWeeks}` weeks. | Earning more, spending less, buying nothing in a slump. |
| `guide.debtCountdown` | Weekly checks in a row with cash under the line. | Checked weekly: under `{debtLine}` FD counts one; `{weeksInDebt}` in a row winds you up. | Cash back above the line resets it. |

### The market

| Key | What it is | How it's computed | What moves it |
|---|---|---|---|
| `market.loadToTruck` | Loads posted for every truck looking, at a hub. | Open loads, divided by trucks free nearby. | More freight raises it; more trucks lower it. |
| `market.demandDial` | Freight across the whole country against its normal level. | The market's cycle: booms and slumps, over months. | Nothing you do; plan for it. |
| `market.diesel` | Today's price of diesel at the pump. | The fuel market, moving daily. | Nothing you do; your mpg decides how much it hurts. |
| `market.season` | Whether this hub's freight is in season or out. | This hub's freight for your trailer type against its yearly average. | The calendar. |
