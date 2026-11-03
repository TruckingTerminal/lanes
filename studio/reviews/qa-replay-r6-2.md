# Replay of the confirm-card fixes (QA, 2026-11-03)

Engineering's commit is 696d396. Checked against my `qa-replay-r6.md` and `specs/player2-ux.md` §1.

**Builds:**
- "Deploy 696d396 from lanes" on the test page (Pages built, waited 60 s).
- An unflagged local build of the same commit (`git archive 696d396`, port 5199, now stopped), for the fresh world. Its origin has its own storage, so the parked world in the test profile is untouched.

**Worlds played:**
- **Long Haul Test**: small fleet, Columbus, the parked world, at Tue Feb 28 (about day 58), 81,461 FD, clock paused. It's still there for the next replay.
- **Fresh Check**: small fleet, Columbus, new from day 3 (Wed Jan 3 06:00), 24,700 FD, clock paused.

Phone 375×812, built-in browser. Console: no errors.

Severity: **R** blocks the republish · **S** this sprint · **L** later. Screenshots are in `qa-replay-r6-2/`.

## The seven fixes

| # | Row | Result | Evidence | Sev |
|---|---|---|---|---|
| 1 | Low tap: Not now under the thumb, the confirm on the other side, whichever half | **Pass** | **Left half:** first tap at (100, 735) on "Workhorse + Dry van · 48.9k" (Long Haul) and at (99, 735) on "Buy today · 21.4k" (Fresh). Not now at x 16–89, y 711–747, on the tapped side; Buy at x 228–359 ([01](qa-replay-r6-2/01-low-left-tap-weeks-red-line.jpg)). **Right half:** first tap at (265, 735) on "Aero kit · 18.0k". **Not now** moved to x 286–359 and **Fit · 18,018 FD** to x 16–147 ([04](qa-replay-r6-2/04-low-right-tap-aero-kit.jpg)) | – |
| 2 | "Left after" gives weeks once a week has closed; "cushion not yet measured" before | **Pass** | Long Haul: "Left after · 29,146 FD, 2.1 weeks of cushion", "63,444 FD, 4.7 weeks", "23,278 FD, 1.7 weeks". Fresh, day 3: "Left after · 1,817 FD, cushion not yet measured" ([05](qa-replay-r6-2/05-fresh-not-yet-measured.jpg)) | – |
| 3 | The red low-cushion line under four weeks | **Pass** | "Under 4 weeks of cushion after this." in red at 2.1, 1.7 and 2.0 weeks; absent at 4.7. "Left after" turns amber under 2 weeks (1.7 and 2.0) | – |
| 3a | …when the cushion isn't measured yet | **Note** | Fresh's 21.4k buy leaves 1,817 FD and shows no warning, because the weeks are unknown. A day-3 player spending all but 1,817 FD sees nothing in red | L |
| 4 | A spend cash can't cover: "{fd} FD short: this can't be paid today.", the confirm disabled | **Pass** | Fresh, lease a dry van: "Left after · −20,800 FD…" in red, "20,800 FD short: this can't be paid today.", **Lease · 45,500 FD** disabled ([06](qa-replay-r6-2/06-fresh-short-disabled.jpg)). Rebuild: "20,030 FD short: this can't be paid today.", **Rebuild · 44,730 FD** disabled | – |
| 5 | The tapped row stays in sight above the card | **Pass** | Every card left its source in view above it: the 48.9k rig's row, the Truck 1 upgrade row, the Buy today row, the Lease row's Dry van / Reefer / Flatbed. Cards ran 330–756 to 426–756 px, under 60% | – |
| 6 | "Buy on a loan ›" on a new rig scrolls its sheet into view, and its buy opens the card | **Pass** | On "Order the rig · 197.2k" (Long Haul), the "Buy Workhorse + Dry van on a purchase loan" sheet opened in view: price, tax, down payment 27.4k, borrowed 169.8k, stake 17.0k, 2,104 FD a week for 104 weeks, "Miss 2 payments and the lender takes the truck." ([02](qa-replay-r6-2/02-loan-sheet-in-view.jpg)). Its **Buy on a loan · 58.2k FD now** opened the confirm card ([03](qa-replay-r6-2/03-new-rig-on-loan-card.jpg)) | – |
| 6a | The card for a loan purchase | **Note** | It reads "It costs · 58,183 FD" and "A new Workhorse with a dry van, arriving Jun 29." with the new-truck risk. It doesn't say it's a loan: no weekly payment, and not the lender's "miss 2 payments" risk | L |
| 7 | Truck › Buy a trailer lands on the Dealer's trailers | **Pass** | It opens the Dealer with "Trailers alone" at the top of the panel | – |

## The unreached items from the first replay

| Item | Result | Evidence | Sev |
|---|---|---|---|
| A new rig with Buy today | **Not reached; on a loan instead** | The new rigs are "Order the rig · 197.2k" and up, greyed at 81k. The 48.9k "Workhorse + Dry van" is from the used lot ("40% condition, 1 rebuild left"), and its card says so correctly. The new-rig card was reached through the loan (row 6) | – |
| A trailer | **Not reached** | "Trailers alone: Room for 0 more of your own." All three ("Dry van · 45.5k · 121 d" and the others) are greyed, and there are no used trailers. Needs a yard (Small yard 135.1k + 30.0k bond) | – |
| An upgrade, Business open | **Pass, one figure wrong** | "Fit aero kit to truck 1?" · "It costs · 18,018 FD" · "Left after · 63,444 FD, 4.7 weeks of cushion" · "Cuts truck 1's fuel by 5%." · risk: "It pays back in about **5555 weeks** at this truck's miles." That's about 107 years, so the payback figure looks wrong | S |
| A contract | **Not reached** | Long Haul at day 58: "No contracts held. Offers come to local carriers with a good record; the dispatcher takes them unless you turn that off." None has come | – |

## Also seen

- **L (R7's, known):** the Lease row still says "No money down… 250 FD a week minimum", while its card asks a 45,500 FD deposit and 910 FD a week (54,750 and 1,095 for a reefer at day 58).
- Scrap's card no longer has a "Left after" line; it shows what it does and the one risk.
- The Dealer and Business show "Or $675 / $2,958 (to the launch pool)" buttons at day 58, as in my R4 note.
