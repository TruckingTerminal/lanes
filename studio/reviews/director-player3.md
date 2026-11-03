# Triage: the third player diary (the director, 2026-11-03)

Source: `playtests/play-2026-11-02-working-trucker.md`, with 10 screenshots: a working trucker on a laptop, an owner-operator out of Memphis, Jan 3 to Feb 3, at build `adfb916`.
- He booked every load by hand, with the dispatcher off.
- 13 loads, all on time.
- Cash went from 4,700 to 19,181.

Read it beside `director-player1.md` and `director-player2.md`. Severity as there.

**What this sitting adds.** The first two diaries asked whether a stranger can learn the game. This one asks whether the game is true, and it is the most important of the three for pillar 1 ("the market is real").

**The tools pass.** The load board, the inline rate confirmation, the mileages and the break-even all read as the job: "This is DAT, and I'm home."

**The numbers behind the tools fail.** Book-now sits at the ceiling at two to three times what a lane clears. The hours never run out. The hold is invisible. His verdict: "a nice-looking load board with a slot machine behind it".

The first two players could be helped by better words. This one needs truer rules, and most of his rows go to the economy and to Jeff. The studio rule is that the economy is frozen without Jeff.

**What diaries 1 and 2 already cover:**
- The dispatcher acting against the player: R1.
- The ETA badge flipping: diary 1, row 12.
- No tolls, condition stuck at 85%: diary 1, row 31.
- The shoulder "nowhere legal" on truck-stop roads: diary 2, row 12.
- "Cargo theft" on the hub card and the THEFT column: R3.
- The hold with no balance: diary 1, row 2, now built.
- The next-truck gap moving: diary 1, row 4.
- "Your pay for driving": diary 1, row 5.
- Insurance 94 a week here and 0 on Money: diary 1, row 4.

**New here:**
- the market's shape;
- the clocks of hours of service;
- weights, appointments and detention;
- the chip questions from engineering's build.

**What works, and stays:**
- the laptop layout;
- the five speed buttons;
- popovers that close;
- the TABLE board and the inline rate confirmation;
- mileages right to the mile;
- the backhaul home paying less;
- fuel at about 0.74 a mile;
- the month summary kept under "Your company so far".

## Rulings (numbered on from R10)

**R11. A trucker's gut must work on the board. For the economy, then Jeff.**

The craft of the job is judging a rate. Three things make that worthless:
- **Book-now sits at the ceiling,** at two to three times "usually clears near", so the right move is always "book the top".
- **The levels run hot:** the break-even (2.1–2.4) is honest, but the month grossed about 2.5 times a real one. Flatbed Memphis–Charlotte paid 12.92/mi. 92 miles paid 1,013 FD.
- **Rates tripled in ten days with no news.**

**The design target**, for the economy to size and Jeff to approve, because it changes a frozen economy:
1. **Book-now sits between the clearing rate and the ceiling,** and reaches the ceiling only on a load that has waited, or in a tight market. Bidding should pay often enough to matter.
2. **Rate levels sit in a band a trucker recognises** against the honest break-even. Either the rates come down or the costs come up: the economy says which, and what it does to the supply path.
3. **A boom or a slump moves at a pace a player can see coming,** and it is announced: the first-boom milestone, a market line on the ticker the day the dial crosses, and the hub cards saying "booming" in words.
4. **Short loads carry a minimum charge plus a mile rate,** not a mile rate that makes 92 miles worth a thousand.
5. **The season table is checked against the calendar.** Sixteen hubs are in "busy season" in January, Fargo among them.

Two of his rows are bugs, not economy: every Rates row reading "2.50 Hot", and the hub card saying "a little thin" beside "hot". Both go to engineering.

**R12. Hours of service true enough to plan by.**

The engine drives 11 hours a day and sleeps. A trucker plans around four more things the game doesn't have:
- the 14-hour window;
- the 30-minute break;
- fuel stops;
- the 70-hour week and its 34-hour restart.

Today 538 miles shows as 9.3 hours, one shift ran 687 miles, and 9,125 miles in 25 days never met a weekly limit.

**Rulings:**
- **Now, as display and engine time, with no rule change** *(engineering)*: drive times and ETAs include fuel stops and the 30-minute break. A shift never passes the 11 hours the policy says. The 687-mile shift is a bug against the company's own "Legal: 11 h" setting.
- **The 70-hour clock and the 34-hour restart are a rule change.** They cut miles per week, which is revenue and the supply path. The economy sizes them with R11, because truer hours and truer rates move together. Jeff decides.
- **Off-duty and the home terminal.** "5 d out" while parked at home is a bug: home time starts at the home terminal. The weekly reset, when it lands, is what a weekend at home gives back.

**R13. The paperwork a trucker reads next.**

**Show now** *(engineering, writer)*:
- **Weight on every load.** The engine already prices weight in fuel.
- **States on every town,** in every list. "Newburg" for Louisville is a place-name regression of sprint 1's row 3.
- **Deliver-by times rounded to dock hours,** not 12:11 or 03:02.
- **One deadhead figure everywhere.** The hub board and Loads disagree: Manila 0 against 61 miles, and 156 miles from Little Rock against 137.

**Rule changes, for the economy in sprint 4:**
- detention pay after `{detention.freeHours}` (2) free hours, with a line for it;
- pickups booked for a later day, so Friday can book Monday (it joins diary 1, row 20);
- cargo value always well above the freight bill (the "Chemicals" load was worth 4,659 against a 4,754 bill);
- a hazmat flag on the commodities that need one.

**Until hazmat exists,** the writer avoids commodity names that imply it.

**R14. The profit chip: engineering's three questions.**

The hold is the player's own money, held toward his truck. It is saving, not loss. Both readers in this series felt it as being shorted, because "to you" implies the rest isn't his.

1. **"+607 · −103 to you" on a green chip.** Not that reading.
   - **The chip:** "**+607 · cash −103 · held 710**".
   - **The colour** follows the profit: green when it is positive, because the load earns.
   - **The cash figure** turns amber when it is negative: it tells him his cash dips, not that he lost.
   - **The hold** is named, so it reads as his.
2. **Wrapping at 375 px.** The chip never wraps. On a phone it shows "**+607 · cash −103**". The held figure sits on the load's sheet, one tap away, with the hold's explain key.
3. **Book now and What now? quoting the full profit.** One arithmetic everywhere (ruling 5). Every surface that quotes what a load pays shows the same pair, profit and cash:
   - **The button** may read "Book now · +607" only when the chip with cash sits on the same card.
   - **What now?'s reason** names cash whenever the hold makes it differ: "607 over break-even: 103 out of cash now, 710 toward your truck."

**R15. The hold explains itself when it changes.**

The hold line vanished from the Southaven settlement without a word. The next truck moved from 39,042 to 42,336 FD away while he worked.

**Rulings** *(engineering, writer)*:
- **When the hold stops or changes,** a line says why and when it will start again. "Your deposit has reached {fd}: the hold stops", or whatever the rule is.
- **When the next truck's figure grows,** the line names the cause: the truck's price rose, or the cheaper truck sold.

**For Jeff, via the economy:** he calls 30% of gross held "an escrow no lease-purchase driver would sign". Step 9's rule stands (no easier first truck). The economy should say whether the same path could hold less per load for longer, which would read truer and cost the design nothing.

## Findings, ranked (what a trucker finds false, above what a gamer finds annoying)

| # | Finding | Owner | Rule it touches | Sev | Fix |
|---|---|---|---|---|---|
| 1 | **Book-now at the ceiling at 2–3× the clearing rate;** levels about 2.5× real; flatbed at 12.92/mi; 92 mi for 1,013; rates tripled in ten days with no news | **Economy → Jeff** | Pillar 1; frozen economy | **B** | R11 |
| 2 | **Every Rates row "2.50 Hot";** the hub card saying "thin" beside "hot"; 16 hubs in "busy season" in January | Engineering (display); economy (season table) | Pillar 1 | S | R11, points 3 and 5; the display bug |
| 3 | **Hours that never run out:** 538 mi in 9.3 h with no stops; 687 mi in one shift under "Legal: 11 h"; no 70-hour clock or 34-hour restart; "5 d out" at the home terminal | Engineering (stops, the 11 h cap, home time); **economy → Jeff** (the 70 h clock) | Pillar 1 | S | R12 |
| 4 | **The dispatcher switched itself back on at the first delivery,** after he'd switched it off, and booked a money-loser; the first "off" showed no "saved" | Engineering | **R1:** the player's choice is never overridden | S | A bug against the player's own choice: off stays off. Every save says so. |
| 5 | **The hold vanished without a word;** the next-truck figure moved away as he worked | Engineering, writer | R15; diary 1, row 4 | S | R15 |
| 6 | **The 30% hold reads as an escrow nobody would sign** | Economy → Jeff | Step 9 (Jeff) | M | R15's question |
| 7 | **No weights; towns without states; "Newburg" for Louisville;** deliver-by at 12:11 or 03:02; two deadhead figures | Engineering, writer | Pillar 1; sprint 1 row 3 (place names) | S | R13, show now |
| 8 | **No detention; Friday can't book Monday;** cargo worth less than its bill; "Chemicals" with no hazmat flag | Economy (sprint 4) | Pillar 1 | M | R13, rule changes |
| 9 | **The profit chip, its wrap, and the button and What now? quoting full profit** (engineering's questions) | Engineering, UX, writer | Ruling 5 (one arithmetic) | S | R14 |
| 10 | **Red idle scolds for every day at home,** plus a toast | Engineering | Sprint 1 carry-over ("the idle alert during home time"), still open; R9 | S | Home time is not idle. The alert counts once, and it is a badge item only when the player can act. |
| 11 | **The ETA "Late 5 h" against a deliver-by three days out** | Engineering | Diary 1, row 12 | S | As diary 1, row 12. "Late" compares the ETA with the deliver-by, never with a planning estimate. |
| 12 | **The weekend at Arkadelphia "loading" with no word;** 6-hour live loads | Engineering, writer | Diary 1, row 17 (dock hours on the truck card) | M | As diary 1, row 17; detention under R13 |
| 13 | **Diesel fixed at 4.00 all month** | Economy, engineering | Pillar 1 | M | Check whether `fuelPrice` moves in the test config; if it is meant to move, show it moving; if not, the economy says why |
| 14 | **"Miles 2,393" against an odometer of 6,620** | Engineering, writer | `guidance.md` section 2 | M | Check the count. The explain key says Miles are loaded miles delivered. |
| 15 | **Unexplained: a broker's "Score 85%", "strict vetting", the reload numbers (2.39, 2.42), "Raised · 1 round running"** | Writer, engineering | `guidance.md` section 2 | M | Explain keys on each |
| 16 | **"Won … your bid" for a book-now;** "far end of the country" at 381 miles | Writer, engineering | Copy truth | L | "Booked at book-now." Her line keyed to real distance from home. |
| 17 | **NEW TEST WORLD at the foot of the Company page** | UX | – | L | It moves into the test menu, away from the company's own page |

**For the producer's economy brief:** rows 1, 2 (the season table), 3 (the 70-hour clock), 6, 8 and 13, plus diary 1's row 5 (the pay for driving) and R1's bid anchor. R11 and R12 should be sized together: truer hours and truer rates move the same revenue line. Both need Jeff, because the economy is frozen.

**Order for the next build:** R14, rows 4, 5, 7 and 10, and R12's display half. These are true now, without a rule change. Then the economy brief, to Jeff.
