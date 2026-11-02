# Guidance batch 3 replay (2026-11-03)

Build: "Deploy 1200e82" (QA's six guidance rows, UX's two rulings, the two-company model behind `brokerage.enabled`, off), Pages built. The bundle was checked against a no-store fetch, so it's the fresh one. The writer's later b46086f ("First week of wages", the collect advice's quick-pay wording) is not in this deploy. Console: no errors.

**World played:** Scioto Freight Lines (small fleet, Columbus, the woman's face). New from day 3 (Wed Jan 3) to about day 20 (Fri Jan 19), in one page load. I hired Sanjay Patel for Truck 2 on day 3; the dispatcher ran both trucks at Day in 6 s. Phone 375×812 throughout, except row 7 at 1366×800 in the same tab.

Severity: **R** blocks the next republish · **S** this sprint · **L** later.

| # | Row | Result | Evidence | Sev |
|---|---|---|---|---|
| 1a | The board step ticks when the dispatcher books | **Pass** | No step 2 line held the caption this time: by Thu 02:00 (day 4) the walkthrough was on step 4, then 5, 6 and 7 as days passed, all without a hand bid | – |
| 1b | A step that has stood two game days yields the caption to a milestone | **Pass** | Step 6's line ("The page nobody enjoys…") came up Sun 19:00; the slump milestone took the caption Tue 02:00 and step 6 returned Tue 21:00 | – |
| 1c | The walkthrough's text for a small fleet | **Fail** | Step 4 on day 4: "Delivered, and paid today: the lessor sees to that. Money shows its share and the hold toward your own truck." This company owns two trucks, has no lessor, is paid net 30 (Owed to you lists Feb 4–10 due dates), and holds nothing toward a truck | S |
| 2 | The first hired week: before line on the hire day, at line during the week | **Fail** | Sanjay Patel hired Wed Jan 3 06:00. On the hire day the caption went from the arrival line to the slump line (08:00); no hired-week line then, nor at any point to day 20. "Your company so far" on day 20: "Jan 7 First payday · Jan 3 The first slump", with no hired-week entry | S |
| 3 | What now? in debt, invoices due in time: collect and wait, never sell; the quick-pay sentence | **Pass** | Day 19, cash −2,513 FD, 0 of 4 weekly checks in debt: "Get paid sooner on what you're owed. The next weekly check is Jan 21. You'd be 513 FD under the line. 3,154 FD is due to you by Feb 4, in time for the check that counts. Keep the trucks loaded until it lands. Quick pay would pay each new load at delivery, less 10%." **Getting paid** / **Not now**. No sell | – |
| 4 | Fleet's truck value has rows that add to the figure | **Pass** | Truck 1 "worth 94,914 FD": tractor new today 140,000 − miles (210,000 mi, 40% of its life) 56,000 − age (1.9 years) 13,463 − wear (condition 80%) 5,643 + its trailer 30,020 = 94,914 exactly | – |
| 5 | The Dealer's Buy rows show price, cash needed now and down payment as dotted figures | **Pass** | "Price 182.0k FD · Cash needed now 53.9k FD · Down payment 25.5k FD" under each new rig and tractor (63 dotted figures on the page). Cash needed now: down payment 25,480 + stake 15,652 + tax 12,740 = 53,872 exactly | – |
| 6 | "Truck 2 has no driver" for a truck that never had one | **Pass** | What now? on day 3: "Hire a driver for Truck 2. Truck 2 has no driver. A truck without a driver earns nothing." | – |
| 7 | The laptop explain card opens away from the figure | **Pass** | 1366×800, Money's cash "−2,513 FD" at x 947–1025, y 160–204; the card ("explainsheet left") at x 16–336, y 425–784, over the map, with no overlap | – |
| 8 | Phone strip: face · text · What now?; a tap on the text raises the sheet to half; the sheet at the top when back at strip | **Pass** | At strip: the portrait at x 8, the arrival text at x 48, **What now?** at x 260, one row at y about 710. Tapping the text: strip → half. I scrolled the half sheet 400 px down, tapped the map to drop it to strip: scrollTop back to 0 | – |

## Also seen

- **L:** the slump milestone repeats. "Rates are falling for everyone… Your cushion: – weeks. **See your cushion**" on day 3 at 08:00, again on day 6, again on day 10 ("1.9 weeks"). On day 3 the cushion read "–" (unformatted).
- **L:** "The first slump" is the first milestone of a world, on day 3, three hours in. It's the first thing a new player is told.
- **L:** "Next on the road: your next truck" swung from 13,354 FD away (day 9) to 53,824 FD away (day 19), unexplained.
