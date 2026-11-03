# Triage: the fourth player diary (the director, 2026-11-03)

Source: `playtests/play-2026-11-02-gamer.md`, with 24 screenshots: a tycoon gamer on a laptop with no trucking background. A small-fleet start at Chicago, Jan 3 to Feb 6, nearly all at the fastest speed, at build `3ccaee9`.

What the gamer got out of it:
- **Money:** 271,665 FD kept in month one. The working trucker kept 30,503.
- **Size:** five trucks, and a net worth of 540.9k.
- **The verdict:** "solved by minute 15".

Read it beside `director-player1.md` to `director-player3.md`. Severity as there. **Exploits come first.**

**What this sitting adds.** The first three diaries found a game that is hard to learn and not yet true. This one finds a game that can be beaten. The loop is three settings: penny drivers, a 300% bid margin, and every rule-breaking policy switched on. After that, "nothing in the world pushed back". That breaks pillar 3 outright: growth is meant to be earned and risky, and here it is neither.

The diary is valuable because the game showed its own math ("Your break-even 1.12/mi"). The fix is to make the math push back, not to hide it. **Every exploit row below is the economy's, and changes the frozen economy, so each goes to Jeff.**

**What diaries 1 to 3 already cover:**
- The dispatcher acting before a touch: R1, extended.
- The cheapest truck hiding its life: R6.
- The lease's unnamed deposit: R7.
- Auto-staff hiring unseen: R8.
- "The lessor's cut" on owned trucks, quick pay still saying "Paid Feb 8", and the relabelled invoice: diary 2, row 7.
- The hire and Rates tables off the edge: diary 2, row 9.
- Staff redrawing under the mouse: diary 2, row 10.
- Upgrades with no stats: diary 2, row 16.
- Book-now against the clearing rate, and the "2.50 Hot" rows: R11 and diary 3, row 2.
- The dollar prices: R4.
- NEW TEST WORLD on Company: diary 3, row 17.
- "No driver" on the ticker after hiring: R2.

## Rulings (numbered on from R15)

**R16. Driver pay has a floor and a consequence. Economy, then Jeff.**

SET PAY took 0.01 FD a mile for a five-star driver. Four drivers went "unhappy" and drove all month anyway. Break-even fell to about 1.1/mi, and that one setting is most of the 271k.

**The design target**, which the economy sizes:
1. **A floor.** No pay may be set or offered below `{labor.payFloorShareOfMarket}` of the driver's market rate. A minimum is real: drivers paid by the mile are protected by one.
2. **Unhappy has teeth, inside days, not seasons.** An unhappy driver gives notice after `{labor.unhappyNoticeDays}` and then quits, with a line and a Needs-you item while there is still time to raise pay. Rivals poach unhappy drivers first.
3. **A reputation among drivers.** A company that underpaid finds drivers asking more for a while.

With a floor in place, break-even can no longer be driven to nothing, and the dispatcher's bids stop poisoning the market.

**R17. A ceiling is a ceiling. Economy, then Jeff.**

With the dispatcher's margin at 300%, it won loads above every ceiling: 12.46, 13.96, 18.07 and 18.24/mi. The engine's rule is "a bid above the ceiling wins only if nobody bids under it".

**Ruling:** retire that rule. A shipper never pays above what it posts (pillar 1). A load nobody takes at its ceiling already has a path: book-now steps up each round it waits.
- **The engine refuses any bid above the ceiling.**
- **The dispatcher bids at the ceiling** when its margin would take it over.

With R1's bid anchor (bids from "usually clears near", break-even as the floor) and R11's book-now placement, the auction becomes a decision again: bid under and maybe win more often, or book now and pay for certainty.

**R18. Breaking the rules costs more than it saves, and the record catches up. Economy, then Jeff's compliance call.**

The gamer ran 15-hour days, 56 mph always and deferred maintenance for the whole month:
- **What it cost:** 23.2k in fines (about 6% of revenue), three out-of-service orders and one breakdown.
- **What it got:** a safety rating still reading "Not yet rated", against "14.5 of 5 · alert".

**The design target:** over a season, for a typical company, each policy's expected cost exceeds what it gains. That means:
- **Fines scale with what the breach earns,** not a flat 250–465 FD.
- **An out-of-service order costs days, not minutes.**
- **Alerts bring an audit inside `{safety.auditDays}`.** A company with alerts is rated, never "Not yet rated". A Conditional or Unsatisfactory rating then closes doors: strict-vetting loads, better insurance, contract offers.

**For Jeff's compliance call, my position has changed, on evidence.** In R3 I left the 15-hour and 56 mph options on screen because each was costed on the page. This diary shows the cost doesn't bite: 6% of revenue against roughly a third more miles. A free cheat is not a risk, and pillar 3 wants risk.

**My recommendation:**
- **The options stay** only if this bump gives them R18's teeth.
- **Otherwise they come off the screen until it does.**

Either way, the writer says why 56 mph is the reckless setting. A non-trucker reads 70 on the highway; the game's legal truck speed is 50.

**R19. Caps and stakes say what binds.**

The staking page said "To run 10: stake 20,000 FD". He staked 40,000 and could still "run 5", with no total shown and no answer from UNSTAKE. The real cap was the yard, explained only on the Business page, locked until Jan 29.

**Rulings** *(engineering, writer)*:
- **Every cap is shown in one place, with the one that binds first.** "You may run 5: your yard holds 5. Yards open Jan 29. Staking allows 10."
- **A stake that buys nothing today says so before the money moves** (R6's card).
- **Staking shows its total,** what its discount applies to, and its term.
- **UNSTAKE answers.**
- **While the stake tiers are off** (Jeff: truck prices are the entry fee), no staking text promises trucks.

**Borrow.** It offered 55,661 and answered "The pool doesn't have the cash". Jeff took the pools off. A cash-out loan that only a pool can fund must not be offered while the pools are off. Either the NPC lender writes it, or the offer goes. Engineering, with the economy's word on which.

**R20. Every button answers.**

These did nothing visible: BID at 30/mi against a ceiling of 7.64, BOOK NOW on a strict-vetting load, the lease past five trucks, UNSTAKE, and the poaching OFFER.

**Rule:** no control acts silently. Each one either:
- **shows its result** ("Offer sent to {name}: they answer by {day}", shown as pending on the row); or
- **shows its refusal, with the reason the engine already has:** "Above the ceiling, 7.64", or "Strict vetting: needs 90 days' authority and tracking".

Engineering. This finishes R7 for every control, not only growth.

**Also, the dispatcher signed a contract while he wasn't looking** (Racine → Knoxville at 4.29). A contract is a 91-day commitment. In R1's family, the dispatcher signs contract offers only if its rules say so, and that rule starts off. Economy, with R1's bump.

## Findings: exploits first, then by how a player feels them

| # | Finding | Owner | Rule it touches | Sev | Fix |
|---|---|---|---|---|---|
| 1 | **Penny drivers:** pay set to 0.01/mi, no quit, break-even about 1.1, most of the 271k | **Economy → Jeff** | Pillar 3 | **B** | R16 |
| 2 | **Bids above the ceiling win;** a 300% margin prints money | **Economy → Jeff** | Pillar 1 | **B** | R17 |
| 3 | **Undercutting is never right:** book-now at 1.4–2× the clearing rate | Economy → Jeff | R11 | **B** | R11; R17 |
| 4 | **Rule-breaking pays:** fines about 6% of revenue, "Not yet rated" with alerts | **Economy → Jeff** | Pillar 3; Jeff's compliance call | **B** | R18; the revised position on the options |
| 5 | **Silent buttons:** BID, book-now (vetting), lease, unstake, poach | Engineering | R20 | S | R20 |
| 6 | **The staking promise against the yard cap;** no total; UNSTAKE silent | Engineering, writer | R19 | S | R19 |
| 7 | **BORROW offered with no pool to fund it** | Engineering, economy | Jeff: no pools | S | R19 |
| 8 | **The clock ran two game days past Pause** | Engineering | Trust in the controls | S | Pause takes effect on the click, and the click is acknowledged. Reproduce first: the diary says the click may have missed. |
| 9 | **The dispatcher signed a 91-day contract unasked** | Economy | R1's family | S | Contract signing by rule only, default off |
| 10 | **"Nothing to decide after minute 15"** | – | The bible's feeling | – | **No ruling of its own.** R16–R18 put the tension back in pay, price and policy. Re-run this persona after the bump. If it still solves the game in a sitting, the loop needs a new decision, and that is a bible question. |
| 11 | **The month close is one timeline line, two days late,** with no ranking and no "you passed" | Engineering, UX, writer | R10 | M | The month close lands on its day. R10's month report on Money gains the rank change and the month against the last. |
| 12 | **ALL HUBS has no numbers to sort by** for the most permanent choice | UX | `first-ten-minutes.md` S1 | M | The list shows each hub card's figures (freight out, loads per truck, the season) and sorts by them |
| 13 | **The best tools (Company, Rates) sit behind More** | UX | The four-item bar | M | A question for UX, not a ruling. Rates is the board's reference and could open from Board. Company stays in More. |
| 14 | **"A maintenance manager past 4" never happened** at five trucks | Engineering, economy | Copy truth | M | The ladder's text matches its rule, or the rule fires |
| 15 | **"Donna Reyes" is both a 1★ free agent and a 5★ driver elsewhere** | Engineering | Diary 2, row 18 (names) | L | One person per name in the world |
| 16 | **Iuliia's cards have a blank gap;** an empty "Load board" box sits above TABLE's filters | Engineering | – | L | Layout fixes |

**For the producer's economy brief, all to Jeff, because the economy is frozen:**
- R16, the pay floor;
- R17, the ceiling;
- R18, the size of the fines and the auditor's teeth, with my revised recommendation on the options;
- row 9, contract signing;
- the Borrow question.

They belong in one bump with R1's bid anchor and R11, because they all move the same revenue line. The gamer's 271k and the trucker's 30k are the two ends the economy should bring together.

**Order for the next build:** R20, R19 and row 8. These are true now, without a rule change. Then the economy bump, to Jeff.
