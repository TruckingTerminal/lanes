# Guidance: Iuliia every step of the way (director's spec for UX, the writer and engineering; 2026-11-03; owner: the director)

Jeff (`DECISIONS.md`, 2026-11-02): "I need to make sure that Iuliia is guiding people every step of the way. As this is a true sim and very complex."

**The standing rule.** On every screen, at every stage, the player has two things:
- **a next step** from Iuliia;
- **an explanation one tap away** for anything they read.

Three layers deliver it:

| Layer | What it is | Exists today |
|---|---|---|
| The next step | Walkthrough steps, then milestones, then **What now?** | The walkthrough (`apps/web/src/walkthrough.ts`) |
| The explanation | Tap any figure or band: what it is, how it's computed, what moves it | No |
| Her voice | One line per screen by tab and card, under the placement rule | `specs/iuliia-lines.md`, being wired |

**A correction to the brief.** The walkthrough has thirteen steps, not nine. Steps 10–13 (Hiring a driver, Standing orders, The yard, Miles) already follow "Your first truck". The milestones below extend them; they don't replace them.

## Ranked, with the sprint

1. **What now?** (section 1). The only layer that answers every state, including the ones no script foresaw. **Sprint 3**, for a carrier through its first 91 days.
2. **The figures she computes** (section 4). What now? and the milestones are only as good as these. **Sprint 3.**
3. **Help on every figure** (section 2). **Sprint 3** for the figures a player meets in the first month. Every other screen is **later**, with a coverage test that keeps it honest.
4. **Milestones after the walkthrough** (section 3). **Sprint 3** for what arrives by day 91. **Later** for the season close, the stake and the Reserve, which come when those land.
5. **The guide bot in the sim** (section 6, economy). **Sprint 4.** It checks that following Iuliia is prudent play, which Jeff requires to win.

## 1. What now?

**The button.** "What now?" sits on Iuliia's panel and her caption strip, always there, on every screen. A tap gives exactly three things:
- **one action;**
- **one reason, with this company's figures;**
- **one button that does it or opens where it's done.**

**How it's chosen.** It is computed, not scripted: an ordered list of rules, where the first rule whose condition holds wins. Each rule has a condition on the world and the company, an action, and a reason built from section 4's figures. Like the walkthrough, it reads the world and saves nothing, so it is right after every reload.

**The rule order** (engineering implements it, the writer words it):

| # | Condition | What it says, in substance |
|---|---|---|
| 1 | The company is in danger: cash under the debt line at a weekly check, or the next check would make it so | The way out, with the countdown: "{n} of 4 weekly checks in debt; next {day}". Then the best single lever: book the idle truck, collect or factor what's owed, return a lease, sell a truck. Rule 1 always names a real, possible action. |
| 2 | Something is waiting on the player | The most urgent item first: a tender expiring, a contract offer, a lost bid with a better load beside it, a driver gone. This is the "Needs you" list, ordered by deadline. |
| 3 | A truck is idle with loads in reach that pay | "Bid on {lane}", the best load by the profit chip. Owner-operators first, then the dispatcher's misses. |
| 4 | A walkthrough step is current | That step's Do line. |
| 5 | A milestone is near and needs preparing | The gap or the countdown: the next truck, the cushion, the licence, the season close (section 3). |
| 6 | Nothing needs the player | "Nothing needs you. The next thing that will: {event} in {days}." Calm is an answer, and it should be honest. |

**Rule 1's collect lever** (Jeff, 2026-11-03: "If a carrier needs it now, he needs it NOW"). Any open invoice can be cashed now:
- under a factoring contract, at the contract's rate plus an aging surcharge;
- without one, at a spot rate.

Both are behind the economy's switch and land with the brokerage bump. The levers stay in their order: book, collect, return a lease, sell.

- **Switch on.** Collect offers **cashing first**. Its reason names three figures: what lands, the fee, and that it lands before the deciding check ("{fd} FD lands today, {fee} FD in fees, before the check on {day}"). It names the invoices to cash. Under a factoring contract, it offers the **freshest invoices that clear the line**: the aging surcharge (the contract rate plus 0.1% a day of age, up to 3%; `studio/reviews/economy-brokerage.md`) makes the freshest the cheapest to cash. At the spot rate, with no contract, it offers the fewest invoices that clear the line. The spot rate carries the same aging (8% plus 0.1% a day of the invoice's age, up to 3%), so among equal choices the fresher invoice still costs less.
- **Cashing wouldn't cover the line, or the switch is off.** Collect falls back to waiting for the dated invoices, and names those that are due before the check. If waiting won't clear the line either, rule 1 moves on to the next lever (return a lease, then sell). It never offers a lever that can't work.
- **No joke here, and no word against the fee.** Iuliia states what it costs. The player decides whether now is worth it.

**"A better load beside a lost bid"** (rule 2) is an open load the same truck may take now, and it must pass four tests:
- **The truck can take it.** The trailer matches. The vetting and local-first checks pass (`vettingBlock` and `mayTake` clear). It isn't a hot load without a team.
- **It is in the same reach the lost bid used.** For a hand bid, the hand-bid deadhead limit (`MANUAL_BID_MAX_DEADHEAD_MI`) from where the truck is or will be free. For the dispatcher's bid, the dispatcher's own range.
- **Its profit chip is positive.** The chip is taken at its "usually clears near" rate, not its ceiling, with the one arithmetic of ruling 5.
- **It pays at least what the lost load would have left at the rate it went for.**

Ties go to the earlier pickup. If no load passes, the lost bid drops out of rule 2, and What now? falls through to rule 3.

**What What now? never does:**
- It never recommends buying or selling FD, a stake as an investment, or any token trade. It may explain a stake as the cost of something, such as the licence.
- It never recommends anything from the Back Lot.
- It never gives advice it can't back with this company's numbers.
- If no rule fits, it says so and opens Help. It never guesses.

**The placement rule allows it,** because the player asked: the answer is one line in the strip, never over a figure. A player-asked line skips quiet time.

## 2. Help on every figure

**The sheet.** Tap any number, band, chip or meter, anywhere, and a sheet opens with Iuliia's portrait and three parts:
- **What it is.** One sentence, the writer's.
- **How it's computed.** This company's actual inputs, from the engine. For example, a break-even of 2.36/mi: fuel 0.62, maintenance 0.18, insurance 0.21, the lessor's 15%, and so on.
- **What moves it.** The levers the player holds, each a link where one exists.

It ends with **What now?**.

**No humor in it.** Every figure is about money or risk, so the writer's no-joke rule applies to the whole sheet.

**One table, keyed like `copy.ts`.** A new `explain.ts` holds an entry per figure key (`money.cash`, `board.ceiling`, `board.clearsNear`, `truck.breakEven`, `intel.creditBand` and so on). Each entry has:
- `what` (the writer);
- `how` (engineering: a function returning the breakdown from the world);
- `moves` (the writer).

Every component that renders a figure carries its key. **A coverage test fails if any figure on a covered screen has no key.** That test is how "every figure" stays true as screens grow.

**The sprint-3 list: the first month's figures.**
- **Cash and its trend:** cash, the sparkline, Owed to you.
- **On a load:** the profit chip, break-even, the ceiling, "usually clears near", book-now, the bid, deadhead, ETA, hours of service left.
- **The pay rows:** the lessor's share, fuel, tolls, the fuel tax, maintenance, insurance, the owner's pay.
- **Standing:** Miles, reputation, on-time, and the credit, safety and insurance bands.
- **Toward a truck:** the lease deposit, truck value, the purchase loan's down payment and rate, the factoring rate, the quick-pay fee, the gap to the next truck.
- **Danger:** the weekly checks in debt.
- **The market:** load-to-truck, the demand dial, diesel, the season line.

**Later:** Business, Economy, Logbook, the token and the brokerage screens, each when it is built or next touched.

## 3. Milestones after the walkthrough

A milestone is an event in the company's life. It is not a step to tick.
- **When it fires:** when the world says so, in any order.
- **What it says:** Iuliia's own line, once.
- **Why it matters:** one sentence of reason.
- **What follows:** it hands What now? its next action.
- **It saves nothing.** A milestone shows while its event is under {n} game days old, derived from state like the walkthrough.

The writer words each line. Below are the intent and the trigger.

| Milestone | Trigger | The point of her line | What now? turns to |
|---|---|---|---|
| The first owned truck | Step 9 done | The lessor's share is gone. Maintenance, insurance and depreciation are the player's now, and an owned truck costs money when it sits. Jeff's rule: say the risk plainly; this player must be well capitalised. | Keep it loaded. Quick pay or factoring if cash runs thin, with what each costs. |
| The first hired week | A hired driver's first full week | A driver is paid by the mile, empty miles included, plus a per diem for each idle day away from home. The wages go out weekly. | Standing orders (step 11); the second truck's gap. |
| The first dispatcher | Hired, or the third truck | The dispatcher follows the rules the player sets, and only those. | Check the rules against the lanes that paid. |
| The first month's close | Day 30 of the company | The month in three figures: earned, spent, kept. Monthly bills (fuel tax, insurance) land now. | Read Money's month; the cushion. |
| Day 28: businesses | The ladder | What a business is, and who it suits. For most first-month carriers, not yet, with the gap as the reason. | The next truck first, unless the cushion says otherwise. |
| The first slump | The demand dial under 0.9 for the first time | "Rates are falling for everyone, not just you." Slumps end, and the prudent carrier is still there when it does. | The cushion in weeks; cut idling; don't buy now. |
| The debt countdown | The first weekly check in debt | She helps, because she can: the countdown and the exits. | Rule 1. |
| Day 91: the brokerage | The ladder | As `specs/brokerage-rule.md`, section 7: what it takes and how far away it is. | The licence gap, or keep hauling. |
| The stake | When the locks land | The term, the discount and the slash, plainly. No joke. Never framed as an investment. | Only if a discount covers costs the company already pays. |
| The Reserve | When it lands (Jeff, 2026-11-02) | Thirteen weeks of the company's own spending, sheltered, with no fee and no yield. Above it the burn and the holding cost apply. | Fill it to the cushion. |
| The season close and its burn | 30 game days before the close, then on the day | Cash above the carryover cap ({25,000} FD) is burned at the close, under the live rules. What to buy or shelter first. | Spend on what earns, or shelter in the Reserve. |

**Rulings on engineering's batch 2 (2026-11-03).** Four figures engineering can't take exactly from the world's state. The rule behind every ruling below: a wrong figure is worse than none.

1. **The first hired week.** Accept engineering's figure: the miles not yet paid out, times the driver's pay, reset at each weekly close. The *at* line names it as what it is, the week so far: "{name} has driven {mi} miles for you this week: {fd} FD in wages so far." It fires before the week's close, never after the reset. The reason above is corrected: pay is by the mile, not "whether the truck earns or not".
2. **The first month's close.** Lifetime counters are not the month, so they are out. The engine's month-close record (built for Intel: revenue, loads delivered, on time) also carries **spent**: every operating cost **and overhead**. Earned, spent and kept (earned less spent) read from the company's first record. This is a record, not a rule change. Until the record carries spent, the *at* line has no figures: "Your first month has closed. Money has all of it."
3. **Day 91.** Accept the line without the gap, and don't hold the milestone: a player should learn the layer is open on the day it opens. The reason reads "What a brokerage takes is on its card." The gap figure arrives when the economy has put the bond, the licence and the premium in config.
4. **The dispatcher, triggered by a third truck.** Accept it undated. In the timeline it sits in order between its dated neighbours. When the third truck triggered it, its name is "Three trucks", not "The first dispatcher", because no dispatcher was hired.

**Bad news.** The writer's silence rule stands: no unasked line on an error, a refused order, a crash, a theft, a revocation or a liquidation. **Silence means no unasked line. It never means silence when asked.** After the plain string, What now? still answers, and the strip's next step returns.

## 4. What has to be computed for her

One module, `guide.ts`, reads the world and saves nothing. Each figure below is also an explain key.

| Figure | Definition | Used by |
|---|---|---|
| **Gap to the next truck** | The cheapest open route (the used lot, a listing, or new), as the down payment the purchase loan needs, less the lease deposit and the cash above the cushion. The exact figure the Dealer shows (Jeff: step 9 reads it). | Step 9, What now? rule 5, the Dealer |
| **The cushion** | Weeks of the company's own spending its cash covers, from the last four weeks' average. Against the Reserve's target of 13 weeks once that lands. | The first slump, the debt countdown, rule 5 |
| **The countdown in debt** | Weekly checks in debt, n of {4}, and the next check's day | Rule 1 |
| **Days to the next event** | The month close, the season close, the next ladder layer, the licence renewal, the factoring contract's end, the next round | Rule 6, the milestones |
| **The best load per idle truck** | By the profit chip's one arithmetic (ruling 5) | Rule 3 |
| **Burn exposure** | Cash above the carryover cap before the season close | The season close |
| **The licence gap** | 75,000 + 300 + the premium, less what's available | Day 91 |
| **The next action** | `nextAction(world, company)`: the first matching rule, its action and its figures | What now? |

`nextAction` gets a unit test per rule, with a world built into that state.

## 5. What she never does

- No joke on money, and no line over a figure. At most one line per screen, and never two within quiet time, except a line the player asked for.
- No unasked line on bad news she can't help with.
- No crime words. The Back Lot stays rivalry.
- No advice to buy or sell FD, and no stake framed as a return.
- No figure she didn't compute, and no advice without this company's numbers behind it.
- No blocking. Guidance never locks a screen or forces a step. The player may ignore her, and the game still works.
- No nagging. A milestone speaks once, and "Quiet" mutes everything but the walkthrough and what the player asks for.

## 6. Who needs what

**The writer:**
- What now?'s reason for each rule, under 20 words, with figures as keys.
- The explain table's `what` and `moves` for the sprint-3 list.
- The milestone lines.
- The slump and debt lines in the plain register.

**Engineering:**
- `guide.ts` with section 4's figures.
- `nextAction` and its tests.
- The What now? button.
- `explain.ts` and the explain sheet.
- An explain key on every figure component, with the coverage test.
- Milestones derived from state.

**UX:**
- Where What now? sits on a phone.
- The explain sheet.
- How a figure shows it can be tapped without cluttering a 375 px screen.
- How a long breakdown reads.

**QA:**
- At random moments in a replay, What now? names an action that is possible and true.
- Every first-month figure opens its explanation.
- No line ever covers a figure.

**The economy, sprint 4:** run `nextAction` as a bot (the guide bot) in the four-year pair beside the prudent and greedy bots. If following Iuliia does worse than the prudent bot, her advice is wrong, and the rule order changes before players follow it.
