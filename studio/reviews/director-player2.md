# Triage: the second player diary (the director, 2026-11-03)

Source: `playtests/play-2026-11-02-impatient-fleet-owner.md` (e5da332), with 19 screenshots. An impatient fleet owner on a phone, on a small-fleet start, playing Jan 3 to Feb 2 at build `adfb916`. Read it beside `director-player1.md`. Severity as there: **B** loses a stranger, **S** costs trust, **M** confuses, **L** polish.

**What this sitting adds.** Diary 1 was a reader the game punished for asking. Diary 2 is a skimmer the game never slowed down. The two failures are mirrors:
- the game puts guardrails on the safe actions and none on the dangerous ones;
- every growth door is shut or mislabelled.

So the only decisions he met were expensive ones, made blind, and the game played itself between them. He chose no loads all month and called it "a screensaver". That breaks pillar 3 ("growth is earned and risky") the other way round: risk with no information is not a decision.

**What diary 1 already covers:**
- The dispatcher booking before a touch: R1, extended below.
- The round firing under the thumb: diary 1, row 10.
- "Kept" against cash: row 4.
- The late badge red every night: row 12.
- Lines pointing at things that aren't there: R5.
- **Not hit this time:** the card trap (row 1). A skimmer never taps a number. That is no reason to slow its fix.

## Rulings (numbered on from R5)

**R1, extended. A fleet start's dispatcher waits too. Goes to Jeff with R1.**

Two game hours in, the dispatcher had won a load and Iuliia said "You won one", before he had touched anything. Jeff's rule covers a one-truck company. A fleet start should meet the same first decision:
- **Iuliia's first line offers the choice:** "Two trucks: bid one yourself, or let the dispatcher run both." It comes with one button, **Let the dispatcher bid**.
- **If he does neither,** the idle card offers it after the first idle round, as in R1.
- **Past the first decision,** a fleet's dispatcher runs as today. A fleet can't be bid by hand, and that is fine. A fleet owner's calls are the rules, the hires and the purchases, which is why R6 and R7 matter.

**R6. A confirm card on every expensive or irreversible action.**

A 19.1k truck at 85% of his cash, and a 23.5k APU, each went in one tap. A loan got a full confirm card. That is backwards.

**Rule:** any action that is irreversible, or that spends more than `{guard.confirmShareOfCash}` (25%) of cash, gets one confirm card first. Irreversible means: buy, scrap, sell, fit an item, hire someone whose wage passes a week's net, or sign a contract.

The card shows four things:
1. **What it costs.**
2. **What's left afterwards,** in cash and in weeks of cushion.
3. **What it does,** in one line.
4. **The one risk that matters,** for example "15% of its life left, no rebuilds: it runs until it's worn out, then goes for scrap".

**The one-tap rule:** one tap opens the card, a second confirms, and the confirm button never sits where the first tap landed.

Engineering builds it, UX places it, the writer words it, and each item's "what it does" comes from the explain table. Not a rule change.

**R7. Every door says what opens it, and nothing offers what it won't give.**

Pillar 3 allows locked doors. It never allows misleading ones. The failures:
- "Used trucks deliver today", and then a 6–10 week wait after paying.
- A "No money down" lease that then refuses him for a deposit, with no amount given.
- Every BORROW figure answered "Over the loan-to-value limit".
- The yard limit shown only after the second order.
- MORE YARD SPACE opening a locked page.

**Rules:**
- **An offer is what it delivers.** BORROW shows only an amount it will lend. The lease shows the deposit as a figure before the button. The Dealer's lines say what delivers today and what is ordered, with the date.
- **A refusal names the amount, the condition and the date.** "Deposit 4,800 FD: you have 3,100." "Your yard holds 5 trucks: this order makes 6."
- **A check that will refuse comes before the money,** never after: the yard check runs before the order.
- **A locked door says what opens it and when,** and offers what can be done now. MORE YARD SPACE says when yards open, and offers parking, selling or leasing out meanwhile.

Engineering and the writer. Not a rule change.

**Also, for the economy:**
- Does a small-fleet start have a growth path in month one? He had 78k by week four, and nothing he could buy helped the fleet.
- The new-truck lead time went from 30 to 61 days in two weeks, with no line explaining it.

That might be right, as dealer supply tightening. If so, it needs a line. If not, it needs sizing.

**R8. Auto-staff starts off, and never hires what the company can't pay.**

Auto-staff, on by default, hired a driver and an 843 FD-a-week dispatcher while he had 772 FD. A setting that spends money for the player, unasked, is the R1 problem in another form.

**Rulings:**
- **Default off.** Iuliia offers it with the first empty seat.
- **On, it never hires** while cash covers less than `{guard.hireCoverWeeks}` (4) weeks of the new wage. A blocked hire is a Needs-you item: "A seat is empty: hiring {name} at {fd} a week needs {fd}."

Both change engine defaults and a rule, so they go to the economy with R1's bump. The missing dispatcher wage on the weekly costs list is an engineering bug.

**R9. The red badge means "needs you", and every item in it has a button.**

The failures:
- "Rates · New" got the same red count as "a truck has no driver".
- The tired-driver cards ("out 22 days") counted 3 on the badge and had no button.
- Breakdowns (3,072 and 2,469 FD) and shoulder tickets showed as grey log text.

**Rules:**
- **The badge counts only things the player can act on,** ranked by cost or risk. Every item carries its action. A tired driver's is **Send home when idle**.
- **A new tab gets a dot, never the red count.**
- **Money events above `{guard.newsFd}` (500 FD)**, such as a breakdown, a fine or a write-off, show in the money style, not grey. Each can be tapped for an explanation.
- **They join the badge only when a decision is waiting:** the truck is down, or a rebuild is due. A breakdown's explanation says what made it likely: worn, past its last rebuild, the rain.

Engineering, UX and the writer. Not a rule change.

**R10. A line with a button stays until it is answered.**

The month close ("earned 216,833, spent 102,100, kept 114,733 · READ THE MONTH") rotated away in about seven seconds, to a weigh-station tip.

**Rule:** a caption line carrying a button stays until the player taps it, dismisses it, or leaves the screen. No tip or rotation replaces it. This sharpens R2: a line retires when it is false or answered, never on a timer while its button is live. And the button must lead somewhere: Money needs the month report that "Read the month" promises, or the button goes.

## Findings, ranked by how a stranger feels them

| # | Finding | Owner | Rule it touches | Sev | Fix |
|---|---|---|---|---|---|
| 1 | **A 19.1k truck at 85% of cash, and a 23.5k APU, in one tap,** with no word on what they are; the truck's 15% life left shown only afterwards | Engineering, UX, writer | Pillar 3; R6 | **B** | R6 |
| 2 | **Growth doors that mislead:** "deliver today" against a 6–10 week wait; "No money down" then "not enough for the deposit" with no amount; BORROW refused at the figure it offered; yard full only after the order; MORE YARD SPACE locked | Engineering, writer, economy | Pillar 3; the bible's "teasers are never a dead tap" | **B** | R7 |
| 3 | **The dispatcher won a load before any touch** on a fleet start | Jeff | R1 | **B** | R1, extended |
| 4 | **Auto-staff hired 843 a week at 772 cash;** the dispatcher's wage missing from weekly costs | Economy, engineering | R8 | S | R8; the bug |
| 5 | **Badge noise and dead items:** "Rates · New" in red; tired-driver cards with no button; breakdowns and tickets in grey | Engineering, UX, writer | R9; `guidance-ux.md` section 0 (the badge's one job) | S | R9 |
| 6 | **The month close's line and button gone in 7 s,** pointing at a month report that doesn't exist | Engineering, writer | R10; R5 | S | R10 |
| 7 | **Contradictions:** "Paid Feb 5" on quick pay; "the lessor's cut" on owned trucks (QA's **B9, open since the sprint 1 replay**); "Fines paid 0" after three tickets; the 7,184 invoice reappearing under a new lane; two loan rates on one page, unlabelled; loans "owed" for trucks not yet delivered | Engineering, writer | Diary 1, row 4 (figures that don't reconcile) | S | Each line from the settlement's true terms. B9 at last. Fines counted. One invoice, one lane. Each rate names its loan. "76,156 owed, for 2 trucks on order." |
| 8 | **The fleet choice hidden under START;** a skimmer becomes an owner-operator without seeing it | UX | `first-ten-minutes.md` S1 | S | The start type sits above the button, with both options visible; START names the choice ("Start: small fleet") |
| 9 | **HIRE buttons off the right edge;** Staff opens scrolled to the middle; hiring gives no toast | UX, engineering | Phone layout | S | The phone layout; open at the top; "Hired {name}, {fd} a week" |
| 10 | **Cards and sheets move under the thumb:** Finance's quick-pay card, the sheet jumping to full height mid-tap | UX, engineering | Diary 1, row 10 (the same family) | S | No layout shift within `{ui.tapSettleMs}` of a touch; sheets resize only between taps |
| 11 | **SCRAP · 4,200 sits beside BID BY HAND** on a 159k truck | UX | R6 | S | Destructive actions go in an overflow, behind R6's card, showing the truck's value beside the scrap price |
| 12 | **The dispatcher's stop choice earned three shoulder tickets** the player paid | Economy, engineering | Pillar 1; diary 1, row 27 | M | The route planner books a legal stop ahead when one is in reach before hours run out. A ticket's line names who chose the stop. |
| 13 | **His own truck kept drawing 2–5/mi loads** while the hired drivers got 8–15 | Economy | The dispatcher's quality (R1's bid anchor) | M | Check with the bid-anchor fix; the owner's truck should not be the dispatcher's leftovers |
| 14 | **"Your own truck. No lessor's share now"** said to a fleet start that began owning two | Engineering, writer | `guidance.md` milestones | M | The first-owned-truck milestone and step 9 fire only for a company that started leased |
| 15 | **New-truck lead time 30 → 61 days,** with no line | Economy, writer | R7 | M | The Dealer says why the wait grew, or the economy sizes it |
| 16 | **Upgrades (APU, aero kit, premium tires, sleeper) say nothing** about what they do or whether they paid off | Writer, engineering | `guidance.md` section 2 (help on every figure) | M | An explain entry for each: what it saves or earns, and the payback in weeks for this truck |
| 17 | **The map camera jumps;** the map sat on Albuquerque while the truck was home in Los Angeles | Engineering | – | L | The camera follows the selected truck, and shows home time where the truck is |
| 18 | **Repeated driver surnames** (Hayes ×3, Kowalski, Lowe, Haddad ×2) | Engineering, writer | Pillar 2 (rivals and staff should read as people) | L | A wider name pool, no repeats within a company |
| 19 | **At Day in 6 s the game is "a money fountain and a screensaver"** | – | The bible's feeling | – | **No change.** Speeds exist only on the test page; the live world runs at one pace. A fleet running itself while the owner is away is the business, as designed. What the impatient player lacks is decisions worth touching, which is R6 and R7, not a slower clock. |

**Order for the next build,** after diary 1's rows 1, 2 and 4:
1. R6 and R7, together: decisions with information.
2. R9 and R10: the badge and the caption mean what they say.
3. R1 (extended) and R8, to Jeff and the economy, in R1's bump.
4. The rest by severity.
