# Replay of R6: the confirm card (QA, 2026-11-03)

Checked against `specs/player2-ux.md` §1 and `copy-player2.md`'s R6 tables. Engineering's commit is 899e978.

**Build:** "Deploy 899e978 from lanes" (Pages built, waited 60 s).

**World played:** Kokosing Haul (small fleet, Columbus, two owned trucks, 24,700 FD), new from day 3, Wed Jan 3 06:00, with the clock paused throughout. 25% of cash is 6,175 FD.

Phone 375×812, built-in browser. Console: no errors.

Severity: **R** blocks the republish · **S** this sprint · **L** later. Screenshots are in `qa-replay-r6/`.

## Where the card opens, and which actions get one

| Action | Card? | What it said | Sev |
|---|---|---|---|
| **Used truck**, Buy today 17.9k (Houston, past its last rebuild) | **Yes** | "Buy Workhorse + Dry van?" · "It costs · 19,121 FD" · "Left after · 5,579 FD" · does: "A used Workhorse with a dry van: 13% of its life left, no rebuilds. It's at Houston, 1,227 miles from home." · risk: "It runs until it's worn out, then goes for scrap, for about 4,200 FD. Bringing it home takes a driver and empty miles." · **Not now** / **Buy · 19,121 FD** ([01](qa-replay-r6/01-used-truck-card.jpg)) | – |
| **New rig** (45.1k and up) | **Not reached** | Cash 24.7k, so "Buy today" is greyed. "Buy on a loan ›" opened no card and left me at the top of the Dealer page | – |
| **Lease** another truck (dry van) | **Yes, but wrong** | "It costs · 45,500 FD" · "Left after · −20,800 FD" · "Leases a Workhorse with a dry van: 45,500 FD deposit, at least 910 FD a week." ([03](qa-replay-r6/03-lease-card-negative.jpg)). The row it opens from says "No money down: the lessor takes 15% of each load, 250 FD a week minimum" ([04](qa-replay-r6/04-lease-row-no-money-down.jpg)). Card and row disagree on the deposit (0 or 45,500) and the weekly minimum (250 or 910). The card offers **Lease · 45,500 FD** with a negative balance; confirming it gave "Not enough FD for the lessor's deposit" only afterwards | S |
| **Trailer** | **Not reached** | Dealer › Trailers alone: "Room for 0 more of your own." Truck › BUY A TRAILER opens the Dealer at its used trucks, not its trailers | L |
| **Upgrade** (APU, aero, tires, sleeper) | **Not reached** | Business opens Jan 29 | – |
| **Rebuild** (Truck 1, from the ⋯ overflow) | **Yes, but wrong** | "Rebuild truck 1?" · "It costs · 44,730 FD" · "Left after · −20,030 FD" · "Two days in the shop; condition back to new." · "0 of 2 rebuilds left after this. Past the last, it runs to scrap." ([05](qa-replay-r6/05-rebuild-card-negative.jpg)). Its confirm is live. Pressed after 400 ms, twice, the card closed and nothing happened: no charge, no rebuild, no line saying why | S |
| **Scrap** | **Yes** | "Left after · 24,700 FD" · "Ends truck 1 for 4,200 FD from the scrapyard." · "Sold, it would fetch about 94,914 FD. Scrapping can't be undone." **Scrap · 4,200 FD** in red ([07](qa-replay-r6/07-scrap-card-red.jpg)). "Left after" should be 28,900, with the scrap money in. The card also has no first line (it pays rather than costs) | L |
| **Sell** | **Yes** | "Lists truck 1 at 94,914 FD. The price drops each week until it sells." · "It earns nothing while it's listed and parked." **Sell · 94,914 FD** | – |
| **Hire** a driver (1,838 FD a week) and a dispatcher (844 FD a week), with no week's net yet | **Yes** | "Hire Linda Lowe?" · "1,838 FD a week" · "Left after · 24,700 FD" · "Hires Linda Lowe at 1,838 FD a week." · "That's more than your company kept last week: 0 FD." **Hire Linda Lowe** ([08](qa-replay-r6/08-hire-card.jpg)). Confirmed with a real tap after 400 ms: the card closed and the row reads "Hired" | – |
| **Contract** | **Not reached** | Company › Contracts: "No contracts held. Offers come to local carriers with a good record" | – |
| **A small spend under 25%** must not get a card | **Pass** | Send empty to Cincinnati (about 137 FD) sent at once, with no card: "The truck is heading out empty." | – |

## The card itself

| Row | Result | Evidence | Sev |
|---|---|---|---|
| A sheet on the nav, at most 60% | **Pass** | `confirmsheet`, 384–756 px (372 px, 46%). The nav is untouched | – |
| The item stays visible above it | **Fail, small** | The card covers the lower panel; above it is the map, not the truck row I tapped | L |
| Four lines: costs, left after, what it does, the one risk | **Pass, three of four complete** | All four on buy, lease, rebuild and hire; scrap and sell have no cost line | – |
| "Left after" gives weeks of cushion | **Fail** | Every card shows only the FD figure ("Left after · 5,579 FD"), never "…, n weeks of cushion" (`confirm.after`). With no spending history yet the weeks may be unknown, but nothing says so | S |
| The low-cushion line in red | **Fail** | Not shown on any card, even at −20,800 and −20,030 FD left, or 3,484 FD left (the Miami truck) | S |
| **Not now** closes | **Pass** | Every card, every time | – |
| One tap opens, a second confirms | **Pass** | Hire went through on a second real tap | – |
| The card ignores taps for 400 ms | **Pass** | A pointer tap plus a click on **Buy** 100 ms after opening did nothing; cash stayed 24,700. A real double tap on a low Buy today button opened the card and bought nothing | – |
| The confirm never sits where the first tap landed | **Fail** | With Buy today scrolled low (first tap at 99, 736), the card swapped its buttons and **Buy · 21,216 FD** moved to x 16–147, y 711–747, directly under that tap. Not now went to the far right ([02](qa-replay-r6/02-low-tap-buy-moved-under-tap.jpg)). The spec swaps so that Cancel takes the tapped spot. The 400 ms guard caught my double tap, so the risk is a slow second tap | S |
| Destructive acts in red | **Pass** | Scrap: red text and border. Sell, not below value: primary | – |
| Scrap in an overflow | **Pass, the layout differs** | The truck card's row shows **Bid by hand** and **⋯** (44×44). ⋯ opens a horizontal row of buttons, not a menu of 44 px rows: the Send empty picker and button, Rebuild · 44.7k, Park, Sell, Offer for lease, and last, in red, "Scrap · 4,200 FD (worth 94.9k)". The row runs past the screen's right edge ([06](qa-replay-r6/06-overflow-row.jpg)). ⋯ sits beside Bid by hand, not at the row's right end | L |

## Security bands

| Row | Result | Evidence | Sev |
|---|---|---|---|
| Quiet, Watch, Risky | **Pass** | Hub cards: Los Angeles and Chicago "Security: risky. Cargo goes missing here often; insurers and some shippers notice."; Columbus "Security: quiet". No hub I opened showed Watch | – |

## Also seen

- **L:** after a stray tap the ≡ menu (Title screen, Full screen, Report a bug) stayed open over the map through several card openings, until the screen changed.
- **L:** the Dealer has two used lists, "Used trucks" (17.9k–24.8k, "deliver today") and "The used lot" (45.1k and up, "Worn rigs at their used value… delivered like a new one"). The second reads like the new-truck section above it.
