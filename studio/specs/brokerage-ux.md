# Brokerage (UX spec, draft 1, 2026-11-03; owner: UX)

Sprint 2, item 3. Jeff, 2026-11-02: a brokerage is its own company, separate from the carrier; a player has at
most one of each. Rules from the director's `specs/brokerage-rule.md`; Jeff's three additions of 2026-11-03 are
sections 6–8. Numbers are config keys; figures are one example (carrier Red River Lines, brokerage Red River
Logistics). Words are the writer's (`specs/brokerage-strings.md`); the verb is **Start**. Items still open are
marked **[open]** and listed at the end.

## 1. Two companies, one login

**One company in view at a time.** The bar, the sheet, Money and the needs list all belong to the company in view.
`S.game.player` becomes that company; the login holds up to two.

**The switch: a chip at the left of the top strip,** one tap from every screen; the bar stays at four. It appears
only once the player has two companies.
- Phone: a 36 px chip before the clock, the company's kind icon (truck: carrier; handshake: brokerage) in a ring
  of the company's colour (carrier cyan, brokerage amber; art picks).
- Laptop: the chip and the company's name ("Red River Lines ▾").
- Tap: a two-row sheet, one row per company: icon, name, cash, its needs count, "In view" on the current one.
  Tapping the other switches at once; switching changes nothing in the world, so no confirm.

**Which company is in view, three ways, no legend:** the chip; a 3 px line in the company's colour under the top
strip; the sheet's state line opening with the company's name ("Red River Logistics · 3 loads posted").

**Shared:** the clock, the map, Iuliia and her progress, Help, Intel, settings, the ≡ menu. **Not shared:** cash,
ledger, credit, record, Miles, staff.

**The needs dot counts both companies.** Each row in its list starts with the company's icon; a row for the other
company switches, then opens.

**The map shows both, whichever is in view:** the carrier's trucks in cyan; the brokerage's open postings as amber
pins at their origins; a brokered load in motion as an amber dashed lane under its hauler. Tapping a pin switches
to the brokerage and opens that load.

**Feed lines** carry the company's icon; the laptop ticker shows both.

## 2. The brokerage's bar: Book · Carriers · Money · More

Same four places as the carrier's bar, so the thumb learns one bar. (The director guessed "Board" for the second
slot; a brokerage never bids on the board, and who hauls its loads is its second decision, so: Carriers.)

### Book
Loads in four groups, in this order:
1. **Offered to you:** shipper freight tendered to the brokerage. Card: lane, trailer, "Shipper pays 3,100 FD",
   "You'd post at 2,790 (your 10% margin)", "Board fee 93" (`{board fee}` **[open]**). Actions: **Post** ·
   **Tender to my carrier** (section 7; only when the player has a carrier) · **Pass** **[open: hand calls]**.
2. **On the board:** "Posted at 2.58/mi · clears 18:00 · in 5 h", a ring to the round.
3. **Moving:** "Taken by Prairie Haul at 2.52/mi · picked up Jan 9". "Yours" chip when the hauler is the owner's
   carrier.
4. **Delivered, waiting for pay:** "Shipper pays you Feb 8 · you pay Prairie Haul Feb 8".

**Every card:** line 1 the lane; line 2 "Shipper 3,100 · carrier 2,720 · fee 93 · **yours 287 FD**" (margin last,
bold, red below zero); a six-dot trail: Tendered · Posted · Taken · Picked up · Delivered · Paid. A tap opens the
load sheet: each stage with its date, the hauler's name (a link to Intel), both due days, and any fall-off charge
("Nobody took it: you paid the shipper `{brokerRisk.fallOffShare}` of the contract, 465 FD").

**Header:** "6 loads · 1,740 FD margin this month". **Empty:** "No loads yet. Shippers tender to brokers every
round; yours start at 06:00."

### Carriers
- **"Who may haul your loads":** Open · Standard · Strict, a three-way control, a line under each: "Any carrier" ·
  "`{vetting.standard.minAuthorityDays}` days of authority" · "`{vetting.strict.minAuthorityDays}` days and
  `{vetting.strict.minDelivered}` loads delivered".
- **"Carriers who've hauled for you":** name, loads hauled for you, on time %, each a link to Intel; the owner's
  carrier with a "Yours" chip.
- **"Your standing order":** margin %, cap on open loads, defaults from the economy **[open: fields]**.

### Money
1. "Cash", with the sparkline.
2. "Owed to you": shippers' invoices, lane, "brokered", due day; under it "About 1 load in 50 is never paid, more
   in a slump." (`{brokerRisk.defaultRate}`).
3. **"Owed by you":** to carriers: lane, carrier, due day. Above it the **bond meter**: "41,000 of your 75,000 FD
   bond in use" (`{staking.roles.broker}`), amber past 80%, red at 100% with "New tenders pass you by until this
   falls."
4. "This month": margin, defaults, fall-off charges, surety premium, licence fee; the net last.
5. Link rows: "Getting paid ›" (Finance, broker variant: a flat `{contract.brokerRate}`), and **"Move money ›"**
   (section 8).
6. A fold, closed: "Transfers", every capital transfer in or out, private.

### More
As the carrier's: Iuliia, Help, Company (this company's books), Intel, teasers.

## 3. Starting the brokerage at day 91

**Who may:** a player whose carrier is active (authority active, not liquidating). No starting grant; credit
starts fresh (the economy sets the score).

**Before day 91:** the teaser in More, its action "See what brokers earned last month" (Intel, brokers, sorted by
last month). **Seven days before**, once, a card on the carrier's Truck tab: "Brokerage opens Apr 2", three rows
with the player's figures: "Bond: 75,000 FD, locked while you broker" · "Licence: 300 FD a season"
(`{permits.brokerLicenseRenewalFd}`) · "Surety: 4,500 FD a year at a new brokerage's credit"
(`{permits.suretyPctPerYear}` at the starting score). **See what brokers earn** · **Dismiss**.

**From day 91** the teaser becomes **Start a brokerage**, a three-step sheet (full on a phone, the panel on a
laptop), "1 of 3" at the top, **Back** and **Next** at the foot. Settled with the writer: the verb is **Start**
throughout; three steps, the costs and the funding on one (the director's "one sheet before the button"):
1. **Name it.** "Brokerage name" (default "{carrier name} Logistics", 32 characters). Home hub: the carrier's,
   shown, not chosen **[open]**.
2. **What it costs and how you fund it** (one sheet before the button, per the brief). Rows: Licence 300 ·
   Bond 75,000 (locked) · Surety 4,500 a year · then the first capital transfer from the carrier: an amount field,
   prefilled with bond + licence + the first year's premium + `{brokerage.startCashFd}` of working cash
   **[open: the economy's figure]**, the transfer fee (section 8), and both companies' cash after. One sentence on
   the bond: "If you can't pay a carrier, the bond does, and you can never owe carriers more than it." One on
   grace: "Fall under it and new tenders stop after `{staking.graceDays}` days."
3. **Your terms.** Margin, cap on open loads, who may haul. Defaults filled.

**Confirm:** a summary row per step and **Start Red River Logistics**. Live: "Sent · in effect 06:02". Then the app
switches into the brokerage, the chip appears, Book shows its empty state, and Iuliia says the writer's one line.

**Not eligible or short:** the sheet still opens. The blocking reason sits in red where it applies ("Your carrier's
authority is suspended"; on step 2, "Red River Lines would be 31,000 FD short"), **Next** is disabled with the
reason beside it, and one link: "What brokers earned last month ›". No dead tap.

**After starting,** More's brokerage entry becomes "Red River Logistics ›" (switches). A second brokerage is never
offered.

## 4. Intel with two rows

Two rows, two cards, each with its own Miles, size, bands and month. Both carry the "Player" chip and, on the card,
"Same owner as Red River Lines" as a link (the brief: public). Pinned at the top under "How others see you": both,
the company in view first. The brokerage's row reads as any broker's: "Dallas · broker · credit C".

## 5. Iuliia

The writer's lines, one each, under the placement rule: the seven-day card's first showing; starting; the first
switch; the first "Broker it"; the first transfer. None on a refusal, a default or a fall-off.

## 6. "Broker it": a carrier's direct tender handed to its brokerage

**Where:** the carrier's contract tender card (Truck tab, "Contract tender: Chicago → Columbus, 355 mi"), beside
**Accept** and **Leave it for the board**. **Only on a tender** (a load a shipper tendered directly to the carrier),
never on a board load; only when the player has a brokerage that is active and not over its bond.

**Tap:** a sheet titled "Broker it through Red River Logistics", over the carrier's screen, no switch:
- rows: "Shipper pays" 1,060 FD (the contract rate) · "Post at" a margin control, 0–`{brokerage.maxMarginPct}`,
  showing the posted rate and "yours 106 FD" live · "Board fee" 32 · "Bond after" "42,000 of 75,000 in use" ·
  "Who may haul" the brokerage's setting.
- **Post it** (primary) · **Cancel**.

**After:** the tender card on the carrier reads "Handed to Red River Logistics · posted at 2.69/mi" for the rest of
the round, then leaves; the load appears in the brokerage's Book under On the board, trail starting at Tendered.
**[open]**: whether handing it over counts as the carrier accepting the tender (its acceptance %).

**Refusals, in red on the sheet:** "Red River Logistics is at its bond", "Red River Logistics' authority is
suspended", "The tender has expired".

## 7. "Tender to my carrier": the brokerage's direct freight, straight to its owner's carrier

**Where:** Book › Offered to you, the middle action. Shown only when the player has a carrier.

**Tap:** a sheet "Tender to Red River Lines":
- "Shipper pays" 3,100 FD.
- **"Pay your carrier"**: a slider bounded by the lane's band, `{brokerage.ownTender.band}` around the lane's usual
  clearing rate, labelled at both ends with per-mile figures ("2.31 – 2.83/mi"); the chosen figure large. Live
  under it: "Your brokerage keeps 380 FD" and "Your carrier earns 2,720 FD, 410 over its break-even" (both are the
  owner's, so both show).
- Two fixed lines: "Paid at 30 days, never factored or quick-paid." · "Counts toward your bond like any carrier's
  pay."
- **Tender it** (primary) · **Cancel**.

**After:** the brokerage's card moves to "Tendered to Red River Lines"; the carrier gets an ordinary tender card
headed "From Red River Logistics", with **Accept** (a truck) and **Leave it** as for any tender. Accepted: the trail
continues under Moving with the "Yours" chip. Left or expired: back to Offered to you **[open]**.

**Refusals:** "Red River Lines' authority isn't active", "That pay is outside the lane's band" (the slider can't
reach it; the string is for a modified client), "Red River Logistics is at its bond".

## 8. Moving money between the two companies

**Where:** Money in either company, the row **"Move money ›"**, shown only when the player has both.

**The sheet:** "Move money"
- From → To, both named with their icons; a **⇅** button swaps the direction.
- "Amount", a number field; chips "1,000" · "5,000" · "All you can" (the most the guards allow).
- Rows, live: "Fee" `{brokerage.transfer.feePct}` (1% proposed) · 120 FD · "Arrives" 11,880 FD · "Red River Lines
  after" 24,600 FD · "Red River Logistics after" 19,880 FD.
- One fixed line: "This is your own capital moving. It isn't revenue or cost for either company and counts toward
  no Miles, profit or Intel figure."
- **Move 12,000 FD** (primary) · **Cancel**. Live: "Sent · in effect 06:02".

**Guards, as plain refusals in red under the amount, and the button disabled:**
- "Red River Lines is winding up."
- "Red River Logistics is under its bond: nothing leaves during the grace days."
- "Red River Lines has overdue invoices to pay first."
- "That would leave Red River Lines below zero."
- "Red River Logistics keeps its 75,000 FD bond while it has loads open."

**After:** both companies' Money show the transfer under "Transfers" (date, direction, amount, fee); the cash card
moves; no toast.

## Open

1. **Economy:** `{brokerage.startCashFd}` (the prefilled working cash), `{brokerage.maxMarginPct}`,
   `{brokerage.ownTender.band}`, `{brokerage.transfer.feePct}` (1% proposed), the starting credit score, and the
   board fee's key (3% today; not found in config by name).
2. **Director:** the rule brief's §3 row 3 says the own carrier wins only through the board; Jeff's addition 2
   lets the brokerage tender to it directly. The revised brief should say both hold: direct tender for freight the
   brokerage received directly, the board for everything posted.
3. **Rules:** whether "Broker it" counts as the carrier accepting the tender; where a tender left by the own
   carrier goes; whether hand calls (Post/Pass, re-price a stuck posting) are a rule (the brief's question 5);
   the brokerage's home hub.
