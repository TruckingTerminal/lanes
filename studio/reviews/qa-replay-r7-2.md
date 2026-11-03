# Replay of R7 part two (QA, 2026-11-03)

Engineering's commit is 8cd7cfe. Checked against my `qa-replay-r20.md` rows and `player2-ux.md` §2 and §7.

**Build:** "Deploy 69570cd from lanes" (contains 8cd7cfe; Pages built, waited 60 s).

**World played:** Long Haul Test (small fleet, Columbus), the parked world, from Thu Feb 30 14:00 (the game's calendar) to Sat 14:00.
- Three trucks: two owned and one leased. Truck 3 had no driver at the start.
- 72,570 FD and the 31,907 FD loan from the last replay.

Phone 375×812, built-in browser. Console: no errors.

Severity: **R** blocks the republish · **S** this sprint · **L** later. Screenshots are in `qa-replay-r7-2/`.

| Row | Result | Evidence | Sev |
|---|---|---|---|
| The lease's weekly minimum is the same in every place | **Pass** | All four say 910: the Dealer's row ("Lease another truck · 45,500 FD deposit · at least 910 FD a week"); the confirm card ("Leases a Workhorse with a dry van: 45,500 FD deposit, at least 910 FD a week."); Truck 3's card ("second lease: the lessor keeps 15% of every load, at least 910 FD a week"); and Finance's lease row ("Truck 3 · leased · 15% of every load, at least 910 FD a week · 45,500 FD deposit held") | – |
| A poaching offer's outcome lands as a result line on the Staff row | **Fail** | **Offer 0.99 FD/mi** to Lan Boone (Fleet-59, 0.90 FD/mi, restless) for Truck 3. At once: "Lan Boone · Offer pending · answer by Mar 2" and "Offer sent to Lan Boone: they answer by Mar 2." under the row. At Fri 00:00 the pending line and the "Offer sent" line both went. The row then read "Lan Boone · Fleet-59 · 0.99 FD/mi · settled" with a new **Offer 1.10 FD/mi**, so his employer evidently matched. No result line ("stayed: their employer matched your offer" or "left") appeared on the row at any point through Sat 14:00. The stale line is gone now, which was half of the earlier fail | S |
| The "Hire away from other companies" table fits 375 px, with Offer and "no open seat" whole | **Fail** | The table is 520 px wide inside a 337 px wrapper that scrolls sideways. On screen the Truck picker is cut to "Tru" and the button to "OFFE" ([01](qa-replay-r7-2/01-hire-away-table-cut-at-375.jpg)). Scrolled right, the Offer buttons are whole, but the names and pay go off the left edge ([02](qa-replay-r7-2/02-hire-away-scrolled-right.jpg)). Offer can be reached, but the table doesn't fit. "No open seat" rows weren't shown when I measured, because Truck 3 had an empty seat | S |

## Also seen

- Truck 3's seat was filled by auto-staff during the run: "Driver: Linda Haddad ★★★★☆ · tired 99%". A driver just hired onto a truck with 99 miles on it reads "tired 99%" (L).
- The game date still runs Feb 28 → Feb 30 (known since my R7/R19 report). The offer's "answer by Mar 2" is now 2 days after Feb 30.

Not re-tested, as asked: Borrow, the Dealer's per-row delivery lines, the second cap and the payback.

## For the R21 replay

This world was last touched at about 05:25 today, and I opened it again for this replay. So it won't be eight hours untouched until about 13:30. Every other world I've used was touched within the last few hours, so none qualifies before then.
