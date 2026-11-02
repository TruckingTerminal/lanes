# Finance (UX spec, draft 2, 2026-11-03; owner: UX; Cash it now added)

Sprint 2, item 2. The rules are ruleset 0.20.0, live: the factoring contract on
(`token.payment.factoring.contract`), purchase loans on, lease deposits counting toward the first truck. The
lock discounts (`token.staking.lockDiscounts`) are built and off; their card is specified here and marked
**Later**. Strings are the writer's placeholders; `{}` numbers come from config; other figures are one example
(a two-truck carrier).

## What's on screen today, and what's wrong (phone, 375 px, played 2026-11-02)

More › Finance shows Stake first (tiers, three buttons, a 40-word paragraph), then Getting paid, then a Credit
score with no meaning attached. Getting paid still says "a 1-year contract with a 0 FD stake … leaving early
forfeits the stake" (QA B8): false since this morning. Money shows the same Getting paid card a second time.
Nothing tells a player what a choice costs on their own loads.

## Where Finance lives

- **More › Finance**, opening with walkthrough step 9 beside the Dealer (as built). Not in the four-item bar.
- **Money keeps the ledger** and loses its Getting paid card and its Loans fold. In their place, two link rows
  under "Owed to you": "Getting paid: Net 30 ›" and "Loans: 38,400 FD owed · 412 FD a week ›", both opening
  Finance at that card. "The token" fold stays on Money.
- **Laptop:** the same cards in the 420 px panel, same order.

## The screen

Three cards in a fixed order, then the later one. Which comes first depends on one fact: does the company own a
truck yet?

| State | Order |
|---|---|
| **A. On the lessor's truck** (no owned truck) | Before your first truck · Getting paid (read-only) · Credit · Staking (one line) |
| **B. Owns a truck** | Getting paid · Credit · Staking |
| **Broker** (after day 91) | Getting paid (broker) · Credit · Staking |

Every number on a card is labelled in words where it sits: "6.0% of every load", never "6.0%" alone. No card
needs a legend. Money is always "FD"; rates per load are percentages; dates are game dates ("Apr 3").

### Card 1: Before your first truck (state A only)

The arithmetic Iuliia's step 9 asks for, done for the player. Four rows, label left, figure right:

| Row | Figure | Source |
|---|---|---|
| "Running one truck, a month" | "about 24,000 FD" | engineering: config per-mile costs × `{ui.finance.milesPerMonth}` (proposed 12,000) + insurance + a loan payment; the economy designer signs off the helper |
| "Shippers pay you" | "30 days after delivery" | `{token.payment.termsDays}` |
| "Your lease deposit" | "9,800 FD · counts toward the truck" | `depositCredit` |
| "Your cash" | "21,400 FD" | the ledger |

Under the rows, one verdict line, computed, never Iuliia's: green "You have the month." when cash ≥ the month,
else amber "You're 2,600 FD short of a month. Quick pay, factoring or cashing an invoice would close it; all
cost." Button: **Go to the Dealer**.

### Card 2: Getting paid

**Header line** (the state in one sentence, large type):
- Net: "Net 30: paid 30 days after each delivery."
- Quick pay: "Quick pay: paid on delivery, 10% off each load."
- Contract: "Factoring: paid on delivery, 5.9% off every load, until Apr 3."

**Three option rows** (outside a contract). Each is a selectable row, the current one marked:

| Row | Line 1 | Line 2 | Line 3 (from the player's own loads) |
|---|---|---|---|
| **Net 30** | "Paid 30 days after delivery" | "Costs nothing" | "Your next payment: 2,380 FD on Jan 31" (the next open invoice, if any) |
| **Quick pay** | "Paid on delivery" | "10% of each load · change back any time" | "On your average load: 238 FD" |
| **Factoring** | "Paid on delivery, every load, every truck" | "5.9% of each load · 3 months · no early exit" | "On your average load: 141 FD · about 1,700 FD a month" |

"Average load": the mean gross of the company's last ten deliveries (the lessor's included); hidden until there
is one. "A month": that × deliveries in the last 28 days. The factoring rate is `factoringRateFor` at today's
fleet, one decimal.

**Tapping a row:**
- Net 30 or Quick pay: applies at once (`set_pay_terms`), from the next delivery. Confirmation in place: the
  header line changes; no toast.
- Factoring: opens a **confirm sheet** (full on a phone, a card in the panel on a laptop):
  - "Sign a factoring contract"
  - rows: "Rate" 5.9% of every load, fixed until Apr 3 · "Set by" your 2 trucks · "Covers" every truck you run,
    new ones too · "Runs" Jan 3 → Apr 3 (`{contract.months}` months) · "Leaving early" not possible · "Quick pay"
    closed until it ends · "On your average load" 141 FD
  - buttons: **Sign for 3 months** (primary), **Not now**.
  - Live world: after Sign, "Sent · in effect 06:02" on the button until the world applies it.

**Under a contract** the three rows are replaced by:
- a progress bar from signing to the end date, "41 days left";
- "Paid so far under this contract: 3,120 FD in fees on 52,000 FD of loads" (the contract's log line);
- **"When it ends"**, a three-way control: "Renew" · "Net 30" · "Quick pay" (`setContractTerms`). Under Renew:
  "It renews at the rate your fleet sets that day: 5.7% at 5 trucks." Under the others: "Then Net 30 from Apr 3."
- Exceptions, each shown only when it applies: "Leased trucks: the lessor still pays on delivery, no fee." ·
  "Loads for player shippers wait 30 days even under contract: 1 load, 2,100 FD."

**"Open invoices"**, under the option rows (or under the contract's rows): the same invoice rows as Money's
"Owed to you", with **Cash it now** on each (section "Cash it now" below). Header: "Open invoices: 3 · 6,940 FD".
Empty: hidden.

**"Your rate by fleet size"**, a fold, closed: 1 truck 6.0% · 5 trucks 5.7% · 10 trucks 5.4% · 20 trucks 4.6% ·
30 trucks 3.9% (from `rateByTrucks`, stopping at `{company.maxTrucks}`), the player's row marked.

**State A (read-only):** header "On the lessor's truck you're paid the day you deliver." The three rows show,
dimmed, with Line 3 hidden and the note "Opens with your first truck of your own." No control works.

**Broker variant:** one rate, "5% of each load, flat" (`{contract.brokerRate}`), the same contract shape and
sheet; plus a bar "Owed to carriers: 41,000 of your 75,000 FD bond", red past 80%, and the line "Factoring
doesn't raise what you may owe carriers." The bond's controls belong to the brokerage spec.

### Cash it now (Jeff, 2026-11-02: "If a carrier needs it now, he needs it NOW")

Any open invoice can be cashed on the spot. Lands with the brokerage bump, behind the economy's switch
(`{payment.cashNow.enabled}`); with it off, nothing below shows.

**The rate,** computed per invoice, never typed:
- **Under a factoring contract:** the contract's rate plus an aging surcharge, `{payment.cashNow.agingPct}` for
  each day still to run to the due day (the economy's shape; if it sizes a different curve, only the "why" line
  changes).
- **Without one:** the spot rate, `{payment.cashNow.spotPct}`.
- The fee goes to the reserve; the player sees only fee and what lands.

**Which invoices have it.** Under Net 30, every open invoice from an NPC shipper or a bonded broker. Under a
contract, the ones still open from those payers (paper billed before signing). Under Quick pay there are none to
cash (already paid). **Not cashable, the button replaced by the writer's line in muted type:**
- **a player shipper's invoice**, for now, until the economy sizes the credit risk of cashing a player's paper:
  "Invoices from player shippers can't be cashed early yet.";
- **paper between the owner's own two companies** (the brokerage rule, row 4): "Paper between your own companies
  can't be cashed early.";
- **an invoice due today:** "It's due today. It lands without a fee."

**The invoice row** (Money › Owed to you, Finance › Open invoices; one component). The phone row is two lines, not
the three-column table:
- line 1: "Chicago → Columbus · 2,380 FD · due Jan 31 (19 days)";
- line 2: "You get today 2,142 · fee 238" and **Cash it now** (sm), right-aligned.
Both figures in line 2 are explain keys (`invoice.cashNowFee`, `invoice.cashNowLands`): the sheet's "how" shows the
rate's parts with this invoice's days.

**The confirm sheet** (full on a phone; a card in the panel on a laptop), "Cash this invoice now":
- rows, in the writer's words (`finance-strings.md`, "Cash it now"): "Invoice" Chicago to Columbus · 2,380 FD,
  due Jan 31 · "Fee" 5.9% contract + 4.1% for 19 days early · 238 FD (or "10% spot rate · 238 FD") ·
  **"You get today" 2,142 FD** · "Your cash after" 23,542 FD · the note "The shipper pays the factor on Jan 31.
  The fee goes to the reserve.";
- buttons: **Cash it now · 2,142 FD** (primary), **Not now**.
- Live world: "Sent · in effect 06:02" on the button until the world applies it.
- **Several invoices at once** (only from What now?, when more than one is due within a day of need): the same
  sheet with one Invoice row each and the totals; button "Cash 3 invoices · 6,240 FD today".

**After:** the row stays where it was until its due day, greyed, line 2 replaced by "Cashed Jan 12 · 2,142 FD
received". Cash moves at once; Money's sparkline shows it the next day. No toast. Both feeds (and the
brokerage's, for its paper) log the cashing.

**Refusals,** in red under the button (a world that moved, or a modified client): "This invoice is already
paid.", "In liquidation", and the three not-cashable lines above. No line from Iuliia on any of them.

**Guidance:** What now?'s rule 1 "collect" lever offers the cashable invoice with the lowest rate first and its
button opens this sheet (Jeff: her collect advice offers it first).

### Card 3: Credit

- **Score line:** "Credit 62 of 100 · band C (A is best, E worst)".
- **What it gets you** (`purchaseTerms`): "Truck loans: 15% down · 0.30% a week · up to 3 loans at once".
- **What moves it**, three rows: "Loads paid on time" 100% · "Licence age" 34 days of 3 years · "Claims on
  record" 0.
- **Loans**, one row each: "Truck 2 · purchase loan · 38,400 FD owed · 412 FD a week · 61 weeks left". A missed
  payment adds a red line: "1 payment missed. One more and the lender takes the truck." Button: **Pay off ·
  38,400 FD**, disabled with "You have 21,400 FD" under it when cash is short.
- **Borrow against a truck** (moved from Money): per owned truck with room, "Truck 2 · up to 12,000 FD at 1% a
  week over 26 weeks" and **Borrow**, which opens a confirm sheet with the weekly payment and the repossession
  rule before it acts.
- **Leases**, one row each: "Truck 3 · leased · 15% of every load, at least 250 FD a week · 4,500 FD deposit
  held". The lease itself is taken at the Dealer.
- **State A:** the deposit row again, "Your lease deposit 9,800 FD counts toward your first truck", and the loan
  terms line. Nothing else.
- Empty: "No loans." / "No leases." as single muted lines, not cards.

### Card 4: Staking

**Now (locks off):** the stake decides how many trucks a company may run (`staking.truckTiers`).
- Under the tier's cap minus one truck, one line: "Staking: needed from your 6th truck (20,000 FD for up to 10)."
- At the cap minus one, or with anything staked: "You may run 5 trucks · you run 4" · "To run 10: stake 20,000
  FD" · "Discount now" 0% (`staking.discounts`) · a number field and **Stake**, **Unstake** ("back in 28 days"),
  **Unstake now** ("75% back now, the rest burned"; red, a confirm sheet).

**Later (locks on), marked "Later" in the build until the switch:** the tier rows go; the card lists locks.
- Each lock: "20,000 FD · 6 months · 9% off purchases · 1,240 of 2,000 FD discount left · ends Jul 3 · rolls
  over" and a **Roll over** switch.
- **New lock** opens a sheet: amount; term as four segments, each showing its rate and its budget for that
  amount ("1 month · 3% off · up to 200 FD" … "12 months · 12% off · up to 4,800 FD"); "Covers fuel,
  maintenance, rebuilds, insurance, board fees and the dealer"; **Lock 20,000 FD for 6 months**.
- **Break early** on a lock: a confirm sheet with three figures, computed: "You get back 13,000 FD" · "Burned:
  7,000 FD" · "Why: twice the 1,000 FD discount you've used, plus a tenth of the lock". Buttons **Break the
  lock** (red), **Keep it**.
- Free stake (matured or broken) keeps the exit choice above.

## Iuliia on Finance

One line at most, in the caption strip, never over a card's figures (the sprint rule):
- first visit in state A (writer's line; the long "count a month" paragraph is not hers to say here: card 1
  shows it);
- first visit in state B;
- the day a contract is signed, and seven days before it ends;
- none on a missed payment, a refusal or a repossession (the writer's bad-news rule).

## States and refusals

- A refused order shows its reason in red under the button that sent it ("in liquidation"; "the lender carries
  at most 3 loans at your credit"). No toast.
- Test world: every control works; live world: the "Sent · in effect" state on each button until applied.

## Questions

1. **Economy:** a helper for "a month of running one truck" (card 1), so the figure is the engine's, not the
   client's arithmetic.
2. **Economy:** `{payment.cashNow.enabled}`, `{payment.cashNow.agingPct}` (per day to the due day, or the curve
   it sizes instead) and `{payment.cashNow.spotPct}`. Settled by Jeff 2026-11-02: Cash it now exists.
