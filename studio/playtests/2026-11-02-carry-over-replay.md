# Sprint 2 carry-over replay (2026-11-02)

Build: the deploy of 60d1a26. Its own CI run was cancelled by the next push; it went live with the run that followed (lanes-play "Deploy 9f2c236"). Phone 375×812, built-in browser.
- **World A:** owner-operator, Columbus.
- **World B:** small fleet, Chicago.
- **World C:** owner-operator, Phoenix, run at Day in 2 s to walkthrough step 9.

Console: no errors.

**Caution on method:** my first page load ran a **stale bundle** (the CDN). On it, rows 1, 2, 5, 8 and 9 all looked unfixed: worth column, airport codes, a stepper past the ceiling, mismatched portraits. A reload brought the new bundle, and every row below was re-checked on it. If anyone else saw the old behaviour today, a hard reload is the first step.

Severity: **R** blocks the next republish · **S** this sprint · **L** later.

| # | Row | Result | Evidence | Sev if failing |
|---|---|---|---|---|
| 1 | Market truth | **Pass** (on what a phone shows) | 25 board loads opened one by one in world B: none with "Usually clears near" above "Ceiling", none with the bid range's top above the ceiling. Chicago → Ann Arbor: ceiling 4.09, range 2.32–4.09; the stepper started at 3.29 and stopped at 4.09 with **+** disabled after 80 taps. Chip "+246 FD at book-now" = "Book now · 3.24/mi · +246 FD". **Not checked:** the laptop table and the clears sort (phone pass); the hub card's loads show no ceiling to compare against; the result card and idle alert figures (no hand-won load this pass) | – |
| 2 | Getting paid at step 9 | **Pass** | World C, step 9 "Your first truck" current, Finance opened with it. Getting paid: "On the lessor's truck you're paid the day you deliver… On a truck of your own, shippers pay net 30… quick pay today for 10% off, or factor. Factoring is a 3-month contract… pays every invoice of your whole fleet on delivery, 6% off at your fleet's size (less as it grows). Quick pay closes while it runs, and it can't be left early." No pools. B8 closed | – |
| 3 | Home time, no idle alert | **Fail** | World C: the strip read "Truck 1 · Home time at Phoenix" from Tue 18:00 through Wed 13:00 and beyond. When it ended, the feed carried "Truck 1 has been idle 4 d 10 h at Phoenix: 25 dry van loads in range pay enough, but the dispatcher's bids keep losing: other carriers bid lower or have the better record." Home time is still counted as idle and blamed on bids | S |
| 4 | Trailer shapes on the map | **Pass, barely** | At 4× (the zoom the map opens at): van squares, and at least one flatbed as a low orange bar. A hollow reefer I couldn't pick out at that size; the marks are 3–4 px | L (legibility) |
| 5 | Cities, not codes | **Pass** | Dealer facility buttons read "MINNEAPOLIS · 2.2 LOADS/DAY", "DES MOINES", "BOISE". Book now toast "Booked. The truck is on its way."; hub card loads "Columbus → Cincinnati". Used trucks: "Nothing listed right now", so no used row to check. Codes remain on Company › Seasons now ("BOI +36%, SLC, MSP, FAR, SAV, JAX, ATL") and "CMH garaging ×0.95" | S (Company only) |
| 6 | No "counter" anywhere | **Pass** | Not on the board, load sheet, Truck, Finance or Company |
| 7 | No re-post, no "pay the hauler" | **Pass** | Truck tab and Dispatcher › More rules (world B, small fleet, dispatcher running): no re-post row, no "Pay the hauler". Checked before day 91 only |
| 8 | Company ranks by Miles | **Pass** | "Most miles · # · COMPANY · MILES … 581 Lakefront Hauling 0", no worth column; "Net worth 278.6k FD" only on my own card |
| 9 | Names match portraits | **Pass for drivers; fail for dispatchers and managers** | After the reload, three loads of world B's hire list: every driver matched (Ngozi, Sharon, Hoa, Chioma, Peggy, Mai, Carol → woman's portrait; Vikram, Marcus → man's). The hired Ngozi Nguyen kept her name and portrait across two reloads. Every dispatcher and manager row shares one `dispatcher` portrait whoever it is (Priya Ward, Anjali Reyes and the men alike). The player's own row ("You") is always the man's portrait | S (dispatchers) |

Also seen:
- **L:** the small-fleet arrival still says "One leased Workhorse, a dry van, and you driving".
- **L:** the Rolling card can plan "Tonight, as planned: the shoulder. Nowhere legal to stop in reach." on a dispatcher-booked 1,317-mi load. Earlier the same truck was "ticketed 250 FD for shutting down on the shoulder".
- **L:** step 9 still says "buy a rig from the used lot" while Used trucks reads "Nothing listed right now".
