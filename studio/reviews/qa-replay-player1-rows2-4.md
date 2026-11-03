# Replay of the player's rows 2 and 4: the hold toward your truck, and the figures that reconcile (QA, 2026-11-03)

Checked against `specs/copy-player1.md` row 2 and `director-player1.md` rows 2 and 4. Engineering's commit is c2ed897.

**Build:** "Deploy c2a134f from lanes" (Pages built; this deploy contains c2ed897 and d9a92c1). I checked that the page carries the new strings.

**World played:** Buckeye Haul, an owner-operator on a leased Workhorse dry van, Columbus.
- New from day 3 (Wed Jan 3 06:00) to Sun Jan 7 00:00.
- I booked Columbus → Cary (567 mi) by hand at book-now, at 5.03/mi. It was delivered on time Thu 14:00.
- After that the dispatcher booked Danville → New York City.
- Day a minute, then Day in 6 s to Sunday.

Phone 375×812, built-in browser. Console: no errors.

Severity: **R** blocks the republish · **S** this sprint · **L** later. Screenshots are in `qa-replay-player1-rows2-4/`.

## Row 2: the hold

| Row | Result | Evidence | Sev |
|---|---|---|---|
| The profit chip on each load card | **Pass** | On every leased card, e.g. "+1,547 · 691 to you · 856 held toward your truck" and "+2,617 · 1,310 to you · 1,307 held toward your truck" ([01](qa-replay-player1-rows2-4/01-load-cards-chips.jpg)) | – |
| The chip's parts add up | **Pass, ±1** | 7 of 10 sum exactly. Three are off by one from rounding: "+558 · 26 to you · 533 held" (559), "+2,286 · 978 · 1,307" (2,285), "+2,035 · 955 · 1,079" (2,034) | L |
| The chip on the load sheet | **Pass** | "Profit at book-now: +1,547 · 691 to you · 856 held toward your truck" ([02](qa-replay-player1-rows2-4/02-load-sheet-chip.jpg)). The Book now button still says "+1,547 FD", which is the whole profit, not what lands | L |
| "All of it to you" once the deposit is full | **Not reached** | The deposit is 15,925 FD; 2,381 was held by Sunday | – |
| **The delivered load's chip against Money's held total** | **Pass, to the FD** | The chip said 856 held. After the delivery Money read "Held toward your truck · 856 FD in all", and the delivered card's row read −856. After the second load it read 2,381 | – |
| Money: the line under Cash | **Pass** | "Held toward your truck · 856 FD in all", directly under Cash and its chart ([03](qa-replay-player1-rows2-4/03-money-held-and-note.jpg)). Before any delivery there was no line, rather than "0 FD" | – |
| The 30% note, first visit only | **Pass** | "30% of each leased load is kept for you until you buy. It counts in full then." On the next visit to Money it was gone | – |
| Money's line explains on tap | **Pass** | "Held from each leased load, until the deposit is whole · 30%", "Held so far, of 15,925 FD · 856 FD", **Held toward your truck 856 FD**, "Every leased load adds to it." ([04](qa-replay-player1-rows2-4/04-money-held-explanation.jpg)) | – |
| The delivered card's held row opens an explanation | **Pass** | "Held toward your own truck (kept) −856". The −856 opens `truck.leaseDeposit`, the same breakdown: share, held so far, total ([05](qa-replay-player1-rows2-4/05-delivered-card-held-row.jpg), [06](qa-replay-player1-rows2-4/06-delivered-held-explanation.jpg)). Its header shows "-856" with a hyphen, where the row uses a minus sign | L |
| Walkthrough step 4 uses the share | **Pass** | Caption at delivery: "Delivered, and paid today. Money shows the lessor's share and the 30% held toward your own truck." Full text on the Iuliia page: "The lease also holds 30% of each load back toward a truck of your own…" | – |
| The chip against what landed | **Off by a quarter** | The chip promised "691 to you"; the delivered card says "Yours 519 FD". Actual fuel, tolls, pay and upkeep came to 1,050 against the chip's estimate. The hold matched exactly; the landed figure is still an estimate. The diary's complaint was the hold, and that is fixed. But "to you" on the chip reads as a promise | S |
| The feed line | **Fail, small** | "519 FD yours after fuel, tolls and the lessor's cut." It leaves out pay, upkeep and the hold, the biggest deduction | L |

## Row 4: figures that reconcile

| Row | Result | Evidence | Sev |
|---|---|---|---|
| Insurance is one figure everywhere | **Pass** | Money "Insurance 0 FD". Company's Policy row leads with the week's bill: "0 FD a week · 4,642 FD a year per insured truck…", then "Your leased truck is on the lessor's policy, so you pay none of it until you own a truck." ([07](qa-replay-player1-rows2-4/07-company-insurance-policy.jpg)) | – |
| The next-truck gap says why when it jumps | **Pass** | The gap went from 1,424 to 5,103 FD between Fri and Sun. Underneath: "The cheapest truck changed: listings come and go, and the used lot sells out and restocks." ([08](qa-replay-player1-rows2-4/08-gap-with-reason.jpg)). After I opened the explanation, the reason under the figure cleared | – |
| The gap counts the hold | **Fail** | The explanation says "The cheapest truck's cash needed now, less your deposit and cash above 4 weeks of costs". It lists "Cash needed now 10,975 FD", "Less cash above 4 weeks of costs (0 FD held back) −5,872 FD", "Gap 5,103". There is **no deposit row**: the 2,381 held toward the truck isn't subtracted, though row 2 says it "counts in full" when you buy. "(0 FD held back)" also reads against "856 held" | S |
| The cushion excludes the hold | **Can't tell** | "Cushion: no spending yet" through Sunday 00:00, after two loads of fuel, tolls and upkeep. The week hadn't produced a spending figure by then | L |
| "Kept" = the cash change plus what's held | **Not seen** | No "kept" figure appeared on Money, Company, the feed or the delivered card by Sun 00:00. For reference over Wed–Fri: cash 4,700 → 5,187 (+487), held 856, the card's "Yours" 519. 487 against 519 leaves 32 FD I can't place | S |

## Also seen

- The slump line reads "Your cushion: – weeks." with a dash for the number, before any spending (Wed 10:00).
- The bid stepper starts at 5.08, above book-now's 5.03 (the director's row 19, not in this batch).
