# Decisions with information (UX spec, draft 3, 2026-11-03; owner: UX; diaries 2–4)

From the second player diary (`playtests/play-2026-11-02-impatient-fleet-owner.md`, 19 screenshots) and the
director's triage (`reviews/director-player2.md`, R6–R10, findings 8–11). The director owns the rules; this spec
places them, phone first, for engineering. Strings are the writer's placeholders; `{}` keys come from config;
figures are the diary's. Every sheet here follows the phone sheet rules in `specs/guidance-ux.md` §3: it stands on
the nav, its foot is pinned, and it closes five ways.

## 1. R6: the confirm card

**When.** Before any action that is **irreversible**, or that **spends more than `{guard.confirmShareOfCash}`
(25%) of cash**. Irreversible, for this spec:

| Action | Where it lives today | Card? |
|---|---|---|
| Buy a truck, a tractor or a trailer (today or on order) | Dealer, Showroom | always |
| Lease a truck (the deposit) | Dealer › Lease another truck | always |
| Sell a truck or trailer | Truck card, Yard | always |
| Scrap a truck or trailer | Truck card, Yard | always (replaces today's inline `ConfirmBtn`) |
| Fit an item (APU, aero kit, premium tires, sleeper) | Business › per-truck rows | always |
| Hire, when the wage passes a week's net | Staff | when the weekly wage > the company's average weekly net over the last 4 weeks (`{guide.cushionAvgWeeks}`); otherwise no card |
| Sign a contract (a shipper's lane) | Truck › Contracts | always |
| Buy a yard, a business, a facility | Business | always |
| Any other spend over 25% of cash | anywhere | yes |

Borrow, factoring and Move money keep their own confirm sheets (`finance.md`, `brokerage-ux.md`), restyled to this
component so every confirm in the game looks alike.

**Where it opens.** A sheet on a phone (standing on the nav, at most 60% of the height, a pinned foot); on the laptop
the 320 px card in the corner away from the button pressed (`guidance-ux.md` §3). It never replaces the screen
underneath: the item stays visible above it.

**What it shows, four lines, in this order,** label left, figure right, each figure an explain key:

| # | Line | Example (the diary's truck) |
|---|---|---|
| 1 | **What it costs** | "Costs 19,100 FD today" · on order: "Costs 19,100 FD now · arrives Mar 4" · a hire: "1,120 FD a week" · a contract: "5 loads a week at 3.10/mi for 90 days" |
| 2 | **What's left** | "Leaves 3,357 FD · 0.6 weeks of your costs" (cash after, then the cushion figure from `guide.ts` recomputed after the spend). Amber under 2 weeks, red under 1. |
| 3 | **What it does** | one line from the explain table: "A Highway Pro with a reefer, 473,712 mi, 44% condition, at Columbus." · APU: "Cuts idle fuel overnight: about 290 FD a week on this truck, so about 75 weeks to pay back." |
| 4 | **The one risk** | the single risk the writer names per action kind: "15% of its life left and no rebuilds: it runs until it's worn out, then goes for scrap." · scrap: "Worth 159,000 FD as a truck; scrap pays 4,200." · hire: "The wage is owed every week, loaded or not." · contract: "Turning down a tender costs the shipper's trust and part of your stake." |

**The foot:** **Cancel** on the left, the confirm on the right, labelled with the act and the amount ("Buy ·
19,100 FD", "Scrap · 4,200 FD", "Hire Vikram Hayes", "Sign for 90 days"). Destructive acts (scrap, sell below
value) are red; the rest primary.

**The one-tap rule.** One tap opens the card; a second, deliberate tap confirms. Engineering guarantees both:
- **Never under the first tap.** The confirm sits in the pinned foot, at the bottom of the sheet. If the first tap
  landed inside the foot's area (a button low on the screen), the sheet rises so the foot clears that point by
  at least 24 px, or the confirm and Cancel swap sides so Cancel takes that spot.
- **Never on the same touch.** The confirm ignores any touch that began before the sheet opened, and is inert for
  `{ui.tapSettleMs}` (proposed 400 ms) after it opens. It shows no disabled look during that time (too short to
  read), it just doesn't fire.

**After.** The sheet closes; the change shows where it happened (the truck card now "Arrives Mar 4", the item on the
truck's row, the hire's seat filled) with the feed line. No toast.

**Scrap moves to an overflow.** A truck card on a phone shows at most two actions in its row (today: Bid by hand,
Find loads or Send home, whichever apply). The rest go under **⋯** (44 px, the row's right end), a menu of 44 px
rows: Send empty, Park, Offer for lease, Sell, and last, in red, "Scrap · 4,200 FD (worth 159,000)". Every one of
them opens the confirm card if it's on the list above. Same for the Yard's trailer rows.

## 2. R7: every door tells the truth

**The rule on screen:** an offer shows only what it will give; a refusal names **the amount, the condition and the
date**, in that order, in red under the control; a check that will refuse runs **before** the money and disables
the button with its reason beside it.

**Borrow (Finance › Credit › Borrow against a truck).** A truck's row shows only when the lender would lend it
something now. The figure is the engine's own answer to "the most this truck can borrow today", the same check the
action runs, so the press never refuses. Amount field defaults to it, capped at it. A truck that can't borrow shows
one muted line instead of a button: "Truck 2 backs 38,400 FD of loans already; its limit is 40,000 (35% of its
value)."

**Lease another truck (Dealer).** "No money down" goes. The card: "Deposit 4,800 FD now, back when the truck
returns" · "The lessor keeps 15% of every load, at least 250 FD a week" · "28 days at least" · "Lessor has 6
free". Button **Lease · 4,800 FD deposit**; short: disabled with "Deposit 4,800 FD: you have 3,100." beside it.
Always the R6 card on press.

**The Dealer's lines say when.** The page's first line ("Used trucks deliver today") goes; each listing says its own:
- "**Delivers today** at Columbus" (a listing on the lot where the truck stands), or
- "**Ordered: arrives Mar 4** (in 6 weeks)" (the used lot's delivered-like-new stock, every new truck).

The button follows: **Buy today · 19.1k** or **Order · 19.1k · arrives Mar 4**. When the wait has grown, one line
over the new trucks says so with its cause, the economy's words: "The wait is 61 days now, up from 30: every dealer
is short of reefers."

**The yard check before the order.** Every Buy/Order/Lease button counts the yard first. If the truck wouldn't fit:
disabled, with "Your yard holds 5 trucks: this makes 6." and two links: "Make room ›" (the ⋯ menu's Park, Sell,
Offer for lease, for a truck you choose) and "More yard space ›". Trucks on order count.

**More yard space, before yards open.** It no longer opens the Business teaser. It opens a card:
- "Yards open Jan 29, in 6 days." (the businesses layer's date);
- "Until then, to make room:" **Park a truck** (it stops earning and stops costing fuel and wages), **Sell a truck**,
  **Offer one for lease**, each opening that flow;
- once open but unaffordable: "Small yard: 109,700 FD and a 30,000 FD bond: you have 78,000." and **See what it
  holds ›**.

**Refusal strings, the pattern** (the writer words each): "{What} {amount}: you have {amount}." · "{Limit}: this
makes {count}." · "Opens {date}." Never "not enough" without the number, never "over the limit" without the limit.

## 3. R9: the badge means "needs you"

**What counts.** The red badge counts only items with an action the player can take now. Each row in its list is:
icon · one line · **the action button**, 44 px. Ranked by what's at stake, highest first: FD at risk per day where
the engine knows it (a truck down, a driverless truck's idle cost, a tender's value), then by deadline.

| Item | Line | Action |
|---|---|---|
| A truck with no driver | "Truck 2 has no driver · idle costs 140 FD a day" | **Hire** (opens Staff at the top, R6 if it applies) |
| A tired driver | "Mai Hart has been out 22 days" | **Send home when idle** (one tap; the item leaves the badge; the truck card shows "Home when idle") |
| A truck down | "Truck 1 broke down near Amarillo · repair 3,072 FD" | **See the truck** |
| A rebuild due | "Truck 2 is at 12% · rebuild 10,000 FD" | **Rebuild** (R6) |
| A tender expiring | "Tender Chicago → Columbus · lapses 18:00" | **Accept** |
| A contract offer | "Offer: Dallas → Tulsa, 5 a week" | **See the offer** |
| Debt countdown | "2 of 4 weekly checks in debt" | **What now?** |

**What doesn't count:** a newly opened tab ("Rates · New") gets the **dot** on More, never the red count; news;
anything with no button. If engineering can't give an item a button, it isn't a badge item.

**The tired-driver card** on the Truck tab gets the same button, **Send home when idle**, and once tapped reads
"Going home when idle · 170 mi". (Engineering: today `send_home` needs an idle truck; this needs the standing
intent, `wantsHome`, set while the truck is moving.)

**Money events over `{guard.newsFd}` (500 FD)** (a breakdown, a fine or ticket, a write-off, a cargo claim) leave
the grey log. They show in the money style: the amount bold, red for a cost, on the Truck tab's "Today" list and in
Money's "This week". Each is an explain key; its sheet says what it was and what made it likely ("44% condition,
61,000 mi past its last rebuild, rain on I-40"; a ticket: "parked on the shoulder at hours' end; the dispatcher
chose the stop"). They join the badge only when a decision waits (the truck is down; a rebuild is due).

## 4. R10: a line with a button stays

**The caption rule (`guidance-ux.md` §1, sharpened).** A caption line that carries a button holds the caption until
the player taps the button, dismisses it, or leaves the tab. No tab or card line, tip or rotation replaces it, and
quiet time doesn't expire it. Such a line gets an **×** (44 px, top-right of the caption) to dismiss. It retires
early only when it becomes false (`guidance.md`, R2).

**Read the month: the report it promises.** Money gets a **"Last month"** card, at the top of Money for 7 game days
after a month closes, then into a closed fold "Past months" (newest first). "Read the month" opens it.
- **Header:** "January · kept 114,733 FD".
- **Earned**, rows by kind: loads delivered, contract loads, quick-pay and cash-it-now fees (as negatives), other.
- **Spent**, rows by kind: fuel, fuel tax, wages, the lessor's share, maintenance and repairs, insurance, tolls,
  yard, fines and tickets, loan interest. Each row an explain key.
- **Kept** = earned − spent, bold.
- **"Why your cash moved differently"**, the reconciliation diary 1 asked for: cash on the 1st · + kept · −
  trucks and items bought · + loans taken · − loan principal repaid · − held back by the lessor · − invoices not
  yet paid · = cash on the 31st. It must add up to the figure; the coverage test pins it.
- **Three lines of the month:** loads delivered, on time %, loaded miles against all miles.

## 5. Phone controls (findings 8–10)

**The fleet start (test build, `first-ten-minutes.md` S1's naming sheet).** "How you start" sits **above** the
start button, both choices visible at once as two cards side by side (each: the rig, one line, the selected one
outlined). The button names the choice: **Start at Los Angeles · small fleet** / **· owner-operator**.

**Staff on a phone.** The hiring tables become cards, one per candidate: portrait, name, stars, "Asks 0.67 FD/mi
· about 1,120 FD a week", record, and **Hire** full-width at the card's foot. Nothing scrolls sideways. Staff opens
scrolled to the top (the empty seat's card first when one is empty). After a hire, the card reads "Hired Vikram
Hayes · about 1,120 FD a week" in place, with the feed line; R6's card first when the wage passes a week's net.

**Nothing moves under a thumb.** From a touch's start until `{ui.tapSettleMs}` after it ends, nothing on screen may
move, resize or disappear:
- **the sheet** never changes height mid-touch (the borrow sheet jumping to full); a height change waits for the
  finger to lift and the settle time;
- **lists** don't reorder (Finance's option rows; the board's cards when a round clears): the new order applies
  after the settle time, with the touched row held in place;
- **a button whose action became impossible during the touch** (a round cleared, the load went) stays where it
  was and shows its refusal in place ("That load went at 18:00 to 2.24/mi"); it doesn't vanish;
- **Finance's option rows** have fixed heights; marking the current one changes colour, never size.

## 6. The trucker's paperwork: R13 and R14 (diary 3)

From the third diary (`playtests/play-2026-11-02-working-trucker.md`, laptop 1440 × 900) and the director's
`reviews/director-player3.md`, R13, R14 and rows 7 and 9. **Kept as they are, on the trucker's word:** the laptop
layout, the five visible speed buttons (Pause/Play plus four), and the board's **Table** toggle.

### R14: the profit chip, one arithmetic everywhere

**The chip** (ruling 5's one figure, `profitBook`, and the hold it implies):

| Where | Leased truck (a hold applies) | Owned truck (no hold) |
|---|---|---|
| Laptop: card and Table column | "+607 · cash −103 · held 710" | "+607" |
| Phone (< 900 px): card | "+607 · cash −103" | "+607" |

- **Colour by profit:** green chip when the profit is positive, red when negative.
- **The cash segment** is amber text when negative (it says the cash dips, not that the load loses); plain chip
  text when positive. Contrast at least 4.5:1 against the chip; if amber on the green fill can't reach it, the chip
  becomes outlined green (green border and profit text) so the amber segment sits on the card's background.
- **Never wraps,** at any width down to 375 px: the chip is one line (`white-space: nowrap`). Above 9,999 the
  figures shorten ("+12.4k · cash −1.1k"). If the card's line can't hold the chip and the grey bid chip together,
  the bid chip moves to the next line; the profit chip never breaks.
- **The held figure on a phone** is on the load sheet, one tap away, with the hold's explain key.
- **The chip is an explain key** on the sheet, not on the card (the card is itself a tap target, `guidance-ux.md` §3).

**The same pair on every surface that quotes what a load pays:**
- **Book now on the card** may read "Book now · +607" only when the chip with cash sits on the same card; otherwise
  "Book now · 4.76/mi".
- **The load sheet, "The money" group,** three rows in place of today's one, each an explain key: "Profit at
  book-now +607" · "Cash now −103" (amber when negative) · "Held toward your truck 710". Owned truck: the first row
  only. The sheet's Book now button: "Book now · 4.76/mi · +607".
- **What now?'s reason,** whenever the hold makes cash differ: "607 over break-even: 103 out of cash now, 710 toward
  your truck." (the director's words; the writer owns them).
- **The bid control's live line** ("Bid · +338 FD") follows the same rule: "Bid · +338 · cash −40" on a leased
  truck.

### R13: what a trucker reads next

**On the load card (phone),** three lines and the chip:
1. "Louisville, KY → Laredo, TX · 1,479 mi" (towns always with their state);
2. "4,754 FD · 3.21/mi · 28 mi empty · 42,000 lb";
3. "Deliver by Thu Jan 10 · 10:00";
4. the chip.

**On the laptop Table:** the same facts as columns: Age, Rate, Trip, Lane (towns with states), **Empty** (one
figure), **Deliver by** (rounded), **Weight**, **Profit** (the three-part chip), Company, Score. Nothing else moves.

**On the load sheet, Route group:** "Pick up" Louisville, KY · now · "Deliver by" Thu Jan 10, by 10:00 · Laredo,
TX · "Miles" 1,479 loaded · 28 empty from Columbus · **"Weight" 42,000 lb · general merchandise** · "Driving" ·
"Reload at Laredo".

**The rules behind them:**
- **Towns with states, everywhere,** in every list, header and feed line: "Rome, GA", never "Rome". **One name per
  place:** a place inside a hub's metro shows its own name with the hub after it, once: "Newburg, KY · Louisville
  area". The board's header uses the same ("Loads from Newburg, KY · Louisville area"), so header and cards never
  disagree (diary 3: "Loads from Newburg" over cards that all said Louisville).
- **Deliver-by rounded down to the hour:** 12:11 shows "12:00", 03:02 shows "03:00". Down, never up, so the shown
  time is never later than the real one. With the docks switch on (`docks.enabled`, off today), the shown time is
  the last whole hour the receiver's dock is open before the deadline, and an appointment shows "appt 14:00".
- **One deadhead figure everywhere,** from one engine read (the same `placeMiles` route the profit uses), and the
  figure always names where it's measured from: "28 mi empty from Columbus" on the player's board, "from Dallas"
  on a hub card's read-only board before a truck exists. Two different numbers for one load can then only appear
  with two different "from"s.
- **Weight:** see question 4; until it's answered, no weight figure ships.

## 7. What binds, and buttons that answer: R19 and R20 (diary 4)

From the gamer's diary (`playtests/play-2026-11-02-gamer.md`, laptop, 24 screenshots) and the director's
`reviews/director-player4.md`, R19, R20 and rows 5–7.

### R19: every cap in one place, the binding one first

**The card "What limits your fleet"**, one component, shown in two places a fleet owner looks before buying: at the
top of the **Dealer** (above the listings) and on **Company** (under the stats). It lists every cap the engine
applies (`truckCap`'s three parts and the managers' `opsCap`), each a row with its figure and what raises it, and
puts the one that binds first at the top, in bold:

> **You may run 5: your yard holds 5.** Yards open Jan 29.
> Staking allows 10 · your stake 40,000 FD
> Operations managers cover 7 · you have none
> The company limit is 30

- **Header:** "You may run {n} · you run {m}". When n = m, the header is amber and the binding row says what
  raises it: "Yards open Jan 29" (before the layer), "A small yard: 109,700 FD + a 30,000 FD bond" (after), "Stake
  20,000 more" (tiers), "Hire an operations manager" (managers).
- **While the stake tiers are off** (Jeff: truck prices are the entry fee; `lockDiscounts` on), the staking row
  doesn't appear, and nothing anywhere says a stake allows trucks.
- **R6's card before a stake** says when it buys nothing today: line 3, "Staking allows 10 trucks, but your yard
  holds 5 until Jan 29: today this stake only earns its discount." Line 4, the risk: "Leaving early costs a
  quarter, burned, or 28 days in the queue."
- Buy, Order and Lease buttons check the same caps first (R7) and, when one binds, show its row's words in place of
  "Company truck cap": "Your yard holds 5: this makes 6. Yards open Jan 29."

**The staking card (Finance › Staking)**, rewritten so it never stays the same after money moves:
- **"Your stake: 40,000 FD"**, large, with "· 20,000 leaving, back Feb 28" while any is in the queue.
- **"Its discount: 5% off fuel, maintenance, rebuilds, insurance and board fees"** (the tier's, or the lock's rate).
- **"Its term:"** "none: unstake any time (28 days in the queue, or now for 75%)" under the tiers; the lock's dates
  under the locks (`finance.md`, Card 4, Later).
- **"What it allows:"** the staking row of the caps card ("Staking allows 10 · your yard binds at 5"), tiers only.
- **Unstake answers** (R20's pattern): "Leaving: 20,000 FD · in your cash Feb 28" or "15,000 FD back now · 5,000
  burned", under the button, and the stake figure changes at once.

**Borrow while the pools are off.** The diary's 55,661 FD offer answered "The pool doesn't have the cash": a loan
only a pool can fund. Until the economy says whether the NPC lender writes it, **Borrow against a truck doesn't
show** while `poolsOn` is false (Finance's Credit card, `finance.md`); if the lender writes it, R7's rule holds
(only what it will lend).

### R20: every button answers, one pattern

**The pattern, for every control that sends an order:**
1. **At the press,** the control shows its state in place: in the test world the result at once; in the live
   world "Sent · in effect 06:02" until the world applies it.
2. **The answer lands under the control that sent it,** one line, in the row or card where the press was: plain
   for a result, red for a refusal with the engine's reason and its numbers. It stays until that control is used
   again or the screen is left. **Not a toast:** a toast is gone before a reader reads it and sits away from the
   press (diary 4 missed every one). Toasts stay only for the connection.
3. **An answer that comes later** (a live-world order applied after the player left, an offer someone answers) is
   a **pending chip on the row** ("Offer sent · answer by Feb 3") until it lands. Then it becomes the row's
   result line, a feed line, and, **if it needs the player,** a Needs-you item with its button.
4. **A press the engine will refuse is caught before it** (R7): the control is disabled with the reason beside it,
   and step 2 never has to say it.

**The five the gamer found, by that pattern:**

| Control | Before the press (R7) | Result line | Refusal line |
|---|---|---|---|
| **Bid** (any rate) | the bid's live line shows the profit and, above the ceiling, "Above the ceiling 7.64: it wins only if nobody bids under it" (R17 may change the rule; the line follows the rule) | "Bid in: 30.00/mi · clears 18:00 · in 5 h", and the card pins (S4) | the engine's reason, with its figure |
| **Book now, vetting-blocked** | disabled; beside it "Strict vetting: needs 90 days' authority (you have 34) and 25 loads delivered (you have 12)" | – | – |
| **Lease past the cap** | disabled; the binding cap's words (R19) | "Leased: Truck 6 arrives at Columbus today · deposit 4,800 FD" | – |
| **Unstake** | R6's card when over 25% of cash or instant (a burn) | "Leaving: 20,000 FD · in your cash Feb 28" / "15,000 back now · 5,000 burned" | the engine's reason ("your bond backs what you owe carriers") |
| **Poach: Offer** | the offer's wage and the R6 line if it passes a week's net | pending chip "Offer sent to Donna Reyes · 0.92/mi · answer by Feb 3" | when answered: "Donna Reyes accepted: starts on Truck 3" or "declined: stays with Prairie Haul", with a feed line |

**Engineering's check:** a test that presses every action-sending control in a world built to refuse it and to
accept it, and fails if either leaves no result line, pending chip or disabled reason on screen.

## 8. For the director

- **"SMALL YARD · $900"** on Business is a dollar price on the first month's path (diary 18). Jeff let token
  surfaces stay, off the first ten minutes' path; this one is on a growth button. I'd move it under Money's "The
  token" fold.

## Questions

1. **Engineering:** "the most this truck can borrow today" as one engine read, so Borrow's figure and its check are
   the same code; the standing `wantsHome` intent for Send home when idle; FD-at-risk per day per badge item.
2. **Config:** `{guard.confirmShareOfCash}` 0.25, `{guard.newsFd}` 500, `{ui.tapSettleMs}` 400 ms proposed.
3. **Writer:** the one-risk line per action kind; the refusal strings; the month report's row names; the chip's
   "cash" and "held" words.
4. **Engineering and the director (R13's weight):** the engine has no per-load weight. Fuel prices loaded against
   empty (`trips.ts`, `loadedClimbMult`), not pounds. A weight figure needs a weight per load (from the commodity's
   typical range, a data addition) and either an engine use for it or a plain statement that it's informational. A
   figure the rules don't use reads as one they do, which pillar 1 forbids ("nothing false"). Until one of the two
   is decided, the weight line and column don't ship.
