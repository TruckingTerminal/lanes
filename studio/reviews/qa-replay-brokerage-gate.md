# The brokerage gate: replay on the bump preview (QA, 2026-11-03)

Checked against `specs/brokerage-ux.md` (draft 2), `specs/brokerage-strings.md`, `specs/finance-strings.md` (cash now) and the bump table (`reviews/economy-player34.md`, rows 29–33).

**Build:** the bump preview of commit **01fe39d**, `node apps/web/bump-preview.mjs --commit 01fe39d --port 5191 --brokerage-aids`, served at http://localhost:5191/site/index.html.
- **Aids on:** the brokerage layer open at the start and 150,000 FD granted.
- `bump.json` names the commit and `"aids": true`. The script printed "all 33 rows read as the bump sets them", and its rows include `brokerage.enabled: true`, `permits.suretyPctPerYear: [0.01, 0.06]`, `token.credit.premiumMax: 0.1`, `cashReserve.enabled: true` and `token.payment.cashNow.enabled: true`.
- The shared checkout wasn't touched. The player's 5190 was left alone.

**World played:** Gulf Gate (small fleet, Houston, dispatcher off), with Gulf Gate Logistics started at Wed Jan 3 06:00. Played from day 3 to Tue Jan 9 13:00, at Day a minute and Day in 6 s.

Phone 375×812, built-in browser. Console: no errors.

Severity: **R** blocks the brokerage riding the restart · **S** this sprint · **L** later. Screenshots are in `qa-replay-brokerage-gate/`.

## Verdict

No R. The brokerage works end to end: start, Offered to you, post, decline, tender, offer first, the lapse, cash now. Four S rows need fixing before players lean on it, and none is a crash or a money leak:
- the tender form's default rate is refused;
- the brokerage's invoice shows on the carrier's Money;
- the Reserve can't be seen anywhere;
- unmoved loads are re-posted up to the shipper's full rate.

Whether the last of these blocks is the director's call, since it makes the brokerage lose its board fee on those loads.

## The start sheet

| Row | Result | Evidence | Sev |
|---|---|---|---|
| Three steps, the funding, the licence row | **Pass** | Step 2: "Licence · 300 FD a season" · "Bond · 75,000 FD · held, not spent" · "Moving from Gulf Gate · 90,300 FD" · "Fee 3% · 2,709 FD" · "Licence · 300 FD · paid out of the amount you move" · "Gulf Gate's cash after · 81,691 FD" · "Gulf Gate Logistics' cash after · 90,000 FD, 75,000 of it the bond". Confirm: "Start Gulf Gate Logistics" ([01](qa-replay-brokerage-gate/01-start-costs-surety-halved.jpg)) | – |
| The surety premium, halved | **Pass** | "Surety · about 2,250 FD a year at credit C · a cost". It read "about 4,500 FD a year at credit C" before the bump | – |
| The credit premium, halved | **Not shown** | The start sheet has no credit-premium figure, before or after the bump. Row 31 (`token.credit.premiumMax` 0.2 → 0.1) has no line on the sheet to check | L |

## Book

| Row | Result | Evidence | Sev |
|---|---|---|---|
| Offered to you: Post it, Tender, Decline, the deadline, the default line | **Pass** | At 18:00, 20 offers. For example: "Houston → Tulsa · van · Shipper pays 1,591 FD · You'd post at 1,511 (your 5% margin) · Board fee 48 · Decide by 06:00 · 12 h left · If you don't decide: your standing order posts it at a 5% margin." ([02](qa-replay-brokerage-gate/02-offered-to-you.jpg)) | – |
| Post it / Decline | **Pass** | Bloomington → Quincy went to On the board ("Posted at 4.59/mi · clears 06:00"); Los Angeles → El Paso left the Book | – |
| Tender greyed with its reason | **Pass** | 18 of 20 disabled with "Gulf Gate has no free truck in reach of the pickup."; 2 enabled (Houston → Tulsa, Bryan → Abilene) | – |
| **Tender at the form's own default rate** | **Fail** | The form opens at "You pay Gulf Gate · 2.78/mi" (the slider at 2.7715, its max 2.7781), "Allowed on this lane · 2.08–2.78/mi". Pressing **Tender at 2.78/mi** answers in red "That's outside this lane's range: 2.08–2.78/mi." ([03](qa-replay-brokerage-gate/03-tender-default-refused.jpg)). The press does nothing until the slider is moved: at 2.43/mi it went through. A player who takes the default can't tender | S |
| The Tendered card | **Pass** | "Tendered to Gulf Gate · Houston → Tulsa · Tendered to Gulf Gate · 2.43/mi · 06:00", not under On the board. The header counted it: "1 loads posted" against "2 loads" | – |
| Offer first, and its skip line | **Pass** | Carriers: switch on, Save, "Standing order saved." Every card then read "If you don't decide: your standing order offers it to Gulf Gate first.", and on the ones the carrier can't take, e.g. "Gulf Gate has no free dry van at Los Angeles, so your standing order would post it." (the writer's `ownFirstSkips`, trailer and hub named) ([04](qa-replay-brokerage-gate/04-offer-first-skip-line.jpg)) | – |
| A lapsed tender posts at the offered rate, with "{carrier} didn't take it · posted at {rate}" | **Pass** | I didn't accept on the carrier side. At Thu 06:00: "Houston → Tulsa · Posted at 2.43/mi · clears 18:00 · Gulf Gate didn't take it · posted at 2.43/mi" ([05](qa-replay-brokerage-gate/05-lapsed-posted-at-offered-rate.jpg)). Bryan → Abilene, offered to the carrier by the standing order, read "Gulf Gate didn't take it · posted at 2.80/mi" | – |
| No re-pricing above the shipper | **Pass, but to the shipper's full rate** | Over six days the three loads that moved all kept a margin: "Shipper 1,990 · carrier 1,819 · fee 60 · yours 111 FD", "3,340 · 3,173 · 100 · yours 67", "5,385 · 3,832 · 162 · yours 1,391". But unmoved postings climb at each round: Bloomington → Quincy 4.59 → 4.83/mi, Bryan → Abilene 2.80 → 2.95/mi. Worked back from the 5% posting, those are about the shipper's full rate: 4.83 × 1,120 mi ≈ 5,410 FD, the shipper's price, and 2.95 × 657 mi ≈ 1,936. Never above it within rounding, but a hauler taking one at that rate leaves the brokerage minus its board fee (162 and 58 FD). None had moved by the end | S (director's call) |

## Money

| Row | Result | Evidence | Sev |
|---|---|---|---|
| Cash it now on an invoice | **Pass** | Brokerage Money, Owed to you: "#2210 · 3,340 FD · due Feb 6 (27 days) · Cash now: 3,063 lands · fee 277" **Cash it now**. The sheet: "Fee · 8.0% spot + 0.3% at 3 days old · 277 FD" · "You get today · 3,063 FD" · "Your cash after · 13,365 FD" · "The shipper pays the factor on Feb 6. The fee goes to the reserve." · "Cashing it doesn't change what you owe carriers, or when." ([06](qa-replay-brokerage-gate/06-cash-it-now-sheet.jpg)) Confirmed: cash 10,302 → 13,365, row "#2210 · due Feb 6 · Cashed Jan 9 · 3,063 FD received". The sheet's first line reads "Invoice · #2210 to · 3,340 FD" with the shipper's name missing after "to" (L) | – |
| The bond meter | **Pass** | "8,825 of your 75,000 FD bond in use", and Owed by you lists the three carriers | – |
| **The brokerage's invoice shows on the carrier's Money** | **Fail** | After cashing, the carrier Gulf Gate's Money › Owed to you reads "#2210 · due Feb 6 · Cashed Jan 9 · 3,063 FD received". It's the brokerage's invoice, and the carrier has no invoices of its own ([07](qa-replay-brokerage-gate/07-carrier-money-shows-brokerage-invoice.jpg)). The two companies' paper should never mix (spec §2) | S |
| The Reserve's line on Money | **Not found** | `cashReserve.enabled` is true in this build, but there's no Reserve line, button or figure on the carrier's Money (token fold opened), the brokerage's Money, or Finance. I couldn't deposit to or see the Reserve anywhere | S |

## Known and not re-tested

The on-time ring, the tender sheet's earnings and board-fee rows, and the carrier side of the offer-first line.

## Also seen

- The brokerage Money has no "This month" section and no "Getting paid ›" row (spec §2 Money, items 4–5).
- Posted cards keep a disabled "Tender to Gulf Gate" button with its reason under them, after the load is already on the board.
