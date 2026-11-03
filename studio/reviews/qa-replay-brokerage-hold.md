# Brokerage hold batch replay (QA, 2026-11-03)

Checked against `specs/brokerage-ux.md` (draft 2) and `specs/brokerage-strings.md`.

**Build:** commit 8b8ab49 (it contains 0ab3ec4), flagged per `roles/qa-flagged-build.md` (brokerage switch on, layer open, 150,000 FD granted), served on my own port 5199.
- **One change from the recipe:** I built from a `git archive` copy of 8b8ab49 in my scratchpad, not from the shared checkout. The shared checkout had uncommitted engine edits from another role (`packages/engine/src/brokerage.ts`, `ledger.ts`, `receivables.ts` and four others). `node_modules/@lanes/*` are symlinks into the shared `packages/`, so the recipe as written bundles those uncommitted edits: the bundle came out 4233 KB, against 4232 KB from the clean copy. My copy links `@lanes/*` to its own `packages/`.
- **Engineering, for the recipe:** say so, or build from a clean tree.
- No shared file was written; `git status` on config and game.ts is clean.

Phone 375×812, built-in browser.

**World played:** Ridgeline Freight (small fleet, Columbus), new from day 3 (Wed Jan 3 06:00) to Thu Jan 4 06:00, at Day a minute with pauses. I started Ridgeline Freight Logistics at Wed 11:00.

Severity: **R** blocks the republish · **S** this sprint · **L** later. Screenshots are in `qa-replay-brokerage-hold/`.

## The start sheet

| Row | Result | Evidence | Sev |
|---|---|---|---|
| Three steps, "1 of 3", Back / Next, the verb Start | **Pass** | Step 1 name (default "Ridgeline Freight Logistics"), home hub shown as fixed. Step 2 costs and funding. Step 3 terms. Then a confirm with one summary row per step and **Start Ridgeline Freight Logistics** ([01](qa-replay-brokerage-hold/01-start-step1.jpg), [04](qa-replay-brokerage-hold/04-start-confirm.jpg)) | – |
| 90,300 FD plus the 3% fee | **Pass** | "Moving from Ridgeline Freight · 90,300 FD", "Fee 3% · 2,709 FD", carrier after 81,691 FD (174,700 − 90,300 − 2,709). Brokerage after "90,000 FD, 75,000 of it the bond" ([02](qa-replay-brokerage-hold/02-start-step2-costs.jpg), [03](qa-replay-brokerage-hold/03-start-step2-amount-fee.jpg)) | – |
| The 300 FD gap is said | **Fail, small** | 90,300 moved, 90,000 arrives. The licence is presumably the 300, but no row on step 2 says it is paid out of the transfer | L |
| The amount field | **Pass, rough** | Editable, prefilled. It reads "90300" without a thousands separator, unlike every other figure | L |
| "Full on a phone" (spec §3) | **Fail** | The sheet sits in the lower panel under the map, about half the screen. Step 2's rows need two scrolls | L |
| After Start | **Pass** | Switches into the brokerage. The chip appears top left with a 3 px amber line under the strip. Book shows its empty state: "No loads yet. Shippers offer loads to brokers every round; yours start at 18:00." Iuliia: "You're in Ridgeline Freight Logistics now. Your carrier is one tap away, top left." ([05](qa-replay-brokerage-hold/05-after-start-empty-book.jpg)) | – |
| The chip's icon | **Fail, small** | Before the first round the chip was an empty amber ring. The handshake icon appeared after the 18:00 round | L |
| Possessive | **Fail** | "Ridgeline Freight Logistics's cash after" | L |

## Offered to you (at the Wed 18:00 round)

| Row | Result | Evidence | Sev |
|---|---|---|---|
| The group, its cards, three actions | **Pass** | 20 cards, e.g. "Carrollton → Decatur · van", "Shipper pays 2,146 FD · You'd post at 2,039 (your 5% margin) · Board fee 64" (3% ✓). **Post it** · **Tender to Ridgeline Freight** · **Decline**, plus a margin field ([06](qa-replay-brokerage-hold/06-offered-to-you.jpg)) | – |
| The deadline line | **Pass** | "Decide by 06:00 · 12 h left" | – |
| The if-you-don't line | **Pass, old wording** | "If you don't decide: your standing order posts it at 5%". The writer's 8b8ab49 `ifNotPost` is "…posts it at a 5% margin." Both lines also lack the full stop | L |
| A ring to the window's end (spec §2) | **Missing** | Text only, no ring | L |
| The state line | **Fail** | "Ridgeline Freight Logistics · 20 loads posted" while all 20 were only offered and none posted. The header said "20 loads" the same way. After Decline it read 19, so it counts offers | S |
| Post it | **Pass** | Anson → Albuquerque moved to On the board: "Posted at 3.13/mi · clears 06:00 · in 12 h" | – |
| Decline | **Pass** | Midland → Murrieta left the Book; the count went from 20 to 19 | – |
| Tender to Ridgeline Freight: greyed when the carrier can't take it (spec §7) | **Fail** | Enabled on all 20 cards. The carrier had Truck 1 loaded for Albuquerque and Truck 2 with no driver. The carrier's own card said so ("No idle van truck within 300 mi.", [09](qa-replay-brokerage-hold/09-carrier-tender-card.jpg)), so the check exists on that side | S |
| The tender's sheet (spec §7) | **Partial** | Built as an inline form on the card, not a sheet ([07](qa-replay-brokerage-hold/07-tender-inline-form.jpg)): "Shipper pays you · 2,146 FD", "You pay Ridgeline Freight · 2.48/mi", a slider, "Allowed on this lane · 2.01–2.72/mi", "Your margin · 43 FD", "Paid at net 30, never factored…", **Tender at 2.48/mi** · **Not now**. Missing: "Your carrier earns …, … over its break-even". Also missing: the board fee row (strings line 228); the 64 FD fee only shows in the arithmetic | S |
| After Tender: the brokerage's card | **Fail** | It moved to **On the board** reading "Posted at 2.48/mi · clears 06:00 · in 12 h" with "Tendered to Ridgeline Freight · 06:00" under it. A tendered load isn't on the board until the carrier leaves it (spec §7), so the card says both | S |
| After Tender: the carrier's card | **Pass** | Truck tab: "From Ridgeline Freight Logistics · Carrollton to Decatur · 2.48/mi · accept by 06:00", "…Accept by 06:00 or it goes to the board." It has only Decline, with "No idle van truck within 300 mi." | – |
| Left to expire: to the board **at the rate the carrier was offered** | **Fail** | At Thu 06:00 Carrollton → Decatur was on the board at **2.73/mi**, not 2.48, and above the band's top of 2.72 shown on the form. No "Ridgeline Freight didn't take it · posted at …" line | S |

## Offer to the carrier first (Carriers › Your standing order)

| Row | Result | Evidence | Sev |
|---|---|---|---|
| The switch | **Pass** | "Offer to Ridgeline Freight first", a checkbox with Save ([08](qa-replay-brokerage-hold/08-offer-to-carrier-first.jpg)) | – |
| The if-you-don't line follows it | **Pass** | Every card changed to "If you don't decide: your standing order offers it to Ridgeline Freight first" | – |
| What it did at the deadline | **Can't tell** | At Thu 06:00 all 17 undecided loads were on the board, and the carrier had no tenders from the brokerage. With no free truck, going straight to the board may be correct, but nothing on either side says the offer was tried or skipped | S |
| The rate explanation (spec §2: "tenders at the posting rate held inside the lane's band…") | **Missing** | No line under the switch | L |
| Layout | **Rough** | A 40 px grey checkbox sits on its own line above its label. No confirmation after Save | L |

## Also seen

- **S, for the director and economy:** a brokered load moved at a loss. Perry → Glenview was "Taken by OO-21 at 2.91/mi · Shipper 2,320 · carrier 2,523 · fee 70 · **yours −273 FD**" (red, [10](qa-replay-brokerage-hold/10-moving-negative-margin.jpg)). It was posted under the standing order at 5% and re-priced at the round above what the shipper pays. The spec gives no re-pricing control (open item 2), yet re-pricing happened without the player.
- The tenders the brokerage was offered were almost all in Texas, far from its Columbus hub.
- "Carriers who've hauled for you" is empty with no empty-state line.
- The cap on open loads (20) held: at Thu 06:00 one new tender arrived and nothing more.
- Console: no errors.
