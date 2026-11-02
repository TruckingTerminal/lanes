# Finance strings (writer, draft 1, 2026-11-03; against UX's `specs/finance.md` draft 1)

Every string on More › Finance and on Money's two link rows, keyed to UX's spec. Engineering builds the structure and drops these in. `{key}` is read from `economy.config.ts`, never typed; `{x}` without a key is a value from the world or from a helper the spec names. Sentence case; no string over 20 words; terms per `copy-audit.md`.

Short key names used below:

| Short | Config key |
|---|---|
| `{termsDays}` | `token.payment.termsDays` |
| `{quickPayPct}` | `token.payment.quickPayPct` |
| `{months}` | `token.payment.factoring.contract.months` |
| `{rate}` | `factoringRateFor` at the fleet named, from `token.payment.factoring.contract.rateByTrucks`, one decimal |
| `{brokerRate}` | `token.payment.factoring.contract.brokerRate` |
| `{maxTrucks}` | `company.maxTrucks` |
| `{leaseMin}` | `freeEntry.leases.minWeeklyFd` |
| `{loanRate}`, `{loanWeeks}`, `{repoAfter}` | `equipmentFinance.weeklyRate`, `.termWeeks`, `.missedPaymentsToRepossess` |
| `{missedToDefault}` | `equipmentFinance.purchase.missedToDefault` |
| `{ageYears}` | `token.credit.ageYears` |
| `{exitDays}`, `{haircut}` | `token.staking.exitDays`, `.instantHaircut` |
| `{minLock}`, `{slashMult}`, `{slashBase}` | `token.staking.lockDiscounts.minLockFd`, `.slash.discountMultiple`, `.slash.baseShare` |

**Jeff's rules, 2026-11-02.** "Make sure that Iuliia explains factoring and quickpay to owner operators who want to buy their own truck. The risk is real and they need to be well capitalized to make it work." "For now, let's not use the pools. Factoring and insurance are NPC and sinks." So: every money explanation below is plain, with no joke; no string mentions a pool or a deposit desk.

## Money: the two link rows

| Where | String |
|---|---|
| Under "Owed to you" | Getting paid: `{Net {termsDays} / Quick pay / Factoring until {date}}` › |
| Under it | Loans: `{fd}` FD owed · `{fd}` FD a week › |
| No loans | Loans: none › |

## Finance: the panel

| Where | String |
|---|---|
| Panel title | Finance |
| A refused order, under its button | the engine's reason, sentence case, full stop ("The lender carries at most 3 loans at your credit.") |
| Live world, on a button after it's pressed | Sent · in effect `{hh:mm}` |

## Card 1: Before your first truck (state A only)

| Where | String |
|---|---|
| Title | Before your first truck |
| Lead | On your own truck, shippers pay later and costs come now. Have a month of costs in cash. |
| Row | Running one truck, a month · about `{monthOfCosts}` FD (the economy's helper) |
| Row | Shippers pay you · `{termsDays}` days after delivery |
| Row | Your lease deposit · `{fd}` FD · counts toward the truck |
| Row | Your cash · `{fd}` FD |
| Verdict, enough | You have the month. |
| Verdict, short | You're `{short}` FD short of a month. Quick pay or factoring would close it; both cost. |
| Button | Go to the Dealer |

## Card 2: Getting paid

| Where | String |
|---|---|
| Title | Getting paid |
| Header, net | Net `{termsDays}`: paid `{termsDays}` days after each delivery. |
| Header, quick pay | Quick pay: paid on delivery, `{quickPayPct}` off each load. |
| Header, contract | Factoring: paid on delivery, `{rate}` off every load, until `{date}`. |
| Header, state A | On the lessor's truck you're paid the day you deliver. |
| State A note, under the dimmed rows | Opens with your first truck of your own. |

**The three option rows** (line 1 is the row's name):

| Row | Line 2 | Line 3 | Line 4, from the player's own loads |
|---|---|---|---|
| Net `{termsDays}` | Paid `{termsDays}` days after delivery | Costs nothing | Your next payment: `{fd}` FD on `{date}` |
| Quick pay | Paid on delivery | `{quickPayPct}` of each load · change back any time | On your average load: `{fd}` FD |
| Factoring | Paid on delivery, every load, every truck | `{rate}` of each load · `{months}` months · no early exit | On your average load: `{fd}` FD · about `{fd}` FD a month |

**Under the rows, always** (the writer's addition for Jeff's rule; UX to place it):

| Where | String |
|---|---|
| What quick pay is | Quick pay: each load is paid on delivery, less `{quickPayPct}`. No contract; stop any time. |
| What factoring is | Factoring: an outside company pays every invoice on delivery and keeps a share. A contract, `{months}` game months. |
| The risk | Both cost on every load. On a thin load, the fee can be the whole profit. |

**The factoring confirm sheet:**

| Where | String |
|---|---|
| Title | Sign a factoring contract |
| Rate | `{rate}` of every load, fixed until `{date}` |
| Set by | your `{n}` trucks |
| Covers | every truck you run, new ones too |
| Runs | `{start}` to `{end}` (`{months}` months) |
| Leaving early | not possible |
| Quick pay | closed until it ends |
| On your average load | `{fd}` FD |
| Buttons | **Sign for `{months}` months** · Not now |

**Under a contract:**

| Where | String |
|---|---|
| Progress bar | `{n}` days left |
| Log line | Paid so far under this contract: `{fd}` FD in fees on `{fd}` FD of loads |
| Control label | When it ends |
| Segments | Renew · Net `{termsDays}` · Quick pay |
| Under Renew | It renews at the rate your fleet sets that day: `{rate}` at `{n}` trucks. |
| Under Net / Quick pay | Then Net `{termsDays}` from `{date}`. / Then quick pay from `{date}`. |
| Exception, leased trucks | Leased trucks: the lessor still pays on delivery, no fee. |
| Exception, player shippers | Loads for player shippers wait `{termsDays}` days even under contract: `{n}` loads, `{fd}` FD. |
| Fold title | Your rate by fleet size |
| Fold rows | 1 truck · `{rate}` … `{n}` trucks · `{rate}`, to `{maxTrucks}`; your row marked "you" |

**Broker variant:**

| Where | String |
|---|---|
| Header | Factoring: `{brokerRate}` of each load, flat. |
| Bond bar | Owed to carriers: `{fd}` of your `{fd}` FD bond |
| Under it | Factoring doesn't raise what you may owe carriers. |

## Card 3: Credit

| Where | String |
|---|---|
| Title | Credit |
| Score | Credit `{score}` of 100 · band `{A–E}` (A is best, E worst) |
| What it gets you | Truck loans: `{down}` down · `{weeklyRate}` a week · up to `{n}` loans at once |
| What moves it, label | What moves it |
| Rows | Loads paid on time · `{pct}` · Licence age · `{days}` days of `{ageYears}` years · Claims on record · `{n}` |
| Loan row | Truck `{n}` · purchase loan · `{fd}` FD owed · `{fd}` FD a week · `{n}` weeks left |
| Missed payment | `{n}` payment missed. `{missedToDefault}` in all and the lender takes the truck. |
| Pay off | **Pay off · `{fd}` FD** · disabled: You have `{fd}` FD |
| Borrow row | Truck `{n}` · up to `{fd}` FD at `{loanRate}` a week over `{loanWeeks}` weeks · **Borrow** |
| Borrow sheet | Borrow against truck `{n}` · You get `{fd}` FD · Weekly payment `{fd}` FD for `{loanWeeks}` weeks · Miss `{repoAfter}` and the lender takes the truck · **Borrow `{fd}` FD** · Not now |
| Lease row | Truck `{n}` · leased · `{npcLeaseShareOfGross}` of every load, at least `{leaseMin}` FD a week · `{fd}` FD deposit held |
| Under leases | Leases are taken at the Dealer. |
| State A | Your lease deposit: `{fd}` FD counts toward your first truck. · then the "What it gets you" line |
| Empty | No loans. · No leases. |

## Card 4: Staking

Both ship (the producer, 2026-11-03). The stake tiers are the live rule, so their rows show first; the Later line sits under them. Engineering removes the tier rows with the lever, when the lock discounts switch on.

| Where | String |
|---|---|
| Title | Staking |

**Today's tiers, while the tiers are live** (removed with the lever):

| Where | String |
|---|---|
| Below the cap | Staking: needed past `{n}` trucks (`{fd}` FD to run up to `{n}`). |
| Rows | You may run `{n}` trucks · you run `{n}` · To run `{n}`: stake `{fd}` FD · Discount now: `{pct}` |
| Field | FD to stake |
| Buttons | **Stake** · Unstake (back in `{exitDays}` days) · Unstake now (`{1 − haircut}` back now, the rest burned) |
| Unstake now sheet | Unstake now? · You get back `{fd}` FD · Burned: `{fd}` FD · **Unstake now** · Keep it |

**Under the tiers, always:**

| Where | String |
|---|---|
| Badge | Later |
| The one line | Discounts for locking FD come with lock terms, later in the beta. |

**When the locks switch on:**

| Where | String |
|---|---|
| Lock row | `{fd}` FD · `{months}` months · `{pct}` off purchases · `{fd}` of `{fd}` FD discount left · ends `{date}` |
| Switch | Roll over |
| Button | New lock |
| Sheet segments | `{n}` month(s) · `{pct}` off · up to `{fd}` FD |
| Sheet note | Covers fuel, maintenance, rebuilds, insurance, board fees and the dealer. At least `{minLock}` FD. |
| Sheet button | **Lock `{fd}` FD for `{n}` months** |
| Break sheet | Break this lock early? · You get back `{fd}` FD · Burned: `{fd}` FD · Why: `{slashMult}` times the `{fd}` FD discount used, plus `{slashBase}` of the lock · **Break the lock** · Keep it |

## Iuliia on Finance

Moved here from `iuliia-lines.md`, which now points to this file. One line at most, in the caption strip, never over a card's figures. No joke in any of them: these are all money lines.

| Trigger | Line |
|---|---|
| First visit, state A | Before you buy, read the first card. On your own truck the money waits; the costs don't. |
| First visit, state B | Your truck, your paper. Choose how you're paid before the month chooses for you. |
| First visit, broker | You factor at a flat rate now. Your carriers still expect their money on time. |
| A contract is signed | Signed. Every truck, every invoice, until `{date}`. A bigger fleet renews cheaper. |
| Seven days before it ends | Your contract ends on `{date}`. Renew, or choose how you're paid after it. |
| A missed payment, a refusal, a repossession | none (the bad-news rule) |
