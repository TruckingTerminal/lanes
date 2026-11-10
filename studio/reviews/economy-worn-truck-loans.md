# Economy: purchase loans on worn trucks (2026-11-09)

For the producer, on the director's question from QA's replay of client pass 2 (qa-client2-2026-11-09.md, item 2's
doubt; DECISIONS.md 2026-11-09): the Dealer opened on day 2 in both worlds with "You can buy today", because a worn
listing in the used market needed under 5k FD on the day on a purchase loan. The figure stays true by the director's
ruling; the question for the economy is whether the loan behind it is true to real equipment lending. No engine edit
here; the arms below ran on today's code in a scratch worktree at 4f9b73c with existing keys, and nothing is staged.

## 0. What the engine does today

**The loan reads the borrower, never the truck.** `purchaseLoans.ts purchaseTerms` sets the down payment, the weekly
rate and how many loans a company may carry from its credit score alone, between the strong and weak ends of
`equipmentFinance.purchase`: down 10–20%, 0.2–0.4% a week (10–21% a year, simple), 5 to 1 loans. Every loan runs
`termWeeks` 104 (two game years), locks a stake of 10% of the loan until it is repaid, and the live sales tax is 7% of
the price. Nothing in `purchaseTerms`, `financedCashNeed` or `financeBlock` looks at the truck: a 500k-mile tractor at
52% condition and a new Workhorse take the same share down, the same rate and the same term, and no odometer or age
refuses a loan.

**A company on day 2 scores 60.** `credit.ts`: base 40, plus 40 × a record of 0.5 for a company that has paid nothing
yet, plus up to 20 for authority age over three years (0 on day 2). Score 60 is band C and sits 0.4 of the way to the
weak end: **14% down, 0.28% a week, 3 loans.** QA's world-2 listing, a Workhorse and reefer at 502,339 miles and 52%
asking 17.8k:

| Cash at signing, today | FD |
|---|---|
| Down payment, 14% | 2,492 |
| The loan's stake, 10% of the 15,308 lent | 1,531 |
| Sales tax, 7% | 1,246 |
| Less the lease deposit the purchase releases | about −650 |
| **Cash needed now** | **≈ 4,620** (QA read 4,619) |

The same day-2 company buying the new Workhorse and van behind the Dealer's teaser ("13,112 FD in cash when you sign",
world 1) is offered the same 14% and the same 104 weeks: the new rig costs more, so it needs more cash, and that is the
only way the truck enters the loan.

**Where the beater comes from.** The bots sell worn tractors on the used market at their value (`ruleBots.ts sell`:
ask = value, floor 60%, a tractor past its last rebuild "sold on to run out its life elsewhere"), liquidations fire-sell
at 85%, and `truckValue` prices a 500k-mile, 52% rig near 18k against a lot rig and a new rig in the forties under
today's dealer index. The first-truck figure (`apps/web/src/finance.ts firstTruckRoute`) takes the cheapest route the
company can pay for, so a listing nobody else wanted at 18k, financed at 14% down, is the route on day 2.

## 1. What real equipment lending does

| | Real practice | Source |
|---|---|---|
| Down payment, sound truck, good credit | 10–20% is the usual minimum; the full range runs 0–35% | FreightWaves 2026 market piece; Bankrate; NerdWallet |
| Down payment, worn truck or thin credit | A 620 score with 18 months in business buying a $100k used truck "may face a 25% to 30% down payment"; 30% or more is typical for older, high-mileage trucks; "20% down changes the conversation at almost every desk"; high-mileage trucks make lenders "more hesitant" and they want "decent down payments, often around 20 percent" | FreightWaves; fitsmallbusiness; Overdrive (used-truck lending, part 2) |
| Age and mileage | Over 7 years or over 500,000 miles "creates additional risk premium that lenders price into the rate or use as a disqualifier entirely"; "more than 10 years old with more than 700,000 miles will be difficult to finance"; many lenders avoid trucks over 700,000 miles; some cap at 7 years, some go to 15 with documented maintenance; a conservative lender prefers under 500,000 miles and under 5 years | FreightWaves; Allstate Peterbilt; 1st Commercial Credit; biz2credit |
| Time in business | Banks want two or more years; under two years "may disqualify a borrower or push them toward higher-rate products"; online and specialty lenders go from three months to none, and "a larger down payment can offset thin credit or limited time in business" | FreightWaves; Bankrate; NerdWallet |
| Rate | 6–35% APR in 2026; a score under 680 adds 2–5 points; banks 4–8%, specialty lenders 7–12% for qualified borrowers; "a 620-score carrier buying a 2017 truck with 650,000 miles may face 15% to 25%" | FreightWaves; carrieratlas |
| Term | 12–84 months overall, equipment loans 12–72; "lenders will not write 5 year paper on a 12 year old truck"; "never finance a used truck for 7 years"; newer, lower-mileage trucks get the longer terms | Clarify Capital; otrucking; FreightWaves |
| Condition | Read through age, mileage and maintenance records (an inspection or appraisal), not a condition figure; "a long repair history could scuttle a loan deal" | Overdrive; FreightWaves |

Sources: [FreightWaves, the commercial truck financing market (2026)](https://freightwaves.com/news/the-commercial-truck-financing-market-has-more-options-than-most-small-carriers-realize-and-more-traps-than-most-lenders-will-tell-you-about) ·
[Bankrate, semi-truck financing requirements](https://www.bankrate.com/loans/small-business/semi-truck-financing-requirements) ·
[NerdWallet, semi-truck financing](https://www.nerdwallet.com/business/loans/learn/semi-truck-financing) ·
[Overdrive, qualifying for lending in the used truck market](https://www.overdriveonline.com/business/article/14882787/qualifying-for-lending-used-truck-market-part-2) ·
[Allstate Peterbilt, how to qualify for financing](https://www.allstatepeterbilt.com/blog/how-to-qualify-for-semi-truck-financing/) ·
[1st Commercial Credit, semi-truck finance programs](https://1stcommercialcredit.com/leasing-program/semi-truck-financing) ·
[biz2credit, truck finance options](https://www.biz2credit.com/transportation-business-loans/truck-finance-options-for-small-businesses) ·
[Clarify Capital, commercial truck loans](https://clarifycapital.com/blog/commercial-truck-loans) ·
[fitsmallbusiness, semi truck financing](https://fitsmallbusiness.com/semi-truck-financing) ·
[otrucking, semi truck loan rates](https://otrucking.com/resources/guides/semi-truck-loan-rates/) ·
[carrieratlas, what commercial truck financing costs in 2026](https://carrieratlas.com/what-commercial-truck-financing-actually-costs-in-2026/).
These are lender, dealer and trade-press pages, not underwriting guides; the figures agree with each other to within the
ranges shown, and that is the precision the rule below needs.

## 2. The gap

- **The truck is missing from the loan.** Real lenders set the down payment, the rate, the term and whether there is a
  loan at all from the truck's age and mileage. The engine sets all four from the borrower's credit. That is the
  falsehood the director suspected: on a 480k-mile, 48% truck a real lender asks 25–35% down at a higher rate on a
  shorter term, or declines; the engine asks 14% at its ordinary rate for two years.
- **A new business is priced as an ordinary one.** The credit score gives a company that has never paid a bill 60 of
  100 on day 2, and its age points arrive over three years. A real startup with no history gets no bank loan, and a
  specialty lender's loan at 25–30% down. The engine's 14% is a good-credit figure for a company with no credit.
- **The rate and term are inside the real ranges.** 10–21% a year simple is inside 6–35%; 104 weeks is two game years,
  shorter than the 36–60 months a sound used truck gets. Neither needs a change for a sound truck.
- **Condition is not a lender's input, and should not be.** The director's "never a floor on condition behind the
  figure" holds: a real lender reads age and miles and an inspection. The game's condition is miles since the last
  rebuild, the owner's maintenance choice, and it already prices itself through repairs and breakdowns. The rule below
  reads the odometer and the build year only.

So "You can buy today" on day 2 is true to a loan that is not true to life. The figure is right; the loan under it is
what moves.

## 3. The rule proposed: the lender reads the truck

One block, behind its own switch, default off; read by `purchaseTerms`, `financedCashNeed` and `financeBlock` with the
truck's spec beside the company (a listing's truck, the lot's `lotSpec`, a new rig at age 0), and so by `buyPlan`,
`firstTruckRoute`, the Dealer's figure and the bots' `financedBudget` without any other change to how they decide.

```
equipmentFinance.purchase.collateral: {
  enabled: false,
  // The truck as security. Over the free lines the down payment rises with age and mileage, in points of the price.
  freeYears: 3,        downPerYear: 0.03,
  freeMiles: 300_000,  downPer100kMi: 0.03,
  maxDownShare: 0.5,
  // Past either cap the lender declines: a cash purchase only. The lot's rigs (4 years, 450k) stay inside.
  declineOverYears: 10, declineOverMiles: 700_000,
  // Age shortens the term: the loan ends by the truck's `payoffYears` birthday, never under `minTermWeeks`.
  payoffYears: 7,       minTermWeeks: 26,
  // Age raises the rate: this much a week per year of age over freeYears (0.03% a week ≈ 1.6 points a year).
  weeklyRatePerYear: 0.0003,
  // A new business: a company under `years` of authority that has never owned a truck puts `downAdd` more down on it.
  newBusiness: { years: 1, downAdd: 0.10 },
}
```

The down payment is the credit share plus the three add-ons, capped at `maxDownShare`; the stake, the tax and the
credit rate stay as they are. The decline is a refusal with its figure ("the lender won't finance a truck past 700,000
miles; cash only"), so the Dealer's figure and Iuliia's line can say it, and the first-truck route then reads the
cheapest route that is open, as it does now.

**What it does to the day-2 cases** (the QA worlds; a 4-year-old truck assumed for the listing, the lot's age):

| Route, day-2 company (credit 60) | Today: down · cash now | Rule: down · cash now | Term, rate |
|---|---|---|---|
| QA's listing: Workhorse + reefer, 502k mi, 17.8k | 14% · ≈ 4,620 | 14 + 10 (new business) + 3 (age) + 6.1 (miles) = **33.1%** · ≈ 7,670 | 104 wk (pays off at age 6, under 7) · 0.31%/wk |
| A lot rig: 4 years, 450k mi | 14% | 14 + 10 + 3 + 4.5 = **31.5%** | 104 wk · 0.31%/wk |
| The new Workhorse + van behind the teaser (≈ 46.5k) | 14% · 13,112 | 14 + 10 = **24%** · ≈ 17,300 | 104 wk · 0.28%/wk |
| A 7-year, 650k-mile run-out tractor | 14% | 14 + 10 + 12 + 10.5 = **46.5%** | 26 wk (the floor) · 0.40%/wk |
| An 11-year or 720k-mile tractor | 14% | declined: cash only | — |

A company a year old with one truck owned and a clean record (credit ≈ 67) pays 13% plus the truck's add-ons and no
new-business share: 22% on the lot rig, 13% on a new one.

**What it does to a newcomer's day to the first truck.** At the cautious owner-operator's pace (cash 4,947 on day 1 to
8,887 on day 7 while leased, with the 30% hold building the deposit that counts toward the purchase: about 800 FD a day
toward a truck), the listing route moves from day 2 to about day 5, the new-rig route from about day 12 to about day
18. The rule makes the loan true; it does not by itself make the first truck hard to get. What makes a first truck
hard in life is the price of a sound one and the lender's view of a startup, and the first is already in the game
(a sound rig in the forties, a beater at 18k that will cost its owner in repairs, which Iuliia's line now prices).

**The harder version, if Jeff wants the real brake:** `newBusiness.minMonths` (3), no purchase loan at all before
that much authority. A specialty lender's floor is three to twelve months; banks' is two years. Under it a newcomer's
first truck is a cash beater (18k at 800 a day is about day 17), the lot rig for cash (about day 50) or the loan after
three months, and the lessor's path carries the first quarter as a real lease-purchase does. It is a pacing decision,
not a lending truth, so I put it to Jeff as an option and recommend the collateral rule alone first; the `ln-cash` arm
below bounds what no loans at all does to the bots.

## 4. What it does to the bots

The rule as proposed needs engine code, so the arms use today's keys as bounds: the worn-truck down applied to every
loan (`downShare` [0.25, 0.35]), the worn-truck terms applied to every loan (that plus `termWeeks` 52 and
`weeklyRate` [0.003, 0.005]), and no purchase loans at all (`purchase.enabled` false). The rule itself sits between
today and the first bound for first trucks, which are nearly all worn (listings and the lot), and leaves fleets' new rigs
at today's terms, which the bounds do not. Live profile, seeds 1–2, 730 days, in the 4f9b73c worktree, launched in the
16:45 vitest gap.

| Arm | Seed | First owned truck, median day | Bought within 84 d | Greedy · random · conservative owner-operators' median day | Purchase loans made (M FD) | Defaults · seized | Written off (M) | Used-market sales | Companies bankrupt (oo · fleet) | OO liquidated share | OO profit / truck-week | Fleet profit / truck-week | Owned trucks at day 730 | NPC pay (M) | Fill |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Today** | 1 | 28 | 253 of 366 | 17 · 22 · 117 | 53.0 | 124 · 49 | 0.84 | 527 | 135 (49 · 48) | 0.12 | 2,652 | 2,643 | 602 | 812 | 0.538 |
| **Today** | 2 | 51 | 221 of 352 | 22 · 38 · 173 | 53.8 | 136 · 74 | 0.81 | 554 | 89 (56 · 15) | 0.14 | 2,354 | 2,166 | 638 | 825 | 0.570 |
| Down 25–35% on every loan | 1 | 44 | 243 | 25 · 38 · 128 | 29.5 | 100 · 44 | 0.46 | 465 | 134 (53 · 44) | 0.13 | 2,626 | 2,673 | 601 | 784 | 0.565 |
| Down 25–35% on every loan | 2 | 82 | 179 | 44 · 64 · 189 | 29.0 | 84 · 35 | 0.29 | 500 | 66 (40 · 8) | 0.10 | 2,369 | 2,050 | 608 | 784 | 0.589 |
| Worn terms on every loan (that, 52 weeks, 0.3–0.5%/wk) | 1 | 44 | 250 | 25 · 38 · 127 | 26.6 | 97 · 56 | 0.30 | 452 | 122 (43 · 42) | 0.11 | 2,766 | 2,658 | 595 | 784 | 0.580 |
| Worn terms on every loan | 2 | 82 | 179 | 43 · 67 · 195 | 26.7 | 89 · 49 | 0.37 | 473 | 82 (52 · 9) | 0.13 | 2,413 | 2,180 | 574 | 790 | 0.577 |
| No purchase loans | 1 | 87 | 167 | 71 · 79 · 141 | 0 | 0 · 0 | 0 | 385 | 125 (53 · 42) | 0.13 | 2,431 | 2,654 | 525 | 760 | 0.622 |
| No purchase loans | 2 | 143 | 49 | 115 · 134 · 200 | 0 | 0 · 0 | 0 | 402 | 87 (55 · 7) | 0.14 | 2,224 | 2,089 | 548 | 747 | 0.648 |

Nearly every free-path company still owns a truck by day 730 in every arm (362–365 of 366; 346–349 of 352).

- **The one-truck company's path to its first owned truck:** the worn-truck down on every loan moves the median from
  28 and 51 days to 44 and 82, and the share buying inside 84 days from 69% and 63% to 66% and 51%; the greedy
  owner-operator's median day goes 17 → 25 and 22 → 44. The rule proper sits under this, since it spares a new rig
  (14% + the new-business 10%) and the first trucks that are bought new. No loans at all puts the median at 87 and 143
  days with 46% and 14% inside 84: the cash beater and the lot rig for cash, the lessor's path carrying the quarter.
- **The paper gets better:** half the loans are written (53M → 29M a run), defaults fall 19–38%, seizures 10–53%, and
  the FD written off on them 45–64%. The lender's book is the thing the real rule fixes, and the bots' version of it
  shows the same.
- **Liquidations do not move:** the owner-operators' liquidated share stays 0.10–0.14 in every arm, and companies
  bankrupt go 135 → 134 → 122 → 125 and 89 → 66 → 82 → 87. Dearer credit does not sink the one-truck companies; it
  delays their truck.
- **The carriers' income:** the owner-operators' profit per truck-week is inside ±4% in the two bound arms (−1.0% and
  +0.6%; +4.3% and +2.5%) and the fleets' inside −5% to +1%; with no loans at all it is −8% and −6%.
- **One coupling under the cap, the reading that matters for the gate:** NPC pay falls 3.4–5.0% in both bound arms and
  6–10% with no loans. The chain is the refill: a truck bought on a loan sinks its price (and later its interest) while
  the loan faucets less than the price, and the cap's monthly budget refills from the trailing sinks net of faucets; fewer
  and later purchases mean fewer equipment sinks (13% of all sinks today), a smaller budget, and volume cut before rates,
  which is also why fill rises from 0.54 to 0.57–0.65 as loans tighten. The rule proper, sparing new rigs, should cost
  less than the bound's 3–5%; the ten-seed pair says how much.

**The carriers' line against the twin** is the gate's reading and needs the ten-seed 1460-day pair on the built rule
against its cap-off twin (about an hour of the machine in a clear gap); it is the condition for the ruleset, as for
every market rule, and these arms say whether it is at risk: the bound arms take 3–5% off NPC pay and leave the owner-operators' profit per truck-week within ±4%, so the
floors (carriers in service and cleared loads a day at 72% and 75% of the twin's at years 3 and 4) have that much less
room; the twin moves too, since the same lender writes its loans, which is why the pair and not these arms decides.
Nothing here says the line fails; nothing here says it passes.

## 5. Ruleset and order

- **A rule change for Jeff:** the lender reading the truck changes what the bots can buy and when, so it is a market
  rule, behind the switch, into a ruleset at a restart with no players; the ten-seed gate pair on the built rule first.
  It is independent of the windows ruleset and can ride before or with it.
- **The client:** the Dealer's figure and Iuliia's line already name the truck and the catch (the director's ruling);
  the rule adds one state, "cash only" with the cap's figure, and the sheet's loan line shows the down payment's parts
  (credit, the truck's age and miles, the new business) so a player can read why.
- **The bots:** `financedBudget` and `canCarry` take the truck's spec; nothing else in their decisions changes.

## 6. What a red team would do with it

1. **Buy for cash, then borrow against the truck.** The NPC lender writes no cash-out loan (DECISIONS.md 2026-11-03),
   Equipment Finance lends 35% of value net of purchase loans and is closed with the pools. No new hole.
2. **Dodge the new-business share.** It is keyed to the company's authority age and to never having owned a truck, so a
   second company is newer, not older, and a bought truck ends it. Sybil companies gain nothing from it.
3. **Game the odometer.** A truck's miles only rise; a rebuild resets condition, not the odometer, so the collateral
   add-ons cannot be rebuilt away. Fine.
4. **The sellers' side.** Fewer buyers can finance a worn listing, so bots' listings sit longer and step down to their
   60% floor: cheaper beaters for cash buyers, a little less for the fleets selling them. The arms' used-market sales
   and the fleets' line read it.
5. **A player as lender.** There is none in Phase 0; a player lessor's lease-purchase (`playerLeases`) is the real
   route a startup takes, and it is untouched.

## What ran, and where

Four arms × two seeds (`apps/sim/src/run.ts`, 730 days, live profile, `--set` on today's keys) in a scratch worktree
detached at 4f9b73c; the reports and logs are kept at
the economy's session scratchpad
and the worktree is removed. Nothing in the shared checkout changed and nothing is staged.
