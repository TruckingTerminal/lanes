# Guidance batch 2 replay (2026-11-02)

Build: "Deploy d62e775" (guidance batch 2), Pages built. Phone 375×812, built-in browser. Console: no errors.

**World played:** Harbor Gate Transport (small fleet, Los Angeles, the man's face). New from day 3 (Wed Jan 3) to about day 31 (Thu Feb 1), in one page load. I hired Kwame Silva for Truck 2 on day 3; the dispatcher ran both trucks at Day in 6 s.

**Stale-copy warning:** my first load (`?v=d62e775`) served the previous bundle from the CDN (about 4.15M characters, no "Your company so far"), with a world called Scioto Freight Lines. A fresh fetch returned the new bundle (4.25M, the strings present), so I reloaded with a new query string and started again. Anything observed on the stale copy is left out.

Severity: **R** blocks the next republish · **S** this sprint · **L** later.

## What now? chip

| Check | Result | Evidence | Sev |
|---|---|---|---|
| In the caption's own button row | **Pass** | The arrival caption's row reads "Show me the board · What now?" | – |
| Reachable with the sheet down | **Pass** | Sheet at strip (tap on the map): the chip sits at 710–746 px, above the bottom bar at 757 px. Tapping it raises the sheet to half with the answer | – |
| The answer replaces the caption, one portrait | **Pass** | The arrival line was replaced by "Hire a driver for Truck 2. Your driver has gone. A truck without a driver earns nothing. **Hire a driver** · **Not now**", and one Iuliia portrait showed before and after. Wording: "Your driver has gone" on day 3, when Truck 2 never had a driver (**L**) | – |
| What now? in debt | **Fail (advice)** | About day 23, cash −16,470 FD, 1 of 4 weekly checks in debt, with 25k+ of invoices due Feb 4–9 on Owed to you: "Sell Truck 2. 1 of 4 weekly checks in debt. The next is Jan 28. It should fetch about 153,128 FD. You're 14,470 FD under the line. **Sell it**". Selling a 153k reefer to cover a 14k dip, when the invoices land within two weeks (quick pay or factoring would close it), is advice a trucker would ignore and a stranger might take | S |

## Tappable figures

| Screen | Result | Evidence | Sev |
|---|---|---|---|
| Money | **Pass** | Dotted: cash, "Cushion…", Owed to you, insurance. Cash opens a card below the figure (scrolled to 83–127 px, card from 647 px): what it is · how it's computed · a "Cash 24,700 FD" row · what moves it · What now? · Close. The figure's top edge sits half under the sheet strip (**L**) | – |
| Load sheet (the board) | **Pass, with a gap** | Dotted on the sheet: empty miles, Book now, break-even, profit, usually clears near, ceiling, the bid. Break-even's rows: fuel 0.84 + driver's pay 0.92 + maintenance 0.29 + insurance 0.12 + repairs 0.10 + tolls 0.17 = 2.44/mi, shown "Break-even 2.45/mi". Profit: 3.98 × 226 = 899 less 2.45 × 226 = −554 → "Profit 346 FD" (899 − 554 = 345). Off by one from rounding both times (**L**). The **board's own cards** (rate, profit chip) aren't dotted | L |
| Fleet | **Fail (rows)** | "owned · worth 94,914 FD" is dotted, but its card has no rows: "Its list price, less depreciation by age and miles". No figures that add to 94,914 | S |
| Company | **Pass** | On time: rows "Loads on time 0 · Loads delivered 0 · On time —"; also dotted: reputation, Miles rank, insurance per truck | – |
| Intel | **Pass (bands)** | Own card: safety "Not yet rated", insurance "Clean", credit C; each explains in words (bands carry no rows) | – |
| Finance | **Pass (words)** | Quick pay: "10% of the load", no rows (a rate) | – |
| Showroom / Dealer | **Fail** | No dotted figure anywhere on More › Dealer | S |
| Rolling | **Not checked** | – | – |

## Milestones and "Your company so far"

| Check | Result | Evidence | Sev |
|---|---|---|---|
| Milestone lines in the caption | **Fail** | None appeared in 29 game days. The caption held walkthrough step 2 ("Each line is a lane… bid above break-even, and let the round clear. NEXT") from day 3, because a small fleet's dispatcher books every load and I never got a truck idle before it did. The walkthrough line outranks milestones, so a small-fleet player who doesn't bid by hand never hears one | S |
| The first hired week | **Fail** | Kwame Silva hired day 3; by day 31 there was no milestone and no timeline entry | S |
| The month close and its before line inside twelve game days | **Not reached** | Stopped at Thu 23:00, about Feb 1, with no before line in the caption (blocked as above) and no entry yet | – |
| The first owned truck | **Not applicable** | Small fleet starts owning two | – |
| "Your company so far", newest first, with "Next on the road" | **Pass, with a jump** | "Jan 29 Businesses open · Jan 21 In debt at a weekly check · Jan 7 First payday" (newest first), under "Next on the road: your next truck, 58,267 FD away". The gap read "6,453 FD away" on day 7 with 17.6k cash, then "53,836" on day 18 with −2.8k: a 47k jump against a 20k fall in cash, with no explanation | L |
| "Jan 7 First payday" | **Question** | On net 30, the first invoice was due Feb 4; Jan 7 was the first delivery, not a payday | L |

## Also seen

- **S:** the small fleet ran to −35,950 FD by about day 31 on default settings (net 30, dispatcher on). That's two weekly checks or more in debt, heading for a wind-up while 25k+ is owed to it.
