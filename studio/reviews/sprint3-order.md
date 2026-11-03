# Sprint 3: the fix order (the director, 2026-11-03)

This covers rulings R1–R25 and the open rows of the five player triages (`director-player1.md` to `director-player5.md`). Engineering's queue is longer than a day, so this is the order. It is not the whole list; the triages hold the detail.

**Already built and replayed:**
- **Diary 1, row 1:** the card trap, replayed by QA in 718ab66.
- **Diary 1, rows 2 and 4:** the hold on the chip, the gap traced and one insurance figure, in c2ed897.
- **The brokerage batches** (ef7c40c, 0ab3ec4, d9a92c1).
- **Cashing invoices now** (5a1460b, 80974f7).
- **Borrow hidden while the pools are off,** specced by UX in 6dd93a7.

**Two facts shape the order:**
1. **The live world has no undo.** The MMO rules allow no saves, no pauses and no undo. Anything that loses a stranger his company in one tap must be fixed before the first live player, not after.
2. **A restart resets the ladder's clock.** The brokerage opens 91 game days after whichever restart switches it on. The restart's date therefore sets the brokerage's date. And every restart is free only until the first live player joins, so the next restart is probably the last free one. **That is the case for putting the economy's bump on it as well,** if it can be sized in time.

## (a) Before the next live restart and republish

**Rules: these ride the restart.** Order per Jeff, 2026-11-03 (`DECISIONS.md`): the market fix goes ahead of the brokerage.

1. **The economy's bump (list b), with the market fix first.**
2. **R12's engine half:** no shift past the company's own 11 hours. The 687-mile shift is a bug that changes results, so it rides the bump.
3. **The brokerage switch-on** (`brokerage.enabled`) **rides this restart only if QA has found it clean on a flagged build by then.** Otherwise it takes the next free restart before live day 91. It carries:
   - both premiums halved (Jeff);
   - double brokering closed to player carriers;
   - the bond's launch-reset rule;
   - cashing invoices with the aging surcharge.

   The market fix does not wait for the brokerage.

**Chrome a first live player meets: this goes in with the republish, Jeff's word.**

| Item | Where a first player meets it | Why before |
|---|---|---|
| **R2** captions that retire when false; steps that complete any true way, with Skip | **Minute 5.** "Check the rules before you go" outlived its truth by four weeks, and again on the return | It is the first thing he reads, and a false first line teaches him not to read her |
| **R6** a confirm card on big or irreversible spends | **The first visit to the Dealer or Business,** usually week one | No undo on live: a 19k truck in one tap is a lost run |
| **R20** every button answers | **The first refused action,** usually in the first hour | A silent button reads as broken, and a stranger leaves |
| **R7 and R19** doors that say what opens them; caps in one line | **The first try at growing,** weeks 1–3 | Misleading doors cost more trust than locked ones |
| **R21** the return card | **Night two.** On live, the world kept running while he was away | The second evening is what an MMO lives on. Without the card he comes back to a stale lesson and a truck he can't explain |
| **R22** one true reason at the wall; **R24** the price on SEND HOME | Night two, stranded (diary 5) | Both are cheap, and together they turn the stuck evening into a decision |
| **R9** a badge that counts only actionable items; **R10** a line with a button stays | Day 1 and the first month's close | The badge is his to-do list, so it must be true |
| **R3** the crime words | Rates, Business, Economy | A studio rule, on a public page |
| **R4** the dollar buttons (Jeff: yes) | Business and Money, week 4 | "The game wants my card" is a reason not to come back |
| **R14** the chip reads "+607 · cash −103 · held 710" | Every load | One arithmetic, true to the cash |

## (b) What the economy's one bump carries (Jeff ruled it, 2026-11-03)

**In this order inside the bump.** The market first, then the exploits, then the defaults.

1. **R11, the market's shape:** book-now below the ceiling, levels a trucker recognises, paced and announced cycles, a minimum charge on short loads, the season table. **R12's clocks** (the 70-hour week, the 34-hour restart) are sized with it, because truer rates and truer hours move the same revenue line.
2. **R17:** no bid above the ceiling.
3. **R16:** the pay floor, unhappy drivers who quit, a reputation among drivers.
4. **R18:** compliance teeth (fines scaled to the gain, out-of-service orders that cost days, audits that rate). Jeff: the 15-hour and 56 mph options stay **only** with these teeth in this same bump. If R18 isn't ready, the options come off the screen for this restart.
5. **R1** with the fleet-start extension and the bid anchor ("usually clears near", break-even as the floor). **R8** for players only, as the economy sized it. **Contract signing** by rule only, default off.
6. **Borrow:** the NPC lender writes cash-out loans, or the offer stays hidden.
7. **R15:** could the same path to a truck hold less per load for longer? Plus diary 1, row 5: where the owner's pay for driving goes.

**If time is short,** items 1, 2, 3 and 5 are the minimum, with item 4 or the options off the screen. Items 6 and 7 can take a second restart, which stays free only while the world has no players.

**The test of the bump is a replay, not a number.** On the fixed build, the player replays two of his earlier sittings:
- **The trucker:** does bidding pay often enough to matter, and does a trucker's gut work on the board?
- **The gamer:** can the game still be solved in one sitting?

Behind those, the economy's own checks:
- the gamer's 271k and the trucker's 30k should come together;
- the guide bot (sprint 4) should not lose to the prudent bot.

## (c) After

1. **R23**, What now?'s "stuck" rule, now in `guidance.md`. It belongs early in this list, and could join (a) if engineering has room: the stuck evening is night two's.
2. **R5**, each walkthrough step at its moment ("Getting paid" on the first settlement card).
3. **R25:** the cash chart from the ledger, and **the month report on Money** (R10's link). Until the report exists, remove every line that points at it, which is cheap and goes now.
4. **R13's show-now half:** weights, states everywhere, deliver-by rounded to dock hours, one deadhead figure. States and deadhead are truth bugs, and cheap.
5. **R12's display half:** ETAs with fuel stops and the 30-minute break; the rest announced.
6. **Three new milestones** (the first late delivery, the first losing load, the first boom) and **the explain-key coverage** past the first month's screens.
7. **For the economy, sprint 4:** R13's rule half (detention, future pickups, cargo value, hazmat), lining up the next load (diary 1, row 20), the guide bot.
8. **The test page only:** the speed button stepping down, pause reliability (diary 4, row 8), "Day 33". The live world runs at one pace.
9. **Polish:** names (Fleet-18, repeated surnames, Donna Reyes), map camera and labels, layout gaps, the Rates table width, "Late 16 / h", and the rest of the L rows.

## Cheap enough to do now, whatever the order

Each of these is a string or a check the engine already has:
- QA's **B9:** "the lessor's cut" on owned trucks. Open since the sprint 1 replay.
- "Paid Feb 5" on quick pay; "Fines paid 0" after tickets; the relabelled invoice.
- **R20's refusal texts:** the engine's reasons exist ("Above the ceiling, 7.64", the vetting block).
- **R22's board reason:** `vettingBlock` before `mayTake`. **R24's price:** break-even's parts times the empty miles.
- **R3's words.** "Your bid" for a book-now. One line on what FD is.
- Help's 5,000 against a 4,700 start; Help's "Fleet tab".
- "Replaying its history" becoming "Loading your world…". Continue showing the date. The yard card's "1 leased, 0 owned". A lease's Owed to you line.
- Removing "Read the month" until the report exists.
- NEW TEST WORLD off the Company page.
- "Tonight… the shoulder" without "as planned"; "1 days"; the missing commas.
